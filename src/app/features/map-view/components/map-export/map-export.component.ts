import { Component, inject, signal, computed, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapViewModel } from '../../viewmodels/map.viewmodel';
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

  // Физический размер экспортируемой области на бумаге в мм
  readonly widthMm = signal<number>(200);
  readonly heightMm = signal<number>(150);
  
  // Качество DPI (96, 300, 600)
  readonly dpi = signal<number>(600);

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

  @HostListener('window:resize')
  onResize() {
    this.windowWidth.set(window.innerWidth);
    this.windowHeight.set(window.innerHeight);
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

  // Расчет результирующего размера изображения в пикселях
  readonly resultPixels = computed(() => {
    const wMm = this.widthMm();
    const hMm = this.heightMm();
    const dpiVal = this.dpi();

    const wPx = Math.round((wMm / 25.4) * dpiVal);
    const hPx = Math.round((hMm / 25.4) * dpiVal);

    return { width: wPx, height: hPx };
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

  // Рендеринг и экспорт на скрытой карте высокого разрешения
  async generateExport() {
    if (this.isGenerating()) return;

    this.isGenerating.set(true);
    this.generationProgress.set('Инициализация фонового рендерера...');

    try {
      const mainMap = this.vm.getMapInstance();
      if (!mainMap) throw new Error('Карта не проинициализирована');

      const wMm = this.widthMm();
      const hMm = this.heightMm();
      const dpiVal = this.dpi();

      const px = this.resultPixels();
      const vf = this.viewfinderSize();

      // Вычисляем экранный центр карты на холсте
      const container = mainMap.getContainer();
      const contW = container.clientWidth;
      const contH = container.clientHeight;

      const centerX = contW / 2;
      const centerY = contH / 2;

      // Экранные координаты углов видоискателя
      const x1 = centerX - vf.width / 2;
      const y1 = centerY - vf.height / 2;
      const x2 = centerX + vf.width / 2;
      const y2 = centerY + vf.height / 2;

      // Преобразуем экранные координаты в географические WGS-84
      const sw = mainMap.unproject([x1, y2]);
      const ne = mainMap.unproject([x2, y1]);
      const bounds: [[number, number], [number, number]] = [
        [sw.lng, sw.lat],
        [ne.lng, ne.lat]
      ];

      this.generationProgress.set(`Рендеринг векторного рельефа и тактических слоев (${px.width}x${px.height}px)...`);

      // Создаем скрытый DOM-контейнер для фонового рендеринга
      const hiddenDiv = document.createElement('div');
      hiddenDiv.style.width = `${px.width}px`;
      hiddenDiv.style.height = `${px.height}px`;
      hiddenDiv.style.position = 'absolute';
      hiddenDiv.style.left = '-99999px';
      hiddenDiv.style.top = '-99999px';
      document.body.appendChild(hiddenDiv);

      // Инициализируем фоновую карту MapLibre с аналогичными параметрами и стилем
      const hiddenMap = new maplibregl.Map({
        container: hiddenDiv,
        style: mainMap.getStyle(),
        center: mainMap.getCenter(),
        zoom: mainMap.getZoom(),
        bearing: mainMap.getBearing(),
        pitch: mainMap.getPitch(),
        interactive: false,
        preserveDrawingBuffer: true,
        fadeDuration: 0,
        devicePixelRatio: 1 // Фиксируем 1:1 пиксели, чтобы DPI задавался размером холста
      } as any);

      // Функция перегрузки всех тактических SVG-икон со старой карты
      const copyAllImages = () => {
        try {
          const images = mainMap.listImages();
          images.forEach((imgId) => {
            if (hiddenMap.hasImage(imgId)) return;
            const imgData = mainMap.getImage(imgId) as any;
            if (imgData) {
              // imgData is StyleImage: { data: RGBAImage | HTMLImageElement, pixelRatio: number, sdf: boolean }
              // RGBAImage is { width: number, height: number, data: Uint8Array }
              const rawImg = imgData.data || imgData;
              hiddenMap.addImage(imgId, rawImg, {
                pixelRatio: imgData.pixelRatio || 1,
                sdf: !!imgData.sdf
              });
            }
          });
        } catch (e) {
          console.warn('Ошибка копирования иконки:', e);
        }
      };

      // Переносим иконки на всех этапах инициализации стиля
      copyAllImages();
      hiddenMap.on('style.load', () => copyAllImages());
      hiddenMap.on('load', () => copyAllImages());

      // Фокусируем фоновую карту строго на выделенные географические границы (padding: 0)
      copyAllImages();
      hiddenMap.fitBounds(bounds, { animate: false, padding: 0 });

      // Ожидаем завершения рендеринга (событие idle) с тайм-аутом защиты в 20 секунд
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Превышено время ожидания рендеринга карты (тайм-аут WebGL)'));
        }, 20000);

        hiddenMap.once('idle', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      this.generationProgress.set('Сохранение фрагмента в файл...');

      // Получаем кадр WebGL
      const url = hiddenMap.getCanvas().toDataURL('image/png');
      const filename = `map_export_${wMm}x${hMm}mm_${dpiVal}dpi_${new Date().toISOString().slice(0, 10)}.png`;

      // Проверяем среду Tauri для нативного экспорта
      const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;
      if (isTauri) {
        const { invoke } = await import('@tauri-apps/api/core');
        const base64Data = url.split(',')[1];
        const binaryString = atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const savedPath = await invoke<string>('save_scenario_file', { filename, content: Array.from(bytes) });
        alert(`Фрагмент карты успешно сохранен в папку загрузок:\n${savedPath}`);
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      // Удаляем фоновую карту и очищаем DOM
      hiddenMap.remove();
      document.body.removeChild(hiddenDiv);
      this.close();
    } catch (err: any) {
      console.error('Ошибка экспорта:', err);
      alert(`Не удалось выполнить экспорт: ${err.message || err}`);
    } finally {
      this.isGenerating.set(false);
    }
  }
}
