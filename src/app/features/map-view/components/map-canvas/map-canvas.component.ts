import { Component, AfterViewInit, OnDestroy, viewChild, ElementRef, inject } from '@angular/core';
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
  templateUrl: './map-canvas.component.html',
  styleUrl: './map-canvas.component.css',
})
export class MapCanvasComponent implements AfterViewInit, OnDestroy {
  readonly mapContainer = viewChild.required<ElementRef<HTMLDivElement>>('mapContainer');
  readonly vm = inject(MapViewModel);
  public mapsUrls = mapsUrls;
  private map: maplibregl.Map | null = null;

  ngAfterViewInit() {
    this.renderMap('http://topos.localhost/belarus.pmtiles', 'vector');
  }

  renderMap(url: string, type: string) {
    if (this.map) {
      this.map.remove();
      this.map = null;
      this.vm.setMapInstance(null as any);
    }

    const protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);

    const pmtilesUrl = url;
    const pmtiles = new PMTiles(pmtilesUrl);
    protocol.add(pmtiles);

    this.map = new maplibregl.Map({
      container: this.mapContainer().nativeElement,
      style: {
        version: 8,
        sources: {
          'belarus-data': {
            type: type as any,
            url: `pmtiles://${pmtilesUrl}`,
          },
          'contours-source': {
            type: 'geojson',
            data: 'contours.geojson',
          },
          ...(type === 'vector'
            ? {
                'contours-source': { type: 'geojson', data: 'contours.geojson' },
              }
            : {}),
          [MILITARY_SOURCE_ID]: MILITARY_SOURCE_SPEC,
        },
        layers: this.getLayersForType(type) as any,
      },
      center: [27.56, 53.9],
      zoom: 10,
      fadeDuration: 0,
    });
    console.log(this.map);
    this.vm.setMapInstance(this.map);

    this.map.on('rotate', () => {
      this.vm.bearing.set(this.map ? this.map.getBearing() : 0);
    });

    this.map.on('styleimagemissing', (e) => {
      this.vm.tacticalMapService.handleMissingImage(e.id);
    });

    this.vm.tacticalMapService.init(this.map);

    this.map.on('mousemove', (e) => {
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
        this.vm.currentScale.set(this.vm.mapScaleService.getCurrentScale(this.map.getZoom()));
        this.vm.mapScaleService.updateScaleInfo(
          this.map,
          this.mapContainer().nativeElement.clientWidth,
        );
        if (this.vm.isScaleMenuOpen()) {
          this.vm.isScaleMenuOpen.set(false);
        }
      }
    });

    this.map.on('click', (e) => {
      if (this.vm.isScaleMenuOpen()) {
        this.vm.isScaleMenuOpen.set(false);
      }
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

  private getLayersForType(type: string) {
    if (type === 'raster') {
      return [
      {
        id: 'raster-layer',
        type: 'raster',
        source: 'belarus-data',
        paint: { 'raster-opacity': 1 }
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

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
      this.map = null;
      this.vm.setMapInstance(null as any);
    }
  }
}
