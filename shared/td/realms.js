// ============================================================
//  แมพต่างแดน (Lv.30–150) – ผังสร้างจากสูตร (seed ตายตัว → client/server ได้ผังเดียวกัน)
//  ▸ ป่าหิมพานต์ Lv.30–50 · เมืองบาดาลนาคพิภพ Lv.50–75 · นรกภูมิ Lv.75–99
//  ▸ แต่ละแมพ: ค่ายพัก (Safe Zone + NPC วาร์ป/ร้านยา) → ทางเดินผ่านแหล่งผี 4 แห่ง → ลานบอส → ประตูมิติไปแมพถัดไป
// ============================================================
import { TILE, T, SOLID } from './ayutthaya.js';

/**
 * คำอธิบายแต่ละแมพ (พิกัดเป็นไทล์)
 *  hub   = ค่ายพัก (วงกลม r ไทล์ = Safe Zone)   route = ทางเดินหลัก (ผ่านทุกแหล่งผี)
 *  camps = [id, x, y, จำนวนจุดเกิด]            boss = [id, x, y]
 *  portals = ประตูมิติ { to, x, y }            lakes = [x, y, r] (น้ำ/ลาวา = ชนกัน)
 */
export const REALMS = {
  himmaphan: {
    id: 'himmaphan', nameTh: 'ป่าหิมพานต์', icon: '🦁', lv: [30, 50], reqLv: 30, W: 150, H: 120, seed: 3301,
    sub: 'Lv.30–50 · บอส กุมภกรรณ', color: '#82e0aa', music: 'ayt_field',
    hub: { x: 16, y: 60, r: 9, nameTh: 'อาศรมฤๅษีหิมพานต์' },
    route: [[16, 60], [34, 46], [42, 38], [62, 24], [80, 18], [104, 24], [122, 36], [124, 58], [112, 84], [92, 96], [74, 98], [52, 104], [40, 108]],
    camps: [['kumphan', 42, 38, 6], ['khotchasi', 82, 16, 6], ['hatsadiling', 124, 40, 6], ['makkaliphon', 112, 86, 6]],
    boss: ['kumphakan', 74, 100], bossNameTh: 'ถ้ำกุมภกรรณ',
    portals: [{ to: 'ayutthaya', x: 6, y: 60 }, { to: 'nagaphop', x: 36, y: 110 }],
    lakes: [[78, 58, 13, 'สระอโนดาต'], [30, 84, 6], [138, 96, 6], [100, 50, 4], [58, 78, 5]],
    ground: [[T.GRASS, 0.46], [T.GRASS3, 0.22], [T.TALL, 0.2], [T.GRASS2, 0.12]],
    path: T.ROAD, clear: T.GRASS2, hubT: T.STONE, arenaT: T.BRICK, bank: T.SAND,
    trees: [['golden', 0.3], ['pink', 0.15], ['palm', 0.2], ['tamarind', 0.35]], treeDensity: 0.55,
    decor: ['p_lotus', 'p_frangipani', 'p_frangipani2', 'p_shrub', 'p_shrub2', 'p_plants'],
    ruins: [['env/m_chedi_l', [3, 2]], ['env/b_chediruin', [6, 2]], ['env/m_mondop', [6, 3]]],
    torch: 'p_torch', glow: 0xffd27a,
    style: { overlay: 'rgba(255,236,160,0.06)' },
  },
  nagaphop: {
    id: 'nagaphop', nameTh: 'เมืองบาดาลนาคพิภพ', icon: '🐉', lv: [50, 75], reqLv: 50, W: 150, H: 120, seed: 5501,
    sub: 'Lv.50–75 · บอส พญาอนันตนาคราช', color: '#5dade2', music: 'ayt_night',
    hub: { x: 75, y: 14, r: 9, nameTh: 'ศาลาท่าน้ำนาคา' },
    route: [[75, 14], [60, 24], [42, 30], [30, 50], [30, 76], [50, 90], [75, 98], [100, 90], [118, 80], [120, 56], [112, 34], [96, 26], [75, 14]],
    camps: [['nak_phrai', 40, 30, 6], ['ngueak_phi', 114, 32, 6], ['pla_khiao', 28, 78, 6], ['tahan_nak', 120, 80, 6]],
    boss: ['anantanak', 75, 100], bossNameTh: 'ท้องพระโรงนาคราช',
    portals: [{ to: 'himmaphan', x: 75, y: 5 }, { to: 'naraka', x: 132, y: 110 }], extra: [[[100, 90], [118, 100], [132, 110]]],
    lakes: [[75, 58, 14, 'บึงมณีนาคา'], [16, 18, 6], [134, 16, 6], [12, 104, 7], [100, 60, 4], [50, 58, 4]],
    ground: [[T.SAND, 0.42], [T.GRASS3, 0.22], [T.TALL, 0.2], [T.STONE, 0.1]],
    path: T.STONE, clear: T.SAND, hubT: T.BRICK, arenaT: T.BRICK, bank: T.SAND,
    trees: [['palm', 0.6], ['bamboo', 0.4]], treeDensity: 0.4, treeTint: 0x7fd6d0,
    decor: ['p_lotus', 'p_lotus2', 'p_shrub', 'p_plants', 'p_stonelantern'], decorTint: 0x9fe8ff,
    ruins: [['env/m_prangbig_l', [6, 3]], ['env/b_prang_l', [2, 2]], ['env/m_chedi_l', [3, 2]]], ruinTint: 0x9fd8ff,
    torch: 'p_torch2', glow: 0x6fdcff,
    style: { overlay: 'rgba(30,110,190,0.20)', water: 'rgba(40,200,220,0.28)', waterTint: 0x7fe6ff },
  },
  naraka: {
    id: 'naraka', nameTh: 'นรกภูมิ', icon: '🔥', lv: [75, 99], reqLv: 75, W: 150, H: 120, seed: 7501,
    sub: 'Lv.75–99 · บอส พญายมราช', color: '#ec7063', music: 'ayt_night', noFish: true,
    hub: { x: 16, y: 16, r: 9, nameTh: 'ประตูยมโลก' },
    route: [[16, 16], [32, 22], [50, 24], [80, 18], [108, 20], [122, 40], [104, 70], [78, 60], [52, 64], [36, 80], [52, 100], [84, 104], [110, 104], [124, 104]],
    camps: [['niraiyaban', 50, 24, 6], ['pret_khem', 110, 20, 6], ['phi_ton_ngiw', 36, 82, 6], ['yommathut', 104, 72, 6]],
    boss: ['phaya_yom', 124, 104], bossNameTh: 'บัลลังก์พญายม',
    portals: [{ to: 'nagaphop', x: 6, y: 16 }, { to: 'dusit', x: 142, y: 40 }], extra: [[[122, 40], [132, 40], [142, 40]]],
    lakes: [[74, 40, 9, 'กระทะทองแดง'], [20, 56, 7], [138, 70, 6], [70, 84, 6], [96, 44, 4], [18, 110, 6]],
    ground: [[T.STONE, 0.4], [T.SAND, 0.22], [T.GRASS3, 0.18], [T.BRICK, 0.08]],
    path: T.STONE, clear: T.BRICK, hubT: T.STONE, arenaT: T.BRICK, bank: T.STONE,
    trees: [['tamarind', 1]], treeDensity: 0.35, treeTint: 0x9b2c2c,
    decor: ['p_candle', 'p_buddhahead', 'p_buddhahead2', 'p_ruin', 'p_ruin2'], decorTint: 0xd98880,
    ruins: [['env/b_chediruin', [6, 2]], ['env/m_prangbig_l', [6, 3]], ['env/b_prang_l', [2, 2]]], ruinTint: 0xa04030,
    torch: 'p_torch2', glow: 0xff6a3c,
    style: { overlay: 'rgba(130,30,10,0.30)', water: 'rgba(255,90,20,0.85)', waterTint: 0xff7a30, lava: true },
  },
  // ===== Lv.99–150 =====
  dusit: {
    id: 'dusit', nameTh: 'สวรรค์ชั้นดาวดึงส์', icon: '☁️', lv: [99, 125], reqLv: 99, W: 150, H: 120, seed: 9901,
    sub: 'Lv.99–125 · บอส พระราหู', color: '#f9e79f', music: 'ayt_field',
    hub: { x: 16, y: 60, r: 9, nameTh: 'ศาลาเทวสภา' },
    route: [[16, 60], [30, 44], [46, 28], [70, 20], [96, 22], [118, 32], [128, 52], [120, 76], [100, 92], [76, 100], [52, 96], [36, 84], [30, 70]],
    camps: [['khon_thanpha', 46, 28, 6], ['kinnaree_ngao', 118, 32, 6], ['thep_asura', 120, 78, 6], ['yak_thawarn', 36, 86, 6]],
    boss: ['phra_rahu', 76, 102], bossNameTh: 'ลานราหูอมจันทร์',
    portals: [{ to: 'naraka', x: 6, y: 60 }, { to: 'sumeru', x: 142, y: 104 }], extra: [[[100, 92], [122, 100], [142, 104]]],
    lakes: [[76, 58, 12, 'สระโบกขรณี'], [20, 20, 6], [134, 14, 5], [16, 104, 6], [100, 56, 4], [52, 60, 4]],
    ground: [[T.SAND, 0.38], [T.STONE, 0.24], [T.GRASS2, 0.22], [T.BRICK, 0.1]],
    path: T.BRICK, clear: T.STONE, hubT: T.BRICK, arenaT: T.STONE, bank: T.SAND,
    trees: [['golden', 0.55], ['pink', 0.45]], treeDensity: 0.4, treeTint: 0xfff0c0,
    decor: ['p_lotus', 'p_lotus2', 'p_frangipani', 'p_frangipani2', 'p_stonelantern'], decorTint: 0xfff4d6,
    ruins: [['env/m_mondop', [6, 3]], ['env/m_prangbig_l', [6, 3]], ['env/m_chedi_l', [3, 2]]], ruinTint: 0xffe9a6,
    torch: 'p_torch', glow: 0xffe08a,
    style: { overlay: 'rgba(255,236,190,0.14)', water: 'rgba(170,220,255,0.35)', waterTint: 0xcfefff },
  },
  sumeru: {
    id: 'sumeru', nameTh: 'เขาพระสุเมรุ', icon: '🏔️', lv: [125, 150], reqLv: 125, W: 150, H: 120, seed: 12501,
    sub: 'Lv.125–150 · บอส พญามาราธิราช', color: '#a9cce3', music: 'ayt_night',
    hub: { x: 75, y: 14, r: 9, nameTh: 'อาศรมเชิงเขาสุเมรุ' },
    route: [[75, 14], [52, 22], [30, 34], [22, 58], [30, 84], [52, 98], [76, 104], [100, 98], [122, 86], [128, 60], [120, 36], [98, 22], [75, 14]],
    camps: [['krut_dam', 30, 34, 6], ['nak_sumeru', 22, 60, 6], ['asura_fire', 122, 86, 6], ['rakkhasa', 124, 36, 6]],
    boss: ['phaya_mara', 76, 102], bossNameTh: 'ยอดเขาพญามาร',
    portals: [{ to: 'dusit', x: 75, y: 5 }],
    lakes: [[76, 58, 13, 'ทะเลสีทันดร'], [14, 14, 6], [136, 16, 6], [12, 104, 6], [138, 106, 6], [100, 60, 4], [50, 60, 4]],
    ground: [[T.STONE, 0.44], [T.GRASS3, 0.22], [T.SAND, 0.18], [T.TALL, 0.1]],
    path: T.STONE, clear: T.STONE, hubT: T.BRICK, arenaT: T.BRICK, bank: T.STONE,
    trees: [['bamboo', 0.5], ['tamarind', 0.5]], treeDensity: 0.45, treeTint: 0x9fb8d8,
    decor: ['p_stonelantern', 'p_ruin', 'p_ruin2', 'p_shrub', 'p_buddhahead'], decorTint: 0xc8d8f0,
    ruins: [['env/m_prangbig_l', [6, 3]], ['env/b_chediruin', [6, 2]], ['env/b_prang_l', [2, 2]]], ruinTint: 0x9fb8ff,
    torch: 'p_torch2', glow: 0x9fc8ff,
    style: { overlay: 'rgba(70,90,160,0.22)', water: 'rgba(60,110,200,0.45)', waterTint: 0x7fa8ff },
  },
};

/** ผังของแมพต่างแดน → { ground, solid, props, npcs, spawns, portals } */
export function buildRealm(def) {
  const { W, H } = def;
  let seed = def.seed;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const inMap = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  // พื้น: ชนิดแรก = พื้นหลัก · ชนิดอื่นวางเป็นหย่อมกลม ๆ (ไม่สุ่มทีละช่อง → ไม่เป็นตารางหมากรุก)
  const ground = Array.from({ length: H }, () => new Array(W).fill(def.ground[0][0]));
  const set = (x, y, t) => { if (inMap(x, y)) ground[y][x] = t; };
  for (const [tt, w] of def.ground.slice(1)) {
    const n = Math.round(W * H * w / 38);
    for (let i = 0; i < n; i++) {
      const cx = rnd() * W, cy = rnd() * H, r = 1.5 + rnd() * 3.5;
      for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if (Math.hypot(x - cx, (y - cy) * 1.2) <= r) set(x, y, tt);
    }
  }
  const rect = (x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, t); };
  const disc = (cx, cy, r, t, r0 = -1) => { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) { const d = Math.hypot(x - cx, y - cy); if (d <= r && d > r0) set(x, y, t); } };
  const occ = Array.from({ length: H }, () => new Array(W).fill(false));
  const reserve = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inMap(x, y)) occ[y][x] = true; };
  const reserveDisc = (cx, cy, r) => { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if (inMap(x, y) && Math.hypot(x - cx, y - cy) <= r) occ[y][x] = true; };
  const path = (pts, w, t) => {
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
      for (let k = 0; k <= n; k++) {
        const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n;
        rect(Math.round(x - w / 2), Math.round(y - w / 2), Math.round(x - w / 2) + w - 1, Math.round(y - w / 2) + w - 1, t);
        reserveDisc(Math.round(x), Math.round(y), 2);
      }
    }
  };
  const props = [], npcs = [], spawns = [], portals = [];
  const P = (key, tx, ty, opt = {}) => props.push({ key, x: tx * TILE, y: ty * TILE, ...opt });
  const small = (key, tx, ty, opt = {}) => P(`env/${key}`, tx, ty, { foot: [1, 1], ...opt, scale: 0.6 * (opt.scale || 1) });
  const deco = (key, tx, ty, opt = {}) => small(key, tx, ty, { ...opt, foot: [0, 0] });
  const TREE_K = { tamarind: 0.8, palm: 0.72, golden: 0.72, bamboo: 0.62, pink: 1.9 };
  const tree = (tx, ty, kind, sc = 1) => P(`env/t_${kind}`, tx, ty, { foot: [1, 1], alt: 'td_tree', scale: sc * TREE_K[kind], altScale: 1.4 * sc, flip: rnd() < 0.5, ...(def.treeTint ? { tint: def.treeTint } : {}) });
  const TORCH = [-22, 46, def.glow, 1.1];
  const isOpen = (t) => !SOLID.has(t);

  // ---- ทะเลสาบ/บ่อลาวา (ชน) + ตลิ่ง ----
  for (const [cx, cy, r] of def.lakes) { disc(cx, cy, r + 1.5, def.bank); disc(cx, cy, r, T.WATER); reserveDisc(cx, cy, r + 2); }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ground[y][x] === T.WATER && rnd() < 0.5) ground[y][x] = T.WATER2;
  // ---- ทางเดินหลัก (ทับน้ำได้ = สะพาน) ----
  path(def.route, 3, def.path);
  for (const pts of def.extra || []) path(pts, 3, def.path);
  for (const [x, y] of def.route) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (ground[y + dy]?.[x + dx] === T.WATER || ground[y + dy]?.[x + dx] === T.WATER2) set(x + dx, y + dy, T.WOOD);
  // ---- ค่ายพัก (Safe Zone) ----
  const hb = def.hub;
  disc(hb.x, hb.y, hb.r, def.hubT); disc(hb.x, hb.y, hb.r + 1, T.BRICK, hb.r); reserveDisc(hb.x, hb.y, hb.r + 2);
  P('env/p_campfire', hb.x, hb.y, { foot: [1, 1], scale: 0.7, glow: [-10, 80, 0xff8a3c, 1.3] });
  for (const [dx, dy] of [[-6, -5], [6, -5], [-6, 6], [6, 6]]) small('p_lanternpole', hb.x + dx, hb.y + dy, { glow: [-26, 40, def.glow, 1], alt: 'env/p_lantern' });
  small('p_tent_blue', hb.x + 4, hb.y + 3, { scale: 1.6, alt: 'env/p_stall' });
  P('env/p_spirit', hb.x - 1, hb.y - 6, { foot: [2, 1], scale: 1.1, label: hb.nameTh, glow: [-20, 40, def.glow, 0.8] });
  const npcKey = (k) => k;
  npcs.push(
    { id: 'warp', key: npcKey('npc_ruesi'), x: (hb.x - 3) * TILE, y: (hb.y + 2) * TILE, nameTh: 'ฤๅษีเฝ้าประตูมิติ', role: 'วาร์ปต่างแดน', color: '#d2b4de', lines: ['ข้าส่งเจ้าไปยังแดนที่เคยไปถึงแล้วได้ทุกเมื่อ', 'ยิ่งลึกเข้าไปผียิ่งดุร้าย เตรียมขวดยาให้พร้อม'] },
    { id: 'shop', key: npcKey('npc_yai_tim'), x: (hb.x + 3) * TILE, y: (hb.y - 2) * TILE, nameTh: 'ยายติ๋ม (ร้านเร่)', role: 'ร้านยา·ของใช้', color: '#82e0aa', lines: ['ของดีจากกรุงศรีฯ แบกมาไกล ราคาเท่าเดิมนะจ๊ะ', 'ขวดยาเติมเต็มเมื่อพักในค่ายนี้'] },
  );
  // ---- แหล่งผี ----
  const S = (id, tx, ty, r = 4, n = 1) => { for (let i = 0; i < n; i++) spawns.push({ id, x: tx * TILE, y: ty * TILE, r: r * TILE }); reserveDisc(tx, ty, Math.min(r, 5)); };
  for (const [id, x, y, n] of def.camps) { disc(x, y, 6, def.clear); reserveDisc(x, y, 7); S(id, x, y, 4, n); }
  // ---- ลานบอส ----
  const [bid, bx, by] = def.boss;
  disc(bx, by, 9, def.arenaT); disc(bx, by, 10, T.STONE, 9); reserveDisc(bx, by, 11);
  spawns.push({ id: bid, x: bx * TILE, y: (by + 1) * TILE, r: 2 * TILE, boss: true });
  P(def.ruins[0][0], bx, by - 6, { foot: def.ruins[0][1], scale: 1.2, label: def.bossNameTh, glow: [-70, 110, def.glow, 0.9], ...(def.ruinTint ? { tint: def.ruinTint } : {}) });
  for (const [dx, dy] of [[-8, -4], [8, -4], [-8, 6], [8, 6]]) small(def.torch, bx + dx, by + dy, { glow: TORCH });
  // ---- ประตูมิติ ----
  for (const pt of def.portals) {
    disc(pt.x, pt.y, 3.5, T.BRICK); disc(pt.x, pt.y, 4.5, T.STONE, 3.5); reserveDisc(pt.x, pt.y, 5);
    portals.push({ to: pt.to, x: pt.x * TILE, y: pt.y * TILE, r: 26 });
    for (const [dx, dy] of [[-3, -2], [3, -2]]) small(def.torch, pt.x + dx, pt.y + dy, { glow: TORCH });
  }
  // ---- ซากโบราณ / ต้นไม้ / ของประกอบฉาก ----
  const free = (x, y, r = 1) => { for (let yy = y - r; yy <= y; yy++) for (let xx = x - r; xx <= x + r; xx++) if (!inMap(xx, yy) || occ[yy][xx] || !isOpen(ground[yy][xx])) return false; return true; };
  for (let i = 0; i < 14; i++) {
    const x = 6 + Math.floor(rnd() * (W - 12)), y = 6 + Math.floor(rnd() * (H - 10));
    if (!free(x, y, 3)) continue;
    const [k, f] = def.ruins[Math.floor(rnd() * def.ruins.length)];
    P(k, x, y, { foot: f, scale: 0.9, flip: rnd() < 0.5, alt: 'td_ruin', ...(def.ruinTint ? { tint: def.ruinTint } : {}) }); reserve(x - 3, y - 3, x + 3, y);
  }
  const pickTree = () => { let r = rnd(); for (const [k, w] of def.trees) { if (r < w) return k; r -= w; } return def.trees[0][0]; };
  for (let y = 1; y < H - 1; y += 2) for (let x = 1; x < W - 1; x += 2) {
    const tx = x + Math.floor(rnd() * 2), ty = y + Math.floor(rnd() * 2);
    if (!free(tx, ty) || rnd() > def.treeDensity) continue;
    const r = rnd();
    if (r < 0.62) tree(tx, ty, pickTree(), 0.9 + rnd() * 0.3);
    else deco(def.decor[Math.floor(rnd() * def.decor.length)], tx, ty, { ...(def.decorTint ? { tint: def.decorTint } : {}), ...(def.torch === 'p_torch2' && rnd() < 0.2 ? { glow: [-8, 16, def.glow, 0.5] } : {}) });
    reserve(tx - 1, ty - 1, tx + 1, ty);
  }
  // บัว/ประกายบนผิวน้ำ (น้ำจริงเท่านั้น ไม่ใช่ลาวา)
  if (!def.style?.lava) for (const [cx, cy, r] of def.lakes) for (let i = 0; i < r; i++) { const a = rnd() * 6.28, d = rnd() * (r - 1); deco(rnd() < 0.5 ? 'p_lotus' : 'p_lotus2', Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d), { depth: 1, ...(def.decorTint ? { tint: def.decorTint } : {}) }); }

  // ---- ตารางชน ----
  const solid = ground.map((row) => row.map((t) => SOLID.has(t)));
  for (const p of props) { const [fw, fh] = p.foot || [0, 0]; if (!fw) continue; const tx = Math.round(p.x / TILE) - Math.floor(fw / 2), ty = Math.round(p.y / TILE) - fh; for (let y = ty; y < ty + fh; y++) for (let x = tx; x < tx + fw; x++) if (solid[y]?.[x] !== undefined) solid[y][x] = true; }
  // ป้ายชื่อบนแผนที่
  const labels = [[hb.x, hb.y - hb.r - 2, `⛺ ${hb.nameTh}`], [bx, by - 12, `👑 ${def.bossNameTh}`], ...def.lakes.filter((l) => l[3]).map(([x, y, r, n]) => [x, y - r - 2, `💧 ${n}`])];
  return { ground, solid, props, npcs, spawns, portals, labels };
}

/** โซนของไทล์ในแมพต่างแดน: ค่าย (Safe) / ลานบอส / ป่า */
export function realmZoneAt(def, tx, ty) {
  if (Math.hypot(tx - def.hub.x, ty - def.hub.y) <= def.hub.r + 0.5) return 'hub';
  if (Math.hypot(tx - def.boss[1], ty - def.boss[2]) <= 11) return 'lair';
  return 'wild';
}
