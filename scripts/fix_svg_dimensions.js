const fs = require('fs');
const path = require('path');

const symbolsDir = path.join(__dirname, '..', 'public', 'symbols');

try {
  const files = fs.readdirSync(symbolsDir);
  let fixedCount = 0;

  console.log(`Нормализация размеров SVG файлов...`);

  for (const file of files) {
    if (path.extname(file).toLowerCase() === '.svg') {
      const filePath = path.join(symbolsDir, file);
      let content = fs.readFileSync(filePath, 'utf-8');
      let originalContent = content;

      // 1. Удаляем XML-декларации и DOCTYPE (на всякий случай повторно)
      content = content
        .replace(/<\?xml[^>]*\?>/gi, '')
        .replace(/<!DOCTYPE[^>]*>/gi, '')
        .trim();

      // Находим тег <svg ...>
      const svgTagMatch = content.match(/<svg([^>]*)>/i);
      if (svgTagMatch) {
        let svgAttrs = svgTagMatch[1];

        // 2. Убираем "px" из атрибутов width и height (например, width="512px" -> width="512")
        svgAttrs = svgAttrs.replace(/width\s*=\s*["']\s*(\d+(?:\.\d+)?)\s*(?:px)?\s*["']/i, 'width="$1"');
        svgAttrs = svgAttrs.replace(/height\s*=\s*["']\s*(\d+(?:\.\d+)?)\s*(?:px)?\s*["']/i, 'height="$1"');

        // 3. Если width или height отсутствуют, пробуем восстановить их из viewBox
        const widthMatch = svgAttrs.match(/width\s*=\s*["']([^"']+)["']/i);
        const heightMatch = svgAttrs.match(/height\s*=\s*["']([^"']+)["']/i);
        const viewBoxMatch = svgAttrs.match(/viewBox\s*=\s*["']\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*["']/i);

        if (viewBoxMatch) {
          const vbWidth = viewBoxMatch[3];
          const vbHeight = viewBoxMatch[4];

          if (!widthMatch) {
            svgAttrs += ` width="${vbWidth}"`;
          }
          if (!heightMatch) {
            svgAttrs += ` height="${vbHeight}"`;
          }
        } else {
          // Если нет viewBox, но есть размеры, добавим дефолтный viewBox
          if (widthMatch && heightMatch && !svgAttrs.includes('viewBox')) {
            const w = widthMatch[1];
            const h = heightMatch[1];
            svgAttrs += ` viewBox="0 0 ${w} ${h}"`;
          }
        }

        // Заменяем старый тег <svg> на нормализованный
        content = content.replace(/<svg([^>]*)>/i, `<svg${svgAttrs}>`);
      }

      if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf-8');
        fixedCount++;
      }
    }
  }

  console.log(`Успешно нормализовано размеров в SVG файлах: ${fixedCount} из ${files.length}.`);
} catch (err) {
  console.error('Ошибка при нормализации SVG размеров:', err);
  process.exit(1);
}
