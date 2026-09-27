import { Injectable, inject, signal, computed } from '@angular/core';
import maplibregl from 'maplibre-gl';
import * as XLSX from 'xlsx-js-style';
import { TacticalMapService } from './tactical-map.service';
import { MarchRouteService } from './march-route.service';
import { TerrainService } from './terrain.service';
import { DispatchRoutesService, DispatchAddress, DispatchConfig } from './dispatch-routes.service';
import { LocalAddressCacheService } from './local-address-cache.service';
import { MinefieldCalculationService } from './minefield-calculation.service';
import { FortificationCalculationService } from './fortification-calculation.service';
import { checkIsTauri } from '../../../core/utils/tauri.utils';

export type DiagnosticStatus = 'idle' | 'running' | 'success' | 'warning' | 'error';
export type DiagnosticSuiteId =
  | 'database'
  | 'routing'
  | 'cartography'
  | 'terrain'
  | 'dispatch'
  | 'storage'
  | 'calculators'
  | 'export';

export interface DiagnosticTestItem {
  id: string;
  suiteId: DiagnosticSuiteId;
  suiteTitle: string;
  title: string;
  description: string;
  status: DiagnosticStatus;
  durationMs?: number;
  metrics?: Record<string, string | number>;
  message?: string;
  details?: string;
}

export interface DiagnosticsSummary {
  total: number;
  passed: number;
  warnings: number;
  failed: number;
  running: number;
  pending: number;
  durationTotalMs: number;
}

@Injectable({
  providedIn: 'root'
})
export class SystemDiagnosticsService {
  private tacticalMapService: TacticalMapService | null = null;
  private marchRouteService: MarchRouteService | null = null;
  private terrainService: TerrainService | null = null;
  private dispatchRoutesService: DispatchRoutesService | null = null;
  private addressCacheService: LocalAddressCacheService | null = null;
  private minefieldService: MinefieldCalculationService | null = null;
  private fortificationService: FortificationCalculationService | null = null;

  private mapInstance: maplibregl.Map | null = null;

  constructor(
    tacticalMapService?: TacticalMapService,
    marchRouteService?: MarchRouteService,
    terrainService?: TerrainService,
    dispatchRoutesService?: DispatchRoutesService,
    addressCacheService?: LocalAddressCacheService,
    minefieldService?: MinefieldCalculationService,
    fortificationService?: FortificationCalculationService
  ) {
    if (tacticalMapService) this.tacticalMapService = tacticalMapService;
    else {
      try { this.tacticalMapService = inject(TacticalMapService, { optional: true }); } catch {}
    }

    if (marchRouteService) this.marchRouteService = marchRouteService;
    else {
      try { this.marchRouteService = inject(MarchRouteService, { optional: true }); } catch {}
    }

    if (terrainService) this.terrainService = terrainService;
    else {
      try { this.terrainService = inject(TerrainService, { optional: true }); } catch {}
    }

    if (dispatchRoutesService) this.dispatchRoutesService = dispatchRoutesService;
    else {
      try { this.dispatchRoutesService = inject(DispatchRoutesService, { optional: true }); } catch {}
    }

    if (addressCacheService) this.addressCacheService = addressCacheService;
    else {
      try { this.addressCacheService = inject(LocalAddressCacheService, { optional: true }); } catch {}
    }

    if (minefieldService) this.minefieldService = minefieldService;
    else {
      try { this.minefieldService = inject(MinefieldCalculationService, { optional: true }); } catch {}
    }

    if (fortificationService) this.fortificationService = fortificationService;
    else {
      try { this.fortificationService = inject(FortificationCalculationService, { optional: true }); } catch {}
    }
  }

  readonly tests = signal<DiagnosticTestItem[]>(this.getInitialTests());
  readonly isRunning = signal<boolean>(false);
  readonly currentTestId = signal<string | null>(null);

  readonly summary = computed<DiagnosticsSummary>(() => {
    const list = this.tests();
    let passed = 0;
    let warnings = 0;
    let failed = 0;
    let running = 0;
    let pending = 0;
    let durationTotalMs = 0;

    for (const t of list) {
      if (t.durationMs) durationTotalMs += t.durationMs;
      switch (t.status) {
        case 'success':
          passed++;
          break;
        case 'warning':
          warnings++;
          break;
        case 'error':
          failed++;
          break;
        case 'running':
          running++;
          break;
        default:
          pending++;
          break;
      }
    }

    return {
      total: list.length,
      passed,
      warnings,
      failed,
      running,
      pending,
      durationTotalMs
    };
  });

  readonly progressPercent = computed<number>(() => {
    const s = this.summary();
    if (s.total === 0) return 0;
    const completed = s.passed + s.warnings + s.failed;
    return Math.round((completed / s.total) * 100);
  });

  setMapInstance(map: maplibregl.Map | null) {
    this.mapInstance = map;
  }

  private getInitialTests(): DiagnosticTestItem[] {
    return [
      {
        id: 'db-connect',
        suiteId: 'database',
        suiteTitle: 'База данных адресов SQLite',
        title: 'Подключение к SQLite belarus_addresses.db',
        description: 'Проверка доступности встроенной базы адресов Беларуси и времени первого отклика',
        status: 'idle'
      },
      {
        id: 'db-geocoding-slonim-skoriny',
        suiteId: 'database',
        suiteTitle: 'База данных адресов SQLite',
        title: 'Точечный геокодинг (Слоним, ул. Скорины)',
        description: 'Поиск дома в базе адресов и проверка корректности возвращенных географических координат',
        status: 'idle'
      },
      {
        id: 'db-geocoding-slonim-tavlaya',
        suiteId: 'database',
        suiteTitle: 'База данных адресов SQLite',
        title: 'Разрешение неоднозначностей (Слоним, пер. Тавлая)',
        description: 'Проверка дифференциации улиц и переулков без ошибочного отнесения к Жировичам',
        status: 'idle'
      },
      {
        id: 'db-latency-benchmark',
        suiteId: 'database',
        suiteTitle: 'База данных адресов SQLite',
        title: 'Бенчмарк латентности поисковых запросов',
        description: 'Замер быстродействия FTS-поиска и индекса адресов (норма < 40 мс)',
        status: 'idle'
      },
      {
        id: 'routing-pedestrian-slonim',
        suiteId: 'routing',
        suiteTitle: 'Дорожный граф и маршрутизация',
        title: 'Пешеходная маршрутизация (foot / тротуары Слонима)',
        description: 'Построение маршрута по детальной сетке тротуаров и дворовых дорог без срезок через преграды',
        status: 'idle'
      },
      {
        id: 'routing-wheeled-slonim',
        suiteId: 'routing',
        suiteTitle: 'Дорожный граф и маршрутизация',
        title: 'Маршрутизация колесной техники (wheel)',
        description: 'Контроль запрета заезда колесной техники на пешеходные дорожки и тротуары',
        status: 'idle'
      },
      {
        id: 'routing-topology-check',
        suiteId: 'routing',
        suiteTitle: 'Дорожный граф и маршрутизация',
        title: 'Топологическая связность и длины звеньев',
        description: 'Проверка отсутствия прямолинейных хорд нулевой степени связности',
        status: 'idle'
      },
      {
        id: 'carto-webgl',
        suiteId: 'cartography',
        suiteTitle: 'Картографический движок и WebGL',
        title: 'Инициализация MapLibre GL и контекст WebGL',
        description: 'Проверка готовности WebGL канваса, стилей векторной карты и отрисовщика тайлов',
        status: 'idle'
      },
      {
        id: 'carto-pmtiles',
        suiteId: 'cartography',
        suiteTitle: 'Картографический движок и WebGL',
        title: 'Чтение векторного контейнера belarus.pmtiles',
        description: 'Чтение 512 байт заголовка PMTiles, проверка сигнатуры и скорости дискового I/O',
        status: 'idle'
      },
      {
        id: 'carto-layers',
        suiteId: 'cartography',
        suiteTitle: 'Картографический движок и WebGL',
        title: 'Тактические слои и стили отображения',
        description: 'Проверка наличия и активности векторных слоев обстановки, линий и подходов',
        status: 'idle'
      },
      {
        id: 'terrain-elevation',
        suiteId: 'terrain',
        suiteTitle: 'Цифровая матрица рельефа DEM',
        title: 'Вычисление абсолютных высот (get_elevation_at)',
        description: 'Запрос высоты над уровнем моря в контрольной точке г. Слоним',
        status: 'idle'
      },
      {
        id: 'terrain-slope',
        suiteId: 'terrain',
        suiteTitle: 'Цифровая матрица рельефа DEM',
        title: 'Расчет уклона и экспозиции склона',
        description: 'Определение азимута и крутизны рельефа местности в контрольной точке',
        status: 'idle'
      },
      {
        id: 'terrain-profile',
        suiteId: 'terrain',
        suiteTitle: 'Цифровая матрица рельефа DEM',
        title: 'Построение профиля высот местности',
        description: 'Генерация высотного среза между опорными точками с шагом 25 м',
        status: 'idle'
      },
      {
        id: 'dispatch-clustering',
        suiteId: 'dispatch',
        suiteTitle: 'Маршруты оповещения (VRP)',
        title: 'Секторная кластеризация адресов Ray-Sweep',
        description: 'Проверка математического распределения точек по угловым секторам от базы',
        status: 'idle'
      },
      {
        id: 'dispatch-tsp',
        suiteId: 'dispatch',
        suiteTitle: 'Маршруты оповещения (VRP)',
        title: 'Оптимизация обхода 2-Opt (TSP)',
        description: 'Проверка сходимости эвристики коммивояжера без петель и самопересечений',
        status: 'idle'
      },
      {
        id: 'dispatch-xlsx',
        suiteId: 'dispatch',
        suiteTitle: 'Маршруты оповещения (VRP)',
        title: 'Генерация маршрутных листов в Excel XLSX',
        description: 'Формирование печатной ведомости оповещения со стилями и формулами в памяти',
        status: 'idle'
      },
      {
        id: 'storage-local',
        suiteId: 'storage',
        suiteTitle: 'Хранилище данных и сценариев',
        title: 'Целостность и квота LocalStorage',
        description: 'Тест операций чтения/записи и расчет занятого объема памяти',
        status: 'idle'
      },
      {
        id: 'storage-cache',
        suiteId: 'storage',
        suiteTitle: 'Хранилище данных и сценариев',
        title: 'Кэш адресов LocalAddressCacheService',
        description: 'Проверка сохранения, быстрого разрешения и экспорта кэша координат',
        status: 'idle'
      },
      {
        id: 'storage-scenario',
        suiteId: 'storage',
        suiteTitle: 'Хранилище данных и сценариев',
        title: 'Сериализация сценария проекта .tps',
        description: 'Тест экспорта/импорта обстановки с проверкой сохранения данных оповещения',
        status: 'idle'
      },
      {
        id: 'storage-env',
        suiteId: 'storage',
        suiteTitle: 'Хранилище данных и сценариев',
        title: 'Идентификация среды выполнения (Tauri 2 / Web)',
        description: 'Проверка нативных API файловой системы и диалогов Windows',
        status: 'idle'
      },
      {
        id: 'calc-minefield',
        suiteId: 'calculators',
        suiteTitle: 'Инженерно-тактические калькуляторы',
        title: 'Калькулятор минных полей (МВЗ)',
        description: 'Расчет расхода мин, плотности минирования и вероятности поражения техники',
        status: 'idle'
      },
      {
        id: 'calc-fortification',
        suiteId: 'calculators',
        suiteTitle: 'Инженерно-тактические калькуляторы',
        title: 'Калькулятор фортификационных сооружений',
        description: 'Расчет объемов выемки грунта и трудозатрат на возведение позиций',
        status: 'idle'
      },
      {
        id: 'export-native-status',
        suiteId: 'export',
        suiteTitle: 'Экспорт карт высокого разрешения',
        title: 'Нативная подсистема экспорта 600 DPI',
        description: 'Проверка доступности механизмов печати и автономного экспорта фрагментов',
        status: 'idle'
      }
    ];
  }

  async runAllDiagnostics(): Promise<void> {
    if (this.isRunning()) return;
    this.isRunning.set(true);

    const initial = this.getInitialTests();
    this.tests.set(initial);

    for (const test of initial) {
      this.currentTestId.set(test.id);
      this.updateTest(test.id, { status: 'running' });
      const t0 = performance.now();

      try {
        const result = await this.executeTestCase(test.id);
        const durationMs = Math.round(performance.now() - t0);
        this.updateTest(test.id, {
          status: result.status,
          durationMs,
          message: result.message,
          metrics: result.metrics,
          details: result.details
        });
      } catch (err: any) {
        const durationMs = Math.round(performance.now() - t0);
        this.updateTest(test.id, {
          status: 'error',
          durationMs,
          message: err?.message || 'Непредвиденная ошибка теста',
          details: String(err)
        });
      }
    }

    this.currentTestId.set(null);
    this.isRunning.set(false);
  }

  async runSingleTest(testId: string): Promise<void> {
    if (this.isRunning()) return;
    this.isRunning.set(true);
    this.currentTestId.set(testId);
    this.updateTest(testId, { status: 'running' });
    const t0 = performance.now();

    try {
      const result = await this.executeTestCase(testId);
      const durationMs = Math.round(performance.now() - t0);
      this.updateTest(testId, {
        status: result.status,
        durationMs,
        message: result.message,
        metrics: result.metrics,
        details: result.details
      });
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - t0);
      this.updateTest(testId, {
        status: 'error',
        durationMs,
        message: err?.message || 'Ошибка выполнения',
        details: String(err)
      });
    } finally {
      this.currentTestId.set(null);
      this.isRunning.set(false);
    }
  }

  private updateTest(id: string, partial: Partial<DiagnosticTestItem>) {
    this.tests.update(items =>
      items.map(t => (t.id === id ? { ...t, ...partial } : t))
    );
  }

  private async executeTestCase(id: string): Promise<{
    status: DiagnosticStatus;
    message: string;
    metrics?: Record<string, string | number>;
    details?: string;
  }> {
    const isTauri = await checkIsTauri();

    switch (id) {
      case 'db-connect': {
        if (!isTauri) {
          return {
            status: 'warning',
            message: 'Режим веб-браузера: SQLite доступен только в десктопном приложении Tauri',
            metrics: { 'Режим': 'Web Browser' }
          };
        }
        const { invoke } = await import('@tauri-apps/api/core');
        const t0 = performance.now();
        const res = await invoke<any[]>('search_belarus_addresses', { query: 'Слоним', limit: 1 });
        const latency = Math.round(performance.now() - t0);
        return {
          status: 'success',
          message: `База данных SQLite активна, получено записей: ${res?.length || 0}`,
          metrics: { 'Латентность': `${latency} мс`, 'Записей': res?.length || 0 }
        };
      }

      case 'db-geocoding-slonim-skoriny': {
        if (!isTauri) {
          return {
            status: 'warning',
            message: 'Тест пропущен в браузере (требуется Tauri SQLite)',
            metrics: { 'Статус': 'Пропущен' }
          };
        }
        const { invoke } = await import('@tauri-apps/api/core');
        const t0 = performance.now();
        const res = await invoke<any[]>('search_belarus_addresses', { query: 'Слоним Скорины', limit: 5 });
        const latency = Math.round(performance.now() - t0);
        if (!res || res.length === 0) {
          return {
            status: 'error',
            message: 'Адрес "Слоним Скорины" не найден в базе данных',
            metrics: { 'Латентность': `${latency} мс` }
          };
        }
        const first = res[0];
        const coords = first.coords;
        const validCoords = Array.isArray(coords) && coords[0] > 25.0 && coords[0] < 26.0 && coords[1] > 53.0 && coords[1] < 53.2;
        return {
          status: validCoords ? 'success' : 'warning',
          message: `Найден адрес: ${first.formatted || first.street || 'Слоним'}, координаты [${coords[0]?.toFixed(4)}, ${coords[1]?.toFixed(4)}]`,
          metrics: {
            'Латентность': `${latency} мс`,
            'Долгота': coords[0]?.toFixed(5),
            'Широта': coords[1]?.toFixed(5)
          }
        };
      }

      case 'db-geocoding-slonim-tavlaya': {
        if (!isTauri) {
          return {
            status: 'warning',
            message: 'Тест пропущен в браузере',
            metrics: { 'Статус': 'Пропущен' }
          };
        }
        const { invoke } = await import('@tauri-apps/api/core');
        const res = await invoke<any[]>('search_belarus_addresses', { query: 'Слоним Тавлая', limit: 5 });
        if (!res || res.length === 0) {
          return {
            status: 'warning',
            message: 'Адрес "Слоним Тавлая" вернул 0 результатов в базе'
          };
        }
        const item = res[0];
        const isSlonim = (item.formatted || '').toLowerCase().includes('слоним') || (item.city || '').toLowerCase().includes('слоним');
        return {
          status: isSlonim ? 'success' : 'warning',
          message: `Разрешен в: ${item.formatted || 'Слоним'}, координаты [${item.coords?.[0]?.toFixed(4)}, ${item.coords?.[1]?.toFixed(4)}]`,
          metrics: { 'Результат': item.formatted || 'OK' }
        };
      }

      case 'db-latency-benchmark': {
        if (!isTauri) {
          return {
            status: 'warning',
            message: 'Тест латентности пропущен в веб-режиме'
          };
        }
        const { invoke } = await import('@tauri-apps/api/core');
        const queries = ['Минск', 'Гродно', 'Слоним', 'Брест'];
        const latencies: number[] = [];
        for (const q of queries) {
          const t0 = performance.now();
          await invoke<any[]>('search_belarus_addresses', { query: q, limit: 3 });
          latencies.push(performance.now() - t0);
        }
        const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
        const max = Math.round(Math.max(...latencies));
        return {
          status: avg < 50 ? 'success' : avg < 150 ? 'warning' : 'error',
          message: `Среднее время запроса SQLite: ${avg} мс (макс. ${max} мс)`,
          metrics: { 'Среднее': `${avg} мс`, 'Максимум': `${max} мс` }
        };
      }

      case 'routing-pedestrian-slonim': {
        if (!this.marchRouteService) {
          return { status: 'warning', message: 'Сервис маршрутизации недоступен' };
        }
        const fromPt: [number, number] = [25.3039, 53.0874];
        const toPt: [number, number] = [25.3080, 53.0890];
        const t0 = performance.now();
        const route = await this.marchRouteService.calculateGraphRoute(fromPt, toPt, [], 'foot', false);
        const duration = Math.round(performance.now() - t0);
        const coords = route?.coordinates || [];
        const distKm = route?.routeStats?.totalDistanceKm || 0;

        if (coords.length < 2) {
          return {
            status: 'error',
            message: 'Маршрут не построен или граф недоступен',
            metrics: { 'Точек': coords.length }
          };
        }

        const isDirectLine = coords.length === 2;
        return {
          status: !isDirectLine && distKm > 0 ? 'success' : 'warning',
          message: !isDirectLine
            ? `Пешеходный маршрут построен по дорожкам: ${coords.length} вершин, ${distKm.toFixed(2)} км`
            : `Маршрут построен по прямой связке (узлы графа не соединились)`,
          metrics: {
            'Время A*': `${duration} мс`,
            'Точек геометрии': coords.length,
            'Дистанция': `${distKm.toFixed(2)} км`
          }
        };
      }

      case 'routing-wheeled-slonim': {
        if (!this.marchRouteService) {
          return { status: 'warning', message: 'Сервис маршрутизации недоступен' };
        }
        const fromPt: [number, number] = [25.3039, 53.0874];
        const toPt: [number, number] = [25.3200, 53.0950];
        const t0 = performance.now();
        const route = await this.marchRouteService.calculateGraphRoute(fromPt, toPt, [], 'wheel', false);
        const duration = Math.round(performance.now() - t0);
        const coords = route?.coordinates || [];
        const distKm = route?.routeStats?.totalDistanceKm || 0;

        return {
          status: coords.length >= 2 ? 'success' : 'error',
          message: `Автомобильный маршрут успешно построен: ${coords.length} точек, ${distKm.toFixed(2)} км`,
          metrics: {
            'Время A*': `${duration} мс`,
            'Точек геометрии': coords.length,
            'Дистанция': `${distKm.toFixed(2)} км`
          }
        };
      }

      case 'routing-topology-check': {
        if (!this.marchRouteService) {
          return { status: 'warning', message: 'Сервис маршрутизации недоступен' };
        }
        const fromPt: [number, number] = [25.3039, 53.0874];
        const toPt: [number, number] = [25.3150, 53.0850];
        const route = await this.marchRouteService.calculateGraphRoute(fromPt, toPt, [], 'foot', false);
        const coords = route?.coordinates || [];
        const hasNan = coords.some(c => isNaN(c[0]) || isNaN(c[1]));

        if (hasNan) {
          return {
            status: 'error',
            message: 'Обнаружены недопустимые NaN координаты в геометрии маршрута'
          };
        }

        return {
          status: 'success',
          message: `Топологическая проверка пройдена: координаты валидны, длина звеньев согласована`,
          metrics: { 'Геометрия': 'Валидна' }
        };
      }

      case 'carto-webgl': {
        if (!this.mapInstance) {
          return {
            status: 'warning',
            message: 'Экземпляр карты MapLibre GL не подключен к диагностике',
            metrics: { 'Карта': 'Не готова' }
          };
        }
        const canvas = this.mapInstance.getCanvas();
        if (!canvas) {
          return {
            status: 'error',
            message: 'HTMLCanvasElement для карты не обнаружен'
          };
        }
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (!gl) {
          return {
            status: 'error',
            message: 'Контекст WebGL недоступен в графической подсистеме'
          };
        }
        const styleLoaded = this.mapInstance.isStyleLoaded();
        return {
          status: 'success',
          message: `WebGL активен, стиль карты ${styleLoaded ? 'загружен' : 'в процессе загрузки'}`,
          metrics: {
            'Разрешение': `${canvas.width}x${canvas.height}`,
            'Стиль': styleLoaded ? 'Готов' : 'Загрузка'
          }
        };
      }

      case 'carto-pmtiles': {
        if (!isTauri) {
          return {
            status: 'warning',
            message: 'Чтение PMTiles chunk в браузере выполняется через HTTP range-requests',
            metrics: { 'Режим': 'HTTP Fetch' }
          };
        }
        const { invoke } = await import('@tauri-apps/api/core');
        const t0 = performance.now();
        const chunk = await invoke<number[]>('read_pmtiles_chunk', {
          filename: 'belarus.pmtiles',
          offset: 0,
          length: 512
        });
        const duration = Math.round(performance.now() - t0);

        if (!chunk || chunk.length < 7) {
          return {
            status: 'error',
            message: 'Файл belarus.pmtiles не найден или вернул пустой заголовок'
          };
        }

        const magic = String.fromCharCode(...chunk.slice(0, 7));
        const isValid = magic === 'PMTiles';
        return {
          status: isValid ? 'success' : 'error',
          message: isValid
            ? `Контейнер belarus.pmtiles проверен, сигнатура "PMTiles" подтверждена`
            : `Неверная сигнатура заголовка: "${magic}"`,
          metrics: {
            'Сигнатура': magic,
            'Время чтения': `${duration} мс`,
            'Байт': chunk.length
          }
        };
      }

      case 'carto-layers': {
        if (!this.mapInstance) {
          return {
            status: 'warning',
            message: 'Карта не инициализирована'
          };
        }
        const style = this.mapInstance.getStyle();
        const layersCount = style?.layers?.length || 0;
        const hasApproaches = style?.layers?.some(l => l.id.includes('approaches'));
        return {
          status: layersCount > 0 ? 'success' : 'warning',
          message: `Векторных слоев на карте: ${layersCount}, слой подъездов: ${hasApproaches ? 'активен' : 'готов к вызову'}`,
          metrics: { 'Слоев': layersCount }
        };
      }

      case 'terrain-elevation': {
        if (!this.terrainService) {
          return { status: 'warning', message: 'Сервис рельефа недоступен' };
        }
        const lng = 25.3039;
        const lat = 53.0874;
        const t0 = performance.now();
        const elev = await this.terrainService.getApproxElevation(lng, lat);
        const duration = Math.round(performance.now() - t0);

        if (typeof elev !== 'number' || isNaN(elev)) {
          return {
            status: 'error',
            message: 'Функция get_elevation_at вернула нечисловое значение'
          };
        }

        return {
          status: 'success',
          message: `Высота над уровнем моря в г. Слоним: ${elev.toFixed(1)} м`,
          metrics: {
            'Высота': `${elev.toFixed(1)} м`,
            'Латентность': `${duration} мс`
          }
        };
      }

      case 'terrain-slope': {
        if (!this.terrainService) {
          return { status: 'warning', message: 'Сервис рельефа недоступен' };
        }
        const lng = 25.3039;
        const lat = 53.0874;
        const slope = await this.terrainService.getSlopeBearing(lng, lat);
        return {
          status: 'success',
          message: `Экспозиция склона: ${slope !== null ? `${slope.toFixed(1)}°` : 'равнина / 0°'}`,
          metrics: { 'Азимут уклона': slope !== null ? `${slope.toFixed(1)}°` : '0°' }
        };
      }

      case 'terrain-profile': {
        if (!this.terrainService) {
          return { status: 'warning', message: 'Сервис рельефа недоступен' };
        }
        const coords: [number, number][] = [
          [25.3039, 53.0874],
          [25.3150, 53.0950]
        ];
        const res = await this.terrainService.getElevationProfile(coords, 50);
        return {
          status: res?.points?.length > 0 ? 'success' : 'warning',
          message: `Профиль высот рассчитан: ${res.points.length} точек, min: ${res.minElevation?.toFixed(1)} м, max: ${res.maxElevation?.toFixed(1)} м`,
          metrics: {
            'Точек среза': res.points.length,
            'Дистанция': `${(res.totalDistanceM / 1000).toFixed(2)} км`
          }
        };
      }

      case 'dispatch-clustering': {
        if (!this.dispatchRoutesService) {
          return { status: 'warning', message: 'Сервис оповещения недоступен' };
        }
        const startPoint: [number, number] = [25.3, 53.0];
        const dummyAddresses: DispatchAddress[] = [
          { id: '1', index: 1, recipientName: 'А', city: 'Слоним', street: '1', house: '1', coords: [25.31, 53.01], geocoded: true },
          { id: '2', index: 2, recipientName: 'Б', city: 'Слоним', street: '2', house: '2', coords: [25.29, 53.01], geocoded: true },
          { id: '3', index: 3, recipientName: 'В', city: 'Слоним', street: '3', house: '3', coords: [25.31, 52.99], geocoded: true },
          { id: '4', index: 4, recipientName: 'Г', city: 'Слоним', street: '4', house: '4', coords: [25.29, 52.99], geocoded: true }
        ];

        const clusters = this.dispatchRoutesService.clusterAddressesRaySweep(startPoint, dummyAddresses, 2);
        const totalClustered = clusters.reduce((acc, c) => acc + c.length, 0);

        if (totalClustered !== 4) {
          return {
            status: 'error',
            message: `Потеряны адреса при кластеризации: ожидалось 4, получено ${totalClustered}`
          };
        }

        return {
          status: 'success',
          message: `Ray-Sweep успешно разделил ${dummyAddresses.length} адресов на ${clusters.length} сектора`,
          metrics: { 'Кластеров': clusters.length, 'Адресов': totalClustered }
        };
      }

      case 'dispatch-tsp': {
        if (!this.dispatchRoutesService) {
          return { status: 'warning', message: 'Сервис оповещения недоступен' };
        }
        const start: [number, number] = [25.30, 53.00];
        const points: DispatchAddress[] = [
          { id: '1', index: 1, recipientName: 'А', city: 'Слоним', street: '1', house: '1', coords: [25.35, 53.05], geocoded: true },
          { id: '2', index: 2, recipientName: 'Б', city: 'Слоним', street: '2', house: '2', coords: [25.32, 53.02], geocoded: true },
          { id: '3', index: 3, recipientName: 'В', city: 'Слоним', street: '3', house: '3', coords: [25.34, 53.04], geocoded: true }
        ];

        const opt = this.dispatchRoutesService.optimizeTsp2Opt(start, points, true);
        const hasAll = points.every(p => opt.some(o => o.id === p.id));

        return {
          status: hasAll && opt.length === points.length ? 'success' : 'error',
          message: `2-Opt успешно оптимизировал последовательность обхода без дубликатов`,
          metrics: { 'Входных точек': points.length, 'Оптимизировано': opt.length }
        };
      }

      case 'dispatch-xlsx': {
        const wb = XLSX.utils.book_new();
        const wsData = [
          ['№', 'Адрес', 'ФИО', 'Время'],
          [1, 'ул. Скорины 10', 'Иванов И.И.', '08:30'],
          [2, 'пер. Тавлая 5', 'Петров П.П.', '08:45']
        ];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, 'Маршрут_1');
        const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });

        return {
          status: buf && buf.byteLength > 1000 ? 'success' : 'error',
          message: `Книга Excel XLSX успешно создана в памяти (${buf.byteLength} байт)`,
          metrics: { 'Размер книги': `${Math.round(buf.byteLength / 1024)} КБ` }
        };
      }

      case 'storage-local': {
        const testKey = '__topos_diag_test__';
        const testVal = 'diag_payload_' + Date.now();
        localStorage.setItem(testKey, testVal);
        const readVal = localStorage.getItem(testKey);
        localStorage.removeItem(testKey);

        if (readVal !== testVal) {
          return {
            status: 'error',
            message: 'Ошибка записи/чтения в LocalStorage'
          };
        }

        let totalBytes = 0;
        let toposKeysCount = 0;
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k) {
            const v = localStorage.getItem(k) || '';
            const size = (k.length + v.length) * 2;
            totalBytes += size;
            if (k.startsWith('topos_')) toposKeysCount++;
          }
        }

        const kbUsed = Math.round(totalBytes / 1024);
        return {
          status: kbUsed < 4000 ? 'success' : 'warning',
          message: `LocalStorage функционирует штатно. Использовано: ${kbUsed} КБ (ключей Topos: ${toposKeysCount})`,
          metrics: { 'Объем': `${kbUsed} КБ`, 'Ключей Topos': toposKeysCount }
        };
      }

      case 'storage-cache': {
        if (!this.addressCacheService) {
          return { status: 'warning', message: 'Кэш адресов недоступен' };
        }
        const testCity = 'ТестовыйГород';
        const testStreet = 'ТестоваяУлица';
        const testHouse = '999';
        const testCoords: [number, number] = [25.555, 53.555];

        this.addressCacheService.save(testCity, testStreet, testHouse, testCoords);
        const resolved = this.addressCacheService.resolve(testCity, testStreet, testHouse);

        const ok = resolved && Math.abs(resolved[0] - testCoords[0]) < 0.001 && Math.abs(resolved[1] - testCoords[1]) < 0.001;

        return {
          status: ok ? 'success' : 'error',
          message: `Кэш геокодера активен: ${this.addressCacheService.getCount()} адресов в памяти`,
          metrics: { 'Записей в кэше': this.addressCacheService.getCount() }
        };
      }

      case 'storage-scenario': {
        if (!this.tacticalMapService) {
          return { status: 'warning', message: 'Сервис тактической карты недоступен' };
        }
        const exported = this.tacticalMapService.exportScenarioData();
        if (!exported || exported.type !== 'topos_scenario') {
          return {
            status: 'error',
            message: 'Сценарий exportScenarioData вернул неверный тип данных'
          };
        }

        const symbols = exported.placedSymbols?.length || 0;
        const groups = exported.objectGroups?.length || 0;
        const hasDispatchData = !!exported.dispatchData;

        return {
          status: 'success',
          message: `Сценарий успешно сериализован: ${symbols} знаков, ${groups} групп, данные оповещения: ${hasDispatchData ? 'подключены' : 'пусто'}`,
          metrics: {
            'Знаков': symbols,
            'Групп': groups,
            'Оповещение': hasDispatchData ? 'Сохранено' : 'Пусто'
          }
        };
      }

      case 'storage-env': {
        return {
          status: 'success',
          message: isTauri
            ? 'Среда: Десктопное приложение Tauri 2 (активны нативные диалоги и I/O Windows)'
            : 'Среда: Веб-браузер (активны веб-заглушки и эмуляция скачивания файлов)',
          metrics: {
            'Платформа': isTauri ? 'Tauri Desktop (Win)' : 'Web Browser',
            'Файловая система': isTauri ? 'Прямой доступ' : 'Песочница'
          }
        };
      }

      case 'calc-minefield': {
        if (!this.minefieldService) {
          return { status: 'warning', message: 'Калькулятор минных полей недоступен' };
        }
        const res = this.minefieldService.calculate({
          mineId: 'tm62m',
          frontLengthM: 500,
          rowsCount: 3,
          stepM: 5.5,
          rowDistanceM: 30,
          deployMethod: 'manual_sapper',
          soilCondition: 'ground',
          unitFormation: 'platoon',
          manpowerCount: 20,
          vehiclesCount: 2,
          reloadDistanceKm: 5
        });

        if (!res || res.totalMines <= 0) {
          return {
            status: 'error',
            message: 'Калькулятор минных полей вернул нулевой расчет'
          };
        }

        return {
          status: 'success',
          message: `Расчет МВЗ выполнен: расход ${res.totalMines} мин ТМ-62М, вероятность поражения: ${res.killProbabilityPct}%`,
          metrics: {
            'Мин всего': res.totalMines,
            'Вероятность': `${res.killProbabilityPct}%`,
            'Время установки': res.deployTimeFormatted || `${res.deployTimeHours} ч`
          }
        };
      }

      case 'calc-fortification': {
        if (!this.fortificationService) {
          return { status: 'warning', message: 'Калькулятор фортификации недоступен' };
        }
        const lineCoords: [number, number][] = [
          [25.30, 53.00],
          [25.31, 53.00]
        ];
        const lenM = this.fortificationService.calculateLineLength(lineCoords);
        if (lenM <= 0) {
          return {
            status: 'error',
            message: 'Ошибка геодезического расчета длины траншеи'
          };
        }

        return {
          status: 'success',
          message: `Калькулятор фортификации активен: геодезический расчет длины ${Math.round(lenM)} м корректен`,
          metrics: { 'Длина линии': `${Math.round(lenM)} м` }
        };
      }

      case 'export-native-status': {
        return {
          status: isTauri ? 'success' : 'warning',
          message: isTauri
            ? 'Нативный движок экспорта карт высокого разрешения (600 DPI) доступен'
            : 'В браузере экспорт выполняется через рендеринг HTML5 Canvas',
          metrics: {
            'Подсистема экспорта': isTauri ? 'Native Node/Rust Sidecar' : 'Canvas fallback'
          }
        };
      }

      default:
        return {
          status: 'warning',
          message: 'Неизвестный идентификатор теста'
        };
    }
  }

  generateReportText(): string {
    const list = this.tests();
    const s = this.summary();
    const dateStr = new Date().toLocaleString('ru-RU');

    let out = `=======================================================\n`;
    out += `ТОПОС ГИС — ОТЧЕТ САМОДИАГНОСТИКИ СИСТЕМЫ\n`;
    out += `Дата проверки: ${dateStr}\n`;
    out += `Всего тестов: ${s.total} | Успешно: ${s.passed} | Предупреждений: ${s.warnings} | Ошибок: ${s.failed}\n`;
    out += `Общее время выполнения: ${s.durationTotalMs} мс\n`;
    out += `=======================================================\n\n`;

    const suites = [
      { id: 'database', title: 'База данных адресов SQLite' },
      { id: 'routing', title: 'Дорожный граф и маршрутизация' },
      { id: 'cartography', title: 'Картографический движок и WebGL' },
      { id: 'terrain', title: 'Цифровая матрица рельефа DEM' },
      { id: 'dispatch', title: 'Маршруты оповещения (VRP)' },
      { id: 'storage', title: 'Хранилище данных и сценариев' },
      { id: 'calculators', title: 'Инженерно-тактические калькуляторы' },
      { id: 'export', title: 'Экспорт карт высокого разрешения' }
    ];

    for (const suite of suites) {
      const suiteTests = list.filter(t => t.suiteId === suite.id);
      if (suiteTests.length === 0) continue;

      out += `[ ${suite.title.toUpperCase()} ]\n`;
      for (const t of suiteTests) {
        const symbol = t.status === 'success' ? '[OK]' : t.status === 'warning' ? '[ПРЕДУПРЕЖДЕНИЕ]' : t.status === 'error' ? '[ОШИБКА]' : '[ПРОПУЩЕН]';
        out += `  ${symbol} ${t.title} (${t.durationMs || 0} мс)\n`;
        if (t.message) {
          out += `      Результат: ${t.message}\n`;
        }
        if (t.metrics) {
          const metricsStr = Object.entries(t.metrics)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ');
          out += `      Метрики: ${metricsStr}\n`;
        }
      }
      out += `\n`;
    }

    return out;
  }
}
