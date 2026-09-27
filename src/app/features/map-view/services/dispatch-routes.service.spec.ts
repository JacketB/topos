import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DispatchRoutesService, DispatchAddress, DispatchConfig } from './dispatch-routes.service';
import { MarchRouteService } from './march-route.service';

describe('DispatchRoutesService', () => {
  let service: DispatchRoutesService;
  let mockMarchRouteService: any;

  beforeEach(() => {
    mockMarchRouteService = {
      getAllPlaces: vi.fn().mockResolvedValue([
        { name: 'Борисов', nameBe: 'Барысаў', coords: [28.5119, 54.2276] }
      ]),
      calculateGraphRoute: vi.fn().mockImplementation((origin, destination) => {
        const dist = 5.0;
        return Promise.resolve({
          coordinates: [origin, destination],
          routeStats: {
            segments: [],
            totalDistanceKm: dist,
            totalDurationHrs: dist / 30,
            sharpTurnCount: 0,
            bridgeCount: 0,
            totalBarriers: 0
          }
        });
      })
    };

    service = new DispatchRoutesService(mockMarchRouteService);
  });

  it('should correctly calculate haversine distance between two points', () => {
    const p1: [number, number] = [27.5618, 53.9022];
    const p2: [number, number] = [28.5119, 54.2276];
    const dist = service.haversineDistanceKm(p1, p2);
    expect(dist).toBeGreaterThan(65);
    expect(dist).toBeLessThan(75);
  });

  it('should cluster points into balanced non-overlapping polar sectors', () => {
    const startPoint: [number, number] = [28.5, 54.2];
    const addresses: DispatchAddress[] = [
      { id: '1', index: 1, recipientName: 'A1', city: '', street: '', house: '', coords: [28.6, 54.2], geocoded: true },
      { id: '2', index: 2, recipientName: 'A2', city: '', street: '', house: '', coords: [28.5, 54.3], geocoded: true },
      { id: '3', index: 3, recipientName: 'A3', city: '', street: '', house: '', coords: [28.4, 54.2], geocoded: true },
      { id: '4', index: 4, recipientName: 'A4', city: '', street: '', house: '', coords: [28.5, 54.1], geocoded: true },
      { id: '5', index: 5, recipientName: 'A5', city: '', street: '', house: '', coords: [28.6, 54.3], geocoded: true },
      { id: '6', index: 6, recipientName: 'A6', city: '', street: '', house: '', coords: [28.4, 54.1], geocoded: true }
    ];

    const clusters = service.clusterAddressesRaySweep(startPoint, addresses, 3);
    expect(clusters.length).toBe(3);
    expect(clusters[0].length).toBe(2);
    expect(clusters[1].length).toBe(2);
    expect(clusters[2].length).toBe(2);
  });

  it('should optimize route with TSP 2-opt starting from base', () => {
    const startPoint: [number, number] = [28.5, 54.2];
    const cluster: DispatchAddress[] = [
      { id: '1', index: 1, recipientName: 'Far', city: '', street: '', house: '', coords: [28.8, 54.2], geocoded: true },
      { id: '2', index: 2, recipientName: 'Near', city: '', street: '', house: '', coords: [28.55, 54.2], geocoded: true },
      { id: '3', index: 3, recipientName: 'Mid', city: '', street: '', house: '', coords: [28.65, 54.2], geocoded: true }
    ];

    const ordered = service.optimizeTsp2Opt(startPoint, cluster, true);
    expect(ordered.length).toBe(3);
    expect(ordered[0].recipientName).toBe('Near');
    expect(ordered[1].recipientName).toBe('Mid');
    expect(ordered[2].recipientName).toBe('Far');
  });

  it('should build complete dispatch routes with geometries and stats', async () => {
    const startPoint: [number, number] = [28.5, 54.2];
    const addresses: DispatchAddress[] = [
      { id: '1', index: 1, recipientName: 'A1', city: 'Борисов', street: 'Гагарина', house: '1', coords: [28.52, 54.22], geocoded: true },
      { id: '2', index: 2, recipientName: 'A2', city: 'Борисов', street: 'Гагарина', house: '2', coords: [28.53, 54.23], geocoded: true },
      { id: '3', index: 3, recipientName: 'A3', city: 'Борисов', street: 'Ленина', house: '5', coords: [28.48, 54.18], geocoded: true },
      { id: '4', index: 4, recipientName: 'A4', city: 'Борисов', street: 'Ленина', house: '6', coords: [28.47, 54.17], geocoded: true }
    ];

    const config: DispatchConfig = {
      startPoint,
      startPointName: 'Стартовая точка Борисов',
      routeCount: 2,
      returnToStart: true,
      speedKmH: 30,
      stopDurationMin: 5,
      transportMode: 'car'
    };

    const routes = await service.buildDispatchRoutes(startPoint, addresses, config);
    expect(routes.length).toBe(2);
    expect(routes[0].addresses.length).toBe(2);
    expect(routes[1].addresses.length).toBe(2);
    expect(routes[0].geometry.length).toBeGreaterThanOrEqual(2);
    expect(routes[0].totalDistanceKm).toBeGreaterThan(0);
    expect(routes[0].totalDurationMin).toBeGreaterThan(0);
  });

  it('should generate a template Excel workbook with proper headers', () => {
    const wb = service.generateTemplateWorkbook();
    expect(wb.SheetNames).toContain('Шаблон_оповещения');
    const ws = wb.Sheets['Шаблон_оповещения'];
    expect(ws['A1'].v).toBe('№ п/п');
    expect(ws['B1'].v).toBe('ФИО получателя');
  });

  it('should autogeocode addresses by matching settlement names', async () => {
    const addresses: DispatchAddress[] = [
      { id: '1', index: 1, recipientName: 'Иванов', city: 'Борисов', street: 'Гагарина', house: '10', coords: null, geocoded: false },
      { id: '2', index: 2, recipientName: 'Петров', city: 'НесуществующийГород', street: 'Лесная', house: '5', coords: null, geocoded: false }
    ];

    const geocoded = await service.autoGeocodeBySettlements(addresses);
    expect(geocoded[0].geocoded).toBe(true);
    expect(geocoded[0].coords).toEqual([28.5119, 54.2276]);
    expect(geocoded[0].geocodeSource).toBe('settlement');
    expect(geocoded[1].geocoded).toBe(false);
  });

  it('should autogeocode addresses using LocalAddressCacheService when available', async () => {
    const mockCache: any = {
      resolve: vi.fn().mockImplementation((city: string, street: string, house: string) => {
        if (city === 'Борисов' && street === 'Гагарина' && house === '10') {
          return [28.5200, 54.2300];
        }
        return null;
      })
    };
    const cachedService = new DispatchRoutesService(mockMarchRouteService, undefined, mockCache);
    const addresses: DispatchAddress[] = [
      { id: '1', index: 1, recipientName: 'Иванов', city: 'Борисов', street: 'Гагарина', house: '10', coords: null, geocoded: false }
    ];
    const geocoded = await cachedService.autoGeocodeBySettlements(addresses);
    expect(geocoded[0].geocoded).toBe(true);
    expect(geocoded[0].coords).toEqual([28.5200, 54.2300]);
    expect(geocoded[0].geocodeSource).toBe('cache');
  });

  it('should properly manage route visibility and isolation', () => {
    service.routes.set([
      { id: 'r1', routeIndex: 1, name: 'Route 1', color: '#ff0000', addresses: [], startCoords: [0, 0], endCoords: [0, 0], totalDistanceKm: 5, totalDurationMin: 30, geometry: [[0, 0], [1, 1]] },
      { id: 'r2', routeIndex: 2, name: 'Route 2', color: '#00ff00', addresses: [], startCoords: [0, 0], endCoords: [0, 0], totalDistanceKm: 6, totalDurationMin: 40, geometry: [[0, 0], [2, 2]] },
      { id: 'r3', routeIndex: 3, name: 'Route 3', color: '#0000ff', addresses: [], startCoords: [0, 0], endCoords: [0, 0], totalDistanceKm: 7, totalDurationMin: 50, geometry: [[0, 0], [3, 3]] }
    ]);

    expect(service.isRouteVisible('r1')).toBe(true);
    expect(service.isRouteVisible('r2')).toBe(true);
    expect(service.isRouteVisible('r3')).toBe(true);

    service.toggleRouteVisibility('r2');
    expect(service.isRouteVisible('r2')).toBe(false);
    expect(service.isRouteVisible('r1')).toBe(true);

    service.toggleRouteVisibility('r2');
    expect(service.isRouteVisible('r2')).toBe(true);

    service.isolateRoute('r2');
    expect(service.isRouteVisible('r2')).toBe(true);
    expect(service.isRouteVisible('r1')).toBe(false);
    expect(service.isRouteVisible('r3')).toBe(false);

    service.isolateRoute('r2');
    expect(service.isRouteVisible('r1')).toBe(true);
    expect(service.isRouteVisible('r2')).toBe(true);
    expect(service.isRouteVisible('r3')).toBe(true);

    service.hideAllRoutes();
    expect(service.isRouteVisible('r1')).toBe(false);
    expect(service.isRouteVisible('r2')).toBe(false);
    expect(service.isRouteVisible('r3')).toBe(false);

    service.showAllRoutes();
    expect(service.isRouteVisible('r1')).toBe(true);
    expect(service.isRouteVisible('r2')).toBe(true);
    expect(service.isRouteVisible('r3')).toBe(true);
  });

  it('should request foot column_type in graph calculation when transportMode is foot', async () => {
    const startPoint: [number, number] = [28.5, 54.2];
    const addresses: DispatchAddress[] = [
      { id: '1', index: 1, recipientName: 'A1', city: 'Борисов', street: 'Гагарина', house: '1', coords: [28.52, 54.22], geocoded: true }
    ];

    const config: DispatchConfig = {
      startPoint,
      startPointName: 'Стартовая точка',
      routeCount: 1,
      returnToStart: false,
      speedKmH: 4.5,
      stopDurationMin: 5,
      transportMode: 'foot'
    };

    await service.buildDispatchRoutes(startPoint, addresses, config);
    expect(mockMarchRouteService.calculateGraphRoute).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      [],
      'foot',
      false
    );
  });

  it('should eliminate dead-end turnaround spikes in route geometry', () => {
    const rawTrack: [number, number][] = [
      [25.320, 53.080],
      [25.322, 53.081],
      [25.320, 53.080],
      [25.325, 53.085]
    ];
    const smoothed = service.smoothRouteSpikes(rawTrack);
    expect(smoothed.length).toBe(3);
    expect(smoothed[0]).toEqual([25.320, 53.080]);
    expect(smoothed[1]).toEqual([25.322, 53.081]);
    expect(smoothed[2]).toEqual([25.325, 53.085]);
  });

  it('should extract building approaches when route coordinates include road access segments', async () => {
    const customMarchRouteService = {
      getAllPlaces: vi.fn().mockResolvedValue([]),
      calculateGraphRoute: vi.fn().mockImplementation((origin, destination) => {
        return Promise.resolve({
          coordinates: [
            origin,
            [25.321, 53.080],
            [25.323, 53.082],
            destination
          ],
          routeStats: {
            segments: [],
            totalDistanceKm: 1.2,
            totalDurationHrs: 0.1,
            sharpTurnCount: 0,
            bridgeCount: 0,
            totalBarriers: 0
          }
        });
      })
    };

    const testService = new DispatchRoutesService(customMarchRouteService);
    const startPoint: [number, number] = [25.320, 53.079];
    const addresses: DispatchAddress[] = [
      { id: '1', index: 1, recipientName: 'B1', city: 'Слоним', street: 'Тавлая', house: '34', coords: [25.333, 53.066], geocoded: true }
    ];
    const config: DispatchConfig = {
      startPoint,
      startPointName: 'Старт',
      routeCount: 1,
      returnToStart: false,
      speedKmH: 4.5,
      stopDurationMin: 5,
      transportMode: 'foot'
    };

    const routes = await testService.buildDispatchRoutes(startPoint, addresses, config);
    expect(routes.length).toBe(1);
    expect(routes[0].approaches).toBeDefined();
    expect(routes[0].approaches!.length).toBeGreaterThan(0);
    expect(routes[0].approaches![0][1]).toEqual([25.333, 53.066]);
  });
});
