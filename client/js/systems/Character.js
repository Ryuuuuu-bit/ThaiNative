// ============================================================
//  Character model – ข้อมูลตัวละครผู้เล่น (ใช้เซฟ/โหลด และคำนวณสถานะ)
// ============================================================
import { ENHANCE } from '/shared/data/village.js';
import { JOBS } from '/shared/data/classes.js';
import { ITEMS, STARTING_GOLD, STARTING_ITEMS } from '/shared/data/items.js';
import { sanitizeAppearance } from '/shared/data/appearance.js';
import { computeDerived, expToNext, POINTS_PER_LEVEL, STAT_KEYS } from '/shared/stats.js';
import { SKILLS, SKILL_SLOTS, SP_PER_LEVEL, START_SP, SKILL_BY_ID, canLearn } from '/shared/data/skills.js';

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
export function newCharacter(name, appearance) {
  const a = sanitizeAppearance(appearance);
  const job = JOBS[a.job];
  const c = {
    name: (name || '').trim().slice(0, 16) || 'ผู้กล้า',
    appearance: a,
    level: 1, exp: 0, statPoints: 0,
    stats: { ...job.startStats },
    hp: 0, mp: 0,
    gold: STARTING_GOLD,
    inventory: STARTING_ITEMS.map((i) => ({ ...i })).concat([{ id: `skin_${a.job}`, qty: 1 }]),
    equipment: { weapon: null, armor: null, accessory: null },
    sp: START_SP,                 // Skill Point
    skills: {},                   // { skillId: level }
    hotbar: emptyHotbar(),        // { Q: skillId|null, W, E, R, T }
  };
  learnSkill(c, SKILLS[a.job][0].id);   // เริ่มเกมพร้อมสกิลแรกในช่อง Q
  const d = getDerived(c);
  c.hp = d.maxHp; c.mp = d.maxMp;
  return c;
}

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
  return computeDerived(c.stats, JOBS[c.appearance.job], c.level, equipmentBonus(c));
}

/** ได้ EXP – คืนจำนวนเลเวลที่ขึ้น */
export function gainExp(c, amount) {
  c.exp += amount;
  let ups = 0;
  while (c.exp >= expToNext(c.level)) {
    c.exp -= expToNext(c.level);
    c.level++;
    c.statPoints += POINTS_PER_LEVEL;
    c.sp = (c.sp || 0) + SP_PER_LEVEL;
    ups++;
  }
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
  // เรียนครั้งแรก → ใส่ช่อง Hotbar ที่ว่างให้อัตโนมัติ
  if (c.skills[id] === 1 && !Object.values(c.hotbar).includes(id)) {
    const free = SKILL_SLOTS.find((k) => !c.hotbar[k]);
    if (free) c.hotbar[free] = id;
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

/** เปลี่ยนอาชีพ → คืน SP ทั้งหมด ล้างสกิล */
export function resetSkills(c) {
  c.skills = {};
  c.hotbar = emptyHotbar();
  c.sp = totalSp(c);
  learnSkill(c, SKILLS[c.appearance.job][0].id);
}

/** เซฟเก่าที่ยังไม่มีระบบสกิล */
function migrate(c) {
  if (!c.skills || typeof c.skills !== 'object') c.skills = {};
  if (!c.hotbar) c.hotbar = emptyHotbar();
  for (const k of SKILL_SLOTS) if (!(k in c.hotbar)) c.hotbar[k] = null;
  if (typeof c.sp !== 'number') {
    const spent = Object.values(c.skills).reduce((a, b) => a + b, 0);
    c.sp = Math.max(0, totalSp(c) - spent);
  }
  return c;
}

// ---------------- Save / Load (localStorage) ----------------
export function saveCharacter(c) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(c)); } catch { /* ignore */ }
}
export function loadCharacter() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    c.appearance = sanitizeAppearance(c.appearance);
    return migrate(c);
  } catch { return null; }
}
