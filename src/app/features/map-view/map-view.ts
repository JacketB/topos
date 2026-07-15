import { Component, AfterViewInit, OnDestroy, viewChild, ElementRef, signal, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import maplibregl from 'maplibre-gl';
import { PMTiles, Protocol } from 'pmtiles';
import { mapLayers } from '../../consts/map-layers';
import { MILITARY_SOURCE_ID, MILITARY_SOURCE_SPEC, MILITARY_LAYERS } from './consts/military-layers.const';
import { TacticalSymbolsService } from './services/tactical-symbols.service';
import { TacticalMapService } from './services/tactical-map.service';
import { MapScaleService } from './services/map-scale.service';
import { MapMeasurementService } from './services/map-measurement.service';
import { MapLayersService } from './services/map-layers.service';
import { SCALE_PRESETS, ScalePreset } from './consts/map-scale.const';

@Component({
  selector: 'app-map-view',
  imports: [DecimalPipe],
  templateUrl: './map-view.html',
  styleUrl: './map-view.css',
})
export class MapView implements AfterViewInit, OnDestroy {
  readonly mapContainer = viewChild.required<ElementRef<HTMLDivElement>>('mapContainer');
  private map: maplibregl.Map | null = null;
  
  readonly symbolsService = inject(TacticalSymbolsService);
  readonly tacticalMapService = inject(TacticalMapService);
  readonly mapScaleService = inject(MapScaleService);
  readonly mapMeasurementService = inject(MapMeasurementService);
  readonly mapLayersService = inject(MapLayersService);
  readonly scalePresets = SCALE_PRESETS;

  readonly sidebarWidth = signal<number>(340);

  readonly bearing = signal(0);
  readonly isMeasuring = this.mapMeasurementService.isMeasuring;
  readonly measurementResult = this.mapMeasurementService.measurementResult;

  readonly manuallyOpenedCategories = signal<Record<string, boolean>>({});

  readonly isAppReady = signal(false);
  readonly cursorCoords = signal<string>('53.9000 С.Ш., 27.5600 В.Д.');
  readonly currentScale = signal<number>(50000);
  readonly isScaleMenuOpen = signal(false);
  readonly isQuickLayersMenuOpen = signal(false);

  toggleQuickLayersMenu() {
    this.isQuickLayersMenuOpen.update(v => !v);
  }

  onQuickLayerToggle(groupId: string) {
    if (groupId === 'elevation') {
      const elevationGroup = this.mapLayersService.groups().find(g => g.id === 'elevation');
      const contourLayer = elevationGroup?.layers.find(l => l.id === 'contour_line');
      if (contourLayer) {
        this.mapLayersService.toggleLayer('contour_line', this.map);
        this.mapLayersService.toggleLayer('contour_label', this.map);
      } else {
        this.mapLayersService.toggleGroup('elevation', this.map);
      }
    } else {
      this.mapLayersService.toggleGroup(groupId, this.map);
    }
  }

  onStartSidebarResize(event: MouseEvent) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = this.sidebarWidth();

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(260, Math.min(700, startWidth + deltaX));
      this.sidebarWidth.set(newWidth);
      if (this.map) {
        this.map.resize();
      }
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      if (this.map) {
        this.map.resize();
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }


  ngAfterViewInit() {
    const protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);

    const pmtilesUrl = 'http://topos.localhost/belarus.pmtiles';
    const pmtiles = new PMTiles(pmtilesUrl);
    protocol.add(pmtiles);

    this.map = new maplibregl.Map({
      container: this.mapContainer().nativeElement,
      style: {
        version: 8,
        sources: {
          'belarus-data': {
            type: 'vector',
            url: `pmtiles://${pmtilesUrl}`,
          },
          'contours-source': {
            type: 'geojson',
            data: 'contours.geojson'
          },
          [MILITARY_SOURCE_ID]: MILITARY_SOURCE_SPEC
        },
        layers: [
          ...mapLayers.filter(l => l.id !== 'place_labels'),
          ...MILITARY_LAYERS,
          ...mapLayers.filter(l => l.id === 'place_labels')
        ] as any,
      },
      center: [27.56, 53.9],
      zoom: 10,
      fadeDuration: 0,
    });

    this.map.on('rotate', () => {
      this.bearing.set(this.map ? this.map.getBearing() : 0);
    });

    this.map.on('styleimagemissing', (e) => {
      const id = e.id;
      const img = new Image();
      img.src = `symbols/${id}.svg`;
      img.onload = () => {
        if (this.map && !this.map.hasImage(id)) {
          this.map.addImage(id, img);
        }
      };
    });

    this.tacticalMapService.init(this.map);

    this.map.on('mousemove', (e) => {
      const lat = e.lngLat.lat;
      const lng = e.lngLat.lng;
      const latDir = lat >= 0 ? 'С.Ш.' : 'Ю.Ш.';
      const lngDir = lng >= 0 ? 'В.Д.' : 'З.Д.';
      this.cursorCoords.set(`${Math.abs(lat).toFixed(4)} ${latDir}, ${Math.abs(lng).toFixed(4)} ${lngDir}`);
    });

    this.map.on('zoom', () => {
      if (this.map) {
        this.currentScale.set(this.mapScaleService.getCurrentScale(this.map.getZoom()));
        this.mapScaleService.updateScaleInfo(this.map, this.mapContainer().nativeElement.clientWidth);
        if (this.isScaleMenuOpen()) {
          this.isScaleMenuOpen.set(false);
        }
      }
    });

    this.map.on('click', (e) => {
      if (this.isScaleMenuOpen()) {
        this.isScaleMenuOpen.set(false);
      }
      if (this.mapMeasurementService.isMeasuring() && this.map) {
        this.mapMeasurementService.addPoint([e.lngLat.lng, e.lngLat.lat], this.map);
      }
    });

    this.map.on('contextmenu', (e) => {
      if (this.mapMeasurementService.isMeasuring() && this.map) {
        e.preventDefault();
        this.mapMeasurementService.cancelMeasurement(this.map);
      }
    });

    this.map.on('load', () => {
      if (this.map) {
        this.mapMeasurementService.initLayers(this.map);
        this.tacticalMapService.initLayers(this.map);

        this.currentScale.set(this.mapScaleService.getCurrentScale(this.map.getZoom()));
        this.mapScaleService.updateScaleInfo(this.map, this.mapContainer().nativeElement.clientWidth);
        this.isAppReady.set(true);
      }
    });
  }

  toggleCategory(categoryId: string) {
    this.manuallyOpenedCategories.update(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  }

  isCategoryOpen(categoryId: string): boolean {
    const query = this.symbolsService.symbolSearchQuery().trim();
    if (query.length > 0) {
      return true;
    }
    return !!this.manuallyOpenedCategories()[categoryId];
  }

  toggleMeasurement() {
    this.mapMeasurementService.toggleMeasurement(this.map);
  }

  onSearchInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.symbolsService.symbolSearchQuery.set(input.value);
  }

  updatePlacedSymbolSize(event: Event) {
    const input = event.target as HTMLInputElement;
    this.tacticalMapService.updatePlacedSymbolSize(parseFloat(input.value));
  }

  updatePlacedSymbolAngle(event: Event) {
    const input = event.target as HTMLInputElement;
    this.tacticalMapService.updatePlacedSymbolAngle(parseInt(input.value, 10));
  }

  updatePlacedSymbolName(event: Event) {
    const input = event.target as HTMLInputElement;
    this.tacticalMapService.updatePlacedSymbolName(input.value);
  }

  updateTemplateSize(event: Event) {
    const input = event.target as HTMLInputElement;
    this.tacticalMapService.updateTemplateSize(parseFloat(input.value));
  }

  updateTemplateAngle(event: Event) {
    const input = event.target as HTMLInputElement;
    this.tacticalMapService.updateTemplateAngle(parseInt(input.value, 10));
  }

  updateTemplateName(event: Event) {
    const input = event.target as HTMLInputElement;
    this.tacticalMapService.updateTemplateName(input.value);
  }

  toggleScaleMenu(event: Event) {
    event.stopPropagation();
    this.isScaleMenuOpen.update(v => !v);
  }

  selectPresetScale(preset: ScalePreset, event?: Event) {
    if (event) event.stopPropagation();
    this.mapScaleService.selectScale(preset, this.map);
    this.currentScale.set(preset.scale);
    this.isScaleMenuOpen.set(false);
  }

  formatScale(scale: number): string {
    return scale.toLocaleString('ru-RU');
  }

  onSymbolCategoryToggle(categoryId: string, event: Event) {
    const details = event.target as HTMLDetailsElement;
    if (details) {
      const isOpen = details.open;
      const currentlyOpen = this.isCategoryOpen(categoryId);
      if (isOpen !== currentlyOpen) {
        this.manuallyOpenedCategories.update(state => ({
          ...state,
          [categoryId]: isOpen
        }));
      }
    }
  }

  resetBearing() {
    if (this.map) {
      this.map.resetNorth({ duration: 500 });
    }
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
}
