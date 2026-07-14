import { Injectable, signal, computed } from '@angular/core';
import { SymbolCategory, TACTICAL_SYMBOLS, TacticalSymbol } from '../consts/tactical-symbols.const';

@Injectable({
  providedIn: 'root'
})
export class TacticalSymbolsService {
  readonly availableSymbols = signal<SymbolCategory[]>(TACTICAL_SYMBOLS);
  readonly symbolSearchQuery = signal<string>('');

  readonly groupedSymbols = computed(() => {
    const query = this.symbolSearchQuery().toLowerCase().trim();
    if (!query) {
      return this.availableSymbols();
    }

    return this.availableSymbols()
      .map(category => ({
        ...category,
        symbols: category.symbols.filter(s =>
          s.name.toLowerCase().includes(query) || s.id.toLowerCase().includes(query)
        )
      }))
      .filter(category => category.symbols.length > 0);
  });
}
