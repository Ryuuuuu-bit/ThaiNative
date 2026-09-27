#!/usr/bin/env python3
"""
นำ tileset แบบ Wang ของ PixelLab (ชีต 4×4 ไทล์ 16px) เข้าเกม → client/assets/td/tiles/<lower>__<upper>.png
  python3 tools/import_tileset.py <sheet.png> <lower> <upper> <สี lower โดยประมาณ เช่น 3a8fb0>
 - ครั้งแรกตรวจมุมอัตโนมัติ (จัดกลุ่มสีมุม 2 กลุ่ม) แล้วจำลำดับไว้ใน tools/wang_layout.json · ชุดต่อไปใช้ลำดับเดียวกัน
 - เรียงใหม่เป็น 16 ช่องตาม mask:
   bit0 = มุมซ้ายบน, bit1 = ขวาบน, bit2 = ซ้ายล่าง, bit3 = ขวาล่าง (1 = upper terrain)
 - เพิ่มลง manifest.tilesets
"""
import json, os, sys
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'client', 'assets', 'td')


def mean(im, box):
    px = list(im.crop(box).getdata()); n = len(px)
    return tuple(sum(p[i] for p in px) / n for i in range(3))


def d2(a, b):
    return sum((a[i] - b[i]) ** 2 for i in range(3))


def main(src, lower, upper, hexcol):
    im = Image.open(src).convert('RGB'); T = im.width // 4
    ref = tuple(int(hexcol[i:i + 2], 16) for i in (0, 2, 4))
    k = max(2, T // 5)
    corners = []
    for i in range(16):
        x, y = (i % 4) * T, (i // 4) * T
        boxes = [(x, y, x + k, y + k), (x + T - k, y, x + T, y + k), (x, y + T - k, x + k, y + T), (x + T - k, y + T - k, x + T, y + T)]
        corners.append([mean(im, b) for b in boxes])
    # 2-means บนสีมุมทั้งหมด
    allc = [c for cs in corners for c in cs]
    a = min(allc, key=lambda c: d2(c, ref)); b = max(allc, key=lambda c: d2(c, a))
    for _ in range(10):
        A = [c for c in allc if d2(c, a) <= d2(c, b)]; B = [c for c in allc if d2(c, a) > d2(c, b)]
        a = tuple(sum(c[i] for c in A) / len(A) for i in range(3)); b = tuple(sum(c[i] for c in B) / len(B) for i in range(3))
    if d2(b, ref) < d2(a, ref):
        a, b = b, a                       # a = lower
    out = Image.new('RGB', (T * 16, T)); seen = {}
    lay_p = os.path.join(os.path.dirname(__file__), 'wang_layout.json')
    layout = json.load(open(lay_p)) if os.path.exists(lay_p) else None
    for i, cs in enumerate(corners):
        m = layout[i] if layout else sum((1 << j) for j, c in enumerate(cs) if d2(c, b) < d2(c, a))
        if m in seen:
            continue
        seen[m] = i
        x, y = (i % 4) * T, (i // 4) * T
        out.paste(im.crop((x, y, x + T, y + T)), (m * T, 0))
    missing = [m for m in range(16) if m not in seen]
    if not layout and not missing:          # บันทึกลำดับไทล์ของ PixelLab ไว้ใช้กับชุดอื่น (ตรวจจากชุดที่สีแยกชัด)
        json.dump([next(m for m, j in seen.items() if j == i) for i in range(16)], open(lay_p, 'w'))
    os.makedirs(os.path.join(ROOT, 'tiles'), exist_ok=True)
    name = f'{lower}__{upper}'
    out.save(os.path.join(ROOT, 'tiles', name + '.png'), optimize=True)
    mp = os.path.join(ROOT, 'manifest.json'); man = json.load(open(mp))
    ts = man.setdefault('tilesets', [])
    if name not in ts:
        ts.append(name)
    json.dump(man, open(mp, 'w'), ensure_ascii=False, indent=1)
    print(name, 'masks', sorted(seen), 'missing', missing)


if __name__ == '__main__':
    main(*sys.argv[1:5])
