const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const Z = 8;
const X_MIN = 144;
const X_MAX = 151;
const Y_MIN = 79;
const Y_MAX = 86;

const STEP = 2;
const WIDTH = ((X_MAX - X_MIN + 1) * 256) / STEP;
const HEIGHT = ((Y_MAX - Y_MIN + 1) * 256) / STEP;

async function downloadTile(z, x, y) {
  const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'ToposMapApp/1.0' } });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

function parsePNG(buffer) {
  return new Promise((resolve, reject) => {
    new PNG().parse(buffer, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

async function main() {
  const elevations = new Float32Array(WIDTH * HEIGHT);
  elevations.fill(150.0);

  const totalTiles = (X_MAX - X_MIN + 1) * (Y_MAX - Y_MIN + 1);
  let loaded = 0;

  for (let y = Y_MIN; y <= Y_MAX; y++) {
    for (let x = X_MIN; x <= X_MAX; x++) {
      try {
        const buf = await downloadTile(Z, x, y);
        const png = await parsePNG(buf);

        const offsetX = ((x - X_MIN) * 256) / STEP;
        const offsetY = ((y - Y_MIN) * 256) / STEP;

        for (let py = 0; py < 256; py += STEP) {
          for (let px = 0; px < 256; px += STEP) {
            const idx = (py * 256 + px) * 4;
            const r = png.data[idx];
            const g = png.data[idx + 1];
            const b = png.data[idx + 2];

            const ele = (r * 256 + g + b / 256) - 32768;
            elevations[(offsetY + py / STEP) * WIDTH + (offsetX + px / STEP)] = ele;
          }
        }
        loaded++;
        process.stdout.write(`\rTile downloaded: ${loaded}/${totalTiles}`);
      } catch (e) {
        console.warn(`\nFailed tile ${Z}/${x}/${y}: ${e.message}`);
      }
    }
  }

  const outBuf = Buffer.from(elevations.buffer);
  
  const destDir1 = path.join(__dirname, '../src-tauri/assets');
  if (!fs.existsSync(destDir1)) fs.mkdirSync(destDir1, { recursive: true });
  fs.writeFileSync(path.join(destDir1, 'belarus_dem.bin'), outBuf);

  const destDir2 = path.join(__dirname, '../public/assets');
  if (!fs.existsSync(destDir2)) fs.mkdirSync(destDir2, { recursive: true });
  fs.writeFileSync(path.join(destDir2, 'belarus_dem.bin'), outBuf);

  const destDir3 = path.join(__dirname, '../dist/assets');
  if (fs.existsSync(destDir3)) {
    fs.writeFileSync(path.join(destDir3, 'belarus_dem.bin'), outBuf);
  }

  console.log(`\nDEM binary matrix created: ${outBuf.length} bytes (${WIDTH}x${HEIGHT})`);
}

main().catch(err => {
  console.error('Error generating DEM binary:', err);
  process.exit(1);
});
