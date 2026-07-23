import { describe, it, expect } from 'vitest';
import { MarchRouteService } from './march-route.service';

describe('MarchRouteService Snap-to-Road Orthogonal Projection', () => {
  const service = new MarchRouteService();

  it('should project point orthogonally onto line segment correctly', () => {
    const a: [number, number] = [0, 0];
    const b: [number, number] = [10, 0];
    const p: [number, number] = [5, 5];

    const projected = service.projectPointToSegment(p, a, b);
    expect(projected[0]).toBeCloseTo(5);
    expect(projected[1]).toBeCloseTo(0);
  });

  it('should clamp projected point within line segment bounds', () => {
    const a: [number, number] = [0, 0];
    const b: [number, number] = [10, 0];
    const p: [number, number] = [15, 5];

    const projected = service.projectPointToSegment(p, a, b);
    expect(projected[0]).toBe(10);
    expect(projected[1]).toBe(0);
  });
});
