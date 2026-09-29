// ============================================================
//  ช่องแชทแบบ MMO (กรอบ RO): แท็บ ทั้งหมด/ทั่วไป/ปาร์ตี้/กระซิบ/ระบบ
//  ▸ เก็บประวัติ 150 ข้อความ (จำ 100 ล่าสุดในเครื่อง 12 ชม.) · เวลา · ตัวนับยังไม่อ่าน
//  ▸ เลือกช่องส่ง ทั่วไป/ปาร์ตี้/กระซิบ · อีโมจิ + คำพูดสำเร็จรูป · ลิงก์ไอเทม [[id]] / [[id+15]]
//  ▸ คลิกชื่อ = เมนูผู้เล่น (เชิญปาร์ตี้/เทรด/เพื่อน/กระซิบ) · ฟองคำพูดเหนือหัว (scene.chatBubble)
// ============================================================
import { ITEMS } from '/shared/data/items.js';
import { ENHANCE } from '/shared/data/village.js';
import { saveSettings } from './Settings.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MAX = 150, KEEP = 100, KEEP_MS = 12 * 3600e3;

export const EMOJI = ['🙏', '😂', '😍', '😭', '😡', '😱', '😎', '🤔', '😴', '👻', '👌', '👍', '⚔️', '🛡️', '🏆', '💰', '❤️', '🔥', '✨', '🎉', '💀', '🐘', '🐍', '🪷'];
export const PHRASES = ['สวัสดีครับ 🙏', 'ขอบคุณครับ 🙇', 'ขอโทษครับ 🙏', 'รอด้วย ⏳', 'ช่วยด้วย! 🆘', 'ไปกัน! 🏃', 'ลุย! ⚔️', '555+ 😂', 'เก่งมาก 👍', 'GG 🏆', 'ใครว่างตีบอส? 👑', 'ซื้อ-ขายไหม 💰'];
const TABS = [['all', 'ทั้งหมด'], ['local', 'ทั่วไป'], ['party', 'ปาร์ตี้'], ['whisper', 'กระซิบ'], ['sys', 'ระบบ']];
const CHAN_TH = { local: 'ทั่วไป', party: 'ปาร์ตี้', whisper: 'กระซิบ' };

/** ข้อความที่มีแต่อีโมจิ (≤3 ตัว) → ฟองคำพูดแบบอีโมจิใหญ่ */
export const emojiOnly = (t) => { const s = String(t).trim(); return s.length > 0 && s.length <= 12 && /^(\p{Extended_Pictographic}|️|‍|\s)+$/u.test(s); };

export class ChatBox {
  /** ใช้กล่องแชทเดิมถ้ามีแล้ว (UI/ฉากถูกสร้างใหม่) → ผูกกับ UI ใหม่ */
  static attach(ui) {
    if (ChatBox.inst && document.contains(ChatBox.inst.log)) { ChatBox.inst.ui = ui; ChatBox.inst.scene = ui.scene; return ChatBox.inst; }
    return (ChatBox.inst = new ChatBox(ui));
  }
  constructor(ui) {
    this.ui = ui; this.scene = ui.scene;
    this.msgs = []; this.tab = 'all'; this.chan = 'local'; this.wTo = null;
    this.unread = { local: 0, party: 0, whisper: 0, sys: 0 };
    this.hideSys = false;
    this.key = null;
    this.build();
  }

  get sid() { return this.scene.net?.selfId; }

  build() {
    const root = $('#chat');
    root.innerHTML = `
      <div class="cb-frame">
        <div class="cb-hd">
          <div class="cb-tabs">${TABS.map(([k, th]) => `<button data-cbtab="${k}"${k === 'all' ? ' class="active"' : ''}>${th}<i data-unread="${k}"></i></button>`).join('')}</div>
          <div class="cb-tools">
            <button id="cb-sys" title="ซ่อน/แสดงข้อความระบบในแท็บทั้งหมด">🔔</button>
            <button id="cb-bub" title="ฟองคำพูดเหนือหัว เปิด/ปิด">💭</button>
            <button id="cb-size" title="ขยาย/ย่อกล่องแชท">⤢</button>
            <button id="chat-toggle" title="ย่อแชท">▾</button>
          </div>
        </div>
        <div id="chat-log" class="cb-log"></div>
        <button id="cb-new" class="cb-new hidden">▼ ข้อความใหม่</button>
        <div class="cb-input">
          <button id="cb-chan" class="ch-local" title="เปลี่ยนช่อง (Tab)">ทั่วไป ▾</button>
          <input id="chat-input" maxlength="120" autocomplete="off" placeholder="กด Enter เพื่อพิมพ์… (/p ปาร์ตี้ · /w ชื่อ กระซิบ)" />
          <button id="cb-emo" title="อีโมจิ / คำพูดด่วน">😀</button>
          <button id="cb-send" title="ส่ง">➤</button>
        </div>
        <div id="cb-chanmenu" class="cb-pop hidden"></div>
        <div id="cb-emos" class="cb-pop cb-emos hidden">
          <div class="cb-emo-grid">${EMOJI.map((e) => `<button data-emo="${e}">${e}</button>`).join('')}</div>
          <div class="cb-phrases">${PHRASES.map((p) => `<button data-phrase="${esc(p)}">${esc(p)}</button>`).join('')}</div>
        </div>
      </div>
      <button id="cb-mini" class="cb-mini" title="เปิดแชท">💬<i id="cb-mini-n"></i></button>`;
    this.log = $('#chat-log'); this.input = $('#chat-input');
    root.querySelectorAll('[data-cbtab]').forEach((b) => (b.onclick = () => this.setTab(b.dataset.cbtab)));
    $('#cb-sys').onclick = () => { this.hideSys = !this.hideSys; $('#cb-sys').classList.toggle('off', this.hideSys); this.render(); this.save(); };
    $('#cb-bub').onclick = () => { const s = this.scene.settings; s.chatBubble = s.chatBubble === false; $('#cb-bub').classList.toggle('off', !s.chatBubble); saveSettings(s); };
    $('#cb-bub').classList.toggle('off', this.scene.settings?.chatBubble === false);
    $('#cb-size').onclick = () => root.classList.toggle('tall');
    $('#chat-toggle').onclick = () => this.collapse(true);
    $('#cb-mini').onclick = () => this.collapse(false);
    $('#cb-new').onclick = () => this.toBottom();
    $('#cb-send').onclick = () => this.submit();
    $('#cb-chan').onclick = (e) => { e.stopPropagation(); this.chanMenu(); };
    $('#cb-emo').onclick = (e) => { e.stopPropagation(); $('#cb-chanmenu').classList.add('hidden'); $('#cb-emos').classList.toggle('hidden'); };
    $('#cb-emos').onclick = (e) => {
      const em = e.target.closest('[data-emo]'), ph = e.target.closest('[data-phrase]');
      if (em) { this.insert(em.dataset.emo); }
      if (ph) { this.send(ph.dataset.phrase); $('#cb-emos').classList.add('hidden'); }
    };
    document.addEventListener('pointerdown', (e) => { if (!e.target.closest('#cb-emos, #cb-emo, #cb-chanmenu, #cb-chan')) { $('#cb-emos')?.classList.add('hidden'); $('#cb-chanmenu')?.classList.add('hidden'); } });
    this.log.addEventListener('scroll', () => { if (this.atBottom()) $('#cb-new').classList.add('hidden'); });
    this.log.addEventListener('click', (e) => {
      const n = e.target.closest('[data-pid]');
      if (n) return this.nameMenu(n, e);
      const w = e.target.closest('[data-wname]');
      if (w) return this.whisperTo(w.dataset.wname);
    });
    this.input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { this.submit(); this.input.blur(); }
      else if (e.key === 'Escape') this.input.blur();
      else if (e.key === 'Tab') { e.preventDefault(); this.cycleChan(); }
    });
    this.input.addEventListener('focus', () => { this.scene.input.keyboard.enabled = false; this.collapse(false); });
    this.input.addEventListener('blur', () => (this.scene.input.keyboard.enabled = true));
    if (document.body.classList.contains('touch')) this.collapse(true);
    // คอม: ไม่มีความเคลื่อนไหว 12 วิ → กล่องแชทจางลงเหลือแต่ข้อความ (เห็นฉากด้านหลัง) · ชี้เมาส์/พิมพ์/ข้อความใหม่ = กลับมาเต็ม
    root.addEventListener('pointerenter', () => { this.hover = true; this.wake(); });
    root.addEventListener('pointerleave', () => { this.hover = false; this.wake(); });
    this.input.addEventListener('focus', () => this.wake());
    this.input.addEventListener('blur', () => this.wake());
    this.wake();
  }

  /** ปลุกกล่องแชท แล้วนับถอยหลังจางใหม่ */
  wake() {
    const root = $('#chat'); if (!root) return;
    root.classList.remove('cb-idle');
    clearTimeout(this.idleT);
    this.idleT = setTimeout(() => {
      if (this.hover || document.activeElement === this.input || document.body.classList.contains('touch')) return this.wake();
      root.classList.add('cb-idle');
    }, 12000);
  }

  // ---------------- สถานะ ----------------
  collapse(on) { $('#chat').classList.toggle('collapsed', on); if (!on) { this.unreadMini = 0; this.paintMini(); this.toBottom(); } }
  setTab(t) {
    this.tab = t; this.unread[t] = 0;
    if (t === 'party') this.setChan('party'); else if (t === 'whisper' && (this.wTo || this.ui.lastWhisper)) this.setChan('whisper', this.wTo || this.ui.lastWhisper); else if (t === 'local') this.setChan('local');
    document.querySelectorAll('[data-cbtab]').forEach((b) => b.classList.toggle('active', b.dataset.cbtab === t));
    this.render(); this.paintUnread();
  }
  setChan(ch, to = null) {
    if (ch === 'party' && !this.scene.social?.party) { this.ui.toast('ยังไม่มีปาร์ตี้', 'warn'); ch = 'local'; }
    if (ch === 'whisper' && !to) ch = 'local';
    this.chan = ch; if (to) this.wTo = to;
    const b = $('#cb-chan');
    b.className = `ch-${ch}`;
    b.textContent = ch === 'whisper' ? `→ ${this.wTo} ▾` : `${CHAN_TH[ch]} ▾`;
  }
  cycleChan() {
    const order = ['local', ...(this.scene.social?.party ? ['party'] : []), ...(this.wTo || this.ui.lastWhisper ? ['whisper'] : [])];
    const i = order.indexOf(this.chan);
    const nx = order[(i + 1) % order.length];
    this.setChan(nx, nx === 'whisper' ? this.wTo || this.ui.lastWhisper : null);
  }
  chanMenu() {
    const m = $('#cb-chanmenu');
    $('#cb-emos').classList.add('hidden');
    const recent = [...new Set(this.msgs.filter((x) => x.ch === 'whisper').map((x) => x.peer).filter(Boolean))].slice(-4).reverse();
    m.innerHTML = `<button data-ch="local" class="ch-local">💬 ทั่วไป</button>`
      + `<button data-ch="party" class="ch-party"${this.scene.social?.party ? '' : ' disabled'}>🤝 ปาร์ตี้</button>`
      + recent.map((n) => `<button data-ch="whisper" data-to="${esc(n)}" class="ch-whisper">🟣 กระซิบ → ${esc(n)}</button>`).join('')
      + `<small>พิมพ์ /w ชื่อ ข้อความ เพื่อกระซิบคนใหม่</small>`;
    m.classList.toggle('hidden');
    m.onclick = (e) => { const b = e.target.closest('[data-ch]'); if (!b || b.disabled) return; this.setChan(b.dataset.ch, b.dataset.to || null); m.classList.add('hidden'); this.input.focus(); };
  }
  whisperTo(name) { this.setChan('whisper', String(name).replace(/\s+#/, '#')); this.collapse(false); this.input.focus(); }
  insert(t) { const i = this.input; const p = i.selectionStart ?? i.value.length; i.value = (i.value.slice(0, p) + t + i.value.slice(p)).slice(0, 120); i.focus(); }
  /** แชร์ไอเทมลงแชท (Shift+คลิกไอเทม / ปุ่ม 💬 ในกระเป๋า) */
  linkItem(id, enh = 0) { if (!ITEMS[id]) return; this.collapse(false); this.insert(`[[${id}${enh ? `+${enh}` : ''}]] `); }

  // ---------------- ส่ง ----------------
  submit() {
    const text = this.input.value.trim();
    this.input.value = '';
    if (text) this.send(text);
  }
  send(text) {
    const s = this.scene, ui = this.ui;
    if (/^\/r\s+/i.test(text) && ui.lastWhisper) return s.net.sendChat(`/w ${ui.lastWhisper} ${text.replace(/^\/r\s+/i, '')}`);
    if (/^\/gm\b/i.test(text)) return ui.gmCommand(text);
    if (/^\/p\s+/i.test(text)) return this.party(text.replace(/^\/p\s+/i, ''));
    const wm = text.match(/^\/w\s+(\S+)\s*(.*)$/i);
    if (wm) { this.setChan('whisper', wm[1]); if (!wm[2]) return; return s.net.sendChat(`/w ${wm[1]} ${wm[2]}`); }
    if (/^\//.test(text)) return s.net.sendChat(text);
    if (this.chan === 'party') return this.party(text);
    if (this.chan === 'whisper' && this.wTo) return s.net.sendChat(`/w ${this.wTo} ${text}`);
    if (s.net.online) s.net.sendChat(text);
    else this.add({ id: this.sid, name: s.player.char.name, nm: s.player.char.name, text });
  }
  party(text) { if (this.scene.social?.party) this.scene.social.partyChat(text); else this.ui.toast('ยังไม่มีปาร์ตี้', 'warn'); }

  // ---------------- รับ ----------------
  /** m = { id, name, text, party, whisper, from, to, nm, lv, title } */
  add(m) {
    const ch = m.party ? 'party' : m.whisper ? 'whisper' : m.id ? 'local' : 'sys';
    if (m.whisper && m.from) this.ui.lastWhisper = m.from;
    const peer = m.whisper ? (m.from || m.to || null) : null;
    const rec = { t: Date.now(), ch, id: m.id || null, nm: m.nm || null, name: m.name, text: String(m.text ?? ''), lv: m.lv, peer, mine: !!m.id && m.id === this.sid, gm: !!m.gm };
    this.msgs.push(rec);
    if (this.msgs.length > MAX) this.msgs.splice(0, this.msgs.length - MAX);
    if (this.tab !== 'all' && this.tab !== ch && !rec.mine) { this.unread[ch]++; this.paintUnread(); }
    if ($('#chat').classList.contains('collapsed') && ch !== 'sys' && !rec.mine) { this.unreadMini = (this.unreadMini || 0) + 1; this.paintMini(); }
    if (this.shows(rec)) this.append(rec);
    if (ch !== 'sys') this.wake();
    if (ch === 'local' && m.id) this.scene.chatBubble?.(m.id, rec.text);
    if (ch === 'whisper' && !rec.mine) this.scene.sfx?.play?.('invite');
    this.save();
  }
  shows(r) { return this.tab === 'all' ? !(this.hideSys && r.ch === 'sys') : r.ch === this.tab; }

  // ---------------- วาด ----------------
  line(r) {
    const tm = new Date(r.t), hh = String(tm.getHours()).padStart(2, '0'), mm = String(tm.getMinutes()).padStart(2, '0');
    const tag = { party: '<em class="cb-tag party">ปาร์ตี้</em>', whisper: '<em class="cb-tag whisper">กระซิบ</em>' }[r.ch] || '';
    let who;
    if (r.ch === 'sys') who = `<b class="cb-sys">${esc(r.name)}</b>`;
    else if (r.ch === 'whisper') who = r.mine ? `<b class="cb-me">ถึง</b> <b class="cb-name" data-wname="${esc(r.peer)}">${esc(r.peer)}</b>` : `<b class="cb-name${r.gm ? ' cb-gm' : ''}" data-pid="${esc(r.id)}" data-nm="${esc(r.nm || r.peer)}">${esc(r.nm || r.peer)}</b>`;
    else who = `<b class="cb-name${r.mine ? ' cb-me' : ''}${r.gm ? ' cb-gm' : ''}" ${r.mine ? '' : `data-pid="${esc(r.id)}" data-nm="${esc(r.nm || r.name)}"`}>${esc(r.nm || String(r.name).replace(/^\[ปาร์ตี้\]\s*/, ''))}</b>`;
    return `<div class="cb-line ch-${r.ch}"><small class="cb-t">${hh}:${mm}</small>${tag}${who}<span class="cb-txt">${this.fmt(r.text)}</span></div>`;
  }
  /** ข้อความ → HTML (escape + ลิงก์ไอเทม) */
  fmt(t) {
    return esc(t).replace(/\[\[([a-z0-9_#-]+?)(?:\+(\d{1,2}))?\]\]/gi, (all, id, enh) => {
      const it = ITEMS[id]; if (!it) return all;
      const r = this.ui.rarityOf?.(it) || 0, e = +enh || 0;
      return `<span class="cb-item r${r}" data-tip-item="${esc(id)}">[${esc(it.nameTh)}${e ? ` <b class="enh t${ENHANCE.auraTier(e)}">+${e}</b>` : ''}]</span>`;
    });
  }
  append(r) {
    const stick = this.atBottom();
    this.log.insertAdjacentHTML('beforeend', this.line(r));
    while (this.log.children.length > MAX) this.log.firstChild.remove();
    if (stick || r.mine) this.toBottom(); else $('#cb-new').classList.remove('hidden');
  }
  render() {
    this.log.innerHTML = this.msgs.filter((r) => this.shows(r)).map((r) => this.line(r)).join('');
    this.toBottom();
  }
  atBottom() { const l = this.log; return l.scrollHeight - l.scrollTop - l.clientHeight < 24; }
  toBottom() { this.log.scrollTop = this.log.scrollHeight; $('#cb-new')?.classList.add('hidden'); }
  paintUnread() { for (const [k, n] of Object.entries(this.unread)) { const i = document.querySelector(`[data-unread="${k}"]`); if (i) i.textContent = n ? (n > 99 ? '99+' : n) : ''; } }
  paintMini() { const n = this.unreadMini || 0; $('#cb-mini-n').textContent = n ? (n > 99 ? '99+' : n) : ''; }

  /** คลิกชื่อในแชท → เมนูผู้เล่น (ถ้าอยู่แมพเดียวกัน) · ไม่งั้นกระซิบ */
  nameMenu(el, e) {
    const id = el.dataset.pid, nm = el.dataset.nm;
    if (!id || id === this.sid) return;
    const r = this.scene.remotes?.get(id);
    const soc = this.scene.social;
    if (!soc) return this.whisperTo(nm);
    const rect = this.scene.game.canvas.getBoundingClientRect(), sx = rect.width / this.scene.scale.width;
    soc.openPlayerMenu(r || { id, name: nm, level: null }, { x: (e.clientX - rect.left) / sx, y: (e.clientY - rect.top) / sx });
  }

  // ---------------- ประวัติ (ต่อตัวละคร) ----------------
  load(charKey) {
    if (this.key === `tn_chat_${charKey}`) return;
    this.key = `tn_chat_${charKey}`;
    try {
      const d = JSON.parse(localStorage.getItem(this.key) || 'null');
      if (d && Array.isArray(d.m)) {
        const now = Date.now();
        const live = this.msgs.filter((r) => !r.old);
        this.msgs = d.m.filter((r) => r && now - r.t < KEEP_MS).map((r) => ({ ...r, mine: false, id: null, old: true, ch: r.ch === 'local' || r.ch === 'party' || r.ch === 'whisper' || r.ch === 'sys' ? r.ch : 'sys' }));
        this.msgs.push(...live);
        this.hideSys = !!d.hideSys; $('#cb-sys').classList.toggle('off', this.hideSys);
      }
    } catch { /* ไม่มี storage ก็ไม่เป็นไร */ }
    this.render();
  }
  save() {
    if (!this.key) return;
    clearTimeout(this.saveT);
    this.saveT = setTimeout(() => {
      try { localStorage.setItem(this.key, JSON.stringify({ hideSys: this.hideSys, m: this.msgs.slice(-KEEP).map(({ t, ch, nm, name, text, peer }) => ({ t, ch, nm, name, text, peer })) })); } catch { /* เต็ม/ถูกบล็อก */ }
    }, 800);
  }
}
