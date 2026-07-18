import { Injectable, signal, effect, inject, untracked } from '@angular/core';
import maplibregl from 'maplibre-gl';
import { TacticalSymbol } from '../consts/tactical-symbols.const';
import { TrenchGeometryService } from './trench-geometry.service';
import { TerrainService } from './terrain.service';

type SymbolLoadCallback = () => void;

export type MapInteractionMode = 'pan' | 'edit' | 'select';

export interface ObjectGroup {
  id: string;
  name: string;
  elementIds: number[];
}

@Injectable({
  providedIn: 'root'
})
export class TacticalMapService {
  public trenchGeometryService = inject(TrenchGeometryService);
  public terrainService = inject(TerrainService);
  readonly placedSymbols = signal<any[]>(this.loadFromStorage());

  constructor() {
    effect(() => {
      const symbols = this.placedSymbols();
      try {
        localStorage.setItem('topos_placed_symbols', JSON.stringify(symbols));
      } catch (e) {
        console.error('Ошибка сохранения символов в localStorage:', e);
      }
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
      this.selectedPlacedSymbol();
      this.selectedPlacedSymbols();
      this.placedSymbols();
      this.updateLinearVerticesSource();
      this.updateMarchWaypointsSource();
      this.updateHighlightLayers();
    });

    effect(() => {
      const mode = this.interactionMode();
      untracked(() => {
        this.isSelectionModeActive.set(mode === 'select');
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

  selectPlacedSymbol(symbol: any | null) {
    this.selectedPlacedSymbol.set(symbol);
    if (symbol) {
      const current = this.selectedPlacedSymbols();
      if (!current.some(s => s.properties?.id === symbol.properties?.id)) {
        this.selectedPlacedSymbols.set([symbol]);
      }
    } else {
      this.selectedPlacedSymbols.set([]);
    }
    this.updateLinearVerticesSource();
  }

  createGroup(name: string) {
    const newGroup: ObjectGroup = {
      id: `group_${Date.now()}`,
      name: name,
      elementIds: []
    };
    this.objectGroups.update(prev => [...prev, newGroup]);
    return newGroup;
  }

  deleteGroup(groupId: string) {
    this.objectGroups.update(prev => prev.filter(g => g.id !== groupId));
    if (this.activeCalculationGroupId() === groupId) {
      this.activeCalculationGroupId.set('all');
    }
  }

  renameGroup(groupId: string, newName: string) {
    this.objectGroups.update(prev => prev.map(g => g.id === groupId ? { ...g, name: newName } : g));
  }

  addElementsToGroup(groupId: string, elementIds: number[]) {
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

  updateLinearVerticesSource() {
    if (!this.mapInstance) return;
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
  }

  updateHighlightLayers() {
    if (!this.mapInstance) return;
    
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
  }

  updateMarchWaypointsSource(activeCoords?: [number, number][]) {
    if (!this.mapInstance) return;
    const source = this.mapInstance.getSource('march-waypoints') as maplibregl.GeoJSONSource;
    if (!source) return;

    const features: any[] = [];

    // 1. Сначала добавляем точки из всех сохраненных на карте маршрутов
    this.placedSymbols().forEach(s => {
      if (s.properties && s.properties['lineType'] === 'march_route') {
        const origCoords = s.properties['origCoords'] as [number, number][];
        if (origCoords) {
          origCoords.forEach((coord, idx) => {
            features.push({
              type: 'Feature',
              properties: {
                label: String(idx + 1),
                routeId: s.properties['id']
              },
              geometry: {
                type: 'Point',
                coordinates: coord
              }
            });
          });
        }
      }
    });

    // 2. Если сейчас интерактивно рисуется/редактируется маршрут, добавляем его точки
    if (activeCoords && activeCoords.length > 0) {
      activeCoords.forEach((coord, idx) => {
        features.push({
          type: 'Feature',
          properties: {
            label: String(idx + 1),
            routeId: 'active'
          },
          geometry: {
            type: 'Point',
            coordinates: coord
          }
        });
      });
    }

    source.setData({
      type: 'FeatureCollection',
      features
    });
  }

  updatePlaybackMarker(coords: [number, number] | null, angle: number = 0) {
    if (!this.mapInstance) return;
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
  }


  initLayers(map: maplibregl.Map) {
    if (!map.getSource('tactical-symbols')) {
      map.addSource('tactical-symbols', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: this.placedSymbols() }
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
        filter: ['==', '$type', 'Point'],
        layout: {
          'icon-image': ['coalesce', ['get', 'iconId'], ['get', 'symbol']],
          'icon-size': ['coalesce', ['get', 'size'], 0.08],
          'icon-rotate': ['coalesce', ['get', 'angle'], 0],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'text-field': ['get', 'name'],
          'text-size': 11,
          'text-offset': [0, 1.8],
          'text-anchor': 'top',
          'text-allow-overlap': true,
          'text-ignore-placement': true
        },
        paint: {
          'text-color': '#222222',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
          'icon-opacity': 1,
          'icon-opacity-transition': { duration: 0 },
          'text-opacity': 1,
          'text-opacity-transition': { duration: 0 }
        }
      });
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

    if (!map.getSource('march-waypoints')) {
      map.addSource('march-waypoints', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
    }

    if (!map.getLayer('march_waypoints_circles')) {
      map.addLayer({
        id: 'march_waypoints_circles',
        type: 'circle',
        source: 'march-waypoints',
        paint: {
          'circle-radius': 9,
          'circle-color': '#2563eb',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5
        }
      });
    }

    if (!map.getLayer('march_waypoints_labels')) {
      map.addLayer({
        id: 'march_waypoints_labels',
        type: 'symbol',
        source: 'march-waypoints',
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 10,
          'text-allow-overlap': true,
          'text-ignore-placement': true
        },
        paint: {
          'text-color': '#ffffff'
        }
      });
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

    // Предзагрузка красного автомобиля для плеера симуляции
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
  }

  init(map: maplibregl.Map) {
    this.mapInstance = map;
    this.setupSymbolDragging(map);
    this.setupBoxSelection(map);

    map.on('click', (e) => {
      if (this.justSelectedBox) {
        this.justSelectedBox = false;
        return;
      }
      if (this.interactionMode() !== 'edit') {
        return;
      }
      const canvas = map.getCanvas();
      if (canvas.style.cursor === 'crosshair') return;

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
            angle: this.templateCustomAngle()
          },
          geometry: {
            type: 'Point',
            coordinates: coords
          }
        };

        const onReady = () => {
          this.placedSymbols.update(prev => [...prev, newSymbol]);
          this.updateTacticalSymbolsSource();
          this.selectedPlacedSymbol.set(newSymbol);

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
      const features = map.queryRenderedFeatures(bbox, {
        layers: [
          'tactical_symbols_layer',
          'tactical_lines_layer',
          'tactical_polygons_fill_layer',
          'tactical_polygons_outline_layer'
        ]
      });

      if (features.length > 0) {
        const feat = features[0];
        const found = this.placedSymbols().find(s => s.properties['id'] === feat.properties?.['id']);
        if (found) {
          this.selectPlacedSymbol(found);
          return;
        }
      } else {
        this.selectPlacedSymbol(null);
      }
    });
  }

  handleMissingImage(missingId: string) {
    if (!this.mapInstance || !missingId) return;
    if (this.mapInstance.hasImage(missingId)) return;

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
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = `symbols/${symbolId}.svg`;
    img.onload = () => {
      if (this.mapInstance && !this.mapInstance.hasImage(targetIconId)) {
        this.mapInstance.addImage(targetIconId, img);
      }
      if (callback) callback();
    };
    img.onerror = () => {
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

    fetch(`symbols/${symbolId}.svg`)
      .then(r => r.text())
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
          const serialized = new XMLSerializer().serializeToString(doc);
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = `data:image/svg+xml;charset=utf-8,` + encodeURIComponent(serialized);
          img.onload = () => {
            if (this.mapInstance && !this.mapInstance.hasImage(targetIconId)) {
              this.mapInstance.addImage(targetIconId, img);
            }
            if (callback) callback();
          };
          img.onerror = () => {
            if (callback) callback();
          };
        } catch (e) {
          console.error('Ошибка перекраски символа:', e);
          if (callback) callback();
        }
      })
      .catch(() => {
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
      this.placedSymbols.update(prev => 
        prev.map(s => s.properties['id'] === selected.properties['id'] ? {
          ...s,
          properties: { ...s.properties, angle }
        } : s)
      );
      this.syncSelectedPlacedSymbol();
      this.updateTacticalSymbolsSource();
    }
  }

  updatePlacedSymbolProperty(key: string, value: any) {
    const selected = this.selectedPlacedSymbol();
    if (selected) {
      this.placedSymbols.update(prev => 
        prev.map(s => s.properties['id'] === selected.properties['id'] ? {
          ...s,
          properties: { ...s.properties, [key]: value }
        } : s)
      );
      this.syncSelectedPlacedSymbol();
      this.updateTacticalSymbolsSource();
    }
  }

  updatePlacedSymbolName(name: string) {
    const selected = this.selectedPlacedSymbol();
    if (selected) {
      this.placedSymbols.update(prev => 
        prev.map(s => s.properties['id'] === selected.properties['id'] ? {
          ...s,
          properties: { ...s.properties, name }
        } : s)
      );
      this.syncSelectedPlacedSymbol();
      this.updateTacticalSymbolsSource();
    }
  }

  updatePlacedSymbolColor(color: string) {
    const selected = this.selectedPlacedSymbol();
    if (selected) {
      if (selected.properties?.['isLinear']) {
        this.placedSymbols.update(prev => 
          prev.map(s => s.properties['id'] === selected.properties['id'] ? {
            ...s,
            properties: { ...s.properties, color }
          } : s)
        );
        this.syncSelectedPlacedSymbol();
        this.updateTacticalSymbolsSource();
        return;
      }

      const symbolId = selected.properties['symbol'];
      const iconId = color ? `${symbolId}_c_${color.replace('#', '')}` : symbolId;

      const applyUpdate = () => {
        this.placedSymbols.update(prev => 
          prev.map(s => s.properties['id'] === selected.properties['id'] ? {
            ...s,
            properties: { ...s.properties, color, iconId }
          } : s)
        );
        this.syncSelectedPlacedSymbol();
        this.updateTacticalSymbolsSource();
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
    const selected = this.selectedPlacedSymbol();
    if (selected) {
      this.placedSymbols.update(prev => prev.filter(s => s.properties['id'] !== selected.properties['id']));
      this.selectedPlacedSymbol.set(null);
      this.updateTacticalSymbolsSource();
      this.updateLinearVerticesSource();
    }
  }

  clearSymbolSelection() {
    this.selectedPlacedSymbol.set(null);
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

  placeLinearSymbol(coords: [number, number][], lineType: 'trench' | 'comm_open' | 'comm_covered' | 'wire' | string, name: string, flipSide: boolean = false, isSmooth: boolean = false) {
    if (!coords || coords.length < 2) return;
    const geom = this.trenchGeometryService.generateLinearGeometry(coords, lineType, flipSide, isSmooth);
    
    let color = this.templateCustomColor();
    if (!color) {
      if (lineType === 'wire') color = '#000000';
      else if (lineType === 'march_route') color = '#2563eb';
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
    const lineDashArray = (lineType === 'arrow_retreat') ? [3, 3] : [1, 0];

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
        flipSide: flipSide,
        isSmooth: isSmooth,
        fillOpacity: fillOpacity,
        lineDashArray: lineDashArray
      },
      geometry: geom
    };

    this.placedSymbols.update(prev => [...prev, newFeature]);
    this.updateTacticalSymbolsSource();
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

    this.placedSymbols.update(prev =>
      prev.map(s => s.properties['id'] === id ? {
        ...s,
        properties: { ...s.properties, origCoords: newCoords },
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

  public updateTacticalSymbolsSource() {
    if (!this.mapInstance) return;
    const source = this.mapInstance.getSource('tactical-symbols') as maplibregl.GeoJSONSource;
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features: this.placedSymbols()
      });
    }
  }

  private setupBoxSelection(map: maplibregl.Map) {
    map.boxZoom.disable();

    let startPoint: { x: number; y: number } | null = null;
    let lastMouseMovePoint: { x: number; y: number } | null = null;
    let boxElement: HTMLDivElement | null = null;
    let isSelecting = false;

    map.on('mousedown', (e: any) => {
      this.justSelectedBox = false; // Всегда сбрасываем при новом клике
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
        boxElement.style.border = '1.5px dashed #2563eb';
        boxElement.style.backgroundColor = 'rgba(37, 99, 235, 0.15)';
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
            this.justSelectedBox = true; // Указываем, что только что выделили рамкой
            const features = map.queryRenderedFeatures(
              [[minX, minY], [maxX, maxY]],
              {
                layers: [
                  'tactical_symbols_layer',
                  'tactical_lines_layer',
                  'tactical_polygons_fill_layer',
                  'tactical_polygons_outline_layer'
                ]
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
}
