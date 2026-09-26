// ============================================================
//  Character model – ข้อมูลตัวละครผู้เล่น (ใช้เซฟ/โหลด และคำนวณสถานะ)
// ============================================================
import { ENHANCE } from '/shared/data/village.js';
import { account } from '../net/Account.js';
import { JOBS, VILLAGER, PATH_LV, SUB_CAP } from '/shared/data/classes.js';
import { ITEMS, STARTING_GOLD, STARTING_ITEMS, STARTER_WEAPON } from '/shared/data/items.js';
import { sanitizeAppearance } from '/shared/data/appearance.js';
import { computeDerived, expToNext, POINTS_PER_LEVEL, STAT_KEYS, MAX_LEVEL } from '/shared/stats.js';
import { SKILL_SLOTS, SP_PER_LEVEL, START_SP, SKILL_BY_ID, canLearn } from '/shared/data/skills.js';

const SAVE_KEY = 'thainative_save_v1';

/**
 * โครงสร้างข้อมูลตัวละคร
 * {
 *   name, appearance:{gender,outfit,hair,face,job},
 *   level, exp, statPoints, stats:{STR,DEX,INT,CRI,VIT},
 *   hp, mp, gold,
 *   inventory:[{id,qty}], equipment:{weapon,armor,accessory}
 * }
 */
export const SAVE_VERSION = 2;          // v2 = ตัวละครแบบเดียว + สายหลัก + แนวต่อสู้ตามอาวุธ

export function newCharacter(name, appearance) {
  const c = {
    v: SAVE_VERSION,
    name: (name || '').trim().slice(0, 16) || 'ผู้กล้า',
    appearance: sanitizeAppearance({ ...appearance, weapon: null, armor: null, path: null }),
    path: null,                   // สายหลัก (เลือกที่ผู้ใหญ่ชัยตอน Lv.10)
    level: 1, exp: 0, statPoints: 0,
    stats: { ...VILLAGER.startStats },
    hp: 0, mp: 0,
    gold: STARTING_GOLD,
    inventory: STARTING_ITEMS.map((i) => ({ ...i })),
    equipment: { weapon: null, armor: null, accessory: null },
    sp: START_SP,                 // Skill Point
    skills: {},                   // { skillId: level }
    hotbar: emptyHotbar(),        // { Q: skillId|null, W, E, R, T }
  };
  const d = getDerived(c);
  c.hp = d.maxHp; c.mp = d.maxMp;
  return c;
}

/** รูปลักษณ์ตามของที่สวม/สายหลัก (เรียกทุกครั้งที่เปลี่ยนอาวุธ/ชุด/สาย) → true ถ้าภาพเปลี่ยน */
export function syncAppearance(c) {
  const before = JSON.stringify(c.appearance), oldStyle = c.appearance?.job;
  const top = Math.max(0, ...Object.entries(c.enhance || {}).filter(([slot]) => c.equipment[slot]).map(([, v]) => v || 0));
  c.appearance = sanitizeAppearance({ ...c.appearance, weapon: c.equipment.weapon, armor: c.equipment.armor, path: c.path, aura: ENHANCE.auraTier(top), costume: c.costume });
  if (oldStyle && oldStyle !== c.appearance.job) swapHotbar(c, oldStyle, c.appearance.job);
  return before !== JSON.stringify(c.appearance);
}

/** Hotbar แยกตามแนวต่อสู้: เปลี่ยนอาวุธ → เก็บชุดเดิม แล้วโหลดชุดของแนวใหม่ (ครั้งแรกจัดสกิลที่เรียนแล้วให้อัตโนมัติ) */
function swapHotbar(c, from, to) {
  c.hotbars = c.hotbars || {};
  if (c.hotbar) c.hotbars[from] = { ...c.hotbar };
  let hb = c.hotbars[to];
  if (!hb) {
    hb = emptyHotbar();
    const learned = Object.keys(c.skills || {}).filter((id) => SKILL_BY_ID[id]?.job === to && c.skills[id] > 0);
    SKILL_SLOTS.forEach((k, i) => { hb[k] = learned[i] || null; });
  }
  for (const k of SKILL_SLOTS) if (hb[k] && !(c.skills?.[hb[k]] > 0)) hb[k] = null;   // สกิลที่ถูกล้างไปแล้ว
  c.hotbar = { ...emptyHotbar(), ...hb };
}

/** แนวต่อสู้ปัจจุบัน (ตามอาวุธที่ถือ) */
export const styleOf = (c) => c.appearance.job;
/** ชื่อที่แสดง: สายหลัก หรือ ชาวบ้าน */
export const pathName = (c) => (c.path ? JOBS[c.path].nameTh : VILLAGER.nameTh);

/** รวมโบนัสจากอุปกรณ์ที่สวมใส่ */
export function equipmentBonus(c) {
  const bonus = {};
  const add = (o) => { for (const [k, v] of Object.entries(o || {})) bonus[k] = (bonus[k] || 0) + v; };
  for (const [slot, id] of Object.entries(c.equipment)) {
    if (!id) continue;
    add(ITEMS[id]?.bonus);
    const lv = c.enhance?.[slot] || 0;                  // ตีบวกกับลุงดำ (บวกตามช่อง)
    if (lv && ENHANCE.bonus[slot]) add(ENHANCE.bonus[slot](lv));
  }
  return bonus;
}

export function getDerived(c) {
  const bonus = equipmentBonus(c);
  for (const [k, v] of Object.entries(JOBS[c.path]?.pathBonus || {})) bonus[k] = (bonus[k] || 0) + v;   // โบนัสสายหลัก
  return computeDerived(c.stats, VILLAGER, c.level, bonus);
}

/** ได้ EXP – คืนจำนวนเลเวลที่ขึ้น */
export function gainExp(c, amount) {
  if (c.level >= MAX_LEVEL) { c.exp = 0; return 0; }                 // เลเวลตัน
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
  if (ups) { const d = getDerived(c); c.hp = d.maxHp; c.mp = d.maxMp; } // ขึ้นเลเวลแล้วฟื้นเต็ม
  return ups;
}

/** อัปแต้มสถานะ */
export function allocateStat(c, key) {
  if (!STAT_KEYS.includes(key) || c.statPoints <= 0) return false;
  c.stats[key]++;
  c.statPoints--;
  return true;
}

// ---------------- Skill Tree ----------------
export function emptyHotbar() { return Object.fromEntries(SKILL_SLOTS.map((k) => [k, null])); }

/** SP ทั้งหมดที่ได้ตามเลเวล */
export const totalSp = (c) => START_SP + (c.level - 1) * SP_PER_LEVEL;

/** เรียน/อัปเลเวลสกิล 1 ขั้น → { ok, msg } */
export function learnSkill(c, id) {
  const r = canLearn(c, id);
  if (!r.ok) return { ok: false, msg: r.reason };
  c.sp--;
  c.skills[id] = (c.skills[id] || 0) + 1;
  // เรียนครั้งแรก → ใส่ Hotbar ของแนวนั้น (แนวปัจจุบัน = แถบบนจอ, แนวอื่น = แถบที่เก็บไว้)
  const job = SKILL_BY_ID[id].job;
  const hb = job === c.appearance.job ? c.hotbar : c.hotbars?.[job];
  if (c.skills[id] === 1 && hb && !Object.values(hb).includes(id)) {
    const free = SKILL_SLOTS.find((k) => !hb[k]);
    if (free) hb[free] = id;
  }
  return { ok: true, msg: `${SKILL_BY_ID[id].nameTh} Lv.${c.skills[id]}` };
}

/** ติดตั้งสกิลลงช่อง (null = ถอดออก)  ถ้าสกิลอยู่ช่องอื่นแล้วจะย้ายมา */
export function assignHotbar(c, key, id) {
  if (!SKILL_SLOTS.includes(key)) return false;
  if (id && !(c.skills[id] > 0)) return false;
  // สลับช่อง: ถ้าสกิลนี้อยู่ช่องอื่น ให้สกิลเดิมของช่องปลายทางย้ายไปแทน
  const from = id ? SKILL_SLOTS.find((k) => c.hotbar[k] === id) : null;
  const old = c.hotbar[key];
  c.hotbar[key] = id;
  if (from && from !== key) c.hotbar[from] = old;
  return true;
}

/** คืน SP ทั้งหมด ล้างสกิล */
export function resetSkills(c) {
  c.skills = {};
  c.hotbar = emptyHotbar();
  c.hotbars = {};
  c.sp = totalSp(c);
}

/** คืนแต้มสถานะทั้งหมด */
export function resetStats(c) {
  c.stats = { ...VILLAGER.startStats };
  c.statPoints = (c.level - 1) * POINTS_PER_LEVEL + (c.bonusPoints || 0);
}

/** เลือก/เปลี่ยนสายหลัก → { ok, msg } */
export function choosePath(c, path) {
  if (!JOBS[path]) return { ok: false, msg: 'ไม่มีสายนี้' };
  if (c.level < PATH_LV) return { ok: false, msg: `ต้อง Lv.${PATH_LV} ขึ้นไป` };
  if (c.path === path) return { ok: false, msg: 'เป็นสายนี้อยู่แล้ว' };
  const first = !c.path;
  c.path = path;
  if (!first) resetSkills(c);            // เปลี่ยนสาย → คืน SP ให้ลงใหม่
  else {                                  // เลือกครั้งแรก: สกิลสายอื่นที่เกินเพดานสายรอง → คืน SP ส่วนเกิน
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

/** แปลงเซฟเก่า */
function migrate(c) {
  if (!c.skills || typeof c.skills !== 'object') c.skills = {};
  if (!c.hotbar) c.hotbar = emptyHotbar();
  for (const k of SKILL_SLOTS) if (!(k in c.hotbar)) c.hotbar[k] = null;
  if (!c.equipment) c.equipment = { weapon: null, armor: null, accessory: null };
  if (!c.inventory) c.inventory = [];
  if (!c.costume) c.costume = {};
  if (typeof c.sp !== 'number') {
    const spent = Object.values(c.skills).reduce((a, b) => a + b, 0);
    c.sp = Math.max(0, totalSp(c) - spent);
  }
  if (!(c.v >= 2)) {
    // v1 → v2: อาชีพเดิมกลายเป็นสายหลัก, คืนแต้มสถานะให้ลงใหม่, ให้อาวุธประจำสาย + น้ำมนต์ล้างแต้ม 1 ขวด
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
    c.migratedV2 = true;                   // แจ้งผู้เล่นครั้งแรกที่เข้าเกม
    c.v = SAVE_VERSION;
  }
  if (c.path && !JOBS[c.path]) c.path = null;
  if (c.path === undefined) c.path = null;
  syncAppearance(c);
  return c;
}

// ---------------- Save / Load ----------------
// ล็อกอินแล้ว → เซฟขึ้น server (Account) + สำรองในเครื่อง / ออฟไลน์ → เก็บในเครื่องอย่างเดียว
export function saveCharacter(c) {
  try { localStorage.setItem(account.loggedIn ? `${SAVE_KEY}_acc${account.account.id}` : SAVE_KEY, JSON.stringify(c)); } catch { /* ignore */ }
  account.saveCharacter(c);
}
/** ตัวละครจาก server → ตรวจ/อัปเกรดข้อมูลให้ตรงเวอร์ชันปัจจุบัน */
export function reviveCharacter(c) {
  if (!c) return null;
  try { return migrate(c); } catch (e) { console.error(e); return null; }
}
export function loadCharacter() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return migrate(JSON.parse(raw));
  } catch { return null; }
}
