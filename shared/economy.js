// ============================================================
//  Economy – ทุกอย่างที่เปลี่ยน "ของ/เงิน/ตีบวก/เควส/เลเวล" ของตัวละคร (ใช้ร่วม client/server)
//  ▸ ออนไลน์: client ส่งแค่ "คำสั่ง" (econ) → server รันฟังก์ชันเดียวกันนี้กับเซฟจริงของผู้เล่น
//    แล้วส่งสถานะใหม่กลับ → แก้ค่าในเครื่องตัวเองไม่มีผล (กันโกงเงิน/ของ/ตีบวก)
//  ▸ ออฟไลน์: client รันเองในเครื่อง
//  ทุก action คืน { ok, msg, ...ข้อมูลสำหรับเอฟเฟกต์ }
// ============================================================
import { ITEMS, SHOPS, sellPrice } from './data/items.js';
import { OFFERINGS, SIAMSI, todayKey, endOfToday } from './data/blessings.js';
import { JOBS } from './data/classes.js';
import { MONSTERS } from './data/monsters.js';
import { WORLD } from './constants.js';
import { MAPS, mapAt } from './data/maps.js';
import { rollFish, RECIPES, BREWS, ENHANCE, QUESTS, QUEST_BY_ID, HERB_RESPAWN_MS, rollChest, dailyBounties } from './data/village.js';
import { FORGE } from './data/crafting.js';
import { NPCS, SHOP_NPC, FISH_SPOT, CAMP, HERB_NODES, nearNpc, nearSpot } from './data/npcs.js';
import { TITLE_BY_ID, checkTitles } from './data/titles.js';
import { getDerived, EQUIP_SLOTS, SLOT_TYPE } from './character.js';
import { OUTFITS, HAIRSTYLES } from './data/appearance.js';
import { STAT_KEYS, expToNext, MAX_LEVEL } from './stats.js';
import { SKILL_BY_ID } from './data/skills.js';
import { gainExp, choosePath, resetStats, resetSkills, syncAppearance, learnSkill, assignHotbar, allocateStat } from './charmodel.js';

const OK = (msg, extra = {}) => ({ ok: true, msg, ...extra });
const NO = (msg) => ({ ok: false, msg });
const int = (v, lo, hi, d = lo) => (Number.isFinite(+v) ? Math.max(lo, Math.min(hi, Math.floor(+v))) : d);
export const MAX_ACTIVE_QUESTS = 3;
export const DYE_PRICE = 300;

// ------------------------------------------------------------
//  กระเป๋า
// ------------------------------------------------------------
export const count = (c, id) => c.inventory.find((s) => s.id === id)?.qty || 0;
export function addItem(c, id, qty = 1) {
  if (!ITEMS[id] || !(qty > 0)) return;
  const slot = c.inventory.find((s) => s.id === id);
  if (slot) slot.qty += qty; else c.inventory.push({ id, qty });
}
export function removeItem(c, id, qty = 1) {
  const slot = c.inventory.find((s) => s.id === id);
  if (!slot || slot.qty < qty || !(qty > 0)) return false;
  slot.qty -= qty;
  if (slot.qty === 0) c.inventory = c.inventory.filter((s) => s !== slot);
  return true;
}
export const isLocked = (c, id) => !!c.locked?.includes(id);
export function bulkSellList(c, kind = 'drop') {
  return c.inventory.filter((s) => {
    const it = ITEMS[s.id];
    if (!it || isLocked(c, s.id) || !sellPrice(s.id)) return false;
    return kind === 'fish' ? it.type === 'fish' : it.type === 'material' && !it.price;
  });
}
const rec = (c, k, n = 1) => { c.rec ||= {}; c.rec[k] = (c.rec[k] || 0) + n; };
const clampHp = (c) => { const d = getDerived(c); c.hp = Math.min(c.hp, d.maxHp); c.mp = Math.min(c.mp, d.maxMp); };

// ------------------------------------------------------------
//  เควส / ค่าหัว (เรียกจากรางวัลฆ่าผี · ตกปลา · เก็บสมุนไพร)
// ------------------------------------------------------------
/** นับความคืบหน้าเควส → คืนรายการเควสที่เพิ่งครบ */
export function questEvent(c, type, id) {
  const Q = (c.quests ||= { active: {}, done: [] }), done = [];
  for (const qid of Object.keys(Q.active)) {
    const q = QUEST_BY_ID[qid], g = q?.goal;
    if (!g || Q.active[qid] >= g.n) continue;
    const match = type === 'kill' ? g.kill && (g.kill === 'any' || g.kill === id || (g.kill === 'grave' && MONSTERS[id]?.zone?.[0] >= WORLD.graveX))
      : type === 'herb' ? g.herb && (g.herb === 'any' || g.herb === id)
      : type === 'fish' ? g.fish && (g.fish === 'any' ? id !== 'junk_boot' : g.fish === id) : false;
    if (!match) continue;
    Q.active[qid]++;
    if (Q.active[qid] >= g.n) done.push(qid);
  }
  return done;
}
export function bountyList(c, day = todayKey()) {
  if (c.bounty?.day !== day) c.bounty = { day, list: dailyBounties(c.level, day, c.name, MONSTERS) };
  return c.bounty.list;
}
/** นับค่าหัวรายวัน → คืน id ผีที่เพิ่งครบ */
export function bountyKill(c, monId, day = todayKey()) {
  const list = c.bounty?.day === day ? c.bounty.list : null;
  if (!list) return null;
  let done = null;
  for (const b of list) if (b.mon === monId && !b.claimed && b.prog < b.n) { b.prog++; if (b.prog === b.n) done = monId; }
  return done;
}
export const questState = (c, q) => {
  const Q = c.quests;
  if (Q.done.includes(q.id)) return 'done';
  if (q.id in Q.active) return Q.active[q.id] >= q.goal.n ? 'ready' : 'active';
  return c.level >= q.lv ? 'open' : 'locked';
};

// ------------------------------------------------------------
//  รางวัลจากระบบ (server เรียกเอง – client เรียกไม่ได้)
// ------------------------------------------------------------
/** ฆ่าผี: { mon, exp, gold, items } → { ups, quests, bounty, titles } */
export function grantKill(c, r, day) {
  if (r.gold) c.gold += r.gold;
  for (const it of r.items || []) addItem(c, it.id, it.qty || 1);
  const ups = gainExp(c, r.exp || 0);
  rec(c, 'kills');
  const quests = questEvent(c, 'kill', r.mon), bounty = bountyKill(c, r.mon, day);
  return { ups, quests, bounty, titles: checkTitles(c) };
}
/** รางวัลทั่วไป (เรด/ดันเจี้ยน/บอสภาค/ปาร์ตี้) */
export function grant(c, { exp = 0, gold = 0, items = [] } = {}) {
  if (gold) c.gold += gold;
  for (const it of items) addItem(c, it.id, it.qty || 1);
  const ups = gainExp(c, exp);
  return { ups, titles: checkTitles(c) };
}

// ------------------------------------------------------------
//  สวมใส่ / ใช้ไอเทม
// ------------------------------------------------------------
function equip(c, { id, slot: forceSlot = null }) {
  const it = ITEMS[id];
  if (!it || !count(c, id)) return NO('ไม่มีไอเทมนี้');
  if (!['weapon', 'armor', 'accessory'].includes(it.type)) return NO('สวมไอเทมนี้ไม่ได้');
  if (it.lv && c.level < it.lv) return NO(`ต้อง Lv.${it.lv} ขึ้นไปถึงจะสวม ${it.nameTh} ได้`);
  let slot = forceSlot && SLOT_TYPE[forceSlot] === it.type ? forceSlot : it.type;
  if (!forceSlot && it.type === 'accessory' && c.equipment.accessory && !c.equipment.accessory2) slot = 'accessory2';
  removeItem(c, id);
  if (c.equipment[slot]) addItem(c, c.equipment[slot]);
  c.equipment[slot] = id;
  const changed = syncAppearance(c);
  clampHp(c);
  const style = it.wtype ? ` · แนว${JOBS[c.appearance.job].nameTh}` : '';
  return OK(`สวมใส่ ${it.nameTh}${style}`, { jobChanged: changed });
}
function unequip(c, { slot }) {
  if (!EQUIP_SLOTS.includes(slot)) return NO('ช่องไม่ถูกต้อง');
  const id = c.equipment[slot];
  if (!id) return NO('');
  c.equipment[slot] = null;
  addItem(c, id);
  const changed = syncAppearance(c);
  clampHp(c);
  return OK(`ถอด ${ITEMS[id].nameTh}${slot === 'weapon' ? ' · มือเปล่า (แนวมวย)' : ''}`, { jobChanged: changed });
}
function wearCostume(c, id) {
  const it = ITEMS[id];
  c.costume ||= {};
  removeItem(c, id);
  if (c.costume[it.slot]) addItem(c, c.costume[it.slot]);
  c.costume[it.slot] = id;
  syncAppearance(c);
  return OK(`แต่งตัว: ${it.nameTh}`, { jobChanged: true });
}
function cosOff(c, { slot }) {
  const id = c.costume?.[slot];
  if (!id) return NO('');
  c.costume[slot] = null;
  addItem(c, id);
  syncAppearance(c);
  return OK(`ถอด ${ITEMS[id].nameTh}`, { jobChanged: true });
}

function use(c, { id }) {
  const it = ITEMS[id];
  if (!it || !count(c, id)) return NO('ไม่มีไอเทมนี้');
  const d = getDerived(c);
  if (it.type === 'consumable') {
    if (it.effect.hp && c.hp >= d.maxHp && !it.effect.mp) return NO('HP เต็มอยู่แล้ว');
    if (it.effect.hp && c.hp >= d.maxHp && c.mp >= d.maxMp) return NO('HP/MP เต็มอยู่แล้ว');
    if (it.effect.mp && !it.effect.hp && c.mp >= d.maxMp) return NO('MP เต็มอยู่แล้ว');
    const hp0 = c.hp;
    if (it.effect.hp) c.hp = Math.min(d.maxHp, c.hp + it.effect.hp);
    if (it.effect.mp) c.mp = Math.min(d.maxMp, c.mp + it.effect.mp);
    removeItem(c, id);
    return OK(`ใช้ ${it.nameTh}`, { potion: true, healed: Math.round(c.hp - hp0) });
  }
  if (it.type === 'skin') {
    if (!c.path) return NO('ยังไม่มีสายหลัก — ถึง Lv.10 แล้วไปหาผู้ใหญ่ชัยเพื่อเลือกสายฟรี');
    const r = choosePath(c, it.job);
    if (!r.ok) return r;
    removeItem(c, id);
    clampHp(c);
    return OK(`${r.msg} กด K เพื่อเรียนสกิลใหม่`, { jobChanged: true });
  }
  if (it.type === 'reset') {
    removeItem(c, id);
    resetStats(c); resetSkills(c);
    clampHp(c);
    return OK(`ล้างแต้มแล้ว! ได้แต้มสถานะ ${c.statPoints} และ SP ${c.sp} (กด C / K เพื่อลงใหม่)`);
  }
  if (it.type === 'food') {
    if (it.effect.hp) c.hp = Math.min(d.maxHp, c.hp + it.effect.hp);
    if (it.effect.mp) c.mp = Math.min(d.maxMp, c.mp + it.effect.mp);
    removeItem(c, id);
    const now = Date.now(), bid = it.buff.id || 'food';
    c.blessings = (c.blessings || []).filter((b) => b.until > now && b.id !== bid);
    c.blessings.push({ id: bid, nameTh: it.nameTh, icon: it.icon, until: now + it.buff.minutes * 60000, mods: it.buff.mods });
    return OK(`กิน${it.nameTh} อร่อย! ${it.buff.textTh} (${it.buff.minutes} นาที)`, { ate: true });
  }
  if (it.type === 'costume') return wearCostume(c, id);
  if (it.type === 'home') return { ok: true, home: true };
  if (it.type === 'herb') return NO(`${it.nameTh}: ให้ยายติ๋มปรุงยา หรือป้าสาทำอาหาร`);
  if (it.type === 'fish') return NO(`${it.nameTh}: นำไปให้ป้าสาทำอาหาร หรือขายได้`);
  if (it.type === 'offering') return NO(`${it.nameTh}: นำไปถวายที่ศาลพระภูมิ (ยืนหน้าศาลแล้วกด F)`);
  if (['weapon', 'armor', 'accessory'].includes(it.type)) return equip(c, { id });
  return NO('ใช้ไอเทมนี้ไม่ได้');
}

// ------------------------------------------------------------
//  ร้านค้า
// ------------------------------------------------------------
function buy(c, { shop, id, qty = 1 }, ctx) {
  const S = SHOPS[shop], it = ITEMS[id];
  if (!S || !it?.price || !S.stock.includes(id)) return NO('ร้านไม่ขายของนี้');
  if (ctx.x != null && !nearNpc(ctx.x, SHOP_NPC[shop])) return NO('ต้องยืนคุยกับเจ้าของร้านก่อน');
  qty = it.type === 'skin' ? 1 : int(qty, 1, 9999, 1);
  if (it.type === 'skin' && count(c, id)) return NO('มีคัมภีร์นี้แล้ว');
  const cost = it.price * qty;
  if (c.gold < cost) return NO('เงินไม่พอ');
  c.gold -= cost;
  addItem(c, id, qty);
  return OK(`ซื้อ ${it.nameTh}${qty > 1 ? ` x${qty}` : ''} (-฿${cost.toLocaleString()})`);
}
const nearAnyShop = (x) => Object.values(SHOP_NPC).some((n) => nearNpc(x, n));
function sell(c, { id, qty = 1 }, ctx) {
  const it = ITEMS[id];
  if (!it) return NO('ไม่มีไอเทมนี้');
  if (ctx.x != null && !nearAnyShop(ctx.x)) return NO('ต้องขายที่ร้านในหมู่บ้าน');
  if (isLocked(c, id)) return NO('ไอเทมนี้ถูกล็อกไว้ (ปลดล็อกในกระเป๋า)');
  if (it.type === 'skin') return NO('ขายคัมภีร์ไม่ได้');
  qty = Math.min(int(qty, 1, 9999, 1), count(c, id));
  if (qty <= 0 || !removeItem(c, id, qty)) return NO('ไม่มีของพอขาย');
  const gain = sellPrice(id) * qty;
  c.gold += gain;
  return OK(`ขาย ${it.nameTh}${qty > 1 ? ` x${qty}` : ''} (+฿${gain.toLocaleString()})`);
}
function sellMany(c, { kind }, ctx) {
  if (ctx.x != null && !nearAnyShop(ctx.x)) return NO('ต้องขายที่ร้านในหมู่บ้าน');
  let gold = 0, n = 0;
  for (const s of bulkSellList(c, kind === 'fish' ? 'fish' : 'drop').map((x) => ({ ...x }))) {
    if (!removeItem(c, s.id, s.qty)) continue;
    gold += sellPrice(s.id) * s.qty; n += s.qty;
  }
  c.gold += gold;
  return n ? OK(`ขาย ${n} ชิ้น (+฿${gold.toLocaleString()})`, { gold }) : NO('ไม่มีของให้ขาย');
}
function lock(c, { id }) {
  if (!ITEMS[id]) return NO('');
  c.locked ||= [];
  if (isLocked(c, id)) c.locked = c.locked.filter((x) => x !== id); else c.locked.push(id);
  return OK('', { locked: isLocked(c, id) });
}

// ------------------------------------------------------------
//  ศาลพระภูมิ / เซียมซี
// ------------------------------------------------------------
function offer(c, { key }, ctx) {
  const o = OFFERINGS[key];
  if (ctx.x != null && !nearSpot(ctx.x, 'shrine')) return NO('ต้องยืนหน้าศาลพระภูมิ');
  if (!o || !count(c, o.item)) return NO(`ไม่มี${o?.nameTh ?? 'ของถวาย'} (ซื้อได้ที่ร้านยายติ๋ม)`);
  removeItem(c, o.item);
  const now = ctx.now;
  c.blessings = (c.blessings || []).filter((b) => b.until > now);
  const ex = c.blessings.find((b) => b.id === `offer_${key}`);
  if (ex) ex.until = Math.min(now + 60 * 60000, ex.until + o.minutes * 60000);
  else c.blessings.push({ id: `offer_${key}`, nameTh: `พรศาลพระภูมิ (${o.nameTh})`, icon: o.icon, until: now + o.minutes * 60000, mods: o.mods });
  return OK(`ถวาย${o.nameTh} ได้รับพร: ${o.blessTh} (${o.minutes} นาที)`);
}
function siamsi(c, a, ctx) {
  if (ctx.x != null && !nearSpot(ctx.x, 'temple')) return NO('ต้องอยู่ที่วัดบางผี');
  const day = todayKey(ctx.now);
  if (c.siamsi?.day === day) return NO('วันนี้เสี่ยงไปแล้ว กลับมาใหม่พรุ่งนี้นะ');
  const card = SIAMSI[Math.floor(ctx.rnd() * SIAMSI.length)];
  c.siamsi = { day, no: card.no };
  c.blessings = (c.blessings || []).filter((b) => b.id !== 'siamsi');
  c.blessings.push({ id: 'siamsi', nameTh: `เซียมซีใบที่ ${card.no} (${card.luck})`, icon: card.luck === 'ร้าย' ? '📜' : '🎋', until: endOfToday(ctx.now), mods: card.mods });
  return OK('', { card: card.no });
}

// ------------------------------------------------------------
//  ทำอาหาร / ปรุงยา / หลอมอุปกรณ์
// ------------------------------------------------------------
const CRAFT = { cook: { list: RECIPES, npc: 'cook', who: 'ป้าสา' }, brew: { list: BREWS, npc: 'shop', who: 'ยายติ๋ม' }, forge: { list: FORGE, npc: 'smith', who: 'ลุงดำ' } };
export const craftList = (k) => CRAFT[k]?.list || [];
export const canCraft = (c, r) => Object.entries(r.need).every(([id, n]) => count(c, id) >= n) && c.gold >= r.fee;
function craft(c, { list, idx, n = 1 }, ctx) {
  const L = CRAFT[list], r = L?.list[int(idx, 0, 999, -1)];
  if (!r) return NO('ไม่มีสูตรนี้');
  if (ctx.x != null && !nearNpc(ctx.x, L.npc)) return NO(`ต้องยืนคุยกับ${L.who}ก่อน`);
  n = int(n, 1, 99, 1);
  let done = 0;
  while (done < n && canCraft(c, r)) {
    Object.entries(r.need).forEach(([id, k]) => removeItem(c, id, k));
    c.gold -= r.fee;
    addItem(c, r.out);
    done++;
  }
  if (!done) return NO(Object.entries(r.need).every(([id, k]) => count(c, id) >= k) ? 'เงินไม่พอจ่ายค่าแรง' : 'วัตถุดิบไม่พอ');
  rec(c, 'craft', done);
  const it = ITEMS[r.out];
  return OK(`${L.who}${list === 'forge' ? 'หลอม' : 'ทำ'} ${it.icon} ${it.nameTh}${done > 1 ? ` x${done}` : ''} ให้แล้ว!`, { done, out: r.out, forged: list === 'forge' && !r.util });
}

// ------------------------------------------------------------
//  ตีบวก (ลุงดำ)
// ------------------------------------------------------------
function enhance(c, { slot, guard }, ctx) {
  if (!EQUIP_SLOTS.includes(slot)) return NO('ช่องไม่ถูกต้อง');
  if (ctx.x != null && !nearNpc(ctx.x, 'smith')) return NO('ต้องยืนคุยกับลุงดำก่อน');
  c.enhance ||= {};
  const lv = c.enhance[slot] || 0, cost = ENHANCE.cost(lv), ore = ENHANCE.ore(lv), fang = ENHANCE.fang(lv);
  if (!c.equipment[slot]) return NO('ยังไม่ได้สวมอุปกรณ์ช่องนี้');
  if (lv >= ENHANCE.max) return NO('ตีบวกสูงสุดแล้ว');
  if (c.gold < cost) return NO('เงินไม่พอ');
  if (count(c, 'black_iron') < ore) return NO('แร่เหล็กไหลไม่พอ');
  if (count(c, 'yak_fang') < fang) return NO('เขี้ยวพญายักษ์ไม่พอ');
  const useGuard = !!guard && lv >= 10 && count(c, 'yant_guard') > 0;
  c.gold -= cost;
  if (ore) removeItem(c, 'black_iron', ore);
  if (fang) removeItem(c, 'yak_fang', fang);
  if (useGuard) removeItem(c, 'yant_guard', 1);
  const success = ctx.rnd() < ENHANCE.rate(lv);
  let drop = 0;
  if (success) c.enhance[slot] = lv + 1;
  else { drop = useGuard ? 0 : ENHANCE.drop(lv, ctx.rnd); c.enhance[slot] = Math.max(0, lv - drop); }
  c.rec ||= {};
  c.rec.enhMax = Math.max(c.rec.enhMax || 0, c.enhance[slot]);
  const jobChanged = syncAppearance(c);
  clampHp(c);
  return { ok: success, success, slot, from: lv, lv: c.enhance[slot], drop, guard: useGuard, jobChanged, msg: '' };
}

// ------------------------------------------------------------
//  เควส / เลือกสาย / ค่าหัว
// ------------------------------------------------------------
function qAccept(c, { id }) {
  const q = QUEST_BY_ID[id], Q = c.quests;
  if (!q || questState(c, q) !== 'open') return NO('รับเควสนี้ไม่ได้');
  if (Object.keys(Q.active).length >= MAX_ACTIVE_QUESTS) return NO(`รับเควสได้พร้อมกัน ${MAX_ACTIVE_QUESTS} เควส`);
  Q.active[id] = 0;
  return OK(`รับเควส: ${q.nameTh}`);
}
function qDrop(c, { id }) {
  if (!(id in (c.quests?.active || {}))) return NO('');
  delete c.quests.active[id];
  return OK('');
}
function qClaim(c, { id }, ctx) {
  const q = QUEST_BY_ID[id], Q = c.quests;
  if (!q || questState(c, q) !== 'ready') return NO('เควสยังไม่สำเร็จ');
  if (ctx.x != null && !nearSpot(ctx.x, 'chai')) return NO('กลับไปรับรางวัลกับผู้ใหญ่ชัยที่หมู่บ้าน');
  delete Q.active[id];
  Q.done.push(id);
  c.gold += q.reward.gold;
  (q.reward.items || []).forEach((it) => addItem(c, it.id, it.qty));
  const ups = gainExp(c, q.reward.exp);
  return OK(`✔ เควสสำเร็จ: ${q.nameTh}`, { quest: id, exp: q.reward.exp, ups });
}
function path(c, { job }, ctx) {
  if (ctx.x != null && !nearSpot(ctx.x, 'chai')) return NO('ต้องยืนคุยกับผู้ใหญ่ชัยที่หมู่บ้านก่อน');
  if (c.path) return NO('เลือกสายหลักไปแล้ว (เปลี่ยนได้ด้วยคัมภีร์เปลี่ยนสายหลัก)');
  const r = choosePath(c, job);
  if (!r.ok) return r;
  addItem(c, `armor_${job}`);
  return OK(r.msg, { jobChanged: true, pathChosen: job });
}
function bounty(c, { i }, ctx) {
  if (ctx.x != null && !(mapAt(ctx.x).id === 'm1' && Math.abs(ctx.x - CAMP.npcX) < 160)) return NO('ต้องกลับไปหาพรานบุญที่ค่าย (แมพ 1)');
  const b = bountyList(c, todayKey(ctx.now))[int(i, 0, 9, -1)];
  if (!b || b.claimed || b.prog < b.n) return NO('ยังล่าไม่ครบ');
  b.claimed = true;
  c.gold += b.gold;
  const ups = gainExp(c, b.exp);
  return OK(`ได้รับค่าหัว ${MONSTERS[b.mon].nameTh}: ${b.exp} EXP · ฿${b.gold}`, { exp: b.exp, ups });
}

// ------------------------------------------------------------
//  ตกปลา / เก็บสมุนไพร / หีบสมบัติ (server สุ่มเอง จำกัดความถี่)
// ------------------------------------------------------------
const atFish = (x) => mapAt(x).id === 'village' && x >= FISH_SPOT.from - 20 && x <= FISH_SPOT.to + 20;
function fishBite(c, a, ctx) {
  const S = ctx.sess;
  if (ctx.x != null && !atFish(ctx.x)) return NO('ต้องยืนที่ท่าน้ำ');
  if (ctx.now - (S.fishAt || 0) < 2000) return NO('ปลายังไม่กินเบ็ด');
  S.fishAt = ctx.now;
  const f = rollFish(ctx.night, ctx.rnd);
  S.fish = { id: f.id, at: ctx.now };
  return OK('', { fish: f.id, hard: f.hard });
}
function fishLand(c, a, ctx) {
  const S = ctx.sess, f = S.fish;
  S.fish = null;
  if (!f || ctx.now - f.at < 250 || ctx.now - f.at > 60000) return NO('ปลาหลุดเบ็ดไปแล้ว…');
  addItem(c, f.id);
  if (f.id !== 'junk_boot') rec(c, 'fish');
  if (f.id === 'pla_buek') rec(c, 'buek');
  const quests = questEvent(c, 'fish', f.id);
  return OK('', { id: f.id, quests });
}
function fishLose(c, a, ctx) { ctx.sess.fish = null; return OK(''); }
function gather(c, { node }, ctx) {
  const S = ctx.sess, n = HERB_NODES[int(node, 0, 999, -1)];
  if (!n) return NO('');
  if (ctx.x != null && (mapAt(ctx.x).id !== n.mapId || Math.abs(ctx.x - n.x) > 45)) return NO('อยู่ไกลเกินไป');
  S.herb ||= {};
  if ((S.herb[node] || 0) > ctx.now) return NO('สมุนไพรยังไม่งอกใหม่');
  if (ctx.now - (S.gatherAt || 0) < 1100) return NO('');
  S.gatherAt = ctx.now;
  S.herb[node] = ctx.now + HERB_RESPAWN_MS;
  const qty = ctx.rnd() < 0.25 ? 2 : 1;
  addItem(c, n.item, qty);
  rec(c, 'herb');
  const quests = questEvent(c, 'herb', n.item);
  return OK('', { item: n.item, qty, quests });
}
function chest(c, a, ctx) {
  const S = ctx.sess;
  if (ctx.x != null && !mapAt(ctx.x).mon) return NO('');
  const last = S.chestAt ?? ((S.joinAt || 0) - 105000);           // เข้าเกม 15 วิแรกยังไม่มีหีบ
  if (ctx.now - last < 120000) return NO('หีบนี้ว่างเปล่า…');
  S.chestAt = ctx.now;
  const r = rollChest(c.level, ctx.rnd);
  c.gold += r.gold;
  r.items.forEach((it) => addItem(c, it.id, it.qty));
  return OK('', { gold: r.gold, items: r.items });
}

// ------------------------------------------------------------
//  สถานะ / สกิล / Hotbar
// ------------------------------------------------------------
function alloc(c, { add = {} }) {
  const plan = STAT_KEYS.map((k) => [k, int(add[k], 0, 999, 0)]);
  const total = plan.reduce((a, [, n]) => a + n, 0);
  if (!total || total > c.statPoints) return NO('แต้มสถานะไม่พอ');
  for (const [k, n] of plan) for (let i = 0; i < n; i++) allocateStat(c, k);
  clampHp(c);
  return OK(`ลงแต้มสถานะแล้ว ${total} แต้ม`);
}
function learn(c, { id, max }) {
  if (!SKILL_BY_ID[id]) return NO('ไม่มีสกิลนี้');
  let n = 0, r;
  while ((r = learnSkill(c, id)).ok) { n++; if (!max) break; }
  if (!n) return NO(r.msg);
  return OK(max ? `${SKILL_BY_ID[id].nameTh} +${n} เลเวล (Lv.${c.skills[id]})` : r.msg, { n });
}
function hotbar(c, { key, id }) {
  return assignHotbar(c, key, id || null) ? OK('') : NO('ต้องเรียนสกิลก่อนจึงติดตั้งได้');
}

// ------------------------------------------------------------
//  ยันต์คืนถิ่น (ไป-กลับ) · ย้อมสี · ฉายา · GM
// ------------------------------------------------------------
function recall(c, { to }) {
  if (!count(c, 'yant_home')) return NO('ไม่มียันต์คืนถิ่น (ซื้อได้ที่ร้านยายติ๋ม ฿40)');
  if (to === 'hunt') {
    const m = MAPS[c.lastHunt];
    if (!m || !m.mon && !m.boss) return NO('ยังไม่มีจุดล่าล่าสุด');
    if (c.level < (m.minLv || 1)) return NO(`ต้อง Lv.${m.minLv}`);
    removeItem(c, 'yant_home', 1);
    return OK(`กลับไปจุดล่า: ${m.nameTh}`, { warp: 'return', to: m.id });
  }
  removeItem(c, 'yant_home', 1);
  return OK('', { warp: 'home' });
}
function dye(c, { part, v }, ctx) {
  const N = { hair: HAIRSTYLES.length, outfit: OUTFITS.length }[part];
  if (!N) return NO('');
  v = int(v, 0, N - 1, -1);
  if (v < 0) return NO('');
  if (ctx.x != null && !nearNpc(ctx.x, 'tailor')) return NO('ต้องยืนคุยกับแม่ช้อยก่อน');
  if (c.appearance[part] === v) return NO('เป็นสีนี้อยู่แล้ว');
  if (c.gold < DYE_PRICE) return NO('เงินไม่พอ');
  c.gold -= DYE_PRICE;
  c.appearance = { ...c.appearance, [part]: v };
  syncAppearance(c);
  return OK(`ย้อม${part === 'hair' ? 'ผม' : 'ชุด'}ใหม่แล้ว! (-฿${DYE_PRICE})`, { jobChanged: true });
}
function title(c, { id }) {
  if (id && !(c.titles || []).includes(id)) return NO('ยังไม่ได้ปลดล็อกฉายานี้');
  c.title = id && TITLE_BY_ID[id] ? id : null;
  syncAppearance(c);
  return OK(id ? `ใช้ฉายา “${TITLE_BY_ID[id].nameTh}”` : 'ซ่อนฉายา', { jobChanged: true });
}
function friendDel(c, { acc }) {
  const before = (c.friends || []).length;
  c.friends = (c.friends || []).filter((f) => f.acc !== acc);
  return c.friends.length < before ? OK('ลบเพื่อนแล้ว') : NO('');
}
function gm(c, { cmd = 'help', a1, a2 }, ctx) {
  if (!ctx.admin) return NO('คำสั่งนี้ใช้ได้เฉพาะแอดมิน');
  const n = (v, d) => Math.max(0, Math.floor(Number(v) || d));
  switch (String(cmd).toLowerCase()) {
    case 'gold': c.gold = Math.min(999999999, c.gold + n(a1, 1000000)); return OK(`เสกเงิน → ฿${c.gold.toLocaleString()}`, { gm: true });
    case 'lv': case 'level': {
      const to = Math.min(MAX_LEVEL, Math.max(c.level, n(a1, MAX_LEVEL)));
      while (c.level < to) gainExp(c, expToNext(c.level) - c.exp);
      return OK(`เลเวล → Lv.${c.level} (แต้มสถานะ ${c.statPoints} · SP ${c.sp})`, { gm: true });
    }
    case 'exp': { const ups = gainExp(c, n(a1, 1000)); return OK(`+EXP ${n(a1, 1000)}`, { gm: true, ups }); }
    case 'item': {
      const id = a1 && ITEMS[a1] ? a1 : Object.keys(ITEMS).find((k) => ITEMS[k].nameTh === a1);
      if (!id) return NO(`ไม่พบไอเทม "${a1}" (ใช้ id เช่น yant_guard, cos_head_naga)`);
      addItem(c, id, Math.min(9999, n(a2, 1))); return OK(`ได้รับ ${ITEMS[id].nameTh} x${Math.min(9999, n(a2, 1))}`, { gm: true });
    }
    case 'sp': c.sp = (c.sp || 0) + n(a1, 10); return OK(`SP → ${c.sp}`, { gm: true });
    case 'stat': c.statPoints = (c.statPoints || 0) + n(a1, 10); return OK(`แต้มสถานะ → ${c.statPoints}`, { gm: true });
    case 'enh': {
      const slot = EQUIP_SLOTS.includes(a1) ? a1 : 'weapon';
      (c.enhance ||= {})[slot] = Math.min(ENHANCE.max, n(a2, ENHANCE.max));
      c.rec ||= {}; c.rec.enhMax = Math.max(c.rec.enhMax || 0, c.enhance[slot]);
      return OK(`ตีบวก ${slot} → +${c.enhance[slot]}`, { gm: true, jobChanged: syncAppearance(c) });
    }
    case 'heal': { const d = getDerived(c); c.hp = d.maxHp; c.mp = d.maxMp; return OK('ฟื้น HP/MP เต็ม', { gm: true }); }
    default: return OK('คำสั่ง: /gm gold [จำนวน] · /gm lv [เลเวล] · /gm exp [จำนวน] · /gm item <id> [จำนวน] · /gm sp [n] · /gm stat [n] · /gm enh <weapon|armor|accessory|accessory2> [ขั้น] · /gm heal', { gm: true });
  }
}

// ------------------------------------------------------------
export const ACTIONS = {
  use, equip, unequip, cosOff, buy, sell, sellMany, lock, offer, siamsi, craft, enhance,
  qAccept, qDrop, qClaim, path, bounty, fishBite, fishLand, fishLose, gather, chest,
  alloc, learn, hotbar, recall, dye, title, friendDel, gm,
};
/** ระหว่างเทรด ห้ามทำสิ่งที่แตะกระเป๋า/เงิน (กันของซ้ำ) */
const TRADE_SAFE = new Set(['lock', 'qAccept', 'qDrop', 'hotbar', 'title', 'friendDel', 'fishBite', 'fishLand', 'fishLose', 'gather', 'chest', 'learn', 'alloc']);

/**
 * รันคำสั่ง: ctx = { rnd, now, x (ตำแหน่งผู้เล่น · null = ไม่ตรวจ), night, admin, trade, sess }
 * คืนผลลัพธ์ + ฉายาใหม่ที่ปลดล็อก (titles)
 */
export function runAction(c, name, args = {}, ctx = {}) {
  const fn = Object.prototype.hasOwnProperty.call(ACTIONS, name) ? ACTIONS[name] : null;
  if (!fn) return NO('คำสั่งไม่ถูกต้อง');
  ctx = { rnd: Math.random, now: Date.now(), x: null, night: false, admin: false, trade: false, sess: {}, ...ctx };
  if (ctx.trade && !TRADE_SAFE.has(name)) return NO('กำลังเทรดอยู่ – ใช้/ขาย/สวมของไม่ได้จนกว่าจะเทรดเสร็จ');
  const r = fn(c, args && typeof args === 'object' ? args : {}, ctx) || NO('');
  const titles = checkTitles(c);
  if (titles.length) r.titles = titles;
  return r;
}

/** ช่องที่ server ส่งกลับให้ client (ทั้งตัวละคร ยกเว้นของที่ client ถือเอง) */
export const CLIENT_OWNED = ['mp'];
export function packChar(c) {
  const o = {};
  for (const [k, v] of Object.entries(c)) if (!CLIENT_OWNED.includes(k) && k[0] !== '_') o[k] = v;
  return o;
}
export { NPCS };
