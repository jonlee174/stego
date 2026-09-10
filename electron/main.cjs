const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs/promises');
const fsSync = require('node:fs');

const DEV_URL = process.env.STEGO_DEV_URL;

/** Must match the iCloud container on the iOS side for the two to share a file. */
const ICLOUD_CONTAINER = 'iCloud.com.jonlee.stego';

// Sandboxed, os.homedir() is the app container, not the user's home.
function realHome() {
  const home = os.homedir();
  const marker = `${path.sep}Library${path.sep}Containers${path.sep}`;
  const cut = home.indexOf(marker);
  return cut === -1 ? home : home.slice(0, cut);
}

function icloudContainer() {
  return path.join(
    realHome(),
    'Library',
    'Mobile Documents',
    ICLOUD_CONTAINER.replace(/\./g, '~'),
  );
}

function icloudDir() {
  return path.join(icloudContainer(), 'Documents');
}

// Remembered between launches, or every start flashes the default green.
function chromeFile() {
  return path.join(app.getPath('userData'), 'window-background');
}

function savedBackground() {
  try {
    const value = fsSync.readFileSync(chromeFile(), 'utf8').trim();
    return /^(#[0-9a-f]{3,8}|rgba?\([\d.,\s%]+\))$/i.test(value) ? value : null;
  } catch {
    return null;
  }
}

function localFile() {
  return path.join(app.getPath('userData'), 'decks.json');
}

// Local only. Electron cannot claim a ubiquity container, so writing to the
// iCloud folder looked like sync while never syncing. See AGENTS.md.
function DECKS_FILE() {
  return localFile();
}

/** Where earlier builds put the file, so those decks are not stranded. */
function legacyICloudFile() {
  return path.join(icloudDir(), 'decks.json');
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
    backgroundColor: savedBackground() ?? '#DCDCC8',
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

// Polled rather than fs.watch: the file gets swapped out, not written in place.
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

    // First run after the move to local storage: adopt whatever an earlier
    // build left in the iCloud container folder so no decks are lost.
    try {
      const carried = await fs.readFile(legacyICloudFile(), 'utf8');
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, carried, 'utf8');
      lastWritten = carried;
      return carried;
    } catch {
      return null;
    }
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

ipcMain.handle('window:background', async (_event, color) => {
  if (typeof color !== 'string') return;
  try {
    mainWindow?.setBackgroundColor(color);
    await fs.mkdir(path.dirname(chromeFile()), { recursive: true });
    await fs.writeFile(chromeFile(), color, 'utf8');
  } catch {
    // Cosmetic only, so a failure here must not surface to the user.
  }
});

ipcMain.handle('decks:path', async () => DECKS_FILE());

// The desktop build does not sync, so Settings must not claim that it does.
ipcMain.handle('decks:syncing', async () => false);

ipcMain.handle('decks:export', async (_event, filename, contents) => {
  // Must match the extension already on the suggested name, or the macOS save
  // panel rejects its own suggestion and offers to double the extension.
  const ext = path.extname(filename).replace(/^\./, '') || 'json';
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow ?? undefined, {
    title: 'Export decks',
    defaultPath: path.join(app.getPath('downloads'), filename),
    filters: [
      { name: 'Stego deck', extensions: [ext] },
      { name: 'All files', extensions: ['*'] },
    ],
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
