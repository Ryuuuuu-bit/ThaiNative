#!/usr/bin/env python3
"""PixelLab character zip (MCP download) → <out>/<prefix>__rot.png + <prefix>__<anim>.png (8 แถวตามทิศ) สำหรับ import_pixellab.py
   python3 tools/zip2sheets.py <zip> <outdir> <prefix>"""
import io, json, os, re, sys, zipfile
from PIL import Image
DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
z = zipfile.ZipFile(sys.argv[1]); out, pre = sys.argv[2], sys.argv[3]; os.makedirs(out, exist_ok=True)
meta = json.loads(z.read('metadata.json'))
fr = meta['states'][0]['frames']
im = lambda p: Image.open(io.BytesIO(z.read(p))).convert('RGBA')
rot = {d: im(p) for d, p in fr['rotations'].items()}
C = next(iter(rot.values())).width
sh = Image.new('RGBA', (C * 8, C))
for i, d in enumerate(DIRS):
    if d in rot: sh.alpha_composite(rot[d], (i * C, 0))
sh.save(f'{out}/{pre}__rot.png')
acc = {}
for name, dirs in fr.get('animations', {}).items():
    low = name.lower()
    g = 'falling-back-death' if re.search('die|death', low) else 'cross-punch' if re.search('attack|punch', low) else 'walking-6-frames' if 'walk' in low else None
    if not g: continue
    for d, v in dirs.items(): acc.setdefault(g, {}).setdefault(d, v)      # หลายกลุ่มท่าเดียวกัน → รวมทิศ (กลุ่มแรกมาก่อน)
for g, dirs in acc.items():
    n = max(len(v) for v in dirs.values()); c = im(next(iter(dirs.values()))[0]).width
    s = Image.new('RGBA', (c * n, c * 8))
    for i, d in enumerate(DIRS):
        for k, p in enumerate(dirs.get(d, [])): s.alpha_composite(im(p), (k * c, i * c))
    s.save(f'{out}/{pre}__{g}.png'); print(pre, g, n, 'frames', sorted(dirs))
