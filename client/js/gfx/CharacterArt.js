// ============================================================
//  CharacterArt – วาดตัวละคร Pixel Art แบบ "Paper-doll" ด้วย Canvas 2D
//  ร่างกาย → ขา/กางเกง → ลำตัว/ชุด → หัว/หน้า → ผม → แขนหน้า + อาวุธ
//  แต่ละเฟรมของ Animation กำหนดด้วย "pose" (มุมแขน, ขา, การเอน ฯลฯ)
//
//  ** อยากใช้ภาพจาก PixelLab แทน? ให้ export เป็น spritesheet ตามลำดับเฟรม
//     ใน CHAR_ANIMS แล้วโหลดใน BootScene แทนการเรียก bakeCharacter() **
// ============================================================
import { OUTFITS, HAIRSTYLES, FACES } from '/shared/data/appearance.js';
import { JOBS } from '/shared/data/classes.js';

export const FW = 32, FH = 40; // ขนาดเฟรมตัวละคร

// ลำดับ/จำนวนเฟรมของแต่ละท่า (ใช้ทั้งตอนวาดและตอนสร้าง Phaser animation)
export const CHAR_ANIMS = {
  idle:   { frames: 4, rate: 5,  repeat: -1 },
  walk:   { frames: 6, rate: 10, repeat: -1 },
  attack: { frames: 4, rate: 14, repeat: 0 },
  hit:    { frames: 2, rate: 8,  repeat: 0 },
  die:    { frames: 4, rate: 6,  repeat: 0 },
  jump:   { frames: 1, rate: 1,  repeat: -1 },
};

const SKIN = '#e3b08a', SKIN_SH = '#c48a62', DARK = '#2b1b17', WHITE = '#ffffff';
const rad = (d) => (d * Math.PI) / 180;

function px(ctx, x, y, w, h, c) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

// ------------------------------------------------------------
//  POSES – ท่าทางแต่ละเฟรม (มุม: 0 = ชี้ขวา, 90 = ชี้ลง, -90 = ชี้ขึ้น)
// ------------------------------------------------------------
const BASE_POSE = { bob: 0, lean: 0, legF: 0, legB: 0, footYF: 38, footYB: 38, armF: 80, armB: 100, wAng: -65, fx: null, eyes: null, bow: 'hold' };

const ATTACK_POSES = {
  sword: [
    { armF: -120, wAng: -150, lean: -1 },
    { armF: -50, wAng: -70 },
    { armF: 15, wAng: 5, lean: 2, legF: 3, fx: 'slash' },
    { armF: 55, wAng: -25, lean: 1 },
  ],
  staff: [
    { armF: -10, wAng: -90 },
    { armF: -55, wAng: -95, fx: 'charge' },
    { armF: 0, wAng: -55, lean: 2, fx: 'cast' },
    { armF: 40, wAng: -80 },
  ],
  bow: [
    { armF: 0, armB: 10, bow: 'hold' },
    { armF: 0, armB: 175, bow: 'draw', lean: -1 },
    { armF: 0, armB: 20, bow: 'release', fx: 'twang' },
    { armF: 30, armB: 100, bow: 'hold' },
  ],
  wraps: [
    { armF: 20, armB: 40, lean: -1 },
    { armF: -2, armB: 60, lean: 3, legF: 3, fx: 'impact' },          // หมัดตรง
    { armF: -40, armB: 10, lean: 2, footYF: 32, legF: 4 },            // เข่า
    { armF: 50, armB: 80 },
  ],
};

export function getPose(anim, i, weapon) {
  let p = {};
  switch (anim) {
    case 'idle':
      p = { bob: [0, 0, 1, 1][i], armF: 80 + (i >> 1), armB: 100 };
      if (weapon === 'wraps') p = { ...p, armF: 20, armB: 35 };   // การ์ดมวย
      break;
    case 'walk': {
      const ph = (i / 6) * Math.PI * 2, s = Math.sin(ph);
      p = { legF: Math.round(s * 4), legB: Math.round(-s * 4), bob: Math.abs(Math.cos(ph)) > 0.7 ? 0 : 1, armF: 80 - s * 30, armB: 100 + s * 30 };
      if (weapon === 'wraps') p = { ...p, armF: 25 - s * 8, armB: 40 + s * 8 };
      break;
    }
    case 'attack': p = ATTACK_POSES[weapon][i]; break;
    case 'hit':  p = [{ lean: -2, armF: 125, armB: 135, eyes: 'x' }, { lean: -1, armF: 110, armB: 120, eyes: 'x' }][i]; break;
    case 'die':  p = { armF: 140, armB: 150, eyes: 'x', lean: -1 }; break;
    case 'jump': p = { legF: 3, legB: -2, footYF: 33, footYB: 35, armF: -35, armB: -70 }; break;
  }
  return { ...BASE_POSE, ...p };
}

// ------------------------------------------------------------
//  ส่วนประกอบร่างกาย
// ------------------------------------------------------------
function drawArm(ctx, sx, sy, angle, sleeve, len = 8, hand = SKIN, band = null) {
  const c = Math.cos(rad(angle)), s = Math.sin(rad(angle));
  for (let i = 0; i <= len; i++) {
    const col = i < 3 ? sleeve : (band && i === 3 ? band : SKIN);
    px(ctx, sx + c * i - 1, sy + s * i - 1, 3, 3, col);
  }
  const hx = sx + c * len, hy = sy + s * len;
  px(ctx, hx - 1, hy - 1, 3, 3, hand);
  return { hx: Math.round(hx), hy: Math.round(hy) };
}

function drawLeg(ctx, hipX, hipY, footX, footY, pants, pantsEnd, shoe) {
  for (let y = hipY; y <= footY; y++) {
    const t = (y - hipY) / Math.max(1, footY - hipY);
    const x = hipX + (footX - hipX) * t;
    px(ctx, x, y, 3, 1, y <= pantsEnd ? pants : SKIN);
  }
  px(ctx, footX, footY, 4, 1, shoe); // เท้า/รองเท้า
}

function drawLegs(ctx, a, p, o, ox, oy) {
  const fem = a.gender === 'female';
  const hipY = 27 + oy;
  const pantsEnd = a.job === 'boxer' ? 30 + oy : (fem ? 36 : 34);
  const shoe = a.job === 'boxer' ? SKIN_SH : DARK;
  drawLeg(ctx, 12 + ox, hipY, 12 + ox + p.legB, p.footYB, shade(o.bottom, -20), pantsEnd, shoe);
  drawLeg(ctx, 16 + ox, hipY, 16 + ox + p.legF, p.footYF, o.bottom, pantsEnd, shoe);

  // ผู้หญิง: ผ้าถุง/ผ้าซิ่นคลุมขา
  if (fem && a.job !== 'boxer') {
    const bottom = Math.min(35, Math.max(p.footYF, p.footYB) - 3);
    for (let y = hipY; y <= bottom; y++) {
      const spread = Math.round((y - hipY) * 0.25);
      px(ctx, 11 + ox - spread + Math.min(0, p.legB) * 0.3, y, 10 + spread * 2, 1, o.bottom);
    }
    px(ctx, 11 + ox - 2, bottom, 14, 1, o.trim); // ชายผ้าซิ่น
  }
  // นักมวย: กางเกงมวยขาสั้นมีขอบ
  if (a.job === 'boxer') px(ctx, 11 + ox, hipY, 10, 1, o.trim);
}

function drawTorso(ctx, a, o, ox, oy) {
  const x = 11 + ox, y = 17 + oy, w = 10, h = 10;
  const boxer = a.job === 'boxer';
  const top = boxer ? SKIN : o.top;
  px(ctx, x, y, w, h, top);
  px(ctx, x, y + h - 1, w, 1, boxer ? o.bottom : shade(top, -25));

  if (!boxer) {
    switch (o.pattern) {
      case 'stripe': for (let r = y + 2; r < y + h - 1; r += 3) px(ctx, x, r, w, 1, o.trim); break;
      case 'sash':   for (let i = 0; i < 9; i++) px(ctx, x + 1 + i, y + i, 2, 1, o.trim); break;
      case 'dots':   for (let r = y + 1; r < y + h - 1; r += 3) for (let c = x + 1 + (r % 2); c < x + w; c += 3) px(ctx, c, r, 1, 1, o.trim); break;
      case 'trim':   px(ctx, x, y, w, 1, o.trim); px(ctx, x + 5, y + 1, 1, h - 2, o.trim); break;
    }
    if (a.gender === 'female') px(ctx, x, y, 2, h - 2, o.trim); // สไบ
    px(ctx, x, y + h - 2, w, 1, shade(o.bottom, -10)); // เข็มขัด
  } else {
    px(ctx, x + 2, y + 2, 2, 1, SKIN_SH); px(ctx, x + 6, y + 2, 2, 1, SKIN_SH); // กล้ามอก
    px(ctx, x + 4, y + 5, 2, 1, SKIN_SH);
  }

  // เครื่องประดับตามอาชีพ
  if (a.job === 'swordman') { px(ctx, x - 1, y, 4, 3, '#d4af37'); px(ctx, x + 7, y, 4, 3, '#d4af37'); }
  if (a.job === 'mage') {     // เสื้อคลุมยาว + สไบขาว
    px(ctx, x - 1, y + h - 1, w + 2, 5, shade(o.top, -15));
    for (let i = 0; i < 9; i++) px(ctx, x + 8 - i, y + i, 2, 1, '#f5f5f5');
  }
}

function drawQuiver(ctx, ox, oy) { // กระบอกลูกธนูด้านหลัง (พรานป่า)
  px(ctx, 8 + ox, 15 + oy, 4, 11, '#7b4a1e');
  px(ctx, 8 + ox, 15 + oy, 4, 1, '#4e2d10');
  px(ctx, 8 + ox, 12 + oy, 1, 3, '#ecf0f1'); px(ctx, 10 + ox, 11 + oy, 1, 4, '#e74c3c');
}

function drawHead(ctx, a, p, ox, oy) {
  const x = 10 + ox, y = 5 + oy;
  px(ctx, x + 1, y, 10, 12, SKIN);
  px(ctx, x, y + 1, 12, 10, SKIN);
  px(ctx, x + 2, y + 11, 8, 1, SKIN_SH);   // คาง
  px(ctx, x + 2, y + 6, 2, 2, SKIN_SH);    // หู
  px(ctx, 14 + ox, 16 + oy, 4, 2, SKIN_SH); // คอ

  const f = FACES[a.face];
  const ex1 = x + 6, ex2 = x + 9, ey = y + 5;
  const eyes = p.eyes || f.eyes;
  const fem = a.gender === 'female';

  switch (eyes) {
    case 'x':      px(ctx, ex1, ey, 1, 1, DARK); px(ctx, ex1 + 1, ey + 1, 1, 1, DARK); px(ctx, ex2, ey + 1, 1, 1, DARK); px(ctx, ex2 + 1, ey, 1, 1, DARK); break;
    case 'line':   px(ctx, ex1, ey + 1, 2, 1, DARK); px(ctx, ex2, ey + 1, 2, 1, DARK); break;
    case 'big':    px(ctx, ex1, ey, 2, 2, DARK); px(ctx, ex2, ey, 2, 2, DARK); px(ctx, ex1, ey, 1, 1, WHITE); px(ctx, ex2, ey, 1, 1, WHITE); break;
    case 'sharp':  px(ctx, ex1, ey, 1, 1, DARK); px(ctx, ex1 + 1, ey + 1, 1, 1, DARK); px(ctx, ex2, ey + 1, 1, 1, DARK); px(ctx, ex2 + 1, ey, 1, 1, DARK); break;
    case 'sleepy': px(ctx, ex1, ey + 1, 2, 1, DARK); px(ctx, ex2, ey + 1, 2, 1, DARK); px(ctx, ex1, ey, 2, 1, SKIN_SH); px(ctx, ex2, ey, 2, 1, SKIN_SH); break;
    case 'wink':   px(ctx, ex1, ey + 1, 2, 1, DARK); px(ctx, ex2, ey, 1, 2, DARK); break;
    case 'round':  px(ctx, ex1, ey, 2, 2, DARK); px(ctx, ex2, ey, 2, 2, DARK); break;
    case 'narrow': px(ctx, ex1, ey + 1, 2, 1, DARK); px(ctx, ex2, ey + 1, 2, 1, DARK); px(ctx, ex2 + 1, ey, 1, 1, DARK); break;
    default:       px(ctx, ex1, ey, 1, 2, DARK); px(ctx, ex2, ey, 1, 2, DARK); // dot
  }
  if (fem && eyes !== 'x') { px(ctx, ex1 - 1, ey - 1, 1, 1, DARK); px(ctx, ex2 + 1, ey - 1, 1, 1, DARK); }
  if (f.brow) { px(ctx, ex1 - 1, ey - 2, 3, 1, DARK); px(ctx, ex2, ey - 2, 3, 1, DARK); }
  if (f.blush) { px(ctx, ex1 - 1, ey + 3, 2, 1, '#f1948a'); px(ctx, ex2 + 1, ey + 3, 1, 1, '#f1948a'); }

  const lip = fem ? '#c0392b' : '#8e4b3a', mx = x + 7, my = y + 9;
  switch (p.eyes === 'x' ? 'o' : f.mouth) {
    case 'smile': px(ctx, mx, my, 3, 1, lip); px(ctx, mx - 1, my - 1, 1, 1, lip); px(ctx, mx + 3, my - 1, 1, 1, lip); break;
    case 'o':     px(ctx, mx + 1, my, 2, 2, lip); break;
    case 'smirk': px(ctx, mx, my, 3, 1, lip); px(ctx, mx + 3, my - 1, 1, 1, lip); break;
    default:      px(ctx, mx, my, 3, 1, lip);
  }
  if (f.mark === 'yant') { px(ctx, x + 6, y + 1, 4, 1, '#1b2631'); px(ctx, x + 7, y + 2, 2, 1, '#1b2631'); }
  if (f.mark === 'powder') {
    for (const [dx, dy] of [[7, 1], [9, 2], [5, 7], [10, 7], [8, 3]]) px(ctx, x + dx, y + dy, 1, 1, '#fdfefe');
  }
}

function drawHair(ctx, a, p, ox, oy, layer) {
  const h = HAIRSTYLES[a.hair], c = h.color, hi = shade(c, 40);
  const x = 10 + ox, y = 5 + oy;
  const fem = a.gender === 'female';

  if (layer === 'back') { // ผมที่อยู่ด้านหลังลำตัว
    if (h.shape === 'long' || (fem && ['short', 'flower'].includes(h.shape)))
      px(ctx, x - 1, y + 3, 5, h.shape === 'long' ? 19 : 12, c);
    if (h.shape === 'flower') px(ctx, x - 1, y + 3, 5, 13, c);
    if (h.shape === 'braid') for (let i = 0; i < 8; i++) px(ctx, x - 1 + (i % 2), y + 8 + i * 2, 3, 2, i % 2 ? hi : c);
    if (h.shape === 'ponytail') { const sw = p.bob; px(ctx, x - 4, y + 3 + sw, 4, 3, c); px(ctx, x - 5, y + 6 + sw, 3, 9, c); }
    return;
  }

  switch (h.shape) {
    case 'buzz':
      px(ctx, x + 1, y - 1, 10, 3, c); px(ctx, x, y + 1, 3, 4, c); break;
    case 'topknot': // ผมจุก + พวงมาลัยจิ๋ว
      px(ctx, x + 1, y, 10, 2, shade(c, 25)); px(ctx, x + 4, y - 4, 4, 4, c); px(ctx, x + 3, y - 1, 6, 1, '#f8f9f9'); break;
    case 'spiky':
      px(ctx, x, y - 1, 12, 4, c); px(ctx, x, y + 2, 3, 6, c);
      for (let i = 0; i < 4; i++) px(ctx, x + 1 + i * 3, y - 4 + (i % 2), 2, 3, c);
      break;
    case 'curly':
      px(ctx, x - 1, y - 2, 14, 5, c); px(ctx, x - 2, y, 4, 9, c);
      for (let i = 0; i < 5; i++) px(ctx, x + i * 3, y - 3, 2, 1, hi);
      break;
    case 'bun':
      px(ctx, x, y - 1, 12, 4, c); px(ctx, x, y + 2, 3, 5, c); px(ctx, x - 3, y - 3, 5, 5, c); px(ctx, x - 2, y - 2, 1, 1, hi); break;
    default: // short / long / braid / ponytail / flower
      px(ctx, x, y - 1, 12, 4, c); px(ctx, x, y + 2, 3, 7, c);
      px(ctx, x + 6, y + 2, 5, 1, c); // หน้าม้า
      px(ctx, x + 3, y, 5, 1, hi);
  }
  if (h.shape === 'flower') { px(ctx, x + 1, y + 2, 3, 3, '#f5b7b1'); px(ctx, x + 2, y + 3, 1, 1, '#f4d03f'); }
  if (a.job === 'boxer') { px(ctx, x - 1, y + 1, 14, 2, '#c0392b'); px(ctx, x - 1, y + 1, 14, 1, '#fdfefe'); } // มงคล
}

function drawWeapon(ctx, weapon, p, hx, hy) {
  const c = Math.cos(rad(p.wAng)), s = Math.sin(rad(p.wAng));
  if (weapon === 'sword') {
    for (let i = -2; i < 0; i++) px(ctx, hx + c * i, hy + s * i, 2, 2, '#6e2c00');     // ด้าม
    px(ctx, hx - s * 2 - 1, hy + c * 2 - 1, 3, 3, '#d4af37');                           // กระบัง
    px(ctx, hx + s * 2 - 1, hy - c * 2 - 1, 3, 3, '#d4af37');
    for (let i = 1; i <= 12; i++) px(ctx, hx + c * i, hy + s * i, 2, 2, i > 10 ? '#ffffff' : '#dfe6e9'); // ใบดาบ
  } else if (weapon === 'staff') {
    for (let i = -7; i <= 11; i++) px(ctx, hx + c * i, hy + s * i, 2, 2, '#8b5a2b');
    const ox = hx + c * 13, oy = hy + s * 13;
    const big = p.fx === 'charge' || p.fx === 'cast';
    if (big) px(ctx, ox - 4, oy - 4, 8, 8, 'rgba(175,122,197,0.55)');
    px(ctx, ox - 2, oy - 2, 4, 4, '#a569bd'); px(ctx, ox - 1, oy - 1, 2, 2, '#f5eef8');
  } else if (weapon === 'bow') {
    const pull = p.bow === 'draw' ? 5 : 0;
    for (let yy = -9; yy <= 9; yy++) {
      const bx = Math.round(Math.cos((yy / 9) * (Math.PI / 2)) * 4);
      px(ctx, hx + bx, hy + yy, 2, 1, '#8b5a2b');
    }
    // สายธนู
    for (let yy = -9; yy <= 9; yy++) {
      const t = 1 - Math.abs(yy) / 9;
      px(ctx, hx - Math.round(pull * t), hy + yy, 1, 1, '#ecf0f1');
    }
    if (p.bow === 'draw') for (let i = -6; i <= 6; i++) px(ctx, hx + i, hy, 1, 1, i > 4 ? '#bdc3c7' : '#a04000');
  }
}

function drawFx(ctx, fx, hx, hy) {
  if (fx === 'slash') {
    for (let i = 0; i < 14; i++) {
      const ang = rad(-70 + i * 11);
      px(ctx, 16 + Math.cos(ang) * 14, 20 + Math.sin(ang) * 14, 2, 2, i % 3 ? '#ffffff' : '#aed6f1');
    }
  } else if (fx === 'impact') {
    px(ctx, hx + 2, hy - 1, 3, 1, '#f9e79f'); px(ctx, hx + 3, hy - 3, 1, 5, '#f9e79f'); px(ctx, hx + 5, hy, 1, 1, '#fff');
  } else if (fx === 'twang') {
    px(ctx, hx + 6, hy, 6, 1, '#fdfefe');
  }
}

/** วาดตัวละคร 1 เฟรมลง ctx (พิกัด 0..FW, 0..FH) หันขวา */
export function drawCharacter(ctx, a, p) {
  const o = OUTFITS[a.outfit];
  const job = JOBS[a.job];
  const ox = p.lean, oy = p.bob;
  const wraps = job.weapon === 'wraps';

  drawHair(ctx, a, p, ox, oy, 'back');
  if (a.job === 'archer') drawQuiver(ctx, ox, oy);
  // แขนหลัง
  drawArm(ctx, 13 + ox, 19 + oy, p.armB, wraps ? SKIN : shade(o.top, -25), 7, wraps ? '#f8f9f9' : SKIN);
  drawLegs(ctx, a, p, o, ox, oy);
  drawTorso(ctx, a, o, ox, oy);
  drawHead(ctx, a, p, ox, oy);
  drawHair(ctx, a, p, ox, oy, 'front');
  // แขนหน้า + อาวุธ
  const sleeve = wraps ? SKIN : o.top;
  const band = wraps ? '#c0392b' : null; // ประเจียด
  const { hx, hy } = drawArm(ctx, 18 + ox, 19 + oy, p.armF, sleeve, 8, wraps ? '#f8f9f9' : SKIN, band);
  if (!wraps) drawWeapon(ctx, job.weapon, p, hx, hy);
  if (p.fx) drawFx(ctx, p.fx, hx, hy);
}

// ------------------------------------------------------------
//  Utility
// ------------------------------------------------------------
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}
