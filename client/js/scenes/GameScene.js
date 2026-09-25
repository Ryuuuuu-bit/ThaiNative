// ============================================================
//  GameScene – โลกเกม Side-scroller
//  หมู่บ้าน (NPC ร้านค้า) → ป่าผีดุ (มอนสเตอร์ 10 ชนิด) + ผู้เล่นออนไลน์
// ============================================================
import { WORLD, VIEW } from '/shared/constants.js';
import { MONSTER_IDS } from '/shared/data/monsters.js';
import { Player } from '../entities/Player.js';
import { Monster } from '../entities/Monster.js';
import { RemotePlayer } from '../entities/RemotePlayer.js';
import { Combat } from '../systems/Combat.js';
import { UI } from '../systems/UI.js';
import { Network } from '../net/Network.js';
import { getDerived, saveCharacter } from '../systems/Character.js';
import { useItem, count } from '../systems/Inventory.js';
import { makeText } from '../systems/util.js';
import { sound } from '../systems/Sound.js';
import { SKILL_SLOTS } from '/shared/data/skills.js';
import { loadSettings } from '../systems/Settings.js';

const NPC_X = 480;
const SPAWN_X = WORLD.spawnX;
const PLATFORMS = [
  [790, 190, 64], [960, 162, 80], [1340, 186, 64], [1520, 158, 48], [1700, 172, 96],
  [2040, 150, 64], [2250, 190, 80], [2600, 166, 96], [2880, 186, 64],
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
    MONSTER_IDS.forEach((id) => { for (let i = 0; i < 2; i++) this.monsters.add(new Monster(this, id)); });
    const notFlyer = (m) => !m.isFlyer;
    this.physics.add.collider(this.monsters, this.solids, null, notFlyer);
    this.physics.add.collider(this.monsters, this.platforms, null, notFlyer);

    // ---------- ระบบต่างๆ ----------
    this.combat = new Combat(this);
    this.combat.bind(this.player, this.monsters);
    this.ui = new UI(this);
    this.setupInput();
    this.setupNetwork(char);

    // ---------- กล้อง ----------
    const cam = this.cameras.main;
    cam.setZoom(VIEW.zoom);
    cam.setBounds(0, 0, W.width, W.height);
    cam.startFollow(this.player, true, 0.12, 0.12, 0, 20);

    // ---------- Event / Timer ----------
    this.events.on('player-died', () => {
      this.ui.showDeath(2500);
      this.time.delayedCall(2500, () => this.player.respawn(SPAWN_X, W.groundY - 2));
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

    // หมู่บ้าน
    const gy = W.groundY;
    this.add.image(SPAWN_X - 40, gy, 'spirit_house').setOrigin(0.5, 1).setDepth(2);
    makeText(this, SPAWN_X - 40, gy - 50, 'ศาลพระภูมิ', { fontSize: '6px', color: '#f7dc6f' }).setOrigin(0.5).setDepth(2);
    this.add.image(270, gy, 'house').setOrigin(0.5, 1).setDepth(1);
    this.add.image(NPC_X + 10, gy, 'stall').setOrigin(0.5, 1).setDepth(1);
    [200, 380, 580].forEach((x) => this.add.image(x, gy, 'lantern').setOrigin(0.5, 1).setDepth(2));
    this.add.image(W.townEndX + 20, gy, 'sign').setOrigin(0.5, 1).setDepth(2);
    makeText(this, W.townEndX + 20, gy - 38, '⚠ เขตผีดุ', { fontSize: '7px', color: '#ff7675' }).setOrigin(0.5).setDepth(2);

    // NPC ร้านค้า
    this.npc = this.add.sprite(NPC_X, gy, 'npc_maekha', 'idle_0').setOrigin(0.5, 1).setDepth(6);
    this.npc.play('npc_maekha:idle');
    makeText(this, NPC_X, gy - 56, 'ป้าติ๋ม [ร้านค้า]', { fontSize: '7px', color: '#82e0aa' }).setOrigin(0.5).setDepth(6);
  }

  // ------------------------------------------------------------
  //  Input
  // ------------------------------------------------------------
  // ปุ่มควบคุม: ← → เดิน | ↑ กระโดด | Space โจมตีปกติ | Q W E R สกิล
  //            F / ↓ คุย NPC | C สถานะ | I กระเป๋า | 1 2 ยา | M เปิด/ปิดเสียง | Enter แชท
  setupInput() {
    const kb = this.input.keyboard;
    this.keys = kb.addKeys('LEFT,RIGHT,UP,DOWN,SPACE,Q,W,E,R,T,F,C,I,H,K,M,ONE,TWO,ENTER,ESC');

    // F = คุยกับ NPC / เปิดร้านค้า
    kb.on('keydown-F', () => { if (this.nearNpc()) { this.sfx.play('click'); this.ui.openShop('mae_kha'); } });
    // ↓ = ลงจากแพลตฟอร์มไม้ (ทะลุลงไป 0.3 วิ)
    kb.on('keydown-DOWN', () => { if (this.player.body.blocked.down || this.player.body.touching.down) this.player.dropUntil = this.time.now + 300; });
    kb.on('keydown-M', () => this.ui.toggle('map-panel'));     // แผนที่โลก
    kb.on('keydown-K', () => this.ui.toggle('skill-panel'));   // Skill Tree
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

  // ------------------------------------------------------------
  //  Online (Socket.io)
  // ------------------------------------------------------------
  setupNetwork(char) {
    this.remotes = new Map();
    const net = (this.net = new Network());
    const addRemote = (p) => { if (!this.remotes.has(p.id)) this.remotes.set(p.id, new RemotePlayer(this, p)); };

    net.on('status', (on) => this.ui.setOnline(on, this.remotes.size))
      .on('init', ({ players }) => { players.forEach(addRemote); this.ui.setOnline(true, this.remotes.size); })
      .on('joined', (p) => { addRemote(p); this.ui.chat({ name: '📢 ระบบ', text: `${p.name} เข้าสู่โลก` }); this.ui.setOnline(true, this.remotes.size); })
      .on('left', (id) => { this.remotes.get(id)?.destroy(); this.remotes.delete(id); this.ui.setOnline(true, this.remotes.size); })
      .on('snapshot', ({ players }) => players.forEach((p) => this.remotes.get(p.id)?.pushState(p)))
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
    const input = this.ui.typing ? { left: false, right: false, jump: false, attack: false, skill: null } : this.readInput();
    this.player.update(time, input);
    this.monsters.getChildren().forEach((m) => m.update(time, this.player));
    this.combat.update();
    this.remotes.forEach((r) => r.update());
    this.net.sendState(time, this.player.netState());

    const cam = this.cameras.main;
    this.bgFar.tilePositionX = cam.scrollX * 0.15;
    this.bgMid.tilePositionX = cam.scrollX * 0.35;

    this.ui.prompt(this.nearNpc() ? 'กด F เพื่อคุยกับป้าติ๋ม' : '');
    this.ui.updateHud();
    this.ui.updateSkillBar(time);
    this.ui.updateFrame(time);
    const zone = this.player.x < WORLD.townEndX ? 'หมู่บ้านบางผี' : 'ป่าผีดุ';
    if (zone !== this.zone) { this.ui.setZone(zone, !!this.zone); this.zone = zone; }
    this.sfx.music(this.player.x < WORLD.townEndX ? 'town' : 'wild');
  }
}
