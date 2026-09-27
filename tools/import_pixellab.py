#!/usr/bin/env python3
"""
นำภาพ PixelLab เข้าเกม → client/assets/td/<id>/<anim>.png (8 แถว = 8 ทิศ) + manifest.json

แบบใหม่ (หลายท่า):  python3 tools/import_pixellab.py <โฟลเดอร์> <prefix> <id> [scale]
   ไฟล์ในโฟลเดอร์: <prefix>__rot.png (1×8 ภาพหมุน) และ <prefix>__<ชื่อท่า PixelLab>.png (8 แถว × n เฟรม)
แบบเดิม (ชีตเดียว): python3 tools/import_pixellab.py <sheet.png> <id> [scale]
   แถว 0 = ภาพหมุน 8 ทิศ, แถว 1..8 = walk

 - ทิศที่ไม่มี → กลับด้านจากทิศตรงข้าม (east↔west, NE↔NW, SE↔SW)
 - walk ที่ไม่มีทั้งทิศ → ภาพหมุนนิ่ง + ขยับ · ท่าอื่นที่ไม่มีทิศ → ใช้ทิศใกล้สุดที่มี
"""
import glob, json, os, re, sys
from PIL import Image, ImageOps

DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
MIRROR = {'west': 'east', 'east': 'west', 'north-west': 'north-east', 'north-east': 'north-west',
          'south-west': 'south-east', 'south-east': 'south-west'}
NEAR = {'north-west': ['north', 'west'], 'south-west': ['south', 'west'], 'west': ['south-west', 'north-west', 'south'],
        'north-east': ['north', 'east'], 'south-east': ['south', 'east'], 'east': ['south-east', 'north-east', 'south'],
        'north': ['north-east', 'north-west', 'south'], 'south': ['south-east', 'south-west', 'east']}
# ชื่อท่า PixelLab → ชื่อท่าในเกม
ANIM_MAP = [(r'^walk', 'walk'), (r'sword|slash', 'slash'), (r'bow|arrow|shoot', 'shoot'), (r'punch|jab|uppercut|kick|attack|strike', 'attack'), (r'fireball|cast|spell|staff|magic', 'cast'),
            (r'death|die|dying', 'die'), (r'taking|hurt|hit', 'hit'), (r'^idle|breath', 'idle_anim')]
OUT = 72
ROOT = os.path.join(os.path.dirname(__file__), '..', 'client', 'assets', 'td')


def crop(c):
    """ครอบกลางเฟรมให้เหลือ OUT×OUT"""
    if not c.getbbox():
        return None
    C = c.width; o = (C - OUT) // 2
    if o >= 0:
        return c.crop((o, o, o + OUT, o + OUT))
    pad = Image.new('RGBA', (OUT, OUT)); pad.alpha_composite(c, (-o, -o)); return pad


def bob(fr, dy):
    if dy == 0 or not fr.getbbox():
        return fr
    x0, y0, x1, y1 = fr.getbbox()
    body = fr.crop((x0, y0, x1, y1)).resize((x1 - x0, max(1, y1 - y0 - dy)), Image.NEAREST)
    out = Image.new('RGBA', fr.size); out.alpha_composite(body, (x0, y0 + dy)); return out


# ท่าโจมตี: ทิศเฉียงใช้ท่ามองข้าง (อ่านท่าฟัน/ยิงชัดกว่าหันหน้า/หลัง)
NEAR_SIDE = {'south-east': ['east', 'south'], 'north-east': ['east', 'north'], 'south-west': ['west', 'south'], 'north-west': ['west', 'north']}


def fill_dirs(frames, rot, is_walk, side_first=False):
    """frames: {dir: [img...]} → ครบ 8 ทิศ"""
    real = sorted(frames)
    for d in DIRS:
        if d not in frames and MIRROR.get(d) in real:
            frames[d] = [ImageOps.mirror(f) for f in frames[MIRROR[d]]]
    for d in DIRS:
        if d in frames:
            continue
        if is_walk:
            frames[d] = [bob(rot[d], v) for v in (0, 1, 2, 1, 0, 1)]
        else:
            near = NEAR_SIDE.get(d, NEAR[d]) if side_first else NEAR[d]
            src = next((n for n in near if n in frames), None) or next(iter(frames))
            frames[d] = frames[src]
    return real


def write(sid, anims, rot, scale):
    os.makedirs(os.path.join(ROOT, sid), exist_ok=True)
    counts = {}
    idle = Image.new('RGBA', (OUT * 4, OUT * 8))
    for r, d in enumerate(DIRS):
        for k, v in enumerate((0, 0, 1, 1)):
            idle.alpha_composite(bob(rot[d], v), (k * OUT, r * OUT))
    idle.save(os.path.join(ROOT, sid, 'idle.png'), optimize=True); counts['idle'] = 4
    for name, frames in anims.items():
        n = max(len(f) for f in frames.values())
        sh = Image.new('RGBA', (OUT * n, OUT * 8))
        for r, d in enumerate(DIRS):
            for k, f in enumerate(frames[d]):
                sh.alpha_composite(f, (k * OUT, r * OUT))
        sh.save(os.path.join(ROOT, sid, f'{name}.png'), optimize=True); counts[name] = n
    mp = os.path.join(ROOT, 'manifest.json')
    man = json.load(open(mp)) if os.path.exists(mp) else {'sprites': {}, 'images': []}
    old = man['sprites'].get(sid, {})
    ent = {'anims': list(counts), 'frames': counts, 'frame': OUT}
    sc = scale or (old.get('scale') if isinstance(old, dict) else None)
    if sc:
        ent['scale'] = float(sc)
    man['sprites'][sid] = ent
    json.dump(man, open(mp, 'w'), ensure_ascii=False, indent=1)


def game_name(pl):
    for pat, g in ANIM_MAP:
        if re.search(pat, pl):
            return g
    return None


def from_folder(folder, prefix, sid, scale=None):
    rs = Image.open(os.path.join(folder, f'{prefix}__rot.png')).convert('RGBA'); C = rs.width // 8
    rot = {d: crop(rs.crop((i * C, 0, i * C + C, C))) for i, d in enumerate(DIRS)}
    anims, report, raw = {}, [], {}
    for f in sorted(glob.glob(os.path.join(folder, f'{prefix}__*.png'))):
        pl = os.path.basename(f)[len(prefix) + 2:-4]
        g = game_name(pl)
        if pl == 'rot' or not g:
            continue
        im = Image.open(f).convert('RGBA'); C = im.height // 8; n = im.width // C
        frames = {}
        for i, d in enumerate(DIRS):
            fr = [crop(im.crop((k * C, i * C, k * C + C, i * C + C))) for k in range(n)]
            fr = [x for x in fr if x]
            if g in ('slash', 'shoot', 'cast') and len(fr) >= 8:
                fr = fr[2:]                                   # ตัดเฟรมยืนเตรียม 2 เฟรมแรกของท่า custom → ออกท่าไวขึ้น
            if fr:
                frames[d] = fr
        if not frames:
            continue
        if g in anims:                                        # ท่าเดียวกันหลายไฟล์ → รวมทิศ (ไฟล์แรกมาก่อน)
            for d, fr in frames.items():
                if d not in raw[g]:
                    raw[g][d] = fr
            continue
        raw[g] = dict(frames)
        anims[g] = frames; report.append(f'{g}({pl})')
    for g in anims:
        anims[g] = dict(raw[g])
        real = fill_dirs(anims[g], rot, g == 'walk', g in ('slash', 'shoot', 'cast'))
        report.append(f'{g} จริง {real}')
    if 'walk' not in anims:
        anims['walk'] = {}; fill_dirs(anims['walk'], rot, True)
    anims.pop('idle_anim', None)
    write(sid, anims, rot, scale)
    print(sid, '·', ' | '.join(report))


def from_sheet(src, sid, scale=None):
    im = Image.open(src).convert('RGBA'); C = im.width // 8
    rot = {d: crop(im.crop((i * C, 0, i * C + C, C))) for i, d in enumerate(DIRS)}
    walk = {}
    for i, d in enumerate(DIRS):
        fr = [crop(im.crop((k * C, (i + 1) * C, k * C + C, (i + 2) * C))) for k in range(6)]
        if all(fr):
            walk[d] = fr
    real = fill_dirs(walk, rot, True)
    write(sid, {'walk': walk}, rot, scale)
    print(sid, '· walk จริง', real)


if __name__ == '__main__':
    a = sys.argv[1:]
    if os.path.isdir(a[0]):
        from_folder(*a)
    else:
        from_sheet(*a)
