import { Injectable } from '@angular/core';

export type MaskingTargetType = 'tank' | 'bmp' | 'btr' | 'knp_dugout' | 'artillery' | 'radar_station' | 'custom_area';
export type MaskKitType = 'mkt2l' | 'mkt3l' | 'mkt4l' | 'mkt5l' | 'ts75';
export type ReflectorType = 'sfera_pr' | 'omu' | 'thermal_pot';
export type SmokeDeviceType = 'tda2m' | 'tda3' | 'dm11' | 'rdg2b';
export type WindDirectionType = 'frontal' | 'flank' | 'oblique';

export interface MaskingCalcParams {
  targetType: MaskingTargetType;
  targetCount: number;
  maskType: MaskKitType;
  customAreaM2?: number;
}

export interface MaskingCalcResult {
  targetType: MaskingTargetType;
  targetCount: number;
  maskType: MaskKitType;
  maskName: string;
  totalAreaM2: number;
  standardKitsNeeded: number;
  panelsCount: number;
  fasteningWireKg: number;
  pegsCount: number;
  laborHours: number;
  setupTimeFormatted: string;
  recommendedSeason: string;
}

export interface DecoyCalcParams {
  decoyType: ReflectorType;
  falseTargetType: 'bridge' | 'position_platoon' | 'position_battery' | 'single_vehicle';
  targetLengthM?: number;
  positionsCount?: number;
}

export interface DecoyCalcResult {
  decoyType: ReflectorType;
  decoyName: string;
  reflectorsCount: number;
  thermalPotsCount: number;
  assemblyLaborHours: number;
  setupTimeFormatted: string;
  radarCrossSectionEchoM2: number;
  notes: string;
}

export interface AerosolCalcParams {
  frontLengthM: number;
  screenDurationMin: number;
  windSpeedMs: number;
  windDirection: WindDirectionType;
  deviceType: SmokeDeviceType;
}

export interface AerosolCalcResult {
  deviceType: SmokeDeviceType;
  deviceName: string;
  frontLengthM: number;
  screenDurationMin: number;
  windSpeedMs: number;
  machinesOrKitsNeeded: number;
  consumptionTotal: number;
  consumptionUnit: string;
  consumptionPerMinute: number;
  aerosolDepthM: number;
  totalCoverAreaHa: number;
  effectivenessRating: string;
  notes: string;
}

@Injectable({
  providedIn: 'root'
})
export class CamouflageService {
  calculateMasking(params: MaskingCalcParams): MaskingCalcResult {
    const count = Math.max(1, params.targetCount);
    let areaPerUnitM2 = 120;

    if (params.targetType === 'tank') areaPerUnitM2 = 150;
    else if (params.targetType === 'bmp' || params.targetType === 'btr') areaPerUnitM2 = 110;
    else if (params.targetType === 'knp_dugout') areaPerUnitM2 = 180;
    else if (params.targetType === 'artillery') areaPerUnitM2 = 140;
    else if (params.targetType === 'radar_station') areaPerUnitM2 = 250;
    else if (params.targetType === 'custom_area') areaPerUnitM2 = Math.max(10, params.customAreaM2 || 200);

    const totalAreaM2 = params.targetType === 'custom_area' ? areaPerUnitM2 : areaPerUnitM2 * count;
    const kitAreaM2 = 216;
    const standardKitsNeeded = Math.max(1, Math.ceil(totalAreaM2 / kitAreaM2));
    const panelsCount = standardKitsNeeded * 12;

    const fasteningWireKg = standardKitsNeeded * 8.5;
    const pegsCount = standardKitsNeeded * 48;
    const laborHours = standardKitsNeeded * 4.5;

    let maskName = 'МКТ-2Л (растительный летний фон)';
    let recommendedSeason = 'Лето, травянистый и лесной фон';

    if (params.maskType === 'mkt3l') {
      maskName = 'МКТ-3Л (песчано-пустынный фон)';
      recommendedSeason = 'Осень, выгоревшая трава, песок';
    } else if (params.maskType === 'mkt4l') {
      maskName = 'МКТ-4Л (снежно-зимний фон)';
      recommendedSeason = 'Зима, сплошной снеговой покров';
    } else if (params.maskType === 'mkt5l') {
      maskName = 'МКТ-5Л (городской индустриальный фон)';
      recommendedSeason = 'Городская застройка, бетон, щебень';
    } else if (params.maskType === 'ts75') {
      maskName = 'ТС-75 (теплорассеивающее покрытие против ВТО)';
      recommendedSeason = 'Всесезонное (снижение ИК-контраста в 3–5 раз)';
    }

    return {
      targetType: params.targetType,
      targetCount: count,
      maskType: params.maskType,
      maskName,
      totalAreaM2,
      standardKitsNeeded,
      panelsCount,
      fasteningWireKg,
      pegsCount,
      laborHours,
      setupTimeFormatted: this.formatHours(laborHours / 4),
      recommendedSeason
    };
  }

  calculateDecoys(params: DecoyCalcParams): DecoyCalcResult {
    let reflectorsCount = 4;
    let thermalPotsCount = 2;
    let laborPerObj = 1.5;
    let rcs = 120;

    if (params.falseTargetType === 'bridge') {
      const len = Math.max(20, params.targetLengthM || 100);
      reflectorsCount = Math.ceil(len / 15) * 2;
      thermalPotsCount = Math.ceil(len / 30);
      laborPerObj = reflectorsCount * 0.4;
      rcs = 450;
    } else if (params.falseTargetType === 'position_platoon') {
      const pos = Math.max(1, params.positionsCount || 3);
      reflectorsCount = pos * 4;
      thermalPotsCount = pos * 2;
      laborPerObj = pos * 2.0;
      rcs = 200;
    } else if (params.falseTargetType === 'position_battery') {
      const guns = Math.max(1, params.positionsCount || 6);
      reflectorsCount = guns * 3;
      thermalPotsCount = guns * 2;
      laborPerObj = guns * 1.8;
      rcs = 350;
    }

    let decoyName = 'Уголковый отражатель «Сфера-ПР»';
    if (params.decoyType === 'omu') {
      decoyName = 'Отражатель маскировочный уголковый ОМУ';
      rcs = rcs * 1.2;
    } else if (params.decoyType === 'thermal_pot') {
      decoyName = 'Тепловой ложный излучатель (имитатор двигателя)';
    }

    return {
      decoyType: params.decoyType,
      decoyName,
      reflectorsCount,
      thermalPotsCount,
      assemblyLaborHours: laborPerObj,
      setupTimeFormatted: this.formatHours(laborPerObj),
      radarCrossSectionEchoM2: rcs,
      notes: 'Создание ложного объекта для бортовых РЛС и ГСН высокоточного оружия.'
    };
  }

  calculateAerosol(params: AerosolCalcParams): AerosolCalcResult {
    const frontM = Math.max(50, params.frontLengthM);
    const durMin = Math.max(5, params.screenDurationMin);
    const windSpeed = Math.max(1.0, params.windSpeedMs);

    let windCoeff = 1.0;
    if (params.windDirection === 'flank') windCoeff = 0.6;
    if (params.windDirection === 'oblique') windCoeff = 0.8;

    let deviceName = 'Авторазливочная дымовая машина ТДА-2М';
    let machineRateM = 1000;
    let machinesNeeded = Math.max(1, Math.ceil((frontM * windCoeff) / machineRateM));
    let fuelPerMinPerMach = 8.5;
    let unit = 'л дымосмеси';

    if (params.deviceType === 'tda3') {
      deviceName = 'Термодымовая машина нового поколения ТДА-3';
      machineRateM = 1500;
      machinesNeeded = Math.max(1, Math.ceil((frontM * windCoeff) / machineRateM));
      fuelPerMinPerMach = 12.0;
      unit = 'л термодымосмеси';
    } else if (params.deviceType === 'dm11') {
      deviceName = 'Дымовая шашка крупная ДМ-11';
      const intervalM = 25;
      const potsPerLine = Math.ceil(frontM / intervalM);
      const burningTimeMin = 10;
      const wavesCount = Math.ceil(durMin / burningTimeMin);
      const totalPots = potsPerLine * wavesCount;

      return {
        deviceType: params.deviceType,
        deviceName,
        frontLengthM: frontM,
        screenDurationMin: durMin,
        windSpeedMs: windSpeed,
        machinesOrKitsNeeded: potsPerLine,
        consumptionTotal: totalPots,
        consumptionUnit: 'шашек ДМ-11',
        consumptionPerMinute: Math.round((totalPots / durMin) * 10) / 10,
        aerosolDepthM: Math.round(windSpeed * 60 * 10),
        totalCoverAreaHa: Math.round(((frontM * (windSpeed * 60 * 10)) / 10000) * 10) / 10,
        effectivenessRating: 'Высокая (сплошное оптическое экранирование)',
        notes: `Рубеж из ${potsPerLine} шашек в ${wavesCount} очереди поджигания каждые 10 минут.`
      };
    } else if (params.deviceType === 'rdg2b') {
      deviceName = 'Ручная дымовая граната РДГ-2Б (белый дым)';
      const intervalM = 10;
      const grenadesPerLine = Math.ceil(frontM / intervalM);
      const burningTimeMin = 1.5;
      const wavesCount = Math.ceil(durMin / burningTimeMin);
      const totalGrenades = grenadesPerLine * wavesCount;

      return {
        deviceType: params.deviceType,
        deviceName,
        frontLengthM: frontM,
        screenDurationMin: durMin,
        windSpeedMs: windSpeed,
        machinesOrKitsNeeded: grenadesPerLine,
        consumptionTotal: totalGrenades,
        consumptionUnit: 'гранат РДГ-2Б',
        consumptionPerMinute: Math.round((totalGrenades / durMin) * 10) / 10,
        aerosolDepthM: Math.round(windSpeed * 60 * 1.5),
        totalCoverAreaHa: Math.round(((frontM * (windSpeed * 60 * 1.5)) / 10000) * 10) / 10,
        effectivenessRating: 'Локальная (маскировка огневых ячеек и отделений)',
        notes: `Потребность для непрерывной завесы отделением в течение ${durMin} мин.`
      };
    }

    const consumptionTotal = Math.round(machinesNeeded * fuelPerMinPerMach * durMin);
    const aerosolDepthM = Math.round(windSpeed * 60 * durMin * 0.4);
    const totalCoverAreaHa = Math.round(((frontM * aerosolDepthM) / 10000) * 10) / 10;

    return {
      deviceType: params.deviceType,
      deviceName,
      frontLengthM: frontM,
      screenDurationMin: durMin,
      windSpeedMs: windSpeed,
      machinesOrKitsNeeded: machinesNeeded,
      consumptionTotal,
      consumptionUnit: unit,
      consumptionPerMinute: Math.round(machinesNeeded * fuelPerMinPerMach * 10) / 10,
      aerosolDepthM,
      totalCoverAreaHa,
      effectivenessRating: 'Очень высокая (оптический и ИК-диапазон)',
      notes: `Работа ${machinesNeeded} машин ТДА на рубеже ${frontM} м при скорости ветра ${windSpeed} м/с.`
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
