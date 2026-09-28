// ============================================================
//  หมอยา – เป้าหมาย + เอฟเฟกต์ 6 สกิล (ฝั่ง client)
//  ▸ เลือกเพื่อน/ห่วงโซ่/จุดตกที่นี่ แล้วส่งไปกับ skill:cast (server ตรวจระยะแล้วรักษาจริง)
//  ▸ ภาพสายใย/เมล็ด/ตัวเลขรักษา มาจาก server (td:tether · td:seed · td:heal) ให้ทุกคนเห็นเหมือนกัน
//  ▸ ออฟไลน์: รักษาตัวเองในเครื่อง
// ============================================================
import { popupNumber } from '../gfx/Fx.js';

const TOP = 99985;
const ADD = () => Phaser.BlendModes.ADD;
const rand = (a, b) => a + Math.random() * (b - a);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const HEAL_TINT = { heal_vine: 0x6dffa8, heal_pill: 0x9dff6a, heal_seed: 0xffb3d9, heal_tiger: 0xffa040, heal_khwan: 0xffe27a, heal_mortar: 0x7dffb0 };
const GREEN = 0x6dffa8, GOLD = 0xffd35c, PINK = 0xffb3d9;

/** texture เฉพาะหมอยา */
export function bakeHealerFx(scene) {
  const mk = (key, w, h, draw) => { if (scene.textures.exists(key)) return; const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); scene.textures.addCanvas(key, c); };
  mk('hl_leaf', 14, 8, (g) => { const r = g.createLinearGradient(0, 0, 14, 0); r.addColorStop(0, '#2e8b57'); r.addColorStop(1, '#9dff6a'); g.fillStyle = r; g.beginPath(); g.moveTo(0, 4); g.quadraticCurveTo(7, -3, 14, 4); g.quadraticCurveTo(7, 11, 0, 4); g.fill(); g.strokeStyle = 'rgba(20,70,30,.8)'; g.lineWidth = 1; g.beginPath(); g.moveTo(1, 4); g.lineTo(13, 4); g.stroke(); });
  mk('hl_pill', 12, 12, (g) => { const r = g.createRadialGradient(4, 4, 0, 6, 6, 6); r.addColorStop(0, '#fffbe0'); r.addColorStop(0.35, '#b8e86a'); r.addColorStop(0.8, '#4a8a2a'); r.addColorStop(1, 'rgba(40,80,20,0)'); g.fillStyle = r; g.beginPath(); g.arc(6, 6, 6, 0, Math.PI * 2); g.fill(); g.fillStyle = '#ffd35c'; g.fillRect(3, 5, 1, 1); g.fillRect(8, 7, 1, 1); });
  mk('hl_seed', 10, 12, (g) => { g.fillStyle = '#8b5a2b'; g.beginPath(); g.ellipse(5, 7, 4, 5, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#c68642'; g.beginPath(); g.ellipse(4, 6, 1.6, 3, -0.3, 0, Math.PI * 2); g.fill(); g.fillStyle = '#6dff8e'; g.fillRect(5, 0, 1, 3); });
  mk('hl_sprout', 24, 28, (g) => {
    g.strokeStyle = '#3cb043'; g.lineWidth = 2; g.beginPath(); g.moveTo(12, 28); g.quadraticCurveTo(10, 16, 12, 8); g.stroke();
    const leaf = (x, y, a, s) => { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = '#6dde6d'; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(s * 0.5, -s * 0.45, s, 0); g.quadraticCurveTo(s * 0.5, s * 0.45, 0, 0); g.fill(); g.restore(); };
    leaf(12, 18, -2.6, 9); leaf(12, 14, -0.4, 10); leaf(12, 9, -2.2, 7);
    g.fillStyle = '#ff9ccf'; g.beginPath(); g.arc(12, 6, 4, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff0f6'; g.beginPath(); g.arc(12, 6, 1.6, 0, Math.PI * 2); g.fill();
  });
  mk('hl_mortar', 44, 30, (g) => {
    const r = g.createLinearGradient(0, 0, 0, 30); r.addColorStop(0, '#9a9a90'); r.addColorStop(1, '#55554c'); g.fillStyle = r;
    g.beginPath(); g.moveTo(3, 8); g.lineTo(41, 8); g.quadraticCurveTo(38, 26, 30, 28); g.lineTo(14, 28); g.quadraticCurveTo(6, 26, 3, 8); g.fill();
    g.fillStyle = '#6b6b62'; g.beginPath(); g.ellipse(22, 8, 19, 5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2f7d3a'; g.beginPath(); g.ellipse(22, 8, 15, 3.2, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#7dffb0'; for (let i = 0; i < 6; i++) g.fillRect(12 + i * 4, 7 + (i % 2), 2, 1);
  });
  mk('hl_pestle', 12, 40, (g) => { const r = g.createLinearGradient(0, 0, 12, 0); r.addColorStop(0, '#6b4a2a'); r.addColorStop(0.5, '#a0784a'); r.addColorStop(1, '#5a3a1a'); g.fillStyle = r; g.fillRect(4, 0, 5, 30); g.beginPath(); g.ellipse(6.5, 33, 6, 7, 0, 0, Math.PI * 2); g.fill(); });
  mk('hl_pot', 40, 32, (g) => {
    g.fillStyle = '#3a2a1e'; g.beginPath(); g.ellipse(20, 20, 17, 12, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#c9a14a'; g.fillRect(4, 13, 32, 2); g.fillRect(6, 24, 28, 1);
    g.fillStyle = '#5a3e2a'; g.beginPath(); g.ellipse(20, 10, 14, 4, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ff9a3c'; g.beginPath(); g.ellipse(20, 10, 11, 2.6, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#c9a14a'; g.fillRect(1, 12, 4, 3); g.fillRect(35, 12, 4, 3);
  });
  mk('hl_baisri', 48, 64, (g) => {                                       // บายศรีใบตอง 5 ชั้น + มาลัยยอด
    const tier = (y, w, h) => { const r = g.createLinearGradient(0, y, 0, y + h); r.addColorStop(0, '#6fce6f'); r.addColorStop(1, '#2e7d32'); g.fillStyle = r; g.beginPath(); g.moveTo(24 - w / 2, y + h); g.lineTo(24 + w / 2, y + h); g.lineTo(24 + w / 2 - 3, y); g.lineTo(24 - w / 2 + 3, y); g.fill(); g.fillStyle = '#fff6d0'; g.fillRect(24 - w / 2 + 2, y + h - 2, w - 4, 1); };
    tier(50, 40, 12); tier(40, 32, 10); tier(31, 25, 9); tier(23, 18, 8); tier(16, 12, 7);
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(24, 12, 4, 5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffd35c'; g.fillRect(23, 2, 2, 7); g.beginPath(); g.arc(24, 2, 2, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ff6fa5'; for (let i = 0; i < 5; i++) g.fillRect(8 + i * 8, 57, 3, 3);
  });
  mk('hl_candle', 6, 16, (g) => { g.fillStyle = '#fff3c4'; g.fillRect(1, 5, 4, 11); g.fillStyle = '#ffb347'; g.beginPath(); g.ellipse(3, 3, 2, 3, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.fillRect(2, 2, 2, 2); });
  mk('hl_tiger', 64, 40, (g) => {                                        // วิญญาณเสือไฟกระโจน (เงาเรียบ ๆ ส่องแสง)
    g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(4, 30); g.quadraticCurveTo(14, 16, 30, 16); g.quadraticCurveTo(42, 8, 52, 10); g.lineTo(60, 6); g.lineTo(58, 14); g.quadraticCurveTo(62, 18, 56, 22);
    g.quadraticCurveTo(48, 22, 46, 26); g.lineTo(52, 38); g.lineTo(46, 38); g.lineTo(38, 28); g.quadraticCurveTo(28, 30, 22, 28); g.lineTo(16, 38); g.lineTo(10, 38); g.lineTo(14, 28); g.quadraticCurveTo(8, 30, 4, 30); g.fill();
    g.fillStyle = 'rgba(0,0,0,.35)'; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(20 + i * 6, 18); g.lineTo(23 + i * 6, 25); g.lineTo(21 + i * 6, 25); g.fill(); }
  });
}

export class HealerKit {
  constructor(sys) { this.sys = sys; this.s = sys.s; this.fx = sys.fx; this.vines = new Map(); this.sprouts = new Map(); bakeHealerFx(this.s); }

  // ---------------- เพื่อน ----------------
  /** ตัวละครตาม id (ตัวเรา/ผู้เล่นอื่น) */
  sprOf(id) { const s = this.s; if (!id || id === s.net?.selfId || id === 'me') return s.player; const r = s.remotes?.get(id); return r ? r.spr || r : null; }
  /** ตัวเรา + ปาร์ตี้ในแมพนี้ → [{ id, spr, hp, maxHp, dead }] */
  allies() {
    const s = this.s, p = s.player, me = s.net?.selfId || 'me';
    const out = [{ id: me, spr: p, hp: p.char.hp, maxHp: p.derived?.maxHp || p.char.hp || 1, dead: !p.alive }];
    const ids = new Set((s.social?.party?.members || []).map((m) => m.id));
    if (ids.has(me)) s.remotes?.forEach((r, id) => { const sp = r.spr || r; if (ids.has(id) && sp.visible !== false) out.push({ id, spr: sp, hp: r.hp ?? 1, maxHp: r.maxHp || 1, dead: r.anim === 'die' || r.hp <= 0 }); });
    return out;
  }
  lowest(range) {
    const p = this.s.player;
    const list = this.allies().filter((a) => !a.dead && dist(a.spr, p) <= range);
    list.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || (a.spr === p) - (b.spr === p));
    return list[0] || this.allies()[0];
  }
  /** ต้องรักษาไหม (ใช้ตอน Auto Skill) */
  needHeal(pct = 0.7, range = 240) { const p = this.s.player; return this.allies().some((a) => !a.dead && dist(a.spr, p) <= range && a.hp / a.maxHp < pct); }
  anyDead(range = 240) { const p = this.s.player; return this.allies().some((a) => a.dead && dist(a.spr, p) <= range); }

  /** เตรียมเป้าก่อนส่ง server → ข้อมูลเพิ่มใน skill:cast + ใช้วาดภาพ */
  prep(sk, aim) {
    const s = this.s, p = s.player, sys = this.sys;
    if (sk.type === 'tether' || sk.type === 'seed') { const a = this.lowest(sk.range); return { allies: [a.id], ally: a.spr }; }
    if (sk.type === 'bounce') {
      const chain = [], used = new Map();
      const al = this.allies().filter((a) => !a.dead), mobs = s.mobs.filter((m) => m.alive && m.visible !== false);
      let at = { x: p.x, y: p.y }, want = al.some((a) => a.spr !== p && dist(a.spr, p) <= sk.range) ? 'ally' : 'mob', last = p;
      for (let i = 0; i < sk.bounces; i++) {
        const R = i ? sk.hop : sk.range;
        const pickA = () => al.filter((a) => a.spr !== last && dist(a.spr, at) <= R && (used.get(a.spr) || 0) < 2).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        const pickM = () => mobs.filter((m) => m !== last && dist(m, at) <= R).sort((a, b) => (used.get(a) || 0) - (used.get(b) || 0) || dist(a, at) - dist(b, at))[0];
        let a = want === 'ally' ? pickA() : null, m = want === 'mob' ? pickM() : null;
        if (!a && !m) { a = want === 'mob' ? pickA() : null; m = want === 'ally' ? pickM() : null; }
        if (!a && !m) break;
        const node = a ? { ally: a, spr: a.spr, id: a.id } : { mob: m, spr: m };
        chain.push(node); used.set(node.spr, (used.get(node.spr) || 0) + 1);
        at = { x: node.spr.x, y: node.spr.y }; last = node.spr; want = a ? 'mob' : 'ally';
      }
      return { allies: chain.filter((c) => c.ally).map((c) => c.id), chain };
    }
    if (sk.type === 'mortar') {
      const c = sys.center(sk, { x: p.x, y: p.y, ux: aim.ux, uy: aim.uy, t: aim.t });
      return { tx: Math.round(c.x), ty: Math.round(c.y), n: Math.min(5, sys.mobsNear(c.x, c.y, sk.radius).length), c };
    }
    return {};
  }

  /** รักษาในเครื่อง (ออฟไลน์) */
  localHeal(amt, fx = 'heal') {
    const s = this.s, p = s.player;
    if (s.econ.server || !p.alive) return;
    const max = p.derived?.maxHp || p.char.hp; amt = Math.round(amt);
    p.char.hp = Math.min(max, p.char.hp + amt); s.ui.hudCache = '';
    this.healFx({ id: 'me', amt, fx });
  }
  matk() { return this.s.player.derived?.matk || 10; }

  // ---------------- เหตุการณ์จาก server ----------------
  healFx({ id, amt, fx, over }) {
    const o = this.sprOf(id); if (!o || o.visible === false) return;
    const s = this.s, F = this.fx, h = o.displayHeight || 40;
    if (!over || fx === 'revive') popupNumber(s, o.x, o.y - h - 12, `+${amt}`, 'heal');
    if (fx === 'vine') { F.sparks(o.x, o.y - h * 0.5, { n: 3, tint: GREEN, speed: [15, 45], life: 500, scale: 0.2, gravity: -40 }); return; }
    if (fx === 'pill') { F.glow(o.x, o.y - h * 0.5, { size: 40, tint: 0x9dff6a, ms: 320 }); this.leaves(o.x, o.y - h * 0.5, 6, 30); return; }
    if (fx === 'bloom' || fx === 'bloomNow') {
      this.clearSprout(id, true);
      F.pillar(o.x, o.y, { tint: PINK, h: 120, ms: 900, w: 34 }); F.glow(o.x, o.y - h - 8, { size: 90, tint: 0xffffff, ms: 420 });
      const fl = F.img(o.x, o.y - h - 6, 'sk_lotus', { add: false, depth: TOP + 1 }).setOrigin(0.5, 0.8).setScale(0.1);
      F.tween({ targets: fl, scale: 0.7, duration: 360, ease: 'Back.easeOut' });
      F.tween({ targets: fl, alpha: 0, y: fl.y - 18, delay: 700, duration: 450, onComplete: () => fl.destroy() });
      F.petals(o.x, o.y, { n: 14, tint: 0xffc6e0, r: 34, fall: false, ms: 1300 }); F.stars(o.x, o.y - h, { n: 8, tint: GOLD, r: 26, size: 14, up: 24 });
      if (fx === 'bloomNow') F.shock(o.x, o.y, { r: 40, tint: 0xff5a7a, ms: 380 });
      this.sys.snd('skRise'); return;
    }
    if (fx === 'khwan' || fx === 'revive') {
      F.pillar(o.x, o.y, { tint: GOLD, h: 170, ms: 1300, w: 40 }); F.stars(o.x, o.y - 20, { n: 10, tint: GOLD, r: 22, size: 16, up: 40 });
      F.aura(o, { tint: GOLD, ms: 2800 });
      if (fx === 'revive') { popupNumber(s, o.x, o.y - h - 34, 'ฟื้นคืนชีพ!', 'crit'); F.flash(200, GOLD, 0.25); F.shock(o.x, o.y, { r: 60, tint: GOLD, ms: 600 }); }
      return;
    }
    if (fx === 'mortar') { F.aura(o, { tint: GREEN, ms: 1600, motes: 'hl_leaf' }); F.stars(o.x, o.y - 18, { n: 5, tint: GREEN, r: 16, size: 12, up: 18 }); return; }
    F.pillar(o.x, o.y, { tint: GREEN, h: 70, ms: 600, w: 22, alpha: 0.7 });
  }

  /** สายใยสมุนไพร: เถาเขียวโค้งจากมือหมอยาไปหาเพื่อน + หยดยาไหลตามเถา */
  tetherFx({ id, tid, ms, off, snap }) {
    const old = this.vines.get(id);
    if (off) { if (old) { old.stop(snap); this.vines.delete(id); } return; }
    old?.stop(false);
    const a = this.sprOf(id), b = this.sprOf(tid), s = this.s, F = this.fx;
    if (!a || !b) return;
    const g = s.add.graphics().setDepth(TOP - 3), gl = s.add.graphics().setDepth(TOP - 4).setBlendMode(ADD());
    const leaves = [0, 1, 2, 3, 4].map(() => F.img(0, 0, 'hl_leaf', { add: false, depth: TOP - 2 }).setScale(0.8));
    const flowers = [0, 1].map(() => F.img(0, 0, 'sk_star4', { tint: PINK, depth: TOP - 2 }).setDisplaySize(9, 9));
    const drops = [0, 1, 2].map(() => F.img(0, 0, 'fx_glow', { tint: GREEN, depth: TOP - 1 }).setDisplaySize(9, 9));
    const t0 = s.time.now, end = t0 + (ms || 6000);
    const pt = (k, P0, P1, C, w) => { const i = 1 - k; return { x: i * i * P0.x + 2 * i * k * C.x + k * k * P1.x, y: i * i * P0.y + 2 * i * k * C.y + k * k * P1.y + Math.sin(k * 12 + w) * 2 }; };
    const draw = () => {
      if (!a.active || !b.active || s.time.now > end + 500) return stop(false);
      const P0 = { x: a.x + 6, y: a.y - (a.displayHeight || 40) * 0.55 }, P1 = { x: b.x, y: b.y - (b.displayHeight || 40) * 0.5 };
      const d = dist(P0, P1), near = d < 100, C = { x: (P0.x + P1.x) / 2, y: (P0.y + P1.y) / 2 - 18 - d * 0.08 }, w = s.time.now / 160;
      g.clear(); gl.clear();
      const far = d > 200, col = far ? 0xd4c34a : 0x3cb043, colL = far ? 0xfff08a : 0x9dff6a;
      for (const [off, lw, c] of [[0, near ? 3 : 2, col], [Math.PI, 1.5, colL]]) {
        g.lineStyle(lw, c, 1); g.beginPath();
        for (let k = 0; k <= 1.001; k += 0.05) { const q = pt(k, P0, P1, C, w + off); k ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y); }
        g.strokePath();
      }
      gl.lineStyle(near ? 8 : 5, GREEN, near ? 0.28 : 0.16); gl.beginPath();
      for (let k = 0; k <= 1.001; k += 0.1) { const q = pt(k, P0, P1, C, w); k ? gl.lineTo(q.x, q.y) : gl.moveTo(q.x, q.y); }
      gl.strokePath();
      leaves.forEach((l, i) => { const k = (i + 0.5) / leaves.length, q = pt(k, P0, P1, C, w); l.setPosition(q.x, q.y).setRotation(Math.sin(w + i) * 0.8 + (i % 2 ? 0.6 : -0.6)).setVisible(!far || i % 2 === 0); });
      flowers.forEach((f, i) => { const q = pt(0.33 + i * 0.34, P0, P1, C, w); f.setPosition(q.x, q.y - 2).setVisible(near); });
      drops.forEach((dr, i) => { const k = ((s.time.now - t0) / 700 + i / drops.length) % 1, q = pt(k, P0, P1, C, w); dr.setPosition(q.x, q.y); });
    };
    const ev = s.time.addEvent({ delay: 16, loop: true, callback: draw });
    const stop = (snapped) => {
      ev.remove(); g.destroy(); gl.destroy(); [...leaves, ...flowers, ...drops].forEach((o) => o.destroy());
      if (snapped && b.active) { this.leaves(b.x, b.y - 20, 8, 30); F.sparks(b.x, b.y - 20, { n: 8, tint: 0xfff08a, speed: [30, 90], life: 400, scale: 0.22 }); }
      this.vines.delete(id);
    };
    const ring = F.img(b.x, b.y, 'sk_rune', { tint: GREEN, depth: 0.96, alpha: 0.7 }).setDisplaySize(34, 12);
    s.time.addEvent({ delay: 16, repeat: Math.ceil((ms || 6000) / 16), callback: () => ring.active && ring.setPosition(b.x, b.y).setAngle(ring.angle + 2) });
    s.time.delayedCall(ms || 6000, () => ring.destroy());
    this.vines.set(id, { stop: (sn) => { if (ring.active) ring.destroy(); stop(sn); } });
  }

  /** เมล็ดพันธุ์ชีวา: ต้นอ่อนงอกจากพื้นใต้เท้า โตขึ้นเรื่อย ๆ + วงทองนับเวลา */
  seedFx({ id, ms }) {
    const o = this.sprOf(id); if (!o) return;
    this.clearSprout(id);
    const s = this.s, F = this.fx, t0 = s.time.now;
    const sp = F.img(o.x, o.y, 'hl_sprout', { add: false, depth: o.y + 1 }).setOrigin(0.5, 1).setScale(0.15);
    const root = F.img(o.x, o.y, 'fx_glow', { tint: GREEN, depth: 0.96, alpha: 0.5 }).setDisplaySize(40, 12);
    const g = s.add.graphics().setDepth(0.97);
    F.tween({ targets: sp, scale: 0.9, duration: ms || 4000, ease: 'Sine.easeIn' });
    const ev = s.time.addEvent({ delay: 16, loop: true, callback: () => {
      if (!o.active) return;
      const k = Math.min(1, (s.time.now - t0) / (ms || 4000));
      sp.setPosition(o.x + 12, o.y + 2).setDepth(o.y + 1); root.setPosition(o.x, o.y).setAlpha(0.35 + Math.sin(s.time.now / 150) * 0.15);
      g.clear(); g.lineStyle(2, GOLD, 0.9); g.beginPath(); g.arc(o.x, o.y, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); g.strokePath();
    } });
    const kill = () => { ev.remove(); sp.destroy(); root.destroy(); g.destroy(); };
    this.sprouts.set(id, { kill, at: s.time.now + (ms || 4000) });
    s.time.delayedCall((ms || 4000) + 1500, () => { if (this.sprouts.get(id)?.kill === kill) this.clearSprout(id); });
  }
  clearSprout(id, burst = false) { const sp = this.sprouts.get(id); if (sp) { sp.kill(); this.sprouts.delete(id); } }

  leaves(x, y, n = 8, r = 40) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, l = this.fx.img(x, y, 'hl_leaf', { add: false, depth: TOP }).setScale(rand(0.6, 1)).setRotation(a);
      this.fx.tween({ targets: l, x: x + Math.cos(a) * rand(r * 0.4, r), y: y + Math.sin(a) * rand(r * 0.2, r * 0.5) - 8, angle: l.angle + rand(-200, 200), alpha: 0, duration: rand(500, 900), ease: 'Sine.easeOut', onComplete: () => l.destroy() });
    }
  }

  // ---------------- ภาพตอนร่าย ----------------
  play(sk, o) {
    const s = this.s, F = this.fx, sys = this.sys, local = o.local, at = (ms, f) => s.time.delayedCall(ms, f);
    const cx = o.x, cy = o.y, tint = HEAL_TINT[sk.id] || GREEN;
    const hand = { x: cx + o.ux * 8, y: cy - 22 };
    switch (sk.id) {
      case 'heal_vine': {
        F.rune(cx, cy, { size: 46, tint, ms: 700, spin: 120, inner: false });
        this.leaves(hand.x, hand.y, 6, 26);
        if (local && !s.econ.server) {                     // ออฟไลน์: ผูกตัวเอง
          this.tetherFx({ id: 'me', tid: 'me', ms: sk.duration });
          const per = this.matk() * sk.hmult * sk.nearMul;
          for (let t = sk.tick; t <= sk.duration; t += sk.tick) at(t, () => this.localHeal(per, 'vine'));
        }
        break;
      }
      case 'heal_pill': {
        const chain = o.prep?.chain;
        if (!chain?.length) {                              // ผู้เล่นอื่น/ไม่มีเป้า: ปาลูกเดียวตามทิศ
          const t = o.t || { x: cx + o.ux * 120, y: cy + o.uy * 120 };
          F.fly('hl_pill', hand.x, hand.y, t.x, t.y - 16, { speed: 520, add: false, trail: 0x9dff6a, trailScale: 0.3, spin: 360, onArrive: () => { F.glow(t.x, t.y - 16, { size: 44, tint, ms: 300 }); this.leaves(t.x, t.y - 16, 5, 24); } });
          break;
        }
        let from = hand;
        chain.forEach((n, i) => at(i * 220, () => {
          const tgt = n.spr; if (!tgt?.active) return;
          const to = { x: tgt.x, y: tgt.y - (tgt.displayHeight || 30) * 0.5 };
          const f0 = from; from = to;
          // เส้นทางลม + ลูกกลอนหมุน
          const g = s.add.graphics().setDepth(TOP - 1).setBlendMode(ADD()); g.lineStyle(1.5, 0xc8ffd0, 0.5); g.beginPath();
          const mx = (f0.x + to.x) / 2, my = Math.min(f0.y, to.y) - 30;
          for (let k = 0; k <= 1.001; k += 0.1) { const q = { x: (1 - k) * (1 - k) * f0.x + 2 * (1 - k) * k * mx + k * k * to.x, y: (1 - k) * (1 - k) * f0.y + 2 * (1 - k) * k * my + k * k * to.y }; k ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y); }
          g.strokePath(); F.tween({ targets: g, alpha: 0, duration: 420, onComplete: () => g.destroy() });
          const b = F.img(f0.x, f0.y, 'hl_pill', { add: false, depth: TOP }).setScale(1.3);
          const tr = s.add.particles(0, 0, 'hl_leaf', { follow: b, lifespan: 380, scale: { start: 0.6, end: 0 }, alpha: { start: 0.9, end: 0 }, frequency: 40, rotate: { min: 0, max: 360 } }).setDepth(TOP - 1);
          const cv = { k: 0 };
          F.tween({ targets: cv, k: 1, duration: 200, onUpdate: () => { const k = cv.k, i2 = 1 - k; b.setPosition(i2 * i2 * f0.x + 2 * i2 * k * mx + k * k * to.x, i2 * i2 * f0.y + 2 * i2 * k * my + k * k * to.y).setAngle(k * 540); },
            onComplete: () => {
              b.destroy(); tr.stop(); at(400, () => tr.destroy());
              const num = s.add.text(to.x + 10, to.y - 16, String(i + 1), { fontFamily: 'sans-serif', fontSize: '11px', fontStyle: '700', color: '#fff', backgroundColor: n.mob ? '#b8542a' : '#2e8b57', padding: { x: 3, y: 1 } }).setOrigin(0.5).setDepth(TOP + 2);
              F.tween({ targets: num, alpha: 0, y: num.y - 10, delay: 500, duration: 300, onComplete: () => num.destroy() });
              if (n.mob) { if (local) sys.hit(n.mob, sk, 0xc8a060); F.smoke(to.x, to.y + 12, { n: 4, tint: 0x8a7a4a, r: 12 }); F.sparks(to.x, to.y, { n: 8, tint: 0xd8c070, speed: [40, 110], life: 380, scale: 0.25 }); }
              else { F.glow(to.x, to.y, { size: 42, tint: 0x9dff6a, ms: 300 }); F.petals(to.x, to.y + 10, { n: 5, tint: 0xffc6e0, r: 12, fall: false, ms: 900 }); if (local && !s.econ.server && n.spr === s.player) this.localHeal(this.matk() * sk.hmult, 'pill'); }
              if (i === chain.length - 1 && chain.length >= 5) { F.explode(to.x, to.y + 10, { r: 30, tint: 0x9dff6a, shake: false }); popupNumber(s, to.x, to.y - 30, 'ครบห้าทิศ!', 'exp'); }
            } });
        }));
        break;
      }
      case 'heal_seed': {
        const t = o.prep?.ally || o.t || s.player;
        F.fly('hl_seed', hand.x, hand.y, t.x, t.y - 4, { speed: 380, add: false, trail: GOLD, trailScale: 0.25, spin: 540, onArrive: () => { F.glow(t.x, t.y, { size: 36, tint: GOLD, ms: 300 }); F.shock(t.x, t.y, { r: 18, tint: GREEN, ms: 360 }); } });
        if (local && !s.econ.server) { this.seedFx({ id: 'me', ms: sk.delay }); at(sk.delay, () => this.localHeal(this.matk() * sk.hmult, 'bloom')); }
        break;
      }
      case 'heal_tiger': {
        const pot = F.img(cx, cy + 2, 'hl_pot', { add: false, depth: cy + 3 }).setOrigin(0.5, 1).setScale(0.1);
        F.tween({ targets: pot, scale: 1, duration: 260, ease: 'Back.easeOut' });
        F.flames(cx, cy + 2, { n: 6, tint: 0xff7a2a, r: 12, h: 16, ms: 900 });
        for (let k = 0; k < 6; k++) at(k * 90, () => { const st = F.img(cx + rand(-8, 8), cy - 22, 'fx_glow', { tint: 0xffd9a0, alpha: 0.5 }).setDisplaySize(12, 12); F.tween({ targets: st, y: st.y - 40, displayWidth: 34, displayHeight: 26, alpha: 0, duration: 800, onComplete: () => st.destroy() }); });
        at(420, () => {                                     // วิญญาณเสือไฟกระโจนออกจากหม้อ
          sys.snd('skSlam'); F.flash(160, 0xffa040, 0.25);
          const tg = F.img(cx, cy - 30, 'hl_tiger', { tint: 0xffa040 }).setScale(0.3).setAlpha(0.95);
          F.tween({ targets: tg, scale: 1.1, y: cy - 50, alpha: 0, duration: 700, ease: 'Cubic.easeOut', onComplete: () => tg.destroy() });
          popupNumber(s, cx, cy - 64, 'พยัคฆ์เหิน!', 'exp');
          F.shock(cx, cy, { r: sk.radius * 0.9, tint: 0xffa040, ms: 700 }); F.rune(cx, cy, { size: sk.radius * 1.1, tint: 0xffa040, ms: 1400, spin: 50 });
        });
        at(1100, () => F.tween({ targets: pot, alpha: 0, duration: 300, onComplete: () => pot.destroy() }));
        sys.partyTargets(sk, o).forEach((m, i) => at(560 + i * 80, () => { F.aura(m, { tint: 0xffa040, ms: sk.duration }); this.tigerMarks(m, sk.duration); }));
        if (local) sys.buff(sk);
        break;
      }
      case 'heal_khwan': {                                    // บายศรี + เทียน 8 เล่ม → สายสิญจน์พุ่งไปทุกคน → ลำแสงทอง
        const bs = F.img(cx + o.ux * 16, cy - 2, 'hl_baisri', { add: false, depth: cy + 2 }).setOrigin(0.5, 1).setScale(0.1);
        F.tween({ targets: bs, scale: 0.75, duration: 420, ease: 'Back.easeOut' });
        const cand = [];
        for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2, c = F.img(cx + Math.cos(a) * 34, cy + Math.sin(a) * 14, 'hl_candle', { add: false, depth: cy + Math.sin(a) * 14 }).setOrigin(0.5, 1).setAlpha(0); cand.push(c); F.tween({ targets: c, alpha: 1, delay: i * 90, duration: 160 }); }
        F.rune(cx, cy, { size: 110, tint: GOLD, ms: (sk.castMs || 1200) + 900, spin: 45 });
        at(sk.castMs || 1200, () => {
          sys.snd('skFlash'); F.flash(220, GOLD, 0.3);
          F.pillar(cx, cy, { tint: GOLD, h: 190, ms: 1200, w: 50 });
          const who = local ? this.allies().map((a) => a.spr).filter((t) => dist(t, s.player) <= sk.radius + 40) : sys.partyTargets(sk, o).map((m) => m.spr || m);
          who.forEach((t) => {
            const g = s.add.graphics().setDepth(TOP).setBlendMode(ADD()); g.lineStyle(1.5, 0xfff6d0, 0.9); g.beginPath(); g.moveTo(cx, cy - 40); g.lineTo(t.x, t.y - 20); g.strokePath();
            F.tween({ targets: g, alpha: 0, duration: 700, onComplete: () => g.destroy() });
            F.aura(t, { tint: GOLD, ms: sk.undying });
          });
          if (local && !s.econ.server) this.localHeal((s.player.derived?.maxHp || 100) * sk.heal, 'khwan');
          if (local) { const p = s.player; p.buffs = (p.buffs || []).filter((b) => b.sk !== sk.id); p.buffs.push({ buff: { undying: true }, until: s.time.now + sk.undying, sk: sk.id, icon: sk.icon, name: 'ขวัญกันตาย' }); s.ui.toast?.('🪷 ขวัญกันตาย 10 วิ!', 'ok', 1600); }
        });
        at((sk.castMs || 1200) + 700, () => { F.tween({ targets: [bs, ...cand], alpha: 0, duration: 400, onComplete: () => { bs.destroy(); cand.forEach((c) => c.destroy()); } }); });
        break;
      }
      case 'heal_mortar': {
        const c = o.prep?.c || sys.center(sk, o), R = sk.radius;
        F.rune(c.x, c.y, { size: R * 2, tint: GOLD, ms: 200 + sk.hits * sk.interval + 1500, spin: -90 });
        const mo = F.img(c.x, c.y + 4, 'hl_mortar', { add: false, depth: c.y + 5 }).setOrigin(0.5, 1).setScale(0.2).setAlpha(0);
        F.tween({ targets: mo, scale: 1, alpha: 1, duration: 200, ease: 'Back.easeOut' });
        const pe = F.img(c.x + 4, c.y - 60, 'hl_pestle', { add: false, depth: c.y + 6 }).setOrigin(0.5, 1).setAlpha(0);
        F.tween({ targets: pe, alpha: 1, duration: 150 });
        let hitN = 0;
        for (let i = 0; i < sk.hits; i++) at(200 + i * sk.interval, () => {
          F.tween({ targets: pe, y: c.y - 8, duration: 110, ease: 'Quad.easeIn', yoyo: i < sk.hits - 1, hold: 40, onComplete: () => {} });
          at(110, () => {
            sys.snd('skSlam'); F.shock(c.x, c.y, { r: R * (0.6 + i * 0.2), tint: i === sk.hits - 1 ? GREEN : 0xd8c070, ms: 460 }); F.crack(c.x, c.y, { scale: 0.8 + i * 0.3 }); F.shake(120, 0.004 + i * 0.002);
            F.smoke(c.x, c.y, { n: 5, tint: 0x5a8a4a, r: R * 0.4 });
            if (i === sk.hits - 1) {
              F.explode(c.x, c.y, { r: R * 0.55, tint: GREEN, shake: false }); this.leaves(c.x, c.y - 10, 16, R * 0.9);
              const ms = sys.mobsNear(c.x, c.y, R); hitN = ms.length;
              ms.forEach((m) => { if (local) sys.hit(m, sk, 0xd8c070); F.flames(m.x, m.y, { n: 3, tint: 0xff9a3c, r: 6, h: 18, ms: 500 }); sys.dizzy(m, 700); });
              if (hitN) popupNumber(s, c.x, c.y - 60, `ผีโดน ${hitN} ตัว · รักษา +${Math.round(Math.min(sk.perMax, sk.perHit * hitN) * 100)}%`, 'exp');
            }
          });
        });
        at(200 + sk.hits * sk.interval + 250, () => {        // ผงยาเขียววนเข้าหาเพื่อนในวง
          F.tween({ targets: [mo, pe], alpha: 0, duration: 400, onComplete: () => { mo.destroy(); pe.destroy(); } });
          const who = local ? this.allies().filter((a) => !a.dead && Math.hypot(a.spr.x - c.x, a.spr.y - c.y) <= R + 30).map((a) => a.spr) : [];
          who.forEach((t) => { for (let k = 0; k < 6; k++) { const d = F.img(c.x + rand(-R, R) * 0.5, c.y + rand(-R, R) * 0.25, 'fx_glow', { tint: GREEN }).setDisplaySize(8, 8); F.tween({ targets: d, x: t.x, y: t.y - 20, duration: 380 + k * 40, ease: 'Sine.easeIn', onComplete: () => d.destroy() }); } });
          if (local && !s.econ.server && who.includes(s.player)) this.localHeal(this.matk() * sk.hmult * (1 + Math.min(sk.perMax, sk.perHit * hitN)), 'mortar');
        });
        break;
      }
      default: return false;
    }
    return true;
  }

  /** รอยเท้าเสือไฟตามพื้นตอนวิ่ง (ช่วงบัฟ) */
  tigerMarks(m, ms) {
    const s = this.s, o = m.spr || m; let last = { x: o.x, y: o.y };
    const ev = s.time.addEvent({ delay: 120, loop: true, callback: () => {
      if (!o.active) return;
      if (dist(o, last) > 14) { last = { x: o.x, y: o.y }; const f = this.fx.img(o.x + rand(-3, 3), o.y + 1, 'fx_glow', { tint: 0xff8a2a, depth: 0.95, alpha: 0.7 }).setDisplaySize(7, 4); this.fx.tween({ targets: f, alpha: 0, duration: 700, onComplete: () => f.destroy() }); }
    } });
    s.time.delayedCall(ms, () => ev.remove());
  }
}
