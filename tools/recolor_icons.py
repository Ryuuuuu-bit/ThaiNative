#!/usr/bin/env python3
"""สร้างไอคอนอุปกรณ์หมอยา (it_g_healer_* / it_gx_healer_*) จากไอคอนสายขมังเวทย์ โดยย้อมโทนม่วง/น้ำเงิน/แดง → เขียวสมุนไพร
   ทองกับไม้คงเดิม · เพิ่มลง client/assets/manifest.json"""
import colorsys, json, os, glob
from PIL import Image
ROOT = os.path.join(os.path.dirname(__file__), '..', 'client', 'assets')
D = os.path.join(ROOT, 'icons')

def shift(im):
    im = im.convert('RGBA'); px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if not a: continue
            h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            H = h * 360
            if s > 0.18 and (H >= 185 or H < 8):          # ม่วง/ชมพู/น้ำเงิน/แดง → เขียวหยก–เขียวใบไม้
                t = ((H - 185) % 360) / 183                  # 0..1
                H2 = 95 + t * 70
                s2 = min(1, s * 0.95)
                r2, g2, b2 = colorsys.hls_to_rgb(H2 / 360, l, s2)
                px[x, y] = (int(r2 * 255), int(g2 * 255), int(b2 * 255), a)
    return im

man_p = os.path.join(ROOT, 'manifest.json'); raw = open(man_p).read(); have = json.load(open(man_p))['icons']
n, add = 0, []
for f in sorted(glob.glob(os.path.join(D, 'it_g_mage_*.png')) + glob.glob(os.path.join(D, 'it_gx_mage_*.png'))):
    name = os.path.basename(f)[:-4].replace('_mage_', '_healer_')
    shift(Image.open(f)).save(os.path.join(D, name + '.png'), optimize=True)
    n += 1
    if name not in have: add.append(name)
if add:                                                    # แทรกแบบข้อความ ไม่จัดรูปไฟล์ใหม่ทั้งไฟล์
    raw = raw.replace('  "icons": {\n', '  "icons": {\n' + ''.join(f'    "{a}": "assets/icons/{a}.png",\n' for a in add), 1)
    open(man_p, 'w').write(raw)
print('healer icons', n)
