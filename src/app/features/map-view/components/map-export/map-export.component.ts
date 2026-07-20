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

  // Перетаскивание ручек ресайза мышью
  private activeResizeHandle: string | null = null;
  private resizeStartX = 0;
  private resizeStartY = 0;
  private resizeStartWidthMm = 0;
  private resizeStartHeightMm = 0;

  // Динамически определяемый лимит WebGL
  private readonly maxWebGLSize = (() => {
    if (typeof window === 'undefined') return 7680;
    try {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
      if (gl) {
        const size = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE) as number, 16384);
        return Math.max(4096, size - 256);
      }
    } catch {}
    return 7680;
  })();

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
      const logicalW = Math.round(targetW / effectiveRatio);
      const logicalH = Math.round(targetH / effectiveRatio);

      // Вычисление exportZoom из топомасштаба
      const selectedScale = this.exportScale();
      let exportZoom: number;

      if (selectedScale > 0) {
        // Метры на 1 мм бумаги
        const metersPerMm = selectedScale / 1000;
        // Пикселей на 1 мм при целевом DPI
        const pxPerMm = dpiVal / 25.4;
        // Метров на 1 пиксель в экспорте
        const metersPerPx = metersPerMm / pxPerMm;

        const latRad = (exportCenter[1] * Math.PI) / 180;
        const cosLat = Math.cos(latRad);

        exportZoom = Math.log2((156543.03392 * cosLat) / (metersPerPx * effectiveRatio));

        // ВАЖНО: Если safeScale < 1.0 (изображение сжато по лимитам GPU),
        // корректируем зум, чтобы сохранить исходный географический охват рамки
        if (safeScale < 1.0) {
          exportZoom += Math.log2(safeScale);
        }
      } else {
        // Авто: сохранить zoom основной карты, но скорректировать на разницу размеров
        const mainZoom = mainMap.getZoom();
        const scaleRatio = logicalW / (vfRect.width > 0 ? vfRect.width : container.clientWidth);
        // Коррекция зума на -0.1375 уровня (~10% отдаления) для компенсации среза краев
        exportZoom = mainZoom + Math.log2(scaleRatio) - 0.1375;
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

            const targetWidth = origW * sizeMultiplier;
            const targetHeight = origH * sizeMultiplier;

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
                    pixelRatio: effectiveRatio,
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
            const atlasImage = img.data;
            if (atlasImage && atlasImage.width && atlasImage.height) {
              const canvas = document.createElement('canvas');
              canvas.width = atlasImage.width;
              canvas.height = atlasImage.height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                const imgData = ctx.createImageData(atlasImage.width, atlasImage.height);
                imgData.data.set(atlasImage.data);
                ctx.putImageData(imgData, 0, 0);

                const origW = atlasImage.width;
                const origH = atlasImage.height;

                const sizeMultiplier = effectiveRatio;
                const targetWidth = origW * sizeMultiplier;
                const targetHeight = origH * sizeMultiplier;

                const resCanvas = document.createElement('canvas');
                resCanvas.width = targetWidth;
                resCanvas.height = targetHeight;
                const resCtx = resCanvas.getContext('2d');

                if (resCtx) {
                  resCtx.imageSmoothingEnabled = true;
                  resCtx.imageSmoothingQuality = 'high';
                  resCtx.drawImage(canvas, 0, 0, origW, origH, 0, 0, targetWidth, targetHeight);
                  try {
                    const base64Data = resCanvas.toDataURL('image/png');
                    exportImages[key] = {
                      url: base64Data,
                      pixelRatio: effectiveRatio,
                      sdf: isSdf
                    };
                  } catch {}
                }
              }
              res();
            } else {
              res();
            }
          }
        });

        addPromises.push(promise);
      }

      await Promise.all(addPromises);

      this.generationProgress.set('Выполнение рендеринга на бэкенде...');

      const styleObj = mainMap.getStyle();
      const styleJson = JSON.stringify(styleObj);

      const tacticalSource = mainMap.getSource('tactical-symbols') as any;
      const geojsonData = tacticalSource && tacticalSource._data 
        ? JSON.stringify(tacticalSource._data) 
        : '{}';

      const scaleTag = selectedScale > 0 ? `1-${selectedScale}` : 'auto';
      const filename = `map_export_${printMm.width}x${printMm.height}mm_${scaleTag}_${dpiVal}dpi_${new Date().toISOString().slice(0, 10)}.png`;

      const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;

      if (isTauri) {
        // Tauri: вызываем нативный рендерер через Tauri IPC
        const savedPath = await this.nativeExport.exportMapNative({
          center: [exportCenter[0], exportCenter[1]],
          zoom: exportZoom,
          bearing: mainMap.getBearing(),
          pitch: mainMap.getPitch(),
          width_mm: printMm.width,
          height_mm: printMm.height,
          dpi: dpiVal,
          scale: selectedScale,
          logical_width: logicalW,
          logical_height: logicalH,
          ratio: effectiveRatio,
          filename: filename
        }, styleJson, geojsonData, JSON.stringify(exportImages));

        alert(`ГИС-карта высокого разрешения успешно сохранена на бэкенде в папку загрузок:\n${savedPath}`);
      } else {
        // Браузер: fallback на скачивание (не должно вызываться в Tauri, но полезно для веб-версии)
        alert('Нативный экспорт поддерживается только в оффлайн-приложении Tauri.');
      }

      this.close();
    } catch (err: any) {
      console.error('Ошибка экспорта:', err);
      alert(`Не удалось выполнить экспорт: ${err.message || err}`);
    } finally {
      this.isGenerating.set(false);
    }
  }
}
