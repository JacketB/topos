import { Component, inject, signal, computed, ChangeDetectionStrategy, ViewEncapsulation } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx-js-style';
import { MapViewModel } from '../../viewmodels/map.viewmodel';
import { ExcelStylerUtils } from '../../utils/excel-styler.utils';

export interface MineInfo {
  name: string;
  type: string;
  effect: string;
  normPerKm: number;
  steps: number[];
  defaultStep: number;
  rowDistance: number;
}

export const MINES_CATALOG: MineInfo[] = [
  { name: 'ТМ-62М', type: 'Противотанковая контактная', effect: 'Противогусеничная нажимная', normPerKm: 750, steps: [4.0, 5.5], defaultStep: 5.5, rowDistance: 30 },
  { name: 'ТМ-62П3', type: 'Противотанковая контактная', effect: 'Противогусеничная нажимная', normPerKm: 750, steps: [4.0, 5.5], defaultStep: 5.5, rowDistance: 30 },
  { name: 'ТМ-72', type: 'Противотанковая противоднищевая', effect: 'Противоднищевая неконтактная', normPerKm: 350, steps: [5.5, 8.0, 11.0], defaultStep: 5.5, rowDistance: 30 },
  { name: 'ТМ-89', type: 'Противотанковая противоднищевая', effect: 'Противоднищевая кумулятивная', normPerKm: 350, steps: [5.5, 8.0, 11.0], defaultStep: 5.5, rowDistance: 30 },
  { name: 'ПМН-2', type: 'Противопехотная фугасная', effect: 'Нажимное фугасное', normPerKm: 2000, steps: [1.0, 2.0], defaultStep: 1.0, rowDistance: 15 },
  { name: 'ПМН-4', type: 'Противопехотная фугасная', effect: 'Нажимное фугасное', normPerKm: 2000, steps: [1.0, 2.0], defaultStep: 1.0, rowDistance: 15 },
  { name: 'ПОМЗ-2М', type: 'Противопехотная осколочная', effect: 'Натяжное осколочное', normPerKm: 250, steps: [4.0, 6.0, 8.0], defaultStep: 4.0, rowDistance: 15 },
  { name: 'ОЗМ-72', type: 'Противопехотная осколочная', effect: 'Выпрыгивающее осколочное', normPerKm: 50, steps: [15.0, 20.0, 25.0], defaultStep: 15.0, rowDistance: 20 },
  { name: 'МОН-50', type: 'Противопехотная осколочная', effect: 'Направленного поражения', normPerKm: 30, steps: [10.0, 15.0], defaultStep: 10.0, rowDistance: 15 },
  { name: 'ПФМ-1С', type: 'Противопехотная кассетная', effect: 'Дистанционное кассетное', normPerKm: 4000, steps: [0.5, 1.0], defaultStep: 0.5, rowDistance: 10 }
];

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

  readonly activeTab = signal<'mvz_infantry' | 'mvz_tech' | 'nz' | 'uz'>('mvz_infantry');

  readonly infantryMineName = signal<string>('ТМ-72');
  readonly infantryFrontM = signal<number>(2000);
  readonly infantryRows = signal<number>(4);
  readonly infantryStepM = signal<number>(4);
  readonly infantryUnit = signal<'squad' | 'platoon' | 'company'>('squad');
  readonly infantryRatePerHr = signal<number>(15);

  readonly techMineName = signal<string>('ТМ-72');
  readonly techFrontM = signal<number>(1000);
  readonly techRows = signal<number>(4);
  readonly techStepM = signal<number>(4);
  readonly techVehicleType = signal<'gmz2' | 'gmz3' | 'gmz3_platoon'>('gmz3');
  readonly techDeployMethod = signal<'ground' | 'soil' | 'snow'>('ground');
  readonly techReloadDistKm = signal<number>(15);

  readonly abatisFrontM = signal<number>(100);
  readonly abatisDepthM = signal<number>(30);
  readonly abatisMethod = signal<'chainsaw' | 'explosive'>('chainsaw');
  readonly abatisTreeDiameterCm = signal<number>(45);
  readonly abatisUnit = signal<'squad' | 'platoon' | 'company'>('squad');
  readonly abatisWithMines = signal<boolean>(false);
  readonly abatisPtmCount = signal<number>(0);
  readonly abatisPpmCount = signal<number>(0);

  readonly bridgeCount = signal<number>(1);
  readonly bridgeType = signal<'reinforced_concrete' | 'metal' | 'wooden'>('metal');
  readonly bridgeTarget = signal<'full' | 'piers' | 'spans' | 'elements'>('elements');
  readonly bridgePiersCount = signal<number>(0);
  readonly bridgeSpansCount = signal<number>(0);
  readonly bridgeElementsCount = signal<number>(0);
  readonly bridgeUnit = signal<'squad' | 'platoon' | 'company'>('platoon');

  readonly uzOrderTime = signal<string>('08:00');
  readonly uzDecisionMin = signal<number>(15);
  readonly uzMarchMin = signal<number>(60);
  readonly uzReconMin = signal<number>(15);
  readonly uzReturnMin = signal<number>(20);
  readonly uzReloadMin = signal<number>(30);

  readonly currentInfantryMine = computed(() => {
    return MINES_CATALOG.find(m => m.name === this.infantryMineName()) || MINES_CATALOG[0];
  });

  readonly infantryCalc = computed(() => {
    const mine = this.currentInfantryMine();
    const frontM = Math.max(1, this.infantryFrontM());
    const rows = Math.max(1, this.infantryRows());
    const stepM = Math.max(0.5, this.infantryStepM());
    const rowDistM = mine.rowDistance;

    const minesPerRow = Math.ceil(frontM / stepM);
    const totalMines = rows * minesPerRow;
    const depthM = (rows - 1) * rowDistM;
    const densityPerKm = (totalMines / (frontM / 1000));

    let manpower = 8;
    if (this.infantryUnit() === 'platoon') manpower = 24;
    if (this.infantryUnit() === 'company') manpower = 72;

    const rate = this.infantryRatePerHr();
    const unitRatePerHr = manpower * rate;
    const timeHours = unitRatePerHr > 0 ? (totalMines / unitRatePerHr) : 0;

    const trucksCount = Math.ceil(totalMines / 200);
    const shuttleTrips = Math.max(0, trucksCount - 1);

    return {
      minesPerRow,
      totalMines,
      depthM,
      densityPerKm,
      manpower,
      unitRatePerHr,
      timeHours,
      timeFormatted: this.formatHours(timeHours),
      trucksCount,
      shuttleTrips
    };
  });

  readonly techCalc = computed(() => {
    const frontM = Math.max(1, this.techFrontM());
    const rows = Math.max(1, this.techRows());
    const stepM = this.techStepM();

    const minesPerRow = Math.ceil(frontM / stepM);
    const totalMines = rows * minesPerRow;
    const densityPerKm = (totalMines / (frontM / 1000));

    let bk = 208;
    let speedKmh = 16;
    let reloadMin = 15;

    if (this.techVehicleType() === 'gmz3') {
      bk = 208;
      reloadMin = 12;
    } else if (this.techVehicleType() === 'gmz3_platoon') {
      bk = 624;
      reloadMin = 15;
    }

    if (this.techDeployMethod() === 'soil') {
      speedKmh = 6;
    } else if (this.techDeployMethod() === 'snow') {
      speedKmh = 10;
    } else {
      speedKmh = 16;
    }

    if (this.techVehicleType() === 'gmz3_platoon') {
      speedKmh = speedKmh * 3;
    }

    const deployTimeHours = ((rows * (frontM / 1000)) / speedKmh);
    const totalRuns = Math.ceil(totalMines / bk);
    const shuttles = Math.max(0, totalRuns - 1);
    const shuttleTimeHours = shuttles * ((2 * this.techReloadDistKm() / 30) + (reloadMin / 60));
    const totalTimeHours = deployTimeHours + shuttleTimeHours;

    return {
      minesPerRow,
      totalMines,
      densityPerKm,
      deployTimeHours,
      totalRuns,
      shuttles,
      shuttleTimeHours,
      totalTimeHours,
      totalTimeFormatted: this.formatHours(totalTimeHours),
      trucksNeeded: Math.ceil(totalMines / 200)
    };
  });

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
    let mineTimeHours = 0;

    if (this.abatisWithMines()) {
      totalMines = this.abatisPtmCount() + this.abatisPpmCount();
      mineLaborCh = totalMines / 3.1746;
      mineTimeHours = manpower > 0 ? (mineLaborCh / manpower) : 0;
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

  readonly uzCalc = computed(() => {
    const startStr = this.uzOrderTime() || '08:00';
    const [h, m] = startStr.split(':').map(Number);
    const startMinutes = (isNaN(h) ? 8 : h) * 60 + (isNaN(m) ? 0 : m);

    const t0 = startMinutes;
    const t1 = t0 + this.uzDecisionMin();
    const t2 = t1;
    const t3 = t2 + this.uzMarchMin();
    const t4 = t3 + this.uzReconMin();

    const installHours = this.infantryCalc().timeHours;
    const installMinutes = Math.round(installHours * 60);
    const t5 = t4 + installMinutes;
    const t6 = t5 + this.uzReturnMin();
    const t7 = t6 + this.uzReloadMin();

    return {
      t0Formatted: this.formatClock(t0),
      t1Formatted: this.formatClock(t1),
      t2Formatted: this.formatClock(t2),
      t3Formatted: this.formatClock(t3),
      t4Formatted: this.formatClock(t4),
      t5Formatted: this.formatClock(t5),
      t6Formatted: this.formatClock(t6),
      t7Formatted: this.formatClock(t7),
      installHours,
      installFormatted: this.formatHours(installHours),
      totalMissionMinutes: t7 - t0,
      totalMissionFormatted: this.formatHours((t7 - t0) / 60)
    };
  });

  private formatHours(h: number): string {
    const totalMin = Math.round(h * 60);
    const hrs = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    if (hrs === 0) return `${mins} мин.`;
    return `${hrs} ч. ${mins} мин.`;
  }

  private formatClock(totalMin: number): string {
    const normMin = totalMin % 1440;
    const hrs = Math.floor(normMin / 60);
    const mins = normMin % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  async exportAllToExcel() {
    const inf = this.infantryCalc();
    const tech = this.techCalc();
    const ab = this.abatisCalc();
    const br = this.bridgeCalc();
    const uz = this.uzCalc();

    const wsInf = ExcelStylerUtils.buildKeyValueSheet({
      title: 'ТОПОС ГИС | РАСЧЕТ МВЗ (САПЕРНЫЕ ПОДРАЗДЕЛЕНИЯ / ПЕХОТА)',
      subtitle: `Минно-взрывные заграждения вручную строевым расчетом на ${new Date().toLocaleDateString('ru-RU')}`,
      sections: [
        {
          sectionTitle: '1. ИСХОДНЫЕ ПАРАМЕТРЫ МИННОГО ПОЛЯ',
          items: [
            { label: 'Марка инженерной мины', value: this.infantryMineName(), unit: '', note: this.currentInfantryMine().type },
            { label: 'Протяженность минного поля по фронту', value: this.infantryFrontM(), unit: 'м', note: 'Ширина прикрываемого рубежа' },
            { label: 'Количество рядов минного поля', value: this.infantryRows(), unit: 'рядов', note: 'Глубина эшелонирования' },
            { label: 'Шаг минирования в ряду', value: this.infantryStepM(), unit: 'м', note: 'Расстояние между соседними минами' },
            { label: 'Расстояние между рядами', value: this.currentInfantryMine().rowDistance, unit: 'м', note: 'Межрядный интервал' }
          ]
        },
        {
          sectionTitle: '2. РАСХОД МИН И ХАРАКТЕРИСТИКИ ЗАГРАЖДЕНИЯ',
          items: [
            { label: 'Количество мин в одном ряду', value: inf.minesPerRow, unit: 'шт.', note: 'Потребность на один ряд' },
            { label: 'ОБЩИЙ РАСХОД МИН НА МИННОЕ ПОЛЕ', value: inf.totalMines, unit: 'шт.', note: 'Суммарный расход боекомплекта' },
            { label: 'Общая глубина минного поля', value: inf.depthM, unit: 'м', note: 'От первого до последнего ряда' },
            { label: 'Плотность минирования рубежа', value: inf.densityPerKm.toFixed(1), unit: 'мин/км', note: 'Фактическая плотность заграждения' }
          ]
        },
        {
          sectionTitle: '3. СИЛЫ, СРЕДСТВА И ТРАНСПОРТНЫЙ ПОДВОЗ',
          items: [
            { label: 'Привлекаемый личный состав саперов', value: inf.manpower, unit: 'чел.', note: 'Строевой расчет саперного взвода' },
            { label: 'Расчетное время установки минного поля', value: inf.timeFormatted, unit: 'ч / мин', note: 'С учетом раскладки и маскировки' },
            { label: 'Потребность в транспорте (Урал-4320)', value: inf.trucksCount, unit: 'рейсов', note: 'Грузоподъемность 4.5т / БК мин' }
          ]
        }
      ]
    });

    const wsTech = ExcelStylerUtils.buildKeyValueSheet({
      title: 'ТОПОС ГИС | РАСЧЕТ МЕХАНИЗИРОВАННОЙ УСТАНОВКИ МВЗ (ГМЗ)',
      subtitle: `Гусеничные минные заградители ГМЗ-2 / ГМЗ-3 на ${new Date().toLocaleDateString('ru-RU')}`,
      sections: [
        {
          sectionTitle: '1. ТАКТИКО-ТЕХНИЧЕСКИЕ ПАРАМЕТРЫ РАСКЛАДКИ',
          items: [
            { label: 'Тип техники / подразделение', value: this.techVehicleType(), unit: '', note: 'Инженерная техника заграждения' },
            { label: 'Способ раскладки и маскировки', value: this.techDeployMethod(), unit: '', note: 'Степень заглубления мин' },
            { label: 'Марка противотанковой мины', value: this.techMineName(), unit: '', note: 'Боекомплект заградителя' },
            { label: 'Протяженность фронта минирования', value: this.techFrontM(), unit: 'м', note: 'Длина рубежа заграждения' },
            { label: 'Количество рядов раскладки', value: this.techRows(), unit: 'рядов', note: 'Количество проходов машин' },
            { label: 'Шаг раскладки мин', value: this.techStepM(), unit: 'м', note: 'Интервал между минами' }
          ]
        },
        {
          sectionTitle: '2. РАСХОД МИН И ЧЕЛНОЧНЫЕ РЕЙСЫ',
          items: [
            { label: 'ОБЩИЙ РАСХОД МИН НА РУБЕЖ', value: tech.totalMines, unit: 'шт.', note: 'Суммарный расход противотанковых мин' },
            { label: 'Плотность минирования', value: tech.densityPerKm.toFixed(1), unit: 'мин/км', note: 'Плотность противотанкового рубежа' },
            { label: 'Количество челночных выездов (БК)', value: tech.totalRuns, unit: 'рейсов', note: 'Перезарядок заградителей в ЗРС' }
          ]
        },
        {
          sectionTitle: '3. ВРЕМЕННЫЕ ПОКАЗАТЕЛИ И АВТОПОДВОЗ',
          items: [
            { label: 'Время чистой раскладки мин на рубеже', value: this.formatHours(tech.deployTimeHours), unit: 'ч / мин', note: 'Движение с минированием' },
            { label: 'Время челночных дозарядок в ЗРС', value: this.formatHours(tech.shuttleTimeHours), unit: 'ч / мин', note: 'Переходы и загрузка БК' },
            { label: 'ПОЛНОЕ ВРЕМЯ МИНИРОВАНИЯ РУБЕЖА', value: tech.totalTimeFormatted, unit: 'ч / мин', note: 'От начала до готовности рубежа' },
            { label: 'Потребность в автоподвозе (Урал-4320)', value: tech.trucksNeeded, unit: 'авто', note: 'Для бесперебойной доставки БК' }
          ]
        }
      ]
    });

    const wsNz = ExcelStylerUtils.buildKeyValueSheet({
      title: 'ТОПОС ГИС | РАСЧЕТ НЕВЗРЫВНЫХ ЗАГРАЖДЕНИЙ И РАЗРУШЕНИЙ',
      subtitle: `Устройство лесных завалов и взрывное разрушение мостов на ${new Date().toLocaleDateString('ru-RU')}`,
      sections: [
        {
          sectionTitle: '1. ЛЕСНЫЕ ЗАВАЛЫ (НЕВЗРЫВНЫЕ ЗАГРАЖДЕНИЯ)',
          items: [
            { label: 'Площадь устраиваемого завала', value: ab.areaHa.toFixed(3), unit: 'га', note: 'Общая площадь перекрытия' },
            { label: 'Способ валки деревьев', value: this.abatisMethod(), unit: '', note: 'Технологический способ' },
            { label: 'Расход взрывчатых веществ (ВВ)', value: ab.totalExpKg.toFixed(1), unit: 'кг тротила', note: 'Масса накладных/кумулятивных зарядов' },
            { label: 'Трудозатраты саперного подразделения', value: ab.totalOverallLaborCh.toFixed(1), unit: 'чел-ч', note: 'Подготовка и валка' },
            { label: 'Полное время устройства завала', value: ab.totalOverallTimeFormatted, unit: 'ч / мин', note: 'Время готовности заграждения' }
          ]
        },
        {
          sectionTitle: '2. ВЗРЫВНОЕ РАЗРУШЕНИЕ МОСТОВ (СПЕЦИАЛЬНЫЕ РАБОТЫ)',
          items: [
            { label: 'Конструкция и тип моста', value: this.bridgeType(), unit: '', note: 'Материал пролетных строений и опор' },
            { label: 'Расход взрывчатых веществ на объект', value: br.totalExpKg.toFixed(1), unit: 'кг тротила', note: 'Расчетная масса зарядов' },
            { label: 'Трудоемкость подготовки и минирования', value: br.totalLaborCh.toFixed(1), unit: 'чел-ч', note: 'Установка зарядов и детонаторов' },
            { label: 'Время подготовки моста к подрыву', value: br.timeFormatted, unit: 'ч / мин', note: 'До команды на подрыв' }
          ]
        }
      ]
    });

    const uzHeaders = ['№', 'Этап боевой работы', 'Время на часах (чч:мм)', 'Содержание и назначение действий'];
    const uzData = [
      ['1', 'Получение распоряжения на устройство заграждений', uz.t0Formatted, 'Постановка боевой задачи командиру ПОЗ / ООД'],
      ['2', 'Принятие решения командиром и отдача боевого приказа', uz.t1Formatted, 'Оценка обстановки, расчет сил, постановка задач'],
      ['3', 'Начало выдвижения и прохождение Исходного Пункта (ИП)', uz.t2Formatted, 'Выход колонны техники из исходного района'],
      ['4', 'Движение колонны к назначенному рубежу минирования', uz.t3Formatted, 'Марш по указанному маршруту с маршевой скоростью'],
      ['5', 'Рекогносцировка рубежа и разбивка минного поля', uz.t4Formatted, 'Определение створов, привязка к ориентирам на местности'],
      ['6', 'Установка заграждения (ГОТОВНОСТЬ РУБЕЖА)', uz.t5Formatted, 'Механизированная раскладка мин, маскировка, активация взрывателей'],
      ['7', 'Возвращение подразделения заграждения в ЗРС', uz.t6Formatted, 'Сбор техники, доклад о готовности, обратный марш'],
      ['8', 'Перезарядка боекомплекта заградителей в ЗРС', uz.t7Formatted, 'Загрузка мин из автотранспорта подвоза, подготовка к новому выезду']
    ];

    const wsUz = ExcelStylerUtils.buildTableSheet({
      title: 'ТОПОС ГИС | РАСЧЕТ ВРЕМЕНИ ГОТОВНОСТИ УЗЛА ЗАГРАЖДЕНИЙ (УЗ)',
      subtitle: `Пошаговый цикловой график боевой работы маневренного отряда заграждений на ${new Date().toLocaleDateString('ru-RU')}`,
      kpiCards: [
        { label: 'Полное время задачи', value: uz.totalMissionFormatted },
        { label: 'Готовность рубежа (T5)', value: uz.t5Formatted },
        { label: 'Время получения задачи (T0)', value: uz.t0Formatted },
        { label: 'Перезарядка БК (T7)', value: uz.t7Formatted }
      ],
      headers: uzHeaders,
      data: uzData,
      customColWidths: {
        0: 6,
        1: 42,
        2: 20,
        3: 50
      },
      enableAutofilter: false
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsInf, 'МВЗ (Пехота)');
    XLSX.utils.book_append_sheet(wb, wsTech, 'МВЗ (Техника)');
    XLSX.utils.book_append_sheet(wb, wsNz, 'НЗ и разрушения');
    XLSX.utils.book_append_sheet(wb, wsUz, 'Узел заграждений (УЗ)');

    const fileName = `Инженерные_расчеты_заграждений_${new Date().toISOString().slice(0, 10)}.xlsx`;
    await ExcelStylerUtils.saveWorkbookWithDialog(wb, fileName);
  }
}
