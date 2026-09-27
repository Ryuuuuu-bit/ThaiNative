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
    this.items.set(spr, { spr, img, getApp, getState, key: null, info: null, atkAt: -9999, lastAnim: '' });
  }

  detach(spr) { const it = this.items.get(spr); if (it) { it.img.destroy(); this.items.delete(spr); } }

  update(time) {
    for (const it of this.items.values()) this.draw(it, time);
  }

  draw(it, time) {
    const { spr, img } = it;
    if (!spr.active) return this.detach(spr);
    const a = it.getApp?.();
    const key = a?.weapon ? `ico_it_${a.weapon}` : null;
    // แสดงเฉพาะบนภาพ 8 ทิศ (สไปรต์เดิมวาดอาวุธในตัวอยู่แล้ว) และอาวุธที่มีภาพ
    if (!spr._d8 || !spr.visible || !key || !this.s.textures.exists(key)) { img.setVisible(false); return; }
    if (it.key !== key) {
      it.key = key; it.info = heldInfo(a, true);
      if (!it.info) { img.setVisible(false); return; }
      const src = this.s.textures.get(key).getSourceImage();
      img.setTexture(key).setOrigin(it.info.gx / src.width, it.info.gy / src.height);
    }
    const info = it.info; if (!info) { img.setVisible(false); return; }
    const dir = spr.dir || 'south', h = HAND[dir] || HAND.south, k = (spr.scaleX || 0.667) / 0.667;
    const st = it.getState?.() || {};
    if (st.anim === 'attack' && it.lastAnim !== 'attack') it.atkAt = time;
    it.lastAnim = st.anim;
    const t = Math.min(1, (time - it.atkAt) / 260), swinging = t < 1;
    const bob = st.anim === 'walk' ? Math.sin(time / 85) * 0.8 : 0;
    let ang, dx = h.x * k, dy = h.y * k + bob, flip = h.side < 0;
    if (info.wtype === 'bow') {
      // ธนู: ตั้งขึ้นข้างตัว · ตอนยิงหันไปทางเป้า
      ang = flip ? -12 : 12;
      if (swinging) { dx += Math.cos(Phaser.Math.DegToRad(DIR_ANGLE[dir])) * 4; dy += Math.sin(Phaser.Math.DegToRad(DIR_ANGLE[dir])) * 3; }
    } else if (info.wtype === 'staff') {
      // ไม้เท้า: ถือตั้ง · ตอนร่ายยกขึ้นแล้วชี้ไปข้างหน้า
      ang = (flip ? -1 : 1) * (8 + (swinging ? Math.sin(t * Math.PI) * 35 : 0));
      dy -= swinging ? Math.sin(t * Math.PI) * 4 : 0;
    } else {
      // ดาบ: เอียงพาดไหล่ · ตอนฟันเหวี่ยงโค้งไปทางหน้า
      const rest = -35, swing = rest + Phaser.Math.Easing.Cubic.Out(t) * 150;
      ang = (flip ? -1 : 1) * (swinging ? swing : rest);
    }
    img.setVisible(true).setFlipX(flip).setScale(info.scale * 0.5 * k).setAngle(ang)
      .setPosition(spr.x + dx, spr.y + dy).setDepth(spr.depth + (h.behind ? -0.05 : 0.05)).setAlpha(spr.alpha);
  }
}
