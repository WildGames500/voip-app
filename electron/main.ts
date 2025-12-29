import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { autoUpdater } from 'electron-updater';

// Declare mainWindow at the module level so it's accessible everywhere
let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    icon: path.join(__dirname, '../icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../client/index.html'));
}

// Send update status to renderer
function sendUpdateStatus(status: string, info?: any) {
  mainWindow?.webContents.send('update-status', { status, info });
}

// Auto-updater configuration
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

autoUpdater.on('checking-for-update', () => sendUpdateStatus('checking'));
autoUpdater.on('update-available', (info) => sendUpdateStatus('available', info));
autoUpdater.on('update-not-available', () => sendUpdateStatus('up-to-date'));
autoUpdater.on('download-progress', (progress) => {
  sendUpdateStatus('downloading', {
    percent: Math.round(progress.percent),
    speed: progress.bytesPerSecond,
    transferred: progress.transferred,
    total: progress.total,
  });
});
autoUpdater.on('update-downloaded', () => sendUpdateStatus('downloaded'));
autoUpdater.on('error', (err) => sendUpdateStatus('error', err.message));

// IPC handlers
ipcMain.on('start-update', () => autoUpdater.downloadUpdate());
ipcMain.on('restart-app', () => autoUpdater.quitAndInstall());

// App lifecycle
app.whenReady().then(() => {
  // Remove menu bar globally
  const { Menu } = require('electron');
  Menu.setApplicationMenu(null);

  createWindow();

  // Small delay to ensure window is ready before checking updates
  setTimeout(() => {
    autoUpdater.checkForUpdates();
  }, 5000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Optional: clean up reference when window closes (prevents memory leaks)
app.on('before-quit', () => {
  mainWindow = null;
});