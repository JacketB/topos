import xml.etree.ElementTree as ET
import re

tree = ET.parse(r'F:\Vanya\asu_2\_map_item_classifier.xml')
root = tree.getroot()

with open(r'F:\Vanya\topos\src\app\features\map-view\consts\tactical-symbols.const.ts', 'r', encoding='utf-8') as f:
    ts_code = f.read()

existing_ids = set(re.findall(r'id:\s*["\']([^"\']+)["\']', ts_code))
print(f'Existing IDs in Topos: {len(existing_ids)}')

candidates = {}

for g in root.iter('group'):
    gname = g.attrib.get('name', 'Прочие')
    for t in g.findall('type'):
        tid = t.attrib.get('id')
        name = t.attrib.get('name')
        src = t.attrib.get('src')
        if name and src:
            icon_id = src.replace('.xml', '')
            if icon_id not in existing_ids and tid not in existing_ids:
                if gname not in candidates:
                    candidates[gname] = []
                if not any(c['icon'] == icon_id for c in candidates[gname]):
                    candidates[gname].append({'name': name.replace('\n', ' ').strip(), 'icon': icon_id})

output = []
for gname, items in sorted(candidates.items(), key=lambda x: len(x[1]), reverse=True):
    if items:
        output.append(f'### {gname} ({len(items)} знаков)')
        for it in items[:12]:
            output.append(f"- **{it['name']}** (`{it['icon']}`)")
        if len(items) > 12:
            output.append(f"- *... и еще {len(items)-12} знаков*")
        output.append('')

with open(r'F:\Vanya\topos\scripts\audit_result.txt', 'w', encoding='utf-8') as out:
    out.write('\n'.join(output))

print('Audit completed! Results saved in scripts/audit_result.txt')
