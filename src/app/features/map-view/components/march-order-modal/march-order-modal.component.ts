import { Component, inject, ChangeDetectionStrategy, ViewEncapsulation, signal, computed, effect } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import * as XLSX from 'xlsx-js-style';
import { MapViewModel } from '../../viewmodels/map.viewmodel';
import { ExcelStylerUtils } from '../../utils/excel-styler.utils';

@Component({
  selector: 'app-march-order-modal',
  standalone: true,
  imports: [DecimalPipe, FormsModule, DragDropModule],
  templateUrl: './march-order-modal.component.html',
  styleUrl: './march-order-modal.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MarchOrderModalComponent {
  readonly vm = inject(MapViewModel);

  readonly speedToIrKmh = signal<number>(20);
  readonly routeLengthKm = signal<number>(100);
  readonly marchSpeedKmh = signal<number>(50);
  readonly restTimeMin = signal<number>(0);
  readonly barrierCount = signal<number>(6);
  readonly barrierSpeedKmh = signal<number>(10);

  constructor() {
    effect(() => {
      const stats = this.vm.selectedMarchRouteStats();
      if (stats && stats.totalDistanceKm > 0) {
        this.routeLengthKm.set(Math.round(stats.totalDistanceKm * 10) / 10);
        this.barrierCount.set(stats.totalBarriers);
      }
    });
  }

  readonly advancedResult = computed(() => {
    return this.vm.marchOrderService.calculateAdvancedMarch({
      avgVehicleLengthM: 8,
      distBetweenVehiclesM: 50,
      distBetweenUnitsM: 200,
      speedToIrKmh: this.speedToIrKmh(),
      routeLengthKm: this.routeLengthKm(),
      marchSpeedKmh: this.marchSpeedKmh(),
      restTimeMin: this.restTimeMin(),
      barrierCount: this.barrierCount(),
      barrierSpeedKmh: this.barrierSpeedKmh()
    });
  });

  onMarchOrderNameChange(id: string, event: Event) {
    const input = event.target as HTMLInputElement;
    this.vm.updateMarchOrderElement(id, { name: input.value });
  }

  onMarchOrderIconChange(id: string, event: Event) {
    const select = event.target as HTMLSelectElement;
    this.vm.updateMarchOrderElement(id, { icon: select.value });
  }

  onMarchOrderCompositionChange(id: string, event: Event) {
    const input = event.target as HTMLInputElement;
    this.vm.updateMarchOrderElement(id, { composition: input.value });
  }

  onMarchOrderDistanceChange(id: string, event: Event) {
    const input = event.target as HTMLInputElement;
    this.vm.updateMarchOrderElement(id, { distanceToNext: parseFloat(input.value) || 0 });
  }

  onMarchOrderDistanceUnitChange(id: string, event: Event) {
    const select = event.target as HTMLSelectElement;
    this.vm.updateMarchOrderElement(id, { distanceUnit: select.value as any });
  }

  onMarchOrderVehicleCountChange(id: string, event: Event) {
    const input = event.target as HTMLInputElement;
    this.vm.updateMarchOrderElement(id, { vehicleCount: parseInt(input.value, 10) || 0 });
  }

  onMarchOrderVehicleDistanceChange(id: string, event: Event) {
    const input = event.target as HTMLInputElement;
    this.vm.updateMarchOrderElement(id, { vehicleDistance: parseFloat(input.value) || 0 });
  }

  onMarchOrderVehicleDistanceUnitChange(id: string, event: Event) {
    const select = event.target as HTMLSelectElement;
    this.vm.updateMarchOrderElement(id, { vehicleDistanceUnit: select.value as any });
  }

  onMarchOrderVehicleLengthChange(id: string, event: Event) {
    const input = event.target as HTMLInputElement;
    this.vm.updateMarchOrderElement(id, { vehicleLength: parseFloat(input.value) || 0 });
  }

  onMarchOrderPersonnelChange(id: string, field: 'officersCount' | 'sergeantsCount' | 'soldiersCount', event: Event) {
    const input = event.target as HTMLInputElement;
    const val = Math.max(0, parseInt(input.value, 10) || 0);
    this.vm.updateMarchOrderElement(id, { [field]: val });
  }

  onAddMarchOrderElement() {
    this.vm.addMarchOrderElement('Новое подразделение', 'bmp_svoy1', '1 взвод', 3, 7.5, 50, 'm', 100, 'm');
  }

  onCdkDrop(event: CdkDragDrop<any[]>) {
    const list = [...this.vm.marchOrderElements()];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    this.vm.marchOrderService.elements.set(list);
  }

  async exportToExcel() {
    const res = this.advancedResult();
    const elements = this.vm.marchOrderElements();

    const headers = [
      '№',
      'Наименование подразделения',
      'Состав / Техника',
      'Офицеры (чел)',
      'Сержанты (чел)',
      'Солдаты (чел)',
      'Всего л/с (чел)',
      'Машин (ед)',
      'Длина маш. (м)',
      'Дистанция (м)',
      'Глубина (м)',
      'Дистанция до сл.'
    ];

    const dataRows = elements.map((el, idx) => {
      const depthM = (el.vehicleCount * el.vehicleLength) + (Math.max(0, el.vehicleCount - 1) * el.vehicleDistance);
      const totalMen = (el.officersCount || 0) + (el.sergeantsCount || 0) + (el.soldiersCount || 0);
      return [
        idx + 1,
        el.name,
        el.composition || '—',
        el.officersCount || 0,
        el.sergeantsCount || 0,
        el.soldiersCount || 0,
        totalMen,
        el.vehicleCount,
        el.vehicleLength,
        el.vehicleDistance,
        depthM,
        `${el.distanceToNext} ${el.distanceUnit === 'km' ? 'км' : 'м'}`
      ];
    });

    const totalsRow = [
      'ИТОГО ПО КОЛОННЕ',
      '',
      '',
      res.totalOfficers,
      res.totalSergeants,
      res.totalSoldiers,
      res.totalManpower,
      res.totalVehicles,
      '',
      '',
      res.totalDepthM,
      ''
    ];

    const wsElements = ExcelStylerUtils.buildTableSheet({
      title: 'ТОПОС ГИС | РАСЧЕТ МАРША И ПОХОДНОГО ПОРЯДКА КОЛОННЫ',
      subtitle: `Маршрут марша: ${this.routeLengthKm()} км | Маршевая скорость: ${this.marchSpeedKmh()} км/ч | Дата: ${new Date().toLocaleDateString('ru-RU')}`,
      kpiCards: [
        { label: 'Глубина колонны', value: `${(res.totalDepthKm).toFixed(2)} км (${res.totalDepthM} м)` },
        { label: 'Полное время марша', value: res.totalMarchTimeFormatted },
        { label: 'Личный состав', value: `${res.totalManpower} чел. (Оф: ${res.totalOfficers}, Серж: ${res.totalSergeants}, Солд: ${res.totalSoldiers})` },
        { label: 'Всего техники', value: `${res.totalVehicles} ед.` }
      ],
      headers,
      data: dataRows,
      totals: totalsRow,
      customColWidths: {
        0: 6,
        1: 28,
        2: 20,
        3: 14,
        4: 14,
        5: 14,
        6: 15,
        7: 13,
        8: 15,
        9: 15,
        10: 14,
        11: 18
      }
    });

    const wsSummary = ExcelStylerUtils.buildKeyValueSheet({
      title: 'ТОПОС ГИС | СВОДНЫЕ ПОКАЗАТЕЛИ И ВРЕМЕННОЙ ГРАФИК МАРША',
      subtitle: `Автономный расчет движения колонны подразделения на ${new Date().toLocaleDateString('ru-RU')}`,
      sections: [
        {
          sectionTitle: '1. ИСХОДНЫЕ ПАРАМЕТРЫ ДВИЖЕНИЯ И МАРШРУТА',
          items: [
            { label: 'Протяженность основного маршрута (ИР — РВ)', value: this.routeLengthKm(), unit: 'км', note: 'Основная трасса движения' },
            { label: 'Скорость выдвижения до Исходного Рубежа (ИР)', value: this.speedToIrKmh(), unit: 'км/ч', note: 'Выход из района расположения' },
            { label: 'Маршевая скорость движения на трассе', value: this.marchSpeedKmh(), unit: 'км/ч', note: 'Средняя скорость по маршруту' },
            { label: 'Количество барьерных рубежей / мостов / теснин', value: this.barrierCount(), unit: 'шт.', note: 'Участки замедления движения' },
            { label: 'Скорость прохождения барьерных рубежей', value: this.barrierSpeedKmh(), unit: 'км/ч', note: 'Сниженная скорость на переправах' },
            { label: 'Суммарное время запланированных привалов', value: this.restTimeMin(), unit: 'мин.', note: 'Короткие и дневные привалы' }
          ]
        },
        {
          sectionTitle: '2. ВРЕМЕННЫЕ И ДИСТАНЦИОННЫЕ НОРМАТИВЫ МАРША',
          items: [
            { label: 'Удаление Исходного Рубежа (ИР)', value: res.irDistanceKm, unit: 'км', note: 'Расстояние до рубежа начала марша' },
            { label: 'Время выхода головы колонны к ИР', value: res.timeToIrMin.toFixed(1), unit: 'мин.', note: 'Выдвижение головного дозора' },
            { label: 'Время вытягивания колонны через ИР', value: res.timeStretchMin.toFixed(1), unit: 'мин.', note: 'Прохождение замыкающей машины через ИР' },
            { label: 'Чистое время движения по маршруту (ИР — РВ)', value: res.pureTravelTimeMin.toFixed(1), unit: 'мин.', note: 'Без учета задержек и привалов' },
            { label: 'Суммарная задержка на барьерных рубежах', value: res.barrierDelayFormatted, unit: 'мин.', note: 'Дополнительное время на препятствиях' },
            { label: 'ПОЛНОЕ ВРЕМЯ СОВЕРШЕНИЯ МАРША', value: res.totalMarchTimeFormatted, unit: 'ч / мин', note: 'От выхода головы до РВ замыкающей' }
          ]
        },
        {
          sectionTitle: '3. СВОДНЫЙ СОСТАВ СИЛ И ГЛУБИНА КОЛОННЫ',
          items: [
            { label: 'Всего личного состава', value: res.totalManpower, unit: 'чел.', note: 'Суммарная численность по штату' },
            { label: '— Офицерский состав', value: res.totalOfficers, unit: 'чел.', note: 'Командный состав подразделений' },
            { label: '— Сержантский состав', value: res.totalSergeants, unit: 'чел.', note: 'Младшие командиры' },
            { label: '— Солдатский состав / рядовые', value: res.totalSoldiers, unit: 'чел.', note: 'Рядовой состав' },
            { label: 'Общее количество техники в колонне', value: res.totalVehicles, unit: 'ед.', note: 'Все типы колесных и гусеничных машин' },
            { label: 'Общая глубина походной колонны', value: `${(res.totalDepthKm).toFixed(2)} км (${res.totalDepthM} м)`, unit: 'км (м)', note: 'С учетом дистанций между частями' }
          ]
        }
      ]
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsElements, 'Походный порядок');
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Показатели марша');

    const fileName = `Расчет_марша_${new Date().toISOString().slice(0, 10)}.xlsx`;
    await ExcelStylerUtils.saveWorkbookWithDialog(wb, fileName);
  }
}
