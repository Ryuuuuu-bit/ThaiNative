#!/usr/bin/env python3
"""ไอคอนสกิลจากภาพวัตถุ PixelLab (48px โปร่งใส) → ใส่กรอบทอง + พื้นสีประจำอาชีพ แบบไอคอนสกิลเดิม
ใช้: python3 tools/skill_icon_frame.py <sheet.png> <idx>=<skill_id> ..."""
import sys, os, json
from PIL import Image, ImageDraw
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BG = {'sword': ((26, 44, 96), (8, 14, 36)), 'mage': ((64, 24, 90), (18, 6, 30)), 'arch': ((74, 56, 22), (26, 18, 6)),
      'boxer': ((96, 42, 22), (30, 12, 6)), 'heal': ((18, 64, 46), (8, 28, 22))}
GOLD, GOLDD, GOLDL = (222, 178, 70, 255), (150, 100, 30, 255), (255, 232, 150, 255)

def frame(icon, job):
    N = 48; a, b = BG[job]
    im = Image.new('RGBA', (N, N)); px = im.load()
    for y in range(N):
        t = y / (N - 1)
        for x in range(N):
            r = ((x - 24) ** 2 + (y - 22) ** 2) ** 0.5 / 34
            c = [int((a[i] * (1 - t) + b[i] * t) * (1.25 - min(1, r) * 0.45)) for i in range(3)]
            px[x, y] = tuple(min(255, v) for v in c) + (255,)
    bb = icon.getbbox() or (0, 0, 48, 48)
    ic = icon.crop(bb); s = min(38 / ic.width, 38 / ic.height)
    if s < 1 or s > 1.15: ic = ic.resize((max(1, round(ic.width * s)), max(1, round(ic.height * s))), Image.NEAREST)
    im.alpha_composite(ic, ((N - ic.width) // 2, (N - ic.height) // 2))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, N - 1, N - 1], outline=GOLDD, width=2); d.rectangle([2, 2, N - 3, N - 3], outline=GOLD, width=2)
    for x, y in [(2, 2), (N - 4, 2), (2, N - 4), (N - 4, N - 4)]: d.rectangle([x, y, x + 1, y + 1], fill=GOLDL)
    return im

sheet = Image.open(sys.argv[1]).convert('RGBA'); S = sheet.size[1]
man_p = os.path.join(ROOT, 'client/assets/manifest.json'); man = json.load(open(man_p))
for arg in sys.argv[2:]:
    i, sid = arg.split('='); i = int(i)
    out = frame(sheet.crop((i * S, 0, i * S + S, S)), sid.split('_')[0])
    for d in ('client/assets/icons', 'assets_src/pixellab/icons'): out.save(os.path.join(ROOT, d, f'sk_{sid}.png'))
    man['icons'][f'sk_{sid}'] = f'assets/icons/sk_{sid}.png'
json.dump(man, open(man_p, 'w'), indent=2, ensure_ascii=False)
print('framed', len(sys.argv) - 2)
