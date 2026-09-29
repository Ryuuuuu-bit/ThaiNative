// ============================================================
//  ลานสุริยคราส (แมพอีเวนต์บอสโลกพระราหู) – 84×80 ไทล์
//  ▸ ลานวงกลมรัศมี 26 ไทล์กลางทะเลเมฆม่วง (เมฆ = ชน) · ประตูลานด้านล่าง → ค่ายรอคราส (Safe Zone ไม่มีกับดัก)
//  ▸ ผังตายตัว (client/server ได้ผังเดียวกัน) · บอส/ผลึก/บริวารเป็น "จุดเกิด" ที่หลับอยู่ ตัวควบคุมอีเวนต์ปลุกเอง
// ============================================================
import { TILE, T, SOLID } from './ayutthaya.js';
import { ARENA, WB_ID, WB_SHADES, WB_CRYSTALS, TRAPS } from '../data/worldboss.js';

export const ARENA_DEF = {
  id: 'suriya', nameTh: 'ลานสุริยคราส', icon: '🌑', lv: [90, 150], reqLv: 1, W: ARENA.W, H: ARENA.H,
  sub: 'บอสโลก · พระราหู Lv.150', color: '#af7ac5', music: 'ayt_night', noFish: true, event: true,
  hub: { x: ARENA.camp.x, y: ARENA.camp.y, r: ARENA.camp.r, nameTh: 'ค่ายรอคราส' },
  style: { overlay: 'rgba(40,16,80,0.34)', water: 'rgba(34,14,62,0.92)', waterTint: 0x4a3a8a },
};

export function buildArena() {
  const { W, H, cx, cy, r } = ARENA;
  let seed = 9901;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const inMap = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const ground = Array.from({ length: H }, () => new Array(W).fill(T.WATER));      // ทะเลเมฆ (ชน)
  const set = (x, y, t) => { if (inMap(x, y)) ground[y][x] = t; };
  const disc = (x0, y0, rr, t, r0 = -1) => { for (let y = Math.floor(y0 - rr); y <= y0 + rr; y++) for (let x = Math.floor(x0 - rr); x <= x0 + rr; x++) { const d = Math.hypot(x - x0, y - y0); if (d <= rr && d > r0) set(x, y, t); } };
  const rect = (x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, t); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (rnd() < 0.45) ground[y][x] = T.WATER2;
  // ลาน: หินอิฐเข้ม + วงอิฐขอบ · ดาวแปดแฉกกลางลาน (ลายพื้น)
  disc(cx, cy, r + 1, T.STONE); disc(cx, cy, r, T.BRICK); disc(cx, cy, r - 0.2, T.STONE, r - 1.4);
  disc(cx, cy, 7, T.SAND); disc(cx, cy, 6, T.BRICK);                          // แท่นกลางลาน (จุดบอสลอย)
  // ทางเดินประตู → ค่าย
  const [g0, g1] = ARENA.gateY;
  rect(cx - 2, cy + r - 1, cx + 2, g1, T.STONE); rect(cx - 1, cy + r, cx + 1, g1, T.ROAD);
  const cp = ARENA.camp;
  disc(cp.x, cp.y, cp.r + 1.5, T.SAND); disc(cp.x, cp.y, cp.r, T.GRASS2); disc(cp.x, cp.y, cp.r + 1, T.BRICK, cp.r);
  rect(cx - 1, g0, cx + 1, cp.y - cp.r + 1, T.ROAD);

  const props = [], npcs = [], spawns = [], portals = [];
  const P = (key, tx, ty, opt = {}) => props.push({ key, x: tx * TILE, y: ty * TILE, ...opt });
  const small = (key, tx, ty, opt = {}) => P(`env/${key}`, tx, ty, { foot: [1, 1], ...opt, scale: 0.6 * (opt.scale || 1) });
  const TORCH = [-22, 46, 0xb57dff, 1.1];
  // คบเพลิงรอบขอบลาน (เว้นช่องประตู)
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2 + Math.PI / 16;
    if (Math.abs(a - Math.PI / 2) < 0.25) continue;
    small('p_torch2', Math.round(cx + Math.cos(a) * (r + 0.3)), Math.round(cy + Math.sin(a) * (r + 0.3)), { glow: TORCH });
  }
  // เสาเพลิงนรก 4 ต้น (มุมลาน) · ป้ายลาน
  for (const s of TRAPS.fire.spots) P('env/m_chedi_l', Math.round(s.x), Math.round(s.y) + 1, { foot: [2, 1], scale: 0.75, tint: 0x6b3fa0, glow: [-50, 70, 0xff5a3c, 0.8] });
  P('env/p_spirit', cx, cy + r + 3, { foot: [2, 1], scale: 1.1, label: 'ประตูลานสุริยคราส', glow: [-20, 40, 0xb57dff, 0.8] });
  // ค่ายรอคราส
  P('env/p_campfire', cp.x, cp.y, { foot: [1, 1], scale: 0.7, glow: [-10, 80, 0xff8a3c, 1.3] });
  for (const [dx, dy] of [[-5, -4], [5, -4], [-5, 4], [5, 4]]) small('p_lanternpole', cp.x + dx, cp.y + dy, { glow: [-26, 40, 0xb57dff, 1], alt: 'env/p_lantern' });
  small('p_tent_blue', cp.x + 3, cp.y + 2, { scale: 1.6, alt: 'env/p_stall' });
  npcs.push(
    { id: 'shop', key: 'npc_yai_tim', x: (cp.x + 3) * TILE, y: (cp.y - 2) * TILE, nameTh: 'ยายติ๋ม (ร้านเร่)', role: 'ร้านยา·ของใช้', color: '#82e0aa', lines: ['ยาครบ ขวดเติมเต็มในค่ายนี้นะจ๊ะ', 'ราหูลงมาเมื่อไหร่ ฟ้าจะมืดทั้งลาน'] },
    { id: 'wbguide', key: 'npc_kru_mage', x: (cp.x - 3) * TILE, y: (cp.y - 2) * TILE, nameTh: 'โหรหลวง', role: 'คำแนะนำพระราหู', color: '#d2b4de', lines: ['ม่วงคือดาเมจ เงินคือที่ปลอดภัย แดงคืออันตรายถึงชีวิต', 'ดับฟ้า: วิ่งเข้าเสาแสงก่อนเลขนับถึงศูนย์', 'ผลึกจันทร์ต้องแตกใน 30 วิ ไม่งั้นราหูฟื้นเลือด', 'ใครตีปิดฉาก ได้ป้าย MVP เหนือหัว 10 นาที'] },
  );
  // จุดเกิด: บอส (0) · ผลึก (1–4) · บริวาร (5–10) — หลับไว้ ตัวควบคุมปลุก
  spawns.push({ id: WB_ID, x: cx * TILE + TILE / 2, y: cy * TILE + TILE, r: 4, boss: true, wb: 'boss' });
  for (let i = 0; i < WB_CRYSTALS; i++) { const a = Math.PI / 4 + i * Math.PI / 2; spawns.push({ id: 'rahu_crystal', x: (cx + Math.cos(a) * 15) * TILE, y: (cy + Math.sin(a) * 15) * TILE, r: 2, wb: 'crystal' }); }
  for (let i = 0; i < WB_SHADES; i++) { const a = (i / WB_SHADES) * Math.PI * 2; spawns.push({ id: 'rahu_shade', x: (cx + Math.cos(a) * 8) * TILE, y: (cy + Math.sin(a) * 8) * TILE, r: 8, wb: 'shade' }); }

  const solid = ground.map((row) => row.map((t) => SOLID.has(t)));
  for (const p of props) { const [fw, fh] = p.foot || [0, 0]; if (!fw) continue; const tx = Math.round(p.x / TILE) - Math.floor(fw / 2), ty = Math.round(p.y / TILE) - fh; for (let y = ty; y < ty + fh; y++) for (let x = tx; x < tx + fw; x++) if (solid[y]?.[x] !== undefined) solid[y][x] = true; }
  const labels = [[cp.x, cp.y - cp.r - 2, '⛺ ค่ายรอคราส'], [cx, cy - r - 2, '🌑 ลานสุริยคราส']];
  return { ground, solid, props, npcs, spawns, portals, labels };
}

/** โซน: ค่าย (Safe) / ลาน / ทางเดิน */
export function arenaZoneAt(tx, ty) {
  if (Math.hypot(tx - ARENA.camp.x, ty - ARENA.camp.y) <= ARENA.camp.r + 0.5) return 'hub';
  if (Math.hypot(tx - ARENA.cx, ty - ARENA.cy) <= ARENA.r + 0.5) return 'lair';
  return 'wild';
}
