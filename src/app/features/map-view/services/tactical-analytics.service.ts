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
  readonly observerHeightM = signal<number>(1.8);
  readonly targetHeightM = signal<number>(2.0);
  readonly maxRadiusM = signal<number>(3000);
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
              'fill-opacity': 0.35
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
              'fill-opacity': 0.30
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

  setObserverHeight(heightM: number) {
    this.observerHeightM.set(Math.max(0.1, heightM));
  }

  setTargetHeight(heightM: number) {
    this.targetHeightM.set(Math.max(0.0, heightM));
  }

  setMaxRadius(radiusM: number) {
    this.maxRadiusM.set(Math.max(100, radiusM));
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
      
      features.push({
        type: 'Feature',
        properties: { color: ring.color },
        geometry: {
          type: 'LineString',
          coordinates: circleCoords
        }
      });

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

  private async calculateAndRenderViewshed(center: [number, number], map: maplibregl.Map) {
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource('viewshed-data') as maplibregl.GeoJSONSource;
    if (!source) return;

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const viewshedGeoJson = await invoke<any>('calculate_viewshed', {
        center,
        observer_height_m: this.observerHeightM(),
        observerHeightM: this.observerHeightM(),
        target_height_m: this.targetHeightM(),
        targetHeightM: this.targetHeightM(),
        max_radius_m: this.maxRadiusM(),
        maxRadiusM: this.maxRadiusM(),
        num_rays: 180,
        numRays: 180,
        steps_per_ray: 30,
        stepsPerRay: 30,
      });
      if (viewshedGeoJson && viewshedGeoJson.features) {
        source.setData(viewshedGeoJson);
        return;
      }
    } catch {}

    const baseElev = this.terrainService.getElevationAt(center[0], center[1]) || 150;
    const obsTotalElev = baseElev + this.observerHeightM();
    const targetH = this.targetHeightM();
    const maxRadius = this.maxRadiusM();

    const numRays = 180;
    const stepsPerRay = 30;

    const features: any[] = [];

    for (let r = 0; r < numRays; r++) {
      const angle1 = r * (360 / numRays);
      const angle2 = (r + 1) * (360 / numRays);
      const midAngle = (angle1 + angle2) / 2;

      let maxSlope = -Infinity;

      for (let s = 1; s <= stepsPerRay; s++) {
        const d1 = ((s - 1) / stepsPerRay) * maxRadius;
        const d2 = (s / stepsPerRay) * maxRadius;

        const ptMid = this.destinationPoint(center, d2, midAngle);
        const ptElev = this.terrainService.getElevationAt(ptMid[0], ptMid[1]) || 150;
        const targetTotalElev = ptElev + targetH;

        const slope = (targetTotalElev - obsTotalElev) / d2;
        const isVisible = (slope >= maxSlope);

        if (slope > maxSlope) {
          maxSlope = slope;
        }

        const p1 = d1 === 0 ? center : this.destinationPoint(center, d1, angle1);
        const p2 = this.destinationPoint(center, d2, angle1);
        const p3 = this.destinationPoint(center, d2, angle2);
        const p4 = d1 === 0 ? center : this.destinationPoint(center, d1, angle2);

        features.push({
          type: 'Feature',
          properties: { status: isVisible ? 'visible' : 'hidden' },
          geometry: {
            type: 'Polygon',
            coordinates: [[p1, p2, p3, p4, p1]]
          }
        });
      }
    }

    source.setData({
      type: 'FeatureCollection',
      features
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
