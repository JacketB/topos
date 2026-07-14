import { Injectable, signal } from '@angular/core';
import maplibregl from 'maplibre-gl';
import { TacticalSymbol } from '../consts/tactical-symbols.const';

@Injectable({
  providedIn: 'root'
})
export class TacticalMapService {
  readonly bearing = signal<number>(0);
  readonly mouseCoordinates = signal<{lat: number, lng: number}>({ lat: 53.9000, lng: 27.5600 });
  readonly appStatus = signal<string>('Загрузка карты...');
  readonly isAppReady = signal<boolean>(false);

  selectedSymbol: TacticalSymbol | null = null;
  private symbolsList: any[] = [];
  private draggedFeatureIndex: number | null = null;

  selectSymbol(symbol: TacticalSymbol, map?: maplibregl.Map, draw?: any) {
    if (this.selectedSymbol?.id === symbol.id) {
      this.selectedSymbol = null;
      if (map) map.getCanvas().style.cursor = '';
    } else {
      this.selectedSymbol = symbol;
      if (map) {
        if (draw && draw.getMode() !== 'simple_select') {
          draw.changeMode('simple_select');
        }
        map.getCanvas().style.cursor = 'copy';
      }
    }
  }

  addSymbolToMap(map: maplibregl.Map, coords: [number, number], symbolName: string) {
    const feature = {
      type: 'Feature',
      properties: {
        symbol: this.selectedSymbol?.symbol || symbolName,
        name: this.selectedSymbol?.name || symbolName,
        size: this.selectedSymbol?.size || 0.08
      },
      geometry: {
        type: 'Point',
        coordinates: coords
      }
    };

    this.symbolsList.push(feature);
    this.updateTacticalSymbolsSource(map);
  }

  setupSymbolDragging(map: maplibregl.Map, draw: any) {
    map.on('mouseenter', 'tactical_symbols_layer', () => {
      if (!this.selectedSymbol && (!draw || draw.getMode() === 'simple_select')) {
        map.getCanvas().style.cursor = 'move';
      }
    });

    map.on('mouseleave', 'tactical_symbols_layer', () => {
      if (!this.selectedSymbol && (!draw || draw.getMode() === 'simple_select')) {
        map.getCanvas().style.cursor = '';
      }
    });

    map.on('mousedown', 'tactical_symbols_layer', (e: any) => {
      if (this.selectedSymbol || (draw && draw.getMode() !== 'simple_select')) return;
      e.preventDefault();

      const features = map.queryRenderedFeatures(e.point, { layers: ['tactical_symbols_layer'] });
      if (!features.length) return;

      const clickedCoords = (features[0].geometry as any).coordinates;
      const idx = this.symbolsList.findIndex(f =>
        Math.abs(f.geometry.coordinates[0] - clickedCoords[0]) < 0.0001 &&
        Math.abs(f.geometry.coordinates[1] - clickedCoords[1]) < 0.0001
      );

      if (idx !== -1) {
        this.draggedFeatureIndex = idx;
        map.getCanvas().style.cursor = 'grabbing';
      }
    });

    map.on('mousemove', (e: any) => {
      if (this.draggedFeatureIndex !== null) {
        this.symbolsList[this.draggedFeatureIndex].geometry.coordinates = [e.lngLat.lng, e.lngLat.lat];
        this.updateTacticalSymbolsSource(map);
      }
    });

    map.on('mouseup', () => {
      if (this.draggedFeatureIndex !== null) {
        this.draggedFeatureIndex = null;
        map.getCanvas().style.cursor = '';
      }
    });
  }

  private updateTacticalSymbolsSource(map: maplibregl.Map) {
    const source = map.getSource('tactical-symbols') as maplibregl.GeoJSONSource;
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features: this.symbolsList as any
      });
    }
  }
}
