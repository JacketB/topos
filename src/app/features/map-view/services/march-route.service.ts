import { Injectable, inject } from '@angular/core';
import { TerrainService } from './terrain.service';
import * as maplibregl from 'maplibre-gl';

export type ColumnType = 'wheel' | 'caterpillar' | 'mixed' | 'foot';

export interface MarchSegment {
  from: [number, number];
  to: [number, number];
  distanceKm: number;
  roadType: string;
  elevationSlope: number;
  speedKmH: number;
  durationHrs: number;
}

export interface MarchRoute {
  segments: MarchSegment[];
  totalDistanceKm: number;
  totalDurationHrs: number;
  sharpTurnCount: number;
  bridgeCount: number;
  totalBarriers: number;
}

@Injectable({
  providedIn: 'root'
})
export class MarchRouteService {
  private terrainService: TerrainService | null = null;

  constructor() {
    try {
      this.terrainService = inject(TerrainService, { optional: true });
    } catch {}
  }

  private readonly SPEED_LIMITS: Record<ColumnType, Record<string, number>> = {
    wheel: {
      motorway: 40,
      primary: 35,
      secondary: 30,
      tertiary: 25,
      minor: 20,
      track: 10,
      path: 0
    },
    caterpillar: {
      motorway: 25,
      primary: 25,
      secondary: 20,
      tertiary: 18,
      minor: 15,
      track: 12,
      path: 0
    },
    mixed: {
      motorway: 25,
      primary: 25,
      secondary: 20,
      tertiary: 18,
      minor: 15,
      track: 10,
      path: 0
    },
    foot: {
      motorway: 0,
      primary: 0,
      secondary: 0,
      tertiary: 5,
      minor: 4.5,
      track: 4,
      path: 3.5
    }
  };

  getDistance(p1: [number, number], p2: [number, number]): number {
    const R = 6371;
    const dLat = (p2[1] - p1[1]) * Math.PI / 180;
    const dLon = (p2[0] - p1[0]) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(p1[1] * Math.PI / 180) * Math.cos(p2[1] * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  projectPointToSegment(p: [number, number], a: [number, number], b: [number, number]): [number, number] {
    const l2 = Math.pow(b[0] - a[0], 2) + Math.pow(b[1] - a[1], 2);
    if (l2 === 0) return a;
    let t = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / l2;
    t = Math.max(0, Math.min(1, t));
    return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
  }

  snapPointToNearestRoad(map: maplibregl.Map, coord: [number, number]): [number, number] {
    if (!map) return coord;
    try {
      const point = map.project(coord);
      const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
        [point.x - 30, point.y - 30],
        [point.x + 30, point.y + 30]
      ];
      const features = map.queryRenderedFeatures(bbox, {
        layers: ['roads_major', 'roads_minor', 'transportation_path']
      });

      if (!features || features.length === 0) return coord;

      let minDistanceKm = Infinity;
      let bestSnapped: [number, number] = coord;

      for (const feat of features) {
        const geom = feat.geometry as any;
        if (!geom) continue;

        const lineCoordsList: [number, number][][] = geom.type === 'LineString' 
          ? [geom.coordinates] 
          : (geom.type === 'MultiLineString' ? geom.coordinates : []);

        for (const lineCoords of lineCoordsList) {
          for (let i = 0; i < lineCoords.length - 1; i++) {
            const p1 = lineCoords[i] as [number, number];
            const p2 = lineCoords[i + 1] as [number, number];
            const projected = this.projectPointToSegment(coord, p1, p2);
            const distKm = this.getDistance(coord, projected);
            if (distKm < minDistanceKm) {
              minDistanceKm = distKm;
              bestSnapped = projected;
            }
          }
        }
      }

      return minDistanceKm < 0.5 ? bestSnapped : coord;
    } catch {
      return coord;
    }
  }

  buildSnappedRoute(map: maplibregl.Map, coords: [number, number][]): [number, number][] {
    if (!map || !coords || coords.length < 2) return coords;
    const snapped: [number, number][] = [];
    coords.forEach(c => {
      snapped.push(this.snapPointToNearestRoad(map, c));
    });
    return snapped;
  }

  getRoadTypeFromMap(map: maplibregl.Map, coord: [number, number]): string {
    try {
      const point = map.project(coord);
      const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
        [point.x - 15, point.y - 15],
        [point.x + 15, point.y + 15]
      ];

      const features = map.queryRenderedFeatures(bbox, {
        layers: ['roads_major', 'roads_minor', 'transportation_path']
      });

      if (features && features.length > 0) {
        const feat = features[0];
        const roadClass = feat.properties?.['class'] || '';
        
        if (roadClass === 'motorway' || roadClass === 'trunk') return 'motorway';
        if (roadClass === 'primary') return 'primary';
        if (roadClass === 'secondary') return 'secondary';
        if (roadClass === 'tertiary') return 'tertiary';
        if (roadClass === 'minor' || roadClass === 'service') return 'minor';
        if (roadClass === 'track') return 'track';
        if (roadClass === 'path') return 'path';
      }
    } catch (e) {
      console.warn('Ошибка при определении типа дороги:', e);
    }
    return 'minor';
  }

  countSharpTurns(coords: [number, number][]): number {
    if (!coords || coords.length < 3) return 0;
    let sharpTurnCount = 0;
    for (let i = 1; i < coords.length - 1; i++) {
      const p0 = coords[i - 1];
      const p1 = coords[i];
      const p2 = coords[i + 1];

      const v1 = [p1[0] - p0[0], p1[1] - p0[1]];
      const v2 = [p2[0] - p1[0], p2[1] - p1[1]];

      const dot = v1[0] * v2[0] + v1[1] * v2[1];
      const mag1 = Math.hypot(v1[0], v1[1]);
      const mag2 = Math.hypot(v2[0], v2[1]);

      if (mag1 > 0 && mag2 > 0) {
        const cosAngle = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
        const angleDeg = (Math.acos(cosAngle) * 180) / Math.PI;
        if (angleDeg >= 90) {
          sharpTurnCount++;
        }
      }
    }
    return sharpTurnCount;
  }

  countBridgeCrossings(map: maplibregl.Map, coords: [number, number][]): number {
    if (!map || !coords || coords.length < 2) return 0;
    let bridgeCount = 0;
    try {
      const styleLayers = map.getStyle()?.layers || [];
      const existingLayerIds = new Set(styleLayers.map(l => l.id));
      const targetLayers = ['water', 'waterway', 'bridge', 'roads_major', 'roads_minor'].filter(id => existingLayerIds.has(id));

      if (targetLayers.length === 0) return 0;

      for (let i = 0; i < coords.length - 1; i++) {
        const p1 = coords[i];
        const p2 = coords[i + 1];
        const midpoint: [number, number] = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
        const point = map.project(midpoint);
        const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
          [point.x - 10, point.y - 10],
          [point.x + 10, point.y + 10]
        ];
        const features = map.queryRenderedFeatures(bbox, {
          layers: targetLayers
        });
        if (features && features.length > 0) {
          const isBridgeOrWater = features.some(f => {
            const cls = f.properties?.['class'] || '';
            const layerId = f.layer?.id || '';
            return layerId === 'water' || layerId === 'waterway' || layerId === 'bridge' || cls === 'bridge' || cls === 'river';
          });
          if (isBridgeOrWater) {
            bridgeCount++;
          }
        }
      }
    } catch {}
    return bridgeCount;
  }

  async calculateRouteStats(
    map: maplibregl.Map,
    coords: [number, number][],
    columnType: ColumnType,
    isNight: boolean
  ): Promise<MarchRoute> {
    if (!coords || coords.length < 2) {
      return { segments: [], totalDistanceKm: 0, totalDurationHrs: 0, sharpTurnCount: 0, bridgeCount: 0, totalBarriers: 0 };
    }

    const segments: MarchSegment[] = [];
    let totalDistanceKm = 0;
    let totalDurationHrs = 0;

    for (let i = 0; i < coords.length - 1; i++) {
      const p1 = coords[i];
      const p2 = coords[i + 1];

      const distanceKm = this.getDistance(p1, p2);
      totalDistanceKm += distanceKm;

      const midpoint: [number, number] = [
        (p1[0] + p2[0]) / 2,
        (p1[1] + p2[1]) / 2
      ];
      const roadType = this.getRoadTypeFromMap(map, midpoint);

      const h1 = this.terrainService ? await this.terrainService.getApproxElevation(p1[0], p1[1]) : 0;
      const h2 = this.terrainService ? await this.terrainService.getApproxElevation(p2[0], p2[1]) : 0;
      const distMeters = distanceKm * 1000;
      const elevationDiff = Math.abs(h1 - h2);
      const elevationSlope = distMeters > 0 ? (elevationDiff / distMeters) * 100 : 0;

      const baseSpeed = this.SPEED_LIMITS[columnType][roadType] || 0;
      let speedKmH = baseSpeed;

      if (speedKmH > 0) {
        if (isNight) {
          speedKmH *= 0.7;
        }
        if (elevationSlope > 8) {
          speedKmH *= 0.6;
        }
      }

      const durationHrs = speedKmH > 0 ? distanceKm / speedKmH : 0;
      totalDurationHrs += durationHrs;

      segments.push({
        from: p1,
        to: p2,
        distanceKm,
        roadType,
        elevationSlope,
        speedKmH,
        durationHrs
      });
    }

    const sharpTurnCount = this.countSharpTurns(coords);
    const bridgeCount = this.countBridgeCrossings(map, coords);
    const totalBarriers = sharpTurnCount + bridgeCount;

    return {
      segments,
      totalDistanceKm,
      totalDurationHrs,
      sharpTurnCount,
      bridgeCount,
      totalBarriers
    };
  }
}
