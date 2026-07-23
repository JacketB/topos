import { describe, it, expect, beforeEach } from 'vitest';
import { MarchOrderService } from './march-order.service';

describe('MarchOrderService Excel Math Verification', () => {
  let service: MarchOrderService;

  beforeEach(() => {
    service = new MarchOrderService();
  });

  it('should compute exact march metrics matching Excel "Расчет марша 07.2026.xlsx"', () => {
    service.elements.set([
      { id: '1', name: 'Управление', icon: '', composition: '', vehicleCount: 1, vehicleLength: 8, vehicleDistance: 50, vehicleDistanceUnit: 'm', distanceToNext: 200, distanceUnit: 'm' },
      { id: '2', name: '1 ИСР', icon: '', composition: '', vehicleCount: 20, vehicleLength: 8, vehicleDistance: 50, vehicleDistanceUnit: 'm', distanceToNext: 200, distanceUnit: 'm' },
      { id: '3', name: '2 ИСР', icon: '', composition: '', vehicleCount: 22, vehicleLength: 8, vehicleDistance: 50, vehicleDistanceUnit: 'm', distanceToNext: 200, distanceUnit: 'm' },
      { id: '4', name: 'ИДР', icon: '', composition: '', vehicleCount: 10, vehicleLength: 8, vehicleDistance: 50, vehicleDistanceUnit: 'm', distanceToNext: 200, distanceUnit: 'm' },
      { id: '5', name: 'ИТР', icon: '', composition: '', vehicleCount: 10, vehicleLength: 8, vehicleDistance: 50, vehicleDistanceUnit: 'm', distanceToNext: 200, distanceUnit: 'm' },
      { id: '6', name: 'РВВ', icon: '', composition: '', vehicleCount: 10, vehicleLength: 8, vehicleDistance: 50, vehicleDistanceUnit: 'm', distanceToNext: 200, distanceUnit: 'm' },
      { id: '7', name: 'ВС', icon: '', composition: '', vehicleCount: 10, vehicleLength: 8, vehicleDistance: 50, vehicleDistanceUnit: 'm', distanceToNext: 200, distanceUnit: 'm' },
      { id: '8', name: 'АВ', icon: '', composition: '', vehicleCount: 10, vehicleLength: 8, vehicleDistance: 50, vehicleDistanceUnit: 'm', distanceToNext: 200, distanceUnit: 'm' },
      { id: '9', name: 'ВТО', icon: '', composition: '', vehicleCount: 10, vehicleLength: 8, vehicleDistance: 50, vehicleDistanceUnit: 'm', distanceToNext: 200, distanceUnit: 'm' },
      { id: '10', name: 'ОО', icon: '', composition: '', vehicleCount: 10, vehicleLength: 8, vehicleDistance: 50, vehicleDistanceUnit: 'm', distanceToNext: 200, distanceUnit: 'm' },
      { id: '11', name: 'ВО', icon: '', composition: '', vehicleCount: 10, vehicleLength: 8, vehicleDistance: 50, vehicleDistanceUnit: 'm', distanceToNext: 200, distanceUnit: 'm' },
      { id: '12', name: 'МП', icon: '', composition: '', vehicleCount: 1, vehicleLength: 8, vehicleDistance: 50, vehicleDistanceUnit: 'm', distanceToNext: 0, distanceUnit: 'm' }
    ]);

    const res = service.calculateAdvancedMarch({
      avgVehicleLengthM: 8,
      distBetweenVehiclesM: 50,
      distBetweenUnitsM: 200,
      speedToIrKmh: 20,
      routeLengthKm: 100,
      marchSpeedKmh: 50,
      restTimeMin: 0,
      barrierCount: 6,
      barrierSpeedKmh: 10
    });

    expect(res.totalVehicles).toBe(124);
    expect(res.totalDepthM).toBe(8792);
    expect(res.irDistanceKm).toBe(8.8);
    expect(res.timeToIrMin).toBeCloseTo(26.4, 1);
    expect(res.timeStretchMin).toBeCloseTo(10.55, 1);
    expect(res.pureTravelTimeMin).toBe(120);
    expect(res.totalMarchTimeFormatted).toBe('6 ч. 24 мин.');
  });
});
