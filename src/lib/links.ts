/** Recorded when the rules are accepted, so a change can be re-prompted later. */
export const RULES_VERSION = '2026-09-10';

export const PRIVACY_URL = 'https://jonlee174.github.io/stego/privacy.html';
export const RULES_URL = 'https://jonlee174.github.io/stego/rules.html';
export const SUPPORT_URL = 'https://jonlee174.github.io/stego/support.html';

/** Electron routes new windows to the browser; Capacitor hands off to Safari. */
export function openExternal(url: string) {
  window.open(url, '_blank', 'noopener');
}
