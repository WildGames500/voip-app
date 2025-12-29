// copy-html.js
const fs = require('fs-extra');
const path = require('path');

const clientSource = path.join(__dirname, 'client');
const clientDest = path.join(__dirname, 'dist', 'client');

// Ensure dist/client exists
fs.ensureDirSync(clientDest);

// Copy all files from client/ to dist/client/ (safe)
if (clientSource !== clientDest) {
  fs.copySync(clientSource, clientDest, {
    overwrite: true,
    preserveTimestamps: true
  });
  console.log('✅ Successfully copied all files from client/ to dist/client/ (including icon.png)');
} else {
  console.log('ℹ️ Source and destination are the same — skipping main copy');
}

// Ensure compiled renderer.js is in the right place (safe copy)
const compiledRenderer = path.join(__dirname, 'dist', 'client', 'renderer.js');
const destRenderer = path.join(clientDest, 'renderer.js');

if (fs.existsSync(compiledRenderer)) {
  if (compiledRenderer !== destRenderer) {
    fs.copySync(compiledRenderer, destRenderer, { overwrite: true });
    console.log('✅ renderer.js copied to dist/client/renderer.js');
  } else {
    console.log('ℹ️ renderer.js is already in place');
  }
} else {
  console.warn('⚠️ renderer.js not found after tsc — check your tsconfig output');
}