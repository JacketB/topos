const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');
const { contours } = require('d3-contour');

// Берем зум 7 для всей Беларуси (16 тайлов) или зум 8 (64 тайла) с шагом выборки 2
const Z = 8;
const X_MIN = 144;
const X_MAX = 151;
const Y_MIN = 79;
const Y_MAX = 86;

// Уменьшаем разрешение сетки в 2 раза (шаг выборки 2 пикселя), чтобы получить гладкие горизонтали без микрошума
const STEP = 2;
const WIDTH = ((X_MAX - X_MIN + 1) * 256) / STEP;
const HEIGHT = ((Y_MAX - Y_MIN + 1) * 256) / STEP;
const GLOBAL_W = 256 * Math.pow(2, Z);

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

function pxToLngLatFast(px, py) {
  const globalX = X_MIN * 256 + px * STEP;
  const globalY = Y_MIN * 256 + py * STEP;
  
  const lng = (globalX / GLOBAL_W) * 360 - 180;
  
  const n = Math.PI - (2 * Math.PI * globalY) / GLOBAL_W;
  const latRad = Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  const lat = latRad * (180 / Math.PI);
  
  return [Math.round(lng * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5];
}

async function generateContours() {
  console.log(`📡 Загружаем DEM-матрицу высот (быстрая сетка ${WIDTH}x${HEIGHT} для Беларуси)...`);
  
  const elevations = new Float32Array(WIDTH * HEIGHT);
  elevations.fill(0);
  
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
        process.stdout.write(`\r📥 Скачано тайлов: ${loaded}/${totalTiles}`);
      } catch (e) {
        console.warn(`\n⚠️ Не удалось скачать тайл ${Z}/${x}/${y}: ${e.message}`);
      }
    }
  }
  console.log('\n🧠 Быстрое вычисление изолиний через d3-contour...');
  
  // Пороги высот для Беларуси (от 120 до 340 м с шагом в 15 метров) - идеально для топографии
  const thresholds = [];
  for (let h = 120; h <= 345; h += 15) {
    thresholds.push(h);
  }
  
  const contourGenerator = contours()
    .size([WIDTH, HEIGHT])
    .thresholds(thresholds);
    
  const contourPolys = contourGenerator(elevations);
  
  const features = [];
  let totalLines = 0;
  
  for (const item of contourPolys) {
    const ele = item.value;
    const multiLineCoords = [];
    
    for (const polygon of item.coordinates) {
      for (const ring of polygon) {
        // Фильтруем мелкие кольца (шум меньше 8 точек)
        if (ring.length < 8) continue;
        
        const lineCoords = ring.map(pt => pxToLngLatFast(pt[0], pt[1]));
        multiLineCoords.push(lineCoords);
        totalLines++;
      }
    }
    
    if (multiLineCoords.length > 0) {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'MultiLineString',
          coordinates: multiLineCoords
        },
        properties: {
          ele: ele
        }
      });
    }
  }
  
  const geojson = {
    type: 'FeatureCollection',
    features
  };
  
  const targetPath = path.join(__dirname, '../public/contours.geojson');
  console.log(`💾 Записываем файл ${targetPath}...`);
  fs.writeFileSync(targetPath, JSON.stringify(geojson), 'utf-8');
  
  const sizeMb = (fs.statSync(targetPath).size / 1024 / 1024).toFixed(2);
  console.log(`🎉 Файл изолиний успешно создан: ${targetPath}`);
  console.log(`🏔 Всего линий: ${totalLines}, уровней высот: ${features.length}, размер GeoJSON: ${sizeMb} MB`);
}

generateContours().catch(err => {
  console.error('❌ Ошибка генерации горизонталей:', err);
  process.exit(1);
});
