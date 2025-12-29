// copy-html.js
const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, 'client', 'index.html');
const destDir = path.join(__dirname, 'dist', 'client');
const dest = path.join(destDir, 'index.html');

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(source, dest);

console.log('Copied index.html to dist/client/');