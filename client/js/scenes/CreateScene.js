// ============================================================
//  CreateScene – หน้าสร้างตัวละคร
//  เลือกเพศ / ชุด 10 / สีผม 10 / ใบหน้า 10 / อาวุธเริ่มต้น + ดูตัวอย่าง Animation
//  ทุกคนเริ่มเป็น "ชาวบ้าน" แบบเดียวกัน · แนวต่อสู้มาจากอาวุธที่ถือ · เลือกสายหลักตอน Lv.10
// ============================================================
import { GENDERS, OUTFITS, HAIRSTYLES, FACES, DEFAULT_APPEARANCE, sanitizeAppearance } from '/shared/data/appearance.js';
import { JOBS, PATH_LV } from '/shared/data/classes.js';
import { ITEMS } from '/shared/data/items.js';
import { bakeCharacter } from '../gfx/SpriteFactory.js';
import { newCharacter, loadCharacter, saveCharacter, reviveCharacter, pathName } from '../systems/Character.js';
import * as Inv from '../systems/Inventory.js';
import { account } from '../net/Account.js';
import { sound } from '../systems/Sound.js';
import { loadSettings } from '../systems/Settings.js';

const $ = (s) => document.querySelector(s);
const PARTS = { outfit: OUTFITS, hair: HAIRSTYLES, face: FACES };
/** อาวุธเริ่มต้นให้เลือก (ได้ทั้ง 3 ชิ้นในกระเป๋า เปลี่ยนถือได้ตลอด) */
const START_WEAPONS = [
  { id: null, icon: '🥊', job: 'boxer' },
  { id: 'wood_sword', icon: '⚔️', job: 'swordman' },
  { id: 'oak_staff', icon: '🔮', job: 'mage' },
  { id: 'bamboo_bow', icon: '🏹', job: 'archer' },
];

export class CreateScene extends Phaser.Scene {
  constructor() { super('create'); }

  create(data = {}) {
    this.serverChar = reviveCharacter(data.character);
    this.a = { ...DEFAULT_APPEARANCE };
    this.previewAnim = 'idle';

    // ฉากหลัง
    this.add.image(480, 270, 'bg_sky').setScale(2);
    this.add.tileSprite(480, 330, 480, 140, 'bg_far').setScale(2);
    this.add.tileSprite(480, 420, 480, 120, 'bg_mid').setScale(2);
    this.add.ellipse(250, 438, 170, 26, 0x000000, 0.45);

    this.preview = this.add.sprite(250, 440, bakeCharacter(this, sanitizeAppearance(this.a)), 'idle_0').setOrigin(0.5, 1).setScale(5);

    this.bindDom();
    this.refresh();
    sound.applySettings(loadSettings());
    sound.music('town');
    // เสียงคลิกทุกปุ่มในหน้าสร้างตัวละคร
    $('#create-screen').addEventListener('click', (e) => { if (e.target.closest('button')) sound.play('click'); });
  }

  bindDom() {
    $('#create-screen').classList.remove('hidden');

    // เพศ
    $('#cc-gender').querySelectorAll('button').forEach((b) => (b.onclick = () => { this.a.gender = b.dataset.v; this.refresh(); }));

    // ชุด / ผม / หน้า  (◀ ▶)
    document.querySelectorAll('.picker').forEach((row) => {
      const part = row.dataset.part, n = PARTS[part].length;
      row.querySelector('.prev').onclick = () => { this.a[part] = (this.a[part] + n - 1) % n; this.refresh(); };
      row.querySelector('.next').onclick = () => { this.a[part] = (this.a[part] + 1) % n; this.refresh(); };
    });

    // อาวุธเริ่มต้น (= แนวต่อสู้ตอนเริ่ม)
    $('#cc-jobs').previousElementSibling.textContent = 'อาวุธเริ่มต้น (เปลี่ยนได้ตลอดในเกม)';
    $('#cc-jobs').innerHTML = START_WEAPONS.map((w, i) => `<button class="job" data-w="${i}"><b>${w.icon}</b>${w.id ? ITEMS[w.id].nameTh : 'มือเปล่า'}</button>`).join('');
    $('#cc-jobs').querySelectorAll('.job').forEach((b) => (b.onclick = () => { this.a.weapon = START_WEAPONS[b.dataset.w].id; this.refresh(); }));

    // ตัวอย่างท่าทาง
    document.querySelectorAll('.preview-anims button').forEach((b) => (b.onclick = () => { this.previewAnim = b.dataset.anim; this.refresh(); }));

    $('#cc-random').onclick = () => {
      const r = (n) => Math.floor(Math.random() * n);
      this.a = { gender: GENDERS[r(2)].id, outfit: r(10), hair: r(10), face: r(10), weapon: START_WEAPONS[r(4)].id };
      this.refresh();
    };

    $('#cc-start').onclick = () => {
      if (this.serverChar && !confirm(`บัญชีนี้มีตัวละคร “${this.serverChar.name}” (Lv.${this.serverChar.level}) อยู่แล้ว\nสร้างใหม่จะเขียนทับตัวเดิม ต้องการสร้างใหม่ไหม?`)) return;
      const char = newCharacter($('#cc-name').value, this.a);
      if (this.a.weapon) Inv.equip(char, this.a.weapon);
      saveCharacter(char);
      this.startGame(char);
    };

    // เล่นต่อ: ตัวละครบนบัญชี (server) ก่อน / ถ้าไม่มีแต่มีเซฟเก่าในเครื่อง → นำเข้าบัญชีนี้
    const btn = $('#cc-continue');
    const saved = this.serverChar || loadCharacter();
    if (saved) {
      btn.classList.remove('hidden');
      const from = this.serverChar ? '' : account.loggedIn ? ' · นำเข้าจากเซฟในเครื่อง' : '';
      btn.textContent = `เล่นต่อ: ${saved.name} (Lv.${saved.level} ${pathName(saved)})${from}`;
      btn.onclick = () => { saveCharacter(saved); this.startGame(saved); };
      if (this.serverChar) { btn.classList.add('primary'); }
    } else btn.classList.add('hidden');
    const acc = account.account;
    $('#cc-account').textContent = acc ? `บัญชี: ${acc.display}${acc.guest ? ' (Guest)' : ''}` : 'โหมดออฟไลน์ · เซฟในเครื่อง';
  }

  refresh() {
    const a = this.a;
    document.querySelectorAll('#cc-gender button').forEach((b) => b.classList.toggle('active', b.dataset.v === a.gender));
    document.querySelectorAll('.picker').forEach((row) => {
      const part = row.dataset.part;
      row.querySelector('.val').textContent = `${a[part] + 1}. ${PARTS[part][a[part]].nameTh}`;
    });
    const wi = Math.max(0, START_WEAPONS.findIndex((w) => w.id === (a.weapon || null)));
    document.querySelectorAll('#cc-jobs .job').forEach((b) => b.classList.toggle('active', +b.dataset.w === wi));
    const job = JOBS[START_WEAPONS[wi].job];
    $('#cc-job-desc').textContent = `แนว${job.nameTh}: ${job.desc} · ทุกคนเริ่มเป็นชาวบ้าน ได้อาวุธฝึกครบทุกแบบ ลองได้ทุกแนว แล้วเลือกสายหลักกับผู้ใหญ่ชัยตอน Lv.${PATH_LV}`;
    document.querySelectorAll('.preview-anims button').forEach((b) => b.classList.toggle('active', b.dataset.anim === this.previewAnim));

    // สร้าง spritesheet ตามรูปลักษณ์ใหม่ แล้วเล่นท่าที่เลือก
    // ภาพ PixelLab: ทรงผม/หน้าตามภาพต้นฉบับ → ซ่อนตัวเลือกใบหน้า
    const pixellab = this.textures.exists(`pbase_villager_${a.gender}`);
    document.querySelector('.picker[data-part="face"]').classList.toggle('hidden', pixellab);

    const key = bakeCharacter(this, sanitizeAppearance(a));
    this.preview.setTexture(key);
    const loopable = ['idle', 'walk'].includes(this.previewAnim);
    // ท่าที่ไม่วนซ้ำ (โจมตี/โดนตี/ตาย) ให้เล่นซ้ำโดยเว้นช่วง เพื่อดูตัวอย่าง
    this.preview.play({ key: `${key}:${this.previewAnim}`, repeat: -1, repeatDelay: loopable ? 0 : 600 });
  }

  startGame(char) {
    $('#create-screen').classList.add('hidden');
    this.scene.start('game', { char });
  }
}
