import { Injectable, signal, inject } from '@angular/core';
import { TrenchGeometryService } from './trench-geometry.service';

export type TacticalLineMode = 'none' | 'trench' | 'comm_open' | 'comm_covered' | 'wire' | 'march_route' | 'march';

@Injectable({
  providedIn: 'root'
})
export class TacticalDrawingService {
  private trenchGeometryService = inject(TrenchGeometryService);

  readonly activeLineMode = signal<TacticalLineMode>('none');
  readonly drawingLineCoords = signal<[number, number][]>([]);

  setLineMode(mode: TacticalLineMode) {
    this.activeLineMode.set(mode);
    this.drawingLineCoords.set([]);
  }

  addPoint(coord: [number, number]) {
    this.drawingLineCoords.update(coords => [...coords, coord]);
  }

  cancelDrawing() {
    this.activeLineMode.set('none');
    this.drawingLineCoords.set([]);
  }

  smoothLineCoords(coords: [number, number][], isClosed = false): [number, number][] {
    if (!coords || coords.length < 3) return coords;

    const result: [number, number][] = [];
    const n = coords.length;

    for (let i = 0; i < n; i++) {
      let p0: [number, number], p1: [number, number], p2: [number, number], p3: [number, number];

      if (isClosed) {
        p0 = coords[(i - 1 + n) % n];
        p1 = coords[i];
        p2 = coords[(i + 1) % n];
        p3 = coords[(i + 2) % n];
      } else {
        p0 = coords[Math.max(0, i - 1)];
        p1 = coords[i];
        p2 = coords[Math.min(n - 1, i + 1)];
        p3 = coords[Math.min(n - 1, i + 2)];
      }

      const steps = 6;
      for (let t = 0; t < (i === n - 1 && !isClosed ? 1 : steps); t++) {
        const u = t / steps;
        const pt = this.catmullRomPoint(p0, p1, p2, p3, u);
        result.push(pt);
      }
    }

    if (!isClosed && coords.length > 0) {
      result.push(coords[coords.length - 1]);
    }

    return result;
  }

  private catmullRomPoint(
    p0: [number, number],
    p1: [number, number],
    p2: [number, number],
    p3: [number, number],
    t: number
  ): [number, number] {
    const t2 = t * t;
    const t3 = t2 * t;

    const f0 = -0.5 * t3 + t2 - 0.5 * t;
    const f1 = 1.5 * t3 - 2.5 * t2 + 1.0;
    const f2 = -1.5 * t3 + 2.0 * t2 + 0.5 * t;
    const f3 = 0.5 * t3 - 0.5 * t2;

    const lng = p0[0] * f0 + p1[0] * f1 + p2[0] * f2 + p3[0] * f3;
    const lat = p0[1] * f0 + p1[1] * f1 + p2[1] * f2 + p3[1] * f3;

    return [lng, lat];
  }
}
