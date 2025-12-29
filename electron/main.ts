import { app, BrowserWindow } from 'electron';
import path from 'path';
import { autoUpdater } from 'electron-updater';

// Optional: Completely remove the menu bar (File, Edit, View, etc.)
app.whenReady().then(() => {
  const { Menu } = require('electron');
  Menu.setApplicationMenu(null);
});

// Auto-updater configuration
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

// Logging for debugging updates
autoUpdater.on('checking-for-update', () => {
  console.log('Checking for update...');
});

autoUpdater.on('update-available', (info: any) => {
  console.log(`Update available: v${info.version}`);
});

autoUpdater.on('update-not-available', () => {
  console.log('No update available — you are up to date!');
});

autoUpdater.on('download-progress', (progress: any) => {
  console.log(`Download progress: ${Math.round(progress.percent)}%`);
});

autoUpdater.on('update-downloaded', () => {
  console.log('Update downloaded — will install when app quits');
});

autoUpdater.on('error', (error: Error) => {
  console.error('Auto-update error:', error.message || error);
});

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    icon: path.join(__dirname, '../icon.png'), // Your moon icon
    autoHideMenuBar: true, // Hides menu bar on Windows/Linux
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../client/index.html'));

  // Check for updates 5 seconds after launch
  setTimeout(() => {
    autoUpdater.checkForUpdates();
  }, 5000);
}

app.whenReady().then(() => {
  createWindow();

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