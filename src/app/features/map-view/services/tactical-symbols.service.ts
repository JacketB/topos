import { Injectable, signal, computed } from '@angular/core';

export interface TacticalSymbol {
  id: string;
  name: string;
  symbol: string;
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
  readonly allSymbols = signal<any[]>([]);
  readonly symbolSearchQuery = signal<string>('');
  readonly symbolsCount = computed(() => this.allSymbols().length || 805);

  constructor() {
    this.loadManifest();
  }

  private async loadManifest() {
    try {
      const res = await fetch('symbols/manifest.json');
      const data = await res.json();
      this.allSymbols.set(data);
    } catch (e) {
      console.error('Ошибка загрузки манифеста тактических знаков:', e);
    }
  }

  readonly groupedSymbols = computed<SymbolCategory[]>(() => {
    const list = this.allSymbols();
    const query = this.symbolSearchQuery().toLowerCase().trim();

    const filtered = query
      ? list.filter(item => item.name.toLowerCase().includes(query) || item.id.toLowerCase().includes(query))
      : list;

    const groups: { [key: string]: TacticalSymbol[] } = {};
    filtered.forEach(item => {
      const cat = item.category || 'Общие';
      if (!groups[cat]) {
        groups[cat] = [];
      }
      groups[cat].push({
        id: item.id,
        name: item.name,
        symbol: item.id
      });
    });

    return Object.entries(groups)
      .sort((a, b) => a[0].localeCompare(b[0], 'ru'))
      .map(([catName, symbols]) => ({
        id: catName,
        name: catName.charAt(0).toUpperCase() + catName.slice(1),
        symbols: symbols
      }));
  });
}
