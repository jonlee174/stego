import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { cloud } from './cloud';
import type { Deck, DeckFile } from '../types';

export const DECKS_FILE = 'decks.json';
const LOCAL_KEY = 'stego.decks.json';
export const FILE_VERSION = 1;

/** Bridge exposed by the Electron preload script. Absent everywhere else. */
export interface StegoDesktopBridge {
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
  /**
   * Calls back when the file changes underneath us. Returns a teardown.
   * Every platform also re-reads on focus, which covers returning to the app
   * after editing on another device.
   */
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
      // Nothing in iCloud yet: adopt whatever is already on this device so
      // enabling sync carries the decks up instead of wiping them.
      if (remote !== null) return remote;
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

export function storageKind(): Backend['name'] {
  return backend().name;
}

export function storageLocation(): Promise<string> {
  return backend().location();
}

export function isSyncing(): Promise<boolean> {
  return backend().syncing().catch(() => false);
}

/**
 * Notifies when the deck file changes outside this app — a push from iCloud on
 * the desktop, or coming back to the app after editing on another device.
 */
export function watchDecks(onChange: (decks: Deck[]) => void): () => void {
  let stopped = false;

  const deliver = (raw: string | null) => {
    if (stopped || !raw) return;
    try {
      onChange(parseDeckFile(raw));
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

  return () => {
    stopped = true;
    stopBackend();
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
      };
    }),
  };
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'deck';
}

export function serializeDecks(decks: Deck[]): string {
  const file: DeckFile = { version: FILE_VERSION, decks };
  return JSON.stringify(file, null, 4);
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

export async function saveDecks(decks: Deck[]): Promise<void> {
  try {
    await backend().write(serializeDecks(decks));
  } catch (err) {
    // A failed write must not take the UI down with it.
    console.error('Could not write decks.json', err);
  }
}
