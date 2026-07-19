import { Component, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MapViewModel } from '../../viewmodels/map.viewmodel';

@Component({
  selector: 'app-symbol-properties',
  standalone: true,
  imports: [DecimalPipe],
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

  onPlacedSmoothChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const isSmooth = input.checked;
    const selected = this.vm.selectedPlacedSymbol();
    if (selected && selected.properties['isLinear']) {
      this.vm.tacticalMapService.updatePlacedLineSmooth(selected.properties['id'], isSmooth);
    }
  }

  onOrientToTerrain() {
    this.vm.orientSelectedPlacedSymbolToTerrain();
  }

  onPlacedProfileChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const profile = select.value;
    this.vm.updatePlacedSymbolProperty('fortProfile', profile);
    
    // Автоматически синхронизируем ширину и глубину при смене профиля
    const depth = profile === 'full' ? 150 : 110;
    const width = profile === 'full' ? 110 : 90;
    this.vm.updatePlacedSymbolProperty('fortDepth', depth);
    this.vm.updatePlacedSymbolProperty('fortWidth', width);
  }

  onPlacedRevetmentChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.vm.updatePlacedSymbolProperty('fortRevetment', select.value);
  }

  onPlacedDepthChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const depth = parseInt(input.value, 10);
    if (!isNaN(depth)) {
      this.vm.updatePlacedSymbolProperty('fortDepth', depth);
    }
  }

  onPlacedWidthChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const width = parseInt(input.value, 10);
    if (!isNaN(width)) {
      this.vm.updatePlacedSymbolProperty('fortWidth', width);
    }
  }

  onPlacedLengthChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const length = parseInt(input.value, 10);
    if (!isNaN(length)) {
      this.vm.updatePlacedSymbolProperty('fortLength', length);
    }
  }
}
