import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MarchRouteService } from './march-route.service';
import { TerrainService } from './terrain.service';
import * as maplibregl from 'maplibre-gl';

describe('MarchRouteService', () => {
  let service: MarchRouteService;
  let terrainMock: any;

  beforeEach(() => {
    terrainMock = {
      getApproxElevation: vi.fn().mockResolvedValue(100)
    };

    service = new MarchRouteService(terrainMock as unknown as TerrainService);
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
    terrainMock.getApproxElevation.mockReset();
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
    expect(stats.segments[0].speedKmH).toBeCloseTo(21, 1);
  });

  it('should find and sort places along route corridor', async () => {
    vi.spyOn(service, 'getAllPlaces').mockResolvedValue([
      {
        id: 'p1',
        name: 'Озерцо',
        nameBe: 'Азярцо',
        type: 'village',
        region: 'Минский район',
        coords: [27.5615, 53.9048]
      },
      {
        id: 'p2',
        name: 'Далекий',
        nameBe: 'Далёкі',
        type: 'village',
        region: 'Минский район',
        coords: [28.5615, 54.9048]
      }
    ]);

    const routeCoords: [number, number][] = [
      [27.5615, 53.9040],
      [27.5615, 53.9060]
    ];

    const places = await service.getPlacesAlongRoute(routeCoords, 3.0);
    expect(places.length).toBe(1);
    expect(places[0].name).toBe('Озерцо');
    expect(places[0].distanceFromRouteKm).toBeLessThan(0.1);
  });

  it('should calculate accurate kilometer marks including 0km start and final km end point', () => {
    const routeCoords: [number, number][] = [
      [27.5615, 53.9000],
      [27.5615, 54.1000]
    ];

    const marks = service.calculateKilometerMarks(routeCoords, 5);
    expect(marks.length).toBeGreaterThanOrEqual(3);
    expect(marks[0].km).toBe(0);
    expect(marks[0].label).toBe('0 км');
    expect(marks[0].coords).toEqual(routeCoords[0]);

    const lastMark = marks[marks.length - 1];
    expect(lastMark.km).toBeGreaterThan(20);
    expect(lastMark.label).toContain('км');
    expect(lastMark.coords).toEqual(routeCoords[routeCoords.length - 1]);
  });
});
