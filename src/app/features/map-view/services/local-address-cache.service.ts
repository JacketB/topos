import { Injectable } from '@angular/core';

export interface CachedAddressEntry {
  coords: [number, number];
  updatedAt: number;
}

@Injectable({
  providedIn: 'root'
})
export class LocalAddressCacheService {
  private readonly storageKey = 'topos_local_address_cache_v1';
  private memCache = new Map<string, CachedAddressEntry>();

  constructor() {
    this.loadFromStorage();
  }

  normalizeKey(city: string, street: string, house: string): string {
    const cleanStr = (s: string) =>
      (s || '')
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/[\(\),.\-\/\\]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const cleanCity = cleanStr(city)
      .replace(/^(г|город|д|деревня|аг|агрогородок|п|пос|поселок|пгт|гп|кп)\s+/g, '')
      .trim();

    const cleanStreet = cleanStr(street)
      .replace(/^(ул|улица|пер|переулок|пр|пр-т|проспект|тракт|б-р|бульвар|проезд|ш|шоссе)\s+/g, '')
      .trim();

    const cleanHouse = cleanStr(house)
      .replace(/^(д|дом|к|корп|корпус|строение|стр)\s+/g, '')
      .replace(/\s+/g, '')
      .trim();

    return `${cleanCity}|${cleanStreet}|${cleanHouse}`;
  }

  resolve(city: string, street: string, house: string): [number, number] | null {
    const key = this.normalizeKey(city, street, house);
    const entry = this.memCache.get(key);
    if (entry && Array.isArray(entry.coords) && entry.coords.length === 2) {
      return [entry.coords[0], entry.coords[1]];
    }

    if (house) {
      const fallbackKey = this.normalizeKey(city, street, '');
      const fallbackEntry = this.memCache.get(fallbackKey);
      if (fallbackEntry && Array.isArray(fallbackEntry.coords) && fallbackEntry.coords.length === 2) {
        return [fallbackEntry.coords[0], fallbackEntry.coords[1]];
      }
    }

    return null;
  }

  save(city: string, street: string, house: string, coords: [number, number]): void {
    if (!coords || typeof coords[0] !== 'number' || typeof coords[1] !== 'number') return;
    const key = this.normalizeKey(city, street, house);
    if (key === '||') return;

    this.memCache.set(key, {
      coords: [coords[0], coords[1]],
      updatedAt: Date.now()
    });
    this.persistToStorage();
  }

  saveBatch(entries: Array<{ city: string; street: string; house: string; coords: [number, number] }>): void {
    for (const e of entries) {
      const key = this.normalizeKey(e.city, e.street, e.house);
      if (key !== '||' && e.coords) {
        this.memCache.set(key, {
          coords: [e.coords[0], e.coords[1]],
          updatedAt: Date.now()
        });
      }
    }
    this.persistToStorage();
  }

  getCount(): number {
    return this.memCache.size;
  }

  getAllEntries(): Record<string, CachedAddressEntry> {
    const res: Record<string, CachedAddressEntry> = {};
    for (const [k, v] of this.memCache.entries()) {
      res[k] = v;
    }
    return res;
  }

  clear(): void {
    this.memCache.clear();
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(this.storageKey);
      }
    } catch {}
  }

  exportAsJson(): string {
    return JSON.stringify(this.getAllEntries(), null, 2);
  }

  importFromJson(jsonStr: string): number {
    try {
      const parsed = JSON.parse(jsonStr);
      let count = 0;
      if (parsed && typeof parsed === 'object') {
        for (const [k, v] of Object.entries(parsed)) {
          const entry = v as any;
          if (entry && Array.isArray(entry.coords) && entry.coords.length === 2) {
            this.memCache.set(k, {
              coords: [entry.coords[0], entry.coords[1]],
              updatedAt: entry.updatedAt || Date.now()
            });
            count++;
          }
        }
        this.persistToStorage();
      }
      return count;
    } catch {
      return 0;
    }
  }

  private loadFromStorage(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const raw = window.localStorage.getItem(this.storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        for (const [k, v] of Object.entries(parsed)) {
          const entry = v as any;
          if (entry && Array.isArray(entry.coords) && entry.coords.length === 2) {
            this.memCache.set(k, {
              coords: [entry.coords[0], entry.coords[1]],
              updatedAt: entry.updatedAt || 0
            });
          }
        }
      }
    } catch {}
  }

  private persistToStorage(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const obj = this.getAllEntries();
      window.localStorage.setItem(this.storageKey, JSON.stringify(obj));
    } catch {}
  }
}
