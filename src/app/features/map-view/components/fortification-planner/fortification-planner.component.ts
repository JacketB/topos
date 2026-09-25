import { Component, inject, signal, computed, effect, untracked } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx-js-style';
import { MapViewModel } from '../../viewmodels/map.viewmodel';
import { FortificationCalculationService } from '../../services/fortification-calculation.service';
import { ExcelStylerUtils } from '../../utils/excel-styler.utils';

export interface MachAllocation {
  machType: string;
  qty: number;
}

export interface VopTask {
  id: number;
  phase: number;
  name: string;
  objectName: string;
  unit: string;
  qty: number;
  laborNorm: number;
  machNorm: number;
  machType?: string;
  machQty?: number;
  machAllocations?: MachAllocation[];
  earthNorm?: number;
  woodNorm?: number;
  boardsNorm?: number;
  wireViazNorm?: number;
  masNetNorm?: number;
  trapsNorm?: number;
  doorsNorm?: number;
  stovesNorm?: number;
  fvuNorm?: number;
  kvsNorm?: number;
}

export interface MachDevice {
  id: string;
  name: string;
  type: string;
  basePerf: number;
  currentPerf: number;
  efficiency: number;
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
  imports: [CommonModule, DecimalPipe, FormsModule],
  templateUrl: './fortification-planner.component.html',
  styleUrl: './fortification-planner.component.css',
  host: {
    style: 'display: contents;'
  }
})
export class FortificationPlannerComponent {
  readonly vm = inject(MapViewModel);
  readonly fortCalcService = inject(FortificationCalculationService);

  private loadNumber(key: string, def: number): number {
    try {
      const val = localStorage.getItem(key);
      return val !== null ? parseFloat(val) : def;
    } catch {
      return def;
    }
  }

  private loadString(key: string, def: string): string {
    try {
      const val = localStorage.getItem(key);
      return val !== null ? val : def;
    } catch {
      return def;
    }
  }

  private loadBool(key: string, def: boolean): boolean {
    try {
      const val = localStorage.getItem(key);
      return val !== null ? val === 'true' : def;
    } catch {
      return def;
    }
  }

  private loadTasks(): VopTask[] {
    try {
      const val = localStorage.getItem('topos_planner_tasks');
      return val ? JSON.parse(val) : [];
    } catch {
      return [];
    }
  }

  private loadDevices(): MachDevice[] {
    const defaultDevices: MachDevice[] = [
      { id: 'pzm', name: 'ПЗМ-2', type: 'pzm', basePerf: 120, currentPerf: 120, efficiency: 0.90, notes: 'Производительность: 120 м/ч траншей или 90 м³/ч котлованов.' },
      { id: 'eov', name: 'ЭОВ-4421', type: 'eov', basePerf: 60, currentPerf: 60, efficiency: 0.85, notes: 'Емкость ковша 0.65 м³. Отрывка окопов танков/БМП (60-70 м³/ч).' },
      { id: 'amkodor', name: 'АМКОДОР 325С', type: 'amkodor', basePerf: 45, currentPerf: 45, efficiency: 0.85, notes: 'Универсальный фронтальный погрузчик (ковш 1.9 м³). Земляные и погрузочные работы (40-50 м³/ч).' },
      { id: 'auto', name: 'Автомобили', type: 'auto', basePerf: 25, currentPerf: 25, efficiency: 0.90, notes: 'Транспортировка грунта, подвоз стройматериалов и конструкций (25-30 м³/ч).' },
      { id: 'mdk', name: 'МДК-3', type: 'mdk', basePerf: 350, currentPerf: 350, efficiency: 0.85, notes: 'Отрывка котлованов под укрытия КВС-У и блиндажи (300-400 м³/ч).' },
      { id: 'btm', name: 'БТМ-3 / ТМК-2', type: 'btm', basePerf: 500, currentPerf: 500, efficiency: 0.90, notes: 'Скоростная отрывка траншей и ходов сообщения (до 500 м/ч).' },
      { id: 'bat', name: 'БАТ-2', type: 'bat', basePerf: 200, currentPerf: 200, efficiency: 0.90, notes: 'Устройство ПТ рвов, эскарпов, засыпка и перемещение грунта (200 м³/ч).' },
      { id: 'bu', name: 'Встроенное БУ танка или САУ', type: 'bu', basePerf: 25, currentPerf: 25, efficiency: 0.80, notes: 'Самоокапывание экипажами с ножевым отвалом (25-30 м³/ч).' },
      { id: 'none', name: 'Вручную', type: 'none', basePerf: 1.5, currentPerf: 1.5, efficiency: 1.00, notes: 'Отрывка малой/большой пехотной лопатой (1.0 - 1.5 м³/ч на человека).' }
    ];

    try {
      const val = localStorage.getItem('topos_planner_devices');
      if (val) {
        const parsed: MachDevice[] = JSON.parse(val);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const list = [...parsed];
          const hasAmkodor = list.some(d => d.id === 'amkodor' || d.type === 'amkodor');
          const hasAuto = list.some(d => d.id === 'auto' || d.type === 'auto');
          if (!hasAmkodor) {
            const mdkIdx = list.findIndex(d => d.id === 'mdk');
            const amkodorDev = defaultDevices.find(d => d.id === 'amkodor')!;
            if (mdkIdx >= 0) list.splice(mdkIdx, 0, amkodorDev);
            else list.push(amkodorDev);
          }
          if (!hasAuto) {
            const mdkIdx = list.findIndex(d => d.id === 'mdk');
            const autoDev = defaultDevices.find(d => d.id === 'auto')!;
            if (mdkIdx >= 0) list.splice(mdkIdx, 0, autoDev);
            else list.push(autoDev);
          }
          return list;
        }
      }
    } catch {}

    return defaultDevices;
  }

  readonly manpower = signal<number>(this.loadNumber('topos_planner_manpower', 30));
  readonly shifts = signal<number>(this.loadNumber('topos_planner_shifts', 2));
  readonly soilType = signal<number>(this.loadNumber('topos_planner_soil', 1.0));
  readonly workHoursPerDay = signal<number>(this.loadNumber('topos_planner_hours_day', 16));

  readonly factorEnemyFire = signal<'none' | 'periodic' | 'heavy'>(this.loadString('topos_planner_factor_fire', 'none') as any);
  readonly factorContamination = signal<'none' | 'contaminated'>(this.loadString('topos_planner_factor_contam', 'none') as any);
  readonly factorTimeOfDay = signal<'day' | 'night' | 'day_night'>(this.loadString('topos_planner_factor_time', 'day') as any);
  readonly factorWinter = signal<boolean>(this.loadBool('topos_planner_factor_winter', false));

  readonly isParamsExpanded = signal<boolean>(false);
  readonly pinColumns = signal<boolean>(this.loadBool('topos_planner_pin_cols', true));

  readonly machDevices = signal<MachDevice[]>(this.loadDevices());
  readonly vopTasks = signal<VopTask[]>(this.loadTasks());

  togglePinColumns() {
    const next = !this.pinColumns();
    this.pinColumns.set(next);
    localStorage.setItem('topos_planner_pin_cols', String(next));
  }

  getTaskAllocations(task: VopTask): MachAllocation[] {
    if (task.machAllocations && task.machAllocations.length > 0) {
      return task.machAllocations;
    }
    return [{ machType: task.machType || 'none', qty: task.machQty || 1 }];
  }

  addMachAllocation(taskId: number) {
    const list = this.vopTasks().map(t => {
      if (t.id === taskId) {
        const allocs = [...this.getTaskAllocations(t)];
        allocs.push({ machType: 'eov', qty: 1 });
        return { ...t, machAllocations: allocs };
      }
      return t;
    });
    this.vopTasks.set(list);
  }

  removeMachAllocation(taskId: number, index: number) {
    const list = this.vopTasks().map(t => {
      if (t.id === taskId) {
        let allocs = [...this.getTaskAllocations(t)];
        if (allocs.length > 1) {
          allocs.splice(index, 1);
        } else {
          allocs = [{ machType: 'none', qty: 1 }];
        }
        return { ...t, machAllocations: allocs };
      }
      return t;
    });
    this.vopTasks.set(list);
  }

  updateMachAllocationType(taskId: number, index: number, event: Event) {
    const select = event.target as HTMLSelectElement;
    const newType = select.value;
    const list = this.vopTasks().map(t => {
      if (t.id === taskId) {
        const allocs = [...this.getTaskAllocations(t)];
        if (allocs[index]) {
          allocs[index] = { ...allocs[index], machType: newType };
        }
        return { ...t, machAllocations: allocs };
      }
      return t;
    });
    this.vopTasks.set(list);
  }

  updateMachAllocationQty(taskId: number, index: number, event: Event) {
    const input = event.target as HTMLInputElement;
    const qty = Math.max(1, parseInt(input.value, 10) || 1);
    const list = this.vopTasks().map(t => {
      if (t.id === taskId) {
        const allocs = [...this.getTaskAllocations(t)];
        if (allocs[index]) {
          allocs[index] = { ...allocs[index], qty };
        }
        return { ...t, machAllocations: allocs };
      }
      return t;
    });
    this.vopTasks.set(list);
  }

  constructor() {
    effect(() => {
      localStorage.setItem('topos_planner_manpower', String(this.manpower()));
      localStorage.setItem('topos_planner_shifts', String(this.shifts()));
      localStorage.setItem('topos_planner_soil', String(this.soilType()));
      localStorage.setItem('topos_planner_hours_day', String(this.workHoursPerDay()));
      localStorage.setItem('topos_planner_factor_fire', this.factorEnemyFire());
      localStorage.setItem('topos_planner_factor_contam', this.factorContamination());
      localStorage.setItem('topos_planner_factor_time', this.factorTimeOfDay());
      localStorage.setItem('topos_planner_factor_winter', String(this.factorWinter()));
      localStorage.setItem('topos_planner_devices', JSON.stringify(this.machDevices()));
      localStorage.setItem('topos_planner_tasks', JSON.stringify(this.vopTasks()));
    });

    effect(() => {
      this.vm.placedFortifications();
      this.vm.activeCalculationGroupId();
      untracked(() => {
        this.loadFromMap();
      });
    });
  }

  addDevice() {
    const current = this.machDevices();
    const nextId = 'custom_' + Date.now();
    const newDev: MachDevice = {
      id: nextId,
      name: 'Новая машина (пользовательская)',
      type: 'custom',
      basePerf: 50,
      currentPerf: 50,
      efficiency: 0.90,
      notes: 'Пользовательская единица техники.'
    };
    this.machDevices.set([...current, newDev]);
  }

  removeDevice(id: string) {
    if (id === 'none') return;
    this.machDevices.set(this.machDevices().filter(d => d.id !== id));
  }

  updateDeviceField(id: string, field: keyof MachDevice, event: Event) {
    const selectOrInput = event.target as any;
    let val = selectOrInput.value;
    if (field === 'basePerf' || field === 'currentPerf') val = parseFloat(val) || 0;
    if (field === 'efficiency') val = Math.min(1, Math.max(0.1, parseFloat(val) || 1));

    const list = this.machDevices().map(d => {
      if (d.id === id) {
        const updated = { ...d, [field]: val };
        if (field === 'type') {
          const basePerfs: Record<string, number> = {
            pzm: 120,
            eov: 60,
            amkodor: 45,
            auto: 25,
            mdk: 350,
            btm: 500,
            bat: 200,
            bu: 25,
            none: 1.5
          };
          if (val !== 'custom' && basePerfs[val as string] !== undefined) {
            updated.basePerf = basePerfs[val as string];
            updated.currentPerf = updated.basePerf;
          }
        }
        return updated;
      }
      return d;
    });
    this.machDevices.set(list);
  }

  private getSegments(startWork: number, endWork: number, dayLimit: number): GanttSegment[] {
    const segments: GanttSegment[] = [];
    if (endWork <= startWork) return segments;

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

  addTask(phase: number) {
    const list = [...this.vopTasks()];
    const newId = list.length > 0 ? Math.max(...list.map(t => t.id)) + 1 : 1;
    list.push({
      id: newId,
      phase,
      name: phase === 3 ? 'Убежище КВС-У' : (phase === 2 ? 'Блиндаж на взвод' : 'Окоп для стрельбы'),
      objectName: 'мсв',
      unit: 'шт.',
      qty: 1,
      laborNorm: phase === 3 ? 120.0 : (phase === 2 ? 8.0 : 6.0),
      machNorm: phase === 3 ? 2.0 : 1.0,
      machAllocations: [{ machType: phase === 3 ? 'mdk' : (phase === 2 ? 'eov' : 'eov'), qty: 1 }],
      earthNorm: phase === 3 ? 45.0 : (phase === 2 ? 12.0 : 35.0),
      woodNorm: phase === 2 ? 2.1 : 0,
      boardsNorm: 0,
      wireViazNorm: phase === 3 ? 15 : 0,
      masNetNorm: phase === 3 ? 50 : 20,
      trapsNorm: 0,
      doorsNorm: phase === 3 ? 2 : (phase === 2 ? 1 : 0),
      stovesNorm: phase === 3 ? 1 : (phase === 2 ? 1 : 0),
      fvuNorm: phase === 3 ? 1 : 0,
      kvsNorm: phase === 3 ? 1 : 0
    });
    this.vopTasks.set(list);
  }

  removeTask(id: number) {
    this.vopTasks.set(this.vopTasks().filter(t => t.id !== id));
  }

  updateTaskField(id: number, field: keyof VopTask, event: Event) {
    const target = event.target as any;
    let val = target.value;
    if (field === 'qty' || field === 'machQty') val = Math.max(1, parseInt(val, 10) || 1);
    if (field === 'laborNorm' || field === 'machNorm' || field === 'earthNorm' || field === 'woodNorm' ||
        field === 'boardsNorm' || field === 'wireViazNorm' || field === 'masNetNorm' ||
        field === 'trapsNorm' || field === 'doorsNorm' || field === 'stovesNorm' ||
        field === 'fvuNorm' || field === 'kvsNorm') {
      val = parseFloat(val) || 0;
    }

    const list = this.vopTasks().map(t => {
      if (t.id === id) {
        return { ...t, [field]: val };
      }
      return t;
    });
    this.vopTasks.set(list);
  }

  changeQty(id: number, delta: number) {
    const list = this.vopTasks().map(item => {
      if (item.id === id) {
        const newQty = item.unit === 'м'
          ? Math.max(0, item.qty + delta * 50)
          : Math.max(0, item.qty + delta);
        return { ...item, qty: newQty };
      }
      return item;
    });
    this.vopTasks.set(list);
  }

  loadFromMap() {
    const mapItems = this.vm.placedFortifications();
    
    let bmpCount = 0;
    let bmpEarth = 0;
    let bmpWood = 0;
    let bmpBoards = 0;
    let bmpWireViaz = 0;
    let bmpMasNet = 0;

    let trenchLength = 0;
    let trenchEarth = 0;
    let trenchWood = 0;
    let trenchBoards = 0;
    let trenchWireViaz = 0;
    let trenchMasNet = 0;
    let trenchTraps = 0;

    let cellCount = 0;
    let cellEarth = 0;

    let commLength = 0;
    let commEarth = 0;
    let commWood = 0;
    let commBoards = 0;
    let commWireViaz = 0;
    let commMasNet = 0;
    let commTraps = 0;

    let shelterCount = 0;
    let shelterEarth = 0;
    let shelterWood = 0;
    let shelterBoards = 0;
    let shelterWireViaz = 0;
    let shelterMasNet = 0;
    let shelterDoors = 0;
    let shelterStoves = 0;
    let shelterFvu = 0;
    let shelterKvs = 0;

    let blindageCount = 0;
    let blindageEarth = 0;
    let blindageWood = 0;
    let blindageBoards = 0;
    let blindageWireViaz = 0;
    let blindageMasNet = 0;
    let blindageDoors = 0;
    let blindageStoves = 0;

    let spsCount = 0;
    let fakeCount = 0;

    mapItems.forEach(item => {
      if (!item.properties) return;
      const isLinear = item.properties.isLinear;
      const key = isLinear ? item.properties.lineType : item.properties.symbol;
      if (!key) return;

      const norm = this.fortCalcService.calculateFeatureNorms(item);
      if (!norm) return;

      if (isLinear) {
        const length = this.fortCalcService.calculateLineLength(item.properties.origCoords || []);
        if (key === 'trench') {
          trenchLength += length;
          trenchEarth += norm.earthVolume;
          trenchWood += norm.woodVol || 0;
          trenchBoards += norm.boardsVol || 0;
          trenchWireViaz += norm.wireViazKg || 0;
          trenchMasNet += norm.masNetSq || 0;
          trenchTraps += norm.trapsM || 0;
        } else if (key === 'comm_open' || key === 'comm_covered') {
          commLength += length;
          commEarth += norm.earthVolume;
          commWood += norm.woodVol || 0;
          commBoards += norm.boardsVol || 0;
          commWireViaz += norm.wireViazKg || 0;
          commMasNet += norm.masNetSq || 0;
          commTraps += norm.trapsM || 0;
        }
      } else {
        if (key === 'fort_bmp_trench' || key === 'fort_tank_trench' || key === 'fort_art_trench') {
          bmpCount += 1;
          bmpEarth += norm.earthVolume;
          bmpWood += norm.woodVol || 0;
          bmpBoards += norm.boardsVol || 0;
          bmpWireViaz += norm.wireViazKg || 0;
          bmpMasNet += norm.masNetSq || 0;
        } else if (key === 'fort_trench_shelter') {
          cellCount += 1;
          cellEarth += norm.earthVolume;
        } else if (key === 'fort_blindage' || key === 'blindazh' || key === 'blindazh_zhb') {
          blindageCount += 1;
          blindageEarth += norm.earthVolume;
          blindageWood += norm.woodVol || 0;
          blindageBoards += norm.boardsVol || 0;
          blindageWireViaz += norm.wireViazKg || 0;
          blindageMasNet += norm.masNetSq || 0;
          blindageDoors += norm.doorsCount || 0;
          blindageStoves += norm.stovesCount || 0;
        } else if (key === 'schel_per1' || key === 'fort_knp' || key === 'fort_dzot' || key === 'fort_dot' || key === 'dot_tipovoy1') {
          shelterCount += 1;
          shelterEarth += norm.earthVolume;
          shelterWood += norm.woodVol || 0;
          shelterBoards += norm.boardsVol || 0;
          shelterWireViaz += norm.wireViazKg || 0;
          shelterMasNet += norm.masNetSq || 0;
          shelterDoors += norm.doorsCount || 0;
          shelterStoves += norm.stovesCount || 0;
        } else if (key === 'fort_shelter_kvs_u' || key === 'fort_shelter_kvs_a') {
          shelterCount += 1;
          shelterEarth += norm.earthVolume;
          shelterDoors += norm.doorsCount || 2;
          shelterStoves += norm.stovesCount || 1;
          shelterFvu += 1;
          shelterKvs += 1;
        } else if (key === 'sps1') {
          spsCount += 1;
        } else if (key === 'fort_fake_trench') {
          fakeCount += 1;
        }
      }
    });

    const finalCellCount = cellCount > 0 ? cellCount : (trenchLength > 0 ? 100 : 0);

    const bmpEarthNorm = bmpCount > 0 ? (bmpEarth / bmpCount) : 35;
    const bmpWoodNorm = bmpCount > 0 ? (bmpWood / bmpCount) : 0;
    const bmpBoardsNorm = bmpCount > 0 ? (bmpBoards / bmpCount) : 0;
    const bmpWireViazNorm = bmpCount > 0 ? (bmpWireViaz / bmpCount) : 0;
    const bmpMasNetNorm = bmpCount > 0 ? (bmpMasNet / bmpCount) : 0;

    const trenchEarthNorm = trenchLength > 0 ? (trenchEarth / trenchLength) : 0.8;
    const trenchWoodNorm = trenchLength > 0 ? (trenchWood / trenchLength) : 0.0;
    const trenchBoardsNorm = trenchLength > 0 ? (trenchBoards / trenchLength) : 0.0;
    const trenchWireViazNorm = trenchLength > 0 ? (trenchWireViaz / trenchLength) : 0.0;
    const trenchMasNetNorm = trenchLength > 0 ? (trenchMasNet / trenchLength) : 0.0;
    const trenchTrapsNorm = trenchLength > 0 ? (trenchTraps / trenchLength) : 0.0;

    const cellEarthNorm = cellCount > 0 ? (cellEarth / cellCount) : 1.4;

    const commEarthNorm = commLength > 0 ? (commEarth / commLength) : 0.8;
    const commWoodNorm = commLength > 0 ? (commWood / commLength) : 0.0;
    const commBoardsNorm = commLength > 0 ? (commBoards / commLength) : 0.0;
    const commWireViazNorm = commLength > 0 ? (commWireViaz / commLength) : 0.0;
    const commMasNetNorm = commLength > 0 ? (commMasNet / commLength) : 0.0;
    const commTrapsNorm = commLength > 0 ? (commTraps / commLength) : 0.0;

    const blindageEarthNorm = blindageCount > 0 ? (blindageEarth / blindageCount) : 12;
    const blindageWoodNorm = blindageCount > 0 ? (blindageWood / blindageCount) : 2.1;
    const blindageBoardsNorm = blindageCount > 0 ? (blindageBoards / blindageCount) : 0;
    const blindageWireViazNorm = blindageCount > 0 ? (blindageWireViaz / blindageCount) : 0;
    const blindageMasNetNorm = blindageCount > 0 ? (blindageMasNet / blindageCount) : 0;
    const blindageDoorsNorm = blindageCount > 0 ? (blindageDoors / blindageCount) : 0;
    const blindageStovesNorm = blindageCount > 0 ? (blindageStoves / blindageCount) : 0;

    const tasks: VopTask[] = [];
    let taskId = 1;

    if (bmpCount > 0) {
      tasks.push({
        id: taskId++,
        phase: 1,
        name: 'Отрывка основных окопов техники (машинным способом)',
        objectName: 'мсв',
        unit: 'шт.',
        qty: bmpCount,
        laborNorm: parseFloat((4.0 * (bmpEarthNorm / 35)).toFixed(2)),
        machNorm: parseFloat((0.8 * (bmpEarthNorm / 35)).toFixed(2)),
        machAllocations: [{ machType: 'eov', qty: 1 }],
        earthNorm: parseFloat(bmpEarthNorm.toFixed(2)),
        woodNorm: 0,
        boardsNorm: 0,
        wireViazNorm: 0,
        masNetNorm: 0,
        trapsNorm: 0,
        doorsNorm: 0,
        stovesNorm: 0,
        fvuNorm: 0,
        kvsNorm: 0
      });
      tasks.push({
        id: taskId++,
        phase: 1,
        name: 'Дооборудование основных окопов техники вручную',
        objectName: 'мсв',
        unit: 'шт.',
        qty: bmpCount,
        laborNorm: 8.0,
        machNorm: 0,
        machAllocations: [{ machType: 'none', qty: 1 }],
        earthNorm: 0,
        woodNorm: parseFloat(bmpWoodNorm.toFixed(2)),
        boardsNorm: parseFloat(bmpBoardsNorm.toFixed(2)),
        wireViazNorm: parseFloat(bmpWireViazNorm.toFixed(2)),
        masNetNorm: parseFloat(bmpMasNetNorm.toFixed(2)),
        trapsNorm: 0,
        doorsNorm: 0,
        stovesNorm: 0,
        fvuNorm: 0,
        kvsNorm: 0
      });
      tasks.push({
        id: taskId++,
        phase: 2,
        name: 'Отрывка запасных окопов техники (машинным способом)',
        objectName: 'мсв',
        unit: 'шт.',
        qty: bmpCount,
        laborNorm: parseFloat((4.0 * (bmpEarthNorm / 35)).toFixed(2)),
        machNorm: parseFloat((0.8 * (bmpEarthNorm / 35)).toFixed(2)),
        machAllocations: [{ machType: 'eov', qty: 1 }],
        earthNorm: parseFloat(bmpEarthNorm.toFixed(2)),
        woodNorm: 0,
        boardsNorm: 0,
        wireViazNorm: 0,
        masNetNorm: 0,
        trapsNorm: 0,
        doorsNorm: 0,
        stovesNorm: 0,
        fvuNorm: 0,
        kvsNorm: 0
      });
      tasks.push({
        id: taskId++,
        phase: 2,
        name: 'Дооборудование запасных окопов техники вручную и маскировка',
        objectName: 'мсв',
        unit: 'шт.',
        qty: bmpCount,
        laborNorm: 6.0,
        machNorm: 0,
        machAllocations: [{ machType: 'none', qty: 1 }],
        earthNorm: 0,
        woodNorm: 0,
        boardsNorm: 0,
        wireViazNorm: 0,
        masNetNorm: parseFloat(bmpMasNetNorm.toFixed(2)),
        trapsNorm: 0,
        doorsNorm: 0,
        stovesNorm: 0,
        fvuNorm: 0,
        kvsNorm: 0
      });
    }

    if (trenchLength > 0) {
      tasks.push({
        id: taskId++,
        phase: 1,
        name: 'Отрывка траншей машинным способом (ПЗМ/БТМ)',
        objectName: 'мсв',
        unit: 'м',
        qty: Math.round(trenchLength),
        laborNorm: parseFloat((0.3 * (trenchEarthNorm / 0.8)).toFixed(3)),
        machNorm: parseFloat((0.008 * (trenchEarthNorm / 0.8)).toFixed(4)),
        machAllocations: [{ machType: 'pzm', qty: 1 }],
        earthNorm: parseFloat(trenchEarthNorm.toFixed(3)),
        woodNorm: 0,
        boardsNorm: 0,
        wireViazNorm: 0,
        masNetNorm: 0,
        trapsNorm: 0,
        doorsNorm: 0,
        stovesNorm: 0,
        fvuNorm: 0,
        kvsNorm: 0
      });
      tasks.push({
        id: taskId++,
        phase: 1,
        name: 'Доотрывка вручную, зачистка траншей и водоотвод',
        objectName: 'мсв',
        unit: 'м',
        qty: Math.round(trenchLength),
        laborNorm: 0.45,
        machNorm: 0,
        machAllocations: [{ machType: 'none', qty: 1 }],
        earthNorm: parseFloat((trenchEarthNorm * 0.15).toFixed(3)),
        woodNorm: 0,
        boardsNorm: 0,
        wireViazNorm: 0,
        masNetNorm: 0,
        trapsNorm: 0,
        doorsNorm: 0,
        stovesNorm: 0,
        fvuNorm: 0,
        kvsNorm: 0
      });
      tasks.push({
        id: taskId++,
        phase: 2,
        name: 'Устройство одежды крутостей траншей',
        objectName: 'мсв',
        unit: 'м',
        qty: Math.round(trenchLength),
        laborNorm: 0.6,
        machNorm: 0,
        machAllocations: [{ machType: 'none', qty: 1 }],
        earthNorm: 0,
        woodNorm: parseFloat(trenchWoodNorm.toFixed(4)),
        boardsNorm: parseFloat(trenchBoardsNorm.toFixed(4)),
        wireViazNorm: parseFloat(trenchWireViazNorm.toFixed(2)),
        masNetNorm: parseFloat(trenchMasNetNorm.toFixed(2)),
        trapsNorm: parseFloat(trenchTrapsNorm.toFixed(2)),
        doorsNorm: 0,
        stovesNorm: 0,
        fvuNorm: 0,
        kvsNorm: 0
      });
      tasks.push({
        id: taskId++,
        phase: 2,
        name: 'Устройство перекрытых участков траншей и ячеек',
        objectName: 'мсв',
        unit: 'участков',
        qty: Math.max(1, Math.round(trenchLength / 50)),
        laborNorm: 12.0,
        machNorm: 0,
        machAllocations: [{ machType: 'none', qty: 1 }],
        earthNorm: 0,
        woodNorm: 0.8,
        boardsNorm: 0,
        wireViazNorm: 2.0,
        masNetNorm: 10.0,
        trapsNorm: 0,
        doorsNorm: 0,
        stovesNorm: 0,
        fvuNorm: 0,
        kvsNorm: 0
      });
    }

    if (cellCount > 0) {
      tasks.push({
        id: taskId++,
        phase: 1,
        name: 'Устройство одиночных стрелковых ячеек',
        objectName: 'мсв',
        unit: 'шт.',
        qty: cellCount,
        laborNorm: 2.5,
        machNorm: 0,
        machAllocations: [{ machType: 'none', qty: 1 }],
        earthNorm: parseFloat(cellEarthNorm.toFixed(2)),
        woodNorm: 0,
        boardsNorm: 0,
        wireViazNorm: 0,
        masNetNorm: 0,
        trapsNorm: 0,
        doorsNorm: 0,
        stovesNorm: 0,
        fvuNorm: 0,
        kvsNorm: 0
      });
    }

    if (commLength > 0) {
      tasks.push({
        id: taskId++,
        phase: 2,
        name: 'Отрывка ходов сообщения в тыл',
        objectName: 'мсв',
        unit: 'м',
        qty: Math.round(commLength),
        laborNorm: parseFloat((0.35 * (commEarthNorm / 0.8)).toFixed(3)),
        machNorm: parseFloat((0.01 * (commEarthNorm / 0.8)).toFixed(4)),
        machAllocations: [{ machType: 'pzm', qty: 1 }],
        earthNorm: parseFloat(commEarthNorm.toFixed(3)),
        woodNorm: 0,
        boardsNorm: 0,
        wireViazNorm: 0,
        masNetNorm: 0,
        trapsNorm: 0,
        doorsNorm: 0,
        stovesNorm: 0,
        fvuNorm: 0,
        kvsNorm: 0
      });
      tasks.push({
        id: taskId++,
        phase: 2,
        name: 'Зачистка и устройство одежды крутостей ходов сообщения',
        objectName: 'мсв',
        unit: 'м',
        qty: Math.round(commLength),
        laborNorm: 0.5,
        machNorm: 0,
        machAllocations: [{ machType: 'none', qty: 1 }],
        earthNorm: 0,
        woodNorm: parseFloat(commWoodNorm.toFixed(4)),
        boardsNorm: parseFloat(commBoardsNorm.toFixed(4)),
        wireViazNorm: parseFloat(commWireViazNorm.toFixed(2)),
        masNetNorm: parseFloat(commMasNetNorm.toFixed(2)),
        trapsNorm: parseFloat(commTrapsNorm.toFixed(2)),
        doorsNorm: 0,
        stovesNorm: 0,
        fvuNorm: 0,
        kvsNorm: 0
      });
    }

    if (blindageCount > 0) {
      tasks.push({
        id: taskId++,
        phase: 2,
        name: 'Отрывка котлована под блиндаж',
        objectName: 'мсв',
        unit: 'шт.',
        qty: blindageCount,
        laborNorm: parseFloat((8.0 * (blindageEarthNorm / 12)).toFixed(2)),
        machNorm: parseFloat((1.0 * (blindageEarthNorm / 12)).toFixed(2)),
        machAllocations: [{ machType: 'eov', qty: 1 }],
        earthNorm: parseFloat(blindageEarthNorm.toFixed(2)),
        woodNorm: 0,
        boardsNorm: 0,
        wireViazNorm: 0,
        masNetNorm: 0,
        trapsNorm: 0,
        doorsNorm: 0,
        stovesNorm: 0,
        fvuNorm: 0,
        kvsNorm: 0
      });
      tasks.push({
        id: taskId++,
        phase: 2,
        name: 'Сборка остова блиндажа и укладка наката перекрытия',
        objectName: 'мсв',
        unit: 'шт.',
        qty: blindageCount,
        laborNorm: 35.0,
        machNorm: 0,
        machAllocations: [{ machType: 'none', qty: 1 }],
        earthNorm: 0,
        woodNorm: parseFloat(blindageWoodNorm.toFixed(2)),
        boardsNorm: parseFloat(blindageBoardsNorm.toFixed(2)),
        wireViazNorm: parseFloat(blindageWireViazNorm.toFixed(2)),
        masNetNorm: 0,
        trapsNorm: 0,
        doorsNorm: 0,
        stovesNorm: 0,
        fvuNorm: 0,
        kvsNorm: 0
      });
      tasks.push({
        id: taskId++,
        phase: 3,
        name: 'Устройство гидроизоляции, входа БД-50, обсыпка грунтом и установка печи',
        objectName: 'мсв',
        unit: 'шт.',
        qty: blindageCount,
        laborNorm: 20.0,
        machNorm: 0,
        machAllocations: [{ machType: 'none', qty: 1 }],
        earthNorm: 0,
        woodNorm: 0,
        boardsNorm: 0,
        wireViazNorm: 0,
        masNetNorm: parseFloat(blindageMasNetNorm.toFixed(2)),
        trapsNorm: 0,
        doorsNorm: parseFloat(blindageDoorsNorm.toFixed(2)) || 1,
        stovesNorm: parseFloat(blindageStovesNorm.toFixed(2)) || 1,
        fvuNorm: 0,
        kvsNorm: 0
      });
    }

    if (shelterCount > 0) {
      tasks.push({
        id: taskId++,
        phase: 3,
        name: 'Отрывка котлована под убежище КВС-У',
        objectName: 'мсв',
        unit: 'шт.',
        qty: shelterCount,
        laborNorm: 15.0,
        machNorm: 2.0,
        machAllocations: [{ machType: 'mdk', qty: 1 }],
        earthNorm: 45.0,
        woodNorm: 0,
        boardsNorm: 0,
        wireViazNorm: 0,
        masNetNorm: 0,
        trapsNorm: 0,
        doorsNorm: 0,
        stovesNorm: 0,
        fvuNorm: 0,
        kvsNorm: 0
      });
      tasks.push({
        id: taskId++,
        phase: 3,
        name: 'Монтаж сборного остова убежища КВС-У и тамбура',
        objectName: 'мсв',
        unit: 'шт.',
        qty: shelterCount,
        laborNorm: 75.0,
        machNorm: 0,
        machAllocations: [{ machType: 'none', qty: 1 }],
        earthNorm: 0,
        woodNorm: 0,
        boardsNorm: 0.5,
        wireViazNorm: 15.0,
        masNetNorm: 0,
        trapsNorm: 0,
        doorsNorm: 2,
        stovesNorm: 0,
        fvuNorm: 0,
        kvsNorm: 1
      });
      tasks.push({
        id: taskId++,
        phase: 3,
        name: 'Засыпка грунтом, гидроизоляция, монтаж ФВУ и установка печи',
        objectName: 'мсв',
        unit: 'шт.',
        qty: shelterCount,
        laborNorm: 30.0,
        machNorm: 0.5,
        machAllocations: [{ machType: 'pzm', qty: 1 }],
        earthNorm: 0,
        woodNorm: 0,
        boardsNorm: 0,
        wireViazNorm: 0,
        masNetNorm: 50.0,
        trapsNorm: 0,
        doorsNorm: 0,
        stovesNorm: 1,
        fvuNorm: 1,
        kvsNorm: 0
      });
    }

    if (spsCount > 0) {
      tasks.push({
        id: taskId++,
        phase: 3,
        name: 'Отрывка котлована и установка сборного сооружения СПС-2М',
        objectName: 'мсв',
        unit: 'шт.',
        qty: spsCount,
        laborNorm: 35.0,
        machNorm: 0.3,
        machAllocations: [{ machType: 'eov', qty: 1 }],
        earthNorm: 7.0,
        woodNorm: 0,
        boardsNorm: 0,
        wireViazNorm: 5.0,
        masNetNorm: 25.0,
        trapsNorm: 0,
        doorsNorm: 1,
        stovesNorm: 0,
        fvuNorm: 0,
        kvsNorm: 0
      });
    }

    if (fakeCount > 0) {
      tasks.push({
        id: taskId++,
        phase: 3,
        name: 'Оборудование ложных окопов и позиций',
        objectName: 'мсв',
        unit: 'шт.',
        qty: fakeCount,
        laborNorm: 10.0,
        machNorm: 0.2,
        machAllocations: [{ machType: 'pzm', qty: 1 }],
        earthNorm: 15.0,
        woodNorm: 0,
        boardsNorm: 0,
        wireViazNorm: 0,
        masNetNorm: 40.0,
        trapsNorm: 0,
        doorsNorm: 0,
        stovesNorm: 0,
        fvuNorm: 0,
        kvsNorm: 0
      });
    }

    this.vopTasks.set(tasks);
  }

  onCalculationGroupChange(groupId: string) {
    this.vm.activeCalculationGroupId.set(groupId);
    this.loadFromMap();
  }

  private isMouseDown = false;
  private startX = 0;
  private scrollLeftStart = 0;

  onWrapperMouseDown(e: MouseEvent, container: HTMLDivElement) {
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'SELECT' ||
      target.tagName === 'BUTTON' ||
      target.closest('button') ||
      target.closest('select') ||
      target.closest('input')
    ) {
      return;
    }
    this.isMouseDown = true;
    container.style.cursor = 'grabbing';
    container.style.userSelect = 'none';
    this.startX = e.pageX - container.offsetLeft;
    this.scrollLeftStart = container.scrollLeft;
  }

  onWrapperMouseLeave(container: HTMLDivElement) {
    this.isMouseDown = false;
    container.style.cursor = 'grab';
    container.style.userSelect = 'auto';
  }

  onWrapperMouseUp(container: HTMLDivElement) {
    this.isMouseDown = false;
    container.style.cursor = 'grab';
    container.style.userSelect = 'auto';
  }

  onWrapperMouseMove(e: MouseEvent, container: HTMLDivElement) {
    if (!this.isMouseDown) return;
    e.preventDefault();
    const x = e.pageX - container.offsetLeft;
    const walk = (x - this.startX);
    container.scrollLeft = this.scrollLeftStart - walk;
  }

  readonly vopCalculations = computed(() => {
    const tasks = this.vopTasks();
    const manpowerVal = this.manpower();
    const shiftsVal = this.shifts();
    const soil = this.soilType();
    const dayLimit = this.workHoursPerDay();
    const devicesList = this.machDevices();
    
    const enemyFireFactor = this.factorEnemyFire() === 'heavy' ? 2.50 : (this.factorEnemyFire() === 'periodic' ? 1.43 : 1.0);
    const contaminationFactor = this.factorContamination() === 'contaminated' ? 1.33 : 1.0;
    const timeOfDayFactor = this.factorTimeOfDay() === 'night' ? 1.43 : (this.factorTimeOfDay() === 'day_night' ? 1.18 : 1.0);
    const winterFactor = this.factorWinter() ? 1.5 : 1.0;
    
    const conditions = enemyFireFactor * contaminationFactor * timeOfDayFactor * winterFactor;
    const workersInShift = Math.floor(manpowerVal / (shiftsVal === 1 ? 1 : (shiftsVal === 2 ? 1.5 : 2)));
    const rowsCalculations: any[] = [];

    const devices = devicesList.reduce((acc, d) => {
      acc[d.id] = d;
      if (d.type && !acc[d.type]) {
        acc[d.type] = d;
      }
      return acc;
    }, {} as Record<string, MachDevice>);

    const toCal = (w: number) => {
      if (dayLimit >= 24) return w;
      const days = Math.floor(w / dayLimit);
      const remainder = w % dayLimit;
      return days * 24 + remainder;
    };

    const machAvailableTime: Record<string, number> = {};
    devicesList.forEach(d => {
      machAvailableTime[d.id] = 0;
    });

    const processPhaseTasks = (phaseNum: number) => {
      tasks.forEach(task => {
        if (task.phase !== phaseNum) return;

        const allocs = this.getTaskAllocations(task);
        const activeAllocs = allocs.filter(a => a.machType !== 'none');

        let machTotal = 0;
        let machDurationWork = 0;
        let machStartWork = 0;
        let machEndWork = 0;

        if (activeAllocs.length > 0 && task.machNorm > 0) {
          machStartWork = Math.max(...activeAllocs.map(a => machAvailableTime[a.machType] || 0), 0);

          if (activeAllocs.length === 1) {
            const a = activeAllocs[0];
            const dev = devices[a.machType] || devicesList.find(d => d.id === a.machType || d.type === a.machType) || { id: 'none', basePerf: 1.5, currentPerf: 1.5, efficiency: 1.00 };
            const perfFactor = (dev.currentPerf > 0 && dev.basePerf > 0) ? (dev.basePerf / dev.currentPerf) : 1;
            machTotal = (task.qty * task.machNorm * perfFactor / (dev.efficiency || 1));
            machDurationWork = machTotal / Math.max(1, a.qty);
          } else {
            machTotal = task.qty * task.machNorm;
            const combinedCap = activeAllocs.reduce((sum, a) => {
              const dev = devices[a.machType] || devicesList.find(d => d.id === a.machType || d.type === a.machType) || { id: 'none', basePerf: 1.5, currentPerf: 1.5, efficiency: 1.00 };
              const capRatio = (dev.basePerf > 0 ? (dev.currentPerf / dev.basePerf) : 1) * (dev.efficiency || 1) * a.qty;
              return sum + capRatio;
            }, 0);
            machDurationWork = machTotal / Math.max(0.01, combinedCap);
          }

          machEndWork = machStartWork + machDurationWork;
          activeAllocs.forEach(a => {
            machAvailableTime[a.machType] = machEndWork;
          });
        }

        const laborTotal = task.qty * task.laborNorm * soil * conditions;
        const manDurationWork = workersInShift > 0 ? (laborTotal / workersInShift) : 0;
        
        let manStartWork = 0;
        if (activeAllocs.length > 0 && machDurationWork > 0) {
          manStartWork = task.unit === 'м' ? (machStartWork + machDurationWork * 0.3) : machEndWork;
        } else {
          manStartWork = 0;
        }
        const manEndWork = manStartWork + manDurationWork;

        const machStartCal = toCal(machStartWork);
        const machEndCal = toCal(machEndWork);
        const manStartCal = toCal(manStartWork);
        const manEndCal = toCal(manEndWork);

        const machSegments = this.getSegments(machStartWork, machEndWork, dayLimit);
        const manSegments = this.getSegments(manStartWork, manEndWork, dayLimit);

        rowsCalculations.push({
          ...task,
          machAllocations: allocs,
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
    };

    processPhaseTasks(1);
    const phase1EndWork = Math.max(
      ...rowsCalculations.filter(r => r.phase === 1).map(r => Math.max(r.manEndWork, r.machEndWork)),
      0
    );
    Object.keys(machAvailableTime).forEach(k => {
      machAvailableTime[k] = Math.max(machAvailableTime[k] || 0, phase1EndWork);
    });

    processPhaseTasks(2);
    const phase2EndWork = Math.max(
      ...rowsCalculations.filter(r => r.phase === 2).map(r => Math.max(r.manEndWork, r.machEndWork)),
      phase1EndWork
    );
    Object.keys(machAvailableTime).forEach(k => {
      machAvailableTime[k] = Math.max(machAvailableTime[k] || 0, phase2EndWork);
    });

    processPhaseTasks(3);

    rowsCalculations.forEach((row, idx) => {
      row.displayIndex = idx + 1;
    });

    const totalEarth = rowsCalculations.reduce((sum, r) => {
      const earthNorm = r.earthNorm !== undefined ? r.earthNorm : 1.5;
      return sum + (r.qty * earthNorm);
    }, 0);

    const totalLaborHrs = rowsCalculations.reduce((sum, r) => sum + r.laborTotal, 0);
    const totalMachHours = rowsCalculations.reduce((sum, r) => sum + r.machTotal, 0);
    const totalWood = rowsCalculations.reduce((sum, r) => sum + (r.qty * (r.woodNorm || 0)), 0);
    const totalBoards = rowsCalculations.reduce((sum, r) => sum + (r.qty * (r.boardsNorm || 0)), 0);
    const totalWireViaz = rowsCalculations.reduce((sum, r) => sum + (r.qty * (r.wireViazNorm || 0)), 0);
    const totalMasNet = rowsCalculations.reduce((sum, r) => sum + (r.qty * (r.masNetNorm || 0)), 0);
    const totalTraps = rowsCalculations.reduce((sum, r) => sum + (r.qty * (r.trapsNorm || 0)), 0);
    const totalDoors = rowsCalculations.reduce((sum, r) => sum + (r.qty * (r.doorsNorm || 0)), 0);
    const totalStoves = rowsCalculations.reduce((sum, r) => sum + (r.qty * (r.stovesNorm || 0)), 0);
    const totalFvu = rowsCalculations.reduce((sum, r) => sum + (r.qty * (r.fvuNorm || 0)), 0);
    const totalKvs = rowsCalculations.reduce((sum, r) => sum + (r.qty * (r.kvsNorm || 0)), 0);

    const totalDurationCal = Math.max(...rowsCalculations.map(r => r.manEndCal), 0);
    const phase1DurationCal = toCal(phase1EndWork);
    const phase2DurationCal = toCal(phase2EndWork);

    const isWeeklyMode = totalDurationCal > 240;
    const daysNeeded = isWeeklyMode
      ? Math.max(1, Math.ceil(totalDurationCal / 168))
      : Math.max(1, Math.ceil(totalDurationCal / 24));

    const maxCalendarTime = isWeeklyMode ? daysNeeded * 168 : daysNeeded * 24;

    const woodPerDay: number[] = new Array(daysNeeded).fill(0);
    const boardsPerDay: number[] = new Array(daysNeeded).fill(0);
    const masNetPerDay: number[] = new Array(daysNeeded).fill(0);
    const wireViazPerDay: number[] = new Array(daysNeeded).fill(0);

    rowsCalculations.forEach(r => {
      const dayIdx = isWeeklyMode
        ? Math.min(daysNeeded - 1, Math.floor(r.manStartCal / 168))
        : Math.min(daysNeeded - 1, Math.floor(r.manStartCal / 24));

      if (dayIdx >= 0 && dayIdx < daysNeeded) {
        if (r.woodNorm) woodPerDay[dayIdx] = parseFloat((woodPerDay[dayIdx] + r.qty * r.woodNorm).toFixed(1));
        if (r.boardsNorm) boardsPerDay[dayIdx] = parseFloat((boardsPerDay[dayIdx] + r.qty * r.boardsNorm).toFixed(1));
        if (r.masNetNorm) masNetPerDay[dayIdx] = Math.round(masNetPerDay[dayIdx] + r.qty * r.masNetNorm);
        if (r.wireViazNorm) wireViazPerDay[dayIdx] = parseFloat((wireViazPerDay[dayIdx] + r.qty * r.wireViazNorm).toFixed(1));
      }
    });

    return {
      rows: rowsCalculations,
      totalEarth,
      totalLaborHrs,
      totalMachHours,
      totalWood,
      totalBoards,
      totalWireViaz,
      totalMasNet,
      totalTraps,
      totalDoors,
      totalStoves,
      totalFvu,
      totalKvs,
      totalDurationCal,
      phase1DurationCal,
      phase2DurationCal,
      isWeeklyMode,
      daysNeeded,
      maxCalendarTime,
      woodPerDay,
      boardsPerDay,
      masNetPerDay,
      wireViazPerDay
    };
  });

  readonly dayIndices = computed(() => {
    return Array.from({ length: this.vopCalculations().daysNeeded }, (_, i) => i);
  });

  readonly periodIndices = computed(() => {
    const calc = this.vopCalculations();
    if (calc.isWeeklyMode) {
      return Array.from({ length: calc.daysNeeded }, (_, i) => i);
    } else {
      return Array.from({ length: calc.daysNeeded * 6 }, (_, i) => i);
    }
  });

  readonly chartPoints = computed(() => {
    const res = this.vopCalculations();
    const totalTime = res.totalDurationCal;
    const totalEarth = res.totalEarth;
    const totalManpower = this.manpower();
    const shiftsVal = this.shifts();

    if (totalTime === 0 || totalEarth === 0) {
      return { manpowerPts: '0,180 400,180', earthPts: '0,180 400,180', activeWorkers: 0, restingWorkers: 0, activeWorkersH: 180, totalH: 0, p1x: 0, p1y: 180, p2x: 0, p2y: 180 };
    }

    const activeWorkers = Math.floor(totalManpower / (shiftsVal === 1 ? 1 : (shiftsVal === 2 ? 1.5 : 2)));
    const restingWorkers = totalManpower - activeWorkers;

    const hScale = 180 / totalManpower;
    const wScale = 400 / totalTime;
    const activeWorkersH = 180 - (activeWorkers * hScale);
    const totalH = 180 - (totalManpower * hScale);

    const manpowerPts = `0,180 0,${activeWorkersH} ${totalTime * wScale},${activeWorkersH} 400,180`;

    const e1 = res.rows.filter(r => r.phase === 1).reduce((sum, r) => sum + (r.qty * (r.earthNorm || 1.5)), 0);
    const e2 = res.rows.filter(r => r.phase === 1 || r.phase === 2).reduce((sum, r) => sum + (r.qty * (r.earthNorm || 1.5)), 0);

    const eyScale = 180 / totalEarth;
    const p1y = 180 - (e1 * eyScale);
    const p2y = 180 - (e2 * eyScale);
    const p3y = 0;

    const earthPts = `0,180 0,180 ${res.phase1DurationCal * wScale},${p1y} ${res.phase2DurationCal * wScale},${p2y} ${totalTime * wScale},${p3y} 400,180`;

    return {
      manpowerPts,
      earthPts,
      activeWorkers,
      restingWorkers,
      activeWorkersH,
      totalH,
      p1x: res.phase1DurationCal * wScale,
      p1y,
      p2x: res.phase2DurationCal * wScale,
      p2y
    };
  });

  readonly timelineWarning = computed(() => {
    const res = this.vopCalculations();
    if (res.phase1DurationCal > 12) {
      return `<strong>Предупреждение по боеготовности:</strong> I очередь работ займет <strong>${res.phase1DurationCal.toFixed(1)} ч.</strong>, что превышает нормативный срок 12 часов. <em>Рекомендация: увеличьте численность личного состава, задействуйте технику или перейдите на 3-сменный режим.</em>`;
    }
    return null;
  });

  readonly tacticalCoeff = computed(() => {
    const enemyFireFactor = this.factorEnemyFire() === 'heavy' ? 2.50 : (this.factorEnemyFire() === 'periodic' ? 1.43 : 1.0);
    const contaminationFactor = this.factorContamination() === 'contaminated' ? 1.33 : 1.0;
    const timeOfDayFactor = this.factorTimeOfDay() === 'night' ? 1.43 : (this.factorTimeOfDay() === 'day_night' ? 1.18 : 1.0);
    const winterFactor = this.factorWinter() ? 1.5 : 1.0;
    return parseFloat((enemyFireFactor * contaminationFactor * timeOfDayFactor * winterFactor).toFixed(2));
  });

  getActiveGroupName(): string {
    const activeId = this.vm.activeCalculationGroupId();
    if (activeId === 'all') {
      return 'Все объекты на карте';
    }
    const group = this.vm.objectGroups().find((g: any) => g.id === activeId);
    return group ? group.name : 'Неизвестный район';
  }

  getTaskMachAllocSummary(task: any): string {
    const allocs = this.getTaskAllocations(task);
    if (!allocs || allocs.length === 0 || allocs.every((a: any) => a.machType === 'none')) {
      return 'Вручную (без техники)';
    }
    return allocs
      .filter((a: any) => a.machType !== 'none')
      .map((a: any) => {
        const dev = this.machDevices().find(d => d.type === a.machType || d.id === a.machType);
        const name = dev ? dev.name : a.machType;
        return `${name} (${a.qty} ед.)`;
      })
      .join(', ');
  }

  async exportToExcel() {
    const calc = this.vopCalculations();

    const headers = [
      'Очередь',
      'Наименование работ',
      'Подразделение / Позиция',
      'Ед.',
      'Объем',
      'Норма чел-ч',
      'Норма маш-ч',
      'Назначенная техника',
      'Выемка грунта (м³)',
      'Круглый лес (м³)',
      'Доски (м³)',
      'Проволока (кг)',
      'Масксети (м²)',
      'Трудозатраты (чел-ч)',
      'Потребность техн. (маш-ч)',
      'Начало (ч)',
      'Окончание (ч)',
      'Длительность (ч)'
    ];

    const dataRows = calc.rows.map(t => [
      `Очередь ${t.phase}`,
      t.name,
      t.objectName,
      t.unit,
      t.qty,
      t.laborNorm,
      t.machNorm,
      this.getTaskMachAllocSummary(t),
      parseFloat((t.qty * (t.earthNorm || 0)).toFixed(1)),
      parseFloat((t.qty * (t.woodNorm || 0)).toFixed(2)),
      parseFloat((t.qty * (t.boardsNorm || 0)).toFixed(2)),
      parseFloat((t.qty * (t.wireViazNorm || 0)).toFixed(1)),
      Math.round(t.qty * (t.masNetNorm || 0)),
      t.laborTotal,
      t.machTotal,
      t.manStartCal,
      t.manEndCal,
      t.manCalHours
    ]);

    const totalsRow = [
      'ИТОГО ПО ВСЕМ СООРУЖЕНИЯМ',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      parseFloat(calc.totalEarth.toFixed(1)),
      parseFloat(calc.totalWood.toFixed(1)),
      parseFloat(calc.totalBoards.toFixed(1)),
      parseFloat(calc.totalWireViaz.toFixed(1)),
      calc.totalMasNet,
      parseFloat(calc.totalLaborHrs.toFixed(1)),
      parseFloat(calc.totalMachHours.toFixed(1)),
      '',
      '',
      `${calc.totalDurationCal.toFixed(1)} ч`
    ];

    const wsTasks = ExcelStylerUtils.buildTableSheet({
      title: 'ТОПОС ГИС | ВЕДОМОСТЬ ФОРТИФИКАЦИОННЫХ РАБОТ И КАЛЕНДАРНЫЙ ПЛАН',
      subtitle: `Район / Объект: ${this.getActiveGroupName()} | Личный состав: ${this.manpower()} чел. | Смен: ${this.shifts()} | Кобст: ${this.tacticalCoeff()} | Нормативы: МОРБ-2006`,
      kpiCards: [
        { label: 'Полное время готовности', value: `${calc.totalDurationCal.toFixed(1)} ч (${(calc.totalDurationCal / (this.workHoursPerDay() || 10)).toFixed(1)} сут)` },
        { label: 'Сроки по очередям', value: `I оч.: ${calc.phase1DurationCal.toFixed(1)} ч | II оч.: ${calc.phase2DurationCal.toFixed(1)} ч` },
        { label: 'Объем выемки грунта', value: `${calc.totalEarth.toFixed(1)} м³` },
        { label: 'Потребность в лесе', value: `Кругляк: ${calc.totalWood.toFixed(1)} м³ | Доски: ${calc.totalBoards.toFixed(1)} м³` }
      ],
      headers,
      data: dataRows,
      totals: totalsRow,
      customColWidths: {
        0: 12,
        1: 34,
        2: 24,
        3: 8,
        4: 10,
        5: 14,
        6: 14,
        7: 28,
        8: 18,
        9: 16,
        10: 14,
        11: 15,
        12: 15,
        13: 19,
        14: 22,
        15: 12,
        16: 14,
        17: 15
      },
      calculationSteps: [
        {
          parameter: '1. Суммарный объем земляных работ (V_общ)',
          formula: 'V_общ = sum(N_i * V_ед_i)',
          calculation: `${calc.totalEarth.toFixed(1)} м³`,
          description: 'Суммарный объем механизированной выемки и ручной доотрывки по всем элементам опорного пункта'
        },
        {
          parameter: '2. Суммарная трудоемкость личного состава (T_чел)',
          formula: 'T_чел = sum(N_i * t_чел_i) * К_обст',
          calculation: `${calc.totalLaborHrs.toFixed(1)} чел-ч`,
          description: `Трудозатраты личного состава с учетом коэффициента тактической обстановки К_обст = ${this.tacticalCoeff()}`
        },
        {
          parameter: '3. Потребность в работе землеройной техники (T_маш)',
          formula: 'T_маш = sum(N_i * t_маш_i) * К_обст',
          calculation: `${calc.totalMachHours.toFixed(1)} маш-ч`,
          description: 'Суммарное рабочее время назначенных землеройных машин (ЭОВ-4421, БАТ-2, МДК-3, ПЗМ-2)'
        },
        {
          parameter: '4. Календарная длительность оборудования (T_сут)',
          formula: 'T_сут = T_общ / (N_смен * t_смены)',
          calculation: `${(calc.totalDurationCal / (this.workHoursPerDay() || 10)).toFixed(1)} рабочих суток (${calc.totalDurationCal.toFixed(1)} ч)`,
          description: `Привлечено ${this.manpower()} чел. личного состава, режим: ${this.shifts()} смен/сутки (${this.workHoursPerDay()} рабочих ч/сутки)`
        }
      ]
    });

    const wsSummary = ExcelStylerUtils.buildKeyValueSheet({
      title: 'ТОПОС ГИС | СВОДНЫЙ РАСЧЕТ СИЛ, СРЕДСТВ И МАТЕРИАЛОВ ФОРТИФИКАЦИИ',
      subtitle: `Сводные показатели инженерного оборудования опорного пункта (района) на ${new Date().toLocaleDateString('ru-RU')}`,
      sections: [
        {
          sectionTitle: '1. УСЛОВИЯ ОБСТАНОВКИ И ТАКТИЧЕСКИЕ КОЭФФИЦИЕНТЫ (МОРБ-2006)',
          items: [
            { label: 'Расчетный район / тактическая группа', value: this.getActiveGroupName(), unit: '', note: 'Позиция на карте' },
            { label: 'Численность привлекаемого личного состава', value: this.manpower(), unit: 'чел.', note: 'Рабочая сила подразделения' },
            { label: 'Режим выполнения работ', value: this.shifts(), unit: 'смен/сутки', note: `${this.workHoursPerDay()} рабочих часов в сутки` },
            { label: 'Категория разрабатываемого грунта', value: this.soilType(), unit: 'кат.', note: 'Коэффициент трудоемкости выемки' },
            { label: 'Степень огневого воздействия противника', value: this.factorEnemyFire(), unit: '', note: 'Снижение темпа работ' },
            { label: 'Условия радиоактивного / химического заражения', value: this.factorContamination(), unit: '', note: 'Работа в средствах защиты ОЗК' },
            { label: 'Время суток проведения инженерных работ', value: this.factorTimeOfDay(), unit: '', note: 'Световой режим' },
            { label: 'Сезон выполнения работ (зимний период)', value: this.factorWinter() ? 'Да (коэфф. x1.50)' : 'Нет', unit: '', note: 'Мерзлый грунт и обогрев' },
            { label: 'ИТОГОВЫЙ КОЭФФИЦИЕНТ ОБСТАНОВКИ (Кобст)', value: this.tacticalCoeff(), unit: '', note: 'Суммарный множитель норм' }
          ]
        },
        {
          sectionTitle: '2. СВОДНАЯ ВЕДОМОСТЬ МАТЕРИАЛОВ И ИЗДЕЛИЙ',
          items: [
            { label: 'Выемка грунта (общий объем земляных работ)', value: calc.totalEarth.toFixed(1), unit: 'м³', note: 'Механизированная и ручная доотрывка' },
            { label: 'Круглый лес (стойки, накат, остовы укрытий)', value: calc.totalWood.toFixed(1), unit: 'м³', note: 'Диаметр 12-18 см' },
            { label: 'Доски обрезные и пластины (одежда крутостей)', value: calc.totalBoards.toFixed(1), unit: 'м³', note: 'Толщина 2.5-5 см' },
            { label: 'Проволока стальная вязальная', value: calc.totalWireViaz.toFixed(1), unit: 'кг', note: 'Для увязки остовов и пакетов' },
            { label: 'Маскировочные сети (стандартные маскпокрытия)', value: calc.totalMasNet, unit: 'м²', note: 'Табельные комплекты МКТ-2Л' },
            { label: 'Двери защитно-герметические БД-50', value: calc.totalDoors, unit: 'шт.', note: 'Для блиндажей и убежищ' },
            { label: 'Печи отопительные полевые (ПОВ-57)', value: calc.totalStoves, unit: 'шт.', note: 'Для обогрева личного состава' },
            { label: 'Фильтровентиляционные агрегаты (ФВУ-50 / 100)', value: calc.totalFvu, unit: 'компл.', note: 'Очистка воздуха в укрытиях' },
            { label: 'Сборно-разборные комплекты убежищ КВС-У / КВС-А', value: calc.totalKvs, unit: 'компл.', note: 'Тяжелые убежища III очереди' }
          ]
        },
        {
          sectionTitle: '3. СРОКИ И ОЧЕРЕДНОСТЬ ГОТОВНОСТИ СООРУЖЕНИЙ',
          items: [
            { label: 'Длительность выполнения работ I очереди', value: `${calc.phase1DurationCal.toFixed(1)} ч`, unit: 'ч', note: 'Окопы на отделения, траншеи, щели' },
            { label: 'Длительность выполнения работ II очереди', value: `${calc.phase2DurationCal.toFixed(1)} ч`, unit: 'ч', note: 'Блиндажи, укрытия техники, КП' },
            { label: 'ПОЛНОЕ ВРЕМЯ ГОТОВНОСТИ ОПОРНОГО ПУНКТА', value: `${calc.totalDurationCal.toFixed(1)} ч`, unit: 'ч', note: `Всего ${(calc.totalDurationCal / (this.workHoursPerDay() || 10)).toFixed(1)} рабочих суток` }
          ]
        }
      ],
      calculationSteps: [
        {
          parameter: '1. Итоговый коэффициент обстановки (К_обст)',
          formula: 'К_обст = K_грунт * K_огонь * K_зараж * K_время * K_зима',
          calculation: `${this.tacticalCoeff()}`,
          description: `Грунт: ${this.soilType()} кат., огневое воздействие: ${this.factorEnemyFire()}, заражение: ${this.factorContamination()}, свет: ${this.factorTimeOfDay()}, зима: ${this.factorWinter() ? '1.50' : '1.00'}`
        },
        {
          parameter: '2. Потребность в круглом лесе (V_лес)',
          formula: 'V_лес = sum(N_i * v_лес_i)',
          calculation: `${calc.totalWood.toFixed(1)} м³`,
          description: 'Диаметр бревен 12-18 см для несущих остовов, вертикальных стоек и сплошного наката перекрытий'
        },
        {
          parameter: '3. Потребность в обрезных досках и пластинах (V_доски)',
          formula: 'V_доски = sum(N_i * v_доски_i)',
          calculation: `${calc.totalBoards.toFixed(1)} м³`,
          description: 'Толщина досок 2.5-5 см для устройства одежды крутостей траншей, щелей и щитов'
        },
        {
          parameter: '4. Потребность в вязальной отожженной проволоке (M_пров)',
          formula: 'M_пров = sum(N_i * m_пров_i)',
          calculation: `${calc.totalWireViaz.toFixed(1)} кг`,
          description: 'Стальная вязальная проволока диаметром 3-4 мм для увязки элементов остовов и анкеровки'
        },
        {
          parameter: '5. Потребность в табельных маскировочных сетях (S_маск)',
          formula: 'S_маск = sum(N_i * s_маск_i)',
          calculation: `${calc.totalMasNet} м²`,
          description: 'Табельные комплекты маскировочного покрытия МКТ-2Л для скрытия сооружений от оптической разведки'
        }
      ]
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsTasks, 'Календарный график работ');
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Сводная ведомость и нормы');

    const fileName = `Фортификация_${this.getActiveGroupName().replace(/[\s\\\/:\*\?"<>\|]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    await ExcelStylerUtils.saveWorkbookWithDialog(wb, fileName);
  }
}
