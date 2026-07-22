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
}

@Injectable({
  providedIn: 'root'
})
export class MarchOrderService {
  readonly elements = signal<MarchOrderElement[]>([]);

  addElement(element: Omit<MarchOrderElement, 'id'>) {
    const id = 'element_' + Math.random().toString(36).substr(2, 9);
    this.elements.update(prev => [...prev, { ...element, id }]);
  }

  removeElement(id: string) {
    this.elements.update(prev => prev.filter(el => el.id !== id));
  }

  updateElement(id: string, updates: Partial<Omit<MarchOrderElement, 'id'>>) {
    this.elements.update(prev => prev.map(el => {
      if (el.id === id) {
        return { ...el, ...updates };
      }
      return el;
    }));
  }

  moveElement(index: number, direction: 'up' | 'down') {
    const list = [...this.elements()];
    if (direction === 'up' && index > 0) {
      const temp = list[index];
      list[index] = list[index - 1];
      list[index - 1] = temp;
      this.elements.set(list);
    } else if (direction === 'down' && index < list.length - 1) {
      const temp = list[index];
      list[index] = list[index + 1];
      list[index + 1] = temp;
      this.elements.set(list);
    }
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
}
