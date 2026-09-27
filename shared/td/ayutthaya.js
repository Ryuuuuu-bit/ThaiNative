// ============================================================
//  ผังเมือง "กรุงศรีอยุธยา" (New Version top-down) – ใช้ร่วม client/server
//  ▸ ข้อมูลล้วน (ไม่มี canvas) → server ใช้ตารางชน/จุดเกิดผี/ตำแหน่ง NPC ชุดเดียวกับ client
// ============================================================
export const TILE = 16;
export const MAP_W = 120, MAP_H = 140;

// ดัชนีไทล์
export const T = { GRASS: 0, GRASS2: 1, GRASS3: 2, ROAD: 3, BRICK: 4, SAND: 5, WATER: 6, WATER2: 7, WALL: 8, PADDY: 9, STONE: 10, TALL: 11, WOOD: 12, WALLTOP: 13 };
export const SOLID = new Set([T.WATER, T.WATER2, T.WALL, T.WALLTOP]);

// ---- ผังเกาะเมือง (แบบเมือง RO: เกาะแปดเหลี่ยม คูน้ำรอบ ประตู 3 ทิศ ถนนแผ่จากลานน้ำพุกลางเมือง) ----
export const CENTER = { x: 60, y: 50 };
const ISLE = { rx: 44, ry: 40, d: 68 }, MOAT = { rx: 50, ry: 46, d: 78 };
/** ไทล์ (tx,ty) อยู่บนเกาะเมืองไหม */
export const isIsland = (tx, ty) => { const dx = Math.abs(tx - CENTER.x), dy = Math.abs(ty - CENTER.y); return dx <= ISLE.rx && dy <= ISLE.ry && dx + dy <= ISLE.d; };
const isMoat = (tx, ty) => { const dx = Math.abs(tx - CENTER.x), dy = Math.abs(ty - CENTER.y); return !isIsland(tx, ty) && dx <= MOAT.rx && dy <= MOAT.ry && dx + dy <= MOAT.d; };
/** พิกัดพิกเซลอยู่ในเขตเมือง (Safe Zone) ไหม – ใช้ร่วม client/server */
export const inTownXY = (x, y) => isIsland(Math.floor(x / TILE), Math.floor(y / TILE));
export const SPAWN = { x: 60 * TILE, y: 58 * TILE };
export const GATES = { south: { x0: 58, x1: 61 }, west: { y0: 48, y1: 51 }, east: { y0: 48, y1: 51 } };

let seed = 1234;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/**
 * ผังเมือง: คืน { ground: number[][], solid: boolean[][], props: [...], npcs: [...], spawns: [...] }
 */
export function buildLayout() {
  seed = 1234;
  const ground = Array.from({ length: MAP_H }, () => new Array(MAP_W).fill(T.GRASS));
  const inMap = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
  const set = (x, y, t) => { if (inMap(x, y)) ground[y][x] = t; };
  const get = (x, y) => (inMap(x, y) ? ground[y][x] : null);
  const rect = (x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, t); };
  const disc = (cx, cy, r, t, r0 = -1) => { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) { const d = Math.hypot(x - cx, y - cy); if (d <= r && d > r0) set(x, y, t); } };
  const line = (x0, y0, x1, y1, w, t) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2); for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n; rect(Math.round(x - w / 2), Math.round(y - w / 2), Math.round(x - w / 2) + w - 1, Math.round(y - w / 2) + w - 1, t); } };

  // หญ้าสุ่ม
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) { const r = rnd(); ground[y][x] = r < 0.08 ? T.GRASS2 : r < 0.18 ? T.GRASS3 : T.GRASS; }
  const isGrass = (t) => t === T.GRASS || t === T.GRASS2 || t === T.GRASS3;

  // ---- คูเมือง + ตลิ่งทราย + แม่น้ำเจ้าพระยาด้านล่าง ----
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (isMoat(x, y)) set(x, y, rnd() < 0.5 ? T.WATER : T.WATER2);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (isMoat(x, y) || isIsland(x, y)) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isMoat(x + dx, y + dy))) set(x, y, T.SAND);
  }
  // ---- กำแพงเมือง (แถบ 2 ไทล์ตามขอบเกาะ) ----
  const wallBand = (x, y) => isIsland(x, y) && [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, 1], [-1, 1], [1, -1], [-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => !isIsland(x + dx, y + dy));
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (wallBand(x, y)) set(x, y, wallBand(x, y + 1) ? T.WALLTOP : T.WALL);
  // ---- ถนนหลวงปูหิน: เหนือ–ใต้ / ตะวันตก–ตะวันออก + ถนนทแยงจากลานกลางเมือง ----
  const C = CENTER;
  rect(58, 30, 61, 91, T.STONE); rect(14, 48, 106, 51, T.STONE);
  line(C.x, C.y, 36, 32, 3, T.STONE); line(C.x, C.y, 82, 32, 3, T.STONE); line(C.x, C.y, 32, 80, 3, T.STONE); line(C.x, C.y, 88, 80, 3, T.STONE);
  disc(C.x - 0.5, C.y - 0.5, 9.5, T.STONE); disc(C.x - 0.5, C.y - 0.5, 10.5, T.BRICK, 9.5);   // ลานน้ำพุ + ขอบอิฐ
  // ---- ประตู + สะพาน (ใต้ = ออกทุ่ง · ตะวันตก/ตะวันออก = ทางออกเมืองอื่นในอนาคต) ----
  rect(58, 86, 61, 97, T.WOOD); rect(58, 91, 61, 91, T.STONE);                       // ประตูใต้ + สะพาน
  rect(8, 48, 18, 51, T.WOOD); rect(101, 48, 111, 51, T.WOOD);                       // ประตูตะวันตก/ตะวันออก
  rect(58, 98, 61, 134, T.ROAD); rect(0, 48, 7, 51, T.ROAD); rect(112, 48, 119, 51, T.ROAD);
  // ---- โซนในเมือง ----
  // ตะวันตกเฉียงเหนือ: วัดไชยวัฒนาราม (ระเบียงคดศิลาแลง + สนามหญ้า + ฐานประธาน)
  rect(23, 17, 43, 17, T.BRICK); rect(23, 35, 43, 35, T.BRICK); rect(23, 17, 23, 35, T.BRICK); rect(43, 17, 43, 35, T.BRICK); rect(28, 22, 38, 30, T.BRICK);
  // เหนือ: พระราชวังหลวง (ลานหิน)
  rect(47, 14, 72, 29, T.STONE); rect(47, 14, 72, 14, T.BRICK);
  // ตะวันออกเฉียงเหนือ: วัดพระศรีสรรเพชญ์ (ฐานศิลาแลงใต้เจดีย์ทอง 3 องค์)
  rect(76, 22, 97, 29, T.BRICK); rect(84, 30, 86, 33, T.BRICK);
  // ตะวันตก: สำนักดาบ/มวย/พราน (ลานทรายฝึก)
  rect(21, 53, 40, 62, T.SAND); rect(22, 39, 38, 45, T.SAND);
  // ตะวันออก: ย่านช่างเหล็กน้ำพี้ (ลานหิน)
  rect(84, 53, 100, 61, T.STONE);
  // ใต้: ตลาดใหญ่ (ลานหิน)
  rect(45, 63, 74, 80, T.STONE);

  // ---- นอกเมือง: ทุ่งนาบางปะอิน / หญ้าสูง (ผีชุม) ----
  rect(8, 104, 44, 120, T.PADDY); rect(76, 104, 112, 120, T.PADDY);
  rect(8, 126, 50, 137, T.TALL); rect(70, 126, 112, 137, T.TALL);

  // ---- ของประกอบฉาก (x,y = พิกัดไทล์ของ "เท้า" ของ, foot = ขนาดชนกัน w×h ไทล์) ----
  //  key 'env/…' = ภาพ PixelLab (assets/td/env) · alt = ภาพสำรองถ้ายังไม่มีไฟล์ · glow = แสงกลางคืน [dy, รัศมี, สี, ความแรง]
  const props = [];
  const P = (key, tx, ty, opt = {}) => props.push({ key, x: tx * TILE, y: ty * TILE, ...opt });
  const LAMP = [-26, 40, 0xffc46b, 1], TORCH = [-22, 46, 0xff9a3c, 1.1], WIN = [-30, 30, 0xffd27a, 0.8];
  const TREE_K = { tamarind: 0.8, palm: 0.72, golden: 0.72, bamboo: 0.62, pink: 0.72 };
  const tree = (tx, ty, kind = 'tamarind', sc = 1) => {
    const alt = kind === 'pink' ? 'env/t_golden' : kind === 'palm' ? 'td_palm' : 'td_tree';
    P(`env/t_${kind}`, tx, ty, { foot: [1, 1], alt, scale: sc * TREE_K[kind], altScale: kind === 'pink' ? sc * 0.72 : 1.4 * sc, flip: rnd() < 0.5 });
  };
  const VAR = new Set(['torch', 'fence', 'pots', 'cart', 'haystack', 'bamboo', 'frangipani', 'lotus', 'buddha', 'ruin', 'buddhahead', 'bench', 'shrub', 'well']);
  const vk = (key) => (VAR.has(key.slice(2)) && rnd() < 0.5 ? key + '2' : key);   // สุ่มแบบที่ 2 (ผังคงที่เพราะ seed ตายตัว)
  const BASE = { p_stall: 1.5, p_bamboo: 1.5, p_haystack: 1.3, p_well: 1.2, p_cart: 1.1, p_lantern: 1.1, p_torch: 1.1, p_tent: 1.6, p_banner: 1.3, p_lanternpole: 1.3 };
  // ของชิ้นเล็ก (ภาพ 48px) ย่อ 0.6 ให้สมส่วนกับตัวละคร · scale ใน opt = ตัวคูณเพิ่ม
  const mini = (foot) => (key, tx, ty, opt = {}) => {
    const sc = 0.6 * (BASE[key.replace(/_(red|blue|green|yellow|purple)$/, '')] || BASE[key] || 1) * (opt.scale || 1);
    return P(`env/${vk(key)}`, tx, ty, { foot, ...opt, scale: sc, altScale: opt.alt?.startsWith('env/') ? sc : opt.scale || 1 });
  };
  const small = mini([1, 1]), deco = mini([0, 0]);   // deco = เดินผ่านได้

  // ตารางจองพื้นที่ (กันบ้าน/ต้นไม้วางทับถนน ลาน และสถานที่สำคัญ)
  const occ = ground.map((row) => row.map((t) => !isGrass(t)));
  const reserve = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inMap(x, y)) occ[y][x] = true; };
  const free = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!inMap(x, y) || occ[y][x] || !isIsland(x, y)) return false; return true; };

  // === ลานน้ำพุกลางเมือง (จุดนัดพบแบบ RO) ===
  P('env/b_fountain', C.x, C.y + 3, { foot: [5, 3], scale: 1.6, alt: 'env/p_lotus', altScale: 1.9, label: 'น้ำพุนาคราช', glow: [-30, 60, 0xa8e0ff, 0.6] });
  for (const [dx, dy] of [[-7, -5], [7, -5], [-7, 6], [7, 6]]) small('p_lanternpole', C.x + dx, C.y + dy, { glow: LAMP, alt: 'env/p_lantern' });
  for (const [dx, dy] of [[-4, -8], [4, -8]]) deco('p_frangipani', C.x + dx, C.y + dy);
  P('spirit_house', 53, 45, { foot: [2, 1], label: 'ศาลหลักเมือง', glow: [-20, 30, 0xffd27a, 0.6] });
  for (const [dx, dy] of [[-9, -1], [9, -1], [-9, 4], [9, 4]]) small('p_bench', C.x + dx, C.y + dy);
  for (let y = C.y - 12; y <= C.y + 12; y++) for (let x = C.x - 12; x <= C.x + 12; x++) if (Math.hypot(x - C.x + 0.5, y - C.y + 0.5) <= 11.5) reserve(x, y, x, y);

  // === พระราชวังหลวง (เหนือ) ===
  P('env/b_thronehall', 60, 22, { foot: [8, 4], scale: 1.45, alt: 'env/b_viharn', altScale: 1.45, label: 'พระที่นั่งสรรเพชญ์ปราสาท', glow: [-50, 100, 0xffe1a0, 0.8] });
  P('env/b_palacegate', 60, 30, { foot: [6, 2], scale: 1.0, alt: 'env/b_ubosot', altScale: 0.9, label: 'ประตูพระราชวัง', glow: [-40, 60, 0xffe1a0, 0.6] });
  for (const x of [50, 55, 65, 70]) { small('p_banner', x, 29, { alt: 'env/p_lantern' }); }
  for (const x of [49, 71]) { small('p_lion', x, 24, { scale: 1.3, flip: x > 60 }); tree(x, 18, 'pink', 1); }
  small('p_torch', 56, 31, { glow: TORCH }); small('p_torch', 64, 31, { glow: TORCH });
  reserve(45, 10, 75, 32);

  // === วัดไชยวัฒนาราม (ตะวันตกเฉียงเหนือ) ===
  P('env/m_prangbig_l', 33, 29, { foot: [6, 3], scale: 1.55, alt: 'env/m_prangbig', label: 'วัดไชยวัฒนาราม', glow: [-80, 110, 0xffe1a0, 0.7] });
  for (const [x, y, sc] of [[26, 21, 0.9], [40, 21, 0.9], [26, 33, 1], [40, 33, 1], [26, 27, 0.8], [40, 27, 0.8], [33, 20, 0.7]]) P('env/b_prang_l', x, y, { foot: [2, 2], scale: sc, alt: 'env/b_prang', flip: x > 33 });
  for (let x = 25; x <= 41; x += 3) if (x < 31 || x > 35) P('td_ruin', x, 18, { foot: [3, 1], scale: 1.2 });
  for (let x = 24; x <= 42; x += 3) if (x < 31 || x > 36) P('td_ruin', x, 36, { foot: [3, 1], scale: 1.2 });
  for (let x = 28; x <= 38; x += 2) small('p_buddha', x, 19, { glow: [-8, 14, 0xffe9a0, 0.3] });
  small('p_torch', 31, 37, { glow: TORCH }); small('p_torch', 35, 37, { glow: TORCH });
  reserve(21, 14, 45, 38);

  // === วัดพระศรีสรรเพชญ์ (ตะวันออกเฉียงเหนือ): เจดีย์ทอง 3 องค์ ===
  for (const [x, y, sc] of [[79, 28, 1.1], [86, 27, 1.3], [93, 28, 1.1]]) P('env/b_goldchedi', x, y, { foot: [5, 3], scale: sc, alt: 'env/m_chedi_l', altScale: sc * 1.2, glow: [-60, 70, 0xfff0c0, 0.6] });
  for (let x = 77; x <= 96; x += 2) if (x < 83 || x > 89) small('p_buddha', x, 31, { glow: [-8, 14, 0xffe9a0, 0.3] });
  small('p_lion', 83, 33, { scale: 1.2 }); small('p_lion', 88, 33, { scale: 1.2, flip: true });
  P('env/b_ubosot', 90, 42, { foot: [7, 3], scale: 1.0, flip: true, label: 'พระอุโบสถ', glow: [-40, 70, 0xffe1a0, 0.6] });
  small('p_drum', 81, 40, { scale: 1.2 }); small('p_gong', 83, 44);
  reserve(74, 18, 99, 35); reserve(85, 36, 96, 44); reserve(79, 38, 85, 45);

  // === ตะวันตก: สำนักดาบ ค่ายมวย ลานยิงธนู ===
  P('env/b_sala', 30, 53, { foot: [6, 3], scale: 1.0, alt: 'sala', altScale: 1, label: 'สำนักดาบ & ค่ายมวยโบราณ', glow: [-30, 60, 0xffe1a0, 0.6] });
  for (const [x, y] of [[24, 58], [26, 61], [35, 58], [37, 61]]) small('p_haystack', x, y, { scale: 0.9 });   // หุ่นฟางซ้อม
  for (const x of [23, 27, 31, 35]) small('p_haystack', x, 40);                                               // เป้าธนู
  small('p_banner', 21, 53, { alt: 'env/p_lantern' }); small('p_banner', 40, 53, { alt: 'env/p_lantern' });
  small('p_torch', 22, 62, { glow: TORCH }); small('p_torch', 39, 62, { glow: TORCH });
  reserve(19, 51, 42, 64); reserve(20, 37, 40, 46);

  // === ตะวันออก: ย่านช่างเหล็กน้ำพี้ ===
  P('forge', 92, 57, { foot: [5, 2], label: 'เตาตีเหล็กน้ำพี้', glow: [-20, 60, 0xff8a3c, 1] });
  small('p_cart', 86, 55); small('p_pots', 98, 55); small('p_rice', 87, 60, { alt: 'env/p_pots' }); small('p_sign', 99, 60, { alt: 'env/p_bench' });
  small('p_torch', 85, 58, { glow: TORCH }); small('p_torch', 100, 58, { glow: TORCH });
  P('env/b_wat2', 94, 68, { foot: [7, 3], scale: 0.9, label: 'วิหารไม้', glow: [-40, 60, 0xffe1a0, 0.5] });
  reserve(82, 52, 102, 62); reserve(89, 63, 99, 69);

  // === ตลาดใหญ่ (ใต้): เต็นท์ผ้าหลากสี แถวละ 5 ===
  const TENTS = ['red', 'blue', 'green', 'yellow', 'purple'];
  for (const [row, y] of [[0, 66], [1, 71], [2, 76]]) for (let i = 0; i < 6; i++) {
    const x = 47 + i * 5 + (i >= 3 ? 1 : 0); if (x >= 56 && x <= 63) continue;
    small(`p_tent_${TENTS[(i + row * 2) % 5]}`, x, y, { alt: 'env/p_stall', glow: [-14, 30, 0xffb35c, 0.8] });
  }
  for (const [x, y] of [[49, 68], [67, 68], [52, 73], [70, 73], [49, 78], [67, 78]]) small(['p_fruit', 'p_baskets', 'p_pottery', 'p_silk', 'p_flowercart', 'p_teatable'][(x + y) % 6], x, y, { alt: 'env/p_pots' });
  P('stall', 46, 81, { foot: [6, 1], label: 'ตลาดหัวรอ', glow: [-20, 40, 0xffb35c, 0.9] }); P('food_stall', 73, 81, { foot: [4, 1], glow: [-20, 40, 0xffb35c, 0.9] });
  for (const [x, y] of [[57, 64], [62, 64], [57, 79], [62, 79]]) small('p_lanternpole', x, y, { glow: LAMP, alt: 'env/p_lantern' });
  reserve(43, 61, 76, 83);
  // ประตูใต้
  small('p_lion', 56, 87, { scale: 1.2 }); small('p_lion', 63, 87, { scale: 1.2, flip: true });
  small('p_torch', 56, 85, { glow: TORCH }); small('p_torch', 63, 85, { glow: TORCH });
  P('bounty_board', 65, 84, { foot: [2, 1], label: 'ป้ายประกาศค่าหัว' });
  reserve(54, 83, 66, 92);
  // ประตูตะวันตก/ตะวันออก
  for (const [x, f] of [[20, false], [100, true]]) { small('p_torch', x, 46, { glow: TORCH }); small('p_torch', x, 53, { glow: TORCH }); small('p_lion', x + (f ? -2 : 2), 46, { scale: 1.1, flip: f }); }
  reserve(14, 44, 24, 55); reserve(96, 44, 106, 55);

  // === บ้านเรือนหนาแน่น (เติมช่องว่างที่เหลือในเกาะ) ===
  const HOUSE = [['env/b_ruenthai', 0.8], ['env/b_house2', 0.8], ['house', 0.85], ['env/b_rowhouses', 0.8], ['env/b_hamlet', 0.75], ['env/b_village', 0.75], ['env/b_ruenthai', 0.8]];
  for (let y = 22; y <= 88; y += 4) for (let x = 20; x <= 100; x += 2) {
    const hx = x, hy = y + (x % 2);
    if (!free(hx - 3, hy - 2, hx + 3, hy + 1)) continue;
    const [key, sc] = HOUSE[Math.floor(rnd() * HOUSE.length)];
    P(key, hx, hy, { foot: [5, 2], scale: sc, alt: 'env/b_ruenthai', altScale: 0.8, flip: rnd() < 0.5, glow: WIN });
    reserve(hx - 3, hy - 3, hx + 3, hy + 1);
    const r = rnd();
    if (r < 0.35) small('p_jar', hx + (rnd() < 0.5 ? -4 : 4), hy + 1); else if (r < 0.6) deco('p_frangipani', hx + 3, hy + 1); else if (r < 0.75) deco('p_plants', hx - 3, hy + 1);
  }
  // ต้นไม้/พุ่มไม้ในช่องว่างที่เหลือ (ไม่บังถนน)
  for (let y = 14; y <= 88; y += 3) for (let x = 18; x <= 102; x += 3) {
    const tx = x + Math.floor(rnd() * 2), ty = y + Math.floor(rnd() * 2);
    if (!free(tx - 1, ty - 2, tx + 1, ty)) continue;
    const r = rnd();
    if (r < 0.42) { tree(tx, ty, ['tamarind', 'pink', 'palm', 'golden', 'bamboo'][Math.floor(rnd() * 5)], 0.9); reserve(tx - 1, ty - 3, tx + 1, ty); }
    else if (r < 0.62) { deco(['p_shrub', 'p_frangipani', 'p_plants'][Math.floor(rnd() * 3)], tx, ty); reserve(tx, ty, tx, ty); }
  }

  // แปลงไม้ดอกริมถนนหลวง (แบบถนนเมือง RO)
  for (let y = 33; y <= 84; y += 3) for (const x of [56, 63]) if (free(x, y, x, y) && rnd() < 0.7) { deco(rnd() < 0.5 ? 'p_shrub' : 'p_frangipani', x, y); reserve(x, y, x, y); }
  for (let x = 20; x <= 100; x += 3) for (const y of [46, 53]) if (free(x, y, x, y) && rnd() < 0.7) { deco(rnd() < 0.5 ? 'p_shrub' : 'p_plants', x, y); reserve(x, y, x, y); }
  // ของจุกจิกในช่องว่างที่เหลือ (บ่อน้ำ เกวียน โอ่ง รั้ว)
  for (let y = 16; y <= 88; y += 2) for (let x = 18; x <= 102; x += 2) {
    if (!free(x - 1, y - 1, x + 1, y) || rnd() > 0.35) continue;
    const k = ['p_well', 'p_cart', 'p_pots', 'p_fence', 'p_jar', 'p_haystack', 'p_bench', 'p_bamboo'][Math.floor(rnd() * 8)];
    (k === 'p_fence' ? deco : small)(k, x, y); reserve(x - 1, y - 1, x + 1, y);
  }

  // === นอกเกาะ: ริมคูเมือง ท่าเรือ ต้นไม้ ===
  P('env/b_sala2', 67, 99, { foot: [5, 2], scale: 0.85, label: 'ท่าน้ำ', glow: [-30, 50, 0xffe1a0, 0.6] });
  for (const [x, y, f] of [[40, 94, 0], [80, 94, 1], [14, 60, 0], [106, 40, 1], [30, 8, 0], [90, 8, 1]]) P('boat', x, y, { foot: [0, 0], depth: 1, flip: !!f });
  small('p_torch', 56, 98, { glow: TORCH }); small('p_torch', 63, 98, { glow: TORCH });
  P('env/b_gatescene', 4, 47, { foot: [0, 0], scale: 0.85, label: 'ทางไปเพนียดคล้องช้าง (เร็ว ๆ นี้)' });
  P('env/b_gatescene2', 115, 47, { foot: [0, 0], scale: 0.85, flip: true, label: 'ทางไปค่ายบางระจัน (เร็ว ๆ นี้)' });
  for (let i = 0; i < 70; i++) {                                                    // ป่าไม้รอบนอกคูเมือง
    const x = Math.floor(rnd() * MAP_W), y = Math.floor(rnd() * 100);
    if (isIsland(x, y) || isMoat(x, y) || isMoat(x, y + 1) || !isGrass(get(x, y))) continue;
    const dx = Math.abs(x - C.x), dy = Math.abs(y - C.y); if (dx <= MOAT.rx + 1 && dy <= MOAT.ry + 1 && dx + dy <= MOAT.d + 2) continue;
    tree(x, y, ['tamarind', 'palm', 'bamboo', 'golden', 'palm'][i % 5], 1);
  }

  // === ทุ่งนาบางปะอิน (ต้นตาลริมคันนา · ฟาง · วัดร้าง) ===
  for (let x = 8; x <= 44; x += 5) tree(x, 103, 'palm', 1 + (x % 3) * 0.08);
  for (let x = 76; x <= 112; x += 5) tree(x, 103, 'palm', 1 + (x % 3) * 0.08);
  for (const [x, y] of [[16, 110], [30, 116], [40, 108], [82, 112], [96, 118], [106, 108]]) small('p_haystack', x, y);
  P('campfire', 60, 112, { foot: [1, 1], label: 'ค่ายพัก', glow: [-10, 80, 0xff8a3c, 1.3] });
  small('p_torch', 57, 110, { glow: TORCH }); small('p_torch', 63, 110, { glow: TORCH }); small('p_cart', 64, 114); small('p_haystack', 56, 115);
  small('p_spirit', 52, 102, { label: 'ศาลตายาย' });
  P('env/m_mondop', 70, 122, { foot: [6, 3], label: 'มณฑปร้าง' });
  P('env/b_chediruin', 30, 131, { foot: [6, 2], label: 'วัดร้าง' }); P('env/b_chediruin', 92, 133, { foot: [6, 2], flip: true });
  for (const [x, y] of [[20, 128], [38, 127], [44, 134], [84, 128], [100, 130], [106, 136]]) small('p_ruin', x, y, { scale: 1.2, alt: 'td_ruin' });
  deco('p_buddhahead', 34, 134, { scale: 1.2 }); small('p_buddha', 96, 136);
  P('env/b_village', 4, 116, { foot: [6, 2], glow: WIN }); P('env/b_hamlet', 115, 116, { foot: [6, 2], glow: WIN });
  [[6, 124], [114, 124], [54, 128], [66, 132], [50, 106], [70, 106], [4, 136], [116, 136], [48, 122], [74, 128]]
    .forEach(([x, y], i) => tree(x, y, ['tamarind', 'golden', 'bamboo', 'tamarind', 'pink'][i % 5], 1.1));

  // ---- NPC ----
  // id = รหัส NPC บริการเดียวกับ shared/data/npcs.js (server ใช้ตรวจว่ายืนใกล้ร้านจริงไหม)
  const npcs = [
    { id: 'shop',      key: 'npc_yai_tim',    x: 52, y: 68, nameTh: 'ยายติ๋ม', role: 'ร้านยา·ของใช้', color: '#82e0aa', lines: ['ยาดองยาต้มมีครบ ซื้อติดตัวก่อนออกนอกกำแพงนะหนู', 'ตลาดหัวรอนี่คึกคักตั้งแต่สมัยพระนารายณ์แล้ว'] },
    { id: 'quest',     key: 'npc_lung_chai',  x: 64, y: 56, nameTh: 'ผู้ใหญ่ชัย', role: 'เควส', color: '#f7dc6f', lines: ['เจดีย์ทองสามองค์ทางตะวันออกเฉียงเหนือบรรจุพระบรมอัฐิกษัตริย์สามพระองค์ ห้ามปีนเด็ดขาด', 'ผีทุ่งข้างนอกกำแพงชุมขึ้นทุกคืน ช่วยไปปราบทีเถอะ'] },
    { id: 'smith',     key: 'npc_lung_dam',   x: 95, y: 62, nameTh: 'ลุงดำ', role: 'ตีเหล็ก·หลอมอุปกรณ์', color: '#f5b041', lines: ['เหล็กน้ำพี้ตีดาบดีที่สุดในแผ่นดิน', 'เอาของมาตีบวกได้ แต่ถ้าแตกอย่ามาโทษลุงนะ'] },
    { id: 'tailor',    key: 'npc_mae_choy',   x: 68, y: 68, nameTh: 'แม่ช้อย', role: 'ชุดแต่งตัว·ย้อมสี', color: '#f5b7b1', lines: ['ผ้าไหมจากเมืองจีนเพิ่งมากับเรือสำเภาเมื่อวาน', 'อยากเปลี่ยนสีผมไหมจ๊ะ แม่ย้อมให้'] },
    { id: 'cook',      key: 'npc_pa_sa',      x: 64, y: 101, nameTh: 'ป้าสา', role: 'ครัว·ท่าน้ำ', color: '#85c1e9', lines: ['แม่น้ำสายนี้ไหลอ้อมเกาะเมืองทั้งเกาะ เรือสำเภาจากเมืองจีนจอดแถวนี้แหละ', 'อยากได้ปลาต้มเค็มไหม ป้าเพิ่งได้ปลาจากเรือมา'] },
    { id: 'kru_sword', key: 'npc_kru_sword',  x: 28, y: 57, nameTh: 'ครูเหม', role: 'สำนักดาบ', color: '#f1948a', lines: ['ออกประตูใต้ ข้ามสะพานคูเมืองแล้วจะเจอทุ่งนา ระวังกุมารทองซุกซน', 'คลิกที่พื้นเพื่อเดิน คลิกที่ผีเพื่อโจมตี จำไว้!'] },
    { id: 'kru_mage',  key: 'npc_kru_mage',   x: 38, y: 40, nameTh: 'หลวงตาเผือก', role: 'หมอธรรม·อาคม', color: '#bb8fce', lines: ['คาถาอาคมต้องฝึกทุกวัน ใจต้องนิ่ง', 'ผีกระสือกลัวหนามพุทรานะ จำไว้'] },
    { id: 'kru_archer',key: 'npc_kru_archer', x: 30, y: 44, nameTh: 'พรานแก้ว', role: 'ค่ายพรานไพร', color: '#82e0aa', lines: ['ธนูไม้ไผ่ของข้ายิงไกลกว่าใครในกรุง', 'ยิงจากระยะไกล อย่าให้ผีเข้าประชิด'] },
    { id: 'kru_boxer', key: 'npc_kru_boxer',  x: 34, y: 57, nameTh: 'ครูแดง', role: 'ค่ายมวย', color: '#f5b041', lines: ['มวยไทยคือศิลปะแม่ไม้ของบรรพบุรุษ', 'หมัด ศอก เข่า เท้า ใช้ให้ครบ!'] },
].map((n) => ({ ...n, x: n.x * TILE, y: n.y * TILE }));

  // ---- จุดเกิดผี (ทุ่งนอกประตูใต้) ----
  const spawns = [];
  const S = (id, tx, ty, r = 4) => spawns.push({ id, x: tx * TILE, y: ty * TILE, r: r * TILE });
  [[40, 108], [50, 114], [70, 110], [78, 116], [56, 122]].forEach(([x, y]) => S('phi_tuay_kaew', x, y));
  [[22, 128], [32, 133], [44, 126], [26, 118]].forEach(([x, y]) => S('kuman_thong', x, y));
  [[86, 128], [98, 132], [104, 122]].forEach(([x, y]) => S('nang_tani', x, y, 3));

  // ---- ตารางชน ----
  const solid = ground.map((row) => row.map((t) => SOLID.has(t)));
  for (const p of props) { const [fw, fh] = p.foot || [0, 0]; if (!fw) continue; const tx = Math.round(p.x / TILE) - Math.floor(fw / 2), ty = Math.round(p.y / TILE) - fh; for (let y = ty; y < ty + fh; y++) for (let x = tx; x < tx + fw; x++) if (solid[y]?.[x] !== undefined) solid[y][x] = true; }
  return { ground, solid, props, npcs, spawns };
}
