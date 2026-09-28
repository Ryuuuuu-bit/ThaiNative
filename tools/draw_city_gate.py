"""วาดซุ้มประตูเมืองหน้าตรง (ทางเดินเปิดโล่ง) แบบพิกเซล: ป้อมก่ออิฐถือปูนสองข้าง ใบเสมาบนสัน ซุ้มโค้งกลาง หลังคาซ้อนชั้นแดง-ทอง ช่อฟ้า
   ใช้: python3 tools/draw_city_gate.py → client/assets/td/env/b_citygate.png (และ b_citygate_closed.png = บานประตูแดงปิด)"""
from PIL import Image, ImageDraw
W, H = 128, 112
OUT = 'client/assets/td/env/'
WALL, WALL2, WALL3, LINE = (240, 233, 220), (214, 205, 190), (186, 175, 158), (92, 76, 62)
BRICK, BRICK2 = (156, 78, 52), (118, 56, 38)
ROOF, ROOF2, GOLD, GOLD2 = (178, 44, 38), (120, 28, 26), (236, 182, 62), (170, 118, 32)
GREEN, SHADOW = (46, 110, 84), (40, 30, 28)

def gate(closed=False):
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    R = lambda x0, y0, x1, y1, c: d.rectangle([x0, y0, x1, y1], fill=c)
    base = H - 1
    # ---- ป้อมสองข้าง ----
    for x0 in (0, W - 34):
        x1 = x0 + 33
        R(x0, 40, x1, base, WALL); R(x0, 40, x0 + 2, base, WALL2); R(x1 - 3, 40, x1, base, WALL3)
        R(x0, base - 7, x1, base, BRICK); R(x0, base - 7, x1, base - 6, BRICK2)          # ฐานอิฐ
        for y in range(48, base - 8, 8):                                                   # แนวอิฐบางๆ
            d.line([x0 + 3, y, x1 - 4, y], fill=WALL2)
        R(x0 + 12, 58, x1 - 12, 72, SHADOW); R(x0 + 13, 59, x1 - 13, 60, (70, 56, 50))      # ช่องหน้าต่างโค้ง
        d.pieslice([x0 + 12, 52, x1 - 12, 64], 180, 360, fill=SHADOW)
        R(x0 - 1, 38, x1 + 1, 41, WALL3); d.line([x0 - 1, 38, x1 + 1, 38], fill=LINE)     # คิ้วบัว
        for i in range(4):                                                                 # ใบเสมาบนสัน
            sx = x0 + 2 + i * 8
            d.polygon([(sx, 38), (sx + 5, 38), (sx + 5, 31), (sx + 2.5, 27), (sx, 31)], fill=WALL, outline=LINE)
        d.rectangle([x0, 40, x1, base], outline=LINE)
    # ---- กำแพงกลาง + ซุ้มโค้ง ----
    cx0, cx1 = 34, W - 35
    R(cx0, 46, cx1, base, WALL2); R(cx0, 46, cx1, 49, WALL3)
    R(cx0, base - 7, cx1, base, BRICK)
    ax0, ax1, atop = 40, W - 41, 58                                                       # ช่องทางเดินกว้าง 48px
    d.rectangle([ax0 - 3, atop - 3, ax1 + 3, base], fill=GOLD2)                           # กรอบซุ้มทอง
    d.pieslice([ax0 - 3, atop - 16, ax1 + 3, atop + 14], 180, 360, fill=GOLD2)
    d.rectangle([ax0 - 1, atop - 1, ax1 + 1, base], fill=GOLD)
    d.pieslice([ax0 - 1, atop - 14, ax1 + 1, atop + 12], 180, 360, fill=GOLD)
    if closed:
        d.rectangle([ax0, atop, ax1, base], fill=ROOF2); d.pieslice([ax0, atop - 13, ax1, atop + 11], 180, 360, fill=ROOF2)
        d.line([W // 2, atop - 12, W // 2, base], fill=GOLD2)
        for y in range(atop + 6, base - 4, 10):
            for x in (ax0 + 6, ax1 - 10): d.rectangle([x, y, x + 4, y + 4], fill=GOLD)
    else:
        # ทางเดินเปิด: เงาด้านบนซุ้มไล่จาง แล้วโปร่ง (เห็นถนนด้านหลัง)
        d.rectangle([ax0, atop, ax1, base], fill=(0, 0, 0, 0)); d.pieslice([ax0, atop - 13, ax1, atop + 11], 180, 360, fill=(30, 20, 20, 235))
        for k, a in enumerate([220, 190, 150, 110, 70, 35]):
            d.line([ax0, atop + k * 2, ax1, atop + k * 2], fill=(30, 20, 20, a)); d.line([ax0, atop + k * 2 + 1, ax1, atop + k * 2 + 1], fill=(30, 20, 20, a))
        for x in (ax0, ax1): d.line([x, atop, x, base], fill=(60, 44, 40, 200))
    # ---- หลังคาซ้อนชั้นเหนือซุ้ม ----
    mid = W // 2
    tiers = [(44, 30, 30), (34, 22, 24), (24, 14, 18)]                                      # (ครึ่งกว้าง, y ชายคา, สูงจั่ว)
    for hw, yb, h in tiers:
        top = yb - h
        d.polygon([(mid - hw, yb), (mid + hw, yb), (mid + hw - 8, yb - 6), (mid, top), (mid - hw + 8, yb - 6)], fill=ROOF, outline=ROOF2)
        d.line([(mid - hw, yb), (mid, top), (mid + hw, yb)], fill=GOLD, width=2)           # ป้านลมทอง
        d.line([mid - hw + 2, yb - 1, mid + hw - 2, yb - 1], fill=GOLD2)
        for yy in range(top + 5, yb - 2, 3):                                               # แนวกระเบื้อง
            k = (yy - top) / max(1, (yb - top)); half = int(k * (hw - 4))
            d.line([mid - half + 2, yy, mid + half - 2, yy], fill=ROOF2)
        for s in (-1, 1):                                                                  # หางหงส์
            ex = mid + s * hw
            d.line([ex, yb, ex + s * 3, yb - 5], fill=GOLD, width=2)
    d.polygon([(mid - 6, 8), (mid + 6, 8), (mid + 3, 2), (mid, -1), (mid - 3, 2)], fill=GOLD, outline=GOLD2)   # ยอดช่อฟ้า
    d.line([mid, 0, mid, 8], fill=GOLD2)
    R(mid - 30, 30, mid + 30, 34, GREEN); d.line([mid - 30, 30, mid + 30, 30], fill=GOLD)  # คานลายเขียว-ทอง
    R(mid - 12, 36, mid + 12, 44, GOLD2); R(mid - 11, 37, mid + 11, 43, ROOF2)             # ป้ายชื่อประตู
    return im

g = gate(False); g.save(OUT + 'b_citygate.png'); gate(True).save(OUT + 'b_citygate_closed.png')
# ป้อมเดี่ยว (ใช้กับประตูในกำแพงแนวตั้ง ตะวันตก/ตะวันออก): ตัดป้อมซ้าย + หมวกหลังคาเล็ก
t = Image.new('RGBA', (34, 112), (0, 0, 0, 0)); t.paste(g.crop((0, 0, 34, 112)), (0, 0))
dt = ImageDraw.Draw(t)
dt.rectangle([0, 0, 33, 26], fill=(0, 0, 0, 0))
dt.polygon([(1, 30), (32, 30), (27, 22), (17, 8), (6, 22)], fill=ROOF, outline=ROOF2)
dt.line([(1, 30), (17, 8), (32, 30)], fill=GOLD, width=2); dt.line([17, 2, 17, 8], fill=GOLD2); dt.ellipse([15, 0, 19, 4], fill=GOLD)
t.crop(t.getbbox()).save(OUT + 'b_gatetower.png')
print('ok')
