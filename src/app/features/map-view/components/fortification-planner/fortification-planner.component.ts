import { Component, inject, signal, computed, effect, untracked } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  earthNorm?: number; // объем грунта на единицу
  woodNorm?: number;  // расход круглого леса на единицу (м³)
  boardsNorm?: number; // расход досок на единицу (м³)
  wireViazNorm?: number; // расход вязальной проволоки на единицу (кг)
  masNetNorm?: number; // расход маскировочных сетей на единицу (м²)
  trapsNorm?: number; // расход трапов на единицу (п.м.)
  doorsNorm?: number; // расход дверей БД-50 на единицу (шт)
  stovesNorm?: number; // расход печей на единицу (шт)
  machQty?: number; // количество единиц техники (по умолчанию 1)
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

  // Вспомогательные методы сохранения/загрузки
  private loadNumber(key: string, def: number): number {
    try {
      const val = localStorage.getItem(key);
      return val !== null ? parseFloat(val) : def;
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
    try {
      const val = localStorage.getItem('topos_planner_devices');
      if (val) return JSON.parse(val);
    } catch {}
    return [
      { id: 'eov', name: 'ЭОВ-4421 (экскаватор)', type: 'eov', basePerf: 60, currentPerf: 60, efficiency: 0.90, notes: 'Военный одноковшовый экскаватор на шасси КрАЗ-255Б.' },
      { id: 'pzm', name: 'ПЗМ-2 (землеройная)', type: 'pzm', basePerf: 100, currentPerf: 100, efficiency: 0.85, notes: 'Полковая землеройная машина для отрывки траншей и котлованов.' },
      { id: 'mdk', name: 'МДК-3 (котлованная)', type: 'mdk', basePerf: 120, currentPerf: 120, efficiency: 0.80, notes: 'Машина для отрывки котлованов под убежища.' },
      { id: 'bu', name: 'Встроенное БУ (бульдозер)', type: 'bu', basePerf: 30, currentPerf: 30, efficiency: 0.95, notes: 'Встроенное бульдозерное оборудование инженерных машин.' },
      { id: 'none', name: 'Вручную', type: 'none', basePerf: 1.5, currentPerf: 1.5, efficiency: 1.00, notes: 'Выполнение работ личным составом вручную.' }
    ];
  }

  // Спойлер параметров расчета
  readonly isParamsExpanded = signal<boolean>(false);

  // Параметры расчета
  readonly manpower = signal<number>(this.loadNumber('topos_planner_manpower', 20));
  readonly shifts = signal<number>(this.loadNumber('topos_planner_shifts', 2));
  readonly soilType = signal<number>(this.loadNumber('topos_planner_soilType', 1.0));
  readonly factorNight = signal<boolean>(this.loadBool('topos_planner_factorNight', false));
  readonly factorWinter = signal<boolean>(this.loadBool('topos_planner_factorWinter', false));
  readonly workHoursPerDay = signal<number>(this.loadNumber('topos_planner_workHoursPerDay', 24));
  readonly pinColumns = signal<boolean>(this.loadBool('topos_planner_pinColumns', true));

  togglePinColumns() {
    const newVal = !this.pinColumns();
    this.pinColumns.set(newVal);
    try {
      localStorage.setItem('topos_planner_pinColumns', String(newVal));
    } catch {}
  }

  // Очереди задач
  readonly vopTasks = signal<VopTask[]>(this.loadTasks());

  // Парк доступной техники
  readonly machDevices = signal<MachDevice[]>(this.loadDevices());

  constructor() {
    effect(() => {
      localStorage.setItem('topos_planner_manpower', String(this.manpower()));
    });
    effect(() => {
      localStorage.setItem('topos_planner_shifts', String(this.shifts()));
    });
    effect(() => {
      localStorage.setItem('topos_planner_soilType', String(this.soilType()));
    });
    effect(() => {
      localStorage.setItem('topos_planner_factorNight', String(this.factorNight()));
    });
    effect(() => {
      localStorage.setItem('topos_planner_factorWinter', String(this.factorWinter()));
    });
    effect(() => {
      localStorage.setItem('topos_planner_workHoursPerDay', String(this.workHoursPerDay()));
    });
    effect(() => {
      localStorage.setItem('topos_planner_tasks', JSON.stringify(this.vopTasks()));
    });
    effect(() => {
      localStorage.setItem('topos_planner_devices', JSON.stringify(this.machDevices()));
    });

    // Реактивный эффект автосинхронизации стандартных задач в планировщике при обновлении сооружений на карте ГИС
    effect(() => {
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

      let blindageCount = 0;
      let blindageEarth = 0;
      let blindageWood = 0;
      let blindageBoards = 0;
      let blindageWireViaz = 0;
      let blindageMasNet = 0;
      let blindageDoors = 0;
      let blindageStoves = 0;

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
          } else if (key === 'schel_per1' || key === 'fort_knp' || key === 'fort_dzot' || key === 'fort_dot') {
            shelterCount += 1;
            shelterEarth += norm.earthVolume;
            shelterWood += norm.woodVol || 0;
            shelterBoards += norm.boardsVol || 0;
            shelterWireViaz += norm.wireViazKg || 0;
            shelterMasNet += norm.masNetSq || 0;
            shelterDoors += norm.doorsCount || 0;
            shelterStoves += norm.stovesCount || 0;
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

      const shelterEarthNorm = shelterCount > 0 ? (shelterEarth / shelterCount) : 15;
      const shelterWoodNorm = shelterCount > 0 ? (shelterWood / shelterCount) : 3.5;
      const shelterBoardsNorm = shelterCount > 0 ? (shelterBoards / shelterCount) : 0;
      const shelterWireViazNorm = shelterCount > 0 ? (shelterWireViaz / shelterCount) : 0;
      const shelterMasNetNorm = shelterCount > 0 ? (shelterMasNet / shelterCount) : 0;
      const shelterDoorsNorm = shelterCount > 0 ? (shelterDoors / shelterCount) : 0;
      const shelterStovesNorm = shelterCount > 0 ? (shelterStoves / shelterCount) : 0;

      const blindageEarthNorm = blindageCount > 0 ? (blindageEarth / blindageCount) : 12;
      const blindageWoodNorm = blindageCount > 0 ? (blindageWood / blindageCount) : 2.1;
      const blindageBoardsNorm = blindageCount > 0 ? (blindageBoards / blindageCount) : 0;
      const blindageWireViazNorm = blindageCount > 0 ? (blindageWireViaz / blindageCount) : 0;
      const blindageMasNetNorm = blindageCount > 0 ? (blindageMasNet / blindageCount) : 0;
      const blindageDoorsNorm = blindageCount > 0 ? (blindageDoors / blindageCount) : 0;
      const blindageStovesNorm = blindageCount > 0 ? (blindageStoves / blindageCount) : 0;

      untracked(() => {
        const current = this.vopTasks();
        if (current.length === 0) {
          const tasks: VopTask[] = [
            { id: 1, phase: 1, name: 'Отрывка основных окопов БМП (танков)', objectName: 'мсв', unit: 'шт.', qty: Math.ceil(bmpCount / 2), laborNorm: parseFloat((6.0 * (bmpEarthNorm / 35)).toFixed(2)), machNorm: parseFloat((1.0 * (bmpEarthNorm / 35)).toFixed(2)), machType: 'eov', machQty: 1, earthNorm: parseFloat(bmpEarthNorm.toFixed(2)), woodNorm: parseFloat(bmpWoodNorm.toFixed(2)), boardsNorm: parseFloat(bmpBoardsNorm.toFixed(2)), wireViazNorm: parseFloat(bmpWireViazNorm.toFixed(2)), masNetNorm: parseFloat(bmpMasNetNorm.toFixed(2)), trapsNorm: 0, doorsNorm: 0, stovesNorm: 0 },
            { id: 2, phase: 1, name: 'Отрывка траншей', objectName: 'мсв', unit: 'м', qty: Math.round(trenchLength), laborNorm: parseFloat((0.3 * (trenchEarthNorm / 0.8)).toFixed(3)), machNorm: parseFloat((0.013 * (trenchEarthNorm / 0.8)).toFixed(4)), machType: 'eov', machQty: 1, earthNorm: parseFloat(trenchEarthNorm.toFixed(3)), woodNorm: parseFloat(trenchWoodNorm.toFixed(4)), boardsNorm: parseFloat(trenchBoardsNorm.toFixed(4)), wireViazNorm: parseFloat(trenchWireViazNorm.toFixed(2)), masNetNorm: parseFloat(trenchMasNetNorm.toFixed(2)), trapsNorm: parseFloat(trenchTrapsNorm.toFixed(2)), doorsNorm: 0, stovesNorm: 0 },
            { id: 3, phase: 1, name: 'Устройство одиночных стрелковых ячеек', objectName: 'мсв', unit: 'шт.', qty: finalCellCount, laborNorm: 2.5, machNorm: 0, machType: 'none', machQty: 1, earthNorm: parseFloat(cellEarthNorm.toFixed(2)), woodNorm: 0, boardsNorm: 0, wireViazNorm: 0, masNetNorm: 0, trapsNorm: 0, doorsNorm: 0, stovesNorm: 0 },
            { id: 4, phase: 2, name: 'Отрыв запасных окопов БМП (танков)', objectName: 'мсв', unit: 'шт.', qty: Math.floor(bmpCount / 2), laborNorm: parseFloat((6.0 * (bmpEarthNorm / 35)).toFixed(2)), machNorm: parseFloat((1.0 * (bmpEarthNorm / 35)).toFixed(2)), machType: 'eov', machQty: 1, earthNorm: parseFloat(bmpEarthNorm.toFixed(2)), woodNorm: parseFloat(bmpWoodNorm.toFixed(2)), boardsNorm: parseFloat(bmpBoardsNorm.toFixed(2)), wireViazNorm: parseFloat(bmpWireViazNorm.toFixed(2)), masNetNorm: parseFloat(bmpMasNetNorm.toFixed(2)), trapsNorm: 0, doorsNorm: 0, stovesNorm: 0 },
            { id: 5, phase: 2, name: 'Отрыв ходов сообщения', objectName: 'мсв', unit: 'м', qty: Math.round(commLength), laborNorm: parseFloat((0.3 * (commEarthNorm / 0.8)).toFixed(3)), machNorm: parseFloat((0.013 * (commEarthNorm / 0.8)).toFixed(4)), machType: 'eov', machQty: 1, earthNorm: parseFloat(commEarthNorm.toFixed(3)), woodNorm: parseFloat(commWoodNorm.toFixed(4)), boardsNorm: parseFloat(commBoardsNorm.toFixed(4)), wireViazNorm: parseFloat(commWireViazNorm.toFixed(2)), masNetNorm: parseFloat(commMasNetNorm.toFixed(2)), trapsNorm: parseFloat(commTrapsNorm.toFixed(2)), doorsNorm: 0, stovesNorm: 0 },
            { id: 6, phase: 2, name: 'Отрыв котлована под убежище на взвод', objectName: 'мсв', unit: 'шт.', qty: shelterCount, laborNorm: parseFloat((12.0 * (shelterEarthNorm / 15)).toFixed(2)), machNorm: parseFloat((2.0 * (shelterEarthNorm / 15)).toFixed(2)), machType: 'mdk', machQty: 1, earthNorm: parseFloat(shelterEarthNorm.toFixed(2)), woodNorm: parseFloat(shelterWoodNorm.toFixed(2)), boardsNorm: parseFloat(shelterBoardsNorm.toFixed(2)), wireViazNorm: parseFloat(shelterWireViazNorm.toFixed(2)), masNetNorm: parseFloat(shelterMasNetNorm.toFixed(2)), trapsNorm: 0, doorsNorm: parseFloat(shelterDoorsNorm.toFixed(2)), stovesNorm: parseFloat(shelterStovesNorm.toFixed(2)) },
            { id: 7, phase: 2, name: 'Отрыв котлована под блиндаж на отделение', objectName: 'мсв', unit: 'шт.', qty: blindageCount, laborNorm: parseFloat((8.0 * (blindageEarthNorm / 12)).toFixed(2)), machNorm: parseFloat((1.0 * (blindageEarthNorm / 12)).toFixed(2)), machType: 'eov', machQty: 1, earthNorm: parseFloat(blindageEarthNorm.toFixed(2)), woodNorm: parseFloat(blindageWoodNorm.toFixed(2)), boardsNorm: parseFloat(blindageBoardsNorm.toFixed(2)), wireViazNorm: parseFloat(blindageWireViazNorm.toFixed(2)), masNetNorm: parseFloat(blindageMasNetNorm.toFixed(2)), trapsNorm: 0, doorsNorm: parseFloat(blindageDoorsNorm.toFixed(2)), stovesNorm: parseFloat(blindageStovesNorm.toFixed(2)) }
          ];
          this.vopTasks.set(tasks.filter(t => t.qty > 0));
        } else {
          const updated = current.map(t => {
            const machQty = t.machQty || 1;
            switch (t.id) {
              case 1:
                return { ...t, machQty, qty: Math.ceil(bmpCount / 2), laborNorm: parseFloat((6.0 * (bmpEarthNorm / 35)).toFixed(2)), machNorm: parseFloat((1.0 * (bmpEarthNorm / 35)).toFixed(2)), earthNorm: parseFloat(bmpEarthNorm.toFixed(2)), woodNorm: parseFloat(bmpWoodNorm.toFixed(2)), boardsNorm: parseFloat(bmpBoardsNorm.toFixed(2)), wireViazNorm: parseFloat(bmpWireViazNorm.toFixed(2)), masNetNorm: parseFloat(bmpMasNetNorm.toFixed(2)) };
              case 2:
                return { ...t, machQty, qty: Math.round(trenchLength), laborNorm: parseFloat((0.3 * (trenchEarthNorm / 0.8)).toFixed(3)), machNorm: parseFloat((0.013 * (trenchEarthNorm / 0.8)).toFixed(4)), earthNorm: parseFloat(trenchEarthNorm.toFixed(3)), woodNorm: parseFloat(trenchWoodNorm.toFixed(4)), boardsNorm: parseFloat(trenchBoardsNorm.toFixed(4)), wireViazNorm: parseFloat(trenchWireViazNorm.toFixed(2)), masNetNorm: parseFloat(trenchMasNetNorm.toFixed(2)), trapsNorm: parseFloat(trenchTrapsNorm.toFixed(2)) };
              case 3:
                return { ...t, machQty, qty: finalCellCount, earthNorm: parseFloat(cellEarthNorm.toFixed(2)) };
              case 4:
                return { ...t, machQty, qty: Math.floor(bmpCount / 2), laborNorm: parseFloat((6.0 * (bmpEarthNorm / 35)).toFixed(2)), machNorm: parseFloat((1.0 * (bmpEarthNorm / 35)).toFixed(2)), earthNorm: parseFloat(bmpEarthNorm.toFixed(2)), woodNorm: parseFloat(bmpWoodNorm.toFixed(2)), boardsNorm: parseFloat(bmpBoardsNorm.toFixed(2)), wireViazNorm: parseFloat(bmpWireViazNorm.toFixed(2)), masNetNorm: parseFloat(bmpMasNetNorm.toFixed(2)) };
              case 5:
                return { ...t, machQty, qty: Math.round(commLength), laborNorm: parseFloat((0.3 * (commEarthNorm / 0.8)).toFixed(3)), machNorm: parseFloat((0.013 * (commEarthNorm / 0.8)).toFixed(4)), earthNorm: parseFloat(commEarthNorm.toFixed(3)), woodNorm: parseFloat(commWoodNorm.toFixed(4)), boardsNorm: parseFloat(commBoardsNorm.toFixed(4)), wireViazNorm: parseFloat(commWireViazNorm.toFixed(2)), masNetNorm: parseFloat(commMasNetNorm.toFixed(2)), trapsNorm: parseFloat(commTrapsNorm.toFixed(2)) };
              case 6:
                return { ...t, machQty, qty: shelterCount, laborNorm: parseFloat((12.0 * (shelterEarthNorm / 15)).toFixed(2)), machNorm: parseFloat((2.0 * (shelterEarthNorm / 15)).toFixed(2)), earthNorm: parseFloat(shelterEarthNorm.toFixed(2)), woodNorm: parseFloat(shelterWoodNorm.toFixed(2)), boardsNorm: parseFloat(shelterBoardsNorm.toFixed(2)), wireViazNorm: parseFloat(shelterWireViazNorm.toFixed(2)), masNetNorm: parseFloat(shelterMasNetNorm.toFixed(2)), doorsNorm: parseFloat(shelterDoorsNorm.toFixed(2)), stovesNorm: parseFloat(shelterStovesNorm.toFixed(2)) };
              case 7:
                return { ...t, machQty, qty: blindageCount, laborNorm: parseFloat((8.0 * (blindageEarthNorm / 12)).toFixed(2)), machNorm: parseFloat((1.0 * (blindageEarthNorm / 12)).toFixed(2)), earthNorm: parseFloat(blindageEarthNorm.toFixed(2)), woodNorm: parseFloat(blindageWoodNorm.toFixed(2)), boardsNorm: parseFloat(blindageBoardsNorm.toFixed(2)), wireViazNorm: parseFloat(blindageWireViazNorm.toFixed(2)), masNetNorm: parseFloat(blindageMasNetNorm.toFixed(2)), doorsNorm: parseFloat(blindageDoorsNorm.toFixed(2)), stovesNorm: parseFloat(blindageStovesNorm.toFixed(2)) };
              default:
                return { ...t, machQty };
            }
          });
          this.vopTasks.set(updated);
        }
      });
    });
  }

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
      machType: 'eov',
      machQty: 1,
      earthNorm: 15,
      woodNorm: 1.5
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
    if (field === 'qty' || field === 'machQty') val = Math.max(1, parseInt(val, 10) || 1);
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
    let bmpEarth = 0;

    let trenchLength = 0;
    let trenchEarth = 0;
    let trenchWood = 0;

    let cellCount = 0;
    let cellEarth = 0;

    let commLength = 0;
    let commEarth = 0;
    let commWood = 0;

    let shelterCount = 0;
    let shelterEarth = 0;
    let shelterWood = 0;

    let blindageCount = 0;
    let blindageEarth = 0;
    let blindageWood = 0;

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
        } else if (key === 'comm_open' || key === 'comm_covered') {
          commLength += length;
          commEarth += norm.earthVolume;
          commWood += norm.woodVol || 0;
        }
      } else {
        if (key === 'fort_bmp_trench' || key === 'fort_tank_trench') {
          bmpCount += 1;
          bmpEarth += norm.earthVolume;
        } else if (key === 'fort_trench_shelter') {
          cellCount += 1;
          cellEarth += norm.earthVolume;
        } else if (key === 'fort_blindage' || key === 'blindazh' || key === 'blindazh_zhb') {
          blindageCount += 1;
          blindageEarth += norm.earthVolume;
          blindageWood += norm.woodVol || 0;
        } else if (key === 'schel_per1' || key === 'fort_knp' || key === 'fort_dzot' || key === 'fort_dot') {
          shelterCount += 1;
          shelterEarth += norm.earthVolume;
          shelterWood += norm.woodVol || 0;
        }
      }
    });

    const cellTaskName = 'Устройство одиночных стрелковых ячеек';
    // Если на карте есть траншеи, но ячейки точечно не расставлены, по умолчанию в план вставляется 100 ячеек по ТЗ
    const finalCellCount = cellCount > 0 ? cellCount : (trenchLength > 0 ? 100 : 0);

    const bmpEarthNorm = bmpCount > 0 ? (bmpEarth / bmpCount) : 35;
    const trenchEarthNorm = trenchLength > 0 ? (trenchEarth / trenchLength) : 0.8;
    const trenchWoodNorm = trenchLength > 0 ? (trenchWood / trenchLength) : 0.0;
    const cellEarthNorm = cellCount > 0 ? (cellEarth / cellCount) : 1.4;
    const commEarthNorm = commLength > 0 ? (commEarth / commLength) : 0.8;
    const commWoodNorm = commLength > 0 ? (commWood / commLength) : 0.0;
    const shelterEarthNorm = shelterCount > 0 ? (shelterEarth / shelterCount) : 15;
    const shelterWoodNorm = shelterCount > 0 ? (shelterWood / shelterCount) : 3.5;
    const blindageEarthNorm = blindageCount > 0 ? (blindageEarth / blindageCount) : 12;
    const blindageWoodNorm = blindageCount > 0 ? (blindageWood / blindageCount) : 2.1;

    const tasks: VopTask[] = [
      { 
        id: 1, 
        phase: 1, 
        name: 'Отрывка основных окопов БМП (танков)', 
        objectName: 'мсв', 
        unit: 'шт.', 
        qty: Math.ceil(bmpCount / 2), 
        laborNorm: parseFloat((6.0 * (bmpEarthNorm / 35)).toFixed(2)), 
        machNorm: parseFloat((1.0 * (bmpEarthNorm / 35)).toFixed(2)), 
        machType: 'eov',
        machQty: 1,
        earthNorm: parseFloat(bmpEarthNorm.toFixed(2)),
        woodNorm: 0
      },
      { 
        id: 2, 
        phase: 1, 
        name: 'Отрывка траншей', 
        objectName: 'мсв', 
        unit: 'м', 
        qty: Math.round(trenchLength), 
        laborNorm: parseFloat((0.3 * (trenchEarthNorm / 0.8)).toFixed(3)), 
        machNorm: parseFloat((0.013 * (trenchEarthNorm / 0.8)).toFixed(4)), 
        machType: 'eov',
        machQty: 1,
        earthNorm: parseFloat(trenchEarthNorm.toFixed(3)),
        woodNorm: parseFloat(trenchWoodNorm.toFixed(4))
      },
      { 
        id: 3, 
        phase: 1, 
        name: cellTaskName, 
        objectName: 'мсв', 
        unit: 'шт.', 
        qty: finalCellCount, 
        laborNorm: 2.5, 
        machNorm: 0, 
        machType: 'none',
        machQty: 1,
        earthNorm: parseFloat(cellEarthNorm.toFixed(2)),
        woodNorm: 0
      },
      { 
        id: 4, 
        phase: 2, 
        name: 'Отрыв запасных окопов БМП (танков)', 
        objectName: 'мсв', 
        unit: 'шт.', 
        qty: Math.floor(bmpCount / 2), 
        laborNorm: parseFloat((6.0 * (bmpEarthNorm / 35)).toFixed(2)), 
        machNorm: parseFloat((1.0 * (bmpEarthNorm / 35)).toFixed(2)), 
        machType: 'eov',
        earthNorm: parseFloat(bmpEarthNorm.toFixed(2)),
        woodNorm: 0
      },
      { 
        id: 5, 
        phase: 2, 
        name: 'Отрыв ходов сообщения', 
        objectName: 'мсв', 
        unit: 'м', 
        qty: Math.round(commLength), 
        laborNorm: parseFloat((0.3 * (commEarthNorm / 0.8)).toFixed(3)), 
        machNorm: parseFloat((0.013 * (commEarthNorm / 0.8)).toFixed(4)), 
        machType: 'eov',
        earthNorm: parseFloat(commEarthNorm.toFixed(3)),
        woodNorm: parseFloat(commWoodNorm.toFixed(4))
      },
      { 
        id: 6, 
        phase: 2, 
        name: 'Отрыв котлована под убежище на взвод', 
        objectName: 'мсв', 
        unit: 'шт.', 
        qty: shelterCount, 
        laborNorm: parseFloat((12.0 * (shelterEarthNorm / 15)).toFixed(2)), 
        machNorm: parseFloat((2.0 * (shelterEarthNorm / 15)).toFixed(2)), 
        machType: 'mdk',
        earthNorm: parseFloat(shelterEarthNorm.toFixed(2)),
        woodNorm: parseFloat(shelterWoodNorm.toFixed(2))
      },
      { 
        id: 7, 
        phase: 2, 
        name: 'Отрыв котлована под блиндаж на отделение', 
        objectName: 'мсв', 
        unit: 'шт.', 
        qty: blindageCount, 
        laborNorm: parseFloat((8.0 * (blindageEarthNorm / 12)).toFixed(2)), 
        machNorm: parseFloat((1.0 * (blindageEarthNorm / 12)).toFixed(2)), 
        machType: 'eov',
        earthNorm: parseFloat(blindageEarthNorm.toFixed(2)),
        woodNorm: parseFloat(blindageWoodNorm.toFixed(2))
      }
    ];

    this.vopTasks.set(tasks.filter(t => t.qty > 0));
  }

  // Изменение количества через кнопки по ID сооружения
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

  // Прокрутка таблицы мышью (Mouse Drag Scroll)
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
      
      const mQty = Math.max(1, task.machQty || 1);

      // Машинное время (суммарный ресурс в м.-ч) с учетом КТГ и производительности (если это не ручной труд)
      const machTotal = dev.id !== 'none'
        ? (task.qty * task.machNorm * perfFactor / dev.efficiency)
        : 0;

      // Календарная продолжительность работы техники при параллельной работе mQty машин
      const machDurationCal = dev.id !== 'none' ? (machTotal / mQty) : 0;

      // Ручной труд л/с
      const laborTotal = task.qty * task.laborNorm * soil * conditions;
      
      const machStartWork = currentMachTimeWork;
      const machEndWork = currentMachTimeWork + machDurationCal;
      currentMachTimeWork = machEndWork;

      const manStartWork = task.unit === 'м' ? (machStartWork + machDurationCal * 0.3) : machEndWork;
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
      
      const mQty = Math.max(1, task.machQty || 1);

      const machTotal = dev.id !== 'none'
        ? (task.qty * task.machNorm * perfFactor / dev.efficiency)
        : 0;

      const machDurationCal = dev.id !== 'none' ? (machTotal / mQty) : 0;

      const laborTotal = task.qty * task.laborNorm * soil * conditions;
      
      const machStartWork = currentMachTimeWork;
      const machEndWork = currentMachTimeWork + machDurationCal;
      currentMachTimeWork = machEndWork;

      const manStartWork = task.unit === 'м' ? (machStartWork + machDurationCal * 0.3) : machEndWork;
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

    // Присваиваем сквозной порядковый номер (displayIndex) для красивой нумерации
    rowsCalculations.forEach((row, idx) => {
      row.displayIndex = idx + 1;
    });

    // Сводные объемы и календарные времена
    const totalEarth = rowsCalculations.reduce((sum, r) => {
      const earthNorm = r.earthNorm !== undefined ? r.earthNorm : (
        r.name.toLowerCase().includes('окоп') ? 35 : (
          r.name.toLowerCase().includes('ячейк') ? 1.4 : (
            r.name.toLowerCase().includes('транш') || r.name.toLowerCase().includes('ход') ? 0.8 : (
              r.name.toLowerCase().includes('убежищ') ? 15 : (
                r.name.toLowerCase().includes('блиндаж') ? 12 : 1.5
              )
            )
          )
        )
      );
      return sum + (r.qty * earthNorm);
    }, 0);

    const totalLaborHrs = rowsCalculations.reduce((sum, r) => sum + r.laborTotal, 0);
    const totalMachHours = rowsCalculations.reduce((sum, r) => sum + r.machTotal, 0);
    
    const totalWood = rowsCalculations.reduce((sum, r) => {
      const woodNorm = r.woodNorm !== undefined ? r.woodNorm : (
        r.name.toLowerCase().includes('блиндаж') ? 2.1 : (
          r.name.toLowerCase().includes('убежищ') ? 3.5 : (
            r.name.toLowerCase().includes('транш') || r.name.toLowerCase().includes('ход') ? 0.04 : 0.0
          )
        )
      );
      return sum + (r.qty * woodNorm);
    }, 0);

    const totalDurationCal = Math.max(...rowsCalculations.map(r => r.manEndCal), 0);
    const phase1DurationCal = Math.max(...rowsCalculations.filter(r => r.phase === 1).map(r => r.manEndCal), 0);

    // Динамический расчет суток на выполнение работ (минимум 2 суток)
    const rawDays = Math.max(2, Math.ceil(totalDurationCal / 24));
    const isWeeklyMode = rawDays > 7;
    
    let daysNeeded = rawDays;
    if (isWeeklyMode) {
      // Округляем вверх до кратного 6 (неделя = 6 рабочих дней)
      daysNeeded = Math.ceil(rawDays / 6) * 6;
    }
    const maxCalendarTime = daysNeeded * 24;

    // Расчет сводных расходных материалов по задачам
    const totalBoards = rowsCalculations.reduce((sum, r) => sum + (r.qty * (r.boardsNorm || 0)), 0);
    const totalWireViaz = rowsCalculations.reduce((sum, r) => sum + (r.qty * (r.wireViazNorm || 0)), 0);
    const totalMasNet = rowsCalculations.reduce((sum, r) => sum + (r.qty * (r.masNetNorm || 0)), 0);
    const totalTraps = rowsCalculations.reduce((sum, r) => sum + (r.qty * (r.trapsNorm || 0)), 0);
    const totalDoors = rowsCalculations.reduce((sum, r) => sum + (r.qty * (r.doorsNorm || 0)), 0);
    const totalStoves = rowsCalculations.reduce((sum, r) => sum + (r.qty * (r.stovesNorm || 0)), 0);

    // Распределение ресурсов по дням (суткам)
    const woodPerDay = new Array(daysNeeded).fill(0);
    const boardsPerDay = new Array(daysNeeded).fill(0);
    const masNetPerDay = new Array(daysNeeded).fill(0);
    const wireViazPerDay = new Array(daysNeeded).fill(0);

    rowsCalculations.forEach(r => {
      const taskWood = r.qty * (r.woodNorm || 0);
      const taskBoards = r.qty * (r.boardsNorm || 0);
      const taskMasNet = r.qty * (r.masNetNorm || 0);
      const taskWireViaz = r.qty * (r.wireViazNorm || 0);

      // Считаем общую продолжительность ручной работы (в часах)
      const manDuration = r.manEndWork - r.manStartWork;
      if (manDuration > 0) {
        r.manSegments.forEach((seg: any) => {
          const dayIdx = Math.floor(seg.startCal / 24);
          if (dayIdx >= 0 && dayIdx < daysNeeded) {
            const ratio = seg.duration / manDuration;
            woodPerDay[dayIdx] += taskWood * ratio;
            boardsPerDay[dayIdx] += taskBoards * ratio;
            masNetPerDay[dayIdx] += taskMasNet * ratio;
            wireViazPerDay[dayIdx] += taskWireViaz * ratio;
          }
        });
      } else {
        // Если ручной работы нет, но есть машинная работа
        const machDuration = r.machEndWork - r.machStartWork;
        if (machDuration > 0) {
          r.machSegments.forEach((seg: any) => {
            const dayIdx = Math.floor(seg.startCal / 24);
            if (dayIdx >= 0 && dayIdx < daysNeeded) {
              const ratio = seg.duration / machDuration;
              woodPerDay[dayIdx] += taskWood * ratio;
              boardsPerDay[dayIdx] += taskBoards * ratio;
              masNetPerDay[dayIdx] += taskMasNet * ratio;
              wireViazPerDay[dayIdx] += taskWireViaz * ratio;
            }
          });
        }
      }
    });

    // Округляем массивы до 1 знака после запятой
    const woodPerDayRounded = woodPerDay.map(v => parseFloat(v.toFixed(1)));
    const boardsPerDayRounded = boardsPerDay.map(v => parseFloat(v.toFixed(1)));
    const masNetPerDayRounded = masNetPerDay.map(v => Math.round(v));
    const wireViazPerDayRounded = wireViazPerDay.map(v => parseFloat(v.toFixed(1)));

    // Суммирование по периодам Ганта (для колонок в HTML)
    const getPeriodValues = (arr: number[]) => {
      if (!isWeeklyMode) {
        return arr;
      }
      const periodVals: number[] = [];
      for (let w = 0; w < daysNeeded / 6; w++) {
        let sum = 0;
        for (let d = 0; d < 6; d++) {
          sum += arr[w * 6 + d] || 0;
        }
        periodVals.push(parseFloat(sum.toFixed(1)));
      }
      return periodVals;
    };

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
      totalDurationCal,
      phase1DurationCal,
      maxCalendarTime,
      daysNeeded,
      isWeeklyMode,
      woodPerDay: getPeriodValues(woodPerDayRounded),
      boardsPerDay: getPeriodValues(boardsPerDayRounded),
      masNetPerDay: getPeriodValues(masNetPerDayRounded),
      wireViazPerDay: getPeriodValues(wireViazPerDayRounded)
    };
  });

  // Динамические индексы дней и периодов для верстки HTML
  readonly dayIndices = computed(() => {
    const calc = this.vopCalculations();
    if (calc.isWeeklyMode) {
      const weeks = calc.daysNeeded / 6;
      return Array.from({ length: weeks }, (_, i) => i);
    } else {
      const days = calc.daysNeeded;
      return Array.from({ length: days }, (_, i) => i);
    }
  });

  readonly periodIndices = computed(() => {
    const calc = this.vopCalculations();
    if (calc.isWeeklyMode) {
      return Array.from({ length: calc.daysNeeded }, (_, i) => i);
    } else {
      return Array.from({ length: calc.daysNeeded * 6 }, (_, i) => i);
    }
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

  getActiveGroupName(): string {
    const activeId = this.vm.activeCalculationGroupId();
    if (activeId === 'all') {
      return 'Все объекты на карте';
    }
    const group = this.vm.objectGroups().find((g: any) => g.id === activeId);
    return group ? group.name : 'Неизвестный район';
  }
}
