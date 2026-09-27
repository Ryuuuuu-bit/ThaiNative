// ============================================================
//  TopDownScene – โหมดทดลอง "กรุงศรีอยุธยา" (มุมมองบนเฉียง เดิน 8 ทิศ คลิกเดิน/คลิกตี)
//  ▸ ต้นแบบ 1 แมพ: เกาะเมืองอยุธยา (กำแพง/เจดีย์/ปรางค์/ตลาด/ท่าน้ำ) + ทุ่งล่าผีใต้แม่น้ำ
//  ▸ เล่นแบบออฟไลน์ ไม่บันทึกความคืบหน้า (ไว้ดูฟีลก่อนตัดสินใจย้ายทั้งเกม)
//  ▸ ภาพตัวละคร/ผี ใช้สไปรต์ด้านข้างชุดเดิมไปก่อน (รอสไปรต์ 8 ทิศจาก PixelLab)
// ============================================================
import { MONSTERS } from '/shared/data/monsters.js';
import { getDerived } from '/shared/character.js';
import { gainExp } from '/shared/charmodel.js';
import { expToNext } from '/shared/stats.js';
import { bakeCharacter } from '../gfx/SpriteFactory.js';
import { bakeFx, popupNumber, hitSpark, yantCircle, squash } from '../gfx/Fx.js';
import { makeText } from '../systems/util.js';
import { sound } from '../systems/Sound.js';
import { loadSettings } from '../systems/Settings.js';
import { TILE, MAP_W, MAP_H, T, RIVER, bakeTileset, bakeProps, buildLayout } from '../topdown/AyutthayaMap.js';
import { dirFromVector, playDir, registerDir8, texKey } from '../topdown/Dir8.js';
import { ALL_ASSETS } from '/shared/data/td_assets.js';

const OUTFIT_IDS = ['mohom', 'ruenton', 'jongkraben', 'rajpatan', 'chaona', 'silk', 'warrior', 'hunter', 'isan', 'mahadlek'];

const $ = (s) => document.querySelector(s);
const SPEED = 92;            // ความเร็วเดิน (px/วิ)
const ATK_RANGE = 26;        // ระยะตีประชิด
const ATK_CD = 650;          // คูลดาวน์โจมตี (ms)
const rand = (a, b) => a + Math.random() * (b - a);

export class TopDownScene extends Phaser.Scene {
  constructor() { super('ayutthaya'); }

  /** โหลดภาพ 8 ทิศที่มีแล้ว (client/assets/td/manifest.json เขียนโดยตัวนำเข้าภาพ PixelLab) – ไม่มีไฟล์ก็เล่นได้ด้วยภาพเดิม */
  preload() {
    this.load.json('td_manifest', '/assets/td/manifest.json');
    this.load.once('filecomplete-json-td_manifest', (_k, _t, data) => {
      for (const [id, anims] of Object.entries(data?.sprites || {})) for (const anim of anims) this.load.image(texKey(id, anim), `/assets/td/${id}/${anim}.png`);
      for (const id of data?.images || []) this.load.image(id, `/assets/td/${id}.png`);
    });
    this.load.on('loaderror', () => {});   // ยังไม่มี manifest/ภาพ → ข้าม
  }

  registerTdAssets() {
    for (const a of ALL_ASSETS) if (a.anims) registerDir8(this, { id: a.id, anims: a.anims });
  }

  create({ char }) {
    this.registerTdAssets();
    this.char = char;
    this.sfx = sound; this.settings = loadSettings(); this.sfx.applySettings(this.settings);
    this.physics.world.gravity.y = 0;
    bakeFx(this); bakeTileset(this); bakeProps(this);
    this.layout = buildLayout();
    this.buildMap();
    this.buildProps();
    this.buildPlayer();
    this.buildNpcs();
    this.buildMonsters();
    this.buildInput();
    this.buildHud();

    const cam = this.cameras.main;
    cam.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE).setZoom(1.5).startFollow(this.player, true, 0.12, 0.12).setRoundPixels(true);
    this.time.addEvent({ delay: 550, loop: true, callback: () => this.animateWater() });
    this.zone = null;
    this.tdToast('🏯 ยินดีต้อนรับสู่กรุงศรีอยุธยา · คลิกพื้นเพื่อเดิน คลิกผีเพื่อโจมตี (หรือ WASD)', 6000);
  }

  // ------------------------------------------------------------
  //  แมพ
  // ------------------------------------------------------------
  buildMap() {
    const { ground, solid } = this.layout;
    const map = this.make.tilemap({ data: ground, tileWidth: TILE, tileHeight: TILE });
    const tiles = map.addTilesetImage('td_tiles', 'td_tiles', TILE, TILE, 0, 0);
    this.groundLayer = map.createLayer(0, tiles, 0, 0).setDepth(0);
    this.map = map; this.solid = solid;
    // ชั้นชน: ไทล์ทึบ + รอยเท้าของประกอบ (static body ต่อช่อง – รวมแนวนอนเป็นแถบเพื่อลดจำนวน)
    this.blocks = this.physics.add.staticGroup();
    for (let y = 0; y < MAP_H; y++) {
      let x = 0;
      while (x < MAP_W) {
        if (!solid[y][x]) { x++; continue; }
        let x1 = x; while (x1 + 1 < MAP_W && solid[y][x1 + 1]) x1++;
        const w = (x1 - x + 1) * TILE;
        const r = this.add.rectangle(x * TILE + w / 2, y * TILE + TILE / 2, w, TILE).setVisible(false);
        this.physics.add.existing(r, true); this.blocks.add(r);
        x = x1 + 1;
      }
    }
    // เงาแม่น้ำ/ขอบเมือง: หมอกบาง ๆ ให้ดูมีระยะ
    this.add.rectangle(MAP_W * TILE / 2, (RIVER.y0 - 0.5) * TILE, MAP_W * TILE, TILE, 0x000000, 0.12).setDepth(0.5);
  }

  animateWater() {
    this.waterFlip = !this.waterFlip;
    this.groundLayer.forEachTile((t) => { if (t.index === T.WATER) t.index = T.WATER2; else if (t.index === T.WATER2) t.index = T.WATER; });
  }

  buildProps() {
    this.labels = [];
    for (const p of this.layout.props) {
      if (!this.textures.exists(p.key)) continue;
      const img = this.add.image(p.x, p.y, p.key).setOrigin(0.5, 1).setDepth(p.depth ?? p.y);
      if (p.flip) img.setFlipX(true);
      if (p.scale) img.setScale(p.scale);
      if (p.key !== 'boat' && p.key !== 'pr_reeds') this.add.ellipse(p.x, p.y - 1, img.displayWidth * 0.8, 7, 0x000000, 0.25).setDepth(0.6);   // เงาใต้ของ
      if (p.label) makeText(this, p.x, p.y - img.displayHeight - 3, p.label, { fontSize: '6px', color: '#f7dc6f' }).setOrigin(0.5, 1).setDepth(p.y + 1);
      if (p.warp) this.warpGate = { x: p.x, y: p.y };
    }
    // ป้ายชื่อย่านหลัก
    const zoneLabel = (tx, ty, text) => makeText(this, tx * TILE, ty * TILE, text, { fontSize: '8px', color: '#ffe9a6' }).setOrigin(0.5).setDepth(9000).setAlpha(0.85);
    zoneLabel(60, 12, '✦ วัดพระศรีสรรเพชญ์ ✦'); zoneLabel(60, 55, '⚔ ประตูเมืองใต้'); zoneLabel(60, 76, '🌾 ทุ่งนาบางปะอิน'); zoneLabel(30, 46, '🧺 ตลาดหัวรอ'); zoneLabel(40, 63, '⛵ ท่าน้ำวัดพนัญเชิง');
  }

  // ------------------------------------------------------------
  //  ผู้เล่น
  // ------------------------------------------------------------
  buildPlayer() {
    const c = this.char, key = bakeCharacter(this, c.appearance);
    const p = this.physics.add.sprite(60 * TILE, 57 * TILE, key, 'idle_0').setOrigin(0.5, 1).setDepth(57 * TILE);
    p.body.setSize(12, 8).setOffset((p.width - 12) / 2, p.height - 8);
    p.texKey = key; p.legacyKey = key; p.d8id = `hero_${c.appearance.gender}_${OUTFIT_IDS[c.appearance.outfit] || 'mohom'}`; p.dir = 'south'; p.facing = 1; p.state = 'idle'; p.path = []; p.target = null; p.nextAtk = 0; p.hp = c.hp; p.alive = true;
    p.play(`${key}:idle`);
    this.addShadow(p, 22);
    this.player = p;
    this.derived = getDerived(c);
    this.physics.add.collider(p, this.blocks);
    this.nameTag = makeText(this, 0, 0, c.name, { fontSize: '7px', color: '#fff3c4' }).setOrigin(0.5, 1).setDepth(99999);
    // ชนกับผี (ไม่ทะลุ)
    p.on('animationcomplete', (anim) => { if (anim.key.endsWith(':attack') || anim.key.endsWith(':hit')) { if (p.alive) { p.state = 'idle'; } } });
  }

  /** เงาวงรีใต้เท้า (top-down: อยู่ที่ตำแหน่งเท้าเสมอ ชั้นต่ำกว่าตัว) */
  addShadow(obj, w) {
    this.shadows = this.shadows || [];
    const img = this.add.image(obj.x, obj.y, 'fx_shadow').setDisplaySize(w, w * 0.4).setAlpha(0.55).setDepth(0.7);
    this.shadows.push({ img, obj, w });
  }

  playerAnim(name, restart = false) { const p = this.player; playDir(p, name, p.dir || 'south', restart); }

  // ------------------------------------------------------------
  //  NPC
  // ------------------------------------------------------------
  buildNpcs() {
    this.npcs = this.layout.npcs.map((n) => {
      const real = this.textures.exists(n.key), key = real ? n.key : 'npc_maekha';
      const spr = this.add.sprite(n.x, n.y, key, 'idle_0').setOrigin(0.5, 1).setDepth(n.y);
      spr.legacyKey = key; spr.d8id = n.key; playDir(spr, 'idle', 'south');
      this.addShadow(spr, 20);
      makeText(this, n.x, n.y - spr.height - 3, n.nameTh, { fontSize: '7px', color: n.color }).setOrigin(0.5, 1).setDepth(n.y + 1);
      makeText(this, n.x, n.y - spr.height - 13, `[${n.role}]`, { fontSize: '6px', color: '#ecf0f1' }).setOrigin(0.5, 1).setDepth(n.y + 1);
      spr.setInteractive({ useHandCursor: true });
      spr.on('pointerdown', (ptr) => { ptr.event.stopPropagation(); this.talk(n); });
      return { ...n, spr, line: 0 };
    });
  }

  talk(n) {
    const p = this.player;
    if (Phaser.Math.Distance.Between(p.x, p.y, n.x, n.y) > 60) { this.moveTo(n.x, n.y + 14); this.pendingTalk = n; return; }
    this.pendingTalk = null;
    this.tdToast(`💬 ${n.nameTh}: “${n.lines[n.line % n.lines.length]}”`, 4500); n.line++;
    this.sfx.play('click');
  }

  // ------------------------------------------------------------
  //  ผี
  // ------------------------------------------------------------
  buildMonsters() {
    this.monsters = this.physics.add.group();
    this.physics.add.collider(this.monsters, this.blocks);
    this.physics.add.collider(this.monsters, this.player);
    for (const s of this.layout.spawns) this.spawnMonster(s);
  }

  spawnMonster(s) {
    const def = MONSTERS[s.id], key = `mon_${def.art || s.id}`;
    if (!this.textures.exists(key)) return;
    const m = this.physics.add.sprite(s.x + rand(-s.r, s.r), s.y + rand(-s.r, s.r), key, 'walk_0').setOrigin(0.5, 1);
    const scale = def.scale || 1; m.setScale(scale);
    m.body.setSize(14 / scale, 8 / scale).setOffset((m.width - 14 / scale) / 2, m.height - 8 / scale);
    m.def = def; m.key = key; m.spawn = s; m.hp = def.hp; m.maxHp = def.hp; m.alive = true; m.mode = 'wander'; m.nextThink = 0; m.nextAtk = 0;
    m.legacyKey = key; m.d8id = `mob_${s.id}`; m.dir = 'south'; playDir(m, 'walk', 'south');
    this.addShadow(m, Math.max(14, m.displayWidth * 0.7));
    m.label = makeText(this, m.x, m.y, `Lv.${def.level} ${def.nameTh}`, { fontSize: '6px', color: '#f5b7b1' }).setOrigin(0.5, 1);
    m.hpBg = this.add.rectangle(0, 0, 22, 3, 0x000000, 0.7); m.hpBar = this.add.rectangle(0, 0, 22, 3, 0xe74c3c).setOrigin(0, 0.5);
    m.setInteractive({ useHandCursor: true });
    m.on('pointerdown', (ptr) => { ptr.event.stopPropagation(); this.setTarget(m); });
    this.monsters.add(m);
    return m;
  }

  setTarget(m) {
    if (!m.alive) return;
    this.player.target = m; this.player.path = [];
    this.sfx.play('click');
  }

  updateMonster(m, time, dt) {
    const p = this.player, d = m.def;
    const h = m.displayHeight;
    m.label.setPosition(m.x, m.y - h - 6).setDepth(m.y + 1);
    m.hpBg.setPosition(m.x, m.y - h - 3).setDepth(m.y + 1); m.hpBar.setPosition(m.x - 11, m.y - h - 3).setDepth(m.y + 1).width = 22 * Math.max(0, m.hp / m.maxHp);
    m.setDepth(m.y);
    if (!m.alive) return;
    const dist = Phaser.Math.Distance.Between(m.x, m.y, p.x, p.y);
    const spd = (d.speed || 40) * 0.9;
    if (p.alive && dist < 110) m.mode = 'chase';
    else if (m.mode === 'chase' && (dist > 220 || !p.alive)) { m.mode = 'wander'; m.nextThink = 0; }
    if (m.mode === 'chase') {
      if (dist <= (d.attackRange || 16) + 8) {
        m.setVelocity(0, 0);
        if (time >= m.nextAtk) { m.nextAtk = time + (d.attackCooldown || 1200); this.monsterAttack(m); }
      } else this.physics.moveToObject(m, p, spd);
    } else {
      if (time >= m.nextThink) {
        m.nextThink = time + rand(1500, 3500);
        if (Math.random() < 0.6) { const tx = m.spawn.x + rand(-m.spawn.r, m.spawn.r), ty = m.spawn.y + rand(-m.spawn.r, m.spawn.r); m.wanderTo = { x: tx, y: ty }; }
        else { m.wanderTo = null; m.setVelocity(0, 0); }
      }
      if (m.wanderTo) { if (Phaser.Math.Distance.Between(m.x, m.y, m.wanderTo.x, m.wanderTo.y) < 6) { m.wanderTo = null; m.setVelocity(0, 0); } else this.physics.moveTo(m, m.wanderTo.x, m.wanderTo.y, spd * 0.6); }
    }
    const v = m.body.velocity, busy = m.anims.currentAnim?.key.includes(':attack') && m.anims.isPlaying;
    if (v.length() > 2) m.dir = dirFromVector(v.x, v.y, m.dir);
    else if (m.mode === 'chase') m.dir = dirFromVector(p.x - m.x, p.y - m.y, m.dir);
    if (!busy) playDir(m, v.length() > 2 ? 'walk' : 'idle', m.dir) || playDir(m, 'walk', m.dir);
  }

  monsterAttack(m) {
    const p = this.player;
    playDir(m, 'attack', m.dir, true);
    this.time.delayedCall(220, () => {
      if (!m.alive || !p.alive || Phaser.Math.Distance.Between(m.x, m.y, p.x, p.y) > (m.def.attackRange || 16) + 14) return;
      if (Math.random() * 100 < (this.derived.evasion || 0) * 0.5) { popupNumber(this, p.x, p.y - 30, 'MISS', 'miss'); return; }
      const dmg = Math.max(1, Math.round(m.def.atk * rand(0.9, 1.15) - this.derived.def * 0.6));
      p.hp -= dmg; this.char.hp = p.hp;
      popupNumber(this, p.x, p.y - 34, `-${dmg}`, 'taken'); squash(this, p, 0.14, 90); p.setTint(0xff8a8a); this.time.delayedCall(120, () => p.clearTint());
      this.sfx.play('hurt'); this.cameras.main.shake(80, 0.002);
      if (p.hp <= 0) this.playerDie();
    });
  }

  // ------------------------------------------------------------
  //  ต่อสู้ฝั่งผู้เล่น
  // ------------------------------------------------------------
  playerAttack(m, time) {
    const p = this.player;
    p.nextAtk = time + ATK_CD; p.state = 'attack'; p.setVelocity(0, 0);
    p.facing = m.x >= p.x ? 1 : -1; p.dir = dirFromVector(m.x - p.x, m.y - p.y, p.dir);
    this.playerAnim('attack', true);
    this.sfx.play('swing');
    this.time.delayedCall(180, () => {
      if (!m.alive || !p.alive) return;
      const d = this.derived;
      if (Math.random() * 100 > (d.accuracy || 90) - (m.def.eva || 0)) { popupNumber(this, m.x, m.y - m.displayHeight, 'MISS', 'miss'); this.sfx.play('miss'); return; }
      const crit = Math.random() < (d.critRate || 0.05);
      let dmg = Math.max(1, Math.round(d.patk * rand(0.9, 1.1) - (m.def.def || 0)));
      if (crit) dmg = Math.round(dmg * (d.critDmg || 1.5));
      m.hp -= dmg;
      popupNumber(this, m.x, m.y - m.displayHeight - 4, crit ? `${dmg}!` : `${dmg}`, crit ? 'crit' : 'normal');
      hitSpark(this, m.x, m.y - m.displayHeight * 0.5, { crit, dir: p.facing });
      squash(this, m, crit ? 0.25 : 0.15, 90); m.setTint(crit ? 0xffd35c : 0xffffff); this.time.delayedCall(90, () => m.clearTint());
      this.sfx.play(crit ? 'crit' : 'hit');
      if (m.hp <= 0) this.monsterDie(m);
    });
  }

  monsterDie(m) {
    m.alive = false; m.setVelocity(0, 0); m.disableInteractive();
    if (this.player.target === m) this.player.target = null;
    const d = m.def;
    if (!playDir(m, 'die', m.dir, true)) m.setTint(0x777777);
    this.sfx.play('ghostDie');
    this.tweens.add({ targets: m, alpha: 0, duration: 900, delay: 300, onComplete: () => { m.setVisible(false); m.label.setVisible(false); m.hpBg.setVisible(false); m.hpBar.setVisible(false); } });
    // รางวัล (ไม่บันทึก – โหมดทดลอง)
    const gold = Math.round(rand(d.gold[0], d.gold[1])), exp = d.exp;
    this.char.gold += gold;
    const ups = gainExp(this.char, exp);
    popupNumber(this, m.x, m.y - m.displayHeight - 16, `+${exp} EXP ฿${gold}`, 'exp');
    this.sfx.play('coin');
    if (ups) { this.derived = getDerived(this.char); this.player.hp = this.char.hp; yantCircle(this, this.player.x, this.player.y, { tint: 0xffd35c, size: 84, ms: 1500, rise: true }); popupNumber(this, this.player.x, this.player.y - 48, `LEVEL UP! Lv.${this.char.level}`, 'crit'); this.sfx.play('levelup'); this.tdToast(`🎉 เลเวลอัพ! Lv.${this.char.level}`, 3000); }
    this.time.delayedCall(9000, () => this.respawnMonster(m));
  }

  respawnMonster(m) {
    const s = m.spawn;
    m.setPosition(s.x + rand(-s.r, s.r), s.y + rand(-s.r, s.r)).setAlpha(1).setVisible(true).clearTint();
    m.hp = m.maxHp; m.alive = true; m.mode = 'wander'; m.nextThink = 0; m.wanderTo = null;
    m.label.setVisible(true); m.hpBg.setVisible(true); m.hpBar.setVisible(true);
    playDir(m, 'walk', 'south', true); m.setInteractive({ useHandCursor: true });
  }

  playerDie() {
    const p = this.player; p.alive = false; p.hp = 0; p.target = null; p.path = []; p.setVelocity(0, 0);
    this.playerAnim('die', true); this.sfx.play('die');
    this.tdToast('💀 คุณสลบไป… ฟื้นที่ประตูเมืองใน 3 วินาที', 3000);
    this.time.delayedCall(3000, () => {
      p.setPosition(60 * TILE, 57 * TILE); p.hp = this.derived.maxHp; this.char.hp = p.hp; p.alive = true; p.state = 'idle'; this.playerAnim('idle', true);
      yantCircle(this, p.x, p.y, { tint: 0xffe9a6, size: 60, ms: 900 }); this.sfx.play('blessing');
    });
  }

  // ------------------------------------------------------------
  //  อินพุต: คลิกเดิน (A*) / คลิกตี / WASD
  // ------------------------------------------------------------
  buildInput() {
    this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,LEFT,DOWN,RIGHT,F,ESC');
    this.input.on('pointerdown', (ptr) => {
      if (ptr.rightButtonDown()) return;
      const w = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
      this.player.target = null;
      this.moveTo(w.x, w.y);
      this.clickMark(w.x, w.y);
    });
    this.keys.F.on('down', () => { const n = this.nearestNpc(60); if (n) this.talk(n); });
    this.keys.ESC.on('down', () => this.exitPrototype());
  }

  clickMark(x, y) {
    const r = this.add.image(x, y, 'fx_ring').setDepth(99999).setScale(0.25).setAlpha(0.9).setTint(0xffe27a);
    this.tweens.add({ targets: r, scale: 0.6, alpha: 0, duration: 380, onComplete: () => r.destroy() });
  }

  nearestNpc(r) {
    const p = this.player; let best = null, bd = r;
    for (const n of this.npcs) { const d = Phaser.Math.Distance.Between(p.x, p.y, n.x, n.y); if (d < bd) { bd = d; best = n; } }
    return best;
  }

  /** A* บนตารางไทล์ → เส้นทางเป็นจุดกลางไทล์ */
  findPath(sx, sy, tx, ty) {
    const solid = this.solid;
    const s = [Math.floor(sx / TILE), Math.floor(sy / TILE)], t = [Math.floor(tx / TILE), Math.floor(ty / TILE)];
    const inb = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
    if (!inb(t[0], t[1])) return [];
    // ปลายทางเป็นที่ทึบ → หาไทล์ว่างที่ใกล้สุดรอบ ๆ
    if (solid[t[1]][t[0]]) {
      let best = null, bd = 1e9;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const x = t[0] + dx, y = t[1] + dy; if (inb(x, y) && !solid[y][x]) { const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = [x, y]; } } }
      if (!best) return []; t[0] = best[0]; t[1] = best[1];
    }
    const key = (x, y) => y * MAP_W + x, h = (x, y) => Math.abs(x - t[0]) + Math.abs(y - t[1]);
    const open = new Map(), came = new Map(), g = new Map();
    const sk = key(s[0], s[1]); open.set(sk, h(s[0], s[1])); g.set(sk, 0);
    let iter = 0;
    while (open.size && iter++ < 20000) {
      let ck = null, cf = 1e9; for (const [k, f] of open) if (f < cf) { cf = f; ck = k; }
      open.delete(ck);
      const cx = ck % MAP_W, cy = Math.floor(ck / MAP_W);
      if (cx === t[0] && cy === t[1]) {
        const path = []; let k = ck;
        while (k !== sk) { path.push({ x: (k % MAP_W) * TILE + TILE / 2, y: Math.floor(k / MAP_W) * TILE + TILE / 2 }); k = came.get(k); }
        path.reverse(); if (path.length) path[path.length - 1] = { x: tx, y: ty };
        return path;
      }
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (!inb(nx, ny) || solid[ny][nx]) continue;
        if (dx && dy && (solid[cy][nx] || solid[ny][cx])) continue;       // ห้ามตัดมุมกำแพง
        const nk = key(nx, ny), ng = g.get(ck) + (dx && dy ? 1.414 : 1);
        if (ng < (g.get(nk) ?? 1e9)) { g.set(nk, ng); came.set(nk, ck); open.set(nk, ng + h(nx, ny)); }
      }
    }
    return [];
  }

  moveTo(x, y) {
    const p = this.player; if (!p.alive) return;
    p.path = this.findPath(p.x, p.y - 2, x, y);
  }

  // ------------------------------------------------------------
  //  update
  // ------------------------------------------------------------
  update(time, delta) {
    const p = this.player, k = this.keys, dt = delta / 1000;
    if (p.alive) {
      // WASD / ลูกศร = เดินเอง (ยกเลิกเส้นทางคลิก)
      let vx = (k.D.isDown || k.RIGHT.isDown) - (k.A.isDown || k.LEFT.isDown), vy = (k.S.isDown || k.DOWN.isDown) - (k.W.isDown || k.UP.isDown);
      if (vx || vy) { p.path = []; p.target = null; this.pendingTalk = null; }
      else if (p.target) {
        const m = p.target;
        if (!m.alive) p.target = null;
        else {
          const dist = Phaser.Math.Distance.Between(p.x, p.y, m.x, m.y);
          if (dist > ATK_RANGE) { if (!p.path.length || time > (p.nextPath || 0)) { p.nextPath = time + 400; p.path = this.findPath(p.x, p.y - 2, m.x, m.y); } }
          else { p.path = []; if (time >= p.nextAtk && p.state !== 'attack') this.playerAttack(m, time); }
        }
      }
      if (!vx && !vy && p.path.length) {
        const n = p.path[0], dx = n.x - p.x, dy = n.y - (p.y - 2), d = Math.hypot(dx, dy);
        if (d < 5) p.path.shift(); else { vx = dx / d; vy = dy / d; }
        if (!p.path.length && this.pendingTalk) { const n2 = this.pendingTalk; this.pendingTalk = null; this.talk(n2); }
      }
      if (p.state === 'attack') { p.setVelocity(0, 0); }
      else if (vx || vy) {
        const len = Math.hypot(vx, vy) || 1;
        p.setVelocity(vx / len * SPEED, vy / len * SPEED);
        if (vx) p.facing = vx > 0 ? 1 : -1;
        p.dir = dirFromVector(vx, vy, p.dir);
        p.state = 'walk'; this.playerAnim('walk');
      } else { p.setVelocity(0, 0); p.state = 'idle'; this.playerAnim('idle'); }
      // ฟื้น HP ช้า ๆ ในเมือง
      if (p.y < RIVER.y0 * TILE && p.hp < this.derived.maxHp) { p.hp = Math.min(this.derived.maxHp, p.hp + this.derived.maxHp * 0.04 * dt); this.char.hp = p.hp; }
      // ประตูวาร์ปกลับโหมดเดิม
      if (this.warpGate && Phaser.Math.Distance.Between(p.x, p.y, this.warpGate.x, this.warpGate.y) < 22) this.exitPrototype();
    }
    p.setDepth(p.y);
    this.nameTag.setPosition(p.x, p.y - p.displayHeight - 3);
    for (const sh of this.shadows) sh.img.setPosition(sh.obj.x, sh.obj.y + 1).setVisible(sh.obj.visible && sh.obj.alpha > 0.2);
    this.monsters.getChildren().forEach((m) => this.updateMonster(m, time, dt));
    // โซน/เพลง
    const zone = p.y < RIVER.y0 * TILE ? 'town' : 'field';
    if (zone !== this.zone) { this.zone = zone; this.sfx.music(zone === 'town' ? 'town' : 'field'); $('#td-zone').textContent = zone === 'town' ? '🏯 เกาะเมืองอยุธยา (Safe Zone)' : '🌾 ทุ่งนาบางปะอิน · ผีถ้วยแก้ว / กุมารทอง / นางตานี'; }
    this.sfx.setMood({ lowHp: p.alive && p.hp / this.derived.maxHp < 0.25, boss: 0 });
    if (time - (this.hudAt || 0) > 120) { this.hudAt = time; this.updateHud(); }
  }

  // ------------------------------------------------------------
  //  HUD (HTML ชุดเล็กเฉพาะโหมดนี้)
  // ------------------------------------------------------------
  buildHud() {
    $('#td-hud').classList.remove('hidden');
    $('#td-exit').onclick = () => this.exitPrototype();
    this.updateHud();
  }

  updateHud() {
    const c = this.char, d = this.derived, p = this.player;
    $('#td-name').textContent = `${c.name}`; $('#td-lv').textContent = `Lv.${c.level}`;
    $('#td-hp-fill').style.width = `${Math.max(0, p.hp / d.maxHp * 100)}%`; $('#td-hp').textContent = `HP ${Math.max(0, Math.ceil(p.hp))} / ${d.maxHp}`;
    const need = expToNext(c.level); $('#td-exp-fill').style.width = `${Math.min(100, c.exp / need * 100)}%`; $('#td-exp').textContent = `EXP ${c.exp} / ${need}`;
    $('#td-gold').textContent = `฿ ${c.gold.toLocaleString()}`;
    const t = p.target; $('#td-target').textContent = t && t.alive ? `🎯 ${t.def.nameTh} ${Math.max(0, Math.ceil(t.hp))}/${t.maxHp}` : '';
  }

  tdToast(text, ms = 3000) {
    const el = $('#td-toast'); el.textContent = text; el.classList.remove('hidden');
    clearTimeout(this.toastT); this.toastT = setTimeout(() => el.classList.add('hidden'), ms);
  }

  exitPrototype() {
    if (this.exiting) return; this.exiting = true;
    $('#td-hud').classList.add('hidden');
    this.sfx.setMood({ lowHp: false, boss: 0 });
    this.cameras.main.fadeOut(300, 10, 30, 30, (_c, t) => { if (t >= 1) { const u = new URL(location.href); u.searchParams.delete('mode'); location.href = u.toString(); } });
  }
}
