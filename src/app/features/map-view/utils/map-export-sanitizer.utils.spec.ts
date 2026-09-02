import { describe, it, expect } from 'vitest';
import { MapExportSanitizerUtils } from './map-export-sanitizer.utils';

describe('MapExportSanitizerUtils', () => {
  it('should calibrate place_labels text size and padding for native export', () => {
    const inputStyle = {
      version: 8,
      sources: {
        'belarus-data': { type: 'vector', url: 'http://topos.localhost/belarus.pmtiles' }
      },
      layers: [
        {
          id: 'place_labels',
          type: 'symbol',
          source: 'belarus-data',
          'source-layer': 'place',
          layout: {
            'text-field': ['get', 'name'],
            'text-size': 12
          },
          paint: {
            'text-color': '#000000'
          }
        }
      ]
    };

    const sanitized96Dpi = MapExportSanitizerUtils.sanitizeStyleForNative(inputStyle, 1.0);
    const placeLayer96 = sanitized96Dpi.layers.find((l: any) => l.id === 'place_labels');
    expect(placeLayer96).toBeDefined();
    expect(placeLayer96.layout['text-size']).toEqual([
      'interpolate', ['linear'], ['zoom'],
      4, 8,
      7, 9,
      10, 11,
      14, 13
    ]);
    expect(placeLayer96.layout['text-padding']).toBe(2);
    expect(placeLayer96.layout['text-allow-overlap']).toBe(false);

    const sanitized600Dpi = MapExportSanitizerUtils.sanitizeStyleForNative(inputStyle, 6.25);
    const placeLayer600 = sanitized600Dpi.layers.find((l: any) => l.id === 'place_labels');
    expect(placeLayer600).toBeDefined();
    expect(placeLayer600.layout['text-size']).toEqual([
      'interpolate', ['linear'], ['zoom'],
      4, 37.5,
      7, 46.875,
      10, 56.25,
      14, 68.75
    ]);
    expect(placeLayer600.layout['text-padding']).toBe(12.5);
  });

  it('should scale generic symbol layers with scaleNumberOrExpr', () => {
    const inputStyle = {
      version: 8,
      sources: {},
      layers: [
        {
          id: 'water_labels',
          type: 'symbol',
          source: 'belarus-data',
          layout: {
            'text-size': 9
          },
          paint: {
            'text-halo-width': 1.5
          }
        }
      ]
    };

    const sanitized = MapExportSanitizerUtils.sanitizeStyleForNative(inputStyle, 2.0);
    const layer = sanitized.layers[0];
    expect(layer.layout['text-size']).toBe(18);
    expect(layer.paint['text-halo-width']).toBe(3);
  });

  it('should suppress place_labels when march-places has active features', () => {
    const inputStyleWithFeatures = {
      version: 8,
      sources: {
        'belarus-data': { type: 'vector', url: 'http://topos.localhost/belarus.pmtiles' },
        'march-places': {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [{ type: 'Feature', properties: { name: 'Озерцо' }, geometry: { type: 'Point', coordinates: [27.5, 53.9] } }]
          }
        }
      },
      layers: [
        {
          id: 'place_labels',
          type: 'symbol',
          source: 'belarus-data',
          'source-layer': 'place',
          layout: { 'text-field': ['get', 'name'], 'text-size': 12 }
        }
      ]
    };

    const sanitizedWith = MapExportSanitizerUtils.sanitizeStyleForNative(inputStyleWithFeatures, 1.0);
    const placeLayerWith = sanitizedWith.layers.find((l: any) => l.id === 'place_labels');
    expect(placeLayerWith.layout['visibility']).toBe('none');

    const inputStyleEmpty = {
      version: 8,
      sources: {
        'belarus-data': { type: 'vector', url: 'http://topos.localhost/belarus.pmtiles' },
        'march-places': { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }
      },
      layers: [
        {
          id: 'place_labels',
          type: 'symbol',
          source: 'belarus-data',
          'source-layer': 'place',
          layout: { 'text-field': ['get', 'name'], 'text-size': 12 }
        }
      ]
    };

    const sanitizedEmpty = MapExportSanitizerUtils.sanitizeStyleForNative(inputStyleEmpty, 1.0);
    const placeLayerEmpty = sanitizedEmpty.layers.find((l: any) => l.id === 'place_labels');
    expect(placeLayerEmpty.layout['visibility']).toBeUndefined();
  });
});
