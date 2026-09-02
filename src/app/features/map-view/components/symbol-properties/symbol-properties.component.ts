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

  onPlacedPatrolToggle(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.vm.updatePlacedSymbolProperty('hasPatrol', checked);
    const selected = this.vm.selectedPlacedSymbol();
    if (checked && selected) {
      if (!selected.properties['patrolLength']) {
        this.vm.updatePlacedSymbolProperty('patrolLength', 400);
      }
      if (!selected.properties['patrolStyle']) {
        this.vm.updatePlacedSymbolProperty('patrolStyle', 'solid');
      }
      if (selected.properties['patrolAngle'] === undefined) {
        this.vm.updatePlacedSymbolProperty('patrolAngle', selected.properties['angle'] || 0);
      }
    }
  }

  onPlacedPatrolStyleChange(style: 'solid' | 'dashed') {
    this.vm.updatePlacedSymbolProperty('patrolStyle', style);
  }

  onPlacedPatrolAngleChange(event: Event) {
    const angle = parseInt((event.target as HTMLInputElement).value, 10);
    this.vm.updatePlacedSymbolProperty('patrolAngle', isNaN(angle) ? 0 : angle);
  }

  onPlacedPatrolLengthChange(event: Event) {
    const len = parseInt((event.target as HTMLInputElement).value, 10);
    if (!isNaN(len) && len > 0) {
      this.vm.updatePlacedSymbolProperty('patrolLength', len);
    }
  }

  onPlacedProfileChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const profile = select.value;
    this.vm.updatePlacedSymbolProperty('fortProfile', profile);
    
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

  onPlacedOpacityChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const opacity = parseFloat(input.value);
    if (!isNaN(opacity)) {
      this.vm.updatePlacedSymbolProperty('fillOpacity', opacity);
    }
  }

  onPlacedLineStyleChange(styleOrEvent: string | Event) {
    const style = typeof styleOrEvent === 'string' ? styleOrEvent : (styleOrEvent.target as HTMLSelectElement).value;
    this.vm.updatePlacedSymbolProperty('lineStyle', style);
  }

  onPlacedTextSizeChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const size = parseFloat(input.value);
    if (!isNaN(size)) {
      this.vm.updatePlacedSymbolProperty('textSize', size);
    }
  }

  onPlacedTextColorChange(event: Event | string) {
    const color = typeof event === 'string' ? event : (event.target as HTMLInputElement).value;
    this.vm.updatePlacedSymbolProperty('textColor', color);
    this.vm.updatePlacedSymbolProperty('color', color);
  }

  onPlacedTextHaloColorChange(event: Event | string) {
    const color = typeof event === 'string' ? event : (event.target as HTMLInputElement).value;
    this.vm.updatePlacedSymbolProperty('textHaloColor', color);
  }

  onPlacedTextHaloWidthChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const width = parseFloat(input.value);
    if (!isNaN(width)) {
      this.vm.updatePlacedSymbolProperty('textHaloWidth', width);
    }
  }
}
