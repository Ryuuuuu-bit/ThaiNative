// ============================================================
//  ฉายา (Title) – ได้จากความสำเร็จ แสดงเหนือชื่อตัวละคร (ทุกคนเห็น)
//  server ตรวจเงื่อนไขจากสถิติในเซฟ (c.rec) แล้วปลดล็อกให้เอง
// ============================================================
import { QUESTS } from './village.js';
import { combatPower } from '../character.js';

/** หมวดฉายา (เรียงตามนี้ในหน้าเลือกฉายา) */
export const TITLE_CATS = [['lv', 'เลเวล'], ['cp', 'ค่าพลังรวม'], ['rank', 'อันดับเซิร์ฟ'], ['boss', 'ปราบบอส'], ['explore', 'สำรวจ'], ['hunt', 'ล่าผี'], ['smith', 'ตีบวก'], ['support', 'สายซัพพอร์ต'], ['life', 'อาชีพเสริม'], ['misc', 'อื่น ๆ']];
/** ค่าพลังรวมของตัวละคร (แคชตามรอบตรวจ) */
const cpOf = (c) => { try { return combatPower(c); } catch { return 0; } };

/** rec.tdBoss: { monId: จำนวน } = บอสประจำโซนที่ร่วมปราบในโลก top-down */
const tb = (r) => r.tdBoss || {};
const AYT_BOSS = ['mae_nak', 'pu_som', 'pret_asura', 'chalawan'], ALL_BOSS = [...AYT_BOSS, 'kumphakan', 'anantanak', 'phaya_yom'], ALL9 = [...ALL_BOSS, 'phra_rahu', 'phaya_mara'];
/** rec: kills · boss (เรด) · raidTop · rboss (บอสภาค) · dungeon · fish · buek · herb · craft · enhMax · deaths */
export const TITLES = [
  { id: 'rookie', cat: 'lv',     nameTh: 'ผู้กล้าหน้าใหม่',    color: '#d5dbdb', hint: 'ได้ตั้งแต่เริ่มเกม',                     ok: () => true },
  { id: 'lv10', cat: 'lv',       nameTh: 'ผู้เลือกทาง',         color: '#aed6f1', hint: 'ถึง Lv.10',                                ok: (c) => c.level >= 10 },
  { id: 'lv20', cat: 'lv',       nameTh: 'ยอดฝีมือกรุงศรี',       color: '#85c1e9', hint: 'ถึง Lv.20',                                ok: (c) => c.level >= 20 },
  { id: 'lv30', cat: 'lv',       nameTh: 'ตำนานแห่งกรุงศรี',      color: '#f7dc6f', hint: 'ถึง Lv.30',                                ok: (c) => c.level >= 30 },
  { id: 'lv50', cat: 'lv',       nameTh: 'ผู้พิชิตหิมพานต์',      color: '#82e0aa', hint: 'ถึง Lv.50',                                ok: (c) => c.level >= 50 },
  { id: 'lv75', cat: 'lv',       nameTh: 'สหายพญานาค',          color: '#5dade2', hint: 'ถึง Lv.75',                                ok: (c) => c.level >= 75 },
  { id: 'lv99', cat: 'lv',       nameTh: 'ผู้อยู่เหนือยมโลก',      color: '#ff9ff3', hint: 'ถึง Lv.99',                               ok: (c) => c.level >= 99 },
  { id: 'lv125', cat: 'lv',      nameTh: 'ผู้ขึ้นสู่ดาวดึงส์',       color: '#f9e79f', hint: 'ถึง Lv.125',                              ok: (c) => c.level >= 125 },
  { id: 'lv150', cat: 'lv',      nameTh: 'ผู้พิชิตเขาพระสุเมรุ',     color: '#a9cce3', hint: 'ถึง Lv.150 (เลเวลตัน)',                    ok: (c) => c.level >= 150 },
  // ---- ค่าพลังรวม (CP) ----
  { id: 'cp1k',  cat: 'cp', nameTh: 'ผู้ตื่นพลัง',            color: '#d6eaf8', hint: 'ค่าพลังรวม 1,000',     ok: (c) => cpOf(c) >= 1000 },
  { id: 'cp5k',  cat: 'cp', nameTh: 'ผู้กล้าแกร่งกล้า',        color: '#aed6f1', hint: 'ค่าพลังรวม 5,000',     ok: (c) => cpOf(c) >= 5000 },
  { id: 'cp10k', cat: 'cp', nameTh: 'ขุนพลกรุงศรี',          color: '#82e0aa', hint: 'ค่าพลังรวม 10,000',    ok: (c) => cpOf(c) >= 10000 },
  { id: 'cp15k', cat: 'cp', nameTh: 'จอมพลังเหนือยมโลก',      color: '#f5b041', hint: 'ค่าพลังรวม 15,000',    ok: (c) => cpOf(c) >= 15000 },
  { id: 'cp20k', cat: 'cp', nameTh: 'ผู้ทรงฤทธิ์แห่งดาวดึงส์',   color: '#f7dc6f', hint: 'ค่าพลังรวม 20,000',    ok: (c) => cpOf(c) >= 20000 },
  { id: 'cp25k', cat: 'cp', nameTh: 'มหาบุรุษเขาพระสุเมรุ',     color: '#ff9ff3', hint: 'ค่าพลังรวม 25,000',    ok: (c) => cpOf(c) >= 25000 },
  // ---- อันดับเซิร์ฟ (เปลี่ยนมือได้ · ตรวจทุก 1 นาที) ----
  { id: 'cp_top1',  cat: 'rank', dynamic: true, nameTh: 'เจ้าแห่งพลังอันดับหนึ่ง', color: '#ffd700', hint: 'ค่าพลังรวมอันดับ 1 ของเซิร์ฟ (ถือครองอยู่เท่านั้น)',  ok: (c, r) => r.cpRank === 1 },
  { id: 'cp_top3',  cat: 'rank', dynamic: true, nameTh: 'สามยอดพลังแผ่นดิน',     color: '#f0e68c', hint: 'ค่าพลังรวมอันดับ 1–3 (ถือครองอยู่เท่านั้น)',    ok: (c, r) => r.cpRank >= 1 && r.cpRank <= 3 },
  { id: 'cp_top10', cat: 'rank', dynamic: true, nameTh: 'สิบยอดฝีมือ',          color: '#e5e8e8', hint: 'ค่าพลังรวมอันดับ 1–10 (ถือครองอยู่เท่านั้น)',   ok: (c, r) => r.cpRank >= 1 && r.cpRank <= 10 },
  { id: 'lv_top1',  cat: 'rank', dynamic: true, nameTh: 'ผู้นำแห่งเส้นทาง',       color: '#85c1e9', hint: 'เลเวลอันดับ 1 ของเซิร์ฟ (ถือครองอยู่เท่านั้น)',   ok: (c, r) => r.lvRank === 1 },
  { id: 'enh_top1', cat: 'rank', dynamic: true, nameTh: 'เทพเตาหลอม',          color: '#bb8fce', hint: 'ตีบวกอันดับ 1 ของเซิร์ฟ (ถือครองอยู่เท่านั้น)',   ok: (c, r) => r.enhRank === 1 },
  // ---- บอส ----
  { id: 'rboss', cat: 'boss',      nameTh: 'ผู้พิชิตเจ้าถิ่น',      color: '#f39c12', hint: 'ร่วมปราบบอสประจำโซน 1 ตัว',                 ok: (c, r) => Object.keys(tb(r)).length >= 1 || (r.rboss || 0) >= 1 },
  { id: 'rboss5', cat: 'boss',     nameTh: 'ผู้ปราบผีใหญ่กรุงศรี',   color: '#e67e22', hint: 'ปราบบอสกรุงศรีฯ ครบ 4 ตัว (แม่นาค·ปู่โสม·เปรตอสุรกาย·ชาละวัน)', ok: (c, r) => AYT_BOSS.every((b) => tb(r)[b]) },
  { id: 'yak', cat: 'boss',        nameTh: 'ผู้ปราบพญาจระเข้',      color: '#e74c3c', hint: 'ร่วมปราบพญาชาละวัน (บึงผีพราย)',               ok: (c, r) => (tb(r).chalawan || 0) >= 1 },
  { id: 'dungeon', cat: 'boss',    nameTh: 'ผู้พิชิตกุมภกรรณ',      color: '#a569bd', hint: 'ร่วมปราบกุมภกรรณ (ป่าหิมพานต์)',              ok: (c, r) => (tb(r).kumphakan || 0) >= 1 },
  { id: 'dungeon10', cat: 'boss',  nameTh: 'สหายนาคราช',          color: '#8e44ad', hint: 'ร่วมปราบพญาอนันตนาคราช (เมืองบาดาล)',          ok: (c, r) => (tb(r).anantanak || 0) >= 1 },
  { id: 'raidtop', cat: 'boss',    nameTh: 'ผู้สยบยมโลก',          color: '#ff6b6b', hint: 'ร่วมปราบพญายมราช (นรกภูมิ)',                   ok: (c, r) => (tb(r).phaya_yom || 0) >= 1 },
  { id: 'hell', cat: 'boss',       nameTh: 'เจ้าแห่งเจ็ดบอส',       color: '#c0392b', hint: 'ปราบบอสประจำโซนครบทั้ง 7 ตัว (ถึงนรกภูมิ)',               ok: (c, r) => ALL_BOSS.every((b) => tb(r)[b]) },
  { id: 'rahu_slayer', cat: 'boss', nameTh: 'ผู้ข่มราหู',          color: '#7fb3d5', hint: 'ร่วมปราบพระราหู (สวรรค์ชั้นดาวดึงส์)',          ok: (c, r) => (tb(r).phra_rahu || 0) >= 1 },
  { id: 'mara_slayer', cat: 'boss', nameTh: 'ผู้ชนะมาร',           color: '#f1c40f', hint: 'ร่วมปราบพญามาราธิราช (เขาพระสุเมรุ)',          ok: (c, r) => (tb(r).phaya_mara || 0) >= 1 },
  { id: 'boss9',       cat: 'boss', nameTh: 'จักรพรรดิเก้าภพ',       color: '#ff6f61', hint: 'ปราบบอสประจำโซนครบทั้ง 9 ตัว (ถึงเขาพระสุเมรุ)', ok: (c, r) => ALL9.every((b) => tb(r)[b]) },
  { id: 'wb_join', cat: 'boss',    nameTh: 'ผู้ปลดปล่อยจันทร์',     color: '#c39bd3', hint: 'ร่วมปราบพระราหู 1 ครั้ง',                    ok: (c, r) => (r.wbJoin || 0) >= 1 },
  { id: 'wb_mvp', cat: 'boss',     nameTh: 'MVP แห่งสุริยคราส',   color: '#ffd35c', hint: 'ปิดฉากบอสโลกพระราหู',                    ok: (c, r) => (r.wbMvp || 0) >= 1 },
  // ---- สำรวจ ----
  { id: 'realm3', cat: 'explore',     nameTh: 'ผู้ท่องสามภพ',          color: '#f5b041', hint: 'ไปถึงนรกภูมิ',                               ok: (c) => (c.tdMaps || []).includes('naraka') },
  { id: 'realm4',  cat: 'explore', nameTh: 'ผู้เยือนสวรรค์',     color: '#f9e79f', hint: 'ไปถึงสวรรค์ชั้นดาวดึงส์',                 ok: (c) => (c.tdMaps || []).includes('dusit') },
  { id: 'realm5',  cat: 'explore', nameTh: 'ผู้ยืนบนยอดสุเมรุ',  color: '#d7bde2', hint: 'ไปถึงเขาพระสุเมรุ',                     ok: (c) => (c.tdMaps || []).includes('sumeru') },
  // ---- ล่าผี · ตีบวก ----
  { id: 'hunt100', cat: 'hunt',    nameTh: 'นักล่าผี',            color: '#f5b7b1', hint: 'ปราบผี 100 ตัว',                           ok: (c, r) => (r.kills || 0) >= 100 },
  { id: 'hunt1000', cat: 'hunt',   nameTh: 'มือปราบผี',           color: '#f1948a', hint: 'ปราบผี 1,000 ตัว',                         ok: (c, r) => (r.kills || 0) >= 1000 },
  { id: 'hunt5000', cat: 'hunt',   nameTh: 'เทพผู้พิชิตผี',       color: '#ec7063', hint: 'ปราบผี 5,000 ตัว',                         ok: (c, r) => (r.kills || 0) >= 5000 },
  { id: 'smith10', cat: 'smith',    nameTh: 'มือตีเหล็กกล้า',       color: '#bb8fce', hint: 'ตีบวกอุปกรณ์ถึง +10',                       ok: (c, r) => (r.enhMax || 0) >= 10 },
  { id: 'smith15', cat: 'smith',    nameTh: 'ช่างตีมือทอง',         color: '#f4d03f', hint: 'ตีบวกอุปกรณ์ถึง +15',                       ok: (c, r) => (r.enhMax || 0) >= 15 },
  { id: 'smith20', cat: 'smith',    nameTh: 'ตำนานเตาหลอม',         color: '#ff9ff3', hint: 'ตีบวกอุปกรณ์ถึง +20',                       ok: (c, r) => (r.enhMax || 0) >= 20 },
  // ---- สายซัพพอร์ต ----
  { id: 'medic', cat: 'support',      nameTh: 'หมอยาประจำขบวน',       color: '#48c9b0', hint: 'รักษาเพื่อนรวม 20,000 HP',                   ok: (c, r) => (r.healOut || 0) >= 20000 },
  { id: 'medic2', cat: 'support',     nameTh: 'หมอเทวดาแห่งกรุงศรี',    color: '#76d7c4', hint: 'รักษาเพื่อนรวม 500,000 HP',                  ok: (c, r) => (r.healOut || 0) >= 500000 },
  { id: 'khwan10', cat: 'support',    nameTh: 'ผู้เรียกขวัญ',            color: '#f9e79f', hint: 'ชุบชีวิตเพื่อนด้วยพิธีสู่ขวัญ 10 ครั้ง',         ok: (c, r) => (r.revive || 0) >= 10 },
  // ---- ชีวิต · อื่น ๆ ----
  { id: 'fisher', cat: 'life',     nameTh: 'เซียนเบ็ดท่าน้ำ',      color: '#85c1e9', hint: 'ตกปลาได้ 100 ตัว',                         ok: (c, r) => (r.fish || 0) >= 100 },
  { id: 'buek', cat: 'life',       nameTh: 'ผู้พิชิตปลาบึก',       color: '#5dade2', hint: 'ตกปลาบึกยักษ์ได้',                         ok: (c, r) => (r.buek || 0) >= 1 },
  { id: 'herbal', cat: 'life',     nameTh: 'หมอยาป่า',            color: '#82e0aa', hint: 'เก็บสมุนไพร 100 ครั้ง',                     ok: (c, r) => (r.herb || 0) >= 100 },
  { id: 'crafter', cat: 'life',    nameTh: 'ช่างฝีมือกรุงศรี',       color: '#f0b27a', hint: 'หลอม/ปรุง/ทำอาหาร 50 ครั้ง',                ok: (c, r) => (r.craft || 0) >= 50 },
  { id: 'rich', cat: 'misc',       nameTh: 'เศรษฐีกรุงศรี',          color: '#f7dc6f', hint: 'มีเงินติดตัว ฿1,000,000',                   ok: (c) => (c.gold || 0) >= 1_000_000 },
  { id: 'elder', cat: 'misc',      nameTh: 'ลูกรักผู้ใหญ่ชัย',       color: '#f8c471', hint: 'ทำเควสผู้ใหญ่ชัยครบทุกเควส',                  ok: (c) => QUESTS.every((q) => q.optional || c.quests?.done?.includes(q.id)) },
  { id: 'social', cat: 'misc',     nameTh: 'เพื่อนเยอะ',            color: '#76d7c4', hint: 'มีเพื่อนในรายชื่อ 5 คน',                     ok: (c) => (c.friends || []).length >= 5 },
];
export const TITLE_BY_ID = Object.fromEntries(TITLES.map((t) => [t.id, t]));

/** ตรวจฉายาใหม่ที่ปลดล็อก → คืนรายการ id ที่เพิ่งได้ */
export function checkTitles(c) {
  c.titles ||= [];
  const r = c.rec || {}, got = [];
  for (const t of TITLES) {
    const has = c.titles.includes(t.id);
    if (!has && t.ok(c, r)) { c.titles.push(t.id); got.push(t.id); }
    else if (has && t.dynamic && !t.ok(c, r)) {                  // ฉายาอันดับ: หลุดอันดับ = เสียฉายา
      c.titles = c.titles.filter((x) => x !== t.id);
      if (c.title === t.id) c.title = null;
    }
  }
  return got;
}
