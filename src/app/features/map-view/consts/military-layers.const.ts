import { SourceSpecification, LayerSpecification } from 'maplibre-gl';

export const MILITARY_SOURCE_ID = 'military-objects';

export const MILITARY_SOURCE_SPEC: SourceSpecification = {
  type: 'geojson',
  data: 'military.geojson'
};

export const MILITARY_LAYERS: LayerSpecification[] = [
  {
    id: 'military-fill',
    type: 'fill',
    source: MILITARY_SOURCE_ID,
    filter: ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false],
    paint: {
      'fill-color': '#ff0000',
      'fill-opacity': 0.25
    }
  },
  {
    id: 'military-outline',
    type: 'line',
    source: MILITARY_SOURCE_ID,
    paint: {
      'line-color': '#ff0000',
      'line-width': 2,
      'line-dasharray': [3, 3]
    }
  },
  {
    id: 'military-labels',
    type: 'symbol',
    source: MILITARY_SOURCE_ID,
    layout: {
      'text-field': ['coalesce', ['get', 'name:ru'], ['get', 'name']],
      'text-size': ['interpolate', ['linear'], ['zoom'], 5, 8, 10, 11, 14, 14]
    },
    paint: {
      'text-color': '#ff0000',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.5
    }
  }
] as LayerSpecification[];
