// ============================================================
//  Settings – ตั้งค่าในเกม (เก็บใน localStorage ของเบราว์เซอร์)
// ============================================================
const KEY = 'thainative_settings_v1';

export const DEFAULT_SETTINGS = {
  bgmOn: true, bgmVol: 0.6,     // เพลงประกอบ
  sfxOn: true, sfxVol: 0.8,     // เสียงเอฟเฟกต์
  damageNumbers: true,          // ตัวเลขดาเมจลอย
  minimap: true,                // มินิแมปมุมขวาบน
  touchSize: 0,                 // ขนาดปุ่มสัมผัส (มือถือ/แท็บเล็ต) % · 0 = อัตโนมัติ (มือถือ 85 · แท็บเล็ต 72)
  fxShake: true,                // จอสั่นตอนสกิล/โดนตี
  fxFlash: 'full',              // แสงวาบ/ฟ้ามืดของสกิล: full | soft | off
  autoHp: 0, autoMp: 0,         // กินยาอัตโนมัติเมื่อต่ำกว่า % (0 = ปิด)
  autoSkill: false,             // Auto: ตีผีในหน้าจอ + ร่ายสกิลในแถบอัตโนมัติ (ปุ่ม R)
  chatBubble: true,             // ฟองคำพูดเหนือหัวผู้เล่น
  otherSfx: 'full',             // เสียงของผู้เล่นอื่น/ผีตายรอบตัว: full | soft | off (ดังเบาตามระยะเสมอ)
  autoMobs: [],                 // ชนิดผีที่ Auto จะตี (ว่าง = ตีทุกตัว) · เลือกที่ปุ่ม ▾ / Shift+R
  muteHidden: false,            // สลับไปแท็บ/หน้าต่างอื่น → ปิดเสียงชั่วคราว (เปิดออโต้ทิ้งไว้)
  otherDmg: true,               // ตัวเลขดาเมจ/ประกายตีของผู้เล่นอื่น
  otherFx: true,                // เอฟเฟกต์สกิลของผู้เล่นอื่น
  otherNames: true,             // ชื่อ/ฉายาผู้เล่นอื่นเหนือหัว (หัวแดงยังแสดงเสมอ)
  showFps: false,               // ตัวนับ FPS มุมจอ
  lootLog: 'all',               // บันทึกของที่ได้: all | rare (เฉพาะของดี) | off
};

/** โหมดลื่น: ปิดของหนัก ๆ ที่ไม่จำเป็น (เครื่องสเปกต่ำ/มือถือ/เปิดทิ้งทั้งวัน) */
export const PERF_PRESET = { otherDmg: false, otherFx: false, fxShake: false, fxFlash: 'soft', otherSfx: 'soft', chatBubble: false };

export function loadSettings() {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { ...DEFAULT_SETTINGS }; }
}

export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

export function toggleFullscreen() {
  const el = document.documentElement;
  if (!document.fullscreenElement) return el.requestFullscreen?.().catch(() => {});
  return document.exitFullscreen?.();
}
