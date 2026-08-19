import { useEffect, useState } from 'react';

export type ThemePref = 'auto' | 'light' | 'dark';

const KEY = 'stego.theme';

function read(): ThemePref {
  if (typeof localStorage === 'undefined') return 'auto';
  const saved = localStorage.getItem(KEY);
  return saved === 'light' || saved === 'dark' ? saved : 'auto';
}

function apply(pref: ThemePref) {
  const root = document.documentElement;
  // "auto" leaves the attribute off so the prefers-color-scheme rules decide.
  if (pref === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
}

export function useTheme(): [ThemePref, (next: ThemePref) => void] {
  const [pref, setPref] = useState<ThemePref>(read);

  useEffect(() => {
    apply(pref);
    try {
      localStorage.setItem(KEY, pref);
    } catch {
      // Private-mode storage failures are not worth interrupting the app for.
    }
  }, [pref]);

  return [pref, setPref];
}

/** Applied before React mounts so the first paint is already the right theme. */
export function applyStoredTheme() {
  apply(read());
}
