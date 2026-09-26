// ============================================================
//  ไอเทม & ร้านค้า NPC
//  type: consumable | weapon | armor | accessory | skin | material
//  ราคาขายคืน = 50% ของราคาซื้อ (หรือ sell ที่กำหนดไว้)
// ============================================================
import { GEAR, gearShopStock } from './gear.js';

export const ITEMS = {
  // ---------- ยาฟื้นฟู ----------
  hp_s:  { nameTh: 'ยาหม่องแดง (HP +60)',   type: 'consumable', icon: '🧴', price: 25,  effect: { hp: 60 } },
  hp_m:  { nameTh: 'ยาดมสมุนไพร (HP +180)', type: 'consumable', icon: '🌿', price: 70,  effect: { hp: 180 } },
  mp_s:  { nameTh: 'น้ำมะพร้าว (MP +30)',   type: 'consumable', icon: '🥥', price: 20,  effect: { mp: 30 } },
  mp_m:  { nameTh: 'ชาตะไคร้ (MP +90)',    type: 'consumable', icon: '🍵', price: 60,  effect: { mp: 90 } },
  yant_home: { nameTh: 'ยันต์คืนถิ่น (วาร์ปกลับหมู่บ้าน)', type: 'home', icon: '🏠', price: 40, desc: 'ร่าย 2.5 วิ (ห้ามขยับ/โดนตี) แล้ววาร์ปกลับหมู่บ้าน · ปุ่ม B' },

  // ---------- อาวุธ (ใครก็ถือได้ · wtype = แนวต่อสู้/สกิลที่ใช้ได้ · แสดงในมือตัวละคร) ----------
  wood_sword:  { nameTh: 'ดาบไม้ฝึก',        type: 'weapon', icon: '🗡️', price: 80,  sell: 10, wtype: 'sword', bonus: { atk: 6 } },
  iron_dab:    { nameTh: 'ดาบเหล็กน้ำพี้',     type: 'weapon', icon: '⚔️', price: 320, wtype: 'sword', bonus: { atk: 18, crit: 0.03 } },
  oak_staff:   { nameTh: 'ไม้เท้าไม้มะขาม',    type: 'weapon', icon: '🪄', price: 80,  sell: 10, wtype: 'staff', bonus: { matk: 8, mp: 10 } },
  yant_staff:  { nameTh: 'คทาลงยันต์',       type: 'weapon', icon: '🔮', price: 340, wtype: 'staff', bonus: { matk: 22, mp: 30 } },
  bamboo_bow:  { nameTh: 'ธนูไม้ไผ่',         type: 'weapon', icon: '🏹', price: 80,  sell: 10, wtype: 'bow', bonus: { atk: 5, DEX: 2 } },
  horn_bow:    { nameTh: 'ธนูเขาควาย',        type: 'weapon', icon: '🎯', price: 330, wtype: 'bow', bonus: { atk: 15, DEX: 4 } },
  hand_wrap:   { nameTh: 'ผ้าพันมือคาดเชือก',   type: 'weapon', icon: '🥊', price: 80,  wtype: 'wraps', bonus: { atk: 5, STR: 1 } },
  mongkol:     { nameTh: 'มงคลศักดิ์สิทธิ์',     type: 'weapon', icon: '🪢', price: 320, wtype: 'wraps', bonus: { atk: 14, VIT: 3, crit: 0.02 } },

  // ---------- เกราะ / เครื่องประดับ ----------
  yant_shirt:  { nameTh: 'เสื้อยันต์',         type: 'armor', icon: '👕', price: 150, bonus: { def: 5, hp: 30 }, look: { top: '#f2efe6', bottom: '#5d4037' } },
  // ชุดประจำสาย (ได้จากผู้ใหญ่ชัยเมื่อเลือกสายหลัก Lv.10) – look = สีชุดที่แสดงบนตัวละคร
  armor_swordman: { nameTh: 'เกราะนักรบบางระจัน', type: 'armor', icon: '🛡️', sell: 60, path: 'swordman', bonus: { def: 9, hp: 70 }, look: { top: '#922b21', bottom: '#4a2511' } },
  armor_mage:     { nameTh: 'ผ้ายันต์หมอผีเจ็ดป่าช้า', type: 'armor', icon: '🧥', sell: 60, path: 'mage', bonus: { def: 5, mp: 50, matk: 6 }, look: { top: '#1c1c1c', bottom: '#4a235a' } },
  armor_archer:   { nameTh: 'ชุดพรานไพรลายพราง', type: 'armor', icon: '🦺', sell: 60, path: 'archer', bonus: { def: 6, hp: 40, DEX: 2 }, look: { top: '#3d6b35', bottom: '#5b4a2e' } },
  armor_boxer:    { nameTh: 'กางเกงมวยผ้าประเจียด', type: 'armor', icon: '🩳', sell: 60, path: 'boxer', bonus: { def: 7, hp: 60, STR: 2 }, look: { top: '#c0392b', bottom: '#c0392b' } },
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

  // ---------- ชุดแต่งตัว (Costume) – แสดงบนตัวละคร ไม่มีค่าพลัง · slot: head / face / back / outfit ----------
  cos_head_chada:    { nameTh: 'ชฎาทองคำ',          type: 'costume', slot: 'head', icon: '👑', price: 1200 },
  cos_head_bronze:   { nameTh: 'ชฎาสำริดโบราณ',      type: 'costume', slot: 'head', icon: '👑', price: 900 },
  cos_head_malai:    { nameTh: 'ชฎามาลัยดอกไม้',     type: 'costume', slot: 'head', icon: '👑', price: 1500 },
  cos_head_emerald:  { nameTh: 'ชฎาทับทิมมรกต',      type: 'costume', slot: 'head', icon: '👑', price: 1500 },
  cos_head_nil:      { nameTh: 'มงกุฎนิลกาฬ',        type: 'costume', slot: 'head', icon: '👑', price: 1800 },
  cos_head_devata:   { nameTh: 'ชฎาเทวดา',           type: 'costume', slot: 'head', icon: '👑', price: 2000 },
  cos_head_flower:   { nameTh: 'ชฎาทัดดอกจำปี',      type: 'costume', slot: 'head', icon: '👑', price: 2000 },
  cos_head_gem:      { nameTh: 'ชฎาประดับพลอยนพเก้า', type: 'costume', slot: 'head', icon: '👑', price: 2600 },
  cos_head_peacock:  { nameTh: 'มงกุฎขนนกยูง',        type: 'costume', slot: 'head', icon: '🦚', price: 3000 },
  cos_head_yakred:   { nameTh: 'มงกุฎยักษ์แดง',       type: 'costume', slot: 'head', icon: '👹', price: 2800 },
  cos_head_yaksilver:{ nameTh: 'มงกุฎยักษ์เงิน',       type: 'costume', slot: 'head', icon: '👹', price: 2800 },
  cos_head_naga:     { nameTh: 'มงกุฎพญานาคหยก',      type: 'costume', slot: 'head', icon: '🐉', price: 3200 },
  cos_head_peacockq: { nameTh: 'มงกุฎนางพญานกยูง',    type: 'costume', slot: 'head', icon: '🦚', sell: 500, rare: true },
  cos_head_jade:     { nameTh: 'มงกุฎหยกทิพย์',       type: 'costume', slot: 'head', icon: '💚', sell: 500, rare: true },
  cos_head_asura:    { nameTh: 'มงกุฎอสูรเงินเลือด',   type: 'costume', slot: 'head', icon: '👹', sell: 500, rare: true },
  cos_head_emperor:  { nameTh: 'มงกุฎจักรพรรดิพญายักษ์', type: 'costume', slot: 'head', icon: '👑', sell: 1500, rare: true },
  // ชุดทั้งตัว (เปลี่ยนสีเสื้อผ้า ทับสีชุดเกราะ)
  // หมวก/เครื่องประดับหัว (ภาพ 64px → wear กำหนดจุดยึดเอง)
  cos_head_ngob:     { nameTh: 'งอบชาวนา',            type: 'costume', slot: 'head', icon: '👒', price: 600,  wear: { g: [32, 44], s: 0.4, at: [0.47, 0.15] } },
  cos_head_hunter:   { nameTh: 'หมวกนายพรานขนนก',      type: 'costume', slot: 'head', icon: '🤠', price: 700,  wear: { g: [32, 42], s: 0.4, at: [0.47, 0.14] } },
  cos_head_mongkol:  { nameTh: 'มงคลนักมวย',           type: 'costume', slot: 'head', icon: '⭕', price: 500,  wear: { g: [32, 32], s: 0.38, at: [0.47, 0.16] } },
  cos_head_lotus:    { nameTh: 'ปิ่นดอกบัวทัดหู',       type: 'costume', slot: 'head', icon: '🪷', price: 500,  wear: { g: [30, 50], s: 0.22, at: [0.38, 0.15] } },
  // หน้ากาก
  cos_face_takhon:   { nameTh: 'หน้ากากผีตาโขน',        type: 'costume', slot: 'face', icon: '🎭', price: 900,  wear: { g: [30, 30], s: 0.32, at: [0.6, 0.16] } },
  cos_face_khon:     { nameTh: 'หัวโขนยักษ์เขียว',       type: 'costume', slot: 'face', icon: '👺', price: 1400, wear: { g: [32, 34], s: 0.4, at: [0.5, 0.12] } },
  cos_face_skull:    { nameTh: 'หน้ากากกะโหลกผี',       type: 'costume', slot: 'face', icon: '💀', sell: 400, rare: true, wear: { g: [30, 32], s: 0.36, at: [0.52, 0.13] } },
  // ของสะพายหลัง
  cos_back_umbrella: { nameTh: 'ร่มบ่อสร้างสะพายหลัง',   type: 'costume', slot: 'back', icon: '🌂', price: 1100, wear: { g: [32, 32], s: 0.62, at: [0.3, 0.5], r: -0.55 } },
  cos_back_kinnari:  { nameTh: 'ปีกกินรีขาวทอง',        type: 'costume', slot: 'back', icon: '🪽', price: 2400, wear: { g: [44, 40], s: 0.55, at: [0.36, 0.4] } },
  cos_back_flag:     { nameTh: 'ธงยันต์ออกศึก',          type: 'costume', slot: 'back', icon: '🚩', price: 1600, wear: { g: [16, 56], s: 0.65, at: [0.26, 0.6] } },
  cos_back_bat:      { nameTh: 'ค้างคาวผีเกาะหลัง',      type: 'costume', slot: 'back', icon: '🦇', sell: 500, rare: true, wear: { g: [30, 34], s: 0.52, at: [0.28, 0.36] } },
  cos_outfit_royal:  { nameTh: 'ชุดไทยจักรีทองแดง',   type: 'costume', slot: 'outfit', icon: '👘', price: 1600, look: { top: '#f4d03f', bottom: '#922b21' } },
  cos_outfit_kinnari:{ nameTh: 'ชุดกินรีขาวทอง',     type: 'costume', slot: 'outfit', icon: '👘', price: 1800, look: { top: '#fdfefe', bottom: '#d4ac0d' } },
  cos_outfit_pob:    { nameTh: 'ชุดผีปอบม่วงดำ',      type: 'costume', slot: 'outfit', icon: '👘', price: 1400, look: { top: '#4a235a', bottom: '#1c1c1c' } },
  cos_outfit_nakleng:{ nameTh: 'ชุดนักเลงโบราณ',      type: 'costume', slot: 'outfit', icon: '👘', price: 1200, look: { top: '#1b2631', bottom: '#7b241c' } },
  cos_outfit_sky:    { nameTh: 'ชุดผ้าไหมฟ้าคราม',    type: 'costume', slot: 'outfit', icon: '👘', price: 1400, look: { top: '#2e86c1', bottom: '#1b4f72' } },

  // ---------- ล้างแต้ม / เปลี่ยนสายหลัก ----------
  reset_water:   { nameTh: 'น้ำมนต์ล้างแต้ม', type: 'reset', icon: '💧', price: 300, desc: 'คืนแต้มสถานะและแต้มสกิลทั้งหมดให้ลงใหม่' },
  skin_swordman: { nameTh: 'คัมภีร์เปลี่ยนสายหลัก: ขุนศึก',  type: 'skin', icon: '📜', price: 800, job: 'swordman' },
  skin_mage:     { nameTh: 'คัมภีร์เปลี่ยนสายหลัก: จอมขมังเวทย์', type: 'skin', icon: '📜', price: 800, job: 'mage' },
  skin_archer:   { nameTh: 'คัมภีร์เปลี่ยนสายหลัก: พรานป่า',  type: 'skin', icon: '📜', price: 800, job: 'archer' },
  skin_boxer:    { nameTh: 'คัมภีร์เปลี่ยนสายหลัก: นักมวยคาดเชือก', type: 'skin', icon: '📜', price: 800, job: 'boxer' },

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

  // ---------- สมุนไพรป่าผีดุ (เก็บด้วย F) → ยายติ๋มปรุงยา / ป้าสาทำอาหาร ----------
  herb_aloe:      { nameTh: 'ว่านหางจระเข้',     type: 'herb', icon: '🌵', sell: 5 },
  herb_lemongrass:{ nameTh: 'ตะไคร้ป่า',          type: 'herb', icon: '🌾', sell: 5 },
  herb_turmeric:  { nameTh: 'ขมิ้นชัน',           type: 'herb', icon: '🫚', sell: 8 },
  herb_anchan:    { nameTh: 'ดอกอัญชัน',          type: 'herb', icon: '💠', sell: 8 },
  herb_bamboo:    { nameTh: 'หน่อไม้ป่า',          type: 'herb', icon: '🎋', sell: 6 },
  herb_honey:     { nameTh: 'รวงผึ้งป่า',          type: 'herb', icon: '🍯', sell: 18 },
  herb_mushroom:  { nameTh: 'เห็ดผีเรืองแสง',      type: 'herb', icon: '🍄', sell: 25 },
  // ยาปรุง (ยายติ๋ม)
  pot_aloe:     { nameTh: 'ยาว่านหางจระเข้ (HP +300)', type: 'consumable', icon: '🧪', sell: 20, effect: { hp: 300 } },
  pot_turmeric: { nameTh: 'ยาขมิ้นชัน (HP +600)',     type: 'consumable', icon: '🧪', sell: 40, effect: { hp: 600 } },
  pot_anchan:   { nameTh: 'น้ำอัญชัน (MP +250)',      type: 'consumable', icon: '🧪', sell: 40, effect: { mp: 250 } },
  elixir_ghost: { nameTh: 'ยาอายุวัฒนะเห็ดผี',       type: 'food', icon: '⚗️', sell: 90, effect: { hp: 200, mp: 100 },
    buff: { id: 'elixir', minutes: 15, mods: { atkMul: 0.12, critAdd: 0.04 }, textTh: 'โจมตี +12% · คริ +4%' } },
  food_nomai:   { nameTh: 'แกงหน่อไม้ใส่ปลา',        type: 'food', icon: '🍛', sell: 40, effect: { hp: 350, mp: 60 },
    buff: { minutes: 12, mods: { def: 6 }, textTh: 'ป้องกัน +6' } },

  // ---------- วัตถุดิบตีบวก (ลุงดำ) ----------
  black_iron:  { nameTh: 'แร่เหล็กไหล',       type: 'material', icon: '🪨', price: 60 },
  yant_guard:  { nameTh: 'ยันต์กันลดขั้น',      type: 'material', icon: '🧧', price: 1500, desc: 'ติ๊กใช้ตอนตีบวก +10 ขึ้นไป · ตีพลาดขั้นไม่ลด (ใช้ครั้งละ 1)' },

  // ---------- ของถวายศาลพระภูมิ (กด F ที่ศาล) ----------
  garland:   { nameTh: 'พวงมาลัยดาวเรือง', type: 'offering', icon: '🌼', price: 30 },
  nam_daeng: { nameTh: 'น้ำแดง',           type: 'offering', icon: '🥤', price: 25 },
  khai_tom:  { nameTh: 'ไข่ต้ม',           type: 'offering', icon: '🥚', price: 35 },
  hua_mu:    { nameTh: 'หัวหมูบวงสรวง',    type: 'offering', icon: '🐷', price: 400 },
};

// อุปกรณ์ตามอาชีพ 200 ชิ้น (shared/data/gear.js)
Object.assign(ITEMS, GEAR);

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
    stock: ['hp_s', 'hp_m', 'mp_s', 'mp_m', 'yant_home', 'garland', 'nam_daeng', 'khai_tom', 'hua_mu',
      'reset_water', 'skin_swordman', 'skin_mage', 'skin_archer', 'skin_boxer'],
    tabs: ['buy', 'sell', 'brew'],
  },
  lung_dam: {
    nameTh: 'ลุงดำ โรงตีเหล็ก',
    greeting: 'เหล็กดีต้องตีตอนร้อน! อยากได้อาวุธหรือจะตีบวกก็ว่ามา',
    stock: ['wood_sword', 'iron_dab', 'oak_staff', 'yant_staff', 'bamboo_bow', 'horn_bow', 'hand_wrap', 'mongkol',
      'yant_shirt', 'takrut', 'prajiad', 'amulet_coin', 'amulet_ganesh', 'amulet_somdej', 'amulet_pidta',
      'kuman_statue', 'naga_statue', 'yak_statue', 'black_iron', 'yant_guard'],
    tabs: ['buy', 'sell', 'enhance', 'forge'],
  },
  tailor: {
    nameTh: 'แม่ช้อย ร้านชุดไทยและเครื่องประดับ',
    greeting: 'แต่งตัวให้สมศักดิ์ศรีนักปราบผีหน่อยลูก ผีเห็นยังต้องเกรงใจ!',
    stock: ['cos_head_chada', 'cos_head_bronze', 'cos_head_malai', 'cos_head_emerald', 'cos_head_nil', 'cos_head_devata', 'cos_head_flower',
      'cos_head_gem', 'cos_head_peacock', 'cos_head_yakred', 'cos_head_yaksilver', 'cos_head_naga',
      'cos_head_ngob', 'cos_head_hunter', 'cos_head_mongkol', 'cos_head_lotus', 'cos_face_takhon', 'cos_face_khon',
      'cos_back_umbrella', 'cos_back_kinnari', 'cos_back_flag',
      'cos_outfit_royal', 'cos_outfit_kinnari', 'cos_outfit_pob', 'cos_outfit_nakleng', 'cos_outfit_sky'],
    tabs: ['buy', 'sell', 'dye'],
  },
  // ---------- ครูประจำอาชีพ (ขายอุปกรณ์สายตัวเอง Lv.1–20) ----------
  kru_sword: {
    nameTh: 'ครูเหม สำนักดาบบางผี', job: 'swordman',
    greeting: 'ดาบดีต้องคู่กับใจนิ่ง… เลือกอาวุธและเกราะที่เหมาะกับฝีมือเจ้าเถิด',
    stock: gearShopStock('swordman'), tabs: ['buy', 'sell'],
  },
  kru_mage: {
    nameTh: 'หลวงตาเผือก หมอธรรมป่าช้า', job: 'mage',
    greeting: 'อาคมจะขลังได้ ต้องมีของดีติดตัว… มาดูเครื่องรางของข้าก่อน',
    stock: gearShopStock('mage'), tabs: ['buy', 'sell'],
  },
  kru_archer: {
    nameTh: 'พรานแก้ว ค่ายพรานไพร', job: 'archer',
    greeting: 'ตาไว มือนิ่ง ลมไม่แรง… ธนูดี ๆ ต้องแบบนี้เลยจ้ะ',
    stock: gearShopStock('archer'), tabs: ['buy', 'sell'],
  },
  kru_boxer: {
    nameTh: 'ครูแดง ค่ายมวยวัดบางผี', job: 'boxer',
    greeting: 'ไหว้ครูให้ดี ใจสู้ให้ถึง! อุปกรณ์มวยครบ มาเลือกเอา',
    stock: gearShopStock('boxer'), tabs: ['buy', 'sell'],
  },
  pa_sa: {
    nameTh: 'ป้าสา ครัวริมน้ำ',
    greeting: 'ได้ปลามาเหรอลูก เอามาให้ป้าทำกับข้าวให้ อร่อยจนผีต้องร้องขอ!',
    stock: ['food_khao_tom', 'food_pla_pao', 'food_tom_yum', 'food_kung_ob'],
    tabs: ['buy', 'sell', 'cook'],
  },
};

export const STARTING_GOLD = 150;
export const STARTING_ITEMS = [{ id: 'hp_s', qty: 3 }, { id: 'mp_s', qty: 2 }, { id: 'yant_home', qty: 3 },
  { id: 'wood_sword', qty: 1 }, { id: 'oak_staff', qty: 1 }, { id: 'bamboo_bow', qty: 1 }];   // อาวุธฝึกให้ลองทุกแนว

/** แนวต่อสู้ตามชนิดอาวุธ → id สายใน classes.js */
export const WTYPE_JOB = { sword: 'swordman', staff: 'mage', bow: 'archer', wraps: 'boxer' };
/** อาวุธที่ถือ → แนวต่อสู้ (มือเปล่า = มวย) */
export const weaponStyle = (weaponId) => WTYPE_JOB[ITEMS[weaponId]?.wtype] || 'boxer';
/** อาวุธเริ่มต้นของแต่ละสาย (ใช้ตอนแปลงเซฟเก่า) */
export const STARTER_WEAPON = { swordman: 'wood_sword', mage: 'oak_staff', archer: 'bamboo_bow', boxer: 'hand_wrap' };
