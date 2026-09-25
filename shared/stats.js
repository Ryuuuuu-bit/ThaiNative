// ============================================================
//  ระบบค่าพลัง (Status System)
//  STR → Physical Attack | DEX → Accuracy + Crit Rate | INT → Magic Damage
//  CRI → Critical Damage | VIT → Max HP
// ============================================================

export const STAT_KEYS = ['STR', 'DEX', 'INT', 'CRI', 'VIT'];

export const STAT_INFO = {
  STR: { nameTh: 'พลัง',     desc: 'เพิ่มพลังโจมตีกายภาพ (+2 ATK / แต้ม)' },
  DEX: { nameTh: 'ว่องไว',   desc: 'เพิ่มความแม่นยำ (+1%) และโอกาสคริติคอล (+0.4%)' },
  INT: { nameTh: 'ปัญญา',   desc: 'เพิ่มความเสียหายเวทย์ (+2.5 MATK) และ MP' },
  CRI: { nameTh: 'คริติคอล', desc: 'เพิ่มความแรงคริติคอล (+2% ต่อแต้ม)' },
  VIT: { nameTh: 'อึด',      desc: 'เพิ่ม HP สูงสุด (+12 / แต้ม)' },
};

export const POINTS_PER_LEVEL = 5;

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** EXP ที่ต้องใช้เพื่อขึ้นเลเวลถัดไป */
export function expToNext(level) {
  return Math.floor(40 * Math.pow(level, 1.6));
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
 * @param {{STR,DEX,INT,CRI,VIT}} s   ค่าพลังหลัก
 * @param {object} job                ข้อมูลอาชีพจาก classes.js
 * @param {number} level
 * @param {object} bonus              โบนัสจากอุปกรณ์ { atk, matk, def, hp, mp, crit, STR, ... }
 */
export function computeDerived(s, job, level, bonus = {}) {
  const S = (k) => (s[k] || 0) + (bonus[k] || 0);
  const STR = S('STR'), DEX = S('DEX'), INT = S('INT'), CRI = S('CRI'), VIT = S('VIT');

  return {
    maxHp: Math.round(job.baseHp + VIT * 12 + level * job.hpPerLevel + (bonus.hp || 0)),
    maxMp: Math.round(job.baseMp + INT * 6 + level * 4 + (bonus.mp || 0)),
    patk: Math.round(STR * 2 + level * 1.5 + (bonus.atk || 0)),        // STR
    matk: Math.round(INT * 2.5 + level * 1.5 + (bonus.matk || 0)),     // INT
    accuracy: 85 + DEX * 1.0,                                           // DEX (%)
    critRate: clamp(0.05 + DEX * 0.004 + (job.critBonus || 0) + (bonus.crit || 0), 0, 0.75), // DEX
    critDmg: 1.5 + CRI * 0.02,                                          // CRI
    def: Math.round(VIT * 0.5 + (bonus.def || 0)),
    eva: Math.round(DEX * 0.3),
  };
}

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
  // โอกาสโดน: ความแม่นยำ 90 เทียบกับการหลบ 0 = 95%  (ทุก 1 แต้มต่าง = ±1%)  ต่ำสุด 60% สูงสุด 99%
  const hitChance = hitChanceOf(atk.accuracy, def.eva || 0);
  if (rng() > hitChance) return { hit: false, crit: false, dmg: 0 };

  const power = kind === 'magic' ? atk.matk : atk.patk;
  const variance = 0.9 + rng() * 0.2;
  // เวทย์ทะลุเกราะได้ครึ่งหนึ่ง
  const armor = (def.def || 0) * (kind === 'magic' ? 0.25 : 0.5);
  let dmg = Math.max(1, power * mult * variance - armor);

  const crit = rng() < atk.critRate;
  if (crit) dmg *= atk.critDmg;

  return { hit: true, crit, dmg: Math.round(dmg) };
}
