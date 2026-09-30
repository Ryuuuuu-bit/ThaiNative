#!/usr/bin/env python3
"""build_player.py rig_dir out.html "ชื่อ" "คำอธิบาย" [anims.js]  – ฝัง rig.json ลงหน้าเล่นท่าทาง"""
import json, os, sys
d, out, title, sub = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else ''
tpl = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'player_tpl.html'), encoding='utf-8').read()
rig = open(os.path.join(d, 'rig.json')).read()
anims = open(sys.argv[5], encoding='utf-8').read() if len(sys.argv) > 5 else 'null'
html = tpl.replace('/*ANIMS*/null', anims).replace('/*TITLE*/', title).replace('/*SUB*/', sub).replace('/*RIG*/null', rig)
open(out, 'w', encoding='utf-8').write(html); print('ok', out, len(html) // 1024, 'KB')
