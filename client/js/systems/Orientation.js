// ============================================================
//  แนะนำให้หมุนจอเป็นแนวนอน (มือถือ/แท็บเล็ตเล็ก ถือแนวตั้ง)
//  ▸ ขึ้นทุกหน้า ตั้งแต่หน้าเข้าเกม/ล็อกอิน/สร้างตัวละคร ไปจนถึงในเกม
//  ▸ ปุ่ม "เต็มจอ + แนวนอน" (Android ล็อกแนวนอนได้ · iOS ต้องหมุนเอง)
//  ▸ ปุ่ม "เล่นแนวตั้งต่อ" = ซ่อนไว้ทั้งรอบการเล่นนี้ (ไม่แนะนำ แต่ไม่บังคับ)
// ============================================================
import { isTouchDevice } from '../topdown/TouchControls.js';

const KEY = 'tn_portrait_ok';
const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export async function goLandscape() {
  try { await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }); } catch { /* iOS ไม่รองรับ */ }
  try { await screen.orientation?.lock?.('landscape'); } catch { /* บางเครื่องล็อกไม่ได้ */ }
}

export function setupOrientationHint() {
  if (!(isTouchDevice() || /[?&]touch=1/.test(location.search))) return;
  document.body.classList.add('touch-dev');
  let dismissed = false;
  try { dismissed = sessionStorage.getItem(KEY) === '1'; } catch { /* private mode */ }
  if (dismissed) document.body.classList.add('portrait-ok');
  const el = document.createElement('div');
  el.id = 'rotate-hint';
  el.setAttribute('role', 'dialog');
  el.innerHTML = `
    <div class="rh-card">
      <div class="rh-anim" aria-hidden="true"><span class="rh-phone"></span></div>
      <h2>หมุนโทรศัพท์เป็นแนวนอน</h2>
      <p>ThaiNative ออกแบบมาให้เล่นแนวนอน<br />เห็นแมพกว้าง ปุ่มกดง่าย ตัวหนังสือไม่เล็กเกินไป</p>
      ${isIOS() ? '<p class="rh-tip">iPhone: ปิด "ล็อกการหมุนจอ" ในศูนย์ควบคุมก่อน แล้วหมุนเครื่อง<br />เล่นเต็มจอ: แชร์ → เพิ่มไปยังหน้าจอโฮม</p>' : ''}
      <button class="rh-go" id="rh-go">⛶ เต็มจอ + แนวนอน</button>
      <button class="rh-skip" id="rh-skip">เล่นแนวตั้งต่อ (ไม่แนะนำ)</button>
    </div>`;
  document.body.appendChild(el);
  el.querySelector('#rh-go').onclick = goLandscape;
  if (isIOS()) el.querySelector('#rh-go').style.display = document.documentElement.requestFullscreen ? '' : 'none';
  el.querySelector('#rh-skip').onclick = () => {
    document.body.classList.add('portrait-ok');
    try { sessionStorage.setItem(KEY, '1'); } catch { /* ignore */ }
  };
  // Phaser บางครั้งไม่ได้ขนาดใหม่ตอนหมุนจอ → บังคับคำนวณใหม่
  const refit = () => setTimeout(() => window.game?.scale?.refresh?.(), 250);
  window.addEventListener('orientationchange', refit);
  screen.orientation?.addEventListener?.('change', refit);
}
