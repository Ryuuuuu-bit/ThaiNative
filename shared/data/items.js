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

/** NPC ร้านค้า */
export const SHOPS = {
  mae_kha: {
    nameTh: 'ป้าติ๋ม ร้านโชห่วย',
    greeting: 'มาจ้ะหลาน ของดีราคาถูก ผีหลอกก็ไม่กลัว!',
    stock: ['hp_s', 'hp_m', 'mp_s', 'mp_m', 'garland', 'nam_daeng', 'khai_tom', 'hua_mu', 'yant_shirt', 'takrut', 'prajiad',
      'wood_sword', 'iron_dab', 'oak_staff', 'yant_staff', 'bamboo_bow', 'horn_bow', 'hand_wrap', 'mongkol',
      'skin_swordman', 'skin_mage', 'skin_archer', 'skin_boxer'],
  },
};

export const STARTING_GOLD = 150;
export const STARTING_ITEMS = [{ id: 'hp_s', qty: 3 }, { id: 'mp_s', qty: 2 }];
