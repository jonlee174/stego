import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';

/**
 * Writes a JSON export wherever the current platform can put one, and returns a
 * sentence describing where it landed.
 */
export async function exportJson(filename: string, contents: string): Promise<string> {
  const bridge = typeof window !== 'undefined' ? window.stegoDesktop : undefined;

  if (bridge) {
    const saved = await bridge.saveExport(filename, contents);
    if (!saved) throw new ExportCancelled();
    return `Exported to ${saved}`;
  }

  if (Capacitor.isNativePlatform()) {
    await Filesystem.writeFile({
      path: filename,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
      data: contents,
      recursive: true,
    });
    return `Exported to Files › Stego › ${filename}`;
  }

  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return `Exported ${filename}`;
}

export class ExportCancelled extends Error {
  constructor() {
    super('Export cancelled');
    this.name = 'ExportCancelled';
  }
}

/** Opens a file picker and resolves with the chosen file's text, or null. */
export function pickJsonFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.style.display = 'none';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        input.remove();
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        resolve(typeof reader.result === 'string' ? reader.result : null);
        input.remove();
      };
      reader.onerror = () => {
        resolve(null);
        input.remove();
      };
      reader.readAsText(file);
    };
    document.body.appendChild(input);
    input.click();
  });
}

export function timestampedName(prefix = 'stego-decks'): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${prefix}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.json`;
}
