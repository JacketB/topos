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
    name: 'Бронетехника и Транспорт',
    symbols: [
      { id: 'tank1', name: 'Танк (общ.)', symbol: 'tank1', size: 0.08 },
      { id: 'tank_svoy_1', name: 'Танк (свой)', symbol: 'tank_svoy_1', size: 0.08 },
      { id: 'bmp1', name: 'БМП', symbol: 'bmp1', size: 0.08 },
      { id: 'bmp_svoy1', name: 'БМП (свой)', symbol: 'bmp_svoy1', size: 0.08 },
      { id: 'btr1', name: 'БТР', symbol: 'btr1', size: 0.08 },
      { id: 'btr_svoy1', name: 'БТР (свой)', symbol: 'btr_svoy1', size: 0.08 },
      { id: 'brdm1', name: 'БРДМ', symbol: 'brdm1', size: 0.08 },
      { id: 'brdm_pr1', name: 'БРДМ (пр.)', symbol: 'brdm_pr1', size: 0.08 },
      { id: 'avto1', name: 'Автомобиль', symbol: 'avto1', size: 0.08 },
      { id: 'avto_pr1', name: 'Автомобиль (пр.)', symbol: 'avto_pr1', size: 0.08 },
      { id: 'med_avto1', name: 'Мед. авто', symbol: 'med_avto1', size: 0.08 }
    ]
  },
  {
    id: 'artillery',
    name: 'Артиллерия, РСЗО, АГС',
    symbols: [
      { id: 'sau1', name: 'САУ', symbol: 'sau1', size: 0.08 },
      { id: 'sau_pr1', name: 'САУ (пр.)', symbol: 'sau_pr1', size: 0.08 },
      { id: 'rszo1', name: 'РСЗО', symbol: 'rszo1', size: 0.08 },
      { id: 'rszo_prot_1', name: 'РСЗО (пр.)', symbol: 'rszo_prot_1', size: 0.08 },
      { id: 'min1', name: 'Миномет', symbol: 'min1', size: 0.08 },
      { id: 'min_pr_1', name: 'Миномет (пр.)', symbol: 'min_pr_1', size: 0.08 },
      { id: 'samoh_min1', name: 'Сам. миномет', symbol: 'samoh_min1', size: 0.08 },
      { id: 'ags1', name: 'АГС', symbol: 'ags1', size: 0.08 },
      { id: 'ags_svoy1', name: 'АГС (свой)', symbol: 'ags_svoy1', size: 0.08 }
    ]
  },
  {
    id: 'air_defense_drones',
    name: 'ПВО, БЛА, РЭБ и РЛС',
    symbols: [
      { id: 'zrk', name: 'ЗРК', symbol: 'zrk', size: 0.08 },
      { id: 'zrk_pr', name: 'ЗРК (пр.)', symbol: 'zrk_pr', size: 0.08 },
      { id: 'zrk_blizh1', name: 'ЗРК ближний', symbol: 'zrk_blizh1', size: 0.08 },
      { id: 'zsu1', name: 'ЗСУ', symbol: 'zsu1', size: 0.08 },
      { id: 'zsu_pr1', name: 'ЗСУ (пр.)', symbol: 'zsu_pr1', size: 0.08 },
      { id: 'zu', name: 'Зенит. установка', symbol: 'zu', size: 0.08 },
      { id: 'malyy_bla1', name: 'Малый БЛА', symbol: 'malyy_bla1', size: 0.08 },
      { id: 'bolshoy_bla1', name: 'Большой БЛА', symbol: 'bolshoy_bla1', size: 0.08 },
      { id: 'kvadrik', name: 'Квадрокоптер', symbol: 'kvadrik', size: 0.08 },
      { id: 'rls', name: 'РЛС', symbol: 'rls', size: 0.08 },
      { id: 'reb', name: 'Станция РЭБ', symbol: 'reb', size: 0.08 },
      { id: 'reb_podv', name: 'Подвижная РЭБ', symbol: 'reb_podv', size: 0.08 },
      { id: 'pelengator_podv', name: 'Пеленгатор подв.', symbol: 'pelengator_podv', size: 0.08 }
    ]
  },
  {
    id: 'infantry',
    name: 'Огневые средства пехоты',
    symbols: [
      { id: 'utes_1', name: 'Пулемет «Утёс»', symbol: 'utes_1', size: 0.08 },
      { id: 'utes_svoy1', name: 'Утёс (свой)', symbol: 'utes_svoy1', size: 0.08 },
      { id: 'pk1', name: 'Пулемет Калашн.', symbol: 'pk1', size: 0.08 },
      { id: 'pk_svoy1', name: 'ПК (свой)', symbol: 'pk_svoy1', size: 0.08 },
      { id: 'zen_pulemet', name: 'Зен. пулемет', symbol: 'zen_pulemet', size: 0.08 },
      { id: 'spg1', name: 'СПГ-9', symbol: 'spg1', size: 0.08 },
      { id: 'spg_svoy1', name: 'СПГ-9 (свой)', symbol: 'spg_svoy1', size: 0.08 },
      { id: 'ptur1', name: 'ПТУР', symbol: 'ptur1', size: 0.08 },
      { id: 'ptur_svoy1', name: 'ПТУР (свой)', symbol: 'ptur_svoy1', size: 0.08 },
      { id: 'rpg1', name: 'РПГ-7', symbol: 'rpg1', size: 0.08 },
      { id: 'rpg_nash1', name: 'РПГ-7 (свой)', symbol: 'rpg_nash1', size: 0.08 },
      { id: 'ognemet', name: 'Огнемет', symbol: 'ognemet', size: 0.08 },
      { id: 'tyazh_ognemet', name: 'Тяж. огнемет', symbol: 'tyazh_ognemet', size: 0.08 }
    ]
  },
  {
    id: 'command_med',
    name: 'Управление, связь и медицина',
    symbols: [
      { id: 'rknp', name: 'КНП', symbol: 'rknp', size: 0.08 },
      { id: 'np', name: 'Наблюд. пункт', symbol: 'np', size: 0.08 },
      { id: 'kshm4', name: 'КШМ', symbol: 'kshm4', size: 0.08 },
      { id: 'knp_bat', name: 'КНП батареи', symbol: 'knp_bat', size: 0.08 },
      { id: 'sopr_np', name: 'Сопровожд. НП', symbol: 'sopr_np', size: 0.08 },
      { id: 'radiostantsiya', name: 'Радиостанция', symbol: 'radiostantsiya', size: 0.08 },
      { id: 'releyn', name: 'Релейная ст.', symbol: 'releyn', size: 0.08 },
      { id: 'kosm_sv', name: 'Космич. связь', symbol: 'kosm_sv', size: 0.08 },
      { id: 'med_bat', name: 'Мед. батальон', symbol: 'med_bat', size: 0.08 },
      { id: 'med_otryad', name: 'Мед. отряд', symbol: 'med_otryad', size: 0.08 },
      { id: 'med_rota', name: 'Мед. рота', symbol: 'med_rota', size: 0.08 },
      { id: 'gosp_polevoy', name: 'Полевой госп.', symbol: 'gosp_polevoy', size: 0.08 }
    ]
  },
  {
    id: 'engineering',
    name: 'Фортификация и инженерия',
    symbols: [
      { id: 'blindazh', name: 'Блиндаж', symbol: 'blindazh', size: 0.08 },
      { id: 'blindazh_legk', name: 'Легкий блиндаж', symbol: 'blindazh_legk', size: 0.08 },
      { id: 'blindazh_zhb', name: 'ЖБ блиндаж', symbol: 'blindazh_zhb', size: 0.08 },
      { id: 'dot_tipovoy1', name: 'Типовой ДОТ', symbol: 'dot_tipovoy1', size: 0.08 },
      { id: 'minnoe_pole_pp1', name: 'Мин. поле ПП', symbol: 'minnoe_pole_pp1', size: 0.08 },
      { id: 'minnoe_pole_pt1', name: 'Мин. поле ПТ', symbol: 'minnoe_pole_pt1', size: 0.08 },
      { id: 'fugas', name: 'Фугас', symbol: 'fugas', size: 0.08 },
      { id: 'fugas_upr', name: 'Управляемый фугас', symbol: 'fugas_upr', size: 0.08 },
      { id: 'imr1', name: 'ИМР', symbol: 'imr1', size: 0.08 },
      { id: 'pts1', name: 'ПТС', symbol: 'pts1', size: 0.08 },
      { id: 'most1', name: 'Мост', symbol: 'most1', size: 0.08 },
      { id: 'most_pon1', name: 'Понтонный мост', symbol: 'most_pon1', size: 0.08 },
      { id: 'brod1', name: 'Брод', symbol: 'brod1', size: 0.08 }
    ]
  }
];
