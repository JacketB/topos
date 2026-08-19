import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class TerrainService {
  private contoursData: any = null;
  private loadingPromise: Promise<any> | null = null;

  async loadContours(): Promise<any> {
    if (this.contoursData) return this.contoursData;
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = fetch('/contours.geojson')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch contours.geojson');
        return res.json();
      })
      .then(data => {
        if (data && data.features) {
          for (const feature of data.features) {
            feature.bbox = this.computeFeatureBbox(feature);
          }
        }
        this.contoursData = data;
        return data;
      })
      .catch(err => {
        console.error('Error loading contours:', err);
        this.loadingPromise = null;
        return null;
      });

    return this.loadingPromise;
  }

  private computeFeatureBbox(feature: any): [number, number, number, number] {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    if (feature.geometry && feature.geometry.coordinates) {
      const coords = feature.geometry.coordinates;
      const geomType = feature.geometry.type;
      
      if (geomType === 'LineString') {
        for (const pt of coords) {
          if (pt[0] < minX) minX = pt[0];
          if (pt[1] < minY) minY = pt[1];
          if (pt[0] > maxX) maxX = pt[0];
          if (pt[1] > maxY) maxY = pt[1];
        }
      } else if (geomType === 'MultiLineString') {
        for (const line of coords) {
          for (const pt of line) {
            if (pt[0] < minX) minX = pt[0];
            if (pt[1] < minY) minY = pt[1];
            if (pt[0] > maxX) maxX = pt[0];
            if (pt[1] > maxY) maxY = pt[1];
          }
        }
      }
    }
    return [minX, minY, maxX, maxY];
  }

  private distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
    const dx = bx - ax;
    const dy = by - ay;
    if (dx === 0 && dy === 0) {
      return Math.hypot(px - ax, py - ay);
    }
    const t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
    if (t < 0) return Math.hypot(px - ax, py - ay);
    if (t > 1) return Math.hypot(px - bx, py - by);
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  private getClosestPointOnSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): [number, number] {
    const dx = bx - ax;
    const dy = by - ay;
    if (dx === 0 && dy === 0) return [ax, ay];
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
    return [ax + t * dx, ay + t * dy];
  }

  private findNearestContours(lng: number, lat: number, data: any): { elevation: number, distance: number, dx: number, dy: number }[] {
    if (!data || !data.features) return [];
    
    const threshold = 0.03;
    const candidates: { elevation: number, distance: number, dx: number, dy: number }[] = [];

    for (const feature of data.features) {
      if (!feature.bbox) continue;

      if (lng < feature.bbox[0] - threshold || lng > feature.bbox[2] + threshold ||
          lat < feature.bbox[1] - threshold || lat > feature.bbox[3] + threshold) {
        continue;
      }

      const ele = feature.properties.ele || 0;
      const geomType = feature.geometry.type;

      let minDistForFeature = Infinity;
      let featDx = 0;
      let featDy = 0;

      if (geomType === 'LineString') {
        const coords = feature.geometry.coordinates;
        for (let i = 0; i < coords.length - 1; i++) {
          const a = coords[i];
          const b = coords[i + 1];
          const dist = this.distanceToSegment(lng, lat, a[0], a[1], b[0], b[1]);
          if (dist < minDistForFeature) {
            minDistForFeature = dist;
            featDx = b[0] - a[0];
            featDy = b[1] - a[1];
          }
        }
      } else if (geomType === 'MultiLineString') {
        const lines = feature.geometry.coordinates;
        for (const coords of lines) {
          let minX = Infinity, minY = Infinity;
          let maxX = -Infinity, maxY = -Infinity;
          for (const pt of coords) {
            if (pt[0] < minX) minX = pt[0];
            if (pt[1] < minY) minY = pt[1];
            if (pt[0] > maxX) maxX = pt[0];
            if (pt[1] > maxY) maxY = pt[1];
          }
          if (lng < minX - threshold || lng > maxX + threshold ||
              lat < minY - threshold || lat > maxY + threshold) {
            continue;
          }

          for (let i = 0; i < coords.length - 1; i++) {
            const a = coords[i];
            const b = coords[i + 1];
            const dist = this.distanceToSegment(lng, lat, a[0], a[1], b[0], b[1]);
            if (dist < minDistForFeature) {
              minDistForFeature = dist;
              featDx = b[0] - a[0];
              featDy = b[1] - a[1];
            }
          }
        }
      }

      if (minDistForFeature < Infinity) {
        candidates.push({
          elevation: ele,
          distance: minDistForFeature,
          dx: featDx,
          dy: featDy
        });
      }
    }

    candidates.sort((a, b) => a.distance - b.distance);
    return candidates;
  }

  getInterpolatedElevation(lng: number, lat: number): number {
    if (!this.contoursData) return 150.0;
    const candidates = this.findNearestContours(lng, lat, this.contoursData);
    if (candidates.length === 0) return 150.0;

    const first = candidates[0];
    if (first.distance < 0.00001) return parseFloat(first.elevation.toFixed(1));

    const distinct: { elevation: number, distance: number }[] = [];
    const seenElevations = new Set<number>();

    for (const item of candidates) {
      if (!seenElevations.has(item.elevation)) {
        seenElevations.add(item.elevation);
        distinct.push({ elevation: item.elevation, distance: item.distance });
        if (distinct.length >= 3) break;
      }
    }

    if (distinct.length === 1) {
      return parseFloat(distinct[0].elevation.toFixed(1));
    }

    let weightSum = 0;
    let valueSum = 0;

    for (const item of distinct) {
      const w = 1.0 / Math.pow(item.distance + 0.000001, 2);
      weightSum += w;
      valueSum += w * item.elevation;
    }

    const interpolated = valueSum / weightSum;
    return parseFloat(interpolated.toFixed(1));
  }

  getElevationAt(lng: number, lat: number): number {
    return this.getInterpolatedElevation(lng, lat);
  }

  async getApproxElevation(lng: number, lat: number): Promise<number> {
    const data = await this.loadContours();
    if (!data) return 150.0;
    return this.getInterpolatedElevation(lng, lat);
  }

  async getSlopeBearing(lng: number, lat: number): Promise<number | null> {
    const data = await this.loadContours();
    if (!data) return null;

    const candidates = this.findNearestContours(lng, lat, data);
    if (candidates.length === 0) return null;

    const nearest = candidates[0];
    const dx = nearest.dx;
    const dy = nearest.dy;
    const len = Math.hypot(dx, dy);
    if (len === 0) return null;

    const nx = -dy / len;
    const ny = dx / len;

    const delta = 0.0005;
    const p1_lng = lng + nx * delta;
    const p1_lat = lat + ny * delta;
    const p2_lng = lng - nx * delta;
    const p2_lat = lat - ny * delta;

    const n1_elev = this.getInterpolatedElevation(p1_lng, p1_lat);
    const n2_elev = this.getInterpolatedElevation(p2_lng, p2_lat);

    let downhillX = nx;
    let downhillY = ny;

    if (n1_elev > n2_elev) {
      downhillX = -nx;
      downhillY = -ny;
    } else if (n1_elev < n2_elev) {
      downhillX = nx;
      downhillY = ny;
    }

    const rad = lat * Math.PI / 180;
    const cosLat = Math.cos(rad);

    const dx_meters = downhillX * cosLat;
    const dy_meters = downhillY;

    let bearing = Math.atan2(dx_meters, dy_meters) * 180 / Math.PI;
    bearing = (bearing + 360) % 360;

    return Math.round(bearing);
  }
}
