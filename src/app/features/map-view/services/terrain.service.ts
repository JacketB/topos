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

export interface TerrainMeshResult {
  vertices: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
  minElevation: number;
  maxElevation: number;
  avgElevation: number;
  widthM: number;
  heightM: number;
  centerLng: number;
  centerLat: number;
  gridCols: number;
  gridRows: number;
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

  async generateTerrainMesh(
    bbox: [number, number, number, number],
    resolution: number = 64
  ): Promise<TerrainMeshResult> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<TerrainMeshResult>('generate_terrain_mesh', {
        bbox,
        resolution
      });
    } catch {
      return this.generateFallbackMesh(bbox, resolution);
    }
  }

  private generateFallbackMesh(
    bbox: [number, number, number, number],
    resolution: number
  ): TerrainMeshResult {
    const minLng = Math.min(bbox[0], bbox[2]);
    const maxLng = Math.max(bbox[0], bbox[2]);
    const minLat = Math.min(bbox[1], bbox[3]);
    const maxLat = Math.max(bbox[1], bbox[3]);
    const cols = Math.max(16, Math.min(128, resolution));
    const rows = cols;
    const centerLng = (minLng + maxLng) * 0.5;
    const centerLat = (minLat + maxLat) * 0.5;
    const widthM = (maxLng - minLng) * 111320 * Math.cos((centerLat * Math.PI) / 180);
    const heightM = (maxLat - minLat) * 111132;

    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let r = 0; r < rows; r++) {
      const vFrac = r / (rows - 1);
      const z = -((vFrac - 0.5) * heightM);
      for (let c = 0; c < cols; c++) {
        const uFrac = c / (cols - 1);
        const x = (uFrac - 0.5) * widthM;
        const y = 150;
        vertices.push(x, y, z);
        normals.push(0, 1, 0);
        uvs.push(uFrac, vFrac);
      }
    }

    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const i0 = r * cols + c;
        const i1 = r * cols + c + 1;
        const i2 = (r + 1) * cols + c;
        const i3 = (r + 1) * cols + c + 1;
        indices.push(i0, i1, i2);
        indices.push(i1, i3, i2);
      }
    }

    return {
      vertices,
      normals,
      uvs,
      indices,
      minElevation: 150,
      maxElevation: 150,
      avgElevation: 150,
      widthM,
      heightM,
      centerLng,
      centerLat,
      gridCols: cols,
      gridRows: rows
    };
  }
}
