// ============================================================
//  โหมด Top-down "อยุธยา" – วาดไทล์เซ็ต/ของประกอบฉากชั่วคราว (ฝั่ง client)
//  ผัง/ตารางชน/จุดเกิด อยู่ที่ shared/td/ayutthaya.js (ใช้ร่วมกับ server)
// ============================================================
import { TILE, T } from '/shared/td/ayutthaya.js';
export * from '/shared/td/ayutthaya.js';

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
  fill(T.BRICK, '#a8643e'); for (let y = 0; y < TILE; y += 4) for (let x = 0; x < TILE; x += 8) { const o = (y / 4) % 2 ? 4 : 0; px(T.BRICK, (x + o) % TILE, y, 7, 3, rnd() < 0.3 ? '#c4834f' : '#b9744a'); px(T.BRICK, (x + o) % TILE, y + 3, 8, 1, '#7a4a2c'); px(T.BRICK, (x + o + 7) % TILE, y, 1, 3, '#7a4a2c'); }
  speckle(T.BRICK, 7, ['#d29a64', '#8f5433', '#6f8a4a']);
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
  fill(T.STONE, '#8f8672'); for (let y = 0; y < TILE; y += 5) for (let x = 0; x < TILE; x += 6) { px(T.STONE, x + (y / 5) % 2 * 3, y, 5, 4, rnd() < 0.3 ? '#bdb296' : '#b0a488'); px(T.STONE, x + (y / 5) % 2 * 3, y, 5, 1, '#cfc5a8'); } speckle(T.STONE, 6, ['#9a8f76', '#c9bf9f']);
  // หญ้าสูง (เดินได้)
  fill(T.TALL, '#4f8b3d'); for (let x = 0; x < TILE; x += 3) { const h = 6 + Math.floor(rnd() * 8); px(T.TALL, x, TILE - h, 1, h, '#2f6b28'); px(T.TALL, x + 1, TILE - h + 3, 1, h - 3, '#79b85f'); }
  // ไม้กระดาน (สะพาน)
  fill(T.WOOD, '#9c6a3a'); for (let y = 0; y < TILE; y += 4) { px(T.WOOD, 0, y, TILE, 1, '#5e3a1c'); px(T.WOOD, 0, y + 1, TILE, 2, '#b07c46'); } px(T.WOOD, 7, 0, 1, TILE, '#5e3a1c');
  const tex = scene.textures.addCanvas('td_tiles', c);
  for (let i = 0; i < N; i++) tex.add(i, 0, i * TILE, 0, TILE, TILE);   // เฟรมรายไทล์ (ใช้กับ tileSprite)
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
  // ใบเสมาบนสันกำแพงเมือง (ปูนขาว ยอดแหลมมน)
  mk('td_sema', 14, 14, (ctx, px) => {
    px(1, 10, 12, 4, '#cfc3a8'); px(1, 13, 12, 1, '#8a7a5c');
    for (let y = 0; y < 10; y++) { const w = Math.round(4 + 6 * Math.sin(Math.min(1, (y + 1) / 7) * Math.PI / 2)); px(7 - w / 2, y + 1, w, 1, y < 2 ? '#fffaf0' : '#efe6d2'); }
    px(10, 4, 2, 7, '#c9bc9e'); px(3, 3, 1, 6, '#ffffff'); px(6, 0, 2, 2, '#d8cbad');
  });
  // ศาลาท่าน้ำเล็ก / เสาหลักเมือง
  mk('td_pillar', 16, 40, (ctx, px) => { px(4, 30, 8, 10, '#8d7455'); px(5, 6, 6, 24, '#e9dcc0'); px(5, 6, 2, 24, '#fff7e6'); px(3, 2, 10, 4, '#d4a93c'); px(6, 0, 4, 2, '#f4d03f'); });
}

