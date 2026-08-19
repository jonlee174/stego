const { contextBridge, ipcRenderer } = require('electron');

// The only surface the renderer gets. Everything else stays in the main process.
contextBridge.exposeInMainWorld('stegoDesktop', {
  readDecks: () => ipcRenderer.invoke('decks:read'),
  writeDecks: (contents) => ipcRenderer.invoke('decks:write', contents),
  decksPath: () => ipcRenderer.invoke('decks:path'),
  saveExport: (filename, contents) => ipcRenderer.invoke('decks:export', filename, contents),
  /** Fires with true while the window's traffic lights overlay the page. */
  onTrafficLights: (cb) => {
    ipcRenderer.on('window:inset', (_event, overlapping) => cb(overlapping));
  },
  isSyncing: () => ipcRenderer.invoke('decks:syncing'),
  /** Fires with the file contents when another device changes the decks. */
  onDecksChanged: (cb) => {
    ipcRenderer.on('decks:changed', (_event, contents) => cb(contents));
  },
});
