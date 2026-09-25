// ============================================================
//  Combat – การโจมตีของผู้เล่น/มอนสเตอร์, กระสุน, ตัวเลขดาเมจ, รางวัล
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

  // ---------------- ผู้เล่นโจมตี ----------------
  playerStrike(player) {
    const atk = player.job.attack;
    const stats = getDerived(player.char);
    let mult = atk.mult;
    let special = false;
    if (atk.comboEvery && player.combo % atk.comboEvery === 0) { mult *= atk.comboMult; special = true; } // ศอกกลับ!

    if (atk.style === 'melee') {
      const f = player.facing;
      const x1 = f > 0 ? player.x - 4 : player.x - atk.range - 6;
      const zone = new Phaser.Geom.Rectangle(x1, player.y - 34, atk.range + 10, 34);
      const targets = this.monsters.getChildren()
        .filter((m) => m.alive && Phaser.Geom.Intersects.RectangleToRectangle(zone, m.getBounds()))
        .sort((a, b) => Math.abs(a.x - player.x) - Math.abs(b.x - player.x));
      // นักดาบฟันโดนทุกตัวในระยะ / นักมวยโดนตัวที่ใกล้ที่สุด
      const hitList = player.job.weapon === 'sword' ? targets : targets.slice(0, 1);
      hitList.forEach((m) => m.takeHit(rollDamage(stats, m.defStats, atk.kind, mult), f));
      if (special && hitList.length) this.popupText(player.x + f * 14, player.y - 44, 'ศอกกลับ!', '#f39c12');
      if (hitList.length) this.scene.cameras.main.shake(60, 0.003);
    } else {
      const f = player.facing;
      const shot = this.playerShots.create(player.x + f * 12, player.y - 20, `proj_${atk.projectile}`);
      shot.setFlipX(f < 0).setDepth(12);
      shot.body.setAllowGravity(false);
      shot.setVelocityX(f * atk.speed);
      shot.setData({ startX: shot.x, range: atk.range, kind: atk.kind, mult, stats, dir: f });
      if (atk.projectile === 'fireball') this.scene.tweens.add({ targets: shot, angle: f * 360, duration: 400, repeat: -1 });
    }
  }

  onShotHitMonster(shot, mon) {
    if (!mon.alive || !shot.active) return;
    const d = shot.data.values;
    mon.takeHit(rollDamage(d.stats, mon.defStats, d.kind, d.mult), d.dir);
    this.burst(shot.x, shot.y, d.kind === 'magic' ? 0xf39c12 : 0xecf0f1);
    shot.destroy();
  }

  // ---------------- มอนสเตอร์โจมตี ----------------
  monsterStrike(mon) {
    const p = this.player;
    if (!p.alive) return;
    const def = mon.def;
    if (def.projectile) {
      const ang = Phaser.Math.Angle.Between(mon.x, mon.y - def.frame.h / 2, p.x, p.y - 18);
      const shot = this.enemyShots.create(mon.x, mon.y - def.frame.h / 2, `proj_${def.projectile}`);
      shot.body.setAllowGravity(false);
      shot.setDepth(12);
      this.scene.physics.velocityFromRotation(ang, 140, shot.body.velocity);
      shot.setData({ startX: shot.x, range: def.attackRange * 1.6, atk: mon.atkStats, fromX: mon.x });
      this.scene.tweens.add({ targets: shot, angle: 360, duration: 600, repeat: -1 });
    } else {
      const dx = Math.abs(p.x - mon.x), dy = Math.abs(p.y - mon.y);
      if (dx <= def.attackRange + 10 && dy < 36) {
        const d = getDerived(p.char);
        p.takeHit(rollDamage(mon.atkStats, { def: d.def, eva: d.eva }, 'physical', 1), mon.x);
      }
    }
  }

  onShotHitPlayer(shot) {
    if (!shot.active || !this.player.alive) return;
    const d = getDerived(this.player.char);
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

  // ---------------- รางวัล ----------------
  onMonsterKilled(mon) {
    const c = this.player.char;
    const def = mon.def;
    const gold = rand(def.gold[0], def.gold[1]);
    c.gold += gold;
    const ups = gainExp(c, def.exp);
    this.popupText(mon.x, mon.y - def.frame.h - 8, `+${def.exp} EXP  +฿${gold}`, '#f7dc6f');

    for (const drop of def.drops) {
      if (Math.random() < drop.chance) {
        addItem(c, drop.item);
        this.scene.ui.toast(`ได้รับ ${ITEMS[drop.item].icon} ${ITEMS[drop.item].nameTh}`);
      }
    }
    if (ups) {
      this.scene.ui.toast(`🎉 เลเวลอัป! Lv.${c.level} (+${ups * 5} แต้มสถานะ กด C)`);
      this.popupText(this.player.x, this.player.y - 50, 'LEVEL UP!', '#f1c40f', 12);
      this.burst(this.player.x, this.player.y - 20, 0xf1c40f, 24);
    }
    this.scene.saveSoon();
  }

  // ---------------- เอฟเฟกต์ ----------------
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
