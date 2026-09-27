// ============================================================
//  HeroPreview – วาดตัวละครแบบเดียวกับในเกม (top-down 8 ทิศ) ลง <canvas> ของหน้า Lobby / สร้างตัวละคร
//  ▸ มีภาพ PixelLab ของชุดนั้น (assets/td/hero_<เพศ>_<ชุด>/<ท่า>.png · แถวละ 1 ทิศ) → ใช้ภาพนั้น
//  ▸ ยังไม่มี → ใช้สไปรต์ด้านข้างเดิม (bakeCharacter) เหมือนที่เกมใช้แทนอยู่
// ============================================================
import { sanitizeAppearance } from '/shared/data/appearance.js';
import { bakeCharacter } from '../gfx/SpriteFactory.js';

export const OUTFIT_IDS = ['mohom', 'ruenton', 'jongkraben', 'rajpatan', 'chaona', 'silk', 'warrior', 'hunter', 'isan', 'mahadlek'];
export const heroId = (a) => `hero_${a.gender}_${OUTFIT_IDS[a.outfit] || 'mohom'}`;
/** ลำดับแถวในภาพ PixelLab */
export const DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];
/** ลำดับหมุนตัวตามเข็มนาฬิกา (มองจากบน) */
export const TURN = ['south', 'south-west', 'west', 'north-west', 'north', 'north-east', 'east', 'south-east'];
const RATE = { idle: 5, walk: 10, attack: 14, slash: 16, shoot: 14, cast: 13, die: 8 };
/** ท่าโจมตีจริงตามอาวุธ (ดาบ = ฟัน · ธนู = ยิง · ไม้เท้า = ร่าย · มือเปล่า = ต่อย) — แบบเดียวกับในเกม */
const ACTION = { swordman: 'slash', archer: 'shoot', mage: 'cast', boxer: 'attack' };
const BORROW = { attack: 'walk', die: 'idle' };

let metaP = null, meta = {};
/** โหลดรายการภาพ 8 ทิศ (ครั้งเดียว) */
export function loadHeroMeta() {
  if (!metaP) metaP = fetch('/assets/td/manifest.json').then((r) => r.json()).then((d) => (meta = d?.sprites || {})).catch(() => (meta = {}));
  return metaP;
}
export const hasHero = (a) => !!meta[heroId(a)];

const imgs = new Map();
function heroImg(id, anim) {
  const k = `${id}/${anim}`;
  if (!imgs.has(k)) { const im = new Image(); im.src = `/assets/td/${k}.png`; imgs.set(k, im); }
  return imgs.get(k);
}

const views = new Set();
let raf = 0;
function loop(now) {
  raf = views.size ? requestAnimationFrame(loop) : 0;
  for (const v of views) v.draw(now);
}

export class HeroView {
  /** @param canvas <canvas> ปลายทาง · scene = Phaser scene (ใช้สร้างสไปรต์สำรอง) · opts.scale ขนาดพิกเซล */
  constructor(canvas, scene, opts = {}) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.scene = scene;
    this.scale = opts.scale || 2;
    this.shadow = opts.shadow !== false;
    this.anim = 'idle'; this.dir = 'south'; this.t0 = performance.now();
    this.spin = 0;            // > 0 = หมุนตัวเองทุก n ms
    this.a = null;
    canvas.width = 72 * this.scale; canvas.height = 72 * this.scale;
    views.add(this);
    if (!raf) raf = requestAnimationFrame(loop);
  }

  set(appearance, anim = this.anim, dir = this.dir) {
    const a = sanitizeAppearance(appearance || {});
    this.job = appearance?.job || a.job;
    const key = JSON.stringify(a);
    if (key !== this.aKey) { this.aKey = key; this.a = a; this.legacy = null; }
    if (anim !== this.anim || dir !== this.dir) this.t0 = performance.now();
    this.anim = anim; this.dir = dir;
    return this;
  }

  turn(step) { this.dir = TURN[(TURN.indexOf(this.dir) + step + 8) % 8]; }

  /** เฟรมปัจจุบัน → { src, sx, sy, sw, sh, flip } */
  frame(now) {
    const id = heroId(this.a), m = meta[id];
    if (m) {
      const want = this.anim === 'attack' ? ACTION[this.job] || 'attack' : this.anim;
      let anim = m.anims.includes(want) ? want : m.anims.includes(this.anim) ? this.anim : BORROW[this.anim];
      if (!anim || !m.anims.includes(anim)) anim = 'idle';
      const im = heroImg(id, anim);
      if (!im.complete || !im.naturalWidth) return null;
      const n = m.frames?.[anim] || 4, fw = im.naturalWidth / n, fh = im.naturalHeight / DIRS.length;
      const loopable = anim === 'idle' || anim === 'walk';
      const ms0 = 1000 / (RATE[anim] || 8);
      const ms = ms0, el = now - this.t0;
      let i = Math.floor(el / ms);
      i = loopable ? i % n : (i % (n + 6) >= n ? n - 1 : i % (n + 6));      // ท่าไม่วน: เล่นจบแล้วค้างครู่หนึ่งก่อนเล่นซ้ำ
      return { src: im, sx: i * fw, sy: DIRS.indexOf(this.dir) * fh, sw: fw, sh: fh, hero: true };
    }
    // สำรอง: สไปรต์ด้านข้าง (พลิกซ้าย/ขวาตามทิศ)
    if (!this.scene) return null;
    if (!this.legacy) {
      try { this.legacy = bakeCharacter(this.scene, this.a); } catch { return null; }
    }
    const legacyAnim = { idle: 'idle', walk: 'walk', attack: 'attack', die: 'die' }[this.anim] || 'idle';
    const an = this.scene.anims.get(`${this.legacy}:${legacyAnim}`) || this.scene.anims.get(`${this.legacy}:idle`);
    if (!an?.frames?.length) return null;
    const n = an.frames.length, ms = 1000 / (an.frameRate || 8);
    const i = Math.floor((now - this.t0) / ms) % (an.repeat === -1 ? n : n + 5);
    const f = an.frames[Math.min(i, n - 1)].frame;
    return { src: f.source.image, sx: f.cutX, sy: f.cutY, sw: f.cutWidth, sh: f.cutHeight, flip: /west/.test(this.dir) };
  }

  /** โชว์ท่าวนอัตโนมัติ: ยืนหันหน้า → ท่าโจมตีตามอาวุธ → เดินหมุนรอบตัว */
  setShowcase(on) { this.showcase = !!on; this.sc0 = performance.now(); if (!on) this.spin = 0; return this; }

  draw(now) {
    if (!this.a) return;
    if (this.showcase) {
      const T = (now - this.sc0) % 8200, ph = T < 2600 ? 'idle' : T < 4400 ? 'attack' : 'walk';
      if (ph !== this.anim) { this.anim = ph; this.t0 = now; if (ph !== 'walk') this.dir = 'south'; }
      this.spin = ph === 'walk' ? 650 : 0;
    }
    if (this.spin && now - (this.spunAt || 0) > this.spin) { this.spunAt = now; this.turn(1); }
    const { ctx, cv } = this, W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    const f = this.frame(now);
    if (!f) return;
    ctx.imageSmoothingEnabled = false;
    // เงาใต้เท้า
    if (this.shadow) {
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.beginPath(); ctx.ellipse(W / 2, H * 0.9, W * 0.2, H * 0.05, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (f.hero) {
      const s = this.scale * 72 / f.sw;
      ctx.drawImage(f.src, f.sx, f.sy, f.sw, f.sh, (W - f.sw * s) / 2, H * 0.97 - f.sh * s, f.sw * s, f.sh * s);
    } else {
      const s = Math.max(1, Math.floor((H * 0.62) / f.sh * 2) / 2);
      const dw = f.sw * s, dh = f.sh * s;
      ctx.save();
      ctx.translate(W / 2, 0);
      if (f.flip) ctx.scale(-1, 1);
      ctx.drawImage(f.src, f.sx, f.sy, f.sw, f.sh, -dw / 2, H * 0.92 - dh, dw, dh);
      ctx.restore();
    }
  }

  destroy() { views.delete(this); }
}

/** ลบทุกวิว (ตอนออกจากหน้า) */
export function clearHeroViews() { views.clear(); }
