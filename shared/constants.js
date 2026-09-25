// ค่าคงที่ที่ใช้ร่วมกันระหว่าง Client และ Server
export const WORLD = {
  width: 3200,     // ความกว้างแผนที่ (หน่วยโลก)
  height: 270,     // ความสูงแผนที่
  groundY: 232,    // ระดับพื้น
  spawnX: 140,
  spawnY: 200,
  townEndX: 620,   // เขตหมู่บ้าน (ไม่มีมอนสเตอร์)
  gravity: 700,
  maxSpeed: 110,   // ความเร็วเดินสูงสุด (หน่วย/วินาที)
  jumpVelocity: -290,
};

export const VIEW = { width: 960, height: 540, zoom: 2 };

export const CURRENCY = { nameTh: 'บาท', symbol: '฿' };

export const NET = {
  sendRate: 15, // ส่งตำแหน่งตัวเองไป server กี่ครั้ง/วินาที
  interpDelay: 100, // ms – หน่วงการแสดงผลผู้เล่นอื่นเพื่อ interpolate ให้ลื่น
};
