import { Injectable, signal, effect, inject } from '@angular/core';
import maplibregl from 'maplibre-gl';
import { TacticalSymbol } from '../consts/tactical-symbols.const';
import { TrenchGeometryService } from './trench-geometry.service';

type SymbolLoadCallback = () => void;

@Injectable({
  providedIn: 'root'
})
export class TacticalMapService {
  private trenchGeometryService = inject(TrenchGeometryService);
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
      this.selectedPlacedSymbol();
      this.placedSymbols();
      this.updateLinearVerticesSource();
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

  selectPlacedSymbol(symbol: any | null) {
    this.selectedPlacedSymbol.set(symbol);
    this.updateLinearVerticesSource();
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

  initLayers(map: maplibregl.Map) {
    if (!map.getSource('tactical-symbols')) {
      map.addSource('tactical-symbols', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: this.placedSymbols() }
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

    map.on('click', (e) => {
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
        layers: ['tactical_symbols_layer', 'tactical_lines_layer']
      });

      if (features.length > 0) {
        const feat = features[0];
        const found = this.placedSymbols().find(s => s.properties['id'] === feat.properties?.['id']);
        if (found) {
          this.selectedPlacedSymbol.set(found);
          return;
        }
      } else {
        this.selectedPlacedSymbol.set(null);
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
      this.placedSymbols.update(prev => 
        prev.map(s => s.properties['id'] === selected.properties['id'] ? {
          ...s,
          properties: { 
            ...s.properties, 
            size,
            lineWidth: isLin ? Math.max(1, size * 40) : s.properties['lineWidth']
          }
        } : s)
      );
      this.syncSelectedPlacedSymbol();
      this.updateTacticalSymbolsSource();
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

  placeLinearSymbol(coords: [number, number][], lineType: 'trench' | 'comm_open' | 'comm_covered' | 'wire' | string, name: string, flipSide: boolean = false) {
    if (!coords || coords.length < 2) return;
    const geom = this.trenchGeometryService.generateLinearGeometry(coords, lineType, flipSide);
    
    let color = this.templateCustomColor();
    if (!color) {
      if (lineType === 'wire') color = '#475569';
      else if (lineType === 'comm_covered') color = '#78350f';
      else color = '#854d0e';
    }

    let symbolId = 'wire_line';
    if (lineType === 'trench') symbolId = 'trench_line';
    else if (lineType === 'comm_open') symbolId = 'comm_open_line';
    else if (lineType === 'comm_covered') symbolId = 'comm_covered_line';

    const newFeature = {
      type: 'Feature',
      properties: {
        id: Date.now(),
        symbol: symbolId,
        iconId: symbolId,
        color: color,
        name: name,
        lineWidth: (lineType === 'wire' || lineType === 'comm_open') ? 3 : 4,
        isLinear: true,
        lineType: lineType,
        origCoords: coords,
        flipSide: flipSide
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
    const geom = this.trenchGeometryService.generateLinearGeometry(newCoords, lineType, flipSide);

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
    const geom = this.trenchGeometryService.generateLinearGeometry(origCoords, lineType, newFlip);

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
      if (!this.isDraggingVertex) {
        map.getCanvas().style.cursor = 'grab';
      }
    });

    map.on('mouseleave', 'linear_vertices_layer', () => {
      if (!this.isDraggingVertex && !this.selectedSymbol()) {
        map.getCanvas().style.cursor = '';
      }
    });

    map.on('mousedown', 'tactical_symbols_layer', (e: any) => {
      if (e.originalEvent && e.originalEvent.button === 2) return;
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
      if (!this.selectedSymbol()) {
        map.getCanvas().style.cursor = 'move';
      }
    });

    map.on('mouseleave', 'tactical_symbols_layer', () => {
      if (!this.selectedSymbol()) {
        map.getCanvas().style.cursor = '';
      }
    });
  }

  private updateTacticalSymbolsSource() {
    if (!this.mapInstance) return;
    const source = this.mapInstance.getSource('tactical-symbols') as maplibregl.GeoJSONSource;
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features: this.placedSymbols()
      });
    }
  }
}
