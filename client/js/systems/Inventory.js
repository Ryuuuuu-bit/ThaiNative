// ============================================================
//  Inventory – ตัวช่วยอ่านกระเป๋า (ฝั่ง client)
//  ▸ การเปลี่ยนของ/เงินทั้งหมดทำผ่าน scene.econ.act(...) → server (ออนไลน์) หรือในเครื่อง (ออฟไลน์)
//  ▸ ฟังก์ชันหลักอยู่ที่ /shared/economy.js
// ============================================================
export { count, addItem, removeItem, isLocked, bulkSellList, questState, bountyList } from '/shared/economy.js';

/** ล็อกกระเป๋าระหว่างเทรด (กันใช้/ขายของที่เสนอไว้) */
export const tradeLock = { on: false };
