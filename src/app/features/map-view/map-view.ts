import { Component, ViewEncapsulation, inject, HostListener, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MapViewModel } from './viewmodels/map.viewmodel';
import { MapCanvasComponent } from './components/map-canvas/map-canvas.component';
import { MapSidebarComponent } from './components/map-sidebar/map-sidebar.component';
import { QuickLayersMenuComponent } from './components/quick-layers-menu/quick-layers-menu.component';
import { ScaleRulerComponent } from './components/scale-ruler/scale-ruler.component';
import { ToogleMap } from './components/toogle-map/toogle-map';

import { DragDropModule } from '@angular/cdk/drag-drop';
import { FortificationPlannerComponent } from './components/fortification-planner/fortification-planner.component';
import { MapLayersPanelComponent } from './components/map-layers-panel/map-layers-panel.component';
import { ElevationProfileComponent } from './components/elevation-profile/elevation-profile.component';
import { MapExportComponent } from './components/map-export/map-export.component';

import { MapToolbarComponent } from './components/map-toolbar/map-toolbar.component';
import { MarchOrderModalComponent } from './components/march-order-modal/march-order-modal.component';
import { DistrictSummaryModalComponent } from './components/district-summary-modal/district-summary-modal.component';
import { HelpModalComponent } from './components/help-modal/help-modal.component';
import { RoutePlannerPanelComponent } from './components/route-planner-panel/route-planner-panel.component';
import { EngineeringCalculatorModalComponent } from './components/engineering-calculator-modal/engineering-calculator-modal.component';
import { Terrain3dModalComponent } from './components/terrain-3d-modal/terrain-3d-modal.component';
import { Fortification3dModalComponent } from './components/fortification-3d-modal/fortification-3d-modal.component';
import { DispatchRoutesModalComponent } from './components/dispatch-routes-modal/dispatch-routes-modal.component';

@Component({
  selector: 'app-map-view',
  standalone: true,
  imports: [
    MapCanvasComponent,
    MapSidebarComponent,
    QuickLayersMenuComponent,
    ScaleRulerComponent,
    ToogleMap,
    DragDropModule,
    FortificationPlannerComponent,
    MapLayersPanelComponent,
    ElevationProfileComponent,
    MapExportComponent,
    FormsModule,
    MapToolbarComponent,
    MarchOrderModalComponent,
    DistrictSummaryModalComponent,
    HelpModalComponent,
    RoutePlannerPanelComponent,
    EngineeringCalculatorModalComponent,
    Terrain3dModalComponent,
    Fortification3dModalComponent,
    DispatchRoutesModalComponent
  ],
  templateUrl: './map-view.html',
  styleUrl: './map-view.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MapView {
  readonly vm = inject(MapViewModel);

  @HostListener('window:keydown', ['$event'])
  handleGlobalHotkeys(event: KeyboardEvent) {
    if (event.key === 'F1') {
      event.preventDefault();
      this.vm.toggleHelpModal();
      return;
    }

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
      if (key === 'd' || key === 'в') {
        event.preventDefault();
        this.vm.toggleDispatchModal();
        return;
      }
    }

    if (key === 'escape') {
      if (this.vm.pickingDispatchTarget() !== null) {
        this.vm.setPickingDispatchTarget(null);
        return;
      }
      if (this.vm.activeLineMode()) {
        this.vm.cancelDrawingLine();
      } else if (this.vm.activeCategoryDropdown()) {
        this.vm.toggleCategoryDropdown(null);
      } else if (this.vm.isDispatchModalOpen()) {
        this.vm.closeDispatchModal();
      } else if (this.vm.isFortPlannerOpen()) {
        this.vm.toggleFortPlanner();
      } else if (this.vm.isEngineeringCalcOpen()) {
        this.vm.toggleEngineeringCalc();
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
      case 'd': case 'в':
        this.vm.activeLineMode() === 'ditch_pt' ? this.vm.cancelDrawingLine() : this.vm.startDrawingLine('ditch_pt');
        break;
      case 'p': case 'з':
        this.vm.activeLineMode() === 'point' ? this.vm.cancelDrawingLine() : this.vm.startDrawingLine('point');
        break;
      case 'r': case 'к':
        this.vm.toggleRoutePlanner();
        break;
      case 'a': case 'ф':
        this.vm.activeLineMode() === 'arrow_attack' ? this.vm.cancelDrawingLine() : this.vm.startDrawingLine('arrow_attack');
        break;
      case 'x': case 'ч':
        this.vm.activeLineMode() === 'area_polygon' ? this.vm.cancelDrawingLine() : this.vm.startDrawingLine('area_polygon');
        break;
      case 'n': case 'т':
        this.vm.activeLineMode() === 'simple_line' ? this.vm.cancelDrawingLine() : this.vm.startDrawingLine('simple_line');
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
}

