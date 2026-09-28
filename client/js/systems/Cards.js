// ============================================================
//  Cards – หน้าต่างการ์ดผี (ช่องการ์ด · สมุดสะสม) + แท็บแลกการ์ดที่ร้านยายติ๋ม + ป๊อปอัปได้การ์ด
// ============================================================
import { ITEMS } from '/shared/data/items.js';
import { CARDS, CARD_BY_ID, CARD_SLOT_TH, SLOT_CARD, CARD_SOCKET_ENH, BOOK_TIERS, socketCount, cardRemoveCost, cardText, cardBonus, bookCount } from '/shared/data/cards.js';
import * as Inv from './Inventory.js';
import { cardGain } from './ItemFilter.js';
import { ask, notice } from './Dialog.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const EQ_TH = { weapon: 'อาวุธ', armor: 'ชุดเกราะ', accessory: 'เครื่องประดับ 1', accessory2: 'เครื่องประดับ 2' };
const art = (cd) => `assets/cards/${cd.mon}.png`;

/** การ์ด 1 ใบ (HTML) · opts: { unknown, mini, count, pick, selected } */
export function cardHtml(cd, o = {}) {
  if (!cd) return '';
  const cls = ['tcard', `s-${cd.slot}`, cd.elite ? 'elite' : '', o.unknown ? 'unknown' : '', o.mini ? 'mini' : '', o.selected ? 'sel' : '', o.pick ? 'pick' : ''].filter(Boolean).join(' ');
  const data = o.pick ? ` data-pick="${cd.id}"` : '';
  if (o.mini) return `<div class="${cls}"${data} title="${esc(cd.nameTh)} · ${esc(cardText(cd))}"><div class="tc-art"><img class="px" src="${art(cd)}" alt=""></div><div class="tc-name">${esc(cd.monTh)}</div></div>`;
  return `<div class="${cls}"${data}>
    <div class="tc-top"><span class="tc-lv">Lv.${cd.level}</span><span class="tc-slot">${CARD_SLOT_TH[cd.slot]}</span></div>
    <div class="tc-art"><img class="px" src="${art(cd)}" alt="">${o.count ? `<span class="tc-count">x${o.count}</span>` : ''}</div>
    <div class="tc-name">${o.unknown ? '？？？' : esc(cd.nameTh)}</div>
    <div class="tc-eff">${o.unknown ? `ล่า${esc(cd.monTh)}เพื่อค้นพบ` : esc(cardText(cd))}</div>
    ${o.unknown ? '' : `<div class="tc-flavor">“${esc(cd.flavor)}”</div>`}
  </div>`;
}

export class CardUI {
  constructor(ui) {
    this.ui = ui;
    this.tab = 'sockets';
    this.pickSlot = null;            // ช่องสวมใส่ที่กำลังเลือกการ์ดใส่
    this.tradeSel = [];
    $('#card-tabs').onclick = (e) => {
      const b = e.target.closest('button[data-ct]'); if (!b) return;
      this.tab = b.dataset.ct; this.pickSlot = null; this.ui.scene.sfx.play('click'); this.render();
    };
  }
  get char() { return this.ui.char; }
  get scene() { return this.ui.scene; }

  /** เปิดหน้าต่าง (tab: sockets | book) · type = ชนิดการ์ดที่อยากใส่ (เลือกช่องให้อัตโนมัติ) */
  open(tab = 'sockets', cardId = null) {
    this.tab = tab;
    this.pickSlot = null;
    if (cardId && CARD_BY_ID[cardId]) {
      const t = CARD_BY_ID[cardId].slot, c = this.char;
      this.pickSlot = Object.keys(SLOT_CARD).find((s) => SLOT_CARD[s] === t && c.equipment[s] && (c.cards?.[s] || []).length < socketCount(s, c.enhance?.[s] || 0))
        || Object.keys(SLOT_CARD).find((s) => SLOT_CARD[s] === t);
    }
    this.ui.toggle('card-panel', true);
    this.render();
  }

  render() {
    if ($('#card-panel').classList.contains('hidden')) return;
    $('#card-tabs').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.ct === this.tab));
    if (this.tab === 'book') return this.renderBook($('#card-body'));
    return this.renderSockets($('#card-body'));
  }

  // ---------------- ช่องการ์ด ----------------
  renderSockets(el) {
    const c = this.char;
    const rows = Object.keys(SLOT_CARD).map((slot) => {
      const id = c.equipment[slot], enh = c.enhance?.[slot] || 0, n = socketCount(slot, enh), list = c.cards?.[slot] || [];
      const socks = [0, 1].map((i) => {
        const cd = CARD_BY_ID[list[i]];
        if (i >= n) return (slot === 'weapon' || slot === 'armor') ? `<div class="sock locked" title="ตีบวกถึง +${CARD_SOCKET_ENH} ที่ลุงดำเพื่อเปิดช่อง">🔒<small>+${CARD_SOCKET_ENH}</small></div>` : '';
        if (cd) return `<div class="sock full" data-out="${slot}" data-i="${i}" title="คลิกเพื่อถอด (฿${cardRemoveCost(cd.id).toLocaleString()})">${cardHtml(cd, { mini: true })}<span class="sock-x">ถอด</span></div>`;
        return `<div class="sock empty ${this.pickSlot === slot ? 'on' : ''}" data-in="${slot}" title="ใส่การ์ด${CARD_SLOT_TH[SLOT_CARD[slot]]}">＋</div>`;
      }).join('');
      const bonus = list.slice(0, n).map((x) => CARD_BY_ID[x]).filter(Boolean).map(cardText).join(' · ');
      return `<div class="cs-row ${id ? '' : 'noitem'}">
        <div class="cs-slot"><small>${EQ_TH[slot]}</small><b>${id ? `${esc(ITEMS[id].nameTh)}${enh ? ` <span class="enh">+${enh}</span>` : ''}` : 'ยังไม่ได้สวม'}</b>
          <span class="meta">${id ? (bonus || `ใส่การ์ด${CARD_SLOT_TH[SLOT_CARD[slot]]}ได้ ${n} ใบ`) : (list.length ? 'การ์ดไม่มีผลจนกว่าจะสวมของในช่องนี้' : '—')}</span></div>
        <div class="cs-socks">${socks}</div>
      </div>`;
    }).join('');

    // รายการการ์ดในกระเป๋าที่ใส่ช่องที่เลือกได้
    let picker = '';
    if (this.pickSlot) {
      const type = SLOT_CARD[this.pickSlot];
      const have = c.inventory.filter((s) => CARD_BY_ID[s.id]?.slot === type).map((s) => ({ ...s, g: cardGain(c, this.pickSlot, s.id) ?? 0 })).sort((a, b) => b.g - a.g);   // ดีสุดก่อน
      picker = `<div class="cs-pick"><div class="cs-pick-h">เลือกการ์ด${CARD_SLOT_TH[type]}ใส่ช่อง <b>${EQ_TH[this.pickSlot]}</b> <button class="btn ghost sm" data-cancel>ยกเลิก</button></div>
        ${have.length ? `<div class="tc-grid">${have.map((s) => `<div class="tc-wrap">${cardHtml(CARD_BY_ID[s.id], { count: s.qty, pick: true })}<b class="tc-gain ${s.g > 0 ? 'up' : ''}">⚔ ${s.g > 0 ? '+' : ''}${s.g.toLocaleString('en-US')}</b></div>`).join('')}</div>`
          : `<div class="empty">ไม่มีการ์ด${CARD_SLOT_TH[type]}ในกระเป๋า · ล่าผีเพื่อสะสม (ดรอป 0.5%)</div>`}</div>`;
    }
    const { bonus, econ } = cardBonus(c);
    const tot = cardText({ bonus, econ: Object.fromEntries(Object.entries(econ).filter(([, v]) => v)) });
    const inBag = c.inventory.filter((s) => CARD_BY_ID[s.id]).reduce((a, s) => a + s.qty, 0);
    el.innerHTML = `<p class="greet">การ์ดติดกับ<b>ช่องสวมใส่</b> (เหมือนตีบวก) — เปลี่ยนอาวุธ/เสื้อแล้วการ์ดยังอยู่ · อาวุธ/เสื้อตีบวก +${CARD_SOCKET_ENH} ได้ช่องที่ 2</p>
      <div class="cs-list">${rows}</div>${picker}
      <div class="cs-total"><span>โบนัสการ์ด + สมุดสะสม</span><b>${tot || '—'}</b></div>
      <div class="meta cs-foot">การ์ดในกระเป๋า ${inBag} ใบ · ขาย/แลก 3→1 ได้ที่ร้านยายติ๋ม</div>`;
    el.querySelectorAll('[data-in]').forEach((b) => (b.onclick = () => { this.pickSlot = this.pickSlot === b.dataset.in ? null : b.dataset.in; this.scene.sfx.play('click'); this.render(); }));
    if (this.pickSlot) el.querySelector('.cs-pick')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    el.querySelector('[data-cancel]')?.addEventListener('click', () => { this.pickSlot = null; this.render(); });
    el.querySelectorAll('[data-pick]').forEach((b) => (b.onclick = () => {
      const slot = this.pickSlot;
      this.pickSlot = null; this.scene.sfx.play('buy');
      this.ui.result(this.scene.econ.act('cardIn', { slot, id: b.dataset.pick }));
    }));
    el.querySelectorAll('[data-out]').forEach((b) => (b.onclick = async () => {
      const slot = b.dataset.out, i = +b.dataset.i, cd = CARD_BY_ID[c.cards?.[slot]?.[i]];
      if (!cd) return;
      if (!(await ask({ title: `ถอด${cd.nameTh}คืนกระเป๋า?`, icon: '🃏', ok: 'ถอดการ์ด', text: `ค่าถอด ฿${cardRemoveCost(cd.id).toLocaleString()}` }))) return;
      this.ui.result(this.scene.econ.act('cardOut', { slot, idx: i }));
    }));
  }

  // ---------------- สมุดสะสม ----------------
  renderBook(el) {
    const c = this.char, book = c.cardBook || {}, n = bookCount(c), total = CARDS.length;
    const next = BOOK_TIERS.find((t) => n < t.n);
    el.innerHTML = `<div class="cb-head"><b>สะสมแล้ว ${n} / ${total} ชนิด</b><div class="cb-bar"><i style="width:${(n / total) * 100}%"></i></div>
        <span class="meta">${next ? `อีก ${next.n - n} ชนิด → ${next.text}` : 'สะสมครบทุกชนิดแล้ว!'}</span></div>
      <div class="cb-tiers">${BOOK_TIERS.map((t) => `<span class="${n >= t.n ? 'on' : ''}">${n >= t.n ? '✔' : '○'} ${t.n} ชนิด: ${t.text}</span>`).join('')}</div>
      <div class="tc-grid book">${CARDS.map((cd) => cardHtml(cd, { unknown: !book[cd.id], count: Inv.count(c, cd.id) })).join('')}</div>
      <div class="meta cs-foot">ผีทั่วไปดรอปการ์ด 0.5% · ผีหัวหน้า 1.2% · บอส 20% (บัฟดรอปช่วยได้สูงสุด ×1.5) · การ์ดที่ได้ครั้งแรกจะถูกบันทึกในสมุดถาวร (ขายไปแล้วก็ยังนับ)</div>`;
  }

  // ---------------- แท็บแลกการ์ด (ร้านยายติ๋ม) ----------------
  renderTrade(el) {
    const c = this.char;
    const have = c.inventory.filter((s) => CARD_BY_ID[s.id]);
    const left = (id) => (have.find((s) => s.id === id)?.qty || 0) - this.tradeSel.filter((x) => x === id).length;
    this.tradeSel = this.tradeSel.filter((id, i, a) => a.slice(0, i + 1).filter((x) => x === id).length <= (have.find((s) => s.id === id)?.qty || 0));
    const slots = [0, 1, 2].map((i) => { const cd = CARD_BY_ID[this.tradeSel[i]];
      return cd ? `<div class="tr-slot full" data-unsel="${i}">${cardHtml(cd, { mini: true })}</div>` : '<div class="tr-slot">?</div>'; }).join('');
    el.innerHTML = `<p class="greet">“เอาการ์ดผีมา 3 ใบ ยายจะแลกใบใหม่ให้ 1 ใบ… สุ่มเอานะหลาน (ไม่รวมการ์ดผีหัวหน้า)”</p>
      <div class="ct-row"><div class="ct-slots">${slots}</div><span class="ct-arrow">➜</span><div class="tr-slot big">🃏</div>
        <button class="btn primary" id="ct-go" ${this.tradeSel.length === 3 ? '' : 'disabled'}>แลกการ์ด</button></div>
      ${have.length ? `<div class="tc-grid">${have.map((s) => { const l = left(s.id); return l > 0 ? cardHtml(CARD_BY_ID[s.id], { count: l, pick: true }) : ''; }).join('')}</div>`
        : '<div class="empty">ยังไม่มีการ์ดในกระเป๋า · ขายการ์ดได้ที่แท็บ "ขาย"</div>'}`;
    el.querySelectorAll('[data-pick]').forEach((b) => (b.onclick = () => { if (this.tradeSel.length < 3) { this.tradeSel.push(b.dataset.pick); this.scene.sfx.play('click'); this.renderTrade(el); } }));
    el.querySelectorAll('[data-unsel]').forEach((b) => (b.onclick = () => { this.tradeSel.splice(+b.dataset.unsel, 1); this.renderTrade(el); }));
    $('#ct-go')?.addEventListener('click', async () => {
      const ids = [...this.tradeSel];
      this.tradeSel = [];
      const r = await this.scene.econ.act('cardTrade', { ids });
      this.ui.result(r);
      if (r?.ok && r.card) this.showGet(r.card, r.isNew);
    });
  }

  // ---------------- ป๊อปอัปได้การ์ด ----------------
  showGet(id, isNew = false) {
    const cd = CARD_BY_ID[id];
    if (!cd) return;
    this.scene.sfx.play('blessing');
    const box = document.createElement('div');
    box.className = 'card-get';
    box.innerHTML = `<div class="cg-ray"></div><div class="cg-inner">${cardHtml(cd)}<div class="cg-title">${isNew ? '✨ การ์ดใบใหม่!' : 'ได้รับการ์ด!'}</div>
      <div class="cg-sub">${esc(cd.nameTh)} · ใส่ได้ที่${CARD_SLOT_TH[cd.slot]} (กด O)</div></div>`;
    box.onclick = () => box.remove();
    $('#ui').appendChild(box);
    setTimeout(() => box.classList.add('out'), 3600);
    setTimeout(() => box.remove(), 4200);
  }
}
