// ============================================================
//  สุสานใต้ดิน – ผังชั้น (สร้างจากสูตร seed ตายตัว → client/server ได้ผังเดียวกัน)
//  ▸ ชั้นปกติ 48×40 ไทล์: ห้อง 6–9 ห้องต่อกันด้วยทางเดิน · บันไดขึ้น (ออก) ห้องซ้ายสุด · บันไดลง ห้องขวาสุด
//  ▸ ชั้นบอส (ลงท้าย 0) 36×36 ไทล์: ลานกว้าง ทางเข้าทางเดียวด้านล่าง · บันไดลงด้านบน (เปิดเมื่อบอสตาย)
//  ▸ portals: to = 'crypt_exit' (กลับกรุงศรีฯ) / 'crypt_down' (ลงชั้นถัดไป) · server เป็นคนตรวจว่าเปิดแล้วหรือยัง
// ============================================================
import { TILE, T, SOLID } from './ayutthaya.js';
import { CRYPT, zoneOf, lvOf, parseCrypt, cryptMob, isBossFloor, isChestFloor, partyHard } from '../data/crypt.js';

const rng = (seed) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

/** กริดผนัง/พื้น → ground (ผนังที่มีพื้นอยู่ใต้ = หน้าผนัง WALL · นอกนั้น = หลังคาผนัง WALLTOP) */
function paint(g, z, R) {
  const H = g.length, W = g[0].length, FL = T[z.floor], PA = T[z.path];
  return g.map((row, y) => row.map((v, x) => {
    if (v === 1) return y + 1 < H && g[y + 1][x] !== 1 ? T.WALL : T.WALLTOP;
    if (v === 3) return R() < 0.5 ? T.WATER : T.WATER2;
    return v === 2 ? PA : FL;
  }));
}

function finish(ground, props) {
  const solid = ground.map((row) => row.map((t) => SOLID.has(t)));
  for (const p of props) { const [fw, fh] = p.foot || [0, 0]; if (!fw) continue; const tx = Math.round(p.x / TILE) - Math.floor(fw / 2), ty = Math.round(p.y / TILE) - fh; for (let y = ty; y < ty + fh; y++) for (let x = tx; x < tx + fw; x++) if (solid[y]?.[x] !== undefined) solid[y][x] = true; }
  return solid;
}

/** ชั้นปกติ */
function buildFloor(f, n) {
  const R = rng(7331 + f * 97), { W, H } = CRYPT, z = zoneOf(f);
  const g = Array.from({ length: H }, () => new Array(W).fill(1));
  const rooms = [], want = 6 + Math.floor(R() * 3) + (f % 10 >= 6 ? 1 : 0);
  for (let tries = 0; rooms.length < want && tries < 600; tries++) {
    const w = 6 + Math.floor(R() * 7), h = 5 + Math.floor(R() * 6), x = 2 + Math.floor(R() * (W - w - 4)), y = 2 + Math.floor(R() * (H - h - 4));
    if (rooms.some((r) => x < r.x + r.w + 2 && x + w + 2 > r.x && y < r.y + r.h + 2 && y + h + 2 > r.y)) continue;
    rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) });
  }
  rooms.sort((a, b) => a.cx - b.cx);
  const carve = (x, y, v = 0) => { if (x > 0 && y > 0 && x < W - 1 && y < H - 1 && g[y][x] === 1) g[y][x] = v; };
  for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) carve(x, y);
  const link = (a, b) => {
    const hx = R() < 0.5; let x = a.cx, y = a.cy;
    const step = (tx, ty) => { while (x !== tx || y !== ty) { if (x !== tx) x += Math.sign(tx - x); else y += Math.sign(ty - y); carve(x, y, 2); carve(x + 1, y, 2); carve(x, y + 1, 2); } };
    if (hx) { step(b.cx, a.cy); step(b.cx, b.cy); } else { step(a.cx, b.cy); step(b.cx, b.cy); }
  };
  for (let i = 1; i < rooms.length; i++) link(rooms[i - 1], rooms[i]);
  if (rooms.length > 3) link(rooms[1], rooms[rooms.length - 2]);
  const start = rooms[0], exit = rooms[rooms.length - 1], mid = rooms.slice(1, -1);
  const chest = isChestFloor(f) && mid.length ? mid[Math.floor(R() * mid.length)] : null;
  // แอ่งน้ำ/ลาวากลางห้อง (ไม่ทับทางเดินกลางห้อง · เว้นขอบ 2 ไทล์)
  if (z.pool) for (const r of mid) {
    if (r === chest || R() > 0.5 || r.w < 8 || r.h < 7) continue;
    const px = r.x + 2 + Math.floor(R() * (r.w - 5)), py = r.y + 2 + Math.floor(R() * (r.h - 5));
    for (let y = py; y < py + 2; y++) for (let x = px; x < px + 2; x++) if (g[y][x] === 0 && Math.abs(x - r.cx - 0.5) > 1 && Math.abs(y - r.cy - 0.5) > 1) g[y][x] = 3;
  }
  const ground = paint(g, z, R);

  const props = [], spawns = [], portals = [], npcs = [];
  const P = (key, tx, ty, opt = {}) => props.push({ key, x: tx * TILE, y: ty * TILE, foot: [0, 0], ...opt });
  const small = (key, tx, ty, opt = {}) => P(`env/${key}`, tx, ty, { ...opt, scale: 0.6 * (opt.scale || 1) });
  const TORCH = [-22, 46, z.glow, 1.1];
  // คบไฟมุมบนของทุกห้อง · ของตกแต่งตามขอบห้อง
  const DECO = ['p_buddhahead', 'p_buddhahead2', 'p_ruin', 'p_ruin2', 'p_jar', 'p_candle'];
  for (const r of rooms) {
    small('p_torch2', r.x, r.y, { glow: TORCH }); small('p_torch2', r.x + r.w - 1, r.y, { glow: TORCH });
    for (let k = 0; k < 2; k++) {
      const dx = r.x + 1 + Math.floor(R() * (r.w - 2)), dy = R() < 0.5 ? r.y : r.y + r.h - 1, key = DECO[Math.floor(R() * DECO.length)];
      if (g[dy][dx] !== 0 || dx === r.cx) continue;
      small(key, dx, dy, key === 'p_candle' ? { glow: [-6, 14, 0xffc46b, 0.5] } : {});
    }
  }
  // บันไดขึ้น (ออก) · บันไดลง / ประตูห้องบอส
  const spawn = { x: start.cx * TILE + TILE / 2, y: (start.cy + 1) * TILE };
  portals.push({ to: 'crypt_exit', x: (start.x + 1) * TILE + TILE / 2, y: (start.cy + 1) * TILE, r: 20 });
  portals.push({ to: 'crypt_down', x: exit.cx * TILE + TILE / 2, y: (exit.cy + 1) * TILE, r: 20, boss: f % 10 === 9 });
  small('p_campfire', start.cx, start.cy - 1, { scale: 1.1, glow: [-10, 70, 0xff8a3c, 1.1] });
  // ฝูงผี: ห้องละ 1–2 ฝูง (ไม่นับห้องเริ่ม) · ฝูงละ 3–5 ตัวตามจำนวนคน
  const per = 3 + Math.floor((n - 1) / 2);
  rooms.forEach((r, i) => {
    if (i === 0) return;
    const packs = 1 + (R() < 0.45 ? 1 : 0);
    for (let k = 0; k < packs; k++) {
      let tx, ty, tries = 0;
      do { tx = r.x + 1 + Math.floor(R() * (r.w - 2)); ty = r.y + 1 + Math.floor(R() * (r.h - 2)); } while (g[ty][tx] === 3 && ++tries < 12);   // ไม่ตั้งฝูงกลางแอ่ง
      if (g[ty][tx] === 3) { tx = r.cx; ty = r.cy; }
      for (let j = 0; j < per; j++) spawns.push({ id: cryptMob(z.mobs[Math.floor(R() * z.mobs.length)], f, n), x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, r: 2 * TILE });
    }
  });
  // ห้องหีบเงิน: ผีหัวหน้า + หีบกลางห้อง
  if (chest) {
    small('p_chest', chest.cx, chest.cy, { scale: 1.3, glow: [-8, 30, 0xe9e9f0, 0.8], label: 'หีบเงิน' });
    spawns.push({ id: cryptMob(z.mobs[Math.floor(R() * z.mobs.length)], f, n, 'e'), x: (chest.cx - 2) * TILE, y: chest.cy * TILE, r: TILE });
  }
  const solid = finish(ground, props);
  const labels = [[start.cx, start.y - 1, `💀 ชั้น ${f}`], [exit.cx, exit.y - 1, f % 10 === 9 ? '☠ ประตูห้องบอส' : '▼ บันไดลง']];
  return { ground, solid, props, npcs, spawns, portals, labels, spawn, safe: { x: start.cx, y: start.cy + 1, r: 3.5 } };
}

/** ห้องบอส (ชั้นลงท้าย 0) */
function buildArena(f, n) {
  const S = CRYPT.arena, z = zoneOf(f), R = rng(9133 + f * 31), cx = S >> 1, cy = 15, rad = 12.5;
  const g = Array.from({ length: S }, () => new Array(S).fill(1));
  const round = (f / 10) % 2 === 1;
  for (let y = 1; y < S - 1; y++) for (let x = 1; x < S - 1; x++) {
    const inside = round ? Math.hypot(x - cx, y - cy) <= rad : Math.abs(x - cx) <= 11 && Math.abs(y - cy) <= 11;
    if (inside) g[y][x] = 0;
  }
  for (let y = cy; y < S - 2; y++) for (let x = cx - 1; x <= cx + 1; x++) g[y][x] = g[y][x] === 1 ? 2 : g[y][x];   // ทางเข้าด้านล่าง
  for (let x = cx - 3; x <= cx + 3; x++) for (let y = S - 6; y < S - 2; y++) g[y][x] = 0;                            // ลานรอ (Safe)
  const ground = paint(g, z, R);
  const props = [], spawns = [], portals = [];
  const P = (key, tx, ty, opt = {}) => props.push({ key, x: tx * TILE, y: ty * TILE, foot: [0, 0], ...opt });
  const small = (key, tx, ty, opt = {}) => P(`env/${key}`, tx, ty, { ...opt, scale: 0.6 * (opt.scale || 1) });
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 + Math.PI / 12;
    if (Math.abs(a - Math.PI / 2) < 0.4) continue;
    const r0 = round ? rad - 0.5 : 10.5 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
    small('p_torch2', Math.round(cx + Math.cos(a) * r0), Math.round(cy + Math.sin(a) * r0), { glow: [-22, 46, z.glow, 1.2] });
  }
  for (const [dx, dy] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) P('env/m_chedi_l', cx + dx, cy + dy, { foot: [2, 1], scale: 0.55, tint: 0x7a6a8a, glow: [-40, 50, z.glow, 0.6] });
  spawns.push({ id: cryptMob(z.boss, f, n, 'b'), x: cx * TILE + TILE / 2, y: (cy - 2) * TILE, r: TILE, boss: true });
  const spawn = { x: cx * TILE + TILE / 2, y: (S - 4) * TILE };
  portals.push({ to: 'crypt_exit', x: (cx - 2) * TILE + TILE / 2, y: (S - 3) * TILE, r: 20 });
  portals.push({ to: f >= CRYPT.floors ? 'crypt_exit' : 'crypt_down', x: cx * TILE + TILE / 2, y: (cy - 9) * TILE, r: 20, final: f >= CRYPT.floors });
  small('p_campfire', cx + 2, S - 4, { scale: 1.1, glow: [-10, 70, 0xff8a3c, 1.1] });
  const solid = finish(ground, props);
  const labels = [[cx, S - 7, `☠ ชั้น ${f}`], [cx, cy - 12, z.bossName]];
  return { ground, solid, props, npcs: [], spawns, portals, labels, spawn, safe: { x: cx, y: S - 4, r: 3.5 } };
}

const layouts = {};
export const cryptLayout = (f, n) => (layouts[`${f}:${n}`] ||= isBossFloor(f) ? buildArena(f, n) : buildFloor(f, n));

const entries = {};
/** รายการแมพ (รูปแบบเดียวกับ TD_MAPS) ของรหัส crypt:<ชั้น>:<คน>:<ห้อง> · null = รหัสผิด */
export function cryptMap(id) {
  if (entries[id]) return entries[id];
  const c = parseCrypt(id);
  if (!c) return null;
  const { f, n } = c, z = zoneOf(f), L = cryptLayout(f, n), boss = isBossFloor(f), lv = lvOf(f);
  const W = L.ground[0].length, H = L.ground.length;
  const zoneAtTile = (tx, ty) => (Math.hypot(tx - L.safe.x, ty - L.safe.y) <= L.safe.r ? 'hub' : boss ? 'lair' : 'wild');
  const lava = z.pool === 'lava';
  const M = {
    id, nameTh: `สุสานใต้ดิน ชั้น ${f}`, icon: '💀', lv: [lv, lv], reqLv: 1, W, H, color: '#c39bd3',
    sub: `${z.name} · Lv.${lv}${boss ? ` · บอส ${z.bossName}` : ''}${n > 1 ? ` · ปาร์ตี้ ${n} คน` : ''}${partyHard(f, n).hp > 1 ? ` · ผีแกร่ง HP ×${partyHard(f, n).hp.toFixed(2)}` : ''}`,
    music: 'ayt_night', noFish: true, realm: true, crypt: c,
    style: { overlay: z.overlay, wallAs: 'stone', ...(lava ? { water: 'rgba(255,90,20,0.85)', waterTint: 0xff7a30, lava: true } : { water: 'rgba(30,60,90,0.8)', waterTint: 0x4a7aa0 }) },
    spawn: { ...L.spawn },
    ZONES: { hub: { nameTh: 'กองไฟพักเหนื่อย', sub: `Safe Zone · ชั้น ${f}`, color: '#f7dc6f' }, wild: { nameTh: `ชั้น ${f} · ${z.name}`, sub: `Lv.${lv}`, color: '#c39bd3' }, lair: { nameTh: z.bossName, sub: `บอสชั้น ${f}`, color: '#ff8a80' } },
    zoneAtTile,
    zoneAt: (x, y) => zoneAtTile(Math.floor(x / TILE), Math.floor(y / TILE)),
    inSafe: (x, y) => zoneAtTile(Math.floor(x / TILE), Math.floor(y / TILE)) === 'hub',
    layout: () => L,
  };
  const keys = Object.keys(entries);
  if (keys.length > 400) delete entries[keys[0]];                                  // กันจำรายการห้องเก่าไว้เยอะเกิน
  return (entries[id] = M);
}
