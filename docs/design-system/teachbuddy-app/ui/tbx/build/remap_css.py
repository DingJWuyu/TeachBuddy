"""Carry the legacy stylesheet into the new visual language.

- neutral greys gain the neutral Apple greys
- the old violet/indigo accent family becomes the system-blue family
- tight radii (6/8px) soften to the new control and card radii
Third-party sections (KaTeX, MathLive) are left untouched.
"""
import re, pathlib, colorsys

SRC = pathlib.Path('/home/claude/teachbuddy-original/current-ui/ui/app.css')
DST = pathlib.Path('/home/claude/teachbuddy/ui/app.css')
css = SRC.read_text(encoding='utf-8')

# split into "/* path */" sections so vendor CSS can be skipped
parts = re.split(r'(?m)^(/\* (?:apps|node_modules|packages)/[^*]+\*/)\n', css)
out = [parts[0]]

def tint_grey(r, g, b):
    L = (r + g + b) / 3
    return (L, L, L + 1.5)

ACCENT_LIGHT = (0xee, 0xf5, 0xfd)
def accent_for(r, g, b):
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    if l > 0.9:
        return ACCENT_LIGHT                 # tint backgrounds
    if l > 0.72:
        return (0xb8, 0xd6, 0xf5)           # soft lines
    if l > 0.55:
        return (0x29, 0x97, 0xff)           # light accent (dark theme)
    if l > 0.32:
        return (0x00, 0x66, 0xcc)           # accent
    return (0x0b, 0x24, 0x40)               # deep accent surface

def remap_hex(m):
    raw = m.group(0)
    hexv = raw[1:]
    if len(hexv) in (3, 4):
        hexv = ''.join(c * 2 for c in hexv)
    r, g, b = (int(hexv[i:i + 2], 16) for i in (0, 2, 4))
    alpha = hexv[6:8] if len(hexv) == 8 else ''
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    spread = max(r, g, b) - min(r, g, b)
    if spread <= 14 and not (r == g == b == 255) and not (r == g == b == 0):
        nr, ng, nb = tint_grey(r, g, b)
    elif 0.62 <= h <= 0.80 and s > 0.25 and spread > 30:
        nr, ng, nb = accent_for(r, g, b)
    else:
        return raw
    clamp = lambda v: max(0, min(255, round(v)))
    return '#%02x%02x%02x%s' % (clamp(nr), clamp(ng), clamp(nb), alpha)

RADIUS = {'5px': '7px', '6px': '8px', '7px': '9px', '8px': '10px', '9px': '11px', '10px': '12px', '12px': '14px'}
def remap_radius(m):
    values = m.group(2).split()
    return m.group(1) + ' '.join(RADIUS.get(v, v) for v in values) + m.group(3)

def remap_section(text):
    text = re.sub(r'#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3,4}\b', remap_hex, text)
    text = re.sub(r'(border-radius:\s*)([0-9.px\s%]+?)(\s*[;}\n])', remap_radius, text)
    # the legacy shell used Inter first; the new stack is the system UI face
    text = text.replace('Inter,\n    system-ui,', 'var(--tb-font),\n    system-ui,')
    return text

for i in range(1, len(parts), 2):
    header, body = parts[i], parts[i + 1]
    # vendor CSS and the original sign-in pages are kept exactly as shipped
    vendor = 'node_modules/' in header or 'features/auth/' in header
    out.append(header + '\n')
    out.append(body if vendor else remap_section(body))

DST.write_text(''.join(out), encoding='utf-8')
print('app.css remapped')
