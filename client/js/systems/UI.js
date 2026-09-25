// ============================================================
//  UI – จัดการ HUD และหน้าต่าง DOM (สถานะ, กระเป๋า, ร้านค้า, แชท)
//  ใช้ HTML/CSS ซ้อนบน Canvas เพื่อให้ตัวหนังสือไทยคมชัด
// ============================================================
import { JOBS } from '/shared/data/classes.js';
import { ITEMS, SHOPS, sellPrice } from '/shared/data/items.js';
import { STAT_KEYS, STAT_INFO, expToNext } from '/shared/stats.js';
import { getDerived, allocateStat } from './Character.js';
import * as Inv from './Inventory.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SLOT_TH = { weapon: 'อาวุธ', armor: 'เสื้อ', accessory: 'เครื่องราง' };

export class UI {
  /** @param {Phaser.Scene} scene GameScene */
  constructor(scene) {
    this.scene = scene;
    this.shopTab = 'buy';
    this.shopId = null;
    this.hudCache = '';

    $('#hud').classList.remove('hidden');
    $('#chat').classList.remove('hidden');

    // ปุ่มเปิด/ปิดหน้าต่าง
    document.querySelectorAll('[data-open]').forEach((b) => (b.onclick = () => this.toggle(b.dataset.open)));
    document.querySelectorAll('.window .close').forEach((b) => (b.onclick = () => b.closest('.window').classList.add('hidden')));
    document.querySelectorAll('#shop-panel .tabs button').forEach((b) => (b.onclick = () => {
      this.shopTab = b.dataset.tab;
      document.querySelectorAll('#shop-panel .tabs button').forEach((x) => x.classList.toggle('active', x === b));
      this.renderShop();
    }));

    // แชท
    const input = $('#chat-input');
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        const text = input.value.trim();
        if (text) {
          if (scene.net.online) scene.net.sendChat(text);
          else this.chat({ name: scene.player.char.name, text }); // ออฟไลน์: แสดงเฉพาะเรา
        }
        input.value = '';
        input.blur();
      } else if (e.key === 'Escape') input.blur();
    });
    input.addEventListener('focus', () => (scene.input.keyboard.enabled = false));
    input.addEventListener('blur', () => (scene.input.keyboard.enabled = true));
  }

  get char() { return this.scene.player.char; }
  get typing() { return document.activeElement === $('#chat-input'); }

  focusChat() { $('#chat-input').focus(); }

  toggle(id, force) {
    const el = $('#' + id);
    const show = force ?? el.classList.contains('hidden');
    el.classList.toggle('hidden', !show);
    if (show) this.refreshPanels();
  }

  closeAll() { document.querySelectorAll('.window').forEach((w) => w.classList.add('hidden')); }
  anyOpen() { return [...document.querySelectorAll('.window')].some((w) => !w.classList.contains('hidden')); }

  // ---------------- HUD (อัปเดตเมื่อค่าเปลี่ยนเท่านั้น) ----------------
  updateHud() {
    const c = this.char, d = getDerived(c);
    const need = expToNext(c.level);
    const sig = [c.hp, c.mp, d.maxHp, d.maxMp, c.exp, c.level, c.gold, c.appearance.job, Inv.count(c, 'hp_s'), Inv.count(c, 'mp_s')].join('|');
    if (sig === this.hudCache) return;
    this.hudCache = sig;

    $('#hud-name').textContent = c.name;
    $('#hud-lv').textContent = c.level;
    $('#hud-job').textContent = JOBS[c.appearance.job].nameTh;
    $('#hud-hp').textContent = `HP ${Math.ceil(c.hp)} / ${d.maxHp}`;
    $('#hud-mp').textContent = `MP ${Math.floor(c.mp)} / ${d.maxMp}`;
    $('#hud-hp-fill').style.width = `${(c.hp / d.maxHp) * 100}%`;
    $('#hud-mp-fill').style.width = `${(c.mp / d.maxMp) * 100}%`;
    $('#hud-exp-fill').style.width = `${(c.exp / need) * 100}%`;
    $('#hud-gold').textContent = c.gold.toLocaleString();
    $('#quick-hp span').textContent = `${ITEMS.hp_s.icon} x${Inv.count(c, 'hp_s')}`;
    $('#quick-mp span').textContent = `${ITEMS.mp_s.icon} x${Inv.count(c, 'mp_s')}`;
  }

  setOnline(on, count = 0) {
    const el = $('#net-status');
    el.className = `net ${on ? 'on' : 'off'}`;
    el.textContent = on ? `● ออนไลน์ (${count + 1} คน)` : '● ออฟไลน์';
  }

  prompt(text) {
    const el = $('#prompt');
    el.classList.toggle('hidden', !text);
    if (text) el.textContent = text;
  }

  toast(msg, kind = '') {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = msg;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), 2400);
  }

  chat({ name, text }) {
    const log = $('#chat-log');
    const el = document.createElement('div');
    el.innerHTML = `<b>${esc(name)}:</b> ${esc(text)}`;
    log.appendChild(el);
    while (log.children.length > 8) log.firstChild.remove();
  }

  /** ผลลัพธ์จาก Inventory → แจ้งเตือน + รีเฟรช */
  result(r) {
    if (r.msg) this.toast(r.msg, r.ok ? '' : 'warn');
    if (r.jobChanged) this.scene.onAppearanceChanged();
    this.hudCache = '';
    this.refreshPanels();
    this.scene.saveSoon();
  }

  refreshPanels() {
    if (!$('#stats-panel').classList.contains('hidden')) this.renderStats();
    if (!$('#inv-panel').classList.contains('hidden')) this.renderInventory();
    if (!$('#shop-panel').classList.contains('hidden')) this.renderShop();
    this.updateHud();
  }

  // ---------------- หน้าต่างสถานะ ----------------
  renderStats() {
    const c = this.char, d = getDerived(c);
    $('#st-points').textContent = c.statPoints;
    $('#st-list').innerHTML = STAT_KEYS.map((k) => `
      <div class="stat-row">
        <span class="k">${k}</span>
        <span><div>${STAT_INFO[k].nameTh}</div><div class="d">${STAT_INFO[k].desc}</div></span>
        <span class="v">${c.stats[k]}</span>
        <button data-stat="${k}" ${c.statPoints ? '' : 'disabled'}>+</button>
      </div>`).join('');
    $('#st-list').querySelectorAll('button').forEach((b) => (b.onclick = () => {
      if (allocateStat(c, b.dataset.stat)) this.result({ ok: true });
    }));
    const pct = (v) => `${(v * 100).toFixed(1)}%`;
    const rows = [
      ['HP สูงสุด', d.maxHp], ['MP สูงสุด', d.maxMp],
      ['พลังโจมตีกายภาพ', d.patk], ['พลังเวทย์', d.matk],
      ['ความแม่นยำ', `${d.accuracy}%`], ['โอกาสคริติคอล', pct(d.critRate)],
      ['ความแรงคริติคอล', `x${d.critDmg.toFixed(2)}`], ['ป้องกัน / หลบ', `${d.def} / ${d.eva}`],
    ];
    $('#st-derived').innerHTML = rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  }

  // ---------------- กระเป๋า ----------------
  renderInventory() {
    const c = this.char;
    $('#inv-equip').innerHTML = Object.entries(c.equipment).map(([slot, id]) => `
      <div class="eq"><small>${SLOT_TH[slot]}</small>${id ? `${ITEMS[id].icon} ${ITEMS[id].nameTh} <button class="close" data-unequip="${slot}">✕</button>` : '—'}</div>`).join('');
    $('#inv-equip').querySelectorAll('[data-unequip]').forEach((b) => (b.onclick = () => this.result(Inv.unequip(c, b.dataset.unequip))));

    if (!c.inventory.length) { $('#inv-list').innerHTML = '<div class="empty">กระเป๋าว่างเปล่า</div>'; return; }
    $('#inv-list').innerHTML = c.inventory.map((s) => {
      const it = ITEMS[s.id];
      const action = { consumable: 'ใช้', weapon: 'สวม', armor: 'สวม', accessory: 'สวม', skin: c.appearance.job === it.job ? 'ใช้อยู่' : 'เปลี่ยนอาชีพ' }[it.type];
      const job = it.jobs ? ` · ${it.jobs.map((j) => JOBS[j].nameTh).join('/')}` : '';
      return `<div class="item"><span class="ic">${it.icon}</span>
        <span>${esc(it.nameTh)} <span class="meta">x${s.qty}${job}</span></span>
        <span class="price">฿${sellPrice(s.id)}</span>
        ${action ? `<button data-use="${s.id}" ${action === 'ใช้อยู่' ? 'disabled' : ''}>${action}</button>` : '<span></span>'}</div>`;
    }).join('');
    $('#inv-list').querySelectorAll('[data-use]').forEach((b) => (b.onclick = () => this.result(Inv.useItem(c, b.dataset.use))));
  }

  // ---------------- ร้านค้า NPC ----------------
  openShop(shopId) {
    this.shopId = shopId;
    const shop = SHOPS[shopId];
    $('#shop-title').textContent = shop.nameTh;
    $('#shop-greet').textContent = `“${shop.greeting}”`;
    this.toggle('shop-panel', true);
  }

  renderShop() {
    const c = this.char, shop = SHOPS[this.shopId];
    $('#shop-gold').textContent = c.gold.toLocaleString();
    let html;
    if (this.shopTab === 'buy') {
      html = shop.stock.map((id) => {
        const it = ITEMS[id];
        const owned = it.type === 'skin' && Inv.count(c, id);
        const job = it.jobs ? `<span class="meta"> · ${it.jobs.map((j) => JOBS[j].nameTh).join('/')}</span>` : '';
        const bonus = it.bonus ? `<span class="meta"> ${Object.entries(it.bonus).map(([k, v]) => `${k.toUpperCase()}+${k === 'crit' ? v * 100 + '%' : v}`).join(' ')}</span>` : '';
        return `<div class="item"><span class="ic">${it.icon}</span><span>${esc(it.nameTh)}${job}${bonus}</span>
          <span class="price">฿${it.price}</span>
          <button data-buy="${id}" ${owned || c.gold < it.price ? 'disabled' : ''}>${owned ? 'มีแล้ว' : 'ซื้อ'}</button></div>`;
      }).join('');
    } else {
      const sellable = c.inventory.filter((s) => ITEMS[s.id].type !== 'skin');
      html = sellable.length ? sellable.map((s) => {
        const it = ITEMS[s.id];
        return `<div class="item"><span class="ic">${it.icon}</span><span>${esc(it.nameTh)} <span class="meta">x${s.qty}</span></span>
          <span class="price">฿${sellPrice(s.id)}</span><button data-sell="${s.id}">ขาย</button></div>`;
      }).join('') : '<div class="empty">ไม่มีของให้ขาย</div>';
    }
    $('#shop-list').innerHTML = html;
    $('#shop-list').querySelectorAll('[data-buy]').forEach((b) => (b.onclick = () => this.result(Inv.buy(c, b.dataset.buy))));
    $('#shop-list').querySelectorAll('[data-sell]').forEach((b) => (b.onclick = () => this.result(Inv.sell(c, b.dataset.sell))));
  }
}
