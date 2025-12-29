// Secure empty preload (required for contextIsolation)
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // You can add safe IPC here later
});