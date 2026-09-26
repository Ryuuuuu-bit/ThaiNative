// ============================================================
//  Character model – ข้อมูลตัวละคร (ใช้ร่วม client/server)
//  ▸ server เป็นเจ้าของข้อมูลจริงตอนออนไลน์ · client ใช้ตอนเล่นออฟไลน์
// ============================================================
import { ENHANCE } from './data/village.js';
import { JOBS, VILLAGER, PATH_LV, SUB_CAP } from './data/classes.js';
import { ITEMS, STARTING_GOLD, STARTING_ITEMS, STARTER_WEAPON } from './data/items.js';
import { sanitizeAppearance } from './data/appearance.js';
import { expToNext, POINTS_PER_LEVEL, STAT_KEYS, MAX_LEVEL } from './stats.js';
import { getDerived } from './character.js';
import { SKILL_SLOTS, SP_PER_LEVEL, START_SP, SKILL_BY_ID, canLearn } from './data/skills.js';

export const SAVE_VERSION = 2;          // v2 = ตัวละครแบบเดียว + สายหลัก + แนวต่อสู้ตามอาวุธ

export function emptyHotbar() { return Object.fromEntries(SKILL_SLOTS.map((k) => [k, null])); }

export function newCharacter(name, appearance = {}) {
  const c = {
    v: SAVE_VERSION,
    name: String(name || '').replace(/[<>]/g, '').trim().slice(0, 16) || 'ผู้กล้า',
    appearance: sanitizeAppearance({ ...appearance, weapon: null, armor: null, path: null }),
    path: null,
    level: 1, exp: 0, statPoints: 0,
    stats: { ...VILLAGER.startStats },
    hp: 0, mp: 0,
    gold: STARTING_GOLD,
    inventory: STARTING_ITEMS.map((i) => ({ ...i })),
    equipment: { weapon: null, armor: null, accessory: null, accessory2: null },
    sp: START_SP, skills: {}, hotbar: emptyHotbar(),
    quests: { active: {}, done: [] }, enhance: {}, costume: {},
    rec: {}, titles: [], friends: [],
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
  c.appearance = sanitizeAppearance({ ...c.appearance, weapon: c.equipment.weapon, armor: c.equipment.armor, path: c.path, aura: ENHANCE.auraTier(top), costume: c.costume,
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
    hb = emptyHotbar();
    const learned = Object.keys(c.skills || {}).filter((id) => SKILL_BY_ID[id]?.job === to && c.skills[id] > 0);
    SKILL_SLOTS.forEach((k, i) => { hb[k] = learned[i] || null; });
  }
  for (const k of SKILL_SLOTS) if (hb[k] && !(c.skills?.[hb[k]] > 0)) hb[k] = null;
  c.hotbar = { ...emptyHotbar(), ...hb };
}

export const styleOf = (c) => c.appearance.job;
export const pathName = (c) => (c.path ? JOBS[c.path].nameTh : VILLAGER.nameTh);

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
    const free = SKILL_SLOTS.find((k) => !hb[k]);
    if (free) hb[free] = id;
  }
  return { ok: true, msg: `${SKILL_BY_ID[id].nameTh} Lv.${c.skills[id]}` };
}

export function assignHotbar(c, key, id) {
  if (!SKILL_SLOTS.includes(key)) return false;
  if (id && !(c.skills[id] > 0)) return false;
  const from = id ? SKILL_SLOTS.find((k) => c.hotbar[k] === id) : null;
  const old = c.hotbar[key];
  c.hotbar[key] = id;
  if (from && from !== key) c.hotbar[from] = old;
  return true;
}

export function resetSkills(c) {
  c.skills = {};
  c.hotbar = emptyHotbar();
  c.hotbars = {};
  c.sp = totalSp(c);
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
    for (const k of SKILL_SLOTS) if (c.hotbar[k] && !c.skills[c.hotbar[k]]) c.hotbar[k] = null;
  }
  syncAppearance(c);
  return { ok: true, msg: first ? `เลือกสายหลัก: ${JOBS[path].pathTitle}!` : `เปลี่ยนสายหลักเป็น ${JOBS[path].nameTh} (คืน SP ทั้งหมด)` };
}

/** แปลงเซฟเก่า/ซ่อมโครงสร้าง → ตัวละครที่ใช้ได้ */
export function migrate(c) {
  if (!c || typeof c !== 'object') return null;
  c.name = String(c.name || '').replace(/[<>]/g, '').trim().slice(0, 16) || 'ผู้กล้า';
  c.appearance = sanitizeAppearance(c.appearance || {});
  c.level = Number.isFinite(+c.level) ? Math.max(1, Math.min(MAX_LEVEL, Math.floor(+c.level))) : 1;
  c.exp = Number.isFinite(+c.exp) ? Math.max(0, Math.floor(+c.exp)) : 0;
  c.statPoints = Number.isFinite(+c.statPoints) ? Math.max(0, Math.floor(+c.statPoints)) : 0;
  if (!c.stats || typeof c.stats !== 'object') c.stats = { ...VILLAGER.startStats };
  for (const k of STAT_KEYS) c.stats[k] = Number.isFinite(+c.stats[k]) ? Math.max(0, Math.floor(+c.stats[k])) : VILLAGER.startStats[k];
  if (!c.skills || typeof c.skills !== 'object') c.skills = {};
  if (!c.hotbar) c.hotbar = emptyHotbar();
  for (const k of SKILL_SLOTS) if (!(k in c.hotbar)) c.hotbar[k] = null;
  if (!c.equipment) c.equipment = { weapon: null, armor: null, accessory: null, accessory2: null };
  if (!('accessory2' in c.equipment)) c.equipment.accessory2 = null;
  if (!Array.isArray(c.inventory)) c.inventory = [];
  c.inventory = c.inventory.filter((s) => s && ITEMS[s.id] && s.qty > 0).map((s) => ({ id: s.id, qty: Math.floor(s.qty) }));
  if (!c.costume || typeof c.costume !== 'object') c.costume = {};
  if (!c.enhance || typeof c.enhance !== 'object') c.enhance = {};
  for (const k of Object.keys(c.equipment)) if (c.equipment[k] && !ITEMS[c.equipment[k]]) c.equipment[k] = null;
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
  syncAppearance(c);
  const d = getDerived(c);
  if (!Number.isFinite(c.hp) || c.hp <= 0) c.hp = d.maxHp;
  c.hp = Math.min(c.hp, d.maxHp);
  if (!Number.isFinite(c.mp)) c.mp = d.maxMp;
  return c;
}
