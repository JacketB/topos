const fs = require('fs');
const path = require('path');

const symbolsDir = path.join(__dirname, '..', 'public', 'symbols');
const manifestPath = path.join(symbolsDir, 'manifest.json');

function transliterateFileName(text) {
  const rus = "абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ";
  const eng = [
    "a", "b", "v", "g", "d", "e", "yo", "zh", "z", "i", "y", "k", "l", "m", "n", "o", "p", "r", "s", "t", "u", "f", "h", "ts", "ch", "sh", "sch", "", "y", "", "e", "yu", "ya",
    "a", "b", "v", "g", "d", "e", "yo", "zh", "z", "i", "y", "k", "l", "m", "n", "o", "p", "r", "s", "t", "u", "f", "h", "ts", "ch", "sh", "sch", "", "y", "", "e", "yu", "ya"
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
    .replace(/\s+/g, '_')          // Заменяем пробелы на подчеркивания
    .replace(/[^a-z0-9\-_]/g, '')  // Убираем все спецсимволы
    .replace(/_+/g, '_')           // Сжимаем множественные подчеркивания
    .replace(/(^_|_$)/g, '');      // Убираем подчеркивания по краям
}

try {
  const files = fs.readdirSync(symbolsDir);
  const manifest = [];

  console.log(`Сканирование папки: ${symbolsDir}`);
  console.log(`Всего файлов обнаружено: ${files.length}`);

  for (const file of files) {
    // Обрабатываем только SVG-файлы
    if (path.extname(file).toLowerCase() === '.svg') {
      const nameWithoutExt = path.basename(file, '.svg');
      
      // Генерируем безопасное латинское имя
      let safeBaseName = transliterateFileName(nameWithoutExt);
      if (!safeBaseName) {
        safeBaseName = `symbol_${manifest.length}`;
      }
      
      const safeFileName = `${safeBaseName}.svg`;
      const oldPath = path.join(symbolsDir, file);
      const newPath = path.join(symbolsDir, safeFileName);

      // Если имя файла небезопасно (содержит русские буквы, пробелы или спецсимволы)
      if (file !== safeFileName) {
        // Переименовываем физически файл на диске
        fs.renameSync(oldPath, newPath);
      }

      manifest.push({
        id: safeBaseName,
        name: nameWithoutExt, // Сохраняем красивое русское имя для UI
        file: safeFileName    // Безопасное имя файла на диске
      });
    }
  }

  // Сортируем знаки по алфавиту для удобного поиска в UI
  manifest.sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(`Успешно переименовано и сгенерировано: ${manifest.length} тактических знаков.`);
} catch (err) {
  console.error('Ошибка при переименовании и генерации манифеста:', err);
  process.exit(1);
}
