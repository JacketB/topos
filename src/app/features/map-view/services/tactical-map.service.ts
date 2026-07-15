import { Injectable, signal } from '@angular/core';
import maplibregl from 'maplibre-gl';
import { TacticalSymbol } from '../consts/tactical-symbols.const';

@Injectable({
  providedIn: 'root'
})
export class TacticalMapService {
  readonly placedSymbols = signal<any[]>([]);
  readonly selectedSymbol = signal<TacticalSymbol | null>(null);
  readonly selectedPlacedSymbol = signal<any | null>(null);

  selectPlacedSymbol(symbol: any | null) {
    this.selectedPlacedSymbol.set(symbol);
  }

  private mapInstance: maplibregl.Map | null = null;
  private isDragging = false;
  private dragFeature: any = null;
  private dragRafId: any = null;
  private pendingDragLngLat: [number, number] | null = null;

  initLayers(map: maplibregl.Map) {
    if (!map.getSource('tactical-symbols')) {
      map.addSource('tactical-symbols', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
    }
    if (!map.getLayer('tactical_symbols_layer')) {
      map.addLayer({
        id: 'tactical_symbols_layer',
        type: 'symbol',
        source: 'tactical-symbols',
        layout: {
          'icon-image': ['get', 'symbol'],
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
        const newSymbol = {
          type: 'Feature',
          properties: {
            id: Date.now(),
            symbol: template.symbol,
            name: template.name,
            size: 0.08,
            angle: 0
          },
          geometry: {
            type: 'Point',
            coordinates: coords
          }
        };

        this.ensureSymbolImageLoaded(template.symbol, () => {
          this.placedSymbols.update(prev => [...prev, newSymbol]);
          this.updateTacticalSymbolsSource();
        });
        this.selectedSymbol.set(null);
        map.getCanvas().style.cursor = '';
        return;
      }

      const features = map.queryRenderedFeatures(e.point, {
        layers: ['tactical_symbols_layer']
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

  ensureSymbolImageLoaded(symbolId: string, callback?: () => void) {
    if (!this.mapInstance || !symbolId) {
      if (callback) callback();
      return;
    }
    if (this.mapInstance.hasImage(symbolId)) {
      if (callback) callback();
      return;
    }
    const img = new Image();
    img.src = `symbols/${symbolId}.svg`;
    img.onload = () => {
      if (this.mapInstance && !this.mapInstance.hasImage(symbolId)) {
        this.mapInstance.addImage(symbolId, img);
      }
      if (callback) callback();
    };
    img.onerror = () => {
      if (callback) callback();
    };
  }

  selectTemplateSymbol(symbol: TacticalSymbol) {
    if (this.selectedSymbol()?.id === symbol.id) {
      this.selectedSymbol.set(null);
      if (this.mapInstance) this.mapInstance.getCanvas().style.cursor = '';
    } else {
      this.selectedSymbol.set(symbol);
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
      this.placedSymbols.update(prev => 
        prev.map(s => s.properties['id'] === selected.properties['id'] ? {
          ...s,
          properties: { ...s.properties, size }
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

  deleteSelectedPlacedSymbol() {
    const selected = this.selectedPlacedSymbol();
    if (selected) {
      this.placedSymbols.update(prev => prev.filter(s => s.properties['id'] !== selected.properties['id']));
      this.selectedPlacedSymbol.set(null);
      this.updateTacticalSymbolsSource();
    }
  }

  private syncSelectedPlacedSymbol() {
    const selected = this.selectedPlacedSymbol();
    if (selected) {
      const found = this.placedSymbols().find(s => s.properties['id'] === selected.properties['id']);
      if (found) {
        this.selectedPlacedSymbol.set(found);
      }
    }
  }

  private setupSymbolDragging(map: maplibregl.Map) {
    map.on('mousedown', 'tactical_symbols_layer', (e: any) => {
      if (e.features && e.features.length > 0 && !this.selectedSymbol()) {
        e.preventDefault();
        this.isDragging = true;
        this.dragFeature = e.features[0];
        map.getCanvas().style.cursor = 'grabbing';
      }
    });

    map.on('mousemove', (e) => {
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
