import { Injectable, signal, effect, inject, untracked } from '@angular/core';
import maplibregl from 'maplibre-gl';
import { TacticalSymbol } from '../consts/tactical-symbols.const';
import { TrenchGeometryService } from './trench-geometry.service';
import { TerrainService } from './terrain.service';
import { TacticalDrawingService, TacticalLineMode } from './tactical-drawing.service';
import { TacticalSymbolsManagerService } from './tactical-symbols-manager.service';
import { ImageOverlayService } from './image-overlay.service';
import { MapInteractionMode, ObjectGroup } from '../models/tactical-map.types';

export type { MapInteractionMode, ObjectGroup };

type SymbolLoadCallback = () => void;

@Injectable({
  providedIn: 'root'
})
export class TacticalMapService {
  public trenchGeometryService = inject(TrenchGeometryService);
  public terrainService = inject(TerrainService);
  public drawingService = inject(TacticalDrawingService);
  public symbolsManager = inject(TacticalSymbolsManagerService);
  public imageOverlayService = inject(ImageOverlayService);
  public dispatchDataProvider: (() => any) | null = null;
  public dispatchDataConsumer: ((data: any) => void) | null = null;

  private saveStorageTimeout: any = null;
  readonly placedSymbols = signal<any[]>(this.loadFromStorage());

  get activeLineMode() {
    return this.drawingService.activeLineMode;
  }

  get drawingLineCoords() {
    return this.drawingService.drawingLineCoords;
  }

  constructor() {
    effect(() => {
      const symbols = this.placedSymbols();
      if (this.saveStorageTimeout) clearTimeout(this.saveStorageTimeout);
      this.saveStorageTimeout = setTimeout(() => {
        try {
          localStorage.setItem('topos_placed_symbols', JSON.stringify(symbols));
        } catch (e) {
          console.error('Ошибка сохранения символов в localStorage:', e);
        }
      }, 300);
    });

    effect(() => {
      const groups = this.objectGroups();
      try {
        localStorage.setItem('topos_object_groups', JSON.stringify(groups));
      } catch (e) {
        console.error('Ошибка сохранения групп в localStorage:', e);
      }
    });

    effect(() => {
      this.selectedPlacedSymbols();
      this.updateHighlightLayers();
    });

    effect(() => {
      const sel = this.selectedPlacedSymbol();
      if (sel && sel.properties?.['isLinear']) {
        this.updateLinearVerticesSource();
      } else {
        const source = this.mapInstance?.getSource('linear-vertices') as maplibregl.GeoJSONSource;
        if (source) {
          source.setData({ type: 'FeatureCollection', features: [] });
        }
      }
    });

    effect(() => {
      this.selectedPlacedSymbol();
      this.syncTextBoxMarkers();
    });

    effect(() => {
      const mode = this.interactionMode();
      untracked(() => {
        this.isSelectionModeActive.set(mode === 'select');
        this.syncTextBoxMarkers();
      });
    });

  }

  private loadFromStorage(): any[] {
    try {
      const data = localStorage.getItem('topos_placed_symbols');
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  readonly selectedSymbol = signal<TacticalSymbol | null>(null);
  readonly templateCustomName = signal<string>('');
  readonly templateCustomSize = signal<number>(0.08);
  readonly templateCustomAngle = signal<number>(0);
  readonly isTerrainOrientationEnabled = signal<boolean>(true);

  updateTemplateName(name: string) {
    this.templateCustomName.set(name);
  }
  updateTemplateSize(size: number) {
    this.templateCustomSize.set(size);
  }
  updateTemplateAngle(angle: number) {
    this.templateCustomAngle.set(angle);
  }

  readonly selectedPlacedSymbol = signal<any | null>(null);
  readonly selectedPlacedSymbols = signal<any[]>([]);
  readonly objectGroups = signal<ObjectGroup[]>(this.loadGroupsFromStorage());
  readonly activeCalculationGroupId = signal<string>('all');
  readonly isSelectionModeActive = signal<boolean>(false);
  readonly interactionMode = signal<MapInteractionMode>('edit');
  private justSelectedBox = false;

  private undoStack: { symbols: any[]; groups: ObjectGroup[] }[] = [];
  private redoStack: { symbols: any[]; groups: ObjectGroup[] }[] = [];
  private readonly maxHistoryDepth = 50;

  pushHistoryState() {
    try {
      const symbolsSnapshot = JSON.parse(JSON.stringify(this.placedSymbols()));
      const groupsSnapshot = JSON.parse(JSON.stringify(this.objectGroups()));
      this.undoStack.push({ symbols: symbolsSnapshot, groups: groupsSnapshot });
      if (this.undoStack.length > this.maxHistoryDepth) {
        this.undoStack.shift();
      }
      this.redoStack = [];
    } catch {}
  }

  undo(): boolean {
    if (this.undoStack.length === 0) return false;
    try {
      const currentState = {
        symbols: JSON.parse(JSON.stringify(this.placedSymbols())),
        groups: JSON.parse(JSON.stringify(this.objectGroups()))
      };
      this.redoStack.push(currentState);
      const prevState = this.undoStack.pop()!;
      this.placedSymbols.set(prevState.symbols);
      this.objectGroups.set(prevState.groups);
      this.selectedPlacedSymbol.set(null);
      this.selectedPlacedSymbols.set([]);
      this.updateTacticalSymbolsSource();
      this.updateLinearVerticesSource();
      this.syncTextBoxMarkers();
      return true;
    } catch {
      return false;
    }
  }

  redo(): boolean {
    if (this.redoStack.length === 0) return false;
    try {
      const currentState = {
        symbols: JSON.parse(JSON.stringify(this.placedSymbols())),
        groups: JSON.parse(JSON.stringify(this.objectGroups()))
      };
      this.undoStack.push(currentState);
      const nextState = this.redoStack.pop()!;
      this.placedSymbols.set(nextState.symbols);
      this.objectGroups.set(nextState.groups);
      this.selectedPlacedSymbol.set(null);
      this.selectedPlacedSymbols.set([]);
      this.updateTacticalSymbolsSource();
      this.updateLinearVerticesSource();
      this.syncTextBoxMarkers();
      return true;
    } catch {
      return false;
    }
  }

  selectPlacedSymbol(symbol: any | null) {
    this.selectedPlacedSymbol.set(symbol);
    if (symbol) {
      this.selectedPlacedSymbols.set([symbol]);
    } else {
      this.selectedPlacedSymbols.set([]);
    }
    this.updateLinearVerticesSource();
  }

  toggleSelectPlacedSymbol(symbol: any) {
    if (!symbol) return;
    const current = this.selectedPlacedSymbols();
    const idStr = String(symbol.properties?.id);
    const exists = current.some(s => String(s.properties?.id) === idStr);
    if (exists) {
      const updated = current.filter(s => String(s.properties?.id) !== idStr);
      this.selectedPlacedSymbols.set(updated);
      this.selectedPlacedSymbol.set(updated.length > 0 ? updated[updated.length - 1] : null);
    } else {
      const updated = [...current, symbol];
      this.selectedPlacedSymbols.set(updated);
      this.selectedPlacedSymbol.set(symbol);
    }
    this.updateLinearVerticesSource();
  }

  createGroup(name: string) {
    this.pushHistoryState();
    const newGroup: ObjectGroup = {
      id: `group_${Date.now()}`,
      name: name,
      elementIds: []
    };
    this.objectGroups.update(prev => [...prev, newGroup]);
    return newGroup;
  }

  deleteGroup(groupId: string) {
    this.pushHistoryState();
    this.objectGroups.update(prev => prev.filter(g => g.id !== groupId));
    if (this.activeCalculationGroupId() === groupId) {
      this.activeCalculationGroupId.set('all');
    }
  }

  renameGroup(groupId: string, newName: string) {
    this.pushHistoryState();
    this.objectGroups.update(prev => prev.map(g => g.id === groupId ? { ...g, name: newName } : g));
  }

  addElementsToGroup(groupId: string, elementIds: number[]) {
    this.pushHistoryState();
    this.objectGroups.update(groups => {
      return groups.map(g => {
        if (g.id !== groupId) {
          return {
            ...g,
            elementIds: g.elementIds.filter(id => !elementIds.includes(id))
          };
        }
        const currentIds = g.elementIds;
        const newIds = [...currentIds, ...elementIds.filter(id => !currentIds.includes(id))];
        return { ...g, elementIds: newIds };
      });
    });
  }

  removeElementsFromGroup(groupId: string, elementIds: number[]) {
    this.pushHistoryState();
    this.objectGroups.update(groups => {
      return groups.map(g => {
        if (g.id === groupId) {
          return {
            ...g,
            elementIds: g.elementIds.filter(id => !elementIds.includes(id))
          };
        }
        return g;
      });
    });
  }

  toggleSymbolVisibility(id: number | string) {
    const idStr = String(id);
    this.pushHistoryState();
    this.placedSymbols.update(prev =>
      prev.map(s => {
        if (String(s.properties?.id) === idStr) {
          const isHidden = !s.properties.hidden;
          return { ...s, properties: { ...s.properties, hidden: isHidden } };
        }
        return s;
      })
    );
    const sel = this.selectedPlacedSymbol();
    if (sel && String(sel.properties?.id) === idStr) {
      const updated = this.placedSymbols().find(s => String(s.properties?.id) === idStr);
      if (updated?.properties?.hidden) {
        this.selectedPlacedSymbol.set(null);
        this.selectedPlacedSymbols.update(prev => prev.filter(s => String(s.properties?.id) !== idStr));
      }
    }
    this.updateTacticalSymbolsSource();
    this.syncTextBoxMarkers();
    this.updateLinearVerticesSource();
  }

  toggleGroupVisibility(groupId: string) {
    const group = this.objectGroups().find(g => g.id === groupId);
    if (!group) return;
    this.pushHistoryState();
    const allHidden = this.isGroupHidden(groupId);
    const newHidden = !allHidden;
    const groupIds = new Set(group.elementIds.map(String));
    this.placedSymbols.update(prev =>
      prev.map(s => {
        if (groupIds.has(String(s.properties?.id))) {
          return { ...s, properties: { ...s.properties, hidden: newHidden } };
        }
        return s;
      })
    );
    if (newHidden) {
      this.selectedPlacedSymbols.update(prev => prev.filter(s => !groupIds.has(String(s.properties?.id))));
      const currentSelected = this.selectedPlacedSymbol();
      if (currentSelected && groupIds.has(String(currentSelected.properties?.id))) {
        this.selectedPlacedSymbol.set(null);
      }
    }
    this.updateTacticalSymbolsSource();
    this.syncTextBoxMarkers();
    this.updateLinearVerticesSource();
  }

  isGroupHidden(groupId: string): boolean {
    const group = this.objectGroups().find(g => g.id === groupId);
    if (!group || group.elementIds.length === 0) return false;
    const groupIds = new Set(group.elementIds.map(String));
    const groupSymbols = this.placedSymbols().filter(item => groupIds.has(String(item.properties?.id)));
    if (groupSymbols.length === 0) return false;
    return groupSymbols.every(s => !!s.properties?.hidden);
  }

  private loadGroupsFromStorage(): ObjectGroup[] {
    try {
      const data = localStorage.getItem('topos_object_groups');
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Ошибка загрузки групп из localStorage:', e);
      return [];
    }
  }

  private mapInstance: maplibregl.Map | null = null;
  private isDragging = false;
  private dragFeature: any = null;
  private dragRafId: any = null;
  private pendingDragLngLat: [number, number] | null = null;

  private isDraggingVertex = false;
  private dragVertexFeature: any = null;
  private dragVertexRafId: any = null;
  private pendingDragVertexLngLat: [number, number] | null = null;

  readonly templateCustomColor = signal<string>('');
  readonly activeDrawingMode = signal<string>('none');

  updateLinearVerticesSource() {
    if (!this.mapInstance || !this.mapInstance.getStyle()) return;
    try {
      const source = this.mapInstance.getSource('linear-vertices') as maplibregl.GeoJSONSource;
      if (!source) return;

      const selected = this.selectedPlacedSymbol();
      if (selected && selected.properties?.['isLinear']) {
        const origCoords = selected.properties['origCoords'] as [number, number][];
        const symbolId = selected.properties['id'];
        if (origCoords) {
          const features = origCoords.map((coord, idx) => ({
            type: 'Feature' as const,
            properties: { symbolId, vertexIndex: idx },
            geometry: { type: 'Point' as const, coordinates: coord }
          }));
          source.setData({ type: 'FeatureCollection', features });
          return;
        }
      }
      source.setData({ type: 'FeatureCollection', features: [] });
    } catch {}
  }

  updateHighlightLayers() {
    if (!this.mapInstance || !this.mapInstance.getStyle()) return;
    try {
      const selected = this.selectedPlacedSymbols();
      const symbolLayer = this.mapInstance.getLayer('tactical_symbols_highlight_layer');
      const lineLayer = this.mapInstance.getLayer('tactical_lines_highlight_layer');
      const polyLayer = this.mapInstance.getLayer('tactical_polygons_highlight_layer');

      if (selected.length === 0) {
        const emptyFilter = ['==', 'id', ''] as any;
        if (symbolLayer) this.mapInstance.setFilter('tactical_symbols_highlight_layer', emptyFilter);
        if (lineLayer) this.mapInstance.setFilter('tactical_lines_highlight_layer', emptyFilter);
        if (polyLayer) this.mapInstance.setFilter('tactical_polygons_highlight_layer', emptyFilter);
      } else {
        const idValues: (string | number)[] = [];
        selected.forEach(s => {
          const val = s.properties?.['id'];
          if (val !== undefined && val !== null) {
            idValues.push(Number(val));
            idValues.push(String(val));
          }
        });

        const idFilter = ['in', 'id', ...idValues];
        
        if (symbolLayer) this.mapInstance.setFilter('tactical_symbols_highlight_layer', ['all', ['==', '$type', 'Point'], idFilter] as any);
        if (lineLayer) this.mapInstance.setFilter('tactical_lines_highlight_layer', ['all', ['==', '$type', 'LineString'], idFilter] as any);
        if (polyLayer) this.mapInstance.setFilter('tactical_polygons_highlight_layer', ['all', ['==', '$type', 'Polygon'], idFilter] as any);
      }
    } catch {}
  }

  private currentMarchPlaces: any[] = [];

  updateMarchPlacesSource(places: Array<{ name: string; coords: [number, number]; distanceAlongRouteKm?: number }>) {
    this.currentMarchPlaces = places || [];
    if (!this.mapInstance || !this.mapInstance.getStyle()) return;
    try {
      const source = this.mapInstance.getSource('march-places') as maplibregl.GeoJSONSource;
      if (!source) return;

      const features = (places || []).map((p: any, idx) => {
        return {
          type: 'Feature',
          properties: {
            id: `march_place_${idx}`,
            name: p.name,
            distanceKm: p.distanceAlongRouteKm,
            textAnchor: p.textAnchor || 'center',
            textOffset: p.textOffset || [0, 0],
            svgAnchor: p.svgAnchor || 'middle',
            svgOffset: p.svgOffset || [0, 0],
            svgBaseline: p.svgBaseline || 'central'
          },
          geometry: {
            type: 'Point',
            coordinates: p.coords
          }
        };
      });

      source.setData({
        type: 'FeatureCollection',
        features
      });
    } catch {}
  }

  private currentMarchKilometers: any[] = [];

  updateMarchKilometersSource(marks: Array<{ km: number; label: string; coords: [number, number]; bearing?: number }>) {
    this.currentMarchKilometers = marks || [];
    if (!this.mapInstance || !this.mapInstance.getStyle()) return;
    try {
      const source = this.mapInstance.getSource('march-kilometers') as maplibregl.GeoJSONSource;
      if (!source) return;

      const features = (marks || []).map((m, idx) => ({
        type: 'Feature',
        properties: {
          id: `march_km_${idx}`,
          label: m.label,
          km: m.km,
          bearing: m.bearing || 0
        },
        geometry: {
          type: 'Point',
          coordinates: m.coords
        }
      }));

      source.setData({
        type: 'FeatureCollection',
        features
      });
    } catch {}
  }

  updatePlaybackMarker(coords: [number, number] | null, angle: number = 0) {
    if (!this.mapInstance || !this.mapInstance.getStyle()) return;
    try {
      const source = this.mapInstance.getSource('playback-source') as maplibregl.GeoJSONSource;
      if (!source) return;

      if (!coords) {
        source.setData({ type: 'FeatureCollection', features: [] });
        return;
      }

      source.setData({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: { bearing: angle },
          geometry: {
            type: 'Point',
            coordinates: coords
          }
        }]
      });
    } catch {}
  }


  initLayers(map: maplibregl.Map) {
    if (!map || !map.getStyle()) return;
    this.mapInstance = map;
    this.pendingImages.clear();
    if (!map.getSource('tactical-symbols')) {
      map.addSource('tactical-symbols', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: this.placedSymbols().filter(s => !s.properties?.hidden) }
      });
    }

    if (!map.getLayer('tactical_polygons_fill_layer')) {
      map.addLayer({
        id: 'tactical_polygons_fill_layer',
        type: 'fill',
        source: 'tactical-symbols',
        filter: ['==', '$type', 'Polygon'],
        paint: {
          'fill-color': ['coalesce', ['get', 'color'], '#ef4444'],
          'fill-opacity': ['coalesce', ['get', 'fillOpacity'], 0.4]
        }
      });
    }

    if (!map.getLayer('tactical_polygons_outline_layer')) {
      map.addLayer({
        id: 'tactical_polygons_outline_layer',
        type: 'line',
        source: 'tactical-symbols',
        filter: ['==', '$type', 'Polygon'],
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': ['coalesce', ['get', 'color'], '#ef4444'],
          'line-width': 2.5,
          'line-dasharray': ['coalesce', ['get', 'lineDashArray'], ['literal', [1, 0]]]
        }
      });
    }

    if (!map.getLayer('tactical_polygons_highlight_layer')) {
      map.addLayer({
        id: 'tactical_polygons_highlight_layer',
        type: 'line',
        source: 'tactical-symbols',
        filter: ['==', 'id', ''],
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#2563eb',
          'line-width': 4.5,
          'line-opacity': 0.7,
          'line-dasharray': [2, 2]
        }
      }, 'tactical_polygons_outline_layer');
    }

    if (!map.getLayer('tactical_lines_casing_layer')) {
      map.addLayer({
        id: 'tactical_lines_casing_layer',
        type: 'line',
        source: 'tactical-symbols',
        filter: ['==', '$type', 'LineString'],
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#ffffff',
          'line-width': ['+', ['coalesce', ['get', 'lineWidth'], 3.5], 2.5],
          'line-opacity': 0.85
        }
      });
    }

    if (!map.getLayer('tactical_lines_layer')) {
      map.addLayer({
        id: 'tactical_lines_layer',
        type: 'line',
        source: 'tactical-symbols',
        filter: ['==', '$type', 'LineString'],
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': ['coalesce', ['get', 'color'], '#854d0e'],
          'line-width': ['coalesce', ['get', 'lineWidth'], 3.5],
          'line-opacity': 0.95
        }
      });
    }

    if (!map.getLayer('tactical_lines_highlight_layer')) {
      map.addLayer({
        id: 'tactical_lines_highlight_layer',
        type: 'line',
        source: 'tactical-symbols',
        filter: ['==', 'id', ''],
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#2563eb',
          'line-width': 7,
          'line-opacity': 0.4
        }
      }, 'tactical_lines_layer');
    }

    if (!map.getLayer('tactical_symbols_layer')) {
      map.addLayer({
        id: 'tactical_symbols_layer',
        type: 'symbol',
        source: 'tactical-symbols',
        filter: ['all', ['==', '$type', 'Point'], ['!=', 'isLinear', true], ['!=', 'symbol', 'text_box'], ['!=', 'isText', true]],
        layout: {
          'icon-image': ['coalesce', ['get', 'iconId'], ['get', 'symbol'], ''],
          'icon-size': ['coalesce', ['get', 'size'], 0.08],
          'icon-rotate': ['coalesce', ['get', 'angle'], 0],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'text-field': ['coalesce', ['get', 'name'], ''],
          'text-size': ['coalesce', ['get', 'textSize'], 11],
          'text-rotate': ['coalesce', ['get', 'textRotate'], 0],
          'text-offset': ['coalesce', ['get', 'textOffset'], ['literal', [0, 1.8]]],
          'text-anchor': ['coalesce', ['get', 'textAnchor'], 'top'],
          'text-allow-overlap': true,
          'text-ignore-placement': true
        },
        paint: {
          'text-color': ['coalesce', ['get', 'textColor'], '#222222'],
          'text-halo-color': ['coalesce', ['get', 'textHaloColor'], '#ffffff'],
          'text-halo-width': ['coalesce', ['get', 'textHaloWidth'], 1.5],
          'icon-opacity': 1,
          'icon-opacity-transition': { duration: 0 },
          'text-opacity': 1,
          'text-opacity-transition': { duration: 0 }
        }
      });
    } else {
      map.setFilter('tactical_symbols_layer', ['all', ['==', '$type', 'Point'], ['!=', 'isLinear', true], ['!=', 'symbol', 'text_box'], ['!=', 'isText', true]]);
      map.setLayoutProperty('tactical_symbols_layer', 'icon-image', ['coalesce', ['get', 'iconId'], ['get', 'symbol'], '']);
      map.setLayoutProperty('tactical_symbols_layer', 'icon-size', ['coalesce', ['get', 'size'], 0.08]);
      map.setLayoutProperty('tactical_symbols_layer', 'text-size', ['coalesce', ['get', 'textSize'], 11]);
      map.setLayoutProperty('tactical_symbols_layer', 'text-rotate', ['coalesce', ['get', 'textRotate'], 0]);
      map.setLayoutProperty('tactical_symbols_layer', 'text-offset', ['coalesce', ['get', 'textOffset'], ['literal', [0, 1.8]]]);
      map.setLayoutProperty('tactical_symbols_layer', 'text-anchor', ['coalesce', ['get', 'textAnchor'], 'top']);
      map.setPaintProperty('tactical_symbols_layer', 'text-color', ['coalesce', ['get', 'textColor'], '#222222']);
      map.setPaintProperty('tactical_symbols_layer', 'text-halo-color', ['coalesce', ['get', 'textHaloColor'], '#ffffff']);
      map.setPaintProperty('tactical_symbols_layer', 'text-halo-width', ['coalesce', ['get', 'textHaloWidth'], 1.5]);
    }

    if (!map.getLayer('tactical_symbols_highlight_layer')) {
      map.addLayer({
        id: 'tactical_symbols_highlight_layer',
        type: 'circle',
        source: 'tactical-symbols',
        filter: ['==', 'id', ''],
        paint: {
          'circle-radius': 18,
          'circle-color': 'rgba(37, 99, 235, 0.25)',
          'circle-stroke-color': '#2563eb',
          'circle-stroke-width': 2
        }
      }, 'tactical_symbols_layer');
    }

    if (!map.getSource('linear-vertices')) {
      map.addSource('linear-vertices', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
    }

    if (!map.getLayer('linear_vertices_layer')) {
      map.addLayer({
        id: 'linear_vertices_layer',
        type: 'circle',
        source: 'linear-vertices',
        paint: {
          'circle-radius': 6,
          'circle-color': '#ffffff',
          'circle-stroke-color': '#2563eb',
          'circle-stroke-width': 2.5
        }
      });
    }

    if (!map.getSource('march-places')) {
      map.addSource('march-places', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
    }

    if (map.getLayer('march_places_dots')) {
      map.removeLayer('march_places_dots');
    }

    if (!map.getLayer('march_places_labels')) {
      map.addLayer({
        id: 'march_places_labels',
        type: 'symbol',
        source: 'march-places',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 13,
          'text-font': ['Noto Sans Regular'],
          'text-anchor': ['coalesce', ['get', 'textAnchor'], 'center'],
          'text-offset': ['coalesce', ['get', 'textOffset'], ['literal', [0, 0]]],
          'text-justify': 'auto',
          'text-allow-overlap': false,
          'text-ignore-placement': false,
          'text-padding': 6
        },
        paint: {
          'text-color': '#1e3a8a',
          'text-halo-color': '#ffffff',
          'text-halo-width': 2.2
        }
      });
    }

    if (this.currentMarchPlaces.length > 0) {
      this.updateMarchPlacesSource(this.currentMarchPlaces);
    }

    if (!map.getSource('march-kilometers')) {
      map.addSource('march-kilometers', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
    }

    if (!map.getLayer('march_kilometers_ticks')) {
      map.addLayer({
        id: 'march_kilometers_ticks',
        type: 'circle',
        source: 'march-kilometers',
        paint: {
          'circle-radius': 4.0,
          'circle-color': '#ffffff',
          'circle-stroke-color': '#1d4ed8',
          'circle-stroke-width': 2.0
        }
      });
    }

    if (!map.getLayer('march_kilometers_labels')) {
      map.addLayer({
        id: 'march_kilometers_labels',
        type: 'symbol',
        source: 'march-kilometers',
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 10,
          'text-font': ['Noto Sans Regular'],
          'text-offset': [0.7, 0],
          'text-anchor': 'left',
          'text-allow-overlap': true,
          'text-ignore-placement': true
        },
        paint: {
          'text-color': '#1d4ed8',
          'text-halo-color': '#ffffff',
          'text-halo-width': 2.0
        }
      });
    }

    if (this.currentMarchKilometers.length > 0) {
      this.updateMarchKilometersSource(this.currentMarchKilometers);
    }


    if (!map.getSource('playback-source')) {
      map.addSource('playback-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
    }

    if (!map.getLayer('playback_marker_layer')) {
      map.addLayer({
        id: 'playback_marker_layer',
        type: 'symbol',
        source: 'playback-source',
        layout: {
          'icon-image': 'avto1_c_ef4444',
          'icon-size': 0.12,
          'icon-rotate': ['get', 'bearing'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true
        }
      });
    }

    this.ensureSymbolColorImageLoadedForId('avto1', '#ef4444', 'avto1_c_ef4444', () => {});

    this.placedSymbols().forEach(s => {
      const symbolId = s.properties['symbol'];
      const iconId = s.properties['iconId'] || symbolId;
      const color = s.properties['color'] || '';
      if (color) {
        this.ensureSymbolColorImageLoadedForId(symbolId, color, iconId, () => this.updateTacticalSymbolsSource());
      } else {
        this.ensureSymbolImageLoadedForId(symbolId, iconId, () => this.updateTacticalSymbolsSource());
      }
    });
    this.syncTextBoxMarkers();
  }

  init(map: maplibregl.Map | null) {
    this.mapInstance = map;
    this.pendingImages.clear();
    if (!map) return;
    this.setupSymbolDragging(map);
    this.setupBoxSelection(map);

    map.on('click', (e) => {
      if (this.justSelectedBox) {
        this.justSelectedBox = false;
        return;
      }
      if (this.activeDrawingMode() !== 'none') {
        return;
      }

      const template = this.selectedSymbol();
      if (template) {
        const coords: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        const color = this.templateCustomColor();
        const iconId = color ? `${template.symbol}_c_${color.replace('#', '')}` : template.symbol;
        const newSymbol = {
          type: 'Feature',
          properties: {
            id: Date.now(),
            symbol: template.symbol,
            iconId: iconId,
            color: color || '',
            name: this.templateCustomName() || template.name,
            size: this.templateCustomSize(),
            angle: this.templateCustomAngle(),
            hasPatrol: template.hasPatrol ?? false,
            patrolStyle: template.patrolStyle || 'solid',
            patrolLength: template.patrolLength || 400,
            patrolAngle: template.patrolAngle ?? this.templateCustomAngle() ?? 0
          },
          geometry: {
            type: 'Point',
            coordinates: coords
          }
        };

        const onReady = () => {
          this.pushHistoryState();
          this.placedSymbols.update(prev => [...prev, newSymbol]);
          this.updateTacticalSymbolsSource();
          this.selectPlacedSymbol(newSymbol);

          if (this.isTerrainOrientationEnabled() && template.symbol.startsWith('fort_')) {
            this.terrainService.getSlopeBearing(coords[0], coords[1]).then(bearing => {
              if (bearing !== null) {
                this.placedSymbols.update(prev => 
                  prev.map(s => s.properties['id'] === newSymbol.properties.id ? {
                    ...s,
                    properties: { ...s.properties, angle: bearing }
                  } : s)
                );
                this.syncSelectedPlacedSymbol();
                this.updateTacticalSymbolsSource();
              }
            });
          }
        };

        if (color) {
          this.ensureSymbolColorImageLoaded(template.symbol, color, onReady);
        } else {
          this.ensureSymbolImageLoaded(template.symbol, onReady);
        }
        this.selectedSymbol.set(null);
        map.getCanvas().style.cursor = '';
        return;
      }

      const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
        [e.point.x - 6, e.point.y - 6],
        [e.point.x + 6, e.point.y + 6]
      ];
      const availableLayers = [
        'tactical_symbols_layer',
        'tactical_lines_layer',
        'tactical_polygons_fill_layer',
        'tactical_polygons_outline_layer'
      ].filter(id => !!map.getLayer(id));

      const features = map.queryRenderedFeatures(bbox, {
        layers: availableLayers
      });

      if (features.length > 0) {
        const feat = features[0];
        const targetId = feat.properties?.['parentId'] || feat.properties?.['id'];
        const found = this.placedSymbols().find(s => s.properties['id'] === targetId || String(s.properties['id']) === String(targetId));
        if (found) {
          if (found.properties?.['lineType'] === 'march_route') {
            return;
          }
          if (e.originalEvent && (e.originalEvent.shiftKey || e.originalEvent.ctrlKey)) {
            this.toggleSelectPlacedSymbol(found);
          } else {
            this.selectPlacedSymbol(found);
          }
          return;
        }
      } else {
        if (!e.originalEvent || (!e.originalEvent.shiftKey && !e.originalEvent.ctrlKey)) {
          this.selectPlacedSymbol(null);
        }
      }
    });
  }

  private pendingImages = new Set<string>();

  private addFallbackImage(targetIconId: string) {
    if (!this.mapInstance || this.mapInstance.hasImage(targetIconId)) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const imgData = ctx.createImageData(1, 1);
        this.mapInstance.addImage(targetIconId, imgData);
      }
    } catch {}
  }

  handleMissingImage(missingId: string) {
    if (!this.mapInstance || !missingId) return;
    if (this.mapInstance.hasImage(missingId)) return;
    if (this.pendingImages.has(missingId)) return;

    let symbolId = missingId;
    let color = '';

    if (missingId.includes('_c_')) {
      const parts = missingId.split('_c_');
      symbolId = parts[0];
      color = '#' + parts[1];
    } else {
      const found = this.placedSymbols().find(s => s.properties['iconId'] === missingId || s.properties['symbol'] === missingId);
      if (found) {
        symbolId = found.properties['symbol'];
        color = found.properties['color'] || '';
      } else if (missingId.includes('_')) {
        const clean = missingId.replace(/_\d+$/, '');
        symbolId = clean;
      }
    }

    if (color) {
      this.ensureSymbolColorImageLoadedForId(symbolId, color, missingId, () => {
        this.updateTacticalSymbolsSource();
      });
    } else {
      this.ensureSymbolImageLoadedForId(symbolId, missingId, () => {
        this.updateTacticalSymbolsSource();
      });
    }
  }

  ensureSymbolImageLoaded(symbolId: string, callback: SymbolLoadCallback | null = null) {
    this.ensureSymbolImageLoadedForId(symbolId, symbolId, callback);
  }

  ensureSymbolImageLoadedForId(symbolId: string, targetIconId: string, callback: SymbolLoadCallback | null = null) {
    if (!this.mapInstance || !symbolId || !targetIconId) {
      if (callback) callback();
      return;
    }
    if (this.mapInstance.hasImage(targetIconId)) {
      if (callback) callback();
      return;
    }
    if (this.pendingImages.has(targetIconId)) {
      if (callback) callback();
      return;
    }
    this.pendingImages.add(targetIconId);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = `symbols/${symbolId}.svg`;
    img.onload = () => {
      if (this.mapInstance) {
        if (this.mapInstance.hasImage(targetIconId)) {
          this.mapInstance.removeImage(targetIconId);
        }
        this.mapInstance.addImage(targetIconId, img);
      }
      this.pendingImages.delete(targetIconId);
      if (callback) callback();
    };
    img.onerror = () => {
      this.addFallbackImage(targetIconId);
      this.pendingImages.delete(targetIconId);
      if (callback) callback();
    };
  }

  ensureSymbolColorImageLoaded(symbolId: string, color: string, callback: SymbolLoadCallback | null = null) {
    const coloredIconId = `${symbolId}_c_${color.replace('#', '')}`;
    this.ensureSymbolColorImageLoadedForId(symbolId, color, coloredIconId, callback);
  }

  ensureSymbolColorImageLoadedForId(symbolId: string, color: string, targetIconId: string, callback: SymbolLoadCallback | null = null) {
    if (!this.mapInstance || !symbolId || !targetIconId) {
      if (callback) callback();
      return;
    }
    if (!color) {
      this.ensureSymbolImageLoadedForId(symbolId, targetIconId, callback);
      return;
    }
    if (this.mapInstance.hasImage(targetIconId)) {
      if (callback) callback();
      return;
    }
    if (this.pendingImages.has(targetIconId)) {
      if (callback) callback();
      return;
    }
    this.pendingImages.add(targetIconId);

    fetch(`symbols/${symbolId}.svg`)
      .then(r => {
        if (!r.ok) throw new Error('Not found');
        return r.text();
      })
      .then(svgText => {
        try {
          const parser = new DOMParser();
          const doc = parser.parseFromString(svgText, 'image/svg+xml');
          const elements = doc.querySelectorAll('path, polygon, circle, rect, line, polyline, ellipse');
          elements.forEach(el => {
            const stroke = el.getAttribute('stroke');
            if (stroke && stroke !== 'none' && stroke !== 'transparent') {
              el.setAttribute('stroke', color);
            }
            const fill = el.getAttribute('fill');
            if (fill && fill !== 'none' && fill !== 'transparent') {
              el.setAttribute('fill', color);
            }
            if (!stroke && !fill && el.tagName.toLowerCase() === 'path') {
              el.setAttribute('fill', color);
            }
          });

          const xmlSerializer = new XMLSerializer();
          const modifiedSvg = xmlSerializer.serializeToString(doc);
          const encodedSvg = encodeURIComponent(modifiedSvg);
          const dataUrl = `data:image/svg+xml;charset=utf-8,${encodedSvg}`;

          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = dataUrl;
          img.onload = () => {
            if (this.mapInstance) {
              if (this.mapInstance.hasImage(targetIconId)) {
                this.mapInstance.removeImage(targetIconId);
              }
              this.mapInstance.addImage(targetIconId, img);
            }
            this.pendingImages.delete(targetIconId);
            if (callback) callback();
          };
          img.onerror = () => {
            this.addFallbackImage(targetIconId);
            this.pendingImages.delete(targetIconId);
            if (callback) callback();
          };
        } catch {
          this.addFallbackImage(targetIconId);
          this.pendingImages.delete(targetIconId);
          if (callback) callback();
        }
      })
      .catch(() => {
        this.addFallbackImage(targetIconId);
        this.pendingImages.delete(targetIconId);
        if (callback) callback();
      });
  }

  selectTemplateSymbol(symbol: TacticalSymbol) {
    if (this.selectedSymbol()?.id === symbol.id) {
      this.selectedSymbol.set(null);
      if (this.mapInstance) this.mapInstance.getCanvas().style.cursor = '';
    } else {
      this.interactionMode.set('edit');
      this.selectedSymbol.set(symbol);
      this.templateCustomName.set(symbol.name);
      this.templateCustomSize.set(0.08);
      this.templateCustomAngle.set(0);
      this.templateCustomColor.set('');
      if (this.mapInstance) {
        this.mapInstance.getCanvas().style.cursor = 'copy';
        this.ensureSymbolImageLoaded(symbol.symbol);
      }
      this.selectedPlacedSymbol.set(null);
    }
  }

  updatePlacedSymbolSize(size: number) {
    const selected = this.selectedPlacedSymbol();
    if (selected) {
      const isLin = selected.properties?.['isLinear'];
      const id = selected.properties['id'];
      
      this.placedSymbols.update(prev => 
        prev.map(s => {
          if (s.properties['id'] === id) {
            const nextLineWidth = isLin ? size : s.properties['lineWidth'];
            let nextGeom = s.geometry;
            
            if (isLin) {
              const origCoords = s.properties['origCoords'];
              const lineType = s.properties['lineType'];
              const flipSide = !!s.properties['flipSide'];
              const isSmooth = !!s.properties['isSmooth'];
              
              nextGeom = this.trenchGeometryService.generateLinearGeometry(
                origCoords, 
                lineType, 
                flipSide, 
                isSmooth, 
                nextLineWidth
              );
            }
            
            return {
              ...s,
              properties: { 
                ...s.properties, 
                size,
                lineWidth: nextLineWidth
              },
              geometry: nextGeom
            };
          }
          return s;
        })
      );
      this.syncSelectedPlacedSymbol();
      this.updateTacticalSymbolsSource();
      if (isLin) {
        this.updateLinearVerticesSource();
      }
    }
  }

  updatePlacedSymbolAngle(angle: number) {
    const selected = this.selectedPlacedSymbol();
    if (selected) {
      const id = selected.properties['id'];
      const isText = selected.properties['isText'] || selected.properties['symbol'] === 'text_box';
      this.placedSymbols.update(prev => 
        prev.map(s => s.properties['id'] === id ? {
          ...s,
          properties: { ...s.properties, angle }
        } : s)
      );
      this.syncSelectedPlacedSymbol();
      if (!isText) {
        this.updateTacticalSymbolsSource();
      }
      this.syncTextBoxMarkers();
    }
  }

  updatePlacedSymbolProperty(key: string, value: any) {
    const selected = this.selectedPlacedSymbol();
    if (selected) {
      const id = selected.properties['id'];
      const isText = selected.properties['isText'] || selected.properties['symbol'] === 'text_box';
      this.placedSymbols.update(prev => 
        prev.map(s => s.properties['id'] === id ? {
          ...s,
          properties: { ...s.properties, [key]: value }
        } : s)
      );
      this.syncSelectedPlacedSymbol();
      if (!isText) {
        this.updateTacticalSymbolsSource();
      }
      this.syncTextBoxMarkers();
    }
  }

  updatePlacedSymbolProperties(props: Record<string, any>) {
    const selected = this.selectedPlacedSymbol();
    if (selected) {
      const id = selected.properties['id'];
      const isText = selected.properties['isText'] || selected.properties['symbol'] === 'text_box';
      this.placedSymbols.update(prev => 
        prev.map(s => s.properties['id'] === id ? {
          ...s,
          properties: { ...s.properties, ...props }
        } : s)
      );
      this.syncSelectedPlacedSymbol();
      if (!isText) {
        this.updateTacticalSymbolsSource();
      }
      this.syncTextBoxMarkers();
    }
  }

  updatePlacedSymbolName(name: string) {
    const selected = this.selectedPlacedSymbol();
    if (selected) {
      const id = selected.properties['id'];
      const isText = selected.properties['isText'] || selected.properties['symbol'] === 'text_box';
      this.placedSymbols.update(prev => 
        prev.map(s => s.properties['id'] === id ? {
          ...s,
          properties: { ...s.properties, name }
        } : s)
      );
      this.syncSelectedPlacedSymbol();
      if (!isText) {
        this.updateTacticalSymbolsSource();
      }
      this.syncTextBoxMarkers();
    }
  }

  updatePlacedSymbolColor(color: string) {
    const selected = this.selectedPlacedSymbol();
    if (selected) {
      const id = selected.properties['id'];
      const isText = selected.properties['isText'] || selected.properties['symbol'] === 'text_box';
      if (isText) {
        this.placedSymbols.update(prev => 
          prev.map(s => s.properties['id'] === id ? {
            ...s,
            properties: { ...s.properties, color, textColor: color }
          } : s)
        );
        this.syncSelectedPlacedSymbol();
        this.syncTextBoxMarkers();
        return;
      }

      if (selected.properties?.['isLinear']) {
        this.placedSymbols.update(prev => 
          prev.map(s => s.properties['id'] === id ? {
            ...s,
            properties: { ...s.properties, color }
          } : s)
        );
        this.syncSelectedPlacedSymbol();
        this.updateTacticalSymbolsSource();
        this.syncTextBoxMarkers();
        return;
      }

      const symbolId = selected.properties['symbol'];
      const iconId = color ? `${symbolId}_c_${color.replace('#', '')}` : symbolId;

      const applyUpdate = () => {
        this.placedSymbols.update(prev => 
          prev.map(s => s.properties['id'] === id ? {
            ...s,
            properties: { ...s.properties, color, iconId }
          } : s)
        );
        this.syncSelectedPlacedSymbol();
        this.updateTacticalSymbolsSource();
        this.syncTextBoxMarkers();
      };

      if (color) {
        this.ensureSymbolColorImageLoaded(symbolId, color, applyUpdate);
      } else {
        applyUpdate();
      }
    }
  }

  updateTemplateColor(color: string) {
    this.templateCustomColor.set(color);
  }

  deleteSelectedPlacedSymbol() {
    const multi = this.selectedPlacedSymbols();
    if (multi && multi.length > 1) {
      this.deleteSelectedPlacedSymbols();
      return;
    }
    const selected = this.selectedPlacedSymbol();
    if (selected) {
      this.pushHistoryState();
      const idStr = String(selected.properties['id']);
      for (const [mid, marker] of this.textBoxMarkers.entries()) {
        if (String(mid) === idStr) {
          marker.remove();
          this.textBoxMarkers.delete(mid);
        }
      }
      this.placedSymbols.update(prev => prev.filter(s => String(s.properties['id']) !== idStr));
      this.objectGroups.update(groups => groups.map(g => ({
        ...g,
        elementIds: g.elementIds.filter(gid => String(gid) !== idStr)
      })));
      this.selectedPlacedSymbol.set(null);
      this.selectedPlacedSymbols.update(prev => prev.filter(s => String(s.properties['id']) !== idStr));
      this.updateTacticalSymbolsSource();
      this.updateLinearVerticesSource();
      this.syncTextBoxMarkers();
    }
  }

  deleteSelectedPlacedSymbols() {
    let selected = this.selectedPlacedSymbols();
    if (!selected || selected.length === 0) {
      const single = this.selectedPlacedSymbol();
      if (single) {
        selected = [single];
      }
    }
    if (selected && selected.length > 0) {
      this.pushHistoryState();
      const idStrings = new Set(selected.map(s => String(s.properties['id'])));
      for (const [id, marker] of this.textBoxMarkers.entries()) {
        if (idStrings.has(String(id))) {
          marker.remove();
          this.textBoxMarkers.delete(id);
        }
      }
      this.placedSymbols.update(prev => prev.filter(s => !idStrings.has(String(s.properties['id']))));
      this.objectGroups.update(groups => groups.map(g => ({
        ...g,
        elementIds: g.elementIds.filter(id => !idStrings.has(String(id)))
      })));
      this.selectedPlacedSymbols.set([]);
      this.selectedPlacedSymbol.set(null);
      this.updateTacticalSymbolsSource();
      this.updateLinearVerticesSource();
      this.syncTextBoxMarkers();
    }
  }

  clearSymbolSelection() {
    this.selectedPlacedSymbol.set(null);
    this.selectedPlacedSymbols.set([]);
    this.selectedSymbol.set(null);
    if (this.mapInstance) {
      this.mapInstance.getCanvas().style.cursor = '';
    }
    this.updateLinearVerticesSource();
  }

  placeSelectedSymbol() {
    const template = this.selectedSymbol();
    if (!template || !this.mapInstance) return;

    const center = this.mapInstance.getCenter();
    const coords: [number, number] = [center.lng, center.lat];
    const color = this.templateCustomColor();
    const iconId = color ? `${template.symbol}_c_${color.replace('#', '')}` : template.symbol;
    const newSymbol = {
      type: 'Feature',
      properties: {
        id: Date.now(),
        symbol: template.symbol,
        iconId: iconId,
        color: color || '',
        name: this.templateCustomName() || template.name,
        size: this.templateCustomSize(),
        angle: this.templateCustomAngle()
      },
      geometry: {
        type: 'Point',
        coordinates: coords
      }
    };

    const onReady = () => {
      this.pushHistoryState();
      this.placedSymbols.update(prev => [...prev, newSymbol]);
      this.updateTacticalSymbolsSource();
      this.selectPlacedSymbol(newSymbol);
      this.selectedSymbol.set(null);
      if (this.mapInstance) this.mapInstance.getCanvas().style.cursor = '';
    };

    if (color) {
      this.ensureSymbolColorImageLoaded(template.symbol, color, onReady);
    } else {
      this.ensureSymbolImageLoaded(template.symbol, onReady);
    }
  }

  placeLinearSymbol(coords: [number, number][], lineType: 'simple_line' | 'line' | 'trench' | 'comm_open' | 'comm_covered' | 'wire' | 'area_polygon' | string, name: string, flipSide: boolean = false, isSmooth: boolean = false, isDashed: boolean = false, customLineStyle?: string) {
    if (!coords || coords.length < 2) return;
    const geom = this.trenchGeometryService.generateLinearGeometry(coords, lineType, flipSide, isSmooth);
    const lenInfo = this.trenchGeometryService.calculateLineLengthKm(coords);
    
    let color = this.templateCustomColor();
    if (!color) {
      if (lineType === 'wire') color = '#000000';
      else if (lineType === 'march_route') color = '#466bf7';
      else color = '#ef4444';
    }

    let symbolId = 'wire_line';
    if (lineType === 'trench') symbolId = 'trench_line';
    else if (lineType === 'comm_open') symbolId = 'comm_open_line';
    else if (lineType === 'comm_covered') symbolId = 'comm_covered_line';
    else if (lineType === 'march_route') symbolId = 'march_route';
    else if (lineType.startsWith('arrow_')) symbolId = lineType;

    const isArrow = lineType.startsWith('arrow_');
    const fillOpacity = isArrow ? (lineType === 'arrow_retreat' ? 0.25 : (lineType === 'arrow_attack' ? 0.45 : 0.40)) : 0;
    const lineDashArray = (isDashed || lineType === 'arrow_retreat') ? [3, 3] : [1, 0];

    const newFeature = {
      type: 'Feature',
      properties: {
        id: Date.now(),
        symbol: symbolId,
        iconId: symbolId,
        color: color,
        name: name,
        lineWidth: isArrow ? 3 : ((lineType === 'wire' || lineType === 'comm_open') ? 3 : 4),
        isLinear: true,
        lineType: lineType,
        origCoords: coords,
        lineLengthKm: lenInfo.lengthKm,
        fortLength: Math.round(lenInfo.lengthM * 10) / 10,
        flipSide: flipSide,
        isSmooth: isSmooth,
        isDashed: isDashed,
        customLineStyle: customLineStyle,
        fillOpacity: fillOpacity,
        lineDashArray: lineDashArray
      },
      geometry: geom
    };

    this.pushHistoryState();
    this.placedSymbols.update(prev => [...prev, newFeature]);
    this.updateTacticalSymbolsSource();
    this.selectPlacedSymbol(newFeature);
  }

  placeTextBox(coords: [number, number], text: string = 'Надпись') {
    const newFeature = {
      type: 'Feature',
      properties: {
        id: Date.now(),
        name: text,
        color: '#1e293b',
        textColor: '#1e293b',
        size: 14,
        textSize: 14,
        fontFamily: 'Times New Roman',
        symbol: 'text_box',
        isText: true
      },
      geometry: {
        type: 'Point',
        coordinates: coords
      }
    };
    this.pushHistoryState();
    this.placedSymbols.update(prev => [...prev, newFeature]);
    this.updateTacticalSymbolsSource();
    this.syncTextBoxMarkers();
    this.selectPlacedSymbol(newFeature);
  }

  updateLinearSymbolCoords(id: number, newCoords: [number, number][]) {
    if (!newCoords || newCoords.length < 2) return;
    const symbol = this.placedSymbols().find(s => s.properties['id'] === id);
    if (!symbol || !symbol.properties['isLinear']) return;

    const lineType = symbol.properties['lineType'];
    const flipSide = !!symbol.properties['flipSide'];
    const isSmooth = !!symbol.properties['isSmooth'];
    const lineWidth = symbol.properties['lineWidth'] || 3;
    const geom = this.trenchGeometryService.generateLinearGeometry(newCoords, lineType, flipSide, isSmooth, lineWidth);
    const lenInfo = this.trenchGeometryService.calculateLineLengthKm(newCoords);

    this.placedSymbols.update(prev =>
      prev.map(s => s.properties['id'] === id ? {
        ...s,
        properties: {
          ...s.properties,
          origCoords: newCoords,
          lineLengthKm: lenInfo.lengthKm,
          fortLength: Math.round(lenInfo.lengthM * 10) / 10
        },
        geometry: geom
      } : s)
    );
    this.syncSelectedPlacedSymbol();
    this.updateTacticalSymbolsSource();
    this.updateLinearVerticesSource();
  }

  toggleSelectedLinearSymbolSide() {
    const selected = this.selectedPlacedSymbol();
    if (!selected || !selected.properties['isLinear']) return;

    const id = selected.properties['id'];
    const newFlip = !selected.properties['flipSide'];
    const origCoords = selected.properties['origCoords'] as [number, number][];
    const lineType = selected.properties['lineType'];
    const isSmooth = !!selected.properties['isSmooth'];
    const lineWidth = selected.properties['lineWidth'] || 3;
    const geom = this.trenchGeometryService.generateLinearGeometry(origCoords, lineType, newFlip, isSmooth, lineWidth);

    this.placedSymbols.update(prev =>
      prev.map(s => s.properties['id'] === id ? {
        ...s,
        properties: { ...s.properties, flipSide: newFlip },
        geometry: geom
      } : s)
    );
    this.syncSelectedPlacedSymbol();
    this.updateTacticalSymbolsSource();
  }

  updatePlacedLineSmooth(id: number, isSmooth: boolean) {
    const symbol = this.placedSymbols().find(s => s.properties['id'] === id);
    if (!symbol || !symbol.properties['isLinear']) return;

    const lineType = symbol.properties['lineType'];
    const flipSide = !!symbol.properties['flipSide'];
    const coords = symbol.properties['origCoords'] as [number, number][];
    const lineWidth = symbol.properties['lineWidth'] || 3;
    const geom = this.trenchGeometryService.generateLinearGeometry(coords, lineType, flipSide, isSmooth, lineWidth);

    this.placedSymbols.update(prev =>
      prev.map(s => s.properties['id'] === id ? {
        ...s,
        properties: { ...s.properties, isSmooth: isSmooth },
        geometry: geom
      } : s)
    );
    this.syncSelectedPlacedSymbol();
    this.updateTacticalSymbolsSource();
    this.updateLinearVerticesSource();
  }

  private syncSelectedPlacedSymbol() {
    const selected = this.selectedPlacedSymbol();
    if (selected) {
      const found = this.placedSymbols().find(s => s.properties['id'] === selected.properties['id']);
      if (found) {
        this.selectedPlacedSymbol.set(found);
      }
    }
    this.updateLinearVerticesSource();
  }

  private removeLinearVertexFeature(feature: any) {
    if (!feature || !feature.properties) return;
    const symbolId = feature.properties['symbolId'];
    const vertexIndex = feature.properties['vertexIndex'];
    const symbol = this.placedSymbols().find(s => s.properties['id'] === symbolId);
    if (symbol && symbol.properties['isLinear']) {
      this.pushHistoryState();
      const origCoords = [...(symbol.properties['origCoords'] as [number, number][])];
      if (origCoords.length > 2) {
        origCoords.splice(vertexIndex, 1);
        this.updateLinearSymbolCoords(symbolId, origCoords);
      } else {
        this.deleteSelectedPlacedSymbol();
      }
    }
  }

  private setupSymbolDragging(map: maplibregl.Map) {
    map.on('mousedown', 'linear_vertices_layer', (e: any) => {
      if (this.interactionMode() !== 'edit') return;
      if (e.originalEvent && e.originalEvent.shiftKey) return;
      if (e.features && e.features.length > 0) {
        if (e.originalEvent && e.originalEvent.button === 2) {
          e.preventDefault();
          if (e.originalEvent) e.originalEvent.stopPropagation();
          this.removeLinearVertexFeature(e.features[0]);
          return;
        }
        e.preventDefault();
        if (e.originalEvent) e.originalEvent.stopPropagation();
        this.pushHistoryState();
        this.isDraggingVertex = true;
        this.dragVertexFeature = e.features[0];
        map.getCanvas().style.cursor = 'grabbing';
      }
    });

    map.on('contextmenu', 'linear_vertices_layer', (e: any) => {
      if (e.features && e.features.length > 0) {
        e.preventDefault();
        if (e.originalEvent) e.originalEvent.stopPropagation();
        this.removeLinearVertexFeature(e.features[0]);
      }
    });

    map.on('contextmenu', (e: any) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ['linear_vertices_layer'] });
      if (features && features.length > 0) {
        e.preventDefault();
        if (e.originalEvent) e.originalEvent.stopPropagation();
        this.removeLinearVertexFeature(features[0]);
      }
    });

    map.on('mouseenter', 'linear_vertices_layer', () => {
      if (this.interactionMode() !== 'edit') return;
      if (!this.isDraggingVertex) {
        map.getCanvas().style.cursor = 'grab';
      }
    });

    map.on('mouseleave', 'linear_vertices_layer', () => {
      if (this.interactionMode() !== 'edit') return;
      if (!this.isDraggingVertex && !this.selectedSymbol()) {
        map.getCanvas().style.cursor = '';
      }
    });

    map.on('mousedown', 'tactical_symbols_layer', (e: any) => {
      if (this.interactionMode() !== 'edit') return;
      if (e.originalEvent && e.originalEvent.button === 2) return;
      if (e.originalEvent && e.originalEvent.shiftKey) return;
      if (e.features && e.features.length > 0 && !this.selectedSymbol() && !this.isDraggingVertex) {
        e.preventDefault();
        this.pushHistoryState();
        this.isDragging = true;
        this.dragFeature = e.features[0];
        map.getCanvas().style.cursor = 'grabbing';
      }
    });

    map.on('mousemove', (e) => {
      if (this.isDraggingVertex && this.dragVertexFeature) {
        this.pendingDragVertexLngLat = [e.lngLat.lng, e.lngLat.lat];
        if (this.dragVertexRafId === null) {
          this.dragVertexRafId = requestAnimationFrame(() => {
            this.dragVertexRafId = null;
            if (this.isDraggingVertex && this.dragVertexFeature && this.pendingDragVertexLngLat) {
              const symbolId = this.dragVertexFeature.properties['symbolId'];
              const vertexIndex = this.dragVertexFeature.properties['vertexIndex'];
              const [lng, lat] = this.pendingDragVertexLngLat;
              const symbol = this.placedSymbols().find(s => s.properties['id'] === symbolId);
              if (symbol && symbol.properties['isLinear']) {
                const origCoords = [...(symbol.properties['origCoords'] as [number, number][])];
                origCoords[vertexIndex] = [lng, lat];
                this.updateLinearSymbolCoords(symbolId, origCoords);
              }
            }
          });
        }
        return;
      }

      if (this.isDragging && this.dragFeature) {
        this.pendingDragLngLat = [e.lngLat.lng, e.lngLat.lat];
        if (this.dragRafId === null) {
          this.dragRafId = requestAnimationFrame(() => {
            this.dragRafId = null;
            if (this.isDragging && this.dragFeature && this.pendingDragLngLat) {
              const symbolId = this.dragFeature.properties['id'];
              const [lng, lat] = this.pendingDragLngLat;
              this.placedSymbols.update(prev => 
                prev.map(s => s.properties['id'] === symbolId ? {
                  ...s,
                  geometry: { ...s.geometry, coordinates: [lng, lat] }
                } : s)
              );
              this.syncSelectedPlacedSymbol();
              this.updateTacticalSymbolsSource();
            }
          });
        }
      }
    });

    map.on('mouseup', () => {
      if (this.isDraggingVertex) {
        if (this.dragVertexRafId !== null) {
          cancelAnimationFrame(this.dragVertexRafId);
          this.dragVertexRafId = null;
        }
        if (this.dragVertexFeature && this.pendingDragVertexLngLat) {
          const symbolId = this.dragVertexFeature.properties['symbolId'];
          const vertexIndex = this.dragVertexFeature.properties['vertexIndex'];
          const [lng, lat] = this.pendingDragVertexLngLat;
          const symbol = this.placedSymbols().find(s => s.properties['id'] === symbolId);
          if (symbol && symbol.properties['isLinear']) {
            const origCoords = [...(symbol.properties['origCoords'] as [number, number][])];
            origCoords[vertexIndex] = [lng, lat];
            this.updateLinearSymbolCoords(symbolId, origCoords);
          }
        }
        this.isDraggingVertex = false;
        this.dragVertexFeature = null;
        this.pendingDragVertexLngLat = null;
        map.getCanvas().style.cursor = '';
        return;
      }

      if (this.isDragging) {
        if (this.dragRafId !== null) {
          cancelAnimationFrame(this.dragRafId);
          this.dragRafId = null;
        }
        if (this.dragFeature && this.pendingDragLngLat) {
          const symbolId = this.dragFeature.properties['id'];
          const [lng, lat] = this.pendingDragLngLat;
          this.placedSymbols.update(prev => 
            prev.map(s => s.properties['id'] === symbolId ? {
              ...s,
              geometry: { ...s.geometry, coordinates: [lng, lat] }
            } : s)
          );

          const symbolType = this.dragFeature.properties['symbol'] || '';
          if (this.isTerrainOrientationEnabled() && symbolType.startsWith('fort_')) {
            this.terrainService.getSlopeBearing(lng, lat).then(bearing => {
              if (bearing !== null) {
                this.placedSymbols.update(prev => 
                  prev.map(s => s.properties['id'] === symbolId ? {
                    ...s,
                    properties: { ...s.properties, angle: bearing }
                  } : s)
                );
                this.syncSelectedPlacedSymbol();
                this.updateTacticalSymbolsSource();
              }
            });
          }

          this.syncSelectedPlacedSymbol();
          this.updateTacticalSymbolsSource();
        }
        this.isDragging = false;
        this.dragFeature = null;
        this.pendingDragLngLat = null;
        map.getCanvas().style.cursor = 'move';
      }
    });

    map.on('mouseenter', 'tactical_symbols_layer', () => {
      if (this.interactionMode() !== 'edit') return;
      if (!this.selectedSymbol()) {
        map.getCanvas().style.cursor = 'move';
      }
    });

    map.on('mouseleave', 'tactical_symbols_layer', () => {
      if (this.interactionMode() !== 'edit') return;
      if (!this.selectedSymbol()) {
        map.getCanvas().style.cursor = '';
      }
    });

    const lineAndPolygonLayers = ['tactical_lines_layer', 'tactical_polygons_fill_layer', 'tactical_polygons_outline_layer'];
    lineAndPolygonLayers.forEach(layer => {
      map.on('mouseenter', layer, () => {
        if (this.interactionMode() !== 'edit') return;
        if (!this.selectedSymbol() && !this.isDraggingVertex) {
          map.getCanvas().style.cursor = 'pointer';
        }
      });
      map.on('mouseleave', layer, () => {
        if (this.interactionMode() !== 'edit') return;
        if (!this.selectedSymbol() && !this.isDraggingVertex) {
          map.getCanvas().style.cursor = '';
        }
      });
    });
  }

  public getAllFeaturesWithPatrol(symbols?: any[]): any[] {
    const list = symbols || this.placedSymbols().filter(s => !s.properties?.hidden);
    const features: any[] = [...list];

    list.forEach(s => {
      if (s.geometry?.type === 'Point' && s.properties?.hasPatrol) {
        const coords = s.geometry.coordinates as [number, number];
        if (coords && coords.length >= 2) {
          const patrolAngle = s.properties.patrolAngle ?? s.properties.angle ?? 0;
          const patrolLength = s.properties.patrolLength || 400;
          const patrolRadius = s.properties.patrolRadius || 25;
          const isDashed = s.properties.patrolStyle === 'dashed';
          const geomCoords = this.trenchGeometryService.generatePatrolGeometry(
            coords,
            patrolAngle,
            patrolLength,
            patrolRadius,
            isDashed
          );
          if (geomCoords && geomCoords.length > 0) {
            const isEnemy = s.properties.symbol?.includes('enemy') || s.properties.symbol?.startsWith('opp_');
            const defaultColor = isEnemy ? '#dc2626' : '#2563eb';
            const patrolColor = s.properties.color || defaultColor;
            features.push({
              type: 'Feature',
              id: `patrol_${s.properties.id}`,
              properties: {
                id: `patrol_${s.properties.id}`,
                parentId: s.properties.id,
                isPatrolLine: true,
                color: patrolColor,
                lineWidth: 2.5
              },
              geometry: {
                type: 'MultiLineString',
                coordinates: geomCoords
              }
            });
          }
        }
      }
    });

    return features;
  }

  private updateSourceRafId: number | null = null;

  public updateTacticalSymbolsSource() {
    if (!this.mapInstance || !this.mapInstance.getStyle()) return;
    if (this.updateSourceRafId !== null) return;
    this.updateSourceRafId = requestAnimationFrame(() => {
      this.updateSourceRafId = null;
      try {
        const source = this.mapInstance?.getSource('tactical-symbols') as maplibregl.GeoJSONSource;
        if (source) {
          source.setData({
            type: 'FeatureCollection',
            features: this.getAllFeaturesWithPatrol()
          });
        }
      } catch {}
    });
  }

  private setupBoxSelection(map: maplibregl.Map) {
    map.boxZoom.disable();

    let startPoint: { x: number; y: number } | null = null;
    let lastMouseMovePoint: { x: number; y: number } | null = null;
    let boxElement: HTMLDivElement | null = null;
    let isSelecting = false;

    map.on('mousedown', (e: any) => {
      this.justSelectedBox = false;
      const isSelectMode = this.interactionMode() === 'select';
      const isShiftDrag = e.originalEvent && e.originalEvent.shiftKey && e.originalEvent.button === 0;
      const isNormalSelectDrag = isSelectMode && e.originalEvent && e.originalEvent.button === 0;

      if (isShiftDrag || isNormalSelectDrag) {
        e.preventDefault();
        map.dragPan.disable();

        startPoint = { x: e.point.x, y: e.point.y };
        lastMouseMovePoint = { x: e.point.x, y: e.point.y };
        isSelecting = true;

        const container = map.getContainer();
        boxElement = document.createElement('div');
        boxElement.style.position = 'absolute';
        boxElement.style.border = '1.5px dashed #466bf7';
        boxElement.style.backgroundColor = 'rgba(70, 107, 247, 0.15)';
        boxElement.style.pointerEvents = 'none';
        boxElement.style.zIndex = '1000';
        boxElement.style.left = `${e.point.x}px`;
        boxElement.style.top = `${e.point.y}px`;
        boxElement.style.width = '0px';
        boxElement.style.height = '0px';
        container.appendChild(boxElement);
      }
    });

    map.on('mousemove', (e: any) => {
      if (isSelecting && startPoint && boxElement) {
        const currentPoint = e.point;
        lastMouseMovePoint = { x: currentPoint.x, y: currentPoint.y };
        const minX = Math.min(startPoint.x, currentPoint.x);
        const maxX = Math.max(startPoint.x, currentPoint.x);
        const minY = Math.min(startPoint.y, currentPoint.y);
        const maxY = Math.max(startPoint.y, currentPoint.y);

        boxElement.style.left = `${minX}px`;
        boxElement.style.top = `${minY}px`;
        boxElement.style.width = `${maxX - minX}px`;
        boxElement.style.height = `${maxY - minY}px`;
      }
    });

    const finishSelection = (e: any) => {
      if (isSelecting) {
        isSelecting = false;
        map.dragPan.enable();

        if (boxElement) {
          boxElement.remove();
          boxElement = null;
        }

        if (startPoint) {
          const endPoint = e.point || lastMouseMovePoint || startPoint;
          const minX = Math.min(startPoint.x, endPoint.x);
          const maxX = Math.max(startPoint.x, endPoint.x);
          const minY = Math.min(startPoint.y, endPoint.y);
          const maxY = Math.max(startPoint.y, endPoint.y);

          if (maxX - minX > 4 || maxY - minY > 4) {
            this.justSelectedBox = true;
            const availableLayers = [
              'tactical_symbols_layer',
              'tactical_lines_layer',
              'tactical_polygons_outline_layer',
              'tactical_polygons_fill_layer'
            ].filter(id => !!map.getLayer(id));

            const features = map.queryRenderedFeatures(
              [[minX, minY], [maxX, maxY]],
              {
                layers: availableLayers
              }
            );

            if (features && features.length > 0) {
              const selected: any[] = [];
              const placed = this.placedSymbols();

              features.forEach((f: any) => {
                const id = f.properties?.['id'];
                const found = placed.find(s => String(s.properties?.['id']) === String(id));
                if (found && !selected.some(s => String(s.properties?.['id']) === String(id))) {
                  selected.push(found);
                }
              });

              this.selectedPlacedSymbols.set(selected);
              this.selectedPlacedSymbol.set(selected.length > 0 ? selected[selected.length - 1] : null);
            } else {
              this.selectedPlacedSymbols.set([]);
              this.selectedPlacedSymbol.set(null);
            }
            this.updateLinearVerticesSource();
          }
          startPoint = null;
          lastMouseMovePoint = null;
        }
      }
    };

    map.on('mouseup', finishSelection);
  }

  public exportScenarioData(): any {
    let mapPosition = null;
    if (this.mapInstance) {
      mapPosition = {
        center: this.mapInstance.getCenter().toArray(),
        zoom: this.mapInstance.getZoom(),
        bearing: this.mapInstance.getBearing(),
        pitch: this.mapInstance.getPitch()
      };
    } else {
      try {
        const stored = localStorage.getItem('topos_map_position');
        if (stored) mapPosition = JSON.parse(stored);
      } catch (e) {}
    }

    let plannerTasks = [];
    let plannerDevices = [];
    let routePlannerState = null;
    let marchOrderElements = [];
    try {
      const tasks = localStorage.getItem('topos_planner_tasks');
      if (tasks) plannerTasks = JSON.parse(tasks);
      const devices = localStorage.getItem('topos_planner_devices');
      if (devices) plannerDevices = JSON.parse(devices);
      const rState = localStorage.getItem('topos_route_planner_state');
      if (rState) routePlannerState = JSON.parse(rState);
      const mElements = localStorage.getItem('topos_march_order_elements');
      if (mElements) marchOrderElements = JSON.parse(mElements);
    } catch (e) {}

    let imageOverlays: any[] = [];
    try {
      if (this.imageOverlayService) {
        imageOverlays = this.imageOverlayService.overlays();
      } else {
        const stored = localStorage.getItem('topos_image_overlays');
        if (stored) imageOverlays = JSON.parse(stored);
      }
    } catch (e) {}

    const plannerSettings = {
      manpower: Number(localStorage.getItem('topos_planner_manpower') || 30),
      shifts: Number(localStorage.getItem('topos_planner_shifts') || 2),
      soilType: localStorage.getItem('topos_planner_soilType') || 'loam',
      factorNight: Number(localStorage.getItem('topos_planner_factorNight') || 0.7),
      factorWinter: Number(localStorage.getItem('topos_planner_factorWinter') || 0.8),
      workHoursPerDay: Number(localStorage.getItem('topos_planner_workHoursPerDay') || 10)
    };

    const scenarioResult: any = {
      version: "1.0",
      type: "topos_scenario",
      timestamp: new Date().toISOString(),
      placedSymbols: this.placedSymbols(),
      objectGroups: this.objectGroups(),
      plannerTasks,
      plannerDevices,
      plannerSettings,
      routePlannerState,
      marchOrderElements,
      imageOverlays,
      mapPosition
    };

    if (this.dispatchDataProvider) {
      try {
        const dData = this.dispatchDataProvider();
        if (dData) {
          scenarioResult.dispatchData = dData;
        }
      } catch {}
    }

    return scenarioResult;
  }

  public importScenarioData(scenario: any) {
    if (!scenario || scenario.type !== 'topos_scenario') {
      throw new Error('Неверный формат сценария Topos');
    }

    const symbols = scenario.placedSymbols || [];
    const groups = scenario.objectGroups || [];
    
    this.placedSymbols.set(symbols);
    this.objectGroups.set(groups);

    if (scenario.dispatchData && this.dispatchDataConsumer) {
      try {
        this.dispatchDataConsumer(scenario.dispatchData);
      } catch {}
    }

    if (scenario.imageOverlays) {
      localStorage.setItem('topos_image_overlays', JSON.stringify(scenario.imageOverlays));
      if (this.imageOverlayService) {
        this.imageOverlayService.loadOverlays(scenario.imageOverlays);
      }
    } else {
      localStorage.removeItem('topos_image_overlays');
      if (this.imageOverlayService) {
        this.imageOverlayService.loadOverlays([]);
      }
    }

    if (scenario.routePlannerState) {
      localStorage.setItem('topos_route_planner_state', JSON.stringify(scenario.routePlannerState));
    }
    if (scenario.marchOrderElements) {
      localStorage.setItem('topos_march_order_elements', JSON.stringify(scenario.marchOrderElements));
    }

    if (scenario.plannerTasks) {
      localStorage.setItem('topos_planner_tasks', JSON.stringify(scenario.plannerTasks));
    } else {
      localStorage.removeItem('topos_planner_tasks');
    }

    if (scenario.plannerDevices) {
      localStorage.setItem('topos_planner_devices', JSON.stringify(scenario.plannerDevices));
    } else {
      localStorage.removeItem('topos_planner_devices');
    }

    if (scenario.plannerSettings) {
      const settings = scenario.plannerSettings;
      if (settings.manpower !== undefined) localStorage.setItem('topos_planner_manpower', String(settings.manpower));
      if (settings.shifts !== undefined) localStorage.setItem('topos_planner_shifts', String(settings.shifts));
      if (settings.soilType !== undefined) localStorage.setItem('topos_planner_soilType', String(settings.soilType));
      if (settings.factorNight !== undefined) localStorage.setItem('topos_planner_factorNight', String(settings.factorNight));
      if (settings.factorWinter !== undefined) localStorage.setItem('topos_planner_factorWinter', String(settings.factorWinter));
      if (settings.workHoursPerDay !== undefined) localStorage.setItem('topos_planner_workHoursPerDay', String(settings.workHoursPerDay));
    }

    if (scenario.mapPosition) {
      localStorage.setItem('topos_map_position', JSON.stringify(scenario.mapPosition));
      if (this.mapInstance) {
        const pos = scenario.mapPosition;
        if (pos.center && pos.zoom !== undefined) {
          this.mapInstance.flyTo({
            center: pos.center,
            zoom: pos.zoom,
            bearing: pos.bearing || 0,
            pitch: pos.pitch || 0,
            duration: 1000
          });
        }
      }
    }

    symbols.forEach((s: any) => {
      const symbolId = s.properties['symbol'];
      const iconId = s.properties['iconId'] || symbolId;
      const color = s.properties['color'] || '';
      if (color) {
        this.ensureSymbolColorImageLoadedForId(symbolId, color, iconId, () => this.updateTacticalSymbolsSource());
      } else {
        this.ensureSymbolImageLoadedForId(symbolId, iconId, () => this.updateTacticalSymbolsSource());
      }
    });

    this.updateTacticalSymbolsSource();
    this.syncTextBoxMarkers();
  }

  public clearAllTacticalFeatures() {
    for (const marker of this.textBoxMarkers.values()) {
      marker.remove();
    }
    this.textBoxMarkers.clear();
    this.placedSymbols.set([]);
    this.objectGroups.set([]);
    this.selectedPlacedSymbol.set(null);
    this.selectedPlacedSymbols.set([]);
    this.activeCalculationGroupId.set('all');
    this.updateTacticalSymbolsSource();
  }

  private textBoxMarkers = new Map<number, maplibregl.Marker>();
  private syncTextBoxRafId: number | null = null;

  public syncTextBoxMarkers() {
    if (!this.mapInstance) return;
    if (this.syncTextBoxRafId !== null) return;
    this.syncTextBoxRafId = requestAnimationFrame(() => {
      this.syncTextBoxRafId = null;
      this.performSyncTextBoxMarkers();
    });
  }

  private performSyncTextBoxMarkers() {
    if (!this.mapInstance) return;

    const currentTextSymbols = this.placedSymbols().filter(
      s => (s.properties?.['isText'] || s.properties?.['symbol'] === 'text_box') && !s.properties?.['hidden']
    );
    const activeIds = new Set<number>();

    for (const s of currentTextSymbols) {
      const id = s.properties['id'];
      activeIds.add(id);

      let marker = this.textBoxMarkers.get(id);
      const coords = s.geometry?.coordinates;
      if (!coords || coords.length < 2) continue;

      const textVal = s.properties['name'] || '';
      const fontSize = s.properties['textSize'] || s.properties['size'] || 14;
      const fontFamily = s.properties['fontFamily'] || 'Times New Roman';
      const textColor = s.properties['textColor'] || s.properties['color'] || '#1e293b';
      const haloColor = s.properties['textHaloColor'] || '#ffffff';
      const haloWidth = s.properties['textHaloWidth'] !== undefined ? s.properties['textHaloWidth'] : 1.5;
      const angle = s.properties['angle'] || 0;
      const isSelected = this.selectedPlacedSymbol()?.properties?.['id'] === id;

      if (!marker) {
        const el = document.createElement('div');
        el.className = 'topos-map-text-box';
        el.style.position = 'relative';
        el.style.whiteSpace = 'pre-wrap';
        el.style.cursor = 'pointer';
        el.style.userSelect = 'none';
        el.style.textAlign = 'center';
        el.style.lineHeight = '1.2';
        el.style.fontWeight = '700';
        el.style.padding = '2px 4px';
        el.style.transition = 'outline 0.15s ease';

        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const found = this.placedSymbols().find(item => String(item.properties['id']) === String(id));
          if (found) {
            if (e.shiftKey || e.ctrlKey) {
              this.toggleSelectPlacedSymbol(found);
            } else {
              this.selectPlacedSymbol(found);
            }
          }
        });

        marker = new maplibregl.Marker({
          element: el,
          draggable: this.interactionMode() === 'edit'
        })
        .setLngLat(coords)
        .addTo(this.mapInstance);

        marker.on('dragstart', () => {
          this.pushHistoryState();
        });

        marker.on('drag', () => {
          const lngLat = marker!.getLngLat();
          const target = this.placedSymbols().find(item => item.properties['id'] === id);
          if (target && target.geometry) {
            target.geometry.coordinates = [lngLat.lng, lngLat.lat];
          }
        });

        marker.on('dragend', () => {
          const lngLat = marker!.getLngLat();
          this.placedSymbols.update(prev =>
            prev.map(item => item.properties['id'] === id ? {
              ...item,
              geometry: { ...item.geometry, coordinates: [lngLat.lng, lngLat.lat] }
            } : item)
          );
          this.syncSelectedPlacedSymbol();
        });

        this.textBoxMarkers.set(id, marker);
      }

      const el = marker.getElement();
      if (el.textContent !== textVal) {
        el.textContent = textVal;
      }
      const expectedFont = `"${fontFamily}", "Segoe UI", Arial, sans-serif`;
      if (el.style.fontFamily !== expectedFont) {
        el.style.fontFamily = expectedFont;
      }
      const expectedSize = `${fontSize}px`;
      if (el.style.fontSize !== expectedSize) {
        el.style.fontSize = expectedSize;
      }
      if (el.style.color !== textColor) {
        el.style.color = textColor;
      }
      const expectedShadow = haloWidth > 0 
        ? `-${haloWidth}px -${haloWidth}px 0 ${haloColor}, ${haloWidth}px -${haloWidth}px 0 ${haloColor}, -${haloWidth}px ${haloWidth}px 0 ${haloColor}, ${haloWidth}px ${haloWidth}px 0 ${haloColor}, 0 -${haloWidth}px 0 ${haloColor}, 0 ${haloWidth}px 0 ${haloColor}, -${haloWidth}px 0 0 ${haloColor}, ${haloWidth}px 0 0 ${haloColor}`
        : 'none';
      if (el.style.textShadow !== expectedShadow) {
        el.style.textShadow = expectedShadow;
      }
      const expectedTransform = angle ? `rotate(${angle}deg)` : 'none';
      if (el.style.transform !== expectedTransform) {
        el.style.transform = expectedTransform;
      }
      if (isSelected) {
        el.style.outline = '1.5px dashed #466bf7';
        el.style.outlineOffset = '3px';
        el.style.borderRadius = '2px';
      } else {
        if (el.style.outline !== 'none') {
          el.style.outline = 'none';
        }
      }

      const curPos = marker.getLngLat();
      if (Math.abs(curPos.lng - coords[0]) > 0.000001 || Math.abs(curPos.lat - coords[1]) > 0.000001) {
        marker.setLngLat(coords);
      }
      marker.setDraggable(this.interactionMode() === 'edit');
    }

    for (const [id, marker] of this.textBoxMarkers.entries()) {
      if (!activeIds.has(id)) {
        marker.remove();
        this.textBoxMarkers.delete(id);
      }
    }
  }
}
