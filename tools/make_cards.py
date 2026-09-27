"""ภาพหน้าการ์ดผี 20 ใบ → client/assets/cards/<mon>.png (80×80 พิกเซลอาร์ต พื้นใส)
แหล่งภาพ: ผี top-down (td/mob_*/idle.png ทิศใต้) → ผีโลกเก่า (monsters/*.png เฟรมแรก) → วาดวิญญาณจากสีประจำตัว
ใช้: python tools/make_cards.py
"""
import hashlib, json, math, os, re, subprocess
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..')
A = os.path.join(ROOT, 'client', 'assets')
OUT = os.path.join(A, 'cards')
SIZE = 80


def monsters():
    src = subprocess.check_output(['node', '-e', "import('./shared/data/monsters.js').then(({MONSTERS})=>console.log(JSON.stringify(Object.fromEntries(Object.entries(MONSTERS).map(([k,m])=>[k,{lv:m.level,pal:m.palette||null,beh:m.behavior,d8:m.d8||null,tint:m.tint||null,realm:!!m.realm}])))))"], cwd=ROOT)
    return json.loads(src)


def fit(im):
    bb = im.getbbox()
    if not bb:
        return None
    im = im.crop(bb)
    k = min((SIZE - 8) / im.width, (SIZE - 6) / im.height)
    k = max(1, math.floor(k)) if k >= 1 else k                    # ขยายเป็นจำนวนเต็ม (คมแบบพิกเซล)
    im = im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.NEAREST)
    out = Image.new('RGBA', (SIZE, SIZE))
    out.paste(im, ((SIZE - im.width) // 2, SIZE - im.height - 3), im)
    return out


def from_td(mon):
    f = os.path.join(A, 'td', f'mob_{mon}', 'idle.png')
    if not os.path.exists(f):
        return None
    im = Image.open(f).convert('RGBA'); C = im.height // 8
    return fit(im.crop((0, 0, C, C)))                               # แถวแรก = ทิศใต้


def from_side(mon, man):
    e = man.get('monsters', {}).get(mon)
    if not e:
        return None
    im = Image.open(os.path.join(ROOT, 'client', e['file'])).convert('RGBA')
    return fit(im.crop((0, 0, e['frameWidth'], e['frameHeight'])))


def from_src(mon):
    """ภาพจาก PixelLab (Create Object 64px) ที่ตัดเก็บไว้ใน tools/card_src/"""
    f = os.path.join(os.path.dirname(__file__), 'card_src', f'{mon}.png')
    return fit(Image.open(f).convert('RGBA')) if os.path.exists(f) else None


def from_borrow(mon, m):
    """ผีแดนใหม่ที่ยังไม่มีภาพจริง: ยืมภาพ 8 ทิศของผีอื่น (d8) + ย้อมสี (tint) แบบเดียวกับในเกม"""
    if not (m.get('realm') and m.get('d8')):
        return None
    im = from_td(m['d8'])
    if im is None:
        return None
    t = m.get('tint')
    if t:
        r, g, b = (t >> 16) & 255, (t >> 8) & 255, t & 255
        px = im.load()
        for y in range(im.height):
            for x in range(im.width):
                R, G, B, A_ = px[x, y]
                if A_:
                    px[x, y] = (R * r // 255, G * g // 255, B * b // 255, A_)
    return im


def hexc(h, a=255):
    h = h.lstrip('#'); return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def spirit(mon, pal):
    """ไม่มีภาพ → วิญญาณเรืองแสงตามสีประจำตัว (ใช้สีจาก hash ถ้าไม่มี palette)"""
    if not pal:
        hv = int(hashlib.md5(mon.encode()).hexdigest()[:6], 16)
        hue = hv % 360
        import colorsys
        r, g, b = colorsys.hls_to_rgb(hue / 360, 0.55, 0.55); main = '#%02x%02x%02x' % (int(r * 255), int(g * 255), int(b * 255))
        r, g, b = colorsys.hls_to_rgb(hue / 360, 0.2, 0.5); dark = '#%02x%02x%02x' % (int(r * 255), int(g * 255), int(b * 255))
        pal = {'main': main, 'dark': dark, 'glow': '#f7f3e3'}
    S = 40
    im = Image.new('RGBA', (S, S))
    d = ImageDraw.Draw(im)
    glow = Image.new('RGBA', (S, S)); ImageDraw.Draw(glow).ellipse((6, 4, 34, 36), fill=hexc(pal['main'], 110))
    im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(3)))
    # หัวกลม + ตัวเป็นหางพลิ้ว
    d.ellipse((12, 6, 28, 22), fill=hexc(pal['main']), outline=hexc(pal['dark']))
    d.polygon([(12, 15), (28, 15), (30, 30), (25, 26), (20, 34), (15, 26), (10, 30)], fill=hexc(pal['main']), outline=hexc(pal['dark']))
    d.rectangle((15, 12, 17, 15), fill=hexc(pal['dark'])); d.rectangle((23, 12, 25, 15), fill=hexc(pal['dark']))
    d.point([(16, 13), (24, 13)], fill=hexc(pal['glow']))
    d.line((17, 19, 23, 19), fill=hexc(pal['dark']))
    return fit(im)


def main():
    os.makedirs(OUT, exist_ok=True)
    man = json.load(open(os.path.join(A, 'manifest.json')))
    mons = monsters()
    for mon, m in mons.items():
        im = from_td(mon) or from_side(mon, man) or from_src(mon) or from_borrow(mon, m) or spirit(mon, m['pal'])
        src = 'td' if os.path.exists(os.path.join(A, 'td', f'mob_{mon}')) else 'side' if man.get('monsters', {}).get(mon) else 'pixellab' if os.path.exists(os.path.join(os.path.dirname(__file__), 'card_src', f'{mon}.png')) else 'spirit'
        im.save(os.path.join(OUT, f'{mon}.png'), optimize=True)
        print(f'{mon:16s} Lv.{m["lv"]:<3} {src}')




def menu_icon():
    """ไอคอนเมนู 'การ์ดผี' 48×48 (โทนเดียวกับ ui_menu_*) → assets/icons/ui_menu_card.png + ลง manifest"""
    OL, GOLD, GOLD2, CREAM, BRN = (43, 24, 16, 255), (232, 178, 58, 255), (170, 110, 30, 255), (240, 222, 178, 255), (122, 74, 38, 255)
    PUR, PUR2, GH, RED = (58, 34, 84, 255), (92, 56, 130, 255), (196, 240, 214, 255), (190, 40, 48, 255)

    def card(w, h, front):
        im = Image.new('RGBA', (w, h)); d = ImageDraw.Draw(im)
        d.rounded_rectangle((0, 0, w - 1, h - 1), 3, fill=OL)
        d.rounded_rectangle((1, 1, w - 2, h - 2), 3, fill=GOLD if front else BRN)
        d.rectangle((2, h - 4, w - 3, h - 3), fill=GOLD2 if front else (90, 52, 26, 255))
        d.rectangle((3, 3, w - 4, h - 5), fill=OL)
        d.rectangle((4, 4, w - 5, h - 6), fill=PUR if front else CREAM)
        if front:
            d.rectangle((4, 4, w - 5, 9), fill=PUR2)
            cx = w // 2   # ผีน้อยกลางการ์ด
            d.ellipse((cx - 6, 10, cx + 6, 22), fill=GH, outline=OL)
            d.polygon([(cx - 6, 17), (cx + 6, 17), (cx + 7, 27), (cx + 3, 24), (cx, 28), (cx - 3, 24), (cx - 7, 27)], fill=GH, outline=OL)
            d.rectangle((cx - 3, 14, cx - 2, 16), fill=OL); d.rectangle((cx + 2, 14, cx + 3, 16), fill=OL)
            d.rectangle((6, h - 11, w - 7, h - 10), fill=GOLD2); d.rectangle((6, h - 8, w - 12, h - 8), fill=GOLD2)
        else:
            for y in range(8, h - 8, 4):
                d.line((7, y, w - 8, y), fill=(200, 176, 128, 255))
        return im
    out = Image.new('RGBA', (48, 48))
    back = card(24, 34, False).rotate(14, expand=True, resample=Image.NEAREST)
    out.alpha_composite(back, (4, 5))
    front = card(26, 36, True).rotate(-8, expand=True, resample=Image.NEAREST)
    out.alpha_composite(front, (15, 7))
    d = ImageDraw.Draw(out)                        # ตราครั่งแดงมุมล่าง
    d.ellipse((30, 34, 40, 44), fill=RED, outline=OL); d.point([(33, 37), (34, 37)], fill=(240, 120, 110, 255))
    path = os.path.join(A, 'icons', 'ui_menu_card.png'); out.save(path, optimize=True)
    man = json.load(open(os.path.join(A, 'manifest.json')))
    man['icons']['ui_menu_card'] = 'assets/icons/ui_menu_card.png'
    json.dump(man, open(os.path.join(A, 'manifest.json'), 'w'), ensure_ascii=False, indent=2)
    print('menu icon', path)


if __name__ == '__main__':
    main()
    menu_icon()
