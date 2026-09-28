#!/usr/bin/env python3
"""นำเข้าชุดแต่งตัว 8 ทิศจาก PixelLab (ชีทแนวนอน 8 ช่อง เรียง south..south-west)
   python3 tools/import_cos.py <sheet.png> <itemId>
   → client/assets/td/cos/<itemId>.png (ตัดขอบร่วมทุกทิศ) + ไอคอน assets/icons/it_<itemId>.png (48px จากทิศใต้)"""
import json, os, sys
from PIL import Image
ROOT = os.path.join(os.path.dirname(__file__), '..', 'client', 'assets')
src, iid = sys.argv[1:3]
im = Image.open(src).convert('RGBA'); S = im.width // 8
cells = [im.crop((i * S, 0, i * S + S, im.height)) for i in range(8)]
# หมวก/หน้ากาก: ภาพด้านข้างตรงของ PixelLab มักหมุนผิดแกน (เห็นเป็นเส้นบาง) → ใช้ภาพเฉียงหน้าแทน (E←SE, W←SW)
if iid.startswith(('cs_head_', 'cs_face_')) or iid in ('cs_back_umbrella', 'cs_back_flag'): cells[2], cells[6] = cells[1], cells[7]
# ค้างคาว: ตัดก้อนหินที่ PixelLab วาดติดมาด้านล่าง (ล่างสุด ~30% ของภาพ)
if iid == 'cs_back_bat':
    for c in cells:
        b = c.getbbox()
        if b: c.paste((0, 0, 0, 0), (0, int(b[3] - (b[3] - b[1]) * 0.3), c.width, c.height))
bb = [c.getbbox() for c in cells if c.getbbox()]
x0, y0 = min(b[0] for b in bb), min(b[1] for b in bb); x1, y1 = max(b[2] for b in bb), max(b[3] for b in bb)
# ให้กึ่งกลางแนวนอนตรงกับกึ่งกลางช่อง (สมมาตร) เพื่อให้วางตามหัวได้ตรง
half = max(S / 2 - x0, x1 - S / 2); x0, x1 = int(S / 2 - half), int(S / 2 + half + 0.999)
w, h = x1 - x0, y1 - y0
out = Image.new('RGBA', (w * 8, h))
for i, c in enumerate(cells): out.alpha_composite(c.crop((x0, y0, x1, y1)), (i * w, 0))
os.makedirs(os.path.join(ROOT, 'td', 'cos'), exist_ok=True)
out.save(os.path.join(ROOT, 'td', 'cos', f'{iid}.png'), optimize=True)
# ไอคอน: ทิศใต้ ตัดขอบ วางกลางกรอบ 48px
s = cells[0].crop(cells[0].getbbox()); k = min(44 / s.width, 44 / s.height)
if k < 1: s = s.resize((max(1, round(s.width * k)), max(1, round(s.height * k))), Image.LANCZOS)
ico = Image.new('RGBA', (48, 48)); ico.alpha_composite(s, ((48 - s.width) // 2, (48 - s.height) // 2))
ico.save(os.path.join(ROOT, 'icons', f'it_{iid}.png'), optimize=True)
mp = os.path.join(ROOT, 'manifest.json'); man = json.load(open(mp))
man['icons'][f'it_{iid}'] = f'assets/icons/it_{iid}.png'
json.dump(man, open(mp, 'w'), ensure_ascii=False, indent=2)
print(iid, 'cell', w, h)
