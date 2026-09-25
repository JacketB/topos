import { describe, it, expect, beforeEach } from 'vitest';
import { WaterCrossingService } from './water-crossing.service';

describe('WaterCrossingService', () => {
  let service: WaterCrossingService;

  beforeEach(() => {
    service = new WaterCrossingService();
  });

  it('should calculate amphibious crossing with PTS transporters', () => {
    const res = service.calculate({
      crossingMode: 'amphibious_pts',
      riverWidthM: 100,
      riverDepthM: 2.5,
      currentSpeedMs: 1.0,
      banksSlopeDeg: 10,
      combatVehiclesCount: 0,
      trucksCount: 12,
      personnelCount: 150,
      transportersCount: 3
    });

    expect(res.crossingMode).toBe('amphibious_pts');
    expect(res.totalTripsCount).toBe(14);
    expect(res.isFeasible).toBe(true);
    expect(res.totalDurationHours).toBeGreaterThan(0);
  });

  it('should calculate floating bridge from PMP park', () => {
    const res = service.calculate({
      crossingMode: 'floating_bridge_pmp',
      riverWidthM: 150,
      riverDepthM: 3.0,
      currentSpeedMs: 1.2,
      banksSlopeDeg: 8,
      combatVehiclesCount: 20,
      trucksCount: 40,
      personnelCount: 200
    });

    expect(res.crossingMode).toBe('floating_bridge_pmp');
    expect(res.assemblyTimeMin).toBeGreaterThan(30);
    expect(res.equipmentNeeded.some(e => e.name.includes('Речные звенья'))).toBe(true);
    expect(res.isFeasible).toBe(true);
  });

  it('should calculate mechanized bridge TMM-3', () => {
    const res = service.calculate({
      crossingMode: 'mechanized_bridge_tmm',
      riverWidthM: 30,
      riverDepthM: 2.0,
      currentSpeedMs: 0.5,
      banksSlopeDeg: 12,
      combatVehiclesCount: 10,
      trucksCount: 15,
      personnelCount: 80
    });

    expect(res.crossingMode).toBe('mechanized_bridge_tmm');
    expect(res.equipmentNeeded.some(e => e.name.includes('Мостоукладчики'))).toBe(true);
    expect(res.isFeasible).toBe(true);
  });
});
