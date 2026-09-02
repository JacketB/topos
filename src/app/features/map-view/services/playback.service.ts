import { Injectable, signal } from '@angular/core';
import { MarchRoute } from './march-route.service';

export interface PlaybackPosition {
  coords: [number, number];
  currentSpeed: number;
  currentRoadType: string;
  bearing: number;
}

@Injectable({
  providedIn: 'root'
})
export class PlaybackService {
  readonly isPlaying = signal<boolean>(false);
  readonly currentTimeHrs = signal<number>(0);
  readonly speedMultiplier = signal<number>(60); // Ускорение по умолчанию в 60 раз (1 сек реального времени = 1 мин виртуального)

  private animationFrameId: any = null;
  private lastTickTime = 0;

  getPositionAtTime(route: MarchRoute, timeHrs: number): PlaybackPosition {
    if (!route || !route.segments || route.segments.length === 0) {
      return { coords: [0, 0], currentSpeed: 0, currentRoadType: '', bearing: 0 };
    }

    const segments = route.segments;
    let accumulatedTime = 0;

    for (const seg of segments) {
      const duration = seg.durationHrs;
      if (duration === 0) continue;

      if (timeHrs >= accumulatedTime && timeHrs <= accumulatedTime + duration) {
        const segRatio = duration > 0 ? (timeHrs - accumulatedTime) / duration : 1;
        const geom = seg.geometry && seg.geometry.length >= 2 ? seg.geometry : [seg.from, seg.to];
        
        let totalLen = 0;
        const subLens: number[] = [];
        for (let i = 0; i < geom.length - 1; i++) {
          const dx = geom[i + 1][0] - geom[i][0];
          const dy = geom[i + 1][1] - geom[i][1];
          const len = Math.hypot(dx, dy);
          subLens.push(len);
          totalLen += len;
        }

        if (totalLen === 0) {
          return {
            coords: geom[0],
            currentSpeed: seg.speedKmH,
            currentRoadType: seg.roadType,
            bearing: 0
          };
        }

        const targetDist = totalLen * Math.max(0, Math.min(1, segRatio));
        let curDist = 0;
        let p1 = geom[0];
        let p2 = geom[geom.length - 1];
        let subRatio = 0;

        for (let i = 0; i < subLens.length; i++) {
          const subLen = subLens[i];
          if (targetDist >= curDist && targetDist <= curDist + subLen) {
            p1 = geom[i];
            p2 = geom[i + 1];
            subRatio = subLen > 0 ? (targetDist - curDist) / subLen : 0;
            break;
          }
          curDist += subLen;
        }

        const lng = p1[0] + (p2[0] - p1[0]) * subRatio;
        const lat = p1[1] + (p2[1] - p1[1]) * subRatio;
        const bearing = this.calculateBearing(p1, p2);

        return {
          coords: [lng, lat],
          currentSpeed: seg.speedKmH,
          currentRoadType: seg.roadType,
          bearing
        };
      }
      accumulatedTime += duration;
    }

    const lastSeg = segments[segments.length - 1];
    const lastGeom = lastSeg.geometry && lastSeg.geometry.length >= 2 ? lastSeg.geometry : [lastSeg.from, lastSeg.to];
    const endP1 = lastGeom[Math.max(0, lastGeom.length - 2)];
    const endP2 = lastGeom[lastGeom.length - 1];
    return {
      coords: endP2,
      currentSpeed: 0,
      currentRoadType: lastSeg.roadType,
      bearing: this.calculateBearing(endP1, endP2)
    };
  }

  private calculateBearing(p1: [number, number], p2: [number, number]): number {
    const rad = Math.PI / 180;
    const lat1 = p1[1] * rad;
    const lat2 = p2[1] * rad;
    const dLon = (p2[0] - p1[0]) * rad;
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    const angle = Math.atan2(y, x) * 180 / Math.PI;
    return (angle + 360) % 360;
  }

  /**
   * Запуск симуляции
   */
  start(totalDurationHrs: number) {
    if (this.isPlaying()) return;
    this.isPlaying.set(true);
    this.lastTickTime = performance.now();

    const update = () => {
      if (!this.isPlaying()) return;

      const now = performance.now();
      const deltaMs = now - this.lastTickTime;
      this.lastTickTime = now;

      // Перевод реального времени (мс) в виртуальное (часы)
      // deltaHrs = (deltaMs / 3600000) * speedMultiplier
      const deltaHrs = (deltaMs / 3600000) * this.speedMultiplier();
      const nextTime = Math.min(totalDurationHrs, this.currentTimeHrs() + deltaHrs);

      this.currentTimeHrs.set(nextTime);

      if (nextTime >= totalDurationHrs) {
        this.pause();
      } else {
        this.animationFrameId = requestAnimationFrame(update);
      }
    };

    this.animationFrameId = requestAnimationFrame(update);
  }

  /**
   * Пауза симуляции
   */
  pause() {
    this.isPlaying.set(false);
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Сброс симуляции к началу
   */
  reset() {
    this.pause();
    this.currentTimeHrs.set(0);
  }
}
