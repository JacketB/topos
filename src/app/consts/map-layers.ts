export const mapLayers = [
  {
    id: 'background',
    type: 'background',
    paint: {
      'background-color': '#f5f5f3'
    }
  },
  {
    id: 'landcover_grass',
    type: 'fill',
    source: 'belarus-data',
    'source-layer': 'landcover',
    filter: ['match', ['get', 'class'], ['grass', 'meadow'], true, false],
    paint: {
      'fill-color': '#d4e8c2',
      'fill-opacity': 0.6
    }
  },
  {
    id: 'landcover_wood',
    type: 'fill',
    source: 'belarus-data',
    'source-layer': 'landcover',
    filter: ['match', ['get', 'class'], ['wood', 'forest'], true, false],
    paint: {
      'fill-color': '#b5d29c',
      'fill-opacity': 0.7
    }
  },
  {
    id: 'landuse_wood',
    type: 'fill',
    source: 'belarus-data',
    'source-layer': 'landuse',
    filter: ['match', ['get', 'class'], ['wood', 'forest'], true, false],
    paint: {
      'fill-color': '#b5d29c',
      'fill-opacity': 0.7
    }
  },
  {
    id: 'landuse_residential',
    type: 'fill',
    source: 'belarus-data',
    'source-layer': 'landuse',
    filter: ['match', ['get', 'class'], ['residential', 'industrial', 'commercial'], true, false],
    paint: {
      'fill-color': '#e8e4df',
      'fill-opacity': 0.5
    }
  },
  {
    id: 'park',
    type: 'fill',
    source: 'belarus-data',
    'source-layer': 'park',
    paint: {
      'fill-color': '#c8e6b0',
      'fill-opacity': 0.5
    }
  },
  {
    id: 'water',
    type: 'fill',
    source: 'belarus-data',
    'source-layer': 'water',
    paint: {
      'fill-color': '#a3cef1'
    }
  },
  {
    id: 'waterway',
    type: 'line',
    source: 'belarus-data',
    'source-layer': 'waterway',
    layout: {
      'line-cap': 'round',
      'line-join': 'round'
    },
    paint: {
      'line-color': '#a3cef1',
      'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 14, 3]
    }
  },
  {
    id: 'aeroway',
    type: 'line',
    source: 'belarus-data',
    'source-layer': 'aeroway',
    filter: ['match', ['get', 'class'], ['runway', 'taxiway'], true, false],
    paint: {
      'line-color': '#d0d0d0',
      'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 14, 10]
    }
  },
  {
    id: 'boundary',
    type: 'line',
    source: 'belarus-data',
    'source-layer': 'boundary',
    filter: ['match', ['get', 'admin_level'], [2, 4], true, false],
    layout: {
      'line-join': 'round'
    },
    paint: {
      'line-color': '#9e9e9e',
      'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1, 10, 2],
      'line-dasharray': [3, 2]
    }
  },
  {
    id: 'transportation_rail',
    type: 'line',
    source: 'belarus-data',
    'source-layer': 'transportation',
    filter: ['match', ['get', 'class'], ['rail', 'transit'], true, false],
    paint: {
      'line-color': '#bdbdbd',
      'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 14, 2],
      'line-dasharray': [3, 3]
    }
  },
  {
    id: 'transportation_path',
    type: 'line',
    source: 'belarus-data',
    'source-layer': 'transportation',
    filter: ['match', ['get', 'class'], ['path', 'track'], true, false],
    paint: {
      'line-color': '#c8c0b8',
      'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 15, 1.5],
      'line-dasharray': [2, 2]
    }
  },
  {
    id: 'roads_minor',
    type: 'line',
    source: 'belarus-data',
    'source-layer': 'transportation',
    filter: ['match', ['get', 'class'], ['minor', 'service'], true, false],
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
    filter: ['match', ['get', 'class'], ['primary', 'secondary', 'tertiary', 'trunk', 'motorway'], true, false],
    layout: {
      'line-cap': 'round',
      'line-join': 'round'
    },
    paint: {
      'line-color': '#ffd080',
      'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.5, 15, 6]
    }
  },
  {
    id: 'buildings',
    type: 'fill',
    source: 'belarus-data',
    'source-layer': 'building',
    paint: {
      'fill-color': '#dcd8d2',
      'fill-outline-color': '#c8c0b8',
      'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 14, 0.8]
    }
  },
  {
    id: 'water_labels',
    type: 'symbol',
    source: 'belarus-data',
    'source-layer': 'water_name',
    layout: {
      'text-field': ['coalesce', ['get', 'name:ru'], ['get', 'name']],
      'text-size': 9
    },
    paint: {
      'text-color': '#2b608a',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.2
    }
  },
  {
    id: 'waterway_labels',
    type: 'symbol',
    source: 'belarus-data',
    'source-layer': 'waterway',
    layout: {
      'text-field': ['coalesce', ['get', 'name:ru'], ['get', 'name']],
      'text-size': 9,
      'symbol-placement': 'line'
    },
    paint: {
      'text-color': '#2b608a',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.2
    }
  },
  {
    id: 'transportation_labels',
    type: 'symbol',
    source: 'belarus-data',
    'source-layer': 'transportation_name',
    layout: {
      'text-field': ['coalesce', ['get', 'name:ru'], ['get', 'name']],
      'text-size': 8,
      'symbol-placement': 'line'
    },
    paint: {
      'text-color': '#444444',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1
    }
  },
  {
    id: 'poi_labels',
    type: 'symbol',
    source: 'belarus-data',
    'source-layer': 'poi',
    layout: {
      'text-field': ['coalesce', ['get', 'name:ru'], ['get', 'name']],
      'text-size': 8
    },
    paint: {
      'text-color': '#666666',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1
    }
  },
  {
    id: 'aerodrome_labels',
    type: 'symbol',
    source: 'belarus-data',
    'source-layer': 'aerodrome_label',
    layout: {
      'text-field': ['coalesce', ['get', 'name:ru'], ['get', 'name']],
      'text-size': 8
    },
    paint: {
      'text-color': '#5b5b9a',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1
    }
  },
  {
    id: 'housenumber_labels',
    type: 'symbol',
    source: 'belarus-data',
    'source-layer': 'housenumber',
    layout: {
      'text-field': ['get', 'housenumber'],
      'text-size': 7
    },
    paint: {
      'text-color': '#777777',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1
    }
  },
  {
    id: 'contour_line',
    type: 'line',
    source: 'contours-source',
    layout: {
      visibility: 'none',
      'line-join': 'round',
      'line-cap': 'round'
    },
    paint: {
      'line-color': '#8b5a2b',
      'line-width': [
        'match',
        ['get', 'ele'],
        [150, 180, 210, 240, 270, 300, 330],
        1.2,
        0.65
      ],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.55, 11, 0.88]
    }
  },
  {
    id: 'contour_label',
    type: 'symbol',
    source: 'contours-source',
    layout: {
      visibility: 'none',
      'symbol-placement': 'line',
      'text-field': ['concat', ['to-string', ['get', 'ele']], 'м'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 11, 9, 14, 11],
      'text-max-angle': 30
    },
    paint: {
      'text-color': '#8b5a2b',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.2
    }
  },
  {
    id: 'mountain_peak_labels',
    type: 'symbol',
    source: 'belarus-data',
    'source-layer': 'mountain_peak',
    layout: {
      'text-field': ['concat', ['coalesce', ['get', 'name:ru'], ['get', 'name']], ' ', ['to-string', ['get', 'ele']], 'м'],
      'text-size': 8
    },
    paint: {
      'text-color': '#8b6914',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1
    }
  },
  {
    id: 'place_labels',
    type: 'symbol',
    source: 'belarus-data',
    'source-layer': 'place',
    layout: {
      'text-field': ['coalesce', ['get', 'name:ru'], ['get', 'name']],
      'text-size': ['interpolate', ['linear'], ['zoom'], 5, 8, 10, 11, 14, 14]
    },
    paint: {
      'text-color': '#222222',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.5
    }
  }
];
