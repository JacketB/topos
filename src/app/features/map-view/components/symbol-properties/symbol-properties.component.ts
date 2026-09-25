import { Component, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { MapViewModel } from '../../viewmodels/map.viewmodel';
import { TrenchGeometryService } from '../../services/trench-geometry.service';
import { Fortification3dProfileType, FortificationCustomParams } from '../fortification-3d-modal/fortification-3d-modal.component';

@Component({
  selector: 'app-symbol-properties',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './symbol-properties.component.html',
  styleUrl: './symbol-properties.component.css'
})
export class SymbolPropertiesComponent {
  readonly vm = inject(MapViewModel);
  readonly trenchGeometryService = inject(TrenchGeometryService);

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

  onPlacedFontFamilyChange(event: Event | string) {
    const font = typeof event === 'string' ? event : (event.target as HTMLSelectElement).value;
    this.vm.updatePlacedSymbolProperty('fontFamily', font);
  }

  onPlacedTextSizeChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const size = parseFloat(input.value);
    if (!isNaN(size)) {
      this.vm.updatePlacedSymbolProperties({ textSize: size, size: size });
    }
  }

  onPlacedTextColorChange(event: Event | string) {
    const color = typeof event === 'string' ? event : (event.target as HTMLInputElement).value;
    this.vm.updatePlacedSymbolProperties({ textColor: color, color: color });
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

  isFortificationObject(placed: any): boolean {
    if (!placed?.properties) return false;
    const lineType = placed.properties['lineType'];
    const symbol = placed.properties['symbol'] || '';
    const name = (placed.properties['name'] || '').toLowerCase();
    if (lineType === 'trench' || lineType === 'comm_open' || lineType === 'comm_covered' || lineType === 'ditch_pt' || lineType === 'escarp' || lineType === 'counterscarp') {
      return true;
    }
    if (symbol.includes('fort') || symbol.includes('dugout') || symbol.includes('tank') || symbol.includes('bmp') || symbol.includes('btr') || symbol.includes('trench') || symbol.includes('shelter') || symbol.includes('cell')) {
      return true;
    }
    if (name.includes('блиндаж') || name.includes('окоп') || name.includes('транше') || name.includes('укрыти') || name.includes('ячейк') || name.includes('квс') || name.includes('спс')) {
      return true;
    }
    return false;
  }

  openFort3dForPlaced(placed: any) {
    const props = placed?.properties || {};
    const lineType = props['lineType'];
    const symbol = props['symbol'] || '';
    const name = props['name'] || '';
    const nameLower = name.toLowerCase();
    const rev = props['fortRevetment'];
    
    let realLengthM = 10.0;
    if (props['lineLengthKm'] !== undefined && props['lineLengthKm'] !== null && Number(props['lineLengthKm']) > 0) {
      realLengthM = Math.round(Number(props['lineLengthKm']) * 1000 * 10) / 10;
    } else if (props['fortLength'] !== undefined && props['fortLength'] !== null && Number(props['fortLength']) > 0) {
      realLengthM = Math.round(Number(props['fortLength']) * 10) / 10;
    } else {
      const coords = (props['origCoords'] || placed?.geometry?.coordinates) as [number, number][] | undefined;
      if (coords && coords.length >= 2) {
        const lenInfo = this.trenchGeometryService.calculateLineLengthKm(coords);
        if (lenInfo.lengthM > 0) {
          realLengthM = Math.round(lenInfo.lengthM * 10) / 10;
        }
      }
    }

    let realDepthM = 1.5;
    if (props['fortDepth'] !== undefined && props['fortDepth'] !== null) {
      realDepthM = Math.round(Number(props['fortDepth']) / 10) / 10;
    } else if (lineType === 'comm_open') {
      realDepthM = 1.5;
    } else if (lineType === 'comm_covered') {
      realDepthM = 1.5;
    } else if (lineType === 'trench' && props['fortProfile'] === 'main') {
      realDepthM = 1.1;
    }

    let realWidthTopM = 1.0;
    if (props['fortWidth'] !== undefined && props['fortWidth'] !== null) {
      realWidthTopM = Math.round(Number(props['fortWidth']) / 10) / 10;
    } else if (lineType === 'trench') {
      realWidthTopM = 1.1;
    }

    let prof: Fortification3dProfileType = 'trench_standard';
    if (lineType === 'comm_covered') {
      prof = 'comm_covered';
    } else if (lineType === 'comm_open') {
      prof = 'comm_open';
    } else if (lineType === 'trench') {
      if (rev === 'board') prof = 'trench_revetment_boards';
      else if (rev === 'board_incline' || rev === 'wood') prof = 'trench_revetment_sleepers';
      else prof = 'trench_standard';
    } else if (symbol.includes('tank') || nameLower.includes('танк')) {
      prof = 'tank_trench';
    } else if (symbol.includes('bmp') || symbol.includes('btr') || nameLower.includes('бмп') || nameLower.includes('бтр')) {
      prof = 'bmp_trench';
    } else if (symbol.includes('cell') || nameLower.includes('ячейк') || nameLower.includes('стрелк')) {
      prof = 'infantry_cell';
    } else if (symbol.includes('dugout_3') || nameLower.includes('3 накат') || nameLower.includes('тяжел') || symbol.includes('kvs_u') || nameLower.includes('квс-у')) {
      prof = 'dugout_3layers';
    } else if (symbol.includes('dugout_2') || nameLower.includes('2 накат') || nameLower.includes('усилен') || symbol.includes('kvs_a') || nameLower.includes('квс-а')) {
      prof = 'dugout_2layers';
    } else if (symbol.includes('dugout') || nameLower.includes('блиндаж') || nameLower.includes('укрыти') || symbol.includes('sps') || nameLower.includes('спс')) {
      prof = 'dugout_1layer';
    } else if (lineType === 'ditch_pt') {
      prof = 'tank_trench';
    }

    const customParams: FortificationCustomParams = {
      name: name || undefined,
      lineType,
      symbol,
      lengthM: realLengthM,
      depthM: realDepthM,
      widthTopM: realWidthTopM,
      widthBottomM: Math.max(0.4, Math.round((realWidthTopM - 0.4) * 10) / 10),
      revetment: rev,
      profile: props['fortProfile']
    };

    this.vm.openFortification3d(prof, customParams);
  }
}
