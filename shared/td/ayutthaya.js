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
  P('warp_gate', 60, 100, { foot: [4, 1], label: 'ประตูวาร์ป → โลก Classic', warp: true });
  // ต้นไม้ในเมือง / นอกเมือง
  const trees = [[14, 14], [24, 12], [100, 12], [108, 20], [14, 26], [104, 40], [30, 58], [90, 58], [12, 36], [110, 34], [40, 46], [80, 46],
    [6, 76], [112, 76], [10, 100], [60, 108], [30, 74], [96, 74], [116, 96], [50, 92], [70, 90], [46, 100], [110, 104], [4, 90]];
  trees.forEach(([x, y], i) => P(i % 3 === 2 ? 'td_palm' : 'td_tree', x, y, { foot: [1, 1], scale: 1.4 }));
  // บ้านเพิ่ม + บ่อน้ำ/เสา
  [[36, 58], [76, 58], [30, 20], [92, 20], [22, 52], [104, 52]].forEach(([x, y], i) => P('house', x, y, { foot: [8, 2], flip: i % 2 === 1 }));
  [[28, 44], [92, 44], [50, 58], [70, 58]].forEach(([x, y]) => P('td_pillar', x, y, { foot: [1, 1] }));
  props.push({ key: 'pr_reeds', x: 20 * TILE, y: (RIVER.y0 - 1) * TILE, foot: [0, 0] }, { key: 'pr_reeds', x: 100 * TILE, y: (RIVER.y1 + 2) * TILE, foot: [0, 0] }, { key: 'pr_reeds', x: 76 * TILE, y: (RIVER.y0 - 1) * TILE, foot: [0, 0] });

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
