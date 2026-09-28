// ============================================================
//  ระบบสกิล (5 อาชีพ × 6 สกิล + ขุนศึก/จอมขมังเวทย์ มีสกิลขั้นสูงเพิ่มอีก 4) + Skill Tree
//  ▸ เรียน/อัปเลเวลสกิลด้วย Skill Point (SP) ได้ 1 SP ต่อเลเวลตัวละคร
//  ▸ สกิลละ 5 เลเวล: ตัวคูณดาเมจ +15%/เลเวล, คูลดาวน์ -4%/เลเวล, MP +10%/เลเวล
//  ▸ ติดตั้งลง Hotbar Q W E R T (ลาก-วาง หรือคลิกเลือก)
//
//  type:
//   melee      ตีด้านหน้า  { range, hits, interval, all, knock }
//   projectile ยิงกระสุน   { proj, speed, range, count, spread, pierce }
//   dash       พุ่งตีตามทาง { distance, leap }
//   aoe        วงรอบจุด    { radius, offset, hits, interval, fx }
//   strike     ฟ้าผ่าเป้าที่ใกล้สุด { range }
//   buff       บัฟตัวเอง    { buff:{atkMul,critAdd,def}, duration, heal }
//   party      บัฟ/ฮีลทั้งปาร์ตี้ในรัศมี { radius, buff, duration, heal, mpHeal } (เล่นคนเดียวก็ได้ผลกับตัวเอง)
//   ── หมอยา (ฮีลคิดที่ server จาก พลังเวทย์ × hmult · "เพื่อน" = ตัวเอง + ปาร์ตี้ในแมพเดียวกัน) ──
//   tether     สายใยผูกเพื่อน 1 คน { range, near, nearMul, breakAt, duration, tick, hmult }
//   bounce     ลูกกลอนเด้ง เพื่อน↔ผี { bounces, hop, range, hmult, mult }
//   seed       เมล็ดฝังเพื่อน บานเมื่อครบเวลา/เลือดต่ำ { range, delay, lowHp, hmult }
//   revive     พิธีชุบชีวิต/รักษา% + กันตาย { radius, heal, undying, castMs }
//   mortar     ครกยาลงพื้น ตีผีในวง แล้วรักษาเพื่อนในวง { offset, radius, hits, interval, mult, hmult, perHit, perMax }
//  effect (ติดกับศัตรูที่โดน):
//   stun   { ms }              ศัตรูขยับ/โจมตีไม่ได้
//   poison { ticks, every, ratio } ดาเมจต่อเนื่อง ratio × ดาเมจครั้งแรก ต่อ tick
// ============================================================
import { SUB_CAP } from './classes.js';
import { PASSIVES, KEYSTONE, BRANCHES, branchPoints, PASSIVES_ON } from './passives.js';

// Hotbar 10 ช่อง (ปุ่มตัวเลขแถวบน 1–0) · ใส่ได้ทั้งสกิล (id สกิล) และไอเทม ('it:<id ไอเทม>')
export const SKILL_SLOTS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
export const OLD_SKILL_SLOTS = ['Q', 'W', 'E', 'R', 'T'];          // เซฟเก่า → ย้ายไปช่อง 3–7
export const SLOT_KEYNAME = { 1: 'ONE', 2: 'TWO', 3: 'THREE', 4: 'FOUR', 5: 'FIVE', 6: 'SIX', 7: 'SEVEN', 8: 'EIGHT', 9: 'NINE', 0: 'ZERO' };
export const isItemSlot = (v) => typeof v === 'string' && v.startsWith('it:');
export const slotItemId = (v) => (isItemSlot(v) ? v.slice(3) : null);
export const MAX_SKILL_LV = 5;
export const SP_PER_LEVEL = 1;
export const START_SP = 1;

export const SKILLS = {
  // ---------------- จอมขมังเวทย์ ----------------
  mage: [
    { id: 'mage_akom', nameTh: 'คาถาอาคม', icon: '📿', reqLv: 1, type: 'projectile', kind: 'magic',
      mp: 6, cd: 1800, mult: 0.72, proj: 'fireball', speed: 270, range: 240, count: 3, spread: 12, sfx: 'fireball',
      desc: 'ยิงลูกไฟอาคม 3 ลูกโค้งเข้าเป้า' },
    { id: 'mage_yant', nameTh: 'ยันต์ตรึงวิญญาณ', icon: '📜', reqLv: 2, type: 'projectile', kind: 'magic',
      mp: 10, cd: 6000, mult: 1.1, proj: 'yant', speed: 220, range: 220, pierce: true, effect: { stun: { ms: 1800 } }, sfx: 'buff',
      desc: 'ปายันต์ทอง 3 แผ่นวนเข้าเป้า โซ่วิญญาณล็อกศัตรูนิ่ง 1.8 วิ (ทะลุทุกตัว)' },
    { id: 'mage_shield', nameTh: 'เกราะยันต์เก้ายอด', icon: '🛡️', reqLv: 4, type: 'buff',
      mp: 15, cd: 16000, buff: { def: 24 }, duration: 8000, heal: 0.25, sfx: 'buff',
      desc: 'ฟื้น HP 25% ป้องกัน +24 นาน 8 วิ' },
    { id: 'mage_thunder', nameTh: 'อัสนีบาต', icon: '⚡', reqLv: 6, type: 'strike', kind: 'magic',
      mp: 14, cd: 5000, mult: 2.6, range: 270, effect: { stun: { ms: 700 } }, sfx: 'thunder',
      desc: 'ฟ้าผ่าศัตรูที่ใกล้ที่สุด สะดุ้งชั่วครู่' },
    { id: 'mage_kalp', nameTh: 'เพลิงกัลป์ปราบผี', icon: '☄️', reqLv: 8, type: 'aoe', kind: 'magic', ultimate: true,
      mp: 35, cd: 22000, mult: 2.2, radius: 110, offset: 110, hits: 4, interval: 240, fx: 'meteor', sfx: 'meteor',
      desc: 'ไฟกัลป์ถล่มด้านหน้า 4 ระลอก' },
    { id: 'mage_holy', nameTh: 'น้ำมนต์ธาราทิพย์', icon: '🪷', reqLv: 10, type: 'party', party: true,
      mp: 30, cd: 24000, radius: 220, buff: { def: 12 }, duration: 10000, heal: 0.25, mpHeal: 0.15, sfx: 'buff',
      desc: '[ปาร์ตี้] บัวทิพย์บานกลางวง ฟื้น HP 25% + MP 15% ทั้งปาร์ตี้ · ป้องกัน +12 นาน 10 วิ' },
    // ---- สกิลขั้นสูง (Lv.20 / 40 / 70 / 100) ----
    { id: 'mage_ghostfire', nameTh: 'ไฟผีห้าทิศ', icon: '🔥', reqLv: 20, type: 'projectile', kind: 'magic',
      mp: 18, cd: 7000, mult: 0.95, proj: 'fireball', speed: 250, range: 230, count: 5, spread: 36, sfx: 'fireball',
      desc: 'เรียกไฟผีกองกอย 5 ดวงพุ่งแผ่เป็นพัด โดนได้หลายตัว' },
    { id: 'mage_curse', nameTh: 'คำสาปพรายตานี', icon: '☠️', reqLv: 40, type: 'aoe', kind: 'magic',
      mp: 24, cd: 11000, mult: 1.2, radius: 90, offset: 120, hits: 1, effect: { poison: { ticks: 6, every: 700, ratio: 0.4 } }, sfx: 'buff',
      desc: 'วงคำสาปใต้เป้า ผีทุกตัวในวงติดพิษพราย 6 ครั้ง' },
    { id: 'mage_meditate', nameTh: 'สมาธิกสิณไฟ', icon: '🧘', reqLv: 70, type: 'buff',
      mp: 20, cd: 32000, buff: { atkMul: 0.3, critAdd: 0.1 }, duration: 12000, heal: 0.1, sfx: 'buff',
      desc: 'เข้าฌานกสิณ พลังเวทย์ +30% คริ +10% ฟื้น HP 10% นาน 12 วิ' },
    { id: 'mage_storm', nameTh: 'พายุอัสนีเทพ', icon: '🌩️', reqLv: 100, type: 'aoe', kind: 'magic',
      mp: 48, cd: 20000, mult: 1.75, radius: 170, offset: 0, hits: 5, interval: 250, effect: { stun: { ms: 400 } }, sfx: 'thunder',
      desc: 'เรียกพายุฟ้าผ่ารอบตัว 5 ระลอก ผีในวงกว้างสะดุ้งทุกครั้ง' },
  ],
  // ---------------- หมอยา (ซัพพอร์ต) ----------------
  healer: [
    { id: 'heal_vine', nameTh: 'สายใยสมุนไพร', icon: '🌿', reqLv: 1, type: 'tether', kind: 'magic', element: 'water', heals: true,
      mp: 8, cd: 9000, range: 220, near: 90, nearMul: 1.5, breakAt: 230, duration: 6000, tick: 500, hmult: 0.06, sfx: 'buff',
      desc: 'เถาสมุนไพรผูกเพื่อนที่เลือดน้อยสุด 6 วิ รักษาทุก 0.5 วิ · ใกล้กว่า 90 แรง ×1.5 · ห่างเกิน 230 ขาด' },
    { id: 'heal_pill', nameTh: 'ลูกกลอนเด้งห้าทิศ', icon: '🟢', reqLv: 2, type: 'bounce', kind: 'magic', element: 'wind', heals: true,
      mp: 10, cd: 6000, range: 220, hop: 170, bounces: 5, mult: 0.9, hmult: 0.35, sfx: 'fireball',
      desc: 'ปายาเม็ดเด้ง 5 ครั้ง สลับเพื่อน → ผี → เพื่อน · โดนเพื่อนรักษา · โดนผีระเบิดฝุ่นยา' },
    { id: 'heal_seed', nameTh: 'เมล็ดพันธุ์ชีวา', icon: '🌱', reqLv: 4, type: 'seed', kind: 'magic', element: 'earth', heals: true,
      mp: 12, cd: 11000, range: 220, delay: 4000, lowHp: 0.3, hmult: 1.1, sfx: 'buff',
      desc: 'ฝังเมล็ดบนเพื่อน 4 วิแล้วบานรักษาก้อนใหญ่ · ถ้าเลือดต่ำกว่า 30% บานทันที' },
    { id: 'heal_tiger', nameTh: 'ยาต้มพยัคฆ์เหิน', icon: '🐯', reqLv: 6, type: 'party', party: true, element: 'fire',
      mp: 18, cd: 16000, radius: 200, buff: { defMul: 0.2, speed: 0.25, cleanse: true }, grow: { defMul: 0.03, speed: 0.025 }, duration: 8000, sfx: 'buff',
      desc: '[ทีม] ต้มยาพยัคฆ์ ไอยาแผ่ 200 รอบตัว · ป้องกัน +20% วิ่งเร็ว +25% ลบอาการช้า 8 วิ (เลเวล 5 = +32% / +35%)' },
    { id: 'heal_khwan', nameTh: 'พิธีสู่ขวัญ', icon: '🪷', reqLv: 8, type: 'revive', ultimate: true, element: 'light', heals: true,
      mp: 35, cd: 40000, radius: 220, castMs: 1200, heal: 0.4, undying: 10000, sfx: 'buff',
      desc: '★ ร่าย 1.2 วิ บายศรีสู่ขวัญ รักษา 40% ทุกคนในวง · ชุบชีวิตเพื่อนที่สลบ · ขวัญกันตาย 10 วิ (เลือดไม่ลดต่ำกว่า 1)' },
    { id: 'heal_mortar', nameTh: 'ครกยาระเบิดสมุนไพร', icon: '🪨', reqLv: 10, type: 'mortar', kind: 'magic', element: 'earth', heals: true,
      mp: 28, cd: 16000, offset: 110, radius: 110, hits: 3, interval: 280, mult: 1.4, hmult: 0.6, perHit: 0.1, perMax: 0.5, effect: { stun: { ms: 400 } }, sfx: 'thunder',
      desc: 'ตำครกยา 3 ที ลงกลางวง 110 · ผีในวงโดน ×1.4 + มึน · แล้วผงยาเขียววนเข้ารักษาเพื่อนในวง (+10% ต่อผีที่โดน สูงสุด +50%)' },
    // ---- สกิลขั้นสูง (Lv.20 / 40 / 70 / 100) · ซัพพอร์ตหลัก ----
    { id: 'heal_mist', nameTh: 'หมอกยาชโลมใจ', icon: '🌫️', reqLv: 20, type: 'party', party: true, element: 'water',
      mp: 22, cd: 14000, radius: 220, heal: 0.15, mpHeal: 0.1, buff: { def: 6 }, duration: 6000, sfx: 'buff',
      desc: '[ปาร์ตี้] พ่นหมอกยาหอม ฟื้น HP 15% + MP 10% ทั้งปาร์ตี้ · ป้องกัน +6 นาน 6 วิ' },
    { id: 'heal_tonic', nameTh: 'ยาบำรุงกำลังเจ็ดพลัง', icon: '🍶', reqLv: 40, type: 'party', party: true, element: 'fire',
      mp: 26, cd: 24000, radius: 220, buff: { atkMul: 0.18, defMul: 0.15 }, duration: 12000, heal: 0.05, sfx: 'buff',
      desc: '[ปาร์ตี้] แจกยาบำรุง โจมตี +18% ป้องกัน +15% ทั้งปาร์ตี้ 12 วิ' },
    { id: 'heal_mother', nameTh: 'พรแม่โพสพ', icon: '🌾', reqLv: 70, type: 'party', party: true, element: 'earth',
      mp: 40, cd: 30000, radius: 240, heal: 0.3, mpHeal: 0.2, buff: { critAdd: 0.1 }, duration: 8000, sfx: 'buff',
      desc: '[ปาร์ตี้] ขอพรแม่โพสพ ฟื้น HP 30% + MP 20% ทั้งปาร์ตี้ · คริ +10% นาน 8 วิ' },
    { id: 'heal_amrita', nameTh: 'น้ำอมฤตชุบชีวา', icon: '🏺', reqLv: 100, type: 'revive', element: 'light', heals: true,
      mp: 60, cd: 45000, radius: 260, castMs: 900, heal: 0.6, undying: 8000, sfx: 'buff',
      desc: 'ร่าย 0.9 วิ ประพรมน้ำอมฤต รักษา 60% ทุกคนในวงกว้าง · ชุบชีวิตเพื่อนที่สลบ · ขวัญกันตาย 8 วิ' },
  ],
  // ---------------- เคล็ดวิชาผสม (อยู่บนจุดผสมระหว่างสองกิ่ง · ใช้ได้เมื่อถืออาวุธของกิ่งใดกิ่งหนึ่ง) ----------------
  hybrid: [
    { id: 'hy_spellblade', nameTh: 'ดาบลงอาคม', icon: '🗡️', reqLv: 12, jobs: ['swordman', 'mage'], node: 'hy_swordman_mage', type: 'melee', kind: 'best',
      mp: 12, cd: 7000, mult: 1.25, range: 46, hits: 2, interval: 150, all: true, sfx: 'slash',
      desc: '[ดาบ+ไม้เท้า] ฟันไขว้ลงอาคม 2 ครั้ง โดนทุกตัวด้านหน้า · ใช้พลังโจมตีหรือพลังเวทย์ที่สูงกว่า' },
    { id: 'hy_holywater', nameTh: 'น้ำมนต์ยาลงยันต์', icon: '💧', reqLv: 12, jobs: ['mage', 'healer'], node: 'hy_mage_healer', type: 'party', party: true,
      mp: 20, cd: 20000, radius: 200, heal: 0.12, mpHeal: 0.1, buff: { def: 6 }, duration: 6000, sfx: 'buff',
      desc: '[ไม้เท้า+ไม้เท้าสมุนไพร] ประพรมน้ำมนต์ผสมยา ฟื้น HP 12% + MP 10% ทั้งปาร์ตี้ · ป้องกัน +6 นาน 6 วิ' },
    { id: 'hy_herbarrow', nameTh: 'ศรอาบว่าน', icon: '🌿', reqLv: 12, jobs: ['healer', 'archer'], node: 'hy_healer_archer', type: 'projectile', kind: 'best',
      mp: 10, cd: 6000, mult: 1.1, proj: 'arrow_poison', speed: 380, range: 270, effect: { poison: { ticks: 4, every: 700, ratio: 0.3 } }, sfx: 'arrow',
      desc: '[ไม้เท้าสมุนไพร+ธนู] ศรอาบว่านพิษ ดาเมจต่อเนื่อง 4 ครั้ง · ใช้พลังโจมตีหรือพลังเวทย์ที่สูงกว่า' },
    { id: 'hy_monkey', nameTh: 'วานรพลิกลม', icon: '🐒', reqLv: 12, jobs: ['archer', 'boxer'], node: 'hy_archer_boxer', type: 'dash', kind: 'physical',
      mp: 12, cd: 8000, mult: 1.8, distance: 90, leap: true, effect: { stun: { ms: 600 } }, sfx: 'dash',
      desc: '[ธนู+มวย] ตีลังกากระโดดถีบใส่เป้า แรงและมึนงง' },
    { id: 'hy_krabi', nameTh: 'กระบี่กระบองหมุน', icon: '🌀', reqLv: 12, jobs: ['boxer', 'swordman'], node: 'hy_boxer_swordman', type: 'aoe', kind: 'physical',
      mp: 14, cd: 9000, mult: 0.9, radius: 56, offset: 0, hits: 4, interval: 130, sfx: 'storm',
      desc: '[มวย+ดาบ] ควงกระบองรอบตัว 4 รอบ โดนทุกตัวรอบกาย' },
  ],
  // ---------------- นักมวยคาดเชือก ----------------
  boxer: [
    { id: 'boxer_jab', nameTh: 'หมัดแย็บ', icon: '👊', reqLv: 1, type: 'melee', kind: 'physical',
      mp: 3, cd: 2000, mult: 0.8, range: 28, hits: 3, interval: 110, sfx: 'punch',
      desc: 'แย็บรัว 3 หมัด' },
    { id: 'boxer_kick', nameTh: 'เตะก้านคอ', icon: '🦵', reqLv: 2, type: 'melee', kind: 'physical',
      mp: 6, cd: 4500, mult: 2.0, range: 34, knock: 240, effect: { stun: { ms: 700 } }, sfx: 'kick',
      desc: 'เตะแรง กระเด็นและมึนงง' },
    { id: 'boxer_croc', nameTh: 'จระเข้ฟาดหาง', icon: '🐊', reqLv: 4, type: 'aoe', kind: 'physical',
      mp: 10, cd: 7000, mult: 1.6, radius: 48, offset: 0, hits: 2, interval: 160, sfx: 'kick',
      desc: 'หมุนตัวเตะกลับหลัง โดนทุกตัวรอบตัว 2 ครั้ง' },
    { id: 'boxer_waikru', nameTh: 'ไหว้ครูรำมวย', icon: '🙏', reqLv: 6, type: 'buff',
      mp: 15, cd: 22000, buff: { atkMul: 0.35 }, duration: 12000, heal: 0.2, sfx: 'buff',
      desc: 'ฟื้น HP 20% พลังโจมตี +35% นาน 12 วิ' },
    { id: 'boxer_ngouy', nameTh: 'หักงวงไอยรา', icon: '🐘', reqLv: 8, type: 'dash', kind: 'physical', ultimate: true,
      mp: 25, cd: 18000, mult: 4.0, distance: 80, leap: true, effect: { stun: { ms: 1500 } }, sfx: 'dash',
      desc: 'กระโดดทุ่มศอกลงกลางหัว แรงมาก + มึนงง' },
    { id: 'boxer_drum', nameTh: 'กลองมังคละปลุกใจ', icon: '🥁', reqLv: 10, type: 'party', party: true,
      mp: 24, cd: 26000, radius: 220, buff: { def: 18, atkMul: 0.1 }, duration: 12000, heal: 0.15, sfx: 'buff',
      desc: '[ปาร์ตี้] ตีกลองศึก 3 จังหวะ ฟื้น HP 15% · ป้องกัน +18 โจมตี +10% ทั้งปาร์ตี้ 12 วิ' },
    // ---- สกิลขั้นสูง (Lv.20 / 40 / 70 / 100) ----
    { id: 'boxer_elbow', nameTh: 'ศอกกลับพลิกล็อก', icon: '💥', reqLv: 20, type: 'melee', kind: 'physical',
      mp: 12, cd: 5500, mult: 1.7, range: 30, hits: 2, interval: 130, effect: { stun: { ms: 500 } }, sfx: 'punch',
      desc: 'ศอกกลับ 2 จังหวะ ผีสะดุ้ง' },
    { id: 'boxer_knee', nameTh: 'เข่าลอยทะลวงฟ้า', icon: '🦿', reqLv: 40, type: 'dash', kind: 'physical',
      mp: 20, cd: 10000, mult: 2.8, distance: 95, radius: 55, leap: true, effect: { stun: { ms: 900 } }, sfx: 'dash',
      desc: 'กระโดดเข่าลอยเข้าหาเป้า ผีรอบจุดลงมึน 0.9 วิ' },
    { id: 'boxer_iron', nameTh: 'กายเหล็กคาถามหาอุด', icon: '🛡️', reqLv: 70, type: 'buff',
      mp: 26, cd: 28000, buff: { defMul: 0.3, atkMul: 0.2 }, duration: 10000, heal: 0.12, sfx: 'buff',
      desc: 'ลงคาถามหาอุด ป้องกัน +30% โจมตี +20% ฟื้น HP 12% นาน 10 วิ' },
    { id: 'boxer_hanuman', nameTh: 'หนุมานถวายแหวน', icon: '🐒', reqLv: 100, type: 'melee', kind: 'physical',
      mp: 44, cd: 16000, mult: 0.95, range: 38, hits: 8, interval: 110, all: true, sfx: 'punch',
      desc: 'ท่าไม้ครูหมัด-เท้า-เข่า-ศอก 8 จังหวะ โดนทุกตัวด้านหน้า' },
  ],
  // ---------------- ขุนศึก (ดาบคู่) ----------------
  swordman: [
    { id: 'sword_twin', nameTh: 'ฟันดาบคู่', icon: '⚔️', reqLv: 1, type: 'melee', kind: 'physical',
      mp: 5, cd: 2500, mult: 0.9, range: 46, hits: 3, interval: 120, all: true, sfx: 'slash',
      desc: 'ฟันไขว้ 3 ครั้ง โดนทุกตัวด้านหน้า' },
    { id: 'sword_thrust', nameTh: 'แทงทะลวง', icon: '🗡️', reqLv: 2, type: 'dash', kind: 'physical',
      mp: 8, cd: 6000, mult: 1.9, distance: 110, effect: { stun: { ms: 500 } }, sfx: 'dash',
      desc: 'พุ่งแทงทะลุแนวศัตรู สะดุ้งชั่วครู่ (อมตะระหว่างพุ่ง)' },
    { id: 'sword_wind', nameTh: 'ดาบวายุ', icon: '🌪️', reqLv: 4, type: 'projectile', kind: 'physical',
      mp: 10, cd: 5000, mult: 1.7, proj: 'wave', speed: 270, range: 230, pierce: true, sfx: 'wind',
      desc: 'คลื่นดาบทะลุทุกตัว' },
    { id: 'sword_guard', nameTh: 'ตั้งการ์ดดาบคู่', icon: '🛡️', reqLv: 6, type: 'buff',
      mp: 12, cd: 18000, buff: { def: 25, atkMul: 0.15 }, duration: 10000, heal: 0.15, sfx: 'buff',
      desc: 'ฟื้น HP 15% ป้องกัน +25 โจมตี +15% นาน 10 วิ' },
    { id: 'sword_pikat', nameTh: 'เพลงดาบพิฆาต', icon: '🔥', reqLv: 8, type: 'aoe', kind: 'physical', ultimate: true,
      mp: 28, cd: 20000, mult: 1.3, radius: 62, offset: 10, hits: 6, interval: 150, sfx: 'storm',
      desc: 'ร่ายเพลงดาบรอบตัว 6 ครั้ง' },
    { id: 'sword_banner', nameTh: 'ธงชัยเฉลิมพล', icon: '🚩', reqLv: 10, type: 'party', party: true,
      mp: 26, cd: 28000, radius: 220, buff: { atkMul: 0.22, def: 8 }, duration: 12000, heal: 0.08, sfx: 'buff',
      desc: '[ปาร์ตี้] ปักธงครุฑนำทัพ โจมตี +22% ป้องกัน +8 ทั้งปาร์ตี้ 12 วิ' },
    // ---- สกิลขั้นสูง (Lv.20 / 40 / 70 / 100) ----
    { id: 'sword_whirl', nameTh: 'ดาบบาทวงจักร', icon: '🌀', reqLv: 20, type: 'aoe', kind: 'physical',
      mp: 16, cd: 8000, mult: 1.15, radius: 78, offset: 0, hits: 3, interval: 180, sfx: 'storm',
      desc: 'หมุนดาบรอบตัว 3 รอบ ฟันทุกตัวรอบกาย' },
    { id: 'sword_leap', nameTh: 'กระโจนผ่าปฐพี', icon: '🦅', reqLv: 40, type: 'dash', kind: 'physical',
      mp: 22, cd: 12000, mult: 3.0, distance: 130, radius: 70, leap: true, effect: { stun: { ms: 1000 } }, sfx: 'dash',
      desc: 'กระโดดข้ามไปฟาดดาบลงพื้น ทุกตัวในวงรอบจุดลงสะดุ้ง 1 วิ' },
    { id: 'sword_berserk', nameTh: 'โทสะขุนศึก', icon: '😤', reqLv: 70, type: 'buff',
      mp: 30, cd: 30000, buff: { atkMul: 0.35, critAdd: 0.15, speed: 0.15 }, duration: 10000, heal: 0, sfx: 'buff',
      desc: 'ปลุกโทสะนักรบ โจมตี +35% คริ +15% วิ่งเร็วขึ้น 15% นาน 10 วิ' },
    { id: 'sword_execute', nameTh: 'ดาบประหารอสูร', icon: '⚡', reqLv: 100, type: 'melee', kind: 'physical',
      mp: 40, cd: 15000, mult: 5.2, range: 66, hits: 1, all: true, effect: { stun: { ms: 1500 } }, sfx: 'slash',
      desc: 'รวมพลังฟันดาบฟ้าผ่าเพียงครั้งเดียว แรงมาก โดนทุกตัวด้านหน้า มึน 1.5 วิ' },
  ],
  // ---------------- พรานป่า ----------------
  archer: [
    { id: 'arch_quick', nameTh: 'ศรฉับไว', icon: '🏹', reqLv: 1, type: 'projectile', kind: 'physical',
      mp: 4, cd: 1800, mult: 1.0, proj: 'arrow', speed: 400, range: 280, count: 2, spread: 6, sfx: 'arrow',
      desc: 'ยิงเร็ว 2 ดอกพร้อมกัน' },
    { id: 'arch_poison', nameTh: 'ศรพิษพรานไพร', icon: '🐍', reqLv: 2, type: 'projectile', kind: 'physical',
      mp: 8, cd: 5000, mult: 0.9, proj: 'arrow_poison', speed: 360, range: 280, effect: { poison: { ticks: 5, every: 700, ratio: 0.35 } }, sfx: 'arrow',
      desc: 'ศรอาบพิษ ดาเมจต่อเนื่อง 5 ครั้ง' },
    { id: 'arch_pierce', nameTh: 'ศรทะลวงเกราะ', icon: '🎯', reqLv: 4, type: 'projectile', kind: 'physical',
      mp: 10, cd: 6000, mult: 2.1, proj: 'arrow_big', speed: 520, range: 330, pierce: true, sfx: 'arrowBig',
      desc: 'ศรพลังสูงทะลุทุกตัว' },
    { id: 'arch_hawk', nameTh: 'ตาเหยี่ยว', icon: '🦅', reqLv: 6, type: 'buff',
      mp: 14, cd: 20000, buff: { atkMul: 0.3, critAdd: 0.3 }, duration: 10000, heal: 0, sfx: 'buff',
      desc: 'โจมตี +30% คริ +30% นาน 10 วิ' },
    { id: 'arch_rain', nameTh: 'ห่าฝนธนู', icon: '🌧️', reqLv: 8, type: 'aoe', kind: 'physical', ultimate: true,
      mp: 26, cd: 18000, mult: 1.25, radius: 90, offset: 110, hits: 5, interval: 200, fx: 'arrowRain', sfx: 'arrowRain',
      desc: 'ธนูตกเป็นห่าฝน 5 ระลอก' },
    { id: 'arch_garuda', nameTh: 'ลมใต้ปีกครุฑ', icon: '🪶', reqLv: 10, type: 'party', party: true,
      mp: 24, cd: 26000, radius: 220, buff: { critAdd: 0.15, atkMul: 0.1 }, duration: 12000, heal: 0.08, sfx: 'buff',
      desc: '[ปาร์ตี้] ปีกครุฑโอบปาร์ตี้ คริ +15% โจมตี +10% ทั้งปาร์ตี้ 12 วิ' },
    // ---- สกิลขั้นสูง (Lv.20 / 40 / 70 / 100) ----
    { id: 'arch_volley', nameTh: 'ศรกระจายเจ็ดดาว', icon: '✨', reqLv: 20, type: 'projectile', kind: 'physical',
      mp: 16, cd: 7000, mult: 0.9, proj: 'arrow', speed: 420, range: 280, count: 5, spread: 34, sfx: 'arrow',
      desc: 'ยิงศร 5 ดอกแผ่เป็นพัด โดนได้หลายตัวด้านหน้า' },
    { id: 'arch_trap', nameTh: 'กับดักหนามพราน', icon: '🪤', reqLv: 40, type: 'aoe', kind: 'physical',
      mp: 20, cd: 12000, mult: 1.6, radius: 72, offset: 120, hits: 1, effect: { stun: { ms: 1600 } }, sfx: 'kick',
      desc: 'ปากับดักหนามลงใต้เป้า ผีในวงโดนหนามแทงและติดกับ 1.6 วิ' },
    { id: 'arch_snipe', nameTh: 'ศรสังหารเหยี่ยวราตรี', icon: '🎯', reqLv: 70, type: 'projectile', kind: 'physical',
      mp: 32, cd: 14000, mult: 6.2, proj: 'arrow_big', speed: 760, range: 380, sfx: 'arrowBig',
      desc: 'เล็งนานแล้วยิงศรเดียวไกลมาก แรงมาก (เป้าเดียว)' },
    { id: 'arch_meteor', nameTh: 'ศรเพลิงอัคนีบาต', icon: '☄️', reqLv: 100, type: 'aoe', kind: 'physical',
      mp: 46, cd: 20000, mult: 1.75, radius: 120, offset: 140, hits: 5, interval: 240, fx: 'arrowRain', sfx: 'arrowRain',
      desc: 'ยิงศรเพลิงขึ้นฟ้า ตกเป็นห่าลูกไฟ 5 ระลอกในวงกว้าง' },
  ],
};

/** ค้นหาสกิลด้วย id */
export const SKILL_BY_ID = Object.fromEntries(
  Object.entries(SKILLS).flatMap(([job, list]) => list.map((s) => [s.id, { ...s, job }])));

/** ใช้สกิลนี้ได้ไหมเมื่อถืออาวุธแนว job (เคล็ดวิชาผสมใช้ได้ทั้งสองแนว) */
export const skillUsable = (base, job) => !!base && (base.job === job || (base.jobs || []).includes(job));
/** อาวุธที่ต้องถือ (ข้อความ) */
export const skillWeaponTh = (base, JOBS) => (base.jobs ? base.jobs : [base.job]).map((j) => JOBS[j]?.weaponTh).join(' หรือ ');

// ------------------------------------------------------------
//  ความชำนาญสกิล (แบบ Soul's Remnant: ยิ่งใช้ยิ่งเก่ง) — ร่ายสำเร็จ 1 ครั้ง = 1 แต้ม · ขั้นละ +2% ความแรง −1% คูลดาวน์ (สูงสุดขั้น 10)
// ------------------------------------------------------------
export const MASTERY_MAX = 10;
export const MASTERY_NEED = [0, 10, 30, 60, 100, 160, 240, 340, 460, 600, 800];
export function skillMastery(n = 0) {
  let m = 0; while (m < MASTERY_MAX && n >= MASTERY_NEED[m + 1]) m++;
  const next = MASTERY_NEED[m + 1];
  return { m, cur: n - MASTERY_NEED[m], need: next ? next - MASTERY_NEED[m] : 0 };
}
export const masteryOf = (c, id) => skillMastery(c?.skx?.[id] || 0).m;

/** ค่าจริงของสกิลตามเลเวล (1–5) + ขั้นความชำนาญ (0–10) */
export function skillStats(skill, lv = 1, mastery = 0) {
  const L = Math.max(1, Math.min(MAX_SKILL_LV, lv)) - 1, M = Math.max(0, Math.min(MASTERY_MAX, mastery | 0));
  return {
    ...skill,
    lv: L + 1, mastery: M,
    mult: skill.mult ? +(skill.mult * (1 + 0.15 * L) * (1 + 0.02 * M)).toFixed(3) : undefined,
    mp: Math.round(skill.mp * (1 + 0.1 * L)),
    cd: Math.round(skill.cd * (1 - 0.04 * L) * (1 - 0.01 * M)),
    duration: skill.duration ? Math.round(skill.duration * (1 + 0.1 * L)) : undefined,
    heal: typeof skill.heal === 'number' ? +(skill.heal * (1 + 0.1 * L)).toFixed(3) : skill.heal,
    hmult: skill.hmult ? +(skill.hmult * (1 + 0.15 * L) * (1 + 0.02 * M)).toFixed(3) : undefined,
    buff: skill.buff && skill.grow ? Object.fromEntries(Object.entries(skill.buff).map(([k, v]) => [k, typeof v === 'number' ? +(v + (skill.grow[k] || 0) * L).toFixed(3) : v])) : skill.buff,
  };
}

/** เลเวลตัวละครขั้นต่ำเพื่ออัปสกิลไปเลเวล nextLv (ทุกเลเวลสกิลเพิ่มขึ้นต้องเลเวลตัวละคร +2) */
export function reqCharLevel(skill, nextLv) {
  return skill.reqLv + (nextLv - 1) * 2;
}

/** เลเวลสกิลสูงสุดที่อัปได้ = 2 + (แต้มพรสวรรค์ในกิ่งอาวุธนั้น ÷ 2) สูงสุด 5 · ท่าไม้ตาย ★ ต้องมีคีย์สโตนของกิ่ง */
export function skillCap(char, skill) {
  const owned = char.passives || [];
  if (!PASSIVES_ON) return skill.jobs ? 0 : MAX_SKILL_LV;          // ปิดพรสวรรค์: สกิลอาวุธอัปได้เต็ม (ติดแค่เลเวลตัวละคร) · สกิลผสมปิด
  if (skill.jobs) {                                              // เคล็ดวิชาผสม: ต้องมีจุดผสม + ลงสองกิ่งอย่างละ 3 แต้มขึ้นไป
    const bp = branchPoints(owned), lo = Math.min(...skill.jobs.map((j) => bp[j] || 0));
    return owned.includes(skill.node) && lo >= 3 ? Math.min(MAX_SKILL_LV, SUB_CAP + Math.floor((lo - 3) / 2) + 1) : 0;
  }
  if (skill.ultimate) return owned.includes(KEYSTONE[skill.job]) ? MAX_SKILL_LV : 0;
  return Math.min(MAX_SKILL_LV, SUB_CAP + Math.floor(branchPoints(owned)[skill.job] / 2));
}

/** ตรวจว่าอัปสกิลได้ไหม → { ok, reason } */
export function canLearn(char, skillId) {
  const s = SKILL_BY_ID[skillId];
  if (!s) return { ok: false, reason: 'ไม่มีสกิลนี้' };
  const cur = char.skills?.[skillId] || 0;
  const cap = skillCap(char, s);
  if (cur >= MAX_SKILL_LV) return { ok: false, reason: 'เลเวลสูงสุดแล้ว' };
  if (cap === 0 && s.jobs && !PASSIVES_ON) return { ok: false, reason: 'ปิดใช้งานชั่วคราว' };
  if (cap === 0 && s.jobs) return { ok: false, reason: `ต้องลงจุดผสม “${PASSIVES[s.node]?.nameTh}” + ${s.jobs.map((j) => BRANCHES[j].nameTh).join(' และ ')} อย่างละ 3 แต้ม` };
  if (cap === 0) return { ok: false, reason: `★ ต้องมีคีย์สโตน “${PASSIVES[KEYSTONE[s.job]].nameTh}”` };
  if (cur >= cap && s.jobs) return { ok: false, reason: `ลงแต้มทั้งสองกิ่งเพิ่มเพื่อปลดเลเวลถัดไป` };
  if (cur >= cap) {
    const need = (cur + 1 - SUB_CAP) * 2 - branchPoints(char.passives || [])[s.job];
    return { ok: false, reason: `ลงแต้ม${BRANCHES[s.job].nameTh}อีก ${need} แต้ม` };
  }
  if ((char.sp || 0) < 1) return { ok: false, reason: 'SP ไม่พอ' };
  const need = reqCharLevel(s, cur + 1);
  if (char.level < need) return { ok: false, reason: `ต้องการ Lv.${need}` };
  return { ok: true };
}
