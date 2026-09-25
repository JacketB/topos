import { describe, it, expect, beforeEach } from 'vitest';
import { MinefieldFormularService } from './minefield-formular.service';
import { MinefieldCalculationService } from './minefield-calculation.service';
import { CoordinateConverterService } from '../../../core/services/coordinate-converter.service';

describe('MinefieldFormularService', () => {
  let service: MinefieldFormularService;
  let minefieldSvc: MinefieldCalculationService;

  beforeEach(() => {
    service = new MinefieldFormularService(new CoordinateConverterService());
    minefieldSvc = new MinefieldCalculationService();
  });

  it('should generate valid formular data', () => {
    const calc = minefieldSvc.calculate({
      mineId: 'tm62m',
      frontLengthM: 1200,
      rowsCount: 4,
      stepM: 5.5,
      deployMethod: 'gmz3',
      soilCondition: 'ground',
      unitFormation: 'platoon',
      vehiclesCount: 3,
      reloadDistanceKm: 15,
      withUnremovablePenta: true
    });

    const formular = service.generateDefaultFormular(calc, 53.9006, 27.5590);
    expect(formular.corners.length).toBe(4);
    expect(formular.landmarks.length).toBeGreaterThanOrEqual(2);
    expect(formular.hasAntiHandlingDevices).toBe(true);
    expect(formular.antiHandlingCount).toBeGreaterThan(0);
  });

  it('should generate printable HTML document', () => {
    const calc = minefieldSvc.calculate({
      mineId: 'tm72',
      frontLengthM: 1000,
      rowsCount: 3,
      stepM: 5.5,
      deployMethod: 'gmz3',
      soilCondition: 'ground',
      unitFormation: 'platoon',
      vehiclesCount: 3,
      reloadDistanceKm: 12
    });

    const formular = service.generateDefaultFormular(calc, 53.9006, 27.5590);
    const html = service.generatePrintableHtml(formular);
    expect(html).toContain('ФОРМУЛЯР МИННОГО ПОЛЯ');
    expect(html).toContain('ТМ-72');
    expect(html).toContain('СК-42');
  });
});
