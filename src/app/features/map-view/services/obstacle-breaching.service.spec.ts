import { describe, it, expect, beforeEach } from 'vitest';
import { ObstacleBreachingService } from './obstacle-breaching.service';

describe('ObstacleBreachingService', () => {
  let service: ObstacleBreachingService;

  beforeEach(() => {
    service = new ObstacleBreachingService();
  });

  it('should calculate UR-77 explosive breach correctly', () => {
    const res = service.calculateMineBreach({
      minefieldDepthM: 150,
      breachesCount: 2,
      method: 'ur77'
    });

    expect(res.method).toBe('ur77');
    expect(res.launchesPerBreach).toBe(2);
    expect(res.totalCharges).toBe(4);
    expect(res.vehiclesOrKitsNeeded).toBe(2);
    expect(res.breachWidthM).toBe(6.0);
    expect(res.safetyDistanceM).toBe(600);
    expect(res.clearingTimeMin).toBe(15 + 2 * 12);
  });

  it('should calculate KMT trawling parameters', () => {
    const res = service.calculateTrawls({
      combatVehiclesCount: 10,
      trawlType: 'kmt7',
      equippedPercent: 40,
      breachLengthM: 200
    });

    expect(res.trawlsCount).toBe(4);
    expect(res.trawlingSpeedKmh).toBe(10);
    expect(res.clearedWidthM).toBe(1.6);
    expect(res.transitTimeMin).toBeGreaterThan(0);
  });

  it('should calculate obstacle clearing with IMR-2', () => {
    const res = service.calculateObstacleClearing({
      obstacleType: 'forest_abatis',
      obstacleLengthM: 350,
      obstacleWidthM: 4,
      obstacleHeightOrDepthM: 1.5,
      vehicleType: 'imr2',
      vehiclesCount: 1
    });

    expect(res.machineHours).toBe(1.0);
    expect(res.clearingTimeHours).toBe(1.0);
    expect(res.passageWidthM).toBe(4.0);
  });
});
