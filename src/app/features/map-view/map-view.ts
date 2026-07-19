import { Component, ViewEncapsulation, inject, HostListener } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapViewModel } from './viewmodels/map.viewmodel';
import { MapCanvasComponent } from './components/map-canvas/map-canvas.component';
import { MapSidebarComponent } from './components/map-sidebar/map-sidebar.component';
import { QuickLayersMenuComponent } from './components/quick-layers-menu/quick-layers-menu.component';
import { ScaleRulerComponent } from './components/scale-ruler/scale-ruler.component';
import { ToogleMap } from './components/toogle-map/toogle-map';

import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { FortificationPlannerComponent } from './components/fortification-planner/fortification-planner.component';
import { MapLayersPanelComponent } from './components/map-layers-panel/map-layers-panel.component';
import { ElevationProfileComponent } from './components/elevation-profile/elevation-profile.component';
import { MapExportComponent } from './components/map-export/map-export.component';

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
    FortificationPlannerComponent,
    MapLayersPanelComponent,
    ElevationProfileComponent,
    MapExportComponent,
    FormsModule
  ],
  templateUrl: './map-view.html',
  styleUrl: './map-view.css',
  encapsulation: ViewEncapsulation.None
})
export class MapView {
  readonly vm = inject(MapViewModel);

  @HostListener('window:keydown', ['$event'])
  handleGlobalHotkeys(event: KeyboardEvent) {
    const target = event.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }

    const key = event.key.toLowerCase();

    // Экспорт / Импорт по Shift+S / Shift+O
    if (event.shiftKey) {
      if (key === 's' || key === 'ы') {
        event.preventDefault();
        this.vm.exportScenario();
        return;
      }
      if (key === 'o' || key === 'щ') {
        event.preventDefault();
        const fileInput = document.querySelector('input[type="file"][accept=".tps,.json"]') as HTMLInputElement;
        if (fileInput) {
          fileInput.click();
        }
        return;
      }
    }

    // Отмена / закрытие по Escape
    if (key === 'escape') {
      if (this.vm.activeLineMode()) {
        this.vm.cancelDrawingLine();
      } else if (this.vm.activeCategoryDropdown()) {
        this.vm.toggleCategoryDropdown(null);
      } else if (this.vm.isFortPlannerOpen()) {
        this.vm.toggleFortPlanner();
      } else if (this.vm.isAreaReportOpen()) {
        this.vm.toggleAreaReport();
      } else if (this.vm.isMarchOrderOpen()) {
        this.vm.toggleMarchOrder();
      }
      return;
    }

    // Горячие клавиши рисовки и режимов (поддержка Eng + Rus раскладки)
    switch (key) {
      case 't': case 'е':
        this.vm.activeLineMode() === 'trench' ? this.vm.cancelDrawingLine() : this.vm.startDrawingLine('trench');
        break;
      case 'o': case 'щ':
        this.vm.activeLineMode() === 'comm_open' ? this.vm.cancelDrawingLine() : this.vm.startDrawingLine('comm_open');
        break;
      case 'c': case 'с':
        this.vm.activeLineMode() === 'comm_covered' ? this.vm.cancelDrawingLine() : this.vm.startDrawingLine('comm_covered');
        break;
      case 'w': case 'ц':
        this.vm.activeLineMode() === 'wire' ? this.vm.cancelDrawingLine() : this.vm.startDrawingLine('wire');
        break;
      case 'p': case 'з':
        this.vm.activeLineMode() === 'point' ? this.vm.cancelDrawingLine() : this.vm.startDrawingLine('point');
        break;
      case 'r': case 'к':
        this.vm.activeLineMode() === 'march_route' ? this.vm.cancelDrawingLine() : this.vm.startDrawingLine('march_route');
        break;
      case 'a': case 'ф':
        this.vm.activeLineMode() === 'arrow_attack' ? this.vm.cancelDrawingLine() : this.vm.startDrawingLine('arrow_attack');
        break;
      case 's': case 'ы':
        this.vm.toggleLineSmooth();
        break;
      case '1':
        this.vm.tacticalMapService.interactionMode.set('pan');
        break;
      case '2':
        this.vm.tacticalMapService.interactionMode.set('edit');
        break;
      case '3':
        this.vm.tacticalMapService.interactionMode.set('select');
        break;
      case 'm': case 'ь':
        this.vm.toggleMarchOrder();
        break;
      case 'e': case 'у':
        this.vm.toggleElevationProfileFromToolbar();
        break;
      case 'g': case 'п':
        this.vm.toggleFortPlanner();
        break;
      case 'v': case 'м':
        this.vm.toggleAreaReport();
        break;
      case 'l': case 'д':
        this.vm.toggleCategoryDropdown('symbols_library');
        break;
    }
  }

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

