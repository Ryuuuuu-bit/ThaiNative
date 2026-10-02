// ============================================================
//  ThaiNative Online – จุดเริ่มต้นของเกม (Phaser 3)
// ============================================================
import { WORLD, VIEW, RENDER_SCALE } from '/shared/constants.js';
import { BootScene } from './scenes/BootScene.js';
import { CreateScene } from './scenes/CreateScene.js';
import { LobbyScene } from './scenes/LobbyScene.js';
import { TopDownScene } from './scenes/TopDownScene.js';
import { setupOrientationHint } from './systems/Orientation.js';
import { applyDeviceClass } from './systems/Screen.js';
import { setupTrailer } from './systems/Trailer.js';
import { registerPwa } from './systems/Pwa.js';
registerPwa();   // PWA: ติดตั้งเป็นแอป + แคชภาพไว้ในเครื่อง

setupTrailer();                               // ตัวอย่างเรื่องราวบนหน้าเข้าสู่ระบบ
applyDeviceClass();                           // จัดกลุ่มเครื่อง pc / phone / tablet → body.dev-*
setupOrientationHint();                       // มือถือถือแนวตั้ง → แนะนำหมุนจอ (ทุกหน้า ตั้งแต่หน้าแรก)

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: VIEW.width * RENDER_SCALE,
  height: VIEW.height * RENDER_SCALE,
  backgroundColor: '#0d0714',
  transparent: true,          // โปร่งใส → เห็นวอลเปเปอร์หน้าเข้าเกมด้านหลัง (ฉากเกมวาดเต็มจออยู่แล้ว)
  pixelArt: true,             // ภาพพิกเซลคมชัด ไม่เบลอ
  roundPixels: true,
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: WORLD.gravity }, debug: false },
  },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, LobbyScene, CreateScene, TopDownScene],
};

window.game = new Phaser.Game(config);

// ------------------------------------------------------------
//  พับจอ / สลับแท็บ: เบราว์เซอร์หยุด requestAnimationFrame + Phaser หยุดเกมเอง
//  → บอท (AUTO) หยุดตีแต่ผีบน server ยังตี = ตาย  →  ใช้ Web Worker (ไม่โดนหน่วงเวลาแบบแท็บพื้นหลัง)
//  เดินเกมต่อแบบไม่วาดภาพ (headlessStep) ทุก ~50ms ระหว่างที่แท็บถูกซ่อน
// ------------------------------------------------------------
{
  const game = window.game;
  game.events.once('ready', () => {
    game.events.off('hidden', game.onHidden, game);            // ไม่หยุดเกมตอนแท็บถูกซ่อน
    game.events.off('visible', game.onVisible, game);
  });
  let last = 0, worker = null;
  try {
    worker = new Worker(URL.createObjectURL(new Blob(['setInterval(()=>postMessage(0),50)'], { type: 'text/javascript' })));
  } catch { /* ไม่มี Worker: ใช้ setInterval (ช้าลงแต่ยังเดิน) */ }
  const tick = () => {
    if (!document.hidden || !game.isBooted) { last = 0; return; }
    const now = performance.now(), dt = last ? Math.min(250, now - last) : 16;
    last = now;
    try { game.headlessStep(now, dt); } catch (e) { console.warn('bg tick', e); }
  };
  if (worker) worker.onmessage = tick; else setInterval(tick, 50);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { last = 0; game.loop?.resetDelta?.(); } });
  window.__bgTick = tick;                                        // ใช้ทดสอบ
}

// ------------------------------------------------------------
//  จอกว้างกว่า 16:9 (มือถือแนวนอน ~19.5:9 · จอ ultrawide) → ขยายฉากในเกมให้เต็มความกว้าง ไม่มีขอบดำ
//  ▸ เฉพาะตอนอยู่ในเกม (td-mode) · หน้าล็อกอิน/สร้างตัวละครคง 16:9 · สูงสุด 2.3:1
// ------------------------------------------------------------
{
  const game = window.game, BASE = 16 / 9, MIN = 4 / 3, MAX = 2.3, H = VIEW.height * RENDER_SCALE;
  let cur = BASE;
  const fit = () => {
    const ar = document.body.classList.contains('td-mode') ? Math.min(MAX, Math.max(MIN, innerWidth / Math.max(1, innerHeight))) : BASE;
    if (Math.abs(ar - cur) < 0.01) return;
    cur = ar;
    document.documentElement.style.setProperty('--ar', ar.toFixed(4));
    game.scale.setGameSize(Math.round(H * ar), H);
    game.scale.refresh();
  };
  window.__fitWide = fit;
  window.addEventListener('resize', () => setTimeout(fit, 60));
  new MutationObserver(fit).observe(document.body, { attributes: true, attributeFilter: ['class'] });   // เข้า/ออกเกม
}
