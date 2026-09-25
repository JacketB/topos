import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FortificationPlannerComponent, MachDevice } from './fortification-planner.component';
import { MapViewModel } from '../../viewmodels/map.viewmodel';
import { FortificationCalculationService } from '../../services/fortification-calculation.service';
import { TacticalMapService } from '../../services/tactical-map.service';
import { signal } from '@angular/core';

describe('FortificationPlannerComponent', () => {
  let component: FortificationPlannerComponent;
  let fixture: ComponentFixture<FortificationPlannerComponent>;
  let mockVm: any;

  beforeEach(() => {
    localStorage.clear();

    mockVm = {
      placedFortifications: signal([]),
      activeCalculationGroupId: signal('all'),
      objectGroups: signal([]),
      activeTab: signal('planner')
    };

    TestBed.configureTestingModule({
      imports: [FortificationPlannerComponent],
      providers: [
        { provide: MapViewModel, useValue: mockVm },
        { provide: TacticalMapService, useValue: {} },
        FortificationCalculationService
      ]
    });

    fixture = TestBed.createComponent(FortificationPlannerComponent);
    component = fixture.componentInstance;
  });

  it('should initialize with default devices including amkodor and auto', () => {
    const devices = component.machDevices();
    expect(devices.some(d => d.id === 'amkodor' && d.name.includes('АМКОДОР'))).toBe(true);
    expect(devices.some(d => d.id === 'auto' && d.name.includes('Автомобили'))).toBe(true);
    expect(devices.some(d => d.id === 'pzm')).toBe(true);
    expect(devices.some(d => d.id === 'eov')).toBe(true);
    expect(devices.some(d => d.id === 'mdk')).toBe(true);
  });

  it('should migrate legacy localStorage missing amkodor and auto', () => {
    const oldDevices: Partial<MachDevice>[] = [
      { id: 'pzm', name: 'ПЗМ-2', type: 'pzm', basePerf: 120, currentPerf: 120, efficiency: 0.9, notes: '' },
      { id: 'eov', name: 'ЭОВ-4421', type: 'eov', basePerf: 60, currentPerf: 60, efficiency: 0.85, notes: '' },
      { id: 'none', name: 'Вручную', type: 'none', basePerf: 1.5, currentPerf: 1.5, efficiency: 1, notes: '' }
    ];
    localStorage.setItem('topos_planner_devices', JSON.stringify(oldDevices));

    const newFixture = TestBed.createComponent(FortificationPlannerComponent);
    const newComp = newFixture.componentInstance;
    const loaded = newComp.machDevices();

    expect(loaded.some(d => d.id === 'amkodor')).toBe(true);
    expect(loaded.some(d => d.id === 'auto')).toBe(true);
  });

  it('should allow adding custom user machine without predefined type constraint', () => {
    const initialCount = component.machDevices().length;
    component.addDevice();
    const afterCount = component.machDevices().length;
    expect(afterCount).toBe(initialCount + 1);

    const added = component.machDevices()[afterCount - 1];
    expect(added.type).toBe('custom');
    expect(added.id.startsWith('custom_')).toBe(true);
    expect(added.basePerf).toBe(50);
  });

  it('should update machine fields including name, basePerf, currentPerf, efficiency', () => {
    component.addDevice();
    const devices = component.machDevices();
    const customDev = devices[devices.length - 1];

    component.updateDeviceField(customDev.id, 'name', { target: { value: 'Бульдозер Б10М' } } as any);
    component.updateDeviceField(customDev.id, 'basePerf', { target: { value: '80' } } as any);
    component.updateDeviceField(customDev.id, 'currentPerf', { target: { value: '75' } } as any);
    component.updateDeviceField(customDev.id, 'efficiency', { target: { value: '0.88' } } as any);

    const updated = component.machDevices().find(d => d.id === customDev.id);
    expect(updated?.name).toBe('Бульдозер Б10М');
    expect(updated?.basePerf).toBe(80);
    expect(updated?.currentPerf).toBe(75);
    expect(updated?.efficiency).toBe(0.88);
  });

  it('should remove device when requested, but preserve none', () => {
    component.addDevice();
    const devicesWithCustom = component.machDevices();
    const customDev = devicesWithCustom[devicesWithCustom.length - 1];

    component.removeDevice(customDev.id);
    expect(component.machDevices().some(d => d.id === customDev.id)).toBe(false);

    component.removeDevice('none');
    expect(component.machDevices().some(d => d.id === 'none')).toBe(true);
  });

  it('should calculate task allocations with custom device correctly', () => {
    component.addDevice();
    const customDev = component.machDevices().find(d => d.type === 'custom')!;
    component.updateDeviceField(customDev.id, 'basePerf', { target: { value: '100' } } as any);
    component.updateDeviceField(customDev.id, 'currentPerf', { target: { value: '100' } } as any);
    component.updateDeviceField(customDev.id, 'efficiency', { target: { value: '1.0' } } as any);

    component.vopTasks.set([
      {
        id: 1,
        phase: 1,
        name: 'Тестовая задача',
        objectName: 'мсв',
        unit: 'шт.',
        qty: 2,
        laborNorm: 5,
        machNorm: 2,
        machAllocations: [{ machType: customDev.id, qty: 1 }]
      }
    ]);

    const calcs = component.vopCalculations();
    expect(calcs.rows.length).toBe(1);
    expect(calcs.rows[0].machTotal).toBe(4);
    expect(calcs.rows[0].machEndWork - calcs.rows[0].machStartWork).toBe(4);
  });
});
