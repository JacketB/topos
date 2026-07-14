import { Component, AfterViewInit, OnDestroy, viewChild, ElementRef, signal } from '@angular/core';
import maplibregl from 'maplibre-gl';
import { PMTiles, Protocol } from 'pmtiles';
import { mapLayers } from '../../consts/map-layers';

@Component({
  selector: 'app-map-view',
  imports: [],
  templateUrl: './map-view.html',
  styleUrl: './map-view.css',
})
export class MapView implements AfterViewInit, OnDestroy {
  readonly mapContainer = viewChild.required<ElementRef<HTMLDivElement>>('mapContainer');
  private map: maplibregl.Map | null = null;
  readonly bearing = signal(0);

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
          'military-objects': {
            type: 'geojson',
            data: 'military.geojson'
          }
        },
        layers: [
          ...mapLayers.filter(l => l.id !== 'place_labels'),
          {
            id: 'military-labels',
            type: 'symbol',
            source: 'military-objects',
            layout: {
              'text-field': ['coalesce', ['get', 'name:ru'], ['get', 'name']],
              'text-size': ['interpolate', ['linear'], ['zoom'], 5, 8, 10, 11, 14, 14]
            },
            paint: {
              'text-color': '#ff0000',
              'text-halo-color': '#ffffff',
              'text-halo-width': 1.5
            }
          },
          ...mapLayers.filter(l => l.id === 'place_labels'),
          {
            id: 'military-fill',
            type: 'fill',
            source: 'military-objects',
            filter: ['match', ['geometry-type'], ['Polygon', 'MultiPolygon'], true, false],
            paint: {
              'fill-color': '#ff0000',
              'fill-opacity': 0.25
            }
          },
          {
            id: 'military-outline',
            type: 'line',
            source: 'military-objects',
            paint: {
              'line-color': '#ff0000',
              'line-width': 2,
              'line-dasharray': [3, 3]
            }
          }
        ] as any,
      },
      center: [27.56, 53.9],
      zoom: 10,
    });

    this.map.on('rotate', () => {
      this.bearing.set(this.map ? this.map.getBearing() : 0);
    });
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
