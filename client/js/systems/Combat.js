// ============================================================
//  Combat – โจมตีปกติ, สกิล QWER, กระสุน, ตัวเลขดาเมจ, รางวัล
// ============================================================
import { rollDamage } from '/shared/stats.js';
import { ITEMS } from '/shared/data/items.js';
import { WORLD } from '/shared/constants.js';
import { getDerived, gainExp } from './Character.js';
import { addItem } from './Inventory.js';
import { makeText, rand } from './util.js';

export class Combat {
  constructor(scene) {
    this.scene = scene;
    this.playerShots = scene.physics.add.group({ allowGravity: false });
    this.enemyShots = scene.physics.add.group({ allowGravity: false });
  }

  /** เชื่อม overlap หลังสร้าง player/monsters แล้ว */
  bind(player, monsters) {
    this.player = player;
    this.monsters = monsters;
    this.scene.physics.add.overlap(this.playerShots, monsters, (shot, mon) => this.onShotHitMonster(shot, mon));
    this.scene.physics.add.overlap(this.enemyShots, player, (a, b) => this.onShotHitPlayer(a === player ? b : a));
  }

  get sfx() { return this.scene.sfx; }

  /** มอนสเตอร์ที่ยังมีชีวิตและชนกับสี่เหลี่ยม zone เรียงจากใกล้ไปไกล */
  monstersIn(zone, fromX) {
    // ใช้ hitbox ฟิสิกส์ (body) ไม่ใช่กรอบภาพ → ไม่โดนจากขอบโปร่งใสของภาพ
    return this.monsters.getChildren()
      .filter((m) => m.alive && Phaser.Geom.Intersects.RectangleToRectangle(zone, new Phaser.Geom.Rectangle(m.body.x, m.body.y, m.body.width, m.body.height)))
      .sort((a, b) => Math.abs(a.x - fromX) - Math.abs(b.x - fromX));
  }

  hit(mon, stats, kind, mult, dir, knock) {
    const r = rollDamage(stats, mon.defStats, kind, mult);
    mon.takeHit(r, dir, knock);
    this.scene.ui.setTarget(mon);
    if (r.hit) this.sfx.play(r.crit ? 'crit' : 'hit');
    else this.sfx.play('miss');
    return r;
  }

  // ============================================================
  //  ผู้เล่นโจมตี  (skill = null → โจมตีปกติ)
  // ============================================================
  playerStrike(player, skill = null) {
    if (!player.alive) return;
    const stats = player.combatStats();
    const f = player.facing;

    if (!skill) return this.basicAttack(player, stats, f);

    switch (skill.type) {
      case 'melee': {
        const hits = skill.hits || 1;
        for (let i = 0; i < hits; i++) {
          this.scene.time.delayedCall(i * (skill.interval || 0), () => {
            const targets = this.monstersIn(this.frontZone(player, skill.range), player.x);
            const list = skill.all ? targets : targets.slice(0, 1);
            list.forEach((m) => this.hit(m, stats, skill.kind, skill.mult, f, skill.knock));
            if (list.length) this.scene.cameras.main.shake(70, 0.004);
            if (i > 0) this.sfx.play(skill.sfx);
          });
        }
        this.slashFx(player, skill.range);
        break;
      }
      case 'projectile': {
        const n = skill.count || 1;
        for (let i = 0; i < n; i++) {
          const dy = (i - (n - 1) / 2) * (skill.spread || 0);
          this.spawnShot(player, `proj_${skill.proj}`, skill.speed, skill.range, skill.kind, skill.mult, stats, dy, !!skill.pierce);
        }
        break;
      }
      case 'aoe': {
        const cx = player.x + f * (skill.offset || 0);
        for (let i = 0; i < skill.hits; i++) {
          this.scene.time.delayedCall(i * skill.interval, () => {
            const zone = new Phaser.Geom.Rectangle(cx - skill.radius, player.y - 60, skill.radius * 2, 64);
            this.aoeFx(skill, cx, player.y);
            this.monstersIn(zone, cx).forEach((m) => this.hit(m, stats, skill.kind, skill.mult, Math.sign(m.x - cx) || f));
            if (i > 0) this.sfx.play(skill.sfx);
          });
        }
        break;
      }
      case 'strike': {
        const target = this.monsters.getChildren()
          .filter((m) => m.alive && Math.abs(m.x - player.x) <= skill.range && Math.abs(m.y - player.y) < 120)
          .sort((a, b) => Math.abs(a.x - player.x) - Math.abs(b.x - player.x))[0];
        if (!target) { this.popupText(player.x, player.y - 46, 'ไม่มีเป้าหมาย', '#bdc3c7'); break; }
        this.lightningFx(target.x, target.y);
        this.hit(target, stats, skill.kind, skill.mult, f);
        this.scene.cameras.main.shake(120, 0.006);
        break;
      }
    }
  }

  basicAttack(player, stats, f) {
    const atk = player.job.attack;
    let mult = atk.mult;
    let special = false;
    if (atk.comboEvery && player.combo % atk.comboEvery === 0) { mult *= atk.comboMult; special = true; } // ศอกกลับ!

    if (atk.style === 'melee') {
      const targets = this.monstersIn(this.frontZone(player, atk.range), player.x);
      // ขุนศึกฟันโดนทุกตัวในระยะ / นักมวยโดนตัวที่ใกล้ที่สุด
      const hitList = player.job.weapon === 'sword' ? targets : targets.slice(0, 1);
      hitList.forEach((m) => this.hit(m, stats, atk.kind, mult, f));
      if (special && hitList.length) this.popupText(player.x + f * 14, player.y - 44, 'ศอกกลับ!', '#f39c12');
      if (hitList.length) this.scene.cameras.main.shake(60, 0.003);
    } else {
      this.spawnShot(player, `proj_${atk.projectile}`, atk.speed, atk.range, atk.kind, mult, stats, 0, false);
    }
  }

  /** กล่องโจมตีด้านหน้า: เริ่มจากขอบ hitbox ผู้เล่นออกไป range หน่วย สูงเท่าตัวผู้เล่น + 6 */
  frontZone(player, range) {
    const b = player.body, f = player.facing;
    const x1 = f > 0 ? b.right - 6 : b.left - range;
    return new Phaser.Geom.Rectangle(x1, b.top - 6, range + 6, b.height + 6);
  }

  spawnShot(player, tex, speed, range, kind, mult, stats, dy, pierce) {
    const f = player.facing;
    const shot = this.playerShots.create(player.x + f * 12, player.body.center.y - 2 + dy, tex);
    shot.setFlipX(f < 0).setDepth(12);
    shot.body.setAllowGravity(false);
    shot.setVelocity(f * speed, dy * 4);
    shot.setData({ startX: shot.x, range, kind, mult, stats, dir: f, pierce, hitSet: new Set() });
    if (tex === 'proj_fireball') this.scene.tweens.add({ targets: shot, angle: f * 360, duration: 400, repeat: -1 });
    return shot;
  }

  onShotHitMonster(shot, mon) {
    if (!mon.alive || !shot.active) return;
    const d = shot.data.values;
    if (d.hitSet.has(mon)) return;
    d.hitSet.add(mon);
    this.hit(mon, d.stats, d.kind, d.mult, d.dir);
    this.burst(shot.x, shot.y, d.kind === 'magic' ? 0xf39c12 : 0xecf0f1);
    if (!d.pierce) shot.destroy();
  }

  // ---------------- สกิลที่ทำงานทันที ----------------
  castBuff(player, sk) {
    const c = player.char, d = getDerived(c);
    if (sk.heal) {
      const amt = Math.round(d.maxHp * sk.heal);
      c.hp = Math.min(d.maxHp, c.hp + amt);
      this.popupText(player.x, player.y - 46, `+${amt} HP`, '#58d68d', 10);
    }
    player.buffs.push({ buff: sk.buff, until: this.scene.time.now + sk.duration, name: sk.nameTh, icon: sk.icon });
    this.popupText(player.x, player.y - 56, sk.nameTh, '#f7dc6f', 9);
    this.burst(player.x, player.y - 18, 0xf7dc6f, 18);

    // ออร่าตามตัวผู้เล่นจนหมดเวลา
    const aura = this.scene.add.ellipse(player.x, player.y - 2, 30, 8, 0xf7dc6f, 0.35).setDepth(9);
    const follow = () => aura.setPosition(player.x, player.y - 2);
    this.scene.events.on('update', follow);
    this.scene.tweens.add({ targets: aura, alpha: 0.12, yoyo: true, repeat: -1, duration: 400 });
    this.scene.time.delayedCall(sk.duration, () => { this.scene.events.off('update', follow); aura.destroy(); });
  }

  castDash(player, sk) {
    const f = player.facing;
    const startX = player.x;
    const endX = Phaser.Math.Clamp(startX + f * sk.distance, 10, WORLD.width - 10);
    const stats = player.combatStats();
    player.dashing = true;
    player.state = 'attack';
    player.playAnim(sk.leap ? 'jump' : 'attack', true);
    player.body.setAllowGravity(false);
    player.setVelocity(0, 0);

    // เงาติดตาม
    const ghost = () => {
      const g = this.scene.add.image(player.x, player.y, player.texture.key, player.frame.name).setOrigin(0.5, 1).setFlipX(player.flipX).setAlpha(0.4).setTint(0xaed6f1).setDepth(9);
      this.scene.tweens.add({ targets: g, alpha: 0, duration: 250, onComplete: () => g.destroy() });
    };
    const trail = this.scene.time.addEvent({ delay: 30, loop: true, callback: ghost });

    this.scene.tweens.add({
      targets: player, x: endX, duration: 200, ease: 'Cubic.easeOut',
      y: sk.leap ? { value: player.y - 18, yoyo: true, duration: 100 } : player.y,
      onComplete: () => {
        trail.remove();
        player.dashing = false;
        player.state = 'idle';
        player.body.setAllowGravity(true);
        const zone = new Phaser.Geom.Rectangle(Math.min(startX, endX) - 8, player.y - 36, Math.abs(endX - startX) + 16, 38);
        const targets = this.monstersIn(zone, startX);
        targets.forEach((m) => this.hit(m, stats, sk.kind, sk.mult, f, 120));
        if (targets.length) this.scene.cameras.main.shake(90, 0.005);
      },
    });
  }

  // ---------------- เอฟเฟกต์สกิล ----------------
  slashFx(player, range) {
    const f = player.facing;
    const g = this.scene.add.graphics().setDepth(13);
    g.lineStyle(3, 0xffffff, 0.9);
    g.beginPath();
    g.arc(player.x + f * 4, player.y - 18, range * 0.7, f > 0 ? -1.2 : Math.PI - 0.6, f > 0 ? 0.6 : Math.PI + 1.2);
    g.strokePath();
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
  }

  aoeFx(skill, cx, y) {
    const s = this.scene;
    if (skill.fx === 'meteor') {
      for (let k = 0; k < 3; k++) {
        const tx = cx + rand(-skill.radius * 0.8, skill.radius * 0.8);
        const m = s.add.image(tx - 40, y - 160, 'proj_meteor').setDepth(14);
        s.tweens.add({ targets: m, x: tx, y: y - 8, duration: 220, onComplete: () => { this.burst(tx, y - 8, 0xe67e22, 14); m.destroy(); } });
      }
    } else if (skill.fx === 'arrowRain') {
      for (let k = 0; k < 6; k++) {
        const tx = cx + rand(-skill.radius, skill.radius);
        const a = s.add.image(tx, y - 150, 'proj_arrow').setAngle(90).setDepth(14);
        s.tweens.add({ targets: a, y: y - 4, duration: 180 + k * 15, onComplete: () => a.destroy() });
      }
    } else {
      const ring = s.add.circle(cx, y - 16, skill.radius, 0xffffff, 0).setStrokeStyle(2, 0xaed6f1, 0.9).setDepth(13);
      s.tweens.add({ targets: ring, scale: 1.15, alpha: 0, duration: 200, onComplete: () => ring.destroy() });
      this.burst(cx, y - 16, 0xaed6f1, 10);
    }
  }

  lightningFx(x, y) {
    const g = this.scene.add.graphics().setDepth(14);
    g.lineStyle(2, 0xf9e79f, 1);
    g.beginPath();
    let px = x + rand(-10, 10), py = y - 200;
    g.moveTo(px, py);
    while (py < y - 10) { px = x + rand(-8, 8); py += rand(14, 26); g.lineTo(px, Math.min(py, y - 10)); }
    g.strokePath();
    const flash = this.scene.add.rectangle(0, 0, WORLD.width, WORLD.height, 0xffffff, 0.25).setOrigin(0).setDepth(60);
    this.scene.tweens.add({ targets: [g, flash], alpha: 0, duration: 260, onComplete: () => { g.destroy(); flash.destroy(); } });
    this.burst(x, y - 12, 0xf9e79f, 16);
  }

  // ============================================================
  //  มอนสเตอร์โจมตี
  // ============================================================
  monsterStrike(mon) {
    const p = this.player;
    if (!p.alive) return;
    const def = mon.def;
    if (def.projectile) {
      const ang = Phaser.Math.Angle.Between(mon.body.center.x, mon.body.center.y, p.body.center.x, p.body.center.y);
      const shot = this.enemyShots.create(mon.body.center.x, mon.body.center.y, `proj_${def.projectile}`);
      shot.body.setAllowGravity(false);
      shot.setDepth(12);
      this.scene.physics.velocityFromRotation(ang, 140, shot.body.velocity);
      shot.setData({ startX: shot.x, range: def.attackRange * 1.6, atk: mon.atkStats, fromX: mon.x });
      this.scene.tweens.add({ targets: shot, angle: 360, duration: 600, repeat: -1 });
      this.sfx.play('enemyShot');
    } else {
      this.sfx.play('enemySwing');
      // โดนเมื่อช่องว่างระหว่างขอบ hitbox ≤ ระยะตี (+6 เผื่อผู้เล่นขยับ) และอยู่ระดับความสูงเดียวกัน
      if (mon.gapTo(p) <= mon.reach + 6 && mon.verticalOverlap(p, 4)) {
        const d = p.combatStats();
        p.takeHit(rollDamage(mon.atkStats, { def: d.def, eva: d.eva }, 'physical', 1), mon.x);
      }
    }
  }

  onShotHitPlayer(shot) {
    if (!shot.active || !this.player.alive) return;
    const d = this.player.combatStats();
    this.player.takeHit(rollDamage(shot.getData('atk'), { def: d.def, eva: d.eva }, 'magic', 1), shot.getData('fromX'));
    shot.destroy();
  }

  /** ลบกระสุนที่บินเกินระยะ */
  update() {
    for (const g of [this.playerShots, this.enemyShots]) {
      g.getChildren().slice().forEach((s) => {
        if (Math.abs(s.x - s.getData('startX')) > s.getData('range') || s.x < 0 || s.x > WORLD.width || s.y > WORLD.height) s.destroy();
      });
    }
  }

  // ============================================================
  //  รางวัล
  // ============================================================
  onMonsterKilled(mon) {
    const c = this.player.char;
    const def = mon.def;
    const gold = rand(def.gold[0], def.gold[1]);
    c.gold += gold;
    const ups = gainExp(c, def.exp);
    this.popupText(mon.x, mon.y - def.frame.h - 8, `+${def.exp} EXP  +฿${gold}`, '#f7dc6f');
    this.sfx.play('ghostDie');
    this.scene.time.delayedCall(250, () => this.sfx.play('coin'));

    for (const drop of def.drops) {
      if (Math.random() < drop.chance) {
        addItem(c, drop.item);
        this.scene.ui.toast(`ได้รับ ${ITEMS[drop.item].icon} ${ITEMS[drop.item].nameTh}`);
      }
    }
    if (ups) {
      this.scene.ui.toast(`+${ups * 5} แต้มสถานะ (กด C เพื่ออัปค่าพลัง)`);
      this.scene.ui.banner(`LEVEL UP!  Lv.${c.level}`);
      this.popupText(this.player.x, this.player.y - 50, 'LEVEL UP!', '#f1c40f', 12);
      this.burst(this.player.x, this.player.y - 20, 0xf1c40f, 24);
      this.sfx.play('levelup');
    }
    this.scene.saveSoon();
  }

  // ============================================================
  //  เอฟเฟกต์ทั่วไป
  // ============================================================
  popup(x, y, result) {
    if (!result.hit) return this.popupText(x, y, 'MISS', '#bdc3c7');
    this.popupText(x, y, result.crit ? `${result.dmg}!` : `${result.dmg}`, result.crit ? '#f1c40f' : '#ffffff', result.crit ? 11 : 8);
  }

  popupText(x, y, text, color = '#fff', size = 8) {
    const t = makeText(this.scene, x + rand(-4, 4), y, text, { fontSize: `${size}px`, color }).setOrigin(0.5).setDepth(50);
    this.scene.tweens.add({ targets: t, y: y - 18, alpha: 0, duration: 900, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  burst(x, y, tint, qty = 8) {
    const em = this.scene.add.particles(x, y, 'particle', {
      speed: { min: 30, max: 90 }, lifespan: 350, scale: { start: 0.8, end: 0 }, tint, quantity: qty, emitting: false,
    }).setDepth(40);
    em.explode(qty);
    this.scene.time.delayedCall(500, () => em.destroy());
  }
}
