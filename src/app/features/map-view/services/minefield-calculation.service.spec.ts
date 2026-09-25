import { describe, it, expect, beforeEach } from 'vitest';
import { MinefieldCalculationService } from './minefield-calculation.service';

describe('MinefieldCalculationService', () => {
  let service: MinefieldCalculationService;

  beforeEach(() => {
    service = new MinefieldCalculationService();
  });

  it('should return catalog of mines', () => {
    const catalog = service.getCatalog();
    expect(catalog.length).toBeGreaterThanOrEqual(10);
    expect(catalog.some(m => m.name === 'ТМ-62М')).toBe(true);
    expect(catalog.some(m => m.name === 'ТМ-72')).toBe(true);
    expect(catalog.some(m => m.name === 'ПМН-2')).toBe(true);
  });

  it('should calculate antitank minefield by GMZ-3 properly', () => {
    const result = service.calculate({
      mineId: 'tm72',
      frontLengthM: 1000,
      rowsCount: 4,
      stepM: 5.5,
      deployMethod: 'gmz3',
      soilCondition: 'ground',
      unitFormation: 'platoon',
      vehiclesCount: 3,
      reloadDistanceKm: 15
    });

    expect(result.minesPerRow).toBe(182);
    expect(result.totalMines).toBe(728);
    expect(result.densityPerKm).toBeCloseTo(728, 0);
    expect(result.killProbabilityPct).toBeGreaterThan(60);
    expect(result.totalWeightTons).toBeCloseTo(4.368, 2);
    expect(result.totalExplosiveKg).toBeCloseTo(1820, 0);
    expect(result.deployTimeHours).toBeGreaterThan(0);
    expect(result.trucksNeeded).toBe(4);
  });

  it('should calculate antipersonnel minefield manually by sappers', () => {
    const result = service.calculate({
      mineId: 'pmn2',
      frontLengthM: 500,
      rowsCount: 2,
      stepM: 1.0,
      deployMethod: 'manual_sapper',
      soilCondition: 'ground',
      unitFormation: 'platoon',
      manpowerCount: 24,
      reloadDistanceKm: 10,
      withUnremovablePenta: true
    });

    expect(result.minesPerRow).toBe(500);
    expect(result.totalMines).toBe(1000);
    expect(result.unremovableMinesCount).toBe(50);
    expect(result.densityPerKm).toBe(2000);
    expect(result.killProbabilityPct).toBeGreaterThanOrEqual(45);
    expect(result.deployTimeHours).toBeCloseTo(1000 / (24 * 15), 2);
  });

  it('should calculate UMZ cassette deployment', () => {
    const result = service.calculate({
      mineId: 'pfm1s',
      frontLengthM: 800,
      rowsCount: 2,
      stepM: 0.5,
      deployMethod: 'umz',
      soilCondition: 'ground',
      unitFormation: 'platoon',
      vehiclesCount: 2,
      reloadDistanceKm: 20
    });

    expect(result.totalMines).toBe(3200);
    expect(result.deployTimeHours).toBeGreaterThan(0);
    expect(result.totalMissionTimeHours).toBeGreaterThanOrEqual(result.deployTimeHours);
  });
});
