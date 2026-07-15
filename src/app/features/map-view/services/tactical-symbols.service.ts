import { Injectable, signal, computed } from '@angular/core';
import { TACTICAL_SYMBOLS, SymbolCategory as ConstCategory, TacticalSymbol as ConstSymbol } from '../consts/tactical-symbols.const';

export interface TacticalSymbol {
  id: string;
  name: string;
  symbol: string;
  size?: number;
}

export interface SymbolCategory {
  id: string;
  name: string;
  symbols: TacticalSymbol[];
}

@Injectable({
  providedIn: 'root'
})
export class TacticalSymbolsService {
  readonly symbolSearchQuery = signal<string>('');
  
  readonly allSymbols = computed<TacticalSymbol[]>(() => {
    return TACTICAL_SYMBOLS.flatMap(c => c.symbols);
  });

  readonly symbolsCount = computed(() => this.allSymbols().length);

  readonly groupedSymbols = computed<SymbolCategory[]>(() => {
    const query = this.symbolSearchQuery().toLowerCase().trim();

    if (!query) {
      return TACTICAL_SYMBOLS as SymbolCategory[];
    }

    return TACTICAL_SYMBOLS.map(cat => ({
      ...cat,
      symbols: cat.symbols.filter(item => 
        item.name.toLowerCase().includes(query) || 
        item.id.toLowerCase().includes(query)
      )
    })).filter(cat => cat.symbols.length > 0);
  });
}
