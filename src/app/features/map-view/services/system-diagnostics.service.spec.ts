import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SystemDiagnosticsService } from './system-diagnostics.service';
import { MinefieldCalculationService } from './minefield-calculation.service';
import { LocalAddressCacheService } from './local-address-cache.service';
import { DispatchRoutesService } from './dispatch-routes.service';

describe('SystemDiagnosticsService', () => {
  let service: SystemDiagnosticsService;

  beforeEach(() => {
    const minefield = new MinefieldCalculationService();
    const fortification: any = {
      calculateLineLength: vi.fn().mockReturnValue(125.0)
    };
    const addressCache = new LocalAddressCacheService();
    const dispatchRoutes = new DispatchRoutesService();
    const tacticalMap: any = {
      exportScenarioData: vi.fn().mockReturnValue({
        type: 'topos_scenario',
        placedSymbols: [],
        objectGroups: []
      })
    };
    const marchRoute: any = {
      calculateGraphRoute: vi.fn().mockResolvedValue({
        coordinates: [[25.3039, 53.0874], [25.3050, 53.0880], [25.3080, 53.0890]],
        routeStats: { totalDistanceKm: 0.6 }
      })
    };
    const terrain: any = {
      getApproxElevation: vi.fn().mockResolvedValue(155.0),
      getSlopeBearing: vi.fn().mockResolvedValue(12.5),
      getElevationProfile: vi.fn().mockResolvedValue({
        points: [{ coord: [25.3, 53.0], elevationM: 155 }],
        totalDistanceM: 500,
        minElevation: 150,
        maxElevation: 160
      })
    };

    service = new SystemDiagnosticsService(
      tacticalMap,
      marchRoute,
      terrain,
      dispatchRoutes,
      addressCache,
      minefield,
      fortification
    );
  });

  it('should initialize with diagnostic tests', () => {
    const tests = service.tests();
    expect(tests.length).toBeGreaterThanOrEqual(15);
    const summary = service.summary();
    expect(summary.total).toBe(tests.length);
    expect(summary.passed).toBe(0);
    expect(summary.running).toBe(0);
  });

  it('should generate text report', () => {
    const report = service.generateReportText();
    expect(report).toContain('ТОПОС ГИС');
    expect(report).toContain('ОТЧЕТ САМОДИАГНОСТИКИ');
  });

  it('should run calculator and storage diagnostic tests', async () => {
    await service.runSingleTest('calc-minefield');
    const tMine = service.tests().find(t => t.id === 'calc-minefield');
    expect(tMine?.status).toBe('success');

    await service.runSingleTest('calc-fortification');
    const tFort = service.tests().find(t => t.id === 'calc-fortification');
    expect(tFort?.status).toBe('success');

    await service.runSingleTest('storage-local');
    const tStorage = service.tests().find(t => t.id === 'storage-local');
    expect(tStorage?.status).toBe('success');

    await service.runSingleTest('dispatch-clustering');
    const tCluster = service.tests().find(t => t.id === 'dispatch-clustering');
    expect(tCluster?.status).toBe('success');

    await service.runSingleTest('dispatch-xlsx');
    const tXlsx = service.tests().find(t => t.id === 'dispatch-xlsx');
    expect(tXlsx?.status).toBe('success');
  });

  it('should run routing and terrain diagnostic tests', async () => {
    await service.runSingleTest('routing-pedestrian-slonim');
    const tPed = service.tests().find(t => t.id === 'routing-pedestrian-slonim');
    expect(tPed?.status).toBe('success');

    await service.runSingleTest('terrain-elevation');
    const tElev = service.tests().find(t => t.id === 'terrain-elevation');
    expect(tElev?.status).toBe('success');
  });
});
