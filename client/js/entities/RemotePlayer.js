// ============================================================
//  RemotePlayer – ผู้เล่นคนอื่นที่เห็นผ่านระบบออนไลน์
//  ใช้ "Snapshot Interpolation": เก็บตำแหน่งที่ได้จาก server ไว้ในบัฟเฟอร์
//  แล้วแสดงผลย้อนหลัง NET.interpDelay ms เพื่อให้เคลื่อนที่ลื่นแม้ network กระตุก
// ============================================================
import { NET } from '/shared/constants.js';
import { bakeCharacter } from '../gfx/SpriteFactory.js';
import { makeText } from '../systems/util.js';

export class RemotePlayer extends Phaser.GameObjects.Sprite {
  constructor(scene, info) {
    const key = bakeCharacter(scene, info.appearance);
    super(scene, info.x, info.y, key, 'idle_0');
    this.netId = info.id;
    this.texKey = key;
    this.buffer = [];          // [{t, x, y, anim, flipX}]
    this.currentAnim = '';

    scene.add.existing(this);
    this.setOrigin(0.5, 1).setDepth(9).setAlpha(0.95);
    this.nameTag = makeText(scene, info.x, info.y - this.height, info.name, { fontSize: '7px', color: '#aed6f1' }).setOrigin(0.5).setDepth(9);
    this.hpBar = scene.add.rectangle(info.x, info.y - 40, 18, 2, 0x58d68d).setDepth(9);
    this.pushState(info);
  }

  pushState(s) {
    this.buffer.push({ t: performance.now(), x: s.x, y: s.y, anim: s.anim, flipX: s.flipX });
    if (this.buffer.length > 30) this.buffer.shift();
    if (s.maxHp) this.hpBar.width = 18 * Phaser.Math.Clamp(s.hp / s.maxHp, 0, 1);
    if (s.level) this.level = s.level;
  }

  setAppearance(appearance) {
    this.texKey = bakeCharacter(this.scene, appearance);
    this.setTexture(this.texKey, 'idle_0');
    this.currentAnim = '';
  }

  update() {
    const renderT = performance.now() - NET.interpDelay;
    const b = this.buffer;
    if (!b.length) return;

    // หา 2 state ที่คร่อมเวลา renderT แล้ว lerp ระหว่างกัน
    let a = b[0], c = b[b.length - 1];
    for (let i = 0; i < b.length - 1; i++) {
      if (b[i].t <= renderT && b[i + 1].t >= renderT) { a = b[i]; c = b[i + 1]; break; }
    }
    const span = c.t - a.t;
    const k = span > 0 ? Phaser.Math.Clamp((renderT - a.t) / span, 0, 1) : 1;
    this.x = Phaser.Math.Linear(a.x, c.x, k);
    this.y = Phaser.Math.Linear(a.y, c.y, k);

    const latest = k < 1 ? a : c;
    this.setFlipX(latest.flipX);
    if (latest.anim !== this.currentAnim) {
      this.currentAnim = latest.anim;
      this.play(`${this.texKey}:${latest.anim}`);
    }
    this.nameTag.setPosition(this.x, this.y - this.height + 2);
    this.hpBar.setPosition(this.x, this.y - this.height + 7);
  }

  destroy(fromScene) {
    this.nameTag?.destroy();
    this.hpBar?.destroy();
    super.destroy(fromScene);
  }
}
