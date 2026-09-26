// ============================================================
//  Monster – ผีไทย + AI พื้นฐาน
//  behavior: walker | flyer | jumper | ranged
//  state: patrol → chase → attack → hit → dead → (respawn)
//  ▸ ออนไลน์: server คุมผี (server/mobs.js) → ตัวนี้เป็น "หุ่น" ตามตำแหน่ง/HP/ท่าจาก server (ทุกคนเห็นตรงกัน)
//  ▸ ออฟไลน์/ต่อ server ไม่ได้: ใช้ AI ในเครื่องแบบเดิม
// ============================================================
import { MONSTERS } from '/shared/data/monsters.js';
import { WORLD } from '/shared/constants.js';
import { mapAt, MAPS } from '/shared/data/maps.js';
import { makeText, rand } from '../systems/util.js';

const EV = Phaser.Animations.Events;
const AGGRO_X = 170, AGGRO_Y = 90, RESPAWN_MS = 9000;

export class Monster extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, id, gi = -1) {
    const def = MONSTERS[id];
    if (def.art) def.frame = MONSTERS[def.art].frame;            // บอสภาคใช้ภาพผีประจำแมพ (ขยาย)
    const x = rand(def.zone[0], def.zone[1]);
    super(scene, x, WORLD.groundY - 40, `mon_${def.art || id}`, 'walk_0');
    this.id = id;
    this.def = def;
    this.key = `mon_${def.art || id}`;
    this.gi = gi;                                // ลำดับผีทั้งเกม (ตรงกับ server)
    this.srv = null;                             // สถานะล่าสุดจาก server

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 1).setDepth(8);
    const { w, h } = def.frame;
    // hitbox: ใช้ขนาดตัวจริงจากหุ่นตัดต่อ (เฟรมมีขอบเผื่อท่าทาง) ถ้ามี
    const bw = def.frame.bodyW || Math.round(w * 0.6), bh = Math.round((def.frame.bodyH || h) * 0.85);
    this.body.setSize(bw, bh).setOffset(Math.round((w - bw) / 2), h - 2 - bh - (def.frame.floatPad ? 4 : 0));
    this.setCollideWorldBounds(true);

    this.isFlyer = def.behavior === 'flyer';
    this.home = MAPS[def.mapId] || null;        // แมพของผีตัวนี้ (ห้ามออกนอกแมพ)
    if (this.isFlyer) this.body.setAllowGravity(false);
    if (def.regionBoss) {                       // บอสประจำภาค: ตัวใหญ่ + ย้อมสี + ไม่มี AI ในเครื่อง (server เท่านั้น)
      this.isRegionBoss = true;
      this.setScale(def.scale || 1.8).setTint(def.tint || 0xffffff);
      this.baseTint = def.tint || 0xffffff;
      this.bossGlow = scene.add.ellipse(x, WORLD.groundY, 70, 9, def.tint || 0xf1c40f, 0.35).setDepth(7).setVisible(false);
    }

    // หลอดเลือด + ชื่อ
    this.hpBg = scene.add.rectangle(0, 0, 20, 3, 0x000000, 0.7).setDepth(9);
    this.hpBar = scene.add.rectangle(0, 0, 20, 3, 0xe74c3c).setOrigin(0, 0.5).setDepth(9);
    this.label = makeText(scene, 0, 0, `Lv.${def.level} ${def.nameTh}`, { fontSize: def.regionBoss ? '8px' : '6px', color: def.regionBoss ? '#f9e79f' : '#f5b7b1' }).setOrigin(0.5).setDepth(9);

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
    if (def.regionBoss) { this.state = 'dead'; this.setVisible(false); this.showUi(false); this.body.enable = false; }   // รอ server สั่งเกิด
  }

  /** มีชีวิต + อยู่ในแมพที่ผู้เล่นอยู่ (ผีแมพอื่นถูกพักไว้ ตี/โดนตีไม่ได้) */
  get alive() { return this.active && this.state !== 'dead' && this.state !== 'dormant'; }

  /** ขอบเขตที่ผีเดินได้: ตั้งแต่ท้ายจุดพักกองไฟ ถึงขอบขวาแมพ (ไม่เข้าแคมป์ ไม่ทะลุไปแมพอื่น) */
  get bounds() {
    const m = this.home;
    return m ? [m.safeEndX + 10, m.maxX - 14] : [WORLD.minX + 10, WORLD.width - 10];
  }

  /** ผีแมพอื่น: หยุดนิ่ง/ซ่อน · กลับมาแมพนี้: ถ้าหลุดออกนอกเขตให้กลับเข้าเขต */
  setOnMap(on) {
    this.setActive(on);
    this.srv = null;                              // ออก/เข้าแมพ → รอสถานะใหม่จาก server
    if (!on) {
      this.body.setVelocity(0, 0);
      this.body.moves = false;
      this.setVisible(false); this.showUi(false);
      return;
    }
    this.body.moves = true;
    const [a, b] = this.bounds;
    if (this.state !== 'dead' && (this.x < a || this.x > b || this.y > WORLD.groundY + 40)) this.reset(rand(this.def.zone[0], this.def.zone[1]));
    // ออนไลน์: ซ่อนไว้จนกว่า server ส่งตำแหน่งจริงมา (ไม่เห็นผีวาร์ปไปมา/ผีที่ตายแล้วโผล่)
    this.awaitSync = !!this.scene.net?.online;
    this.onMapAt = this.scene.time.now;
    const show = this.state !== 'dead' && this.state !== 'dormant' && !this.awaitSync;
    this.setVisible(show); this.showUi(show);
  }

  /** ได้สถานะจาก server ภายใน 1.5 วิ = ผีตัวนี้ server คุม */
  get synced() { return !!this.srv && this.scene.time.now - this.srvAt < 1500 && !!this.scene.net?.online; }

  /** สถานะจาก server: [gi, x, y, hp, st(0 เดิน 1 ไล่ 2 ตี 3 ตาย), dir, atkSeq, targetId, stun, hit, vx] */
  applyServer(a, time) {
    const [, x, y, hp, st, dir, atk, target, stun, hit, vx] = a;
    const first = !this.srv;
    this.srv = { x, y, st, dir, vx, target };
    this.srvAt = time;
    this.targetId = target || null;
    if (st === 3) {                                // ตายแล้ว (บน server)
      if (this.state !== 'dead') this.dieVisual(!first && this.visible);
      this.awaitSync = false;
      return;
    }
    if (this.state === 'dead' || first) {          // เกิดใหม่ / เพิ่งเข้าแมพ
      if (this.state === 'dead') this.reset(x);
      this.setPosition(x, this.isFlyer ? y : this.y);
      this.srvAtk = atk; this.srvHit = hit;
    }
    if (this.awaitSync) {
      this.awaitSync = false;
      if (this.active) { this.setVisible(true); this.showUi(true); }
    }
    this.hp = Math.min(this.hp, hp);
    if (hp > this.hp && first) this.hp = hp;
    if (stun) this.stunnedUntil = Math.max(this.stunnedUntil || 0, time + 120);
    if (atk !== this.srvAtk) { this.srvAtk = atk; this.netAttack(); }
    if (hit && !this.srvHit && this.state !== 'hit' && this.def.level < 8 && this.active) {   // คนอื่นตีโดน → สะดุ้ง
      this.state = 'hit'; this.anims.timeScale = 1; this.play(`${this.key}:hit`);
    }
    this.srvHit = hit;
  }

  /** server สั่งโจมตี */
  netAttack() {
    if (!this.alive) return;
    this.state = 'attack';
    this.setVelocityX(0);
    this.anims.timeScale = 1;
    this.play(`${this.key}:attack`);
  }

  /** เดินตามตำแหน่งจาก server (นุ่มนวล ไม่กระตุก) */
  follow() {
    const s = this.srv;
    let dx = s.x - this.x;
    if (Math.abs(dx) > 90) { this.x = s.x; dx = 0; }
    let vx = Math.abs(dx) < 1 ? 0 : Phaser.Math.Clamp(dx * 7, -240, 240);
    const busy = this.state === 'attack' || this.state === 'hit';
    if (busy) vx *= 0.35;
    this.setVelocityX(vx);
    if (this.isFlyer) this.setVelocityY(Phaser.Math.Clamp((s.y - this.y) * 6, -200, 200));
    this.setFlipX(s.dir < 0);
    if (!busy) { this.state = s.st === 1 ? 'chase' : 'patrol'; this.animateMove(Math.abs(s.vx) > 2 ? s.vx : vx * 0.3); }
  }

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
    this.body.setVelocity(0, 0);
    this.setAlpha(1).clearTint();
    if (this.baseTint) this.setTint(this.baseTint);
    this.body.enable = true;
    this.setVisible(this.active && !this.awaitSync);   // เกิดใหม่ตอนผู้เล่นอยู่แมพอื่น → ยังซ่อนไว้
    this.showUi(this.active && !this.awaitSync);
    this.play(`${this.key}:walk`);
  }

  showUi(v) { this.hpBg.setVisible(v); this.hpBar.setVisible(v); this.label.setVisible(v); this.bossGlow?.setVisible(v); }

  update(time, player) {
    this.checkNightOnly();
    if (!this.alive) return;
    // รอ server นานเกิน (ต่อไม่ได้) → แสดงผีแล้วใช้ AI ในเครื่อง
    if (this.awaitSync && time - (this.onMapAt || 0) > 1500) { this.awaitSync = false; this.setVisible(true); this.showUi(true); }
    // กันโดนกระแทก/ผลักจนหลุดเขต
    const [lo, hi] = this.bounds;
    if (this.x < lo) { this.x = lo; if (this.body.velocity.x < 0) this.body.velocity.x = 0; }
    else if (this.x > hi) { this.x = hi; if (this.body.velocity.x > 0) this.body.velocity.x = 0; }
    const d = this.def;
    const h = d.frame.h * (d.scale || 1);
    const bw = d.regionBoss ? 44 : 20;
    this.hpBg.setPosition(this.x, this.y - h - 3).setSize(bw, 3);
    this.hpBar.setPosition(this.x - bw / 2, this.y - h - 3).setSize(bw * Math.max(0, this.hp / d.hp), 3);
    this.label.setPosition(this.x, this.y - h - 9);
    if (this.bossGlow) { this.bossGlow.setPosition(this.x, WORLD.groundY); this.bossGlow.setScale(1 + Math.sin(time / 300) * 0.08, 1); }

    // ติดสถานะมึนงง/ตรึง → ขยับไม่ได้
    if (time < (this.stunnedUntil || 0)) {
      this.setVelocity(0, this.isFlyer ? 0 : this.body.velocity.y);
      if (this.anims.isPlaying) this.anims.pause();
      return;
    } else if (this.anims.isPaused) { this.anims.resume(); this.clearTint(); }

    if (this.synced) return this.follow();
    if (this.isRegionBoss) { this.setVelocity(0, 0); return; }     // บอสภาคไม่มี AI ในเครื่อง

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
    // ห้ามเดินออกนอกเขต (ไม่ไล่ตามเข้าแคมป์/ประตู ไม่ทะลุไปแมพอื่น)
    const [bx0, bx1] = this.bounds;
    if ((this.x <= bx0 && vx < 0) || (this.x >= bx1 && vx > 0)) vx = 0;
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
  showStun(ms) {
    this.stunnedUntil = Math.max(this.stunnedUntil || 0, this.scene.time.now + ms);
    if (this.state === 'attack') this.state = 'chase';
    this.setTint(0x85c1e9);
    this.scene.combat.popupText(this.x, this.y - this.def.frame.h - 6, 'มึนงง!', '#85c1e9', 7);
  }

  applyEffect(effect, dmg) {
    if (!this.alive || !effect) return;
    const s = this.scene;
    if (effect.stun) this.showStun(effect.stun.ms);
    if (effect.poison && !this.synced) {
      const { ticks, every, ratio } = effect.poison;
      const per = Math.max(1, Math.round(dmg * ratio));
      this.poisonTimer?.remove();
      this.setTint(0x82e0aa);
      this.poisonTimer = s.time.addEvent({ delay: every, repeat: ticks - 1, callback: () => {
        if (!this.alive) return this.poisonTimer?.remove();
        s.combat.popupText(this.x, this.y - this.def.frame.h, `${per}`, '#58d68d', 7);
        if (this.synced) { s.net.send('mob:hit', { gi: this.gi, dmg: per }); this.hp = Math.max(1, this.hp - per); return; }
        this.hp -= per;
        if (this.hp <= 0) this.die();
        else if (this.poisonTimer.getRepeatCount() === 0) this.clearTint();
      } });
    }
  }

  /** โดนผู้เล่นตี */
  /** ออนไลน์: ส่งคำขอโจมตีให้ server ทอยดาเมจ (ผลกลับมาทาง mob:dmg) → true ถ้าส่งแล้ว */
  hitOnline(meta, dir, knock = 70) {
    if (!this.synced || !this.alive) return false;
    this.scene.net.send('mob:hit', { gi: this.gi, sk: meta.sk || null, combo: !!meta.combo, dir, knock });
    return true;
  }

  takeHit(result, dir, knock = 70, fromServer = false) {
    if (!this.alive) return;
    this.scene.combat.popup(this.x, this.y - this.def.frame.h, result);
    if (!result.hit) return;
    const net = fromServer || this.synced;
    if (fromServer) { if (result.stun) this.showStun(result.stun); if (result.poison) this.setTint(0x82e0aa); }
    if (net) this.hp = Math.max(1, this.hp - result.dmg);   // server ตัดสินตาย (mob:die) · แสดง HP ล่วงหน้า
    else this.hp -= result.dmg;
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => { if (!this.alive) return; this.clearTint(); if (this.baseTint) this.setTint(this.baseTint); });
    if (!net && this.hp <= 0) return this.die();
    this.scene.ui?.setTarget(this);
    // มอนสเตอร์ Lv.8+ / บอสภาค มี "เกราะ" ไม่สะดุ้งเวลาโดนตี (ไม่ถูกขัดจังหวะโจมตี)
    if (this.isRegionBoss) return;
    if (this.def.level >= 8) { this.setVelocityX(dir * knock * 0.2); return; }
    this.state = 'hit';
    this.setVelocityX(dir * knock);
    this.anims.timeScale = 1;
    this.play(`${this.key}:hit`);
  }

  /** ตาย (ภาพ/สถานะอย่างเดียว ไม่ให้รางวัล) */
  dieVisual(anim = true) {
    this.state = 'dead';
    this.hp = 0;
    this.body.enable = false;
    this.poisonTimer?.remove();
    this.showUi(false);
    this.anims.timeScale = 1;
    if (anim && this.active && this.visible) this.play(`${this.key}:die`);
    else this.setVisible(false);
    if (this.scene.ui?.target === this) this.scene.ui.setTarget?.(null);
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

  destroy(fromScene) { this.bossGlow?.destroy(); super.destroy(fromScene); }

  /** ค่าสำหรับคำนวณความเสียหาย */
  get atkStats() { const a = Math.round(this.def.atk * this.mods.atk); return { patk: a, matk: a, accuracy: this.def.acc, critRate: 0.05, critDmg: 1.5 }; }
  get defStats() { return { def: this.def.def, eva: this.def.eva }; }
}
