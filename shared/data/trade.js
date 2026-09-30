// ============================================================
//  การค้า: ตลาดฝากขาย · ป้ายรับซื้อ (นายห้างสำเภา) · รับซื้อพิเศษประจำวัน · พ่อค้าเร่ · ร้านแลกของ
//  (ใช้ร่วม client/server · ตัวเลขทั้งหมดอยู่ที่นี่ที่เดียว)
// ============================================================
import { ITEMS, sellPrice } from './items.js';

// ---------------- ตลาดฝากขาย + ป้ายรับซื้อ ----------------
export const MARKET = {
  tax: 0.05,            // หักจากเงินที่ผู้ขายได้ (ขายผ่านตลาด / ขายให้ป้ายรับซื้อ) → เงินหายออกจากเกม
  listFee: 0.01,        // ค่าวางแผง (ไม่คืนแม้ขายไม่ออก) ขั้นต่ำ listFeeMin
  listFeeMin: 10,
  hours: 48,            // อายุแผง/ป้าย
  maxListings: 20,      // ต่อตัวละคร
  maxOrders: 10,
  maxPrice: 999_999_999, // ต่อชิ้น
  maxQty: 9999,
  hist: 8,              // จำราคาที่ขายได้ล่าสุดกี่ครั้งต่อไอเทม
};
export const MARKET_NPC = 'market';
/** ไอเทมที่ฝากขาย/รับซื้อได้ (ไม่รวมสกิน/ของผูกตัว) */
export const tradable = (id) => { const it = ITEMS[id]; return !!it && it.type !== 'skin' && !it.bound && !it.quest; };
export const listFee = (price, qty) => Math.max(MARKET.listFeeMin, Math.floor(price * qty * MARKET.listFee));
export const afterTax = (gold) => Math.floor(gold * (1 - MARKET.tax));

// ---------------- เบี้ยสำเภา (เงินตราของร้านแลกของ) ----------------
export const COIN = 'junk_coin';

// ---------------- รับซื้อพิเศษประจำวัน ----------------
/** วันตามเวลาไทย (เปลี่ยนตอนเที่ยงคืน) */
export const dayKey = (now = Date.now()) => Math.floor((now + 7 * 3600e3) / 86400e3);
const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const byType = (t) => Object.keys(ITEMS).filter((k) => !k.includes('@') && ITEMS[k].type === t);
/** NPC ที่รับซื้อ: ต่อวันแต่ละคนอยากได้ 1 อย่าง (สุ่มจากวันที่ → ทุกคนเห็นเหมือนกัน) */
export const DEMAND_NPCS = {
  cook: { who: 'ป้าสา', pool: () => byType('fish'), line: 'ป้าจะทำแกงเลี้ยงวัด อยากได้' },
  shop: { who: 'ยายติ๋ม', pool: () => byType('herb'), line: 'ยายจะต้มยาหม้อใหญ่ ขาด' },
  smith: { who: 'ลุงดำ', pool: () => ['rice_basket', 'wisp_ember', 'grave_soil', 'takhian_wood', 'phong_glow', 'rib_bone', 'chamot_scale', 'himma_fur', 'naga_scale', 'pearl_ghost', 'hell_ember'], line: 'ลุงรับงานหลอมใหญ่ ต้องใช้' },
  tailor: { who: 'แม่ช้อย', pool: () => ['blood_cloth', 'kongkoi_hair', 'himma_feather', 'makka_fruit', 'deva_silk', 'water_lily', 'dark_mist'], line: 'แม่จะตัดชุดงานวัด อยากได้' },
};
export const DEMAND = { mul: 3, min: 20, cap: 30, perCoin: 10 };   // ราคา x3 ของราคารับซื้อปกติ · วันละ 30 ชิ้นต่อคน · ทุก 10 ชิ้นได้เบี้ย 1
/** คำขอของ NPC วันนี้ → { npc, who, item, price, cap } | null */
export function demandOf(npc, day = dayKey()) {
  const d = DEMAND_NPCS[npc]; if (!d) return null;
  const pool = d.pool().filter((k) => ITEMS[k]);
  if (!pool.length) return null;
  const item = pool[hash(`${day}:${npc}`) % pool.length];
  return { npc, who: d.who, line: d.line, item, price: Math.max(DEMAND.min, Math.round(sellPrice(item) * DEMAND.mul)), cap: DEMAND.cap };
}

// ---------------- ร้านแลกของ (นายห้างสำเภา) ----------------
/** สูตรแลก: need = ของที่ต้องใช้ (รวมเบี้ย) · qty = ได้กี่ชิ้น · fee = 0 */
export const BARTER = [
  // ของดรอปทั่วไป → เบี้ย
  { out: COIN, qty: 1, need: { pret_bone: 30 }, fee: 0, util: true },
  { out: COIN, qty: 1, need: { dark_mist: 20 }, fee: 0, util: true },
  { out: COIN, qty: 1, need: { film_reel: 30 }, fee: 0, util: true },
  { out: COIN, qty: 2, need: { himma_fur: 12 }, fee: 0, util: true },
  { out: COIN, qty: 3, need: { naga_scale: 12 }, fee: 0, util: true },
  { out: COIN, qty: 4, need: { hell_ember: 12 }, fee: 0, util: true },
  // เบี้ย → ของดี
  { out: 'black_iron', qty: 10, need: { [COIN]: 1 }, fee: 0, util: true },
  { out: 'yant_home', qty: 5, need: { [COIN]: 1 }, fee: 0, util: true },
  { out: 'yant_guard', qty: 1, need: { [COIN]: 6 }, fee: 0, util: true },
  { out: 'reset_water', qty: 1, need: { [COIN]: 4 }, fee: 0, util: true },
  { out: 'asura_horn', qty: 1, need: { [COIN]: 8 }, fee: 0, util: true },
  { out: 'yak_fang', qty: 1, need: { [COIN]: 20 }, fee: 0, util: true },
  { out: 'giant_tusk', qty: 1, need: { [COIN]: 30 }, fee: 0, util: true },
  { out: 'naga_gem', qty: 1, need: { [COIN]: 45 }, fee: 0, util: true },
  { out: 'rename_ticket', qty: 1, need: { [COIN]: 40 }, fee: 0, util: true },
].filter((r) => ITEMS[r.out] && Object.keys(r.need).every((k) => ITEMS[k]));

// ---------------- พ่อค้าเร่ ----------------
export const TRAVEL = {
  everyMin: [70, 110],  // โผล่ทุก 70–110 นาที
  stayMin: 20,          // อยู่ 20 นาที
  warnMin: 5,           // เหลือ 5 นาทีประกาศเตือน
  picks: 5,             // สุ่มของขายกี่อย่างต่อรอบ
  perChar: 3,           // ซื้อของชิ้นเดียวกันได้สูงสุดกี่ชิ้นต่อรอบต่อคน (กันคนเดียวกวาด)
  name: 'พ่อค้าเร่สำเภาจีน',
  key: 'npc_peddler',
};
/** จุดที่พ่อค้าเร่มาตั้งร้าน (ไทล์ท้องถิ่นของอยุธยา · + OX ตอนใช้) */
export const TRAVEL_SPOTS = [
  { x: 60, y: 72, th: 'ลานอาหารกลางเมือง' }, { x: 48, y: 61, th: 'หน้าร้านยายติ๋ม' }, { x: 80, y: 70, th: 'ถนนคนเดินฝั่งตะวันออก' },
  { x: 41, y: 50, th: 'สี่แยกสำนักดาบ' }, { x: 71, y: 50, th: 'ลานหน้าวัง' },
];
/** ของที่พ่อค้าเร่อาจเอามาขาย: qty = จำนวนทั้งเซิร์ฟ · w = น้ำหนักสุ่ม */
export const TRAVEL_STOCK = [
  { id: 'yant_guard', qty: 20, price: 45000, w: 10 },
  { id: 'yak_fang', qty: 8, price: 180000, w: 6 },
  { id: 'rahu_stone', qty: 10, price: 250000, w: 3 },
  { id: 'giant_tusk', qty: 5, price: 220000, w: 5 },
  { id: 'naga_gem', qty: 3, price: 450000, w: 4 },
  { id: 'yama_seal', qty: 2, price: 900000, w: 3 },
  { id: 'rename_ticket', qty: 5, price: 150000, w: 3 },
  { id: 'reset_water', qty: 10, price: 30000, w: 6 },
  { id: COIN, qty: 60, price: 25000, w: 5 },
].filter((s) => ITEMS[s.id]);
