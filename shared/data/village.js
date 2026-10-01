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

/** ปลาประจำแดน (แดนต่าง ๆ) · xp = EXP ทักษะตกปลาต่อตัว · legend = ปลาตำนาน (ประกาศทั้งเซิร์ฟ) · แมพที่ไม่มีในนี้ใช้ปลากรุงศรีฯ */
const realmFish = (xp, [a, b, c, d]) => [
  { id: 'junk_boot', w: 8, hard: 0.05, xp: 1 },
  { id: a, w: 40, hard: 0.35 + xp * 0.02, xp },
  { id: b, w: 30, hard: 0.45 + xp * 0.02, xp },
  { id: c, w: 12, hard: 0.6 + xp * 0.02, xp: xp * 2, night: true },
  { id: d, w: 0.8, hard: 0.95, xp: 40, legend: true },
];
export const FISH_BY_MAP = {
  ayutthaya: FISH,
  himmaphan: realmFish(6, ['pla_kaewhim', 'kung_rung', 'pla_khrai', 'pla_takhian_thong']),
  nagaphop: realmFish(8, ['pla_lai_nak', 'hoi_muk', 'pla_ngoen_badan', 'pla_krahoe']),
  dusit: realmFish(10, ['pla_thep', 'kung_kaew', 'pla_suwan', 'pla_thip']),
  sumeru: realmFish(12, ['pla_hin', 'pu_sithan', 'pla_nam_khaeng', 'pla_anon']),
};
export function rollFish(night, rnd = Math.random, map = 'ayutthaya') {
  const pool = (FISH_BY_MAP[map] || FISH).filter((f) => !f.night || night);
  let r = rnd() * pool.reduce((a, f) => a + f.w, 0);
  for (const f of pool) if ((r -= f.w) <= 0) return f;
  return pool[0];
}

/** สูตรอาหารป้าสา: ใช้ปลา + ค่าแรง → อาหาร */
export const RECIPES = [
  { out: 'food_pla_pao',  need: { pla_nin: 2 }, fee: 10 },
  { out: 'food_khao_tom', need: { pla_taphian: 1, pla_nin: 1 }, fee: 10 },
  { out: 'food_khao_tom', need: { rice_sheaf: 3, pla_nin: 1 }, fee: 5 },
  { out: 'food_tom_yum',  need: { pla_chon: 1, pla_duk: 1 }, fee: 20 },
  { out: 'food_kung_ob',  need: { kung: 2 }, fee: 30 },
  { out: 'food_phrai',    need: { pla_phrai: 1, pla_chon: 1 }, fee: 60 },
  { out: 'food_nomai',    need: { herb_bamboo: 2, pla_duk: 1 }, fee: 20 },
];

/** ยายติ๋มปรุงยาจากสมุนไพรป่าผีดุ */
export const BREWS = [
  { out: 'pot_aloe',     need: { herb_aloe: 2 }, fee: 10 },
  { out: 'mp_m',         need: { herb_lemongrass: 2 }, fee: 10 },
  { out: 'pot_turmeric', need: { herb_turmeric: 2, herb_aloe: 1 }, fee: 25 },
  { out: 'pot_anchan',   need: { herb_anchan: 2, herb_lemongrass: 1 }, fee: 25 },
  { out: 'elixir_ghost', need: { herb_mushroom: 1, herb_honey: 1, herb_turmeric: 1 }, fee: 60 },
  { out: 'elixir_ghost', need: { ha_essence: 2, herb_honey: 1 }, fee: 40 },
];

// ============================================================
//  Map 2: ป่าผีดุ
// ============================================================
export const HERB_RESPAWN_MS = 90000;
export const GATHER_MS = 1400;

/** หีบสมบัติโบราณ: โผล่บนแพลตฟอร์มในป่าเป็นระยะ */
export const CHEST = { everyMs: 150000, lifeMs: 100000 };
/** ชุดแต่งตัวที่ดรอปจากหีบสมบัติ (ร้านไม่ขาย) */
import { rollGearDrop } from './gear.js';
import { expToNext } from '../stats.js';

export function rollChest(level, rnd = Math.random) {
  const items = [];
  const gold = Math.round((40 + rnd() * 120) * (1 + level / 6));
  if (rnd() < 0.35) items.push({ id: 'black_iron', qty: 1 });
  if (rnd() < 0.45) items.push({ id: ['herb_honey', 'herb_mushroom', 'herb_turmeric', 'herb_anchan'][Math.floor(rnd() * 4)], qty: 2 });
  if (rnd() < 0.08) items.push({ id: ['amulet_coin', 'amulet_ganesh', 'amulet_somdej', 'amulet_pidta'][Math.floor(rnd() * 4)], qty: 1 });
  if (rnd() < 0.04) items.push({ id: 'yant_guard', qty: 1 });                       // ยันต์กันลดขั้น (หายาก)
  if (rnd() < 0.03) items.push({ id: 'junk_coin', qty: 1 }); // เบี้ยสำเภา (เดิม: ชุดแต่งตัวหายาก – เอาออกจากเกมแล้ว)
  if (rnd() < 0.08) { const g = rollGearDrop(level + 2, 1 / 0.012, rnd); if (g) items.push({ id: g, qty: 1 }); }  // อุปกรณ์ตามเลเวล (8%)
  return { gold, items };
}

/** ค่าหัวรายวันของพรานบุญ: สุ่ม 3 ใบตามเลเวล (เมล็ดสุ่ม = วันที่ + ชื่อ → ทุกคนได้ต่างกัน แต่คงที่ทั้งวัน) */
export function dailyBounties(level, dayKey, name, monsters) {
  let seed = 0;
  for (const ch of dayKey + name) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
  const pool = Object.entries(monsters).filter(([, m]) => !m.nightOnly && !m.regionBoss && m.mapId && m.level <= level + 1 && m.level >= Math.max(1, level - 5));
  const list = [];
  const used = new Set();
  for (let i = 0; i < Math.min(3, pool.length); i++) {
    let k = Math.floor(rnd() * pool.length), tries = 0;
    while (used.has(k) && tries++ < 10) k = (k + 1) % pool.length;
    used.add(k);
    const [id, m] = pool[k];
    const n = 6 + Math.floor(rnd() * 7);
    list.push({ mon: id, n, prog: 0, exp: Math.round(m.exp * n * 1.2), gold: Math.round(((m.gold[0] + m.gold[1]) / 2) * n * 1.5), claimed: false });
  }
  return list;
}

/** ตีบวกอุปกรณ์ (ลุงดำ) – บวกตามช่องสวมใส่ สูงสุด +10  ล้มเหลว = เสียของ ไม่ลดขั้น */
export const ENHANCE = {
  max: 20,
  cost: (lv, charLv = 1) => Math.round((80 * Math.pow(lv + 1, 1.6) * (1 + (Math.max(1, charLv) - 1) / 10)) / 10) * 10,   // lv = ขั้นปัจจุบัน · แพงขึ้นตามเลเวลตัวละคร (Lv.1 ×1 · Lv.150 ×15.9)
  ore: (lv) => (lv < 3 ? 0 : lv < 6 ? 1 : lv < 8 ? 2 : lv < 10 ? 3 : lv < 15 ? 5 : 8),     // แร่เหล็กไหล
  fang: (lv) => (lv >= 15 ? 1 : 0),                            // +15 ขึ้นไปต้องใช้เขี้ยวพญายักษ์ (ดรอปเรดบอส)
  rate: (lv) => [1, 1, 0.95, 0.85, 0.75, 0.65, 0.55, 0.45, 0.38, 0.3,
    0.25, 0.22, 0.19, 0.16, 0.14, 0.12, 0.1, 0.08, 0.07, 0.05][lv] ?? 0.05,
  /** ตีพลาด: ต่ำกว่า +10 ขั้นไม่ลด · +10–14 ลด 1 · +15 ขึ้นไป ลด 1 (มีโอกาส 30% ลด 2) · ยันต์กันลดขั้นกันได้ */
  drop: (lv, rng = Math.random) => (lv < 10 ? 0 : lv < 15 ? 1 : rng() < 0.3 ? 2 : 1),
  /** ระดับออร่า (ใช้ขั้นสูงสุดของอุปกรณ์): 0 ไม่มี · 1 ฟ้า +7 · 2 ม่วง +10 · 3 ทอง +13 · 4 เพลิงแดง +16 · 5 รุ้ง +20 */
  auraTier: (lv) => (lv >= 20 ? 5 : lv >= 16 ? 4 : lv >= 13 ? 3 : lv >= 10 ? 2 : lv >= 7 ? 1 : 0),
  // โบนัสต่อขั้น
  bonus: {
    weapon: (lv) => ({ atk: lv * 3, matk: lv * 3 }),
    armor: (lv) => ({ def: lv * 2, hp: lv * 15 }),
    accessory: (lv) => ({ def: lv, LUK: Math.floor(lv / 2) }),
    accessory2: (lv) => ({ def: lv, LUK: Math.floor(lv / 2) }),
    helm: (lv) => ({ def: lv, hp: lv * 8 }),
    gloves: (lv) => ({ atk: lv * 2, matk: lv * 2 }),
    boots: (lv) => ({ def: lv, eva: Math.floor(lv / 2) }),
    belt: (lv) => ({ hp: lv * 10, flaskPct: lv * 2 }),
  },
};

/**
 * เควสของผู้ใหญ่ชัย (ทำตามลำดับ)  goal: { kill: monsterId | 'any', fish: fishId | 'any', n }
 * reward: { exp, gold, items: [{id, qty}] }
 */
export const QUESTS = [
  { id: 'q_fish1', lv: 1, nameTh: 'ปลาไว้กินมื้อเย็น', text: 'ป้าสาบ่นว่าครัวไม่มีปลา ไปตกปลาริมคูเมืองหรือท่าน้ำหน้าประตูใต้ (ยืนริมน้ำ กด F) มาให้หน่อย',
    goal: { fish: 'any', n: 3 }, reward: { exp: 40, gold: 60, items: [{ id: 'food_pla_pao', qty: 1 }] } },
  { id: 'q_tuay', lv: 1, nameTh: 'หุ่นไล่กาผีสิงป่วนนา', text: 'หุ่นไล่กาในทุ่งนานอกประตูใต้ถูกผีสิง ออกไปจัดการ 8 ตัว',
    goal: { kill: 'phi_tuay_kaew', n: 8 }, reward: { exp: 120, gold: 120, items: [{ id: 'hp_s', qty: 5 }] } },
  { id: 'q_herb', lv: 2, nameTh: 'สมุนไพรให้ยาย', text: 'ยายติ๋มยาใกล้หมด ไปเก็บรวงข้าว/สมุนไพรในทุ่งนานอกประตูใต้ (มีประกายวิบวับ กด F) มาให้ 5 ครั้ง',
    goal: { herb: 'any', n: 5 }, reward: { exp: 150, gold: 150, items: [{ id: 'pot_aloe', qty: 3 }] } },
  { id: 'q_camp', lv: 11, nameTh: 'เห็ดผีกลางป่าลึก', text: 'พรานแก้วเล่าว่ามีเห็ดเรืองแสงขึ้นในป่าไผ่ปู่โสมและป่าช้าวัดร้าง เก็บมา 2 ครั้ง แล้วลองให้ยายปรุงยาอายุวัฒนะ',
    goal: { herb: 'herb_mushroom', n: 2 }, reward: { exp: 420, gold: 300, items: [{ id: 'herb_honey', qty: 2 }] } },
  { id: 'q_kuman', lv: 3, nameTh: 'กุมารทองหลงทาง', text: 'กุมารทองซนเกินไปแล้ว ไปสั่งสอนมันที่ทุ่งนาบางปะอิน (นอกประตูใต้) 10 ตัว',
    goal: { kill: 'kuman_thong', n: 10 }, reward: { exp: 260, gold: 200, items: [{ id: 'black_iron', qty: 1 }] } },
  { id: 'q_krasue', lv: 5, nameTh: 'กระสือกินไก่ชาวบ้าน', text: 'กระสือบินมากินไก่ในเล้า ออกมาเฉพาะกลางคืนในทุ่งนาบางปะอิน ปราบ 6 ตัว',
    goal: { kill: 'krasue', n: 6 }, reward: { exp: 520, gold: 350, items: [{ id: 'mp_m', qty: 3 }] } },
  { id: 'q_chon', lv: 5, nameTh: 'ต้มยำให้ผู้ใหญ่', text: 'ผู้ใหญ่อยากกินต้มยำปลาช่อน ตกปลาช่อนมา 2 ตัว',
    goal: { fish: 'pla_chon', n: 2 }, reward: { exp: 300, gold: 250, items: [{ id: 'food_tom_yum', qty: 1 }] } },
  { id: 'q_pob', lv: 7, nameTh: 'ปอบในป่ากล้วย', text: 'มีคนเห็นปอบเพ่นพ่านที่ป่าไผ่ปู่โสม (ออกประตูตะวันตก) กำจัด 12 ตัว',
    goal: { kill: 'phi_pob', n: 12 }, reward: { exp: 900, gold: 500, items: [{ id: 'black_iron', qty: 2 }] } },
  { id: 'q_pret', lv: 9, nameTh: 'เปรตหิวโหย', text: 'เปรตตัวสูงเท่าต้นตาลสิงอยู่กลางป่าไผ่ปู่โสม ปราบ 8 ตัว',
    goal: { kill: 'pret', n: 8 }, reward: { exp: 1500, gold: 800, items: [{ id: 'hp_m', qty: 5 }] } },
  { id: 'q_grave', lv: 11, nameTh: 'ป่าช้าไม่สงบ', text: 'ผีในป่าช้าวัดร้าง (ออกประตูตะวันออก) และบึงผีพรายลุกขึ้นมาทั้งป่า ปราบผีตัวไหนก็ได้ในนั้น 20 ตัว',
    goal: { kill: 'grave', n: 20 }, reward: { exp: 3200, gold: 1500, items: [{ id: 'black_iron', qty: 3 }] } },
  { id: 'q_buek', lv: 8, nameTh: 'ตำนานปลาบึก', text: 'ปู่เล่าว่ามีปลาบึกยักษ์ในแม่น้ำรอบเกาะเมือง ตกมาให้ดูสักตัว',
    goal: { fish: 'pla_buek', n: 1 }, reward: { exp: 1200, gold: 1000, items: [{ id: 'takrut', qty: 1 }] } },
  // ==== เควสอาชีพ: รับ/ส่งกับครูประจำอาชีพ (giver) · นับเฉพาะตอนถืออาวุธสายนั้น (goal.job) ====
  // ---- ครูเหม · สำนักดาบ ----
  { id: 'j_sw1', lv: 3, giver: 'kru_sword', job: 'swordman', nameTh: 'ดาบแรกของศิษย์', text: 'ครูเหมอยากเห็นฝีมือ ถือดาบออกไปฟันผีตัวไหนก็ได้ 30 ตัว',
    goal: { kill: 'any', n: 30, job: 'swordman' }, reward: { exp: 400, gold: 300, items: [{ id: 'hp_m', qty: 5 }] } },
  { id: 'j_sw2', lv: 9, giver: 'kru_sword', job: 'swordman', nameTh: 'ดาบปราบปอบ', text: 'ปอบในป่าไผ่ปู่โสมกินตับชาวบ้าน ใช้ดาบฟันให้สิ้น 20 ตัว',
    goal: { kill: 'phi_pob', n: 20, job: 'swordman' }, reward: { exp: 1600, gold: 900, items: [{ id: 'black_iron', qty: 2 }] } },
  { id: 'j_sw3', lv: 18, giver: 'kru_sword', job: 'swordman', nameTh: 'ศิษย์เอกสำนักดาบ', text: 'ศิษย์เอกต้องผ่านป่าช้า ใช้ดาบปราบผีในป่าช้าวัดร้าง/บึงผีพราย 60 ตัว',
    goal: { kill: 'grave', n: 60, job: 'swordman' }, reward: { exp: 6000, gold: 3000, items: [{ id: 'black_iron', qty: 5 }, { id: 'yant_guard', qty: 1 }] } },
  // ---- หลวงตาเผือก · หมอธรรม ----
  { id: 'j_mg1', lv: 3, giver: 'kru_mage', job: 'mage', nameTh: 'คาถาบทแรก', text: 'หลวงตาให้ลองอาคม ถือไม้เท้าปราบผีตัวไหนก็ได้ 30 ตัว',
    goal: { kill: 'any', n: 30, job: 'mage' }, reward: { exp: 400, gold: 300, items: [{ id: 'mp_m', qty: 5 }] } },
  { id: 'j_mg2', lv: 5, giver: 'kru_mage', job: 'mage', nameTh: 'ไล่กระสือ', text: 'กระสือออกกลางคืนในทุ่งนา ใช้อาคมไล่ให้หมด 15 ตัว',
    goal: { kill: 'krasue', n: 15, job: 'mage' }, reward: { exp: 1400, gold: 800, items: [{ id: 'mp_m', qty: 8 }] } },
  { id: 'j_mg3', lv: 18, giver: 'kru_mage', job: 'mage', nameTh: 'หมอธรรมแห่งป่าช้า', text: 'ป่าช้าวัดร้างมีวิญญาณร้ายสะสม ใช้อาคมปราบผีในป่าช้า/บึงผีพราย 60 ตัว',
    goal: { kill: 'grave', n: 60, job: 'mage' }, reward: { exp: 6000, gold: 3000, items: [{ id: 'black_iron', qty: 5 }, { id: 'yant_guard', qty: 1 }] } },
  // ---- พรานแก้ว · ค่ายพรานไพร ----
  { id: 'j_ar1', lv: 3, giver: 'kru_archer', job: 'archer', nameTh: 'ลูกศรดอกแรก', text: 'พรานแก้วอยากดูฝีมือ ยิงธนูปราบผีตัวไหนก็ได้ 30 ตัว',
    goal: { kill: 'any', n: 30, job: 'archer' }, reward: { exp: 400, gold: 300, items: [{ id: 'hp_m', qty: 5 }] } },
  { id: 'j_ar2', lv: 9, giver: 'kru_archer', job: 'archer', nameTh: 'ล่าเปรตยักษ์', text: 'เปรตตัวสูงเท่าต้นตาลในป่าไผ่ ยิงจากระยะไกลให้ล้ม 15 ตัว',
    goal: { kill: 'pret', n: 15, job: 'archer' }, reward: { exp: 1800, gold: 1000, items: [{ id: 'black_iron', qty: 2 }] } },
  { id: 'j_ar3', lv: 18, giver: 'kru_archer', job: 'archer', nameTh: 'นายพรานแห่งป่าช้า', text: 'พรานตัวจริงต้องล่าได้แม้ในป่าช้า ยิงผีในป่าช้า/บึงผีพราย 60 ตัว',
    goal: { kill: 'grave', n: 60, job: 'archer' }, reward: { exp: 6000, gold: 3000, items: [{ id: 'black_iron', qty: 5 }, { id: 'yant_guard', qty: 1 }] } },
  // ---- ครูแดง · ค่ายมวย ----
  { id: 'j_bx1', lv: 3, giver: 'kru_boxer', job: 'boxer', nameTh: 'หมัดแรกบนสังเวียน', text: 'ครูแดงให้ลองของจริง ใช้หมัดมวยไทยปราบผีตัวไหนก็ได้ 30 ตัว',
    goal: { kill: 'any', n: 30, job: 'boxer' }, reward: { exp: 400, gold: 300, items: [{ id: 'hp_m', qty: 5 }] } },
  { id: 'j_bx2', lv: 7, giver: 'kru_boxer', job: 'boxer', nameTh: 'ต่อยปอบให้หลาบจำ', text: 'ปอบในป่าไผ่ปู่โสมชอบรังแกคน ใช้แม่ไม้มวยไทยจัดการ 20 ตัว',
    goal: { kill: 'phi_pob', n: 20, job: 'boxer' }, reward: { exp: 1600, gold: 900, items: [{ id: 'black_iron', qty: 2 }] } },
  { id: 'j_bx3', lv: 18, giver: 'kru_boxer', job: 'boxer', nameTh: 'นักมวยใจเหล็ก', text: 'นักมวยใจเหล็กไม่กลัวผี ต่อยผีในป่าช้า/บึงผีพรายให้ได้ 60 ตัว',
    goal: { kill: 'grave', n: 60, job: 'boxer' }, reward: { exp: 6000, gold: 3000, items: [{ id: 'black_iron', qty: 5 }, { id: 'yant_guard', qty: 1 }] } },
  // ---- หมอพร · ศาลาโอสถ (ถือไม้เท้าสมุนไพรแล้วรักษาเพื่อนในปาร์ตี้) ----
  { id: 'q_heal1', lv: 3, optional: true, giver: 'kru_healer', job: 'healer', nameTh: 'ศิษย์ศาลาโอสถ', text: 'หมอพรที่ศาลาโอสถ (ข้างค่ายมวย) อยากลองฝีมือ ถือไม้เท้าสมุนไพรแล้วรักษาเพื่อนร่วมปาร์ตี้ให้ได้รวม 500 HP',
    goal: { heal: 'any', n: 500 }, reward: { exp: 300, gold: 300, items: [{ id: 'mp_m', qty: 5 }, { id: 'herb_honey', qty: 2 }] } },
  { id: 'q_heal2', lv: 12, optional: true, giver: 'kru_healer', job: 'healer', nameTh: 'หมอประจำขบวน', text: 'ขบวนล่าผีต้องมีหมอคอยดูแล ออกล่ากับเพื่อนแล้วรักษาเพื่อนให้ได้รวม 8,000 HP',
    goal: { heal: 'any', n: 8000 }, reward: { exp: 4000, gold: 2000, items: [{ id: 'hp_m', qty: 10 }, { id: 'black_iron', qty: 3 }] } },
  { id: 'q_revive', lv: 8, optional: true, giver: 'kru_healer', job: 'healer', nameTh: 'เรียกขวัญคืนร่าง', text: 'หมอพรสอนพิธีสู่ขวัญ (★ ต้องมีคีย์สโตนกิ่งหมอยา) ชุบชีวิตเพื่อนที่สลบให้ได้ 1 ครั้ง',
    goal: { revive: 'any', n: 1 }, reward: { exp: 2500, gold: 1500, items: [{ id: 'yant_guard', qty: 1 }] } },
];

// ============================================================
//  เควส Lv.8–150 (ต่อจากชุดแรก) · รางวัล EXP = สัดส่วนของ EXP ที่ต้องใช้ขึ้นเลเวลนั้น (expToNext) → สมดุลเองเมื่อปรับเส้นเลเวล
//  ▸ realm = เควสต่างแดน: รับ/ส่งกับนายกองลาดตระเวนที่ค่ายของแดน (NPC id 'quest' เหมือนผู้ใหญ่ชัย → ส่งที่ไหนก็ได้)
//  ▸ adv = เควสอาชีพขั้นสูง: goal.minLv = นับเฉพาะผีเลเวลตั้งแต่นี้ (กันไปฟาร์มผีเลเวลต่ำ)
// ============================================================
const qExp = (lv, k) => Math.round((expToNext(lv) * k) / 10) * 10;
// gear: อุปกรณ์สายของผู้ทำเควส (ตามอาวุธที่ถือ) เลเวลเท่าเควส + ค่าสุ่มตามเกรด · สุ่มตอนส่งเควส (server)
const bossGoal = (g) => g.n === 1 && !!g.kill && g.kill !== 'any';
const qGear = (lv, goal, grade = 'elite') => ({ lv: Math.min(148, lv + 2), grade: bossGoal(goal) ? 'boss' : grade });
const Q = (id, lv, nameTh, text, goal, k, gold, items = [], extra = {}) => {
  const { gear, ...rest } = extra;
  return { id, lv, nameTh, text, goal, reward: { exp: qExp(lv, k), gold, items, ...(gear ? { gear: qGear(lv, goal) } : {}) }, ...rest };
};
const it = (id, qty = 1) => ({ id, qty });
QUESTS.push(
  // ---- กรุงศรีฯ โซนลึก + บอสประจำโซน (Lv.8–28) ----
  Q('q_maenak', 8, 'ดวงวิญญาณแม่นาค', 'แม่นาคพระโขนงยังรอพี่มากอยู่กลางทุ่งนาบางปะอิน ชวนเพื่อนไปปลดปล่อยนาง (บอส)', { kill: 'mae_nak', n: 1 }, 1.5, 800, [it('hp_m', 5), it('black_iron', 2)], { gear: true }),
  Q('q_pusom', 14, 'ขุมทรัพย์ปู่โสม', 'ปู่โสมเฝ้าทรัพย์กลางป่าไผ่ไม่ยอมให้ใครเข้าใกล้ ปราบให้ได้แล้วทรัพย์จะกลับคืนสู่ชาวบ้าน (บอส)', { kill: 'pu_som', n: 1 }, 1.5, 1500, [it('black_iron', 3), it('yant_guard', 1)], { gear: true }),
  Q('q_dip', 15, 'ผีดิบลุกจากหลุม', 'ผีดิบคลานขึ้นจากหลุมในป่าช้าวัดร้าง (ออกประตูตะวันออก) ฝังพวกมันกลับลงไป 20 ตัว', { kill: 'phi_dip', n: 20 }, 1.0, 1200, [it('hp_m', 5)]),
  Q('q_taihong', 17, 'ตายโหงไม่ไปผุดไปเกิด', 'วิญญาณคนตายโหงวนเวียนในป่าช้าวัดร้าง ส่งพวกมันไปสู่ที่ชอบ 20 ตัว', { kill: 'tai_hong', n: 20 }, 1.0, 1500, [it('mp_m', 5)]),
  Q('q_lang', 19, 'หลังกลวงหลอกคน', 'ผีหลังกลวงแปลงเป็นหญิงงามล่อคนเข้าป่าช้า ปราบ 20 ตัว', { kill: 'phi_lang_kluang', n: 20 }, 1.0, 1800, [it('black_iron', 2)]),
  Q('q_khamot', 20, 'ไฟผีโขมดกลางบึง', 'แสงไฟผีโขมดล่อคนเดินลงบึงผีพราย (ใต้ป่าช้า) ดับไฟพวกมัน 20 ตัว', { kill: 'khamot', n: 20 }, 1.0, 2000, [it('hp_m', 8)]),
  Q('q_asura', 22, 'เปรตอสุรกายแห่งป่าช้า', 'เปรตอสุรกายตัวใหญ่ที่สุดในป่าช้าวัดร้างออกอาละวาด รวมพลไปปราบ (บอส)', { kill: 'pret_asura', n: 1 }, 1.5, 3000, [it('black_iron', 4), it('yant_guard', 1)], { gear: true }),
  Q('q_takhian', 22, 'นางไม้ต้นตะเคียน', 'ใครตัดต้นตะเคียนริมบึงผีพรายโดนนางตะเคียนตามหลอก ปราบ 20 ตน', { kill: 'nang_takhian', n: 20 }, 1.0, 2400, [it('mp_m', 8)]),
  Q('q_krahang', 23, 'กระหังบินข้ามบึง', 'ผีกระหังกระพือกระด้งบินข้ามบึงผีพรายมาขโมยของ ปราบ 20 ตัว', { kill: 'krahang', n: 20 }, 1.0, 2600, [it('black_iron', 3)]),
  Q('q_chamot', 26, 'เกล็ดจะมอดในบึงลึก', 'ผีจะมอดเฝ้าบึงลึกที่ชาละวันซ่อนตัว เคลียร์ทางไป 20 ตัว', { kill: 'phi_chamot', n: 20 }, 1.0, 3200, [it('hp_m', 10), it('black_iron', 3)]),
  Q('q_chalawan', 28, 'ปราบพญาชาละวัน', 'พญาชาละวันจระเข้ยักษ์คุมบึงผีพรายและประตูมิติหิมพานต์ ปราบมันแล้วเจ้าจะพร้อมข้ามแดน (บอส)', { kill: 'chalawan', n: 1 }, 1.5, 5000, [it('yak_fang', 3), it('yant_guard', 1)], { gear: true }),
);

/** เควสต่างแดน: มอน 4 ชนิด + ปลากลางคืน (นรกภูมิไม่มีน้ำ → ล่าผีรวมแทน) + บอสแดน */
const realmQuests = (realm, rows) => rows.map(([id, lv, nameTh, text, goal, k, gold, items]) => Q(id, lv, nameTh, text, goal, k, gold, items, { realm, gear: true }));
QUESTS.push(
  ...realmQuests('himmaphan', [
    ['r_hm1', 30, 'ยักษ์กุมภัณฑ์ขวางทาง', 'นายกองลาดตระเวนหิมพานต์ขอกำลังเสริม ยักษ์กุมภัณฑ์ยึดทางเข้าป่า ปราบ 40 ตน', { kill: 'kumphan', n: 40 }, 1.0, 5000, [it('flask_hp7')]],
    ['r_hm2', 35, 'คชสีห์คลั่ง', 'คชสีห์ครึ่งสิงห์ครึ่งช้างคลั่งไล่ขวิดผู้คน ปราบ 40 ตัว', { kill: 'khotchasi', n: 40 }, 1.0, 6500, [it('black_iron', 4), it('yak_fang', 1)]],
    ['r_hm3', 40, 'ปีกนกหัสดีลิงค์', 'นกหัสดีลิงค์ตัวโตเท่าช้างโฉบเอาคนไป ยิงมันลงมา 40 ตัว', { kill: 'hatsadiling', n: 40 }, 1.0, 8000, [it('flask_mp7')]],
    ['r_hm4', 44, 'มักกะลีผลกลายเป็นพราย', 'นารีผลบนต้นมักกะลีกลายเป็นพรายหลอกฤๅษี ปราบ 40 ตน', { kill: 'makkaliphon', n: 40 }, 1.0, 9500, [it('black_iron', 5), it('yak_fang', 2)]],
    ['r_hm5', 32, 'ปลากรายทองใต้แสงจันทร์', 'ฤๅษีอยากได้ปลากรายทองที่ขึ้นเฉพาะกลางคืนในลำธารหิมพานต์ ตกมาให้ 2 ตัว (ยืนริมน้ำ กด F)', { fish: 'pla_khrai', n: 2 }, 0.6, 3000, [it('herb_honey', 3)]],
    ['r_hm6', 47, 'กุมภกรรณตื่นจากนิทรา', 'กุมภกรรณยักษ์ใหญ่ตื่นในถ้ำ ทั้งป่าสั่นสะเทือน รวมพลไปปราบ (บอส)', { kill: 'kumphakan', n: 1 }, 2.0, 15000, [it('yak_fang', 4), it('yant_guard', 1)]],
  ]),
  ...realmQuests('nagaphop', [
    ['r_ng1', 50, 'นาคพรายเฝ้าบาดาล', 'นาคพรายไล่รัดคนที่ลงมาเมืองบาดาล ปราบ 40 ตน', { kill: 'nak_phrai', n: 40 }, 1.0, 11000, [it('flask_hp8')]],
    ['r_ng2', 55, 'เสียงเพลงเงือกผี', 'เสียงเพลงของเงือกผีล่อคนจมน้ำ ปราบ 40 ตน', { kill: 'ngueak_phi', n: 40 }, 1.0, 12500, [it('black_iron', 5), it('yak_fang', 2)]],
    ['r_ng3', 60, 'ปลาผีเขี้ยวแก้ว', 'ฝูงปลาผีเขี้ยวแก้วกัดเสาศาลาท่าน้ำพัง ปราบ 40 ตัว', { kill: 'pla_khiao', n: 40 }, 1.0, 14000, [it('flask_mp8')]],
    ['r_ng4', 65, 'กองทัพทหารนาค', 'ทหารนาคเกล็ดเงินเดินทัพออกจากท้องพระโรง สกัดไว้ 30 ตน', { kill: 'tahan_nak', n: 30 }, 1.0, 16000, [it('black_iron', 6), it('yak_fang', 2)]],
    ['r_ng5', 52, 'ปลาเงินบาดาล', 'ปลาเงินบาดาลขึ้นเฉพาะกลางคืน นายกองอยากได้ไปถวายเจ้าเมือง ตกมา 2 ตัว', { fish: 'pla_ngoen_badan', n: 2 }, 0.6, 6000, [it('herb_honey', 3)]],
    ['r_ng6', 72, 'พญาอนันตนาคราช', 'พญาอนันตนาคราชกริ้วที่มนุษย์บุกรุกบาดาล สยบให้ได้ (บอส)', { kill: 'anantanak', n: 1 }, 2.0, 25000, [it('yak_fang', 5), it('yant_guard', 1)]],
  ]),
  ...realmQuests('naraka', [
    ['r_nr1', 76, 'นายนิรยบาลคุมขุมนรก', 'นิรยบาลไล่ต้อนวิญญาณหลงทาง ปลดปล่อยพวกเขาด้วยการปราบ 40 ตน', { kill: 'niraiyaban', n: 40 }, 1.0, 18000, [it('flask_hp9')]],
    ['r_nr2', 81, 'เปรตปากเท่ารูเข็ม', 'เปรตปากเข็มหิวโหยรุมทึ้งคนเป็น ปราบ 40 ตน', { kill: 'pret_khem', n: 40 }, 1.0, 20000, [it('black_iron', 6), it('yak_fang', 2)]],
    ['r_nr3', 86, 'ต้นงิ้วหนามเหล็ก', 'ผีต้นงิ้วยื่นหนามเหล็กแทงทุกคนที่ผ่าน ปราบ 40 ต้น', { kill: 'phi_ton_ngiw', n: 40 }, 1.0, 22000, [it('flask_mp9')]],
    ['r_nr4', 91, 'ยมทูตเงา', 'ยมทูตเงาตามล่าคนที่ยังไม่ถึงฆาต สกัดไว้ 30 ตน', { kill: 'yommathut', n: 30 }, 1.0, 24000, [it('black_iron', 7), it('yak_fang', 3)]],
    ['r_nr5', 80, 'ไฟนรกไม่มอด', 'ปราบผีตัวไหนก็ได้ในนรกภูมิ (Lv.75 ขึ้นไป) 100 ตัว ให้ไฟนรกเบาลงบ้าง', { kill: 'any', minLv: 75, n: 100 }, 1.2, 20000, [it('flask_hp9'), it('flask_mp9')]],
    ['r_nr6', 96, 'ตัดสินพญายม', 'พญายมราชตัดสินให้เจ้าตกนรก พิสูจน์ว่าเจ้าไม่สมควรด้วยการชนะ (บอส)', { kill: 'phaya_yom', n: 1 }, 2.0, 40000, [it('yak_fang', 6), it('yant_guard', 2)]],
  ]),
  ...realmQuests('dusit', [
    ['r_ds1', 100, 'คนธรรพ์คลั่งเพลง', 'คนธรรพ์เสียสติดีดพิณจนเทวดาปวดหัว ปราบ 40 ตน', { kill: 'khon_thanpha', n: 40 }, 1.0, 26000, [it('flask_hp10')]],
    ['r_ds2', 105, 'กินรีเงา', 'เงาของกินรีหลุดออกมาทำร้ายผู้คนในสวนสวรรค์ ปราบ 40 ตน', { kill: 'kinnaree_ngao', n: 40 }, 1.0, 28000, [it('black_iron', 8), it('yak_fang', 3)]],
    ['r_ds3', 111, 'เทพอสูรกบฏ', 'เทพอสูรตั้งทัพกบฏล้อมศาลาเทวสภา ปราบ 40 ตน', { kill: 'thep_asura', n: 40 }, 1.0, 30000, [it('flask_mp10')]],
    ['r_ds4', 117, 'ทวารบาลทรยศ', 'ยักษ์ทวารบาลเปิดประตูสวรรค์ให้อสูร ลงโทษ 30 ตน', { kill: 'yak_thawarn', n: 30 }, 1.0, 32000, [it('black_iron', 9), it('yak_fang', 4)]],
    ['r_ds5', 103, 'ปลาสุวรรณแห่งสระทิพย์', 'ปลาสุวรรณขึ้นเฉพาะกลางคืนในสระทิพย์ เทวดาอยากชมสักครั้ง ตกมา 2 ตัว', { fish: 'pla_suwan', n: 2 }, 0.6, 14000, [it('herb_honey', 5)]],
    ['r_ds6', 122, 'ราหูอมจันทร์', 'พระราหูในลานราหูอมจันทร์กลืนแสงจันทร์ของสวรรค์ รวมพลไปปราบ (บอส)', { kill: 'phra_rahu', n: 1 }, 2.0, 55000, [it('yak_fang', 8), it('yant_guard', 2)]],
  ]),
  ...realmQuests('sumeru', [
    ['r_sm1', 126, 'ครุฑดำโฉบยอดเขา', 'ครุฑดำโฉบจับนักเดินทางที่ปีนเขาพระสุเมรุ ปราบ 40 ตน', { kill: 'krut_dam', n: 40 }, 1.0, 36000, [it('flask_hp10', 2)]],
    ['r_sm2', 131, 'นาคเฝ้าเขาสุเมรุ', 'นาคเฝ้าเขาถูกพญามารสะกดให้คลั่ง ปลดปล่อย 40 ตน', { kill: 'nak_sumeru', n: 40 }, 1.0, 38000, [it('black_iron', 10), it('yak_fang', 4)]],
    ['r_sm3', 137, 'อสูรเพลิงกัลป์', 'อสูรเพลิงกัลป์จุดไฟเผาเชิงเขา ดับไฟ 40 ตน', { kill: 'asura_fire', n: 40 }, 1.0, 40000, [it('flask_mp10', 2)]],
    ['r_sm4', 143, 'รากษสจักรวาล', 'รากษสจักรวาลกองทัพสุดท้ายของพญามาร ปราบ 30 ตน', { kill: 'rakkhasa', n: 30 }, 1.0, 44000, [it('black_iron', 12), it('yak_fang', 5)]],
    ['r_sm5', 128, 'ปลาน้ำแข็งเชิงเขา', 'ปลาน้ำแข็งขึ้นเฉพาะกลางคืนในธารน้ำแข็งเชิงเขาสุเมรุ ตกมา 2 ตัว', { fish: 'pla_nam_khaeng', n: 2 }, 0.6, 20000, [it('herb_honey', 5)]],
    ['r_sm6', 147, 'พญามาราธิราช', 'พญามาราธิราชบนยอดเขาคือจุดจบของการเดินทาง รวมยอดฝีมือทั้งเซิร์ฟไปปราบ (บอส)', { kill: 'phaya_mara', n: 1 }, 2.0, 80000, [it('yak_fang', 10), it('yant_guard', 3)]],
  ]),
);

/** เควสอาชีพขั้นสูง: ครูละ 4 ขั้น (Lv.30/60/95/130) · นับเฉพาะผีเลเวลตั้งแต่ minLv ขึ้นไป */
const ADV = [[30, 28, 120, 'ศิษย์ข้ามแดน'], [60, 50, 150, 'ยอดฝีมือบาดาล'], [95, 75, 180, 'ผู้ฝ่าขุมนรก'], [130, 100, 200, 'ปรมาจารย์ไตรภูมิ']];
const ADV_JOB = [
  ['sw', 'kru_sword', 'swordman', 'ครูเหมอยากรู้ว่าดาบของเอ็งคมพอจะฟันผีต่างแดนหรือยัง ถือดาบปราบ'],
  ['mg', 'kru_mage', 'mage', 'หลวงตาให้พิสูจน์อาคมกับผีต่างแดน ถือไม้เท้าอาคมปราบ'],
  ['ar', 'kru_archer', 'archer', 'พรานแก้วอยากรู้ว่าลูกศรเอ็งเจาะเกราะผีต่างแดนได้ไหม ยิงธนูปราบ'],
  ['bx', 'kru_boxer', 'boxer', 'ครูแดงให้ขึ้นสังเวียนกับผีต่างแดน ใช้หมัดมวยไทยปราบ'],
];
const advItems = (i) => [[it('flask_hp7'), it('yak_fang', 2)], [it('flask_hp8'), it('yak_fang', 3), it('yant_guard')], [it('flask_hp9'), it('yak_fang', 5), it('yant_guard')], [it('flask_hp10', 2), it('yak_fang', 8), it('yant_guard', 2)]][i];
for (const [key, giver, job, text] of ADV_JOB) ADV.forEach(([lv, minLv, n, title], i) => QUESTS.push(
  Q(`j_${key}${i + 4}`, lv, title, `${text}ผีเลเวล ${minLv} ขึ้นไป ${n} ตัว`, { kill: 'any', minLv, n, job }, 1.5, lv * 200, advItems(i), { giver, job, adv: true, gear: true })));
[[35, 40000], [65, 150000], [100, 400000], [130, 800000]].forEach(([lv, n], i) => QUESTS.push(
  Q(`q_heal${i + 3}`, lv, ['หมอยาข้ามแดน', 'หมอหลวงบาดาล', 'ผู้ต่อชีวิตในนรก', 'หมอเทวดา'][i], `หมอพรให้ติดตามขบวนล่าผีต่างแดน รักษาเพื่อนร่วมปาร์ตี้รวม ${n.toLocaleString('en-US')} HP`,
    { heal: 'any', n }, 1.5, lv * 200, advItems(i), { giver: 'kru_healer', job: 'healer', optional: true, adv: true, gear: true })));

// ทุกเควสให้อุปกรณ์สายของผู้ทำ (เควสที่ไม่ได้กำหนดเกรด = ธรรมดา ค่าสุ่ม 0–3 บรรทัด)
for (const q of QUESTS) q.reward.gear ||= qGear(q.lv, q.goal, 'normal');

export const QUEST_BY_ID = Object.fromEntries(QUESTS.map((q) => [q.id, q]));
/** ผู้ให้เควส: 'quest' = ผู้ใหญ่ชัย (เควสทั่วไป ทุกอาชีพ) · kru_* = ครูประจำอาชีพ */
export const questGiver = (q) => q?.giver || 'quest';
export const GIVER_TH = { quest: 'ผู้ใหญ่ชัย', kru_sword: 'ครูเหม', kru_mage: 'หลวงตาเผือก', kru_archer: 'พรานแก้ว', kru_boxer: 'ครูแดง', kru_healer: 'หมอพร' };
