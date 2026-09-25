import { Injectable } from '@angular/core';

export type BreachingMethodType = 'ur77' | 'ur83p' | 'manual_sapper';
export type TrawlType = 'kmt7' | 'kmt8' | 'kmt10';
export type ObstacleType = 'forest_abatis' | 'stone_ruins' | 'anti_tank_ditch' | 'craters';
export type ClearingVehicleType = 'imr2' | 'imr3' | 'bat2';

export interface MineBreachParams {
  minefieldDepthM: number;
  breachesCount: number;
  method: BreachingMethodType;
  sapperUnitsCount?: number;
}

export interface MineBreachResult {
  method: BreachingMethodType;
  breachesCount: number;
  launchesPerBreach: number;
  totalCharges: number;
  vehiclesOrKitsNeeded: number;
  breachWidthM: number;
  breachLengthM: number;
  clearingTimeMin: number;
  clearingTimeFormatted: string;
  safetyDistanceM: number;
  manpower: number;
  notes: string;
}

export interface TrawlParams {
  combatVehiclesCount: number;
  trawlType: TrawlType;
  equippedPercent: number;
  breachLengthM: number;
}

export interface TrawlResult {
  trawlType: TrawlType;
  combatVehiclesCount: number;
  trawlsCount: number;
  trawlingSpeedKmh: number;
  transitTimeMin: number;
  transitTimeFormatted: string;
  clearedWidthM: number;
  residualRiskPct: number;
}

export interface ObstacleClearingParams {
  obstacleType: ObstacleType;
  obstacleLengthM: number;
  obstacleWidthM: number;
  obstacleHeightOrDepthM: number;
  vehicleType: ClearingVehicleType;
  vehiclesCount: number;
}

export interface ObstacleClearingResult {
  obstacleType: ObstacleType;
  vehicleType: ClearingVehicleType;
  vehiclesCount: number;
  volumeM3: number;
  machineHours: number;
  clearingTimeHours: number;
  clearingTimeFormatted: string;
  passageWidthM: number;
  productivityNorm: string;
}

@Injectable({
  providedIn: 'root'
})
export class ObstacleBreachingService {
  calculateMineBreach(params: MineBreachParams): MineBreachResult {
    const depthM = Math.max(10, params.minefieldDepthM);
    const count = Math.max(1, params.breachesCount);

    if (params.method === 'ur77') {
      const chargeLengthM = 90;
      const launchesPerBreach = Math.max(1, Math.ceil(depthM / chargeLengthM));
      const totalCharges = launchesPerBreach * count;
      const vehiclesNeeded = Math.max(1, Math.ceil(totalCharges / 2));
      const prepTimeMin = 15;
      const launchCycleMin = 12;
      const clearingTimeMin = prepTimeMin + launchesPerBreach * launchCycleMin;

      return {
        method: 'ur77',
        breachesCount: count,
        launchesPerBreach,
        totalCharges,
        vehiclesOrKitsNeeded: vehiclesNeeded,
        breachWidthM: 6.0,
        breachLengthM: launchesPerBreach * chargeLengthM,
        clearingTimeMin,
        clearingTimeFormatted: this.formatMinutes(clearingTimeMin),
        safetyDistanceM: 600,
        manpower: vehiclesNeeded * 2,
        notes: 'Заряды УЗП-77 (масса ВВ 725 кг). Взрывной способ сплошного разминирования.'
      };
    }

    if (params.method === 'ur83p') {
      const chargeLengthM = 90;
      const launchesPerBreach = Math.max(1, Math.ceil(depthM / chargeLengthM));
      const totalCharges = launchesPerBreach * count;
      const kitsNeeded = totalCharges;
      const prepTimeMin = 35;
      const launchCycleMin = 20;
      const clearingTimeMin = prepTimeMin + launchesPerBreach * launchCycleMin;

      return {
        method: 'ur83p',
        breachesCount: count,
        launchesPerBreach,
        totalCharges,
        vehiclesOrKitsNeeded: kitsNeeded,
        breachWidthM: 6.0,
        breachLengthM: launchesPerBreach * chargeLengthM,
        clearingTimeMin,
        clearingTimeFormatted: this.formatMinutes(clearingTimeMin),
        safetyDistanceM: 500,
        manpower: kitsNeeded * 4,
        notes: 'Переносная установка разминирования УР-83П на грунтовой позиции.'
      };
    }

    const sappers = params.sapperUnitsCount && params.sapperUnitsCount > 0 ? params.sapperUnitsCount * 8 : 8;
    const speedMetersPerHr = 15;
    const clearingTimeHours = depthM / speedMetersPerHr;
    const clearingTimeMin = Math.round(clearingTimeHours * 60);

    return {
      method: 'manual_sapper',
      breachesCount: count,
      launchesPerBreach: 0,
      totalCharges: count * Math.ceil(depthM / 5),
      vehiclesOrKitsNeeded: 0,
      breachWidthM: 1.5,
      breachLengthM: depthM,
      clearingTimeMin,
      clearingTimeFormatted: this.formatMinutes(clearingTimeMin),
      safetyDistanceM: 100,
      manpower: sappers,
      notes: 'Ручной поиск щупами, миноискателями ИМП-3 и накладными зарядами тротила.'
    };
  }

  calculateTrawls(params: TrawlParams): TrawlResult {
    const vehicles = Math.max(1, params.combatVehiclesCount);
    const pct = Math.min(100, Math.max(10, params.equippedPercent));
    const trawlsCount = Math.max(1, Math.ceil((vehicles * pct) / 100));
    const distM = Math.max(10, params.breachLengthM);

    let trawlingSpeedKmh = 12;
    let clearedWidthM = 1.6;
    let residualRiskPct = 5;

    if (params.trawlType === 'kmt7') {
      trawlingSpeedKmh = 10;
      clearedWidthM = 1.6;
      residualRiskPct = 3;
    } else if (params.trawlType === 'kmt8') {
      trawlingSpeedKmh = 14;
      clearedWidthM = 1.2;
      residualRiskPct = 6;
    } else if (params.trawlType === 'kmt10') {
      trawlingSpeedKmh = 15;
      clearedWidthM = 1.2;
      residualRiskPct = 7;
    }

    const transitHours = (distM / 1000) / trawlingSpeedKmh;
    const transitTimeMin = Math.max(1, Math.round(transitHours * 60));

    return {
      trawlType: params.trawlType,
      combatVehiclesCount: vehicles,
      trawlsCount,
      trawlingSpeedKmh,
      transitTimeMin,
      transitTimeFormatted: this.formatMinutes(transitTimeMin),
      clearedWidthM,
      residualRiskPct
    };
  }

  calculateObstacleClearing(params: ObstacleClearingParams): ObstacleClearingResult {
    const lenM = Math.max(1, params.obstacleLengthM);
    const widthM = Math.max(1, params.obstacleWidthM);
    const hM = Math.max(0.5, params.obstacleHeightOrDepthM);
    const count = Math.max(1, params.vehiclesCount);

    const volumeM3 = lenM * widthM * hM;
    let rateMetersPerHr = 250;
    let passageWidthM = 4.0;
    let productivityNorm = '250 м/ч';

    if (params.obstacleType === 'forest_abatis') {
      if (params.vehicleType === 'imr2' || params.vehicleType === 'imr3') {
        rateMetersPerHr = 350;
        productivityNorm = '350 м/ч (бульдозер + манипулятор)';
      } else {
        rateMetersPerHr = 250;
        productivityNorm = '250 м/ч (универсальный отвал БАТ-2)';
      }
    } else if (params.obstacleType === 'stone_ruins') {
      if (params.vehicleType === 'imr2' || params.vehicleType === 'imr3') {
        rateMetersPerHr = 180;
        productivityNorm = '180 м/ч (разборка завалов)';
      } else {
        rateMetersPerHr = 120;
        productivityNorm = '120 м/ч (расчистка пути)';
      }
    } else if (params.obstacleType === 'anti_tank_ditch') {
      const earthVolume = lenM * 3.5 * 2.0;
      const rateM3PerHr = params.vehicleType === 'bat2' ? 300 : 250;
      const machineHours = earthVolume / (rateM3PerHr * count);
      const clearingTimeHours = machineHours;
      return {
        obstacleType: params.obstacleType,
        vehicleType: params.vehicleType,
        vehiclesCount: count,
        volumeM3: earthVolume,
        machineHours,
        clearingTimeHours,
        clearingTimeFormatted: this.formatHours(clearingTimeHours),
        passageWidthM: 4.0,
        productivityNorm: `${rateM3PerHr} м³/ч засыпки рва`
      };
    } else {
      rateMetersPerHr = 200;
      productivityNorm = '200 м/ч засыпки воронок';
    }

    const machineHours = lenM / rateMetersPerHr;
    const clearingTimeHours = machineHours / count;

    return {
      obstacleType: params.obstacleType,
      vehicleType: params.vehicleType,
      vehiclesCount: count,
      volumeM3,
      machineHours,
      clearingTimeHours,
      clearingTimeFormatted: this.formatHours(clearingTimeHours),
      passageWidthM,
      productivityNorm
    };
  }

  private formatMinutes(m: number): string {
    const totalMin = Math.round(m);
    const hrs = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    if (hrs === 0) return `${mins} мин.`;
    return `${hrs} ч. ${mins} мин.`;
  }

  private formatHours(h: number): string {
    const totalMin = Math.round(h * 60);
    const hrs = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    if (hrs === 0) return `${mins} мин.`;
    return `${hrs} ч. ${mins} мин.`;
  }
}
