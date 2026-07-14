import { Injectable, signal } from '@angular/core';
import maplibregl from 'maplibre-gl';
import { SCALE_PRESETS, ScaleBarSection, ScalePreset } from '../consts/map-scale.const';

@Injectable({
  providedIn: 'root'
})
export class MapScaleService {
  readonly scaleBarSections = signal<ScaleBarSection[]>([]);
  readonly selectedScaleOption = signal<ScalePreset>(SCALE_PRESETS[1]);

  updateScaleInfo(map: maplibregl.Map | null, containerWidth: number) {
    if (!map) return;

    const center = map.getCenter();
    const zoom = map.getZoom();

    // 1 pixel on map at equator is 156543.033928 meters / 2^zoom
    const metersPerPixel = (156543.033928 * Math.cos(center.lat * Math.PI / 180)) / Math.pow(2, zoom);

    // Target scale bar width: roughly 150-200 px
    const maxMeters = 200 * metersPerPixel;
    const distanceMeters = this.getRoundNumber(maxMeters);
    const totalWidthPx = distanceMeters / metersPerPixel;

    const numSections = 4;
    const sectionWidthPx = totalWidthPx / numSections;
    const sectionDistance = distanceMeters / numSections;

    const sections: ScaleBarSection[] = [];
    for (let i = 0; i < numSections; i++) {
      const dist = sectionDistance * (i + 1);
      const label = dist >= 1000 ? `${(dist / 1000).toFixed(dist % 1000 === 0 ? 0 : 1)} км` : `${Math.round(dist)} м`;
      sections.push({
        widthPx: sectionWidthPx,
        label,
        isDark: i % 2 === 0
      });
    }

    this.scaleBarSections.set(sections);
  }

  selectScale(preset: ScalePreset, map: maplibregl.Map | null) {
    this.selectedScaleOption.set(preset);
    if (map) {
      map.zoomTo(preset.zoom, { duration: 800 });
    }
  }

  private getRoundNumber(num: number): number {
    const pow10 = Math.pow(10, Math.floor(Math.log10(num)));
    const d = num / pow10;
    if (d >= 5) return 5 * pow10;
    if (d >= 2) return 2 * pow10;
    return pow10;
  }
}
