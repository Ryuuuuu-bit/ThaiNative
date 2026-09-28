// ============================================================
//  Settings – ตั้งค่าในเกม (เก็บใน localStorage ของเบราว์เซอร์)
// ============================================================
const KEY = 'thainative_settings_v1';

export const DEFAULT_SETTINGS = {
  bgmOn: true, bgmVol: 0.6,     // เพลงประกอบ
  sfxOn: true, sfxVol: 0.8,     // เสียงเอฟเฟกต์
  damageNumbers: true,          // ตัวเลขดาเมจลอย
  minimap: true,                // มินิแมปมุมขวาบน
  fxShake: true,                // จอสั่นตอนสกิล/โดนตี
  fxFlash: 'full',              // แสงวาบ/ฟ้ามืดของสกิล: full | soft | off
  autoHp: 0, autoMp: 0,         // กินยาอัตโนมัติเมื่อต่ำกว่า % (0 = ปิด)
  autoSkill: false,             // Auto: ตีผีในหน้าจอ + ร่ายสกิลในแถบอัตโนมัติ (ปุ่ม A)
  chatBubble: true,             // ฟองคำพูดเหนือหัวผู้เล่น
  autoMobs: [],                 // ชนิดผีที่ Auto จะตี (ว่าง = ตีทุกตัว) · เลือกที่ปุ่ม ▾ / Shift+A
};

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
