// ============================================================
//  Invasion – อีเวนต์ "ผีห่าบุกหมู่บ้าน" ฝั่ง client
//  แสดงผีจาก server, แถบ HP ศาลพระภูมิ, รับดาเมจจากผี, รางวัล
// ============================================================
import { EventMob } from '../entities/EventMob.js';
import { ITEMS } from '/shared/data/items.js';
import { addItem } from './Inventory.js';
import { rand } from './util.js';

const $ = (s) => document.querySelector(s);

export class Invasion {
  constructor(scene) {
    this.scene = scene;
    this.mobs = new Map();
    this.state = { active: false, shrineHp: 1, shrineMax: 1, wave: 0, maxWaves: 5, shopClosedIn: 0 };
    this.bind();
  }

  get player() { return this.scene.player; }
  get active() { return this.state.active; }
  get shopClosed() { return this.state.active || (this.shopClosedUntil || 0) > performance.now(); }
  get shopClosedMin() { return Math.ceil(((this.shopClosedUntil || 0) - performance.now()) / 60000); }

  bind() {
    const s = this.scene, n = s.net;
    n.on('event:state', (st) => this.apply(st))
      .on('event:warn', () => { s.ui.banner('🐕 เสียงหมาหอน… ผีห่ากำลังมา!'); s.sfx.play('howl'); })
      .on('event:start', () => {
        s.ui.banner('🔥 ผีห่าบุกหมู่บ้าน! ปกป้องศาลพระภูมิ!');
        s.sfx.play('eventHorn');
        s.cameras.main.shake(400, 0.006);
      })
      .on('event:wave', ({ wave, maxWaves }) => { if (wave > 1) s.ui.banner(`ระลอกที่ ${wave}/${maxWaves}`); s.sfx.play('bossWarn'); })
      .on('event:cleared', ({ wave }) => s.ui.toast(`✔ ป้องกันระลอกที่ ${wave} ได้! เตรียมรับระลอกถัดไป…`))
      .on('event:mobAtk', ({ mobId, targetId, dmg, x }) => {
        this.mobs.get(mobId)?.attack();
        if (targetId !== n.selfId || !this.player.alive) return;
        const d = this.player.combatStats();
        this.player.takeHit({ hit: true, crit: false, dmg: Math.max(1, Math.round(dmg * rand(0.9, 1.1) - d.def * 0.5)) }, x);
      })
      .on('event:shrineHit', ({ mobId, hp }) => {
        this.mobs.get(mobId)?.attack();
        this.state.shrineHp = hp;
        const sh = s.shrineSprite;
        if (sh && Math.abs(this.player.x - sh.x) < 500) {
          sh.setTintFill(0xff7043); s.time.delayedCall(90, () => sh.clearTint());
          s.combat.burst(sh.x, sh.y - 24, 0xe67e22, 6);
        }
      })
      .on('event:dmg', ({ mobId, id, dmg, crit, hp }) => {
        const m = this.mobs.get(mobId);
        if (!m) return;
        m.hp = Math.min(m.hp, hp);
        if (id !== n.selfId && s.settings?.damageNumbers !== false && Math.abs(m.x - this.player.x) < 400)
          s.combat.popupText(m.x + rand(-6, 6), m.y - m.frame.height, crit ? `${dmg}!` : `${dmg}`, crit ? '#f5b041' : '#d5d8dc', 7);
      })
      .on('event:mobDie', ({ mobId }) => { this.mobs.get(mobId)?.kill(); this.mobs.delete(mobId); s.sfx.play('ghostDie'); })
      .on('event:kill', ({ exp, gold, x }) => {
        const c = this.player.char;
        c.gold += gold;
        s.combat.popupText(x, 200, `+${exp} EXP  +฿${gold}`, '#f5b041');
        s.combat.grantExp(exp);
      })
      .on('event:reward', (r) => {
        const c = this.player.char;
        c.gold += r.gold;
        r.items.forEach((it) => addItem(c, it.id, it.qty));
        s.combat.popupText(this.player.x, this.player.y - 60, `+${r.exp} EXP  +฿${r.gold}`, '#f7dc6f', 10);
        s.combat.grantExp(r.exp);
        s.ui.toast(`🏆 รางวัลปกป้องหมู่บ้าน (${r.share}% ของดาเมจ): ${r.items.map((it) => `${ITEMS[it.id]?.icon}${ITEMS[it.id]?.nameTh} x${it.qty}`).join(', ')}`);
        s.saveSoon();
      })
      .on('event:end', ({ success, shopClosedMs }) => {
        this.clearMobs();
        this.state.active = false;
        if (success) { s.ui.banner('🏆 ปกป้องหมู่บ้านสำเร็จ!'); s.sfx.play('victory'); }
        else {
          this.shopClosedUntil = performance.now() + shopClosedMs;
          s.ui.banner('💔 ศาลพระภูมิถูกทำลาย… ร้านยายติ๋มปิด 10 นาที');
          s.sfx.play('die');
        }
      });
  }

  /** snapshot จาก server */
  apply(st) {
    if (!st) return;
    this.state = st;
    if (st.shopClosedIn) this.shopClosedUntil = performance.now() + st.shopClosedIn;
    const seen = new Set();
    for (const m of st.mobs) {
      seen.add(m.id);
      let mob = this.mobs.get(m.id);
      if (!mob) {
        mob = new EventMob(this.scene, m);
        this.mobs.set(m.id, mob);
        this.scene.monsters.add(mob);
      }
      mob.setServer(m);
    }
    for (const [id, mob] of this.mobs) if (!seen.has(id)) { mob.kill(); this.mobs.delete(id); }
  }

  clearMobs() { this.mobs.forEach((m) => m.kill()); this.mobs.clear(); }

  update() {
    const st = this.state;
    $('#event-bar').classList.toggle('hidden', !st.active);
    $('#event-bar').classList.toggle('lower', !$('#boss-bar').classList.contains('hidden'));
    if (st.active) {
      $('#ev-wave').textContent = `ระลอก ${st.wave}/${st.maxWaves} · ผี ${this.mobs.size} ตัว`;
      $('#ev-fill').style.width = `${Math.max(0, (st.shrineHp / st.shrineMax) * 100)}%`;
      $('#ev-hp').textContent = `ศาลพระภูมิ ${Math.max(0, st.shrineHp).toLocaleString()} / ${st.shrineMax.toLocaleString()}`;
    }
    // ยายติ๋มหลบหนีระหว่างอีเวนต์ / ร้านปิด
    const npc = this.scene.npc;
    if (npc) npc.setVisible(!this.shopClosed);
    if (this.scene.npcLabel) this.scene.npcLabel.setVisible(!this.shopClosed);
  }
}
