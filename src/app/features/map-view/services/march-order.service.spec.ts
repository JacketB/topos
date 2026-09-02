import { describe, it, expect, beforeEach } from 'vitest';
import { MarchOrderService, MarchOrderElement } from './march-order.service';

describe('MarchOrderService', () => {
  let service: MarchOrderService;

  beforeEach(() => {
    localStorage.clear();
    service = new MarchOrderService();
    service.setElements([]);
  });

  it('should be created and have default elements if storage is empty', () => {
    localStorage.clear();
    const freshService = new MarchOrderService();
    expect(freshService.elements().length).toBe(4);
  });

  it('should add, update and remove elements correctly', () => {
    expect(service.elements().length).toBe(0);

    service.addElement({
      name: 'ГД',
      icon: 'bmp_svoy1',
      composition: '3 БМП',
      vehicleCount: 3,
      vehicleLength: 6.7,
      vehicleDistance: 50,
      vehicleDistanceUnit: 'm',
      distanceToNext: 100,
      distanceUnit: 'm'
    });

    const elements = service.elements();
    expect(elements.length).toBe(1);
    expect(elements[0].name).toBe('ГД');
    expect(elements[0].id).toBeDefined();

    const elementId = elements[0].id;

    service.updateElement(elementId, { vehicleCount: 5 });
    expect(service.elements()[0].vehicleCount).toBe(5);

    service.removeElement(elementId);
    expect(service.elements().length).toBe(0);
  });

  it('should calculate correct unit length in km', () => {
    const el: MarchOrderElement = {
      id: '1',
      name: 'ГД',
      icon: 'bmp_svoy1',
      composition: '3 БМП',
      vehicleCount: 3,
      vehicleLength: 10,
      vehicleDistance: 50,
      vehicleDistanceUnit: 'm',
      distanceToNext: 100,
      distanceUnit: 'm'
    };

    const unitLength = service.getUnitLengthKm(el);
    expect(unitLength).toBeCloseTo(0.13, 3);
  });

  it('should calculate correct total column length', () => {
    service.addElement({
      name: 'Подразделение 1',
      icon: 'bmp_svoy1',
      composition: '3 БМП',
      vehicleCount: 3,
      vehicleLength: 10,
      vehicleDistance: 50,
      vehicleDistanceUnit: 'm',
      distanceToNext: 100,
      distanceUnit: 'm'
    });

    service.addElement({
      name: 'Подразделение 2',
      icon: 'tank_svoy1',
      composition: '2 Танка',
      vehicleCount: 2,
      vehicleLength: 10,
      vehicleDistance: 100,
      vehicleDistanceUnit: 'm',
      distanceToNext: 0,
      distanceUnit: 'm'
    });

    const totalLength = service.calculateTotalLengthKm();
    expect(totalLength).toBeCloseTo(0.35, 3);
  });
});
