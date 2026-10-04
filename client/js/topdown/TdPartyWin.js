// ============================================================
//  หน้าต่างปาร์ตี้แบบการ์ดเต็มจอ (ปุ่ม T) · ใช้ข้อมูล party:state ชุดเดียวกับ PartyWindow
//  ▸ การ์ดสมาชิกแบบซุ้มประตูวัด: ตัวละครเต็มตัว · Lv · บทบาท · HP/MP · พลัง · อยู่ไหน · บัฟที่มี
//  ▸ ปุ่ม: กระซิบ · เทรด · (หัวหน้า) มอบหัวหน้า/เชิญออก · (ตัวเอง) ออกจากปาร์ตี้/เชิญเพื่อน
//  ▸ ติดตามหัวหน้า / แจ้งบัฟจากเพื่อน = ใช้ระบบของ PartyWindow (so.pw) · หน้าต่างนี้แค่กดสั่ง
// ============================================================
import { JOBS } from '/shared/data/classes.js';
import { SKILL_BY_ID } from '/shared/data/skills.js';
import { PARTY } from '/shared/constants.js';
import { ICONS } from '../systems/util.js';
import { heroId } from '../systems/HeroPreview.js';
import { texKey } from './Dir8.js';
import { ask } from '../systems/Dialog.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Math.round(n || 0).toLocaleString('en-US');
const JOB_COL = { swordman: '#d4473a', mage: '#9b59d6', archer: '#2fbf6a', boxer: '#ee8a2c', healer: '#3ddc97', villager: '#8f86a8' };
const JOB_ROLE = { swordman: 'แนวหน้า', mage: 'เวทย์', archer: 'ตีไกล', boxer: 'ประชิด', healer: 'ฮีล', villager: 'มือใหม่' };
const JOB_IC = { swordman: 'ui_swords', mage: 'ui_job_mage', archer: 'ui_job_archer', boxer: 'ui_job_boxer', healer: 'ui_heal', villager: 'ui_smile' };
const img = (key, cls = '') => (ICONS[key] ? `<img class="${cls}" src="${ICONS[key]}" alt="">` : '');
const skImg = (sk) => ICONS[`sk_${sk}`] ? `<img src="${ICONS[`sk_${sk}`]}" alt="">` : `<i>${SKILL_BY_ID[sk]?.icon || '✦'}</i>`;
const buffCol = (sk) => JOB_COL[SKILL_BY_ID[sk]?.job] || '#f2c14e';
/** อาชีพที่ใช้แสดง: ตามอาวุธที่ถือ (wj) ก่อน · ไม่มีค่อยใช้สายหลัก (path) */
export const jobOf = (m) => (m?.wj && JOBS[m.wj] ? m.wj : m?.job && JOBS[m.job] ? m.job : 'villager');

export class TdPartyWin {
  constructor(scene, social) {
    this.s = scene; this.soc = social;
    this.party = null; this.stateAt = 0;
    this.sel = null; this.open = false;
    this.frame = 0; this.nextFrame = 0; this.nextDyn = 0;
    this.build();
    scene.events.once('shutdown', () => this.destroy());
  }

  // ---------------- DOM ----------------
  build() {
    const ui = $('#ui');
    this.win = document.createElement('section');
    this.win.id = 'party-win'; this.win.className = 'window hidden';
    this.win.setAttribute('role', 'dialog'); this.win.setAttribute('aria-label', 'หน้าต่างปาร์ตี้');
    this.win.innerHTML = `<span class="tw-cn tl"></span><span class="tw-cn tr"></span><span class="tw-cn bl"></span><span class="tw-cn br"></span>
      <span class="tw-plaque">ปาร์ตี้</span>
      <button type="button" class="tw-x" aria-label="ปิด">✕</button>
      <div class="tw-head"><div><div class="tw-tier"></div><div class="tw-title"></div></div>
        <div class="tw-cp">${img('ui_swords')}<div><b>0</b><small>พลังรวมทีม</small></div></div></div>
      <div class="tw-div"></div>
      <div class="tw-cards"></div>
      <div class="tw-foot"><div class="tw-acts"></div><span class="tw-info"></span></div>`;
    ui.appendChild(this.win);
    this.win.querySelector('.tw-x').onclick = () => this.close();
    this.win.querySelector('.tw-cards').addEventListener('click', (e) => {
      const f = e.target.closest('[data-follow]'); if (f) { this.toggleFollow(); return; }
      const c = e.target.closest('.tw-card'); if (!c) return;
      if (c.classList.contains('empty')) { this.inviteMore(); return; }
      this.sel = c.dataset.id; this.render(true);
    });
    this.win.querySelector('.tw-acts').addEventListener('click', (e) => { const b = e.target.closest('[data-a]'); if (b && !b.disabled) this.act(b.dataset.a); });

  }

  destroy() { this.win?.remove(); }

  // ---------------- ข้อมูล ----------------
  get selfId() { return this.soc.selfId; }
  members() { return this.party?.members || []; }
  member(id) { return this.members().find((m) => m.id === id) || null; }
  isLeader() { return this.party?.leader === this.selfId; }
  get following() { return !!this.soc.pw?.following; }
  /** บัฟจาก server: left/dur เป็นวินาที → ms ที่เหลือ ณ ตอนนี้ */
  leftOf(b) { return Math.max(0, (b.left || 0) * 1000 - (Date.now() - this.stateAt)); }

  setState(st) {
    const had = this.party;
    this.party = st; this.stateAt = Date.now();
    if (!st) { this.close(); return; }
    if (!had || !this.member(this.sel)) this.sel = null;
    if (this.open) this.render();
  }

  // ---------------- ภาพหน้า/ตัวละคร (จากโมเดล 8 ทิศ) ----------------
  heroOf(ap) { const id = heroId(ap || {}, this.s.d8meta); return this.s.d8meta?.[id] ? id : null; }
  sheet(id) { const k = texKey(id, 'idle'); return this.s.textures.exists(k) ? this.s.textures.get(k).getSourceImage() : null; }
  ensureHero(id) {
    if (!id || this.sheet(id) || this._loading?.has(id)) return;
    (this._loading ||= new Set()).add(id);
    this.s.loadHero(id).then(() => { this._loading.delete(id); if (this.open) this.render(true); });
  }
  // ---------------- เปิด/ปิด ----------------
  toggle() { if (this.open) this.close(); else this.show(); }
  show(sel) {
    if (!this.party) { this.s.ui.toast('ยังไม่มีปาร์ตี้ · เชิญเพื่อนได้ที่แผงสังคม (P)', 'warn', 2200); return; }
    this.s.ui.closeAll?.();
    if (sel) this.sel = sel;
    this.open = true; this.win.classList.remove('hidden');
    this.render(true); this.s.sfx?.play?.('open');
  }
  close() { this.open = false; this.win.classList.add('hidden'); }

  // ---------------- วาดหน้าต่าง ----------------
  render(force = false) {
    if (!this.open || !this.party) return;
    if (this.win.classList.contains('hidden')) { this.open = false; return; }       // ถูก closeAll ปิดไป
    const ms = this.members(), lead = this.member(this.party.leader);
    if (!this.sel || !this.member(this.sel)) this.sel = this.selfId;
    const sig = ms.map((m) => `${m.id}:${m.dead ? 1 : 0}:${this.heroOf(m.app)}`).join(',') + `|${this.party.leader}|${this.sel}|${this.following}`;
    if (!force && sig === this.sig) { this.dyn(); return; }
    this.sig = sig;
    // หัวหน้าต่าง
    const total = ms.reduce((a, m) => a + (m.cp || 0), 0), avg = total / Math.max(1, ms.length);
    const tier = avg >= 30000 ? ['S', '#d4a52c', '#fff1c4'] : avg >= 15000 ? ['A', '#9b6fd0', '#e8d6ff'] : avg >= 6000 ? ['B', '#4f93c4', '#d4ecff'] : ['C', '#8a8a8a', '#e6e6e6'];
    const has = (...j) => ms.some((m) => j.includes(jobOf(m)));
    const tags = [has('boxer', 'swordman') && 'มีแนวหน้า', has('archer', 'mage') && 'ตีไกล'].filter(Boolean);
    const T = this.win.querySelector('.tw-tier');
    T.style.setProperty('--tc', tier[1]); T.style.setProperty('--tc2', tier[2]);
    T.innerHTML = `<span class="tw-medal">ระดับ ${tier[0]}</span>${tags.map((t) => `<span class="tw-t">${t}</span>`).join('')}${has('healer') ? '<span class="tw-t">มีหมอยา</span>' : '<span class="tw-t warn">ยังไม่มีหมอยา</span>'}<span class="tw-t">${ms.length}/${PARTY.maxSize} คน</span>`;
    this.win.querySelector('.tw-title').textContent = `ปาร์ตี้ของ ${lead?.name || '?'}`;
    this.win.querySelector('.tw-cp b').textContent = fmt(total);
    // การ์ด
    const followers = ms.filter((m) => m.follow && m.id !== this.party.leader).length;
    const cards = ms.map((m) => {
      const J = jobOf(m), rar = m.level >= 100 ? 'r-gold' : m.level >= 50 ? 'r-violet' : '';
      const isLead = m.id === this.party.leader, me = m.id === this.selfId;
      const badge = isLead && !this.isLeader() ? `<span class="tw-fbtn${this.following ? ' on' : ''}" data-follow>${img(this.following ? 'ui_check' : 'ui_walk')}${this.following ? 'กำลังติดตาม' : 'ติดตาม'}</span>`
        : isLead && followers ? `<span class="tw-fcount">${img('ui_walk')}ผู้ติดตาม ${followers} คน</span>` : '';
      return `<button type="button" class="tw-card ${rar}${m.id === this.sel ? ' sel' : ''}${m.dead ? ' dead' : ''}${isLead ? ' lead' : ''}" data-id="${m.id}" style="--jc:${JOB_COL[J]}">
        ${isLead ? img('ui_crown', 'tw-crown') : ''}
        <div class="tw-top"><span class="tw-ic">${img(JOB_IC[J])}</span><span class="tw-lv">Lv.${m.level}</span></div>${badge}
        <div class="tw-arch"><span class="tw-ped"></span><canvas width="44" height="60" data-hero="${this.heroOf(m.app) || ''}"></canvas></div>
        <div class="tw-name">${esc(m.name)}</div><div class="tw-job">${me ? '<b>คุณ</b> · ' : ''}${JOBS[J]?.nameTh || 'ชาวบ้าน'}</div>
        <span class="tw-role"><i></i>${JOB_ROLE[J]}</span>
        <div class="tw-bfs"></div>
        <div class="tw-bars"><div class="tw-bar h"><i></i><span></span></div><div class="tw-bar m"><i></i><span></span></div></div>
        <div class="tw-cpr">${img('ui_swords')}<span></span></div>
        <div class="tw-where"></div></button>`;
    });
    for (let i = ms.length; i < PARTY.maxSize; i++) cards.push('<button type="button" class="tw-card empty"><span class="tw-plus">+</span><span>เชิญเพื่อน</span><small>เลือกจากรายชื่อคนออนไลน์</small></button>');
    this.win.querySelector('.tw-cards').innerHTML = cards.join('');
    for (const m of ms) this.ensureHero(this.heroOf(m.app));
    this.drawArt(); this.dyn(); this.acts();
  }

  /** ส่วนที่เปลี่ยนบ่อย (HP/MP/พลัง/ที่อยู่/บัฟ) · ไม่วาดการ์ดใหม่ทั้งใบ */
  dyn() {
    const p = this.s.player;
    for (const el of this.win.querySelectorAll('.tw-card[data-id]')) {
      const m = this.member(el.dataset.id); if (!m) continue;
      const r = this.s.remotes.get(m.id), me = m.id === this.selfId;
      const hp = me ? p.char.hp : r?.hp ?? m.hp, maxHp = me ? p.derived?.maxHp || m.maxHp : r?.maxHp ?? m.maxHp;
      const mp = me ? p.char.mp : m.mp, maxMp = me ? p.derived?.maxMp || m.maxMp : m.maxMp;
      const hpP = Math.max(0, Math.min(1, hp / Math.max(1, maxHp))), mpP = Math.max(0, Math.min(1, mp / Math.max(1, maxMp)));
      const [hb, mb] = el.querySelectorAll('.tw-bar');
      hb.querySelector('i').style.width = `${hpP * 100}%`; hb.querySelector('span').textContent = `HP ${Math.round(hpP * 100)}%`;
      mb.querySelector('i').style.width = `${mpP * 100}%`; mb.querySelector('span').textContent = `MP ${Math.round(mpP * 100)}%`;
      el.querySelector('.tw-cpr span').textContent = fmt(m.cp);
      const w = el.querySelector('.tw-where'), sameMap = me || !!r;
      const d = r ? Math.round(Math.hypot(r.x - p.x, r.y - p.y) / 16) : 0;
      w.className = `tw-where${m.dead ? ' dead' : !sameMap ? ' far' : ''}`;
      w.textContent = `📍 ${m.dead ? 'สลบ · รอฟื้น' : me ? (m.place || 'ที่นี่') : sameMap ? `${m.place || ''} · ${d} ม.` : m.place || 'คนละแมพ'}`;
      el.querySelector('.tw-bfs').innerHTML = (m.buffs || []).filter((b) => this.leftOf(b) > 0).slice(0, 5).map((b) => this.chip(b, 'tw-bf')).join('');
    }
  }
  chip(b, cls) {
    const dur = (b.dur || 0) * 1000 || SKILL_BY_ID[b.sk]?.duration || 15000, left = this.leftOf(b);
    const nm = SKILL_BY_ID[b.sk]?.nameTh || b.sk;
    return `<span class="${cls}" style="--bc:${buffCol(b.sk)};--p:${Math.max(0, Math.min(1, left / dur)).toFixed(3)}" title="${esc(nm)} · จาก ${esc(b.from || '?')} · เหลือ ${Math.ceil(left / 1000)} วิ">${skImg(b.sk)}</span>`;
  }
  drawArt() {
    for (const c of this.win.querySelectorAll('canvas[data-hero]')) {
      const im = c.dataset.hero && this.sheet(c.dataset.hero); if (!im) continue;
      const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, 44, 60);
      g.drawImage(im, this.frame * 72 + 14, 9, 44, 60, 0, 0, 44, 60);
    }
  }
  acts() {
    const s = this.member(this.sel) || this.member(this.selfId), self = s?.id === this.selfId, L = this.isLeader();
    const lead = this.member(this.party.leader);
    const B = (a, ic, t, cls = '', dis = false) => `<button type="button" data-a="${a}" class="${cls}" ${dis ? 'disabled' : ''}>${img(ic)}${esc(t)}</button>`;
    const F = !L && lead ? `<button type="button" data-a="follow" class="tw-follow${this.following ? ' on' : ''}">${img(this.following ? 'ui_check' : 'ui_walk')}${this.following ? `กำลังติดตาม ${esc(lead.name)}` : 'ติดตามหัวหน้าปาร์ตี้'}</button>` : '';
    const near = !!this.s.remotes.get(s?.id);
    this.win.querySelector('.tw-acts').innerHTML = F + (self
      ? B('leave', 'ui_door', 'ออกจากปาร์ตี้', 'danger') + B('invite', 'ui_plus', 'เชิญเพื่อน', '', this.members().length >= PARTY.maxSize)
      : B('whisper', 'ui_chat', `กระซิบ ${s.name}`) + B('trade', 'ui_exchange', 'เทรด', '', !near || s.dead) + (L ? B('lead', 'ui_crown', 'มอบหัวหน้า') + B('kick', 'ui_door', 'เชิญออก', 'danger') : ''));
    this.win.querySelector('.tw-info').textContent = this.following ? 'เดินตามหลังหัวหน้า · เจอผีจะตีก่อนแล้วตามต่อ · เดินเอง = หยุดติดตาม'
      : self ? `แบ่ง EXP ให้สมาชิกที่อยู่ใกล้ (ในระยะ ${PARTY.shareRange} พิกเซล)` : s.dead ? 'สลบอยู่ · หมอยาชุบชีวิตได้' : near ? 'อยู่แมพเดียวกัน · ได้ EXP แบ่งเมื่ออยู่ใกล้' : 'อยู่คนละแมพ · เทรดไม่ได้';
  }
  async act(a) {
    const s = this.member(this.sel), net = this.s.net;
    if (a === 'follow') return this.toggleFollow();
    if (a === 'invite') return this.inviteMore();
    if (a === 'leave') { if (await ask({ title: 'ออกจากปาร์ตี้?', text: 'ออกแล้วต้องให้หัวหน้าเชิญใหม่', ok: 'ออกจากปาร์ตี้', danger: true })) { this.soc.pw?.setFollow(false, true); net.send('party:leave'); } return; }
    if (!s) return;
    if (a === 'whisper') { this.close(); this.s.ui.chatBox?.whisperTo(s.name); return; }
    if (a === 'trade') { this.close(); this.soc.requestTrade(s.id); return; }
    if (a === 'lead') { if (await ask({ title: 'มอบหัวหน้า?', text: `ให้ ${s.name} เป็นหัวหน้าปาร์ตี้คนใหม่`, ok: 'มอบหัวหน้า' })) net.send('party:lead', { id: s.id }); return; }
    if (a === 'kick') { if (await ask({ title: 'เชิญออกจากปาร์ตี้?', text: `${s.name} จะถูกเชิญออกจากปาร์ตี้`, ok: 'เชิญออก', danger: true })) net.send('party:kick', { id: s.id }); }
  }
  inviteMore() {
    if (this.members().length >= PARTY.maxSize) return this.s.ui.toast('ปาร์ตี้เต็มแล้ว', 'warn', 1800);
    this.close(); this.soc.pw?.open();
  }

  // ---------------- ติดตามหัวหน้า (ใช้ระบบ PartyWindow) ----------------
  toggleFollow() {
    const lead = this.member(this.party?.leader);
    if (!lead || this.isLeader()) return;
    if (!this.following && !this.s.remotes.get(lead.id)) { this.s.ui.toast(`${lead.name} อยู่คนละแมพ (${lead.place || '?'}) · ไปแมพเดียวกันก่อนแล้วค่อยกดติดตาม`, 'warn', 3200); return; }
    this.soc.pw?.setFollow(!this.following);
    if (this.open) this.render(true);
  }

  // ---------------- ทุกเฟรม ----------------
  update(time) {
    if (!this.open) return;
    if (this.win.classList.contains('hidden')) { this.open = false; return; }
    if (time >= this.nextFrame) { this.nextFrame = time + 230; this.frame = (this.frame + 1) % 4; this.drawArt(); }
    if (time >= this.nextDyn) { this.nextDyn = time + 500; this.render(); }
  }
}

