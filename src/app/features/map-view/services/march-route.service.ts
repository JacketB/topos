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
}

@Injectable({
  providedIn: 'root'
})
export class MarchRouteService {
  private terrainService = inject(TerrainService);

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

  async calculateRouteStats(
    map: maplibregl.Map,
    coords: [number, number][],
    columnType: ColumnType,
    isNight: boolean
  ): Promise<MarchRoute> {
    if (!coords || coords.length < 2) {
      return { segments: [], totalDistanceKm: 0, totalDurationHrs: 0 };
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

      const h1 = await this.terrainService.getApproxElevation(p1[0], p1[1]);
      const h2 = await this.terrainService.getApproxElevation(p2[0], p2[1]);
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

    return {
      segments,
      totalDistanceKm,
      totalDurationHrs
    };
  }
}
