// ============================================================
//  กันแตะทะลุ: แตะ/คลิกบนหน้าต่าง-เมนู HTML ไม่ให้ไปโดนผู้เล่น/ผี/NPC/พื้นในฉาก Phaser
//  ▸ จุดที่แตะต้องเป็น canvas จริง (ไม่มี HTML บังอยู่)
//  ▸ หลังแตะ UI (เปิด/ปิดหน้าต่าง) พักการแตะฉากสั้นๆ กัน touch → click ปลอมที่ตามมา
// ============================================================
let lastUi = 0;
const GRACE = 350;
const isCanvas = (el) => el && el.tagName === 'CANVAS';
for (const ev of ['pointerdown', 'touchstart', 'mousedown', 'click', 'pointerup']) {
  document.addEventListener(ev, (e) => { const t = e.target; if (!isCanvas(t) && !t?.closest?.('#t-stick, #t-atk')) lastUi = performance.now(); }, { capture: true, passive: true });
}
/** true = ไม่ควรให้ฉากรับการแตะนี้ */
export function uiBlocked(ptr) {
  if (performance.now() - lastUi < GRACE) return true;
  const e = ptr?.event;
  if (!e) return false;
  const t = e.changedTouches?.[0] || e;
  if (typeof t.clientX !== 'number') return false;
  const el = document.elementFromPoint(t.clientX, t.clientY);
  return !!el && !isCanvas(el);
}
