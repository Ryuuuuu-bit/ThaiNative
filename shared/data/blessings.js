// ============================================================
//  พร / บัฟยาว: เซียมซีวัดบางผี + ของถวายศาลพระภูมิ
//  mods: atkMul (+%), def (+), critAdd (+), expMul (x), goldMul (x), dropMul (x)
// ============================================================

/** ใบเซียมซี 12 ใบ – เสี่ยงได้วันละครั้ง พรอยู่ถึงเที่ยงคืน (เวลาจริง) */
export const SIAMSI = [
  { no: 1,  luck: 'ดีเลิศ', text: 'ดั่งพระจันทร์เต็มดวง ส่องทางให้ผู้เดินทาง ลาภยศไหลมาไม่ขาดสาย', mods: { expMul: 1.2, goldMul: 1.2 } },
  { no: 2,  luck: 'ดีมาก', text: 'ดาบคมย่อมฟันไม่เสียเปล่า ศัตรูที่ขวางหน้าจะพ่ายแพ้', mods: { atkMul: 0.12 } },
  { no: 3,  luck: 'ดี',     text: 'ปลูกข้าวในนาดี ได้ผลงามเกินคาด งานที่ทำจะให้ผล', mods: { expMul: 1.15 } },
  { no: 4,  luck: 'ดี',     text: 'ทองคำฝังดิน ขุดพบโดยบังเอิญ โชคลาภมาจากทางไม่คาดคิด', mods: { goldMul: 1.25 } },
  { no: 5,  luck: 'ดีมาก', text: 'มีเทวดาคุ้มครอง ภัยร้ายแคล้วคลาด ผีไม่อาจกล้ำกราย', mods: { def: 6 } },
  { no: 6,  luck: 'ดี',     text: 'ตาเหยี่ยวมองไกล จับจุดอ่อนศัตรูได้แม่นยำ', mods: { critAdd: 0.06 } },
  { no: 7,  luck: 'กลาง',   text: 'น้ำนิ่งไหลลึก จงค่อยเป็นค่อยไป อย่าใจร้อน', mods: { def: 3, expMul: 1.05 } },
  { no: 8,  luck: 'ดี',     text: 'ของหายได้คืน ของดีจะตกถึงมือ', mods: { dropMul: 1.35 } },
  { no: 9,  luck: 'กลาง',   text: 'ฟ้าหลังฝนย่อมสดใส อดทนไว้แล้วจะดีเอง', mods: { goldMul: 1.1 } },
  { no: 10, luck: 'ร้าย',   text: 'เมฆดำตั้งเค้า ระวังสิ่งลี้ลับยามค่ำคืน ควรทำบุญเสริมดวง', mods: { def: -3 }, advice: 'ถวายของที่ศาลพระภูมิเพื่อแก้เคล็ด' },
  { no: 11, luck: 'ดีเลิศ', text: 'พญานาคให้พร ทรัพย์สินเงินทองไหลมาเทมา', mods: { goldMul: 1.3, dropMul: 1.2 } },
  { no: 12, luck: 'กลาง',   text: 'ทางยาวไกลแต่ไม่โดดเดี่ยว มีมิตรร่วมทาง', mods: { expMul: 1.1 } },
];

/** ของถวายศาลพระภูมิ (ซื้อที่ร้านป้าติ๋ม) – พรชนิดเดียวกันถวายซ้ำ = ต่อเวลา */
export const OFFERINGS = {
  garland:   { item: 'garland',   nameTh: 'พวงมาลัยดาวเรือง', icon: '🌼', minutes: 20, mods: { expMul: 1.15 }, blessTh: 'EXP +15%' },
  nam_daeng: { item: 'nam_daeng', nameTh: 'น้ำแดง',           icon: '🥤', minutes: 20, mods: { def: 5 },       blessTh: 'ป้องกัน +5' },
  khai_tom:  { item: 'khai_tom',  nameTh: 'ไข่ต้ม',           icon: '🥚', minutes: 20, mods: { goldMul: 1.2 }, blessTh: 'เงิน +20%' },
  hua_mu:    { item: 'hua_mu',    nameTh: 'หัวหมูบวงสรวง',    icon: '🐷', minutes: 30, mods: { atkMul: 0.1, dropMul: 1.5 }, blessTh: 'โจมตี +10% · ของดรอป +50%' },
};

/** แปลง mods เป็นข้อความสั้น */
export function modsText(m) {
  const out = [];
  if (m.atkMul) out.push(`โจมตี ${m.atkMul > 0 ? '+' : ''}${Math.round(m.atkMul * 100)}%`);
  if (m.def) out.push(`ป้องกัน ${m.def > 0 ? '+' : ''}${m.def}`);
  if (m.critAdd) out.push(`คริติคอล +${Math.round(m.critAdd * 100)}%`);
  if (m.expMul) out.push(`EXP +${Math.round((m.expMul - 1) * 100)}%`);
  if (m.goldMul) out.push(`เงิน +${Math.round((m.goldMul - 1) * 100)}%`);
  if (m.dropMul) out.push(`ของดรอป +${Math.round((m.dropMul - 1) * 100)}%`);
  return out.join(' · ');
}

/** รวมพรที่ยังไม่หมดอายุ → ตัวคูณเดียว */
export function combineBlessings(list = [], now = Date.now()) {
  const r = { atkMul: 0, def: 0, critAdd: 0, expMul: 1, goldMul: 1, dropMul: 1 };
  for (const b of list) {
    if (!(b.until > now)) continue;
    const m = b.mods || {};
    r.atkMul += m.atkMul || 0; r.def += m.def || 0; r.critAdd += m.critAdd || 0;
    r.expMul *= m.expMul || 1; r.goldMul *= m.goldMul || 1; r.dropMul *= m.dropMul || 1;
  }
  return r;
}

/** วันที่ตามเวลาไทย (UTC+7) ใช้จำกัดเซียมซี/ค่าหัววันละครั้ง – client และ server ได้ค่าเดียวกันเสมอ */
const TH = 7 * 3600e3;
const toMs = (d) => (d instanceof Date ? d.getTime() : Number.isFinite(d) ? d : Date.now());
export const todayKey = (d = Date.now()) => { const t = new Date(toMs(d) + TH); return `${t.getUTCFullYear()}-${t.getUTCMonth() + 1}-${t.getUTCDate()}`; };
export function endOfToday(d = Date.now()) { const t = toMs(d) + TH; return t - (t % 86400e3) + 86400e3 - 1 - TH; }
