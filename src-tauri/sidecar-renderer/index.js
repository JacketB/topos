const fs = require('fs');
const path = require('path');
const { PMTiles } = require('pmtiles');

class NodeFileSource {
  constructor(filepath) {
    this.filepath = filepath;
    this.fd = fs.openSync(filepath, 'r');
  }

  getKey() {
    return this.filepath;
  }

  getBytes(offset, length) {
    return new Promise((resolve, reject) => {
      const buffer = Buffer.alloc(length);
      fs.read(this.fd, buffer, 0, length, offset, (err, bytesRead, buf) => {
        if (err) {
          reject(err);
        } else {
          const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + bytesRead);
          resolve({ data: arrayBuffer });
        }
      });
    });
  }
}

const origStderrWrite = process.stderr.write;
process.stderr.write = function (chunk, encoding, fd) {
  const str = chunk ? chunk.toString() : '';
  if (str.includes('Removing OpenGL context failed')) {
    return true;
  }
  return origStderrWrite.apply(this, arguments);
};

const realRequest = require('request');

let globalConfig = {};
let belarusSource = null;
let topomapSource = null;

function initPMTiles(config) {
  globalConfig = config;
  try {
    if (config.belarusPmtilesPath && fs.existsSync(config.belarusPmtilesPath)) {
      belarusSource = new PMTiles(new NodeFileSource(config.belarusPmtilesPath));
    }
    if (config.topomapPmtilesPath && fs.existsSync(config.topomapPmtilesPath)) {
      topomapSource = new PMTiles(new NodeFileSource(config.topomapPmtilesPath));
    }
  } catch (err) {
    process.stderr.write(JSON.stringify({ success: false, error: 'Failed to init PMTiles: ' + err.stack || err.message }));
  }
}

const sharp = require('sharp');

const returnImageBuffer = (url, buffer, callback) => {
  if (!buffer || buffer.length === 0) {
    return callback(null, { statusCode: 204, request: { uri: { href: url } } }, Buffer.alloc(0));
  }
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
  const isJpg = buffer[0] === 0xFF && buffer[1] === 0xD8;
  if (!isPng && !isJpg) {
    sharp(buffer, { limitInputPixels: false, unlimited: true })
      .png()
      .toBuffer()
      .then(pngBuf => {
        callback(null, { statusCode: 200, request: { uri: { href: url } } }, pngBuf);
      })
      .catch(err => {
        callback(null, { statusCode: 200, request: { uri: { href: url } } }, buffer);
      });
  } else {
    callback(null, { statusCode: 200, request: { uri: { href: url } } }, buffer);
  }
};

const requestMock = function(options, callback) {
  if (!options) {
    return realRequest(options, callback);
  }

  let rawUrl = typeof options === 'string' ? options : (options.url || options.uri);
  let url = '';
  if (typeof rawUrl === 'string') {
    url = rawUrl;
  } else if (rawUrl && typeof rawUrl === 'object') {
    url = rawUrl.href || (typeof rawUrl.format === 'function' ? rawUrl.format() : String(rawUrl));
  } else if (rawUrl) {
    url = String(rawUrl);
  }

  if (!url || url === '[object Object]') {
    if (options && typeof options === 'object') {
      if (options.uri && options.uri.href) url = options.uri.href;
      else if (options.url && options.url.href) url = options.url.href;
    }
  }

  if (!url) {
    return realRequest(options, callback);
  }

  if (url.startsWith('data:')) {
    try {
      const commaIdx = url.indexOf(',');
      if (commaIdx !== -1) {
        const header = url.substring(0, commaIdx);
        const dataStr = url.substring(commaIdx + 1);
        const isBase64 = header.includes(';base64');
        const buffer = isBase64 
          ? Buffer.from(dataStr, 'base64') 
          : Buffer.from(decodeURIComponent(dataStr));
        return returnImageBuffer(url, buffer, callback);
      }
    } catch (err) {}
    return callback(null, { statusCode: 204, request: { uri: { href: url } } }, Buffer.alloc(0));
  }

  if (url.startsWith('file://')) {
    try {
      let filePath = url.replace(/^file:\/\/\//, '').replace(/^file:\/\//, '');
      filePath = decodeURIComponent(filePath);
      if (fs.existsSync(filePath) && !fs.lstatSync(filePath).isDirectory()) {
        const data = fs.readFileSync(filePath);
        return returnImageBuffer(url, data, callback);
      }
    } catch (err) {}
    return callback(null, { statusCode: 204, request: { uri: { href: url } } }, Buffer.alloc(0));
  }

  if ((/^[a-zA-Z]:[\\\/]/.test(url) || (url.startsWith('/') && !url.startsWith('//'))) && fs.existsSync(url)) {
    try {
      if (!fs.lstatSync(url).isDirectory()) {
        const data = fs.readFileSync(url);
        return returnImageBuffer(url, data, callback);
      }
    } catch (err) {}
  }

  if (url.includes('.pbf') && (url.includes('font') || url.includes('glyphs') || url.includes('openmaptiles'))) {
    const pbfMatch = url.match(/\/([^\/]+)\/([0-9]+-[0-9]+)\.pbf/);
    if (pbfMatch) {
      const fontRange = pbfMatch[2];
      const rawStack = decodeURIComponent(pbfMatch[1]);
      const stackList = rawStack.split(',').map(s => s.trim()).filter(Boolean);
      stackList.push('Noto Sans Regular', 'Open Sans Regular', 'Klokantech Noto Sans Regular');

      const dirsToSearch = [];
      if (globalConfig.resourceDir) {
        dirsToSearch.push(path.join(globalConfig.resourceDir, 'assets', 'fonts'));
        dirsToSearch.push(path.join(globalConfig.resourceDir, 'public', 'fonts'));
        dirsToSearch.push(path.join(globalConfig.resourceDir, 'fonts'));
      }
      if (globalConfig.baseDir) {
        dirsToSearch.push(path.join(globalConfig.baseDir, 'src-tauri', 'assets', 'fonts'));
        dirsToSearch.push(path.join(globalConfig.baseDir, 'public', 'fonts'));
        dirsToSearch.push(path.join(globalConfig.baseDir, 'fonts'));
      }
      dirsToSearch.push(path.resolve(__dirname, '..', 'assets', 'fonts'));
      dirsToSearch.push(path.resolve(__dirname, '..', '..', 'public', 'fonts'));

      const availableFonts = [
        'Open Sans Regular',
        'Noto Sans Regular',
        'Klokantech Noto Sans Regular',
        'Open Sans Bold'
      ];

      for (const fontName of [...stackList, ...availableFonts]) {
        for (const dir of dirsToSearch) {
          const fontPath = path.join(dir, fontName, `${fontRange}.pbf`);
          if (fs.existsSync(fontPath)) {
            try {
              const data = fs.readFileSync(fontPath);
              return callback(null, { statusCode: 200, request: { uri: { href: url } } }, data);
            } catch {}
          }
        }
      }

      for (const dir of dirsToSearch) {
        for (const fallbackName of availableFonts) {
          const fontPath = path.join(dir, fallbackName, `${fontRange}.pbf`);
          if (fs.existsSync(fontPath)) {
            try {
              const data = fs.readFileSync(fontPath);
              return callback(null, { statusCode: 200, request: { uri: { href: url } } }, data);
            } catch {}
          }
        }
      }

      return callback(null, { statusCode: 200, request: { uri: { href: url } } }, Buffer.alloc(0));
    }
  }

  const isAbsolute = url.includes('://') || /^[a-zA-Z]:\\/.test(url);
  if (!isAbsolute) {
    const cleanPath = url.replace(/^\/+/, '');
    const pathsToTry = [];

    if (globalConfig.resourceDir) {
      pathsToTry.push(path.join(globalConfig.resourceDir, cleanPath));
      pathsToTry.push(path.join(globalConfig.resourceDir, 'public', cleanPath));
      pathsToTry.push(path.join(globalConfig.resourceDir, 'src', cleanPath));
      pathsToTry.push(path.join(globalConfig.resourceDir, 'src', 'assets', cleanPath));
    }
    if (globalConfig.baseDir) {
      pathsToTry.push(path.join(globalConfig.baseDir, cleanPath));
      pathsToTry.push(path.join(globalConfig.baseDir, 'public', cleanPath));
      pathsToTry.push(path.join(globalConfig.baseDir, 'src', cleanPath));
      pathsToTry.push(path.join(globalConfig.baseDir, 'src', 'assets', cleanPath));
    }

    for (const p of pathsToTry) {
      if (fs.existsSync(p) && !fs.lstatSync(p).isDirectory()) {
        try {
          const data = fs.readFileSync(p);
          return returnImageBuffer(url, data, callback);
        } catch (err) {
          return callback(err);
        }
      }
    }

    return callback(null, { statusCode: 200, request: { uri: { href: url } } }, Buffer.alloc(0));
  }

  // 1. Перехватываем contours.geojson / military.geojson
  if (url.endsWith('contours.geojson') || url.endsWith('military.geojson')) {
    const fileName = url.endsWith('contours.geojson') ? 'contours.geojson' : 'military.geojson';
    // Ищем в папке public относительно корня проекта
    let publicPath = path.resolve(__dirname, '..', '..', 'public', fileName);
    if (!fs.existsSync(publicPath) && globalConfig.resourceDir) {
      publicPath = path.join(globalConfig.resourceDir, 'public', fileName);
    }
    if (!fs.existsSync(publicPath) && globalConfig.baseDir) {
      publicPath = path.join(globalConfig.baseDir, 'public', fileName);
    }
    if (fs.existsSync(publicPath)) {
      try {
        const data = fs.readFileSync(publicPath);
        return callback(null, { statusCode: 200, request: { uri: { href: url } } }, data);
      } catch (err) {
        return callback(err);
      }
    }
  }

  // 2. Перехватываем TileJSON для belarus.pmtiles
  if (url.includes('topos.localhost/belarus.pmtiles')) {
    if (!belarusSource) {
      return callback(new Error('belarus.pmtiles is not initialized'));
    }
    belarusSource.getHeader().then(header => {
      const tileJSON = {
        tilejson: '2.2.0',
        tiles: ["http://topos.localhost/belarus/{z}/{x}/{y}.pbf"],
        minzoom: header.minZoom,
        maxzoom: header.maxZoom,
        bounds: [header.minLon, header.minLat, header.maxLon, header.maxLat]
      };
      callback(null, { statusCode: 200, request: { uri: { href: url } } }, Buffer.from(JSON.stringify(tileJSON)));
    }).catch(callback);
    return;
  }

  // 3. Перехватываем TileJSON для belarus_topomap_200k.pmtiles
  if (url.includes('topos.localhost/belarus_topomap_200k.pmtiles')) {
    if (!topomapSource) {
      return callback(new Error('belarus_topomap_200k.pmtiles is not initialized'));
    }
    topomapSource.getHeader().then(header => {
      const tileJSON = {
        tilejson: '2.2.0',
        tiles: ["http://topos.localhost/belarus_topomap_200k/{z}/{x}/{y}.png"],
        minzoom: header.minZoom,
        maxzoom: header.maxZoom,
        bounds: [header.minLon, header.minLat, header.maxLon, header.maxLat]
      };
      callback(null, { statusCode: 200, request: { uri: { href: url } } }, Buffer.from(JSON.stringify(tileJSON)));
    }).catch(callback);
    return;
  }

  // 4. Перехватываем векторные тайлы belarus
  if (url.includes('topos.localhost/belarus/')) {
    const parts = url.split('topos.localhost/belarus/')[1].split('/');
    const z = parseInt(parts[0]);
    const x = parseInt(parts[1]);
    const y = parseInt(parts[2]); // это y.pbf, нужно отрезать расширение
    
    if (belarusSource) {
      belarusSource.getZxy(z, x, y).then(tile => {
        if (tile) {
          callback(null, { statusCode: 200, request: { uri: { href: url } } }, Buffer.from(tile.data));
        } else {
          callback(null, { statusCode: 204, request: { uri: { href: url } } }, Buffer.alloc(0));
        }
      }).catch(err => {
        callback(null, { statusCode: 204, request: { uri: { href: url } } }, Buffer.alloc(0));
      });
    } else {
      callback(null, { statusCode: 404, request: { uri: { href: url } } });
    }
    return;
  }

  // 5. Перехватываем растровые тайлы topomap
  if (url.includes('topos.localhost/belarus_topomap_200k/')) {
    const parts = url.split('topos.localhost/belarus_topomap_200k/')[1].split('/');
    const z = parseInt(parts[0]);
    const x = parseInt(parts[1]);
    const y = parseInt(parts[2]);
    
    if (topomapSource) {
      topomapSource.getZxy(z, x, y).then(tile => {
        if (tile) {
          callback(null, { statusCode: 200, request: { uri: { href: url } } }, Buffer.from(tile.data));
        } else {
          callback(null, { statusCode: 204, request: { uri: { href: url } } }, Buffer.alloc(0));
        }
      }).catch(err => {
        callback(null, { statusCode: 204, request: { uri: { href: url } } }, Buffer.alloc(0));
      });
    } else {
      callback(null, { statusCode: 404, request: { uri: { href: url } } });
    }
    return;
  }

  // Все остальные запросы отправляем реально с заголовками браузера Chrome и безопасной обработкой сокетов
  const reqOpts = typeof options === 'string' ? { url: options } : { ...options };
  reqOpts.headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'Referer': 'https://www.google.com/',
    ...(reqOpts.headers || {})
  };
  reqOpts.timeout = reqOpts.timeout || 10000;
  reqOpts.pool = reqOpts.pool || { maxSockets: 32 };

  const attemptRequest = (retriesLeft) => {
    realRequest(reqOpts, (err, res, body) => {
      if (err) {
        if (retriesLeft > 0) {
          setTimeout(() => attemptRequest(retriesLeft - 1), 200);
          return;
        }
        // Защита от socket hang up: при сетевых сбоях возвращаем 204 пустой буфер без падения процесса
        return callback(null, { statusCode: 204, request: { uri: { href: url } } }, Buffer.alloc(0));
      }
      callback(null, res, body);
    });
  };

  return attemptRequest(2);
};

require.cache[require.resolve('request')].exports = requestMock;

const mbglRenderer = require('mbgl-renderer');
const render = mbglRenderer.default || mbglRenderer;

function projectMercator(lng, lat, zoom) {
  const worldPixels = 512 * Math.pow(2, zoom);
  const x = ((lng + 180) / 360) * worldPixels;
  const latRad = (lat * Math.PI) / 180;
  const sinLat = Math.sin(latRad);
  const y = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * worldPixels;
  return { x, y, worldPixels };
}

function unprojectMercator(x, y, zoom) {
  const worldPixels = 512 * Math.pow(2, zoom);
  const lng = (x / worldPixels) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / worldPixels;
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return [lng, lat];
}

async function renderTiled(cleanedStyle, options) {
  const ratio = options.ratio || 1;
  const totalPxWidth = Math.floor(options.width * ratio);
  const totalPxHeight = Math.floor(options.height * ratio);
  const MAX_CHUNK_PX = 3072;
  const bearing = options.bearing || 0;
  const bearingRad = (-bearing * Math.PI) / 180;
  const cosBearing = Math.cos(bearingRad);
  const sinBearing = Math.sin(bearingRad);

  const centerLng = options.center ? options.center[0] : 0;
  const centerLat = options.center ? options.center[1] : 0;
  const zoom = options.zoom || 0;
  const centerMerc = projectMercator(centerLng, centerLat, zoom);

  let baseMapBuffer;

  if (totalPxWidth <= MAX_CHUNK_PX && totalPxHeight <= MAX_CHUNK_PX) {
    baseMapBuffer = await render(cleanedStyle, options.width, options.height, options);
  } else {
    const cols = Math.ceil(totalPxWidth / MAX_CHUNK_PX);
    const rows = Math.ceil(totalPxHeight / MAX_CHUNK_PX);
    const rowBuffers = [];
    const totalTiles = rows * cols;
    let completedTiles = 0;

    for (let r = 0; r < rows; r++) {
      const tileTop = r * MAX_CHUNK_PX;
      const chunkPxH = Math.min(MAX_CHUNK_PX, totalPxHeight - tileTop);
      const rowInputs = [];

      for (let c = 0; c < cols; c++) {
        const tileLeft = c * MAX_CHUNK_PX;
        const chunkPxW = Math.min(MAX_CHUNK_PX, totalPxWidth - tileLeft);

        const tileCenterX = tileLeft + chunkPxW / 2;
        const tileCenterY = tileTop + chunkPxH / 2;

        const unrotatedOffsetX = (tileCenterX - totalPxWidth / 2) / ratio;
        const unrotatedOffsetY = (tileCenterY - totalPxHeight / 2) / ratio;

        const rotOffsetX = unrotatedOffsetX * Math.cos(-bearingRad) - unrotatedOffsetY * Math.sin(-bearingRad);
        const rotOffsetY = unrotatedOffsetX * Math.sin(-bearingRad) + unrotatedOffsetY * Math.cos(-bearingRad);

        const chunkMercX = centerMerc.x + rotOffsetX;
        const chunkMercY = centerMerc.y + rotOffsetY;

        const chunkCenter = unprojectMercator(chunkMercX, chunkMercY, zoom);

        const chunkLogicalW = Math.max(1, Math.round(chunkPxW / ratio));
        const chunkLogicalH = Math.max(1, Math.round(chunkPxH / ratio));

        const chunkOptions = {
          ...options,
          width: chunkLogicalW,
          height: chunkLogicalH,
          center: chunkCenter
        };

        const tileBuffer = await render(cleanedStyle, chunkLogicalW, chunkLogicalH, chunkOptions);
        rowInputs.push({
          input: tileBuffer,
          left: tileLeft,
          top: 0,
          limitInputPixels: false,
          unlimited: true
        });

        completedTiles++;
        const percent = Math.min(85, Math.round((completedTiles / totalTiles) * 85));
        process.stdout.write(JSON.stringify({ type: 'progress', percent }) + '\n');
      }

      const rowBuffer = await sharp({
        create: {
          width: totalPxWidth,
          height: chunkPxH,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        },
        limitInputPixels: false,
        unlimited: true
      })
      .composite(rowInputs)
      .png()
      .toBuffer();

      rowBuffers.push({
        input: rowBuffer,
        left: 0,
        top: tileTop,
        limitInputPixels: false,
        unlimited: true
      });
    }

    baseMapBuffer = await sharp({
      create: {
        width: totalPxWidth,
        height: totalPxHeight,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      },
      limitInputPixels: false,
      unlimited: true
    })
    .composite(rowBuffers)
    .png()
    .toBuffer();
  }

  process.stdout.write(JSON.stringify({ type: 'progress', percent: 90 }) + '\n');

  let labelsSvgBuffer = null;
  try {
    const getFeatures = (sourceName) => {
      const src = cleanedStyle.sources?.[sourceName];
      if (!src) return [];
      if (Array.isArray(src.data?.features)) return src.data.features;
      if (typeof src.data === 'string') {
        try {
          const parsed = JSON.parse(src.data);
          if (Array.isArray(parsed.features)) return parsed.features;
        } catch {}
      }
      return [];
    };

    const pointFeats = getFeatures('tactical-symbols')
      .filter(f => f && f.geometry?.type === 'Point' && f.properties && (f.properties.name || f.properties.label || f.properties.title));
    
    const marchPlacesFeats = getFeatures('march-places')
      .filter(f => f && f.geometry?.type === 'Point' && f.properties?.name);

    const marchKmFeats = getFeatures('march-kilometers')
      .filter(f => f && f.geometry?.type === 'Point' && f.properties?.label);

    let svgElements = '';

    for (const f of pointFeats) {
      if (!f.geometry || !Array.isArray(f.geometry.coordinates) || f.geometry.coordinates.length < 2) continue;
      const coords = f.geometry.coordinates;
      if (typeof coords[0] !== 'number' || typeof coords[1] !== 'number' || isNaN(coords[0]) || isNaN(coords[1])) continue;
      const textVal = String(f.properties.name || f.properties.label || f.properties.title || '').trim();
      if (!textVal) continue;
      const pointMerc = projectMercator(coords[0], coords[1], zoom);
      const unrotX = (pointMerc.x - centerMerc.x) * ratio;
      const unrotY = (pointMerc.y - centerMerc.y) * ratio;

      const rotX = unrotX * cosBearing - unrotY * sinBearing;
      const rotY = unrotX * sinBearing + unrotY * cosBearing;

      const pxX = totalPxWidth / 2 + rotX;
      const pxY = totalPxHeight / 2 + rotY + Math.round(24 * ratio);

      if (!isFinite(pxX) || !isFinite(pxY)) continue;

      const escaped = textVal.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      svgElements += `<text x="${pxX.toFixed(1)}" y="${pxY.toFixed(1)}" class="map-label">${escaped}</text>\n`;
    }

    const placedPlaceLabels = [];
    const minPlaceLabelDist = Math.max(30, Math.round(25 * ratio));

    for (const f of marchPlacesFeats) {
      if (!f.geometry || !Array.isArray(f.geometry.coordinates) || f.geometry.coordinates.length < 2) continue;
      const coords = f.geometry.coordinates;
      if (typeof coords[0] !== 'number' || typeof coords[1] !== 'number' || isNaN(coords[0]) || isNaN(coords[1])) continue;
      const textVal = String(f.properties.name || '').trim();
      if (!textVal) continue;

      const pointMerc = projectMercator(coords[0], coords[1], zoom);
      const unrotX = (pointMerc.x - centerMerc.x) * ratio;
      const unrotY = (pointMerc.y - centerMerc.y) * ratio;

      const rotX = unrotX * cosBearing - unrotY * sinBearing;
      const rotY = unrotX * sinBearing + unrotY * cosBearing;

      const pxX = totalPxWidth / 2 + rotX;
      const pxY = totalPxHeight / 2 + rotY;

      if (!isFinite(pxX) || !isFinite(pxY)) continue;

      const isColliding = placedPlaceLabels.some(prev => Math.hypot(pxX - prev.x, pxY - prev.y) < minPlaceLabelDist);
      if (isColliding) continue;

      placedPlaceLabels.push({ x: pxX, y: pxY });

      const props = f.properties || {};
      const svgAnchor = props.svgAnchor || 'middle';
      const svgBaseline = props.svgBaseline || 'central';
      const offX = Array.isArray(props.svgOffset) ? props.svgOffset[0] * ratio : 0;
      const offY = Array.isArray(props.svgOffset) ? props.svgOffset[1] * ratio : 0;

      const finalX = pxX + offX;
      const finalY = pxY + offY;

      const escaped = textVal.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      svgElements += `<text x="${finalX.toFixed(1)}" y="${finalY.toFixed(1)}" class="march-place-label" text-anchor="${svgAnchor}" dominant-baseline="${svgBaseline}">${escaped}</text>\n`;
    }

    const kmDotR = Math.max(3.5, Math.round(4.0 * ratio));
    const kmStrokeW = Math.max(1.5, Math.round(2.0 * ratio));
    const kmOffset = Math.round(8 * ratio);

    for (const f of marchKmFeats) {
      if (!f.geometry || !Array.isArray(f.geometry.coordinates) || f.geometry.coordinates.length < 2) continue;
      const coords = f.geometry.coordinates;
      if (typeof coords[0] !== 'number' || typeof coords[1] !== 'number' || isNaN(coords[0]) || isNaN(coords[1])) continue;
      const textVal = String(f.properties.label || '').trim();
      const pointMerc = projectMercator(coords[0], coords[1], zoom);
      const unrotX = (pointMerc.x - centerMerc.x) * ratio;
      const unrotY = (pointMerc.y - centerMerc.y) * ratio;

      const rotX = unrotX * cosBearing - unrotY * sinBearing;
      const rotY = unrotX * sinBearing + unrotY * cosBearing;

      const pxX = totalPxWidth / 2 + rotX;
      const pxY = totalPxHeight / 2 + rotY;

      if (!isFinite(pxX) || !isFinite(pxY)) continue;

      svgElements += `<circle cx="${pxX.toFixed(1)}" cy="${pxY.toFixed(1)}" r="${kmDotR}" fill="#ffffff" stroke="#1d4ed8" stroke-width="${kmStrokeW}" />\n`;
      if (textVal) {
        const escaped = textVal.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        svgElements += `<text x="${(pxX + kmOffset).toFixed(1)}" y="${pxY.toFixed(1)}" class="march-km-label">${escaped}</text>\n`;
      }
    }

    if (svgElements.trim().length > 0) {
      const fontSizePx = Math.max(12, Math.round(14 * ratio));
      const strokeWidthPx = Math.max(2, Math.round(3 * ratio));
      const placeFontPx = Math.max(12, Math.round(13.5 * ratio));
      const placeHaloPx = Math.max(2.0, Math.round(2.5 * ratio));
      const kmFontPx = Math.max(9, Math.round(10 * ratio));
      const kmHaloPx = Math.max(1.8, Math.round(2.0 * ratio));

      const svgContent = `<svg width="${totalPxWidth}" height="${totalPxHeight}" xmlns="http://www.w3.org/2000/svg">
        <style>
          .map-label {
            font-family: "Segoe UI", Arial, sans-serif;
            font-weight: 700;
            font-size: ${fontSizePx}px;
            fill: #0f172a;
            paint-order: stroke fill;
            stroke: #ffffff;
            stroke-width: ${strokeWidthPx}px;
            stroke-linejoin: round;
            stroke-linecap: round;
            text-anchor: middle;
            dominant-baseline: hanging;
          }
          .march-place-label {
            font-family: "Segoe UI", Arial, sans-serif;
            font-weight: 700;
            font-size: ${placeFontPx}px;
            fill: #1e3a8a;
            paint-order: stroke fill;
            stroke: #ffffff;
            stroke-width: ${placeHaloPx}px;
            stroke-linejoin: round;
            stroke-linecap: round;
            text-anchor: middle;
            dominant-baseline: central;
          }
          .march-km-label {
            font-family: "Segoe UI", Arial, sans-serif;
            font-weight: 800;
            font-size: ${kmFontPx}px;
            fill: #1d4ed8;
            paint-order: stroke fill;
            stroke: #ffffff;
            stroke-width: ${kmHaloPx}px;
            stroke-linejoin: round;
            stroke-linecap: round;
            text-anchor: start;
            dominant-baseline: central;
          }
        </style>
        ${svgElements}
      </svg>`;
      labelsSvgBuffer = Buffer.from(svgContent);
    }
  } catch (e) {}

  if (labelsSvgBuffer) {
    try {
      const finalImageBuffer = await sharp(baseMapBuffer, {
        limitInputPixels: false,
        unlimited: true
      })
      .composite([{
        input: labelsSvgBuffer,
        left: 0,
        top: 0,
        limitInputPixels: false,
        unlimited: true
      }])
      .png()
      .toBuffer();

      return finalImageBuffer;
    } catch (e) {
      return baseMapBuffer;
    }
  }

  return baseMapBuffer;
}

let inputData = '';

process.stdin.on('data', chunk => {
  inputData += chunk;
});

process.stdin.on('end', () => {
  try {
    const config = JSON.parse(inputData);
    initPMTiles(config);

    let cleanedStyle = null;
    if (config.style) {
      let styleStr = JSON.stringify(config.style);
      styleStr = styleStr.replace(/pmtiles:\/\/http:\/\//g, 'http://');
      cleanedStyle = JSON.parse(styleStr);
    }
    
    const rawBearing = typeof config.bearing === 'number' ? config.bearing : 0;
    const normalizedBearing = ((rawBearing % 360) + 360) % 360;
    const rawPitch = typeof config.pitch === 'number' ? config.pitch : 0;
    const clampedPitch = Math.max(0, Math.min(60, rawPitch));

    const options = {
      zoom: config.zoom || 0,
      width: config.width || 800,
      height: config.height || 600,
      center: config.center || [0, 0],
      bearing: normalizedBearing,
      pitch: clampedPitch,
      style: cleanedStyle,
      ratio: config.ratio || 1,
      images: config.images
    };

    renderTiled(cleanedStyle, options)
      .then((buffer) => {
        if (config.outputPath) {
          fs.writeFileSync(config.outputPath, buffer);
          process.stdout.write(JSON.stringify({ success: true, path: config.outputPath }));
        } else {
          process.stdout.write(JSON.stringify({ success: true, data: buffer.toString('base64') }));
        }
      })
      .catch((err) => {
        process.stderr.write(JSON.stringify({ success: false, error: err.stack || err.message }));
        process.exit(1);
      });

  } catch (e) {
    process.stderr.write(JSON.stringify({ success: false, error: 'Invalid JSON input: ' + e.message }));
    process.exit(1);
  }
});
