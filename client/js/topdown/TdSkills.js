// ============================================================
//  สกิล Q W E R T ในโหมด Top-down + เอฟเฟกต์แบบ "อลังการ"
//  ▸ ใช้ข้อมูลสกิลชุดเดิม (shared/data/skills.js) · ดาเมจยังคิดที่ server (td:hit + sk)
//  ▸ ทุกสกิลมีลายเซ็นภาพของตัวเอง: ฟ้าผ่า/อุกกาบาต/ห่าฝนธนู/พายุดาบ/ช้างศึกกระแทก ฯลฯ
// ============================================================
import { SKILL_BY_ID, skillStats, SKILL_SLOTS, isItemSlot, skillUsable, skillWeaponTh, masteryOf } from '/shared/data/skills.js';
import { JOBS } from '/shared/data/classes.js';
import { popupNumber, yantCircle } from '../gfx/Fx.js';
import { dirFromVector } from './Dir8.js';
import { TILE, MAP_W, MAP_H } from '/shared/td/ayutthaya.js';
import { HealerKit, HEAL_TINT } from './TdHealer.js';

const ADD = () => Phaser.BlendModes.ADD;
const TOP = 99985;                           // ชั้นเอฟเฟกต์ลอย (เหนือตัวละคร)
const rand = (a, b) => a + Math.random() * (b - a);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** สีประจำสกิล */
const TINT = {
  mage_akom: 0xff8a2a, mage_yant: 0xffd35c, mage_shield: 0xffe27a, mage_thunder: 0x9fd8ff, mage_kalp: 0xff5a1f,
  boxer_jab: 0xfff1c0, boxer_kick: 0xffb454, boxer_croc: 0x9be870, boxer_waikru: 0xffd35c, boxer_ngouy: 0xffa040,
  sword_twin: 0xdff6ff, sword_thrust: 0xaee4ff, sword_wind: 0x8fe8ff, sword_guard: 0x6ec8ff, sword_pikat: 0xc9f2ff,
  arch_quick: 0xfff2c0, arch_poison: 0x7dff6a, arch_pierce: 0xffd35c, arch_hawk: 0xffe9a6, arch_rain: 0xff9a3c,
  mage_holy: 0x9dffcf, boxer_drum: 0xffa040, sword_banner: 0xffd35c, arch_garuda: 0xfff0a0,
  ...HEAL_TINT,
};

// ------------------------------------------------------------
//  texture เฉพาะสกิล (วาดครั้งเดียว)
// ------------------------------------------------------------
export function bakeSkillFx(scene) {
  const mk = (key, w, h, draw) => { if (scene.textures.exists(key)) return; const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); scene.textures.addCanvas(key, c); };
  // คลื่นกระแทก (วงแหวนขอบนุ่ม)
  mk('sk_shock', 128, 128, (g) => {
    const r = g.createRadialGradient(64, 64, 34, 64, 64, 62);
    r.addColorStop(0, 'rgba(255,255,255,0)'); r.addColorStop(0.7, 'rgba(255,255,255,0.9)'); r.addColorStop(0.85, 'rgba(255,255,255,0.5)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  });
  // ลำแสงแนวตั้ง
  mk('sk_beam', 32, 128, (g) => {
    const x = g.createLinearGradient(0, 0, 32, 0); x.addColorStop(0, 'rgba(255,255,255,0)'); x.addColorStop(0.5, 'rgba(255,255,255,1)'); x.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = x; g.fillRect(0, 0, 32, 128);
    g.globalCompositeOperation = 'destination-in';
    const y = g.createLinearGradient(0, 0, 0, 128); y.addColorStop(0, 'rgba(0,0,0,0)'); y.addColorStop(0.35, 'rgba(0,0,0,1)'); y.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = y; g.fillRect(0, 0, 32, 128);
  });
  // อุกกาบาต (หัวไฟ + หาง)
  mk('sk_meteor', 64, 24, (g) => {
    const t = g.createLinearGradient(0, 12, 50, 12); t.addColorStop(0, 'rgba(255,60,0,0)'); t.addColorStop(0.7, 'rgba(255,140,40,0.8)'); t.addColorStop(1, 'rgba(255,230,160,1)');
    g.fillStyle = t; g.beginPath(); g.moveTo(0, 12); g.lineTo(48, 3); g.lineTo(48, 21); g.fill();
    const h = g.createRadialGradient(50, 12, 0, 50, 12, 12); h.addColorStop(0, '#ffffff'); h.addColorStop(0.35, '#ffe08a'); h.addColorStop(1, 'rgba(255,90,0,0)');
    g.fillStyle = h; g.fillRect(36, 0, 28, 24);
  });
  // รอยแตกพื้น
  mk('sk_crack', 96, 48, (g) => {
    g.strokeStyle = 'rgba(40,20,10,0.85)'; g.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + Math.random() * 0.3; let x = 48, y = 24; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += Math.cos(a + rand(-0.5, 0.5)) * rand(6, 11); y += Math.sin(a + rand(-0.5, 0.5)) * rand(3, 5.5); g.lineTo(x, y); g.lineWidth = Math.max(1, 3 - k); }
      g.stroke();
    }
    g.fillStyle = 'rgba(30,15,5,0.6)'; g.beginPath(); g.ellipse(48, 24, 9, 5, 0, 0, Math.PI * 2); g.fill();
  });
  // คลื่นดาบวายุ (จันทร์เสี้ยวใหญ่)
  mk('sk_wave', 48, 64, (g) => {
    const gr = g.createLinearGradient(0, 0, 48, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,1)');
    g.fillStyle = gr; g.beginPath(); g.arc(4, 32, 40, -1.05, 1.05); g.arc(-8, 32, 38, 1.0, -1.0, true); g.fill();
  });
  // ยันต์กระดาษ
  mk('sk_paper', 12, 18, (g) => { g.fillStyle = '#fff3c4'; g.fillRect(0, 0, 12, 18); g.fillStyle = '#c0392b'; g.fillRect(2, 2, 8, 1); g.fillRect(5, 4, 2, 10); g.fillRect(3, 7, 6, 1); g.fillRect(3, 11, 6, 1); g.fillRect(2, 15, 8, 1); });
  // ===== ชุดใหม่: วงยันต์ละเอียด / ประกาย 4 แฉก / กลีบบัว / เปลวไฟ / โซ่วิญญาณ / ขนนก / หยดน้ำ / ธงครุฑ / ปีกครุฑ / ดอกบัว =====
  mk('sk_rune', 160, 160, (g) => {
    const C = 80; g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineCap = 'round';
    const ring = (r, w, a = 1) => { g.globalAlpha = a; g.lineWidth = w; g.beginPath(); g.arc(C, C, r, 0, Math.PI * 2); g.stroke(); };
    ring(76, 2.5); ring(70, 1.2, 0.8); ring(46, 2); ring(24, 1.5, 0.9);
    g.globalAlpha = 0.9; for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2, r0 = i % 4 ? 71 : 66; g.lineWidth = i % 4 ? 1 : 2; g.beginPath(); g.moveTo(C + Math.cos(a) * r0, C + Math.sin(a) * r0); g.lineTo(C + Math.cos(a) * 75, C + Math.sin(a) * 75); g.stroke(); }
    g.lineWidth = 1.6; for (const off of [0, Math.PI / 4]) { g.beginPath(); for (let i = 0; i <= 4; i++) { const a = off + (i / 4) * Math.PI * 2; const x = C + Math.cos(a) * 66, y = C + Math.sin(a) * 66; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; g.globalAlpha = 1; g.beginPath(); g.arc(C + Math.cos(a) * 58, C + Math.sin(a) * 58, 3.2, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 0.85; g.lineWidth = 1.2; const x = C + Math.cos(a) * 35, y = C + Math.sin(a) * 35; g.beginPath(); g.moveTo(x - 3, y - 4); g.quadraticCurveTo(x + 4, y, x - 2, y + 4); g.stroke(); }
    g.globalAlpha = 0.95; g.lineWidth = 1.5; for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.beginPath(); g.moveTo(C, C); g.quadraticCurveTo(C + Math.cos(a - 0.35) * 22, C + Math.sin(a - 0.35) * 22, C + Math.cos(a) * 24, C + Math.sin(a) * 24); g.quadraticCurveTo(C + Math.cos(a + 0.35) * 22, C + Math.sin(a + 0.35) * 22, C, C); g.stroke(); }
    g.globalAlpha = 1; g.beginPath(); g.arc(C, C, 4, 0, Math.PI * 2); g.fill();
  });
  mk('sk_star4', 32, 32, (g) => {
    const r = g.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,255,255,0.5)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 32, 32); g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(16, 0); g.quadraticCurveTo(17.5, 14.5, 32, 16); g.quadraticCurveTo(17.5, 17.5, 16, 32); g.quadraticCurveTo(14.5, 17.5, 0, 16); g.quadraticCurveTo(14.5, 14.5, 16, 0); g.fill();
  });
  mk('sk_petal', 14, 22, (g) => { const r = g.createLinearGradient(0, 0, 0, 22); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(1, 'rgba(255,255,255,0.35)'); g.fillStyle = r; g.beginPath(); g.moveTo(7, 0); g.quadraticCurveTo(15, 10, 7, 22); g.quadraticCurveTo(-1, 10, 7, 0); g.fill(); });
  mk('sk_flame', 18, 34, (g) => {
    const r = g.createRadialGradient(9, 26, 1, 9, 22, 16); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.4, 'rgba(255,255,255,0.85)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.beginPath(); g.moveTo(9, 0); g.quadraticCurveTo(18, 18, 14, 28); g.quadraticCurveTo(9, 36, 4, 28); g.quadraticCurveTo(0, 18, 9, 0); g.fill();
  });
  mk('sk_chain', 64, 12, (g) => { g.strokeStyle = '#fff'; g.lineWidth = 2; for (let i = 0; i < 6; i++) { g.globalAlpha = 1; g.beginPath(); g.ellipse(6 + i * 10.5, 6, 6, i % 2 ? 2.2 : 4, 0, 0, Math.PI * 2); g.stroke(); } });
  mk('sk_feather', 30, 10, (g) => { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(0, 5); g.quadraticCurveTo(14, -3, 30, 5); g.quadraticCurveTo(14, 13, 0, 5); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(2, 5); g.lineTo(28, 5); g.stroke(); });
  mk('sk_drop', 10, 14, (g) => { const r = g.createRadialGradient(5, 9, 0, 5, 9, 6); r.addColorStop(0, '#fff'); r.addColorStop(1, 'rgba(255,255,255,0.4)'); g.fillStyle = r; g.beginPath(); g.moveTo(5, 0); g.quadraticCurveTo(10, 8, 5, 14); g.quadraticCurveTo(0, 8, 5, 0); g.fill(); });
  mk('sk_banner', 52, 84, (g) => {
    g.fillStyle = '#5a3a1a'; g.fillRect(4, 4, 4, 80); g.fillStyle = '#ffd35c'; g.beginPath(); g.arc(6, 4, 4, 0, Math.PI * 2); g.fill();
    const r = g.createLinearGradient(8, 0, 50, 0); r.addColorStop(0, '#b3202a'); r.addColorStop(1, '#e8453a'); g.fillStyle = r;
    g.beginPath(); g.moveTo(8, 8); g.lineTo(50, 12); g.lineTo(44, 30); g.lineTo(50, 48); g.lineTo(8, 52); g.closePath(); g.fill();
    g.strokeStyle = '#ffd35c'; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#ffd35c'; g.beginPath(); g.arc(26, 30, 9, 0, Math.PI * 2); g.fill(); g.fillStyle = '#b3202a';
    g.beginPath(); g.moveTo(26, 23); g.lineTo(30, 31); g.lineTo(26, 37); g.lineTo(22, 31); g.closePath(); g.fill();
    g.fillStyle = '#ffd35c'; g.beginPath(); g.moveTo(17, 28); g.lineTo(26, 31); g.lineTo(17, 34); g.fill(); g.beginPath(); g.moveTo(35, 28); g.lineTo(26, 31); g.lineTo(35, 34); g.fill();
  });
  mk('sk_wing', 128, 64, (g) => {
    g.fillStyle = '#fff';
    for (let i = 0; i < 7; i++) { const t = i / 6; g.globalAlpha = 0.55 + t * 0.45; g.beginPath(); g.moveTo(4, 56); g.quadraticCurveTo(40 + t * 30, 10 + t * 4, 124 - t * 10, 4 + t * 18); g.quadraticCurveTo(70 + t * 10, 30 + t * 8, 4, 60); g.fill(); }
  });
  mk('sk_lotus', 128, 64, (g) => {
    const petal = (a, len, w, c1, c2) => { g.save(); g.translate(64, 50); g.rotate(a); const r = g.createLinearGradient(0, 0, 0, -len); r.addColorStop(0, c1); r.addColorStop(1, c2); g.fillStyle = r;
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(w, -len * 0.55, 0, -len); g.quadraticCurveTo(-w, -len * 0.55, 0, 0); g.fill(); g.restore(); };
    for (let i = -3; i <= 3; i++) petal(i * 0.42, 34, 12, '#f7a8c8', '#fff0f6');
    for (let i = -2; i <= 2; i++) petal(i * 0.38, 44, 11, '#ff7fb0', '#ffe3ef');
    g.fillStyle = '#ffd35c'; g.beginPath(); g.ellipse(64, 46, 10, 4, 0, 0, Math.PI * 2); g.fill();
  });
  // ขนนกเหยี่ยว
  mk('sk_hawk', 40, 20, (g) => {
    g.fillStyle = 'rgba(255,240,190,1)';
    g.beginPath(); g.moveTo(20, 8); g.quadraticCurveTo(10, 0, 0, 4); g.quadraticCurveTo(10, 6, 18, 12); g.fill();
    g.beginPath(); g.moveTo(20, 8); g.quadraticCurveTo(30, 0, 40, 4); g.quadraticCurveTo(30, 6, 22, 12); g.fill();
    g.beginPath(); g.ellipse(20, 11, 3, 6, 0, 0, Math.PI * 2); g.fill();
  });
}

// ============================================================
//  ชุดเอฟเฟกต์พื้นฐาน
// ============================================================
export class GrandFx {
  constructor(scene) { this.s = scene; }

  img(x, y, key, { tint = 0xffffff, depth = TOP, add = true, alpha = 1 } = {}) {
    const i = this.s.add.image(x, y, key).setDepth(depth).setTint(tint).setAlpha(alpha);
    if (add) i.setBlendMode(ADD());
    return i;
  }

  tween(t) { return this.s.tweens.add(t); }
  shake(ms = 180, k = 0.006) { this.s.cameras.main.shake(ms, k); }             // ปิดได้ในตั้งค่า (ดู TopDownScene)
  /** ความแรงแสงวาบตามตั้งค่า: เต็ม 1 · ลดลง 0.3 · ปิด 0 */
  get flashK() { const f = this.s.settings?.fxFlash; return f === 'off' ? 0 : f === 'soft' ? 0.3 : 1; }
  flash(ms = 120, c = 0xffffff, a = 0.55) {
    a *= this.flashK; if (!a) return;
    const cam = this.s.cameras.main, v = cam.worldView;
    const r = this.s.add.rectangle(v.centerX, v.centerY, v.width + 40, v.height + 40, c, a).setDepth(TOP + 10).setBlendMode(ADD());
    this.tween({ targets: r, alpha: 0, duration: ms, onComplete: () => r.destroy() });
  }
  /** ท้องฟ้ามืดลงชั่วครู่ (สกิลใหญ่) */
  darken(ms = 900, c = 0x140a2a, a = 0.45) {
    a *= this.flashK ? Math.max(0.5, this.flashK) : 0; if (!a) return;
    const v = this.s.cameras.main.worldView;
    const r = this.s.add.rectangle(v.centerX, v.centerY, v.width * 1.6, v.height * 1.6, c, 0).setDepth(TOP - 20);
    this.tween({ targets: r, fillAlpha: a, duration: 160, yoyo: true, hold: ms, onComplete: () => r.destroy() });
  }

  /** วงคลื่นกระแทกแบนราบกับพื้น */
  shock(x, y, { r = 60, tint = 0xffffff, ms = 420, depth = 0.95 } = {}) {
    const i = this.img(x, y, 'sk_shock', { tint, depth }).setDisplaySize(8, 4);
    this.tween({ targets: i, displayWidth: r * 2.2, displayHeight: r * 1.1, alpha: 0, duration: ms, ease: 'Cubic.easeOut', onComplete: () => i.destroy() });
  }

  glow(x, y, { size = 80, tint = 0xffffff, ms = 300, alpha = 0.9, depth = TOP } = {}) {
    const g = this.img(x, y, 'fx_glow', { tint, depth, alpha }).setDisplaySize(size * 0.4, size * 0.4);
    this.tween({ targets: g, displayWidth: size, displayHeight: size, alpha: 0, duration: ms, ease: 'Cubic.easeOut', onComplete: () => g.destroy() });
  }

  sparks(x, y, { n = 14, tint = 0xffd35c, speed = [60, 200], life = 500, scale = 0.35, gravity = 120, depth = TOP } = {}) {
    const e = this.s.add.particles(x, y, 'fx_spark', { speed: { min: speed[0], max: speed[1] }, angle: { min: 0, max: 360 }, lifespan: life, scale: { start: scale, end: 0 }, alpha: { start: 1, end: 0 }, tint, gravityY: gravity, blendMode: 'ADD', emitting: false }).setDepth(depth);
    e.explode(n); this.s.time.delayedCall(life + 60, () => e.destroy());
  }

  smoke(x, y, { n = 6, tint = 0x5a4a3a, r = 20 } = {}) {
    for (let i = 0; i < n; i++) {
      const p = this.img(x + rand(-r, r) * 0.6, y + rand(-4, 2), 'fx_glow', { tint, add: false, alpha: 0.5, depth: y + 2 }).setDisplaySize(10, 7);
      this.tween({ targets: p, displayWidth: rand(26, 40), displayHeight: rand(16, 24), y: p.y - rand(8, 22), x: p.x + rand(-12, 12), alpha: 0, duration: rand(600, 1000), ease: 'Sine.easeOut', onComplete: () => p.destroy() });
    }
  }

  crack(x, y, { scale = 1, ms = 2200 } = {}) {
    const c = this.s.add.image(x, y, 'sk_crack').setDepth(0.92).setScale(scale * 0.3, scale * 0.3).setAlpha(0.95);
    this.tween({ targets: c, scale: scale, duration: 120, ease: 'Back.easeOut' });
    this.tween({ targets: c, alpha: 0, delay: ms, duration: 600, onComplete: () => c.destroy() });
  }

  /** ระเบิดครบชุด: แสงวาบ + คลื่น + ประกาย + ควัน + รอยไหม้ */
  explode(x, y, { r = 40, tint = 0xff8a2a, shake = true, crack = false } = {}) {
    this.glow(x, y - 8, { size: r * 3, tint, ms: 380 });
    this.glow(x, y - 8, { size: r * 1.4, tint: 0xffffff, ms: 180 });
    this.shock(x, y, { r: r * 1.3, tint });
    this.s.time.delayedCall(70, () => this.shock(x, y, { r: r * 0.9, tint: 0xffffff, ms: 300 }));
    this.sparks(x, y - 6, { n: Math.round(r / 2), tint, speed: [r, r * 4], life: 520, scale: 0.4 });
    this.smoke(x, y, { n: Math.round(r / 7), r });
    if (crack) this.crack(x, y, { scale: r / 45 });
    if (shake) this.shake(160 + r * 2, Math.min(0.014, 0.003 + r / 9000));
  }

  /** ฟ้าผ่า (เส้นหยักพร้อมกิ่ง) */
  lightning(x, y, { tint = 0x9fd8ff, h = 230 } = {}) {
    const g = this.s.add.graphics().setDepth(TOP + 2).setBlendMode(ADD());
    const bolt = (x0, y0, x1, y1, w, a, seg) => {
      const pts = [[x0, y0]];
      for (let i = 1; i < seg; i++) { const t = i / seg; pts.push([x0 + (x1 - x0) * t + rand(-10, 10), y0 + (y1 - y0) * t]); }
      pts.push([x1, y1]);
      for (const [lw, al, col] of [[w * 3, a * 0.35, tint], [w, a, 0xffffff]]) { g.lineStyle(lw, col, al); g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts) g.lineTo(p[0], p[1]); g.strokePath(); }
      return pts;
    };
    const main = bolt(x + rand(-30, 30), y - h, x, y - 4, 3, 1, 10);
    for (let k = 0; k < 3; k++) { const p = main[2 + Math.floor(Math.random() * 6)]; bolt(p[0], p[1], p[0] + rand(-40, 40), p[1] + rand(20, 50), 1.5, 0.8, 4); }
    this.tween({ targets: g, alpha: 0, duration: 260, delay: 60, onComplete: () => g.destroy() });
    const beam = this.img(x, y, 'sk_beam', { tint, depth: TOP + 1 }).setOrigin(0.5, 1).setDisplaySize(28, h);
    this.tween({ targets: beam, displayWidth: 4, alpha: 0, duration: 380, onComplete: () => beam.destroy() });
  }

  /** ภาพติดตา (ตอนพุ่ง) */
  afterimage(spr, tint = 0x9fd8ff) {
    if (!spr?.texture) return;
    const a = this.s.add.image(spr.x, spr.y, spr.texture.key, spr.frame.name).setOrigin(spr.originX, spr.originY).setScale(spr.scaleX, spr.scaleY).setFlipX(spr.flipX)
      .setTint(tint).setTintFill?.(tint);
    a.setDepth(spr.depth - 1).setAlpha(0.55).setBlendMode(ADD());
    this.tween({ targets: a, alpha: 0, duration: 320, onComplete: () => a.destroy() });
  }

  /** รอยฟันขนาดใหญ่ */
  slash(x, y, ang, { size = 1, tint = 0xffffff, ms = 220, flip = false } = {}) {
    const i = this.img(x, y, 'td_slash', { tint }).setRotation(ang).setScale(size * 0.8).setFlipY(flip);
    this.tween({ targets: i, scale: size * 1.25, alpha: 0, duration: ms, ease: 'Cubic.easeOut', onComplete: () => i.destroy() });
  }

  /** เสาแสงพลัง (บัฟ) */
  pillar(x, y, { tint = 0xffd35c, h = 110, ms = 900, w = 46, alpha = 1 } = {}) {
    const b = this.img(x, y, 'sk_beam', { tint, depth: TOP - 1, alpha }).setOrigin(0.5, 1).setDisplaySize(4, h);
    this.tween({ targets: b, displayWidth: w, duration: 180, ease: 'Back.easeOut' });
    this.tween({ targets: b, alpha: 0, delay: ms * 0.5, duration: ms * 0.5, onComplete: () => b.destroy() });
    const e = this.s.add.particles(x, y, 'fx_spark', { x: { min: -16, max: 16 }, speedY: { min: -140, max: -60 }, lifespan: 700, scale: { start: 0.3, end: 0 }, alpha: { start: 1, end: 0 }, tint, blendMode: 'ADD', frequency: 25 }).setDepth(TOP);
    this.s.time.delayedCall(ms * 0.7, () => e.stop()); this.s.time.delayedCall(ms + 700, () => e.destroy());
  }

  /** วงยันต์นอนราบกับพื้น (ละเอียด 2 ชั้นหมุนสวนกัน) */
  rune(x, y, { size = 90, tint = 0xffd35c, ms = 1200, spin = 90, alpha = 0.95, depth = 0.96, inner = true } = {}) {
    const a = this.img(0, 0, 'sk_rune', { tint, depth }).setDisplaySize(size, size);
    const list = [a];
    const g = this.img(0, 0, 'fx_glow', { tint, depth, alpha: 0.45 }).setDisplaySize(size * 1.25, size * 1.25);
    list.unshift(g);
    if (inner) list.push(this.img(0, 0, 'sk_rune', { tint: 0xffffff, depth, alpha: 0.6 }).setDisplaySize(size * 0.55, size * 0.55));
    const c = this.s.add.container(x, y - 1, list).setDepth(depth).setScale(0.2, 0.07).setAlpha(0);
    this.tween({ targets: c, scaleX: 1, scaleY: 0.36, alpha, duration: 220, ease: 'Back.easeOut' });
    this.tween({ targets: a, angle: spin, duration: ms });
    if (list[2]) this.tween({ targets: list[2], angle: -spin * 1.5, duration: ms });
    this.tween({ targets: c, alpha: 0, scaleX: 1.15, scaleY: 0.41, delay: ms - 280, duration: 280, onComplete: () => c.destroy() });
    return c;
  }

  /** ประกาย 4 แฉกกระพริบกระจายรอบจุด */
  stars(x, y, { n = 8, tint = 0xffffff, r = 30, size = 16, ms = 600, up = 0, depth = TOP + 1 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, d = rand(r * 0.3, r);
      const st = this.img(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6, 'sk_star4', { tint, depth }).setDisplaySize(1, 1).setAngle(rand(0, 45));
      const sz = rand(size * 0.6, size * 1.2);
      this.tween({ targets: st, displayWidth: sz, displayHeight: sz, duration: ms * 0.3, delay: i * (ms / n / 2), yoyo: true, hold: ms * 0.2, y: st.y - up, onComplete: () => st.destroy() });
    }
  }

  /** กลีบดอกไม้ร่วง/ปลิว */
  petals(x, y, { n = 10, tint = 0xffc0dc, r = 40, fall = true, ms = 1400, depth = TOP } = {}) {
    for (let i = 0; i < n; i++) {
      const px = x + rand(-r, r), py = fall ? y - rand(60, 110) : y + rand(-6, 6);
      const p = this.img(px, py, 'sk_petal', { tint, add: false, depth, alpha: 0.95 }).setScale(rand(0.5, 0.9)).setAngle(rand(0, 360));
      this.tween({ targets: p, y: fall ? y + rand(-6, 8) : py - rand(40, 80), x: px + rand(-24, 24), angle: p.angle + rand(-220, 220), alpha: 0, delay: i * 45, duration: rand(ms * 0.7, ms), ease: 'Sine.easeInOut', onComplete: () => p.destroy() });
    }
  }

  /** เปลวไฟลุกขึ้นจากพื้น */
  flames(x, y, { n = 8, tint = 0xff7a2a, r = 20, h = 30, ms = 700, depth } = {}) {
    for (let i = 0; i < n; i++) {
      const fx = x + rand(-r, r), fy = y + rand(-r, r) * 0.4;
      const f = this.img(fx, fy, 'sk_flame', { tint, depth: depth ?? fy + 2 }).setOrigin(0.5, 1).setScale(rand(0.5, 0.9), 0.1);
      this.tween({ targets: f, scaleY: rand(0.7, 1.2) * (h / 30), duration: ms * 0.35, delay: i * 30, ease: 'Back.easeOut', yoyo: true, hold: ms * 0.3, onComplete: () => f.destroy() });
    }
  }

  /** โซ่วิญญาณพุ่งจากพื้นรอบเป้า 4 ทิศเข้าล็อก */
  chains(t, { tint = 0xffd35c, ms = 1600, n = 4 } = {}) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.PI / 4, R = 38;
      const sx = t.x + Math.cos(a) * R, sy = t.y + Math.sin(a) * R * 0.45;
      const c = this.img(sx, sy, 'sk_chain', { tint, depth: TOP }).setOrigin(0, 0.5).setAlpha(0);
      const ty = t.y - (t.displayHeight || 30) * 0.45, ang = Math.atan2(ty - sy, t.x - sx), len = Math.hypot(t.x - sx, ty - sy);
      c.setRotation(ang).setDisplaySize(4, 10);
      this.tween({ targets: c, displayWidth: len, alpha: 1, duration: 180, delay: i * 70, ease: 'Cubic.easeOut' });
      this.tween({ targets: c, alpha: 0.4, duration: 220, delay: 300 + i * 70, yoyo: true, repeat: Math.max(0, Math.floor(ms / 440) - 1) });
      this.s.time.delayedCall(ms, () => this.tween({ targets: c, alpha: 0, displayWidth: len * 0.2, duration: 200, onComplete: () => c.destroy() }));
      this.s.time.delayedCall(i * 70 + 170, () => this.stars(sx, sy - 2, { n: 2, tint, r: 6, size: 12, ms: 380 }));
      out.push(c);
    }
    return out;
  }

  /** ออร่าที่พื้นใต้ตัวละคร + ละอองลอยขึ้น (ตามตัวไป) */
  aura(spr, { tint = 0xffd35c, ms = 2400, motes = 'fx_spark' } = {}) {
    if (!spr) return;
    const o = spr.spr || spr;
    const g = this.img(o.x, o.y, 'fx_glow', { tint, depth: 0.97, alpha: 0.6 }).setDisplaySize(46, 16);
    const e = this.s.add.particles(0, 0, motes, { follow: o, followOffset: { x: 0, y: -4 }, x: { min: -12, max: 12 }, speedY: { min: -70, max: -30 }, lifespan: 800, scale: { start: motes === 'fx_spark' ? 0.25 : 0.35, end: 0 }, alpha: { start: 0.9, end: 0 }, tint, frequency: 60, blendMode: 'ADD' }).setDepth(TOP - 2);
    const ev = this.s.time.addEvent({ delay: 16, loop: true, callback: () => g.setPosition(o.x, o.y).setAlpha(0.45 + Math.sin(this.s.time.now / 180) * 0.15) });
    this.s.time.delayedCall(ms, () => { ev.remove(); e.stop(); this.tween({ targets: g, alpha: 0, duration: 300, onComplete: () => g.destroy() }); this.s.time.delayedCall(900, () => e.destroy()); });
  }

  /** เสาแสงฮีลลงบนตัว + ตัวเลข */
  healOn(spr, { tint = 0x7dff9a, amount = 0, mp = 0 } = {}) {
    const o = spr?.spr || spr; if (!o) return;
    this.pillar(o.x, o.y, { tint, h: 80, ms: 700, w: 26, alpha: 0.8 });
    this.stars(o.x, o.y - 20, { n: 5, tint, r: 16, size: 12, ms: 700, up: 20 });
    if (amount > 0) popupNumber(this.s, o.x, o.y - (o.displayHeight || 40) - 16, `+${amount}`, 'heal');
    if (mp > 0) this.s.time.delayedCall(180, () => popupNumber(this.s, o.x + 10, o.y - (o.displayHeight || 40) - 8, `+${mp} MP`, 'mana'));
  }

  /** กระสุนบิน + หางประกาย → คืน Promise ตอนถึงเป้า */
  fly(key, x0, y0, x1, y1, { speed = 300, tint = 0xffffff, scale = 1, trail = 0xffe0a0, trailScale = 0.25, add = true, spin = 0, onArrive } = {}) {
    const a = Math.atan2(y1 - y0, x1 - x0), ms = Math.max(80, (Math.hypot(x1 - x0, y1 - y0) / speed) * 1000);
    const b = this.img(x0, y0, key, { tint, add }).setRotation(a).setScale(scale);
    const tr = this.s.add.particles(0, 0, 'fx_spark', { follow: b, lifespan: 320, scale: { start: trailScale, end: 0 }, alpha: { start: 0.9, end: 0 }, tint: trail, frequency: 14, blendMode: 'ADD' }).setDepth(TOP - 1);
    const t = { targets: b, x: x1, y: y1, duration: ms, onComplete: () => { b.destroy(); tr.stop(); this.s.time.delayedCall(340, () => tr.destroy()); onArrive?.(); } };
    if (spin) t.angle = b.angle + spin;
    this.tween(t);
    return ms;
  }
}

// ============================================================
//  ระบบร่ายสกิล
// ============================================================
export class TdSkills {
  constructor(scene) {
    this.s = scene; this.fx = new GrandFx(scene);
    bakeSkillFx(scene);
    const p = scene.player;
    p.cooldowns = {};
    p.cooldownLeft = (id, time = scene.time.now) => Math.max(0, (p.cooldowns[id] || 0) - time);
    p.trySkill = (time, key) => this.cast(key, time);
    this.heal = new HealerKit(this);                             // หมอยา: เป้าเพื่อน + เอฟเฟกต์
  }
  healFx(d) { this.heal.healFx(d); }
  tetherFx(d) { this.heal.tetherFx(d); }
  seedFx(d) { this.heal.seedFx(d); }

  /** เสียงชั้นพิเศษ (ของผู้เล่นอื่นเบากว่า/ข้ามถ้าไกล) */
  snd(name) { this.s.sfx?.play(name); }

  solidAt(x, y) {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    return tx < 0 || ty < 0 || tx >= (this.s.mapW || MAP_W) || ty >= (this.s.mapH || MAP_H) || !!this.s.solid?.[ty]?.[tx];
  }

  // ---------------- เลือกเป้า / ทิศ ----------------
  aim(range) {
    const s = this.s, p = s.player;
    let t = p.target?.alive ? p.target : null;
    if (!t || dist(t, p) > range) t = s.mobs.filter((m) => m.alive && m.visible !== false && dist(m, p) <= range).sort((a, b) => dist(a, p) - dist(b, p))[0] || null;
    const v = t ? { x: t.x - p.x, y: t.y - p.y } : dirVec(p.dir);
    const l = Math.hypot(v.x, v.y) || 1;
    return { t, ux: v.x / l, uy: v.y / l };
  }

  mobsNear(x, y, r) { return this.s.mobs.filter((m) => m.alive && m.visible !== false && Math.hypot(m.x - x, (m.y - y) * 1.3) <= r); }

  /** ดาเมจ: ออนไลน์ส่ง server · ออฟไลน์คิดในเครื่อง */
  hit(m, sk, fxTint) {
    const s = this.s;
    if (!m?.alive) return;
    this.fx.sparks(m.x, m.y - m.displayHeight * 0.5, { n: 6, tint: fxTint, speed: [40, 120], life: 300, scale: 0.25 });
    if (s.econ.server) return s.net.send('td:hit', { mid: m.mid, sk: sk.id });
    const d = s.player.derived, magic = sk.kind === 'magic';
    const crit = Math.random() < (d.critRate || 0.05);
    let dmg = Math.max(1, Math.round((magic ? d.matk || d.patk : d.patk) * sk.mult * rand(0.9, 1.1) - (m.def.def || 0)));
    if (crit) dmg = Math.round(dmg * (d.critDmg || 1.5));
    m.hp -= dmg;
    s.onMobDamage(m, { hit: true, crit, dmg, by: 'me' });
    if (sk.effect?.stun) m.stunUntil = s.time.now + sk.effect.stun.ms;
    if (m.hp <= 0) { s.onMobDie(m); s.localReward(m); }
  }

  // ---------------- Auto Skill (แบบบอทร่ายสกิลตามลำดับ Q→T) ----------------
  /** ระยะที่สกิลนี้ถึงเป้า */
  reachOf(sk) { if (sk.type === 'party' || sk.type === 'revive') return 60; if (sk.type === 'tether' || sk.type === 'seed' || sk.type === 'bounce') return sk.range; if (sk.type === 'mortar') return 220; return sk.type === 'projectile' || sk.type === 'strike' ? sk.range : sk.type === 'aoe' ? (sk.offset ? 220 : sk.radius + 40) : sk.type === 'dash' ? sk.distance + 30 : 60; }

  /** สกิลช่อง key ร่ายได้ทันทีไหม (เงียบ ไม่แจ้งเตือน) → { id, sk } | null */
  ready(key, time) {
    const p = this.s.player, c = p.char, id = c.hotbar?.[key];
    if (!id || isItemSlot(id)) return null;
    const lv = c.skills?.[id] || 0, base = SKILL_BY_ID[id];
    if (!lv || !base || !skillUsable(base, c.appearance.job)) return null;
    const sk = skillStats(base, lv, masteryOf(c, id));
    if (p.cooldownLeft(id, time) > 0 || c.mp < sk.mp) return null;
    return { id, sk };
  }

  /** เรียกทุกเฟรม: ถ้าเปิด Auto Skill และกำลังตีเป้า → ร่ายสกิลแรกที่พร้อม (ช่อง 1→0 ข้ามไอเทม) (บัฟเมื่อหมดฤทธิ์ · สกิลโจมตีเมื่อเป้าอยู่ในระยะ) */
  autoTick(time) {
    const s = this.s, p = s.player;
    if (!s.settings?.autoSkill || !p.alive || s.recalling || s.ui.anyOpen?.() || time < (this.autoAt || 0)) return;
    const t = p.target;
    if (!t?.alive || dist(t, p) > 260) return;
    this.autoAt = time + 250;
    for (const key of SKILL_SLOTS) {
      const r = this.ready(key, time);
      if (!r) continue;
      if (r.sk.type === 'tether' || r.sk.type === 'seed') { if (!this.heal.needHeal(0.75, r.sk.range)) continue; }
      else if (r.sk.type === 'revive') { if (!this.heal.anyDead(r.sk.radius) && !this.heal.needHeal(0.35, r.sk.radius)) continue; }
      else if (r.sk.type === 'buff' || r.sk.type === 'party') { if ((p.buffs || []).some((b) => b.sk === r.id && b.until > time)) continue; }
      else if (dist(t, p) > this.reachOf(r.sk)) continue;
      this.cast(key, time);
      this.autoAt = time + 600;          // เว้นจังหวะให้ท่าร่ายเล่นจบ
      return;
    }
  }

  // ---------------- ร่ายจากปุ่ม Q W E R T ----------------
  cast(key, time = this.s.time.now) {
    const s = this.s, p = s.player, c = p.char, ui = s.ui;
    if (!p.alive || s.ui.anyOpen?.()) return;
    const id = c.hotbar?.[key];
    if (isItemSlot(id)) return s.useSlot?.(key);
    if (!id) {
      if (time - (p.cooldowns[`_${key}`] ?? -9999) > 1500) { ui.toast(`ช่อง ${key} ว่าง – ลากสกิล (K) หรือไอเทม (I) มาวาง`, 'warn'); p.cooldowns[`_${key}`] = time; }
      return;
    }
    const lv = c.skills?.[id] || 0, base = SKILL_BY_ID[id];
    if (!lv || !base) return;
    if (!skillUsable(base, c.appearance.job)) { if (time - (p.cooldowns[`_w${key}`] ?? -9999) > 1500) { ui.toast(`${base.nameTh}: ต้องถือ${skillWeaponTh(base, JOBS)}`, 'warn'); s.sfx.play('error'); p.cooldowns[`_w${key}`] = time; } return; }
    const sk = skillStats(base, lv, masteryOf(c, id));
    if (p.cooldownLeft(id, time) > 0) return;
    (c.skx ||= {})[id] = (c.skx[id] || 0) + 1;                   // ความชำนาญ (server นับจริง · ฝั่งนี้ให้ UI ขยับทันที)
    if (c.mp < sk.mp) { ui.toast('MP ไม่พอ!', 'warn'); s.sfx.play('error'); p.cooldowns[id] = time + 400; return; }
    c.mp -= sk.mp; p.cooldowns[id] = time + sk.cd;
    const reach = this.reachOf(sk);
    const aim = this.aim(reach);
    const healer = base.job === 'healer', prep = healer ? this.heal.prep(sk, aim) : null;
    if (prep?.ally && prep.ally !== p) { const v = { x: prep.ally.x - p.x, y: prep.ally.y - p.y }, l = Math.hypot(v.x, v.y) || 1; aim.ux = v.x / l; aim.uy = v.y / l; }
    p.dir = dirFromVector(aim.ux, aim.uy, p.dir); p.setVelocity(0, 0); p.path = []; p.st = 'attack';
    s.playerAnim(healer || sk.type === 'buff' || sk.type === 'party' || sk.kind === 'magic' ? 'cast' : 'attack', true) || s.playerAnim('attack', true);
    s.time.delayedCall(sk.castMs || 420, () => { if (p.st === 'attack') p.st = 'idle'; });
    s.sfx.play(sk.sfx);
    if (s.econ.server) s.net.socket?.emit('skill:cast', { skillId: id, lv: sk.lv, x: Math.round(p.x), y: Math.round(p.y), dir: aim.ux < 0 ? -1 : 1, tx: aim.t ? Math.round(aim.t.x) : Math.round(p.x + aim.ux * 100), ty: aim.t ? Math.round(aim.t.y) : Math.round(p.y + aim.uy * 100),
      ...(prep ? { allies: prep.allies, ...(prep.tx != null ? { tx: prep.tx, ty: prep.ty, n: prep.n } : {}) } : {}) });
    this.play(sk, { x: p.x, y: p.y, ux: aim.ux, uy: aim.uy, t: aim.t, caster: p, local: true, prep });
  }

  /** ผู้เล่นอื่นร่าย (ภาพอย่างเดียว) */
  remote(d, spr) {
    const sk = skillStats(SKILL_BY_ID[d.skillId], d.lv);
    if (!sk) return;
    const tx = d.tx ?? d.x + d.dir * 80, ty = d.ty ?? d.y, l = Math.hypot(tx - d.x, ty - d.y) || 1;
    const t = { x: tx, y: ty, alive: true, displayHeight: 30 };
    if (Math.hypot(d.x - this.s.player.x, d.y - this.s.player.y) < 300) this.s.sfx.play(sk.sfx);
    this.play(sk, { x: d.x, y: d.y, ux: (tx - d.x) / l, uy: (ty - d.y) / l, t, caster: spr, local: false });
  }

  // ------------------------------------------------------------
  //  เล่นสกิล: ภาพ + (ถ้าเป็นของเรา) ดาเมจ
  // ------------------------------------------------------------
  play(sk, o) {
    const fx = this.fx, s = this.s, tint = TINT[sk.id] || 0xffffff, dmg = o.local;
    const H = (m) => dmg && this.hit(m, o.hitSk || sk, tint);
    const S = (n) => { if (o.local || dist(o, s.player) < 300) this.snd(n); };
    const at = (ms, f) => s.time.delayedCall(ms, f);
    const cx = o.x, cy = o.y, ang = Math.atan2(o.uy, o.ux);
    if (sk.ultimate) { yantCircle(s, cx, cy, { tint, size: 90, ms: 1100, rise: true }); fx.darken(700); S('skFlash'); }
    if (SKILL_BY_ID[sk.id]?.job === 'healer' && this.heal.play(sk, o)) return;
    const HY_FX = { hy_spellblade: 'sword_twin', hy_holywater: 'mage_holy', hy_herbarrow: 'arch_poison', hy_monkey: 'boxer_ngouy', hy_krabi: 'sword_pikat' };
    if (HY_FX[sk.id] && !o.hitSk) {                               // เคล็ดวิชาผสม: ยืมลายเซ็นภาพจากสกิลต้นแบบ + ประกายสองสี (ดาเมจยังนับเป็นสกิลผสม)
      fx.sparks(cx, cy - 20, { n: 14, tint: 0xc39bff, speed: [40, 140], life: 600, scale: 0.3 });
      fx.sparks(cx, cy - 20, { n: 10, tint: 0xffd35c, speed: [40, 140], life: 600, scale: 0.3 });
      return this.play({ ...sk, id: HY_FX[sk.id], ultimate: false }, { ...o, hitSk: sk });
    }

    switch (sk.id) {
      // ======================= จอมขมังเวทย์ =======================
      case 'mage_akom': {                                       // ลูกไฟนาคา 2 ลูก: วงยันต์เล็กที่มือ → โค้งเข้าเป้า → ระเบิดเพลิง + ประกาย
        fx.rune(cx + o.ux * 10, cy + o.uy * 6, { size: 40, tint, ms: 500, spin: 180 });
        for (let i = 0; i < (sk.count || 2); i++) at(i * 110, () => this.shot(sk, o, { key: 'td_orb', scale: 2.4, tint, trail: 0xff7a1a, trailScale: 0.55, curve: (i ? -1 : 1) * 28,
          onHit: (m, x, y) => { fx.explode(x, y, { r: 26, tint, shake: i === 1 }); fx.flames(x, y, { n: 6, tint: 0xff7a2a, r: 14, h: 24 }); fx.stars(x, y - 12, { n: 4, tint: 0xffe08a, r: 18 }); H(m); } }));
        break;
      }
      case 'mage_yant': {                                       // ยันต์ตรึงวิญญาณ: ยันต์ทอง 3 แผ่นหมุนเป็นพัด → วงยันต์ใต้เป้า → โซ่วิญญาณ 4 ทิศล็อก → ตราประทับทอง
        fx.rune(cx, cy, { size: 54, tint, ms: 700, spin: 200 });
        fx.stars(cx + o.ux * 12, cy - 18, { n: 5, tint, r: 14, size: 14, ms: 500 });
        const side = [-1, 0, 1];
        side.forEach((k, i) => at(i * 60, () => {
          const px = -o.uy * k * 10, py = o.ux * k * 10;
          fx.fly('sk_paper', cx + px, cy - 16 + py, cx + o.ux * (sk.range * 0.9) + px, cy - 16 + o.uy * (sk.range * 0.9) + py, { speed: (sk.speed || 220) * 1.2, scale: 1.5, tint: 0xffffff, add: false, trail: tint, trailScale: 0.4, spin: 900 });
        }));
        this.shot(sk, o, { key: 'fx_glow', scale: 0.35, tint, trail: tint, trailScale: 0.3, pierce: true,
          onHit: (m) => {
            H(m);
            fx.rune(m.x, m.y, { size: 70, tint, ms: 1900, spin: 160 });
            fx.chains(m, { tint, ms: 1700 });
            const seal = fx.img(m.x, m.y - (m.displayHeight || 30) * 0.55, 'sk_paper', { tint: 0xffffff, add: false, depth: TOP + 3 }).setScale(2.2).setAlpha(0);
            fx.tween({ targets: seal, scale: 1.2, alpha: 1, duration: 200, delay: 260, ease: 'Back.easeOut' });
            fx.tween({ targets: seal, alpha: 0, y: seal.y - 10, delay: 1600, duration: 300, onComplete: () => seal.destroy() });
            at(260, () => { fx.glow(m.x, m.y - 16, { size: 70, tint, ms: 380 }); fx.stars(m.x, m.y - 16, { n: 6, tint, r: 20, size: 14 }); });
          } });
        break;
      }
      case 'mage_shield': {                                     // เกราะยันต์เก้ายอด: วงยันต์ใหญ่ → เสายันต์ 9 ต้น → โดมแสง + กลีบบัวร่วง
        const sp = o.caster;
        fx.rune(cx, cy, { size: 110, tint, ms: 1700, spin: 120 });
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2, x = cx + Math.cos(a) * 30, y = cy + Math.sin(a) * 13;
          at(i * 50, () => { fx.pillar(x, y, { tint, h: 60, ms: 900, w: 9, alpha: 0.85 }); fx.stars(x, y - 40, { n: 1, tint, r: 2, size: 12, ms: 500 }); });
        }
        at(450, () => { const d = fx.img(cx, cy - 16, 'fx_ring', { tint, alpha: 0.85 }).setScale(0.2, 0.25); fx.tween({ targets: d, scaleX: 1.2, scaleY: 1.05, alpha: 0, duration: 1000, ease: 'Cubic.easeOut', onComplete: () => d.destroy() }); fx.flash(160, tint, 0.25); fx.petals(cx, cy, { n: 10, tint: 0xfff0b0, r: 40 }); });
        if (dmg) this.buff(sk);
        if (sp) { this.orbit(sp, tint, 9, 2800); fx.aura(sp, { tint, ms: 2800 }); }
        break;
      }
      case 'mage_thunder': {                                    // อัสนีบาต: ฟ้ามืด → วงยันต์ที่เป้า → ฟ้าผ่า 3 สาย + สายฟ้าแตกกิ่ง
        const t = o.t || { x: cx + o.ux * 90, y: cy + o.uy * 90 };
        fx.darken(700, 0x0a1030, 0.5);
        fx.rune(t.x, t.y, { size: 80, tint, ms: 1000, spin: 240 });
        [0, 120, 200].forEach((ms, i) => at(260 + ms, () => {
          fx.lightning(t.x + (i ? rand(-12, 12) : 0), t.y, { tint });
          if (i === 0) { S('skThunder'); fx.flash(140, 0xdff4ff, 0.7); fx.explode(t.x, t.y, { r: 34, tint, crack: true }); fx.stars(t.x, t.y - 16, { n: 8, tint: 0xffffff, r: 34, size: 18 }); if (o.t?.alive) H(o.t); }
          else fx.sparks(t.x, t.y - 10, { n: 10, tint, speed: [80, 220], life: 380 });
        }));
        break;
      }
      case 'mage_kalp': {                                       // เพลิงกัลป์: ฟ้าแดง → วงยันต์เพลิง → อุกกาบาตถล่ม → ไฟลุกค้าง
        const c = this.center(sk, o);
        fx.darken(sk.hits * sk.interval + 900, 0x3a0a00, 0.4);
        fx.rune(c.x, c.y, { size: sk.radius * 2.2, tint, ms: sk.hits * sk.interval + 1000, spin: 70 });
        for (let i = 0; i < sk.hits; i++) at(200 + i * sk.interval, () => {
          for (let k = 0; k < 2; k++) {
            const x = c.x + rand(-sk.radius, sk.radius) * 0.7, y = c.y + rand(-sk.radius, sk.radius) * 0.35;
            if (k === 0) S('skWhistle');
            fx.fly('sk_meteor', x - 110, y - 240, x, y, { speed: 900, scale: 1.4, trail: 0xff5a1f, trailScale: 0.7, onArrive: () => { fx.explode(x, y, { r: 38, tint, crack: k === 0 }); fx.flames(x, y, { n: 7, tint: 0xff6a1f, r: 18, h: 34, ms: 1000 }); if (k === 0) S('skBoom'); } });
          }
          at(280, () => this.mobsNear(c.x, c.y, sk.radius).forEach(H));
        });
        at(200 + sk.hits * sk.interval + 250, () => { S('skSlam'); fx.flash(260, 0xffb070, 0.6); fx.shock(c.x, c.y, { r: sk.radius * 1.4, tint, ms: 700 }); fx.shake(420, 0.014); fx.stars(c.x, c.y - 20, { n: 12, tint: 0xffe08a, r: sk.radius, size: 18 }); });
        break;
      }
      case 'mage_holy': {                                       // [ปาร์ตี้] น้ำมนต์ธาราทิพย์: บัวทิพย์บาน → วงยันต์เขียวทอง → ฝนน้ำมนต์ลงทุกคนในปาร์ตี้
        const T2 = 0x9dffcf;
        fx.rune(cx, cy, { size: sk.radius * 1.1, tint: T2, ms: 1800, spin: 60 });
        const lo = fx.img(cx, cy - 4, 'sk_lotus', { add: false, depth: cy + 1 }).setOrigin(0.5, 0.8).setScale(0.1);
        fx.tween({ targets: lo, scale: 1.1, duration: 500, ease: 'Back.easeOut' });
        fx.tween({ targets: lo, alpha: 0, scale: 1.3, delay: 1500, duration: 400, onComplete: () => lo.destroy() });
        at(300, () => { fx.pillar(cx, cy, { tint: T2, h: 150, ms: 1100, w: 50 }); fx.flash(200, T2, 0.25); fx.petals(cx, cy, { n: 16, tint: 0xffc6e0, r: 70 }); });
        this.partyTargets(sk, o).forEach((m, i) => at(500 + i * 120, () => {
          const t = m.spr || m;
          for (let k = 0; k < 8; k++) at(k * 40, () => { const x = t.x + rand(-14, 14); const d = fx.img(x, t.y - 90, 'sk_drop', { tint: T2 }).setScale(0.8); fx.tween({ targets: d, y: t.y - 6, duration: 320, ease: 'Quad.easeIn', onComplete: () => { d.destroy(); fx.shock(x, t.y, { r: 10, tint: T2, ms: 260 }); } }); });
          at(360, () => fx.healOn(m, { tint: T2, amount: this.healAmt(m, sk), mp: m === s.player ? Math.round((s.player.derived?.maxMp || 0) * (sk.mpHeal || 0)) : 0 }));
          fx.aura(m, { tint: T2, ms: 2600 });
        }));
        if (dmg) this.buff(sk);
        break;
      }
      // ======================= นักมวย =======================
      case 'boxer_jab': {                                       // หมัดแย็บ 3 จังหวะ: เส้นความเร็ว + ประกายดาวที่จุดกระทบ
        for (let i = 0; i < sk.hits; i++) at(i * sk.interval, () => {
          const x = cx + o.ux * 18, y = cy + o.uy * 18 - 14;
          const ln = fx.img(x - o.ux * 10, y - o.uy * 5, 'fx_glow', { tint }).setRotation(ang).setDisplaySize(26, 3); fx.tween({ targets: ln, alpha: 0, displayWidth: 40, duration: 140, onComplete: () => ln.destroy() });
          fx.glow(x, y, { size: 34, tint, ms: 160 }); fx.shock(x, y + 12, { r: 16, tint, ms: 220 });
          const m = this.front(o, sk.range + 12)[0]; if (m) { H(m); fx.stars(m.x, m.y - 16, { n: 2, tint: 0xffffff, r: 8, size: 16, ms: 260 }); }
        });
        break;
      }
      case 'boxer_kick': {                                      // เตะก้านคอ: จันทร์เสี้ยวเพลิง + คลื่นกระแทก + ดาวมึน
        const x = cx + o.ux * 20, y = cy + o.uy * 20 - 14;
        fx.slash(x, y, ang, { size: 1.4, tint, ms: 280 }); fx.slash(x, y, ang, { size: 0.9, tint: 0xffffff, ms: 180 });
        fx.flames(x, y + 14, { n: 5, tint: 0xff8a2a, r: 10, h: 22, ms: 500 });
        at(90, () => { fx.shock(x, y + 14, { r: 40, tint }); fx.shake(150, 0.006); this.front(o, sk.range + 14).slice(0, 1).forEach((m) => { H(m); fx.glow(m.x, m.y - 14, { size: 54, tint }); this.dizzy(m, 900); }); });
        break;
      }
      case 'boxer_croc': {                                      // จระเข้ฟาดหาง: หางเขียวกวาดเป็นวง + ฝุ่น + คลื่น 2 ชั้น
        for (let i = 0; i < sk.hits; i++) at(i * sk.interval, () => {
          for (let k = 0; k < 6; k++) at(k * 24, () => fx.slash(cx + Math.cos(k * 1.05 + i) * 18, cy - 10 + Math.sin(k * 1.05 + i) * 8, k * 1.05 + i + 1.57, { size: 1, tint, ms: 220 }));
          fx.shock(cx, cy, { r: sk.radius, tint }); at(80, () => fx.shock(cx, cy, { r: sk.radius * 1.3, tint: 0xffffff, ms: 320 }));
          fx.smoke(cx, cy, { n: 8, r: sk.radius, tint: 0x8a7a5a });
          this.mobsNear(cx, cy, sk.radius).forEach(H);
        });
        break;
      }
      case 'boxer_waikru': {                                    // ไหว้ครู: วงยันต์ทอง + เสาแสง + ไฟศักดิ์สิทธิ์รอบตัว
        fx.pillar(cx, cy, { tint, h: 150, ms: 1300 }); fx.rune(cx, cy, { size: 90, tint, ms: 1500, spin: 100 });
        fx.flames(cx, cy, { n: 10, tint: 0xffb03a, r: 26, h: 28, ms: 900 });
        at(300, () => { fx.flash(200, tint, 0.3); fx.shock(cx, cy, { r: 64, tint, ms: 600 }); fx.stars(cx, cy - 30, { n: 8, tint, r: 30, size: 16, up: 20 }); });
        if (dmg) this.buff(sk);
        if (o.caster) { this.orbit(o.caster, tint, 6, 2600); fx.aura(o.caster, { tint: 0xffb03a, ms: 2600 }); }
        break;
      }
      case 'boxer_ngouy': {                                     // หักงวงไอยรา: กระโดดพุ่ง → กระแทกพื้น 3 วง + ดาวแตก + หินกระเด็น
        this.dash(sk, o, { tint, leap: true, onLand: (x, y) => {
          fx.explode(x, y, { r: 56, tint, crack: true }); fx.flash(160, 0xffe0b0, 0.5); S('skSlam');
          [90, 180].forEach((ms, i) => at(ms, () => fx.shock(x, y, { r: 80 + i * 30, tint: i ? tint : 0xffffff, ms: 520 })));
          fx.stars(x, y - 20, { n: 10, tint: 0xffe08a, r: 50, size: 18 });
          this.mobsNear(x, y, 50).forEach((m) => { H(m); this.dizzy(m, 1400); });
        } });
        break;
      }
      case 'boxer_drum': {                                      // [ปาร์ตี้] กลองมังคละ: 3 จังหวะกลอง (คลื่นส้มใหญ่) → ไฟศึกลุกบนทุกคน
        const T2 = 0xffa040;
        fx.rune(cx, cy, { size: sk.radius, tint: T2, ms: 1600, spin: 45 });
        [0, 320, 640].forEach((ms, i) => at(ms, () => {
          fx.shock(cx, cy, { r: 70 + i * 40, tint: T2, ms: 520 }); fx.shock(cx, cy, { r: 40 + i * 30, tint: 0xffffff, ms: 320 });
          fx.glow(cx, cy - 20, { size: 70, tint: T2, ms: 260 }); fx.shake(120, 0.004); S('skSlam');
          fx.stars(cx, cy - 26, { n: 4, tint: 0xffe08a, r: 28, size: 16 });
        }));
        this.partyTargets(sk, o).forEach((m, i) => at(700 + i * 90, () => {
          const t = m.spr || m; fx.flames(t.x, t.y, { n: 8, tint: T2, r: 12, h: 30, ms: 900 }); fx.healOn(m, { tint: 0xffc070, amount: this.healAmt(m, sk) }); fx.aura(m, { tint: T2, ms: 2600 });
        }));
        if (dmg) this.buff(sk);
        break;
      }
      // ======================= นักดาบ =======================
      case 'sword_twin': {                                      // ฟันดาบคู่เป็นกากบาท + ประกายเหล็ก
        for (let i = 0; i < sk.hits; i++) at(i * sk.interval, () => {
          const x = cx + o.ux * 22, y = cy + o.uy * 22 - 12;
          fx.slash(x, y, ang + (i ? 0.7 : -0.7), { size: 1.3, tint, flip: !!i }); fx.slash(x, y, ang + (i ? 0.7 : -0.7), { size: 0.8, tint: 0xffffff, flip: !!i, ms: 160 });
          const list = this.front(o, sk.range + 10); (sk.all ? list : list.slice(0, 1)).forEach(H);
          if (i) { fx.glow(x, y, { size: 64, tint }); fx.shake(100, 0.004); fx.stars(x, y, { n: 5, tint: 0xffffff, r: 18, size: 14, ms: 360 }); }
        });
        break;
      }
      case 'sword_thrust': {                                    // แทงทะลวง: วงลมที่เท้า → พุ่งเป็นเส้นแสง + ภาพติดตา → ดาวที่ปลายทาง
        fx.shock(cx, cy, { r: 26, tint, ms: 300 });
        this.dash(sk, o, { tint, line: true, onPath: H, onLand: (x, y) => fx.stars(x, y - 16, { n: 6, tint, r: 20, size: 14 }) });
        break;
      }
      case 'sword_wind': {                                      // ดาบวายุ: จันทร์เสี้ยวยักษ์ + ลมหมุนดาวฟ้า
        fx.slash(cx + o.ux * 16, cy - 12 + o.uy * 16, ang, { size: 1.3, tint });
        fx.shock(cx, cy, { r: 30, tint, ms: 280 });
        this.shot(sk, o, { key: 'sk_wave', scale: 1.25, tint, trail: 0xdff6ff, trailScale: 0.5, pierce: true, wide: 24, onHit: (m) => { fx.slash(m.x, m.y - 14, ang, { size: 1, tint }); fx.stars(m.x, m.y - 16, { n: 3, tint: 0xffffff, r: 12, size: 12, ms: 300 }); H(m); } });
        break;
      }
      case 'sword_guard': {                                     // ตั้งการ์ด: ดาบแสงหมุนรอบตัว + วงยันต์ฟ้า + โล่
        const sp = o.caster;
        for (let i = 0; i < 8; i++) at(i * 50, () => fx.slash(cx + Math.cos(i * 0.8) * 16, cy - 16 + Math.sin(i * 0.8) * 8, i * 0.8 + 1.57, { size: 0.8, tint, ms: 420 }));
        fx.shock(cx, cy, { r: 44, tint, ms: 600 }); fx.rune(cx, cy, { size: 80, tint, ms: 1300, spin: -120 });
        at(250, () => { const d = fx.img(cx, cy - 18, 'fx_ring', { tint, alpha: 0.8 }).setScale(0.2, 0.3); fx.tween({ targets: d, scaleX: 0.9, scaleY: 1.0, alpha: 0, duration: 700, onComplete: () => d.destroy() }); });
        if (dmg) this.buff(sk);
        if (sp) { this.orbit(sp, tint, 6, 2600); fx.aura(sp, { tint, ms: 2600 }); }
        break;
      }
      case 'sword_pikat': {                                     // เพลงดาบพิฆาต: วงยันต์ + พายุคมดาบ + ปิดท้ายกากบาทยักษ์
        const c = { x: cx + o.ux * (sk.offset || 0), y: cy + o.uy * (sk.offset || 0) };
        fx.rune(c.x, c.y, { size: sk.radius * 2.4, tint, ms: sk.hits * sk.interval + 700, spin: 200 });
        for (let i = 0; i < sk.hits; i++) at(i * sk.interval, () => {
          for (let k = 0; k < 3; k++) { const a = i * 1.1 + k * 2.09; fx.slash(c.x + Math.cos(a) * sk.radius * 0.5, c.y - 12 + Math.sin(a) * sk.radius * 0.25, a + 1.57, { size: 1.2, tint, ms: 180 }); }
          fx.shock(c.x, c.y, { r: sk.radius * 0.9, tint, ms: 260 }); if (i % 2 === 0) S('skWhirl');
          this.mobsNear(c.x, c.y, sk.radius).forEach(H);
          if (i % 2) { fx.shake(90, 0.004); fx.stars(c.x, c.y - 16, { n: 3, tint: 0xffffff, r: sk.radius * 0.6, size: 14, ms: 300 }); }
        });
        at(sk.hits * sk.interval + 60, () => {
          fx.slash(c.x, c.y - 14, 0.78, { size: 2.8, tint: 0xffffff, ms: 380 }); fx.slash(c.x, c.y - 14, -0.78, { size: 2.8, tint: 0xffffff, ms: 380 });
          fx.flash(180, 0xe8faff, 0.6); fx.explode(c.x, c.y, { r: 52, tint, crack: true }); S('skSlam'); S('skFlash');
          fx.stars(c.x, c.y - 20, { n: 10, tint, r: 50, size: 18 });
        });
        break;
      }
      case 'sword_banner': {                                    // [ปาร์ตี้] ธงชัยเฉลิมพล: ปักธงครุฑ → คลื่นทอง → ออร่าแดงทองบนทุกคน
        const T2 = 0xffd35c;
        const flag = fx.img(cx + 14, cy + 2, 'sk_banner', { add: false, depth: cy + 3 }).setOrigin(0.1, 1).setScale(0.6, 0.05);
        fx.tween({ targets: flag, scaleY: 0.6, duration: 260, ease: 'Back.easeOut' });
        const wave = s.time.addEvent({ delay: 60, loop: true, callback: () => flag.setScale(0.6 + Math.sin(s.time.now / 120) * 0.04, 0.6) });
        at(2600, () => { wave.remove(); fx.tween({ targets: flag, alpha: 0, duration: 400, onComplete: () => flag.destroy() }); });
        at(220, () => { S('skSlam'); fx.shock(cx, cy, { r: sk.radius * 0.8, tint: T2, ms: 700 }); fx.flash(180, 0xffe0a0, 0.3); fx.crack(cx + 14, cy, { scale: 0.5, ms: 1600 }); fx.stars(cx + 14, cy - 50, { n: 8, tint: T2, r: 24, size: 16 }); });
        fx.rune(cx, cy, { size: sk.radius, tint: 0xff5a4a, ms: 1800, spin: 60 });
        this.partyTargets(sk, o).forEach((m, i) => at(400 + i * 90, () => { fx.aura(m, { tint: 0xff6a4a, ms: 3000 }); fx.pillar((m.spr || m).x, (m.spr || m).y, { tint: T2, h: 90, ms: 800, w: 22 }); }));
        if (dmg) this.buff(sk);
        break;
      }
      // ======================= นักธนู =======================
      case 'arch_quick': {                                      // ศรฉับไว: ศรแสง 2 ดอก + ดาวที่เป้า
        for (let i = 0; i < (sk.count || 2); i++) at(i * 90, () => this.shot(sk, o, { key: 'td_arrow', scale: 1.4, tint: 0xffffff, add: false, trail: tint, trailScale: 0.35,
          onHit: (m, x, y) => { fx.glow(x, y - 10, { size: 38, tint }); fx.stars(x, y - 12, { n: 2, tint: 0xffffff, r: 8, size: 12, ms: 260 }); H(m); } }));
        break;
      }
      case 'arch_poison': {                                     // ศรพิษ: ศรเขียว → หมอกพิษ + ฟองพิษ
        this.shot(sk, o, { key: 'td_arrow', scale: 1.5, tint: 0x9dff8a, add: false, trail: tint, trailScale: 0.4, onHit: (m, x, y) => { H(m); this.poison(x, y, tint); fx.rune(x, y, { size: 44, tint, ms: 1200, spin: 90, inner: false }); } });
        break;
      }
      case 'arch_pierce': {                                     // ศรทะลวงเกราะ: ชาร์จแสง → ลำแสงทองยาว + คลื่นทั้งแนว
        fx.glow(cx + o.ux * 12, cy - 16 + o.uy * 12, { size: 80, tint, ms: 320 }); fx.stars(cx + o.ux * 12, cy - 16, { n: 4, tint, r: 14, size: 14, ms: 300 });
        const x1 = cx + o.ux * sk.range, y1 = cy + o.uy * sk.range;
        const b = fx.img((cx + x1) / 2, (cy + y1) / 2 - 16, 'fx_glow', { tint }).setRotation(ang).setDisplaySize(sk.range, 12);
        fx.tween({ targets: b, displayHeight: 1, alpha: 0, duration: 440, onComplete: () => b.destroy() });
        this.shot(sk, o, { key: 'td_arrow', scale: 2.2, tint: 0xfff2c0, add: false, trail: tint, trailScale: 0.65, pierce: true, wide: 16, onHit: (m, x, y) => { fx.explode(x, y, { r: 22, tint, shake: false }); H(m); } });
        fx.shake(140, 0.005);
        break;
      }
      case 'arch_hawk': {                                       // ตาเหยี่ยว: วิญญาณเหยี่ยวทองวน + ขนนกโปรย
        const sp = o.caster, bird = fx.img(cx, cy - 60, 'sk_hawk', { tint }).setScale(0.3);
        let a = 0; const ev = s.time.addEvent({ delay: 16, repeat: 120, callback: () => { a += 0.09; const f = sp?.spr || sp || { x: cx, y: cy }; bird.setPosition(f.x + Math.cos(a) * 30, f.y - 44 + Math.sin(a) * 10).setScale(0.85 + Math.sin(a * 3) * 0.1); if (a % 0.5 < 0.1) fx.sparks(bird.x, bird.y, { n: 2, tint, life: 300, scale: 0.2, gravity: 40, speed: [10, 30] }); } });
        fx.tween({ targets: bird, alpha: 0, delay: 1700, duration: 300, onComplete: () => { ev.remove(); bird.destroy(); } });
        fx.pillar(cx, cy, { tint, h: 100, ms: 900 }); fx.rune(cx, cy, { size: 70, tint, ms: 1200, spin: 90 });
        this.feathers(cx, cy, tint, 8);
        if (dmg) this.buff(sk);
        if (sp) fx.aura(sp, { tint, ms: 2400 });
        break;
      }
      case 'arch_rain': {                                       // ห่าฝนธนูเพลิง: วงยันต์ใหญ่ + ธนูไฟ + ไฟลุกค้าง
        const c = this.center(sk, o);
        fx.rune(c.x, c.y, { size: sk.radius * 2.2, tint, ms: sk.hits * sk.interval + 800, spin: 80 });
        for (let k = 0; k < 5; k++) at(k * 40, () => fx.fly('td_arrow', cx, cy - 20, cx + o.ux * 20 + rand(-10, 10), cy - 180, { speed: 900, tint: 0xffffff, add: false, trail: tint }));
        for (let i = 0; i < sk.hits; i++) at(260 + i * sk.interval, () => {
          for (let k = 0; k < 7; k++) {
            const x = c.x + rand(-sk.radius, sk.radius), y = c.y + rand(-sk.radius, sk.radius) * 0.45;
            at(k * 22, () => fx.fly('td_arrow', x - 40, y - 200, x, y, { speed: 1000, tint: 0xffe0b0, add: false, trail: tint, trailScale: 0.4, onArrive: () => { fx.glow(x, y, { size: 26, tint, ms: 220 }); if (k % 2) fx.flames(x, y, { n: 2, tint, r: 4, h: 18, ms: 500 }); } }));
          }
          S('skRain');
          at(200, () => { fx.shock(c.x, c.y, { r: sk.radius, tint, ms: 300 }); this.mobsNear(c.x, c.y, sk.radius).forEach(H); if (i === sk.hits - 1) fx.shake(200, 0.007); });
        });
        break;
      }
      case 'arch_garuda': {                                     // [ปาร์ตี้] ลมใต้ปีกครุฑ: ปีกทองกางหลังผู้ร่าย → ขนนกพัดไปหาทุกคน
        const T2 = 0xfff0a0;
        const wl = fx.img(cx - 4, cy - 30, 'sk_wing', { tint: T2, depth: cy - 1 }).setOrigin(1, 0.9).setFlipX(true).setScale(0.05, 0.6).setAlpha(0.85);
        const wr = fx.img(cx + 4, cy - 30, 'sk_wing', { tint: T2, depth: cy - 1 }).setOrigin(0, 0.9).setScale(0.05, 0.6).setAlpha(0.85);
        fx.tween({ targets: [wl, wr], scaleX: 0.75, scaleY: 0.75, duration: 420, ease: 'Back.easeOut' });
        fx.tween({ targets: [wl, wr], alpha: 0, delay: 1500, duration: 500, onComplete: () => { wl.destroy(); wr.destroy(); } });
        at(250, () => { fx.flash(180, T2, 0.25); fx.shock(cx, cy, { r: sk.radius * 0.8, tint: T2, ms: 700 }); this.feathers(cx, cy, T2, 14); });
        fx.rune(cx, cy, { size: sk.radius, tint: T2, ms: 1800, spin: -60 });
        this.partyTargets(sk, o).forEach((m, i) => at(450 + i * 90, () => {
          const t = m.spr || m;
          for (let k = 0; k < 4; k++) { const f = fx.img(cx, cy - 30, 'sk_feather', { tint: T2 }).setScale(0.8); fx.tween({ targets: f, x: t.x + rand(-10, 10), y: t.y - 20 + rand(-8, 8), angle: rand(-200, 200), alpha: 0.2, duration: 450 + k * 60, ease: 'Sine.easeInOut', onComplete: () => f.destroy() }); }
          at(420, () => { fx.aura(m, { tint: T2, ms: 3000 }); fx.stars(t.x, t.y - 20, { n: 5, tint: T2, r: 16, size: 14, up: 16 }); });
        }));
        if (dmg) this.buff(sk);
        break;
      }
      default: {                                                // สกิลใหม่ที่ยังไม่มีลายเซ็น → ใช้แบบทั่วไปตามประเภท
        if (sk.type === 'buff' || sk.type === 'party') { fx.pillar(cx, cy, { tint }); fx.rune(cx, cy, { size: 70, tint }); if (dmg) this.buff(sk); }
        else if (sk.type === 'projectile') this.shot(sk, o, { key: 'td_orb', tint, onHit: H });
        else if (sk.type === 'aoe') { const c = this.center(sk, o); fx.explode(c.x, c.y, { r: sk.radius, tint }); this.mobsNear(c.x, c.y, sk.radius).forEach(H); }
        else if (o.t?.alive) { fx.explode(o.t.x, o.t.y, { r: 30, tint }); H(o.t); }
      }
    }
  }

  // ------------------------------------------------------------
  center(sk, o) {
    if (!sk.offset) return { x: o.x, y: o.y };
    if (o.t && Math.hypot(o.t.x - o.x, o.t.y - o.y) < 240) return { x: o.t.x, y: o.t.y };
    return { x: o.x + o.ux * sk.offset, y: o.y + o.uy * sk.offset };
  }

  /** ศัตรูด้านหน้า (เรียงใกล้→ไกล) */
  front(o, range) {
    return this.s.mobs.filter((m) => {
      if (!m.alive || m.visible === false) return false;
      const dx = m.x - o.x, dy = m.y - o.y, d = Math.hypot(dx, dy);
      return d <= range && (d < 10 || (dx * o.ux + dy * o.uy) / d > 0.35);
    }).sort((a, b) => dist(a, o) - dist(b, o));
  }

  /** ยิงกระสุนตามแนว · โดนศัตรูที่อยู่ในแนว (pierce = ทะลุทุกตัว) */
  shot(sk, o, { key, scale = 1, tint, add = true, trail, trailScale, pierce = false, wide = 12, curve = 0, spin = 0, onHit }) {
    const fx = this.fx, sx = o.x + o.ux * 8, sy = o.y - 16 + o.uy * 8;
    let ex = o.x + o.ux * sk.range, ey = o.y + o.uy * sk.range - 14;
    const along = this.s.mobs.filter((m) => m.alive && m.visible !== false).map((m) => {
      const dx = m.x - o.x, dy = m.y - o.y, t = dx * o.ux + dy * o.uy, off = Math.abs(dx * o.uy - dy * o.ux);
      return { m, t, off };
    }).filter((a) => a.t > 0 && a.t <= sk.range && a.off <= wide).sort((a, b) => a.t - b.t);
    const hits = pierce ? along : along.slice(0, 1);
    if (!pierce && hits[0]) { ex = hits[0].m.x; ey = hits[0].m.y - hits[0].m.displayHeight * 0.5; }
    const speed = sk.speed || 300;
    if (curve) {                                                   // โค้งแบบลูกไฟนาคา (จุดควบคุมตั้งฉากแนวยิง)
      const b = fx.img(sx, sy, key, { tint, add }).setScale(scale);
      const tr = this.s.add.particles(0, 0, 'fx_spark', { follow: b, lifespan: 360, scale: { start: trailScale || 0.3, end: 0 }, alpha: { start: 0.9, end: 0 }, tint: trail, frequency: 12, blendMode: 'ADD' }).setDepth(TOP - 1);
      const mx = (sx + ex) / 2 - o.uy * curve, my = (sy + ey) / 2 + o.ux * curve, ms = Math.max(120, (Math.hypot(ex - sx, ey - sy) / speed) * 1000);
      const cvt = { k: 0 };
      this.s.tweens.add({ targets: cvt, k: 1, duration: ms, onUpdate: () => { const k = cvt.k, i = 1 - k; b.setPosition(i * i * sx + 2 * i * k * mx + k * k * ex, i * i * sy + 2 * i * k * my + k * k * ey); },
        onComplete: () => { b.destroy(); tr.stop(); this.s.time.delayedCall(380, () => tr.destroy()); if (hits[0]) onHit?.(hits[0].m, ex, ey + 14); else fx.explode(ex, ey + 14, { r: 18, tint: trail, shake: false }); } });
      return;
    }
    fx.fly(key, sx, sy, ex, ey, { speed, tint, scale, trail, trailScale, add, spin });
    for (const h of hits) this.s.time.delayedCall((h.t / speed) * 1000, () => onHit?.(h.m, h.m.x, h.m.y));
  }

  /** พุ่ง (ขยับตัวละครจริง + ภาพติดตา) */
  dash(sk, o, { tint, leap = false, line = false, onLand, onPath }) {
    const s = this.s, p = o.caster, fx = this.fx;
    let d = sk.distance;
    if (o.t) d = Math.min(d, Math.max(0, dist(o.t, o) - 10));
    const tx = o.x + o.ux * d, ty = o.y + o.uy * d;
    if (!o.local || !p) {                                          // ผู้เล่นอื่น: แค่ภาพ
      if (line) { const b = fx.img((o.x + tx) / 2, (o.y + ty) / 2 - 14, 'fx_glow', { tint }).setRotation(Math.atan2(o.uy, o.ux)).setDisplaySize(d + 20, 8); fx.tween({ targets: b, alpha: 0, duration: 400, onComplete: () => b.destroy() }); }
      if (leap) s.time.delayedCall(260, () => onLand?.(tx, ty));
      return;
    }
    const hitSet = new Set(), dur = leap ? 300 : 180;
    p.invulnUntil = s.time.now + dur + 150; p.st = 'attack'; p.dashing = true;
    const from = { x: p.x, y: p.y }, st = { k: 0 };
    let lastSend = 0;
    if (line) { const b = fx.img((from.x + tx) / 2, (from.y + ty) / 2 - 14, 'fx_glow', { tint }).setRotation(Math.atan2(o.uy, o.ux)).setDisplaySize(d + 30, 10); fx.tween({ targets: b, displayHeight: 2, alpha: 0, duration: 420, onComplete: () => b.destroy() }); }
    s.tweens.add({ targets: st, k: 1, duration: dur, ease: leap ? 'Sine.easeInOut' : 'Cubic.easeOut',
      onUpdate: () => {
        const nx = from.x + (tx - from.x) * st.k, ny = from.y + (ty - from.y) * st.k;
        if (this.solidAt(nx, ny - 2)) return;
        p.setPosition(nx, ny);
        if (leap) { const k = 1 + Math.sin(st.k * Math.PI) * 0.35; p.setScale(p._d8 ? (s.d8meta?.[p.d8id]?.scale || 2 / 3) * k : k); }
        if (s.time.now - lastSend > 30) { lastSend = s.time.now; fx.afterimage(p, tint); if (s.econ.server) s.net.send('td:move', { x: Math.round(p.x), y: Math.round(p.y), dir: p.dir, anim: 'walk' }); }
        if (onPath) for (const m of this.mobsNear(p.x, p.y, 22)) if (!hitSet.has(m)) { hitSet.add(m); onPath(m); fx.slash(m.x, m.y - 14, Math.atan2(o.uy, o.ux), { size: 1, tint }); }
      },
      onComplete: () => { p.dashing = false; if (leap) p.setScale(p._d8 ? (s.d8meta?.[p.d8id]?.scale || 2 / 3) : (p.baseScale || 1)); p.st = 'idle'; if (s.econ.server) s.net.send('td:move', { x: Math.round(p.x), y: Math.round(p.y), dir: p.dir, anim: 'idle' }); onLand?.(p.x, p.y); if (!leap) fx.shock(p.x, p.y, { r: 30, tint }); } });
  }

  /** ตัวละครที่โดนสกิลปาร์ตี้ (ตัวเรา/ผู้ร่าย + เพื่อนร่วมปาร์ตี้ในรัศมี) — ใช้แสดงภาพ */
  partyTargets(sk, o) {
    const s = this.s, R = (sk.radius || 220) + 40, out = [];
    const caster = o.caster?.spr || o.caster || { x: o.x, y: o.y };
    out.push(o.caster || { x: o.x, y: o.y });
    const ids = new Set((s.social?.party?.members || []).map((m) => m.id));
    const casterId = o.local ? s.net?.selfId : o.caster?.id;
    if (!ids.has(casterId)) return out;                          // ไม่ได้อยู่ในปาร์ตี้ → โดนแค่ตัวเอง
    if (!o.local && ids.has(s.net?.selfId) && Math.hypot(s.player.x - caster.x, s.player.y - caster.y) <= R) out.push(s.player);
    s.remotes?.forEach((r, id) => { if (id !== casterId && ids.has(id) && Math.hypot(r.x - caster.x, r.y - caster.y) <= R) out.push(r); });
    return out;
  }

  healAmt(m, sk) {
    if (!sk.heal) return 0;
    const max = m === this.s.player ? this.s.player.derived?.maxHp : m.maxHp;
    return max ? Math.round(max * sk.heal) : 0;
  }

  /** ดาวมึนวนเหนือหัวศัตรู */
  dizzy(m, ms = 1000) {
    const s = this.s, dots = [0, 1, 2].map(() => this.fx.img(m.x, m.y, 'sk_star4', { tint: 0xffe08a, depth: TOP + 2 }).setDisplaySize(9, 9));
    let a = 0; const ev = s.time.addEvent({ delay: 16, loop: true, callback: () => { a += 0.14; dots.forEach((d, i) => { const k = a + i * 2.09; d.setPosition(m.x + Math.cos(k) * 10, m.y - (m.displayHeight || 30) - 2 + Math.sin(k) * 3); }); } });
    s.time.delayedCall(ms, () => { ev.remove(); dots.forEach((d) => d.destroy()); });
  }

  /** ขนนกปลิวออกรอบตัว */
  feathers(x, y, tint, n = 8) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, f = this.fx.img(x, y - 20, 'sk_feather', { tint }).setScale(0.7).setRotation(a);
      this.fx.tween({ targets: f, x: x + Math.cos(a) * rand(40, 70), y: y - 20 + Math.sin(a) * rand(18, 30) - 10, angle: f.angle + rand(-160, 160), alpha: 0, duration: rand(700, 1000), ease: 'Sine.easeOut', onComplete: () => f.destroy() });
    }
  }

  /** เพื่อนร่วมปาร์ตี้ร่ายสกิลปาร์ตี้ใส่เรา (server แจ้งมา) → บัฟ + ฮีล + ภาพบนตัว */
  partyReceive({ from, skillId, lv }) {
    const base = SKILL_BY_ID[skillId]; if (!base) return;
    const sk = skillStats(base, lv), s = this.s, p = s.player, tint = TINT[sk.id] || 0xffffff;
    p.buffs = (p.buffs || []).filter((b) => b.until > s.time.now && b.sk !== sk.id);
    if (sk.type === 'revive') p.buffs.push({ buff: { undying: true }, until: s.time.now + sk.undying, sk: sk.id, icon: sk.icon, name: `ขวัญกันตาย (${from})` });
    else p.buffs.push({ buff: sk.buff, until: s.time.now + sk.duration, sk: sk.id, icon: sk.icon, name: `${sk.nameTh} (${from})` });
    if (sk.mpHeal) { const d = p.derived; p.char.mp = Math.min(d.maxMp, p.char.mp + Math.round(d.maxMp * sk.mpHeal)); }
    s.ui.toast?.(`${sk.icon} ${from} ใช้ ${sk.nameTh} ให้คุณ!`, 'ok', 1800);
    this.snd('skRise');
    s.ui.hudCache = '';
  }

  poison(x, y, tint) {
    for (let i = 0; i < 8; i++) {
      const c = this.fx.img(x + rand(-10, 10), y + rand(-4, 4), 'fx_glow', { tint, alpha: 0.55, depth: y + 3 }).setDisplaySize(8, 6);
      this.fx.tween({ targets: c, displayWidth: rand(28, 40), displayHeight: rand(16, 22), y: c.y - rand(6, 18), alpha: 0, duration: rand(900, 1500), delay: i * 60, ease: 'Sine.easeOut', onComplete: () => c.destroy() });
    }
    this.fx.sparks(x, y - 8, { n: 10, tint, speed: [20, 70], life: 800, scale: 0.25, gravity: -30 });
  }

  /** ประกายวนรอบตัว (ระยะบัฟ) */
  orbit(spr, tint, n, ms) {
    const s = this.s, dots = Array.from({ length: n }, () => this.fx.img(spr.x, spr.y, 'fx_spark', { tint }).setScale(0.3));
    let a = 0;
    const ev = s.time.addEvent({ delay: 16, loop: true, callback: () => { a += 0.08; dots.forEach((d, i) => { const k = a + (i / n) * Math.PI * 2; d.setPosition(spr.x + Math.cos(k) * 16, spr.y - 14 + Math.sin(k) * 6).setDepth(Math.sin(k) > 0 ? spr.depth + 1 : spr.depth - 1); }); } });
    s.time.delayedCall(ms, () => { ev.remove(); dots.forEach((d) => this.fx.tween({ targets: d, alpha: 0, scale: 0, duration: 250, onComplete: () => d.destroy() })); });
  }

  buff(sk) {
    const s = this.s, p = s.player;
    this.snd('skRise');
    p.buffs = (p.buffs || []).filter((b) => b.until > s.time.now && b.sk !== sk.id);
    p.buffs.push({ buff: sk.buff, until: s.time.now + sk.duration, sk: sk.id, icon: sk.icon, name: sk.nameTh });
    if (sk.mpHeal) { const d = p.derived; p.char.mp = Math.min(d.maxMp, p.char.mp + Math.round(d.maxMp * sk.mpHeal)); }
    if (sk.heal && !s.econ.server) {
      const d = p.derived, heal = Math.round(d.maxHp * sk.heal);
      p.char.hp = Math.min(d.maxHp, p.char.hp + heal);
      if (sk.type !== 'party') popupNumber(s, p.x, p.y - 40, `+${heal}`, 'heal');   // สกิลปาร์ตี้แสดงตัวเลขเองใน healOn
    }
    s.ui.toast?.(`${sk.nameTh}!`, '', 1400);
  }
}

function dirVec(dir) {
  const m = { east: [1, 0], 'south-east': [1, 1], south: [0, 1], 'south-west': [-1, 1], west: [-1, 0], 'north-west': [-1, -1], north: [0, -1], 'north-east': [1, -1] }[dir] || [0, 1];
  return { x: m[0], y: m[1] };
}
