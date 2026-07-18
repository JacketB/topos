import { Component, ViewEncapsulation, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MapViewModel } from './viewmodels/map.viewmodel';
import { MapCanvasComponent } from './components/map-canvas/map-canvas.component';
import { MapSidebarComponent } from './components/map-sidebar/map-sidebar.component';
import { QuickLayersMenuComponent } from './components/quick-layers-menu/quick-layers-menu.component';
import { ScaleRulerComponent } from './components/scale-ruler/scale-ruler.component';
import { ToogleMap } from './components/toogle-map/toogle-map';

import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { FortificationPlannerComponent } from './components/fortification-planner/fortification-planner.component';

@Component({
  selector: 'app-map-view',
  standalone: true,
  imports: [
    MapCanvasComponent,
    MapSidebarComponent,
    QuickLayersMenuComponent,
    ScaleRulerComponent,
    ToogleMap,
    DecimalPipe,
    DragDropModule,
    FortificationPlannerComponent
  ],
  templateUrl: './map-view.html',
  styleUrl: './map-view.css',
  encapsulation: ViewEncapsulation.None
})
export class MapView {
  readonly vm = inject(MapViewModel);

  formatScale(scale: number): string {
    return this.vm.formatScale(scale);
  }

  selectPresetScale(preset: any, event: Event) {
    this.vm.selectPresetScale(preset, event);
  }

  getRoadTypeName(roadType: string): string {
    const names: Record<string, string> = {
      motorway: 'Автомагистраль',
      primary: 'Гл. дорога',
      secondary: 'Втор. дорога',
      tertiary: 'Местная дорога',
      minor: 'Просёлочная',
      track: 'Грунтовая',
      path: 'Пешеходная тропа'
    };
    return names[roadType] || 'Неизвестно';
  }

  formatDuration(hours: number): string {
    return this.vm.formatDuration(hours);
  }

  onMarchColumnChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    if (select) {
      this.vm.marchColumnType.set(select.value as any);
    }
  }

  onMarchNightChange(event: Event) {
    const checkbox = event.target as HTMLInputElement;
    if (checkbox) {
      this.vm.marchIsNight.set(checkbox.checked);
    }
  }

  onTogglePlayback() {
    if (this.vm.isPlayingPlayback()) {
      this.vm.pausePlayback();
    } else {
      this.vm.startPlayback();
    }
  }

  onResetPlayback() {
    this.vm.resetPlayback();
  }

  onPlaybackTimelineChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.vm.setPlaybackTime(parseFloat(input.value));
  }

  onPlaybackSpeedChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.vm.setPlaybackSpeed(parseInt(select.value, 10));
  }

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
    console.log('Topos CDK Drop event triggered. Previous index:', event.previousIndex, 'Current index:', event.currentIndex);
    const list = [...this.vm.marchOrderElements()];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    this.vm.marchOrderService.elements.set(list);
    console.log('Topos CDK Drop order updated successfully');
  }
}

