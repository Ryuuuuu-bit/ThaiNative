// ============================================================
//  ไอเทม & ร้านค้า NPC
//  type: consumable | weapon | armor | accessory | skin | material
//  ราคาขายคืน = 50% ของราคาซื้อ (หรือ sell ที่กำหนดไว้)
// ============================================================
import { GEAR, gearShopStock } from './gear.js';
import { CARD_ITEMS } from './cards.js';
import { parseAffixId, makeVariant } from './affixes.js';
export { baseItemId } from './affixes.js';

const ITEMS_BASE = {
  // ---------- ยาฟื้นฟู ----------
  hp_s:  { nameTh: 'ยาหม่องแดง (HP +60)',   type: 'consumable', icon: '🧴', price: 25,  effect: { hp: 60 } },
  hp_m:  { nameTh: 'ยาดมสมุนไพร (HP +180)', type: 'consumable', icon: '🌿', price: 70,  effect: { hp: 180 } },
  mp_s:  { nameTh: 'น้ำมะพร้าว (MP +30)',   type: 'consumable', icon: '🥥', price: 20,  effect: { mp: 30 } },
  mp_m:  { nameTh: 'ชาตะไคร้ (MP +90)',    type: 'consumable', icon: '🍵', price: 60,  effect: { mp: 90 } },
  yant_home: { nameTh: 'ยันต์คืนถิ่น (วาร์ปกลับกรุงศรีฯ)', type: 'home', icon: '🏠', price: 40, desc: 'ร่าย 2.5 วิ (ห้ามขยับ/โดนตี) แล้ววาร์ปกลับลานน้ำพุกลางกรุงศรีฯ ได้จากทุกแดน · ปุ่ม B' },

  // ---------- อาวุธ (ใครก็ถือได้ · wtype = แนวต่อสู้/สกิลที่ใช้ได้ · แสดงในมือตัวละคร) ----------
  wood_sword:  { nameTh: 'ดาบไม้ฝึก',        type: 'weapon', icon: '🗡️', price: 80,  sell: 10, wtype: 'sword', bonus: { atk: 6 } },
  iron_dab:    { nameTh: 'ดาบเหล็กน้ำพี้',     type: 'weapon', icon: '⚔️', price: 320, wtype: 'sword', bonus: { atk: 18, crit: 0.03 } },
  oak_staff:   { nameTh: 'ไม้เท้าไม้มะขาม',    type: 'weapon', icon: '🪄', price: 80,  sell: 10, wtype: 'staff', bonus: { matk: 8, mp: 10 } },
  yant_staff:  { nameTh: 'คทาลงยันต์',       type: 'weapon', icon: '🔮', price: 340, wtype: 'staff', bonus: { matk: 22, mp: 30 } },
  bamboo_bow:  { nameTh: 'ธนูไม้ไผ่',         type: 'weapon', icon: '🏹', price: 80,  sell: 10, wtype: 'bow', bonus: { atk: 5, DEX: 2 } },
  horn_bow:    { nameTh: 'ธนูเขาควาย',        type: 'weapon', icon: '🎯', price: 330, wtype: 'bow', bonus: { atk: 15, DEX: 4 } },
  hand_wrap:   { nameTh: 'ผ้าพันมือคาดเชือก',   type: 'weapon', icon: '🥊', price: 80,  wtype: 'wraps', bonus: { atk: 5, STR: 1 } },
  herb_staff:  { nameTh: 'ไม้เท้าเถาบอระเพ็ด', type: 'weapon', icon: '🌿', price: 80,  sell: 10, wtype: 'herb', art: 'g_healer_w01', bonus: { matk: 7, mp: 10, hp: 10 } },
  mongkol:     { nameTh: 'มงคลศักดิ์สิทธิ์',     type: 'weapon', icon: '🪢', price: 320, wtype: 'wraps', bonus: { atk: 14, VIT: 3, crit: 0.02 } },

  // ---------- เกราะ / เครื่องประดับ ----------
  yant_shirt:  { nameTh: 'เสื้อยันต์',         type: 'armor', icon: '👕', price: 150, bonus: { def: 5, hp: 30 }, look: { top: '#f2efe6', bottom: '#5d4037' } },
  // ชุดประจำสาย (ได้จากผู้ใหญ่ชัยเมื่อเลือกสายหลัก Lv.10) – look = สีชุดที่แสดงบนตัวละคร
  armor_swordman: { nameTh: 'เกราะนักรบบางระจัน', type: 'armor', icon: '🛡️', price: 350, path: 'swordman', bonus: { def: 9, hp: 70 }, look: { top: '#922b21', bottom: '#4a2511' } },
  armor_mage:     { nameTh: 'ผ้ายันต์หมอผีเจ็ดป่าช้า', type: 'armor', icon: '🧥', price: 350, path: 'mage', bonus: { def: 5, mp: 50, matk: 6 }, look: { top: '#1c1c1c', bottom: '#4a235a' } },
  armor_archer:   { nameTh: 'ชุดพรานไพรลายพราง', type: 'armor', icon: '🦺', price: 350, path: 'archer', bonus: { def: 6, hp: 40, DEX: 2 }, look: { top: '#3d6b35', bottom: '#5b4a2e' } },
  armor_boxer:    { nameTh: 'กางเกงมวยผ้าประเจียด', type: 'armor', icon: '🩳', price: 350, path: 'boxer', bonus: { def: 7, hp: 60, STR: 2 }, look: { top: '#c0392b', bottom: '#c0392b' } },
  armor_healer:   { nameTh: 'เสื้อม่อฮ่อมหมอยา', type: 'armor', icon: '🥼', price: 350, path: 'healer', art: 'g_healer_a01', bonus: { def: 6, hp: 45, mp: 35, INT: 1 }, look: { top: '#2e6b4f', bottom: '#3b2f22' } },
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

  // ---------- ชุดแต่งตัว (Costume) – แสดงบนตัวละคร 8 ทิศ ไม่มีค่าพลัง · slot: head / face / back / outfit ----------
  // ชุดเต็มตัว: เปลี่ยนโมเดลตัวละครทั้งตัว (hero_<เพศ>_<model>) · ใส่ได้ทั้งชายและหญิง
  cs_outfit_ruenton:   { nameTh: 'ชุดไทยเรือนต้น',       type: 'costume', slot: 'outfit', icon: '👘', price: 1400, model: 'ruenton',    desc: 'เสื้อเรือนต้นสีเหลือง นุ่งผ้าซิ่นสีชมพู ชุดไทยพื้นบ้านสดใส' },
  cs_outfit_mohom:     { nameTh: 'ชุดม่อฮ่อม',           type: 'costume', slot: 'outfit', icon: '👘', price: 1200, model: 'mohom',      desc: 'เสื้อม่อฮ่อมย้อมคราม คาดผ้าขาวม้าแดง ชุดชาวบ้านทางเหนือ' },
  cs_outfit_isan:      { nameTh: 'ชุดลายขิดอีสาน',        type: 'costume', slot: 'outfit', icon: '👘', price: 1400, model: 'isan',       desc: 'ผ้าทอลายขิดสีส้มแบบชาวอีสาน คล่องตัวเหมาะเดินทางไกล' },
  cs_outfit_jongkraben:{ nameTh: 'ชุดโจงกระเบนคาดผ้า',    type: 'costume', slot: 'outfit', icon: '👘', price: 1800, model: 'jongkraben', desc: 'เสื้อขาวนุ่งโจงกระเบนสีน้ำตาล คาดผ้าทองที่เอว' },
  cs_outfit_rajpatan:  { nameTh: 'ชุดราชปะแตน',          type: 'costume', slot: 'outfit', icon: '👘', price: 2000, model: 'rajpatan',   desc: 'เสื้อราชปะแตนสีขาวกระดุมทอง นุ่งโจงกระเบนดำ ชุดขุนนางกรุงศรี' },
  cs_outfit_chaona:    { nameTh: 'ชุดชาวนา',              type: 'costume', slot: 'outfit', icon: '👘', price: 1200, model: 'chaona',     desc: 'เสื้อผ้าฝ้ายสีดินกับย่ามสาน ชุดชาวนาทุ่งกรุงเก่า' },
  cs_outfit_silk:      { nameTh: 'ชุดผ้าไหมไทย',          type: 'costume', slot: 'outfit', icon: '👘', price: 2400, model: 'silk',       desc: 'ผ้าไหมสีม่วงลายจุดเงางาม ชุดแต่งออกงานมงคล' },
  cs_outfit_hunter:    { nameTh: 'ชุดพรานไพร',            type: 'costume', slot: 'outfit', icon: '👘', price: 1600, model: 'hunter',     desc: 'ชุดสีเขียวป่ากับสายหนัง ชุดพรานเดินไพร' },
  cs_outfit_warrior:   { nameTh: 'ชุดนักรบโบราณ',          type: 'costume', slot: 'outfit', icon: '👘', price: 2600, model: 'warrior',    desc: 'เสื้อศึกสีแดงคาดผ้าทอง รัดแขนทองเหลือง ชุดนักรบสยาม' },
  cs_outfit_mahadlek:  { nameTh: 'ชุดมหาดเล็ก',           type: 'costume', slot: 'outfit', icon: '👘', price: 3000, model: 'mahadlek',   desc: 'เครื่องแบบมหาดเล็กสีกรมท่าขลิบทอง' },
  // เครื่องประดับหัว
  cs_head_chada:    { nameTh: 'ชฎาทองคำ',            type: 'costume', slot: 'head', icon: '👑', price: 2200 },
  cs_head_ngob:     { nameTh: 'งอบใบลาน',             type: 'costume', slot: 'head', icon: '👒', price: 700, fit: { w: 1.9, y: 0.95 } },
  cs_head_naga:     { nameTh: 'มงกุฎนาคหยก',          type: 'costume', slot: 'head', icon: '🐉', price: 3200, fit: { w: 1.45 } },
  cs_head_mongkol:  { nameTh: 'มงคลนักมวย',           type: 'costume', slot: 'head', icon: '⭕', price: 600, fit: { w: 1.2, y: 0.3, ay: 0.5, sy: 0.5 } },
  cs_head_flower:   { nameTh: 'มาลัยดอกมะลิทัดผม',     type: 'costume', slot: 'head', icon: '🌼', price: 900, fit: { w: 1.25, y: 0.26, ay: 0.5, sy: 0.5 } },
  cs_head_peacock:  { nameTh: 'มงกุฎขนนกยูง',          type: 'costume', slot: 'head', icon: '🦚', sell: 500, rare: true, fit: { w: 1.6 } },
  cs_head_jade:     { nameTh: 'มงกุฎหยกทิพย์',         type: 'costume', slot: 'head', icon: '💚', sell: 500, rare: true },
  cs_head_asura:    { nameTh: 'มงกุฎอสูรเงินเลือด',     type: 'costume', slot: 'head', icon: '👹', sell: 500, rare: true },
  cs_head_emperor:  { nameTh: 'มงกุฎจักรพรรดิพญายักษ์', type: 'costume', slot: 'head', icon: '👑', sell: 1500, rare: true },
  // หน้ากาก
  cs_face_takhon:   { nameTh: 'หน้ากากผีตาโขน',        type: 'costume', slot: 'face', icon: '🎭', price: 1100 },
  cs_face_khon:     { nameTh: 'หัวโขนยักษ์เขียว',       type: 'costume', slot: 'face', icon: '👺', price: 1600, fit: { w: 1.5, y: 0.45 } },
  cs_face_skull:    { nameTh: 'หน้ากากกะโหลกผี',       type: 'costume', slot: 'face', icon: '💀', sell: 400, rare: true },
  // ของสะพายหลัง
  cs_back_kinnari:  { nameTh: 'ปีกกินรีขาวทอง',        type: 'costume', slot: 'back', icon: '🪽', price: 2800, fit: { w: 3.4, y: 1.8 } },
  cs_back_umbrella: { nameTh: 'ร่มบ่อสร้าง',            type: 'costume', slot: 'back', icon: '🌂', price: 1200, fit: { w: 3.2, y: -0.15, ay: 0.85 } },
  cs_back_flag:     { nameTh: 'ธงยันต์ออกศึก',          type: 'costume', slot: 'back', icon: '🚩', price: 1800, fit: { w: 2.3, y: 1.9, ay: 0.92 } },
  cs_back_bat:      { nameTh: 'ค้างคาวผีเกาะหลัง',      type: 'costume', slot: 'back', icon: '🦇', sell: 500, rare: true, fit: { w: 2.6, y: 1.05 } },

  // ---------- ล้างแต้ม / เปลี่ยนสายหลัก ----------
  reset_water:   { nameTh: 'น้ำมนต์ล้างแต้ม', type: 'reset', icon: '💧', price: 300, desc: 'คืนแต้มสถานะและแต้มสกิลทั้งหมดให้ลงใหม่' },
  skin_swordman: { nameTh: 'คัมภีร์ล้างต้นไม้พรสวรรค์', desc: 'ใช้แล้วคืนแต้มพรสวรรค์ทั้งหมด (ฟรี ไม่เสียเงิน)',  type: 'skin', icon: '📜', price: 800, job: 'swordman' },
  skin_mage: { nameTh: 'คัมภีร์ล้างต้นไม้พรสวรรค์', desc: 'ใช้แล้วคืนแต้มพรสวรรค์ทั้งหมด (ฟรี ไม่เสียเงิน)', type: 'skin', icon: '📜', price: 800, job: 'mage' },
  skin_archer: { nameTh: 'คัมภีร์ล้างต้นไม้พรสวรรค์', desc: 'ใช้แล้วคืนแต้มพรสวรรค์ทั้งหมด (ฟรี ไม่เสียเงิน)',  type: 'skin', icon: '📜', price: 800, job: 'archer' },
  skin_healer: { nameTh: 'คัมภีร์ล้างต้นไม้พรสวรรค์', desc: 'ใช้แล้วคืนแต้มพรสวรรค์ทั้งหมด (ฟรี ไม่เสียเงิน)', type: 'skin', icon: '📜', price: 800, job: 'healer' },
  skin_boxer: { nameTh: 'คัมภีร์ล้างต้นไม้พรสวรรค์', desc: 'ใช้แล้วคืนแต้มพรสวรรค์ทั้งหมด (ฟรี ไม่เสียเงิน)', type: 'skin', icon: '📜', price: 800, job: 'boxer' },

  // ---------- ของดรอปจากผี (ขายได้อย่างเดียว) ----------
  glass_shard:  { nameTh: 'ฟางหุ่นไล่กาต้องมนตร์', type: 'material', icon: '🌾', sell: 3 },
  gold_leaf:    { nameTh: 'แผ่นทองคำเปลว',    type: 'material', icon: '✨', sell: 5 },
  krasue_hair:  { nameTh: 'เส้นผมกระสือ',     type: 'material', icon: '🧵', sell: 7 },
  banana_leaf:  { nameTh: 'ใบตองตานี',        type: 'material', icon: '🍃', sell: 8 },
  rotten_cloth: { nameTh: 'ผ้าเปื้อนปอบ',      type: 'material', icon: '🧣', sell: 10 },
  film_reel:    { nameTh: 'ม้วนฟิล์มหนังกลางแปลง', type: 'material', icon: '🎞️', sell: 13 },
  water_lily:   { nameTh: 'บัวสายผีพราย',     type: 'material', icon: '🪷', sell: 15 },
  pret_bone:    { nameTh: 'กระดูกเปรต',       type: 'material', icon: '🦴', sell: 18 },
  saming_fang:  { nameTh: 'เขี้ยวเสือสมิง',     type: 'material', icon: '🦷', sell: 24 },
  dark_mist:    { nameTh: 'หมอกดำผีห่า',      type: 'material', icon: '🌫️', sell: 30 },
  yak_fang:     { nameTh: 'เขี้ยวพญายักษ์',     type: 'material', icon: '🐗', sell: 120, desc: 'ใช้ตีบวก +15 ขึ้นไป · ดรอปจากบอสภาค (ปู่โสม อสุรกาย ชาละวัน) บอสแดนต่างแดน และผีในหิมพานต์ บาดาล นรกภูมิ' },
  ha_essence:   { nameTh: 'แก่นวิญญาณผีห่า',    type: 'material', icon: '🔥', sell: 60, desc: 'ดรอปจากผีห่า (ป่าช้าวัดร้าง) · ยายติ๋มใช้ปรุงยาอายุวัฒนะ' },
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
  // ---- วัตถุดิบจากแมพต่างแดน (Lv.30–99) ----
  himma_fur:    { nameTh: 'ขนสัตว์หิมพานต์',     type: 'material', icon: '🦁', sell: 140 },
  himma_feather:{ nameTh: 'ขนนกหัสดีลิงค์',      type: 'material', icon: '🪶', sell: 180 },
  makka_fruit:  { nameTh: 'ผลมักกะลีผล',        type: 'material', icon: '🍑', sell: 210 },
  giant_tusk:   { nameTh: 'งากุมภกรรณ',          type: 'material', icon: '🦣', sell: 1200 },
  naga_scale:   { nameTh: 'เกล็ดนาคพราย',        type: 'material', icon: '🐍', sell: 260 },
  pearl_ghost:  { nameTh: 'ไข่มุกเงือกผี',         type: 'material', icon: '🦪', sell: 320 },
  naga_gem:     { nameTh: 'แก้วมณีนาคราช',       type: 'material', icon: '💎', sell: 2500 },
  hell_ember:   { nameTh: 'ถ่านไฟนรก',           type: 'material', icon: '🔥', sell: 380 },
  ngiw_thorn:   { nameTh: 'หนามต้นงิ้ว',          type: 'material', icon: '🌵', sell: 430 },
  yama_seal:    { nameTh: 'ตราพญายม',           type: 'material', icon: '⚖️', sell: 5000 },

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
  rice_sheaf:     { nameTh: 'รวงข้าวหอม',        type: 'herb', icon: '🌾', sell: 4 },
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

/** ไอเทมทั้งหมด + ไอเทมมีค่าสุ่ม (รหัส base@affix สร้างให้อัตโนมัติ · เก็บแคช) */
const VARIANTS = new Map();
export const ITEMS = new Proxy(ITEMS_BASE, {
  get(t, k) {
    if (typeof k !== 'string' || k in t || !k.includes('@')) return t[k];
    if (VARIANTS.has(k)) return VARIANTS.get(k);
    const p = parseAffixId(k);
    const v = p && t[p.base] ? makeVariant(t[p.base], p.list) : null;
    if (VARIANTS.size < 20000) VARIANTS.set(k, v || undefined);
    return v || undefined;
  },
});

// ขวดยา (แบบ PoE): ใส่ช่องขวดยา 2 ช่อง · ดื่มได้หลายครั้ง · ฆ่าผีแล้วเติมกลับ (4 ตัว = 1 ครั้ง · บอส = เต็ม) · กลับเมือง/ฟื้น = เต็ม
//  flask = { kind: 'hp'|'mp', heal, max }  (เข็มขัด flaskPct = ฟื้นเพิ่ม %)
const FLASK_DEF = [
  ['hp', 1, 'ขวดน้ำมนต์เล็ก', 80, 3, 150], ['hp', 8, 'ขวดน้ำมนต์ทองเหลือง', 220, 3, 1200], ['hp', 14, 'คนโทยาหอมแดง', 400, 4, 3500],
  ['hp', 20, 'คนโทโอสถหลวง', 650, 4, 7000], ['hp', 26, 'น้ำทิพย์พญานาค', 950, 5, 0], ['hp', 30, 'อมฤตสวรรค์', 1300, 5, 0],
  ['mp', 1, 'ขวดน้ำมะพร้าวเล็ก', 40, 3, 150], ['mp', 8, 'ขวดชาดอกอัญชัน', 100, 3, 1200], ['mp', 14, 'คนโทน้ำจันทร์', 180, 4, 3500],
  ['mp', 20, 'คนโทน้ำค้างทิพย์', 280, 4, 7000], ['mp', 26, 'น้ำมนต์เจ็ดป่าช้า', 400, 5, 0], ['mp', 30, 'น้ำอมฤตจันทรา', 550, 5, 0],
];
// ขวดยาขั้นสูง (แมพต่างแดน · ดรอปเท่านั้น) — รหัส flask_hp7..10 / flask_mp7..10
FLASK_DEF.push(
  ['hp', 40, 'น้ำทิพย์หิมพานต์', 1900, 5, 0], ['hp', 55, 'อมฤตนาคา', 2700, 6, 0], ['hp', 70, 'น้ำมนต์มณีนาคราช', 3600, 6, 0], ['hp', 85, 'อมฤตดับไฟนรก', 4600, 6, 0],
  ['mp', 40, 'น้ำค้างดอกบัวหิมพานต์', 780, 5, 0], ['mp', 55, 'น้ำมนต์บาดาล', 1050, 6, 0], ['mp', 70, 'น้ำอมฤตพระจันทร์เต็มดวง', 1350, 6, 0], ['mp', 85, 'น้ำมนต์ยมโลก', 1700, 6, 0],
);
const FLASK_N = { hp: 0, mp: 0 };
FLASK_DEF.forEach(([kind, lv, nameTh, heal, max, price]) => {
  const n = ++FLASK_N[kind];
  ITEMS[`flask_${kind}${n}`] = { nameTh, type: 'flask', icon: kind === 'hp' ? '🧪' : '🫙', lv, ...(price ? { price } : { sell: 1500 + lv * 60 }),
    flask: { kind, heal, max }, art: kind === 'hp' && n >= 7 ? 'flask_hp_7' : `flask_${kind}_${Math.min(6, n)}`,
    desc: `ขวดยา${kind === 'hp' ? 'ฟื้น HP' : 'ฟื้น MP'} +${heal} · ดื่มได้ ${max} ครั้ง · ฆ่าผีเติมกลับ · ใส่ช่องขวดยา (Q/E)` };
});

// อุปกรณ์ตามอาชีพ 200 ชิ้น (shared/data/gear.js)
Object.assign(ITEMS, GEAR);
// การ์ดผี 20 ใบ (shared/data/cards.js)
Object.assign(ITEMS, CARD_ITEMS);

export function sellPrice(id) {
  const it = ITEMS[id];
  if (!it) return 0;
  return it.sell ?? Math.floor((it.price || 0) * 0.5);
}

/** NPC ร้านค้า (กรุงศรีอยุธยา) */
export const SHOPS = {
  mae_kha: {
    nameTh: 'ยายติ๋ม ร้านยาและของใช้',
    greeting: 'มาจ้ะหลาน ยาดีของยาย ผีหลอกก็ไม่กลัว!',
    stock: ['flask_hp1', 'flask_mp1', 'flask_hp2', 'flask_mp2', 'flask_hp3', 'flask_mp3', 'flask_hp4', 'flask_mp4', 'hp_s', 'hp_m', 'mp_s', 'mp_m', 'yant_home',
      'reset_water', 'skin_swordman'],
    tabs: ['buy', 'sell', 'cards', 'brew'],
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
    stock: ['cs_outfit_ruenton', 'cs_outfit_mohom', 'cs_outfit_isan', 'cs_outfit_hunter', 'cs_outfit_jongkraben', 'cs_outfit_rajpatan', 'cs_outfit_chaona',
      'cs_outfit_silk', 'cs_outfit_warrior', 'cs_outfit_mahadlek',
      'cs_head_ngob', 'cs_head_mongkol', 'cs_head_flower', 'cs_head_chada', 'cs_head_naga', 'cs_face_takhon', 'cs_face_khon',
      'cs_back_umbrella', 'cs_back_flag', 'cs_back_kinnari'],
    tabs: ['buy', 'sell', 'dye'],
  },
  // ---------- ครูประจำอาชีพ (ขายอุปกรณ์สายตัวเอง Lv.1–20) ----------
  kru_sword: {
    nameTh: 'ครูเหม สำนักดาบกรุงศรี', job: 'swordman',
    greeting: 'ดาบดีต้องคู่กับใจนิ่ง… เลือกอาวุธและเกราะที่เหมาะกับฝีมือเจ้าเถิด',
    stock: ['armor_swordman', ...gearShopStock('swordman')], tabs: ['quests', 'buy', 'sell'],
  },
  kru_mage: {
    nameTh: 'หลวงตาเผือก หมอธรรมป่าช้า', job: 'mage',
    greeting: 'อาคมจะขลังได้ ต้องมีของดีติดตัว… มาดูเครื่องรางของข้าก่อน',
    stock: ['armor_mage', ...gearShopStock('mage')], tabs: ['quests', 'buy', 'sell'],
  },
  kru_archer: {
    nameTh: 'พรานแก้ว ค่ายพรานไพร', job: 'archer',
    greeting: 'ตาไว มือนิ่ง ลมไม่แรง… ธนูดี ๆ ต้องแบบนี้เลยจ้ะ',
    stock: ['armor_archer', ...gearShopStock('archer')], tabs: ['quests', 'buy', 'sell'],
  },
  kru_boxer: {
    nameTh: 'ครูแดง ค่ายมวยกรุงศรี', job: 'boxer',
    greeting: 'ไหว้ครูให้ดี ใจสู้ให้ถึง! อุปกรณ์มวยครบ มาเลือกเอา',
    stock: ['armor_boxer', ...gearShopStock('boxer')], tabs: ['quests', 'buy', 'sell'],
  },
  kru_healer: {
    nameTh: 'หมอพร ศาลาโอสถ', job: 'healer',
    greeting: 'ยาดีต้องรู้จักต้น รู้จักราก รู้จักใจคนป่วย… มาเลือกเครื่องมือหมอยาได้เลยลูก',
    stock: ['herb_staff', 'armor_healer', ...gearShopStock('healer')], tabs: ['quests', 'buy', 'sell'],
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
  { id: 'wood_sword', qty: 1 }, { id: 'oak_staff', qty: 1 }, { id: 'bamboo_bow', qty: 1 }, { id: 'herb_staff', qty: 1 }];   // อาวุธฝึกให้ลองทุกแนว

/** แนวต่อสู้ตามชนิดอาวุธ → id สายใน classes.js */
export const WTYPE_JOB = { sword: 'swordman', staff: 'mage', bow: 'archer', wraps: 'boxer', herb: 'healer' };
/** อาวุธที่ถือ → แนวต่อสู้ (มือเปล่า = มวย) */
export const weaponStyle = (weaponId) => WTYPE_JOB[ITEMS[weaponId]?.wtype] || 'boxer';
/** อาวุธเริ่มต้นของแต่ละสาย (ใช้ตอนแปลงเซฟเก่า) */
export const STARTER_WEAPON = { swordman: 'wood_sword', mage: 'oak_staff', archer: 'bamboo_bow', boxer: 'hand_wrap', healer: 'herb_staff' };
