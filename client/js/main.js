// ============================================================
//  ThaiNative Online – จุดเริ่มต้นของเกม (Phaser 3)
// ============================================================
import { WORLD, VIEW, RENDER_SCALE } from '/shared/constants.js';
import { BootScene } from './scenes/BootScene.js';
import { CreateScene } from './scenes/CreateScene.js';
import { LobbyScene } from './scenes/LobbyScene.js';
import { TopDownScene } from './scenes/TopDownScene.js';

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
