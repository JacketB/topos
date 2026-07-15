import { Injectable, signal, inject, computed } from '@angular/core';
import maplibregl from 'maplibre-gl';
import { TacticalSymbolsService } from '../services/tactical-symbols.service';
import { TacticalMapService } from '../services/tactical-map.service';
import { MapScaleService } from '../services/map-scale.service';
import { MapMeasurementService } from '../services/map-measurement.service';
import { MapLayersService } from '../services/map-layers.service';
import { SCALE_PRESETS, ScalePreset } from '../consts/map-scale.const';

@Injectable({
  providedIn: 'root'
})
export class MapViewModel {
  readonly symbolsService = inject(TacticalSymbolsService);
  readonly tacticalMapService = inject(TacticalMapService);
  readonly mapScaleService = inject(MapScaleService);
  readonly mapMeasurementService = inject(MapMeasurementService);
  readonly mapLayersService = inject(MapLayersService);

  readonly scalePresets = SCALE_PRESETS;

  readonly isAppReady = signal<boolean>(false);
  readonly sidebarWidth = signal<number>(340);
  readonly bearing = signal<number>(0);
  readonly cursorCoords = signal<string>('53.9000 С.Ш., 27.5600 В.Д.');
  readonly currentScale = signal<number>(50000);
  readonly isScaleMenuOpen = signal<boolean>(false);
  readonly isQuickLayersMenuOpen = signal<boolean>(false);
  readonly manuallyOpenedCategories = signal<Record<string, boolean>>({});

  readonly isMeasuring = this.mapMeasurementService.isMeasuring;
  readonly measurementResult = this.mapMeasurementService.measurementResult;
  readonly symbolSearchQuery = this.symbolsService.symbolSearchQuery;
  readonly selectedSymbol = this.tacticalMapService.selectedSymbol;
  readonly selectedPlacedSymbol = this.tacticalMapService.selectedPlacedSymbol;
  readonly placedSymbols = this.tacticalMapService.placedSymbols;
  readonly layerGroups = this.mapLayersService.groups;

  private mapInstance: maplibregl.Map | null = null;

  setMapInstance(map: maplibregl.Map) {
    this.mapInstance = map;
  }

  getMapInstance(): maplibregl.Map | null {
    return this.mapInstance;
  }

  toggleQuickLayersMenu() {
    this.isQuickLayersMenuOpen.update(v => !v);
  }

  onQuickLayerToggle(groupId: string) {
    if (groupId === 'elevation') {
      const elevationGroup = this.layerGroups().find(g => g.id === 'elevation');
      const contourLayer = elevationGroup?.layers.find(l => l.id === 'contour_line');
      if (contourLayer) {
        this.mapLayersService.toggleLayer('contour_line', this.mapInstance);
        this.mapLayersService.toggleLayer('contour_label', this.mapInstance);
      } else {
        this.mapLayersService.toggleGroup('elevation', this.mapInstance);
      }
    } else {
      this.mapLayersService.toggleGroup(groupId, this.mapInstance);
    }
  }

  toggleScaleMenu(event?: Event) {
    if (event) event.stopPropagation();
    this.isScaleMenuOpen.update(v => !v);
  }

  selectPresetScale(preset: ScalePreset, event?: Event) {
    if (event) event.stopPropagation();
    this.mapScaleService.selectScale(preset, this.mapInstance);
    this.currentScale.set(preset.scale);
    this.isScaleMenuOpen.set(false);
  }

  toggleMeasurement() {
    this.mapMeasurementService.toggleMeasurement(this.mapInstance);
  }

  resetBearing() {
    if (this.mapInstance) {
      this.mapInstance.resetNorth({ duration: 500 });
    }
  }

  setSidebarWidth(width: number) {
    const newWidth = Math.max(260, Math.min(700, width));
    this.sidebarWidth.set(newWidth);
    if (this.mapInstance) {
      this.mapInstance.resize();
    }
  }

  toggleCategory(categoryId: string) {
    this.manuallyOpenedCategories.update(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  }

  isCategoryOpen(categoryId: string): boolean {
    const query = this.symbolSearchQuery().trim();
    if (query.length > 0) {
      return true;
    }
    return !!this.manuallyOpenedCategories()[categoryId];
  }

  updateSearchQuery(query: string) {
    this.symbolsService.symbolSearchQuery.set(query);
  }

  updatePlacedSymbolSize(size: number) {
    this.tacticalMapService.updatePlacedSymbolSize(size);
  }

  updatePlacedSymbolAngle(angle: number) {
    this.tacticalMapService.updatePlacedSymbolAngle(angle);
  }

  updatePlacedSymbolName(name: string) {
    this.tacticalMapService.updatePlacedSymbolName(name);
  }

  updatePlacedSymbolColor(color: string) {
    this.tacticalMapService.updatePlacedSymbolColor(color);
  }

  updateTemplateSize(size: number) {
    this.tacticalMapService.updateTemplateSize(size);
  }

  updateTemplateAngle(angle: number) {
    this.tacticalMapService.updateTemplateAngle(angle);
  }

  updateTemplateName(name: string) {
    this.tacticalMapService.updateTemplateName(name);
  }

  updateTemplateColor(color: string) {
    this.tacticalMapService.updateTemplateColor(color);
  }

  formatScale(scale: number): string {
    return scale.toLocaleString('ru-RU');
  }

  deletePlacedSymbol() {
    this.tacticalMapService.deleteSelectedPlacedSymbol();
  }

  toggleQuickLayer(groupId: string) {
    this.onQuickLayerToggle(groupId);
  }
}
