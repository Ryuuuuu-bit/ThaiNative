// ============================================================
//  TdSocial – สังคมในโลกอยุธยา (top-down): ปาร์ตี้ · เทรด · เพื่อน · อันดับ · ฉายา
//  ข้อมูลกลางอยู่ที่ server (server/social.js) ไฟล์นี้ทำหน้าที่แสดงผล + ส่งคำสั่ง
// ============================================================
import { ITEMS, sellPrice } from '/shared/data/items.js';
import { JOBS } from '/shared/data/classes.js';
import { count, tradeLock } from '../systems/Inventory.js';
import { itemIcon, makeText } from '../systems/util.js';
import { inlineStats } from '../systems/ItemTip.js';
import { baseItemId } from '/shared/data/items.js';
import { TITLE_BY_ID } from '/shared/data/titles.js';
import { newFilter, applyFilter, filterBarHtml, bindFilterBar } from '../systems/ItemFilter.js';
import { combatPower } from '/shared/character.js';
import { ask } from '../systems/Dialog.js';
import { PARTY } from '/shared/constants.js';

const $ = (s) => document.querySelector(s);
const JOB_ICON = { swordman: '⚔️', mage: '🔮', archer: '🏹', boxer: '🥊', healer: '🌿' };
const TRADE_SLOTS = 10;
const GEAR_TYPES = new Set(['weapon', 'armor', 'helm', 'gloves', 'boots', 'belt', 'accessory', 'costume', 'card', 'flask']);
const USE_TYPES = new Set(['consumable', 'food', 'home', 'reset', 'reskill', 'rename', 'offering']);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class TdSocial {
  /** @param {Phaser.Scene} scene TopDownScene */
  constructor(scene) {
    this.scene = scene;
    this.party = null;         // { id, leader, members:[...] }
    this.trade = null;         // trade:state ล่าสุด
    this.myOffer = { items: [], gold: 0 };
    this.inviteQueue = [];
    this.bindDom();
    this.bindNet();
  }

  get net() { return this.scene.net; }
  get player() { return this.scene.player; }
  get ui() { return this.scene.ui; }
  get selfId() { return this.net.selfId; }

  // ============================================================
  //  DOM
  // ============================================================
  bindDom() {
    // เมนูผู้เล่น
    $('#player-menu').onclick = (e) => {
      const btn = e.target.closest?.('[data-act]');                 // แตะโดนไอคอนในปุ่มก็นับ (ไอคอนเป็น element ซ้อนข้างใน)
      const act = btn?.dataset.act;
      if (!act || btn.disabled) return;
      const id = this.menuTarget;
      $('#player-menu').classList.add('hidden');
      if (act === 'party') this.invite(id);
      if (act === 'trade') this.requestTrade(id);
      if (act === 'friend') this.addFriend(id);
      if (act === 'whisper') { const nm = this.scene.remotes.get(id)?.name || this.menuName; if (nm) this.ui.chatBox?.whisperTo(nm); }
    };
    // เทรด
    $('#tr-gold').addEventListener('keydown', (e) => e.stopPropagation());
    $('#tr-gold').addEventListener('focus', () => (this.scene.input.keyboard.enabled = false));
    $('#tr-gold').addEventListener('blur', () => (this.scene.input.keyboard.enabled = true));
    $('#tr-gold').addEventListener('change', () => {
      const g = Math.max(0, Math.min(this.player.char.gold, Math.floor(+$('#tr-gold').value || 0)));
      $('#tr-gold').value = g;
      this.myOffer.gold = g;
      this.sendOffer();
    });
    $('#tr-lock').onclick = () => { this.scene.sfx.play('click'); this.net.send('trade:lock'); };
    $('#tr-confirm').onclick = () => { this.scene.sfx.play('click'); this.net.send('trade:confirm'); };
    $('#tr-cancel').onclick = $('#tr-x').onclick = () => this.net.send('trade:cancel');
    const addToOffer = (id, all) => {
      if (!id || this.trade?.locked?.[this.selfId]) return;
      const have = count(this.player.char, id);
      const ex = this.myOffer.items.find((x) => x.id === id);
      const cur = ex?.qty || 0;
      const add = all ? have - cur : 1;
      if (cur + add > have || add <= 0) return;
      if (ex) ex.qty += add; else if (this.myOffer.items.length < TRADE_SLOTS) this.myOffer.items.push({ id, qty: add }); else return this.ui.toast(`ใส่ได้สูงสุด ${TRADE_SLOTS} ช่อง`, 'warn');
      this.scene.sfx.play('click');
      this.sendOffer();
    };
    $('#tr-inv').onclick = (e) => { const b = e.target.closest('[data-id]'); if (b) addToOffer(b.dataset.id, e.shiftKey); };
    // ลากจากกระเป๋า → ช่องข้อเสนอของเรา
    $('#tr-inv').addEventListener('dragstart', (e) => { const b = e.target.closest('[data-id]'); if (!b?.dataset.id) return e.preventDefault(); e.dataTransfer.setData('text/tn-item', b.dataset.id); e.dataTransfer.effectAllowed = 'copy'; });
    $('#tr-my').addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('text/tn-item')) { e.preventDefault(); $('#tr-my').classList.add('drop'); } });
    $('#tr-my').addEventListener('dragleave', () => $('#tr-my').classList.remove('drop'));
    $('#tr-my').addEventListener('drop', (e) => { e.preventDefault(); $('#tr-my').classList.remove('drop'); addToOffer(e.dataTransfer.getData('text/tn-item'), e.shiftKey); });
    // ตัวกรองกระเป๋า: วาดใน renderTrade (ItemFilter)
    $('#tr-inv-q')?.classList.add('hidden');
    $('#tr-my').onclick = (e) => {
      const b = e.target.closest('[data-id]');
      if (!b || this.trade?.locked?.[this.selfId]) return;
      const ex = this.myOffer.items.find((x) => x.id === b.dataset.id);
      if (!ex) return;
      ex.qty--;
      if (ex.qty <= 0) this.myOffer.items = this.myOffer.items.filter((x) => x !== ex);
      this.sendOffer();
    };
    // ปาร์ตี้ / ผู้เล่น (P)
    // กันปุ่มหายระหว่างกด: ชี้เมาส์อยู่บนแผง/เพิ่งแตะ → หยุดวาดรายชื่อใหม่ชั่วคราว (ลานบอสคนเดินเยอะ รายชื่อเปลี่ยนทุกวิ)
    $('#social-panel').addEventListener('pointerenter', () => (this.socHover = true));
    $('#social-panel').addEventListener('pointerleave', () => (this.socHover = false));
    $('#social-panel').addEventListener('pointerdown', () => (this.socHoldAt = performance.now()), true);
    $('#social-panel').addEventListener('click', (e) => {
      const w = e.target.closest('[data-act="whisper"]');
      if (w) { this.ui.closeAll(); this.ui.chatBox?.whisperTo(w.dataset.name); return; }
      const b = e.target.closest('button[data-act]');
      if (!b) return;
      const { act, id } = b.dataset;
      this.scene.sfx.play('click');
      if (act === 'invite') this.invite(id);
      if (act === 'trade') this.requestTrade(id);
      if (act === 'leave') this.net.send('party:leave');
      if (act === 'kick') this.net.send('party:kick', { id });
      if (act === 'friend') this.addFriend(id);
      if (act === 'unfriend') { ask({ title: 'ลบเพื่อนคนนี้?', icon: '👥', danger: true, ok: 'ลบเพื่อน' }).then((y) => { if (y) this.net.send('friends:del', { acc: +b.dataset.acc }); }); }
    });
    // แท็บแผงสังคม
    document.querySelectorAll('[data-soctab]').forEach((b) => (b.onclick = () => {
      this.socTab = b.dataset.soctab;
      document.querySelectorAll('[data-soctab]').forEach((x) => x.classList.toggle('active', x === b));
      document.querySelectorAll('.soc-page').forEach((pg) => pg.classList.toggle('hidden', pg.dataset.page !== this.socTab));
      this.scene.sfx.play('click');
      this.renderSocialPanel();
    }));
  }

  addFriend(id) {
    if (!this.net.online) return this.ui.toast('ต้องออนไลน์ก่อน', 'warn');
    this.net.send('friends:add', { id });
  }
  refreshFriends() { if (this.net.online) this.net.send('friends:get'); }

  /** ได้ฉายาใหม่ */
  onNewTitles(ids) {
    // server ส่งฉายามาทีละก้อน (ฉายาเลเวล/อันดับ/ค่าพลังมาห่างกันไม่กี่วิ) → รวบ 1.5 วิแล้วแจ้งทีเดียว
    (this.titleQ ||= []).push(...ids);
    clearTimeout(this.titleT);
    this.titleT = setTimeout(() => { const q = [...new Set(this.titleQ)]; this.titleQ = []; this.showNewTitles(q); }, 1500);
  }
  showNewTitles(ids) {
    const ts = ids.filter((id) => id !== 'rookie').map((id) => TITLE_BY_ID[id]).filter(Boolean);
    if (!ts.length) return;
    // ได้หลายอันพร้อมกัน (เช่นตัวใหม่/ติดอันดับ) → รวมเป็นแจ้งเตือนเดียว ไม่ให้เด้งเต็มจอ
    if (ts.length === 1) {
      this.ui.banner(`🏅 ได้รับฉายา “${ts[0].nameTh}”`);
      this.ui.toast(`🏅 ฉายาใหม่: ${ts[0].nameTh} — เลือกใช้ได้ที่แผงสังคม (P) › ฉายา`, '', 6000);
    } else {
      this.ui.banner(`🏅 ได้รับฉายาใหม่ ${ts.length} อัน`, ts.slice(0, 3).map((t) => `“${t.nameTh}”`).join(' · ') + (ts.length > 3 ? ' …' : ''));
      this.ui.toast(`🏅 ฉายาใหม่ ${ts.length} อัน: ${ts.map((t) => t.nameTh).join(', ')} — เลือกใช้ได้ที่แผงสังคม (P) › ฉายา`, '', 7000);
    }
    this.scene.sfx.play('victory');
  }

  /** คลิกที่ผู้เล่นอื่น → เมนู */
  openPlayerMenu(remote, pointer) {
    this.menuTarget = remote.id; this.menuName = remote.name;
    const m = $('#player-menu');
    $('#pm-name').textContent = remote.level ? `${remote.name} · Lv.${remote.level}` : remote.name;
    const rect = this.scene.game.canvas.getBoundingClientRect();
    const sx = rect.width / this.scene.scale.width;
    m.style.left = `${Math.min(pointer.x * sx, rect.width - 170)}px`;
    m.style.top = `${Math.max(10, pointer.y * sx - 90)}px`;
    m.querySelector('[data-act=party]').disabled = !!this.party && this.party.members.some((x) => x.id === remote.id);
    m.classList.remove('hidden');
  }

  invite(id) {
    if (!this.net.online) return this.ui.toast('ต้องออนไลน์ก่อน', 'warn');
    this.net.send('party:invite', { id });
  }
  requestTrade(id) {
    if (!this.net.online) return this.ui.toast('ต้องออนไลน์ก่อน', 'warn');
    if (!this.player.alive) return;
    this.net.send('trade:request', { id });
  }
  shareExp() {}
  partyChat(text) { this.net.send('party:chat', text); }

  // ---------------- คำเชิญ (ปาร์ตี้/เทรด) ใช้กล่องเดียวกัน ----------------
  ask(text, onYes, onNo) {
    this.inviteQueue.push({ text, onYes, onNo });
    if (this.inviteQueue.length === 1) this.showNextInvite();
  }
  showNextInvite() {
    const inv = this.inviteQueue[0];
    const box = $('#invite-box');
    if (!inv) return box.classList.add('hidden');
    $('#invite-text').innerHTML = inv.text;
    box.classList.remove('hidden');
    this.scene.sfx.play('invite');
    const done = (yes) => {
      clearTimeout(this.inviteT);
      this.inviteQueue.shift();
      (yes ? inv.onYes : inv.onNo)?.();
      this.showNextInvite();
    };
    $('#invite-yes').onclick = () => done(true);
    $('#invite-no').onclick = () => done(false);
    const bar = $('#invite-timer');
    bar.style.transition = 'none'; bar.style.width = '100%';
    requestAnimationFrame(() => { bar.style.transition = 'width 25s linear'; bar.style.width = '0%'; });
    clearTimeout(this.inviteT);
    this.inviteT = setTimeout(() => done(false), 25000);
  }

  // ============================================================
  //  Network events
  // ============================================================
  bindNet() {
    const n = this.net;
    n.on('party:invite', ({ fromId, fromName }) => this.ask(
      `<b>${esc(fromName)}</b> เชิญคุณเข้าร่วมปาร์ตี้`,
      () => n.send('party:respond', { fromId, accept: true }),
      () => n.send('party:respond', { fromId, accept: false }),
    ))
      .on('party:state', (st) => { this.party = st; this.renderParty(); })
      .on('party:exp', ({ amount, ups }) => {
        const t = makeText(this.scene, this.player.x, this.player.y - 44, `+${amount} EXP (ปาร์ตี้)`, { fontSize: '7px', color: '#aed6f1' }).setOrigin(0.5).setDepth(99990);
        this.scene.tweens.add({ targets: t, y: t.y - 20, alpha: 0, duration: 1200, onComplete: () => t.destroy() });
        if (ups) this.scene.combat?.levelUpFx?.(ups);
      })
      .on('online:list', (list) => { this.online = Array.isArray(list) ? list : []; if (!$('#social-panel').classList.contains('hidden')) this.renderSocialPanel(); })
      .on('friends:state', (list) => { this.friends = list || []; if (!$('#social-panel').classList.contains('hidden')) this.renderFriends(); })
      .on('title:new', ({ id }) => this.onNewTitles([id]))
      .on('trade:request', ({ fromId, fromName }) => this.ask(
        `<b>${esc(fromName)}</b> ขอแลกเปลี่ยนสิ่งของกับคุณ`,
        () => n.send('trade:respond', { fromId, accept: true }),
        () => n.send('trade:respond', { fromId, accept: false }),
      ))
      .on('trade:state', (st) => this.onTradeState(st))
      .on('trade:closed', ({ reason }) => { this.closeTrade(); this.ui.toast(reason || 'ยกเลิกการเทรด', 'warn'); })
      .on('trade:complete', (d) => this.onTradeComplete(d))
;
  }

  // ============================================================
  //  ปาร์ตี้
  // ============================================================
  renderParty() {
    const pf = $('#party-frames');
    const others = (this.party?.members || []).filter((m) => m.id !== this.selfId);
    pf.classList.toggle('hidden', !others.length);
    pf.innerHTML = others.map((m) => {
      const r = this.scene.remotes.get(m.id);
      const hp = r?.hp ?? m.hp, max = r?.maxHp ?? m.maxHp;
      const far = Math.hypot((r?.x ?? m.x) - this.player.x, (r?.y ?? m.y ?? this.player.y) - this.player.y) > 500;
      return `<div class="pm ${far ? 'far' : ''}">
        <span class="pm-job">${JOB_ICON[m.job] ?? '🙂'}</span>
        <div><div class="pm-name">${m.id === this.party.leader ? '👑 ' : ''}${esc(m.name)} <small>Lv.${m.level}</small></div>
        <div class="bar hp mini"><i style="width:${Math.max(0, Math.min(100, (hp / max) * 100))}%"></i></div></div></div>`;
    }).join('');
    if (!$('#social-panel').classList.contains('hidden')) this.renderSocialPanel();
  }

  renderSocialPanel() {
    const me = this.selfId;
    const inParty = new Set((this.party?.members || []).map((m) => m.id));
    const leader = this.party?.leader === me;
    $('#soc-party-info').textContent = this.party ? `(${this.party.members.length}/${PARTY.maxSize})` : '';
    const setP = (el, html) => { if (el && el._html !== html) { el._html = html; el.innerHTML = html; } };
    setP($('#soc-party'), this.party
      ? this.party.members.map((m) => `<div class="soc-row"><span>${m.id === this.party.leader ? '👑' : '•'} ${esc(m.name)} <small>Lv.${m.level} ${JOBS[m.job]?.nameTh ?? 'ชาวบ้าน'}</small></span>
          ${m.id === me ? '<button class="btn ghost sm" data-act="leave">ออกจากปาร์ตี้</button>' : leader ? `<button class="btn ghost sm" data-act="kick" data-id="${m.id}">เชิญออก</button>` : ''}</div>`).join('')
      : '<p class="empty">ยังไม่มีปาร์ตี้ – เชิญผู้เล่นจากรายชื่อด้านล่าง</p>');
    // ผู้เล่นออนไลน์: แมพเดียวกัน (บอกระยะ) ก่อน แล้วแมพอื่น (บอกที่อยู่) · เชิญปาร์ตี้/กระซิบ/เพิ่มเพื่อนได้ทุกคน · เทรดเฉพาะแมพเดียวกัน
    const near = [...this.scene.remotes.values()];
    const nearIds = new Set(near.map((r) => r.id));
    const far = (this.online || []).filter((o) => !nearIds.has(o.id));
    const btns = (id, name, same) => `<span>${inParty.has(id) ? '<small class="ok">ในปาร์ตี้</small>' : `<button class="btn ghost sm" data-act="invite" data-id="${id}">🤝 เชิญ</button>`}
          ${same ? `<button class="btn ghost sm" data-act="trade" data-id="${id}">💱 เทรด</button>` : ''}
          <button class="btn ghost sm" data-act="friend" data-id="${id}" title="เพิ่มเพื่อน">➕👥</button>
          <button class="btn ghost sm" data-act="whisper" data-name="${esc(name)}">💬</button></span>`;
    const rowsNear = near.map((r) => `<div class="soc-row"><span>${esc(r.name)} <small>Lv.${r.level || '?'} · ห่าง ${Math.round(Math.hypot(r.x - this.player.x, r.y - this.player.y) / 16 / 5) * 5} ม.</small></span>${btns(r.id, r.name, true)}</div>`);
    const rowsFar = far.map((o) => `<div class="soc-row far"><span>${esc(o.name)} <small>Lv.${o.level || '?'} · 📍 ${esc(o.where || '')}</small></span>${btns(o.id, o.name, false)}</div>`);
    const setHtml = (el, html) => { if (el && el._html !== html) { el._html = html; el.innerHTML = html; } };
    setHtml($('#soc-players'), !this.net.online ? '<p class="empty">ออฟไลน์อยู่</p>'
      : rowsNear.length || rowsFar.length
        ? `${rowsNear.length ? `<div class="soc-sub">📍 แมพเดียวกัน (${rowsNear.length})</div>${rowsNear.join('')}` : ''}${rowsFar.length ? `<div class="soc-sub">🌏 แมพอื่น (${rowsFar.length})</div>${rowsFar.join('')}` : ''}`
        : '<p class="empty">ยังไม่มีผู้เล่นอื่นออนไลน์</p>');
    this.renderLeaderboard();
    this.renderFriends();
    const tl = $('#soc-titles');
    if (tl && this.socTab === 'titles') this.ui.renderTitles(tl);
  }

  /** รายชื่อเพื่อน */
  renderFriends() {
    const el = $('#soc-friends');
    if (!el) return;
    const list = this.friends || [];
    const on = list.filter((f) => f.online), off = list.filter((f) => !f.online);
    const row = (f) => `<div class="soc-row ${f.online ? '' : 'off'}"><span>${f.online ? '🟢' : '⚫'} ${esc(f.name)} <small>${f.online ? `Lv.${f.level} · ${JOBS[f.job]?.nameTh ?? 'ชาวบ้าน'} · ${esc(f.map || '')}` : 'ออฟไลน์'}</small></span>
      <span>${f.online ? `<button class="btn ghost sm" data-act="invite" data-id="${f.id}">🤝</button><button class="btn ghost sm" data-act="whisper" data-name="${esc(f.name)}">💬</button>` : ''}<button class="btn ghost sm" data-act="unfriend" data-acc="${f.acc}" title="ลบเพื่อน">✕</button></span></div>`;
    el.innerHTML = !this.net.online ? '<p class="empty">ออฟไลน์อยู่</p>' : list.length ? [...on, ...off].map(row).join('') : '<p class="empty">ยังไม่มีเพื่อน – กด ➕👥 ที่รายชื่อผู้เล่น หรือคลิกตัวละครคนอื่นแล้วเลือก "เพิ่มเพื่อน"</p>';
    const c = $('#soc-friend-count'); if (c) c.textContent = list.length ? `(${on.length}/${list.length} ออนไลน์)` : '';
  }

  /** ตารางอันดับจาก server (แคช 30 วิ) */
  async renderLeaderboard(force = false) {
    const el = $('#soc-lb');
    if (!el) return;
    if (!this.lbBound) {
      this.lbBound = true;
      document.querySelectorAll('[data-lb]').forEach((b) => (b.onclick = () => {
        this.lbTab = b.dataset.lb;
        document.querySelectorAll('[data-lb]').forEach((x) => x.classList.toggle('active', x === b));
        this.renderLeaderboard();
      }));
    }
    if (force || !this.lb || Date.now() - (this.lbAt || 0) > 30000) {
      if (this.lbLoading) return;
      this.lbLoading = true;
      try { this.lb = await fetch('/api/leaderboard').then((r) => r.json()); this.lbAt = Date.now(); } catch { this.lb = null; }
      this.lbLoading = false;
    }
    const tab = this.lbTab || 'power', rows = this.lb?.[tab] || [];
    const medal = (i) => ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
    const c = this.player.char, mine = c.name, fmt = (n) => (+n || 0).toLocaleString('en-US');
    const stat = (r) => tab === 'power' ? `<b class="lb-cp">⚔ ${fmt(r.cp)}</b> · Lv.${r.level}`
      : tab === 'enhance' ? `<b class="enh t${Math.min(5, Math.floor(r.enh / 4))}">+${r.enh}</b> · Lv.${r.level}` : `Lv.${r.level} · ⚔ ${fmt(r.cp)}`;
    const lbHtml = rows.length ? rows.map((r, i) => `<div class="soc-row lb ${r.name === mine ? 'me' : ''} ${i < 3 ? `top${i + 1}` : ''}"><span>${medal(i)} ${esc(r.name)}${TITLE_BY_ID[r.title] ? ` <em class="lb-title" style="color:${TITLE_BY_ID[r.title].color}">«${esc(TITLE_BY_ID[r.title].nameTh)}»</em>` : ''}</span>
      <small>${stat(r)} · ${JOBS[r.path]?.nameTh ?? 'ชาวบ้าน'}</small></div>`).join('')
      : `<p class="empty">${this.net.online ? 'ยังไม่มีข้อมูล' : 'ออฟไลน์อยู่'}</p>`;
    if (el._html !== lbHtml) { el._html = lbHtml; el.innerHTML = lbHtml; }   // ไม่เปลี่ยน = ไม่วาดใหม่ (กันกระพริบ)
    // อันดับของฉัน (จาก server · อัปเดตทุก 1 นาที)
    const me = $('#soc-lb-me');
    if (me) {
      const rec = c.rec || {}, rk = { power: rec.cpRank, level: rec.lvRank, enhance: rec.enhRank }[tab];
      const meHtml = `<span>อันดับของฉัน: <b>${rk ? `#${fmt(rk)}` : '–'}</b>${this.lb?.total ? ` <small>จาก ${fmt(this.lb.total)} ตัวละคร</small>` : ''}</span><span>ค่าพลังรวม <b class="lb-cp">⚔ ${fmt(combatPower(c))}</b></span>`;
      if (me._html !== meHtml) { me._html = meHtml; me.innerHTML = meHtml; }
    }
  }

  // ============================================================
  //  เทรด
  // ============================================================
  sendOffer() {
    this.net.send('trade:offer', this.myOffer);
  }

  onTradeState(st) {
    const first = !this.trade;
    this.trade = st;
    tradeLock.on = true;                         // ระหว่างเทรด ห้ามใช้/ขาย/สวม/ทิ้งของ
    if (first) {
      this.myOffer = { items: [], gold: 0 }; this.theirPrev = null;
      $('#tr-gold').value = 0;
      this.ui.closeAll();
      $('#trade-panel').classList.remove('hidden');
      this.scene.sfx.play('invite');
    }
    this.renderTrade();
  }

  renderTrade() {
    const st = this.trade;
    if (!st) return;
    const me = this.selfId, other = st.a === me ? st.b : st.a;
    const c = this.player.char;
    const rar = (it) => this.ui.itemTip?.rarityOf?.(it) || 0;
    const otherName = st.names?.[other] ?? '?';
    // ช่องข้อเสนอ 10 ช่อง: ไอคอน · จำนวน · ◆ค่าสุ่ม · ขอบสีตามความหายาก (ชี้ = รายละเอียดเต็ม)
    const slotHtml = (it, mark) => {
      const I = ITEMS[it.id]; if (!I) return '';
      const r = rar(I);
      return `<div class="tr-slot${r ? ` r${r}` : ''}${mark?.has(it.id) ? ' tr-new' : ''}" data-id="${esc(it.id)}" data-tip-item="${esc(it.id)}">${itemIcon(it.id, I.icon ?? '?')}${it.qty > 1 ? `<b class="q">${it.qty.toLocaleString()}</b>` : ''}${I.affixN ? `<i class="af">◆${I.affixN}</i>` : ''}</div>`;
    };
    const grid = (list, mark) => Array.from({ length: TRADE_SLOTS }, (_, i) => (list[i] ? slotHtml(list[i], mark) : '<div class="tr-slot empty"></div>')).join('');
    const value = (o) => o.items.reduce((a, it) => a + sellPrice(it.id) * it.qty, 0);
    $('#tr-with').textContent = $('#tr-name2').textContent = otherName;
    // ข้อเสนอของเรา (ค่าที่ server ยืนยันแล้ว)
    const mine = st.offer[me] || { items: [], gold: 0 };
    this.myOffer = { items: mine.items.map((x) => ({ ...x })), gold: mine.gold };
    $('#tr-my').innerHTML = grid(mine.items);
    if (document.activeElement !== $('#tr-gold')) $('#tr-gold').value = mine.gold;
    // ข้อเสนอของอีกฝ่าย + ตรวจการเปลี่ยนแปลง
    const theirs = st.offer[other] || { items: [], gold: 0 };
    const sig = JSON.stringify(theirs), prev = this.theirPrev, mark = new Set();
    if (prev && prev.sig !== sig) {
      for (const it of theirs.items) if ((prev.items.find((x) => x.id === it.id)?.qty || 0) !== it.qty) mark.add(it.id);
      const gone = prev.items.filter((x) => !theirs.items.some((y) => y.id === x.id)).length;
      this.ui.toast(`⚠️ ${otherName} เปลี่ยนข้อเสนอ${gone ? ` (เอาออก ${gone} รายการ)` : ''}${prev.gold !== theirs.gold ? ` · เงิน ฿${prev.gold.toLocaleString()} → ฿${theirs.gold.toLocaleString()}` : ''} — ตรวจให้ดีก่อนยืนยัน`, 'warn', 4000);
      const box = $('#tr-col-them'); box.classList.remove('tr-flash'); void box.offsetWidth; box.classList.add('tr-flash');
      this.theirMark = { set: mark, until: Date.now() + 6000 };
    } else if (this.theirMark && Date.now() < this.theirMark.until) this.theirMark.set.forEach((id) => mark.add(id));
    this.theirPrev = { sig, items: theirs.items.map((x) => ({ ...x })), gold: theirs.gold };
    $('#tr-their').innerHTML = grid(theirs.items, mark);
    $('#tr-their-gold').textContent = theirs.gold.toLocaleString();
    const vMine = value(mine), vTheirs = value(theirs);
    $('#tr-my-val').textContent = mine.items.length ? `มูลค่าขาย NPC ~฿${vMine.toLocaleString()}` : '';
    $('#tr-their-val').textContent = theirs.items.length ? `มูลค่าขาย NPC ~฿${vTheirs.toLocaleString()}` : '';
    // สถานะ: แถบสีหัวคอลัมน์
    const stOf = (id) => (st.confirmed[id] ? 'ok' : st.locked[id] ? 'lock' : 'pick');
    const stTxt = { ok: '✔ ยืนยันแล้ว', lock: '🔒 ล็อกแล้ว', pick: 'กำลังเลือก…' };
    for (const [col, id, el] of [['#tr-col-me', me, '#tr-my-status'], ['#tr-col-them', other, '#tr-their-status']]) {
      const k = stOf(id); $(col).dataset.trst = k; $(el).textContent = stTxt[k];
    }
    // คำเตือนกันโกง
    const warns = [];
    const give = vMine + mine.gold, get = vTheirs + theirs.gold;
    if ((mine.items.length || mine.gold) && !theirs.items.length && !theirs.gold) warns.push(`${otherName} ยังไม่ได้ใส่อะไรเลย — คุณจะให้ฟรี`);
    else if (give >= 500 && get < give * 0.3) warns.push(`สิ่งที่คุณจะได้ (~฿${get.toLocaleString()}) มีมูลค่าต่ำกว่าที่คุณให้ (~฿${give.toLocaleString()}) มาก`);
    for (const it of theirs.items) { const I = ITEMS[it.id]; if (I?.lv && GEAR_TYPES.has(I.type) && !I.affixN && mine.items.some((x) => ITEMS[x.id]?.affixN)) { warns.push(`${I.nameTh} ของอีกฝ่าย "ไม่มีค่าสุ่ม" ◆ — ตรวจให้แน่ว่าไม่ใช่ชิ้นที่ตกลงกันไว้`); break; } }
    if (mark.size) warns.push('ช่องที่มีขอบส้ม = อีกฝ่ายเพิ่งเปลี่ยน');
    $('#tr-warn').innerHTML = warns.map((w) => `<div>⚠️ ${esc(w)}</div>`).join('');
    // สรุปเป็นข้อความ
    const sum = (o) => [...o.items.map((it) => `${ITEMS[it.id]?.nameTh || it.id}${ITEMS[it.id]?.affixN ? ` ◆${ITEMS[it.id].affixN}` : ''} x${it.qty}`), o.gold ? `฿${o.gold.toLocaleString()}` : ''].filter(Boolean).join(', ') || 'ไม่มี';
    $('#tr-summary').innerHTML = `<div>📥 คุณจะได้: <b>${esc(sum(theirs))}</b></div><div>📤 คุณจะให้: <b>${esc(sum(mine))}</b></div>`;
    // ปุ่ม: ล็อกครบแล้วต้องรอ (server บังคับด้วย)
    const locked = st.locked[me], both = st.locked[me] && st.locked[other];
    $('#tr-lock').disabled = locked;
    $('#tr-gold').disabled = locked;
    this.readyAt = both ? (this.readyAt && this.readySig === sig + mine.gold ? this.readyAt : Date.now() + (st.readyIn || 0)) : 0;
    this.readySig = sig + mine.gold;
    const tick = () => {
      const b = $('#tr-confirm'); if (!b || !this.trade) return clearInterval(this.readyT);
      const left = Math.ceil(((this.readyAt || 0) - Date.now()) / 1000);
      const bothNow = this.trade.locked[me] && this.trade.locked[other];
      b.disabled = !bothNow || this.trade.confirmed[me] || left > 0;
      b.textContent = bothNow && left > 0 ? `✔ ยืนยันแลก (${left})` : '✔ ยืนยันแลก';
      if (!bothNow || left <= 0) clearInterval(this.readyT);
    };
    clearInterval(this.readyT); tick(); if (both) this.readyT = setInterval(tick, 250);
    // กระเป๋า: ตัวกรองมาตรฐาน (เหมือนกระเป๋า/ร้านค้า)
    const tf = (this.trF ||= newFilter());
    const bag = c.inventory.filter((it) => ITEMS[it.id]);
    if (!this.trBarDrawn || this.trBarSig !== JSON.stringify(tf) + bag.length) {
      this.trBarSig = JSON.stringify(tf) + bag.length; this.trBarDrawn = true;
      $('#tr-invtabs').innerHTML = filterBarHtml(c, tf, bag);
      bindFilterBar($('#tr-invtabs'), tf, () => { this.trBarDrawn = false; this.renderTrade(); }, this.scene);
    }
    $('#tr-inv').classList.toggle('disabled', !!locked);
    const inv = applyFilter(c, bag, tf);
    const qq = tf.q;
    $('#tr-inv').innerHTML = inv.map((it) => {
      const I = ITEMS[it.id], used = mine.items.find((x) => x.id === it.id)?.qty || 0, left = it.qty - used, r = rar(I);
      const ok = left > 0 && !locked && I.type !== 'skin';
      return `<div class="tr-slot${r ? ` r${r}` : ''}${ok ? '' : ' used'}" data-id="${ok ? esc(it.id) : ''}" data-tip-item="${esc(it.id)}" draggable="${ok}">${itemIcon(it.id, I.icon)}${left > 1 ? `<b class="q">${left.toLocaleString()}</b>` : ''}${I.affixN ? `<i class="af">◆${I.affixN}</i>` : ''}</div>`;
    }).join('') || `<p class="empty">${qq ? 'ไม่พบไอเทม' : 'ไม่มีของในหมวดนี้'}</p>`;
  }

  onTradeComplete({ get, with: name }) {
    // server แลกของในเซฟให้แล้ว (char:sync ตามมา) → แสดงผลอย่างเดียว
    this.closeTrade();
    const got = [...get.items.map((it) => `${ITEMS[it.id]?.icon}x${it.qty}`), get.gold ? `฿${get.gold}` : ''].filter(Boolean).join(' ');
    this.ui.toast(`เทรดกับ ${name} สำเร็จ! ${got ? 'ได้รับ ' + got : ''}`);
    this.scene.sfx.play('coin');
    this.scene.saveSoon();
    this.ui.refreshPanels?.();
  }

  closeTrade() {
    this.trade = null; this.theirPrev = null; this.theirMark = null;
    clearInterval(this.readyT);
    tradeLock.on = false;
    this.myOffer = { items: [], gold: 0 };
    $('#trade-panel').classList.add('hidden');
  }

  // ============================================================
  update(time) {
    // อัปเดตกรอบปาร์ตี้ทุก 0.5 วิ · แผงสังคมทุก 1 วิ (ถ้าเปิดอยู่)
    if (this.party && time - (this.lastPartyDraw || 0) > 500) { this.lastPartyDraw = time; this.renderParty(); }
    if (time - (this.lastSocDraw || 0) > 1000 && !$('#social-panel').classList.contains('hidden')) {
      const busy = this.socOpen && (this.socHover || performance.now() - (this.socHoldAt || 0) < 1500);
      if (!this.socOpen) { this.socOpen = true; this.refreshFriends(); }
      if (this.net.online && time - (this.lastOnlineAsk || 0) > 4000) { this.lastOnlineAsk = time; this.net.send('online:get'); }
      this.lastSocDraw = time; if (!busy) this.renderSocialPanel();
    } else if ($('#social-panel').classList.contains('hidden')) this.socOpen = false;
  }
}
