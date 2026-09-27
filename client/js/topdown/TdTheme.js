// ============================================================
//  ธีมโลก New Version (อยุธยา top-down) – ฉาก/บรรยากาศ/เอฟเฟกต์/มินิแมพ
//  ▸ bakeGround: วาดพื้นทั้งแมพลง canvas ทีละก้อน + ขอบรอยต่อนุ่ม (หญ้าล้ำถนน, ฟองน้ำริมตลิ่ง, เงากำแพง) + ของตกแต่งเล็ก
//  ▸ TdAtmosphere: กลางวัน–กลางคืน, แสงโคม/หน้าต่าง, หิ่งห้อย, กลีบดอกไม้ร่วง, เงาเมฆบนพื้น, ประกายน้ำ/ปลากระโดด
//  ▸ TdVfx: วงเป้าหมาย, รอยฟัน, กระสุน, ฝุ่นเท้า, วิญญาณลอยตอนผีตาย, ไฮไลต์ตอนชี้
//  ▸ TdMinimap: มินิแมพ 2 มิติ (ภาพพื้น + จุดผู้เล่น/ผี/NPC)
// ============================================================
import { TILE, MAP_W, MAP_H, T } from '/shared/td/ayutthaya.js';

/** รายการไทล์น้ำทั้งแมพ [[x,y],...] */
export const waterTiles = (ground) => { const out = []; for (let y = 0; y < ground.length; y++) for (let x = 0; x < ground[y].length; x++) if (ground[y][x] === T.WATER || ground[y][x] === T.WATER2) out.push([x, y]); return out; };
import { dayPhase, daylight } from '/shared/data/world.js';

let seed = 99;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const CLASS = (t) => (t === T.GRASS || t === T.GRASS2 || t === T.GRASS3 || t === T.TALL ? 'g'
  : t === T.WATER || t === T.WATER2 ? 'w' : t === T.WALL || t === T.WALLTOP ? 'x' : t === T.PADDY ? 'p' : 'd');
const WATER_COLS = ['#3f7fb5', '#4a8cc2', '#3a74a6'];

// ------------------------------------------------------------
//  พื้น: วาดทั้งแมพเป็นภาพ (แบ่งก้อน 960×896)
// ------------------------------------------------------------
export function bakeGround(scene, ground, tilesets = []) {
  const src = scene.textures.get('td_tiles').getSourceImage();
  const W = MAP_W * TILE, H = MAP_H * TILE;
  const big = document.createElement('canvas'); big.width = W; big.height = H;
  const ctx = big.getContext('2d');
  const px = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const at = (x, y) => (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H ? null : ground[y][x]);
  seed = 99;
  // 1) ไทล์ฐาน (น้ำวาดสีพื้นเรียบ – ชั้นน้ำเคลื่อนไหวอยู่ด้านบน)
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const t = ground[y][x];
    if (CLASS(t) === 'w') { px(x * TILE, y * TILE, TILE, TILE, '#3a76ab'); continue; }
    ctx.drawImage(src, t * TILE, 0, TILE, TILE, x * TILE, y * TILE, TILE, TILE);
  }
  // 2) โทนสีต่างกันเล็กน้อยเป็นหย่อม ๆ (ไม่ให้พื้นซ้ำเป็นตาราง)
  for (let i = 0; i < 260; i++) {
    const cx = rnd() * W, cy = rnd() * H, r = 20 + rnd() * 60;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    const warm = rnd() < 0.5;
    g.addColorStop(0, warm ? 'rgba(255,230,140,0.10)' : 'rgba(20,60,20,0.10)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  // 3) ขอบรอยต่อ
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const t = ground[y][x], c = CLASS(t), X = x * TILE, Y = y * TILE;
    const nb = [[0, -1, 'n'], [0, 1, 's'], [-1, 0, 'w'], [1, 0, 'e']];
    for (const [dx, dy, side] of nb) {
      const o = at(x + dx, y + dy); if (o == null) continue;
      const oc = CLASS(o);
      // หญ้าล้ำเข้าถนน/ลานอิฐ/ทราย: ขอบหยัก + เงาบาง
      if (c === 'd' && oc === 'g') {
        for (let k = 0; k < TILE; k++) {
          const d = 1 + Math.floor(rnd() * 3);
          const [ax, ay, w, h] = side === 'n' ? [X + k, Y, 1, d] : side === 's' ? [X + k, Y + TILE - d, 1, d] : side === 'w' ? [X, Y + k, d, 1] : [X + TILE - d, Y + k, d, 1];
          px(ax, ay, w, h, rnd() < 0.5 ? '#5f9e4a' : '#6aa851');
        }
        const [sx, sy, sw, sh] = side === 'n' ? [X, Y + 3, TILE, 1] : side === 's' ? [X, Y + TILE - 4, TILE, 1] : side === 'w' ? [X + 3, Y, 1, TILE] : [X + TILE - 4, Y, 1, TILE];
        px(sx, sy, sw, sh, 'rgba(60,40,20,0.18)');
      }
      // ริมน้ำ: ตลิ่งเปียกเข้มขึ้น + ฟองขาวในน้ำ
      if (c !== 'w' && oc === 'w') {
        const [sx, sy, sw, sh] = side === 's' ? [X, Y + TILE - 3, TILE, 3] : side === 'n' ? [X, Y, TILE, 3] : side === 'e' ? [X + TILE - 3, Y, 3, TILE] : [X, Y, 3, TILE];
        px(sx, sy, sw, sh, 'rgba(70,50,20,0.28)');
      }
      if (c === 'w' && oc !== 'w' && oc !== 'x') {
        for (let k = 0; k < TILE; k += 2) {
          if (rnd() < 0.35) continue;
          const [ax, ay] = side === 'n' ? [X + k, Y + 1] : side === 's' ? [X + k, Y + TILE - 2] : side === 'w' ? [X + 1, Y + k] : [X + TILE - 2, Y + k];
          px(ax, ay, 2, 1, 'rgba(230,248,255,0.75)');
        }
      }
      // นาข้าว: คันนาดินรอบแปลง
      if (c === 'p' && oc !== 'p') {
        const [sx, sy, sw, sh] = side === 'n' ? [X, Y, TILE, 2] : side === 's' ? [X, Y + TILE - 2, TILE, 2] : side === 'w' ? [X, Y, 2, TILE] : [X + TILE - 2, Y, 2, TILE];
        px(sx, sy, sw, sh, '#8a6a3c');
      }
    }
    // เงากำแพงทอดลงพื้นด้านล่าง
    if (c !== 'x' && CLASS(at(x, y - 1)) === 'x') { px(X, Y, TILE, 5, 'rgba(0,0,0,0.22)'); px(X, Y + 5, TILE, 3, 'rgba(0,0,0,0.1)'); }
  }
  // 4) ของตกแต่งเล็กบนหญ้า: ดอกไม้เป็นกอ, ก้อนหิน, ใบไม้ร่วง
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (CLASS(ground[y][x]) !== 'g') continue;
    const r = rnd(), X = x * TILE, Y = y * TILE;
    if (r < 0.05) {                                                    // กอดอกไม้
      const col = ['#f7d154', '#f59ec3', '#ffffff', '#c39bd3'][Math.floor(rnd() * 4)];
      for (let k = 0; k < 4; k++) { const fx = X + 3 + rnd() * 10, fy = Y + 3 + rnd() * 10; px(fx, fy + 1, 1, 2, '#3f7a32'); px(fx - 1, fy, 3, 1, col); px(fx, fy - 1, 1, 3, col); px(fx, fy, 1, 1, '#fff3a0'); }
    } else if (r < 0.07) {                                             // ก้อนหิน
      const sx = X + 4 + rnd() * 6, sy = Y + 6 + rnd() * 6;
      px(sx, sy, 4, 3, '#8f8c80'); px(sx, sy, 3, 1, '#b8b4a6'); px(sx, sy + 3, 4, 1, 'rgba(0,0,0,0.25)');
    } else if (r < 0.09) {                                             // ใบไม้แห้ง
      px(X + rnd() * 12, Y + rnd() * 12, 2, 1, '#c98a3a'); px(X + rnd() * 12, Y + rnd() * 12, 1, 2, '#a86a2a');
    }
  }
  // 4.5) พื้นจาก tileset ของ PixelLab (Wang 16 ไทล์ วาดแบบ dual-grid: ไทล์แสดงผลเลื่อนครึ่งช่อง มุมทั้ง 4 = ไทล์ในผัง 4 ช่องรอบจุดนั้น)
  if (tilesets.length) {
    const sets = new Map(); const full = new Map();
    for (const id of tilesets) {
      const key = `ts_${id}`; if (!scene.textures.exists(key)) continue;
      const [lo, up] = id.split('__'); const img = scene.textures.get(key).getSourceImage();
      sets.set(`${lo}|${up}`, { img, lo, up });
      if (!full.has(lo)) full.set(lo, { img, m: 0 }); if (!full.has(up)) full.set(up, { img, m: 15 });
    }
    const PRI = { water: 8, stone: 7, brick: 6, road: 5, sand: 4, paddy: 3, tall: 2, grass: 1 };
    const isWaterT = (t) => t === T.WATER || t === T.WATER2;
    const terr = (x, y) => {
      const t = at(Math.max(0, Math.min(MAP_W - 1, x)), Math.max(0, Math.min(MAP_H - 1, y)));
      if (isWaterT(t)) return 'water';
      if (t === T.WOOD) return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isWaterT(at(x + dx, y + dy))) ? 'water' : 'stone';
      return { [T.STONE]: 'stone', [T.BRICK]: 'brick', [T.ROAD]: 'road', [T.PADDY]: 'paddy', [T.TALL]: 'tall', [T.SAND]: 'sand' }[t] || 'grass';
    };
    const drawFull = (name, X, Y) => { const f = full.get(name); if (!f) return false; ctx.drawImage(f.img, f.m * TILE, 0, TILE, TILE, X, Y, TILE, TILE); return true; };
    for (let y = 0; y <= MAP_H; y++) for (let x = 0; x <= MAP_W; x++) {
      const c = [terr(x - 1, y - 1), terr(x, y - 1), terr(x - 1, y), terr(x, y)];
      const X = x * TILE - TILE / 2, Y = y * TILE - TILE / 2;
      const kinds = [...new Set(c)];
      if (kinds.length === 1) { drawFull(kinds[0], X, Y); continue; }
      // เลือกคู่ที่มี tileset: สองชนิดที่พบบ่อยสุด (เสมอกัน → ความสำคัญสูงกว่า) ที่เหลือแทนด้วยชนิดที่พบบ่อยสุด
      const cnt = {}; for (const k of c) cnt[k] = (cnt[k] || 0) + 1;
      kinds.sort((p, q) => cnt[q] - cnt[p] || PRI[q] - PRI[p]);
      let [p1, p2] = kinds; const cc = c.map((k) => (k === p1 || k === p2 ? k : p1));
      let set = sets.get(`${p1}|${p2}`) || sets.get(`${p2}|${p1}`);
      if (!set) { if (!drawFull(p1, X, Y)) continue; continue; }
      const m = cc.reduce((acc, k, i) => acc | (k === set.up ? 1 << i : 0), 0);
      ctx.drawImage(set.img, m * TILE, 0, TILE, TILE, X, Y, TILE, TILE);
    }
    // กำแพง/สะพานไม้ วาดทับด้วยไทล์เดิม
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
      const t = ground[y][x];
      if (t === T.WALL || t === T.WALLTOP || t === T.WOOD) ctx.drawImage(src, t * TILE, 0, TILE, TILE, x * TILE, y * TILE, TILE, TILE);
    }
  }
  // 5) บัวในแม่น้ำ
  const wt = waterTiles(ground);
  for (let i = 0; i < 60 && wt.length; i++) {
    const [x, y] = wt[Math.floor(rnd() * wt.length)];
    if (at(x, y - 1) === T.WOOD || at(x, y + 1) === T.WOOD || at(x - 1, y) === T.WOOD || at(x + 1, y) === T.WOOD) continue;
    const X = x * TILE + rnd() * 8, Y = y * TILE + rnd() * 8;
    px(X, Y, 6, 4, '#2f8a4a'); px(X + 1, Y, 4, 1, '#56b86c'); px(X + 3, Y + 1, 1, 2, '#1f6a3a');
    if (rnd() < 0.4) { px(X + 2, Y - 2, 3, 2, '#f7a8c8'); px(X + 3, Y - 3, 1, 1, '#ffe0ee'); }
  }
  // → texture ก้อนละ 960×896
  const CW = 960, CH = 896, parts = [];
  for (let cy = 0; cy < H; cy += CH) for (let cx = 0; cx < W; cx += CW) {
    const key = `td_ground_${cx}_${cy}`;
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const c = document.createElement('canvas'); c.width = Math.min(CW, W - cx); c.height = Math.min(CH, H - cy);
    c.getContext('2d').drawImage(big, cx, cy, c.width, c.height, 0, 0, c.width, c.height);
    scene.textures.addCanvas(key, c);
    parts.push(scene.add.image(cx, cy, key).setOrigin(0).setDepth(0));
  }
  // ภาพเล็กสำหรับมินิแมพ
  const mini = document.createElement('canvas'); mini.width = MAP_W * 2; mini.height = MAP_H * 2;
  mini.getContext('2d').drawImage(big, 0, 0, mini.width, mini.height);
  return { parts, mini };
}

/** ชั้นน้ำเคลื่อนไหว (ลายคลื่นเลื่อน) */
export function makeWater(scene, ground) {
  if (!scene.textures.exists('td_water')) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 32; const g = c.getContext('2d');
    g.fillStyle = '#3f7fb5'; g.fillRect(0, 0, 64, 32);
    seed = 5;
    for (let i = 0; i < 40; i++) { g.fillStyle = WATER_COLS[Math.floor(rnd() * 3)]; g.fillRect(Math.floor(rnd() * 64), Math.floor(rnd() * 32), 2 + Math.floor(rnd() * 4), 1); }
    for (let i = 0; i < 7; i++) { g.fillStyle = 'rgba(190,230,255,0.7)'; g.fillRect(Math.floor(rnd() * 60), Math.floor(rnd() * 32), 4 + Math.floor(rnd() * 5), 1); }
    scene.textures.addCanvas('td_water', c);
  }
  // แบ่งไทล์น้ำเป็นสี่เหลี่ยมใหญ่ (แถวต่อแถว แล้วรวมแถวที่ช่วงเดียวกัน) → tileSprite 2 ชั้นต่อก้อน
  const isW = (x, y) => ground[y]?.[x] === T.WATER || ground[y]?.[x] === T.WATER2;
  const open = new Map(), rects = [];
  for (let y = 0; y <= ground.length; y++) {
    const runs = [];
    if (y < ground.length) for (let x = 0; x < ground[y].length; x++) { if (!isW(x, y)) continue; let x1 = x; while (isW(x1 + 1, y)) x1++; runs.push(`${x},${x1}`); x = x1; }
    const keep = new Set(runs);
    for (const [k, r] of open) if (!keep.has(k)) { rects.push(r); open.delete(k); }
    for (const k of runs) if (open.has(k)) open.get(k).y1 = y; else { const [x0, x1] = k.split(',').map(Number); open.set(k, { x0, x1, y0: y, y1: y }); }
  }
  const layers = [];
  for (const r of rects) {
    const X = r.x0 * TILE, Y = r.y0 * TILE, W = (r.x1 - r.x0 + 1) * TILE, H = (r.y1 - r.y0 + 1) * TILE;
    const a = scene.add.tileSprite(X, Y, W, H, 'td_water').setOrigin(0).setDepth(0.2).setTilePosition(X, Y).setVisible(!scene.tilesets?.length);
    const b = scene.add.tileSprite(X + 3, Y + 3, Math.max(1, W - 6), Math.max(1, H - 6), 'td_water').setOrigin(0).setDepth(0.21).setAlpha(scene.tilesets?.length ? 0.12 : 0.35).setBlendMode(Phaser.BlendModes.ADD);
    layers.push([a, b, X, Y]);
  }
  return { update(t) { for (const [a, b, X, Y] of layers) { a.tilePositionX = X + t * 0.008; a.tilePositionY = Y; b.tilePositionX = X - t * 0.013; b.tilePositionY = Y + Math.sin(t / 900) * 3; } } };
}

// ------------------------------------------------------------
//  บรรยากาศ: กลางวัน–กลางคืน / แสงไฟ / อนุภาค
// ------------------------------------------------------------
export class TdAtmosphere {
  constructor(scene, layout, dayMs = 20 * 60 * 1000) {
    this.s = scene; this.dayMs = dayMs; this.offset = 0;
    const s = scene, cam = s.cameras.main;
    this.wt = waterTiles(layout.ground);
    // ม่านสีกลางคืน (อยู่เหนือโลก ใต้ UI) – ใช้ MULTIPLY ให้สีมืดลงแบบยังเห็นรายละเอียด
    this.night = s.add.rectangle(0, 0, 4000, 4000, 0x3a3f9a, 1).setScrollFactor(0).setDepth(50000).setBlendMode(Phaser.BlendModes.MULTIPLY).setAlpha(0);
    this.dusk = s.add.rectangle(0, 0, 4000, 4000, 0xff9a4a, 1).setScrollFactor(0).setDepth(50001).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    // แสงโคม (ADD) ที่เสาหลัก/บ้าน/ร้าน/กองไฟ
    this.lights = [];
    const light = (x, y, r, col = 0xffc46b, k = 1) => this.lights.push({ img: s.add.image(x, y, 'fx_glow').setDepth(50002).setBlendMode(Phaser.BlendModes.ADD).setTint(col).setDisplaySize(r * 2, r * 1.4).setAlpha(0), k, ph: Math.random() * 6 });
    for (const p of layout.props) {
      if (!p.drawn) continue;
      if (p.glow) { const [dy, r, col, k] = p.glow; light(p.x, p.y + dy * (p.scale || 1), r, col, k); continue; }
      if (p.key === 'td_pillar') light(p.x, p.y - 30, 42);
      else if (p.key === 'house') { light(p.x - 16, p.y - 30, 26, 0xffd27a, 0.8); light(p.x + 16, p.y - 30, 26, 0xffd27a, 0.8); }
      else if (p.key === 'stall' || p.key === 'food_stall') light(p.x, p.y - 20, 40, 0xffb35c, 0.9);
      else if (p.key === 'campfire') light(p.x, p.y - 10, 80, 0xff8a3c, 1.3);
      else if (p.key === 'temple' || p.key === 'sala') light(p.x, p.y - 20, 70, 0xffe1a0, 0.7);
      else if (p.key === 'td_chedi') light(p.x, p.y - 40, 60, 0xfff0c0, 0.5);
    }
    for (const n of layout.npcs) light(n.x, n.y - 16, 22, 0xfff2c8, 0.35);
    // อนุภาค: หิ่งห้อย (กลางคืนนอกเมือง) / กลีบดอกลีลาวดีร่วง (กลางวันในเมือง)
    this.flies = s.add.particles(0, 0, 'fx_spark', {
      x: { min: -480, max: 480 }, y: { min: -270, max: 270 }, lifespan: 3200, speedX: { min: -8, max: 8 }, speedY: { min: -10, max: 4 },
      scale: { start: 0.18, end: 0 }, alpha: { start: 0.9, end: 0 }, tint: [0xf9e79f, 0xabebc6], frequency: 90, blendMode: 'ADD',
    }).setDepth(50003); this.flies.stop();
    this.petals = s.add.particles(0, 0, 'fx_spark', {
      x: { min: -520, max: 520 }, y: -300, lifespan: 6000, speedX: { min: 6, max: 22 }, speedY: { min: 18, max: 34 },
      scale: { start: 0.14, end: 0.1 }, alpha: { start: 0.85, end: 0 }, tint: [0xfff4f8, 0xffd6e8, 0xfff0b0], frequency: 260, rotate: { min: 0, max: 360 },
    }).setDepth(49990); this.petals.stop();
    // เงาเมฆลอยผ่านพื้น
    this.clouds = [];
    for (let i = 0; i < 5; i++) this.clouds.push(s.add.image(Math.random() * MAP_W * TILE, Math.random() * MAP_H * TILE, 'fx_glow').setTint(0x000000).setAlpha(0.1).setDisplaySize(260 + Math.random() * 200, 140 + Math.random() * 80).setDepth(49980));
    // ประกายน้ำ + ปลากระโดด
    this.sparkle = s.add.particles(0, 0, 'fx_spark', {
      emitZone: { type: 'random', source: { getRandomPoint: (v) => { const [x, y] = this.wt[Math.floor(Math.random() * this.wt.length)] || [0, 0]; v.x = x * TILE + Math.random() * TILE; v.y = y * TILE + Math.random() * TILE; return v; } } }, lifespan: 700, scale: { start: 0.2, end: 0 }, alpha: { start: 0.9, end: 0 },
      tint: 0xe8f8ff, frequency: 45, blendMode: 'ADD',
    }).setDepth(0.25);
    this.nextFish = 0;
    cam.on('followupdate', () => {});
  }

  /** เวลาในเกม: ใช้ Date.now() + ค่าชดเชยจาก server */
  sync(serverTime, dayMs) { if (dayMs) this.dayMs = dayMs; if (serverTime) this.offset = serverTime - Date.now(); }
  get phase() { return dayPhase(Date.now() + this.offset, this.dayMs); }
  get light() { return daylight(this.phase); }
  get hour() { return (this.phase * 24 + 6) % 24; }

  update(time, player, inTown) {
    const s = this.s, cam = s.cameras.main, L = this.light, h = this.hour;
    const dark = 1 - L;
    this.night.setAlpha(dark * 0.78);
    const glow = h >= 16 && h < 20 ? Math.sin(((h - 16) / 4) * Math.PI) : h >= 5 && h < 8 ? Math.sin(((h - 5) / 3) * Math.PI) * 0.7 : 0;
    this.dusk.setAlpha(glow * 0.12);
    for (const l of this.lights) l.img.setAlpha(Math.min(1, dark * 1.2) * l.k * (0.85 + Math.sin(time / 170 + l.ph) * 0.15));
    const cx = cam.midPoint.x, cy = cam.midPoint.y;
    this.flies.setPosition(cx, cy); this.petals.setPosition(cx, cy);
    const wantFlies = dark > 0.5 && !inTown, wantPetals = L > 0.6 && inTown;
    if (wantFlies !== this.flies.emitting) wantFlies ? this.flies.start() : this.flies.stop();
    if (wantPetals !== this.petals.emitting) wantPetals ? this.petals.start() : this.petals.stop();
    for (const c of this.clouds) { c.x += 0.18; c.y += 0.05; if (c.x > MAP_W * TILE + 300) { c.x = -300; c.y = Math.random() * MAP_H * TILE; } c.setAlpha(0.1 * L); }
    // ปลากระโดดเป็นระยะ (เฉพาะใกล้กล้อง)
    if (time > this.nextFish) {
      this.nextFish = time + 2500 + Math.random() * 4000;
      const near = this.wt.filter(([x, y]) => Math.abs(x * TILE - cx) < 260 && Math.abs(y * TILE - cy) < 200);
      const pick = near[Math.floor(Math.random() * near.length)];
      const fx = pick ? pick[0] * TILE + 8 : 0, fy = pick ? pick[1] * TILE + 8 : 0;
      if (pick) {
        const fish = s.add.rectangle(fx, fy, 5, 2, 0xc0d8e8).setDepth(0.3);
        s.tweens.add({ targets: fish, y: fy - 10, x: fx + 10, angle: 180, duration: 260, yoyo: true, onComplete: () => { fish.destroy(); splash(s, fx + 10, fy); } });
      }
    }
  }
}

function splash(s, x, y) {
  const r = s.add.image(x, y, 'fx_ring').setDepth(0.3).setScale(0.1, 0.05).setAlpha(0.8);
  s.tweens.add({ targets: r, scaleX: 0.35, scaleY: 0.15, alpha: 0, duration: 500, onComplete: () => r.destroy() });
}

// ------------------------------------------------------------
//  VFX สำหรับมุมมองบน
// ------------------------------------------------------------
export function bakeTdFx(scene) {
  const mk = (key, w, h, draw) => { if (scene.textures.exists(key)) return; const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); scene.textures.addCanvas(key, c); };
  // วงเป้าหมาย (ลายยันต์เล็ก)
  mk('td_target', 64, 64, (g) => {
    g.strokeStyle = 'rgba(255,90,90,1)'; g.lineWidth = 3; g.beginPath(); g.arc(32, 32, 26, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 2; for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; g.beginPath(); g.arc(32, 32, 20, a + 0.2, a + 1.2); g.stroke(); }
    g.fillStyle = 'rgba(255,200,120,1)'; for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; g.fillRect(32 + Math.cos(a) * 26 - 2, 32 + Math.sin(a) * 26 - 2, 4, 4); }
  });
  // รอยฟันโค้ง
  mk('td_slash', 64, 64, (g) => {
    const gr = g.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.6, 'rgba(255,250,220,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,1)');
    g.strokeStyle = gr; g.lineCap = 'round';
    for (let k = 0; k < 3; k++) { g.lineWidth = 7 - k * 2; g.globalAlpha = 0.4 + k * 0.3; g.beginPath(); g.arc(18, 32, 26 - k, -1.1, 1.1); g.stroke(); }
  });
  // ลูกไฟ / ลูกธนู
  mk('td_arrow', 20, 4, (g) => { g.fillStyle = '#8a5a2a'; g.fillRect(0, 1, 15, 2); g.fillStyle = '#e8e8e8'; g.fillRect(15, 0, 5, 4); g.fillStyle = '#f5d76e'; g.fillRect(0, 0, 3, 4); });
  mk('td_orb', 16, 16, (g) => { const r = g.createRadialGradient(8, 8, 0, 8, 8, 8); r.addColorStop(0, '#fffbe0'); r.addColorStop(0.4, '#ffb347'); r.addColorStop(1, 'rgba(255,80,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 16, 16); });
  // วิญญาณ (ดวงไฟผีลอยขึ้นตอนตาย)
  mk('td_soul', 12, 16, (g) => { const r = g.createRadialGradient(6, 10, 0, 6, 10, 6); r.addColorStop(0, '#ffffff'); r.addColorStop(0.5, '#b8f0ff'); r.addColorStop(1, 'rgba(120,200,255,0)'); g.fillStyle = r; g.beginPath(); g.moveTo(6, 0); g.quadraticCurveTo(12, 10, 6, 16); g.quadraticCurveTo(0, 10, 6, 0); g.fill(); });
}

export class TdVfx {
  constructor(scene) {
    this.s = scene;
    this.ring = scene.add.image(0, 0, 'td_target').setDepth(0.8).setScale(0.5, 0.25).setAlpha(0);
    this.hover = scene.add.image(0, 0, 'td_target').setDepth(0.79).setScale(0.45, 0.22).setAlpha(0).setTint(0xfff2a0);
    this.dustAt = 0;
  }

  update(time, player, target, hovered) {
    const r = this.ring;
    if (target && target.alive) { r.setPosition(target.x, target.y).setAlpha(0.85).setAngle(time * 0.08); const k = 0.5 + Math.sin(time / 150) * 0.03; r.setScale(k * (target.displayWidth / 32 || 1), k * 0.5 * (target.displayWidth / 32 || 1)); }
    else r.setAlpha(0);
    const h = this.hover;
    if (hovered && hovered !== target && hovered.visible !== false) h.setPosition(hovered.x, hovered.y).setAlpha(0.7).setAngle(-time * 0.05);
    else h.setAlpha(0);
    // ฝุ่นเท้าตอนเดิน
    if (player.st === 'walk' && time > this.dustAt) { this.dustAt = time + 220; this.dust(player.x, player.y); }
  }

  dust(x, y) {
    const d = this.s.add.image(x + (Math.random() - 0.5) * 6, y - 1, 'fx_glow').setTint(0xd8c8a0).setDisplaySize(8, 4).setAlpha(0.5).setDepth(0.75);
    this.s.tweens.add({ targets: d, displayWidth: 16, displayHeight: 7, alpha: 0, y: y - 4, duration: 420, onComplete: () => d.destroy() });
  }

  slash(p, m, crit) {
    const a = Math.atan2(m.y - p.y, m.x - p.x);
    const img = this.s.add.image((p.x + m.x) / 2, (p.y + m.y) / 2 - 10, 'td_slash').setRotation(a).setDepth(99990).setBlendMode(Phaser.BlendModes.ADD).setTint(crit ? 0xffd35c : 0xffffff).setScale(crit ? 0.9 : 0.6).setAlpha(0.95);
    this.s.tweens.add({ targets: img, alpha: 0, scale: img.scale * 1.3, duration: 200, onComplete: () => img.destroy() });
  }

  shoot(p, m, kind = 'arrow') {
    const s = this.s, sx = p.x, sy = p.y - 16, tx = m.x, ty = m.y - m.displayHeight * 0.5, a = Math.atan2(ty - sy, tx - sx);
    const b = s.add.image(sx, sy, kind === 'magic' ? 'td_orb' : 'td_arrow').setRotation(a).setDepth(99990).setScale(kind === 'magic' ? 1.2 : 1);
    if (kind === 'magic') b.setBlendMode(Phaser.BlendModes.ADD);
    const trail = s.add.particles(0, 0, 'fx_spark', { follow: b, lifespan: 250, scale: { start: kind === 'magic' ? 0.3 : 0.12, end: 0 }, alpha: { start: 0.8, end: 0 }, tint: kind === 'magic' ? 0xff9a3c : 0xfff2c0, frequency: 20, blendMode: 'ADD' }).setDepth(99989);
    s.tweens.add({ targets: b, x: tx, y: ty, duration: Math.min(260, Math.hypot(tx - sx, ty - sy) * 1.8), onComplete: () => { b.destroy(); s.time.delayedCall(200, () => trail.destroy()); trail.stop(); } });
  }

  soul(m) {
    const s = this.s, n = 3;
    for (let i = 0; i < n; i++) {
      const w = s.add.image(m.x + (i - 1) * 6, m.y - 10, 'td_soul').setDepth(99980).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.9).setScale(0.8);
      s.tweens.add({ targets: w, y: w.y - 36 - i * 8, x: w.x + Math.sin(i) * 8, alpha: 0, scale: 0.4, duration: 1100 + i * 200, delay: i * 90, ease: 'Sine.easeOut', onComplete: () => w.destroy() });
    }
  }
}

// ------------------------------------------------------------
//  มินิแมพ 2 มิติ (DOM canvas มุมขวาบน)
// ------------------------------------------------------------
export class TdMinimap {
  constructor(miniCanvas) {
    this.base = miniCanvas;
    let el = document.getElementById('td-minimap');
    if (!el) { el = document.createElement('canvas'); el.id = 'td-minimap'; document.getElementById('td-hud').appendChild(el); }
    el.width = 150; el.height = 110; this.el = el; this.ctx = el.getContext('2d'); this.ctx.imageSmoothingEnabled = false;
    this.at = 0;
  }

  update(time, s) {
    this.el.hidden = s.settings?.minimap === false;
    if (this.el.hidden || time - this.at < 200) return; this.at = time;
    const g = this.ctx, p = s.player, W = this.el.width, H = this.el.height;
    const scale = 2 / TILE;                                   // 1 ไทล์ = 2px บนมินิแมพ
    const ox = Math.max(0, Math.min(this.base.width - W, p.x * scale - W / 2)), oy = Math.max(0, Math.min(this.base.height - H, p.y * scale - H / 2));
    g.clearRect(0, 0, W, H);
    g.drawImage(this.base, ox, oy, W, H, 0, 0, W, H);
    g.fillStyle = 'rgba(10,6,20,0.15)'; g.fillRect(0, 0, W, H);
    const dot = (x, y, c, r = 2) => { g.fillStyle = c; g.fillRect(Math.round(x * scale - ox - r / 2), Math.round(y * scale - oy - r / 2), r, r); };
    for (const n of s.npcs || []) dot(n.x, n.y, '#ffd35c', 3);
    for (const m of s.mobs || []) if (m.alive) dot(m.x, m.y, '#ff5a5a', 2);
    s.remotes?.forEach((r) => dot(r.x, r.y, '#6ec8ff', 3));
    dot(p.x, p.y, '#ffffff', 4); dot(p.x, p.y, '#2ecc71', 2);
  }
}
