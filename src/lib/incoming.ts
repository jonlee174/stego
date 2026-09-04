import { App, type URLOpenListenerEvent } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { DECK_EXTENSION } from './share';

/**
 * A deck someone sent. iOS hands the app a file URL when a `.stegodeck`
 * attachment is tapped in Messages, Mail or Files, and this turns that into the
 * file's contents so the decks inside can be added.
 */

/** Strips the file:// wrapper and percent-encoding iOS puts on the path. */
function toPath(url: string): string {
  const withoutScheme = url.replace(/^file:\/\//, '');
  try {
    return decodeURIComponent(withoutScheme);
  } catch {
    return withoutScheme;
  }
}

function looksLikeDeck(url: string): boolean {
  return url.toLowerCase().includes(`.${DECK_EXTENSION}`) || url.toLowerCase().endsWith('.json');
}

async function readShared(url: string): Promise<string | null> {
  try {
    const res = await Filesystem.readFile({ path: toPath(url), encoding: Encoding.UTF8 });
    return typeof res.data === 'string' ? res.data : null;
  } catch {
    // Some senders hand over a copy in the inbox instead of a readable path.
    try {
      const name = toPath(url).split('/').pop() ?? '';
      const res = await Filesystem.readFile({
        path: `Inbox/${name}`,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
      });
      return typeof res.data === 'string' ? res.data : null;
    } catch {
      return null;
    }
  }
}

/**
 * Calls back with the contents of any deck file opened from outside the app.
 * Returns a teardown. Does nothing off native, where there is no share sheet.
 */
export function watchIncomingDecks(onDeckFile: (contents: string) => void): () => void {
  if (!Capacitor.isNativePlatform()) return () => {};

  let stopped = false;

  const handle = async (url: string | undefined) => {
    if (stopped || !url || !looksLikeDeck(url)) return;
    const contents = await readShared(url);
    if (contents && !stopped) onDeckFile(contents);
  };

  // A tap while the app is already running.
  const listener = App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
    void handle(event.url);
  });

  // A tap that launched the app: the URL is waiting rather than announced.
  void App.getLaunchUrl()
    .then((launch) => handle(launch?.url))
    .catch(() => {});

  return () => {
    stopped = true;
    void listener.then((l) => l.remove()).catch(() => {});
  };
}
