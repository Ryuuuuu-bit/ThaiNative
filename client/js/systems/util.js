// ตัวช่วยเล็กๆ ที่ใช้หลายที่

/** สร้างข้อความในโลกเกมให้คมชัดแม้กล้องซูม x2 (render ละเอียด + filter แบบ linear) */
export function makeText(scene, x, y, text, style = {}) {
  // อ่านง่าย: ตัวอักษรในโลกเกมเล็กสุด 8px (= 16px บนจอเพราะกล้องซูม x2) + ขอบดำหนาขึ้น
  const n = parseFloat(style.fontSize || '8');
  const size = n <= 8 ? Math.max(8, n + 1.5) : n;
  style = { ...style, fontSize: `${size}px` };
  const t = scene.add.text(x, y, text, {
    fontFamily: 'Mitr, Tahoma, sans-serif',
    fontSize: '8px',
    color: '#ffffff',
    stroke: '#000000',
    strokeThickness: 3,
    fontStyle: '500',
    shadow: { offsetX: 0, offsetY: 1, color: '#000', blur: 2, fill: true, stroke: true },
    resolution: 4,
    ...style,
  });
  t.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  return t;
}

export const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

// ---------------- ไอคอนภาพ (PixelLab) แทนอีโมจิ ----------------
// BootScene ใส่รายการไอคอนจาก manifest ไว้ที่ ICONS  (it_<itemId>, sk_<skillId>)
export const ICONS = {};
const ITEM_ALIAS = { skin_swordman: 'skin_scroll', skin_mage: 'skin_scroll', skin_archer: 'skin_scroll', skin_boxer: 'skin_scroll',
  elixir_ghost: 'herb_mushroom', food_nomai: 'herb_bamboo' };

/** HTML ไอคอนไอเทม: มีภาพ → <img>, ไม่มี → อีโมจิเดิม */
export function itemIcon(id, emoji = '') {
  const f = ICONS[`it_${ITEM_ALIAS[id] || id}`];
  return f ? `<img class="px-ico" src="${f}" alt="">` : emoji;
}
export function skillIcon(id, emoji = '') {
  const f = ICONS[`sk_${id}`];
  return f ? `<img class="px-ico" src="${f}" alt="">` : emoji;
}
export function uiIcon(key, emoji = '') {
  const f = ICONS[`ui_${key}`];
  return f ? `<img class="px-ico" src="${f}" alt="">` : emoji;
}
