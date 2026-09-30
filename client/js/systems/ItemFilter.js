// ============================================================
//  ItemFilter – ตัวกรอง/ค้นหา/เรียงไอเทม "มาตรฐานเดียว" ใช้ทุกหน้าต่าง (กระเป๋า · ร้านซื้อ/ขาย · เทรด)
//  ▸ หมวด (ชิป) → ช่องสวมใส่ · อาชีพฉัน · ใส่ได้ตอนนี้ · ▲ ดีกว่าที่ใส่ · ความหายาก · เรียง · ค้นหา
//  ▸ ค่าพลังรวม (CP) ที่เปลี่ยนเมื่อสวม/ใส่การ์ด → ลูกศร ▲ และปุ่ม "ใส่ชุดที่ดีที่สุด"
// ============================================================
import { ITEMS, sellPrice, WTYPE_JOB } from '/shared/data/items.js';
import { combatPower } from '/shared/character.js';
import { SLOT_TH, GEAR_TYPES, FLASK_SLOTS } from '/shared/data/slots.js';
import { CARD_BY_ID, SLOT_CARD, socketCount } from '/shared/data/cards.js';
import { JOBS, JOB_IDS } from '/shared/data/classes.js';
import { uiIcon } from './util.js';
import { askText } from './Dialog.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------------- ความหายาก (สีขอบ) ----------------
/** 1 ธรรมดา · 2 ดี · 3 หายาก · 4 มหากาพย์ · 5 ตำนาน · 6 ขอบแดง (ไล่ตามเลเวลของ: <20 · 20–49 · 50–89 · 90+) */
export const baseRarity = (it) => (!it ? 0 : it.red ? 6 : it.legend ? 5 : GEAR_TYPES.includes(it.type)
  ? ((it.lv || 1) >= 90 ? 4 : (it.lv || 1) >= 50 ? 3 : (it.lv || 1) >= 20 ? 2 : 1)
  : it.type === 'card' ? 3 : 0);
/** ของมีค่าสุ่ม 1 บรรทัด = หายาก (3) · 2+ = มหากาพย์ (4) */
export const rarityOf = (it) => Math.max(baseRarity(it), it?.affixN ? (it.affixN >= 2 ? 4 : 3) : 0);
export const RARITY_TH = ['—', 'ธรรมดา', 'ดี', 'หายาก', 'มหากาพย์', 'ตำนาน', 'ขอบแดง'];

// ---------------- หมวด ----------------
const USE_T = ['consumable', 'home', 'food', 'reset', 'reskill', 'rename', 'offering', 'skin'];
export const KINDS = {
  all: ['ทั้งหมด', () => true],
  gear: ['สวมใส่', (it) => GEAR_TYPES.includes(it.type) || it.type === 'flask'],
  use: ['ใช้ได้', (it) => USE_T.includes(it.type)],
  card: ['การ์ด', (it) => it.type === 'card'],
  etc: ['วัตถุดิบ', (it) => ['material', 'herb', 'fish'].includes(it.type)],
};
/** ช่องสวมใส่ (ตัวกรองละเอียด) */
export const SLOT_F = { any: 'ทุกช่อง', weapon: 'อาวุธ', helm: 'หมวก', armor: 'ชุดเกราะ', gloves: 'ถุงมือ', boots: 'รองเท้า', belt: 'เข็มขัด', accessory: 'เครื่องประดับ', flask: 'ขวดยา' };
export const SORTS = { type: 'ประเภท', cp: 'ค่าพลัง ▲', rar: 'ความหายาก', lv: 'เลเวลของ', price: 'มูลค่า', name: 'ชื่อ' };
const ORDER = ['weapon', 'helm', 'armor', 'gloves', 'boots', 'belt', 'accessory', 'flask', 'card', 'home', 'consumable', 'food', 'reset', 'reskill', 'rename', 'offering', 'herb', 'fish', 'material', 'skin'];

export const newFilter = (o = {}) => ({ kind: 'all', slot: 'any', job: '', wear: false, better: false, rar: 0, sort: 'type', q: '', notMine: false, worse: false, rarMax: 0, lvBelow: 0, ...o });

// ---------------- จำตัวกรอง (ต่อหน้าต่าง) + ชุดตัวกรองที่บันทึก (ใช้ในแท็บขาย) ----------------
const LS = { get: (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* */ } } };
const KEEP = ['kind', 'slot', 'job', 'wear', 'better', 'rar', 'sort', 'notMine', 'worse', 'rarMax', 'lvBelow'];   // ไม่จำคำค้นหา
const pick = (f) => Object.fromEntries(KEEP.map((k) => [k, f[k]]));
/** ตัวกรองของหน้าต่าง key (โหลดค่าที่ใช้ครั้งล่าสุด) */
export const loadFilter = (key, def = {}) => newFilter({ ...def, ...LS.get('tn_if_' + key, {}), q: '' });
export const saveFilter = (key, f) => LS.set('tn_if_' + key, pick(f));
/** ชุดตัวกรองที่ผู้เล่นตั้งชื่อไว้ { name: filter } */
export const filterPresets = () => LS.get('tn_if_presets', {});
export const savePreset = (name, f) => { const all = filterPresets(); all[name] = pick(f); LS.set('tn_if_presets', all); };
export const deletePreset = (name) => { const all = filterPresets(); delete all[name]; LS.set('tn_if_presets', all); };
export const LV_BELOW = [0, 10, 20, 30, 40, 50, 70, 90, 120];

// ---------------- ค่าพลังเมื่อสวม ----------------
const jobFor = (c, eq) => WTYPE_JOB[ITEMS[eq.weapon]?.wtype] || c.appearance?.job || 'swordman';
const cpWith = (c, eq, cards = c.cards) => { try { return combatPower({ ...c, equipment: eq, cards, appearance: { ...c.appearance, job: jobFor(c, eq) } }); } catch { return 0; } };
/** ช่องที่จะลง (ตามกติกา economy.equip) · accessory → ช่องที่ได้ประโยชน์มากกว่า */
export function slotFor(c, it) {
  if (!it) return null;
  if (it.type === 'accessory') { if (!c.equipment.accessory) return 'accessory'; if (!c.equipment.accessory2) return 'accessory2'; return 'accessory'; }
  if (it.type === 'flask') { const same = FLASK_SLOTS.find((s) => ITEMS[c.equipment[s]]?.flask?.kind === it.flask?.kind); return FLASK_SLOTS.find((s) => !c.equipment[s]) || same || 'flask'; }
  return SLOT_TH[it.type] ? it.type : null;
}
/** สวมได้ไหม (เลเวลถึง) */
export const canWear = (c, it) => !!it && (GEAR_TYPES.includes(it.type) || it.type === 'flask') && !(it.lv && c.level < it.lv);
/** สายที่เล่นอยู่ = แนวอาวุธที่ถือ (ถือไม้เท้าสมุนไพร → หมอยา แม้เคยฟาร์มด้วยอาวุธอื่น) */
export const curJob = (c) => c.appearance?.job || c.path || 'swordman';
/** ของใช้ได้กับอาชีพ j ไหม (ของไม่ระบุสาย = ใช้ได้ทุกสาย) */
export const forJob = (it, j) => (it?.wtype && WTYPE_JOB[it.wtype] ? WTYPE_JOB[it.wtype] === j : !it?.job || it.job === j);   // อาวุธดูจากแนวอาวุธก่อน (อาวุธเริ่มต้นไม่มี job)
/** ของสายที่เล่นอยู่ (อาวุธต้องแนวเดียวกับที่ถือ → ▲/ใส่ชุดที่ดีที่สุด ไม่พาเปลี่ยนสาย) */
export const isMine = (c, it) => forJob(it, curJob(c));

/** แคช CP ต่อรอบวาด (คีย์ = ทุกอย่างที่ combatPower ใช้: อุปกรณ์ · เลเวล/สถานะ · การ์ด/สมุดสะสม · พรสวรรค์ · ความชำนาญอาวุธ · อาวุธที่ถือ) */
let cache = { sig: '', base: 0, map: new Map() };
const sigOf = (c) => JSON.stringify([c.equipment, c.level, c.stats, c.enhance, c.cards, c.passives, c.path, c.wm, c.appearance?.job, Object.keys(c.cardBook || {}).length]);
function prep(c) { const s = sigOf(c); if (s !== cache.sig) cache = { sig: s, base: cpWith(c, c.equipment), map: new Map() }; }
export const baseCp = (c) => { prep(c); return cache.base; };
/** CP ที่เปลี่ยนถ้าสวมชิ้นนี้ (null = สวมไม่ได้/ไม่ใช่อุปกรณ์) · accessory ลองทั้ง 2 ช่องเอาที่ดีกว่า */
export function cpGain(c, id) {
  const it = ITEMS[id];
  if (!it || it.type === 'flask' || !GEAR_TYPES.includes(it.type)) return null;
  prep(c);
  if (cache.map.has(id)) return cache.map.get(id);
  const slots = it.type === 'accessory' ? ['accessory', 'accessory2'] : [it.type];
  let best = -Infinity;
  for (const s of slots) { if (c.equipment[s] === id) { best = Math.max(best, 0); continue; } best = Math.max(best, cpWith(c, { ...c.equipment, [s]: id }) - cache.base); }
  cache.map.set(id, best);
  return best;
}
/** ช่องที่ใส่แล้วได้ CP มากสุด (accessory) */
export function bestSlotFor(c, id) {
  const it = ITEMS[id];
  if (it?.type !== 'accessory') return slotFor(c, it);
  const a = cpWith(c, { ...c.equipment, accessory: id }), b = cpWith(c, { ...c.equipment, accessory2: id });
  return b > a ? 'accessory2' : 'accessory';
}
/** CP ที่เปลี่ยนถ้าใส่การ์ดใบนี้ในช่อง slot */
export function cardGain(c, slot, cardId) {
  const cur = c.cards?.[slot] || [];
  if (!c.equipment[slot] || cur.length >= socketCount(slot, c.enhance?.[slot] || 0)) return null;
  return cpWith(c, c.equipment, { ...(c.cards || {}), [slot]: [...cur, cardId] }) - baseCp(c);
}
/** ช่องการ์ดว่างที่ดีที่สุดสำหรับการ์ดใบนี้ → { slot, gain } | null */
export function bestCardSlot(c, cardId) {
  const cd = CARD_BY_ID[cardId]; if (!cd) return null;
  let best = null;
  for (const s of Object.keys(SLOT_CARD)) {
    if (SLOT_CARD[s] !== cd.slot) continue;
    const g = cardGain(c, s, cardId);
    if (g != null && (!best || g > best.gain)) best = { slot: s, gain: g };
  }
  return best;
}
/**
 * ชุดที่ดีที่สุดจากของในกระเป๋า + ที่ใส่อยู่ (ไล่ทีละช่องแบบ greedy 2 รอบ · เฉพาะที่เลเวลถึง)
 * → [{ slot, id }] รายการที่ต้องเปลี่ยน
 */
export function bestLoadout(c) {
  const eq = { ...c.equipment };
  const pool = c.inventory.map((s) => s.id).filter((id) => canWear(c, ITEMS[id]) && ITEMS[id].type !== 'flask' && isMine(c, ITEMS[id]));   // เฉพาะสายที่ถืออยู่
  const used = new Set();
  for (let pass = 0; pass < 2; pass++) {
    for (const slot of ['weapon', 'armor', 'helm', 'gloves', 'boots', 'belt', 'accessory', 'accessory2']) {
      const type = slot === 'accessory2' ? 'accessory' : slot;
      let bestId = eq[slot], bestCp = cpWith(c, eq);
      for (const id of pool) {
        if (ITEMS[id].type !== type || used.has(id) || Object.values(eq).includes(id)) continue;
        const v = cpWith(c, { ...eq, [slot]: id });
        if (v > bestCp) { bestCp = v; bestId = id; }
      }
      if (bestId !== eq[slot]) { if (eq[slot]) used.delete(eq[slot]); eq[slot] = bestId; used.add(bestId); }
    }
  }
  return Object.keys(eq).filter((s) => eq[s] !== c.equipment[s] && eq[s]).map((s) => ({ slot: s, id: eq[s] }));
}

// ---------------- กรอง + เรียง ----------------
/** list = [{ id, qty }] (กองในกระเป๋า) หรือ [id] · คืนรายการเดิมที่ผ่านตัวกรอง (เรียงแล้ว) */
export function applyFilter(c, list, f, { price = sellPrice } = {}) {
  const idOf = (x) => (typeof x === 'string' ? x : x.id);
  const q = (f.q || '').trim().toLowerCase();
  const out = list.filter((x) => {
    const it = ITEMS[idOf(x)]; if (!it) return false;
    if (!KINDS[f.kind]?.[1](it)) return false;
    if (f.slot !== 'any' && it.type !== f.slot) return false;
    const fj = f.job === 'mine' || (f.job == null && f.mine) ? curJob(c) : f.job;
    if (fj && !forJob(it, fj)) return false;
    if (f.wear && !canWear(c, it)) return false;
    if (f.rar && rarityOf(it) < f.rar) return false;
    if (f.better && !(canWear(c, it) && isMine(c, it) && (cpGain(c, idOf(x)) || 0) > 0)) return false;   // ดีกว่าที่ใส่ = เฉพาะของสายที่เล่นอยู่
    if (f.notMine && !(GEAR_TYPES.includes(it.type) && !isMine(c, it))) return false;                     // อุปกรณ์ของสายอื่น
    if (f.worse) { const g = cpGain(c, idOf(x)); if (g == null || g > 0 || !isMine(c, it) || Object.values(c.equipment || {}).includes(idOf(x))) return false; }   // สายฉัน แต่ใส่แล้วไม่ดีขึ้น
    if (f.rarMax && rarityOf(it) > f.rarMax) return false;
    if (f.lvBelow && !((it.lv || 1) < f.lvBelow)) return false;
    if (q && !it.nameTh.toLowerCase().includes(q) && !(it.affixes || []).some((a) => a.text?.toLowerCase().includes(q))) return false;
    return true;
  });
  const A = (x) => ITEMS[idOf(x)];
  const cmp = {
    type: (a, b) => ORDER.indexOf(A(a).type) - ORDER.indexOf(A(b).type) || (A(b).lv || 0) - (A(a).lv || 0) || A(a).nameTh.localeCompare(A(b).nameTh, 'th'),
    cp: (a, b) => (cpGain(c, idOf(b)) ?? -1e9) - (cpGain(c, idOf(a)) ?? -1e9),
    rar: (a, b) => rarityOf(A(b)) - rarityOf(A(a)) || (A(b).lv || 0) - (A(a).lv || 0),
    lv: (a, b) => (A(b).lv || 0) - (A(a).lv || 0),
    price: (a, b) => price(idOf(b)) * (b.qty || 1) - price(idOf(a)) * (a.qty || 1),
    name: (a, b) => A(a).nameTh.localeCompare(A(b).nameTh, 'th'),
  }[f.sort] || (() => 0);
  return out.sort(cmp);
}

// ---------------- แถบตัวกรอง (HTML + ผูกเหตุการณ์) ----------------
/**
 * @param f สถานะตัวกรอง · @param list รายการทั้งหมด (ไว้นับจำนวนต่อหมวด)
 * @param o { kinds: [...หมวดที่แสดง], gear: true = แถวละเอียด (ช่อง/อาชีพ/ใส่ได้/ดีกว่า/หายาก/เรียง), key: ชื่อ data-attr }
 */
export function filterBarHtml(c, f, list = [], o = {}) {
  const kinds = o.kinds || Object.keys(KINDS);
  const idOf = (x) => (typeof x === 'string' ? x : x.id);
  const n = (k) => list.filter((x) => ITEMS[idOf(x)] && KINDS[k][1](ITEMS[idOf(x)])).length;
  const chip = (k, on, label, title = '') => `<button type="button" class="if-chip${on ? ' on' : ''}" data-if="${k}"${title ? ` title="${title}"` : ''}>${label}</button>`;
  const showGear = o.gear !== false && (o.pop || f.kind === 'all' || f.kind === 'gear');
  const cj = curJob(c), job = JOBS[cj], fj = f.job ?? (f.mine ? 'mine' : '');
  const kindRow = `${kinds.map((k) => `<button type="button" class="if-kind${f.kind === k ? ' on' : ''}" data-ifk="${k}">${KINDS[k][0]}<small>${n(k)}</small></button>`).join('')}
      <input type="search" class="if-q" placeholder="🔍 ค้นหาชื่อ/ค่าสุ่ม" value="${esc(f.q || '')}">`;
  // แบบกะทัดรัด (แท็บขาย): แถวเดียว หมวด + ค้นหา + ปุ่มตัวกรอง · ตัวกรองละเอียดอยู่ในแผงป๊อปอัป · ตัวกรองที่เปิดอยู่เป็นชิปกดปิดได้
  if (o.pop) {
    const on = activeFilters(c, f);
    return `<div class="if-bar if-compact">
    <div class="if-row if-kinds">${kindRow}
      <button type="button" class="if-popbtn${f._pop || on.length ? ' on' : ''}" data-ifpop aria-expanded="${f._pop ? 'true' : 'false'}">⚙ ตัวกรอง${on.length ? `<b>${on.length}</b>` : ''}</button></div>
    ${on.length ? `<div class="if-row if-on"><span class="if-lbl">กรองอยู่:</span>${on.map((a) => `<button type="button" class="if-onchip" data-ifoff="${a.k}" title="เอาตัวกรองนี้ออก">${a.label} ✕</button>`).join('')}<button type="button" class="if-onclear" data-ifclear>ล้างทั้งหมด</button></div>` : ''}
    <div class="if-pop"${f._pop ? '' : ' hidden'}>${gearRowHtml(c, f, job, fj, chip)}${o.sell ? sellRowHtml(f) : ''}
      <div class="if-popfoot"><button type="button" class="btn sm primary" data-ifpop>เสร็จ</button></div></div>
  </div>`;
  }
  return `<div class="if-bar">
    <div class="if-row if-kinds">${kindRow}</div>
    ${showGear ? `<div class="if-row if-gear">
      <select class="if-slot" title="ช่องสวมใส่">${Object.entries(SLOT_F).map(([k, l]) => `<option value="${k}"${f.slot === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
      <select class="if-job${fj ? ' on' : ''}" title="ของสายอาชีพ (ของที่ไม่ระบุสายแสดงทุกสาย)"><option value="">ทุกอาชีพ</option><option value="mine"${fj === 'mine' ? ' selected' : ''}>${job?.icon || '👤'} สายที่ถืออยู่ (${job?.nameTh || ''})</option>${JOB_IDS.map((j) => `<option value="${j}"${fj === j ? ' selected' : ''}>${JOBS[j].icon} ${JOBS[j].nameTh}</option>`).join('')}</select>
      ${chip('wear', f.wear, '✔ ใส่ได้ตอนนี้', 'เลเวลถึงแล้ว')}
      ${chip('better', f.better, '<b class="up">▲</b> ดีกว่าที่ใส่', `ของสาย${job?.nameTh || 'ที่เล่นอยู่'}ที่ใส่แล้วค่าพลังรวมเพิ่ม`)}
      <select class="if-rar" title="ความหายากขั้นต่ำ">${RARITY_TH.map((l, i) => (i === 0 ? `<option value="0">ทุกระดับ</option>` : `<option value="${i}"${f.rar === i ? ' selected' : ''}>${l}+</option>`)).join('')}</select>
      <select class="if-sort" title="เรียงตาม">${Object.entries(SORTS).map(([k, l]) => `<option value="${k}"${f.sort === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
    </div>` : o.sortRow === false ? '' : `<div class="if-row if-gear slim"><select class="if-sort" title="เรียงตาม">${Object.entries(SORTS).filter(([k]) => k !== 'cp').map(([k, l]) => `<option value="${k}"${f.sort === k ? ' selected' : ''}>${l}</option>`).join('')}</select></div>`}
    ${o.sell ? sellRowHtml(f) : ''}
  </div>`;
}
/** แถวตัวกรองละเอียด (ช่อง · อาชีพ · ใส่ได้ · ดีกว่า · หายาก · เรียง) สำหรับแผงป๊อปอัป */
function gearRowHtml(c, f, job, fj, chip) {
  return `<div class="if-row if-gear">
      <select class="if-slot" title="ช่องสวมใส่">${Object.entries(SLOT_F).map(([k, l]) => `<option value="${k}"${f.slot === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
      <select class="if-job${fj ? ' on' : ''}" title="ของสายอาชีพ (ของที่ไม่ระบุสายแสดงทุกสาย)"><option value="">ทุกอาชีพ</option><option value="mine"${fj === 'mine' ? ' selected' : ''}>${job?.icon || '👤'} สายที่ถืออยู่ (${job?.nameTh || ''})</option>${JOB_IDS.map((j) => `<option value="${j}"${fj === j ? ' selected' : ''}>${JOBS[j].icon} ${JOBS[j].nameTh}</option>`).join('')}</select>
      ${chip('wear', f.wear, '✔ ใส่ได้ตอนนี้', 'เลเวลถึงแล้ว')}
      ${chip('better', f.better, '<b class="up">▲</b> ดีกว่าที่ใส่', `ของสาย${job?.nameTh || 'ที่เล่นอยู่'}ที่ใส่แล้วค่าพลังรวมเพิ่ม`)}
      <select class="if-rar" title="ความหายากขั้นต่ำ">${RARITY_TH.map((l, i) => (i === 0 ? `<option value="0">ทุกระดับ</option>` : `<option value="${i}"${f.rar === i ? ' selected' : ''}>${l}+</option>`)).join('')}</select>
      <select class="if-sort" title="เรียงตาม">${Object.entries(SORTS).map(([k, l]) => `<option value="${k}"${f.sort === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
    </div>`;
}
/** ตัวกรองละเอียดที่เปิดอยู่ → [{ k, label }] (ไว้โชว์เป็นชิป · ไม่นับหมวด/คำค้น/การเรียง) */
export function activeFilters(c, f) {
  const fj = f.job ?? (f.mine ? 'mine' : '');
  return [
    f.slot && f.slot !== 'any' && { k: 'slot', label: `ช่อง${SLOT_F[f.slot] || ''}` },
    fj && { k: 'job', label: fj === 'mine' ? `สาย${JOBS[curJob(c)]?.nameTh || 'ฉัน'}` : `สาย${JOBS[fj]?.nameTh || fj}` },
    f.wear && { k: 'wear', label: '✔ ใส่ได้ตอนนี้' },
    f.better && { k: 'better', label: '▲ ดีกว่าที่ใส่' },
    f.rar && { k: 'rar', label: `${RARITY_TH[f.rar]}ขึ้นไป` },
    f.notMine && { k: 'notMine', label: '↔ ไม่ใช่สายฉัน' },
    f.worse && { k: 'worse', label: '▼ ไม่ดีกว่าที่ใส่' },
    f.rarMax && { k: 'rarMax', label: `ไม่เกิน${RARITY_TH[f.rarMax]}` },
    f.lvBelow && { k: 'lvBelow', label: `เลเวลต่ำกว่า ${f.lvBelow}` },
  ].filter(Boolean);
}
const OFF = { slot: 'any', job: '', wear: false, better: false, rar: 0, notMine: false, worse: false, rarMax: 0, lvBelow: 0 };
/** แถวตัวกรองสำหรับขาย (PC): สายอื่น · แย่กว่าที่ใส่ · หายากไม่เกิน · เลเวลต่ำกว่า · ชุดตัวกรองที่บันทึก */
function sellRowHtml(f) {
  const chip = (k, on, label, title) => `<button type="button" class="if-chip${on ? ' on' : ''}" data-if="${k}" title="${title}">${label}</button>`;
  const pr = filterPresets();
  return `<div class="if-row if-sell">
      <span class="if-lbl">ขาย:</span>
      ${chip('notMine', f.notMine, '↔ ไม่ใช่สายฉัน', 'อุปกรณ์ของอาชีพอื่น')}
      ${chip('worse', f.worse, '<b class="down">▼</b> ไม่ดีกว่าที่ใส่', 'ของสายที่เล่นอยู่ แต่ใส่แล้วค่าพลังไม่เพิ่ม')}
      <select class="if-rarmax${f.rarMax ? ' on' : ''}" title="ความหายากสูงสุด">${RARITY_TH.map((l, i) => (i === 0 ? '<option value="0">หายากไม่จำกัด</option>' : `<option value="${i}"${f.rarMax === i ? ' selected' : ''}>ไม่เกิน${l}</option>`)).join('')}</select>
      <select class="if-lvb${f.lvBelow ? ' on' : ''}" title="เลเวลของต่ำกว่า">${LV_BELOW.map((v) => `<option value="${v}"${f.lvBelow === v ? ' selected' : ''}>${v ? `เลเวลต่ำกว่า ${v}` : 'ทุกเลเวล'}</option>`).join('')}</select>
      <span class="if-sp"></span>
      <select class="if-preset" title="ชุดตัวกรองที่บันทึกไว้"><option value="">📁 ชุดตัวกรองที่บันทึก…</option>${Object.keys(pr).map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join('')}</select>
      <button type="button" class="if-chip" data-ifsave title="บันทึกตัวกรองตอนนี้เป็นชุดใหม่">💾 บันทึก</button>
      ${Object.keys(pr).length ? '<button type="button" class="if-chip" data-ifdel title="ลบชุดตัวกรองที่เลือก">🗑</button>' : ''}
      <button type="button" class="if-chip" data-ifclear title="ล้างตัวกรองทั้งหมด">↺ ล้าง</button>
    </div>`;
}
/** ผูกเหตุการณ์ของแถบตัวกรอง (root = กล่องที่มี .if-bar) · redraw() = วาดใหม่ (ช่องค้นหาคงโฟกัสให้) */
export function bindFilterBar(root, f, redraw, scene) {
  const bar = root.querySelector('.if-bar'); if (!bar) return;
  const click = () => scene?.sfx?.play('click');
  bar.querySelectorAll('[data-ifk]').forEach((b) => (b.onclick = () => { f.kind = b.dataset.ifk; if (f.kind !== 'all' && f.kind !== 'gear') f.slot = 'any'; click(); redraw(); }));
  bar.querySelectorAll('[data-if]').forEach((b) => (b.onclick = () => { f[b.dataset.if] = !f[b.dataset.if]; click(); redraw(); }));
  const sel = (cls, key, num = false) => { const e = bar.querySelector(cls); if (e) e.onchange = () => { f[key] = num ? +e.value : e.value; if (key === 'slot' && e.value !== 'any' && f.kind !== 'gear') f.kind = 'gear'; click(); redraw(); }; };
  sel('.if-slot', 'slot'); sel('.if-job', 'job'); sel('.if-rar', 'rar', true); sel('.if-sort', 'sort'); sel('.if-rarmax', 'rarMax', true); sel('.if-lvb', 'lvBelow', true);
  const ps = bar.querySelector('.if-preset');
  if (ps) ps.onchange = () => { const p = filterPresets()[ps.value]; if (p) { Object.assign(f, newFilter(), p, { q: '' }); f.preset = ps.value; click(); redraw(); } };
  if (ps && f.preset) ps.value = f.preset;
  bar.querySelector('[data-ifsave]')?.addEventListener('click', async () => {
    const name = await askText({ title: 'ตั้งชื่อชุดตัวกรอง', icon: '💾', text: 'ใช้ชื่อเดิม = บันทึกทับ', input: f.preset || 'ขยะของฉัน' });
    if (!name) return; savePreset(name.slice(0, 24), f); f.preset = name.slice(0, 24); click(); redraw();
  });
  bar.querySelector('[data-ifdel]')?.addEventListener('click', () => { const n = ps?.value || f.preset; if (!n) return; deletePreset(n); f.preset = ''; click(); redraw(); });
  bar.querySelectorAll('[data-ifclear]').forEach((b) => b.addEventListener('click', () => { Object.assign(f, newFilter({ sort: f.sort, kind: f.kind, q: f.q }), { preset: '' }); click(); redraw(); }));
  bar.querySelectorAll('[data-ifpop]').forEach((b) => (b.onclick = () => { f._pop = !f._pop; click(); redraw(); }));
  bar.querySelectorAll('[data-ifoff]').forEach((b) => (b.onclick = () => { const k = b.dataset.ifoff; f[k] = OFF[k]; if (k === 'job') f.mine = false; f.preset = ''; click(); redraw(); }));
  const q = bar.querySelector('.if-q');
  if (q) {
    q.addEventListener('keydown', (e) => e.stopPropagation());
    q.addEventListener('focus', () => { if (scene?.input?.keyboard) scene.input.keyboard.enabled = false; });
    q.addEventListener('blur', () => { if (scene?.input?.keyboard) scene.input.keyboard.enabled = true; });
    q.addEventListener('input', () => {
      f.q = q.value; const pos = q.selectionStart; redraw();
      const q2 = root.querySelector('.if-q'); if (q2) { q2.focus(); try { q2.setSelectionRange(pos, pos); } catch { /* */ } }
    });
  }
}

/** ป้าย ▲/▼ มุมช่องไอเทม (CP ที่เปลี่ยนถ้าสวม) */
export function gainBadge(c, id) {
  const it = ITEMS[id];
  if (!canWear(c, it) || it.type === 'flask' || !isMine(c, it)) return '';          // ▲ เฉพาะของสายที่เล่นอยู่
  const g = cpGain(c, id);
  if (g == null || Math.abs(g) < 1) return '';
  return g > 0 ? `<i class="cp-up" title="ใส่แล้วค่าพลังรวม +${g.toLocaleString('en-US')}">▲</i>` : '';
}
/** ข้อความ CP ที่เปลี่ยน (ใช้ในแถบรายละเอียด) */
export function gainText(c, id) {
  const it = ITEMS[id];
  if (!it || !GEAR_TYPES.includes(it.type)) return '';
  const g = cpGain(c, id);
  if (g == null) return '';
  if (it.lv && c.level < it.lv) return `<span class="cp-gain lock">🔒 ต้อง Lv.${it.lv}</span>`;
  if (!g) return '<span class="cp-gain same">⚔ ค่าพลังเท่าเดิม</span>';
  return `<span class="cp-gain ${g > 0 ? 'up' : 'dn'}">⚔ ${g > 0 ? '+' : '−'}${Math.abs(g).toLocaleString('en-US')} ค่าพลังรวม</span>`;
}
export const _icon = uiIcon;
