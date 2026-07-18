import { Injectable, signal } from '@angular/core';
import maplibregl from 'maplibre-gl';

export interface MapImageOverlay {
  id: string;
  name: string;
  url: string;
  coordinates: [[number, number], [number, number], [number, number], [number, number]]; // TL, TR, BR, BL
  opacity: number;
  locked: boolean;
  
  // Геометрические параметры для пропорционального масштабирования и вращения
  center: [number, number]; // [lng, lat]
  widthMeters: number; // ширина в метрах
  aspectRatio: number; // отношение ширины к высоте
  bearing: number; // угол поворота в градусах (0..360 по часовой стрелке от севера)
}

@Injectable({
  providedIn: 'root'
})
export class ImageOverlayService {
  private map: maplibregl.Map | null = null;
  
  // Реактивный список всех оверлеев
  readonly overlays = signal<MapImageOverlay[]>([]);
  
  // Словарь для хранения инстансов маркеров на карте по ID оверлея
  private overlayMarkers = new Map<string, maplibregl.Marker[]>();

  /**
   * Инициализация инстанса карты
   */
  init(map: maplibregl.Map) {
    this.map = map;
    
    // Пересоздаем оверлеи на новом инстансе карты при её смене
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

  /**
   * Добавить новое изображение на карту по центру экрана
   */
  addImageOverlay(file: File) {
    if (!this.map) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) return;

      // Сначала асинхронно считываем реальный Aspect Ratio изображения
      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
        const aspectRatio = img.width / img.height || 1.0;
        const id = 'img-overlay-' + Date.now();
        const name = file.name || 'Изображение-' + (this.overlays().length + 1);

        // Рассчитываем начальные координаты в центре экрана
        const bounds = this.map!.getBounds();
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();
        const centerLngLat = this.map!.getCenter();
        const center: [number, number] = [centerLngLat.lng, centerLngLat.lat];

        // Определяем начальную ширину в метрах на основе размера экрана
        const widthLng = ne.lng - sw.lng;
        const latRad = center[1] * Math.PI / 180;
        const metersPerLngDegree = 111320 * Math.cos(latRad);
        
        // Начальная ширина изображения = 25% от ширины текущего экрана карты
        const initialWidthMeters = Math.max(100, widthLng * 0.25 * metersPerLngDegree);
        const bearing = 0; // По умолчанию поворот отсутствует

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

          // Добавляем источник на карту
          this.map.addSource('src-' + id, {
            type: 'image',
            url: dataUrl,
            coordinates: coordinates
          });

          // Добавляем растровый слой
          const beforeId = this.map.getLayer('military-fill') ? 'military-fill' : undefined;
          this.map.addLayer({
            id: 'layer-' + id,
            type: 'raster',
            source: 'src-' + id,
            paint: {
              'raster-opacity': newOverlay.opacity
            }
          }, beforeId);

          // Обновляем список оверлеев
          this.overlays.update(arr => [...arr, newOverlay]);

          // Создаем маркеры управления
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

  /**
   * Удалить оверлей с карты
   */
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

  /**
   * Закрепить / открепить оверлей на карте
   */
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

  /**
   * Удаление маркеров управления для конкретного оверлея
   */
  private removeMarkers(id: string) {
    const markers = this.overlayMarkers.get(id);
    if (markers) {
      markers.forEach(m => m.remove());
      this.overlayMarkers.delete(id);
    }
  }

  /**
   * Создание интерактивных маркеров для пропорционального масштабирования, вращения и сдвига
   */
  private createMarkers(overlay: MapImageOverlay) {
    if (!this.map || overlay.locked) return;

    this.removeMarkers(overlay.id);

    const cornerMarkers: maplibregl.Marker[] = [];
    const id = overlay.id;

    // 1. Создаем 4 угловых маркера (TL, TR, BR, BL)
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

      // Событие пропорционального масштабирования
      marker.on('drag', () => {
        const newLngLat = marker.getLngLat();
        const currentOverlay = this.overlays().find(o => o.id === id);
        if (!currentOverlay) return;

        // Вычисляем расстояние от центра до курсора в метрах
        const halfDiagMeters = this.getDistanceMeters(currentOverlay.center, [newLngLat.lng, newLngLat.lat]);
        const diagMeters = halfDiagMeters * 2;

        // Рассчитываем новую ширину по формуле диагонали с сохранением Aspect Ratio
        const newWidthMeters = diagMeters / Math.sqrt(1 + 1 / (currentOverlay.aspectRatio * currentOverlay.aspectRatio));

        // Вычисляем новые координаты углов
        const newCoords = this.calculateCoordinates(
          currentOverlay.center,
          newWidthMeters,
          currentOverlay.aspectRatio,
          currentOverlay.bearing
        );

        // Обновляем оверлей на карте
        const src = this.map!.getSource('src-' + id) as maplibregl.ImageSource;
        if (src) {
          src.setCoordinates(newCoords);
        }

        // Обновляем состояние
        this.overlays.update(arr => arr.map(o => o.id === id ? { 
          ...o, 
          widthMeters: newWidthMeters, 
          coordinates: newCoords 
        } : o));

        // Обновляем позиции других маркеров
        this.updateAllOverlayMarkers(id, centerMarker, rotateMarker);
      });

      cornerMarkers.push(marker);
    });

    // 2. Создаем центральный маркер для перемещения
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

      // Вычисляем новые координаты углов от нового центра
      const newCoords = this.calculateCoordinates(
        newCenter,
        currentOverlay.widthMeters,
        currentOverlay.aspectRatio,
        currentOverlay.bearing
      );

      // Обновляем оверлей на карте
      const src = this.map!.getSource('src-' + id) as maplibregl.ImageSource;
      if (src) {
        src.setCoordinates(newCoords);
      }

      // Обновляем состояние
      this.overlays.update(arr => arr.map(o => o.id === id ? { 
        ...o, 
        center: newCenter, 
        coordinates: newCoords 
      } : o));

      // Сдвигаем угловые маркеры и маркер поворота
      cornerMarkers.forEach((m, idx) => {
        m.setLngLat(newCoords[idx]);
      });
      
      const topCenterLng = (newCoords[0][0] + newCoords[1][0]) / 2;
      const topCenterLat = (newCoords[0][1] + newCoords[1][1]) / 2;
      rotateMarker.setLngLat([topCenterLng, topCenterLat]);
    });

    // 3. Создаем маркер вращения (зеленый кружок с визуальной ножкой)
    const rotateEl = document.createElement('div');
    rotateEl.className = 'overlay-rotate-handle';
    rotateEl.style.width = '20px';
    rotateEl.style.height = '35px'; // 20px ножка + 15px кружок
    rotateEl.style.display = 'flex';
    rotateEl.style.flexDirection = 'column';
    rotateEl.style.alignItems = 'center';
    rotateEl.style.cursor = 'grab';

    const circle = document.createElement('div');
    circle.style.width = '14px';
    circle.style.height = '14px';
    circle.style.borderRadius = '50%';
    circle.style.background = '#10b981'; // Зеленый цвет поворота
    circle.style.border = '2px solid #ffffff';
    circle.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
    circle.style.cursor = 'grab';

    const line = document.createElement('div');
    line.style.width = '2px';
    line.style.height = '21px';
    line.style.background = '#466bf7';

    rotateEl.appendChild(circle);
    rotateEl.appendChild(line);

    // Начальная координата - середина верхней грани оверлея
    const initialTopCenterLng = (overlay.coordinates[0][0] + overlay.coordinates[1][0]) / 2;
    const initialTopCenterLat = (overlay.coordinates[0][1] + overlay.coordinates[1][1]) / 2;

    const rotateMarker = new maplibregl.Marker({
      element: rotateEl,
      draggable: true,
      anchor: 'bottom' // Фиксирует нижний край ножки на верхней грани
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

      // Вычисляем вектор от центра к курсору
      const dx = (cursorLngLat.lng - center[0]) * metersPerLngDegree;
      const dy = (cursorLngLat.lat - center[1]) * metersPerLatDegree;

      // Вычисляем угол в градусах (0..360 по часовой стрелке от севера)
      let newBearing = Math.atan2(dx, dy) * 180 / Math.PI;
      newBearing = (newBearing + 360) % 360;

      // Рассчитываем новые координаты
      const newCoords = this.calculateCoordinates(
        center,
        currentOverlay.widthMeters,
        currentOverlay.aspectRatio,
        newBearing
      );

      // Обновляем оверлей на карте
      const src = this.map!.getSource('src-' + id) as maplibregl.ImageSource;
      if (src) {
        src.setCoordinates(newCoords);
      }

      // Обновляем состояние
      this.overlays.update(arr => arr.map(o => o.id === id ? { 
        ...o, 
        bearing: newBearing, 
        coordinates: newCoords 
      } : o));

      // Обновляем все маркеры на карте
      this.updateAllOverlayMarkers(id, centerMarker, rotateMarker);
    });

    // Сохраняем ссылки на все маркеры для последующего удаления
    const allMarkers = [...cornerMarkers, centerMarker, rotateMarker];
    this.overlayMarkers.set(id, allMarkers);
  }

  /**
   * Обновить положение всех маркеров оверлея на карте в соответствии с текущим состоянием
   */
  private updateAllOverlayMarkers(id: string, centerMarker: maplibregl.Marker, rotateMarker: maplibregl.Marker) {
    const overlay = this.overlays().find(o => o.id === id);
    if (!overlay) return;

    const markers = this.overlayMarkers.get(id);
    if (!markers) return;

    // Первые 4 маркера - угловые
    for (let i = 0; i < 4; i++) {
      markers[i].setLngLat(overlay.coordinates[i]);
    }

    // 5-й маркер - центр
    centerMarker.setLngLat(overlay.center);

    // 6-й маркер - поворот (середина верхней грани)
    const topCenterLng = (overlay.coordinates[0][0] + overlay.coordinates[1][0]) / 2;
    const topCenterLat = (overlay.coordinates[0][1] + overlay.coordinates[1][1]) / 2;
    rotateMarker.setLngLat([topCenterLng, topCenterLat]);
  }

  /**
   * Вспомогательный метод расчета 4 угловых координат на основе центра, размеров и угла
   */
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

    // Локальные декартовы смещения углов в метрах относительно центра
    // TL, TR, BR, BL
    const localCoords = [
      [-halfWidth, halfHeight],  // TL
      [halfWidth, halfHeight],   // TR
      [halfWidth, -halfHeight],  // BR
      [-halfWidth, -halfHeight]  // BL
    ];

    return localCoords.map(lc => {
      // Поворот по часовой стрелке
      const rx = lc[0] * cos + lc[1] * sin;
      const ry = -lc[0] * sin + lc[1] * cos;
      return [
        centerLng + rx / metersPerLngDegree,
        centerLat + ry / metersPerLatDegree
      ];
    }) as [[number, number], [number, number], [number, number], [number, number]];
  }

  /**
   * Вспомогательный метод расчета расстояния в метрах между точками с поправкой на широту
   */
  private getDistanceMeters(p1: [number, number], p2: [number, number]): number {
    const latRad = ((p1[1] + p2[1]) / 2) * Math.PI / 180;
    const cosLat = Math.cos(latRad);
    const dx = (p1[0] - p2[0]) * 111320 * cosLat;
    const dy = (p1[1] - p2[1]) * 111132;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
