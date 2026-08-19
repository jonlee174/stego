const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');

const DEV_URL = process.env.STEGO_DEV_URL;

/** Must match the iCloud container on the iOS side for the two to share a file. */
const ICLOUD_CONTAINER = 'iCloud.com.jonlee.stego';

/**
 * iCloud exposes a container at ~/Library/Mobile Documents/<id with dots as
 * tildes>/Documents. It only exists once the container has been provisioned,
 * which happens after the iOS app runs once under the same Apple ID.
 */
function icloudDir() {
  return path.join(
    os.homedir(),
    'Library',
    'Mobile Documents',
    ICLOUD_CONTAINER.replace(/\./g, '~'),
    'Documents',
  );
}

function localFile() {
  return path.join(app.getPath('userData'), 'decks.json');
}

/** The iCloud copy when it is available, otherwise a plain local file. */
function DECKS_FILE() {
  try {
    if (fsSync.existsSync(icloudDir())) return path.join(icloudDir(), 'decks.json');
  } catch {
    // Fall through to local storage.
  }
  return localFile();
}

let mainWindow = null;
/** What this process last wrote, so its own saves don't look like remote edits. */
let lastWritten = null;
let watched = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 380,
    minHeight: 520,
    title: 'Stego',
    backgroundColor: '#DCDCC8',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 15 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (DEV_URL) {
    mainWindow.loadURL(DEV_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // Keep navigation inside the app; send real links to the browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  // The traffic lights overlay the top-left of the page in `hiddenInset` mode,
  // but not in fullscreen. Keep the renderer told so its bar can make room.
  const reportInset = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send('window:inset', !mainWindow.isFullScreen());
  };
  mainWindow.on('enter-full-screen', reportInset);
  mainWindow.on('leave-full-screen', reportInset);
  mainWindow.webContents.on('did-finish-load', reportInset);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  watchDecks();
}

/**
 * Polls the deck file so edits synced down from another device show up without
 * a restart. Polling rather than fs.watch because iCloud swaps the file out
 * from under us rather than writing in place.
 */
function watchDecks() {
  const target = DECKS_FILE();
  if (watched === target) return;
  if (watched) fsSync.unwatchFile(watched);
  watched = target;

  fsSync.watchFile(target, { interval: 2000 }, async () => {
    try {
      const contents = await fs.readFile(target, 'utf8');
      // Ignore the echo of our own save.
      if (contents === lastWritten) return;
      lastWritten = contents;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('decks:changed', contents);
      }
    } catch {
      // The file can vanish mid-sync; the next tick will pick it up.
    }
  });
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac
      ? [
          {
            label: 'Stego',
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' },
            ],
          },
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Reveal decks.json in Finder',
          click: () => shell.showItemInFolder(DECKS_FILE()),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

ipcMain.handle('decks:read', async () => {
  const target = DECKS_FILE();
  try {
    const contents = await fs.readFile(target, 'utf8');
    lastWritten = contents;
    return contents;
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    // Nothing in iCloud yet? Adopt an existing local file so turning sync on
    // carries the decks over instead of starting empty.
    if (target !== localFile()) {
      try {
        const carried = await fs.readFile(localFile(), 'utf8');
        lastWritten = carried;
        return carried;
      } catch {
        return null;
      }
    }
    return null;
  }
});

ipcMain.handle('decks:write', async (_event, contents) => {
  const target = DECKS_FILE();
  await fs.mkdir(path.dirname(target), { recursive: true });
  // Write to a sibling temp file first so a crash mid-write can't truncate the deck file.
  const temp = `${target}.tmp`;
  await fs.writeFile(temp, contents, 'utf8');
  await fs.rename(temp, target);
  lastWritten = contents;
  watchDecks();
});

ipcMain.handle('decks:path', async () => DECKS_FILE());

ipcMain.handle('decks:syncing', async () => DECKS_FILE() !== localFile());

ipcMain.handle('decks:export', async (_event, filename, contents) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow ?? undefined, {
    title: 'Export decks',
    defaultPath: path.join(app.getPath('downloads'), filename),
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (canceled || !filePath) return null;
  await fs.writeFile(filePath, contents, 'utf8');
  return filePath;
});

app.whenReady().then(() => {
  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
