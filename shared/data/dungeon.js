// ============================================================
//  ดันเจี้ยนปาร์ตี้ "สุสานใต้ดิน" – เข้าได้ 1–4 คน (ห้องแยกของใครของมัน)
//  ▸ 3 ระลอก + ระลอกบอส · จำกัดเวลา 10 นาที · ตายหมดทีม = ล้มเหลว
//  ▸ server คุมผี/ดาเมจ/รางวัลทั้งหมด (ใช้ร่วม client เพื่อแสดงผล)
// ============================================================
export const DUNGEON = {
  timeLimitMs: 10 * 60 * 1000,
  cooldownMs: 3 * 60 * 1000,                 // เข้าซ้ำได้หลังจบรอบ 3 นาที (ต่อคน)
  waves: 3,
  tiers: {
    normal: {
      nameTh: 'ปกติ', minLv: 5, level: 9, mobs: ['phi_pob', 'phi_jang_nang', 'phi_phrai', 'pret'], boss: 'pret', bossNameTh: 'เปรตเฝ้าสุสาน',
      hpMul: 1.1, atkMul: 1.0, bossHp: 16, rewards: { exp: 1800, gold: 900, items: [['hp_m', 3], ['black_iron', 2]], gearLv: 22, gearChance: 0.15 },
    },
    hard: {
      nameTh: 'ยาก', minLv: 15, level: 20, mobs: ['krahang', 'khamot', 'phi_dip', 'nang_takhian'], boss: 'tai_hong', bossNameTh: 'ผีตายโหงเจ้าสุสาน',
      hpMul: 1.25, atkMul: 1.1, bossHp: 18, rewards: { exp: 7000, gold: 3200, items: [['hp_m', 4], ['mp_m', 3], ['black_iron', 4]], gearLv: 24, gearChance: 0.45 },
    },
    hell: {
      nameTh: 'นรก', minLv: 25, level: 29, mobs: ['kong_koi', 'phi_lang_kluang', 'phi_chamot', 'phi_phong'], boss: 'pret_asura', bossNameTh: 'อสุรกายใต้พิภพ',
      hpMul: 1.4, atkMul: 1.25, bossHp: 10, rewards: { exp: 22000, gold: 9000, items: [['hp_m', 5], ['black_iron', 6], ['yak_fang', 1]], gearLv: 28, gearChance: 0.8, legendChance: 0.06 },
    },
  },
  /** จำนวนผีต่อระลอก (w เริ่ม 1, n = สมาชิก) */
  waveCount: (w, n) => 3 + w * 2 + (n - 1) * 2,
};
export const DUNGEON_TIER_IDS = Object.keys(DUNGEON.tiers);
