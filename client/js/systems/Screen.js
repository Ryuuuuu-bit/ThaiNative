// ============================================================
//  ตรวจจอ → จัดกลุ่มเครื่อง (ไม่เดาจากชื่อรุ่น: ดูจากวิธีกด + ขนาดจอจริง)
//  ▸ pc     : มีเมาส์/ทัชแพดเป็นหลัก (รวมโน้ตบุ๊กจอสัมผัสที่ใช้เมาส์)
//  ▸ phone  : จอสัมผัส ด้านสั้น < 600px (CSS px)
//  ▸ tablet : จอสัมผัส ด้านสั้น ≥ 600px (iPad ทุกรุ่นรวม iPad Pro · แท็บเล็ต Android)
//  body ได้คลาส dev-pc / dev-phone / dev-tablet → CSS ปรับขนาดปุ่ม/ตำแหน่งตามกลุ่ม
//  สัดส่วนจอ (4:3 … 21:9) จัดการใน main.js (__fitWide) + CSS media query
// ============================================================
const mq = (q) => { try { return window.matchMedia?.(q).matches || false; } catch { return false; } };

export function deviceClass() {
  const force = location.search.match(/[?&]dev=(pc|phone|tablet)/);
  if (force) return force[1];                                                          // ทดสอบ: ?dev=tablet
  const coarse = mq('(pointer: coarse)'), fineAny = mq('(any-pointer: fine)');
  const touch = coarse || navigator.maxTouchPoints > 0 || /[?&]touch=1/.test(location.search);
  if (!touch || (fineAny && !coarse)) return 'pc';                                    // จอสัมผัสแต่ใช้เมาส์เป็นหลัก → แบบ PC
  const short = Math.min(screen.width || innerWidth, screen.height || innerHeight);
  return short < 600 ? 'phone' : 'tablet';
}

export function applyDeviceClass() {
  const cls = deviceClass(), b = document.body;
  for (const c of ['dev-pc', 'dev-phone', 'dev-tablet']) b.classList.toggle(c, c === `dev-${cls}`);
  b.dataset.dev = cls;
  return cls;
}
