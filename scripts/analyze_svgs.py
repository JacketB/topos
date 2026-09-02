import re
import os

with open(r'F:\Vanya\topos\src\app\features\map-view\consts\tactical-symbols.const.ts', 'r', encoding='utf-8') as f:
    code = f.read()

symbols = re.findall(r'symbol:\s*["\']([^"\']+)["\']', code)
print(f'Total symbols in constant: {len(symbols)}')

missing = []
stats = {}
for s in set(symbols):
    p = os.path.join(r'F:\Vanya\topos\public\symbols', s + '.svg')
    if os.path.exists(p):
        with open(p, 'r', encoding='utf-8') as f:
            txt = f.read()
        vb_match = re.search(r'viewBox=["\']([^"\']+)["\']', txt)
        w_match = re.search(r'width=["\']([^"\']+)["\']', txt)
        h_match = re.search(r'height=["\']([^"\']+)["\']', txt)
        stroke_match = re.findall(r'stroke-width=["\']([^"\']+)["\']', txt)
        color_match = re.findall(r'stroke=["\']([^"\']+)["\']', txt)
        fill_match = re.findall(r'fill=["\']([^"\']+)["\']', txt)

        vb = vb_match.group(1) if vb_match else 'None'
        w = w_match.group(1) if w_match else 'None'
        sw = stroke_match[0] if stroke_match else 'None'
        col = color_match[0] if color_match else 'None'
        fill = fill_match[0] if fill_match else 'None'

        stats[s] = {'vb': vb, 'w': w, 'sw': sw, 'col': col, 'fill': fill}
    else:
        missing.append(s)

print(f'Missing symbols count: {len(missing)}')
if missing:
    print(f'Missing: {missing}')

vb_groups = {}
for s, st in stats.items():
    key = (st['vb'], st['w'], st['sw'])
    vb_groups.setdefault(key, []).append(s)

print('--- ViewBox & Width Groups ---')
for k, v in vb_groups.items():
    print(f'Group {k}: {len(v)} symbols. Example: {v[:4]}')
    if k[2] not in ('16', '16.0'):
        print(f'  -> All in {k[2]}: {v}')

