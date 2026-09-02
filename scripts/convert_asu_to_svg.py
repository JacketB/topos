import os
import xml.etree.ElementTree as ET
import glob
import re

ASU_DIR = r'F:\Vanya\asu_2'
OUTPUT_DIR = r'F:\Vanya\topos\public\symbols'

ORIGINAL_CORE_SYMBOLS = {
    'tank_svoy_1', 'rs_tank', 'bmp_svoy1', 'btr_svoy1', 'brdm1', 'brm', 'bmd', 'avto1',
    'automobile_gruz', 'tank_bulldozer', 'tank_Mtral', 'tank_PTS',
    'art_svoya1', 'art1', 'sau', 'sau_batar', 'sau_vzvod', 'mortar', 'minomet_m',
    'mortar_batar', 'mortar_vzvod', 'bmrszo', 'bmrszo_batar', 'bmrszo_vzvod', 'ags',
    'ptrk_m', 'artillery_at', 'art_op_svoya_1', 'art_polukaponir_1', 'art_rls',
    'missile_launcher_anti_air', 'anti_aircraft_system', 'zsu', 'zsu_radar', 'aa_cannon',
    'anti_air_close_range', 'anti_air_mid_range', 'anti_air_long_range', 'rls', 'rlsn',
    'rls_group', 'bolshoy_bla1', 'uav', 'uav_helicopter', 'reb_station',
    'plane', 'plane_fighter', 'plane_bomber', 'plane_fighter_bomber',
    'plane_electronic_intelligence', 'helicopter', 'helicopter_shock',
    'rescue_helicopter', 'aviaudar', 'aviaudar_pr',
    'patrol_pair', 'rknp', 'knp', 'knp_bat', 'knpbatr', 'knpbatr_peredv1',
    'knp_peredv1', 'knp_prot', 'knpb', 'knpd', 'np', 'anp', 'sopr_np', 'zvuk_np',
    'zvuk_np_pr', 'pan', 'pna', 'skp', 'kshm4', 'uzel_sv_st', 'radio_st_mobile',
    'radio_st_perenos', 'radio_rrs',
    'group_i', 'man', 'man_leader', 'man_sniper', 'sniper_pos', 'man_medic', 'ahmat',
    'scout', 'dozor', 'patrol', 'ambush_pos',
    'fort_tank_trench', 'fort_bmp_trench', 'fort_art_trench', 'fort_blindage',
    'blindazh', 'blindazh_legk', 'blindazh_zhb', 'fort_shelter_kvs_u', 'fort_shelter_kvs_a',
    'fort_trench_shelter', 'fort_dot', 'dot_tipovoy1', 'fort_dzot', 'fort_knp',
    'fort_fake_trench', 'comm_open_line', 'comm_covered_line',
    'minefield_at', 'minefield_ap', 'minefield_mixed', 'dist_mp_pt', 'dist_mp_pp',
    'dist_mp_smesh', 'fugas', 'fugas_upr', 'fugas_radio', 'wirefence', 'fence', 'bridge_point',
    'med_mp', 'med_punkt', 'automobile_med', 'hospital', 'gosp_polevoy', 'gosp_stats',
    'grazhd_bolnitsa',
    'storage', 'storage_fuel', 'storage_asp', 'hlebozavod', 'elektrostantsiya',
    'emkost', 'gus', 'gus_zasch', 'technical_support', 'bannoprachechnyy_kompl'
}

def parse_points(p_str):
    if not p_str:
        return []
    return [float(x) for x in re.split(r'[\s,]+', p_str.strip()) if x]

def convert_single_xml(xml_path):
    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()
    except Exception:
        return None

    geoms = []

    for el in root.iter():
        tag = el.tag
        if el.attrib.get('destroyed') == '1':
            continue
        if el.attrib.get('color') == 'opposite' and tag == 'cross':
            continue

        p = parse_points(el.attrib.get('p', ''))
        stroke = el.attrib.get('color', 'currentColor')
        if stroke in ['0', 'black', '#0f172a', 'opposite']:
            stroke = 'currentColor'

        if tag == 'line' and len(p) >= 4:
            geoms.append(('line', (p[0], p[1], p[2], p[3]), stroke))
        elif tag == 'rect' and len(p) >= 4:
            geoms.append(('rect', (min(p[0], p[2]), min(p[1], p[3]), abs(p[2]-p[0]), abs(p[3]-p[1])), stroke))
        elif tag == 'circle' and len(p) >= 3:
            geoms.append(('circle', (p[0], p[1], p[2]), stroke))
        elif tag == 'rhombus' and len(p) >= 4:
            cx = (p[0] + p[2]) / 2
            cy = (p[1] + p[3]) / 2
            geoms.append(('poly', [(cx, p[1]), (p[2], cy), (cx, p[3]), (p[0], cy)], stroke))
        elif tag == 'triangle' and len(p) >= 4:
            cx = (p[0] + p[2]) / 2
            geoms.append(('poly', [(cx, p[1]), (p[2], p[3]), (p[0], p[3])], stroke))
        elif tag == 'triangle' and len(p) >= 6:
            geoms.append(('poly', [(p[0], p[1]), (p[2], p[3]), (p[4], p[5])], stroke))
        elif tag == 'poly' and len(p) >= 4:
            pts = [(p[i], p[i+1]) for i in range(0, len(p)-1, 2)]
            geoms.append(('poly', pts, stroke))
        elif tag == 'ellipse' and len(p) >= 4:
            cx = (p[0] + p[2]) / 2
            cy = (p[1] + p[3]) / 2
            geoms.append(('ellipse', (cx, cy, abs(p[2]-p[0])/2, abs(p[3]-p[1])/2), stroke))
        elif tag == 'path':
            path_cmds = []
            for child in el:
                cp = parse_points(child.attrib.get('p', ''))
                ctag = child.tag
                if ctag == 'lineto' and len(cp) >= 2:
                    path_cmds.append(('L', cp[0], cp[1]))
                elif ctag == 'cubicto' and len(cp) >= 6:
                    path_cmds.append(('C', cp[0], cp[1], cp[2], cp[3], cp[4], cp[5]))
                elif ctag == 'quadto' and len(cp) >= 4:
                    path_cmds.append(('Q', cp[0], cp[1], cp[2], cp[3]))
            if path_cmds:
                geoms.append(('path', path_cmds, stroke))

    if not geoms:
        return None

    min_x, min_y, max_x, max_y = 1e9, 1e9, -1e9, -1e9
    def upd(x, y):
        nonlocal min_x, min_y, max_x, max_y
        min_x = min(min_x, x); min_y = min(min_y, y)
        max_x = max(max_x, x); max_y = max(max_y, y)

    for gtype, data, _ in geoms:
        if gtype == 'line':
            upd(data[0], data[1]); upd(data[2], data[3])
        elif gtype == 'rect':
            upd(data[0], data[1]); upd(data[0]+data[2], data[1]+data[3])
        elif gtype == 'circle':
            upd(data[0]-data[2], data[1]-data[2]); upd(data[0]+data[2], data[1]+data[2])
        elif gtype == 'poly':
            for pt in data: upd(pt[0], pt[1])
        elif gtype == 'ellipse':
            upd(data[0]-data[2], data[1]-data[3]); upd(data[0]+data[2], data[1]+data[3])
        elif gtype == 'path':
            for cmd in data:
                if cmd[0] == 'L': upd(cmd[1], cmd[2])
                elif cmd[0] == 'C':
                    upd(cmd[1], cmd[2]); upd(cmd[3], cmd[4]); upd(cmd[5], cmd[6])
                elif cmd[0] == 'Q':
                    upd(cmd[1], cmd[2]); upd(cmd[3], cmd[4])

    bw = max_x - min_x
    bh = max_y - min_y
    if bw <= 0.01 or bh <= 0.01:
        return None

    target_canvas = 512.0
    target_box = 400.0
    scale = target_box / max(bw, bh)

    cx_box = (min_x + max_x) / 2.0
    cy_box = (min_y + max_y) / 2.0
    offset_x = (target_canvas / 2.0) - (cx_box * scale)
    offset_y = (target_canvas / 2.0) - (cy_box * scale)

    def tx(x): return x * scale + offset_x
    def ty(y): return y * scale + offset_y

    stroke_w = max(16.0, 2.0 * scale)
    svg_elems = []

    for gtype, data, stroke in geoms:
        if gtype == 'line':
            svg_elems.append(f'<line x1="{tx(data[0]):.1f}" y1="{ty(data[1]):.1f}" x2="{tx(data[2]):.1f}" y2="{ty(data[3]):.1f}" stroke="{stroke}" stroke-width="{stroke_w:.1f}" stroke-linecap="round"/>')
        elif gtype == 'rect':
            rx, ry, rw, rh = tx(data[0]), ty(data[1]), data[2]*scale, data[3]*scale
            svg_elems.append(f'<rect x="{rx:.1f}" y="{ry:.1f}" width="{rw:.1f}" height="{rh:.1f}" fill="none" stroke="{stroke}" stroke-width="{stroke_w:.1f}" stroke-linejoin="round"/>')
        elif gtype == 'circle':
            cx, cy, r = tx(data[0]), ty(data[1]), data[2]*scale
            svg_elems.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="none" stroke="{stroke}" stroke-width="{stroke_w:.1f}"/>')
        elif gtype == 'poly':
            pts_str = ' '.join([f'{tx(p[0]):.1f},{ty(p[1]):.1f}' for p in data])
            svg_elems.append(f'<polygon points="{pts_str}" fill="none" stroke="{stroke}" stroke-width="{stroke_w:.1f}" stroke-linejoin="round"/>')
        elif gtype == 'ellipse':
            cx, cy, rx, ry = tx(data[0]), ty(data[1]), data[2]*scale, data[3]*scale
            svg_elems.append(f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="{rx:.1f}" ry="{ry:.1f}" fill="none" stroke="{stroke}" stroke-width="{stroke_w:.1f}"/>')
        elif gtype == 'path':
            d_parts = []
            for idx, cmd in enumerate(data):
                if idx == 0:
                    d_parts.append(f'M {tx(cmd[1]):.1f} {ty(cmd[2]):.1f}')
                if cmd[0] == 'L':
                    d_parts.append(f'L {tx(cmd[1]):.1f} {ty(cmd[2]):.1f}')
                elif cmd[0] == 'C':
                    d_parts.append(f'C {tx(cmd[1]):.1f} {ty(cmd[2]):.1f}, {tx(cmd[3]):.1f} {ty(cmd[4]):.1f}, {tx(cmd[5]):.1f} {ty(cmd[6]):.1f}')
                elif cmd[0] == 'Q':
                    d_parts.append(f'Q {tx(cmd[1]):.1f} {ty(cmd[2]):.1f}, {tx(cmd[3]):.1f} {ty(cmd[4]):.1f}')
            d_str = ' '.join(d_parts)
            svg_elems.append(f'<path d="{d_str}" fill="none" stroke="{stroke}" stroke-width="{stroke_w:.1f}" stroke-linejoin="round" stroke-linecap="round"/>')

    res = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="currentColor">\n  ' + '\n  '.join(svg_elems) + '\n</svg>'
    return res

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    xml_files = glob.glob(os.path.join(ASU_DIR, '*.xml'))
    converted = 0

    for xml_file in xml_files:
        base = os.path.basename(xml_file)
        if base.startswith('_'):
            continue
        name_no_ext = os.path.splitext(base)[0]
        if name_no_ext in ORIGINAL_CORE_SYMBOLS:
            continue

        svg_str = convert_single_xml(xml_file)
        if svg_str:
            svg_filename = name_no_ext + '.svg'
            svg_path = os.path.join(OUTPUT_DIR, svg_filename)
            with open(svg_path, 'w', encoding='utf-8') as f:
                f.write(svg_str)
            converted += 1

    print(f"Standardized conversion complete. Converted {converted} symbols to 512x512 with clean lines.")

if __name__ == '__main__':
    main()
