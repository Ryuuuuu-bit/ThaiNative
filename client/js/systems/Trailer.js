// ============================================================
//  ตัวอย่างเรื่องราว (animatic) บนหน้าเข้าสู่ระบบ
//  ▸ ⛶ ขยายเต็มจอกลางหน้า · Esc / คลิกพื้นหลัง = ย่อกลับ
//  ▸ หน้าเข้าสู่ระบบถูกซ่อน (เข้าเกม) → สั่งหยุดเล่น เสียงไม่ค้าง
//  ▸ ระหว่างเล่น หรี่เพลงหน้าเข้าเกมลง (ไม่ให้เสียงทับกัน) · หยุดแล้วเพลงกลับมา
// ============================================================
import { sound } from './Sound.js';

function duckMusic(on) {
  const bus = sound.musicBus, ctx = sound.ctx;
  if (!bus || !ctx) return;
  const t = ctx.currentTime, back = sound.cfg ? (sound.cfg.bgmOn ? sound.cfg.bgmVol * 0.85 : 0) : 0.5;
  bus.gain.cancelScheduledValues(t); bus.gain.setValueAtTime(bus.gain.value, t);
  bus.gain.linearRampToValueAtTime(on ? 0.0001 : Math.max(0.0001, back), t + 0.6);
}

export function setupTrailer() {
  const box = document.getElementById('trailer'), frame = document.getElementById('tr-frame');
  const bg = document.getElementById('tr-backdrop'), btn = document.getElementById('tr-expand'), scr = document.getElementById('auth-screen');
  if (!box || !frame || !scr) return;
  const pause = () => frame.contentWindow?.postMessage('anim:pause', '*');
  const theatre = (on) => {
    box.classList.toggle('theatre', on); bg?.classList.toggle('hidden', !on);
    btn.textContent = on ? '✕' : '⛶'; btn.title = on ? 'ย่อกลับ (Esc)' : 'ขยายจอ (Esc = ย่อกลับ)';
  };
  btn.onclick = () => theatre(!box.classList.contains('theatre'));
  bg?.addEventListener('click', () => theatre(false));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && box.classList.contains('theatre')) theatre(false); });
  addEventListener('message', (e) => {
    if (e.source !== frame.contentWindow) return;
    if (e.data === 'anim:play') duckMusic(true);
    else if (e.data === 'anim:stop') duckMusic(false);
  });
  new MutationObserver(() => { if (scr.classList.contains('hidden')) { theatre(false); pause(); } }).observe(scr, { attributes: true, attributeFilter: ['class'] });
}
