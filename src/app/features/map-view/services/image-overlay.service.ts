import { Injectable, signal } from '@angular/core';
import maplibregl from 'maplibre-gl';

export interface MapImageOverlay {
  id: string;
  name: string;
  url: string;
  coordinates: [[number, number], [number, number], [number, number], [number, number]];
  opacity: number;
  locked: boolean;
  center: [number, number];
  widthMeters: number;
  aspectRatio: number;
  bearing: number;
}

@Injectable({
  providedIn: 'root'
})
export class ImageOverlayService {
  private map: maplibregl.Map | null = null;
  readonly overlays = signal<MapImageOverlay[]>([]);
  private overlayMarkers = new Map<string, maplibregl.Marker[]>();

  init(map: maplibregl.Map) {
    this.map = map;
    
    const currentOverlays = this.overlays();
    if (currentOverlays.length > 0) {
      const restoreOverlays = () => {
        if (!this.map) return;
        currentOverlays.forEach(o => {
          this.removeMarkers(o.id);
          if (this.map) {
            if (!this.map.getSource('src-' + o.id)) {
              this.map.addSource('src-' + o.id, {
                type: 'image',
                url: o.url,
                coordinates: o.coordinates
              });
            }

            if (!this.map.getLayer('layer-' + o.id)) {
              const beforeId = this.map.getLayer('military-fill') ? 'military-fill' : undefined;
              this.map.addLayer({
                id: 'layer-' + o.id,
                type: 'raster',
                source: 'src-' + o.id,
                paint: {
                  'raster-opacity': o.opacity
                }
              }, beforeId);
            }

            if (!o.locked) {
              this.createMarkers(o);
            }
          }
        });
      };

      if (this.map.isStyleLoaded()) {
        restoreOverlays();
      } else {
        this.map.once('style.load', () => {
          restoreOverlays();
        });
      }
    }
  }

  addImageOverlay(file: File) {
    if (!this.map) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) return;

      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
        const aspectRatio = img.width / img.height || 1.0;
        const id = 'img-overlay-' + Date.now();
        const name = file.name || 'Изображение-' + (this.overlays().length + 1);

        const bounds = this.map!.getBounds();
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();
        const centerLngLat = this.map!.getCenter();
        const center: [number, number] = [centerLngLat.lng, centerLngLat.lat];

        const widthLng = ne.lng - sw.lng;
        const latRad = center[1] * Math.PI / 180;
        const metersPerLngDegree = 111320 * Math.cos(latRad);
        
        const initialWidthMeters = Math.max(100, widthLng * 0.25 * metersPerLngDegree);
        const bearing = 0;

        const coordinates = this.calculateCoordinates(center, initialWidthMeters, aspectRatio, bearing);

        const newOverlay: MapImageOverlay = {
          id,
          name,
          url: dataUrl,
          coordinates,
          opacity: 0.6,
          locked: false,
          center,
          widthMeters: initialWidthMeters,
          aspectRatio,
          bearing
        };

        const addAction = () => {
          if (!this.map) return;

          this.map.addSource('src-' + id, {
            type: 'image',
            url: dataUrl,
            coordinates: coordinates
          });

          const beforeId = this.map.getLayer('military-fill') ? 'military-fill' : undefined;
          this.map.addLayer({
            id: 'layer-' + id,
            type: 'raster',
            source: 'src-' + id,
            paint: {
              'raster-opacity': newOverlay.opacity
            }
          }, beforeId);

          this.overlays.update(arr => [...arr, newOverlay]);

          this.createMarkers(newOverlay);
        };

        if (this.map!.isStyleLoaded()) {
          addAction();
        } else {
          this.map!.once('style.load', () => {
            addAction();
          });
        }
      };
    };

    reader.readAsDataURL(file);
  }

  removeOverlay(id: string) {
    if (!this.map) return;

    this.removeMarkers(id);

    if (this.map.getLayer('layer-' + id)) {
      this.map.removeLayer('layer-' + id);
    }

    if (this.map.getSource('src-' + id)) {
      this.map.removeSource('src-' + id);
    }

    this.overlays.update(arr => arr.filter(o => o.id !== id));
  }

  /**
   * Установить прозрачность оверлея
   */
  setOpacity(id: string, opacity: number) {
    if (!this.map) return;

    if (this.map.getLayer('layer-' + id)) {
      this.map.setPaintProperty('layer-' + id, 'raster-opacity', opacity);
    }

    this.overlays.update(arr => arr.map(o => o.id === id ? { ...o, opacity } : o));
  }

  setLocked(id: string, locked: boolean) {
    this.overlays.update(arr => arr.map(o => o.id === id ? { ...o, locked } : o));

    const overlay = this.overlays().find(o => o.id === id);
    if (!overlay) return;

    if (locked) {
      this.removeMarkers(id);
    } else {
      this.createMarkers(overlay);
    }
  }

  private removeMarkers(id: string) {
    const markers = this.overlayMarkers.get(id);
    if (markers) {
      markers.forEach(m => m.remove());
      this.overlayMarkers.delete(id);
    }
  }

  private createMarkers(overlay: MapImageOverlay) {
    if (!this.map || overlay.locked) return;

    this.removeMarkers(overlay.id);

    const cornerMarkers: maplibregl.Marker[] = [];
    const id = overlay.id;

    overlay.coordinates.forEach((coord, index) => {
      const el = document.createElement('div');
      el.className = 'overlay-corner-handle';
      el.style.width = '14px';
      el.style.height = '14px';
      el.style.borderRadius = '50%';
      el.style.background = '#466bf7';
      el.style.border = '2px solid #ffffff';
      el.style.cursor = (index === 0 || index === 2) ? 'nwse-resize' : 'nesw-resize';
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';

      const marker = new maplibregl.Marker({
        element: el,
        draggable: true
      })
      .setLngLat(coord)
      .addTo(this.map!);

      marker.on('drag', () => {
        const newLngLat = marker.getLngLat();
        const currentOverlay = this.overlays().find(o => o.id === id);
        if (!currentOverlay) return;

        const halfDiagMeters = this.getDistanceMeters(currentOverlay.center, [newLngLat.lng, newLngLat.lat]);
        const diagMeters = halfDiagMeters * 2;

        const newWidthMeters = diagMeters / Math.sqrt(1 + 1 / (currentOverlay.aspectRatio * currentOverlay.aspectRatio));

        const newCoords = this.calculateCoordinates(
          currentOverlay.center,
          newWidthMeters,
          currentOverlay.aspectRatio,
          currentOverlay.bearing
        );

        const src = this.map!.getSource('src-' + id) as maplibregl.ImageSource;
        if (src) {
          src.setCoordinates(newCoords);
        }

        this.overlays.update(arr => arr.map(o => o.id === id ? { 
          ...o, 
          widthMeters: newWidthMeters, 
          coordinates: newCoords 
        } : o));

        this.updateAllOverlayMarkers(id, centerMarker, rotateMarker);
      });

      cornerMarkers.push(marker);
    });

    const centerEl = document.createElement('div');
    centerEl.className = 'overlay-center-handle';
    centerEl.style.width = '20px';
    centerEl.style.height = '20px';
    centerEl.style.borderRadius = '50%';
    centerEl.style.background = '#f59e0b';
    centerEl.style.border = '2px solid #ffffff';
    centerEl.style.cursor = 'move';
    centerEl.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
    centerEl.style.display = 'flex';
    centerEl.style.alignItems = 'center';
    centerEl.style.justifyContent = 'center';
    centerEl.innerHTML = `<svg viewBox="0 0 24 24" width="10" height="10" stroke="#ffffff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 9 2 12 5 15"></polyline><polyline points="9 5 12 2 15 5"></polyline><polyline points="15 19 12 22 9 19"></polyline><polyline points="19 9 22 12 19 15"></polyline><line x1="2" y1="12" x2="22" y2="12"></line><line x1="12" y1="2" x2="12" y2="22"></line></svg>`;

    const centerMarker = new maplibregl.Marker({
      element: centerEl,
      draggable: true
    })
    .setLngLat(overlay.center)
    .addTo(this.map!);

    let dragStartCenter: [number, number] = [0, 0];

    centerMarker.on('dragstart', () => {
      const currentOverlay = this.overlays().find(o => o.id === id);
      if (!currentOverlay) return;
      dragStartCenter = [...currentOverlay.center] as [number, number];
    });

    centerMarker.on('drag', () => {
      const currentOverlay = this.overlays().find(o => o.id === id);
      if (!currentOverlay) return;

      const currentCenterLngLat = centerMarker.getLngLat();
      const newCenter: [number, number] = [currentCenterLngLat.lng, currentCenterLngLat.lat];

      const newCoords = this.calculateCoordinates(
        newCenter,
        currentOverlay.widthMeters,
        currentOverlay.aspectRatio,
        currentOverlay.bearing
      );

      const src = this.map!.getSource('src-' + id) as maplibregl.ImageSource;
      if (src) {
        src.setCoordinates(newCoords);
      }

      this.overlays.update(arr => arr.map(o => o.id === id ? { 
        ...o, 
        center: newCenter, 
        coordinates: newCoords 
      } : o));

      cornerMarkers.forEach((m, idx) => {
        m.setLngLat(newCoords[idx]);
      });
      
      const topCenterLng = (newCoords[0][0] + newCoords[1][0]) / 2;
      const topCenterLat = (newCoords[0][1] + newCoords[1][1]) / 2;
      rotateMarker.setLngLat([topCenterLng, topCenterLat]);
    });

    const rotateEl = document.createElement('div');
    rotateEl.className = 'overlay-rotate-handle';
    rotateEl.style.width = '20px';
    rotateEl.style.height = '35px';
    rotateEl.style.display = 'flex';
    rotateEl.style.flexDirection = 'column';
    rotateEl.style.alignItems = 'center';
    rotateEl.style.cursor = 'grab';

    const circle = document.createElement('div');
    circle.style.width = '14px';
    circle.style.height = '14px';
    circle.style.borderRadius = '50%';
    circle.style.background = '#10b981';
    circle.style.border = '2px solid #ffffff';
    circle.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
    circle.style.cursor = 'grab';

    const line = document.createElement('div');
    line.style.width = '2px';
    line.style.height = '21px';
    line.style.background = '#466bf7';

    rotateEl.appendChild(circle);
    rotateEl.appendChild(line);

    const initialTopCenterLng = (overlay.coordinates[0][0] + overlay.coordinates[1][0]) / 2;
    const initialTopCenterLat = (overlay.coordinates[0][1] + overlay.coordinates[1][1]) / 2;

    const rotateMarker = new maplibregl.Marker({
      element: rotateEl,
      draggable: true,
      anchor: 'bottom'
    })
    .setLngLat([initialTopCenterLng, initialTopCenterLat])
    .addTo(this.map!);

    rotateMarker.on('drag', () => {
      const currentOverlay = this.overlays().find(o => o.id === id);
      if (!currentOverlay) return;

      const cursorLngLat = rotateMarker.getLngLat();
      const center = currentOverlay.center;
      
      const latRad = center[1] * Math.PI / 180;
      const metersPerLngDegree = 111320 * Math.cos(latRad);
      const metersPerLatDegree = 111132;

      const dx = (cursorLngLat.lng - center[0]) * metersPerLngDegree;
      const dy = (cursorLngLat.lat - center[1]) * metersPerLatDegree;

      let newBearing = Math.atan2(dx, dy) * 180 / Math.PI;
      newBearing = (newBearing + 360) % 360;

      const newCoords = this.calculateCoordinates(
        center,
        currentOverlay.widthMeters,
        currentOverlay.aspectRatio,
        newBearing
      );

      const src = this.map!.getSource('src-' + id) as maplibregl.ImageSource;
      if (src) {
        src.setCoordinates(newCoords);
      }

      this.overlays.update(arr => arr.map(o => o.id === id ? { 
        ...o, 
        bearing: newBearing, 
        coordinates: newCoords 
      } : o));

      this.updateAllOverlayMarkers(id, centerMarker, rotateMarker);
    });

    const allMarkers = [...cornerMarkers, centerMarker, rotateMarker];
    this.overlayMarkers.set(id, allMarkers);
  }

  private updateAllOverlayMarkers(id: string, centerMarker: maplibregl.Marker, rotateMarker: maplibregl.Marker) {
    const overlay = this.overlays().find(o => o.id === id);
    if (!overlay) return;

    const markers = this.overlayMarkers.get(id);
    if (!markers) return;

    for (let i = 0; i < 4; i++) {
      markers[i].setLngLat(overlay.coordinates[i]);
    }

    centerMarker.setLngLat(overlay.center);

    const topCenterLng = (overlay.coordinates[0][0] + overlay.coordinates[1][0]) / 2;
    const topCenterLat = (overlay.coordinates[0][1] + overlay.coordinates[1][1]) / 2;
    rotateMarker.setLngLat([topCenterLng, topCenterLat]);
  }

  private calculateCoordinates(
    center: [number, number],
    widthMeters: number,
    aspectRatio: number,
    bearing: number
  ): [[number, number], [number, number], [number, number], [number, number]] {
    const centerLng = center[0];
    const centerLat = center[1];

    const latRad = centerLat * Math.PI / 180;
    const cosLat = Math.cos(latRad);
    const metersPerLngDegree = 111320 * cosLat;
    const metersPerLatDegree = 111132;

    const halfWidth = widthMeters / 2;
    const halfHeight = halfWidth / aspectRatio;

    const rad = bearing * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const localCoords = [
      [-halfWidth, halfHeight],
      [halfWidth, halfHeight],
      [halfWidth, -halfHeight],
      [-halfWidth, -halfHeight]
    ];

    return localCoords.map(lc => {
      const rx = lc[0] * cos + lc[1] * sin;
      const ry = -lc[0] * sin + lc[1] * cos;
      return [
        centerLng + rx / metersPerLngDegree,
        centerLat + ry / metersPerLatDegree
      ];
    }) as [[number, number], [number, number], [number, number], [number, number]];
  }

  private getDistanceMeters(p1: [number, number], p2: [number, number]): number {
    const latRad = ((p1[1] + p2[1]) / 2) * Math.PI / 180;
    const cosLat = Math.cos(latRad);
    const dx = (p1[0] - p2[0]) * 111320 * cosLat;
    const dy = (p1[1] - p2[1]) * 111132;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
