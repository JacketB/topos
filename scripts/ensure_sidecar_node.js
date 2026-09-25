const fs = require('fs');
const path = require('path');

if (process.platform === 'win32') {
  const destDir = path.resolve(__dirname, '..', 'src-tauri', 'sidecar-renderer', 'bin');
  const destPath = path.join(destDir, 'node.exe');

  if (!fs.existsSync(destPath)) {
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(process.execPath, destPath);
    console.log(`Copied ${process.execPath} to ${destPath}`);
  }
}
