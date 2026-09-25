import { Injectable } from '@angular/core';

export interface MineCatalogItem {
  id: string;
  name: string;
  category: 'ptm' | 'ppm' | 'special';
  typeLabel: string;
  actionLabel: string;
  weightTotalKg: number;
  weightExplosiveKg: number;
  defaultStepM: number;
  allowedStepsM: number[];
  rowDistanceM: number;
  standardDensityPerKm: number;
  killRadiusM?: number;
  sensorType: 'pressure' | 'tilt' | 'magnetic' | 'tripwire' | 'command';
}

export const MINES_DATABASE: MineCatalogItem[] = [
  {
    id: 'tm62m',
    name: 'ТМ-62М',
    category: 'ptm',
    typeLabel: 'Противотанковая противогусеничная',
    actionLabel: 'Нажимное (МВЧ-62 / МВД-62)',
    weightTotalKg: 9.5,
    weightExplosiveKg: 7.5,
    defaultStepM: 5.5,
    allowedStepsM: [4.0, 5.5, 6.0],
    rowDistanceM: 30,
    standardDensityPerKm: 750,
    sensorType: 'pressure'
  },
  {
    id: 'tm62p3',
    name: 'ТМ-62П3',
    category: 'ptm',
    typeLabel: 'Противотанковая неметаллическая',
    actionLabel: 'Нажимное (МВП-62)',
    weightTotalKg: 8.5,
    weightExplosiveKg: 7.0,
    defaultStepM: 5.5,
    allowedStepsM: [4.0, 5.5, 6.0],
    rowDistanceM: 30,
    standardDensityPerKm: 750,
    sensorType: 'pressure'
  },
  {
    id: 'tm72',
    name: 'ТМ-72',
    category: 'ptm',
    typeLabel: 'Противотанковая противоднищевая',
    actionLabel: 'Бесконтактный магнитный (МВН-72 / МВН-80)',
    weightTotalKg: 6.0,
    weightExplosiveKg: 2.5,
    defaultStepM: 5.5,
    allowedStepsM: [5.5, 8.0, 11.0],
    rowDistanceM: 30,
    standardDensityPerKm: 350,
    sensorType: 'magnetic'
  },
  {
    id: 'tm83',
    name: 'ТМ-83',
    category: 'ptm',
    typeLabel: 'Противотанковая противобортовая',
    actionLabel: 'Сейсмо-оптический неконтактный',
    weightTotalKg: 20.4,
    weightExplosiveKg: 9.6,
    defaultStepM: 25.0,
    allowedStepsM: [20.0, 25.0, 50.0],
    rowDistanceM: 50,
    standardDensityPerKm: 40,
    sensorType: 'tilt'
  },
  {
    id: 'tm89',
    name: 'ТМ-89',
    category: 'ptm',
    typeLabel: 'Противотанковая кумулятивная',
    actionLabel: 'Магнитный неконтактный',
    weightTotalKg: 11.5,
    weightExplosiveKg: 6.7,
    defaultStepM: 5.5,
    allowedStepsM: [5.5, 8.0, 11.0],
    rowDistanceM: 30,
    standardDensityPerKm: 350,
    sensorType: 'magnetic'
  },
  {
    id: 'pmn2',
    name: 'ПМН-2',
    category: 'ppm',
    typeLabel: 'Противопехотная фугасная',
    actionLabel: 'Нажимное фугасное',
    weightTotalKg: 0.4,
    weightExplosiveKg: 0.1,
    defaultStepM: 1.0,
    allowedStepsM: [1.0, 1.5, 2.0],
    rowDistanceM: 15,
    standardDensityPerKm: 2000,
    sensorType: 'pressure'
  },
  {
    id: 'pmn4',
    name: 'ПМН-4',
    category: 'ppm',
    typeLabel: 'Противопехотная фугасная малая',
    actionLabel: 'Нажимное фугасное',
    weightTotalKg: 0.14,
    weightExplosiveKg: 0.05,
    defaultStepM: 1.0,
    allowedStepsM: [1.0, 1.5, 2.0],
    rowDistanceM: 15,
    standardDensityPerKm: 2000,
    sensorType: 'pressure'
  },
  {
    id: 'pomz2m',
    name: 'ПОМЗ-2М',
    category: 'ppm',
    typeLabel: 'Противопехотная кругового поражения',
    actionLabel: 'Натяжное (МУВ-4)',
    weightTotalKg: 1.8,
    weightExplosiveKg: 0.075,
    defaultStepM: 4.0,
    allowedStepsM: [4.0, 6.0, 8.0],
    rowDistanceM: 15,
    standardDensityPerKm: 250,
    killRadiusM: 4,
    sensorType: 'tripwire'
  },
  {
    id: 'ozm72',
    name: 'ОЗМ-72',
    category: 'ppm',
    typeLabel: 'Противопехотная выпрыгивающая',
    actionLabel: 'Натяжное / Электродетонатор',
    weightTotalKg: 5.0,
    weightExplosiveKg: 0.66,
    defaultStepM: 15.0,
    allowedStepsM: [15.0, 20.0, 25.0],
    rowDistanceM: 20,
    standardDensityPerKm: 50,
    killRadiusM: 25,
    sensorType: 'tripwire'
  },
  {
    id: 'mon50',
    name: 'МОН-50',
    category: 'ppm',
    typeLabel: 'Противопехотная направленного поражения',
    actionLabel: 'Электро / Натяжное',
    weightTotalKg: 2.0,
    weightExplosiveKg: 0.7,
    defaultStepM: 15.0,
    allowedStepsM: [10.0, 15.0, 20.0],
    rowDistanceM: 25,
    standardDensityPerKm: 40,
    killRadiusM: 50,
    sensorType: 'command'
  },
  {
    id: 'mon90',
    name: 'МОН-90',
    category: 'ppm',
    typeLabel: 'Противопехотная направленного поражения',
    actionLabel: 'Электро / Радиоуправление',
    weightTotalKg: 12.1,
    weightExplosiveKg: 6.2,
    defaultStepM: 30.0,
    allowedStepsM: [20.0, 30.0, 40.0],
    rowDistanceM: 40,
    standardDensityPerKm: 20,
    killRadiusM: 90,
    sensorType: 'command'
  },
  {
    id: 'pfm1s',
    name: 'ПФМ-1С',
    category: 'ppm',
    typeLabel: 'Противопехотная кассетная (самоликвидация)',
    actionLabel: 'Гидростатическое нажимное',
    weightTotalKg: 0.08,
    weightExplosiveKg: 0.04,
    defaultStepM: 0.5,
    allowedStepsM: [0.5, 1.0],
    rowDistanceM: 10,
    standardDensityPerKm: 4000,
    sensorType: 'pressure'
  }
];

export type DeployMethodType = 'manual_sapper' | 'pmz4' | 'gmz2' | 'gmz3' | 'vsm1' | 'umz' | 'pkm';
export type SoilConditionType = 'ground' | 'sod' | 'snow';
export type UnitFormationType = 'squad' | 'platoon' | 'company';

export interface MinefieldCalcParams {
  mineId: string;
  frontLengthM: number;
  rowsCount: number;
  stepM: number;
  rowDistanceM?: number;
  deployMethod: DeployMethodType;
  soilCondition: SoilConditionType;
  unitFormation: UnitFormationType;
  manpowerCount?: number;
  vehiclesCount?: number;
  reloadDistanceKm: number;
  withUnremovablePenta?: boolean;
}

export interface MinefieldCalcResult {
  mine: MineCatalogItem;
  frontLengthM: number;
  rowsCount: number;
  stepM: number;
  depthM: number;
  areaHa: number;
  minesPerRow: number;
  totalMines: number;
  unremovableMinesCount: number;
  densityPerKm: number;
  killProbabilityPct: number;
  totalWeightTons: number;
  totalExplosiveKg: number;
  manpower: number;
  vehiclesCount: number;
  deployTimeHours: number;
  deployTimeFormatted: string;
  shuttleTrips: number;
  shuttleTimeHours: number;
  totalMissionTimeHours: number;
  totalMissionTimeFormatted: string;
  trucksNeeded: number;
}

@Injectable({
  providedIn: 'root'
})
export class MinefieldCalculationService {
  getCatalog(): MineCatalogItem[] {
    return MINES_DATABASE;
  }

  getMineById(id: string): MineCatalogItem {
    return MINES_DATABASE.find(m => m.id === id) || MINES_DATABASE[0];
  }

  calculate(params: MinefieldCalcParams): MinefieldCalcResult {
    const mine = this.getMineById(params.mineId);
    const frontM = Math.max(10, params.frontLengthM);
    const rows = Math.max(1, params.rowsCount);
    const step = Math.max(0.2, params.stepM);
    const rowDist = params.rowDistanceM && params.rowDistanceM > 0 ? params.rowDistanceM : mine.rowDistanceM;

    const minesPerRow = Math.ceil(frontM / step);
    const totalMines = rows * minesPerRow;
    const depthM = (rows - 1) * rowDist;
    const areaHa = (frontM * Math.max(rowDist, depthM)) / 10000;
    const densityPerKm = totalMines / (frontM / 1000);

    const unremovableMinesCount = params.withUnremovablePenta ? Math.ceil(totalMines * 0.05) : 0;
    const totalWeightTons = (totalMines * mine.weightTotalKg) / 1000;
    const totalExplosiveKg = totalMines * mine.weightExplosiveKg;

    const killProbabilityPct = this.calculateKillProbability(mine, densityPerKm, rows, step);

    let manpower = params.manpowerCount && params.manpowerCount > 0 ? params.manpowerCount : 8;
    if (!params.manpowerCount) {
      if (params.unitFormation === 'platoon') manpower = 24;
      if (params.unitFormation === 'company') manpower = 72;
    }

    let vehiclesCount = params.vehiclesCount && params.vehiclesCount > 0 ? params.vehiclesCount : 1;
    if (params.unitFormation === 'platoon' && params.deployMethod.startsWith('gmz')) {
      vehiclesCount = 3;
    }

    const { deployTimeHours, shuttleTrips, shuttleTimeHours, totalMissionTimeHours, trucksNeeded } =
      this.calculateTimeAndLogistics(params, totalMines, frontM, rows, manpower, vehiclesCount);

    return {
      mine,
      frontLengthM: frontM,
      rowsCount: rows,
      stepM: step,
      depthM,
      areaHa,
      minesPerRow,
      totalMines,
      unremovableMinesCount,
      densityPerKm,
      killProbabilityPct,
      totalWeightTons,
      totalExplosiveKg,
      manpower,
      vehiclesCount,
      deployTimeHours,
      deployTimeFormatted: this.formatHours(deployTimeHours),
      shuttleTrips,
      shuttleTimeHours,
      totalMissionTimeHours,
      totalMissionTimeFormatted: this.formatHours(totalMissionTimeHours),
      trucksNeeded
    };
  }

  private calculateKillProbability(mine: MineCatalogItem, densityPerKm: number, rows: number, step: number): number {
    if (mine.category === 'ptm') {
      const targetWidthM = 3.5;
      const coverageRatio = targetWidthM / step;
      const pSingleRow = Math.min(0.95, coverageRatio * 0.65);
      const pTotal = 1 - Math.pow(1 - pSingleRow, rows);
      return Math.min(98, Math.max(10, Math.round(pTotal * 100)));
    } else {
      const targetWidthM = 0.6;
      const coverageRatio = targetWidthM / step;
      const pSingleRow = Math.min(0.9, coverageRatio * 0.5);
      const pTotal = 1 - Math.pow(1 - pSingleRow, rows);
      return Math.min(95, Math.max(15, Math.round(pTotal * 100)));
    }
  }

  private calculateTimeAndLogistics(
    params: MinefieldCalcParams,
    totalMines: number,
    frontM: number,
    rows: number,
    manpower: number,
    vehiclesCount: number
  ): {
    deployTimeHours: number;
    shuttleTrips: number;
    shuttleTimeHours: number;
    totalMissionTimeHours: number;
    trucksNeeded: number;
  } {
    const trucksNeeded = Math.ceil(totalMines / 200);
    const reloadDist = Math.max(1, params.reloadDistanceKm);

    if (params.deployMethod === 'manual_sapper') {
      let ratePerManHr = 15;
      if (params.soilCondition === 'sod') ratePerManHr = 10;
      if (params.soilCondition === 'snow') ratePerManHr = 20;

      const unitRatePerHr = Math.max(1, manpower * ratePerManHr);
      const deployTimeHours = totalMines / unitRatePerHr;
      const shuttleTrips = Math.max(0, trucksNeeded - 1);
      const shuttleTimeHours = shuttleTrips * ((2 * reloadDist) / 30 + 0.5);
      const totalMissionTimeHours = deployTimeHours + shuttleTimeHours;

      return {
        deployTimeHours,
        shuttleTrips,
        shuttleTimeHours,
        totalMissionTimeHours,
        trucksNeeded
      };
    }

    if (params.deployMethod === 'gmz2' || params.deployMethod === 'gmz3') {
      const bkPerVehicle = params.deployMethod === 'gmz3' ? 208 : 178;
      const totalBk = bkPerVehicle * vehiclesCount;
      let speedKmh = 16;
      if (params.soilCondition === 'sod') speedKmh = 6;
      if (params.soilCondition === 'snow') speedKmh = 10;

      const totalDistanceKm = (rows * (frontM / 1000));
      const effectiveSpeed = speedKmh * vehiclesCount;
      const deployTimeHours = totalDistanceKm / effectiveSpeed;

      const totalRuns = Math.ceil(totalMines / totalBk);
      const shuttleTrips = Math.max(0, totalRuns - 1);
      const reloadMinutes = params.deployMethod === 'gmz3' ? 12 : 20;
      const shuttleTimeHours = shuttleTrips * ((2 * reloadDist) / 30 + reloadMinutes / 60);
      const totalMissionTimeHours = deployTimeHours + shuttleTimeHours;

      return {
        deployTimeHours,
        shuttleTrips,
        shuttleTimeHours,
        totalMissionTimeHours,
        trucksNeeded
      };
    }

    if (params.deployMethod === 'pmz4') {
      const bkPerVehicle = 200 * vehiclesCount;
      const speedKmh = params.soilCondition === 'sod' ? 4 : 8;
      const deployTimeHours = (rows * (frontM / 1000)) / (speedKmh * vehiclesCount);
      const totalRuns = Math.ceil(totalMines / bkPerVehicle);
      const shuttleTrips = Math.max(0, totalRuns - 1);
      const shuttleTimeHours = shuttleTrips * ((2 * reloadDist) / 25 + 0.4);
      const totalMissionTimeHours = deployTimeHours + shuttleTimeHours;

      return {
        deployTimeHours,
        shuttleTrips,
        shuttleTimeHours,
        totalMissionTimeHours,
        trucksNeeded
      };
    }

    if (params.deployMethod === 'umz') {
      const totalCassettes = Math.ceil(totalMines / 30);
      const umzCount = Math.max(1, vehiclesCount);
      const cassettesPerUmz = 180;
      const runs = Math.ceil(totalCassettes / (cassettesPerUmz * umzCount));
      const deployTimeHours = (runs * 0.25);
      const shuttleTrips = Math.max(0, runs - 1);
      const shuttleTimeHours = shuttleTrips * ((2 * reloadDist) / 40 + 1.0);
      const totalMissionTimeHours = deployTimeHours + shuttleTimeHours;

      return {
        deployTimeHours,
        shuttleTrips,
        shuttleTimeHours,
        totalMissionTimeHours,
        trucksNeeded: Math.ceil(totalCassettes / 180)
      };
    }

    const deployTimeHours = 0.5;
    return {
      deployTimeHours,
      shuttleTrips: 0,
      shuttleTimeHours: 0,
      totalMissionTimeHours: deployTimeHours,
      trucksNeeded
    };
  }

  formatHours(h: number): string {
    const totalMin = Math.round(h * 60);
    const hrs = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    if (hrs === 0) return `${mins} мин.`;
    return `${hrs} ч. ${mins} мин.`;
  }
}
