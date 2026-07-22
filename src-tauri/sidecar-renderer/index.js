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

// Фильтруем неопасное системное EGL предупреждение при закрытии OpenGL контекста
const origStderrWrite = process.stderr.write;
process.stderr.write = function (chunk, encoding, fd) {
  const str = chunk ? chunk.toString() : '';
  if (str.includes('Removing OpenGL context failed')) {
    return true;
  }
  return origStderrWrite.apply(this, arguments);
};

// Сохраняем оригинальный request и подменяем его в кэше до импорта mbgl-renderer
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

const requestMock = function(options, callback) {
  if (!options) {
    return realRequest(options, callback);
  }

  let url = typeof options === 'string' ? options : (options.url || options.uri);
  if (url && typeof url !== 'string') {
    url = url.toString();
  }

  if (!url) {
    return realRequest(options, callback);
  }

  if (url.includes('.pbf') && (url.includes('font') || url.includes('glyphs') || url.includes('openmaptiles'))) {
    const pbfMatch = url.match(/\/([^\/]+)\/([0-9]+-[0-9]+)\.pbf/);
    if (pbfMatch) {
      const fontRange = pbfMatch[2];
      const rawStack = decodeURIComponent(pbfMatch[1]);
      const cdnUrl = `https://cdn.jsdelivr.net/gh/openmaptiles/fonts@gh-pages/${encodeURIComponent(rawStack)}/${fontRange}.pbf`;
      const fallbackUrl = `https://cdn.jsdelivr.net/gh/openmaptiles/fonts@gh-pages/Noto%20Sans%20Regular/${fontRange}.pbf`;
      
      const fetchFont = (targetUrl, isRetry = false) => {
        const fontReqOpts = {
          url: targetUrl,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          timeout: 10000,
          encoding: null
        };
        realRequest(fontReqOpts, (err, res, body) => {
          if (!err && res && res.statusCode === 200 && body && body.length > 0) {
            console.error(`[FONT LOG] OK (200) for ${url} -> fetched ${body.length} bytes from ${targetUrl}`);
            return callback(null, { statusCode: 200, request: { uri: { href: url } } }, body);
          }
          console.error(`[FONT LOG] FAIL (${res ? res.statusCode : (err ? err.message : 'no body')}) for ${url} from ${targetUrl}`);
          if (!isRetry) {
            return fetchFont(fallbackUrl, true);
          }
          return callback(null, { statusCode: 204, request: { uri: { href: url } } }, Buffer.alloc(0));
        });
      };

      return fetchFont(cdnUrl);
    }
  }

  // Перехватываем относительные пути (начинающиеся со слэша или не содержащие протокола)
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
          return callback(null, { statusCode: 200, request: { uri: { href: url } } }, data);
        } catch (err) {
          return callback(err);
        }
      }
    }

    // Если локальный файл не найден, возвращаем 200 с пустым буфером, чтобы mbgl-renderer не прерывал рендеринг
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

const sharp = require('sharp');
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
  const MAX_CHUNK_PX = 3072; // Безопасная плитка 3072x3072 пикселей для EGL

  if (totalPxWidth <= MAX_CHUNK_PX && totalPxHeight <= MAX_CHUNK_PX) {
    return render(cleanedStyle, options.width, options.height, options);
  }

  const cols = Math.ceil(totalPxWidth / MAX_CHUNK_PX);
  const rows = Math.ceil(totalPxHeight / MAX_CHUNK_PX);

  const centerLng = options.center[0];
  const centerLat = options.center[1];
  const zoom = options.zoom || 0;

  const centerMerc = projectMercator(centerLng, centerLat, zoom);
  const compositeInputs = [];

  const totalTiles = rows * cols;
  let completedTiles = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tileLeft = c * MAX_CHUNK_PX;
      const tileTop = r * MAX_CHUNK_PX;
      const chunkPxW = Math.min(MAX_CHUNK_PX, totalPxWidth - tileLeft);
      const chunkPxH = Math.min(MAX_CHUNK_PX, totalPxHeight - tileTop);

      const tileCenterX = tileLeft + chunkPxW / 2;
      const tileCenterY = tileTop + chunkPxH / 2;

      const offsetPxX = (tileCenterX - totalPxWidth / 2) / ratio;
      const offsetPxY = (tileCenterY - totalPxHeight / 2) / ratio;

      const chunkMercX = centerMerc.x + offsetPxX;
      const chunkMercY = centerMerc.y + offsetPxY;

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
      compositeInputs.push({
        input: tileBuffer,
        left: tileLeft,
        top: tileTop
      });

      completedTiles++;
      const percent = Math.min(90, Math.round((completedTiles / totalTiles) * 90));
      process.stdout.write(JSON.stringify({ type: 'progress', percent }) + '\n');
    }
  }

  process.stdout.write(JSON.stringify({ type: 'progress', percent: 95 }) + '\n');

  let labelsSvgBuffer = null;
  try {
    const feats = cleanedStyle.sources?.['tactical-symbols']?.data?.features || [];
    const pointFeats = feats.filter(f => f.geometry?.type === 'Point' && f.properties && (f.properties.name || f.properties.label || f.properties.title));
    if (pointFeats.length > 0) {
      const fontSizePx = Math.max(14, Math.round(14 * ratio));
      const strokeWidthPx = Math.max(3, Math.round(3.5 * ratio));

      let textElements = '';
      for (const f of pointFeats) {
        const textVal = String(f.properties.name || f.properties.label || f.properties.title || '').trim();
        if (!textVal) continue;
        const coords = f.geometry.coordinates;
        const pointMerc = projectMercator(coords[0], coords[1], zoom);
        const pxX = totalPxWidth / 2 + (pointMerc.x - centerMerc.x) * ratio;
        const pxY = totalPxHeight / 2 + (pointMerc.y - centerMerc.y) * ratio + Math.round(24 * ratio);

        const escaped = textVal.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        textElements += `<text x="${pxX.toFixed(1)}" y="${pxY.toFixed(1)}" class="map-label">${escaped}</text>\n`;
      }

      if (textElements) {
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
          </style>
          ${textElements}
        </svg>`;
        labelsSvgBuffer = Buffer.from(svgContent);
      }
    }
  } catch (e) {
    console.error('Ошибка создания SVG-оверлея надписей:', e);
  }

  if (labelsSvgBuffer) {
    compositeInputs.push({
      input: labelsSvgBuffer,
      left: 0,
      top: 0
    });
  }

  const stitchedBuffer = await sharp({
    create: {
      width: totalPxWidth,
      height: totalPxHeight,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    },
    limitInputPixels: false
  })
  .composite(compositeInputs)
  .png()
  .toBuffer();

  return stitchedBuffer;
}

// Читаем входные данные из STDIN
let inputData = '';

process.stdin.on('data', chunk => {
  inputData += chunk;
});

process.stdin.on('end', () => {
  try {
    const config = JSON.parse(inputData);
    initPMTiles(config);

    // Очищаем pmtiles:// протокол в стиле, заменяя на http://
    let cleanedStyle = null;
    if (config.style) {
      let styleStr = JSON.stringify(config.style);
      styleStr = styleStr.replace(/pmtiles:\/\/http:\/\//g, 'http://');
      cleanedStyle = JSON.parse(styleStr);
    }

    if (cleanedStyle) {
      console.error(`[STYLE LOG] Glyphs URL: ${cleanedStyle.glyphs}`);
      const symbolLayers = (cleanedStyle.layers || []).filter(l => l.type === 'symbol');
      console.error(`[STYLE LOG] Total symbol layers count: ${symbolLayers.length}`);
      symbolLayers.forEach(l => {
        console.error(`[STYLE LOG] Layer '${l.id}': text-field = ${JSON.stringify(l.layout?.['text-field'])}, text-font = ${JSON.stringify(l.layout?.['text-font'])}`);
      });

      if (cleanedStyle.sources && cleanedStyle.sources['tactical-symbols']) {
        const feats = cleanedStyle.sources['tactical-symbols']?.data?.features || [];
        console.error(`[GEOJSON LOG] tactical-symbols total count: ${feats.length}`);
        const pointFeats = feats.filter(f => !f.properties?.isLinear);
        console.error(`[GEOJSON LOG] point symbols count: ${pointFeats.length}`);
        pointFeats.slice(0, 5).forEach((f, idx) => {
          console.error(`[GEOJSON LOG] Point Feature #${idx} properties: ${JSON.stringify(f.properties)}`);
        });
      }
    }
    
    const options = {
      zoom: config.zoom || 0,
      width: config.width || 800,
      height: config.height || 600,
      center: config.center || [0, 0],
      bearing: config.bearing || 0,
      pitch: config.pitch || 0,
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
