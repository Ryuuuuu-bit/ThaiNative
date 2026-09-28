// ============================================================
//  ชุดแต่งตัวบนโมเดล 8 ทิศ (หมวก/มงกุฎ · หน้ากาก · ของสะพายหลัง)
//  ▸ ภาพ PixelLab 8 ทิศ: assets/td/cos/<itemId>.png (8 ช่องแนวนอน เรียงตาม DIRS)
//  ▸ จุดยึด (หัว/ใบหน้า/หลัง) คำนวณจากพิกเซลของเฟรมตัวละครจริง → ใช้ได้กับทุกชุด/ทุกท่า
//  ▸ ท่าโจมตี (ยกอาวุธเหนือหัว) ใช้จุดยึดจากท่ายืนของทิศเดียวกันเมื่อค่าที่วัดได้กระโดดผิดปกติ
// ============================================================
import { ITEMS } from '/shared/data/items.js';
import { DIRS, texKey } from './Dir8.js';

const SLOTS = ['back', 'head', 'face'];
const FRONT = new Set(['south', 'south-east', 'south-west']);
const NORTH = new Set(['north', 'north-east', 'north-west']);
/** ค่าวางตำแหน่งตั้งต้นตามช่อง · w = ความกว้าง (เท่าของความกว้างหัว) · y = ตำแหน่งแนวตั้ง (เท่าของความสูงหัว จากยอดหัว) · ay = จุดยึดภาพ */
const FIT = {
  head: { w: 1.35, y: 0.62, ay: 1 },
  face: { w: 1.45, y: 0.5, ay: 0.5 },          // หน้ากากแบบครอบทั้งหัว (มีภาพด้านหลังด้วย)
  back: { w: 3, y: 1.7, ay: 0.5 },
};
const texOf = (id) => `cos:${id}`;
const fit0 = (def, slot) => ({ ...FIT[slot], ...(def?.fit || {}) });

/** จุดยึดของทุกเฟรมในภาพหนึ่งท่า (คำนวณครั้งเดียวต่อ texture) */
const anchorCache = new Map();
function anchorsFor(scene, key) {
  if (anchorCache.has(key)) return anchorCache.get(key);
  const tex = scene.textures.get(key), src = tex?.getSourceImage?.();
  if (!src?.width) return null;
  const cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height;
  const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(src, 0, 0);
  const px = cx.getImageData(0, 0, src.width, src.height).data, W = src.width;
  const out = {};
  for (const name of tex.getFrameNames()) {
    const f = tex.get(name);
    let top = -1, bot = -1;
    const rowSpan = (y) => { let a = -1, b = -1, n = 0; for (let x = 0; x < f.cutWidth; x++) if (px[((f.cutY + y) * W + f.cutX + x) * 4 + 3] > 60) { if (a < 0) a = x; b = x; n++; } return [a, b, n]; };
    for (let y = 0; y < f.cutHeight; y++) if (rowSpan(y)[2] >= 2) { top = y; break; }
    for (let y = f.cutHeight - 1; y > top; y--) if (rowSpan(y)[2] >= 2) { bot = y; break; }
    if (top < 0 || bot < 0) continue;
    const H = bot - top, hh = Math.max(6, H / 5.2);
    let sx = 0, n = 0;
    for (let y = top; y < top + hh * 0.6; y++) { const [a, b, k] = rowSpan(y); if (k) { sx += (a + b) / 2; n++; } }
    let hw = 0;
    for (let y = Math.round(top + hh * 0.35); y < top + hh * 0.85; y++) { const [a, b, k] = rowSpan(y); if (k) hw = Math.max(hw, b - a + 1); }
    let bx = 0, bn = 0;
    for (let y = Math.round(top + hh * 1.3); y < top + hh * 2.4; y++) { const [a, b, k] = rowSpan(y); if (k) { bx += (a + b) / 2; bn++; } }
    out[name] = { hx: n ? sx / n : f.cutWidth / 2, top, hh, hw: Math.min(hw || hh, hh * 1.3), bx: bn ? bx / bn : f.cutWidth / 2, fw: f.cutWidth, fh: f.cutHeight };
  }
  anchorCache.set(key, out);
  return out;
}

export class CostumeOverlay {
  constructor(scene) { this.s = scene; this.items = new Map(); this.loading = new Set(); }

  attach(spr, getApp) {
    const imgs = Object.fromEntries(SLOTS.map((k) => [k, this.s.add.image(0, 0, '__DEFAULT').setVisible(false)]));
    this.items.set(spr, { spr, getApp, imgs });
  }

  detach(spr) { const it = this.items.get(spr); if (!it) return; Object.values(it.imgs).forEach((i) => i.destroy()); this.items.delete(spr); }

  /** โหลดภาพชุดแต่งตัว (ครั้งแรกที่มีคนสวม) แล้วแบ่งเป็น 8 เฟรมตามทิศ */
  ensure(id) {
    const k = texOf(id);
    if (this.s.textures.exists(k)) return true;
    if (this.loading.has(id)) return false;
    this.loading.add(id);
    this.s.load.image(k, `/assets/td/cos/${id}.png`);
    this.s.load.once(`filecomplete-image-${k}`, () => {
      const tex = this.s.textures.get(k), src = tex.getSourceImage(), w = Math.floor(src.width / 8);
      DIRS.forEach((d, i) => tex.add(d, 0, i * w, 0, w, src.height));
    });
    if (!this.s.load.isLoading()) this.s.load.start();
    return false;
  }

  update() { for (const it of this.items.values()) this.draw(it); }

  draw(it) {
    const { spr, imgs } = it;
    if (!spr.active) return this.detach(spr);
    const a = it.getApp?.() || {}, cos = a.costume || {};
    const f = spr.frame, show = spr._d8 && spr.visible && spr.alpha > 0.05;
    let A = null;
    if (show && f?.texture) {
      const all = anchorsFor(this.s, f.texture.key);
      A = all?.[f.name];
      // ท่าที่ไม่ใช่ยืน/เดิน: ถ้ายอดหัวต่างจากท่ายืนมาก (ยกอาวุธ) → ใช้จุดยึดท่ายืน
      if (!/:(idle|walk)$/.test(f.texture.key)) {
        const ref = anchorsFor(this.s, texKey(spr.d8id, 'idle'))?.[`${spr.dir || 'south'}_0`];
        if (ref && (!A || Math.abs(A.top - ref.top) > ref.hh * 0.45 || Math.abs(A.hx - ref.hx) > ref.hh * 0.7)) A = { ...ref, hx: ref.hx + (A ? Math.max(-3, Math.min(3, A.hx - ref.hx)) : 0) };
      }
    }
    const dir = spr.dir || 'south', sc = spr.scaleX || 0.667;
    for (const slot of SLOTS) {
      const img = imgs[slot], id = cos[slot], def = ITEMS[id];
      if (!A || !def || (fit0(def, slot).frontOnly && NORTH.has(dir)) || !this.ensure(id)) { img.setVisible(false); continue; }
      const k = texOf(id), tex = this.s.textures.get(k);
      if (!tex.has(dir)) { img.setVisible(false); continue; }
      const fit = fit0(def, slot);
      const fr = tex.get(dir);
      // พิกัดจอ: เท้าอยู่ที่ spr (origin 0.5,1)
      const ox = spr.x + (A.hx - A.fw / 2) * sc, top = spr.y - (A.fh - A.top) * sc;
      let x = slot === 'back' ? spr.x + (A.bx - A.fw / 2) * sc : ox, y = top + A.hh * fit.y * sc;
      if (fit.frontOnly && !FRONT.has(dir)) x += (dir === 'east' ? 1 : -1) * A.hw * 0.18 * sc;
      const w = (slot === 'back' ? A.hh : A.hw) * fit.w * sc;
      img.setTexture(k, dir).setOrigin(0.5, fit.ay).setScale(w / fr.cutWidth, (w / fr.cutWidth) * (fit.sy || 1)).setPosition(Math.round(x * 2) / 2, Math.round(y * 2) / 2)
        .setDepth(spr.depth + (slot === 'back' ? (NORTH.has(dir) ? 0.03 : -0.03) : slot === 'face' ? 0.04 : 0.045))
        .setAlpha(spr.alpha).setVisible(true);
    }
  }
}
