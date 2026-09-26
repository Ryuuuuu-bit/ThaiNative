// ============================================================
//  Forest – Map 2: ป่าผีดุ
//  ▸ ค่ายพักพราน (กองไฟฟื้นพลัง + จุดเกิดใหม่)   ▸ พรานบุญ: ค่าหัวรายวัน
//  ▸ จุดเก็บสมุนไพร                                ▸ หีบสมบัติโบราณสุ่มเกิด
// ============================================================
import { ITEMS } from '/shared/data/items.js';
import { MONSTERS } from '/shared/data/monsters.js';
import { WORLD } from '/shared/constants.js';
import { MAPS, HUNT_MAPS, mapAt } from '/shared/data/maps.js';
import { HERB_RESPAWN_MS, GATHER_MS, CHEST } from '/shared/data/village.js';
import { CAMP, HERB_NODES } from '/shared/data/npcs.js';
import { bountyList } from './Inventory.js';
import { makeText, itemIcon, uiIcon } from './util.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class Forest {
  constructor(scene) {
    this.scene = scene;
    this.nodes = [];
    this.chest = null;
    this.gather = null;
    this.buildCamp();
    this.buildHerbs();
    scene.time.addEvent({ delay: CHEST.everyMs, loop: true, callback: () => this.spawnChest() });
    scene.time.delayedCall(20000, () => this.spawnChest());
    $('#bounty-list').onclick = (e) => {
      const b = e.target.closest('button[data-bounty]');
      if (b) this.claim(+b.dataset.bounty);
    };
  }

  get char() { return this.scene.player.char; }
  get econ() { return this.scene.econ; }

  // ------------------------------------------------------------
  //  ค่ายพักพราน
  // ------------------------------------------------------------
  get npcX() { return CAMP.npcX; }

  buildCamp() {
    const s = this.scene, gy = WORLD.groundY;
    // กองไฟจุดพักทุกแมพ (ฟื้นพลังเร็ว · จุดฟื้นเมื่อตาย · ผีไม่ไล่เข้ามา)
    for (const m of [...HUNT_MAPS, MAPS.arena]) {
      const fx = m.fireX ?? m.respawnX;
      if (s.textures.exists('campfire')) s.add.image(fx, gy + 3, 'campfire').setOrigin(0.5, 1).setDepth(6).setScale(0.6);
      const glow = s.add.circle(fx, gy - 10, 34, 0xff9f43, 0.12).setDepth(5.8).setBlendMode(Phaser.BlendModes.ADD);
      s.tweens.add({ targets: glow, scale: { from: 0.92, to: 1.08 }, alpha: { from: 0.1, to: 0.2 }, duration: 380, yoyo: true, repeat: -1 });
      s.add.particles(fx, gy - 8, 'particle', {
        x: { min: -4, max: 4 }, speedY: { min: -30, max: -14 }, speedX: { min: -4, max: 4 }, lifespan: 700,
        scale: { start: 0.45, end: 0 }, tint: [0xf39c12, 0xe74c3c, 0xf7dc6f], frequency: 110, blendMode: 'ADD',
      }).setDepth(6.1);
    }
    if (s.textures.exists('bounty_board')) s.add.image(CAMP.npcX + 30, gy + 3, 'bounty_board').setOrigin(0.5, 1).setDepth(5.9).setScale(0.75);
    // พรานบุญ
    const key = s.textures.exists('npc_phran_bun') ? 'npc_phran_bun' : 'npc_maekha';
    this.npc = s.add.sprite(CAMP.npcX, gy, key, 'idle_0').setOrigin(0.5, 1).setDepth(6).setFlipX(true);
    if (key === 'npc_maekha') this.npc.setTint(0x82e0aa);
    this.npc.play(`${key}:idle`);
    makeText(s, CAMP.npcX, gy - this.npc.height - 4, 'พรานบุญ', { fontSize: '8px', color: '#82e0aa' }).setOrigin(0.5, 1).setDepth(6);
    makeText(s, CAMP.npcX, gy - this.npc.height - 17, '[ค่าหัวรายวัน]', { fontSize: '6px', color: '#ecf0f1' }).setOrigin(0.5, 1).setDepth(6);
  }

  nearFire(x) { const m = mapAt(x); return m.fireX != null && Math.abs(x - m.fireX) < 70; }

  // ------------------------------------------------------------
  //  สมุนไพร
  // ------------------------------------------------------------
  buildHerbs() {
    const s = this.scene;
    HERB_NODES.forEach((n, idx) => {
      const y = (n.y ?? WORLD.groundY) + 2;
      const key = `ico_it_${n.item}`;
      const spr = s.textures.exists(key) ? s.add.image(n.x, y, key).setOrigin(0.5, 1).setDisplaySize(20, 20)
        : s.add.circle(n.x, y - 5, 5, 0x58d68d).setStrokeStyle(1, 0x1e8449);          // ภาพยังไม่มา → จุดสีเขียว
      spr.setDepth(6.2);
      const spark = s.add.circle(n.x, y - 12, 2, 0xf9e79f, 0.9).setDepth(6.3).setBlendMode(Phaser.BlendModes.ADD);
      s.tweens.add({ targets: spark, y: y - 18, alpha: { from: 0.9, to: 0.2 }, duration: 900, yoyo: true, repeat: -1, delay: Math.random() * 800 });
      this.nodes.push({ ...n, idx, y, spr, spark, readyAt: 0 });
    });
  }

  nodeAt(x, y) {
    const now = Date.now();
    return this.nodes.find((n) => Math.abs(n.x - x) < 22 && Math.abs(n.y - y) < 30 && now >= n.readyAt && (!n.night || this.scene.clock.night)) || null;
  }

  startGather(node) {
    const s = this.scene;
    if (this.gather) return;
    this.gather = { node, until: s.time.now + GATHER_MS };
    s.player.setVelocityX(0);
    $('#fish-ui').classList.remove('hidden');
    $('#fish-bar').classList.remove('hidden');
    $('#fish-zone').style.width = '0';
    $('#fish-msg').textContent = `กำลังเก็บ ${ITEMS[node.item].nameTh}…`;
    s.sfx.play('click');
  }

  cancelGather(msg) {
    if (!this.gather) return;
    this.gather = null;
    $('#fish-ui').classList.add('hidden');
    if (msg) this.scene.ui.toast(msg, 'warn');
  }

  finishGather() {
    const s = this.scene, n = this.gather.node;
    this.gather = null;
    $('#fish-ui').classList.add('hidden');
    n.readyAt = Date.now() + HERB_RESPAWN_MS;
    this.econ.act('gather', { node: n.idx }).then((r) => {
      if (!r.ok) { n.readyAt = 0; return r.msg && s.ui.toast(r.msg, 'warn'); }
      s.combat.popupText(n.x, n.y - 24, `+${ITEMS[r.item].nameTh} x${r.qty}`, '#82e0aa', 8);
      s.combat.burst(n.x, n.y - 8, 0x82e0aa, 8);
      s.sfx.play('coin');
      s.combat.afterGrant(r);
      s.saveSoon();
    });
  }

  // ------------------------------------------------------------
  //  หีบสมบัติโบราณ
  // ------------------------------------------------------------
  spawnChest() {
    const s = this.scene;
    if (this.chest) return;
    const m = s.map;
    if (!m?.mon) return;                                            // เกิดเฉพาะแมพล่าผีที่เรายืนอยู่
    const plats = s.platforms.getChildren().filter((p) => p.x > m.safeEndX && p.x < m.maxX - 60);
    if (!plats.length) return;
    const p = plats[Math.floor(Math.random() * plats.length)];
    const x = p.x + 8 + Math.random() * Math.max(1, p.width - 16), y = p.y;
    const spr = s.textures.exists('chest_closed') ? s.add.image(x, y + 1, 'chest_closed').setOrigin(0.5, 1).setDisplaySize(22, 22)
      : s.add.rectangle(x, y, 14, 10, 0x8e5b2b).setOrigin(0.5, 1).setStrokeStyle(1, 0xf1c40f);
    spr.setDepth(6.2);
    const glow = s.add.circle(x, y - 8, 14, 0xf7dc6f, 0.18).setDepth(6.1).setBlendMode(Phaser.BlendModes.ADD);
    s.tweens.add({ targets: glow, scale: { from: 0.8, to: 1.2 }, alpha: { from: 0.1, to: 0.3 }, duration: 700, yoyo: true, repeat: -1 });
    this.chest = { x, y, spr, glow, until: s.time.now + CHEST.lifeMs };
    s.ui.toast('✨ มีหีบสมบัติโบราณโผล่ขึ้นมาในป่า! (ดูจุดสีทองบนมินิแมป)');
  }

  openChest() {
    const s = this.scene, ch = this.chest;
    if (!ch) return;
    this.animUntil = s.time.now + 700;                                       // ท่าย่อตัวเปิดหีบ
    this.chest = null;
    if (s.textures.exists('chest_open')) ch.spr.setTexture('chest_open').setDisplaySize(22, 22);
    s.tweens.add({ targets: [ch.spr, ch.glow], alpha: 0, delay: 1200, duration: 600, onComplete: () => { ch.spr.destroy(); ch.glow.destroy(); } });
    this.econ.act('chest').then((r) => {
      if (!r.ok) return s.ui.toast(r.msg || 'หีบว่างเปล่า', 'warn');
      s.sfx.play('levelup');
      s.combat.burst(ch.x, ch.y - 10, 0xf1c40f, 20);
      s.combat.popupText(ch.x, ch.y - 30, `+฿${r.gold}`, '#f7dc6f', 10);
      s.ui.toast(`🎁 หีบสมบัติ: ฿${r.gold}${r.items.map((it) => ` · ${ITEMS[it.id].icon}${ITEMS[it.id].nameTh} x${it.qty}`).join('')}`);
      s.combat.afterGrant(r);
      s.saveSoon();
    });
  }

  // ------------------------------------------------------------
  //  ค่าหัวรายวัน (พรานบุญ)
  // ------------------------------------------------------------
  bounties() { return bountyList(this.char); }

  openBounty() {
    const s = this.scene;
    s.ui.closeAll();
    s.ui.toggle('bounty-panel', true);
    this.renderBounty();
  }

  renderBounty() {
    const list = this.bounties();
    $('#bounty-list').innerHTML = list.map((b, i) => {
      const m = MONSTERS[b.mon], done = b.prog >= b.n;
      const btn = b.claimed ? '<span class="meta">✔ รับแล้ว</span>' : done ? `<button data-bounty="${i}" class="gold">รับค่าหัว</button>` : `<span class="meta">${b.prog}/${b.n}</span>`;
      return `<div class="quest ${b.claimed ? 'done' : done ? 'ready' : 'active'}"><div><b>${uiIcon('wanted', '📜')} ${esc(m.nameTh)} <span class="meta">Lv.${m.level}</span></b>
        <small>🎯 ปราบ ${b.n} ตัว ที่ ${esc(MAPS[m.mapId]?.nameTh ?? '')} ${b.claimed ? '' : `<b>${Math.min(b.prog, b.n)}/${b.n}</b>`}</small><small>🎁 ${b.exp} EXP · ฿${b.gold}</small></div>${btn}</div>`;
    }).join('');
  }

  claim(i) {
    const s = this.scene;
    this.econ.act('bounty', { i }).then((r) => {
      if (!r.ok) return r.msg && s.ui.toast(r.msg, 'warn');
      s.sfx.play('victory');
      s.ui.toast(r.msg);
      s.combat.afterGrant(r);
      this.renderBounty();
      s.ui.result({ ok: true });
    });
  }

  // ------------------------------------------------------------
  update(time) {
    const s = this.scene, p = s.player;
    if (this.gather) {
      if (!p.alive || Math.abs(p.body.velocity.x) > 5) return this.cancelGather('หยุดเก็บสมุนไพร');
      const t = 1 - (this.gather.until - time) / GATHER_MS;
      $('#fish-needle').style.left = `${Math.min(100, t * 100)}%`;
      $('#fish-zone').style.width = `${Math.min(100, t * 100)}%`;
      if (time >= this.gather.until) this.finishGather();
    }
    const now = Date.now();
    for (const n of this.nodes) {
      const ok = now >= n.readyAt && (!n.night || s.clock.night);
      if (n.spr.visible !== ok) { n.spr.setVisible(ok); n.spark.setVisible(ok); }
    }
    if (this.chest && (time > this.chest.until || mapAt(this.chest.x) !== s.map)) {
      const ch = this.chest; this.chest = null;
      s.tweens.add({ targets: [ch.spr, ch.glow], alpha: 0, duration: 800, onComplete: () => { ch.spr.destroy(); ch.glow.destroy(); } });
    }
  }
}
