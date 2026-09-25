// ============================================================
//  PlayerArt – ตัวละครผู้เล่นจากภาพ PixelLab (อาชีพ × เพศ = 8 ภาพ)
//  ▸ ย้อมสีชุด/ผมตามที่ผู้เล่นเลือก:
//      ภาพต้นฉบับใช้ "ชุดสีบานเย็น (magenta)" และ "ผมสีฟ้า (cyan)" เป็นสีคีย์
//      โค้ดจะหาพิกเซลสีคีย์แล้วแทนด้วยสีที่เลือก โดยคงแสงเงาเดิมไว้
//  ▸ สร้างท่าทางจากภาพนิ่ง: idle / walk / attack / hit / die / jump
// ============================================================
import { OUTFITS, HAIRSTYLES } from '/shared/data/appearance.js';
import { JOBS } from '/shared/data/classes.js';
import { CHAR_ANIMS } from './CharacterArt.js';

export const PAD_X = 12, PAD_TOP = 6;
export const baseKey = (a) => `pbase_${a.job}_${a.gender}`;

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
export function recolorBase(img, a) {
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
  const outfit = OUTFITS[a.outfit], hairCol = HAIRSTYLES[a.hair].color;
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
  paint(cloth, (i) => (a.job !== 'boxer' && ((i / 4 / c.width) | 0) < split ? outfit.top : outfit.bottom));
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
function drawLegsShift(ctx, base, x, y, dx) {
  const cut = Math.round(base.height * 0.68);
  ctx.drawImage(base, 0, 0, base.width, cut, x, y, base.width, cut);
  ctx.drawImage(base, 0, cut, base.width, base.height - cut, x + dx, y + cut, base.width, base.height - cut);
}

function fx(ctx, weapon, cx, cy, w, h, kind) {
  ctx.save();
  if (kind === 'slash') {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, h * 0.42, -1.2, 0.9); ctx.stroke();
    ctx.strokeStyle = 'rgba(174,214,241,0.7)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, h * 0.36, -1.0, 0.8); ctx.stroke();
  } else if (kind === 'cast') {
    ctx.fillStyle = 'rgba(175,122,197,0.5)'; ctx.beginPath(); ctx.arc(cx + w * 0.35, cy - h * 0.25, 5, 0, 7); ctx.fill();
    ctx.fillStyle = '#f5eef8'; ctx.fillRect(cx + w * 0.35 - 1, cy - h * 0.25 - 1, 2, 2);
  } else if (kind === 'impact') {
    ctx.fillStyle = '#f9e79f';
    ctx.fillRect(cx + w * 0.42, cy - 1, 5, 2); ctx.fillRect(cx + w * 0.42 + 2, cy - 3, 2, 6);
  } else if (kind === 'twang') {
    ctx.fillStyle = 'rgba(253,254,254,0.9)'; ctx.fillRect(cx + w * 0.4, cy - 2, 8, 1);
  }
  ctx.restore();
}

/**
 * วาดเฟรม: ctx อยู่ในพื้นที่ FW×FH, base = ภาพที่ย้อมสีแล้ว
 */
export function drawPlayerFrame(ctx, base, anim, i, weapon, FW, FH) {
  ctx.imageSmoothingEnabled = false;
  const bx = Math.round((FW - base.width) / 2), by = FH - 1 - base.height;
  const cx = FW / 2, cy = by + base.height * 0.45;
  switch (anim) {
    case 'idle': ctx.drawImage(base, bx, by + [0, 0, 1, 1][i]); break;
    case 'walk': {
      const s = [0, 1, 2, 0, -1, -2][i];
      drawLegsShift(ctx, base, bx, by + (i % 3 === 1 ? -1 : 0), s);
      break;
    }
    case 'attack': {
      const dx = [-2, 2, 4, 1][i];
      if (i === 2) {                        // เฟรมโดนเป้า: ขยายเล็กน้อย
        const w = Math.round(base.width * 1.06), h = Math.round(base.height * 1.06);
        ctx.drawImage(base, bx + dx - (w - base.width) / 2, FH - 1 - h, w, h);
      } else ctx.drawImage(base, bx + dx, by);
      const kind = { sword: 'slash', staff: 'cast', bow: 'twang', wraps: 'impact' }[weapon];
      if (i === 2) fx(ctx, weapon, cx + dx, cy, base.width, base.height, kind);
      break;
    }
    case 'hit': {
      ctx.drawImage(base, bx - (i ? 2 : 3), by);
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = `rgba(255,70,70,${i ? 0.25 : 0.45})`; ctx.fillRect(0, 0, FW, FH);
      ctx.globalCompositeOperation = 'source-over';
      break;
    }
    case 'die': {
      // ล้มหงายไปด้านหลัง หมุนรอบเท้า (จุดหมุนเลื่อนไปทางขวาให้หัวไม่หลุดกรอบ)
      const ang = [-18, -45, -72, -90][i] * Math.PI / 180;
      const pivot0 = bx + base.width * 0.8, pivot1 = FW - 4;
      ctx.save();
      ctx.translate(pivot0 + (pivot1 - pivot0) * (i / 3), FH - 1);
      ctx.rotate(ang);
      ctx.globalAlpha = i === 3 ? 0.8 : 1;
      ctx.drawImage(base, -base.width * 0.8, -base.height);
      ctx.restore();
      break;
    }
    case 'jump': drawLegsShift(ctx, base, bx, by - 2, 2); break;
  }
}

export function frameSize(base) {
  return { FW: Math.max(base.width + PAD_X * 2, base.height + 8), FH: base.height + PAD_TOP };
}

export { CHAR_ANIMS };
export const weaponOf = (a) => JOBS[a.job].weapon;
