import { Injectable, signal, inject } from '@angular/core';
import maplibregl from 'maplibre-gl';
import { TerrainService } from './terrain.service';

export interface RangeRing {
  radiusMeters: number;
  label: string;
  color: string;
}

@Injectable({
  providedIn: 'root'
})
export class TacticalAnalyticsService {
  private readonly terrainService = inject(TerrainService);

  readonly isRangeRingsActive = signal<boolean>(false);
  readonly isViewshedActive = signal<boolean>(false);
  readonly observerHeightM = signal<number>(10);
  readonly rangeRingsCenter = signal<[number, number] | null>(null);

  readonly defaultRings: RangeRing[] = [
    { radiusMeters: 500, label: '500 м', color: '#10b981' },
    { radiusMeters: 1000, label: '1 км', color: '#3b82f6' },
    { radiusMeters: 3000, label: '3 км', color: '#f59e0b' },
    { radiusMeters: 5000, label: '5 км', color: '#ef4444' }
  ];

  initLayers(map: maplibregl.Map) {
    if (!map) return;

    const doInit = () => {
      try {
        if (!map.isStyleLoaded()) return;

        // Range Rings Source
        if (!map.getSource('range-rings-data')) {
          map.addSource('range-rings-data', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
          });
        }

        if (!map.getLayer('range-rings-line')) {
          map.addLayer({
            id: 'range-rings-line',
            type: 'line',
            source: 'range-rings-data',
            filter: ['==', '$type', 'LineString'] as any,
            paint: {
              'line-color': ['get', 'color'],
              'line-width': 2.5,
              'line-dasharray': [4, 2]
            }
          });
        }

        if (!map.getLayer('range-rings-label')) {
          map.addLayer({
            id: 'range-rings-label',
            type: 'symbol',
            source: 'range-rings-data',
            filter: ['==', '$type', 'Point'] as any,
            layout: {
              'text-field': ['get', 'label'],
              'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
              'text-size': 11,
              'text-offset': [0, -0.6],
              'text-anchor': 'bottom',
              'text-allow-overlap': true,
              'text-ignore-placement': true
            },
            paint: {
              'text-color': ['get', 'color'],
              'text-halo-color': '#ffffff',
              'text-halo-width': 2
            }
          });
        }

        // Viewshed Source
        if (!map.getSource('viewshed-data')) {
          map.addSource('viewshed-data', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
          });
        }

        if (!map.getLayer('viewshed-visible-fill')) {
          map.addLayer({
            id: 'viewshed-visible-fill',
            type: 'fill',
            source: 'viewshed-data',
            filter: ['==', ['get', 'status'], 'visible'],
            paint: {
              'fill-color': '#22c55e',
              'fill-opacity': 0.3
            }
          });
        }

        if (!map.getLayer('viewshed-hidden-fill')) {
          map.addLayer({
            id: 'viewshed-hidden-fill',
            type: 'fill',
            source: 'viewshed-data',
            filter: ['==', ['get', 'status'], 'hidden'],
            paint: {
              'fill-color': '#ef4444',
              'fill-opacity': 0.25
            }
          });
        }
      } catch (e) {
        console.warn('Map style loading in progress for TacticalAnalyticsService:', e);
      }
    };

    if (map.isStyleLoaded()) {
      doInit();
    } else {
      map.once('style.load', () => doInit());
      map.once('load', () => doInit());
    }
  }

  toggleRangeRings(center: [number, number] | null, map: maplibregl.Map | null) {
    if (!map) return;
    this.initLayers(map);

    if (this.isRangeRingsActive() && (!center || this.isSameCenter(center, this.rangeRingsCenter()))) {
      this.isRangeRingsActive.set(false);
      this.rangeRingsCenter.set(null);
      this.updateRangeRingsLayer(map, null);
    } else if (center) {
      this.isRangeRingsActive.set(true);
      this.rangeRingsCenter.set(center);
      this.updateRangeRingsLayer(map, center);
    }
  }

  toggleViewshed(center: [number, number] | null, map: maplibregl.Map | null) {
    if (!map) return;
    this.initLayers(map);

    if (this.isViewshedActive()) {
      this.isViewshedActive.set(false);
      this.updateViewshedLayer(map, null);
    } else if (center) {
      this.isViewshedActive.set(true);
      this.calculateAndRenderViewshed(center, map);
    }
  }

  private isSameCenter(c1: [number, number], c2: [number, number] | null): boolean {
    if (!c2) return false;
    return Math.abs(c1[0] - c2[0]) < 0.00001 && Math.abs(c1[1] - c2[1]) < 0.00001;
  }

  private updateRangeRingsLayer(map: maplibregl.Map, center: [number, number] | null) {
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource('range-rings-data') as maplibregl.GeoJSONSource;
    if (!source) return;

    if (!center) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const features: any[] = [];

    this.defaultRings.forEach(ring => {
      const circleCoords = this.createCirclePolygon(center, ring.radiusMeters);
      
      // Line feature for circle
      features.push({
        type: 'Feature',
        properties: { color: ring.color },
        geometry: {
          type: 'LineString',
          coordinates: circleCoords
        }
      });

      // Label feature at top point of ring
      const topPoint = circleCoords[0];
      features.push({
        type: 'Feature',
        properties: { label: ring.label, color: ring.color },
        geometry: {
          type: 'Point',
          coordinates: topPoint
        }
      });
    });

    source.setData({
      type: 'FeatureCollection',
      features
    });
  }

  private calculateAndRenderViewshed(center: [number, number], map: maplibregl.Map) {
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource('viewshed-data') as maplibregl.GeoJSONSource;
    if (!source) return;

    const baseElev = this.terrainService.getElevationAt(center[0], center[1]) || 0;
    const obsElev = baseElev + this.observerHeightM();
    const maxRadius = 3000; // 3 км аналитический радиус
    const numRays = 36; // 10 градусов на луч
    const stepsPerRay = 15;

    const visibleSectors: any[] = [];
    const hiddenSectors: any[] = [];

    for (let r = 0; r < numRays; r++) {
      const angleDeg1 = r * 10;
      const angleDeg2 = (r + 1) * 10;

      let maxSlope = -Infinity;
      let isVisible = true;

      // Анализ луча по серединному азимуту
      const midAngle = (angleDeg1 + angleDeg2) / 2;
      for (let step = 1; step <= stepsPerRay; step++) {
        const dist = (step / stepsPerRay) * maxRadius;
        const pt = this.destinationPoint(center, dist, midAngle);
        const ptElev = this.terrainService.getElevationAt(pt[0], pt[1]) || 0;

        const slope = (ptElev - obsElev) / dist;
        if (slope < maxSlope) {
          isVisible = false;
        } else {
          maxSlope = slope;
        }
      }

      const polyCoords = [
        center,
        this.destinationPoint(center, maxRadius, angleDeg1),
        this.destinationPoint(center, maxRadius, angleDeg2),
        center
      ];

      const feature = {
        type: 'Feature',
        properties: { status: isVisible ? 'visible' : 'hidden' },
        geometry: {
          type: 'Polygon',
          coordinates: [polyCoords]
        }
      };

      if (isVisible) {
        visibleSectors.push(feature);
      } else {
        hiddenSectors.push(feature);
      }
    }

    source.setData({
      type: 'FeatureCollection',
      features: [...visibleSectors, ...hiddenSectors]
    });
  }

  private updateViewshedLayer(map: maplibregl.Map, center: [number, number] | null) {
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource('viewshed-data') as maplibregl.GeoJSONSource;
    if (source) {
      source.setData({ type: 'FeatureCollection', features: [] });
    }
  }

  private createCirclePolygon(center: [number, number], radiusMeters: number, numPoints = 64): [number, number][] {
    const coords: [number, number][] = [];
    for (let i = 0; i <= numPoints; i++) {
      const angle = (i / numPoints) * 360;
      coords.push(this.destinationPoint(center, radiusMeters, angle));
    }
    return coords;
  }

  private destinationPoint(center: [number, number], distanceMeters: number, bearingDeg: number): [number, number] {
    const R = 6378137;
    const brng = bearingDeg * Math.PI / 180;
    const lat1 = center[1] * Math.PI / 180;
    const lon1 = center[0] * Math.PI / 180;
    const d = distanceMeters / R;

    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
    const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));

    return [lon2 * 180 / Math.PI, lat2 * 180 / Math.PI];
  }
}
