// ============================================================
//  EventMob – ผีห่าที่บุกหมู่บ้าน (ตำแหน่ง/HP มาจาก server)
//  ใส่ในกลุ่ม monsters → ระบบโจมตี/กระสุน/สกิลเดิมตีโดนได้ทันที
// ============================================================
import { WORLD } from '/shared/constants.js';
import { MONSTERS } from '/shared/data/monsters.js';
import { makeText } from '../systems/util.js';

export class EventMob extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, info) {
    const key = `mon_${info.type}`;
    super(scene, info.x, WORLD.groundY, key, 'walk_0');
    this.key = key;
    this.mobId = info.id;
    this.type = info.type;
    const d = MONSTERS[info.type];
    this.def = { ...d, nameTh: `ผีห่า·${d.nameTh}`, hp: info.maxHp };
    this.hp = info.hp;
    this.serverX = info.x;
    this.isFlyer = true;           // server คุมตำแหน่ง ไม่ใช้แรงโน้มถ่วง
    this.isEventMob = true;
    this.state = 'alive';

    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setAllowGravity(false).setImmovable(true);
    this.setOrigin(0.5, 1).setDepth(8).setTint(0xd2b4de);
    const fw = this.frame.width, fh = this.frame.height;
    this.body.setSize(Math.round(fw * 0.6), Math.round(fh * 0.85)).setOffset(Math.round(fw * 0.2), Math.round(fh * 0.15));
    // ผีบินลอยสูงจากพื้นเล็กน้อย
    this.floatY = d.behavior === 'flyer' ? 14 : 0;
    this.y = WORLD.groundY - this.floatY;

    this.aura = scene.add.ellipse(this.x, WORLD.groundY, fw * 0.9, 5, 0xe67e22, 0.35).setDepth(7);
    this.hpBg = scene.add.rectangle(0, 0, 20, 3, 0x000000, 0.7).setDepth(9);
    this.hpBar = scene.add.rectangle(0, 0, 20, 3, 0xe67e22).setOrigin(0, 0.5).setDepth(9);
    this.label = makeText(scene, 0, 0, '🔥 ผีห่าบุก', { fontSize: '6px', color: '#f5b041' }).setOrigin(0.5).setDepth(9);
    this.playA('walk');
    this.setAlpha(0);
    scene.tweens.add({ targets: this, alpha: 1, duration: 500 });
  }

  get alive() { return this.state === 'alive'; }
  get defStats() { return { def: this.def.def, eva: this.def.eva }; }

  playA(name, force = false) {
    const k = `${this.key}:${name}`;
    if (!this.scene.anims.exists(k)) return;
    if (force || this.anims.currentAnim?.key !== k) this.play(k);
  }

  setServer(m) {
    this.serverX = m.x;
    this.hp = Math.min(this.hp, m.hp);
    this.def.hp = m.maxHp;
    this.setFlipX(m.dir < 0);
    if (m.anim === 'walk' && !(this.anims.currentAnim?.key.endsWith(':attack') && this.anims.isPlaying)) this.playA('walk');
  }

  attack() { this.playA('attack', true); }

  update(time) {
    if (!this.alive) return;
    this.x += (this.serverX - this.x) * 0.25;
    this.y = WORLD.groundY - this.floatY - (this.floatY ? Math.sin(time / 300 + this.x) * 3 : 0);
    this.body.updateFromGameObject?.();
    const h = this.frame.height;
    this.hpBg.setPosition(this.x, this.y - h - 3);
    this.hpBar.setPosition(this.x - 10, this.y - h - 3).setSize(20 * Math.max(0, this.hp / this.def.hp), 3);
    this.label.setPosition(this.x, this.y - h - 9);
    this.aura.setPosition(this.x, WORLD.groundY);
  }

  takeHit(result) {
    if (!this.alive) return;
    this.scene.combat.popup(this.x, this.y - this.frame.height, result);
    if (!result.hit) return;
    this.hp = Math.max(1, this.hp - result.dmg);
    this.scene.net.send('event:hit', { mobId: this.mobId, dmg: result.dmg, crit: !!result.crit });
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => this.alive && this.clearTint().setTint(0xd2b4de));
    this.scene.ui?.setTarget(this);
  }

  applyEffect(effect, dmg) {
    if (!this.alive || !effect?.poison) return;
    const { ticks, every, ratio } = effect.poison;
    const per = Math.max(1, Math.round(dmg * ratio));
    this.scene.time.addEvent({ delay: every, repeat: ticks - 1, callback: () => {
      if (!this.alive) return;
      this.scene.net.send('event:hit', { mobId: this.mobId, dmg: per });
      this.scene.combat.popupText(this.x, this.y - this.frame.height, `${per}`, '#58d68d', 7);
    } });
  }

  /** server แจ้งว่าตายแล้ว */
  kill() {
    if (!this.alive) return;
    this.state = 'dead';
    this.body.enable = false;
    [this.hpBg, this.hpBar, this.label, this.aura].forEach((o) => o.setVisible(false));
    this.playA('die', true);
    this.scene.combat.burst(this.x, this.y - 12, 0xe67e22, 12);
    this.scene.tweens.add({ targets: this, alpha: 0, delay: 500, duration: 400, onComplete: () => this.destroy() });
  }

  destroy(fromScene) {
    [this.hpBg, this.hpBar, this.label, this.aura].forEach((o) => o?.destroy());
    super.destroy(fromScene);
  }
}
