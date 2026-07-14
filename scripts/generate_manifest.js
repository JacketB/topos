const fs = require('fs');
const path = require('path');

const symbolsDir = path.join(__dirname, '..', 'public', 'symbols');
const manifestPath = path.join(symbolsDir, 'manifest.json');

// Простая функция транслитерации для генерации безопасных ID в MapLibre
function transliterate(text) {
  const rus = "абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ";
  const eng = [
    "a", "b", "v", "g", "d", "e", "yo", "zh", "z", "i", "y", "k", "l", "m", "n", "o", "p", "r", "s", "t", "u", "f", "h", "ts", "ch", "sh", "sch", "", "y", "", "e", "yu", "ya",
    "A", "B", "V", "G", "D", "E", "Yo", "Zh", "Z", "I", "Y", "K", "L", "M", "N", "O", "P", "R", "S", "T", "U", "F", "H", "Ts", "Ch", "Sh", "Sch", "", "Y", "", "E", "Yu", "Ya"
  ];
  let result = "";
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const idx = rus.indexOf(char);
    if (idx >= 0) {
      result += eng[idx];
    } else {
      result += char;
    }
  }
  return result
    .toLowerCase()
    .replace(/[^a-z0-9\-_]/g, '_') // Заменяем все небезопасные символы на подчеркивание
    .replace(/_+/g, '_')          // Сжимаем множественные подчеркивания
    .replace(/(^_|_$)/g, '');      // Убираем подчеркивания по краям
}

try {
  const files = fs.readdirSync(symbolsDir);
  const manifest = [];

  for (const file of files) {
    if (path.extname(file).toLowerCase() === '.svg') {
      const nameWithoutExt = path.basename(file, '.svg');
      
      // Генерация безопасного ID
      let id = transliterate(nameWithoutExt);
      if (!id) {
        id = `symbol_${manifest.length}`;
      }

      manifest.push({
        id: id,
        name: nameWithoutExt,
        file: file
      });
    }
  }

  // Сортируем знаки по алфавиту для удобного поиска в меню
  manifest.sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(`Успешно сгенерирован манифест: ${manifest.length} тактических знаков.`);
} catch (err) {
  console.error('Ошибка при генерации манифеста:', err);
  process.exit(1);
}
