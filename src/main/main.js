const { app, BrowserWindow, dialog, session, Menu } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const { initDatabase, run } = require('../database/database');
const { registerIpcHandlers, endCurrentSession } = require('./ipcHandlers');

let mainWindow;

app.setAppUserModelId('com.nexbit.pos');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: 'Next Byte',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.maximize();
  mainWindow.show();

  const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  }

  // Context menu (copy/paste/spellcheck)
  mainWindow.webContents.on('context-menu', (_, params) => {
    const menuItems = [];

    // Spellcheck suggestions
    if (params.misspelledWord) {
      for (const sug of params.dictionarySuggestions.slice(0, 4)) {
        menuItems.push({
          label: sug,
          click: () => mainWindow.webContents.replaceMisspelling(sug),
        });
      }
      if (params.dictionarySuggestions.length > 0) {
        menuItems.push({ type: 'separator' });
      }
    }

    // Editable field actions
    if (params.isEditable) {
      if (params.editFlags.canUndo) menuItems.push({ label: 'Deshacer', role: 'undo' });
      if (params.editFlags.canRedo) menuItems.push({ label: 'Rehacer', role: 'redo' });
      if (params.editFlags.canUndo || params.editFlags.canRedo) menuItems.push({ type: 'separator' });

      if (params.editFlags.canCut) menuItems.push({ label: 'Cortar', role: 'cut' });
      if (params.editFlags.canCopy) menuItems.push({ label: 'Copiar', role: 'copy' });
      if (params.editFlags.canPaste) menuItems.push({ label: 'Pegar', role: 'paste' });
      if (params.editFlags.canDelete) menuItems.push({ label: 'Eliminar', role: 'delete' });
      if (params.editFlags.canSelectAll) menuItems.push({ label: 'Seleccionar todo', role: 'selectAll' });
    } else {
      if (params.linkURL) menuItems.push({ label: 'Copiar enlace', role: 'copyLink' });
      if (params.mediaType === 'image') menuItems.push({ label: 'Copiar imagen', role: 'copyImage' });
      menuItems.push({ label: 'Copiar', role: 'copy' });
    }

    if (menuItems.length > 0) {
      Menu.buildFromTemplate(menuItems).popup({ window: mainWindow });
    }
  });

  mainWindow.on('close', async (e) => {
    e.preventDefault();
    try {
      const result = await dialog.showMessageBox(mainWindow, {
        type: 'question',
        buttons: ['Salir', 'Cancelar'],
        defaultId: 1,
        cancelId: 1,
        title: 'Cerrar Next Byte',
        message: '¿Estás seguro de que deseas salir?',
        detail: 'Se cerrará tu sesión actual.',
      });
      if (result.response === 0) {
        try { endCurrentSession(); } catch (err) { console.error('endCurrentSession error:', err); }
        mainWindow.removeAllListeners('close');
        try { mainWindow.close(); } catch (err) { /* ignore */ }
      }
    } catch (err) {
      console.error('Close dialog error:', err);
      mainWindow.destroy();
    }
  });
}

app.whenReady().then(async () => {
  await initDatabase();
  // Clean up stale sessions from previous app runs (crash, force-close, etc.)
  run(`UPDATE sesiones_caja SET activa = 0, fin = datetime('now','localtime') WHERE activa = 1`);
  registerIpcHandlers();

  // Auto-update from GitHub Releases (only in packaged/installed app)
  if (app.isPackaged) {
    autoUpdater.logger = console;
    autoUpdater.autoDownload = true;
    // Auto-install and relaunch as soon as the update finishes downloading
    autoUpdater.on('update-downloaded', () => autoUpdater.quitAndInstall(false, true));
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  }

  // Enable spellchecker with Spanish
  try {
    session.defaultSession.setSpellCheckerEnabled(true);
    session.defaultSession.setSpellCheckerLanguages(['es', 'en-US']);
  } catch (e) {
    console.error('Spellchecker init error:', e);
  }

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
