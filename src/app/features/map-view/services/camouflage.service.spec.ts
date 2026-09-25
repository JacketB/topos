import { describe, it, expect, beforeEach } from 'vitest';
import { CamouflageService } from './camouflage.service';

describe('CamouflageService', () => {
  let service: CamouflageService;

  beforeEach(() => {
    service = new CamouflageService();
  });

  it('should calculate standard MKT masking sets', () => {
    const res = service.calculateMasking({
      targetType: 'tank',
      targetCount: 4,
      maskType: 'mkt2l'
    });

    expect(res.totalAreaM2).toBe(600);
    expect(res.standardKitsNeeded).toBe(3);
    expect(res.panelsCount).toBe(36);
    expect(res.laborHours).toBeGreaterThan(0);
  });

  it('should calculate corner reflectors for false bridge', () => {
    const res = service.calculateDecoys({
      decoyType: 'sfera_pr',
      falseTargetType: 'bridge',
      targetLengthM: 150
    });

    expect(res.reflectorsCount).toBeGreaterThanOrEqual(20);
    expect(res.radarCrossSectionEchoM2).toBeGreaterThan(100);
  });

  it('should calculate aerosol smoke screen with TDA-2M', () => {
    const res = service.calculateAerosol({
      frontLengthM: 1000,
      screenDurationMin: 20,
      windSpeedMs: 3.0,
      windDirection: 'flank',
      deviceType: 'tda2m'
    });

    expect(res.machinesOrKitsNeeded).toBeGreaterThanOrEqual(1);
    expect(res.consumptionTotal).toBeGreaterThan(0);
    expect(res.totalCoverAreaHa).toBeGreaterThan(0);
  });
});
