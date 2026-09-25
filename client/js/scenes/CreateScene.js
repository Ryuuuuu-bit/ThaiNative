// ============================================================
//  CreateScene – หน้าสร้างตัวละคร
//  เลือกเพศ / ชุด 10 / ทรงผม 10 / ใบหน้า 10 / อาชีพ 4 + ดูตัวอย่าง Animation
// ============================================================
import { GENDERS, OUTFITS, HAIRSTYLES, FACES, DEFAULT_APPEARANCE } from '/shared/data/appearance.js';
import { JOBS, JOB_IDS } from '/shared/data/classes.js';
import { bakeCharacter } from '../gfx/SpriteFactory.js';
import { newCharacter, loadCharacter, saveCharacter } from '../systems/Character.js';
import { sound } from '../systems/Sound.js';

const $ = (s) => document.querySelector(s);
const PARTS = { outfit: OUTFITS, hair: HAIRSTYLES, face: FACES };
const JOB_ICON = { swordman: '⚔️', mage: '🔮', archer: '🏹', boxer: '🥊' };

export class CreateScene extends Phaser.Scene {
  constructor() { super('create'); }

  create() {
    this.a = { ...DEFAULT_APPEARANCE };
    this.previewAnim = 'idle';

    // ฉากหลัง
    this.add.image(480, 270, 'bg_sky').setScale(2);
    this.add.tileSprite(480, 330, 480, 140, 'bg_far').setScale(2);
    this.add.tileSprite(480, 420, 480, 120, 'bg_mid').setScale(2);
    this.add.ellipse(250, 438, 170, 26, 0x000000, 0.45);

    this.preview = this.add.sprite(250, 440, bakeCharacter(this, this.a), 'idle_0').setOrigin(0.5, 1).setScale(6);

    this.bindDom();
    this.refresh();
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

    // อาชีพ
    $('#cc-jobs').innerHTML = JOB_IDS.map((id) => `<button class="job" data-job="${id}"><b>${JOB_ICON[id]}</b>${JOBS[id].nameTh}</button>`).join('');
    $('#cc-jobs').querySelectorAll('.job').forEach((b) => (b.onclick = () => { this.a.job = b.dataset.job; this.refresh(); }));

    // ตัวอย่างท่าทาง
    document.querySelectorAll('.preview-anims button').forEach((b) => (b.onclick = () => { this.previewAnim = b.dataset.anim; this.refresh(); }));

    $('#cc-random').onclick = () => {
      const r = (n) => Math.floor(Math.random() * n);
      this.a = { gender: GENDERS[r(2)].id, outfit: r(10), hair: r(10), face: r(10), job: JOB_IDS[r(4)] };
      this.refresh();
    };

    $('#cc-start').onclick = () => {
      const char = newCharacter($('#cc-name').value, this.a);
      saveCharacter(char);
      this.startGame(char);
    };

    const saved = loadCharacter();
    if (saved) {
      const btn = $('#cc-continue');
      btn.classList.remove('hidden');
      btn.textContent = `เล่นต่อ: ${saved.name} (Lv.${saved.level} ${JOBS[saved.appearance.job].nameTh})`;
      btn.onclick = () => this.startGame(saved);
    }
  }

  refresh() {
    const a = this.a;
    document.querySelectorAll('#cc-gender button').forEach((b) => b.classList.toggle('active', b.dataset.v === a.gender));
    document.querySelectorAll('.picker').forEach((row) => {
      const part = row.dataset.part;
      row.querySelector('.val').textContent = `${a[part] + 1}. ${PARTS[part][a[part]].nameTh}`;
    });
    document.querySelectorAll('#cc-jobs .job').forEach((b) => b.classList.toggle('active', b.dataset.job === a.job));
    const job = JOBS[a.job];
    const s = job.startStats;
    $('#cc-job-desc').textContent = `${job.desc} · STR ${s.STR} DEX ${s.DEX} INT ${s.INT} CRI ${s.CRI} VIT ${s.VIT}`;
    document.querySelectorAll('.preview-anims button').forEach((b) => b.classList.toggle('active', b.dataset.anim === this.previewAnim));

    // สร้าง spritesheet ตามรูปลักษณ์ใหม่ แล้วเล่นท่าที่เลือก
    const key = bakeCharacter(this, a);
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
