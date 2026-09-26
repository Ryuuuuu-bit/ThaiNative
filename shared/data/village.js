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
  { out: 'food_nomai',    need: { herb_bamboo: 2, pla_duk: 1 }, fee: 20 },
];

/** ยายติ๋มปรุงยาจากสมุนไพรป่าผีดุ */
export const BREWS = [
  { out: 'pot_aloe',     need: { herb_aloe: 2 }, fee: 10 },
  { out: 'mp_m',         need: { herb_lemongrass: 2 }, fee: 10 },
  { out: 'pot_turmeric', need: { herb_turmeric: 2, herb_aloe: 1 }, fee: 25 },
  { out: 'pot_anchan',   need: { herb_anchan: 2, herb_lemongrass: 1 }, fee: 25 },
  { out: 'elixir_ghost', need: { herb_mushroom: 1, herb_honey: 1, herb_turmeric: 1 }, fee: 60 },
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

export const CHEST_COSTUMES = ['cos_head_peacockq', 'cos_head_jade', 'cos_head_asura', 'cos_face_skull', 'cos_back_bat'];
export function rollChest(level, rnd = Math.random) {
  const items = [];
  const gold = Math.round((40 + rnd() * 120) * (1 + level / 6));
  if (rnd() < 0.35) items.push({ id: 'black_iron', qty: 1 });
  if (rnd() < 0.45) items.push({ id: ['herb_honey', 'herb_mushroom', 'herb_turmeric', 'herb_anchan'][Math.floor(rnd() * 4)], qty: 2 });
  if (rnd() < 0.08) items.push({ id: ['amulet_coin', 'amulet_ganesh', 'amulet_somdej', 'amulet_pidta'][Math.floor(rnd() * 4)], qty: 1 });
  if (rnd() < 0.04) items.push({ id: 'yant_guard', qty: 1 });                       // ยันต์กันลดขั้น (หายาก)
  if (rnd() < 0.03) items.push({ id: CHEST_COSTUMES[Math.floor(rnd() * CHEST_COSTUMES.length)], qty: 1 }); // ชุดแต่งตัวหายาก
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
  cost: (lv) => Math.round(80 * Math.pow(lv + 1, 1.6)),      // lv = ขั้นปัจจุบัน
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
    accessory: (lv) => ({ def: lv, CRI: Math.floor(lv / 2) }),
    accessory2: (lv) => ({ def: lv, CRI: Math.floor(lv / 2) }),
  },
};

/**
 * เควสของผู้ใหญ่ชัย (ทำตามลำดับ)  goal: { kill: monsterId | 'any', fish: fishId | 'any', n }
 * reward: { exp, gold, items: [{id, qty}] }
 */
export const QUESTS = [
  { id: 'q_fish1', lv: 1, nameTh: 'ปลาไว้กินมื้อเย็น', text: 'ป้าสาบ่นว่าครัวไม่มีปลา ไปตกปลาที่ท่าน้ำ (ซ้ายสุดของหมู่บ้าน) มาให้หน่อย',
    goal: { fish: 'any', n: 3 }, reward: { exp: 40, gold: 60, items: [{ id: 'food_pla_pao', qty: 1 }] } },
  { id: 'q_tuay', lv: 1, nameTh: 'ผีถ้วยแก้วป่วนทุ่ง', text: 'ผีถ้วยแก้วป่วนทุ่งนา วาร์ปไป Map 1 ทุ่งถ้วยแก้ว แล้วจัดการ 8 ตัว',
    goal: { kill: 'phi_tuay_kaew', n: 8 }, reward: { exp: 120, gold: 120, items: [{ id: 'hp_s', qty: 5 }] } },
  { id: 'q_herb', lv: 2, nameTh: 'สมุนไพรให้ยาย', text: 'ยายติ๋มยาใกล้หมด ไปเก็บสมุนไพรในแมพล่าผี (มีประกายวิบวับ กด F) มาให้ 5 ครั้ง',
    goal: { herb: 'any', n: 5 }, reward: { exp: 150, gold: 150, items: [{ id: 'pot_aloe', qty: 3 }] } },
  { id: 'q_camp', lv: 11, nameTh: 'เห็ดผีกลางป่าลึก', text: 'พรานบุญเล่าว่ามีเห็ดเรืองแสงขึ้นในภาค 4–5 เก็บมา 2 ครั้ง แล้วลองให้ยายปรุงยาอายุวัฒนะ',
    goal: { herb: 'herb_mushroom', n: 2 }, reward: { exp: 420, gold: 300, items: [{ id: 'herb_honey', qty: 2 }] } },
  { id: 'q_kuman', lv: 3, nameTh: 'กุมารทองหลงทาง', text: 'กุมารทองซนเกินไปแล้ว ไปสั่งสอนมันที่ Map 2 คันนากุมาร 10 ตัว',
    goal: { kill: 'kuman_thong', n: 10 }, reward: { exp: 260, gold: 200, items: [{ id: 'black_iron', qty: 1 }] } },
  { id: 'q_krasue', lv: 5, nameTh: 'กระสือกินไก่ชาวบ้าน', text: 'กระสือบินมากินไก่ในเล้า ไปปราบที่ Map 3 เล้าไก่กระสือ 6 ตัว (กลางคืนดุกว่าเดิม)',
    goal: { kill: 'krasue', n: 6 }, reward: { exp: 520, gold: 350, items: [{ id: 'mp_m', qty: 3 }] } },
  { id: 'q_chon', lv: 5, nameTh: 'ต้มยำให้ผู้ใหญ่', text: 'ผู้ใหญ่อยากกินต้มยำปลาช่อน ตกปลาช่อนมา 2 ตัว',
    goal: { fish: 'pla_chon', n: 2 }, reward: { exp: 300, gold: 250, items: [{ id: 'food_tom_yum', qty: 1 }] } },
  { id: 'q_pob', lv: 7, nameTh: 'ปอบในป่ากล้วย', text: 'มีคนเห็นปอบเพ่นพ่านที่ Map 5 หมู่บ้านร้าง กำจัด 12 ตัว',
    goal: { kill: 'phi_pob', n: 12 }, reward: { exp: 900, gold: 500, items: [{ id: 'black_iron', qty: 2 }] } },
  { id: 'q_pret', lv: 9, nameTh: 'เปรตหิวโหย', text: 'เปรตตัวสูงเท่าต้นตาลสิงอยู่ที่ Map 8 ศาลาเปรตหิวโหย ปราบ 8 ตัว',
    goal: { kill: 'pret', n: 8 }, reward: { exp: 1500, gold: 800, items: [{ id: 'hua_mu', qty: 1 }] } },
  { id: 'q_grave', lv: 11, nameTh: 'ป่าช้าไม่สงบ', text: 'ผีในภาค 4–5 (ป่าช้าวัดร้าง/หุบเขาอสุรกาย) ลุกขึ้นมาทั้งป่า ปราบผีตัวไหนก็ได้ในนั้น 20 ตัว',
    goal: { kill: 'grave', n: 20 }, reward: { exp: 3200, gold: 1500, items: [{ id: 'black_iron', qty: 3 }] } },
  { id: 'q_buek', lv: 8, nameTh: 'ตำนานปลาบึก', text: 'ปู่เล่าว่ามีปลาบึกยักษ์ในแม่น้ำหน้าหมู่บ้าน ตกมาให้ดูสักตัว',
    goal: { fish: 'pla_buek', n: 1 }, reward: { exp: 1200, gold: 1000, items: [{ id: 'takrut', qty: 1 }] } },
];

export const QUEST_BY_ID = Object.fromEntries(QUESTS.map((q) => [q.id, q]));
