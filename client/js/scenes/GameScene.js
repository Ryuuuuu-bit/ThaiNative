// ============================================================
//  GameScene – โลกเกม Side-scroller
//  หมู่บ้าน (NPC ร้านค้า) → ป่าผีดุ (มอนสเตอร์ 10 ชนิด) + ผู้เล่นออนไลน์
// ============================================================
import { WORLD, VIEW } from '/shared/constants.js';
import { MAPS, mapAt, REGIONS } from '/shared/data/maps.js';
import { World } from '../systems/World.js';
import { MONSTER_IDS, MONSTERS } from '/shared/data/monsters.js';
import { Player } from '../entities/Player.js';
import { Monster } from '../entities/Monster.js';
import { RemotePlayer } from '../entities/RemotePlayer.js';
import { RaidBoss } from '../entities/RaidBoss.js';
import { Social } from '../systems/Social.js';
import { Clock } from '../systems/Clock.js';
import { Shrine } from '../systems/Shrine.js';
import { Village, FISH_SPOT } from '../systems/Village.js';
import { Forest } from '../systems/Forest.js';
import { Combat } from '../systems/Combat.js';
import { UI } from '../systems/UI.js';
import { Network } from '../net/Network.js';
import { getDerived, saveCharacter } from '../systems/Character.js';
import { account } from '../net/Account.js';
import { useItem, count } from '../systems/Inventory.js';
import { makeText } from '../systems/util.js';
import { ITEMS } from '/shared/data/items.js';
import { sound } from '../systems/Sound.js';
import { SKILL_SLOTS } from '/shared/data/skills.js';
import { loadSettings } from '../systems/Settings.js';

const NPC_X = 720;
/** ชาวบ้าน (Map 1) – key = ภาพ, fb = ภาพสำรองถ้ายังไม่มี (ย้อมสีจากป้าติ๋มเดิม) */
const NPCS = [
  { id: 'shop',  key: 'npc_yai_tim',   x: NPC_X, nameTh: 'ยายติ๋ม', role: 'ร้านยา·ของใช้', color: '#82e0aa', tint: 0xd7bde2, flip: true },
  { id: 'quest', key: 'npc_lung_chai', x: 520,   nameTh: 'ผู้ใหญ่ชัย', role: 'เควส', color: '#f7dc6f', tint: 0xf0b27a },
  { id: 'smith', key: 'npc_lung_dam',  x: 846,   nameTh: 'ลุงดำ', role: 'ช่างตีเหล็ก', color: '#f5b041', tint: 0x7f8c8d, flip: true },
  { id: 'cook',  key: 'npc_pa_sa',     x: -300,  nameTh: 'ป้าสา', role: 'ครัว·รับซื้อปลา', color: '#85c1e9', tint: 0xf5cba7, flip: true },
];
const SPAWN_X = WORLD.spawnX;

export class GameScene extends Phaser.Scene {
  constructor() { super('game'); }

  create({ char }) {
    const W = WORLD;
    this.sfx = sound;
    this.settings = loadSettings();
    this.sfx.applySettings(this.settings);
    this.physics.world.setBounds(W.minX, -200, W.width - W.minX, W.height + 200);

    this.buildBackground();
    this.buildLevel();

    // ---------- ผู้เล่น ----------
    this.player = new Player(this, SPAWN_X, W.groundY - 2, char);
    this.physics.add.collider(this.player, this.solids);
    this.physics.add.collider(this.player, this.platforms, null, () => this.time.now > (this.player.dropUntil || 0));

    // ---------- มอนสเตอร์ (ชนิดละ 2 ตัว) ----------
    this.monsters = this.add.group();
    // gi = ลำดับผีทั้งเกม (server/mobs.js สร้างเรียงแบบเดียวกัน → อ้างถึงผีตัวเดียวกันได้)
    this.mobByGi = [];
    MONSTER_IDS.forEach((id) => { for (let i = 0; i < (MONSTERS[id].count ?? 2); i++) { const m = new Monster(this, id, this.mobByGi.length); this.mobByGi.push(m); this.monsters.add(m); } });
    // ---------- เรดบอส (server เป็นผู้คุม) ----------
    this.boss = new RaidBoss(this);
    this.monsters.add(this.boss);
    const notFlyer = (m) => !m.isFlyer;
    this.physics.add.collider(this.monsters, this.solids, null, notFlyer);
    this.physics.add.collider(this.monsters, this.platforms, null, notFlyer);

    // ---------- ระบบต่างๆ ----------
    this.combat = new Combat(this);
    this.combat.bind(this.player, this.monsters);
    this.ui = new UI(this);
    this.setupInput();
    this.setupNetwork(char);
    this.social = new Social(this);
    this.clock = new Clock(this);         // กลางวัน–กลางคืน
    this.shrine = new Shrine(this);       // เซียมซี + ศาลพระภูมิ
    this.village = new Village(this);     // ตกปลา · เควส · ครัว · ตีบวก
    this.forest = new Forest(this);       // Map 2: ค่ายพราน · สมุนไพร · หีบสมบัติ · ค่าหัว

    // ---------- กล้อง ----------
    const cam = this.cameras.main;
    cam.setZoom(VIEW.zoom);
    cam.startFollow(this.player, true, 0.12, 0.12, 0, 20);
    this.setMap(mapAt(this.player.x));

    // ---------- Event / Timer ----------
    this.events.on('player-died', () => {
      this.ui.showDeath(2500);
      // ตายในลานเรด → ฟื้นที่หน้าประตูลาน (ไม่ต้องเดินไกล)
      this.village.stop();
      this.forest.cancelGather();
      this.ui.closeAll();                           // ปิดหน้าต่างวาร์ป ฯลฯ ตอนตาย
      this.time.delayedCall(2500, () => {
        const rx = mapAt(this.player.x).respawnX;   // ฟื้นที่จุดพัก (กองไฟ) ของแมพที่อยู่ตอนนี้ (ตรงกับ server)
        this.player.respawn(rx, W.groundY - 2);
        this.net.send('player:warp', { kind: 'respawn' });
        this.setMap(mapAt(rx));
      });
    });
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.regenTick() });
    this.time.addEvent({ delay: 10000, loop: true, callback: () => saveCharacter(this.player.char) });
    // ปิดแท็บ/ซ่อนหน้า → เซฟขึ้น server ทันที (keepalive)
    this.saveNow = () => { saveCharacter(this.player.char); account.flush(); };
    window.addEventListener('beforeunload', this.saveNow);
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && this.saveNow());

    this.ui.updateHud();
    this.ui.toast(`ยินดีต้อนรับ ${char.name} สู่หมู่บ้านบางผี!`);
    if (char.migratedV2) {            // เซฟเก่า → ระบบสายหลักใหม่: แจ้งครั้งเดียว
      delete char.migratedV2;
      this.time.delayedCall(1200, () => {
        this.ui.banner('ระบบใหม่: ตัวละครแบบเดียว + สายหลัก');
        this.ui.toast('อาชีพเดิมกลายเป็นสายหลักแล้ว · คืนแต้มสถานะให้ลงใหม่ (กด C) · แนวต่อสู้เปลี่ยนตามอาวุธที่ถือ · แถมน้ำมนต์ล้างแต้ม 1 ขวด', '', 9000);
      });
      this.saveSoon();
    } else if (!char.path && char.level === 1 && !Object.keys(char.skills).length) {
      this.time.delayedCall(1500, () => this.ui.toast('กด K เรียนสกิลแรก · ในกระเป๋ามีอาวุธฝึกครบ ลองถือแต่ละแบบดู (I)', '', 7000));
    }
  }

  // ------------------------------------------------------------
  //  ฉากหลัง Parallax (ใช้ scrollFactor 0 + เลื่อน tilePosition เอง)
  // ------------------------------------------------------------
  buildBackground() {
    // กล้องซูม x2 รอบจุดกลางจอ (480,270) → วางชั้นฉากหลังที่จุดกลางให้เต็มจอพอดี
    this.add.image(480, 270, 'bg_sky').setScrollFactor(0).setDepth(-10);
    this.bgFar = this.add.tileSprite(480, 282, 480, 140, 'bg_far').setScrollFactor(0).setDepth(-9);
    this.bgMid = this.add.tileSprite(480, 311, 480, 120, 'bg_mid').setScrollFactor(0).setDepth(-8);
    // เส้นขอบฟ้าเมือง (เจดีย์/หลังคาวัด/มะพร้าว) – เห็นชัดในหมู่บ้าน แล้วจางลงเมื่อเข้าป่า
    if (this.textures.exists('bg_town')) {
      const src = this.textures.get('bg_town').getSourceImage();
      this.bgTown = this.add.tileSprite(480, 368 - src.height / 2, 480, src.height, 'bg_town').setScrollFactor(0).setDepth(-8.5).setAlpha(0.85);
    }
  }

  // ------------------------------------------------------------
  //  ด่าน: พื้น, แพลตฟอร์ม, หมู่บ้าน, NPC
  // ------------------------------------------------------------
  buildLevel() {
    const W = WORLD;
    this.solids = this.physics.add.staticGroup();
    const ground = this.add.tileSprite(W.minX, W.groundY, W.width - W.minX, 16, 'tile_ground').setOrigin(0).setDepth(5);
    this.add.tileSprite(W.minX, W.groundY + 16, W.width - W.minX, 40, 'tile_dirt').setOrigin(0).setDepth(5);
    this.physics.add.existing(ground, true);
    this.solids.add(ground);

    // แพลตฟอร์มไม้ (กระโดดทะลุขึ้นจากด้านล่างได้ – One-way)
    this.platforms = this.physics.add.staticGroup();
    // 20 แมพล่าผี: พื้นตามภาค · แพลตฟอร์ม · ของตกแต่ง · ประตูวาร์ป · ฉากหลังภาค
    this.world = new World(this);
    this.world.build();

    // ---------------- หมู่บ้านบางผี (0 – townEndX) ----------------
    const gy = W.groundY;
    // สิ่งปลูกสร้าง: ฝังฐานลงดินเล็กน้อย (พื้นหญ้าบังขอบล่าง) + เงาสัมผัสพื้น → ไม่ดูลอย
    const img = (key, x, depth = 1, opts = {}) => {
      if (!this.textures.exists(key)) return null;
      const sink = opts.sink ?? 5;
      const o = this.add.image(x, gy + sink + (opts.dy || 0), key).setOrigin(0.5, 1).setDepth(depth);
      if (opts.flip) o.setFlipX(true);
      if (opts.scale) o.setScale(opts.scale);
      if (opts.tint) o.setTint(opts.tint);
      if (opts.shadow !== false) {
        const w = o.displayWidth * (opts.shadowW ?? 0.9);
        this.add.ellipse(x, gy + 1, w, 7, 0x000000, 0.32).setDepth(5.5);
        this.add.ellipse(x, gy + 1, w * 0.7, 4, 0x000000, 0.25).setDepth(5.5);
      }
      return o;
    };
    const label = (x, y, text, color = '#f7dc6f', size = '6px') => makeText(this, x, y, text, { fontSize: size, color }).setOrigin(0.5).setDepth(2);
    // วัด (ด้านหลังจุดเกิด)
    const wat = img('temple', 110, 0);
    if (wat) label(110, gy - wat.height - 4, 'วัดบางผี');
    this.shrineSprite = img('spirit_house', 240, 2, { sink: 3, shadowW: 0.7 });
    this.shrineX = 240; this.shrineY = gy - (this.shrineSprite?.height || 48) + 6;
    label(240, gy - (this.textures.get('spirit_house').getSourceImage().height || 48) - 4, 'ศาลพระภูมิ');
    img('palm', 300, 0, { shadowW: 0.4 }); img('palm', 640, 0, { flip: true, shadowW: 0.4 });
    const h1 = img('house', 420, 1);
    if (h1) label(420, gy - h1.height - 4, 'เรือนไทย', '#e5c07b');
    const sala = img('sala', 560, 1);
    if (sala) label(560, gy - sala.height - 4, 'ศาลาประชาคม (จุดนัดปาร์ตี้)', '#aed6f1');
    img('stall', NPC_X + 24, 1);
    // โรงตีเหล็กลุงดำ (ภาพยังไม่มา → ใช้เรือนไทยหลังเล็กแทน)
    if (!img('forge', 880, 1)) img('house', 880, 1, { flip: true, scale: 0.85 });
    this.anvilGlow = this.add.circle(880, gy - 14, 10, 0xff7b24, 0).setDepth(2).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: this.anvilGlow, alpha: { from: 0.15, to: 0.35 }, duration: 500, yoyo: true, repeat: -1 });
    [-420, -160, 200, 340, 500, 680, 800, 940].forEach((x) => this.add.image(x, gy, 'lantern').setOrigin(0.5, 1).setDepth(2));
    this.buildRiver(img, label);

    // ชาวบ้าน NPC
    this.npcs = NPCS.map((n) => {
      const real = this.textures.exists(n.key);
      const spr = this.add.sprite(n.x, gy, real ? n.key : 'npc_maekha', 'idle_0').setOrigin(0.5, 1).setDepth(6).setFlipX(!!n.flip);
      if (!real) spr.setTint(n.tint);
      spr.play(`${real ? n.key : 'npc_maekha'}:idle`);
      const tag = makeText(this, n.x, gy - spr.height - 4, `${n.nameTh}`, { fontSize: '8px', color: n.color }).setOrigin(0.5, 1).setDepth(6);
      const role = makeText(this, n.x, gy - spr.height - 17, `[${n.role}]`, { fontSize: '6px', color: '#ecf0f1' }).setOrigin(0.5, 1).setDepth(6);
      // เครื่องหมายเควส (!) เหนือหัวผู้ใหญ่ชัย
      const mark = n.id === 'quest' ? makeText(this, n.x, gy - spr.height - 30, '!', { fontSize: '12px', color: '#f1c40f' }).setOrigin(0.5, 1).setDepth(6) : null;
      if (mark) this.tweens.add({ targets: mark, y: mark.y - 3, duration: 500, yoyo: true, repeat: -1 });
      return { ...n, spr, tag, role, mark };
    });
    this.npc = this.npcs[0].spr;                 // ยายติ๋ม (ใช้กับอีเวนต์ผีห่า: ร้านปิด)
    this.npcLabel = { setVisible: (v) => { this.npcs[0].tag.setVisible(v); this.npcs[0].role.setVisible(v); } };

    // ---------------- ลานพญายักษ์ (เรดบอส) ----------------
    const ax = W.arenaX;
    this.add.image(ax - 30, gy, 'sign').setOrigin(0.5, 1).setDepth(2);
    label(ax - 30, gy - 38, '👹 ลานพญายักษ์ (เรดบอส)', '#ff8a80', '7px');
    // เสาหินโบราณ + คบไฟ ขอบลาน
    for (const x of [ax + 10, ax + 250, ax + 520, W.width - 20]) {
      this.add.rectangle(x, gy, 10, 64, 0x4a3b52).setOrigin(0.5, 1).setDepth(1);
      this.add.rectangle(x, gy - 64, 16, 6, 0x6c5a73).setOrigin(0.5, 1).setDepth(1);
      const fire = this.add.circle(x, gy - 74, 4, 0xf39c12, 0.9).setDepth(2);
      this.tweens.add({ targets: fire, scale: { from: 0.8, to: 1.3 }, alpha: { from: 0.7, to: 1 }, duration: 260 + Math.random() * 200, yoyo: true, repeat: -1 });
    }
    this.add.rectangle(ax, gy, W.width - ax, 3, 0x6e2c2c, 0.6).setOrigin(0, 0).setDepth(6);   // พื้นลานสีเลือดหมู
    this.arenaFog = this.add.rectangle(ax, 0, W.width - ax, W.height, 0x4a235a, 0.12).setOrigin(0).setDepth(-1);

  }

  // ------------------------------------------------------------
  //  Input
  // ------------------------------------------------------------
  // ปุ่มควบคุม: ← → เดิน | ↑ กระโดด | Space โจมตีปกติ | Q W E R สกิล
  //            F / ↓ คุย NPC | C สถานะ | I กระเป๋า | 1 2 ยา | M เปิด/ปิดเสียง | Enter แชท
  setupInput() {
    const kb = this.input.keyboard;
    this.keys = kb.addKeys('LEFT,RIGHT,UP,DOWN,SPACE,Q,W,E,R,T,F,C,I,H,J,K,M,P,ONE,TWO,ENTER,ESC');

    // F = คุยกับ NPC / เปิดร้านค้า
    kb.on('keydown-F', () => this.interact());
    kb.on('keydown-SPACE', () => this.village.fishing && this.village.press());
    kb.on('keydown-J', () => this.village.openQuests());      // สมุดเควส
    // ↓ = ลงจากแพลตฟอร์มไม้ (ทะลุลงไป 0.3 วิ)
    kb.on('keydown-DOWN', () => { if (this.player.body.blocked.down || this.player.body.touching.down) this.player.dropUntil = this.time.now + 300; });
    kb.on('keydown-M', () => this.ui.toggle('map-panel'));     // แผนที่โลก
    kb.on('keydown-K', () => this.ui.toggle('skill-panel'));   // Skill Tree
    kb.on('keydown-P', () => { this.ui.toggle('social-panel'); this.social.renderSocialPanel(); });   // ปาร์ตี้ / ผู้เล่น
    kb.on('keydown-C', () => this.ui.toggle('stats-panel'));
    kb.on('keydown-I', () => this.ui.toggle('inv-panel'));
    kb.on('keydown-H', () => this.ui.toggle('help-panel'));
    // ESC = ปิดหน้าต่างที่เปิดอยู่ ถ้าไม่มีหน้าต่างเปิด → เปิดตั้งค่า
    kb.on('keydown-ESC', () => (this.ui.anyOpen() ? this.ui.closeAll() : this.ui.toggle('settings-panel', true)));
    kb.on('keydown-ENTER', () => this.ui.focusChat());
    kb.on('keydown-ONE', () => this.quickUse(['hp_s', 'hp_m']));
    kb.on('keydown-TWO', () => this.quickUse(['mp_s', 'mp_m']));
  }


  readInput() {
    const k = this.keys, JD = Phaser.Input.Keyboard.JustDown;
    const jump = JD(k.UP);
    if (jump && this.player.body.blocked.down && this.player.alive) this.sfx.play('jump');
    return {
      left: k.LEFT.isDown,
      right: k.RIGHT.isDown,
      jump,
      attack: k.SPACE.isDown,                         // กดค้างเพื่อตีต่อเนื่อง
      skill: SKILL_SLOTS.find((key) => k[key].isDown) || null,   // Hotbar Q W E R T
    };
  }

  quickUse(ids) {
    const c = this.player.char;
    const id = ids.find((i) => count(c, i) > 0);
    if (!id) return this.ui.toast('ไม่มียาเหลือแล้ว', 'warn');
    const r = useItem(c, id);
    if (r.ok) this.sfx.play('potion');
    this.ui.result(r);
  }

  nearNpc() { return Math.abs(this.player.x - NPC_X) < 40 && this.player.alive; }

  /** จุดที่กด F ได้: ร้านป้าติ๋ม / วัด (เซียมซี) / ศาลพระภูมิ */
  interactable() {
    if (!this.player.alive) return null;
    const x = this.player.x;
    if (this.village.fishing) return null;
    const spots = [
      ...this.npcs.map((n) => ({ x: n.x, r: 34, id: n.id, prompt: `กด F เพื่อคุยกับ${n.nameTh}` })),
      { x: 240, r: 34, id: 'shrine', prompt: 'กด F เพื่อถวายของที่ศาลพระภูมิ' },
      { x: 110, r: 80, id: 'siamsi', prompt: 'กด F เพื่อเสี่ยงเซียมซี (วัดบางผี)' },
      ...this.map.gates.map((g, i) => ({ x: g.x, r: 30, id: 'warp', prompt: this.map.id !== 'village' && i === 1 ? 'กด F เพื่อไปแมพถัดไป →' : 'กด F เพื่อเลือกจุดวาร์ป' })),
      { x: this.forest.npcX, r: 34, id: 'bounty', prompt: 'กด F เพื่อคุยกับพรานบุญ (ค่าหัวรายวัน)' },
    ];
    if (this.forest.gather) return null;
    const herb = this.forest.nodeAt(x, this.player.y);
    if (herb) spots.push({ x, r: 1, id: 'herb', herb, prompt: `🌿 กด F เพื่อเก็บ ${ITEMS[herb.item].nameTh}` });
    const ch = this.forest.chest;
    if (ch && Math.abs(ch.x - x) < 24 && Math.abs(ch.y - this.player.y) < 30) spots.push({ x, r: 1, id: 'chest', prompt: '🎁 กด F เพื่อเปิดหีบสมบัติโบราณ' });
    if (this.village.canFish(x)) spots.push({ x, r: 1, id: 'fish', prompt: '🎣 กด F เพื่อตกปลา' });
    return spots.filter((s) => Math.abs(x - s.x) < s.r).sort((a, b) => Math.abs(x - a.x) - Math.abs(x - b.x))[0] || null;
  }

  interact() {
    if (this.village.fishing) return this.village.press();
    const spot = this.interactable();
    if (!spot) return;
    this.sfx.play('click');
    if (spot.id === 'shop') {
      this.ui.openShop('mae_kha');
    } else if (spot.id === 'smith') this.ui.openShop('lung_dam');
    else if (spot.id === 'cook') this.ui.openShop('pa_sa');
    else if (spot.id === 'quest') this.village.openQuests();
    else if (spot.id === 'fish') this.village.startFishing();
    else if (spot.id === 'warp') this.world.useGate();
    else if (spot.id === 'bounty') this.forest.openBounty();
    else if (spot.id === 'herb') this.forest.startGather(spot.herb);
    else if (spot.id === 'chest') this.forest.openChest();
    else if (spot.id === 'shrine') this.shrine.openShrine();
    else if (spot.id === 'siamsi') this.shrine.openSiamsi();
  }

  // ------------------------------------------------------------
  //  แผนที่ & ประตูวาร์ป
  // ------------------------------------------------------------
  setMap(map) {
    const prev = this.map;
    this.map = map;
    this.cameras.main.setBounds(map.minX, 0, map.maxX - map.minX, WORLD.height);
    this.world?.setRegion(map);
    this.ui?.refreshMinimap?.();
    // ซ่อนผีของแมพอื่น (ไม่ต้องอัปเดต/วาด)
    this.monsters?.getChildren().forEach((m) => {
      if (m.isBoss || !m.def?.mapId) return;
      m.setOnMap(m.def.mapId === map.id);          // ผีแมพอื่น: หยุด/ซ่อน (ไม่ลอยทะลุไปแมพอื่น) · ป้ายชื่อไม่ค้างจอ
    });
    if (prev && prev !== map && this.ui) {
      const R = REGIONS[map.region];
      if (R && prev.region !== map.region) this.ui.toast(`เข้าสู่ภาค ${R.no}: ${R.nameTh}`);
    }
  }

  /** ท่าน้ำตกปลา (ซ้ายสุดของหมู่บ้าน): แม่น้ำ + สะพานไม้ + เรือ + ครัวป้าสา */
  buildRiver(img, label) {
    const W = WORLD, gy = W.groundY, x0 = W.minX, x1 = FISH_SPOT.to + 12;
    // แม่น้ำ (บังพื้นดินช่วงท่าน้ำ)
    const water = this.add.tileSprite(x0, gy + 3, x1 - x0 + 10, 60, 'tile_dirt').setOrigin(0).setDepth(5.2).setTint(0x2e86c1).setAlpha(0.95);
    this.add.rectangle(x0, gy + 3, x1 - x0 + 10, 60, 0x1f618d, 0.75).setOrigin(0).setDepth(5.3);
    this.waterShine = this.add.graphics().setDepth(5.4);
    this.riverX = [x0, x1];
    // ตลิ่ง
    this.add.rectangle(x1 + 8, gy + 3, 8, 30, 0x6e4b2a).setOrigin(0.5, 0).setDepth(5.5);
    // สะพานไม้ (ผู้เล่นยืนบนนี้)
    const deck = this.add.tileSprite(x0, gy - 1, x1 - x0 + 14, 5, 'tile_plank').setOrigin(0).setDepth(5.6);
    for (let x = x0 + 10; x < x1; x += 40) this.add.rectangle(x, gy + 4, 3, 22, 0x4a2f1a).setOrigin(0.5, 0).setDepth(5.35);
    this.add.rectangle(x0 + 2, gy - 12, 2, 12, 0x5d4037).setOrigin(0.5, 0).setDepth(5.6);   // หลักผูกเรือ
    const boat = this.textures.exists('boat') ? this.add.image(x0 + 120, gy + 3, 'boat').setOrigin(0.5, 1).setDepth(0.45).setScale(0.75) : null;   // เรือจอดบนผืนน้ำด้านหลัง
    if (boat) this.tweens.add({ targets: boat, y: boat.y + 1.5, angle: 1.2, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // ผืนน้ำด้านหลังสะพาน: แถบแคบติดพื้น + ตลิ่งหญ้าฝั่งตรงข้าม + ตลิ่งลาดทางขวา (ไม่ยื่นเป็นก้อนลอย)
    const far = this.add.graphics().setDepth(0.4);
    const top = gy - 12;
    far.fillStyle(0x2874a6, 1).fillRect(x0, top, x1 - x0, gy - top + 4);
    far.fillStyle(0x3b8d5a, 1).fillRect(x0, top - 2, x1 - x0, 2);                               // ตลิ่งฝั่งตรงข้าม
    for (let x = x0 + 4; x < x1 - 4; x += 9) far.fillStyle(0x2e7d4f, 1).fillRect(x, top - 5 - (x % 3), 1, 4 + (x % 3));   // กกริมน้ำ
    far.fillStyle(0x6e4b2a, 1).fillTriangle(x1 - 2, gy + 4, x1 + 26, gy + 4, x1 - 2, top - 2);  // ตลิ่งลาด (ดิน)
    far.fillStyle(0x3b8d5a, 1).fillTriangle(x1 - 2, top - 2, x1 + 4, top - 2, x1 + 26, gy + 1);
    this.farShine = this.add.graphics().setDepth(0.43);
    // ครัวป้าสา
    if (!img('food_stall', -262, 1)) img('stall', -262, 1, { tint: 0xf5cba7 });
    // ต้นมะพร้าวริมน้ำ
    img('palm', -460, 0, { shadowW: 0.4 }); img('palm', -120, 0, { flip: true, shadowW: 0.4 });
  }

  // ------------------------------------------------------------
  //  Online (Socket.io)
  // ------------------------------------------------------------
  setupNetwork(char) {
    this.remotes = new Map();
    const net = (this.net = new Network());
    const addRemote = (p) => { if (!this.remotes.has(p.id)) this.remotes.set(p.id, new RemotePlayer(this, p)); };

    net.on('status', (on) => this.ui.setOnline(on, this.remotes.size))
      .on('init', ({ players, serverTime, dayMs }) => { players.forEach(addRemote); this.ui.setOnline(true, this.remotes.size); if (serverTime) this.clock?.sync(serverTime, dayMs); })
      .on('joined', (p) => { addRemote(p); this.ui.chat({ name: '📢 ระบบ', text: `${p.name} เข้าสู่โลก` }); this.ui.setOnline(true, this.remotes.size); })
      .on('left', (id) => { this.remotes.get(id)?.destroy(); this.remotes.delete(id); this.ui.setOnline(true, this.remotes.size); })
      .on('snapshot', ({ t, players, boss }) => {
        players.forEach((p) => this.remotes.get(p.id)?.pushState(p));
        this.boss.setServer(boss);
        if (t) this.clock?.sync(t);
      })
      .on('mob:state', ({ l }) => { const t = this.time.now; for (const a of l) this.mobByGi[a[0]]?.applyServer(a, t); })
      .on('mob:die', ({ gi, killer, assist }) => {
        const m = this.mobByGi[gi];
        if (!m || m.state === 'dead') { if (m && killer === this.net.selfId) this.combat.onMonsterKilled(m); return; }
        if (killer === this.net.selfId) this.combat.onMonsterKilled(m);                 // ตีจบ: EXP + เงิน + ของดรอป
        else if (assist?.includes(this.net.selfId)) this.combat.onAssist(m);            // ช่วยตี: ได้ EXP
        m.dieVisual(true);
      })
      .on('appearance', ({ id, appearance }) => this.remotes.get(id)?.setAppearance(appearance))
      .on('chat', (m) => this.ui.chat(m))
      .on('skill', (d) => this.combat.remoteVfx(d, this.remotes.get(d.id)));   // สกิลของผู้เล่นอื่น

    net.connect(char.name, () => ({ appearance: this.player.char.appearance, x: Math.round(this.player.x), y: Math.round(this.player.y) }));
  }

  onAppearanceChanged() {
    this.player.refreshAppearance();
    this.net.sendAppearance(this.player.char.appearance);
  }

  // ------------------------------------------------------------
  regenTick() {
    const p = this.player;
    if (!p.alive) return;
    const c = p.char, d = getDerived(c);
    c.mp = Math.min(d.maxMp, c.mp + 1 + d.maxMp * 0.02);
    if (p.x < WORLD.townEndX || this.forest.nearFire(p.x)) {        // ในหมู่บ้าน / ข้างกองไฟค่ายพราน ฟื้นเร็ว
      c.hp = Math.min(d.maxHp, c.hp + d.maxHp * 0.05);
      c.mp = Math.min(d.maxMp, c.mp + d.maxMp * 0.04);
    }
  }

  saveSoon() {
    clearTimeout(this._saveT);
    this._saveT = setTimeout(() => saveCharacter(this.player.char), 800);
  }

  update(time) {
    const idle = { left: false, right: false, jump: false, attack: false, skill: null };
    const stunned = time < (this.player.stunUntil || 0);          // โดนบอสคำราม → มึนงง
    const fishing = this.village.fishing;
    const input = this.ui.typing || stunned || this.warping ? idle : this.readInput();
    if (fishing && (input.left || input.right || input.jump)) this.village.stop('เลิกตกปลา');
    if (this.forest.gather && (input.left || input.right || input.jump)) this.forest.cancelGather('หยุดเก็บสมุนไพร');
    if (fishing) { input.attack = false; input.skill = null; }
    this.player.update(time, input);
    // เดินข้ามแผนที่ไม่ได้ ต้องใช้ประตูวาร์ป
    let mp = this.map;
    if (this.player.x < mp.minX - 150 || this.player.x > mp.maxX + 150) { this.setMap(mapAt(this.player.x)); mp = this.map; }  // ถูกย้ายตำแหน่ง (ฟื้น/วาร์ป)
    if (this.player.x < mp.minX + 8) { this.player.x = mp.minX + 8; this.player.setVelocityX(0); }
    if (this.player.x > mp.maxX - 8) { this.player.x = mp.maxX - 8; this.player.setVelocityX(0); }
    this.monsters.getChildren().forEach((m) => { if (m.active || m.isBoss) m.update(time, this.player); });
    this.combat.update();
    this.remotes.forEach((r) => r.update());
    this.net.sendState(time, this.player.netState());

    const cam = this.cameras.main;
    this.bgFar.tilePositionX = cam.scrollX * 0.15;
    this.bgMid.tilePositionX = cam.scrollX * 0.35;
    this.world.update(cam);
    if (this.bgTown) {
      this.bgTown.tilePositionX = cam.scrollX * 0.25;
      this.bgTown.setAlpha(Phaser.Math.Clamp(1 - (cam.scrollX - (WORLD.townEndX - 200)) / 500, 0, 0.85));
    }
    this.social.update(time, this.game.loop.delta / 1000);
    this.footsteps(time);

    this.clock.tick();
    this.village.update(time, this.game.loop.delta / 1000);
    this.forest.update(time);
    this.animateWater(time);
    const spot = this.interactable();
    this.ui.prompt(spot ? spot.prompt : '');
    this.ui.updateHud();
    this.ui.updateSkillBar(time);
    this.ui.updateFrame(time);
    const px = this.player.x;
    const zone = mp.id === 'village' ? (px < FISH_SPOT.to + 40 ? 'ท่าน้ำบางผี' : 'หมู่บ้านบางผี')
      : mp.boss ? 'ลานพญายักษ์' : `${mp.no}. ${mp.nameTh}`;
    if (zone !== this.zone) { this.ui.setZone(zone, !!this.zone); this.zone = zone; }
    const night = this.clock.light < 0.35;
    this.sfx.music(
      mp.boss && this.boss.alive ? 'boss'
        : mp.id === 'village' ? (night ? 'townNight' : 'town')
        : REGIONS[mp.region]?.music || 'wild');
  }

  /** ประกายน้ำในแม่น้ำ */
  animateWater(time) {
    if (!this.waterShine || time - (this.waterAt || 0) < 90) return;
    this.waterAt = time;
    const [x0, x1] = this.riverX, gy = WORLD.groundY, g = this.waterShine.clear();
    g.fillStyle(0xaed6f1, 0.55);
    const fg = this.farShine.clear().fillStyle(0xaed6f1, 0.45);
    for (let i = 0; i < 14; i++) {                                   // ประกายน้ำฝั่งไกล
      const x = x0 + ((i * 71 + time * 0.008 * (1 + (i % 2))) % (x1 - x0 - 10));
      fg.fillRect(x, gy - 10 + ((i * 11) % 9), 3 + (i % 3) * 2, 1);
    }
    for (let i = 0; i < 18; i++) {
      const x = x0 + ((i * 53 + time * 0.012 * (1 + (i % 3))) % (x1 - x0));
      const y = gy + 8 + ((i * 17) % 40);
      g.fillRect(x, y, 4 + (i % 3) * 2, 1);
    }
  }

  /** เสียงฝีเท้า + เสียงลงพื้น */
  footsteps(time) {
    const p = this.player;
    const onFloor = p.body.blocked.down || p.body.touching.down;
    if (onFloor && !this.wasOnFloor && p.body.velocity.y >= 0 && this.airSince && time - this.airSince > 250) { this.sfx.play('land'); this.combat.dust(p.x, p.y, 7, 1.6); }
    if (!onFloor && this.wasOnFloor) this.airSince = time;
    this.wasOnFloor = onFloor;
    if (onFloor && p.state === 'walk' && time - (this.lastStep || 0) > 300) { this.lastStep = time; this.sfx.play('step'); }
  }
}
