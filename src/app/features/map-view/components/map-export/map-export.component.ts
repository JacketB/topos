import { Component, inject, signal, computed, HostListener } from '@angular/core';
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
export class MapExportComponent {
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

  @HostListener('window:resize')
  onResize() {
    this.windowWidth.set(window.innerWidth);
    this.windowHeight.set(window.innerHeight);
  }

  // Расчет пропорций
  readonly aspectRatio = computed(() => this.widthMm() / this.heightMm());

  // Вычисление экранных размеров рамки видоискателя
  readonly viewfinderSize = computed(() => {
    // Резервируем место под сайдбар (340px) и статус-панели
    const wWidth = Math.max(300, this.windowWidth() - 340);
    const wHeight = Math.max(300, this.windowHeight() - 80);

    const maxW = wWidth * 0.65;
    const maxH = wHeight * 0.65;
    const ratio = this.aspectRatio();

    let width = 0;
    let height = 0;

    if (maxW / maxH > ratio) {
      height = maxH;
      width = maxH * ratio;
    } else {
      width = maxW;
      height = maxW / ratio;
    }

    return {
      width: Math.round(width),
      height: Math.round(height)
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
        devicePixelRatio: 1 // Важно! Фиксируем 1:1 пиксели, чтобы DPI задавался размером холста
      } as any);

      // На этапе загрузки стиля переносим все перекрашенные тактические SVG-иконки со старой карты
      hiddenMap.on('style.load', () => {
        const images = mainMap.listImages();
        images.forEach((imgId) => {
          const imgData = mainMap.getImage(imgId) as any;
          if (imgData) {
            hiddenMap.addImage(imgId, {
              width: imgData.width,
              height: imgData.height,
              data: imgData.data
            } as any, {
              pixelRatio: imgData.pixelRatio || 1,
              sdf: imgData.sdf || false
            } as any);
          }
        });
      });

      // Фокусируем фоновую карту строго на выделенные географические границы
      // Задаем padding: 0 для идеального попадания в границы кадра
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
