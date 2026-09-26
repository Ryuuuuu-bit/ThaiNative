// ============================================================
//  TitleScreen – วอลเปเปอร์หน้าเข้าเกม (สุ่ม 1 ใน 4 ฉาก) + เอฟเฟกต์ขยับได้ + เพลงประจำฉาก
//  ▸ วาดบน <canvas id="title-bg"> เต็มจอ อยู่หลังเกม (Phaser โปร่งใสตอนหน้าเข้าเกม/สร้างตัวละคร)
//  ▸ พิกัดเอฟเฟกต์อิงภาพต้นฉบับ 384×216 → ขยับไปพร้อมภาพ (กล้องแพนช้าๆ)
//  ▸ titleScreen.start() ตอนเปิดหน้า Login / สร้างตัวละคร · titleScreen.stop() ตอนเข้าเกม
// ============================================================
import { sound } from './Sound.js';

const IW = 384, IH = 216;
const LAST_KEY = 'thainative_title_last';

/** ฉากทั้งหมด (fx = เอฟเฟกต์ที่ใช้, ghost = ผีที่โผล่มาแวบๆ ใช้ภาพต้นฉบับของผีในเกม) */
export const TITLE_SCENES = [
  { id: 'a', img: 'assets/title/wall_a.png', nameTh: 'คืนลอยกระทง ณ วัดริมน้ำ', music: 'title_a',
    fx: { lanterns: 1, candles: [[13, 175], [37, 192], [101, 180], [131, 173], [165, 182], [188, 168], [78, 211]], shimmer: [160, 216, '255,214,120'],
      moon: [105, 55, 62, '255,236,170'] },
    ghost: { id: 'krasue', h: 30, y: [40, 110], glow: '120,200,255', path: 'drift' } },
  { id: 'b', img: 'assets/title/wall_b.png', nameTh: 'ต้นตะเคียนกลางป่าช้า', music: 'title_b',
    fx: { fog: '150,110,200', fireflies: '190,255,140', orbs: '140,255,190', moon: [205, 20, 60, '200,255,230'] },
    ghost: { id: 'nang_takhian', h: 44, y: [120, 150], glow: '150,255,190', path: 'fade', x: [60, 330] } },
  { id: 'c', img: 'assets/title/wall_c.png', nameTh: 'ประตูลานพญายักษ์', music: 'title_c',
    fx: { embers: 1, fireglow: 1, lightning: 1, lamps: [[30, 188], [142, 182], [204, 165], [350, 180]], moon: [195, 47, 50, '255,80,50'] },
    ghost: null },
  { id: 'd', img: 'assets/title/wall_d.png', nameTh: 'บางผียามโพล้เพล้', music: 'title_d',
    fx: { fireflies: '255,230,120', clouds: 1, lamps: [[33, 128], [217, 128], [284, 128]], moon: [175, 108, 50, '255,190,120'] },
    ghost: { id: 'kong_koi', h: 26, y: [132, 142], glow: '255,170,120', path: 'peek', x: [300, 360] } },
];

const rnd = (a, b) => a + Math.random() * (b - a);

class TitleScreen {
  constructor() {
    this.scene = null;
    this.running = false;
    this.parts = [];
  }

  /** เลือกฉากแบบสุ่ม (ไม่ซ้ำกับครั้งก่อน) */
  pick() {
    let last = -1;
    try { last = +localStorage.getItem(LAST_KEY); } catch { /* ignore */ }
    let i = Math.floor(Math.random() * TITLE_SCENES.length);
    if (i === last) i = (i + 1 + Math.floor(Math.random() * (TITLE_SCENES.length - 1))) % TITLE_SCENES.length;
    try { localStorage.setItem(LAST_KEY, String(i)); } catch { /* ignore */ }
    return i;
  }

  start(index = null) {
    if (this.running && index === null) { sound.music(this.scene.music); return; }
    const i = index ?? this.pick();
    this.scene = TITLE_SCENES[i];
    this.index = i;
    this.cv = document.getElementById('title-bg');
    this.cv.classList.remove('hidden', 'fade-out');
    this.ctx = this.cv.getContext('2d');
    this.img = new Image();
    this.img.src = this.scene.img;
    this.ghostImg = this.ghostImage(this.scene.ghost?.id);
    this.parts = [];
    this.flash = 0;
    this.ghostT = rnd(3, 7);
    this.t0 = performance.now();
    const cap = document.getElementById('title-caption');
    if (cap) { cap.textContent = `📍 ${this.scene.nameTh}`; cap.classList.remove('hidden'); }
    sound.music(this.scene.music);
    if (!this.running) {
      this.running = true;
      this.onResize = () => this.resize();
      window.addEventListener('resize', this.onResize);
      this.resize();
      this.last = performance.now();
      const loop = (now) => { if (!this.running) return; this.frame(now); this.raf = requestAnimationFrame(loop); };
      this.raf = requestAnimationFrame(loop);
    }
  }

  /** ฉากถัดไป (คลิกที่ชื่อฉาก) */
  next() { this.start((this.index + 1) % TITLE_SCENES.length); }

  stop() {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.cv.classList.add('fade-out');
    setTimeout(() => { if (!this.running) this.cv.classList.add('hidden'); }, 600);
    document.getElementById('title-caption')?.classList.add('hidden');
    this.onStop?.();
  }

  ghostImage(id) {
    if (!id) return null;
    try {
      const t = window.game?.textures;
      if (t?.exists(`mbase_${id}`)) return t.get(`mbase_${id}`).getSourceImage();
    } catch { /* ignore */ }
    return null;
  }

  resize() {
    this.cv.width = Math.ceil(window.innerWidth / 2);   // วาดครึ่งความละเอียด แล้วขยายแบบพิกเซล (เบาเครื่อง)
    this.cv.height = Math.ceil(window.innerHeight / 2);
    this.ctx.imageSmoothingEnabled = false;
  }

  // ------------------------------------------------------------
  frame(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    const t = (now - this.t0) / 1000;
    const { ctx, cv } = this, S = this.scene;
    const W = cv.width, H = cv.height;
    // กล้อง: cover + ซูม/แพนช้าๆ (Ken Burns)
    const base = Math.max(W / IW, H / IH);
    const k = base * (1.04 + 0.02 * Math.sin(t / 9));
    const ox = (W - IW * k) / 2 + Math.sin(t / 13) * IW * k * 0.015;
    const oy = (H - IH * k) / 2 + Math.cos(t / 11) * IH * k * 0.012;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0d0714'; ctx.fillRect(0, 0, W, H);
    ctx.setTransform(k, 0, 0, k, ox, oy);
    if (this.img.complete && this.img.naturalWidth) ctx.drawImage(this.img, 0, 0, IW, IH);
    const fx = S.fx;
    if (fx.moon) this.moon(ctx, t, ...fx.moon);
    if (fx.clouds) this.clouds(ctx, t);
    if (fx.candles) this.candles(ctx, t, fx.candles);
    if (fx.lamps) this.candles(ctx, t, fx.lamps, true);
    if (fx.shimmer) this.shimmer(ctx, t, ...fx.shimmer);
    this.ghost(ctx, dt, t);
    this.spawn(dt);
    this.updateParts(ctx, dt, t);
    if (fx.fog) this.fog(ctx, t, fx.fog);
    // จอทั้งจอ: แสงไฟ/ฟ้าแลบ + ขอบมืด
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (fx.fireglow) { ctx.fillStyle = `rgba(255,70,10,${0.025 + 0.02 * Math.sin(t * 7) * Math.sin(t * 2.3)})`; ctx.fillRect(0, 0, W, H); }
    if (fx.lightning) this.lightning(ctx, dt, W, H);
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(5,2,12,0.7)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  // ---------------- เอฟเฟกต์ ----------------
  glow(ctx, x, y, r, rgb, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  moon(ctx, t, x, y, r, rgb) {
    ctx.globalCompositeOperation = 'lighter';
    this.glow(ctx, x, y, r * (1 + 0.05 * Math.sin(t * 0.8)), rgb, 0.18 + 0.05 * Math.sin(t * 0.8));
    ctx.globalCompositeOperation = 'source-over';
  }

  candles(ctx, t, list, lamp = false) {
    ctx.globalCompositeOperation = 'lighter';
    list.forEach(([x, y], i) => {
      const f = 0.35 + 0.2 * Math.sin(t * 9 + i * 1.7) + 0.1 * Math.sin(t * 23 + i);
      this.glow(ctx, x, y - (lamp ? 0 : 3), lamp ? 9 : 7, '255,180,70', f);
    });
    ctx.globalCompositeOperation = 'source-over';
  }

  shimmer(ctx, t, y0, y1, rgb) {
    const n = 14;
    for (let i = 0; i < n; i++) {
      const s = i * 97.13;
      const x = ((s * 7.1 + t * (6 + (i % 3) * 3)) % (IW + 30)) - 15;
      const y = y0 + ((s * 3.3) % (y1 - y0));
      const a = 0.25 + 0.25 * Math.sin(t * 2 + i);
      ctx.fillStyle = `rgba(${rgb},${a})`;
      ctx.fillRect(Math.round(x), Math.round(y), 3 + (i % 4), 1);
    }
  }

  clouds(ctx, t) {
    for (let i = 0; i < 4; i++) {
      const x = ((i * 120 + t * (3 + i)) % (IW + 160)) - 80, y = 18 + i * 14;
      ctx.fillStyle = `rgba(60,30,60,${0.18 + i * 0.03})`;
      ctx.beginPath(); ctx.ellipse(x, y, 60 - i * 6, 6 + i, 0, 0, 7); ctx.fill();
    }
  }

  fog(ctx, t, rgb) {
    for (let i = 0; i < 6; i++) {
      const x = ((i * 90 + t * (4 + i * 1.5)) % (IW + 200)) - 100;
      const y = 150 + (i % 3) * 22 + Math.sin(t * 0.4 + i) * 4;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 70);
      g.addColorStop(0, `rgba(${rgb},0.22)`); g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g; ctx.fillRect(x - 70, y - 70, 140, 140);
    }
  }

  lightning(ctx, dt, W, H) {
    this.nextBolt ??= rnd(5, 10);
    this.nextBolt -= dt;
    if (this.nextBolt <= 0) {
      this.flash = 1; this.nextBolt = rnd(7, 15);
      sound.play('thunder');
    }
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,225,225,${this.flash * this.flash * 0.25})`; ctx.fillRect(0, 0, W, H);
      this.flash = Math.max(0, this.flash - dt * 3);
    }
  }

  /** ผีโผล่มาแวบๆ แล้วจางหาย */
  ghost(ctx, dt, t) {
    const G = this.scene.ghost, img = this.ghostImg;
    if (!G || !img) return;
    if (!this.g) {
      this.ghostT -= dt;
      if (this.ghostT > 0) return;
      const dir = Math.random() < 0.5 ? 1 : -1;
      this.g = G.path === 'drift'
        ? { x: dir > 0 ? -30 : IW + 30, y: rnd(...G.y), vx: dir * rnd(10, 16), life: 0, max: 30, dir }
        : { x: rnd(...G.x), y: rnd(...G.y), vx: 0, life: 0, max: G.path === 'peek' ? 4 : 5, dir: Math.random() < 0.5 ? 1 : -1 };
    }
    const g = this.g;
    g.life += dt; g.x += g.vx * dt;
    const L = g.life / g.max;
    const a = G.path === 'drift' ? Math.min(1, g.life / 2, (g.max - g.life) / 2) * 0.7 : Math.sin(Math.min(1, L) * Math.PI) * 0.75;
    if (L >= 1 || g.x < -60 || g.x > IW + 60) { this.g = null; this.ghostT = rnd(6, 12); return; }
    const h = G.h, w = img.width * (h / img.height);
    const bob = Math.sin(t * 2) * 2;
    const peekDy = G.path === 'peek' ? (1 - Math.sin(Math.min(1, L) * Math.PI)) * h * 0.6 : 0;
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    ctx.globalCompositeOperation = 'lighter';
    this.glow(ctx, g.x, g.y - h / 2 + bob, h * 0.9, G.glow, 0.35);
    ctx.globalCompositeOperation = 'source-over';
    ctx.translate(g.x, g.y + bob + peekDy);
    if (g.dir < 0) ctx.scale(-1, 1);
    ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.restore();
  }

  // ---------------- อนุภาค ----------------
  spawn(dt) {
    const fx = this.scene.fx, P = this.parts;
    if (P.length > 140) return;
    if (fx.lanterns && Math.random() < dt * 0.9)
      P.push({ k: 'lantern', x: rnd(0, IW), y: IH + 8, vx: rnd(-2, 2), vy: -rnd(5, 10), s: rnd(2, 4), ph: rnd(0, 6), life: 0 });
    if (fx.fireflies && Math.random() < dt * 5)
      P.push({ k: 'fly', x: rnd(0, IW), y: rnd(60, IH), vx: rnd(-4, 4), vy: rnd(-3, 3), ph: rnd(0, 6), life: 0, max: rnd(4, 8), rgb: fx.fireflies });
    if (fx.orbs && Math.random() < dt * 0.8)
      P.push({ k: 'orb', x: rnd(80, 320), y: IH, vx: rnd(-2, 2), vy: -rnd(4, 8), ph: rnd(0, 6), life: 0, max: rnd(10, 16), rgb: fx.orbs });
    if (fx.embers && Math.random() < dt * 16)
      P.push({ k: 'ember', x: rnd(0, IW), y: IH + 2, vx: rnd(-6, 6), vy: -rnd(12, 30), ph: rnd(0, 6), life: 0, max: rnd(3, 7) });
  }

  updateParts(ctx, dt, t) {
    ctx.globalCompositeOperation = 'lighter';
    this.parts = this.parts.filter((p) => {
      p.life += dt; p.x += (p.vx + Math.sin(t + p.ph) * 2) * dt; p.y += p.vy * dt;
      if (p.k === 'lantern') {
        if (p.y < -10) return false;
        const f = 0.7 + 0.3 * Math.sin(t * 6 + p.ph);
        this.glow(ctx, p.x, p.y, p.s * 3, '255,150,50', 0.35 * f);
        ctx.fillStyle = `rgba(255,${170 + 40 * f | 0},80,0.95)`; ctx.fillRect(Math.round(p.x - p.s / 2), Math.round(p.y - p.s), Math.ceil(p.s), Math.ceil(p.s * 1.3));
        return true;
      }
      if (p.life > p.max) return false;
      const a = Math.sin((p.life / p.max) * Math.PI);
      if (p.k === 'fly') {
        const blink = 0.5 + 0.5 * Math.sin(t * 5 + p.ph);
        this.glow(ctx, p.x, p.y, 4, p.rgb, 0.5 * a * blink);
        ctx.fillStyle = `rgba(${p.rgb},${a * blink})`; ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
      } else if (p.k === 'orb') {
        this.glow(ctx, p.x, p.y, 7, p.rgb, 0.45 * a);
        ctx.fillStyle = `rgba(230,255,240,${a * 0.9})`; ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 2, 2);
      } else if (p.k === 'ember') {
        ctx.fillStyle = `rgba(255,${120 + (Math.sin(p.ph + t * 10) * 60 | 0)},40,${a})`; ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
      }
      return true;
    });
    ctx.globalCompositeOperation = 'source-over';
  }
}

export const titleScreen = new TitleScreen();
