// ============================================================
//  ระบบสกิล 20 แบบ (4 อาชีพ × 5 สกิล) + Skill Tree
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
//  effect (ติดกับศัตรูที่โดน):
//   stun   { ms }              ศัตรูขยับ/โจมตีไม่ได้
//   poison { ticks, every, ratio } ดาเมจต่อเนื่อง ratio × ดาเมจครั้งแรก ต่อ tick
// ============================================================
export const SKILL_SLOTS = ['Q', 'W', 'E', 'R', 'T'];
export const MAX_SKILL_LV = 5;
export const SP_PER_LEVEL = 1;
export const START_SP = 1;

export const SKILLS = {
  // ---------------- จอมขมังเวทย์ ----------------
  mage: [
    { id: 'mage_akom', nameTh: 'คาถาอาคม', icon: '📿', reqLv: 1, type: 'projectile', kind: 'magic',
      mp: 6, cd: 1800, mult: 1.3, proj: 'fireball', speed: 260, range: 240, count: 2, spread: 10, sfx: 'fireball',
      desc: 'ยิงลูกไฟอาคม 2 ลูก' },
    { id: 'mage_yant', nameTh: 'ยันต์ตรึงวิญญาณ', icon: '📜', reqLv: 2, type: 'projectile', kind: 'magic',
      mp: 10, cd: 6000, mult: 0.9, proj: 'yant', speed: 220, range: 220, pierce: true, effect: { stun: { ms: 1800 } }, sfx: 'buff',
      desc: 'ยันต์ทะลุทุกตัว ตรึงศัตรูนิ่ง 1.8 วิ' },
    { id: 'mage_shield', nameTh: 'เกราะยันต์เก้ายอด', icon: '🛡️', reqLv: 4, type: 'buff',
      mp: 15, cd: 16000, buff: { def: 20 }, duration: 8000, heal: 0.2, sfx: 'buff',
      desc: 'ฟื้น HP 20% ป้องกัน +20 นาน 8 วิ' },
    { id: 'mage_thunder', nameTh: 'อัสนีบาต', icon: '⚡', reqLv: 6, type: 'strike', kind: 'magic',
      mp: 14, cd: 5000, mult: 2.4, range: 260, effect: { stun: { ms: 600 } }, sfx: 'thunder',
      desc: 'ฟ้าผ่าศัตรูที่ใกล้ที่สุด สะดุ้งชั่วครู่' },
    { id: 'mage_kalp', nameTh: 'เพลิงกัลป์ปราบผี', icon: '☄️', reqLv: 8, type: 'aoe', kind: 'magic', ultimate: true,
      mp: 35, cd: 22000, mult: 2.2, radius: 110, offset: 110, hits: 4, interval: 240, fx: 'meteor', sfx: 'meteor',
      desc: 'ไฟกัลป์ถล่มด้านหน้า 4 ระลอก' },
  ],
  // ---------------- นักมวยคาดเชือก ----------------
  boxer: [
    { id: 'boxer_jab', nameTh: 'หมัดแย็บ', icon: '👊', reqLv: 1, type: 'melee', kind: 'physical',
      mp: 3, cd: 2000, mult: 0.7, range: 26, hits: 3, interval: 110, sfx: 'punch',
      desc: 'แย็บรัว 3 หมัด' },
    { id: 'boxer_kick', nameTh: 'เตะก้านคอ', icon: '🦵', reqLv: 2, type: 'melee', kind: 'physical',
      mp: 6, cd: 4500, mult: 2.0, range: 34, knock: 240, effect: { stun: { ms: 700 } }, sfx: 'kick',
      desc: 'เตะแรง กระเด็นและมึนงง' },
    { id: 'boxer_croc', nameTh: 'จระเข้ฟาดหาง', icon: '🐊', reqLv: 4, type: 'aoe', kind: 'physical',
      mp: 10, cd: 7000, mult: 1.6, radius: 48, offset: 0, hits: 2, interval: 160, sfx: 'kick',
      desc: 'หมุนตัวเตะกลับหลัง โดนทุกตัวรอบตัว 2 ครั้ง' },
    { id: 'boxer_waikru', nameTh: 'ไหว้ครูรำมวย', icon: '🙏', reqLv: 6, type: 'buff',
      mp: 15, cd: 22000, buff: { atkMul: 0.4 }, duration: 12000, heal: 0.3, sfx: 'buff',
      desc: 'ฟื้น HP 30% พลังโจมตี +40% นาน 12 วิ' },
    { id: 'boxer_ngouy', nameTh: 'หักงวงไอยรา', icon: '🐘', reqLv: 8, type: 'dash', kind: 'physical', ultimate: true,
      mp: 25, cd: 18000, mult: 4.0, distance: 80, leap: true, effect: { stun: { ms: 1500 } }, sfx: 'dash',
      desc: 'กระโดดทุ่มศอกลงกลางหัว แรงมาก + มึนงง' },
  ],
  // ---------------- ขุนศึก (ดาบคู่) ----------------
  swordman: [
    { id: 'sword_twin', nameTh: 'ฟันดาบคู่', icon: '⚔️', reqLv: 1, type: 'melee', kind: 'physical',
      mp: 5, cd: 2500, mult: 1.0, range: 42, hits: 2, interval: 140, all: true, sfx: 'slash',
      desc: 'ฟันไขว้ 2 ครั้ง โดนทุกตัวด้านหน้า' },
    { id: 'sword_thrust', nameTh: 'แทงทะลวง', icon: '🗡️', reqLv: 2, type: 'dash', kind: 'physical',
      mp: 8, cd: 6000, mult: 1.7, distance: 95, sfx: 'dash',
      desc: 'พุ่งแทงทะลุแนวศัตรู (อมตะระหว่างพุ่ง)' },
    { id: 'sword_wind', nameTh: 'ดาบวายุ', icon: '🌪️', reqLv: 4, type: 'projectile', kind: 'physical',
      mp: 10, cd: 5000, mult: 1.5, proj: 'wave', speed: 270, range: 230, pierce: true, sfx: 'wind',
      desc: 'คลื่นดาบทะลุทุกตัว' },
    { id: 'sword_guard', nameTh: 'ตั้งการ์ดดาบคู่', icon: '🛡️', reqLv: 6, type: 'buff',
      mp: 12, cd: 18000, buff: { def: 25, atkMul: 0.15 }, duration: 10000, heal: 0.1, sfx: 'buff',
      desc: 'ป้องกัน +25 โจมตี +15% นาน 10 วิ' },
    { id: 'sword_pikat', nameTh: 'เพลงดาบพิฆาต', icon: '🔥', reqLv: 8, type: 'aoe', kind: 'physical', ultimate: true,
      mp: 28, cd: 20000, mult: 1.3, radius: 62, offset: 10, hits: 6, interval: 150, sfx: 'storm',
      desc: 'ร่ายเพลงดาบรอบตัว 6 ครั้ง' },
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
  ],
};

/** ค้นหาสกิลด้วย id */
export const SKILL_BY_ID = Object.fromEntries(
  Object.entries(SKILLS).flatMap(([job, list]) => list.map((s) => [s.id, { ...s, job }])));

/** ค่าจริงของสกิลตามเลเวล (1–5) */
export function skillStats(skill, lv = 1) {
  const L = Math.max(1, Math.min(MAX_SKILL_LV, lv)) - 1;
  return {
    ...skill,
    lv: L + 1,
    mult: skill.mult ? +(skill.mult * (1 + 0.15 * L)).toFixed(3) : undefined,
    mp: Math.round(skill.mp * (1 + 0.1 * L)),
    cd: Math.round(skill.cd * (1 - 0.04 * L)),
    duration: skill.duration ? Math.round(skill.duration * (1 + 0.1 * L)) : undefined,
    heal: skill.heal ? +(skill.heal * (1 + 0.1 * L)).toFixed(3) : skill.heal,
  };
}

/** เลเวลตัวละครขั้นต่ำเพื่ออัปสกิลไปเลเวล nextLv (ทุกเลเวลสกิลเพิ่มขึ้นต้องเลเวลตัวละคร +2) */
export function reqCharLevel(skill, nextLv) {
  return skill.reqLv + (nextLv - 1) * 2;
}

/** ตรวจว่าอัปสกิลได้ไหม → { ok, reason } */
export function canLearn(char, skillId) {
  const s = SKILL_BY_ID[skillId];
  if (!s || s.job !== char.appearance.job) return { ok: false, reason: 'ไม่ใช่สกิลของอาชีพนี้' };
  const cur = char.skills?.[skillId] || 0;
  if (cur >= MAX_SKILL_LV) return { ok: false, reason: 'เลเวลสูงสุดแล้ว' };
  if ((char.sp || 0) < 1) return { ok: false, reason: 'SP ไม่พอ' };
  const need = reqCharLevel(s, cur + 1);
  if (char.level < need) return { ok: false, reason: `ต้องการ Lv.${need}` };
  return { ok: true };
}
