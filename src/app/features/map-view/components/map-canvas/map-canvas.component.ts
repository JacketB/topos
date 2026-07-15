import { Component, AfterViewInit, OnDestroy, viewChild, ElementRef, inject } from '@angular/core';
import maplibregl from 'maplibre-gl';
import { PMTiles, Protocol } from 'pmtiles';
import { MapViewModel } from '../../viewmodels/map.viewmodel';
import { mapLayers } from '../../../../consts/map-layers';
import { MILITARY_SOURCE_ID, MILITARY_SOURCE_SPEC, MILITARY_LAYERS } from '../../consts/military-layers.const';

@Component({
  selector: 'app-map-canvas',
  standalone: true,
  templateUrl: './map-canvas.component.html',
  styleUrl: './map-canvas.component.css'
})
export class MapCanvasComponent implements AfterViewInit, OnDestroy {
  readonly mapContainer = viewChild.required<ElementRef<HTMLDivElement>>('mapContainer');
  readonly vm = inject(MapViewModel);

  private map: maplibregl.Map | null = null;

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
      this.vm.cursorCoords.set(`${Math.abs(lat).toFixed(4)} ${latDir}, ${Math.abs(lng).toFixed(4)} ${lngDir}`);
    });

    this.map.on('zoom', () => {
      if (this.map) {
        this.vm.currentScale.set(this.vm.mapScaleService.getCurrentScale(this.map.getZoom()));
        this.vm.mapScaleService.updateScaleInfo(this.map, this.mapContainer().nativeElement.clientWidth);
        if (this.vm.isScaleMenuOpen()) {
          this.vm.isScaleMenuOpen.set(false);
        }
      }
    });

    this.map.on('click', (e) => {
      if (this.vm.isScaleMenuOpen()) {
        this.vm.isScaleMenuOpen.set(false);
      }
      if (this.vm.isMeasuring() && this.map) {
        this.vm.mapMeasurementService.addPoint([e.lngLat.lng, e.lngLat.lat], this.map);
      }
    });

    this.map.on('contextmenu', (e) => {
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
        this.vm.mapScaleService.updateScaleInfo(this.map, this.mapContainer().nativeElement.clientWidth);
        this.vm.isAppReady.set(true);
      }
    });
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
      this.map = null;
      this.vm.setMapInstance(null as any);
    }
  }
}
