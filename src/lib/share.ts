import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { DECK_EXTENSION, exportJson } from './transfer';

/** Whether the native share sheet, and so iMessage, is reachable here. */
export function canShare(): boolean {
  return Capacitor.isNativePlatform();
}

function safeName(name: string): string {
  const cleaned = name.replace(/[^\p{L}\p{N} _-]/gu, '').trim();
  return (cleaned || 'Stego decks').slice(0, 60);
}

// Written to the cache first: the sheet shares a file URL, and a real
// attachment is what opens straight into the recipient's Stego.
export async function shareDecks(title: string, contents: string): Promise<void> {
  const filename = `${safeName(title)}.${DECK_EXTENSION}`;

  await Filesystem.writeFile({
    path: filename,
    directory: Directory.Cache,
    encoding: Encoding.UTF8,
    data: contents,
    recursive: true,
  });

  const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });

  await Share.share({
    title,
    // Named rather than described, since the message already shows the file.
    files: [uri],
    dialogTitle: 'Share deck',
  });
}

/** Writes the deck file somewhere the person keeps files. */
export async function saveDecksToFiles(title: string, contents: string): Promise<string> {
  return exportJson(`${safeName(title)}.${DECK_EXTENSION}`, contents);
}
