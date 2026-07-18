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

  /**
   * Вычисление положения маркера на маршруте в конкретный час виртуального времени
   */
  getPositionAtTime(route: MarchRoute, timeHrs: number): PlaybackPosition {
    if (!route || !route.segments || route.segments.length === 0) {
      return { coords: [0, 0], currentSpeed: 0, currentRoadType: '', bearing: 0 };
    }

    const segments = route.segments;
    let accumulatedTime = 0;

    for (const seg of segments) {
      const duration = seg.durationHrs;
      
      // Если движение по участку невозможно (duration === 0), маркер мгновенно его проскакивает
      if (duration === 0) continue;

      if (timeHrs >= accumulatedTime && timeHrs <= accumulatedTime + duration) {
        const ratio = duration > 0 ? (timeHrs - accumulatedTime) / duration : 1;
        const lng = seg.from[0] + (seg.to[0] - seg.from[0]) * ratio;
        const lat = seg.from[1] + (seg.to[1] - seg.from[1]) * ratio;
        
        const bearing = this.calculateBearing(seg.from, seg.to);

        return {
          coords: [lng, lat],
          currentSpeed: seg.speedKmH,
          currentRoadType: seg.roadType,
          bearing
        };
      }
      accumulatedTime += duration;
    }

    // Если время вышло за пределы маршрута, возвращаем конечную точку
    const lastSeg = segments[segments.length - 1];
    return {
      coords: lastSeg.to,
      currentSpeed: 0,
      currentRoadType: lastSeg.roadType,
      bearing: this.calculateBearing(lastSeg.from, lastSeg.to)
    };
  }

  /**
   * Вычисление направления угла поворота (bearing) между точками в градусах
   */
  private calculateBearing(p1: [number, number], p2: [number, number]): number {
    const rad = Math.PI / 180;
    const lat1 = p1[1] * rad;
    const lat2 = p2[1] * rad;
    const dLon = (p2[0] - p1[0]) * rad;
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    const angle = Math.atan2(y, x) * 180 / Math.PI;
    // Корректируем на +90 градусов для разворота на 180 градусов (движение капотом вперед)
    return (angle + 90 + 360) % 360;
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
