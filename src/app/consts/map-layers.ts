export const mapLayers = [
  {
    id: 'background',
    type: 'background',
    paint: {
      'background-color': '#eef3e8'
    }
  },
  {
    id: 'hillshade_layer',
    type: 'hillshade',
    source: 'terrain-source',
    layout: {
      visibility: 'visible'
    },
    paint: {
      'hillshade-exaggeration': 0.85,
      'hillshade-shadow-color': '#1e293b',
      'hillshade-highlight-color': '#ffffff',
      'hillshade-accent-color': '#0f172a',
      'hillshade-illumination-direction': 315,
      'hillshade-illumination-anchor': 'viewport'
    }
  },
  {
    id: 'landcover_grass',
    type: 'fill',
    source: 'belarus-data',
    'source-layer': 'landcover',
    filter: ['match', ['get', 'class'], ['grass', 'meadow'], true, false],
    paint: {
      'fill-color': '#cce7b8',
      'fill-opacity': 0.45
    }
  },
  {
    id: 'landcover_wood',
    type: 'fill',
    source: 'belarus-data',
    'source-layer': 'landcover',
    filter: ['match', ['get', 'class'], ['wood', 'forest'], true, false],
    paint: {
      'fill-color': '#8ebf74',
      'fill-opacity': 0.65
    }
  },
  {
    id: 'landuse_wood',
    type: 'fill',
    source: 'belarus-data',
    'source-layer': 'landuse',
    filter: ['match', ['get', 'class'], ['wood', 'forest'], true, false],
    paint: {
      'fill-color': '#8ebf74',
      'fill-opacity': 0.65
    }
  },
  {
    id: 'landuse_residential',
    type: 'fill',
    source: 'belarus-data',
    'source-layer': 'landuse',
    filter: ['match', ['get', 'class'], ['residential', 'industrial', 'commercial'], true, false],
    paint: {
      'fill-color': '#e0dcd5',
      'fill-opacity': 0.55
    }
  },
  {
    id: 'park',
    type: 'fill',
    source: 'belarus-data',
    'source-layer': 'park',
    paint: {
      'fill-color': '#b8e29a',
      'fill-opacity': 0.5
    }
  },
  {
    id: 'water',
    type: 'fill',
    source: 'belarus-data',
    'source-layer': 'water',
    paint: {
      'fill-color': '#4a99dd'
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
      'line-color': '#3b82f6',
      'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.2, 14, 3.5]
    }
  },
  {
    id: 'aeroway',
    type: 'line',
    source: 'belarus-data',
    'source-layer': 'aeroway',
    filter: ['match', ['get', 'class'], ['runway', 'taxiway'], true, false],
    paint: {
      'line-color': '#c2c8d0',
      'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2, 14, 10]
    }
  },
  {
    id: 'boundary_country_halo',
    type: 'line',
    source: 'belarus-data',
    'source-layer': 'boundary',
    filter: ['match', ['get', 'admin_level'], [2], true, false],
    layout: {
      'line-join': 'round',
      'line-cap': 'round'
    },
    paint: {
      'line-color': '#be123c',
      'line-width': ['interpolate', ['linear'], ['zoom'], 4, 3, 8, 7, 12, 11, 15, 14],
      'line-opacity': 0.28,
      'line-blur': ['interpolate', ['linear'], ['zoom'], 4, 1, 8, 2, 12, 3]
    }
  },
  {
    id: 'boundary_country',
    type: 'line',
    source: 'belarus-data',
    'source-layer': 'boundary',
    filter: ['match', ['get', 'admin_level'], [2], true, false],
    layout: {
      'line-join': 'round',
      'line-cap': 'round'
    },
    paint: {
      'line-color': '#881337',
      'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1.8, 8, 2.8, 12, 3.8, 15, 4.8],
      'line-dasharray': [6, 2.5, 1.5, 2.5]
    }
  },
  {
    id: 'boundary_region',
    type: 'line',
    source: 'belarus-data',
    'source-layer': 'boundary',
    filter: ['match', ['get', 'admin_level'], [4, 6], true, false],
    layout: {
      'line-join': 'round'
    },
    paint: {
      'line-color': '#475569',
      'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.0, 10, 1.8, 14, 2.5],
      'line-dasharray': [4, 3],
      'line-opacity': 0.85
    }
  },
  {
    id: 'transportation_rail',
    type: 'line',
    source: 'belarus-data',
    'source-layer': 'transportation',
    filter: ['match', ['get', 'class'], ['rail', 'transit'], true, false],
    paint: {
      'line-color': '#78716c',
      'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.2, 14, 2.2],
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
      'line-color': '#b0a69a',
      'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.7, 15, 1.8],
      'line-dasharray': [2, 2]
    }
  },
  {
    id: 'roads_minor_casing',
    type: 'line',
    source: 'belarus-data',
    'source-layer': 'transportation',
    filter: ['match', ['get', 'class'], ['minor', 'service'], true, false],
    layout: {
      'line-cap': 'round',
      'line-join': 'round'
    },
    paint: {
      'line-color': '#cbd5e1',
      'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.6, 15, 4.0]
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
      'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.8, 15, 2.6]
    }
  },
  {
    id: 'roads_major_casing',
    type: 'line',
    source: 'belarus-data',
    'source-layer': 'transportation',
    filter: ['match', ['get', 'class'], ['primary', 'secondary', 'tertiary', 'trunk', 'motorway'], true, false],
    layout: {
      'line-cap': 'round',
      'line-join': 'round'
    },
    paint: {
      'line-color': '#b45309',
      'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.6, 15, 5.5]
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
      'line-color': '#f59e0b',
      'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.0, 15, 4.0]
    }
  },
  {
    id: 'buildings',
    type: 'fill',
    source: 'belarus-data',
    'source-layer': 'building',
    paint: {
      'fill-color': '#d1cbc4',
      'fill-outline-color': '#b5aea5',
      'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 14, 0.85]
    }
  },
  {
    id: '3d_buildings',
    type: 'fill-extrusion',
    source: 'belarus-data',
    'source-layer': 'building',
    minzoom: 13,
    layout: {
      visibility: 'visible'
    },
    paint: {
      'fill-extrusion-color': [
        'interpolate',
        ['linear'],
        ['coalesce', ['get', 'render_height'], ['*', ['coalesce', ['get', 'levels'], 1], 3.2], 8],
        0, '#f1f5f9',
        15, '#e2e8f0',
        35, '#cbd5e1',
        70, '#94a3b8'
      ],
      'fill-extrusion-height': [
        'interpolate',
        ['linear'],
        ['zoom'],
        13, 0,
        14.5,
        ['coalesce', ['get', 'render_height'], ['*', ['coalesce', ['get', 'levels'], 1], 3.2], 6]
      ],
      'fill-extrusion-base': [
        'coalesce',
        ['get', 'render_min_height'],
        ['get', 'min_height'],
        0
      ],
      'fill-extrusion-opacity': 0.88
    }
  },
  {
    id: 'water_labels',
    type: 'symbol',
    source: 'belarus-data',
    'source-layer': 'water_name',
    layout: {
      'text-field': ['coalesce', ['get', 'name:ru'], ['get', 'name']],
      'text-size': 9.5
    },
    paint: {
      'text-color': '#1d4ed8',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.6
    }
  },
  {
    id: 'waterway_labels',
    type: 'symbol',
    source: 'belarus-data',
    'source-layer': 'waterway',
    layout: {
      'text-field': ['coalesce', ['get', 'name:ru'], ['get', 'name']],
      'text-size': 9.5,
      'symbol-placement': 'line'
    },
    paint: {
      'text-color': '#1d4ed8',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.6
    }
  },
  {
    id: 'transportation_labels',
    type: 'symbol',
    source: 'belarus-data',
    'source-layer': 'transportation_name',
    layout: {
      'text-field': ['coalesce', ['get', 'name:ru'], ['get', 'name']],
      'text-size': 8.5,
      'symbol-placement': 'line'
    },
    paint: {
      'text-color': '#334155',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.2
    }
  },
  {
    id: 'poi_labels',
    type: 'symbol',
    source: 'belarus-data',
    'source-layer': 'poi',
    layout: {
      'text-field': ['coalesce', ['get', 'name:ru'], ['get', 'name']],
      'text-size': 8.5
    },
    paint: {
      'text-color': '#475569',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.2
    }
  },
  {
    id: 'aerodrome_labels',
    type: 'symbol',
    source: 'belarus-data',
    'source-layer': 'aerodrome_label',
    layout: {
      'text-field': ['coalesce', ['get', 'name:ru'], ['get', 'name']],
      'text-size': 8.5
    },
    paint: {
      'text-color': '#4f46e5',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.2
    }
  },
  {
    id: 'housenumber_labels',
    type: 'symbol',
    source: 'belarus-data',
    'source-layer': 'housenumber',
    layout: {
      'text-field': ['get', 'housenumber'],
      'text-size': 7.5
    },
    paint: {
      'text-color': '#64748b',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1
    }
  },
  {
    id: 'contour_line',
    type: 'line',
    source: 'contours-source',
    layout: {
      visibility: 'visible',
      'line-join': 'round',
      'line-cap': 'round'
    },
    paint: {
      'line-color': '#78350f',
      'line-width': [
        'match',
        ['get', 'ele'],
        [100, 150, 200, 250, 300, 350],
        1.6,
        0.85
      ],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.65, 11, 0.95]
    }
  },
  {
    id: 'contour_label',
    type: 'symbol',
    source: 'contours-source',
    layout: {
      visibility: 'visible',
      'symbol-placement': 'line',
      'text-field': ['concat', ['to-string', ['get', 'ele']], 'м'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 10, 9.5, 14, 11.5],
      'text-max-angle': 30
    },
    paint: {
      'text-color': '#78350f',
      'text-halo-color': '#ffffff',
      'text-halo-width': 2.2
    }
  },
  {
    id: 'mountain_peak_labels',
    type: 'symbol',
    source: 'belarus-data',
    'source-layer': 'mountain_peak',
    layout: {
      'text-field': ['concat', ['coalesce', ['get', 'name:ru'], ['get', 'name']], ' ', ['to-string', ['get', 'ele']], 'м'],
      'text-size': 9
    },
    paint: {
      'text-color': '#78350f',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.8
    }
  },
  {
    id: 'place_labels',
    type: 'symbol',
    source: 'belarus-data',
    'source-layer': 'place',
    layout: {
      'text-field': ['coalesce', ['get', 'name:ru'], ['get', 'name']],
      'text-size': ['interpolate', ['linear'], ['zoom'], 5, 8.5, 10, 11.5, 14, 14.5]
    },
    paint: {
      'text-color': '#0f172a',
      'text-halo-color': '#ffffff',
      'text-halo-width': 2.0
    }
  }
];
