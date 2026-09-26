// ============================================================
//  หมู่บ้านบางผี (Map 1 – Safe Zone)
//  ▸ ตกปลาที่ท่าน้ำ   ▸ ป้าสาทำอาหาร   ▸ ลุงดำตีบวก   ▸ เควสผู้ใหญ่ชัย
// ============================================================

/** ตารางปลา: w = น้ำหนักโอกาส, night = ขึ้นเฉพาะกลางคืน, hard = ความยากมินิเกม (0–1) */
export const FISH = [
  { id: 'junk_boot',   w: 10, hard: 0.05 },
  { id: 'pla_nin',     w: 34, hard: 0.15 },
  { id: 'pla_taphian', w: 24, hard: 0.3 },
  { id: 'pla_duk',     w: 16, hard: 0.4 },
  { id: 'pla_chon',    w: 10, hard: 0.55 },
  { id: 'kung',        w: 7,  hard: 0.6 },
  { id: 'pla_buek',    w: 1.2, hard: 0.9 },
  { id: 'pla_phrai',   w: 3,  hard: 0.8, night: true },
];

export function rollFish(night, rnd = Math.random) {
  const pool = FISH.filter((f) => !f.night || night);
  let r = rnd() * pool.reduce((a, f) => a + f.w, 0);
  for (const f of pool) if ((r -= f.w) <= 0) return f;
  return pool[0];
}

/** สูตรอาหารป้าสา: ใช้ปลา + ค่าแรง → อาหาร */
export const RECIPES = [
  { out: 'food_pla_pao',  need: { pla_nin: 2 }, fee: 10 },
  { out: 'food_khao_tom', need: { pla_taphian: 1, pla_nin: 1 }, fee: 10 },
  { out: 'food_tom_yum',  need: { pla_chon: 1, pla_duk: 1 }, fee: 20 },
  { out: 'food_kung_ob',  need: { kung: 2 }, fee: 30 },
  { out: 'food_phrai',    need: { pla_phrai: 1, pla_chon: 1 }, fee: 60 },
];

/** ตีบวกอุปกรณ์ (ลุงดำ) – บวกตามช่องสวมใส่ สูงสุด +10  ล้มเหลว = เสียของ ไม่ลดขั้น */
export const ENHANCE = {
  max: 10,
  cost: (lv) => Math.round(80 * Math.pow(lv + 1, 1.6)),      // lv = ขั้นปัจจุบัน
  ore: (lv) => (lv < 3 ? 0 : lv < 6 ? 1 : lv < 8 ? 2 : 3),     // แร่เหล็กไหล
  rate: (lv) => [1, 1, 0.95, 0.85, 0.75, 0.65, 0.55, 0.45, 0.38, 0.3][lv] ?? 0.3,
  // โบนัสต่อขั้น
  bonus: {
    weapon: (lv) => ({ atk: lv * 3, matk: lv * 3 }),
    armor: (lv) => ({ def: lv * 2, hp: lv * 15 }),
    accessory: (lv) => ({ def: lv, CRI: Math.floor(lv / 2) }),
  },
};

/**
 * เควสของผู้ใหญ่ชัย (ทำตามลำดับ)  goal: { kill: monsterId | 'any', fish: fishId | 'any', n }
 * reward: { exp, gold, items: [{id, qty}] }
 */
export const QUESTS = [
  { id: 'q_fish1', lv: 1, nameTh: 'ปลาไว้กินมื้อเย็น', text: 'ป้าสาบ่นว่าครัวไม่มีปลา ไปตกปลาที่ท่าน้ำ (ซ้ายสุดของหมู่บ้าน) มาให้หน่อย',
    goal: { fish: 'any', n: 3 }, reward: { exp: 40, gold: 60, items: [{ id: 'food_pla_pao', qty: 1 }] } },
  { id: 'q_tuay', lv: 1, nameTh: 'ผีถ้วยแก้วป่วนทุ่ง', text: 'ผีถ้วยแก้วออกมาป่วนทุ่งหน้าป่า ออกประตูวาร์ปไปจัดการ 8 ตัว',
    goal: { kill: 'phi_tuay_kaew', n: 8 }, reward: { exp: 120, gold: 120, items: [{ id: 'hp_s', qty: 5 }] } },
  { id: 'q_kuman', lv: 3, nameTh: 'กุมารทองหลงทาง', text: 'กุมารทองซนเกินไปแล้ว สั่งสอนมัน 10 ตัว',
    goal: { kill: 'kuman_thong', n: 10 }, reward: { exp: 260, gold: 200, items: [{ id: 'black_iron', qty: 1 }] } },
  { id: 'q_krasue', lv: 5, nameTh: 'กระสือกินไก่ชาวบ้าน', text: 'กลางคืนกระสือบินมากินไก่ในเล้า ไปปราบ 6 ตัว (ออกเฉพาะกลางคืน)',
    goal: { kill: 'krasue', n: 6 }, reward: { exp: 520, gold: 350, items: [{ id: 'mp_m', qty: 3 }] } },
  { id: 'q_chon', lv: 5, nameTh: 'ต้มยำให้ผู้ใหญ่', text: 'ผู้ใหญ่อยากกินต้มยำปลาช่อน ตกปลาช่อนมา 2 ตัว',
    goal: { fish: 'pla_chon', n: 2 }, reward: { exp: 300, gold: 250, items: [{ id: 'food_tom_yum', qty: 1 }] } },
  { id: 'q_pob', lv: 7, nameTh: 'ปอบในป่ากล้วย', text: 'มีคนเห็นปอบเดินเพ่นพ่าน กำจัด 12 ตัว',
    goal: { kill: 'phi_pob', n: 12 }, reward: { exp: 900, gold: 500, items: [{ id: 'black_iron', qty: 2 }] } },
  { id: 'q_pret', lv: 9, nameTh: 'เปรตหิวโหย', text: 'เปรตตัวสูงเท่าต้นตาลกำลังเข้าใกล้หมู่บ้าน ปราบ 8 ตัว',
    goal: { kill: 'pret', n: 8 }, reward: { exp: 1500, gold: 800, items: [{ id: 'hua_mu', qty: 1 }] } },
  { id: 'q_grave', lv: 11, nameTh: 'ป่าช้าไม่สงบ', text: 'ผีในป่าช้าตายโหงลุกขึ้นมาทั้งป่า ปราบผีอะไรก็ได้ในป่าช้า 20 ตัว',
    goal: { kill: 'grave', n: 20 }, reward: { exp: 3200, gold: 1500, items: [{ id: 'black_iron', qty: 3 }] } },
  { id: 'q_buek', lv: 8, nameTh: 'ตำนานปลาบึก', text: 'ปู่เล่าว่ามีปลาบึกยักษ์ในแม่น้ำหน้าหมู่บ้าน ตกมาให้ดูสักตัว',
    goal: { fish: 'pla_buek', n: 1 }, reward: { exp: 1200, gold: 1000, items: [{ id: 'takrut', qty: 1 }] } },
];

export const QUEST_BY_ID = Object.fromEntries(QUESTS.map((q) => [q.id, q]));
