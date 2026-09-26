// ค่าคงที่ที่ใช้ร่วมกันระหว่าง Client และ Server
export const WORLD = {
  width: 5600,     // ความกว้างแผนที่ (หน่วยโลก)
  height: 270,     // ความสูงแผนที่
  groundY: 232,    // ระดับพื้น
  spawnX: 140,
  spawnY: 200,
  minX: -700,      // ขอบซ้ายสุดของหมู่บ้าน (ท่าน้ำตกปลา)
  townEndX: 1000,  // เขตหมู่บ้าน (ไม่มีมอนสเตอร์)
  graveX: 3650,    // ป่าช้าผีตายโหง (ผี Lv.11–18)
  arenaX: 4950,    // ลานพญายักษ์ (เรดบอส) ตั้งแต่ X นี้ถึงสุดแผนที่
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

export const PARTY = {
  maxSize: 4,
  shareRange: 500,   // สมาชิกที่อยู่ห่างไม่เกินนี้ได้รับ EXP แบ่ง
  shareRatio: 0.6,   // สมาชิกคนอื่นได้ EXP 60% ของที่ผู้ฆ่าได้ (ผู้ฆ่าได้เต็ม)
};

/**
 * แผนที่ (อยู่ในพิกัด X เดียวกัน แต่แยกกันด้วยประตูวาร์ป – เดินข้ามกันไม่ได้)
 *  village: หมู่บ้านเริ่มต้น (Safe Zone) มีท่าน้ำตกปลาด้านซ้าย
 *  forest : ป่าผีดุ → ป่าช้า → ลานพญายักษ์
 */
export const MAPS = {
  village: { id: 'village', nameTh: 'หมู่บ้านบางผี', minX: -700, maxX: 1040, safe: true,
    gate: { x: 990, to: 'forest', arriveX: 1170 } },
  forest:  { id: 'forest', nameTh: 'ป่าผีดุ', minX: 1090, maxX: 5600,
    gate: { x: 1125, to: 'village', arriveX: 940 } },
};
export const mapAt = (x) => (x < MAPS.forest.minX - 20 ? MAPS.village : MAPS.forest);
