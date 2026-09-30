// ============================================================
//  Character model – ข้อมูลตัวละคร (ใช้ร่วม client/server)
//  ▸ server เป็นเจ้าของข้อมูลจริงตอนออนไลน์ · client ใช้ตอนเล่นออฟไลน์
// ============================================================
import { baseItemId } from './data/affixes.js';
/** รหัสที่ใช้วาดบนตัว (ของแมพต่างแดนยืมภาพของชิ้นขั้นสูงเดิม) */
const lookOf = (id) => { const b = baseItemId(id); return (b && ITEMS[b]?.lookAs) || b; };
import { ENHANCE } from './data/village.js';
import { JOBS, VILLAGER, PATH_LV, SUB_CAP } from './data/classes.js';
import { ITEMS, STARTING_GOLD, STARTING_ITEMS, STARTER_WEAPON, WTYPE_JOB } from './data/items.js';
import { sanitizeAppearance, weaponTier } from './data/appearance.js';
import { expToNext, STAT_KEYS, MAX_LEVEL, STAT_CAP, STAT_START, statCost, statSpentOn, statPointsAt, pointsForLevel } from './stats.js';
import { getDerived } from './character.js';
import { SKILL_SLOTS, OLD_SKILL_SLOTS, SP_PER_LEVEL, START_SP, spAt, spForLevel, SKILL_BY_ID, canLearn, isItemSlot, slotItemId, skillCap, skillUsable } from './data/skills.js';
import { PASSIVES, KEYSTONE, canAllocate, branchPoints, totalPassivePoints, PASSIVES_ON } from './data/passives.js';
import { LIFE, LIFE_IDS, lifeLevel, masteryLevel } from './data/life.js';
import { fixCards } from './data/cards.js';
import { EQUIP_SLOTS, FLASK_SLOTS, SLOT_TYPE, emptyEquipment } from './data/slots.js';

/** ราคาคืนเงินชุดแต่งตัว (ระบบถูกเอาออกจากเกม) · ของร้าน = ราคาซื้อ · ของหายาก ฿300,000 · มงกุฎจักรพรรดิ ฿500,000 */
const COSTUME_REFUND = { cs_outfit_ruenton: 1400, cs_outfit_mohom: 1200, cs_outfit_isan: 1400, cs_outfit_jongkraben: 1800, cs_outfit_rajpatan: 2000, cs_outfit_chaona: 1200, cs_outfit_silk: 2400, cs_outfit_hunter: 1600, cs_outfit_warrior: 2600, cs_outfit_mahadlek: 3000, cs_head_chada: 2200, cs_head_ngob: 700, cs_head_naga: 3200, cs_head_mongkol: 600, cs_head_flower: 900, cs_head_peacock: 300000, cs_head_jade: 300000, cs_head_asura: 300000, cs_head_emperor: 500000, cs_face_takhon: 1100, cs_face_khon: 1600, cs_face_skull: 300000, cs_back_kinnari: 2800, cs_back_umbrella: 1200, cs_back_flag: 1800, cs_back_bat: 300000 };

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

const NEW_STAT = 5;                                    // ตัวใหม่: 6 ค่า × (1→5) = 48 แต้มพอดี
export function newCharacter(name, appearance = {}) {
  const c = {
    v: SAVE_VERSION,
    name: String(name || '').replace(/[<>#]/g, '').replace(/\s+/g, ' ').trim().slice(0, 16) || 'ผู้กล้า',   // ชื่อจริงตรวจที่ server (shared/data/names.js)
    appearance: sanitizeAppearance({ ...appearance, weapon: null, armor: null, path: null }),   // ชุดกำหนดตามเพศ (ชาย ม่อฮ่อม · หญิง เรือนต้น)
    path: null,
    level: 1, exp: 0, statPoints: statPointsAt(1) - STAT_KEYS.length * statSpentOn(NEW_STAT), statsRO: true, spV2: true,   // แบบ RO: แต้ม 48 ลงให้ก่อนเท่า ๆ กัน (ทุกค่า 5) · รีแต้มแล้วกลับเป็น 1
    stats: Object.fromEntries(STAT_KEYS.map((k) => [k, NEW_STAT])),
    hp: 0, mp: 0,
    gold: STARTING_GOLD,
    inventory: STARTING_ITEMS.map((i) => ({ ...i })),
    equipment: { ...emptyEquipment(), flask: 'flask_hp1', flask2: 'flask_mp1' }, flaskCh: { flask: 3, flask2: 3 }, starterFlask: true,
    sp: START_SP, skills: {}, hotbar: emptyHotbar(),
    quests: { active: {}, done: [] }, enhance: {},
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
  c.appearance = sanitizeAppearance({ ...c.appearance, weapon: lookOf(c.equipment.weapon), armor: lookOf(c.equipment.armor), path: c.path, aura: ENHANCE.auraTier(top),
    wtier: weaponTier(baseItemId(c.equipment.weapon)), wenh: c.equipment.weapon ? e.weapon || 0 : 0, aenh: c.equipment.armor ? e.armor || 0 : 0, title: c.title || null });
  if (oldStyle && oldStyle !== c.appearance.job) swapHotbar(c, oldStyle, c.appearance.job);
  if (oldStyle !== c.appearance.job) { recomputePath(c); c.appearance.path = c.path; }   // สลับแนวอาวุธ → อาชีพตามอาวุธที่ถือ (ถ้าชำนาญถึงเกณฑ์)
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

/** อาชีพ (สาย) = กิ่งพรสวรรค์ที่ลงมากสุด × 3 + ความชำนาญอาวุธ · ต้องถึงเกณฑ์ก่อนถึงได้ฉายา ไม่งั้นเป็นชาวบ้าน
 *  ▸ ปิดพรสวรรค์อยู่: อาวุธที่ถืออยู่มีความชำนาญถึงเกณฑ์ → เป็นสายนั้นเลย (สลับอาวุธหลักได้ ไม่ติดสายเก่าที่เคยฟาร์ม)
 *    อาวุธที่ถือยังไม่ถึงเกณฑ์ → ใช้สายที่ชำนาญสูงสุดเหมือนเดิม */
export function recomputePath(c) {
  const cur = c.appearance?.job;
  if (!PASSIVES_ON && JOBS[cur] && masteryLevel(c.wm?.[cur] || 0).lv >= 3) return (c.path = cur);
  const bp = branchPoints(c.passives || []);
  // เลเวลเท่ากัน → ตัดสินด้วยแต้มความชำนาญรวม (ฆ่ามากกว่า) → ยังเท่าอีก = คงอาชีพเดิม (ไม่สลับไปมาตามลำดับในตาราง)
  const prev = c.path;
  let best = null, score = 0, xp = -1;
  for (const j of Object.keys(JOBS)) {
    const s = (PASSIVES_ON ? bp[j] * 3 : 0) + masteryLevel(c.wm?.[j] || 0).lv, x = c.wm?.[j] || 0;
    if (s > score || (s === score && s > 0 && (x > xp || (x === xp && j === prev)))) { score = s; best = j; xp = x; }
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
    c.statPoints += pointsForLevel(c.level);                           // แบบ RO: floor((L−1)/5)+3
    c.sp = (c.sp || 0) + spForLevel(c.level);                        // หลัง Lv.60 ได้ SP ทุก 2 เลเวล
    ups++;
  }
  if (c.level >= MAX_LEVEL) c.exp = 0;
  if (ups) { const d = getDerived(c); c.hp = d.maxHp; c.mp = d.maxMp; }
  return ups;
}

/** เพิ่มค่าสถานะ 1 ขั้น (แบบ RO: ค่ายิ่งสูงยิ่งใช้แต้มมาก · เพดาน 130) */
export function allocateStat(c, key) {
  if (!STAT_KEYS.includes(key)) return false;
  const v = c.stats[key] || STAT_START, cost = statCost(v);
  if (v >= STAT_CAP || c.statPoints < cost) return false;
  c.stats[key] = v + 1;
  c.statPoints -= cost;
  return true;
}

export const totalSp = (c) => spAt(c.level);

export function learnSkill(c, id) {
  const r = canLearn(c, id);
  if (!r.ok) return { ok: false, msg: r.reason };
  c.sp--;
  c.skills[id] = (c.skills[id] || 0) + 1;
  const job = SKILL_BY_ID[id].job;
  const hb = job === c.appearance.job ? c.hotbar : c.hotbars?.[job];
  if (c.skills[id] === 1 && SKILL_BY_ID[id].type !== 'passive' && hb && !Object.values(hb).includes(id)) {   // สกิลติดตัวไม่ลง Hotbar
    const free = SKILL_FILL_ORDER.find((k) => !hb[k]);
    if (free) hb[free] = id;
  }
  return { ok: true, msg: `${SKILL_BY_ID[id].nameTh} Lv.${c.skills[id]}` };
}

export function assignHotbar(c, key, id) {
  key = String(key);
  if (!SKILL_SLOTS.includes(key)) return false;
  if (id && isItemSlot(id)) { if (!hotbarItemOk(slotItemId(id))) return false; }
  else if (id && (!(c.skills[id] > 0) || SKILL_BY_ID[id]?.type === 'passive')) return false;   // สกิลติดตัวใส่ Hotbar ไม่ได้
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

// ------------------------------------------------------------
//  ชุดการเล่น 2 ชุด (Preset A / B) · กด Tab สลับ
//  ▸ แต่ละชุดจำ: อุปกรณ์ที่สวม (ยกเว้นขวดยา) · แต้มสถานะ · สกิลที่เรียน + SP · Hotbar
//  ▸ ชุดที่ใช้อยู่ = ค่าบนตัวละครตามปกติ (โค้ดเดิมทั้งหมดใช้ต่อได้) · อีกชุดเก็บใน c.presets[i]
//  ▸ แต้มสถานะ/SP ของแต่ละชุดคิดจากเลเวลเต็มจำนวน (ชุดละ 1 SP/เลเวล · 5 แต้มสถานะ/เลเวล) → คำนวณใหม่ตอนสลับเข้า
//  ▸ ของไม่ถูกคัดลอก: ชุดจำแค่ "ใส่ชิ้นไหน" ของจริงอยู่ในกระเป๋า (ขาย/เทรดไปแล้ว = ช่องนั้นว่าง)
//  ▸ ขั้นตีบวก/การ์ด ผูกกับช่อง → ใช้ร่วมทั้งสองชุด
// ------------------------------------------------------------
export const PRESET_N = 2, PRESET_LABEL = ['A', 'B'];
export const PRESET_SLOTS = EQUIP_SLOTS.filter((s) => !FLASK_SLOTS.includes(s));
export const totalStatPts = (c) => statPointsAt(c.level) + (c.bonusPoints || 0);
const statSpent = (st) => STAT_KEYS.reduce((a, k) => a + statSpentOn(st[k] || STAT_START), 0);
const spSpent = (sk) => Object.values(sk).reduce((a, v) => a + (v | 0), 0);

/** ถ่ายค่าชุดที่ใช้อยู่ */
export function snapPreset(c) {
  return {
    eq: Object.fromEntries(PRESET_SLOTS.map((s) => [s, c.equipment[s] || null])),
    stats: { ...c.stats }, skills: { ...(c.skills || {}) },
    hotbar: { ...c.hotbar }, hotbars: JSON.parse(JSON.stringify(c.hotbars || {})),
  };
}
/** ชุดใหม่ (ยังไม่เคยใช้): ว่าง · แต้มเต็ม */
export function blankPreset() {
  return { eq: {}, stats: { ...VILLAGER.startStats }, skills: {}, hotbar: emptyHotbar(), hotbars: {} };
}
/** ตรวจโครงสร้างชุด (เซฟเก่า/ข้อมูลเสีย) */
function cleanPreset(p) {
  if (!p || typeof p !== 'object') return null;
  const eq = {};
  for (const s of PRESET_SLOTS) { const id = p.eq?.[s]; eq[s] = typeof id === 'string' && ITEMS[id]?.type === SLOT_TYPE[s] ? id : null; }
  const stats = {};
  for (const k of STAT_KEYS) stats[k] = Math.max(VILLAGER.startStats[k], Math.min(STAT_CAP, Math.floor(+p.stats?.[k] || 0)));
  const skills = {};
  for (const [id, lv] of Object.entries(p.skills || {})) if (SKILL_BY_ID[id] && lv > 0) skills[id] = Math.min(5, Math.floor(+lv) || 0);
  const hb = p.hotbar && typeof p.hotbar === 'object' ? p.hotbar : emptyHotbar();
  const hotbars = p.hotbars && typeof p.hotbars === 'object' ? p.hotbars : {};
  return { eq, stats, skills, hotbar: hb, hotbars };
}
export function ensurePresets(c) {
  if (!Array.isArray(c.presets) || c.presets.length !== PRESET_N) c.presets = [null, null];
  c.pset = c.pset === 1 ? 1 : 0;
  c.presets = c.presets.map((p, i) => (i === c.pset ? null : cleanPreset(p)));
  return c.presets;
}
/** โหลดค่าสถานะ/สกิลของชุด p เข้าตัวละคร (แต้มที่เหลือคำนวณจากเลเวลปัจจุบัน · เกิน = ล้างใหม่) */
export function applyPresetStats(c, p) {
  c.stats = { ...VILLAGER.startStats, ...p.stats };
  c.statPoints = totalStatPts(c) - statSpent(c.stats);
  if (c.statPoints < 0) resetStats(c);
  c.skills = { ...p.skills };
  c.sp = totalSp(c) - spSpent(c.skills);
  if (c.sp < 0) { c.skills = {}; c.sp = totalSp(c); }
  clampSkills(c);
}
/** ความคืบหน้าของชุดที่ไม่ได้ใช้ (ไว้โชว์ใน UI) */
/** จำนวนชิ้นของ id ที่ถูกจองไว้ในชุด A/B ที่ไม่ได้ใช้ (ห้ามขาย/เทรด/ทิ้ง) */
export function presetReserved(c, id) {
  if (!Array.isArray(c?.presets)) return 0;
  let n = 0;
  c.presets.forEach((p, i) => { if (i !== c.pset && p?.eq) for (const s of PRESET_SLOTS) if (p.eq[s] === id) n++; });
  return n;
}
/** ชุดที่จองของชิ้นนี้ไว้ ('A'/'B') หรือ null */
export function presetOf(c, id) {
  if (!Array.isArray(c?.presets)) return null;
  for (let i = 0; i < c.presets.length; i++) { const p = c.presets[i]; if (i !== c.pset && p?.eq && PRESET_SLOTS.some((s) => p.eq[s] === id)) return PRESET_LABEL[i]; }
  return null;
}
export function presetInfo(c, i) {
  ensurePresets(c);
  if (i === c.pset) return { i, active: true, weapon: c.equipment.weapon || null, job: c.appearance?.job, statPoints: c.statPoints, sp: c.sp };
  const p = c.presets[i];
  if (!p) return { i, active: false, empty: true, weapon: null, job: null, statPoints: totalStatPts(c), sp: totalSp(c) };
  const w = p.eq.weapon ? ITEMS[p.eq.weapon] : null;
  return { i, active: false, weapon: p.eq.weapon, job: w ? WTYPE_JOB[w.wtype] || null : 'boxer', statPoints: totalStatPts(c) - statSpent(p.stats), sp: totalSp(c) - spSpent(p.skills) };
}

export function resetStats(c) {
  c.stats = { ...VILLAGER.startStats };
  c.statPoints = totalStatPts(c);
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
  for (const k of STAT_KEYS) c.stats[k] = Number.isFinite(+c.stats[k]) ? Math.max(STAT_START, Math.min(STAT_CAP, Math.floor(+c.stats[k]))) : VILLAGER.startStats[k];
  for (const k of Object.keys(c.stats)) if (!STAT_KEYS.includes(k)) delete c.stats[k];   // ค่าเก่า (CRI) ที่ไม่มีแล้ว
  // ระบบสเตตัสแบบ RO (6 ค่า · ค่าสูงแพงขึ้น): รีแต้มฟรีครั้งเดียวทั้งชุดที่ใช้อยู่และชุด A/B อีกชุด
  if (!c.statsRO) {
    c.statsRO = true; c.statsRONotice = true;
    resetStats(c);
    if (Array.isArray(c.presets)) for (const p of c.presets) if (p?.stats) p.stats = { ...VILLAGER.startStats };
  }
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
  // ผ้าพันมือ (อาวุธฝึกสายมวย) เคยตกหล่นจากชุดเริ่มต้น → แจกครั้งเดียวให้ตัวที่ยังไม่มีอาวุธสายมวยเลย
  if (!c.starterWrap) {
    c.starterWrap = true;
    if (ITEMS[c.equipment.weapon]?.wtype !== 'wraps' && !c.inventory.some((s) => ITEMS[s?.id]?.wtype === 'wraps')) c.inventory.push({ id: 'hand_wrap', qty: 1 });
  }
  // ระบบชุดแต่งตัวเอาออกจากเกมแล้ว → คืนเงินครั้งเดียว (ชุดในกระเป๋า + ที่สวมอยู่) · ต้องทำก่อนกรองไอเทมที่ไม่มีในเกม
  if (!c.cosRefund) {
    let gold = 0, n = 0;
    const take = (id, q = 1) => { const v = COSTUME_REFUND[id]; if (!v || !(q > 0)) return false; gold += v * q; n += q; return true; };
    c.inventory = c.inventory.filter((s) => !(s && take(s.id, Math.floor(+s.qty || 0))));
    for (const id of Object.values(c.costume && typeof c.costume === 'object' ? c.costume : {})) if (typeof id === 'string') take(id);
    if (Array.isArray(c.buyback)) c.buyback = c.buyback.filter((b) => !COSTUME_REFUND[b?.id]);
    c.gold = (Number.isFinite(+c.gold) ? +c.gold : 0) + gold;
    c.cosRefund = { gold, n, told: !n };
  }
  delete c.costume;
  c.inventory = c.inventory.filter((s) => s && ITEMS[s.id] && s.qty > 0).map((s) => ({ id: s.id, qty: Math.floor(s.qty) }));
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
  // SP สูตรใหม่ (หลัง Lv.60 ได้ทุก 2 เลเวล): ครั้งเดียว · ใช้เกินที่มี = รีสกิลฟรี (ชุด A/B อีกชุดด้วย) · ไม่เกิน = คำนวณแต้มเหลือใหม่
  if (!c.spV2) {
    c.spV2 = true;
    const spent = Object.values(c.skills).reduce((a, b) => a + (b | 0), 0);
    if (spent > totalSp(c)) {
      c.skills = {}; c.sp = totalSp(c); c.spNotice = true;
      c.hotbar = fixHotbar(c, c.hotbar);
      if (c.hotbars && typeof c.hotbars === 'object') for (const j of Object.keys(c.hotbars)) c.hotbars[j] = fixHotbar(c, c.hotbars[j]);
    } else c.sp = totalSp(c) - spent;
    if (Array.isArray(c.presets)) for (const p of c.presets) if (p?.skills && Object.values(p.skills).reduce((a, b) => a + (b | 0), 0) > totalSp(c)) { p.skills = {}; c.spNotice = true; }
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
  ensurePresets(c);
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
