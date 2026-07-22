import { Component, inject, signal, computed, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapViewModel } from '../../viewmodels/map.viewmodel';
import { NativeMapExportService } from '../../services/native-map-export.service';
import maplibregl from 'maplibre-gl';

@Component({
  selector: 'app-map-export',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './map-export.component.html',
  styleUrl: './map-export.component.css'
})
export class MapExportComponent implements OnDestroy {
  readonly vm = inject(MapViewModel);
  readonly nativeExport = inject(NativeMapExportService);

  // Физический размер экспортируемой области на бумаге в мм
  readonly widthMm = signal<number>(200);
  readonly heightMm = signal<number>(150);
  
  // Качество DPI (96, 300, 600)
  readonly dpi = signal<number>(600);

  // Топографический масштаб экспорта (0 = Авто/Экранный, 2000 = 1:2000, 5000 = 1:5000, 10000 = 1:10000, 25000 = 1:25000, 50000 = 1:50000)
  readonly exportScale = signal<number>(0);

  // Сигналы текущих размеров окна для динамического перерасчета видоискателя
  readonly windowWidth = signal<number>(window.innerWidth);
  readonly windowHeight = signal<number>(window.innerHeight);

  // Состояние генерации
  readonly isGenerating = signal<boolean>(false);
  readonly generationProgress = signal<string>('');
  readonly exportPercent = signal<number | null>(null);

  // Перетаскивание ручек ресайза мышью
  private activeResizeHandle: string | null = null;
  private resizeStartX = 0;
  private resizeStartY = 0;
  private resizeStartWidthMm = 0;
  private resizeStartHeightMm = 0;

  // Максимальный размер растрового холста WebGL (32K полиграфическое суперразрешение благодаря тайлингу на бэкенде)
  private readonly maxWebGLSize = 32768;

  @HostListener('window:resize')
  onResize() {
    this.windowWidth.set(window.innerWidth);
    this.windowHeight.set(window.innerHeight);
  }

  private getGeodistance(p1: {lng: number; lat: number}, p2: {lng: number; lat: number}): number {
    const R = 6378137; // Радиус Земли WGS-84 в метрах
    const lat1 = (p1.lat * Math.PI) / 180;
    const lat2 = (p2.lat * Math.PI) / 180;
    const deltaLat = ((p2.lat - p1.lat) * Math.PI) / 180;
    const deltaLng = ((p2.lng - p1.lng) * Math.PI) / 180;

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  ngOnDestroy() {
    this.removeResizeListeners();
  }

  // Расчет пропорций
  readonly aspectRatio = computed(() => this.widthMm() / this.heightMm());

  // Вычисление масштабного коэффициента экранных пикселей на 1 мм
  readonly scalePxPerMm = computed(() => {
    const wWidth = Math.max(300, this.windowWidth() - 340);
    const wHeight = Math.max(300, this.windowHeight() - 80);

    const maxW = wWidth * 0.65;
    const maxH = wHeight * 0.65;

    // Вычисляем базовый масштаб для стандартных 200х150 мм
    const baseScale = Math.min(maxW / 200, maxH / 150);
    return Math.max(0.5, Math.min(6.0, baseScale));
  });

  // Вычисление экранных размеров рамки видоискателя (независимо по каждой оси)
  readonly viewfinderSize = computed(() => {
    const scale = this.scalePxPerMm();
    return {
      width: Math.round(this.widthMm() * scale),
      height: Math.round(this.heightMm() * scale)
    };
  });

  // Динамическое вычисление печатного размера в миллиметрах
  readonly printSizeMm = computed(() => {
    const selectedScale = this.exportScale();
    const wMmInput = this.widthMm();
    const hMmInput = this.heightMm();

    if (selectedScale <= 0) {
      return { width: wMmInput, height: hMmInput };
    }

    const mainMap = this.vm.getMapInstance();
    if (!mainMap) return { width: wMmInput, height: hMmInput };

    const vf = this.viewfinderSize();
    const container = mainMap.getContainer();
    if (!container) return { width: wMmInput, height: hMmInput };

    const vfBox = document.querySelector('.viewfinder-box');
    let x1: number, y1: number, x2: number, y2: number;
    let aspect = vf.width / vf.height;

    if (vfBox) {
      const vfRect = vfBox.getBoundingClientRect();
      const mapRect = container.getBoundingClientRect();
      x1 = vfRect.left - mapRect.left;
      y1 = vfRect.top - mapRect.top;
      x2 = vfRect.right - mapRect.left;
      y2 = vfRect.bottom - mapRect.top;
      if (vfRect.height > 0) {
        aspect = vfRect.width / vfRect.height;
      }
    } else {
      const centerX = container.clientWidth / 2;
      const centerY = container.clientHeight / 2;
      x1 = centerX - vf.width / 2;
      y1 = centerY - vf.height / 2;
      x2 = centerX + vf.width / 2;
      y2 = centerY + vf.height / 2;
    }

    const p_tl = mainMap.unproject([x1, y1]);
    const p_tr = mainMap.unproject([x2, y1]);

    const widthMeters = this.getGeodistance(p_tl, p_tr) * 1.10;
    const metersPerMm = selectedScale / 1000;
    
    const widthMmResult = Math.max(50, Math.round(widthMeters / metersPerMm));
    const heightMmResult = Math.max(50, Math.round(widthMmResult / aspect));

    return {
      width: widthMmResult,
      height: heightMmResult
    };
  });

  // Расчет результирующего размера изображения в пикселях с учетом лимитов WebGL
  readonly resultPixels = computed(() => {
    const pSize = this.printSizeMm();
    const dpiVal = this.dpi();

    const wPx = Math.round((pSize.width / 25.4) * dpiVal);
    const hPx = Math.round((pSize.height / 25.4) * dpiVal);

    const maxDim = Math.max(wPx, hPx);
    const safeScale = maxDim > this.maxWebGLSize ? this.maxWebGLSize / maxDim : 1.0;

    return {
      width: Math.round(wPx * safeScale),
      height: Math.round(hPx * safeScale)
    };
  });

  close() {
    this.vm.isMapExportOpen.set(false);
  }

  /**
   * Начало интерактивного изменения размера видоискателя мышью
   */
  startResize(event: MouseEvent, handle: string) {
    event.preventDefault();
    event.stopPropagation();

    this.activeResizeHandle = handle;
    this.resizeStartX = event.clientX;
    this.resizeStartY = event.clientY;
    this.resizeStartWidthMm = this.widthMm();
    this.resizeStartHeightMm = this.heightMm();

    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
  }

  private readonly onMouseMove = (event: MouseEvent) => {
    if (!this.activeResizeHandle) return;

    const deltaX = event.clientX - this.resizeStartX;
    const deltaY = event.clientY - this.resizeStartY;

    let dxPx = 0;
    let dyPx = 0;

    switch (this.activeResizeHandle) {
      case 'e':
        dxPx = deltaX * 2;
        break;
      case 'w':
        dxPx = -deltaX * 2;
        break;
      case 's':
        dyPx = deltaY * 2;
        break;
      case 'n':
        dyPx = -deltaY * 2;
        break;
      case 'se':
        dxPx = deltaX * 2;
        dyPx = deltaY * 2;
        break;
      case 'sw':
        dxPx = -deltaX * 2;
        dyPx = deltaY * 2;
        break;
      case 'ne':
        dxPx = deltaX * 2;
        dyPx = -deltaY * 2;
        break;
      case 'nw':
        dxPx = -deltaX * 2;
        dyPx = -deltaY * 2;
        break;
    }

    const scale = this.scalePxPerMm();

    if (dxPx !== 0) {
      const deltaMm = Math.round(dxPx / scale);
      const newWidth = Math.max(50, Math.min(1200, this.resizeStartWidthMm + deltaMm));
      this.widthMm.set(newWidth);
    }
    if (dyPx !== 0) {
      const deltaMm = Math.round(dyPx / scale);
      const newHeight = Math.max(50, Math.min(1200, this.resizeStartHeightMm + deltaMm));
      this.heightMm.set(newHeight);
    }
  };

  private readonly onMouseUp = () => {
    this.activeResizeHandle = null;
    this.removeResizeListeners();
  };

  private removeResizeListeners() {
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
  }

  /**
   * Экспорт фрагмента карты в PNG высокого разрешения.
   */
  async generateExport() {
    if (this.isGenerating()) return;

    try {
      const mainMap = this.vm.getMapInstance();
      if (!mainMap) throw new Error('Карта не проинициализирована');

      // 1. СНАЧАЛА получаем физические размеры и пиксели, пока рамка находится в DOM
      const printMm = this.printSizeMm();
      const rawPx = this.resultPixels();

      // Получаем DOM-элемент рамки видоискателя и контейнера карты
      const vfBox = document.querySelector('.viewfinder-box');
      if (!vfBox) throw new Error('Рамка видоискателя не найдена');

      const container = mainMap.getContainer();
      const vfRect = vfBox.getBoundingClientRect();
      const mapRect = container.getBoundingClientRect();

      // Вычисляем точные экранные координаты углов рамки относительно контейнера карты
      const x1 = vfRect.left - mapRect.left;
      const y1 = vfRect.top - mapRect.top;
      const x2 = vfRect.right - mapRect.left;
      const y2 = vfRect.bottom - mapRect.top;

      // Вычисляем точный географический центр рамки видоискателя на карте
      const centerX = (x1 + x2) / 2;
      const centerY = (y1 + y2) / 2;
      const centerLngLat = mainMap.unproject([centerX, centerY]);
      const exportCenter: [number, number] = [centerLngLat.lng, centerLngLat.lat];

      // 2. Теперь безопасно переключаем состояние в режим генерации
      this.isGenerating.set(true);
      this.generationProgress.set('Подготовка экспорта...');

      const dpiVal = this.dpi();

      const targetW = rawPx.width;
      const targetH = rawPx.height;

      // Вычисляем исходный размер в пикселях без лимитов WebGL для расчета safeScale
      const wPxOriginal = Math.round((printMm.width / 25.4) * dpiVal);
      const safeScale = wPxOriginal > 0 ? targetW / wPxOriginal : 1.0;

      // logicalW/H привязаны к targetW/H через целевой effectiveRatio
      const effectiveRatio = Math.max(1.0, dpiVal / 96);
      const logicalW = Math.max(1, Math.round(targetW / effectiveRatio));
      const logicalH = Math.max(1, Math.round(targetH / effectiveRatio));

      // Точный вычисление дельты долготы левого и правого края видоискателя
      const leftLngLat = mainMap.unproject([x1, centerY]);
      const rightLngLat = mainMap.unproject([x2, centerY]);
      let deltaLng = Math.abs(rightLngLat.lng - leftLngLat.lng);
      if (deltaLng <= 0) deltaLng = 0.00001;

      // Вычисление exportZoom из топомасштаба или прямого охвата видоискателя
      const selectedScale = this.exportScale();
      let exportZoom: number;

      if (selectedScale > 0) {
        // Метры на 1 мм бумаги
        const metersPerMm = selectedScale / 1000;
        // Пикселей на 1 мм при целевом DPI
        const pxPerMm = dpiVal / 25.4;
        // Метров на 1 физический пиксель в экспорте
        const metersPerPx = metersPerMm / pxPerMm;

        const latRad = (exportCenter[1] * Math.PI) / 180;
        const cosLat = Math.cos(latRad);

        // Точный эквивалент зума для нативного полотна при ratio = 1
        exportZoom = Math.log2((156543.03392 * cosLat) / metersPerPx) - Math.log2(effectiveRatio);

        if (safeScale < 1.0) {
          exportZoom += Math.log2(safeScale);
        }
      } else {
        // Авто: абсолютная геодезическая математика совпадения ширины targetW с шириной видоискателя
        exportZoom = Math.log2((targetW / 512) * (360 / deltaLng));
      }

      this.generationProgress.set('Подготовка тактических условных знаков...');

      // Собираем все динамические картинки (топознаки) с основной карты
      const images = (mainMap.style as any).imageManager?.images || {};
      const exportImages: { [key: string]: { url: string; pixelRatio: number; sdf: boolean } } = {};
      const addPromises: Promise<void>[] = [];

      for (const key of Object.keys(images)) {
        const img = images[key];
        const isSdf = img?.sdf || false;

        const promise = new Promise<void>((res) => {
          const svgEl = document.querySelector(`svg[data-icon-id="${key}"]`) as SVGElement;

          if (svgEl) {
            const clonedSvg = svgEl.cloneNode(true) as SVGElement;
            const sizeMultiplier = effectiveRatio;
            const origW = parseFloat(svgEl.getAttribute('width') || '24');
            const origH = parseFloat(svgEl.getAttribute('height') || '24');

            let targetWidth = origW * sizeMultiplier;
            let targetHeight = origH * sizeMultiplier;

            if (targetWidth > 1024 || targetHeight > 1024) {
              const scale = Math.min(1024 / targetWidth, 1024 / targetHeight);
              targetWidth = Math.floor(targetWidth * scale);
              targetHeight = Math.floor(targetHeight * scale);
            }

            clonedSvg.setAttribute('width', targetWidth.toString());
            clonedSvg.setAttribute('height', targetHeight.toString());

            const svgString = new XMLSerializer().serializeToString(clonedSvg);
            const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);

            const image = new Image();
            image.src = url;
            image.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = targetWidth;
              canvas.height = targetHeight;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(image, 0, 0);
                try {
                  const base64Data = canvas.toDataURL('image/png');
                  exportImages[key] = {
                    url: base64Data,
                    pixelRatio: 1.0, // Для ratio=1 иконка рисуется в ее крупном физическом размере targetWidth
                    sdf: isSdf
                  };
                } catch (e) {
                  console.error('Ошибка экспорта изображения:', e);
                }
              }
              URL.revokeObjectURL(url);
              res();
            };
            image.onerror = () => {
              URL.revokeObjectURL(url);
              res();
            };
          } else {
            const extracted = this.getStyleImageDataUrl(img);
            if (extracted) {
              const origW = extracted.width;
              const origH = extracted.height;

              const sizeMultiplier = effectiveRatio;
              let targetWidth = origW * sizeMultiplier;
              let targetHeight = origH * sizeMultiplier;

              if (targetWidth > 1024 || targetHeight > 1024) {
                const scale = Math.min(1024 / targetWidth, 1024 / targetHeight);
                targetWidth = Math.floor(targetWidth * scale);
                targetHeight = Math.floor(targetHeight * scale);
              }

              const imgObj = new Image();
              imgObj.src = extracted.url;
              imgObj.onload = () => {
                const resCanvas = document.createElement('canvas');
                resCanvas.width = targetWidth;
                resCanvas.height = targetHeight;
                const resCtx = resCanvas.getContext('2d');

                if (resCtx) {
                  resCtx.imageSmoothingEnabled = true;
                  resCtx.imageSmoothingQuality = 'high';
                  resCtx.drawImage(imgObj, 0, 0, origW, origH, 0, 0, targetWidth, targetHeight);
                  try {
                    const base64Data = resCanvas.toDataURL('image/png');
                    exportImages[key] = {
                      url: base64Data,
                      pixelRatio: 1.0, // Для ratio=1 иконка рисуется в ее крупном физическом размере targetWidth
                      sdf: isSdf
                    };
                  } catch (e) {
                    console.error('Ошибка экспорта изображения:', e);
                  }
                }
                res();
              };
              imgObj.onerror = () => res();
            } else {
              res();
            }
          }
        });

        addPromises.push(promise);
      }

      await Promise.all(addPromises);

      this.generationProgress.set('Выполнение рендеринга на бэкенде...');

      this.generationProgress.set('Выполнение рендеринга на бэкенде...');

      const rawStyle = mainMap.getStyle();
      const styleObj = this.sanitizeStyleForNative(rawStyle);
      
      const placedSymbols = this.vm.placedSymbols();
      const enrichedPlacedSymbols = this.enrichFeaturesArrayForNative(placedSymbols);

      if (styleObj.sources) {
        for (const sourceId of Object.keys(styleObj.sources)) {
          const sourceSpec = styleObj.sources[sourceId];
          if (sourceSpec.type === 'geojson') {
            if (sourceId === 'tactical-symbols') {
              sourceSpec.data = {
                type: 'FeatureCollection',
                features: enrichedPlacedSymbols
              };
            } else {
              const mapSource = mainMap.getSource(sourceId) as any;
              let rawData = null;
              if (mapSource) {
                rawData = mapSource._data || (mapSource._options && mapSource._options.data) || mapSource.data;
              }
              if (rawData) {
                sourceSpec.data = this.enrichGeoJsonForNative(rawData);
              } else if (!sourceSpec.data || typeof sourceSpec.data !== 'object' || !sourceSpec.data.type) {
                sourceSpec.data = { type: 'FeatureCollection', features: [] };
              }
            }
          }
        }
      }
      
      const styleJson = JSON.stringify(styleObj);

      const tacticalCollection = {
        type: 'FeatureCollection',
        features: enrichedPlacedSymbols
      };
      const geojsonData = JSON.stringify(tacticalCollection);

      const scaleTag = selectedScale > 0 ? `1-${selectedScale}` : 'auto';
      const filename = `map_export_${printMm.width}x${printMm.height}mm_${scaleTag}_${dpiVal}dpi_${new Date().toISOString().slice(0, 10)}.png`;

      const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;

      this.exportPercent.set(0);
      let unlisten: (() => void) | null = null;

      if (isTauri) {
        try {
          const { listen } = await import('@tauri-apps/api/event');
          unlisten = await listen<string>('export-progress', (event) => {
            try {
              const data = JSON.parse(event.payload);
              if (data && typeof data.percent === 'number') {
                this.exportPercent.set(data.percent);
              }
            } catch (e) {}
          });
        } catch (e) {}

        const savedPath = await this.nativeExport.exportMapNative({
          center: [exportCenter[0], exportCenter[1]],
          zoom: exportZoom,
          bearing: mainMap.getBearing(),
          pitch: mainMap.getPitch(),
          width_mm: printMm.width,
          height_mm: printMm.height,
          dpi: dpiVal,
          scale: selectedScale,
          logical_width: targetW,
          logical_height: targetH,
          ratio: 1,
          filename: filename
        }, styleJson, geojsonData, JSON.stringify(exportImages));

        if (unlisten) unlisten();
        this.exportPercent.set(100);

        alert(`ГИС-карта высокого разрешения успешно сохранена на бэкенде в папку загрузок:\n${savedPath}`);
      } else {
        alert('Нативный экспорт поддерживается только в оффлайн-приложении Tauri.');
      }

      this.close();
    } catch (err: any) {
      console.error('Ошибка экспорта:', err);
      alert(`Не удалось выполнить экспорт: ${err.message || err}`);
    } finally {
      this.exportPercent.set(null);
      this.isGenerating.set(false);
    }
  }

  /**
   * Преобразует стилевые выражения MapLibre (такие как coalesce) в базовые выражение get,
   * поддерживаемые нативным C++ рендерером MapLibre GL Native.
   */
  private sanitizeStyleForNative(styleObj: any): any {
    if (!styleObj || !Array.isArray(styleObj.layers)) return styleObj;
    const cloned = JSON.parse(JSON.stringify(styleObj));

    if (!cloned.glyphs) {
      cloned.glyphs = 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf';
    }

    const sanitizeExpr = (expr: any): any => {
      if (!Array.isArray(expr)) return expr;

      // Преобразование ['coalesce', ['get', 'size'], 0.08] -> ['case', ['has', 'size'], ['get', 'size'], 0.08]
      if (expr[0] === 'coalesce') {
        const getArg = expr.slice(1).find((arg: any) => Array.isArray(arg) && arg[0] === 'get');
        const defaultVal = expr.slice(1).find((arg: any) => typeof arg === 'number' || typeof arg === 'string' || typeof arg === 'boolean');
        if (getArg && getArg[1] && defaultVal !== undefined) {
          return ['case', ['has', getArg[1]], ['get', getArg[1]], defaultVal];
        }
        if (getArg) {
          return sanitizeExpr(getArg);
        }
        const primitive = expr.slice(1).find((arg: any) => !Array.isArray(arg));
        if (primitive !== undefined) {
          return primitive;
        }
        return expr[1] ? sanitizeExpr(expr[1]) : expr;
      }

      return expr.map((item: any) => sanitizeExpr(item));
    };

    for (const layer of cloned.layers) {
      if (layer.paint) {
        // C++ MapLibre GL Native НЕ поддерживает выражения в line-dasharray, line-pattern, fill-pattern
        if (layer.paint['line-dasharray'] && Array.isArray(layer.paint['line-dasharray'])) {
          const isDataDriven = JSON.stringify(layer.paint['line-dasharray']).includes('"get"');
          if (isDataDriven) {
            delete layer.paint['line-dasharray'];
          }
        }
        if (layer.paint['line-pattern'] && Array.isArray(layer.paint['line-pattern'])) {
          delete layer.paint['line-pattern'];
        }
        if (layer.paint['fill-pattern'] && Array.isArray(layer.paint['fill-pattern'])) {
          delete layer.paint['fill-pattern'];
        }

        for (const prop of Object.keys(layer.paint)) {
          layer.paint[prop] = sanitizeExpr(layer.paint[prop]);
        }
      }

      if (layer.layout) {
        for (const prop of Object.keys(layer.layout)) {
          layer.layout[prop] = sanitizeExpr(layer.layout[prop]);
        }

        // Для слоев типа symbol безопасно обогащаем текстовые свойства при их отсутствии
        if (layer.type === 'symbol' && (layer.id.startsWith('tactical_') || layer.source === 'tactical-symbols')) {
          if (!layer.layout) layer.layout = {};
          layer.layout['text-field'] = '{name}';
          layer.layout['text-font'] = ['Noto Sans Regular'];
          layer.layout['text-size'] = 16;
          layer.layout['text-offset'] = [0, 1.8];
          layer.layout['text-anchor'] = 'top';
          layer.layout['text-allow-overlap'] = true;
          layer.layout['text-ignore-placement'] = true;

          if (!layer.paint) layer.paint = {};
          layer.paint['text-color'] = '#000000';
          layer.paint['text-halo-color'] = '#ffffff';
          layer.paint['text-halo-width'] = 4.0;
        }
      }
    }

    cloned.glyphs = 'https://cdn.jsdelivr.net/gh/openmaptiles/fonts@gh-pages/{fontstack}/{range}.pbf';

    // Сортируем слои по Z-Index: пользовательские нанесенные слои переносим в конец (наверх всех карт)
    const baseLayers: any[] = [];
    const overlayLayers: any[] = [];

    const isOverlayLayer = (l: any) => {
      if (!l || !l.id) return false;
      const id = l.id;
      const src = l.source || '';
      return id.startsWith('tactical_') || 
             id.startsWith('measurement-') || 
             id.startsWith('range-rings-') || 
             id.startsWith('drawing-') || 
             id.startsWith('march-') || 
             id.startsWith('viewshed-') || 
             src === 'tactical-symbols' || 
             src === 'measurement-data' || 
             src === 'range-rings-data' || 
             src === 'viewshed-data' || 
             src === 'drawing-preview';
    };

    for (const layer of cloned.layers) {
      if (isOverlayLayer(layer)) {
        overlayLayers.push(layer);
      } else {
        baseLayers.push(layer);
      }
    }

    cloned.layers = [...baseLayers, ...overlayLayers];

    return cloned;
  }

  /**
   * Обогащает фичи GeoJSON явными свойствами (iconId, color, lineWidth и т.д.),
   * чтобы C++ рендерер гарантированно считывал их без сбоев.
   */
  private enrichGeoJsonForNative(data: any): any {
    if (!data || typeof data !== 'object') return data;
    const cloned = JSON.parse(JSON.stringify(data));

    if (cloned.type === 'FeatureCollection' && Array.isArray(cloned.features)) {
      for (const feature of cloned.features) {
        if (!feature.properties) feature.properties = {};
        const props = feature.properties;

        // Если есть symbol, но нет iconId — проставляем iconId
        if (props.symbol && !props.iconId) {
          props.iconId = props.symbol;
        }
        // Дефолтный цвет для линий/полигонов
        if (!props.color) {
          props.color = props.symbol ? '#ef4444' : '#854d0e';
        }
        if (props.lineWidth === undefined) {
          props.lineWidth = 3.5;
        }
        if (props.fillOpacity === undefined) {
          props.fillOpacity = 0.4;
        }
      }
    }

    return cloned;
  }

  /**
   * Извлекает размеры и пиксельные данные из любого объекта StyleImage MapLibre GL JS,
   * конвертируя их в готовый PNG Data URL для передачи на бэкенд.
   */
  private getStyleImageDataUrl(img: any): { url: string; width: number; height: number } | null {
    if (!img) return null;

    // 1. Проверяем наличие нативного Canvas / HTMLImage / ImageBitmap
    const htmlElem = img.userImage?.display || img.userImage || img;
    if (htmlElem && typeof htmlElem.getContext === 'function') {
      try {
        return {
          url: htmlElem.toDataURL('image/png'),
          width: htmlElem.width,
          height: htmlElem.height
        };
      } catch {}
    }

    if (htmlElem instanceof HTMLImageElement || (typeof ImageBitmap !== 'undefined' && htmlElem instanceof ImageBitmap)) {
      try {
        const w = htmlElem.width;
        const h = htmlElem.height;
        if (w > 0 && h > 0) {
          const cvs = document.createElement('canvas');
          cvs.width = w;
          cvs.height = h;
          const ctx = cvs.getContext('2d');
          if (ctx) {
            ctx.drawImage(htmlElem, 0, 0);
            return { url: cvs.toDataURL('image/png'), width: w, height: h };
          }
        }
      } catch {}
    }

    // 2. Ищем сырые пиксельные данные (RGBAArray)
    let width = 0;
    let height = 0;
    let rawBuffer: Uint8Array | Uint8ClampedArray | null = null;

    if (img.userImage) {
      width = img.userImage.width || 0;
      height = img.userImage.height || 0;
      if (img.userImage.data) {
        rawBuffer = img.userImage.data.data || img.userImage.data;
      }
    }

    if (!width || !height || !rawBuffer) {
      if (img.data) {
        width = img.data.width || img.width || 0;
        height = img.data.height || img.height || 0;
        if (img.data instanceof Uint8Array || img.data instanceof Uint8ClampedArray) {
          rawBuffer = img.data;
        } else if (img.data.data) {
          rawBuffer = img.data.data;
        }
      }
    }

    if (!width || !height) {
      width = img.width || 0;
      height = img.height || 0;
    }

    if (width > 0 && height > 0 && rawBuffer && rawBuffer.length >= width * height * 4) {
      try {
        const cvs = document.createElement('canvas');
        cvs.width = width;
        cvs.height = height;
        const ctx = cvs.getContext('2d');
        if (ctx) {
          const imgData = ctx.createImageData(width, height);
          imgData.data.set(rawBuffer.subarray(0, width * height * 4));
          ctx.putImageData(imgData, 0, 0);
          return { url: cvs.toDataURL('image/png'), width, height };
        }
      } catch (e) {
        console.error('Error converting raw pixels for style image:', e);
      }
    }

    return null;
  }

  /**
   * Обогащает массив фичей явными свойствами iconId, color, lineWidth для C++ MapLibre GL Native.
   */
  private enrichFeaturesArrayForNative(features: any[]): any[] {
    if (!Array.isArray(features)) return [];
    return features.map(f => {
      const feat = JSON.parse(JSON.stringify(f));
      if (!feat.properties) feat.properties = {};
      const props = feat.properties;

      if (props.symbol && !props.iconId) {
        props.iconId = props.symbol;
      }
      if (!props.name) {
        props.name = props.label || props.title || props.text || '';
      }
      if (!props.color) {
        props.color = props.symbol ? '#ef4444' : '#854d0e';
      }
      if (props.lineWidth === undefined) {
        props.lineWidth = 3.5;
      }
      if (props.fillOpacity === undefined) {
        props.fillOpacity = 0.4;
      }
      console.error(`[FEATURE LOG] Feature id=${props.id || 'unnamed'}, name="${props.name || ''}", symbol="${props.symbol || props.iconId || ''}"`);
      return feat;
    });
  }
}
