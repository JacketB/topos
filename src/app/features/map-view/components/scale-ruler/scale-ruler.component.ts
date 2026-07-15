import { Component, inject } from '@angular/core';
import { MapViewModel } from '../../viewmodels/map.viewmodel';
import { ScalePreset } from '../../consts/map-scale.const';

@Component({
  selector: 'app-scale-ruler',
  standalone: true,
  templateUrl: './scale-ruler.component.html',
  styleUrl: './scale-ruler.component.css'
})
export class ScaleRulerComponent {
  readonly vm = inject(MapViewModel);

  formatScale(scale: number): string {
    return scale.toLocaleString('ru-RU');
  }

  onPresetClick(preset: ScalePreset, event: Event) {
    this.vm.selectPresetScale(preset, event);
  }
}
