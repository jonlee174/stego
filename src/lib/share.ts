import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { exportJson } from './transfer';

/** Extension registered in Info.plist so iOS opens these files in Stego. */
export const DECK_EXTENSION = 'stegodeck';

/** Whether the native share sheet, and so iMessage, is reachable here. */
export function canShare(): boolean {
  return Capacitor.isNativePlatform();
}

function safeName(name: string): string {
  const cleaned = name.replace(/[^\p{L}\p{N} _-]/gu, '').trim();
  return (cleaned || 'Stego decks').slice(0, 60);
}

/**
 * Hands the deck file to the system share sheet, which is where iMessage, Mail
 * and AirDrop live. The file is written to the cache first because the sheet
 * shares a file URL rather than raw text, and a real attachment is what lets
 * the person receiving it open the deck straight into Stego.
 */
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
