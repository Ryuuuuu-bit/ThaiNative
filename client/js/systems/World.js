// ============================================================
//  World – 20 แมพล่าผี 5 ภาค: พื้น/แพลตฟอร์ม/ของตกแต่งตามภาค, ประตูวาร์ป,
//  ฉากหลังเปลี่ยนตามภาค (ภาพ PixelLab ต่อกระจกให้วนต่อเนื่อง), หมอก, อนุภาคบรรยากาศ
// ============================================================
import { WORLD } from '/shared/constants.js';
import { MONSTERS } from '/shared/data/monsters.js';
import { MAP_LIST, MAPS, HUNT_MAPS, REGIONS, mapAt, gateNear } from '/shared/data/maps.js';
import { makeText } from './util.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** แพลตฟอร์มในแต่ละแมพ (ตำแหน่งสัมพัทธ์กับขอบซ้ายแมพ) – สลับ 3 แบบ */
const PLAT_SETS = [
  [[300, 188, 64], [440, 162, 80], [640, 184, 64], [800, 160, 72]],
  [[320, 170, 96], [520, 186, 64], [690, 158, 80], [860, 184, 56]],
  [[290, 184, 72], [470, 156, 64], [610, 180, 96], [820, 168, 64]],
];

// อนุภาคบรรยากาศแต่ละภาค
const AMBIENT = {
  r1: { tint: [0xf9e79f, 0xfdebd0], speedY: [-6, 2], speedX: [-10, -2], scale: 0.3, freq: 260, alpha: 0.7 },          // ละอองฟางข้าว
  r2: { tint: [0xa3e4d7, 0xd1f2eb], speedY: [-4, 4], speedX: [4, 12], scale: 0.9, freq: 160, alpha: 0.22 },           // หมอกลอย
  r3: { tint: [0x58d68d, 0x28b463, 0xd4ac0d], speedY: [8, 18], speedX: [-12, 4], scale: 0.35, freq: 220, alpha: 0.8 }, // ใบไม้ร่วง
  r4: { tint: [0xd7bde2, 0x85c1e9], speedY: [-10, -3], speedX: [-4, 4], scale: 0.3, freq: 300, alpha: 0.9 },          // วิญญาณลอย
  r5: { tint: [0xe74c3c, 0xf39c12, 0xf5b041], speedY: [-18, -6], speedX: [-6, 6], scale: 0.3, freq: 110, alpha: 0.9 }, // ถ่านไฟ
};

export class World {
  constructor(scene) {
    this.scene = scene;
    this.region = null;
    $('#travel-list').onclick = (e) => {
      const b = e.target.closest('button[data-to]');
      if (b && !b.disabled) { scene.ui.closeAll(); this.travel(b.dataset.to); }
    };
  }

  // ------------------------------------------------------------
  //  สร้างฉาก (เรียกจาก GameScene.buildLevel หลังสร้างพื้น)
  // ------------------------------------------------------------
  build() {
    const s = this.scene, gy = WORLD.groundY;
    for (const m of HUNT_MAPS) {
      const R = REGIONS[m.region];
      // พื้นย้อมสีตามภาค
      s.add.tileSprite(m.minX - 40, gy, m.maxX - m.minX + 80, 16, 'tile_ground').setOrigin(0).setDepth(5.01).setTint(R.ground);
      s.add.tileSprite(m.minX - 40, gy + 16, m.maxX - m.minX + 80, 40, 'tile_dirt').setOrigin(0).setDepth(5.01).setTint(R.ground);
      // แพลตฟอร์ม
      for (const [ox, y, w] of PLAT_SETS[m.idx % PLAT_SETS.length]) this.platform(m.minX + ox, y, w, R);
      this.decor(m, R);
      // ป้ายชื่อแมพ
      const mon = MONSTERS[m.mon];
      makeText(s, m.minX + 300, gy - 108, `Map ${m.no} · ${m.nameTh}`, { fontSize: '8px', color: '#f7dc6f' }).setOrigin(0.5).setDepth(2);
      makeText(s, m.minX + 300, gy - 96, `${mon.nameTh} Lv.${mon.level}`, { fontSize: '7px', color: '#f5b7b1' }).setOrigin(0.5).setDepth(2);
    }
    // ประตูวาร์ปทุกแมพ
    for (const m of MAP_LIST) m.gates.forEach((g, i) => this.gate(m, g, i));

    // ฉากหลังของภาค (ซ้อนบนฉากหลังเดิม) + หมอก + อนุภาค
    this.bgA = s.add.tileSprite(480, 288, 480, 160, '__DEFAULT').setScrollFactor(0).setDepth(-8.4).setAlpha(0);
    this.fog = s.add.rectangle(480, 270, 480, 270, 0x000000, 0).setScrollFactor(0).setDepth(-7.9);
    this.ambient = s.add.particles(0, 0, 'particle', {
      x: { min: 240, max: 720 }, y: { min: 150, max: 390 }, lifespan: 4000, speedX: { min: -8, max: 8 }, speedY: { min: -4, max: 4 },
      scale: { start: 0.4, end: 0 }, alpha: { start: 0.6, end: 0 }, frequency: 250,
    }).setScrollFactor(0).setDepth(29);
    this.ambient.stop();
  }

  platform(x, y, w, R) {
    const s = this.scene, gy = WORLD.groundY;
    const p = s.add.tileSprite(x, y, w, 8, 'tile_plank').setOrigin(0).setDepth(4);
    if (R.id === 'r5') p.setTint(0x8d6e63); else if (R.id === 'r4') p.setTint(0xb0a0b8);
    s.physics.add.existing(p, true);
    p.body.checkCollision.down = p.body.checkCollision.left = p.body.checkCollision.right = false;
    s.platforms.add(p);
    s.add.rectangle(x + 4, y + 8, 2, gy - y - 8, 0x3e2410).setOrigin(0).setDepth(3);
    s.add.rectangle(x + w - 6, y + 8, 2, gy - y - 8, 0x3e2410).setOrigin(0).setDepth(3);
  }

  /** ของตกแต่งตามภาค (วาดด้วยโค้ด – เบาและต่อเนื่องกันทุกแมพ) */
  decor(m, R) {
    const s = this.scene, gy = WORLD.groundY;
    const g = s.add.graphics().setDepth(1);
    const front = s.add.graphics().setDepth(6.4);                  // ชั้นหน้า (หญ้า/ต้นข้าว บังเท้า)
    let seed = m.idx * 977 + 13;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const X0 = m.minX + 60, X1 = m.maxX - 60;
    if (R.decor === 'paddy') {
      g.fillStyle(0x5dade2, 0.35).fillRect(X0, gy - 3, X1 - X0, 3);              // น้ำขังในนา
      for (let x = X0; x < X1; x += 7 + rnd() * 5) {                             // ต้นข้าว
        const h = 6 + rnd() * 6, c = rnd() < 0.3 ? 0xd4ac0d : 0x7dcea0;
        front.fillStyle(c, 1).fillRect(x, gy - h, 1, h).fillRect(x + 2, gy - h + 2, 1, h - 2);
      }
      for (let x = X0 + 200; x < X1; x += 330 + rnd() * 100) {                   // หุ่นไล่กา
        g.fillStyle(0x6e4b2a).fillRect(x, gy - 34, 2, 34).fillRect(x - 9, gy - 26, 20, 2);
        g.fillStyle(0xd4ac0d).fillTriangle(x - 7, gy - 34, x + 9, gy - 34, x + 1, gy - 42);
        g.fillStyle(0xc0392b).fillRect(x - 4, gy - 30, 10, 8);
      }
      for (let x = X0 + 120; x < X1; x += 420 + rnd() * 120) s.add.image(x, gy + 5, 'palm').setOrigin(0.5, 1).setDepth(0).setScale(0.8);
    } else if (R.decor === 'swamp') {
      for (let x = X0; x < X1; x += 90 + rnd() * 80) {                           // แอ่งน้ำ + ใบบัว
        const w = 30 + rnd() * 40;
        g.fillStyle(0x1f618d, 0.8).fillRect(x, gy - 2, w, 4);
        g.fillStyle(0x27ae60, 1).fillEllipse(x + w * 0.3, gy - 2, 8, 3).fillEllipse(x + w * 0.7, gy - 2, 6, 2);
        if (rnd() < 0.5) { g.fillStyle(0xf1948a, 1).fillCircle(x + w * 0.5, gy - 5, 2); g.fillStyle(0x229954).fillRect(x + w * 0.5, gy - 4, 1, 3); }
      }
      for (let x = X0; x < X1; x += 5 + rnd() * 9) front.fillStyle(0x4d7a5a, 1).fillRect(x, gy - 4 - rnd() * 8, 1, 12); // ต้นกก
      for (let x = X0 + 150; x < X1; x += 380 + rnd() * 120) {                   // เรือนร้างจมน้ำ
        g.fillStyle(0x4e3b2a).fillRect(x, gy - 40, 3, 40).fillRect(x + 36, gy - 34, 3, 34).fillRect(x - 4, gy - 42, 48, 4);
        g.fillStyle(0x3b2f2f).fillTriangle(x - 8, gy - 42, x + 26, gy - 62, x + 50, gy - 46);
      }
    } else if (R.decor === 'jungle') {
      for (let x = X0; x < X1; x += 110 + rnd() * 90) {                          // ต้นไม้ใหญ่ + รากไทร
        const h = 90 + rnd() * 50;
        g.fillStyle(0x3e2723).fillRect(x, gy - h, 12, h);
        g.fillStyle(0x4e342e).fillTriangle(x - 10, gy, x, gy - 20, x + 2, gy).fillTriangle(x + 22, gy, x + 12, gy - 18, x + 10, gy);
        g.fillStyle(0x1e5631, 1).fillCircle(x + 6, gy - h, 26).fillCircle(x - 14, gy - h + 10, 18).fillCircle(x + 26, gy - h + 8, 20);
        for (let k = 0; k < 3; k++) { const vx = x - 10 + k * 14; g.fillStyle(0x27ae60).fillRect(vx, gy - h + 10, 1, 30 + rnd() * 40); }
      }
      for (let x = X0; x < X1; x += 16 + rnd() * 20) front.fillStyle(0x145a32, 1).fillCircle(x, gy - 2, 4 + rnd() * 4);   // พุ่มไม้
    } else if (R.decor === 'grave') {
      for (let x = X0; x < X1; x += 60 + rnd() * 50) {
        const k = Math.floor(rnd() * 3);
        if (k === 0) {                                                           // ป้ายหลุมศพ
          g.fillStyle(0x7f8c8d, 1).fillRect(x - 5, gy - 14, 10, 14).fillCircle(x, gy - 14, 5);
          g.fillStyle(0x566573, 1).fillRect(x - 3, gy - 12, 6, 1).fillRect(x - 3, gy - 9, 6, 1);
        } else if (k === 1) {                                                    // ต้นไม้ตาย
          g.fillStyle(0x3b2f2f, 1).fillRect(x - 2, gy - 34, 4, 34).fillRect(x - 10, gy - 28, 10, 2).fillRect(x + 2, gy - 22, 9, 2).fillRect(x - 8, gy - 34, 2, 7);
        } else {                                                                 // เจดีย์เก็บกระดูก
          g.fillStyle(0xbfc9ca, 1).fillRect(x - 7, gy - 10, 14, 10).fillTriangle(x - 7, gy - 10, x + 7, gy - 10, x, gy - 30);
          g.fillStyle(0xd4ac0d, 1).fillRect(x - 1, gy - 34, 2, 5);
        }
      }
      for (let x = X0; x < X1; x += 9 + rnd() * 9) front.fillStyle(0x5b4a6b, 1).fillRect(x, gy - 3 - rnd() * 4, 1, 7);
    } else if (R.decor === 'cursed') {
      for (let x = X0; x < X1; x += 70 + rnd() * 70) {                           // หินแหลมสีเลือด
        const h = 14 + rnd() * 30;
        g.fillStyle(0x641e16, 1).fillTriangle(x - 10, gy, x + 10, gy, x + rnd() * 6 - 3, gy - h);
        g.fillStyle(0x7b241c, 1).fillTriangle(x - 4, gy, x + 14, gy, x + 8, gy - h * 0.6);
      }
      for (let x = X0 + 180; x < X1; x += 360 + rnd() * 100) {                   // เสาหินรูปยักษ์หัก
        g.fillStyle(0x5d4037).fillRect(x, gy - 50, 14, 50).fillRect(x - 3, gy - 54, 20, 5);
        g.fillStyle(0x8e44ad, 0.6).fillCircle(x + 7, gy - 40, 3);
      }
      const cracks = s.add.graphics().setDepth(5.3).setBlendMode(Phaser.BlendModes.ADD);   // รอยแยกลาวา
      for (let x = X0; x < X1; x += 40 + rnd() * 60) cracks.fillStyle(0xe67e22, 0.7).fillRect(x, gy + 2, 10 + rnd() * 16, 1);
      s.tweens.add({ targets: cracks, alpha: { from: 0.4, to: 1 }, duration: 900, yoyo: true, repeat: -1 });
      for (let x = X0; x < X1; x += 60 + rnd() * 60) {                           // กระดูก
        front.fillStyle(0xecf0f1, 1).fillRect(x, gy - 2, 6, 1).fillCircle(x, gy - 2, 1).fillCircle(x + 6, gy - 2, 1);
      }
    }
  }

  /** ประตูวาร์ป + ป้าย */
  gate(m, gt, i) {
    const s = this.scene, gy = WORLD.groundY, gx = gt.x;
    if (s.textures.exists('warp_gate')) s.add.image(gx, gy + 4, 'warp_gate').setOrigin(0.5, 1).setDepth(2).setScale(0.8);
    const portal = s.add.ellipse(gx, gy - 24, 24, 44, i === 1 ? 0xf5b041 : 0x48c9b0, 0.3).setDepth(2.1).setBlendMode(Phaser.BlendModes.ADD);
    s.tweens.add({ targets: portal, scaleX: { from: 0.85, to: 1.05 }, alpha: { from: 0.2, to: 0.45 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    let text;
    if (m.id === 'village') text = '🌀 วาร์ป · เลือกแมพล่าผี';
    else if (i === 1) {
      const next = MAP_LIST[MAP_LIST.indexOf(m) + 1];
      text = next ? `→ ${next.boss ? '👹 ' : ''}${next.nameTh} (Lv.${next.minLv}+)` : '';
    } else text = '← วาร์ป · กลับหมู่บ้าน / เลือกแมพ';
    if (text) makeText(s, gx + (i === 1 ? -6 : 6), gy - 66, text, { fontSize: '7px', color: i === 1 ? '#f8c471' : '#76d7c4' }).setOrigin(i === 1 ? 1 : 0, 0.5).setDepth(2);
  }

  // ------------------------------------------------------------
  //  วาร์ป
  // ------------------------------------------------------------
  /** กด F ที่ประตู: ประตูขวา = ไปแมพถัดไปทันที, ประตูอื่น = เปิดรายการแมพ */
  useGate() {
    const s = this.scene, x = s.player.x, m = mapAt(x), g = gateNear(x, 40);
    if (!g) return;
    const i = m.gates.indexOf(g);
    if (m.id !== 'village' && i === 1) {
      const next = MAP_LIST[MAP_LIST.indexOf(m) + 1];
      if (next) return this.travel(next.id);
    }
    this.openTravel();
  }

  openTravel() {
    const s = this.scene, lv = s.player.char.level, cur = s.map.id;
    s.ui.closeAll();
    s.ui.toggle('travel-panel', true);
    const row = (m) => {
      const mon = m.mon ? MONSTERS[m.mon] : null;
      const lock = lv < (m.minLv || 1);
      const sub = m.id === 'village' ? 'Safe Zone · NPC · ตกปลา' : m.boss ? 'เรดบอส Lv.15 · รวมพลังหลายคน' : `${mon.nameTh} Lv.${mon.level}${mon.nightBoost ? ' 🌙' : ''}`;
      return `<button data-to="${m.id}" class="tv ${m.id === cur ? 'cur' : ''}" ${lock || m.id === cur ? 'disabled' : ''}>
        <b>${m.no ? `${m.boss ? '👹' : m.no}.` : '🏘️'} ${esc(m.nameTh)}</b><small>${esc(sub)}${lock ? ` · 🔒 Lv.${m.minLv}` : ''}</small></button>`;
    };
    const groups = [['หมู่บ้าน', [MAPS.village]], ...Object.values(REGIONS).map((R) => [`ภาค ${R.no} · ${R.nameTh}`, MAP_LIST.filter((m) => m.region === R.id)])];
    $('#travel-list').innerHTML = groups.map(([title, maps]) => `<h4>${title}</h4><div class="tv-row">${maps.map(row).join('')}</div>`).join('');
  }

  travel(toId) {
    const s = this.scene, to = MAPS[toId];
    if (!to || s.warping) return;
    // ต้องยืนอยู่ที่ประตูและยังมีชีวิต (server ก็ตรวจแบบเดียวกัน → ตำแหน่งไม่หลุดกัน)
    if (!s.player.alive || !gateNear(s.player.x, 80)) {
      s.ui.closeAll();
      return s.ui.toast('ต้องยืนที่ประตูวาร์ปก่อน', 'warn');
    }
    if (s.player.char.level < (to.minLv || 1)) {
      s.sfx.play('error');
      return s.ui.toast(`🔒 ต้อง Lv.${to.minLv} ขึ้นไปถึงจะไป ${to.nameTh} ได้`, 'warn');
    }
    s.warping = true;
    s.sfx.play('blessing');
    s.combat.burst(s.player.x, s.player.y - 20, 0x76d7c4, 18);
    const cam = s.cameras.main;
    cam.fadeOut(260, 10, 30, 30);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      if (!s.player.alive) { s.warping = false; cam.fadeIn(200); return; }   // ตายระหว่างวาร์ป → ยกเลิก
      s.net.send('player:warp', { kind: 'travel', to: toId, x: Math.round(s.player.x) });
      s.player.setPosition(to.arriveX, WORLD.groundY - 2).setVelocity(0, 0);
      s.setMap(to);
      cam.centerOn(s.player.x, s.player.y);
      cam.fadeIn(320, 10, 30, 30);
      s.combat.burst(s.player.x, s.player.y - 20, 0x76d7c4, 18);
      s.warping = false;
    });
  }

  // ------------------------------------------------------------
  //  ฉากหลัง/หมอก/อนุภาค ตามภาค
  // ------------------------------------------------------------
  setRegion(map) {
    const s = this.scene, R = REGIONS[map.region] || null;
    if ((R?.id || null) === this.region) return;
    this.region = R?.id || null;
    if (!R) {                                             // หมู่บ้าน
      s.tweens.add({ targets: this.bgA, alpha: 0, duration: 500 });
      this.fog.setFillStyle(0x000000, 0);
      this.ambient.stop();
      return;
    }
    const key = this.tileTexture(R.bg);
    s.tweens.add({ targets: this.bgA, alpha: 0, duration: 250, onComplete: () => {
      if (key) this.bgA.setTexture(key);
      const h = key ? s.textures.get(key).getSourceImage().height : 160;
      this.bgA.setSize(480, h).setPosition(480, 368 - h / 2);
      s.tweens.add({ targets: this.bgA, alpha: key ? 1 : 0, duration: 500 });
    } });
    this.fog.setFillStyle(R.fog, R.fogA);
    const a = AMBIENT[R.id];
    this.ambient.setConfig?.({
      x: { min: 240, max: 720 }, y: { min: 150, max: 390 }, lifespan: 4500,
      speedX: { min: a.speedX[0], max: a.speedX[1] }, speedY: { min: a.speedY[0], max: a.speedY[1] },
      scale: { start: a.scale, end: 0 }, alpha: { start: a.alpha, end: 0 }, tint: a.tint, frequency: a.freq, blendMode: R.id === 'r2' ? 'NORMAL' : 'ADD',
    });
    this.ambient.start();
  }

  /** ภาพฉากหลังของภาค: ต่อภาพ + ภาพกลับด้าน ให้ขอบซ้าย-ขวาต่อกันสนิทเวลาเลื่อนวน */
  tileTexture(key) {
    const s = this.scene, tk = `${key}_tile`;
    if (s.textures.exists(tk)) return tk;
    if (!s.textures.exists(key)) return null;
    const src = s.textures.get(key).getSourceImage();
    const c = document.createElement('canvas');
    c.width = src.width * 2; c.height = src.height;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(src, 0, 0);
    g.save(); g.translate(src.width * 2, 0); g.scale(-1, 1); g.drawImage(src, 0, 0); g.restore();
    s.textures.addCanvas(tk, c);
    return tk;
  }

  update(cam) {
    if (this.bgA.alpha > 0) this.bgA.tilePositionX = cam.scrollX * 0.3;
  }
}
