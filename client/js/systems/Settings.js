// ============================================================
//  Settings – ตั้งค่าในเกม (เก็บใน localStorage ของเบราว์เซอร์)
// ============================================================
const KEY = 'thainative_settings_v1';

export const DEFAULT_SETTINGS = {
  bgmOn: true, bgmVol: 0.6,     // เพลงประกอบ
  sfxOn: true, sfxVol: 0.8,     // เสียงเอฟเฟกต์
  damageNumbers: true,          // ตัวเลขดาเมจลอย
  minimap: true,                // มินิแมปมุมขวาบน
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
