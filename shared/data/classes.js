// ============================================================
//  อาชีพ (Jobs / Class Skins) – 4 สายอาชีพ
// ============================================================
export const JOBS = {
  swordman: {
    id: 'swordman', nameTh: 'ขุนศึก', nameEn: 'Swordman',
    desc: 'สายประชิด ถึก ตีแรง ใช้ STR เป็นหลัก',
    baseHp: 120, baseMp: 20, hpPerLevel: 14,
    startStats: { STR: 8, DEX: 4, INT: 2, CRI: 3, VIT: 8 },
    weapon: 'sword', color: '#c0392b',
    attack: { kind: 'physical', style: 'melee', range: 30, cooldown: 480, mult: 1.1, mpCost: 0 },
  },
  mage: {
    id: 'mage', nameTh: 'จอมขมังเวทย์', nameEn: 'Mage',
    desc: 'ยิงลูกไฟระยะไกล ความเสียหายเวทย์สูง ใช้ INT',
    baseHp: 80, baseMp: 60, hpPerLevel: 9,
    startStats: { STR: 2, DEX: 4, INT: 10, CRI: 3, VIT: 5 },
    weapon: 'staff', color: '#8e44ad',
    attack: { kind: 'magic', style: 'projectile', range: 220, cooldown: 700, mult: 1.35, mpCost: 3, projectile: 'fireball', speed: 230 },
  },
  archer: {
    id: 'archer', nameTh: 'พรานป่า', nameEn: 'Archer',
    desc: 'ยิงไกล แม่นยำ คริติคอลสูง ใช้ STR + DEX',
    baseHp: 95, baseMp: 30, hpPerLevel: 11,
    startStats: { STR: 6, DEX: 9, INT: 2, CRI: 5, VIT: 5 },
    weapon: 'bow', color: '#27ae60', critBonus: 0.08,
    attack: { kind: 'physical', style: 'projectile', range: 260, cooldown: 560, mult: 1.25, mpCost: 0, projectile: 'arrow', speed: 360 },
  },
  boxer: {
    id: 'boxer', nameTh: 'นักมวยคาดเชือก', nameEn: 'Muay Thai Boxer',
    desc: 'หมัด-ศอก-เข่า ต่อยเร็ว ทุกหมัดที่ 3 เป็น "ศอกกลับ" แรง x1.8',
    baseHp: 110, baseMp: 25, hpPerLevel: 13,
    startStats: { STR: 8, DEX: 7, INT: 1, CRI: 4, VIT: 7 },
    weapon: 'wraps', color: '#e67e22',
    attack: { kind: 'physical', style: 'melee', range: 22, cooldown: 300, mult: 0.75, mpCost: 0, comboEvery: 3, comboMult: 1.8 },
  },
};

export const JOB_IDS = Object.keys(JOBS);
