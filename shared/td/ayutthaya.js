// ============================================================
//  ผังเมือง "กรุงศรีอยุธยา" (New Version top-down) – ใช้ร่วม client/server
//  ▸ ข้อมูลล้วน (ไม่มี canvas) → server ใช้ตารางชน/จุดเกิดผี/ตำแหน่ง NPC ชุดเดียวกับ client
// ============================================================
export const TILE = 16;
/** ผังเดิม (เกาะเมือง + ทุ่งนา) 120×140 ไทล์ วางที่ OX · ซ้าย = ป่าไผ่ · ขวา = ป่าช้าวัดร้าง · ล่าง = บึงผีพราย */
export const OX = 56;
const LW = 120, LH = 140;
export const MAP_W = OX + LW + 56, MAP_H = LH + 60;          // 232 × 200

// ดัชนีไทล์
export const T = { GRASS: 0, GRASS2: 1, GRASS3: 2, ROAD: 3, BRICK: 4, SAND: 5, WATER: 6, WATER2: 7, WALL: 8, PADDY: 9, STONE: 10, TALL: 11, WOOD: 12, WALLTOP: 13 };
export const SOLID = new Set([T.WATER, T.WATER2, T.WALL, T.WALLTOP]);

// ---- ผังเกาะเมือง (แบบเมือง RO: เกาะแปดเหลี่ยม คูน้ำรอบ ประตู 3 ทิศ ถนนแผ่จากลานน้ำพุกลางเมือง) ----
const LC = { x: 60, y: 50 };                                  // ศูนย์กลางเมือง (พิกัดท้องถิ่นของผังเดิม)
export const CENTER = { x: LC.x + OX, y: LC.y };
const ISLE = { rx: 44, ry: 40, d: 68 }, MOAT = { rx: 50, ry: 46, d: 78 };
/** ไทล์ (tx,ty) อยู่บนเกาะเมืองไหม */
const isIslandL = (tx, ty) => { const dx = Math.abs(tx - LC.x), dy = Math.abs(ty - LC.y); return dx <= ISLE.rx && dy <= ISLE.ry && dx + dy <= ISLE.d; };
const isMoatL = (tx, ty) => { const dx = Math.abs(tx - LC.x), dy = Math.abs(ty - LC.y); return !isIslandL(tx, ty) && dx <= MOAT.rx && dy <= MOAT.ry && dx + dy <= MOAT.d; };
export const isIsland = (tx, ty) => isIslandL(tx - OX, ty);
/** พิกัดพิกเซลอยู่ในเขตเมือง (Safe Zone) ไหม – ใช้ร่วม client/server */
export const inTownXY = (x, y) => isIsland(Math.floor(x / TILE), Math.floor(y / TILE));
export const SPAWN = { x: (60 + OX) * TILE, y: 58 * TILE };
/** จุดเก็บเกี่ยวในทุ่งนอกเมือง (ช่องตาราง) · รวงข้าวในนา + สมุนไพรริมทุ่ง */
export const HERB_SPOTS = [
  [14, 106, 'rice_sheaf'], [24, 112, 'rice_sheaf'], [36, 107, 'rice_sheaf'], [30, 118, 'rice_sheaf'],
  [82, 108, 'rice_sheaf'], [94, 114, 'rice_sheaf'], [104, 111, 'rice_sheaf'], [100, 119, 'rice_sheaf'],
  [48, 126, 'herb_aloe'], [64, 130, 'herb_aloe'], [18, 124, 'herb_lemongrass'], [74, 124, 'herb_lemongrass'],
  [90, 126, 'herb_aloe'], [67, 114, 'herb_lemongrass'],
  // สมุนไพรหายาก (ใช้ปรุงยา/อาหารขั้นสูง) · พิกัดท้องถิ่น (ค่าติดลบ = ป่าไผ่ทางตะวันตก)
  [-20, 64, 'herb_bamboo'], [-34, 86, 'herb_bamboo'], [-20, 110, 'herb_bamboo'],
  [-20, 30, 'herb_honey'], [-32, 46, 'herb_honey'],
  [-36, 122, 'herb_mushroom'], [158, 100, 'herb_mushroom'], [130, 110, 'herb_mushroom'],
  [52, 108, 'herb_turmeric'], [66, 104, 'herb_turmeric'],
  [14, 160, 'herb_anchan'], [94, 175, 'herb_anchan'],
].map(([x, y, item], i) => ({ i, x: (x + OX) * TILE + 8, y: y * TILE + 8, item }));
export const GATES = { south: { x0: 58 + OX, x1: 61 + OX }, west: { y0: 48, y1: 51 }, east: { y0: 48, y1: 51 } };

let seed = 1234;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** ผังเมืองเดิม (พิกัดท้องถิ่น LW×LH) → { ground, props, npcs, spawns } */
function buildTown() {
  const MAP_W = LW, MAP_H = LH;                                  // (ชื่อเดิมในฟังก์ชันนี้ = ขนาดผังท้องถิ่น)
  const isIsland = isIslandL, isMoat = isMoatL;
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
    // (ตลิ่งทรายวาดจาก tileset น้ำ→หญ้าแล้ว)
  }
  // ---- กำแพงเมือง (แถบ 2 ไทล์ตามขอบเกาะ) ----
  const wallBand = (x, y) => isIsland(x, y) && [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, 1], [-1, 1], [1, -1], [-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => !isIsland(x + dx, y + dy));
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (wallBand(x, y)) set(x, y, wallBand(x, y + 1) ? T.WALLTOP : T.WALL);
  // ================= ผังเมืองใหม่ (รีโนเวท): ถนนตาราง + ย่านชัดเจน =================
  //  ถนนหลวง 2 สาย (เหนือ–ใต้ / ตะวันตก–ตะวันออก) · ถนนเลียบวัด (y37) · ถนนตลาด (y70) · ซอยดิน x40 / x80
  //  ย่าน: วัง(เหนือ) · วัด 2 แห่ง · สวนหลวง+สระบัว · สำนักฝึก(ตะวันตก) · ศาลาโอสถ · ช่างเหล็ก(ตะวันออก) · ตลาด(ใต้) · ชุมชนริมซอย
  const C = LC;
  rect(58, 30, 61, 91, T.STONE); rect(14, 48, 106, 51, T.STONE);                     // ถนนหลวง
  rect(24, 37, 96, 38, T.BRICK);                                                     // ถนนเลียบวัด (อิฐ)
  rect(24, 70, 96, 71, T.STONE);                                                     // ถนนตลาด
  rect(40, 38, 41, 84, T.ROAD); rect(79, 38, 80, 84, T.ROAD);                        // ซอยดินเหนือ–ใต้
  rect(26, 78, 57, 79, T.ROAD); rect(62, 78, 94, 79, T.ROAD);                        // ซอยชุมชนใต้
  disc(C.x - 0.5, C.y - 0.5, 8.5, T.STONE); disc(C.x - 0.5, C.y - 0.5, 9.5, T.BRICK, 8.5);   // ลานน้ำพุ + ขอบอิฐ
  // ประตู + สะพาน
  rect(58, 86, 61, 97, T.WOOD); rect(58, 91, 61, 91, T.STONE);
  rect(8, 48, 18, 51, T.WOOD); rect(101, 48, 111, 51, T.WOOD);
  rect(58, 98, 61, 134, T.ROAD); rect(0, 48, 7, 51, T.ROAD); rect(112, 48, 119, 51, T.ROAD);
  // ---- ย่านต่างๆ (พื้น) ----
  // วัดไชยวัฒนาราม (ระเบียงคดศิลาแลง)
  rect(23, 17, 43, 17, T.BRICK); rect(23, 35, 43, 35, T.BRICK); rect(23, 17, 23, 35, T.BRICK); rect(43, 17, 43, 35, T.BRICK); rect(28, 22, 38, 30, T.BRICK);
  // พระราชวังหลวง: ลานหิน + ขอบอิฐ
  rect(47, 14, 72, 29, T.STONE); rect(47, 14, 72, 14, T.BRICK); rect(47, 14, 47, 29, T.BRICK); rect(72, 14, 72, 29, T.BRICK);
  // วัดพระศรีสรรเพชญ์
  rect(76, 22, 97, 29, T.BRICK); rect(84, 30, 86, 36, T.BRICK);
  // สวนหลวง: สระบัว 2 สระ (ตะวันตก/ตะวันออกของลานน้ำพุ) + ทางเดินอิฐรอบสระ
  for (const cx of [45.5, 74.5]) { disc(cx, 43.5, 4.6, T.BRICK); disc(cx, 43.5, 3.4, T.WATER); }
  // สำนักฝึก (ตะวันตก): สนามประลองทราย + ลานยิงธนูยาว
  rect(21, 53, 37, 64, T.SAND); rect(22, 54, 36, 63, T.SAND);
  rect(24, 41, 38, 45, T.SAND);
  // ศาลาโอสถ: ลานอิฐ + แปลงสมุนไพร (หญ้าสูง = แปลงปลูก)
  rect(42, 53, 50, 64, T.BRICK); rect(43, 60, 49, 63, T.TALL);
  // ย่านช่างเหล็กน้ำพี้
  rect(84, 53, 100, 61, T.STONE);
  // ตลาดหัวรอ: ลานหินสองฝั่งถนนหลวง
  rect(45, 62, 57, 69, T.STONE); rect(62, 62, 75, 69, T.STONE);
  // ลานประตูใต้
  rect(52, 81, 67, 85, T.STONE);
  // ---- นอกเมือง: ทุ่งนาบางปะอิน / หญ้าสูง (ผีชุม) ----
  rect(8, 104, 44, 120, T.PADDY); rect(76, 104, 112, 120, T.PADDY);
  rect(8, 126, 50, 137, T.TALL); rect(70, 126, 112, 137, T.TALL);

  // ---- ของประกอบฉาก (x,y = พิกัดไทล์ของ "เท้า" ของ, foot = ขนาดชนกัน w×h ไทล์) ----
  //  key 'env/…' = ภาพ PixelLab (assets/td/env) · alt = ภาพสำรองถ้ายังไม่มีไฟล์ · glow = แสงกลางคืน [dy, รัศมี, สี, ความแรง]
  const props = [];
  const P = (key, tx, ty, opt = {}) => props.push({ key, x: tx * TILE, y: ty * TILE, ...opt });
  const LAMP = [-26, 40, 0xffc46b, 1], TORCH = [-22, 46, 0xff9a3c, 1.1], WIN = [-30, 30, 0xffd27a, 0.8];
  const TREE_K = { tamarind: 0.8, palm: 0.72, golden: 0.72, bamboo: 0.62, pink: 1.9 };
  const tree = (tx, ty, kind = 'tamarind', sc = 1) => {
    const alt = kind === 'pink' ? 'env/t_golden' : kind === 'palm' ? 'td_palm' : 'td_tree';
    P(`env/t_${kind}`, tx, ty, { foot: [1, 1], alt, scale: sc * TREE_K[kind], altScale: 1.4 * sc, flip: rnd() < 0.5 });
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
  P('env/p_spirit', 53, 45, { foot: [2, 1], scale: 1.1, alt: 'spirit_house', altScale: 1, label: 'ศาลหลักเมือง', glow: [-20, 30, 0xffd27a, 0.6] });
  for (const [dx, dy] of [[-9, -1], [9, -1], [-9, 4], [9, 4]]) small('p_bench', C.x + dx, C.y + dy);
  for (let y = C.y - 12; y <= C.y + 12; y++) for (let x = C.x - 12; x <= C.x + 12; x++) if (Math.hypot(x - C.x + 0.5, y - C.y + 0.5) <= 11.5) reserve(x, y, x, y);

  // === พระราชวังหลวง (เหนือ) ===
  P('env/b_thronehall', 60, 22, { foot: [8, 4], scale: 1.45, alt: 'env/b_viharn', altScale: 1.45, label: 'พระที่นั่งสรรเพชญ์ปราสาท', glow: [-50, 100, 0xffe1a0, 0.8] });
  P('env/b_palacegate_pl', 60, 30, { foot: [6, 2], scale: 1.2, alt: 'env/b_citygate_closed', altScale: 1.1, label: 'ประตูพระราชวัง', glow: [-40, 60, 0xffe1a0, 0.6] });
  for (const x of [47.93, 50.93, 53.93, 66.07, 69.07, 72.07]) P('env/p_brickwall', x, 30, { foot: [3, 1], scale: 48 / 42, alt: 'td_ruin' });   // กำแพงแก้วหน้าวัง ต่อชิดประตูเป็นแนวเดียว
  P('env/b_pavilion', 51, 21, { foot: [4, 2], scale: 0.65, glow: [-20, 40, 0xffe1a0, 0.5] }); P('env/b_pavilion', 69, 21, { foot: [4, 2], scale: 0.65, flip: true, glow: [-20, 40, 0xffe1a0, 0.5] });
  for (const x of [51, 55, 65, 69]) { small('p_banner', x, 33, { alt: 'env/p_lantern' }); }
  for (const x of [49, 71]) { small('p_lion', x, 27, { scale: 1.3, flip: x > 60 }); tree(x, 18, 'pink', 1); }
  small('p_torch', 56, 31, { glow: TORCH }); small('p_torch', 64, 31, { glow: TORCH });
  for (const [x, y] of [[53, 26], [67, 26], [56, 17], [64, 17]]) small('p_stonelantern', x, y, { glow: [-10, 18, 0xffd27a, 0.5] });
  reserve(45, 10, 75, 32);

  // === วัดไชยวัฒนาราม (ตะวันตกเฉียงเหนือ) ===
  P('env/m_prangbig_l', 33, 29, { foot: [6, 3], scale: 1.55, alt: 'env/m_prangbig', label: 'วัดไชยวัฒนาราม', glow: [-80, 110, 0xffe1a0, 0.7] });
  for (const [x, y, sc] of [[26, 21, 0.9], [40, 21, 0.9], [26, 33, 1], [40, 33, 1], [26, 27, 0.8], [40, 27, 0.8], [33, 20, 0.7]]) P('env/b_prang_l', x, y, { foot: [2, 2], scale: sc, alt: 'env/b_prang', flip: x > 33 });
  for (let x = 25; x <= 41; x += 3) if (x < 31 || x > 35) P(x % 2 ? 'env/p_buddhawall' : 'env/p_brickwall', x, 18, { foot: [3, 1], scale: 1.2, alt: 'td_ruin' });
  for (let x = 24; x <= 42; x += 3) if (x < 31 || x > 36) P(x % 2 ? 'env/p_buddhawall' : 'env/p_brickwall', x, 36, { foot: [3, 1], scale: 1.2, alt: 'td_ruin' });
  for (let x = 28; x <= 38; x += 2) small('p_buddha', x, 19, { glow: [-8, 14, 0xffe9a0, 0.3] });
  small('p_torch', 31, 37, { glow: TORCH }); small('p_torch', 35, 37, { glow: TORCH });
  small('p_bell', 24, 30, { scale: 1.2 }); small('p_bell', 42, 30, { scale: 1.2, flip: true }); small('p_stonelantern', 29, 34); small('p_stonelantern', 37, 34);
  reserve(21, 14, 45, 38);

  // === วัดพระศรีสรรเพชญ์ (ตะวันออกเฉียงเหนือ): เจดีย์ทอง 3 องค์ ===
  for (const [x, y, sc] of [[79, 28, 0.95], [86, 27, 1.2], [93, 28, 0.95]]) P(x === 86 ? 'env/b_goldchedi' : 'env/b_goldchedi2', x, y, { foot: [5, 3], scale: sc, alt: 'env/m_chedi_l', altScale: sc * 1.2, glow: [-60, 70, 0xfff0c0, 0.6] });
  for (let x = 77; x <= 96; x += 2) if (x < 83 || x > 89) small('p_buddha', x, 31, { glow: [-8, 14, 0xffe9a0, 0.3] });
  small('p_lion', 83, 33, { scale: 1.2 }); small('p_lion', 88, 33, { scale: 1.2, flip: true });
  P('env/b_ubosot', 90, 42, { foot: [7, 3], scale: 1.0, flip: true, label: 'พระอุโบสถ', glow: [-40, 70, 0xffe1a0, 0.6] });
  small('p_drum', 81, 40, { scale: 1.2 }); small('p_gong', 83, 44);
  reserve(74, 18, 99, 35); reserve(85, 36, 96, 44); reserve(79, 38, 85, 45);

  // === ตะวันตก: สำนักฝึก (สนามประลองมีรั้ว + ลานยิงธนู + ศาลอาคม) ===
  P('env/b_sala', 29, 69, { foot: [6, 3], scale: 0.95, alt: 'sala', altScale: 1, label: 'สำนักดาบ & ค่ายมวยโบราณ', glow: [-30, 60, 0xffe1a0, 0.6] });
  for (let x = 21; x <= 37; x += 2) if (x < 27 || x > 31) deco('p_fence', x, 53);                             // รั้วไม้ไผ่ด้านบน (เว้นทางเข้า)
  for (let y = 55; y <= 63; y += 2) { deco('p_fence', 20, y); deco('p_fence', 38, y); }
  for (const [x, y] of [[23, 56], [23, 61], [36, 56], [36, 61], [31, 62]]) small('p_haystack', x, y, { scale: 0.9 });   // หุ่นฟางซ้อม
  for (const [x, y] of [[21, 53], [37, 53]]) small('p_banner', x, y, { alt: 'env/p_lantern' });
  for (const [x, y] of [[21, 64], [37, 64]]) small('p_torch', x, y, { glow: TORCH });
  small('p_drum', 26, 64, { scale: 1.1 }); small('p_table', 33, 65, { alt: 'env/p_bench' });
  // ลานยิงธนู: เป้าฟางด้านตะวันตก ยิงจากเส้นรั้วตะวันออก
  for (const y of [42, 44]) small('p_haystack', 25, y, { scale: 0.85 });
  for (const y of [41, 43, 45]) deco('p_fence', 37, y);
  small('p_banner', 24, 40, { alt: 'env/p_lantern' });
  // ศาลอาคมหลวงตาเผือก (ข้างลานยิงธนู)
  small('p_spirit', 36, 40, { scale: 0.9, glow: [-16, 30, 0xbb8fce, 0.7] });
  for (const x of [34, 38]) deco('p_candle', x, 40, { glow: [-6, 14, 0xffc46b, 0.5] });
  reserve(19, 39, 39, 46); reserve(19, 52, 39, 72);

  // === ศาลาโอสถหมอพร: ลานอิฐ แปลงสมุนไพร บ่อน้ำ ครกยา ===
  P('env/b_pavilion', 47, 56, { foot: [4, 2], scale: 0.6, label: 'ศาลาโอสถ', glow: [-20, 40, 0x7dffb0, 0.5] });
  for (let x = 43; x <= 49; x += 2) for (const y of [61, 63]) deco(((x + y) % 4) ? 'p_plants' : 'p_shrub', x, y);
  small('p_well', 49, 59); small('p_mortar', 45, 55, { alt: 'env/p_pots' }); small('p_jar', 42, 60); small('p_pots2', 50, 54, { alt: 'env/p_pots' });
  small('p_stonelantern', 42, 54, { glow: [-10, 18, 0x7dffb0, 0.5] }); small('p_stonelantern', 50, 64, { glow: [-10, 18, 0x7dffb0, 0.5] });
  reserve(41, 52, 51, 65);

  // === สวนหลวง: สระบัว 2 สระ ศาลาริมสระ ===
  for (const cx of [45.5, 74.5]) {
    for (let i = 0; i < 6; i++) { const a = i * 1.05, d = 1 + (i % 3) * 0.8; deco(i % 2 ? 'p_lotus' : 'p_lotus2', Math.round(cx + Math.cos(a) * d), Math.round(43.5 + Math.sin(a) * d * 0.8), { depth: 1 }); }
    for (const [dx, dy] of [[-5, -4], [5, -4], [-5, 5], [5, 5]]) small('p_stonelantern', Math.round(cx + dx), Math.round(43.5 + dy), { glow: [-10, 18, 0xffd27a, 0.45] });
    tree(Math.round(cx) + (cx < 60 ? -4 : 4), 40, 'pink', 0.85);
  }
  reserve(40, 38, 51, 49); reserve(69, 38, 80, 49);

  // === ตะวันออก: ย่านช่างเหล็กน้ำพี้ ===
  P('env/b_forge', 92, 57, { foot: [5, 2], scale: 0.85, alt: 'forge', altScale: 1, label: 'เตาตีเหล็กน้ำพี้', glow: [-20, 60, 0xff8a3c, 1] });
  P('env/b_forge3', 97, 55, { foot: [3, 2], scale: 0.55, glow: [-15, 40, 0xff8a3c, 0.8] }); small('p_firewood', 88, 57);
  small('p_cart', 86, 55); small('p_pots', 98, 55); small('p_rice', 87, 60, { alt: 'env/p_pots' }); small('p_sign', 99, 60, { alt: 'env/p_bench' });
  small('p_torch', 85, 58, { glow: TORCH }); small('p_torch', 100, 58, { glow: TORCH });
  P('env/b_wat2', 94, 68, { foot: [7, 3], scale: 0.9, label: 'วิหารไม้', glow: [-40, 60, 0xffe1a0, 0.5] });
  reserve(82, 52, 102, 62); reserve(89, 63, 99, 69);

  // === ตลาดหัวรอ (ใต้): เต็นท์เรียงสองฝั่งถนนหลวง + รถเข็นขายของ ===
  const TENTS = ['red', 'blue', 'green', 'yellow', 'purple'];
  let ti = 0;
  for (const [x, y] of [[47, 64], [51, 64], [55, 64], [64, 64], [68, 64], [72, 64], [47, 68], [56, 68], [64, 68], [73, 68]]) {
    if (ti % 2) small(`p_tent_${TENTS[ti % 5]}`, x, y, { alt: 'env/p_stall', glow: [-14, 30, 0xffb35c, 0.8] });
    else P(`env/p_mstall_${(ti / 2) % 8}`, x, y, { foot: [2, 1], scale: 0.62, alt: 'env/p_stall', altScale: 0.9, glow: [-14, 30, 0xffb35c, 0.7] });   // แผงผลไม้ PixelLab
    ti++;
  }
  // แผงขายของเรียงสองฝั่งถนนหลวงช่วงใต้ถนนตลาด (ถนนคนเดิน)
  for (const y of [74, 77, 80]) for (const x of [56, 63]) if (free(x - 1, y - 1, x + 1, y)) P(`env/p_mstall_${(y + x) % 8}`, x, y, { foot: [2, 1], scale: 0.6, alt: 'env/p_stall', altScale: 0.9, glow: [-14, 30, 0xffb35c, 0.6] }), reserve(x - 1, y - 2, x + 1, y);
  for (const [x, y, k] of [[49, 66, 'p_fruit'], [53, 66, 'p_baskets'], [66, 66, 'p_pottery'], [70, 66, 'p_silk'], [74, 66, 'p_flowercart'], [45, 66, 'p_teatable']]) small(k, x, y, { alt: 'env/p_pots' });
  P('env/p_stall', 46, 62, { foot: [3, 1], scale: 1.0, alt: 'stall', altScale: 1, label: 'ตลาดหัวรอ', glow: [-20, 40, 0xffb35c, 0.9] });
  P('env/p_foodcart', 74, 62, { foot: [3, 1], scale: 1.0, alt: 'env/p_flowercart', altScale: 1.1, glow: [-20, 40, 0xffb35c, 0.9] });
  for (const [x, y] of [[57, 62], [62, 62], [57, 69], [62, 69]]) small('p_lanternpole', x, y, { glow: LAMP, alt: 'env/p_lantern' });
  reserve(43, 60, 77, 72);
  // ประตูใต้
  // ซุ้มประตูเมืองใต้: กำแพงใต้หันหน้าออกนอกเมือง (หน้ากำแพง = แถว y90) → ฐานซุ้มชิดขอบล่างหน้ากำแพง · ช่องทางเดินกว้างเท่าถนน 4 ไทล์
  //  ภาพ PixelLab ช่องโค้ง 18px × 1.78 ≈ 2 ไทล์ → ทางเดินผ่านประตูกว้าง 2 ไทล์ (x59–60) ตรงกลางถนนหลวง
  P('env/b_citygate_pl', 60, 91, { foot: [0, 0], scale: 1.78, alt: 'env/b_citygate', altScale: 64 / 48, label: 'ประตูเมืองใต้', glow: [-60, 90, 0xffe1a0, 0.7] });
  P('none', 56, 89, { foot: [5, 4] }); P('none', 63, 89, { foot: [5, 4] });            // ตัวป้อมซ้าย/ขวา (ชนได้ · ไม่มีภาพ)
  P('none', 58, 91, { foot: [1, 2] }); P('none', 61, 91, { foot: [1, 2] });            // ขอบช่องประตูบนแนวกำแพง
  small('p_torch', 55, 83, { glow: TORCH }); small('p_torch', 65, 83, { glow: TORCH });
  P('env/p_board', 69, 82, { foot: [2, 1], scale: 0.9, alt: 'bounty_board', altScale: 1, label: 'ป้ายประกาศค่าหัว' });
  small('p_bench', 53, 83); small('p_well2', 53, 81, { alt: 'env/p_well' });
  reserve(51, 80, 68, 92);
  // ประตูตะวันตก/ตะวันออก
  for (const [x, f] of [[20, false], [100, true]]) { small('p_torch', x, 46, { glow: TORCH }); small('p_torch', x, 53, { glow: TORCH }); small('p_lion', x + (f ? -2 : 2), 46, { scale: 1.1, flip: f }); }
  // ป้อมกำแพงหน้าตรง (PixelLab): กำแพงใต้ (หน้ากำแพงแถว y90) และกำแพงเหนือ (หน้ากำแพงแถว y11) ฐานชิดขอบล่างหน้ากำแพง
  for (const [x, y, k] of [[40, 91, 1], [80, 91, 1], [44, 12, 2], [76, 12, 2]]) {
    P(`env/b_walltower_${k}`, x, y, { foot: [0, 0], scale: 1, alt: 'env/b_gatetower', altScale: 1, glow: [-40, 50, 0xffe1a0, 0.4] });
    P('none', x, y - 1, { foot: [3, 4] });
    reserve(x - 2, y - 7, x + 2, y);
  }
  // ประตูตะวันตก/ตะวันออก: กำแพงแนวตั้ง (หนา 2 ไทล์) → ป้อมคู่ขนาบถนนบน/ล่าง ฐานป้อมชิดขอบถนน
  //  มุมกล้อง 3/4 มองจากใต้ → ป้อมฝั่งใต้ถนนจะบังถนน จึงตั้งป้อมเฉพาะฝั่งเหนือ (ฐานชิดขอบบนถนน) ฝั่งใต้ปล่อยปลายกำแพงเป็นเสาประตู
  for (const wx of [17, 104]) P('env/b_gatetower', wx, 48, { foot: [0, 0], scale: 1, alt: 'env/p_arch', label: wx < 60 ? 'ประตูเมืองตะวันตก' : 'ประตูเมืองตะวันออก' });
  reserve(14, 44, 24, 55); reserve(96, 44, 106, 55);

  // === ชุมชนริมซอย: เรือนไทยเรียงหน้าบ้านหันเข้าซอย มีรั้ว สวนครัว โอ่งน้ำ ===
  const HOUSE = [['env/b_teak_1', 1.1], ['env/b_ruenthai', 0.9], ['env/b_teak_3', 1.1], ['env/b_house2', 0.9], ['env/b_teak_2', 1.1], ['env/b_hamlet', 0.82], ['env/b_teak_1', 1.05], ['env/b_village', 0.82]];
  let hi = 0;
  const home = (hx, hy, big = true) => {
    const w = big ? 3 : 2;
    if (!free(hx - w, hy - 3, hx + w, hy)) return false;
    const [key, sc] = HOUSE[hi++ % HOUSE.length];
    P(key, hx, hy, { foot: [big ? 5 : 3, 2], scale: big ? sc : sc * 0.78, alt: 'env/b_ruenthai', altScale: 0.8, flip: hi % 2 === 0, glow: WIN });
    reserve(hx - w, hy - 4, hx + w, hy);
    // หน้าบ้าน: รั้ว + ของใช้
    if (free(hx - w - 1, hy, hx - w - 1, hy)) { deco('p_fence', hx - w - 1, hy); reserve(hx - w - 1, hy, hx - w - 1, hy); }
    const extra = ['p_jar', 'p_plants', 'p_laundry', 'p_frangipani', 'p_coop', 'p_firewood'][hi % 6];
    if (free(hx + w + 1, hy, hx + w + 1, hy)) { (extra === 'p_plants' || extra === 'p_frangipani' ? deco : small)(extra, hx + w + 1, hy); reserve(hx + w + 1, hy, hx + w + 1, hy); }
    return true;
  };
  // เรือนแถวร้านค้าไม้ 2 ชั้น (PixelLab) เลียบฝั่งใต้ถนนตลาด
  for (const [x, k] of [[29, 1], [46, 3], [67, 4], [85, 1], [74, 2]]) if (free(x - 3, 74, x + 3, 77)) {
    P(`env/b_shophouse_${k}`, x, 77, { foot: [6, 2], scale: 0.78, alt: 'env/b_ruenthai', altScale: 0.9, glow: WIN, flip: x > 60 });
    reserve(x - 3, 73, x + 3, 77);
  }
  // แถวเหนือซอยใต้ (หน้าบ้าน = ซอย y78) · แถวใต้ซอย (หลังกำแพงเมือง)
  for (const x of [29, 36, 46, 53, 67, 74, 85, 92]) home(x, 77);
  for (const x of [31, 37, 46, 52, 68, 74, 84, 90]) home(x, 84, x !== 31 && x !== 90);
  // ย่านตะวันออกของลานน้ำพุ: เรือนแถวริมซอย x80
  for (const y of [57, 64]) home(75, y);
  for (const y of [45, 66]) home(85, y, false);
  // เรือนริมซอยเหนือ–ใต้ (x40 / x80) ช่วงใต้ถนนตลาด
  for (const y of [75, 83]) { home(36, y, false); home(84, y, false); }
  // เติมชุมชนให้แน่นแบบเมืองหลวง: ไล่ตารางหาช่องว่างในย่านใต้/ตะวันออก (เรือนใหญ่ก่อน แล้วเรือนเล็ก)
  for (const big of [true, false]) for (let y = 58; y <= 88; y += big ? 5 : 4) for (let x = 20; x <= 100; x += big ? 7 : 5) home(x + (y % 2), y, big);
  // มุมเหนือ (หลังวัด/วัง): เรือนเล็กของข้าหลวง
  for (const [x, y] of [[20, 44], [100, 40], [99, 64], [21, 68]]) home(x, y, false);

  // === ต้นไม้เรียงสองข้างถนนหลวง (ถนนร่มรื่นแบบเมือง RO) ===
  for (let x = 22; x <= 100; x += 5) for (const y of [47, 53]) if (free(x, y - 1, x, y)) { tree(x, y, (x / 5) % 2 ? 'palm' : 'tamarind', 0.8); reserve(x - 1, y - 2, x + 1, y); }
  for (let y = 42; y <= 88; y += 5) for (const x of [56, 63]) if (free(x, y - 1, x, y)) { tree(x, y, (y / 5) % 2 ? 'golden' : 'tamarind', 0.8); reserve(x - 1, y - 2, x + 1, y); }
  // แปลงไม้ดอกริมถนนตลาด/ถนนเลียบวัด
  for (let x = 24; x <= 96; x += 4) for (const y of [36, 39, 69, 72]) if (free(x, y, x, y) && rnd() < 0.6) { deco(['p_shrub', 'p_frangipani', 'p_plants', 'p_shrub2'][Math.floor(rnd() * 4)], x, y); reserve(x, y, x, y); }
  // สวนต้นไม้ในช่องว่างที่เหลือ: เช็กจากรอยเท้าของจริง (ไม่ใช้เขตจองทั้งย่าน) · เว้นทางเดินหน้า NPC/ประตู
  const busy = ground.map((row) => row.map((t) => !isGrass(t)));
  const mark = (cx, cy, rx, ry) => { for (let y = cy - ry; y <= cy; y++) for (let x = cx - rx; x <= cx + rx; x++) if (inMap(x, y)) busy[y][x] = true; };
  for (const p of props) { const [fw, fh] = p.foot || [1, 1], tx = Math.round(p.x / TILE), ty = Math.round(p.y / TILE); if (fw >= 2) mark(tx, ty + 1, Math.ceil(fw / 2) + 1, fh + 2); else mark(tx, ty, fw ? 1 : 0, fw ? 1 : 0); }
  mark(60, 36, 11, 6);
  mark(33, 36, 12, 22); mark(60, 61, 12, 22); mark(60, 90, 8, 9);                                         // ลานวัดไชยฯ · ลานน้ำพุ                                                              // ลานหน้าประตูวังโล่ง
  for (const [x, y] of [[52, 68], [64, 56], [95, 62], [68, 68], [28, 57], [38, 40], [30, 44], [34, 57], [44, 57], [55, 57]]) mark(x, y + 2, 3, 5);
  const open = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!inMap(x, y) || busy[y][x] || !isIsland(x, y)) return false; return true; };
  for (let y = 12; y <= 90; y += 2) for (let x = 16; x <= 104; x += 2) {
    const tx = x, ty = y + (x % 4 ? 1 : 0);
    if (!open(tx - 1, ty - 1, tx + 1, ty)) continue;
    mark(tx, ty + 1, 1, 3);
    const r = rnd();
    if (r < 0.55) { tree(tx, ty, ['tamarind', 'pink', 'palm', 'golden', 'tamarind', 'bamboo'][Math.floor(rnd() * 6)], 0.9 + rnd() * 0.2); reserve(tx - 1, ty - 2, tx + 1, ty); }
    else if (r < 0.75) { deco(['p_shrub', 'p_frangipani', 'p_plants', 'p_shrub2'][Math.floor(rnd() * 4)], tx, ty); reserve(tx, ty, tx, ty); }
    else if (r < 0.8) { small(['p_well', 'p_bench', 'p_stonelantern', 'p_jar', 'p_haystack'][Math.floor(rnd() * 5)], tx, ty); reserve(tx - 1, ty - 1, tx + 1, ty); }
  }

  // === นอกเกาะ: ริมคูเมือง ท่าเรือ ต้นไม้ ===
  P('env/b_sala2', 67, 99, { foot: [5, 2], scale: 0.85, label: 'ท่าน้ำ', glow: [-30, 50, 0xffe1a0, 0.6] });
  for (const [x, y, f] of [[40, 94, 0], [80, 94, 1], [14, 60, 0], [106, 40, 1], [30, 8, 0], [90, 8, 1], [50, 93, 1], [72, 95, 0], [12, 30, 1], [108, 64, 0]]) P(x % 20 < 10 ? 'env/p_boat' : 'env/p_rowboat', x, y, { foot: [0, 0], depth: 1, flip: !!f, scale: 1.1, alt: 'boat', altScale: 1 });
  small('p_torch', 56, 98, { glow: TORCH }); small('p_torch', 63, 98, { glow: TORCH });
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
  P('env/p_campfire', 60, 112, { foot: [1, 1], scale: 0.8, alt: 'campfire', altScale: 1, label: 'ค่ายพัก', glow: [-10, 80, 0xff8a3c, 1.3] });
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
    { id: 'kru_healer', key: 'npc_pa_sa',     x: 44, y: 57, nameTh: 'หมอพร', role: 'ศาลาโอสถ·หมอยา', color: '#48c9b0', lines: ['ยาดีไม่ใช่ยาแรง ยาดีคือยาที่ถูกกับคน', 'ถือไม้เท้าสมุนไพรแล้วเจ้าจะเป็นหมอยา รักษาเพื่อนได้ ชุบชีวิตก็ได้', 'อยู่ปาร์ตี้กับเพื่อนเถิด หมอยาเก่งตอนมีคนให้ดูแล'] },
    { id: 'warp',      key: 'npc_kru_mage',   x: 55, y: 57, nameTh: 'ฤๅษีเฝ้าประตูมิติ', role: 'วาร์ปต่างแดน', color: '#d2b4de', lines: ['ประตูมิติหิมพานต์อยู่กลางบึงผีพรายทางใต้ ต้อง Lv.30 ขึ้นไปจึงผ่านได้', 'แดนใดที่เจ้าเคยเหยียบแล้ว ข้าส่งไปให้ได้ทันที'] },
].map((n) => ({ ...n, x: n.x * TILE, y: n.y * TILE }));

  // ---- จุดเกิดผี (ทุ่งนอกประตูใต้) ----
  const spawns = [];
  const S = (id, tx, ty, r = 4) => spawns.push({ id, x: tx * TILE, y: ty * TILE, r: r * TILE });
  [[40, 108], [50, 114], [70, 110], [78, 116], [56, 122]].forEach(([x, y]) => S('phi_tuay_kaew', x, y));
  [[22, 128], [32, 133], [44, 126], [26, 118]].forEach(([x, y]) => S('kuman_thong', x, y));
  [[86, 128], [98, 132], [104, 122]].forEach(([x, y]) => S('nang_tani', x, y, 3));

  return { ground, props, npcs, spawns };
}

// ============================================================
//  โซนล่าผีรอบเมือง (พิกัดไทล์ทั้งแผนที่)
// ============================================================
/** โซน: ชื่อ + ช่วงเลเวล (ใช้แสดงป้ายตอนเดินเข้า / มินิแมป) */
export const ZONES = {
  town:      { nameTh: 'เกาะเมืองอยุธยา', sub: 'Safe Zone', color: '#f7dc6f' },
  outskirts: { nameTh: 'ชานกรุงศรีฯ', sub: 'ริมคูเมือง', color: '#a9dfbf' },
  field:     { nameTh: 'ทุ่งนาบางปะอิน', sub: 'Lv.1–8 · บอส แม่นาคพระโขนง', color: '#abebc6' },
  bamboo:    { nameTh: 'ป่าไผ่ปู่โสม', sub: 'Lv.7–15 · บอส ปู่โสมเฝ้าทรัพย์', color: '#82e0aa' },
  graveyard: { nameTh: 'ป่าช้าวัดร้าง', sub: 'Lv.14–23 · บอส เปรตอสุรกาย', color: '#bb8fce' },
  swamp:     { nameTh: 'บึงผีพราย', sub: 'Lv.21–30 · บอส พญาชาละวัน', color: '#85c1e9' },
};
/** โซนของไทล์ (tx,ty) */
export function zoneAtTile(tx, ty) {
  if (isIsland(tx, ty)) return 'town';
  if (ty >= LH + 5) return 'swamp';
  if (tx < OX) return 'bamboo';
  if (tx >= OX + LW) return 'graveyard';
  return ty >= 92 ? 'field' : 'outskirts';
}
export const zoneAt = (x, y) => zoneAtTile(Math.floor(x / TILE), Math.floor(y / TILE));

/** ผังทั้งแผนที่: { ground, solid, props, npcs, spawns } */
export function buildLayout() {
  seed = 1234;
  const town = buildTown();
  const ground = Array.from({ length: MAP_H }, () => new Array(MAP_W).fill(T.GRASS));
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) { const r = rnd(); ground[y][x] = r < 0.08 ? T.GRASS2 : r < 0.18 ? T.GRASS3 : T.GRASS; }
  for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) ground[y][x + OX] = town.ground[y][x];
  const shift = (o) => ({ ...o, x: o.x + OX * TILE });
  const props = town.props.map(shift), npcs = town.npcs.map(shift), spawns = town.spawns.map(shift);

  const inMap = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
  const set = (x, y, t) => { if (inMap(x, y)) ground[y][x] = t; };
  const get = (x, y) => (inMap(x, y) ? ground[y][x] : null);
  const rect = (x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, t); };
  const disc = (cx, cy, r, t) => { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if (Math.hypot(x - cx, y - cy) <= r) set(x, y, t); };
  const path = (pts, w, t) => { for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2); for (let k = 0; k <= n; k++) { const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n; rect(Math.round(x - w / 2), Math.round(y - w / 2), Math.round(x - w / 2) + w - 1, Math.round(y - w / 2) + w - 1, t); } } };
  const isGrass = (t) => t === T.GRASS || t === T.GRASS2 || t === T.GRASS3 || t === T.TALL;
  const P = (key, tx, ty, opt = {}) => props.push({ key, x: tx * TILE, y: ty * TILE, ...opt });
  const small = (key, tx, ty, opt = {}) => P(`env/${key}`, tx, ty, { foot: [1, 1], ...opt, scale: 0.6 * (opt.scale || 1) });
  const deco = (key, tx, ty, opt = {}) => small(key, tx, ty, { ...opt, foot: [0, 0] });
  const TORCH = [-22, 46, 0xff9a3c, 1.1];
  const TREE_K = { tamarind: 0.8, palm: 0.72, golden: 0.72, bamboo: 0.62, pink: 1.9 };
  const tree = (tx, ty, kind, sc = 1) => P(`env/t_${kind}`, tx, ty, { foot: [1, 1], alt: 'td_tree', scale: sc * TREE_K[kind], altScale: 1.4 * sc, flip: rnd() < 0.5 });
  // พื้นที่ห้ามวางของ (ทาง/ลาน/จุดเกิดผี)
  const occ = Array.from({ length: MAP_H }, () => new Array(MAP_W).fill(false));
  const reserve = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inMap(x, y)) occ[y][x] = true; };
  const reserveDisc = (cx, cy, r) => reserve(cx - r, cy - r, cx + r, cy + r);
  const free = (x, y, r = 1) => { for (let yy = y - r; yy <= y; yy++) for (let xx = x - r; xx <= x + r; xx++) if (!inMap(xx, yy) || occ[yy][xx] || !isGrass(ground[yy][xx])) return false; return true; };
  for (let y = 0; y < LH; y++) for (let x = OX; x < OX + LW; x++) occ[y][x] = true;               // ผังเดิมจัดไว้แล้ว
  for (const h of HERB_SPOTS) reserveDisc(Math.floor(h.x / TILE), Math.floor(h.y / TILE), 1);       // จุดเก็บสมุนไพร: ห้ามต้นไม้ทับ
  const S = (id, tx, ty, r = 4, n = 1) => { for (let i = 0; i < n; i++) spawns.push({ id, x: tx * TILE, y: ty * TILE, r: r * TILE }); reserveDisc(tx, ty, Math.min(r, 5)); };
  const clearing = (cx, cy, r, t = T.GRASS2) => { disc(cx, cy, r, t); reserveDisc(cx, cy, r + 1); };
  const BOSS = (id, tx, ty) => { spawns.push({ id, x: tx * TILE, y: ty * TILE, r: 2 * TILE, boss: true }); reserveDisc(tx, ty, 6); };

  // ---------- ผีกลางคืนในทุ่งนา: กระสือ ----------
  for (const [x, y] of [[20, 131], [46, 131], [100, 131]]) S('krasue', x + OX, y, 3);
  // ---------- บอสทุ่งนา: แม่นาคพระโขนง (ลานใต้ต้นตะเคียนหลังวัดร้าง) ----------
  BOSS('mae_nak', 86 + OX, 129);
  small('p_spirit', 81 + OX, 127, { label: 'ศาลแม่นาค', glow: [-20, 40, 0x85c1e9, 0.8] });

  // ================= ป่าไผ่ปู่โสม (ตะวันตก) =================
  for (let y = 0; y < LH + 5; y++) for (let x = 0; x < OX; x++) { const r = rnd(); ground[y][x] = r < 0.35 ? T.GRASS3 : r < 0.5 ? T.TALL : T.GRASS; }
  const bPath = [[OX + 7, 49.5], [44, 49.5], [30, 56], [28, 80], [32, 100], [26, 122], [28, 150]];
  path(bPath, 3, T.ROAD); for (const [x, y] of bPath) reserveDisc(Math.round(x), Math.round(y), 2);
  for (let i = 1; i < bPath.length; i++) { const [x0, y0] = bPath[i - 1], [x1, y1] = bPath[i]; for (let k = 0; k <= 30; k++) reserveDisc(Math.round(x0 + (x1 - x0) * k / 30), Math.round(y0 + (y1 - y0) * k / 30), 2); }
  clearing(44, 38, 6); S('phi_pob', 44, 38, 4, 4);
  clearing(14, 26, 6); path([[14, 26], [28, 44]], 2, T.SAND); S('phi_jang_nang', 14, 26, 4, 3);
  clearing(44, 86, 6); path([[30, 84], [44, 86]], 2, T.SAND); S('pret', 44, 86, 4, 3);
  clearing(14, 102, 6); path([[14, 102], [30, 100]], 2, T.SAND); S('saming', 14, 102, 4, 3);
  clearing(12, 66, 5); path([[12, 66], [29, 66]], 2, T.SAND); S('kong_koi', 12, 66, 4, 3);
  // ลานศาลปู่โสม (บอส)
  disc(14, 132, 8, T.GRASS2); disc(14, 132, 5, T.BRICK); path([[14, 132], [26, 124]], 2, T.SAND); reserveDisc(14, 132, 9);
  BOSS('pu_som', 14, 131);
  P('env/p_spirit', 14, 126, { foot: [2, 1], scale: 1.2, label: 'ศาลปู่โสม', glow: [-20, 50, 0xffd27a, 1] });
  for (const [x, y] of [[8, 128], [20, 128], [8, 137], [20, 137]]) small('p_torch', x, y, { glow: TORCH });
  for (const [x, y] of [[10, 134], [18, 134], [12, 138]]) small('p_jar', x, y); small('p_chest', 16, 138, { scale: 1.2 });
  // ป่าไผ่หนาทึบ
  for (let y = 1; y < LH + 4; y += 2) for (let x = 1; x < OX - 1; x += 2) {
    const tx = x + Math.floor(rnd() * 2), ty = y + Math.floor(rnd() * 2);
    if (!free(tx, ty) || rnd() > 0.62) continue;
    const r = rnd();
    if (r < 0.78) tree(tx, ty, 'bamboo', 0.9 + rnd() * 0.3); else if (r < 0.9) deco(rnd() < 0.5 ? 'p_bamboo' : 'p_bamboo2', tx, ty); else tree(tx, ty, 'tamarind', 1);
    reserve(tx - 1, ty - 1, tx + 1, ty);
  }
  P('env/p_arch', OX + 2, 51, { foot: [0, 0], scale: 1.4, label: 'ป่าไผ่ปู่โสม →' });

  // ================= ป่าช้าวัดร้าง (ตะวันออก) =================
  const GX = OX + LW;
  for (let y = 0; y < LH + 5; y++) for (let x = GX; x < MAP_W; x++) { const r = rnd(); ground[y][x] = r < 0.12 ? T.STONE : r < 0.4 ? T.GRASS3 : r < 0.5 ? T.TALL : T.GRASS2; }
  const gPath = [[GX - 1, 49.5], [200, 49.5], [206, 70], [202, 96], [208, 120], [204, 150]];
  path(gPath, 3, T.STONE);
  for (let i = 1; i < gPath.length; i++) { const [x0, y0] = gPath[i - 1], [x1, y1] = gPath[i]; for (let k = 0; k <= 30; k++) reserveDisc(Math.round(x0 + (x1 - x0) * k / 30), Math.round(y0 + (y1 - y0) * k / 30), 2); }
  clearing(196, 26, 6, T.STONE); path([[196, 26], [200, 48]], 2, T.STONE); S('phi_ha', 196, 26, 4, 3);
  clearing(222, 66, 6, T.BRICK); path([[206, 68], [222, 66]], 2, T.STONE); S('phi_dip', 222, 66, 4, 4);
  clearing(188, 96, 6, T.STONE); path([[188, 96], [202, 96]], 2, T.STONE); S('tai_hong', 188, 96, 4, 3);
  clearing(222, 114, 6, T.BRICK); path([[208, 118], [222, 114]], 2, T.STONE); S('phi_lang_kluang', 222, 114, 4, 3);
  clearing(188, 78, 5, T.STONE); path([[188, 78], [204, 80]], 2, T.STONE); S('phi_phong', 188, 78, 4, 3);
  // วัดร้างใหญ่ (บอส เปรตอสุรกาย)
  disc(214, 134, 9, T.BRICK); path([[204, 128], [214, 134]], 3, T.STONE); reserveDisc(214, 134, 10);
  BOSS('pret_asura', 214, 135);
  P('env/m_prangbig_l', 214, 128, { foot: [6, 3], scale: 1.3, alt: 'env/m_prangbig', label: 'วัดร้างเปรตอสุรกาย', glow: [-70, 110, 0xbb8fce, 0.9] });
  for (const [x, y] of [[206, 130], [222, 130], [206, 140], [222, 140]]) small('p_torch2', x, y, { glow: [-22, 46, 0xb266ff, 1.1] });
  for (const [x, y] of [[208, 136], [220, 136]]) small('p_buddhahead', x, y, { scale: 1.3 });
  // ซากวัด/เจดีย์/หลุมศพกระจาย
  const RUINS = [['env/b_chediruin', [6, 2]], ['env/m_mondop', [6, 3]], ['env/b_prang_l', [2, 2]], ['env/m_chedi_l', [3, 2]]];
  for (const [x, y] of [[186, 10], [214, 16], [226, 40], [186, 60], [214, 84], [184, 120], [226, 96]]) {
    if (!free(x, y, 3)) continue; const [k, f] = RUINS[Math.floor(rnd() * RUINS.length)];
    P(k, x, y, { foot: f, scale: 0.9, flip: rnd() < 0.5, alt: 'td_ruin' }); reserve(x - 3, y - 3, x + 3, y);
  }
  for (let y = 2; y < LH + 4; y += 3) for (let x = GX + 1; x < MAP_W - 1; x += 3) {
    const tx = x + Math.floor(rnd() * 2), ty = y + Math.floor(rnd() * 2);
    if (!free(tx, ty) || rnd() > 0.55) continue;
    const r = rnd();
    if (r < 0.28) tree(tx, ty, 'tamarind', 0.9 + rnd() * 0.3);
    else if (r < 0.55) small(rnd() < 0.5 ? 'p_ruin' : 'p_ruin2', tx, ty, { scale: 1.2, alt: 'td_ruin' });
    else if (r < 0.7) small('p_stonelantern', tx, ty, { glow: [-10, 18, 0xb266ff, 0.4] });
    else if (r < 0.82) small(rnd() < 0.5 ? 'p_buddhahead' : 'p_buddhahead2', tx, ty);
    else if (r < 0.9) small('p_buddha2', tx, ty);
    else deco('p_candle', tx, ty, { glow: [-6, 14, 0xffc46b, 0.5] });
    reserve(tx - 1, ty - 1, tx + 1, ty);
  }
  P('env/p_arch', GX - 3, 51, { foot: [0, 0], scale: 1.4, flip: true, label: '← ป่าช้าวัดร้าง' });

  // ================= บึงผีพราย (ใต้สุด) =================
  const SY = LH + 5;
  for (let y = LH; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    if (y < SY && x >= OX && x < GX) continue;                                  // รอยต่อทุ่งนา
    const r = rnd(); ground[y][x] = r < 0.3 ? T.TALL : r < 0.55 ? T.GRASS3 : T.GRASS;
  }
  path(bPath.slice(-2), 3, T.ROAD); path(gPath.slice(-2), 3, T.STONE);            // ต่อทางจากป่าไผ่/ป่าช้าลงบึง (ถมหญ้าทับไปแล้ว)
  // บ่อ/บึงน้ำ (ชน) + ตลิ่งทราย
  const ponds = [[40, 176, 7], [74, 150, 5], [130, 166, 6], [176, 176, 7], [220, 160, 5], [110, 196, 9], [18, 192, 6], [150, 194, 5], [200, 197, 6], [96, 170, 4]];
  for (const [cx, cy, r] of ponds) { disc(cx, cy, r + 1.5, T.SAND); disc(cx, cy, r, T.WATER); }
  for (let y = SY; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) if (ground[y][x] === T.WATER && rnd() < 0.5) ground[y][x] = T.WATER2;
  // ทางเดินไม้ข้ามบึง: ถนนใต้จากทุ่งนา + ทางขวางเชื่อมป่าไผ่/ป่าช้า
  const sPath = [[OX + 59.5, 134], [OX + 59.5, 158], [OX + 60, 184]];
  path(sPath, 3, T.WOOD); path([[28, 150], [28, 168], [210, 168], [204, 150]], 3, T.WOOD);
  for (const pts of [sPath, [[28, 150], [28, 168], [210, 168], [204, 150]]]) for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; for (let k = 0; k <= 60; k++) reserveDisc(Math.round(x0 + (x1 - x0) * k / 60), Math.round(y0 + (y1 - y0) * k / 60), 2); }
  clearing(58, 184, 6, T.SAND); path([[58, 168], [58, 184]], 2, T.WOOD); S('khamot', 58, 184, 4, 3);
  clearing(92, 156, 5); path([[92, 156], [92, 168]], 2, T.WOOD); S('nang_takhian', 92, 156, 4, 3);
  clearing(160, 184, 6, T.SAND); path([[160, 168], [160, 184]], 2, T.WOOD); S('phi_phrai', 160, 184, 4, 3);
  clearing(196, 184, 6); path([[196, 168], [196, 184]], 2, T.WOOD); S('phi_chamot', 196, 184, 4, 3);
  clearing(112, 150, 5); path([[112, 150], [112, 168]], 2, T.WOOD); S('krahang', 112, 150, 4, 3);
  // ลานพญาชาละวัน (ริมบึงใหญ่)
  disc(OX + 60, 186, 7, T.SAND); reserveDisc(OX + 60, 186, 8);
  BOSS('chalawan', OX + 60, 187);
  P('env/p_spirit', OX + 54, 181, { foot: [2, 1], scale: 1.1, label: 'ศาลพญาชาละวัน', glow: [-20, 50, 0x85c1e9, 1] });
  for (const [x, y] of [[OX + 53, 184], [OX + 67, 184], [OX + 53, 191], [OX + 67, 191]]) small('p_torch', x, y, { glow: TORCH });
  // ประตูมิติ → ป่าหิมพานต์ (Lv.30+) ริมทางไม้กลางบึง
  const portals = [{ to: 'himmaphan', x: 132 * TILE, y: 186 * TILE, r: 26 }];
  disc(132, 186, 3.5, T.BRICK); disc(132, 186, 4.5, T.STONE); disc(132, 186, 3.5, T.BRICK); path([[132, 168], [132, 182]], 3, T.WOOD); reserveDisc(132, 184, 6);
  for (let k = 0; k <= 30; k++) reserveDisc(132, Math.round(168 + k * 14 / 30), 2);
  for (const [dx, dy] of [[-3, -2], [3, -2]]) small('p_torch2', 132 + dx, 186 + dy, { glow: [-22, 46, 0xb266ff, 1.1] });
  // บัว/เรือ/ต้นไม้ริมบึง
  for (const [cx, cy, r] of ponds) for (let i = 0; i < r; i++) { const a = rnd() * 6.28, d = rnd() * (r - 1); deco(rnd() < 0.5 ? 'p_lotus' : 'p_lotus2', Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d), { depth: 1 }); }
  for (let y = SY; y < MAP_H - 1; y += 3) for (let x = 1; x < MAP_W - 1; x += 3) {
    const tx = x + Math.floor(rnd() * 2), ty = y + Math.floor(rnd() * 2);
    if (!free(tx, ty) || rnd() > 0.45) continue;
    const r = rnd();
    if (r < 0.45) tree(tx, ty, rnd() < 0.6 ? 'tamarind' : 'palm', 0.9 + rnd() * 0.3); else if (r < 0.75) deco(rnd() < 0.5 ? 'p_shrub' : 'p_shrub2', tx, ty); else deco('p_plants', tx, ty);
    reserve(tx - 1, ty - 1, tx + 1, ty);
  }
  P('env/p_arch', OX + 59, SY - 1, { foot: [0, 0], scale: 1.4, label: '↓ บึงผีพราย' });

  // ---- ตารางชน ----
  const solid = ground.map((row) => row.map((t) => SOLID.has(t)));
  for (const p of props) { const [fw, fh] = p.foot || [0, 0]; if (!fw) continue; const tx = Math.round(p.x / TILE) - Math.floor(fw / 2), ty = Math.round(p.y / TILE) - fh; for (let y = ty; y < ty + fh; y++) for (let x = tx; x < tx + fw; x++) if (solid[y]?.[x] !== undefined) solid[y][x] = true; }
  return { ground, solid, props, npcs, spawns, portals, labels: [] };
}
