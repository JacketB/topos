import { Injectable, inject, signal } from '@angular/core';
import maplibregl from 'maplibre-gl';
import * as XLSX from 'xlsx-js-style';
import { MarchRouteService } from './march-route.service';
import { TacticalMapService } from './tactical-map.service';
import { ExcelStylerUtils } from '../utils/excel-styler.utils';
import { LocalAddressCacheService } from './local-address-cache.service';

export interface DispatchAddress {
  id: string;
  index: number;
  recipientName: string;
  city: string;
  street: string;
  house: string;
  apartment?: string;
  note?: string;
  coords: [number, number] | null;
  geocoded: boolean;
  geocodeSource?: 'manual' | 'cache' | 'settlement' | 'file';
  clusterIndex?: number;
  orderInRoute?: number;
  distanceFromPrevKm?: number;
  etaMinutes?: number;
}

export interface DispatchRoute {
  id: string;
  routeIndex: number;
  name: string;
  color: string;
  addresses: DispatchAddress[];
  startCoords: [number, number];
  endCoords: [number, number];
  totalDistanceKm: number;
  totalDurationMin: number;
  geometry: [number, number][];
  approaches?: [number, number][][];
}

export type DispatchTransportMode = 'foot' | 'car';

export interface DispatchConfig {
  startPoint: [number, number] | null;
  startPointName: string;
  routeCount: number;
  returnToStart: boolean;
  speedKmH: number;
  stopDurationMin: number;
  transportMode: DispatchTransportMode;
}

export const ROUTE_PALETTE: string[] = [
  '#2563eb',
  '#ea580c',
  '#16a34a',
  '#9333ea',
  '#0891b2',
  '#dc2626',
  '#ca8a04',
  '#db2777',
  '#4f46e5',
  '#059669'
];

@Injectable({
  providedIn: 'root'
})
export class DispatchRoutesService {
  private marchRouteService: MarchRouteService | null = null;
  private tacticalMapService: TacticalMapService | null = null;
  private localAddressCache: LocalAddressCacheService | null = null;

  readonly addresses = signal<DispatchAddress[]>([]);
  readonly routes = signal<DispatchRoute[]>([]);
  readonly isCalculating = signal<boolean>(false);
  readonly hiddenRouteIds = signal<Set<string>>(new Set());
  readonly config = signal<DispatchConfig>({
    startPoint: null,
    startPointName: 'Стартовая точка',
    routeCount: 3,
    returnToStart: true,
    speedKmH: 4.5,
    stopDurationMin: 5,
    transportMode: 'foot'
  });

  constructor(
    marchRouteService?: MarchRouteService,
    tacticalMapService?: TacticalMapService,
    localAddressCache?: LocalAddressCacheService
  ) {
    if (marchRouteService) {
      this.marchRouteService = marchRouteService;
    } else {
      try {
        this.marchRouteService = inject(MarchRouteService, { optional: true });
      } catch {
        this.marchRouteService = null;
      }
    }
    if (tacticalMapService) {
      this.tacticalMapService = tacticalMapService;
    } else {
      try {
        this.tacticalMapService = inject(TacticalMapService, { optional: true });
      } catch {
        this.tacticalMapService = null;
      }
    }
    if (localAddressCache) {
      this.localAddressCache = localAddressCache;
    } else {
      try {
        this.localAddressCache = inject(LocalAddressCacheService, { optional: true });
      } catch {
        this.localAddressCache = null;
      }
    }
  }

  isRouteVisible(routeId: string): boolean {
    return !this.hiddenRouteIds().has(routeId);
  }

  toggleRouteVisibility(routeId: string): void {
    this.hiddenRouteIds.update(prev => {
      const next = new Set(prev);
      if (next.has(routeId)) {
        next.delete(routeId);
      } else {
        next.add(routeId);
      }
      return next;
    });
  }

  isolateRoute(routeId: string): void {
    const all = this.routes();
    this.hiddenRouteIds.update(prev => {
      const isAlreadyIsolated = prev.size === all.length - 1 && !prev.has(routeId);
      if (isAlreadyIsolated) {
        return new Set();
      }
      const next = new Set<string>();
      for (const r of all) {
        if (r.id !== routeId) {
          next.add(r.id);
        }
      }
      return next;
    });
  }

  showAllRoutes(): void {
    this.hiddenRouteIds.set(new Set());
  }

  hideAllRoutes(): void {
    const allIds = new Set(this.routes().map(r => r.id));
    this.hiddenRouteIds.set(allIds);
  }

  haversineDistanceKm(p1: [number, number], p2: [number, number]): number {
    const R = 6371;
    const dLat = (p2[1] - p1[1]) * Math.PI / 180;
    const dLon = (p2[0] - p1[0]) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(p1[1] * Math.PI / 180) * Math.cos(p2[1] * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async parseExcelFile(file: File): Promise<DispatchAddress[]> {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    if (!wb.SheetNames || wb.SheetNames.length === 0) {
      throw new Error('Файл Excel не содержит листов');
    }

    const ws = wb.Sheets[wb.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
    if (!rawData || rawData.length === 0) {
      return [];
    }

    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(rawData.length, 10); i++) {
      const row = rawData[i];
      if (Array.isArray(row) && row.some(cell => typeof cell === 'string' && cell.trim().length > 0)) {
        headerRowIdx = i;
        break;
      }
    }

    if (headerRowIdx === -1) {
      return [];
    }

    const headerRow = rawData[headerRowIdx].map((c: any) => String(c || '').trim().toLowerCase());

    const findColIdx = (patterns: RegExp[]): number => {
      return headerRow.findIndex(h => patterns.some(p => p.test(h)));
    };

    const colRecipient = findColIdx([/фио/, /получател/, /гражданин/, /имя/, /фамили/, /адресат/, /name/, /recipient/]);
    const colCity = findColIdx([/город/, /населен/, /нп/, /посел/, /деревн/, /пгт/, /city/, /town/]);
    const colStreet = findColIdx([/улиц/, /просп/, /проезд/, /пер/, /бульвар/, /тракт/, /street/]);
    const colHouse = findColIdx([/дом/, /строен/, /вл/, /здан/, /house/, /bld/]);
    const colApartment = findColIdx([/кв/, /квартир/, /корп/, /корпус/, /flat/, /apt/]);
    const colNote = findColIdx([/примеч/, /заметк/, /телефон/, /тел/, /статус/, /коммент/, /note/, /phone/]);
    const colLat = findColIdx([/широт/, /lat/, /latitude/]);
    const colLng = findColIdx([/долгот/, /lon/, /lng/, /longitude/]);

    const result: DispatchAddress[] = [];
    let currentIdx = 1;

    for (let r = headerRowIdx + 1; r < rawData.length; r++) {
      const row = rawData[r];
      if (!Array.isArray(row) || row.every(cell => cell === null || cell === undefined || String(cell).trim() === '')) {
        continue;
      }

      let recipient = colRecipient >= 0 ? String(row[colRecipient] || '').trim() : '';
      let city = colCity >= 0 ? String(row[colCity] || '').trim() : '';
      let street = colStreet >= 0 ? String(row[colStreet] || '').trim() : '';
      let house = colHouse >= 0 ? String(row[colHouse] || '').trim() : '';
      let apartment = colApartment >= 0 ? String(row[colApartment] || '').trim() : '';
      let note = colNote >= 0 ? String(row[colNote] || '').trim() : '';

      if (colRecipient === -1 && colStreet === -1) {
        street = String(row[0] || '').trim();
      }

      let coords: [number, number] | null = null;
      if (colLat >= 0 && colLng >= 0) {
        const parsedLat = parseFloat(String(row[colLat]).replace(',', '.'));
        const parsedLng = parseFloat(String(row[colLng]).replace(',', '.'));
        if (!isNaN(parsedLat) && !isNaN(parsedLng) && parsedLat >= 50 && parsedLat <= 57 && parsedLng >= 22 && parsedLng <= 33) {
          coords = [parsedLng, parsedLat];
        }
      }

      result.push({
        id: `addr_${Date.now()}_${currentIdx}`,
        index: currentIdx,
        recipientName: recipient || `Адресат ${currentIdx}`,
        city: city,
        street: street,
        house: house,
        apartment: apartment || undefined,
        note: note || undefined,
        coords: coords,
        geocoded: coords !== null,
        geocodeSource: coords !== null ? 'file' : undefined
      });

      currentIdx++;
    }

    return result;
  }

  generateTemplateWorkbook(): XLSX.WorkBook {
    const wb = XLSX.utils.book_new();
    const headers = [
      '№ п/п',
      'ФИО получателя',
      'Населенный пункт',
      'Улица',
      'Дом',
      'Квартира',
      'Примечание',
      'Широта (опционально)',
      'Долгота (опционально)'
    ];

    const demoRows = [
      [1, 'Иванов Иван Иванович', 'Борисов', 'Гагарина', '14', '5', 'Вручить лично', 54.2185, 28.5082],
      [2, 'Петров Петр Сергеевич', 'Борисов', '30 лет ВЛКСМ', '8', '', 'Домофон код 8', 54.2251, 28.5134],
      [3, 'Сидоров Алексей Николаевич', 'Борисов', 'Нормандия-Неман', '21', 'корп. 1', '', 54.2340, 28.5240],
      [4, 'Ковалев Дмитрий Михайлович', 'Борисов', 'Труда', '3', '12', 'После 18:00', 54.2295, 28.4981],
      [5, 'Смирнов Виктор Павлович', 'Борисов', 'Чапаева', '45', '', 'Частный дом', 54.2120, 28.5310]
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...demoRows]);
    ws['!cols'] = [
      { wch: 8 },
      { wch: 30 },
      { wch: 20 },
      { wch: 24 },
      { wch: 10 },
      { wch: 12 },
      { wch: 25 },
      { wch: 22 },
      { wch: 22 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Шаблон_оповещения');
    return wb;
  }

  async autoGeocodeBySettlements(items: DispatchAddress[]): Promise<DispatchAddress[]> {
    const unassigned = items.filter(i => !i.coords);
    const dbMatches = new Map<string, { coords: [number, number]; matchType: string }>();

    if (unassigned.length > 0) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const queries = unassigned.map(item => ({
          id: item.id,
          city: item.city || undefined,
          street: item.street || undefined,
          house: item.house || undefined
        }));
        const results = await invoke<Array<{
          id: string;
          found: boolean;
          matchType: string;
          lat: number;
          lon: number;
        }>>('resolve_addresses_batch', { queries });
        if (results && results.length > 0) {
          for (const res of results) {
            if (res.found && res.lat !== 0 && res.lon !== 0) {
              dbMatches.set(res.id, {
                coords: [res.lon, res.lat],
                matchType: res.matchType
              });
            }
          }
        }
      } catch {}
    }

    let placesMap: Map<string, [number, number]> | null = null;
    if (this.marchRouteService) {
      const places = await this.marchRouteService.getAllPlaces();
      if (places && places.length > 0) {
        placesMap = new Map<string, [number, number]>();
        const normalizePlace = (name: string): string => {
          return (name || '')
            .toLowerCase()
            .replace(/^(г\.|г\s+|город\s+|д\.|д\s+|деревня\s+|аг\.|аг\s+|агрогородок\s+|п\.|п\s+|пос\.|поселок\s+|г\.п\.|к\.п\.|м-н\s+|пгт\s+)\s*/gi, '')
            .replace(/[\(\),]/g, ' ')
            .trim();
        };

        for (const p of places) {
          const rawName = p.name.toLowerCase().trim();
          placesMap.set(rawName, p.coords);
          placesMap.set(normalizePlace(rawName), p.coords);
          if (p.nameBe) {
            const rawBe = p.nameBe.toLowerCase().trim();
            placesMap.set(rawBe, p.coords);
            placesMap.set(normalizePlace(rawBe), p.coords);
          }
        }
      }
    }

    const normalizePlaceFallback = (name: string): string => {
      return (name || '')
        .toLowerCase()
        .replace(/^(г\.|г\s+|город\s+|д\.|д\s+|деревня\s+|аг\.|аг\s+|агрогородок\s+|п\.|п\s+|пос\.|поселок\s+|г\.п\.|к\.п\.|м-н\s+|пгт\s+)\s*/gi, '')
        .replace(/[\(\),]/g, ' ')
        .trim();
    };

    return items.map(item => {
      if (item.coords) return item;

      if (this.localAddressCache) {
        const cached = this.localAddressCache.resolve(item.city, item.street, item.house);
        if (cached) {
          return {
            ...item,
            coords: [cached[0], cached[1]],
            geocoded: true,
            geocodeSource: 'cache'
          };
        }
      }

      if (dbMatches.has(item.id)) {
        const dbm = dbMatches.get(item.id)!;
        return {
          ...item,
          coords: [dbm.coords[0], dbm.coords[1]],
          geocoded: true,
          geocodeSource: 'cache'
        };
      }

      if (placesMap) {
        const rawCity = (item.city || '').toLowerCase().trim();
        const normCity = normalizePlaceFallback(rawCity);

        let foundCoords: [number, number] | undefined = undefined;
        if (rawCity && placesMap.has(rawCity)) {
          foundCoords = placesMap.get(rawCity);
        } else if (normCity && placesMap.has(normCity)) {
          foundCoords = placesMap.get(normCity);
        } else if (!rawCity && item.street) {
          const normStreet = normalizePlaceFallback(item.street);
          if (placesMap.has(normStreet)) {
            foundCoords = placesMap.get(normStreet);
          }
        }

        if (foundCoords) {
          return {
            ...item,
            coords: [foundCoords[0], foundCoords[1]],
            geocoded: true,
            geocodeSource: 'settlement'
          };
        }
      }

      return item;
    });
  }

  clusterAddressesRaySweep(
    startPoint: [number, number],
    validAddresses: DispatchAddress[],
    routeCount: number
  ): DispatchAddress[][] {
    const n = validAddresses.length;
    if (n === 0) return [];
    const k = Math.min(Math.max(1, routeCount), n);

    if (k === 1) {
      return [validAddresses.slice()];
    }

    const startLng = startPoint[0];
    const startLat = startPoint[1];
    const cosLat = Math.cos(startLat * Math.PI / 180);

    const polarPoints = validAddresses.map(addr => {
      const dx = (addr.coords![0] - startLng) * cosLat;
      const dy = addr.coords![1] - startLat;
      let angle = Math.atan2(dy, dx);
      if (angle < 0) angle += 2 * Math.PI;
      const radius = Math.sqrt(dx * dx + dy * dy);
      return { addr, angle, radius };
    });

    polarPoints.sort((a, b) => a.angle - b.angle);

    let maxGap = 0;
    let maxGapIdx = 0;
    for (let i = 0; i < n; i++) {
      const nextIdx = (i + 1) % n;
      let gap = polarPoints[nextIdx].angle - polarPoints[i].angle;
      if (gap < 0) gap += 2 * Math.PI;
      if (gap > maxGap) {
        maxGap = gap;
        maxGapIdx = i;
      }
    }

    const rotatedPoints: typeof polarPoints = [];
    const splitIndex = (maxGapIdx + 1) % n;
    for (let i = 0; i < n; i++) {
      rotatedPoints.push(polarPoints[(splitIndex + i) % n]);
    }

    const clusters: DispatchAddress[][] = [];
    const baseSize = Math.floor(n / k);
    const remainder = n % k;

    let cursor = 0;
    for (let c = 0; c < k; c++) {
      const clusterSize = baseSize + (c < remainder ? 1 : 0);
      const clusterAddrs = rotatedPoints.slice(cursor, cursor + clusterSize).map(p => p.addr);
      clusters.push(clusterAddrs);
      cursor += clusterSize;
    }

    return clusters;
  }

  optimizeTsp2Opt(
    startPoint: [number, number],
    cluster: DispatchAddress[],
    returnToStart: boolean
  ): DispatchAddress[] {
    if (cluster.length <= 1) return cluster;

    const unvisited = [...cluster];
    const ordered: DispatchAddress[] = [];
    let currentPoint = startPoint;

    while (unvisited.length > 0) {
      let nearestIdx = 0;
      let nearestDist = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const d = this.haversineDistanceKm(currentPoint, unvisited[i].coords!);
        if (d < nearestDist) {
          nearestDist = d;
          nearestIdx = i;
        }
      }

      const nextAddr = unvisited.splice(nearestIdx, 1)[0];
      ordered.push(nextAddr);
      currentPoint = nextAddr.coords!;
    }

    let improved = true;
    let iterations = 0;
    const maxIterations = 100;

    const getCoord = (idx: number): [number, number] => {
      if (idx === 0) return startPoint;
      if (idx === ordered.length + 1) return startPoint;
      return ordered[idx - 1].coords!;
    };

    while (improved && iterations < maxIterations) {
      improved = false;
      iterations++;

      const n = ordered.length;
      for (let i = 1; i <= n - 1; i++) {
        for (let k = i + 1; k <= (returnToStart ? n : n); k++) {
          const pA = getCoord(i - 1);
          const pB = getCoord(i);
          const pC = getCoord(k);
          const pD = getCoord(k + 1);

          const currentDist = this.haversineDistanceKm(pA, pB) + this.haversineDistanceKm(pC, pD);
          const newDist = this.haversineDistanceKm(pA, pC) + this.haversineDistanceKm(pB, pD);

          if (newDist + 0.0001 < currentDist) {
            let left = i - 1;
            let right = k - 1;
            while (left < right) {
              const temp = ordered[left];
              ordered[left] = ordered[right];
              ordered[right] = temp;
              left++;
              right--;
            }
            improved = true;
          }
        }
      }
    }

    return ordered;
  }

  cleanConsecutiveDuplicates(coords: [number, number][]): [number, number][] {
    if (coords.length < 2) return coords;
    const res: [number, number][] = [coords[0]];
    for (let i = 1; i < coords.length; i++) {
      const prev = res[res.length - 1];
      const curr = coords[i];
      const d = Math.hypot(curr[0] - prev[0], curr[1] - prev[1]);
      if (d > 0.00001) {
        res.push(curr);
      }
    }
    return res;
  }

  smoothRouteSpikes(coords: [number, number][]): [number, number][] {
    if (coords.length < 3) return coords;
    const res: [number, number][] = [coords[0]];
    let i = 1;
    while (i < coords.length - 1) {
      const prev = res[res.length - 1];
      const curr = coords[i];
      const nxt = coords[i + 1];

      const dPrevNxt = Math.hypot(nxt[0] - prev[0], nxt[1] - prev[1]);
      const dCurrPrev = Math.hypot(curr[0] - prev[0], curr[1] - prev[1]);

      if (dPrevNxt < 0.00035 && dCurrPrev > 0.00003) {
        res.push(curr);
        i += 2;
        continue;
      }

      if (dCurrPrev > 0.00001) {
        res.push(curr);
      }
      i++;
    }

    if (i < coords.length) {
      res.push(coords[coords.length - 1]);
    }
    return this.cleanConsecutiveDuplicates(res);
  }

  async buildDispatchRoutes(
    startPoint: [number, number],
    addresses: DispatchAddress[],
    config: DispatchConfig
  ): Promise<DispatchRoute[]> {
    const valid = addresses.filter(a => a.coords !== null);
    if (valid.length === 0) return [];

    const clusters = this.clusterAddressesRaySweep(startPoint, valid, config.routeCount);
    const routesResult: DispatchRoute[] = [];

    for (let c = 0; c < clusters.length; c++) {
      const clusterAddrs = clusters[c];
      if (clusterAddrs.length === 0) continue;

      const orderedAddrs = this.optimizeTsp2Opt(startPoint, clusterAddrs, config.returnToStart);

      const routePoints: [number, number][] = [startPoint, ...orderedAddrs.map(a => a.coords!)];
      if (config.returnToStart) {
        routePoints.push(startPoint);
      }

      let totalDistKm = 0;
      let totalDurationMin = 0;
      const trunkCoords: [number, number][] = [startPoint];
      const approaches: [number, number][][] = [];

      for (let leg = 0; leg < routePoints.length - 1; leg++) {
        const fromPt = routePoints[leg];
        const toPt = routePoints[leg + 1];

        let legCoords: [number, number][] = [fromPt, toPt];
        let legDistKm = this.haversineDistanceKm(fromPt, toPt);
        let legDurMin = (legDistKm / Math.max(1, config.speedKmH)) * 60;

        try {
          if (this.marchRouteService) {
            const colType = config.transportMode === 'car' ? 'wheel' : 'foot';
            const res = await this.marchRouteService.calculateGraphRoute(fromPt, toPt, [], colType, false);
            if (res && res.coordinates && res.coordinates.length >= 2) {
              legCoords = res.coordinates;
              legDistKm = res.routeStats.totalDistanceKm || legDistKm;
              legDurMin = res.routeStats.totalDurationHrs ? (res.routeStats.totalDurationHrs * 60) : ((legDistKm / Math.max(1, config.speedKmH)) * 60);
            }
          }
        } catch {}

        let roadLeg: [number, number][];
        let roadStopTo: [number, number];

        if (legCoords.length >= 3) {
          roadStopTo = legCoords[legCoords.length - 2];
          roadLeg = legCoords.length >= 4 ? legCoords.slice(1, -1) : [legCoords[1]];
        } else {
          roadStopTo = toPt;
          roadLeg = legCoords;
        }

        if (leg < orderedAddrs.length) {
          const distToHouse = this.haversineDistanceKm(roadStopTo, toPt);
          if (distToHouse > 0.003) {
            approaches.push([roadStopTo, toPt]);
          }
        }

        for (const pt of roadLeg) {
          const last = trunkCoords[trunkCoords.length - 1];
          if (!last || Math.hypot(pt[0] - last[0], pt[1] - last[1]) > 0.00001) {
            trunkCoords.push(pt);
          }
        }

        totalDistKm += legDistKm;
        totalDurationMin += legDurMin;

        if (leg < orderedAddrs.length) {
          orderedAddrs[leg].distanceFromPrevKm = Math.round(legDistKm * 100) / 100;
          orderedAddrs[leg].etaMinutes = Math.round(totalDurationMin);
          totalDurationMin += config.stopDurationMin;
          orderedAddrs[leg].clusterIndex = c;
          orderedAddrs[leg].orderInRoute = leg + 1;
        }
      }

      if (config.returnToStart) {
        const last = trunkCoords[trunkCoords.length - 1];
        if (!last || Math.hypot(startPoint[0] - last[0], startPoint[1] - last[1]) > 0.00001) {
          trunkCoords.push(startPoint);
        }
      }

      let smoothedGeometry = this.smoothRouteSpikes(trunkCoords);
      if (smoothedGeometry.length < 2) {
        smoothedGeometry = [startPoint, routePoints[routePoints.length - 1]];
      }

      const color = ROUTE_PALETTE[c % ROUTE_PALETTE.length];
      const routeName = `Маршрут ${c + 1}`;

      routesResult.push({
        id: `route_${c + 1}_${Date.now()}`,
        routeIndex: c + 1,
        name: routeName,
        color: color,
        addresses: orderedAddrs,
        startCoords: startPoint,
        endCoords: config.returnToStart ? startPoint : routePoints[routePoints.length - 1],
        totalDistanceKm: Math.round(totalDistKm * 10) / 10,
        totalDurationMin: Math.round(totalDurationMin),
        geometry: smoothedGeometry,
        approaches: approaches
      });
    }

    return routesResult;
  }

  async exportRoutesToExcelFile(routes: DispatchRoute[], config: DispatchConfig): Promise<boolean> {
    if (routes.length === 0) return false;

    const wb = XLSX.utils.book_new();

    const summaryHeaders = [
      'Маршрут',
      'Цвет',
      'Количество адресов',
      'Протяженность (км)',
      'Время обхода (мин)',
      'Время обхода (ч:мин)'
    ];

    const summaryRows = routes.map(r => {
      const hrs = Math.floor(r.totalDurationMin / 60);
      const mins = r.totalDurationMin % 60;
      const timeStr = `${hrs} ч ${mins.toString().padStart(2, '0')} мин`;
      return [
        r.name,
        r.color,
        r.addresses.length,
        r.totalDistanceKm,
        r.totalDurationMin,
        timeStr
      ];
    });

    const totalAddresses = routes.reduce((acc, r) => acc + r.addresses.length, 0);
    const totalDist = Math.round(routes.reduce((acc, r) => acc + r.totalDistanceKm, 0) * 10) / 10;
    const totalTime = routes.reduce((acc, r) => acc + r.totalDurationMin, 0);
    const totHrs = Math.floor(totalTime / 60);
    const totMins = totalTime % 60;

    const summaryTotals = [
      'ИТОГО:',
      '',
      totalAddresses,
      totalDist,
      totalTime,
      `${totHrs} ч ${totMins.toString().padStart(2, '0')} мин`
    ];

    const summarySheet = ExcelStylerUtils.buildTableSheet({
      title: 'СВОДНАЯ ВЕДОМОСТЬ МАРШРУТОВ ОПОВЕЩЕНИЯ',
      subtitle: `Стартовая точка: ${config.startPointName} | Возврат: ${config.returnToStart ? 'Да' : 'Нет'} | Скорость: ${config.speedKmH} км/ч`,
      kpiCards: [
        { label: 'Маршрутов', value: routes.length },
        { label: 'Всего адресов', value: totalAddresses },
        { label: 'Дистанция суммарная', value: `${totalDist} км` },
        { label: 'Общее расчетное время', value: `${totHrs} ч ${totMins} мин` }
      ],
      headers: summaryHeaders,
      data: summaryRows,
      totals: summaryTotals,
      customColWidths: { 0: 16, 1: 12, 2: 20, 3: 20, 4: 20, 5: 22 }
    });

    XLSX.utils.book_append_sheet(wb, summarySheet, 'Сводная_ведомость');

    for (const r of routes) {
      const sheetHeaders = [
        'Порядок',
        'ФИО получателя',
        'Населенный пункт',
        'Улица',
        'Дом',
        'Кв.',
        'Дистанция (км)',
        'Время приб. (мин)',
        'Примечание',
        'Отметка о вручении (роспись)'
      ];

      const sheetRows = r.addresses.map(a => [
        a.orderInRoute || '',
        a.recipientName,
        a.city,
        a.street,
        a.house,
        a.apartment || '',
        a.distanceFromPrevKm || 0,
        a.etaMinutes || 0,
        a.note || '',
        ''
      ]);

      const rHrs = Math.floor(r.totalDurationMin / 60);
      const rMins = r.totalDurationMin % 60;

      const routeSheet = ExcelStylerUtils.buildTableSheet({
        title: `МАРШРУТНЫЙ ЛИСТ ОПОВЕЩЕНИЯ: ${r.name.toUpperCase()}`,
        subtitle: `Посыльный / Группа | Дистанция: ${r.totalDistanceKm} км | Расчетное время: ${rHrs} ч ${rMins} мин | Старт: ${config.startPointName}`,
        kpiCards: [
          { label: 'Адресов к обходу', value: r.addresses.length },
          { label: 'Длина маршрута', value: `${r.totalDistanceKm} км` },
          { label: 'Время обхода', value: `${rHrs} ч ${rMins} мин` },
          { label: 'Цвет на карте', value: r.color }
        ],
        headers: sheetHeaders,
        data: sheetRows,
        customColWidths: {
          0: 10,
          1: 28,
          2: 18,
          3: 24,
          4: 10,
          5: 8,
          6: 16,
          7: 18,
          8: 22,
          9: 30
        }
      });

      const safeSheetName = r.name.replace(/[:\\/?*\[\]]/g, '_');
      XLSX.utils.book_append_sheet(wb, routeSheet, safeSheetName);
    }

    return ExcelStylerUtils.saveWorkbookWithDialog(wb, `Маршрутные_листы_оповещения_${Date.now()}`);
  }

  exportRoutesToGeoJson(routes: DispatchRoute[], config: DispatchConfig): any {
    const features: any[] = [];

    if (config.startPoint) {
      features.push({
        type: 'Feature',
        properties: {
          id: 'dispatch-start-base',
          name: config.startPointName || 'Стартовая точка',
          type: 'start_base'
        },
        geometry: {
          type: 'Point',
          coordinates: config.startPoint
        }
      });
    }

    for (const r of routes) {
      features.push({
        type: 'Feature',
        properties: {
          id: r.id,
          name: r.name,
          color: r.color,
          totalDistanceKm: r.totalDistanceKm,
          totalDurationMin: r.totalDurationMin,
          addressCount: r.addresses.length
        },
        geometry: {
          type: 'LineString',
          coordinates: r.geometry
        }
      });

      if (r.approaches) {
        for (let i = 0; i < r.approaches.length; i++) {
          features.push({
            type: 'Feature',
            properties: {
              id: `${r.id}_appr_${i}`,
              type: 'approach',
              color: r.color,
              name: `Подход к адресу (${r.name})`
            },
            geometry: {
              type: 'LineString',
              coordinates: r.approaches[i]
            }
          });
        }
      }

      for (const a of r.addresses) {
        features.push({
          type: 'Feature',
          properties: {
            id: a.id,
            routeName: r.name,
            routeColor: r.color,
            orderInRoute: a.orderInRoute,
            recipientName: a.recipientName,
            city: a.city,
            street: a.street,
            house: a.house,
            apartment: a.apartment || '',
            note: a.note || '',
            distanceFromPrevKm: a.distanceFromPrevKm || 0,
            etaMinutes: a.etaMinutes || 0
          },
          geometry: {
            type: 'Point',
            coordinates: (a.coords ? a.coords : [0, 0]) as [number, number]
          }
        });
      }
    }

    return {
      type: 'FeatureCollection',
      features
    };
  }

  async saveRoutesToGeoJsonFile(routes: DispatchRoute[], config: DispatchConfig): Promise<boolean> {
    const geojson = this.exportRoutesToGeoJson(routes, config);
    const jsonStr = JSON.stringify(geojson, null, 2);
    const defaultFilename = `Маршруты_оповещения_${Date.now()}.geojson`;

    try {
      const { invoke, isTauri } = await import('@tauri-apps/api/core');
      const inTauri = typeof isTauri === 'function' ? isTauri() : (
        typeof window !== 'undefined' && (
          (window as any).__TAURI_INTERNALS__ !== undefined ||
          (window as any).__TAURI__ !== undefined ||
          (window as any).isTauri === true
        )
      );

      if (inTauri) {
        const chosenPath = await invoke<string | null>('choose_save_path', {
          defaultName: defaultFilename,
          default_name: defaultFilename,
          extension: 'geojson',
          title: 'Сохранить маршруты в GeoJSON как...'
        });

        if (!chosenPath) {
          return false;
        }

        const encoder = new TextEncoder();
        const bytes = Array.from(encoder.encode(jsonStr));
        await invoke<string>('save_scenario_to_path', {
          targetPath: chosenPath,
          target_path: chosenPath,
          content: bytes
        });
        return true;
      }
    } catch (e) {
      console.warn(e);
    }

    if (typeof window !== 'undefined' && (window as any).showSaveFilePicker) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: defaultFilename,
          types: [
            {
              description: 'Файл GeoJSON (*.geojson, *.json)',
              accept: {
                'application/geo+json': ['.geojson', '.json']
              }
            }
          ]
        });
        const writable = await handle.createWritable();
        await writable.write(jsonStr);
        await writable.close();
        return true;
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          return false;
        }
      }
    }

    const blob = new Blob([jsonStr], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultFilename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
    return true;
  }

  saveRoutesToTacticalMap(routes: DispatchRoute[], config: DispatchConfig): number {
    if (!this.tacticalMapService) {
      return 0;
    }

    const newFeatures: any[] = [];
    let counter = 0;

    if (config.startPoint) {
      counter++;
      newFeatures.push({
        type: 'Feature',
        properties: {
          id: Date.now() + counter,
          name: `[СТАРТ] ${config.startPointName || 'Стартовая точка'}`,
          color: '#2563eb',
          textColor: '#1e3a8a',
          size: 14,
          textSize: 13,
          fontFamily: 'Calibri',
          symbol: 'text_box',
          isText: true
        },
        geometry: {
          type: 'Point',
          coordinates: config.startPoint
        }
      });
    }

    for (const r of routes) {
      counter++;
      newFeatures.push({
        type: 'Feature',
        properties: {
          id: Date.now() + counter,
          name: `${r.name} (${r.totalDistanceKm} км, ${Math.floor(r.totalDurationMin / 60)}ч ${r.totalDurationMin % 60}мин)`,
          color: r.color,
          width: 3.5,
          symbol: 'simple_line',
          isLinear: true,
          totalDistanceKm: r.totalDistanceKm,
          totalDurationMin: r.totalDurationMin
        },
        geometry: {
          type: 'LineString',
          coordinates: r.geometry
        }
      });

      for (const a of r.addresses) {
        counter++;
        const addrText = `${a.city ? a.city + ', ' : ''}${a.street} ${a.house}${a.apartment ? '-' + a.apartment : ''}`;
        newFeatures.push({
          type: 'Feature',
          properties: {
            id: Date.now() + counter,
            name: `${a.orderInRoute}. ${a.recipientName} (${addrText})`,
            color: r.color,
            textColor: '#0f172a',
            size: 12,
            textSize: 11,
            fontFamily: 'Calibri',
            symbol: 'text_box',
            isText: true
          },
          geometry: {
            type: 'Point',
            coordinates: (a.coords ? a.coords : [0, 0]) as [number, number]
          }
        });
      }
    }

    this.tacticalMapService.placedSymbols.update(prev => [...prev, ...newFeatures]);
    this.tacticalMapService.updateTacticalSymbolsSource();
    return newFeatures.length;
  }

  initLayers(map: maplibregl.Map): void {
    if (!map) return;
    try {
      if (!map.getStyle()) return;

      if (!map.getSource('dispatch-routes-lines-source')) {
        map.addSource('dispatch-routes-lines-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });
      }

      if (!map.getSource('dispatch-routes-approaches-source')) {
        map.addSource('dispatch-routes-approaches-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });
      }

      if (!map.getSource('dispatch-routes-points-source')) {
        map.addSource('dispatch-routes-points-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });
      }

      if (!map.getSource('dispatch-routes-start-source')) {
        map.addSource('dispatch-routes-start-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });
      }

      if (!map.getLayer('dispatch-routes-approaches')) {
        map.addLayer({
          id: 'dispatch-routes-approaches',
          type: 'line',
          source: 'dispatch-routes-approaches-source',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 2.5,
            'line-dasharray': [2, 2],
            'line-opacity': 0.85
          }
        });
      }

      if (!map.getLayer('dispatch-routes-casing')) {
        map.addLayer({
          id: 'dispatch-routes-casing',
          type: 'line',
          source: 'dispatch-routes-lines-source',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#ffffff',
            'line-width': 6.5,
            'line-opacity': 0.85
          }
        });
      }

      if (!map.getLayer('dispatch-routes-lines')) {
        map.addLayer({
          id: 'dispatch-routes-lines',
          type: 'line',
          source: 'dispatch-routes-lines-source',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 4,
            'line-opacity': 0.95
          }
        });
      }

      if (!map.hasImage('dispatch-arrow')) {
        const size = 24;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(5, 5);
          ctx.lineTo(19, 12);
          ctx.lineTo(5, 19);
          ctx.lineTo(9, 12);
          ctx.closePath();
          ctx.fill();
          const imgData = ctx.getImageData(0, 0, size, size);
          map.addImage('dispatch-arrow', imgData, { sdf: true });
        }
      }

      if (!map.getLayer('dispatch-routes-arrows')) {
        map.addLayer({
          id: 'dispatch-routes-arrows',
          type: 'symbol',
          source: 'dispatch-routes-lines-source',
          layout: {
            'symbol-placement': 'line',
            'symbol-spacing': 75,
            'icon-image': 'dispatch-arrow',
            'icon-size': 0.65,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'icon-rotation-alignment': 'map',
            'icon-keep-upright': false
          },
          paint: {
            'icon-color': '#ffffff',
            'icon-halo-color': ['get', 'color'],
            'icon-halo-width': 1.5
          }
        });
      }

      if (!map.getLayer('dispatch-routes-points-halo')) {
        map.addLayer({
          id: 'dispatch-routes-points-halo',
          type: 'circle',
          source: 'dispatch-routes-points-source',
          paint: {
            'circle-radius': 11,
            'circle-color': '#ffffff'
          }
        });
      }

      if (!map.getLayer('dispatch-routes-points')) {
        map.addLayer({
          id: 'dispatch-routes-points',
          type: 'circle',
          source: 'dispatch-routes-points-source',
          paint: {
            'circle-radius': 9,
            'circle-color': ['get', 'color'],
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#ffffff'
          }
        });
      }

      if (!map.getLayer('dispatch-routes-points-labels')) {
        map.addLayer({
          id: 'dispatch-routes-points-labels',
          type: 'symbol',
          source: 'dispatch-routes-points-source',
          layout: {
            'text-field': ['get', 'badgeText'],
            'text-size': 10,
            'text-allow-overlap': true
          },
          paint: {
            'text-color': '#ffffff'
          }
        });
      }

      if (!map.getLayer('dispatch-routes-start-halo')) {
        map.addLayer({
          id: 'dispatch-routes-start-halo',
          type: 'circle',
          source: 'dispatch-routes-start-source',
          paint: {
            'circle-radius': 15,
            'circle-color': '#ffffff',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#0f172a'
          }
        });
      }

      if (!map.getLayer('dispatch-routes-start')) {
        map.addLayer({
          id: 'dispatch-routes-start',
          type: 'circle',
          source: 'dispatch-routes-start-source',
          paint: {
            'circle-radius': 12,
            'circle-color': '#0f172a'
          }
        });
      }

      if (!map.getLayer('dispatch-routes-start-label')) {
        map.addLayer({
          id: 'dispatch-routes-start-label',
          type: 'symbol',
          source: 'dispatch-routes-start-source',
          layout: {
            'text-field': 'Старт',
            'text-size': 9,
            'text-offset': [0, 1.8],
            'text-allow-overlap': true
          },
          paint: {
            'text-color': '#0f172a',
            'text-halo-color': '#ffffff',
            'text-halo-width': 2
          }
        });
      }
    } catch {}
  }

  updateMapLayers(map: maplibregl.Map | null): void {
    if (!map) return;
    this.initLayers(map);

    const routesList = this.routes();
    const addressesList = this.addresses();
    const currentConfig = this.config();
    const hidden = this.hiddenRouteIds();

    const lineFeatures: any[] = [];
    routesList.forEach(r => {
      if (!hidden.has(r.id) && r.geometry && r.geometry.length >= 2) {
        lineFeatures.push({
          type: 'Feature',
          properties: {
            id: r.id,
            color: r.color,
            name: r.name,
            routeIndex: r.routeIndex
          },
          geometry: {
            type: 'LineString',
            coordinates: r.geometry
          }
        });
      }
    });

    const pointFeatures: any[] = [];
    if (routesList.length > 0) {
      routesList.forEach(r => {
        if (!hidden.has(r.id)) {
          r.addresses.forEach(a => {
            if (a.coords) {
              pointFeatures.push({
                type: 'Feature',
                properties: {
                  id: a.id,
                  color: r.color,
                  badgeText: String(a.orderInRoute || a.index),
                  recipientName: a.recipientName,
                  addressText: `${a.city ? a.city + ', ' : ''}${a.street} ${a.house}`
                },
                geometry: {
                  type: 'Point',
                  coordinates: a.coords
                }
              });
            }
          });
        }
      });
    } else {
      addressesList.forEach(a => {
        if (a.coords) {
          pointFeatures.push({
            type: 'Feature',
            properties: {
              id: a.id,
              color: '#3b82f6',
              badgeText: String(a.index),
              recipientName: a.recipientName,
              addressText: `${a.city ? a.city + ', ' : ''}${a.street} ${a.house}`
            },
            geometry: {
              type: 'Point',
              coordinates: a.coords
            }
          });
        }
      });
    }

    const startFeatures: any[] = [];
    if (currentConfig.startPoint) {
      startFeatures.push({
        type: 'Feature',
        properties: {
          name: currentConfig.startPointName
        },
        geometry: {
          type: 'Point',
          coordinates: currentConfig.startPoint
        }
      });
    }

    const approachFeatures: any[] = [];
    routesList.forEach(r => {
      if (!hidden.has(r.id) && r.approaches && r.approaches.length > 0) {
        r.approaches.forEach((appr, idx) => {
          approachFeatures.push({
            type: 'Feature',
            properties: {
              id: `${r.id}_appr_${idx}`,
              color: r.color
            },
            geometry: {
              type: 'LineString',
              coordinates: appr
            }
          });
        });
      }
    });

    try {
      const lineSrc = map.getSource('dispatch-routes-lines-source') as maplibregl.GeoJSONSource;
      if (lineSrc) {
        lineSrc.setData({ type: 'FeatureCollection', features: lineFeatures });
      }

      const apprSrc = map.getSource('dispatch-routes-approaches-source') as maplibregl.GeoJSONSource;
      if (apprSrc) {
        apprSrc.setData({ type: 'FeatureCollection', features: approachFeatures });
      }

      const ptSrc = map.getSource('dispatch-routes-points-source') as maplibregl.GeoJSONSource;
      if (ptSrc) {
        ptSrc.setData({ type: 'FeatureCollection', features: pointFeatures });
      }

      const startSrc = map.getSource('dispatch-routes-start-source') as maplibregl.GeoJSONSource;
      if (startSrc) {
        startSrc.setData({ type: 'FeatureCollection', features: startFeatures });
      }
    } catch {}
  }

  clearMapLayers(map: maplibregl.Map | null): void {
    if (!map) return;
    try {
      const lineSrc = map.getSource('dispatch-routes-lines-source') as maplibregl.GeoJSONSource;
      if (lineSrc) {
        lineSrc.setData({ type: 'FeatureCollection', features: [] });
      }

      const apprSrc = map.getSource('dispatch-routes-approaches-source') as maplibregl.GeoJSONSource;
      if (apprSrc) {
        apprSrc.setData({ type: 'FeatureCollection', features: [] });
      }

      const ptSrc = map.getSource('dispatch-routes-points-source') as maplibregl.GeoJSONSource;
      if (ptSrc) {
        ptSrc.setData({ type: 'FeatureCollection', features: [] });
      }

      const startSrc = map.getSource('dispatch-routes-start-source') as maplibregl.GeoJSONSource;
      if (startSrc) {
        startSrc.setData({ type: 'FeatureCollection', features: [] });
      }
    } catch {}
  }
}

