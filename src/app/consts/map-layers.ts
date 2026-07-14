export const mapLayers = [
  {
    id: 'background',
    type: 'background',
    paint: {
      'background-color': '#f8f9fa'
    }
  },
  {
    id: 'water',
    type: 'fill',
    source: 'belarus-data',
    'source-layer': 'water',
    paint: {
      'fill-color': '#a0c8f0'
    }
  },
  {
    id: 'landuse_forest',
    type: 'fill',
    source: 'belarus-data',
    'source-layer': 'landuse',
    filter: ['==', ['get', 'class'], 'wood'],
    paint: {
      'fill-color': '#d4eac7',
      'fill-opacity': 0.6
    }
  },
  {
    id: 'roads_minor',
    type: 'line',
    source: 'belarus-data',
    'source-layer': 'transportation',
    filter: ['in', ['get', 'class'], 'minor', 'service', 'track'],
    layout: {
      'line-cap': 'round',
      'line-join': 'round'
    },
    paint: {
      'line-color': '#ffffff',
      'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 15, 4]
    }
  },
  {
    id: 'roads_major',
    type: 'line',
    source: 'belarus-data',
    'source-layer': 'transportation',
    filter: ['in', ['get', 'class'], 'primary', 'secondary', 'tertiary', 'trunk', 'motorway'],
    layout: {
      'line-cap': 'round',
      'line-join': 'round'
    },
    paint: {
      'line-color': '#ffcc80',
      'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.5, 15, 6]
    }
  },
  {
    id: 'buildings',
    type: 'fill',
    source: 'belarus-data',
    'source-layer': 'building',
    paint: {
      'fill-color': '#dcdcdc',
      'fill-outline-color': '#b0b0b0',
      'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 14, 0.8]
    }
  },
  {
    id: 'place_labels',
    type: 'symbol',
    source: 'belarus-data',
    'source-layer': 'place',
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 8, 10, 14, 16]
    },
    paint: {
      'text-color': '#2d3436',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.5
    }
  }
];
