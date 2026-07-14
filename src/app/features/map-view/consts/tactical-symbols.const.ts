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
      { id: 'btr1', name: 'БТР', symbol: 'btr1', size: 0.08 },
      { id: 'samoh_min1', name: 'Сам. миномет', symbol: 'samoh_min1', size: 0.08 }
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
      { id: 'min_pr_1', name: 'Миномет (пр.)', symbol: 'min_pr_1', size: 0.08 }
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
      { id: 'utes_1', name: 'Пулемет «Утёс»', symbol: 'utes_1', size: 0.08 },
      { id: 'utes_svoy1', name: 'Утёс (свой)', symbol: 'utes_svoy1', size: 0.08 },
      { id: 'zen_pulemet', name: 'Зен. пулемет', symbol: 'zen_pulemet', size: 0.08 },
      { id: 'zen_pulemet_pr', name: 'Зен. пулемет (пр.)', symbol: 'zen_pulemet_pr', size: 0.08 },
      { id: 'spg1', name: 'СПГ-9', symbol: 'spg1', size: 0.08 },
      { id: 'spg_svoy1', name: 'СПГ-9 (свой)', symbol: 'spg_svoy1', size: 0.08 },
      { id: 'rpg1', name: 'РПГ-7', symbol: 'rpg1', size: 0.08 },
      { id: 'rpg_nash1', name: 'РПГ-7 (свой)', symbol: 'rpg_nash1', size: 0.08 }
    ]
  },
  {
    id: 'command',
    name: 'Управление и связь',
    symbols: [
      { id: 'rknp', name: 'КНП', symbol: 'rknp', size: 0.08 },
      { id: 'np', name: 'Наблюд. пункт', symbol: 'np', size: 0.08 },
      { id: 'kshm4', name: 'КШМ', symbol: 'kshm4', size: 0.08 },
      { id: 'radiostantsiya', name: 'Радиостанция', symbol: 'radiostantsiya', size: 0.08 },
      { id: 'releyn', name: 'Релейная ст.', symbol: 'releyn', size: 0.08 }
    ]
  }
];
