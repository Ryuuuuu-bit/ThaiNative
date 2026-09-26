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
# ฉาก/สิ่งปลูกสร้างในเมือง (ภาพนิ่ง): key ในเกม → ไฟล์ใน assets_src/pixellab/env/
ENV = {'house': 'house', 'temple': 'temple', 'stall': 'stall', 'spirit_house': 'spirit_house',
       'sala': 'sala', 'palm': 'palm', 'bg_town': 'bg_town'}
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
                load_clean(src).save(os.path.join(OUT, 'env', f'{key}.png'))
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
    for mid in list(MONSTERS) + list(BOSSES) + list(NPC):
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

    with open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8') as fp:
        json.dump(manifest, fp, ensure_ascii=False, indent=2)
    print('built', len(manifest['monsters']), 'monsters,', len(manifest['npc']), 'npc')


if __name__ == '__main__':
    main()
