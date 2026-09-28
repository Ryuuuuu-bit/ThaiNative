// ============================================================
//  ค่าพลังไอเทมแบบอ่านง่าย
//  1) ชื่อค่าพลังภาษาไทย + ไอคอน ชุดเดียวทั้งเกม (fmtStat / statList)
//  2) กล่องรายละเอียดตอนชี้เมาส์ (แบบ PoE): ค่าพื้นฐาน · ค่าสุ่ม · ชุด · ราคา · เทียบของที่ใส่
//  3) สรุปผลจริงต่อตัวละคร (ใส่แล้วดาเมจ/HP/คริ เปลี่ยนเท่าไร) + ป้าย ▲ ▼ ⇄
// ============================================================
import { ITEMS, sellPrice, WTYPE_JOB, baseItemId } from '/shared/data/items.js';
import { getDerived } from '/shared/character.js';
import { JOBS } from '/shared/data/classes.js';
import { SLOT_TH, TYPE_TH, FLASK_SLOTS } from '/shared/data/slots.js';
import { SET_NAME } from '/shared/data/gear.js';
import { ENHANCE } from '/shared/data/village.js';
import { CARD_BY_ID } from '/shared/data/cards.js';
import { itemSources } from '/shared/data/sources.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (v, d = 0) => `${+(v * 100).toFixed(d)}%`;

/** ชื่อ/ไอคอน/รูปแบบตัวเลขของค่าพลังทุกชนิด (ใช้ร่วมทุกหน้าต่าง) */
export const STAT = {
  atk:      { ic: '⚔️', th: 'โจมตี' },
  matk:     { ic: '🔮', th: 'พลังเวทย์' },
  hp:       { ic: '❤️', th: 'HP' },
  mp:       { ic: '💧', th: 'MP' },
  def:      { ic: '🛡️', th: 'ป้องกัน' },
  eva:      { ic: '💨', th: 'หลบหลีก' },
  acc:      { ic: '🎯', th: 'แม่นยำ' },
  crit:     { ic: '💥', th: 'โอกาสคริ', f: (v) => pct(v, 1) },
  critDmg:  { ic: '🔥', th: 'แรงคริ', f: (v) => pct(v) },
  STR:      { ic: '💪', th: 'STR' },
  DEX:      { ic: '🏹', th: 'DEX' },
  INT:      { ic: '📿', th: 'INT' },
  VIT:      { ic: '🪨', th: 'VIT' },
  CRI:      { ic: '⚡', th: 'CRI' },
  patkMul:  { ic: '⚔️', th: 'โจมตีกายภาพ', f: (v) => pct(v) },
  matkMul:  { ic: '🔮', th: 'พลังเวทย์', f: (v) => pct(v) },
  hpMul:    { ic: '❤️', th: 'HP', f: (v) => pct(v) },
  mpMul:    { ic: '💧', th: 'MP', f: (v) => pct(v) },
  flaskPct: { ic: '🧪', th: 'ขวดยาฟื้นเพิ่ม', f: (v) => `${v}%` },
  healMul:  { ic: '💚', th: 'พลังรักษา', f: (v) => pct(v, 1) },
  expMul:   { ic: '📘', th: 'EXP', f: (v) => pct(v) },
  goldMul:  { ic: '🪙', th: 'เงิน', f: (v) => pct(v) },
  dropMul:  { ic: '🎁', th: 'โอกาสดรอป', f: (v) => pct(v) },
};
const ORDER = Object.keys(STAT);
export function fmtStat(k, v, sign = true) {
  const m = STAT[k] || { ic: '•', th: k };
  const n = m.f ? m.f(Math.abs(v)) : Math.abs(+(+v).toFixed(2));
  return `${m.ic} ${m.th} ${sign ? (v < 0 ? '−' : '+') : ''}${n}`;
}
/** รายการค่าพลังเรียงตามลำดับมาตรฐาน */
export function statList(bonus = {}, cls = '') {
  const ix = (k) => { const i = ORDER.indexOf(k); return i < 0 ? 999 : i; };
  return Object.entries(bonus).filter(([, v]) => v).sort((a, b) => ix(a[0]) - ix(b[0]))
    .map(([k, v]) => `<div class="st ${cls}">${fmtStat(k, v)}</div>`).join('');
}

/** แบบบรรทัดเดียว (ร้านค้า/ตีบวก/โบนัสชุด) */
export const inlineStats = (bonus = {}) => Object.entries(bonus).filter(([, v]) => v).map(([k, v]) => fmtStat(k, v)).join(' · ');

// ---------------- ผลต่อค่าพลังจริงของตัวละคร ----------------
const DERIVED = [
  ['dmg', '⚔️', 'ดาเมจเฉลี่ย', true], ['maxHp', '❤️', 'HP'], ['maxMp', '💧', 'MP'], ['def', '🛡️', 'ป้องกัน'],
  ['critRate', '💥', 'โอกาสคริ', false, (v) => pct(v, 1)], ['accuracy', '🎯', 'แม่นยำ'], ['eva', '💨', 'หลบ'],
];
const jobOf = (c, eq) => WTYPE_JOB[ITEMS[eq.weapon]?.wtype] || c.appearance?.job || 'swordman';
function snapshot(c, eq) {
  const job = jobOf(c, eq);
  const d = getDerived({ ...c, equipment: eq, appearance: { ...c.appearance, job } });
  const atk = JOBS[job]?.attack?.kind === 'magic' ? d.matk : d.patk;
  return { ...d, dmg: atk * (1 + d.critRate * (d.critDmg - 1)) };
}
/** ช่องที่ของชิ้นนี้จะลงไป (ตามกติกาเดียวกับ economy.equip) */
export function targetSlot(c, it) {
  if (!it) return null;
  if (it.type === 'accessory') return c.equipment.accessory && !c.equipment.accessory2 ? 'accessory2' : 'accessory';
  if (it.type === 'flask') { const same = FLASK_SLOTS.find((s) => ITEMS[c.equipment[s]]?.flask?.kind === it.flask?.kind); return FLASK_SLOTS.find((s) => !c.equipment[s]) || same || 'flask'; }
  return SLOT_TH[it.type] ? it.type : null;
}
/**
 * ใส่ชิ้นนี้แล้วตัวละครเปลี่ยนอย่างไร → { rows:[{ic,th,d,txt}], verdict:'up'|'down'|'mix'|'same', slot }
 */
export function equipImpact(c, id) {
  const it = ITEMS[id]; const slot = targetSlot(c, it);
  if (!slot || it.type === 'flask' || c.equipment?.[slot] === id) return null;
  const a = snapshot(c, c.equipment), b = snapshot(c, { ...c.equipment, [slot]: id });
  const rows = [];
  for (const [k, ic, th, rel, f] of DERIVED) {
    const d = (b[k] || 0) - (a[k] || 0);
    if (Math.abs(d) < (k === 'critRate' ? 0.0005 : 0.5)) continue;
    const txt = rel && a[k] ? `${d > 0 ? '+' : '−'}${Math.abs(d / a[k] * 100).toFixed(1)}%` : f ? `${d > 0 ? '+' : '−'}${f(Math.abs(d))}` : `${d > 0 ? '+' : '−'}${Math.round(Math.abs(d))}`;
    rows.push({ k, ic, th, d, txt });
  }
  const up = rows.some((r) => r.d > 0), dn = rows.some((r) => r.d < 0);
  return { rows, slot, verdict: up && dn ? 'mix' : up ? 'up' : dn ? 'down' : 'same' };
}
const VERDICT = { up: ['▲', 'ดีขึ้น'], down: ['▼', 'แย่ลง'], mix: ['⇄', 'ได้อย่างเสียอย่าง'], same: ['＝', 'เท่าเดิม'] };
export const verdictBadge = (v) => (v ? `<span class="vb vb-${v}" title="${VERDICT[v][1]}">${VERDICT[v][0]}</span>` : '');
/** สรุปสั้นในแถวกระเป๋า: ป้าย + 3 ค่าที่เปลี่ยนมากสุด */
export function impactLine(c, id) {
  const im = equipImpact(c, id); if (!im) return '';
  if (!im.rows.length) return `<div class="imp">${verdictBadge('same')} ใส่แล้วค่าพลังเท่าเดิม</div>`;
  const top = [...im.rows].sort((x, y) => (y.k === 'dmg') - (x.k === 'dmg') || Math.abs(y.d) - Math.abs(x.d)).slice(0, 3);
  return `<div class="imp">${verdictBadge(im.verdict)} ${c.equipment[im.slot] ? 'แทนของเดิม' : 'ใส่แล้ว'}: ${top.map((r) => `<span class="${r.d > 0 ? 'upv' : 'dnv'}">${r.ic} ${r.th} ${r.txt}</span>`).join(' · ')}</div>`;
}

// ---------------- กล่องรายละเอียด ----------------
const RARE_CLS = (r) => (r ? ` rn${r}` : '');
/** แหล่งที่มา (ได้จากไหน) · แสดง 6 อันดับแรก */
function sourcesBlock(id) {
  let src = [];
  try { src = itemSources(id); } catch { return ''; }
  if (!src.length) return '';
  const top = src.slice(0, 6), more = src.length - top.length;
  return `<div class="tt-sec tt-src"><div class="tt-h">📍 ได้จากที่ไหน</div>${top.map((s) => `<div class="src"><span class="si">${s.ic}</span><span><b>${esc(s.text)}</b>${s.sub ? `<small>${esc(s.sub)}</small>` : ''}</span></div>`).join('')}${more > 0 ? `<div class="src more">…และอีก ${more} แหล่ง</div>` : ''}</div>`;
}
function block(title, body) { return body ? `<div class="tt-sec">${title ? `<div class="tt-h">${title}</div>` : ''}${body}</div>` : ''; }
/** เนื้อหากล่องของไอเทม 1 ชิ้น (slot = ถ้าเป็นของที่ใส่อยู่ จะโชว์ตีบวก/การ์ดของช่องนั้น) */
export function itemCard(c, id, { slot = null, rarityOf = () => 0, title = '' } = {}) {
  const it = ITEMS[id]; if (!it) return '';
  const base = ITEMS[baseItemId(id)] || it;
  const lvBad = it.lv && c.level < it.lv;
  const kind = TYPE_TH[it.type] || { consumable: 'ของใช้', food: 'อาหาร', material: 'วัตถุดิบ', costume: 'ชุดแต่งตัว', card: 'การ์ดผี', home: 'ยันต์', offering: 'ของถวาย', herb: 'สมุนไพร', fish: 'ปลา', skin: 'คัมภีร์' }[it.type] || '';
  const meta = [kind, it.wtype ? `แนว${JOBS[WTYPE_JOB[it.wtype]]?.nameTh || ''}` : '', it.job ? `สาย${JOBS[it.job]?.nameTh || ''}` : '',
    it.lv ? `<span class="${lvBad ? 'bad' : ''}">ต้อง Lv.${it.lv}</span>` : ''].filter(Boolean).join(' · ');
  const enh = slot ? c.enhance?.[slot] || 0 : 0;
  const enhBonus = enh && ENHANCE.bonus[slot] ? ENHANCE.bonus[slot](enh) : null;
  const cards = slot ? (c.cards?.[slot] || []).filter((x) => CARD_BY_ID[x]) : [];
  const fx = it.effect ? Object.entries(it.effect).map(([k, v]) => `<div class="st">${fmtStat(k, v)} ทันที</div>`).join('') : '';
  const fl = it.flask ? `<div class="st">${fmtStat(it.flask.kind, it.flask.heal)} ต่อครั้ง</div><div class="st">🧪 ดื่มได้ ${it.flask.max} ครั้ง · ฆ่าผีเติม · กลับเมืองเต็ม</div>` : '';
  const buff = it.buff ? `<div class="st">✨ ${esc(it.buff.textTh)} (${it.buff.minutes} นาที)</div>` : '';
  return `${title ? `<div class="tt-top">${title}</div>` : ''}
    <div class="tt-name${RARE_CLS(rarityOf(it))}">${esc(it.nameTh)}${enh ? ` <b class="enh t${ENHANCE.auraTier(enh)}">+${enh}</b>` : ''}</div>
    ${meta ? `<div class="tt-meta">${meta}</div>` : ''}
    ${block('', statList(base.bonus) + fx + fl + buff)}
    ${it.affixes?.length ? block('ค่าสุ่ม', it.affixes.map((a) => `<div class="st aff a${Math.min(3, it.affixN)}">◆ ${fmtStat(a.key, a.val)} <small>ขั้น ${'I'.repeat(a.tier)}</small></div>`).join('')) : ''}
    ${enhBonus ? block(`ตีบวก +${enh}`, statList(enhBonus, 'enhs')) : ''}
    ${cards.length ? block('การ์ด', cards.map((x) => `<div class="st cardl">🃏 ${esc(CARD_BY_ID[x].nameTh)}</div>`).join('')) : ''}
    ${it.job && SET_NAME[it.job] && base.lv ? `<div class="tt-set">✦ นับเป็นชิ้นของ${esc(SET_NAME[it.job])}</div>` : ''}
    ${it.desc && !it.effect && !it.flask ? `<div class="tt-desc">${esc(it.desc)}</div>` : ''}
    ${sourcesBlock(id)}
    ${sellPrice(id) ? `<div class="tt-price">ขายได้ ฿${sellPrice(id).toLocaleString()}</div>` : ''}`;
}

/** ตัวจัดการกล่องลอย: ชี้ element ที่มี data-tip-item → แสดง (มีของใส่อยู่ = แสดงคู่เทียบ) */
export class ItemTip {
  constructor(ui, rarityOf) {
    this.ui = ui; this.rarityOf = rarityOf;
    const el = document.createElement('div'); el.id = 'item-tip'; el.className = 'item-tip hidden';
    document.body.appendChild(el); this.el = el; this.cur = null;
    const find = (t) => t?.closest?.('[data-tip-item]');
    document.addEventListener('mouseover', (e) => { const t = find(e.target); if (t && t !== this.cur) this.show(t, e); else if (!t && this.cur) this.hide(); });
    document.addEventListener('mousemove', (e) => { if (this.cur) this.place(e.clientX, e.clientY); });
    for (const ev of ['mousedown', 'wheel', 'keydown']) document.addEventListener(ev, () => this.hide(), { passive: true });
    // มือถือ: แตะค้าง 0.45 วิ = เปิดกล่อง · แตะที่อื่น = ปิด
    let lp = null;
    document.addEventListener('touchstart', (e) => { const t = find(e.target); clearTimeout(lp); if (!t) return this.hide(); const p = e.touches[0]; lp = setTimeout(() => this.show(t, { clientX: p.clientX, clientY: p.clientY }), 450); }, { passive: true });
    document.addEventListener('touchend', () => clearTimeout(lp), { passive: true });
    document.addEventListener('touchmove', () => clearTimeout(lp), { passive: true });
  }
  show(t, e) {
    const c = this.ui.char, id = t.dataset.tipItem, slot = t.dataset.tipSlot || null, it = ITEMS[id];
    if (!c || !it) return this.hide();
    this.cur = t;
    const R = this.rarityOf;
    let html = `<div class="tt-card">${itemCard(c, id, { slot, rarityOf: R, title: slot ? `ใส่อยู่ · ${SLOT_TH[slot]}` : '' })}`;
    const im = slot ? null : equipImpact(c, id);
    if (im) {
      html += im.rows.length
        ? `<div class="tt-imp"><div class="tt-h">${verdictBadge(im.verdict)} ถ้าใส่ชิ้นนี้ (ตัวละครจริง)</div>${im.rows.map((r) => `<div class="st ${r.d > 0 ? 'upv' : 'dnv'}">${r.ic} ${r.th} ${r.txt}</div>`).join('')}</div>`
        : `<div class="tt-imp"><div class="tt-h">${verdictBadge('same')} ใส่แล้วค่าพลังเท่าเดิม</div></div>`;
    }
    html += '</div>';
    const curId = im && c.equipment[im.slot];
    if (curId) html += `<div class="tt-card cur">${itemCard(c, curId, { slot: im.slot, rarityOf: R, title: `ใส่อยู่ตอนนี้ · ${SLOT_TH[im.slot]}` })}</div>`;
    this.el.innerHTML = html;
    this.el.classList.remove('hidden');
    this.place(e.clientX, e.clientY);
  }
  place(x, y) {
    const el = this.el, W = innerWidth, H = innerHeight, r = el.getBoundingClientRect(), g = 16;
    let lx = x + g, ly = y + g;
    if (lx + r.width > W - 6) lx = x - g - r.width;          // ชิดขอบขวา → ไปฝั่งซ้ายของเมาส์
    if (lx < 6) lx = Math.max(6, W - r.width - 6);
    if (ly + r.height > H - 6) ly = Math.max(6, H - r.height - 6);
    el.style.left = `${Math.round(lx)}px`; el.style.top = `${Math.round(ly)}px`;
  }
  hide() { this.cur = null; this.el.classList.add('hidden'); }
}
