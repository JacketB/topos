const fs = require('fs');
const path = require('path');

// query для Overpass API
const query = `
[out:json][timeout:180];
area["ISO3166-1"="BY"]->.searchArea;
(
  nwr["landuse"="military"](area.searchArea);
  nwr["military"](area.searchArea);
);
out geom;
`;

async function downloadData() {
  console.log('📡 Отправляем запрос к Overpass API (может занять до 30-60 секунд)...');
  
  const url = 'https://overpass-api.de/api/interpreter';
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      body: new URLSearchParams({ data: query }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'ToposMapApp/1.0 (contact: support@toposmap.org)'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Ошибка Overpass API: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`✅ Данные получены! Всего элементов: ${data.elements ? data.elements.length : 0}`);
    
    // Конвертируем в GeoJSON
    const geojson = {
      type: 'FeatureCollection',
      features: []
    };
    
    for (const el of data.elements || []) {
      const tags = el.tags || {};
      const properties = {
        id: el.id,
        osm_type: el.type,
        name: tags['name:ru'] || tags['name'] || tags['name:be'] || '',
        name_en: tags['name:en'] || '',
        military: tags['military'] || '',
        landuse: tags['landuse'] || '',
        class: 'military',
        description: tags['description'] || ''
      };
      
      let geometry = null;
      
      if (el.type === 'node' && el.lat && el.lon) {
        geometry = {
          type: 'Point',
          coordinates: [el.lon, el.lat]
        };
      } else if (el.type === 'way' && el.geometry && el.geometry.length > 0) {
        const coords = el.geometry.map(pt => [pt.lon, pt.lat]);
        
        // Если это замкнутый путь (первая и последняя точки совпадают), делаем Polygon, иначе LineString
        const isClosed = coords.length > 2 && 
                         coords[0][0] === coords[coords.length - 1][0] && 
                         coords[0][1] === coords[coords.length - 1][1];
                         
        if (isClosed) {
          geometry = {
            type: 'Polygon',
            coordinates: [coords]
          };
        } else {
          geometry = {
            type: 'LineString',
            coordinates: coords
          };
        }
      } else if (el.type === 'relation' && el.members) {
        // Для отношений (мультиполигонов) собираем внешние пути
        const polygons = [];
        for (const member of el.members) {
          if (member.type === 'way' && member.geometry && member.geometry.length > 0) {
            polygons.push(member.geometry.map(pt => [pt.lon, pt.lat]));
          }
        }
        if (polygons.length > 0) {
          geometry = {
            type: 'MultiPolygon',
            coordinates: polygons.map(poly => [poly])
          };
        }
      }
      
      if (geometry) {
        geojson.features.push({
          type: 'Feature',
          geometry,
          properties
        });
      }
    }
    
    // Записываем результат
    const targetPath = path.join(__dirname, '../public/military.geojson');
    const targetDir = path.dirname(targetPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    
    fs.writeFileSync(targetPath, JSON.stringify(geojson, null, 2), 'utf-8');
    console.log(`🎉 Файл успешно сохранен: ${targetPath} (${geojson.features.length} объектов)`);
    
  } catch (err) {
    console.error('❌ Ошибка сканирования или сохранения:', err.message);
    process.exit(1);
  }
}

downloadData();
