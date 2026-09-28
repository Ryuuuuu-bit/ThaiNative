#!/usr/bin/env python3
"""ไอคอนสกิลหมอยา 6 อัน (sk_heal_*) วาดแบบพิกเซล 24px แล้วขยาย ×2 = 48px · กรอบเขียวเข้มขอบทองแบบไอคอนสกิลเดิม"""
import json, os, math
from PIL import Image, ImageDraw
D = os.path.join(os.path.dirname(__file__), '..', 'client', 'assets', 'icons')
N = 24
GOLD, GOLDD, GOLDL = (222, 178, 70, 255), (150, 100, 30, 255), (255, 232, 150, 255)

def frame(bg1, bg2):
    im = Image.new('RGBA', (N, N)); px = im.load()
    for y in range(N):
        t = y / (N - 1)
        c = tuple(int(bg1[i] * (1 - t) + bg2[i] * t) for i in range(3)) + (255,)
        for x in range(N): px[x, y] = c
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, N - 1, N - 1], outline=GOLDD); d.rectangle([1, 1, N - 2, N - 2], outline=GOLD)
    for x, y in [(1, 1), (N - 2, 1), (1, N - 2), (N - 2, N - 2)]: px[x, y] = GOLDL
    return im, d, px

def glow(px, cx, cy, r, col, a=0.5):
    for y in range(2, N - 2):
        for x in range(2, N - 2):
            k = max(0, 1 - math.hypot(x - cx, y - cy) / r) * a
            if k > 0:
                o = px[x, y]; px[x, y] = tuple(int(o[i] * (1 - k) + col[i] * k) for i in range(3)) + (255,)

def save(name, im):
    im.resize((48, 48), Image.NEAREST).save(os.path.join(D, f'sk_{name}.png'), optimize=True)

G1, G2, G3 = (40, 120, 60, 255), (90, 200, 90, 255), (170, 255, 150, 255)
# 1 สายใยสมุนไพร: เถาโค้ง + ใบ + หยดน้ำ
im, d, px = frame((18, 60, 44), (8, 28, 22)); glow(px, 12, 12, 11, (60, 200, 140))
pts = [(4, 18), (7, 14), (11, 12), (15, 10), (19, 6)]
d.line(pts, fill=G1, width=2); d.line([(p[0], p[1] - 1) for p in pts], fill=G2, width=1)
for (x, y) in [(7, 12), (12, 14), (16, 8)]: d.ellipse([x - 2, y - 1, x + 1, y + 1], fill=G3); px[x, y] = G2
d.ellipse([18, 4, 21, 7], fill=(255, 170, 210, 255)); px[19, 5] = (255, 255, 255, 255)
for (x, y) in [(5, 16), (10, 17)]: d.ellipse([x, y, x + 1, y + 2], fill=(130, 220, 255, 255))
save('heal_vine', im)
# 2 ลูกกลอนเด้ง: เส้นโค้งกระโดด 3 ครั้ง + ลูกกลอน
im, d, px = frame((30, 56, 30), (12, 24, 12)); glow(px, 16, 12, 9, (150, 255, 120), 0.35)
d.arc([2, 8, 10, 22], 180, 360, fill=(200, 255, 210, 255)); d.arc([9, 6, 17, 20], 180, 360, fill=(200, 255, 210, 255)); d.arc([15, 9, 22, 21], 180, 290, fill=(200, 255, 210, 255))
d.ellipse([15, 13, 21, 19], fill=(90, 150, 50, 255)); d.ellipse([16, 14, 19, 17], fill=(180, 230, 110, 255)); px[17, 14] = (255, 255, 230, 255)
for x, y in [(4, 15), (10, 13), (16, 15)]: px[x, y] = GOLDL
save('heal_pill', im)
# 3 เมล็ดพันธุ์ชีวา: ต้นอ่อน + ดอกชมพู + วงทอง
im, d, px = frame((24, 50, 36), (10, 22, 16)); glow(px, 12, 11, 10, (255, 170, 210), 0.35)
d.arc([4, 4, 19, 19], -90, 200, fill=GOLD)
d.line([(12, 20), (12, 9)], fill=G1, width=2)
d.ellipse([6, 12, 11, 15], fill=G2); d.ellipse([13, 10, 18, 13], fill=G2)
d.ellipse([9, 5, 15, 10], fill=(255, 140, 190, 255)); d.ellipse([11, 6, 13, 8], fill=(255, 240, 246, 255))
d.ellipse([8, 19, 16, 21], fill=(110, 70, 30, 255))
save('heal_seed', im)
# 4 ยาต้มพยัคฆ์เหิน: หม้อ + ไฟ + ลายเสือ
im, d, px = frame((80, 34, 10), (34, 12, 4)); glow(px, 12, 10, 10, (255, 150, 60), 0.5)
d.ellipse([5, 11, 19, 21], fill=(58, 40, 28, 255)); d.rectangle([5, 13, 19, 14], fill=GOLD)
d.ellipse([6, 9, 18, 13], fill=(90, 60, 40, 255)); d.ellipse([8, 10, 16, 12], fill=(255, 160, 60, 255))
for x in (8, 12, 16): d.polygon([(x - 2, 9), (x, 3), (x + 2, 9)], fill=(255, 190, 90, 255)); px[x, 6] = (255, 250, 220, 255)
for x in (8, 11, 14, 17): d.line([(x, 16), (x + 1, 19)], fill=(20, 10, 5, 255))
save('heal_tiger', im)
# 5 พิธีสู่ขวัญ: บายศรี 5 ชั้น + เทียน + แสงทอง
im, d, px = frame((40, 70, 40), (14, 26, 14)); glow(px, 12, 8, 12, (255, 230, 140), 0.55)
for i, (w, y) in enumerate([(14, 18), (11, 15), (8, 12), (6, 9), (4, 7)]):
    d.polygon([(12 - w // 2, y + 3), (12 + w // 2, y + 3), (12 + w // 2 - 1, y), (12 - w // 2 + 1, y)], fill=(80 + i * 15, 190 + i * 10, 80, 255)); d.line([(12 - w // 2 + 1, y + 3), (12 + w // 2 - 1, y + 3)], fill=(255, 246, 210, 255))
d.line([(12, 2), (12, 6)], fill=GOLDL); px[12, 2] = (255, 255, 255, 255)
for x in (3, 20): d.rectangle([x, 15, x + 1, 21], fill=(255, 243, 196, 255)); px[x, 14] = (255, 180, 70, 255); px[x + 1, 14] = (255, 220, 120, 255)
save('heal_khwan', im)
# 6 ครกยาระเบิด: ครก + สาก + ผงเขียวแตก
im, d, px = frame((36, 50, 40), (14, 20, 16)); glow(px, 12, 14, 10, (120, 255, 170), 0.45)
d.polygon([(4, 13), (20, 13), (18, 20), (6, 20)], fill=(120, 120, 110, 255)); d.ellipse([4, 11, 20, 15], fill=(90, 90, 84, 255)); d.ellipse([6, 12, 18, 14], fill=(50, 140, 70, 255))
d.line([(15, 3), (11, 12)], fill=(150, 110, 70, 255), width=3); d.ellipse([9, 10, 13, 13], fill=(170, 130, 80, 255))
for (x, y) in [(4, 8), (6, 5), (19, 7), (21, 11), (3, 11), (18, 4)]: px[x, y] = (150, 255, 180, 255)
for (x, y) in [(5, 7), (20, 8)]: px[x, y] = GOLDL
save('heal_mortar', im)

mp = os.path.join(D, '..', 'manifest.json'); raw = open(mp).read(); have = json.load(open(mp))['icons']
add = [f'sk_heal_{n}' for n in ('vine', 'pill', 'seed', 'tiger', 'khwan', 'mortar') if f'sk_heal_{n}' not in have]
if add:
    raw = raw.replace('  "icons": {\n', '  "icons": {\n' + ''.join(f'    "{a}": "assets/icons/{a}.png",\n' for a in add), 1)
    open(mp, 'w').write(raw)
print('ok', add)
