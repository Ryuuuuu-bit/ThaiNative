// ============================================================
//  อาวุธในมือสำหรับสไปรต์ 8 ทิศ
//  ▸ ใช้ไอคอนอาวุธที่สวมจริง (ico_it_<weapon>) + จุดจับจาก gear_art (heldInfo)
//  ▸ วางที่มือตามทิศ · อยู่หลังตัวเมื่อหันหลัง · เหวี่ยง/ยก/ง้างตอนโจมตี
// ============================================================
import { heldInfo, enhGlow } from '../gfx/PlayerArt.js';
import { ITEMS } from '/shared/data/items.js';

/** สีออร่าตีบวก (0xRRGGBB) ตามขั้น · ใช้ชุดสีเดียวกับไอคอน/ภาพเดิม */
const auraColor = (lv) => { const g = enhGlow(lv); if (!g) return 0; const [r, gg, b] = g.color.split(',').map(Number); return (r << 16) | (gg << 8) | b; };
/** ตั้ง/ถอดแสงเรือง (WebGL preFX) บน game object ตามขั้นตีบวก · คืน glow controller หรือ null */
function setGlow(obj, lv, prev) {
  if (!obj.preFX) return null;                                   // Canvas renderer: ไม่มี FX
  if (prev) { obj.preFX.remove(prev); prev = null; }
  if (!lv || lv < 1) return null;
  obj.preFX.setPadding(Math.min(12, 3 + lv * 0.4));
  return obj.preFX.addGlow(auraColor(lv), 1 + lv * 0.18, 0, false, 0.1, 10);
}

// ตำแหน่งมือ (px จากเท้า ที่สเกลตัวละคร 0.667) · behind = วาดหลังตัว · side = ด้านของมือบนจอ
const HAND = {
  south:        { x: -8, y: -15, behind: false, side: -1 },
  'south-east': { x: -2, y: -15, behind: false, side: 1 },
  east:         { x: 3,  y: -15, behind: false, side: 1 },
  'north-east': { x: 7,  y: -16, behind: true,  side: 1 },
  north:        { x: 8,  y: -16, behind: true,  side: 1 },
  'north-west': { x: -7, y: -16, behind: true,  side: -1 },
  west:         { x: -3, y: -15, behind: false, side: -1 },
  'south-west': { x: 2,  y: -15, behind: false, side: -1 },
};
const DIR_ANGLE = { east: 0, 'south-east': 45, south: 90, 'south-west': 135, west: 180, 'north-west': -135, north: -90, 'north-east': -45 };

export class WeaponOverlay {
  constructor(scene) { this.s = scene; this.items = new Map(); }

  /** ผูกอาวุธกับสไปรต์ · getApp() คืน appearance ปัจจุบัน · getState() คืน { anim } */
  attach(spr, getApp, getState) {
    const img = this.s.add.image(spr.x, spr.y, '__DEFAULT').setVisible(false);
    const fx = this.s.add.graphics().setVisible(false);
    this.items.set(spr, { spr, img, fx, getApp, getState, key: null, info: null, atkAt: -9999, lastAnim: '', wlv: 0, alv: 0, wGlow: null, aGlow: null, nextMote: 0 });
  }

  detach(spr) { const it = this.items.get(spr); if (it) { if (it.aGlow && spr.preFX) spr.preFX.remove(it.aGlow); it.img.destroy(); it.fx.destroy(); this.items.delete(spr); } }

  update(time) {
    for (const it of this.items.values()) this.draw(it, time);
  }

  draw(it, time) {
    const { spr, img } = it;
    if (!spr.active) return this.detach(spr);
    const a = it.getApp?.();
    const w = a?.weapon, art = w && ITEMS[w]?.art;
    const key = !w ? null : this.s.textures.exists(`ico_it_${w}`) || !art ? `ico_it_${w}` : `ico_it_${art}`;   // ของที่ใช้ภาพร่วม (ของแดงขั้นต่ำ) → ภาพชิ้นหลัก
    this.aura(it, a, time);
    // แสดงเฉพาะบนภาพ 8 ทิศ (สไปรต์เดิมวาดอาวุธในตัวอยู่แล้ว) และอาวุธที่มีภาพ
    it.fx.clear().setVisible(false);
    if (!spr._d8 || !spr.visible || !key || !this.s.textures.exists(key) || spr._action || spr.d8id?.startsWith('hero2_')) { img.setVisible(false); return; }   // ชุดใหม่ถืออาวุธในภาพอยู่แล้ว
    if (it.key !== key) {
      it.key = key; it.info = heldInfo(a, true);
      if (!it.info) { img.setVisible(false); return; }
      const src = this.s.textures.get(key).getSourceImage();
      img.setTexture(key);
      it.ox = it.info.gx / src.width; it.oy = it.info.gy / src.height;
    }
    const info = it.info; if (!info) { img.setVisible(false); return; }
    const dir = spr.dir || 'south', h = HAND[dir] || HAND.south, k = (spr.scaleX || 0.667) / 0.667;
    const st = it.getState?.() || {};
    if (st.anim === 'attack' && it.lastAnim !== 'attack') it.atkAt = time;
    it.lastAnim = st.anim;
    const dur = info.wtype === 'bow' ? 330 : 280;
    const t = Math.min(1, (time - it.atkAt) / dur), swinging = t < 1;
    const da = Phaser.Math.DegToRad(DIR_ANGLE[dir] ?? 90), ux = Math.cos(da), uy = Math.sin(da);
    const bob = st.anim === 'walk' ? Math.sin(time / 85) * 0.8 : 0;
    let ang, dx = h.x * k, dy = h.y * k + bob, flip = h.side < 0, staff = false;
    if (info.wtype === 'bow') {
      // ธนู: ตั้งขึ้นข้างตัว · ตอนยิงหันไปทางเป้า
      ang = flip ? -12 : 12;
      if (swinging) {
        // ยกธนูไปข้างหน้า → ง้างสาย (ลูกศรถอยหลัง) → ปล่อย (สายสะบัด)
        const raise = Math.min(1, t / 0.2), pull = t < 0.55 ? Math.min(1, (t - 0.1) / 0.45) : 0;
        dx += ux * 5 * raise; dy += uy * 3.5 * raise - 7 * raise;
        ang = (flip ? -1 : 1) * (12 - 12 * raise);
        const hx = spr.x + dx, hy = spr.y + dy - 1, back = 3 + pull * 5;
        const g = it.fx.setVisible(true).setDepth(spr.depth + (h.behind ? -0.04 : 0.06));
        if (t < 0.55) {
          const ax = hx - ux * back, ay = hy - uy * back * 0.7;
          g.lineStyle(1.2, 0x6e4a1e, 1).lineBetween(ax, ay, ax + ux * 13, ay + uy * 9);
          g.fillStyle(0xe8e8e8, 1).fillTriangle(ax + ux * 15, ay + uy * 10.5, ax + ux * 12 - uy * 1.6, ay + uy * 8 + ux * 1.6, ax + ux * 12 + uy * 1.6, ay + uy * 8 - ux * 1.6);
          g.lineStyle(0.8, 0xfdfefe, 0.85).lineBetween(hx - uy * 6, hy + ux * 6, ax, ay).lineBetween(hx + uy * 6, hy - ux * 6, ax, ay);
        } else if (t < 0.7) {
          g.lineStyle(1, 0xfff3b0, (0.7 - t) * 6).strokeCircle(hx + ux * 4, hy + uy * 3, 3 + (t - 0.55) * 30);
        }
      }
    } else if (info.wtype === 'staff' || info.wtype === 'herb') {
      // ไม้เท้า (จอมขมังเวทย์/หมอยา): ถือตั้งแบบไม้เท้าเดินป่า ยอดสูงกว่าหัว · เดินแกว่งเบา ๆ · ตอนร่ายยกขึ้นแล้วชี้ไปข้างหน้า
      staff = true; dy -= 2; dx += h.side * 3 * k;                       // กางออกข้างตัวอีกนิด ไม่บังหน้า
      ang = (flip ? -1 : 1) * (5 + (info.up || 0) + (st.anim === 'walk' ? Math.sin(time / 170) * 4 : 0) + (swinging ? Math.sin(t * Math.PI) * 35 : 0));   // up = หมุนภาพไม้เท้าที่วาดเฉียงให้ตั้งตรง
      dy -= swinging ? Math.sin(t * Math.PI) * 4 : 0;
      if (swinging && t < 0.6) {                                           // พลังรวมที่ปลายไม้เท้า
        const g = it.fx.setVisible(true).setDepth(spr.depth + 0.07), r = 2 + Math.sin(t / 0.6 * Math.PI) * 3;
        const c1 = info.wtype === 'herb' ? 0x7dffb0 : 0xffb347, c2 = info.wtype === 'herb' ? 0xe8fff0 : 0xfff3b0;
        g.fillStyle(c1, 0.35).fillCircle(spr.x + dx + ux * 4, spr.y + dy - 18, r * 1.8).fillStyle(c2, 0.9).fillCircle(spr.x + dx + ux * 4, spr.y + dy - 18, r);
      }
    } else {
      // ดาบ: เอียงพาดไหล่ · ตอนฟันเหวี่ยงโค้งไปทางหน้า
      // ง้างไปหลัง (0–0.25) → ฟันผ่าหน้า (0.25–0.6) → ค้างแล้วกลับท่าพัก
      let sw;
      if (!swinging) sw = -35;
      else if (t < 0.25) sw = -35 - Phaser.Math.Easing.Quadratic.Out(t / 0.25) * 40;
      else if (t < 0.6) sw = -75 + Phaser.Math.Easing.Cubic.Out((t - 0.25) / 0.35) * 190;
      else sw = 115 - Phaser.Math.Easing.Sine.InOut((t - 0.6) / 0.4) * 150;
      ang = (flip ? -1 : 1) * (sw + (info.up || 0));                       // up: ภาพดาบที่วาดเฉียง → หมุนให้ตั้งก่อน
      if (swinging && t > 0.25 && t < 0.62) { dx += ux * 3; dy += uy * 2; }
    }
    img.setOrigin(flip ? 1 - it.ox : it.ox, it.oy);                          // พลิกภาพ → จุดจับต้องพลิกตาม ไม่งั้นอาวุธลอยห่างมือ
    img.setVisible(true).setFlipX(flip).setScale(info.scale * 0.5 * k * (staff ? 1.15 : 1)).setAngle(ang)
      .setPosition(spr.x + dx, spr.y + dy).setDepth(spr.depth + (h.behind ? -0.05 : 0.05)).setAlpha(spr.alpha);
    // ออร่าอาวุธตีบวก: เรืองตามขั้น + ประกายลอยขึ้นจากใบอาวุธ (+7 ขึ้นไป)
    const wl = a.wenh || 0;
    if (it.wlv !== wl) { it.wlv = wl; it.wGlow = setGlow(img, wl, it.wGlow); }
    if (it.wGlow) it.wGlow.outerStrength = (1 + wl * 0.18) * (0.75 + 0.25 * Math.sin(time / 260));
    if (wl >= 7 && time > it.nextMote && spr.alpha > 0.5) {
      it.nextMote = time + Math.max(90, 420 - wl * 16);
      const len = (info.wtype === 'bow' ? 10 : 14) * k, ra = Phaser.Math.DegToRad(img.angle + (flip ? 180 : 0) - 90) ;
      const mx = img.x + Math.cos(ra) * len * Math.random(), my = img.y + Math.sin(ra) * len * Math.random();
      this.mote(mx, my, auraColor(wl), spr.depth + 0.08, wl);
    }
  }

  /** ออร่าชุดเกราะตีบวก: ขอบตัวเรือง (+1) · ประกายวนรอบเท้า (+10) */
  aura(it, a, time) {
    const spr = it.spr, al = spr._d8 && spr.visible ? a?.aenh || 0 : 0;
    if (it.alv !== al) { it.alv = al; it.aGlow = setGlow(spr, al, it.aGlow); }
    if (it.aGlow) it.aGlow.outerStrength = (0.8 + al * 0.12) * (0.7 + 0.3 * Math.sin(time / 380));
    if (al >= 10 && time > (it.nextAura || 0) && spr.alpha > 0.5) {
      it.nextAura = time + Math.max(110, 480 - al * 18);
      const ang = Math.random() * Math.PI * 2;
      this.mote(spr.x + Math.cos(ang) * 10, spr.y - 2 + Math.sin(ang) * 4, auraColor(al), spr.depth + (Math.sin(ang) < 0 ? -0.1 : 0.1), al, 22);
    }
  }

  /** ประกายเล็กๆ ลอยขึ้นแล้วจาง */
  mote(x, y, color, depth, lv, rise = 12) {
    const r = 0.8 + Math.min(1.2, lv * 0.06);
    const c = this.s.add.circle(x, y, r, color, 0.95).setDepth(depth).setBlendMode(Phaser.BlendModes.ADD);
    this.s.tweens.add({ targets: c, y: y - rise - Math.random() * 6, x: x + (Math.random() - 0.5) * 4, alpha: 0, scale: 0.4, duration: 650 + Math.random() * 350, onComplete: () => c.destroy() });
  }
}
