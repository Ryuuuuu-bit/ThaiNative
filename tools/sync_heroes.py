#!/usr/bin/env python3
"""ลงทะเบียนโฟลเดอร์ hero_* ทั้งหมดใน manifest.json (จำนวนเฟรมจากความกว้างภาพ / 72)
   ชุดที่ไม่ใช่ตัวเริ่มต้น → lazy: true (โหลดเมื่อมีคนสวมชุดนั้น)"""
import json, os
from PIL import Image
ROOT = os.path.join(os.path.dirname(__file__), '..', 'client', 'assets', 'td')
BASE = {'hero_male_mohom', 'hero_female_ruenton'}
ORDER = ['idle', 'walk', 'attack', 'slash', 'shoot', 'cast', 'spell', 'die']
mp = os.path.join(ROOT, 'manifest.json'); man = json.load(open(mp))
for d in sorted(os.listdir(ROOT)):
    if not d.startswith('hero_') or not os.path.isdir(os.path.join(ROOT, d)): continue
    anims = [a for a in ORDER if os.path.exists(os.path.join(ROOT, d, a + '.png'))]
    e = man['sprites'].get(d, {})
    e.update(anims=anims, frames={a: Image.open(os.path.join(ROOT, d, a + '.png')).width // 72 for a in anims}, frame=72, scale=0.667)
    if d in BASE: e.pop('lazy', None)
    else: e['lazy'] = True
    man['sprites'][d] = e
    print(d, anims)
json.dump(man, open(mp, 'w'), ensure_ascii=False, indent=1)
