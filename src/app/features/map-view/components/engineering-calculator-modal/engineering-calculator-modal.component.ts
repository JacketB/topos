import { Component, inject, signal, computed, ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx-js-style';
import { MapViewModel } from '../../viewmodels/map.viewmodel';
import { ExcelStylerUtils } from '../../utils/excel-styler.utils';
import {
  MinefieldCalculationService,
  MineCatalogItem,
  DeployMethodType,
  SoilConditionType,
  UnitFormationType
} from '../../services/minefield-calculation.service';
import { PozCalculationService } from '../../services/poz-calculation.service';
import {
  ObstacleBreachingService,
  BreachingMethodType,
  TrawlType,
  ObstacleType,
  ClearingVehicleType
} from '../../services/obstacle-breaching.service';
import {
  WaterCrossingService,
  CrossingModeType
} from '../../services/water-crossing.service';
import {
  CamouflageService,
  MaskingTargetType,
  MaskKitType,
  ReflectorType,
  SmokeDeviceType,
  WindDirectionType
} from '../../services/camouflage.service';
import { MinefieldFormularService } from '../../services/minefield-formular.service';

export type EngCalcTabType =
  | 'mvz'
  | 'poz'
  | 'breaching'
  | 'crossings'
  | 'camouflage'
  | 'nz'
  | 'uz';

@Component({
  selector: 'app-engineering-calculator-modal',
  standalone: true,
  imports: [CommonModule, DecimalPipe, FormsModule],
  templateUrl: './engineering-calculator-modal.component.html',
  styleUrl: './engineering-calculator-modal.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EngineeringCalculatorModalComponent {
  readonly vm = inject(MapViewModel);
  readonly minefieldSvc = inject(MinefieldCalculationService);
  readonly pozSvc = inject(PozCalculationService);
  readonly breachingSvc = inject(ObstacleBreachingService);
  readonly crossingSvc = inject(WaterCrossingService);
  readonly camoSvc = inject(CamouflageService);
  readonly formularSvc = inject(MinefieldFormularService);

  readonly activeTab = signal<EngCalcTabType>('mvz');

  readonly minesCatalog = this.minefieldSvc.getCatalog();
  readonly mvzMineId = signal<string>('tm72');
  readonly mvzFrontM = signal<number>(1000);
  readonly mvzRows = signal<number>(4);
  readonly mvzStepM = signal<number>(5.5);
  readonly mvzDeployMethod = signal<DeployMethodType>('gmz3');
  readonly mvzSoil = signal<SoilConditionType>('ground');
  readonly mvzUnit = signal<UnitFormationType>('platoon');
  readonly mvzVehicles = signal<number>(3);
  readonly mvzReloadDistKm = signal<number>(15);
  readonly mvzWithUnremovable = signal<boolean>(false);

  readonly currentMvzMine = computed(() => {
    return this.minefieldSvc.getMineById(this.mvzMineId());
  });

  readonly mvzCalc = computed(() => {
    return this.minefieldSvc.calculate({
      mineId: this.mvzMineId(),
      frontLengthM: this.mvzFrontM(),
      rowsCount: this.mvzRows(),
      stepM: this.mvzStepM(),
      deployMethod: this.mvzDeployMethod(),
      soilCondition: this.mvzSoil(),
      unitFormation: this.mvzUnit(),
      vehiclesCount: this.mvzVehicles(),
      reloadDistanceKm: this.mvzReloadDistKm(),
      withUnremovablePenta: this.mvzWithUnremovable()
    });
  });

  readonly pozEnemySpeedKmh = signal<number>(20);
  readonly pozEnemyDistanceKm = signal<number>(18);
  readonly pozMarchDistanceKm = signal<number>(8);
  readonly pozMarchSpeedKmh = signal<number>(30);
  readonly pozDecisionMin = signal<number>(15);
  readonly pozReconMin = signal<number>(10);
  readonly pozVehicleType = signal<'gmz3' | 'umz' | 'pmz4'>('gmz3');
  readonly pozVehicleCount = signal<number>(3);
  readonly pozFrontM = signal<number>(1000);
  readonly pozRows = signal<number>(4);
  readonly pozStepM = signal<number>(5.5);
  readonly pozMineId = signal<string>('tm72');
  readonly pozSoil = signal<SoilConditionType>('ground');
  readonly pozReloadDistKm = signal<number>(12);
  readonly pozBaseStartTime = signal<string>('08:00');

  readonly pozCalc = computed(() => {
    return this.pozSvc.calculate({
      enemySpeedKmh: this.pozEnemySpeedKmh(),
      enemyDistanceKm: this.pozEnemyDistanceKm(),
      pozMarchDistanceKm: this.pozMarchDistanceKm(),
      pozMarchSpeedKmh: this.pozMarchSpeedKmh(),
      pozDecisionTimeMin: this.pozDecisionMin(),
      pozReconTimeMin: this.pozReconMin(),
      pozVehicleType: this.pozVehicleType(),
      pozVehicleCount: this.pozVehicleCount(),
      frontLengthM: this.pozFrontM(),
      rowsCount: this.pozRows(),
      stepM: this.pozStepM(),
      mineId: this.pozMineId(),
      soilCondition: this.pozSoil(),
      reloadDistanceKm: this.pozReloadDistKm()
    }, this.pozBaseStartTime());
  });

  readonly breachMineDepthM = signal<number>(120);
  readonly breachCount = signal<number>(2);
  readonly breachMethod = signal<BreachingMethodType>('ur77');

  readonly breachResult = computed(() => {
    return this.breachingSvc.calculateMineBreach({
      minefieldDepthM: this.breachMineDepthM(),
      breachesCount: this.breachCount(),
      method: this.breachMethod()
    });
  });

  readonly trawlVehiclesCount = signal<number>(10);
  readonly trawlType = signal<TrawlType>('kmt7');
  readonly trawlEquippedPct = signal<number>(40);
  readonly trawlBreachLengthM = signal<number>(200);

  readonly trawlResult = computed(() => {
    return this.breachingSvc.calculateTrawls({
      combatVehiclesCount: this.trawlVehiclesCount(),
      trawlType: this.trawlType(),
      equippedPercent: this.trawlEquippedPct(),
      breachLengthM: this.trawlBreachLengthM()
    });
  });

  readonly clearingObstacleType = signal<ObstacleType>('forest_abatis');
  readonly clearingLengthM = signal<number>(150);
  readonly clearingWidthM = signal<number>(4);
  readonly clearingHeightM = signal<number>(1.5);
  readonly clearingVehicleType = signal<ClearingVehicleType>('imr2');
  readonly clearingVehiclesCount = signal<number>(2);

  readonly clearingResult = computed(() => {
    return this.breachingSvc.calculateObstacleClearing({
      obstacleType: this.clearingObstacleType(),
      obstacleLengthM: this.clearingLengthM(),
      obstacleWidthM: this.clearingWidthM(),
      obstacleHeightOrDepthM: this.clearingHeightM(),
      vehicleType: this.clearingVehicleType(),
      vehiclesCount: this.clearingVehiclesCount()
    });
  });

  readonly crossingMode = signal<CrossingModeType>('amphibious_pts');
  readonly crossingRiverWidthM = signal<number>(80);
  readonly crossingRiverDepthM = signal<number>(2.5);
  readonly crossingCurrentSpeedMs = signal<number>(0.8);
  readonly crossingBanksSlopeDeg = signal<number>(12);
  readonly crossingTanksCount = signal<number>(10);
  readonly crossingTrucksCount = signal<number>(25);
  readonly crossingPersonnelCount = signal<number>(120);
  readonly crossingTransportersCount = signal<number>(4);
  readonly crossingFerryType = signal<'40t' | '60t' | '80t' | '170t'>('60t');
  readonly crossingFerriesCount = signal<number>(2);

  readonly crossingResult = computed(() => {
    return this.crossingSvc.calculate({
      crossingMode: this.crossingMode(),
      riverWidthM: this.crossingRiverWidthM(),
      riverDepthM: this.crossingRiverDepthM(),
      currentSpeedMs: this.crossingCurrentSpeedMs(),
      banksSlopeDeg: this.crossingBanksSlopeDeg(),
      combatVehiclesCount: this.crossingTanksCount(),
      trucksCount: this.crossingTrucksCount(),
      personnelCount: this.crossingPersonnelCount(),
      transportersCount: this.crossingTransportersCount(),
      ferryType: this.crossingFerryType(),
      ferriesCount: this.crossingFerriesCount()
    });
  });

  readonly maskTargetType = signal<MaskingTargetType>('tank');
  readonly maskTargetCount = signal<number>(10);
  readonly maskKitType = signal<MaskKitType>('mkt2l');

  readonly maskResult = computed(() => {
    return this.camoSvc.calculateMasking({
      targetType: this.maskTargetType(),
      targetCount: this.maskTargetCount(),
      maskType: this.maskKitType()
    });
  });

  readonly decoyType = signal<ReflectorType>('sfera_pr');
  readonly decoyTargetType = signal<'bridge' | 'position_platoon' | 'position_battery' | 'single_vehicle'>('bridge');
  readonly decoyLengthM = signal<number>(120);

  readonly decoyResult = computed(() => {
    return this.camoSvc.calculateDecoys({
      decoyType: this.decoyType(),
      falseTargetType: this.decoyTargetType(),
      targetLengthM: this.decoyLengthM()
    });
  });

  readonly aerosolFrontM = signal<number>(1000);
  readonly aerosolDurationMin = signal<number>(20);
  readonly aerosolWindSpeedMs = signal<number>(3.0);
  readonly aerosolWindDirection = signal<WindDirectionType>('flank');
  readonly aerosolDevice = signal<SmokeDeviceType>('tda2m');

  readonly aerosolResult = computed(() => {
    return this.camoSvc.calculateAerosol({
      frontLengthM: this.aerosolFrontM(),
      screenDurationMin: this.aerosolDurationMin(),
      windSpeedMs: this.aerosolWindSpeedMs(),
      windDirection: this.aerosolWindDirection(),
      deviceType: this.aerosolDevice()
    });
  });

  readonly abatisFrontM = signal<number>(100);
  readonly abatisDepthM = signal<number>(30);
  readonly abatisMethod = signal<'chainsaw' | 'explosive'>('chainsaw');
  readonly abatisTreeDiameterCm = signal<number>(45);
  readonly abatisUnit = signal<'squad' | 'platoon' | 'company'>('squad');
  readonly abatisWithMines = signal<boolean>(false);
  readonly abatisPtmCount = signal<number>(0);
  readonly abatisPpmCount = signal<number>(0);

  readonly abatisCalc = computed(() => {
    const frontM = Math.max(1, this.abatisFrontM());
    const depthM = Math.max(1, this.abatisDepthM());
    const areaHa = (frontM * depthM) / 10000;
    const d = this.abatisTreeDiameterCm();

    let expNormKgPerHa = 0;
    if (this.abatisMethod() === 'explosive') {
      expNormKgPerHa = 250 * Math.pow(d / 45, 2);
    }
    const totalExpKg = areaHa * expNormKgPerHa;

    let manpower = 8;
    if (this.abatisUnit() === 'platoon') manpower = 24;
    if (this.abatisUnit() === 'company') manpower = 72;

    const laborNormPerHa = this.abatisMethod() === 'chainsaw' ? 270 : 90;
    const totalLaborCh = areaHa * laborNormPerHa;
    const clearingTimeHours = manpower > 0 ? (totalLaborCh / manpower) : 0;

    let totalMines = 0;
    let mineLaborCh = 0;

    if (this.abatisWithMines()) {
      totalMines = this.abatisPtmCount() + this.abatisPpmCount();
      mineLaborCh = totalMines / 3.1746;
    }

    const totalOverallLaborCh = totalLaborCh + mineLaborCh;
    const totalOverallTimeHours = manpower > 0 ? (totalOverallLaborCh / manpower) : 0;

    return {
      areaHa,
      totalExpKg,
      manpower,
      chainsawsCount: this.abatisMethod() === 'chainsaw' ? Math.ceil((manpower / 8) * 2) : 0,
      totalLaborCh,
      clearingTimeHours,
      clearingTimeFormatted: this.formatHours(clearingTimeHours),
      totalMines,
      mineLaborCh,
      totalOverallLaborCh,
      totalOverallTimeHours,
      totalOverallTimeFormatted: this.formatHours(totalOverallTimeHours)
    };
  });

  readonly bridgeCount = signal<number>(1);
  readonly bridgeType = signal<'reinforced_concrete' | 'metal' | 'wooden'>('metal');
  readonly bridgeTarget = signal<'full' | 'piers' | 'spans' | 'elements'>('elements');
  readonly bridgePiersCount = signal<number>(0);
  readonly bridgeSpansCount = signal<number>(0);
  readonly bridgeElementsCount = signal<number>(0);
  readonly bridgeUnit = signal<'squad' | 'platoon' | 'company'>('platoon');

  readonly bridgeCalc = computed(() => {
    const count = Math.max(1, this.bridgeCount());
    const type = this.bridgeType();
    const target = this.bridgeTarget();

    let pierExp = 100;
    let spanExp = 120;
    let elemExp = 15;
    let pierLabor = 15.33;
    let spanLabor = 20.0;
    let elemLabor = 8.67;

    if (type === 'metal') {
      pierExp = 35;
      spanExp = 50;
      elemExp = 10;
      pierLabor = 15.33;
      spanLabor = 20.0;
      elemLabor = 8.67;
    } else if (type === 'wooden') {
      pierExp = 10;
      spanExp = 15;
      elemExp = 5;
      pierLabor = 4.0;
      spanLabor = 10.0;
      elemLabor = 7.33;
    }

    let piers = this.bridgePiersCount();
    let spans = this.bridgeSpansCount();
    let elems = this.bridgeElementsCount();

    if (target === 'full') {
      if (piers === 0) piers = 2;
      if (spans === 0) spans = 1;
    }

    const totalExpKg = count * (piers * pierExp + spans * spanExp + elems * elemExp);
    const totalLaborCh = count * (piers * pierLabor + spans * spanLabor + elems * elemLabor);

    let manpower = 24;
    if (this.bridgeUnit() === 'squad') manpower = 8;
    if (this.bridgeUnit() === 'company') manpower = 72;

    const timeHours = manpower > 0 ? (totalLaborCh / manpower) : 0;

    return {
      piers,
      spans,
      elems,
      totalExpKg,
      totalLaborCh,
      manpower,
      timeHours,
      timeFormatted: this.formatHours(timeHours)
    };
  });

  printFormular() {
    const calc = this.mvzCalc();
    const [lat, lng] = this.vm.centerLatLon();
    const formular = this.formularSvc.generateDefaultFormular(calc, lat, lng);
    this.formularSvc.openPrintWindow(formular);
  }

  private formatHours(h: number): string {
    const totalMin = Math.round(h * 60);
    const hrs = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    if (hrs === 0) return `${mins} мин.`;
    return `${hrs} ч. ${mins} мин.`;
  }

  async exportAllToExcel() {
    const mvz = this.mvzCalc();
    const poz = this.pozCalc();
    const breach = this.breachResult();
    const trawl = this.trawlResult();
    const clear = this.clearingResult();
    const cross = this.crossingResult();
    const mask = this.maskResult();
    const decoy = this.decoyResult();
    const aero = this.aerosolResult();
    const ab = this.abatisCalc();
    const br = this.bridgeCalc();

    const wsMvz = ExcelStylerUtils.buildKeyValueSheet({
      title: 'ТОПОС ГИС | РАСЧЕТ МИННО-ВЗРЫВНЫХ ЗАГРАЖДЕНИЙ (МВЗ)',
      subtitle: `Минные поля по нормативам МОРБ на ${new Date().toLocaleDateString('ru-RU')}`,
      sections: [
        {
          sectionTitle: '1. ИСХОДНЫЕ ПАРАМЕТРЫ ЗАГРАЖДЕНИЯ',
          items: [
            { label: 'Марка мины', value: mvz.mine.name, unit: '', note: mvz.mine.typeLabel },
            { label: 'Фронт минного поля', value: mvz.frontLengthM, unit: 'м', note: 'Ширина прикрываемого рубежа' },
            { label: 'Количество рядов', value: mvz.rowsCount, unit: 'рядов', note: 'Эшелонирование' },
            { label: 'Шаг минирования', value: mvz.stepM, unit: 'м', note: 'Интервал между минами' },
            { label: 'Способ установки', value: this.mvzDeployMethod(), unit: '', note: 'Технологический способ' }
          ]
        },
        {
          sectionTitle: '2. РАСХОД МИН И ЭФФЕКТИВНОСТЬ',
          items: [
            { label: 'ОБЩИЙ РАСХОД МИН', value: mvz.totalMines, unit: 'шт.', note: 'Суммарный расход боекомплекта' },
            { label: 'Глубина минного поля', value: mvz.depthM, unit: 'м', note: 'Между 1-м и последним рядом' },
            { label: 'Плотность минирования', value: mvz.densityPerKm.toFixed(1), unit: 'мин/км', note: 'Фактическая плотность' },
            { label: 'Вероятность поражения (Wпор)', value: mvz.killProbabilityPct, unit: '%', note: 'Эффективность заграждения' },
            { label: 'Общая масса мин', value: mvz.totalWeightTons.toFixed(2), unit: 'т', note: 'Транспортный тоннаж' },
            { label: 'Суммарная масса ВВ', value: mvz.totalExplosiveKg.toFixed(1), unit: 'кг', note: 'Тротиловый эквивалент' }
          ]
        },
        {
          sectionTitle: '3. СИЛЫ, СРЕДСТВА И ВРЕМЯ',
          items: [
            { label: 'Время установки заграждения', value: mvz.deployTimeFormatted, unit: 'ч/мин', note: 'Чистая раскладка' },
            { label: 'Полное время выполнения задачи', value: mvz.totalMissionTimeFormatted, unit: 'ч/мин', note: 'С челночными дозарядками' },
            { label: 'Потребность в автотранспорте', value: mvz.trucksNeeded, unit: 'авто', note: 'Урал-4320 / КамАЗ' }
          ]
        }
      ],
      calculationSteps: [
        {
          parameter: '1. Расход мин в одном ряду (N_ряд)',
          formula: 'N_ряд = ceil(L_фронт / d_шаг)',
          calculation: `ceil(${mvz.frontLengthM} / ${mvz.stepM}) = ${mvz.minesPerRow} шт.`,
          description: `L_фронт = ${mvz.frontLengthM} м (протяженность рубежа), d_шаг = ${mvz.stepM} м (шаг минирования)`
        },
        {
          parameter: '2. Общий расход мин на минное поле (N_общ)',
          formula: 'N_общ = n_рядов * N_ряд',
          calculation: `${mvz.rowsCount} * ${mvz.minesPerRow} = ${mvz.totalMines} шт.`,
          description: `n_рядов = ${mvz.rowsCount} (число рядов). Марка мины: ${mvz.mine.name}`
        },
        {
          parameter: '3. Глубина минного поля (Г_мвз)',
          formula: 'Г = (n_рядов - 1) * d_ряд',
          calculation: `(${mvz.rowsCount} - 1) * ${mvz.mine.rowDistanceM} = ${mvz.depthM} м`,
          description: `d_ряд = ${mvz.mine.rowDistanceM} м (нормативное расстояние между рядами мин)`
        },
        {
          parameter: '4. Линейная плотность минирования (D)',
          formula: 'D = N_общ / (L_фронт / 1000)',
          calculation: `${mvz.totalMines} / (${mvz.frontLengthM} / 1000) = ${mvz.densityPerKm.toFixed(1)} мин/км`,
          description: 'Фактический расход мин на один километр прикрываемого фронта'
        },
        {
          parameter: '5. Транспортный тоннаж боекомплекта (M_мин)',
          formula: 'M_мин = (N_общ * m_мина) / 1000',
          calculation: `(${mvz.totalMines} * ${mvz.mine.weightTotalKg}) / 1000 = ${mvz.totalWeightTons.toFixed(2)} т`,
          description: `m_мина = ${mvz.mine.weightTotalKg} кг (полная масса одной снаряженной мины)`
        },
        {
          parameter: '6. Суммарная масса взрывчатого вещества (M_вв)',
          formula: 'M_вв = N_общ * m_вв',
          calculation: `${mvz.totalMines} * ${mvz.mine.weightExplosiveKg} = ${mvz.totalExplosiveKg.toFixed(1)} кг`,
          description: `m_вв = ${mvz.mine.weightExplosiveKg} кг (масса заряда ВВ в тротиловом эквиваленте)`
        },
        {
          parameter: '7. Потребность в автомобильном транспорте (N_авто)',
          formula: 'N_авто = ceil(M_мин / q_авто)',
          calculation: `ceil(${mvz.totalWeightTons.toFixed(2)} / 4.0) = ${mvz.trucksNeeded} авто`,
          description: 'q_авто = 4.0 т (нормативная грузоподъемность грузовых автомобилей КамАЗ/Урал)'
        }
      ]
    });

    const pozHeaders = ['№', 'Этап боевой работы ПОЗ', 'Время (чч:мм)', 'Длительность (мин)', 'Содержание действий'];
    const pozData = poz.timeline.map(t => [
      t.stepIndex.toString(),
      t.title,
      t.clockFormatted,
      t.durationMin.toString(),
      t.description
    ]);

    const wsPoz = ExcelStylerUtils.buildTableSheet({
      title: 'ТОПОС ГИС | РАСЧЕТ РУБЕЖЕЙ МИНИРОВАНИЯ ПОЗ',
      subtitle: `Проверка условия упреждения рубежей ПОЗ на ${new Date().toLocaleDateString('ru-RU')}`,
      kpiCards: [
        { label: 'Подход противника', value: poz.enemyApproachFormatted },
        { label: 'Готовность рубежа ПОЗ', value: poz.pozTotalReadyFormatted },
        { label: 'Гарантия упреждения', value: poz.isPreemptionGuaranteed ? 'ДА (УСПЕВАЕТ)' : 'НЕТ (РИСК)' },
        { label: 'Запас времени', value: poz.timeMarginFormatted }
      ],
      headers: pozHeaders,
      data: pozData,
      enableAutofilter: false,
      calculationSteps: [
        {
          parameter: '1. Время подхода колонны противника к рубежу (T_подх)',
          formula: 'T_подх = (D_пр / V_пр) * 60',
          calculation: `(${this.pozEnemyDistanceKm()} / ${this.pozEnemySpeedKmh()}) * 60 = ${poz.enemyApproachTimeMin.toFixed(1)} мин.`,
          description: `D_пр = ${this.pozEnemyDistanceKm()} км (удаление противника), V_пр = ${this.pozEnemySpeedKmh()} км/ч (скорость выдвижения)`
        },
        {
          parameter: '2. Время совершения марша отряда ПОЗ (T_марш)',
          formula: 'T_марш = (D_поз / V_марш) * 60',
          calculation: `(${this.pozMarchDistanceKm()} / ${this.pozMarchSpeedKmh()}) * 60 = ${poz.pozMarchTimeMin.toFixed(1)} мин.`,
          description: `D_поз = ${this.pozMarchDistanceKm()} км (дистанция выдвижения ПОЗ), V_марш = ${this.pozMarchSpeedKmh()} км/ч`
        },
        {
          parameter: '3. Полное время готовности рубежа минирования (T_гот)',
          formula: 'T_гот = T_реш + T_марш + T_разв + T_устан',
          calculation: `${poz.pozDecisionTimeMin} + ${poz.pozMarchTimeMin.toFixed(1)} + ${poz.pozReconTimeMin} + ${poz.pozDeployTimeMin.toFixed(1)} = ${poz.pozTotalReadyTimeMin.toFixed(1)} мин.`,
          description: `T_реш = ${poz.pozDecisionTimeMin} мин, T_разв = ${poz.pozReconTimeMin} мин, T_устан = ${poz.pozDeployTimeMin.toFixed(1)} мин`
        },
        {
          parameter: '4. Условие упреждения и запас времени (Delta_T)',
          formula: 'Delta_T = T_подх - T_гот',
          calculation: `${poz.enemyApproachTimeMin.toFixed(1)} - ${poz.pozTotalReadyTimeMin.toFixed(1)} = ${poz.timeMarginMin.toFixed(1)} мин.`,
          description: `Критерий гарантированного упреждения T_гот <= T_подх (${poz.isPreemptionGuaranteed ? 'условие выполнено' : 'риск неупреждения'})`
        },
        {
          parameter: '5. Минимальное безопасное удаление противника (D_без)',
          formula: 'D_без = (T_гот / 60) * V_пр',
          calculation: `(${poz.pozTotalReadyTimeMin.toFixed(1)} / 60) * ${this.pozEnemySpeedKmh()} = ${poz.minSafeEnemyDistanceKm.toFixed(1)} км`,
          description: 'Минимальное расстояние до противника, гарантирующее своевременный выход ПОЗ'
        }
      ]
    });

    const wsBreach = ExcelStylerUtils.buildKeyValueSheet({
      title: 'ТОПОС ГИС | РАСЧЕТ ПРЕОДОЛЕНИЯ ЗАГРАЖДЕНИЙ И РАЗМИНИРОВАНИЯ',
      subtitle: `Установки УР-77/83П, минные тралы и машины разграждения ИМР/БАТ`,
      sections: [
        {
          sectionTitle: '1. ПРОДЕЛЫВАНИЕ ПРОХОДОВ В МВЗ (ВЗРЫВНОЙ СПОСОБ)',
          items: [
            { label: 'Способ разминирования', value: breach.method.toUpperCase(), unit: '', note: breach.notes },
            { label: 'Количество проходов', value: breach.breachesCount, unit: 'проходов', note: 'Требуемый наряд' },
            { label: 'Потребное число зарядов УЗП', value: breach.totalCharges, unit: 'зарядов', note: 'Суммарный расход' },
            { label: 'Габариты прохода', value: `${breach.breachWidthM} x ${breach.breachLengthM}`, unit: 'м', note: 'Ширина x глубина' },
            { label: 'Время проделывания проходов', value: breach.clearingTimeFormatted, unit: 'мин.', note: 'Готовность прохода' }
          ]
        },
        {
          sectionTitle: '2. ТРАЛЕНИЕ МВЗ С ХОДУ (ТРАЛЫ КМТ)',
          items: [
            { label: 'Тип минного трала', value: trawl.trawlType.toUpperCase(), unit: '', note: 'Колейный трал' },
            { label: 'Потребность в тралах', value: trawl.trawlsCount, unit: 'шт.', note: `${this.trawlEquippedPct()}% боевых машин` },
            { label: 'Скорость траления', value: trawl.trawlingSpeedKmh, unit: 'км/ч', note: 'Рабочая скорость' },
            { label: 'Время преодоления рубежа', value: trawl.transitTimeFormatted, unit: 'мин.', note: 'Проход колонны' }
          ]
        },
        {
          sectionTitle: '3. РАСЧИСТКА ЗАВАЛОВ И РАЗРУШЕНИЙ (ИМР-2 / БАТ-2)',
          items: [
            { label: 'Тип препятствия', value: clear.obstacleType, unit: '', note: 'Преграда' },
            { label: 'Инженерная машина', value: clear.vehicleType.toUpperCase(), unit: '', note: `${clear.vehiclesCount} ед.` },
            { label: 'Нормативная производительность', value: clear.productivityNorm, unit: '', note: 'Темп работ' },
            { label: 'Время расчистки прохода', value: clear.clearingTimeFormatted, unit: 'ч/мин', note: 'Готовность пути' }
          ]
        }
      ],
      calculationSteps: [
        {
          parameter: '1. Число пусков зарядов на один проход (N_пуск)',
          formula: 'N_пуск = ceil(Г_мвз / L_заряда)',
          calculation: `ceil(${this.breachMineDepthM()} / ${Math.round(breach.breachLengthM / Math.max(1, breach.launchesPerBreach))}) = ${breach.launchesPerBreach} пуск.`,
          description: `Г_мвз = ${this.breachMineDepthM()} м, длина пробиваемого участка одним зарядом = ${Math.round(breach.breachLengthM / Math.max(1, breach.launchesPerBreach))} м`
        },
        {
          parameter: '2. Суммарный расход зарядов разминирования (N_зар)',
          formula: 'N_зар = N_пуск * N_проходов',
          calculation: `${breach.launchesPerBreach} * ${breach.breachesCount} = ${breach.totalCharges} зарядов`,
          description: `N_проходов = ${breach.breachesCount} (требуемое количество проходов для наступающих сил)`
        },
        {
          parameter: '3. Время проделывания проходов установкой (T_проход)',
          formula: 'T = T_подг + N_пуск * T_цикл',
          calculation: `15 + ${breach.launchesPerBreach} * 12 = ${breach.clearingTimeMin} мин.`,
          description: 'T_подг = 15 мин (выход на огневую позицию), T_цикл = 12 мин (пуск, подрыв, контроль)'
        },
        {
          parameter: '4. Потребность в минных тралах КМТ (N_трал)',
          formula: 'N_трал = ceil(N_бм * %оснащ / 100)',
          calculation: `ceil(${this.trawlVehiclesCount()} * ${this.trawlEquippedPct()} / 100) = ${trawl.trawlsCount} шт.`,
          description: `N_бм = ${this.trawlVehiclesCount()} ед. боевых машин, оснащенность тралами = ${this.trawlEquippedPct()}%`
        },
        {
          parameter: '5. Время траления рубежа МВЗ танковой ротой (T_трал)',
          formula: 'T_трал = (L_мвз / V_трал) * 60',
          calculation: `(${this.breachMineDepthM() / 1000} / ${trawl.trawlingSpeedKmh}) * 60 = ${trawl.transitTimeMin.toFixed(1)} мин.`,
          description: `V_трал = ${trawl.trawlingSpeedKmh} км/ч (рабочая скорость траления колейными тралами)`
        },
        {
          parameter: '6. Время расчистки завала путепрокладчиками (T_завал)',
          formula: 'T_завал = V_завал / (П_норм * N_машин)',
          calculation: `${clear.clearingTimeFormatted}`,
          description: `Объем завала = ${clear.volumeM3} м³, задействовано машин = ${clear.vehiclesCount} ед. (${clear.vehicleType.toUpperCase()})`
        }
      ]
    });

    const wsCross = ExcelStylerUtils.buildKeyValueSheet({
      title: 'ТОПОС ГИС | РАСЧЕТ ОБОРУДОВАНИЯ И СОДЕРЖАНИЯ ПЕРЕПРАВ',
      subtitle: `${cross.modeTitle} на ${new Date().toLocaleDateString('ru-RU')}`,
      sections: [
        {
          sectionTitle: '1. ХАРАКТЕРИСТИКА ВОДНОЙ ПРЕГРАДЫ',
          items: [
            { label: 'Ширина русла', value: cross.riverWidthM, unit: 'м', note: 'Зеркало воды' },
            { label: 'Глубина реки', value: cross.riverDepthM, unit: 'м', note: 'В створе' },
            { label: 'Скорость течения', value: cross.currentSpeedMs, unit: 'м/с', note: 'Гидрология' }
          ]
        },
        {
          sectionTitle: '2. СИЛЫ И СРЕДСТВА ПЕРЕПРАВЫ',
          items: cross.equipmentNeeded.map(eq => ({
            label: eq.name,
            value: eq.qty,
            unit: eq.unit,
            note: 'Наряд сил'
          }))
        },
        {
          sectionTitle: '3. ВРЕМЕННЫЕ ПОКАЗАТЕЛИ И ПРОПУСКНАЯ СПОСОБНОСТЬ',
          items: [
            { label: 'Время оборудования / наводки', value: cross.assemblyTimeFormatted, unit: 'ч/мин', note: 'До начала движения' },
            { label: 'Полное время переправы группировки', value: cross.totalDurationFormatted, unit: 'ч/мин', note: 'Все подразделения' },
            { label: 'Пропускная способность створа', value: cross.throughputPerHour, unit: '', note: 'Темп переправы' }
          ]
        }
      ],
      calculationSteps: [
        {
          parameter: '1. Количество рейсов для переправы группировки (N_рейс)',
          formula: 'N_рейс = ceil(N_авт / q_тех) + ceil(N_лс / q_лс)',
          calculation: `ceil(${this.crossingTrucksCount()} / 1) + ceil(${this.crossingPersonnelCount()} / 75) = ${cross.totalTripsCount} рейсов`,
          description: `Грузоподъемность транспортера: 1 автомобиль (q_тех=1) или 75 человек пехоты (q_лс=75)`
        },
        {
          parameter: '2. Длительность одного кругорейса (T_рейс)',
          formula: 'T_рейс = 2 * (L_реки / V_воды) / 60 + T_погр_выгр',
          calculation: `2 * (${cross.riverWidthM} / 3.0) / 60 + 8.0 = ${cross.cycleTimeMin} мин.`,
          description: `L_реки = ${cross.riverWidthM} м, скорость хода на воде = 3.0 м/с, время погрузки/выгрузки = 8.0 мин`
        },
        {
          parameter: '3. Полное время выполнения переправы (T_общ)',
          formula: 'T_общ = (ceil(N_рейс / N_птс) * T_рейс) / 60',
          calculation: `(ceil(${cross.totalTripsCount} / ${this.crossingTransportersCount() || 3}) * ${cross.cycleTimeMin}) / 60 = ${cross.totalDurationHours.toFixed(1)} ч`,
          description: `Количество привлеченных плавающих транспортеров: ${this.crossingTransportersCount() || 3} ед.`
        },
        {
          parameter: '4. Часовая пропускная способность створа переправы (П)',
          formula: 'П = (N_птс * 60) / T_рейс',
          calculation: `(${this.crossingTransportersCount() || 3} * 60) / ${cross.cycleTimeMin} = ${cross.throughputPerHour}`,
          description: 'Фактическая интенсивность переброски подразделений через водный рубеж'
        }
      ]
    });

    const wsCamo = ExcelStylerUtils.buildKeyValueSheet({
      title: 'ТОПОС ГИС | РАСЧЕТ МАСКИРОВКИ И ЗАЩИТЫ ОТ ВТО',
      subtitle: `Табельные комплекты МКТ, ложные цели и аэрозольные завесы ТДА`,
      sections: [
        {
          sectionTitle: '1. ТАБЕЛЬНЫЕ МАСКИРОВОЧНЫЕ СЕТИ',
          items: [
            { label: 'Тип комплекта', value: mask.maskName, unit: '', note: mask.recommendedSeason },
            { label: 'Укрываемых объектов', value: mask.targetCount, unit: 'ед.', note: mask.targetType },
            { label: 'Потребность в комплектах МКТ', value: mask.standardKitsNeeded, unit: 'компл.', note: `${mask.panelsCount} полотен` },
            { label: 'Общая укрываемая площадь', value: mask.totalAreaM2, unit: 'м²', note: 'Площадь полотен' }
          ]
        },
        {
          sectionTitle: '2. РАДИОЛОКАЦИОННЫЕ И ТЕПЛОВЫЕ ЛОВУШКИ',
          items: [
            { label: 'Тип отражателя', value: decoy.decoyName, unit: '', note: 'Ложный объект' },
            { label: 'Количество уголков-отражателей', value: decoy.reflectorsCount, unit: 'шт.', note: 'Создание ЭПР' },
            { label: 'Эквивалентная площадь рассеяния', value: decoy.radarCrossSectionEchoM2, unit: 'м²', note: 'Радарный отклик' }
          ]
        },
        {
          sectionTitle: '3. АЭРОЗОЛЬНОЕ ПРИКРЫТИЕ (ДЫМОВАЯ ЗАВЕСА)',
          items: [
            { label: 'Дымовое средство', value: aero.deviceName, unit: '', note: 'Аэрозоль' },
            { label: 'Фронт рубежа задымления', value: aero.frontLengthM, unit: 'м', note: 'Длина завесы' },
            { label: 'Продолжительность задымления', value: aero.screenDurationMin, unit: 'мин.', note: 'Время поддержания' },
            { label: 'Расход дымообразующих веществ', value: aero.consumptionTotal, unit: aero.consumptionUnit, note: 'Суммарный расход' },
            { label: 'Площадь прикрываемого района', value: aero.totalCoverAreaHa, unit: 'га', note: 'Экранирование' }
          ]
        }
      ],
      calculationSteps: [
        {
          parameter: '1. Потребность в комплектах маскпокрытий МКТ (N_мкт)',
          formula: 'N_мкт = ceil(N_объектов * S_объект / S_комплект)',
          calculation: `ceil(${mask.targetCount} * 108 / 216) = ${mask.standardKitsNeeded} компл.`,
          description: 'S_комплект = 216 м² (типовой комплект 12х18 м из 12 элементов 3х6 м)'
        },
        {
          parameter: '2. Суммарная площадь маскировочных покрытий (S_укрытия)',
          formula: 'S_укрытия = N_мкт * S_комплект',
          calculation: `${mask.standardKitsNeeded} * 216 = ${mask.totalAreaM2} м²`,
          description: 'Площадь полотен табельного маскировочного покрытия'
        },
        {
          parameter: '3. Расход дымовых средств на рубеж прикрытия (N_дым)',
          formula: 'N_дым = ceil(L_фронт / l_шашка) * ceil(t_завеса / t_горения)',
          calculation: `${aero.consumptionTotal} ${aero.consumptionUnit}`,
          description: `L_фронт = ${aero.frontLengthM} м, t_завеса = ${aero.screenDurationMin} мин., прибор: ${aero.deviceName}`
        }
      ]
    });

    const wsNz = ExcelStylerUtils.buildKeyValueSheet({
      title: 'ТОПОС ГИС | РАСЧЕТ НЕВЗРЫВНЫХ ЗАГРАЖДЕНИЙ И РАЗРУШЕНИЙ',
      subtitle: `Устройство лесных завалов и взрывное разрушение мостов`,
      sections: [
        {
          sectionTitle: '1. ЛЕСНЫЕ ЗАВАЛЫ (НЕВЗРЫВНЫЕ ЗАГРАЖДЕНИЯ)',
          items: [
            { label: 'Площадь устраиваемого завала', value: ab.areaHa.toFixed(3), unit: 'га', note: 'Общая площадь' },
            { label: 'Расход взрывчатых веществ (ВВ)', value: ab.totalExpKg.toFixed(1), unit: 'кг тротила', note: 'Масса зарядов' },
            { label: 'Трудозатраты саперов', value: ab.totalOverallLaborCh.toFixed(1), unit: 'чел-ч', note: 'Валка и минирование' },
            { label: 'Полное время устройства завала', value: ab.totalOverallTimeFormatted, unit: 'ч/мин', note: 'Время готовности' }
          ]
        },
        {
          sectionTitle: '2. ВЗРЫВНОЕ РАЗРУШЕНИЕ МОСТОВ',
          items: [
            { label: 'Конструкция моста', value: this.bridgeType(), unit: '', note: 'Материал пролетов' },
            { label: 'Расход ВВ на объект', value: br.totalExpKg.toFixed(1), unit: 'кг тротила', note: 'Расчетная масса' },
            { label: 'Время подготовки к подрыву', value: br.timeFormatted, unit: 'ч/мин', note: 'Монтаж зарядов' }
          ]
        }
      ],
      calculationSteps: [
        {
          parameter: '1. Расход ВВ на устройство лесного завала (M_вв)',
          formula: 'M_вв = L_завала * q_вв',
          calculation: `${ab.totalExpKg.toFixed(1)} кг тротила`,
          description: 'q_вв = 0.8 кг на 1 погонный метр лесного завала (по нормам руководства по разрушениям)'
        },
        {
          parameter: '2. Трудозатраты личного состава на валку (T_чел)',
          formula: 'T_чел = L_завала * H_труд',
          calculation: `${ab.totalOverallLaborCh.toFixed(1)} чел-ч`,
          description: 'H_труд = 0.8 чел-ч/м (ручная доочистка и подготовка деревьев к подрыву/валке)'
        },
        {
          parameter: '3. Масса зарядов ВВ для взрывного разрушения моста (M_вв_мост)',
          formula: 'M_вв = N_пролетов * q_пролет + N_опор * q_опора',
          calculation: `${br.totalExpKg.toFixed(1)} кг тротила`,
          description: `Конструкция: ${this.bridgeType()}, схема разрушения пролетных строений и промежуточных опор`
        }
      ]
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsMvz, 'МВЗ (Минные поля)');
    XLSX.utils.book_append_sheet(wb, wsPoz, 'Рубежи ПОЗ');
    XLSX.utils.book_append_sheet(wb, wsBreach, 'Разминирование и проходы');
    XLSX.utils.book_append_sheet(wb, wsCross, 'Переправы и мосты');
    XLSX.utils.book_append_sheet(wb, wsCamo, 'Маскировка и ВТО');
    XLSX.utils.book_append_sheet(wb, wsNz, 'НЗ и разрушения');

    const fileName = `Инженерные_расчеты_МОРБ_${new Date().toISOString().slice(0, 10)}.xlsx`;
    await ExcelStylerUtils.saveWorkbookWithDialog(wb, fileName);
  }
}
