// ============================================================
//  ทักษะชีวิต (Life Skills) – เลเวลขึ้นจากการทำจริง ไม่ใช้แต้มสกิล
//  ▸ ตกปลา  : ตกปลาที่ริมคูเมือง/ท่าน้ำ          → โอกาสได้ปลา 2 ตัว
//  ▸ ครัว   : ทำอาหารกับป้าสา / ปรุงยากับยายติ๋ม    → โอกาสได้ของเพิ่ม 1 ชิ้น
//  ▸ เก็บเกี่ยว: เก็บสมุนไพร/รวงข้าวในทุ่งนา         → โอกาสได้เพิ่ม
//  ▸ ตีเหล็ก : หลอมของ/ตีบวกกับลุงดำ                → โอกาสตีบวกสำเร็จเพิ่ม
// ============================================================
export const LIFE = {
  fish:   { nameTh: 'ตกปลา', icon: '🎣', how: 'ยืนริมคูเมือง/แม่น้ำ แล้วกด F (มือถือ: ปุ่ม 🎣)', perk: (lv) => `โอกาสได้ปลา 2 ตัว ${lv * 2}%` },
  cook:   { nameTh: 'ครัว & ปรุงยา', icon: '🍲', how: 'ทำอาหารกับป้าสา · ปรุงยากับยายติ๋ม', perk: (lv) => `โอกาสได้ของเพิ่ม ${lv * 2}%` },
  gather: { nameTh: 'เก็บเกี่ยว', icon: '🌾', how: 'เก็บสมุนไพร/รวงข้าวที่ขึ้นในทุ่งนานอกเมือง (กด F ใกล้ ๆ)', perk: (lv) => `โอกาสได้เพิ่ม ${lv * 2}%` },
  smith:  { nameTh: 'ตีเหล็ก', icon: '🔨', how: 'สร้างอาวุธ/ชุด และตีบวกกับลุงดำ', perk: (lv) => `โอกาสตีบวกสำเร็จ +${(lv * 0.3).toFixed(1)}%` },
};
export const LIFE_IDS = Object.keys(LIFE);
export const LIFE_MAX = 20;
/** EXP ที่ต้องใช้จาก lv → lv+1 */
export const lifeNeed = (lv) => Math.round(8 * Math.pow(lv, 1.45));
/** เลเวล/ความคืบหน้าจาก exp สะสม */
export function lifeLevel(xp = 0) {
  let lv = 1, rest = Math.max(0, xp | 0);
  while (lv < LIFE_MAX && rest >= lifeNeed(lv)) { rest -= lifeNeed(lv); lv++; }
  return { lv, cur: rest, need: lv >= LIFE_MAX ? 0 : lifeNeed(lv) };
}

// ------------------------------------------------------------
//  ความชำนาญอาวุธ (Weapon Mastery): ฆ่าผีด้วยอาวุธแบบไหน ความชำนาญแบบนั้นขึ้น
//  ▸ ทุกเลเวล = โจมตีด้วยอาวุธนั้น +1% (สูงสุด Lv.20)
// ------------------------------------------------------------
export const MASTERY_MAX = 20;
export const masteryNeed = (lv) => 10 + lv * 6;
export function masteryLevel(xp = 0) {
  let lv = 0, rest = Math.max(0, xp | 0);
  while (lv < MASTERY_MAX && rest >= masteryNeed(lv)) { rest -= masteryNeed(lv); lv++; }
  return { lv, cur: rest, need: lv >= MASTERY_MAX ? 0 : masteryNeed(lv) };
}
