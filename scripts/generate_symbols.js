const fs = require('fs');
const path = require('path');

const symbolsDir = path.join(__dirname, '..', 'public', 'symbols');
const files = fs.readdirSync(symbolsDir).filter(f => f.endsWith('.svg'));

// Словарь названий и распределение
const categories = [
  {
    id: 'armor',
    name: 'Бронетехника и Транспорт',
    symbols: []
  },
  {
    id: 'artillery',
    name: 'Артиллерия, РСЗО, Минометы и АГС',
    symbols: []
  },
  {
    id: 'air_defense_drones',
    name: 'ПВО, РЛС и РЭБ',
    symbols: []
  },
  {
    id: 'aviation_drones',
    name: 'Авиация, БЛА и Удары',
    symbols: []
  },
  {
    id: 'infantry',
    name: 'Огневые средства пехоты',
    symbols: []
  },
  {
    id: 'command_comm',
    name: 'Управление, Разведка и Связь',
    symbols: []
  },
  {
    id: 'medical',
    name: 'Медицинские подразделения',
    symbols: []
  },
  {
    id: 'engineering',
    name: 'Фортификация и Инженерия',
    symbols: []
  },
  {
    id: 'infrastructure',
    name: 'Инфраструктура и Ориентиры',
    symbols: []
  },
  {
    id: 'misc',
    name: 'Цели, Подразделения и Разное',
    symbols: []
  }
];

const nameMapping = {
  'tank_svoy_1': 'Танк (свой)',
  'rs_tank': 'Танк с РС',
  'bmp_svoy1': 'БМП (свой)',
  'btr_svoy1': 'БТР (свой)',
  'brdm1': 'БРДМ',
  'avto1': 'Автомобиль',
  'med_avto1': 'Мед. автомобиль',
  'bannoprachechnyy_kompl': 'Банно-прач. комплекс',
  'peredv_banya': 'Передвижная баня',
  'zapravka': 'Заправка (ГСМ)',

  'art1': 'Артиллерия общ.',
  'art_svoya1': 'Артиллерия своя',
  'art_op_svoya_1': 'ОП артиллерии',
  'art_polukaponir_1': 'Арт. полукапонир',
  'sau1': 'САУ',
  'sau_op_svoya_1': 'ОП САУ',
  'rszo1': 'РСЗО',
  'op_rszo1': 'ОП РСЗО',
  'min1': 'Миномет',
  'min_op1': 'ОП миномета',
  'minomet_op_1': 'Минометная позиция',
  'samoh_min1': 'Самоходный миномет',
  'op_samoh_min1': 'ОП сам. миномета',
  'ags': 'АГС',

  'zrk': 'ЗРК общ.',
  'zrk_bl': 'ЗРК ближний',
  'zrk_blizh1': 'ЗРК ближ. действия',
  'zrk_sredn': 'ЗРК сред. действия',
  'zrk_daln': 'ЗРК дальн. действия',
  'zsu1': 'ЗСУ',
  'zsu_rls1': 'ЗСУ с РЛС',
  'zu': 'Зенитная установка',
  'zu_pr': 'Зенит. установка (пр.)',
  'zen_pulemet': 'Зенитный пулемет',
  'rls': 'РЛС',
  'art_rls': 'Арт. РЛС',
  'reb': 'Станция РЭБ',
  'reb_podv': 'Подвижная РЭБ',
  'pelengator_podv': 'Пеленгатор подв.',

  'malyy_bla1': 'Малый БЛА',
  'bolshoy_bla1': 'Большой БЛА',
  'start_bla': 'Старт БЛА',
  'kvadrik': 'Квадрокоптер',
  'aviaudar': 'Авиаудар',
  'aviaudar_pr': 'Авиаудар (пр.)',
  'takt_raketa': 'Тактическая ракета',
  'tsel_reakt': 'Цель реактивная',

  'utes_svoy1': 'Пулемет «Утёс» (свой)',
  'pk1': 'Пулемет ПК',
  'pk_svoy1': 'ПК (свой)',
  'spg_svoy1': 'СПГ-9 (свой)',
  'ptur_svoy1': 'ПТУР (свой)',
  'rpg_nash1': 'РПГ-7 (свой)',
  'ognemet': 'Огнемет',
  'tyazh_ognemet': 'Тяжелый огнемет',
  'anp': 'АНП (прибор)',

  'rknp': 'Район КНП',
  'knp': 'КНП',
  'knp_bat': 'КНП батареи',
  'knpbatr': 'КНП дивизиона/батр',
  'knpbatr_peredv1': 'КНП батр. передв.',
  'knp_peredv1': 'КНП передвижной',
  'knp_prot': 'КНП (пр.)',
  'knpb': 'КНПб',
  'knpd': 'КНПд',
  'np': 'Наблюдательный пункт',
  'sopr_np': 'Сопряженный НП',
  'kshm4': 'КШМ',
  'radiostantsiya': 'Радиостанция',
  'releyn': 'Релейная станция',
  'kosm_sv': 'Космическая связь',
  'podv_rs': 'Подвижная РС',
  'perenosn_rs': 'Переносная РС',
  'pol_us': 'Полевой узел связи',
  'st_us': 'Стационарный УС',
  'st_us_zasch': 'Защищенный УС',
  'kamera': 'Видеокамера / НП',
  'mikrofon': 'Акустич. датчик',
  'zvuk': 'Звукоразведка',
  'zvuk_np': 'Звуковой НП',
  'zvuk_np_pr': 'Звуковой НП (пр.)',
  'zvuk_pr': 'Звукоразведка (пр.)',
  'rf': 'Радиопост',
  'tap': 'Тлф аппарат (ТАП)',
  'teplovizor': 'Тепловизор',
  'svet': 'Осветительный пост',

  'med_bat': 'Мед. батальон',
  'med_otryad': 'Мед. отряд',
  'med_rota': 'Мед. рота',
  'gosp_polevoy': 'Полевой госпиталь',
  'gosp_stats': 'Стационарный госп.',
  'grazhd_bolnitsa': 'Гражд. больница',
  'polevaya_banya': 'Полевая баня',

  'blindazh': 'Блиндаж',
  'blindazh_legk': 'Легкий блиндаж',
  'blindazh_zhb': 'ЖБ блиндаж',
  'dot_tipovoy1': 'Типовой ДОТ',
  'ukrytie': 'Укрытие',
  'ukrytie_zhb': 'ЖБ укрытие',
  'schel1': 'Щель перекрытая',
  'schel_per1': 'Щель перекр. 2',
  'sps1': 'СПС',
  'bashnya': 'Башня',
  'vyshka': 'Вышка',
  'op': 'Опорный пункт',
  'op1': 'ОП 1',
  'op_pt1': 'ПТ опорный пункт',
  'soor_min1': 'Сооружение минное',
  'fugas': 'Фугас',
  'fugas_upr': 'Фугас управляемый',
  'minnoe_pole_pp1': 'Минное поле ПП',
  'minnoe_pole_pt1': 'Минное поле ПТ',
  'min_pp': 'Мина ПП',
  'min_pt': 'Мина ПТ',
  'ur1': 'Установка УР',
  'imr1': 'ИМР',
  'pts1': 'ПТС',
  'most1': 'Мост',
  'most_pon1': 'Понтонный мост',
  'brod1': 'Брод',
  'dist_mp_pp': 'Дист. минирование ПП',
  'dist_mp_pt': 'Дист. минирование ПТ',
  'dist_mp_smesh': 'Дист. минирование смеш.',
  'bat_mp': 'Батарея МП',
  'r_mp': 'Рота МП',
  'mp': 'Минное поле',
  'mpp': 'Минно-подрывное поле',
  'monolit_ps1': 'Монолит ПС',

  'elektrostantsiya': 'Электростанция',
  'podstantsiya': 'Подстанция',
  'telebashnya': 'Телебашня',
  'shahta': 'Шахта',
  'shahta_zakrytaya': 'Шахта закрытая',
  'zavod': 'Завод',
  'zavod_bez_truby': 'Завод без трубы',
  'truba': 'Заводская труба',
  'terrikon': 'Террикон',
  'emkost': 'Резервуар / Емкость',
  'hlebozavod': 'Хлебозавод',
  'teplitsa': 'Теплица',
  'tserkov': 'Храм / Церковь',
  'pamyatnik': 'Памятник',
  'derevo': 'Дерево (ориентир)',
  'meteopost': 'Метеопост',

  'tsel': 'Цель общ.',
  'odinochnaya_tsel': 'Одиночная цель',
  'tochka': 'Точка (ориентир)',
  'treugolnik': 'Треугольник (пункт)',
  'puod': 'ПУОД',
  'ahmat': 'Подразд. «Ахмат»',
  'gus': 'ГУС',
  'gus_zasch': 'ГУС защищенный',
  'vdv': 'Символ ВДВ'
};

const categoryMap = {
  'armor': ['tank_svoy_1', 'rs_tank', 'bmp_svoy1', 'btr_svoy1', 'brdm1', 'avto1', 'med_avto1', 'bannoprachechnyy_kompl', 'peredv_banya', 'zapravka'],
  'artillery': ['art1', 'art_svoya1', 'art_op_svoya_1', 'art_polukaponir_1', 'sau1', 'sau_op_svoya_1', 'rszo1', 'op_rszo1', 'min1', 'min_op1', 'minomet_op_1', 'samoh_min1', 'op_samoh_min1', 'ags'],
  'air_defense_drones': ['zrk', 'zrk_bl', 'zrk_blizh1', 'zrk_sredn', 'zrk_daln', 'zsu1', 'zsu_rls1', 'zu', 'zu_pr', 'zen_pulemet', 'rls', 'art_rls', 'reb', 'reb_podv', 'pelengator_podv'],
  'aviation_drones': ['malyy_bla1', 'bolshoy_bla1', 'start_bla', 'kvadrik', 'aviaudar', 'aviaudar_pr', 'takt_raketa', 'tsel_reakt'],
  'infantry': ['utes_svoy1', 'pk1', 'pk_svoy1', 'spg_svoy1', 'ptur_svoy1', 'rpg_nash1', 'ognemet', 'tyazh_ognemet', 'anp'],
  'command_comm': ['rknp', 'knp', 'knp_bat', 'knpbatr', 'knpbatr_peredv1', 'knp_peredv1', 'knp_prot', 'knpb', 'knpd', 'np', 'sopr_np', 'kshm4', 'radiostantsiya', 'releyn', 'kosm_sv', 'podv_rs', 'perenosn_rs', 'pol_us', 'st_us', 'st_us_zasch', 'kamera', 'mikrofon', 'zvuk', 'zvuk_np', 'zvuk_np_pr', 'zvuk_pr', 'rf', 'tap', 'teplovizor', 'svet'],
  'medical': ['med_bat', 'med_otryad', 'med_rota', 'gosp_polevoy', 'gosp_stats', 'grazhd_bolnitsa', 'polevaya_banya'],
  'engineering': ['blindazh', 'blindazh_legk', 'blindazh_zhb', 'dot_tipovoy1', 'ukrytie', 'ukrytie_zhb', 'schel1', 'schel_per1', 'sps1', 'bashnya', 'vyshka', 'op', 'op1', 'op_pt1', 'soor_min1', 'fugas', 'fugas_upr', 'minnoe_pole_pp1', 'minnoe_pole_pt1', 'min_pp', 'min_pt', 'ur1', 'imr1', 'pts1', 'most1', 'most_pon1', 'brod1', 'dist_mp_pp', 'dist_mp_pt', 'dist_mp_smesh', 'bat_mp', 'r_mp', 'mp', 'mpp', 'monolit_ps1'],
  'infrastructure': ['elektrostantsiya', 'podstantsiya', 'telebashnya', 'shahta', 'shahta_zakrytaya', 'zavod', 'zavod_bez_truby', 'truba', 'terrikon', 'emkost', 'hlebozavod', 'teplitsa', 'tserkov', 'pamyatnik', 'derevo', 'meteopost'],
  'misc': ['tsel', 'odinochnaya_tsel', 'tochka', 'treugolnik', 'puod', 'ahmat', 'gus', 'gus_zasch', 'vdv']
};

let assigned = new Set();
let manifestItems = [];

categories.forEach(cat => {
  const ids = categoryMap[cat.id] || [];
  ids.forEach(id => {
    const filename = `${id}.svg`;
    if (files.includes(filename)) {
      const item = {
        id: id,
        name: nameMapping[id] || id,
        symbol: id,
        size: 0.08
      };
      cat.symbols.push(item);
      assigned.add(filename);
      manifestItems.push({
        id: id,
        name: item.name,
        file: filename,
        category: cat.name
      });
    }
  });
});

// Проверим, не остались ли какие-то файлы не распределены
files.forEach(f => {
  if (!assigned.has(f)) {
    const id = f.replace('.svg', '');
    const item = {
      id: id,
      name: nameMapping[id] || id,
      symbol: id,
      size: 0.08
    };
    categories[categories.length - 1].symbols.push(item);
    manifestItems.push({
      id: id,
      name: item.name,
      file: f,
      category: categories[categories.length - 1].name
    });
  }
});

// Отфильтруем пустые категории, если вдруг есть
const finalCategories = categories.filter(c => c.symbols.length > 0);

const tsContent = `export interface TacticalSymbol {
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

export const TACTICAL_SYMBOLS: SymbolCategory[] = ${JSON.stringify(finalCategories, null, 2).replace(/"([^"]+)":/g, '$1:')};
`;

const outputPath = path.join(__dirname, '..', 'src', 'app', 'features', 'map-view', 'consts', 'tactical-symbols.const.ts');
fs.writeFileSync(outputPath, tsContent, 'utf8');

const manifestPath = path.join(symbolsDir, 'manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifestItems, null, 2), 'utf8');

console.log(`Updated tactical-symbols.const.ts and manifest.json successfully with ${files.length} symbols across ${finalCategories.length} categories!`);
