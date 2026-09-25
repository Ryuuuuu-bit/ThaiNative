// ============================================================
//  เรดบอส – พญายักษ์ทมิฬ (ใช้ร่วม client + server)
//  server เป็นผู้คุม HP / AI / ท่าโจมตี  → ทุกคนตีบอสตัวเดียวกัน
// ============================================================
import { WORLD } from '../constants.js';

export const RAID_BOSS = {
  id: 'phaya_yak',
  nameTh: 'พญายักษ์ทมิฬ',
  level: 15,
  maxHp: 24000,            // + 6000 ต่อผู้เล่นในลานที่เกิน 1 คน (ปรับตอนเกิด)
  hpPerExtraPlayer: 6000,
  def: 18,
  eva: 4,
  speed: 38,
  spawnX: WORLD.arenaX + 420,
  arena: [WORLD.arenaX, WORLD.width],
  respawnMs: 120000,       // เกิดใหม่หลังตาย 2 นาที
  enrageAt: 0.3,           // HP ต่ำกว่า 30% → เร็วขึ้น
  // ท่าโจมตี: windup = เวลาเตือน (ms) ก่อนดาเมจลง
  attacks: {
    slam:  { nameTh: 'กระบองทุบธรณี', windup: 900,  range: 80,  dmg: 70, cd: 2600 },  // หน้าบอส
    wave:  { nameTh: 'คลื่นแผ่นดินแยก', windup: 800, range: 420, dmg: 50, cd: 4200, speed: 220 }, // คลื่นวิ่งทั้งสองทาง กระโดดหลบได้
    roar:  { nameTh: 'คำรามอสูร',      windup: 1300, range: 260, dmg: 35, cd: 9000 },   // รอบตัว + ติดมึนงง
    rain:  { nameTh: 'ห่าไฟนรก',       windup: 1100, range: 0,   dmg: 55, cd: 7000, count: 5 }, // ลูกไฟตกเป็นจุด
  },
  rewards: { exp: 1200, gold: 600, items: [['hp_m', 3], ['mp_m', 2], ['yak_fang', 1]], rare: [['acc_yant_gold', 0.2]] },
  maxHitPerLevel: 90,      // ดาเมจต่อครั้งสูงสุดที่ server ยอมรับ = 400 + lv*90 (กันโกง)
};
