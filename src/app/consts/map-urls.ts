export const mapsUrls: Record<string, { name: string; url: string; type: 'vector' | 'raster' | 'xyz' }> = {
  map1: {
    name: 'Схема (Оффлайн)',
    url: 'http://topos.localhost/belarus.pmtiles',
    type: 'vector'
  },
  map2: {
    name: 'Топокарта (Оффлайн)',
    url: 'http://topos.localhost/belarus_topomap_200k.pmtiles',
    type: 'raster'
  },
  map3: {
    name: 'Спутник Google',
    url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    type: 'xyz'
  },
  map4: {
    name: 'Гибрид Google',
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    type: 'xyz'
  },
  map5: {
    name: 'Спутник Bing',
    url: 'https://ecn.t0.tiles.virtualearth.net/tiles/a{quadkey}.jpeg?g=1',
    type: 'xyz'
  }
};
