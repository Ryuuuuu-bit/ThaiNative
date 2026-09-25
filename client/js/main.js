// ============================================================
//  ThaiNative – จุดเริ่มต้นของเกม (Phaser 3)
// ============================================================
import { WORLD, VIEW } from '/shared/constants.js';
import { BootScene } from './scenes/BootScene.js';
import { CreateScene } from './scenes/CreateScene.js';
import { GameScene } from './scenes/GameScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: VIEW.width,
  height: VIEW.height,
  backgroundColor: '#0d0714',
  pixelArt: true,             // ภาพพิกเซลคมชัด ไม่เบลอ
  roundPixels: true,
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: WORLD.gravity }, debug: false },
  },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, CreateScene, GameScene],
};

window.game = new Phaser.Game(config);
