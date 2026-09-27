// ============================================================
//  ช่องสวมใส่ (แบบ PoE): อาวุธ · หมวก · เสื้อ · ถุงมือ · รองเท้า · เข็มขัด · เครื่องประดับ 2 ข้าง · ขวดยา 2 ช่อง
// ============================================================
export const EQUIP_SLOTS = ['weapon', 'helm', 'armor', 'gloves', 'boots', 'belt', 'accessory', 'accessory2', 'flask', 'flask2'];
/** ช่อง → ชนิดไอเทมที่ใส่ได้ */
export const SLOT_TYPE = {
  weapon: 'weapon', helm: 'helm', armor: 'armor', gloves: 'gloves', boots: 'boots', belt: 'belt',
  accessory: 'accessory', accessory2: 'accessory', flask: 'flask', flask2: 'flask',
};
/** ชนิดไอเทมที่สวมได้ (มีค่าพลัง) · ขวดยาแยกต่างหาก */
export const GEAR_TYPES = ['weapon', 'helm', 'armor', 'gloves', 'boots', 'belt', 'accessory'];
export const WEAR_TYPES = [...GEAR_TYPES, 'flask'];
/** ช่องที่ตีบวกได้ (ขวดยาตีบวกไม่ได้) */
export const ENH_SLOTS = EQUIP_SLOTS.filter((s) => SLOT_TYPE[s] !== 'flask');
export const FLASK_SLOTS = ['flask', 'flask2'];
export const SLOT_TH = {
  weapon: 'อาวุธ', helm: 'หมวก', armor: 'เสื้อเกราะ', gloves: 'ถุงมือ', boots: 'รองเท้า', belt: 'เข็มขัด',
  accessory: 'เครื่องประดับ 1', accessory2: 'เครื่องประดับ 2', flask: 'ขวดยา 1', flask2: 'ขวดยา 2',
};
export const TYPE_TH = { weapon: 'อาวุธ', helm: 'หมวก', armor: 'เสื้อเกราะ', gloves: 'ถุงมือ', boots: 'รองเท้า', belt: 'เข็มขัด', accessory: 'เครื่องประดับ', flask: 'ขวดยา' };
/** ช่องว่างใหม่ทั้งหมด (สำหรับตัวละครใหม่/ซ่อมเซฟเก่า) */
export const emptyEquipment = () => Object.fromEntries(EQUIP_SLOTS.map((s) => [s, null]));
