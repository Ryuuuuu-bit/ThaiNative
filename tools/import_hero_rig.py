#!/usr/bin/env python3
"""นำชุดท่า RIG (PixelLab skeleton v3, แคนวาส 144) เข้าเกม
  python3 tools/import_hero_rig.py <rig_dir> <sprite_id> <prefix>
  rig_dir: guard_<prefix>_<dir>.png + out/<prefix>_<dir>_{walk,slash}/<k>.png (ทิศ S,SE,E,NE,N · ตะวันตก = กลับด้าน)
  ออก client/assets/td/<sprite_id>/{idle,walk,slash,die}.png · ช่อง 128×RIG_H (ค่าเริ่ม 112, ดาบใหญ่ใช้ 136) · เท้าตามท่าตั้งการ์ดที่ RIG_H×0.92"""
import sys, json, os
sys.path.insert(0, os.path.dirname(__file__))
import import_hero_v2 as H
from PIL import Image, ImageOps
import numpy as np
Hh = int(os.environ.get("RIG_H", 112)); F = Hh - round(Hh * 0.08); W = 128
ATK = os.environ.get("RIG_ATK", "slash")
SRC_ATK = os.environ.get("RIG_SRC", ATK)      # ชื่อโฟลเดอร์ต้นทางของท่าโจมตี (ถ้าต่างจากชื่อในเกม)   # ชื่อท่าโจมตีในเกม: slash / heal / cast / shoot / attack (โฟลเดอร์ out/<prefix>_<dir>_<ATK>)
EXTRA = [a for a in os.environ.get("RIG_EXTRA", "").split(",") if a]   # ท่าเพิ่มเติม 8 เฟรม (เช่น cast) ถ้ามีโฟลเดอร์
H.W, H.H, H.FEET = W, Hh, F
M = {'west': 'east', 'north-west': 'north-east', 'south-west': 'south-east'}

def run(R, sid, P):
    src = lambda d: M.get(d, d)
    base = {d: Image.open(f'{R}/guard_{P}_{src(d)}.png').getbbox()[3] for d in H.DIRS}
    def cell(path, d):
        im = Image.open(path).convert('RGBA')
        if d in M: im = ImageOps.mirror(im)
        o = Image.new('RGBA', (W, Hh)); o.alpha_composite(im.crop((8, base[d] - F, 8 + W, base[d] - F + Hh))); return o
    walk = {d: [cell(f'{R}/out/{P}_{src(d)}_walk/{i}.png', d) for i in range(6)] for d in H.DIRS}
    slash = {d: [cell(f'{R}/out/{P}_{src(d)}_{SRC_ATK}/{i}.png', d) for i in range(8)] for d in H.DIRS}
    extra = {a: {d: [cell(f'{R}/out/{P}_{src(d)}_{a}/{i}.png', d) for i in range(8)] for d in H.DIRS} for a in EXTRA if os.path.isdir(f'{R}/out/{P}_south_{a}')}
    guard = {d: cell(f'{R}/guard_{P}_{src(d)}.png', d) for d in H.DIRS}
    idle = {}
    for d in H.DIRS:
        up = Image.new('RGBA', (W, Hh)); up.alpha_composite(guard[d].crop((0, 1, W, Hh))); idle[d] = [guard[d], guard[d], up, up]
    die = {d: H.die_frames(guard[d]) for d in H.DIRS}
    out = os.path.join(H.ROOT, sid); os.makedirs(out, exist_ok=True); meta = {}
    for n, fr in [('idle', idle), ('walk', walk), (ATK, slash)] + list(extra.items()) + [('die', die)]:
        sh, k = H.sheet(fr); sh.save(f'{out}/{n}.png', optimize=True); meta[n] = k
    mp = os.path.join(H.ROOT, 'manifest.json'); man = json.load(open(mp))
    man['sprites'][sid] = {'anims': list(meta), 'frames': meta, 'frame': Hh, 'scale': H.SCALE, 'lazy': True}
    json.dump(man, open(mp, 'w'), ensure_ascii=False, indent=1)
    bad = [(n, d, i) for n, fr in (('walk', walk), (ATK, slash), ('idle', idle)) for d in H.DIRS for i, f in enumerate(fr[d])
           if (lambda a: a[0].any() or a[:, 0].any() or a[:, -1].any() or a[-1].any())(np.asarray(f)[..., 3] > 24)]
    print(sid, meta, 'clipped', bad)

if __name__ == '__main__':
    run(*sys.argv[1:4])
