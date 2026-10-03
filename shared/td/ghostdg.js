// ============================================================
//  ดันเจี้ยนสี่ผีป่าช้า – ผังลานบอส (สร้างจากสูตรตายตัว → client/server ได้ผังเดียวกัน)
//  ▸ 76×80 ไทล์ (ขนาดพอ ๆ ลานบอสโลก): ค่ายพัก (Safe) ด้านล่าง → ทางเดินผีบริวาร → ลานบอสกลม · หลักไม้รอบลาน (จำนวนตามคน)
//  ▸ portals: to = 'gd_exit' (กลับหน้าประตูสุสาน) · layout.posts = ตำแหน่งหลักไม้ (px) ให้ server/client ใช้ตรงกัน
// ============================================================
import { TILE, T, SOLID } from './ayutthaya.js';
import { GD_BOSSES, GD_DIFFS, GD_SPLIT, parseGd, gdBossMob, gdMinionMob, gdPartMob, postTiles } from '../data/ghostdg.js';

const STYLE = {
  hung: { floor: T.STONE, path: T.BRICK, glow: 0xb8c4e0, overlay: 0x1a1a2a, name: 'ลานประหาร' },
  krasue: { floor: T.SAND, path: T.WOOD, glow: 0x8fe3b0, overlay: 0x0f2a1a, name: 'ทุ่งโลง' },
  yat: { floor: T.ROAD, path: T.STONE, glow: 0xb9a6d8, overlay: 0x120c1e, name: 'ใต้ถุนเรือนร้าง' },
  pob: { floor: T.GRASS3, path: T.BRICK, glow: 0xff9a7a, overlay: 0x1e1410, name: 'ป่าช้าวัดร้าง' },
};
/** รูปทรงลาน (ไทล์) ต่อบอส · cx/cy = กลางลาน */
const SHAPE = {
  hung: (x, y, cx, cy) => Math.hypot(x - cx, (y - cy) * 1.05) <= 26,
  krasue: (x, y, cx, cy) => { const a = Math.atan2(y - cy, x - cx), r = 25 + 3 * Math.sin(a * 3) + 2 * Math.cos(a * 5); return Math.hypot(x - cx, (y - cy) * 1.05) <= r; },
  yat: (x, y) => x >= 10 && x <= 66 && y >= 8 && y <= 56,
  pob: (x, y, cx, cy) => { const a = Math.atan2(y - cy, x - cx), r = 26 + 2.5 * Math.sin(a * 7 + 1); return Math.hypot(x - cx, (y - cy) * 1.05) <= r; },
};
/** สุ่มแบบกำหนดเมล็ด → client/server ได้ผังเดียวกัน */
const seeded = (s) => () => (s = (s * 16807) % 2147483647) / 2147483647;

function build(boss, diff, n) {
  const W = 76, H = 80, cx = 38, cy = 32, rad = 26, Z = STYLE[boss] || STYLE.hung, inside = SHAPE[boss] || SHAPE.hung, R = seeded({ hung: 7, krasue: 13, yat: 29, pob: 41 }[boss] || 7);
  const g = Array.from({ length: H }, () => new Array(W).fill(1));
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (inside(x, y, cx, cy)) g[y][x] = 0;               // ลาน
  for (let y = cy + rad - 6; y < H - 9; y++) for (let x = cx - 3; x <= cx + 3; x++) g[y][x] = 2;   // ทางเดิน (ผีบริวาร)
  for (let y = H - 10; y < H - 2; y++) for (let x = cx - 7; x <= cx + 7; x++) g[y][x] = 0;                               // ค่ายพัก (Safe)
  const over = {};                                                                                                      // ไทล์พิเศษในลาน (น้ำ/เสา/ผนัง) "x,y" → T
  const props = [], spawns = [], portals = [], objs = [];                                                              // objs = ของกลไก (โลง/โอ่ง/หวาย) px
  const obj = (kind, tx, ty) => objs.push({ kind, x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });
  const P = (key, tx, ty, opt = {}) => props.push({ key, x: tx * TILE, y: ty * TILE, foot: [0, 0], ...opt });
  const small = (key, tx, ty, opt = {}) => P(`env/${key}`, tx, ty, { ...opt, scale: 0.6 * (opt.scale || 1) });
  const wallAt = (x, y) => g[y]?.[x] === 1;
  const edge = (fn, count, rMin, rMax) => { for (let i = 0; i < count; i++) { const a = R() * Math.PI * 2, r = rMin + R() * (rMax - rMin), x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r * 0.95); if (y < 2 || y > cy + rad - 4 || x < 2 || x > W - 3 || !wallAt(x, y)) continue; fn(x, y); } };

  if (boss === 'hung') {
    // คบไฟรอบลาน · เจดีย์ร้าง 5 องค์ · หลักไม้ (จำนวนตามคน)
    for (let k = 0; k < 30; k++) {
      const a = (k / 30) * Math.PI * 2;
      if (Math.abs(a - Math.PI / 2) < 0.2) continue;
      small('p_torch2', Math.round(cx + Math.cos(a) * (rad - 0.6)), Math.round(cy + Math.sin(a) * (rad - 0.6)), { glow: [-22, 46, Z.glow, 1.1] });
    }
    for (const [dx, dy] of [[-16, -13], [16, -13], [-21, 6], [21, 6], [0, -21]]) P('env/m_chedi_l', cx + dx, cy + dy, { foot: [2, 1], scale: 0.5, tint: 0x6a6a7a, glow: [-40, 50, Z.glow, 0.5] });
  } else if (boss === 'krasue') {
    // บึงน้ำตื้น (กลาง + 2 แอ่ง) = นาข้าวเปียก เดินได้ · ดงกล้วย (ปาล์ม/ไผ่) ล้อมขอบ · โลง 8 ใบ · ไฟผีลอย
    const bog = (bx, by, rx, ry) => { for (let y = by - ry; y <= by + ry; y++) for (let x = bx - rx; x <= bx + rx; x++) if (((x - bx) / rx) ** 2 + ((y - by) / ry) ** 2 <= 1 && g[y]?.[x] === 0) over[`${x},${y}`] = T.PADDY; };
    bog(cx + 1, cy + 2, 9, 6); bog(cx - 13, cy - 9, 4, 3); bog(cx + 14, cy + 12, 4, 3);
    for (const [x, y] of [[cx + 3, cy + 3], [cx - 2, cy + 1]]) over[`${x},${y}`] = T.WATER2;                         // หลุมน้ำลึก 2 จุด (ชน)
    edge((x, y) => P(`env/${R() < 0.6 ? 't_palm' : 'p_bamboo'}`, x, y, { scale: 0.55 + R() * 0.25, tint: 0x9fc48f }), 90, rad - 1, rad + 6);
    const coffins = [[-15, -15], [0, -20], [15, -15], [20, 0], [14, 15], [-14, 15], [-20, 0], [-6, 8]];
    coffins.forEach(([dx, dy], i) => { if (n > 3 || i % 2 === 0) obj('coffin', cx + dx, cy + dy + 1); });   // คนน้อย = 4 โลง
    for (const [dx, dy] of coffins) small('p_chest', cx + dx, cy + dy, { scale: 1.4, tint: 0x7a5636, glow: [-6, 30, Z.glow, 0.35], coffin: true });
    for (let i = 0; i < 10; i++) { const a = R() * Math.PI * 2, r = 6 + R() * 16; small('p_candle', Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.9), { scale: 0.8, glow: [-4, 40, 0x8fe3b0, 0.9] }); }
  } else if (boss === 'yat') {
    // ใต้ถุนเรือน: เสาเรือนเป็นตาราง (ชน · ใช้หลบท่า) · คลองฝั่งตะวันออก · โอ่งน้ำมนต์ 4 มุม · ตะเกียงริบหรี่
    for (let y = 12; y <= 52; y += 8) for (let x = 14; x <= 62; x += 8) {
      if (Math.abs(x - cx) < 5 && Math.abs(y - cy) < 5) continue;
      if (Math.abs(x - cx) < 4 && y > 48) continue;                                                              // เว้นทางเข้าจากทางเดิน
      over[`${x},${y}`] = T.WALL;
    }
    for (let y = 1; y < 58; y++) for (let x = 67; x < 75; x++) g[y][x] = 3;                                         // คลอง
    for (let y = 30; y <= 33; y++) g[y][66] = 0;                                                                  // ท่าน้ำ
    for (let y = 4; y < 58; y += 7) small('p_rowboat', 71, y, { scale: 0.9 });
    for (const [x, y] of [[12, 10], [64, 10], [12, 54], [64, 54]]) obj('jar', n <= 2 ? Math.round((x + cx) / 2) : x, n <= 2 ? Math.round((y + cy) / 2) : y);   // คนน้อย = โอ่งเกิดใกล้ขึ้น
    for (const [x, y] of [[12, 10], [64, 10], [12, 54], [64, 54]]) small('p_jar', x, y, { scale: 1.6, tint: 0x9fd8ff, glow: [-6, 40, 0x8fd0ff, 1.0], jar: true });
    for (const [x, y] of [[22, 20], [54, 20], [22, 44], [54, 44], [cx, 14]]) small('p_lantern', x, y, { glow: [-18, 50, 0xffcf7a, 0.8] });
    for (let i = 0; i < 14; i++) small(R() < 0.5 ? 'p_pots' : 'p_firewood', 11 + Math.floor(R() * 55), 9 + Math.floor(R() * 46), { scale: 0.8, tint: 0x8a7a6a });
  } else if (boss === 'pob') {
    // โบสถ์ร้างผนังพังกลางลาน (ชน) · หลุมศพ/เจดีย์อัฐิ · จุดหวายเสก 3 จุด · ป่าทึบปิดขอบ
    const wall = (x0, y0, w, h) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) over[`${x},${y}`] = T.WALL; };
    wall(cx - 8, cy - 10, 6, 1); wall(cx + 3, cy - 10, 6, 1); wall(cx - 8, cy - 10, 1, 9); wall(cx + 8, cy - 10, 1, 5); wall(cx + 8, cy - 2, 1, 3); wall(cx - 8, cy + 2, 4, 1); wall(cx + 4, cy + 2, 5, 1);
    P('env/p_buddha2', cx, cy - 8, { scale: 0.5, tint: 0x8a8070, glow: [-30, 50, Z.glow, 0.4] });
    for (const [dx, dy] of [[-6, -4], [6, -4], [-3, 0], [5, 0]]) small('p_ruin2', cx + dx, cy + dy, { scale: 0.9, tint: 0x8a8070 });
    for (let i = 0; i < 26; i++) {
      const a = R() * Math.PI * 2, r = 12 + R() * 11, x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r * 0.9);
      if ((Math.abs(x - cx) < 10 && y > cy - 12 && y < cy + 4) || y > cy + rad - 6) continue;
      small(R() < 0.35 ? 'p_stonelantern' : R() < 0.5 ? 'p_ruin' : 'p_spirit', x, y, { scale: 0.75, tint: 0x9a96a4 });
    }
    for (const [dx, dy] of [[-18, -6], [18, -6], [0, 16]]) obj('rattan', cx + dx, cy + dy + 1);
    for (const [dx, dy] of [[-18, -6], [18, -6], [0, 16]]) small('p_bamboo2', cx + dx, cy + dy, { scale: 0.7, tint: 0xd8b070, glow: [-10, 40, 0xe8c38a, 1.0], rattan: true });
    edge((x, y) => P(`env/${R() < 0.5 ? 't_tamarind' : 'o_banyan'}`, x, y, { scale: 0.45 + R() * 0.25, tint: 0x6f8a6a }), 80, rad, rad + 6);
    for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; if (Math.abs(a - Math.PI / 2) < 0.3) continue; small('p_torch', Math.round(cx + Math.cos(a) * (rad - 1.5)), Math.round(cy + Math.sin(a) * (rad - 1.5)), { glow: [-22, 46, Z.glow, 0.9] }); }
  }
  const ground = g.map((row, y) => row.map((v, x) => {
    if (v === 3) return (x + y) % 3 ? T.WATER : T.WATER2;
    if (v === 1) return y + 1 < H && g[y + 1][x] !== 1 && g[y + 1][x] !== 3 ? T.WALL : T.WALLTOP;                   // ผนังที่มีพื้นอยู่ใต้ = หน้าผนัง
    return over[`${x},${y}`] ?? (v === 2 ? Z.path : Z.floor);
  }));

  // หลักไม้ (ผีตายโหง) · ไทล์ไม่ชน
  const posts = boss === 'hung' ? postTiles(n, cx, cy).map((p) => ({ x: p.x * TILE + TILE / 2, y: p.y * TILE + TILE / 2 })) : [];
  for (const p of posts) props.push({ key: 'env/p_lanternpole', x: p.x, y: p.y, foot: [0, 0], scale: 0.62, glow: [-30, 30, 0xfff1c0, 0.35], post: true });
  // บอส · บริวาร 2 ฝูงตามทางเดิน (ฝูงละ 2–4 ตามคน)
  spawns.push({ id: gdBossMob(boss, diff, n), x: cx * TILE + TILE / 2, y: (cy - 1) * TILE, r: TILE, boss: true });
  if (boss === 'hung') for (const part of GD_SPLIT.parts) spawns.push({ id: gdPartMob(boss, diff, n, part), x: cx * TILE + TILE / 2, y: (cy - 1) * TILE, r: TILE, part });   // ร่างเละ (หลับไว้จนบอสใช้ท่า)
  const per = 2 + Math.floor((n - 1) / 2), mob = gdMinionMob(boss, diff, n);
  const adds = { krasue: 4, pob: 6 }[boss] || 0;                                                                       // ผีเสริม (หลับไว้ · ท่าบอส/โลงผิดเป็นคนปลุก)
  for (let i = 0; i < adds; i++) spawns.push({ id: mob, x: cx * TILE + TILE / 2, y: cy * TILE, r: TILE, add: true });
  for (const ty of [cy + rad + 1, cy + rad + 6]) for (let j = 0; j < per; j++) spawns.push({ id: mob, x: cx * TILE + TILE / 2, y: ty * TILE, r: TILE * 1.5 });
  // ค่ายพัก: กองไฟ + ทางออก
  const spawn = { x: cx * TILE + TILE / 2, y: (H - 5) * TILE };
  small('p_campfire', cx + 4, H - 5, { scale: 1.1, glow: [-10, 70, 0xff8a3c, 1.1] });
  portals.push({ to: 'gd_exit', x: (cx - 5) * TILE + TILE / 2, y: (H - 4) * TILE, r: 20 });

  const solid = ground.map((row) => row.map((t) => SOLID.has(t)));
  const labels = [[cx, H - 11, `☠ ${GD_BOSSES[boss].nameTh} · ${GD_DIFFS[diff].th}`]];
  return { ground, solid, props, npcs: [], spawns, portals, labels, spawn, posts, objs, arena: { x: cx * TILE + TILE / 2, y: cy * TILE + TILE / 2, r: (rad - 3.5) * TILE }, safe: { x: cx, y: H - 6, r: 6 } };
}

const layouts = {};
export const gdLayout = (boss, diff, n) => (layouts[`${boss}:${diff}:${n}`] ||= build(boss, diff, n));

const entries = {};
/** รายการแมพ (รูปแบบเดียวกับ TD_MAPS) ของรหัส gd:<บอส>:<ระดับ>:<คน>:<ห้อง> · null = รหัสผิด */
export function gdMap(id) {
  if (entries[id]) return entries[id];
  const c = parseGd(id);
  if (!c) return null;
  const { boss, diff, n } = c, L = gdLayout(boss, diff, n), B = GD_BOSSES[boss], D = GD_DIFFS[diff], Z = STYLE[boss] || STYLE.hung;
  const W = L.ground[0].length, H = L.ground.length;
  const zoneAtTile = (tx, ty) => (Math.hypot(tx - L.safe.x, ty - L.safe.y) <= L.safe.r ? 'hub' : 'lair');
  const M = {
    id, nameTh: `${B.nameTh} · ${D.th}`, icon: '☠️', lv: [D.lv, D.lv], reqLv: D.req, W, H, color: B.color,
    sub: `ดันเจี้ยนสี่ผีป่าช้า · ${Z.name} · Lv.${D.lv}${n > 1 ? ` · ปาร์ตี้ ${n} คน` : ''}`,
    music: 'ayt_night', noFish: true, realm: true, gd: c,
    style: { overlay: Z.overlay, wallAs: 'stone', water: 'rgba(30,60,90,0.8)', waterTint: 0x4a7aa0 },
    spawn: { ...L.spawn },
    ZONES: { hub: { nameTh: 'ค่ายพักหน้าลาน', sub: `Safe Zone · ${B.nameTh}`, color: '#f7dc6f' }, lair: { nameTh: `${Z.name} · ${B.nameTh}`, sub: `${D.th} · Lv.${D.lv}`, color: B.color } },
    zoneAtTile,
    zoneAt: (x, y) => zoneAtTile(Math.floor(x / TILE), Math.floor(y / TILE)),
    inSafe: (x, y) => zoneAtTile(Math.floor(x / TILE), Math.floor(y / TILE)) === 'hub',
    layout: () => L,
  };
  const keys = Object.keys(entries);
  if (keys.length > 200) delete entries[keys[0]];
  return (entries[id] = M);
}
