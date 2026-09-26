// ============================================================
//  โรงหลอมลุงดำ – หลอมอุปกรณ์ขั้นสูง (Lv.22–30) จากวัตถุดิบที่ดรอปจากผี
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
};
const TYPE_MUL = { weapon: 1.25, armor: 1, accessory: 0.8 };

/** รายการสูตรหลอมทั้งหมด: { out, need, fee, job, lv, type } */
export const FORGE = [
  ...GEAR_IDS.filter((id) => GEAR[id].drop).map((id) => {
    const it = GEAR[id], t = TIER_NEED[it.lv], m = TYPE_MUL[it.type] || 1;
    const need = Object.fromEntries(Object.entries(t.need).map(([k, n]) => [k, k === 'yak_fang' || k === 'asura_horn' ? n : Math.max(1, Math.round(n * m))]));
    return { out: id, need, fee: Math.round((t.fee * m) / 100) * 100, job: it.job, lv: it.lv, type: it.type };
  }).sort((a, b) => a.lv - b.lv),
  { out: 'yant_guard', need: { dark_mist: 10, pret_bone: 8, saming_fang: 4 }, fee: 800, util: true },
  { out: 'black_iron', need: { film_reel: 4, water_lily: 4 }, fee: 40, util: true },
];

export const CRAFT_LISTS = ['cook', 'brew', 'forge'];
