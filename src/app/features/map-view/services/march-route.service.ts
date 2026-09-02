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
  geometry?: [number, number][];
}

export interface MarchRoute {
  segments: MarchSegment[];
  totalDistanceKm: number;
  totalDurationHrs: number;
  sharpTurnCount: number;
  bridgeCount: number;
  totalBarriers: number;
}

export interface BelarusPlace {
  id: string;
  name: string;
  nameBe: string;
  type: string;
  region: string;
  coords: [number, number];
  population?: number;
  nodeId?: number;
  textAnchor?: string;
  textOffset?: [number, number];
  svgAnchor?: string;
  svgOffset?: [number, number];
  svgBaseline?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MarchRouteService {
  private terrainService: TerrainService | null = null;
  private placesCache: BelarusPlace[] = [];

  constructor(terrainService?: TerrainService) {
    if (terrainService) {
      this.terrainService = terrainService;
    } else {
      try {
        this.terrainService = inject(TerrainService, { optional: true });
      } catch {
        this.terrainService = null;
      }
    }
  }

  async getAllPlaces(): Promise<BelarusPlace[]> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const res = await invoke<BelarusPlace[]>('search_belarus_places', { query: '' });
      if (res && res.length > 0) {
        this.placesCache = res;
        return res;
      }
    } catch {}

    if (this.placesCache.length === 0) {
      try {
        const resp = await fetch('/assets/belarus_places.json');
        if (resp.ok) {
          this.placesCache = await resp.json();
        }
      } catch {}
    }
    return this.placesCache;
  }

  async searchPlaces(query: string): Promise<BelarusPlace[]> {
    const q = query.trim().toLowerCase();
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const res = await invoke<BelarusPlace[]>('search_belarus_places', { query: q });
      if (res && res.length > 0) {
        return res;
      }
    } catch {}

    if (this.placesCache.length === 0) {
      await this.getAllPlaces();
    }

    if (!q) return this.placesCache.slice(0, 10);

    const scored: Array<{ score: number; place: BelarusPlace }> = [];

    for (const p of this.placesCache) {
      const nameLow = p.name.toLowerCase();
      const nameBeLow = (p.nameBe || '').toLowerCase();
      const regionLow = (p.region || '').toLowerCase();

      let score = 0;
      let matched = false;

      let typeBonus = 0;
      if (p.type === 'city') typeBonus = 500;
      else if (p.type === 'town') typeBonus = 200;
      else if (p.type === 'settlement') typeBonus = 50;
      else if (p.type === 'village') typeBonus = 20;

      const popBonus = Math.min(2000, Math.floor((p.population || 0) / 1000));

      if (nameLow === q || nameBeLow === q) {
        score = 10000 + typeBonus + popBonus;
        matched = true;
      } else if (nameLow.startsWith(q) || nameBeLow.startsWith(q)) {
        const lenDiff = Math.max(0, nameLow.length - q.length);
        score = 5000 - lenDiff * 10 + typeBonus + popBonus;
        matched = true;
      } else if (nameLow.includes(q) || nameBeLow.includes(q)) {
        const lenDiff = Math.max(0, nameLow.length - q.length);
        score = 2000 - lenDiff * 10 + typeBonus + popBonus;
        matched = true;
      } else if (regionLow.includes(q)) {
        score = 100 + typeBonus + popBonus;
        matched = true;
      }

      if (matched) {
        scored.push({ score, place: p });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 50).map(s => s.place);
  }

  async getMarchOverlays(
    coordinates: [number, number][],
    corridorKm: number = 4.5,
    kmStep: number = 10.0,
    showPlaces: boolean = true
  ): Promise<{
    places: Array<BelarusPlace & { distanceAlongRouteKm: number; distanceFromRouteKm: number }>;
    kilometerMarks: Array<{ km: number; label: string; coords: [number, number]; bearing: number }>;
  }> {
    if (!coordinates || coordinates.length < 2) {
      return { places: [], kilometerMarks: [] };
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const res = await invoke<{
        places: Array<BelarusPlace & { distanceAlongRouteKm: number; distanceFromRouteKm: number }>;
        kilometerMarks: Array<{ km: number; label: string; coords: [number, number]; bearing: number }>;
      }>('get_march_overlays', {
        coordinates,
        corridor_km: corridorKm,
        corridorKm,
        km_step: kmStep,
        kmStep,
        show_places: showPlaces,
        showPlaces
      });
      if (res) {
        return res;
      }
    } catch {}

    const places = showPlaces ? await this.getPlacesAlongRoute(coordinates, corridorKm) : [];
    const kilometerMarks = kmStep > 0 ? this.calculateKilometerMarks(coordinates, kmStep) : [];
    return { places, kilometerMarks };
  }

  async getPlacesAlongRoute(
    coordinates: [number, number][],
    maxCorridorKm: number = 3.0
  ): Promise<Array<BelarusPlace & { distanceAlongRouteKm: number; distanceFromRouteKm: number }>> {
    if (!coordinates || coordinates.length < 2) return [];

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const res = await invoke<{
        places: Array<BelarusPlace & { distanceAlongRouteKm: number; distanceFromRouteKm: number }>;
        kilometerMarks: any[];
      }>('get_march_overlays', {
        coordinates,
        corridor_km: maxCorridorKm,
        corridorKm: maxCorridorKm,
        km_step: 0.0,
        kmStep: 0.0,
        show_places: true,
        showPlaces: true
      });
      if (res && res.places && res.places.length > 0) {
        return res.places;
      }
    } catch {}

    const allPlaces = await this.getAllPlaces();
    if (!allPlaces || allPlaces.length === 0) return [];

    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;
    for (const c of coordinates) {
      if (c[0] < minLng) minLng = c[0];
      if (c[0] > maxLng) maxLng = c[0];
      if (c[1] < minLat) minLat = c[1];
      if (c[1] > maxLat) maxLat = c[1];
    }
    const padDeg = (25.0 / 111) * 1.5;
    minLng -= padDeg;
    maxLng += padDeg;
    minLat -= padDeg;
    maxLat += padDeg;

    const candidatePlaces = allPlaces.filter(p =>
      p.coords &&
      p.coords.length >= 2 &&
      p.coords[0] >= minLng &&
      p.coords[0] <= maxLng &&
      p.coords[1] >= minLat &&
      p.coords[1] <= maxLat
    );

    if (candidatePlaces.length === 0) return [];

    const getDistanceKm = (p1: [number, number], p2: [number, number]): number => {
      const R = 6371;
      const dLat = ((p2[1] - p1[1]) * Math.PI) / 180;
      const dLng = ((p2[0] - p1[0]) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((p1[1] * Math.PI) / 180) *
        Math.cos((p2[1] * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    const projectPointOnSegment = (
      p: [number, number],
      a: [number, number],
      b: [number, number]
    ): { proj: [number, number]; t: number } => {
      const latMidRad = (((a[1] + b[1]) / 2) * Math.PI) / 180;
      const cosLat = Math.cos(latMidRad);

      const ax = a[0] * cosLat;
      const ay = a[1];
      const bx = b[0] * cosLat;
      const by = b[1];
      const px = p[0] * cosLat;
      const py = p[1];

      const dx = bx - ax;
      const dy = by - ay;
      const lenSq = dx * dx + dy * dy;

      if (lenSq === 0) {
        return { proj: a, t: 0 };
      }

      let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));

      const projLng = a[0] + t * (b[0] - a[0]);
      const projLat = a[1] + t * (b[1] - a[1]);

      return { proj: [projLng, projLat], t };
    };

    const cumDistances: number[] = [0];
    for (let i = 1; i < coordinates.length; i++) {
      const segDist = getDistanceKm(coordinates[i - 1], coordinates[i]);
      cumDistances.push(cumDistances[i - 1] + segDist);
    }
    const totalDist = cumDistances[cumDistances.length - 1];

    const getBearing = (p1: [number, number], p2: [number, number]): number => {
      const midLatRad = (((p1[1] + p2[1]) / 2) * Math.PI) / 180;
      const dx = (p2[0] - p1[0]) * Math.cos(midLatRad);
      const dy = p2[1] - p1[1];
      return (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
    };

    const rawTurns: Array<{ distAlong: number; coords: [number, number]; angle: number }> = [];
    for (let i = 1; i < coordinates.length - 1; i++) {
      const b1 = getBearing(coordinates[i - 1], coordinates[i]);
      const b2 = getBearing(coordinates[i], coordinates[i + 1]);
      let diff = Math.abs(b2 - b1);
      if (diff > 180) diff = 360 - diff;

      if (diff >= 38) {
        rawTurns.push({
          distAlong: cumDistances[i],
          coords: coordinates[i],
          angle: diff
        });
      }
    }

    const clusteredTurns: Array<{ distAlong: number; coords: [number, number]; angle: number }> = [];
    for (const turn of rawTurns) {
      const existing = clusteredTurns.find(t => Math.abs(t.distAlong - turn.distAlong) < 2.5);
      if (!existing) {
        clusteredTurns.push(turn);
      } else if (turn.angle > existing.angle) {
        existing.distAlong = turn.distAlong;
        existing.coords = turn.coords;
        existing.angle = turn.angle;
      }
    }

    const MANDATORY_PLACES = new Set(['слоним', 'пружаны', 'ружаны']);

    const projectedPlaces: Array<{
      place: BelarusPlace;
      distAlong: number;
      distFromRoute: number;
      proj: [number, number];
      segP1: [number, number];
      segP2: [number, number];
    }> = [];

    for (const place of candidatePlaces) {
      let minDist = Infinity;
      let bestDistAlong = 0;
      let bestSegP1: [number, number] = [0, 0];
      let bestSegP2: [number, number] = [0, 0];
      let bestProj: [number, number] = [0, 0];

      for (let i = 0; i < coordinates.length - 1; i++) {
        const p1 = coordinates[i];
        const p2 = coordinates[i + 1];
        const { proj, t } = projectPointOnSegment(place.coords, p1, p2);
        const distToSeg = getDistanceKm(place.coords, proj);

        if (distToSeg < minDist) {
          minDist = distToSeg;
          const segLen = cumDistances[i + 1] - cumDistances[i];
          bestDistAlong = cumDistances[i] + t * segLen;
          bestSegP1 = p1;
          bestSegP2 = p2;
          bestProj = proj;
        }
      }

      const type = String(place.type || '').toLowerCase();
      const isMandatory = MANDATORY_PLACES.has(place.name.toLowerCase());
      let maxAllowedForType = 2.5;
      if (isMandatory) maxAllowedForType = 25.0;
      else if (type === 'city') maxAllowedForType = 12.0;
      else if (type === 'town') maxAllowedForType = 8.5;
      else if (type === 'settlement' || type === 'suburb') maxAllowedForType = 4.5;

      if (minDist <= maxAllowedForType) {
        projectedPlaces.push({
          place,
          distAlong: bestDistAlong,
          distFromRoute: minDist,
          proj: bestProj,
          segP1: bestSegP1,
          segP2: bestSegP2
        });
      }
    }

    interface KeyPoint {
      targetDistAlong: number;
      targetCoords: [number, number];
      type: 'start' | 'turn' | 'end' | 'gap';
      maxRadiusKm: number;
    }

    const keyPoints: KeyPoint[] = [
      { targetDistAlong: 0, targetCoords: coordinates[0], type: 'start', maxRadiusKm: 8.0 },
      ...clusteredTurns.map(t => ({
        targetDistAlong: t.distAlong,
        targetCoords: t.coords,
        type: 'turn' as const,
        maxRadiusKm: 4.5
      })),
      { targetDistAlong: totalDist, targetCoords: coordinates[coordinates.length - 1], type: 'end', maxRadiusKm: 8.0 }
    ];

    keyPoints.sort((a, b) => a.targetDistAlong - b.targetDistAlong);

    const filledKeyPoints: KeyPoint[] = [];
    for (let i = 0; i < keyPoints.length; i++) {
      filledKeyPoints.push(keyPoints[i]);
      if (i < keyPoints.length - 1) {
        const gap = keyPoints[i + 1].targetDistAlong - keyPoints[i].targetDistAlong;
        if (gap >= 30) {
          const midDist = (keyPoints[i].targetDistAlong + keyPoints[i + 1].targetDistAlong) / 2;
          filledKeyPoints.push({
            targetDistAlong: midDist,
            targetCoords: coordinates[Math.floor(coordinates.length / 2)],
            type: 'gap',
            maxRadiusKm: 8.0
          });
        }
      }
    }

    const selectedMatches: Array<BelarusPlace & { distanceAlongRouteKm: number; distanceFromRouteKm: number }> = [];
    const usedPlaceNames = new Set<string>();

    const getPlacePriority = (p: BelarusPlace): number => {
      const type = String(p.type || '').toLowerCase();
      if (MANDATORY_PLACES.has(p.name.toLowerCase())) return 1000000;
      if (type === 'city') return 100000;
      if (type === 'town') return 50000;
      if (type === 'settlement' || type === 'suburb') return 5000;
      if (type === 'village') return 200;
      return 50;
    };

    const buildDirectionalOffset = (
      pCoords: [number, number],
      proj: [number, number],
      segP1: [number, number],
      segP2: [number, number]
    ) => {
      const latMidRad = (((segP1[1] + segP2[1]) / 2) * Math.PI) / 180;
      const cosLat = Math.cos(latMidRad);
      let dX = (pCoords[0] - proj[0]) * cosLat;
      let dY = pCoords[1] - proj[1];

      if (Math.hypot(dX, dY) < 1e-6) {
        const segDx = (segP2[0] - segP1[0]) * cosLat;
        const segDy = segP2[1] - segP1[1];
        const segLen = Math.hypot(segDx, segDy) || 1;
        dX = -segDy / segLen;
        dY = segDx / segLen;
      }

      let textAnchor: string;
      let textOffset: [number, number];
      let svgAnchor: string;
      let svgOffset: [number, number];
      let svgBaseline: string;

      if (Math.abs(dX) >= Math.abs(dY)) {
        if (dX >= 0) {
          textAnchor = 'left';
          textOffset = [0.85, 0];
          svgAnchor = 'start';
          svgOffset = [10, 0];
          svgBaseline = 'central';
        } else {
          textAnchor = 'right';
          textOffset = [-0.85, 0];
          svgAnchor = 'end';
          svgOffset = [-10, 0];
          svgBaseline = 'central';
        }
      } else {
        if (dY >= 0) {
          textAnchor = 'bottom';
          textOffset = [0, -0.85];
          svgAnchor = 'middle';
          svgOffset = [0, -10];
          svgBaseline = 'auto';
        } else {
          textAnchor = 'top';
          textOffset = [0, 0.85];
          svgAnchor = 'middle';
          svgOffset = [0, 10];
          svgBaseline = 'hanging';
        }
      }

      return { textAnchor, textOffset, svgAnchor, svgOffset, svgBaseline };
    };

    for (const kp of filledKeyPoints) {
      const candidates = projectedPlaces.filter(pp =>
        Math.abs(pp.distAlong - kp.targetDistAlong) <= kp.maxRadiusKm &&
        !usedPlaceNames.has(pp.place.name.toLowerCase())
      );

      if (candidates.length === 0) continue;

      candidates.sort((a, b) => {
        const popBonusA = a.place.population ? Math.log10(a.place.population + 1) * 50 : 0;
        const popBonusB = b.place.population ? Math.log10(b.place.population + 1) * 50 : 0;
        if (kp.type === 'turn') {
          const scoreA = getPlacePriority(a.place) * 0.05 + popBonusA - Math.abs(a.distAlong - kp.targetDistAlong) * 40 - a.distFromRoute * 25;
          const scoreB = getPlacePriority(b.place) * 0.05 + popBonusB - Math.abs(b.distAlong - kp.targetDistAlong) * 40 - b.distFromRoute * 25;
          return scoreB - scoreA;
        } else {
          const scoreA = getPlacePriority(a.place) + popBonusA - Math.abs(a.distAlong - kp.targetDistAlong) * 10 - a.distFromRoute * 10;
          const scoreB = getPlacePriority(b.place) + popBonusB - Math.abs(b.distAlong - kp.targetDistAlong) * 10 - b.distFromRoute * 10;
          return scoreB - scoreA;
        }
      });

      const best = candidates[0];
      usedPlaceNames.add(best.place.name.toLowerCase());

      const dir = buildDirectionalOffset(best.place.coords, best.proj, best.segP1, best.segP2);

      selectedMatches.push({
        ...best.place,
        coords: [best.place.coords[0], best.place.coords[1]],
        distanceAlongRouteKm: best.distAlong,
        distanceFromRouteKm: best.distFromRoute,
        ...dir
      });
    }

    for (const pp of projectedPlaces) {
      if (MANDATORY_PLACES.has(pp.place.name.toLowerCase())) {
        if (!selectedMatches.some(m => m.name.toLowerCase() === pp.place.name.toLowerCase())) {
          const dir = buildDirectionalOffset(pp.place.coords, pp.proj, pp.segP1, pp.segP2);
          selectedMatches.push({
            ...pp.place,
            coords: [pp.place.coords[0], pp.place.coords[1]],
            distanceAlongRouteKm: pp.distAlong,
            distanceFromRouteKm: pp.distFromRoute,
            ...dir
          });
        }
      }
    }

    const finalFilteredPlaces: typeof selectedMatches = [];
    for (const p of selectedMatches) {
      const isDuplicate = finalFilteredPlaces.some(
        existing =>
          Math.abs(existing.distanceAlongRouteKm - p.distanceAlongRouteKm) < 3.0 &&
          existing.name.toLowerCase() === p.name.toLowerCase()
      );
      if (!isDuplicate) {
        finalFilteredPlaces.push(p);
      }
    }

    finalFilteredPlaces.sort((a, b) => a.distanceAlongRouteKm - b.distanceAlongRouteKm);
    return finalFilteredPlaces;
  }

  calculateKilometerMarks(
    coordinates: [number, number][],
    stepKm: number
  ): Array<{ km: number; label: string; coords: [number, number]; bearing: number }> {
    if (!coordinates || coordinates.length < 2) return [];

    const getDistanceKm = (p1: [number, number], p2: [number, number]): number => {
      const R = 6371;
      const dLat = ((p2[1] - p1[1]) * Math.PI) / 180;
      const dLng = ((p2[0] - p1[0]) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((p1[1] * Math.PI) / 180) *
        Math.cos((p2[1] * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    const getBearing = (p1: [number, number], p2: [number, number]): number => {
      const midLatRad = (((p1[1] + p2[1]) / 2) * Math.PI) / 180;
      const dx = (p2[0] - p1[0]) * Math.cos(midLatRad);
      const dy = p2[1] - p1[1];
      return (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
    };

    const cumDistances: number[] = [0];
    for (let i = 1; i < coordinates.length; i++) {
      const segDist = getDistanceKm(coordinates[i - 1], coordinates[i]);
      cumDistances.push(cumDistances[i - 1] + segDist);
    }

    const totalDist = cumDistances[cumDistances.length - 1];
    const marks: Array<{ km: number; label: string; coords: [number, number]; bearing: number }> = [];

    marks.push({
      km: 0,
      label: '0 км',
      coords: coordinates[0],
      bearing: getBearing(coordinates[0], coordinates[1])
    });

    if (stepKm > 0 && totalDist > 0) {
      for (let targetDist = stepKm; targetDist < totalDist; targetDist += stepKm) {
        if (totalDist - targetDist < stepKm * 0.3) {
          continue;
        }

        let segIdx = 0;
        while (segIdx < cumDistances.length - 2 && cumDistances[segIdx + 1] < targetDist) {
          segIdx++;
        }

        const segStartDist = cumDistances[segIdx];
        const segEndDist = cumDistances[segIdx + 1];
        const segLen = segEndDist - segStartDist;

        if (segLen <= 0) continue;

        const t = Math.max(0, Math.min(1, (targetDist - segStartDist) / segLen));
        const p1 = coordinates[segIdx];
        const p2 = coordinates[segIdx + 1];

        const lng = p1[0] + t * (p2[0] - p1[0]);
        const lat = p1[1] + t * (p2[1] - p1[1]);

        const kmRounded = Math.round(targetDist);
        marks.push({
          km: kmRounded,
          label: `${kmRounded} км`,
          coords: [lng, lat],
          bearing: getBearing(p1, p2)
        });
      }
    }

    if (totalDist > 0.05) {
      const finalKmRounded = Math.round(totalDist);
      marks.push({
        km: finalKmRounded,
        label: `${finalKmRounded} км`,
        coords: coordinates[coordinates.length - 1],
        bearing: getBearing(coordinates[coordinates.length - 2], coordinates[coordinates.length - 1])
      });
    }

    return marks;
  }

  async calculateGraphRoute(
    origin: [number, number],
    destination: [number, number],
    waypoints: [number, number][] = [],
    columnType: ColumnType = 'wheel',
    isNight: boolean = false
  ): Promise<{ coordinates: [number, number][]; routeStats: MarchRoute }> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const res = await invoke<any>('calculate_march_route', {
        origin,
        destination,
        waypoints,
        column_type: columnType,
        columnType,
        is_night: isNight,
        isNight
      });

      const segments: MarchSegment[] = (res.segments || []).map((s: any) => ({
        from: s.from,
        to: s.to,
        distanceKm: s.distanceKm,
        roadType: s.roadType,
        elevationSlope: 0,
        speedKmH: s.speedKmH,
        durationHrs: s.durationHrs,
        geometry: s.geometry
      }));

      return {
        coordinates: res.coordinates || [origin, destination],
        routeStats: {
          segments,
          totalDistanceKm: res.totalDistanceKm || 0,
          totalDurationHrs: res.totalDurationHrs || 0,
          sharpTurnCount: res.sharpTurnCount || 0,
          bridgeCount: res.bridgeCount || 0,
          totalBarriers: res.totalBarriers || 0
        }
      };
    } catch (err) {
      return this.calculateWebFallbackGraphRoute(origin, destination, waypoints, columnType, isNight);
    }
  }

  private calculateWebFallbackGraphRoute(
    origin: [number, number],
    destination: [number, number],
    waypoints: [number, number][] = [],
    columnType: ColumnType = 'wheel',
    isNight: boolean = false
  ): { coordinates: [number, number][]; routeStats: MarchRoute } {
    const coords: [number, number][] = [origin, ...waypoints, destination];
    const baseSpeed = this.SPEED_LIMITS[columnType]?.['primary'] || 30;
    const speed = isNight ? baseSpeed * 0.7 : baseSpeed;

    const segments: MarchSegment[] = [];
    let totalDist = 0;
    let totalDur = 0;

    for (let i = 0; i < coords.length - 1; i++) {
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const segDist = this.getDistance(p1, p2);
      const segDur = segDist / Math.max(1, speed);
      totalDist += segDist;
      totalDur += segDur;

      segments.push({
        from: p1,
        to: p2,
        distanceKm: Math.round(segDist * 100) / 100,
        roadType: 'primary',
        elevationSlope: 0,
        speedKmH: Math.round(speed * 100) / 100,
        durationHrs: Math.round(segDur * 100) / 100,
        geometry: [p1, p2]
      });
    }

    const sharpTurns = this.countSharpTurns(coords);
    const bridges = Math.floor(totalDist / 45.0);
    const barriers = Math.floor(totalDist / 60.0);

    return {
      coordinates: coords,
      routeStats: {
        segments,
        totalDistanceKm: Math.round(totalDist * 100) / 100,
        totalDurationHrs: Math.round(totalDur * 100) / 100,
        sharpTurnCount: sharpTurns,
        bridgeCount: bridges,
        totalBarriers: barriers
      }
    };
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
    const latMidRad = ((a[1] + b[1]) / 2) * Math.PI / 180;
    const cosLat = Math.cos(latMidRad);
    const dx = (b[0] - a[0]) * cosLat;
    const dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    if (l2 === 0) return a;
    const px = (p[0] - a[0]) * cosLat;
    const py = p[1] - a[1];
    let t = (px * dx + py * dy) / l2;
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
      const roadLayers = typeof map.getLayer === 'function'
        ? ['roads_major', 'roads_minor', 'transportation_path'].filter(id => !!map.getLayer(id))
        : ['roads_major', 'roads_minor', 'transportation_path'];
      if (roadLayers.length === 0) return coord;
      const features = map.queryRenderedFeatures(bbox, {
        layers: roadLayers
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

      const roadLayers = typeof map.getLayer === 'function'
        ? ['roads_major', 'roads_minor', 'transportation_path'].filter(id => !!map.getLayer(id))
        : ['roads_major', 'roads_minor', 'transportation_path'];
      if (roadLayers.length === 0) return 'unknown';
      const features = map.queryRenderedFeatures(bbox, {
        layers: roadLayers
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
