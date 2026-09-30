#!/usr/bin/env python3
"""
นำตัวละครผู้เล่นชุดใหม่ (PixelLab · อาชีพ × ขั้นอาวุธ) เข้าเกม
  python3 tools/import_hero_v2.py <โฟลเดอร์ที่แตก zip ของ PixelLab> [gender]

 - อ่านรายการ state ที่ใช้จาก HERO_V2 ด้านล่าง (ชื่อโฟลเดอร์ใน zip)
 - ออก client/assets/td/hero2_<gender>_<job>_t<n>/{idle,walk,<ท่าโจมตี>,die}.png + manifest.json
 - เฟรม 128×104 · เท้าอยู่ที่ y=96 ทุกเฟรม (ภาพหมุน 96px และท่าเคลื่อนไหว 104–132px ของ PixelLab จัดกึ่งกลางเท่ากัน)
 - ท่าจริง: เดิน S/E/N · โจมตี S/E → ทิศตะวันตกกลับด้าน · ทิศเฉียงใช้ภาพข้าง · ท่าตายสร้างจากภาพหมุน (ล้มลง)
 - เก็บงาน AI: ลบเศษภาพลอย (CLEAN) · เฟรมที่ทั้งตัวเปลี่ยนสี (แฟลช) → ใช้เฟรมข้างเคียงแทน
"""
import glob, json, os, sys
import numpy as np
from PIL import Image, ImageOps
from scipy import ndimage

ROOT = os.path.join(os.path.dirname(__file__), '..', 'client', 'assets', 'td')
DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
W, H, FEET = 128, 104, 96          # ขนาดช่อง · ตำแหน่งเท้า
BODY = 39                           # เท้าอยู่ต่ำกว่ากึ่งกลางแคนวาส PixelLab 39px (ภาพ 80px ในแคนวาส 96)
SCALE = 0.54                        # สูงจริง ~42px บนจอ (ตัวเดิม ~39px)

# job → (ชื่อท่าในเกม, โฟลเดอร์ state ขั้น 1..4, ชื่อท่าเดิน, ชื่อท่าโจมตี)
HERO_V2 = {
    'male': {
        'swordman': (['slash'], ['Sword_T1_Iron_v2', 'Sword_T2_Gold_v2', 'Sword_T3_Legend_v2', 'Sword_T4_Boss'], 'walk_sword', 'slash'),
        'mage': (['cast', 'spell'], ['Mage_T1', 'Mage_T2', 'Mage_T3', 'Mage_T4_Boss'], 'walk', 'attack'),
        'archer': (['shoot'], ['Archer_T1', 'Archer_T2', 'Archer_T3', 'Archer_T4_Boss_v2'], 'walk', 'attack'),
        'boxer': (['attack'], ['Boxer_T1', 'Boxer_T2', 'Boxer_T3', 'Boxer_T4_Boss'], 'walk', 'attack'),
        'healer': (['heal', 'cast'], ['Healer_T1', 'Healer_T2_v4', 'Healer_T3_v2', 'Healer_T4_Boss'], 'walk', 'attack'),
    },
}
PREFER = {('Mage_T1', 'attack', 'south'): 'attack2', ('Mage_T2', 'attack', 'south'): 'attack2', ('Sword_T1_Iron_v2', 'slash', 'south'): 'slash2'}   # ท่าที่เจนแก้ใหม่
CLEAN = {'Archer_T2'}                                   # ทุกท่า
CLEAN_WALK = {'Mage_T1'}                               # เฉพาะท่าเดิน (ท่ารักษามีประกายแยกชิ้นที่ต้องเก็บไว้)
MIRROR = {'west': 'east', 'north-west': 'north-east', 'south-west': 'south-east'}
SIDE = {'south-east': 'east', 'north-east': 'east', 'north': 'east'}     # ทิศที่ไม่มีท่าโจมตีจริง → ใช้ภาพข้าง


def place(im):
    """วางภาพจากแคนวาส PixelLab ขนาดใดก็ได้ลงช่อง W×H ให้เท้าอยู่ที่ FEET"""
    S = im.width
    out = Image.new('RGBA', (W, H))
    x, y = (W - S) // 2, FEET - (S // 2 + BODY)
    src = im.crop((max(0, -x), max(0, -y), min(S, W - x), min(S, H - y)))
    out.alpha_composite(src, (max(0, x), max(0, y)))
    return out


def clean(im, keep_ratio=0.25, near_px=3):
    a = np.array(im.convert('RGBA')); mask = a[..., 3] > 24
    lab, n = ndimage.label(mask, structure=np.ones((3, 3)))
    if n <= 1:
        return im
    sizes = ndimage.sum(mask, lab, range(1, n + 1)); main = int(np.argmax(sizes)) + 1
    near = ndimage.binary_dilation(lab == main, iterations=near_px) if near_px else np.zeros_like(mask)
    for i, s in enumerate(sizes, 1):
        comp = lab == i
        if i != main and s < sizes.max() * keep_ratio and not (comp & near).any():
            a[comp] = 0
    return Image.fromarray(a)


def body_color(im):
    a = np.asarray(im).astype(float); h, w = a.shape[:2]
    r = a[int(h * .35):int(h * .75), int(w * .38):int(w * .62)]; m = r[..., 3] > 128
    return r[m][:, :3].mean(0) if m.sum() >= 20 else None


def fix_flash(frames, ref, thr=45):
    rc = body_color(ref)
    bad = [i for i, f in enumerate(frames) if rc is not None and (c := body_color(f)) is not None and np.linalg.norm(c - rc) > thr]
    good = [i for i in range(len(frames)) if i not in bad]
    if not good:
        return frames, bad
    return [frames[min(good, key=lambda g: (abs(g - i), g))] if i in bad else frames[i] for i in range(len(frames))], bad


def load_seq(root, folder, anim, d):
    alt = PREFER.get((folder, anim, d))
    for a in ([alt] if alt else []) + [anim]:
        fs = sorted(glob.glob(f'{root}/{folder}/animations/{a}/{d}/*.png'))
        if fs:
            return [Image.open(f).convert('RGBA') for f in fs]
    return []


def die_frames(rot):
    """ล้มลงด้านข้าง 7 เฟรม (หมุนรอบเท้า แล้วจางเล็กน้อย)"""
    out = []
    for k, deg in enumerate((0, 12, 30, 52, 74, 88, 90)):
        fr = Image.new('RGBA', (W, H))
        bb = rot.getbbox()
        if bb:
            body = rot.crop(bb)
            r = body.rotate(-deg, expand=True, resample=Image.NEAREST)
            fr.alpha_composite(r, (W // 2 - r.width // 2 + int(deg * .12), FEET - r.height))
        if k >= 5:
            a = np.array(fr); a[..., 3] = (a[..., 3] * (0.85 if k == 5 else 0.7)).astype(np.uint8); fr = Image.fromarray(a)
        out.append(fr)
    return out


def sheet(frames_by_dir):
    n = max(len(v) for v in frames_by_dir.values())
    sh = Image.new('RGBA', (W * n, H * 8))
    for r, d in enumerate(DIRS):
        fr = frames_by_dir[d]
        for k in range(n):
            sh.alpha_composite(fr[min(k, len(fr) - 1)], (k * W, r * H))
    return sh, n


def build(root, gender, job, acts, folder, walk_name, atk_name, tier):
    sid = f'hero2_{gender}_{job}_t{tier}'
    out = os.path.join(ROOT, sid); os.makedirs(out, exist_ok=True)
    fix = (lambda im: clean(im)) if folder in CLEAN else (lambda im: im)
    rfix = (lambda im: clean(im, near_px=0)) if folder in CLEAN_WALK else fix
    rot = {d: place(rfix(Image.open(f'{root}/{folder}/rotations/{d}.png').convert('RGBA'))) for d in DIRS}
    counts, notes = {}, []
    # idle: ภาพหมุนนิ่ง + หายใจ 1px
    idle = {}
    for d in DIRS:
        up = Image.new('RGBA', (W, H)); up.alpha_composite(rot[d].crop((0, 1, W, H)), (0, 0))
        idle[d] = [rot[d], rot[d], up, up]
    for name, (seq_name, real, frames_n) in {'walk': (walk_name, ['south', 'east', 'north'], 6), 'act': (atk_name, ['south', 'east'], 8)}.items():
        fr = {}
        for d in real:
            s = [place(clean(x, near_px=0) if (name == 'walk' and folder in CLEAN_WALK) else fix(x)) for x in load_seq(root, folder, seq_name, d)]
            if not s:
                raise SystemExit(f'ขาดท่า {folder} {seq_name} {d}')
            s, bad = fix_flash(s, rot[d])
            if bad:
                notes.append(f'{seq_name}/{d} แก้แฟลช {bad}')
            fr[d] = s
        for d in DIRS:
            if d in fr:
                continue
            if d in MIRROR:
                src = fr.get(MIRROR[d]) or fr[SIDE.get(MIRROR[d], 'east')]
                fr[d] = [ImageOps.mirror(x) for x in src]
            else:
                fr[d] = fr[SIDE[d]] if name == 'act' or d != 'north' else fr['north']
        if name == 'walk':
            counts['walk'] = fr
        else:
            for a in acts:
                counts[a] = fr
    counts['idle'] = idle
    counts['die'] = {d: die_frames(rot[d if d in ('south', 'east', 'north') else ('east' if 'east' in d else 'south')]) if 'west' not in d else [ImageOps.mirror(x) for x in die_frames(rot[MIRROR[d]])] for d in DIRS}
    meta = {}
    for anim, fr in counts.items():
        sh, n = sheet(fr)
        sh.save(os.path.join(out, f'{anim}.png'), optimize=True); meta[anim] = n
    mp = os.path.join(ROOT, 'manifest.json'); man = json.load(open(mp))
    man['sprites'][sid] = {'anims': list(meta), 'frames': meta, 'frame': H, 'scale': SCALE, 'lazy': True}
    json.dump(man, open(mp, 'w'), ensure_ascii=False, indent=1)
    print(sid, meta, '·', '; '.join(notes) or 'ok')


if __name__ == '__main__':
    root = sys.argv[1]; gender = sys.argv[2] if len(sys.argv) > 2 else 'male'
    for job, (acts, folders, walk_name, atk_name) in HERO_V2[gender].items():
        for t, f in enumerate(folders, 1):
            build(root, gender, job, acts, f, walk_name, atk_name, t)
