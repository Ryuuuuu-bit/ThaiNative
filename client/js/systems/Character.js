// ============================================================
//  Character model – ข้อมูลตัวละครผู้เล่น (ใช้เซฟ/โหลด และคำนวณสถานะ)
// ============================================================
import { JOBS } from '/shared/data/classes.js';
import { ITEMS, STARTING_GOLD, STARTING_ITEMS } from '/shared/data/items.js';
import { sanitizeAppearance } from '/shared/data/appearance.js';
import { computeDerived, expToNext, POINTS_PER_LEVEL, STAT_KEYS } from '/shared/stats.js';

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
  };
  const d = getDerived(c);
  c.hp = d.maxHp; c.mp = d.maxMp;
  return c;
}

/** รวมโบนัสจากอุปกรณ์ที่สวมใส่ */
export function equipmentBonus(c) {
  const bonus = {};
  for (const id of Object.values(c.equipment)) {
    if (!id) continue;
    for (const [k, v] of Object.entries(ITEMS[id]?.bonus || {})) bonus[k] = (bonus[k] || 0) + v;
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
    return c;
  } catch { return null; }
}
