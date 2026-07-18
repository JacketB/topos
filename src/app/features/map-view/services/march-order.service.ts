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
  // Сигнал, содержащий текущие элементы походного порядка с индивидуальной средней длиной техники
  readonly elements = signal<MarchOrderElement[]>([
    {
      id: 'gd',
      name: 'Головной дозор (ГД)',
      icon: 'bmp_svoy1',
      composition: 'Мотострелковый взвод на БМП-2',
      vehicleCount: 3,
      vehicleLength: 6.7,
      vehicleDistance: 50,
      vehicleDistanceUnit: 'm',
      distanceToNext: 3,
      distanceUnit: 'km'
    },
    {
      id: 'gpz',
      name: 'Головная походная застава (ГПЗ)',
      icon: 'bmp_svoy1',
      composition: '1 мср (без взвода), танковый взвод Т-72, минвзвод',
      vehicleCount: 12,
      vehicleLength: 7.5,
      vehicleDistance: 50,
      vehicleDistanceUnit: 'm',
      distanceToNext: 5,
      distanceUnit: 'km'
    },
    {
      id: 'hq',
      name: 'Управление и штаб батальона',
      icon: 'avto1',
      composition: 'КНП батальона, БТР-80, машина связи',
      vehicleCount: 4,
      vehicleLength: 7.7,
      vehicleDistance: 25,
      vehicleDistanceUnit: 'm',
      distanceToNext: 150,
      distanceUnit: 'm'
    },
    {
      id: 'msr1',
      name: '1-я мотострелковая рота (главные силы)',
      icon: 'bmp_svoy1',
      composition: 'мср на БМП-2',
      vehicleCount: 10,
      vehicleLength: 6.7,
      vehicleDistance: 50,
      vehicleDistanceUnit: 'm',
      distanceToNext: 150,
      distanceUnit: 'm'
    },
    {
      id: 'minbatr',
      name: 'Минометная батарея',
      icon: 'avto1',
      composition: 'Минометный взвод 120-мм, ГАЗ-66',
      vehicleCount: 12,
      vehicleLength: 7.0,
      vehicleDistance: 50,
      vehicleDistanceUnit: 'm',
      distanceToNext: 100,
      distanceUnit: 'm'
    },
    {
      id: 'msr2',
      name: '2-я мотострелковая рота',
      icon: 'bmp_svoy1',
      composition: 'мср на БМП-2, танковый взвод',
      vehicleCount: 13,
      vehicleLength: 7.3,
      vehicleDistance: 50,
      vehicleDistanceUnit: 'm',
      distanceToNext: 150,
      distanceUnit: 'm'
    },
    {
      id: 'grv',
      name: 'Гранатометный взвод',
      icon: 'btr_svoy1',
      composition: 'Гранатометный взвод на БТР-80',
      vehicleCount: 3,
      vehicleLength: 7.7,
      vehicleDistance: 50,
      vehicleDistanceUnit: 'm',
      distanceToNext: 100,
      distanceUnit: 'm'
    },
    {
      id: 'msr3',
      name: '3-я мотострелковая рота',
      icon: 'bmp_svoy1',
      composition: 'мср на БМП-2',
      vehicleCount: 10,
      vehicleLength: 6.7,
      vehicleDistance: 50,
      vehicleDistanceUnit: 'm',
      distanceToNext: 200,
      distanceUnit: 'm'
    },
    {
      id: 'bmo',
      name: 'Взвод обеспечения и медпункт (БМО)',
      icon: 'med_avto1',
      composition: 'Грузовые автомобили Урал-4320, санитарный автомобиль',
      vehicleCount: 9,
      vehicleLength: 7.3,
      vehicleDistance: 25,
      vehicleDistanceUnit: 'm',
      distanceToNext: 2,
      distanceUnit: 'km'
    },
    {
      id: 'tpo',
      name: 'Тыльное походное охранение (ТПО)',
      icon: 'btr_svoy1',
      composition: 'Мотострелковый взвод на БТР-80',
      vehicleCount: 3,
      vehicleLength: 7.7,
      vehicleDistance: 50,
      vehicleDistanceUnit: 'm',
      distanceToNext: 0,
      distanceUnit: 'm'
    }
  ]);

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
