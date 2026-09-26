// ============================================================
//  Dungeon – สุสานใต้ดิน (ดันเจี้ยนปาร์ตี้) ฝั่ง client
//  ▸ แสดงผีจาก server (DungeonMob) · แถบระลอก/เวลา · ส่ง dg:hit ตอนตี · รางวัล
//  ▸ ห้องแยกต่อปาร์ตี้ (instId) → ผู้เล่นห้องอื่นถูกซ่อน
// ============================================================
import { WORLD } from '/shared/constants.js';
import { MAPS } from '/shared/data/maps.js';
import { MONSTERS } from '/shared/data/monsters.js';
import { ITEMS } from '/shared/data/items.js';
import { DUNGEON, DUNGEON_TIER_IDS } from '/shared/data/dungeon.js';
import { makeText, rand } from './util.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DG = MAPS.dungeon;

/** ผีในดันเจี้ยน (ตำแหน่ง/HP จาก server) */
class DungeonMob extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, m) {
    const [mid, type, x, y, hp, maxHp, , dir, atkSeq, boss] = m;
    const def = MONSTERS[type], key = `mon_${def.art || type}`;
    super(scene, x, y, key, 'walk_0');
    this.key = key; this.mid = mid; this.type = type; this.boss = !!boss;
    this.def = { ...def, nameTh: boss ? `👑 ${def.nameTh}` : def.nameTh, hp: maxHp };
    this.hp = hp; this.serverX = x; this.serverY = y; this.atkSeq = atkSeq;
    this.isFlyer = true; this.isDungeonMob = true; this.state = 'alive';
    scene.add.existing(this); scene.physics.add.existing(this);
    this.body.setAllowGravity(false).setImmovable(true);
    this.setOrigin(0.5, 1).setDepth(8);
    if (boss) this.setScale(1.7).setTint(0xd7bde2); else this.setTint(0xc8b6d8);
    const fw = this.frame.width, fh = this.frame.height;
    this.body.setSize(Math.round(fw * 0.6), Math.round(fh * 0.85)).setOffset(Math.round(fw * 0.2), Math.round(fh * 0.15));
    this.setFlipX(dir < 0);
    this.hpBg = scene.add.rectangle(0, 0, boss ? 44 : 20, 3, 0x000000, 0.7).setDepth(9);
    this.hpBar = scene.add.rectangle(0, 0, boss ? 44 : 20, 3, boss ? 0xf39c12 : 0xaf7ac5).setOrigin(0, 0.5).setDepth(9);
    this.label = makeText(scene, 0, 0, `Lv.${def.level} ${this.def.nameTh}`, { fontSize: boss ? '8px' : '6px', color: boss ? '#f9e79f' : '#d2b4de' }).setOrigin(0.5).setDepth(9);
    this.setAlpha(0); scene.tweens.add({ targets: this, alpha: 1, duration: 400 });
    this.playA('walk');
  }
  get alive() { return this.state === 'alive'; }
  get defStats() { return { def: this.def.def, eva: this.def.eva }; }
  playA(name, force = false) { const k = `${this.key}:${name}`; if (this.scene.anims.exists(k) && (force || this.anims.currentAnim?.key !== k)) this.play(k); }
  setServer(m) {
    const [, , x, y, hp, maxHp, atk, dir, atkSeq] = m;
    this.serverX = x; this.serverY = y; this.hp = Math.min(this.hp, hp); this.def.hp = maxHp;
    this.setFlipX(dir < 0);
    if (atkSeq !== this.atkSeq) { this.atkSeq = atkSeq; this.playA('attack', true); }
    else if (!atk && !(this.anims.currentAnim?.key.endsWith(':attack') && this.anims.isPlaying)) this.playA('walk');
  }
  update(time) {
    if (!this.alive) return;
    this.x += (this.serverX - this.x) * 0.25;
    this.y += (this.serverY - this.y) * 0.25;
    this.body.updateFromGameObject?.();
    const h = this.displayHeight, bw = this.boss ? 44 : 20;
    this.hpBg.setPosition(this.x, this.y - h - 3);
    this.hpBar.setPosition(this.x - bw / 2, this.y - h - 3).setSize(bw * Math.max(0, this.hp / this.def.hp), 3);
    this.label.setPosition(this.x, this.y - h - 9);
  }
  hitOnline(meta) {
    if (!this.alive || !this.scene.net?.online) return false;
    this.scene.net.send('dg:hit', { mid: this.mid, sk: meta.sk || null, combo: !!meta.combo });
    return true;
  }
  takeHit(result, dir, knock, fromServer) {
    if (!this.alive) return;
    this.scene.combat.popup(this.x, this.y - this.displayHeight, result);
    if (!result.hit) return;
    this.hp = Math.max(1, this.hp - result.dmg);
    if (result.stun) { this.scene.combat.popupText(this.x, this.y - this.displayHeight - 6, 'มึนงง!', '#85c1e9', 7); }
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(60, () => this.alive && this.clearTint().setTint(this.boss ? 0xd7bde2 : 0xc8b6d8));
    this.scene.ui?.setTarget(this);
  }
  applyEffect() {}
  kill() {
    if (!this.alive) return;
    this.state = 'dead';
    this.body.enable = false;
    [this.hpBg, this.hpBar, this.label].forEach((o) => o.setVisible(false));
    this.playA('die', true);
    this.scene.combat.burst(this.x, this.y - 12, 0xaf7ac5, this.boss ? 30 : 12);
    this.scene.tweens.add({ targets: this, alpha: 0, delay: 600, duration: 400, onComplete: () => this.destroy() });
  }
  destroy(fromScene) { [this.hpBg, this.hpBar, this.label].forEach((o) => o?.destroy()); super.destroy(fromScene); }
}

export class Dungeon {
  constructor(scene) {
    this.scene = scene;
    this.mobs = new Map();
    this.instId = 0;
    this.state = null;
    this.bind();
    this.buildScene();
  }
  get active() { return !!this.instId; }
  get bossPhase() { return this.state?.state === 'boss'; }
  get net() { return this.scene.net; }
  get ui() { return this.scene.ui; }

  /** ฉากสุสานใต้ดิน: ผนังหิน โลงศพ เทียน (วาดด้วยโค้ด) */
  buildScene() {
    const s = this.scene, gy = WORLD.groundY, g = s.add.graphics().setDepth(1);
    g.fillStyle(0x2c2338, 1).fillRect(DG.minX - 40, 0, DG.maxX - DG.minX + 80, gy);              // ผนังมืด
    for (let x = DG.minX; x < DG.maxX; x += 26) for (let y = 40; y < gy; y += 18) g.fillStyle(0x3a2f4a, 0.5).fillRect(x + (y % 36 ? 0 : 13), y, 24, 16);   // อิฐ
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let x = DG.minX + 120; x < DG.maxX - 60; x += 150 + rnd() * 120) {                        // โลงศพ + เทียน
      g.fillStyle(0x5d4037, 1).fillRect(x, gy - 22, 34, 22).fillStyle(0x3e2723, 1).fillRect(x + 3, gy - 19, 28, 3);
      g.fillStyle(0xf4d03f, 1).fillRect(x + 40, gy - 10, 2, 10);
      const fl = s.add.circle(x + 41, gy - 12, 3, 0xf39c12, 0.9).setDepth(2).setBlendMode(Phaser.BlendModes.ADD);
      s.tweens.add({ targets: fl, scale: { from: 0.7, to: 1.3 }, alpha: { from: 0.6, to: 1 }, duration: 300 + rnd() * 200, yoyo: true, repeat: -1 });
    }
    for (let x = DG.minX + 60; x < DG.maxX; x += 220) { g.fillStyle(0x4a3f5c, 1).fillRect(x, 20, 14, gy - 20).fillRect(x - 4, 16, 22, 6); }   // เสา
    makeText(s, DG.minX + 300, gy - 108, '🕯️ สุสานใต้ดิน', { fontSize: '9px', color: '#d2b4de' }).setOrigin(0.5).setDepth(2);
    makeText(s, DG.minX + 300, gy - 96, 'ปกป้องกันและกัน · ตายหมดทีม = ล้มเหลว', { fontSize: '6px', color: '#bfa8d8' }).setOrigin(0.5).setDepth(2);
    // ประตูออก
    makeText(s, DG.gates[0].x + 6, gy - 66, '← ออกจากสุสาน (กด F)', { fontSize: '7px', color: '#76d7c4' }).setOrigin(0, 0.5).setDepth(2);
  }

  bind() {
    const s = this.scene, n = s.net;
    n.on('dg:start', ({ id, tier, x, endsIn, members }) => {
      this.instId = id; this.state = { tier, wave: 0, left: endsIn, state: 'intro', mobs: [] };
      this.clearMobs();
      s.warpLocal(DG, x);
      s.ui.banner(`🕯️ สุสานใต้ดิน · ระดับ${DUNGEON.tiers[tier]?.nameTh}`);
      s.ui.toast(`ทีม: ${members.join(', ')} · ผีจะมา ${DUNGEON.waves} ระลอก + บอส ภายใน 10 นาที`, '', 6000);
      s.sfx.play('bossWarn');
      this.remotesVis();
    })
      .on('dg:state', (st) => this.apply(st))
      .on('dg:wave', ({ wave, boss, count, nameTh }) => { s.ui.banner(boss ? `👑 บอส: ${nameTh}` : `ระลอกที่ ${wave}/${DUNGEON.waves} · ผี ${count} ตัว`); s.sfx.play(boss ? 'bossRoar' : 'bossWarn'); })
      .on('dg:cleared', ({ wave }) => s.ui.toast(`✔ ผ่านระลอกที่ ${wave}! เตรียมรับระลอกถัดไป…`))
      .on('dg:dmg', (d) => { const m = this.mobs.get(d.mid); if (m) s.combat.onServerDamage(m, { ...d, dir: 1, knock: 0 }); })
      .on('dg:die', ({ mid }) => { this.mobs.get(mid)?.kill(); this.mobs.delete(mid); s.sfx.play('ghostDie'); })
      .on('dg:exp', ({ exp, ups, x }) => { s.combat.popupText(x ?? s.player.x, WORLD.groundY - 60, `+${exp} EXP`, '#d7bde2'); s.combat.afterGrant({ ups }); })
      .on('dg:slam', ({ x }) => {
        const gy = WORLD.groundY, r = s.add.ellipse(x, gy - 1, 220, 10, 0xe74c3c, 0.35).setDepth(6);
        s.tweens.add({ targets: r, alpha: { from: 0.15, to: 0.55 }, duration: 120, yoyo: true, repeat: 2, onComplete: () => { r.destroy(); s.cameras.main.shake(220, 0.012); s.combat.burst(x, gy - 6, 0xe67e22, 24); } });
      })
      .on('dg:end', (r) => {
        this.clearMobs();
        if (!r.success) { s.ui.banner('💀 ล้มเหลว… ดันเจี้ยนสิ้นสุด'); s.sfx.play('die'); s.ui.toast('ทีมพ่ายแพ้/หมดเวลา — จะถูกส่งกลับหมู่บ้านใน 7 วิ', 'warn', 6000); return; }
        s.ui.banner('🏆 พิชิตสุสานใต้ดิน!'); s.sfx.play('victory');
        const items = (r.items || []).map((it) => `${ITEMS[it.id]?.icon}${ITEMS[it.id]?.nameTh} x${it.qty}`).join(', ');
        s.ui.toast(`🏆 รางวัล (${r.secs} วิ): +${r.exp} EXP · ฿${r.gold} · ${items}`, '', 9000);
        for (const it of r.items || []) if (it.rare) s.ui.banner(`✨ ได้รับ ${ITEMS[it.id]?.nameTh}!`);
        s.combat.afterGrant(r);
      })
      .on('dg:exit', ({ x }) => { this.instId = 0; this.state = null; this.clearMobs(); s.warpLocal(MAPS.village, x); this.remotesVis(); $('#dg-bar')?.classList.add('hidden'); });
  }

  remotesVis() { this.scene.remotes?.forEach((r) => r.update?.()); }

  apply(st) {
    if (!this.instId || st.id !== this.instId) return;
    this.state = st;
    const seen = new Set();
    for (const m of st.mobs) {
      seen.add(m[0]);
      let mob = this.mobs.get(m[0]);
      if (!mob) { mob = new DungeonMob(this.scene, m); this.mobs.set(m[0], mob); this.scene.monsters.add(mob); }
      mob.setServer(m);
    }
    for (const [id, mob] of this.mobs) if (!seen.has(id)) { mob.kill(); this.mobs.delete(id); }
  }
  clearMobs() { this.mobs.forEach((m) => m.kill()); this.mobs.clear(); }
  onDisconnect() { this.instId = 0; this.state = null; this.clearMobs(); $('#dg-bar')?.classList.add('hidden'); }

  /** หลวงพ่อทอง: เลือกระดับ */
  openPanel() {
    const s = this.scene, c = s.player.char;
    if (!this.net.online) return this.ui.toast('ดันเจี้ยนต้องออนไลน์', 'warn');
    this.ui.closeAll();
    this.ui.toggle('dg-panel', true);
    const party = s.social?.party;
    const lead = !party || party.leader === this.net.selfId;
    $('#dg-party').textContent = party ? `ปาร์ตี้ ${party.members.length} คน: ${party.members.map((m) => m.name).join(', ')}${lead ? '' : ' · (หัวหน้าปาร์ตี้ต้องเป็นคนพาเข้า)'}` : 'ไปคนเดียว (ตั้งปาร์ตี้ 2–4 คนจะง่ายกว่าและได้ EXP ทุกคน)';
    this.net.socket.emit('dg:info', {}, (info) => {
      const cd = info?.cooldown || 0;
      $('#dg-tiers').innerHTML = DUNGEON_TIER_IDS.map((id) => {
        const T = DUNGEON.tiers[id], R = T.rewards, lock = c.level < T.minLv;
        return `<div class="dg-tier ${id} ${lock ? 'lock' : ''}"><b>${T.nameTh}</b><small>Lv.${T.minLv}+ · ผีระดับ Lv.${T.level} · บอส: ${esc(T.bossNameTh)}</small>
          <small>🎁 ${R.exp.toLocaleString()} EXP · ฿${R.gold.toLocaleString()} · โอกาสได้อุปกรณ์ Lv.${R.gearLv} ${Math.round(R.gearChance * 100)}%${R.legendChance ? ` · ของตำนาน ${Math.round(R.legendChance * 100)}%` : ''}</small>
          <button class="btn primary sm" data-dg="${id}" ${lock || !lead || cd > 0 ? 'disabled' : ''}>${lock ? `🔒 Lv.${T.minLv}` : cd > 0 ? `รอ ${Math.ceil(cd / 1000)} วิ` : 'เข้าดันเจี้ยน'}</button></div>`;
      }).join('');
      $('#dg-tiers').querySelectorAll('[data-dg]').forEach((b) => (b.onclick = () => {
        b.disabled = true;
        this.net.socket.emit('dg:enter', { tier: b.dataset.dg }, (r) => { if (!r?.ok) { this.ui.toast(r?.msg || 'เข้าไม่ได้', 'warn'); b.disabled = false; } else this.ui.closeAll(); });
      }));
    });
  }

  leave() { if (this.active) this.net.send('dg:leave'); }

  update(time) {
    this.mobs.forEach((m) => m.update(time));
    const bar = $('#dg-bar');
    if (!bar) return;
    const on = this.active && this.state;
    bar.classList.toggle('hidden', !on);
    if (!on || time - (this.barAt || 0) < 200) return;
    this.barAt = time;
    const st = this.state, sec = Math.max(0, Math.ceil(st.left / 1000));
    $('#dg-wave').textContent = st.state === 'boss' ? `👑 บอส · ผี ${this.mobs.size} ตัว` : st.state === 'intro' ? 'เตรียมตัว…' : `ระลอก ${st.wave}/${DUNGEON.waves} · ผี ${this.mobs.size} ตัว`;
    $('#dg-time').textContent = `⏱ ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    $('#dg-fill').style.width = `${Math.max(0, st.left / DUNGEON.timeLimitMs * 100)}%`;
  }
}
