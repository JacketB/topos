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

export const TACTICAL_SYMBOLS: SymbolCategory[] = [
  {
    id: 'armor',
    name: 'Бронетехника',
    symbols: [
      { id: 'tank1', name: 'Танк (общ.)', symbol: 'tank1', size: 0.08 },
      { id: 'tank_svoy_1', name: 'Танк (свой)', symbol: 'tank_svoy_1', size: 0.08 },
      { id: 'bmp1', name: 'БМП', symbol: 'bmp1', size: 0.08 },
      { id: 'bmp_svoy_1', name: 'БМП (свой)', symbol: 'bmp_svoy_1', size: 0.08 },
      { id: 'btr1', name: 'БТР', symbol: 'btr1', size: 0.08 },
      { id: 'btr_svoy_1', name: 'БТР (свой)', symbol: 'btr_svoy_1', size: 0.08 }
    ]
  },
  {
    id: 'artillery',
    name: 'Артиллерия и РСЗО',
    symbols: [
      { id: 'sau1', name: 'САУ', symbol: 'sau1', size: 0.08 },
      { id: 'sau_pr1', name: 'САУ (пр.)', symbol: 'sau_pr1', size: 0.08 },
      { id: 'rszo1', name: 'РСЗО', symbol: 'rszo1', size: 0.08 },
      { id: 'rszo_prot_1', name: 'РСЗО (пр.)', symbol: 'rszo_prot_1', size: 0.08 },
      { id: 'min1', name: 'Миномет', symbol: 'min1', size: 0.08 },
      { id: 'min_pr1', name: 'Миномет (пр.)', symbol: 'min_pr1', size: 0.08 }
    ]
  },
  {
    id: 'air_defense',
    name: 'ПВО и РЛС',
    symbols: [
      { id: 'zrk', name: 'ЗРК', symbol: 'zrk', size: 0.08 },
      { id: 'zrk_pr', name: 'ЗРК (пр.)', symbol: 'zrk_pr', size: 0.08 },
      { id: 'zsu1', name: 'ЗСУ', symbol: 'zsu1', size: 0.08 },
      { id: 'zsu_pr1', name: 'ЗСУ (пр.)', symbol: 'zsu_pr1', size: 0.08 },
      { id: 'rls', name: 'РЛС', symbol: 'rls', size: 0.08 }
    ]
  },
  {
    id: 'infantry',
    name: 'Пехота и огневые средства',
    symbols: [
      { id: 'pehota', name: 'Пехота', symbol: 'pehota', size: 0.08 },
      { id: 'pehota_pr', name: 'Пехота (пр.)', symbol: 'pehota_pr', size: 0.08 },
      { id: 'pulemet', name: 'Пулемет', symbol: 'pulemet', size: 0.08 },
      { id: 'pulemet_pr', name: 'Пулемет (пр.)', symbol: 'pulemet_pr', size: 0.08 },
      { id: 'spg1', name: 'СПГ', symbol: 'spg1', size: 0.08 },
      { id: 'spg_svoy1', name: 'СПГ (свой)', symbol: 'spg_svoy1', size: 0.08 }
    ]
  },
  {
    id: 'command',
    name: 'Управление и связь',
    symbols: [
      { id: 'kp', name: 'Командный пункт', symbol: 'kp', size: 0.08 },
      { id: 'np', name: 'Наблюдательный пункт', symbol: 'np', size: 0.08 },
      { id: 'kshp', name: 'КШМ', symbol: 'kshp', size: 0.08 }
    ]
  }
];
