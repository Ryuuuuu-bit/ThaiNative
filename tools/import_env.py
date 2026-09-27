#!/usr/bin/env python3
"""
นำชีตวัตถุ PixelLab (แถวเดียว n ช่อง ขนาด C×C) เข้าเกมเป็นภาพฉาก → client/assets/td/env/<ชื่อ>.png
  python3 tools/import_env.py <sheet.png> <cell> ชื่อ1,ชื่อ2,...   (ใช้ - เพื่อข้ามช่อง)
 - ครอบภาพให้พอดีตัววัตถุ (ฐานล่างสุด = จุดวางบนพื้น) · เพิ่มลง manifest.images เป็น 'env/<ชื่อ>'
"""
import json, os, sys
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'client', 'assets', 'td')


def main(src, cell, names):
    im = Image.open(src).convert('RGBA'); C = int(cell)
    cols, rows = im.width // C, im.height // C
    os.makedirs(os.path.join(ROOT, 'env'), exist_ok=True)
    mp = os.path.join(ROOT, 'manifest.json'); man = json.load(open(mp))
    imgs = man.setdefault('images', [])
    for i, name in enumerate(names.split(',')):
        if name == '-' or i >= cols * rows:
            continue
        x, y = (i % cols) * C, (i // cols) * C
        fr = im.crop((x, y, x + C, y + C))
        # ตัดพิกเซลโปร่งเกือบหมด (ขอบฟุ้ง) ก่อนหากรอบ
        a = fr.getchannel('A').point(lambda v: 255 if v > 24 else 0)
        bb = a.getbbox()
        if not bb:
            print('ว่าง', name); continue
        fr.crop(bb).save(os.path.join(ROOT, 'env', f'{name}.png'), optimize=True)
        key = f'env/{name}'
        if key not in imgs:
            imgs.append(key)
        print(name, bb[2] - bb[0], 'x', bb[3] - bb[1])
    json.dump(man, open(mp, 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main(*sys.argv[1:4])
