// ============================================================
//  RaidBoss – พญายักษ์ทมิฬ (ฝั่ง client)
//  ตำแหน่ง/HP/ท่าทางมาจาก server  ▸ ใส่ในกลุ่ม monsters เพื่อให้ระบบโจมตีเดิมใช้ได้ทันที
//  ดาเมจที่เราทำ → ส่ง raid:hit ให้ server หัก HP (ทุกคนเห็นค่าเดียวกัน)
// ============================================================
import { WORLD } from '/shared/constants.js';
import { RAID_BOSS as RB } from '/shared/data/raid.js';
import { makeText } from '../systems/util.js';

export class RaidBoss extends Phaser.Physics.Arcade.Sprite {
  constructor(scene) {
    const real = scene.textures.exists(`boss_${RB.id}`);
    const key = real ? `boss_${RB.id}` : 'mon_saming';               // ไม่มีภาพบอส → ใช้เสือสมิงขยายใหญ่แทน
    super(scene, RB.spawnX, WORLD.groundY, key, 'walk_0');
    this.key = key;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    if (!real) this.setScale(2.6).setTint(0x7dcea0);
    this.setOrigin(0.5, 1).setDepth(8);
    this.body.setAllowGravity(false).setImmovable(true);
    const fw = this.frame.width, fh = this.frame.height;
    this.body.setSize(Math.round(fw * 0.55), Math.round(fh * 0.8)).setOffset(Math.round(fw * 0.22), Math.round(fh * 0.2) - 1);
    this.isFlyer = true;               // ไม่ชนพื้น (server คุมตำแหน่ง)
    this.isBoss = true;

    this.hp = RB.maxHp;
    this.maxHp = RB.maxHp;
    this.serverX = RB.spawnX;
    this.state = 'dead';
    this.setVisible(false);
    this.body.enable = false;
    this.def = { level: RB.level, nameTh: `👹 ${RB.nameTh}`, hp: RB.maxHp, frame: { w: this.displayWidth, h: this.displayHeight } };

    this.aura = scene.add.ellipse(this.x, WORLD.groundY, 90, 10, 0x8e44ad, 0.35).setDepth(7).setVisible(false);
    this.label = makeText(scene, 0, 0, `Lv.${RB.level} ${RB.nameTh}`, { fontSize: '8px', color: '#ff8a80' }).setOrigin(0.5).setDepth(9).setVisible(false);
    this.playA('walk');
  }

  get alive() { return this.state !== 'dead'; }
  get defStats() { return { def: RB.def, eva: RB.eva }; }

  playA(name) {
    const k = `${this.key}:${name}`;
    if (this.scene.anims.exists(k)) this.play(k, true);
  }

  /** ข้อมูลจาก snapshot ของ server */
  setServer(b) {
    if (!b) return;
    this.maxHp = b.maxHp; this.def.hp = b.maxHp;
    this.serverX = b.x;
    this.respawnIn = b.respawnIn;
    this.respawnAt = performance.now() + (b.respawnIn || 0);
    if (b.alive && !this.alive) this.appear(b);
    else if (!b.alive && this.alive) this.defeated();
    if (b.alive) {
      // ใช้ค่า HP ที่ต่ำกว่าไว้ก่อน (ดาเมจของเราที่ยังไม่ถึง server จะไม่เด้งกลับ)
      this.hp = Math.min(this.hp, b.hp);
      if (b.hp > this.hp + b.maxHp * 0.02) this.hp = b.hp;       // บอสฟื้น HP (ไม่มีใครในลาน)
      this.setFlipX(b.dir < 0);
      if (b.anim === 'walk' && this.anims.currentAnim?.key !== `${this.key}:walk` && !this.anims.isPlaying) this.playA('walk');
    }
  }

  appear(b) {
    this.state = 'alive';
    this.hp = b.hp;
    this.x = b.x; this.serverX = b.x;
    this.setVisible(true).setAlpha(1).clearTint();
    if (this.key === 'mon_saming') this.setTint(0x7dcea0);
    this.body.enable = true;
    this.aura.setVisible(true);
    this.label.setVisible(true);
    this.playA('walk');
  }

  defeated() {
    this.state = 'dead';
    this.casting = false;
    this.hp = 0;
    this.body.enable = false;
    this.aura.setVisible(false);
    this.label.setVisible(false);
    this.playA('die');
    this.scene.tweens.add({ targets: this, alpha: 0, delay: 900, duration: 800, onComplete: () => this.setVisible(false) });
  }

  /** ท่าชาร์จสกิล (จาก raid:attack) – ค้างเฟรมสุดท้ายไว้จนกว่าดาเมจลง */
  windup(type) {
    if (!this.alive) return;
    this.off(Phaser.Animations.Events.ANIMATION_COMPLETE);
    const k = `${this.key}:w_${type}`;
    if (type && this.scene.anims.exists(k)) { this.play(k, true); this.casting = true; this.castUntil = this.scene.time.now + 2600; return; }
    this.playA('attack');
  }

  /** ท่าปล่อยสกิล (จาก raid:impact) */
  impact(type) {
    if (!this.alive) return;
    this.casting = false;
    const k = `${this.key}:x_${type}`;
    if (!this.scene.anims.exists(k)) return;
    this.play(k, true);
    this.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this.alive && this.playA('walk'));
  }

  update() {
    if (!this.alive) return;
    const step = (this.serverX - this.x) * 0.2;
    this.x += step;                                             // เลื่อนตาม server แบบนุ่มนวล
    // ท่ายืน/เดินตามการเคลื่อนที่จริง (ไม่ไถล)
    if (this.casting && this.scene.time.now > this.castUntil) this.casting = false;   // กันค้าง (ไม่ได้รับ impact)
    const ck = this.anims.currentAnim?.key || '';
    const attacking = this.casting || ((ck.endsWith(':attack') || ck.includes(':x_') || ck.includes(':w_')) && this.anims.isPlaying);
    if (!attacking) this.playA(Math.abs(step) > 0.15 ? 'walk' : 'idle');
    this.body.updateFromGameObject?.();
    const top = this.y - this.displayHeight;
    this.label.setPosition(this.x, top - 6);
    this.aura.setPosition(this.x, WORLD.groundY);
    this.aura.setScale(1 + Math.sin(this.scene.time.now / 300) * 0.08, 1);
  }

  /** โดนผู้เล่น (เรา) ตี → ส่งคำขอให้ server ทอยดาเมจ (ผลกลับทาง raid:dmg) */
  hitOnline(meta) {
    if (!this.alive || !this.scene.net?.online) return false;
    this.scene.net.send('raid:hit', { sk: meta.sk || null, combo: !!meta.combo });
    return true;
  }

  takeHit(result) {
    if (!this.alive) return;
    this.scene.combat.popup(this.x, this.y - this.displayHeight * 0.7, result);
    if (!result.hit) return;
    this.hp = Math.max(1, this.hp - result.dmg);
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => { if (!this.alive) return; this.clearTint(); if (this.key === 'mon_saming') this.setTint(0x7dcea0); });
    this.scene.ui?.setTarget(this);
  }

  /** บอสต้านทานการมึนงง (พิษ: server จัดการ) */
  applyEffect(effect) {
    if (!this.alive || !effect) return;
    if (effect.stun) this.scene.combat.popupText(this.x, this.y - this.displayHeight - 4, 'ต้านทาน!', '#bdc3c7', 7);
  }

  destroy(fromScene) { this.aura?.destroy(); this.label?.destroy(); super.destroy(fromScene); }
}
