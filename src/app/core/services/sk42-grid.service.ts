import { Injectable, inject, signal } from '@angular/core';
import maplibregl from 'maplibre-gl';
import { CoordinateConverterService } from './coordinate-converter.service';

@Injectable({
  providedIn: 'root'
})
export class Sk42GridService {
  private readonly coordConverter: CoordinateConverterService;
  readonly isGridVisible = signal<boolean>(false);
  private mapInstance: maplibregl.Map | null = null;
  private moveListener: (() => void) | null = null;

  constructor() {
    try {
      this.coordConverter = inject(CoordinateConverterService, { optional: true }) || new CoordinateConverterService();
    } catch {
      this.coordConverter = new CoordinateConverterService();
    }
  }

  init(map: maplibregl.Map) {
    this.mapInstance = map;
    this.ensureLayers(map);

    if (this.moveListener && this.mapInstance) {
      this.mapInstance.off('moveend', this.moveListener);
    }

    this.moveListener = () => {
      if (this.isGridVisible() && this.mapInstance) {
        this.updateGrid(this.mapInstance);
      }
    };

    map.on('moveend', this.moveListener);

    if (this.isGridVisible()) {
      this.updateGrid(map);
    }
  }

  toggleGrid(map?: maplibregl.Map) {
    const targetMap = map || this.mapInstance;
    const newState = !this.isGridVisible();
    this.isGridVisible.set(newState);

    if (!targetMap) return;

    if (newState) {
      this.ensureLayers(targetMap);
      this.updateGrid(targetMap);
      if (targetMap.getLayer('sk42-grid-lines')) {
        targetMap.setLayoutProperty('sk42-grid-lines', 'visibility', 'visible');
      }
      if (targetMap.getLayer('sk42-grid-labels')) {
        targetMap.setLayoutProperty('sk42-grid-labels', 'visibility', 'visible');
      }
    } else {
      if (targetMap.getLayer('sk42-grid-lines')) {
        targetMap.setLayoutProperty('sk42-grid-lines', 'visibility', 'none');
      }
      if (targetMap.getLayer('sk42-grid-labels')) {
        targetMap.setLayoutProperty('sk42-grid-labels', 'visibility', 'none');
      }
    }
  }

  private ensureLayers(map: maplibregl.Map) {
    try {
      if (!map.getStyle()) return;

      if (!map.getSource('sk42-grid-source')) {
        map.addSource('sk42-grid-source', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: []
          }
        });
      }

      if (!map.getLayer('sk42-grid-lines')) {
        map.addLayer({
          id: 'sk42-grid-lines',
          type: 'line',
          source: 'sk42-grid-source',
          filter: ['==', '$type', 'LineString'],
          layout: {
            visibility: this.isGridVisible() ? 'visible' : 'none'
          },
          paint: {
            'line-color': '#475569',
            'line-width': [
              'case',
              ['get', 'isMajor'], 1.4,
              0.8
            ],
            'line-opacity': 0.55,
            'line-dasharray': [
              'case',
              ['get', 'isMajor'], ['literal', [1, 0]],
              ['literal', [3, 2]]
            ]
          }
        });
      }

      if (!map.getLayer('sk42-grid-labels')) {
        map.addLayer({
          id: 'sk42-grid-labels',
          type: 'symbol',
          source: 'sk42-grid-source',
          filter: ['==', '$type', 'Point'],
          layout: {
            visibility: this.isGridVisible() ? 'visible' : 'none',
            'text-field': ['get', 'label'],
            'text-size': 11,
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-anchor': 'center',
            'text-offset': [0, 0],
            'text-allow-overlap': true,
            'text-ignore-placement': true
          },
          paint: {
            'text-color': '#1e293b',
            'text-halo-color': '#ffffff',
            'text-halo-width': 2
          }
        });
      }
    } catch (e) {
      console.error(e);
    }
  }

  updateGrid(map: maplibregl.Map) {
    try {
      if (!map.getStyle() || !this.isGridVisible()) return;
      this.ensureLayers(map);

      const source = map.getSource('sk42-grid-source') as maplibregl.GeoJSONSource;
      if (!source) return;

      const bounds = map.getBounds();
      const zoom = map.getZoom();

      if (zoom < 7.5) {
        source.setData({ type: 'FeatureCollection', features: [] });
        return;
      }

      let stepMeters = 10000;
      if (zoom >= 13) {
        stepMeters = 1000;
      } else if (zoom >= 11) {
        stepMeters = 2000;
      } else if (zoom >= 9) {
        stepMeters = 5000;
      }

      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      const nw = bounds.getNorthWest();
      const se = bounds.getSouthEast();

      const gkSW = this.coordConverter.wgs84ToGaussKruger(sw.lat, sw.lng);
      const gkW = this.coordConverter.wgs84ToGaussKruger(ne.lat, ne.lng);
      const gkNW = this.coordConverter.wgs84ToGaussKruger(nw.lat, nw.lng);
      const gkSE = this.coordConverter.wgs84ToGaussKruger(se.lat, se.lng);

      const minX = Math.min(gkSW.x, gkW.x, gkNW.x, gkSE.x) - stepMeters;
      const maxX = Math.max(gkSW.x, gkW.x, gkNW.x, gkSE.x) + stepMeters;
      const minY = Math.min(gkSW.y, gkW.y, gkNW.y, gkSE.y) - stepMeters;
      const maxY = Math.max(gkSW.y, gkW.y, gkNW.y, gkSE.y) + stepMeters;

      const zone = gkSW.zone;

      const startX = Math.floor(minX / stepMeters) * stepMeters;
      const endX = Math.ceil(maxX / stepMeters) * stepMeters;
      const startY = Math.floor(minY / stepMeters) * stepMeters;
      const endY = Math.ceil(maxY / stepMeters) * stepMeters;

      const features: any[] = [];

      for (let x = startX; x <= endX; x += stepMeters) {
        const lineCoords: [number, number][] = [];
        const numSamples = 8;
        const yStepSample = (endY - startY) / numSamples;
        for (let s = 0; s <= numSamples; s++) {
          const sampleY = startY + s * yStepSample;
          const wgs = this.coordConverter.gaussKrugerToWgs84(x, sampleY, zone);
          lineCoords.push([wgs.lon, wgs.lat]);
        }

        const kmVal = Math.floor(x / 1000);
        const isMajor = kmVal % 10 === 0;

        features.push({
          type: 'Feature',
          properties: {
            isMajor,
            gridType: 'X',
            km: kmVal
          },
          geometry: {
            type: 'LineString',
            coordinates: lineCoords
          }
        });

        const midY = (startY + endY) / 2;
        const labelWgs = this.coordConverter.gaussKrugerToWgs84(x, midY, zone);
        const labelText = String(kmVal % 100).padStart(2, '0');

        features.push({
          type: 'Feature',
          properties: {
            label: labelText,
            fullKm: kmVal
          },
          geometry: {
            type: 'Point',
            coordinates: [labelWgs.lon, labelWgs.lat]
          }
        });
      }

      for (let y = startY; y <= endY; y += stepMeters) {
        const lineCoords: [number, number][] = [];
        const numSamples = 8;
        const xStepSample = (endX - startX) / numSamples;
        for (let s = 0; s <= numSamples; s++) {
          const sampleX = startX + s * xStepSample;
          const wgs = this.coordConverter.gaussKrugerToWgs84(sampleX, y, zone);
          lineCoords.push([wgs.lon, wgs.lat]);
        }

        const kmVal = Math.floor(y / 1000);
        const isMajor = kmVal % 10 === 0;

        features.push({
          type: 'Feature',
          properties: {
            isMajor,
            gridType: 'Y',
            km: kmVal
          },
          geometry: {
            type: 'LineString',
            coordinates: lineCoords
          }
        });

        const midX = (startX + endX) / 2;
        const labelWgs = this.coordConverter.gaussKrugerToWgs84(midX, y, zone);
        const labelText = String(kmVal % 100).padStart(2, '0');

        features.push({
          type: 'Feature',
          properties: {
            label: labelText,
            fullKm: kmVal
          },
          geometry: {
            type: 'Point',
            coordinates: [labelWgs.lon, labelWgs.lat]
          }
        });
      }

      source.setData({
        type: 'FeatureCollection',
        features
      });
    } catch (e) {
      console.error(e);
    }
  }
}
