// ============================================================
//  เวลาในโลกเกม: กลางวัน–กลางคืน, ข้างขึ้น–ข้างแรม (ใช้ร่วม client + server)
//  เวลาเดินตามนาฬิกาของ server → ผู้เล่นทุกคนเห็นฟ้ามืดพร้อมกัน
// ============================================================

export const DAY_MS_DEFAULT = 20 * 60 * 1000;       // 1 วันในเกม = 20 นาทีจริง
export const MOON_CYCLE = 8;                          // วงรอบดวงจันทร์ (วันในเกม)

/** phase 0–1 ของวัน: 0 = 06:00 (เช้า) */
export const dayPhase = (t, dayMs = DAY_MS_DEFAULT) => ((t % dayMs) + dayMs) % dayMs / dayMs;
export const dayIndex = (t, dayMs = DAY_MS_DEFAULT) => Math.floor(t / dayMs);

/** เวลาในเกมแบบ HH:MM */
export function clockText(phase) {
  const mins = Math.floor(((phase * 24 + 6) % 24) * 60);
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

/** ช่วงเวลา: เช้า 06–10, กลางวัน 10–16, เย็น 16–19, กลางคืน 19–06 */
export function periodOf(phase) {
  const h = (phase * 24 + 6) % 24;
  if (h >= 6 && h < 10) return { id: 'morning', nameTh: 'ยามเช้า', icon: '🌅' };
  if (h >= 10 && h < 16) return { id: 'day', nameTh: 'กลางวัน', icon: '☀️' };
  if (h >= 16 && h < 19) return { id: 'dusk', nameTh: 'ยามเย็น', icon: '🌇' };
  return { id: 'night', nameTh: 'กลางคืน', icon: '🌙' };
}
export const isNight = (phase) => periodOf(phase).id === 'night';

/** ความสว่าง 0 (มืดสุด) – 1 (สว่างสุด) ไล่ต่อเนื่อง */
export function daylight(phase) {
  const h = (phase * 24 + 6) % 24;
  if (h >= 8 && h < 17) return 1;
  if (h >= 5 && h < 8) return (h - 5) / 3;           // รุ่งสาง
  if (h >= 17 && h < 20) return 1 - (h - 17) / 3;    // พลบค่ำ
  return 0;
}

/** ดวงจันทร์ของคืนนั้น: เพ็ญ (วันพระใหญ่) / ดับ (ผีดุสุด) / ปกติ */
export function moonOf(dayIdx) {
  const m = ((dayIdx % MOON_CYCLE) + MOON_CYCLE) % MOON_CYCLE;
  if (m === 0) return { id: 'full', nameTh: 'คืนเดือนเพ็ญ (วันพระ)', icon: '🌕' };
  if (m === 4) return { id: 'dark', nameTh: 'คืนเดือนดับ', icon: '🌑' };
  return { id: 'normal', nameTh: '', icon: '🌙' };
}

/** ตัวคูณของผีตามเวลา  (กลางคืนผีแรงขึ้น แต่ให้ EXP/เงินมากขึ้น) */
export function nightMods(phase, moon) {
  if (!isNight(phase)) return { atk: 1, hp: 1, exp: 1, gold: 1 };
  if (moon.id === 'dark') return { atk: 1.45, hp: 1.3, exp: 2, gold: 1.6 };
  if (moon.id === 'full') return { atk: 1.1, hp: 1, exp: 1.5, gold: 1.5 };   // วันพระ: ผีอ่อนลง รางวัลดี
  return { atk: 1.25, hp: 1.15, exp: 1.5, gold: 1.3 };
}
