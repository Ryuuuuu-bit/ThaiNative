"""ติดตั้งไอคอนอุปกรณ์ (PixelLab) → client/assets/icons + คำนวณ grip อาวุธ / สีชุดเกราะ → shared/data/gear_art.js
ใช้: python3 tools/gear_art.py <โฟลเดอร์ภาพดิบ>   (ชื่อไฟล์: sword_w01.png, mage_a03.png, leg_bow.png ...)"""
import sys, os, json, colorsys
from PIL import Image
from collections import Counter, deque

SRC = sys.argv[1]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICONS = [os.path.join(ROOT, 'client/assets/icons'), os.path.join(ROOT, 'assets_src/pixellab/icons')]
LEG = {'leg_sword': 'g_sword_wleg', 'leg_staff': 'g_mage_wleg', 'leg_bow': 'g_archer_wleg', 'leg_wrap': 'g_boxer_wleg',
       'leg_acc_sword': 'g_sword_cleg', 'leg_acc_mage': 'g_mage_cleg', 'leg_acc_archer': 'g_archer_cleg', 'leg_acc_boxer': 'g_boxer_cleg'}
WT = {'sword': 'sword', 'mage': 'staff', 'archer': 'bow', 'boxer': 'wraps'}

def largest_component(im):
    """เก็บเฉพาะชิ้นที่ใหญ่สุด (กันภาพที่มีของ 2 ชิ้น) แล้ววางกลางภาพ 48px"""
    a = im.load(); W, H = im.size; seen = set(); best = []
    for y in range(H):
        for x in range(W):
            if (x, y) in seen or a[x, y][3] < 40: continue
            comp = []; q = deque([(x, y)]); seen.add((x, y))
            while q:
                cx, cy = q.popleft(); comp.append((cx, cy))
                for dx, dy in ((1,0),(-1,0),(0,1),(0,-1),(1,1),(-1,-1),(1,-1),(-1,1)):
                    nx, ny = cx+dx, cy+dy
                    if 0 <= nx < W and 0 <= ny < H and (nx, ny) not in seen and a[nx, ny][3] >= 40:
                        seen.add((nx, ny)); q.append((nx, ny))
            if len(comp) > len(best): best = comp
    xs = [p[0] for p in best]; ys = [p[1] for p in best]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    keep = set(best); out = Image.new('RGBA', im.size)
    o = out.load(); ox = (W - (x1 - x0 + 1)) // 2 - x0
    for (x, y) in keep:
        # เก็บพิกเซลขอบโปร่งแสงรอบชิ้นหลักด้วย
        o[x + ox, y] = a[x, y]
    return out

def row_cx(im, y):
    a = im.load(); xs = [x for x in range(im.size[0]) if a[x, y][3] > 40]
    return round(sum(xs) / len(xs)) if xs else im.size[0] // 2

def grip(im, wt):
    bb = im.getbbox(); x0, y0, x1, y1 = bb; h = y1 - y0
    if wt == 'sword':
        gy = y1 - 5; return {'g': [row_cx(im, gy), gy], 's': 0.55, 'r': 0.7}
    if wt == 'staff':
        gy = y0 + int(h * 0.62); return {'g': [row_cx(im, gy), gy], 's': 0.78, 'ox': 2}
    if wt == 'bow':
        gy = y0 + h // 2; return {'g': [row_cx(im, gy), gy], 's': 0.72, 'ox': 4, 'oy': -5}
    return None

def hexc(c): return '#%02x%02x%02x' % c

def look(im):
    """สีชุดบนตัวละคร: ส่วนบน = สีเด่นช่วงบน, ส่วนล่าง = สีเด่นช่วงล่าง (เข้มขึ้นเล็กน้อย)"""
    a = im.load(); x0, y0, x1, y1 = im.getbbox(); mid = y0 + (y1 - y0) * 0.55
    def dom(rows):
        cnt = Counter()
        for y in rows:
            for x in range(x0, x1):
                r, g, b, al = a[x, y]
                if al < 128: continue
                hh, ll, ss = colorsys.rgb_to_hls(r/255, g/255, b/255)
                if ll < 0.12 or ll > 0.92: continue           # ตัดเส้นขอบดำ/ไฮไลต์ขาว
                cnt[(r//24*24+12, g//24*24+12, b//24*24+12)] += 1 + ss * 2
        return cnt.most_common(1)[0][0] if cnt else (120, 90, 60)
    top = dom(range(y0, int(mid))); bot = dom(range(int(mid), y1))
    if abs(sum(top) - sum(bot)) < 30: bot = tuple(max(0, int(v * 0.72)) for v in bot)
    return {'top': hexc(top), 'bottom': hexc(bot)}

art_path = os.path.join(ROOT, 'shared/data/gear_art.js')
art = {}
if os.path.exists(art_path):
    txt = open(art_path).read(); s = txt.find('{', txt.find('GEAR_ART')); art = json.loads(txt[s:txt.rfind('}') + 1] or '{}')
man_path = os.path.join(ROOT, 'client/assets/manifest.json'); man = json.load(open(man_path))
n = 0
for f in sorted(os.listdir(SRC)):
    name, ext = os.path.splitext(f)
    if ext != '.png' or name.startswith('npc_'): continue
    if name in LEG: gid = LEG[name]
    elif '_' in name and name.split('_')[1][:1] in 'wac' and name.split('_')[1][1:].isdigit():
        job, rest = name.split('_'); gid = f'g_{job}_{rest}'
    else: continue
    im = Image.open(os.path.join(SRC, f)).convert('RGBA')
    if im.size != (48, 48): im = im.resize((48, 48), Image.NEAREST)
    job = gid.split('_')[1]; cat = gid.split('_')[2][0]
    if cat == 'w' and WT[job] == 'bow': im = largest_component(im)
    for d in ICONS: im.save(os.path.join(d, f'it_{gid}.png'))
    man['icons'][f'it_{gid}'] = f'assets/icons/it_{gid}.png'
    e = {}
    if cat == 'w':
        g = grip(im, WT[job])
        if g: e['grip'] = g
    if cat == 'a': e['look'] = look(im)
    art[gid] = e; n += 1
json.dump(man, open(man_path, 'w'), indent=2, ensure_ascii=False)
open(art_path, 'w').write('// สร้างอัตโนมัติจากภาพไอคอน (tools/gear_art.py): look = สีชุดบนตัวละคร (เกราะ) · grip = จุดจับอาวุธในภาพ 48px\n'
                          'export const GEAR_ART = ' + json.dumps(art, ensure_ascii=False, indent=0).replace('\n', '') + ';\n')
print('installed', n, 'total art', len(art))
