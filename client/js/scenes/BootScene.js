// ============================================================
//  BootScene – โหลดภาพจริง (เช่นจาก PixelLab) ตาม assets/manifest.json
//  ภาพไหนไม่มีไฟล์ → สร้างด้วยโค้ดแทนอัตโนมัติ (SpriteFactory)
// ============================================================
import { generateAll, bakeRigMonster } from '../gfx/SpriteFactory.js';
import { MONSTER_RIG, tintedCopy, fitHeight } from '../gfx/Rig.js';
import { MONSTERS } from '/shared/data/monsters.js';
import { ICONS } from '../systems/util.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }

  preload() {
    this.load.json('manifest', 'assets/manifest.json');
  }

  create() {
    const manifest = this.cache.json.get('manifest') || {};
    const bases = manifest.monsterBases || {};
    Object.assign(ICONS, manifest.icons || {});
    const entries = [
      // ผี/บอสที่มีภาพต้นฉบับ → ใช้หุ่นตัดต่อ (Rig) แทน spritesheet เก่า
      ...Object.entries(manifest.monsters || {}).filter(([id]) => !bases[id]).map(([id, e]) => ({ ...e, key: `mon_${id}`, monsterId: id })),
      ...Object.entries(manifest.npc || {}).filter(([key]) => !bases[key]).map(([key, e]) => ({ ...e, key })),
      ...Object.entries(manifest.bosses || {}).filter(([id]) => !bases[id]).map(([id, e]) => ({ ...e, key: `boss_${id}` })),
    ];
    Object.entries(bases).forEach(([id, file]) => this.load.image(`mbase_${id}`, file));
    entries.forEach((e) => this.load.spritesheet(e.key, e.file, { frameWidth: e.frameWidth, frameHeight: e.frameHeight }));
    // ภาพต้นฉบับตัวละครผู้เล่น (ย้อมสี + สร้างท่าทางตอนสร้างตัวละคร)
    // ฉากเมือง: บ้านเรือนไทย วัด ศาลา แผงตลาด ฉากหลัง
    Object.entries(manifest.env || {}).forEach(([k, file]) => this.load.image(k, file));
    Object.entries(manifest.icons || {}).filter(([k]) => /^it_(pla_|kung|junk|herb_)/.test(k)).forEach(([k, file]) => this.load.image(`ico_${k}`, file));
    Object.entries(manifest.players || {}).forEach(([k, file]) => this.load.image(`pbase_${k}`, file));

    this.load.once('complete', () => {
      entries.forEach((e) => this.registerSheet(e));
      const bake = (id, img) => {
        const key = MONSTERS[id] ? `mon_${id}` : id.startsWith('npc_') ? id : `boss_${id}`;
        const info = bakeRigMonster(this, key, fitHeight(img, MONSTER_RIG[id]?.h), MONSTER_RIG[id]);
        if (MONSTERS[id]) MONSTERS[id].frame = { w: info.fw, h: info.fh, bodyW: info.bodyW, bodyH: info.bodyH, floatPad: info.floatPad };
      };
      for (const id of Object.keys(bases)) {
        if (this.textures.exists(`mbase_${id}`) && MONSTER_RIG[id]) bake(id, this.textures.get(`mbase_${id}`).getSourceImage());
      }
      // ผีที่ยังไม่มีภาพจริง → ใช้ภาพตัวแทน (ย้อมสีจากผีตัวอื่น)
      for (const id of Object.keys(MONSTERS)) {
        const fb = MONSTER_RIG[id]?.fallback;
        if (bases[id] || !fb || !this.textures.exists(`mbase_${fb.from}`)) continue;
        bake(id, tintedCopy(this.textures.get(`mbase_${fb.from}`).getSourceImage(), fb.tint, fb.scale));
      }
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
