// ============================================================
//  อุปกรณ์สวมใส่ตามอาชีพ: 4 อาชีพ × (อาวุธ 17 · ชุด 16 · เครื่องประดับ 17 · หมวก/ถุงมือ/รองเท้า/เข็มขัด อย่างละ 8)
//  ▸ ระดับ Lv.1–20 ขายที่ครูประจำอาชีพในหมู่บ้าน · Lv.22–30 ดรอปจากผีตามเลเวลแมพ/หีบสมบัติ
//  ▸ ชิ้นตำนาน (leg) ดรอปจากพญายักษ์ทมิฬเท่านั้น
//  ▸ lv = เลเวลขั้นต่ำที่สวมได้ · job = อาชีพที่ออกแบบมาให้ (ใครก็ใส่ได้ ค่าพลังเหมาะกับอาชีพนั้น)
// ============================================================
import { baseItemId } from './affixes.js';
import { GEAR_ART } from './gear_art.js';

export const GEAR_TIERS = [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30];
export const SHOP_MAX_LV = 20;
/** ขั้นแมพต่างแดน (ต่อจาก Lv.30): ป่าหิมพานต์ 35–50 · นาคพิภพ 55–75 · นรกภูมิ 80–95 */
export const HIGH_TIERS = [35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140, 145, 150];
export const HIGH_PART_TIERS = [35, 45, 55, 65, 75, 85, 95, 105, 115, 125, 135, 145];
const HIGH_WORD = ['กินนร', 'คชสีห์', 'หัสดีลิงค์', 'ไกรสร', 'นาคพราย', 'มัจฉาทอง', 'เกล็ดนาค', 'มณีนาคา', 'อนันตนาค', 'นิรยบาล', 'ต้นงิ้ว', 'ยมทูต', 'ยมราช', 'เทวดา', 'ดาวดึงส์', 'ไอยราวัณ', 'ปาริชาติ', 'อินทรา', 'ราหู', 'สุเมรุ', 'ครุฑราช', 'วชิระ', 'พรหมา', 'จักรวาล'];
const HIGH_NOUN = { swordman: ['ดาบ', 'เกราะ', 'ตะกรุด'], mage: ['คทา', 'ชุดอาคม', 'จี้ยันต์'], archer: ['ธนู', 'ชุดพราน', 'สร้อย'], boxer: ['สนับมือ', 'ชุดมวย', 'ประเจียด'], healer: ['ไม้เท้าโอสถ', 'ชุดหมอยา', 'ตลับยา'] };          // ครูอาชีพขายถึง Lv.20 · สูงกว่านั้นต้องล่า

const NAMES = {
  swordman: {
    w: ['ดาบเหล็กกล้า', 'ดาบหวดทองเหลือง', 'ดาบคร่ำเงิน', 'ดาบบ้องตัน', 'ดาบสองคมหลังเหล็ก', 'ดาบฟ้าฟื้น', 'ดาบนาคสามเศียร', 'ดาบอาญาสิทธิ์',
      'ดาบชัยศรี', 'ดาบเพชรกลับ', 'ดาบพญาครุฑ', 'ดาบเทพอสูร', 'ดาบฝักทองคำ', 'ดาบอินทร์ประทาน', 'ดาบพระขรรค์ชัย', 'ดาบเจ็ดสีมณี'],
    wl: 'ดาบนาคราชสวรรค์',
    a: ['เสื้อหนังนักดาบ', 'เกราะหนังควาย', 'เสื้อเกราะโซ่', 'เกราะอกทองเหลือง', 'เกราะนักรบบ้านค่าย', 'เกราะกรมอาทมาต', 'เกราะเกล็ดนาค', 'เกราะทหารเสือ',
      'เกราะขุนศึก', 'เกราะเหล็กน้ำพี้', 'เกราะแม่ทัพหน้า', 'เกราะองครักษ์', 'เกราะเทพอสูร', 'เกราะทองกรุงศรี', 'เกราะจักรพรรดิราช', 'เกราะสุวรรณอัศวิน'],
    c: ['ตะกรุดเหล็ก', 'เหรียญนักรบ', 'เขี้ยวเสือห้อยคอ', 'กำไลทองแดง', 'ตะกรุดสามกษัตริย์', 'เหรียญรูปดาบ', 'สร้อยประคำนักดาบ', 'กำไลงาช้าง',
      'ตะกรุดมหาอุด', 'เหรียญเสือเผ่น', 'แหวนพิรอด', 'เข็มขัดนาค', 'ตะกรุดโทนทองคำ', 'เหรียญพญาครุฑ', 'แหวนนพเก้า', 'ตะกรุดเพชรน้ำหนึ่ง'],
    cl: 'ตะกรุดทองพญานาคราช',
  },
  mage: {
    w: ['ไม้เท้าไม้ตะเคียน', 'ไม้เท้ากะโหลกผี', 'คทาหยกเขียว', 'ไม้เท้าเถาวัลย์', 'คทาเศียรนาค', 'ไม้เท้าดอกบัว', 'คทาเปลวไฟ', 'ไม้เท้าจันทร์เสี้ยว',
      'คทาเทพพนม', 'ไม้เท้าเจ็ดป่าช้า', 'คทานิลกาฬ', 'ไม้เท้าพรหมสี่หน้า', 'คทาไพลินนพเก้า', 'ไม้เท้ามหาอาคม', 'คทาทิพย์วารี', 'คทาสุริยะเทพ'],
    wl: 'คทามณีนาคาเทวะ',
    a: ['เสื้อยันต์ขาว', 'เสื้อยันต์แดง', 'ผ้าคลุมหมอผี', 'เสื้อยันต์เก้ายอด', 'ชุดหมอธรรม', 'ชุดขมังเวทย์ดำ', 'เสื้อยันต์ตะกรุด', 'ผ้าคลุมเจ็ดป่าช้า',
      'ชุดอาคมเพชร', 'เสื้อยันต์พระจันทร์', 'ชุดนักบวชไพร', 'เสื้อลงอักขระทอง', 'ผ้าคลุมนิลกาฬ', 'ชุดมหาอาคม', 'เสื้อยันต์สุริยะ', 'อาภรณ์ทิพย์เทวา'],
    c: ['ลูกประคำไม้', 'ผ้ายันต์พับ', 'จี้หินเขี้ยวหนุมาน', 'แหวนเงินลงยันต์', 'ลูกประคำกะลา', 'กระดิ่งผี', 'จี้คริสตัลม่วง', 'ผ้ายันต์ห้าแถว',
      'แหวนพลอยนิล', 'ลูกประคำงาช้าง', 'จี้พระจันทร์', 'กระดิ่งเรียกวิญญาณ', 'แหวนหยกทิพย์', 'ผ้ายันต์เก้ายอด', 'จี้ดวงตาที่สาม', 'ลูกประคำเพชร'],
    cl: 'จี้ยันต์นพรัตน์มหาเวท',
  },
  archer: {
    w: ['ธนูไม้หวาย', 'ธนูไม้มะเกลือ', 'ธนูเขาเก้ง', 'ธนูลายรดน้ำ', 'ธนูเขาช้าง', 'ธนูปีกเหยี่ยว', 'ธนูพรานป่า', 'ธนูเงินยวง',
      'ธนูหางนกยูง', 'ธนูมรกต', 'ธนูพญาเสือ', 'ธนูอัคนี', 'ธนูดาวเหนือ', 'ธนูศรสวรรค์', 'ธนูสายฟ้า', 'ธนูทองพระอาทิตย์'],
    wl: 'ธนูปีกครุฑทองคำ',
    a: ['เสื้อผ้าป่านพราน', 'เสื้อกั๊กหนังกวาง', 'ชุดพรางใบไม้', 'เสื้อคลุมกันฝน', 'ชุดหนังเสือดาว', 'เสื้อพรานดง', 'ชุดพรางมอส', 'ผ้าคลุมเหยี่ยว',
      'ชุดนักล่าเงา', 'เสื้อหนังงูเหลือม', 'ชุดพรานมรกต', 'ผ้าคลุมพยัคฆ์', 'ชุดนักธนูหลวง', 'เกราะเกล็ดจระเข้', 'ชุดเงาไพร', 'เกราะพรานสวรรค์'],
    c: ['เครื่องรางขนนก', 'แหวนนิ้วโป้งหนัง', 'ปลอกแขนหนัง', 'จี้เหยี่ยวไม้', 'สร้อยเขี้ยวหมูป่า', 'แหวนเขากวาง', 'ปลอกแขนลายพราง', 'จี้ตาเหยี่ยว',
      'สร้อยเล็บเสือ', 'แหวนมรกต', 'ปลอกแขนเกล็ดงู', 'จี้ขนนกยูง', 'สร้อยเขี้ยวจระเข้', 'แหวนดาวเหนือ', 'ปลอกแขนพรานหลวง', 'จี้พญาเหยี่ยวทอง'],
    cl: 'จี้ขนครุฑมรกต',
  },
  boxer: {
    w: ['ผ้าพันมือด้ายดิบ', 'ผ้าพันมือชุบแป้ง', 'สนับมือหนังควาย', 'ผ้าคาดเชือกป่าน', 'สนับมือเหล็ก', 'ปลอกแขนนักมวย', 'ถุงมือหนังเสือ', 'สนับมือทองเหลือง',
      'ผ้าพันมือยันต์แดง', 'สนับมือหินภูเขาไฟ', 'ปลอกแขนคชสาร', 'ถุงมือพญาเสือ', 'สนับมือเพลิงกาฬ', 'ปลอกแขนเกราะเพชร', 'สนับมือเทพมวย', 'ถุงมือแชมป์ทองคำ'],
    wl: 'สนับมือพยัคฆ์อัคคี',
    a: ['กางเกงมวยผ้าดิบ', 'กางเกงมวยแดง', 'กางเกงมวยน้ำเงิน', 'ผ้าคาดเอวลายไทย', 'ชุดมวยคาดเชือก', 'ชุดมวยตะกรุด', 'ชุดมวยคาดประเจียด', 'กางเกงมวยลายเสือ',
      'ชุดมวยวัดเกาะ', 'ชุดนักมวยค่ายหลวง', 'กางเกงมวยลายกนก', 'ชุดมวยคชสาร', 'ชุดมวยเพลิง', 'ชุดมวยพญาช้างศึก', 'ชุดมวยเทพ', 'ชุดแชมป์สายสะพายทอง'],
    c: ['ประเจียดด้ายแดง', 'มงคลเชือกป่าน', 'เหรียญนำโชค', 'ประเจียดผ้ายันต์', 'ตะกรุดข้อมือ', 'สร้อยเสือเหลือง', 'ประเจียดลายกนก', 'มงคลด้ายสามสี',
      'เหรียญมวยวัด', 'ประเจียดหนังเสือ', 'กำไลเชือกศักดิ์สิทธิ์', 'สร้อยคชสาร', 'ประเจียดทองคำ', 'มงคลลงอาคม', 'เหรียญแชมป์', 'ประเจียดพญาเสือ'],
    cl: 'มงคลทองศักดิ์สิทธิ์',
  },
  healer: {
    w: ['ไม้เท้าเถาวัลย์ป่า', 'ไม้เท้าน้ำเต้ายา', 'ไม้เท้ากิ่งสะเดา', 'ไม้เท้าใบย่านาง', 'ไม้เท้าดอกบัวหลวง', 'ไม้เท้ากระบอกยา', 'ไม้เท้าเขากวางอ่อน', 'ไม้เท้ารากไทร',
      'ไม้เท้าโกฐจุฬา', 'ไม้เท้าหมอเทวดา', 'ไม้เท้าว่านมหาเสน่ห์', 'ไม้เท้าชีวกโอสถ', 'ไม้เท้าโอสถทิพย์', 'ไม้เท้าสมุนไพรพันปี', 'ไม้เท้ามรกตโอสถ', 'ไม้เท้าน้ำอมฤต'],
    wl: 'ไม้เท้าโอสถสวรรค์',
    a: ['เสื้อผ้าฝ้ายหมอยา', 'ชุดหมอยาพื้นบ้าน', 'ผ้าคลุมใบตอง', 'เสื้อลายสมุนไพร', 'ชุดหมอสมุนไพร', 'ผ้าคลุมเถาวัลย์', 'ชุดหมอยาป่า', 'เสื้อคลุมว่านยา',
      'ชุดโอสถศาลา', 'ผ้าคลุมใบบัว', 'ชุดหมอหลวง', 'เสื้อคลุมมรกต', 'ชุดหมอเทวดา', 'ผ้าคลุมโอสถทิพย์', 'ชุดแพทย์หลวง', 'อาภรณ์ชีวกโอสถ'],
    c: ['ย่ามใส่ยา', 'ลูกประคำไม้หอม', 'ถุงยาผ้าฝ้าย', 'จี้เมล็ดสมอ', 'น้ำเต้าจิ๋ว', 'สร้อยลูกกลอน', 'กำไลรากไม้', 'จี้ใบโพธิ์',
      'ตลับยาเงิน', 'ลูกประคำโกฐ', 'จี้ครกหยก', 'ตลับยาทอง', 'สร้อยมรกตโอสถ', 'กำไลว่านศักดิ์สิทธิ์', 'จี้น้ำอมฤต', 'ตลับยาทิพย์'],
    cl: 'ตลับโอสถนพเก้า',
  },
};
const WTYPE = { swordman: 'sword', mage: 'staff', archer: 'bow', boxer: 'wraps', healer: 'herb' };
const JOB_KEY = { swordman: 'sword', mage: 'mage', archer: 'archer', boxer: 'boxer', healer: 'healer' };
/** ภาพจับถือ (grip) ยืมจากสายที่รูปทรงอาวุธเหมือนกัน · ไอคอนของหมอยาใช้ไฟล์ของตัวเอง (it_g_healer_*) */
const GRIP_KEY = { healer: 'mage' };
const ICON = { swordman: ['⚔️', '🛡️', '📿'], mage: ['🔮', '🧥', '📿'], archer: ['🏹', '🦺', '🪶'], boxer: ['🥊', '🩳', '🎗️'], healer: ['🌿', '🥼', '🧿'] };

const R = Math.round, F = Math.floor;
/** ราคาซื้อตามเลเวล */
export const gearPrice = (lv) => R((50 + lv * lv * 12 + lv * 40) / 10) * 10;
/** ราคาขายร้านของอุปกรณ์ดรอป (สัดส่วนของ gearPrice) · 0.3 → 0.1 กันเงินเฟ้อจากการออโต้ทั้งวัน (ของดี ๆ ไปขายในตลาดผู้เล่นแทน) */
export const DROP_SELL = 0.1;

function weaponBonus(job, lv, leg) {
  const m = leg ? 1.22 : 1;
  if (job === 'swordman') return { atk: R((6 + lv * 2.9) * m), ...(lv >= 6 ? { crit: +(0.01 * F(lv / 6) + (leg ? 0.03 : 0)).toFixed(2) } : {}), ...(leg ? { STR: 6 } : {}) };
  if (job === 'mage') return { matk: R((8 + lv * 3.1) * m), mp: R((10 + lv * 4) * m), ...(lv >= 8 ? { INT: F(lv / 8) + (leg ? 5 : 0) } : {}) };
  if (job === 'archer') return { atk: R((5 + lv * 2.7) * m), DEX: 1 + F(lv / 5) + (leg ? 5 : 0), ...(leg ? { crit: 0.05 } : {}) };
  if (job === 'healer') return { matk: R((7 + lv * 2.6) * m), mp: R((10 + lv * 3.5) * m), hp: R((8 + lv * 3) * m), healMul: +((0.05 + lv * 0.004) * m).toFixed(3), ...(lv >= 8 ? { VIT: F(lv / 8) + (leg ? 5 : 0) } : {}) };   // หมอยา: พลังรักษาเป็นค่าหลัก
  return { atk: R((5 + lv * 2.5) * m), STR: 1 + F(lv / 6) + (leg ? 5 : 0), crit: +(0.01 + F(lv / 10) * 0.01 + (leg ? 0.03 : 0)).toFixed(2) };
}
function armorBonus(job, lv) {
  const def = 3 + lv * 0.95, hp = 20 + lv * 9;
  if (job === 'swordman') return { def: R(def * 1.1), hp: R(hp * 1.3), ...(lv >= 6 ? { VIT: F(lv / 6) } : {}) };
  if (job === 'mage') return { def: R(def * 0.7), hp: R(hp * 0.8), mp: R(15 + lv * 5), matk: R(lv * 0.8) };
  if (job === 'archer') return { def: R(def * 0.85), hp: R(hp), DEX: 1 + F(lv / 6) };
  if (job === 'healer') return { def: R(def * 0.85), hp: R(hp * 1.1), mp: R(10 + lv * 4), healMul: +(0.02 + lv * 0.0015).toFixed(3), ...(lv >= 6 ? { INT: F(lv / 6) } : {}) };
  return { def: R(def * 0.9), hp: R(hp * 1.15), STR: 1 + F(lv / 6) };
}
function accBonus(job, lv, leg) {
  const m = leg ? 1.5 : 1;
  if (job === 'swordman') return { STR: R((1 + lv / 4) * m), def: R((1 + lv / 5) * m), ...(lv >= 6 ? { LUK: R(lv / 6 * m) } : {}) };
  if (job === 'mage') return { INT: R((1 + lv / 4) * m), mp: R((10 + lv * 3) * m), ...(lv >= 4 ? { matk: R(lv * 0.5 * m) } : {}) };
  if (job === 'archer') return { DEX: R((1 + lv / 4) * m), ...(lv >= 6 ? { LUK: R(lv / 6 * m) } : {}), ...(lv >= 10 ? { crit: +(0.005 * F(lv / 5) * m).toFixed(3) } : {}) };
  if (job === 'healer') return { INT: R((1 + lv / 5) * m), VIT: R((1 + lv / 6) * m), mp: R((8 + lv * 2.5) * m), healMul: +((0.02 + lv * 0.002) * m).toFixed(3) };
  return { STR: R((1 + lv / 5) * m), AGI: R((1 + lv / 5) * m), hp: R((10 + lv * 4) * m) };   // มวย: STR + AGI แบบ RO
}

// ------------------------------------------------------------
//  ชิ้นส่วนใหม่ (แบบ PoE): หมวก · ถุงมือ · รองเท้า · เข็มขัด  — 8 ระดับต่อสาย (Lv.1–20 ขายที่ครู · Lv.24/28 ดรอป/หลอม)
// ------------------------------------------------------------
export const PART_TIERS = [1, 4, 8, 12, 16, 20, 24, 28];
const PART_WORD = ['ผ้าดิบ', 'หนังควาย', 'ทองเหลือง', 'เหล็กน้ำพี้', 'ลงยันต์', 'เงินยวง', 'ทองคำ', 'เทพอสูร'];
const PART_NOUN = {
  swordman: { helm: 'หมวกเกราะ', gloves: 'ถุงมือเกราะ', boots: 'รองเท้าเกราะ', belt: 'เข็มขัดศึก' },
  mage:     { helm: 'ผ้าโพกยันต์', gloves: 'ปลอกแขนยันต์', boots: 'รองเท้าลงอักขระ', belt: 'สายคาดเอวยันต์' },
  archer:   { helm: 'หมวกพราน', gloves: 'ปลอกแขนพราน', boots: 'รองเท้าพรานป่า', belt: 'เข็มขัดซองศร' },
  boxer:    { helm: 'มงคลคาดหัว', gloves: 'สนับศอก', boots: 'ผ้าพันแข้ง', belt: 'ผ้าคาดเอวมวย' },
  healer:   { helm: 'ผ้าโพกหมอยา', gloves: 'ปลอกแขนหมอยา', boots: 'รองเท้าเดินดง', belt: 'ย่ามคาดเอว' },
};
const PART_ICON = { helm: '⛑️', gloves: '🧤', boots: '🥾', belt: '🎗️' };
const PART_CODE = { helm: 'h', gloves: 'g', boots: 'b', belt: 'e' };
function partBonus(slot, job, lv) {
  if (slot === 'helm') {
    const b = { def: R(1 + lv * 0.45), hp: R(10 + lv * 4) };
    if (job === 'swordman') return { ...b, hp: R(b.hp * 1.2), ...(lv >= 8 ? { VIT: F(lv / 8) } : {}) };
    if (job === 'mage') return { def: R(b.def * 0.7), mp: R(10 + lv * 3), ...(lv >= 8 ? { INT: F(lv / 8) } : {}) };
    if (job === 'healer') return { def: R(b.def * 0.8), hp: b.hp, mp: R(8 + lv * 2), healMul: +(0.01 + lv * 0.001).toFixed(3), ...(lv >= 8 ? { INT: F(lv / 8) } : {}) };
    if (job === 'archer') return { ...b, ...(lv >= 4 ? { DEX: F(lv / 6) + 1 } : {}) };
    return { ...b, ...(lv >= 4 ? { STR: F(lv / 6) + 1 } : {}) };
  }
  if (slot === 'gloves') {
    if (job === 'swordman') return { atk: R(2 + lv * 0.9), acc: R(1 + lv / 4) };
    if (job === 'mage') return { matk: R(2 + lv * 1.0), ...(lv >= 8 ? { INT: F(lv / 8) } : {}) };
    if (job === 'healer') return { matk: R(2 + lv * 0.8), hp: R(5 + lv * 2), healMul: +(0.01 + lv * 0.001).toFixed(3) };
    if (job === 'archer') return { atk: R(2 + lv * 0.8), ...(lv >= 8 ? { crit: +(0.01 * F(lv / 8)).toFixed(2) } : {}) };
    return { atk: R(2 + lv * 0.85), ...(lv >= 8 ? { crit: +(0.01 * F(lv / 8)).toFixed(2) } : {}) };
  }
  if (slot === 'boots') {
    const b = { def: R(1 + lv * 0.35), eva: R(1 + lv * 0.3), hp: R(5 + lv * 2) };
    if (job === 'archer') return { ...b, eva: R(b.eva * 1.4) };
    if (job === 'mage' || job === 'healer') return { ...b, def: R(b.def * 0.7), mp: R(5 + lv * 2) };
    return b;
  }
  const b = { hp: R(15 + lv * 5), flaskPct: 5 + Math.min(lv, 45) };                     // เข็มขัด: เลือด + ขวดยาฟื้นแรงขึ้น %
  if (job === 'mage') return { hp: R(b.hp * 0.7), mp: R(10 + lv * 3), flaskPct: b.flaskPct };
  if (job === 'healer') return { hp: b.hp, mp: R(8 + lv * 2), flaskPct: b.flaskPct + 5 };
  if (job === 'swordman') return { ...b, def: R(1 + lv / 5) };
  return b;
}

/** สร้างรายการอุปกรณ์ทั้งหมด → { id: item } */
function build() {
  const out = {};
  for (const [job, N] of Object.entries(NAMES)) {
    const k = JOB_KEY[job], [iw, ia, ic] = ICON[job], gk = GRIP_KEY[job] || k;
    const GA = (id) => GEAR_ART[id] || GEAR_ART[id.replace(`g_${k}_`, `g_${gk}_`)] || {};
    GEAR_TIERS.forEach((lv, i) => {
      const n = String(i + 1).padStart(2, '0'), shop = lv <= SHOP_MAX_LV;
      const base = (id, extra) => ({ ...(shop ? { price: gearPrice(lv) } : { sell: R(gearPrice(lv) * DROP_SELL) }), lv, job, tier: i + 1, drop: !shop, ...extra, ...GA(id) });
      out[`g_${k}_w${n}`] = base(`g_${k}_w${n}`, { nameTh: N.w[i], type: 'weapon', icon: iw, wtype: WTYPE[job], bonus: weaponBonus(job, lv) });
      out[`g_${k}_a${n}`] = base(`g_${k}_a${n}`, { nameTh: N.a[i], type: 'armor', icon: ia, bonus: armorBonus(job, lv) });
      out[`g_${k}_c${n}`] = base(`g_${k}_c${n}`, { nameTh: N.c[i], type: 'accessory', icon: ic, bonus: accBonus(job, lv) });
    });
    for (const slot of ['helm', 'gloves', 'boots', 'belt']) {
      PART_TIERS.forEach((lv, i) => {
        const shop = lv <= SHOP_MAX_LV, id = `g_${k}_${PART_CODE[slot]}${String(i + 1).padStart(2, '0')}`;
        const price = R(gearPrice(lv) * 0.6 / 10) * 10;
        out[id] = { ...(shop ? { price } : { sell: R(price * DROP_SELL) }), lv, job, tier: i + 1, drop: !shop, nameTh: `${PART_NOUN[job][slot]}${PART_WORD[i]}`,
          type: slot, icon: PART_ICON[slot], art: `gx_${k}_${slot}_${lv >= 16 ? 2 : 1}`, bonus: partBonus(slot, job, lv) };
      });
    }
    // ---- อุปกรณ์แมพต่างแดน Lv.35–95 (ดรอปเท่านั้น) · ใช้ภาพของชิ้นขั้นสูงเดิม (art/lookAs) จนกว่าจะมีภาพใหม่ ----
    HIGH_TIERS.forEach((lv, i) => {
      const n = String(GEAR_TIERS.length + i + 1).padStart(2, '0'), ref = String(12 + (i % 5)).padStart(2, '0'), sfx = HIGH_WORD[i];
      const hi = (code, extra) => { const rid = `g_${k}_${code}${ref}`; return { sell: R(gearPrice(lv) * DROP_SELL), lv, job, tier: GEAR_TIERS.length + i + 1, drop: true, realm: true, ...GA(rid), art: rid, lookAs: rid, ...extra }; };
      out[`g_${k}_w${n}`] = hi('w', { nameTh: `${HIGH_NOUN[job][0]}${sfx}`, type: 'weapon', icon: iw, wtype: WTYPE[job], bonus: weaponBonus(job, lv) });
      out[`g_${k}_a${n}`] = hi('a', { nameTh: `${HIGH_NOUN[job][1]}${sfx}`, type: 'armor', icon: ia, bonus: armorBonus(job, lv) });
      out[`g_${k}_c${n}`] = hi('c', { nameTh: `${HIGH_NOUN[job][2]}${sfx}`, type: 'accessory', icon: ic, bonus: accBonus(job, lv) });
    });
    HIGH_PART_TIERS.forEach((lv, i) => {
      const n = String(PART_TIERS.length + i + 1).padStart(2, '0'), sfx = HIGH_WORD[HIGH_TIERS.indexOf(lv)];
      for (const slot of ['helm', 'gloves', 'boots', 'belt']) {
        const id = `g_${k}_${PART_CODE[slot]}${n}`, price = R(gearPrice(lv) * 0.6 / 10) * 10;
        out[id] = { sell: R(price * DROP_SELL), lv, job, tier: PART_TIERS.length + i + 1, drop: true, realm: true, nameTh: `${PART_NOUN[job][slot]}${sfx}`,
          type: slot, icon: PART_ICON[slot], art: `gx_${k}_${slot}_2`, bonus: partBonus(slot, job, lv) };
      }
    });
    const leg = (id, extra) => ({ lv: 30, job, tier: 17, legend: true, sell: 5000, ...extra, ...GA(id) });
    out[`g_${k}_wleg`] = leg(`g_${k}_wleg`, { nameTh: `✦ ${N.wl}`, type: 'weapon', icon: iw, wtype: WTYPE[job], bonus: weaponBonus(job, 30, true) });
    out[`g_${k}_cleg`] = leg(`g_${k}_cleg`, { nameTh: `✦ ${N.cl}`, type: 'accessory', icon: ic, bonus: accBonus(job, 30, true) });
  }
  return out;
}
/** ---- อุปกรณ์ขอบแดง "ชุดสุริยคราส" (บอสโลกพระราหู · หลอมจากศิลาราหู / ดรอปตามอันดับ) Lv.140 (โบนัสขั้น Lv.150) ---- */
const RED_NAMES = {
  swordman: ['ดาบคราสสุริยา', 'ตะกรุดราหูกลืนตะวัน'], mage: ['คทาจันทร์ดับ', 'ลูกแก้วคราสเงา'], archer: ['ธนูราหูอมจันทร์', 'ขนนกราหูดำ'],
  boxer: ['ประเจียดราหูกลืนฟ้า', 'มงคลเมฆคราส'], healer: ['ไม้เท้าอมฤตจันทร์', 'จี้จันทร์เลือด'],
};
function buildRed(out) {
  for (const [job, [wn, cn]] of Object.entries(RED_NAMES)) {
    const k = JOB_KEY[job], [iw, , ic] = ICON[job];
    const art = (code) => (out[`g_${k}_${code}leg`] ? `g_${k}_${code}leg` : `g_${k}_${code}16`);   // จุดจับสำรอง (ถ้าภาพของตัวเองยังไม่มี grip)
    const wb = weaponBonus(job, 150, true), cb = accBonus(job, 150, true);
    out[`g_${k}_wred`] = { lv: 140, job, tier: 30, red: true, sell: 20000, nameTh: `☾ ${wn}`, type: 'weapon', icon: iw, wtype: WTYPE[job], bonus: { ...wb, critDmg: +((wb.critDmg || 0) + 0.15).toFixed(2) }, ...(GEAR_ART[`g_${k}_wred`]?.grip ? GEAR_ART[`g_${k}_wred`] : GEAR_ART[art('w')] || {}) };
    out[`g_${k}_cred`] = { lv: 140, job, tier: 30, red: true, sell: 20000, nameTh: `☾ ${cn}`, type: 'accessory', icon: ic, bonus: { ...cb, hpMul: +((cb.hpMul || 0) + 0.06).toFixed(2) } };
    // ขั้นต่ำ (ราหูขั้น 1–4 · เซิร์ฟยังเลเวลไม่ถึง): ชื่อเดียวกัน + เลขขั้น · ค่าตามเลเวลของชิ้น (ไม่เท่าชิ้น Lv.140) · โบนัสแดงเล็กลงตามขั้น
    for (const [L, roman] of RED_LOW) {
      const w = weaponBonus(job, L, true), c = accBonus(job, L, true), s = L / 150;
      out[`g_${k}_wred${L}`] = { lv: L, job, tier: Math.round(L / 5), red: true, redLow: true, sell: Math.round(20000 * s), nameTh: `☾ ${wn} ${roman}`, type: 'weapon', icon: iw, wtype: WTYPE[job], bonus: { ...w, critDmg: +((w.critDmg || 0) + 0.15 * s).toFixed(2) }, ...(GEAR_ART[`g_${k}_wred`]?.grip ? GEAR_ART[`g_${k}_wred`] : GEAR_ART[art('w')] || {}), art: `g_${k}_wred` };   // ไอคอน/ภาพเดียวกับชิ้น Lv.140
      out[`g_${k}_cred${L}`] = { lv: L, job, tier: Math.round(L / 5), red: true, redLow: true, sell: Math.round(20000 * s), nameTh: `☾ ${cn} ${roman}`, type: 'accessory', icon: ic, bonus: { ...c, hpMul: +((c.hpMul || 0) + 0.06 * s).toFixed(2) }, art: `g_${k}_cred` };
    }
  }
  return out;
}
/** ของแดงขั้นต่ำตามขั้นราหู (Lv.30/60/90/120) · ชิ้น Lv.140 เดิมคือขั้นสูงสุด */
const RED_LOW = [[30, 'I'], [60, 'II'], [90, 'III'], [120, 'IV']];
export const GEAR = buildRed(build());
/** อุปกรณ์ขอบแดง (ชุดสุริยคราส) */
export const RED_GEAR = Object.keys(GEAR).filter((id) => GEAR[id].red);
export const GEAR_IDS = Object.keys(GEAR);
export const LEGEND_IDS = GEAR_IDS.filter((id) => GEAR[id].legend);

/** รายการขายของครูแต่ละอาชีพ (เรียงตามเลเวล) */
export const gearShopStock = (job) => GEAR_IDS.filter((id) => GEAR[id].job === job && !GEAR[id].drop && !GEAR[id].legend && !GEAR[id].red)
  .sort((a, b) => GEAR[a].lv - GEAR[b].lv || GEAR_ORDER.indexOf(GEAR[a].type) - GEAR_ORDER.indexOf(GEAR[b].type));
const GEAR_ORDER = ['weapon', 'helm', 'armor', 'gloves', 'boots', 'belt', 'accessory'];

/** ดรอปอุปกรณ์ขั้นสูงจากผี: เลือกชิ้น drop ที่เลเวลใกล้ผี (−4 … +2) โอกาส 1.2% ต่อตัว (× ตัวคูณดรอป) */
export function rollGearDrop(monLevel, dropMul = 1, rnd = Math.random, job = null) {
  if (rnd() > 0.02 * dropMul) return null;                       // 2% ต่อตัว (ของมีค่าสุ่มจาก affixes.js)
  // ผีดรอปได้ทั้งของร้าน (มักมีค่าสุ่มติดมา) และของดรอปล้วน · ไม่รวมของตำนาน
  const L = Math.min(monLevel, 148);                              // บอส Lv.99 (+6) ยังดรอปของขั้นสูงสุด Lv.95 ได้
  const pool = GEAR_IDS.filter((id) => !GEAR[id].legend && !GEAR[id].red && GEAR[id].lv >= L - 4 && GEAR[id].lv <= L + 2);
  const mine = job ? pool.filter((id) => GEAR[id].job === job) : [];
  if (mine.length && rnd() < 0.5) return mine[F(rnd() * mine.length)];   // ครึ่งหนึ่งเป็นของสายคนฆ่า (ที่เหลือสุ่มทุกสาย ไว้ขาย/เทรด)
  return pool.length ? pool[F(rnd() * pool.length)] : null;
}

// ============================================================
//  โบนัสชุดประจำสาย: สวมอุปกรณ์สายเดียวกันหลายชิ้น (อาวุธ/ชุด/เครื่องประดับ 2 ข้าง)
//  ระดับโบนัสคิดจากเลเวลต่ำสุดของชิ้นที่นับ → ใส่ชิ้นเลเวลสูงครบชุด = โบนัสแรงขึ้น
// ============================================================
export const SET_NAME = { swordman: 'ชุดขุนศึก', mage: 'ชุดหมอธรรม', archer: 'ชุดพรานไพร', boxer: 'ชุดนักมวยวัด', healer: 'ชุดหมอยาศาลาโอสถ' };
const SET_BONUS = {
  swordman: [(L) => ({ def: R(2 + L / 4) }), (L) => ({ atk: R(4 + L / 2), hp: R(30 + L * 6) }), (L) => ({ crit: 0.05, STR: R(2 + L / 6) }), (L) => ({ patkMul: 0.08, hp: R(40 + L * 5) })],
  mage:     [(L) => ({ mp: R(20 + L * 3) }), (L) => ({ matk: R(5 + L * 0.6), INT: R(1 + L / 8) }), (L) => ({ crit: 0.04, matk: R(4 + L / 2) }), (L) => ({ matkMul: 0.08, mp: R(30 + L * 4) })],
  archer:   [(L) => ({ DEX: R(1 + L / 8) }), (L) => ({ atk: R(4 + L / 2), LUK: R(1 + L / 8) }), (L) => ({ crit: 0.06, DEX: R(2 + L / 6) }), (L) => ({ patkMul: 0.08, eva: R(3 + L / 4) })],
  boxer:    [(L) => ({ hp: R(25 + L * 5) }), (L) => ({ atk: R(4 + L / 2), def: R(2 + L / 5) }), (L) => ({ crit: 0.05, VIT: R(2 + L / 6) }), (L) => ({ patkMul: 0.08, def: R(3 + L / 4) })],
  healer:   [(L) => ({ mp: R(20 + L * 3) }), (L) => ({ matk: R(4 + L * 0.5), VIT: R(1 + L / 8) }), (L) => ({ hp: R(30 + L * 5), INT: R(1 + L / 8) }), (L) => ({ matkMul: 0.06, hpMul: 0.06 })],
};
const SET_NEED = [2, 3, 4, 6];
export const SET_TEXT = { 2: '2 ชิ้น', 3: '3 ชิ้น', 4: '4 ชิ้น', 6: '6 ชิ้นขึ้นไป' };

/** ชุดที่ใส่อยู่ → { job, n, lv, bonus, tiers:[{n, bonus, on}] } (null = ไม่มีชุด ≥2 ชิ้น) */
export function setInfo(equipment = {}) {
  const by = {};
  for (const slot of ['weapon', 'helm', 'armor', 'gloves', 'boots', 'belt', 'accessory', 'accessory2']) {
    const it = GEAR[baseItemId(equipment[slot])];   // ของมีค่าสุ่ม (base@...) นับเป็นชิ้นเดียวกับของฐาน
    if (!it?.job) continue;
    (by[it.job] ||= []).push(it.lv);
  }
  const best = Object.entries(by).sort((a, b) => b[1].length - a[1].length || Math.min(...b[1]) - Math.min(...a[1]))[0];
  if (!best || best[1].length < 2) return null;
  const [job, lvs] = best, n = lvs.length, lv = Math.min(...lvs);
  const bonus = {}, tiers = [];
  SET_BONUS[job].forEach((f, i) => {
    const need = SET_NEED[i], b = f(lv), on = n >= need;
    tiers.push({ n: need, bonus: b, on });
    if (on) for (const [k, v] of Object.entries(b)) bonus[k] = +((bonus[k] || 0) + v).toFixed(3);
  });
  return { job, n, lv, bonus, tiers, nameTh: SET_NAME[job] };
}
