import { useEffect, useState } from 'react';

export type ThemePref = 'auto' | 'light' | 'dark';

/** Which dinosaur appears as the mascot. Independent of the color. */
export type DinoName =
  | 'stegosaurus'
  | 'velociraptor'
  | 'brachiosaurus'
  | 'tyrannosaurus'
  | 'triceratops';

/** Which color the whole interface takes. Independent of the dinosaur. */
export type Palette = 'green' | 'red' | 'blue' | 'purple' | 'pink';

export const DINOS: { value: DinoName; label: string }[] = [
  { value: 'stegosaurus', label: 'Stegosaurus' },
  { value: 'velociraptor', label: 'Velociraptor' },
  { value: 'brachiosaurus', label: 'Brachiosaurus' },
  { value: 'tyrannosaurus', label: 'Tyrannosaurus' },
  { value: 'triceratops', label: 'Triceratops' },
];

export const PALETTES: { value: Palette; label: string }[] = [
  { value: 'green', label: 'Fern' },
  { value: 'red', label: 'Rust' },
  { value: 'blue', label: 'Lagoon' },
  { value: 'purple', label: 'Amethyst' },
  { value: 'pink', label: 'Blossom' },
];

/** The palette that ships with the app, and the neutral used in the pickers. */
export const DEFAULT_PALETTE: Palette = 'green';
const DEFAULT_DINO: DinoName = 'stegosaurus';

const MODE_KEY = 'stego.theme';
const DINO_KEY = 'stego.dino';
const PALETTE_KEY = 'stego.palette';
const SYNC_THEME_KEY = 'stego.syncTheme';
const CHANGED_AT_KEY = 'stego.theme.changedAt';
/** Written by versions that bundled the dinosaur and color into one choice. */
const LEGACY_SKIN_KEY = 'stego.skin';

/** Old single-choice values map onto the pair they used to imply. */
const LEGACY_SKINS: Record<string, { dino: DinoName; palette: Palette }> = {
  stegosaurus: { dino: 'stegosaurus', palette: 'green' },
  velociraptor: { dino: 'velociraptor', palette: 'red' },
  brachiosaurus: { dino: 'brachiosaurus', palette: 'blue' },
  tyrannosaurus: { dino: 'tyrannosaurus', palette: 'purple' },
  triceratops: { dino: 'triceratops', palette: 'pink' },
};

export function isDino(value: unknown): value is DinoName {
  return DINOS.some((d) => d.value === value);
}

export function isPalette(value: unknown): value is Palette {
  return PALETTES.some((p) => p.value === value);
}

/** Splits a legacy `skin` value into the two choices it used to combine. */
export function fromLegacySkin(skin: unknown): { dino: DinoName; palette: Palette } | null {
  return typeof skin === 'string' ? (LEGACY_SKINS[skin] ?? null) : null;
}

function readMode(): ThemePref {
  if (typeof localStorage === 'undefined') return 'auto';
  const saved = localStorage.getItem(MODE_KEY);
  return saved === 'light' || saved === 'dark' ? saved : 'auto';
}

function readDino(): DinoName {
  if (typeof localStorage === 'undefined') return DEFAULT_DINO;
  const saved = localStorage.getItem(DINO_KEY);
  if (isDino(saved)) return saved;
  return fromLegacySkin(localStorage.getItem(LEGACY_SKIN_KEY))?.dino ?? DEFAULT_DINO;
}

function readPalette(): Palette {
  if (typeof localStorage === 'undefined') return DEFAULT_PALETTE;
  const saved = localStorage.getItem(PALETTE_KEY);
  if (isPalette(saved)) return saved;
  return fromLegacySkin(localStorage.getItem(LEGACY_SKIN_KEY))?.palette ?? DEFAULT_PALETTE;
}

function applyMode(pref: ThemePref) {
  const root = document.documentElement;
  // "auto" leaves the attribute off so the prefers-color-scheme rules decide.
  if (pref === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
}

function applyPalette(palette: Palette) {
  document.documentElement.setAttribute('data-palette', palette);
}

// The status bar and window frame paint outside the page, so both are told the
// background. Read from body, which resolves to an actual rgb().
function syncChrome() {
  if (typeof document === 'undefined') return;
  const bg = getComputedStyle(document.body).backgroundColor;
  if (!bg) return;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', bg);

  void window.stegoDesktop?.setWindowBackground?.(bg);
}

function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private-mode storage failures are not worth interrupting the app for.
  }
}

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function setDino(dino: DinoName) {
  store(DINO_KEY, dino);
  touch();
  notify();
}

export function setPalette(palette: Palette) {
  applyPalette(palette);
  store(PALETTE_KEY, palette);
  touch();
  syncChrome();
  notify();
}

export function setMode(pref: ThemePref) {
  applyMode(pref);
  store(MODE_KEY, pref);
  touch();
  syncChrome();
  notify();
}

// Sync compares this against the server's stamp, so a change made here since
// the last sync is not overwritten by the older appearance already up there.
function touch() {
  store(CHANGED_AT_KEY, String(Date.now()));
}

/** When appearance last changed on this device, epoch ms. */
export function themeChangedAt(): number {
  if (typeof localStorage === 'undefined') return 0;
  return Number(localStorage.getItem(CHANGED_AT_KEY)) || 0;
}

/** Stamps the appearance as having come from the server at that moment. */
export function setThemeChangedAt(at: number) {
  store(CHANGED_AT_KEY, String(at));
}

export function currentDino(): DinoName {
  return readDino();
}

export function currentPalette(): Palette {
  return readPalette();
}

export function currentMode(): ThemePref {
  return readMode();
}

function useAppearanceValue<T>(read: () => T): T {
  const [value, setValue] = useState<T>(read);
  useEffect(() => {
    const sync = () => setValue(read());
    listeners.add(sync);
    sync();
    return () => {
      listeners.delete(sync);
    };
    // `read` is a stable module function in every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return value;
}

export function useTheme(): [ThemePref, (next: ThemePref) => void] {
  return [useAppearanceValue(readMode), setMode];
}

export function useDino(): [DinoName, (next: DinoName) => void] {
  return [useAppearanceValue(readDino), setDino];
}

export function usePalette(): [Palette, (next: Palette) => void] {
  return [useAppearanceValue(readPalette), setPalette];
}

/** Local only by design: it answers "should this device follow the others", so
 * syncing it would let one device answer for all of them. */
export function useSyncTheme(): [boolean, (next: boolean) => void] {
  return [useAppearanceValue(readSyncTheme), setSyncTheme];
}

export function currentSyncTheme(): boolean {
  return readSyncTheme();
}

export function setSyncTheme(on: boolean) {
  store(SYNC_THEME_KEY, on ? 'on' : 'off');
  notify();
}

function readSyncTheme(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(SYNC_THEME_KEY) === 'on';
}

/** Applied before React mounts so the first paint is already the right theme. */
export function applyStoredTheme() {
  applyMode(readMode());
  applyPalette(readPalette());
}

/** Called once the page has painted, when the body color is readable. */
export function syncSystemChrome() {
  syncChrome();
}

// A change of system appearance while on "match device" repaints too.
if (typeof window !== 'undefined' && window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (readMode() === 'auto') syncChrome();
  });
}
