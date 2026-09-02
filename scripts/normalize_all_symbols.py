import os
import glob
import re

SYMBOLS_DIR = r'F:\Vanya\topos\public\symbols'

DRONE_SVGS = {
    'fpv_drone': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <line x1="120" y1="120" x2="392" y2="392" stroke="#ef4444" stroke-width="24" stroke-linecap="round"/>
  <line x1="120" y1="392" x2="392" y2="120" stroke="#ef4444" stroke-width="24" stroke-linecap="round"/>
  <rect x="226" y="196" width="60" height="120" rx="16" fill="none" stroke="#ef4444" stroke-width="24"/>
  <circle cx="120" cy="120" r="54" fill="none" stroke="#ef4444" stroke-width="22"/>
  <circle cx="392" cy="120" r="54" fill="none" stroke="#ef4444" stroke-width="22"/>
  <circle cx="120" cy="392" r="54" fill="none" stroke="#ef4444" stroke-width="22"/>
  <circle cx="392" cy="392" r="54" fill="none" stroke="#ef4444" stroke-width="22"/>
  <polygon points="256,120 236,170 276,170" fill="#ef4444" stroke="#ef4444" stroke-width="12" stroke-linejoin="round"/>
</svg>''',

    'mavic3': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <rect x="216" y="176" width="80" height="160" rx="20" fill="none" stroke="#ef4444" stroke-width="24"/>
  <line x1="216" y1="206" x2="116" y2="136" stroke="#ef4444" stroke-width="22" stroke-linecap="round"/>
  <line x1="296" y1="206" x2="396" y2="136" stroke="#ef4444" stroke-width="22" stroke-linecap="round"/>
  <line x1="216" y1="306" x2="116" y2="376" stroke="#ef4444" stroke-width="22" stroke-linecap="round"/>
  <line x1="296" y1="306" x2="396" y2="376" stroke="#ef4444" stroke-width="22" stroke-linecap="round"/>
  <circle cx="116" cy="136" r="60" fill="none" stroke="#ef4444" stroke-width="22"/>
  <circle cx="396" cy="136" r="60" fill="none" stroke="#ef4444" stroke-width="22"/>
  <circle cx="116" cy="376" r="60" fill="none" stroke="#ef4444" stroke-width="22"/>
  <circle cx="396" cy="376" r="60" fill="none" stroke="#ef4444" stroke-width="22"/>
  <circle cx="256" cy="226" r="16" fill="#ef4444" stroke="#ef4444"/>
</svg>''',

    'orlan10': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <polygon points="256,60 274,380 256,440 238,380" fill="none" stroke="#ef4444" stroke-width="24" stroke-linejoin="round"/>
  <path d="M 40 250 L 256 220 L 472 250 L 452 280 L 256 260 L 60 280 Z" fill="none" stroke="#ef4444" stroke-width="24" stroke-linejoin="round"/>
  <polygon points="256,380 340,430 320,450 256,420 192,450 172,430" fill="none" stroke="#ef4444" stroke-width="22" stroke-linejoin="round"/>
  <circle cx="256" cy="60" r="12" fill="#ef4444" stroke="#ef4444"/>
</svg>''',

    'bolshoy_bla1': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <path d="M 256 40 C 270 40 280 180 280 370 L 320 440 L 256 430 L 192 440 L 232 370 C 232 180 242 40 256 40 Z" fill="none" stroke="#ef4444" stroke-width="24" stroke-linejoin="round"/>
  <polygon points="30,220 256,190 482,220 472,260 256,236 40,260" fill="none" stroke="#ef4444" stroke-width="24" stroke-linejoin="round"/>
  <polygon points="256,390 350,446 330,466 256,440 182,466 162,446" fill="none" stroke="#ef4444" stroke-width="22" stroke-linejoin="round"/>
  <line x1="220" y1="440" x2="292" y2="440" stroke="#ef4444" stroke-width="20" stroke-linecap="round"/>
</svg>''',

    'malyy_bla1': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <path d="M 256 80 L 460 290 L 360 290 L 256 230 L 152 290 L 52 290 Z" fill="none" stroke="#ef4444" stroke-width="24" stroke-linejoin="round" stroke-linecap="round"/>
  <polygon points="256,100 270,390 256,430 242,390" fill="none" stroke="#ef4444" stroke-width="22" stroke-linejoin="round"/>
  <circle cx="256" cy="200" r="20" fill="none" stroke="#ef4444" stroke-width="20"/>
</svg>''',

    'uav': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <path d="M 256 60 C 270 60 280 200 280 380 L 256 440 L 232 380 C 232 200 242 60 256 60 Z" fill="none" stroke="#ef4444" stroke-width="24" stroke-linejoin="round"/>
  <path d="M 40 230 L 256 200 L 472 230 L 452 265 L 256 240 L 60 265 Z" fill="none" stroke="#ef4444" stroke-width="24" stroke-linejoin="round"/>
  <line x1="200" y1="420" x2="312" y2="420" stroke="#ef4444" stroke-width="22" stroke-linecap="round"/>
</svg>''',

    'uav_helicopter': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <ellipse cx="216" cy="286" rx="120" ry="70" fill="none" stroke="#ef4444" stroke-width="24"/>
  <path d="M 326 286 L 456 260 L 456 210" fill="none" stroke="#ef4444" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="216" y1="216" x2="216" y2="156" stroke="#ef4444" stroke-width="24"/>
  <line x1="76" y1="156" x2="356" y2="156" stroke="#ef4444" stroke-width="24" stroke-linecap="round"/>
  <line x1="136" y1="356" x2="136" y2="396" stroke="#ef4444" stroke-width="20"/>
  <line x1="276" y1="356" x2="276" y2="396" stroke="#ef4444" stroke-width="20"/>
  <line x1="96" y1="396" x2="316" y2="396" stroke="#ef4444" stroke-width="24" stroke-linecap="round"/>
  <circle cx="456" cy="210" r="30" fill="none" stroke="#ef4444" stroke-width="20"/>
</svg>''',

    'start_bla': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <line x1="80" y1="412" x2="432" y2="412" stroke="#ef4444" stroke-width="24" stroke-linecap="round"/>
  <line x1="120" y1="412" x2="372" y2="140" stroke="#ef4444" stroke-width="26" stroke-linecap="round"/>
  <line x1="250" y1="274" x2="250" y2="412" stroke="#ef4444" stroke-width="22"/>
  <polygon points="372,140 330,155 350,195" fill="#ef4444" stroke="#ef4444" stroke-width="12" stroke-linejoin="round"/>
  <path d="M 330 185 L 420 100 L 400 160 Z" fill="none" stroke="#ef4444" stroke-width="20" stroke-linejoin="round"/>
</svg>''',

    'drone_control_room': '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <rect x="90" y="210" width="332" height="200" rx="16" fill="none" stroke="#ef4444" stroke-width="24"/>
  <line x1="256" y1="210" x2="256" y2="90" stroke="#ef4444" stroke-width="24"/>
  <path d="M 196 90 A 60 60 0 0 1 316 90" fill="none" stroke="#ef4444" stroke-width="24"/>
  <line x1="196" y1="90" x2="316" y2="90" stroke="#ef4444" stroke-width="20"/>
  <circle cx="256" cy="50" r="14" fill="#ef4444" stroke="#ef4444"/>
  <circle cx="160" cy="410" r="28" fill="none" stroke="#ef4444" stroke-width="22"/>
  <circle cx="352" cy="410" r="28" fill="none" stroke="#ef4444" stroke-width="22"/>
</svg>'''
}

def normalize_svg_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception:
        return

    basename = os.path.splitext(os.path.basename(filepath))[0]
    if basename in DRONE_SVGS:
        return

    vb_match = re.search(r'viewBox=["\']([^"\']+)["\']', content)
    if not vb_match:
        return

    vb_vals = [float(x) for x in vb_match.group(1).split()]
    if len(vb_vals) != 4:
        return

    min_x, min_y, vb_w, vb_h = vb_vals
    if vb_w <= 0 or vb_h <= 0:
        return

    body_match = re.search(r'<svg[^>]*>(.*)</svg>', content, re.DOTALL)
    if not body_match:
        return
    inner = body_match.group(1).strip()

    inner = re.sub(r'<(?:defs|style)[^>]*>.*?</(?:defs|style)>', '', inner, flags=re.DOTALL)
    inner = re.sub(r'class=["\'][^"\']*["\']', '', inner)

    scale = 400.0 / max(vb_w, vb_h)
    cx = min_x + vb_w / 2.0
    cy = min_y + vb_h / 2.0
    tx = 256.0 - (cx * scale)
    ty = 256.0 - (cy * scale)

    inner = re.sub(r'stroke-width=["\'][^"\']*["\']', '', inner)
    inner = re.sub(r'stroke=["\'](?!none)[^"\']*["\']', '', inner)
    inner = re.sub(r'fill=["\']#(?:000000|2b2a29|0f172a|black|currentColor)["\']', 'fill="none"', inner, flags=re.IGNORECASE)

    new_svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" fill="none" stroke="#ef4444">
  <g transform="translate({tx:.2f}, {ty:.2f}) scale({scale:.4f})" stroke="#ef4444" stroke-width="{(24.0/scale):.2f}" stroke-linecap="round" stroke-linejoin="round">
    {inner}
  </g>
</svg>'''
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_svg)

def main():
    for name, svg in DRONE_SVGS.items():
        p = os.path.join(SYMBOLS_DIR, name + '.svg')
        with open(p, 'w', encoding='utf-8') as f:
            f.write(svg)
    print(f"Written {len(DRONE_SVGS)} standardized drone SVGs.")

    all_svgs = glob.glob(os.path.join(SYMBOLS_DIR, '*.svg'))
    for s in all_svgs:
        normalize_svg_file(s)
    print(f"Normalized {len(all_svgs)} SVGs to 512x512 with red stroke and uniform 24px width.")

if __name__ == '__main__':
    main()
