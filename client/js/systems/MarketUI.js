// ============================================================
//  MarketUI – หน้าต่างการค้า (อยู่ในกรอบร้าน v3)
//  ▸ นายห้างสำเภา: ตลาด (ซื้อของผู้เล่น) · ฝากขาย · ป้ายรับซื้อ · กล่องรับของ · แลกของ (ใช้การ์ดสูตรของ ShopViews.craft)
//  ▸ ป้าสา/ยายติ๋ม/ลุงดำ/แม่ช้อย: แท็บ "รับซื้อพิเศษ" ประจำวัน
//  ▸ พ่อค้าเร่: ของหายากจำนวนจำกัด (ทั้งเซิร์ฟ)
//  ข้อมูลตลาดอยู่ที่ server (socket 'mk') · ของ/เงินในตัวละครเปลี่ยนผ่าน econ.apply เหมือนร้านทั่วไป
// ============================================================
import { ITEMS, SHOPS, sellPrice } from '/shared/data/items.js';
import { MARKET, listFee, afterTax, tradable, demandOf, DEMAND, COIN, TRAVEL } from '/shared/data/trade.js';
import { demandLeft } from '/shared/economy.js';
import { GEAR_TYPES } from '/shared/data/slots.js';
import { itemIcon } from './util.js';
import { gainText, newFilter, applyFilter, filterBarHtml, bindFilterBar, rarityOf } from './ItemFilter.js';
import { effLine } from './ShopUI.js';
import { askQty } from './QtyPicker.js';
import { ask } from './Dialog.js';
import * as Inv from './Inventory.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Math.round(n || 0).toLocaleString('en-US');
const left = (ms) => { if (ms <= 0) return 'หมดเวลา'; const h = Math.floor(ms / 3600e3), m = Math.floor((ms % 3600e3) / 60e3); return h ? `${h} ชม. ${m} นาที` : `${m} นาที`; };
export const MK_TABS = new Set(['market', 'mylist', 'orders', 'claim', 'travel']);
const L = (a) => ({ id: a[0], item: a[1], qty: a[2], price: a[3], name: a[4], exp: a[5] });
const rc = (it) => { const r = rarityOf(it); return r ? ` r${r}` : ''; };                 // กรอบสีตามความหายาก (เหมือนกระเป๋า)
const rn = (it) => { const r = rarityOf(it); return r ? `rn${r}` : ''; };                 // สีชื่อ

export class MarketViews {
  constructor(ui) { this.ui = ui; this.st = null; this.travel = { active: false }; this.sel = {}; this.n = {}; this.price = {}; this.q = ''; }
  get c() { return this.ui.char; }
  get scene() { return this.ui.scene; }
  click() { this.scene.sfx?.play('click'); }
  done(r) { this.scene.sfx?.play(r.ok ? 'buy' : 'error'); this.ui.result(r); }
  rerender() { if (document.querySelector('#shop-panel:not(.hidden)') && MK_TABS.has(this.ui.shopTab)) this.ui.renderShop(); }

  /** คำสั่งตลาด → server (คืนผล · อัปเดตมุมมอง + ตัวละคร) */
  mk(op, args = {}) {
    const s = this.scene;
    if (!s.econ?.server) return Promise.resolve({ ok: false, msg: 'ตลาดใช้ได้เฉพาะตอนเล่นออนไลน์' });
    if (!s.net?.online) return Promise.resolve({ ok: false, msg: 'ขาดการเชื่อมต่อเซิร์ฟเวอร์ – รอสักครู่' });
    return new Promise((res) => {
      let done = false;
      const t = setTimeout(() => { if (!done) { done = true; res({ ok: false, msg: 'เซิร์ฟเวอร์ไม่ตอบสนอง ลองใหม่อีกครั้ง' }); } }, 7000);
      s.net.socket.emit('mk', { op, ...args }, (resp) => {
        if (done) return; done = true; clearTimeout(t);
        if (resp?.v) { this.st = resp.v; this.st.at = Date.now(); }
        if (resp?.t) s.onTravel?.(resp.t);
        if (resp?.s) s.econ.apply(resp.s);                        // → refreshPanels → วาดร้านใหม่
        else this.rerender();
        res(resp?.r || { ok: false, msg: '' });
      });
    });
  }
  /** ขอข้อมูลตลาดใหม่ (ถ้าเก่ากว่า 4 วิ หรือบังคับ) */
  fetch(force = false) { if (!force && this.st && Date.now() - this.st.at < 4000) return; if (this.busy) return; this.busy = true; this.mk('state').finally(() => { this.busy = false; }); }
  now() { return this.st ? this.st.now + (Date.now() - this.st.at) : Date.now(); }
  loading(el) { el.innerHTML = '<p class="empty">กำลังโหลดข้อมูลตลาด…</p>'; this.fetch(true); }
  /** ราคาอ้างอิง: ขายได้ล่าสุด (ตลาด) · ร้าน NPC รับซื้อ */
  refLine(id) {
    const h = this.st?.hist?.[id] || [], sp = sellPrice(id);
    return `<div class="mk-ref">${h.length ? `<span>ขายได้ล่าสุด <b>฿${fmt(h[0])}</b>${h.length > 1 ? ` <small>(เฉลี่ย ${h.length} ครั้ง ฿${fmt(h.reduce((a, x) => a + x, 0) / h.length)})</small>` : ''}</span>` : '<span>ยังไม่มีประวัติราคาในตลาด</span>'}
      ${sp ? `<span>ร้าน NPC รับซื้อ <b>฿${fmt(sp)}</b></span>` : ''}</div>`;
  }
  head(id) { const it = ITEMS[id]; return `<div class="sv-dhead"><span class="sv-dic">${itemIcon(id, it.icon)}</span><span><b class="${rn(it)}">${esc(it.nameTh)}</b><small>${esc(effLine(it))}</small></span></div>${GEAR_TYPES.includes(it.type) ? gainText(this.c, id) : ''}`; }
  qtyBox(key, max) {
    const n = Math.max(1, Math.min(this.n[key] || 1, Math.max(1, max)));
    return { n, html: `<div class="sv-qty"><button data-mq="-1">−</button><input class="mk-n" type="number" min="1" max="${max}" value="${n}" inputmode="numeric"><button data-mq="1">+</button><button class="sv-max" data-mqmax="${max}">สูงสุด</button></div>` };
  }
  bindQty(el, key, redraw) {
    el.querySelectorAll('[data-mq]').forEach((b) => (b.onclick = () => { this.n[key] = Math.max(1, (this.n[key] || 1) + +b.dataset.mq); this.click(); redraw(); }));
    el.querySelector('[data-mqmax]')?.addEventListener('click', (e) => { this.n[key] = Math.max(1, +e.currentTarget.dataset.mqmax); this.click(); redraw(); });
    const inp = el.querySelector('.mk-n');
    if (inp) { inp.addEventListener('keydown', (e) => e.stopPropagation()); inp.addEventListener('change', () => { this.n[key] = Math.max(1, Math.floor(+inp.value || 1)); redraw(); }); }
  }
  priceBox(key, def) {
    const v = this.price[key] ?? def;
    return { v, html: `<label class="mk-price"><span>ราคาต่อชิ้น</span><span class="mk-pin">฿<input class="mk-p" type="number" min="1" max="${MARKET.maxPrice}" value="${v}" inputmode="numeric"></span></label>` };
  }
  bindPrice(el, key, redraw) {
    const inp = el.querySelector('.mk-p');
    if (inp) { inp.addEventListener('keydown', (e) => e.stopPropagation()); inp.addEventListener('change', () => { this.price[key] = Math.max(1, Math.min(MARKET.maxPrice, Math.floor(+inp.value || 1))); redraw(); }); }
    el.querySelectorAll('[data-mp]').forEach((b) => (b.onclick = () => { this.price[key] = Math.max(1, +b.dataset.mp); this.click(); redraw(); }));
  }
  suggest(id, key) {
    const h = this.st?.hist?.[id] || [], sp = sellPrice(id), opts = [];
    if (h.length) opts.push([h[0], 'ล่าสุด']);
    if (sp) opts.push([sp * 2, 'NPC×2'], [sp * 5, 'NPC×5']);
    return opts.length ? `<div class="mk-sug"><span>ตั้งเร็ว:</span>${opts.map(([v, l]) => `<button data-mp="${v}">${l} <b>฿${fmt(v)}</b></button>`).join('')}</div>` : '';
  }

  // ============================================================
  //  ตลาด: ซื้อของที่ผู้เล่นฝากขาย
  // ============================================================
  market(el) {
    if (!this.st) return this.loading(el);
    this.fetch();
    const c = this.c, now = this.now(), f = (this.mf ||= newFilter({ sort: 'type' }));
    const all = this.st.listings.map(L).map((l) => ({ ...l, id: l.item, lid: l.id }));
    let list = applyFilter(c, all, f);
    list = list.sort((a, b) => (this.msort === 'new' ? b.lid - a.lid : a.item === b.item ? a.price - b.price : 0) || a.price - b.price);
    const sel = list.find((l) => l.lid === this.sel.market) || list[0];
    if (sel) this.sel.market = sel.lid;
    const rows = list.map((l) => { const it = ITEMS[l.item];
      return `<button class="sv-row mk-row${sel?.lid === l.lid ? ' on' : ''}" data-ml="${l.lid}" data-tip-item="${l.item}"><span class="sv-ic">${itemIcon(l.item, it.icon)}</span>
        <span class="sv-tx"><b class="${rn(it)}">${esc(it.nameTh)}</b><small>${esc(l.name)} · เหลือ ${left(l.exp - now)}</small></span>
        <span class="mk-q">x${fmt(l.qty)}</span><span class="sv-pr">฿${fmt(l.price)}</span></button>`; }).join('');
    let detail = '<p class="empty">ยังไม่มีใครฝากขาย<br><small>ลองฝากขายของตัวเองที่แท็บ "ฝากขาย"</small></p>';
    if (sel) {
      const { n, html } = this.qtyBox(`m${sel.lid}`, sel.qty), cost = sel.price * n, ok = c.gold >= cost;
      detail = `${this.head(sel.item)}<div class="sv-have"><span>ผู้ขาย</span><b>${esc(sel.name)}</b></div>
        <div class="sv-have"><span>มีขาย</span><b>${fmt(sel.qty)} ชิ้น · ชิ้นละ ฿${fmt(sel.price)}</b></div>
        <div class="sv-have"><span>มีอยู่ในกระเป๋า</span><b>${fmt(Inv.count(c, sel.item))} ชิ้น</b></div>
        ${this.refLine(sel.item)}<div class="sv-fill"></div>${sel.qty > 1 ? html : ''}
        <div class="sv-total"><span>รวม</span><b class="${ok ? '' : 'bad'}">฿${fmt(cost)}</b></div>
        <button class="btn primary sv-go" data-mbuy="${sel.lid}" data-n="${n}" ${ok ? '' : 'disabled'}>${ok ? `ซื้อ ${fmt(n)} ชิ้น` : 'เงินไม่พอ'}</button>`;
    }
    el.innerHTML = `<div class="sv-split mk"><div class="sv-left">${filterBarHtml(c, f, all, { sortRow: false })}
      <div class="sv-chips"><span class="sv-chip-note l">เรียง:</span><button data-ms="cheap" class="${this.msort !== 'new' ? 'active' : ''}">ถูกสุดก่อน</button><button data-ms="new" class="${this.msort === 'new' ? 'active' : ''}">ลงใหม่ล่าสุด</button>
      <span class="sv-chip-note">${fmt(list.length)} แผง · ค่าธรรมเนียมผู้ขาย ${MARKET.tax * 100}%</span></div>
      <div class="sv-rows mk-rows">${rows || '<p class="empty">ไม่มีของตามตัวกรองนี้</p>'}</div></div>
      <div class="sv-right">${detail}</div></div>`;
    const redraw = () => { const Lf = el.querySelector('.mk-rows'), top = Lf?.scrollTop || 0; this.market(el); const L2 = el.querySelector('.mk-rows'); if (L2) L2.scrollTop = top; };
    bindFilterBar(el, f, redraw, this.scene);
    el.querySelectorAll('[data-ms]').forEach((b) => (b.onclick = () => { this.msort = b.dataset.ms; this.click(); redraw(); }));
    el.querySelectorAll('[data-ml]').forEach((b) => (b.onclick = () => { this.sel.market = +b.dataset.ml; this.click(); redraw(); }));
    if (sel) this.bindQty(el, `m${sel.lid}`, redraw);
    el.querySelector('[data-mbuy]')?.addEventListener('click', async (e) => {
      const b = e.currentTarget, n = +b.dataset.n, cost = sel.price * n;
      if (cost >= 100000 && !(await ask({ title: `ซื้อ ${ITEMS[sel.item].nameTh} x${n}?`, icon: '⚓', ok: `ซื้อ ฿${fmt(cost)}`, text: `จาก ${sel.name}\nรวม ฿${fmt(cost)}` }))) return;
      this.mk('buy', { id: sel.lid, qty: n }).then((r) => this.done(r));
    });
  }

  // ============================================================
  //  ฝากขาย: เลือกของในกระเป๋า → ตั้งราคา · แผงของฉัน
  // ============================================================
  mylist(el) {
    if (!this.st) return this.loading(el);
    const c = this.c, now = this.now(), f = (this.lf ||= newFilter({ sort: 'type' }));
    const bag = c.inventory.filter((s) => tradable(s.id));
    const list = applyFilter(c, bag, f);
    const sel = list.find((s) => s.id === this.sel.mylist) || null;
    const cells = Math.max(24, Math.ceil(list.length / 8) * 8);
    const grid = Array.from({ length: cells }, (_, i) => { const s = list[i]; if (!s) return '<div class="ro-slot empty"></div>';
      const it = ITEMS[s.id], free = Inv.freeQty(c, s.id);
      return `<div class="ro-slot${rc(it)}${sel?.id === s.id ? ' sel' : ''}${free ? '' : ' locked'}" data-lsel="${s.id}" data-tip-item="${s.id}">${itemIcon(s.id, it.icon)}${s.qty > 1 ? `<b class="ro-q">${s.qty > 9999 ? '9999+' : s.qty}</b>` : ''}${Inv.isLocked(c, s.id) ? '<i class="ro-lock">🔒</i>' : ''}</div>`; }).join('');
    const mine = this.st.mine.map(L);
    const myRows = mine.map((l) => { const it = ITEMS[l.item];
      return `<div class="mk-mine"><span class="sv-ic">${itemIcon(l.item, it?.icon)}</span><span class="sv-tx"><b>${esc(it?.nameTh)}</b><small>x${fmt(l.qty)} · ชิ้นละ ฿${fmt(l.price)} · เหลือ ${left(l.exp - now)}</small></span><button class="btn sm ghost" data-lcancel="${l.id}">เก็บคืน</button></div>`; }).join('');
    let form = '<p class="empty mk-pick">① คลิกของในกระเป๋าทางซ้าย<br><small>② ตั้งจำนวนและราคา ③ วางแผง</small></p>';
    if (sel) {
      const free = Inv.freeQty(c, sel.id), def = this.st.hist?.[sel.id]?.[0] || Math.max(1, sellPrice(sel.id) * 2);
      const { n, html } = this.qtyBox(`l${sel.id}`, Math.max(1, free)), P = this.priceBox(sel.id, def);
      const fee = listFee(P.v, n), get = afterTax(P.v * n), full = mine.length >= MARKET.maxListings, can = free >= n && c.gold >= fee && !full;
      form = `${this.head(sel.id)}${this.refLine(sel.id)}
        <div class="sv-have"><span>วางขายได้</span><b>${fmt(free)} ชิ้น</b></div>${free > 1 ? html : ''}${P.html}${this.suggest(sel.id, sel.id)}
        <div class="sv-have"><span>ค่าวางแผง (ไม่คืน)</span><b>฿${fmt(fee)}</b></div>
        <div class="sv-total"><span>ขายหมดได้รับ <small>(หัก ${MARKET.tax * 100}%)</small></span><b>฿${fmt(get)}</b></div>
        <button class="btn primary sv-go" data-lgo="${esc(sel.id)}" data-n="${n}" data-p="${P.v}" ${can ? '' : 'disabled'}>${full ? `แผงเต็ม (${MARKET.maxListings})` : !free ? 'ของนี้ล็อก/ติดชุด A-B' : `วางแผง ${fmt(n)} ชิ้น`}</button>`;
    }
    el.innerHTML = `<div class="sv-split mk"><div class="sv-left">${filterBarHtml(c, f, bag, { sortRow: false })}
      <div class="ro-grid sell-grid mk-bag">${grid}</div>
      <div class="sv-gh"><b>แผงของฉัน</b><small>${mine.length}/${MARKET.maxListings} · ฝากขาย ${MARKET.hours} ชม. · ขายได้แม้ออฟไลน์ · เงินเข้ากล่องรับของ</small></div><div class="mk-mylist">${myRows || '<p class="empty">ยังไม่มีของวางขาย</p>'}</div></div>
      <div class="sv-right">${form}</div></div>`;
    const redraw = () => { const g = el.querySelector('.mk-bag'), top = g?.scrollTop || 0; this.mylist(el); const g2 = el.querySelector('.mk-bag'); if (g2) g2.scrollTop = top; };
    bindFilterBar(el, f, redraw, this.scene);
    el.querySelectorAll('[data-lsel]').forEach((d) => (d.onclick = () => { this.sel.mylist = d.dataset.lsel; this.click(); redraw(); }));
    if (sel) { this.bindQty(el, `l${sel.id}`, redraw); this.bindPrice(el, sel.id, redraw); }
    el.querySelector('[data-lgo]')?.addEventListener('click', (e) => { const b = e.currentTarget; this.mk('list', { item: b.dataset.lgo, qty: +b.dataset.n, price: +b.dataset.p }).then((r) => { if (r.ok) this.sel.mylist = null; this.done(r); }); });
    el.querySelectorAll('[data-lcancel]').forEach((b) => (b.onclick = () => this.mk('cancel', { id: +b.dataset.lcancel }).then((r) => this.done(r))));
  }

  // ============================================================
  //  ป้ายรับซื้อ: ขายให้ป้ายของคนอื่น · ตั้งป้ายของฉัน
  // ============================================================
  orders(el) {
    if (!this.st) return this.loading(el);
    this.fetch();
    const c = this.c, now = this.now();
    const all = this.st.orders.map(L).sort((a, b) => (Inv.freeQty(c, b.item) > 0) - (Inv.freeQty(c, a.item) > 0) || b.price - a.price);
    const rows = all.map((o) => { const it = ITEMS[o.item], have = Inv.freeQty(c, o.item);
      return `<div class="sv-row mk-row mk-ord${have ? ' can' : ''}" data-tip-item="${o.item}"><span class="sv-ic">${itemIcon(o.item, it.icon)}</span>
        <span class="sv-tx"><b class="${rn(it)}">${esc(it.nameTh)}</b><small>${esc(o.name)} รับ ${fmt(o.qty)} ชิ้น · เหลือ ${left(o.exp - now)}${have ? ` · <em>คุณมี ${fmt(have)}</em>` : ''}</small></span>
        <span class="sv-pr">฿${fmt(o.price)}</span><button class="btn sm ${have ? 'primary' : ''}" data-ofill="${o.id}" ${have ? '' : 'disabled'}>ขายให้</button></div>`; }).join('');
    // ตั้งป้าย: ค้นหาไอเทม
    const q = this.q.trim().toLowerCase();
    const hits = q ? Object.keys(ITEMS).filter((id) => !id.includes('@') && tradable(id) && ITEMS[id].nameTh.toLowerCase().includes(q)).slice(0, 24) : [];
    const pick = this.sel.order && ITEMS[this.sel.order] ? this.sel.order : null;
    let form = `<label class="mk-search"><input class="mk-q" type="search" placeholder="🔍 พิมพ์ชื่อของที่อยากได้…" value="${esc(this.q)}"></label>
      ${hits.length ? `<div class="mk-hits">${hits.map((id) => `<button class="mk-hit${pick === id ? ' on' : ''}" data-opick="${id}" data-tip-item="${id}">${itemIcon(id, ITEMS[id].icon)}<span>${esc(ITEMS[id].nameTh)}</span></button>`).join('')}</div>` : q ? '<p class="empty">ไม่พบไอเทม</p>' : ''}`;
    if (pick) {
      const def = this.st.hist?.[pick]?.[0] || Math.max(1, sellPrice(pick) * 2);
      const { n, html } = this.qtyBox(`o${pick}`, MARKET.maxQty), P = this.priceBox(`o${pick}`, def), escrow = P.v * n;
      const mineN = this.st.myOrders.length, full = mineN >= MARKET.maxOrders, can = c.gold >= escrow && !full;
      form += `${this.head(pick)}${this.refLine(pick)}${html}${P.html}${this.suggest(pick, `o${pick}`)}
        <div class="sv-total"><span>มัดจำ (คืนส่วนที่ไม่ได้ของ)</span><b class="${c.gold >= escrow ? '' : 'bad'}">฿${fmt(escrow)}</b></div>
        <button class="btn primary sv-go" data-ogo="${pick}" data-n="${n}" data-p="${P.v}" ${can ? '' : 'disabled'}>${full ? `ป้ายเต็ม (${MARKET.maxOrders})` : c.gold < escrow ? 'เงินไม่พอวางมัดจำ' : `ตั้งป้ายรับซื้อ ${fmt(n)} ชิ้น`}</button>`;
    }
    const my = this.st.myOrders.map(L).map((o) => { const it = ITEMS[o.item];
      return `<div class="mk-mine"><span class="sv-ic">${itemIcon(o.item, it?.icon)}</span><span class="sv-tx"><b>${esc(it?.nameTh)}</b><small>รับอีก ${fmt(o.qty)} · ชิ้นละ ฿${fmt(o.price)} · เหลือ ${left(o.exp - now)}</small></span><button class="btn sm ghost" data-ocancel="${o.id}">ปลดป้าย</button></div>`; }).join('');
    el.innerHTML = `<div class="sv-split mk"><div class="sv-left"><div class="sv-gh"><b>ป้ายรับซื้อจากผู้เล่น</b><small>${all.length} ป้าย · ขายได้ทันที (หัก ${MARKET.tax * 100}%) · ป้ายที่คุณมีของอยู่ขึ้นก่อน</small></div>
      <div class="sv-rows mk-rows">${rows || '<p class="empty">ยังไม่มีใครตั้งป้ายรับซื้อ</p>'}</div>
      <div class="sv-gh"><b>ป้ายของฉัน</b><small>${this.st.myOrders.length}/${MARKET.maxOrders} · ของที่ได้เข้ากล่องรับของ</small></div><div class="mk-mylist">${my || '<p class="empty">ยังไม่มีป้าย</p>'}</div></div>
      <div class="sv-right"><div class="sv-gh"><b>ตั้งป้ายรับซื้อของฉัน</b><small>วางมัดจำไว้ มีคนขายให้ ของเข้ากล่องรับของ</small></div>${form}</div></div>`;
    const redraw = () => { const Lf = el.querySelector('.mk-rows'), top = Lf?.scrollTop || 0; this.orders(el); const L2 = el.querySelector('.mk-rows'); if (L2) L2.scrollTop = top; };
    const qi = el.querySelector('.mk-q');
    if (qi) {
      qi.addEventListener('keydown', (e) => e.stopPropagation());
      qi.addEventListener('focus', () => { if (this.scene.input?.keyboard) this.scene.input.keyboard.enabled = false; });
      qi.addEventListener('blur', () => { if (this.scene.input?.keyboard) this.scene.input.keyboard.enabled = true; });
      qi.addEventListener('input', () => { this.q = qi.value; const pos = qi.selectionStart; redraw(); const q2 = el.querySelector('.mk-q'); q2?.focus(); try { q2?.setSelectionRange(pos, pos); } catch { /* */ } });
    }
    el.querySelectorAll('[data-opick]').forEach((b) => (b.onclick = () => { this.sel.order = b.dataset.opick; this.click(); redraw(); }));
    if (pick) { this.bindQty(el, `o${pick}`, redraw); this.bindPrice(el, `o${pick}`, redraw); }
    el.querySelector('[data-ogo]')?.addEventListener('click', (e) => { const b = e.currentTarget; this.mk('order', { item: b.dataset.ogo, qty: +b.dataset.n, price: +b.dataset.p }).then((r) => this.done(r)); });
    el.querySelectorAll('[data-ocancel]').forEach((b) => (b.onclick = () => this.mk('orderCancel', { id: +b.dataset.ocancel }).then((r) => this.done(r))));
    el.querySelectorAll('[data-ofill]').forEach((b) => (b.onclick = async () => {
      const o = all.find((x) => x.id === +b.dataset.ofill); if (!o) return;
      const max = Math.min(o.qty, Inv.freeQty(c, o.item)), it = ITEMS[o.item];
      const n = max > 1 ? await askQty({ title: `ขาย ${it.nameTh} ให้ ${o.name}`, icon: itemIcon(o.item, it.icon), max, def: max, unitPrice: Math.floor(o.price * (1 - MARKET.tax)), okText: 'ขาย' }) : max;
      if (n) this.mk('fill', { id: o.id, qty: n }).then((r) => this.done(r));
    }));
  }

  // ============================================================
  //  กล่องรับของ
  // ============================================================
  claim(el) {
    if (!this.st) return this.loading(el);
    const b = this.st.box, items = Object.entries(b?.items || {});
    el.innerHTML = `<div class="mk-box"><p class="greet">เงินที่ขายของได้ · ของที่ได้จากป้ายรับซื้อ · ของ/มัดจำที่หมดเวลา จะรออยู่ในกล่องนี้ (ไม่หาย)</p>
      ${b ? `<div class="mk-boxin">${b.gold ? `<div class="mk-bgold">💰 เงิน <b>฿${fmt(b.gold)}</b></div>` : ''}
        ${items.length ? `<div class="mk-bitems">${items.map(([id, q]) => `<div class="mk-bi${rc(ITEMS[id])}" data-tip-item="${id}">${itemIcon(id, ITEMS[id]?.icon)}<b>x${fmt(q)}</b><small>${esc(ITEMS[id]?.nameTh)}</small></div>`).join('')}</div>` : ''}
        <button class="btn primary sv-go" data-claim>รับทั้งหมด</button></div>` : '<p class="empty">กล่องว่าง</p>'}</div>`;
    el.querySelector('[data-claim]')?.addEventListener('click', () => this.mk('claim').then((r) => this.done(r)));
  }

  // ============================================================
  //  รับซื้อพิเศษประจำวัน (ป้าสา/ยายติ๋ม/ลุงดำ/แม่ช้อย)
  // ============================================================
  demand(el, shopId) {
    const c = this.c, npc = { pa_sa: 'cook', mae_kha: 'shop', lung_dam: 'smith', tailor: 'tailor' }[shopId];
    const d = demandOf(npc);
    if (!d) { el.innerHTML = '<p class="empty">วันนี้ไม่มีรายการรับซื้อ</p>'; return; }
    const it = ITEMS[d.item], rem = demandLeft(c, npc), sold = DEMAND.cap - rem, have = Inv.freeQty(c, d.item), max = Math.min(rem, have);
    const { n, html } = this.qtyBox(`d${npc}`, Math.max(1, max));
    const coins = Math.floor((sold + n) / DEMAND.perCoin) - Math.floor(sold / DEMAND.perCoin);
    const tomorrow = new Date(); tomorrow.setHours(24, 0, 0, 0);
    el.innerHTML = `<div class="sv-split mk"><div class="sv-left"><div class="dm-card">
      <p class="dm-line">“${esc(d.line)} <b>${esc(it.nameTh)}</b> ใครมีเอามาขายให้หน่อย จ่ายงามเลย!”</p>
      <div class="dm-item">${itemIcon(d.item, it.icon)}<span><b>${esc(it.nameTh)}</b><small>${esc(effLine(it))}</small></span></div>
      <div class="dm-price"><span>รับซื้อชิ้นละ <b>฿${fmt(d.price)}</b></span><small>ร้านปกติ ฿${fmt(sellPrice(d.item))} · แพงกว่า ${DEMAND.mul} เท่า</small></div>
      <div class="dm-bar"><i style="width:${(sold / DEMAND.cap) * 100}%"></i><span>ขายแล้ววันนี้ ${sold}/${DEMAND.cap}</span></div>
      <p class="hint">ทุก ${DEMAND.perCoin} ชิ้นได้ ${itemIcon(COIN, '🪙', { badge: false })} เบี้ยสำเภา 1 อัน (เอาไปแลกของดีที่นายห้างสำเภา) · รายการเปลี่ยนทุกเที่ยงคืน</p></div></div>
      <div class="sv-right">${this.head(d.item)}<div class="sv-have"><span>มีขายได้</span><b>${fmt(have)} ชิ้น</b></div>
        <div class="sv-have"><span>รับได้อีกวันนี้</span><b>${fmt(rem)} ชิ้น</b></div><div class="sv-fill"></div>
        ${max > 1 ? html : ''}<div class="sv-total"><span>ได้เงิน${coins ? ` + เบี้ย ${coins}` : ''}</span><b>฿${fmt(d.price * Math.min(n, Math.max(1, max)))}</b></div>
        <button class="btn primary sv-go" data-dsell="${npc}" data-n="${Math.min(n, Math.max(1, max))}" ${max > 0 ? '' : 'disabled'}>${!rem ? 'วันนี้รับครบแล้ว' : !have ? `ยังไม่มี${it.nameTh}` : `ขาย ${fmt(Math.min(n, max))} ชิ้น`}</button></div></div>`;
    const redraw = () => this.demand(el, shopId);
    this.bindQty(el, `d${npc}`, redraw);
    el.querySelector('[data-dsell]')?.addEventListener('click', (e) => { const b = e.currentTarget; this.scene.econ.act('demandSell', { npc: b.dataset.dsell, n: +b.dataset.n }).then((r) => this.done(r)); });
  }

  // ============================================================
  //  พ่อค้าเร่
  // ============================================================
  travelShop(el) {
    const t = this.travel, c = this.c;
    if (!t?.active) { el.innerHTML = '<p class="empty">พ่อค้าเร่เดินทางไปแล้ว รอรอบหน้านะ</p>'; return; }
    const cards = t.stock.map((s) => { const it = ITEMS[s.id]; if (!it) return '';
      const ok = c.gold >= s.price && s.qty > 0;
      return `<div class="tv-card${rc(it)}${s.qty ? '' : ' out'}" data-tip-item="${s.id}"><span class="tv-ic">${itemIcon(s.id, it.icon)}</span><b>${esc(it.nameTh)}</b><small>${esc(effLine(it))}</small>
        <span class="tv-left">เหลือ ${fmt(s.qty)}/${fmt(s.max)} ชิ้น (ทั้งเซิร์ฟ)</span><span class="sv-pr">฿${fmt(s.price)}</span>
        <button class="btn primary sm" data-tbuy="${s.id}" ${ok ? '' : 'disabled'}>${!s.qty ? 'หมดแล้ว' : ok ? 'ซื้อ' : 'เงินไม่พอ'}</button></div>`; }).join('');
    el.innerHTML = `<div class="tv-wrap"><div class="tv-head"><span>🛺 ตั้งร้านที่ <b>${esc(t.spotTh || '')}</b></span><span class="tv-timer" data-until="${t.until}">เก็บร้านใน ${left(t.until - Date.now())}</span>
      <small>ซื้อของชิ้นเดียวกันได้คนละ ${TRAVEL.perChar} ชิ้นต่อรอบ · ของหมดแล้วหมดเลย</small></div><div class="tv-grid">${cards}</div></div>`;
    el.querySelectorAll('[data-tbuy]').forEach((b) => (b.onclick = async () => {
      const s = t.stock.find((x) => x.id === b.dataset.tbuy), it = ITEMS[s.id];
      const max = Math.min(s.qty, TRAVEL.perChar, Math.floor(c.gold / s.price));
      const n = max > 1 ? await askQty({ title: `ซื้อ ${it.nameTh}`, icon: itemIcon(s.id, it.icon), max, def: 1, unitPrice: s.price, okText: 'ซื้อ' }) : 1;
      if (!n) return;
      if (s.price * n >= 1e6 && !(await ask({ title: `ซื้อ ${it.nameTh} x${n}?`, icon: '🛺', ok: `ซื้อ ฿${fmt(s.price * n)}`, text: `รวม ฿${fmt(s.price * n)}` }))) return;
      this.mk('travelBuy', { id: s.id, qty: n }).then((r) => this.done(r));
    }));
  }
}
