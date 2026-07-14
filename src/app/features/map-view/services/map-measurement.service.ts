import { Injectable, signal } from '@angular/core';
import maplibregl from 'maplibre-gl';

@Injectable({
  providedIn: 'root'
})
export class MapMeasurementService {
  readonly isDrawModeActive = signal<boolean>(false);
  readonly measurementResult = signal<string | null>(null);

  toggleDrawMode(draw: any, map: maplibregl.Map) {
    if (!draw || !map) return;

    if (this.isDrawModeActive()) {
      draw.changeMode('simple_select');
      draw.deleteAll();
      this.updateMeasurementLayer(map, []);
      this.measurementResult.set(null);
      this.isDrawModeActive.set(false);
      map.getCanvas().style.cursor = '';
    } else {
      draw.deleteAll();
      draw.changeMode('draw_line_string');
      this.isDrawModeActive.set(true);
      map.getCanvas().style.cursor = 'crosshair';
    }
  }

  updateMeasurements(draw: any, map: maplibregl.Map) {
    if (!draw || !map) return;

    const data = draw.getAll();
    if (data.features.length === 0) {
      this.updateMeasurementLayer(map, []);
      this.measurementResult.set(null);
      return;
    }

    const feature = data.features[data.features.length - 1];
    if (feature.geometry.type === 'LineString') {
      const coords = feature.geometry.coordinates;
      let totalDist = 0;
      for (let i = 0; i < coords.length - 1; i++) {
        totalDist += this.calculateDistance(coords[i], coords[i + 1]);
      }

      const formatted = totalDist >= 1000
        ? `${(totalDist / 1000).toFixed(2)} км`
        : `${Math.round(totalDist)} м`;

      this.measurementResult.set(`Расстояние: ${formatted}`);
      this.updateMeasurementLayer(map, [feature]);
    }
  }

  updateMeasurementLayer(map: maplibregl.Map, features: any[]) {
    const source = map.getSource('measurement-line') as maplibregl.GeoJSONSource;
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features: features
      });
    }
  }

  private calculateDistance(coord1: number[], coord2: number[]): number {
    const R = 6371e3; // Earth radius in meters
    const phi1 = coord1[1] * Math.PI / 180;
    const phi2 = coord2[1] * Math.PI / 180;
    const deltaPhi = (coord2[1] - coord1[1]) * Math.PI / 180;
    const deltaLambda = (coord2[0] - coord1[0]) * Math.PI / 180;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}
