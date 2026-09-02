import { Injectable } from '@angular/core';

export interface ElevationPoint {
  distanceM: number;
  elevationM: number;
  slopePercent: number;
  slopeDegrees: number;
  coord: [number, number];
}

export interface ElevationProfileResult {
  points: ElevationPoint[];
  totalDistanceM: number;
  minElevation: number;
  maxElevation: number;
  elevationGainM: number;
  elevationLossM: number;
  maxSlopePercent: number;
}

@Injectable({
  providedIn: 'root'
})
export class TerrainService {
  private elevationCache = new Map<string, number>();

  async loadContours(): Promise<any> {
    try {
      const resp = await fetch('contours.geojson');
      if (resp.ok) {
        return await resp.json();
      }
    } catch {}
    return { type: 'FeatureCollection', features: [] };
  }

  getElevationAt(lng: number, lat: number): number {
    const key = `${lng.toFixed(4)},${lat.toFixed(4)}`;
    return this.elevationCache.get(key) ?? 150.0;
  }

  async getApproxElevation(lng: number, lat: number): Promise<number> {
    const key = `${lng.toFixed(4)},${lat.toFixed(4)}`;
    if (this.elevationCache.has(key)) {
      return this.elevationCache.get(key)!;
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const val = await invoke<number>('get_elevation_at', { coords: [lng, lat] });
      this.elevationCache.set(key, val);
      return val;
    } catch {
      return 150.0;
    }
  }

  async getSlopeBearing(lng: number, lat: number): Promise<number | null> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<number | null>('get_slope_bearing', { coords: [lng, lat] });
    } catch {
      return null;
    }
  }

  async getElevationProfile(
    coordinates: [number, number][],
    stepM: number = 25
  ): Promise<ElevationProfileResult> {
    if (!coordinates || coordinates.length < 2) {
      return {
        points: [],
        totalDistanceM: 0,
        minElevation: 0,
        maxElevation: 0,
        elevationGainM: 0,
        elevationLossM: 0,
        maxSlopePercent: 0
      };
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const res = await invoke<ElevationProfileResult>('get_elevation_profile', {
        coordinates,
        step_m: stepM,
        stepM
      });
      if (res && res.points) {
        for (const pt of res.points) {
          const k = `${pt.coord[0].toFixed(4)},${pt.coord[1].toFixed(4)}`;
          this.elevationCache.set(k, pt.elevationM);
        }
        return res;
      }
    } catch {}

    return {
      points: coordinates.map((coord, idx) => ({
        distanceM: idx * stepM,
        elevationM: 150.0,
        slopePercent: 0,
        slopeDegrees: 0,
        coord
      })),
      totalDistanceM: (coordinates.length - 1) * stepM,
      minElevation: 150.0,
      maxElevation: 150.0,
      elevationGainM: 0,
      elevationLossM: 0,
      maxSlopePercent: 0
    };
  }
}
