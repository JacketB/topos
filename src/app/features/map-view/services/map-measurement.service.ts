import { Injectable, signal } from '@angular/core';
import maplibregl from 'maplibre-gl';

export interface GeodesyMeasurementInfo {
  distance: number;
  distanceStr: string;
  bearingTrue: number;
  bearingTrueStr: string;
  bearingMag: number;
  bearingMagStr: string;
  areaM2?: number;
  areaStr?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MapMeasurementService {
  readonly isMeasuring = signal<boolean>(false);
  readonly measurementResult = signal<string | null>(null);
  readonly geodesyInfo = signal<GeodesyMeasurementInfo | null>(null);

  // Среднее магнитное склонение по умолчанию (+8° для восточноевропейского региона)
  private readonly magneticDeclination = 8.0;
  private measurementPoints: [number, number][] = [];

  initLayers(map: maplibregl.Map) {
    const doInit = () => {
      try {
        if (!map.isStyleLoaded()) return;

        if (!map.getSource('measurement-data')) {
          map.addSource('measurement-data', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
          });
        }

        if (!map.getLayer('measurement-fill')) {
          map.addLayer({
            id: 'measurement-fill',
            type: 'fill',
            source: 'measurement-data',
            filter: ['==', '$type', 'Polygon'] as any,
            paint: {
              'fill-color': '#eb3b5a',
              'fill-opacity': 0.15
            }
          });
        }

        if (!map.getLayer('measurement-line')) {
          map.addLayer({
            id: 'measurement-line',
            type: 'line',
            source: 'measurement-data',
            filter: ['in', '$type', 'LineString', 'Polygon'] as any,
            paint: {
              'line-color': '#eb3b5a',
              'line-width': 3,
              'line-dasharray': [2, 2]
            }
          });
        }

        if (!map.getLayer('measurement-points')) {
          map.addLayer({
            id: 'measurement-points',
            type: 'circle',
            source: 'measurement-data',
            filter: ['==', '$type', 'Point'] as any,
            paint: {
              'circle-radius': 5,
              'circle-color': '#eb3b5a',
              'circle-stroke-width': 1.5,
              'circle-stroke-color': '#ffffff'
            }
          });
        }
      } catch (e) {
        console.warn('Map style loading in progress for MapMeasurementService:', e);
      }
    };

    if (map.isStyleLoaded()) {
      doInit();
    } else {
      map.once('style.load', () => doInit());
      map.once('load', () => doInit());
    }
  }

  toggleMeasurement(map: maplibregl.Map | null) {
    if (!map) return;

    if (this.isMeasuring()) {
      this.isMeasuring.set(false);
      this.measurementPoints = [];
      this.measurementResult.set(null);
      this.geodesyInfo.set(null);
      map.getCanvas().style.cursor = '';
      this.updateMeasurementLayers(map);
    } else {
      this.isMeasuring.set(true);
      this.measurementPoints = [];
      this.measurementResult.set(null);
      this.geodesyInfo.set(null);
      map.getCanvas().style.cursor = 'crosshair';
      this.updateMeasurementLayers(map);
    }
  }

  addPoint(coords: [number, number], map: maplibregl.Map) {
    if (!this.isMeasuring()) return;

    this.measurementPoints.push(coords);
    this.updateMeasurementLayers(map);

    this.recalculateGeodesy();
  }

  cancelMeasurement(map: maplibregl.Map) {
    if (this.isMeasuring()) {
      map.getCanvas().style.cursor = '';
      this.isMeasuring.set(false);
    }
  }

  getPoints(): [number, number][] {
    return [...this.measurementPoints];
  }

  private recalculateGeodesy() {
    const points = this.measurementPoints;
    if (points.length < 2) {
      this.measurementResult.set(null);
      this.geodesyInfo.set(null);
      return;
    }

    const dist = this.calculateTotalDistance(points);
    const distStr = dist > 1000 ? `${(dist / 1000).toFixed(2)} км` : `${Math.round(dist)} м`;

    // Азимут от первой до последней точки
    const p1 = points[0];
    const p2 = points[points.length - 1];
    const bearingTrue = this.calculateBearing(p1, p2);
    const bearingMag = (bearingTrue - this.magneticDeclination + 360) % 360;

    let areaM2: number | undefined = undefined;
    let areaStr: string | undefined = undefined;

    if (points.length >= 3) {
      areaM2 = this.calculatePolygonArea(points);
      if (areaM2 >= 1000000) {
        areaStr = `${(areaM2 / 1000000).toFixed(2)} км²`;
      } else if (areaM2 >= 10000) {
        areaStr = `${(areaM2 / 10000).toFixed(2)} га`;
      } else {
        areaStr = `${Math.round(areaM2)} м²`;
      }
    }

    const info: GeodesyMeasurementInfo = {
      distance: dist,
      distanceStr: distStr,
      bearingTrue: parseFloat(bearingTrue.toFixed(1)),
      bearingTrueStr: `${bearingTrue.toFixed(1)}°`,
      bearingMag: parseFloat(bearingMag.toFixed(1)),
      bearingMagStr: `${bearingMag.toFixed(1)}°`,
      areaM2,
      areaStr
    };

    this.geodesyInfo.set(info);
    this.measurementResult.set(areaStr ? `${distStr} | ${areaStr}` : distStr);
  }

  calculateBearing(p1: [number, number], p2: [number, number]): number {
    const lat1 = p1[1] * Math.PI / 180;
    const lat2 = p2[1] * Math.PI / 180;
    const dLng = (p2[0] - p1[0]) * Math.PI / 180;

    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    const brng = Math.atan2(y, x) * 180 / Math.PI;
    return (brng + 360) % 360;
  }

  calculatePolygonArea(points: [number, number][]): number {
    if (points.length < 3) return 0;
    const R = 6378137; // Радиус Земли в метрах
    let area = 0;

    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      const p1 = points[i];
      const p2 = points[j];
      const p1RadLng = p1[0] * Math.PI / 180;
      const p1RadLat = p1[1] * Math.PI / 180;
      const p2RadLng = p2[0] * Math.PI / 180;
      const p2RadLat = p2[1] * Math.PI / 180;

      area += (p2RadLng - p1RadLng) * (2 + Math.sin(p1RadLat) + Math.sin(p2RadLat));
    }

    area = Math.abs(area * R * R / 2);
    return area;
  }

  private calculateTotalDistance(points: [number, number][]): number {
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
      total += this.getDistance(points[i], points[i + 1]);
    }
    return total;
  }

  private getDistance(coord1: [number, number], coord2: [number, number]): number {
    const R = 6371000;
    const lat1 = coord1[1] * Math.PI / 180;
    const lat2 = coord2[1] * Math.PI / 180;
    const deltaLat = (coord2[1] - coord1[1]) * Math.PI / 180;
    const deltaLng = (coord2[0] - coord1[0]) * Math.PI / 180;

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private updateMeasurementLayers(map: maplibregl.Map) {
    const source = map.getSource('measurement-data') as maplibregl.GeoJSONSource;
    if (!source) return;

    const points = this.measurementPoints;
    const features: any[] = [];

    if (points.length > 0) {
      points.forEach((pt) => {
        features.push({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Point',
            coordinates: pt
          }
        });
      });

      if (points.length >= 3) {
        features.push({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [[...points, points[0]]]
          }
        });
      } else if (points.length === 2) {
        features.push({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: points
          }
        });
      }
    }

    source.setData({
      type: 'FeatureCollection',
      features: features
    });
  }
}
