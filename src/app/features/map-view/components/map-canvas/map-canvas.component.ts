import { Component, AfterViewInit, OnDestroy, viewChild, ElementRef, inject, effect, computed, signal, HostListener, untracked } from '@angular/core';
import { NgStyle } from '@angular/common';
import maplibregl from 'maplibre-gl';
import { PMTiles, Protocol } from 'pmtiles';
import { MapViewModel } from '../../viewmodels/map.viewmodel';
import { mapLayers } from '../../../../consts/map-layers';
import {
  MILITARY_SOURCE_ID,
  MILITARY_SOURCE_SPEC,
  MILITARY_LAYERS,
} from '../../consts/military-layers.const';
import { mapsUrls } from '../../../../consts/map-urls';

@Component({
  selector: 'app-map-canvas',
  standalone: true,
  imports: [NgStyle],
  templateUrl: './map-canvas.component.html',
  styleUrl: './map-canvas.component.css',
})
export class MapCanvasComponent implements AfterViewInit, OnDestroy {
  readonly mapContainer = viewChild.required<ElementRef<HTMLDivElement>>('mapContainer');
  readonly vm = inject(MapViewModel);
  public mapsUrls = mapsUrls;
  private map: maplibregl.Map | null = null;
  private savePosInterval: any = null;

  readonly selectedIconFeature = computed(() => {
    const selected = this.vm.selectedPlacedSymbol();
    if (selected && !selected.properties?.['isLinear'] && selected.geometry?.type === 'Point') {
      return selected;
    }
    return null;
  });

  transformBoxStyle = signal<any>(null);

  constructor() {
    effect(() => {
      const activeId = this.vm.activeMapId();
      untracked(() => {
        const container = this.mapContainer();
        if (container) {
          const targetMap = this.mapsUrls[activeId];
          this.renderMap(targetMap.url, targetMap.type);
        }
      });
    });

    // Реактивно отслеживаем изменения выбранного знака для перерисовки рамки
    effect(() => {
      const feature = this.selectedIconFeature();
      if (feature) {
        // Чтение свойств для триггера эффекта при их обновлении
        const size = feature.properties?.['size'];
        const angle = feature.properties?.['angle'];
        setTimeout(() => this.updateTransformBoxPosition(), 0);
      } else {
        this.transformBoxStyle.set(null);
      }
    });

    // Реактивно ресайзим карту при изменении размеров или видимости сайдбаров
    effect(() => {
      this.vm.sidebarWidth();
      this.vm.tacticalMapService.selectedPlacedSymbol();
      this.vm.selectedSymbol();
      this.vm.isLayersPanelOpen();
      
      untracked(() => {
        if (this.map) {
          // Вызываем resize дважды: в начале анимации сдвига (50мс) и по ее завершению (350мс)
          setTimeout(() => {
            if (this.map) {
              this.map.resize();
              this.updateTransformBoxPosition();
            }
          }, 50);

          setTimeout(() => {
            if (this.map) {
              this.map.resize();
              this.updateTransformBoxPosition();
            }
          }, 350);
        }
      });
    });

    // Реактивно меняем курсор карты при смене режима взаимодействия
    effect(() => {
      const mode = this.vm.tacticalMapService.interactionMode();
      const lineMode = this.vm.activeLineMode();
      const isMeasuring = this.vm.isMeasuring();

      if (this.map) {
        const canvas = this.map.getCanvas();
        if (isMeasuring || lineMode !== 'none') {
          canvas.style.cursor = 'crosshair';
        } else if (mode === 'select') {
          canvas.style.cursor = 'cell';
        } else if (mode === 'pan') {
          canvas.style.cursor = 'grab';
        } else {
          canvas.style.cursor = '';
        }
      }
    });
  }

  ngAfterViewInit() {
    // Гарантируем первоначальный рендеринг карты при разрешении viewChild
    const container = this.mapContainer();
    if (container && !this.map) {
      const targetMap = this.mapsUrls[this.vm.activeMapId()];
      this.renderMap(targetMap.url, targetMap.type);
    }
  }

  renderMap(url: string, type: string) {
    let prevCenter: [number, number] = [27.56, 53.9];
    let prevZoom: number = 10;
    let prevBearing: number = 0;
    let prevPitch: number = 0;

    if (!this.map) {
      try {
        const savedPosition = localStorage.getItem('topos_map_position');
        if (savedPosition) {
          const parsed = JSON.parse(savedPosition);
          if (parsed.center && Array.isArray(parsed.center) && parsed.center.length === 2) {
            prevCenter = parsed.center;
          }
          if (typeof parsed.zoom === 'number') {
            prevZoom = parsed.zoom;
          }
          if (typeof parsed.bearing === 'number') {
            prevBearing = parsed.bearing;
          }
          if (typeof parsed.pitch === 'number') {
            prevPitch = parsed.pitch;
          }
        }
      } catch (e) {
        console.error('Ошибка загрузки положения карты из localStorage:', e);
      }
    } else {
      const center = this.map.getCenter();
      prevCenter = [center.lng, center.lat];
      prevZoom = this.map.getZoom();
      prevBearing = this.map.getBearing();
      prevPitch = this.map.getPitch();

      this.map.remove();
      this.map = null;
      this.vm.setMapInstance(null as any);
    }

    const sourcesSpec: any = {
      [MILITARY_SOURCE_ID]: MILITARY_SOURCE_SPEC,
    };

    if (type === 'xyz') {
      sourcesSpec['belarus-data'] = {
        type: 'raster',
        tiles: [url],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 20
      };
    } else {
      const protocol = new Protocol();
      maplibregl.addProtocol('pmtiles', protocol.tile);

      const pmtiles = new PMTiles(url);
      protocol.add(pmtiles);

      sourcesSpec['belarus-data'] = {
        type: type as any,
        url: `pmtiles://${url}`,
        ...(type === 'raster'
          ? {
              minzoom: 8,
              maxzoom: 13,
              tileSize: 256
            }
          : {
              minzoom: 0,
              maxzoom: 14
            })
      };

      if (type === 'vector') {
        sourcesSpec['contours-source'] = {
          type: 'geojson',
          data: 'contours.geojson'
        };
      }
    }

    this.map = new maplibregl.Map({
      container: this.mapContainer().nativeElement,
      style: {
        version: 8,
        sources: sourcesSpec,
        layers: this.getLayersForType(type) as any,
      },
      center: prevCenter,
      zoom: prevZoom,
      bearing: prevBearing,
      pitch: prevPitch,
      minZoom: 6.48,
      fadeDuration: 0,
    });
    this.vm.setMapInstance(this.map);
    this.updateCenterCoords();

    if (this.savePosInterval) {
      clearInterval(this.savePosInterval);
    }
    this.savePosInterval = setInterval(() => {
      if (this.map) {
        try {
          const center = this.map.getCenter();
          const position = {
            center: [center.lng, center.lat],
            zoom: this.map.getZoom(),
            bearing: this.map.getBearing(),
            pitch: this.map.getPitch()
          };
          localStorage.setItem('topos_map_position', JSON.stringify(position));
        } catch (e) {
          console.error('Ошибка сохранения положения карты в localStorage:', e);
        }
      }
    }, 10000);

    this.map.on('move', () => {
      this.updateTransformBoxPosition();
      this.updateCenterCoords();
    });
    this.map.on('rotate', () => {
      this.vm.bearing.set(this.map ? this.map.getBearing() : 0);
      this.updateTransformBoxPosition();
    });

    this.map.on('styleimagemissing', (e) => {
      this.vm.tacticalMapService.handleMissingImage(e.id);
    });

    this.vm.tacticalMapService.init(this.map);

    this.map.on('mousemove', (e) => {
      if (this.vm.isEditingCoords()) return;
      const lat = e.lngLat.lat;
      const lng = e.lngLat.lng;
      const latDir = lat >= 0 ? 'С.Ш.' : 'Ю.Ш.';
      const lngDir = lng >= 0 ? 'В.Д.' : 'З.Д.';
      this.vm.cursorCoords.set(
        `${Math.abs(lat).toFixed(4)} ${latDir}, ${Math.abs(lng).toFixed(4)} ${lngDir}`,
      );
    });

    this.map.on('zoom', () => {
      if (this.map) {
        this.vm.zoomLevel.set(this.map.getZoom());
        this.vm.currentScale.set(this.vm.mapScaleService.getCurrentScale(this.map.getZoom()));
        this.vm.mapScaleService.updateScaleInfo(
          this.map,
          this.mapContainer().nativeElement.clientWidth,
        );
        if (this.vm.isScaleMenuOpen()) {
          this.vm.isScaleMenuOpen.set(false);
        }
      }
      this.updateTransformBoxPosition();
      this.updateCenterCoords();
    });

    this.map.on('pitch', () => this.updateTransformBoxPosition());

    this.map.on('click', (e) => {
      if (this.vm.isScaleMenuOpen()) this.vm.isScaleMenuOpen.set(false);
      if (this.vm.isQuickLayersMenuOpen()) this.vm.isQuickLayersMenuOpen.set(false);
      if (this.vm.isToogleMapMenuOpen()) this.vm.isToogleMapMenuOpen.set(false);
      if (this.vm.activeCategoryDropdown()) this.vm.activeCategoryDropdown.set(null);

      if (this.vm.activeLineMode() !== 'none') {
        this.vm.addDrawingPoint([e.lngLat.lng, e.lngLat.lat]);
        return;
      }
      if (this.vm.isMeasuring() && this.map) {
        this.vm.mapMeasurementService.addPoint([e.lngLat.lng, e.lngLat.lat], this.map);
      }
    });

    this.map.on('dblclick', (e) => {
      if (this.vm.activeLineMode() !== 'none') {
        e.preventDefault();
        this.vm.finishDrawingLine();
      }
    });

    this.map.on('contextmenu', (e) => {
      if (this.vm.activeLineMode() !== 'none') {
        e.preventDefault();
        this.vm.cancelDrawingLine();
        return;
      }
      if (this.vm.isMeasuring() && this.map) {
        e.preventDefault();
        this.vm.mapMeasurementService.cancelMeasurement(this.map);
      }
    });

    this.map.on('load', () => {
      if (this.map) {
        this.vm.mapMeasurementService.initLayers(this.map);
        this.vm.tacticalMapService.initLayers(this.map);

        this.vm.currentScale.set(this.vm.mapScaleService.getCurrentScale(this.map.getZoom()));
        this.vm.mapScaleService.updateScaleInfo(
          this.map,
          this.mapContainer().nativeElement.clientWidth,
        );
        this.vm.isAppReady.set(true);
      }
    });
  }

  updateTransformBoxPosition() {
    const feature = this.selectedIconFeature();
    if (!feature || !this.map) {
      this.transformBoxStyle.set(null);
      return;
    }

    const coords = feature.geometry.coordinates as [number, number];
    try {
      const pos = this.map.project(coords);
      const size = feature.properties['size'] || 0.08;
      const angle = feature.properties['angle'] || 0;
      
      // Базовый размер иконки на экране (в пикселях)
      const boxSize = 512 * size;

      this.transformBoxStyle.set({
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: `${boxSize}px`,
        height: `${boxSize}px`,
        transform: `translate(-50%, -50%) rotate(${angle}deg)`
      });
    } catch (e) {
      this.transformBoxStyle.set(null);
    }
  }

  onResizeStart(event: MouseEvent, corner: string) {
    event.preventDefault();
    event.stopPropagation();

    const feature = this.selectedIconFeature();
    if (!feature || !this.map) return;

    const coords = feature.geometry.coordinates as [number, number];
    const centerPos = this.map.project(coords);
    const rect = this.mapContainer().nativeElement.getBoundingClientRect();
    const iconCenterX = centerPos.x + rect.left;
    const iconCenterY = centerPos.y + rect.top;

    const startX = event.clientX;
    const startY = event.clientY;
    const startSize = feature.properties['size'] || 0.08;

    const startDist = Math.sqrt(
      Math.pow(startX - iconCenterX, 2) + Math.pow(startY - iconCenterY, 2)
    );

    if (startDist === 0) return;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const currentDist = Math.sqrt(
        Math.pow(moveEvent.clientX - iconCenterX, 2) + Math.pow(moveEvent.clientY - iconCenterY, 2)
      );
      
      let newSize = startSize * (currentDist / startDist);
      newSize = Math.max(0.03, Math.min(0.25, newSize));
      newSize = Math.round(newSize * 1000) / 1000;

      this.vm.tacticalMapService.updatePlacedSymbolSize(newSize);
      this.updateTransformBoxPosition();
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  onRotateStart(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    const feature = this.selectedIconFeature();
    if (!feature || !this.map) return;

    const coords = feature.geometry.coordinates as [number, number];
    const centerPos = this.map.project(coords);
    const rect = this.mapContainer().nativeElement.getBoundingClientRect();
    const iconCenterX = centerPos.x + rect.left;
    const iconCenterY = centerPos.y + rect.top;

    const startX = event.clientX;
    const startY = event.clientY;
    const startAngle = feature.properties['angle'] || 0;

    const startAngleRad = Math.atan2(startY - iconCenterY, startX - iconCenterX);
    const startAngleDeg = startAngleRad * (180 / Math.PI);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const currentAngleRad = Math.atan2(moveEvent.clientY - iconCenterY, moveEvent.clientX - iconCenterX);
      const currentAngleDeg = currentAngleRad * (180 / Math.PI);

      const deltaAngle = currentAngleDeg - startAngleDeg;
      let newAngle = startAngle + deltaAngle;

      newAngle = (Math.round(newAngle) % 360 + 360) % 360;

      this.vm.tacticalMapService.updatePlacedSymbolAngle(newAngle);
      this.updateTransformBoxPosition();
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  private getLayersForType(type: string) {
    if (type === 'raster' || type === 'xyz') {
      return [
      {
        id: 'raster-layer',
        type: 'raster',
        source: 'belarus-data',
        paint: {
          'raster-opacity': 1,
          'raster-resampling': 'nearest'
        }
      },
      ...MILITARY_LAYERS
    ];
    }

    return [
      ...mapLayers.filter((l) => l.id !== 'place_labels'),
      ...MILITARY_LAYERS,
      ...mapLayers.filter((l) => l.id === 'place_labels'),
    ];
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Delete' || event.key === 'Del') {
      const target = event.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (this.vm.selectedPlacedSymbol()) {
        this.vm.deletePlacedSymbol();
      }
    }
  }

  updateCenterCoords() {
    if (!this.map) return;
    const center = this.map.getCenter();
    const lat = center.lat;
    const lng = center.lng;
    const latDir = lat >= 0 ? 'С.Ш.' : 'Ю.Ш.';
    const lngDir = lng >= 0 ? 'В.Д.' : 'З.Д.';
    this.vm.centerCoords.set(
      `${Math.abs(lat).toFixed(4)} ${latDir}, ${Math.abs(lng).toFixed(4)} ${lngDir}`
    );
  }

  ngOnDestroy() {
    if (this.savePosInterval) {
      clearInterval(this.savePosInterval);
      this.savePosInterval = null;
    }
    if (this.map) {
      this.map.remove();
      this.map = null;
      this.vm.setMapInstance(null as any);
    }
  }
}
