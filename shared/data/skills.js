// ============================================================
//  สกิล QWER – อาชีพละ 4 สกิล
//  type:
//   melee      – ฟัน/ต่อยด้านหน้า (range, hits = จำนวนครั้ง, all = โดนทุกตัว)
//   projectile – ยิงกระสุน (count, spread, pierce)
//   dash       – พุ่งไปข้างหน้าแล้วโจมตีทุกตัวตามทาง (distance)
//   aoe        – โจมตีเป็นวงรอบจุดด้านหน้า (radius, offset, hits)
//   strike     – ฟ้าผ่าใส่ศัตรูที่ใกล้ที่สุดในระยะ
//   buff       – เพิ่มสถานะชั่วคราว (buff: {atkMul, critAdd, def}, duration ms) + heal (สัดส่วน HP)
//  unlock: เลเวลที่ปลดล็อก
// ============================================================
export const SKILL_KEYS = ['Q', 'W', 'E', 'R'];

export const SKILLS = {
  swordman: [
    { key: 'Q', nameTh: 'ฟันสะบั้น', icon: '🗡️', unlock: 1, mp: 5, cd: 3000, type: 'melee', kind: 'physical', mult: 1.8, range: 42, all: true, sfx: 'slash', desc: 'ฟันกว้างโดนศัตรูทุกตัวด้านหน้า x1.8' },
    { key: 'W', nameTh: 'พุ่งทะลวง', icon: '💨', unlock: 2, mp: 8, cd: 6000, type: 'dash', kind: 'physical', mult: 1.5, distance: 90, sfx: 'dash', desc: 'พุ่งไปข้างหน้า 90 หน่วย ฟันทุกตัวตามทาง x1.5 (อมตะระหว่างพุ่ง)' },
    { key: 'E', nameTh: 'ดาบวายุ', icon: '🌪️', unlock: 4, mp: 10, cd: 5000, type: 'projectile', kind: 'physical', mult: 1.4, range: 220, speed: 260, proj: 'wave', pierce: true, sfx: 'wind', desc: 'ปล่อยคลื่นดาบทะลุศัตรู x1.4' },
    { key: 'R', nameTh: 'พายุดาบพันเล่ม', icon: '⚔️', unlock: 6, mp: 25, cd: 18000, type: 'aoe', kind: 'physical', mult: 1.2, radius: 60, offset: 0, hits: 4, interval: 180, sfx: 'storm', desc: 'หมุนดาบรอบตัว 4 ครั้ง ครั้งละ x1.2' },
  ],
  mage: [
    { key: 'Q', nameTh: 'ลูกไฟสามลูก', icon: '🔥', unlock: 1, mp: 8, cd: 3000, type: 'projectile', kind: 'magic', mult: 1.1, range: 220, speed: 230, proj: 'fireball', count: 3, spread: 14, sfx: 'fireball', desc: 'ยิงลูกไฟ 3 ลูกกระจาย ลูกละ x1.1' },
    { key: 'W', nameTh: 'อัสนีบาต', icon: '⚡', unlock: 2, mp: 12, cd: 5000, type: 'strike', kind: 'magic', mult: 2.2, range: 240, sfx: 'thunder', desc: 'ฟ้าผ่าศัตรูที่ใกล้ที่สุด x2.2' },
    { key: 'E', nameTh: 'เกราะยันต์', icon: '🛡️', unlock: 4, mp: 15, cd: 15000, type: 'buff', buff: { def: 20 }, duration: 8000, heal: 0.2, sfx: 'buff', desc: 'ฟื้น HP 20% และป้องกัน +20 นาน 8 วินาที' },
    { key: 'R', nameTh: 'ฝนดาวตก', icon: '☄️', unlock: 6, mp: 35, cd: 20000, type: 'aoe', kind: 'magic', mult: 2.4, radius: 110, offset: 110, hits: 3, interval: 260, fx: 'meteor', sfx: 'meteor', desc: 'อุกกาบาตถล่มด้านหน้า 3 ระลอก ครั้งละ x2.4' },
  ],
  archer: [
    { key: 'Q', nameTh: 'ยิงสองดอก', icon: '🏹', unlock: 1, mp: 4, cd: 2500, type: 'projectile', kind: 'physical', mult: 0.95, range: 260, speed: 380, proj: 'arrow', count: 2, spread: 6, sfx: 'arrow', desc: 'ยิงลูกธนู 2 ดอกพร้อมกัน ดอกละ x0.95' },
    { key: 'W', nameTh: 'ศรทะลวง', icon: '🎯', unlock: 2, mp: 8, cd: 5000, type: 'projectile', kind: 'physical', mult: 1.9, range: 320, speed: 520, proj: 'arrow_big', pierce: true, sfx: 'arrowBig', desc: 'ศรพลังสูงทะลุศัตรูทุกตัว x1.9' },
    { key: 'E', nameTh: 'ฝนธนู', icon: '🌧️', unlock: 4, mp: 14, cd: 8000, type: 'aoe', kind: 'physical', mult: 1.2, radius: 70, offset: 100, hits: 3, interval: 220, fx: 'arrowRain', sfx: 'arrowRain', desc: 'ธนูตกเป็นห่าฝนด้านหน้า 3 ระลอก x1.2' },
    { key: 'R', nameTh: 'ตาเหยี่ยว', icon: '🦅', unlock: 6, mp: 15, cd: 20000, type: 'buff', buff: { atkMul: 0.3, critAdd: 0.3 }, duration: 10000, heal: 0, sfx: 'buff', desc: 'พลังโจมตี +30% และคริติคอล +30% นาน 10 วินาที' },
  ],
  boxer: [
    { key: 'Q', nameTh: 'หมัดชุด', icon: '👊', unlock: 1, mp: 3, cd: 2500, type: 'melee', kind: 'physical', mult: 0.7, range: 26, hits: 3, interval: 110, sfx: 'punch', desc: 'ต่อยรัว 3 หมัด หมัดละ x0.7' },
    { key: 'W', nameTh: 'เตะก้านคอ', icon: '🦵', unlock: 2, mp: 6, cd: 5000, type: 'melee', kind: 'physical', mult: 2.0, range: 34, knock: 220, sfx: 'kick', desc: 'เตะแรง x2.0 กระเด็นไกล' },
    { key: 'E', nameTh: 'เข่าลอย', icon: '🦿', unlock: 4, mp: 10, cd: 7000, type: 'dash', kind: 'physical', mult: 2.2, distance: 75, leap: true, sfx: 'dash', desc: 'กระโดดเข่าพุ่งไปข้างหน้า x2.2' },
    { key: 'R', nameTh: 'ไหว้ครูรำมวย', icon: '🙏', unlock: 6, mp: 15, cd: 25000, type: 'buff', buff: { atkMul: 0.4 }, duration: 12000, heal: 0.3, sfx: 'buff', desc: 'ฟื้น HP 30% และพลังโจมตี +40% นาน 12 วินาที' },
  ],
};
