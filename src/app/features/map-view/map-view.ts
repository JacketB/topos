import { Component, AfterViewInit, OnDestroy, viewChild, ElementRef, inject } from '@angular/core';
import maplibregl from 'maplibre-gl';
import { PMTiles, Protocol, Source } from 'pmtiles';
import { invoke } from '@tauri-apps/api/core';
import { mapLayers } from '../../consts/map-layers';
// @ts-ignore
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { MAPBOX_DRAW_STYLES } from './consts/draw-styles.const';
import { TacticalSymbolsService } from './services/tactical-symbols.service';
import { MapScaleService } from './services/map-scale.service';
import { MapMeasurementService } from './services/map-measurement.service';
import { TacticalMapService } from './services/tactical-map.service';
import { TacticalSymbol } from './consts/tactical-symbols.const';
import { ScalePreset } from './consts/map-scale.const';

class TauriPMTilesSource implements Source {
  constructor(private filename: string) {}

  getKey() {
    return this.filename;
  }

  async getBytes(offset: number, length: number, signal?: AbortSignal, etag?: string): Promise<{ data: ArrayBuffer }> {
    try {
      const bytes = await invoke<number[]>('read_pmtiles_chunk', {
        filename: this.filename,
        offset: offset,
        length: length,
      });
      return { data: new Uint8Array(bytes).buffer };
    } catch (e) {
      console.error(`Tauri getBytes (${offset}, ${length}):`, e);
      throw e;
    }
  }
}

@Component({
  selector: 'app-map-view',
  imports: [],
  templateUrl: './map-view.html',
  styleUrl: './map-view.css',
})
export class MapView implements AfterViewInit, OnDestroy {
  readonly symbolsService = inject(TacticalSymbolsService);
  readonly scaleService = inject(MapScaleService);
  readonly measurementService = inject(MapMeasurementService);
  readonly tacticalMapService = inject(TacticalMapService);

  readonly mapContainer = viewChild.required<ElementRef<HTMLDivElement>>('mapContainer');
  private map: maplibregl.Map | null = null;
  private draw: any = null;

  protected readonly Math = Math;

  readonly availableSymbols = this.symbolsService.availableSymbols;
  readonly symbolSearchQuery = this.symbolsService.symbolSearchQuery;
  readonly groupedSymbols = this.symbolsService.groupedSymbols;

  readonly scaleBarSections = this.scaleService.scaleBarSections;
  readonly selectedScaleOption = this.scaleService.selectedScaleOption;

  get selectedSymbol(): TacticalSymbol | null {
    return this.tacticalMapService.selectedSymbol;
  }

  selectSymbol(symbol: TacticalSymbol) {
    this.tacticalMapService.selectSymbol(symbol, this.map || undefined, this.draw);
  }

  toggleMeasurementMode() {
    if (this.map) {
      this.measurementService.toggleDrawMode(this.draw, this.map);
    }
  }

  onScaleChange(preset: ScalePreset) {
    this.scaleService.selectScale(preset, this.map);
  }

  onSearchChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.symbolSearchQuery.set(input.value);
  }

  ngAfterViewInit() {
    const isTauri = '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
    const protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);

    let pmtilesUrl = '';
    if (isTauri) {
      const tauriSource = new TauriPMTilesSource('belarus.pmtiles');
      const pmtilesInstance = new PMTiles(tauriSource);
      protocol.add(pmtilesInstance);
      pmtilesUrl = 'pmtiles://belarus.pmtiles';
    } else {
      const pmtilesInstance = new PMTiles('belarus.pmtiles');
      protocol.add(pmtilesInstance);
      pmtilesUrl = 'pmtiles://belarus.pmtiles';
    }

    try {
      const styleSpec: maplibregl.StyleSpecification = {
        version: 8,
        glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
        sources: {
          'belarus-data': {
            type: 'vector',
            url: pmtilesUrl,
          },
          'belarus_pmtiles': {
            type: 'vector',
            url: pmtilesUrl,
          },
          'military-osm': {
            type: 'vector',
            url: pmtilesUrl,
          },
        },
        layers: mapLayers as any,
      };

      const map = new maplibregl.Map({
        container: this.mapContainer().nativeElement,
        style: styleSpec,
        center: [27.56, 53.9],
        zoom: 10,
      });

      this.map = map;

      const updateScale = () => {
        const containerWidth = this.mapContainer().nativeElement?.clientWidth || (window.innerWidth - 320);
        this.scaleService.updateScaleInfo(this.map, containerWidth);
      };

      updateScale();
      map.on('zoom', updateScale);
      map.on('move', updateScale);
      window.addEventListener('resize', updateScale);

      map.on('rotate', () => {
        this.tacticalMapService.bearing.set(map.getBearing());
      });

      map.on('load', () => {
        try {
          const draw = new MapboxDraw({
            displayControlsDefault: false,
            userProperties: true,
            styles: MAPBOX_DRAW_STYLES
          });

          map.addControl(draw, 'top-left');
          this.draw = draw;

          map.addSource('measurement-line', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
          });

          map.addLayer({
            id: 'measurement-line-stroke',
            type: 'line',
            source: 'measurement-line',
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': '#ff4757',
              'line-width': 3,
              'line-dasharray': [2, 2]
            }
          });

          map.addLayer({
            id: 'measurement-line-labels',
            type: 'symbol',
            source: 'measurement-line',
            layout: {
              'symbol-placement': 'line',
              'text-field': '\u25b6 \u25b6 \u25b6',
              'text-size': 12,
              'text-letter-spacing': 0.2
            },
            paint: {
              'text-color': '#ff4757'
            }
          });

          map.addSource('tactical-symbols', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] }
          });

          map.addLayer({
            id: 'tactical_symbols_layer',
            type: 'symbol',
            source: 'tactical-symbols',
            layout: {
              'icon-image': ['get', 'symbol'],
              'icon-size': ['coalesce', ['get', 'size'], 0.08],
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
              'text-field': ['get', 'name'],
              'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
              'text-size': 12,
              'text-offset': [0, 1.8],
              'text-anchor': 'top',
              'text-allow-overlap': false
            },
            paint: {
              'text-color': '#1a1a2e',
              'text-halo-color': '#ffffff',
              'text-halo-width': 2
            }
          });

          map.on('draw.create', (e: any) => {
            if (this.selectedSymbol && e.features.length > 0) {
              const pt = e.features[0];
              const coords = pt.geometry.coordinates;
              this.tacticalMapService.addSymbolToMap(map, coords, this.selectedSymbol.name);
              draw.delete(pt.id);

              this.tacticalMapService.selectedSymbol = null;
              map.getCanvas().style.cursor = '';
              draw.changeMode('simple_select');
            } else {
              this.measurementService.updateMeasurements(draw, map);
            }
          });

          map.on('draw.update', () => this.measurementService.updateMeasurements(draw, map));
          map.on('draw.selectionchange', () => this.measurementService.updateMeasurements(draw, map));
          map.on('draw.delete', () => this.measurementService.updateMeasurements(draw, map));

          map.on('draw.modechange', (e: any) => {
            const isActive = e.mode === 'draw_line_string';
            this.measurementService.isDrawModeActive.set(isActive);
            if (isActive) {
              map.getCanvas().style.cursor = 'crosshair';
            } else {
              if (this.tacticalMapService.selectedSymbol) {
                this.tacticalMapService.selectedSymbol = null;
              }
              map.getCanvas().style.cursor = '';
              if (draw?.getAll().features.length === 0) {
                this.measurementService.updateMeasurementLayer(map, []);
                this.measurementService.measurementResult.set(null);
              }
            }
          });

          map.on('click', () => {
            if (draw?.getMode() === 'draw_line_string') {
              setTimeout(() => this.measurementService.updateMeasurements(draw, map), 50);
            }
          });

          window.addEventListener('keyup', (e) => {
            if (draw?.getMode() === 'draw_line_string' && (e.key === 'Backspace' || e.key === 'Delete')) {
              setTimeout(() => this.measurementService.updateMeasurements(draw, map), 50);
            }
          });

          map.on('mousemove', (e: any) => {
            this.tacticalMapService.mouseCoordinates.set({
              lat: e.lngLat.lat,
              lng: e.lngLat.lng
            });
          });

          this.tacticalMapService.appStatus.set('Готово');
          this.tacticalMapService.isAppReady.set(true);

          this.tacticalMapService.setupSymbolDragging(map, draw);

        } catch (e: any) {
          console.error(`Ошибка при инициализации Draw на событии load: ${e.message}`);
        }
      });

      map.on('error', (event) => {
        console.error(`Ошибка MapLibre: ${event.error?.message || 'Неизвестная ошибка'}`);
      });

      map.on('tile.error', (e) => {
        console.warn(`Ошибка загрузки тайла для источника ${e.sourceId}: ${e.error?.message || 'без деталей'}`);
      });

    } catch (e: any) {
      console.error(`Критическая ошибка создания карты: ${e.message}`);
    }
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
}
