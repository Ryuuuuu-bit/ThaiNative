"""
build_sprites.py – แปลงภาพนิ่งจาก PixelLab (assets_src/pixellab/*.png) เป็น spritesheet พร้อมท่าทาง
แล้วเขียน client/assets/manifest.json ให้เกมโหลดอัตโนมัติ

ใช้:  python tools/build_sprites.py        (ต้องมี Pillow: pip install pillow)

ภาพ PixelLab แบบฟรีเป็นภาพนิ่ง 1 เฟรม สคริปต์นี้สร้างเฟรมเคลื่อนไหวให้เอง:
  walk(4)   – ลอยขึ้นลง / ขยับขา
  attack(3) – ง้าง → พุ่งเข้าใส่ (ขยายเล็กน้อย + เรืองแดง) → กลับ
  hit(1)    – ถอยหลัง + อมแดง
  die(4)    – ยุบตัวและจางหาย
ถ้ามีภาพหลายเฟรมจาก PixelLab (แพ็กเกจเสียเงิน) ให้แก้ฟังก์ชัน frames_for() ให้ใช้ภาพจริงแทน
"""
import json, os
from PIL import Image, ImageEnhance

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets_src', 'pixellab')
OUT = os.path.join(ROOT, 'client', 'assets')

# id → (ไฟล์ต้นฉบับ, ประเภทการเคลื่อนไหว)
MONSTERS = {
    'phi_tuay_kaew': 'float', 'kuman_thong': 'walk', 'krasue': 'float', 'nang_tani': 'float',
    'phi_pob': 'walk', 'phi_jang_nang': 'walk', 'phi_phrai': 'float', 'pret': 'walk',
    'saming': 'walk', 'phi_ha': 'float',
}
NPC = {'npc_maekha': 'npc_maekha'}
# ภาพนิ่งที่ใช้แค่หุ่นตัดต่อ (ไม่ต้องสร้าง spritesheet เก่า): ผีป่าช้า + ชาวบ้าน
BASES_ONLY = ['krahang', 'khamot', 'phi_dip', 'nang_takhian', 'tai_hong', 'phi_phong', 'kong_koi',
              'phi_lang_kluang', 'phi_chamot', 'pret_asura', 'npc_yai_tim', 'npc_lung_chai', 'npc_lung_dam', 'npc_pa_sa']
# ฉาก/สิ่งปลูกสร้างในเมือง (ภาพนิ่ง): key ในเกม → ไฟล์ใน assets_src/pixellab/env/
ENV = {'house': 'house', 'temple': 'temple', 'stall': 'stall', 'spirit_house': 'spirit_house',
       'sala': 'sala', 'palm': 'palm', 'bg_town': 'bg_town',
       'forge': 'forge', 'food_stall': 'food_stall', 'warp_gate': 'warp_gate', 'boat': 'boat'}
# ภาพที่ PixelLab วาดเป็นมุมเฉียง (isometric) → ดัดให้ฐานตรงแนวนอน เข้ากับเกม side-view
ENV_DESKEW = set()   # ใส่ชื่อภาพที่ต้องดัดฐาน เช่น {'temple'}

# บอสเรด
BOSSES = {'phaya_yak': 'walk'}
PAD_X, PAD_TOP = 5, 3
ANIMS = {'walk': 4, 'attack': 3, 'hit': 1, 'die': 4}


def load_clean(path):
    """ตัดพิกเซลโปร่งใสรอบๆ (ไม่นับจุดเล็กๆ ที่หลงเหลือ)"""
    im = Image.open(path).convert('RGBA')
    alpha = im.split()[3].point(lambda a: 255 if a > 60 else 0)
    im.putalpha(Image.eval(im.split()[3], lambda a: a if a > 60 else 0))
    box = alpha.getbbox()
    return im.crop(box)


def strip_bg(im, tol=38):
    """ถ้ามุมภาพทึบ (ไอคอนมีพื้นหลัง) → flood fill จากขอบภาพด้วยสีที่ใกล้เคียงให้โปร่งใส"""
    W, H = im.size
    px = im.load()
    corners = [px[0, 0], px[W - 1, 0], px[0, H - 1], px[W - 1, H - 1]]
    if sum(c[3] > 200 for c in corners) < 3:
        return im
    seen = set()
    stack = [(x, y) for x in range(W) for y in (0, H - 1)] + [(x, y) for y in range(H) for x in (0, W - 1)]
    near = lambda a, b: sum(abs(a[i] - b[i]) for i in range(3)) <= tol
    while stack:
        x, y = stack.pop()
        if (x, y) in seen or not (0 <= x < W and 0 <= y < H):
            continue
        seen.add((x, y))
        c = px[x, y]
        if c[3] == 0 or any(near(c, k) for k in corners):
            px[x, y] = (0, 0, 0, 0)
            stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    return im


def deskew_base(img):
    """หาเส้นขอบล่างของภาพ (ฐานอาคาร) ที่เอียง แล้วเลื่อนแต่ละคอลัมน์ลงให้ฐานเป็นแนวนอน"""
    W, H = img.size
    px = img.load()
    xs, ys = [], []
    for x in range(W):
        bottom = max((y for y in range(H) if px[x, y][3] > 60), default=None)
        if bottom is not None:
            xs.append(x); ys.append(bottom)
    n = len(xs)
    if n < 2:
        return img
    mx, my = sum(xs) / n, sum(ys) / n
    k = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / max(1e-6, sum((x - mx) ** 2 for x in xs))
    b = my - k * mx
    base = max(b, k * (W - 1) + b)
    out = Image.new('RGBA', (W, H + int(abs(k) * W) + 2), (0, 0, 0, 0))
    for x in range(W):
        shift = int(round(base - (k * x + b)))
        out.paste(img.crop((x, 0, x + 1, H)), (x, shift))
    return out.crop(out.getbbox())


def tint(img, rgb, amount):
    r, g, b = rgb
    over = Image.new('RGBA', img.size, (r, g, b, 0))
    out = img.copy()
    px, po = out.load(), over.load()
    for y in range(img.height):
        for x in range(img.width):
            pr, pg, pb, pa = px[x, y]
            if pa:
                px[x, y] = (int(pr + (r - pr) * amount), int(pg + (g - pg) * amount), int(pb + (b - pb) * amount), pa)
    return out


def shift_legs(img, dx):
    """ขยับส่วนล่าง 30% ของภาพไปซ้าย/ขวา ให้ดูเหมือนก้าวขา"""
    out = img.copy()
    cut = int(img.height * 0.7)
    legs = img.crop((0, cut, img.width, img.height))
    out.paste((0, 0, 0, 0), (0, cut, img.width, img.height))
    out.alpha_composite(legs, (max(0, dx), cut), (max(0, -dx), 0))
    return out


def frames_for(base, kind):
    W, H = base.width + PAD_X * 2, base.height + PAD_TOP + 1
    def place(img, dx=0, dy=0, alpha=1.0):
        f = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        x = (W - img.width) // 2 + dx
        y = H - 1 - img.height + dy
        if alpha < 1:
            a = img.split()[3].point(lambda v: int(v * alpha))
            img = img.copy(); img.putalpha(a)
        f.alpha_composite(img, (x, y))
        return f

    frames = []
    # walk / idle
    if kind == 'float':
        frames += [place(base, 0, d) for d in (0, -1, -2, -1)]
    else:
        frames += [place(base, 0, 0), place(shift_legs(base, 1), 0, -1), place(base, 0, 0), place(shift_legs(base, -1), 0, -1)]
    # attack: ง้าง → พุ่ง → กลับ
    big = base.resize((round(base.width * 1.08), round(base.height * 1.08)), Image.NEAREST)
    frames += [place(base, -2, 0), place(tint(big, (255, 60, 40), 0.25), 4, 0), place(base, 2, 0)]
    # hit
    frames += [place(tint(base, (255, 80, 80), 0.35), -3, 0)]
    # die: ยุบ + จาง
    for i, k in enumerate((0.9, 0.7, 0.45, 0.2)):
        h = max(1, round(base.height * (0.55 + 0.45 * k)))
        sq = base.resize((base.width, h), Image.NEAREST)
        frames.append(place(sq, 0, 0, k))
    return frames, W, H


def sheet(frames, W, H, path):
    s = Image.new('RGBA', (W * len(frames), H), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        s.alpha_composite(f, (i * W, 0))
    s.save(path)


def main():
    os.makedirs(os.path.join(OUT, 'monsters'), exist_ok=True)
    os.makedirs(os.path.join(OUT, 'npc'), exist_ok=True)
    manifest = {'_comment': 'สร้างโดย tools/build_sprites.py จากภาพ PixelLab – เฟรมเรียงแถวเดียวตามลำดับ anims',
                'monsters': {}, 'npc': {}}

    for mid, kind in MONSTERS.items():
        src = os.path.join(SRC, f'{mid}.png')
        if not os.path.exists(src):
            continue
        frames, W, H = frames_for(load_clean(src), kind)
        sheet(frames, W, H, os.path.join(OUT, 'monsters', f'{mid}.png'))
        manifest['monsters'][mid] = {'file': f'assets/monsters/{mid}.png', 'frameWidth': W, 'frameHeight': H,
                                     'anims': ANIMS, 'rates': {'walk': 5 if kind == 'float' else 6, 'attack': 8, 'hit': 6, 'die': 8}}

    for key, name in NPC.items():
        src = os.path.join(SRC, f'{name}.png')
        if not os.path.exists(src):
            continue
        base = load_clean(src)
        W, H = base.width + 2, base.height + 2
        frames = []
        for dy in (0, -1):
            f = Image.new('RGBA', (W, H), (0, 0, 0, 0)); f.alpha_composite(base, (1, H - base.height + dy - 0)); frames.append(f)
        sheet(frames, W, H, os.path.join(OUT, 'npc', f'{key}.png'))
        manifest['npc'][key] = {'file': f'assets/npc/{key}.png', 'frameWidth': W, 'frameHeight': H,
                                'anims': {'idle': 2}, 'rates': {'idle': 2}}

    # ฉากเมือง
    edir = os.path.join(SRC, 'env')
    manifest['env'] = {}
    if os.path.isdir(edir):
        os.makedirs(os.path.join(OUT, 'env'), exist_ok=True)
        for key, name in ENV.items():
            src = os.path.join(edir, f'{name}.png')
            if os.path.exists(src):
                im = load_clean(src)
                if key in ENV_DESKEW:
                    im = deskew_base(im)
                im.save(os.path.join(OUT, 'env', f'{key}.png'))
                manifest['env'][key] = f'assets/env/{key}.png'

    # บอสเรด (สร้างท่าทางแบบเดียวกับผี)
    manifest['bosses'] = {}
    for bid, kind in BOSSES.items():
        src = os.path.join(SRC, 'bosses', f'{bid}.png')
        if not os.path.exists(src):
            continue
        os.makedirs(os.path.join(OUT, 'bosses'), exist_ok=True)
        frames, W, H = frames_for(load_clean(src), kind)
        sheet(frames, W, H, os.path.join(OUT, 'bosses', f'{bid}.png'))
        manifest['bosses'][bid] = {'file': f'assets/bosses/{bid}.png', 'frameWidth': W, 'frameHeight': H,
                                   'anims': ANIMS, 'rates': {'walk': 4, 'attack': 5, 'hit': 6, 'die': 5}}

    # ภาพนิ่งต้นฉบับของผี/บอส → เกมสร้างท่าทางแบบหุ่นตัดต่อ (client/js/gfx/Rig.js) ตอนรัน
    os.makedirs(os.path.join(OUT, 'bases'), exist_ok=True)
    manifest['monsterBases'] = {}
    for mid in list(MONSTERS) + list(BOSSES) + list(NPC) + BASES_ONLY:
        src = os.path.join(SRC, 'bosses', f'{mid}.png') if mid in BOSSES else os.path.join(SRC, f'{mid}.png')
        if os.path.exists(src):
            load_clean(src).save(os.path.join(OUT, 'bases', f'{mid}.png'))
            manifest['monsterBases'][mid] = f'assets/bases/{mid}.png'

    # ตัวละครผู้เล่น: คัดลอกภาพต้นฉบับ (เกมย้อมสี + สร้างท่าทางเองตอนรัน)
    pdir = os.path.join(SRC, 'players')
    if os.path.isdir(pdir):
        os.makedirs(os.path.join(OUT, 'players'), exist_ok=True)
        manifest['players'] = {}
        for f in sorted(os.listdir(pdir)):
            if f.endswith('.png'):
                Image.open(os.path.join(pdir, f)).save(os.path.join(OUT, 'players', f))
                manifest['players'][f[:-4]] = f'assets/players/{f}'

    # ไอคอนไอเทม / สกิล (32x32): it_<itemId>.png, sk_<skillId>.png → ลบพื้นหลังทึบที่มุมภาพ
    idir = os.path.join(SRC, 'icons')
    manifest['icons'] = {}
    if os.path.isdir(idir):
        os.makedirs(os.path.join(OUT, 'icons'), exist_ok=True)
        for f in sorted(os.listdir(idir)):
            if f.endswith('.png'):
                im = strip_bg(Image.open(os.path.join(idir, f)).convert('RGBA'))
                im.save(os.path.join(OUT, 'icons', f))
                manifest['icons'][f[:-4]] = f'assets/icons/{f}'

    with open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8') as fp:
        json.dump(manifest, fp, ensure_ascii=False, indent=2)
    print('built', len(manifest['monsters']), 'monsters,', len(manifest['npc']), 'npc')


if __name__ == '__main__':
    main()
