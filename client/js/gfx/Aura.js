// ============================================================
//  Aura – ออร่ารอบตัวตามขั้นตีบวก (ขั้นสูงสุดของอุปกรณ์ที่ใส่)
//  1 ฟ้า +7 · 2 ม่วง +10 · 3 ทอง +13 · 4 เพลิงแดง +16 · 5 รุ้ง +20
// ============================================================
export const AURA_TH = ['', 'สีฟ้า', 'สีม่วง', 'สีทอง', 'เพลิงแดง', 'สีรุ้ง'];
export const AURA_COLOR = [0, 0x5dade2, 0xaf7ac5, 0xf4d03f, 0xe74c3c, 0xffffff];
const TINTS = [[], [0x5dade2, 0xaed6f1], [0xaf7ac5, 0xd2b4de, 0x8e44ad], [0xf4d03f, 0xf9e79f, 0xf5b041],
  [0xe74c3c, 0xf39c12, 0xf5b041, 0xfad7a0], [0xe74c3c, 0xf39c12, 0xf4d03f, 0x58d68d, 0x5dade2, 0xaf7ac5]];

export class Aura {
  constructor(scene, target) {
    this.scene = scene;
    this.target = target;
    this.tier = 0;
    this.parts = [];
  }

  setTier(t = 0) {
    if (t === this.tier) return;
    this.clear();
    this.tier = t;
    if (!t || !this.scene.textures.exists('particle')) return;
    const s = this.scene, tg = this.target, d = (tg.depth || 10) - 0.05;
    // วงแสงที่เท้า
    this.glow = s.add.ellipse(tg.x, tg.y, 28 + t * 3, 7 + t, AURA_COLOR[t], 0.3).setBlendMode(Phaser.BlendModes.ADD).setDepth(d);
    // ประกายลอยขึ้นรอบตัว (ขั้นสูง = ถี่/แรงขึ้น เป็นเปลวไฟ)
    const em = s.add.particles(0, 0, 'particle', {
      x: { min: -9, max: 9 }, y: { min: -26, max: 2 },
      speedY: t >= 4 ? { min: -45, max: -20 } : { min: -22, max: -8 }, speedX: { min: -5, max: 5 },
      lifespan: t >= 4 ? 650 : 950, frequency: [0, 170, 115, 80, 45, 35][t], quantity: 1,
      scale: { start: 0.3 + t * 0.04, end: 0 }, alpha: { start: 0.9, end: 0 },
      tint: TINTS[t], blendMode: 'ADD',
    }).setDepth(d);
    em.startFollow(tg, 0, -14);
    this.parts.push(em);
    if (t >= 3) {                          // ทอง+: ประกายวงรอบตัว
      const ring = s.add.particles(0, 0, 'particle', {
        emitZone: { type: 'edge', source: new Phaser.Geom.Ellipse(0, 0, 30, 44), quantity: 24 },
        lifespan: 500, frequency: t >= 5 ? 60 : 110, scale: { start: 0.22, end: 0 }, alpha: { start: 0.8, end: 0 },
        tint: TINTS[t], blendMode: 'ADD',
      }).setDepth(d + 0.1);
      ring.startFollow(tg, 0, -20);
      this.parts.push(ring);
    }
  }

  update(time) {
    if (!this.tier || !this.glow) return;
    const tg = this.target, vis = tg.visible && tg.active !== false && tg.alpha > 0.2;
    this.glow.setPosition(tg.x, tg.y - 1).setVisible(vis);
    this.glow.setAlpha(0.22 + 0.12 * Math.sin(time / 220));
    if (this.tier >= 5) this.glow.setFillStyle(Phaser.Display.Color.HSVToRGB((time / 2000) % 1, 0.6, 1).color, this.glow.alpha);
    this.parts.forEach((p) => { p.setVisible(vis); p.emitting = vis; });
  }

  clear() {
    this.glow?.destroy(); this.glow = null;
    this.parts.forEach((p) => p.destroy()); this.parts = [];
  }

  destroy() { this.clear(); }
}
