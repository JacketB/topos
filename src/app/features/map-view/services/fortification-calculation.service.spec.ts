import { TestBed } from '@angular/core/testing';
import { FortificationCalculationService } from './fortification-calculation.service';
import { TacticalMapService } from './tactical-map.service';
import { vi } from 'vitest';

describe('FortificationCalculationService', () => {
  let service: FortificationCalculationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        FortificationCalculationService,
        { provide: TacticalMapService, useValue: {} }
      ]
    });
    service = TestBed.inject(FortificationCalculationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should calculate correct line length (Haversine)', () => {
    const p1: [number, number] = [27.5615, 53.9045];
    const p2: [number, number] = [27.5615, 53.9054]; // ~100.07 метров на север
    const length = service.calculateLineLength([p1, p2]);
    expect(length).toBeGreaterThan(95);
    expect(length).toBeLessThan(105);
  });

  it('should calculate correct volume for trench without lining', () => {
    const p1: [number, number] = [27.5615, 53.9045];
    const p2: [number, number] = [27.5615, 53.9054];
    const feature = {
      properties: {
        id: 1,
        isLinear: true,
        lineType: 'trench',
        origCoords: [p1, p2],
        fortDepth: 110, // см
        fortWidth: 90   // см
      }
    };
    
    const length = service.calculateLineLength(feature.properties.origCoords);
    const norms = service.calculateFeatureNorms(feature);
    
    expect(norms).toBeTruthy();
    // Сечение S = (W_top + W_bottom) / 2 * D
    // W_bottom = 90см (0.9м), D = 110см (1.1м), m = 0.25 (без укрепления)
    // W_top = 0.9 + 2 * 0.25 * 1.1 = 0.9 + 0.55 = 1.45м
    // S = (1.45 + 0.9) / 2 * 1.1 = 1.2925 м²
    // Объем = 1.2925 * length
    const expectedVolume = 1.2925 * length;
    expect(norms!.earthVolume).toBeCloseTo(expectedVolume, 1);
  });

  it('should calculate wood volume for trench with wooden lining', () => {
    const p1: [number, number] = [27.5615, 53.9045];
    const p2: [number, number] = [27.5615, 53.9054];
    const feature = {
      properties: {
        id: 2,
        isLinear: true,
        lineType: 'trench',
        origCoords: [p1, p2],
        fortDepth: 110,
        fortWidth: 90,
        fortRevetment: 'board' // Дощатая одежда
      }
    };

    const norms = service.calculateFeatureNorms(feature);
    expect(norms).toBeTruthy();
    // При дощатой одежде должен рассчитываться woodVol > 0
    expect(norms!.woodVol).toBeGreaterThan(0);
  });

  it('should calculate point norms for point fortifications', () => {
    const feature = {
      properties: {
        id: 3,
        isLinear: false,
        symbol: 'fort_bmp_trench'
      }
    };

    const norms = service.calculateFeatureNorms(feature);
    expect(norms).toBeTruthy();
    expect(norms!.name.toLowerCase()).toContain('окоп для бмп');
    expect(norms!.earthVolume).toBeCloseTo(74.1, 1);
    expect(norms!.laborHrs).toBeCloseTo(12.0, 1);
    expect(norms!.woodVol).toBeCloseTo(1.38, 2);
    expect(norms!.machHrs).toBeCloseTo(0.5, 1);
    expect(norms!.machType).toBe('ПЗМ-2');
  });

  it('should aggregate norms and generate items list with unique IDs in calculateTotalNorms', () => {
    const f1 = {
      id: 'f1',
      properties: {
        id: 101,
        isLinear: true,
        lineType: 'trench',
        origCoords: [
          [27.5615, 53.9045],
          [27.5615, 53.9054]
        ]
      }
    };

    const f2 = {
      properties: {
        id: 102,
        isLinear: false,
        symbol: 'fort_trench_shelter'
      }
    };

    const total = service.calculateTotalNorms([f1, f2]);
    
    expect(total).toBeTruthy();
    expect(total.items.length).toBe(2);
    expect(total.items[0].id).toBe('101');
    expect(total.items[1].id).toBe('102');
    expect(total.totalEarthVolume).toBeGreaterThan(0);
  });

  it('should calculate correct volume for 1911m trench with 2m width and 3m depth', () => {
    const feature = {
      properties: {
        id: 4,
        isLinear: true,
        lineType: 'trench',
        origCoords: [[27.56, 53.90], [27.57, 53.91]],
        fortDepth: 300,
        fortWidth: 200
      }
    };

    const lengthSpy = vi.spyOn(service, 'calculateLineLength').mockReturnValue(1911);

    const norms = service.calculateFeatureNorms(feature);
    expect(norms).toBeTruthy();
    // W_bottom = 2.0м, D = 3.0м, m = 0.25 (без укрепления)
    // W_top = 2.0 + 2 * 0.25 * 3.0 = 3.5м
    // S = (3.5 + 2.0) / 2 * 3.0 = 8.25 м²
    // Объем = 8.25 * 1911 = 15765.75 м³ -> округление 15765.8 м³
    expect(norms!.earthVolume).toBeCloseTo(15765.8, 1);

    lengthSpy.mockRestore();
  });

  it('should calculate correct volume and wood for trench with incline board lining (shpal)', () => {
    const p1: [number, number] = [27.5615, 53.9045];
    const p2: [number, number] = [27.5615, 53.9054];
    const feature = {
      properties: {
        id: 5,
        isLinear: true,
        lineType: 'trench',
        origCoords: [p1, p2],
        fortDepth: 110,
        fortWidth: 90,
        fortRevetment: 'board_incline'
      }
    };

    const length = service.calculateLineLength(feature.properties.origCoords);
    const norms = service.calculateFeatureNorms(feature);

    expect(norms).toBeTruthy();
    const expectedVolume = 1.2925 * length;
    expect(norms!.earthVolume).toBeCloseTo(expectedVolume, 1);
    expect(norms!.woodVol).toBeGreaterThan(0);
  });
});
