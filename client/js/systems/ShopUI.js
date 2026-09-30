// ============================================================
//  ShopUI – หน้าต่างร้าน NPC แบบใหม่ (หัวร้าน + แถบแท็บซ้าย + เนื้อหา 2 ฝั่ง)
//  ▸ ร้านทั่วไป: รายการแบ่งหมวด (ขวดยา/ยากิน/ของใช้/อาวุธ…) + แผงขวา: รายละเอียด · จำนวน · ซื้อ
//  ▸ ครูอาชีพ: ตาราง "เลเวล × ช่องสวมใส่" เห็นทั้งสายในหน้าเดียว · ▲ = ดีกว่าที่ใส่ · ซื้อแล้วใส่เลย
//  ▸ แม่ช้อย: ห้องลองชุด (ลองหลายชิ้นพร้อมกัน → ซื้อที่ยังไม่มีแล้วใส่ทีเดียว)
//  ▸ ลุงดำ ตีบวก: วงเตาตีตรงกลาง + รายการช่องสวมใส่ด้านขวา
//  ▸ ครัว/ปรุงยา/สร้างอุปกรณ์: การ์ดสูตร (วัตถุดิบ มี/ต้องใช้) + แผงขวา: จำนวน · ค่าแรง · ทำ
// ============================================================
import { ITEMS, SHOPS } from '/shared/data/items.js';
import { JOBS } from '/shared/data/classes.js';
import { ENHANCE } from '/shared/data/village.js';
import { craftList, canCraft } from '/shared/economy.js';
import { SLOT_TH, ENH_SLOTS, FLASK_SLOTS, GEAR_TYPES, TYPE_TH } from '/shared/data/slots.js';
import { itemIcon, uiIcon } from './util.js';
import { inlineStats, impactLine, STAT } from './ItemTip.js';
import { cpGain, canWear, isMine, gainText } from './ItemFilter.js';
import { HeroView } from './HeroPreview.js';
import { AURA_TH } from '../gfx/Aura.js';
import * as Inv from './Inventory.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Math.round(n || 0).toLocaleString('en-US');
const FKEY = { flask: 'Q', flask2: 'E' };
const COS_TH = { outfit: 'ชุด', head: 'ศีรษะ', face: 'ใบหน้า', back: 'หลัง' };
const MATRIX_SLOTS = ['weapon', 'armor', 'accessory', 'helm', 'gloves', 'boots', 'belt'];

/** หมวดรายการในร้านทั่วไป */
const GROUPS = [
  ['flask', 'ขวดยา', 'ใส่ช่อง Q / E · ดื่มได้หลายครั้ง · ฆ่าผีเติมกลับ'],
  ['use', 'ยากิน', 'ใช้ครั้งเดียว · ซื้อเป็นกอง'],
  ['food', 'อาหาร', 'กินแล้วได้บัฟชั่วคราว'],
  ['weapon', 'อาวุธ', 'อาวุธฝึก/อาวุธเริ่มต้นทุกแนว'],
  ['gear', 'เครื่องราง · เครื่องประดับ', 'ใส่ช่องเครื่องประดับ/ชุด'],
  ['mat', 'วัตถุดิบ', 'ใช้ตีบวก/สร้างอุปกรณ์'],
  ['util', 'ของใช้', 'วาร์ป · เปลี่ยนชื่อ · รีแต้ม'],
];
const groupOf = (it) => it.type === 'flask' ? 'flask' : it.type === 'consumable' ? 'use' : it.type === 'food' ? 'food' : it.type === 'weapon' ? 'weapon'
  : GEAR_TYPES.includes(it.type) || it.type === 'costume' ? 'gear' : it.type === 'material' || it.type === 'yant' ? 'mat' : 'util';

/** บรรทัดผลของไอเทม (สั้น) */
function effLine(it) {
  if (it.flask) return `${it.flask.kind.toUpperCase()} +${fmt(it.flask.heal)} · ${it.flask.max} ครั้ง`;
  if (it.buff) return `${it.buff.textTh} · ${it.buff.minutes} นาที${it.effect?.hp ? ` · HP +${it.effect.hp}` : ''}`;
  if (it.effect) return Object.entries(it.effect).map(([k, v]) => `${k.toUpperCase()} +${v}`).join(' · ');
  if (it.bonus) return `Lv.${it.lv || 1} · ${inlineStats(it.bonus)}`;
  return String(it.desc || '').split(/[·(]/)[0].trim().slice(0, 40);
}

export class ShopViews {
  constructor(ui) { this.ui = ui; this.tryOn = {}; this.craftSel = {}; }
  get c() { return this.ui.char; }
  get scene() { return this.ui.scene; }
  get E() { return this.scene.econ; }
  click() { this.scene.sfx?.play('click'); }
  done(r) { this.scene.sfx?.play(r.ok ? 'buy' : 'error'); this.ui.result(r); }

  // ============================================================
  //  หัวร้าน (ชิปสถานะ) + แถบแท็บซ้าย
  // ============================================================
  chips(shopId) {
    const c = this.c, shop = SHOPS[shopId], chip = (ic, top, main, cls = '') => `<span class="sh-chip ${cls}">${ic}<span><small>${top}</small><b>${main}</b></span></span>`;
    if (shopId === 'mae_kha') return FLASK_SLOTS.map((s) => { const id = c.equipment[s], it = ITEMS[id];
      return chip(it ? itemIcon(id, it.icon) : '▫️', `ช่อง ${FKEY[s]}`, it ? esc(it.nameTh) : 'ว่าง'); }).join('');
    if (shopId === 'lung_dam') return [['black_iron', 'แร่เหล็กไหล'], ['yak_fang', 'เขี้ยวพญายักษ์'], ['yant_guard', 'ยันต์กันลดขั้น']]
      .filter(([id]) => ITEMS[id]).map(([id, th]) => chip(itemIcon(id, ITEMS[id].icon), th, fmt(Inv.count(c, id)))).join('');
    if (shopId === 'pa_sa') {
      const now = Date.now(), b = (c.blessings || []).find((x) => x.id === 'food' && x.until > now);
      const it = b && Object.values(ITEMS).find((i) => i.nameTh === b.nameTh);
      return chip(b ? (it ? itemIcon(Object.keys(ITEMS).find((k) => ITEMS[k] === it), b.icon) : b.icon) : '🍽️', 'บัฟอาหารตอนนี้',
        b ? `${esc(b.nameTh)} · ${esc(it?.buff?.textTh || '')} · เหลือ ${Math.ceil((b.until - now) / 60000)} นาที` : 'ยังไม่มี', b ? 'on' : '');
    }
    if (shop.job) { const J = JOBS[c.appearance?.job]; return chip('🧑', 'ตัวละคร', `${esc(J?.nameTh || 'ชาวบ้าน')} Lv.${c.level}`, c.appearance?.job === shop.job ? 'on' : ''); }
    return '';
  }

  railSub(tab, shopId) {
    const c = this.c, shop = SHOPS[shopId];
    const craftN = (list) => craftList(list).filter((r) => canCraft(c, r)).length;
    switch (tab) {
      case 'buy': return shopId === 'tailor' ? `${shop.stock.length} แบบ` : shop.job ? `อุปกรณ์ Lv.${Math.min(...shop.stock.map((id) => ITEMS[id]?.lv || 1))}–${Math.max(...shop.stock.map((id) => ITEMS[id]?.lv || 1))}` : `${shop.stock.length} รายการ`;
      case 'sell': return 'ของในกระเป๋า';
      case 'buyback': return `${(c.buyback || []).length} รายการ`;
      case 'enhance': return `ตีได้ ${ENH_SLOTS.filter((s) => c.equipment[s] && (c.enhance[s] || 0) < ENHANCE.max).length} ช่อง`;
      case 'forge': return `สร้างได้ ${craftN('forge')} สูตร`;
      case 'cook': return `ทำได้ ${craftN('cook')} สูตร`;
      case 'brew': return `ปรุงได้ ${craftN('brew')} สูตร`;
      case 'cards': return '3 ใบ → 1 ใบ';
      case 'dye': return '10 สี · ฿500';
      case 'quests': return 'เควสประจำสาย';
      default: return '';
    }
  }

  rail(tabs, shopId, active) {
    const TAB = { buy: [uiIcon('shop', '🛒'), shopId === 'tailor' ? 'ซื้อชุด' : 'ซื้อ'], sell: [uiIcon('gold', '💰'), 'ขาย'], buyback: [uiIcon('return', '↩'), 'ซื้อคืน'],
      enhance: [uiIcon('anvil', '🔨'), 'ตีบวก'], forge: [uiIcon('tools', '⚒️'), 'สร้างอุปกรณ์'], cook: [uiIcon('soup', '🍳'), 'ทำอาหาร'], brew: [uiIcon('herb', '🌿'), 'ปรุงยา'],
      cards: [uiIcon('exchange', '🃏'), 'แลกการ์ด'], dye: [uiIcon('palette', '🎨'), 'ย้อมสีผม'], quests: [uiIcon('scroll', '📜'), 'เลื่อนอาชีพ'] };
    return tabs.map((t) => `<button data-tab="${t}" class="sh-tab${t === active ? ' active' : ''}"><span class="st-ic">${TAB[t]?.[0] || '•'}</span><span class="st-tx"><b>${TAB[t]?.[1] || t}</b><small>${this.railSub(t, shopId)}</small></span></button>`).join('');
  }

  // ============================================================
  //  ซื้อ: ร้านทั่วไป (แบ่งหมวด)
  // ============================================================
  buyList(el, shopId) {
    const c = this.c, shop = SHOPS[shopId], ui = this.ui;
    const stock = shop.stock.filter((id) => ITEMS[id]);
    if (!stock.includes(ui.shopSel)) ui.shopSel = stock.find((id) => !(ITEMS[id].lv && c.level < ITEMS[id].lv)) || stock[0];
    const sel = ui.shopSel;
    const flaskSlotOf = (id) => FLASK_SLOTS.find((s) => c.equipment[s] === id);
    const card = (id) => {
      const it = ITEMS[id], have = Inv.count(c, id), under = it.lv && c.level < it.lv, fs = flaskSlotOf(id);
      const tags = [fs ? `<i class="sv-tag on">ใส่ช่อง ${FKEY[fs]} อยู่</i>` : '', have ? `<i class="sv-tag">x${fmt(have)}</i>` : '', under ? `<i class="sv-tag lk">🔒 Lv.${it.lv}</i>` : ''].join('');
      return `<button class="sv-row${id === sel ? ' on' : ''}${under ? ' under' : ''}" data-sel="${id}"><span class="sv-ic">${itemIcon(id, it.icon)}</span>
        <span class="sv-tx"><b>${esc(it.nameTh.replace(/\s*\(.*\)$/, ''))}${tags}</b><small>${esc(effLine(it))}</small></span><span class="sv-pr">฿${fmt(it.price)}</span></button>`;
    };
    const groups = GROUPS.map(([g, th, sub]) => { const ids = stock.filter((id) => groupOf(ITEMS[id]) === g); if (!ids.length) return '';
      return `<div class="sv-group"><div class="sv-gh"><b>${th}</b><small>${sub}</small></div><div class="sv-rows">${ids.map(card).join('')}</div></div>`; }).join('');
    el.innerHTML = `<div class="sv-split"><div class="sv-left">${groups}</div><div class="sv-right">${this.buyDetail(sel, shopId)}</div></div>`;
    this.bindBuy(el, shopId);
  }

  /** แผงขวา: รายละเอียด + จำนวน + ซื้อ */
  buyDetail(id, shopId, { equip = false } = {}) {
    const c = this.c, it = ITEMS[id], ui = this.ui;
    if (!it) return '<p class="empty">เลือกสินค้าทางซ้าย</p>';
    const gear = GEAR_TYPES.includes(it.type), single = gear || it.type === 'skin' || it.type === 'costume';
    const maxAfford = Math.max(1, Math.floor(c.gold / Math.max(1, it.price)));
    const n = single ? 1 : Math.max(1, Math.min(ui.shopQty || 1, 9999));
    const cost = it.price * n, ok = c.gold >= cost, under = it.lv && c.level < it.lv, have = Inv.count(c, id);
    const typeTh = it.type === 'flask' ? 'ขวดยา · ใส่ช่อง Q/E' : it.type === 'consumable' ? 'ยากิน · ใช้ครั้งเดียว' : it.type === 'food' ? 'อาหาร · บัฟชั่วคราว' : TYPE_TH[it.type] || 'ของใช้';
    const job = it.job || (it.wtype && JOBS[{ sword: 'swordman', staff: 'mage', bow: 'archer', fist: 'boxer', herb: 'healer' }[it.wtype]]?.id);
    const cmp = gear ? `${gainText(c, id)}${impactLine(c, id)}` : '';
    const stepper = single ? '' : `<div class="sv-qty"><button data-qd="-1">−</button><input id="shop-qty-in" type="number" min="1" max="9999" value="${n}" inputmode="numeric"><button data-qd="1">+</button></div>
      <div class="sv-quick">${[1, 10, 20, 50].map((q) => `<button data-qty="${q}" class="${n === q ? 'active' : ''}" ${q > maxAfford && q > 1 ? 'data-poor' : ''}>x${q}</button>`).join('')}</div>`;
    const label = under ? `ต้อง Lv.${it.lv}` : !ok ? 'เงินไม่พอ' : equip && canWear(c, it) ? 'ซื้อแล้วใส่เลย' : single ? 'ซื้อ' : `ซื้อ ${fmt(n)} ชิ้น`;
    return `<div class="sv-dhead"><span class="sv-dic">${itemIcon(id, it.icon)}</span><span><b>${esc(it.nameTh)}</b><small>${it.lv ? `Lv.${it.lv} · ` : ''}${esc(typeTh)}${job ? ` · สาย${esc(JOBS[job]?.nameTh || '')}` : ''}</small></span></div>
      <p class="sv-desc">${esc(it.desc || effLine(it))}</p>${cmp}
      <div class="sv-have"><span>มีอยู่ในกระเป๋า</span><b>${fmt(have)} ชิ้น</b></div>
      <div class="sv-fill"></div>${stepper}
      <div class="sv-total"><span>รวม</span><b class="${ok ? '' : 'bad'}">฿${fmt(cost)}</b></div>
      ${['armor', 'weapon', 'costume'].includes(it.type) ? `<button class="btn ghost sm sv-prev" data-prev="${id}">👁 ลองใส่ดูก่อน</button>` : ''}
      <button class="btn primary sv-go" data-buy="${id}" data-n="${n}" ${equip ? 'data-equip="1"' : ''} ${ok && !under ? '' : 'disabled'}>${label}</button>`;
  }

  bindBuy(el, shopId) {
    const ui = this.ui, redraw = () => { const L = el.querySelector('.sv-left, .sv-matrix'), top = L?.scrollTop || 0; ui.renderShop(); const L2 = el.querySelector('.sv-left, .sv-matrix'); if (L2) L2.scrollTop = top; };
    el.querySelectorAll('[data-sel]').forEach((b) => (b.onclick = () => { ui.shopSel = b.dataset.sel; this.click(); redraw(); }));
    el.querySelectorAll('[data-qty]').forEach((b) => (b.onclick = () => { ui.shopQty = +b.dataset.qty; this.click(); redraw(); }));
    el.querySelectorAll('[data-qd]').forEach((b) => (b.onclick = () => { ui.shopQty = Math.max(1, Math.min(9999, (ui.shopQty || 1) + +b.dataset.qd)); this.click(); redraw(); }));
    const qin = el.querySelector('#shop-qty-in');
    if (qin) {
      qin.addEventListener('keydown', (e) => e.stopPropagation());
      qin.addEventListener('focus', () => (this.scene.input.keyboard.enabled = false));
      qin.addEventListener('blur', () => (this.scene.input.keyboard.enabled = true));
      qin.addEventListener('change', () => { ui.shopQty = Math.max(1, Math.min(9999, Math.floor(+qin.value || 1))); redraw(); });
    }
    el.querySelectorAll('[data-prev]').forEach((b) => (b.onclick = () => ui.preview(b.dataset.prev)));
    el.querySelectorAll('[data-buy]').forEach((b) => (b.onclick = async () => {
      const id = b.dataset.buy, r = await this.E.act('buy', { shop: shopId, id, qty: +b.dataset.n || 1 });
      if (r.ok && b.dataset.equip && canWear(this.c, ITEMS[id])) { const r2 = await this.E.act('equip', { id }); return this.done(r2.ok ? { ...r2, msg: `ซื้อและสวม ${ITEMS[id].nameTh} แล้ว` } : r); }
      this.done(r);
    }));
  }

  // ============================================================
  //  ซื้อ: ครูอาชีพ (ตาราง เลเวล × ช่อง)
  // ============================================================
  buyTeacher(el, shopId) {
    const c = this.c, shop = SHOPS[shopId], ui = this.ui;
    const gear = shop.stock.filter((id) => ITEMS[id] && GEAR_TYPES.includes(ITEMS[id].type));
    const cols = MATRIX_SLOTS.filter((s) => gear.some((id) => ITEMS[id].type === s));
    const lvs = [...new Set(gear.map((id) => ITEMS[id].lv || 1))].sort((a, b) => a - b);
    const myTier = Math.max(...lvs.filter((l) => l <= c.level), lvs[0]);
    const worn = new Set(Object.values(c.equipment || {}).filter(Boolean));
    const gainOf = (id) => (canWear(c, ITEMS[id]) && isMine(c, ITEMS[id]) ? cpGain(c, id) || 0 : 0);
    if (!gear.includes(ui.shopSel)) {                                            // เริ่มที่ของที่อัปเกรดได้มากสุด
      ui.shopSel = [...gear].sort((a, b) => gainOf(b) - gainOf(a))[0];
    }
    const sel = ui.shopSel;
    // ของดีสุดที่ใส่ได้ตอนนี้ (ต่อช่อง) · อัปเกรดได้กี่ช่อง · รวมราคา
    let ups = 0, upCost = 0, bestSlot = null, bestG = 0;
    for (const s of cols) {
      const cand = gear.filter((id) => ITEMS[id].type === s && (ITEMS[id].lv || 1) <= c.level && !worn.has(id)).sort((a, b) => gainOf(b) - gainOf(a))[0];
      const g = cand ? gainOf(cand) : 0;
      if (g > 0) { ups++; if (!Inv.count(c, cand)) upCost += ITEMS[cand].price; if (g > bestG) { bestG = g; bestSlot = s; } }
    }
    const cell = (s, lv) => {
      const id = gear.find((x) => ITEMS[x].type === s && (ITEMS[x].lv || 1) === lv);
      if (!id) return '<div class="tm-cell none">—</div>';
      const it = ITEMS[id], under = (it.lv || 1) > c.level, g = gainOf(id), own = Inv.count(c, id);
      const tag = worn.has(id) ? '<i class="tm-tag on">ใส่อยู่</i>' : own ? '<i class="tm-tag">มีแล้ว</i>' : '';
      return `<button class="tm-cell${id === sel ? ' sel' : ''}${under ? ' under' : ''}" data-sel="${id}" title="${esc(it.nameTh)}">${tag}${g > 0 ? '<i class="tm-up">▲</i>' : ''}
        <span class="tm-ic">${itemIcon(id, it.icon)}</span><span class="tm-pr">${under ? `🔒Lv.${it.lv}` : `฿${fmt(it.price)}`}</span></button>`;
    };
    const head = `<div class="tm-row tm-hd"><div class="tm-lv"></div>${cols.map((s) => `<div class="tm-col">${SLOT_TH[s]}</div>`).join('')}</div>`;
    const rows = lvs.map((lv) => `<div class="tm-row${lv === myTier ? ' me' : ''}"><div class="tm-lv"><b>Lv.${lv}</b>${lv === myTier ? '<small>เลเวลคุณ</small>' : ''}</div>${cols.map((s) => cell(s, lv)).join('')}</div>`).join('');
    const extra = shop.stock.filter((id) => ITEMS[id] && !GEAR_TYPES.includes(ITEMS[id].type));
    const note = `<div class="tm-note">${ups ? `<span class="up">▲ อัปเกรดได้ ${ups} ช่อง</span> · ของดีสุดที่ใส่ได้ตอน Lv.${c.level}${upCost ? ` รวม ฿${fmt(upCost)}` : ''}` : '✔ ใส่ของดีสุดที่ใส่ได้ครบแล้ว'}
      <span class="tm-adv">${bestSlot ? `เงินมี ฿${fmt(c.gold)} · แนะนำซื้อ${SLOT_TH[bestSlot]}ก่อน` : ''}</span></div>`;
    el.innerHTML = `<div class="sv-split"><div class="sv-left sv-matrix"><div class="tm-grid" style="--cols:${cols.length}">${head}${rows}</div>${note}
      ${extra.length ? `<div class="sv-group"><div class="sv-gh"><b>อื่น ๆ</b></div><div class="sv-rows">${extra.map((id) => `<button class="sv-row${id === sel ? ' on' : ''}" data-sel="${id}"><span class="sv-ic">${itemIcon(id, ITEMS[id].icon)}</span><span class="sv-tx"><b>${esc(ITEMS[id].nameTh)}</b><small>${esc(effLine(ITEMS[id]))}</small></span><span class="sv-pr">฿${fmt(ITEMS[id].price)}</span></button>`).join('')}</div></div>` : ''}</div>
      <div class="sv-right">${this.buyDetail(sel, shopId, { equip: true })}</div></div>`;
    this.bindBuy(el, shopId);
  }

  // ============================================================
  //  ซื้อ: แม่ช้อย (ห้องลองชุด)
  // ============================================================
  buyTailor(el, shopId) {
    const c = this.c, shop = SHOPS[shopId], ui = this.ui;
    const worn = { ...(c.costume || c.appearance?.costume || {}) };
    const owned = (id) => Inv.count(c, id) > 0 || Object.values(worn).includes(id);
    const f = ui.tailorF || 'all';
    const slots = ['outfit', 'head', 'face', 'back'].filter((s) => shop.stock.some((id) => ITEMS[id]?.slot === s));
    const list = shop.stock.filter((id) => ITEMS[id] && (f === 'all' || ITEMS[id].slot === f));
    const chips = `<div class="sv-chips">${[['all', 'ทั้งหมด', shop.stock.length], ...slots.map((s) => [s, COS_TH[s], shop.stock.filter((id) => ITEMS[id]?.slot === s).length])]
      .map(([k, th, n]) => `<button data-tf="${k}" class="${k === f ? 'active' : ''}">${th} <small>${n}</small></button>`).join('')}<span class="sv-chip-note">ชุดแต่งตัวเปลี่ยนแค่หน้าตา ไม่มีค่าพลัง</span></div>`;
    const grid = list.map((id) => { const it = ITEMS[id], trying = this.tryOn[it.slot] === id, wearing = worn[it.slot] === id;
      return `<button class="tl-card${trying ? ' try' : ''}" data-try="${id}">${trying ? '<i class="tl-tag">กำลังลอง</i>' : wearing ? '<i class="tl-tag on">ใส่อยู่</i>' : ''}
        <span class="tl-ic">${itemIcon(id, it.icon)}</span><b>${esc(it.nameTh)}</b><small class="${owned(id) ? 'own' : ''}">${owned(id) ? 'มีแล้ว' : `฿${fmt(it.price)}`}</small></button>`; }).join('');
    const tried = Object.entries(this.tryOn).filter(([, id]) => id);
    const toBuy = tried.filter(([, id]) => !owned(id)), cost = toBuy.reduce((a, [, id]) => a + ITEMS[id].price, 0), ok = c.gold >= cost;
    const rows = slots.map((s) => { const id = this.tryOn[s] || worn[s], it = ITEMS[id];
      return `<div class="tl-srow"><span>${COS_TH[s]}</span><b>${it ? esc(it.nameTh) : '— ไม่ใส่ —'}</b><small>${this.tryOn[s] ? (owned(id) ? 'มีแล้ว' : `฿${fmt(it.price)}`) : it ? 'ใส่อยู่' : ''}</small></div>`; }).join('');
    el.innerHTML = `<div class="sv-split tl"><div class="sv-left">${chips}<div class="tl-grid">${grid}</div></div>
      <div class="sv-right"><div class="tl-room-h"><b>ห้องลองชุด</b><button class="btn ghost sm" data-tclear ${tried.length ? '' : 'disabled'}>ถอดที่ลองทั้งหมด</button></div>
        <div class="tl-stage"><canvas class="tl-hero"></canvas>${tried.length ? `<div class="tl-trying">${tried.map(([, id]) => `<span>${itemIcon(id, ITEMS[id].icon)}${esc(ITEMS[id].nameTh)}</span>`).join('')}</div>` : ''}</div>
        <small class="tl-hint">คลิกชุดทางซ้ายเพื่อลอง · ลองหลายชิ้นพร้อมกันได้ (ชุด+ศีรษะ+ใบหน้า+หลัง) · ตัวละครในเกมจะแสดงชุดที่ลองด้วย</small>
        <div class="tl-slots">${rows}</div><div class="sv-fill"></div>
        <div class="sv-total"><span>${toBuy.length ? `ต้องซื้อ ${toBuy.length} ชิ้น` : tried.length ? 'มีครบแล้ว' : 'ยังไม่ได้ลอง'}</span><b class="${ok ? '' : 'bad'}">฿${fmt(cost)}</b></div>
        <button class="btn primary sv-go" data-tbuy ${tried.length && ok ? '' : 'disabled'}>${!ok ? 'เงินไม่พอ' : toBuy.length ? 'ซื้อแล้วใส่เลย' : 'ใส่เลย'}</button></div></div>`;
    // ตัวละครในห้องลองชุด (ชุดหลัก) + ตัวละครในเกม (ครบทุกช่อง)
    const app = { ...c.appearance, costume: { ...worn, ...Object.fromEntries(tried) } };
    try { (this.tlView ||= null)?.destroy?.(); this.tlView = new HeroView(el.querySelector('.tl-hero'), this.scene, { scale: 3, autoDrop: true }).set(app, 'idle', 'south'); } catch { /* */ }
    const redraw = () => { const L = el.querySelector('.sv-left'), top = L?.scrollTop || 0; this.buyTailor(el, shopId); el.querySelector('.sv-left').scrollTop = top; };
    el.querySelectorAll('[data-tf]').forEach((b) => (b.onclick = () => { ui.tailorF = b.dataset.tf; this.click(); redraw(); }));
    el.querySelectorAll('[data-try]').forEach((b) => (b.onclick = () => {
      const id = b.dataset.try, s = ITEMS[id].slot;
      this.tryOn[s] = this.tryOn[s] === id ? null : id; this.click();
      this.scene.player?.previewAppearance?.({ ...c.appearance, costume: { ...worn, ...Object.fromEntries(Object.entries(this.tryOn).filter(([, v]) => v)) } }, 8000);
      redraw();
    }));
    el.querySelector('[data-tclear]')?.addEventListener('click', () => { this.tryOn = {}; this.click(); redraw(); });
    el.querySelector('[data-tbuy]')?.addEventListener('click', async () => {
      for (const [, id] of toBuy) { const r = await this.E.act('buy', { shop: shopId, id, qty: 1 }); if (!r.ok) return this.done(r); }
      let last = { ok: true };
      for (const [, id] of tried) if (worn[ITEMS[id].slot] !== id) last = await this.E.act('use', { id });
      this.tryOn = {};
      this.done(last.ok ? { ...last, msg: `👘 แต่งตัวเรียบร้อย${toBuy.length ? ` (ซื้อ ${toBuy.length} ชิ้น ฿${fmt(cost)})` : ''}` } : last);
    });
  }

  // ============================================================
  //  ตีบวก (ลุงดำ)
  // ============================================================
  enhance(el, shopId) {
    const c = this.c, V = this.scene.village;
    const slots = ENH_SLOTS.filter((s) => c.equipment[s]);
    if (!slots.includes(this.enhSlot)) this.enhSlot = slots.sort((a, b) => (c.enhance[b] || 0) - (c.enhance[a] || 0))[0] || ENH_SLOTS[0];
    const slot = this.enhSlot, id = c.equipment[slot], it = ITEMS[id], lv = c.enhance[slot] || 0, max = lv >= ENHANCE.max;
    const cost = ENHANCE.cost(lv), ore = ENHANCE.ore(lv), fang = ENHANCE.fang(lv), rate = ENHANCE.rate(lv);
    const haveOre = Inv.count(c, 'black_iron'), haveFang = Inv.count(c, 'yak_fang'), guards = Inv.count(c, 'yant_guard');
    const cur = ENHANCE.bonus[slot]?.(lv) || {}, nxt = ENHANCE.bonus[slot]?.(lv + 1) || {};
    const sv = (k, v) => { const m = STAT[k]; return m?.f ? m.f(v) : fmt(v); };
    const statRows = Object.keys(nxt).map((k) => `<div><span>${STAT[k]?.ic || ''} ${esc(STAT[k]?.th || k)}</span><b>+${sv(k, cur[k] || 0)} → <em>+${sv(k, nxt[k])}</em></b></div>`).join('');
    const risk = lv < 10 ? 'พลาด: ขั้นไม่ลด' : lv < 15 ? 'พลาด: ลด 1 ขั้น' : 'พลาด: ลด 1 ขั้น (30% ลด 2)';
    const guardOn = !!V.useGuard && guards > 0, guardUse = lv >= 10;
    const can = id && !max && c.gold >= cost && haveOre >= ore && haveFang >= fang;
    const tier = ENHANCE.auraTier(lv), nt = ENHANCE.auraTier(lv + 1);
    const list = ENH_SLOTS.map((s) => { const i2 = c.equipment[s], l2 = c.enhance[s] || 0;
      return `<button class="eh-slot${s === slot ? ' on' : ''}${i2 ? '' : ' empty'}" data-eslot="${s}" ${i2 ? '' : 'disabled'}><span class="sv-ic">${i2 ? itemIcon(i2, ITEMS[i2].icon) : '▫️'}</span>
        <span class="sv-tx"><b>${SLOT_TH[s]}</b><small>${i2 ? (l2 >= ENHANCE.max ? 'สูงสุดแล้ว' : `สำเร็จ ${Math.round(ENHANCE.rate(l2) * 100)}%`) : 'ยังไม่ได้สวม'}</small></span><b class="eh-lv enh t${ENHANCE.auraTier(l2)}">+${l2}</b></button>`; }).join('');
    const mat = (mid, have, need, extra = '') => { const I = ITEMS[mid]; if (!I) return '';
      return `<div class="eh-mat${need && have < need ? ' miss' : ''}${need ? '' : ' off'}"><span class="sv-ic">${itemIcon(mid, I.icon)}</span><span><b>${esc(I.nameTh)}</b><small>${need ? `${fmt(have)} / ${need}` : 'ยังไม่ต้องใช้'}</small></span>${extra}</div>`; };
    const buyOre = ore > haveOre && SHOPS[shopId]?.stock.includes('black_iron') ? `<button class="btn sm" data-ebuy="black_iron" data-n="${ore - haveOre}">ซื้อ ${ore - haveOre}</button>` : '';
    el.innerHTML = `<div class="sv-split eh"><div class="sv-left eh-main">
      <div class="eh-title"><b>ตีบวก${SLOT_TH[slot] || ''}</b><small>${id ? esc(it.nameTh) : 'ยังไม่ได้สวมใส่'}</small></div>
      <div class="eh-stage">
        <div class="eh-box"><small>โบนัสหลังตี</small>${statRows || '<div><span>—</span></div>'}<div class="eh-safe">${lv < 10 ? '✔ ขั้นนี้ตีพลาดไม่ลดขั้น' : '⚠ ตีพลาดขั้นลด'}</div></div>
        <div class="eh-ring t${nt}"><i class="eh-rays"></i><span class="eh-item">${id ? itemIcon(id, it.icon) : '▫️'}</span><div class="eh-step">${max ? `+${lv} <small>สูงสุด</small>` : `<b class="enh t${tier}">+${lv}</b> → <b class="enh t${nt}">+${lv + 1}</b>`}</div></div>
        <div class="eh-box rate"><small>โอกาสสำเร็จ</small><b class="eh-pct">${max ? '—' : `${Math.round(rate * 100)}%`}</b><i class="eh-bar"><i style="width:${Math.round(rate * 100)}%"></i></i><small>${max ? 'ตีครบแล้ว · ออร่ารุ้ง' : `${risk}${guardUse ? (guardOn ? ' · ใช้ยันต์ 1 ใบ' : '') : ''}`}</small>${nt > tier && !max ? `<small class="eh-aura">✨ ปลดออร่า${AURA_TH[nt]}</small>` : ''}</div>
      </div>
      <div class="eh-mats">${mat('black_iron', haveOre, ore, buyOre)}${mat('yak_fang', haveFang, fang)}
        <label class="eh-mat guard${guardUse ? '' : ' off'}"><span class="sv-ic">${itemIcon('yant_guard', ITEMS.yant_guard?.icon || '🧧')}</span><span><b>ยันต์กันลดขั้น</b><small>มี ${guards} ใบ · ${guardUse ? 'ใช้ 1 ใบ' : 'ใช้ตอน +10 ขึ้นไป'}</small></span><input type="checkbox" id="enh-guard" ${guardOn ? 'checked' : ''} ${guards ? '' : 'disabled'}><i class="sw"></i></label></div>
      <div class="eh-foot"><span class="eh-cost"><small>ค่าตีบวก</small><b class="${c.gold >= cost ? '' : 'bad'}">฿${fmt(cost)}</b><small>เหลือ ฿${fmt(Math.max(0, c.gold - cost))}</small></span>
        <button class="btn primary sv-go" data-enh="${slot}" ${can ? '' : 'disabled'}>${max ? 'สูงสุดแล้ว' : !id ? 'ยังไม่ได้สวม' : `ตีบวก +${lv + 1}`}</button></div>
      <p class="hint">ออร่ารอบตัว: +7 ฟ้า · +10 ม่วง · +13 ทอง · +16 เพลิง · +20 รุ้ง (ใช้ขั้นสูงสุดของอุปกรณ์)</p></div>
      <div class="sv-right eh-list"><div class="sv-gh"><b>อุปกรณ์ที่สวมอยู่</b><small>เลือกช่อง</small></div>${list}</div></div>`;
    el.querySelectorAll('[data-eslot]').forEach((b) => (b.onclick = () => { this.enhSlot = b.dataset.eslot; this.click(); this.enhance(el, shopId); }));
    el.querySelector('#enh-guard')?.addEventListener('change', (e) => { V.useGuard = e.target.checked; this.enhance(el, shopId); });
    el.querySelector('[data-enh]')?.addEventListener('click', () => V.enhance(slot));
    el.querySelector('[data-ebuy]')?.addEventListener('click', (e) => { const b = e.currentTarget; this.E.act('buy', { shop: shopId, id: b.dataset.ebuy, qty: +b.dataset.n }).then((r) => this.done(r)); });
  }

  // ============================================================
  //  ทำอาหาร / ปรุงยา / สร้างอุปกรณ์
  // ============================================================
  craft(el, list, hint) {
    const c = this.c, all = craftList(list).map((r, i) => ({ r, i }));
    const UNIT = { cook: 'จาน', brew: 'ขวด', forge: 'ชิ้น' }[list], VERB = { cook: 'ทำ', brew: 'ปรุง', forge: 'สร้าง' }[list];
    // ตัวกรอง
    let F, key = `craftF_${list}`, f;
    if (list === 'forge') { const mj = c.appearance?.job || c.path; F = { mine: `สาย${JOBS[mj]?.nameTh || 'ตัวเอง'}`, all: 'ทุกสาย', util: 'ของใช้' }; f = this[key] || (mj ? 'mine' : 'all'); }
    else if (list === 'cook') { F = { all: 'ทั้งหมด', exp: 'EXP', atk: 'โจมตี', def: 'ป้องกัน', drop: 'ของดรอป' }; f = this[key] || 'all'; }
    else { F = { all: 'ทั้งหมด', hp: 'ฟื้น HP', mp: 'ฟื้น MP', buff: 'บัฟ' }; f = this[key] || 'all'; }
    const mj = c.appearance?.job || c.path;
    const pass = ({ r }) => { const it = ITEMS[r.out], m = it.buff?.mods || {};
      if (list === 'forge') return f === 'all' ? !r.util : f === 'util' ? r.util : r.job === mj;
      if (f === 'all') return true;
      if (f === 'exp') return m.expMul; if (f === 'atk') return m.atkMul || m.critAdd; if (f === 'def') return m.def || m.defMul; if (f === 'drop') return m.dropMul;
      if (f === 'hp') return it.effect?.hp; if (f === 'mp') return it.effect?.mp; if (f === 'buff') return it.buff; return true; };
    const rows = all.filter(pass);
    const maxOf = (r) => Math.max(0, Math.min(...Object.entries(r.need).map(([id, n]) => Math.floor(Inv.count(c, id) / n)), r.fee ? Math.floor(c.gold / r.fee) : 999));
    const sel = rows.find((x) => x.i === this.craftSel[list]) || rows.find((x) => maxOf(x.r) > 0) || rows[0];
    if (sel) this.craftSel[list] = sel.i;
    const card = ({ r, i }) => { const it = ITEMS[r.out], mx = maxOf(r), under = it.lv && c.level < it.lv;
      const needs = Object.entries(r.need).map(([id, n]) => { const h = Inv.count(c, id); return `<span class="cf-need${h >= n ? '' : ' miss'}" title="${esc(ITEMS[id]?.nameTh)}">${itemIcon(id, ITEMS[id]?.icon, { badge: false })}${fmt(h)}/${n}</span>`; }).join('');
      return `<button class="cf-card${sel && i === sel.i ? ' on' : ''}${under ? ' under' : ''}" data-csel="${i}"><span class="sv-ic">${itemIcon(r.out, it.icon)}</span>
        <span class="sv-tx"><b>${esc(it.nameTh)}</b><small>${esc(effLine(it))}</small></span><i class="cf-badge${mx ? ' ok' : ''}">${under ? `🔒 Lv.${it.lv}` : mx ? `${VERB}ได้ ${mx} ${UNIT}` : 'วัตถุดิบไม่พอ'}</i>
        <span class="cf-needs">${needs}</span><span class="sv-pr">฿${fmt(r.fee)}</span></button>`; };
    let detail = '<p class="empty">ไม่มีสูตรในหมวดนี้</p>';
    if (sel) {
      const { r } = sel, it = ITEMS[r.out], mx = maxOf(r), single = list === 'forge';
      const n = single ? 1 : Math.max(1, Math.min(this.craftN || 1, Math.max(1, mx)));
      const needRows = Object.entries(r.need).map(([id, k]) => { const h = Inv.count(c, id), need = k * n;
        return `<div class="cf-nrow${h >= need ? '' : ' miss'}"><span class="sv-ic">${itemIcon(id, ITEMS[id]?.icon, { badge: false })}</span><span><b>${esc(ITEMS[id]?.nameTh)}</b></span><b>${fmt(h)}/${fmt(need)}</b></div>`; }).join('');
      const full = Object.entries(r.need).every(([id, k]) => Inv.count(c, id) >= k * n);
      const can = canCraft(c, r) && mx >= n && !(it.lv && c.level < it.lv);
      detail = `<div class="sv-dhead"><span class="sv-dic">${itemIcon(r.out, it.icon)}</span><span><b>${esc(it.nameTh)}</b><small>${esc(effLine(it))}</small></span></div>
        ${GEAR_TYPES.includes(it.type) ? `${gainText(c, r.out)}${impactLine(c, r.out)}` : ''}
        <div class="sv-gh"><b>วัตถุดิบ</b><small>${full ? '· ครบแล้ว' : '· ยังขาด'}</small></div><div class="cf-nlist">${needRows}</div>
        <div class="sv-fill"></div>
        ${single ? '' : `<div class="sv-have"><span>${VERB}ได้สูงสุด</span><b>${fmt(mx)} ${UNIT}</b></div>
        <div class="sv-qty"><button data-cd="-1">−</button><input id="craft-n" type="number" min="1" value="${n}" inputmode="numeric"><button data-cd="1">+</button><button class="sv-max" data-cmax="${mx}">สูงสุด</button></div>`}
        <div class="sv-total"><span>ค่าแรงรวม</span><b class="${c.gold >= r.fee * n ? '' : 'bad'}">฿${fmt(r.fee * n)}</b></div>
        <button class="btn primary sv-go" data-craft="${sel.i}" data-n="${n}" ${can ? '' : 'disabled'}>${VERB} ${single ? '' : `${fmt(n)} ${UNIT}`}</button>`;
    }
    el.innerHTML = `<div class="sv-split cf"><div class="sv-left"><div class="sv-chips"><span class="sv-chip-note l">${list === 'forge' ? 'แสดง:' : list === 'cook' ? 'อยากได้บัฟ:' : 'ประเภท:'}</span>${Object.entries(F).map(([k, l]) => `<button data-cf="${k}" class="${k === f ? 'active' : ''}">${l}</button>`).join('')}</div>
      <div class="cf-grid">${rows.map(card).join('') || '<p class="empty">ไม่มีสูตรในหมวดนี้</p>'}</div><p class="hint">${hint}</p></div>
      <div class="sv-right">${detail}</div></div>`;
    const redraw = () => { const L = el.querySelector('.sv-left'), top = L?.scrollTop || 0; this.craft(el, list, hint); el.querySelector('.sv-left').scrollTop = top; };
    el.querySelectorAll('[data-cf]').forEach((b) => (b.onclick = () => { this[key] = b.dataset.cf; if (list === 'forge') this.scene.village.forgeFilter = b.dataset.cf; this.click(); redraw(); }));
    el.querySelectorAll('[data-csel]').forEach((b) => (b.onclick = () => { this.craftSel[list] = +b.dataset.csel; this.craftN = 1; this.click(); redraw(); }));
    el.querySelectorAll('[data-cd]').forEach((b) => (b.onclick = () => { this.craftN = Math.max(1, (this.craftN || 1) + +b.dataset.cd); this.click(); redraw(); }));
    el.querySelector('[data-cmax]')?.addEventListener('click', (e) => { this.craftN = Math.max(1, +e.currentTarget.dataset.cmax); this.click(); redraw(); });
    const cin = el.querySelector('#craft-n');
    if (cin) { cin.addEventListener('keydown', (e) => e.stopPropagation()); cin.addEventListener('change', () => { this.craftN = Math.max(1, Math.floor(+cin.value || 1)); redraw(); }); }
    el.querySelector('[data-craft]')?.addEventListener('click', (e) => {
      const b = e.currentTarget, n = +b.dataset.n || 1, idx = +b.dataset.craft;
      this.E.act('craft', { list, idx, n }).then((r) => {
        if (r.ok) { this.scene.sfx.play(r.forged ? 'levelup' : 'potion'); if (r.forged) { this.ui.banner(`⚒️ สร้างสำเร็จ: ${ITEMS[r.out].nameTh}`); this.scene.combat?.burst?.(this.scene.player.x, this.scene.player.y - 20, 0xf39c12, 18); } }
        this.ui.result(r);
      });
    });
  }
}
