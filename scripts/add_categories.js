/**
 * Скрипт добавления поля "category" в manifest.json
 * на основе структуры папок оригинальных значков.
 */
const fs = require('fs');
const path = require('path');

// Путь к оригинальным значкам с категориями
const iconsBase = 'C:\\Users\\user\\Downloads\\Тактические знаки icons для оффлайнмапс\\icons';

// 1. Строим маппинг: оригинальное_имя_файла.svg → название_категории
const originalNameToCategory = {};
const dirs = fs.readdirSync(iconsBase).filter(f => 
  fs.statSync(path.join(iconsBase, f)).isDirectory()
);

for (const cat of dirs) {
  const files = fs.readdirSync(path.join(iconsBase, cat)).filter(f => f.toLowerCase().endsWith('.svg'));
  for (const f of files) {
    // Ключ — имя файла без расширения, в нижнем регистре, с тримом
    const key = f.replace(/\.svg$/i, '').toLowerCase().trim();
    originalNameToCategory[key] = cat;
  }
}

console.log(`Построен маппинг: ${Object.keys(originalNameToCategory).length} файлов → ${dirs.length} категорий`);

// 2. Загружаем текущий манифест
const manifestPath = path.join(__dirname, '..', 'public', 'symbols', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

// 3. Для каждого элемента манифеста ищем категорию по оригинальному имени
let matched = 0;
let unmatched = 0;
const unmatchedNames = [];

for (const entry of manifest) {
  // entry.name — оригинальное русское имя (например "Арт оп своя 1")
  const key = entry.name.toLowerCase().trim();
  
  if (originalNameToCategory[key]) {
    entry.category = originalNameToCategory[key];
    matched++;
  } else {
    entry.category = 'другое';
    unmatched++;
    unmatchedNames.push(entry.name);
  }
}

console.log(`Сопоставлено: ${matched}, не найдено: ${unmatched}`);
if (unmatchedNames.length > 0) {
  console.log('Не сопоставлены:', unmatchedNames.slice(0, 20).join(', '));
}

// 4. Сохраняем обновлённый манифест
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
console.log(`Манифест обновлён: ${manifestPath}`);

// 5. Выводим статистику по категориям
const stats = {};
for (const entry of manifest) {
  stats[entry.category] = (stats[entry.category] || 0) + 1;
}
console.log('\nКатегории:');
Object.entries(stats).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
  console.log(`  ${cat}: ${count}`);
});
