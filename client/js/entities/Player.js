// ============================================================
//  Player – ตัวละครผู้เล่น
//  ▸ ระบบควบคุมการเคลื่อนไหว (เดิน / กระโดด / โจมตี)
//  ▸ State machine ของ Animation: idle → walk → jump → attack → hit → dead
// ============================================================
import { Aura } from '../gfx/Aura.js';
import { WORLD } from '/shared/constants.js';
import { JOBS } from '/shared/data/classes.js';
import { bakeCharacter } from '../gfx/SpriteFactory.js';
import { getDerived } from '../systems/Character.js';
import { makeText } from '../systems/util.js';
import { STRIKE_FRAME, STRIKE_ANIMS, skillAnim } from '../gfx/PlayerArt.js';
import { combineBlessings } from '/shared/data/blessings.js';
import { SKILL_BY_ID, skillStats } from '/shared/data/skills.js';
import { TITLE_BY_ID } from '/shared/data/titles.js';
import { sanitizeAppearance } from '/shared/data/appearance.js';

const EV = Phaser.Animations.Events;

export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, char) {
    const key = bakeCharacter(scene, char.appearance);
    super(scene, x, y, key, 'idle_0');
    this.char = char;          // ข้อมูลตัวละคร (stats, inventory ...)
    this.texKey = key;

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 1);
    this.fitBody();
    this.setCollideWorldBounds(true);
    this.setDepth(10);

    this.state = 'idle';
    this.facing = 1;           // 1 = ขวา, -1 = ซ้าย
    this.lastAttack = 0;
    this.combo = 0;
    this.invulnUntil = 0;
    this.pendingSkill = null;  // สกิลที่กำลังร่าย (null = โจมตีปกติ)
    this.cooldowns = {};       // { Q: readyAtTime, ... }
    this.buffs = [];           // [{ buff:{atkMul,critAdd,def}, until }]
    this.dashing = false;

    this.nameTag = makeText(scene, x, y - this.height - 2, char.name, { fontSize: '7px', color: '#f3d98b' }).setOrigin(0.5).setDepth(11);
    this.titleTag = makeText(scene, x, y - this.height - 10, '', { fontSize: '6px', color: '#f7dc6f' }).setOrigin(0.5).setDepth(11);
    this.refreshTitle();
    this.aura = new Aura(scene, this);                   // ออร่าตีบวก
    this.aura.setTier(char.appearance.aura || 0);

    // เมื่อจบท่าโจมตี/โดนตี → กลับสู่สถานะปกติ
    this.on(EV.ANIMATION_COMPLETE, (anim) => {
      if (this.state === 'attack' || this.state === 'hit') this.state = 'idle';
    });
    // เฟรมที่ "ดาบ/หมัด โดนเป้า" หรือ "ปล่อยกระสุน" (เฟรมที่ 3 ของท่าโจมตี)
    this.on(EV.ANIMATION_UPDATE, (anim, frame) => {
      // ฝุ่นตอนเท้าแตะพื้น (เฟรม 4 และ 8 ของวงจรเดิน)
      if (anim.key.endsWith(':walk') && (frame.index === 4 || frame.index === 8) && this.body.blocked.down) scene.combat?.dust(this.x - this.facing * 3, this.y, 3);
      if (STRIKE_ANIMS.has(anim.key.split(':').pop()) && frame.index === (STRIKE_FRAME[anim.frames.length] || 3)) {
        scene.combat.playerStrike(this, this.pendingSkill);
        this.pendingSkill = null;
      }
    });
    this.playAnim('idle');
  }

  /** hitbox กว้าง 14 สูง ~80% ของตัว ชิดเท้า – คำนวณจากขนาดเฟรม (รองรับภาพทุกขนาด) */
  fitBody() {
    const fw = this.frame.width, fh = this.frame.height - this.padTop;
    const h = Math.round(fh * 0.72), w = 14;
    this.body.setSize(w, h).setOffset(Math.round((fw - w) / 2), fh - h - 1);
  }

  get job() { return JOBS[this.char.appearance.job]; }
  /** ที่ว่างด้านบนเฟรม (ภาพ PixelLab เว้นไว้ให้ท่ากระโดด/ชูแขน) */
  get padTop() { return this.texture?.customData?.padTop || 0; }
  get derived() { return getDerived(this.char); }

  /** ค่าสถานะรวมบัฟ (ใช้ตอนคำนวณดาเมจ) */
  /** พรยาวจากเซียมซี/ศาลพระภูมิ (เก็บในเซฟ นับเวลาจริง) */
  blessingMods() {
    const now = Date.now();
    this.char.blessings = (this.char.blessings || []).filter((b) => b.until > now);
    return combineBlessings(this.char.blessings, now);
  }

  combatStats(time = this.scene.time.now) {
    this.buffs = this.buffs.filter((b) => b.until > time);
    const d = { ...this.derived };
    const bl = this.blessingMods();
    if (bl.atkMul) { d.patk = Math.round(d.patk * (1 + bl.atkMul)); d.matk = Math.round(d.matk * (1 + bl.atkMul)); }
    d.def = Math.max(0, d.def + bl.def);
    d.critRate = Math.min(0.9, d.critRate + bl.critAdd);
    for (const { buff } of this.buffs) {
      if (buff.atkMul) { d.patk = Math.round(d.patk * (1 + buff.atkMul)); d.matk = Math.round(d.matk * (1 + buff.atkMul)); }
      if (buff.critAdd) d.critRate = Math.min(0.9, d.critRate + buff.critAdd);
      if (buff.def) d.def += buff.def;
    }
    return d;
  }
  get alive() { return this.state !== 'dead'; }

  /** เล่น animation ตามชื่อท่า (ไม่เริ่มใหม่ถ้ากำลังเล่นท่าเดิมอยู่) */
  playAnim(name, restart = false) {
    if (!this.scene.anims.exists(`${this.texKey}:${name}`)) name = name.startsWith('fish') ? 'idle' : 'attack';   // ภาพแบบเก่าไม่มีท่าใหม่
    this.animName = name;
    this.play(`${this.texKey}:${name}`, !restart);
  }

  /**
   * เรียกทุกเฟรมจาก GameScene
   * @param {number} time
   * @param {{left:boolean,right:boolean,jump:boolean,attack:boolean,skill:string|null}} input
   *   ← → เดิน | ↑ กระโดด | Space โจมตีปกติ | Q W E R สกิล
   */
  /** ฉายาเหนือชื่อ */
  refreshTitle() {
    const t = TITLE_BY_ID[this.char.appearance?.title];
    this.titleTag.setText(t ? `« ${t.nameTh} »` : '').setColor(t?.color || '#f7dc6f');
  }

  update(time, input) {
    this.nameTag.setPosition(this.x, this.y - this.height + this.padTop + 2);
    this.titleTag.setPosition(this.x, this.y - this.height + this.padTop - 6);
    this.aura.update(time);
    if (this.state === 'dead' || this.dashing) return;

    const onFloor = this.body.blocked.down || this.body.touching.down;
    const locked = this.state === 'attack' || this.state === 'hit';
    const speed = WORLD.maxSpeed;

    // ---------- การเคลื่อนที่แนวนอน ----------
    let vx = 0;
    if (!locked) {
      if (input.left) vx = -speed;
      else if (input.right) vx = speed;
    } else if (!onFloor) {
      vx = this.body.velocity.x * 0.98;   // ตีกลางอากาศ: คงโมเมนตัม
    }
    this.setVelocityX(vx);
    if (vx !== 0 && !locked) {
      this.facing = Math.sign(vx);
      this.setFlipX(this.facing < 0);
    }

    // ---------- กระโดด ----------
    if (!locked && input.jump && onFloor) this.setVelocityY(WORLD.jumpVelocity);

    // ---------- โจมตี (กดค้างเพื่อตีต่อเนื่องได้) ----------
    // จำปุ่มสกิลไว้ 0.5 วิ ถ้ากดตอนกำลังตี/โดนตี จะร่ายทันทีที่ว่าง
    if (input.skill) this.queued = { key: input.skill, until: time + 500 };
    if (!locked && this.queued && time < this.queued.until) { const k = this.queued.key; this.queued = null; this.trySkill(time, k); }
    else if (!locked && input.attack) this.tryAttack(time);

    // ---------- ตกปลา: ท่าเหวี่ยงเบ็ด / ถือเบ็ด / ดึงเบ็ด ----------
    const f = this.scene.village?.fish;
    if (f && this.state !== 'hit') {
      this.state = 'fish';
      this.playAnim(this.scene.time.now - f.t0 < 520 ? 'fish_cast' : f.stage === 'wait' ? 'fish_idle' : 'fish_reel');
    } else if ((this.scene.forest?.gather || this.scene.time.now < (this.scene.forest?.animUntil || 0)) && this.state !== 'hit') {         // เก็บสมุนไพร: ย่อตัวลงเก็บ
      this.state = 'fish';
      this.playAnim('gather');
    } else if (this.state === 'fish') this.state = 'idle';

    // ---------- เลือก Animation ตามสถานะ ----------
    if (this.state !== 'attack' && this.state !== 'hit' && this.state !== 'fish') {
      this.state = !onFloor ? 'jump' : vx !== 0 ? 'walk' : 'idle';
      this.playAnim(this.state);
    }

    // กะพริบระหว่างอมตะหลังโดนตี
    this.setAlpha(time < this.invulnUntil ? (Math.floor(time / 80) % 2 ? 0.5 : 1) : 1);
  }

  tryAttack(time) {
    const atk = this.job.attack;
    if (time - this.lastAttack < atk.cooldown) return;
    if (atk.mpCost && this.char.mp < atk.mpCost) {
      this.scene.ui.toast('MP ไม่พอ!', 'warn');
      this.lastAttack = time;
      return;
    }
    this.char.mp -= atk.mpCost;
    this.lastAttack = time;
    this.combo++;
    this.pendingSkill = null;
    this.state = 'attack';
    this.playAnim('attack', true);
    this.scene.sfx.play(this.job.attack.style === 'melee' ? (this.job.weapon === 'wraps' ? 'swingLight' : 'swing') : this.job.attack.projectile);
  }

  /** เวลาคูลดาวน์ที่เหลือ (ms) ของสกิล */
  cooldownLeft(key, time = this.scene.time.now) {
    return Math.max(0, (this.cooldowns[key] || 0) - time);
  }

  /** กดปุ่ม Hotbar (Q W E R T) → ร่ายสกิลที่ติดตั้งในช่องนั้น */
  trySkill(time, key) {
    const id = this.char.hotbar?.[key];
    const ui = this.scene.ui, sfx = this.scene.sfx;
    if (!id) {
      if (time - (this.cooldowns[`_${key}`] ?? -9999) > 1500) { ui.toast(`ช่อง ${key} ว่าง – กด K เพื่อเรียน/ติดตั้งสกิล`, 'warn'); this.cooldowns[`_${key}`] = time; }
      return;
    }
    const lv = this.char.skills?.[id] || 0;
    if (!lv) return;
    const need = SKILL_BY_ID[id]?.job;
    if (need !== this.char.appearance.job) {          // สกิลใช้ได้เฉพาะตอนถืออาวุธแนวเดียวกัน
      if (time - (this.cooldowns[`_w${key}`] ?? -9999) > 1500) { ui.toast(`${SKILL_BY_ID[id].nameTh}: ต้องถือ${JOBS[need].weaponTh}`, 'warn'); sfx.play('error'); this.cooldowns[`_w${key}`] = time; }
      return;
    }
    const sk = skillStats(SKILL_BY_ID[id], lv);
    if (this.cooldownLeft(id, time) > 0) return;
    if (this.char.mp < sk.mp) { ui.toast('MP ไม่พอ!', 'warn'); sfx.play('error'); this.cooldowns[id] = time + 400; return; }

    this.char.mp -= sk.mp;
    this.cooldowns[id] = time + sk.cd;
    this.lastAttack = time;
    sfx.play(sk.sfx);
    this.scene.net?.sendSkill(sk, this);   // แจ้ง server → ผู้เล่นอื่นเห็น VFX

    // บัฟ / พุ่ง ทำงานทันที  ส่วนสกิลโจมตีรอเฟรมที่ 3 ของท่าโจมตี
    if (sk.type === 'buff') { this.state = 'attack'; this.playAnim('buff', true); this.scene.combat.castBuff(this, sk); return; }
    if (sk.type === 'dash') { this.scene.combat.castDash(this, sk); return; }
    this.pendingSkill = sk;
    this.state = 'attack';
    this.playAnim(skillAnim(sk), true);             // ท่าเฉพาะสกิล (ร่ายเวท/ง้างธนู/หมุนฟัน/เตะ/ทุ่ม)
  }


  /** โดนโจมตี (ออฟไลน์: คำนวณเอง · ออนไลน์: server ส่งผลมาทาง onServerHit) */
  takeHit(result, fromX) {
    if (!this.alive || this.dashing || this.scene.time.now < this.invulnUntil) return false;
    if (this.scene.econ?.server) return false;                    // ออนไลน์: server ตัดสินเท่านั้น
    this.scene.combat.popup(this.x, this.y - 36, result);
    if (!result.hit) return false;
    this.char.hp = Math.max(0, this.char.hp - result.dmg);
    return this.hurtFx(result.dmg, fromX);
  }

  /** ผลจาก server: โดน/หลบ/ตาย */
  onServerHit(d) {
    if (this.state === 'dead') return;
    if (!d.hit) { this.scene.combat.popup(this.x, this.y - 36, { hit: false }); return; }
    this.scene.combat.popup(this.x, this.y - 36, { hit: true, crit: d.crit, dmg: d.dmg });
    if (Number.isFinite(d.hp)) this.char.hp = d.hp;
    if (d.stun) { this.stunUntil = this.scene.time.now + d.stun; this.scene.combat.popupText(this.x, this.y - 52, 'มึนงง!', '#bb8fce', 8); }
    if (this.char.hp <= 0) return;                                // pl:die จะตามมา
    this.hurtFx(d.dmg, d.x ?? this.x);
  }

  hurtFx(dmg, fromX) {
    this.invulnUntil = this.scene.time.now + 700;
    this.scene.sfx.play('hurt');
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(80, () => this.clearTint());
    if (this.char.hp <= 0) { if (!this.scene.econ?.server) this.die(); return true; }
    if (this.dashing) return true;
    this.state = 'hit';
    this.playAnim('hit', true);
    const dir = Math.sign(this.x - fromX) || 1;
    this.setVelocity(dir * 90, -120);  // กระเด็น
    return true;
  }

  die() {
    if (this.state === 'dead') return;
    this.state = 'dead';
    this.dashing = false;
    this.body.setAllowGravity(true);
    this.buffs = [];
    this.char.hp = 0;
    this.scene.sfx.play('die');
    this.setVelocityX(0);
    this.playAnim('die', true);
    this.scene.events.emit('player-died');
  }

  respawn(x, y) {
    const d = this.derived;
    this.char.hp = d.maxHp;
    this.char.mp = d.maxMp;
    this.setPosition(x, y);
    this.setVelocity(0, 0);
    this.state = 'idle';
    this.cooldowns = {};
    this.invulnUntil = this.scene.time.now + 2000;
    this.playAnim('idle', true);
  }

  /** เปลี่ยนชุด/อาชีพ → สร้าง spritesheet ใหม่แล้วสลับ texture */
  refreshAppearance() {
    this.previewUntil = 0;
    this.refreshTitle();
    this.aura.setTier(this.char.appearance.aura || 0);
    this.texKey = bakeCharacter(this.scene, this.char.appearance);
    this.setTexture(this.texKey, 'idle_0');
    this.fitBody();
    this.playAnim(this.state === 'dead' ? 'die' : 'idle', true);
  }

  /** ลองชุดชั่วคราว (แค่ภาพ) แล้วกลับเป็นของจริง */
  previewAppearance(a, ms = 6000) {
    this.texKey = bakeCharacter(this.scene, sanitizeAppearance(a));
    this.setTexture(this.texKey, 'idle_0');
    this.fitBody();
    this.playAnim('idle', true);
    const until = (this.previewUntil = this.scene.time.now + ms);
    this.scene.time.delayedCall(ms, () => { if (this.previewUntil === until) this.refreshAppearance(); });
  }

  /** สถานะที่ส่งให้ server */
  netState() {
    return {
      x: Math.round(this.x), y: Math.round(this.y),
      anim: this.state === 'dead' ? 'die' : this.state === 'attack' || this.state === 'fish' ? this.animName || this.state : this.state,
      flipX: this.flipX, mp: Math.round(this.char.mp),
    };
  }

  destroy(fromScene) {
    this.nameTag?.destroy();
    this.titleTag?.destroy();
    super.destroy(fromScene);
  }
}
