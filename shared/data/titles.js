// ============================================================
//  ฉายา (Title) – ได้จากความสำเร็จ แสดงเหนือชื่อตัวละคร (ทุกคนเห็น)
//  server ตรวจเงื่อนไขจากสถิติในเซฟ (c.rec) แล้วปลดล็อกให้เอง
// ============================================================
import { QUESTS } from './village.js';

/** rec.tdBoss: { monId: จำนวน } = บอสประจำโซนที่ร่วมปราบในโลก top-down */
const tb = (r) => r.tdBoss || {};
const AYT_BOSS = ['mae_nak', 'pu_som', 'pret_asura', 'chalawan'], ALL_BOSS = [...AYT_BOSS, 'kumphakan', 'anantanak', 'phaya_yom'];
/** rec: kills · boss (เรด) · raidTop · rboss (บอสภาค) · dungeon · fish · buek · herb · craft · enhMax · deaths */
export const TITLES = [
  { id: 'rookie',     nameTh: 'ผู้กล้าหน้าใหม่',    color: '#d5dbdb', hint: 'ได้ตั้งแต่เริ่มเกม',                     ok: () => true },
  { id: 'lv10',       nameTh: 'ผู้เลือกทาง',         color: '#aed6f1', hint: 'ถึง Lv.10',                                ok: (c) => c.level >= 10 },
  { id: 'lv20',       nameTh: 'ยอดฝีมือกรุงศรี',       color: '#85c1e9', hint: 'ถึง Lv.20',                                ok: (c) => c.level >= 20 },
  { id: 'lv30',       nameTh: 'ตำนานแห่งกรุงศรี',      color: '#f7dc6f', hint: 'ถึง Lv.30',                                ok: (c) => c.level >= 30 },
  { id: 'lv50',       nameTh: 'ผู้พิชิตหิมพานต์',      color: '#82e0aa', hint: 'ถึง Lv.50',                                ok: (c) => c.level >= 50 },
  { id: 'lv75',       nameTh: 'สหายพญานาค',          color: '#5dade2', hint: 'ถึง Lv.75',                                ok: (c) => c.level >= 75 },
  { id: 'lv99',       nameTh: 'ผู้อยู่เหนือยมโลก',      color: '#ff9ff3', hint: 'ถึง Lv.99 (เลเวลตัน)',                     ok: (c) => c.level >= 99 },
  { id: 'realm3',     nameTh: 'ผู้ท่องสามภพ',          color: '#f5b041', hint: 'ไปถึงนรกภูมิ',                               ok: (c) => (c.tdMaps || []).includes('naraka') },
  { id: 'hunt100',    nameTh: 'นักล่าผี',            color: '#f5b7b1', hint: 'ปราบผี 100 ตัว',                           ok: (c, r) => (r.kills || 0) >= 100 },
  { id: 'hunt1000',   nameTh: 'มือปราบผี',           color: '#f1948a', hint: 'ปราบผี 1,000 ตัว',                         ok: (c, r) => (r.kills || 0) >= 1000 },
  { id: 'hunt5000',   nameTh: 'เทพผู้พิชิตผี',       color: '#ec7063', hint: 'ปราบผี 5,000 ตัว',                         ok: (c, r) => (r.kills || 0) >= 5000 },
  { id: 'fisher',     nameTh: 'เซียนเบ็ดท่าน้ำ',      color: '#85c1e9', hint: 'ตกปลาได้ 100 ตัว',                         ok: (c, r) => (r.fish || 0) >= 100 },
  { id: 'buek',       nameTh: 'ผู้พิชิตปลาบึก',       color: '#5dade2', hint: 'ตกปลาบึกยักษ์ได้',                         ok: (c, r) => (r.buek || 0) >= 1 },
  { id: 'herbal',     nameTh: 'หมอยาป่า',            color: '#82e0aa', hint: 'เก็บสมุนไพร 100 ครั้ง',                     ok: (c, r) => (r.herb || 0) >= 100 },
  { id: 'crafter',    nameTh: 'ช่างฝีมือกรุงศรี',       color: '#f0b27a', hint: 'หลอม/ปรุง/ทำอาหาร 50 ครั้ง',                ok: (c, r) => (r.craft || 0) >= 50 },
  { id: 'smith10',    nameTh: 'มือตีเหล็กกล้า',       color: '#bb8fce', hint: 'ตีบวกอุปกรณ์ถึง +10',                       ok: (c, r) => (r.enhMax || 0) >= 10 },
  { id: 'smith15',    nameTh: 'ช่างตีมือทอง',         color: '#f4d03f', hint: 'ตีบวกอุปกรณ์ถึง +15',                       ok: (c, r) => (r.enhMax || 0) >= 15 },
  { id: 'smith20',    nameTh: 'ตำนานเตาหลอม',         color: '#ff9ff3', hint: 'ตีบวกอุปกรณ์ถึง +20',                       ok: (c, r) => (r.enhMax || 0) >= 20 },
  { id: 'yak',        nameTh: 'ผู้ปราบพญาจระเข้',      color: '#e74c3c', hint: 'ร่วมปราบพญาชาละวัน (บึงผีพราย)',               ok: (c, r) => (tb(r).chalawan || 0) >= 1 },
  { id: 'raidtop',    nameTh: 'ผู้สยบยมโลก',          color: '#ff6b6b', hint: 'ร่วมปราบพญายมราช (นรกภูมิ)',                   ok: (c, r) => (tb(r).phaya_yom || 0) >= 1 },
  { id: 'rboss',      nameTh: 'ผู้พิชิตเจ้าถิ่น',      color: '#f39c12', hint: 'ร่วมปราบบอสประจำโซน 1 ตัว',                 ok: (c, r) => Object.keys(tb(r)).length >= 1 || (r.rboss || 0) >= 1 },
  { id: 'rboss5',     nameTh: 'ผู้ปราบผีใหญ่กรุงศรี',   color: '#e67e22', hint: 'ปราบบอสกรุงศรีฯ ครบ 4 ตัว (แม่นาค·ปู่โสม·เปรตอสุรกาย·ชาละวัน)', ok: (c, r) => AYT_BOSS.every((b) => tb(r)[b]) },
  { id: 'dungeon',    nameTh: 'ผู้พิชิตกุมภกรรณ',      color: '#a569bd', hint: 'ร่วมปราบกุมภกรรณ (ป่าหิมพานต์)',              ok: (c, r) => (tb(r).kumphakan || 0) >= 1 },
  { id: 'dungeon10',  nameTh: 'สหายนาคราช',          color: '#8e44ad', hint: 'ร่วมปราบพญาอนันตนาคราช (เมืองบาดาล)',          ok: (c, r) => (tb(r).anantanak || 0) >= 1 },
  { id: 'hell',       nameTh: 'เจ้าแห่งเจ็ดบอส',       color: '#c0392b', hint: 'ปราบบอสประจำโซนครบทั้ง 7 ตัว',               ok: (c, r) => ALL_BOSS.every((b) => tb(r)[b]) },
  { id: 'rich',       nameTh: 'เศรษฐีกรุงศรี',          color: '#f7dc6f', hint: 'มีเงินติดตัว ฿1,000,000',                   ok: (c) => (c.gold || 0) >= 1_000_000 },
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
