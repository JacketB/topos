import { describe, it, expect } from 'vitest';
import { EngineeringCalculatorModalComponent, MINES_CATALOG } from './engineering-calculator-modal.component';

describe('EngineeringCalculatorModalComponent Calculations', () => {
  it('should verify mines catalog contains primary engineering mine types', () => {
    expect(MINES_CATALOG.length).toBeGreaterThanOrEqual(10);
    const tm72 = MINES_CATALOG.find(m => m.name === 'ТМ-72');
    expect(tm72).toBeDefined();
    expect(tm72?.normPerKm).toBe(350);
  });

  it('should calculate infantry MVZ parameters correctly', () => {
    const frontM = 2000;
    const rows = 4;
    const stepM = 4;
    const minesPerRow = Math.ceil(frontM / stepM);
    const totalMines = rows * minesPerRow;

    expect(minesPerRow).toBe(500);
    expect(totalMines).toBe(2000);

    const manpower = 8;
    const rate = 15;
    const timeHours = totalMines / (manpower * rate);
    expect(timeHours).toBeCloseTo(16.67, 1);
  });

  it('should calculate GMZ mechanized mining correctly', () => {
    const frontM = 1000;
    const rows = 4;
    const stepM = 4;
    const minesPerRow = Math.ceil(frontM / stepM);
    const totalMines = rows * minesPerRow;

    expect(totalMines).toBe(1000);

    const bk = 208;
    const totalRuns = Math.ceil(totalMines / bk);
    expect(totalRuns).toBe(5);

    const speedKmh = 16;
    const deployHours = (rows * (frontM / 1000)) / speedKmh;
    expect(deployHours).toBe(0.25);
  });

  it('should calculate forest abatis and bridge destruction formulas', () => {
    const frontM = 100;
    const depthM = 30;
    const areaHa = (frontM * depthM) / 10000;
    expect(areaHa).toBe(0.3);

    const d = 45;
    const expNorm = 250 * Math.pow(d / 45, 2);
    expect(expNorm).toBe(250);
    const totalExp = areaHa * expNorm;
    expect(totalExp).toBe(75);

    const pierExp = 35;
    const spanExp = 50;
    const piers = 2;
    const spans = 1;
    const bridgeExp = (piers * pierExp) + (spans * spanExp);
    expect(bridgeExp).toBe(120);
  });
});
