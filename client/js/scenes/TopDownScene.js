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
import { loadSettings, saveSettings } from '../systems/Settings.js';
import { saveCharacter } from '../systems/Character.js';
import { UI } from '../systems/UI.js';
import { Village } from '../systems/Village.js';
import { TdLife } from '../topdown/TdLife.js';
import { Econ } from '../net/Econ.js';
import { Network } from '../net/Network.js';
import { account } from '../net/Account.js';
import { count } from '../systems/Inventory.js';
import { TILE, MAP_W, MAP_H, T, SPAWN as TD_SPAWN, inTownXY, isIsland, bakeTileset, bakeProps, buildLayout } from '../topdown/AyutthayaMap.js';
import { dirFromVector, stableDir, playDir, registerDir8, texKey } from '../topdown/Dir8.js';
import { TdSkills } from '../topdown/TdSkills.js';
import { SKILL_SLOTS, SLOT_KEYNAME, isItemSlot, slotItemId } from '/shared/data/skills.js';
import { WeaponOverlay } from '../topdown/WeaponOverlay.js';
import { TouchControls } from '../topdown/TouchControls.js';
import { ALL_ASSETS } from '/shared/data/td_assets.js';
import { bakeGround, makeWater, TdAtmosphere, bakeTdFx, TdVfx, TdMinimap } from '../topdown/TdTheme.js';

const $ = (s) => document.querySelector(s);
const OUTFIT_IDS = ['mohom', 'ruenton', 'jongkraben', 'rajpatan', 'chaona', 'silk', 'warrior', 'hunter', 'isan', 'mahadlek'];
/** ท่าโจมตีจริงตามอาวุธ (ถ้ามีภาพ): ดาบ = ฟัน · ธนู = ยิง · ไม้เท้า = ร่าย · มวย = ต่อย */
const ACTION_ANIM = { swordman: 'slash', archer: 'shoot', mage: 'cast', boxer: 'attack' };
const SPEED = 92;
/** ระบบ Auto: หาผีเองในรัศมีนี้รอบตัว (px ≈ 10 ช่อง) */
const AUTO_RADIUS = 160;                                   // ความเร็วเดิน (px/วิ) – ตรงกับ server/td.js
const SPAWN = TD_SPAWN;
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
      for (const id of data?.tilesets || []) this.load.image(`ts_${id}`, `/assets/td/tiles/${id}.png`);
      this.tilesets = data?.tilesets || [];
    });
    this.load.on('loaderror', () => {});
  }

  create({ char }) {
    // ภาพ 8 ทิศจาก manifest (จำนวนเฟรมจริงของแต่ละท่า) ก่อน แล้วค่อยใช้ค่าตั้งต้นจากแผน asset
    const RATE = { idle: [5, true], walk: [10, true], attack: [14, false], slash: [18, false], shoot: [16, false], cast: [16, false], hit: [12, false], die: [8, false] };
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
    this.life = new TdLife(this);
    // HUD: ย้ายปุ่มเมนูลงมุมขวาล่าง (ข้าง Hotbar) · ซ่อนแถบคำแนะนำหลัง 15 วิ
    { const hb = document.querySelector('.hud-buttons'); if (hb) { hb.classList.add('dock'); $('#hud').appendChild(hb); } }
    { const tb = document.querySelector('#td-hud .td-bottom'); if (tb) { tb.classList.remove('fade'); clearTimeout(this._hintT); this._hintT = setTimeout(() => tb.classList.add('fade'), 15000); } }
    document.querySelector('.minimap')?.classList.add('hidden');
    this.buildNpcs();
    this.buildMonsters();
    this.buildInput();
    $('#td-hud').classList.remove('hidden');

    const cam = this.cameras.main;
    cam.setBounds(0, 0, MAP_W * TILE, MAP_H * TILE).setZoom(1.5).startFollow(this.player, false, 0.14, 0.14).setRoundPixels(false);
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
    // ฟื้น MP ทุกวินาที (ในเมืองเร็วกว่า) – MP เป็นของ client ทั้งออนไลน์/ออฟไลน์ · HP ออนไลน์ server ฟื้นให้
    this.time.addEvent({ delay: 1000, loop: true, callback: () => {
      const p = this.player; if (!p?.alive) return;
      const c = p.char, d = getDerived(c), safe = this.inTown();
      c.mp = Math.min(d.maxMp, (Number.isFinite(c.mp) ? c.mp : d.maxMp) + 1 + d.maxMp * (safe ? 0.06 : 0.02));
    } });
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
        this.ui.banner(`🎉 เลเวลอัพ! Lv.${p.char.level}`, `${ups > 1 ? `ขึ้น ${ups} เลเวล · ` : ''}แต้มสถานะ +${5 * ups} · SP +${ups} · 🌳 พรสวรรค์ +${ups} (K)`);
      },
      popup: (x, y, r, kind) => popupNumber(this, x, y, r.hit === false ? 'MISS' : `${r.dmg}${r.crit ? '!' : ''}`, r.hit === false ? 'miss' : kind || (r.crit ? 'crit' : 'normal')),
      popupText: (x, y, text) => popupNumber(this, x, y, text, 'exp'),
      burst: () => {}, dust: () => {},
    };
    this.onJobChanged = () => { this.onAppearanceChanged(); this.ui.hudCache = ''; this.ui.refreshPanels?.(); };
    this.onAppearanceChanged = () => {
      const p = this.player, key = bakeCharacter(this, p.char.appearance);
      p.texKey = p.legacyKey = key; p.setTexture(key, 'idle_0');
      p.d8id = heroId(p.char.appearance);
      this.playerAnim('idle', true);
    };
    this.saveSoon = () => { if (!this.econ?.server) saveCharacter(this.player.char); };
    // ยันต์คืนถิ่น: ร่าย 2.5 วิ (ขยับ/โดนตี = ยกเลิก) แล้ววาร์ปกลับลานน้ำพุกลางเมือง
    this.recall = () => {
      const p = this.player;
      if (!p.alive || this.recalling) return;
      if (count(p.char, 'yant_home') <= 0) return this.ui.toast('ไม่มียันต์คืนถิ่น (ซื้อได้ที่ร้านยายติ๋ม)', 'warn');
      if (this.inTown()) return this.ui.toast('อยู่ในเมืองอยู่แล้ว', '', 1800);
      const start = { x: p.x, y: p.y }, hurt = p.hurtAt || 0;
      p.path = []; p.target = null;
      this.recalling = true;
      yantCircle(this, p.x, p.y, { tint: 0x9fe0ff, size: 60, ms: 2500 });
      this.ui.toast('🏠 กำลังร่ายยันต์คืนถิ่น… (อย่าขยับ)', '', 2500);
      this.time.delayedCall(2500, async () => {
        this.recalling = false;
        if (!p.alive || dist(p, start) > 6 || (p.hurtAt || 0) !== hurt) return this.ui.toast('การร่ายถูกขัดจังหวะ', 'warn');
        const r = await this.econ.act('recall', {});
        if (!r.ok) return this.ui.result(r);
        p.setPosition(SPAWN.x, SPAWN.y); p.path = []; this.sfx.play('levelup');
        yantCircle(this, SPAWN.x, SPAWN.y, { tint: 0x9fe0ff, size: 70, ms: 900, rise: true });
        this.ui.toast('กลับถึงลานน้ำพุกลางเมือง', 'ok', 2200);
      });
    };
    this.nearNpc = (id) => this.npcs?.some((n) => n.id === id && dist(n, this.player) < 60);
  }

  inTown() { return !!this.player && inTownXY(this.player.x, this.player.y); }

  // ------------------------------------------------------------
  //  แมพ
  // ------------------------------------------------------------
  buildMap() {
    const { ground, solid } = this.layout;
    const g = bakeGround(this, ground, this.tilesets || []);            // พื้นทั้งแมพ (ขอบนุ่ม + ของตกแต่งเล็ก)
    this.groundMini = g.mini;
    this.water = makeWater(this, this.layout.ground);
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
    // ใบเสมาเรียงบนกำแพงเมือง: บนขอบหน้ากำแพงทุกช่วง + ด้านนอกของกำแพงข้าง (ตกแต่ง ไม่ชนกัน)
    const gt = (x, y) => ground[y]?.[x], isW = (t) => t === T.WALL || t === T.WALLTOP;
    const sema = (x, y) => this.add.image(x, y, 'td_sema').setOrigin(0.5, 1).setDepth(y);
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      const t = gt(x, y); if (!isW(t)) continue;
      if (t === T.WALL) sema(x * TILE + 8, y * TILE + 2);
      else if (!isIsland(x - 1, y) || !isIsland(x + 1, y)) sema(x * TILE + 8, (y + 1) * TILE);
    }
    // ราวสะพาน: ขอบไม้กระดานที่ติดน้ำ
    const isWater = (t) => t === T.WATER || t === T.WATER2;
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      if (gt(x, y) !== T.WOOD) continue;
      const X = x * TILE, Y = y * TILE;
      if (isWater(gt(x - 1, y))) this.add.rectangle(X - 1, Y, 3, TILE, 0x4a2c12).setOrigin(0).setDepth(0.31);
      if (isWater(gt(x + 1, y))) this.add.rectangle(X + TILE - 2, Y, 3, TILE, 0x4a2c12).setOrigin(0).setDepth(0.31);
      if (isWater(gt(x, y - 1))) this.add.rectangle(X, Y - 1, TILE, 3, 0x4a2c12).setOrigin(0).setDepth(0.31);
      if (isWater(gt(x, y + 1))) { this.add.rectangle(X, Y + TILE - 2, TILE, 3, 0x4a2c12).setOrigin(0).setDepth(0.31); this.add.rectangle(X, Y + TILE + 1, TILE, 4, 0x000000, 0.25).setOrigin(0).setDepth(0.3); }
    }
  }



  buildProps() {
    for (const p of this.layout.props) {
      // ภาพ PixelLab (env/…) ถ้ามี · ไม่มี → ภาพสำรอง (alt) ที่วาดด้วยโค้ด
      let key = p.key, scale = p.scale;
      if (!this.textures.exists(key)) { key = p.alt; scale = p.altScale ?? p.scale; }
      if (!key || !this.textures.exists(key)) continue;
      p.drawn = true;
      const img = this.add.image(p.x, p.y, key).setOrigin(0.5, 1).setDepth(p.depth ?? p.y);
      if (p.flip) img.setFlipX(true);
      if (scale) img.setScale(scale);
      const env = key.startsWith('env/');
      if (p.foot?.[0] && key !== 'boat') this.add.ellipse(p.x, p.y - 1, img.displayWidth * (env ? 0.7 : 0.8), env ? Math.min(12, img.displayWidth * 0.18) : 7, 0x000000, 0.22).setDepth(0.6);
      if (p.label) makeText(this, p.x, p.y - img.displayHeight - 3, p.label, { fontSize: '6px', color: '#f7dc6f' }).setOrigin(0.5, 1).setDepth(p.y + 1);
      if (p.warp) this.warpGate = { x: p.x, y: p.y };
    }
    const zoneLabel = (tx, ty, text) => makeText(this, tx * TILE, ty * TILE, text, { fontSize: '8px', color: '#ffe9a6' }).setOrigin(0.5).setDepth(9000).setAlpha(0.85);
    zoneLabel(86, 16, '✦ วัดพระศรีสรรเพชญ์ ✦'); zoneLabel(33, 14, '✦ วัดไชยวัฒนาราม ✦'); zoneLabel(60, 42, '⛲ ลานเมือง'); zoneLabel(60, 84, '⚔ ประตูเมืองใต้'); zoneLabel(60, 106, '🌾 ทุ่งนาบางปะอิน'); zoneLabel(60, 62, '🧺 ตลาดหัวรอ'); zoneLabel(30, 50, '🥊 สำนักดาบ·มวย'); zoneLabel(92, 50, '🔨 ย่านช่างน้ำพี้');
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
    const okPos = (q) => q && Number.isFinite(q.x) && !this.solid?.[Math.floor((q.y - 2) / TILE)]?.[Math.floor(q.x / TILE)] && q.y < MAP_H * TILE;
    const pos = okPos(char.tdPos) ? char.tdPos : SPAWN;
    const p = this.physics.add.sprite(pos.x, pos.y, key, 'idle_0').setOrigin(0.5, 1).setDepth(pos.y);
    p.body.setSize(12, 8).setOffset((p.width - 12) / 2, p.height - 8); p.bodyFoot = [12, 8];
    Object.assign(p, { char, texKey: key, legacyKey: key, d8id: heroId(char.appearance), dir: 'south', facing: 1, st: 'idle', path: [], target: null, nextAtk: 0, buffs: [], dead: false });
    Object.defineProperty(p, 'alive', { get() { return !this.dead; } });
    Object.defineProperty(p, 'derived', { get() { return getDerived(this.char); } });
    p.cooldownLeft = () => 0;
    p.combatStats = () => getDerived(p.char);
    this.addShadow(p, 22);
    p.holdAttack = () => p.char.appearance.job !== 'boxer';
    p.actionAnim = () => ACTION_ANIM[p.char.appearance.job];      // ดาบ/ไม้เท้า/ธนู ใช้ท่ายืน + อาวุธเหวี่ยง · มวยใช้ท่าต่อยจริง (ถ้ามี)
    this.player = p;
    this.physics.add.collider(p, this.blocks);
    this.nameTag = makeText(this, 0, 0, char.name, { fontSize: '7px', color: '#fff3c4' }).setOrigin(0.5, 1).setDepth(99999);
    p.on('animationcomplete', (anim) => { if (/:(attack|cast|hit|slash|shoot)(:|$)/.test(anim.key) && p.alive) p.st = 'idle'; });
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
      this.npcPlate(n, spr);
      spr.setInteractive({ useHandCursor: true });
      spr.on('pointerdown', (ptr) => { ptr.event.stopPropagation(); this.talk(n); });
      spr.on('pointerover', () => { this.hovered = spr; document.body.dataset.cursor = 'talk'; });
      spr.on('pointerout', () => { if (this.hovered === spr) this.hovered = null; delete document.body.dataset.cursor; });
      if (n.id === 'quest') {                                                              // เครื่องหมาย ! ทองลอยเหนือป้ายชื่อ
        const y0 = n.y - spr.height - 30;
        const g = this.add.graphics().setDepth(n.y + 3);
        g.fillStyle(0x5a1611, 1).fillCircle(0, 0, 6).lineStyle(1.5, 0xf4d03f).strokeCircle(0, 0, 6);
        const t = makeText(this, 0, 1, '!', { fontSize: '9px', color: '#ffe082' }).setOrigin(0.5);
        const q = this.add.container(n.x, y0, [g, t]).setDepth(n.y + 3);
        this.tweens.add({ targets: q, y: y0 - 4, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
      return { ...n, icon: NPC_ICON[n.id], spr, line: 0 };
    });
  }

  /** ป้ายชื่อ NPC: กรอบรักดำขอบทอง · บรรทัดบน = หน้าที่ (ไอคอน) · บรรทัดล่าง = ชื่อ */
  npcPlate(n, spr) {
    const top = n.y - spr.height - 2;
    const role = makeText(this, 0, 0, `${NPC_ICON[n.id] || '💬'} ${n.role}`, { fontSize: '6px', color: '#f7dc6f' }).setOrigin(0.5, 1);
    const name = makeText(this, 0, 0, n.nameTh, { fontSize: '7px', color: n.color || '#ffffff' }).setOrigin(0.5, 1);
    const w = Math.max(role.width, name.width) / 1 + 8, h = role.height + name.height - 2;
    name.setY(0); role.setY(-name.height + 3);
    const g = this.add.graphics();
    g.fillStyle(0x140a1c, 0.78).fillRoundedRect(-w / 2, -h - 1, w, h + 2, 3);
    g.lineStyle(1, 0xd4af37, 0.85).strokeRoundedRect(-w / 2, -h - 1, w, h + 2, 3);
    g.fillStyle(0xd4af37, 1).fillTriangle(-2, 1, 2, 1, 0, 3);
    this.add.container(n.x, top - 2, [g, role, name]).setDepth(n.y + 2);
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

  setTarget(m, auto = false) {
    if (!m.alive) return;
    this.player.target = m; this.player.path = [];
    this.ui.setTarget({ def: { ...m.def, hp: m.maxHp }, get hp() { return m.hp; }, get alive() { return m.alive; } });
    if (!auto) this.sfx.play('target');
  }

  /** Auto: ผีที่ใกล้ที่สุดในรัศมีรอบตัว (นอกเมืองเท่านั้น) */
  autoPick() {
    const p = this.player;
    if (this.inTown()) return null;
    let best = null, bd = AUTO_RADIUS;
    for (const m of this.mobs) {
      if (!m.alive || m.visible === false) continue;
      const d = dist(p, m);
      if (d < bd) { bd = d; best = m; }
    }
    return best;
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
    this.playerAnim('attack', true);
    const magic = JOBS[p.char.appearance.job]?.attack?.kind === 'magic';
    // จังหวะ: ง้าง/รวมพลังก่อน แล้วค่อยปล่อย (ธนู ~170ms · เวท ~150ms · ดาบฟันตอน ~110ms)
    const fireAt = ranged ? (magic ? 150 : 170) : 110;
    if (!ranged) { const k = Math.min(1, 4 / Math.max(1, dist(p, m))); this.tweens.add({ targets: p, x: p.x + (m.x - p.x) * k, y: p.y + (m.y - p.y) * k, duration: 90, yoyo: true, ease: 'Quad.easeOut' }); }
    this.time.delayedCall(ranged ? fireAt - 40 : 0, () => this.sfx.play(ranged ? 'arrow' : 'swing'));
    if (ranged) this.time.delayedCall(fireAt, () => m.alive && p.alive && this.vfx.shoot(p, m, magic ? 'magic' : 'arrow'));
    else this.time.delayedCall(fireAt, () => m.alive && this.vfx.slash(p, m, false));
    if (this.econ.server) { this.time.delayedCall(fireAt + (ranged ? 60 : 40), () => m.alive && this.net.send('td:hit', { mid: m.mid })); return; }
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
    if (r.mastery) this.ui.toast(`${JOBS[r.mastery.job]?.icon || '⚔️'} ความชำนาญ${JOBS[r.mastery.job]?.weaponTh || 'อาวุธ'} Lv.${r.mastery.lv} (โจมตี +${r.mastery.lv}%)`, 'ok', 2500);
    this.ui.hudCache = '';
  }

  onPlayerHit(d) {
    const p = this.player;
    p.hurtAt = Date.now();
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

  quickUse(ids, quiet = false) {
    const c = this.player.char, id = ids.find((i) => count(c, i) > 0);
    if (!id) return quiet ? null : this.ui.toast('ไม่มียาเหลือแล้ว', 'warn');
    if (!this.player.alive) return;
    this.econ.act('use', { id }).then((r) => {
      if (r.ok) this.sfx.play('potion');
      if (quiet && r.ok) this.ui.loot?.(`🧪 กินยาอัตโนมัติ: ${ITEMS[id].nameTh}`);
      if (!quiet || r.ok) this.ui.result(r);
    });
  }

  /** กินยาอัตโนมัติเมื่อ HP/MP ต่ำกว่า % ที่ตั้งไว้ (ตั้งค่า → การต่อสู้) */
  autoPotion(time) {
    const p = this.player, set = this.settings || {};
    if (!p.alive || time < (this.nextAutoPot || 0) || this.econ.pending) return;
    const c = p.char, d = getDerived(c);
    const hp = set.autoHp && c.hp / d.maxHp * 100 < set.autoHp && HP_POTS.some((i) => count(c, i));
    const mp = !hp && set.autoMp && c.mp / d.maxMp * 100 < set.autoMp && MP_POTS.some((i) => count(c, i));
    if (!hp && !mp) return;
    this.nextAutoPot = time + 1500;
    this.quickUse(hp ? HP_POTS : MP_POTS, true);
  }

  /** กดช่อง Hotbar: ไอเทม → ใช้/สวม/ร่ายยันต์ · สกิล → ร่าย */
  useSlot(key) {
    const v = this.player.char.hotbar?.[key];
    if (!isItemSlot(v)) return this.skills.cast(key);
    if (this.ui.anyOpen?.() || !this.player.alive) return;
    const id = slotItemId(v), it = ITEMS[id], c = this.player.char;
    if (['weapon', 'armor', 'accessory'].includes(it.type)) {
      if (Object.values(c.equipment || {}).includes(id)) return this.ui.toast(`${it.nameTh} ใส่อยู่แล้ว`, '', 1200);
      if (count(c, id) <= 0) return this.ui.toast(`ไม่มี ${it.nameTh} ในกระเป๋า`, 'warn');
      return this.econ.act('equip', { id }).then((r) => { this.ui.result(r); if (r.ok) this.sfx.play('equip'); });
    }
    if (count(c, id) <= 0) return this.ui.toast(`${it.nameTh} หมดแล้ว`, 'warn');
    if (it.type === 'home') return this.recall();
    this.quickUse([id]);
  }

  /** เปิด/ปิด Auto Skill (ปุ่ม A หรือปุ่ม AUTO ข้างแถบสกิล) */
  toggleAutoSkill(on = !this.settings.autoSkill) {
    this.settings.autoSkill = on; saveSettings(this.settings);
    $('#auto-skill')?.classList.toggle('on', on);
    this.ui.toast(on ? '⚡ Auto: เปิด — ตีผีรอบตัวเอง + ร่ายสกิลในแถบ 1–0 อัตโนมัติ (เดิน/คลิกพื้นเพื่อพักชั่วคราว)' : 'Auto: ปิด', on ? 'ok' : '', 2200);
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
    net.connect(this.player.char.name, () => ({ token: account.token, slot: account.slot }));
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
    s.legacyKey = key; s.d8id = heroId(q.appearance); s.holdAttack = () => q.appearance?.job !== 'boxer'; s.actionAnim = () => ACTION_ANIM[q.appearance?.job];
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
    $('#skillbar')?.addEventListener('click', (e) => { const k = e.target.closest('.skill')?.dataset.key; if (k) this.useSlot(k); });
    kb.on('keydown-F', () => {
      if (this.ui.typing) return;
      if (this.life.fish) return this.life.press();
      const n = this.nearestNpc(60);
      if (n) return this.talk(n);
      this.life.action();
    });
    for (const k of SKILL_SLOTS) kb.on(`keydown-${SLOT_KEYNAME[k]}`, () => this.useSlot(k));   // Hotbar 1–0 (สกิล/ไอเทม)
    kb.on('keydown-B', () => this.recall());
    kb.on('keydown-A', () => { if (!this.ui.anyOpen?.()) this.toggleAutoSkill(); });
    { const bt = $('#auto-skill'); if (bt) { bt.classList.toggle('on', !!this.settings.autoSkill); bt.onclick = () => this.toggleAutoSkill(); } }
    kb.on('keydown-I', () => this.ui.toggle('inv-panel'));
    kb.on('keydown-C', () => this.ui.toggle('stats-panel'));
    kb.on('keydown-K', () => this.ui.toggle('skill-panel'));
    kb.on('keydown-J', () => this.village.openQuests());
    kb.on('keydown-H', () => this.ui.toggle('help-panel'));
    kb.on('keydown-M', () => this.world.toggleMap());
    kb.on('keydown-ENTER', () => this.ui.focusChat());
    kb.on('keydown-ESC', () => (this.ui.anyOpen() ? this.ui.closeAll() : this.ui.toggle('settings-panel', true)));
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
  /** เดินเส้นตรงจาก a → b ได้ไหม (สุ่มจุดทุก 4px + กว้างตัวละคร) */
  lineClear(ax, ay, bx, by) {
    const d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d / 4), solid = this.solid;
    for (let i = 1; i <= n; i++) {
      const x = ax + (bx - ax) * i / n, y = ay + (by - ay) * i / n;
      for (const ox of [-5, 5]) { const tx = Math.floor((x + ox) / TILE), ty = Math.floor(y / TILE); if (solid[ty]?.[tx] !== false) return false; }
    }
    return true;
  }

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
      } else if (this.settings.autoSkill && !p.path.length && !this.recalling && time > (p.nextAuto || 0)) {
        // Auto: ไม่มีเป้า/ไม่ได้สั่งเดิน → ล็อกผีที่ใกล้ที่สุดในรัศมีรอบตัวแล้วตีเอง
        p.nextAuto = time + 300;
        const m = this.autoPick();
        if (m) this.setTarget(m, true);
      }
      if (!vx && !vy && p.path.length) {
        // ทางลัด: ถ้ามองเห็นจุดถัดไปตรง ๆ ข้ามจุดกลางทาง → เดินเป็นเส้นตรง ไม่ซิกแซกตามช่องตาราง
        while (p.path.length > 1 && this.lineClear(p.x, p.y - 2, p.path[1].x, p.path[1].y)) p.path.shift();
        const n = p.path[0], dx = n.x - p.x, dy = n.y - (p.y - 2), d = Math.hypot(dx, dy);
        if (d < 5) p.path.shift(); else { vx = dx / d; vy = dy / d; }
        if (!p.path.length && this.pendingTalk) { const n2 = this.pendingTalk; this.pendingTalk = null; this.talk(n2); }
      }
      if (p.st === 'attack') p.setVelocity(0, 0);
      else if (vx || vy) {
        const len = Math.hypot(vx, vy) || 1;
        p.setVelocity(vx / len * SPEED, vy / len * SPEED);
        p.dir = stableDir(vx, vy, p.dir); p.st = 'walk'; this.playerAnim('walk');
      } else { p.setVelocity(0, 0); p.st = 'idle'; this.playerAnim('idle'); }
      if (!this.econ.server && this.inTown() && p.char.hp < p.derived.maxHp) p.char.hp = Math.min(p.derived.maxHp, p.char.hp + p.derived.maxHp * 0.04 * dt);
    } else p.setVelocity(0, 0);
    p.setDepth(p.y);
    this.nameTag.setPosition(p.x, p.y - p.displayHeight - 3);
    // วงรัศมี Auto (จางๆ ใต้เท้า)
    if (!this.autoRing) {
      this.autoRing = this.add.graphics().setDepth(1);
      this.autoRing.lineStyle(1, 0xffd35c, 0.35).strokeEllipse(0, 0, AUTO_RADIUS * 2, AUTO_RADIUS * 2);
      this.autoRing.fillStyle(0xffd35c, 0.04).fillEllipse(0, 0, AUTO_RADIUS * 2, AUTO_RADIUS * 2);
    }
    this.autoRing.setPosition(p.x, p.y).setVisible(!!this.settings.autoSkill && p.alive && !this.inTown());
    for (const sh of this.shadows) sh.img.setPosition(sh.obj.x, sh.obj.y + 1).setVisible(sh.obj.visible && sh.obj.alpha > 0.2);
    for (const m of this.mobs) { if (this.econ.server) this.updateMobOnline(m, dt); else this.updateMobLocal(m, time); this.drawMob(m); }
    this.remotes.forEach((r) => r.update(dt));
    this.weapons?.update(time);
    this.skills?.autoTick(time);
    this.life?.update(time, dt);
    this.autoPotion(time);
    // ส่งตำแหน่ง ~10 ครั้ง/วิ
    if (this.net?.online && time - (this.sentAt || 0) > 100) {
      const st = { x: Math.round(p.x), y: Math.round(p.y), dir: p.dir, anim: p.alive ? (p.st === 'walk' ? 'walk' : p.st === 'attack' ? 'attack' : 'idle') : 'die' };
      const sig = JSON.stringify(st);
      st.mp = Math.round(p.char.mp);
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
      $('#td-zone').textContent = zone === 'town' ? '🏯 เกาะเมือง (Safe Zone)' : '🌾 หุ่นไล่กาผีสิง · กุมารทอง · นางตานี';
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
