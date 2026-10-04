// ============================================================
//  Fx – ชั้นเอฟเฟกต์ธีมไทย (ใช้ร่วมทั้งเกม)
//  ▸ เงาสัมผัสพื้นใต้ตัวละคร/ผี  ▸ ตัวเลขดาเมจแบบใหม่ (ขอบหนา คริทอง)
//  ▸ ประกายกระทบ (ดาวกนก)  ▸ วงยันต์ใต้เท้าตอนร่ายบัฟ/ท่าไม้ตาย/เลเวลอัป
//  ▸ ขอบจอมืด (vignette) + ขอบแดงเตือน HP ต่ำ  ▸ เมฆลอย + ชั้นหน้า (หญ้า/ดอกไม้)
//  ทุกอย่างวาดด้วยโค้ด ไม่ต้องมีไฟล์ภาพ
// ============================================================
import { WORLD } from '/shared/constants.js';
import { makeText } from '../systems/util.js';
import { spriteTopHeight } from '../topdown/Dir8.js';

const TEX = {};
/** วาดพื้นผิวลง canvas แล้วลงทะเบียนครั้งเดียว */
function tex(scene, key, w, h, draw) {
  if (scene.textures.exists(key)) return key;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  scene.textures.addCanvas(key, c);
  TEX[key] = true;
  return key;
}

// ------------------------------------------------------------
//  พื้นผิว
// ------------------------------------------------------------
/** ความลึกของเอฟเฟกต์: ฉากด้านข้างใช้ค่าคงที่ · ฉาก top-down (depth = y) แปลงผ่าน scene.fxDepth (ของบนพื้น/ลอยเหนือทุกอย่าง) */
const D = (scene, d) => (scene.fxDepth ? scene.fxDepth(d) : d);

export function bakeFx(scene) {
  // เงานุ่ม (วงรีไล่จาง)
  tex(scene, 'fx_shadow', 64, 20, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    r.addColorStop(0, 'rgba(0,0,0,.55)'); r.addColorStop(0.6, 'rgba(0,0,0,.25)'); r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r; g.save(); g.scale(1, h / w); g.beginPath(); g.arc(w / 2, w / 2, w / 2, 0, 7); g.fill(); g.restore();
  });
  // แสงนุ่ม (ใช้เป็นแสงตะเกียง/แสงหน้าต่าง)
  tex(scene, 'fx_glow', 96, 96, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, w);
  });
  // ดาวประกาย 4 แฉก (ประกายกระทบ)
  tex(scene, 'fx_spark', 24, 24, (g, w) => {
    const c = w / 2;
    g.fillStyle = '#fff'; g.beginPath();
    g.moveTo(c, 0); g.quadraticCurveTo(c + 2, c - 2, w, c); g.quadraticCurveTo(c + 2, c + 2, c, w); g.quadraticCurveTo(c - 2, c + 2, 0, c); g.quadraticCurveTo(c - 2, c - 2, c, 0);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(c, c, 3, 0, 7); g.fill();
  });
  // วงแหวน (ใช้ขยายตอนกระทบ/เลเวลอัป)
  tex(scene, 'fx_ring', 64, 64, (g, w) => {
    g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(w / 2, w / 2, w / 2 - 3, 0, 7); g.stroke();
  });
  // วงยันต์ (ยันต์ตรีนิสิงเห + วงกลมซ้อน + อักขระจุด)
  tex(scene, 'fx_yant', 128, 128, (g, w) => {
    const c = w / 2, R = c - 3;
    g.strokeStyle = '#ffe9a6'; g.lineWidth = 2.2;
    g.beginPath(); g.arc(c, c, R, 0, 7); g.stroke();
    g.lineWidth = 1.2; g.beginPath(); g.arc(c, c, R - 7, 0, 7); g.stroke();
    g.beginPath(); g.arc(c, c, R * 0.42, 0, 7); g.stroke();
    // สามเหลี่ยมซ้อน 2 (ตรีนิสิงเห)
    const tri = (rot) => { g.beginPath(); for (let i = 0; i < 3; i++) { const a = rot + i * 2.0944; const x = c + Math.cos(a) * (R - 11), y = c + Math.sin(a) * (R - 11); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); g.stroke(); };
    g.lineWidth = 1.6; tri(-Math.PI / 2); tri(Math.PI / 2);
    // อักขระ (จุด/ขีดเล็กรอบวง)
    g.fillStyle = '#ffe9a6';
    for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; const r0 = R - 4.5; g.beginPath(); g.arc(c + Math.cos(a) * r0, c + Math.sin(a) * r0, i % 2 ? 1.2 : 1.8, 0, 7); g.fill(); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283 + 0.39; g.beginPath(); g.moveTo(c + Math.cos(a) * (R * 0.42 + 3), c + Math.sin(a) * (R * 0.42 + 3)); g.lineTo(c + Math.cos(a) * (R - 13), c + Math.sin(a) * (R - 13)); g.stroke(); }
    // ตาข้าวหลามตัดกลาง
    g.beginPath(); g.moveTo(c, c - 9); g.lineTo(c + 9, c); g.lineTo(c, c + 9); g.lineTo(c - 9, c); g.closePath(); g.stroke();
    g.beginPath(); g.arc(c, c, 2.2, 0, 7); g.fill();
  });
  // เมฆ 3 แบบ
  for (let k = 0; k < 3; k++) tex(scene, `fx_cloud${k}`, 120, 40, (g, w, h) => {
    g.fillStyle = 'rgba(255,255,255,.92)';
    const blobs = [[30, 26, 22], [56, 18, 26], [84, 24, 20], [45, 28, 16], [70, 28, 18]];
    for (const [x, y, r] of blobs) { g.beginPath(); g.arc(x + k * 4, y, r - k * 2, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(200,220,240,.35)'; g.fillRect(14, 32, 90, 6);
  });
  // ขอบจอมืด
  tex(scene, 'fx_vignette', 480, 270, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, h * 0.45, w / 2, h / 2, w * 0.68);
    r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, 'rgba(10,5,20,.55)');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  });
  // ขอบจอแดง (HP ต่ำ)
  tex(scene, 'fx_lowhp', 480, 270, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.62);
    r.addColorStop(0, 'rgba(180,0,20,0)'); r.addColorStop(1, 'rgba(200,20,30,.7)');
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  });
  // แสงหน้าต่างเรือน (สี่เหลี่ยมอุ่น)
  tex(scene, 'fx_window', 14, 12, (g, w, h) => {
    g.fillStyle = '#ffd27a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#7a4a1a'; g.fillRect(w / 2 - 1, 0, 2, h); g.fillRect(0, h / 2 - 1, w, 2);
  });
}

// ------------------------------------------------------------
//  เงาสัมผัสพื้น
// ------------------------------------------------------------
export class Shadow {
  constructor(scene, target, w = 22) {
    this.scene = scene; this.target = target;
    this.img = scene.add.image(target.x, WORLD.groundY, 'fx_shadow').setDisplaySize(w, w * 0.32).setDepth((target.depth || 8) - 0.5).setAlpha(0.7);
    this.w = w;
  }
  update() {
    const t = this.target, s = this.img;
    if (!t.active || !t.visible || t.alpha < 0.2 || t.state === 'dead') { s.setVisible(false); return; }
    const gy = t.groundY ?? WORLD.groundY;
    const h = Math.max(0, gy - t.y);                       // ลอยสูง → เงาเล็ก/จาง
    const k = Math.max(0.35, 1 - h / 90);
    s.setVisible(true).setPosition(t.x, Math.min(gy, t.body?.bottom ?? gy) + 1).setDisplaySize(this.w * k, this.w * 0.32 * k).setAlpha(0.7 * k);
  }
  destroy() { this.img.destroy(); }
}

// ------------------------------------------------------------
//  ตัวเลขดาเมจ / ข้อความลอย
// ------------------------------------------------------------
const NUM = {
  normal: { color: '#fff7e6', size: 9, stroke: '#3a1d0e' },
  crit:   { color: '#ffd35c', size: 13, stroke: '#5a2a00' },
  taken:  { color: '#ff6b6b', size: 10, stroke: '#3a0000' },
  heal:   { color: '#7dff9a', size: 9, stroke: '#0d3a1a' },
  mana:   { color: '#8fd3ff', size: 9, stroke: '#0a2340' },
  miss:   { color: '#cfd3d6', size: 8, stroke: '#222' },
  poison: { color: '#a3f7b5', size: 8, stroke: '#0b3a1a' },
  exp:    { color: '#ffe9a6', size: 8, stroke: '#3a2a0a' },
  night:  { color: '#e2c8ff', size: 8, stroke: '#2a0a3a' },
};
const DMG_KINDS = new Set(['normal', 'crit', 'miss', 'taken', 'poison']);
/** Start floating text above the visible target; keep its ground anchor fixed as it rises. */
export function effectHeight(target) {
  return target.worldLabelHeight || spriteTopHeight(target) || 30;
}
export function popupAbove(scene, target, text, kind = 'normal', opts = {}) {
  const height = effectHeight(target);
  return popupNumber(scene, target.x + (opts.offsetX || 0), target.y - height - (opts.gap ?? 14), text, kind, { ...opts, groundY: target.y });
}
export function popupNumber(scene, x, y, text, kind = 'normal', opts = {}) {
  if (scene.settings?.damageNumbers === false && DMG_KINDS.has(kind)) return;   // ตั้งค่า: ปิดตัวเลขดาเมจ (EXP/ฮีล ยังแสดง)
  const st = NUM[kind] || NUM.normal;
  const t = makeText(scene, x + (Math.random() * 10 - 5), y, text, { fontSize: `${st.size}px`, color: st.color, stroke: st.stroke, strokeThickness: kind === 'crit' ? 4 : 3, fontStyle: '700' })
    .setOrigin(0.5).setDepth(D(scene, 50));
  if (Number.isFinite(opts.groundY)) t.worldAnchorY = opts.groundY;
  const dir = opts.dir ?? (Math.random() < 0.5 ? -1 : 1);
  if (kind === 'crit') {
    t.setScale(0.4);
    scene.tweens.add({ targets: t, scale: 1.25, duration: 120, ease: 'Back.easeOut', onComplete: () => scene.tweens.add({ targets: t, scale: 1, duration: 100 }) });
    scene.tweens.add({ targets: t, x: x + dir * 14, y: y - 26, duration: 900, ease: 'Cubic.easeOut' });
    scene.tweens.add({ targets: t, alpha: 0, duration: 400, delay: 600, onComplete: () => t.destroy() });
  } else if (kind === 'taken') {
    scene.tweens.add({ targets: t, x: x + dir * 10, y: y - 20, duration: 800, ease: 'Cubic.easeOut' });
    scene.tweens.add({ targets: t, alpha: 0, duration: 300, delay: 500, onComplete: () => t.destroy() });
  } else {
    t.setScale(0.7);
    scene.tweens.add({ targets: t, scale: 1, duration: 90, ease: 'Back.easeOut' });
    scene.tweens.add({ targets: t, x: x + dir * 9, y: y - 24, duration: 750, ease: 'Cubic.easeOut' });
    scene.tweens.add({ targets: t, alpha: 0, duration: 260, delay: 520, onComplete: () => t.destroy() });
  }
  return t;
}

/** ประกายกระทบ: ดาว 4 แฉก + วงแหวนขยาย + เศษประกาย */
export function hitSpark(scene, x, y, { crit = false, tint = 0xffffff, dir = 1, groundY = y } = {}) {
  const star = scene.add.image(x, y, 'fx_spark').setDepth(D(scene, 45)).setBlendMode(Phaser.BlendModes.ADD).setTint(crit ? 0xffd35c : tint).setScale(crit ? 1.3 : 0.8).setAngle(Math.random() * 90);
  star.worldAnchorY=groundY;
  scene.tweens.add({ targets: star, scale: crit ? 2.2 : 1.4, alpha: 0, angle: star.angle + 45, duration: crit ? 260 : 170, ease: 'Cubic.easeOut', onComplete: () => star.destroy() });
  if (crit) {
    const ring = scene.add.image(x, y, 'fx_ring').setDepth(D(scene, 45)).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd35c).setScale(0.2);
    ring.worldAnchorY=groundY;
    scene.tweens.add({ targets: ring, scale: 1.1, alpha: 0, duration: 300, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
  }
  const em = scene.add.particles(x, y, 'particle', {
    speed: { min: 40, max: crit ? 160 : 100 }, angle: { min: dir > 0 ? -60 : 120, max: dir > 0 ? 60 : 240 }, lifespan: 300, gravityY: 300,
    scale: { start: crit ? 0.9 : 0.6, end: 0 }, tint: crit ? [0xffd35c, 0xfff2b0, 0xff9f43] : [0xffffff, 0xfff2b0], quantity: crit ? 12 : 6, emitting: false, blendMode: 'ADD',
  }).setDepth(D(scene, 44));
  em.worldAnchorY=groundY;
  em.explode(crit ? 12 : 6);
  scene.time.delayedCall(400, () => em.destroy());
}

/** วงยันต์ใต้เท้า (บัฟ/ท่าไม้ตาย/เลเวลอัป) */
export function yantCircle(scene, x, y, { tint = 0xffe9a6, size = 60, ms = 1200, rise = false } = {}) {
  const y0 = y - 1;
  // หมุนภาพในคอนเทนเนอร์ที่ถูกบีบแนวตั้ง → วงยันต์นอนราบกับพื้นแบบมีมุมมอง
  const img = scene.add.image(0, 0, 'fx_yant').setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setDisplaySize(size, size);
  const ring = scene.add.container(x, y0, [img]).setDepth(D(scene, 9)).setScale(1, 0.34).setAlpha(0);
  ring.worldGroundEffect=true;ring.worldGroundAspect=.34;
  scene.tweens.add({ targets: ring, alpha: 0.95, duration: 150 });
  scene.tweens.add({ targets: img, angle: 120, duration: ms, ease: 'Sine.easeInOut' });
  scene.tweens.add({ targets: ring, alpha: 0, duration: 300, delay: ms - 300, onComplete: () => ring.destroy() });
  const glow = scene.add.image(x, y0, 'fx_glow').setDepth(D(scene, 8.9)).setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setDisplaySize(size * 1.2, size * 0.5).setAlpha(0.35);
  glow.worldGroundEffect=true;glow.worldGroundAspect=.5/1.2;
  scene.tweens.add({ targets: glow, alpha: 0, duration: ms, onComplete: () => glow.destroy() });
  if (rise) {                                                        // เสาแสงขึ้นฟ้า (เลเวลอัป)
    const beam = scene.add.image(x, y0, 'fx_glow').setDepth(D(scene, 45)).setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setDisplaySize(44, 140).setOrigin(0.5, 1).setAlpha(0.95);
    beam.worldAnchorY=y;
    scene.tweens.add({ targets: beam, displayHeight: 230, displayWidth: 20, alpha: 0, duration: 1100, ease: 'Cubic.easeOut', onComplete: () => beam.destroy() });
    const ring2 = scene.add.image(x, y0 - 14, 'fx_ring').setDepth(D(scene, 45)).setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setScale(0.3, 0.12).setAlpha(0.9);
    ring2.worldAnchorY=y;
    scene.tweens.add({ targets: ring2, scaleX: 2.4, scaleY: 0.9, alpha: 0, duration: 700, ease: 'Cubic.easeOut', onComplete: () => ring2.destroy() });
    const em = scene.add.particles(x, y0 - 10, 'particle', {
      x: { min: -14, max: 14 }, speedY: { min: -120, max: -50 }, speedX: { min: -8, max: 8 }, lifespan: 900, scale: { start: 0.7, end: 0 },
      tint: [tint, 0xffffff, 0xffb347], quantity: 3, frequency: 30, blendMode: 'ADD',
    }).setDepth(D(scene, 46));
    scene.time.delayedCall(700, () => em.stop());
    scene.time.delayedCall(1700, () => em.destroy());
  }
  return ring;
}

/** ท่ากระทบ: บี้-ยืด (squash & stretch) */
export function squash(scene, obj, k = 0.18, ms = 90) {
  if (!obj?.active || obj._squashing) return;
  obj._squashing = true;
  const sx = obj.scaleX, sy = obj.scaleY;
  scene.tweens.add({ targets: obj, scaleX: sx * (1 + k), scaleY: sy * (1 - k), duration: ms * 0.45, yoyo: true, ease: 'Quad.easeOut',
    onComplete: () => { obj.setScale(sx, sy); obj._squashing = false; } });
}

// ------------------------------------------------------------
//  ชั้นฉาก: ขอบจอ · เตือน HP ต่ำ · เมฆ · แถวหน้า (หญ้า/ดอกไม้)
// ------------------------------------------------------------
export class SceneFx {
  constructor(scene) {
    const s = (this.scene = scene);
    this.vignette = s.add.image(480, 270, 'fx_vignette').setScrollFactor(0).setDepth(31).setAlpha(0.9);
    this.lowHp = s.add.image(480, 270, 'fx_lowhp').setScrollFactor(0).setDepth(31.5).setAlpha(0);
    // เมฆลอยช้า ๆ (กลางวัน)
    this.clouds = [];
    for (let i = 0; i < 4; i++) {
      const c = s.add.image(80 + i * 140 + Math.random() * 60, 150 + Math.random() * 60, `fx_cloud${i % 3}`).setScrollFactor(0).setDepth(-9.5).setAlpha(0.75).setScale(0.6 + Math.random() * 0.5);
      c.vx = 2 + Math.random() * 3; this.clouds.push(c);
    }
    this.buildForeground();
  }

  /** แถวหน้า: หญ้า/ดอกไม้/กกเงาเข้ม เลื่อนเร็วกว่าพื้นเล็กน้อย → มีมิติ
   *  วาดเป็นเท็กซ์เจอร์ทีละช่วง 960px แล้ววางเป็นภาพ (ไม่ใช้ Graphics ก้อนเดียวยาว 25,000px ที่ต้องวาดใหม่ทุกเฟรม) */
  buildForeground() {
    const s = this.scene, gy = WORLD.groundY, CH = 960, H = 16;
    let seed = 99; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    this.fg = [];
    for (let cx = WORLD.minX; cx < WORLD.width; cx += CH) {
      const g = s.make.graphics({ x: 0, y: 0, add: false });
      for (let x = 0; x < CH; x += 5 + rnd() * 9) {
        const r = rnd(), inTown = cx + x < WORLD.townEndX;
        const col = inTown ? (r < 0.15 ? 0xf4a3c4 : r < 0.25 ? 0xffe27a : 0x2f7a3a) : 0x1f4a2a;
        const h = 4 + rnd() * 7, base = H - 1;
        if (r < 0.25 && inTown) { g.fillStyle(col, 1); g.fillRect(x, base - h, 1, h); g.fillCircle(x + 0.5, base - h - 1, 1.6); }   // ดอกไม้
        else { g.fillStyle(col, 1); g.fillRect(x, base - h, 1, h); if (rnd() < 0.5) g.fillRect(x + 2, base - h + 2, 1, h - 2); }  // หญ้า
      }
      const key = `fx_fg_${cx}`;
      if (!s.textures.exists(key)) g.generateTexture(key, CH, H);
      g.destroy();
      this.fg.push(s.add.image(cx, gy + 2, key).setOrigin(0, 1).setDepth(6.6).setAlpha(0.9));
    }
  }

  update(time, player, maxHp) {
    const s = this.scene;
    for (const c of this.clouds) {
      c.x -= c.vx * s.game.loop.delta / 1000;
      if (c.x < -80) c.x = 560;
    }
    const L = s.clock?.light ?? 1;
    this.clouds.forEach((c) => c.setAlpha(0.75 * L + 0.12));
    const hp = player?.char?.hp ?? 1, ratio = maxHp ? hp / maxHp : 1;
    const want = ratio < 0.3 && player?.alive ? 0.45 + Math.sin(time / 260) * 0.2 : 0;
    this.lowHp.setAlpha(this.lowHp.alpha + (want - this.lowHp.alpha) * 0.15);
  }
}
