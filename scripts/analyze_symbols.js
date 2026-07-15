const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'public', 'symbols');
const files = fs.readdirSync(dir);

let duplicates = [];
let baseFiles = [];

files.forEach(file => {
  if (!file.endsWith('.svg')) return;
  const name = file.replace('.svg', '');
  
  // Проверяем паттерн: заканчивается на цифру от 2 до 9 (например _2, 2, _pr2, _svoya_2)
  // И смотрим, есть ли вариант с 1 или _1 или вообще без цифры
  const match = name.match(/^(.*?)[_]?([2-9])$/);
  if (match) {
    const basePrefix = match[1];
    const maybeBase1 = basePrefix + '1.svg';
    const maybeBase_1 = basePrefix + '_1.svg';
    const maybeBase0 = basePrefix + '.svg';

    if (files.includes(maybeBase1) || files.includes(maybeBase_1) || files.includes(maybeBase0)) {
      duplicates.push(file);
    } else {
      baseFiles.push(file);
    }
  } else {
    baseFiles.push(file);
  }
});

console.log(`Total files: ${files.length}`);
console.log(`Duplicate rotated files found (2..9 with base 1): ${duplicates.length}`);
console.log(`Remaining unique symbols after cleanup: ${files.length - duplicates.length}`);
console.log(`Sample duplicates to remove:`, duplicates.slice(0, 30));
