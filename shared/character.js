// ============================================================
//  คำนวณค่าพลังตัวละครจากข้อมูลเซฟ (ใช้ร่วมกัน client/server)
//  ▸ server ใช้คำนวณดาเมจจริง → client โกงค่าพลังไม่ได้
// ============================================================
import { ENHANCE } from './data/village.js';
import { JOBS, VILLAGER, JOB_IDS } from './data/classes.js';
import { ITEMS } from './data/items.js';
import { computeDerived, STAT_KEYS, MAX_LEVEL, POINTS_PER_LEVEL, clamp } from './stats.js';
import { SKILL_BY_ID, MAX_SKILL_LV, SP_PER_LEVEL, START_SP, skillStats } from './data/skills.js';
import { combineBlessings } from './data/blessings.js';

/** ช่องสวมใส่ (เครื่องประดับ 2 ข้าง) → ชนิดไอเทมที่ใส่ได้ */
export const EQUIP_SLOTS = ['weapon', 'armor', 'accessory', 'accessory2'];
export const SLOT_TYPE = { weapon: 'weapon', armor: 'armor', accessory: 'accessory', accessory2: 'accessory' };

/** รวมโบนัสจากอุปกรณ์ที่สวมใส่ (+ตีบวก) */
export function equipmentBonus(c) {
  const bonus = {};
  const add = (o) => { for (const [k, v] of Object.entries(o || {})) bonus[k] = (bonus[k] || 0) + v; };
  for (const [slot, id] of Object.entries(c.equipment || {})) {
    if (!id) continue;
    add(ITEMS[id]?.bonus);
    const lv = c.enhance?.[slot] || 0;                  // ตีบวกกับลุงดำ (บวกตามช่อง)
    if (lv && ENHANCE.bonus[slot]) add(ENHANCE.bonus[slot](lv));
  }
  return bonus;
}

/** ค่าพลังรวม (สถานะ + อุปกรณ์ + สายหลัก) */
export function getDerived(c) {
  const bonus = equipmentBonus(c);
  for (const [k, v] of Object.entries(JOBS[c.path]?.pathBonus || {})) bonus[k] = (bonus[k] || 0) + v;   // โบนัสสายหลัก
  return computeDerived(c.stats, VILLAGER, c.level, bonus);
}

/** ค่าพลังตอนต่อสู้ = ค่าพลังรวม × พร (เซียมซี/ศาลพระภูมิ) × บัฟสกิล [{ buff, until }] */
export function combatDerived(c, buffs = [], now = Date.now()) {
  const d = { ...getDerived(c) };
  const bl = combineBlessings(c.blessings || [], now);
  if (bl.atkMul) { d.patk = Math.round(d.patk * (1 + bl.atkMul)); d.matk = Math.round(d.matk * (1 + bl.atkMul)); }
  d.def = Math.max(0, d.def + bl.def);
  d.critRate = Math.min(0.9, d.critRate + bl.critAdd);
  for (const { buff, until } of buffs) {
    if (!buff || !(until > now)) continue;
    if (buff.atkMul) { d.patk = Math.round(d.patk * (1 + buff.atkMul)); d.matk = Math.round(d.matk * (1 + buff.atkMul)); }
    if (buff.critAdd) d.critRate = Math.min(0.9, d.critRate + buff.critAdd);
    if (buff.def) d.def += buff.def;
  }
  return d;
}

// ------------------------------------------------------------
//  ข้อมูลตัวละครที่ client ส่งให้ server (เฉพาะส่วนที่ใช้คำนวณ) + การตรวจสอบ
// ------------------------------------------------------------
const BLESS_CAP = { atkMul: 0.6, def: 25, critAdd: 0.15, expMul: 2.2, goldMul: 2.5, dropMul: 3.5 };   // เพดานรวม (เซียมซี + ของถวาย 4 อย่าง + อาหาร + ยาอายุวัฒนะ) กันค่าปลอม

/** ตัดข้อมูลตัวละครให้เหลือส่วนที่ server ต้องใช้ */
export function charPayload(c, buffs = []) {
  return {
    level: c.level, stats: { ...c.stats }, equipment: { ...c.equipment }, enhance: { ...(c.enhance || {}) }, path: c.path || null,
    // เวลาเหลือ (ms) แทนเวลาหมดอายุ → นาฬิกาเครื่องผู้เล่นเพี้ยนก็ไม่เป็นไร
    skills: { ...(c.skills || {}) }, bonusPoints: c.bonusPoints || 0,
    blessings: (c.blessings || []).filter((b) => b.until > Date.now()).map((b) => ({ id: b.id, left: b.until - Date.now(), mods: b.mods })),
    buffs: buffs.map((b) => ({ sk: b.sk, left: (b.untilMs || 0) - Date.now() })).filter((b) => b.sk && b.left > 0),
  };
}

/** ตรวจ/จำกัดค่าที่ client ส่งมา → โครงสร้างตัวละครที่ปลอดภัย (null = ใช้ไม่ได้) */
export function sanitizeChar(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object') return null;
  const int = (v, lo, hi, d = lo) => (Number.isFinite(+v) ? clamp(Math.floor(+v), lo, hi) : d);
  const level = int(raw.level, 1, MAX_LEVEL, 1);
  const stats = {};
  for (const k of STAT_KEYS) stats[k] = int(raw.stats?.[k], 0, 999, 5);
  // แต้มสถานะรวมต้องไม่เกินที่เลเวลนี้มีได้ (เริ่มต้น + 5/เลเวล) → ถ้าเกินให้ย่อสัดส่วนลง
  const base = Object.values(VILLAGER.startStats).reduce((a, b) => a + b, 0), maxPts = base + (level - 1) * POINTS_PER_LEVEL + int(raw.bonusPoints, 0, 2, 0);   // +2 จากการแปลงเซฟเก่า
  const total = STAT_KEYS.reduce((a, k) => a + stats[k], 0);
  if (total > maxPts) for (const k of STAT_KEYS) stats[k] = Math.floor(stats[k] * maxPts / total);
  const equipment = {};
  for (const slot of EQUIP_SLOTS) {
    const id = raw.equipment?.[slot], it = typeof id === 'string' ? ITEMS[id] : null;
    equipment[slot] = it && it.type === SLOT_TYPE[slot] && (it.lv || 1) <= level ? id : null;   // เลเวลไม่ถึง = ไม่นับ
  }
  const enhance = {};
  for (const slot of EQUIP_SLOTS) enhance[slot] = int(raw.enhance?.[slot], 0, ENHANCE.max, 0);
  const skills = {};
  for (const [id, lv] of Object.entries(raw.skills || {})) if (SKILL_BY_ID[id]) skills[id] = int(lv, 0, MAX_SKILL_LV, 0);
  // SP รวมต้องไม่เกินที่เลเวลนี้มีได้
  const maxSp = START_SP + (level - 1) * SP_PER_LEVEL, usedSp = Object.values(skills).reduce((a, b) => a + b, 0);
  if (usedSp > maxSp) for (const id of Object.keys(skills)) skills[id] = Math.floor(skills[id] * maxSp / usedSp);
  const seen = new Set();
  const blessings = (Array.isArray(raw.blessings) ? raw.blessings : []).filter((b) => b && !seen.has(b.id) && seen.add(b.id)).slice(0, 10).map((b) => ({
    id: String(b?.id || ''), until: now + int(b?.left, 0, 24 * 3600e3, 0),
    mods: Object.fromEntries(Object.entries(b?.mods || {}).filter(([k]) => k in BLESS_CAP).map(([k, v]) => [k, clamp(+v || 0, k.endsWith('Mul') && k !== 'atkMul' ? 1 : -10, BLESS_CAP[k])])),
  }));
  const buffs = (Array.isArray(raw.buffs) ? raw.buffs : []).slice(0, 6)
    .filter((b) => SKILL_BY_ID[b?.sk]?.buff && skills[b.sk] > 0)
    .map((b) => ({ buff: SKILL_BY_ID[b.sk].buff, until: now + int(b.left, 0, 60e3, 0) }));
  return {
    level, stats, equipment, enhance, skills, blessings, buffs,
    path: JOB_IDS.includes(raw.path) ? raw.path : null,
  };
}

/** รวมพร (มีเพดาน) */
export function blessingsOf(c, now = Date.now()) {
  const r = combineBlessings(c.blessings || [], now);
  for (const k of Object.keys(BLESS_CAP)) r[k] = Math.min(r[k], BLESS_CAP[k]);
  return r;
}

/** ท่าโจมตี: ชนิด/ตัวคูณ/เอฟเฟกต์ จากสกิล (ตามเลเวลที่เรียน) หรือโจมตีปกติของแนวอาวุธ */
export function attackSpec(c, job, skillId = null, combo = false) {
  if (skillId) {
    const base = SKILL_BY_ID[skillId], lv = c.skills?.[skillId] || 0;
    if (!base || lv <= 0 || !base.mult) return null;
    if (job && base.job && base.job !== job) return null;                    // ต้องถืออาวุธแนวเดียวกับสกิล
    const sk = skillStats(base, lv);
    return { kind: sk.kind || 'physical', mult: sk.mult, effect: sk.effect || null, hits: sk.hits || 1 };
  }
  const atk = JOBS[job]?.attack;
  if (!atk) return null;
  return { kind: atk.kind, mult: atk.mult * (combo && atk.comboMult ? atk.comboMult : 1), effect: null, hits: 1 };
}

/** กันโกงฝั่ง server: สกิลต้องไม่ถูกใช้ถี่กว่าคูลดาวน์ · คอมโบนักมวยต้องมีตีปกติคั่น 2 ครั้ง
 *  (ครั้งร่ายเดียวกันตีหลายเป้า/หลายจังหวะได้ภายใน 1.5 วิ) → false = ไม่รับ */
export function attackGate(p, skillId, combo, now = Date.now()) {
  const g = (p._gate ||= { sk: {}, since: 3 });
  if (skillId) {
    const base = SKILL_BY_ID[skillId];
    if (!base) return false;
    const st = (g.sk[skillId] ||= { at: 0, n: 0 });
    if (now - st.at > 1500) {
      const cd = skillStats(base, p.char?.skills?.[skillId] || 1).cd || 0;
      if (st.at && now - st.at < cd * 0.8) return false;
      st.at = now; st.n = 0;
    }
    return ++st.n <= (base.hits || 1) * (base.count || 1) * 8;
  }
  if (combo && g.since >= 2) { g.since = 0; return 'combo'; }              // คอมโบไม่ถึงรอบ → นับเป็นตีปกติ
  g.since++;
  return 'basic';
}
