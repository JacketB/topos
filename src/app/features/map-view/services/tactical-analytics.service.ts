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
  readonly viewshedCenter = signal<[number, number] | null>(null);
  readonly isCalculatingViewshed = signal<boolean>(false);

  readonly defaultRings: RangeRing[] = [
    { radiusMeters: 500, label: '500 м', color: '#10b981' },
    { radiusMeters: 1000, label: '1 км', color: '#3b82f6' },
    { radiusMeters: 3000, label: '3 км', color: '#f59e0b' },
    { radiusMeters: 5000, label: '5 км', color: '#ef4444' }
  ];

  private map: maplibregl.Map | null = null;
  private hasBoundMapEvents = false;
  private moveEndDebounceTimer: any = null;
  private rangeRingsRaf: number | null = null;
  private viewshedReqId = 0;

  initLayers(map: maplibregl.Map) {
    if (!map) return;
    this.map = map;
    this.bindMapEvents(map);

    const doInit = () => {
      try {
        if (!map.getStyle()) return;

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

        if (!map.getLayer('viewshed-center')) {
          map.addLayer({
            id: 'viewshed-center',
            type: 'circle',
            source: 'viewshed-data',
            filter: ['==', ['get', 'isCenter'], true],
            paint: {
              'circle-radius': 4.5,
              'circle-color': '#0284c7',
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff'
            }
          });
        }

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
            filter: ['all', ['==', '$type', 'Point'], ['has', 'label']] as any,
            layout: {
              'text-field': ['get', 'label'],
              'text-font': ['Noto Sans Regular'],
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

        if (!map.getLayer('range-rings-center')) {
          map.addLayer({
            id: 'range-rings-center',
            type: 'circle',
            source: 'range-rings-data',
            filter: ['==', ['get', 'isCenter'], true],
            paint: {
              'circle-radius': 4.5,
              'circle-color': '#2563eb',
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff'
            }
          });
        }

        if (this.isRangeRingsActive() && this.rangeRingsCenter()) {
          this.updateRangeRingsLayer(map, this.rangeRingsCenter());
        }
        if (this.isViewshedActive() && this.viewshedCenter()) {
          this.calculateAndRenderViewshed(this.viewshedCenter()!, map);
        }
      } catch (e) {
      }
    };

    if (map.isStyleLoaded() || map.getStyle()) {
      doInit();
    } else {
      map.once('style.load', () => doInit());
      map.once('load', () => doInit());
    }
  }

  private bindMapEvents(map: maplibregl.Map) {
    if (this.hasBoundMapEvents) return;
    this.hasBoundMapEvents = true;

    map.on('move', () => {
      if (!this.isRangeRingsActive() || !this.map) return;
      if (this.rangeRingsRaf !== null) return;

      this.rangeRingsRaf = requestAnimationFrame(() => {
        this.rangeRingsRaf = null;
        if (!this.isRangeRingsActive() || !this.map) return;
        const c = this.map.getCenter();
        const center: [number, number] = [c.lng, c.lat];
        this.rangeRingsCenter.set(center);
        this.updateRangeRingsLayer(this.map, center);
      });
    });

    map.on('moveend', () => {
      if (!this.map) return;

      if (this.isRangeRingsActive()) {
        const c = this.map.getCenter();
        const center: [number, number] = [c.lng, c.lat];
        this.rangeRingsCenter.set(center);
        this.updateRangeRingsLayer(this.map, center);
      }

      if (this.isViewshedActive()) {
        if (this.moveEndDebounceTimer) {
          clearTimeout(this.moveEndDebounceTimer);
        }

        this.moveEndDebounceTimer = setTimeout(() => {
          if (!this.isViewshedActive() || !this.map) return;
          const c = this.map.getCenter();
          const center: [number, number] = [c.lng, c.lat];
          this.viewshedCenter.set(center);
          this.calculateAndRenderViewshed(center, this.map);
        }, 150);
      }
    });
  }

  recalculateForScreenCenter() {
    if (!this.map) return;
    const centerObj = this.map.getCenter();
    const center: [number, number] = [centerObj.lng, centerObj.lat];

    if (this.isRangeRingsActive()) {
      this.rangeRingsCenter.set(center);
      this.updateRangeRingsLayer(this.map, center);
    }

    if (this.isViewshedActive()) {
      this.viewshedCenter.set(center);
      this.calculateAndRenderViewshed(center, this.map);
    }
  }

  destroy() {
    if (this.rangeRingsRaf !== null) {
      cancelAnimationFrame(this.rangeRingsRaf);
      this.rangeRingsRaf = null;
    }
    if (this.moveEndDebounceTimer) {
      clearTimeout(this.moveEndDebounceTimer);
      this.moveEndDebounceTimer = null;
    }
    this.hasBoundMapEvents = false;
    this.map = null;
  }

  toggleRangeRings(center: [number, number] | null, map: maplibregl.Map | null) {
    if (!map) return;

    if (!map.getSource('range-rings-data')) {
      this.initLayers(map);
    }

    if (this.isRangeRingsActive()) {
      if (this.rangeRingsRaf !== null) {
        cancelAnimationFrame(this.rangeRingsRaf);
        this.rangeRingsRaf = null;
      }
      this.isRangeRingsActive.set(false);
      this.rangeRingsCenter.set(null);
      this.updateRangeRingsLayer(map, null);
    } else {
      const targetCenter = center || [map.getCenter().lng, map.getCenter().lat];
      this.isRangeRingsActive.set(true);
      this.rangeRingsCenter.set(targetCenter);
      this.updateRangeRingsLayer(map, targetCenter);
    }
  }

  toggleViewshed(center: [number, number] | null, map: maplibregl.Map | null) {
    if (!map) return;

    if (!map.getSource('viewshed-data')) {
      this.initLayers(map);
    }

    if (this.isViewshedActive()) {
      if (this.moveEndDebounceTimer) {
        clearTimeout(this.moveEndDebounceTimer);
        this.moveEndDebounceTimer = null;
      }
      this.viewshedReqId++;
      this.isViewshedActive.set(false);
      this.viewshedCenter.set(null);
      this.isCalculatingViewshed.set(false);
      this.updateViewshedLayer(map);
    } else {
      const targetCenter = center || [map.getCenter().lng, map.getCenter().lat];
      this.isViewshedActive.set(true);
      this.viewshedCenter.set(targetCenter);
      this.calculateAndRenderViewshed(targetCenter, map);
    }
  }

  setObserverHeight(heightM: number) {
    this.observerHeightM.set(Math.max(0.1, heightM));
    if (this.isViewshedActive() && this.map) {
      this.recalculateForScreenCenter();
    }
  }

  setTargetHeight(heightM: number) {
    this.targetHeightM.set(Math.max(0.0, heightM));
    if (this.isViewshedActive() && this.map) {
      this.recalculateForScreenCenter();
    }
  }

  setMaxRadius(radiusM: number) {
    this.maxRadiusM.set(Math.max(100, radiusM));
    if (this.isViewshedActive() && this.map) {
      this.recalculateForScreenCenter();
    }
  }

  private updateRangeRingsLayer(map: maplibregl.Map, center: [number, number] | null) {
    if (!map) return;
    const source = map.getSource('range-rings-data') as maplibregl.GeoJSONSource;
    if (!source) return;

    if (!center) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const features: any[] = [];

    features.push({
      type: 'Feature',
      properties: { isCenter: true },
      geometry: {
        type: 'Point',
        coordinates: center
      }
    });

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
    if (!map) return;
    const source = map.getSource('viewshed-data') as maplibregl.GeoJSONSource;
    if (!source) return;

    const reqId = ++this.viewshedReqId;
    this.isCalculatingViewshed.set(true);

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

      if (reqId !== this.viewshedReqId) return;

      if (viewshedGeoJson && viewshedGeoJson.features) {
        viewshedGeoJson.features.push({
          type: 'Feature',
          properties: { isCenter: true },
          geometry: {
            type: 'Point',
            coordinates: center
          }
        });
        source.setData(viewshedGeoJson);
        this.isCalculatingViewshed.set(false);
        return;
      }
    } catch {
      if (reqId !== this.viewshedReqId) return;
    }

    const baseElev = (this.terrainService && typeof this.terrainService.getElevationAt === 'function' ? this.terrainService.getElevationAt(center[0], center[1]) : 150) || 150;
    const obsTotalElev = baseElev + this.observerHeightM();
    const targetH = this.targetHeightM();
    const maxRadius = this.maxRadiusM();

    const numRays = 36;
    const stepsPerRay = 15;

    const features: any[] = [];

    features.push({
      type: 'Feature',
      properties: { isCenter: true },
      geometry: {
        type: 'Point',
        coordinates: center
      }
    });

    for (let r = 0; r < numRays; r++) {
      const angle1 = r * (360 / numRays);
      const angle2 = (r + 1) * (360 / numRays);
      const midAngle = (angle1 + angle2) / 2;

      let maxSlope = -Infinity;

      for (let s = 1; s <= stepsPerRay; s++) {
        const d1 = ((s - 1) / stepsPerRay) * maxRadius;
        const d2 = (s / stepsPerRay) * maxRadius;

        const ptMid = this.destinationPoint(center, d2, midAngle);
        const ptElev = (this.terrainService && typeof this.terrainService.getElevationAt === 'function' ? this.terrainService.getElevationAt(ptMid[0], ptMid[1]) : 150) || 150;
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

    if (reqId !== this.viewshedReqId) return;

    source.setData({
      type: 'FeatureCollection',
      features
    });
    this.isCalculatingViewshed.set(false);
  }

  private updateViewshedLayer(map: maplibregl.Map) {
    if (!map) return;
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
