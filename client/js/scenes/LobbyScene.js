// ============================================================
//  LobbyScene – หน้าเลือกตัวละคร (แบบ RO): 1 บัญชีมีได้หลายช่อง
//  ▸ เลือกช่อง → เข้าเกม / ช่องว่าง → สร้างตัวละคร / ลบตัวละคร (พิมพ์ชื่อยืนยัน)
//  ▸ ไม่มีตัวละครเลยตอนเพิ่งเข้าระบบ → ไปหน้าสร้างตัวละครทันที
// ============================================================
import { JOBS } from '/shared/data/classes.js';
import { ITEMS } from '/shared/data/items.js';
import { getDerived } from '/shared/character.js';
import { expToNext, MAX_LEVEL, STAT_KEYS } from '/shared/stats.js';
import { loadCharacter, reviveCharacter } from '../systems/Character.js';
import { classTitle as pathName } from '/shared/charmodel.js';
import { account } from '../net/Account.js';
import { sound } from '../systems/Sound.js';
import { titleScreen } from '../systems/TitleScreen.js';
import { loadSettings } from '../systems/Settings.js';
import { HeroView, loadHeroMeta, clearHeroViews } from '../systems/HeroPreview.js';
import { getMap } from '/shared/td/maps.js';
import { ask, notice } from '../systems/Dialog.js';

const $ = (s) => document.querySelector(s);
const LAST_SLOT = 'thainative_last_slot';
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class LobbyScene extends Phaser.Scene {
  constructor() { super('lobby'); }

  async create(data = {}) {
    sound.applySettings(loadSettings());
    titleScreen.start();
    clearHeroViews();
    this.events.once('shutdown', () => this.teardown());
    await loadHeroMeta();
    if (!this.sys.isActive()) return;

    this.online = account.loggedIn && !account.offline;
    this.loadList();
    // เพิ่งเข้าระบบและยังไม่มีตัวละครสักตัว → สร้างตัวแรกเลย
    if (data.boot && !this.chars.some(Boolean)) return this.scene.start('create', { slot: 0, first: true });

    let last = 0;
    try { last = +localStorage.getItem(LAST_SLOT) || 0; } catch { /* ignore */ }
    const pick = [data.select, last, this.chars.findIndex(Boolean), 0].find((i) => Number.isInteger(i) && i >= 0 && i < this.chars.length);
    this.sel = pick;

    $('#lobby-screen').classList.remove('hidden');
    this.bindDom();
    this.render();
    if (data.created) { sound.play('levelup'); this.flashCard(this.sel); }
  }

  loadList() {
    if (this.online) {
      const n = account.maxSlots || 3;
      this.chars = Array.from({ length: n }, (_, i) => reviveCharacter(account.characters[i]) || null);
    } else this.chars = [loadCharacter() || null];          // ออฟไลน์: เซฟในเครื่อง 1 ช่อง
  }

  bindDom() {
    const acc = account.account;
    $('#lb-acc').innerHTML = acc ? (acc.guest ? 'บัญชี <b>Guest</b> <small class="acc-badge guest">ยังไม่เชื่อม ID</small>' : `บัญชี <b>${esc(acc.display)}</b>`) : 'โหมดออฟไลน์ · เซฟในเครื่อง';
    $('#lb-logout').classList.toggle('hidden', !acc);
    $('#lb-logout').onclick = async () => {
      if (account.isGuest && !(await ask({ title: 'ออกจากระบบ?', icon: '⚠', danger: true, ok: 'ออกจากระบบ', text: 'บัญชี Guest ยังไม่ได้เชื่อม ID\n⚠ ถ้าออกจากระบบจะกลับมาเล่นตัวละครในบัญชีนี้ไม่ได้อีก' }))) return;
      await account.logout();
      location.reload();
    };
    $('#lb-start').onclick = () => this.enter(this.sel);
    $('#lb-delete').onclick = () => this.askDelete();
    $('#lb-del-cancel').onclick = () => $('#lb-del-box').classList.add('hidden');
    $('#lb-del-form').onsubmit = (e) => { e.preventDefault(); this.doDelete(); };
    $('#lb-del-input').onkeydown = (e) => e.stopPropagation();
    this.onKey = (e) => {
      if (!$('#lb-del-box').classList.contains('hidden')) { if (e.key === 'Escape') $('#lb-del-box').classList.add('hidden'); return; }
      if (e.key === 'ArrowLeft') this.select((this.sel + this.chars.length - 1) % this.chars.length);
      else if (e.key === 'ArrowRight') this.select((this.sel + 1) % this.chars.length);
      else if (e.key === 'Enter') this.enter(this.sel);
      else if (e.key === 'Delete') this.askDelete();
      else return;
      e.preventDefault();
    };
    document.addEventListener('keydown', this.onKey);
    this.onClick = (e) => { if (e.target.closest('button')) sound.play('click'); };
    $('#lobby-screen').addEventListener('click', this.onClick);
  }

  render() {
    clearHeroViews();
    this.views = [];
    const box = $('#lb-slots');
    box.innerHTML = this.chars.map((c, i) => c
      ? `<div class="lb-card" data-i="${i}" role="button" tabindex="0" aria-label="${esc(c.name)}">
           <span class="lb-no">${i + 1}</span>
           <div class="lb-stage"><canvas class="px"></canvas></div>
           <div class="lb-name">${esc(c.name)}</div>
           <div class="lb-sub">Lv.${c.level} · ${esc(pathName(c))}</div>
         </div>`
      : `<div class="lb-card empty" data-i="${i}" role="button" tabindex="0" aria-label="สร้างตัวละครช่องที่ ${i + 1}">
           <span class="lb-no">${i + 1}</span>
           <div class="lb-stage"><div class="lb-plus">＋</div></div>
           <div class="lb-name">ช่องว่าง</div>
           <div class="lb-sub">สร้างตัวละครใหม่</div>
         </div>`).join('');
    box.querySelectorAll('.lb-card').forEach((el) => {
      const i = +el.dataset.i, c = this.chars[i];
      if (c) this.views[i] = new HeroView(el.querySelector('canvas'), this, { scale: 2, fitHeight: .72 }).set(c.appearance, 'idle', 'south');
      el.onclick = () => { if (this.sel !== i) { sound.play('click'); this.select(i); } };
      el.onkeydown = (event) => {
        if (event.key !== ' ' && event.key !== 'Enter') return;
        event.preventDefault(); event.stopPropagation();
        if (this.sel !== i) this.select(i); else this.enter(i);
      };
      el.ondblclick = () => this.enter(i);
    });
    this.select(this.sel, true);
  }

  select(i, silent = false) {
    this.sel = i;
    titleScreen.selectCharacter(i, this.chars.length);
    const c = this.chars[i];
    document.querySelectorAll('.lb-card').forEach((el) => {
      const selected = +el.dataset.i === i;
      el.classList.toggle('sel', selected);
      el.setAttribute('aria-pressed', String(selected));
    });
    this.views.forEach((v, k) => {
      if (!v) return;
      if (k === i) v.set(this.chars[k].appearance, 'idle', 'south').setShowcase(true);
      else v.setShowcase(false).set(this.chars[k].appearance, 'idle', 'south');
    });
    const M = c ? getMap(c.tdMap) : null;
    $('#lb-start').innerHTML = c ? `<img class="btn-ico" src="assets/icons/ui_swords.png" alt=""> เริ่มผจญภัย<small class="lb-where">${M.icon} ${esc(M.nameTh)}</small>` : '<img class="btn-ico" src="assets/icons/ui_lantern.png" alt=""> สร้างตัวละคร';
    $('#lb-delete').classList.toggle('hidden', !c || !this.online);
    $('#lb-info').innerHTML = c ? this.infoHtml(c) : `<div class="lb-empty-info"><b>ช่องที่ ${i + 1} ว่างอยู่</b><br>สร้างตัวละครใหม่ได้เลย — ทุกคนเริ่มเป็นชาวบ้านแห่งกรุงศรีฯ ลองอาวุธได้ทุกแบบ แล้วปั้นอาชีพจากอาวุธที่ใช้และต้นไม้พรสวรรค์</div>`;
    if (!silent) try { localStorage.setItem(LAST_SLOT, String(i)); } catch { /* ignore */ }
  }

  infoHtml(c) {
    const d = getDerived(c);
    const need = c.level >= MAX_LEVEL ? 0 : expToNext(c.level);
    const expPct = need ? Math.min(100, Math.floor((c.exp / need) * 100)) : 100;
    const style = JOBS[c.appearance?.job]?.nameTh || '-';
    const wp = c.equipment?.weapon ? ITEMS[c.equipment.weapon]?.nameTh : 'มือเปล่า';
    const bar = (cls, v, max, label) => `<div class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, (v / Math.max(1, max)) * 100))}%"></i><span>${label}</span></div>`;
    return `
      <div class="lb-i-head"><b>${esc(c.name)}</b><span class="lv-tag">Lv.${c.level}</span><span class="job-tag">${esc(pathName(c))}</span></div>
      <div class="lb-i-grid">
        <div>
          ${bar('hp', c.hp, d.maxHp, `HP ${Math.round(c.hp)} / ${d.maxHp}`)}
          ${bar('mp', c.mp, d.maxMp, `MP ${Math.round(c.mp)} / ${d.maxMp}`)}
          ${bar('exp', expPct, 100, `EXP ${expPct}%`)}
        </div>
        <div class="lb-i-list">
          <div><small>แนวต่อสู้</small>${esc(style)}</div>
          <div><small>อาวุธ</small>${esc(wp || '-')}</div>
          <div><small>เงิน</small>฿ ${(c.gold || 0).toLocaleString()}</div>
        </div>
      </div>
      <div class="lb-i-stats">${STAT_KEYS.map((k) => `<span><small>${k}</small>${c.stats?.[k] ?? 0}</span>`).join('')}</div>`;
  }

  toast(html) {
    const t = document.createElement('div');
    t.className = 'lb-toast';
    t.innerHTML = html;
    $('#lobby-screen').appendChild(t);
    setTimeout(() => t.classList.add('out'), 4200);
    setTimeout(() => t.remove(), 4800);
  }

  flashCard(i) {
    const el = document.querySelector(`.lb-card[data-i="${i}"]`);
    if (el) { el.classList.add('born'); setTimeout(() => el.classList.remove('born'), 1600); }
  }

  enter(i) {
    const c = this.chars[i];
    if (!c) return this.scene.start('create', { slot: i });
    try { localStorage.setItem(LAST_SLOT, String(i)); } catch { /* ignore */ }
    account.slot = i;
    sound.play('blessing');
    titleScreen.stop();
    this.scene.start('ayutthaya', { char: reviveCharacter(c) });   // ฉากเกม top-down (โหลดแมพตามที่ตัวละครอยู่ล่าสุด)
  }

  askDelete() {
    const c = this.chars[this.sel];
    if (!c || !this.online) return;
    $('#lb-del-name').textContent = c.name;
    $('#lb-del-input').value = '';
    $('#lb-del-err').textContent = '';
    $('#lb-del-box').classList.remove('hidden');
    setTimeout(() => $('#lb-del-input').focus(), 30);
  }

  async doDelete() {
    const c = this.chars[this.sel];
    if (!c) return;
    try {
      await account.deleteCharacter(this.sel, $('#lb-del-input').value.trim());
      await account.refresh();
      $('#lb-del-box').classList.add('hidden');
      sound.play('error');
      this.loadList();
      this.render();
    } catch (e) { $('#lb-del-err').textContent = e.message || 'ลบไม่สำเร็จ'; sound.play('error'); }
  }

  teardown() {
    clearHeroViews();
    $('#lobby-screen').classList.add('hidden');
    $('#lb-del-box').classList.add('hidden');
    document.querySelectorAll('.lb-toast').forEach((t) => t.remove());
    if (this.onKey) document.removeEventListener('keydown', this.onKey);
    if (this.onClick) $('#lobby-screen').removeEventListener('click', this.onClick);
    this.onKey = this.onClick = null;
  }
}
