// ============================================================
//  Monster – ผีไทย + AI พื้นฐาน
//  behavior: walker | flyer | jumper | ranged
//  state: patrol → chase → attack → hit → dead → (respawn)
// ============================================================
import { MONSTERS } from '/shared/data/monsters.js';
import { WORLD } from '/shared/constants.js';
import { makeText, rand } from '../systems/util.js';

const EV = Phaser.Animations.Events;
const AGGRO_X = 170, AGGRO_Y = 90, RESPAWN_MS = 9000;

export class Monster extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, id) {
    const def = MONSTERS[id];
    const x = rand(def.zone[0], def.zone[1]);
    super(scene, x, WORLD.groundY - 40, `mon_${id}`, 'walk_0');
    this.id = id;
    this.def = def;
    this.key = `mon_${id}`;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 1).setDepth(8);
    const { w, h } = def.frame;
    this.body.setSize(Math.round(w * 0.6), Math.round(h * 0.85)).setOffset(Math.round(w * 0.2), Math.round(h * 0.15));
    this.setCollideWorldBounds(true);

    this.isFlyer = def.behavior === 'flyer';
    if (this.isFlyer) this.body.setAllowGravity(false);

    // หลอดเลือด + ชื่อ
    this.hpBg = scene.add.rectangle(0, 0, 20, 3, 0x000000, 0.7).setDepth(9);
    this.hpBar = scene.add.rectangle(0, 0, 20, 3, 0xe74c3c).setOrigin(0, 0.5).setDepth(9);
    this.label = makeText(scene, 0, 0, `Lv.${def.level} ${def.nameTh}`, { fontSize: '6px', color: '#f5b7b1' }).setOrigin(0.5).setDepth(9);

    this.on(EV.ANIMATION_UPDATE, (anim, frame) => {
      if (anim.key === `${this.key}:attack` && frame.index === 2) scene.combat.monsterStrike(this);
    });
    this.on(EV.ANIMATION_COMPLETE, (anim) => {
      if (anim.key === `${this.key}:die`) { this.setVisible(false); this.showUi(false); return; }
      if (this.state === 'attack' || this.state === 'hit') this.state = 'chase';
    });

    this.reset(x);
  }

  get alive() { return this.state !== 'dead'; }

  reset(x) {
    const d = this.def;
    this.hp = d.hp;
    this.state = 'patrol';
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.nextTurn = 0;
    this.lastAttack = 0;
    this.nextJump = 0;
    this.homeY = WORLD.groundY - 30 - rand(0, 30);
    this.setPosition(x, this.isFlyer ? this.homeY : WORLD.groundY - 5);
    this.setVisible(true).setAlpha(1).clearTint();
    this.body.enable = true;
    this.showUi(true);
    this.play(`${this.key}:walk`);
  }

  showUi(v) { this.hpBg.setVisible(v); this.hpBar.setVisible(v); this.label.setVisible(v); }

  update(time, player) {
    if (!this.alive) return;
    const d = this.def;
    const { h } = d.frame;
    this.hpBg.setPosition(this.x, this.y - h - 3);
    this.hpBar.setPosition(this.x - 10, this.y - h - 3).setSize(20 * (this.hp / d.hp), 3);
    this.label.setPosition(this.x, this.y - h - 9);

    if (this.state === 'attack' || this.state === 'hit') {
      if (this.isFlyer) this.setVelocity(this.body.velocity.x * 0.9, this.body.velocity.y * 0.9);
      else this.setVelocityX(this.body.velocity.x * 0.9);
      return;
    }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    // ระยะห่างระหว่าง "ขอบ" hitbox (ไม่ใช่จุดกึ่งกลาง) → ตัวใหญ่/เล็กตีถึงเท่ากัน
    const gap = this.gapTo(player);
    const aggro = player.alive && player.x > WORLD.townEndX &&
      Math.abs(dx) < AGGRO_X && Math.abs(dy) < AGGRO_Y;
    this.state = aggro ? 'chase' : 'patrol';

    let vx = 0;
    if (aggro) {
      const face = Math.sign(dx) || 1;
      const dist = Math.abs(dx);
      if (d.behavior === 'ranged') {
        if (dist < d.attackRange * 0.45) vx = -face * d.speed;         // ถอยหนี
        else if (dist > d.attackRange) vx = face * d.speed;            // เดินเข้าหา
        this.setFlipX(face < 0);
        if (dist <= d.attackRange && Math.abs(dy) < 60) this.tryAttack(time);
      } else {
        if (gap > this.reach * 0.5) vx = face * d.speed;
        this.setFlipX(face < 0);
        if (gap <= this.reach && this.verticalOverlap(player, 6)) this.tryAttack(time);
      }
    } else {
      // เดินเตร็ดเตร่ในเขตของตัวเอง
      if (time > this.nextTurn) { this.dir = Math.random() < 0.3 ? 0 : (Math.random() < 0.5 ? -1 : 1); this.nextTurn = time + rand(1500, 3500); }
      if (this.x < d.zone[0]) this.dir = 1;
      if (this.x > d.zone[1]) this.dir = -1;
      vx = this.dir * d.speed * 0.45;
      if (vx) this.setFlipX(vx < 0);
    }
    if (this.state === 'attack') return;
    this.setVelocityX(vx);

    // การเคลื่อนที่แนวตั้งตามประเภท
    if (this.isFlyer) {
      const targetY = aggro ? player.y - 8 : this.homeY + Math.sin(time / 500 + this.x) * 8;
      this.setVelocityY(Phaser.Math.Clamp((targetY - this.y) * 2, -d.speed, d.speed));
    } else if (d.behavior === 'jumper' && this.body.blocked.down && time > this.nextJump && vx !== 0) {
      this.setVelocityY(-220);
      this.nextJump = time + rand(900, 1600);
    }
  }

  /** ระยะตีประชิด (ช่องว่างระหว่างขอบ hitbox) */
  get reach() { return Math.round(this.def.attackRange * 0.6); }

  gapTo(target) {
    const a = this.body, b = target.body;
    return Math.max(0, Math.abs(target.x - this.x) - (a.halfWidth + b.halfWidth));
  }

  verticalOverlap(target, tol = 0) {
    const a = this.body, b = target.body;
    return a.bottom + tol >= b.top && b.bottom + tol >= a.top;
  }

  tryAttack(time) {
    if (time - this.lastAttack < this.def.attackCooldown) return;
    this.lastAttack = time;
    this.state = 'attack';
    this.setVelocityX(0);
    this.play(`${this.key}:attack`);
  }

  /** โดนผู้เล่นตี */
  takeHit(result, dir, knock = 70) {
    if (!this.alive) return;
    this.scene.combat.popup(this.x, this.y - this.def.frame.h, result);
    if (!result.hit) return;
    this.hp -= result.dmg;
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => this.alive && this.clearTint());
    if (this.hp <= 0) return this.die();
    this.scene.ui?.setTarget(this);
    // มอนสเตอร์ Lv.8+ มี "เกราะ" ไม่สะดุ้งเวลาโดนตี (ไม่ถูกขัดจังหวะโจมตี)
    if (this.def.level >= 8) { this.setVelocityX(dir * knock * 0.2); return; }
    this.state = 'hit';
    this.setVelocityX(dir * knock);
    this.play(`${this.key}:hit`);
  }

  die() {
    this.state = 'dead';
    this.hp = 0;
    this.body.enable = false;
    this.showUi(false);
    this.play(`${this.key}:die`);
    this.scene.combat.onMonsterKilled(this);
    this.scene.time.delayedCall(RESPAWN_MS, () => this.reset(rand(this.def.zone[0], this.def.zone[1])));
  }

  /** ค่าสำหรับคำนวณความเสียหาย */
  get atkStats() { return { patk: this.def.atk, matk: this.def.atk, accuracy: this.def.acc, critRate: 0.05, critDmg: 1.5 }; }
  get defStats() { return { def: this.def.def, eva: this.def.eva }; }
}
