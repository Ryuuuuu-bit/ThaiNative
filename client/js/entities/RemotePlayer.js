// ============================================================
//  RemotePlayer – ผู้เล่นคนอื่นที่เห็นผ่านระบบออนไลน์
//  ใช้ "Snapshot Interpolation": เก็บตำแหน่งที่ได้จาก server ไว้ในบัฟเฟอร์
//  แล้วแสดงผลย้อนหลัง NET.interpDelay ms เพื่อให้เคลื่อนที่ลื่นแม้ network กระตุก
// ============================================================
import { Aura } from '../gfx/Aura.js';
import { NET } from '/shared/constants.js';
import { bakeCharacter } from '../gfx/SpriteFactory.js';
import { makeText } from '../systems/util.js';
import { TITLE_BY_ID } from '/shared/data/titles.js';

export class RemotePlayer extends Phaser.GameObjects.Sprite {
  constructor(scene, info) {
    const key = bakeCharacter(scene, info.appearance);
    super(scene, info.x, info.y, key, 'idle_0');
    this.netId = info.id;
    this.name = info.name;
    this.level = info.level;
    this.texKey = key;
    this.buffer = [];          // [{t, x, y, anim, flipX}]
    this.currentAnim = '';

    scene.add.existing(this);
    this.setOrigin(0.5, 1).setDepth(9).setAlpha(0.95);
    this.nameTag = makeText(scene, info.x, info.y - this.height + (this.texture.customData?.padTop || 0), info.name, { fontSize: '7px', color: '#aed6f1' }).setOrigin(0.5).setDepth(9);
    this.hpBar = scene.add.rectangle(info.x, info.y - 40, 18, 2, 0xe59866).setDepth(9);
    this.titleTag = makeText(scene, info.x, info.y - 50, '', { fontSize: '6px', color: '#f7dc6f' }).setOrigin(0.5).setDepth(9);
    this.aura = new Aura(scene, this);
    this.aura.setTier(info.appearance?.aura || 0);
    this.inst = info.inst || 0;
    this.setTitle(info.appearance);
    this.pushState(info);
    // คลิกที่ผู้เล่น → เมนูเชิญปาร์ตี้ / เทรด
    this.setInteractive({ useHandCursor: true, pixelPerfect: false });
    this.on('pointerdown', (pointer) => scene.social?.openPlayerMenu(this, pointer));
  }

  pushState(s) {
    // วาร์ป → ไม่ต้องเลื่อนผ่าน แสดงที่จุดใหม่ทันที
    if (s.wp !== undefined && s.wp !== this.wp) {
      if (this.wp !== undefined) { this.buffer.length = 0; this.setPosition(s.x, s.y); }
      this.wp = s.wp;
    }
    this.buffer.push({ t: performance.now(), x: s.x, y: s.y, anim: s.anim, flipX: s.flipX });
    if (this.buffer.length > 30) this.buffer.shift();
    if (s.maxHp) { this.hp = s.hp; this.maxHp = s.maxHp; this.hpBar.width = 18 * Phaser.Math.Clamp(s.hp / s.maxHp, 0, 1); }
    if (s.level) this.level = s.level;
    if ('party' in s) this.partyId = s.party;
    if ('inst' in s) this.inst = s.inst || 0;
  }

  setTitle(a) {
    const t = TITLE_BY_ID[a?.title];
    this.titleTag.setText(t ? `« ${t.nameTh} »` : '').setColor(t?.color || '#f7dc6f');
  }

  setAppearance(appearance) {
    this.setTitle(appearance);
    this.aura.setTier(appearance?.aura || 0);
    this.texKey = bakeCharacter(this.scene, appearance);
    this.setTexture(this.texKey, 'idle_0');
    this.currentAnim = '';
  }

  update() {
    // คนละห้องดันเจี้ยน (instance) → มองไม่เห็นกัน
    const vis = (this.inst || 0) === (this.scene.dungeon?.instId || 0);
    if (vis !== this.visible) { this.setVisible(vis); this.nameTag.setVisible(vis); this.hpBar.setVisible(vis); this.titleTag.setVisible(vis); this.aura.setVisible?.(vis); }
    this.aura.update(performance.now());
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
      const k = `${this.texKey}:${latest.anim}`;
      this.play(this.scene.anims.exists(k) ? k : `${this.texKey}:${latest.anim.startsWith('fish') || latest.anim === 'gather' ? 'idle' : 'attack'}`);
    }
    this.nameTag.setPosition(this.x, this.y - this.height + (this.texture.customData?.padTop || 0) + 2);
    this.titleTag.setPosition(this.x, this.y - this.height + (this.texture.customData?.padTop || 0) - 6);
    this.hpBar.setPosition(this.x, this.y - this.height + (this.texture.customData?.padTop || 0) + 7);
    // เพื่อนร่วมปาร์ตี้: ชื่อสีเขียว + แถบ HP สีเขียว
    const ally = !!this.partyId && this.partyId === this.scene.social?.party?.id;
    if (ally !== this.isAlly) {
      this.isAlly = ally;
      this.nameTag.setColor(ally ? '#82e0aa' : '#aed6f1');
      this.hpBar.fillColor = ally ? 0x58d68d : 0xe59866;
    }
  }

  /** เล่นท่าร่ายสกิล (ไม่รอ snapshot) */
  playCast(type) {
    if (type === 'buff') { this.setTintFill(0xf7dc6f); this.scene.time.delayedCall(120, () => this.clearTint()); return; }
    this.currentAnim = 'attack';
    this.play(`${this.texKey}:attack`, false);
  }

  destroy(fromScene) {
    this.nameTag?.destroy();
    this.titleTag?.destroy();
    this.hpBar?.destroy();
    this.aura?.destroy();
    super.destroy(fromScene);
  }
}
