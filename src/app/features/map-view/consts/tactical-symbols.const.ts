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
    id: "armor",
    name: "Бронетехника и Транспорт",
    symbols: [
      {
        id: "tank_svoy_1",
        name: "Танк (свой)",
        symbol: "tank_svoy_1",
        size: 0.08
      },
      {
        id: "rs_tank",
        name: "Танк с РС",
        symbol: "rs_tank",
        size: 0.08
      },
      {
        id: "bmp_svoy1",
        name: "БМП (свой)",
        symbol: "bmp_svoy1",
        size: 0.08
      },
      {
        id: "btr_svoy1",
        name: "БТР (свой)",
        symbol: "btr_svoy1",
        size: 0.08
      },
      {
        id: "brdm1",
        name: "БРДМ",
        symbol: "brdm1",
        size: 0.08
      },
      {
        id: "avto1",
        name: "Автомобиль",
        symbol: "avto1",
        size: 0.08
      },
      {
        id: "med_avto1",
        name: "Мед. автомобиль",
        symbol: "med_avto1",
        size: 0.08
      },
      {
        id: "bannoprachechnyy_kompl",
        name: "Банно-прач. комплекс",
        symbol: "bannoprachechnyy_kompl",
        size: 0.08
      },
      {
        id: "peredv_banya",
        name: "Передвижная баня",
        symbol: "peredv_banya",
        size: 0.08
      },
      {
        id: "zapravka",
        name: "Заправка (ГСМ)",
        symbol: "zapravka",
        size: 0.08
      }
    ]
  },
  {
    id: "fortification_ussr",
    name: "Инженерная фортификация (МО СССР)",
    symbols: [
      {
        id: "fort_trench_shelter",
        name: "Стрелковая ячейка",
        symbol: "fort_trench_shelter",
        size: 0.08
      },
      {
        id: "fort_tank_trench",
        name: "Окоп для танка",
        symbol: "fort_tank_trench",
        size: 0.08
      },
      {
        id: "fort_bmp_trench",
        name: "Окоп для БМП/БТР",
        symbol: "fort_bmp_trench",
        size: 0.08
      },
      {
        id: "fort_art_trench",
        name: "Окоп для орудия",
        symbol: "fort_art_trench",
        size: 0.08
      },
      {
        id: "fort_dzot",
        name: "ДЗОТ",
        symbol: "fort_dzot",
        size: 0.08
      },
      {
        id: "fort_dot",
        name: "ДОТ (усиленный)",
        symbol: "fort_dot",
        size: 0.08
      },
      {
        id: "dot_tipovoy1",
        name: "ДОТ (типовой)",
        symbol: "dot_tipovoy1",
        size: 0.08
      },
      {
        id: "fort_knp",
        name: "КНП в укрытии",
        symbol: "fort_knp",
        size: 0.08
      },
      {
        id: "fort_blindage",
        name: "Блиндаж",
        symbol: "fort_blindage",
        size: 0.08
      },
      {
        id: "blindazh",
        name: "Блиндаж (общ.)",
        symbol: "blindazh",
        size: 0.08
      },
      {
        id: "blindazh_zhb",
        name: "Блиндаж ЖБ",
        symbol: "blindazh_zhb",
        size: 0.08
      },
      {
        id: "schel1",
        name: "Открытая щель",
        symbol: "schel1",
        size: 0.08
      },
      {
        id: "schel_per1",
        name: "Перекрытая щель",
        symbol: "schel_per1",
        size: 0.08
      },
      {
        id: "ukrytie",
        name: "Укрытие для техники",
        symbol: "ukrytie",
        size: 0.08
      },
      {
        id: "ukrytie_zhb",
        name: "Укрытие ЖБ",
        symbol: "ukrytie_zhb",
        size: 0.08
      },
      {
        id: "sps1",
        name: "СПС",
        symbol: "sps1",
        size: 0.08
      }
    ]
  },
  {
    id: "artillery",
    name: "Артиллерия, РСЗО, Минометы и АГС",
    symbols: [
      {
        id: "art1",
        name: "Артиллерия общ.",
        symbol: "art1",
        size: 0.08
      },
      {
        id: "art_svoya1",
        name: "Артиллерия своя",
        symbol: "art_svoya1",
        size: 0.08
      },
      {
        id: "art_op_svoya_1",
        name: "ОП артиллерии",
        symbol: "art_op_svoya_1",
        size: 0.08
      },
      {
        id: "art_polukaponir_1",
        name: "Арт. полукапонир",
        symbol: "art_polukaponir_1",
        size: 0.08
      },
      {
        id: "sau1",
        name: "САУ",
        symbol: "sau1",
        size: 0.08
      },
      {
        id: "sau_op_svoya_1",
        name: "ОП САУ",
        symbol: "sau_op_svoya_1",
        size: 0.08
      },
      {
        id: "rszo1",
        name: "РСЗО",
        symbol: "rszo1",
        size: 0.08
      },
      {
        id: "op_rszo1",
        name: "ОП РСЗО",
        symbol: "op_rszo1",
        size: 0.08
      },
      {
        id: "min1",
        name: "Миномет",
        symbol: "min1",
        size: 0.08
      },
      {
        id: "min_op1",
        name: "ОП миномета",
        symbol: "min_op1",
        size: 0.08
      },
      {
        id: "minomet_op_1",
        name: "Минометная позиция",
        symbol: "minomet_op_1",
        size: 0.08
      },
      {
        id: "samoh_min1",
        name: "Самоходный миномет",
        symbol: "samoh_min1",
        size: 0.08
      },
      {
        id: "op_samoh_min1",
        name: "ОП сам. миномета",
        symbol: "op_samoh_min1",
        size: 0.08
      },
      {
        id: "ags",
        name: "АГС",
        symbol: "ags",
        size: 0.08
      }
    ]
  },
  {
    id: "air_defense_drones",
    name: "ПВО, РЛС и РЭБ",
    symbols: [
      {
        id: "zrk",
        name: "ЗРК общ.",
        symbol: "zrk",
        size: 0.08
      },
      {
        id: "zrk_bl",
        name: "ЗРК ближний",
        symbol: "zrk_bl",
        size: 0.08
      },
      {
        id: "zrk_blizh1",
        name: "ЗРК ближ. действия",
        symbol: "zrk_blizh1",
        size: 0.08
      },
      {
        id: "zrk_sredn",
        name: "ЗРК сред. действия",
        symbol: "zrk_sredn",
        size: 0.08
      },
      {
        id: "zrk_daln",
        name: "ЗРК дальн. действия",
        symbol: "zrk_daln",
        size: 0.08
      },
      {
        id: "zsu1",
        name: "ЗСУ",
        symbol: "zsu1",
        size: 0.08
      },
      {
        id: "zsu_rls1",
        name: "ЗСУ с РЛС",
        symbol: "zsu_rls1",
        size: 0.08
      },
      {
        id: "zu",
        name: "Зенитная установка",
        symbol: "zu",
        size: 0.08
      },
      {
        id: "zu_pr",
        name: "Зенит. установка (пр.)",
        symbol: "zu_pr",
        size: 0.08
      },
      {
        id: "zen_pulemet",
        name: "Зенитный пулемет",
        symbol: "zen_pulemet",
        size: 0.08
      },
      {
        id: "rls",
        name: "РЛС",
        symbol: "rls",
        size: 0.08
      },
      {
        id: "art_rls",
        name: "Арт. РЛС",
        symbol: "art_rls",
        size: 0.08
      },
      {
        id: "reb",
        name: "Станция РЭБ",
        symbol: "reb",
        size: 0.08
      },
      {
        id: "reb_podv",
        name: "Подвижная РЭБ",
        symbol: "reb_podv",
        size: 0.08
      },
      {
        id: "pelengator_podv",
        name: "Пеленгатор подв.",
        symbol: "pelengator_podv",
        size: 0.08
      }
    ]
  },
  {
    id: "aviation_drones",
    name: "Авиация, БЛА и Удары",
    symbols: [
      {
        id: "malyy_bla1",
        name: "Малый БЛА",
        symbol: "malyy_bla1",
        size: 0.08
      },
      {
        id: "bolshoy_bla1",
        name: "Большой БЛА",
        symbol: "bolshoy_bla1",
        size: 0.08
      },
      {
        id: "start_bla",
        name: "Старт БЛА",
        symbol: "start_bla",
        size: 0.08
      },
      {
        id: "kvadrik",
        name: "Квадрокоптер",
        symbol: "kvadrik",
        size: 0.08
      },
      {
        id: "aviaudar",
        name: "Авиаудар",
        symbol: "aviaudar",
        size: 0.08
      },
      {
        id: "aviaudar_pr",
        name: "Авиаудар (пр.)",
        symbol: "aviaudar_pr",
        size: 0.08
      },
      {
        id: "takt_raketa",
        name: "Тактическая ракета",
        symbol: "takt_raketa",
        size: 0.08
      },
      {
        id: "tsel_reakt",
        name: "Цель реактивная",
        symbol: "tsel_reakt",
        size: 0.08
      }
    ]
  },
  {
    id: "infantry",
    name: "Огневые средства пехоты",
    symbols: [
      {
        id: "utes_svoy1",
        name: "Пулемет «Утёс» (свой)",
        symbol: "utes_svoy1",
        size: 0.08
      },
      {
        id: "pk1",
        name: "Пулемет ПК",
        symbol: "pk1",
        size: 0.08
      },
      {
        id: "pk_svoy1",
        name: "ПК (свой)",
        symbol: "pk_svoy1",
        size: 0.08
      },
      {
        id: "spg_svoy1",
        name: "СПГ-9 (свой)",
        symbol: "spg_svoy1",
        size: 0.08
      },
      {
        id: "ptur_svoy1",
        name: "ПТУР (свой)",
        symbol: "ptur_svoy1",
        size: 0.08
      },
      {
        id: "rpg_nash1",
        name: "РПГ-7 (свой)",
        symbol: "rpg_nash1",
        size: 0.08
      },
      {
        id: "ognemet",
        name: "Огнемет",
        symbol: "ognemet",
        size: 0.08
      },
      {
        id: "tyazh_ognemet",
        name: "Тяжелый огнемет",
        symbol: "tyazh_ognemet",
        size: 0.08
      },
      {
        id: "anp",
        name: "АНП (прибор)",
        symbol: "anp",
        size: 0.08
      }
    ]
  },
  {
    id: "command_comm",
    name: "Управление, Разведка и Связь",
    symbols: [
      {
        id: "rknp",
        name: "Район КНП",
        symbol: "rknp",
        size: 0.08
      },
      {
        id: "knp",
        name: "КНП",
        symbol: "knp",
        size: 0.08
      },
      {
        id: "knp_bat",
        name: "КНП батареи",
        symbol: "knp_bat",
        size: 0.08
      },
      {
        id: "knpbatr",
        name: "КНП дивизиона/батр",
        symbol: "knpbatr",
        size: 0.08
      },
      {
        id: "knpbatr_peredv1",
        name: "КНП батр. передв.",
        symbol: "knpbatr_peredv1",
        size: 0.08
      },
      {
        id: "knp_peredv1",
        name: "КНП передвижной",
        symbol: "knp_peredv1",
        size: 0.08
      },
      {
        id: "knp_prot",
        name: "КНП (пр.)",
        symbol: "knp_prot",
        size: 0.08
      },
      {
        id: "knpb",
        name: "КНПб",
        symbol: "knpb",
        size: 0.08
      },
      {
        id: "knpd",
        name: "КНПд",
        symbol: "knpd",
        size: 0.08
      },
      {
        id: "np",
        name: "Наблюдательный пункт",
        symbol: "np",
        size: 0.08
      },
      {
        id: "sopr_np",
        name: "Сопряженный НП",
        symbol: "sopr_np",
        size: 0.08
      },
      {
        id: "kshm4",
        name: "КШМ",
        symbol: "kshm4",
        size: 0.08
      },
      {
        id: "radiostantsiya",
        name: "Радиостанция",
        symbol: "radiostantsiya",
        size: 0.08
      },
      {
        id: "releyn",
        name: "Релейная станция",
        symbol: "releyn",
        size: 0.08
      },
      {
        id: "kosm_sv",
        name: "Космическая связь",
        symbol: "kosm_sv",
        size: 0.08
      },
      {
        id: "podv_rs",
        name: "Подвижная РС",
        symbol: "podv_rs",
        size: 0.08
      },
      {
        id: "perenosn_rs",
        name: "Переносная РС",
        symbol: "perenosn_rs",
        size: 0.08
      },
      {
        id: "pol_us",
        name: "Полевой узел связи",
        symbol: "pol_us",
        size: 0.08
      },
      {
        id: "st_us",
        name: "Стационарный УС",
        symbol: "st_us",
        size: 0.08
      },
      {
        id: "st_us_zasch",
        name: "Защищенный УС",
        symbol: "st_us_zasch",
        size: 0.08
      },
      {
        id: "kamera",
        name: "Видеокамера / НП",
        symbol: "kamera",
        size: 0.08
      },
      {
        id: "mikrofon",
        name: "Акустич. датчик",
        symbol: "mikrofon",
        size: 0.08
      },
      {
        id: "zvuk",
        name: "Звукоразведка",
        symbol: "zvuk",
        size: 0.08
      },
      {
        id: "zvuk_np",
        name: "Звуковой НП",
        symbol: "zvuk_np",
        size: 0.08
      },
      {
        id: "zvuk_np_pr",
        name: "Звуковой НП (пр.)",
        symbol: "zvuk_np_pr",
        size: 0.08
      },
      {
        id: "zvuk_pr",
        name: "Звукоразведка (пр.)",
        symbol: "zvuk_pr",
        size: 0.08
      },
      {
        id: "rf",
        name: "Радиопост",
        symbol: "rf",
        size: 0.08
      },
      {
        id: "tap",
        name: "Тлф аппарат (ТАП)",
        symbol: "tap",
        size: 0.08
      },
      {
        id: "teplovizor",
        name: "Тепловизор",
        symbol: "teplovizor",
        size: 0.08
      },
      {
        id: "svet",
        name: "Осветительный пост",
        symbol: "svet",
        size: 0.08
      }
    ]
  },
  {
    id: "medical",
    name: "Медицинские подразделения",
    symbols: [
      {
        id: "med_bat",
        name: "Мед. батальон",
        symbol: "med_bat",
        size: 0.08
      },
      {
        id: "med_otryad",
        name: "Мед. отряд",
        symbol: "med_otryad",
        size: 0.08
      },
      {
        id: "med_rota",
        name: "Мед. рота",
        symbol: "med_rota",
        size: 0.08
      },
      {
        id: "gosp_polevoy",
        name: "Полевой госпиталь",
        symbol: "gosp_polevoy",
        size: 0.08
      },
      {
        id: "gosp_stats",
        name: "Стационарный госп.",
        symbol: "gosp_stats",
        size: 0.08
      },
      {
        id: "grazhd_bolnitsa",
        name: "Гражд. больница",
        symbol: "grazhd_bolnitsa",
        size: 0.08
      },
      {
        id: "polevaya_banya",
        name: "Полевая баня",
        symbol: "polevaya_banya",
        size: 0.08
      }
    ]
  },
  {
    id: "engineering",
    name: "Фортификация и Инженерия",
    symbols: [
      {
        id: "blindazh",
        name: "Блиндаж",
        symbol: "blindazh",
        size: 0.08
      },
      {
        id: "blindazh_legk",
        name: "Легкий блиндаж",
        symbol: "blindazh_legk",
        size: 0.08
      },
      {
        id: "blindazh_zhb",
        name: "ЖБ блиндаж",
        symbol: "blindazh_zhb",
        size: 0.08
      },
      {
        id: "dot_tipovoy1",
        name: "Типовой ДОТ",
        symbol: "dot_tipovoy1",
        size: 0.08
      },
      {
        id: "ukrytie",
        name: "Укрытие",
        symbol: "ukrytie",
        size: 0.08
      },
      {
        id: "ukrytie_zhb",
        name: "ЖБ укрытие",
        symbol: "ukrytie_zhb",
        size: 0.08
      },
      {
        id: "schel1",
        name: "Щель перекрытая",
        symbol: "schel1",
        size: 0.08
      },
      {
        id: "schel_per1",
        name: "Щель перекр. 2",
        symbol: "schel_per1",
        size: 0.08
      },
      {
        id: "sps1",
        name: "СПС",
        symbol: "sps1",
        size: 0.08
      },
      {
        id: "bashnya",
        name: "Башня",
        symbol: "bashnya",
        size: 0.08
      },
      {
        id: "vyshka",
        name: "Вышка",
        symbol: "vyshka",
        size: 0.08
      },
      {
        id: "op",
        name: "Опорный пункт",
        symbol: "op",
        size: 0.08
      },
      {
        id: "op1",
        name: "ОП 1",
        symbol: "op1",
        size: 0.08
      },
      {
        id: "op_pt1",
        name: "ПТ опорный пункт",
        symbol: "op_pt1",
        size: 0.08
      },
      {
        id: "soor_min1",
        name: "Сооружение минное",
        symbol: "soor_min1",
        size: 0.08
      },
      {
        id: "fugas",
        name: "Фугас",
        symbol: "fugas",
        size: 0.08
      },
      {
        id: "fugas_upr",
        name: "Фугас управляемый",
        symbol: "fugas_upr",
        size: 0.08
      },
      {
        id: "minnoe_pole_pp1",
        name: "Минное поле ПП",
        symbol: "minnoe_pole_pp1",
        size: 0.08
      },
      {
        id: "minnoe_pole_pt1",
        name: "Минное поле ПТ",
        symbol: "minnoe_pole_pt1",
        size: 0.08
      },
      {
        id: "min_pp",
        name: "Мина ПП",
        symbol: "min_pp",
        size: 0.08
      },
      {
        id: "min_pt",
        name: "Мина ПТ",
        symbol: "min_pt",
        size: 0.08
      },
      {
        id: "ur1",
        name: "Установка УР",
        symbol: "ur1",
        size: 0.08
      },
      {
        id: "imr1",
        name: "ИМР",
        symbol: "imr1",
        size: 0.08
      },
      {
        id: "pts1",
        name: "ПТС",
        symbol: "pts1",
        size: 0.08
      },
      {
        id: "most1",
        name: "Мост",
        symbol: "most1",
        size: 0.08
      },
      {
        id: "most_pon1",
        name: "Понтонный мост",
        symbol: "most_pon1",
        size: 0.08
      },
      {
        id: "brod1",
        name: "Брод",
        symbol: "brod1",
        size: 0.08
      },
      {
        id: "dist_mp_pp",
        name: "Дист. минирование ПП",
        symbol: "dist_mp_pp",
        size: 0.08
      },
      {
        id: "dist_mp_pt",
        name: "Дист. минирование ПТ",
        symbol: "dist_mp_pt",
        size: 0.08
      },
      {
        id: "dist_mp_smesh",
        name: "Дист. минирование смеш.",
        symbol: "dist_mp_smesh",
        size: 0.08
      },
      {
        id: "bat_mp",
        name: "Батарея МП",
        symbol: "bat_mp",
        size: 0.08
      },
      {
        id: "r_mp",
        name: "Рота МП",
        symbol: "r_mp",
        size: 0.08
      },
      {
        id: "mp",
        name: "Минное поле",
        symbol: "mp",
        size: 0.08
      },
      {
        id: "mpp",
        name: "Минно-подрывное поле",
        symbol: "mpp",
        size: 0.08
      },
      {
        id: "monolit_ps1",
        name: "Монолит ПС",
        symbol: "monolit_ps1",
        size: 0.08
      }
    ]
  },
  {
    id: "infrastructure",
    name: "Инфраструктура и Ориентиры",
    symbols: [
      {
        id: "elektrostantsiya",
        name: "Электростанция",
        symbol: "elektrostantsiya",
        size: 0.08
      },
      {
        id: "podstantsiya",
        name: "Подстанция",
        symbol: "podstantsiya",
        size: 0.08
      },
      {
        id: "telebashnya",
        name: "Телебашня",
        symbol: "telebashnya",
        size: 0.08
      },
      {
        id: "shahta",
        name: "Шахта",
        symbol: "shahta",
        size: 0.08
      },
      {
        id: "shahta_zakrytaya",
        name: "Шахта закрытая",
        symbol: "shahta_zakrytaya",
        size: 0.08
      },
      {
        id: "zavod",
        name: "Завод",
        symbol: "zavod",
        size: 0.08
      },
      {
        id: "zavod_bez_truby",
        name: "Завод без трубы",
        symbol: "zavod_bez_truby",
        size: 0.08
      },
      {
        id: "truba",
        name: "Заводская труба",
        symbol: "truba",
        size: 0.08
      },
      {
        id: "terrikon",
        name: "Террикон",
        symbol: "terrikon",
        size: 0.08
      },
      {
        id: "emkost",
        name: "Резервуар / Емкость",
        symbol: "emkost",
        size: 0.08
      },
      {
        id: "hlebozavod",
        name: "Хлебозавод",
        symbol: "hlebozavod",
        size: 0.08
      },
      {
        id: "teplitsa",
        name: "Теплица",
        symbol: "teplitsa",
        size: 0.08
      },
      {
        id: "tserkov",
        name: "Храм / Церковь",
        symbol: "tserkov",
        size: 0.08
      },
      {
        id: "pamyatnik",
        name: "Памятник",
        symbol: "pamyatnik",
        size: 0.08
      },
      {
        id: "derevo",
        name: "Дерево (ориентир)",
        symbol: "derevo",
        size: 0.08
      },
      {
        id: "meteopost",
        name: "Метеопост",
        symbol: "meteopost",
        size: 0.08
      }
    ]
  },
  {
    id: "misc",
    name: "Цели, Подразделения и Разное",
    symbols: [
      {
        id: "tsel",
        name: "Цель общ.",
        symbol: "tsel",
        size: 0.08
      },
      {
        id: "odinochnaya_tsel",
        name: "Одиночная цель",
        symbol: "odinochnaya_tsel",
        size: 0.08
      },
      {
        id: "tochka",
        name: "Точка (ориентир)",
        symbol: "tochka",
        size: 0.08
      },
      {
        id: "treugolnik",
        name: "Треугольник (пункт)",
        symbol: "treugolnik",
        size: 0.08
      },
      {
        id: "puod",
        name: "ПУОД",
        symbol: "puod",
        size: 0.08
      },
      {
        id: "ahmat",
        name: "Подразд. «Ахмат»",
        symbol: "ahmat",
        size: 0.08
      },
      {
        id: "gus",
        name: "ГУС",
        symbol: "gus",
        size: 0.08
      },
      {
        id: "gus_zasch",
        name: "ГУС защищенный",
        symbol: "gus_zasch",
        size: 0.08
      },
      {
        id: "vdv",
        name: "Символ ВДВ",
        symbol: "vdv",
        size: 0.08
      },
      {
        id: "kazarma",
        name: "kazarma",
        symbol: "kazarma",
        size: 0.08
      },
      {
        id: "pt1",
        name: "pt1",
        symbol: "pt1",
        size: 0.08
      },
      {
        id: "ur_pr1",
        name: "ur_pr1",
        symbol: "ur_pr1",
        size: 0.08
      }
    ]
  }
];
