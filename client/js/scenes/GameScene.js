// ============================================================
//  GameScene – โลกเกม Side-scroller
//  หมู่บ้าน (NPC ร้านค้า) → ป่าผีดุ (มอนสเตอร์ 10 ชนิด) + ผู้เล่นออนไลน์
// ============================================================
import { WORLD, VIEW } from '/shared/constants.js';
import { MONSTER_IDS, MONSTERS } from '/shared/data/monsters.js';
import { Player } from '../entities/Player.js';
import { Monster } from '../entities/Monster.js';
import { RemotePlayer } from '../entities/RemotePlayer.js';
import { RaidBoss } from '../entities/RaidBoss.js';
import { Social } from '../systems/Social.js';
import { Clock } from '../systems/Clock.js';
import { Shrine } from '../systems/Shrine.js';
import { Invasion } from '../systems/Invasion.js';
import { Combat } from '../systems/Combat.js';
import { UI } from '../systems/UI.js';
import { Network } from '../net/Network.js';
import { getDerived, saveCharacter } from '../systems/Character.js';
import { useItem, count } from '../systems/Inventory.js';
import { makeText } from '../systems/util.js';
import { sound } from '../systems/Sound.js';
import { SKILL_SLOTS } from '/shared/data/skills.js';
import { loadSettings } from '../systems/Settings.js';

const NPC_X = 720;
const SPAWN_X = WORLD.spawnX;
const PLATFORMS = [
  [1170, 190, 64], [1340, 162, 80], [1720, 186, 64], [1900, 158, 48], [2080, 172, 96],
  [2420, 150, 64], [2630, 190, 80], [2980, 166, 96], [3260, 186, 64],
  // ป่าช้าผีตายโหง
  [3760, 176, 80], [3980, 150, 64], [4200, 184, 96], [4460, 160, 64], [4700, 182, 80],
];

export class GameScene extends Phaser.Scene {
  constructor() { super('game'); }

  create({ char }) {
    const W = WORLD;
    this.sfx = sound;
    this.settings = loadSettings();
    this.sfx.applySettings(this.settings);
    this.physics.world.setBounds(0, -200, W.width, W.height + 200);

    this.buildBackground();
    this.buildLevel();

    // ---------- ผู้เล่น ----------
    this.player = new Player(this, SPAWN_X, W.groundY - 2, char);
    this.physics.add.collider(this.player, this.solids);
    this.physics.add.collider(this.player, this.platforms, null, () => this.time.now > (this.player.dropUntil || 0));

    // ---------- มอนสเตอร์ (ชนิดละ 2 ตัว) ----------
    this.monsters = this.add.group();
    MONSTER_IDS.forEach((id) => { for (let i = 0; i < (MONSTERS[id].count ?? 2); i++) this.monsters.add(new Monster(this, id)); });
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
    this.invasion = new Invasion(this);   // อีเวนต์ผีห่าบุก

    // ---------- กล้อง ----------
    const cam = this.cameras.main;
    cam.setZoom(VIEW.zoom);
    cam.setBounds(0, 0, W.width, W.height);
    cam.startFollow(this.player, true, 0.12, 0.12, 0, 20);

    // ---------- Event / Timer ----------
    this.events.on('player-died', () => {
      this.ui.showDeath(2500);
      // ตายในลานเรด → ฟื้นที่หน้าประตูลาน (ไม่ต้องเดินไกล)
      const rx = this.player.x > W.arenaX - 200 ? W.arenaX - 140 : SPAWN_X;
      this.time.delayedCall(2500, () => this.player.respawn(rx, W.groundY - 2));
    });
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.regenTick() });
    this.time.addEvent({ delay: 10000, loop: true, callback: () => saveCharacter(this.player.char) });
    window.addEventListener('beforeunload', () => saveCharacter(this.player.char));

    this.ui.updateHud();
    this.ui.toast(`ยินดีต้อนรับ ${char.name} สู่หมู่บ้านบางผี!`);
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
    const ground = this.add.tileSprite(0, W.groundY, W.width, 16, 'tile_ground').setOrigin(0).setDepth(5);
    this.add.tileSprite(0, W.groundY + 16, W.width, 40, 'tile_dirt').setOrigin(0).setDepth(5);
    this.physics.add.existing(ground, true);
    this.solids.add(ground);

    // แพลตฟอร์มไม้ (กระโดดทะลุขึ้นจากด้านล่างได้ – One-way)
    this.platforms = this.physics.add.staticGroup();
    for (const [x, y, w] of PLATFORMS) {
      const p = this.add.tileSprite(x, y, w, 8, 'tile_plank').setOrigin(0).setDepth(4);
      this.physics.add.existing(p, true);
      p.body.checkCollision.down = p.body.checkCollision.left = p.body.checkCollision.right = false;
      this.platforms.add(p);
      this.add.rectangle(x + 4, y + 8, 2, W.groundY - y - 8, 0x3e2410).setOrigin(0).setDepth(3);     // เสาค้ำ
      this.add.rectangle(x + w - 6, y + 8, 2, W.groundY - y - 8, 0x3e2410).setOrigin(0).setDepth(3);
    }

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
    img('palm', 300, 0, { shadowW: 0.4 }); img('palm', 640, 0, { flip: true, shadowW: 0.4 }); img('palm', 965, 0, { shadowW: 0.4 });
    const h1 = img('house', 420, 1);
    if (h1) label(420, gy - h1.height - 4, 'เรือนไทย', '#e5c07b');
    const sala = img('sala', 560, 1);
    if (sala) label(560, gy - sala.height - 4, 'ศาลาประชาคม (จุดนัดปาร์ตี้)', '#aed6f1');
    img('stall', NPC_X + 24, 1);
    img('house', 880, 1, { flip: true, scale: 0.85 });
    [200, 340, 500, 680, 800, 940].forEach((x) => this.add.image(x, gy, 'lantern').setOrigin(0.5, 1).setDepth(2));
    this.add.image(W.townEndX + 20, gy, 'sign').setOrigin(0.5, 1).setDepth(2);
    label(W.townEndX + 20, gy - 38, '⚠ เขตผีดุ', '#ff7675', '7px');

    // NPC ร้านค้า
    this.npc = this.add.sprite(NPC_X, gy, 'npc_maekha', 'idle_0').setOrigin(0.5, 1).setDepth(6);
    this.npc.play('npc_maekha:idle');
    this.npcLabel = makeText(this, NPC_X, gy - 56, 'ป้าติ๋ม [ร้านค้า]', { fontSize: '7px', color: '#82e0aa' }).setOrigin(0.5).setDepth(6);

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

    // ---------------- ป่าช้าผีตายโหง ----------------
    const gx = W.graveX;
    this.add.image(gx - 20, gy, 'sign').setOrigin(0.5, 1).setDepth(2);
    label(gx - 20, gy - 38, '⚰️ ป่าช้าผีตายโหง Lv.11+', '#c39bd3', '7px');
    this.add.rectangle(gx, 0, ax - gx, W.height, 0x1b2631, 0.14).setOrigin(0).setDepth(-1);   // หมอกป่าช้า
    const g = this.add.graphics().setDepth(1);
    for (let x = gx + 40; x < ax - 40; x += 70 + ((x * 37) % 50)) {
      const k = (x * 13) % 3;
      if (k === 0) {                                     // ป้ายหลุมศพ
        g.fillStyle(0x7f8c8d, 1).fillRect(x - 5, gy - 14, 10, 14).fillCircle(x, gy - 14, 5);
        g.fillStyle(0x566573, 1).fillRect(x - 3, gy - 12, 6, 1).fillRect(x - 3, gy - 9, 6, 1);
      } else if (k === 1) {                              // ต้นไม้ตาย
        g.fillStyle(0x3b2f2f, 1).fillRect(x - 2, gy - 34, 4, 34).fillRect(x - 10, gy - 28, 10, 2).fillRect(x + 2, gy - 22, 9, 2).fillRect(x - 8, gy - 34, 2, 7);
      } else {                                           // เจดีย์เก็บกระดูก
        g.fillStyle(0xbfc9ca, 1).fillRect(x - 7, gy - 10, 14, 10).fillTriangle(x - 7, gy - 10, x + 7, gy - 10, x, gy - 30);
        g.fillStyle(0xd4ac0d, 1).fillRect(x - 1, gy - 34, 2, 5);
      }
    }
  }

  // ------------------------------------------------------------
  //  Input
  // ------------------------------------------------------------
  // ปุ่มควบคุม: ← → เดิน | ↑ กระโดด | Space โจมตีปกติ | Q W E R สกิล
  //            F / ↓ คุย NPC | C สถานะ | I กระเป๋า | 1 2 ยา | M เปิด/ปิดเสียง | Enter แชท
  setupInput() {
    const kb = this.input.keyboard;
    this.keys = kb.addKeys('LEFT,RIGHT,UP,DOWN,SPACE,Q,W,E,R,T,F,C,I,H,K,M,P,ONE,TWO,ENTER,ESC');

    // F = คุยกับ NPC / เปิดร้านค้า
    kb.on('keydown-F', () => this.interact());
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
    const spots = [
      { x: NPC_X, r: 40, id: 'shop', prompt: 'กด F เพื่อคุยกับป้าติ๋ม' },
      { x: 240, r: 34, id: 'shrine', prompt: 'กด F เพื่อถวายของที่ศาลพระภูมิ' },
      { x: 110, r: 80, id: 'siamsi', prompt: 'กด F เพื่อเสี่ยงเซียมซี (วัดบางผี)' },
    ];
    return spots.filter((s) => Math.abs(x - s.x) < s.r).sort((a, b) => Math.abs(x - a.x) - Math.abs(x - b.x))[0] || null;
  }

  interact() {
    const spot = this.interactable();
    if (!spot) return;
    this.sfx.play('click');
    if (spot.id === 'shop') {
      if (this.invasion.shopClosed) return this.ui.toast(this.invasion.active ? 'ป้าติ๋มหนีไปหลบผีห่าอยู่!' : `ป้าติ๋มยังไม่กล้ากลับมา (อีก ${this.invasion.shopClosedMin} นาที)`, 'warn');
      this.ui.openShop('mae_kha');
    } else if (spot.id === 'shrine') this.shrine.openShrine();
    else if (spot.id === 'siamsi') this.shrine.openSiamsi();
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
      .on('snapshot', ({ t, players, boss, event }) => {
        players.forEach((p) => this.remotes.get(p.id)?.pushState(p));
        this.boss.setServer(boss);
        if (t) this.clock?.sync(t);
        if (event) this.invasion?.apply(event);
      })
      .on('appearance', ({ id, appearance }) => this.remotes.get(id)?.setAppearance(appearance))
      .on('chat', (m) => this.ui.chat(m))
      .on('skill', (d) => this.combat.remoteVfx(d, this.remotes.get(d.id)));   // สกิลของผู้เล่นอื่น

    net.connect(char.name, char.appearance);
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
    if (p.x < WORLD.townEndX) c.hp = Math.min(d.maxHp, c.hp + d.maxHp * 0.05); // ในหมู่บ้านฟื้นเร็ว
  }

  saveSoon() {
    clearTimeout(this._saveT);
    this._saveT = setTimeout(() => saveCharacter(this.player.char), 800);
  }

  update(time) {
    const idle = { left: false, right: false, jump: false, attack: false, skill: null };
    const stunned = time < (this.player.stunUntil || 0);          // โดนบอสคำราม → มึนงง
    const input = this.ui.typing || stunned ? idle : this.readInput();
    this.player.update(time, input);
    this.monsters.getChildren().forEach((m) => m.update(time, this.player));
    this.combat.update();
    this.remotes.forEach((r) => r.update());
    this.net.sendState(time, this.player.netState());

    const cam = this.cameras.main;
    this.bgFar.tilePositionX = cam.scrollX * 0.15;
    this.bgMid.tilePositionX = cam.scrollX * 0.35;
    if (this.bgTown) {
      this.bgTown.tilePositionX = cam.scrollX * 0.25;
      this.bgTown.setAlpha(Phaser.Math.Clamp(1 - (cam.scrollX - (WORLD.townEndX - 200)) / 500, 0, 0.85));
    }
    this.social.update(time, this.game.loop.delta / 1000);
    this.footsteps(time);

    this.clock.tick();
    this.invasion.update();
    const spot = this.interactable();
    this.ui.prompt(spot ? spot.prompt : '');
    this.ui.updateHud();
    this.ui.updateSkillBar(time);
    this.ui.updateFrame(time);
    const px = this.player.x;
    const zone = px < WORLD.townEndX ? 'หมู่บ้านบางผี' : px >= WORLD.arenaX ? 'ลานพญายักษ์' : px >= WORLD.graveX ? 'ป่าช้าผีตายโหง' : 'ป่าผีดุ';
    if (zone !== this.zone) { this.ui.setZone(zone, !!this.zone); this.zone = zone; }
    const night = this.clock.light < 0.35;
    this.sfx.music(
      px >= WORLD.arenaX - 120 && this.boss.alive ? 'boss'
        : px < WORLD.townEndX + 200 && this.invasion.active ? 'boss'
        : px < WORLD.townEndX ? (night ? 'townNight' : 'town')
        : night ? 'wild' : 'field');
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
