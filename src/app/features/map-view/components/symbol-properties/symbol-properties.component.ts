import { Component, inject } from '@angular/core';
import { MapViewModel } from '../../viewmodels/map.viewmodel';

@Component({
  selector: 'app-symbol-properties',
  standalone: true,
  templateUrl: './symbol-properties.component.html',
  styleUrl: './symbol-properties.component.css'
})
export class SymbolPropertiesComponent {
  readonly vm = inject(MapViewModel);

  onTemplateSizeChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.vm.updateTemplateSize(parseFloat(input.value));
  }

  onTemplateAngleChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.vm.updateTemplateAngle(parseInt(input.value, 10));
  }

  onTemplateNameChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.vm.updateTemplateName(input.value);
  }

  onTemplateColorChange(event: Event | string) {
    const color = typeof event === 'string' ? event : (event.target as HTMLInputElement).value;
    this.vm.updateTemplateColor(color);
  }

  onPlacedSizeChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.vm.updatePlacedSymbolSize(parseFloat(input.value));
  }

  onPlacedAngleChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.vm.updatePlacedSymbolAngle(parseInt(input.value, 10));
  }

  onPlacedNameChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.vm.updatePlacedSymbolName(input.value);
  }

  onPlacedColorChange(event: Event | string) {
    const color = typeof event === 'string' ? event : (event.target as HTMLInputElement).value;
    this.vm.updatePlacedSymbolColor(color);
  }
}
