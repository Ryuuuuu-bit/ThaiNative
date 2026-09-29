// ============================================================
//  แหล่งที่มาของไอเทม ("ได้จากที่ไหน") — ใช้ในกล่องรายละเอียดตอนชี้ไอเทม
//  รวมจาก: ผีดรอป (ของ/การ์ด/อุปกรณ์สุ่มตามเลเวล) · ร้าน NPC · ทำอาหาร/ปรุงยา/หลอม · ตกปลา · เก็บสมุนไพร · รางวัลเควส
//  สร้างดัชนีครั้งเดียวเมื่อเรียกครั้งแรก (lazy) แล้วจำไว้
// ============================================================
import { ITEMS, SHOPS, baseItemId } from './items.js';
import { MONSTERS } from './monsters.js';
import { CARD_BY_ID, CARD_DROP } from './cards.js';
import { GEAR } from './gear.js';
import { FISH, RECIPES, BREWS, QUESTS, questGiver, GIVER_TH } from './village.js';
import { FORGE } from './crafting.js';
import { TD_MAPS, TD_MAP_IDS } from '../td/maps.js';
import { HERB_SPOTS } from '../td/ayutthaya.js';

const pctTxt = (p) => (p >= 0.1 ? `${Math.round(p * 100)}%` : p >= 0.01 ? `${+(p * 100).toFixed(1)}%` : `${+(p * 100).toFixed(2)}%`);
let IDX = null, WHERE = null;

/** ผีแต่ละชนิดอยู่แมพ/โซนไหน → 'กรุงศรีอยุธยา · ทุ่งนาบางปะอิน' */
function monWhere() {
  if (WHERE) return WHERE;
  WHERE = {};
  for (const mid of TD_MAP_IDS) {
    const M = TD_MAPS[mid], L = M.layout();
    for (const s of L.spawns) {
      if (WHERE[s.id]) continue;
      const z = M.ZONES[M.zoneAt(s.x, s.y)]?.nameTh;
      WHERE[s.id] = z && z !== M.nameTh ? `${M.nameTh} · ${z}` : M.nameTh;
    }
  }
  return WHERE;
}

function build() {
  const idx = {}, add = (id, src) => (idx[id] ||= []).push(src);
  const W = monWhere();
  const monTxt = (k, m) => `${m.nameTh} Lv.${m.level}${m.boss ? ' (บอส)' : m.elite ? ' (หัวหน้า)' : ''}${m.nightOnly ? ' 🌙' : ''}`;
  // 1) ผีดรอป (เฉพาะผีที่มีจุดเกิดในโลกจริง)
  for (const [k, m] of Object.entries(MONSTERS)) {
    if (!W[k]) continue;
    for (const dr of m.drops || []) add(dr.item, { kind: 'mon', sort: -dr.chance, ic: m.boss ? '👑' : '👻', text: `${monTxt(k, m)} · ${pctTxt(dr.chance)}`, sub: W[k] });
  }
  // 2) การ์ดผี
  for (const [cid, c] of Object.entries(CARD_BY_ID)) {
    const m = MONSTERS[c.mon]; if (!m || !W[c.mon]) continue;
    const p = m.boss ? CARD_DROP.boss : m.elite ? CARD_DROP.elite : CARD_DROP.normal;
    add(cid, { kind: 'mon', sort: -p, ic: '🃏', text: `${monTxt(c.mon, m)} · ${pctTxt(p)}`, sub: W[c.mon] });
  }
  // 3) ร้าน NPC
  for (const [sid, s] of Object.entries(SHOPS)) for (const id of s.stock || []) add(id, { kind: 'shop', sort: -1, ic: '🛒', text: `${s.nameTh.split(' ')[0]} · ฿${(ITEMS[id]?.price || 0).toLocaleString()}`, sub: s.nameTh.split(' ').slice(1).join(' ') || '', shop: sid });
  // 4) ทำเอง: อาหาร (ป้าสา) · ยา (ยายติ๋ม) · หลอม (ลุงดำ)
  const need = (n) => Object.entries(n).map(([k, q]) => `${ITEMS[k]?.nameTh || k}×${q}`).join(' + ');
  for (const r of RECIPES) add(r.out, { kind: 'craft', ic: '🍳', text: `ทำอาหารที่ป้าสา`, sub: need(r.need) });
  for (const r of BREWS) add(r.out, { kind: 'craft', ic: '🌿', text: `ปรุงยาที่ยายติ๋ม`, sub: need(r.need) });
  for (const r of FORGE) add(r.out, { kind: 'craft', ic: '⚒️', text: `สร้างที่ลุงดำ · ฿${r.fee.toLocaleString()}`, sub: need(r.need) });
  // 5) ตกปลา / เก็บสมุนไพร
  const fw = FISH.reduce((a, f) => a + f.w, 0);
  for (const f of FISH) add(f.id, { kind: 'life', ic: '🎣', text: `ตกปลา${f.night ? 'ตอนกลางคืน' : ''} · ~${pctTxt(f.w / fw)}`, sub: 'ริมน้ำกรุงศรีฯ และแดนต่าง ๆ (ยกเว้นนรกภูมิ)' });
  const A = TD_MAPS.ayutthaya, herbZ = {};
  for (const h of HERB_SPOTS) (herbZ[h.item] ||= new Set()).add(A.ZONES[A.zoneAt(h.x, h.y)]?.nameTh || A.nameTh);
  for (const [id, zs] of Object.entries(herbZ)) add(id, { kind: 'life', ic: '🌾', text: 'เก็บสมุนไพร (กด F ข้างต้น)', sub: [...zs].join(' · ') });
  // 6) รางวัลเควส
  for (const q of QUESTS) for (const it of q.reward?.items || []) add(it.id, { kind: 'quest', ic: '📜', text: `เควส "${q.nameTh}" ×${it.qty}`, sub: `${GIVER_TH[questGiver(q)] || ''}${q.lv ? ` · Lv.${q.lv}+` : ''}` });
  return idx;
}

/** อุปกรณ์ที่สุ่มดรอปจากผีตามเลเวล (gear.js rollGearDrop: ผีเลเวล L ดรอปของ lv ∈ [L−4, L+2]) */
function gearDrop(id) {
  const g = GEAR[id]; if (!g || g.legend || g.red || !g.lv) return [];
  const lo = Math.max(1, g.lv - 2), hi = g.lv + 4, W = monWhere();
  const mons = Object.entries(MONSTERS).filter(([k, m]) => W[k] && !m.boss && !m.nightOnly && m.level >= lo && m.level <= hi).sort((a, b) => a[1].level - b[1].level);
  if (!mons.length) return [];
  const names = mons.slice(0, 3).map(([, m]) => `${m.nameTh} Lv.${m.level}`).join(', ') + (mons.length > 3 ? ` +${mons.length - 3} ชนิด` : '');
  const maps = [...new Set(mons.map(([k]) => W[k].split(' · ')[0]))].join(' · ');
  return [{ kind: 'mon', sort: 0, ic: '🎲', text: `สุ่มจากผี Lv.${lo}–${hi} (~2% ต่อตัว)`, sub: `${names} · ${maps}` }];
}

/** แหล่งที่มาทั้งหมดของไอเทม → [{ ic, text, sub, kind }] (เรียงตามโอกาส/ความง่าย) */
export function itemSources(id) {
  IDX ||= build();
  const base = baseItemId(id);
  const list = [...(IDX[base] || []), ...gearDrop(base)];
  const K = { shop: 0, mon: 1, craft: 2, life: 3, quest: 4 };
  return list.sort((a, b) => K[a.kind] - K[b.kind] || (a.sort || 0) - (b.sort || 0));
}
