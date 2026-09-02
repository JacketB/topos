const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { PNG } = require('pngjs');
const { zxyToTileId, PMTiles } = require('pmtiles');

function encodeVarint(val, bytes) {
  let v = BigInt(val);
  while (v > 127n) {
    bytes.push(Number((v & 127n) | 128n));
    v = v >> 7n;
  }
  bytes.push(Number(v & 127n));
}

function serializeDirectory(entries) {
  const bytes = [];
  encodeVarint(entries.length, bytes);

  let lastId = 0n;
  for (const e of entries) {
    encodeVarint(BigInt(e.tileId) - lastId, bytes);
    lastId = BigInt(e.tileId);
  }

  for (const e of entries) {
    encodeVarint(e.runLength, bytes);
  }

  for (const e of entries) {
    encodeVarint(e.length, bytes);
  }

  for (let i = 0; i < entries.length; i++) {
    if (i === 0) {
      encodeVarint(BigInt(entries[0].offset) + 1n, bytes);
    } else {
      const diff = BigInt(entries[i].offset) - BigInt(entries[i - 1].offset) - BigInt(entries[i - 1].length);
      if (diff === 0n) {
        encodeVarint(0n, bytes);
      } else {
        encodeVarint(diff + 1n, bytes);
      }
    }
  }

  return zlib.gzipSync(Buffer.from(bytes));
}

async function main() {
  const tilesDir = path.join(__dirname, '..', 'data', 'terrain_tiles', 'terrarium');
  if (!fs.existsSync(tilesDir)) {
    console.error('Directory not found:', tilesDir);
    process.exit(1);
  }

  const rawEntries = [];
  const zoomDirs = fs.readdirSync(tilesDir);

  for (const zStr of zoomDirs) {
    const z = parseInt(zStr, 10);
    if (isNaN(z)) continue;
    const zPath = path.join(tilesDir, zStr);
    if (!fs.statSync(zPath).isDirectory()) continue;

    const xDirs = fs.readdirSync(zPath);
    for (const xStr of xDirs) {
      const x = parseInt(xStr, 10);
      if (isNaN(x)) continue;
      const xPath = path.join(zPath, xStr);
      if (!fs.statSync(xPath).isDirectory()) continue;

      const yFiles = fs.readdirSync(xPath);
      for (const yFile of yFiles) {
        if (!yFile.endsWith('.png')) continue;
        const y = parseInt(yFile.replace('.png', ''), 10);
        if (isNaN(y)) continue;

        const fullPath = path.join(xPath, yFile);
        const tileId = zxyToTileId(z, x, y);
        rawEntries.push({ z, x, y, tileId, path: fullPath });
      }
    }
  }

  rawEntries.sort((a, b) => (a.tileId < b.tileId ? -1 : a.tileId > b.tileId ? 1 : 0));
  console.log(`Converting ${rawEntries.length} tiles from Terrarium to Mapbox Terrain-RGB...`);

  const tileBuffers = [];
  const entries = [];
  let currentOffset = 0;

  for (let idx = 0; idx < rawEntries.length; idx++) {
    const item = rawEntries[idx];
    const srcBuf = fs.readFileSync(item.path);
    const png = PNG.sync.read(srcBuf);

    for (let i = 0; i < png.data.length; i += 4) {
      const rt = png.data[i];
      const gt = png.data[i + 1];
      const bt = png.data[i + 2];
      const h = (rt * 256 + gt + bt / 256) - 32768;
      const v = Math.max(0, Math.round((h + 10000) * 10));
      png.data[i] = Math.floor(v / 65536) & 0xFF;
      png.data[i + 1] = Math.floor((v % 65536) / 256) & 0xFF;
      png.data[i + 2] = v & 0xFF;
      png.data[i + 3] = 255;
    }

    const convertedBuf = PNG.sync.write(png);
    tileBuffers.push(convertedBuf);

    entries.push({
      tileId: item.tileId,
      offset: currentOffset,
      length: convertedBuf.length,
      runLength: 1
    });
    currentOffset += convertedBuf.length;

    if ((idx + 1) % 300 === 0 || idx === rawEntries.length - 1) {
      console.log(`Converted ${idx + 1}/${rawEntries.length} tiles...`);
    }
  }

  const totalTileDataLength = currentOffset;
  const rootDirCompressed = serializeDirectory(entries);

  const metadataJson = JSON.stringify({
    encoding: 'mapbox',
    type: 'raster-dem',
    format: 'png',
    minzoom: 0,
    maxzoom: 10,
    bounds: [22.70, 50.95, 33.20, 56.45],
    center: [27.56, 53.90, 7]
  });
  const metadataCompressed = zlib.gzipSync(Buffer.from(metadataJson, 'utf-8'));

  const rootDirOffset = 127;
  const rootDirLength = rootDirCompressed.length;
  const jsonMetadataOffset = rootDirOffset + rootDirLength;
  const jsonMetadataLength = metadataCompressed.length;
  const tileDataOffset = jsonMetadataOffset + jsonMetadataLength;

  const header = Buffer.alloc(127);
  header.write('PMTiles', 0, 7, 'ascii');
  header.writeUInt8(3, 7);

  header.writeBigUInt64LE(BigInt(rootDirOffset), 8);
  header.writeBigUInt64LE(BigInt(rootDirLength), 16);
  header.writeBigUInt64LE(BigInt(jsonMetadataOffset), 24);
  header.writeBigUInt64LE(BigInt(jsonMetadataLength), 32);
  header.writeBigUInt64LE(0n, 40);
  header.writeBigUInt64LE(0n, 48);
  header.writeBigUInt64LE(BigInt(tileDataOffset), 56);
  header.writeBigUInt64LE(BigInt(totalTileDataLength), 64);
  header.writeBigUInt64LE(BigInt(entries.length), 72);
  header.writeBigUInt64LE(BigInt(entries.length), 80);
  header.writeBigUInt64LE(BigInt(entries.length), 88);

  header.writeUInt8(1, 96);
  header.writeUInt8(2, 97);
  header.writeUInt8(1, 98);
  header.writeUInt8(2, 99);
  header.writeUInt8(0, 100);
  header.writeUInt8(10, 101);

  header.writeInt32LE(Math.round(22.70 * 1e7), 102);
  header.writeInt32LE(Math.round(50.95 * 1e7), 106);
  header.writeInt32LE(Math.round(33.20 * 1e7), 110);
  header.writeInt32LE(Math.round(56.45 * 1e7), 114);

  header.writeUInt8(7, 118);
  header.writeInt32LE(Math.round(27.56 * 1e7), 119);
  header.writeInt32LE(Math.round(53.90 * 1e7), 123);

  const outPath = path.join(__dirname, '..', 'src-tauri', 'assets', 'terrain.pmtiles');
  
  const finalBuffer = Buffer.concat([
    header,
    rootDirCompressed,
    metadataCompressed,
    ...tileBuffers
  ]);

  fs.writeFileSync(outPath, finalBuffer);

  const stats = fs.statSync(outPath);
  console.log(`Successfully created Mapbox Terrain-RGB PMTiles: ${outPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

  const copies = [
    path.join(__dirname, '..', 'public', 'terrain.pmtiles'),
    path.join(__dirname, '..', 'public', 'assets', 'terrain.pmtiles'),
    path.join(__dirname, '..', 'src-tauri', 'target', 'debug', 'assets', 'terrain.pmtiles'),
    path.join(__dirname, '..', 'src-tauri', 'target', 'release', 'assets', 'terrain.pmtiles')
  ];

  for (const c of copies) {
    const dir = path.dirname(c);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(c, finalBuffer);
    console.log(`Copied to ${c}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
