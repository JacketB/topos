import { describe, it, expect, beforeEach } from 'vitest';
import { PozCalculationService } from './poz-calculation.service';
import { MinefieldCalculationService } from './minefield-calculation.service';

describe('PozCalculationService', () => {
  let service: PozCalculationService;

  beforeEach(() => {
    service = new PozCalculationService(new MinefieldCalculationService());
  });

  it('should calculate POZ preemption condition correctly when safe', () => {
    const result = service.calculate({
      enemySpeedKmh: 15,
      enemyDistanceKm: 25,
      pozMarchDistanceKm: 5,
      pozMarchSpeedKmh: 30,
      pozDecisionTimeMin: 10,
      pozReconTimeMin: 10,
      pozVehicleType: 'gmz3',
      pozVehicleCount: 3,
      frontLengthM: 1000,
      rowsCount: 4,
      stepM: 5.5,
      mineId: 'tm72',
      soilCondition: 'ground',
      reloadDistanceKm: 10
    }, '08:00');

    expect(result.enemyApproachTimeMin).toBe(100);
    expect(result.isPreemptionGuaranteed).toBe(true);
    expect(result.timeMarginMin).toBeGreaterThan(0);
    expect(result.timeline.length).toBe(5);
    expect(result.boundaries.length).toBe(3);
    expect(result.boundaries[0].isGuaranteed).toBe(true);
  });

  it('should detect danger when enemy arrives before POZ readiness', () => {
    const result = service.calculate({
      enemySpeedKmh: 40,
      enemyDistanceKm: 8,
      pozMarchDistanceKm: 15,
      pozMarchSpeedKmh: 20,
      pozDecisionTimeMin: 20,
      pozReconTimeMin: 15,
      pozVehicleType: 'gmz3',
      pozVehicleCount: 1,
      frontLengthM: 2000,
      rowsCount: 4,
      stepM: 5.5,
      mineId: 'tm72',
      soilCondition: 'sod',
      reloadDistanceKm: 20
    }, '08:00');

    expect(result.enemyApproachTimeMin).toBe(12);
    expect(result.isPreemptionGuaranteed).toBe(false);
    expect(result.timeMarginMin).toBeLessThan(0);
    expect(result.minSafeEnemyDistanceKm).toBeGreaterThan(8);
  });
});
