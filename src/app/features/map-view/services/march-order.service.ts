import { Injectable, signal } from '@angular/core';

export interface MarchOrderElement {
  id: string;
  name: string;
  icon: string;                  // ID тактического знака (например, 'bmp_svoy1', 'tank_svoy_1')
  composition: string;           // Описание состава техники
  vehicleCount: number;          // Количество техники в подразделении
  vehicleLength: number;         // Средняя физическая длина одной единицы техники (в метрах)
  vehicleDistance: number;       // Дистанция между техникой внутри подразделения
  vehicleDistanceUnit: 'm' | 'km'; // Единица измерения внутри
  distanceToNext: number;        // Дистанция до следующего элемента походного порядка
  distanceUnit: 'm' | 'km';      // Единица измерения до следующего элемента
}

@Injectable({
  providedIn: 'root'
})
export class MarchOrderService {
  // Сигнал, содержащий текущие элементы походного порядка с индивидуальной средней длиной техники (по умолчанию пустой)
  readonly elements = signal<MarchOrderElement[]>([]);

  /**
   * Добавить новый элемент в схему походного порядка
   */
  addElement(element: Omit<MarchOrderElement, 'id'>) {
    const id = 'element_' + Math.random().toString(36).substr(2, 9);
    this.elements.update(prev => [...prev, { ...element, id }]);
  }

  /**
   * Удалить элемент по ID
   */
  removeElement(id: string) {
    this.elements.update(prev => prev.filter(el => el.id !== id));
  }

  /**
   * Обновить поля конкретного элемента
   */
  updateElement(id: string, updates: Partial<Omit<MarchOrderElement, 'id'>>) {
    this.elements.update(prev => prev.map(el => {
      if (el.id === id) {
        return { ...el, ...updates };
      }
      return el;
    }));
  }

  /**
   * Переместить элемент вверх/вниз в списке
   */
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

  /**
   * Рассчитать глубину колонны конкретного подразделения (в км) с учетом индивидуальной длины машин
   */
  getUnitLengthKm(el: MarchOrderElement): number {
    if (el.vehicleCount <= 0) return 0;
    
    // Переводим дистанцию между техникой в километры
    const distBetweenKm = el.vehicleDistanceUnit === 'km' 
      ? el.vehicleDistance 
      : el.vehicleDistance / 1000;
      
    // Индивидуальная средняя длина одной единицы техники (переводим метры в км)
    const vehicleLengthKm = el.vehicleLength / 1000;
    
    // Глубина колонны подразделения: (N * L_vehicle) + (N - 1) * D_between
    const lengthKm = (el.vehicleCount * vehicleLengthKm) + ((el.vehicleCount - 1) * distBetweenKm);
    return Math.max(0, lengthKm);
  }

  /**
   * Рассчитать общую длину походной колонны батальона (с учетом глубин подразделений и дистанций между ними)
   */
  calculateTotalLengthKm(): number {
    let totalKm = 0;
    this.elements().forEach(el => {
      // 1. Прибавляем индивидуальную глубину колонны самого подразделения
      totalKm += this.getUnitLengthKm(el);
      
      // 2. Прибавляем дистанцию до следующего подразделения
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
