// ============================================================
//  PWA: ติดตั้งเกมลงหน้าจอ (เหมือนแอป) + service worker แคชภาพไว้ในเครื่อง
//  ▸ Android/Chrome/Edge: ปุ่ม "ติดตั้งเกม" เรียกหน้าติดตั้งของระบบ
//  ▸ iPhone/iPad (Safari): ไม่มีหน้าติดตั้งอัตโนมัติ → ปุ่มเปิดคำแนะนำ แชร์ → เพิ่มไปยังหน้าจอโฮม
//  ▸ เปิดจากไอคอนที่ติดตั้งแล้ว (standalone/fullscreen) → ซ่อนปุ่ม
// ============================================================
let deferred = null;
const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isInstalled = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;

export function registerPwa() {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => { /* ไม่มี SW ก็เล่นได้ปกติ */ });
  }
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; refreshInstallButton(); });
  window.addEventListener('appinstalled', () => { deferred = null; refreshInstallButton(); });
}

/** แสดงปุ่มเฉพาะตอนติดตั้งได้จริง (Chrome ส่ง beforeinstallprompt มาแล้ว) หรือเป็น iOS ที่ยังไม่ได้ติดตั้ง */
export function refreshInstallButton(show = !document.getElementById('title-discord')?.classList.contains('hidden')) {
  const b = document.getElementById('title-install');
  if (!b) return;
  const can = !isInstalled() && (deferred || isIOS());
  b.classList.toggle('hidden', !(show && can));
  b.onclick = async () => {
    if (deferred) { deferred.prompt(); try { await deferred.userChoice; } catch { /* */ } deferred = null; refreshInstallButton(); return; }
    document.getElementById('ios-install')?.classList.remove('hidden');
  };
}
