#!/usr/bin/env python3
"""rig_split.py – แยกภาพบอส (ท่ายืนด้านข้าง) เป็นชิ้นส่วน + สร้าง rig.json สำหรับ rig_player

ใช้:  python3 rig_split.py spec.json out_dir

spec.json:
{
  "image": "boss.png",            # ภาพท่ายืน พื้นโปร่งใส (path สัมพันธ์กับ spec)
  "ground": 190,                   # y ของพื้น (ในภาพ)
  "mouth": [x, y],                 # (ไม่บังคับ) จุดปาก – ใช้ปล่อยคลื่นคำราม
  "order": ["bU", ...],            # ลำดับวาด หลัง → หน้า
  "parts": [
    { "n": "torso", "parent": null, "poly": [[x,y],...], "pivot": [x,y], "tip": [x,y],
      "fill": [[[x,y],...]] }      # (ไม่บังคับ) พื้นที่เพิ่มที่ชิ้นนี้ถูกบัง ให้เติมสีต่อ
  ]
}
- pivot = จุดหมุน (ข้อต่อกับชิ้นแม่) · tip = ปลายกระดูก (ใช้หาปลายอาวุธ/ความยาว)
- parent null = ติดกับ root (root อยู่ที่ pivot ของชิ้นแรกที่ parent เป็น null)
- ชิ้นที่วาดทีหลัง (อยู่หน้า) จะถูกตัดออกจากชิ้นที่อยู่หลัง แล้วเติมสีส่วนที่หายด้วยสีข้างเคียง
"""
import base64, io, json, os, sys
import numpy as np
from PIL import Image, ImageDraw


def poly_mask(shape, polys):
    m = Image.new('L', (shape[1], shape[0]), 0)
    d = ImageDraw.Draw(m)
    for p in polys:
        d.polygon([tuple(v) for v in p], fill=255)
    return np.array(m) > 0


def nearest_fill(rgba, known, target, iters=400):
    """เติมพิกเซลใน target ด้วยสีของพิกเซล known ที่ใกล้ที่สุด (ขยายทีละชั้น)"""
    out = rgba.copy()
    have = known.copy()
    todo = target & ~have
    for _ in range(iters):
        if not todo.any():
            break
        grown = np.zeros_like(have)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            src = np.roll(np.roll(have, dy, 0), dx, 1)
            col = np.roll(np.roll(out, dy, 0), dx, 1)
            take = todo & src & ~grown
            out[take] = col[take]
            grown |= take
        if not grown.any():
            break
        have |= grown
        todo &= ~grown
    return out, have


def main(spec_path, out_dir):
    spec = json.load(open(spec_path))
    base = os.path.dirname(os.path.abspath(spec_path))
    img = np.array(Image.open(os.path.join(base, spec['image'])).convert('RGBA'))
    H, W = img.shape[:2]
    alpha = img[..., 3] > 0
    parts = {p['n']: p for p in spec['parts']}
    order = spec['order']
    masks = {n: poly_mask(img.shape, [p['poly']]) & alpha for n, p in parts.items()}
    os.makedirs(out_dir, exist_ok=True)

    root_part = next(p for p in spec['parts'] if p.get('parent') is None)
    root = root_part['pivot']
    bones, out_parts = [], []
    crops = {}
    # ชิ้นที่ copy จากชิ้นอื่น (เช่น แขน/ขาข้างหลังที่ถูกบังทั้งหมด) ทำทีหลัง
    for n in sorted(order, key=lambda k: 'copy' in parts[k]):
        p = parts[n]
        idx = order.index(n)
        if 'copy' in p:
            src = parts[p['copy']]; im, sdx, sdy = crops[p['copy']]
            a = np.array(im).astype(float); a[..., :3] *= p.get('shade', 0.62)
            crop = Image.fromarray(a.clip(0, 255).astype(np.uint8))
            crop.save(os.path.join(out_dir, f'{n}.png')); crops[n] = (crop, sdx, sdy)
            buf = io.BytesIO(); crop.save(buf, 'PNG')
            pv = p['pivot']; par = p.get('parent'); ppv = parts[par]['pivot'] if par else root
            st = src.get('tip', src['pivot']); tip = [st[0] - src['pivot'][0], st[1] - src['pivot'][1]]
            bones.append({'n': n, 'p': par or 'root', 'x': pv[0] - ppv[0], 'y': pv[1] - ppv[1], 'tip': tip})
            out_parts.append({'n': n, 'dx': sdx, 'dy': sdy, 'w': crop.width, 'h': crop.height, 'img': 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()})
            print(f'{n:6s} copy จาก {p["copy"]} (มืดลง)')
            continue
        front = np.zeros((H, W), bool)
        for m in order[idx + 1:]:
            front |= masks[m]
        area = poly_mask(img.shape, [p['poly']] + p.get('fill', []))
        known = masks[n] & ~front                       # ส่วนที่เห็นจริงของชิ้นนี้
        if known.sum() < 0.08 * max(1, masks[n].sum()):  # ถูกบังเกือบทั้งชิ้น → ใช้พิกเซลเดิมไปก่อน (ควรให้อาร์ตวาดเพิ่ม)
            print(f'   ⚠ {n} ถูกบังเกือบหมด ใช้พิกเซลเดิม – ควรวาดชิ้นนี้เพิ่ม')
            known = masks[n].copy()
        target = area & alpha & front                    # ส่วนที่ถูกชิ้นหน้าบัง → เติม
        rgba, filled = nearest_fill(img, known, target)
        own = (known | (filled & target))
        piece = np.zeros_like(img)
        piece[own] = rgba[own]
        ys, xs = np.nonzero(own)
        if len(xs) == 0:
            print('!! ชิ้นว่าง', n)
            continue
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        crop = Image.fromarray(piece[y0:y1, x0:x1])
        crop.save(os.path.join(out_dir, f'{n}.png'))
        crops[n] = (crop, int(x0) - p['pivot'][0], int(y0) - p['pivot'][1])
        buf = io.BytesIO(); crop.save(buf, 'PNG')
        pv = p['pivot']; par = p.get('parent')
        ppv = parts[par]['pivot'] if par else root
        tip = p.get('tip', pv)
        bones.append({'n': n, 'p': par or 'root', 'x': pv[0] - ppv[0], 'y': pv[1] - ppv[1], 'tip': [tip[0] - pv[0], tip[1] - pv[1]]})
        out_parts.append({'n': n, 'dx': int(x0) - pv[0], 'dy': int(y0) - pv[1], 'w': int(x1 - x0), 'h': int(y1 - y0),
                          'img': 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()})
        print(f'{n:6s} {x1-x0:3d}x{y1-y0:<3d} เติม {int((filled & target).sum())} px')

    # เรียงกระดูกให้แม่มาก่อนลูก
    done, sorted_b = {'root'}, []
    while len(sorted_b) < len(bones):
        before = len(sorted_b)
        for b in bones:
            if b['n'] not in done and b['p'] in done:
                sorted_b.append(b); done.add(b['n'])
        if len(sorted_b) == before:
            sys.exit('!! กระดูกหาแม่ไม่เจอ: ' + str([b['n'] for b in bones if b['n'] not in done]))
    rig = {'size': [W, H], 'root': root, 'ground': spec.get('ground', H - 2), 'bones': sorted_b, 'parts': out_parts, 'order': order}
    if 'ik' in spec:   # มือจับอาวุธ: at = จุดปลายแขน (tip ของ f) ในพิกัดของกระดูก on (ท่ายืน ไม่หมุน)
        rig['ik'] = [{'u': k['u'], 'f': k['f'], 'on': k['on'], 'at': [parts[k['f']]['tip'][0] - parts[k['on']]['pivot'][0], parts[k['f']]['tip'][1] - parts[k['on']]['pivot'][1]]} for k in spec['ik']]
    if 'mouth' in spec and 'head' in parts:
        hp = parts['head']['pivot']; rig['mouth'] = [spec['mouth'][0] - hp[0], spec['mouth'][1] - hp[1]]
    json.dump(rig, open(os.path.join(out_dir, 'rig.json'), 'w'))

    # ภาพตรวจ: ประกอบกลับท่ายืน (ควรเหมือนต้นฉบับ) + จุดข้อต่อ
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    pos = {'root': root}
    for b in sorted_b:
        pp = pos[b['p']]; pos[b['n']] = [pp[0] + b['x'], pp[1] + b['y']]
    for pt in sorted(out_parts, key=lambda q: order.index(q['n'])):
        im = Image.open(os.path.join(out_dir, f"{pt['n']}.png"))
        pv = pos[pt['n']]
        canvas.alpha_composite(im, (pv[0] + pt['dx'], pv[1] + pt['dy']))
    diff = np.abs(np.array(canvas).astype(int) - img.astype(int))[..., :3].sum(-1)
    print('ประกอบกลับต่างจากต้นฉบับ:', int((diff > 30).sum()), 'px')
    big = canvas.resize((W * 3, H * 3), Image.NEAREST)
    d = ImageDraw.Draw(big)
    for b in sorted_b:
        x, y = pos[b['n']]; tx, ty = x + b['tip'][0], y + b['tip'][1]
        d.line([(x * 3, y * 3), (tx * 3, ty * 3)], fill=(94, 242, 255, 255), width=2)
        d.ellipse([x * 3 - 4, y * 3 - 4, x * 3 + 4, y * 3 + 4], fill=(94, 242, 255, 255))
    big.save(os.path.join(out_dir, '_check.png'))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
