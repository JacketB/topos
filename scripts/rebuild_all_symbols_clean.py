import os
import glob
import re
import xml.etree.ElementTree as ET

ASU2_DIR = r'F:\Vanya\asu_2'
SYMBOLS_DIR = r'F:\Vanya\topos\public\symbols'

def parse_points(p_str):
    if not p_str: return []
    return [float(x) for x in re.split(r'[\s,]+', p_str.strip()) if x]

def convert_asu_xml_to_svg(xml_path):
    try:
        tree = ET.parse(xml_path)
    except Exception:
        return None
    root = tree.getroot()
    
    geoms = []
    
    for el in root.iter():
        tag = el.tag
        if el.attrib.get('destroyed') == '1':
            continue
        if el.attrib.get('color') == 'opposite' and tag == 'cross':
            continue
        
        p = parse_points(el.attrib.get('p', ''))
        if tag == 'line' and len(p) >= 4:
            geoms.append(('line', (p[0], p[1], p[2], p[3])))
        elif tag == 'rect' and len(p) >= 4:
            geoms.append(('rect', (min(p[0], p[2]), min(p[1], p[3]), abs(p[2]-p[0]), abs(p[3]-p[1]))))
        elif tag == 'circle' and len(p) >= 3:
            geoms.append(('circle', (p[0], p[1], p[2])))
        elif tag == 'rhombus' and len(p) >= 4:
            cx = (p[0] + p[2]) / 2.0
            cy = (p[1] + p[3]) / 2.0
            geoms.append(('poly', [(cx, p[1]), (p[2], cy), (cx, p[3]), (p[0], cy)]))
        elif tag == 'triangle' and len(p) >= 4:
            cx = (p[0] + p[2]) / 2.0
            geoms.append(('poly', [(cx, p[1]), (p[2], p[3]), (p[0], p[3])]))
        elif tag == 'triangle' and len(p) >= 6:
            geoms.append(('poly', [(p[0], p[1]), (p[2], p[3]), (p[4], p[5])]))
        elif tag == 'poly' and len(p) >= 4:
            pts = [(p[i], p[i+1]) for i in range(0, len(p)-1, 2)]
            geoms.append(('poly', pts))
        elif tag == 'ellipse' and len(p) >= 4:
            cx = (p[0] + p[2]) / 2.0
            cy = (p[1] + p[3]) / 2.0
            geoms.append(('ellipse', (cx, cy, abs(p[2]-p[0])/2.0, abs(p[3]-p[1])/2.0)))
        elif tag == 'arrow' and len(p) >= 4:
            geoms.append(('line', (p[0], p[1], p[2], p[3])))
            geoms.append(('poly', [(p[2], p[3]), (p[2]-6, p[3]-3), (p[2]-6, p[3]+3)]))
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
                geoms.append(('path', path_cmds))
                
    if not geoms:
        return None
    
    min_x, min_y, max_x, max_y = 1e9, 1e9, -1e9, -1e9
    def upd(x, y):
        nonlocal min_x, min_y, max_x, max_y
        min_x = min(min_x, x); min_y = min(min_y, y)
        max_x = max(max_x, x); max_y = max(max_y, y)
        
    for gtype, data in geoms:
        if gtype == 'line':
            upd(data[0], data[1]); upd(data[2], data[3])
        elif gtype == 'rect':
            upd(data[0], data[1]); upd(data[0]+data[2], data[1]+data[3])
        elif gtype == 'circle':
            upd(data[0]-data[2], data[1]-data[2]); upd(data[0]+data[2], data[1]+data[2])
        elif gtype == 'poly':
            for pt in data:
                upd(pt[0], pt[1])
        elif gtype == 'ellipse':
            upd(data[0]-data[2], data[1]-data[3]); upd(data[0]+data[2], data[1]+data[3])
        elif gtype == 'path':
            for cmd in data:
                if cmd[0] == 'L':
                    upd(cmd[1], cmd[2])
                elif cmd[0] == 'C':
                    upd(cmd[1], cmd[2]); upd(cmd[3], cmd[4]); upd(cmd[5], cmd[6])
                elif cmd[0] == 'Q':
                    upd(cmd[1], cmd[2]); upd(cmd[3], cmd[4])
                
    bw, bh = max_x - min_x, max_y - min_y
    if bw <= 0.01 or bh <= 0.01:
        return None
    
    target_box = 340.0
    scale = target_box / max(bw, bh)
    cx = (min_x + max_x) / 2.0
    cy = (min_y + max_y) / 2.0
    offset_x = 256.0 - (cx * scale)
    offset_y = 256.0 - (cy * scale)
    
    def tx(x): return x * scale + offset_x
    def ty(y): return y * scale + offset_y
    
    stroke_w = 16.0
    svg_elems = []
    
    for gtype, data in geoms:
        if gtype == 'line':
            svg_elems.append(f'<line x1="{tx(data[0]):.1f}" y1="{ty(data[1]):.1f}" x2="{tx(data[2]):.1f}" y2="{ty(data[3]):.1f}" stroke="#ef4444" stroke-width="{stroke_w}" stroke-linecap="round"/>')
        elif gtype == 'rect':
            rx, ry, rw, rh = tx(data[0]), ty(data[1]), data[2]*scale, data[3]*scale
            svg_elems.append(f'<rect x="{rx:.1f}" y="{ry:.1f}" width="{rw:.1f}" height="{rh:.1f}" fill="none" stroke="#ef4444" stroke-width="{stroke_w}" stroke-linejoin="round"/>')
        elif gtype == 'circle':
            cx_c, cy_c, r = tx(data[0]), ty(data[1]), data[2]*scale
            svg_elems.append(f'<circle cx="{cx_c:.1f}" cy="{cy_c:.1f}" r="{r:.1f}" fill="none" stroke="#ef4444" stroke-width="{stroke_w}"/>')
        elif gtype == 'poly':
            pts_str = ' '.join([f'{tx(p[0]):.1f},{ty(p[1]):.1f}' for p in data])
            svg_elems.append(f'<polygon points="{pts_str}" fill="none" stroke="#ef4444" stroke-width="{stroke_w}" stroke-linejoin="round" stroke-linecap="round"/>')
        elif gtype == 'ellipse':
            cx_e, cy_e, rx, ry = tx(data[0]), ty(data[1]), data[2]*scale, data[3]*scale
            svg_elems.append(f'<ellipse cx="{cx_e:.1f}" cy="{cy_e:.1f}" rx="{rx:.1f}" ry="{ry:.1f}" fill="none" stroke="#ef4444" stroke-width="{stroke_w}"/>')
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
            svg_elems.append(f'<path d="{d_str}" fill="none" stroke="#ef4444" stroke-width="{stroke_w}" stroke-linejoin="round" stroke-linecap="round"/>')
            
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">\n  ' + '\n  '.join(svg_elems) + '\n</svg>'

CUSTOM_SYMBOLS = {
    'fpv_drone': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <line x1="120" y1="120" x2="392" y2="392" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="120" y1="392" x2="392" y2="120" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <rect x="226" y="196" width="60" height="120" rx="16" fill="none" stroke="#ef4444" stroke-width="16"/>
  <circle cx="120" cy="120" r="54" fill="none" stroke="#ef4444" stroke-width="16"/>
  <circle cx="392" cy="120" r="54" fill="none" stroke="#ef4444" stroke-width="16"/>
  <circle cx="120" cy="392" r="54" fill="none" stroke="#ef4444" stroke-width="16"/>
  <circle cx="392" cy="392" r="54" fill="none" stroke="#ef4444" stroke-width="16"/>
  <polygon points="256,120 236,170 276,170" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round"/>
</svg>''',

    'mavic3': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <rect x="216" y="176" width="80" height="160" rx="20" fill="none" stroke="#ef4444" stroke-width="16"/>
  <line x1="216" y1="206" x2="116" y2="136" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="296" y1="206" x2="396" y2="136" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="216" y1="306" x2="116" y2="376" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="296" y1="306" x2="396" y2="376" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <circle cx="116" cy="136" r="60" fill="none" stroke="#ef4444" stroke-width="16"/>
  <circle cx="396" cy="136" r="60" fill="none" stroke="#ef4444" stroke-width="16"/>
  <circle cx="116" cy="376" r="60" fill="none" stroke="#ef4444" stroke-width="16"/>
  <circle cx="396" cy="376" r="60" fill="none" stroke="#ef4444" stroke-width="16"/>
  <circle cx="256" cy="226" r="16" fill="none" stroke="#ef4444" stroke-width="16"/>
</svg>''',

    'orlan10': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <polygon points="256,60 274,380 256,440 238,380" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round"/>
  <path d="M 40 250 L 256 220 L 472 250 L 452 280 L 256 260 L 60 280 Z" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round"/>
  <polygon points="256,380 340,430 320,450 256,420 192,450 172,430" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round"/>
</svg>''',

    'bolshoy_bla1': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <path d="M 256 40 C 270 40 280 180 280 370 L 320 440 L 256 430 L 192 440 L 232 370 C 232 180 242 40 256 40 Z" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round"/>
  <polygon points="30,220 256,190 482,220 472,260 256,236 40,260" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round"/>
  <polygon points="256,390 350,446 330,466 256,440 182,466 162,446" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round"/>
  <line x1="220" y1="440" x2="292" y2="440" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
</svg>''',

    'malyy_bla1': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <path d="M 256 80 L 460 290 L 360 290 L 256 230 L 152 290 L 52 290 Z" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round" stroke-linecap="round"/>
  <polygon points="256,100 270,390 256,430 242,390" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round"/>
  <circle cx="256" cy="200" r="20" fill="none" stroke="#ef4444" stroke-width="16"/>
</svg>''',

    'uav': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <path d="M 256 60 C 270 60 280 200 280 380 L 256 440 L 232 380 C 232 200 242 60 256 60 Z" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round"/>
  <path d="M 40 230 L 256 200 L 472 230 L 452 265 L 256 240 L 60 265 Z" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round"/>
  <line x1="200" y1="420" x2="312" y2="420" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
</svg>''',

    'uav_helicopter': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <ellipse cx="216" cy="286" rx="120" ry="70" fill="none" stroke="#ef4444" stroke-width="16"/>
  <path d="M 326 286 L 456 260 L 456 210" fill="none" stroke="#ef4444" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="216" y1="216" x2="216" y2="156" stroke="#ef4444" stroke-width="16"/>
  <line x1="76" y1="156" x2="356" y2="156" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="136" y1="356" x2="136" y2="396" stroke="#ef4444" stroke-width="16"/>
  <line x1="276" y1="356" x2="276" y2="396" stroke="#ef4444" stroke-width="16"/>
  <line x1="96" y1="396" x2="316" y2="396" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <circle cx="456" cy="210" r="30" fill="none" stroke="#ef4444" stroke-width="16"/>
</svg>''',

    'start_bla': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <line x1="80" y1="412" x2="432" y2="412" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="120" y1="412" x2="372" y2="140" stroke="#ef4444" stroke-width="18" stroke-linecap="round"/>
  <line x1="250" y1="274" x2="250" y2="412" stroke="#ef4444" stroke-width="16"/>
  <polygon points="372,140 330,155 350,195" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round"/>
  <path d="M 330 185 L 420 100 L 400 160 Z" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round"/>
</svg>''',

    'drone_control_room': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <rect x="90" y="210" width="332" height="200" rx="16" fill="none" stroke="#ef4444" stroke-width="16"/>
  <line x1="256" y1="210" x2="256" y2="90" stroke="#ef4444" stroke-width="16"/>
  <path d="M 196 90 A 60 60 0 0 1 316 90" fill="none" stroke="#ef4444" stroke-width="16"/>
  <line x1="196" y1="90" x2="316" y2="90" stroke="#ef4444" stroke-width="16"/>
  <circle cx="256" cy="50" r="14" fill="none" stroke="#ef4444" stroke-width="16"/>
  <circle cx="160" cy="410" r="28" fill="none" stroke="#ef4444" stroke-width="16"/>
  <circle cx="352" cy="410" r="28" fill="none" stroke="#ef4444" stroke-width="16"/>
</svg>''',

    'med_mp': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <polygon points="256,40 480,440 32,440" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round" stroke-linecap="round" />
  <line x1="256" y1="210" x2="256" y2="390" stroke="#ef4444" stroke-width="16" stroke-linecap="round" />
  <line x1="166" y1="300" x2="346" y2="300" stroke="#ef4444" stroke-width="16" stroke-linecap="round" />
</svg>''',

    'med_avto1': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <rect x="80" y="160" width="352" height="220" rx="16" fill="none" stroke="#ef4444" stroke-width="16"/>
  <line x1="256" y1="210" x2="256" y2="330" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="196" y1="270" x2="316" y2="270" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <circle cx="150" cy="380" r="30" fill="none" stroke="#ef4444" stroke-width="16"/>
  <circle cx="362" cy="380" r="30" fill="none" stroke="#ef4444" stroke-width="16"/>
</svg>''',

    'gosp_polevoy': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <rect x="64" y="140" width="384" height="260" rx="16" fill="none" stroke="#ef4444" stroke-width="16"/>
  <line x1="256" y1="190" x2="256" y2="350" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="176" y1="270" x2="336" y2="270" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
</svg>''',

    'gosp_stats': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <rect x="64" y="120" width="384" height="280" rx="16" fill="none" stroke="#ef4444" stroke-width="16"/>
  <line x1="256" y1="180" x2="256" y2="340" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="176" y1="260" x2="336" y2="260" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="64" y1="120" x2="256" y2="40" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="256" y1="40" x2="448" y2="120" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
</svg>''',

    'grazhd_bolnitsa': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <rect x="96" y="96" width="320" height="320" rx="16" fill="none" stroke="#ef4444" stroke-width="16"/>
  <line x1="256" y1="160" x2="256" y2="352" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="160" y1="256" x2="352" y2="256" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
</svg>''',

    'med_rota': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <polygon points="256,60 460,420 52,420" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round"/>
  <line x1="256" y1="200" x2="256" y2="360" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="176" y1="280" x2="336" y2="280" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="256" y1="60" x2="256" y2="20" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
</svg>''',

    'med_bat': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <polygon points="256,60 460,420 52,420" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round"/>
  <line x1="256" y1="200" x2="256" y2="360" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="176" y1="280" x2="336" y2="280" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="236" y1="60" x2="236" y2="20" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="276" y1="60" x2="276" y2="20" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
</svg>''',

    'med_otryad': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <polygon points="256,60 460,420 52,420" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round"/>
  <line x1="256" y1="200" x2="256" y2="360" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="176" y1="280" x2="336" y2="280" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="216" y1="60" x2="216" y2="20" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="256" y1="60" x2="256" y2="20" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="296" y1="60" x2="296" y2="20" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
</svg>''',

    'patrol_pair': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <circle cx="180" cy="200" r="60" fill="none" stroke="#ef4444" stroke-width="16"/>
  <circle cx="332" cy="200" r="60" fill="none" stroke="#ef4444" stroke-width="16"/>
  <line x1="180" y1="260" x2="180" y2="380" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="332" y1="260" x2="332" y2="380" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="120" y1="310" x2="392" y2="310" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
</svg>''',

    'tank_svoy_1': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <polygon points="256,80 460,256 256,432 52,256" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round" stroke-linecap="round"/>
  <line x1="52" y1="256" x2="460" y2="256" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="460" y1="256" x2="490" y2="256" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="475" y1="216" x2="475" y2="296" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
</svg>''',

    'rs_tank': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <polygon points="256,80 460,256 256,432 52,256" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round" stroke-linecap="round"/>
  <line x1="52" y1="256" x2="460" y2="256" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="460" y1="256" x2="490" y2="256" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="475" y1="216" x2="475" y2="296" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="200" y1="130" x2="312" y2="130" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
</svg>''',

    'bmp_svoy1': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <polygon points="60,140 380,140 452,256 380,372 60,372" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round" stroke-linecap="round"/>
  <line x1="452" y1="256" x2="492" y2="256" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="472" y1="206" x2="472" y2="306" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="200" y1="140" x2="200" y2="372" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
</svg>''',

    'btr_svoy1': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <polygon points="60,140 380,140 452,256 380,372 60,372" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round" stroke-linecap="round"/>
  <line x1="452" y1="256" x2="492" y2="256" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="472" y1="206" x2="472" y2="306" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
</svg>''',

    'art_svoya1': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <line x1="120" y1="256" x2="400" y2="256" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="170" y1="180" x2="350" y2="180" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="170" y1="332" x2="350" y2="332" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <polygon points="120,200 60,256 120,312" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round" stroke-linecap="round"/>
</svg>''',

    'art1': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <line x1="120" y1="256" x2="400" y2="256" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="170" y1="180" x2="350" y2="180" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="170" y1="332" x2="350" y2="332" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
</svg>''',

    'zrk': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <line x1="120" y1="380" x2="392" y2="380" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <polygon points="256,100 300,380 212,380" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round"/>
  <line x1="180" y1="260" x2="332" y2="260" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
</svg>''',

    'zrk_bl': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <line x1="120" y1="380" x2="392" y2="380" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <polygon points="256,120 290,380 222,380" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round"/>
  <circle cx="256" cy="220" r="40" fill="none" stroke="#ef4444" stroke-width="16"/>
</svg>''',

    'zrk_sredn': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <line x1="120" y1="380" x2="392" y2="380" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <polygon points="256,100 295,380 217,380" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round"/>
  <circle cx="256" cy="220" r="55" fill="none" stroke="#ef4444" stroke-width="16"/>
</svg>''',

    'zrk_daln': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <line x1="120" y1="380" x2="392" y2="380" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <polygon points="256,80 300,380 212,380" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round"/>
  <circle cx="256" cy="220" r="75" fill="none" stroke="#ef4444" stroke-width="16"/>
</svg>''',

    'zen_pulemet': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <line x1="120" y1="380" x2="392" y2="380" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="256" y1="380" x2="256" y2="160" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <polygon points="256,160 216,210 296,210" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round"/>
</svg>''',

    'anti_air_cannon': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <line x1="120" y1="380" x2="392" y2="380" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="256" y1="380" x2="360" y2="140" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <polygon points="360,140 310,165 330,205" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round"/>
</svg>''',

    'fort_tank_trench': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <path d="M 80 180 L 160 332 L 352 332 L 432 180" fill="none" stroke="#ef4444" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="160" y1="332" x2="352" y2="332" stroke="#ef4444" stroke-width="24" stroke-linecap="round"/>
</svg>''',

    'fort_bmp_trench': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <path d="M 90 200 L 160 332 L 352 332 L 422 200" fill="none" stroke="#ef4444" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="190" y1="260" x2="322" y2="260" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
</svg>''',

    'fort_art_trench': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <path d="M 80 256 C 80 350 160 410 256 410 C 352 410 432 350 432 256" fill="none" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="256" y1="256" x2="256" y2="120" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
</svg>''',

    'fort_blindage': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <rect x="120" y="160" width="272" height="192" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round"/>
  <line x1="120" y1="160" x2="392" y2="352" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
</svg>''',

    'blindazh': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <rect x="120" y="160" width="272" height="192" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round"/>
  <line x1="120" y1="160" x2="392" y2="352" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
</svg>''',

    'blindazh_legk': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <rect x="120" y="160" width="272" height="192" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round"/>
  <line x1="120" y1="160" x2="392" y2="352" stroke="#ef4444" stroke-width="16" stroke-linecap="round" stroke-dasharray="16 16"/>
</svg>''',

    'blindazh_zhb': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <rect x="110" y="150" width="292" height="212" fill="none" stroke="#ef4444" stroke-width="24" stroke-linejoin="round"/>
  <line x1="110" y1="150" x2="402" y2="362" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
</svg>''',

    'fort_shelter_kvs_u': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <ellipse cx="256" cy="256" rx="150" ry="110" fill="none" stroke="#ef4444" stroke-width="16"/>
  <line x1="106" y1="256" x2="406" y2="256" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
</svg>''',

    'fort_shelter_kvs_a': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <ellipse cx="256" cy="256" rx="150" ry="110" fill="none" stroke="#ef4444" stroke-width="16"/>
  <line x1="106" y1="256" x2="406" y2="256" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="256" y1="146" x2="256" y2="366" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
</svg>''',

    'fort_trench_shelter': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <line x1="90" y1="256" x2="422" y2="256" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="170" y1="180" x2="170" y2="332" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="342" y1="180" x2="342" y2="332" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
</svg>''',

    'fort_dot': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <circle cx="256" cy="256" r="140" fill="none" stroke="#ef4444" stroke-width="24"/>
  <line x1="180" y1="256" x2="332" y2="256" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
</svg>''',

    'dot_tipovoy1': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <circle cx="256" cy="256" r="140" fill="none" stroke="#ef4444" stroke-width="24"/>
  <line x1="180" y1="256" x2="332" y2="256" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="256" y1="180" x2="256" y2="332" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
</svg>''',

    'fort_dzot': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <circle cx="256" cy="256" r="140" fill="none" stroke="#ef4444" stroke-width="16"/>
  <line x1="180" y1="256" x2="332" y2="256" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
</svg>''',

    'fort_knp': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <circle cx="256" cy="256" r="140" fill="none" stroke="#ef4444" stroke-width="16"/>
  <polygon points="256,156 340,256 172,256" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round"/>
</svg>''',

    'fort_fake_trench': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <path d="M 80 180 L 160 332 L 352 332 L 432 180" fill="none" stroke="#ef4444" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="16 16"/>
</svg>''',

    'comm_open_line': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <path d="M 80 256 L 160 160 L 256 352 L 352 160 L 432 256" fill="none" stroke="#ef4444" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
</svg>''',

    'comm_covered_line': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <path d="M 80 256 L 160 160 L 256 352 L 352 160 L 432 256" fill="none" stroke="#ef4444" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="16 16"/>
</svg>''',

    'fugas': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <circle cx="256" cy="256" r="100" fill="none" stroke="#ef4444" stroke-width="16"/>
  <line x1="256" y1="96" x2="256" y2="416" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="96" y1="256" x2="416" y2="256" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
</svg>''',

    'fugas_upr': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <circle cx="256" cy="256" r="100" fill="none" stroke="#ef4444" stroke-width="16"/>
  <line x1="256" y1="96" x2="256" y2="416" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="96" y1="256" x2="416" y2="256" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="356" y1="256" x2="456" y2="256" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
</svg>''',

    'dist_mp_pt': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <line x1="96" y1="256" x2="416" y2="256" stroke="#ef4444" stroke-width="16" stroke-linecap="round" stroke-dasharray="24 16"/>
  <polygon points="256,170 300,256 256,342 212,256" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round"/>
</svg>''',

    'dist_mp_pp': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <line x1="96" y1="256" x2="416" y2="256" stroke="#ef4444" stroke-width="16" stroke-linecap="round" stroke-dasharray="24 16"/>
  <circle cx="256" cy="256" r="45" fill="none" stroke="#ef4444" stroke-width="16"/>
</svg>''',

    'dist_mp_smesh': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <line x1="96" y1="256" x2="416" y2="256" stroke="#ef4444" stroke-width="16" stroke-linecap="round" stroke-dasharray="24 16"/>
  <polygon points="216,190 256,256 216,322 176,256" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round"/>
  <circle cx="316" cy="256" r="35" fill="none" stroke="#ef4444" stroke-width="16"/>
</svg>''',

    'storage': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <polygon points="256,90 440,210 440,410 72,410 72,210" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round"/>
</svg>''',

    'storage_fuel': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <polygon points="256,90 440,210 440,410 72,410 72,210" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round"/>
  <circle cx="256" cy="290" r="50" fill="none" stroke="#ef4444" stroke-width="16"/>
</svg>''',

    'storage_asp': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <polygon points="256,90 440,210 440,410 72,410 72,210" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round"/>
  <polygon points="256,220 296,340 216,340" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round"/>
</svg>''',

    'hlebozavod': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <polygon points="256,90 440,210 440,410 72,410 72,210" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round"/>
  <ellipse cx="256" cy="290" rx="60" ry="35" fill="none" stroke="#ef4444" stroke-width="16"/>
</svg>''',

    'elektrostantsiya': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <rect x="80" y="160" width="352" height="250" rx="16" fill="none" stroke="#ef4444" stroke-width="16"/>
  <path d="M 280 190 L 210 280 L 270 280 L 230 380" fill="none" stroke="#ef4444" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
</svg>''',

    'emkost': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <ellipse cx="256" cy="256" rx="160" ry="90" fill="none" stroke="#ef4444" stroke-width="16"/>
  <line x1="96" y1="256" x2="96" y2="350" stroke="#ef4444" stroke-width="16"/>
  <line x1="416" y1="256" x2="416" y2="350" stroke="#ef4444" stroke-width="16"/>
  <path d="M 96 350 C 96 410 416 410 416 350" fill="none" stroke="#ef4444" stroke-width="16"/>
</svg>''',

    'gus': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <rect x="80" y="140" width="352" height="260" rx="16" fill="none" stroke="#ef4444" stroke-width="16"/>
  <line x1="256" y1="140" x2="256" y2="400" stroke="#ef4444" stroke-width="16"/>
</svg>''',

    'gus_zasch': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <rect x="80" y="140" width="352" height="260" rx="16" fill="none" stroke="#ef4444" stroke-width="24"/>
  <line x1="256" y1="140" x2="256" y2="400" stroke="#ef4444" stroke-width="16"/>
</svg>''',

    'technical_support': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <rect x="80" y="160" width="352" height="220" rx="16" fill="none" stroke="#ef4444" stroke-width="16"/>
  <line x1="160" y1="210" x2="352" y2="330" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="160" y1="330" x2="352" y2="210" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
</svg>''',

    'bannoprachechnyy_kompl': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <rect x="80" y="160" width="352" height="220" rx="16" fill="none" stroke="#ef4444" stroke-width="16"/>
  <circle cx="256" cy="270" r="45" fill="none" stroke="#ef4444" stroke-width="16"/>
</svg>''',

    'brdm1': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <polygon points="60,160 380,160 452,256 380,352 60,352" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round" stroke-linecap="round"/>
  <circle cx="150" cy="352" r="32" fill="none" stroke="#ef4444" stroke-width="16"/>
  <circle cx="352" cy="352" r="32" fill="none" stroke="#ef4444" stroke-width="16"/>
  <line x1="256" y1="160" x2="256" y2="80" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
</svg>''',

    'knp_prot': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <line x1="140" y1="80" x2="140" y2="440" stroke="#ef4444" stroke-width="16" stroke-linecap="round" stroke-dasharray="16 16"/>
  <polygon points="140,80 390,80 390,240 140,240" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round" stroke-dasharray="16 16"/>
</svg>''',

    'knp_peredv1': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <line x1="140" y1="80" x2="140" y2="400" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <polygon points="140,80 390,80 390,240 140,240" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round"/>
  <circle cx="140" cy="420" r="32" fill="none" stroke="#ef4444" stroke-width="16"/>
</svg>''',

    'knpbatr_peredv1': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <line x1="140" y1="80" x2="140" y2="400" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <polygon points="140,80 390,80 390,240 140,240" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round"/>
  <line x1="220" y1="80" x2="220" y2="240" stroke="#ef4444" stroke-width="16"/>
  <line x1="310" y1="80" x2="310" y2="240" stroke="#ef4444" stroke-width="16"/>
  <circle cx="140" cy="420" r="32" fill="none" stroke="#ef4444" stroke-width="16"/>
</svg>''',

    'ahmat': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <polygon points="256,60 440,140 440,320 256,450 72,320 72,140" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round"/>
  <polygon points="256,160 280,220 345,220 292,260 312,320 256,280 200,320 220,260 167,220 232,220" fill="none" stroke="#ef4444" stroke-width="14" stroke-linejoin="round"/>
</svg>''',

    'art_polukaponir_1': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <path d="M 120 360 L 120 180 C 120 180 256 120 392 180 L 392 360" fill="none" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="120" y1="360" x2="392" y2="360" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="256" y1="260" x2="256" y2="90" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
</svg>''',

    'ags': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <line x1="140" y1="380" x2="256" y2="250" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="372" y1="380" x2="256" y2="250" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="256" y1="250" x2="256" y2="380" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="160" y1="230" x2="392" y2="200" stroke="#ef4444" stroke-width="18" stroke-linecap="round"/>
  <circle cx="230" cy="245" r="35" fill="none" stroke="#ef4444" stroke-width="16"/>
</svg>''',

    'aviaudar': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <line x1="80" y1="80" x2="380" y2="380" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <polygon points="380,380 320,380 380,320" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round"/>
  <circle cx="380" cy="380" r="60" fill="none" stroke="#ef4444" stroke-width="16"/>
</svg>''',

    'aviaudar_pr': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <line x1="80" y1="80" x2="380" y2="380" stroke="#ef4444" stroke-width="16" stroke-linecap="round" stroke-dasharray="16 16"/>
  <polygon points="380,380 320,380 380,320" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round"/>
  <circle cx="380" cy="380" r="60" fill="none" stroke="#ef4444" stroke-width="16" stroke-dasharray="16 16"/>
</svg>''',

    'kshm4': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <polygon points="60,180 380,180 452,280 380,380 60,380" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round" stroke-linecap="round"/>
  <line x1="256" y1="180" x2="256" y2="70" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="210" y1="100" x2="302" y2="100" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="225" y1="70" x2="287" y2="70" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
</svg>''',

    'zvuk_np_pr': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <line x1="256" y1="80" x2="256" y2="440" stroke="#ef4444" stroke-width="16" stroke-linecap="round" stroke-dasharray="16 16"/>
  <circle cx="256" cy="180" r="100" fill="none" stroke="#ef4444" stroke-width="16" stroke-dasharray="16 16"/>
  <path d="M 370 120 A 90 90 0 0 1 370 240" fill="none" stroke="#ef4444" stroke-width="16" stroke-linecap="round" stroke-dasharray="16 16"/>
</svg>''',

    'art_rls': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <line x1="120" y1="380" x2="392" y2="380" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="256" y1="380" x2="256" y2="230" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <path d="M 170 160 C 170 260 342 260 342 160" fill="none" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="256" y1="210" x2="256" y2="130" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
</svg>''',

    'art_op_svoya_1': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <path d="M 96 350 C 96 170 416 170 416 350" fill="none" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="256" y1="240" x2="256" y2="380" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="200" y1="300" x2="312" y2="300" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
</svg>''',

    'avto1': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <polygon points="60,180 340,180 340,240 440,240 452,340 60,340" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round" stroke-linecap="round"/>
  <circle cx="150" cy="340" r="32" fill="none" stroke="#ef4444" stroke-width="16"/>
  <circle cx="370" cy="340" r="32" fill="none" stroke="#ef4444" stroke-width="16"/>
</svg>''',

    'fort_dot': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <circle cx="256" cy="256" r="150" fill="none" stroke="#ef4444" stroke-width="16"/>
  <circle cx="256" cy="256" r="110" fill="none" stroke="#ef4444" stroke-width="16"/>
  <line x1="180" y1="256" x2="332" y2="256" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
</svg>''',

    'dot_tipovoy1': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <circle cx="256" cy="256" r="150" fill="none" stroke="#ef4444" stroke-width="16"/>
  <circle cx="256" cy="256" r="110" fill="none" stroke="#ef4444" stroke-width="16"/>
  <line x1="180" y1="256" x2="332" y2="256" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
  <line x1="256" y1="180" x2="256" y2="332" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
</svg>''',

    'blindazh_zhb': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <rect x="90" y="140" width="332" height="232" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round"/>
  <rect x="120" y="170" width="272" height="172" fill="none" stroke="#ef4444" stroke-width="16" stroke-linejoin="round"/>
  <line x1="120" y1="170" x2="392" y2="342" stroke="#ef4444" stroke-width="16" stroke-linecap="round"/>
</svg>''',

    'gus_zasch': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <rect x="70" y="130" width="372" height="280" rx="16" fill="none" stroke="#ef4444" stroke-width="16"/>
  <rect x="100" y="160" width="312" height="220" rx="8" fill="none" stroke="#ef4444" stroke-width="16"/>
  <line x1="256" y1="130" x2="256" y2="410" stroke="#ef4444" stroke-width="16"/>
</svg>'''
}

def main():
    os.makedirs(SYMBOLS_DIR, exist_ok=True)

    xml_files = glob.glob(os.path.join(ASU2_DIR, '*.xml'))
    print(f"Converting {len(xml_files)} XML symbols from asu_2...")
    
    count = 0
    for x in xml_files:
        name = os.path.splitext(os.path.basename(x))[0]
        svg = convert_asu_xml_to_svg(x)
        if svg:
            out_p = os.path.join(SYMBOLS_DIR, name + '.svg')
            with open(out_p, 'w', encoding='utf-8') as f:
                f.write(svg)
            count += 1
            
    print(f"Generated {count} clean vector SVGs from asu_2.")

    for name, svg in CUSTOM_SYMBOLS.items():
        out_p = os.path.join(SYMBOLS_DIR, name + '.svg')
        with open(out_p, 'w', encoding='utf-8') as f:
            f.write(svg)
            
    print(f"Overlaid {len(CUSTOM_SYMBOLS)} standardized clean tactical symbols.")

if __name__ == '__main__':
    main()
