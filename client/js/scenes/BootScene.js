// ============================================================
//  BootScene – โหลดภาพจริง (เช่นจาก PixelLab) ตาม assets/manifest.json
//  ภาพไหนไม่มีไฟล์ → สร้างด้วยโค้ดแทนอัตโนมัติ (SpriteFactory)
// ============================================================
import { generateAll } from '../gfx/SpriteFactory.js';
import { MONSTERS } from '/shared/data/monsters.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }

  preload() {
    this.load.json('manifest', 'assets/manifest.json');
  }

  create() {
    const manifest = this.cache.json.get('manifest') || {};
    const entries = [
      ...Object.entries(manifest.monsters || {}).map(([id, e]) => ({ ...e, key: `mon_${id}`, monsterId: id })),
      ...Object.entries(manifest.npc || {}).map(([key, e]) => ({ ...e, key })),
      ...Object.entries(manifest.bosses || {}).map(([id, e]) => ({ ...e, key: `boss_${id}` })),
    ];
    entries.forEach((e) => this.load.spritesheet(e.key, e.file, { frameWidth: e.frameWidth, frameHeight: e.frameHeight }));
    // ภาพต้นฉบับตัวละครผู้เล่น (ย้อมสี + สร้างท่าทางตอนสร้างตัวละคร)
    // ฉากเมือง: บ้านเรือนไทย วัด ศาลา แผงตลาด ฉากหลัง
    Object.entries(manifest.env || {}).forEach(([k, file]) => this.load.image(k, file));
    Object.entries(manifest.players || {}).forEach(([k, file]) => this.load.image(`pbase_${k}`, file));

    this.load.once('complete', () => {
      entries.forEach((e) => this.registerSheet(e));
      generateAll(this);           // สร้างเฉพาะภาพที่ยังไม่มี
      this.goNext();
    });
    this.load.start();             // ถ้าไม่มีอะไรให้โหลด จะ complete ทันที
  }

  /**
   * ลงทะเบียน spritesheet ภายนอกให้ใช้ชื่อเฟรม/animation แบบเดียวกับภาพที่สร้างด้วยโค้ด
   * เฟรมเรียงแถวเดียวตามลำดับท่าใน anims เช่น { walk: 4, attack: 3, hit: 1, die: 4 }
   */
  registerSheet(e) {
    if (!this.textures.exists(e.key)) return;
    const tex = this.textures.get(e.key);
    let i = 0;
    for (const [anim, n] of Object.entries(e.anims)) {
      const frames = [];
      for (let k = 0; k < n; k++, i++) {
        tex.add(`${anim}_${k}`, 0, i * e.frameWidth, 0, e.frameWidth, e.frameHeight);
        frames.push({ key: e.key, frame: `${anim}_${k}` });
      }
      const loop = anim === 'walk' || anim === 'idle';
      this.anims.create({ key: `${e.key}:${anim}`, frames, frameRate: e.rates?.[anim] ?? (loop ? 6 : 8), repeat: loop ? -1 : 0 });
    }
    if (e.monsterId) MONSTERS[e.monsterId].frame = { w: e.frameWidth, h: e.frameHeight };
  }

  goNext() {
    // รอฟอนต์ไทยโหลดก่อน เพื่อให้ข้อความในเกมใช้ฟอนต์ Mitr
    const go = () => this.scene.start('create');
    if (document.fonts?.load) Promise.race([document.fonts.load('10px Mitr'), new Promise((r) => setTimeout(r, 1500))]).then(go);
    else go();
  }
}
