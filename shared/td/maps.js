// ============================================================
//  ทะเบียนแมพโลก top-down (ใช้ร่วม client/server)
//  ▸ ayutthaya = กรุงศรีฯ (Lv.1–30) · himmaphan / nagaphop / naraka = แมพต่างแดน (Lv.30–99)
//  ▸ แต่ละแมพ: W,H (ไทล์) · spawn (จุดเกิด/ฟื้น) · inSafe(x,y) · zoneAt(x,y) · ZONES · layout() (สร้างครั้งเดียวแล้วจำไว้)
// ============================================================
import { TILE, MAP_W, MAP_H, SPAWN, ZONES as AYT_ZONES, zoneAtTile, inTownXY, buildLayout } from './ayutthaya.js';
import { REALMS, buildRealm, realmZoneAt } from './realms.js';
import { MONSTERS } from '../data/monsters.js';
import { ARENA_DEF, buildArena, arenaZoneAt } from './arena.js';
import { cryptMap } from './crypt.js';
export { isCrypt } from '../data/crypt.js';

/**
 * ความหนาแน่นผี: จำนวนผีรวมต่อชนิด × ตัวคูณ · แต่ละกองไม่เกิน CAMP_MAX ตัว
 * ▸ ผีที่เพิ่มไปตั้ง "กองใหม่" รอบ ๆ กองเดิม (โซนเดียวกัน · ห่าง 9–22 ไทล์ · ไม่ทับเมือง/ลานบอส/ประตู/กองอื่น) → ไม่กระจุกจุดเดียว
 * ▸ สุ่มแบบ seed คงที่ → client/server ได้ผังเดียวกัน · ผีเพิ่มต่อท้าย spawns (index เดิมไม่เลื่อน)
 * ▸ ไม่คูณ: บอส · ผีกลางคืน (nightOnly)
 */
export const MOB_DENSITY = { ayutthaya: 5, himmaphan: 5, nagaphop: 5, naraka: 5, dusit: 5, sumeru: 5 };
export const CAMP_MAX = 7;
function densify(L, mult, M) {
  if (!(mult > 1)) return L;
  let seed = 7919;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const W = L.solid[0].length, H = L.solid.length;
  const walk = (tx, ty) => tx >= 1 && ty >= 1 && tx < W - 1 && ty < H - 1 && !L.solid[ty][tx];
  const groups = new Map();
  for (const s of L.spawns) {
    if (s.boss || MONSTERS[s.id]?.boss || MONSTERS[s.id]?.nightOnly) continue;
    const k = `${s.id}|${s.x}|${s.y}`;
    (groups.get(k) || groups.set(k, []).get(k)).push(s);
  }
  // จุดที่ห้ามตั้งกองใหม่ใกล้ ๆ: กองเดิมทุกกอง · บอส · ประตูมิติ
  const camps = [...groups.values()].map((l) => ({ x: l[0].x / TILE, y: l[0].y / TILE }));
  const avoid = [...L.spawns.filter((s) => s.boss).map((s) => ({ x: s.x / TILE, y: s.y / TILE, r: 14 })), ...(L.portals || []).map((p) => ({ x: p.x / TILE, y: p.y / TILE, r: 8 })),
    ...(M.realm ? [{ x: M.spawn.x / TILE, y: M.spawn.y / TILE, r: 22 }] : [])];   // ค่ายพัก: เว้นระยะให้มือใหม่เดินออกมาไม่โดนรุมทันที
  const okSpot = (tx, ty, zone) => {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (!walk(tx + dx, ty + dy)) return false;
    const x = tx * TILE, y = ty * TILE;
    if (M.inSafe(x, y) || M.zoneAt(x, y) !== zone) return false;
    if (avoid.some((a) => Math.hypot(a.x - tx, a.y - ty) < a.r)) return false;
    return !camps.some((c) => Math.hypot(c.x - tx, c.y - ty) < 7);
  };
  for (const list of groups.values()) {
    const s = list[0], total = Math.round(list.length * mult);
    let left = total - list.length;
    const size = Math.min(CAMP_MAX, Math.max(list.length, 3));
    const zone = M.zoneAt(s.x, s.y), ox = s.x / TILE, oy = s.y / TILE;
    while (left > 0) {
      const n = Math.min(size, left);
      let spot = null;
      for (let i = 0; i < 160 && !spot; i++) {
        const ang = rnd() * Math.PI * 2, d = 8 + rnd() * (14 + i / 3);
        const tx = Math.round(ox + Math.cos(ang) * d), ty = Math.round(oy + Math.sin(ang) * d);
        if (okSpot(tx, ty, zone)) spot = { tx, ty };
      }
      if (spot) { camps.push({ x: spot.tx, y: spot.ty }); for (let i = 0; i < n; i++) L.spawns.push({ id: s.id, x: spot.tx * TILE, y: spot.ty * TILE, r: s.r, extra: true }); }
      else { const room = CAMP_MAX - list.length; for (let i = 0; i < Math.min(n, room); i++) { L.spawns.push({ id: s.id, x: s.x, y: s.y, r: s.r, extra: true }); list.push(s); } }   // หาที่ว่างไม่ได้ → เติมกองเดิม (ไม่เกิน CAMP_MAX)
      left -= n;
    }
  }
  return L;
}

export const TD_MAP_IDS = ['ayutthaya', 'himmaphan', 'nagaphop', 'naraka', 'dusit', 'sumeru', 'suriya'];
/** แมพอีเวนต์ (ไม่อยู่ในรายการวาร์ป/ประตูมิติ · เข้าได้เฉพาะช่วงอีเวนต์) */
export const EVENT_MAPS = new Set(['suriya']);
export const DEFAULT_MAP = 'ayutthaya';

const cache = {};
function realmEntry(def) {
  const zones = {
    hub: { nameTh: def.hub.nameTh, sub: `Safe Zone · ${def.nameTh}`, color: '#f7dc6f' },
    wild: { nameTh: def.nameTh, sub: def.sub, color: def.color },
    lair: { nameTh: def.bossNameTh, sub: `บอส Lv.${def.lv[1]} · ${def.nameTh}`, color: '#ff8a80' },
  };
  const hubXY = { x: def.hub.x * TILE, y: (def.hub.y + 3) * TILE };
  return {
    id: def.id, nameTh: def.nameTh, icon: def.icon, lv: def.lv, reqLv: def.reqLv, W: def.W, H: def.H, sub: def.sub, color: def.color,
    music: def.music, noFish: !!def.noFish, style: def.style || {}, realm: true,
    spawn: hubXY,
    ZONES: zones,
    zoneAtTile: (tx, ty) => realmZoneAt(def, tx, ty),
    zoneAt: (x, y) => realmZoneAt(def, Math.floor(x / TILE), Math.floor(y / TILE)),
    inSafe: (x, y) => Math.hypot(x / TILE - def.hub.x, y / TILE - def.hub.y) <= def.hub.r + 0.5,
    layout() { return (cache[def.id] ||= densify(buildRealm(def), MOB_DENSITY[def.id], this)); },
  };
}

export const TD_MAPS = {
  ayutthaya: {
    id: 'ayutthaya', nameTh: 'กรุงศรีอยุธยา', icon: '🏯', lv: [1, 30], reqLv: 1, W: MAP_W, H: MAP_H, sub: 'Lv.1–30 · เมืองหลวง', color: '#f7dc6f',
    music: null, noFish: false, style: {}, realm: false,
    spawn: { ...SPAWN },
    ZONES: AYT_ZONES,
    zoneAtTile,
    zoneAt: (x, y) => zoneAtTile(Math.floor(x / TILE), Math.floor(y / TILE)),
    inSafe: inTownXY,
    layout() { return (cache.ayutthaya ||= densify(buildLayout(), MOB_DENSITY.ayutthaya, this)); },
  },
  ...Object.fromEntries(Object.values(REALMS).map((d) => [d.id, realmEntry(d)])),
  suriya: {
    ...(({ hub, ...d }) => d)(ARENA_DEF), realm: true,
    spawn: { x: ARENA_DEF.hub.x * TILE, y: (ARENA_DEF.hub.y + 2) * TILE },
    ZONES: { hub: { nameTh: 'ค่ายรอคราส', sub: 'Safe Zone · ลานสุริยคราส', color: '#f7dc6f' }, wild: { nameTh: 'ทางเดินประตูลาน', sub: 'ลานสุริยคราส', color: '#af7ac5' }, lair: { nameTh: 'ลานสุริยคราส', sub: 'บอสโลก · พระราหู Lv.150', color: '#ff8a80' } },
    zoneAtTile: arenaZoneAt,
    zoneAt: (x, y) => arenaZoneAt(Math.floor(x / TILE), Math.floor(y / TILE)),
    inSafe: (x, y) => arenaZoneAt(Math.floor(x / TILE), Math.floor(y / TILE)) === 'hub',
    layout() { return (cache.suriya ||= buildArena()); },
  },
};

/** สุสานใต้ดิน: รหัส crypt:<ชั้น>:<คน>:<ห้อง> สร้างรายการแมพตามชั้น (ไม่อยู่ใน TD_MAPS) */
export const getMap = (id) => TD_MAPS[id] || cryptMap(id) || TD_MAPS[DEFAULT_MAP];
export const validMap = (id) => (TD_MAPS[id] || cryptMap(id) ? id : DEFAULT_MAP);

/** จุดโผล่เมื่อผ่านประตูมิติจาก from → to (หน้าประตูฝั่งตรงข้าม) · ไม่มีคู่ = จุดเกิดของแมพ */
export function arrivalPoint(from, to) {
  const M = getMap(to), pt = M.layout().portals.find((p) => p.to === from);
  return pt ? { x: pt.x + (pt.x < M.W * TILE / 2 ? 44 : -44), y: pt.y + 10 } : { ...M.spawn };
}
