// ============================================================
//  โรงหลอมลุงดำ – หลอมอุปกรณ์ขั้นสูง (Lv.22–95) จากวัตถุดิบที่ดรอปจากผี (Lv.35+ ใช้วัตถุดิบแมพต่างแดน)
//  ▸ ของดรอปภาค 3–5 + แร่เหล็กไหล + ค่าแรง → อุปกรณ์สายที่เลือก (ไม่ต้องรอดวงดรอป)
//  ▸ ยันต์กันลดขั้นก็หลอมได้จากวัตถุดิบภาค 2–3
// ============================================================
import { GEAR, GEAR_IDS } from './gear.js';

/** วัตถุดิบตามเลเวลอุปกรณ์ */
const TIER_NEED = {
  22: { need: { rice_basket: 6, wisp_ember: 6, black_iron: 4 }, fee: 5000 },
  24: { need: { grave_soil: 6, takhian_wood: 6, black_iron: 5 }, fee: 7000 },
  26: { need: { blood_cloth: 6, phong_glow: 6, black_iron: 6 }, fee: 9500 },
  28: { need: { kongkoi_hair: 7, rib_bone: 7, black_iron: 8 }, fee: 12500 },
  30: { need: { chamot_scale: 8, asura_horn: 2, black_iron: 10, yak_fang: 1 }, fee: 18000 },
  // ---- แมพต่างแดน (ของขั้นสูง Lv.35–95) ----
  35: { need: { himma_fur: 8, black_iron: 10 }, fee: 24000 },
  40: { need: { himma_fur: 8, himma_feather: 6, black_iron: 12 }, fee: 30000 },
  45: { need: { himma_feather: 8, makka_fruit: 6, black_iron: 14 }, fee: 38000 },
  50: { need: { makka_fruit: 10, himma_feather: 8, black_iron: 16, giant_tusk: 1 }, fee: 48000 },
  55: { need: { naga_scale: 8, black_iron: 18 }, fee: 58000 },
  60: { need: { naga_scale: 10, pearl_ghost: 6, black_iron: 20 }, fee: 70000 },
  65: { need: { pearl_ghost: 10, naga_scale: 10, black_iron: 22 }, fee: 84000 },
  70: { need: { pearl_ghost: 12, naga_scale: 12, black_iron: 24 }, fee: 100000 },
  75: { need: { pearl_ghost: 14, naga_scale: 14, black_iron: 26, naga_gem: 1 }, fee: 120000 },
  80: { need: { hell_ember: 10, black_iron: 28 }, fee: 140000 },
  85: { need: { hell_ember: 12, ngiw_thorn: 8, black_iron: 30 }, fee: 165000 },
  90: { need: { ngiw_thorn: 12, hell_ember: 12, black_iron: 32 }, fee: 190000 },
  95: { need: { ngiw_thorn: 14, hell_ember: 14, black_iron: 35, yama_seal: 1 }, fee: 230000 },
};
const FIXED = new Set(['yak_fang', 'asura_horn', 'giant_tusk', 'naga_gem', 'yama_seal']);   // วัตถุดิบบอส: จำนวนเท่ากันทุกชิ้น
const TYPE_MUL = { weapon: 1.25, armor: 1, accessory: 0.8, helm: 0.7, gloves: 0.7, boots: 0.7, belt: 0.6 };

/** รายการสูตรหลอมทั้งหมด: { out, need, fee, job, lv, type } */
export const FORGE = [
  ...GEAR_IDS.filter((id) => GEAR[id].drop).map((id) => {
    const it = GEAR[id], t = TIER_NEED[it.lv], m = TYPE_MUL[it.type] || 1;
    const need = Object.fromEntries(Object.entries(t.need).map(([k, n]) => [k, FIXED.has(k) ? n : Math.max(1, Math.round(n * m))]));
    return { out: id, need, fee: Math.round((t.fee * m) / 100) * 100, job: it.job, lv: it.lv, type: it.type };
  }).sort((a, b) => a.lv - b.lv),
  { out: 'yant_guard', need: { dark_mist: 10, pret_bone: 8, saming_fang: 4 }, fee: 800, util: true },
  { out: 'black_iron', need: { film_reel: 4, water_lily: 4 }, fee: 40, util: true },
];

export const CRAFT_LISTS = ['cook', 'brew', 'forge'];
