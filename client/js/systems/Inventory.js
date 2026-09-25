// ============================================================
//  Inventory & Shop – กระเป๋า, สวมใส่, ใช้ไอเทม, ซื้อ-ขายกับ NPC
//  ทุกฟังก์ชันคืนค่า { ok, msg } เพื่อให้ UI แสดงผล
// ============================================================
import { ITEMS, sellPrice } from '/shared/data/items.js';
import { JOBS } from '/shared/data/classes.js';
import { getDerived } from './Character.js';

const SLOT_OF = { weapon: 'weapon', armor: 'armor', accessory: 'accessory' };

export function count(c, id) {
  return c.inventory.find((s) => s.id === id)?.qty || 0;
}

export function addItem(c, id, qty = 1) {
  const slot = c.inventory.find((s) => s.id === id);
  if (slot) slot.qty += qty; else c.inventory.push({ id, qty });
}

export function removeItem(c, id, qty = 1) {
  const slot = c.inventory.find((s) => s.id === id);
  if (!slot || slot.qty < qty) return false;
  slot.qty -= qty;
  if (slot.qty === 0) c.inventory = c.inventory.filter((s) => s !== slot);
  return true;
}

/** ใช้ยา / เปลี่ยนอาชีพ / สวมใส่ */
export function useItem(c, id) {
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

  if (it.type === 'skin') {                  // Skin อาชีพ: ถือไว้ถาวร เปลี่ยนไปมาได้
    if (c.appearance.job === it.job) return { ok: false, msg: 'ใช้อาชีพนี้อยู่แล้ว' };
    c.appearance = { ...c.appearance, job: it.job };
    const w = c.equipment.weapon;
    if (w && !ITEMS[w].jobs.includes(it.job)) { c.equipment.weapon = null; addItem(c, w); }
    const d = getDerived(c);
    c.hp = Math.min(c.hp, d.maxHp); c.mp = Math.min(c.mp, d.maxMp);
    return { ok: true, msg: `เปลี่ยนอาชีพเป็น ${JOBS[it.job].nameTh}!`, jobChanged: true };
  }

  if (SLOT_OF[it.type]) return equip(c, id);
  return { ok: false, msg: 'ใช้ไอเทมนี้ไม่ได้' };
}

export function equip(c, id) {
  const it = ITEMS[id];
  const slot = SLOT_OF[it.type];
  if (it.jobs && !it.jobs.includes(c.appearance.job))
    return { ok: false, msg: `อาชีพ ${JOBS[c.appearance.job].nameTh} ใช้ไม่ได้` };
  removeItem(c, id);
  if (c.equipment[slot]) addItem(c, c.equipment[slot]);
  c.equipment[slot] = id;
  return { ok: true, msg: `สวมใส่ ${it.nameTh}` };
}

export function unequip(c, slot) {
  const id = c.equipment[slot];
  if (!id) return { ok: false };
  c.equipment[slot] = null;
  addItem(c, id);
  const d = getDerived(c);
  c.hp = Math.min(c.hp, d.maxHp); c.mp = Math.min(c.mp, d.maxMp);
  return { ok: true, msg: `ถอด ${ITEMS[id].nameTh}` };
}

// ---------------- NPC Shop ----------------
export function buy(c, id, qty = 1) {
  const it = ITEMS[id];
  if (!it?.price) return { ok: false, msg: 'ร้านไม่ขายของนี้' };
  if (it.type === 'skin' && count(c, id)) return { ok: false, msg: 'มี Skin นี้แล้ว' };
  const cost = it.price * qty;
  if (c.gold < cost) return { ok: false, msg: 'เงินไม่พอ' };
  c.gold -= cost;
  addItem(c, id, qty);
  return { ok: true, msg: `ซื้อ ${it.nameTh} (-฿${cost})` };
}

export function sell(c, id, qty = 1) {
  const it = ITEMS[id];
  if (it?.type === 'skin') return { ok: false, msg: 'ขาย Skin อาชีพไม่ได้' };
  if (!removeItem(c, id, qty)) return { ok: false, msg: 'ไม่มีของพอขาย' };
  const gain = sellPrice(id) * qty;
  c.gold += gain;
  return { ok: true, msg: `ขาย ${it.nameTh} (+฿${gain})` };
}
