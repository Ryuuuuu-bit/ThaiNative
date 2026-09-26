// ค่าคงที่ที่ใช้ร่วมกันระหว่าง Client และ Server
export const WORLD = {
  width: 5600,     // ความกว้างแผนที่ (หน่วยโลก)
  height: 270,     // ความสูงแผนที่
  groundY: 232,    // ระดับพื้น
  spawnX: 140,
  spawnY: 200,
  minX: -700,      // ขอบซ้ายสุดของหมู่บ้าน (ท่าน้ำตกปลา)
  townEndX: 1000,  // เขตหมู่บ้าน (ไม่มีมอนสเตอร์)
  campEndX: 1350,  // ค่ายพักพราน (ผีไม่ไล่ตามเข้ามา)
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
 *  Map 1 village: หมู่บ้านเริ่มต้น (Safe Zone) มีท่าน้ำตกปลาด้านซ้าย
 *  Map 2 forest : ป่าผีดุ Lv.1–10 (ค่ายพักพรานที่ทางเข้า)
 *  Map 3 grave  : ป่าช้าผีตายโหง Lv.11–18 → ลานพญายักษ์ (เรดบอส)
 */
export const MAPS = {
  village: { id: 'village', no: 1, nameTh: 'หมู่บ้านบางผี', minX: -700, maxX: 1040, safe: true, respawnX: 140,
    gates: [{ x: 990, to: 'forest', arriveX: 1170, labelTh: '🌲 วาร์ปไปป่าผีดุ' }] },
  forest:  { id: 'forest', no: 2, nameTh: 'ป่าผีดุ', minX: 1090, maxX: 3620, respawnX: 1250,
    camp: { x: 1250, fireX: 1205, npcX: 1318, endX: 1350 },
    gates: [{ x: 1125, to: 'village', arriveX: 940, labelTh: '🏘️ กลับหมู่บ้าน' },
            { x: 3570, to: 'grave', arriveX: 3730, minLv: 10, labelTh: '⚰️ ป่าช้าผีตายโหง (Lv.10+)' }] },
  grave:   { id: 'grave', no: 3, nameTh: 'ป่าช้าผีตายโหง', minX: 3650, maxX: 5600, respawnX: 3730,
    gates: [{ x: 3690, to: 'forest', arriveX: 3500, labelTh: '🌲 กลับป่าผีดุ' }] },
};
export const mapAt = (x) => (x < 1065 ? MAPS.village : x < 3635 ? MAPS.forest : MAPS.grave);
/** ประตูที่ใกล้ที่สุดภายในระยะ r */
export const gateNear = (x, r = 90) => mapAt(x).gates.find((g) => Math.abs(x - g.x) < r) || null;
