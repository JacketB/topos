import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Injector, runInInjectionContext, signal, ɵChangeDetectionScheduler, ɵEffectScheduler } from '@angular/core';
import { TacticalMapService } from './tactical-map.service';
import { TrenchGeometryService } from './trench-geometry.service';
import { TerrainService } from './terrain.service';
import { TacticalDrawingService } from './tactical-drawing.service';
import { TacticalSymbolsManagerService } from './tactical-symbols-manager.service';
import { ImageOverlayService } from './image-overlay.service';

const storageMap: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (k: string) => storageMap[k] ?? null,
  setItem: (k: string, v: string) => { storageMap[k] = String(v); },
  removeItem: (k: string) => { delete storageMap[k]; },
  clear: () => { Object.keys(storageMap).forEach(k => delete storageMap[k]); }
};

Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
  configurable: true
});

const mockScheduler = {
  notify: () => {},
  runningTick: false,
  schedule: () => {},
  add: () => ({ destroy: () => {} }),
  remove: () => {}
};

describe('TacticalMapService - Export/Import Scenario', () => {
  let service: TacticalMapService;

  beforeEach(() => {
    mockLocalStorage.clear();
    const injector = Injector.create({
      providers: [
        { provide: ɵChangeDetectionScheduler, useValue: mockScheduler },
        { provide: ɵEffectScheduler, useValue: mockScheduler },
        {
          provide: TrenchGeometryService,
          useValue: new TrenchGeometryService()
        },
        { provide: TerrainService, useValue: {} },
        {
          provide: TacticalDrawingService,
          useValue: {
            activeLineMode: signal(null),
            drawingLineCoords: signal([]),
            snapPointToRoute: (p: any) => p,
            finishDrawing: () => {}
          }
        },
        { provide: TacticalSymbolsManagerService, useValue: {} },
        {
          provide: ImageOverlayService,
          useValue: {
            overlays: signal([]),
            loadOverlays: () => {}
          }
        }
      ]
    });

    service = runInInjectionContext(injector, () => new TacticalMapService());
  });

  afterEach(() => {
    mockLocalStorage.clear();
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

    mockLocalStorage.setItem('topos_planner_tasks', JSON.stringify([{ id: 'task1', name: 'Task 1' }]));
    mockLocalStorage.setItem('topos_planner_devices', JSON.stringify([{ type: 'excavator', qty: 2 }]));
    mockLocalStorage.setItem('topos_planner_manpower', '45');
    mockLocalStorage.setItem('topos_planner_soilType', 'sand');

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

    expect(JSON.parse(mockLocalStorage.getItem('topos_planner_tasks') || '[]')).toEqual(mockScenario.plannerTasks);
    expect(JSON.parse(mockLocalStorage.getItem('topos_planner_devices') || '[]')).toEqual(mockScenario.plannerDevices);
    expect(mockLocalStorage.getItem('topos_planner_manpower')).toBe('50');
    expect(mockLocalStorage.getItem('topos_planner_soilType')).toBe('clay');
    expect(mockLocalStorage.getItem('topos_map_position')).toBe(JSON.stringify(mockScenario.mapPosition));
    expect(spyUpdate).toHaveBeenCalled();
  });

  it('should include med_mp and patrol_pair in TACTICAL_SYMBOLS catalogue', async () => {
    const { TACTICAL_SYMBOLS } = await import('../consts/tactical-symbols.const');
    const medical = TACTICAL_SYMBOLS.find(c => c.id === 'medical');
    expect(medical).toBeDefined();
    const mp = medical?.symbols.find(s => s.id === 'med_mp');
    expect(mp).toBeDefined();
    expect(mp?.name).toBe('МП');
    expect(mp?.symbol).toBe('med_mp');

    const command = TACTICAL_SYMBOLS.find(c => c.id === 'command_comm');
    expect(command).toBeDefined();
    const patrol = command?.symbols.find(s => s.id === 'patrol_pair');
    expect(patrol).toBeDefined();
    expect(patrol?.name).toBe('Парный патруль');
    expect(patrol?.symbol).toBe('patrol_pair');
    expect(patrol?.hasPatrol).toBe(true);
  });

  it('should generate patrol line features for placed symbols with hasPatrol: true', () => {
    const symbolWithPatrol = {
      type: 'Feature',
      properties: {
        id: 9999,
        symbol: 'patrol_pair',
        hasPatrol: true,
        patrolLength: 400,
        patrolAngle: 45,
        patrolStyle: 'solid'
      },
      geometry: {
        type: 'Point',
        coordinates: [27.5, 53.9]
      }
    };

    const features = service.getAllFeaturesWithPatrol([symbolWithPatrol]);
    expect(features.length).toBe(2);
    const patrolLine = features.find(f => f.properties.id === 'patrol_9999');
    expect(patrolLine).toBeDefined();
    expect(patrolLine?.geometry.type).toBe('MultiLineString');
    expect(patrolLine?.properties.isPatrolLine).toBe(true);
    expect(patrolLine?.properties.parentId).toBe(9999);
  });

  it('should delete all selected symbols when deleteSelectedPlacedSymbols is called', () => {
    const s1 = { type: 'Feature', properties: { id: 101, name: 'S1' }, geometry: { type: 'Point', coordinates: [27, 53] } };
    const s2 = { type: 'Feature', properties: { id: 102, name: 'S2' }, geometry: { type: 'Point', coordinates: [28, 54] } };
    const s3 = { type: 'Feature', properties: { id: 103, name: 'S3' }, geometry: { type: 'Point', coordinates: [29, 55] } };
    
    service.placedSymbols.set([s1, s2, s3]);
    service.selectedPlacedSymbols.set([s1, s2]);

    vi.spyOn(service, 'updateTacticalSymbolsSource').mockImplementation(() => {});
    vi.spyOn(service, 'updateLinearVerticesSource').mockImplementation(() => {});
    vi.spyOn(service, 'syncTextBoxMarkers').mockImplementation(() => {});

    service.deleteSelectedPlacedSymbols();

    expect(service.placedSymbols().length).toBe(1);
    expect(service.placedSymbols()[0].properties.id).toBe(103);
    expect(service.selectedPlacedSymbols().length).toBe(0);
  });

  it('should toggle group visibility and update symbol hidden state', () => {
    const s1 = { type: 'Feature', properties: { id: 201, hidden: false }, geometry: { type: 'Point', coordinates: [27, 53] } };
    const s2 = { type: 'Feature', properties: { id: 202, hidden: false }, geometry: { type: 'Point', coordinates: [28, 54] } };
    const group = { id: 'grp_1', name: 'Район 1', elementIds: [201, 202] };

    service.placedSymbols.set([s1, s2]);
    service.objectGroups.set([group]);

    vi.spyOn(service, 'updateTacticalSymbolsSource').mockImplementation(() => {});
    vi.spyOn(service, 'updateLinearVerticesSource').mockImplementation(() => {});
    vi.spyOn(service, 'syncTextBoxMarkers').mockImplementation(() => {});

    expect(service.isGroupHidden('grp_1')).toBe(false);

    service.toggleGroupVisibility('grp_1');
    expect(service.isGroupHidden('grp_1')).toBe(true);
    expect(service.placedSymbols().every(s => s.properties.hidden)).toBe(true);

    service.toggleGroupVisibility('grp_1');
    expect(service.isGroupHidden('grp_1')).toBe(false);
    expect(service.placedSymbols().every(s => !s.properties.hidden)).toBe(true);
  });

  it('should undo and redo tactical map state changes with undo/redo methods', () => {
    const s1 = { type: 'Feature', properties: { id: 301, name: 'Symbol 1' }, geometry: { type: 'Point', coordinates: [27, 53] } };
    const s2 = { type: 'Feature', properties: { id: 302, name: 'Symbol 2' }, geometry: { type: 'Point', coordinates: [28, 54] } };

    service.placedSymbols.set([s1]);

    vi.spyOn(service, 'updateTacticalSymbolsSource').mockImplementation(() => {});
    vi.spyOn(service, 'updateLinearVerticesSource').mockImplementation(() => {});
    vi.spyOn(service, 'syncTextBoxMarkers').mockImplementation(() => {});

    service.pushHistoryState();
    service.placedSymbols.set([s1, s2]);

    expect(service.placedSymbols().length).toBe(2);

    const undone = service.undo();
    expect(undone).toBe(true);
    expect(service.placedSymbols().length).toBe(1);
    expect(service.placedSymbols()[0].properties.id).toBe(301);

    const redone = service.redo();
    expect(redone).toBe(true);
    expect(service.placedSymbols().length).toBe(2);
  });
});
