import os
import xml.etree.ElementTree as ET
import json
import re

ASU_CLASSIFIER = r'F:\Vanya\asu_2\_map_item_classifier.xml'
SYMBOLS_DIR = r'F:\Vanya\topos\public\symbols'
OUTPUT_TS = r'F:\Vanya\topos\src\app\features\map-view\consts\tactical-symbols.const.ts'

CATEGORY_MAP = {
    'Центурион-2': ('armor', 'Бронетехника и Вооружение'),
    'Техника': ('armor', 'Бронетехника и Автомобили'),
    'Пункты управления': ('command_comm', 'Пункты управления и Штабы'),
    'Связь': ('command_comm', 'Связь и Радиотехника'),
    'ПВО': ('air_defense_drones', 'ПВО и РЛС'),
    'Авиация': ('aviation_drones', 'Авиация и Вертолеты'),
    'Артиллерия': ('artillery', 'Артиллерия и Минометы'),
    'Пехота': ('infantry', 'Пехота и Специальные подразделения'),
    'Инженерные': ('fortification_ussr', 'Инженерные сооружения и Заграждения'),
    'Фортификация': ('fortification_ussr', 'Фортификационные сооружения'),
    'Медицина': ('medical', 'Медицинская служба'),
    'Тыл': ('rear_medical', 'Тыл и Обеспечение'),
    'Разведка': ('reconnaissance', 'Разведка и Наблюдение')
}

def clean_name(s):
    if not s:
        return ''
    s = s.replace('\n', ' ').strip()
    return re.sub(r'\s+', ' ', s)

def main():
    existing_svgs = set([os.path.splitext(f)[0] for f in os.listdir(SYMBOLS_DIR) if f.endswith('.svg')])

    tree = ET.parse(ASU_CLASSIFIER)
    root = tree.getroot()

    categories_dict = {}

    def get_or_create_cat(cid, cname):
        if cid not in categories_dict:
            categories_dict[cid] = {
                'id': cid,
                'name': cname,
                'symbols': []
            }
        return categories_dict[cid]

    for group_el in root.iter('group'):
        group_name = group_el.attrib.get('name', '')
        
        target_cat_id = 'other'
        target_cat_name = 'Прочие тактические знаки'
        
        for key, (cid, cname) in CATEGORY_MAP.items():
            if key.lower() in group_name.lower():
                target_cat_id = cid
                target_cat_name = cname
                break
                
        cat = get_or_create_cat(target_cat_id, target_cat_name)
        
        for type_el in group_el.findall('type'):
            name = clean_name(type_el.attrib.get('name', ''))
            src = type_el.attrib.get('src', '')
            tid = type_el.attrib.get('id', '')
            
            if not name or not src:
                continue
                
            icon_id = os.path.splitext(src)[0]
            if icon_id in existing_svgs:
                if not any(s['id'] == icon_id or s['symbol'] == icon_id for s in cat['symbols']):
                    cat['symbols'].append({
                        'id': icon_id,
                        'name': name,
                        'symbol': icon_id,
                        'size': 0.08
                    })

    med_cat = get_or_create_cat('medical', 'Медицинская служба')
    if not any(s['id'] == 'med_mp' for s in med_cat['symbols']):
        med_cat['symbols'].insert(0, {
            'id': 'med_mp',
            'name': 'МП',
            'symbol': 'med_mp',
            'size': 0.08
        })

    cmd_cat = get_or_create_cat('command_comm', 'Пункты управления и Штабы')
    if not any(s['id'] == 'patrol_pair' for s in cmd_cat['symbols']):
        cmd_cat['symbols'].insert(0, {
            'id': 'patrol_pair',
            'name': 'Парный патруль',
            'symbol': 'patrol_pair',
            'size': 0.08,
            'hasPatrol': True,
            'patrolStyle': 'solid',
            'patrolLength': 200,
            'patrolAngle': 0
        })

    for cid in list(categories_dict.keys()):
        if len(categories_dict[cid]['symbols']) == 0:
            del categories_dict[cid]

    ts_content = f'''export interface TacticalSymbol {{
  id: string;
  name: string;
  symbol: string;
  size?: number;
  hasPatrol?: boolean;
  patrolStyle?: 'solid' | 'dashed';
  patrolLength?: number;
  patrolAngle?: number;
}}

export interface SymbolCategory {{
  id: string;
  name: string;
  symbols: TacticalSymbol[];
}}

export const TACTICAL_SYMBOLS: SymbolCategory[] = {json.dumps(list(categories_dict.values()), ensure_ascii=False, indent=2)};
'''

    with open(OUTPUT_TS, 'w', encoding='utf-8') as f:
        f.write(ts_content)

    total_symbols = sum(len(c['symbols']) for c in categories_dict.values())
    print(f"Generated tactical-symbols.const.ts with {len(categories_dict)} categories and {total_symbols} symbols.")

if __name__ == '__main__':
    main()
