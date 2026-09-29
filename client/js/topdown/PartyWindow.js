// ============================================================
//  PartyWindow – หน้าต่างปาร์ตี้ (แบบการ์ดซุ้มประตูวัด) · แถบปาร์ตี้ซ้ายบน · ติดตามหัวหน้า · บัฟจากเพื่อน
//  ข้อมูลมาจาก party:state (server ส่งทุก 1 วิ): ชุด · CP · MP · ฉายา · สถานที่ · บัฟ · จำนวนผู้ติดตาม
//  ▸ แรงก์ทีม = ค่าพลังเฉลี่ยต่อคน  S ≥ 30,000 · A ≥ 15,000 · B ≥ 6,000 · C ต่ำกว่า
//  ▸ ติดตามหัวหน้า: เดินตามห่าง ~2 ช่อง · เดินเอง/คลิกผี = เลิกตาม · หัวหน้าข้ามแมพ → ถามก่อนเดินไปประตู
// ============================================================
import { JOBS } from '/shared/data/classes.js';
import { ITEMS, baseItemId } from '/shared/data/items.js';
import { SKILL_BY_ID } from '/shared/data/skills.js';
import { TD_MAPS } from '/shared/td/maps.js';
import { EQUIP_SLOTS, SLOT_TH } from '/shared/data/slots.js';
import { TITLE_BY_ID } from '/shared/data/titles.js';
import { PARTY } from '/shared/constants.js';
import { HeroView, heroFace } from '../systems/HeroPreview.js';
import { itemIcon, makeText } from '../systems/util.js';
import { ask } from '../systems/Dialog.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Math.round(n || 0).toLocaleString('en-US');
export const JOB_ICON = { swordman: '⚔️', mage: '🔮', archer: '🏹', boxer: '🥊', healer: '🌿', villager: '🙂' };
/** สีประจำอาชีพ (แท่นเรืองแสง/วงหน้า) */
export const JOB_COLOR = { swordman: '#e8574a', mage: '#a66bff', archer: '#d9a441', boxer: '#ff8a3d', healer: '#5fd98a', villager: '#b9a88a' };
/** บทบาทในทีม */
const ROLE = { swordman: ['front', 'แนวหน้า'], boxer: ['front', 'ประชิด'], archer: ['range', 'ตีไกล'], mage: ['range', 'เวทไกล'], healer: ['heal', 'หมอยา'] };
const RANKS = [['S', 30000], ['A', 15000], ['B', 6000], ['C', 0]];
export const teamRank = (avg) => RANKS.find(([, v]) => avg >= v)[0];
const jobOf = (m) => m.wj || m.job || 'villager';
const frameOf = (lv) => (lv >= 100 ? 'gold' : lv >= 50 ? 'purple' : 'silver');

/** ข้อความผลบัฟ */
export function buffText(b = {}) {
  const o = [];
  if (b.atkMul) o.push(`โจมตี +${Math.round(b.atkMul * 100)}%`);
  if (b.def) o.push(`ป้องกัน +${b.def}`);
  if (b.defMul) o.push(`ป้องกัน +${Math.round(b.defMul * 100)}%`);
  if (b.critAdd) o.push(`คริ +${Math.round(b.critAdd * 100)}%`);
  if (b.speed) o.push(`วิ่งเร็ว +${Math.round(b.speed * 100)}%`);
  if (b.cleanse) o.push('ล้างสถานะผิดปกติ');
  if (b.undying) o.push('กันตาย 1 ครั้ง');
  return o.join(' · ');
}

/** ไอคอนบัฟพร้อมวงนับถอยหลัง */
function buffIcon(b, cls = 'pb-buff') {
  const sk = SKILL_BY_ID[b.sk]; if (!sk) return '';
  const pct = b.dur > 0 ? Math.max(0, Math.min(100, (b.left / b.dur) * 100)) : 100;
  return `<span class="${cls}${b.left < 4 ? ' ending' : ''}" style="--p:${pct.toFixed(0)}%" title="${esc(sk.nameTh)} · เหลือ ${Math.ceil(b.left)} วิ · จาก ${esc(b.from)}">${sk.icon || '✨'}</span>`;
}

export class PartyWindow {
  /** @param social TdSocial */
  constructor(social) {
    this.so = social;
    this.cards = new Map();        // id → { el, view, key }
    this.rows = new Map();         // id → el (แถบปาร์ตี้)
    this.following = false;
    this.askedMap = null;
    this.bindDom();
  }

  get scene() { return this.so.scene; }
  get party() { return this.so.party; }
  get selfId() { return this.so.selfId; }
  get net() { return this.so.net; }

  bindDom() {
    const box = $('#soc-party');
    box?.addEventListener('click', (e) => {
      const b = e.target.closest('[data-pw]'); if (!b || b.disabled) return;
      const id = b.dataset.id, m = this.party?.members.find((x) => x.id === id);
      this.scene.sfx?.play('click');
      switch (b.dataset.pw) {
        case 'whisper': if (m) { this.so.ui.closeAll(); this.so.ui.chatBox?.whisperTo(m.name); } break;
        case 'trade': this.so.requestTrade(id); break;
        case 'inspect': this.inspect(id); break;
        case 'lead': if (m) ask({ title: `มอบหัวหน้าให้ ${m.name}?`, icon: '👑', ok: 'มอบหัวหน้า' }).then((y) => { if (y) this.net.send('party:lead', { id }); }); break;
        case 'kick': if (m) ask({ title: `เชิญ ${m.name} ออกจากปาร์ตี้?`, icon: '🚪', danger: true, ok: 'เชิญออก' }).then((y) => { if (y) this.net.send('party:kick', { id }); }); break;
        case 'leave': ask({ title: 'ออกจากปาร์ตี้?', icon: '🚪', danger: true, ok: 'ออกจากปาร์ตี้' }).then((y) => { if (y) { this.setFollow(false, true); this.net.send('party:leave'); } }); break;
        case 'invite': this.showInvite(); break;
        case 'follow': this.setFollow(!this.following); break;
      }
    });
    // แตะไอคอนบัฟ (มือถือไม่มี hover) → บอกชื่อ/ผล/เวลาที่เหลือ/ใครให้
    $('#hud-buffs')?.addEventListener('click', (e) => { const b = e.target.closest('.buff'); if (b?.title) this.so.ui.toast(b.title.replace(/\n/g, ' · '), '', 2600); });
    // แถบปาร์ตี้ซ้ายบน: คลิก/แตะ = เปิดหน้าต่างปาร์ตี้
    $('#party-frames')?.addEventListener('click', (e) => {
      if (e.target.closest('.pf-bonus')) return;
      if (!e.target.closest('.pm')) return;
      this.open();
    });
  }

  /** เปิดหน้าต่างสังคมที่แท็บปาร์ตี้ */
  open() {
    const ui = this.so.ui, pan = $('#social-panel');
    if (pan.classList.contains('hidden')) ui.toggle('social-panel', true);
    document.querySelector('[data-soctab="party"]')?.click();
  }

  /** ปุ่มเชิญ → เลื่อนไปรายชื่อผู้เล่นออนไลน์ด้านล่าง */
  showInvite() {
    const el = $('#soc-players'); if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  }

  // ============================================================
  //  หน้าต่างปาร์ตี้
  // ============================================================
  render() {
    const box = $('#soc-party'); if (!box) return;
    const P = this.party, me = this.selfId;
    if (!P) {
      if (box._mode !== 'empty') {
        box._mode = 'empty'; this.dropCards();
        box.innerHTML = `<div class="pw-empty"><div class="pw-empty-ic">🏯</div><b>ยังไม่มีปาร์ตี้</b><p>เชิญผู้เล่นจากรายชื่อด้านล่าง หรือคลิกที่ตัวผู้เล่นในแมพ<br>อยู่แมพเดียวกัน = แบ่ง EXP กัน + โบนัส EXP +${Math.round(PARTY.mapBonus * 100)}% ต่อเพื่อน 1 คน</p>
          <button class="btn primary sm" data-pw="invite">🤝 เชิญเพื่อน</button></div>`;
      }
      return;
    }
    if (box._mode !== 'party') {
      box._mode = 'party';
      box.innerHTML = `<div class="pw-head"></div><div class="pw-cards" tabindex="0"></div><div class="pw-foot"></div>`;
    }
    const lead = P.members.find((m) => m.id === P.leader), iLead = P.leader === me;
    // ---------- หัว: แรงก์ทีม · แท็กบทบาท · พลังรวม ----------
    const cps = P.members.map((m) => m.cp || 0), sum = cps.reduce((a, b) => a + b, 0), avg = sum / Math.max(1, P.members.length);
    const rk = teamRank(avg);
    const roles = new Set(P.members.map((m) => ROLE[jobOf(m)]?.[0]).filter(Boolean));
    const tags = [`<span class="pw-tag rank r${rk}" title="ค่าพลังเฉลี่ย ${fmt(avg)} ต่อคน">ระดับ ${rk}</span>`,
      roles.has('front') ? '<span class="pw-tag">🛡 มีแนวหน้า</span>' : '<span class="pw-tag warn" title="ไม่มีขุนศึก/นักมวย รับดาเมจแทน">⚠ ไม่มีแนวหน้า</span>',
      roles.has('range') ? '<span class="pw-tag">🏹 ตีไกล</span>' : '',
      roles.has('heal') ? '<span class="pw-tag heal">🌿 มีหมอยา</span>' : '<span class="pw-tag warn" title="ไม่มีหมอยาคอยรักษา/ชุบชีวิต">⚠ ไม่มีหมอยา</span>',
      `<span class="pw-tag">👥 ${P.members.length}/${PARTY.maxSize} คน</span>`].join('');
    const here = P.members.filter((m) => m.id !== me && this.scene.remotes.has(m.id)).length;
    setHtml(box.querySelector('.pw-head'), `<div class="pw-tags">${tags}</div>
      <div class="pw-title"><span>ปาร์ตี้ของ <b>${esc(lead?.name || '?')}</b></span><span class="pw-power"><b>⚔ ${fmt(sum)}</b> <small>พลังรวมทีม</small></span></div>
      <div class="pw-exp${here ? ' on' : ''}">✨ EXP ปาร์ตี้ ${here ? `+${Math.round(here * PARTY.mapBonus * 100)}%` : '—'} <small>เพื่อนแมพเดียวกัน ${here}/${P.members.length - 1} คน · แบ่ง EXP ทั้งแมพ</small></div>`);
    // ---------- การ์ดสมาชิก (หัวหน้าก่อน → ตัวเรา → คนอื่น) ----------
    const order = [...P.members].sort((a, b) => (b.id === P.leader) - (a.id === P.leader) || (b.id === me) - (a.id === me));
    const wrap = box.querySelector('.pw-cards');
    const live = new Set(order.map((m) => m.id));
    for (const [id, c] of this.cards) if (!live.has(id)) { c.view?.destroy(); c.el.remove(); this.cards.delete(id); }
    for (const m of order) {
      let c = this.cards.get(m.id);
      if (!c) {
        const el = document.createElement('div');
        el.className = 'pw-card'; el.dataset.id = m.id;
        el.innerHTML = `<div class="pw-crown">👑</div><div class="pw-arch"><i class="pw-ray"></i><i class="pw-ped"></i><canvas class="pw-hero"></canvas><div class="pw-ov"></div></div><div class="pw-info"></div><div class="pw-actw"></div>`;
        wrap.appendChild(el);
        c = { el, view: null, key: '' };
        try { c.view = new HeroView(el.querySelector('canvas'), this.scene, { scale: 2, shadow: false, autoDrop: true }); } catch { c.view = null; }
        this.cards.set(m.id, c);
      }
      wrap.appendChild(c.el);                                       // เรียงลำดับใหม่ (ย้าย node ไม่ทำให้ภาพหาย)
      this.fillCard(c, m, P, me, iLead);
    }
    // ช่องว่าง = เชิญ
    wrap.querySelectorAll('.pw-slot').forEach((x) => x.remove());
    for (let i = P.members.length; i < PARTY.maxSize; i++) {
      const s = document.createElement('button');
      s.className = 'pw-slot'; s.dataset.pw = 'invite';
      s.innerHTML = '<span>＋</span><small>ว่าง<br>เชิญเพื่อน</small>';
      wrap.appendChild(s);
    }
    // ---------- ปุ่มล่าง ----------
    const fol = !iLead ? `<button class="btn pw-follow${this.following ? ' on' : ''}" data-pw="follow">${this.following ? '⏹ หยุดติดตาม' : `🧭 ติดตามหัวหน้า (${esc(lead?.name || '')})`}</button>` : (P.followers ? `<span class="pw-folnote">🧭 มีผู้ติดตามคุณ ${P.followers} คน</span>` : '');
    setHtml(box.querySelector('.pw-foot'), `${fol}<div class="pw-btns"><button class="btn ghost sm" data-pw="leave">🚪 ออกจากปาร์ตี้</button>${P.members.length < PARTY.maxSize ? '<button class="btn primary sm" data-pw="invite">🤝 เชิญเพื่อน</button>' : ''}</div>`);
  }

  fillCard(c, m, P, me, iLead) {
    const job = jobOf(m), J = JOBS[job], color = JOB_COLOR[job] || JOB_COLOR.villager;
    const isMe = m.id === me, isLead = m.id === P.leader, r = this.scene.remotes.get(m.id);
    const far = !isMe && !r;
    const el = c.el;
    el.className = `pw-card f-${frameOf(m.level)}${isLead ? ' leader' : ''}${isMe ? ' me' : ''}${far ? ' far' : ''}${m.dead ? ' dead' : ''}`;
    el.style.setProperty('--jc', color);
    if (c.view && m.app) { const k = JSON.stringify(m.app); if (k !== c.key) { c.key = k; c.view.set({ ...m.app }, 'idle', 'south'); } }
    const hp = r?.hp ?? m.hp, maxHp = r?.maxHp ?? m.maxHp;
    const hpP = Math.max(0, Math.min(100, (hp / Math.max(1, maxHp)) * 100)), mpP = Math.max(0, Math.min(100, (m.mp / Math.max(1, m.maxMp)) * 100));
    const role = ROLE[job];
    const wpn = JOB_ICON[job] || '🙂';
    const dist = r ? Math.round(Math.hypot(r.x - this.scene.player.x, r.y - this.scene.player.y) / 16) : null;
    const T = TITLE_BY_ID[m.title];
    setHtml(el.querySelector('.pw-ov'), `<span class="pw-lv">Lv.${m.level}</span><span class="pw-wpn" title="${esc(J?.nameTh || '')}">${wpn}</span>
      ${isLead && P.followers ? `<span class="pw-fol">🧭 ผู้ติดตาม ${P.followers} คน</span>` : ''}
      ${m.follow ? '<span class="pw-fol me">🧭 ติดตามหัวหน้า</span>' : ''}
      ${m.dead ? '<b class="pw-stamp dead">หมดสติ</b>' : far ? '<b class="pw-stamp">ต่างแมพ</b>' : ''}`);
    const acts = isMe ? '' : `<div class="pw-acts">
        <button class="btn ghost sm" data-pw="whisper" data-id="${m.id}" title="กระซิบ">💬</button>
        <button class="btn ghost sm" data-pw="inspect" data-id="${m.id}" title="ดูอุปกรณ์">🛡</button>
        <button class="btn ghost sm" data-pw="trade" data-id="${m.id}" title="${r ? 'เทรด' : 'เทรดได้เฉพาะแมพเดียวกัน'}" ${r ? '' : 'disabled'}>💱</button>
        ${iLead ? `<button class="btn ghost sm" data-pw="lead" data-id="${m.id}" title="มอบหัวหน้า">👑</button><button class="btn ghost sm danger" data-pw="kick" data-id="${m.id}" title="เชิญออก">✕</button>` : ''}</div>`;
    setHtml(el.querySelector('.pw-actw'), acts);
    setHtml(el.querySelector('.pw-info'), `
      ${T ? `<div class="pw-ttl" style="color:${T.color || '#fff'}">«${esc(T.nameTh)}»</div>` : ''}
      <div class="pw-name">${esc(m.name)}</div>
      <div class="pw-sub">${isMe ? 'คุณ · ' : ''}${esc(J?.nameTh || 'ชาวบ้าน')} ${role ? `<span class="pw-role ${role[0]}">${role[1]}</span>` : ''}</div>
      <div class="pw-bar hp"><i style="width:${hpP.toFixed(0)}%"></i><span>HP ${hpP.toFixed(0)}%</span></div>
      <div class="pw-bar mp"><i style="width:${mpP.toFixed(0)}%"></i><span>MP ${mpP.toFixed(0)}%</span></div>
      <div class="pw-cp">⚔ ${fmt(m.cp)}</div>
      <div class="pw-loc" title="${esc(m.place || '')}">📍 ${esc(m.place || '?')}${dist != null ? ` · ${dist} ม.` : ''}</div>
      <div class="pw-buffs">${(m.buffs || []).map((b) => buffIcon(b)).join('') || '<small class="pw-nobuff">ไม่มีบัฟ</small>'}</div>`);
  }

  dropCards() { for (const c of this.cards.values()) { c.view?.destroy(); c.el.remove(); } this.cards.clear(); }

  // ============================================================
  //  แถบปาร์ตี้ซ้ายบน (หน้า · อาชีพ · ชื่อ · Lv · HP · บัฟ)
  // ============================================================
  renderBar() {
    const pf = $('#party-frames'); if (!pf) return;
    const P = this.party, others = (P?.members || []).filter((m) => m.id !== this.selfId);
    pf.classList.toggle('hidden', !others.length);
    if (!others.length) { pf.innerHTML = ''; this.rows.clear(); return; }
    let bonus = pf.querySelector('.pf-bonus');
    if (!bonus) { bonus = document.createElement('div'); bonus.className = 'pf-bonus'; pf.prepend(bonus); }
    const here = others.filter((m) => this.scene.remotes.has(m.id)).length;
    bonus.classList.toggle('on', !!here);
    bonus.title = `เพื่อนปาร์ตี้ที่อยู่แมพเดียวกัน: EXP +${Math.round(PARTY.mapBonus * 100)}% ต่อคน และแชร์ EXP กันทั้งแมพ`;
    setHtml(bonus, `✨ EXP ปาร์ตี้ ${here ? `+${Math.round(here * PARTY.mapBonus * 100)}%` : '—'} <small>แมพเดียวกัน ${here}/${others.length}</small>${this.following ? ' <b class="pf-fol" title="กำลังติดตามหัวหน้า">🧭</b>' : ''}`);
    const live = new Set(others.map((m) => m.id));
    for (const [id, el] of this.rows) if (!live.has(id)) { el.remove(); this.rows.delete(id); }
    for (const m of others) {
      let el = this.rows.get(m.id);
      if (!el) {
        el = document.createElement('div'); el.className = 'pm'; el.dataset.id = m.id;
        el.innerHTML = '<span class="pm-face"><img class="pm-fimg" alt=""><i class="pm-job"></i></span><div class="pm-body"><div class="pm-name"></div><div class="bar hp mini"><i></i></div><div class="pm-buffs"></div></div>';
        this.rows.set(m.id, el);
      }
      pf.appendChild(el);
      const r = this.scene.remotes.get(m.id), job = jobOf(m);
      const hp = r?.hp ?? m.hp, max = r?.maxHp ?? m.maxHp;
      el.className = `pm${r ? '' : ' far'}${m.id === P.leader ? ' leader' : ''}${m.dead ? ' dead' : ''}`;
      el.style.setProperty('--jc', JOB_COLOR[job] || JOB_COLOR.villager);
      el.title = `${m.name} · ${JOBS[job]?.nameTh || ''} · 📍 ${m.place || ''} (คลิกเปิดหน้าต่างปาร์ตี้)`;
      const img = el.querySelector('.pm-fimg'), face = heroFace(m.app);
      if (face && img.getAttribute('src') !== face) img.src = face;
      img.style.display = face ? '' : 'none';
      const ji = el.querySelector('.pm-job'); if (ji.textContent !== (JOB_ICON[job] || '🙂')) ji.textContent = JOB_ICON[job] || '🙂';
      setHtml(el.querySelector('.pm-name'), `${m.id === P.leader ? '👑 ' : ''}${esc(m.name)} <small>Lv.${m.level}</small>`);
      el.querySelector('.bar i').style.width = `${Math.max(0, Math.min(100, (hp / Math.max(1, max)) * 100))}%`;
      setHtml(el.querySelector('.pm-buffs'), (m.buffs || []).slice(0, 5).map((b) => buffIcon(b, 'pb-buff sm')).join(''));
    }
  }

  // ============================================================
  //  ติดตามหัวหน้า
  // ============================================================
  setFollow(on, quiet = false) {
    on = !!on && !!this.party && this.party.leader !== this.selfId;
    if (on === this.following) return;
    this.following = on; this.askedMap = null;
    this.net.send('party:follow', { on });
    if (on) { this.scene.player.target = null; this.scene.player.autoTarget = null; }
    else if (this.scene.player?.path) this.scene.player.path = [];
    if (!quiet) this.so.ui.toast(on ? '🧭 ติดตามหัวหน้า · เดินเอง/คลิกผี = เลิกตาม' : '⏹ เลิกติดตามหัวหน้า', on ? 'ok' : '', 1800);
    this.render(); this.renderBar();
  }
  /** เรียกจากฉาก: ผู้เล่นเดินเอง/คลิกผี/คลิกพื้น */
  stopFollow() { if (this.following) this.setFollow(false); }

  followTick(time) {
    if (!this.following) return;
    const P = this.party, s = this.scene, p = s.player;
    if (!P || P.leader === this.selfId) return this.setFollow(false, true);
    if (!p.alive || s.warping) return;
    if (time < (this.nextFollow || 0)) return;
    this.nextFollow = time + 350;
    const r = s.remotes.get(P.leader), L = P.members.find((m) => m.id === P.leader);
    if (r) {
      this.askedMap = null;
      const d = Math.hypot(r.x - p.x, r.y - p.y);
      if (d > 44) {                                                   // ห่างเกิน ~2.5 ช่อง → เดินไปยืนข้างหลังหัวหน้า ~2 ช่อง
        const k = 30 / d, tx = r.x + (p.x - r.x) * k, ty = r.y + (p.y - r.y) * k;
        s.moveTo(tx, ty);
      } else if (d < 26 && p.path?.length) p.path = [];
      return;
    }
    // หัวหน้าไม่อยู่ในแมพนี้ → อยู่คนละแมพ: ถามก่อนตามไปทางประตู
    if (!L || !L.map || L.map === s.M?.id || this.askedMap === L.map) return;
    this.askedMap = L.map;
    const T2 = TD_MAPS[L.map], gate = (s.portals || []).find((pt) => pt.to === L.map);
    if (!T2 || !gate) { this.so.ui.toast(`🧭 หัวหน้าไป ${L.place || 'แมพอื่น'} · ไม่มีประตูตรงจากที่นี่ – ใช้ NPC วาร์ป`, 'warn', 3200); this.setFollow(false, true); return; }
    ask({ title: `หัวหน้าไป ${T2.nameTh} แล้ว`, text: `ตามไปทางประตูมิติไหม?\n📍 ${L.place || T2.nameTh}`, icon: '🧭', ok: 'ตามไป', cancel: 'เลิกติดตาม' }).then((y) => {
      if (!y) return this.setFollow(false);
      if (this.following) s.moveTo(gate.x, gate.y);
    });
  }

  // ============================================================
  //  บัฟจากเพื่อน: การ์ดแจ้งเตือนกลางจอ + วงแสง/ตัวหนังสือลอยที่ตัวละคร
  // ============================================================
  buffReceived({ from, fromId, skillId, lv }, sk) {
    const m = this.party?.members.find((x) => x.id === fromId);
    const app = m?.app || this.scene.remotes.get(fromId)?.appearance;
    const face = heroFace(app);
    const eff = buffText(sk.type === 'revive' ? { undying: true } : sk.buff) || (sk.heal ? `ฟื้น HP ${Math.round(sk.heal * 100)}%` : '');
    const dur = Math.round((sk.type === 'revive' ? sk.undying : sk.duration) / 1000);
    let host = $('#buff-notes');
    if (!host) { host = document.createElement('div'); host.id = 'buff-notes'; document.querySelector('#ui')?.appendChild(host) || document.body.appendChild(host); }
    const card = document.createElement('div');
    card.className = 'buff-note';
    card.style.setProperty('--jc', JOB_COLOR[jobOf(m || {})] || '#f4d03f');
    card.innerHTML = `<span class="bn-face">${face ? `<img src="${face}" alt="">` : JOB_ICON[jobOf(m || {})] || '🙂'}</span>
      <span class="bn-sk">${sk.icon || '✨'}</span>
      <div class="bn-txt"><span><b>${esc(from)}</b> ใช้ <b class="bn-name">${esc(sk.nameTh)}</b>${lv > 1 ? ` <small class="bn-lv">Lv.${lv}</small>` : ''} ให้คุณ</span><small>${esc(eff)}${dur ? ` · ${dur} วิ` : ''}</small></div>`;
    host.appendChild(card);
    while (host.children.length > 3) host.firstChild.remove();
    setTimeout(() => card.classList.add('out'), 3000);
    setTimeout(() => card.remove(), 3400);
    // ที่ตัวละคร: วงแสง + ตัวหนังสือลอย
    const s = this.scene, p = s.player;
    try {
      const ring = s.add.circle(p.x, p.y - 4, 8).setStrokeStyle(2, 0xffe08a, 0.95).setDepth(p.depth + 1);
      s.tweens.add({ targets: ring, radius: 22, alpha: 0, duration: 700, ease: 'Sine.easeOut', onUpdate: () => ring.setPosition(p.x, p.y - 4), onComplete: () => ring.destroy() });
      const t = makeText(s, p.x, p.y - 40, `${sk.icon || ''} ${sk.nameTh}`, { fontSize: '7px', color: '#ffe08a' }).setOrigin(0.5).setDepth(99990);
      s.tweens.add({ targets: t, y: t.y - 16, alpha: 0, duration: 1500, delay: 200, onComplete: () => t.destroy() });
    } catch { /* ฉากยังไม่พร้อม */ }
    return face;
  }

  // ============================================================
  //  ดูอุปกรณ์เพื่อน
  // ============================================================
  inspect(id) {
    const sock = this.net.socket; if (!sock || !this.net.online) return;
    let done = false;
    const t = setTimeout(() => { if (!done) this.so.ui.toast('ดูอุปกรณ์ไม่สำเร็จ', 'warn'); done = true; }, 4000);
    sock.emit('party:inspect', { id }, (d) => {
      if (done) return; done = true; clearTimeout(t);
      if (!d) return this.so.ui.toast('ดูอุปกรณ์ไม่ได้ (ไม่ได้อยู่ปาร์ตี้เดียวกันแล้ว)', 'warn');
      this.showGear(d);
    });
  }

  showGear(d) {
    document.querySelector('.pw-gear-wrap')?.remove();
    const wrap = document.createElement('div');
    wrap.className = 'pw-gear-wrap';
    const rows = EQUIP_SLOTS.map((slot) => {
      const id = d.equipment?.[slot], I = id && (ITEMS[id] || ITEMS[baseItemId(id)]);
      const e = d.enhance?.[slot] || 0;
      return `<div class="pg-row${id ? '' : ' empty'}"><span class="pg-ic">${id ? itemIcon(id, I?.icon ?? '?') : '·'}</span><span class="pg-nm">${id ? `${esc(I?.nameTh || id)}${e ? ` <b class="pg-enh">+${e}</b>` : ''}` : '<small>ว่าง</small>'}</span><small class="pg-slot">${esc(SLOT_TH[slot] || slot)}</small></div>`;
    }).join('');
    wrap.innerHTML = `<div class="pw-gear panel" role="dialog"><header><span>🛡 อุปกรณ์ของ <b>${esc(d.name)}</b> <small>Lv.${d.level} · ${esc(JOBS[d.job]?.nameTh || '')} · ⚔ ${fmt(d.cp)}</small></span><button class="close" data-x>✕</button></header>
      <div class="pg-body"><canvas class="pg-hero"></canvas><div class="pg-list">${rows}</div></div></div>`;
    document.body.appendChild(wrap);
    let view = null;
    try { view = new HeroView(wrap.querySelector('canvas'), this.scene, { scale: 2, autoDrop: true }).set({ ...d.app }, 'idle', 'south'); } catch { /* */ }
    const close = () => { view?.destroy(); wrap.remove(); window.removeEventListener('keydown', key, true); };
    const key = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); close(); } };
    window.addEventListener('keydown', key, true);
    wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) close(); });
    wrap.querySelector('[data-x]').onclick = close;
  }
}

function setHtml(el, html) { if (el && el._h !== html) { el._h = html; el.innerHTML = html; } }
