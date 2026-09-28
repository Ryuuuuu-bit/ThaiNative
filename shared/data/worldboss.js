// ============================================================
//  บอสโลก "พระราหู ผู้กลืนจันทร์" – อีเวนต์ลานสุริยคราส (ใช้ร่วม client + server)
//  ▸ ลงมาวันละ 2 รอบ (เวลาไทย) · ทั้งเซิร์ฟช่วยกันปราบใน 30 นาที · คนปิดฉากได้ป้าย MVP เหนือหัว
//  ▸ ดาเมจของบอส = % ของ HP ผู้เล่น (ทุกเลเวลเจ็บเท่ากัน) · ทุกท่าเตือนก่อนเสมอ
//     สีเตือน: ม่วง = ดาเมจทั่วไป · เงิน = จุดปลอดภัย/เป้าที่ต้องตี · แดง = อันตรายสูง
// ============================================================
import { TILE } from '../td/ayutthaya.js';

export const WB_ID = 'rahu_eclipse';
export const WB_MAP = 'suriya';
export const WB_T = TILE;                     // ไทล์ = 16px

/** ผังลาน (ไทล์) · ศูนย์กลางลาน = จุดบอสลอย */
export const ARENA = {
  W: 84, H: 80,
  cx: 42, cy: 32, r: 26,                     // ลานวงกลมรัศมี 26 ไทล์
  camp: { x: 42, y: 71, r: 7 },              // ค่ายรอคราส (Safe Zone · ไม่มีกับดัก)
  gateY: [58, 64],                           // ทางเดินประตูลาน
};
export const arenaPx = (tx, ty) => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });
export const ARENA_C = arenaPx(ARENA.cx, ARENA.cy);

// ---------------- เวลา ----------------
/** รอบเกิด (ชั่วโมง:นาที เวลาไทย UTC+7) */
export const WB_TIMES = [[13, 0], [21, 0]];
export const WB_FIGHT_MS = 30 * 60e3;        // เวลาสู้
export const WB_ANNOUNCE_MS = 10 * 60e3;     // ประกาศล่วงหน้า (เปิดลาน/วาร์ปได้)
export const WB_CLOSE_MS = 3 * 60e3;         // หลังจบ → แจกรางวัล แล้วปิดลาน
export const WB_MVP_MS = 30 * 60e3;          // ป้าย MVP ค้างเหนือหัว

/** รอบล่าสุดที่เริ่มไปแล้ว (≤ now) · ใช้ตอน server รีสตาร์ทกลางอีเวนต์ */
export function lastSpawnAt(now = Date.now()) {
  const TZ = 7 * 3600e3;
  const d = new Date(now + TZ); d.setUTCHours(0, 0, 0, 0);
  const day0 = d.getTime() - TZ;
  let best = 0;
  for (let k = -1; k <= 0; k++) for (const [h, m] of WB_TIMES) { const t = day0 + k * 86400e3 + (h * 60 + m) * 60e3; if (t <= now && t > best) best = t; }
  return best;
}
/** เวลาเกิดรอบถัดไป (ms) หลัง now */
export function nextSpawnAt(now = Date.now()) {
  const TZ = 7 * 3600e3;
  const d = new Date(now + TZ); d.setUTCHours(0, 0, 0, 0);
  const day0 = d.getTime() - TZ;
  for (let k = 0; k < 3; k++) for (const [h, m] of WB_TIMES) {
    const t = day0 + k * 86400e3 + (h * 60 + m) * 60e3;
    if (t > now) return t;
  }
  return now + 86400e3;
}

// ---------------- เลือดบอส ----------------
/** เลือด = max(ขั้นต่ำ, ออนไลน์ทั้งเซิร์ฟ × ต่อคน) แล้วไม่เกินเพดาน (ล็อกตอนบอสเกิด) */
export const WB_HP = { min: 1_000_000, per: 50_000, cap: 20_000_000 };
export const wbHp = (online) => Math.min(WB_HP.cap, Math.max(WB_HP.min, Math.round(online) * WB_HP.per));

/** เฟส (ตาม % เลือด) */
export const PHASES = [
  { n: 1, at: 1.00, nameTh: 'ราหูอมจันทร์',   skills: ['claw', 'breath', 'shadow'], traps: ['thorn', 'pool'] },
  { n: 2, at: 0.75, nameTh: 'จันทร์เสี้ยว',     skills: ['crystal', 'minion', 'claw', 'shadow'], traps: ['thorn', 'pool', 'yant'] },
  { n: 3, at: 0.50, nameTh: 'คราสเต็มดวง',     skills: ['dark', 'roar', 'breath'], traps: ['thorn', 'pool', 'yant', 'fire'] },
  { n: 4, at: 0.25, nameTh: 'คลั่ง',           skills: ['navagraha', 'claw', 'breath', 'shadow', 'crystal', 'minion', 'dark', 'roar'], traps: ['thorn', 'pool', 'yant', 'fire'], cdMul: 0.6 },
];
export const phaseOf = (hpPct) => (hpPct > 0.75 ? 1 : hpPct > 0.5 ? 2 : hpPct > 0.25 ? 3 : 4);

// ---------------- สกิลบอส (ดาเมจ = สัดส่วน HP สูงสุดของผู้เล่น) ----------------
export const WB_SKILLS = {
  claw:      { nameTh: 'กรงเล็บคราส',    warn: 1100, dmg: 0.40, cd: 7000,  shape: 'cone',  range: 6 * TILE, arc: 120, color: 'purple', tip: 'ถอยออกด้านข้าง อย่ายืนหน้าบอสตรง ๆ' },
  breath:    { nameTh: 'ลมหายใจเงา',     warn: 900,  dmg: 0.35, cd: 9000,  shape: 'line',  range: 22 * TILE, w: 1.6 * TILE, color: 'purple', tip: 'เดินตั้งฉากกับเส้นเล็งก่อนเส้นหยุดสั่น' },
  shadow:    { nameTh: 'เงาคราส',        warn: 1100, dmg: 0.30, cd: 10000, shape: 'circles', r: 2 * TILE, n: [5, 8], color: 'purple', tip: 'ดูดวงจันทร์บนพื้นเป็นนาฬิกา มีดสนิทเมื่อไหร่ต้องออกจากวงแล้ว' },
  crystal:   { nameTh: 'ผลึกจันทร์',      warn: 3200, heal: 0.05, cd: 30000, life: 30000, n: 4, color: 'silver', tip: 'สายไกลแบ่งกันยิงคนละก้อน' },
  minion:    { nameTh: 'บริวารราหู',      warn: 900,  cd: 16000, n: 3, drain: 0.06, color: 'purple', tip: 'นักมวยผลัก ขุนศึกรับ สายเวทกวาดวงกว้าง' },
  dark:      { nameTh: 'ดับฟ้า',          warn: 4500, dmg: 0.80, cd: 25000, shape: 'safe', r: 3 * TILE, n: 3, color: 'red', tip: 'วิ่งเข้าเสาแสงก่อนตัวเลขถึง 0' },
  roar:      { nameTh: 'คำรามกลืนแสง',   warn: 1400, dmg: 0.45, cd: 18000, shape: 'pull', r: 3.5 * TILE, color: 'red', tip: 'วิ่งสวนแรงดูดออกไปให้พ้นวงขาว' },
  navagraha: { nameTh: 'นพเคราะห์ถล่ม',  warn: 1600, dmg: 0.35, cd: 14000, shape: 'ring8', r: 3 * TILE, ringR: 9 * TILE, color: 'red', tip: 'ดูสีบนพื้น หาช่องว่างระหว่างวงแล้วยืนนิ่ง' },
};
/** สีดาวนพเคราะห์ 8 ดวง (อาทิตย์ → ศุกร์ + ราหู) */
export const NAVA_COLORS = [0xe74c3c, 0xf5b041, 0xf7dc6f, 0x58d68d, 0x5dade2, 0xaf7ac5, 0xfdfefe, 0x2c3e50];

// ---------------- กับดักในลาน (ทำงานเฉพาะตอนสู้) ----------------
/** หนามงิ้ว: ลานหนาม 3×3 ไทล์ 8 จุดรอบวงนอก แบ่ง 2 ชุดสลับกันเด้ง */
const ring = (n, rr, off = 0) => Array.from({ length: n }, (_, i) => { const a = off + (i / n) * Math.PI * 2; return { x: ARENA.cx + Math.cos(a) * rr, y: ARENA.cy + Math.sin(a) * rr }; });
export const TRAPS = {
  thorn: { nameTh: 'หนามงิ้ว', spots: ring(8, 21, Math.PI / 8).map((p, i) => ({ ...p, set: i % 2 })), half: 1.5, warn: 1500, dmg: 0.15, every: 7000 },
  pool:  { nameTh: 'บ่อเงาดูด', spots: ring(4, 12, Math.PI / 4), r: 2.2, slow: 0.4, dmg: 0.03 },
  fire:  { nameTh: 'เสาเพลิงนรก', spots: ring(4, 24, Math.PI / 4), len: 9, warn: 3000, sweep: 90, dmg: 0.20, every: 12000, every4: 8000 },
  yant:  { nameTh: 'ยันต์ระเบิด', n: 8, trig: 3, warn: 1000, r: 1.5, dmg: 0.25 },
};

// ---------------- ผีในลาน ----------------
export const WB_SHADES = 6;                   // ช่องบริวาร (ระลอกละ 3)
export const WB_CRYSTALS = 4;

// ---------------- รางวัล ----------------
export const WB_STONE = 'rahu_stone';        // ศิลาราหู (วัตถุดิบหลอมอุปกรณ์ขอบแดง)
/** รางวัลตามอันดับดาเมจ (คนที่ทำดาเมจ ≥ 0.5% ของเลือดบอส) */
export function wbReward(rank, share, isMvp) {
  const base = rank === 1 ? { stone: 8, exp: 1, gold: 1 } : rank <= 3 ? { stone: 6, exp: 0.85, gold: 0.85 } : rank <= 10 ? { stone: 4, exp: 0.7, gold: 0.7 } : { stone: 2, exp: 0.5, gold: 0.5 };
  const card = isMvp ? 0.25 : rank === 1 ? 0.15 : rank <= 10 ? 0.08 : 0.05;
  const red = isMvp ? 0.30 : rank === 1 ? 0.20 : rank <= 10 ? 0.10 : 0.03;   // อุปกรณ์ขอบแดงสุ่ม 1 ชิ้น
  const mul = isMvp ? 1.5 : 1;
  return { stone: base.stone + (isMvp ? 3 : 0), expK: base.exp * mul, goldK: base.gold * mul, card: Math.max(card, isMvp ? 0.25 : 0), red, share };
}
export const WB_MIN_SHARE = 0.005;          // ต้องทำดาเมจอย่างน้อย 0.5% ของเลือดบอสถึงได้ของ
export const WB_BASE_EXP = 150_000, WB_BASE_GOLD = 30_000;
export const WB_TITLE = 'wb_mvp';
