// ============================================================
//  Character model – ข้อมูลตัวละคร (ใช้ร่วม client/server)
//  ▸ server เป็นเจ้าของข้อมูลจริงตอนออนไลน์ · client ใช้ตอนเล่นออฟไลน์
// ============================================================
import { baseItemId } from './data/affixes.js';
/** รหัสที่ใช้วาดบนตัว (ของแมพต่างแดนยืมภาพของชิ้นขั้นสูงเดิม) */
const lookOf = (id) => { const b = baseItemId(id); return (b && ITEMS[b]?.lookAs) || b; };
import { ENHANCE } from './data/village.js';
import { JOBS, VILLAGER, PATH_LV, SUB_CAP } from './data/classes.js';
import { ITEMS, STARTING_GOLD, STARTING_ITEMS, STARTER_WEAPON } from './data/items.js';
import { sanitizeAppearance } from './data/appearance.js';
import { expToNext, POINTS_PER_LEVEL, STAT_KEYS, MAX_LEVEL } from './stats.js';
import { getDerived } from './character.js';
import { SKILL_SLOTS, OLD_SKILL_SLOTS, SP_PER_LEVEL, START_SP, SKILL_BY_ID, canLearn, isItemSlot, slotItemId, skillCap, skillUsable } from './data/skills.js';
import { PASSIVES, KEYSTONE, canAllocate, branchPoints, totalPassivePoints, PASSIVES_ON } from './data/passives.js';
import { LIFE, LIFE_IDS, lifeLevel, masteryLevel } from './data/life.js';
import { fixCards } from './data/cards.js';
import { EQUIP_SLOTS, FLASK_SLOTS, SLOT_TYPE, emptyEquipment } from './data/slots.js';

export const SAVE_VERSION = 2;          // v2 = ตัวละครแบบเดียว + สายหลัก + แนวต่อสู้ตามอาวุธ

export function emptyHotbar() { return { ...Object.fromEntries(SKILL_SLOTS.map((k) => [k, null])), 1: 'it:hp_s', 2: 'it:mp_s' }; }
/** ไอเทมที่ใส่ Hotbar ได้: ยา/อาหาร/ยันต์คืนถิ่น (กด = ใช้) · อาวุธ/เกราะ/เครื่องประดับ (กด = สวม) */
export const HOTBAR_ITEM_TYPES = new Set(['consumable', 'food', 'home', 'weapon', 'armor', 'accessory', 'helm', 'gloves', 'boots', 'belt', 'flask']);
export const hotbarItemOk = (id) => !!ITEMS[id] && HOTBAR_ITEM_TYPES.has(ITEMS[id].type);
const SKILL_FILL_ORDER = ['3', '4', '5', '6', '7', '8', '9', '0', '1', '2'];
/** แปลง/ซ่อม hotbar: เซฟเก่า Q W E R T → ช่อง 3–7 (ช่อง 1/2 = ยา HP/MP) · ตัดสกิลที่ยังไม่เรียน/ไอเทมที่ไม่มีแล้ว */
function fixHotbar(c, hb) {
  if (!hb || typeof hb !== 'object') hb = null;
  let out;
  if (hb && OLD_SKILL_SLOTS.some((k) => k in hb)) {
    out = emptyHotbar();
    OLD_SKILL_SLOTS.forEach((k, i) => { out[String(i + 3)] = hb[k] || null; });
  } else out = { ...Object.fromEntries(SKILL_SLOTS.map((k) => [k, null])), ...(hb || emptyHotbar()) };
  for (const k of Object.keys(out)) if (!SKILL_SLOTS.includes(k)) delete out[k];
  for (const k of SKILL_SLOTS) {
    const v = out[k];
    if (v == null) { out[k] = null; continue; }
    if (isItemSlot(v)) { if (!hotbarItemOk(slotItemId(v))) out[k] = null; }
    else if (typeof v !== 'string' || !SKILL_BY_ID[v] || !(c.skills?.[v] > 0)) out[k] = null;
  }
  return out;
}

export function newCharacter(name, appearance = {}) {
  const c = {
    v: SAVE_VERSION,
    name: String(name || '').replace(/[<>#]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16) || 'ผู้กล้า',   // ชื่อจริงตรวจที่ server (shared/data/names.js)
    appearance: sanitizeAppearance({ ...appearance, weapon: null, armor: null, path: null }),   // ชุดกำหนดตามเพศ (ชาย ม่อฮ่อม · หญิง เรือนต้น)
    path: null,
    level: 1, exp: 0, statPoints: 0,
    stats: { ...VILLAGER.startStats },
    hp: 0, mp: 0,
    gold: STARTING_GOLD,
    inventory: STARTING_ITEMS.map((i) => ({ ...i })),
    equipment: { ...emptyEquipment(), flask: 'flask_hp1', flask2: 'flask_mp1' }, flaskCh: { flask: 3, flask2: 3 }, starterFlask: true,
    sp: START_SP, skills: {}, hotbar: emptyHotbar(),
    quests: { active: {}, done: [] }, enhance: {}, costume: {},
    rec: {}, titles: [], friends: [],
    passives: ['root'], life: {}, wm: {}, cards: {}, cardBook: {},
  };
  const d = getDerived(c);
  c.hp = d.maxHp; c.mp = d.maxMp;
  return c;
}

/** รูปลักษณ์ตามของที่สวม/สายหลัก → true ถ้าภาพเปลี่ยน */
export function syncAppearance(c) {
  const before = JSON.stringify(c.appearance), oldStyle = c.appearance?.job;
  const e = c.enhance || {};
  const top = Math.max(0, ...Object.entries(e).filter(([slot]) => c.equipment[slot]).map(([, v]) => v || 0));
  c.appearance = sanitizeAppearance({ ...c.appearance, weapon: lookOf(c.equipment.weapon), armor: lookOf(c.equipment.armor), path: c.path, aura: ENHANCE.auraTier(top), costume: c.costume,
    wenh: c.equipment.weapon ? e.weapon || 0 : 0, aenh: c.equipment.armor ? e.armor || 0 : 0, title: c.title || null });
  if (oldStyle && oldStyle !== c.appearance.job) swapHotbar(c, oldStyle, c.appearance.job);
  return before !== JSON.stringify(c.appearance);
}

/** Hotbar แยกตามแนวต่อสู้ */
function swapHotbar(c, from, to) {
  c.hotbars = c.hotbars || {};
  if (c.hotbar) c.hotbars[from] = { ...c.hotbar };
  let hb = c.hotbars[to];
  if (!hb) {
    // แถบใหม่ของแนวนี้: ไอเทมตามแถบเดิม + สกิลที่เรียนแล้วของแนวนี้ในช่องที่ว่าง
    hb = Object.fromEntries(SKILL_SLOTS.map((k) => [k, isItemSlot(c.hotbar?.[k]) ? c.hotbar[k] : null]));
    const learned = Object.keys(c.skills || {}).filter((id) => skillUsable(SKILL_BY_ID[id], to) && c.skills[id] > 0);
    for (const id of learned) { const free = SKILL_FILL_ORDER.find((k) => !hb[k]); if (free) hb[free] = id; }
  }
  c.hotbar = fixHotbar(c, hb);
}

export const styleOf = (c) => c.appearance.job;
export const pathName = (c) => (c.path ? JOBS[c.path].nameTh : VILLAGER.nameTh);

// ------------------------------------------------------------
//  ต้นไม้พรสวรรค์ / อาชีพจากการใช้อาวุธ / ทักษะชีวิต
// ------------------------------------------------------------
/** แต้มพรสวรรค์ที่ยังไม่ได้ลง */
export const passiveFree = (c) => !PASSIVES_ON ? 0 : Math.max(0, totalPassivePoints(c.level) - ((c.passives?.length || 1) - 1));

/** อาชีพ (สาย) = กิ่งพรสวรรค์ที่ลงมากสุด × 3 + ความชำนาญอาวุธ · ต้องถึงเกณฑ์ก่อนถึงได้ฉายา ไม่งั้นเป็นชาวบ้าน */
export function recomputePath(c) {
  const bp = branchPoints(c.passives || []);
  let best = null, score = 0;
  for (const j of Object.keys(JOBS)) {
    const s = (PASSIVES_ON ? bp[j] * 3 : 0) + masteryLevel(c.wm?.[j] || 0).lv;
    if (s > score) { score = s; best = j; }
  }
  c.path = score >= (PASSIVES_ON ? 9 : 3) ? best : null;
  return c.path;
}
/** ฉายาเต็ม: มีคีย์สโตนของสาย = ฉายาประจำสาย */
export function classTitle(c) {
  if (!c.path) return VILLAGER.nameTh;
  return PASSIVES_ON && c.passives?.includes(KEYSTONE[c.path]) ? JOBS[c.path].pathTitle : JOBS[c.path].nameTh;
}

/** สกิลที่เลเวลเกินเพดานใหม่ (หลังล้าง/ย้ายพรสวรรค์) → คืน SP */
export function clampSkills(c) {
  let refund = 0;
  for (const [id, lv] of Object.entries(c.skills || {})) {
    const s = SKILL_BY_ID[id];
    if (!s) { delete c.skills[id]; continue; }
    const cap = skillCap(c, s);
    if (lv > cap) { refund += lv - cap; if (cap) c.skills[id] = cap; else delete c.skills[id]; }
  }
  if (refund) { c.sp = (c.sp || 0) + refund; c.hotbar = fixHotbar(c, c.hotbar); if (c.hotbars) for (const j of Object.keys(c.hotbars)) c.hotbars[j] = fixHotbar(c, c.hotbars[j]); }
  return refund;
}

export function allocPassive(c, id) {
  if (!PASSIVES_ON) return { ok: false, msg: 'ต้นไม้พรสวรรค์ปิดใช้งานชั่วคราว' };
  c.passives ||= ['root'];
  if (!PASSIVES[id]) return { ok: false, msg: 'ไม่มีจุดนี้' };
  if (c.passives.includes(id)) return { ok: false, msg: 'ลงจุดนี้แล้ว' };
  if (passiveFree(c) < 1) return { ok: false, msg: 'แต้มพรสวรรค์ไม่พอ (ได้ 1 แต้มต่อเลเวล)' };
  if (!canAllocate(c.passives, id)) return { ok: false, msg: 'ต้องลงจุดที่ติดกันก่อน' };
  c.passives.push(id);
  const before = c.path;
  recomputePath(c);
  syncAppearance(c);
  const n = PASSIVES[id];
  return { ok: true, msg: `${n.kind === 'key' ? '🌟 คีย์สโตน' : n.kind === 'notable' ? '✦' : '+'} ${n.nameTh}`, pathChanged: before !== c.path };
}

export function resetPassives(c) {
  c.passives = ['root'];
  recomputePath(c);
  const refund = clampSkills(c);
  syncAppearance(c);
  return refund;
}

/** ซ่อมต้นไม้: ตัดจุดที่ไม่มี/ไม่ต่อกับกลาง/เกินแต้ม */
function fixPassives(c) {
  const want = new Set((Array.isArray(c.passives) ? c.passives : []).filter((id) => PASSIVES[id]));
  const out = ['root'], max = totalPassivePoints(c.level) + 1;
  let grown = true;
  while (grown && out.length < max) {
    grown = false;
    for (const id of want) if (!out.includes(id) && canAllocate(out, id) && out.length < max) { out.push(id); grown = true; }
  }
  c.passives = out;
}

/** เพิ่ม EXP ทักษะชีวิต → { lv, up } */
export function addLifeXp(c, key, n = 1) {
  if (!LIFE[key]) return null;
  c.life ||= {};
  const before = lifeLevel(c.life[key] || 0).lv;
  c.life[key] = (c.life[key] || 0) + Math.max(0, n | 0);
  const lv = lifeLevel(c.life[key]).lv;
  return { key, lv, up: lv > before };
}
export const lifeLv = (c, key) => lifeLevel(c.life?.[key] || 0).lv;

/** ฆ่าผีด้วยอาวุธที่ถืออยู่ → ความชำนาญอาวุธนั้นขึ้น */
export function addMastery(c, n = 1) {
  const j = c.appearance?.job;
  if (!JOBS[j]) return;
  c.wm ||= {};
  const before = masteryLevel(c.wm[j] || 0).lv;
  c.wm[j] = (c.wm[j] || 0) + n;
  const lv = masteryLevel(c.wm[j]).lv;
  if (lv !== before) recomputePath(c);
  return lv > before ? { job: j, lv } : null;
}

/** ได้ EXP – คืนจำนวนเลเวลที่ขึ้น (ขึ้นเลเวล = ฟื้นเต็ม) */
export function gainExp(c, amount) {
  amount = Math.max(0, Math.floor(Number(amount) || 0));
  if (c.level >= MAX_LEVEL) { c.exp = 0; return 0; }
  c.exp += amount;
  let ups = 0;
  while (c.level < MAX_LEVEL && c.exp >= expToNext(c.level)) {
    c.exp -= expToNext(c.level);
    c.level++;
    c.statPoints += POINTS_PER_LEVEL;
    c.sp = (c.sp || 0) + SP_PER_LEVEL;
    ups++;
  }
  if (c.level >= MAX_LEVEL) c.exp = 0;
  if (ups) { const d = getDerived(c); c.hp = d.maxHp; c.mp = d.maxMp; }
  return ups;
}

export function allocateStat(c, key) {
  if (!STAT_KEYS.includes(key) || c.statPoints <= 0) return false;
  c.stats[key]++;
  c.statPoints--;
  return true;
}

export const totalSp = (c) => START_SP + (c.level - 1) * SP_PER_LEVEL;

export function learnSkill(c, id) {
  const r = canLearn(c, id);
  if (!r.ok) return { ok: false, msg: r.reason };
  c.sp--;
  c.skills[id] = (c.skills[id] || 0) + 1;
  const job = SKILL_BY_ID[id].job;
  const hb = job === c.appearance.job ? c.hotbar : c.hotbars?.[job];
  if (c.skills[id] === 1 && hb && !Object.values(hb).includes(id)) {
    const free = SKILL_FILL_ORDER.find((k) => !hb[k]);
    if (free) hb[free] = id;
  }
  return { ok: true, msg: `${SKILL_BY_ID[id].nameTh} Lv.${c.skills[id]}` };
}

export function assignHotbar(c, key, id) {
  key = String(key);
  if (!SKILL_SLOTS.includes(key)) return false;
  if (id && isItemSlot(id)) { if (!hotbarItemOk(slotItemId(id))) return false; }
  else if (id && !(c.skills[id] > 0)) return false;
  const from = id ? SKILL_SLOTS.find((k) => c.hotbar[k] === id) : null;
  const old = c.hotbar[key];
  c.hotbar[key] = id;
  if (from && from !== key) c.hotbar[from] = old;
  return true;
}

export function resetSkills(c) {
  c.skills = {};
  c.hotbar = fixHotbar(c, c.hotbar);          // เหลือเฉพาะไอเทม
  c.hotbars = {};
  c.sp = totalSp(c);
}

/** ล้างสกิลเฉพาะแนวอาวุธ job (รวมเคล็ดวิชาผสมที่ใช้แนวนี้) → คืน SP เท่าที่ลงไว้ · ความชำนาญ (skx) คงเดิม */
export function resetWeaponSkills(c, job) {
  let back = 0;
  for (const [id, lv] of Object.entries(c.skills || {})) {
    const b = SKILL_BY_ID[id];
    if (!b || !(b.job === job || (b.jobs || []).includes(job))) continue;
    back += lv; delete c.skills[id];
  }
  if (!back) return 0;
  c.sp = Math.min(totalSp(c), (c.sp || 0) + back);
  c.hotbar = fixHotbar(c, c.hotbar);
  if (c.hotbars) for (const j of Object.keys(c.hotbars)) c.hotbars[j] = fixHotbar(c, c.hotbars[j]);
  return back;
}

export function resetStats(c) {
  c.stats = { ...VILLAGER.startStats };
  c.statPoints = (c.level - 1) * POINTS_PER_LEVEL + (c.bonusPoints || 0);
}

export function choosePath(c, path) {
  if (!JOBS[path]) return { ok: false, msg: 'ไม่มีสายนี้' };
  if (c.level < PATH_LV) return { ok: false, msg: `ต้อง Lv.${PATH_LV} ขึ้นไป` };
  if (c.path === path) return { ok: false, msg: 'เป็นสายนี้อยู่แล้ว' };
  const first = !c.path;
  c.path = path;
  if (!first) resetSkills(c);
  else {
    for (const [id, lv] of Object.entries(c.skills)) {
      const s = SKILL_BY_ID[id]; if (!s || s.job === path) continue;
      const cap = s.ultimate ? 0 : SUB_CAP;
      if (lv > cap) { c.sp += lv - cap; if (cap) c.skills[id] = cap; else delete c.skills[id]; }
    }
    c.hotbar = fixHotbar(c, c.hotbar);
  }
  syncAppearance(c);
  return { ok: true, msg: first ? `เลือกสายหลัก: ${JOBS[path].pathTitle}!` : `เปลี่ยนสายหลักเป็น ${JOBS[path].nameTh} (คืน SP ทั้งหมด)` };
}

/** แปลงเซฟเก่า/ซ่อมโครงสร้าง → ตัวละครที่ใช้ได้ */
export function migrate(c) {
  if (!c || typeof c !== 'object') return null;
  c.name = String(c.name || '').replace(/[<>]/g, '').replace(/\s*#(\d{3})$/, ' #$1').trim().slice(0, 21) || 'ผู้กล้า';   // เลขกันชื่อซ้ำ: "Ryuu #001"
  c.appearance = sanitizeAppearance(c.appearance || {});
  c.level = Number.isFinite(+c.level) ? Math.max(1, Math.min(MAX_LEVEL, Math.floor(+c.level))) : 1;
  c.exp = Number.isFinite(+c.exp) ? Math.max(0, Math.floor(+c.exp)) : 0;
  c.statPoints = Number.isFinite(+c.statPoints) ? Math.max(0, Math.floor(+c.statPoints)) : 0;
  if (!c.stats || typeof c.stats !== 'object') c.stats = { ...VILLAGER.startStats };
  for (const k of STAT_KEYS) c.stats[k] = Number.isFinite(+c.stats[k]) ? Math.max(0, Math.floor(+c.stats[k])) : VILLAGER.startStats[k];
  if (!c.skills || typeof c.skills !== 'object') c.skills = {};
  c.hotbar = fixHotbar(c, c.hotbar);
  if (c.hotbars && typeof c.hotbars === 'object') for (const j of Object.keys(c.hotbars)) c.hotbars[j] = fixHotbar(c, c.hotbars[j]);
  if (!c.equipment || typeof c.equipment !== 'object') c.equipment = emptyEquipment();
  for (const s of EQUIP_SLOTS) if (!(s in c.equipment)) c.equipment[s] = null;
  for (const s of Object.keys(c.equipment)) if (!EQUIP_SLOTS.includes(s)) delete c.equipment[s];
  // ขวดยาเริ่มต้น (แจกครั้งเดียวให้ตัวละครเดิม)
  if (!c.starterFlask) { c.starterFlask = true; if (!c.equipment.flask) c.equipment.flask = 'flask_hp1'; if (!c.equipment.flask2) c.equipment.flask2 = 'flask_mp1'; }
  if (!c.flaskCh || typeof c.flaskCh !== 'object') c.flaskCh = {};
  for (const s of FLASK_SLOTS) { const f = ITEMS[c.equipment[s]]?.flask; c.flaskCh[s] = f ? Math.max(0, Math.min(f.max, Number.isFinite(+c.flaskCh[s]) ? +c.flaskCh[s] : f.max)) : 0; }
  if (!Array.isArray(c.inventory)) c.inventory = [];
  c.inventory = c.inventory.filter((s) => s && ITEMS[s.id] && s.qty > 0).map((s) => ({ id: s.id, qty: Math.floor(s.qty) }));
  if (!c.costume || typeof c.costume !== 'object') c.costume = {};
  for (const k of Object.keys(c.costume)) if (c.costume[k] && ITEMS[c.costume[k]]?.type !== 'costume') c.costume[k] = null;   // ชุดรุ่นเก่าที่ถูกถอดออกจากเกม
  if (!c.enhance || typeof c.enhance !== 'object') c.enhance = {};
  fixCards(c);                                                   // การ์ดในช่องสวมใส่ + สมุดสะสม
  for (const k of Object.keys(c.equipment)) if (c.equipment[k] && (!ITEMS[c.equipment[k]] || ITEMS[c.equipment[k]].type !== SLOT_TYPE[k])) c.equipment[k] = null;
  if (!c.quests) c.quests = { active: {}, done: [] };
  if (!c.rec) c.rec = {};
  if (!Array.isArray(c.titles)) c.titles = [];
  if (!Array.isArray(c.friends)) c.friends = [];
  if (!Number.isFinite(c.gold)) c.gold = 0;
  if (typeof c.sp !== 'number') {
    const spent = Object.values(c.skills).reduce((a, b) => a + b, 0);
    c.sp = Math.max(0, totalSp(c) - spent);
  }
  if (!(c.v >= 2)) {
    const job = JOBS[c.appearance?.job] ? c.appearance.job : 'swordman';
    c.path = job;
    const w = c.equipment.weapon;
    if (w && !ITEMS[w]?.wtype) c.equipment.weapon = null;
    if (!c.equipment.weapon) {
      const inv = c.inventory.find((s) => ITEMS[s.id]?.wtype && ITEMS[s.id].wtype === ITEMS[STARTER_WEAPON[job]].wtype);
      if (inv) { c.equipment.weapon = inv.id; inv.qty--; c.inventory = c.inventory.filter((s) => s.qty > 0); }
      else c.equipment.weapon = STARTER_WEAPON[job];
    }
    c.bonusPoints = 2;
    resetStats(c);
    c.inventory = c.inventory.filter((s) => ITEMS[s.id] && s.id !== `skin_${job}`);
    const rw = c.inventory.find((s) => s.id === 'reset_water');
    if (rw) rw.qty++; else c.inventory.push({ id: 'reset_water', qty: 1 });
    c.migratedV2 = true;
    c.v = SAVE_VERSION;
  }
  if (c.path && !JOBS[c.path]) c.path = null;
  if (c.path === undefined) c.path = null;
  if (!c.life || typeof c.life !== 'object') c.life = {};
  for (const k of Object.keys(c.life)) if (!LIFE_IDS.includes(k) || !Number.isFinite(+c.life[k])) delete c.life[k];
  if (!c.wm || typeof c.wm !== 'object') c.wm = {};
  // ระบบเดิม (เลือกสายหลักตอน Lv.10) → ต้นไม้พรสวรรค์: ลงแต้มตามกิ่งสายเดิมให้อัตโนมัติ ไม่เสียความเก่ง
  if (!Array.isArray(c.passives)) {
    c.passives = ['root'];
    if (c.path) {
      for (const i of [0, 1, 2, 3, 5, 7, 8, 4, 6]) {
        if (passiveFree(c) < 1) break;
        const id = `${c.path}_${i}`;
        if (canAllocate(c.passives, id)) c.passives.push(id);
      }
      c.wm[c.path] = Math.max(c.wm[c.path] || 0, 60);
    }
  }
  fixPassives(c);
  recomputePath(c);
  clampSkills(c);
  syncAppearance(c);
  const d = getDerived(c);
  if (!Number.isFinite(c.hp) || c.hp <= 0) c.hp = d.maxHp;
  c.hp = Math.min(c.hp, d.maxHp);
  if (!Number.isFinite(c.mp)) c.mp = d.maxMp;
  return c;
}
