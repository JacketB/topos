import { describe, it, expect } from 'vitest';
import { MarchRouteService } from './march-route.service';

describe('MarchRouteService Turn Geometry Detection', () => {
  const service = new MarchRouteService();

  it('should detect 90-degree sharp turns correctly', () => {
    const coordsStraight: [number, number][] = [
      [27.5, 53.9],
      [27.6, 53.9],
      [27.7, 53.9]
    ];
    expect(service.countSharpTurns(coordsStraight)).toBe(0);

    const coordsSharpTurn: [number, number][] = [
      [27.5, 53.9],
      [27.6, 53.9],
      [27.6, 54.0]
    ];
    expect(service.countSharpTurns(coordsSharpTurn)).toBe(1);
  });
});
