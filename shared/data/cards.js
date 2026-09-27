// ============================================================
//  การ์ดผี (แบบ Ragnarok) – ดรอปจากผีแต่ละชนิด · ใส่ในช่องการ์ดของช่องสวมใส่
//  ▸ การ์ดติดกับ "ช่องสวมใส่" (เหมือนตีบวก): เปลี่ยนอาวุธ/เสื้อ การ์ดยังอยู่ · มีผลเมื่อช่องนั้นสวมของอยู่
//  ▸ ช่องการ์ด: ทุกช่อง 1 ช่อง · อาวุธ/เสื้อ ตีบวกถึง +7 ได้ช่องที่ 2
//  ▸ สมุดสะสม: เก็บครบตามจำนวนชนิดได้โบนัสถาวร
// ============================================================
import { MONSTERS } from './monsters.js';

/** อัตราดรอปการ์ด: ผีทั่วไป 0.5% · ผีหัวหน้า (elite) 5% · บอสประจำโซน 20% (ต่อผู้ช่วยตีแต่ละคน) */
export const CARD_DROP = { normal: 0.005, elite: 0.05, boss: 0.2 };

export const CARD_SLOT_TH = { weapon: 'อาวุธ', armor: 'เสื้อ', accessory: 'เครื่องประดับ' };
/** ช่องสวมใส่ → ชนิดการ์ดที่ใส่ได้ */
export const SLOT_CARD = { weapon: 'weapon', armor: 'armor', accessory: 'accessory', accessory2: 'accessory' };
export const CARD_SOCKET_ENH = 7;          // ตีบวกถึง +7 ได้ช่องการ์ดที่ 2 (อาวุธ/เสื้อ)

/**
 * ผลของการ์ด: bonus = ค่าพลัง (รวมกับอุปกรณ์) · econ = { exp, gold, drop } (%, คูณเพิ่ม)
 * คีย์ bonus: STR DEX INT CRI VIT hp mp atk matk def crit acc eva critDmg hpMul mpMul patkMul matkMul
 */
const DEFS = {
  phi_tuay_kaew:   { slot: 'armor',     bonus: { hp: 40, VIT: 1 },            flavor: 'ฟางอัดแน่นกันคมเคียว' },
  kuman_thong:     { slot: 'accessory', bonus: { DEX: 2 }, econ: { gold: 5 }, flavor: 'กุมารทองช่วยเรียกทรัพย์' },
  krasue:          { slot: 'weapon',    bonus: { matk: 10, mp: 20 },          flavor: 'แสงเขียวยามค่ำคืน' },
  nang_tani:       { slot: 'armor',     bonus: { def: 3, hp: 30 },            flavor: 'ใบตานีห่อกายไว้' },
  phi_pob:         { slot: 'weapon',    bonus: { atk: 8, crit: 0.02 },        flavor: 'หิวกระหายไม่รู้จักพอ' },
  phi_jang_nang:   { slot: 'accessory', bonus: { acc: 8 },                    flavor: 'ตาจ้องจอไม่กะพริบ' },
  phi_phrai:       { slot: 'accessory', bonus: { eva: 6, INT: 1 },            flavor: 'พรายน้ำลื่นไหลหลบหลีก' },
  pret:            { slot: 'armor',     bonus: { hpMul: 0.08 },               flavor: 'ร่างสูงเท่าต้นตาล' },
  saming:          { slot: 'weapon',    bonus: { crit: 0.05, critDmg: 0.1 },  flavor: 'เขี้ยวเสือสมิงฉีกกระชาก' },
  phi_ha:          { slot: 'weapon',    bonus: { matkMul: 0.08 },             flavor: 'โรคห่าแห่งคาถามืด' },
  krahang:         { slot: 'accessory', bonus: { DEX: 3, eva: 3 },            flavor: 'กระด้งคู่พาบินเร็ว' },
  khamot:          { slot: 'accessory', bonus: { INT: 3, mp: 30 },            flavor: 'ไฟผีวูบวาบนำทาง' },
  phi_dip:         { slot: 'armor',     bonus: { def: 6, VIT: 2 },            flavor: 'ร่างแข็งไม่รู้เจ็บ' },
  nang_takhian:    { slot: 'armor',     bonus: { mpMul: 0.1, INT: 2 },        flavor: 'รากตะเคียนดูดพลังจากดิน' },
  tai_hong:        { slot: 'weapon',    bonus: { patkMul: 0.08 },             flavor: 'แค้นฝังใจแรงเกินคน' },
  phi_phong:       { slot: 'accessory', bonus: {}, econ: { exp: 5 },          flavor: 'ส่องทางให้เรียนรู้ไว' },
  kong_koi:        { slot: 'weapon',    bonus: { STR: 3, atk: 6 },            flavor: 'กระโดดขาเดียวแต่หนักหน่วง' },
  phi_lang_kluang: { slot: 'accessory', bonus: {}, econ: { drop: 10 },        flavor: 'ของหล่นจากหลังกลวง' },
  phi_chamot:      { slot: 'armor',     bonus: { hp: 80, def: 4 },            flavor: 'เกล็ดจะมอดหนาแน่น' },
  pret_asura:      { slot: 'weapon',    bonus: { STR: 4, patkMul: 0.1, matkMul: 0.1 }, flavor: 'พลังอสุรกายแห่งนรกภูมิ' },
  mae_nak:         { slot: 'accessory', bonus: { VIT: 3, hpMul: 0.06 },      flavor: 'รอคอยไม่มีวันสิ้นสุด' },
  pu_som:          { slot: 'accessory', bonus: { CRI: 2 }, econ: { gold: 15, drop: 5 }, flavor: 'ทองท่วมตัวแต่ไม่เคยได้ใช้' },
  chalawan:        { slot: 'armor',     bonus: { def: 10, hpMul: 0.12 },     flavor: 'เกล็ดพญาจระเข้แกร่งดั่งเหล็ก' },
  // ---- แดนต่าง ๆ (Lv.30–99) ----
  kumphan:         { slot: 'armor',     bonus: { hp: 160, VIT: 3 },           flavor: 'ผิวยักษ์หนาดั่งหินผา' },
  khotchasi:       { slot: 'weapon',    bonus: { atk: 18, STR: 3 },           flavor: 'แรงช้างผสานสิงห์' },
  hatsadiling:     { slot: 'accessory', bonus: { DEX: 4, eva: 6 },            flavor: 'ปีกพายุแห่งหิมพานต์' },
  makkaliphon:     { slot: 'accessory', bonus: { INT: 4, mp: 80 },            flavor: 'มนต์หลงเสน่ห์นารีผล' },
  kumphakan:       { slot: 'weapon',    bonus: { STR: 6, patkMul: 0.12, crit: 0.03 }, flavor: 'หอกโมกขศักดิ์ทะลวงฟ้า' },
  nak_phrai:       { slot: 'armor',     bonus: { def: 12, mpMul: 0.08 },      flavor: 'เกล็ดนาคพรายเย็นเยียบ' },
  ngueak_phi:      { slot: 'weapon',    bonus: { matk: 26, INT: 3 },          flavor: 'เพลงล่อวิญญาณใต้บาดาล' },
  pla_khiao:       { slot: 'accessory', bonus: { crit: 0.04, acc: 10 },       flavor: 'เขี้ยวแก้วแหลมคม' },
  tahan_nak:       { slot: 'armor',     bonus: { def: 16, hp: 200 },          flavor: 'เกราะเกล็ดเงินองครักษ์นาคราช' },
  anantanak:       { slot: 'armor',     bonus: { VIT: 6, hpMul: 0.14, def: 12 }, flavor: 'เจ็ดเศียรคุ้มภัย' },
  niraiyaban:      { slot: 'weapon',    bonus: { atk: 30, critDmg: 0.15 },    flavor: 'หอกเหล็กเผาไฟนรก' },
  pret_khem:       { slot: 'accessory', bonus: {}, econ: { exp: 8 },          flavor: 'หิวกระหายความรู้ชั่วกัลป์' },
  phi_ton_ngiw:    { slot: 'armor',     bonus: { def: 20, hp: 260, STR: 2 },  flavor: 'หนามเหล็กต้นงิ้วสะท้อนกลับ' },
  yommathut:       { slot: 'accessory', bonus: {}, econ: { drop: 12, gold: 10 }, flavor: 'บ่วงบาศคล้องของมีค่า' },
  phaya_yom:       { slot: 'weapon',    bonus: { STR: 5, INT: 5, patkMul: 0.14, matkMul: 0.14 }, flavor: 'คำพิพากษาแห่งยมโลก' },
};

/** รายการการ์ดทั้งหมด (เรียงตามเลเวลผี) */
export const CARDS = Object.entries(DEFS)
  .filter(([mon]) => MONSTERS[mon])
  .map(([mon, d]) => {
    const m = MONSTERS[mon];
    return { id: `card_${mon}`, mon, level: m.level, elite: !!(m.elite || m.boss), boss: !!m.boss, nameTh: `การ์ด${m.nameTh}`, monTh: m.nameTh, slot: d.slot, bonus: d.bonus || {}, econ: d.econ || {}, flavor: d.flavor, palette: m.palette || null };
  })
  .sort((a, b) => a.level - b.level);
export const CARD_BY_ID = Object.fromEntries(CARDS.map((c) => [c.id, c]));
export const CARD_OF_MON = Object.fromEntries(CARDS.map((c) => [c.mon, c.id]));

const STAT_TH = { STR: 'STR', DEX: 'DEX', INT: 'INT', CRI: 'CRI', VIT: 'VIT', hp: 'HP', mp: 'MP', atk: 'ATK', matk: 'MATK', def: 'DEF', acc: 'แม่นยำ', eva: 'หลบ' };
const PCT_TH = { crit: 'คริติคอล', critDmg: 'แรงคริ', hpMul: 'HP', mpMul: 'MP', patkMul: 'ATK', matkMul: 'MATK' };
const ECON_TH = { exp: 'EXP', gold: 'เงินดรอป', drop: 'โอกาสดรอป' };
/** ข้อความผลการ์ด เช่น "ATK +8 · คริติคอล +2%" */
export function cardText(c) {
  const parts = [];
  for (const [k, v] of Object.entries(c.bonus || {})) parts.push(PCT_TH[k] ? `${PCT_TH[k]} +${Math.round(v * 100)}%` : `${STAT_TH[k] || k} +${v}`);
  for (const [k, v] of Object.entries(c.econ || {})) parts.push(`${ECON_TH[k]} +${v}%`);
  return parts.join(' · ');
}

/** ไอเทมการ์ด (รวมเข้า ITEMS) */
export const CARD_ITEMS = Object.fromEntries(CARDS.map((c) => [c.id, {
  nameTh: c.nameTh, type: 'card', icon: '🃏', cardSlot: c.slot, sell: c.boss ? 1500 : c.elite ? 800 : 40 + c.level * 20, rare: true,
  desc: `${CARD_SLOT_TH[c.slot]} · ${cardText(c)}`,
}]));

/** จำนวนช่องการ์ดของช่องสวมใส่ (ขึ้นกับขั้นตีบวก) */
export function socketCount(slot, enh = 0) {
  if (!SLOT_CARD[slot]) return 0;
  return (slot === 'weapon' || slot === 'armor') && enh >= CARD_SOCKET_ENH ? 2 : 1;
}

/** ค่าถอดการ์ดออก (เงิน) */
export const cardRemoveCost = (cardId) => { const c = CARD_BY_ID[cardId]; return c ? (c.elite ? 2000 : 150 + c.level * 40) : 0; };

/** โบนัสสมุดสะสม (นับชนิดที่เคยได้) */
export const BOOK_TIERS = [
  { n: 3, bonus: { hp: 30 }, text: 'HP +30' },
  { n: 6, bonus: { atk: 4, matk: 4 }, text: 'ATK/MATK +4' },
  { n: 10, bonus: { STR: 1, DEX: 1, INT: 1, CRI: 1, VIT: 1 }, text: 'สถานะทุกตัว +1' },
  { n: 15, econ: { exp: 5 }, text: 'EXP +5%' },
  { n: 20, bonus: { STR: 2, DEX: 2, INT: 2, CRI: 2, VIT: 2, crit: 0.02 }, text: 'สถานะทุกตัว +2 · คริติคอล +2%' },
  { n: 23, bonus: { patkMul: 0.05, matkMul: 0.05 }, text: 'ATK/MATK +5%' },
  { n: 30, econ: { exp: 5, drop: 5 }, bonus: { hp: 200 }, text: 'EXP +5% · โอกาสดรอป +5% · HP +200' },
  { n: 38, bonus: { STR: 5, DEX: 5, INT: 5, CRI: 5, VIT: 5, patkMul: 0.05, matkMul: 0.05 }, text: 'ครบทุกใบ: สถานะทุกตัว +5 · ATK/MATK +5%' },
];
export const bookCount = (c) => Object.keys(c?.cardBook || {}).filter((id) => CARD_BY_ID[id]).length;

/** การ์ดที่มีผลอยู่ (ช่องที่สวมของ + ช่องการ์ดยังปลดล็อก) */
export function activeCards(c) {
  const out = [];
  for (const [slot, list] of Object.entries(c?.cards || {})) {
    if (!c.equipment?.[slot] || !Array.isArray(list)) continue;
    const n = socketCount(slot, c.enhance?.[slot] || 0);
    list.slice(0, n).forEach((id) => { if (CARD_BY_ID[id]) out.push(CARD_BY_ID[id]); });
  }
  return out;
}

/** รวมโบนัสจากการ์ด + สมุดสะสม → { bonus, econ } */
export function cardBonus(c) {
  const bonus = {}, econ = { exp: 0, gold: 0, drop: 0 };
  const add = (b = {}, e = {}) => {
    for (const [k, v] of Object.entries(b)) bonus[k] = (bonus[k] || 0) + v;
    for (const [k, v] of Object.entries(e)) econ[k] = (econ[k] || 0) + v;
  };
  for (const cd of activeCards(c)) add(cd.bonus, cd.econ);
  const n = bookCount(c);
  for (const t of BOOK_TIERS) if (n >= t.n) add(t.bonus, t.econ);
  return { bonus, econ };
}

/** ทอยการ์ดจากผีที่ตาย (dropMul = ตัวคูณจากพร) → id การ์ด หรือ null */
export function rollCard(monId, dropMul = 1, rng = Math.random) {
  const id = CARD_OF_MON[monId];
  if (!id) return null;
  const m = MONSTERS[monId];
  const base = m?.boss ? CARD_DROP.boss : m?.elite ? CARD_DROP.elite : CARD_DROP.normal;
  return rng() < base * dropMul ? id : null;          // (โบนัส "โอกาสดรอป" จากการ์ดรวมอยู่ใน dropMul แล้ว)
}

/** ตรวจ/ซ่อมข้อมูลการ์ดในเซฟ */
export function fixCards(c) {
  const cards = c.cards && typeof c.cards === 'object' ? c.cards : {};
  c.cards = {};
  for (const slot of Object.keys(SLOT_CARD)) {
    const list = Array.isArray(cards[slot]) ? cards[slot] : [];
    c.cards[slot] = list.filter((id) => CARD_BY_ID[id]?.slot === SLOT_CARD[slot]).slice(0, 2);
  }
  const book = c.cardBook && typeof c.cardBook === 'object' ? c.cardBook : {};
  c.cardBook = {};
  for (const [id, n] of Object.entries(book)) if (CARD_BY_ID[id]) c.cardBook[id] = Math.max(1, Math.floor(+n || 1));
  return c;
}
