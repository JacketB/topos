import { describe, it, expect, vi } from 'vitest';
import { SystemDiagnosticsService } from '../../services/system-diagnostics.service';

describe('SystemDiagnosticsModalComponent Logic', () => {
  it('should verify initial diagnostic suite categorization', () => {
    const service = new SystemDiagnosticsService();
    const tests = service.tests();
    const suiteIds = new Set(tests.map(t => t.suiteId));

    expect(suiteIds.has('database')).toBe(true);
    expect(suiteIds.has('routing')).toBe(true);
    expect(suiteIds.has('cartography')).toBe(true);
    expect(suiteIds.has('terrain')).toBe(true);
    expect(suiteIds.has('dispatch')).toBe(true);
    expect(suiteIds.has('storage')).toBe(true);
    expect(suiteIds.has('calculators')).toBe(true);
    expect(suiteIds.has('export')).toBe(true);
  });

  it('should format diagnostic report with all suites', () => {
    const service = new SystemDiagnosticsService();
    const report = service.generateReportText();

    expect(report).toContain('БАЗА ДАННЫХ АДРЕСОВ SQLITE');
    expect(report).toContain('ДОРОЖНЫЙ ГРАФ И МАРШРУТИЗАЦИЯ');
    expect(report).toContain('КАРТОГРАФИЧЕСКИЙ ДВИЖОК И WEBGL');
    expect(report).toContain('ЦИФРОВАЯ МАТРИЦА РЕЛЬЕФА DEM');
    expect(report).toContain('МАРШРУТЫ ОПОВЕЩЕНИЯ (VRP)');
    expect(report).toContain('ХРАНИЛИЩЕ ДАННЫХ И СЦЕНАРИЕВ');
    expect(report).toContain('ИНЖЕНЕРНО-ТАКТИЧЕСКИЕ КАЛЬКУЛЯТОРЫ');
    expect(report).toContain('ЭКСПОРТ КАРТ ВЫСОКОГО РАЗРЕШЕНИЯ');
  });

  it('should calculate summary metrics accurately', () => {
    const service = new SystemDiagnosticsService();
    const sum = service.summary();

    expect(sum.total).toBe(service.tests().length);
    expect(sum.passed + sum.warnings + sum.failed + sum.running + sum.pending).toBe(sum.total);
    expect(service.progressPercent()).toBe(0);
  });
});
