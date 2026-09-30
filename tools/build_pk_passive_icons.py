#!/usr/bin/env python3
"""ไอคอนชุด PK + สกิลติดตัว (Passive) จากไอคอนเดิมในเกม (ไม่ต้องใช้เครดิต PixelLab)
  ▸ สกิลติดตัว: ไอคอนต้นทาง → กรอบทอง + พื้นสีประจำอาชีพ แบบเดียวกับ tools/skill_icon_frame.py
    + ป้ายวงกลมเขียว "P" มุมขวาล่าง (บอกว่าเป็นสกิลติดตัว)
  ▸ PK: ย้อมสีไอคอนเดิม (หัวกะโหลกแดง / ดาบไขว้แดง / ดาบไขว้ม่วง) + เรืองแสงรอบขอบ
  ▸ เขียนลง client/assets/icons + ลงทะเบียนใน client/assets/manifest.json (icons)
ใช้: python3 tools/build_pk_passive_icons.py   (ถ้าได้ภาพ PixelLab ใหม่ภายหลัง แค่ทับไฟล์ชื่อเดิม)"""
import os, json
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IC = os.path.join(ROOT, 'client/assets/icons')
BG = {'sword': ((26, 44, 96), (8, 14, 36)), 'mage': ((64, 24, 90), (18, 6, 30)), 'arch': ((74, 56, 22), (26, 18, 6)),
      'boxer': ((96, 42, 22), (30, 12, 6)), 'heal': ((18, 64, 46), (8, 28, 22))}
GOLD, GOLDD, GOLDL = (222, 178, 70, 255), (150, 100, 30, 255), (255, 232, 150, 255)
N = 48


def frame(icon, job):
    """กรอบสกิลแบบเดิม (สำเนาจาก tools/skill_icon_frame.py ให้หน้าตาตรงกัน)"""
    a, b = BG[job]
    im = Image.new('RGBA', (N, N)); px = im.load()
    for y in range(N):
        t = y / (N - 1)
        for x in range(N):
            r = ((x - 24) ** 2 + (y - 22) ** 2) ** 0.5 / 34
            c = [int((a[i] * (1 - t) + b[i] * t) * (1.25 - min(1, r) * 0.45)) for i in range(3)]
            px[x, y] = tuple(min(255, v) for v in c) + (255,)
    bb = icon.getbbox() or (0, 0, N, N)
    ic = icon.crop(bb); s = min(34 / ic.width, 34 / ic.height)
    ic = ic.resize((max(1, round(ic.width * s)), max(1, round(ic.height * s))), Image.NEAREST)
    im.alpha_composite(ic, ((N - ic.width) // 2, (N - ic.height) // 2 - 1))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, N - 1, N - 1], outline=GOLDD, width=2); d.rectangle([2, 2, N - 3, N - 3], outline=GOLD, width=2)
    for x, y in [(2, 2), (N - 4, 2), (2, N - 4), (N - 4, N - 4)]: d.rectangle([x, y, x + 1, y + 1], fill=GOLDL)
    return im


def passive_badge(im):
    """ป้าย P สีเขียวมุมขวาล่าง = สกิลติดตัว"""
    d = ImageDraw.Draw(im)
    cx, cy, r = N - 12, N - 12, 7
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(40, 120, 50, 255), outline=(170, 240, 120, 255))
    # ตัว P แบบพิกเซล 5×7
    P = ['1110', '1001', '1001', '1110', '1000', '1000', '1000']
    for yy, row in enumerate(P):
        for xx, v in enumerate(row):
            if v == '1': d.point((cx - 2 + xx, cy - 3 + yy), fill=(240, 255, 220, 255))
    return im


def tint(src, rgb, glow):
    """ย้อมสีไอคอนโปร่งใส (คงความสว่างเดิม) + เรืองแสงรอบขอบ"""
    im = src.convert('RGBA'); px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if not a: continue
            l = (r * 0.3 + g * 0.59 + b * 0.11) / 255
            px[x, y] = (min(255, int(rgb[0] * (0.35 + l))), min(255, int(rgb[1] * (0.35 + l))), min(255, int(rgb[2] * (0.35 + l))), a)
    alpha = im.getchannel('A').filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(1.5))
    halo = Image.new('RGBA', im.size, glow + (0,)); halo.putalpha(alpha.point(lambda v: int(v * 0.7)))
    halo.alpha_composite(im)
    return halo


src = lambda k: Image.open(os.path.join(IC, f'{k}.png')).convert('RGBA')
out = {}
# ---- สกิลติดตัว (อาชีพละ 2) ----
PASSIVE = {
    'sword_p_mastery': ('it_wood_sword', 'sword'), 'sword_p_iron': ('ui_slot_armor', 'sword'),
    'mage_p_focus': ('ui_think', 'mage'), 'mage_p_soul': ('ui_star', 'mage'),
    'arch_p_eye': ('ui_eye', 'arch'), 'arch_p_step': ('ui_wind', 'arch'),
    'boxer_p_fist': ('it_hand_wrap', 'boxer'), 'boxer_p_step': ('ui_slot_boots', 'boxer'),
    'heal_p_herb': ('ui_scroll', 'heal'), 'heal_p_metta': ('ui_wai', 'heal'),
}
for sid, (k, job) in PASSIVE.items():
    passive_badge(frame(src(k), job)).save(os.path.join(IC, f'sk_{sid}.png'))
    out[f'sk_{sid}'] = f'assets/icons/sk_{sid}.png'
# ---- PK ----
PK = {'pk_red': ('ui_skull', (255, 70, 55), (255, 30, 20)), 'pk': ('ui_swords', (255, 90, 70), (220, 30, 30)), 'pk_purple': ('ui_swords', (200, 130, 255), (150, 60, 230))}
for key, (k, rgb, glow) in PK.items():
    tint(src(k), rgb, glow).save(os.path.join(IC, f'ui_{key}.png'))
    out[f'ui_{key}'] = f'assets/icons/ui_{key}.png'

man_p = os.path.join(ROOT, 'client/assets/manifest.json')
man = json.load(open(man_p, encoding='utf-8'))
man['icons'].update(out)
json.dump(man, open(man_p, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, indent=2)
print('icons written:', len(out))
