// copy-html.js
const fs = require('fs');
const path = require('path');

const sourceHtml = path.join(__dirname, 'client', 'index.html');
const destDir = path.join(__dirname, 'dist', 'client');
const destHtml = path.join(destDir, 'index.html');

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(sourceHtml, destHtml);

// Copy renderer.js to the same folder as index.html
const sourceJs = path.join(__dirname, 'dist', 'client', 'renderer.js');
const destJs = path.join(destDir, 'renderer.js');
if (fs.existsSync(sourceJs)) {
  fs.copyFileSync(sourceJs, destJs);
  console.log('Copied renderer.js to dist/client/renderer.js');
}

console.log('Copied index.html to dist/client/index.html');