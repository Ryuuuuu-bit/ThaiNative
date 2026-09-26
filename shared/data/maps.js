// ============================================================
//  แผนที่โลก: หมู่บ้าน + 20 แมพล่าผี (แมพละ 1 ชนิด เลเวลไต่ขึ้นเรื่อยๆ) แบ่ง 5 ภาค + ลานพญายักษ์
//  ทุกแมพอยู่บนแกน X เดียวกันแต่แยกขาดจากกัน – ย้ายแมพด้วยประตูวาร์ป (กด F → เลือกปลายทาง)
//  ใช้ร่วมกันทั้ง client และ server
// ============================================================
import { WORLD } from '../constants.js';
import { MONSTERS } from './monsters.js';

/** ภาค: ฉากหลัง, เพลง, บรรยากาศ, สีหมอก, สีพื้น, ของตกแต่ง */
export const REGIONS = {
  r1: { id: 'r1', no: 1, nameTh: 'ทุ่งนาบางผี',        music: 'r1', bg: 'bg_r1', fog: 0xf5b041, fogA: 0.05, ground: 0xffffff, decor: 'paddy',  sky: 0xfad7a0 },
  r2: { id: 'r2', no: 2, nameTh: 'บึงบัวหมู่บ้านร้าง',  music: 'r2', bg: 'bg_r2', fog: 0x76d7c4, fogA: 0.1,  ground: 0xa9c4b0, decor: 'swamp',  sky: 0x7fb3a8 },
  r3: { id: 'r3', no: 3, nameTh: 'ป่าดงดิบ',           music: 'r3', bg: 'bg_r3', fog: 0x1e8449, fogA: 0.09, ground: 0x9ccc8c, decor: 'jungle', sky: 0x82c29a },
  r4: { id: 'r4', no: 4, nameTh: 'ป่าช้าวัดร้าง',       music: 'r4', bg: 'bg_r4', fog: 0x5b2c6f, fogA: 0.15, ground: 0xa99bb8, decor: 'grave',  sky: 0x9b7fb3 },
  r5: { id: 'r5', no: 5, nameTh: 'หุบเขาอสุรกาย',       music: 'r5', bg: 'bg_r5', fog: 0x922b21, fogA: 0.15, ground: 0xc49a8a, decor: 'cursed', sky: 0xc0785f },
};

/** ลำดับแมพล่าผี: [ภาค, ผี, ชื่อแมพ] – เลเวลเรียงจากน้อยไปมาก */
const HUNT = [
  ['r1', 'phi_tuay_kaew',   'ทุ่งถ้วยแก้ว'],
  ['r1', 'kuman_thong',     'คันนากุมาร'],
  ['r1', 'krasue',          'เล้าไก่กระสือ'],
  ['r1', 'nang_tani',       'สวนกล้วยตานี'],
  ['r2', 'phi_pob',         'หมู่บ้านร้างผีปอบ'],
  ['r2', 'phi_jang_nang',   'ลานหนังกลางแปลง'],
  ['r2', 'phi_phrai',       'บึงบัวผีพราย'],
  ['r2', 'pret',            'ศาลาเปรตหิวโหย'],
  ['r3', 'saming',          'ดงเสือสมิง'],
  ['r3', 'phi_ha',          'ป่าผีห่า'],
  ['r3', 'krahang',         'ไร่ร้างผีกระหัง'],
  ['r3', 'khamot',          'หนองไฟผีโขมด'],
  ['r4', 'phi_dip',         'ป่าช้าผีดิบ'],
  ['r4', 'nang_takhian',    'ดงตะเคียนทอง'],
  ['r4', 'tai_hong',        'ทางแยกตายโหง'],
  ['r4', 'phi_phong',       'ห้วยผีโพง'],
  ['r5', 'kong_koi',        'ผาผีกองกอย'],
  ['r5', 'phi_lang_kluang', 'ถ้ำหลังกลวง'],
  ['r5', 'phi_chamot',      'ลำธารผีจะมอด'],
  ['r5', 'pret_asura',      'บัลลังก์อสุรกาย'],
];

export const HUNT_X0 = 1100;     // ขอบซ้ายแมพล่าผีแมพแรก
export const MAP_W = 1000;       // ความกว้างแต่ละแมพ
export const MAP_STEP = 1100;    // ระยะห่างระหว่างแมพ (มีช่องว่างกั้น)

const village = {
  id: 'village', no: 0, nameTh: 'หมู่บ้านบางผี', region: 'village', minX: WORLD.minX, maxX: 1040, safe: true,
  respawnX: WORLD.spawnX, arriveX: 940, minLv: 1, gates: [{ x: 990 }],
};

const hunts = HUNT.map(([region, mon, nameTh], i) => {
  const minX = HUNT_X0 + i * MAP_STEP, maxX = minX + MAP_W;
  const m = MONSTERS[mon];
  return {
    id: `m${i + 1}`, no: i + 1, idx: i, nameTh, region, mon, level: m.level,
    minLv: Math.max(1, m.level - 1), minX, maxX,
    fireX: minX + 80, respawnX: minX + 120, arriveX: minX + 120, safeEndX: minX + 230,
    gates: [{ x: minX + 32 }, { x: maxX - 32 }],
  };
});

const lastX = HUNT_X0 + HUNT.length * MAP_STEP;
const arena = {
  id: 'arena', no: 21, nameTh: 'ลานพญายักษ์', region: 'r5', boss: true, minX: lastX, maxX: lastX + 700,
  minLv: 12, respawnX: lastX + 70, arriveX: lastX + 90, safeEndX: lastX + 120, gates: [{ x: lastX + 32 }],
};

export const MAP_LIST = [village, ...hunts, arena];
export const MAPS = Object.fromEntries(MAP_LIST.map((m) => [m.id, m]));
export const HUNT_MAPS = hunts;

// ตรวจว่าค่าคงที่โลกตรงกับจำนวนแมพ
if (WORLD.width !== arena.maxX || WORLD.arenaX !== arena.minX || WORLD.graveX !== hunts[12].minX) {
  console.warn('[maps] WORLD constants mismatch', { width: arena.maxX, arenaX: arena.minX, graveX: hunts[12].minX });
}

// ผีแต่ละชนิดอยู่แมพเดียว: เกิดทั่วแมพ (เว้นจุดพักซ้าย), ตัวละ 5 (อสุรกาย 2)
for (const h of hunts) {
  const m = MONSTERS[h.mon];
  m.zone = [h.safeEndX + 70, h.maxX - 60];
  m.count = h.mon === 'pret_asura' ? 2 : 5;
  m.mapId = h.id;
  if (m.nightOnly) { m.nightOnly = false; m.nightBoost = true; }   // แมพเดี่ยว: มีทั้งวัน แต่กลางคืนดุขึ้น
}

export function mapAt(x) {
  if (x < HUNT_X0 - 35) return village;
  if (x >= arena.minX - 35) return arena;
  const i = Math.max(0, Math.min(hunts.length - 1, Math.floor((x - HUNT_X0 + 50) / MAP_STEP)));
  return hunts[i];
}

/** ประตูที่ใกล้ที่สุดภายในระยะ r */
export const gateNear = (x, r = 90) => mapAt(x).gates.find((g) => Math.abs(x - g.x) < r) || null;

export const regionOf = (map) => REGIONS[map.region] || null;
