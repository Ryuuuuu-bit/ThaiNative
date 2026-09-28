#!/usr/bin/env python3
"""เพิ่มท่าเดียวให้สไปรต์ที่มีอยู่แล้ว (ไม่ต้อง import ใหม่ทั้งตัว)
   python3 tools/add_anim.py <sheet PixelLab 8 แถว> <sprite id> <ชื่อท่าในเกม> [ตัดเฟรมแรก N] [ทิศที่ใช้ได้ คั่นด้วย ,]"""
import json, os, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from import_pixellab import DIRS, OUT, ROOT, crop, fill_dirs

src, sid, name = sys.argv[1:4]
skip = int(sys.argv[4]) if len(sys.argv) > 4 else 0
only = set(sys.argv[5].split(',')) if len(sys.argv) > 5 else None
im = Image.open(src).convert('RGBA'); C = im.height // 8; n = im.width // C
frames = {}
for i, d in enumerate(DIRS):
    if only and d not in only: continue
    fr = [x for x in (crop(im.crop((k * C, i * C, k * C + C, i * C + C))) for k in range(n)) if x][skip:]
    if fr: frames[d] = fr
real = fill_dirs(frames, {}, False, True)
m = max(len(f) for f in frames.values())
sh = Image.new('RGBA', (OUT * m, OUT * 8))
for r, d in enumerate(DIRS):
    for k, f in enumerate(frames[d]): sh.alpha_composite(f, (k * OUT, r * OUT))
sh.save(os.path.join(ROOT, sid, f'{name}.png'), optimize=True)
mp = os.path.join(ROOT, 'manifest.json'); man = json.load(open(mp)); e = man['sprites'][sid]
if name not in e['anims']: e['anims'].append(name)
e['frames'][name] = m
json.dump(man, open(mp, 'w'), ensure_ascii=False, indent=1)
print(sid, name, m, 'frames · จริง', real)
