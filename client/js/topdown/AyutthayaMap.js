// ============================================================
//  โหมดทดลอง Top-down "อยุธยา" – ไทล์เซ็ต/ผังเมือง/ของประกอบฉาก
//  ▸ ไทล์ 16px วาดด้วยโค้ดแบบพิกเซล (ชั่วคราว จนกว่าจะเจนจาก PixelLab)
//  ▸ ของประกอบใหญ่ (วัด/ศาลา/เรือน/ร้าน) ใช้ภาพพิกเซลชุดเดิมของเกม
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

let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** วาดไทล์เซ็ตลง canvas → texture 'td_tiles' (แถวเดียว 14 ไทล์) */
export function bakeTileset(scene) {
  if (scene.textures.exists('td_tiles')) return;
  const N = 14, c = document.createElement('canvas'); c.width = TILE * N; c.height = TILE;
  const ctx = c.getContext('2d');
  const px = (t, x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(t * TILE + x, y, w, h); };
  const fill = (t, col) => px(t, 0, 0, TILE, TILE, col);
  const speckle = (t, n, cols, w = 1, h = 1) => { for (let i = 0; i < n; i++) px(t, Math.floor(rnd() * TILE), Math.floor(rnd() * TILE), w, h, cols[Math.floor(rnd() * cols.length)]); };
  seed = 7;
  // หญ้า 3 แบบ
  for (const t of [T.GRASS, T.GRASS2, T.GRASS3]) { fill(t, '#5f9e4a'); speckle(t, 10, ['#6db056', '#558f42', '#6aa851']); }
  speckle(T.GRASS2, 3, ['#f2c94c', '#f5a3c7', '#ffffff']);                       // ดอกไม้เล็ก
  for (let i = 0; i < 4; i++) { const x = 2 + i * 4; px(T.GRASS3, x, 9, 1, 4, '#3f7a32'); px(T.GRASS3, x + 1, 7, 1, 6, '#3f7a32'); }  // กอหญ้า
  // ถนนดิน
  fill(T.ROAD, '#b08a5a'); speckle(T.ROAD, 12, ['#a67f50', '#bd9866', '#9c7648']); px(T.ROAD, 0, 0, TILE, 1, '#a17a4d');
  // ลานอิฐวัด
  fill(T.BRICK, '#a85a3c'); for (let y = 0; y < TILE; y += 4) for (let x = 0; x < TILE; x += 8) { const o = (y / 4) % 2 ? 4 : 0; px(T.BRICK, (x + o) % TILE, y, 7, 3, '#b8674a'); px(T.BRICK, (x + o) % TILE, y + 3, 8, 1, '#7d3f28'); px(T.BRICK, (x + o + 7) % TILE, y, 1, 3, '#7d3f28'); }
  speckle(T.BRICK, 5, ['#c6796a', '#8f4a33']);
  // ทราย/ตลิ่ง
  fill(T.SAND, '#d9c27e'); speckle(T.SAND, 10, ['#cdb46f', '#e6d193']);
  // น้ำ 2 เฟรม
  for (const [t, o] of [[T.WATER, 0], [T.WATER2, 4]]) { fill(t, '#3f7fb5'); speckle(t, 6, ['#4a8cc2', '#3a74a6']); for (let i = 0; i < 3; i++) px(t, (i * 6 + o) % TILE, 3 + i * 5, 5, 1, '#8fc6ea'); }
  // กำแพงอิฐ (ด้านหน้า) + ยอดกำแพง
  fill(T.WALL, '#8c4a34'); for (let y = 0; y < TILE; y += 4) for (let x = 0; x < TILE; x += 8) { const o = (y / 4) % 2 ? 4 : 0; px(T.WALL, (x + o) % TILE, y, 7, 3, '#9d5840'); px(T.WALL, (x + o) % TILE, y + 3, 8, 1, '#5b2e1e'); }
  px(T.WALL, 0, 0, TILE, 2, '#c07a5c');
  fill(T.WALLTOP, '#6e3a28'); px(T.WALLTOP, 0, 0, TILE, 3, '#b5715a'); for (let x = 0; x < TILE; x += 4) px(T.WALLTOP, x, 3, 2, 3, '#8c4a34'); px(T.WALLTOP, 0, TILE - 2, TILE, 2, '#4a2416');
  // นาข้าว
  fill(T.PADDY, '#4e8d3a'); for (let y = 2; y < TILE; y += 5) for (let x = 1; x < TILE; x += 4) { px(T.PADDY, x, y, 1, 3, '#8ac75e'); px(T.PADDY, x + 1, y + 1, 1, 2, '#a5d97a'); } px(T.PADDY, 0, 0, TILE, 1, '#3e7a8a');
  // ทางหิน
  fill(T.STONE, '#9a9585'); for (let y = 0; y < TILE; y += 5) for (let x = 0; x < TILE; x += 6) px(T.STONE, x + (y / 5) % 2 * 3, y, 5, 4, '#aaa596'); speckle(T.STONE, 6, ['#8a8575', '#b7b2a2']);
  // หญ้าสูง (เดินได้)
  fill(T.TALL, '#4f8b3d'); for (let x = 0; x < TILE; x += 3) { const h = 6 + Math.floor(rnd() * 8); px(T.TALL, x, TILE - h, 1, h, '#2f6b28'); px(T.TALL, x + 1, TILE - h + 3, 1, h - 3, '#79b85f'); }
  // ไม้กระดาน (สะพาน)
  fill(T.WOOD, '#9c6a3a'); for (let y = 0; y < TILE; y += 4) { px(T.WOOD, 0, y, TILE, 1, '#5e3a1c'); px(T.WOOD, 0, y + 1, TILE, 2, '#b07c46'); } px(T.WOOD, 7, 0, 1, TILE, '#5e3a1c');
  scene.textures.addCanvas('td_tiles', c);
}

/** ของประกอบฉากที่วาดด้วยโค้ด: เจดีย์ ปรางค์ ต้นไม้ ซากอิฐ */
export function bakeProps(scene) {
  const mk = (key, w, h, draw) => {
    if (scene.textures.exists(key)) return;
    const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d');
    const px = (x, y, ww, hh, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), ww, hh); };
    draw(ctx, px, w, h); scene.textures.addCanvas(key, c);
  };
  // เจดีย์ทรงระฆัง (วัดพระศรีสรรเพชญ์) – ปูนขาว/ทองซีด
  mk('td_chedi', 48, 88, (ctx, px, w, h) => {
    px(4, h - 10, 40, 10, '#b9a07a'); px(6, h - 12, 36, 2, '#d8c8a3');             // ฐานประทักษิณ
    px(10, h - 20, 28, 8, '#e8dcc2'); px(12, h - 22, 24, 2, '#f4ecd9');             // ฐานสิงห์
    for (let i = 0; i < 8; i++) { const ww = 26 - i * 2.2; px(24 - ww / 2, h - 30 - i * 4, ww, 4, i % 2 ? '#efe4cc' : '#e2d5b8'); }   // มาลัยเถา
    for (let y = h - 62; y < h - 30; y++) { const t = (y - (h - 62)) / 32, ww = 8 + 22 * Math.sin(t * Math.PI * 0.5 + 0.3); px(24 - ww / 2, y, ww, 1, y % 3 ? '#f2e9d5' : '#e5d9be'); }  // องค์ระฆัง
    px(19, h - 68, 10, 6, '#dfd2b2'); px(20, h - 66, 8, 2, '#f8f1e0');                // บัลลังก์
    for (let i = 0; i < 7; i++) { const ww = 8 - i; px(24 - ww / 2, h - 70 - i * 2, ww, 2, i % 2 ? '#e9c46a' : '#d4a93c'); }   // ปล้องไฉน
    px(23, h - 86, 2, 4, '#f4d03f'); px(22, h - 84, 4, 2, '#f4d03f');                 // ปลียอด
    px(6, h - 10, 2, 10, '#8d7455'); px(40, h - 10, 2, 10, '#8d7455');
  });
  // ปรางค์ (วัดไชยวัฒนาราม) – อิฐแดงฝักข้าวโพด
  mk('td_prang', 56, 104, (ctx, px, w, h) => {
    px(2, h - 12, 52, 12, '#8a5238'); px(4, h - 14, 48, 2, '#b07354');
    px(8, h - 28, 40, 14, '#a15b3f'); px(10, h - 30, 36, 2, '#c67a5b'); px(24, h - 24, 8, 10, '#3b1d12'); // ซุ้มประตู
    for (let i = 0; i < 12; i++) { const ww = 34 - i * 2.4, y = h - 34 - i * 5; px(28 - ww / 2, y, ww, 5, i % 2 ? '#a95f42' : '#9a5238'); px(28 - ww / 2, y, 2, 5, '#c37b5d'); px(28 + ww / 2 - 2, y, 2, 5, '#6d3823'); for (let k = 0; k < 3; k++) px(28 - ww / 2 + 3 + k * (ww / 3), y + 1, 2, 3, '#5e2e1c'); }  // ชั้นซ้อน
    px(25, 8, 6, 6, '#c78a5a'); px(27, 2, 2, 8, '#e8c170');                            // นภศูล
  });
  // ต้นไม้ใหญ่ (มะขาม/ก้ามปู)
  mk('td_tree', 40, 48, (ctx, px, w, h) => {
    px(17, 30, 6, 18, '#6b4a2a'); px(17, 30, 2, 18, '#8a6238');
    const blobs = [[20, 18, 17], [10, 22, 11], [30, 22, 11], [20, 10, 12]];
    for (const [cx, cy, r] of blobs) for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) px(cx + x, cy + y, 1, 1, (x + y) < -r * 0.4 ? '#5fa84c' : (x - y) > r * 0.6 ? '#2e6b2a' : '#3f8a37');
    for (let i = 0; i < 16; i++) px(6 + (i * 7) % 28, 6 + (i * 5) % 22, 2, 1, '#8fd070');
  });
  // ต้นตาล/มะพร้าวแบบ top-down (ใบแผ่)
  mk('td_palm', 36, 44, (ctx, px) => {
    px(16, 20, 4, 24, '#8a5e38'); px(16, 20, 1, 24, '#a8794a');
    for (let a = 0; a < 7; a++) { const ang = a * Math.PI * 2 / 7; for (let r = 2; r < 15; r++) { const x = 18 + Math.cos(ang) * r, y = 14 + Math.sin(ang) * r * 0.6; px(x - 1, y - 1, 3, 2, r < 12 ? '#2f7a32' : '#4fa04a'); } }
    px(16, 12, 4, 4, '#3d8a3a');
  });
  // ซากกำแพงอิฐ (เตี้ย เดินไม่ได้)
  mk('td_ruin', 48, 22, (ctx, px) => {
    for (let y = 4; y < 22; y += 4) for (let x = 0; x < 48; x += 8) { const o = (y / 4) % 2 ? 4 : 0; if (rnd() < 0.85 || y > 12) { px((x + o) % 48, y, 7, 3, '#9d5840'); px((x + o) % 48, y + 3, 8, 1, '#5b2e1e'); } }
    px(0, 4, 48, 1, '#c07a5c'); px(10, 0, 12, 4, '#8c4a34'); px(30, 2, 8, 2, '#8c4a34');
  });
  // ศาลาท่าน้ำเล็ก / เสาหลักเมือง
  mk('td_pillar', 16, 40, (ctx, px) => { px(4, 30, 8, 10, '#8d7455'); px(5, 6, 6, 24, '#e9dcc0'); px(5, 6, 2, 24, '#fff7e6'); px(3, 2, 10, 4, '#d4a93c'); px(6, 0, 4, 2, '#f4d03f'); });
}

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
  rect(58, 10, 61, y1 + 3, T.ROAD); rect(12, 50, 107, 52, T.ROAD); rect(58, y1 + 1, 61, RIVER.y0 - 2, T.ROAD);
  rect(58, RIVER.y1 + 2, 61, 96, T.ROAD);                      // ถนนในทุ่ง
  // ลานอิฐวัดหลวง + ทางหินรอบปรางค์
  rect(38, 16, 82, 44, T.BRICK); rect(58, 16, 61, 44, T.STONE); rect(38, 28, 82, 29, T.STONE);
  // นาข้าว + หญ้าสูงนอกเมือง
  rect(14, 78, 44, 92, T.PADDY); rect(76, 80, 108, 94, T.PADDY);
  rect(20, 96, 50, 106, T.TALL); rect(70, 98, 104, 108, T.TALL);
  // แนวอิฐริมสะพานฝั่งทุ่ง
  rect(50, RIVER.y1 + 2, 69, RIVER.y1 + 2, T.STONE);

  // ---- ของประกอบฉาก (x,y = พิกัดไทล์ของ "เท้า" ของ, foot = ขนาดชนกัน w×h ไทล์) ----
  const props = [];
  const P = (key, tx, ty, opt = {}) => props.push({ key, x: tx * TILE, y: ty * TILE, ...opt });
  P('td_chedi', 44, 25, { foot: [5, 2], scale: 2 }); P('td_chedi', 60, 24, { foot: [6, 2], scale: 2.3 }); P('td_chedi', 76, 25, { foot: [5, 2], scale: 2 });
  P('td_prang', 60, 40, { foot: [5, 2], scale: 1.8 });
  for (let x = 40; x <= 80; x += 4) if (x < 56 || x > 64) P('td_ruin', x, 31, { foot: [3, 1], scale: 1.4 });    // ซากระเบียงคด
  for (let x = 40; x <= 80; x += 4) if (x < 56 || x > 64) P('td_ruin', x, 43, { foot: [3, 1], scale: 1.4 });
  P('temple', 24, 35, { foot: [7, 2], label: 'วิหารหลวง' });
  P('sala', 95, 33, { foot: [6, 2], label: 'ศาลาลงสรง (จุดนัดปาร์ตี้)' });
  P('spirit_house', 84, 46, { foot: [2, 1], label: 'ศาลหลักเมือง' });
  P('td_pillar', 60, 46, { foot: [1, 1] });
  P('house', 20, 60, { foot: [8, 2] }); P('house', 100, 60, { foot: [8, 2], flip: true }); P('house', 98, 45, { foot: [8, 2] }); P('house', 16, 44, { foot: [8, 2], flip: true });
  P('stall', 30, 49, { foot: [6, 1], label: 'ตลาดหัวรอ' }); P('food_stall', 42, 49, { foot: [4, 1] }); P('stall', 76, 49, { foot: [6, 1] }); P('food_stall', 88, 49, { foot: [4, 1] });
  P('forge', 108, 52, { foot: [5, 2], label: 'โรงตีเหล็ก' });
  P('bounty_board', 64, 59, { foot: [2, 1], label: 'ป้ายประกาศค่าหัว' });
  P('boat', 30, 70, { foot: [0, 0], depth: 1 }); P('boat', 92, 68, { foot: [0, 0], depth: 1, flip: true });
  P('campfire', 60, 82, { foot: [1, 1], label: 'ค่ายพัก' });
  P('warp_gate', 60, 100, { foot: [4, 1], label: 'ประตูวาร์ป (กลับโหมดเดิม)', warp: true });
  // ต้นไม้ในเมือง / นอกเมือง
  const trees = [[14, 14], [24, 12], [100, 12], [108, 20], [14, 26], [104, 40], [30, 58], [90, 58], [12, 36], [110, 34], [40, 46], [80, 46],
    [6, 76], [112, 76], [10, 100], [60, 108], [30, 74], [96, 74], [116, 96], [50, 92], [70, 90], [46, 100], [110, 104], [4, 90]];
  trees.forEach(([x, y], i) => P(i % 3 === 2 ? 'td_palm' : 'td_tree', x, y, { foot: [1, 1], scale: 1.4 }));
  // บ้านเพิ่ม + บ่อน้ำ/เสา
  [[36, 58], [76, 58], [30, 20], [92, 20], [22, 52], [104, 52]].forEach(([x, y], i) => P('house', x, y, { foot: [8, 2], flip: i % 2 === 1 }));
  [[28, 44], [92, 44], [50, 58], [70, 58]].forEach(([x, y]) => P('td_pillar', x, y, { foot: [1, 1] }));
  props.push({ key: 'pr_reeds', x: 20 * TILE, y: (RIVER.y0 - 1) * TILE, foot: [0, 0] }, { key: 'pr_reeds', x: 100 * TILE, y: (RIVER.y1 + 2) * TILE, foot: [0, 0] }, { key: 'pr_reeds', x: 76 * TILE, y: (RIVER.y0 - 1) * TILE, foot: [0, 0] });

  // ---- NPC ----
  const npcs = [
    { key: 'npc_yai_tim', x: 47, y: 48, nameTh: 'ยายติ๋ม', role: 'ร้านยา·ของใช้', color: '#82e0aa', lines: ['ยาดองยาต้มมีครบ ซื้อติดตัวก่อนออกนอกกำแพงนะหนู', 'ตลาดหัวรอนี่คึกคักตั้งแต่สมัยพระนารายณ์แล้ว'] },
    { key: 'npc_lung_chai', x: 63, y: 44, nameTh: 'ผู้ใหญ่ชัย', role: 'เควส', color: '#f7dc6f', lines: ['เจดีย์สามองค์นั่นบรรจุพระบรมอัฐิของกษัตริย์สามพระองค์ ห้ามปีนเด็ดขาด', 'ผีทุ่งข้างนอกกำแพงชุมขึ้นทุกคืน ช่วยไปปราบทีเถอะ'] },
    { key: 'npc_kru_sword', x: 55, y: 58, nameTh: 'ครูเหม', role: 'สำนักดาบ', color: '#f1948a', lines: ['ออกประตูเมืองไปทางใต้ ข้ามสะพานแล้วจะเจอทุ่งนา ระวังกุมารทองซุกซน', 'คลิกที่พื้นเพื่อเดิน คลิกที่ผีเพื่อโจมตี จำไว้!'] },
    { key: 'npc_pa_sa', x: 38, y: 64, nameTh: 'ป้าสา', role: 'ครัว·ท่าน้ำ', color: '#85c1e9', lines: ['แม่น้ำสายนี้ไหลอ้อมเกาะเมืองทั้งเกาะ เรือสำเภาจากเมืองจีนจอดแถวนี้แหละ', 'อยากได้ปลาต้มเค็มไหม ป้าเพิ่งได้ปลาจากเรือมา'] },
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
