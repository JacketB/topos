import { TestBed } from '@angular/core/testing';
import { TacticalMapService } from './tactical-map.service';
import { TacticalSymbolsService } from './tactical-symbols.service';
import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';

describe('TacticalMapService - Export/Import Scenario', () => {
  let service: TacticalMapService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TacticalMapService,
        { provide: TacticalSymbolsService, useValue: {} }
      ]
    });
    service = TestBed.inject(TacticalMapService);
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should export current placed symbols and object groups and planner settings', () => {
    const mockSymbols = [
      { type: 'Feature', properties: { id: 1, symbol: 'opora' }, geometry: { type: 'Point', coordinates: [1, 2] } }
    ];
    const mockGroups = [
      { id: 'group1', name: 'Район 1', elementIds: [1] }
    ];
    service.placedSymbols.set(mockSymbols);
    service.objectGroups.set(mockGroups);

    localStorage.setItem('topos_planner_tasks', JSON.stringify([{ id: 'task1', name: 'Task 1' }]));
    localStorage.setItem('topos_planner_devices', JSON.stringify([{ type: 'excavator', qty: 2 }]));
    localStorage.setItem('topos_planner_manpower', '45');
    localStorage.setItem('topos_planner_soilType', 'sand');

    const scenario = service.exportScenarioData();

    expect(scenario.type).toBe('topos_scenario');
    expect(scenario.placedSymbols).toEqual(mockSymbols);
    expect(scenario.objectGroups).toEqual(mockGroups);
    expect(scenario.plannerTasks).toEqual([{ id: 'task1', name: 'Task 1' }]);
    expect(scenario.plannerDevices).toEqual([{ type: 'excavator', qty: 2 }]);
    expect(scenario.plannerSettings.manpower).toBe(45);
    expect(scenario.plannerSettings.soilType).toBe('sand');
  });

  it('should import scenario and populate signals, localStorage and call update', () => {
    const mockScenario = {
      version: '1.0',
      type: 'topos_scenario',
      timestamp: new Date().toISOString(),
      placedSymbols: [
        { type: 'Feature', properties: { id: 2, symbol: 'blin' }, geometry: { type: 'Point', coordinates: [3, 4] } }
      ],
      objectGroups: [
        { id: 'group2', name: 'Район 2', elementIds: [2] }
      ],
      plannerTasks: [{ id: 'task2', name: 'Task 2' }],
      plannerDevices: [{ type: 'truck', qty: 1 }],
      plannerSettings: {
        manpower: 50,
        shifts: 3,
        soilType: 'clay',
        factorNight: 0.5,
        factorWinter: 0.6,
        workHoursPerDay: 8
      },
      mapPosition: {
        center: [27.5, 53.9],
        zoom: 12,
        bearing: 10,
        pitch: 15
      }
    };

    vi.spyOn(service as any, 'ensureSymbolColorImageLoadedForId').mockImplementation((_a: any, _b: any, _c: any, cb: any) => cb());
    vi.spyOn(service as any, 'ensureSymbolImageLoadedForId').mockImplementation((_a: any, _b: any, cb: any) => cb());
    const spyUpdate = vi.spyOn(service, 'updateTacticalSymbolsSource').mockImplementation(() => {});

    service.importScenarioData(mockScenario);

    expect(service.placedSymbols()).toEqual(mockScenario.placedSymbols);
    expect(service.objectGroups()).toEqual(mockScenario.objectGroups);

    expect(JSON.parse(localStorage.getItem('topos_planner_tasks') || '[]')).toEqual(mockScenario.plannerTasks);
    expect(JSON.parse(localStorage.getItem('topos_planner_devices') || '[]')).toEqual(mockScenario.plannerDevices);
    expect(localStorage.getItem('topos_planner_manpower')).toBe('50');
    expect(localStorage.getItem('topos_planner_soilType')).toBe('clay');
    expect(localStorage.getItem('topos_map_position')).toBe(JSON.stringify(mockScenario.mapPosition));
    expect(spyUpdate).toHaveBeenCalled();
  });
});
