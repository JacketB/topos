const fs = require('fs');
const path = require('path');

function createPmtilesHeader() {
  const header = Buffer.alloc(127);
  header.write('PMTiles', 0, 7, 'ascii');
  header.writeUInt8(3, 7);
  
  header.writeBigUInt64LE(0n, 8);
  header.writeBigUInt64LE(0n, 16);
  header.writeBigUInt64LE(0n, 24);
  header.writeBigUInt64LE(0n, 32);
  header.writeBigUInt64LE(0n, 40);
  header.writeBigUInt64LE(0n, 48);
  header.writeBigUInt64LE(0n, 56);
  header.writeBigUInt64LE(0n, 64);
  header.writeBigUInt64LE(0n, 72);
  header.writeBigUInt64LE(0n, 80);
  header.writeBigUInt64LE(0n, 88);
  
  header.writeUInt8(1, 96);
  header.writeUInt8(1, 97);
  header.writeUInt8(1, 98);
  header.writeUInt8(0, 99);

  return header;
}

const headerBuf = createPmtilesHeader();

const p1 = path.join(__dirname, '..', 'src-tauri', 'assets', 'belarus.pmtiles');
const p2 = path.join(__dirname, '..', 'src-tauri', 'assets', 'belarus_topomap_200k.pmtiles');

fs.writeFileSync(p1, headerBuf);
fs.writeFileSync(p2, headerBuf);

console.log('Successfully wrote valid PMTiles v3 headers to assets!');
