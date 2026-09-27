// ============================================================
//  ผังเมือง "กรุงศรีอยุธยา" (New Version top-down) – ใช้ร่วม client/server
//  ▸ ข้อมูลล้วน (ไม่มี canvas) → server ใช้ตารางชน/จุดเกิดผี/ตำแหน่ง NPC ชุดเดียวกับ client
// ============================================================
export const TILE = 16;
export const MAP_W = 120, MAP_H = 112;

// ดัชนีไทล์
export const T = { GRASS: 0, GRASS2: 1, GRASS3: 2, ROAD: 3, BRICK: 4, SAND: 5, WATER: 6, WATER2: 7, WALL: 8, PADDY: 9, STONE: 10, TALL: 11, WOOD: 12, WALLTOP: 13 };
export const SOLID = new Set([T.WATER, T.WATER2, T.WALL, T.WALLTOP]);

// ---- แถวสำคัญของผัง (หน่วยไทล์) ----
export const RIVER = { y0: 66, y1: 71 };          // แม่น้ำเจ้าพระยา (ตัดผังแนวนอน)
export const BRIDGE = { x0: 57, x1: 62 };         // สะพานไม้ข้ามแม่น้ำ
export const TOWN = { x0: 8, y0: 6, x1: 111, y1: 62 }; // กำแพงเมือง
export const GATE = { x0: 57, x1: 62 };           // ประตูเมืองด้านใต้ (ในแถว TOWN.y1)


let seed = 1234;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/**
 * ผังเมือง: คืน { ground: number[][], solid: boolean[][], props: [...], npcs: [...], spawns: [...] }
 */
export function buildLayout() {
  seed = 1234;
  const ground = Array.from({ length: MAP_H }, () => new Array(MAP_W).fill(T.GRASS));
  const set = (x, y, t) => { if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) ground[y][x] = t; };
  const rect = (x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, t); };

  // หญ้าสุ่ม
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) { const r = rnd(); ground[y][x] = r < 0.08 ? T.GRASS2 : r < 0.18 ? T.GRASS3 : T.GRASS; }

  // แม่น้ำ + ตลิ่ง + สะพาน
  rect(0, RIVER.y0 - 1, MAP_W - 1, RIVER.y0 - 1, T.SAND); rect(0, RIVER.y1 + 1, MAP_W - 1, RIVER.y1 + 1, T.SAND);
  for (let y = RIVER.y0; y <= RIVER.y1; y++) for (let x = 0; x < MAP_W; x++) set(x, y, rnd() < 0.5 ? T.WATER : T.WATER2);
  rect(BRIDGE.x0, RIVER.y0 - 1, BRIDGE.x1, RIVER.y1 + 1, T.WOOD);

  // กำแพงเมือง (แถวบน = ยอดกำแพง, แถวล่าง = หน้ากำแพง) เว้นประตูใต้
  const { x0, y0, x1, y1 } = TOWN;
  rect(x0, y0, x1, y0, T.WALLTOP); rect(x0, y0 + 1, x1, y0 + 1, T.WALL);
  rect(x0, y1 - 1, x1, y1 - 1, T.WALLTOP); rect(x0, y1, x1, y1, T.WALL);
  rect(x0, y0, x0 + 1, y1, T.WALLTOP); rect(x1 - 1, y0, x1, y1, T.WALLTOP);
  rect(GATE.x0, y1 - 1, GATE.x1, y1, T.STONE);                 // ประตูเมือง

  // ถนนหลัก N-S จากประตูขึ้นไปวัด + ถนน E-W (ตลาด) + ถนนลงสะพาน
  // ถนนในเมืองปูหิน (แบบเมือง RO) · นอกกำแพงเป็นถนนดิน
  rect(58, 10, 61, y1, T.STONE); rect(12, 50, 107, 52, T.STONE); rect(58, y1 + 1, 61, RIVER.y0 - 2, T.ROAD);
  rect(52, 45, 67, 57, T.STONE);                               // ลานเมืองกลางสี่แยก (จุดนัดพบ)
  rect(58, RIVER.y1 + 2, 61, 96, T.ROAD);                      // ถนนในทุ่ง
  // ลานอิฐวัดหลวง + ทางหินรอบปรางค์
  // วัดพระศรีสรรเพชญ์: สนามหญ้า + ฐานศิลาแลงใต้เจดีย์ + ทางเดินอิฐ (แบบภาพอยุธยาจริง)
  rect(40, 20, 80, 27, T.BRICK); rect(53, 35, 67, 42, T.BRICK); rect(58, 16, 61, 44, T.STONE); rect(38, 28, 82, 29, T.STONE);
  // นาข้าว + หญ้าสูงนอกเมือง
  rect(14, 78, 44, 92, T.PADDY); rect(66, 86, 78, 94, T.PADDY);
  // วัดไชยวัฒนาราม (ริมน้ำฝั่งทุ่ง): สนามหญ้า · ระเบียงคดศิลาแลง · ฐานประธาน · ทางอิฐจากถนนทุ่ง
  rect(82, 76, 102, 93, T.GRASS); rect(82, 76, 102, 76, T.BRICK); rect(82, 93, 102, 93, T.BRICK); rect(82, 76, 82, 93, T.BRICK); rect(102, 76, 102, 93, T.BRICK);
  rect(87, 80, 97, 88, T.BRICK); rect(62, 84, 87, 85, T.BRICK);
  rect(20, 96, 50, 106, T.TALL); rect(70, 98, 104, 108, T.TALL);
  // แนวอิฐริมสะพานฝั่งทุ่ง
  rect(50, RIVER.y1 + 2, 69, RIVER.y1 + 2, T.STONE);

  // ---- ของประกอบฉาก (x,y = พิกัดไทล์ของ "เท้า" ของ, foot = ขนาดชนกัน w×h ไทล์) ----
  //  key 'env/…' = ภาพ PixelLab (assets/td/env) · alt = ภาพสำรองที่วาดด้วยโค้ดถ้ายังไม่มีไฟล์ · glow = แสงกลางคืน [dy, รัศมี, สี, ความแรง]
  const props = [];
  const P = (key, tx, ty, opt = {}) => props.push({ key, x: tx * TILE, y: ty * TILE, ...opt });
  const LAMP = [-26, 40, 0xffc46b, 1], TORCH = [-22, 46, 0xff9a3c, 1.1], WIN = [-30, 30, 0xffd27a, 0.8];
  const TREE_K = { tamarind: 0.8, palm: 0.72, golden: 0.72, bamboo: 0.62 };
  const tree = (tx, ty, kind = 'tamarind', sc = 1) => {
    const alt = kind === 'palm' ? 'td_palm' : 'td_tree';
    P(`env/t_${kind}`, tx, ty, { foot: [1, 1], alt, scale: sc * TREE_K[kind], altScale: 1.4 * sc, flip: rnd() < 0.5 });
  };
  // ของชิ้นเล็ก (ภาพ 48px) ย่อ 0.6 ให้สมส่วนกับตัวละคร · scale ใน opt = ตัวคูณเพิ่ม
  const VAR = new Set(['torch', 'fence', 'pots', 'cart', 'haystack', 'bamboo', 'frangipani', 'lotus', 'buddha', 'ruin', 'buddhahead', 'bench', 'shrub', 'well']);
  const vk = (key) => (VAR.has(key.slice(2)) && rnd() < 0.5 ? key + '2' : key);   // สุ่มแบบที่ 2 (ผังคงที่เพราะ seed ตายตัว)
  const BASE = { p_stall: 1.5, p_bamboo: 1.5, p_haystack: 1.3, p_well: 1.2, p_cart: 1.1, p_lantern: 1.1, p_torch: 1.1 };
  const small = (key, tx, ty, opt = {}) => P(`env/${vk(key)}`, tx, ty, { foot: [1, 1], ...opt, scale: 0.6 * (BASE[key] || 1) * (opt.scale || 1), altScale: opt.scale || 1 });
  const deco = (key, tx, ty, opt = {}) => P(`env/${vk(key)}`, tx, ty, { foot: [0, 0], ...opt, scale: 0.6 * (BASE[key] || 1) * (opt.scale || 1), altScale: opt.scale || 1 });   // เดินผ่านได้

  // === วัดพระศรีสรรเพชญ์ (ลานอิฐกลางเมือง) ===
  // เจดีย์ประธาน 3 องค์ (ภาพ PixelLab ทรงระฆังอิฐเก่า · สำรอง = เจดีย์ขาววาดด้วยโค้ด)
  for (const [x, y, sc] of [[44, 25, 1.55], [60, 24, 1.9], [76, 25, 1.55]]) P('env/m_chedi_l', x, y, { foot: [sc > 1.7 ? 8 : 7, 3], scale: sc, alt: 'td_chedi', altScale: sc > 1.7 ? 2.3 : 2, glow: [-60, 70, 0xfff0c0, 0.5] });
  P('env/b_wat', 60, 41, { foot: [8, 3], scale: 1.35, alt: 'td_prang', altScale: 1.8, label: 'พระมณฑป', glow: [-50, 90, 0xffe1a0, 0.7] });
  for (const [x, y] of [[46, 38], [74, 38], [41, 41], [79, 41]]) P('env/m_chedi_l', x, y, { foot: [3, 2], scale: x % 2 ? 0.55 : 0.7 });   // เจดีย์ราย
  for (let x = 40; x <= 80; x += 4) if (x < 56 || x > 64) P('td_ruin', x, 31, { foot: [3, 1], scale: 1.4 });    // ซากระเบียงคด
  for (let x = 40; x <= 80; x += 4) if (x < 54 || x > 66) P('td_ruin', x, 43, { foot: [3, 1], scale: 1.4 });
  for (let x = 40; x <= 80; x += 3) if (x < 55 || x > 64) small('p_buddha', x, 19, { glow: [-8, 16, 0xffe9a0, 0.35] });   // พระพุทธรูปเรียงแถว (แบบวัดใหญ่ชัยมงคล)
  for (const y of [22, 28, 34]) { small('p_lantern', 56, y, { glow: LAMP }); small('p_lantern', 63, y, { glow: LAMP }); }  // โคมริมทางหินกลางวัด
  small('p_lion', 56, 45, { scale: 1.2 }); small('p_lion', 63, 45, { scale: 1.2, flip: true });                               // สิงห์ทวารบาล
  for (const [x, y] of [[40, 38], [80, 38], [40, 22], [80, 22]]) deco('p_lotus', x, y);
  small('p_torch', 50, 36, { glow: TORCH }); small('p_torch', 70, 36, { glow: TORCH });
  // วิหาร/อุโบสถ/หอระฆังรอบวัด
  P('env/b_viharn', 24, 36, { foot: [7, 3], scale: 1.3, alt: 'temple', altScale: 1, label: 'วิหารหลวง', glow: [-40, 80, 0xffe1a0, 0.7] });
  P('env/b_ubosot', 92, 24, { foot: [7, 3], scale: 1.2, alt: 'env/b_viharn', flip: true, label: 'พระอุโบสถ', glow: [-40, 70, 0xffe1a0, 0.6] });
  P('env/b_prang', 30, 23, { foot: [3, 2], scale: 1, alt: 'td_prang', altScale: 1.4, label: 'ปรางค์ศิลา' });
  P('env/b_wat2', 104, 26, { foot: [7, 3], scale: 1, label: 'วิหารไม้', glow: [-40, 60, 0xffe1a0, 0.5] });
  deco('p_buddhahead', 86, 36, { scale: 1.3, label: 'เศียรพระในรากไม้' }); tree(88, 34, 'tamarind', 1.1);
  P('env/b_sala', 97, 34, { foot: [6, 3], scale: 1.1, alt: 'sala', altScale: 1, label: 'ศาลาลงสรง (จุดนัดปาร์ตี้)', glow: [-30, 60, 0xffe1a0, 0.6] });
  P('spirit_house', 84, 46, { foot: [2, 1], label: 'ศาลหลักเมือง', alt2: 'env/p_spirit' });
  P('td_pillar', 60, 46, { foot: [1, 1], glow: [-30, 42, 0xffc46b, 1] });
  P('env/m_compound', 17, 25, { foot: [7, 3], label: 'วัดมหาธาตุ', glow: [-40, 60, 0xffe1a0, 0.5] });
  small('p_drum', 34, 26, { scale: 1.2 }); small('p_gong', 26, 40); small('p_candle', 21, 40, { glow: [-18, 20, 0xffd27a, 0.7] }); small('p_candle', 27, 40, { glow: [-18, 20, 0xffd27a, 0.7] });
  small('p_offering', 58, 45); small('p_candle', 64, 44, { glow: [-18, 20, 0xffd27a, 0.7] });

  // === ย่านบ้านเรือน (ตะวันตก/ตะวันออก) ===
  const HOUSES = [[16, 44, 0], [22, 52, 1], [20, 60, 0], [36, 58, 1], [98, 45, 1], [104, 52, 0], [100, 60, 1], [76, 58, 0], [14, 30, 0], [104, 30, 1]];
  HOUSES.forEach(([x, y, f], i) => {
    P(['env/b_ruenthai', 'env/b_house2', 'house'][i % 3], x, y, { foot: [6, 2], scale: 0.95, alt: 'house', altScale: 1, flip: !!f, glow: WIN });
    // ของรอบบ้าน: โอ่ง, หม้อ, รั้ว, กล้วย, ลีลาวดี
    small('p_jar', x + (f ? -4 : 4), y); deco('p_plants', x + (f ? -4 : 4), y + 2); small(i % 2 ? 'p_pots' : 'p_jar', x + (f ? -5 : 5), y - 1);
    deco('p_fence', x - 2, y + 2); deco('p_fence', x + 1, y + 2);
    tree(x + (f ? 5 : -5), y - 1, i % 2 ? 'bamboo' : 'palm', 0.9);
    deco('p_frangipani', x + (f ? -3 : 3), y + 2);
  });

  // === ตลาดหัวรอ (ถนนตะวันออก–ตะวันตก) ===
  P('stall', 30, 49, { foot: [6, 1], label: 'ตลาดหัวรอ', glow: [-20, 40, 0xffb35c, 0.9] }); P('food_stall', 42, 49, { foot: [4, 1], glow: [-20, 40, 0xffb35c, 0.9] });
  P('stall', 76, 49, { foot: [6, 1], glow: [-20, 40, 0xffb35c, 0.9] }); P('food_stall', 88, 49, { foot: [4, 1], glow: [-20, 40, 0xffb35c, 0.9] });
  for (const x of [35, 38, 46, 71, 81, 84, 93]) small('p_stall', x, 49, { glow: [-14, 30, 0xffb35c, 0.8] });
  for (const x of [26, 33, 44, 80, 90]) small('p_stall', x, 56, { glow: [-14, 30, 0xffb35c, 0.8], flip: true });
  for (const [x, y] of [[29, 48], [40, 48], [74, 48], [86, 48], [36, 57], [83, 57]]) small(rnd() < 0.5 ? 'p_pots' : 'p_jar', x, y);
  for (const [x, y] of [[32, 55], [45, 55], [78, 55], [89, 55]]) small('p_table', x, y); for (const [x, y] of [[48, 48], [70, 48]]) deco('p_tray', x, y);
  small('p_cart', 24, 48); small('p_cart', 96, 48, { flip: true });
  for (const x of [16, 22, 50, 66, 98, 106]) small('p_lantern', x, 49, { glow: LAMP });   // โคมริมถนนตลาด
  P('forge', 108, 52, { foot: [5, 2], label: 'โรงตีเหล็ก', glow: [-20, 60, 0xff8a3c, 1] });
  P('bounty_board', 64, 59, { foot: [2, 1], label: 'ป้ายประกาศค่าหัว' });

  // === ถนนหลวง + ประตูเมืองใต้ ===
  for (const y of [48, 56]) { small('p_lantern', 56, y, { glow: LAMP }); small('p_lantern', 63, y, { glow: LAMP }); }
  small('p_torch', 55, 60, { glow: TORCH }); small('p_torch', 64, 60, { glow: TORCH });
  small('p_lion', 55, 61, { scale: 1.2 }); small('p_lion', 64, 61, { scale: 1.2, flip: true });
  [[28, 44], [92, 44], [50, 58], [70, 58]].forEach(([x, y]) => P('td_pillar', x, y, { foot: [1, 1], glow: [-30, 42, 0xffc46b, 1] }));

  // ลานเมือง: อ่างบัวสี่มุม + กระถางไม้ดอก (จุดนัดพบกลางเมืองแบบ RO)
  for (const [x, y] of [[53, 46], [66, 46], [53, 57], [66, 57]]) small('p_lotus', x, y, { scale: 1.3 });
  for (const [x, y] of [[55, 46], [64, 46]]) deco('p_plants', x, y);
  // แนวต้นไม้หนาริมกำแพงด้านใน (กรอบเมืองให้ดูแน่น)
  for (let x = 13; x <= 107; x += 6) if (x < 50 || x > 70) tree(x, 10, ['tamarind', 'golden', 'palm'][x % 3], 0.95);
  for (let y = 14; y <= 58; y += 7) { tree(12, y, y % 2 ? 'palm' : 'tamarind', 0.9); tree(108, y, y % 2 ? 'tamarind' : 'palm', 0.9); }
  // === ต้นไม้ในเมือง (ริมกำแพง/สวน) ===
  [[14, 14], [24, 12], [100, 12], [108, 20], [14, 22], [110, 36], [12, 38], [40, 46], [80, 46], [34, 12], [86, 12], [50, 11], [70, 11], [108, 44], [12, 50]]
    .forEach(([x, y], i) => tree(x, y, ['tamarind', 'golden', 'palm', 'tamarind'][i % 4], 1));
  for (const [x, y] of [[18, 9], [20, 10], [102, 9], [104, 10], [11, 56], [109, 58]]) small('p_bamboo', x, y);
  for (const [x, y] of [[36, 16], [84, 16], [36, 42], [84, 42], [52, 46], [68, 46]]) deco('p_frangipani', x, y);

  // บ่อน้ำ ม้านั่ง พุ่มดอกไม้
  small('p_well', 26, 46); small('p_well', 94, 56); small('p_well', 82, 30);
  for (const [x, y] of [[48, 57], [72, 57], [36, 33], [84, 33], [66, 45]]) small('p_bench', x, y);
  for (const [x, y] of [[12, 12], [30, 10], [90, 10], [108, 12], [12, 60], [108, 60], [54, 58], [66, 58], [36, 46], [84, 46], [20, 30], [100, 30]]) deco('p_shrub', x, y);
  // === ท่าน้ำ + แม่น้ำ ===
  P('env/b_sala2', 46, 65, { foot: [5, 2], scale: 0.85, glow: [-30, 50, 0xffe1a0, 0.6] });
  P('boat', 30, 70, { foot: [0, 0], depth: 1 }); P('boat', 92, 68, { foot: [0, 0], depth: 1, flip: true }); P('boat', 74, 70, { foot: [0, 0], depth: 1 });
  for (const x of [8, 20, 34, 70, 84, 104, 114]) deco('p_lotus', x, RIVER.y0 - 1);
  for (const [x, y] of [[26, 64], [66, 64], [88, 64], [12, 64], [112, 64]]) tree(x, y, 'palm', 1);
  for (const [x, y] of [[14, 74], [40, 74], [80, 74], [100, 74]]) tree(x, y, 'palm', 1.1);
  small('p_torch', 56, 64, { glow: TORCH }); small('p_torch', 63, 64, { glow: TORCH });

  // === ทุ่งนาบางปะอิน (ต้นตาลริมคันนา · ฟาง · ซากวัดร้าง) ===
  for (let x = 14; x <= 44; x += 5) tree(x, 77, 'palm', 1 + (x % 3) * 0.08);
  for (let x = 66; x <= 110; x += 5) if (x < 78 || x > 106) tree(x, 79, 'palm', 1 + (x % 3) * 0.08);
  for (const [x, y] of [[18, 84], [30, 90], [40, 82], [70, 90], [75, 93], [108, 84]]) small('p_haystack', x, y);
  P('campfire', 60, 82, { foot: [1, 1], label: 'ค่ายพัก', glow: [-10, 80, 0xff8a3c, 1.3] });
  small('p_torch', 57, 80, { glow: TORCH }); small('p_torch', 63, 80, { glow: TORCH }); small('p_cart', 64, 84, { scale: 1.2 }); small('p_haystack', 56, 85);
  small('p_spirit', 52, 76, { label: 'ศาลตายาย' });
  // --- วัดไชยวัฒนาราม: ปรางค์ประธาน + ปรางค์ทิศ/เมรุทิศรายรอบ + ระเบียงคด + พระพุทธรูปเรียงรอบ ---
  P('env/m_prangbig_l', 92, 87, { foot: [6, 3], scale: 1.6, alt: 'env/m_prangbig', label: 'วัดไชยวัฒนาราม', glow: [-80, 110, 0xffe1a0, 0.7] });
  for (const [x, y, sc] of [[85, 80, 0.95], [99, 80, 0.95], [85, 91, 1], [99, 91, 1], [85, 86, 0.8], [99, 86, 0.8], [92, 79, 0.75]]) P('env/b_prang_l', x, y, { foot: [2, 2], scale: sc, alt: 'env/b_prang', flip: x > 92 });
  for (let x = 84; x <= 100; x += 3) if (x < 90 || x > 94) P('td_ruin', x, 77, { foot: [3, 1], scale: 1.3 });   // ระเบียงคดด้านเหนือ
  for (let x = 84; x <= 100; x += 3) if (x < 90 || x > 94) P('td_ruin', x, 94, { foot: [3, 1], scale: 1.3 });   // ด้านใต้
  for (let y = 79; y <= 92; y += 2) { if (y < 83 || y > 86) small('p_ruin', 82, y, { scale: 1.1 }); small('p_ruin', 102, y, { scale: 1.1 }); }
  for (let x = 86; x <= 98; x += 2) small('p_buddha', x, 78, { glow: [-8, 14, 0xffe9a0, 0.3] });
  small('p_torch', 88, 84, { glow: TORCH }); small('p_torch', 88, 87, { glow: TORCH });
  tree(80, 75, 'tamarind', 1.2); tree(104, 75, 'tamarind', 1.1); tree(105, 95, 'golden', 1); tree(79, 95, 'tamarind', 1);
  P('env/m_mondop', 77, 96, { foot: [6, 3], label: 'มณฑปร้าง' });
  // วัดร้างในทุ่งหญ้าสูง (ผีชุม)
  for (const [x, y] of [[24, 102], [30, 106], [38, 100], [88, 104], [96, 100], [100, 108]]) small('p_ruin', x, y, { scale: 1.2, alt: 'td_ruin' });
  deco('p_buddhahead', 34, 104, { scale: 1.2 }); small('p_buddha', 92, 106);
  [[6, 76], [112, 76], [10, 100], [60, 108], [116, 96], [50, 92], [70, 90], [46, 100], [110, 104], [4, 90], [66, 100], [16, 94]]
    .forEach(([x, y], i) => tree(x, y, ['tamarind', 'golden', 'tamarind', 'bamboo'][i % 4], 1.1));
  P('env/b_chediruin', 31, 101, { foot: [6, 2], label: 'วัดร้าง' }); P('env/b_chediruin', 95, 103, { foot: [6, 2], flip: true });
  P('env/b_village', 8, 90, { foot: [6, 2], glow: WIN }); P('env/b_hamlet', 113, 89, { foot: [6, 2], glow: WIN });
  for (const [x, y] of [[20, RIVER.y0 - 1], [76, RIVER.y0 - 1], [100, RIVER.y1 + 2], [8, RIVER.y1 + 2]]) { deco('p_bamboo', x, y); deco('p_lotus', x + 2, y); }

  // ---- NPC ----
  // id = รหัส NPC บริการเดียวกับ shared/data/npcs.js (server ใช้ตรวจว่ายืนใกล้ร้านจริงไหม)
  const npcs = [
    { id: 'shop',      key: 'npc_yai_tim',    x: 47, y: 47, nameTh: 'ยายติ๋ม', role: 'ร้านยา·ของใช้', color: '#82e0aa', lines: ['ยาดองยาต้มมีครบ ซื้อติดตัวก่อนออกนอกกำแพงนะหนู', 'ตลาดหัวรอนี่คึกคักตั้งแต่สมัยพระนารายณ์แล้ว'] },
    { id: 'quest',     key: 'npc_lung_chai',  x: 63, y: 46, nameTh: 'ผู้ใหญ่ชัย', role: 'เควส', color: '#f7dc6f', lines: ['เจดีย์สามองค์นั่นบรรจุพระบรมอัฐิของกษัตริย์สามพระองค์ ห้ามปีนเด็ดขาด', 'ผีทุ่งข้างนอกกำแพงชุมขึ้นทุกคืน ช่วยไปปราบทีเถอะ'] },
    { id: 'smith',     key: 'npc_lung_dam',   x: 104, y: 55, nameTh: 'ลุงดำ', role: 'ตีเหล็ก·หลอมอุปกรณ์', color: '#f5b041', lines: ['เหล็กน้ำพี้ตีดาบดีที่สุดในแผ่นดิน', 'เอาของมาตีบวกได้ แต่ถ้าแตกอย่ามาโทษลุงนะ'] },
    { id: 'tailor',    key: 'npc_mae_choy',   x: 26, y: 54, nameTh: 'แม่ช้อย', role: 'ชุดแต่งตัว·ย้อมสี', color: '#f5b7b1', lines: ['ผ้าไหมจากเมืองจีนเพิ่งมากับเรือสำเภาเมื่อวาน', 'อยากเปลี่ยนสีผมไหมจ๊ะ แม่ย้อมให้'] },
    { id: 'cook',      key: 'npc_pa_sa',      x: 38, y: 64, nameTh: 'ป้าสา', role: 'ครัว·ท่าน้ำ', color: '#85c1e9', lines: ['แม่น้ำสายนี้ไหลอ้อมเกาะเมืองทั้งเกาะ เรือสำเภาจากเมืองจีนจอดแถวนี้แหละ', 'อยากได้ปลาต้มเค็มไหม ป้าเพิ่งได้ปลาจากเรือมา'] },
    { id: 'kru_sword', key: 'npc_kru_sword',  x: 52, y: 54, nameTh: 'ครูเหม', role: 'สำนักดาบ', color: '#f1948a', lines: ['ออกประตูเมืองไปทางใต้ ข้ามสะพานแล้วจะเจอทุ่งนา ระวังกุมารทองซุกซน', 'คลิกที่พื้นเพื่อเดิน คลิกที่ผีเพื่อโจมตี จำไว้!'] },
    { id: 'kru_mage',  key: 'npc_kru_mage',   x: 47, y: 54, nameTh: 'หลวงตาเผือก', role: 'หมอธรรม·อาคม', color: '#bb8fce', lines: ['คาถาอาคมต้องฝึกทุกวัน ใจต้องนิ่ง', 'ผีกระสือกลัวหนามพุทรานะ จำไว้'] },
    { id: 'kru_archer',key: 'npc_kru_archer', x: 68, y: 54, nameTh: 'พรานแก้ว', role: 'ค่ายพรานไพร', color: '#82e0aa', lines: ['ธนูไม้ไผ่ของข้ายิงไกลกว่าใครในกรุง', 'ยิงจากระยะไกล อย่าให้ผีเข้าประชิด'] },
    { id: 'kru_boxer', key: 'npc_kru_boxer',  x: 73, y: 54, nameTh: 'ครูแดง', role: 'ค่ายมวย', color: '#f5b041', lines: ['มวยไทยคือศิลปะแม่ไม้ของบรรพบุรุษ', 'หมัด ศอก เข่า เท้า ใช้ให้ครบ!'] },
].map((n) => ({ ...n, x: n.x * TILE, y: n.y * TILE }));

  // ---- จุดเกิดผี (ทุ่งใต้แม่น้ำ) ----
  const spawns = [];
  const S = (id, tx, ty, r = 4) => spawns.push({ id, x: tx * TILE, y: ty * TILE, r: r * TILE });
  [[40, 80], [50, 86], [66, 84], [72, 78], [56, 90]].forEach(([x, y]) => S('phi_tuay_kaew', x, y));
  [[24, 98], [34, 102], [44, 96], [28, 88]].forEach(([x, y]) => S('kuman_thong', x, y));
  [[84, 100], [96, 104], [104, 92]].forEach(([x, y]) => S('nang_tani', x, y, 3));

  // ---- ตารางชน ----
  const solid = ground.map((row) => row.map((t) => SOLID.has(t)));
  for (const p of props) { const [fw, fh] = p.foot || [0, 0]; if (!fw) continue; const tx = Math.round(p.x / TILE) - Math.floor(fw / 2), ty = Math.round(p.y / TILE) - fh; for (let y = ty; y < ty + fh; y++) for (let x = tx; x < tx + fw; x++) if (solid[y]?.[x] !== undefined) solid[y][x] = true; }
  return { ground, solid, props, npcs, spawns };
}
