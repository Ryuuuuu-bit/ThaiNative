// ============================================================
//  TdSocial – สังคมในโลกอยุธยา (top-down): ปาร์ตี้ · เทรด · เพื่อน · อันดับ · ฉายา
//  ข้อมูลกลางอยู่ที่ server (server/social.js) ไฟล์นี้ทำหน้าที่แสดงผล + ส่งคำสั่ง
// ============================================================
import { ITEMS } from '/shared/data/items.js';
import { JOBS } from '/shared/data/classes.js';
import { count, tradeLock } from '../systems/Inventory.js';
import { itemIcon, makeText } from '../systems/util.js';
import { TITLE_BY_ID } from '/shared/data/titles.js';

const $ = (s) => document.querySelector(s);
const JOB_ICON = { swordman: '⚔️', mage: '🔮', archer: '🏹', boxer: '🥊', healer: '🌿' };
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
      const act = e.target.dataset?.act;
      if (!act) return;
      const id = this.menuTarget;
      $('#player-menu').classList.add('hidden');
      if (act === 'party') this.invite(id);
      if (act === 'trade') this.requestTrade(id);
      if (act === 'friend') this.addFriend(id);
      if (act === 'whisper') { const r = this.scene.remotes.get(id), inp = $('#chat-input'); if (r) { inp.value = `/w ${String(r.name).replace(/\s+#/, '#')} `; inp.focus(); } }
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
    $('#tr-inv').onclick = (e) => {
      const b = e.target.closest('[data-id]');
      if (!b) return;
      const id = b.dataset.id, have = count(this.player.char, id);
      const ex = this.myOffer.items.find((x) => x.id === id);
      const cur = ex?.qty || 0;
      const add = e.shiftKey ? have - cur : 1;
      if (cur + add > have || add <= 0) return;
      if (ex) ex.qty += add; else if (this.myOffer.items.length < 8) this.myOffer.items.push({ id, qty: add }); else return this.ui.toast('ใส่ได้สูงสุด 8 ชนิด', 'warn');
      this.scene.sfx.play('click');
      this.sendOffer();
    };
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
    $('#social-panel').addEventListener('click', (e) => {
      const w = e.target.closest('[data-act="whisper"]');
      if (w) { const inp = $('#chat-input'); inp.value = `/w ${String(w.dataset.name).replace(/\s+#/, '#')} `; this.ui.closeAll(); inp.focus(); return; }
      const b = e.target.closest('button[data-act]');
      if (!b) return;
      const { act, id } = b.dataset;
      this.scene.sfx.play('click');
      if (act === 'invite') this.invite(id);
      if (act === 'trade') this.requestTrade(id);
      if (act === 'leave') this.net.send('party:leave');
      if (act === 'kick') this.net.send('party:kick', { id });
      if (act === 'friend') this.addFriend(id);
      if (act === 'unfriend') { if (confirm('ลบเพื่อนคนนี้?')) this.net.send('friends:del', { acc: +b.dataset.acc }); }
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
    for (const id of ids) {
      const t = TITLE_BY_ID[id];
      if (!t || id === 'rookie') continue;
      this.ui.banner(`🏅 ได้รับฉายา “${t.nameTh}”`);
      this.ui.toast(`🏅 ฉายาใหม่: ${t.nameTh} — เลือกใช้ได้ที่แผงสังคม (P) › ฉายา`, '', 6000);
      this.scene.sfx.play('victory');
    }
  }

  /** คลิกที่ผู้เล่นอื่น → เมนู */
  openPlayerMenu(remote, pointer) {
    this.menuTarget = remote.id;
    const m = $('#player-menu');
    $('#pm-name').textContent = `${remote.name} · Lv.${remote.level || '?'}`;
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
    $('#soc-party-info').textContent = this.party ? `(${this.party.members.length}/4)` : '';
    $('#soc-party').innerHTML = this.party
      ? this.party.members.map((m) => `<div class="soc-row"><span>${m.id === this.party.leader ? '👑' : '•'} ${esc(m.name)} <small>Lv.${m.level} ${JOBS[m.job]?.nameTh ?? 'ชาวบ้าน'}</small></span>
          ${m.id === me ? '<button class="btn ghost sm" data-act="leave">ออกจากปาร์ตี้</button>' : leader ? `<button class="btn ghost sm" data-act="kick" data-id="${m.id}">เชิญออก</button>` : ''}</div>`).join('')
      : '<p class="empty">ยังไม่มีปาร์ตี้ – เชิญผู้เล่นจากรายชื่อด้านล่าง</p>';
    const list = [...this.scene.remotes.values()];
    $('#soc-players').innerHTML = !this.net.online ? '<p class="empty">ออฟไลน์อยู่</p>' : list.length
      ? list.map((r) => `<div class="soc-row"><span>${esc(r.name)} <small>Lv.${r.level || '?'} · ห่าง ${Math.round(Math.hypot(r.x - this.player.x, r.y - this.player.y) / 16)} ม.</small></span>
          <span>${inParty.has(r.id) ? '<small class="ok">ในปาร์ตี้</small>' : `<button class="btn ghost sm" data-act="invite" data-id="${r.id}">🤝 เชิญ</button>`}
          <button class="btn ghost sm" data-act="trade" data-id="${r.id}">💱 เทรด</button>
          <button class="btn ghost sm" data-act="friend" data-id="${r.id}" title="เพิ่มเพื่อน">➕👥</button>
          <button class="btn ghost sm" data-act="whisper" data-name="${esc(r.name)}">💬</button></span></div>`).join('')
      : '<p class="empty">ยังไม่มีผู้เล่นอื่นออนไลน์</p>';
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
    const tab = this.lbTab || 'level', rows = this.lb?.[tab] || [];
    const medal = (i) => ['🥇', '🥈', '🥉'][i] || `${i + 1}.`;
    const mine = this.player.char.name;
    el.innerHTML = rows.length ? rows.map((r, i) => `<div class="soc-row lb ${r.name === mine ? 'me' : ''}"><span>${medal(i)} ${esc(r.name)}${TITLE_BY_ID[r.title] ? ` <em class="lb-title" style="color:${TITLE_BY_ID[r.title].color}">«${esc(TITLE_BY_ID[r.title].nameTh)}»</em>` : ''}</span>
      <small>${tab === 'level' ? `Lv.${r.level}` : `<b class="enh t${Math.min(5, Math.floor(r.enh / 4))}">+${r.enh}</b> · Lv.${r.level}`} · ${JOBS[r.path]?.nameTh ?? 'ชาวบ้าน'}</small></div>`).join('')
      : `<p class="empty">${this.net.online ? 'ยังไม่มีข้อมูล' : 'ออฟไลน์อยู่'}</p>`;
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
      this.myOffer = { items: [], gold: 0 };
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
    const itemHtml = (list) => list.length ? list.map((it) => `<div class="tr-item" data-id="${it.id}" title="${esc(ITEMS[it.id]?.nameTh)}">${itemIcon(it.id, ITEMS[it.id]?.icon ?? '?')}<small>x${it.qty}</small><span>${esc(ITEMS[it.id]?.nameTh)}</span></div>`).join('') : '<p class="empty">—</p>';
    $('#tr-with').textContent = $('#tr-name2').textContent = st.names?.[other] ?? '?';
    // ข้อเสนอของเรา (ใช้ค่าที่ server ยืนยันแล้ว)
    const mine = st.offer[me] || { items: [], gold: 0 };
    this.myOffer = { items: mine.items.map((x) => ({ ...x })), gold: mine.gold };
    $('#tr-my').innerHTML = itemHtml(mine.items);
    if (document.activeElement !== $('#tr-gold')) $('#tr-gold').value = mine.gold;
    const theirs = st.offer[other] || { items: [], gold: 0 };
    $('#tr-their').innerHTML = itemHtml(theirs.items);
    $('#tr-their-gold').textContent = theirs.gold.toLocaleString();
    const stat = (id) => st.confirmed[id] ? '<b class="ok">✔ ยืนยันแล้ว</b>' : st.locked[id] ? '<b class="lock">🔒 ล็อกแล้ว</b>' : '<i>กำลังเลือก…</i>';
    $('#tr-my-status').innerHTML = stat(me);
    $('#tr-their-status').innerHTML = stat(other);
    const locked = st.locked[me];
    $('#tr-lock').disabled = locked;
    $('#tr-gold').disabled = locked;
    $('#tr-confirm').disabled = !(st.locked[me] && st.locked[other]) || st.confirmed[me];
    // กระเป๋าของเรา (ไม่รวมที่ใส่ในข้อเสนอไปแล้ว)
    $('#tr-inv').classList.toggle('disabled', !!locked);
    $('#tr-inv').innerHTML = c.inventory.filter((it) => ITEMS[it.id]).map((it) => {
      const used = mine.items.find((x) => x.id === it.id)?.qty || 0;
      const left = it.qty - used;
      return `<div class="tr-item ${left <= 0 ? 'used' : ''}" data-id="${left > 0 && !locked ? it.id : ''}" title="${esc(ITEMS[it.id].nameTh)}">${itemIcon(it.id, ITEMS[it.id].icon)}<small>x${left}</small></div>`;
    }).join('') || '<p class="empty">กระเป๋าว่าง</p>';
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
    this.trade = null;
    tradeLock.on = false;
    this.myOffer = { items: [], gold: 0 };
    $('#trade-panel').classList.add('hidden');
  }

  // ============================================================
  update(time) {
    // อัปเดตกรอบปาร์ตี้ทุก 0.5 วิ · แผงสังคมทุก 1 วิ (ถ้าเปิดอยู่)
    if (this.party && time - (this.lastPartyDraw || 0) > 500) { this.lastPartyDraw = time; this.renderParty(); }
    if (time - (this.lastSocDraw || 0) > 1000 && !$('#social-panel').classList.contains('hidden')) {
      if (!this.socOpen) { this.socOpen = true; this.refreshFriends(); }
      this.lastSocDraw = time; this.renderSocialPanel();
    } else if ($('#social-panel').classList.contains('hidden')) this.socOpen = false;
  }
}
