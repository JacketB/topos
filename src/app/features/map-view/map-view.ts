import { Component, ViewEncapsulation, inject } from '@angular/core';
import { MapViewModel } from './viewmodels/map.viewmodel';
import { MapCanvasComponent } from './components/map-canvas/map-canvas.component';
import { MapSidebarComponent } from './components/map-sidebar/map-sidebar.component';
import { QuickLayersMenuComponent } from './components/quick-layers-menu/quick-layers-menu.component';
import { ScaleRulerComponent } from './components/scale-ruler/scale-ruler.component';

@Component({
  selector: 'app-map-view',
  standalone: true,
  imports: [
    MapCanvasComponent,
    MapSidebarComponent,
    QuickLayersMenuComponent,
    ScaleRulerComponent
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
}
