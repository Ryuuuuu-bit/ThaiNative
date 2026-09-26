// ============================================================
//  Social – ระบบ MMO ฝั่ง client: ปาร์ตี้ · เทรด · เรดบอส
//  ข้อมูลกลางอยู่ที่ server (server/social.js) ไฟล์นี้ทำหน้าที่แสดงผล + ส่งคำสั่ง
// ============================================================
import { ITEMS } from '/shared/data/items.js';
import { JOBS } from '/shared/data/classes.js';
import { WORLD } from '/shared/constants.js';
import { MAPS } from '/shared/data/maps.js';
import { RAID_BOSS as RB } from '/shared/data/raid.js';
import { count, tradeLock } from './Inventory.js';
import { rand, itemIcon } from './util.js';
import { TITLE_BY_ID } from '/shared/data/titles.js';

const $ = (s) => document.querySelector(s);
const JOB_ICON = { swordman: '⚔️', mage: '🔮', archer: '🏹', boxer: '🥊' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class Social {
  /** @param {Phaser.Scene} scene GameScene */
  constructor(scene) {
    this.scene = scene;
    this.party = null;         // { id, leader, members:[...] }
    this.trade = null;         // trade:state ล่าสุด
    this.myOffer = { items: [], gold: 0 };
    this.inviteQueue = [];
    this.waves = [];           // คลื่นแผ่นดินที่กำลังวิ่ง
    this.bindDom();
    this.bindNet();
  }

  get net() { return this.scene.net; }
  get player() { return this.scene.player; }
  get ui() { return this.scene.ui; }
  get fx() { return this.scene.combat; }
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
      if (act === 'whisper') { const r = this.scene.remotes.get(id), inp = $('#chat-input'); if (r) { inp.value = `/w ${r.name} `; inp.focus(); } }
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
      if (w) { const inp = $('#chat-input'); inp.value = `/w ${w.dataset.name} `; this.ui.closeAll(); inp.focus(); return; }
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
    this.menuTarget = remote.netId;
    const m = $('#player-menu');
    $('#pm-name').textContent = `${remote.name} · Lv.${remote.level || '?'}`;
    const rect = this.scene.game.canvas.getBoundingClientRect();
    const sx = rect.width / this.scene.scale.width;
    m.style.left = `${Math.min(pointer.x * sx, rect.width - 170)}px`;
    m.style.top = `${Math.max(10, pointer.y * sx - 90)}px`;
    m.querySelector('[data-act=party]').disabled = !!this.party && this.party.members.some((x) => x.id === remote.netId);
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
        this.fx.popupText(this.player.x, this.player.y - 44, `+${amount} EXP (ปาร์ตี้)`, '#aed6f1', 7);
        this.fx.afterGrant({ ups });
      })
      .on('friends:state', (list) => { this.friends = list || []; if (!$('#social-panel').classList.contains('hidden')) this.renderFriends(); })
      .on('title:new', ({ id }) => this.onNewTitles([id]))
      .on('rboss:spawn', ({ nameTh, mapId }) => { const m = MAPS[mapId]; this.ui.banner(`👑 ${nameTh} ปรากฏตัว!`); this.ui.toast(`👑 บอสประจำภาคเกิดที่ ${m ? `${m.no}. ${m.nameTh}` : mapId} — ไปล่าได้เลย!`, '', 7000); this.scene.sfx.play('bossRoar'); this.rbossAlive = { ...(this.rbossAlive || {}), [mapId]: true }; })
      .on('rboss:list', (list) => { this.rbossAlive = {}; for (const b of list) this.rbossAlive[b.mapId] = b.alive; })
      .on('rboss:down', ({ nameTh, killer }) => { this.ui.toast(`👑 ${killer} ปราบ${nameTh}แล้ว`); })
      .on('rboss:slam', ({ gi, x }) => {                                       // บอสภาคทุบพื้น: เตือนวงแดง
        const s = this.scene, gy = WORLD.groundY;
        if (Math.abs(this.player.x - x) > 500) return;
        const r = s.add.ellipse(x, gy - 1, 190, 10, 0xe74c3c, 0.35).setDepth(6);
        s.tweens.add({ targets: r, alpha: { from: 0.15, to: 0.55 }, duration: 110, yoyo: true, repeat: 2, onComplete: () => { r.destroy(); s.cameras.main.shake(200, 0.01); this.fx.burst(x, gy - 6, 0xe67e22, 20); } });
      })
      .on('rboss:reward', (r) => {
        this.fx.popupText(this.player.x, this.player.y - 60, `+${r.exp} EXP  +฿${r.gold}`, '#f7dc6f', 10);
        const items = r.items.map((it) => `${ITEMS[it.id]?.icon}${ITEMS[it.id]?.nameTh} x${it.qty}`).join(', ');
        this.ui.banner(`👑 ปราบ${r.nameTh}!`);
        this.ui.toast(`👑 รางวัลบอสภาค (อันดับ ${r.rank} · ${r.share}%): ${items}`, '', 7000);
        this.scene.sfx.play('victory');
        this.fx.afterGrant(r);
      })
      .on('trade:request', ({ fromId, fromName }) => this.ask(
        `<b>${esc(fromName)}</b> ขอแลกเปลี่ยนสิ่งของกับคุณ`,
        () => n.send('trade:respond', { fromId, accept: true }),
        () => n.send('trade:respond', { fromId, accept: false }),
      ))
      .on('trade:state', (st) => this.onTradeState(st))
      .on('trade:closed', ({ reason }) => { this.closeTrade(); this.ui.toast(reason || 'ยกเลิกการเทรด', 'warn'); })
      .on('trade:complete', (d) => this.onTradeComplete(d))
      .on('raid:state', (b) => this.scene.boss?.setServer(b))
      .on('raid:spawn', () => {
        this.ui.banner(`👹 ${RB.nameTh} ปรากฏตัว!`);
        this.scene.sfx.play('bossRoar');
      })
      .on('raid:attack', (a) => this.onBossAttack(a))
      .on('raid:impact', (a) => this.onBossImpact(a))
      .on('raid:dmg', (d) => {                              // ดาเมจที่ server ทอย (ของเราและคนอื่น)
        const b = this.scene.boss;
        if (!b?.alive) return;
        this.fx.onServerDamage(b, { ...d, by: d.id, hit: d.hit !== false });
      })
      .on('raid:reward', (r) => this.onBossReward(r))
      .on('raid:defeated', ({ killer }) => {
        this.scene.boss?.defeated();
        this.ui.banner(`🏆 พิชิต${RB.nameTh}!`);
        this.scene.sfx.play('victory');
        this.clearTelegraphs();
      });
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
      const far = Math.abs((r?.x ?? m.x) - this.player.x) > 500;
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
      ? list.map((r) => `<div class="soc-row"><span>${esc(r.name)} <small>Lv.${r.level || '?'} · ห่าง ${Math.round(Math.abs(r.x - this.player.x) / 10)} ม.</small></span>
          <span>${inParty.has(r.netId) ? '<small class="ok">ในปาร์ตี้</small>' : `<button class="btn ghost sm" data-act="invite" data-id="${r.netId}">🤝 เชิญ</button>`}
          <button class="btn ghost sm" data-act="trade" data-id="${r.netId}">💱 เทรด</button>
          <button class="btn ghost sm" data-act="friend" data-id="${r.netId}" title="เพิ่มเพื่อน">➕👥</button>
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
    el.innerHTML = rows.length ? rows.map((r, i) => `<div class="soc-row lb ${r.name === mine ? 'me' : ''}"><span>${medal(i)} ${esc(r.name)}</span>
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
  //  เรดบอส: เตือนท่า → ลงดาเมจ (เราคำนวณดาเมจที่ตัวเราเอง)
  // ============================================================
  telegraph(obj) { (this.tele ||= []).push(obj); return obj; }
  clearTelegraphs() { (this.tele || []).forEach((o) => o.destroy()); this.tele = []; this.waves.forEach((w) => w.g.destroy()); this.waves = []; }

  onBossAttack(a) {
    const s = this.scene, gy = WORLD.groundY, boss = s.boss;
    boss?.windup(a.type);
    const near = Math.abs(this.player.x - a.x) < 500;
    if (near) this.showBossWarn(a);
    if (near) s.sfx.play(a.type === 'roar' ? 'bossRoar' : 'bossWarn');
    const T = (o) => { this.telegraph(o); s.tweens.add({ targets: o, alpha: { from: 0.15, to: 0.5 }, duration: 220, yoyo: true, repeat: -1 }); return o; };
    if (a.type === 'slam') {
      T(s.add.rectangle(a.x + a.dir * a.range / 2, gy - 2, a.range, 8, 0xe74c3c, 0.35).setDepth(6));
    } else if (a.type === 'wave') {
      T(s.add.rectangle(a.x, gy - 1, a.range * 2, 3, 0xf39c12, 0.4).setDepth(6));
    } else if (a.type === 'roar') {
      const c = T(s.add.circle(a.x, gy - 30, a.range, 0x8e44ad, 0.12).setStrokeStyle(2, 0xbb8fce, 0.8).setDepth(6));
      c.setScale(0.2); s.tweens.add({ targets: c, scale: 1, duration: a.windup });
    } else if (a.type === 'rain') {
      for (const x of a.spots) T(s.add.ellipse(x, gy - 1, 44, 8, 0xe74c3c, 0.4).setDepth(6));
    }
  }

  /** แถบเตือนสกิลบอส: ชื่อท่า + วิธีหลบ + นับถอยหลังถึงดาเมจลง */
  showBossWarn(a) {
    const HINT = { slam: '⬅ ถอยออกจากด้านหน้าบอส', wave: '⬆ กระโดดข้ามคลื่น!', roar: '↔ ออกห่างจากบอส', rain: '⚠ หลบวงแดง!' };
    const el = $('#boss-warn'), fill = $('#bw-fill'), edge = $('#boss-edge');
    if (!el) return;
    $('#bw-name').textContent = `👹 ${RB.attacks[a.type]?.nameTh || ''}${a.enraged ? ' (คลั่ง)' : ''}`;
    $('#bw-hint').textContent = HINT[a.type] || '';
    el.className = `boss-warn ${a.type}`;
    fill.style.transition = 'none'; fill.style.transform = 'scaleX(1)';
    void fill.offsetWidth;
    fill.style.transition = `transform ${a.windup || 900}ms linear`; fill.style.transform = 'scaleX(0)';
    edge.classList.add('on');
    clearTimeout(this.warnT);
    this.warnT = setTimeout(() => this.hideBossWarn(), (a.windup || 900) + 250);
  }
  hideBossWarn() { $('#boss-warn')?.classList.add('hidden'); $('#boss-edge')?.classList.remove('on'); }

  onBossImpact(a) {
    const s = this.scene, p = this.player, gy = WORLD.groundY;
    this.clearTelegraphs();
    s.boss?.impact(a.type);
    this.hideBossWarn();
    const dmgOf = (base) => { const d = p.combatStats(); return Math.max(1, Math.round(base * (a.enraged ? 1.25 : 1) * rand(0.9, 1.1) - d.def * 0.6)); };
    const hurt = (base, fromX) => p.alive && !this.scene.econ?.server && p.takeHit({ hit: true, crit: false, dmg: dmgOf(base) }, fromX);   // ออนไลน์: server ตัดสิน (pl:hit)
    const near = Math.abs(p.x - a.x) < 520;

    if (a.type === 'slam') {
      const cx = a.x + a.dir * a.range / 2;
      this.fx.burst(cx, gy - 6, 0xe67e22, 24);
      if (near) { s.cameras.main.shake(260, 0.012); s.sfx.play('bossSlam'); }
      if (Math.abs(p.x - cx) <= a.range / 2 + 8 && p.y > gy - 50) hurt(a.dmg, a.x);
    } else if (a.type === 'wave') {
      if (near) { s.cameras.main.shake(180, 0.006); s.sfx.play('bossSlam'); }
      for (const dir of [-1, 1]) {
        const g = s.add.image(a.x, gy, 'proj_wave').setOrigin(0.5, 1).setDepth(12).setScale(1.4, 1.1).setTint(0xf0b27a).setFlipX(dir < 0);
        this.waves.push({ g, x: a.x, dir, speed: a.speed, end: a.x + dir * a.range, hit: false, dmg: a.dmg });
      }
    } else if (a.type === 'roar') {
      const ring = s.add.circle(a.x, gy - 30, 20, 0xbb8fce, 0).setStrokeStyle(4, 0xbb8fce, 1).setDepth(13);
      s.tweens.add({ targets: ring, radius: a.range, alpha: 0, duration: 450, onComplete: () => ring.destroy() });
      if (near) s.cameras.main.shake(300, 0.008);
      if (Math.abs(p.x - a.x) <= a.range && hurt(a.dmg, a.x)) {
        p.stunUntil = s.time.now + 900;                                  // มึนงง
        this.fx.popupText(p.x, p.y - 52, 'มึนงง!', '#bb8fce', 8);
      }
    } else if (a.type === 'rain') {
      for (const x of a.spots) {
        const m = s.add.image(x, gy - 200, 'proj_meteor').setDepth(14).setScale(1.2);
        s.tweens.add({ targets: m, y: gy - 8, duration: 260, ease: 'Quad.easeIn', onComplete: () => { m.destroy(); this.fx.burst(x, gy - 6, 0xe74c3c, 14); } });
        if (Math.abs(p.x - x) < 24) s.time.delayedCall(260, () => hurt(a.dmg, x));
      }
      if (near) s.time.delayedCall(260, () => { s.sfx.play('meteor'); s.cameras.main.shake(160, 0.006); });
    }
  }

  onBossReward(r) {
    this.fx.popupText(this.player.x, this.player.y - 60, `+${r.exp} EXP  +฿${r.gold}`, '#f7dc6f', 10);
    this.fx.afterGrant(r);
    const items = r.items.map((it) => `${ITEMS[it.id]?.icon}${ITEMS[it.id]?.nameTh} x${it.qty}`).join(', ');
    this.ui.toast(`🏆 รางวัลเรด (อันดับ ${r.rank} · ${r.share}% ของดาเมจ): ${items}`);
    if (r.items.some((it) => it.id === 'acc_yant_gold')) this.ui.banner('✨ ได้รับ ยันต์ทองพญายักษ์! ✨');
    this.scene.time.delayedCall(400, () => this.scene.sfx.play('coin'));
    this.scene.saveSoon();
  }

  // ============================================================
  update(time, dt) {
    // คลื่นแผ่นดิน: วิ่งออกจากบอส โดนเมื่อยืนบนพื้นตอนคลื่นผ่าน (กระโดดหลบได้)
    const p = this.player;
    for (const w of this.waves) {
      w.x += w.dir * w.speed * dt;
      w.g.x = w.x;
      const onGround = p.body.blocked.down || p.body.touching.down;
      if (!w.hit && p.alive && onGround && Math.abs(p.x - w.x) < 10) {
        w.hit = true;
        if (!this.scene.econ?.server) p.takeHit({ hit: true, crit: false, dmg: Math.max(1, Math.round(w.dmg - p.combatStats().def * 0.6)) }, w.x - w.dir * 10);
      }
      if ((w.dir > 0 && w.x >= w.end) || (w.dir < 0 && w.x <= w.end)) { w.g.destroy(); w.done = true; }
    }
    this.waves = this.waves.filter((w) => !w.done);

    // แถบ HP บอส (แสดงเมื่ออยู่ใกล้ลานเรด)
    const b = this.scene.boss;
    const nearArena = p.x > WORLD.arenaX - 350;
    $('#boss-bar').classList.toggle('hidden', !nearArena || !b);
    if (nearArena && b) {
      if (b.alive) {
        $('#bb-fill').style.width = `${Math.max(0, (b.hp / b.maxHp) * 100)}%`;
        $('#bb-hp').textContent = `${Math.max(0, Math.ceil(b.hp)).toLocaleString()} / ${b.maxHp.toLocaleString()}`;
        $('#bb-state').textContent = b.hp / b.maxHp < RB.enrageAt ? '🔥 คลั่ง!' : '';
      } else {
        const sec = Math.max(0, Math.ceil(((b.respawnAt || 0) - performance.now()) / 1000));
        $('#bb-fill').style.width = '0%';
        $('#bb-hp').textContent = this.net.online ? `เกิดใหม่ใน ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : 'ต้องออนไลน์เพื่อสู้เรดบอส';
        $('#bb-state').textContent = '';
      }
    }
    // อัปเดตกรอบปาร์ตี้ทุก 0.5 วิ
    if (this.party && time - (this.lastPartyDraw || 0) > 500) { this.lastPartyDraw = time; this.renderParty(); }
    if (time - (this.lastSocDraw || 0) > 1000 && !$('#social-panel').classList.contains('hidden')) { this.lastSocDraw = time; this.renderSocialPanel(); }
  }
}
