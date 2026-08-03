const fs = require('fs');
const path = require('path');

const places = [
  { id: 'minsk', name: 'Минск', nameBe: 'Мінск', type: 'city', region: 'Минская область', coords: [27.5618, 53.9022], population: 1995000 },
  { id: 'borisov', name: 'Борисов', nameBe: 'Барысаў', type: 'town', region: 'Минская область', coords: [28.5119, 54.2276], population: 143000 },
  { id: 'zhodino', name: 'Жодино', nameBe: 'Жодзіна', type: 'town', region: 'Минская область', coords: [28.3475, 54.0970], population: 64500 },
  { id: 'molodechno', name: 'Молодечно', nameBe: 'Маладзечна', type: 'town', region: 'Минская область', coords: [26.8522, 54.3125], population: 95000 },
  { id: 'soligorsk', name: 'Солигорск', nameBe: 'Салігорск', type: 'town', region: 'Минская область', coords: [27.5408, 52.7876], population: 106000 },
  { id: 'slutsk', name: 'Слуцк', nameBe: 'Слуцк', type: 'town', region: 'Минская область', coords: [27.5458, 53.0274], population: 62000 },
  { id: 'dzerzhinsk', name: 'Дзержинск', nameBe: 'Дзяржынск', type: 'town', region: 'Минская область', coords: [27.1384, 53.6842], population: 29800 },
  { id: 'vileyka', name: 'Вилейка', nameBe: 'Вілейка', type: 'town', region: 'Минская область', coords: [26.9114, 54.4914], population: 26800 },
  { id: 'nesvizh', name: 'Несвиж', nameBe: 'Нясвіж', type: 'town', region: 'Минская область', coords: [26.6681, 53.2198], population: 15500 },
  { id: 'marina_gorka', name: 'Марьина Горка', nameBe: 'Мар’іна Горка', type: 'town', region: 'Минская область', coords: [28.1528, 53.5097], population: 21000 },
  { id: 'stolbtsy', name: 'Столбцы', nameBe: 'Стаўбцы', type: 'town', region: 'Минская область', coords: [26.7778, 53.4839], population: 17000 },
  { id: 'zaslavl', name: 'Заславль', nameBe: 'Заслаўе', type: 'town', region: 'Минская область', coords: [27.2886, 54.0044], population: 15700 },
  { id: 'krupki', name: 'Крупки', nameBe: 'Крупкі', type: 'town', region: 'Минская область', coords: [29.1377, 54.3217], population: 8600 },
  { id: 'volozhin', name: 'Воложин', nameBe: 'Валожын', type: 'town', region: 'Минская область', coords: [26.5264, 54.0886], population: 10300 },
  { id: 'kopyl', name: 'Копыль', nameBe: 'Капыль', type: 'town', region: 'Минская область', coords: [27.0911, 53.1519], population: 9500 },
  { id: 'uzda', name: 'Узда', nameBe: 'Узда', type: 'town', region: 'Минская область', coords: [27.2144, 53.4633], population: 10100 },
  { id: 'berezino', name: 'Березино', nameBe: 'Беразіно', type: 'town', region: 'Минская область', coords: [28.9864, 53.8344], population: 11800 },
  { id: 'starye_dorogi', name: 'Старые Дороги', nameBe: 'Старыя Дарогі', type: 'town', region: 'Минская область', coords: [28.2831, 53.0389], population: 11000 },
  { id: 'lyuban', name: 'Любань', nameBe: 'Любань', type: 'town', region: 'Минская область', coords: [28.0039, 52.7986], population: 11000 },
  { id: 'logoisk', name: 'Логойск', nameBe: 'Лагойск', type: 'town', region: 'Минская область', coords: [27.8425, 54.2047], population: 13000 },

  { id: 'brest', name: 'Брест', nameBe: 'Брэст', type: 'city', region: 'Брестская область', coords: [23.7000, 52.0976], population: 340000 },
  { id: 'baranovichi', name: 'Барановичи', nameBe: 'Баранавічы', type: 'town', region: 'Брестская область', coords: [26.0139, 53.1327], population: 175000 },
  { id: 'pinsk', name: 'Пинск', nameBe: 'Пінск', type: 'town', region: 'Брестская область', coords: [26.0967, 52.1154], population: 126000 },
  { id: 'kobrin', name: 'Кобрин', nameBe: 'Кобрын', type: 'town', region: 'Брестская область', coords: [24.3564, 52.2139], population: 52000 },
  { id: 'bereza', name: 'Береза', nameBe: 'Бяроза', type: 'town', region: 'Брестская область', coords: [24.9786, 52.5336], population: 29000 },
  { id: 'ivatsevichi', name: 'Ивацевичи', nameBe: 'Івацэвічы', type: 'town', region: 'Брестская область', coords: [25.3400, 52.7128], population: 23000 },
  { id: 'luninets', name: 'Лунинец', nameBe: 'Лунінец', type: 'town', region: 'Брестская область', coords: [26.8000, 52.2472], population: 24000 },
  { id: 'pruzhany', name: 'Пружаны', nameBe: 'Пружаны', type: 'town', region: 'Брестская область', coords: [24.4561, 52.5561], population: 19000 },
  { id: 'gantsevichi', name: 'Ганцевичи', nameBe: 'Ганцавічы', type: 'town', region: 'Брестская область', coords: [26.4328, 52.7583], population: 13800 },
  { id: 'drogichin', name: 'Дрогичин', nameBe: 'Драгічын', type: 'town', region: 'Брестская область', coords: [25.1500, 52.1833], population: 14800 },
  { id: 'zhabinka', name: 'Жабинка', nameBe: 'Жабінка', type: 'town', region: 'Брестская область', coords: [24.0167, 52.2000], population: 13200 },
  { id: 'stolin', name: 'Столин', nameBe: 'Столін', type: 'town', region: 'Брестская область', coords: [26.8500, 51.8833], population: 13000 },
  { id: 'ivanovo', name: 'Иваново', nameBe: 'Іванава', type: 'town', region: 'Брестская область', coords: [25.5333, 52.1500], population: 16000 },
  { id: 'lyakhovichi', name: 'Ляховичи', nameBe: 'Ляхавічы', type: 'town', region: 'Брестская область', coords: [26.2667, 53.0333], population: 10900 },
  { id: 'kamenets', name: 'Каменец', nameBe: 'Каменец', type: 'town', region: 'Брестская область', coords: [23.8167, 52.4000], population: 8400 },

  { id: 'vitebsk', name: 'Витебск', nameBe: 'Віцебск', type: 'city', region: 'Витебская область', coords: [30.2049, 55.1904], population: 362000 },
  { id: 'orsha', name: 'Орша', nameBe: 'Ворша', type: 'town', region: 'Витебская область', coords: [30.4186, 54.5086], population: 108000 },
  { id: 'novopolotsk', name: 'Новополоцк', nameBe: 'Наваполацк', type: 'town', region: 'Витебская область', coords: [28.6586, 55.5322], population: 98000 },
  { id: 'polotsk', name: 'Полоцк', nameBe: 'Полацк', type: 'town', region: 'Витебская область', coords: [28.7847, 55.4856], population: 80000 },
  { id: 'postavy', name: 'Поставы', nameBe: 'Паставы', type: 'town', region: 'Витебская область', coords: [26.8389, 55.1161], population: 19000 },
  { id: 'glubokoe', name: 'Глубокое', nameBe: 'Глыбокае', type: 'town', region: 'Витебская область', coords: [27.6908, 55.1386], population: 18000 },
  { id: 'lepel', name: 'Лепель', nameBe: 'Лепель', type: 'town', region: 'Витебская область', coords: [28.6975, 54.8833], population: 17200 },
  { id: 'dokshitsy', name: 'Докшицы', nameBe: 'Докшыцы', type: 'town', region: 'Витебская область', coords: [27.7667, 54.8333], population: 6900 },
  { id: 'gorodok', name: 'Городок', nameBe: 'Гарадок', type: 'town', region: 'Витебская область', coords: [29.9833, 55.4628], population: 11700 },
  { id: 'braslav', name: 'Браслав', nameBe: 'Браслаў', type: 'town', region: 'Витебская область', coords: [27.0333, 55.6333], population: 9400 },
  { id: 'tolochin', name: 'Толочин', nameBe: 'Талачын', type: 'town', region: 'Витебская область', coords: [29.7000, 54.4167], population: 9700 },

  { id: 'gomel', name: 'Гомель', nameBe: 'Гомель', type: 'city', region: 'Гомельская область', coords: [30.9754, 52.4345], population: 508000 },
  { id: 'mozyr', name: 'Мозырь', nameBe: 'Мазыр', type: 'town', region: 'Гомельская область', coords: [29.2731, 52.0492], population: 111000 },
  { id: 'zhlobin', name: 'Жлобин', nameBe: 'Жлобін', type: 'town', region: 'Гомельская область', coords: [30.0244, 52.8928], population: 76000 },
  { id: 'svetlogorsk', name: 'Светлогорск', nameBe: 'Светлагорск', type: 'town', region: 'Гомельская область', coords: [29.7333, 52.6333], population: 67000 },
  { id: 'rechitsa', name: 'Речица', nameBe: 'Рэчыца', type: 'town', region: 'Гомельская область', coords: [30.3667, 52.3667], population: 65000 },
  { id: 'kalinkovichi', name: 'Калинковичи', nameBe: 'Калінкавічы', type: 'town', region: 'Гомельская область', coords: [29.3333, 52.1333], population: 38000 },
  { id: 'rogachev', name: 'Рогачев', nameBe: 'Рагачоў', type: 'town', region: 'Гомельская область', coords: [30.0500, 53.1000], population: 34000 },
  { id: 'dobrush', name: 'Добруш', nameBe: 'Добруш', type: 'town', region: 'Гомельская область', coords: [31.3167, 52.4167], population: 18000 },
  { id: 'zhitkovichi', name: 'Житковичи', nameBe: 'Жыткавічы', type: 'town', region: 'Гомельская область', coords: [27.8500, 52.2167], population: 16000 },
  { id: 'khoiniki', name: 'Хойники', nameBe: 'Хойнікі', type: 'town', region: 'Гомельская область', coords: [29.9667, 51.8833], population: 12400 },
  { id: 'petrikov', name: 'Петриков', nameBe: 'Петрыкаў', type: 'town', region: 'Гомельская область', coords: [28.5833, 52.1333], population: 10200 },

  { id: 'grodno', name: 'Гродно', nameBe: 'Гродна', type: 'city', region: 'Гродненская область', coords: [23.8294, 53.6693], population: 357000 },
  { id: 'lida', name: 'Лида', nameBe: 'Ліда', type: 'town', region: 'Гродненская область', coords: [25.3000, 53.8833], population: 102000 },
  { id: 'slonim', name: 'Слоним', nameBe: 'Слонім', type: 'town', region: 'Гродненская область', coords: [25.3167, 53.0833], population: 49000 },
  { id: 'volkovysk', name: 'Волковыск', nameBe: 'Ваўкавыск', type: 'town', region: 'Гродненская область', coords: [24.4500, 53.1500], population: 44000 },
  { id: 'smorgon', name: 'Сморгонь', nameBe: 'Смаргонь', type: 'town', region: 'Гродненская область', coords: [26.4000, 54.4833], population: 36000 },
  { id: 'novogrudok', name: 'Новогрудок', nameBe: 'Навагрудак', type: 'town', region: 'Гродненская область', coords: [25.8333, 53.6000], population: 28000 },
  { id: 'mosty', name: 'Мосты', nameBe: 'Масты', type: 'town', region: 'Гродненская область', coords: [24.5333, 53.4167], population: 15000 },
  { id: 'shchuchin', name: 'Щучин', nameBe: 'Шчучын', type: 'town', region: 'Гродненская область', coords: [24.7500, 53.6000], population: 15500 },
  { id: 'oshmiany', name: 'Ошмяны', nameBe: 'Ашмяны', type: 'town', region: 'Гродненская область', coords: [25.9333, 54.4167], population: 16800 },
  { id: 'ivye', name: 'Ивье', nameBe: 'Іўе', type: 'town', region: 'Гродненская область', coords: [25.7667, 53.9333], population: 7700 },

  { id: 'mogilev', name: 'Могилев', nameBe: 'Магілёў', type: 'city', region: 'Могилевская область', coords: [30.3325, 53.8981], population: 357000 },
  { id: 'bobruisk', name: 'Бобруйск', nameBe: 'Бабруйск', type: 'city', region: 'Могилевская область', coords: [29.2333, 53.1500], population: 212000 },
  { id: 'gorki', name: 'Горки', nameBe: 'Горкі', type: 'town', region: 'Могилевская область', coords: [30.9833, 54.2833], population: 29000 },
  { id: 'osipovichi', name: 'Осиповичи', nameBe: 'Асіповічы', type: 'town', region: 'Могилевская область', coords: [28.6333, 53.3000], population: 30000 },
  { id: 'krichev', name: 'Кричев', nameBe: 'Крычаў', type: 'town', region: 'Могилевская область', coords: [31.7167, 53.7167], population: 25000 },
  { id: 'bykhov', name: 'Быхов', nameBe: 'Быхаў', type: 'town', region: 'Могилевская область', coords: [30.2500, 53.5167], population: 17000 },
  { id: 'klimovichi', name: 'Климовичи', nameBe: 'Клімавічы', type: 'town', region: 'Могилевская область', coords: [31.9500, 53.6167], population: 16000 },
  { id: 'shklov', name: 'Шклов', nameBe: 'Шклоў', type: 'town', region: 'Могилевская область', coords: [30.3000, 54.2167], population: 16000 },
  { id: 'klichev', name: 'Кличев', nameBe: 'Клічаў', type: 'town', region: 'Могилевская область', coords: [29.3333, 53.5833], population: 7400 },
  { id: 'kirovsk', name: 'Кировск', nameBe: 'Кіраўск', type: 'town', region: 'Могилевская область', coords: [29.4667, 53.2667], population: 8400 }
];

function getDistanceKm(p1, p2) {
  const R = 6371;
  const dLat = (p2[1] - p1[1]) * Math.PI / 180;
  const dLon = (p2[0] - p1[0]) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(p1[1] * Math.PI / 180) * Math.cos(p2[1] * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const allNodes = [];
const nodeMap = new Map();

places.forEach((p, idx) => {
  const nodeObj = {
    id: idx,
    placeId: p.id,
    name: p.name,
    nameBe: p.nameBe,
    type: p.type,
    region: p.region,
    coords: p.coords,
    population: p.population
  };
  allNodes.push(nodeObj);
  nodeMap.set(p.id, nodeObj);
});

let nextNodeId = allNodes.length;

function createIntermediateNode(name, coords) {
  const nodeObj = {
    id: nextNodeId++,
    placeId: null,
    name: name,
    nameBe: null,
    type: 'junction',
    region: null,
    coords: coords,
    population: null
  };
  allNodes.push(nodeObj);
  return nodeObj;
}

function interpolateCurvedPoints(p1, p2, curveOffsetFactor = 0.08, numPoints = 3) {
  const points = [];
  const midX = (p1[0] + p2[0]) / 2;
  const midY = (p1[1] + p2[1]) / 2;

  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const dist = Math.hypot(dx, dy);

  const perpX = -dy / (dist || 1);
  const perpY = dx / (dist || 1);

  const ctrlX = midX + perpX * dist * curveOffsetFactor;
  const ctrlY = midY + perpY * dist * curveOffsetFactor;

  for (let i = 1; i <= numPoints; i++) {
    const t = i / (numPoints + 1);
    const x = (1 - t) * (1 - t) * p1[0] + 2 * (1 - t) * t * ctrlX + t * t * p2[0];
    const y = (1 - t) * (1 - t) * p1[1] + 2 * (1 - t) * t * ctrlY + t * t * p2[1];
    points.push([parseFloat(x.toFixed(4)), parseFloat(y.toFixed(4))]);
  }
  return points;
}

const edges = [];

function addEdgeWithCurvature(id1, id2, roadType = 'primary', speedKmh = 90, curveDirection = 1) {
  const n1 = nodeMap.get(id1);
  const n2 = nodeMap.get(id2);
  if (!n1 || !n2) return;

  const interCoords = interpolateCurvedPoints(n1.coords, n2.coords, 0.06 * curveDirection, 3);
  const intermediateNodes = interCoords.map((c, i) =>
    createIntermediateNode(`${n1.name}-${n2.name}_${i + 1}`, c)
  );

  const sequence = [n1, ...intermediateNodes, n2];

  for (let i = 0; i < sequence.length - 1; i++) {
    const u = sequence[i];
    const v = sequence[i + 1];
    const dist = getDistanceKm(u.coords, v.coords);

    edges.push({
      from: u.id,
      to: v.id,
      fromPlace: u.name,
      toPlace: v.name,
      distanceKm: parseFloat(dist.toFixed(2)),
      roadType: roadType,
      speedKmh: speedKmh,
      oneWay: false
    });

    edges.push({
      from: v.id,
      to: u.id,
      fromPlace: v.name,
      toPlace: u.name,
      distanceKm: parseFloat(dist.toFixed(2)),
      roadType: roadType,
      speedKmh: speedKmh,
      oneWay: false
    });
  }
}

addEdgeWithCurvature('minsk', 'zhodino', 'motorway', 110, 1);
addEdgeWithCurvature('zhodino', 'borisov', 'motorway', 110, -1);
addEdgeWithCurvature('borisov', 'krupki', 'motorway', 110, 1);
addEdgeWithCurvature('krupki', 'tolochin', 'motorway', 110, -1);
addEdgeWithCurvature('tolochin', 'orsha', 'motorway', 110, 1);
addEdgeWithCurvature('orsha', 'vitebsk', 'primary', 90, -1);
addEdgeWithCurvature('orsha', 'shklov', 'primary', 90, 1);
addEdgeWithCurvature('shklov', 'mogilev', 'primary', 90, -1);

addEdgeWithCurvature('minsk', 'dzerzhinsk', 'motorway', 110, -1);
addEdgeWithCurvature('dzerzhinsk', 'stolbtsy', 'motorway', 110, 1);
addEdgeWithCurvature('stolbtsy', 'baranovichi', 'motorway', 110, -1);
addEdgeWithCurvature('baranovichi', 'ivatsevichi', 'motorway', 110, 1);
addEdgeWithCurvature('ivatsevichi', 'bereza', 'motorway', 110, -1);
addEdgeWithCurvature('bereza', 'kobrin', 'motorway', 110, 1);
addEdgeWithCurvature('kobrin', 'zhabinka', 'motorway', 110, -1);
addEdgeWithCurvature('zhabinka', 'brest', 'motorway', 110, 1);

addEdgeWithCurvature('minsk', 'logoisk', 'primary', 90, 1);
addEdgeWithCurvature('minsk', 'marina_gorka', 'primary', 90, -1);
addEdgeWithCurvature('marina_gorka', 'osipovichi', 'primary', 90, 1);
addEdgeWithCurvature('osipovichi', 'bobruisk', 'primary', 90, -1);
addEdgeWithCurvature('bobruisk', 'zhlobin', 'primary', 90, 1);
addEdgeWithCurvature('zhlobin', 'rechitsa', 'primary', 90, -1);
addEdgeWithCurvature('rechitsa', 'gomel', 'primary', 90, 1);

addEdgeWithCurvature('minsk', 'molodechno', 'primary', 90, -1);
addEdgeWithCurvature('molodechno', 'vileyka', 'secondary', 80, 1);
addEdgeWithCurvature('vileyka', 'dokshitsy', 'secondary', 80, -1);
addEdgeWithCurvature('dokshitsy', 'glubokoe', 'secondary', 80, 1);
addEdgeWithCurvature('glubokoe', 'postavy', 'secondary', 80, -1);
addEdgeWithCurvature('glubokoe', 'braslav', 'secondary', 80, 1);
addEdgeWithCurvature('polotsk', 'novopolotsk', 'primary', 80, 1);
addEdgeWithCurvature('polotsk', 'glubokoe', 'primary', 90, -1);
addEdgeWithCurvature('polotsk', 'lepel', 'primary', 90, 1);
addEdgeWithCurvature('lepel', 'dokshitsy', 'secondary', 80, -1);
addEdgeWithCurvature('lepel', 'vitebsk', 'primary', 90, 1);

addEdgeWithCurvature('minsk', 'slutsk', 'primary', 90, -1);
addEdgeWithCurvature('slutsk', 'soligorsk', 'primary', 90, 1);
addEdgeWithCurvature('slutsk', 'starye_dorogi', 'secondary', 80, -1);
addEdgeWithCurvature('soligorsk', 'lyuban', 'secondary', 80, 1);
addEdgeWithCurvature('starye_dorogi', 'bobruisk', 'secondary', 80, -1);
addEdgeWithCurvature('bobruisk', 'kirovsk', 'secondary', 80, 1);
addEdgeWithCurvature('kirovsk', 'mogilev', 'primary', 90, -1);
addEdgeWithCurvature('bobruisk', 'klichev', 'secondary', 80, 1);
addEdgeWithCurvature('klichev', 'mogilev', 'secondary', 80, -1);

addEdgeWithCurvature('baranovichi', 'slonim', 'primary', 90, 1);
addEdgeWithCurvature('slonim', 'volkovysk', 'primary', 90, -1);
addEdgeWithCurvature('volkovysk', 'mosty', 'secondary', 80, 1);
addEdgeWithCurvature('mosty', 'grodno', 'primary', 90, -1);
addEdgeWithCurvature('baranovichi', 'lida', 'primary', 90, 1);
addEdgeWithCurvature('lida', 'shchuchin', 'primary', 90, -1);
addEdgeWithCurvature('shchuchin', 'grodno', 'primary', 90, 1);
addEdgeWithCurvature('lida', 'ivye', 'secondary', 80, -1);
addEdgeWithCurvature('ivye', 'volozhin', 'secondary', 80, 1);
addEdgeWithCurvature('volozhin', 'minsk', 'primary', 90, -1);
addEdgeWithCurvature('molodechno', 'smorgon', 'primary', 90, 1);
addEdgeWithCurvature('smorgon', 'oshmiany', 'secondary', 80, -1);

addEdgeWithCurvature('baranovichi', 'lyakhovichi', 'secondary', 80, 1);
addEdgeWithCurvature('lyakhovichi', 'gantsevichi', 'secondary', 80, -1);
addEdgeWithCurvature('gantsevichi', 'luninets', 'secondary', 80, 1);
addEdgeWithCurvature('luninets', 'pinsk', 'primary', 90, -1);
addEdgeWithCurvature('pinsk', 'drogichin', 'primary', 90, 1);
addEdgeWithCurvature('drogichin', 'ivanovo', 'primary', 90, -1);
addEdgeWithCurvature('ivanovo', 'kobrin', 'primary', 90, 1);
addEdgeWithCurvature('pinsk', 'stolin', 'secondary', 80, -1);

addEdgeWithCurvature('mozyr', 'kalinkovichi', 'primary', 80, 1);
addEdgeWithCurvature('kalinkovichi', 'rechitsa', 'primary', 90, -1);
addEdgeWithCurvature('kalinkovichi', 'petrikov', 'secondary', 80, 1);
addEdgeWithCurvature('petrikov', 'zhitkovichi', 'secondary', 80, -1);
addEdgeWithCurvature('zhlobin', 'rogachev', 'primary', 90, 1);
addEdgeWithCurvature('rogachev', 'bykhov', 'primary', 90, -1);
addEdgeWithCurvature('bykhov', 'mogilev', 'primary', 90, 1);
addEdgeWithCurvature('gomel', 'dobrush', 'primary', 90, -1);
addEdgeWithCurvature('mogilev', 'gorki', 'primary', 90, 1);
addEdgeWithCurvature('gorki', 'orsha', 'primary', 90, -1);
addEdgeWithCurvature('krichev', 'klimovichi', 'secondary', 80, 1);
addEdgeWithCurvature('krichev', 'mogilev', 'primary', 90, -1);

places.forEach(p => {
  const node = nodeMap.get(p.id);
  if (node) {
    p.nodeId = node.id;
  }
});

const graphData = {
  version: '1.1.0',
  country: 'Belarus',
  nodeCount: allNodes.length,
  edgeCount: edges.length,
  nodes: allNodes,
  edges: edges
};

const outputGraphPath = path.join(__dirname, '..', 'src-tauri', 'assets', 'belarus_graph.json');
const outputPlacesPath = path.join(__dirname, '..', 'src-tauri', 'assets', 'belarus_places.json');

fs.writeFileSync(outputGraphPath, JSON.stringify(graphData, null, 2), 'utf8');
fs.writeFileSync(outputPlacesPath, JSON.stringify(places, null, 2), 'utf8');

const publicPlacesPath = path.join(__dirname, '..', 'public', 'assets', 'belarus_places.json');
const publicAssetsDir = path.dirname(publicPlacesPath);
if (!fs.existsSync(publicAssetsDir)) {
  fs.mkdirSync(publicAssetsDir, { recursive: true });
}
fs.writeFileSync(publicPlacesPath, JSON.stringify(places, null, 2), 'utf8');
