// ============================================================
//  ดันเจี้ยนสี่ผีป่าช้า – ห้องบอสต่อปาร์ตี้ 1–6 คน (ใช้ร่วม client/server)
//  ▸ ทางเข้า: หลวงตาเฝ้าป่าช้า ข้างประตูสุสานใต้ดิน (กรุงศรีฯ) · หัวหน้าปาร์ตี้เลือกบอส + ระดับ
//  ▸ ระดับ: ธรรมดา (ตายฟื้นได้เรื่อย ๆ) · ยาก / นรก (ฟื้นด้วย "เทียนนำวิญญาณ" ร่วมกันทั้งปาร์ตี้ · หมอยาชุบไม่เสียเทียน)
//  ▸ รหัสแมพ: gd:<บอส>:<ระดับ>:<คน>:<ห้อง> → ผัง/ค่าพลังบอสขึ้นกับ บอส + ระดับ + จำนวนคน (client/server คิดเหมือนกัน)
// ============================================================
import { MONSTERS } from './monsters.js';
import { hpMul } from './crypt.js';
import { GD_SETS, GD_ARMOR, GD_WEAPONS, gdItemId } from './ghostgear.js';

export const GDG = { maxParty: 6, timeMs: 10 * 60 * 1000, rally: 160, idleMs: 90000, npc: 'ghostdg', closeMs: 60000 };

/** บอส · open = เข้าได้แล้ว (ห้องอื่นแสดงในหน้าต่างแต่ล็อก) · base = ผีต้นแบบสำหรับค่าพลัง · d8 = ภาพ 8 ทิศ */
export const GD_BOSSES = {
  hung: {
    open: true, nameTh: 'ผีตายโหงลานประหาร', place: 'ลานประหารหลังกำแพงเมือง', color: '#c7d0e2', base: 'tai_hong', d8: 'gd_hung',
    gim: 'ยืนครบทุกหลักไม้พร้อมกัน สายสิญจน์ตรึงผี 8 วิ ร่ายท่าไม่ได้ รับดาเมจ ×2.5 · ระวังดาบเพชฌฆาตและตายซ้ำที่เดิม',
    loot: 'ชุดบ่วงเพชฌฆาต', minion: 'phi_dip',
  },
  krasue: { open: false, preview: true, d8: 'gd_krasue', minion: 'phi_dip', nameTh: 'นางพญากระสือ', place: 'ทุ่งโลงริมบึงกล้วย', color: '#8fe3b0', base: 'krasue', gim: 'หาร่างไร้หัวในโลง 8 ใบ ทุบแตกแล้วกระสือรับดาเมจ ×3', loot: 'ชุดไส้เรืองแสง' },
  yat: { open: false, preview: true, d8: 'gd_yat', minion: 'phi_dip', nameTh: 'หยาดดำ ผีคลุมดำ', place: 'ใต้ถุนเรือนร้างริมคลอง', color: '#b9a6d8', base: 'phi_phrai', gim: 'แบกโอ่งน้ำมนต์ไปสาด ผ้าคลุมหลุด รับดาเมจ ×2.5', loot: 'ชุดผ้าคลุมดำ' },
  pob: { open: false, preview: true, d8: 'gd_pob', minion: 'phi_dip', nameTh: 'ปอบเจ้าป่าช้า', place: 'ป่าช้าวัดร้างกลางดง', color: '#ff9a7a', base: 'phi_pob', gim: 'ฟาดหวายเสกให้คืนร่างจริง ช็อก 2.5 วิ รับดาเมจ ×2', loot: 'ชุดปอบเจ้าป่าช้า' },
};
export const GD_BOSS_IDS = Object.keys(GD_BOSSES);

/** ระดับความยาก · candles(n) = เทียนทั้งปาร์ตี้ (null = ไม่จำกัด) · wait = ms ก่อนฟื้น · chests = หีบ/วัน/บอส */
export const GD_DIFFS = {
  normal: { th: 'ธรรมดา', req: 110, lv: 120, hp: 520000, atk: 1.0, chests: 4, gap: 9000, wait: 5000, candles: null, affix: 'elite', setChance: 0.4, weaponChance: 0.05 },
  hard:   { th: 'ยาก', req: 135, lv: 145, hp: 950000, atk: 1.25, chests: 3, gap: 7000, wait: 10000, candles: (n) => n + 2, affix: 'boss', setChance: 1, weaponChance: 0.1 },
  hell:   { th: 'นรก', req: 150, lv: 165, hp: 1600000, atk: 1.55, chests: 2, gap: 5500, wait: 15000, candles: () => 3, affix: 'boss', setChance: 1, weaponChance: 0.2, needClear: 'hard', minTier: 2 },
};
export const GD_DIFF_IDS = Object.keys(GD_DIFFS);

/** กลไกหลักไม้ (ผีตายโหง): จำนวนหลัก = จำนวนคน (2–6) · หลักติดค้างหลังเดินออก · ครบทุกหลักพร้อมกัน = ตรึงผี */
/** ท่าเด่นของบอส (server สั่ง · client วาดเตือน) · ปล่อยตามลำดับ rotation ห่างกัน GD_DIFFS.gap ms · ถูกตรึง = ร่ายไม่ได้ */
export const GD_SKILLS = {
  execute: { nameTh: 'ดาบเพชฌฆาต', how: 'รุมยืนรวมกันในวงแบ่งรับดาบ · ยืนคนเดียวตาย', warn: 3000, r: 60 },
  echo: { nameTh: 'ตายซ้ำที่เดิม', how: 'ออกจากจุดที่ยืนอยู่ ศพเงาจะระเบิดตรงนั้น', warn: 1600, r: 42, mult: 1.6 },
  noose: { nameTh: 'บ่วงแขวนคอ', how: 'เพื่อนยืนประกบคนโดนบ่วงเพื่อยื้อเชือกไว้', ms: 6000, help: 48, pct: 0.09 },
  reverse: { nameTh: 'วิญญาณสับสน', how: 'ปุ่มเดินกลับด้าน 6 วิ · ระวังบ่อเลือด', ms: 6000, pools: 6, poolR: 34, pct: 0.06 },
  split: { nameTh: 'ร่างเละ', how: 'ฆ่าหัว ลำตัว ขา ให้ตายภายใน 5 วิ · ระหว่างนี้ตีบอสไม่เข้า', ms: 20000 },
  vortex: { nameTh: 'วังวนความตาย', how: 'ลมดูดออกขอบลาน เดินสวนเข้ากลาง · ขอบลานมีหนาม', ms: 6000, pull: 46, pct: 0.1 },
  // ---- นางพญากระสือ ----
  tether: { nameTh: 'ไส้โยง', how: 'ไส้เรืองแสงผูก 2 คน ห้ามเดินห่างกันเกินเส้น', type: 'tether', ms: 8000, len: 150, pct: 0.08, anim: 'lash' },
  dive: { nameTh: 'หัวแยกร่าง', how: 'หัวพุ่งเป็นเส้นตรง หลบออกจากแนว', type: 'line', warn: 1500, w: 46, mult: 2.2, anim: 'lash', dash: true },
  wisp: { nameTh: 'ไฟผีล่อ', how: 'ลูกไฟตกหลายจุด อย่ายืนในวงเขียว', type: 'spots', warn: 2000, r: 40, count: 6, mult: 1.5, color: 0x6dffb0, anim: 'cast' },
  shriek: { nameTh: 'เรียกชื่อ', how: 'หันหลังให้กระสือก่อนเสียงเรียกจบ · หันหน้า = ติดมึน', type: 'gaze', warn: 2500, pct: 0.14, fear: 2500, anim: 'cast' },
  dark: { nameTh: 'ดับตะเกียง', how: 'ลานมืดเหลือแสงรอบตัว ระวังไฟผีในความมืด', type: 'dark', ms: 8000, warn: 2600, r: 40, count: 6, mult: 1.4, color: 0x6dffb0, anim: 'cast' },
  // ---- หยาดดำ ----
  crawl: { nameTh: 'คลานหักงอ', how: 'คลานพุ่งเป็นเส้นตรง หลบออกจากแนว (หลบหลังเสาได้)', type: 'line', warn: 1300, w: 50, mult: 2.4, anim: 'crawl', dash: true },
  drip: { nameTh: 'ติ๊ด…หยด', how: 'น้ำดำหยดจากพื้นเรือน เดินออกจากวงม่วง', type: 'spots', warn: 1700, r: 34, count: 9, mult: 1.3, color: 0x9a6dff, anim: 'cast' },
  shroud: { nameTh: 'ผ้าคลุมบังตา', how: 'คนโดนมองไม่เห็นรอบตัว 6 วิ เพื่อนช่วยนำทาง', type: 'blind', ms: 6000, anim: 'cast' },
  gaze: { nameTh: 'จ้องจากความมืด', how: 'หันหลังให้หยาดดำก่อนตาเปิด · หันหน้า = ติดกลัว', type: 'gaze', warn: 2500, pct: 0.16, fear: 3000, anim: 'stare' },
  // ---- ปอบเจ้าป่าช้า ----
  liver: { nameTh: 'หิวตับ', how: 'ปอบกระโจนกัดคนเลือดน้อยสุด โดนแล้วปอบฟื้นเลือด', type: 'line', warn: 1400, w: 44, mult: 2.6, heal: 0.02, low: true, anim: 'attack', dash: true },
  tongue: { nameTh: 'ลิ้นตวัดลาก', how: 'ลิ้นยาวพุ่งเป็นเส้น โดนแล้วถูกลากเข้าหาปอบ', type: 'line', warn: 1300, w: 36, mult: 1.4, pull: true, anim: 'tongue' },
  pounce: { nameTh: 'กระโจนสามจังหวะ', how: 'กระโจนตามคนเดิม 3 ครั้ง วิ่งหนีออกจากวง', type: 'pounce', warn: 900, r: 52, hits: 3, mult: 1.6, anim: 'attack' },
  howl: { nameTh: 'หมาหอนเรียกฝูง', how: 'ฝูงผีวิ่งออกมาจากป่า ฆ่าก่อนโดนรุม', type: 'adds', count: 3, anim: 'cast' },
  cat: { nameTh: 'แมวข้ามศพ', how: 'ศพลุกจากหลุมศพ ฆ่าก่อนโดนรุม', type: 'adds', count: 2, anim: 'cast' },
};
/** กลไกหลักของบอสอื่น: guard = ตัวคูณดาเมจตามปกติ · vuln = ตัวคูณช่วงเปิดจุดอ่อน (ms) · objs = ของในลาน (ยืน hold ms เพื่อใช้) */
export const GD_MECH = {
  krasue: { kind: 'coffin', guard: 0.5, vulnMul: 3, vulnMs: 10000, hold: 1500, r: 30, objTh: 'โลง', vulnTh: 'ร่างแตก', how: 'ยืนข้างโลง 1.5 วิเพื่อเปิด · เจอร่างไร้หัว = กระสือรับดาเมจ ×3 นาน 10 วิ · โลงผิดมีผีดิบ' },
  yat: { kind: 'carry', guard: 0.6, vulnMul: 2.5, vulnMs: 10000, hold: 1500, r: 30, give: 70, respawn: 20000, slow: 0.7, objTh: 'โอ่ง', vulnTh: 'ผ้าหลุด', how: 'ยืนข้างโอ่ง 1.5 วิเพื่อแบก แล้วเดินไปสาดใส่หยาดดำ · ผ้าหลุด รับดาเมจ ×2.5 นาน 10 วิ' },
  pob: { kind: 'carry', guard: 0.6, vulnMul: 2, vulnMs: 8000, stun: 2500, hold: 1500, r: 30, give: 60, respawn: 16000, slow: 0.85, objTh: 'หวาย', vulnTh: 'คืนร่าง', how: 'ยืนข้างหวายเสก 1.5 วิเพื่อหยิบ แล้วเข้าไปฟาดปอบ · คืนร่างจริง ช็อก 2.5 วิ รับดาเมจ ×2 นาน 8 วิ' },
};
/** 4 เฟสตามเลือดบอส (th = % ที่ขึ้นเฟสถัดไป) · skills = ท่าที่วนใช้ในแต่ละเฟส (ตามตัวจำลองศึกบอสผี) */
const PREVIEW_PH = { th: [70, 40, 10], names: ['เฟส 1', 'เฟส 2', 'เฟส 3', 'เฟส 4'], skills: { 1: ['echo'], 2: ['echo', 'execute'], 3: ['execute', 'echo'], 4: ['execute', 'echo'] } };
export const GD_PHASES = {
  hung: { th: [70, 40, 10], names: ['วิญญาณติดที่', 'ลานประหาร', 'ร่างเละ', 'วังวนความตาย'],
    skills: { 1: ['echo', 'noose'], 2: ['execute', 'echo', 'noose'], 3: ['reverse', 'split', 'execute'], 4: ['vortex', 'split', 'reverse'] } },
  krasue: { th: [70, 40, 10], names: ['ไส้เรืองแสง', 'ไฟผีกลางบึง', 'เสียงเรียกชื่อ', 'ตะเกียงดับ'],
    skills: { 1: ['tether', 'dive'], 2: ['dive', 'wisp', 'tether'], 3: ['shriek', 'dive', 'wisp'], 4: ['dark', 'tether', 'shriek', 'dive'] } },
  yat: { th: [70, 40, 10], names: ['ใต้ถุนมืด', 'คลานหักงอ', 'ผ้าคลุมดำ', 'จ้องจากความมืด'],
    skills: { 1: ['crawl', 'drip'], 2: ['crawl', 'drip', 'shroud'], 3: ['gaze', 'crawl', 'shroud', 'drip'], 4: ['gaze', 'drip', 'crawl', 'shroud'] } },
  pob: { th: [70, 40, 10], names: ['ปอบหิว', 'ลิ้นยาว', 'ฝูงหมาผี', 'เจ้าป่าช้า'],
    skills: { 1: ['liver', 'tongue'], 2: ['pounce', 'tongue', 'howl'], 3: ['pounce', 'liver', 'cat', 'tongue'], 4: ['howl', 'pounce', 'tongue', 'liver'] } },
};
/** เฟสจาก % เลือด (1–4) */
export const gdPhase = (boss, pct) => 1 + (GD_PHASES[boss] || PREVIEW_PH).th.filter((v) => pct * 100 <= v).length;
/** ร่างเละ: บอสแตกเป็น หัว/ลำตัว/ขา (บอสไม่รับดาเมจ) · ฆ่าครบ 3 ชิ้นภายใน window หลังชิ้นแรกตาย = บอสเสียเลือด + มึน · เกิน limit = ร่างคืน + บอสฟื้นเลือด */
export const GD_SPLIT = { parts: ['head', 'body', 'legs'], th: { head: 'หัว', body: 'ลำตัว', legs: 'ขา' }, hpPct: 0.012, window: 5000, limit: 20000, okPct: 0.08, okStun: 4000, failHeal: 0.05 };
/** ดาบเพชฌฆาต: ดาเมจรวม (เท่าของตีปกติ) ตามจำนวนคน → หารคนที่ยืนในวง */
export const executeMult = (n) => 2 + 1.5 * (Math.min(6, Math.max(1, n)) - 1);
export const GD_POSTS ={ ringTiles: 13, r: 26, holdMs: 3000, bindMs: 8000, cdMs: 22000, mul: 2.5 };
export const postCount = (n) => Math.max(2, Math.min(6, n));
/** ตำแหน่งหลัก (ไทล์ รอบจุดกลางลาน) */
export function postTiles(n, cx, cy) {
  const k = postCount(n), out = [];
  for (let i = 0; i < k; i++) { const a = -Math.PI / 2 + (i / k) * Math.PI * 2; out.push({ x: cx + Math.cos(a) * GD_POSTS.ringTiles, y: cy + Math.sin(a) * GD_POSTS.ringTiles * 0.8 }); }
  return out;
}

// ---------------- รหัสแมพ ----------------
export const gdId = (boss, diff, n, inst) => `gd:${boss}:${diff}:${n}:${inst}`;
export function parseGd(id) {
  if (typeof id !== 'string' || !id.startsWith('gd:')) return null;
  const [, boss, diff, ns, inst] = id.split(':'), n = +ns;
  if (!GD_BOSSES[boss] || !GD_DIFFS[diff] || !Number.isInteger(n) || n < 1 || n > GDG.maxParty || !inst) return null;
  return { boss, diff, n, inst };
}
export const isGd = (id) => !!parseGd(id);

// ---------------- ผี ----------------
/** บอสของห้อง (ลงทะเบียนใน MONSTERS ครั้งเดียวต่อรหัส) */
export function gdBossMob(boss, diff, n) {
  const id = `gdb_${boss}_${diff}_${n}`;
  if (MONSTERS[id]) return id;
  const B = GD_BOSSES[boss], D = GD_DIFFS[diff], b = MONSTERS[B.base], k = D.lv / b.level;
  MONSTERS[id] = {
    ...b, nameTh: B.nameTh, level: D.lv, base: B.base, cardOf: B.base, d8: B.d8 || b.d8 || B.base, art: b.art, tint: undefined,
    boss: true, elite: false, nightOnly: false, count: 1, respawnMs: 0, _scaled: true, gd: boss, scale: 1,
    hp: Math.round(D.hp * hpMul(n)), atk: Math.round(b.atk * k ** 1.15 * D.atk), def: Math.round(b.def * Math.max(0.6, k)), acc: Math.round(b.acc + (D.lv - b.level) * 0.6),
    exp: Math.round(40 * Math.pow(D.lv, 1.6) * 0.8), gold: [D.lv * 50, D.lv * 100], speed: 42, attackRange: 46, attackCooldown: 1500,
    aoe: null,                                                       // ท่าบอสคุมโดย gdTick (GD_SKILLS)
    drops: [],
  };
  return id;
}
/** บริวาร (ผีดิบตามลาน) */
/** ชิ้นร่างเละ (หัว/ลำตัว/ขา) · ภาพเดียวกับบอสแต่ตัวเล็ก */
export function gdPartMob(boss, diff, n, part) {
  const id = `gdp_${boss}_${diff}_${n}_${part}`;
  if (MONSTERS[id]) return id;
  const B = GD_BOSSES[boss], D = GD_DIFFS[diff], b = MONSTERS[B.base], k = D.lv / b.level;
  MONSTERS[id] = {
    ...b, nameTh: `${B.nameTh} (${GD_SPLIT.th[part]})`, level: D.lv, base: B.base, cardOf: B.base, d8: B.d8 || b.d8 || B.base, _scaled: true,
    boss: false, elite: true, nightOnly: false, count: 1, respawnMs: 0, gdPart: part, scale: 0.6,
    hp: Math.round(D.hp * hpMul(n) * GD_SPLIT.hpPct), atk: Math.round(b.atk * k ** 1.15 * D.atk * 0.4), def: Math.round(b.def * Math.max(0.5, k)),
    acc: Math.round(b.acc + (D.lv - b.level) * 0.6), exp: 0, gold: [0, 0], speed: 30, aoe: null, drops: [],
  };
  return id;
}
export function gdMinionMob(boss, diff, n) {
  const id = `gdm_${boss}_${diff}_${n}`;
  if (MONSTERS[id]) return id;
  const B = GD_BOSSES[boss], D = GD_DIFFS[diff], b = MONSTERS[B.minion || 'phi_dip'], L = D.lv - 8, k = L / b.level;
  MONSTERS[id] = {
    ...b, level: L, base: B.minion, cardOf: B.minion, d8: b.d8 || B.minion, _scaled: true, boss: false, elite: false, nightOnly: false, count: 1, respawnMs: 0,
    hp: Math.round(b.hp * k ** 1.35 * 1.4 * (1 + 0.3 * (n - 1))), atk: Math.round(b.atk * k ** 1.15 * D.atk * 0.6), def: Math.round(b.def * Math.max(0.5, k)),
    acc: Math.round(b.acc + (L - b.level) * 0.6), exp: Math.round(b.exp * k ** 1.55), gold: b.gold.map((g) => Math.round(g * k ** 1.1)), drops: [],
  };
  return id;
}

// ---------------- หีบรางวัล ----------------
/** ของในหีบ 1 ใบ → [{ id, qty, gd?, weapon? }] (ค่าสุ่มเติมที่ server) · job = อาชีพตามอาวุธที่ถือ */
export function gdChestLoot(boss, diff, job, rnd = Math.random) {
  const D = GD_DIFFS[diff], items = [{ id: 'gd_essence', qty: diff === 'hell' ? 3 : diff === 'hard' ? 2 : 1 }];
  if (!GD_SETS[boss]) return items;
  const wp = { swordman: 'sword', boxer: 'wraps', mage: 'staff', archer: 'bow', healer: 'herb' }[job] || GD_WEAPONS[Math.floor(rnd() * GD_WEAPONS.length)];
  if (rnd() < D.weaponChance) items.push({ id: gdItemId(boss, wp), qty: 1, gd: true, weapon: true });
  const pieces = rnd() < D.setChance ? 1 + (diff === 'hell' && rnd() < 0.25 ? 1 : 0) : 0;
  const pool = [...GD_ARMOR];
  for (let i = 0; i < pieces && pool.length; i++) items.push({ id: gdItemId(boss, pool.splice(Math.floor(rnd() * pool.length), 1)[0]), qty: 1, gd: true });
  if (rnd() < (diff === 'hell' ? 0.25 : 0.12)) items.push({ id: 'yak_fang', qty: 1 });
  return items;
}

/** วันนี้ (เวลาไทย) ใช้นับโควต้าหีบ */
export const gdDay = (now = Date.now()) => new Date(now + 7 * 3600e3).toISOString().slice(0, 10);
/** โควต้าที่เหลือ/ผ่านแล้ว จากเซฟ c.gd = { day, used: { 'hung:hard': n }, clear: { 'hung:hard': true } } */
export function gdQuota(c, boss, diff, now = Date.now()) {
  const g = c?.gd || {}, used = g.day === gdDay(now) ? (g.used?.[`${boss}:${diff}`] || 0) : 0;
  return { used, max: GD_DIFFS[diff].chests, left: Math.max(0, GD_DIFFS[diff].chests - used), cleared: !!g.clear?.[`${boss}:${diff}`] };
}
