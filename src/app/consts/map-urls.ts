export const mapsUrls: Record<string, { name: string; url: string; type: 'vector' | 'raster' | 'xyz' }> = {
  map1: {
    name: 'Схема (Оффлайн)',
    url: 'http://topos.localhost/belarus.pmtiles',
    type: 'vector'
  },
  map2: {
    name: 'Топокарта (Оффлайн)',
    url: 'http://topos.localhost/belarus_topomap_200K.pmtiles',
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
  }
};
