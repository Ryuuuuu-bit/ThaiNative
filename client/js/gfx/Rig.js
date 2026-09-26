// ============================================================
//  Rig – ทำท่าทางจากภาพนิ่ง 1 ภาพ แบบ "หุ่นตัดต่อ" (cut-out animation)
//  ▸ แยกภาพอัตโนมัติเป็น หัว / ลำตัว / ขาหลัง / ขาหน้า แล้วหมุนรอบข้อต่อ
//  ▸ ผีลอย: ส่วนล่าง (ผม ไส้ ชายผ้า หมอก) พลิ้วเป็นคลื่น
//  ▸ ตาย: สลายเป็นวิญญาณลอยขึ้น (ไม่ต้องใช้พื้นที่เฟรมกว้าง)
// ============================================================

const TAU = Math.PI * 2;

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { c, ctx };
}

/** ตัดขอบโปร่งใส + ลบพิกเซลจางๆ */
export function trimImage(src) {
  const { c, ctx } = canvas(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height), p = d.data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const i = (y * c.width + x) * 4;
    if (p[i + 3] < 60) { p[i + 3] = 0; continue; }
    p[i + 3] = 255;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  ctx.putImageData(d, 0, 0);
  if (x1 < 0) return c;
  const t = canvas(x1 - x0 + 1, y1 - y0 + 1);
  t.ctx.drawImage(c, x0, y0, t.c.width, t.c.height, 0, 0, t.c.width, t.c.height);
  return t.c;
}

function crop(img, x, y, w, h) {
  const t = canvas(w, h);
  t.ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
  return t.c;
}

/**
 * วิเคราะห์ภาพ → ชิ้นส่วน
 * opts: { hip: สัดส่วนความสูงที่เป็นสะโพก (0–1), neck: สัดส่วนคอ, quad: สัตว์สี่ขา }
 */
export function buildRig(src, opts = {}) {
  const img = src.getContext ? src : trimImage(src);
  const W = img.width, H = img.height;
  const hipY = Math.round(H * (opts.hip ?? 0.62));
  const neckY = Math.round(H * (opts.neck ?? 0.3));
  // หาเส้นแบ่งขาหลัง/ขาหน้า: ดูคอลัมน์ในส่วนขา แล้วหาช่องว่าง/จุดกลางมวล
  const ctx = img.getContext('2d');
  const data = ctx.getImageData(0, hipY, W, H - hipY).data;
  const cols = new Array(W).fill(0);
  for (let y = 0; y < H - hipY; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3]) cols[x]++;
  const xs = []; cols.forEach((n, x) => { for (let k = 0; k < n; k++) xs.push(x); });
  let split = xs.length ? xs[Math.floor(xs.length / 2)] : Math.floor(W / 2);
  // ถ้ามีช่องว่างระหว่างขา ใช้ช่องว่างที่ใกล้จุดกลางที่สุด
  let best = Infinity;
  for (let x = 1; x < W - 1; x++) if (cols[x] === 0 && cols[x - 1] + cols[x + 1] > 0 && Math.abs(x - split) < best && Math.abs(x - split) < W * 0.25) { best = Math.abs(x - split); split = x; }
  if (opts.quad) split = Math.round(W * 0.5);
  const legTop = Math.max(0, hipY - 3);
  const massX = (a, b) => { let s = 0, n = 0; for (let x = a; x < b; x++) { s += x * cols[x]; n += cols[x]; } return n ? s / n : (a + b) / 2; };
  return {
    img, W, H, hipY, neckY, split,
    head: crop(img, 0, 0, W, neckY + 1),
    torso: crop(img, 0, Math.max(0, neckY - 1), W, hipY + 2 - Math.max(0, neckY - 1)),
    torsoY: Math.max(0, neckY - 1),
    backLeg: crop(img, 0, legTop, split, H - legTop),
    frontLeg: crop(img, split, legTop, W - split, H - legTop),
    legTop,
    backPivot: massX(0, split), frontPivot: massX(split, W),
    quad: !!opts.quad,
  };
}

/** วาดภาพแบบพลิ้ว (คลื่น) จากแถว from ลงไป */
function drawWavy(ctx, img, x, y, t, amp, from = 0.5, freq = 0.35) {
  const H = img.height, start = Math.floor(H * from);
  if (start > 0) ctx.drawImage(img, 0, 0, img.width, start, x, y, img.width, start);
  for (let r = start; r < H; r++) {
    const k = (r - start) / Math.max(1, H - start);
    const off = Math.round(amp * Math.pow(k, 1.3) * Math.sin(t * TAU + r * freq));
    ctx.drawImage(img, 0, r, img.width, 1, x + off, y + r, img.width, 1);
  }
}

/** เติมสีทับ (แฟลชขาว/แดง) เฉพาะส่วนที่มีพิกเซล */
function tintOver(ctx, w, h, color) {
  ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = color; ctx.fillRect(0, 0, w, h); ctx.restore();
}

function shadow(ctx, cx, y, w, a = 0.3) {
  ctx.save(); ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.beginPath(); ctx.ellipse(cx, y, Math.max(3, w), 1.8, 0, 0, TAU); ctx.fill(); ctx.restore();
}

/**
 * วาดท่าหุ่น
 * pose: { dx, dy, rot (ทั้งตัวรอบเท้า), sx, sy, lean (ลำตัวรอบสะโพก), head, back, front (มุมขา), backLift, frontLift,
 *         wave:{amp,from,t}, tint, alpha }
 */
export function drawRig(ctx, rig, pose, footX, footY) {
  const { W, H } = rig;
  const p = { dx: 0, dy: 0, rot: 0, sx: 1, sy: 1, lean: 0, head: 0, back: 0, front: 0, backLift: 0, frontLift: 0, alpha: 1, ...pose };
  const layer = canvas(W * 3, H * 2);            // วาดแยก layer ก่อน เพื่อใส่สีทับได้เฉพาะตัว
  const L = layer.ctx, ox = W, oy = H * 2 - 2;    // ตำแหน่งเท้าใน layer
  L.save();
  L.translate(ox, oy);
  L.rotate(p.rot);
  L.scale(p.sx, p.sy);
  L.translate(-W / 2, -H);
  if (p.wave) {
    // ผีลอย: ทั้งตัว + ส่วนล่างพลิ้ว
    L.translate(W / 2, rig.hipY); L.rotate(p.lean); L.translate(-W / 2, -rig.hipY);
    drawWavy(L, rig.img, 0, 0, p.wave.t, p.wave.amp, p.wave.from, p.wave.freq);
  } else {
    const leg = (img, x, pivot, ang, lift, dark) => {
      L.save();
      L.translate(pivot, rig.hipY - lift); L.rotate(ang); L.translate(-pivot, -rig.hipY);
      if (dark) L.filter = 'brightness(0.72)';
      L.drawImage(img, x, rig.legTop);
      L.restore();
    };
    leg(rig.backLeg, 0, rig.backPivot, p.back, p.backLift, !rig.quad);
    if (rig.quad) {
      // สี่ขา: ลำตัวก่อน แล้วขาหน้า (ขาทั้งสองคู่อยู่ใต้ลำตัว)
      leg(rig.frontLeg, rig.split, rig.frontPivot, p.front, p.frontLift, false);
      L.save(); L.translate(W / 2, rig.hipY); L.rotate(p.lean); L.translate(-W / 2, -rig.hipY);
      L.drawImage(rig.torso, 0, rig.torsoY); L.drawImage(rig.head, 0, 0);
      L.restore();
    } else {
      leg(rig.frontLeg, rig.split, rig.frontPivot, p.front, p.frontLift, false);
      L.save();
      L.translate(W / 2, rig.hipY); L.rotate(p.lean); L.scale(1, p.torsoSy ?? 1); L.translate(-W / 2, -rig.hipY);
      L.drawImage(rig.torso, 0, rig.torsoY);
      L.translate(W / 2, rig.neckY); L.rotate(p.head); L.translate(-W / 2, -rig.neckY);
      L.drawImage(rig.head, 0, (p.headDy || 0));
      L.restore();
    }
  }
  L.restore();
  if (p.tint) tintOver(L, layer.c.width, layer.c.height, p.tint);
  ctx.save();
  ctx.globalAlpha = p.alpha;
  ctx.drawImage(layer.c, Math.round(footX - ox + p.dx), Math.round(footY - oy + p.dy));
  ctx.restore();
}

/** ตายแบบสลายเป็นวิญญาณ: หั่นเป็นแถบแนวนอน เลื่อนขึ้น/เยื้องแบบสุ่ม แล้วจางหาย */
export function drawDissolve(ctx, rig, k, footX, footY, seed = 1) {
  const { img, W, H } = rig;
  const x0 = Math.round(footX - W / 2), y0 = footY - H;
  let s = seed * 9973;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const sy = 1 - k * 0.45;                            // ทรุดลง
  for (let r = 0; r < H; r += 2) {
    const off = (rnd() - 0.5) * 10 * k, rise = rnd() * 16 * k * k;
    ctx.globalAlpha = Math.max(0, 1 - k * (0.6 + rnd() * 0.6));
    ctx.drawImage(img, 0, r, W, 2, x0 + off, footY - (H - r) * sy - rise, W, 2 * sy + 0.5);
  }
  ctx.globalAlpha = 1;
  if (k > 0.2) {                                       // ประกายวิญญาณ
    ctx.fillStyle = `rgba(215,189,226,${0.9 - k * 0.6})`;
    for (let i = 0; i < 6; i++) ctx.fillRect(x0 + rnd() * W, y0 + H * (1 - k) - rnd() * 14, 1, 1);
  }
}

// ============================================================
//  ท่าทางสำเร็จรูป (คืนค่า pose ต่อเฟรม)
// ============================================================
export const ANIM_SPEC = {
  idle:   { frames: 6, rate: 7,  repeat: -1 },
  walk:   { frames: 8, rate: 12, repeat: -1 },
  attack: { frames: 6, rate: 14, repeat: 0 },      // เฟรมที่ 4 (index 3) = จังหวะโดน
  hit:    { frames: 2, rate: 8,  repeat: 0 },
  die:    { frames: 6, rate: 9,  repeat: 0 },
};

/** คำนวณ pose ของมอนสเตอร์/ตัวละครตามประเภท
 *  kind: 'biped' | 'heavy' | 'quad' | 'float' | 'glide' | 'hop'
 *  cfg: { swing, waveFrom, waveAmp }
 */
export function poseFor(kind, anim, i, cfg = {}) {
  const n = ANIM_SPEC[anim]?.frames || 1, t = i / n;
  const sw = cfg.swing ?? (kind === 'heavy' ? 0.28 : kind === 'quad' ? 0.35 : 0.42);
  const floaty = kind === 'float' || kind === 'glide';
  const wave = floaty ? { amp: cfg.waveAmp ?? 2, from: cfg.waveFrom ?? 0.5, t, freq: cfg.waveFreq } : null;
  const s = Math.sin(t * TAU), c = Math.cos(t * TAU);
  switch (anim) {
    case 'idle':
      if (floaty) return { dy: Math.round(-2 - s * 2), lean: s * 0.03, wave };
      return { torsoSy: 1 + s * 0.025, head: s * 0.03, headDy: s > 0.5 ? 1 : 0, lean: kind === 'heavy' ? 0.05 : 0.02 * s, back: 0.02, front: -0.02 };
    case 'walk':
      if (kind === 'float') return { dy: Math.round(-3 - s * 2.5), lean: 0.12 + s * 0.04, wave: { ...wave, amp: (wave.amp) * 1.4 } };
      if (kind === 'glide') return { dy: Math.round(-Math.abs(s) * 3), lean: 0.08, sy: 1 - Math.abs(c) * 0.04, sx: 1 + Math.abs(c) * 0.03, wave };
      if (kind === 'hop') return { dy: Math.round(-Math.abs(s) * 5), sy: 1 + Math.abs(s) * 0.06 - (Math.abs(s) < 0.2 ? 0.08 : 0), back: -s * sw * 0.5, front: s * sw * 0.5, lean: 0.1 };
      return {
        dy: Math.round(-Math.abs(c) * (kind === 'heavy' ? 2.5 : 1.8) + 0.5),
        front: s * sw, back: -s * sw,
        frontLift: Math.max(0, c) * 1.5, backLift: Math.max(0, -c) * 1.5,
        lean: (kind === 'quad' ? 0.02 : 0.1) + Math.abs(s) * 0.03, head: -s * 0.04,
      };
    case 'attack': {
      const seq = floaty
        ? [{ dx: -2, sx: 0.94, sy: 1.06, lean: -0.1 }, { dx: -4, sx: 0.9, sy: 1.1, lean: -0.18 }, { dx: 4, sx: 1.12, sy: 0.92, lean: 0.2 },
           { dx: 8, sx: 1.2, sy: 0.88, lean: 0.3, tint: 'rgba(255,80,60,0.28)' }, { dx: 5, sx: 1.08, lean: 0.15 }, { dx: 1, lean: 0.04 }]
        : [{ dx: -1, lean: -0.12, sy: 0.96, front: 0.1, back: -0.1 }, { dx: -3, lean: -0.25, sy: 0.93, front: 0.25, back: -0.2, head: -0.1 },
           { dx: 4, lean: 0.3, front: -0.45, back: 0.35 }, { dx: 7, lean: 0.42, sx: 1.06, front: -0.55, back: 0.45, tint: 'rgba(255,80,60,0.25)' },
           { dx: 5, lean: 0.25, front: -0.35, back: 0.3 }, { dx: 1, lean: 0.06 }];
      return { ...seq[i], wave, ...(kind === 'quad' ? { lean: (seq[i].lean || 0) * 0.4, dy: i === 3 ? -4 : i === 2 ? -2 : 0 } : {}) };
    }
    case 'hit':
      return [{ dx: -3, lean: -0.3, sx: 0.94, tint: 'rgba(255,255,255,0.8)', wave }, { dx: -2, lean: -0.15, tint: 'rgba(255,60,60,0.35)', wave }][i];
    default: return {};
  }
}

/**
 * อบ spritesheet จาก rig → canvas + layout สำหรับ Phaser
 * คืน { canvas, fw, fh, frames:[{name,x}] }
 */
export function bakeRigSheet(rig, kind, cfg = {}, spec = ANIM_SPEC, fx = null) {
  const padX = Math.max(10, Math.round(rig.W * 0.3)), padTop = floatPad(kind);
  const fw = rig.W + padX * 2, fh = rig.H + padTop + 3;
  const total = Object.values(spec).reduce((a, s) => a + s.frames, 0);
  const sheet = canvas(fw * total, fh);
  const frames = [];
  let col = 0;
  const footX = fw / 2, footY = fh - 2;
  for (const [anim, s] of Object.entries(spec)) {
    for (let i = 0; i < s.frames; i++) {
      const ctx = sheet.ctx;
      ctx.save();
      ctx.beginPath(); ctx.rect(col * fw, 0, fw, fh); ctx.clip();
      ctx.translate(col * fw, 0);
      if (anim === 'die') {
        drawDissolve(ctx, rig, i / (s.frames - 1), footX, footY - (kind === 'float' ? 3 : 0), 7 + i);
      } else {
        const pose = poseFor(kind, anim, i, cfg);
        drawRig(ctx, rig, pose, footX, footY);
        fx?.(ctx, anim, i, pose, footX, footY);
      }
      if (kind !== 'float' || anim !== 'die') shadow(ctx, footX, fh - 1.5, rig.W * (kind === 'float' ? 0.25 : 0.35), kind === 'float' ? 0.18 : 0.3);
      ctx.restore();
      frames.push({ name: `${anim}_${i}`, x: col * fw });
      col++;
    }
  }
  return { canvas: sheet.c, fw, fh, frames };
}

function floatPad(kind) { return kind === 'float' ? 10 : kind === 'hop' ? 8 : 6; }

/** ประเภทการเคลื่อนไหวของผีแต่ละตัว (ภาพนิ่ง PixelLab → หุ่นตัดต่อ) */
export const MONSTER_RIG = {
  phi_tuay_kaew: { kind: 'float', waveFrom: 0.1, waveAmp: 1.5, waveFreq: 0.6 },
  kuman_thong:   { kind: 'hop', hip: 0.66, neck: 0.45 },
  krasue:        { kind: 'float', waveFrom: 0.45, waveAmp: 2.5 },
  nang_tani:     { kind: 'float', waveFrom: 0.55, waveAmp: 2 },
  phi_pob:       { kind: 'biped', hip: 0.7, neck: 0.4, swing: 0.35 },
  phi_jang_nang: { kind: 'glide', waveFrom: 0.55, waveAmp: 2 },
  phi_phrai:     { kind: 'float', waveFrom: 0.5, waveAmp: 3, waveFreq: 0.25 },
  pret:          { kind: 'heavy', hip: 0.55, neck: 0.18, swing: 0.25 },
  saming:        { kind: 'quad', hip: 0.6, neck: 0.02, swing: 0.35 },
  phi_ha:        { kind: 'float', waveFrom: 0.05, waveAmp: 2.5, waveFreq: 0.5 },
  phaya_yak:     { kind: 'heavy', hip: 0.64, neck: 0.25, swing: 0.3 },
  npc_maekha:    { kind: 'biped', hip: 0.72, neck: 0.3, swing: 0.2 },
  // ---- ผีป่าช้า: ภาพ PixelLab ยังไม่มา → ใช้ภาพผีตัวอื่นย้อมสีเป็นตัวแทนชั่วคราว (fallback) ----
  krahang:         { kind: 'float', waveFrom: 0.5, waveAmp: 2, fallback: { from: 'phi_ha', tint: '#8d6e63', scale: 0.9 } },
  khamot:          { kind: 'float', waveFrom: 0.1, waveAmp: 1.5, waveFreq: 0.6, fallback: { from: 'phi_tuay_kaew', tint: '#f5b041' } },
  phi_dip:         { kind: 'heavy', hip: 0.68, neck: 0.4, swing: 0.25, fallback: { from: 'phi_pob', tint: '#7d8f69' } },
  nang_takhian:    { kind: 'float', waveFrom: 0.55, waveAmp: 1.5, fallback: { from: 'nang_tani', tint: '#6e4b2a' } },
  tai_hong:        { kind: 'biped', hip: 0.7, neck: 0.4, swing: 0.4, fallback: { from: 'phi_pob', tint: '#c0392b' } },
  phi_phong:       { kind: 'biped', hip: 0.7, neck: 0.4, swing: 0.35, fallback: { from: 'phi_pob', tint: '#2c3e50' } },
  kong_koi:        { kind: 'hop', hip: 0.66, neck: 0.45, fallback: { from: 'kuman_thong', tint: '#4e342e', scale: 1.1 } },
  phi_lang_kluang: { kind: 'float', waveFrom: 0.55, waveAmp: 2, fallback: { from: 'phi_phrai', tint: '#d7bde2' } },
  phi_chamot:      { kind: 'quad', hip: 0.6, neck: 0.02, swing: 0.3, fallback: { from: 'saming', tint: '#1e8449' } },
  pret_asura:      { kind: 'heavy', hip: 0.55, neck: 0.18, swing: 0.22, fallback: { from: 'pret', tint: '#922b21', scale: 1.25 } },
};

/** ภาพตัวแทน: ย้อมสี (+ย่อ/ขยาย) ภาพผีตัวอื่น ใช้ระหว่างรอภาพจริง */
export function tintedCopy(src, tint, scale = 1) {
  const w = Math.round(src.width * scale), h = Math.round(src.height * scale);
  const { c, ctx } = canvas(w, h);
  ctx.drawImage(src, 0, 0, w, h);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = 0.5; ctx.fillStyle = tint; ctx.fillRect(0, 0, w, h);
  return c;
}
