import { TestBed } from '@angular/core/testing';
import { MarchOrderService, MarchOrderElement } from './march-order.service';

describe('MarchOrderService', () => {
  let service: MarchOrderService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MarchOrderService]
    });
    service = TestBed.inject(MarchOrderService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should add, update and remove elements correctly', () => {
    expect(service.elements().length).toBe(0);

    // Добавляем элемент
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

    // Обновляем элемент
    service.updateElement(elementId, { vehicleCount: 5 });
    expect(service.elements()[0].vehicleCount).toBe(5);

    // Удаляем элемент
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
      vehicleLength: 10, // 10 метров
      vehicleDistance: 50, // 50 метров
      vehicleDistanceUnit: 'm',
      distanceToNext: 100,
      distanceUnit: 'm'
    };

    // Глубина: (N * L_vehicle) + (N - 1) * D_between
    // = (3 * 10) + (2 * 50) = 30 + 100 = 130 метров = 0.13 км
    const unitLength = service.getUnitLengthKm(el);
    expect(unitLength).toBeCloseTo(0.13, 3);
  });

  it('should calculate correct total column length', () => {
    // Добавим 2 элемента
    // Элемент 1: 3 БМП по 10м с дистанцией 50м (глубина 130м = 0.13км). Дистанция до следующего: 100м = 0.1км.
    // Элемент 2: 2 танка по 10м с дистанцией 100м (глубина 120м = 0.12км). Дистанция до следующего: 0.
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

    // Общая длина = 0.13км (эл1) + 0.1км (дистанция до эл2) + 0.12км (эл2) = 0.35км
    const totalLength = service.calculateTotalLengthKm();
    expect(totalLength).toBeCloseTo(0.35, 3);
  });
});
