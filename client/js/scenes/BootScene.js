// BootScene – สร้างภาพ/Animation ทั้งหมด แล้วไปหน้าสร้างตัวละคร
import { generateAll } from '../gfx/SpriteFactory.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }

  preload() {
    // ▸ ถ้ามีภาพจาก PixelLab ให้โหลดที่นี่ เช่น
    // this.load.spritesheet('mon_krasue', 'assets/monsters/krasue.png', { frameWidth: 24, frameHeight: 34 });
  }

  create() {
    generateAll(this);
    // รอฟอนต์ไทยโหลดก่อน เพื่อให้ข้อความในเกมใช้ฟอนต์ Mitr
    const go = () => this.scene.start('create');
    if (document.fonts?.load) Promise.race([document.fonts.load('10px Mitr'), new Promise((r) => setTimeout(r, 1500))]).then(go);
    else go();
  }
}
