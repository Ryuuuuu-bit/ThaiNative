// ============================================================
//  ทะเบียนแมพโลก top-down (ใช้ร่วม client/server)
//  ▸ ayutthaya = กรุงศรีฯ (Lv.1–30) · himmaphan / nagaphop / naraka = แมพต่างแดน (Lv.30–99)
//  ▸ แต่ละแมพ: W,H (ไทล์) · spawn (จุดเกิด/ฟื้น) · inSafe(x,y) · zoneAt(x,y) · ZONES · layout() (สร้างครั้งเดียวแล้วจำไว้)
// ============================================================
import { TILE, MAP_W, MAP_H, SPAWN, ZONES as AYT_ZONES, zoneAtTile, inTownXY, buildLayout } from './ayutthaya.js';
import { REALMS, buildRealm, realmZoneAt } from './realms.js';
import { MONSTERS } from '../data/monsters.js';

/**
 * ความหนาแน่นผี (ตัวคูณจำนวนต่อแหล่ง) · ผีตัวเพิ่มต่อท้าย spawns (index เดิมไม่เลื่อน · client/server ได้ผังเดียวกัน)
 * ▸ ไม่คูณ: บอส · ผีกลางคืน (nightOnly)
 */
export const MOB_DENSITY = { ayutthaya: 2, himmaphan: 2.5, nagaphop: 2.5, naraka: 2.5 };
function densify(L, mult) {
  if (!(mult > 1)) return L;
  const groups = new Map();
  for (const s of L.spawns) {
    if (s.boss || MONSTERS[s.id]?.boss || MONSTERS[s.id]?.nightOnly) continue;
    const k = `${s.id}|${s.x}|${s.y}`;
    (groups.get(k) || groups.set(k, []).get(k)).push(s);
  }
  for (const list of groups.values()) {
    const s = list[0], add = Math.round(list.length * mult) - list.length;
    for (let i = 0; i < add; i++) L.spawns.push({ id: s.id, x: s.x, y: s.y, r: Math.round(s.r * 1.35), extra: true });
  }
  return L;
}

export const TD_MAP_IDS = ['ayutthaya', 'himmaphan', 'nagaphop', 'naraka'];
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
    layout: () => (cache[def.id] ||= densify(buildRealm(def), MOB_DENSITY[def.id])),
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
    layout: () => (cache.ayutthaya ||= densify(buildLayout(), MOB_DENSITY.ayutthaya)),
  },
  ...Object.fromEntries(Object.values(REALMS).map((d) => [d.id, realmEntry(d)])),
};

export const getMap = (id) => TD_MAPS[id] || TD_MAPS[DEFAULT_MAP];
export const validMap = (id) => (TD_MAPS[id] ? id : DEFAULT_MAP);

/** จุดโผล่เมื่อผ่านประตูมิติจาก from → to (หน้าประตูฝั่งตรงข้าม) · ไม่มีคู่ = จุดเกิดของแมพ */
export function arrivalPoint(from, to) {
  const M = getMap(to), pt = M.layout().portals.find((p) => p.to === from);
  return pt ? { x: pt.x + (pt.x < M.W * TILE / 2 ? 44 : -44), y: pt.y + 10 } : { ...M.spawn };
}
