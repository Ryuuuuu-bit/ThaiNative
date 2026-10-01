// ============================================================
//  ค่าสุ่มบนอุปกรณ์ที่ดรอป (แบบ PoE)
//  ไอเทมมีค่าสุ่มเก็บเป็น "รหัสแปร":  <รหัสฐาน>@<ค่า><ขั้น>+<ค่า><ขั้น>   เช่น g_sword_h06@atk2+crit1
//  → ซ้อนกองได้ปกติ, เทรด/ขาย/ล็อก/ใส่ Hotbar ใช้รหัสเดิมได้ทั้งหมด (ITEMS สร้างข้อมูลให้เองตอนเรียก)
// ============================================================
const R = Math.round;

/**
 * ค่าสุ่มแต่ละแบบ: on = ชนิดของที่ออกได้ · v(L, t) = ค่าตามเลเวลของ L และขั้น t (1–3)
 * name = ชื่อต่อท้ายไอเทม (ใช้ของค่าที่แรงที่สุด)
 */
export const AFFIX = {
  atk:      { th: 'พลังโจมตี',     on: ['weapon', 'gloves', 'accessory', 'belt'],            v: (L, t) => R((2 + L * 0.3) * t),   name: 'แห่งคมดาบ' },
  matk:     { th: 'พลังเวทย์',     on: ['weapon', 'gloves', 'accessory', 'helm'],            v: (L, t) => R((2 + L * 0.35) * t),  name: 'แห่งมนตรา' },
  hp:       { th: 'HP',            on: ['armor', 'helm', 'belt', 'boots', 'accessory'],       v: (L, t) => R((5 + L * 1.5) * t),   name: 'แห่งความทรหด' },
  mp:       { th: 'MP',            on: ['helm', 'accessory', 'belt', 'armor'],                v: (L, t) => R((4 + L) * t),         name: 'แห่งสมาธิ' },
  def:      { th: 'ป้องกัน',        on: ['armor', 'helm', 'boots', 'gloves', 'belt'],          v: (L, t) => R((1 + L * 0.1) * t),   name: 'แห่งเกราะเพชร' },
  eva:      { th: 'หลบหลีก',       on: ['boots', 'accessory', 'armor'],                       v: (L, t) => R((1 + L * 0.12) * t),  name: 'แห่งเงาลม' },
  acc:      { th: 'ความแม่นยำ',    on: ['weapon', 'gloves', 'helm'],                          v: (L, t) => 2 * t,                  name: 'แห่งตาเหยี่ยว' },
  crit:     { th: 'โอกาสคริ',       on: ['weapon', 'gloves', 'accessory'],                     v: (L, t) => +(0.01 * t).toFixed(2), name: 'แห่งพญาเสือ', pct: true },
  critDmg:  { th: 'ความแรงคริ',     on: ['weapon', 'accessory'],                               v: (L, t) => +(0.06 * t).toFixed(2), name: 'แห่งเขี้ยวสมิง', pct: true },
  STR:      { th: 'STR',           on: ['weapon', 'armor', 'gloves', 'belt', 'accessory'],    v: (L, t) => R((1 + L / 10) * t),    name: 'แห่งกำลังช้างสาร' },
  DEX:      { th: 'DEX',           on: ['weapon', 'boots', 'gloves', 'accessory'],            v: (L, t) => R((1 + L / 10) * t),    name: 'แห่งพรานไพร' },
  INT:      { th: 'INT',           on: ['weapon', 'helm', 'accessory', 'armor'],              v: (L, t) => R((1 + L / 10) * t),    name: 'แห่งหมอธรรม' },
  VIT:      { th: 'VIT',           on: ['armor', 'helm', 'boots', 'belt'],                    v: (L, t) => R((1 + L / 10) * t),    name: 'แห่งหินผา' },
  AGI:      { th: 'AGI',           on: ['boots', 'gloves', 'accessory', 'weapon'],            v: (L, t) => R((1 + L / 10) * t),    name: 'แห่งวายุ' },
  LUK:      { th: 'LUK',           on: ['accessory', 'helm', 'gloves'],                       v: (L, t) => R((1 + L / 10) * t),    name: 'แห่งโชคลาภ' },
  patkMul:  { th: 'ตีกายภาพ',       on: ['weapon'],                                            v: (L, t) => +(0.02 * t).toFixed(2), name: 'แห่งขุนศึก', pct: true },
  matkMul:  { th: 'ตีเวทย์',         on: ['weapon'],                                            v: (L, t) => +(0.02 * t).toFixed(2), name: 'แห่งอาคม', pct: true },
  flaskPct: { th: 'ขวดยาฟื้นเพิ่ม', on: ['belt'],                                              v: (L, t) => 8 * t,                  name: 'แห่งน้ำทิพย์', flatPct: true },
};
export const AFFIX_KEYS = Object.keys(AFFIX);
const TIER_TH = ['', 'I', 'II', 'III'];

/** แยกรหัส → { base, list:[[key,tier]] } หรือ null ถ้ารูปแบบผิด */
export function parseAffixId(id) {
  if (typeof id !== 'string') return null;
  const at = id.indexOf('@');
  if (at < 1) return null;
  const base = id.slice(0, at), parts = id.slice(at + 1).split('+');
  if (!parts.length || parts.length > 3) return null;
  const list = [];
  for (const p of parts) {
    const m = /^([A-Za-z]+)([1-3])$/.exec(p);
    if (!m || !AFFIX[m[1]] || list.some(([k]) => k === m[1])) return null;
    list.push([m[1], +m[2]]);
  }
  // บังคับลำดับมาตรฐาน (กันรหัสซ้ำคนละลำดับ)
  const canon = [...list].sort((a, b) => AFFIX_KEYS.indexOf(a[0]) - AFFIX_KEYS.indexOf(b[0]));
  if (canon.some((x, i) => x[0] !== list[i][0])) return null;
  return { base, list };
}
export const baseItemId = (id) => (typeof id === 'string' && id.includes('@') ? id.slice(0, id.indexOf('@')) : id);
export const affixText = (key, val) => {
  const a = AFFIX[key];
  return a.pct ? `${a.th} +${R(val * 100)}%` : a.flatPct ? `${a.th} +${val}%` : `${a.th} +${val}`;
};

/** สร้างข้อมูลไอเทมรุ่นมีค่าสุ่มจากไอเทมฐาน (คืน null ถ้าชนิดไม่รองรับ) */
export function makeVariant(baseIt, list) {
  if (!baseIt) return null;
  const type = baseIt.type;
  if (list.some(([k]) => !AFFIX[k].on.includes(type))) return null;
  const L = baseIt.lv || 1;
  const bonus = { ...(baseIt.bonus || {}) }, lines = [];
  let best = null, bestT = 0;
  for (const [k, t] of list) {
    const v = AFFIX[k].v(L, t);
    bonus[k] = +((bonus[k] || 0) + v).toFixed(3);
    lines.push({ key: k, tier: t, val: v, text: `${affixText(k, v)} ${TIER_TH[t]}` });
    if (t > bestT) { bestT = t; best = k; }
  }
  const n = list.length;
  const base = baseIt.sell ?? Math.floor((baseIt.price || 0) * 0.5);
  return {
    ...baseIt, bonus, affixes: lines, affixN: n,
    nameTh: `${baseIt.nameTh} ${AFFIX[best].name}`,
    baseNameTh: baseIt.nameTh,
    sell: Math.max(20, Math.floor(base * (1 + 0.3 * n + 0.1 * list.reduce((s, [, t]) => s + t, 0)))),   // ค่าสุ่มเพิ่มราคาขายร้านได้ไม่เกิน ×2.8 (เดิม ×4.6)
    price: undefined,
  };
}

/**
 * ทอยค่าสุ่มให้อุปกรณ์ที่ดรอป
 * @param baseIt ไอเทมฐาน · @param monLv เลเวลผี · @param grade 'normal'|'elite'|'boss'
 * @returns รายการ [[key,tier]] (อาจว่าง = ของธรรมดา)
 */
export function rollAffixes(baseIt, monLv = 1, grade = 'normal', rnd = Math.random) {
  if (!baseIt) return [];
  const odds = { normal: [0.45, 0.15, 0.03], elite: [0.7, 0.35, 0.1], boss: [1, 0.7, 0.3] }[grade] || [0.45, 0.15, 0.03];
  let n = 0;
  for (const p of odds) { if (rnd() < p) n++; else break; }
  const pool = AFFIX_KEYS.filter((k) => AFFIX[k].on.includes(baseIt.type));
  const out = [];
  while (out.length < n && pool.length) {
    const k = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
    // ขั้นสูงออกยาก · ผีเลเวลสูง/บอสมีโอกาสขั้นสูงมากขึ้น
    const lift = Math.min(0.25, monLv / 120) + (grade === 'boss' ? 0.2 : grade === 'elite' ? 0.1 : 0);
    const r = rnd(), t = r < 0.08 + lift ? 3 : r < 0.38 + lift ? 2 : 1;
    out.push([k, t]);
  }
  return out.sort((a, b) => AFFIX_KEYS.indexOf(a[0]) - AFFIX_KEYS.indexOf(b[0]));
}
export const affixId = (base, list) => (list.length ? `${base}@${list.map(([k, t]) => `${k}${t}`).join('+')}` : base);
