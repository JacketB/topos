import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { MapViewModel } from '../../viewmodels/map.viewmodel';
import { FortificationCalculationService } from '../../services/fortification-calculation.service';

export interface VopTask {
  id: number;
  phase: number; // 1 - I очередь, 2 - II очередь
  name: string;
  objectName: string;
  unit: string;
  qty: number;
  laborNorm: number; // чел.-ч на единицу
  machNorm: number;  // маш.-ч на единицу
  machType: string;  // ID выбранной техники из списка machDevices
}

export interface MachDevice {
  id: string;
  name: string;
  type: string; // 'eov' | 'pzm' | 'mdk' | 'bu' | 'none'
  basePerf: number; // базовая производительность, м³/ч
  currentPerf: number; // текущая производительность, м³/ч
  efficiency: number; // КТГ (0.1 - 1.0)
  notes: string;
}

export interface GanttSegment {
  startCal: number;
  endCal: number;
  duration: number;
}

@Component({
  selector: 'app-fortification-planner',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  templateUrl: './fortification-planner.component.html',
  styleUrl: './fortification-planner.component.css',
  host: {
    style: 'display: contents;'
  }
})
export class FortificationPlannerComponent {
  readonly vm = inject(MapViewModel);
  readonly fortCalcService = inject(FortificationCalculationService);

  // Параметры расчета
  readonly manpower = signal<number>(20); // По умолчанию 20 чел
  readonly shifts = signal<number>(2);    // По умолчанию 2 смены
  readonly soilType = signal<number>(1.0);
  readonly factorNight = signal<boolean>(false);
  readonly factorWinter = signal<boolean>(false);
  readonly workHoursPerDay = signal<number>(24); // Рабочих часов в день (по умолчанию 24)

  // Изначально очереди пустые по требованию пользователя
  readonly vopTasks = signal<VopTask[]>([]);

  // Парк доступной техники с КТГ и производительностью
  readonly machDevices = signal<MachDevice[]>([
    { id: 'eov', name: 'ЭОВ-4421 (экскаватор)', type: 'eov', basePerf: 60, currentPerf: 60, efficiency: 0.90, notes: 'Военный одноковшовый экскаватор на шасси КрАЗ-255Б.' },
    { id: 'pzm', name: 'ПЗМ-2 (землеройная)', type: 'pzm', basePerf: 100, currentPerf: 100, efficiency: 0.85, notes: 'Полковая землеройная машина для отрывки траншей и котлованов.' },
    { id: 'mdk', name: 'МДК-3 (котлованная)', type: 'mdk', basePerf: 120, currentPerf: 120, efficiency: 0.80, notes: 'Машина для отрывки котлованов под убежища.' },
    { id: 'bu', name: 'Встроенное БУ (бульдозер)', type: 'bu', basePerf: 30, currentPerf: 30, efficiency: 0.95, notes: 'Встроенное бульдозерное оборудование инженерных машин.' },
    { id: 'none', name: 'Вручную', type: 'none', basePerf: 1.5, currentPerf: 1.5, efficiency: 1.00, notes: 'Выполнение работ личным составом вручную.' }
  ]);

  // Добавление новой машины в парк
  addDevice() {
    const current = this.machDevices();
    const nextId = 'custom_' + Date.now();
    const newDev: MachDevice = {
      id: nextId,
      name: 'Новый экскаватор',
      type: 'eov',
      basePerf: 60,
      currentPerf: 60,
      efficiency: 0.90,
      notes: 'Пользовательская инженерная машина.'
    };
    this.machDevices.set([...current, newDev]);
  }

  // Удаление машины из парка
  removeDevice(id: string) {
    if (id === 'none') return;
    this.machDevices.set(this.machDevices().filter(d => d.id !== id));
  }

  // Обновление полей машины
  updateDeviceField(id: string, field: keyof MachDevice, event: Event) {
    const selectOrInput = event.target as any;
    let val = selectOrInput.value;
    if (field === 'basePerf' || field === 'currentPerf') val = parseFloat(val) || 0;
    if (field === 'efficiency') val = Math.min(1, Math.max(0.1, parseFloat(val) || 1));

    const list = this.machDevices().map(d => {
      if (d.id === id) {
        const updated = { ...d, [field]: val };
        // При смене базового типа устанавливаем базовые производительности
        if (field === 'type') {
          const basePerfs: Record<string, number> = { eov: 60, pzm: 100, mdk: 120, bu: 30, none: 1.5 };
          updated.basePerf = basePerfs[val as string] || 60;
          updated.currentPerf = updated.basePerf;
        }
        return updated;
      }
      return d;
    });
    this.machDevices.set(list);
  }

  // Вспомогательная функция разбиения работы на ежедневные сегменты
  private getSegments(startWork: number, endWork: number, dayLimit: number): GanttSegment[] {
    const segments: GanttSegment[] = [];
    if (endWork <= startWork) return segments;

    // Если рабочий день равен или больше 24 часов, работа идет без разрывов
    if (dayLimit >= 24) {
      segments.push({
        startCal: startWork,
        endCal: endWork,
        duration: endWork - startWork
      });
      return segments;
    }

    const startDay = Math.floor(startWork / dayLimit);
    const endDay = Math.floor((endWork - 0.001) / dayLimit);

    for (let d = startDay; d <= endDay; d++) {
      const dayStartWork = d * dayLimit;
      const dayEndWork = (d + 1) * dayLimit;

      const segStartWork = Math.max(startWork, dayStartWork);
      const segEndWork = Math.min(endWork, dayEndWork);

      if (segEndWork > segStartWork) {
        const startCal = d * 24 + (segStartWork - dayStartWork);
        const endCal = d * 24 + (segEndWork - dayStartWork);
        segments.push({
          startCal,
          endCal,
          duration: endCal - startCal
        });
      }
    }

    return segments;
  }

  // Добавление новой задачи в очередь
  addTask(phase: number) {
    const list = [...this.vopTasks()];
    const newId = list.length > 0 ? Math.max(...list.map(t => t.id)) + 1 : 1;
    list.push({
      id: newId,
      phase,
      name: 'Новое сооружение',
      objectName: 'мсв',
      unit: 'шт.',
      qty: 1,
      laborNorm: 5.0,
      machNorm: 1.0,
      machType: 'eov'
    });
    this.vopTasks.set(list);
  }

  // Удаление задачи из очереди
  removeTask(id: number) {
    const list = this.vopTasks().filter(t => t.id !== id);
    this.vopTasks.set(list);
  }

  // Изменение полей задачи
  updateTaskField(id: number, field: string, event: Event) {
    const selectOrInput = event.target as any;
    let val = selectOrInput.value;
    if (field === 'qty') val = parseInt(val) || 0;
    if (field === 'machNorm' || field === 'laborNorm') val = parseFloat(val) || 0;

    const list = this.vopTasks().map(t => {
      if (t.id === id) {
        return { ...t, [field]: val };
      }
      return t;
    });
    this.vopTasks.set(list);
  }

  // Загрузка объектов с карты ГИС
  loadFromMap() {
    const mapItems = this.vm.placedFortifications();
    if (mapItems.length === 0) {
      alert('На карте не обнаружено фортификационных сооружений.');
      return;
    }

    let bmpCount = 0;
    let trenchLength = 0;
    let cellCount = 0;
    let commLength = 0;
    let blindageCount = 0;
    let shelterCount = 0;

    mapItems.forEach(item => {
      if (!item.properties) return;
      const isLinear = item.properties.isLinear;
      const key = isLinear ? item.properties.lineType : item.properties.symbol;
      if (!key) return;

      if (isLinear) {
        const length = this.fortCalcService.calculateLineLength(item.properties.origCoords || []);
        if (key === 'trench') trenchLength += length;
        else if (key === 'comm_open' || key === 'comm_covered') commLength += length;
      } else {
        if (key === 'fort_bmp_trench' || key === 'fort_tank_trench') bmpCount += 1;
        else if (key === 'fort_trench_shelter') cellCount += 1;
        else if (key === 'fort_blindage' || key === 'blindazh' || key === 'blindazh_zhb') blindageCount += 1;
        else if (key === 'schel_per1' || key === 'fort_knp' || key === 'fort_dzot' || key === 'fort_dot') shelterCount += 1;
      }
    });

    // Инициализируем массив 7 армейскими задачами ВОП
    const tasks: VopTask[] = [
      { id: 1, phase: 1, name: 'Отрывка основных окопов БМП (танков)', objectName: '1, 2, 3 мсо', unit: 'шт.', qty: Math.ceil(bmpCount / 2), laborNorm: 6.0, machNorm: 1.0, machType: 'eov' },
      { id: 2, phase: 1, name: 'Отрывка траншей', objectName: '1, 2, 3 мсо', unit: 'м', qty: Math.round(trenchLength), laborNorm: 0.3, machNorm: 0.013, machType: 'eov' },
      { id: 3, phase: 1, name: 'Устройство стрелковых ячеек в траншее', objectName: '1, 2, 3 мсо', unit: 'шт.', qty: cellCount, laborNorm: 2.5, machNorm: 0, machType: 'none' },
      { id: 4, phase: 2, name: 'Отрыв запасных окопов БМП (танков)', objectName: '1, 2, 3 мсо', unit: 'шт.', qty: Math.floor(bmpCount / 2), laborNorm: 6.0, machNorm: 1.0, machType: 'eov' },
      { id: 5, phase: 2, name: 'Отрыв ходов сообщения', objectName: 'мсв', unit: 'м', qty: Math.round(commLength), laborNorm: 0.3, machNorm: 0.013, machType: 'eov' },
      { id: 6, phase: 2, name: 'Отрыв котлована под убежище на взвод', objectName: 'мсв', unit: 'шт.', qty: shelterCount, laborNorm: 12.0, machNorm: 2.0, machType: 'mdk' },
      { id: 7, phase: 2, name: 'Отрыв котлована под блиндаж на отделение', objectName: 'мсв', unit: 'шт.', qty: blindageCount, laborNorm: 8.0, machNorm: 1.0, machType: 'eov' }
    ];

    // Импортируем только те типы сооружений, которые реально расставлены на карте (qty > 0)
    this.vopTasks.set(tasks.filter(t => t.qty > 0));
  }

  // Изменение количества через кнопки
  changeQty(index: number, delta: number) {
    const list = [...this.vopTasks()];
    const item = list[index];
    if (!item) return;
    if (item.unit === 'м') {
      item.qty = Math.max(0, item.qty + delta * 50);
    } else {
      item.qty = Math.max(0, item.qty + delta);
    }
    this.vopTasks.set(list);
  }

  // Интегральные расчеты ВОП
  readonly vopCalculations = computed(() => {
    const tasks = this.vopTasks();
    const manpowerVal = this.manpower();
    const shiftsVal = this.shifts();
    const soil = this.soilType();
    const dayLimit = this.workHoursPerDay();
    const devicesList = this.machDevices();
    
    const night = this.factorNight() ? 1.3 : 1.0;
    const winter = this.factorWinter() ? 1.5 : 1.0;
    const conditions = night * winter;

    const workersInShift = Math.floor(manpowerVal / (shiftsVal === 1 ? 1 : (shiftsVal === 2 ? 1.5 : 2)));
    const rowsCalculations: any[] = [];
    
    let currentMachTimeWork = 0;
    let phase1EndManTimeWork = 0;

    // Преобразуем список техники в словарь по id
    const devices = devicesList.reduce((acc, d) => {
      acc[d.id] = d;
      return acc;
    }, {} as Record<string, MachDevice>);

    // Вспомогательная функция перевода в календарные часы
    const toCal = (w: number) => {
      if (dayLimit >= 24) return w;
      const days = Math.floor(w / dayLimit);
      const remainder = w % dayLimit;
      return days * 24 + remainder;
    };

    // Считаем I очередь
    tasks.forEach(task => {
      if (task.phase !== 1) return;
      
      const dev = devices[task.machType] || devices['none'] || { id: 'none', basePerf: 1.5, currentPerf: 1.5, efficiency: 1.00 };
      
      // Коэффициент производительности (базовая / реальная)
      const perfFactor = dev.currentPerf > 0 ? (dev.basePerf / dev.currentPerf) : 1;
      
      // Машинное время с учетом КТГ и производительности (если это не ручной труд)
      const machTotal = dev.id !== 'none'
        ? (task.qty * task.machNorm * perfFactor / dev.efficiency)
        : 0;

      // Ручной труд л/с
      const laborTotal = task.qty * task.laborNorm * soil * conditions;
      
      const machStartWork = currentMachTimeWork;
      const machEndWork = currentMachTimeWork + machTotal;
      currentMachTimeWork = machEndWork;

      const manStartWork = task.unit === 'м' ? (machStartWork + machTotal * 0.3) : machEndWork;
      const manDuration = workersInShift > 0 ? (laborTotal / workersInShift) : 0;
      const manEndWork = manStartWork + manDuration;

      const machStartCal = toCal(machStartWork);
      const machEndCal = toCal(machEndWork);
      const manStartCal = toCal(manStartWork);
      const manEndCal = toCal(manEndWork);

      const machSegments = this.getSegments(machStartWork, machEndWork, dayLimit);
      const manSegments = this.getSegments(manStartWork, manEndWork, dayLimit);

      rowsCalculations.push({
        ...task,
        machStartWork,
        machEndWork,
        manStartWork,
        manEndWork,
        machStartCal,
        machEndCal,
        manStartCal,
        manEndCal,
        laborTotal,
        machTotal,
        machSegments,
        manSegments
      });
    });

    phase1EndManTimeWork = Math.max(...rowsCalculations.filter(r => r.phase === 1).map(r => r.manEndWork), 0);
    currentMachTimeWork = Math.max(currentMachTimeWork, phase1EndManTimeWork);

    // Считаем II очередь
    tasks.forEach(task => {
      if (task.phase !== 2) return;

      const dev = devices[task.machType] || devices['none'] || { id: 'none', basePerf: 1.5, currentPerf: 1.5, efficiency: 1.00 };
      
      const perfFactor = dev.currentPerf > 0 ? (dev.basePerf / dev.currentPerf) : 1;
      
      const machTotal = dev.id !== 'none'
        ? (task.qty * task.machNorm * perfFactor / dev.efficiency)
        : 0;

      const laborTotal = task.qty * task.laborNorm * soil * conditions;
      
      const machStartWork = currentMachTimeWork;
      const machEndWork = currentMachTimeWork + machTotal;
      currentMachTimeWork = machEndWork;

      const manStartWork = task.unit === 'м' ? (machStartWork + machTotal * 0.3) : machEndWork;
      const manDuration = workersInShift > 0 ? (laborTotal / workersInShift) : 0;
      const manEndWork = manStartWork + manDuration;

      const machStartCal = toCal(machStartWork);
      const machEndCal = toCal(machEndWork);
      const manStartCal = toCal(manStartWork);
      const manEndCal = toCal(manEndWork);

      const machSegments = this.getSegments(machStartWork, machEndWork, dayLimit);
      const manSegments = this.getSegments(manStartWork, manEndWork, dayLimit);

      rowsCalculations.push({
        ...task,
        machStartWork,
        machEndWork,
        manStartWork,
        manEndWork,
        machStartCal,
        machEndCal,
        manStartCal,
        manEndCal,
        laborTotal,
        machTotal,
        machSegments,
        manSegments
      });
    });

    // Сводные объемы и календарные времена
    const totalEarth = rowsCalculations.reduce((sum, r) => {
      let vol = 0;
      const nameLower = r.name.toLowerCase();
      if (nameLower.includes('окоп') && (nameLower.includes('бмп') || nameLower.includes('танк'))) {
        vol = r.qty * 35;
      } else if (nameLower.includes('ячейк')) {
        vol = r.qty * 1.4;
      } else if (nameLower.includes('транш') || nameLower.includes('ход')) {
        vol = r.qty * 0.8;
      } else if (nameLower.includes('убежищ')) {
        vol = r.qty * 15;
      } else if (nameLower.includes('блиндаж')) {
        vol = r.qty * 12;
      } else {
        vol = r.qty * 1.5; // Дефолтный объем
      }
      return sum + vol;
    }, 0);

    const totalLaborHrs = rowsCalculations.reduce((sum, r) => sum + r.laborTotal, 0);
    const totalMachHours = rowsCalculations.reduce((sum, r) => sum + r.machTotal, 0);
    
    const totalWood = rowsCalculations.reduce((sum, r) => {
      let wood = 0;
      const nameLower = r.name.toLowerCase();
      if (nameLower.includes('блиндаж')) wood = r.qty * 2.1;
      else if (nameLower.includes('убежищ')) wood = r.qty * 3.5;
      else if (nameLower.includes('транш') || nameLower.includes('ход')) wood = r.qty * 0.04;
      return sum + wood;
    }, 0);

    const totalDurationCal = Math.max(...rowsCalculations.map(r => r.manEndCal), 0);
    const phase1DurationCal = Math.max(...rowsCalculations.filter(r => r.phase === 1).map(r => r.manEndCal), 0);

    // Динамический расчет суток на выполнение работ (минимум 2 суток)
    const daysNeeded = Math.max(2, Math.ceil(totalDurationCal / 24));
    const maxCalendarTime = daysNeeded * 24;

    return {
      rows: rowsCalculations,
      totalEarth,
      totalLaborHrs,
      totalMachHours,
      totalWood,
      totalDurationCal,
      phase1DurationCal,
      maxCalendarTime,
      daysNeeded
    };
  });

  // Динамические индексы дней и периодов для верстки HTML
  readonly dayIndices = computed(() => {
    const days = this.vopCalculations().daysNeeded;
    return Array.from({ length: days }, (_, i) => i);
  });

  readonly periodIndices = computed(() => {
    const days = this.vopCalculations().daysNeeded;
    return Array.from({ length: days * 6 }, (_, i) => i);
  });

  // Сводный график - computed точки SVG
  readonly chartPoints = computed(() => {
    const res = this.vopCalculations();
    const totalTime = res.totalDurationCal;
    const totalEarth = res.totalEarth;
    const totalManpower = this.manpower();
    const shiftsVal = this.shifts();

    if (totalTime === 0 || totalEarth === 0) {
      return { manpowerPts: '0,180 400,180', earthPts: '0,180 400,180', activeWorkers: 0, restingWorkers: 0, activeWorkersH: 180, totalH: 0, p1x: 0, p1y: 180, p2y: 180 };
    }

    const activeWorkers = Math.floor(totalManpower / (shiftsVal === 1 ? 1 : (shiftsVal === 2 ? 1.5 : 2)));
    const restingWorkers = totalManpower - activeWorkers;

    const hScale = 180 / totalManpower;
    const wScale = 400 / totalTime;
    const activeWorkersH = 180 - (activeWorkers * hScale);
    const totalH = 180 - (totalManpower * hScale);

    const manpowerPts = `0,180 0,${activeWorkersH} ${totalTime * wScale},${activeWorkersH} 400,180`;

    const e1 = res.rows.filter(r => r.phase === 1).reduce((sum, r) => {
      let vol = 0;
      const nameLower = r.name.toLowerCase();
      if (nameLower.includes('окоп') && (nameLower.includes('бмп') || nameLower.includes('танк'))) {
        vol = r.qty * 35;
      } else if (nameLower.includes('транш')) {
        vol = r.qty * 0.8;
      }
      return sum + vol;
    }, 0);

    const eyScale = 180 / totalEarth;
    const p1y = 180 - (e1 * eyScale);
    const p2y = 0;

    const earthPts = `0,180 0,180 ${res.phase1DurationCal * wScale},${p1y} ${totalTime * wScale},${p2y} 400,180`;

    return {
      manpowerPts,
      earthPts,
      activeWorkers,
      restingWorkers,
      activeWorkersH,
      totalH,
      p1x: res.phase1DurationCal * wScale,
      p1y,
      p2y
    };
  });

  // Предупреждения ВОП
  readonly timelineWarning = computed(() => {
    const res = this.vopCalculations();
    if (res.phase1DurationCal > 12) {
      return `<strong>Предупреждение по боеготовности:</strong> I очередь работ (окопы для стрельбы и основные окопы БМП) займет <strong>${res.phase1DurationCal.toFixed(1)} ч.</strong>, что превышает нормативный срок (12 часов) для перехода к обороне. <em>Рекомендация: увеличьте численность личного состава или перейдите на 3-сменный режим.</em>`;
    }
    return null;
  });
}
