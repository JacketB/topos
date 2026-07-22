import { Injectable, signal } from '@angular/core';
import { TacticalSymbol } from '../consts/tactical-symbols.const';

@Injectable({
  providedIn: 'root'
})
export class TacticalSymbolsManagerService {
  readonly selectedSymbol = signal<TacticalSymbol | null>(null);
  readonly templateCustomName = signal<string>('');
  readonly templateCustomSize = signal<number>(0.08);
  readonly templateCustomAngle = signal<number>(0);
  readonly templateCustomColor = signal<string>('');
  readonly isTerrainOrientationEnabled = signal<boolean>(true);

  readonly selectedPlacedSymbol = signal<any | null>(null);
  readonly selectedPlacedSymbols = signal<any[]>([]);

  updateTemplateName(name: string) {
    this.templateCustomName.set(name);
  }

  updateTemplateSize(size: number) {
    this.templateCustomSize.set(size);
  }

  updateTemplateAngle(angle: number) {
    this.templateCustomAngle.set(angle);
  }

  selectPlacedSymbol(symbol: any | null) {
    this.selectedPlacedSymbol.set(symbol);
    if (symbol) {
      const current = this.selectedPlacedSymbols();
      if (!current.some(s => s.properties?.id === symbol.properties?.id)) {
        this.selectedPlacedSymbols.set([symbol]);
      }
    } else {
      this.selectedPlacedSymbols.set([]);
    }
  }
}
