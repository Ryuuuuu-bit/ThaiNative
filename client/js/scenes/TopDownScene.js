// ============================================================
//  TopDownScene – New Version "กรุงศรีอยุธยา" (มุมบนเฉียง เดิน 8 ทิศ คลิกเดิน/คลิกตี แนว RO)
//  ▸ ออนไลน์: server คุมผี/ดาเมจ/รางวัล/HP/เซฟ (server/td.js) · เห็นผู้เล่นคนอื่น · แชท · ร้าน/เควส/กระเป๋า/สกิล/สถานะ (UI ชุดเดิม)
//  ▸ ออฟไลน์ (เปิดไฟล์ตรง ไม่มี server): จำลองผีในเครื่อง + เซฟในเครื่อง
//  ▸ ภาพ: ใช้สไปรต์ 8 ทิศจาก assets/td เมื่อมี · ไม่มี → ใช้สไปรต์ด้านข้างชุดเดิม
// ============================================================
import { MONSTERS } from '/shared/data/monsters.js';
import { ITEMS } from '/shared/data/items.js';
import { JOBS } from '/shared/data/classes.js';
import { getDerived } from '/shared/character.js';
import { gainExp } from '/shared/charmodel.js';
import { bakeCharacter } from '../gfx/SpriteFactory.js';
import { bakeFx, popupNumber, hitSpark, yantCircle, squash } from '../gfx/Fx.js';
import { makeText } from '../systems/util.js';
import { sound } from '../systems/Sound.js';
import { loadSettings } from '../systems/Settings.js';
import { saveCharacter } from '../systems/Character.js';
import { UI } from '../systems/UI.js';
import { Village } from '../systems/Village.js';
import { Econ } from '../net/Econ.js';
import { Network } from '../net/Network.js';
import { account } from '../net/Account.js';
import { count } from '../systems/Inventory.js';
import { TILE, MAP_W, MAP_H, T, RIVER, bakeTileset, bakeProps, buildLayout } from '../topdown/AyutthayaMap.js';
import { dirFromVector, playDir, registerDir8, texKey } from '../topdown/Dir8.js';
import { TdSkills } from '../topdown/TdSkills.js';
import { WeaponOverlay } from '../topdown/WeaponOverlay.js';
import { TouchControls } from '../topdown/TouchControls.js';
import { ALL_ASSETS } from '/shared/data/td_assets.js';
import { bakeGround, makeWater, TdAtmosphere, bakeTdFx, TdVfx, TdMinimap } from '../topdown/TdTheme.js';

const $ = (s) => document.querySelector(s);
const OUTFIT_IDS = ['mohom', 'ruenton', 'jongkraben', 'rajpatan', 'chaona', 'silk', 'warrior', 'hunter', 'isan', 'mahadlek'];
const SPEED = 92;                                   // ความเร็วเดิน (px/วิ) – ตรงกับ server/td.js
const SPAWN = { x: 60 * TILE, y: 57 * TILE };
const HP_POTS = ['hp_s', 'hp_m', 'pot_aloe', 'pot_turmeric'];
const MP_POTS = ['mp_s', 'mp_m', 'pot_anchan'];
/** NPC → หน้าต่างบริการ (ชุดเดียวกับโลกเดิม) */
const NPC_OPEN = { shop: 'mae_kha', smith: 'lung_dam', cook: 'pa_sa', tailor: 'tailor', kru_sword: 'kru_sword', kru_mage: 'kru_mage', kru_archer: 'kru_archer', kru_boxer: 'kru_boxer' };
const NPC_ICON = { shop: '🧪', quest: '❗', smith: '🔨', tailor: '👘', cook: '🍲', kru_sword: '⚔️', kru_mage: '🔮', kru_archer: '🏹', kru_boxer: '🥊' };
const rand = (a, b) => a + Math.random() * (b - a);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const DIRS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
const dirOfIndex = (i) => DIRS[((i % 8) + 8) % 8];
const heroId = (a) => `hero_${a.gender}_${OUTFIT_IDS[a.outfit] || 'mohom'}`;

export class TopDownScene extends Phaser.Scene {
  constructor() { super('ayutthaya'); }

  /** โหลดภาพ 8 ทิศที่มีแล้ว (assets/td/manifest.json) – ไม่มีก็เล่นได้ด้วยภาพเดิม */
  preload() {
    this.load.json('td_manifest', '/assets/td/manifest.json');
    this.load.once('filecomplete-json-td_manifest', (_k, _t, data) => {
      this.d8meta = {};
      for (const [id, ent] of Object.entries(data?.sprites || {})) {
        const meta = Array.isArray(ent) ? { anims: ent } : ent;
        this.d8meta[id] = meta;
        for (const anim of meta.anims) this.load.image(texKey(id, anim), `/assets/td/${id}/${anim}.png`);
      }
      for (const id of data?.images || []) this.load.image(id, `/assets/td/${id}.png`);
    });
    this.load.on('loaderror', () => {});
  }

  create({ char }) {
    // ภาพ 8 ทิศจาก manifest (จำนวนเฟรมจริงของแต่ละท่า) ก่อน แล้วค่อยใช้ค่าตั้งต้นจากแผน asset
    const RATE = { idle: [5, true], walk: [10, true], attack: [14, false], cast: [12, false], hit: [12, false], die: [8, false] };
    for (const [id, m] of Object.entries(this.d8meta || {})) {
      const anims = {};
      for (const a of m.anims) { const [rate, loop] = RATE[a] || [10, false]; anims[a] = { frames: m.frames?.[a] || (a === 'idle' ? 4 : 6), rate, loop }; }
      registerDir8(this, { id, anims });
    }
    for (const a of ALL_ASSETS) if (a.anims) registerDir8(this, { id: a.id, anims: a.anims });
    this.td = true;
    this.sfx = sound; this.settings = loadSettings(); document.body.classList.add('td-mode'); this.sfx.applySettings(this.settings);
    this.physics.world.gravity.y = 0;
    bakeFx(this); bakeTileset(this); bakeProps(this); bakeTdFx(this);
    // เอฟเฟกต์บนพื้น (ยันต์) อยู่ชั้นพื้น · เอฟเฟกต์ลอย (ตัวเลข/ประกาย) อยู่เหนือทุกอย่าง
    this.fxDepth = (d) => (d < 20 ? 0.9 : 100000 + d);
    // ตั้งค่า: ปิดจอสั่น / ลดแสงวาบ ครอบทุกที่ที่เรียกกล้อง
    { const cam = this.cameras.main, shake = cam.shake.bind(cam), flash = cam.flash.bind(cam);
      cam.shake = (d, i, ...r) => (this.settings?.fxShake === false ? cam : shake(d, i, ...r));
      cam.flash = (d, rr, g, b, ...r) => (this.settings?.fxFlash === 'off' ? cam : flash(this.settings?.fxFlash === 'soft' ? d * 0.4 : d, rr, g, b, ...r)); }
    this.layout = buildLayout();
    this.remotes = new Map();
    this.shadows = [];
    this.buildMap();
    this.buildProps();
    this.buildPlayer(char);
    this.buildAdapters();
    this.econ = new Econ(this);
    this.ui = new UI(this);
    this.village = new Village(this);
    document.querySelector('.minimap')?.classList.add('hidden');
    this.buildNpcs();
    this.buildMonsters();
    this.buildInput();
    $('#td-hud').classList.remove('hidden');

    const cam = this.cameras.main;
    cam.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE).setZoom(1.5).startFollow(this.player, true, 0.12, 0.12).setRoundPixels(true);
    this.atmo = new TdAtmosphere(this, this.layout);
    this.vfx = new TdVfx(this);
    this.skills = new TdSkills(this);
    this.weapons = new WeaponOverlay(this);
    this.touch = new TouchControls(this);
    this.weapons.attach(this.player, () => this.player.char.appearance, () => ({ anim: this.player.st }));
    this.minimap = new TdMinimap(this.groundMini);
    this.zone = null;
    this.ui.updateHud();
    this.setupNetwork();
    this.ui.toast('🏯 ยินดีต้อนรับสู่กรุงศรีอยุธยา · คลิกพื้นเพื่อเดิน คลิกผีเพื่อโจมตี · คลิก NPC เพื่อเปิดร้าน', '', 6000);
    if (!this.econ.server) this.time.addEvent({ delay: 5000, loop: true, callback: () => this.saveSoon() });
  }

  // ------------------------------------------------------------
  //  ตัวเชื่อมให้ระบบ UI/ร้าน/เควสชุดเดิมใช้กับฉากนี้ได้
  // ------------------------------------------------------------
  buildAdapters() {
    const s = this;
    this.map = { id: 'ayutthaya', no: 0, nameTh: 'กรุงศรีอยุธยา', minX: 0, maxX: MAP_W * TILE, gates: [], region: 'r1', get safe() { return s.inTown(); } };
    this.world = { toggleMap: () => this.ui.toast('แผนที่โลกเวอร์ชันใหม่กำลังสร้าง — ตอนนี้มีเมืองอยุธยา + ทุ่งนาบางปะอิน', '', 3000) };
    this.combat = {
      levelUpFx: (ups) => {
        const p = this.player;
        yantCircle(this, p.x, p.y, { tint: 0xffd35c, size: 84, ms: 1500, rise: true });
        popupNumber(this, p.x, p.y - 48, `LEVEL UP! Lv.${p.char.level}`, 'crit');
        this.sfx.play('levelup');
        this.ui.banner(`🎉 เลเวลอัพ! Lv.${p.char.level}`, ups > 1 ? `ขึ้น ${ups} เลเวล` : 'แต้มสถานะ +5 · SP +1');
      },
      popup: (x, y, r, kind) => popupNumber(this, x, y, r.hit === false ? 'MISS' : `${r.dmg}${r.crit ? '!' : ''}`, r.hit === false ? 'miss' : kind || (r.crit ? 'crit' : 'normal')),
      popupText: (x, y, text) => popupNumber(this, x, y, text, 'exp'),
      burst: () => {}, dust: () => {},
    };
    this.onAppearanceChanged = () => {
      const p = this.player, key = bakeCharacter(this, p.char.appearance);
      p.texKey = p.legacyKey = key; p.setTexture(key, 'idle_0');
      p.d8id = heroId(p.char.appearance);
      this.playerAnim('idle', true);
    };
    this.saveSoon = () => { if (!this.econ?.server) saveCharacter(this.player.char); };
    this.recall = () => this.ui.toast('ในโลกใหม่ให้เดินกลับเข้าประตูเมือง (ทางเหนือของสะพาน)', '', 3000);
    this.nearNpc = (id) => this.npcs?.some((n) => n.id === id && dist(n, this.player) < 60);
  }

  inTown() { return !!this.player && this.player.y < (RIVER.y0 - 1) * TILE; }

  // ------------------------------------------------------------
  //  แมพ
  // ------------------------------------------------------------
  buildMap() {
    const { ground, solid } = this.layout;
    const g = bakeGround(this, ground);            // พื้นทั้งแมพ (ขอบนุ่ม + ของตกแต่งเล็ก)
    this.groundMini = g.mini;
    this.water = makeWater(this);
    this.solid = solid;
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
    // สะพานไม้ทับแม่น้ำ (วาดเหนือชั้นน้ำ)
    const bx0 = 57 * TILE, by0 = (RIVER.y0 - 1) * TILE, bw = 6 * TILE, bh = (RIVER.y1 - RIVER.y0 + 3) * TILE;
    this.add.tileSprite(bx0, by0, bw, bh, 'td_tiles', T.WOOD).setOrigin(0).setDepth(0.3);
    this.add.rectangle(bx0 - 1, by0, 3, bh, 0x4a2c12).setOrigin(0).setDepth(0.31);
    this.add.rectangle(bx0 + bw - 2, by0, 3, bh, 0x4a2c12).setOrigin(0).setDepth(0.31);
    this.add.rectangle(bx0, by0 + bh, bw, 4, 0x000000, 0.25).setOrigin(0).setDepth(0.3);
  }



  buildProps() {
    for (const p of this.layout.props) {
      if (!this.textures.exists(p.key)) continue;
      const img = this.add.image(p.x, p.y, p.key).setOrigin(0.5, 1).setDepth(p.depth ?? p.y);
      if (p.flip) img.setFlipX(true);
      if (p.scale) img.setScale(p.scale);
      if (p.key !== 'boat' && p.key !== 'pr_reeds') this.add.ellipse(p.x, p.y - 1, img.displayWidth * 0.8, 7, 0x000000, 0.25).setDepth(0.6);
      if (p.label) makeText(this, p.x, p.y - img.displayHeight - 3, p.label, { fontSize: '6px', color: '#f7dc6f' }).setOrigin(0.5, 1).setDepth(p.y + 1);
      if (p.warp) this.warpGate = { x: p.x, y: p.y };
    }
    const zoneLabel = (tx, ty, text) => makeText(this, tx * TILE, ty * TILE, text, { fontSize: '8px', color: '#ffe9a6' }).setOrigin(0.5).setDepth(9000).setAlpha(0.85);
    zoneLabel(60, 12, '✦ วัดพระศรีสรรเพชญ์ ✦'); zoneLabel(60, 60, '⚔ ประตูเมืองใต้'); zoneLabel(60, 76, '🌾 ทุ่งนาบางปะอิน'); zoneLabel(30, 46, '🧺 ตลาดหัวรอ'); zoneLabel(40, 63, '⛵ ท่าน้ำวัดพนัญเชิง');
  }

  /** เงาวงรีใต้เท้า */
  addShadow(obj, w) {
    const img = this.add.image(obj.x, obj.y, 'fx_shadow').setDisplaySize(w, w * 0.4).setAlpha(0.55).setDepth(0.7);
    this.shadows.push({ img, obj });
    return img;
  }

  // ------------------------------------------------------------
  //  ผู้เล่น (ชื่อฟิลด์แบบเดียวกับ Player เดิม ให้ UI อ่านได้)
  // ------------------------------------------------------------
  buildPlayer(char) {
    const key = bakeCharacter(this, char.appearance);
    const pos = char.tdPos && Number.isFinite(char.tdPos.x) ? char.tdPos : SPAWN;
    const p = this.physics.add.sprite(pos.x, pos.y, key, 'idle_0').setOrigin(0.5, 1).setDepth(pos.y);
    p.body.setSize(12, 8).setOffset((p.width - 12) / 2, p.height - 8); p.bodyFoot = [12, 8];
    Object.assign(p, { char, texKey: key, legacyKey: key, d8id: heroId(char.appearance), dir: 'south', facing: 1, st: 'idle', path: [], target: null, nextAtk: 0, buffs: [], dead: false });
    Object.defineProperty(p, 'alive', { get() { return !this.dead; } });
    Object.defineProperty(p, 'derived', { get() { return getDerived(this.char); } });
    p.cooldownLeft = () => 0;
    p.combatStats = () => getDerived(p.char);
    this.addShadow(p, 22);
    this.player = p;
    this.physics.add.collider(p, this.blocks);
    this.nameTag = makeText(this, 0, 0, char.name, { fontSize: '7px', color: '#fff3c4' }).setOrigin(0.5, 1).setDepth(99999);
    p.on('animationcomplete', (anim) => { if (/:(attack|cast|hit)(:|$)/.test(anim.key) && p.alive) p.st = 'idle'; });
    this.playerAnim('idle');
  }

  playerAnim(name, restart = false) { const p = this.player; return playDir(p, name, p.dir || 'south', restart); }

  // ------------------------------------------------------------
  //  NPC
  // ------------------------------------------------------------
  buildNpcs() {
    this.npcs = this.layout.npcs.map((n) => {
      const real = this.textures.exists(n.key), key = real ? n.key : 'npc_maekha';
      const spr = this.add.sprite(n.x, n.y, key, 'idle_0').setOrigin(0.5, 1).setDepth(n.y);
      spr.legacyKey = key; spr.d8id = n.key; playDir(spr, 'idle', 'south');
      this.addShadow(spr, 20);
      makeText(this, n.x, n.y - spr.height - 3, `${NPC_ICON[n.id] || ''} ${n.nameTh}`, { fontSize: '7px', color: n.color }).setOrigin(0.5, 1).setDepth(n.y + 1);
      makeText(this, n.x, n.y - spr.height - 13, `[${n.role}]`, { fontSize: '6px', color: '#ecf0f1' }).setOrigin(0.5, 1).setDepth(n.y + 1);
      spr.setInteractive({ useHandCursor: true });
      spr.on('pointerdown', (ptr) => { ptr.event.stopPropagation(); this.talk(n); });
      spr.on('pointerover', () => { this.hovered = spr; document.body.dataset.cursor = 'talk'; });
      spr.on('pointerout', () => { if (this.hovered === spr) this.hovered = null; delete document.body.dataset.cursor; });
      if (n.id === 'quest') {                                                              // เครื่องหมาย ! ลอยเหนือหัวคนให้เควส
        const q = makeText(this, n.x, n.y - spr.height - 26, '❗', { fontSize: '10px' }).setOrigin(0.5, 1).setDepth(n.y + 2);
        this.tweens.add({ targets: q, y: q.y - 4, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      return { ...n, icon: NPC_ICON[n.id], spr, line: 0 };
    });
  }

  talk(n) {
    const p = this.player;
    if (dist(p, n) > 52) { this.moveTo(n.x, n.y + 14); this.pendingTalk = n; return; }
    this.pendingTalk = null;
    this.sfx.play('npc');
    if (n.id === 'quest') return this.village.openQuests();
    if (NPC_OPEN[n.id]) return this.ui.openShop(NPC_OPEN[n.id]);
    this.ui.toast(`💬 ${n.nameTh}: “${n.lines[n.line++ % n.lines.length]}”`, '', 4500);
  }

  // ------------------------------------------------------------
  //  ผี (index ตรงกับ server: mid = ลำดับจุดเกิดใน layout.spawns)
  // ------------------------------------------------------------
  buildMonsters() {
    this.monsters = this.physics.add.group();
    this.mobs = this.layout.spawns.map((s, mid) => this.spawnMonster(s, mid));
    if (!this.econ.server) { this.physics.add.collider(this.monsters, this.blocks); this.physics.add.collider(this.monsters, this.player); }
  }

  spawnMonster(s, mid) {
    const def = MONSTERS[s.id], key = `mon_${def.art || s.id}`;
    const m = this.physics.add.sprite(s.x, s.y, this.textures.exists(key) ? key : 'npc_maekha', 'walk_0').setOrigin(0.5, 1);
    this.monsters.add(m);
    const scale = def.scale || 1; m.setScale(scale);
    m.body.setSize(14 / scale, 8 / scale).setOffset((m.width - 14 / scale) / 2, m.height - 8 / scale); m.bodyFoot = [14, 8];
    Object.assign(m, { mid, def, spawn: s, hp: def.hp, maxHp: def.hp, alive: true, mode: 'wander', nextThink: 0, nextAtk: 0, dir: 'south', sx: s.x, sy: s.y });
    m.legacyKey = m.texture.key; m.d8id = `mob_${s.id}`; playDir(m, 'walk', 'south');
    this.addShadow(m, Math.max(14, m.displayWidth * 0.7));
    m.label = makeText(this, m.x, m.y, `Lv.${def.level} ${def.nameTh}`, { fontSize: '6px', color: '#f5b7b1' }).setOrigin(0.5, 1);
    m.hpBg = this.add.rectangle(0, 0, 22, 3, 0x000000, 0.7); m.hpBar = this.add.rectangle(0, 0, 22, 3, 0xe74c3c).setOrigin(0, 0.5);
    m.setInteractive({ useHandCursor: true });
    m.on('pointerdown', (ptr) => { ptr.event.stopPropagation(); this.setTarget(m); });
    m.on('pointerover', () => { this.hovered = m; document.body.dataset.cursor = 'attack'; });
    m.on('pointerout', () => { if (this.hovered === m) this.hovered = null; delete document.body.dataset.cursor; });
    if (!this.econ.server) m.setPosition(s.x + rand(-s.r, s.r), s.y + rand(-s.r, s.r));
    return m;
  }

  setTarget(m) {
    if (!m.alive) return;
    this.player.target = m; this.player.path = [];
    this.ui.setTarget({ def: { ...m.def, hp: m.maxHp }, get hp() { return m.hp; }, get alive() { return m.alive; } });
    this.sfx.play('target');
  }

  setMobVisible(m, on) {
    m.setVisible(on); m.label.setVisible(on); m.hpBg.setVisible(on); m.hpBar.setVisible(on);
    if (on) m.setAlpha(1).clearTint().setInteractive({ useHandCursor: true }); else m.disableInteractive();
  }

  drawMob(m) {
    const h = m.displayHeight;
    m.label.setPosition(m.x, m.y - h - 6).setDepth(m.y + 1);
    m.hpBg.setPosition(m.x, m.y - h - 3).setDepth(m.y + 1);
    m.hpBar.setPosition(m.x - 11, m.y - h - 3).setDepth(m.y + 1).width = 22 * Math.max(0, m.hp / m.maxHp);
    m.setDepth(m.y);
  }

  /** ออนไลน์: ค่อย ๆ เลื่อนไปตำแหน่งที่ server บอก */
  updateMobOnline(m, dt) {
    if (!m.alive) return;
    const dx = m.sx - m.x, dy = m.sy - m.y, d = Math.hypot(dx, dy);
    if (d > 80) m.setPosition(m.sx, m.sy);
    else if (d > 0.5) { const k = Math.min(1, dt * 10); m.x += dx * k; m.y += dy * k; }
    const busy = m.anims.currentAnim?.key.includes(':attack') && m.anims.isPlaying;
    if (!busy) playDir(m, d > 1 ? 'walk' : 'idle', m.dir) || playDir(m, 'walk', m.dir);
  }

  /** ออฟไลน์: AI ในเครื่อง */
  updateMobLocal(m, time) {
    const p = this.player, d = m.def;
    if (!m.alive) return;
    const dd = dist(m, p), spd = (d.speed || 40) * 0.9;
    if (p.alive && dd < 110 && !this.inTown()) m.mode = 'chase';
    else if (m.mode === 'chase' && (dd > 220 || !p.alive || this.inTown())) { m.mode = 'wander'; m.nextThink = 0; }
    if (m.mode === 'chase') {
      if (dd <= (d.attackRange || 16) + 8) {
        m.setVelocity(0, 0);
        if (time >= m.nextAtk) { m.nextAtk = time + (d.attackCooldown || 1200); this.localMobAttack(m); }
      } else this.physics.moveToObject(m, p, spd);
    } else {
      if (time >= m.nextThink) {
        m.nextThink = time + rand(1500, 3500);
        m.wanderTo = Math.random() < 0.6 ? { x: m.spawn.x + rand(-m.spawn.r, m.spawn.r), y: m.spawn.y + rand(-m.spawn.r, m.spawn.r) } : null;
        if (!m.wanderTo) m.setVelocity(0, 0);
      }
      if (m.wanderTo) { if (dist(m, m.wanderTo) < 6) { m.wanderTo = null; m.setVelocity(0, 0); } else this.physics.moveTo(m, m.wanderTo.x, m.wanderTo.y, spd * 0.6); }
    }
    const v = m.body.velocity, busy = m.anims.currentAnim?.key.includes(':attack') && m.anims.isPlaying;
    if (v.length() > 2) m.dir = dirFromVector(v.x, v.y, m.dir);
    else if (m.mode === 'chase') m.dir = dirFromVector(p.x - m.x, p.y - m.y, m.dir);
    if (!busy) playDir(m, v.length() > 2 ? 'walk' : 'idle', m.dir) || playDir(m, 'walk', m.dir);
  }

  localMobAttack(m) {
    const p = this.player;
    playDir(m, 'attack', m.dir, true);
    this.time.delayedCall(240, () => {
      if (!m.alive || !p.alive || dist(m, p) > (m.def.attackRange || 16) + 16) return;
      const d = p.derived;
      if (Math.random() * 100 < (d.evasion || 0) * 0.5) return this.onPlayerHit({ hit: false });
      const dmg = Math.max(1, Math.round(m.def.atk * rand(0.9, 1.15) - d.def * 0.6));
      p.char.hp = Math.max(0, p.char.hp - dmg);
      this.onPlayerHit({ hit: true, dmg, hp: p.char.hp });
      if (p.char.hp <= 0) this.playerDie();
    });
  }

  // ------------------------------------------------------------
  //  ต่อสู้
  // ------------------------------------------------------------
  attackRange() { const a = JOBS[this.player.char.appearance.job]?.attack; return a?.style === 'projectile' ? Math.min(160, a.range) : 28; }
  attackCd() { return JOBS[this.player.char.appearance.job]?.attack?.cooldown || 600; }

  playerAttack(m, time) {
    const p = this.player, ranged = this.attackRange() > 40;
    p.nextAtk = time + Math.max(450, this.attackCd()); p.st = 'attack'; p.setVelocity(0, 0);
    p.dir = dirFromVector(m.x - p.x, m.y - p.y, p.dir);
    if (!(ranged && this.playerAnim('cast', true))) this.playerAnim('attack', true);
    this.sfx.play(ranged ? 'arrow' : 'swing');
    if (ranged) this.vfx.shoot(p, m, JOBS[p.char.appearance.job]?.attack?.kind === 'magic' ? 'magic' : 'arrow');
    else this.time.delayedCall(120, () => m.alive && this.vfx.slash(p, m, false));
    if (this.econ.server) { this.time.delayedCall(ranged ? 120 : 160, () => m.alive && this.net.send('td:hit', { mid: m.mid })); return; }
    this.time.delayedCall(180, () => {
      if (!m.alive || !p.alive) return;
      const d = p.derived;
      if (Math.random() * 100 > (d.accuracy || 90) - (m.def.eva || 0)) return this.onMobDamage(m, { hit: false, by: 'me' });
      const crit = Math.random() < (d.critRate || 0.05);
      let dmg = Math.max(1, Math.round(d.patk * rand(0.9, 1.1) - (m.def.def || 0)));
      if (crit) dmg = Math.round(dmg * (d.critDmg || 1.5));
      m.hp -= dmg;
      this.onMobDamage(m, { hit: true, crit, dmg, by: 'me' });
      if (m.hp <= 0) { this.onMobDie(m); this.localReward(m); }
    });
  }

  shootFx(p, m) {
    const b = this.add.image(p.x, p.y - 18, 'fx_spark').setScale(0.5).setDepth(99990).setTint(0xffe27a);
    this.tweens.add({ targets: b, x: m.x, y: m.y - m.displayHeight * 0.5, duration: 160, onComplete: () => b.destroy() });
  }

  onMobDamage(m, d) {
    if (!m) return;
    const mine = d.by === 'me' || d.by === this.net?.selfId;
    if (Number.isFinite(d.hp)) m.hp = d.hp;
    if (!d.hit) { popupNumber(this, m.x, m.y - m.displayHeight, 'MISS', 'miss'); if (mine) this.sfx.play('miss'); return; }
    popupNumber(this, m.x, m.y - m.displayHeight - 4, d.crit ? `${d.dmg}!` : `${d.dmg}`, d.crit ? 'crit' : 'normal');
    hitSpark(this, m.x, m.y - m.displayHeight * 0.5, { crit: d.crit, dir: m.x >= this.player.x ? 1 : -1 });
    squash(this, m, d.crit ? 0.25 : 0.15, 90); m.setTint(d.crit ? 0xffd35c : 0xffffff); this.time.delayedCall(90, () => m.clearTint());
    if (mine) this.sfx.play(d.crit ? 'crit' : 'hit');
  }

  onMobDie(m) {
    if (!m || !m.alive) return;
    m.alive = false; m.hp = 0; m.setVelocity(0, 0); m.disableInteractive();
    if (this.player.target === m) this.player.target = null;
    if (!playDir(m, 'die', m.dir, true)) m.setTint(0x777777);
    this.vfx?.soul(m);
    this.sfx.play('ghostDie'); this.time.delayedCall(150, () => this.sfx.play('soul'));
    this.tweens.add({ targets: m, alpha: 0, duration: 900, delay: 300, onComplete: () => { if (!m.alive) this.setMobVisible(m, false); } });
    if (!this.econ.server) this.time.delayedCall(9000, () => this.respawnLocal(m));
  }

  respawnLocal(m) {
    const s = m.spawn;
    m.setPosition(s.x + rand(-s.r, s.r), s.y + rand(-s.r, s.r));
    m.hp = m.maxHp; m.alive = true; m.mode = 'wander'; m.nextThink = 0; m.wanderTo = null;
    this.setMobVisible(m, true); playDir(m, 'walk', 'south', true);
  }

  localReward(m) {
    const d = m.def, c = this.player.char;
    const gold = Math.round(rand(d.gold[0], d.gold[1])), exp = d.exp;
    c.gold += gold;
    const ups = gainExp(c, exp);
    this.showReward({ exp, gold, items: [], x: m.x, y: m.y, ups });
    this.saveSoon();
  }

  /** รางวัลจาก server (หรือในเครื่อง) → ตัวเลขลอย + ข้อความของดรอป */
  showReward(r) {
    const y = (r.y ?? this.player.y) - 30;
    popupNumber(this, r.x ?? this.player.x, y, `+${r.exp} EXP${r.gold ? ` ฿${r.gold}` : ''}`, r.night ? 'night' : 'exp');
    if (r.gold) this.sfx.play('coin');
    for (const it of r.items || []) this.ui.loot?.(`${it.rare ? '✨ ' : ''}ได้ ${ITEMS[it.id]?.nameTh || it.id} x${it.qty || 1}`);
    if (r.quests?.length || r.titles?.length) this.ui.result({ ok: true, quests: r.quests, titles: r.titles });
    if (r.ups && !this.econ.server) this.combat.levelUpFx(r.ups);
    this.ui.hudCache = '';
  }

  onPlayerHit(d) {
    const p = this.player;
    if (!d.hit) { popupNumber(this, p.x, p.y - 34, 'MISS', 'miss'); return; }
    if (Number.isFinite(d.hp)) p.char.hp = d.hp;
    popupNumber(this, p.x, p.y - 34, `-${d.dmg}`, 'taken');
    squash(this, p, 0.14, 90); p.setTint(0xff8a8a); this.time.delayedCall(120, () => p.clearTint());
    this.sfx.play('hurt'); this.cameras.main.shake(80, 0.002);
    this.ui.hudCache = '';
  }

  playerDie() {
    const p = this.player;
    if (p.dead) return;
    p.dead = true; p.char.hp = 0; p.target = null; p.path = []; p.setVelocity(0, 0);
    this.playerAnim('die', true); this.sfx.play('die');
    this.ui.banner('💀 คุณสลบไป…', 'ฟื้นที่ประตูเมืองใน 3 วินาที');
    this.time.delayedCall(3000, () => {
      if (this.econ.server) return this.net.send('td:respawn');
      this.onRespawn({ x: SPAWN.x, y: SPAWN.y, hp: p.derived.maxHp });
    });
  }

  onRespawn({ x, y, hp }) {
    const p = this.player;
    p.dead = false; p.st = 'idle'; p.setPosition(x, y); p.char.hp = hp ?? p.derived.maxHp;
    this.playerAnim('idle', true);
    yantCircle(this, p.x, p.y, { tint: 0xffe9a6, size: 60, ms: 900 }); this.sfx.play('blessing');
    this.ui.hudCache = '';
  }

  quickUse(ids) {
    const c = this.player.char, id = ids.find((i) => count(c, i) > 0);
    if (!id) return this.ui.toast('ไม่มียาเหลือแล้ว', 'warn');
    if (!this.player.alive) return;
    this.econ.act('use', { id }).then((r) => { if (r.ok) this.sfx.play('potion'); this.ui.result(r); });
  }

  // ------------------------------------------------------------
  //  ออนไลน์
  // ------------------------------------------------------------
  setupNetwork() {
    const net = (this.net = new Network());
    if (!this.econ.server) { this.ui.setOnline(false, 0); this.ui.toast('โหมดออฟไลน์: เซฟในเครื่อง', '', 4000); return; }
    net.on('status', (on) => { this.ui.setOnline(on, this.remotes.size); if (!on) { this.remotes.forEach((r) => r.destroy()); this.remotes.clear(); } })
      .on('init', ({ admin, serverTime, dayMs }) => { if (account.account) account.account.admin = !!admin; this.atmo?.sync(serverTime, dayMs); net.send('td:enter'); })
      .on('char:load', (s) => this.econ.apply(s))
      .on('char:sync', (s) => this.econ.apply(s))
      .on('rejected', ({ msg }) => this.ui.toast(msg || 'เข้าเกมไม่สำเร็จ', 'warn', 6000))
      .on('kicked', ({ msg }) => { this.ui.banner(msg || 'บัญชีนี้เข้าเกมจากเครื่องอื่น'); net.socket?.disconnect(); })
      .on('pl:hit', (d) => this.onPlayerHit(d))
      .on('pl:die', () => this.playerDie())
      .on('pl:hp', ({ hp }) => { if (Number.isFinite(hp)) { this.player.char.hp = hp; this.ui.hudCache = ''; } })
      .on('chat', (m) => this.ui.chat(m))
      .on('td:init', ({ x, y, players }) => {
        this.player.setPosition(x, y); this.cameras.main.centerOn(x, y);
        players.forEach((q) => this.addRemote(q));
        this.ui.setOnline(true, this.remotes.size);
      })
      .on('td:joined', (q) => { this.addRemote(q); this.ui.chat({ name: '📢 ระบบ', text: `${q.name} เข้าสู่กรุงศรีอยุธยา` }); this.ui.setOnline(true, this.remotes.size); })
      .on('td:left', (id) => this.removeRemote(id))
      .on('skill', (d) => { const r = this.remotes.get(d.id); if (r) this.skills.remote(d, r); })
      .on('td:state', (s) => this.applyState(s))
      .on('td:dmg', (d) => this.onMobDamage(this.mobs[d.mid], d))
      .on('td:die', ({ mid }) => this.onMobDie(this.mobs[mid]))
      .on('td:matk', ({ mid }) => { const m = this.mobs[mid]; if (m?.alive) playDir(m, 'attack', m.dir, true); })
      .on('td:reward', (r) => this.showReward({ ...r, x: this.mobs[r.mid]?.x, y: this.mobs[r.mid]?.y }))
      .on('td:respawn', (d) => this.onRespawn(d))
      .on('td:correct', ({ x, y }) => { if (dist(this.player, { x, y }) > 24) { this.player.setPosition(x, y); this.player.path = []; } });
    net.connect(this.player.char.name, () => ({ token: account.token }));
  }

  applyState({ p: ps, m: ms }) {
    for (const [mid, x, y, dirI, hp] of ms) {
      const m = this.mobs[mid];
      if (!m) continue;
      m.sx = x; m.sy = y; m.dir = dirOfIndex(dirI);
      if (hp > 0) {
        m.hp = hp;
        if (!m.alive) { m.alive = true; m.setPosition(x, y); this.setMobVisible(m, true); playDir(m, 'walk', m.dir, true); }
      } else if (m.alive) this.onMobDie(m);
    }
    for (const [id, x, y, dir, anim] of ps) if (id !== this.net.selfId) this.remotes.get(id)?.push({ x, y, dir, anim });
  }

  removeRemote(id) { this.remotes.get(id)?.destroy(); this.remotes.delete(id); this.ui.setOnline(this.net.online, this.remotes.size); }

  addRemote(q) {
    if (this.remotes.has(q.id) || q.id === this.net.selfId) return;
    const key = bakeCharacter(this, q.appearance);
    const s = this.add.sprite(q.x, q.y, key, 'idle_0').setOrigin(0.5, 1).setDepth(q.y);
    s.legacyKey = key; s.d8id = heroId(q.appearance);
    this.weapons?.attach(s, () => q.appearance, () => ({ anim: r.anim }));
    const tag = makeText(this, q.x, q.y, `${q.name} Lv.${q.level}`, { fontSize: '7px', color: '#aed6f1' }).setOrigin(0.5, 1);
    const sh = this.addShadow(s, 22);
    const r = {
      tx: q.x, ty: q.y, dir: 'south', anim: 'idle',
      push(st) { this.tx = st.x; this.ty = st.y; this.dir = st.dir || this.dir; this.anim = st.anim || 'idle'; },
      update(dt) {
        const dx = this.tx - s.x, dy = this.ty - s.y;
        if (Math.hypot(dx, dy) > 120) s.setPosition(this.tx, this.ty); else { const k = Math.min(1, dt * 12); s.x += dx * k; s.y += dy * k; }
        s.setDepth(s.y); tag.setPosition(s.x, s.y - s.displayHeight - 3).setDepth(s.y + 1);
        playDir(s, this.anim, this.dir);
      },
      destroy: () => { this.weapons?.detach(s); s.destroy(); tag.destroy(); sh.destroy(); this.shadows = this.shadows.filter((x) => x.obj !== s); },
      get x() { return s.x; }, get y() { return s.y; },
    };
    this.remotes.set(q.id, r);
  }

  // ------------------------------------------------------------
  //  อินพุต
  // ------------------------------------------------------------
  buildInput() {
    const kb = this.input.keyboard;
    this.keys = kb.addKeys('UP,LEFT,DOWN,RIGHT', false);
    this.input.mouse?.disableContextMenu();                    // คลิกขวาไม่เปิดเมนูของเบราว์เซอร์
    this.input.on('pointerdown', (ptr, over) => {
      if (this.touch?.owns(ptr)) return;                        // นิ้วที่กำลังใช้จอยสติ๊ก/ปุ่มบนจอ
      const w = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
      const hitMob = over.find((o) => o.mid != null && o.alive) || this.mobAt(w.x, w.y, this.touch?.on ? 30 : 14);
      // คลิกขวา = โจมตีผีที่ชี้ (หรือตัวที่ใกล้จุดคลิกที่สุด) · ไม่มีผีก็ไม่เดิน
      if (ptr.rightButtonDown()) { if (hitMob) this.setTarget(hitMob); return; }
      if (hitMob) { this.setTarget(hitMob); return; }           // คลิกซ้าย/แตะโดนผี = โจมตี
      if (over.length) return;                                   // NPC/ของที่มีคำสั่งของตัวเอง
      this.player.target = null;
      this.moveTo(w.x, w.y);
      this.clickMark(w.x, w.y);
    });
    // แตะ/คลิกช่องสกิลในแถบล่าง = ร่ายสกิล (มือถือไม่มีคีย์บอร์ด)
    $('#skillbar')?.addEventListener('click', (e) => { const k = e.target.closest('.skill')?.dataset.key; if (k) this.skills.cast(k); });
    kb.on('keydown-F', () => { const n = this.nearestNpc(60); if (n) this.talk(n); });
    for (const k of ['Q', 'W', 'E', 'R', 'T']) kb.on(`keydown-${k}`, () => this.skills.cast(k));
    kb.on('keydown-ONE', () => this.quickUse(HP_POTS));
    kb.on('keydown-TWO', () => this.quickUse(MP_POTS));
    kb.on('keydown-I', () => this.ui.toggle('inv-panel'));
    kb.on('keydown-C', () => this.ui.toggle('stats-panel'));
    kb.on('keydown-K', () => this.ui.toggle('skill-panel'));
    kb.on('keydown-J', () => this.village.openQuests());
    kb.on('keydown-H', () => this.ui.toggle('help-panel'));
    kb.on('keydown-M', () => this.world.toggleMap());
    kb.on('keydown-ENTER', () => this.ui.focusChat());
    kb.on('keydown-ESC', () => (this.ui.anyOpen() ? this.ui.closeAll() : this.ui.toggle('settings-panel', true)));
    $('#quick-hp').onclick = () => this.quickUse(HP_POTS);
    $('#quick-mp').onclick = () => this.quickUse(MP_POTS);
  }

  clickMark(x, y) {
    const r = this.add.image(x, y, 'fx_ring').setDepth(99999).setScale(0.25).setAlpha(0.9).setTint(0xffe27a);
    this.tweens.add({ targets: r, scale: 0.6, alpha: 0, duration: 380, onComplete: () => r.destroy() });
  }

  /** ผีที่อยู่ใกล้จุด (x,y) ที่สุดภายในรัศมี r (วัดจากกลางตัว) */
  mobAt(x, y, r) {
    let best = null, bd = r;
    for (const m of this.mobs) {
      if (!m.alive || m.visible === false) continue;
      const d = Math.hypot(m.x - x, m.y - m.displayHeight * 0.45 - y);
      if (d < bd + m.displayWidth * 0.3) { bd = d; best = m; }
    }
    return best;
  }

  nearestNpc(r) {
    let best = null, bd = r;
    for (const n of this.npcs) { const d = dist(this.player, n); if (d < bd) { bd = d; best = n; } }
    return best;
  }

  /** A* บนตารางไทล์ (8 ทิศ ห้ามตัดมุมกำแพง) */
  findPath(sx, sy, tx, ty) {
    const solid = this.solid;
    const s = [Math.floor(sx / TILE), Math.floor(sy / TILE)], t = [Math.floor(tx / TILE), Math.floor(ty / TILE)];
    const inb = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
    if (!inb(t[0], t[1])) return [];
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
        if (dx && dy && (solid[cy][nx] || solid[ny][cx])) continue;
        const nk = key(nx, ny), ng = g.get(ck) + (dx && dy ? 1.414 : 1);
        if (ng < (g.get(nk) ?? 1e9)) { g.set(nk, ng); came.set(nk, ck); open.set(nk, ng + h(nx, ny)); }
      }
    }
    return [];
  }

  moveTo(x, y) { const p = this.player; if (p.alive) p.path = this.findPath(p.x, p.y - 2, x, y); }

  // ------------------------------------------------------------
  //  update
  // ------------------------------------------------------------
  update(time, delta) {
    const p = this.player, k = this.keys, dt = delta / 1000;
    const typing = this.ui.typing;
    if (p.alive) {
      let vx = typing ? 0 : k.RIGHT.isDown - k.LEFT.isDown;
      let vy = typing ? 0 : k.DOWN.isDown - k.UP.isDown;
      if (this.touch?.vec) { vx += this.touch.vec.x; vy += this.touch.vec.y; }   // จอยสติ๊กบนมือถือ
      if (vx || vy) { p.path = []; p.target = null; this.pendingTalk = null; }
      else if (p.target) {
        const m = p.target;
        if (!m.alive) p.target = null;
        else {
          const dd = dist(p, m), range = this.attackRange();
          if (dd > range) { if (!p.path.length || time > (p.nextPath || 0)) { p.nextPath = time + 400; p.path = this.findPath(p.x, p.y - 2, m.x, m.y); } }
          else { p.path = []; if (time >= p.nextAtk && p.st !== 'attack') this.playerAttack(m, time); }
        }
      }
      if (!vx && !vy && p.path.length) {
        const n = p.path[0], dx = n.x - p.x, dy = n.y - (p.y - 2), d = Math.hypot(dx, dy);
        if (d < 5) p.path.shift(); else { vx = dx / d; vy = dy / d; }
        if (!p.path.length && this.pendingTalk) { const n2 = this.pendingTalk; this.pendingTalk = null; this.talk(n2); }
      }
      if (p.st === 'attack') p.setVelocity(0, 0);
      else if (vx || vy) {
        const len = Math.hypot(vx, vy) || 1;
        p.setVelocity(vx / len * SPEED, vy / len * SPEED);
        p.dir = dirFromVector(vx, vy, p.dir); p.st = 'walk'; this.playerAnim('walk');
      } else { p.setVelocity(0, 0); p.st = 'idle'; this.playerAnim('idle'); }
      if (!this.econ.server && this.inTown() && p.char.hp < p.derived.maxHp) p.char.hp = Math.min(p.derived.maxHp, p.char.hp + p.derived.maxHp * 0.04 * dt);
    } else p.setVelocity(0, 0);
    p.setDepth(p.y);
    this.nameTag.setPosition(p.x, p.y - p.displayHeight - 3);
    for (const sh of this.shadows) sh.img.setPosition(sh.obj.x, sh.obj.y + 1).setVisible(sh.obj.visible && sh.obj.alpha > 0.2);
    for (const m of this.mobs) { if (this.econ.server) this.updateMobOnline(m, dt); else this.updateMobLocal(m, time); this.drawMob(m); }
    this.remotes.forEach((r) => r.update(dt));
    this.weapons?.update(time);
    // ส่งตำแหน่ง ~10 ครั้ง/วิ
    if (this.net?.online && time - (this.sentAt || 0) > 100) {
      const st = { x: Math.round(p.x), y: Math.round(p.y), dir: p.dir, anim: p.alive ? (p.st === 'walk' ? 'walk' : p.st === 'attack' ? 'attack' : 'idle') : 'die' };
      const sig = JSON.stringify(st);
      if (sig !== this.sentSig || time - this.sentAt > 1000) { this.sentAt = time; this.sentSig = sig; this.net.send('td:move', st); }
    }
    const zone = this.inTown() ? 'town' : 'field', night = this.atmo.light < 0.35;
    this.sfx.music(night ? 'ayt_night' : zone === 'town' ? 'ayutthaya' : 'ayt_field');
    // เสียงเท้าตามชนิดพื้น
    if (p.st === 'walk' && time > (this.stepAt || 0)) {
      this.stepAt = time + 290;
      const t = this.layout.ground[Math.floor(p.y / TILE)]?.[Math.floor(p.x / TILE)];
      this.sfx.play(t === T.WOOD ? 'step_wood' : t === T.BRICK || t === T.STONE ? 'step_stone' : t === T.SAND || t === T.ROAD ? 'step_sand' : 'step_grass');
    }
    if (zone !== this.zone) {
      this.zone = zone;
      this.ui.setZone(zone === 'town' ? 'กรุงศรีอยุธยา' : 'ทุ่งนาบางปะอิน', true);
      $('#td-zone').textContent = zone === 'town' ? '🏯 เกาะเมือง (Safe Zone)' : '🌾 ผีถ้วยแก้ว · กุมารทอง · นางตานี';
    }
    this.sfx.setMood({ lowHp: p.alive && p.char.hp / p.derived.maxHp < 0.25, boss: 0 });
    this.ui.updateHud();
    this.ui.updateSkillBar(time);
    this.ui.updateFrame(time);
    this.atmo.update(time, p, this.inTown());
    this.water.update(time);
    this.vfx.update(time, p, p.target, this.hovered);
    this.minimap.update(time, this);
  }

}
