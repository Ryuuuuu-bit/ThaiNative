#!/usr/bin/env python3
"""
แปลงชีต PixelLab (ที่ดาวน์โหลดจากเว็บ: แถว 0 = ภาพหมุน 8 ทิศ, แถว 1..8 = walk ตามลำดับ DIRS)
→ assets/td/<id>/idle.png (8 แถว × 4 เฟรม) และ walk.png (8 แถว × 6 เฟรม) + อัปเดต manifest.json

ใช้:  python3 tools/import_pixellab.py <sheet.png> <id> [scale]
 - ทิศที่ยังไม่มีท่าเดิน → กลับด้านจากทิศตรงข้ามซ้าย/ขวา (east↔west, NE↔NW, SE↔SW)
 - ถ้ายังไม่มีอีก → ใช้ภาพหมุนนิ่ง + ขยับขึ้นลงเล็กน้อย (ให้เล่นได้ก่อน ค่อยเจนเพิ่มทีหลัง)
"""
import json, os, sys
from PIL import Image, ImageOps

DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
MIRROR = {'west': 'east', 'east': 'west', 'north-west': 'north-east', 'north-east': 'north-west',
          'south-west': 'south-east', 'south-east': 'south-west'}
OUT = 72          # ขนาดเฟรมผลลัพธ์ (ตัวละคร ~60px อยู่กลางเฟรม)
WALK_N, IDLE_N = 6, 4
ROOT = os.path.join(os.path.dirname(__file__), '..', 'client', 'assets', 'td')


def cell(im, C, col, row):
    """ตัดเฟรมจากชีต แล้วครอบกลางให้เหลือ OUT×OUT"""
    c = im.crop((col * C, row * C, col * C + C, row * C + C))
    if not c.getbbox():
        return None
    o = (C - OUT) // 2
    if o >= 0:
        return c.crop((o, o, o + OUT, o + OUT))
    pad = Image.new('RGBA', (OUT, OUT)); pad.alpha_composite(c, (-o, -o)); return pad


def bob(fr, dy):
    """ยุบ/ยืดตัวเล็กน้อยโดยยึดเท้า (ใช้ทำ idle หายใจ / เดินสำรอง)"""
    if dy == 0:
        return fr
    b = fr.getbbox()
    if not b:
        return fr
    x0, y0, x1, y1 = b
    body = fr.crop(b).resize((x1 - x0, max(1, y1 - y0 - dy)), Image.NEAREST)
    out = Image.new('RGBA', fr.size); out.alpha_composite(body, (x0, y0 + dy)); return out


def main(src, sid, scale=None):
    im = Image.open(src).convert('RGBA')
    C = im.width // 8
    rot = {d: cell(im, C, i, 0) for i, d in enumerate(DIRS)}
    walk = {}
    for i, d in enumerate(DIRS):
        fr = [cell(im, C, k, i + 1) for k in range(WALK_N)]
        if all(fr):
            walk[d] = fr
    real = sorted(walk)
    for d in DIRS:                                    # กลับด้านจากทิศตรงข้าม
        if d not in walk and MIRROR.get(d) in real:
            walk[d] = [ImageOps.mirror(f) for f in walk[MIRROR[d]]]
    for d in DIRS:                                    # สำรอง: ภาพนิ่ง + ขยับ
        if d not in walk:
            walk[d] = [bob(rot[d], v) for v in (0, 1, 2, 1, 0, 1)]
    os.makedirs(os.path.join(ROOT, sid), exist_ok=True)
    idle = Image.new('RGBA', (OUT * IDLE_N, OUT * 8))
    wk = Image.new('RGBA', (OUT * WALK_N, OUT * 8))
    for r, d in enumerate(DIRS):
        for k, v in enumerate((0, 0, 1, 1)):
            idle.alpha_composite(bob(rot[d], v), (k * OUT, r * OUT))
        for k, f in enumerate(walk[d]):
            wk.alpha_composite(f, (k * OUT, r * OUT))
    idle.save(os.path.join(ROOT, sid, 'idle.png'), optimize=True)
    wk.save(os.path.join(ROOT, sid, 'walk.png'), optimize=True)
    mp = os.path.join(ROOT, 'manifest.json')
    man = json.load(open(mp)) if os.path.exists(mp) else {'sprites': {}, 'images': []}
    ent = {'anims': ['idle', 'walk'], 'frame': OUT}
    if scale:
        ent['scale'] = float(scale)
    man['sprites'][sid] = ent
    json.dump(man, open(mp, 'w'), ensure_ascii=False, indent=1)
    print(f'{sid}: walk จริง {real} · กลับด้าน {[d for d in DIRS if d not in real and MIRROR.get(d) in real]}')


if __name__ == '__main__':
    main(*sys.argv[1:])
