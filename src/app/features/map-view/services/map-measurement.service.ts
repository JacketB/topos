import { Injectable, signal } from '@angular/core';
import maplibregl from 'maplibre-gl';

@Injectable({
  providedIn: 'root'
})
export class MapMeasurementService {
  readonly isMeasuring = signal<boolean>(false);
  readonly measurementResult = signal<string | null>(null);

  private measurementPoints: [number, number][] = [];

  initLayers(map: maplibregl.Map) {
    if (!map.getSource('measurement-data')) {
      map.addSource('measurement-data', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
    }

    if (!map.getLayer('measurement-line')) {
      map.addLayer({
        id: 'measurement-line',
        type: 'line',
        source: 'measurement-data',
        filter: ['==', ['geometry-type'], 'LineString'],
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
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': 5,
          'circle-color': '#eb3b5a',
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff'
        }
      });
    }
  }

  toggleMeasurement(map: maplibregl.Map | null) {
    if (!map) return;

    if (this.isMeasuring()) {
      this.isMeasuring.set(false);
      this.measurementPoints = [];
      this.measurementResult.set(null);
      map.getCanvas().style.cursor = '';
      this.updateMeasurementLayers(map);
    } else {
      this.isMeasuring.set(true);
      this.measurementPoints = [];
      this.measurementResult.set(null);
      map.getCanvas().style.cursor = 'crosshair';
      this.updateMeasurementLayers(map);
    }
  }

  addPoint(coords: [number, number], map: maplibregl.Map) {
    if (!this.isMeasuring()) return;

    this.measurementPoints.push(coords);
    this.updateMeasurementLayers(map);

    const dist = this.calculateTotalDistance(this.measurementPoints);
    if (dist > 0) {
      this.measurementResult.set(dist > 1000 ? `${(dist / 1000).toFixed(2)} км` : `${Math.round(dist)} м`);
    } else {
      this.measurementResult.set(null);
    }
  }

  cancelMeasurement(map: maplibregl.Map) {
    if (this.isMeasuring()) {
      map.getCanvas().style.cursor = '';
      this.isMeasuring.set(false);
    }
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

      if (points.length > 1) {
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
