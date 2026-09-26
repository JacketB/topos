import { Component, inject, signal, computed, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapViewModel } from '../../viewmodels/map.viewmodel';
import { NativeMapExportService } from '../../services/native-map-export.service';
import { MapExportSanitizerUtils } from '../../utils/map-export-sanitizer.utils';
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

      const effectiveRatio = Math.max(1.0, dpiVal / 96);
      const logicalW = Math.max(1, Math.round(targetW / effectiveRatio));
      const logicalH = Math.max(1, Math.round(targetH / effectiveRatio));

      const selectedScale = this.exportScale();
      let exportZoom: number;

      if (selectedScale > 0) {
        const metersPerMm = selectedScale / 1000;
        const pxPerMm = dpiVal / 25.4;
        const metersPerPx = metersPerMm / pxPerMm;

        const latRad = (exportCenter[1] * Math.PI) / 180;
        const cosLat = Math.cos(latRad);

        exportZoom = Math.log2((78271.516964 * cosLat) / metersPerPx);

        if (safeScale < 1.0) {
          exportZoom += Math.log2(safeScale);
        }
      } else {
        const screenZoom = mainMap.getZoom();
        const vfScreenWidth = Math.max(1, x2 - x1);
        exportZoom = screenZoom + Math.log2(targetW / vfScreenWidth);
      }

      this.generationProgress.set('Подготовка тактических условных знаков...');

      const styleAny = (mainMap.style as any) || {};
      const images: { [key: string]: any } = {
        ...(styleAny.imageManager?.images || {}),
        ...(styleAny._imageManager?.images || {}),
        ...(styleAny._images || {})
      };
      if (typeof mainMap.listImages === 'function') {
        try {
          const list = mainMap.listImages();
          for (const imgId of list) {
            if (!images[imgId] && mainMap.hasImage(imgId)) {
              const loadedImg = styleAny.getImage ? styleAny.getImage(imgId) : (styleAny.imageManager?.getImage ? styleAny.imageManager.getImage(imgId) : null);
              if (loadedImg) {
                images[imgId] = loadedImg;
              }
            }
          }
        } catch (e) {}
      }

      for (const s of this.vm.placedSymbols()) {
        const symbolId = s.properties?.['symbol'];
        if (symbolId) {
          const iconId = s.properties?.['iconId'] || symbolId;
          if (!images[iconId]) {
            images[iconId] = { symbolId, color: s.properties?.['color'] };
          }
        }
      }

      const exportImages: { [key: string]: { url: string; pixelRatio: number; sdf: boolean } } = {};
      const addPromises: Promise<void>[] = [];

      for (const key of Object.keys(images)) {
        const img = images[key];
        const isSdf = img?.sdf || false;

        const promise = new Promise<void>(async (res) => {
          let symbolId = img?.symbolId || key;
          let customColor = img?.color || '';

          if (key.includes('_c_')) {
            const parts = key.split('_c_');
            symbolId = parts[0];
            customColor = '#' + parts[1];
          }

          let svgText = '';
          try {
            const r = await fetch(`symbols/${symbolId}.svg`);
            if (r.ok) {
              svgText = await r.text();
            }
          } catch {}

          if (svgText) {
            try {
              const parser = new DOMParser();
              const doc = parser.parseFromString(svgText, 'image/svg+xml');
              if (customColor) {
                const elements = doc.querySelectorAll('path, polygon, circle, rect, line, polyline, ellipse');
                elements.forEach(el => {
                  const stroke = el.getAttribute('stroke');
                  if (stroke && stroke !== 'none' && stroke !== 'transparent') {
                    el.setAttribute('stroke', customColor);
                  }
                  const fill = el.getAttribute('fill');
                  if (fill && fill !== 'none' && fill !== 'transparent') {
                    el.setAttribute('fill', customColor);
                  }
                  if (!stroke && !fill && el.tagName.toLowerCase() === 'path') {
                    el.setAttribute('fill', customColor);
                  }
                });
              }

              const svgDoc = doc.querySelector('svg');
              if (svgDoc) {
                svgDoc.setAttribute('width', '512');
                svgDoc.setAttribute('height', '512');
              }

              const modifiedSvg = new XMLSerializer().serializeToString(doc);
              const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(modifiedSvg)}`;

              const image = new Image();
              image.crossOrigin = 'anonymous';
              image.src = dataUrl;
              image.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = 512;
                canvas.height = 512;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.drawImage(image, 0, 0, 512, 512);
                  try {
                    exportImages[key] = {
                      url: canvas.toDataURL('image/png'),
                      pixelRatio: 1.0,
                      sdf: isSdf
                    };
                  } catch {}
                }
                res();
              };
              image.onerror = () => {
                fallbackRasterize();
              };
              return;
            } catch {
              fallbackRasterize();
              return;
            }
          }

          fallbackRasterize();

          function fallbackRasterize() {
            const svgEl = document.querySelector(`svg[data-icon-id="${key}"]`) as SVGElement;
            if (svgEl) {
              const clonedSvg = svgEl.cloneNode(true) as SVGElement;
              clonedSvg.setAttribute('width', '512');
              clonedSvg.setAttribute('height', '512');
              const svgString = new XMLSerializer().serializeToString(clonedSvg);
              const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
              const image = new Image();
              image.src = dataUrl;
              image.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = 512;
                canvas.height = 512;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                  ctx.drawImage(image, 0, 0, 512, 512);
                  try {
                    exportImages[key] = {
                      url: canvas.toDataURL('image/png'),
                      pixelRatio: 1.0,
                      sdf: isSdf
                    };
                  } catch {}
                }
                res();
              };
              image.onerror = () => res();
              return;
            }

            const extracted = MapExportSanitizerUtils.getStyleImageDataUrl(img);
            if (extracted) {
              const origW = extracted.width;
              const origH = extracted.height;
              let targetWidth = Math.max(512, origW * effectiveRatio);
              let targetHeight = Math.max(512, origH * effectiveRatio);
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
                    exportImages[key] = {
                      url: resCanvas.toDataURL('image/png'),
                      pixelRatio: 1.0,
                      sdf: isSdf
                    };
                  } catch {}
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

      const placedSymbols = this.vm.tacticalMapService.getAllFeaturesWithPatrol(this.vm.placedSymbols());
      const enrichedPlacedSymbols = MapExportSanitizerUtils.enrichFeaturesArrayForNative(placedSymbols, effectiveRatio);

      const marchPlacesList = this.vm.marchPlacesAlongRoute();
      const marchPlacesFeatures = (marchPlacesList || []).map((p: any, idx) => {
        return {
          type: 'Feature',
          properties: {
            id: `march_place_${idx}`,
            name: p.name,
            distanceKm: p.distanceAlongRouteKm,
            textAnchor: p.textAnchor || 'center',
            textOffset: p.textOffset || [0, 0],
            svgAnchor: p.svgAnchor || 'middle',
            svgOffset: p.svgOffset || [0, 0],
            svgBaseline: p.svgBaseline || 'central'
          },
          geometry: {
            type: 'Point',
            coordinates: p.coords
          }
        };
      });

      const marchFeatures = placedSymbols.filter(
        (f: any) => f.properties?.lineType === 'march_route' || f.properties?.symbol === 'march_route'
      );
      const allKmMarks: any[] = [];
      const kmStep = this.vm.marchKilometerStepKm();
      if (kmStep > 0) {
        for (const mf of marchFeatures) {
          const coords = ((mf.geometry as any)?.coordinates || mf.properties?.origCoords) as [number, number][] | undefined;
          if (coords && coords.length >= 2) {
            const marks = this.vm.marchRouteService.calculateKilometerMarks(coords, kmStep);
            allKmMarks.push(...marks);
          }
        }
      }
      const marchKmFeatures = allKmMarks.map((m, idx) => ({
        type: 'Feature',
        properties: {
          id: `march_km_${idx}`,
          label: m.label,
          km: m.km,
          bearing: m.bearing || 0
        },
        geometry: {
          type: 'Point',
          coordinates: m.coords
        }
      }));

      const rawStyle = mainMap.getStyle();

      if (rawStyle.sources) {
        if (rawStyle.sources['march-places']) {
          rawStyle.sources['march-places'] = {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: marchPlacesFeatures
            }
          };
        }
        if (rawStyle.sources['march-kilometers']) {
          rawStyle.sources['march-kilometers'] = {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: marchKmFeatures
            }
          };
        }
      }

      const styleObj = MapExportSanitizerUtils.sanitizeStyleForNative(rawStyle, effectiveRatio);

      if (styleObj.sources) {
        for (const sourceId of Object.keys(styleObj.sources)) {
          const sourceSpec = styleObj.sources[sourceId];
          if (sourceSpec.type === 'geojson') {
            if (sourceId === 'tactical-symbols') {
              sourceSpec.data = {
                type: 'FeatureCollection',
                features: enrichedPlacedSymbols
              };
            } else if (sourceId === 'march-places') {
              sourceSpec.data = {
                type: 'FeatureCollection',
                features: marchPlacesFeatures
              };
            } else if (sourceId === 'march-kilometers') {
              sourceSpec.data = {
                type: 'FeatureCollection',
                features: marchKmFeatures
              };
            } else {
              const mapSource = mainMap.getSource(sourceId) as any;
              let rawData = null;
              if (mapSource) {
                rawData = mapSource._data || (mapSource._options && mapSource._options.data) || mapSource.data;
              }
              if (rawData) {
                sourceSpec.data = MapExportSanitizerUtils.enrichGeoJsonForNative(rawData, effectiveRatio);
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

      let targetPath: string | undefined;
      if (isTauri) {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          const chosenPath = await invoke<string | null>('choose_save_path', {
            defaultName: filename,
            default_name: filename,
            extension: 'png',
            title: 'Сохранить экспортируемую карту (PNG)'
          });
          if (!chosenPath) {
            this.isGenerating.set(false);
            return;
          }
          targetPath = chosenPath;
        } catch {
          targetPath = undefined;
        }
      }

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
          filename: filename,
          target_path: targetPath
        }, styleJson, geojsonData, JSON.stringify(exportImages));

        if (unlisten) unlisten();
        this.exportPercent.set(100);

        alert(`ГИС-карта высокого разрешения успешно сохранена:\n${savedPath}`);
      } else {
        const canvas = mainMap.getCanvas();
        const dataUrl = canvas.toDataURL('image/png');

        if (typeof window !== 'undefined' && (window as any).showSaveFilePicker) {
          try {
            const handle = await (window as any).showSaveFilePicker({
              suggestedName: filename,
              types: [
                {
                  description: 'Изображение PNG (*.png)',
                  accept: { 'image/png': ['.png'] }
                }
              ]
            });
            const writable = await handle.createWritable();
            const blob = await (await fetch(dataUrl)).blob();
            await writable.write(blob);
            await writable.close();
            this.exportPercent.set(100);
            this.close();
            return;
          } catch (e: any) {
            if (e?.name === 'AbortError') {
              this.isGenerating.set(false);
              return;
            }
          }
        }

        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        this.exportPercent.set(100);
      }

      this.close();
    } catch (err: any) {
      alert(`Не удалось выполнить экспорт: ${err.message || err}`);
    } finally {
      this.exportPercent.set(null);
      this.isGenerating.set(false);
    }
  }
}
