// ============================================================
//  อาวุธในมือสำหรับสไปรต์ 8 ทิศ
//  ▸ ใช้ไอคอนอาวุธที่สวมจริง (ico_it_<weapon>) + จุดจับจาก gear_art (heldInfo)
//  ▸ วางที่มือตามทิศ · อยู่หลังตัวเมื่อหันหลัง · เหวี่ยง/ยก/ง้างตอนโจมตี
// ============================================================
import { heldInfo } from '../gfx/PlayerArt.js';

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
    this.items.set(spr, { spr, img, fx, getApp, getState, key: null, info: null, atkAt: -9999, lastAnim: '' });
  }

  detach(spr) { const it = this.items.get(spr); if (it) { it.img.destroy(); it.fx.destroy(); this.items.delete(spr); } }

  update(time) {
    for (const it of this.items.values()) this.draw(it, time);
  }

  draw(it, time) {
    const { spr, img } = it;
    if (!spr.active) return this.detach(spr);
    const a = it.getApp?.();
    const key = a?.weapon ? `ico_it_${a.weapon}` : null;
    // แสดงเฉพาะบนภาพ 8 ทิศ (สไปรต์เดิมวาดอาวุธในตัวอยู่แล้ว) และอาวุธที่มีภาพ
    it.fx.clear().setVisible(false);
    if (!spr._d8 || !spr.visible || !key || !this.s.textures.exists(key) || spr._action) { img.setVisible(false); return; }
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
    let ang, dx = h.x * k, dy = h.y * k + bob, flip = h.side < 0;
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
    } else if (info.wtype === 'staff') {
      // ไม้เท้า: ถือตั้ง · ตอนร่ายยกขึ้นแล้วชี้ไปข้างหน้า
      ang = (flip ? -1 : 1) * (8 + (swinging ? Math.sin(t * Math.PI) * 35 : 0));
      dy -= swinging ? Math.sin(t * Math.PI) * 4 : 0;
      if (swinging && t < 0.6) {                                           // พลังรวมที่ปลายไม้เท้า
        const g = it.fx.setVisible(true).setDepth(spr.depth + 0.07), r = 2 + Math.sin(t / 0.6 * Math.PI) * 3;
        g.fillStyle(0xffb347, 0.35).fillCircle(spr.x + dx + ux * 4, spr.y + dy - 14, r * 1.8).fillStyle(0xfff3b0, 0.9).fillCircle(spr.x + dx + ux * 4, spr.y + dy - 14, r);
      }
    } else {
      // ดาบ: เอียงพาดไหล่ · ตอนฟันเหวี่ยงโค้งไปทางหน้า
      // ง้างไปหลัง (0–0.25) → ฟันผ่าหน้า (0.25–0.6) → ค้างแล้วกลับท่าพัก
      let sw;
      if (!swinging) sw = -35;
      else if (t < 0.25) sw = -35 - Phaser.Math.Easing.Quadratic.Out(t / 0.25) * 40;
      else if (t < 0.6) sw = -75 + Phaser.Math.Easing.Cubic.Out((t - 0.25) / 0.35) * 190;
      else sw = 115 - Phaser.Math.Easing.Sine.InOut((t - 0.6) / 0.4) * 150;
      ang = (flip ? -1 : 1) * sw;
      if (swinging && t > 0.25 && t < 0.62) { dx += ux * 3; dy += uy * 2; }
    }
    img.setOrigin(flip ? 1 - it.ox : it.ox, it.oy);                          // พลิกภาพ → จุดจับต้องพลิกตาม ไม่งั้นอาวุธลอยห่างมือ
    img.setVisible(true).setFlipX(flip).setScale(info.scale * 0.5 * k).setAngle(ang)
      .setPosition(spr.x + dx, spr.y + dy).setDepth(spr.depth + (h.behind ? -0.05 : 0.05)).setAlpha(spr.alpha);
  }
}
