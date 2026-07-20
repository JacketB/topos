const fs = require('fs');
const render = require('mbgl-renderer');

// Читаем входные данные из STDIN
let inputData = '';

process.stdin.on('data', chunk => {
  inputData += chunk;
});

process.stdin.on('end', () => {
  try {
    const config = JSON.parse(inputData);
    
    const options = {
      zoom: config.zoom || 0,
      width: config.width || 800,
      height: config.height || 600,
      center: config.center || [0, 0],
      bearing: config.bearing || 0,
      pitch: config.pitch || 0,
      style: config.style,
      // Включаем High DPI / Ratio
      ratio: config.ratio || 1,
      images: config.images
    };

    // Рендерим изображение
    render(options)
      .then((buffer) => {
        if (config.outputPath) {
          fs.writeFileSync(config.outputPath, buffer);
          process.stdout.write(JSON.stringify({ success: true, path: config.outputPath }));
        } else {
          // Выдаем base64
          process.stdout.write(JSON.stringify({ success: true, data: buffer.toString('base64') }));
        }
      })
      .catch((err) => {
        process.stderr.write(JSON.stringify({ success: false, error: err.message }));
        process.exit(1);
      });

  } catch (e) {
    process.stderr.write(JSON.stringify({ success: false, error: 'Invalid JSON input: ' + e.message }));
    process.exit(1);
  }
});
