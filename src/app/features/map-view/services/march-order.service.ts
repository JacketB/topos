import { Injectable, signal } from '@angular/core';

export interface MarchOrderElement {
  id: string;
  name: string;
  icon: string;
  composition: string;
  vehicleCount: number;
  vehicleLength: number;
  vehicleDistance: number;
  vehicleDistanceUnit: 'm' | 'km';
  distanceToNext: number;
  distanceUnit: 'm' | 'km';
  officersCount?: number;
  sergeantsCount?: number;
  soldiersCount?: number;
}

const DEFAULT_MARCH_ELEMENTS: MarchOrderElement[] = [
  {
    id: 'el_1',
    name: 'Головной дозор (ГД)',
    icon: 'bmp_svoy1',
    composition: '',
    vehicleCount: 3,
    vehicleLength: 6.7,
    vehicleDistance: 50,
    vehicleDistanceUnit: 'm',
    distanceToNext: 5,
    distanceUnit: 'km',
    officersCount: 1,
    sergeantsCount: 3,
    soldiersCount: 18
  },
  {
    id: 'el_2',
    name: 'Головная походная застава (ГПЗ)',
    icon: 'btr_svoy1',
    composition: '',
    vehicleCount: 31,
    vehicleLength: 7.5,
    vehicleDistance: 50,
    vehicleDistanceUnit: 'm',
    distanceToNext: 10,
    distanceUnit: 'km',
    officersCount: 6,
    sergeantsCount: 15,
    soldiersCount: 80
  },
  {
    id: 'el_3',
    name: 'Главные силы (ГС)',
    icon: 'tank_svoy1',
    composition: '',
    vehicleCount: 110,
    vehicleLength: 8.0,
    vehicleDistance: 50,
    vehicleDistanceUnit: 'm',
    distanceToNext: 5,
    distanceUnit: 'km',
    officersCount: 28,
    sergeantsCount: 70,
    soldiersCount: 350
  },
  {
    id: 'el_4',
    name: 'Тыловая походная застава (ТПО)',
    icon: 'truck_svoy',
    composition: '',
    vehicleCount: 18,
    vehicleLength: 8.5,
    vehicleDistance: 50,
    vehicleDistanceUnit: 'm',
    distanceToNext: 0,
    distanceUnit: 'm',
    officersCount: 3,
    sergeantsCount: 8,
    soldiersCount: 40
  }
];

@Injectable({
  providedIn: 'root'
})
export class MarchOrderService {
  readonly elements = signal<MarchOrderElement[]>([]);

  constructor() {
    this.loadElements();
  }

  private loadElements() {
    try {
      const stored = localStorage.getItem('topos_march_order_elements');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.elements.set(parsed);
          return;
        }
      }
    } catch {}
    this.elements.set(DEFAULT_MARCH_ELEMENTS);
  }

  private saveElements() {
    try {
      localStorage.setItem('topos_march_order_elements', JSON.stringify(this.elements()));
    } catch {}
  }

  addElement(element: Omit<MarchOrderElement, 'id'>) {
    const id = 'element_' + Math.random().toString(36).substr(2, 9);
    this.elements.update(prev => [...prev, { ...element, id }]);
    this.saveElements();
  }

  removeElement(id: string) {
    this.elements.update(prev => prev.filter(el => el.id !== id));
    this.saveElements();
  }

  updateElement(id: string, updates: Partial<Omit<MarchOrderElement, 'id'>>) {
    this.elements.update(prev => prev.map(el => {
      if (el.id === id) {
        return { ...el, ...updates };
      }
      return el;
    }));
    this.saveElements();
  }

  moveElement(index: number, direction: 'up' | 'down') {
    const list = [...this.elements()];
    if (direction === 'up' && index > 0) {
      const temp = list[index];
      list[index] = list[index - 1];
      list[index - 1] = temp;
      this.elements.set(list);
      this.saveElements();
    } else if (direction === 'down' && index < list.length - 1) {
      const temp = list[index];
      list[index] = list[index + 1];
      list[index + 1] = temp;
      this.elements.set(list);
      this.saveElements();
    }
  }

  setElements(elements: MarchOrderElement[]) {
    this.elements.set(elements);
    this.saveElements();
  }

  getUnitLengthKm(el: MarchOrderElement): number {
    if (el.vehicleCount <= 0) return 0;
    
    const distBetweenKm = el.vehicleDistanceUnit === 'km' 
      ? el.vehicleDistance 
      : el.vehicleDistance / 1000;
      
    const vehicleLengthKm = el.vehicleLength / 1000;
    const lengthKm = (el.vehicleCount * vehicleLengthKm) + ((el.vehicleCount - 1) * distBetweenKm);
    return Math.max(0, lengthKm);
  }

  calculateTotalLengthKm(): number {
    let totalKm = 0;
    this.elements().forEach(el => {
      totalKm += this.getUnitLengthKm(el);
      
      if (el.distanceToNext > 0) {
        if (el.distanceUnit === 'km') {
          totalKm += el.distanceToNext;
        } else {
          totalKm += el.distanceToNext / 1000;
        }
      }
    });
    return totalKm;
  }

  calculateAdvancedMarch(params: {
    avgVehicleLengthM: number;
    distBetweenVehiclesM: number;
    distBetweenUnitsM: number;
    speedToIrKmh: number;
    routeLengthKm: number;
    marchSpeedKmh: number;
    restTimeMin: number;
    barrierCount: number;
    barrierSpeedKmh: number;
  }) {
    const list = this.elements();
    const totalVehicles = list.reduce((sum, el) => sum + el.vehicleCount, 0);

    let totalDepthM = 0;
    list.forEach((el, idx) => {
      const isLast = idx === list.length - 1;
      const unitDepthM = (el.vehicleCount * (el.vehicleLength || params.avgVehicleLengthM)) +
        (Math.max(0, el.vehicleCount - 1) * (el.vehicleDistanceUnit === 'km' ? el.vehicleDistance * 1000 : (el.vehicleDistance || params.distBetweenVehiclesM)));
      
      const interUnitDistM = isLast ? 0 : (el.distanceToNext ? (el.distanceUnit === 'km' ? el.distanceToNext * 1000 : el.distanceToNext) : params.distBetweenUnitsM);
      
      totalDepthM += unitDepthM + interUnitDistM;
    });

    const totalDepthKm = totalDepthM / 1000;
    const irDistanceKm = Math.ceil(totalDepthKm * 10) / 10;
    
    const timeToIrMin = params.speedToIrKmh > 0 ? (irDistanceKm / params.speedToIrKmh) * 60 : 0;
    const timeStretchMin = params.marchSpeedKmh > 0 ? (totalDepthKm / params.marchSpeedKmh) * 60 : 0;
    const pureTravelTimeMin = params.marchSpeedKmh > 0 ? (params.routeLengthKm / params.marchSpeedKmh) * 60 : 0;

    let barrierDelayMin = 0;
    if (params.barrierSpeedKmh > 0 && params.barrierSpeedKmh < params.marchSpeedKmh) {
      const timeOnBarrierMin = (totalDepthKm / params.barrierSpeedKmh) * 60;
      barrierDelayMin = (timeOnBarrierMin - timeStretchMin) * params.barrierCount;
    }

    const totalMarchTimeMin = pureTravelTimeMin + params.restTimeMin + barrierDelayMin + timeStretchMin;

    const formatTime = (totalMinutes: number) => {
      const hrs = Math.floor(totalMinutes / 60);
      const mins = Math.round(totalMinutes % 60);
      return `${hrs} ч. ${mins} мин.`;
    };

    const totalOfficers = list.reduce((sum, el) => sum + (el.officersCount || 0), 0);
    const totalSergeants = list.reduce((sum, el) => sum + (el.sergeantsCount || 0), 0);
    const totalSoldiers = list.reduce((sum, el) => sum + (el.soldiersCount || 0), 0);
    const totalManpower = totalOfficers + totalSergeants + totalSoldiers;

    return {
      totalVehicles,
      totalOfficers,
      totalSergeants,
      totalSoldiers,
      totalManpower,
      totalDepthM,
      totalDepthKm,
      irDistanceKm,
      timeToIrMin,
      timeStretchMin,
      pureTravelTimeMin,
      barrierDelayMin,
      totalMarchTimeMin,
      totalMarchTimeFormatted: formatTime(totalMarchTimeMin),
      barrierDelayFormatted: formatTime(barrierDelayMin)
    };
  }
}
