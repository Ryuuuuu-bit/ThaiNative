// ============================================================
//  TopDownScene – New Version "กรุงศรีอยุธยา" (มุมบนเฉียง เดิน 8 ทิศ คลิกเดิน/คลิกตี แนว RO)
//  ▸ ออนไลน์: server คุมผี/ดาเมจ/รางวัล/HP/เซฟ (server/td.js) · เห็นผู้เล่นคนอื่น · แชท · ร้าน/เควส/กระเป๋า/สกิล/สถานะ (UI ชุดเดิม)
//  ▸ ออฟไลน์ (เปิดไฟล์ตรง ไม่มี server): จำลองผีในเครื่อง + เซฟในเครื่อง
//  ▸ ภาพ: ใช้สไปรต์ 8 ทิศจาก assets/td เมื่อมี · ไม่มี → ใช้สไปรต์ด้านข้างชุดเดิม
// ============================================================
import { RENDER_SCALE } from '/shared/constants.js';
import { MONSTERS } from '/shared/data/monsters.js';
import { ITEMS } from '/shared/data/items.js';
import { JOBS } from '/shared/data/classes.js';
import { getDerived } from '/shared/character.js';
import { attackInterval, buffAspd } from '/shared/stats.js';
import { gainExp, PRESET_LABEL, presetInfo } from '/shared/charmodel.js';
import { bakeCharacter } from '../gfx/SpriteFactory.js';
import { bakeFx, popupNumber, hitSpark, yantCircle, squash } from '../gfx/Fx.js';
import { makeText, gmStyle, uiIcon, itemIcon as itemIconHtml, ICONS, EMO_ICON } from '../systems/util.js';
import { sound } from '../systems/Sound.js';
import { loadSettings, saveSettings } from '../systems/Settings.js';
import { saveCharacter } from '../systems/Character.js';
import { UI, rarityOf, npcPortrait } from '../systems/UI.js';
import { Village } from '../systems/Village.js';
import { QuestNavigator } from '../topdown/QuestNavigator.js';
import { TdLife } from '../topdown/TdLife.js';
import { Econ } from '../net/Econ.js';
import { Network } from '../net/Network.js';
import { account } from '../net/Account.js';
import { emojiOnly } from '../systems/ChatBox.js';
import { questState as qState } from '../systems/Inventory.js';
import { QUESTS } from '/shared/data/village.js';
import { count } from '../systems/Inventory.js';
import { TILE, T, SPAWN as TD_SPAWN, isIsland, bakeTileset, bakeProps, OX } from '../topdown/AyutthayaMap.js';
import { TD_MAPS, EVENT_MAPS, getMap, validMap, arrivalPoint, RESPAWN_WAIT_MS } from '/shared/td/maps.js';
import { nightInfo } from '/shared/data/world.js';
import { CRYPT_ZONES, lvOf } from '/shared/data/crypt.js';
import { WorldBossUI } from '../topdown/WorldBoss.js';
import { GhostDungeonUI } from '../topdown/GhostDungeon.js';
import { hasDir8, resolveAct } from '../topdown/Dir8.js';
import { dirFromVector, stableDir, playDir, registerDir8, texKey, animKey, DIRS as D8_DIRS } from '../topdown/Dir8.js';
import { TdSkills } from '../topdown/TdSkills.js';
import { GEAR_TYPES, FLASK_SLOTS } from '/shared/data/slots.js';
import { SKILL_SLOTS, SLOT_KEYNAME, isItemSlot, slotItemId } from '/shared/data/skills.js';
import { WeaponOverlay } from '../topdown/WeaponOverlay.js';
import { TdSocial } from '../topdown/TdSocial.js';
import { TdWorldMap } from '../topdown/TdWorldMap.js';
import { TITLE_BY_ID } from '/shared/data/titles.js';
import { TouchControls } from '../topdown/TouchControls.js';
import { Tutorial } from '../topdown/Tutorial.js';
import { ALL_ASSETS } from '/shared/data/td_assets.js';
import { bakeGround, makeWater, TdAtmosphere, bakeTdFx, TdVfx, TdMinimap } from '../topdown/TdTheme.js';
import { uiBlocked } from '../systems/uiGuard.js';
import { NpcDialog } from '../topdown/NpcDialog.js';
import { notice } from '../systems/Dialog.js';
import { NpcLife, SERVICE } from '../topdown/NpcLife.js';
import { heroId, baseHeroId } from '../systems/HeroPreview.js';
import { Townsfolk } from '../topdown/Townsfolk.js';
import { ThreeWorld } from '../topdown/ThreeWorld.js';
const NONE = '__none';                                  // autoMobs: ยกเลิกทั้งหมด (Auto ไม่ไล่ตีผี)

const $ = (s) => document.querySelector(s);
/** ท่าโจมตีจริงตามอาวุธ (ถ้ามีภาพ): ดาบ = ฟัน · ธนู = ยิง · ไม้เท้า = ร่าย · มวย = ต่อย */
const ACTION_ANIM = { swordman: 'slash', archer: 'shoot', mage: 'cast', boxer: 'attack', healer: 'heal' };   // heal = ท่าพนมมือแล้วปล่อยแสงรักษา (ชุดที่ยังไม่มีภาพ → cast)
const SPEED = 92;
/** ความเร็ว/วนซ้ำของท่า 8 ทิศ */
const D8_RATE = { idle: [5, true], walk: [10, true], attack: [14, false], slash: [20, false], shoot: [18, false], cast: [18, false], heal: [20, false], hit: [12, false], die: [8, false] };
/** ระบบ Auto: หาผีเองในรัศมีนี้รอบตัว (px ≈ 10 ช่อง) */
const AUTO_MARGIN = 24;                                    // Auto: ตีผีทุกตัวที่อยู่ในหน้าจอ (ขอบจอเผื่อไว้นิดหน่อย)
const AUTO_GIVEUP = 6000;                                  // ไล่เป้า Auto นานเกินนี้โดยไม่ได้ตี (ทางตัน) → ข้ามไปตัวอื่นชั่วคราว                                   // ความเร็วเดิน (px/วิ) – ตรงกับ server/td.js
const AYT_SPAWN = TD_SPAWN;                                 // ลานน้ำพุกลางกรุงศรีฯ (ยันต์คืนถิ่น)
const HP_POTS = ['hp_s', 'hp_m', 'pot_aloe', 'pot_turmeric'];
const MP_POTS = ['mp_s', 'mp_m', 'pot_anchan'];
/** NPC → หน้าต่างบริการ (ชุดเดียวกับโลกเดิม) */
const NPC_OPEN = { market: 'market', travel: 'travel', shop: 'mae_kha', smith: 'lung_dam', cook: 'pa_sa', tailor: 'tailor', kru_sword: 'kru_sword', kru_mage: 'kru_mage', kru_archer: 'kru_archer', kru_boxer: 'kru_boxer', kru_healer: 'kru_healer' };
const NPC_ICON = { market: '⚓', travel: '🎁', shop: '🧪', quest: '❗', smith: '🔨', tailor: '👘', cook: '🍲', kru_sword: '⚔️', kru_mage: '🔮', kru_archer: '🏹', kru_boxer: '🥊', kru_healer: '🌿', crypt: '💀', ghostdg: '☠️' };
const rand = (a, b) => a + Math.random() * (b - a);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const DIRS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
const dirOfIndex = (i) => DIRS[((i % 8) + 8) % 8];

export class TopDownScene extends Phaser.Scene {
  constructor() { super('ayutthaya'); }

  /** โหลดภาพ 8 ทิศที่มีแล้ว (assets/td/manifest.json) – ไม่มีก็เล่นได้ด้วยภาพเดิม */
  preload() {
    this.load.json('td_manifest', '/assets/td/manifest.json');
    this.load.once('filecomplete-json-td_manifest', (_k, _t, data) => {
      this.d8meta = {};
      // ผี: โหลดเฉพาะของแมพที่เกิด (แมพอื่นทยอยโหลดเบื้องหลังหลังเข้าเกม · ~30MB → ไม่กี่ MB ตอนเปิด)
      const startMap = validMap(this.sys.settings.data?.char?.tdMap);
      for (const [id, ent] of Object.entries(data?.sprites || {})) this.d8meta[id] = Array.isArray(ent) ? { anims: ent } : ent;
      const needMobs = new Set(this.mobSpriteIds(startMap));
      for (const [id, meta] of Object.entries(this.d8meta)) {
        if (meta.lazy || (id.startsWith('mob_') && !needMobs.has(id))) continue;    // ชุดเต็มตัว: โหลดเมื่อมีคนสวม · ผีแมพอื่น: โหลดทีหลัง
        for (const anim of [...meta.anims,...(meta.sources||[])]) this.load.image(texKey(id, anim), `/assets/td/${id}/${anim}.png`);
      }
      for (const id of data?.images || []) this.load.image(id, `/assets/td/${id}.png`);
      for (const id of data?.tilesets || []) this.load.image(`ts_${id}`, `/assets/td/tiles/${id}.png`);
      this.tilesets = data?.tilesets || [];
    });
    this.load.on('loaderror', () => {});
  }

  create({ char }) {
    // ภาพ 8 ทิศจาก manifest (จำนวนเฟรมจริงของแต่ละท่า) ก่อน แล้วค่อยใช้ค่าตั้งต้นจากแผน asset
    for (const id of Object.keys(this.d8meta || {})) this.registerHero(id);
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
    this.visitedMaps = Array.isArray(char.tdMaps) && char.tdMaps.length ? [...char.tdMaps] : ['ayutthaya'];
    this.setMapDef(validMap(char.tdMap));
    this.remotes = new Map();
    this.shadows = [];
    this.mapObjs = this.track(() => { this.buildMap(); this.buildProps(); });
    this.buildPlayer(char);
    this.buildAdapters();
    this.econ = new Econ(this);
    this.ui = new UI(this);
    this.village = new Village(this);
    this.questNav = new QuestNavigator(this);
    this.village.renderTracker();
    this.life = new TdLife(this);
    // HUD: ย้ายปุ่มเมนูลงมุมขวาล่าง (ข้าง Hotbar) · ซ่อนแถบคำแนะนำหลัง 15 วิ
    { const hb = document.querySelector('.hud-buttons'); if (hb) { hb.classList.add('dock'); $('#hud').appendChild(hb);
      // จอสัมผัส: เมนูพับเป็นปุ่ม ☰ (กดแล้วกางเป็นตาราง · กดเมนูใดก็พับกลับ)
      if (!$('#dock-toggle')) { const t = document.createElement('button'); t.id = 'dock-toggle'; t.title = 'เมนู'; t.textContent = '☰'; $('#hud').appendChild(t);
        t.onclick = (e) => { e.stopPropagation(); hb.classList.toggle('open'); };
        hb.addEventListener('click', () => hb.classList.remove('open'));
        document.addEventListener('pointerdown', (e) => { if (!e.target.closest('#dock-toggle, .hud-buttons.dock')) hb.classList.remove('open'); }); } } }
    { const tb = document.querySelector('#td-hud .td-bottom'); if (tb) { tb.classList.remove('fade'); clearTimeout(this._hintT); this._hintT = setTimeout(() => tb.classList.add('fade'), 15000); } }
    document.querySelector('.minimap')?.classList.add('hidden');
    this.mapObjs.push(...this.track(() => { this.buildNpcs(); this.buildMonsters(); this.buildPortals(); }));
    this.buildInput();
    $('#td-hud').classList.remove('hidden');

    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.mapW * TILE, this.mapH * TILE).setZoom(1.5 * RENDER_SCALE).startFollow(this.player, false, 0.14, 0.14).setRoundPixels(true);
    this.atmo = new TdAtmosphere(this, this.layout); this.atmo.setLayout(this.layout, this.M.style);
    this.folk = new Townsfolk(this); this.folk.build();                                  // ชาวกรุงเดินไปมาในเมือง (ตกแต่ง)
    this.life.setMap(this.M);
    this.vfx = new TdVfx(this);
    this.skills = new TdSkills(this);
    this.time.delayedCall(4000, () => this.preloadOtherMobs());                     // ผีแมพอื่น: โหลดเบื้องหลังหลังเข้าเกม
    this.weapons = new WeaponOverlay(this);
    this.touch = new TouchControls(this);
    this.ui.chatBox?.load(`${account.slot ?? 0}_${char.name}`);
    if (document.body.classList.contains('touch')) this.ui.chatBox?.collapse(true);
    this.weapons.attach(this.player, () => this.player.look(), () => ({ anim: this.player.st }));
    this.minimap = new TdMinimap(this.groundMini); this.ui.syncSettings?.();   // ซ่อนมินิแมพตามตั้งค่า (สร้างหลัง UI)
    try { this.threeWorld = new ThreeWorld(this); }
    catch (error) { console.error('Three.js world initialization failed', error); this.ui.toast('เปิดฉาก 2.5D ไม่สำเร็จ กรุณาตรวจ WebGL แล้วรีเฟรช', 'warn'); }
    this.zone = null;
    this.ui.updateHud();
    this.setupNetwork();
    this.time.delayedCall(2500, () => this.cosRefundNotice());          // เคยมีชุดแต่งตัว → แจ้งยอดเงินที่คืน
    if ((this.player?.char?.level || 1) > 3) this.ui.news?.autoOpen();   // มีข่าวใหม่ → เปิดกระดานข่าวครั้งเดียว · ตัวใหม่ (Lv.1–3) ให้เห็นการแนะนำก่อน
    if (this.econ.server) { this.social = new TdSocial(this); this.wb = new WorldBossUI(this); this.wb.bind(this.net); this.gd = new GhostDungeonUI(this); this.gd.bind(this.net); }   // บอสโลกพระราหู           // ปาร์ตี้ · เทรด · เพื่อน · อันดับ · ฉายา (ต้องออนไลน์)
    this.ui.toast(this.M.realm ? `${this.M.icon} ${this.M.nameTh} · ${this.M.sub}` : '🏯 ยินดีต้อนรับสู่กรุงศรีอยุธยา · คลิกพื้นเพื่อเดิน คลิกผีเพื่อโจมตี · คลิก NPC เพื่อเปิดร้าน', '', 6000);
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
    this.map = { id: 'ayutthaya', no: 0, nameTh: 'กรุงศรีอยุธยา', minX: 0, get maxX() { return s.mapW * TILE; }, gates: [], region: 'r1', get safe() { return s.inTown(); } };
    this.worldMap = new TdWorldMap(this);
    this.world = { toggleMap: () => this.worldMap.toggle() };
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
      this.applyHero(p, p.char.appearance, () => this.refreshPlayerAnimation());
      this.playerAnim('idle', true);
      this.updateQuestMark();                                         // เปลี่ยนอาวุธ → ป้าย ! ของครูอาชีพเปลี่ยนตาม
    };
    this.saveSoon = () => { if (!this.econ?.server) saveCharacter(this.player.char); };
    // ยันต์คืนถิ่น: ร่าย 2.5 วิ (ขยับ/โดนตี = ยกเลิก) แล้ววาร์ปกลับลานน้ำพุกลางเมือง
    this.recall = () => {
      const p = this.player;
      if (!p.alive || this.recalling) return;
      if (count(p.char, 'yant_home') <= 0) return this.ui.toast('ไม่มียันต์คืนถิ่น (ซื้อได้ที่ร้านยายติ๋ม)', 'warn');
      if (this.M.id === 'ayutthaya' && this.inTown()) return this.ui.toast('อยู่ในเมืองอยู่แล้ว', '', 1800);
      const start = { x: p.x, y: p.y }, hurt = p.hurtAt || 0;
      p.path = []; p.target = null;
      this.recalling = true;
      yantCircle(this, p.x, p.y, { tint: 0x9fe0ff, size: 60, ms: 2500 });
      const cast = this.ui.castBar('ยันต์คืนถิ่น · กลับกรุงศรีฯ', 2500, uiIcon('menu_home') || itemIconHtml('yant_home', '📜'));
      // ขยับ/โดนตีระหว่างร่าย → ยกเลิกทันที (ไม่ต้องรอครบ 2.5 วิ)
      const watch = this.time.addEvent({ delay: 100, loop: true, callback: () => { if (!p.alive || dist(p, start) > 6 || (p.hurtAt || 0) !== hurt) { watch.remove(); this.recalling = false; cast.cancel(); this.ui.toast('การร่ายถูกขัดจังหวะ', 'warn'); this.recallT?.remove(); } } });
      this.recallT = this.time.delayedCall(2500, async () => {
        watch.remove();
        this.recalling = false;
        if (!p.alive || dist(p, start) > 6 || (p.hurtAt || 0) !== hurt) { cast.cancel(); return this.ui.toast('การร่ายถูกขัดจังหวะ', 'warn'); }
        cast.done();
        const r = await this.econ.act('recall', {});
        if (!r.ok) return this.ui.result(r);
        if (this.M.id !== 'ayutthaya') this.loadMap('ayutthaya', AYT_SPAWN);    // ออนไลน์: server ส่ง td:warp มาก่อนแล้ว (ซ้ำได้ ไม่มีผล)
        p.setPosition(AYT_SPAWN.x, AYT_SPAWN.y); p.path = []; this.sfx.play('levelup');
        yantCircle(this, AYT_SPAWN.x, AYT_SPAWN.y, { tint: 0x9fe0ff, size: 70, ms: 900, rise: true });
        this.ui.toast('กลับถึงลานน้ำพุกลางเมือง', 'ok', 2200);
      });
    };
    this.nearNpc = (id) => this.npcs?.some((n) => n.id === id && dist(n, this.player) < 60);
  }

  inTown() { return !!this.player && this.M.inSafe(this.player.x, this.player.y); }

  // ------------------------------------------------------------
  //  หลายแมพ: กรุงศรีฯ + แมพต่างแดน (สลับในฉากเดิม ไม่โหลดหน้าใหม่)
  // ------------------------------------------------------------
  setMapDef(id) {
    this.M = getMap(id); this.layout = this.M.layout(); this.mapW = this.M.W; this.mapH = this.M.H;
    if (!this.M.crypt && !this.visitedMaps.includes(this.M.id)) this.visitedMaps.push(this.M.id);
    this.cryptOpen = false;
  }

  /** เรียก fn แล้วคืนรายการวัตถุในฉากที่ถูกสร้างขึ้นระหว่างนั้น (ไว้ลบตอนเปลี่ยนแมพ) */
  track(fn) { const before = new Set(this.children.list); fn(); return this.children.list.filter((o) => !before.has(o)); }

  /** เปลี่ยนแมพ: ลบของแมพเก่า (พื้น/น้ำ/ของประกอบฉาก/NPC/ผี/ประตู) → สร้างแมพใหม่ → วางผู้เล่นที่ pos */
  loadMap(id, pos) {
    id = validMap(id);
    const p = this.player;
    if (id === this.M.id) { if (pos) { p.setPosition(pos.x, pos.y); p.path = []; } return; }
    this.life?.stop?.('เปลี่ยนแมพ');
    p.target = null; p.autoTarget = null; p.path = []; p.setVelocity(0, 0); this.pendingTalk = null; this.hovered = null;
    this.ui.setTarget?.(null); this.ui.closeAll?.();
    for (const o of this.mapObjs) { this.tweens.killTweensOf(o); o.destroy(); }
    this.blocks.clear(true, true); this.blocks.destroy(); this.monsters?.clear(false, false); this.monsters?.destroy();
    this.shadows = this.shadows.filter((sh) => { if (sh.obj.scene) return true; sh.img.destroy(); return false; });
    this.remotes.forEach((r) => r.destroy()); this.remotes.clear();
    this.folk?.clear();
    this.setMapDef(id);
    this.loadMobsFor(id);                                                           // ผีแมพใหม่ที่ยังไม่ได้โหลด (ปกติโหลดเบื้องหลังไว้แล้ว)
    this.time.delayedCall(4000, () => this.preloadOtherMobs()); this.evictSoon();   // แดนข้างเคียงใหม่ · ปล่อยภาพแดนไกล
    this.mapObjs = this.track(() => { this.buildMap(); this.buildProps(); this.buildNpcs(); this.buildMonsters(); this.buildPortals(); });
    this.folk?.build();
    this.blockCollider?.destroy(); this.blockCollider = this.physics.add.collider(p, this.blocks);
    const at = pos && !this.solid[Math.floor((pos.y - 2) / TILE)]?.[Math.floor(pos.x / TILE)] ? pos : this.M.spawn;
    p.setPosition(at.x, at.y); p.char.tdMap = id; p.char.tdPos = { x: Math.round(at.x), y: Math.round(at.y) }; p.char.tdMaps = [...this.visitedMaps];
    this.cameras.main.setBounds(0, 0, this.mapW * TILE, this.mapH * TILE).centerOn(at.x, at.y);
    this.atmo.setLayout(this.layout, this.M.style);
    this.minimap.setBase(this.groundMini);
    this.life?.setMap(this.M);
    this.worldMap = new TdWorldMap(this);
    this.area = undefined; this.portalArmed = false;
    this.ui.setOnline?.(this.net?.online, 0);
    this.ui.banner(`${this.M.icon} ${this.M.nameTh}`, this.M.sub);
    this.sfx.play('blessing');
    yantCircle(this, at.x, at.y, { tint: 0xc39bd3, size: 80, ms: 1100, rise: true });
    this.cameras.main.flash(260, 200, 170, 255);
    if (!this.econ.server) this.saveSoon();
    this.wb?.onMap();
    this.gd?.onMap();
  }

  /** ประตูมิติ: วงแสงหมุน + ป้ายปลายทาง · เดินเข้า = วาร์ป */
  buildPortals() {
    this.portals = (this.layout.portals || []).map((pt) => {
      const cr = pt.to.startsWith('crypt_') || pt.to === 'gd_exit', T2 = TD_MAPS[pt.to];
      const col = cr ? (pt.to === 'crypt_exit' || pt.to === 'gd_exit' ? 0xffd27a : pt.boss ? 0xff5a4a : 0x8fd0ff) : pt.to === 'ayutthaya' ? 0xffd27a : T2.style?.waterTint || 0xc39bd3;
      const base = this.add.ellipse(pt.x, pt.y, 60, 26, col, 0.25).setDepth(0.8).setStrokeStyle(2, col, 0.9);
      const ring = this.add.image(pt.x, pt.y - 22, 'fx_ring').setDepth(pt.y - 1).setTint(col).setScale(0.9, 1.3).setAlpha(0.85).setBlendMode(Phaser.BlendModes.ADD);
      const core = this.add.image(pt.x, pt.y - 22, 'fx_glow').setDepth(pt.y - 2).setTint(col).setDisplaySize(46, 64).setAlpha(0.55).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: ring, angle: 360, duration: 3200, repeat: -1 });
      this.tweens.add({ targets: core, alpha: 0.25, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.add.particles(pt.x, pt.y - 20, 'fx_spark', { speedY: { min: -40, max: -15 }, speedX: { min: -12, max: 12 }, lifespan: 1100, scale: { start: 0.25, end: 0 }, alpha: { start: 0.9, end: 0 }, tint: col, frequency: 70, blendMode: 'ADD', x: { min: -16, max: 16 } }).setDepth(pt.y);
      const lock = !cr && (this.player?.char.level || 1) < T2.reqLv;
      const tag = cr ? this.cryptLabel(pt) : `🌀 ${T2.nameTh}\nLv.${T2.reqLv}+${lock ? ' 🔒' : ''}`;
      pt.text = makeText(this, pt.x, pt.y - 62, tag, { fontSize: '7px', color: lock || (cr && tag.includes('🔒')) ? '#f5b7b1' : '#ffe9a6', align: 'center' }).setOrigin(0.5, 1).setDepth(99990);
      const hit = this.add.zone(pt.x, pt.y - 22, 48, 60).setInteractive({ useHandCursor: true }).setDepth(pt.y);
      hit.on('pointerdown', (ptr) => { if (uiBlocked(ptr)) return; ptr.event.stopPropagation(); this.player.target = null; this.moveTo(pt.x, pt.y); });
      return pt;
    });
  }

  /** ขอวาร์ป (ผ่านประตู หรือ NPC) · ออฟไลน์ = ย้ายเองทันที */
  warpTo(to, via = 'portal') {
    if (to === 'gd_exit') { if (!this.warping) { this.warping = true; this.time.delayedCall(3000, () => { this.warping = false; }); this.net.send('gd:leave', {}); } return true; }
    if (to.startsWith('crypt_')) return this.cryptGo(to);
    const T2 = TD_MAPS[to], p = this.player;
    if (!T2 || this.warping || !p.alive) return;
    if (p.char.level < T2.reqLv) { this.ui.toast(`🔒 ${T2.nameTh} ต้อง Lv.${T2.reqLv} ขึ้นไป (ตอนนี้ Lv.${p.char.level})`, 'warn', 2400); return false; }
    if (via === 'npc' && !this.visitedMaps.includes(to)) { this.ui.toast(`ยังไม่เคยไป${T2.nameTh} · ต้องเดินผ่านประตูมิติก่อน 1 ครั้ง`, 'warn', 2600); return false; }
    this.warping = true; this.time.delayedCall(3000, () => { this.warping = false; });
    if (this.econ.server) { this.net.send('td:warp', { to, via }); return true; }
    const pos = via === 'portal' ? arrivalPoint(this.M.id, to) : { ...T2.spawn };
    this.loadMap(to, pos); this.warping = false;
    return true;
  }

  /** เดินเข้าวงประตูมิติ → วาร์ป (ต้องเดินออกห่างประตูก่อนหนึ่งครั้งหลังมาถึง กันเด้งไปมา) */
  checkPortals() {
    const p = this.player; if (!p.alive || !this.portals?.length) return;
    let near = null, far = true;
    for (const pt of this.portals) { const d = Math.hypot(pt.x - p.x, pt.y - p.y); if (d < 70) far = false; if (d < 18) near = pt; }
    if (far) this.portalArmed = true;
    if (near && this.portalArmed) { this.portalArmed = false; p.path = []; this.warpTo(near.to, 'portal'); }
  }

  // ------------------------------------------------------------
  //  สุสานใต้ดิน: หน้าต่างเลือกชั้น (สัปเหร่อเฒ่า) · บันไดขึ้น/ลง
  // ------------------------------------------------------------
  cryptLabel(pt) {
    if (pt.to === 'gd_exit') return '🕯️ ออกจากลาน\n(กลับหน้าหลวงตา)';
    if (pt.to === 'crypt_exit') return pt.final ? `🏯 กลับกรุงศรีฯ${this.cryptOpen ? '' : ' 🔒'}` : '▲ บันไดขึ้น\n(กลับกรุงศรีฯ)';
    const f = this.M.crypt?.f || 0;
    return `${pt.boss ? '☠ ห้องบอส' : '▼ บันไดลง'} ชั้น ${f + 1}${this.cryptOpen ? '' : ' 🔒'}`;
  }

  refreshCryptPortals() { for (const pt of this.portals || []) if (pt.text && pt.to.startsWith('crypt_')) { const t = this.cryptLabel(pt); pt.text.setText(t).setColor(t.includes('🔒') ? '#f5b7b1' : '#ffe9a6'); } }

  cryptGo(to) {
    if (this.warping || !this.player.alive) return false;
    if (!this.econ.server) { this.ui.toast('สุสานใต้ดินเล่นได้เฉพาะออนไลน์', 'warn', 2400); return false; }
    this.warping = true; this.time.delayedCall(3000, () => { this.warping = false; });
    this.net.send('crypt:go', { to });
    return true;
  }

  openCrypt() {
    if (!this.econ.server) return this.ui.toast('สุสานใต้ดินเล่นได้เฉพาะออนไลน์', 'warn', 2400);
    this.net.send('crypt:info', {});
  }

  showCrypt(d) {
    const box = document.querySelector('#crypt-list'), panel = document.querySelector('#crypt-panel');
    if (!box || !panel) return;
    const head = `<p class="hint" style="margin:0 0 1cqh">ลึกสุด: ชั้น ${d.best || 0} · ปาร์ตี้ ${d.party} คน${d.party > 1 ? (d.leader ? ' (คุณเป็นหัวหน้า)' : ' (รอหัวหน้าเปิดประตู)') : ''}</p>`;
    const run = d.running ? `<div class="warp-card here"><span class="wc-ic">💀</span><span><b>ปาร์ตี้อยู่ชั้น ${d.running.f}</b><small>${d.running.players} คนอยู่ข้างล่าง · ตามลงไปได้เลย</small></span><button class="btn" data-cf="join">ตามลงไป</button></div>` : '';
    const rows = d.floors.map((f) => {
      const z = CRYPT_ZONES[Math.floor((f - 1) / 10)], lock = !d.leader || !!d.running;
      return `<div class="warp-card ${lock ? 'lock' : ''}"><span class="wc-ic">${f === 1 ? '🪦' : '🕯️'}</span>
        <span><b>เริ่มชั้น ${f} · ${z.name}</b><small>ผี Lv.${lvOf(f)}–${lvOf(Math.min(100, f + 9))} · บอสชั้น ${f + 9}: ${z.bossName}</small></span>
        <button class="btn" data-cf="${f}" ${lock ? 'disabled' : ''}>${d.running ? 'มีห้องแล้ว' : d.leader ? 'ลงไป' : 'หัวหน้าเท่านั้น'}</button></div>`;
    }).join('');
    box.innerHTML = head + run + rows;
    box.querySelectorAll('[data-cf]').forEach((b) => (b.onclick = () => {
      this.net.send('crypt:enter', b.dataset.cf === 'join' ? {} : { floor: +b.dataset.cf });
      panel.classList.add('hidden');
    }));
    this.ui.closeAll?.(); panel.classList.remove('hidden'); this.sfx.play('open');
  }

  onCryptChest(c) {
    const names = c.items.map((it) => `${ITEMS[it.id]?.nameTh || it.id} x${it.qty}`).join(' · ');
    this.ui.toast(`${c.kind === 'gold' ? '🟨 หีบทอง' : '⬜ หีบเงิน'} ชั้น ${c.f}: ฿${c.gold.toLocaleString()} · ${names}${c.again ? ' (หีบทองบอสนี้เปิดไปแล้ววันนี้)' : ''}`, 'ok', 6000);
    for (const it of c.items) this.ui.loot?.(`ได้ ${ITEMS[it.id]?.nameTh || it.id} x${it.qty}`, rarityOf(ITEMS[it.id]));
    this.sfx.play('victory');
  }

  /** หน้าต่างวาร์ป (คุยกับฤๅษีเฝ้าประตูมิติ) */
  openWarp() {
    const box = document.querySelector('#warp-list'), panel = document.querySelector('#warp-panel');
    if (!box || !panel) return;
    const lv = this.player.char.level;
    box.innerHTML = Object.values(TD_MAPS).filter((m) => !EVENT_MAPS.has(m.id)).map((m) => {
      const here = m.id === this.M.id, been = this.visitedMaps.includes(m.id), low = lv < m.reqLv;
      const why = here ? 'อยู่ที่นี่' : low ? `ต้อง Lv.${m.reqLv}` : !been ? 'ยังไม่เคยไป' : '';
      return `<div class="warp-card ${here ? 'here' : why ? 'lock' : ''}"><span class="wc-ic">${uiIcon(`realm_${m.id}`, m.icon)}</span>
        <span><b>${m.nameTh}</b><small>${m.sub}${!been && !low ? ' · เดินผ่านประตูมิติ 🌀 เพื่อปลดล็อก' : ''}</small></span>
        <button class="btn" data-warp="${m.id}" ${why ? 'disabled' : ''}>${why || 'วาร์ป'}</button></div>`;
    }).join('');
    box.querySelectorAll('[data-warp]').forEach((b) => (b.onclick = () => { if (this.warpTo(b.dataset.warp, 'npc')) panel.classList.add('hidden'); }));
    this.ui.closeAll?.(); panel.classList.remove('hidden'); this.sfx.play('open');
  }

  // ------------------------------------------------------------
  //  แมพ
  // ------------------------------------------------------------
  buildMap() {
    const { ground, solid } = this.layout;
    const MAP_W = this.mapW, MAP_H = this.mapH;
    const g = bakeGround(this, ground, this.tilesets || [], this.M.style);   // พื้นทั้งแมพ (ขอบนุ่ม + ของตกแต่งเล็ก + โทนสีประจำแมพ)
    this.groundMini = g.mini;
    this.water = makeWater(this, this.layout.ground, this.M.style);
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
    if (this.M.crypt || this.M.gd) {                                          // สุสานใต้ดิน/ห้องบอสผี: หินทึบสีมืด + ขอบหินจาง · หน้าผนังอิฐหรี่ลง (ไม่มีใบเสมา)
      const rock = this.add.graphics().setDepth(0.28);
      for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
        const t = gt(x, y), X = x * TILE, Y = y * TILE;
        if (t === T.WALL) { rock.fillStyle(0x000000, 0.45).fillRect(X, Y, TILE, TILE); continue; }
        if (t !== T.WALLTOP) continue;
        rock.fillStyle(0x100c14, 1).fillRect(X, Y, TILE, TILE);
        rock.fillStyle(0x2c2436, 1);
        if (!isW(gt(x, y - 1)) && gt(x, y - 1) != null) rock.fillRect(X, Y, TILE, 2);
        if (!isW(gt(x - 1, y)) && gt(x - 1, y) != null) rock.fillRect(X, Y, 2, TILE);
        if (!isW(gt(x + 1, y)) && gt(x + 1, y) != null) rock.fillRect(X + TILE - 2, Y, 2, TILE);
      }
    }
    if (!this.M.crypt && !this.M.gd) for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
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
    this.fadeTrees = [];
    for (const p of this.layout.props) {
      // ภาพ PixelLab (env/…) ถ้ามี · ไม่มี → ภาพสำรอง (alt) ที่วาดด้วยโค้ด
      let key = p.key, scale = p.scale;
      if (!this.textures.exists(key)) { key = p.alt; scale = p.altScale ?? p.scale; }
      if (!key || !this.textures.exists(key)) continue;
      p.drawn = true;
      const img = this.add.image(p.x, p.y, key).setOrigin(0.5, 1).setDepth(p.depth ?? p.y);
      img.cityProp = p;
      if (p.flip) img.setFlipX(true);
      if (scale) img.setScale(scale);
      if (p.tint) img.setTint(p.tint);
      const env = key.startsWith('env/');
      if (p.tree) {                                                        // ต้นไม้: เงาแนบใต้ราก (ไม่ยื่นลงล่างจนดูลอย) · เดินทะลุได้ แต่จางลงเมื่อผู้เล่นเข้าใกล้
        const w = img.displayWidth, eh = Math.min(9, w * 0.1);
        this.add.ellipse(p.x, p.y - eh * 0.45, w * 0.5, eh, 0x000000, 0.24).setDepth(0.6);
        (this.fadeTrees ||= []).push(img);
      } else if (p.foot?.[0] && key !== 'boat') this.add.ellipse(p.x, p.y - 1, img.displayWidth * (env ? 0.7 : 0.8), env ? Math.min(12, img.displayWidth * 0.18) : 7, 0x000000, 0.22).setDepth(0.6);
      if (p.label) makeText(this, p.x, p.y - img.displayHeight - 3, p.label, { fontSize: '6px', color: '#f7dc6f' }).setOrigin(0.5, 1).setDepth(p.y + 1);
      if (p.warp) this.warpGate = { x: p.x, y: p.y };
    }
    const bigLabel = (x, y, text, color) => makeText(this, x * TILE, y * TILE, text, { fontSize: '10px', color }).setOrigin(0.5).setDepth(9000).setAlpha(0.8);
    if (this.M.realm) { for (const [x, y, text] of this.layout.labels || []) bigLabel(x, y, text, '#ffe9a6'); return; }
    const zoneLabel = (tx, ty, text) => makeText(this, (tx + OX) * TILE, ty * TILE, text, { fontSize: '8px', color: '#ffe9a6' }).setOrigin(0.5).setDepth(9000).setAlpha(0.85);
    zoneLabel(86, 16, '✦ วัดพระศรีสรรเพชญ์ ✦'); zoneLabel(33, 14, '✦ วัดไชยวัฒนาราม ✦'); zoneLabel(60, 42, '⛲ ลานเมือง'); zoneLabel(60, 106, '🌾 ทุ่งนาบางปะอิน'); zoneLabel(60, 63, '🏮 ถนนคนเดินหัวรอ'); zoneLabel(30, 50, '🥊 ย่านสำนัก 5 สาย'); zoneLabel(86, 68, '🔨 ซอยช่างเหล็ก'); zoneLabel(45, 37, '🪷 สวนหลวง'); zoneLabel(46, 52, '🌿 ศาลาโอสถ');
    zoneLabel(70, 79, '🍜 ลานอาหาร'); zoneLabel(30, 79, '🏘 ชุมชนเรือนไทย'); zoneLabel(98, 52, '🛶 ชุมชนริมคลอง'); zoneLabel(80, 57, '🌸 สวนหลวงตะวันออก');
    bigLabel(28, 60, '🎋 ป่าไผ่ปู่โสม', '#b9f6ca'); bigLabel(204, 58, '🪦 ป่าช้าวัดร้าง', '#e8daef'); bigLabel(OX + 60, 150, '🪷 บึงผีพราย', '#d6eaf8'); bigLabel(132, 176, '🌀 ประตูมิติหิมพานต์', '#e8daef');
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
    const okPos = (q) => q && Number.isFinite(q.x) && !this.solid?.[Math.floor((q.y - 2) / TILE)]?.[Math.floor(q.x / TILE)] && q.y < this.mapH * TILE && q.x < this.mapW * TILE;
    if (char.tdPos && (char.tdMapV || 1) < 2) char.tdPos = { x: char.tdPos.x + OX * TILE, y: char.tdPos.y };   // เซฟก่อนขยายแผนที่
    char.tdMapV = 2;
    const pos = okPos(char.tdPos) ? char.tdPos : this.M.spawn;
    const p = this.physics.add.sprite(pos.x, pos.y, key, 'idle_0').setOrigin(0.5, 1).setDepth(pos.y);
    p.body.setSize(12, 8).setOffset((p.width - 12) / 2, p.height - 8); p.bodyFoot = [12, 8];
    Object.assign(p, { char, texKey: key, legacyKey: key, d8id: baseHeroId(char.appearance), dir: 'south', facing: 1, st: 'idle', path: [], target: null, nextAtk: 0, buffs: [], dead: false });
    Object.defineProperty(p, 'alive', { get() { return !this.dead; } });
    Object.defineProperty(p, 'derived', { get() { return getDerived(this.char); } });
    p.cooldownLeft = () => 0;
    p.combatStats = () => getDerived(p.char);
    this.addShadow(p, 22);
    p.holdAttack = () => p.char.appearance.job !== 'boxer';
    p.actionAnim = () => ACTION_ANIM[p.char.appearance.job];
    p.look = () => p._previewApp || p.char.appearance;                 // appearance ที่แสดงอยู่ (รวมลองชุดในร้าน)
    p.previewAppearance = (app, ms = 6000) => {                         // ลองชุดก่อนซื้อ: แค่ภาพ กลับเป็นชุดจริงเมื่อหมดเวลา
      clearTimeout(p._pvT); p._previewApp = app;
      this.applyHero(p, app, () => this.refreshPlayerAnimation()); this.playerAnim('idle', true);
      p._pvT = setTimeout(() => { p._previewApp = null; if (p.active) { this.applyHero(p, p.char.appearance, () => this.refreshPlayerAnimation()); this.playerAnim('idle', true); } }, ms);
    };      // ดาบ/ไม้เท้า/ธนู ใช้ท่ายืน + อาวุธเหวี่ยง · มวยใช้ท่าต่อยจริง (ถ้ามี)
    this.player = p;
    this.applyHero(p, char.appearance, () => this.refreshPlayerAnimation());
    this.blockCollider = this.physics.add.collider(p, this.blocks);
    this.nameTag = makeText(this, 0, 0, char.name, { fontSize: '7px', color: '#fff3c4', align: 'center' }).setOrigin(0.5, 1).setDepth(99999);
    this.selfGm = () => !!account.account?.admin;                                      // ทุกตัวละครของบัญชีแอดมิน = GM
    gmStyle(this.nameTag, this.selfGm());
    this.titleTag = makeText(this, 0, 0, '', { fontSize: '7px', color: '#ffffff', align: 'center' }).setOrigin(0.5, 1).setDepth(99999).setVisible(false);
    this.refreshNameTag();
    p.on('animationcomplete', (anim) => { if (/:(attack|cast|heal|hit|slash|shoot)(:|$)/.test(anim.key) && p.alive) p.st = 'idle'; });
    this.playerAnim('idle');
  }

  /** สไปรต์ 8 ทิศของผีในแมพหนึ่ง (รวมตัวที่ยืมภาพ def.d8) ที่มีใน manifest */
  mobSpriteIds(mapId) {
    const ids = new Set();
    let spawns = [];
    try { spawns = getMap(mapId).layout().spawns || []; } catch { /* แมพพิเศษ: ข้าม */ }
    for (const sp of spawns) { const d = MONSTERS[sp.id]; if (!d) continue; ids.add(`mob_${sp.id}`); if (d.d8) ids.add(`mob_${d.d8}`); }
    return [...ids].filter((k) => this.d8meta?.[k]);
  }

  /** โหลดผีของแมพ (ถ้ายังไม่มี) · ผีที่สร้างไปแล้วเปลี่ยนเป็นภาพจริงเองตอนขยับครั้งถัดไป (playDir เช็คทุกครั้ง) */
  loadMobsFor(mapId) { return Promise.all(this.mobSpriteIds(mapId).map((id) => this.loadHero(id))); }

  /** 2 แดนที่ใกล้เลเวลตัวเองที่สุด (นอกจากแมพนี้) = แดนที่น่าจะไปต่อ */
  nearMaps() {
    const me = this.player?.char?.level || 1, mid = (id) => { const lv = TD_MAPS[id].lv || [1, 1]; return Math.abs((lv[0] + lv[1]) / 2 - me); };
    return Object.keys(TD_MAPS).filter((id) => id !== this.M.id && !TD_MAPS[id].event).sort((a, b) => mid(a) - mid(b)).slice(0, 2);
  }

  /** หลังเข้าเกม: โหลดผีของแดนข้างเคียงไว้ก่อน (ไม่โหลดทุกแดน → หน่วยความจำไม่บวม) */
  async preloadOtherMobs() {
    for (const id of this.nearMaps()) { if (!this.scene?.isActive?.()) return; await this.loadMobsFor(id); }
  }

  /** ปล่อยภาพ 8 ทิศที่ไม่มีใครใช้: ผีแดนไกล + ชุดเต็มตัวของคนที่ออกไปแล้ว (เปิดออโต้ทั้งวันหน่วยความจำไม่โตเรื่อย ๆ) */
  evictDir8() {
    const keep = new Set([...this.mobSpriteIds(this.M.id), ...this.nearMaps().flatMap((id) => this.mobSpriteIds(id))]);
    const mark = (o) => { if (o?.d8id) keep.add(o.d8id); if (o?._wantHero) keep.add(o._wantHero); };
    mark(this.player); this.remotes.forEach((r) => mark(r.spr)); (this.mobs || []).forEach(mark);
    const usedTex = new Set(this.children.list.map((o) => o.texture?.key).filter(Boolean));   // กันพลาด: อะไรในฉากยังใช้ texture อยู่ = ไม่ลบ
    for (const [id, meta] of Object.entries(this.d8meta || {})) {
      if (keep.has(id) || !(id.startsWith('mob_') || meta.lazy)) continue;
      const tks = meta.anims.map((a) => texKey(id, a)).filter((k) => this.textures.exists(k));
      if (!tks.length || tks.some((k) => usedTex.has(k))) continue;
      for (const a of meta.anims) for (const dir of D8_DIRS) this.anims.remove(animKey(id, a, dir));
      tks.forEach((k) => this.textures.remove(k));
      if (this._heroLoads) delete this._heroLoads[id];                               // ใช้อีกครั้ง = โหลดใหม่ได้
    }
  }
  evictSoon() { this._evictT?.remove(); this._evictT = this.time.delayedCall(15000, () => this.evictDir8()); }

  /** ลงทะเบียน animation 8 ทิศของ id จาก manifest (เฉพาะภาพที่โหลดแล้ว) */
  registerHero(id) {
    const m = this.d8meta?.[id]; if (!m) return false;
    const anims = {};
    for (const a of m.anims) { const [rate, loop] = D8_RATE[a] || [10, false]; anims[a] = { frames: m.frames?.[a] || (a === 'idle' ? 4 : 6), rate:m.rates?.[a]||rate, directionRates:m.directionRates?.[a], loop }; }
    return registerDir8(this, { id, anims, cuts:m.cuts });
  }

  /** โหลดโมเดลชุดเต็มตัวแบบ lazy → Promise<boolean> */
  loadHero(id) {
    const m = this.d8meta?.[id];
    if (!m) return Promise.resolve(false);
    if (hasDir8(this, id)) return Promise.resolve(true);
    this._heroLoads ||= {};
    return (this._heroLoads[id] ||= new Promise((res) => {
      const todo = [...m.anims,...(m.sources||[])].filter((a) => !this.textures.exists(texKey(id, a)));
      if (!todo.length) return res(this.registerHero(id));
      let left = todo.length;
      const done = () => { if (--left === 0) res(this.registerHero(id)); };
      for (const a of todo) {
        const k = texKey(id, a);
        this.load.image(k, `/assets/td/${id}/${a}.png`);
        const onErr = (f) => { if (f.key !== k) return; this.load.off('loaderror', onErr); done(); };   // ฟังจนกว่าจะเป็นไฟล์ตัวเอง (once เดิมโดนไฟล์อื่นกินไป → ค้าง)
        this.load.once(`filecomplete-image-${k}`, () => { this.load.off('loaderror', onErr); done(); });
        this.load.on('loaderror', onErr);
      }
      if (!this.load.isLoading()) this.load.start();
    }));
  }

  /** ตั้งโมเดล 8 ทิศของสไปรต์ตาม appearance (ชุดเต็มตัวโหลดทีหลัง ระหว่างนั้นใช้โมเดลพื้นฐาน) */
  applyHero(spr, a, onReady) {
    const want = heroId(a), base = baseHeroId(a);
    spr._wantHero = want;
    if (want === base || hasDir8(this, want) || !this.d8meta?.[want]) { spr.d8id = this.d8meta?.[want] ? want : base; return; }
    spr.d8id = base;
    this.loadHero(want).then((ok) => { if (ok && spr.active && spr._wantHero === want) { spr.d8id = want; spr._d8 = null; onReady?.(); } });
  }

  playerAnim(name, restart = false) { const p = this.player; return playDir(p, name, p.dir || 'south', restart); }

  refreshPlayerAnimation() {
    const p = this.player;
    const anim = !p.alive ? 'die' : p.st === 'attack' ? 'attack' : p.st === 'walk' ? 'walk' : 'idle';
    return this.playerAnim(anim, true);
  }

  // ------------------------------------------------------------
  //  NPC
  // ------------------------------------------------------------
  buildNpcs() {
    this.npcs = this.layout.npcs.map((n) => this.makeNpc(n));
    if (this.travelState) this.onTravel(this.travelState);
  }

  /** สร้าง NPC 1 ตัว (สไปรต์ · ป้ายชื่อ · ป้ายบริการ · เครื่องหมายเควส) → คืนอ็อบเจกต์ NPC */
  makeNpc(n) {
    const life = (this.npcLife ||= new NpcLife(this));
    {
      let o = null;                                                                     // ตัว NPC (สร้างท้ายฟังก์ชัน)
      const real = this.textures.exists(n.key), key = real ? n.key : 'npc_maekha';
      const spr = this.add.sprite(n.x, n.y, key, 'idle_0').setOrigin(0.5, 1).setDepth(n.y);
      spr.legacyKey = key; spr.d8id = n.key; spr.npcVisual = { id: n.id, color: n.color || '#ead8b0' }; playDir(spr, 'idle', 'south');
      this.addShadow(spr, 20);
      const plateTop = this.npcPlate(n, spr);
      spr.setInteractive({ useHandCursor: true });
      spr.on('pointerdown', (ptr) => { if (uiBlocked(ptr)) return; ptr.event.stopPropagation(); this.talk(o, ptr.rightButtonDown()); });   // คลิกขวา = ทางลัด
      spr.on('pointerover', (ptr) => { this.hovered = spr; document.body.dataset.cursor = 'talk'; life.hover(o, ptr); });
      spr.on('pointermove', (ptr) => life.moveTip(ptr));
      spr.on('pointerout', () => { if (this.hovered === spr) this.hovered = null; delete document.body.dataset.cursor; life.unhover(o); });
      if (n.id === 'quest' || /^kru_/.test(n.id)) {                                        // เครื่องหมาย !/? ทองลอยเหนือป้ายชื่อ (ผู้ใหญ่ชัย + ครูประจำอาชีพ)
        const y0 = plateTop - 9, qx = SERVICE[n.id] ? n.x + 12 : n.x;                    // ลอยเหนือกรอบป้าย ไม่ทับ · ครูมีป้ายร้านอยู่กลาง → ขยับไปขวา
        const g = this.add.graphics().setDepth(n.y + 3);
        g.fillStyle(0x5a1611, 1).fillCircle(0, 0, 6).lineStyle(1.5, 0xf4d03f).strokeCircle(0, 0, 6);
        const t = makeText(this, 0, 1, '!', { fontSize: '9px', color: '#ffe082' }).setOrigin(0.5);
        const q = this.add.container(qx, y0, [g, t]).setDepth(n.y + 3);
        n._qmark = q;
        this.tweens.add({ targets: q, y: y0 - 4, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        (this.questMarks ||= {})[n.id] = { q, g, t }; this.updateQuestMark();
      }
      o = { ...n, icon: NPC_ICON[n.id], spr, line: 0 };
      life.attach(o, plateTop);
      if (n._qmark) { const off = n._qmark.x - n.x, q = n._qmark; o._follow.push({ get x() { return q.x - off; }, set x(v) { q.x = v + off; } }); }
      o._shadow = this.shadows[this.shadows.length - 1]?.obj === spr ? this.shadows[this.shadows.length - 1] : this.shadows.find((sh) => sh.obj === spr);
      return o;
    }
  }

  /** ลบ NPC (พ่อค้าเร่เก็บร้าน) */
  removeNpc(o) {
    if (!o) return;
    this.npcLife?.unhover(o);
    for (const x of [o.spr, o._box, o._svc, o._qmark, o._shadow?.img]) x?.destroy?.();
    this.shadows = this.shadows.filter((sh) => sh.obj !== o.spr);
    this.npcs = this.npcs.filter((n) => n !== o);
    if (this.talkNpc === o) this.talkNpc = null;
  }

  /** พ่อค้าเร่ (server ส่งสถานะ mk:travel) → โผล่/หายในอยุธยา */
  onTravel(t) {
    this.travelState = t;
    if (this.ui?.mkV) this.ui.mkV.travel = t;
    if (!this.npcs) return;
    const cur = this.npcs.find((n) => n.id === 'travel');
    const want = t?.active && this.M?.id === 'ayutthaya';
    if (cur && (!want || cur._home?.x !== t.x || cur._home?.y !== t.y)) this.removeNpc(cur);
    if (want && !this.npcs.some((n) => n.id === 'travel')) {
      this.npcs.push(this.makeNpc({ id: 'travel', key: t.key, x: t.x, y: t.y, nameTh: t.name, role: 'ร้านโผล่ชั่วคราว', color: '#ffb347',
        lines: ['ของหายากจากเมืองจีน มาไม่บ่อยนะ', 'หมดแล้วหมดเลย ไม่มีเติม!', 'อีกเดี๋ยวข้าต้องไปเมืองอื่นแล้ว'] }));
    }
    this.ui?.mkV?.rerender();
  }

  /** เครื่องหมายเหนือผู้ใหญ่ชัย: ? = มีเควสส่งได้ · ! = มีเควสใหม่ให้รับ · ไม่มี = ซ่อน */
  updateQuestMark() {
    const c = this.player?.char;
    if (!c?.quests) return;
    for (const [giver, m] of Object.entries(this.questMarks || {})) {
      if (!m.q.active) continue;
      // ครูอาชีพ: แสดง ! เฉพาะเมื่อถืออาวุธสายนั้นอยู่ (กันป้าย ! เต็มเมือง) · ? แสดงเสมอเมื่อส่งได้
      const qs = QUESTS.filter((q) => (q.giver || 'quest') === giver), st = qs.map((q) => qState(c, q));
      const openOk = giver === 'quest' || qs.some((q, i) => st[i] === 'open' && q.job === c.appearance?.job);
      const kind = st.includes('ready') ? 'ready' : openOk && st.includes('open') ? 'open' : null;
      this.paintQuestMark(m, kind);
    }
  }

  paintQuestMark(m, kind) {
    if (m.kind === kind) return;
    m.kind = kind;
    m.q.setVisible(!!kind);
    if (!kind) return;
    m.g.clear().fillStyle(kind === 'ready' ? 0x1e5a2a : 0x5a1611, 1).fillCircle(0, 0, 6).lineStyle(1.5, 0xf4d03f).strokeCircle(0, 0, 6);
    m.t.setText(kind === 'ready' ? '?' : '!');
  }

  /** ป้ายชื่อ NPC: กรอบรักดำขอบทอง · บรรทัดบน = หน้าที่ (ไอคอน) · บรรทัดล่าง = ชื่อ */
  npcPlate(n, spr) {
    const top = n.y - (spr.worldLabelHeight || 40) - 2;
    // ไอคอนหน้าที่: ภาพพิกเซล (PixelLab ui_*) ถ้ามี · ไม่มีไฟล์ = ใช้อีโมจิเดิม
    const emo = NPC_ICON[n.id] || '💬', ik = EMO_ICON[emo.replace(/\uFE0F/g, '')], url = ik && ICONS[`ui_${ik}`];
    const role = makeText(this, 0, 0, url ? n.role : `${emo} ${n.role}`, { fontSize: '6px', color: '#dccb9b' }).setOrigin(0.5, 1);
    const name = makeText(this, 0, 0, n.nameTh, { fontSize: '7px', color: n.color || '#ffffff' }).setOrigin(0.5, 1);
    const IC = url ? 8 : 0, rowW = role.width + (IC ? IC + 1 : 0);
    const w = Math.max(rowW, name.width) / 1 + 8, h = role.height + name.height - 2;
    name.setY(0); role.setY(-name.height + 3);
    if (IC) role.setX((IC + 1) / 2);
    const g = this.add.graphics();
    g.fillStyle(0x152e30, 0.9).fillRoundedRect(-w / 2, -h - 1, w, h + 2, 3);
    g.lineStyle(.7, 0xc4aa74, 0.8).strokeRoundedRect(-w / 2, -h - 1, w, h + 2, 3);
    g.fillStyle(0xc4aa74, 1).fillTriangle(-2, 1, 2, 1, 0, 3);
    const box = this.add.container(n.x, top - 2, [g, role, name]).setDepth(n.y + 2);
    if (IC) {
      const tk = `ui_${ik}`, put = () => { if (!box.scene) return; const im = this.add.image(-rowW / 2 + IC / 2, role.y - role.height / 2 + .5, tk).setDisplaySize(IC, IC); box.add(im); };
      if (this.textures.exists(tk)) put();
      else { this.load.image(tk, url); this.load.once(`filecomplete-image-${tk}`, put); if (!this.load.isLoading()) this.load.start(); }
    }
    n._plate = { top: top - 2 - h - 1, w }; n._box = box; n._plateH = h + 2;                                                // ใช้ตรวจแตะโดนป้าย (npcAt)
    return top - 2 - h - 1;                                                                // ขอบบนของป้าย
  }

  /** คลิกตัวผู้เล่นคนอื่นแล้วเปิดเมนูไหม: Shift+คลิกเปิดเสมอ · ระหว่างสู้ (ลานบอสโลก/มีเป้าผี/ผีอยู่ใกล้จุดคลิก) = คลิกทะลุไปเดิน/ตีแทน */
  playerMenuClick(ptr) {
    if (ptr?.event?.shiftKey) return true;
    // กำลังสู้จริง (มีเป้าผี / ลานบอสช่วงสู้และอยู่นอกค่ายพัก) → คลิกทะลุ · ในค่ายพัก/ในเมือง เปิดเมนูได้ปกติ (เชิญปาร์ตี้ก่อนลุย)
    if (this.player?.target?.alive) return false;
    if (this.wb?.here && this.wb.st?.state === 'fight' && !this.inTown()) return false;
    const w = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
    return !this.mobAt(w.x, w.y, 40);
  }

  /** SP สูตรใหม่ทำให้แต้มสกิลที่ลงไว้เกิน → รีสกิลให้ฟรีแล้ว แจ้งครั้งเดียว */
  spNotice() {
    const c = this.player?.char;
    if (!c?.spNotice || this._spTold) return;
    this._spTold = true;
    notice({ title: 'รีสกิลให้ฟรีแล้ว', icon: '📘',
      text: `แต้มสกิล (SP) ปรับใหม่: Lv.1–60 ได้ 1 SP ทุกเลเวล · หลัง Lv.60 ได้ 1 SP ทุก 2 เลเวล\nแต้มที่ลงไว้เกินจำนวนใหม่ → คืน SP ให้ทั้งหมดแล้ว มี ${c.sp} SP\n\nกด K แล้วลงสกิลใหม่ได้เลย (ตอนนี้ต้องเลือกสายหลัก/สายรองให้ดี)` })
      .then(() => { this.econ.act('spAck'); this.ui.toggle?.('skill-panel', true); });
  }

  /** ระบบสเตตัสเปลี่ยนเป็นแบบ RO → รีแต้มให้ฟรีแล้ว แจ้งครั้งเดียว */
  statsRONotice() {
    this.spNotice();
    const c = this.player?.char;
    if (!c?.statsRONotice || this._statsTold) return;
    this._statsTold = true;
    notice({ title: 'ระบบสเตตัสใหม่มาแล้ว!', icon: '📊',
      text: `สเตตัสเปลี่ยนเป็น 6 ค่า: STR · AGI · VIT · INT · DEX · LUK
ค่ายิ่งสูงยิ่งใช้แต้มมาก (สูงสุด 130) · เลเวลสูงยิ่งได้แต้มมาก

รีแต้มให้ฟรีแล้ว: มีแต้ม ${c.statPoints.toLocaleString()} แต้ม
กด C แล้วลงใหม่ หรือกด "✨ ลงอัตโนมัติ" ตามอาวุธที่ถือ` })
      .then(() => { this.econ.act('statsAck'); this.ui.toggle?.('stats-panel', true); });
  }

  /** ระบบชุดแต่งตัวถูกเอาออกจากเกม → แจ้งยอดเงินที่คืน (ครั้งเดียว) */
  cosRefundNotice() {
    this.statsRONotice();
    const r = this.player?.char?.cosRefund;
    if (!r || r.told || !r.n || this._cosTold) return;
    this._cosTold = true;
    notice({ title: 'ระบบชุดแต่งตัวถูกนำออกจากเกม', icon: '👘',
      text: `ชุดแต่งตัว/เครื่องประดับแฟชั่นของคุณ ${r.n.toLocaleString()} ชิ้น ถูกเก็บคืนแล้ว\nคืนเงินให้ ฿${r.gold.toLocaleString()} (ของร้าน = ราคาซื้อ · ของหายาก = ฿300,000 ขึ้นไป)` })
      .then(() => this.econ.act('cosAck'));
  }

  /** ร้านของ NPC นี้ (ไม่มี = undefined) */
  npcShop(id) { return NPC_OPEN[id]; }

  /** คุยกับ NPC · quick = ทางลัดคลิกขวา (ร้าน → แท็บขาย · ผู้ใหญ่ชัย → กระดานเควส · ฤๅษี → ประตูมิติ · สัปเหร่อ → ลงสุสาน) */
  talk(n, quick = false) {
    const p = this.player;
    if (!n) return;
    if (dist(p, n) > 52) {
      const again = this.pendingTalk === null && this.talkRetry?.n === n && performance.now() - this.talkRetry.t < 1500;   // เพิ่งเดินถึงปลายทางแล้วยังไม่ใกล้พอ (NPC ขยับ)
      const tries = again ? this.talkRetry.k + 1 : 0;
      this.moveTo(n.x, n.y + 14);
      if (!p.path.length || tries > 2) { p.path = []; this.talkRetry = null; this.ui.toast(tries > 2 ? `เดินไปหา ${n.nameTh || 'NPC'} ไม่ถึง ลองเดินเข้าใกล้อีกนิด` : 'หาทางไปไม่เจอ ลองเดินเข้าใกล้ก่อน', 'warn', 1800); return; }
      this.pendingTalk = n; this.pendingQuick = quick; this.talkRetry = { n, k: tries, t: 0 };
      return;
    }
    this.talkRetry = null;
    this.pendingTalk = null; this.pendingQuick = false;
    this.npcLife?.unhover();
    this.sfx.play('npc');
    if (NPC_OPEN[n.id]) {
      this.ui.openShop(NPC_OPEN[n.id], n);
      const qt = n.id === 'market' ? 'claim' : 'sell';                                   // คลิกขวา: ร้าน → แท็บขาย · นายห้าง → กล่องรับของ
      if (quick && this.ui.shopTabs?.includes(qt)) { this.ui.shopTab = qt; this.ui.renderShop(); }
      return;
    }
    if (quick) {
      if (n.id === 'quest') return this.village.openQuests();
      if (n.id === 'warp') return this.openWarp();
      if (n.id === 'crypt') return this.openCrypt();
      if (n.id === 'ghostdg') return this.gd?.open();
    }
    // NPC อื่น: กล่องคุยด้านล่าง (ปุ่มหลักพาไปหน้าต่างของ NPC นั้น)
    const dlg = (this.npcDlg ||= new NpcDialog(this));
    const act = n.id === 'quest' ? { label: '📋 ดูกระดานเควส', run: () => this.village.openQuests() }
      : n.id === 'warp' ? { label: '🌀 เปิดประตูมิติ', run: () => this.openWarp() }
      : n.id === 'crypt' ? { label: '💀 ลงสุสานใต้ดิน', run: () => this.openCrypt() }
      : n.id === 'ghostdg' ? { label: '☠️ ดันเจี้ยนสี่ผีป่าช้า', run: () => this.gd?.open() } : null;
    if (!act && !(Array.isArray(n.lines) && n.lines.length)) return;
    dlg.show({ ...n, icon: NPC_ICON[n.id], lines: n.lines?.length ? n.lines : [n.role || 'ว่าไงพ่อหนุ่มแม่หนู'], get line() { return n.line; }, set line(v) { n.line = v; } }, act);
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
    const def = MONSTERS[s.id];
    // ผีแมพต่างแดนที่ยังไม่มีภาพจริง → ยืมสไปรต์ 8 ทิศของผีเดิม (def.d8) + ย้อมสี (def.tint)
    const own = hasDir8(this, `mob_${s.id}`, 'idle') || !!this.d8meta?.[`mob_${s.id}`], art = own ? s.id : def.d8 || s.id, key = `mon_${def.art || art}`;   // มีใน manifest = ภาพตัวเอง (ยังโหลดไม่เสร็จก็ใช้ภาพเดิมชั่วคราว)
    const m = this.physics.add.sprite(s.x, s.y, this.textures.exists(key) ? key : 'npc_maekha', 'walk_0').setOrigin(0.5, 1);
    if (!own && def.tint) { const ct = m.clearTint.bind(m); m.clearTint = () => { ct(); m.setTint(def.tint); return m; }; m.setTint(def.tint); }
    this.monsters.add(m);
    const scale = def.scale || 1; m.setScale(scale); m.scaleMul = def.boss ? def.scale || 1.6 : def.elite ? def.scale || 1.2 : 1;   // ตัวแกร่ง (elite) ตัวโตขึ้นเล็กน้อย
    m.body.setSize(14 / scale, 8 / scale).setOffset((m.width - 14 / scale) / 2, m.height - 8 / scale); m.bodyFoot = [14, 8];
    Object.assign(m, { mid, def, spawn: s, hp: def.hp, maxHp: def.hp, alive: true, mode: 'wander', nextThink: 0, nextAtk: 0, dir: 'south', sx: s.x, sy: s.y });
    m.legacyKey = m.texture.key; m.d8id = `mob_${art}`; playDir(m, 'walk', 'south');
    this.addShadow(m, Math.max(14, m.displayWidth * 0.7));
    m.label = makeText(this, m.x, m.y, `${def.boss ? '👑 ' : ''}Lv.${def.level} ${def.nameTh}`, { fontSize: def.boss ? '8px' : '6px', color: def.boss ? '#edd6a3' : def.elite ? '#cec1e6' : '#e0d9cc' }).setOrigin(0.5, 1);
    m.barW = def.boss ? 48 : 22;
    m.hpBg = this.add.rectangle(0, 0, m.barW, def.boss ? 5 : 3, 0x15252a, 0.85).setStrokeStyle(def.boss ? .8 : .4, def.boss ? 0xd8b578 : 0x7e938d, .8); m.hpBar = this.add.rectangle(0, 0, m.barW, def.boss ? 5 : 3, def.boss ? 0xbd7458 : 0xb86058).setOrigin(0, 0.5);
    m.setInteractive({ useHandCursor: true });
    m.on('pointerdown', (ptr) => { if (uiBlocked(ptr)) return; ptr.event.stopPropagation(); this.setTarget(m); });
    m.on('pointerover', () => { this.hovered = m; document.body.dataset.cursor = 'attack'; });
    m.on('pointerout', () => { if (this.hovered === m) this.hovered = null; delete document.body.dataset.cursor; });
    if (!this.econ.server) m.setPosition(s.x + rand(-s.r, s.r), s.y + rand(-s.r, s.r));
    if (s.wb) { m.alive = false; m.hp = 0; this.setMobVisible(m, false); }       // บอสโลก/ผลึก/บริวาร: หลับไว้จนกว่า server ปลุก (ไม่กะพริบตอนเข้าลาน)
    return m;
  }

  setTarget(m, auto = false) {
    if (!auto && this.questNav?.travelling) this.questNav.stop();
    if (!m.alive) return;
    this.player.target = m; this.player.path = [];
    if (!auto) { this.player.autoTarget = null; this.pendingTalk = null; this.social?.pw?.stopFollow(); }   // เลือกเองด้วยมือ → ไม่ยอมแพ้ไล่เป้าอัตโนมัติ · เลิกติดตามหัวหน้า
    this.ui.setTarget({ def: { ...m.def, hp: m.maxHp }, isBoss: !!(this.M.gd && m.def?.boss), get hp() { return m.hp; }, get alive() { return m.alive; } });
    if (!auto) this.sfx.play('target');
  }

  /** Auto: ผีที่ใกล้ที่สุดที่อยู่ในหน้าจอ (นอกเมืองเท่านั้น) · กรองตามชนิดผีที่เลือกไว้ (ว่าง = ตีทุกตัว) */
  autoPick(time = 0) {
    const p = this.player;
    if (this.inTown() && !this.M.crypt) return null;                        // ในเมือง/ค่ายพักไม่ออโต้ · สุสานใต้ดิน: กองไฟจุดลงเป็นเขตพัก แต่ Auto ออกไปตีได้เลย
    const v = this.cameras.main.worldView;
    const only = this.autoFilter();
    let best = null, bd = Infinity;
    for (const m of this.mobs) {
      if (!m.alive || m.visible === false || (m.autoSkip || 0) > time) continue;
      if (only && !only.has(m.spawn.id)) continue;
      if (m.x < v.x - AUTO_MARGIN || m.x > v.right + AUTO_MARGIN || m.y < v.y - AUTO_MARGIN || m.y > v.bottom + AUTO_MARGIN) continue;
      const d = dist(p, m);
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }

  /** จำนวนชนิดที่เลือก (ไม่นับ NONE) */
  autoCount(only = this.autoFilter()) { return only ? only.size - (only.has(NONE) ? 1 : 0) : 0; }

  /** ชุดชนิดผีที่ Auto จะตี (null = ตีทุกตัว · มีแค่ NONE = ไม่ตีเลย) */
  autoFilter() {
    const list = this.settings.autoMobs;
    return Array.isArray(list) && list.length ? new Set(list) : null;
  }

  /** ชนิดผีในแผนที่นี้ (สำหรับเมนูเลือกเป้า Auto) */
  mobKinds() {
    const kinds = new Map();
    for (const m of this.mobs) {
      const id = m.spawn.id, k = kinds.get(id) || { id, def: m.def, n: 0, alive: 0 };
      k.n++; if (m.alive) k.alive++;
      kinds.set(id, k);
    }
    return [...kinds.values()].sort((a, b) => a.def.level - b.def.level);
  }

  /** เมนูเลือกเป้า Auto (ปุ่ม ▾ ข้างปุ่ม AUTO หรือ Shift+R) */
  toggleAutoMenu(open = $('#auto-menu')?.classList.contains('hidden')) {
    const box = $('#auto-menu');
    if (!box) return;
    box.classList.toggle('hidden', !open);
    if (open) this.renderAutoMenu();
  }

  renderAutoMenu() {
    const box = $('#auto-menu');
    if (!box || box.classList.contains('hidden')) return;
    const only = this.autoFilter();
    const kinds = this.mobKinds();
    box.innerHTML = `
      <div class="am-head"><b>🎯 เป้าหมาย Auto</b><small>ระยะ: ทั้งหน้าจอ</small></div>
      <div class="am-bulk"><button type="button" data-bulk="all" class="${only ? '' : 'on'}">✔ เลือกทั้งหมด</button><button type="button" data-bulk="none" class="${only && !this.autoCount(only) ? 'on' : ''}">✖ ยกเลิกทั้งหมด</button></div>
      <div class="am-list">${kinds.length ? kinds.map((k) => `
        <label class="${only && !only.has(k.id) ? 'off' : ''}" data-cnt="${k.alive}/${k.n}">
          <input type="checkbox" data-id="${k.id}" ${!only || only.has(k.id) ? 'checked' : ''}>
          <span class="am-lv">Lv.${k.def.level}</span><span class="am-n">${k.def.nameTh}${k.def.elite || k.def.boss ? ' 👑' : ''}${k.def.nightOnly ? ' 🌙' : ''}</span>
        </label>`).join('') : '<div class="am-empty">แผนที่นี้ไม่มีผี</div>'}</div>
      <div class="am-foot">ติ๊กเฉพาะชนิดที่อยากตี · ไม่ติ๊กเลย = Auto ไม่ไล่ตีผี</div>`;
    box.querySelectorAll('[data-bulk]').forEach((b) => (b.onclick = () => {
      this.settings.autoMobs = b.dataset.bulk === 'all' ? [] : [NONE];
      saveSettings(this.settings); this.renderAutoMenu(); this.autoRetarget();
    }));
    box.querySelectorAll('[data-id]').forEach((cb) => (cb.onchange = () => {
      let ids = [...box.querySelectorAll('[data-id]:checked')].map((x) => x.dataset.id);
      if (ids.length === kinds.length) ids = [];               // ติ๊กครบทุกชนิด = ตีทุกตัว
      else if (!ids.length) ids = [NONE];                      // ไม่ติ๊กเลย = ไม่ไล่ตี
      this.settings.autoMobs = ids;
      saveSettings(this.settings); this.renderAutoMenu(); this.autoRetarget();
    }));
    this.updateAutoBadge();
  }

  /** เป้า Auto ปัจจุบันไม่อยู่ในรายการที่เลือกแล้ว → ปล่อยเป้า ให้ Auto หาใหม่ */
  autoRetarget() {
    const p = this.player, m = p?.target, only = this.autoFilter();
    if (m && p.autoTarget === m && only && !only.has(m.spawn.id)) { p.target = null; p.autoTarget = null; this.ui.setTarget?.(null); }
  }

  /** อัปเดตจำนวนผีที่เหลือในเมนู Auto แบบเบาๆ (ไม่วาดใหม่ทั้งเมนู) */
  refreshAutoMenuCounts() {
    const box = $('#auto-menu');
    if (!box || box.classList.contains('hidden')) return;
    for (const k of this.mobKinds()) { const el = box.querySelector(`[data-id="${k.id}"]`)?.parentElement; if (el) el.dataset.cnt = `${k.alive}/${k.n}`; }
  }

  updateAutoBadge() {
    const bt = $('#auto-skill'); if (!bt) return;
    const only = this.autoFilter();
    bt.classList.toggle('filtered', !!only);
    bt.title = `Auto (R) – ตีผี${only ? `ที่เลือก ${this.autoCount(only)} ชนิด` : 'ทุกตัว'}ในหน้าจอ + ร่ายสกิลในแถบ 1–0 อัตโนมัติ · เลือกเป้า: ปุ่ม ▾ / Shift+R`;
  }

  setMobVisible(m, on) {
    if (on) this.tweens.killTweensOf(m);                          // กันบั๊กผีล่องหน: ท่าตายค่อยๆ จางยังค้างอยู่ตอนผีเกิดใหม่/ฟื้นจากแพ็กเก็ตสลับลำดับ
    m.setVisible(on); m.label.setVisible(on); m.hpBg.setVisible(on); m.hpBar.setVisible(on);
    if (on) m.setAlpha(1).clearTint().setInteractive({ useHandCursor: true }); else m.disableInteractive();
  }

  /** บอสใช้ท่าวงกว้าง: วงแดงขยายเตือนก่อน แล้วระเบิด */
  bossAoe({ mid, x, y, r, ms = 1000, name, col }) {
    const m = this.mobs[mid];
    if (m?.alive) playDir(m, 'attack', m.dir, true);
    const edge = this.add.ellipse(x, y, r * 2, r * 1.3).setStrokeStyle(2, col ?? 0xff5b4f, 0.9).setDepth(2);   // col = สีตามท่า (ห้องบอสผี)
    const ring = this.add.ellipse(x, y, r * 2, r * 1.3, col ?? 0xff3b30, 0.22).setDepth(2).setScale(0.05);
    this.tweens.add({ targets: ring, scale: 1, duration: ms * 0.9, ease: 'Cubic.Out' });
    const warn = name && dist(this.player, { x, y }) < r + 120 ? makeText(this, x, y - (m?.displayHeight || 40) - 18, `⚠ ${name}`, { fontSize: '8px', color: '#ff8a80' }).setOrigin(0.5).setDepth(99990) : null;
    this.time.delayedCall(ms, () => {
      ring.destroy(); edge.destroy(); warn?.destroy();
      const boom = this.add.ellipse(x, y, r * 2, r * 1.3, col ?? 0xff6b3d, 0.45).setDepth(2);
      this.tweens.add({ targets: boom, alpha: 0, scale: 1.12, duration: 380, onComplete: () => boom.destroy() });
      if (dist(this.player, { x, y }) < r + 60) { this.cameras.main.shake(180, 0.006); this.sfx.play('skBoom'); }
    });
  }

  /** ผีกองรวมกัน → ชื่อซ้อนอ่านไม่ออก: โชว์ชื่อเฉพาะตัวที่ไม่ทับกัน (เป้า/บอส/ตัวที่ชี้ ได้ก่อน แล้วตัวที่ใกล้เรา) · แถบเลือดยังโชว์ครบ */
  declutterMobLabels() {
    const p = this.player, tgt = p?.target, v = this.cameras.main.worldView;
    const list = this.mobs.filter((m) => m.alive && m.label?.visible && v.contains(m.x, m.y - 20));
    const pri = (m) => (m === tgt ? -3e6 : m.def?.boss ? -2e6 : m === this.hovered ? -1e6 : 0) + Math.hypot(m.x - p.x, m.y - p.y);
    list.sort((a, b) => pri(a) - pri(b));
    const shown = [];
    for (const m of list) {
      const L = m.label, w = L.displayWidth, h = L.displayHeight, x0 = L.x - w / 2, y0 = L.y - h;
      const hit = shown.some((r) => x0 < r.x1 && x0 + w > r.x0 && y0 < r.y1 && y0 + h > r.y0);
      L.setAlpha(hit ? 0 : 1);
      if (!hit) shown.push({ x0: x0 - 2, x1: x0 + w + 2, y0: y0 - 1, y1: y0 + h + 1 });
    }
  }

  drawMob(m) {
    const h = m.worldLabelHeight || m.displayHeight;
    m.label.setPosition(m.x, m.y - h - 6).setDepth(m.y + 1);
    m.hpBg.setPosition(m.x, m.y - h - 3).setDepth(m.y + 1);
    m.hpBar.setPosition(m.x - m.barW / 2, m.y - h - 3).setDepth(m.y + 1).width = m.barW * Math.max(0, m.hp / m.maxHp);
    m.setDepth(m.y);
  }

  /** ออนไลน์: ค่อย ๆ เลื่อนไปตำแหน่งที่ server บอก */
  updateMobOnline(m, dt) {
    if (!m.alive) return;
    const dx = m.sx - m.x, dy = m.sy - m.y, d = Math.hypot(dx, dy);
    if (d > 80) m.setPosition(m.sx, m.sy);
    else if (d > 0.5) { const k = Math.min(1, dt * 10); m.x += dx * k; m.y += dy * k; }
    const ca = m.anims.currentAnim, busy = m.anims.isPlaying && ca && ca.repeat !== -1 && !/:(walk|idle)(:|$)/.test(ca.key);   // ท่าตี/ร่าย/ท่าสกิลบอส (ไม่วนซ้ำ) เล่นให้จบก่อน
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
  attackRange() { const a = JOBS[this.player.char.appearance.job]?.attack; return a?.style === 'projectile' ? Math.min(240, a.range) : 28; }   // ธนู 240 · เวท 220 · หมอยา 200 (server รับถึง range+30)
  attackCd() { const c = this.player.char; return attackInterval(JOBS[c.appearance.job]?.attack?.cooldown || 600, getDerived(c).aspd + buffAspd(this.player.buffs, this.time.now)); }   // AGI เร่งความเร็วตี (แบบ RO)

  /** ใต้มินิแมพ: กลางวัน/กลางคืน (ตัวคูณ EXP · ดวงจันทร์ · เวลาถึงช่วงถัดไป) + พระราหูรอบถัดไป */
  updateEventInfo() {
    let el = document.getElementById('td-events');
    if (!el) {
      el = document.createElement('div'); el.id = 'td-events'; el.className = 'td-events'; document.getElementById('td-hud')?.appendChild(el);
      el.addEventListener('click', (e) => { if (e.target.closest('.ev.boss') && this.wb) { this.wb.minAt = null; this.wb.forceAnn = true; this.wb.refresh(); this.sfx.play('click'); } });   // แตะแถวราหู = เปิดประกาศเต็ม
    }
    const a = this.atmo; if (!a) return;
    const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
    const N = nightInfo(Date.now() + (a.offset || 0), a.dayMs), moon = N.moon.id !== 'normal' ? ` ${N.moon.icon}` : '';
    const clk = document.getElementById('clock'), ct = `${N.period.icon} ${N.clock}`;   // นาฬิกาในเกมเหนือมินิแมพ (1 วันเกม = 20 นาทีจริง)
    if (clk && clk._t !== ct) { clk._t = ct; clk.textContent = ct; clk.title = `เวลาในเกม · ${N.period.nameTh}${N.moon.nameTh ? ` · คืนนี้${N.moon.nameTh}` : ''} (1 วันในเกม = 20 นาทีจริง)`; }
    const rows = [N.night
      ? `<div class="ev on" title="กลางคืน: ผีแรงขึ้น แต่ได้ EXP/เงินมากขึ้น${N.moon.nameTh ? ` · ${N.moon.nameTh}` : ''}">🌙 กลางคืน${moon} <b>EXP ×${N.exp}</b> <small>สว่างใน ${mmss(N.msLeft)}</small></div>`
      : `<div class="ev" title="กลางคืนผีแรงขึ้น แต่ได้ EXP/เงินมากขึ้น${N.moon.nameTh ? ` · คืนนี้${N.moon.nameTh}` : ''}">${N.period.icon} ${N.period.nameTh} ${N.clock} <small>🌙 EXP ×${N.nightExp}${moon} ใน ${mmss(N.msLeft)}</small></div>`];
    const S = this.wb?.st, now = this.wb?.now ?? Date.now();
    if (S && (S.state === 'open' || S.state === 'idle') && S.at > now) {        // พระราหู: ใกล้ลง (≤ 2 นาที) = แดงกะพริบ · กำลังสู้ = ม่วง + หลอดเลือด
      const soon = S.at - now <= 120000;
      rows.push(`<div class="ev boss${soon ? ' soon' : ''}">🌑 ${soon ? '<b>พระราหูใกล้ลง!</b>' : 'พระราหู ลงมาใน'}<span class="t">${mmss(S.at - now)}</span></div>`);
    } else if (S?.state === 'fight') {
      const pct = S.maxHp ? Math.round(S.hp / S.maxHp * 100) : 100;
      rows.push(`<div class="ev boss fight">🌑 ราหูกำลังสู้<span class="hp"><i style="width:${pct}%"></i></span><span class="t">${pct}% · ${mmss(S.fightEnd - now)}</span></div>`);
    }
    const html = rows.join('');
    if (el._html !== html) { el._html = html; el.innerHTML = html; }
    // กรอบมินิแมพรวม: สูงถึงแถวสุดท้ายของอีเวนต์ · กล่องเควสวางต่อใต้กรอบ (ไม่ทับกัน)
    const fr = document.getElementById('mm-frame'), base = document.getElementById('td-hud');
    if (fr && base && el.offsetHeight) {
      const top = fr.getBoundingClientRect().top, bottom = el.getBoundingClientRect().bottom + 6;
      fr.style.height = `${Math.round(bottom - top)}px`;
      document.documentElement.style.setProperty('--mm-bottom', `${Math.round(bottom - base.getBoundingClientRect().top)}px`);
    }
  }

  /** ดาเมจที่เราทำใส่คู่ดวล (server แจ้งกลับ) → ตัวเลขลอยบนหัวอีกฝ่าย */
  pvpDmg({ id, dmg, crit, miss } = {}) {
    const r = this.remotes.get(id);
    if (!r) return;
    popupNumber(this, r.x, r.y - 34, miss ? 'MISS' : `${dmg}${crit ? '!' : ''}`, miss ? 'miss' : crit ? 'crit' : 'normal');
  }

  playerAttack(m, time) {
    const p = this.player, ranged = this.attackRange() > 40;
    p.nextAtk = time + this.attackCd(); p.st = 'attack'; p.setVelocity(0, 0);
    p.dir = dirFromVector(m.x - p.x, m.y - p.y, p.dir);
    this.playerAnim('attack', true);
    const magic = JOBS[p.char.appearance.job]?.attack?.kind === 'magic';
    // จังหวะ: ง้าง/รวมพลังก่อน แล้วค่อยปล่อย (ธนู ~170ms · เวท ~150ms · ดาบฟันตอน ~110ms)
    const act = resolveAct(this, p.d8id, ACTION_ANIM[p.char.appearance.job]), real = act && this.anims.exists(`td:${p.d8id}:${act}:south`);
    const fireAt = real ? ({ slash: 170, shoot: 300, cast: 260, heal: 260, attack: 150 }[act] || 150) : ranged ? (magic ? 150 : 170) : 110;
    // Keep the physics feet planted; the sprite and slash effect supply the swing.
    this.time.delayedCall(ranged ? fireAt - 40 : 0, () => this.sfx.play(ranged ? 'arrow' : 'swing'));
    if (ranged) this.time.delayedCall(fireAt, () => m.alive && p.alive && this.vfx.shoot(p, m, JOBS[p.char.appearance.job]?.attack?.projectile === 'pill' ? 'pill' : magic ? 'magic' : 'arrow'));
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

  /** อยู่ในจอ (เผื่อขอบ) — เอฟเฟกต์ของคนอื่นนอกจอไม่ต้องวาด (คนออโต้เยอะ = วัตถุหลักร้อยต่อวินาที) */
  onScreen(x, y, pad = 120) { const v = this.cameras.main.worldView; return x > v.x - pad && x < v.right + pad && y > v.y - pad && y < v.bottom + pad; }

  onMobDamage(m, d) {
    if (!m) return;
    const mine = d.by === 'me' || d.by === this.net?.selfId;
    if (Number.isFinite(d.hp)) m.hp = d.hp;
    if (!mine && (this.settings?.otherDmg === false || !this.onScreen(m.x, m.y))) return;   // ของคนอื่น: นอกจอ/ปิดในตั้งค่า = อัปเดตเลือดอย่างเดียว
    if (!d.hit) { popupNumber(this, m.x, m.y - m.displayHeight, 'MISS', 'miss'); if (mine) this.sfx.play('miss'); return; }
    if (d.dot) {                                                                         // ดาเมจต่อเนื่อง: พิษ/เลือดไหล/ไฟลุก (สีต่างกัน)
      const [ic, tint] = { bleed: ['🩸', 0xff7a6a], burn: ['🔥', 0xffb35c] }[d.dot] || ['☠', 0x9dff8a];
      popupNumber(this, m.x + 6, m.y - m.displayHeight, `${ic}${d.dmg}`, 'miss'); m.setTint(tint); this.time.delayedCall(120, () => m.clearTint()); return;
    }
    popupNumber(this, m.x, m.y - m.displayHeight - 4, d.crit ? `${d.dmg}!` : `${d.dmg}`, d.crit ? 'crit' : 'normal');
    hitSpark(this, m.x, m.y - m.displayHeight * 0.5, { crit: d.crit, dir: m.x >= this.player.x ? 1 : -1 });
    squash(this, m, d.crit ? 0.25 : 0.15, 90); m.setTintFill(d.crit ? 0xffd35c : 0xffffff); this.time.delayedCall(60, () => { m.clearTint(); m.setTint(d.crit ? 0xffe9a6 : 0xffd0d0); }); this.time.delayedCall(140, () => m.clearTint());
    if (mine) {
      this.sfx.play(d.crit ? 'crit' : 'hit');
      this.hitFeel(m, d);
    }
  }

  /** ความหนักมือ: ผีกระเด็นถอย · คริ = จอสั่น · ตีบอส = หยุดภาพเสี้ยววิ (hit-stop) */
  hitFeel(m, d) {
    const p = this.player, a = Math.atan2(m.y - p.y, m.x - p.x);
    if (!m.def?.boss) {                                           // ถอยตามทิศที่โดนตี (ตำแหน่งจริงจาก server จะดึงกลับเองนุ่ม ๆ)
      const k = d.crit ? 9 : 5; m.x += Math.cos(a) * k; m.y += Math.sin(a) * k * 0.6;
    }
    const cam = this.cameras.main;
    if (d.crit) cam.shake(m.def?.boss ? 130 : 90, m.def?.boss ? 0.005 : 0.0035);
    if (m.def?.boss || d.crit) {
      const ms = m.def?.boss ? (d.crit ? 90 : 55) : 45;
      const list = [m, p].filter((o) => o.anims?.isPlaying);
      list.forEach((o) => o.anims.pause());
      this.time.delayedCall(ms, () => list.forEach((o) => o.anims?.resume()));
    }
  }

  /** ความดังของเสียงที่เกิดรอบตัว (ผู้เล่นอื่น/ผีตาย): ใกล้ = ดังเต็ม · ค่อย ๆ เบาลง · เกิน ~300px เงียบ · คูณตามตั้งค่า "เสียงผู้เล่นอื่น" */
  worldVol(x, y) {
    const k = { full: 1, soft: 0.4, off: 0 }[this.settings?.otherSfx || 'full'] ?? 1;
    if (!k) return 0;
    const d = Math.hypot(x - this.player.x, y - this.player.y);
    return k * (d <= 70 ? 1 : Math.max(0, 1 - (d - 70) / 230));
  }

  onMobDie(m) {
    if (!m || !m.alive) return;
    m.alive = false; m.hp = 0; m.setVelocity(0, 0); m.disableInteractive();
    if (this.player.target === m) this.player.target = null;
    if (!this.onScreen(m.x, m.y)) { this.setMobVisible(m, false); if (!this.econ.server) this.time.delayedCall(9000, () => this.respawnLocal(m)); return; }   // นอกจอ: ซ่อนเลย ไม่เล่นเอฟเฟกต์
    if (!playDir(m, 'die', m.dir, true)) m.setTint(0x777777);
    this.vfx?.soul(m);
    // เสียงผีตายเฉพาะตัวที่อยู่ใกล้ (ไม่ได้ยินผีที่คนอื่นตีตายไกล ๆ หรือผีกลางคืนสลายตอนเช้า ตอนยืน AFK)
    { const v = this.worldVol(m.x, m.y); if (v) { this.sfx.playAt('ghostDie', v); this.time.delayedCall(150, () => this.sfx.playAt('soul', v)); } }
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
    for (const it of r.items || []) this.ui.loot?.(`${it.card ? '🃏 ' : it.rare ? '✨ ' : ''}ได้ ${ITEMS[it.id]?.nameTh || it.id} x${it.qty || 1}`, it.card ? 5 : rarityOf(ITEMS[it.id]));
    const top = (r.items || []).filter((it) => !it.card).map((it) => ITEMS[it.id]).filter((it) => it?.affixN).sort((a, b) => b.affixN - a.affixN)[0];
    if (top) { this.sfx.play(top.affixN >= 2 ? 'victory' : 'buff'); this.ui.toast(`${top.affixN >= 2 ? '💜' : '💙'} ได้ของมีค่าสุ่ม: ${top.nameTh}`, 'ok', 2600); }   // ของดีเด้งแจ้งทันที (ไม่มีของกองพื้น)
    const card = (r.items || []).find((it) => it.card);
    if (card) this.ui.cards.showGet(card.id, r.cardNew);
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
    const doc = (this.social?.party?.members || []).some((m) => m.id !== this.net?.selfId && m.wj === 'healer' && !m.dead);
    const wait = this.gd?.respawnWait ?? RESPAWN_WAIT_MS, where = this.M.realm ? `ฟื้นที่${this.M.ZONES.hub.nameTh}` : 'ฟื้นที่ประตูเมือง';   // รอ 10 วิเสมอ (หมอยาชุบได้ก่อน)
    this.ui.showDeath(wait, { where, doc });                                     // จอตาย + นับถอยหลังสด
    this.social && (this.social.pkTarget = null);                              // ตาย = เลิกไล่เป้า PK
    const tryRespawn = () => {                                                  // ส่งซ้ำทุก 3 วิจนกว่าจะฟื้น (เน็ตหลุด/ต่อใหม่ช่วงรอ ไม่ค้างเป็นศพ)
      if (!p.dead) return;
      if (!this.econ.server) return this.onRespawn({ x: this.M.spawn.x, y: this.M.spawn.y, hp: p.derived.maxHp });
      this.net.send('td:respawn');
      this.time.delayedCall(3000, tryRespawn);
    };
    this.time.delayedCall(wait, tryRespawn);
  }

  /** หมอยาชุบชีวิต (พิธีสู่ขวัญ) → ฟื้นตรงที่สลบ ไม่ต้องกลับเมือง */
  onRevive({ hp, by }) {
    const p = this.player;
    if (!p.dead) return;
    p.dead = false; p.st = 'idle'; p.char.hp = hp;
    this.playerAnim('idle', true); this.ui.hideDeath?.();
    this.ui.toast(`🪷 ${by || 'หมอยา'} ทำพิธีสู่ขวัญ เรียกขวัญคุณกลับมาแล้ว!`, 'ok', 3000);
    this.sfx.play('blessing'); this.ui.hudCache = '';
  }

  onRespawn({ x, y, hp }) {
    const p = this.player;
    p.dead = false; p.st = 'idle'; p.setPosition(x, y); p.char.hp = hp ?? p.derived.maxHp;
    this.playerAnim('idle', true); this.ui.hideDeath?.();
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
    const lowHp = set.autoHp && c.hp / d.maxHp * 100 < set.autoHp, lowMp = set.autoMp && c.mp / d.maxMp * 100 < set.autoMp;
    // ขวดยาที่มีประจุก่อน (ฟรี เติมได้) → ค่อยใช้ยาในกระเป๋า
    const fl = (kind) => FLASK_SLOTS.find((s) => ITEMS[c.equipment?.[s]]?.flask?.kind === kind && (c.flaskCh?.[s] || 0) >= 1);
    const fs = (lowHp && fl('hp')) || (lowMp && fl('mp'));
    if (fs) { this.nextAutoPot = time + 1200; return this.drinkFlask(fs, true); }
    const hp = lowHp && HP_POTS.some((i) => count(c, i));
    const mp = !hp && lowMp && MP_POTS.some((i) => count(c, i));
    if (!hp && !mp) return;
    this.nextAutoPot = time + 1500;
    this.quickUse(hp ? HP_POTS : MP_POTS, true);
  }

  /** ตัวเลขฟื้นฟูลอยเหนือหัว (HP เขียว · MP ฟ้า) */
  popHeal(t, text, kind = 'hp') {
    const o = t.spr || t; popupNumber(this, o.x, o.y - (o.displayHeight || 40) - 16, text, kind === 'mp' ? 'mana' : 'heal');
  }

  /** ดื่มขวดยา (Q = ช่อง 1 · E = ช่อง 2) · ประจุเติมจากการฆ่าผี · กลับเมือง = เต็ม */
  drinkFlask(slot, quiet = false) {
    const p = this.player, c = p?.char;
    if (!p?.alive || this.econ.pending) return;
    const it = ITEMS[c.equipment?.[slot]];
    if (!it?.flask) return quiet ? null : this.ui.toast('ช่องขวดยาว่าง · ซื้อขวดยาที่ร้านยายติ๋มแล้วกด "ใส่"', 'warn', 1600);
    this.econ.act('flask', { slot }).then((r) => {
      if (!r.ok) return quiet ? null : this.ui.result(r);
      this.sfx.play('potion');
      this.vfx.potion(p, r.kind, true);
      this.popHeal(p, `+${r.amt} ${r.kind.toUpperCase()}`, r.kind);
      if (quiet) this.ui.loot?.(`🧪 ดื่ม${it.nameTh}อัตโนมัติ (เหลือ ${r.left})`);
    });
  }

  /** กดช่อง Hotbar: ไอเทม → ใช้/สวม/ร่ายยันต์ · สกิล → ร่าย */
  useSlot(key) {
    const v = this.player.char.hotbar?.[key];
    if (!isItemSlot(v)) return this.skills.cast(key);
    if (this.ui.anyOpen?.() || !this.player.alive) return;
    const id = slotItemId(v), it = ITEMS[id], c = this.player.char;
    if (it.type === 'flask' && FLASK_SLOTS.some((s) => c.equipment?.[s] === id)) return this.drinkFlask(FLASK_SLOTS.find((s) => c.equipment[s] === id));
    if ([...GEAR_TYPES, 'flask'].includes(it.type)) {
      if (Object.values(c.equipment || {}).includes(id)) return this.ui.toast(`${it.nameTh} ใส่อยู่แล้ว`, '', 1200);
      if (count(c, id) <= 0) return this.ui.toast(`ไม่มี ${it.nameTh} ในกระเป๋า`, 'warn');
      return this.econ.act('equip', { id }).then((r) => { this.ui.result(r); if (r.ok) this.sfx.play('equip'); });
    }
    if (count(c, id) <= 0) return this.ui.toast(`${it.nameTh} หมดแล้ว`, 'warn');
    if (it.type === 'home') return this.recall();
    this.quickUse([id]);
  }

  /** เปิด/ปิด Auto Skill (ปุ่ม R หรือปุ่ม AUTO ข้างแถบสกิล) */
  /** สลับชุดการเล่น A ⇄ B (Tab / ปุ่ม A⇄B) */
  swapPreset() {
    const c = this.player?.char;
    if (!c || this.player.dead || this.warping || this._pswap) return;
    const i = c.pset === 1 ? 0 : 1;
    this._pswap = true;
    Promise.resolve(this.econ.act('preset', { i })).then((r) => {
      this._pswap = false;
      if (!r) return;
      this.ui.result(r);
      if (!r.ok) return this.sfx.play('error');
      this.sfx.play('equip');
      yantCircle(this, this.player.x, this.player.y, { tint: i ? 0x85c1e9 : 0xf4d03f, size: 46, ms: 600 });
      this.player.target = null; this.player.autoTarget = null;
      this.refreshPresetBtn(true);
    }, () => { this._pswap = false; });
  }

  /** ปุ่ม A⇄B บน HUD: ชุดที่ใช้ + ไอคอนอาชีพ · tooltip บอกอีกชุด */
  refreshPresetBtn(force = false) {
    const b = document.getElementById('preset-btn'), c = this.player?.char;
    if (!b || !c) return;
    const cur = c.pset === 1 ? 1 : 0, o = presetInfo(c, 1 - cur), job = JOBS[c.appearance?.job];
    const key = `${cur}|${job?.icon}|${o.job}|${o.empty}`;
    if (!force && key === this._pbKey) return;
    this._pbKey = key;
    b.querySelector('.pl').textContent = PRESET_LABEL[cur];
    b.querySelector('.pj').textContent = job?.icon || '';
    b.classList.toggle('b', cur === 1);
    b.title = `ชุด ${PRESET_LABEL[cur]}: ${job?.nameTh || ''} · กด Tab สลับไปชุด ${PRESET_LABEL[1 - cur]}: ${o.empty ? 'ยังว่าง (แต้มเต็ม)' : JOBS[o.job]?.nameTh || 'มือเปล่า'}`;
  }

  toggleAutoSkill(on = !this.settings.autoSkill) {
    this.settings.autoSkill = on; saveSettings(this.settings);
    $('#auto-skill')?.classList.toggle('on', on);
    const only = this.autoFilter();
    this.ui.toast(on ? `⚡ Auto: เปิด — ตีผี${only ? `ที่เลือก ${this.autoCount(only)} ชนิด` : 'ทุกตัว'}ในหน้าจอ + ร่ายสกิลในแถบ 1–0 (เดิน/คลิกพื้นเพื่อพักชั่วคราว)` : 'Auto: ปิด', on ? 'ok' : '', 2200);
  }

  /** ฟองคำพูดเหนือหัว (แชททั่วไป) · อีโมจิล้วน = ฟองอีโมจิใหญ่ */
  chatBubble(id, text) {
    if (this.settings?.chatBubble === false) return;
    const spr = id === this.net?.selfId ? this.player : this.remotes.get(id)?.spr;
    if (!spr || spr.visible === false) return;
    this.bubbleOn(spr, text);
  }
  /** ฟองคำพูดเหนือตัว spr ใดๆ (ผู้เล่น/NPC) */
  bubbleOn(spr, text) {
    this.bubbles ||= new Map();
    this.bubbles.get(spr)?.destroy();
    const big = emojiOnly(text);
    const t = String(text).replace(/\[\[([a-z0-9_#-]+(?:@[a-z][a-z0-9]*(?:\+[a-z][a-z0-9]*)*)?)(?:\+(\d{1,2}))?\]\]/gi, (a, iid, e) => `[${ITEMS[iid]?.nameTh || iid}${e ? ` +${e}` : ''}]`);
    const shown = t.length > 60 ? `${t.slice(0, 58)}…` : t;
    const txt = makeText(this, 0, 0, shown, { fontSize: big ? '16px' : '7px', color: '#2a1a0a', align: 'center', wordWrap: { width: 110, useAdvancedWrap: true } }).setOrigin(0.5, 1);
    if (txt.setStroke) txt.setStroke('#fff8e7', 0);
    const w = Math.max(18, txt.width + 10), h = txt.height + 6;
    const g = this.add.graphics();
    g.fillStyle(0xfff8e7, 0.96).lineStyle(1, 0x8a6a2a, 1);
    g.fillRoundedRect(-w / 2, -h, w, h, 5).strokeRoundedRect(-w / 2, -h, w, h, 5);
    g.fillTriangle(-4, -0.5, 4, -0.5, 0, 5).lineBetween(-4, 0, 0, 5).lineBetween(4, 0, 0, 5);
    txt.setPosition(0, -3);
    const c = this.add.container(spr.x, spr.y, [g, txt]).setDepth(99998).setAlpha(0).setScale(0.85);
    this.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 160, ease: 'Back.Out' });
    const life = 3500 + Math.min(4000, shown.length * 70);
    const b = { c, spr, until: this.time.now + life, destroy: () => { c.destroy(); if (this.bubbles.get(spr) === b) this.bubbles.delete(spr); } };
    this.bubbles.set(spr, b);
  }
  /** ต้นไม้ที่บังผู้เล่น (ผู้เล่นอยู่ในพุ่ม/หลังต้น) → ค่อย ๆ จางเหลือ 40% · ออกมาแล้วกลับทึบ */
  fadeTreesNear(dt) {
    const p = this.player, list = this.fadeTrees;
    if (!p || !list?.length) return;
    const k = Math.min(1, dt * 8);
    for (const img of list) {
      const hw = img.displayWidth * 0.42, top = img.y - img.displayHeight;
      const playerHalf = Math.min(12, p.displayWidth * 0.25);
      const cover = img.depth >= p.depth && p.x + playerHalf > img.x - hw && p.x - playerHalf < img.x + hw && p.y - 6 > top + 6 && p.y - p.displayHeight < img.y;
      const want = cover ? 0.28 : 1;
      if (img.alpha !== want) img.setAlpha(Math.abs(img.alpha - want) < 0.02 ? want : img.alpha + (want - img.alpha) * k);
    }
  }

  updateBubbles(time) {
    if (!this.bubbles?.size) return;
    for (const b of [...this.bubbles.values()]) {
      if (b.fading) continue;
      if (!b.spr.active || time > b.until) { b.fading = true; this.tweens.add({ targets: b.c, alpha: 0, duration: 250, onComplete: () => b.destroy() }); continue; }
      // ลอยเหนือป้ายชื่อ/ฉายาจริง (ความสูงตัวอักษรไทยไม่คงที่ → วัดจากป้ายที่แสดงอยู่)
      const tags = b.spr === this.player ? [this.nameTag, this.titleTag] : b.spr._tags || [];
      let top = b.spr._bubbleTop ? b.spr._bubbleTop() : b.spr.y - b.spr.displayHeight - 4;
      for (const t of tags) if (t?.visible && t.active) top = Math.min(top, t.y - t.displayHeight * t.originY - 2);
      b.c.setPosition(b.spr.x, top);
    }
  }

  /** ฉายาตำนาน (fx 'glow'): เรืองแสงสีฉายา + หายใจช้า ๆ · ฉายาอื่นล้างเอฟเฟกต์ */
  titleFx(txt, T) {
    txt._fx?.remove(); txt._fx = null; txt.setAlpha(1);
    if (T?.fx !== 'glow') { txt.setShadow(0, 0, '#000000', 0); return; }
    txt.setShadow(0, 0, T.color, 6, true, true);
    txt._fx = this.tweens.add({ targets: txt, alpha: 0.65, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    if (!txt._fxHook) { txt._fxHook = true; txt.once('destroy', () => { txt._fx?.remove(); txt._fx = null; }); }
  }

  /** ป้ายชื่อตัวเอง (มีฉายาอยู่บรรทัดบน) */
  refreshNameTag() {
    const c = this.player?.char; if (!c || !this.nameTag) return;
    const t = TITLE_BY_ID[c.title];
    const nm = `${this.selfGm?.() ? '[GM] ' : ''}${c.name}`;
    if (this.nameTag.text !== nm) { this.nameTag.setText(nm); gmStyle(this.nameTag, this.selfGm?.()); }
    const tt = t ? `«${t.nameTh}»` : '';
    if (this.titleTag && this.titleTag.text !== tt) { this.titleTag.setText(tt).setColor(t?.color || '#ffffff').setVisible(!!t); this.titleFx(this.titleTag, t); }
  }

  // ------------------------------------------------------------
  //  ออนไลน์
  // ------------------------------------------------------------
  setupNetwork() {
    const net = (this.net = new Network());
    if (!this.econ.server) { this.ui.setOnline(false, 0); this.ui.toast('โหมดออฟไลน์: เซฟในเครื่อง', '', 4000); return; }
    net.on('online:count', (n) => this.ui.setOnlineTotal(n));
    net.on('status', (on) => { this.ui.setOnline(on, this.remotes.size); if (!on) { this.remotes.forEach((r) => r.destroy()); this.remotes.clear(); } })
      .on('init', ({ admin, serverTime, dayMs }) => { if (account.account) account.account.admin = !!admin; this.atmo?.sync(serverTime, dayMs); net.send('td:enter'); })
      .on('char:load', (s) => { this.econ.apply(s); this.cosRefundNotice(); this.social?.syncSelfPk?.(); })
      .on('mk:travel', (t) => this.onTravel(t))
      .on('mk:note', (d) => { this.ui.toast(d?.text || '', 'ok', 6000); this.ui.mkV?.fetch(true); })
      .on('char:sync', (s) => this.econ.apply(s))
      .on('rejected', ({ msg }) => this.ui.toast(msg || 'เข้าเกมไม่สำเร็จ', 'warn', 6000))
      .on('kicked', ({ msg }) => { this.ui.banner(msg || 'บัญชีนี้เข้าเกมจากเครื่องอื่น'); net.socket?.disconnect(); })
      .on('pl:hit', (d) => this.onPlayerHit(d))
      .on('pl:die', () => this.playerDie())
      .on('pl:hp', ({ hp }) => { if (Number.isFinite(hp)) { this.player.char.hp = hp; this.ui.hudCache = ''; } })
      .on('chat', (m) => this.ui.chat(m))
      .on('td:init', ({ map, maps, x, y, players, cryptOpen }) => {
        if (Array.isArray(maps)) this.visitedMaps = [...new Set([...this.visitedMaps, ...maps])];
        if (map && map !== this.M.id) this.loadMap(map, { x, y });
        if (cryptOpen) { this.cryptOpen = true; this.refreshCryptPortals?.(); }   // เข้ามากลางชั้นที่เคลียร์แล้ว → บันไดเปิด
        this.player.setPosition(x, y); this.cameras.main.centerOn(x, y);
        players.forEach((q) => this.addRemote(q));
        this.ui.setOnline(true, this.remotes.size);
      })
      .on('td:joined', (q) => { this.addRemote(q); this.ui.chat({ name: '📢 ระบบ', text: `${q.name} เข้าสู่${this.M.nameTh}` }); this.ui.setOnline(true, this.remotes.size); })
      .on('td:warp', ({ map, maps, x, y, players, how, cryptOpen }) => {
        this.warping = false;
        if (Array.isArray(maps)) this.visitedMaps = [...new Set([...this.visitedMaps, ...maps])];
        this.loadMap(map, { x, y });
        if (cryptOpen) { this.cryptOpen = true; this.refreshCryptPortals?.(); }
        (players || []).forEach((q) => this.addRemote(q));
        this.ui.setOnline(true, this.remotes.size);
        if (how === 'portal' && maps?.length && this.M.realm) this.ui.toast(`🌀 ปลดล็อกวาร์ป: ${this.M.nameTh} (คุยกับฤๅษีเฝ้าประตูมิติเพื่อกลับมาได้ทันที)`, 'ok', 3200);
      })
      .on('td:warpFail', ({ msg }) => { this.warping = false; this.questNav?.stop(); this.ui.toast(msg || 'วาร์ปไม่สำเร็จ', 'warn', 2400); })
      .on('crypt:info', (d) => this.showCrypt(d))
      .on('crypt:fail', ({ msg }) => { this.warping = false; this.ui.toast(msg || 'เข้าไม่ได้', 'warn', 2600); })
      .on('crypt:left', ({ left }) => { if (left <= 3 || left % 5 === 0) this.ui.toast(`💀 เหลือผีอีก ${left} ตัว`, '', 1600); })
      .on('crypt:open', ({ f, boss, final }) => {
        this.cryptOpen = true; this.refreshCryptPortals();
        this.ui.banner(final ? '🏆 พิชิตสุสานใต้ดิน 100 ชั้น!' : boss ? `☠ ปราบบอสชั้น ${f} สำเร็จ` : `▼ ชั้น ${f} เคลียร์แล้ว`, final ? 'เดินเข้าวงแสงเพื่อกลับกรุงศรีฯ' : boss ? `บันทึกจุดเริ่มชั้น ${f + 1} · บันไดลงเปิดแล้ว` : 'บันไดลงเปิดแล้ว');
        this.sfx.play('levelup');
      })
      .on('crypt:chest', (c) => this.onCryptChest(c))
      .on('td:left', (id) => this.removeRemote(id))
      .on('skill', (d) => { const r = this.remotes.get(d.id); if (r && this.settings?.otherFx !== false && this.onScreen(d.x, d.y, 300)) this.skills.remote(d, r); })   // สกิลคนอื่นไกลนอกจอ: ไม่วาด
      .on('td:state', (s) => this.applyState(s))
      .on('td:dmg', (d) => this.onMobDamage(this.mobs[d.mid], d))
      .on('td:die', ({ mid }) => this.onMobDie(this.mobs[mid]))
      .on('td:matk', ({ mid }) => { const m = this.mobs[mid]; if (!m) return; if (!m.alive || m.alpha < 0.5 || !m.visible) { m.alive = true; if (m.sx != null) m.setPosition(m.sx, m.sy); this.setMobVisible(m, true); } playDir(m, 'attack', m.dir, true); })
      .on('td:aoe', (a) => this.bossAoe(a))
      .on('td:title', ({ id, title }) => this.remotes.get(id)?.setTitle(title))
      .on('player:rename', ({ id, name, old, gm }) => {
        if (id === this.net.selfId) { this.player.char.name = name; this.refreshNameTag(); this.ui.hudCache = ''; }
        else this.remotes.get(id)?.rename(name, gm);
        if (old) this.ui.chat({ id: null, name: '📝 ระบบ', text: `${old} เปลี่ยนชื่อเป็น ${name}` });
      })
      .on('news:live', (l) => this.ui.news?.setLive(l))
      .on('news:add', (it) => this.ui.news?.add(it))
      .on('news:del', (id) => this.ui.news?.del(id))
      .on('appearance', ({ id, appearance }) => { if (id !== this.net.selfId && appearance) this.remotes.get(id)?.setAppearance(appearance); })
      .on('td:pbuff', (d) => this.skills?.partyReceive(d))
      .on('td:heal', (d) => this.skills?.healFx(d))
      .on('td:tether', (d) => this.skills?.tetherFx(d))
      .on('td:seed', (d) => this.skills?.seedFx(d))
      .on('td:revive', (d) => this.onRevive(d))
      .on('td:fx', ({ id, kind, big }) => { const r = this.remotes.get(id); if (r && r.visible !== false) this.vfx.potion(r, kind, big); })
      .on('td:reward', (r) => this.showReward({ ...r, x: this.mobs[r.mid]?.x, y: this.mobs[r.mid]?.y }))
      .on('td:respawn', (d) => this.onRespawn(d))
      .on('td:correct', ({ x, y }) => { if (dist(this.player, { x, y }) > 24) { this.player.setPosition(x, y); this.player.path = []; } });
    net.connect(this.player.char.name, () => ({ token: account.token, slot: account.slot }));
  }

  applyState({ map, p: ps, m: ms }) {
    if (map && map !== this.M.id) return;                          // แพ็กเก็ตค้างจากแมพเก่า (ระหว่างวาร์ป)
    const got = new Set();
    for (const [mid, x, y, dirI, hp] of ms) {
      const m = this.mobs[mid];
      if (!m) continue;
      got.add(mid);
      m.sx = x; m.sy = y; m.dir = dirOfIndex(dirI);
      if (m._stale) { m._stale = false; m.setPosition(x, y); if (m.alive) this.setMobVisible(m, true); }
      if (hp > 0) {
        m.hp = hp;
        if (!m.alive) { m.alive = true; m.setPosition(x, y); this.setMobVisible(m, true); playDir(m, 'walk', m.dir, true); }
      } else if (m.alive) this.onMobDie(m);
    }
    // server ส่งเฉพาะผีรอบตัว (±780×540) → ผีที่ไม่ได้รับ แต่ภาพค้างอยู่ใกล้เรา = ตำแหน่งเก่า ซ่อนไว้จนกว่าจะได้ข้อมูลใหม่
    const me = this.player;
    if (me) for (const mid in this.mobs) {
      const m = this.mobs[mid];
      if (got.has(+mid) || got.has(mid) || m._stale || !m.alive) continue;
      if (Math.abs(m.x - me.x) < 720 && Math.abs(m.y - me.y) < 490) { m._stale = true; this.setMobVisible(m, false); }
    }
    for (const [id, x, y, dir, anim, hp, maxHp, level] of ps) if (id !== this.net.selfId) { const r = this.remotes.get(id); if (r) { r.push({ x, y, dir, anim }); r.hp = hp; r.maxHp = maxHp; if (level) r.level = level; } }
  }

  removeRemote(id) { this.remotes.get(id)?.destroy(); this.remotes.delete(id); this.ui.setOnline(this.net.online, this.remotes.size); this.evictSoon(); }   // ชุดของคนที่ออกไป → ปล่อยทีหลัง

  addRemote(q) {
    if (this.remotes.has(q.id) || q.id === this.net.selfId) return;
    const key = bakeCharacter(this, q.appearance);
    const s = this.add.sprite(q.x, q.y, key, 'idle_0').setOrigin(0.5, 1).setDepth(q.y);
    s.legacyKey = key; this.applyHero(s, q.appearance); s.holdAttack = () => q.appearance?.job !== 'boxer'; s.actionAnim = () => ACTION_ANIM[q.appearance?.job];
    this.weapons?.attach(s, () => q.appearance, () => ({ anim: r.anim }));
    const label = (lv) => `${q.gm ? '[GM] ' : ''}${q.name} Lv.${lv}`;
    const tag = makeText(this, q.x, q.y, label(q.level), { fontSize: '7px', color: '#aed6f1', align: 'center' }).setOrigin(0.5, 1);
    if (q.gm) gmStyle(tag);                                                          // GM: ชื่อแดงขอบขาวเรืองแสง
    const showN = () => this.settings?.otherNames !== false || q.pk === 'red' || q.gm;   // ตั้งค่าซ่อนชื่อ: หัวแดง/GM ยังเห็นเสมอ
    const paintPk = (pk) => { s._nameVis?.(); if (q.gm) return; tag.setColor(pk === 'red' ? '#ff4a3d' : pk === 'purple' ? '#d38cff' : '#aed6f1'); };   // PK: หัวแดง / ม่วง (ตีคนก่อน)
    paintPk(q.pk);
    const ttl = makeText(this, q.x, q.y, '', { fontSize: '7px', color: '#ffffff', align: 'center' }).setOrigin(0.5, 1);   // ฉายา (สีตามฉายา) เหนือชื่อ
    const paintTitle = (t) => { s._titleId = t; const T = TITLE_BY_ID[t]; ttl.setText(T ? `«${T.nameTh}»` : '').setColor(T?.color || '#ffffff').setVisible(!!T && showN()); this.titleFx(ttl, T); };
    s._nameVis = () => { tag.setVisible(showN()); paintTitle(s._titleId); };
    paintTitle(q.title); tag.setVisible(showN());
    s._tags = [tag, ttl];
    s.setInteractive({ useHandCursor: true });                                   // คลิกผู้เล่น → เมนู เชิญ/เทรด/เพื่อน/กระซิบ
    s._remote = true;
    s.on('pointerdown', (ptr) => {
      if (uiBlocked(ptr) || ptr.rightButtonDown()) return;
      if (this.social?.pkOn && !ptr.event?.shiftKey) { ptr.event?.stopPropagation?.(); this.social.pkAttack(r.id); return; }   // โหมด PK: คลิกคน = โจมตี (Shift+คลิก = เมนู)
      if (this.playerMenuClick(ptr)) { ptr.event?.stopPropagation?.(); this.social?.openPlayerMenu(r, { x: ptr.x, y: ptr.y }); return; }
      // ระหว่างสู้: กดค้างที่ตัวผู้เล่น ~0.45 วิ = เปิดเมนู (มือถือไม่มี Shift)
      const x0 = ptr.x, y0 = ptr.y;
      this.time.delayedCall(450, () => { if (ptr.isDown && Math.hypot(ptr.x - x0, ptr.y - y0) < 14 && s.active) { this.player.path = []; this.social?.openPlayerMenu(r, { x: ptr.x, y: ptr.y }); navigator.vibrate?.(15); } });
    });
    const sh = this.addShadow(s, 22);
    const r = {
      id: q.id, netId: q.id, name: q.name, level: q.level, hp: q.hp, maxHp: q.maxHp, spr: s,
      tx: q.x, ty: q.y, dir: 'south', anim: 'idle',
      push(st) { this.tx = st.x; this.ty = st.y; this.dir = st.dir || this.dir; this.anim = st.anim || 'idle'; },
      update(dt) {
        const dx = this.tx - s.x, dy = this.ty - s.y;
        if (Math.hypot(dx, dy) > 120) s.setPosition(this.tx, this.ty); else { const k = Math.min(1, dt * 12); s.x += dx * k; s.y += dy * k; }
        if (this._lv !== this.level) { this._lv = this.level; tag.setText(label(this.level)); }
        s.setDepth(s.y); tag.setPosition(s.x, s.y - s.displayHeight - 3).setDepth(s.y + 1); if (ttl.visible) ttl.setPosition(s.x, tag.y - tag.displayHeight).setDepth(s.y + 1);
        playDir(s, this.anim, this.dir);
      },
      destroy: () => { this.weapons?.detach(s); s.destroy(); tag.destroy(); ttl.destroy(); sh.destroy(); this.shadows = this.shadows.filter((x) => x.obj !== s); },
      get x() { return s.x; }, get y() { return s.y; }, get appearance() { return q.appearance; },
      setTitle(t) { paintTitle(t); },
      setPk(pk) { q.pk = pk; r.pk = pk; paintPk(pk); },
      rename(n, gm) { q.name = n; r.name = n; q.gm = !!gm; tag.setText(label(r.level)); gmStyle(tag, !!gm, '#aed6f1'); },
      setAppearance: (a) => { q.appearance = a; this.applyHero(s, a); },
    };
    this.remotes.set(q.id, r);
  }

  // ------------------------------------------------------------
  //  อินพุต
  // ------------------------------------------------------------
  buildInput() {
    const kb = this.input.keyboard;
    this.keys = kb.addKeys('UP,LEFT,DOWN,RIGHT,W,A,S,D', false);          // เดิน: ลูกศร หรือ WASD
    this.input.mouse?.disableContextMenu();                    // คลิกขวาไม่เปิดเมนูของเบราว์เซอร์
    this.input.on('pointerdown', (ptr, over) => {
      if (this.touch?.owns(ptr)) return;                        // นิ้วที่กำลังใช้จอยสติ๊ก/ปุ่มบนจอ
      if (uiBlocked(ptr)) return;                                // แตะโดนหน้าต่าง/เมนู (หรือเพิ่งเปิด-ปิด) → ไม่ทะลุลงฉาก
      const w = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
      const hitMob = over.find((o) => o.mid != null && o.alive) || this.mobAt(w.x, w.y, this.touch?.on ? 30 : 14);
      // คลิกขวา = โจมตีผีที่ชี้ (หรือตัวที่ใกล้จุดคลิกที่สุด) · ไม่มีผีก็ไม่เดิน
      if (ptr.rightButtonDown()) { if (hitMob) this.setTarget(hitMob); return; }
      if (hitMob) { this.setTarget(hitMob); return; }           // คลิกซ้าย/แตะโดนผี = โจมตี
      // ตัวผู้เล่นคนอื่นไม่บังการเดินตอนสู้ (เมนูผู้เล่นเปิดเฉพาะตอนไม่สู้ หรือ Shift+คลิก)
      if (over.some((o) => !(o._remote && !this.playerMenuClick(ptr)))) return;   // NPC/ของที่มีคำสั่งของตัวเอง
      const npc = this.npcAt(w.x, w.y, this.touch?.on ? 14 : 4);                  // แตะโดนป้ายชื่อ/ใกล้ตัว NPC (มือถือเผื่อระยะนิ้ว) = คุย
      if (npc) { this.talk(npc); return; }
      this.player.target = null;
      this.social?.pw?.stopFollow();                             // คลิกพื้นเดินเอง = เลิกตาม
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
    kb.on('keydown-T', () => { if (!this.ui.typing && !document.activeElement?.matches?.('input, textarea, select')) this.social?.pwin?.toggle(); });   // หน้าต่างปาร์ตี้แบบการ์ด (G = สมุดคู่มือ)
    kb.on('keydown-TAB', (e) => { if (this.ui.typing || document.activeElement?.matches?.('input, textarea, select')) return; e?.preventDefault?.(); this.swapPreset(); });
    { const pb = $('#preset-btn'); if (pb) pb.onclick = (e) => { e.stopPropagation(); this.swapPreset(); }; }
    kb.on('keydown-Q', () => { if (!this.ui.typing && !this.ui.anyOpen?.()) this.drinkFlask('flask'); });
    kb.on('keydown-E', () => { if (!this.ui.typing && !this.ui.anyOpen?.()) this.drinkFlask('flask2'); });
    document.querySelectorAll('.flask-btn').forEach((b) => (b.onclick = () => this.drinkFlask(b.dataset.flask)));
    kb.on('keydown-R', (e) => { if (this.ui.typing || this.ui.anyOpen?.()) return; if (e.shiftKey) this.toggleAutoMenu(); else this.toggleAutoSkill(); });   // A ใช้เดินแล้ว → Auto ย้ายมา R
    { const bt = $('#auto-skill'); if (bt) { bt.classList.toggle('on', !!this.settings.autoSkill); bt.onclick = () => this.toggleAutoSkill(); bt.oncontextmenu = (e) => { e.preventDefault(); this.toggleAutoMenu(); }; } }
    { const cf = $('#auto-cfg'); if (cf) cf.onclick = (e) => { e.stopPropagation(); this.toggleAutoMenu(); }; }
    this.onAutoMenuOutside = (e) => { const box = $('#auto-menu'); if (box && !box.classList.contains('hidden') && !e.target.closest('#auto-menu, #auto-cfg, #auto-skill')) box.classList.add('hidden'); };
    document.addEventListener('pointerdown', this.onAutoMenuOutside);
    this.events.once('shutdown', () => { document.removeEventListener('pointerdown', this.onAutoMenuOutside); $('#auto-menu')?.classList.add('hidden'); });
    this.updateAutoBadge();
    kb.on('keydown-I', () => this.ui.toggle('inv-panel'));
    kb.on('keydown-C', () => this.ui.toggle('stats-panel'));
    kb.on('keydown-K', () => this.ui.toggle('skill-panel'));
    kb.on('keydown-P', () => this.ui.toggle('social-panel'));
    kb.on('keydown-G', () => (document.querySelector('#guide-panel').classList.contains('hidden') ? this.ui.guide.open() : this.ui.toggle('guide-panel', false)));
    kb.on('keydown-O', () => (document.querySelector('#card-panel').classList.contains('hidden') ? this.ui.cards.open() : this.ui.toggle('card-panel', false)));
    kb.on('keydown-J', () => this.village.openQuests());
    kb.on('keydown-H', () => this.ui.toggle('help-panel'));
    kb.on('keydown-N', () => { if (!this.ui.typing) this.ui.news?.toggle(); });
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

  /** NPC ที่จุดแตะ/คลิกนี้ (รวมป้ายชื่อ + เผื่อระยะนิ้ว) → ใกล้จุดแตะที่สุด */
  npcAt(x, y, pad = 6) {
    let best = null, bd = Infinity;
    for (const n of this.npcs || []) {
      const half = Math.max(16, (n._plate?.w || 0) / 2) + pad, top = (n._plate?.top ?? n.y - 60) - pad;
      if (x < n.x - half || x > n.x + half || y < top || y > n.y + 6 + pad) continue;
      const d = Math.hypot(x - n.x, y - (n.y - 20));
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }

  /** ปุ่มลัด "💬 คุยกับ …" (เดินเข้าใกล้ NPC แล้วเด้งขึ้น · มือถือไม่ต้องเล็งแตะตัว NPC · คอมกด F) */
  updateTalkPill() {
    let el = this.talkPill;
    if (!el) {
      el = this.talkPill = document.createElement('button');
      el.id = 'npc-talk'; el.className = 'npc-talk hidden';
      el.innerHTML = '<span class="nt-face"><img alt="" /><i></i></span><span class="nt-txt"><b></b><small></small></span><kbd>F</kbd>';
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (this.talkNpc) this.talk(this.talkNpc); });
      document.getElementById('td-hud')?.appendChild(el);
      this.events.once('shutdown', () => { el.remove(); this.talkPill = null; });
    }
    const n = this.player?.alive && !this.ui.anyOpen?.() && !this.npcDlg?.open ? this.nearestNpc(72) : null;
    el.classList.toggle('hidden', !n);
    if (!n || this.talkNpc === n) return;
    this.talkNpc = n;
    const verb = NPC_OPEN[n.id] ? 'เปิดร้าน' : n.id === 'quest' ? 'รับเควส' : n.id === 'warp' ? 'วาร์ป' : 'คุยกับ';
    el.querySelector('b').textContent = n.id === 'crypt' ? '💀 ลงสุสานใต้ดิน' : n.id === 'ghostdg' ? '☠️ ดันเจี้ยนสี่ผีป่าช้า' : `${verb} ${n.nameTh}`;
    el.querySelector('small').textContent = n.id === 'crypt' ? `${n.nameTh} · 100 ชั้น` : n.role || '';
    const img = el.querySelector('img'), ic = el.querySelector('i');
    img.style.display = 'none'; ic.textContent = NPC_ICON[n.id] || '💬';
    npcPortrait(n.key).then((url) => { if (url && this.talkNpc === n) { img.src = url; img.style.display = ''; ic.textContent = ''; } });
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
      for (const ox of [-7, 7]) for (const oy of [-7, 3]) { const tx = Math.floor((x + ox) / TILE), ty = Math.floor((y + oy) / TILE); if (solid[ty]?.[tx] !== false) return false; }   // ครอบเท้าเต็มกล่อง (12x8) + เผื่อ 1px
    }
    return true;
  }

  findPath(sx, sy, tx, ty) {
    const solid = this.solid;
    const s = [Math.floor(sx / TILE), Math.floor(sy / TILE)], t = [Math.floor(tx / TILE), Math.floor(ty / TILE)];
    const MAP_W = this.mapW, MAP_H = this.mapH;
    const inb = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
    if (!inb(t[0], t[1])) return [];
    if (solid[t[1]][t[0]]) {
      let best = null, bd = 1e9;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const x = t[0] + dx, y = t[1] + dy; if (inb(x, y) && !solid[y][x]) { const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = [x, y]; } } }
      if (!best) return []; t[0] = best[0]; t[1] = best[1];
    }
    const key = (x, y) => y * MAP_W + x, h = (x, y) => Math.abs(x - t[0]) + Math.abs(y - t[1]);
    // A* ด้วย binary heap + closed set (เดิมสแกน open ทั้งก้อนทุกก้าว → หาทางไม่เจอ = กระตุกหลายสิบ ms)
    const heap = [], came = new Map(), g = new Map(), closed = new Set();
    const push = (k, f) => { heap.push([f, k]); let i = heap.length - 1; while (i) { const pi = (i - 1) >> 1; if (heap[pi][0] <= heap[i][0]) break; [heap[pi], heap[i]] = [heap[i], heap[pi]]; i = pi; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    const sk = key(s[0], s[1]); push(sk, h(s[0], s[1])); g.set(sk, 0);
    let iter = 0;
    while (heap.length && iter++ < 20000) {
      const ck = pop()[1];
      if (closed.has(ck)) continue;
      closed.add(ck);
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
        const nk = key(nx, ny); if (closed.has(nk)) continue;
        const ng = g.get(ck) + (dx && dy ? 1.414 : 1);
        if (ng < (g.get(nk) ?? 1e9)) { g.set(nk, ng); came.set(nk, ck); push(nk, ng + h(nx, ny)); }
      }
    }
    return [];
  }

  moveTo(x, y, navigation = false) { if (!navigation) this.questNav?.stop(); const p = this.player; this.pendingTalk = null; if (this.social && !this._pkChase) this.social.pkTarget = null; if (p.alive) p.path = this.findPath(p.x, p.y - 2, x, y); }   // สั่งเดินที่ใหม่ = เลิกเดินไปคุย NPC ที่ค้างอยู่ (talk() ตั้งกลับเองหลังเรียก)

  /**
   * กันติดสิ่งก่อสร้าง: เดินตามทาง (คลิก/Auto) แต่ตำแหน่งไม่ขยับเกิน 0.45 วิ
   * → ปิดทางลัดชั่วคราว · กลับไปกลางช่องที่ยืน แล้วหาทางใหม่ · ติดซ้ำ 3 ครั้งตอน Auto → เปลี่ยนเป้า
   */
  unstick(p, time, manual) {
    if (manual || !p.path.length || p.st !== 'walk') { p.stuck = null; if (!p.path.length) p.stuckN = 0; return; }
    const r = p.stuck;
    if (!r || Math.hypot(p.x - r.x, p.y - r.y) > 3) { p.stuck = { x: p.x, y: p.y, t: time }; return; }
    if (time - r.t < 450) return;
    p.stuck = { x: p.x, y: p.y, t: time };
    p.stuckN = (p.stuckN || 0) + 1;
    p.noShortcut = time + 2500;
    if (p.stuckN >= 3 && p.autoTarget) {
      const m = p.autoTarget; m.autoSkip = time + 8000; p.target = null; p.autoTarget = null; p.path = []; p.stuckN = 0;
      return;
    }
    const goal = p.path[p.path.length - 1];
    const cx = Math.floor(p.x / TILE) * TILE + TILE / 2, cy = Math.floor((p.y - 2) / TILE) * TILE + TILE / 2;
    const path = this.findPath(cx, cy, goal.x, goal.y);
    p.path = this.solid[Math.floor(cy / TILE)]?.[Math.floor(cx / TILE)] ? path : [{ x: cx, y: cy }, ...path];
    p.nextPath = time + 1200;                       // ให้เวลาเดินหลุดก่อนหาทางใหม่อีกรอบ
  }

  // ------------------------------------------------------------
  //  update
  // ------------------------------------------------------------
  update(time, delta) {
    const p = this.player, k = this.keys, dt = delta / 1000;
    this.questNav?.update(time);
    const typing = this.ui.typing;
    if (p.alive) {
      const kR = k.RIGHT.isDown || k.D.isDown, kL = k.LEFT.isDown || k.A.isDown, kD = k.DOWN.isDown || k.S.isDown, kU = k.UP.isDown || k.W.isDown;
      let vx = typing ? 0 : kR - kL;
      let vy = typing ? 0 : kD - kU;
      if (this.touch?.vec) { vx += this.touch.vec.x; vy += this.touch.vec.y; }   // จอยสติ๊กบนมือถือ
      if (vx || vy) { this.questNav?.stop(); p.path = []; p.target = null; this.pendingTalk = null; this.social?.pw?.stopFollow(); if (this.social) this.social.pkTarget = null; }   // เดินเอง = เลิกติดตามหัวหน้า
      else if (p.target) {
        const m = p.target;
        if (!m.alive) p.target = null;
        else {
          const dd = dist(p, m), range = this.attackRange();
          if (dd > range) {
            if (p.autoTarget === m && time - (p.autoSince || time) > AUTO_GIVEUP) { m.autoSkip = time + 8000; p.target = null; p.autoTarget = null; p.path = []; }   // ไปไม่ถึง → ข้ามชั่วคราว
            else if (!p.path.length || time > (p.nextPath || 0)) {
              p.nextPath = time + 400; p.path = this.findPath(p.x, p.y - 2, m.x, m.y);
              if (!p.path.length && p.autoTarget === m) { m.autoSkip = time + 8000; p.target = null; p.autoTarget = null; }   // หาทางไปไม่ได้ → ข้ามทันที ไม่ยืนนิ่ง
            }
          } else { p.path = []; p.autoSince = time; if (time >= p.nextAtk && p.st !== 'attack') this.playerAttack(m, time); }
        }
      } else if (this.social?.duel || this.social?.pkTarget) {                // ดวล/PK: ไม่มีเป้าผี → ตีปกติใส่ผู้เล่นเป้าเมื่ออยู่ในระยะ (สกิลกดใช้ตามปกติ)
        const pk = !this.social.duel, foe = this.remotes.get(pk ? this.social.pkTarget : this.social.duel.foe);
        if (pk && foe && this.ui.target === this.social.pkFrame) this.ui.targetUntil = performance.now() + 4000;   // ล็อกอยู่ → กรอบเป้าหมายค้างไว้
        if (!foe || (pk && !(foe.hp > 0))) { if (pk) this.social.pkTarget = null; }   // เป้าหาย/ตายแล้ว = เลิกไล่
        else if (Math.hypot(foe.x - p.x, foe.y - p.y) > this.attackRange() + 14) {
          if (pk && time > (p.nextPath || 0)) { p.nextPath = time + 400; p.path = this.findPath(p.x, p.y - 2, foe.x, foe.y); if (!p.path.length) this.social.pkTarget = null; }   // PK: ไล่ตาม
        } else if (time >= p.nextAtk && p.st !== 'attack') {
          p.path = []; p.nextAtk = time + this.attackCd(); p.st = 'attack'; p.setVelocity(0, 0);
          p.dir = dirFromVector(foe.x - p.x, foe.y - p.y, p.dir);
          this.playerAnim('attack', true);
          this.sfx.play(this.attackRange() > 40 ? 'arrow' : 'swing');
          this.net?.send(pk ? 'pk:hit' : 'pvp:hit', pk ? { id: foe.id } : {});
        }
      } else if (this.settings.autoSkill && !this.questNav?.travelling && !p.path.length && !this.recalling && !this.social?.pw?.following && time > (p.nextAuto || 0)) {
        // Auto: ไม่มีเป้า/ไม่ได้สั่งเดิน → ล็อกผีที่ใกล้ที่สุดในหน้าจอ (ตามชนิดที่เลือก) แล้วเดินไปตีเอง
        p.nextAuto = time + 300;
        const m = this.autoPick(time);
        if (m) { this.setTarget(m, true); p.autoTarget = m; p.autoSince = time; }
      }
      if (!vx && !vy && p.path.length) {
        // ทางลัด: ถ้ามองเห็นจุดถัดไปตรง ๆ ข้ามจุดกลางทาง → เดินเป็นเส้นตรง ไม่ซิกแซกตามช่องตาราง
        while (time > (p.noShortcut || 0) && p.path.length > 1 && this.lineClear(p.x, p.y - 2, p.path[1].x, p.path[1].y)) p.path.shift();
        const n = p.path[0], dx = n.x - p.x, dy = n.y - (p.y - 2), d = Math.hypot(dx, dy);
        if (d < 5) p.path.shift(); else { vx = dx / d; vy = dy / d; }
        if (!p.path.length && this.pendingTalk) { const n2 = this.pendingTalk, q2 = this.pendingQuick; this.pendingTalk = null; if (this.talkRetry) this.talkRetry.t = performance.now(); this.talk(n2, q2); }
      }
      if (this.gd?.here) { if (this.gd.rooted) vx = vy = 0; else if (this.gd.reversed) { vx = -vx; vy = -vy; } }   // ดันเจี้ยนสี่ผี: บ่วงแขวนคอ (ขยับไม่ได้) · วิญญาณสับสน (เดินกลับด้าน)
      if (p.st === 'attack') p.setVelocity(0, 0);
      else if (vx || vy) {
        const len = Math.hypot(vx, vy) || 1;
        const now = this.time.now, sp = SPEED * (1 + Math.min(0.4, (p.buffs || []).reduce((a, b) => a + (b.until > now && b.buff?.speed || 0), 0))) * (this.wb?.speedMul(p) ?? 1) * (this.gd?.speedMul?.() ?? 1);   // ยาต้มพยัคฆ์เหิน: วิ่งเร็วขึ้น
        p.setVelocity(vx / len * sp, vy / len * sp);
        p.dir = stableDir(vx, vy, p.dir); p.st = 'walk'; this.playerAnim('walk');
        p.anims.timeScale = sp / SPEED;
      } else { p.setVelocity(0, 0); p.st = 'idle'; this.playerAnim('idle'); }
      this.unstick(p, time, !!(!typing && (kR || kL || kD || kU) || this.touch?.vec));
      if (!this.econ.server && this.inTown() && p.char.hp < p.derived.maxHp) p.char.hp = Math.min(p.derived.maxHp, p.char.hp + p.derived.maxHp * 0.04 * dt);
    } else p.setVelocity(0, 0);
    p.setDepth(p.y);
    this.nameTag.setPosition(p.x, p.y - p.displayHeight - 3);
    if (this.titleTag?.visible) this.titleTag.setPosition(p.x, this.nameTag.y - this.nameTag.displayHeight);
    if (time > (this.nextAutoMenu || 0)) { this.nextAutoMenu = time + 1000; this.refreshAutoMenuCounts(); }
    if (time > (this.nextTalkPill || 0)) { this.nextTalkPill = time + 150; this.updateTalkPill(); this.refreshPresetBtn(); this.npcDlg?.update(); }
    if (this.tut?.on) { if (time > (this.nextTut || 0)) { this.nextTut = time + 120; this.tut.update(); } }
    else if (!this.tut && this.net?.selfId && time > 2500) this.tut = new Tutorial(this);   // ผู้เล่นใหม่: แนะนำ 4 ขั้น
    this.folk?.update(delta);
    for (const sh of this.shadows) sh.img.setPosition(sh.obj.x, sh.obj.y + 1).setVisible(sh.obj.visible && sh.obj.alpha > 0.2);
    for (const m of this.mobs) { if (this.econ.server) this.updateMobOnline(m, dt); else this.updateMobLocal(m, time); this.drawMob(m); }
    if (time > (this.nextDeclutter || 0)) { this.nextDeclutter = time + 200; this.declutterMobLabels(); }
    this.remotes.forEach((r) => r.update(dt));
    this.wb?.update();
    this.gd?.update(delta);
    this.weapons?.update(time);
    this.skills?.autoTick(time);
    this.social?.update(time);
    if (time > (this.tagAt || 0)) { this.tagAt = time + 500; this.refreshNameTag(); }
    this.updateBubbles(time);
    this.fadeTreesNear(dt);
    this.life?.update(time, dt);
    this.npcLife?.update(time, delta);
    this.autoPotion(time);
    // NPC หันมามองเมื่อเราเดินเข้าใกล้ (มีภาพ 8 ทิศ) · ห่างออกไปแล้วหันกลับหน้าตรง
    if (time > (this.npcLookAt || 0)) {
      this.npcLookAt = time + 250;
      for (const n of this.npcs || []) {
        const sp = n.spr; if (!sp?.d8id || n._walking) continue;
        const dx = p.x - sp.x, dy = p.y - sp.y, near = dx * dx + dy * dy < 95 * 95;
        const want = near ? dirFromVector(dx, dy, sp.dir || 'south') : 'south';
        if (want !== sp.dir) playDir(sp, 'idle', want);
      }
    }
    // ส่งตำแหน่ง ~10 ครั้ง/วิ
    if (this.net?.online && time - (this.sentAt || 0) > 100) {
      const st = { map: this.M.id, x: Math.round(p.x), y: Math.round(p.y), dir: p.dir, anim: p.alive ? (p.st === 'walk' ? 'walk' : p.st === 'attack' ? 'attack' : 'idle') : 'die' };
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
    const area = this.M.zoneAt(p.x, p.y);
    if (area !== this.area) {
      const was = this.area; this.area = area;
      const ZN = this.M.ZONES, Z = ZN[area] || ZN.outskirts || ZN.wild;
      if (was !== undefined && !(area === 'outskirts' && was === 'town') && !(area === 'town' && was === 'outskirts')) this.ui.banner(Z.nameTh, Z.sub);
      $('#zone-name').textContent = area === 'town' ? 'กรุงศรีอยุธยา' : this.M.realm ? this.M.nameTh : Z.nameTh;
      const ICON = { town: '🏯', outskirts: '🌳', field: '🌾', bamboo: '🎋', graveyard: '🪦', swamp: '🪷', hub: '⛺', wild: this.M.icon, lair: '👑' };
      this.eventsAt = 0;
      $('#td-zone').textContent = `${ICON[area] || ''} ${area === 'town' ? 'เกาะเมือง (Safe Zone)' : area === 'hub' ? `${Z.nameTh} (Safe Zone)` : `${Z.nameTh} · ${Z.sub.split(' · ')[0]}`}`;
    }
    this.checkPortals();
    if (time - (this.eventsAt || 0) > 500) { this.eventsAt = time; this.updateEventInfo(); }   // ช่วงเวลาอีเวนต์ใต้มินิแมพ
    if (zone !== this.zone) this.zone = zone;
    this.sfx.setMood({ lowHp: p.alive && p.char.hp / p.derived.maxHp < 0.25, boss: this.mobs.some((m) => m.def.boss && m.alive && dist(m, p) < 320) ? 1 : 0 });
    this.ui.updateHud();
    this.ui.updateSkillBar(time);
    this.ui.updateFrame(time);
    this.atmo.update(time, p, this.inTown());
    this.water.update(time);
    this.vfx.update(time, p, p.target, this.hovered);
    if (this.settings?.minimap !== false) this.minimap.update(time, this);         // ปิดมินิแมพ = ไม่ต้องวาด
    if (this.settings?.showFps && time - (this._fpsAt || 0) > 500) {                   // ตัวนับ FPS (ตั้งค่า)
      this._fpsAt = time; let el = document.getElementById('fps-meter');
      if (!el) { el = document.createElement('div'); el.id = 'fps-meter'; document.body.appendChild(el); }
      const f = Math.round(this.game.loop.actualFps); el.textContent = `${f} FPS · ${this.remotes.size + 1} คน`; el.className = f < 30 ? 'low' : '';
    } else if (!this.settings?.showFps && this._fpsAt) { this._fpsAt = 0; document.getElementById('fps-meter')?.remove(); }
  }

}
