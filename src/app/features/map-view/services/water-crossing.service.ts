import { Injectable } from '@angular/core';

export type CrossingModeType = 'amphibious_pts' | 'ferry_pmp' | 'floating_bridge_pmp' | 'mechanized_bridge_tmm' | 'deep_wading_opvt';

export interface WaterCrossingParams {
  crossingMode: CrossingModeType;
  riverWidthM: number;
  riverDepthM: number;
  currentSpeedMs: number;
  banksSlopeDeg: number;
  combatVehiclesCount: number;
  trucksCount: number;
  personnelCount: number;
  transportersCount?: number;
  ferryType?: '40t' | '60t' | '80t' | '170t';
  ferriesCount?: number;
  tmmSetsCount?: number;
}

export interface WaterCrossingResult {
  crossingMode: CrossingModeType;
  modeTitle: string;
  riverWidthM: number;
  riverDepthM: number;
  currentSpeedMs: number;
  equipmentNeeded: {
    name: string;
    qty: number;
    unit: string;
  }[];
  assemblyTimeMin: number;
  assemblyTimeFormatted: string;
  cycleTimeMin: number;
  totalTripsCount: number;
  totalDurationHours: number;
  totalDurationFormatted: string;
  throughputPerHour: string;
  isFeasible: boolean;
  warnings: string[];
}

@Injectable({
  providedIn: 'root'
})
export class WaterCrossingService {
  calculate(params: WaterCrossingParams): WaterCrossingResult {
    const widthM = Math.max(10, params.riverWidthM);
    const depthM = Math.max(0.5, params.riverDepthM);
    const speedMs = Math.max(0.1, params.currentSpeedMs);
    const slopeDeg = Math.max(1, params.banksSlopeDeg);
    const tanks = Math.max(0, params.combatVehiclesCount);
    const trucks = Math.max(0, params.trucksCount);
    const men = Math.max(0, params.personnelCount);

    const warnings: string[] = [];
    if (speedMs > 2.5) {
      warnings.push('Скорость течения превышает 2.5 м/с — требуется заякорение и усиление катерами БМК.');
    }
    if (slopeDeg > 25) {
      warnings.push('Крутизна берега более 25° — требуется предварительная срезка берегов путепрокладчиками БАТ-2 / ИМР-2.');
    }

    if (params.crossingMode === 'amphibious_pts') {
      const pts = Math.max(1, params.transportersCount || 3);
      const tripsForTanks = 0;
      if (tanks > 0) {
        warnings.push('Транспортеры ПТС-2/4 не перевозят основные танки (масса > 10 т).');
      }
      const tripsForTrucks = Math.ceil(trucks / 1);
      const tripsForMen = Math.ceil(men / 75);
      const totalTrips = (tripsForTrucks + tripsForMen);

      const waterSpeedMs = 3.0;
      const crossingTimeMin = (widthM / waterSpeedMs) / 60;
      const loadUnloadMin = 8.0;
      const cycleTimeMin = Math.max(5, Math.round(2 * crossingTimeMin + loadUnloadMin));

      const cyclesNeeded = Math.ceil(totalTrips / pts);
      const totalDurationHours = (cyclesNeeded * cycleTimeMin) / 60;

      return {
        crossingMode: 'amphibious_pts',
        modeTitle: 'Десантная переправа на плавающих транспортерах (ПТС-2 / ПТС-4)',
        riverWidthM: widthM,
        riverDepthM: depthM,
        currentSpeedMs: speedMs,
        equipmentNeeded: [
          { name: 'Плавающие транспортеры ПТС-2 / ПТС-4', qty: pts, unit: 'ед.' },
          { name: 'Экипажи транспортеров', qty: pts * 2, unit: 'чел.' },
          { name: 'Тягач эвакуации на берегу (БРЭМ-1)', qty: 1, unit: 'ед.' }
        ],
        assemblyTimeMin: 15,
        assemblyTimeFormatted: '15 мин.',
        cycleTimeMin,
        totalTripsCount: totalTrips,
        totalDurationHours,
        totalDurationFormatted: this.formatHours(totalDurationHours),
        throughputPerHour: `${Math.round((pts * 60) / cycleTimeMin)} рейсов/ч (${Math.round((pts * 60) / cycleTimeMin * 1.5)} авт/ч)`,
        isFeasible: true,
        warnings
      };
    }

    if (params.crossingMode === 'ferry_pmp') {
      const ferryType = params.ferryType || '60t';
      const ferries = Math.max(1, params.ferriesCount || 2);

      let pontoonsPerFerry = 3;
      let bmkPerFerry = 1;
      let assemblyMin = 12;
      let capacityTanks = 1;
      let capacityTrucks = 3;

      if (ferryType === '40t') {
        pontoonsPerFerry = 2;
        bmkPerFerry = 1;
        assemblyMin = 8;
        capacityTanks = 0;
        capacityTrucks = 2;
      } else if (ferryType === '60t') {
        pontoonsPerFerry = 3;
        bmkPerFerry = 1;
        assemblyMin = 12;
        capacityTanks = 1;
        capacityTrucks = 3;
      } else if (ferryType === '80t') {
        pontoonsPerFerry = 4;
        bmkPerFerry = 2;
        assemblyMin = 16;
        capacityTanks = 1;
        capacityTrucks = 4;
      } else if (ferryType === '170t') {
        pontoonsPerFerry = 8;
        bmkPerFerry = 2;
        assemblyMin = 25;
        capacityTanks = 3;
        capacityTrucks = 8;
      }

      const totalTanksTrips = capacityTanks > 0 ? Math.ceil(tanks / capacityTanks) : 0;
      const totalTrucksTrips = Math.ceil(trucks / capacityTrucks);
      const totalTrips = totalTanksTrips + totalTrucksTrips;

      const ferrySpeedMs = 2.5;
      const crossMin = (widthM / ferrySpeedMs) / 60;
      const loadUnloadMin = 6.0;
      const cycleTimeMin = Math.max(6, Math.round(2 * crossMin + loadUnloadMin));

      const cyclesNeeded = Math.ceil(totalTrips / ferries);
      const totalDurationHours = (assemblyMin + cyclesNeeded * cycleTimeMin) / 60;

      return {
        crossingMode: 'ferry_pmp',
        modeTitle: `Паромная переправа из понтонного парка ПМП (${ferryType} паромы)`,
        riverWidthM: widthM,
        riverDepthM: depthM,
        currentSpeedMs: speedMs,
        equipmentNeeded: [
          { name: `Понтонные звенья ПМП`, qty: pontoonsPerFerry * ferries, unit: 'звеньев' },
          { name: 'Буксирно-моторные катера БМК-225 / БМК-130', qty: bmkPerFerry * ferries, unit: 'ед.' },
          { name: 'Понтонеры расчета сборки', qty: ferries * 16, unit: 'чел.' }
        ],
        assemblyTimeMin: assemblyMin,
        assemblyTimeFormatted: `${assemblyMin} мин.`,
        cycleTimeMin,
        totalTripsCount: totalTrips,
        totalDurationHours,
        totalDurationFormatted: this.formatHours(totalDurationHours),
        throughputPerHour: `${Math.round((ferries * 60) / cycleTimeMin * capacityTanks)} танков/ч (${Math.round((ferries * 60) / cycleTimeMin * capacityTrucks)} авт/ч)`,
        isFeasible: true,
        warnings
      };
    }

    if (params.crossingMode === 'floating_bridge_pmp') {
      const riverSpanM = Math.max(10, widthM - 14);
      const riverPontoons = Math.ceil(riverSpanM / 6.75);
      const shorePontoons = 4;
      const totalPontoons = riverPontoons + shorePontoons;
      const bmkBoats = Math.max(2, Math.ceil(totalPontoons / 6));

      const assemblyTimeMin = Math.round(25 + (widthM / 100) * 15);
      const totalVehicles = tanks + trucks;
      const bridgeSpeedKmh = 25;
      const transitTimeHours = (totalVehicles / 450);
      const totalDurationHours = (assemblyTimeMin / 60) + transitTimeHours;

      return {
        crossingMode: 'floating_bridge_pmp',
        modeTitle: 'Наплавной мост из парка ПМП (грузоподъемность 60 т)',
        riverWidthM: widthM,
        riverDepthM: depthM,
        currentSpeedMs: speedMs,
        equipmentNeeded: [
          { name: 'Речные звенья ПМП', qty: riverPontoons, unit: 'звеньев' },
          { name: 'Береговые звенья ПМП', qty: shorePontoons, unit: 'звеньев' },
          { name: 'Буксирно-моторные катера БМК-225', qty: bmkBoats, unit: 'ед.' },
          { name: 'Понтонная рота', qty: 64, unit: 'чел.' }
        ],
        assemblyTimeMin,
        assemblyTimeFormatted: `${assemblyTimeMin} мин.`,
        cycleTimeMin: 0,
        totalTripsCount: 1,
        totalDurationHours,
        totalDurationFormatted: this.formatHours(totalDurationHours),
        throughputPerHour: '400–600 авт/ч (скорость 25–30 км/ч)',
        isFeasible: true,
        warnings
      };
    }

    if (params.crossingMode === 'mechanized_bridge_tmm') {
      const spanPerTmmM = 10.5;
      const tmmVehiclesNeeded = Math.ceil(widthM / spanPerTmmM);
      const setsNeeded = Math.ceil(tmmVehiclesNeeded / 4);

      if (widthM > 42) {
        warnings.push('Ширина водной преграды более 42 м — одного комплекта ТММ-3 (4 машины) недостаточно.');
      }
      if (depthM > 3.0) {
        warnings.push('Глубина преграды более 3.0 м — установка промежуточных опор ТММ-3 ограничена.');
      }

      const assemblyTimeMin = tmmVehiclesNeeded * 11;
      const totalVehicles = tanks + trucks;
      const transitHours = totalVehicles / 300;
      const totalDurationHours = (assemblyTimeMin / 60) + transitHours;

      return {
        crossingMode: 'mechanized_bridge_tmm',
        modeTitle: 'Тяжелый механизированный мост ТММ-3 / ТММ-6 (60 т)',
        riverWidthM: widthM,
        riverDepthM: depthM,
        currentSpeedMs: speedMs,
        equipmentNeeded: [
          { name: 'Мостоукладчики ТММ-3 / ТММ-6', qty: tmmVehiclesNeeded, unit: 'машин' },
          { name: 'Комплектов моста ТММ', qty: setsNeeded, unit: 'компл.' },
          { name: 'Мостостроительный расчет', qty: tmmVehiclesNeeded * 2, unit: 'чел.' }
        ],
        assemblyTimeMin,
        assemblyTimeFormatted: `${assemblyTimeMin} мин.`,
        cycleTimeMin: 0,
        totalTripsCount: 1,
        totalDurationHours,
        totalDurationFormatted: this.formatHours(totalDurationHours),
        throughputPerHour: '250–350 авт/ч (скорость 20–25 км/ч)',
        isFeasible: depthM <= 3.5,
        warnings
      };
    }

    const prepHours = 1.5;
    const tanksPerHour = 25;
    const transitHours = tanks > 0 ? tanks / tanksPerHour : 0;
    const totalDurationHours = prepHours + transitHours;

    if (depthM > 5.0) {
      warnings.push('Глубина воды превышает 5.0 м — переправа под водой по ОПВТ запрещена.');
    }
    if (speedMs > 1.5) {
      warnings.push('Скорость течения более 1.5 м/с — требуется установка направляющих тросов по дну.');
    }

    return {
      crossingMode: 'deep_wading_opvt',
      modeTitle: 'Переправа танков под водой с оборудованием ОПВТ',
      riverWidthM: widthM,
      riverDepthM: depthM,
      currentSpeedMs: speedMs,
      equipmentNeeded: [
        { name: 'Комплекты воздухопитающих труб ОПВТ', qty: tanks, unit: 'компл.' },
        { name: 'Тягачи эвакуации на обоих берегах (БРЭМ-1)', qty: 2, unit: 'ед.' },
        { name: 'Водолазная спасательная станция', qty: 1, unit: 'компл.' }
      ],
      assemblyTimeMin: 90,
      assemblyTimeFormatted: '1 ч. 30 мин.',
      cycleTimeMin: 2.5,
      totalTripsCount: tanks,
      totalDurationHours,
      totalDurationFormatted: this.formatHours(totalDurationHours),
      throughputPerHour: '20–30 танков/ч (интервал 2–3 мин.)',
      isFeasible: depthM <= 5.0,
      warnings
    };
  }

  private formatHours(h: number): string {
    const totalMin = Math.round(h * 60);
    const hrs = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    if (hrs === 0) return `${mins} мин.`;
    return `${hrs} ч. ${mins} мин.`;
  }
}
