// ============================================================
//  Monster – ผีไทย + AI พื้นฐาน
//  behavior: walker | flyer | jumper | ranged
//  state: patrol → chase → attack → hit → dead → (respawn)
// ============================================================
import { MONSTERS } from '/shared/data/monsters.js';
import { WORLD } from '/shared/constants.js';
import { mapAt } from '/shared/data/maps.js';
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
    // hitbox: ใช้ขนาดตัวจริงจากหุ่นตัดต่อ (เฟรมมีขอบเผื่อท่าทาง) ถ้ามี
    const bw = def.frame.bodyW || Math.round(w * 0.6), bh = Math.round((def.frame.bodyH || h) * 0.85);
    this.body.setSize(bw, bh).setOffset(Math.round((w - bw) / 2), h - 2 - bh - (def.frame.floatPad ? 4 : 0));
    this.setCollideWorldBounds(true);

    this.isFlyer = def.behavior === 'flyer';
    if (this.isFlyer) this.body.setAllowGravity(false);

    // หลอดเลือด + ชื่อ
    this.hpBg = scene.add.rectangle(0, 0, 20, 3, 0x000000, 0.7).setDepth(9);
    this.hpBar = scene.add.rectangle(0, 0, 20, 3, 0xe74c3c).setOrigin(0, 0.5).setDepth(9);
    this.label = makeText(scene, 0, 0, `Lv.${def.level} ${def.nameTh}`, { fontSize: '6px', color: '#f5b7b1' }).setOrigin(0.5).setDepth(9);

    this.on(EV.ANIMATION_UPDATE, (anim, frame) => {
      if (anim.key === `${this.key}:attack` && frame.index === (anim.frames.length >= 6 ? 4 : 2)) scene.combat.monsterStrike(this);
      // ฝุ่นตอนเท้าแตะพื้น (ผีที่เดินด้วยขา)
      if (anim.key === `${this.key}:walk` && !this.isFlyer && anim.frames.length >= 8 && (frame.index === 3 || frame.index === 7) && this.body.blocked.down) scene.combat.dust?.(this.x, this.y, 3);
    });
    this.on(EV.ANIMATION_COMPLETE, (anim) => {
      if (anim.key === `${this.key}:die`) { this.setVisible(false); this.showUi(false); return; }
      if (this.state === 'attack' || this.state === 'hit') this.state = 'chase';
    });

    this.reset(x);
  }

  get alive() { return this.state !== 'dead' && this.state !== 'dormant'; }

  /** ตัวคูณตามเวลา (กลางคืน/เดือนดับ) */
  get mods() {
    const m = this.scene.clock?.mods || { atk: 1, hp: 1, exp: 1, gold: 1 };
    // ผีกลางคืน (กระสือ ผีพราย โขมด โพง): กลางคืนดุและให้รางวัลเพิ่ม
    return this.def.nightBoost && this.scene.clock?.night ? { ...m, atk: m.atk * 1.15, exp: m.exp * 1.2, gold: m.gold * 1.2 } : m;
  }

  /** ผีที่ออกเฉพาะกลางคืน: กลางวันหายตัว กลางคืนปรากฏ */
  checkNightOnly() {
    if (!this.def.nightOnly || !this.scene.clock || this.state === 'dead') return;
    const night = this.scene.clock.night;
    if (!night && this.state !== 'dormant') {
      this.state = 'dormant';
      this.body.enable = false;
      this.showUi(false);
      this.scene.tweens.add({ targets: this, alpha: 0, duration: 1200, onComplete: () => this.state === 'dormant' && this.setVisible(false) });
    } else if (night && this.state === 'dormant') {
      this.reset(rand(this.def.zone[0], this.def.zone[1]));
      this.setAlpha(0);
      this.scene.tweens.add({ targets: this, alpha: 1, duration: 1200 });
    }
  }

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
    this.checkNightOnly();
    if (!this.alive) return;
    const d = this.def;
    const { h } = d.frame;
    this.hpBg.setPosition(this.x, this.y - h - 3);
    this.hpBar.setPosition(this.x - 10, this.y - h - 3).setSize(20 * (this.hp / d.hp), 3);
    this.label.setPosition(this.x, this.y - h - 9);

    // ติดสถานะมึนงง/ตรึง → ขยับไม่ได้
    if (time < (this.stunnedUntil || 0)) {
      this.setVelocity(0, this.isFlyer ? 0 : this.body.velocity.y);
      if (this.anims.isPlaying) this.anims.pause();
      return;
    } else if (this.anims.isPaused) { this.anims.resume(); this.clearTint(); }

    if (this.state === 'attack' || this.state === 'hit') {
      if (this.isFlyer) this.setVelocity(this.body.velocity.x * 0.9, this.body.velocity.y * 0.9);
      else this.setVelocityX(this.body.velocity.x * 0.9);
      return;
    }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    // ระยะห่างระหว่าง "ขอบ" hitbox (ไม่ใช่จุดกึ่งกลาง) → ตัวใหญ่/เล็กตีถึงเท่ากัน
    const gap = this.gapTo(player);
    const pm = mapAt(player.x);
    const aggro = player.alive && !pm.safe && player.x > (pm.safeEndX ?? 0) &&
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
    this.animateMove(vx);

    // การเคลื่อนที่แนวตั้งตามประเภท
    if (this.isFlyer) {
      const targetY = aggro ? player.y - 8 : this.homeY + Math.sin(time / 500 + this.x) * 8;
      this.setVelocityY(Phaser.Math.Clamp((targetY - this.y) * 2, -d.speed, d.speed));
    } else if (d.behavior === 'jumper' && this.body.blocked.down && time > this.nextJump && vx !== 0) {
      this.setVelocityY(-220);
      this.nextJump = time + rand(900, 1600);
    }
  }

  /** เลือกท่ายืน/เดิน + ความเร็วท่าเดินตามความเร็วจริง (เท้าไม่ไถลบนพื้น) */
  animateMove(vx) {
    const hasIdle = this.scene.anims.exists(`${this.key}:idle`);
    const speed = Math.abs(vx);
    if (speed < 4 && hasIdle) { this.play(`${this.key}:idle`, true); this.anims.timeScale = 1; return; }
    this.play(`${this.key}:walk`, true);
    this.anims.timeScale = Phaser.Math.Clamp(speed / Math.max(10, this.def.speed * 0.8), 0.45, 1.5);
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
    this.anims.timeScale = 1;
    this.play(`${this.key}:attack`);
  }

  /** สถานะผิดปกติจากสกิล */
  applyEffect(effect, dmg) {
    if (!this.alive || !effect) return;
    const s = this.scene;
    if (effect.stun) {
      this.stunnedUntil = Math.max(this.stunnedUntil || 0, s.time.now + effect.stun.ms);
      if (this.state === 'attack') this.state = 'chase';
      this.setTint(0x85c1e9);
      s.combat.popupText(this.x, this.y - this.def.frame.h - 6, 'มึนงง!', '#85c1e9', 7);
    }
    if (effect.poison) {
      const { ticks, every, ratio } = effect.poison;
      const per = Math.max(1, Math.round(dmg * ratio));
      this.poisonTimer?.remove();
      this.setTint(0x82e0aa);
      this.poisonTimer = s.time.addEvent({ delay: every, repeat: ticks - 1, callback: () => {
        if (!this.alive) return this.poisonTimer?.remove();
        this.hp -= per;
        s.combat.popupText(this.x, this.y - this.def.frame.h, `${per}`, '#58d68d', 7);
        if (this.hp <= 0) this.die();
        else if (this.poisonTimer.getRepeatCount() === 0) this.clearTint();
      } });
    }
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
    this.anims.timeScale = 1;
    this.play(`${this.key}:hit`);
  }

  die() {
    this.state = 'dead';
    this.hp = 0;
    this.body.enable = false;
    this.showUi(false);
    this.anims.timeScale = 1;
    this.play(`${this.key}:die`);
    this.scene.combat.onMonsterKilled(this);
    this.scene.time.delayedCall(RESPAWN_MS, () => this.reset(rand(this.def.zone[0], this.def.zone[1])));
  }

  /** ค่าสำหรับคำนวณความเสียหาย */
  get atkStats() { const a = Math.round(this.def.atk * this.mods.atk); return { patk: a, matk: a, accuracy: this.def.acc, critRate: 0.05, critDmg: 1.5 }; }
  get defStats() { return { def: this.def.def, eva: this.def.eva }; }
}
