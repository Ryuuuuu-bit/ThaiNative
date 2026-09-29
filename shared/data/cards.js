// ============================================================
//  การ์ดผี (แบบ Ragnarok) – ดรอปจากผีแต่ละชนิด · ใส่ในช่องการ์ดของช่องสวมใส่
//  ▸ การ์ดติดกับ "ช่องสวมใส่" (เหมือนตีบวก): เปลี่ยนอาวุธ/เสื้อ การ์ดยังอยู่ · มีผลเมื่อช่องนั้นสวมของอยู่
//  ▸ ช่องการ์ด: ทุกช่อง 1 ช่อง · อาวุธ/เสื้อ ตีบวกถึง +7 ได้ช่องที่ 2
//  ▸ สมุดสะสม: เก็บครบตามจำนวนชนิดได้โบนัสถาวร
// ============================================================
import { MONSTERS } from './monsters.js';

/** อัตราดรอปการ์ด: ผีทั่วไป 0.5% · ผีหัวหน้า (elite) 1.2% · บอสประจำโซน 20% (ต่อผู้ช่วยตีแต่ละคน) */
export const CARD_DROP = { normal: 0.005, elite: 0.012, boss: 0.2 };
/** พร/การ์ดเพิ่มดรอป มีผลกับโอกาสการ์ดแค่ 1/4 และไม่เกิน ×1.5 (กันการ์ดตกถี่เกินจริงเมื่อซ้อนบัฟดรอป) */
export const CARD_MUL_MAX = 1.5;
export const cardDropMul = (dropMul = 1) => Math.max(1, Math.min(CARD_MUL_MAX, 1 + (dropMul - 1) * 0.25));

export const CARD_SLOT_TH = { weapon: 'อาวุธ', armor: 'เสื้อ', helm: 'หมวก', gloves: 'ถุงมือ', boots: 'รองเท้า', belt: 'เข็มขัด', accessory: 'เครื่องประดับ' };
/** ช่องสวมใส่ → ชนิดการ์ดที่ใส่ได้ (ทุกช่องอุปกรณ์ใส่การ์ดได้) */
export const SLOT_CARD = { weapon: 'weapon', helm: 'helm', armor: 'armor', gloves: 'gloves', boots: 'boots', belt: 'belt', accessory: 'accessory', accessory2: 'accessory' };
export const CARD_SOCKET_ENH = 7;          // ตีบวกถึง +7 ได้ช่องการ์ดที่ 2 (อาวุธ/เสื้อ)
/** ธีมการ์ดแต่ละช่อง (ไว้โชว์ในสมุด/คู่มือ) */
export const CARD_SLOT_THEME = { weapon: 'โจมตี', armor: 'ป้องกัน/HP', helm: 'สถานะหลัก/MP', gloves: 'คริ/แม่นยำ', boots: 'หลบหลีก', belt: 'HP/VIT', accessory: 'EXP/เงิน/ดรอป' };

/**
 * ผลของการ์ด: bonus = ค่าพลัง (รวมกับอุปกรณ์) · econ = { exp, gold, drop } (%, คูณเพิ่ม)
 * ▸ ทุกอาชีพได้ค่าเท่ากัน: คีย์กลางแปลงตามอาวุธที่ถืออยู่ (jobBonus)
 *    dmg = พลังโจมตี (กายภาพ → ATK · เวท/หมอยา → MATK) · dmgMul = % พลังโจมตีสายตัวเอง
 *    MAIN = สถานะหลักของสาย (ดาบ/มวย STR · ธนู STR+DEX · เวท/หมอยา INT)
 * คีย์อื่น: CRI VIT hp mp def crit acc eva critDmg hpMul mpMul
 */
const DEFS = {
  // ---- Lv.1–30 ----
  phi_tuay_kaew:   { slot: 'armor',     bonus: { hp: 40, VIT: 1 },            flavor: 'ฟางอัดแน่นกันคมเคียว' },
  kuman_thong:     { slot: 'accessory', bonus: { MAIN: 1 }, econ: { gold: 5 }, flavor: 'กุมารทองช่วยเรียกทรัพย์' },
  krasue:          { slot: 'helm',      bonus: { mp: 30, MAIN: 1 },           flavor: 'แสงเขียวยามค่ำคืน' },
  nang_tani:       { slot: 'boots',     bonus: { eva: 3, hp: 20 },            flavor: 'ใบตานีห่อเท้าไว้เงียบกริบ' },
  phi_pob:         { slot: 'weapon',    bonus: { dmg: 8, crit: 0.02 },        flavor: 'หิวกระหายไม่รู้จักพอ' },
  phi_jang_nang:   { slot: 'gloves',    bonus: { acc: 8 },                    flavor: 'ตาจ้องจอไม่กะพริบ' },
  mae_nak:         { slot: 'belt',      bonus: { VIT: 3, hpMul: 0.06 },       flavor: 'รอคอยไม่มีวันสิ้นสุด' },
  pret:            { slot: 'armor',     bonus: { hpMul: 0.08 },               flavor: 'ร่างสูงเท่าต้นตาล' },
  saming:          { slot: 'gloves',    bonus: { crit: 0.04, critDmg: 0.08 }, flavor: 'เขี้ยวเสือสมิงฉีกกระชาก' },
  kong_koi:        { slot: 'boots',     bonus: { eva: 4, MAIN: 2 },           flavor: 'กระโดดขาเดียวแต่ว่องไว' },
  phi_ha:          { slot: 'weapon',    bonus: { dmgMul: 0.08 },              flavor: 'โรคห่าแห่งคาถามืด' },
  pu_som:          { slot: 'accessory', bonus: { CRI: 2 }, econ: { gold: 15, drop: 5 }, flavor: 'ทองท่วมตัวแต่ไม่เคยได้ใช้' },
  phi_dip:         { slot: 'belt',      bonus: { def: 6, VIT: 2 },            flavor: 'ร่างแข็งไม่รู้เจ็บ' },
  tai_hong:        { slot: 'helm',      bonus: { MAIN: 3, acc: 4 },           flavor: 'แค้นฝังใจแรงเกินคน' },
  phi_phong:       { slot: 'accessory', bonus: {}, econ: { exp: 5 },          flavor: 'ส่องทางให้เรียนรู้ไว' },
  phi_lang_kluang: { slot: 'accessory', bonus: {}, econ: { drop: 10 },        flavor: 'ของหล่นจากหลังกลวง' },
  khamot:          { slot: 'helm',      bonus: { mp: 40, mpMul: 0.05 },       flavor: 'ไฟผีวูบวาบนำทาง' },
  nang_takhian:    { slot: 'belt',      bonus: { mpMul: 0.1, hp: 60 },        flavor: 'รากตะเคียนดูดพลังจากดิน' },
  pret_asura:      { slot: 'weapon',    bonus: { MAIN: 4, dmgMul: 0.1 },      flavor: 'พลังอสุรกายแห่งนรกภูมิ' },
  krahang:         { slot: 'boots',     bonus: { eva: 7, acc: 3 },            flavor: 'กระด้งคู่พาบินเร็ว' },
  phi_phrai:       { slot: 'gloves',    bonus: { crit: 0.03, acc: 6 },        flavor: 'พรายน้ำลื่นไหลหลบหลีก' },
  phi_chamot:      { slot: 'armor',     bonus: { hp: 80, def: 4 },            flavor: 'เกล็ดจะมอดหนาแน่น' },
  chalawan:        { slot: 'armor',     bonus: { def: 10, hpMul: 0.12 },      flavor: 'เกล็ดพญาจระเข้แกร่งดั่งเหล็ก' },
  // ---- Lv.31–98 ----
  kumphan:         { slot: 'belt',      bonus: { hp: 160, VIT: 3 },           flavor: 'ผิวยักษ์หนาดั่งหินผา' },
  khotchasi:       { slot: 'weapon',    bonus: { dmg: 18, MAIN: 3 },          flavor: 'แรงช้างผสานสิงห์' },
  hatsadiling:     { slot: 'boots',     bonus: { eva: 9, MAIN: 2 },           flavor: 'ปีกพายุแห่งหิมพานต์' },
  makkaliphon:     { slot: 'helm',      bonus: { MAIN: 4, mp: 80 },           flavor: 'มนต์หลงเสน่ห์นารีผล' },
  kumphakan:       { slot: 'gloves',    bonus: { MAIN: 6, dmgMul: 0.06, crit: 0.03 }, flavor: 'หอกโมกขศักดิ์ทะลวงฟ้า' },
  nak_phrai:       { slot: 'armor',     bonus: { def: 12, mpMul: 0.08 },      flavor: 'เกล็ดนาคพรายเย็นเยียบ' },
  ngueak_phi:      { slot: 'weapon',    bonus: { dmg: 26, MAIN: 3 },          flavor: 'เพลงล่อวิญญาณใต้บาดาล' },
  pla_khiao:       { slot: 'gloves',    bonus: { crit: 0.05, acc: 10 },       flavor: 'เขี้ยวแก้วแหลมคม' },
  tahan_nak:       { slot: 'belt',      bonus: { def: 10, hp: 220 },          flavor: 'เข็มขัดเกล็ดเงินองครักษ์นาคราช' },
  anantanak:       { slot: 'armor',     bonus: { VIT: 6, hpMul: 0.14, def: 12 }, flavor: 'เจ็ดเศียรคุ้มภัย' },
  niraiyaban:      { slot: 'weapon',    bonus: { dmg: 30, critDmg: 0.15 },    flavor: 'หอกเหล็กเผาไฟนรก' },
  pret_khem:       { slot: 'accessory', bonus: {}, econ: { exp: 8 },          flavor: 'หิวกระหายความรู้ชั่วกัลป์' },
  phi_ton_ngiw:    { slot: 'boots',     bonus: { eva: 10, hp: 200 },          flavor: 'หนามเหล็กต้นงิ้วใต้ฝ่าเท้า' },
  yommathut:       { slot: 'accessory', bonus: {}, econ: { drop: 12, gold: 10 }, flavor: 'บ่วงบาศคล้องของมีค่า' },
  rahu_eclipse:    { slot: 'weapon',    bonus: { MAIN: 6, dmgMul: 0.12, critDmg: 0.2 }, flavor: 'จันทร์ที่ถูกกลืนยังเรืองแสงในมือผู้ปิดฉาก (การ์ด MVP บอสโลก)' },
  // ---- Lv.99–150 ----
  khon_thanpha:    { slot: 'helm',      bonus: { MAIN: 6, mpMul: 0.08 },      flavor: 'เสียงพิณสวรรค์ปลุกปัญญา' },
  kinnaree_ngao:   { slot: 'boots',     bonus: { eva: 12, MAIN: 4 },          flavor: 'ปีกเงาจันทรคราส' },
  thep_asura:      { slot: 'weapon',    bonus: { dmg: 42, MAIN: 4 },          flavor: 'กระบองเพชรอสูรกบฏ' },
  yak_thawarn:     { slot: 'armor',     bonus: { def: 28, hp: 420 },          flavor: 'ประตูสวรรค์ไม่เคยแตก' },
  krut_dam:        { slot: 'gloves',    bonus: { crit: 0.05, critDmg: 0.2 },  flavor: 'กรงเล็บครุฑดำ' },
  nak_sumeru:      { slot: 'armor',     bonus: { VIT: 8, hpMul: 0.1 },        flavor: 'เกล็ดหินพันเขา' },
  asura_fire:      { slot: 'weapon',    bonus: { dmg: 30, dmgMul: 0.08 },     flavor: 'ไฟกัลป์เผาจักรวาล' },
  rakkhasa:        { slot: 'accessory', bonus: {}, econ: { exp: 10, drop: 8 }, flavor: 'ทัพรากษสไม่เคยกลับมือเปล่า' },
  phaya_yom:       { slot: 'helm',      bonus: { MAIN: 8, dmgMul: 0.08 },     flavor: 'มงกุฎคำพิพากษาแห่งยมโลก' },
  phra_rahu:       { slot: 'belt',      bonus: { VIT: 8, def: 18, hpMul: 0.1 }, flavor: 'เงาที่กลืนดวงจันทร์' },
  phaya_mara:      { slot: 'weapon',    bonus: { MAIN: 7, dmgMul: 0.18, crit: 0.03 }, flavor: 'มารผจญแห่งจักรวาล' },
};

/** อาชีพที่ใช้เวท (dmg → MATK) */
const MAGIC_JOB = new Set(['mage', 'healer']);
/**
 * แปลงคีย์กลางเป็นค่าพลังของอาชีพที่ถืออยู่ (ทุกอาชีพได้ค่าเท่ากัน)
 * dmg → atk/matk · dmgMul → patkMul/matkMul · MAIN → STR / INT / (ธนู: STR ครึ่ง DEX ครึ่ง)
 */
export function jobBonus(b = {}, job = 'swordman') {
  const out = {}, add = (k, v) => { if (v) out[k] = (out[k] || 0) + v; };
  const magic = MAGIC_JOB.has(job);
  for (const [k, v] of Object.entries(b)) {
    if (k === 'dmg') add(magic ? 'matk' : 'atk', v);
    else if (k === 'dmgMul') add(magic ? 'matkMul' : 'patkMul', v);
    else if (k === 'MAIN') {
      if (magic) add('INT', v);
      else if (job === 'archer') { add('STR', Math.ceil(v / 2)); add('DEX', Math.floor(v / 2)); }
      else add('STR', v);
    } else add(k, v);
  }
  return out;
}

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

const STAT_TH = { STR: 'STR', DEX: 'DEX', INT: 'INT', CRI: 'CRI', VIT: 'VIT', hp: 'HP', mp: 'MP', atk: 'ATK', matk: 'MATK', def: 'DEF', acc: 'แม่นยำ', eva: 'หลบ', dmg: 'พลังโจมตี', MAIN: 'สถานะหลัก' };
const PCT_TH = { crit: 'คริติคอล', critDmg: 'แรงคริ', hpMul: 'HP', mpMul: 'MP', patkMul: 'ATK', matkMul: 'MATK', dmgMul: 'พลังโจมตี' };
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
  const job = c?.appearance?.job || c?.path || 'swordman';
  for (const cd of activeCards(c)) add(jobBonus(cd.bonus, job), cd.econ);   // ทุกอาชีพได้ค่าเท่ากัน (แปลงตามอาวุธที่ถือ)
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
  return rng() < base * cardDropMul(dropMul) ? id : null;   // dropMul (พร+การ์ด) ถูกหน่วงลงด้วย cardDropMul
}

/** ตรวจ/ซ่อมข้อมูลการ์ดในเซฟ */
export function fixCards(c) {
  const cards = c.cards && typeof c.cards === 'object' ? c.cards : {};
  c.cards = {};
  const back = [];                                               // การ์ดที่ช่องไม่ตรงชนิดแล้ว (ปรับช่องการ์ด) → คืนเข้ากระเป๋า ไม่หาย
  for (const slot of Object.keys(SLOT_CARD)) {
    const list = Array.isArray(cards[slot]) ? cards[slot] : [];
    c.cards[slot] = [];
    for (const id of list) {
      if (!CARD_BY_ID[id]) continue;
      if (CARD_BY_ID[id].slot === SLOT_CARD[slot] && c.cards[slot].length < 2) c.cards[slot].push(id); else back.push(id);
    }
  }
  if (back.length) {
    if (!Array.isArray(c.inventory)) c.inventory = [];
    for (const id of back) { const st = c.inventory.find((x) => x.id === id); if (st) st.qty = (st.qty || 0) + 1; else c.inventory.push({ id, qty: 1 }); }
    c.cardsReturned = (c.cardsReturned || 0) + back.length;       // แจ้งผู้เล่นตอนเข้าเกม
  }
  const book = c.cardBook && typeof c.cardBook === 'object' ? c.cardBook : {};
  c.cardBook = {};
  for (const [id, n] of Object.entries(book)) if (CARD_BY_ID[id]) c.cardBook[id] = Math.max(1, Math.floor(+n || 1));
  return c;
}
