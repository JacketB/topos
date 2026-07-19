import { Injectable, inject } from '@angular/core';
import { TacticalMapService } from './tactical-map.service';

export interface FortificationNorms {
  id: string;
  name: string;
  earthVolume: number;      // м³ (общий объем выемки)
  cleanVolume?: number;     // м³ (объем ручной зачистки недобора)
  laborHrs: number;         // чел.-ч
  machHrs?: number;         // маш.-ч
  machType?: string;        // тип техники
  woodVol?: number;         // м³ (общий круглый лес)
  boardsVol?: number;       // м³ (доски обшивки)
  postsCount?: number;      // шт (вертикальные стойки обшивки)
  wireKg?: number;          // кг (колючая проволока)
  wireViazKg?: number;      // кг (проволока вязальная отожженная)
  metalKg?: number;         // кг
  polesCount?: number;      // шт. (колья для МЗП)
  masNetSq?: number;        // м² (маскировочные сети МКТ)
  antiDronNetSq?: number;   // м² (антидронная стальная сетка)
  trapsM?: number;          // п.м. (водоотводные деревянные трапы)
  doorsCount?: number;      // шт (защитно-герметические дверные блоки БД-50)
  stovesCount?: number;     // шт (полевые отопительные печи)
  notes?: string;
}

@Injectable({
  providedIn: 'root'
})
export class FortificationCalculationService {
  private readonly tacticalMapService = inject(TacticalMapService);

  // Справочник нормативов по типам линейных объектов (на 1 погонный метр)
  readonly linearNorms: Record<string, Omit<FortificationNorms, 'id' | 'name'>> = {
    trench: {
      earthVolume: 0.8, // м³ на метр
      laborHrs: 0.8,    // чел.-ч на метр
      notes: 'Траншея основного профиля глубиной 110 см. Огонь из стрелкового оружия стоя на дне рва.'
    },
    comm_open: {
      earthVolume: 0.8,
      laborHrs: 0.8,
      notes: 'Открытый ход сообщения глубиной 110 см с двухсторонним бруствером.'
    },
    comm_covered: {
      earthVolume: 1.1,
      laborHrs: 1.2,
      woodVol: 0.23,  // м³ круглого леса на метр
      wireKg: 0.15,   // кг проволоки на метр
      notes: 'Крытый ход сообщения (перекрытая щель) глубиной 150 см с одеждой крутостей.'
    },
    wire: {
      earthVolume: 0,
      laborHrs: 0.4,
      wireKg: 1.5,
      polesCount: 0.1, // 1 кол на 10 метров
      notes: 'Проволочное заграждение (малозаметное препятствие - МЗП).'
    }
  };

  // Справочник нормативов по точечным символам (на 1 штуку)
  readonly pointNorms: Record<string, Omit<FortificationNorms, 'id' | 'name'>> = {
    fort_trench_shelter: {
      earthVolume: 1.4,
      laborHrs: 2.5,
      notes: 'Стрелковая ячейка (окоп для автомата стоя).'
    },
    fort_tank_trench: {
      earthVolume: 28,
      laborHrs: 5.0,
      machHrs: 0.6,
      machType: 'Танковый бульдозер',
      notes: 'Окоп для танка с круговым обстрелом. Котлован глубиной 100 см.'
    },
    fort_bmp_trench: {
      earthVolume: 35,
      laborHrs: 8.0,
      machHrs: 0.3,
      machType: 'ПЗМ-2',
      notes: 'Окоп для БМП/БТР с круговым обстрелом.'
    },
    fort_art_trench: {
      earthVolume: 12,
      laborHrs: 36.0,
      machHrs: 1.2,
      machType: 'Автокран',
      woodVol: 0.5,
      notes: 'Окоп для артиллерийского орудия.'
    },
    fort_dzot: {
      earthVolume: 14,
      laborHrs: 81.0,
      woodVol: 6.3,
      notes: 'Деревоземляная огневая точка (ДЗОТ).'
    },
    fort_dot: {
      earthVolume: 20,
      laborHrs: 95.0,
      woodVol: 8.5,
      notes: 'Долговременная огневая точка (ДОТ).'
    },
    dot_tipovoy1: {
      earthVolume: 14,
      laborHrs: 81.0,
      woodVol: 6.3,
      notes: 'Типовой ДОТ.'
    },
    fort_knp: {
      earthVolume: 17,
      laborHrs: 93.0,
      machHrs: 0.2,
      machType: 'ЭОВ-4421',
      woodVol: 4.5,
      notes: 'Командно-наблюдательный пункт в укрытии.'
    },
    fort_blindage: {
      earthVolume: 12,
      laborHrs: 48.0,
      woodVol: 2.1,
      notes: 'Блиндаж из лесоматериалов на отделение.'
    },
    blindazh: {
      earthVolume: 12,
      laborHrs: 48.0,
      woodVol: 2.1,
      notes: 'Типовой блиндаж.'
    },
    blindazh_zhb: {
      earthVolume: 15,
      laborHrs: 36.0,
      machHrs: 1.2,
      machType: 'Автокран',
      notes: 'Блиндаж из сборного железобетона.'
    },
    schel1: {
      earthVolume: 7,
      laborHrs: 20.0,
      notes: 'Открытая щель на отделение.'
    },
    schel_per1: {
      earthVolume: 9,
      laborHrs: 35.0,
      woodVol: 1.2,
      notes: 'Перекрытая щель на отделение.'
    },
    ukrytie: {
      earthVolume: 32,
      laborHrs: 60.0,
      woodVol: 1.0,
      notes: 'Укрытие для автомобильной техники.'
    },
    ukrytie_zhb: {
      earthVolume: 36,
      laborHrs: 40.0,
      machHrs: 1.4,
      machType: 'Автокран',
      notes: 'Укрытие для техники из сборного железобетона.'
    },
    sps1: {
      earthVolume: 7,
      laborHrs: 35.0,
      metalKg: 306,
      notes: 'Сборное пулеметное сооружение (СПС).'
    }
  };

  // Справочник геометрических размеров точечных сооружений для детальных расчетов
  readonly pointDimensions: Record<string, { L: number; B: number; H: number; L_app?: number; m: number; type: 'blindage' | 'shelter' }> = {
    fort_blindage: { L: 3.6, B: 1.35, H: 2.5, m: 0.5, type: 'blindage' },
    blindazh: { L: 3.6, B: 1.35, H: 2.5, m: 0.5, type: 'blindage' },
    fort_knp: { L: 5.0, B: 2.0, H: 2.5, m: 0.5, type: 'blindage' },
    fort_bmp_trench: { L: 8.0, B: 3.5, H: 1.5, L_app: 6.0, m: 0.5, type: 'shelter' },
    fort_tank_trench: { L: 9.5, B: 4.2, H: 1.8, L_app: 7.2, m: 0.5, type: 'shelter' },
    fort_art_trench: { L: 10.0, B: 5.0, H: 1.5, L_app: 6.0, m: 0.5, type: 'shelter' }
  };

  /**
   * Вычисляет расстояние между двумя гео-точками в метрах
   */
  getDistance(coord1: [number, number], coord2: [number, number]): number {
    const R = 6371000; // Радиус Земли в метрах
    const lat1 = coord1[1] * Math.PI / 180;
    const lat2 = coord2[1] * Math.PI / 180;
    const dLat = (coord2[1] - coord1[1]) * Math.PI / 180;
    const dLon = (coord2[0] - coord1[0]) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1) * Math.cos(lat2) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Вычисляет длину ломаной линии в метрах по координатам
   */
  calculateLineLength(coords: [number, number][]): number {
    if (!coords || coords.length < 2) return 0;
    let total = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      total += this.getDistance(coords[i], coords[i + 1]);
    }
    return total;
  }

  /**
   * Вычисляет нормативы для одной конкретной фичи (линейной или точечной)
   */
  calculateFeatureNorms(feature: any): FortificationNorms | null {
    if (!feature || !feature.properties) return null;

    const props = feature.properties;
    const isLinear = props.isLinear;

    if (isLinear) {
      const lineType = props.lineType;
      const norm = this.linearNorms[lineType];
      if (!norm) return null;

      const origCoords = props.origCoords || [];
      const length = this.calculateLineLength(origCoords);

      let earthVolumePerMeter = norm.earthVolume;
      let laborHrsPerMeter = norm.laborHrs;
      let woodVolPerMeter = norm.woodVol || 0;
      let wireKgPerMeter = norm.wireKg || 0;
      let polesCountPerMeter = norm.polesCount || 0;
      let noteDetails = norm.notes || '';

      let depthM = 1.1;
      let bottomWidthM = 0.9;

      if (lineType === 'trench' || lineType === 'comm_open' || lineType === 'comm_covered') {
        const profile = props.fortProfile || 'main'; // 'main' | 'full'
        const revetment = props.fortRevetment || 'none'; // 'none' | 'wood' | 'board' | 'wattle'

        // Если пользователь ввел индивидуальные размеры
        const customDepth = props.fortDepth;
        const customWidth = props.fortWidth;

        let profileName = '';
        if (customDepth !== undefined && customWidth !== undefined) {
          depthM = customDepth / 100;
          bottomWidthM = Math.max(0.5, customWidth / 100);
          
          // Вычисляем коэффициент заложения откоса m.
          const m = (revetment === 'none' || revetment === 'board_incline') ? 0.25 : 0;
          
          // Вычисляем ширину по верху: W_top = W_bottom + 2 * m * D
          const topWidthM = bottomWidthM + 2 * m * depthM;
          
          // Трапецеидальное сечение рва
          earthVolumePerMeter = (topWidthM + bottomWidthM) / 2 * depthM;
          
          // Трудозатраты масштабируются по объему
          laborHrsPerMeter = earthVolumePerMeter * (1 + (depthM - 1.1) * 0.8);
          profileName = `произвольного профиля (гл. ${customDepth} см, шир. ${customWidth} см)`;
        } else {
          // По умолчанию
          const isFullByDefault = (lineType === 'comm_covered' || profile === 'full');
          depthM = isFullByDefault ? 1.5 : 1.1;
          bottomWidthM = isFullByDefault ? 1.1 : 0.9;
          profileName = isFullByDefault ? 'полного профиля (150 см)' : 'основного профиля (110 см)';
          if (isFullByDefault) {
            earthVolumePerMeter = 1.2;
            laborHrsPerMeter = 1.6;
          } else {
            earthVolumePerMeter = 0.8;
            laborHrsPerMeter = 0.8;
          }
        }

        let revetmentName = '';

        if (lineType === 'comm_covered') {
          woodVolPerMeter = 0.23;
          wireKgPerMeter = 0.15;
          laborHrsPerMeter += 1.2;
          revetmentName = 'с перекрытием и одеждой крутостей';
        } else {
          revetmentName = 'без одежды крутостей';
          if (revetment === 'wood') {
            woodVolPerMeter += 0.06;
            laborHrsPerMeter += 1.5;
            revetmentName = 'с жердевой одеждой крутостей';
          } else if (revetment === 'board') {
            woodVolPerMeter += 0.04;
            laborHrsPerMeter += 1.2;
            revetmentName = 'с одеждой крутостей из досок/горбылей';
          } else if (revetment === 'wattle') {
            laborHrsPerMeter += 0.6;
            revetmentName = 'с одеждой крутостей из плетня';
          } else if (revetment === 'board_incline') {
            woodVolPerMeter += 0.08;
            laborHrsPerMeter += 1.5;
            revetmentName = 'с укреплением шпалами на откосах';
          }
        }

        let typeName = '';
        if (lineType === 'trench') typeName = 'Траншея';
        else if (lineType === 'comm_open') typeName = 'Открытый ход сообщения';
        else if (lineType === 'comm_covered') typeName = 'Крытый ход сообщения';

        noteDetails = `${typeName} ${profileName}, ${revetmentName}.`;
      }

      let cleanVolume = 0;
      let boardsVol = 0;
      let postsCount = 0;
      let postsWoodVol = 0;
      let trapsM = 0;
      let trapsWoodVol = 0;
      let wireViazKg = 0;
      let masNetSq = 0;
      let machHrs = 0;
      let machType = '';

      if (lineType === 'trench' || lineType === 'comm_open' || lineType === 'comm_covered') {
        const revetment = props.fortRevetment || 'none';
        cleanVolume = (length * bottomWidthM * 0.05) + (length * depthM * 2 * 0.05);
        
        if (revetment !== 'none') {
          postsCount = Math.ceil(length) * 2;
          postsWoodVol = postsCount * Math.PI * (0.06 ** 2) * (depthM + 0.5);
          wireViazKg = length * 3.0; // по Excel кг на метр
          
          if (revetment === 'board' || revetment === 'board_incline') {
            const wallArea = length * depthM * 2;
            boardsVol = wallArea * 0.04;
          }
        }
        
        trapsM = length;
        trapsWoodVol = length * 0.02;
        
        // Маскировочные сети
        masNetSq = length * 1.5;
        
        // Машино-часы
        machHrs = (earthVolumePerMeter * length) / 140.0; // ПЗМ-2 с производительностью 140 м3/ч
        machType = 'ПЗМ-2';
        
        // Складываем круглый лес: стойки + трапы + базовый крепёжный
        woodVolPerMeter = woodVolPerMeter + (postsWoodVol / length) + (trapsWoodVol / length);
      }

      return {
        id: props.id.toString(),
        name: props.name || this.getLinearDisplayName(lineType),
        earthVolume: parseFloat((earthVolumePerMeter * length).toFixed(1)),
        cleanVolume: cleanVolume > 0 ? parseFloat(cleanVolume.toFixed(1)) : undefined,
        laborHrs: parseFloat((laborHrsPerMeter * length).toFixed(1)),
        machHrs: machHrs > 0 ? parseFloat(machHrs.toFixed(1)) : undefined,
        machType: machType || undefined,
        woodVol: woodVolPerMeter > 0 ? parseFloat((woodVolPerMeter * length).toFixed(2)) : undefined,
        boardsVol: boardsVol > 0 ? parseFloat(boardsVol.toFixed(2)) : undefined,
        postsCount: postsCount > 0 ? postsCount : undefined,
        wireKg: wireKgPerMeter > 0 ? parseFloat((wireKgPerMeter * length).toFixed(1)) : undefined,
        wireViazKg: wireViazKg > 0 ? parseFloat(wireViazKg.toFixed(1)) : undefined,
        polesCount: polesCountPerMeter > 0 ? Math.ceil(polesCountPerMeter * length) : undefined,
        masNetSq: masNetSq > 0 ? Math.round(masNetSq) : undefined,
        trapsM: trapsM > 0 ? Math.round(trapsM) : undefined,
        notes: `${noteDetails} (Длина: ${Math.round(length)} м)`
      };
    } else {
      const symbol = props.symbol;
      const norm = this.pointNorms[symbol];
      if (!norm) return null;

      const dim = this.pointDimensions[symbol];
      if (dim) {
        // Считываем пользовательские параметры, если заданы (в сантиметрах -> переводим в метры)
        const customL = props.fortLength !== undefined ? props.fortLength / 100 : dim.L;
        const customB = props.fortWidth !== undefined ? props.fortWidth / 100 : dim.B;
        const customH = props.fortDepth !== undefined ? props.fortDepth / 100 : dim.H;
        const m = dim.m;
        
        let earthVolume = 0;
        let laborHrs = 0;
        let woodVol = 0;
        let machHrs = 0;
        let machType = '';
        let notes = '';

        let cleanVolume = 0;
        let boardsVol = 0;
        let postsCount = 0;
        let wireViazKg = 0;
        let masNetSq = 0;
        let doorsCount = 0;
        let stovesCount = 0;

        if (dim.type === 'blindage') {
          // Блиндаж
          const botL = customL + 0.9;
          const botB = customB + 0.9;
          const topL = botL + 2 * m * customH;
          const topB = botB + 2 * m * customH;
          
          const vKotl = customH / 6 * (botL * botB + topL * topB + (botL + topL) * (botB + topB));
          const vTamb = (symbol === 'fort_knp') ? 15.0 : 8.0;
          
          earthVolume = vKotl + vTamb;
          cleanVolume = vKotl * 0.08;
          
          const baseLabor = (symbol === 'fort_knp') ? 70.0 : 45.0;
          laborHrs = baseLabor + Math.round(cleanVolume * 2);
          woodVol = 5.0; // Базовый объем по Excel
          machHrs = earthVolume / 40.0; // Производительность ЭОВ-4421 = 40 м3/ч
          machType = 'ЭОВ-4421';
          
          masNetSq = Math.round(topL * topB * 1.3);
          doorsCount = (symbol === 'fort_knp') ? 4 : 1;
          stovesCount = 1;

          notes = `${this.getPointDisplayName(symbol)}. Котлован блиндажного типа (гл. ${Math.round(customH*100)} см, шир. ${Math.round(customB*100)} см, дл. ${Math.round(customL*100)} см) с откосами m=${m}.`;
        } else if (dim.type === 'shelter') {
          // Укрытие техники
          const topL = customL + 2 * m * customH;
          const topB = customB + 2 * m * customH;
          
          const vKotl = customH / 6 * (customL * customB + topL * topB + (customL + topL) * (customB + topB));
          const L_app = dim.L_app || (customH * 4); // Если длина аппарели не задана
          
          const hasTwoApparels = false; // В Excel у БМП, танков и пушек 1 аппарель
          const appFactor = hasTwoApparels ? 2.0 : 1.0;
          const vApp = appFactor * (0.5 * L_app * customB * customH + (m * (customH ** 2) * L_app) / 3);
          
          earthVolume = vKotl + vApp;
          cleanVolume = (customL * customB + 0.5 * L_app * customB) * 0.1 + (customL + L_app) * 2 * customH * 0.05;
          
          laborHrs = Math.round(cleanVolume * 2); // Только ручная зачистка недобора
          woodVol = (symbol === 'fort_art_trench') ? (customL + customB) * 2 * customH * 0.04 * 2 : (customL + customB) * 2 * customH * 0.04;
          machHrs = earthVolume / 140.0; // Производительность ПЗМ-2 = 140 м3/ч
          machType = 'ПЗМ-2';
          
          masNetSq = Math.round((customL + L_app) * customB * 1.8);

          notes = `${this.getPointDisplayName(symbol)}. Котлован под технику (гл. ${Math.round(customH*100)} см, шир. ${Math.round(customB*100)} см, дл. ${Math.round(customL*100)} см) с аппарелью ${L_app} м и откосами m=${m}.`;
        }

        return {
          id: props.id.toString(),
          name: props.name || this.getPointDisplayName(symbol),
          earthVolume: parseFloat(earthVolume.toFixed(1)),
          cleanVolume: cleanVolume > 0 ? parseFloat(cleanVolume.toFixed(1)) : undefined,
          laborHrs: parseFloat(laborHrs.toFixed(1)),
          machHrs: parseFloat(machHrs.toFixed(1)),
          machType: machType,
          woodVol: woodVol > 0 ? parseFloat(woodVol.toFixed(2)) : undefined,
          boardsVol: boardsVol > 0 ? parseFloat(boardsVol.toFixed(2)) : undefined,
          postsCount: postsCount > 0 ? postsCount : undefined,
          wireKg: norm.wireKg,
          wireViazKg: wireViazKg > 0 ? parseFloat(wireViazKg.toFixed(1)) : undefined,
          metalKg: norm.metalKg,
          masNetSq: masNetSq > 0 ? Math.round(masNetSq) : undefined,
          doorsCount: doorsCount > 0 ? doorsCount : undefined,
          stovesCount: stovesCount > 0 ? stovesCount : undefined,
          notes: notes
        };
      }

      return {
        id: props.id.toString(),
        name: props.name || this.getPointDisplayName(symbol),
        earthVolume: norm.earthVolume,
        laborHrs: norm.laborHrs,
        machHrs: norm.machHrs,
        machType: norm.machType,
        woodVol: norm.woodVol,
        wireKg: norm.wireKg,
        metalKg: norm.metalKg,
        notes: norm.notes
      };
    }
  }

  /**
   * Вычисляет агрегированные нормативы по списку фич
   */
  calculateTotalNorms(features: any[]): {
    totalEarthVolume: number;
    totalCleanVolume: number;
    totalLaborHrs: number;
    totalWoodVol: number;
    totalBoardsVol: number;
    totalPostsCount: number;
    totalWireKg: number;
    totalWireViazKg: number;
    totalMetalKg: number;
    totalPolesCount: number;
    totalMasNetSq: number;
    totalAntiDronNetSq: number;
    totalTrapsM: number;
    totalDoorsCount: number;
    totalStovesCount: number;
    machinerySummary: { type: string; hours: number }[];
    totalMachHrs: number;
    elementsCount: Record<string, number>;
    elementsList: { name: string; count: number }[];
    totalLengths: {
      trench: number;
      comm_open: number;
      comm_covered: number;
      wire: number;
    };
    items: (FortificationNorms & { type: string })[];
  } {
    let totalEarthVolume = 0;
    let totalCleanVolume = 0;
    let totalLaborHrs = 0;
    let totalWoodVol = 0;
    let totalBoardsVol = 0;
    let totalPostsCount = 0;
    let totalWireKg = 0;
    let totalWireViazKg = 0;
    let totalMetalKg = 0;
    let totalPolesCount = 0;
    let totalMasNetSq = 0;
    let totalAntiDronNetSq = 0;
    let totalTrapsM = 0;
    let totalDoorsCount = 0;
    let totalStovesCount = 0;

    let totalTrenchLength = 0;
    let totalCommOpenLength = 0;
    let totalCommCoveredLength = 0;
    let totalWireLength = 0;

    const machinery: Record<string, number> = {};
    const elementsCount: Record<string, number> = {};
    const items: (FortificationNorms & { type: string })[] = [];

    features.forEach(f => {
      const norm = this.calculateFeatureNorms(f);
      if (!norm) return;

      const typeName = f.properties.isLinear ? this.getLinearDisplayName(f.properties.lineType) : this.getPointDisplayName(f.properties.symbol);
      elementsCount[typeName] = (elementsCount[typeName] || 0) + 1;

      totalEarthVolume += norm.earthVolume;
      if (norm.cleanVolume) totalCleanVolume += norm.cleanVolume;
      totalLaborHrs += norm.laborHrs;
      if (norm.woodVol) totalWoodVol += norm.woodVol;
      if (norm.boardsVol) totalBoardsVol += norm.boardsVol;
      if (norm.postsCount) totalPostsCount += norm.postsCount;
      if (norm.wireKg) totalWireKg += norm.wireKg;
      if (norm.wireViazKg) totalWireViazKg += norm.wireViazKg;
      if (norm.metalKg) totalMetalKg += norm.metalKg;
      if (norm.polesCount) totalPolesCount += norm.polesCount;
      if (norm.masNetSq) totalMasNetSq += norm.masNetSq;
      if (norm.antiDronNetSq) totalAntiDronNetSq += norm.antiDronNetSq;
      if (norm.trapsM) totalTrapsM += norm.trapsM;
      if (norm.doorsCount) totalDoorsCount += norm.doorsCount;
      if (norm.stovesCount) totalStovesCount += norm.stovesCount;

      if (f.properties.isLinear) {
        const lineType = f.properties.lineType;
        const length = this.calculateLineLength(f.properties.origCoords || []);
        if (lineType === 'trench') totalTrenchLength += length;
        else if (lineType === 'comm_open') totalCommOpenLength += length;
        else if (lineType === 'comm_covered') totalCommCoveredLength += length;
        else if (lineType === 'wire') totalWireLength += length;
      }

      if (norm.machHrs && norm.machType) {
        machinery[norm.machType] = (machinery[norm.machType] || 0) + norm.machHrs;
      }

      items.push({
        ...norm,
        type: typeName
      });
    });

    const machinerySummary = Object.keys(machinery).map(key => ({
      type: key,
      hours: parseFloat(machinery[key].toFixed(1))
    }));

    const totalMachHrs = parseFloat(machinerySummary.reduce((acc, m) => acc + m.hours, 0).toFixed(1));

    const elementsList = Object.keys(elementsCount).map(key => ({
      name: key,
      count: elementsCount[key]
    }));

    return {
      totalEarthVolume: parseFloat(totalEarthVolume.toFixed(1)),
      totalCleanVolume: parseFloat(totalCleanVolume.toFixed(1)),
      totalLaborHrs: parseFloat(totalLaborHrs.toFixed(1)),
      totalWoodVol: parseFloat(totalWoodVol.toFixed(2)),
      totalBoardsVol: parseFloat(totalBoardsVol.toFixed(2)),
      totalPostsCount,
      totalWireKg: parseFloat(totalWireKg.toFixed(1)),
      totalWireViazKg: parseFloat(totalWireViazKg.toFixed(1)),
      totalMetalKg: parseFloat(totalMetalKg.toFixed(1)),
      totalPolesCount,
      totalMasNetSq,
      totalAntiDronNetSq,
      totalTrapsM,
      totalDoorsCount,
      totalStovesCount,
      machinerySummary,
      totalMachHrs,
      elementsCount,
      elementsList,
      totalLengths: {
        trench: Math.round(totalTrenchLength),
        comm_open: Math.round(totalCommOpenLength),
        comm_covered: Math.round(totalCommCoveredLength),
        wire: Math.round(totalWireLength)
      },
      items
    };
  }

  private getLinearDisplayName(lineType: string): string {
    switch (lineType) {
      case 'trench': return 'Траншея';
      case 'comm_open': return 'Ход сообщения (открытый)';
      case 'comm_covered': return 'Ход сообщения (крытый)';
      case 'wire': return 'Проволочное заграждение';
      default: return 'Линейный объект';
    }
  }

  private getPointDisplayName(symbol: string): string {
    switch (symbol) {
      case 'fort_trench_shelter': return 'Стрелковая ячейка';
      case 'fort_tank_trench': return 'Окоп для танка';
      case 'fort_bmp_trench': return 'Окоп для БМП/БТР';
      case 'fort_art_trench': return 'Окоп для орудия';
      case 'fort_dzot': return 'ДЗОТ';
      case 'fort_dot': return 'ДОТ (усиленный)';
      case 'dot_tipovoy1': return 'ДОТ (типовой)';
      case 'fort_knp': return 'КНП в укрытии';
      case 'fort_blindage': return 'Блиндаж';
      case 'blindazh': return 'Блиндаж (общ.)';
      case 'blindazh_zhb': return 'Блиндаж ЖБ';
      case 'schel1': return 'Открытая щель';
      case 'schel_per1': return 'Перекрытая щель';
      case 'ukrytie': return 'Укрытие для техники';
      case 'ukrytie_zhb': return 'Укрытие ЖБ';
      case 'sps1': return 'СПС';
      default: return 'Точечный элемент';
    }
  }
}
