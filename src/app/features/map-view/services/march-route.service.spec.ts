import { TestBed } from '@angular/core/testing';
import { MarchRouteService } from './march-route.service';
import { TerrainService } from './terrain.service';
import { vi } from 'vitest';
import * as maplibregl from 'maplibre-gl';

describe('MarchRouteService', () => {
  let service: MarchRouteService;
  let terrainMock: any;

  beforeEach(() => {
    terrainMock = {
      getApproxElevation: vi.fn().mockResolvedValue(100)
    };

    TestBed.configureTestingModule({
      providers: [
        MarchRouteService,
        { provide: TerrainService, useValue: terrainMock }
      ]
    });
    service = TestBed.inject(MarchRouteService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should calculate correct distance between coordinates', () => {
    const p1: [number, number] = [27.5615, 53.9045];
    const p2: [number, number] = [27.5615, 53.9054]; // ~100 метров
    const dist = service.getDistance(p1, p2);
    expect(dist).toBeCloseTo(0.1, 2);
  });

  it('should calculate route stats with correct speed and duration (day time, flat terrain)', async () => {
    const mockMap = {
      project: () => ({ x: 100, y: 100 }),
      queryRenderedFeatures: () => [{ properties: { class: 'primary' } }]
    } as unknown as maplibregl.Map;

    const coords: [number, number][] = [
      [27.5615, 53.9045],
      [27.5615, 53.9054]
    ];

    const stats = await service.calculateRouteStats(mockMap, coords, 'wheel', false);
    
    expect(stats.segments.length).toBe(1);
    expect(stats.totalDistanceKm).toBeCloseTo(0.1, 2);
    // Для wheel на primary скорость 35 км/ч
    expect(stats.segments[0].speedKmH).toBe(35);
    expect(stats.totalDurationHrs).toBeCloseTo(stats.totalDistanceKm / 35, 4);
  });

  it('should apply night factor (x0.7) to speed', async () => {
    const mockMap = {
      project: () => ({ x: 100, y: 100 }),
      queryRenderedFeatures: () => [{ properties: { class: 'primary' } }]
    } as unknown as maplibregl.Map;

    const coords: [number, number][] = [
      [27.5615, 53.9045],
      [27.5615, 53.9054]
    ];

    const stats = await service.calculateRouteStats(mockMap, coords, 'wheel', true);
    // 35 * 0.7 = 24.5 км/ч
    expect(stats.segments[0].speedKmH).toBeCloseTo(24.5, 1);
  });

  it('should apply slope factor (x0.6) for slope > 8%', async () => {
    // h1 = 100м, h2 = 120м на расстоянии 100м (уклон 20% > 8%)
    terrainMock.getApproxElevation.mockResolvedValueOnce(100).mockResolvedValueOnce(120);

    const mockMap = {
      project: () => ({ x: 100, y: 100 }),
      queryRenderedFeatures: () => [{ properties: { class: 'primary' } }]
    } as unknown as maplibregl.Map;

    const coords: [number, number][] = [
      [27.5615, 53.9045],
      [27.5615, 53.9054]
    ];

    const stats = await service.calculateRouteStats(mockMap, coords, 'wheel', false);
    // 35 * 0.6 = 21 км/ч
    expect(stats.segments[0].speedKmH).toBeCloseTo(21, 1);
  });
});
