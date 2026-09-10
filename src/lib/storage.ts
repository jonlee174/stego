import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { cloud } from './cloud';
import type { AppSettings, Card, Deck, DeckFile, Tombstone } from '../types';

const DECKS_FILE = 'decks.json';
const LOCAL_KEY = 'stego.decks.json';
const FILE_VERSION = 1;

/** Bridge exposed by the Electron preload script. Absent everywhere else. */
interface StegoDesktopBridge {
  readDecks(): Promise<string | null>;
  writeDecks(contents: string): Promise<void>;
  decksPath(): Promise<string>;
  /** Opens a save panel; resolves with the chosen path, or null if cancelled. */
  saveExport(filename: string, contents: string): Promise<string | null>;
  /** Fires with true while the window's traffic lights overlay the page. */
  onTrafficLights(cb: (overlapping: boolean) => void): void;
  /** True when the deck file lives in the shared iCloud container. */
  isSyncing(): Promise<boolean>;
  /** Fires with the file contents when another device changes the decks. */
  onDecksChanged(cb: (contents: string) => void): void;
  /** Repaints the window frame so it matches the active theme. */
  setWindowBackground?(color: string): Promise<void>;
}

declare global {
  interface Window {
    stegoDesktop?: StegoDesktopBridge;
  }
}

interface Backend {
  name: 'desktop' | 'native' | 'browser';
  read(): Promise<string | null>;
  write(contents: string): Promise<void>;
  location(): Promise<string>;
  /** Whether decks are being shared through iCloud on this platform. */
  syncing(): Promise<boolean>;
  /** Calls back when the file changes underneath us. Returns a teardown. */
  watch(onChange: (contents: string) => void): () => void;
}

const desktopBackend = (bridge: StegoDesktopBridge): Backend => ({
  name: 'desktop',
  read: () => bridge.readDecks(),
  write: (contents) => bridge.writeDecks(contents),
  location: () => bridge.decksPath(),
  syncing: () => bridge.isSyncing(),
  watch(onChange) {
    bridge.onDecksChanged(onChange);
    // The main process owns the watcher for the window's lifetime.
    return () => {};
  },
});

async function readLocal(): Promise<string | null> {
  try {
    const res = await Filesystem.readFile({
      path: DECKS_FILE,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });
    return typeof res.data === 'string' ? res.data : null;
  } catch {
    // No file yet on a fresh install.
    return null;
  }
}

async function writeLocal(contents: string): Promise<void> {
  await Filesystem.writeFile({
    path: DECKS_FILE,
    directory: Directory.Documents,
    encoding: Encoding.UTF8,
    data: contents,
    recursive: true,
  });
}

const nativeBackend: Backend = {
  name: 'native',
  async read() {
    if (await cloud.available()) {
      const remote = await cloud.read(DECKS_FILE);
      if (remote !== null) return remote;

      // The caller treats read()'s result as already stored and skips the
      // write, so deferring this leaves the container empty forever.
      const local = await readLocal();
      if (local !== null) {
        try {
          await cloud.write(DECKS_FILE, local);
        } catch {
          // Keep serving the local copy; the next write will retry.
        }
      }
      return local;
    }
    return readLocal();
  },
  async write(contents) {
    if (await cloud.available()) {
      try {
        await cloud.write(DECKS_FILE, contents);
        return;
      } catch {
        // Fall back rather than lose the edit.
      }
    }
    await writeLocal(contents);
  },
  async location() {
    // The real sandbox path is noise on a phone; the Files app shows this name.
    return (await cloud.available())
      ? `iCloud \u203a Stego \u203a ${DECKS_FILE}`
      : `Files \u203a Stego \u203a ${DECKS_FILE}`;
  },
  syncing: () => cloud.available(),
  watch() {
    // iOS gets fresh contents through the focus re-read in watchDecks below.
    return () => {};
  },
};

const browserBackend: Backend = {
  name: 'browser',
  async read() {
    return localStorage.getItem(LOCAL_KEY);
  },
  async write(contents) {
    localStorage.setItem(LOCAL_KEY, contents);
  },
  async location() {
    return `browser storage (${LOCAL_KEY})`;
  },
  async syncing() {
    return false;
  },
  watch() {
    return () => {};
  },
};

let cached: Backend | null = null;

function backend(): Backend {
  if (cached) return cached;
  if (typeof window !== 'undefined' && window.stegoDesktop) {
    cached = desktopBackend(window.stegoDesktop);
  } else if (Capacitor.isNativePlatform()) {
    cached = nativeBackend;
  } else {
    cached = browserBackend;
  }
  return cached;
}

/** Which shell the app is running in, so copy can be accurate about syncing. */
export function storageKind(): 'desktop' | 'native' | 'browser' {
  return backend().name;
}

export function storageLocation(): Promise<string> {
  return backend().location();
}

export function isSyncing(): Promise<boolean> {
  return backend().syncing().catch(() => false);
}

/** Fires when the deck file changes outside this app. */
export function watchDecks(onChange: (decks: Deck[], raw: string) => void): () => void {
  let stopped = false;

  const deliver = (raw: string | null) => {
    if (stopped || !raw) return;
    try {
      onChange(parseDeckFile(raw), raw);
    } catch {
      // A half-synced file will parse fine on the next notification.
    }
  };

  const stopBackend = backend().watch(deliver);

  const reread = () => {
    if (document.visibilityState === 'visible') {
      backend().read().then(deliver, () => {});
    }
  };
  window.addEventListener('focus', reread);
  document.addEventListener('visibilitychange', reread);

  // iCloud takes a few seconds to provision on a fresh install; without these
  // the app sits on local storage until the next launch.
  const retries = [3000, 8000, 20000].map((delay) =>
    setTimeout(() => {
      if (!stopped) backend().read().then(deliver, () => {});
    }, delay),
  );

  return () => {
    stopped = true;
    stopBackend();
    retries.forEach(clearTimeout);
    window.removeEventListener('focus', reread);
    document.removeEventListener('visibilitychange', reread);
  };
}

/** Accepts both the current file shape and the 2021 Kivy `decks.json` layout. */
export function parseDeckFile(raw: string): Deck[] {
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== 'object') return [];
  const decks = (data as { decks?: unknown }).decks;
  if (!Array.isArray(decks)) return [];

  return decks.map((entry, i) => normalizeDeck(entry, i));
}

function normalizeDeck(entry: unknown, index: number): Deck {
  const raw = (entry ?? {}) as Record<string, unknown>;
  const name = typeof raw.name === 'string' ? raw.name : `Deck ${index + 1}`;
  // The legacy format stored cards under `deck` with info_front/info_back keys.
  const rawCards = Array.isArray(raw.cards)
    ? raw.cards
    : Array.isArray(raw.deck)
      ? raw.deck
      : [];
  const now = Date.now();

  return {
    id: typeof raw.id === 'string' ? raw.id : `deck_${index}_${slug(name)}`,
    name,
    description: typeof raw.description === 'string' ? raw.description : '',
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : now,
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : now,
    cards: rawCards.map((c, k) => {
      const card = (c ?? {}) as Record<string, unknown>;
      const front = str(card.front ?? card.info_front);
      const back = str(card.back ?? card.info_back);
      return {
        id: typeof card.id === 'string' ? card.id : `card_${index}_${k}`,
        front,
        back,
        ...(isReviewState(card.review) ? { review: card.review } : {}),
      };
    }),
  };
}

function isReviewState(value: unknown): value is Card['review'] {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  return ['ease', 'interval', 'due', 'reps', 'lapses'].every((k) => typeof r[k] === 'number');
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'deck';
}

export function serializeDecks(
  decks: Deck[],
  settings?: AppSettings | null,
  deleted?: Tombstone[],
): string {
  const file: DeckFile = { version: FILE_VERSION, decks };
  // Appearance travels in the same file as the decks, so it syncs the same way.
  if (settings) file.settings = settings;
  if (deleted && deleted.length > 0) file.deleted = deleted;
  return JSON.stringify(file, null, 4);
}

export function parseTombstones(raw: string): Tombstone[] {
  try {
    const data: unknown = JSON.parse(raw);
    const deleted = (data as { deleted?: unknown } | null)?.deleted;
    if (!Array.isArray(deleted)) return [];
    return deleted.flatMap((entry) => {
      const t = (entry ?? {}) as Record<string, unknown>;
      return typeof t.id === 'string' && typeof t.at === 'number'
        ? [{ id: t.id, at: t.at }]
        : [];
    });
  } catch {
    return [];
  }
}

/** Reads the appearance block, tolerating files written before it existed. */
export function parseSettings(raw: string): AppSettings | null {
  try {
    const data: unknown = JSON.parse(raw);
    const settings = (data as { settings?: unknown } | null)?.settings;
    if (!settings || typeof settings !== 'object') return null;
    const { dino, palette, mode, skin, syncTheme } = settings as Record<string, unknown>;
    const out: AppSettings = {};
    if (typeof dino === 'string') out.dino = dino;
    if (typeof palette === 'string') out.palette = palette;
    if (typeof skin === 'string') out.skin = skin;
    if (typeof syncTheme === 'boolean') out.syncTheme = syncTheme;
    if (mode === 'auto' || mode === 'light' || mode === 'dark') out.mode = mode;
    return out.dino || out.palette || out.skin || out.mode || out.syncTheme !== undefined
      ? out
      : null;
  } catch {
    return null;
  }
}

export async function loadDecks(): Promise<Deck[]> {
  try {
    const raw = await backend().read();
    if (!raw) return [];
    return parseDeckFile(raw);
  } catch (err) {
    console.error('Could not read decks.json', err);
    return [];
  }
}

export async function loadRaw(): Promise<string | null> {
  try {
    return await backend().read();
  } catch {
    return null;
  }
}

/** Appearance stored in the synced file, or null when it has none yet. */
export async function loadSettings(): Promise<AppSettings | null> {
  try {
    const raw = await backend().read();
    return raw ? parseSettings(raw) : null;
  } catch {
    return null;
  }
}

export async function saveDecks(
  decks: Deck[],
  settings?: AppSettings | null,
  deleted?: Tombstone[],
): Promise<void> {
  try {
    await backend().write(serializeDecks(decks, settings, deleted));
  } catch (err) {
    // A failed write must not take the UI down with it.
    console.error('Could not write decks.json', err);
  }
}
