const fs = require('fs');
const path = require('path');

const symbolsDir = path.join(__dirname, '..', 'public', 'symbols');

try {
  const files = fs.readdirSync(symbolsDir);
  let cleanedCount = 0;

  console.log(`Очистка XML/DOCTYPE заголовков в SVG файлах...`);

  for (const file of files) {
    if (path.extname(file).toLowerCase() === '.svg') {
      const filePath = path.join(symbolsDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      // Регулярные выражения для удаления XML-декларации и DOCTYPE
      const cleanContent = content
        .replace(/<\?xml[^>]*\?>/gi, '')
        .replace(/<!DOCTYPE[^>]*>/gi, '')
        .trim();

      if (content !== cleanContent) {
        fs.writeFileSync(filePath, cleanContent, 'utf-8');
        cleanedCount++;
      }
    }
  }

  console.log(`Успешно очищено файлов: ${cleanedCount} из ${files.length}.`);
} catch (err) {
  console.error('Ошибка при очистке SVG-файлов:', err);
  process.exit(1);
}
