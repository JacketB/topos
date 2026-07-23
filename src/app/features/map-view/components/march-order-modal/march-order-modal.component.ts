import { Component, inject, ChangeDetectionStrategy, ViewEncapsulation, signal, computed, effect } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { MapViewModel } from '../../viewmodels/map.viewmodel';

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

  onAddMarchOrderElement() {
    this.vm.addMarchOrderElement('Новое подразделение', 'bmp_svoy1', '1 взвод', 3, 7.5, 50, 'm', 100, 'm');
  }

  onCdkDrop(event: CdkDragDrop<any[]>) {
    const list = [...this.vm.marchOrderElements()];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    this.vm.marchOrderService.elements.set(list);
  }
}
