// ============================================================
//  PlayerArt – ตัวละครผู้เล่นจากภาพ PixelLab "ชาวบ้าน" แบบเดียว (ชาย/หญิง)
//  ▸ อาวุธที่สวมวาดในมือ (ใช้ภาพไอคอนไอเทม) · ชุดเกราะเปลี่ยนสีเสื้อผ้า
//  ▸ ย้อมสีชุด/ผมตามที่ผู้เล่นเลือก:
//      ภาพต้นฉบับใช้ "ชุดสีบานเย็น (magenta)" และ "ผมสีฟ้า (cyan)" เป็นสีคีย์
//      โค้ดจะหาพิกเซลสีคีย์แล้วแทนด้วยสีที่เลือก โดยคงแสงเงาเดิมไว้
//  ▸ สร้างท่าทางจากภาพนิ่ง: idle / walk / attack / hit / die / jump
// ============================================================
import { OUTFITS, HAIRSTYLES } from '/shared/data/appearance.js';
import { ITEMS } from '/shared/data/items.js';
import { JOBS } from '/shared/data/classes.js';
import { CHAR_ANIMS } from './CharacterArt.js';
import { buildRig, drawRig, poseFor } from './Rig.js';

export const PAD_X = 12, PAD_TOP = 6;
export const baseKey = (a) => `pbase_villager_${a.gender}`;
export const legacyBaseKey = (a) => `pbase_${a.job}_${a.gender}`;
/** ตำแหน่งมือหน้า (สัดส่วนของภาพที่ตัดขอบแล้ว) */
const HAND = { male: [0.84, 0.6], female: [0.88, 0.62] };
/** จุดจับในภาพไอคอนอาวุธ 48px + ขนาดที่ถือ */
const GRIP = {
  wood_sword: { g: [9, 39], s: 0.52 }, iron_dab: { g: [23, 42], s: 0.55, r: 0.7 },
  oak_staff: { g: [23, 30], s: 0.95, ox: 2 }, yant_staff: { g: [24, 30], s: 0.95, ox: 2 },
  bamboo_bow: { g: [26, 24], s: 0.72, ox: 4, oy: -5 }, horn_bow: { g: [27, 24], s: 0.72, ox: 4, oy: -5 },
};
const WTYPE_GRIP = { sword: GRIP.wood_sword, staff: GRIP.oak_staff, bow: GRIP.bamboo_bow };
/** มุมเหวี่ยงอาวุธระหว่างท่าโจมตี 6 เฟรม */
const SWING = { sword: [-0.7, -1.0, 0.2, 0.9, 0.7, 0.2], staff: [-0.25, -0.4, 0.05, 0.4, 0.25, 0.05], bow: [0, 0, 0, 0, 0, 0] };

/** จุดวางชุดแต่งตัว: g = จุดยึดในภาพไอคอน 48px, s = ขนาด, at = ตำแหน่งบนตัว (สัดส่วนของภาพตัวละคร) */
const WEAR = {
  head: { g: [24, 44], s: 0.46, at: [0.47, 0.13] },
  face: { g: [24, 24], s: 0.42, at: [0.62, 0.15] },
  back: { g: [24, 24], s: 0.62, at: [0.28, 0.42] },
};
/** ชุดแต่งตัวที่ต้องวาดทับตัว → { headwear: [...], back } (ใช้ภาพไอคอนไอเทม) */
export function wearInfo(a, getImg) {
  const out = { headwear: [], back: null };
  for (const slot of ['back', 'head', 'face']) {
    const id = a.costume?.[slot], img = id && getImg(`ico_it_${id}`);
    if (!img) continue;
    const w = { ...WEAR[slot], ...(ITEMS[id].wear || {}) };
    const part = { img, gx: w.g[0], gy: w.g[1], scale: w.s, at: w.at, rot0: w.r || 0 };
    if (slot === 'back') out.back = part; else out.headwear.push(part);
  }
  return out;
}

/** แสงเรืองของอุปกรณ์ตีบวก: สีเปลี่ยนตามช่วงขั้น ความแรงเพิ่มทุกขั้น (lv 1–20) */
export function enhGlow(lv) {
  if (!lv) return null;
  const color = lv >= 20 ? '255,255,255' : lv >= 16 ? '255,90,60' : lv >= 13 ? '255,215,80' : lv >= 10 ? '190,120,255' : lv >= 7 ? '90,180,255' : lv >= 4 ? '120,230,200' : '235,235,235';
  return { color, blur: 2 + lv * 0.35, alpha: Math.min(1, 0.25 + lv * 0.04), lv };
}

/** ข้อมูลอาวุธในมือ (null = มือเปล่า/ผ้าพันมือ) */
export function heldInfo(a, img) {
  const it = ITEMS[a.weapon];
  if (!img || !it || it.wtype === 'wraps') return null;
  const gp = GRIP[a.weapon] || WTYPE_GRIP[it.wtype];
  return { img, wtype: it.wtype, gx: gp.g[0], gy: gp.g[1], scale: gp.s, rot0: gp.r || 0, ox: gp.ox || 0, oy: gp.oy || 0, glow: enhGlow(a.wenh) };
}

// ---------------- สี ----------------
function hexToRgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslToRgb(h, s, l) {
  h /= 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}
const isCloth = (h, s, l) => s > 0.25 && l > 0.08 && l < 0.94 && h >= 262 && h <= 350;
const isHair = (h, s, l) => s > 0.25 && l > 0.08 && l < 0.94 && h >= 160 && h <= 245;

/** ย้อมสีภาพต้นฉบับตามรูปลักษณ์ → canvas ที่ตัดขอบโปร่งใสแล้ว */
export function recolorBase(img, a, legacy = false) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const px = data.data;
  const hsl = [];
  const cloth = [], hair = [];
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 60) { px[i + 3] = 0; continue; }
    const v = rgbToHsl(px[i], px[i + 1], px[i + 2]);
    hsl[i] = v;
    if (isCloth(...v)) cloth.push(i); else if (isHair(...v)) hair.push(i);
  }
  const outfit = ITEMS[a.costume?.outfit]?.look || ITEMS[a.armor]?.look || OUTFITS[a.outfit], hairCol = HAIRSTYLES[a.hair].color;
  const paint = (list, pickHex) => {
    if (!list.length) return;
    const meanL = list.reduce((s, i) => s + hsl[i][2], 0) / list.length;
    for (const i of list) {
      const [th, ts, tl] = rgbToHsl(...hexToRgb(pickHex(i)));
      const l = Math.max(0.03, Math.min(0.97, tl + (hsl[i][2] - meanL) * 0.9));
      const [r, g, b] = hslToRgb(th, ts, l);
      px[i] = r; px[i + 1] = g; px[i + 2] = b;
    }
  };
  // เสื้อ (ครึ่งบนของบริเวณชุด) / กางเกง-ผ้าถุง (ครึ่งล่าง)  นักมวยใช้สีกางเกงอย่างเดียว
  const ys = cloth.map((i) => (i / 4 / c.width) | 0);
  const split = ys.length ? Math.min(...ys) + (Math.max(...ys) - Math.min(...ys)) * 0.5 : 0;
  paint(cloth, (i) => (!(legacy && a.job === 'boxer') && ((i / 4 / c.width) | 0) < split ? outfit.top : outfit.bottom));
  paint(hair, () => hairCol);
  ctx.putImageData(data, 0, 0);

  // ตัดขอบโปร่งใส
  let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    if (px[(y * c.width + x) * 4 + 3]) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  }
  const t = document.createElement('canvas');
  t.width = x1 - x0 + 1; t.height = y1 - y0 + 1;
  t.getContext('2d').drawImage(c, x0, y0, t.width, t.height, 0, 0, t.width, t.height);
  return t;
}

// ---------------- เฟรมท่าทาง ----------------
/** จำนวนเฟรมของตัวละคร PixelLab (ละเอียดกว่าแบบวาดด้วยโค้ด) */
export const PLAYER_ANIMS = {
  idle:   { frames: 6, rate: 6,  repeat: -1 },
  walk:   { frames: 8, rate: 12, repeat: -1 },
  attack: { frames: 6, rate: 18, repeat: 0 },   // เฟรมที่ 4 (index 3) = จังหวะโดนเป้า
  hit:    { frames: 3, rate: 10, repeat: 0 },
  die:    { frames: 6, rate: 7,  repeat: 0 },
  jump:   { frames: 2, rate: 6,  repeat: -1 },
};
export const STRIKE_FRAME = { 4: 3, 6: 4 };  // จำนวนเฟรมท่าโจมตี → เฟรม (1-based) ที่ตีโดน

// ท่าสกิล (ตามประเภทสกิล) + ท่าตกปลา
Object.assign(PLAYER_ANIMS, {
  cast:  { frames: 6, rate: 12, repeat: 0 },   // ร่ายเวท: ยกไม้เท้า วงอาคมที่เท้า
  shoot: { frames: 6, rate: 14, repeat: 0 },   // ง้างธนูเต็มแรง
  spin:  { frames: 6, rate: 16, repeat: 0 },   // หมุนตัวฟันรอบ
  kick:  { frames: 6, rate: 16, repeat: 0 },   // เตะสูง
  dash:  { frames: 4, rate: 14, repeat: 0 },   // พุ่ง + ภาพติดตา
  buff:  { frames: 6, rate: 10, repeat: 0 },   // ชูแขนรับพลัง
  slam:  { frames: 6, rate: 12, repeat: 0 },   // กระโดดทุ่มลงพื้น (ท่าไม้ตาย)
  fish_cast: { frames: 6, rate: 12, repeat: 0 },
  fish_idle: { frames: 4, rate: 3, repeat: -1 },
  fish_reel: { frames: 4, rate: 12, repeat: -1 },
  gather:    { frames: 4, rate: 5,  repeat: -1 },   // ย่อตัวเก็บสมุนไพร/เปิดหีบ (เก็บอาวุธ)
});
/** ท่าที่มีจังหวะ "ตีโดน" (เรียก playerStrike ที่เฟรม STRIKE_FRAME) */
export const STRIKE_ANIMS = new Set(['attack', 'cast', 'shoot', 'spin', 'kick', 'slam']);
/** เว้นที่ด้านบนเฟรม (กระโดด/ชูแขน) */
export const PLAYER_PAD_TOP = 14;

/** เลือกท่าตามสกิล */
export function skillAnim(sk) {
  if (sk.anim) return sk.anim;
  const job = sk.job;
  if (sk.type === 'buff') return 'buff';
  if (sk.type === 'dash') return sk.leap ? 'slam' : 'dash';
  if (sk.type === 'strike') return 'cast';
  if (sk.type === 'projectile' || sk.type === 'aoe') return job === 'archer' ? 'shoot' : job === 'mage' ? 'cast' : 'spin';
  if (sk.type === 'melee') return job === 'swordman' ? 'spin' : sk.knock ? 'kick' : 'attack';
  return 'attack';
}

// ท่าสกิล: pose ต่อเฟรม + มุมอาวุธในมือ (rot) + เอฟเฟกต์
const SKILL_POSES = {
  cast: { p: [{ lean: -0.05, torsoSy: 1.02, head: -0.05 }, { lean: -0.12, torsoSy: 1.05, head: -0.12, dy: -1 }, { lean: -0.16, torsoSy: 1.07, head: -0.16, dy: -2 },
    { lean: 0.1, sx: 1.04, dy: -1 }, { lean: 0.14 }, { lean: 0.04 }], r: [0.1, -0.15, -0.25, 0.7, 0.5, 0.15] },
  shoot: { p: [{ dx: -1, lean: -0.08, back: 0.2, front: -0.15 }, { dx: -2, lean: -0.16, back: 0.3, front: -0.2, head: -0.06 }, { dx: -2, lean: -0.18, back: 0.32, front: -0.22, head: -0.08 },
    { dx: -4, lean: -0.05, sx: 1.04 }, { dx: -3, lean: -0.1 }, { lean: 0 }], r: [-0.1, -0.25, -0.3, 0, 0, 0] },
  spin: { p: [{ lean: -0.15, front: 0.2, back: -0.1 }, { sx: 0.55, lean: 0.05 }, { sx: -1, lean: 0.1 }, { sx: -0.55, lean: 0.1 }, { sx: 1, lean: 0.22, dx: 3, front: -0.4, back: 0.3 }, { lean: 0.05 }],
    r: [-1.2, -0.4, 0.4, 1.2, 0.9, 0.2] },
  kick: { p: [{ lean: -0.1, front: 0.2 }, { lean: -0.25, front: -0.9, frontLift: 4 }, { lean: -0.35, front: -1.5, frontLift: 8, dx: 3 },
    { lean: -0.3, front: -1.4, frontLift: 7, dx: 4, sx: 1.05 }, { lean: -0.15, front: -0.6, frontLift: 3 }, { lean: 0 }], r: [0, 0, 0, 0, 0, 0] },
  dash: { p: [{ lean: 0.35, dx: 2, front: -0.6, back: 0.6 }, { lean: 0.5, dx: 6, front: -0.8, back: 0.8, sy: 0.95 }, { lean: 0.5, dx: 8, front: -0.8, back: 0.8 }, { lean: 0.2, dx: 4 }],
    r: [0.9, 1.1, 1.1, 0.6] },
  buff: { p: [{ torsoSy: 1.02, head: -0.05 }, { dy: -1, torsoSy: 1.05, head: -0.18, lean: -0.08 }, { dy: -3, torsoSy: 1.07, head: -0.22, lean: -0.1, tint: 'rgba(255,235,150,0.16)' },
    { dy: -3, torsoSy: 1.07, head: -0.2, lean: -0.1, tint: 'rgba(255,235,150,0.24)' }, { dy: -1, torsoSy: 1.03 }, {}], r: [-0.4, -1.3, -1.5, -1.5, -0.8, -0.2] },
  slam: { p: [{ sy: 0.92, lean: -0.1, front: 0.2, back: -0.2 }, { dy: -10, sy: 1.05, lean: -0.15, front: -0.5, back: 0.4, frontLift: 3, backLift: 2 },
    { dy: -14, lean: 0.2, front: -0.6, back: 0.5, frontLift: 3 }, { sy: 0.86, sx: 1.1, lean: 0.4, front: -0.5, back: 0.5 }, { sy: 0.94, lean: 0.25 }, { lean: 0.05 }],
    r: [-1.3, -1.5, -0.5, 1.3, 1.1, 0.4] },
  fish_cast: { p: [{ lean: -0.12, head: -0.05 }, { lean: -0.2, head: -0.1 }, { lean: 0.05 }, { lean: 0.2, dx: 2 }, { lean: 0.12 }, { lean: 0.05 }],
    r: [-2.4, -2.7, -1.5, -0.5, -0.7, -0.85] },
};
const STYLE_FX = { staff: '88,214,141', sword: '249,231,159', bow: '174,214,241', wraps: '245,176,65' };

/** คันเบ็ด (วาดครั้งเดียว) */
let ROD = null;
function rodImage() {
  if (ROD) return ROD;
  const c = document.createElement('canvas'); c.width = 26; c.height = 4;
  const g = c.getContext('2d');
  g.fillStyle = '#3e2723'; g.fillRect(0, 1, 8, 2);                        // ด้ามจับ
  g.fillStyle = '#8d6e63'; g.fillRect(8, 1, 12, 2);
  g.fillStyle = '#bcaaa4'; g.fillRect(20, 1.5, 6, 1);                     // ปลายคัน
  g.fillStyle = '#d4af37'; g.fillRect(5, 0, 2, 4);                        // รอกทอง
  ROD = c;
  return c;
}

function ring(ctx, x, y, rx, ry, rgb, a, w = 1) {
  ctx.save(); ctx.strokeStyle = `rgba(${rgb},${a})`; ctx.lineWidth = w;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
}

/** เอฟเฟกต์ของท่าสกิล (วาดทับหลังตัวละคร) */
function skillFx(ctx, anim, i, weapon, footX, footY, W, H, dx) {
  const rgb = STYLE_FX[weapon] || STYLE_FX.sword, cy = footY - H * 0.55;
  ctx.save();
  if (anim === 'cast' && i >= 1 && i <= 4) {                              // วงอาคมที่เท้า + ประกายปลายไม้เท้า
    const k = i / 4;
    ring(ctx, footX, footY - 1, 10 + k * 12, 3 + k * 2, rgb, 0.9 - k * 0.3, 1.5);
    ring(ctx, footX, footY - 1, 6 + k * 8, 2 + k, rgb, 0.6, 1);
    for (let n = 0; n < 6; n++) { const a = n * 1.05 + i; ctx.fillStyle = `rgba(${rgb},0.9)`; ctx.fillRect(footX + Math.cos(a) * (10 + k * 12) - 0.5, footY - 1 + Math.sin(a) * (3 + k * 2) - 4 * k, 1.5, 1.5); }
    if (i === 3) { ctx.fillStyle = `rgba(${rgb},0.55)`; ctx.beginPath(); ctx.arc(footX + W * 0.45 + dx, cy - H * 0.35, 6, 0, 7); ctx.fill(); }
  } else if (anim === 'shoot' && i >= 1 && i <= 3) {                      // สายธนูตึง → ปล่อยลูกเรืองแสง
    if (i < 3) { ctx.fillStyle = `rgba(${rgb},0.5)`; ctx.fillRect(footX + W * 0.3 + dx, cy - 3, 3, 6); }
    else { ctx.fillStyle = `rgba(255,255,255,0.95)`; ctx.fillRect(footX + W * 0.4 + dx, cy - 1, 18, 1.5); ctx.fillStyle = `rgba(${rgb},0.6)`; ctx.fillRect(footX + W * 0.35 + dx, cy - 3, 12, 5); }
  } else if (anim === 'spin' && i >= 1 && i <= 4) {                       // วงฟันรอบตัว
    ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(${rgb},0.7)`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(footX + dx, cy, W * 0.9, H * 0.28, 0, i * 1.4, i * 1.4 + 3.6); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(footX + dx, cy, W * 0.9, H * 0.28, 0, i * 1.4 + 0.6, i * 1.4 + 3.4); ctx.stroke();
  } else if (anim === 'kick' && (i === 2 || i === 3)) {
    const ix = footX + W * 0.55 + dx, iy = footY - H * 0.62, s = 3 + (i - 2) * 3;
    ctx.fillStyle = '#f9e79f'; ctx.beginPath();
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, rr = k % 2 ? s * 0.45 : s; ctx.lineTo(ix + Math.cos(a) * rr, iy + Math.sin(a) * rr); }
    ctx.fill();
  } else if (anim === 'dash') {                                            // เส้นความเร็ว
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    for (let k = 0; k < 4; k++) ctx.fillRect(footX - W * 0.6 + dx - k * 4 - i * 2, footY - H * (0.25 + k * 0.17), 8 + i * 2, 1);
  } else if (anim === 'buff' && i >= 1 && i <= 4) {                        // แสงพุ่งขึ้น + วงทอง
    for (let k = 0; k < 5; k++) { ctx.fillStyle = `rgba(255,230,140,${0.5 - k * 0.07})`; ctx.fillRect(footX - W * 0.5 + k * W * 0.25, footY - H * (0.3 + (i + k) % 4 * 0.2), 1.5, 4 + i); }
    ring(ctx, footX, footY - 1, 12 + i * 2, 3 + i * 0.5, '255,230,140', 0.8);
  } else if (anim === 'slam' && i >= 3) {                                  // คลื่นกระแทก
    const k = (i - 2) / 3;
    ring(ctx, footX + dx, footY - 1, 12 + k * 22, 2.5 + k * 3, '245,176,65', 1 - k * 0.6, 2);
    ring(ctx, footX + dx, footY - 1, 6 + k * 14, 1.5 + k * 2, '255,255,255', 0.8 - k * 0.5, 1);
    ctx.fillStyle = 'rgba(160,120,80,0.6)';
    for (let n = 0; n < 6; n++) ctx.fillRect(footX + dx + (n - 2.5) * (6 + k * 6), footY - 2 - (n % 2) * 3 * (1 - k), 2, 2);
  }
  ctx.restore();
}

/**
 * วาดภาพต้นฉบับเป็น 2 ส่วน (ลำตัว / ขา) พร้อม transform แยก
 *  o = { dx, dy, lean (เอียงลำตัว), legShear (เหวี่ยงขา), sx, sy (ยืด-ยุบ), rot }
 */
function drawPosed(ctx, base, bx, by, o = {}) {
  const { dx = 0, dy = 0, lean = 0, legShear = 0, sx = 1, sy = 1, rot = 0, legSplit = 0 } = o;
  const W = base.width, H = base.height;
  const hip = Math.round(H * 0.64);
  const footX = bx + W / 2 + dx, footY = by + H + dy;
  ctx.save();
  ctx.translate(footX, footY);
  if (rot) ctx.rotate(rot);
  ctx.scale(sx, sy);
  ctx.translate(-W / 2, -H);
  // ขา: เฉือนรอบสะโพก (เท้าเหวี่ยงไปหน้า-หลัง)
  if (legSplit) {
    // ก้าวยาว: วาดขาหลังเข้มกว่า เยื้องไปด้านหลัง แล้ววาดขาหน้าเยื้องไปด้านหน้า
    ctx.save(); ctx.transform(1, 0, -legSplit / (H - hip), 1, legSplit * hip / (H - hip), 0);
    ctx.globalAlpha = 0.9; ctx.filter = 'brightness(0.7)';
    ctx.drawImage(base, 0, hip, W, H - hip, 0, hip, W, H - hip);
    ctx.restore();
    ctx.save(); ctx.transform(1, 0, legSplit / (H - hip), 1, -legSplit * hip / (H - hip), 0);
    ctx.drawImage(base, 0, hip, W, H - hip, 0, hip, W, H - hip);
    ctx.restore();
  } else {
    ctx.save(); ctx.transform(1, 0, legShear, 1, -legShear * hip, 0);
    ctx.drawImage(base, 0, hip, W, H - hip, 0, hip, W, H - hip);
    ctx.restore();
  }
  // ลำตัว+หัว: เอียงรอบสะโพก (lean > 0 = โน้มไปด้านหน้า)
  ctx.save(); ctx.transform(1, 0, -lean, 1, lean * hip, 0);
  ctx.drawImage(base, 0, 0, W, hip + 1, 0, 0, W, hip + 1);
  ctx.restore();
  ctx.restore();
}

function tintFrame(ctx, FW, FH, color) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = color; ctx.fillRect(0, 0, FW, FH);
  ctx.restore();
}

function shadow(ctx, cx, FH, w, a = 0.28) {
  ctx.save(); ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = `rgba(0,0,0,${a})`;
  ctx.beginPath(); ctx.ellipse(cx, FH - 1.5, w, 1.6, 0, 0, 7); ctx.fill();
  ctx.restore();
}

/** เอฟเฟกต์ประจำอาวุธ – t = ความคืบหน้าของการฟัน (0..1) */
function weaponFx(ctx, weapon, cx, cy, W, H, t) {
  ctx.save();
  if (weapon === 'sword') {                      // ดาบคู่: รอยฟันโค้งสีทอง-ขาว 2 ชั้น
    const r = H * 0.5, a0 = -1.9 + t * 1.2, a1 = a0 + 1.9;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(249,231,159,0.55)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, r, a0 + 0.2, a1); ctx.stroke();
    ctx.strokeStyle = 'rgba(174,214,241,0.7)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx - 2, cy + 2, r * 0.75, a0 + 0.5, a1 - 0.1); ctx.stroke();
  } else if (weapon === 'staff') {               // ไม้เท้ากะโหลกหมอผี: ไฟวิญญาณสีเขียว + วงอาคม
    const ox = cx + W * 0.45, oy = cy - H * 0.3, rr = 3 + t * 5;
    ctx.fillStyle = `rgba(88,214,141,${0.55 - t * 0.3})`; ctx.beginPath(); ctx.arc(ox, oy, rr, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(165,105,189,0.5)'; ctx.fillRect(ox - 1, oy - rr - 4, 2, 3); ctx.fillRect(ox + rr, oy - 2, 3, 2);
    ctx.strokeStyle = 'rgba(171,235,198,0.9)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(ox, oy, rr + 2, 0, 7); ctx.stroke();
    for (let k = 0; k < 4; k++) { const a = k * 1.57 + t * 2; ctx.fillStyle = '#fdfefe'; ctx.fillRect(ox + Math.cos(a) * (rr + 2) - 0.5, oy + Math.sin(a) * (rr + 2) - 0.5, 1.5, 1.5); }
  } else if (weapon === 'bow') {                 // ธนู: สายสะบัด + ลมพุ่ง
    ctx.fillStyle = 'rgba(253,254,254,0.9)';
    ctx.fillRect(cx + W * 0.4, cy - 2, 10 + t * 6, 1);
    ctx.fillStyle = 'rgba(214,234,248,0.6)';
    ctx.fillRect(cx + W * 0.35, cy - 5, 6, 1); ctx.fillRect(cx + W * 0.35, cy + 2, 6, 1);
  } else {                                       // หมัดคาดเชือก: ดาวกระแทก
    const ix = cx + W * 0.5, iy = cy - 1, s = 3 + t * 3;
    ctx.fillStyle = '#f9e79f';
    ctx.beginPath();
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, rr = k % 2 ? s * 0.45 : s; ctx.lineTo(ix + Math.cos(a) * rr, iy + Math.sin(a) * rr); }
    ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(ix - 1, iy - 1, 2, 2);
  }
  ctx.restore();
}

/**
 * วาดเฟรม: ctx อยู่ในพื้นที่ FW×FH, base = ภาพที่ย้อมสีแล้ว
 */
/** การตั้งค่าหุ่นตามอาวุธ/อาชีพ (มุมเหวี่ยงขา, จุดสะโพก) */
const PLAYER_RIG = {
  sword: { hip: 0.62, neck: 0.3, swing: 0.45 },
  staff: { hip: 0.66, neck: 0.3, swing: 0.16 },     // เสื้อคลุมยาว: ก้าวสั้น
  bow:   { hip: 0.62, neck: 0.3, swing: 0.45 },
  wraps: { hip: 0.6,  neck: 0.3, swing: 0.5 },
};

/** ท่าโจมตีเฉพาะอาวุธ (6 เฟรม) – ใช้กับหุ่นตัดต่อ */
const ATTACK_POSES = {
  sword: [{ dx: -2, lean: -0.2, sy: 0.96, front: 0.15, back: -0.1, head: -0.08 }, { dx: -3, lean: -0.32, sy: 0.94, front: 0.3, back: -0.2 },
          { dx: 3, lean: 0.25, front: -0.5, back: 0.35 }, { dx: 7, lean: 0.4, sx: 1.05, front: -0.6, back: 0.5 },
          { dx: 6, lean: 0.3, front: -0.45, back: 0.4 }, { dx: 2, lean: 0.08, front: -0.1, back: 0.1 }],
  staff: [{ lean: -0.08, torsoSy: 1.04, head: -0.1 }, { dx: -1, lean: -0.16, torsoSy: 1.07, head: -0.15 }, { dx: 1, lean: 0.06 },
          { dx: 3, lean: 0.16, sx: 1.04, sy: 0.97 }, { dx: 2, lean: 0.1 }, { dx: 0, lean: 0.03 }],
  bow:   [{ dx: -1, lean: -0.06, back: 0.15, front: -0.1 }, { dx: -2, lean: -0.14, back: 0.25, front: -0.15, head: -0.05 },
          { dx: -3, lean: -0.18, back: 0.3, front: -0.2 }, { dx: -1, lean: -0.02, sx: 1.03 }, { dx: -2, lean: -0.08 }, { lean: 0 }],
  wraps: [{ dx: -1, lean: -0.1, front: 0.2, back: -0.15 }, { dx: 2, lean: 0.12, front: -0.35, back: 0.3 },
          { dx: 5, lean: 0.25, front: -0.55, back: 0.45, sx: 1.05 }, { dx: 8, lean: 0.38, front: -0.7, back: 0.55, sx: 1.1, sy: 0.95 },
          { dx: 5, lean: 0.2, front: -0.4, back: 0.3 }, { dx: 1, lean: 0.05 }],
};

function playerRigFrame(ctx, base, anim, i, weapon, FW, FH, held, wear, glow = null) {
  const cfg = PLAYER_RIG[weapon] || PLAYER_RIG.sword;
  base._rig ||= buildRig(base, cfg);
  const rig = base._rig, W = rig.W, H = rig.H;
  const footX = FW / 2, footY = FH - 2, cy = footY - H * 0.55;
  let pose;
  if (anim === 'idle') {
    const t = (i / 6) * Math.PI * 2;
    pose = { torsoSy: 1 + Math.sin(t) * 0.025, head: Math.sin(t) * 0.03, lean: weapon === 'wraps' ? 0.08 + Math.sin(t) * 0.04 : Math.sin(t) * 0.02,
      front: weapon === 'wraps' ? -0.12 : 0, back: weapon === 'wraps' ? 0.12 : 0, dy: weapon === 'wraps' ? Math.round(Math.sin(t * 2)) : 0 };
  } else if (anim === 'walk') {
    pose = poseFor('biped', 'walk', i, { swing: cfg.swing });
  } else if (anim === 'attack') {
    pose = (ATTACK_POSES[weapon] || ATTACK_POSES.sword)[i] || {};
  } else if (anim === 'hit') {
    pose = [{ dx: -3, lean: -0.32, sx: 0.95, tint: 'rgba(255,255,255,0.8)', front: 0.2, back: -0.1 },
            { dx: -4, lean: -0.2, tint: 'rgba(255,60,60,0.4)' }, { dx: -2, lean: -0.08, tint: 'rgba(255,60,60,0.15)' }][i];
  } else if (SKILL_POSES[anim]) {
    pose = SKILL_POSES[anim].p[i] || {};
  } else if (anim === 'fish_idle') {
    const t = (i / 4) * Math.PI * 2;
    pose = { torsoSy: 1 + Math.sin(t) * 0.015, head: Math.sin(t) * 0.02, lean: 0.04 };
  } else if (anim === 'fish_reel') {
    pose = { lean: -0.1 - 0.06 * (i % 2), dx: -(i % 2), back: 0.12, front: -0.05 };
  } else if (anim === 'gather') {
    // ย่อเข่า ก้มตัว มือควานหาของที่พื้น (โยกซ้าย-ขวาเบา ๆ)
    const k = i % 2;
    pose = { sy: 0.8, sx: 1.04, lean: 0.5 + k * 0.06, head: 0.25 + k * 0.05, dy: 1, dx: 2 + k, front: -0.55, back: 0.45, frontLift: 4, backLift: 1, torsoSy: 0.96 };
  } else if (anim === 'jump') {
    pose = i === 0 ? { dy: -2, sy: 1.05, sx: 0.96, front: -0.6, back: 0.5, frontLift: 3, backLift: 2, lean: 0.06 }
                   : { dy: -2, front: -0.3, back: 0.7, frontLift: 2, backLift: 3, lean: 0.1 };
  }
  const hand = HAND[base._gender] || HAND.male;
  if (anim.startsWith('fish')) {                                          // ตกปลา: ถือคันเบ็ดแทนอาวุธ
    const rot = anim === 'fish_cast' ? SKILL_POSES.fish_cast.r[i] : anim === 'fish_reel' ? [-1.2, -1.4, -1.1, -1.35][i] : -0.85 + Math.sin(i * 1.57) * 0.03;
    pose = { ...pose, held: { img: rodImage(), gx: 1, gy: 2, scale: 1, hx: W * hand[0], hy: H * hand[1], rot } };
  } else if (held && anim !== 'gather') {                                   // เก็บของ: ไม่ถืออาวุธ
    const swing = SKILL_POSES[anim] ? SKILL_POSES[anim].r[i] || 0 : anim === 'attack' ? (SWING[held.wtype]?.[i] || 0) : anim === 'walk' ? Math.sin((i / 8) * Math.PI * 2) * 0.12 : 0;
    pose = { ...pose, held: { ...held, hx: W * hand[0] + held.ox, hy: H * hand[1] + held.oy, rot: held.rot0 + swing } };
  }
  if (wear) {                                                               // ชุดแต่งตัว: หมวก/หน้ากาก (ตามหัว) + ของหลัง (ตามลำตัว)
    const place = (w) => ({ ...w, hx: W * w.at[0], hy: H * w.at[1], rot: w.rot0 });
    pose = { ...pose, headwear: wear.headwear.map(place), backWear: wear.back ? place(wear.back) : null };
  }
  if (glow) pose = { ...pose, glow: { ...glow, phase: i } };                // เสื้อตีบวก: ขอบตัวเรืองแสง
  if (anim === 'dash' && i >= 1) drawRig(ctx, rig, { ...pose, dx: (pose.dx || 0) - 9, alpha: 0.3, tint: 'rgba(174,214,241,0.6)' }, footX, footY);   // ภาพติดตา
  drawRig(ctx, rig, pose, footX, footY);
  const dx = pose.dx || 0;
  if (SKILL_POSES[anim] && !anim.startsWith('fish')) skillFx(ctx, anim, i, weapon, footX, footY, W, H, dx);
  if (anim === 'gather') {                                                  // ประกายเขียวที่ปลายมือ
    const gx = footX + W * 0.55 + (i % 2) * 2, gy = footY - H * 0.18 - (i >= 2 ? 2 : 0);
    ctx.save(); ctx.fillStyle = `rgba(130,224,170,${0.5 + (i % 2) * 0.3})`;
    ctx.fillRect(gx, gy, 1, 1); ctx.fillRect(gx + 3, gy - 3, 1, 1); ctx.fillRect(gx - 2, gy - 4 + i, 1, 1); ctx.restore();
  }
  if (anim === 'attack') {
    if (i === 3) weaponFx(ctx, weapon, footX + dx, cy, W, H, 0.3);
    if (i === 4 && weapon !== 'bow') { ctx.globalAlpha = 0.55; weaponFx(ctx, weapon, footX + dx, cy, W, H, 0.9); ctx.globalAlpha = 1; }
    if (i >= 2 && i <= 4 && weapon !== 'staff') {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (let k = 0; k < 3; k++) ctx.fillRect(footX - W / 2 - 6 + dx - k * 2, footY - H * (0.7 - k * 0.18), 5, 1);
    }
  }
  if (anim !== 'jump') shadow(ctx, footX + dx, FH, W * 0.32);
}

export function drawPlayerFrame(ctx, base, anim, i, weapon, FW, FH, held = null, wear = null, glow = null) {
  ctx.imageSmoothingEnabled = false;
  if (anim !== 'die') return playerRigFrame(ctx, base, anim, i, weapon, FW, FH, held, wear, glow);
  const W = base.width, H = base.height;
  const bx = Math.round((FW - W) / 2), by = FH - 2 - H;
  const cx = FW / 2, cy = by + H * 0.45;
  const light = weapon === 'wraps' || weapon === 'bow';
  switch (anim) {
    case 'idle': {        // หายใจ: ยืด-ยุบเบาๆ + ลำตัวโยก
      const t = i / 6 * Math.PI * 2;
      const sy = 1 + Math.sin(t) * 0.02, sx = 1 - Math.sin(t) * 0.012;
      drawPosed(ctx, base, bx, by, { sx, sy, lean: weapon === 'wraps' ? 0.06 + Math.sin(t) * 0.03 : Math.sin(t) * 0.015, dy: 0 });
      shadow(ctx, cx, FH, W * 0.32);
      break;
    }
    case 'walk': {        // วงจรก้าวเท้า 8 เฟรม: ขาเหวี่ยง ลำตัวโน้มหน้า ตัวเด้งขึ้นลง
      const t = i / 8 * Math.PI * 2;
      const stride = Math.sin(t) * (light ? 4 : 3.2);
      const bob = -Math.abs(Math.cos(t)) * 1.5 + 0.5;
      drawPosed(ctx, base, bx, by, { dy: Math.round(bob), lean: 0.07 + Math.abs(Math.sin(t)) * 0.02, legSplit: stride, sy: 1 + Math.abs(Math.cos(t)) * 0.015 });
      shadow(ctx, cx, FH, W * 0.3 + Math.abs(stride) * 0.3);
      break;
    }
    case 'attack': {      // 0-1 ง้าง, 2 พุ่ง, 3 โดน (ยืดสุด+เอฟเฟกต์), 4 ตามแรง, 5 คืนท่า
      const P = {
        sword: [{ dx: -2, lean: -0.12, sx: 0.96, sy: 1.04 }, { dx: -3, lean: -0.18, sx: 0.94, sy: 1.06 }, { dx: 3, lean: 0.12, legSplit: 3 },
                { dx: 6, lean: 0.22, sx: 1.08, sy: 0.95, legSplit: 4 }, { dx: 5, lean: 0.16, legSplit: 3 }, { dx: 1, lean: 0.04 }],
        staff: [{ dx: 0, lean: -0.06, sy: 1.04 }, { dx: -1, lean: -0.1, sy: 1.07, sx: 0.96 }, { dx: 1, lean: 0.05, sy: 1.02 },
                { dx: 2, lean: 0.1, sx: 1.05, sy: 0.97 }, { dx: 1, lean: 0.06 }, { dx: 0, lean: 0.02 }],
        bow:   [{ dx: -1, lean: -0.05 }, { dx: -2, lean: -0.1, sx: 0.97, sy: 1.03 }, { dx: -3, lean: -0.12, sx: 0.96, sy: 1.04 },
                { dx: -1, lean: -0.02, sx: 1.03, sy: 0.98 }, { dx: -2, lean: -0.06 }, { dx: 0, lean: 0 }],
        wraps: [{ dx: -1, lean: -0.05, legSplit: 2 }, { dx: 2, lean: 0.1, legSplit: 3 }, { dx: 5, lean: 0.2, sx: 1.06, legSplit: 4 },
                { dx: 8, lean: 0.28, sx: 1.12, sy: 0.94, legSplit: 5 }, { dx: 5, lean: 0.14, legSplit: 3 }, { dx: 1, lean: 0.05, legSplit: 1 }],
      }[weapon] || [];
      const o = P[i] || {};
      drawPosed(ctx, base, bx, by, o);
      if (i === 3) weaponFx(ctx, weapon, cx + (o.dx || 0), cy, W, H, 0.3);
      if (i === 4 && weapon !== 'bow') { ctx.globalAlpha = 0.55; weaponFx(ctx, weapon, cx + (o.dx || 0), cy, W, H, 0.9); ctx.globalAlpha = 1; }
      if (i >= 2 && i <= 4 && weapon !== 'staff') {        // เส้นความเร็วด้านหลัง
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        for (let k = 0; k < 3; k++) ctx.fillRect(bx - 6 + (o.dx || 0) - k * 2, by + H * (0.3 + k * 0.18), 5, 1);
      }
      shadow(ctx, cx + (o.dx || 0), FH, W * 0.32);
      break;
    }
    case 'hit': {         // สะดุ้งถอยหลัง แฟลชขาว → แดง
      const o = [{ dx: -3, lean: -0.2, sx: 0.94, sy: 1.04 }, { dx: -4, lean: -0.14 }, { dx: -2, lean: -0.05 }][i];
      drawPosed(ctx, base, bx, by, o);
      tintFrame(ctx, FW, FH, ['rgba(255,255,255,0.75)', 'rgba(255,60,60,0.45)', 'rgba(255,60,60,0.2)'][i]);
      shadow(ctx, cx + o.dx, FH, W * 0.3);
      break;
    }
    case 'die': {         // เซ → ทรุดเข่า → ล้มหงาย → นอนราบ → จางหาย
      if (i <= 1) {
        drawPosed(ctx, base, bx, by, [{ dx: -2, lean: -0.15 }, { dx: -2, sy: 0.86, sx: 1.06, lean: 0.2 }][i]);
        if (i === 0) tintFrame(ctx, FW, FH, 'rgba(255,255,255,0.5)');
      } else {
        const ang = [-40, -70, -90, -90][i - 2] * Math.PI / 180;
        const pivot = bx + W * 0.8 + (FW - 4 - bx - W * 0.8) * ((i - 2) / 3);
        // ยกจุดหมุนขึ้นให้ส่วนที่ต่ำที่สุดของร่างแตะพื้นพอดี (ไม่จมหายใต้กรอบ)
        const sn = Math.sin(ang), cs = Math.cos(ang);
        const lowest = Math.max(...[-W * 0.8, W * 0.2].flatMap((x) => [-H * 0.92, 0].map((y) => x * sn + y * cs)));
        ctx.save();
        ctx.translate(Math.min(pivot, FW - 2 - Math.max(0, H * 0.92 * Math.abs(sn) - W * 0.8)), FH - 2 - lowest);
        ctx.rotate(ang);
        ctx.globalAlpha = [1, 1, 0.85, 0.5][i - 2];
        ctx.drawImage(base, -W * 0.8, -H * 0.92, W, H * 0.92);
        ctx.restore();
        if (i === 5) tintFrame(ctx, FW, FH, 'rgba(120,120,160,0.35)');
      }
      shadow(ctx, cx, FH, W * 0.4, 0.2);
      break;
    }
    case 'jump': {        // ยืดตัวขึ้น ขาพับ
      drawPosed(ctx, base, bx, by - 2, i === 0 ? { sy: 1.06, sx: 0.95, legShear: -0.25, lean: 0.05 } : { sy: 1.02, legShear: -0.35, lean: 0.08 });
      break;
    }
  }
}

export function frameSize(base) {
  return { FW: Math.max(base.width + 34, base.height + 12), FH: base.height + 7 + PLAYER_PAD_TOP };
}

export { CHAR_ANIMS };
export const weaponOf = (a) => JOBS[a.job].weapon;
