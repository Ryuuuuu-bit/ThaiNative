#!/usr/bin/env python3
"""ไอคอนเคล็ดวิชาผสม 5 อัน (sk_hy_*) — กรอบแบ่งครึ่งสองสีตามกิ่ง + สัญลักษณ์ท่า · 24px ขยาย ×2"""
import json, os
from PIL import Image, ImageDraw
D = os.path.join(os.path.dirname(__file__), '..', 'client', 'assets', 'icons'); N = 24
COL = {'swordman': (150, 40, 36), 'mage': (90, 50, 130), 'healer': (30, 110, 95), 'archer': (40, 100, 55), 'boxer': (150, 80, 30)}
GOLD, GOLDD, W = (222, 178, 70, 255), (150, 100, 30, 255), (255, 250, 230, 255)
def base(a, b):
    im = Image.new('RGBA', (N, N)); d = ImageDraw.Draw(im); px = im.load()
    for y in range(N):
        for x in range(N):
            c = COL[a] if x + y < N else COL[b]; k = 0.55 + 0.45 * (1 - y / N); px[x, y] = tuple(int(v * k) for v in c) + (255,)
    d.line([(1, N - 2), (N - 2, 1)], fill=GOLD); d.rectangle([0, 0, N - 1, N - 1], outline=GOLDD); d.rectangle([1, 1, N - 2, N - 2], outline=GOLD)
    return im, d, px
def save(n, im): im.resize((48, 48), Image.NEAREST).save(os.path.join(D, f'sk_{n}.png'), optimize=True)
im, d, px = base('swordman', 'mage')                                      # ดาบลงอาคม
d.line([(5, 18), (17, 6)], fill=(220, 230, 240, 255), width=2); d.line([(6, 19), (18, 7)], fill=(150, 160, 175, 255)); d.line([(4, 14), (9, 19)], fill=GOLD, width=2)
for x, y in [(17, 4), (20, 7), (14, 3), (19, 11)]: px[x, y] = (210, 160, 255, 255)
save('hy_spellblade', im)
im, d, px = base('mage', 'healer')                                        # น้ำมนต์ยาลงยันต์
d.ellipse([7, 9, 17, 19], fill=(120, 200, 255, 255)); d.polygon([(12, 3), (8, 11), (16, 11)], fill=(120, 200, 255, 255)); d.ellipse([9, 11, 12, 14], fill=W)
d.rectangle([15, 14, 19, 20], fill=(255, 243, 196, 255)); d.line([(16, 16), (18, 16)], fill=(190, 40, 40, 255)); d.line([(16, 18), (18, 18)], fill=(190, 40, 40, 255))
save('hy_holywater', im)
im, d, px = base('healer', 'archer')                                      # ศรอาบว่าน
d.line([(4, 19), (18, 5)], fill=(140, 100, 60, 255), width=2); d.polygon([(19, 4), (14, 6), (17, 9)], fill=(160, 255, 140, 255))
d.polygon([(4, 19), (4, 15), (7, 18)], fill=W); d.ellipse([10, 11, 13, 14], fill=(80, 220, 90, 255)); d.ellipse([6, 7, 9, 10], fill=(80, 220, 90, 255))
save('hy_herbarrow', im)
im, d, px = base('archer', 'boxer')                                       # วานรพลิกลม
d.arc([4, 4, 20, 20], 200, 520, fill=W); d.ellipse([10, 5, 15, 10], fill=(170, 110, 60, 255)); d.line([(12, 10), (12, 15)], fill=(170, 110, 60, 255), width=2)
d.line([(12, 15), (17, 19)], fill=(170, 110, 60, 255), width=2); d.line([(12, 15), (8, 19)], fill=(170, 110, 60, 255), width=2); d.line([(12, 12), (18, 9)], fill=(170, 110, 60, 255), width=2)
save('hy_monkey', im)
im, d, px = base('boxer', 'swordman')                                     # กระบี่กระบองหมุน
for r, c in [(9, (255, 220, 150, 255)), (6, W)]: d.arc([12 - r, 12 - r, 12 + r, 12 + r], 0, 300, fill=c)
d.line([(6, 17), (18, 7)], fill=(160, 110, 60, 255), width=3); d.rectangle([5, 16, 8, 19], fill=GOLD); d.rectangle([16, 5, 19, 8], fill=GOLD)
save('hy_krabi', im)
mp = os.path.join(D, '..', 'manifest.json'); raw = open(mp).read(); have = json.load(open(mp))['icons']
add = [f'sk_{n}' for n in ('hy_spellblade', 'hy_holywater', 'hy_herbarrow', 'hy_monkey', 'hy_krabi') if f'sk_{n}' not in have]
if add: raw = raw.replace('  "icons": {\n', '  "icons": {\n' + ''.join(f'    "{a}": "assets/icons/{a}.png",\n' for a in add), 1); open(mp, 'w').write(raw)
print('ok', add)
