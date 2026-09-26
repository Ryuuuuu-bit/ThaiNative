// ============================================================
//  Inventory & Shop – กระเป๋า, สวมใส่, ใช้ไอเทม, ซื้อ-ขายกับ NPC
//  ทุกฟังก์ชันคืนค่า { ok, msg } เพื่อให้ UI แสดงผล
// ============================================================
import { OFFERINGS } from '/shared/data/blessings.js';
import { ITEMS, sellPrice } from '/shared/data/items.js';
import { JOBS } from '/shared/data/classes.js';
import { getDerived, resetSkills, resetStats, choosePath, syncAppearance } from './Character.js';

const SLOT_OF = { weapon: 'weapon', armor: 'armor', accessory: 'accessory' };

/** ล็อกกระเป๋าระหว่างเทรด (กันใช้/ขายของที่เสนอไว้ → ของซ้ำ) */
export const tradeLock = { on: false };
const LOCKED = { ok: false, msg: 'กำลังเทรดอยู่ – ใช้/ขาย/สวมของไม่ได้จนกว่าจะเทรดเสร็จ' };

export function count(c, id) {
  return c.inventory.find((s) => s.id === id)?.qty || 0;
}

export function addItem(c, id, qty = 1) {
  const slot = c.inventory.find((s) => s.id === id);
  if (slot) slot.qty += qty; else c.inventory.push({ id, qty });
}

export function removeItem(c, id, qty = 1) {
  if (tradeLock.on) return false;
  const slot = c.inventory.find((s) => s.id === id);
  if (!slot || slot.qty < qty) return false;
  slot.qty -= qty;
  if (slot.qty === 0) c.inventory = c.inventory.filter((s) => s !== slot);
  return true;
}

/** ใช้ยา / เปลี่ยนอาชีพ / สวมใส่ */
export function useItem(c, id) {
  if (tradeLock.on) return LOCKED;
  const it = ITEMS[id];
  if (!it || !count(c, id)) return { ok: false, msg: 'ไม่มีไอเทมนี้' };

  if (it.type === 'consumable') {
    const d = getDerived(c);
    if (it.effect.hp && c.hp >= d.maxHp) return { ok: false, msg: 'HP เต็มอยู่แล้ว' };
    if (it.effect.mp && !it.effect.hp && c.mp >= d.maxMp) return { ok: false, msg: 'MP เต็มอยู่แล้ว' };
    if (it.effect.hp) c.hp = Math.min(d.maxHp, c.hp + it.effect.hp);
    if (it.effect.mp) c.mp = Math.min(d.maxMp, c.mp + it.effect.mp);
    removeItem(c, id);
    return { ok: true, msg: `ใช้ ${it.nameTh}` };
  }

  if (it.type === 'skin') {                  // คัมภีร์เปลี่ยนสายหลัก (ต้องเลือกสายครั้งแรกกับผู้ใหญ่ชัยก่อน)
    if (!c.path) return { ok: false, msg: 'ยังไม่มีสายหลัก — ถึง Lv.10 แล้วไปหาผู้ใหญ่ชัยเพื่อเลือกสายฟรี' };
    const r = choosePath(c, it.job);
    if (!r.ok) return r;
    removeItem(c, id);
    const d = getDerived(c);
    c.hp = Math.min(c.hp, d.maxHp); c.mp = Math.min(c.mp, d.maxMp);
    return { ok: true, msg: `${r.msg} กด K เพื่อเรียนสกิลใหม่`, jobChanged: true };
  }

  if (it.type === 'reset') {                 // น้ำมนต์ล้างแต้ม
    removeItem(c, id);
    resetStats(c); resetSkills(c);
    const d = getDerived(c);
    c.hp = Math.min(c.hp, d.maxHp); c.mp = Math.min(c.mp, d.maxMp);
    return { ok: true, msg: `ล้างแต้มแล้ว! ได้แต้มสถานะ ${c.statPoints} และ SP ${c.sp} (กด C / K เพื่อลงใหม่)` };
  }

  if (it.type === 'food') {                  // อาหารป้าสา: ฟื้นฟู + บัฟ (ได้ทีละจาน กินใหม่ = แทนที่)
    const d = getDerived(c);
    if (it.effect.hp) c.hp = Math.min(d.maxHp, c.hp + it.effect.hp);
    if (it.effect.mp) c.mp = Math.min(d.maxMp, c.mp + it.effect.mp);
    removeItem(c, id);
    const now = Date.now();
    const bid = it.buff.id || 'food';                 // ยาอายุวัฒนะ = บัฟแยกจากอาหาร
    c.blessings = (c.blessings || []).filter((b) => b.until > now && b.id !== bid);
    c.blessings.push({ id: bid, nameTh: it.nameTh, icon: it.icon, until: now + it.buff.minutes * 60000, mods: it.buff.mods });
    return { ok: true, msg: `กิน${it.nameTh} อร่อย! ${it.buff.textTh} (${it.buff.minutes} นาที)`, ate: true };
  }

  if (it.type === 'costume') return wearCostume(c, id);
  if (it.type === 'home') return { ok: true, home: true };                    // ยันต์คืนถิ่น: GameScene.recall() ร่าย แล้วค่อยหักของ

  if (it.type === 'herb') return { ok: false, msg: `${it.nameTh}: ให้ยายติ๋มปรุงยา หรือป้าสาทำอาหาร` };
  if (it.type === 'fish') return { ok: false, msg: `${it.nameTh}: นำไปให้ป้าสาทำอาหาร หรือขายได้` };

  if (it.type === 'offering') return { ok: false, msg: `${it.nameTh}: นำไปถวายที่ศาลพระภูมิ (ยืนหน้าศาลแล้วกด F)` };

  if (SLOT_OF[it.type]) return equip(c, id);
  return { ok: false, msg: 'ใช้ไอเทมนี้ไม่ได้' };
}

/** ถวายของที่ศาลพระภูมิ → ได้พร (ถวายซ้ำชนิดเดิม = ต่อเวลา สูงสุด 60 นาที) */
export function makeOffering(c, key) {
  if (tradeLock.on) return LOCKED;
  const o = OFFERINGS[key];
  if (!o || !count(c, o.item)) return { ok: false, msg: `ไม่มี${o?.nameTh ?? 'ของถวาย'} (ซื้อได้ที่ร้านยายติ๋ม)` };
  removeItem(c, o.item);
  const now = Date.now();
  c.blessings = (c.blessings || []).filter((b) => b.until > now);
  const ex = c.blessings.find((b) => b.id === `offer_${key}`);
  if (ex) ex.until = Math.min(now + 60 * 60000, ex.until + o.minutes * 60000);
  else c.blessings.push({ id: `offer_${key}`, nameTh: `พรศาลพระภูมิ (${o.nameTh})`, icon: o.icon, until: now + o.minutes * 60000, mods: o.mods });
  return { ok: true, msg: `ถวาย${o.nameTh} ได้รับพร: ${o.blessTh} (${o.minutes} นาที)` };
}

export function equip(c, id, forceSlot = null) {
  if (tradeLock.on) return LOCKED;
  const it = ITEMS[id];
  if (it.lv && c.level < it.lv) return { ok: false, msg: `ต้อง Lv.${it.lv} ขึ้นไปถึงจะสวม ${it.nameTh} ได้` };
  let slot = forceSlot || SLOT_OF[it.type];
  if (!forceSlot && it.type === 'accessory' && c.equipment.accessory && !c.equipment.accessory2) slot = 'accessory2';   // ข้างแรกไม่ว่าง → ใส่ข้างที่ 2
  removeItem(c, id);
  if (c.equipment[slot]) addItem(c, c.equipment[slot]);
  c.equipment[slot] = id;
  const changed = syncAppearance(c);
  const d = getDerived(c);
  c.hp = Math.min(c.hp, d.maxHp); c.mp = Math.min(c.mp, d.maxMp);
  const style = it.wtype ? ` · แนว${JOBS[c.appearance.job].nameTh}` : '';
  return { ok: true, msg: `สวมใส่ ${it.nameTh}${style}`, jobChanged: changed };
}

/** สวมชุดแต่งตัว (สลับกับชิ้นเดิมในช่องเดียวกัน) */
export function wearCostume(c, id) {
  if (tradeLock.on) return LOCKED;
  const it = ITEMS[id];
  c.costume = c.costume || {};
  removeItem(c, id);
  if (c.costume[it.slot]) addItem(c, c.costume[it.slot]);
  c.costume[it.slot] = id;
  syncAppearance(c);
  return { ok: true, msg: `แต่งตัว: ${it.nameTh}`, jobChanged: true };
}

export function takeOffCostume(c, slot) {
  if (tradeLock.on) return LOCKED;
  const id = c.costume?.[slot];
  if (!id) return { ok: false };
  c.costume[slot] = null;
  addItem(c, id);
  syncAppearance(c);
  return { ok: true, msg: `ถอด ${ITEMS[id].nameTh}`, jobChanged: true };
}

export function unequip(c, slot) {
  if (tradeLock.on) return LOCKED;
  const id = c.equipment[slot];
  if (!id) return { ok: false };
  c.equipment[slot] = null;
  addItem(c, id);
  const changed = syncAppearance(c);
  const d = getDerived(c);
  c.hp = Math.min(c.hp, d.maxHp); c.mp = Math.min(c.mp, d.maxMp);
  return { ok: true, msg: `ถอด ${ITEMS[id].nameTh}${slot === 'weapon' ? ' · มือเปล่า (แนวมวย)' : ''}`, jobChanged: changed };
}

// ---------------- NPC Shop ----------------
export function buy(c, id, qty = 1) {
  if (tradeLock.on) return LOCKED;
  const it = ITEMS[id];
  if (!it?.price) return { ok: false, msg: 'ร้านไม่ขายของนี้' };
  if (it.type === 'skin') qty = 1;
  qty = Math.max(1, Math.floor(qty));
  if (it.type === 'skin' && count(c, id)) return { ok: false, msg: 'มีคัมภีร์นี้แล้ว' };
  const cost = it.price * qty;
  if (c.gold < cost) return { ok: false, msg: 'เงินไม่พอ' };
  c.gold -= cost;
  addItem(c, id, qty);
  return { ok: true, msg: `ซื้อ ${it.nameTh}${qty > 1 ? ` x${qty}` : ''} (-฿${cost.toLocaleString()})` };
}

/** ล็อกไอเทม (กันขายพลาด / ไม่รวมในขายทั้งหมด) */
export const isLocked = (c, id) => !!c.locked?.includes(id);
export function toggleLock(c, id) {
  c.locked = c.locked || [];
  if (isLocked(c, id)) c.locked = c.locked.filter((x) => x !== id); else c.locked.push(id);
  return isLocked(c, id);
}

/** ของที่นับเป็น "ของดรอป" สำหรับปุ่มขายทั้งหมด: วัตถุดิบที่ร้านไม่ขาย (ไม่รวมแร่ตีบวก) · kind='fish' = ปลาที่ตกได้ */
export function bulkSellList(c, kind = 'drop') {
  return c.inventory.filter((s) => {
    const it = ITEMS[s.id];
    if (!it || isLocked(c, s.id) || !sellPrice(s.id)) return false;
    return kind === 'fish' ? it.type === 'fish' : it.type === 'material' && !it.price;
  });
}

/** ขายหลายอย่างพร้อมกัน → { ok, msg, gold } */
export function sellMany(c, list) {
  if (tradeLock.on) return LOCKED;
  let gold = 0, n = 0;
  for (const s of list.map((x) => ({ ...x }))) {
    if (!removeItem(c, s.id, s.qty)) continue;
    gold += sellPrice(s.id) * s.qty; n += s.qty;
  }
  c.gold += gold;
  return n ? { ok: true, msg: `ขาย ${n} ชิ้น (+฿${gold.toLocaleString()})`, gold } : { ok: false, msg: 'ไม่มีของให้ขาย' };
}

export function sell(c, id, qty = 1) {
  if (tradeLock.on) return LOCKED;
  if (isLocked(c, id)) return { ok: false, msg: 'ไอเทมนี้ถูกล็อกไว้ (ปลดล็อกในกระเป๋า)' };
  qty = Math.min(qty, count(c, id));
  if (qty <= 0) return { ok: false, msg: 'ไม่มีของพอขาย' };
  const it = ITEMS[id];
  if (it?.type === 'skin') return { ok: false, msg: 'ขายคัมภีร์ไม่ได้' };
  if (!removeItem(c, id, qty)) return { ok: false, msg: 'ไม่มีของพอขาย' };
  const gain = sellPrice(id) * qty;
  c.gold += gain;
  return { ok: true, msg: `ขาย ${it.nameTh}${qty > 1 ? ` x${qty}` : ''} (+฿${gain.toLocaleString()})` };
}
