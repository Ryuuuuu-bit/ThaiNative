// ============================================================
//  สายอาชีพ (Paths) + แนวต่อสู้ตามอาวุธ
//  ▸ ทุกคนเริ่มเป็น "ชาวบ้าน" (ตัวละครแบบเดียวกัน)
//  ▸ อาวุธที่ถือ = แนวต่อสู้ (ดาบ → ขุนศึก, ไม้เท้า → จอมขมังเวทย์, ธนู → พราน, มือเปล่า/ผ้าพันมือ → มวย)
//    ใช้สกิลของแนวนั้นได้เฉพาะตอนถืออาวุธที่ตรงกัน
//  ▸ Lv.10 เลือก "สายหลัก" กับผู้ใหญ่ชัย → สกิลสายหลักอัปได้ถึง Lv.5 + โบนัสติดตัว
//    สกิลสายรองอัปได้ถึง Lv.2 และใช้ท่าไม้ตาย (★) ไม่ได้
// ============================================================
export const PATH_LV = 10;          // เลเวลที่เลือกสายหลักได้
export const SUB_CAP = 2;           // เลเวลสกิลสูงสุดของสายรอง / ก่อนเลือกสาย

/** ค่าพื้นฐานของทุกคน (ชาวบ้าน) */
export const VILLAGER = {
  id: 'villager', nameTh: 'ชาวบ้าน',
  baseHp: 105, baseMp: 40, hpPerLevel: 12,
  startStats: { STR: 5, DEX: 5, INT: 5, CRI: 3, VIT: 5 },
};
export const JOBS = {
  swordman: {
    id: 'swordman', nameTh: 'ขุนศึก', nameEn: 'Swordman',
    pathTitle: 'ขุนศึกบางระจัน', pathBonus: { hpMul: 0.12, def: 4 }, pathTextTh: 'HP +12% · ป้องกัน +4',
    weaponTh: 'ดาบ', icon: '⚔️',
    desc: 'สายประชิด ถึก ตีแรง ใช้ STR เป็นหลัก',
    baseHp: 120, baseMp: 20, hpPerLevel: 14,
    startStats: { STR: 8, DEX: 4, INT: 2, CRI: 3, VIT: 8 },
    weapon: 'sword', color: '#c0392b',
    attack: { kind: 'physical', style: 'melee', range: 30, cooldown: 480, mult: 1.1, mpCost: 0 },
  },
  mage: {
    id: 'mage', nameTh: 'จอมขมังเวทย์', nameEn: 'Mage',
    pathTitle: 'หมอผีเจ็ดป่าช้า', pathBonus: { mpMul: 0.2, matkMul: 0.1 }, pathTextTh: 'MP +20% · พลังเวทย์ +10%',
    weaponTh: 'ไม้เท้า/คทา', icon: '🔮',
    desc: 'ยิงลูกไฟระยะไกล ความเสียหายเวทย์สูง ใช้ INT',
    baseHp: 80, baseMp: 60, hpPerLevel: 9,
    startStats: { STR: 2, DEX: 4, INT: 10, CRI: 3, VIT: 5 },
    weapon: 'staff', color: '#8e44ad',
    attack: { kind: 'magic', style: 'projectile', range: 220, cooldown: 700, mult: 1.35, mpCost: 3, projectile: 'fireball', speed: 230 },
  },
  archer: {
    id: 'archer', nameTh: 'พรานป่า', nameEn: 'Archer',
    pathTitle: 'พรานไพรตาเหยี่ยว', pathBonus: { crit: 0.08, patkMul: 0.05 }, pathTextTh: 'คริติคอล +8% · โจมตี +5%',
    weaponTh: 'ธนู', icon: '🏹',
    desc: 'ยิงไกล แม่นยำ คริติคอลสูง ใช้ STR + DEX',
    baseHp: 95, baseMp: 30, hpPerLevel: 11,
    startStats: { STR: 6, DEX: 9, INT: 2, CRI: 5, VIT: 5 },
    weapon: 'bow', color: '#27ae60', critBonus: 0.08,
    attack: { kind: 'physical', style: 'projectile', range: 260, cooldown: 560, mult: 1.25, mpCost: 0, projectile: 'arrow', speed: 360 },
  },
  boxer: {
    id: 'boxer', nameTh: 'นักมวยคาดเชือก', nameEn: 'Muay Thai Boxer',
    pathTitle: 'นายขนมต้มคาดเชือก', pathBonus: { hpMul: 0.06, patkMul: 0.08 }, pathTextTh: 'HP +6% · โจมตี +8%',
    weaponTh: 'มือเปล่า/ผ้าพันมือ', icon: '🥊',
    desc: 'หมัด-ศอก-เข่า ต่อยเร็ว ทุกหมัดที่ 3 เป็น "ศอกกลับ" แรง x1.8',
    baseHp: 110, baseMp: 25, hpPerLevel: 13,
    startStats: { STR: 8, DEX: 7, INT: 1, CRI: 4, VIT: 7 },
    weapon: 'wraps', color: '#e67e22',
    attack: { kind: 'physical', style: 'melee', range: 22, cooldown: 300, mult: 0.75, mpCost: 0, comboEvery: 3, comboMult: 1.8 },
  },
};

export const JOB_IDS = Object.keys(JOBS);
