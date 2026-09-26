// ============================================================
//  ไอเทม & ร้านค้า NPC
//  type: consumable | weapon | armor | accessory | skin | material
//  ราคาขายคืน = 50% ของราคาซื้อ (หรือ sell ที่กำหนดไว้)
// ============================================================
export const ITEMS = {
  // ---------- ยาฟื้นฟู ----------
  hp_s:  { nameTh: 'ยาหม่องแดง (HP +60)',   type: 'consumable', icon: '🧴', price: 25,  effect: { hp: 60 } },
  hp_m:  { nameTh: 'ยาดมสมุนไพร (HP +180)', type: 'consumable', icon: '🌿', price: 70,  effect: { hp: 180 } },
  mp_s:  { nameTh: 'น้ำมะพร้าว (MP +30)',   type: 'consumable', icon: '🥥', price: 20,  effect: { mp: 30 } },
  mp_m:  { nameTh: 'ชาตะไคร้ (MP +90)',    type: 'consumable', icon: '🍵', price: 60,  effect: { mp: 90 } },

  // ---------- อาวุธ (jobs = อาชีพที่ใส่ได้) ----------
  wood_sword:  { nameTh: 'ดาบไม้ฝึก',        type: 'weapon', icon: '🗡️', price: 80,  jobs: ['swordman'], bonus: { atk: 6 } },
  iron_dab:    { nameTh: 'ดาบเหล็กน้ำพี้',     type: 'weapon', icon: '⚔️', price: 320, jobs: ['swordman'], bonus: { atk: 18, crit: 0.03 } },
  oak_staff:   { nameTh: 'ไม้เท้าไม้มะขาม',    type: 'weapon', icon: '🪄', price: 80,  jobs: ['mage'], bonus: { matk: 8, mp: 10 } },
  yant_staff:  { nameTh: 'คทาลงยันต์',       type: 'weapon', icon: '🔮', price: 340, jobs: ['mage'], bonus: { matk: 22, mp: 30 } },
  bamboo_bow:  { nameTh: 'ธนูไม้ไผ่',         type: 'weapon', icon: '🏹', price: 80,  jobs: ['archer'], bonus: { atk: 5, DEX: 2 } },
  horn_bow:    { nameTh: 'ธนูเขาควาย',        type: 'weapon', icon: '🎯', price: 330, jobs: ['archer'], bonus: { atk: 15, DEX: 4 } },
  hand_wrap:   { nameTh: 'ผ้าพันมือคาดเชือก',   type: 'weapon', icon: '🥊', price: 80,  jobs: ['boxer'], bonus: { atk: 5, STR: 1 } },
  mongkol:     { nameTh: 'มงคลศักดิ์สิทธิ์',     type: 'weapon', icon: '🪢', price: 320, jobs: ['boxer'], bonus: { atk: 14, VIT: 3, crit: 0.02 } },

  // ---------- เกราะ / เครื่องประดับ ----------
  yant_shirt:  { nameTh: 'เสื้อยันต์',         type: 'armor', icon: '👕', price: 150, bonus: { def: 5, hp: 30 } },
  takrut:      { nameTh: 'ตะกรุดโทน',        type: 'accessory', icon: '📿', price: 220, bonus: { def: 2, CRI: 4 } },
  prajiad:     { nameTh: 'ประเจียดแขน',       type: 'accessory', icon: '🎗️', price: 200, bonus: { STR: 2, DEX: 2 } },
  // เครื่องรางพระเครื่อง (ลุงดำ)
  amulet_coin:   { nameTh: 'เหรียญหลวงพ่อเงิน',  type: 'accessory', icon: '🪙', price: 380, bonus: { CRI: 3, DEX: 2 } },
  amulet_ganesh: { nameTh: 'เหรียญพระพิฆเนศ',   type: 'accessory', icon: '🐘', price: 420, bonus: { INT: 4, mp: 30 } },
  amulet_somdej: { nameTh: 'พระสมเด็จ',         type: 'accessory', icon: '🛕', price: 450, bonus: { def: 3, hp: 40 } },
  amulet_pidta:  { nameTh: 'พระปิดตา',          type: 'accessory', icon: '🙈', price: 520, bonus: { def: 4, VIT: 2 } },
  kuman_statue:  { nameTh: 'กุมารทองบูชา',      type: 'accessory', icon: '👶', price: 600, bonus: { STR: 2, DEX: 2, CRI: 2 } },
  naga_statue:   { nameTh: 'พญานาคราชบูชา',     type: 'accessory', icon: '🐉', price: 700, bonus: { hp: 80, VIT: 3 } },
  yak_statue:    { nameTh: 'ท้าวเวสสุวรรณ',      type: 'accessory', icon: '👹', price: 750, bonus: { STR: 4, def: 2 } },
  acc_yant_gold: { nameTh: 'ยันต์ทองพญายักษ์',  type: 'accessory', icon: '🏵️', sell: 400, bonus: { STR: 4, INT: 4, DEX: 3, hp: 80, def: 4 } },

  // ---------- Skin อาชีพ (ใบเปลี่ยนอาชีพ) ----------
  skin_swordman: { nameTh: 'คัมภีร์เปลี่ยนอาชีพ: ขุนศึก',  type: 'skin', icon: '📜', price: 500, job: 'swordman' },
  skin_mage:     { nameTh: 'คัมภีร์เปลี่ยนอาชีพ: จอมขมังเวทย์', type: 'skin', icon: '📜', price: 500, job: 'mage' },
  skin_archer:   { nameTh: 'คัมภีร์เปลี่ยนอาชีพ: พรานป่า',  type: 'skin', icon: '📜', price: 500, job: 'archer' },
  skin_boxer:    { nameTh: 'คัมภีร์เปลี่ยนอาชีพ: นักมวยคาดเชือก', type: 'skin', icon: '📜', price: 500, job: 'boxer' },

  // ---------- ของดรอปจากผี (ขายได้อย่างเดียว) ----------
  glass_shard:  { nameTh: 'เศษถ้วยแก้วร้าว',  type: 'material', icon: '🥃', sell: 3 },
  gold_leaf:    { nameTh: 'แผ่นทองคำเปลว',    type: 'material', icon: '✨', sell: 5 },
  krasue_hair:  { nameTh: 'เส้นผมกระสือ',     type: 'material', icon: '🧵', sell: 7 },
  banana_leaf:  { nameTh: 'ใบตองตานี',        type: 'material', icon: '🍃', sell: 8 },
  rotten_cloth: { nameTh: 'ผ้าเปื้อนปอบ',      type: 'material', icon: '🧣', sell: 10 },
  film_reel:    { nameTh: 'ม้วนฟิล์มหนังกลางแปลง', type: 'material', icon: '🎞️', sell: 13 },
  water_lily:   { nameTh: 'บัวสายผีพราย',     type: 'material', icon: '🪷', sell: 15 },
  pret_bone:    { nameTh: 'กระดูกเปรต',       type: 'material', icon: '🦴', sell: 18 },
  saming_fang:  { nameTh: 'เขี้ยวเสือสมิง',     type: 'material', icon: '🦷', sell: 24 },
  dark_mist:    { nameTh: 'หมอกดำผีห่า',      type: 'material', icon: '🌫️', sell: 30 },
  yak_fang:     { nameTh: 'เขี้ยวพญายักษ์',     type: 'material', icon: '🐗', sell: 120 },
  ha_essence:   { nameTh: 'แก่นวิญญาณผีห่า',    type: 'material', icon: '🔥', sell: 60 },
  // ป่าช้าผีตายโหง
  rice_basket:  { nameTh: 'กระด้งผีกระหัง',     type: 'material', icon: '🧺', sell: 34 },
  wisp_ember:   { nameTh: 'ประกายไฟผีโขมด',     type: 'material', icon: '✴️', sell: 34 },
  grave_soil:   { nameTh: 'ดินหลุมผีดิบ',       type: 'material', icon: '⚱️', sell: 38 },
  takhian_wood: { nameTh: 'แก่นไม้ตะเคียน',     type: 'material', icon: '🪵', sell: 40 },
  blood_cloth:  { nameTh: 'ผ้าเปื้อนเลือดตายโหง', type: 'material', icon: '🩸', sell: 44 },
  phong_glow:   { nameTh: 'จมูกเรืองแสงผีโพง',  type: 'material', icon: '🔆', sell: 44 },
  kongkoi_hair: { nameTh: 'ขนผีกองกอย',        type: 'material', icon: '🪶', sell: 48 },
  rib_bone:     { nameTh: 'ซี่โครงผีหลังกลวง',  type: 'material', icon: '🦴', sell: 50 },
  chamot_scale: { nameTh: 'เกล็ดผีจะมอด',       type: 'material', icon: '🐊', sell: 55 },
  asura_horn:   { nameTh: 'เขาเปรตอสุรกาย',     type: 'material', icon: '🦬', sell: 220 },

  // ---------- ปลา (ตกที่ท่าน้ำ ซ้ายสุดของหมู่บ้าน) – ขายป้าสา หรือให้ป้าสาทำอาหาร ----------
  pla_nin:     { nameTh: 'ปลานิล',            type: 'fish', icon: '🐟', sell: 6 },
  pla_taphian: { nameTh: 'ปลาตะเพียนเงิน',     type: 'fish', icon: '🐟', sell: 9 },
  pla_duk:     { nameTh: 'ปลาดุก',            type: 'fish', icon: '🐟', sell: 12 },
  pla_chon:    { nameTh: 'ปลาช่อน',           type: 'fish', icon: '🐟', sell: 16 },
  kung:        { nameTh: 'กุ้งแม่น้ำ',          type: 'fish', icon: '🦐', sell: 22 },
  pla_buek:    { nameTh: 'ปลาบึกยักษ์',        type: 'fish', icon: '🐋', sell: 120 },
  pla_phrai:   { nameTh: 'ปลาพรายวิญญาณ',     type: 'fish', icon: '👻', sell: 90 },
  junk_boot:   { nameTh: 'รองเท้าแตะเก่า',     type: 'material', icon: '🩴', sell: 1 },

  // ---------- อาหารฝีมือป้าสา (ฟื้น HP/MP + บัฟ) ----------
  food_pla_pao: { nameTh: 'ปลาเผาเกลือ',       type: 'food', icon: '🍢', price: 60, effect: { hp: 250 }, buff: { minutes: 10, mods: { def: 4 }, textTh: 'ป้องกัน +4' } },
  food_khao_tom:{ nameTh: 'ข้าวต้มปลา',         type: 'food', icon: '🍲', price: 55, effect: { hp: 120, mp: 80 }, buff: { minutes: 10, mods: { expMul: 1.1 }, textTh: 'EXP +10%' } },
  food_tom_yum: { nameTh: 'ต้มยำปลาช่อน',       type: 'food', icon: '🍜', price: 140, effect: { hp: 400, mp: 120 }, buff: { minutes: 15, mods: { atkMul: 0.1 }, textTh: 'โจมตี +10%' } },
  food_kung_ob: { nameTh: 'กุ้งอบวุ้นเส้น',      type: 'food', icon: '🦞', price: 220, effect: { hp: 500, mp: 200 }, buff: { minutes: 15, mods: { critAdd: 0.05, atkMul: 0.05 }, textTh: 'คริ +5% · โจมตี +5%' } },
  food_phrai:   { nameTh: 'แกงส้มปลาพราย',     type: 'food', icon: '🥘', sell: 150, effect: { hp: 800, mp: 300 }, buff: { minutes: 20, mods: { atkMul: 0.15, dropMul: 1.3 }, textTh: 'โจมตี +15% · ของดรอป +30%' } },

  // ---------- วัตถุดิบตีบวก (ลุงดำ) ----------
  black_iron:  { nameTh: 'แร่เหล็กไหล',       type: 'material', icon: '🪨', price: 60 },

  // ---------- ของถวายศาลพระภูมิ (กด F ที่ศาล) ----------
  garland:   { nameTh: 'พวงมาลัยดาวเรือง', type: 'offering', icon: '🌼', price: 30 },
  nam_daeng: { nameTh: 'น้ำแดง',           type: 'offering', icon: '🥤', price: 25 },
  khai_tom:  { nameTh: 'ไข่ต้ม',           type: 'offering', icon: '🥚', price: 35 },
  hua_mu:    { nameTh: 'หัวหมูบวงสรวง',    type: 'offering', icon: '🐷', price: 400 },
};

export function sellPrice(id) {
  const it = ITEMS[id];
  if (!it) return 0;
  return it.sell ?? Math.floor((it.price || 0) * 0.5);
}

/** NPC ร้านค้า (หมู่บ้านบางผี) */
export const SHOPS = {
  mae_kha: {
    nameTh: 'ยายติ๋ม ร้านยาและของใช้',
    greeting: 'มาจ้ะหลาน ยาดีของยาย ผีหลอกก็ไม่กลัว!',
    stock: ['hp_s', 'hp_m', 'mp_s', 'mp_m', 'garland', 'nam_daeng', 'khai_tom', 'hua_mu',
      'skin_swordman', 'skin_mage', 'skin_archer', 'skin_boxer'],
  },
  lung_dam: {
    nameTh: 'ลุงดำ โรงตีเหล็ก',
    greeting: 'เหล็กดีต้องตีตอนร้อน! อยากได้อาวุธหรือจะตีบวกก็ว่ามา',
    stock: ['wood_sword', 'iron_dab', 'oak_staff', 'yant_staff', 'bamboo_bow', 'horn_bow', 'hand_wrap', 'mongkol',
      'yant_shirt', 'takrut', 'prajiad', 'amulet_coin', 'amulet_ganesh', 'amulet_somdej', 'amulet_pidta',
      'kuman_statue', 'naga_statue', 'yak_statue', 'black_iron'],
    tabs: ['buy', 'sell', 'enhance'],
  },
  pa_sa: {
    nameTh: 'ป้าสา ครัวริมน้ำ',
    greeting: 'ได้ปลามาเหรอลูก เอามาให้ป้าทำกับข้าวให้ อร่อยจนผีต้องร้องขอ!',
    stock: ['food_khao_tom', 'food_pla_pao', 'food_tom_yum', 'food_kung_ob'],
    tabs: ['buy', 'sell', 'cook'],
  },
};

export const STARTING_GOLD = 150;
export const STARTING_ITEMS = [{ id: 'hp_s', qty: 3 }, { id: 'mp_s', qty: 2 }];
