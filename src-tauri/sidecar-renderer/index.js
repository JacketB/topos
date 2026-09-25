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
        return callback(null, { statusCode: 204, request: { uri: { href: url } } }, Buffer.alloc(0));
      }
      if (res && res.statusCode === 200 && url.includes('virtualearth.net')) {
        const hasMeta = res.headers && (res.headers['x-ve-tilemeta-product-ids'] || res.headers['x-ve-tilemeta-capturedatesrange']);
        const isPlaceholder = !hasMeta || (body && body.length === 1033) || (Buffer.isBuffer(body) && body.length < 1200);
        if (isPlaceholder) {
          return callback(null, { statusCode: 204, request: { uri: { href: url } } }, Buffer.alloc(0));
        }
      }
      if (res && res.statusCode >= 400) {
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
  const dpiRatio = options.dpiRatio || (options.dpi ? Math.max(1.0, options.dpi / 96) : (options.ratio > 1 ? options.ratio : (options.width > 2000 ? options.width / 1000 : 1)));
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

    const placedBoxes = [];
    const iconR = Math.round(21 * dpiRatio);
    const labelMargin = Math.round(3 * dpiRatio);

    const wrapLabelText = (text, maxChars = 11) => {
      if (!text || text.length <= maxChars || !text.includes(' ')) return [text];
      const words = text.split(/\s+/);
      if (words.length <= 1) return [text];
      const lines = [];
      let currentLine = '';
      for (const word of words) {
        if (!currentLine) {
          currentLine = word;
        } else if ((currentLine + ' ' + word).length <= maxChars) {
          currentLine += ' ' + word;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) lines.push(currentLine);
      return lines;
    };

    for (let fIdx = 0; fIdx < pointFeats.length; fIdx++) {
      const f = pointFeats[fIdx];
      const isTb = f.properties && (f.properties.isText === true || f.properties.symbol === 'text_box');
      if (isTb) continue;
      if (!f.geometry || !Array.isArray(f.geometry.coordinates) || f.geometry.coordinates.length < 2) continue;
      const coords = f.geometry.coordinates;
      if (typeof coords[0] !== 'number' || typeof coords[1] !== 'number' || isNaN(coords[0]) || isNaN(coords[1])) continue;
      const ptMerc = projectMercator(coords[0], coords[1], zoom);
      const uX = (ptMerc.x - centerMerc.x) * ratio;
      const uY = (ptMerc.y - centerMerc.y) * ratio;
      const rX = uX * cosBearing - uY * sinBearing;
      const rY = uX * sinBearing + uY * cosBearing;
      const icX = totalPxWidth / 2 + rX;
      const icY = totalPxHeight / 2 + rY;
      placedBoxes.push({
        type: 'icon',
        iconIdx: fIdx,
        left: icX - iconR,
        right: icX + iconR,
        top: icY - iconR,
        bottom: icY + iconR
      });
    }

    for (let fIdx = 0; fIdx < pointFeats.length; fIdx++) {
      const f = pointFeats[fIdx];
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

      const isTextBox = f.properties.isText === true || f.properties.symbol === 'text_box';
      const pxX = totalPxWidth / 2 + rotX;
      const pxY_center = totalPxHeight / 2 + rotY;

      if (!isFinite(pxX) || !isFinite(pxY_center)) continue;

      if (isTextBox) {
        const rawSize = parseFloat(f.properties.textSize || f.properties.size || 14);
        const textBoxFontSize = Math.max(10, Math.round((isNaN(rawSize) ? 14 : rawSize) * dpiRatio));
        const textColor = f.properties.textColor || f.properties.color || '#1e293b';
        const haloColor = f.properties.textHaloColor || '#ffffff';
        const rawHaloWidth = parseFloat(f.properties.textHaloWidth || 1.5);
        const haloWidth = Math.max(1, Math.round((isNaN(rawHaloWidth) ? 1.5 : rawHaloWidth) * dpiRatio));
        const rotAngle = parseFloat(f.properties.angle || 0);
        const transformAttr = (!isNaN(rotAngle) && rotAngle !== 0) ? ` transform="rotate(${rotAngle}, ${pxX.toFixed(1)}, ${pxY_center.toFixed(1)})"` : '';
        const rawFont = f.properties.fontFamily || 'Times New Roman';
        const fontFamily = `"${rawFont}", "Segoe UI", Arial, sans-serif`;
        const rawLines = textVal.split('\n');
        const lines = rawLines.map(l => l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));
        const maxLen = Math.max(...rawLines.map(l => l.length));
        const tbW = Math.round(maxLen * textBoxFontSize * 0.6);
        const tbH = Math.round(lines.length * textBoxFontSize * 1.2);
        placedBoxes.push({
          type: 'label',
          left: pxX - tbW / 2,
          right: pxX + tbW / 2,
          top: pxY_center - tbH / 2,
          bottom: pxY_center + tbH / 2
        });
        if (lines.length > 1) {
          let tspans = '';
          const lineCount = lines.length;
          lines.forEach((line, idx) => {
            const dy = idx === 0 ? `${(- (lineCount - 1) * 0.6).toFixed(2)}em` : '1.2em';
            tspans += `<tspan x="${pxX.toFixed(1)}" dy="${dy}">${line}</tspan>`;
          });
          svgElements += `<text x="${pxX.toFixed(1)}" y="${pxY_center.toFixed(1)}"${transformAttr} font-family='${fontFamily}' font-weight='700' font-size='${textBoxFontSize}px' fill='${textColor}' stroke='${haloColor}' stroke-width='${haloWidth}px' stroke-linejoin='round' stroke-linecap='round' paint-order='stroke fill' text-anchor='middle' dominant-baseline='central'>${tspans}</text>\n`;
        } else {
          svgElements += `<text x="${pxX.toFixed(1)}" y="${pxY_center.toFixed(1)}"${transformAttr} font-family='${fontFamily}' font-weight='700' font-size='${textBoxFontSize}px' fill='${textColor}' stroke='${haloColor}' stroke-width='${haloWidth}px' stroke-linejoin='round' stroke-linecap='round' paint-order='stroke fill' text-anchor='middle' dominant-baseline='central'>${lines[0]}</text>\n`;
        }
      } else {
        const rawSize = parseFloat(f.properties.textSize);
        const basePtSize = isNaN(rawSize) ? 8.5 : Math.min(rawSize, 8.5);
        const symbolLabelFontSize = Math.max(8, Math.round(basePtSize * dpiRatio));
        const symbolStrokeWidth = Math.max(1.5, Math.round(1.8 * dpiRatio));
        const rawLines = wrapLabelText(textVal, 11);
        const lines = rawLines.map(l => l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));
        const maxLineChars = Math.max(...rawLines.map(l => l.length));
        const pad = Math.round(2 * dpiRatio);

        const getCandidates = (fs) => {
          const cW = fs * 0.58;
          const lH = fs * 1.25;
          const bW = Math.round(maxLineChars * cW);
          const bH = Math.round(lines.length * lH);
          return [
            {
              x: pxX,
              y: pxY_center + iconR + labelMargin,
              anchor: 'middle',
              basePenalty: 0,
              rect: { left: pxX - bW / 2 - pad, right: pxX + bW / 2 + pad, top: pxY_center + iconR + labelMargin - pad, bottom: pxY_center + iconR + labelMargin + bH + pad }
            },
            {
              x: pxX,
              y: pxY_center - iconR - labelMargin - bH,
              anchor: 'middle',
              basePenalty: 10,
              rect: { left: pxX - bW / 2 - pad, right: pxX + bW / 2 + pad, top: pxY_center - iconR - labelMargin - bH - pad, bottom: pxY_center - iconR - labelMargin + pad }
            },
            {
              x: pxX + iconR + labelMargin,
              y: pxY_center - bH / 2,
              anchor: 'start',
              basePenalty: 15,
              rect: { left: pxX + iconR + labelMargin - pad, right: pxX + iconR + labelMargin + bW + pad, top: pxY_center - bH / 2 - pad, bottom: pxY_center + bH / 2 + pad }
            },
            {
              x: pxX - iconR - labelMargin,
              y: pxY_center - bH / 2,
              anchor: 'end',
              basePenalty: 20,
              rect: { left: pxX - iconR - labelMargin - bW - pad, right: pxX - iconR - labelMargin + pad, top: pxY_center - bH / 2 - pad, bottom: pxY_center + bH / 2 + pad }
            },
            {
              x: pxX + Math.round(iconR * 0.85) + labelMargin,
              y: pxY_center - Math.round(iconR * 0.85) - labelMargin - bH,
              anchor: 'start',
              basePenalty: 25,
              rect: { left: pxX + Math.round(iconR * 0.85) + labelMargin - pad, right: pxX + Math.round(iconR * 0.85) + labelMargin + bW + pad, top: pxY_center - Math.round(iconR * 0.85) - labelMargin - bH - pad, bottom: pxY_center - Math.round(iconR * 0.85) - labelMargin + pad }
            },
            {
              x: pxX + Math.round(iconR * 0.85) + labelMargin,
              y: pxY_center + Math.round(iconR * 0.85) + labelMargin,
              anchor: 'start',
              basePenalty: 28,
              rect: { left: pxX + Math.round(iconR * 0.85) + labelMargin - pad, right: pxX + Math.round(iconR * 0.85) + labelMargin + bW + pad, top: pxY_center + Math.round(iconR * 0.85) + labelMargin - pad, bottom: pxY_center + Math.round(iconR * 0.85) + labelMargin + bH + pad }
            },
            {
              x: pxX - Math.round(iconR * 0.85) - labelMargin,
              y: pxY_center - Math.round(iconR * 0.85) - labelMargin - bH,
              anchor: 'end',
              basePenalty: 30,
              rect: { left: pxX - Math.round(iconR * 0.85) - labelMargin - bW - pad, right: pxX - Math.round(iconR * 0.85) - labelMargin + pad, top: pxY_center - Math.round(iconR * 0.85) - labelMargin - bH - pad, bottom: pxY_center - Math.round(iconR * 0.85) - labelMargin + pad }
            },
            {
              x: pxX - Math.round(iconR * 0.85) - labelMargin,
              y: pxY_center + Math.round(iconR * 0.85) + labelMargin,
              anchor: 'end',
              basePenalty: 32,
              rect: { left: pxX - Math.round(iconR * 0.85) - labelMargin - bW - pad, right: pxX - Math.round(iconR * 0.85) - labelMargin + pad, top: pxY_center - Math.round(iconR * 0.85) - labelMargin + pad, bottom: pxY_center + Math.round(iconR * 0.85) + labelMargin + bH + pad }
            },
            {
              x: pxX,
              y: pxY_center + Math.round(iconR * 1.8) + labelMargin,
              anchor: 'middle',
              basePenalty: 40,
              rect: { left: pxX - bW / 2 - pad, right: pxX + bW / 2 + pad, top: pxY_center + Math.round(iconR * 1.8) + labelMargin - pad, bottom: pxY_center + Math.round(iconR * 1.8) + labelMargin + bH + pad }
            },
            {
              x: pxX,
              y: pxY_center - Math.round(iconR * 1.8) - labelMargin - bH,
              anchor: 'middle',
              basePenalty: 45,
              rect: { left: pxX - bW / 2 - pad, right: pxX + bW / 2 + pad, top: pxY_center - Math.round(iconR * 1.8) - labelMargin - bH - pad, bottom: pxY_center - Math.round(iconR * 1.8) - labelMargin + pad }
            },
            {
              x: pxX + Math.round(iconR * 1.8) + labelMargin,
              y: pxY_center - bH / 2,
              anchor: 'start',
              basePenalty: 50,
              rect: { left: pxX + Math.round(iconR * 1.8) + labelMargin - pad, right: pxX + Math.round(iconR * 1.8) + labelMargin + bW + pad, top: pxY_center - bH / 2 - pad, bottom: pxY_center + bH / 2 + pad }
            },
            {
              x: pxX - Math.round(iconR * 1.8) - labelMargin,
              y: pxY_center - bH / 2,
              anchor: 'end',
              basePenalty: 55,
              rect: { left: pxX - Math.round(iconR * 1.8) - labelMargin - bW - pad, right: pxX - Math.round(iconR * 1.8) - labelMargin + pad, top: pxY_center - bH / 2 - pad, bottom: pxY_center + bH / 2 + pad }
            }
          ];
        };

        let chosenFontSize = symbolLabelFontSize;
        let chosenCandidates = getCandidates(symbolLabelFontSize);
        let bestCand = chosenCandidates[0];
        let minPenalty = Infinity;

        for (let i = 0; i < chosenCandidates.length; i++) {
          const cand = chosenCandidates[i];
          let penalty = cand.basePenalty;

          for (const placed of placedBoxes) {
            if (placed.type === 'icon' && placed.iconIdx === fIdx) continue;
            const dx = Math.max(0, Math.min(cand.rect.right, placed.right) - Math.max(cand.rect.left, placed.left));
            const dy = Math.max(0, Math.min(cand.rect.bottom, placed.bottom) - Math.max(cand.rect.top, placed.top));
            if (dx > 0 && dy > 0) {
              penalty += dx * dy * 100;
            }
          }

          if (penalty < minPenalty) {
            minPenalty = penalty;
            bestCand = cand;
            if (penalty === cand.basePenalty) break;
          }
        }

        if (minPenalty > 100) {
          const reducedFontSize = Math.max(7, Math.round(symbolLabelFontSize * 0.8));
          if (reducedFontSize < symbolLabelFontSize) {
            const reducedCandidates = getCandidates(reducedFontSize);
            for (let i = 0; i < reducedCandidates.length; i++) {
              const cand = reducedCandidates[i];
              let penalty = cand.basePenalty;

              for (const placed of placedBoxes) {
                if (placed.type === 'icon' && placed.iconIdx === fIdx) continue;
                const dx = Math.max(0, Math.min(cand.rect.right, placed.right) - Math.max(cand.rect.left, placed.left));
                const dy = Math.max(0, Math.min(cand.rect.bottom, placed.bottom) - Math.max(cand.rect.top, placed.top));
                if (dx > 0 && dy > 0) {
                  penalty += dx * dy * 100;
                }
              }

              if (penalty < minPenalty) {
                minPenalty = penalty;
                bestCand = cand;
                chosenFontSize = reducedFontSize;
                if (penalty === cand.basePenalty) break;
              }
            }
          }
        }

        placedBoxes.push({
          type: 'label',
          left: bestCand.rect.left,
          right: bestCand.rect.right,
          top: bestCand.rect.top,
          bottom: bestCand.rect.bottom
        });

        if (lines.length > 1) {
          let tspans = '';
          lines.forEach((l, idx) => {
            const dy = idx === 0 ? '0' : '1.15em';
            tspans += `<tspan x="${bestCand.x.toFixed(1)}" dy="${dy}">${l}</tspan>`;
          });
          svgElements += `<text x="${bestCand.x.toFixed(1)}" y="${bestCand.y.toFixed(1)}" text-anchor="${bestCand.anchor}" dominant-baseline="hanging" class="map-label" font-size="${chosenFontSize}px" stroke-width="${symbolStrokeWidth}px" style="font-size: ${chosenFontSize}px; stroke-width: ${symbolStrokeWidth}px; text-anchor: ${bestCand.anchor};">${tspans}</text>\n`;
        } else {
          svgElements += `<text x="${bestCand.x.toFixed(1)}" y="${bestCand.y.toFixed(1)}" text-anchor="${bestCand.anchor}" dominant-baseline="hanging" class="map-label" font-size="${chosenFontSize}px" stroke-width="${symbolStrokeWidth}px" style="font-size: ${chosenFontSize}px; stroke-width: ${symbolStrokeWidth}px; text-anchor: ${bestCand.anchor};">${lines[0]}</text>\n`;
        }
      }
    }

    const placedPlaceLabels = [];
    const minPlaceLabelDist = Math.max(30, Math.round(25 * dpiRatio));

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
      const offX = Array.isArray(props.svgOffset) ? props.svgOffset[0] * dpiRatio : 0;
      const offY = Array.isArray(props.svgOffset) ? props.svgOffset[1] * dpiRatio : 0;

      const finalX = pxX + offX;
      const finalY = pxY + offY;

      const escaped = textVal.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      svgElements += `<text x="${finalX.toFixed(1)}" y="${finalY.toFixed(1)}" class="march-place-label" text-anchor="${svgAnchor}" dominant-baseline="${svgBaseline}">${escaped}</text>\n`;
    }

    const kmDotR = Math.max(3.5, Math.round(4.0 * dpiRatio));
    const kmStrokeW = Math.max(1.5, Math.round(2.0 * dpiRatio));
    const kmOffset = Math.round(8 * dpiRatio);

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
      const placeFontPx = Math.max(12, Math.round(13.5 * dpiRatio));
      const placeHaloPx = Math.max(2.0, Math.round(2.5 * dpiRatio));
      const kmFontPx = Math.max(9, Math.round(10 * dpiRatio));
      const kmHaloPx = Math.max(1.8, Math.round(2.0 * dpiRatio));

      const svgContent = `<svg width="${totalPxWidth}" height="${totalPxHeight}" xmlns="http://www.w3.org/2000/svg">
        <style>
          .map-label {
            font-family: "Segoe UI", Arial, sans-serif;
            font-weight: 700;
            fill: #0f172a;
            paint-order: stroke fill;
            stroke: #ffffff;
            stroke-linejoin: round;
            stroke-linecap: round;
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

    if (cleanedStyle && cleanedStyle.sources) {
      for (const k of Object.keys(cleanedStyle.sources)) {
        const s = cleanedStyle.sources[k];
        if (s && s.type === 'raster') {
          const tStr = Array.isArray(s.tiles) ? s.tiles.join(' ') : (s.url || '');
          if (tStr.includes('virtualearth.net')) {
            s.maxzoom = Math.min(typeof s.maxzoom === 'number' ? s.maxzoom : 18, 18);
          } else if (tStr.includes('google.com')) {
            s.maxzoom = Math.min(typeof s.maxzoom === 'number' ? s.maxzoom : 19, 19);
          } else if (typeof s.maxzoom === 'number' && s.maxzoom > 19) {
            s.maxzoom = 19;
          }
        }
      }
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
      dpi: config.dpi,
      dpiRatio: config.dpiRatio,
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
