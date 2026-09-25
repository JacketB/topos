import { Injectable, inject } from '@angular/core';
import { MinefieldCalculationService, DeployMethodType, SoilConditionType } from './minefield-calculation.service';

export interface PozCalcParams {
  enemySpeedKmh: number;
  enemyDistanceKm: number;
  pozMarchDistanceKm: number;
  pozMarchSpeedKmh: number;
  pozDecisionTimeMin: number;
  pozReconTimeMin: number;
  pozVehicleType: 'gmz3' | 'umz' | 'pmz4';
  pozVehicleCount: number;
  frontLengthM: number;
  rowsCount: number;
  stepM: number;
  mineId: string;
  soilCondition: SoilConditionType;
  reloadDistanceKm: number;
}

export interface PozBoundaryTiming {
  boundaryIndex: number;
  distanceFromEnemyKm: number;
  enemyArrivalMin: number;
  enemyArrivalClock: string;
  pozReadyMin: number;
  pozReadyClock: string;
  isGuaranteed: boolean;
  marginMin: number;
}

export interface PozCalcResult {
  enemyApproachTimeMin: number;
  enemyApproachFormatted: string;
  pozDecisionTimeMin: number;
  pozMarchTimeMin: number;
  pozReconTimeMin: number;
  pozDeployTimeMin: number;
  pozTotalReadyTimeMin: number;
  pozTotalReadyFormatted: string;
  isPreemptionGuaranteed: boolean;
  timeMarginMin: number;
  timeMarginFormatted: string;
  minSafeEnemyDistanceKm: number;
  totalMines: number;
  densityPerKm: number;
  killProbabilityPct: number;
  boundaries: PozBoundaryTiming[];
  timeline: {
    stepIndex: number;
    title: string;
    durationMin: number;
    cumulativeMin: number;
    clockFormatted: string;
    description: string;
  }[];
}

@Injectable({
  providedIn: 'root'
})
export class PozCalculationService {
  private minefieldSvc: MinefieldCalculationService;

  constructor(minefieldSvc?: MinefieldCalculationService) {
    this.minefieldSvc = minefieldSvc || new MinefieldCalculationService();
  }

  calculate(params: PozCalcParams, baseStartTimeStr: string = '08:00'): PozCalcResult {
    const enemySpeed = Math.max(5, params.enemySpeedKmh);
    const enemyDist = Math.max(1, params.enemyDistanceKm);
    const enemyApproachTimeMin = (enemyDist / enemySpeed) * 60;

    const pozMarchDist = Math.max(0.5, params.pozMarchDistanceKm);
    const pozMarchSpeed = Math.max(10, params.pozMarchSpeedKmh);
    const pozMarchTimeMin = (pozMarchDist / pozMarchSpeed) * 60;

    const pozDecisionTimeMin = Math.max(1, params.pozDecisionTimeMin);
    const pozReconTimeMin = Math.max(1, params.pozReconTimeMin);

    let deployMethod: DeployMethodType = 'gmz3';
    if (params.pozVehicleType === 'umz') deployMethod = 'umz';
    if (params.pozVehicleType === 'pmz4') deployMethod = 'pmz4';

    const mfResult = this.minefieldSvc.calculate({
      mineId: params.mineId || 'tm72',
      frontLengthM: params.frontLengthM,
      rowsCount: params.rowsCount,
      stepM: params.stepM,
      deployMethod,
      soilCondition: params.soilCondition,
      unitFormation: 'platoon',
      vehiclesCount: params.pozVehicleCount,
      reloadDistanceKm: params.reloadDistanceKm
    });

    const pozDeployTimeMin = mfResult.deployTimeHours * 60;
    const pozTotalReadyTimeMin = pozDecisionTimeMin + pozMarchTimeMin + pozReconTimeMin + pozDeployTimeMin;
    const isPreemptionGuaranteed = pozTotalReadyTimeMin <= enemyApproachTimeMin;
    const timeMarginMin = enemyApproachTimeMin - pozTotalReadyTimeMin;
    const minSafeEnemyDistanceKm = (pozTotalReadyTimeMin / 60) * enemySpeed;

    const baseStartMin = this.parseClockToMinutes(baseStartTimeStr);

    const timeline = [
      {
        stepIndex: 1,
        title: 'Получение боевого распоряжения (T0)',
        durationMin: 0,
        cumulativeMin: 0,
        clockFormatted: this.formatMinutesToClock(baseStartMin),
        description: 'Доведение задачи до командира ПОЗ'
      },
      {
        stepIndex: 2,
        title: 'Принятие решения и отдача приказа (T1)',
        durationMin: pozDecisionTimeMin,
        cumulativeMin: pozDecisionTimeMin,
        clockFormatted: this.formatMinutesToClock(baseStartMin + pozDecisionTimeMin),
        description: 'Оценка танкоопасных направлений, расчет сил'
      },
      {
        stepIndex: 3,
        title: 'Выдвижение колонны ПОЗ на рубеж (T2)',
        durationMin: Math.round(pozMarchTimeMin),
        cumulativeMin: Math.round(pozDecisionTimeMin + pozMarchTimeMin),
        clockFormatted: this.formatMinutesToClock(baseStartMin + pozDecisionTimeMin + pozMarchTimeMin),
        description: `Марш ${pozMarchDist.toFixed(1)} км со скоростью ${pozMarchSpeed} км/ч`
      },
      {
        stepIndex: 4,
        title: 'Рекогносцировка и разбивка рубежа (T3)',
        durationMin: pozReconTimeMin,
        cumulativeMin: Math.round(pozDecisionTimeMin + pozMarchTimeMin + pozReconTimeMin),
        clockFormatted: this.formatMinutesToClock(baseStartMin + pozDecisionTimeMin + pozMarchTimeMin + pozReconTimeMin),
        description: 'Привязка створов минирования к ориентирам'
      },
      {
        stepIndex: 5,
        title: 'Установка заграждения (ГОТОВНОСТЬ РУБЕЖА)',
        durationMin: Math.round(pozDeployTimeMin),
        cumulativeMin: Math.round(pozTotalReadyTimeMin),
        clockFormatted: this.formatMinutesToClock(baseStartMin + pozTotalReadyTimeMin),
        description: `Раскладка ${mfResult.totalMines} мин по фронту ${params.frontLengthM} м`
      }
    ];

    const boundaries: PozBoundaryTiming[] = [
      {
        boundaryIndex: 1,
        distanceFromEnemyKm: enemyDist,
        enemyArrivalMin: Math.round(enemyApproachTimeMin),
        enemyArrivalClock: this.formatMinutesToClock(baseStartMin + enemyApproachTimeMin),
        pozReadyMin: Math.round(pozTotalReadyTimeMin),
        pozReadyClock: this.formatMinutesToClock(baseStartMin + pozTotalReadyTimeMin),
        isGuaranteed: isPreemptionGuaranteed,
        marginMin: Math.round(timeMarginMin)
      },
      {
        boundaryIndex: 2,
        distanceFromEnemyKm: enemyDist + 6,
        enemyArrivalMin: Math.round(((enemyDist + 6) / enemySpeed) * 60),
        enemyArrivalClock: this.formatMinutesToClock(baseStartMin + ((enemyDist + 6) / enemySpeed) * 60),
        pozReadyMin: Math.round(pozTotalReadyTimeMin + 25),
        pozReadyClock: this.formatMinutesToClock(baseStartMin + pozTotalReadyTimeMin + 25),
        isGuaranteed: ((enemyDist + 6) / enemySpeed) * 60 >= pozTotalReadyTimeMin + 25,
        marginMin: Math.round(((enemyDist + 6) / enemySpeed) * 60 - (pozTotalReadyTimeMin + 25))
      },
      {
        boundaryIndex: 3,
        distanceFromEnemyKm: enemyDist + 12,
        enemyArrivalMin: Math.round(((enemyDist + 12) / enemySpeed) * 60),
        enemyArrivalClock: this.formatMinutesToClock(baseStartMin + ((enemyDist + 12) / enemySpeed) * 60),
        pozReadyMin: Math.round(pozTotalReadyTimeMin + 50),
        pozReadyClock: this.formatMinutesToClock(baseStartMin + pozTotalReadyTimeMin + 50),
        isGuaranteed: ((enemyDist + 12) / enemySpeed) * 60 >= pozTotalReadyTimeMin + 50,
        marginMin: Math.round(((enemyDist + 12) / enemySpeed) * 60 - (pozTotalReadyTimeMin + 50))
      }
    ];

    return {
      enemyApproachTimeMin,
      enemyApproachFormatted: this.formatMinutes(enemyApproachTimeMin),
      pozDecisionTimeMin,
      pozMarchTimeMin,
      pozReconTimeMin,
      pozDeployTimeMin,
      pozTotalReadyTimeMin,
      pozTotalReadyFormatted: this.formatMinutes(pozTotalReadyTimeMin),
      isPreemptionGuaranteed,
      timeMarginMin,
      timeMarginFormatted: this.formatMinutes(Math.abs(timeMarginMin)),
      minSafeEnemyDistanceKm,
      totalMines: mfResult.totalMines,
      densityPerKm: mfResult.densityPerKm,
      killProbabilityPct: mfResult.killProbabilityPct,
      boundaries,
      timeline
    };
  }

  private parseClockToMinutes(clockStr: string): number {
    const parts = (clockStr || '08:00').split(':').map(Number);
    const h = isNaN(parts[0]) ? 8 : parts[0];
    const m = isNaN(parts[1]) ? 0 : parts[1];
    return h * 60 + m;
  }

  private formatMinutesToClock(totalMin: number): string {
    const norm = Math.round(totalMin) % 1440;
    const pos = norm < 0 ? norm + 1440 : norm;
    const h = Math.floor(pos / 60);
    const m = pos % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  private formatMinutes(m: number): string {
    const totalMin = Math.round(m);
    const hrs = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    if (hrs === 0) return `${mins} мин.`;
    return `${hrs} ч. ${mins} мин.`;
  }
}
