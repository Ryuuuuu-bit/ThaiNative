// ============================================================
//  ระบบค่าพลัง (Status System) แบบ Ragnarok
//  STR → ATK ประชิด · AGI → ความเร็วตี + หลบ · VIT → HP + ป้องกัน
//  INT → พลังเวทย์ + MP · DEX → แม่นยำ + ATK ธนู + ความเร็วตีนิดหน่อย · LUK → คริติคอล
//  ▸ ลงแต้มยิ่งสูงยิ่งแพง (แบบ RO): จาก x → x+1 ใช้ floor((x−1)/10)+2 แต้ม · เพดาน 130 ต่อค่า
//  ▸ เริ่มทุกค่า 1 + แต้ม 48 · ขึ้นเลเวล L ได้ floor((L−1)/5)+3 แต้ม (Lv.150 รวม 2,670 → ตันได้ราว 2–3 ค่า)
// ============================================================

export const STAT_KEYS = ['STR', 'AGI', 'VIT', 'INT', 'DEX', 'LUK'];

export const STAT_INFO = {
  STR: { nameTh: 'พลัง',     desc: 'พลังโจมตีกายภาพประชิด (ยิ่งสูงยิ่งคุ้ม) · ATK ธนูเล็กน้อย' },
  AGI: { nameTh: 'ว่องไว',   desc: 'ความเร็วโจมตี (สูงสุด −30% คูลดาวน์ตีปกติ) · หลบหลีก' },
  VIT: { nameTh: 'อึด',      desc: 'HP สูงสุด (+% และค่าตรง) · ป้องกัน' },
  INT: { nameTh: 'ปัญญา',    desc: 'พลังเวทย์ (ยิ่งสูงยิ่งคุ้ม · เวทย์โดนเสมอ ไม่ต้องใช้แม่นยำ) · MP สูงสุด' },
  DEX: { nameTh: 'ชำนาญ',    desc: 'ความแม่นยำ · พลังโจมตีธนู (ยิ่งสูงยิ่งคุ้ม) · ลดคูลดาวน์สกิล (สูงสุด −15%) · ATK ประชิดเล็กน้อย' },
  LUK: { nameTh: 'โชค',      desc: 'โอกาสคริติคอล (+0.3%) · ความแรงคริ · ATK/แม่นยำ/หลบ เล็กน้อย' },
};

/** แต้มสถานะแบบ RO */
export const STAT_START = 1, STAT_CAP = 130, START_STAT_POINTS = 48;
/** แต้มที่ใช้เพิ่มค่า x → x+1 */
export const statCost = (x) => Math.floor((Math.max(1, x) - 1) / 10) + 2;
/** แต้มที่ใช้เพิ่มจาก from ขึ้นไปอีก n */
export function raiseCost(from, n) { let t = 0; for (let i = 0; i < n; i++) t += statCost(from + i); return t; }
/** แต้มที่จมอยู่ในค่า v (นับจากค่าเริ่ม) */
export const statSpentOn = (v) => raiseCost(STAT_START, Math.max(0, (v | 0) - STAT_START));
/** เพิ่มได้สูงสุดกี่ขั้นด้วยแต้ม pts (ไม่เกินเพดาน) */
export function maxRaise(from, pts) { let n = 0; while (from + n < STAT_CAP && statCost(from + n) <= pts) { pts -= statCost(from + n); n++; } return n; }
/** แต้มที่ได้ตอนขึ้นเป็นเลเวล L */
export const pointsForLevel = (L) => Math.floor((L - 1) / 5) + 3;
/** แต้มสถานะรวมที่เลเวลนี้มี */
export function statPointsAt(level) { let p = START_STAT_POINTS; for (let l = 2; l <= level; l++) p += pointsForLevel(l); return p; }
/** ลงแต้มอัตโนมัติตามน้ำหนัก plan {STR:1,...} → { add: {k: n}, used } (ลงทีละขั้นให้ค่าที่ต่ำสุดเทียบน้ำหนักก่อน) */
export function planRaise(stats, pts, plan) {
  const cur = { ...stats }, add = {}; let used = 0;
  for (;;) {
    const k = Object.keys(plan).filter((x) => plan[x] > 0 && cur[x] < STAT_CAP && statCost(cur[x]) <= pts - used).sort((a, b) => cur[a] / plan[a] - cur[b] / plan[b])[0];
    if (!k) break;
    used += statCost(cur[k]); cur[k]++; add[k] = (add[k] || 0) + 1;
  }
  return { add, used };
}
export const MAX_LEVEL = 150;          // เลเวลตัน (30 → 99 → 150 · แมพสวรรค์ดาวดึงส์/เขาพระสุเมรุ)

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
/** เพดานอ่อน: ส่วนที่เกิน cap ได้ครึ่งเดียว (ลงเยอะยังได้ผล แต่คุ้มน้อยลง) */
const soft = (v, cap) => (v > cap ? cap + (v - cap) * 0.5 : v);
export const CRIT_SOFT = 0.4, CRITDMG_SOFT = 1.0;

/** EXP ที่ต้องใช้เพื่อขึ้นเลเวลถัดไป · Lv1–30 เร็ว (ผู้เล่นใหม่) · หลัง 30 ชันขึ้นแบบ RO เรตกลาง (ตันประมาณ 70 ชม. เล่นคนเดียว) */
export const EXP_CURVE_FROM = 30, EXP_CURVE_K = 1.5;
export function expToNext(level) {
  const L = Math.max(1, level);
  return Math.floor(40 * Math.pow(L, 1.6) * (L <= EXP_CURVE_FROM ? 1 : Math.pow(L / EXP_CURVE_FROM, EXP_CURVE_K)));
}

/** ตัวคูณพลังโจมตีผีตามเลเวล: Lv1–20 เท่าเดิม (ผู้เล่นใหม่) · ไต่ขึ้นถึง ×1.35 ที่ Lv30 · สายผ้าบางโดนราว 11 ที สายอึดราว 25 ที */
export function mobAtkMul(level) {
  const L = Number(level) || 1;
  return L <= 20 ? 1 : Math.min(1.35, 1 + (L - 20) * 0.035);
}

/** แคป EXP จากผีตามช่วงเลเวล (แบบ RO Renewal)
 *  ▸ ผีต่ำกว่าเราไม่เกิน 5 เลเวล / เท่ากัน = 100%
 *  ▸ ผีสูงกว่าเรา 1–10 เลเวล → โบนัส +2%/เลเวล (สูงสุด +20%) คุ้มที่จะท้าผีเก่ง
 *  ▸ ผีสูงกว่าเกิน 10 → ลดลง 10%/เลเวล (เหลือต่ำสุด 20%) กันพาเวล/ดูดเวล
 *  ▸ ผีเลเวลต่ำกว่าเรา >5 → ลด 10%/เลเวล (เหลือต่ำสุด 10%) กันเก็บเวลผีอ่อน
 *  ▸ ผีธรรมดา 1 ตัวได้ไม่เกิน 20% ของ EXP ที่ต้องใช้ขึ้นเลเวล · บอสไม่เกิน 1 เลเวล → ฆ่าตัวเดียวไม่กระโดดหลายเลเวล */
export const EXP_BAND = 5, EXP_UP_BAND = 10, EXP_CAP_MOB = 0.2, EXP_CAP_BOSS = 1;
export function expLevelMul(playerLv, mobLv) {
  const d = (Number(mobLv) || 1) - (Number(playerLv) || 1);
  if (d < -EXP_BAND) return Math.max(0.1, 1 - (-d - EXP_BAND) * 0.1);
  if (d > EXP_UP_BAND) return Math.max(0.2, +(1.2 - (d - EXP_UP_BAND) * 0.1).toFixed(2));
  if (d > 0) return +(1 + d * 0.02).toFixed(2);
  return 1;
}
export function mobExp(base, playerLv, mobLv, boss = false) {
  const raw = Math.max(0, base) * expLevelMul(playerLv, mobLv);
  const cap = Math.max(1, expToNext(Math.max(1, Number(playerLv) || 1)) * (boss ? EXP_CAP_BOSS : EXP_CAP_MOB));
  return Math.round(Math.min(raw, cap));
}

/** ค่าเริ่มต้นของตัวละครใหม่ */
export function createBaseStats(job) {
  return {
    level: 1,
    exp: 0,
    statPoints: 0,
    stats: { ...job.startStats },
  };
}

/**
 * คำนวณค่าสถานะรอง (Derived Stats) จากค่าพลังหลัก + อาชีพ + อุปกรณ์
 * @param {{STR,AGI,VIT,INT,DEX,LUK}} s   ค่าพลังหลัก
 * @param {object} job                ข้อมูลอาชีพจาก classes.js
 * @param {number} level
 * @param {object} bonus              โบนัสจากอุปกรณ์ { atk, matk, def, hp, mp, crit, STR, ... }
 */
export function computeDerived(s, job, level, bonus = {}, opt = {}) {
  const S = (k) => (s[k] || 0) + (bonus[k] || 0);
  const STR = S('STR'), AGI = S('AGI'), VIT = S('VIT'), INT = S('INT'), DEX = S('DEX'), LUK = S('LUK');
  const M = (k) => 1 + (bonus[k] || 0);                                 // โบนัสสายหลัก (hpMul, mpMul, patkMul, matkMul)
  // ATK แบบ RO: ค่าหลัก + (ค่าหลัก/12)² + ค่ารอง/5 + LUK/3 · ประชิดใช้ STR · ธนูใช้ DEX (ธนูได้ ×0.6 เพราะยิงไกล + ได้ AGI/DEX ช่วยความเร็ว)
  const main = opt.ranged ? DEX : STR, sec = opt.ranged ? STR : DEX;
  const statAtk = (main + (main / 12) ** 2 + sec / 5 + LUK / 3) * 2.15 * (opt.ranged ? 0.6 : 1);
  return {
    maxHp: Math.round(((job.baseHp + level * job.hpPerLevel + (bonus.hp || 0)) * (1 + VIT / 300) + VIT * 8) * M('hpMul')),
    maxMp: Math.round(((job.baseMp + level * 4 + (bonus.mp || 0)) * (1 + INT / 100) + INT * 3) * M('mpMul')),
    patk: Math.round((statAtk + level * 1.5 + (bonus.atk || 0)) * M('patkMul')),
    matk: Math.round((2.7 * (INT + (INT / 12) ** 2) + level * 1.5 + (bonus.matk || 0)) * M('matkMul')),
    accuracy: Math.round(85 + DEX + LUK / 3 + (bonus.acc || 0)),                                           // DEX (%)
    critRate: clamp(soft(0.05 + LUK * 0.003 + DEX * 0.001 + (job.critBonus || 0) + (bonus.crit || 0), CRIT_SOFT), 0, 0.75), // LUK · เกิน 40% ได้ครึ่งเดียว
    critDmg: 1.5 + soft(LUK * 0.005 + (bonus.critDmg || 0), CRITDMG_SOFT),                                  // LUK · แรงคริเกิน +100% ได้ครึ่งเดียว
    def: Math.round(VIT * 0.65 + (bonus.def || 0)),
    eva: Math.round(AGI * 0.6 + LUK * 0.2 + (bonus.eva || 0)),
    aspd: +(Math.min(ASPD_MAX, AGI * 0.002 + DEX * 0.0004) + (bonus.aspd || 0)).toFixed(3),              // ลดคูลดาวน์ตีปกติ (AGI หลัก ≤30% + การ์ด)
    castRed: +Math.min(CAST_RED_MAX + 0.1, Math.min(CAST_RED_MAX, DEX * 0.0012) + (bonus.castRed || 0)).toFixed(3),   // DEX ≤15% + การ์ด (รวม ≤25%)                                             // ลดคูลดาวน์สกิล (DEX แบบ RO ลดเวลาร่าย)
    healPow: +(1 + (bonus.healMul || 0)).toFixed(3),                                          // พลังรักษา (อุปกรณ์สายหมอยา)
  };
}
export const ASPD_MAX = 0.3, ASPD_BUFF_MAX = 0.45, CAST_RED_MAX = 0.15;
/** ความเร็วตีจากบัฟที่ยังไม่หมด (buffs: [{ buff, until }]) */
export const buffAspd = (buffs = [], now = Date.now()) => (buffs || []).reduce((a, b) => a + (b?.until > now && b.buff?.aspd || 0), 0);
/** คูลดาวน์ตีปกติจริง (ms) หลังความเร็วตี (สเตตัส ≤30% + บัฟ รวม ≤45%) · ใช้ทั้ง client/server */
export const attackInterval = (baseCd, aspd = 0) => Math.max(260, Math.round(baseCd * (1 - Math.min(ASPD_BUFF_MAX, aspd || 0))));
/** คูลดาวน์สกิลจริง (ms) หลัง DEX */
export const skillCooldown = (cd, castRed = 0) => Math.round((cd || 0) * (1 - Math.min(CAST_RED_MAX + 0.1, castRed || 0)));

export function hitChanceOf(accuracy, eva) {
  return clamp(0.95 + (accuracy - 90 - eva) / 100, 0.6, 0.99);
}

/**
 * ทอยความเสียหาย 1 ครั้ง
 * @param {object} atk  { patk, matk, accuracy, critRate, critDmg }
 * @param {object} def  { def, eva }
 * @param {'physical'|'magic'} kind
 * @param {number} mult ตัวคูณของท่าโจมตี
 * @returns {{hit:boolean, crit:boolean, dmg:number}}
 */
export function rollDamage(atk, def, kind = 'physical', mult = 1, rng = Math.random) {
  // โอกาสโดน: ความแม่นยำ 90 เทียบกับการหลบ 0 = 95% (ผู้เล่นเริ่มที่ 85 + DEX)  (ทุก 1 แต้มต่าง = ±1%)  ต่ำสุด 60% สูงสุด 99%
  const hitChance = hitChanceOf(atk.accuracy, def.eva || 0);
  if (!(kind === 'magic' && !atk.mob) && rng() > hitChance) return { hit: false, crit: false, dmg: 0 };   // เวทย์ของผู้เล่นโดนเสมอ (แบบ RO) · ผียิงยังหลบได้

  const power = kind === 'magic' ? atk.matk : kind === 'best' ? Math.max(atk.patk, atk.matk) : atk.patk;   // best = เคล็ดวิชาผสม
  const variance = 0.9 + rng() * 0.2;
  // เวทย์ทะลุเกราะได้ครึ่งหนึ่ง
  const armor = (def.def || 0) * (kind === 'magic' ? 0.25 : 0.5);
  let dmg = Math.max(1, power * mult * variance - armor);

  const crit = rng() < atk.critRate;
  if (crit) dmg *= atk.critDmg;

  return { hit: true, crit, dmg: Math.round(dmg) };
}
