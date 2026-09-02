import { describe, it, expect } from 'vitest';
import { TrenchGeometryService } from './trench-geometry.service';

describe('TrenchGeometryService - Patrol Route Geometry', () => {
  const service = new TrenchGeometryService();

  it('should generate solid patrol route with forward and backward loops and arrowheads', () => {
    const center: [number, number] = [27.56, 53.9];
    const geom = service.generatePatrolGeometry(center, 45, 500, 100, false);

    expect(geom).toBeDefined();
    expect(geom.length).toBe(6);
    expect(geom[0].length).toBeGreaterThan(5);
    expect(geom[3].length).toBeGreaterThan(5);

    expect(geom[0][0][0]).toBeCloseTo(center[0], 2);
    expect(geom[0][0][1]).toBeCloseTo(center[1], 2);
  });

  it('should generate dashed patrol route geometry when isDashed is true', () => {
    const center: [number, number] = [27.56, 53.9];
    const geom = service.generatePatrolGeometry(center, 0, 400, 80, true);

    expect(geom).toBeDefined();
    expect(geom.length).toBeGreaterThan(6);
  });

  it('should support different patrol angles correctly and have opposite lateral turn offsets', () => {
    const center: [number, number] = [27.56, 53.9];
    const northGeom = service.generatePatrolGeometry(center, 0, 500, 25, false);
    const eastGeom = service.generatePatrolGeometry(center, 90, 500, 25, false);

    expect(northGeom[0][1][1]).toBeGreaterThan(center[1]);
    expect(eastGeom[0][1][0]).toBeGreaterThan(center[0]);

    const branch1EndLng = northGeom[0][northGeom[0].length - 1][0];
    const branch2EndLng = northGeom[3][northGeom[3].length - 1][0];
    expect(branch1EndLng).toBeGreaterThan(center[0]);
    expect(branch2EndLng).toBeLessThan(center[0]);
  });
});
