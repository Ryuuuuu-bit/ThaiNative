// ตัวช่วยเล็กๆ ที่ใช้หลายที่

/** สร้างข้อความในโลกเกมให้คมชัดแม้กล้องซูม x2 (render ละเอียด + filter แบบ linear) */
export function makeText(scene, x, y, text, style = {}) {
  const t = scene.add.text(x, y, text, {
    fontFamily: 'Mitr, Tahoma, sans-serif',
    fontSize: '8px',
    color: '#ffffff',
    stroke: '#000000',
    strokeThickness: 2,
    resolution: 4,
    ...style,
  });
  t.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  return t;
}

export const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
