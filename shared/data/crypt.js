// ============================================================
//  สุสานใต้ดิน – ดันเจี้ยนปาร์ตี้ 100 ชั้น (1–6 คน) · ใช้ร่วม client/server
//  ▸ ผี Lv = round(4 + ชั้น × 1.46) (ชั้น 1 = Lv.5 → ชั้น 100 = Lv.150) · บอสทุก 10 ชั้น
//  ▸ ชั้นลงท้าย 5 = ห้องหีบเงิน + ผีหัวหน้า · ฆ่าผีครบทั้งชั้น → บันไดลงเปิด
//  ▸ ผ่านบอสแล้วได้จุดเซฟ (เริ่มชั้น 11, 21, …) · หีบทองบอสเปิดได้วันละครั้งต่อบอส
//  ▸ รหัสแมพ: crypt:<ชั้น>:<จำนวนคน>:<ห้อง> → ผัง/ค่าพลังผีขึ้นกับ ชั้น + จำนวนคน เท่านั้น (client/server ได้ผังเดียวกัน)
// ============================================================
import { MONSTERS } from './monsters.js';

export const CRYPT = {
  floors: 100, W: 48, H: 40, arena: 36, maxParty: 6,
  gate: { x: 198, y: 147 },            // ประตูสุสานในกรุงศรีฯ (ไทล์) · ปลายทางหินป่าช้าวัดร้าง
  rally: 160,                          // หัวหน้ากดเข้า → สมาชิกที่ยืนห่างประตูไม่เกินนี้ (px) ลงไปด้วย
  idleMs: 90000,                       // ห้องที่ไม่มีคนอยู่นานเท่านี้ → ลบทิ้ง
  dust: 'crypt_dust',
};

/** 10 โซน (ชั้นละ 10) · mobs = ผีธรรมดา · boss = บอสชั้นลงท้าย 0 · tiles = พื้นห้อง/ทางเดิน · pool = แอ่งในห้อง */
export const CRYPT_ZONES = [
  { name: 'ลานเชิงตะกอน', mobs: ['phi_pob', 'phi_jang_nang', 'kuman_thong', 'krasue', 'nang_tani', 'pret'], boss: 'mae_nak', bossName: 'แม่นาคเจ้าสุสาน', floor: 'SAND', path: 'ROAD', pool: null, glow: 0xffc46b, overlay: 'rgba(20,14,8,0.34)' },
  { name: 'กรุสมบัติโบราณ', mobs: ['saming', 'phi_ha', 'phi_dip', 'tai_hong', 'phi_lang_kluang'], boss: 'pu_som', bossName: 'ปู่โสมเฝ้ากรุ', floor: 'SAND', path: 'STONE', pool: null, glow: 0xffd27a, overlay: 'rgba(24,18,6,0.36)' },
  { name: 'หลุมเปรตหิว', mobs: ['khamot', 'nang_takhian', 'phi_phrai', 'phi_chamot'], boss: 'pret_asura', bossName: 'เปรตอสุรกายหิวโหย', floor: 'STONE', path: 'BRICK', pool: null, glow: 0xb266ff, overlay: 'rgba(26,10,40,0.38)' },
  { name: 'ถ้ำน้ำใต้บาดาล', mobs: ['kumphan', 'khotchasi', 'hatsadiling', 'makkaliphon'], boss: 'chalawan', bossName: 'ชาละวันถ้ำบาดาล', floor: 'STONE', path: 'SAND', pool: 'water', glow: 0x6fdcff, overlay: 'rgba(6,24,40,0.40)' },
  { name: 'โถงยักษ์หลับ', mobs: ['nak_phrai', 'ngueak_phi', 'pla_khiao', 'tahan_nak'], boss: 'kumphakan', bossName: 'กุมภกรรณหลับใต้ดิน', floor: 'STONE', path: 'SAND', pool: 'water', glow: 0x7fe6ff, overlay: 'rgba(8,20,42,0.42)' },
  { name: 'บ่อนาคพันปี', mobs: ['tahan_nak', 'niraiyaban', 'pret_khem', 'pla_khiao'], boss: 'anantanak', bossName: 'อนันตนาคราชใต้สุสาน', floor: 'STONE', path: 'BRICK', pool: 'water', glow: 0x9fe0ff, overlay: 'rgba(20,10,36,0.42)' },
  { name: 'ประตูยมโลก', mobs: ['phi_ton_ngiw', 'niraiyaban', 'pret_khem', 'khon_thanpha'], boss: 'yommathut', bossName: 'ยมทูตเงาเฝ้าประตู', floor: 'BRICK', path: 'STONE', pool: 'lava', glow: 0xff6a3c, overlay: 'rgba(40,8,6,0.42)' },
  { name: 'ศาลตัดสินวิญญาณ', mobs: ['kinnaree_ngao', 'thep_asura', 'yak_thawarn', 'khon_thanpha'], boss: 'phaya_yom', bossName: 'พญายมราชตัดสินบาป', floor: 'BRICK', path: 'STONE', pool: 'lava', glow: 0xff5a3c, overlay: 'rgba(44,6,6,0.44)' },
  { name: 'เหวรากษส', mobs: ['yak_thawarn', 'krut_dam', 'nak_sumeru', 'thep_asura'], boss: 'rakkhasa', bossName: 'รากษสจักรวาล', floor: 'BRICK', path: 'STONE', pool: 'lava', glow: 0xff4030, overlay: 'rgba(48,4,6,0.46)' },
  { name: 'ก้นบึ้งสุสาน', mobs: ['asura_fire', 'krut_dam', 'nak_sumeru', 'yak_thawarn'], boss: 'phaya_mara', bossName: 'พญามาราธิราช', floor: 'BRICK', path: 'STONE', pool: 'lava', glow: 0xff2a20, overlay: 'rgba(54,2,4,0.48)' },
];

export const zoneOf = (f) => CRYPT_ZONES[Math.min(9, Math.floor((f - 1) / 10))];
export const lvOf = (f) => Math.round(4 + f * 1.46);
export const hpMul = (n) => 1 + 0.6 * (n - 1);
export const bossHp = (f) => Math.round(18000 * Math.pow(1.042, f));
/**
 * ปาร์ตี้หลายคน ชั้น 30 ขึ้นไป: ผีแกร่งขึ้นอีกชั้น (คูณทับ hpMul) · ขั้น = ชั้น 30–39 → 1 … ชั้น 100 → 8
 * ต่อสมาชิกที่เพิ่ม 1 คน ต่อขั้น: HP +6% · ป้องกัน +4% · โจมตี +3%  (ชั้น 100 ปาร์ตี้ 6 คน ≈ HP ×3.4 · DEF ×2.6 · ATK ×2.2)
 */
export function partyHard(f, n) {
  const tier = f >= 30 ? Math.floor(f / 10) - 2 : 0, x = (n - 1) * tier;
  return { hp: 1 + 0.06 * x, def: 1 + 0.04 * x, atk: 1 + 0.03 * x };
}
export const isBossFloor = (f) => f % 10 === 0;
export const isChestFloor = (f) => f % 10 === 5;
/** ชั้นที่เริ่มได้ (จุดเซฟ) ≤ cp */
export const checkpoints = (cp = 1) => { const out = []; for (let f = 1; f <= Math.min(cp, CRYPT.floors); f += 10) out.push(f); return out; };

// ---------------- รหัสแมพ ----------------
export const cryptId = (f, n, inst) => `crypt:${f}:${n}:${inst}`;
export function parseCrypt(id) {
  if (typeof id !== 'string' || !id.startsWith('crypt:')) return null;
  const [, fs, ns, inst] = id.split(':'), f = +fs, n = +ns;
  if (!Number.isInteger(f) || f < 1 || f > CRYPT.floors || !Number.isInteger(n) || n < 1 || n > CRYPT.maxParty || !inst) return null;
  return { f, n, inst };
}
export const isCrypt = (id) => !!parseCrypt(id);

// ---------------- ผีตามชั้น ----------------
/**
 * ลงทะเบียนผีที่ปรับค่าพลังตามชั้น/จำนวนคนไว้ใน MONSTERS (ทำครั้งเดียวต่อรหัส · client/server คิดเหมือนกัน)
 * kind: 'n' ธรรมดา · 'e' หัวหน้า (ห้องหีบเงิน) · 'b' บอส
 */
export function cryptMob(base, f, n, kind = 'n') {
  const id = `cr${f}x${n}${kind}_${base}`;
  if (MONSTERS[id]) return id;
  const b = MONSTERS[base], L = lvOf(f), k = L / b.level, pm = hpMul(n);
  const d = {
    ...b, level: L, _scaled: true, crypt: true, base, cardOf: base,
    d8: b.d8 || base, art: b.art, tint: b.tint,
    hp: Math.round(b.hp * k ** 1.35 * 1.15 * pm), atk: Math.round(b.atk * k ** 1.15), def: Math.round(b.def * Math.max(0.5, k)),
    acc: Math.round(b.acc + (L - b.level) * 0.6), exp: Math.round(b.exp * k ** 1.55 * 1.3), gold: b.gold.map((g) => Math.round(g * k ** 1.2)),
    drops: [...(b.drops || []).filter((x) => !/^(hp|mp)_|^flask_|^g_|^cs_/.test(x.item)), { item: CRYPT.dust, chance: 0.3 }],
    boss: false, elite: false, nightOnly: false, count: 1, respawnMs: 0,
  };
  if (b.boss && kind !== 'b') { d.hp = Math.round(d.hp / 30); d.atk = Math.round(d.atk * 0.8); d.exp = Math.round(d.exp / 12); d.scale = 1; d.aoe = null; }   // บอสเดิมที่ถูกใช้เป็นผีธรรมดา
  if (kind === 'e') Object.assign(d, { elite: true, scale: 1.3, hp: d.hp * 4, atk: Math.round(d.atk * 1.2), exp: d.exp * 4, gold: d.gold.map((g) => g * 3), drops: [...d.drops, { item: CRYPT.dust, chance: 1 }] });
  if (kind === 'b') Object.assign(d, {
    boss: true, scale: b.scale && b.boss ? b.scale : 1.9, attackRange: Math.max(40, b.attackRange || 0), attackCooldown: b.attackCooldown || 1500, speed: 38,
    hp: Math.round(bossHp(f) * pm), atk: Math.round(b.atk * k ** 1.15 * (b.boss ? 1 : 1.4)), exp: Math.round(40 * Math.pow(L, 1.6) * 0.6),
    gold: [L * 60, L * 120],
    aoe: b.aoe ? { ...b.aoe } : { cd: 7000, r: 96, mult: 1.5, nameTh: 'คำสาปเจ้าสุสาน' },
    drops: [...(b.drops || []).filter((x) => !/^(hp|mp)_|^flask_/.test(x.item)), { item: CRYPT.dust, chance: 1 }],
  });
  if (kind === 'b') d.nameTh = zoneOf(f).bossName;
  const ph = partyHard(f, n);
  if (ph.hp > 1) Object.assign(d, { hp: Math.round(d.hp * ph.hp), def: Math.round(d.def * ph.def), atk: Math.round(d.atk * ph.atk) });
  MONSTERS[id] = d;
  return id;
}

// ---------------- หีบรางวัล (ต่อคน) ----------------
/** หีบเงิน (ชั้นลงท้าย 5) / หีบทอง (บอส) → { gold, dust, items } */
export function chestLoot(f, kind, rnd = Math.random) {
  const L = lvOf(f), z = zoneOf(f);
  const mats = [...new Set(z.mobs.flatMap((m) => (MONSTERS[m].drops || []).map((x) => x.item)).filter((i) => !/^(hp|mp)_|^flask_|yak_fang/.test(i)))];
  const pick = () => mats[Math.floor(rnd() * mats.length)];
  if (kind === 'gold') {
    const items = [{ id: pick(), qty: 3 + Math.floor(rnd() * 3) }, { id: pick(), qty: 2 }];
    if (L >= 30) items.push({ id: 'black_iron', qty: 2 + Math.floor(L / 30) });
    if (rnd() < 0.35) items.push({ id: 'yak_fang', qty: 1 });
    return { gold: L * 150, dust: 20 + Math.floor(f / 2), items };
  }
  return { gold: L * 40, dust: 6 + Math.floor(f / 10), items: [{ id: pick(), qty: 2 }] };
}
