import { Injectable, inject } from '@angular/core';
import { TacticalMapService } from './tactical-map.service';

export interface FortificationNorms {
  id: string;
  name: string;
  earthVolume: number;      // м³
  laborHrs: number;         // чел.-ч
  machHrs?: number;         // маш.-ч
  machType?: string;        // тип техники
  woodVol?: number;         // м³
  wireKg?: number;          // кг
  metalKg?: number;         // кг
  polesCount?: number;      // шт.
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

      if (lineType === 'trench' || lineType === 'comm_open') {
        const profile = props.fortProfile || 'main'; // 'main' | 'full'
        const revetment = props.fortRevetment || 'none'; // 'none' | 'wood' | 'board' | 'wattle'

        const profileName = profile === 'full' ? 'полного профиля (150 см)' : 'основного профиля (110 см)';
        let revetmentName = 'без одежды крутостей';

        if (profile === 'full') {
          earthVolumePerMeter = 1.2;
          laborHrsPerMeter = 1.6;
        } else {
          earthVolumePerMeter = 0.8;
          laborHrsPerMeter = 0.8;
        }

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
        }

        const typeName = lineType === 'trench' ? 'Траншея' : 'Открытый ход сообщения';
        noteDetails = `${typeName} ${profileName}, ${revetmentName}.`;
      }

      return {
        id: props.id.toString(),
        name: props.name || this.getLinearDisplayName(lineType),
        earthVolume: parseFloat((earthVolumePerMeter * length).toFixed(1)),
        laborHrs: parseFloat((laborHrsPerMeter * length).toFixed(1)),
        woodVol: woodVolPerMeter > 0 ? parseFloat((woodVolPerMeter * length).toFixed(2)) : undefined,
        wireKg: wireKgPerMeter > 0 ? parseFloat((wireKgPerMeter * length).toFixed(1)) : undefined,
        polesCount: polesCountPerMeter > 0 ? Math.ceil(polesCountPerMeter * length) : undefined,
        notes: `${noteDetails} (Длина: ${Math.round(length)} м)`
      };
    } else {
      const symbol = props.symbol;
      const norm = this.pointNorms[symbol];
      if (!norm) return null;

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
    totalLaborHrs: number;
    totalWoodVol: number;
    totalWireKg: number;
    totalMetalKg: number;
    totalPolesCount: number;
    machinerySummary: { type: string; hours: number }[];
    elementsCount: Record<string, number>;
    elementsList: { name: string; count: number }[];
    totalLengths: {
      trench: number;
      comm_open: number;
      comm_covered: number;
      wire: number;
    };
    items: { name: string; type: string; earth: number; labor: number; notes?: string }[];
  } {
    let totalEarthVolume = 0;
    let totalLaborHrs = 0;
    let totalWoodVol = 0;
    let totalWireKg = 0;
    let totalMetalKg = 0;
    let totalPolesCount = 0;

    let totalTrenchLength = 0;
    let totalCommOpenLength = 0;
    let totalCommCoveredLength = 0;
    let totalWireLength = 0;

    const machinery: Record<string, number> = {};
    const elementsCount: Record<string, number> = {};
    const items: { name: string; type: string; earth: number; labor: number; notes?: string }[] = [];

    features.forEach(f => {
      const norm = this.calculateFeatureNorms(f);
      if (!norm) return;

      const typeName = f.properties.isLinear ? this.getLinearDisplayName(f.properties.lineType) : this.getPointDisplayName(f.properties.symbol);
      elementsCount[typeName] = (elementsCount[typeName] || 0) + 1;

      totalEarthVolume += norm.earthVolume;
      totalLaborHrs += norm.laborHrs;
      if (norm.woodVol) totalWoodVol += norm.woodVol;
      if (norm.wireKg) totalWireKg += norm.wireKg;
      if (norm.metalKg) totalMetalKg += norm.metalKg;
      if (norm.polesCount) totalPolesCount += norm.polesCount;

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
        name: norm.name,
        type: typeName,
        earth: norm.earthVolume,
        labor: norm.laborHrs,
        notes: norm.notes
      });
    });

    const machinerySummary = Object.keys(machinery).map(key => ({
      type: key,
      hours: parseFloat(machinery[key].toFixed(1))
    }));

    const elementsList = Object.keys(elementsCount).map(key => ({
      name: key,
      count: elementsCount[key]
    }));

    return {
      totalEarthVolume: parseFloat(totalEarthVolume.toFixed(1)),
      totalLaborHrs: parseFloat(totalLaborHrs.toFixed(1)),
      totalWoodVol: parseFloat(totalWoodVol.toFixed(2)),
      totalWireKg: parseFloat(totalWireKg.toFixed(1)),
      totalMetalKg: parseFloat(totalMetalKg.toFixed(1)),
      totalPolesCount,
      machinerySummary,
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
