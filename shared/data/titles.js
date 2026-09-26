// ============================================================
//  ฉายา (Title) – ได้จากความสำเร็จ แสดงเหนือชื่อตัวละคร (ทุกคนเห็น)
//  server ตรวจเงื่อนไขจากสถิติในเซฟ (c.rec) แล้วปลดล็อกให้เอง
// ============================================================
import { QUESTS } from './village.js';

/** rec: kills · boss (เรด) · raidTop · rboss (บอสภาค) · dungeon · fish · buek · herb · craft · enhMax · deaths */
export const TITLES = [
  { id: 'rookie',     nameTh: 'ผู้กล้าหน้าใหม่',    color: '#d5dbdb', hint: 'ได้ตั้งแต่เริ่มเกม',                     ok: () => true },
  { id: 'lv10',       nameTh: 'ผู้เลือกทาง',         color: '#aed6f1', hint: 'ถึง Lv.10',                                ok: (c) => c.level >= 10 },
  { id: 'lv20',       nameTh: 'ยอดฝีมือบางผี',       color: '#85c1e9', hint: 'ถึง Lv.20',                                ok: (c) => c.level >= 20 },
  { id: 'lv30',       nameTh: 'ตำนานแห่งบางผี',      color: '#f7dc6f', hint: 'ถึง Lv.30 (เลเวลตัน)',                     ok: (c) => c.level >= 30 },
  { id: 'hunt100',    nameTh: 'นักล่าผี',            color: '#f5b7b1', hint: 'ปราบผี 100 ตัว',                           ok: (c, r) => (r.kills || 0) >= 100 },
  { id: 'hunt1000',   nameTh: 'มือปราบผี',           color: '#f1948a', hint: 'ปราบผี 1,000 ตัว',                         ok: (c, r) => (r.kills || 0) >= 1000 },
  { id: 'hunt5000',   nameTh: 'เทพผู้พิชิตผี',       color: '#ec7063', hint: 'ปราบผี 5,000 ตัว',                         ok: (c, r) => (r.kills || 0) >= 5000 },
  { id: 'fisher',     nameTh: 'เซียนเบ็ดท่าน้ำ',      color: '#85c1e9', hint: 'ตกปลาได้ 100 ตัว',                         ok: (c, r) => (r.fish || 0) >= 100 },
  { id: 'buek',       nameTh: 'ผู้พิชิตปลาบึก',       color: '#5dade2', hint: 'ตกปลาบึกยักษ์ได้',                         ok: (c, r) => (r.buek || 0) >= 1 },
  { id: 'herbal',     nameTh: 'หมอยาป่า',            color: '#82e0aa', hint: 'เก็บสมุนไพร 100 ครั้ง',                     ok: (c, r) => (r.herb || 0) >= 100 },
  { id: 'crafter',    nameTh: 'ช่างฝีมือบางผี',       color: '#f0b27a', hint: 'หลอม/ปรุง/ทำอาหาร 50 ครั้ง',                ok: (c, r) => (r.craft || 0) >= 50 },
  { id: 'smith10',    nameTh: 'มือตีเหล็กกล้า',       color: '#bb8fce', hint: 'ตีบวกอุปกรณ์ถึง +10',                       ok: (c, r) => (r.enhMax || 0) >= 10 },
  { id: 'smith15',    nameTh: 'ช่างตีมือทอง',         color: '#f4d03f', hint: 'ตีบวกอุปกรณ์ถึง +15',                       ok: (c, r) => (r.enhMax || 0) >= 15 },
  { id: 'smith20',    nameTh: 'ตำนานเตาหลอม',         color: '#ff9ff3', hint: 'ตีบวกอุปกรณ์ถึง +20',                       ok: (c, r) => (r.enhMax || 0) >= 20 },
  { id: 'yak',        nameTh: 'ผู้ปราบพญายักษ์',      color: '#e74c3c', hint: 'ร่วมพิชิตพญายักษ์ทมิฬ',                     ok: (c, r) => (r.boss || 0) >= 1 },
  { id: 'raidtop',    nameTh: 'แชมป์ลานพญายักษ์',     color: '#ff6b6b', hint: 'ทำดาเมจอันดับ 1 ในเรดบอส',                  ok: (c, r) => (r.raidTop || 0) >= 1 },
  { id: 'rboss',      nameTh: 'ผู้พิชิตเจ้าถิ่น',      color: '#f39c12', hint: 'ร่วมปราบบอสประจำภาค 1 ตัว',                 ok: (c, r) => (r.rboss || 0) >= 1 },
  { id: 'rboss5',     nameTh: 'ผู้ครองห้าภาค',        color: '#e67e22', hint: 'ปราบบอสประจำภาคครบ 5 ภาค',                   ok: (c, r) => Object.keys(r.rbossR || {}).length >= 5 },
  { id: 'dungeon',    nameTh: 'นักบุกสุสานใต้ดิน',     color: '#a569bd', hint: 'ผ่านดันเจี้ยนปาร์ตี้ 1 ครั้ง',                ok: (c, r) => (r.dungeon || 0) >= 1 },
  { id: 'dungeon10',  nameTh: 'เจ้าแห่งสุสานใต้ดิน',   color: '#8e44ad', hint: 'ผ่านดันเจี้ยนปาร์ตี้ 10 ครั้ง',               ok: (c, r) => (r.dungeon || 0) >= 10 },
  { id: 'hell',       nameTh: 'ผู้รอดจากนรก',         color: '#c0392b', hint: 'ผ่านดันเจี้ยนระดับนรก',                     ok: (c, r) => (r.dungeonHell || 0) >= 1 },
  { id: 'rich',       nameTh: 'เศรษฐีบางผี',          color: '#f7dc6f', hint: 'มีเงินติดตัว ฿1,000,000',                   ok: (c) => (c.gold || 0) >= 1_000_000 },
  { id: 'elder',      nameTh: 'ลูกรักผู้ใหญ่ชัย',       color: '#f8c471', hint: 'ทำเควสผู้ใหญ่ชัยครบทุกเควส',                  ok: (c) => QUESTS.every((q) => c.quests?.done?.includes(q.id)) },
  { id: 'social',     nameTh: 'เพื่อนเยอะ',            color: '#76d7c4', hint: 'มีเพื่อนในรายชื่อ 5 คน',                     ok: (c) => (c.friends || []).length >= 5 },
];
export const TITLE_BY_ID = Object.fromEntries(TITLES.map((t) => [t.id, t]));

/** ตรวจฉายาใหม่ที่ปลดล็อก → คืนรายการ id ที่เพิ่งได้ */
export function checkTitles(c) {
  c.titles ||= [];
  const r = c.rec || {}, got = [];
  for (const t of TITLES) if (!c.titles.includes(t.id) && t.ok(c, r)) { c.titles.push(t.id); got.push(t.id); }
  return got;
}
