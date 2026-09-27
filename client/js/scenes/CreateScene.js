// ============================================================
//  CreateScene – หน้าสร้างตัวละคร (ลงช่องที่เลือกจาก Lobby)
//  ▸ ตัวอย่างเป็นภาพแบบเดียวกับในเกม (top-down 8 ทิศ) หมุนดูรอบตัวได้ (ปุ่ม ⟲ ⟳ / ลากที่ตัวละคร)
//  ▸ ทุกคนเริ่มด้วยชุดลายขิดอีสาน · เลือกเพศ (การ์ดชาย/หญิง) + อาวุธเริ่มต้น · เปลี่ยนชุดภายหลังที่ร้านแม่ช้อย
// ============================================================
import { GENDERS, HAIRSTYLES, DEFAULT_APPEARANCE, START_OUTFIT } from '/shared/data/appearance.js';
import { JOBS } from '/shared/data/classes.js';
import { ITEMS } from '/shared/data/items.js';
import { newCharacter, saveCharacter } from '../systems/Character.js';
import { runAction } from '/shared/economy.js';
import { account } from '../net/Account.js';
import { sound } from '../systems/Sound.js';
import { titleScreen } from '../systems/TitleScreen.js';
import { loadSettings } from '../systems/Settings.js';
import { HeroView, loadHeroMeta, clearHeroViews } from '../systems/HeroPreview.js';

const $ = (s) => document.querySelector(s);
/** อาวุธเริ่มต้นให้เลือก (ได้ทั้งหมดในกระเป๋า เปลี่ยนถือได้ตลอด) */
const START_WEAPONS = [
  { id: null, icon: '🥊', job: 'boxer' },
  { id: 'wood_sword', icon: '⚔️', job: 'swordman' },
  { id: 'oak_staff', icon: '🔮', job: 'mage' },
  { id: 'bamboo_bow', icon: '🏹', job: 'archer' },
];
const NAMES = { male: ['ขุนแผน', 'ไอ้ขวัญ', 'นายขนมต้ม', 'พระไวย', 'ไอ้เสือ', 'ทองดี'], female: ['วันทอง', 'อีเรียม', 'แม่พลอย', 'บุษบา', 'สร้อยฟ้า', 'จันทร์เจ้า'] };

export class CreateScene extends Phaser.Scene {
  constructor() { super('create'); }

  async create(data = {}) {
    this.slot = Number.isInteger(data.slot) ? data.slot : 0;
    this.first = !!data.first;
    this.a = { ...DEFAULT_APPEARANCE };
    this.anim = 'idle';
    sound.applySettings(loadSettings());
    titleScreen.start();
    clearHeroViews();
    this.events.once('shutdown', () => this.teardown());
    await loadHeroMeta();
    if (!this.sys.isActive()) return;

    this.preview = new HeroView($('#cc-preview'), this, { scale: 4 });
    this.bindDom();
    this.buildGenders();
    this.refresh();
    setTimeout(() => $('#cc-name').focus(), 60);
  }

  bindDom() {
    const scr = $('#create-screen');
    scr.classList.remove('hidden');
    const online = account.loggedIn && !account.offline;
    $('#cc-title').textContent = online && (account.maxSlots || 1) > 1 ? `สร้างตัวละคร · ช่อง ${this.slot + 1}` : 'สร้างตัวละคร';
    // ตัวละครแรกของบัญชี: ไม่มีอะไรให้กลับไป → ซ่อนปุ่มกลับ (ออกจากระบบได้ที่หน้าเลือกตัวละคร)
    $('#cc-back').classList.toggle('hidden', this.first);
    $('#cc-start').disabled = false;
    $('#cc-name').value = '';

    $('#cc-genders').querySelectorAll('.cc-gcard').forEach((b) => (b.onclick = () => { if (this.a.gender === b.dataset.v) return; this.a.gender = b.dataset.v; this.anim = 'walk'; this.refresh(); }));

    $('#cc-jobs').innerHTML = START_WEAPONS.map((w, i) => `<button class="job" data-w="${i}"><b>${w.icon}</b>${w.id ? ITEMS[w.id].nameTh : 'มือเปล่า'}</button>`).join('');
    $('#cc-jobs').querySelectorAll('.job').forEach((b) => (b.onclick = () => { this.a.weapon = START_WEAPONS[b.dataset.w].id; this.anim = 'attack'; this.refresh(); }));

    document.querySelectorAll('#create-screen .preview-anims button').forEach((b) => (b.onclick = () => { this.anim = b.dataset.anim; this.refresh(); }));
    $('#cc-rot-l').onclick = () => { this.preview.turn(-1); };
    $('#cc-rot-r').onclick = () => { this.preview.turn(1); };

    // ลากที่ตัวละครเพื่อหมุน
    const cv = $('#cc-preview');
    let dragX = null;
    cv.onpointerdown = (e) => { dragX = e.clientX; cv.setPointerCapture(e.pointerId); };
    cv.onpointermove = (e) => {
      if (dragX === null) return;
      const step = cv.clientWidth / 10;
      while (e.clientX - dragX > step) { this.preview.turn(-1); dragX += step; }
      while (dragX - e.clientX > step) { this.preview.turn(1); dragX -= step; }
    };
    cv.onpointerup = cv.onpointercancel = () => { dragX = null; };

    $('#cc-name').onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') $('#cc-start').click(); };

    $('#cc-random').onclick = () => {
      const r = (n) => Math.floor(Math.random() * n);
      const gender = GENDERS[r(2)].id;
      this.a = { ...this.a, gender, outfit: START_OUTFIT, hair: r(HAIRSTYLES.length), weapon: START_WEAPONS[r(4)].id };
      if (!$('#cc-name').value.trim()) $('#cc-name').value = NAMES[gender][r(NAMES[gender].length)];
      this.refresh();
    };
    $('#cc-back').onclick = () => this.scene.start('lobby', { select: this.slot });

    $('#cc-start').onclick = async () => {
      const name = $('#cc-name').value.trim();
      if (!name) { $('#cc-name').focus(); $('#cc-name').classList.add('shake'); setTimeout(() => $('#cc-name').classList.remove('shake'), 500); sound.play('error'); return; }
      const btn = $('#cc-start');
      if (online) {                       // บัญชีออนไลน์: server สร้างให้ (กันแก้ค่าเริ่มต้น)
        btn.disabled = true;
        try {
          await account.createCharacter(this.slot, name, this.a, this.a.weapon || null);
          await account.refresh();
          return this.scene.start('lobby', { select: this.slot, created: true });
        } catch (e) { alert(e.message || 'สร้างตัวละครไม่สำเร็จ'); btn.disabled = false; return; }
      }
      const char = newCharacter(name, this.a);
      if (this.a.weapon) runAction(char, 'equip', { id: this.a.weapon });
      saveCharacter(char);
      this.scene.start('lobby', { select: 0, created: true });
    };

    this.onClick = (e) => { if (e.target.closest('button')) sound.play('click'); };
    scr.addEventListener('click', this.onClick);
  }

  /** การ์ดเลือกเพศ (ชุดลายขิดอีสาน) */
  buildGenders() {
    this.gviews = [...document.querySelectorAll('#cc-genders .cc-gcard')].map((b) =>
      new HeroView(b.querySelector('canvas'), this, { scale: 2, shadow: true }).set({ ...this.a, gender: b.dataset.v, outfit: START_OUTFIT, weapon: null }, 'idle', 'south'));
  }

  refresh() {
    const a = this.a;
    a.outfit = START_OUTFIT;
    document.querySelectorAll('#cc-genders .cc-gcard').forEach((b) => b.classList.toggle('active', b.dataset.v === a.gender));
    (this.gviews || []).forEach((v, i) => { const g = ['male', 'female'][i]; v.set({ ...a, gender: g, weapon: null }, g === a.gender ? 'walk' : 'idle', 'south'); v.spin = g === a.gender ? 800 : 0; });
    const wi = Math.max(0, START_WEAPONS.findIndex((w) => w.id === (a.weapon || null)));
    document.querySelectorAll('#cc-jobs .job').forEach((b) => b.classList.toggle('active', +b.dataset.w === wi));
    const job = JOBS[START_WEAPONS[wi].job];
    $('#cc-job-desc').textContent = `แนว${job.nameTh}: ${job.desc} · ทุกคนเริ่มเป็นชาวบ้าน ได้อาวุธฝึกครบทุกแบบ · อาชีพเกิดจากอาวุธที่ใช้ + ต้นไม้พรสวรรค์`;
    document.querySelectorAll('#create-screen .preview-anims button').forEach((b) => b.classList.toggle('active', b.dataset.anim === this.anim));
    this.preview.set({ ...a, job: START_WEAPONS[wi].job }, this.anim);
  }

  teardown() {
    clearHeroViews();
    this.gviews = [];
    $('#create-screen').classList.add('hidden');
    if (this.onClick) $('#create-screen').removeEventListener('click', this.onClick);
    this.onClick = null;
  }
}
