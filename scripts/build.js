const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

// Define what to copy
const DIRS_TO_COPY = ['app', 'assets']; // Assuming assets like icons exist in app or assets
const FILES_TO_COPY = ['index.html', 'manifest.json', 'sw.js', 'favicon.ico'];

// Utility to copy a folder recursively
function copyDir(src, dest) {
    if (!fs.existsSync(src)) return;
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (let entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

console.log('Building web app to dist/ ...');

// Clean dist
if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DIST_DIR, { recursive: true });

// Copy files
for (const file of FILES_TO_COPY) {
    const srcPath = path.join(ROOT_DIR, file);
    const destPath = path.join(DIST_DIR, file);
    if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
    }
}

// Copy directories
for (const dir of DIRS_TO_COPY) {
    const srcPath = path.join(ROOT_DIR, dir);
    const destPath = path.join(DIST_DIR, dir);
    copyDir(srcPath, destPath);
}

console.log('Build complete!');
