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
import { buildRig, drawRig, poseFor } from './Rig.js';

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

function playerRigFrame(ctx, base, anim, i, weapon, FW, FH) {
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
  } else if (anim === 'jump') {
    pose = i === 0 ? { dy: -2, sy: 1.05, sx: 0.96, front: -0.6, back: 0.5, frontLift: 3, backLift: 2, lean: 0.06 }
                   : { dy: -2, front: -0.3, back: 0.7, frontLift: 2, backLift: 3, lean: 0.1 };
  }
  drawRig(ctx, rig, pose, footX, footY);
  const dx = pose.dx || 0;
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

export function drawPlayerFrame(ctx, base, anim, i, weapon, FW, FH) {
  ctx.imageSmoothingEnabled = false;
  if (anim !== 'die') return playerRigFrame(ctx, base, anim, i, weapon, FW, FH);
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
  return { FW: Math.max(base.width + 30, base.height + 10), FH: base.height + 7 };
}

export { CHAR_ANIMS };
export const weaponOf = (a) => JOBS[a.job].weapon;
