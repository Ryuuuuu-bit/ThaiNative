// ============================================================
//  MonsterArt – วาดผีไทย 10 ชนิด (Pixel Art ด้วยโค้ด)
//  แต่ละตัวมีท่า walk(4) attack(3) hit(1) และ die(4) (die สร้างจาก hit + จางหาย)
//  ทุกตัววาดหันขวา – ใช้ flipX เมื่อหันซ้าย
// ============================================================
export const MONSTER_ANIMS = {
  walk:   { frames: 4, rate: 6, repeat: -1 },
  attack: { frames: 3, rate: 8, repeat: 0 },
  hit:    { frames: 1, rate: 6, repeat: 0 },
  die:    { frames: 4, rate: 8, repeat: 0 },
};

function px(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }
const RED = '#e74c3c', DARK = '#1b1b1b', WHITE = '#ffffff';

// ctx, P(palette), w, h, anim, i  →  วาดลงพื้นที่ w×h
const DRAW = {
  // 1) ผีถ้วยแก้ว – ถ้วยแก้วใส มีวิญญาณลอยออกมา
  phi_tuay_kaew(ctx, P, w, h, anim, i) {
    const bob = [0, -1, -2, -1][i % 4];
    const lunge = anim === 'attack' ? [0, 4, 2][i] : 0;
    // ถ้วย
    for (let y = 0; y < 8; y++) px(ctx, 6 + (y >> 2), 14 + y + bob, 12 - (y >> 1), 1, y === 0 ? '#ffffff' : 'rgba(174,214,241,0.75)');
    px(ctx, 9, 21 + bob, 6, 1, '#85c1e9');
    // วิญญาณ
    const gx = 9 + lunge, gy = 4 + bob - (anim === 'attack' ? 2 : 0);
    px(ctx, gx, gy, 7, 8, 'rgba(236,240,241,0.9)'); px(ctx, gx + 1, gy - 1, 5, 1, 'rgba(236,240,241,0.9)');
    px(ctx, gx + 1, gy + 8, 2, 3, 'rgba(236,240,241,0.6)'); px(ctx, gx + 4, gy + 8, 2, 2, 'rgba(236,240,241,0.6)');
    px(ctx, gx + 2, gy + 3, 1, 2, DARK); px(ctx, gx + 5, gy + 3, 1, 2, DARK);
    px(ctx, gx + 3, gy + 6, 2, 1, anim === 'attack' ? RED : DARK);
  },

  // 2) กุมารทอง – เด็กตัวทอง ผมจุก นุ่งผ้าแดง
  kuman_thong(ctx, P, w, h, anim, i) {
    const step = anim === 'walk' ? [0, 2, 0, -2][i] : 0;
    const up = anim === 'walk' ? [0, 1, 0, 1][i] : 0;
    const x = 7, y = 3 + up;
    px(ctx, x + 3, y - 2, 4, 3, P.dark);                // จุก
    px(ctx, x + 2, y - 1, 6, 1, '#fdfefe');             // มาลัย
    px(ctx, x, y + 1, 10, 9, P.main);                   // หัว
    px(ctx, x + 5, y + 4, 1, 2, DARK); px(ctx, x + 8, y + 4, 1, 2, DARK);
    px(ctx, x + 6, y + 7, 2, 1, RED);
    px(ctx, x + 1, y + 10, 8, 7, P.main);               // ตัว
    px(ctx, x + 1, y + 14, 8, 3, '#c0392b');            // ผ้าแดง
    px(ctx, x + 2, y + 17, 2, 5 - up, P.dark); px(ctx, x + 6 + step, y + 17, 2, 5 - up, P.dark);
    const reach = anim === 'attack' ? [2, 7, 4][i] : 0;
    px(ctx, x + 8, y + 11, 3 + reach, 2, P.main);        // แขน
    px(ctx, x - 2, y + 11, 3, 2, P.dark);
    px(ctx, x + 2, y + 12, 1, 1, P.glow);
  },

  // 3) กระสือ – หัวผู้หญิงลอย ผมยาว ไส้ห้อยเรืองแสง
  krasue(ctx, P, w, h, anim, i) {
    const bob = [0, -1, -2, -1][i % 4];
    const x = 6, y = 2 + bob;
    px(ctx, x - 1, y - 1, 14, 6, P.dark);                // ผม
    px(ctx, x - 1, y, 4, 12, P.dark);
    px(ctx, x + 1, y + 2, 11, 10, P.main);               // หน้า
    px(ctx, x - 1, y + 3, 3, 9, P.dark);
    px(ctx, x + 6, y + 5, 2, 1, DARK); px(ctx, x + 9, y + 5, 2, 1, DARK);
    px(ctx, x + 6, y + 4, 1, 1, RED); px(ctx, x + 9, y + 4, 1, 1, RED);
    px(ctx, x + 7, y + 9, 3, 1, anim === 'attack' ? '#7b241c' : '#c0392b');
    if (anim === 'attack' && i === 1) px(ctx, x + 7, y + 9, 3, 2, '#641e16');
    // ไส้ห้อย แกว่งไปมา
    for (let k = 0; k < 4; k++) {
      const sway = Math.round(Math.sin((i + k) * 1.3) * 2);
      const len = 10 + k * 2;
      for (let yy = 0; yy < len; yy++) px(ctx, x + 3 + k * 2 + (yy > 5 ? sway : 0), y + 12 + yy, 1, 1, yy % 4 === 0 ? P.glow : (k % 2 ? '#922b21' : '#cb4335'));
    }
    px(ctx, x + 2, y + 12, 9, 2, 'rgba(88,214,141,0.35)');
  },

  // 4) ผีนางตานี – หญิงชุดเขียว ผมยาว
  nang_tani(ctx, P, w, h, anim, i) {
    const sway = [0, 1, 0, -1][i % 4];
    const x = 6, y = 2;
    px(ctx, x - 1, y, 12, 4, DARK); px(ctx, x - 1, y + 3, 4, 20, DARK);    // ผม
    px(ctx, x + 2, y + 3, 9, 9, P.glow);                                       // หน้าขาวซีด
    px(ctx, x + 6, y + 6, 1, 2, DARK); px(ctx, x + 9, y + 6, 1, 2, DARK);
    px(ctx, x + 7, y + 10, 2, 1, '#922b21');
    px(ctx, x + 2, y + 12, 9, 9, P.main);                                      // สไบเขียว
    for (let k = 0; k < 8; k++) px(ctx, x + 2 + k, y + 12 + k, 2, 1, P.dark);
    for (let yy = 0; yy < 16; yy++) px(ctx, x + 1 - (yy >> 3) + (yy > 8 ? sway : 0), y + 21 + yy, 11 + (yy >> 2), 1, yy % 5 === 0 ? P.dark : P.main); // ผ้าถุงยาว
    const reach = anim === 'attack' ? [3, 9, 5][i] : 0;
    px(ctx, x + 9, y + 14, 3 + reach, 2, P.glow);
    px(ctx, x + 11 + reach, y + 13, 2, 1, P.glow); px(ctx, x + 11 + reach, y + 16, 2, 1, P.glow); // นิ้วมือ
  },

  // 5) ผีปอบ – หลังค่อม ผ้าขาดวิ่น ตาแดง
  phi_pob(ctx, P, w, h, anim, i) {
    const step = anim === 'walk' ? [0, 2, 0, -2][i] : 0;
    const x = 5, y = 6;
    px(ctx, x + 4, y, 11, 10, '#bfa98f');                   // หัว
    px(ctx, x + 3, y - 1, 12, 4, '#5d5d5d'); px(ctx, x + 3, y, 3, 9, '#5d5d5d'); // ผมกระเซิง
    px(ctx, x + 10, y + 4, 2, 2, P.glow); px(ctx, x + 13, y + 4, 2, 2, P.glow);
    px(ctx, x + 10, y + 8, 5, 1, DARK); px(ctx, x + 11, y + 8, 1, 2, WHITE); px(ctx, x + 13, y + 8, 1, 2, WHITE); // ฟัน
    px(ctx, x, y + 9, 14, 12, P.main);                       // ลำตัวค่อม
    for (let k = 0; k < 14; k += 3) px(ctx, x + k, y + 20, 2, 3, P.dark); // ชายผ้าขาด
    px(ctx, x + 3 + step, y + 21, 3, 9, '#9c8a73'); px(ctx, x + 9 - step, y + 21, 3, 9, '#9c8a73');
    const reach = anim === 'attack' ? [2, 8, 4][i] : 0;
    const ry = anim === 'attack' && i === 1 ? -3 : 0;
    px(ctx, x + 12, y + 12 + ry, 5 + reach, 3, '#bfa98f');
    for (let k = 0; k < 3; k++) px(ctx, x + 17 + reach, y + 11 + ry + k * 2, 2, 1, DARK); // เล็บ
  },

  // 6) ผีจ้างหนัง – ผ้าขาวคลุม ถือม้วนฟิล์ม
  phi_jang_nang(ctx, P, w, h, anim, i) {
    const bob = [0, -1, 0, 1][i % 4];
    const x = 4, y = 4 + bob;
    px(ctx, x + 3, y - 3, 10, 2, '#34495e'); px(ctx, x + 5, y - 6, 6, 3, '#34495e'); // หมวก
    px(ctx, x + 2, y, 12, 10, P.main);
    px(ctx, x + 1, y + 10, 14, 18, P.main);
    for (let k = 0; k < 14; k += 3) px(ctx, x + 1 + k, y + 28, 2, 2 + (k + i) % 2, P.main); // ชายผ้า
    px(ctx, x + 7, y + 4, 2, 2, DARK); px(ctx, x + 11, y + 4, 2, 2, DARK);
    px(ctx, x + 9, y + 7, 2, 2, DARK);
    // ม้วนฟิล์ม
    const arm = anim === 'attack' ? [[-2, -6], [4, -8], [8, 0]][i] : [0, 0];
    const rx = x + 14 + arm[0], ry = y + 13 + arm[1];
    px(ctx, rx - 1, ry, 5, 5, P.dark); px(ctx, rx, ry + 1, 3, 3, '#aab7b8'); px(ctx, rx + 1, ry + 2, 1, 1, DARK);
    px(ctx, x + 12, y + 14, 3, 2, P.main);
  },

  // 7) ผีพราย – หญิงผีน้ำ ผมยาวปิดหน้า หางเป็นควัน
  phi_phrai(ctx, P, w, h, anim, i) {
    const bob = [0, -1, -2, -1][i % 4];
    const x = 5, y = 2 + bob;
    px(ctx, x, y, 13, 22, P.dark);                          // ผมยาวเปียก
    px(ctx, x + 6, y + 4, 6, 10, P.main);                   // หน้าซีด (โผล่ครึ่ง)
    for (let k = 0; k < 13; k += 2) px(ctx, x + k, y + 22, 1, 2, P.dark); // ปลายผม
    px(ctx, x + 9, y + 7, 2, 1, WHITE); px(ctx, x + 10, y + 7, 1, 1, '#1abc9c');
    px(ctx, x + 2, y + 12, 11, 12, P.main);                 // ลำตัว
    for (let yy = 0; yy < 14; yy++) {                        // หางควันน้ำ
      const wv = Math.round(Math.sin((yy + i * 2) / 2.5) * 2);
      px(ctx, x + 4 + wv + (yy >> 2), y + 24 + yy, 8 - (yy >> 1), 1, yy % 3 ? P.main : P.glow);
    }
    const reach = anim === 'attack' ? [3, 9, 5][i] : 0;
    px(ctx, x + 11, y + 15, 3 + reach, 2, P.main);
    // หยดน้ำ
    px(ctx, x + 1, y + 26 + (i % 4) * 2, 1, 2, '#5dade2');
  },

  // 8) เปรต – สูงมาก ผอม ปากรูเข็ม มือใหญ่
  pret(ctx, P, w, h, anim, i) {
    const step = anim === 'walk' ? [0, 2, 0, -2][i] : 0;
    const x = 8, y = 2;
    px(ctx, x + 1, y, 10, 11, P.main);                      // หัว
    px(ctx, x + 2, y - 1, 8, 2, '#707b7c');
    px(ctx, x + 5, y + 4, 2, 2, DARK); px(ctx, x + 9, y + 4, 2, 2, DARK);
    px(ctx, x + 5, y + 4, 1, 1, P.glow); px(ctx, x + 9, y + 4, 1, 1, P.glow);
    px(ctx, x + 8, y + 8, 1, 1, DARK);                      // ปากรูเข็ม
    px(ctx, x + 5, y + 11, 3, 4, P.main);                   // คอยาว
    px(ctx, x + 3, y + 15, 7, 20, P.dark);                  // ลำตัวผอม (ผ้าเก่า)
    for (let k = 0; k < 6; k++) px(ctx, x + 4, y + 17 + k * 3, 5, 1, P.main); // ซี่โครง
    px(ctx, x + 4 + step, y + 35, 2, 27, P.main); px(ctx, x + 7 - step, y + 35, 2, 27, P.main); // ขายาว
    px(ctx, x + 3 + step, y + 61, 4, 1, P.dark); px(ctx, x + 6 - step, y + 61, 4, 1, P.dark);
    const ang = anim === 'attack' ? [-10, 30, 60][i] : 80;
    const c = Math.cos(ang * Math.PI / 180), s = Math.sin(ang * Math.PI / 180);
    for (let k = 0; k < 18; k++) px(ctx, x + 8 + c * k, y + 17 + s * k, 2, 2, P.main); // แขนยาว
    px(ctx, x + 7 + c * 18, y + 16 + s * 18, 5, 5, P.main);                              // มือใหญ่
  },

  // 9) ผีสมิง – เสือสมิง 4 ขา ลายพาดกลอน
  saming(ctx, P, w, h, anim, i) {
    const step = anim === 'walk' ? [0, 2, 0, -2][i] : 0;
    const pounce = anim === 'attack' ? [[-1, 0], [2, -5], [1, -1]][i] : [0, 0];
    const x = 3 + pounce[0], y = 8 + pounce[1];
    px(ctx, x + 4, y + 4, 24, 10, P.main);                  // ลำตัว
    for (let k = 0; k < 6; k++) px(ctx, x + 7 + k * 3, y + 4, 1, 6, P.dark); // ลาย
    px(ctx, x + 26, y, 10, 10, P.main);                     // หัว
    px(ctx, x + 27, y - 2, 2, 2, P.main); px(ctx, x + 33, y - 2, 2, 2, P.main); // หู
    px(ctx, x + 31, y + 3, 2, 1, '#f4d03f'); px(ctx, x + 34, y + 3, 1, 1, '#f4d03f');
    px(ctx, x + 32, y + 6, 4, 3, P.glow);                   // ปาก
    px(ctx, x + 33, y + 8, 1, 2, WHITE); px(ctx, x + 35, y + 8, 1, 2, WHITE);
    px(ctx, x + 28, y + 1, 1, 3, P.dark); px(ctx, x + 30, y + 1, 1, 2, P.dark);
    const ly = y + 14;
    px(ctx, x + 6 + step, ly, 3, 6, P.main); px(ctx, x + 10 - step, ly, 3, 6, P.main);
    px(ctx, x + 21 - step, ly, 3, 6, P.main); px(ctx, x + 25 + step, ly, 3, 6, P.main);
    for (let k = 0; k < 8; k++) px(ctx, x + 4 - k, y + 4 - Math.round(Math.sin((k + i) / 2) * 2) - (k >> 1), 2, 2, k % 2 ? P.dark : P.main); // หาง
  },

  // 10) ผีห่า – ก้อนหมอกดำมีดวงตาหลายดวง
  phi_ha(ctx, P, w, h, anim, i) {
    const pulse = [0, 1, 2, 1][i % 4] + (anim === 'attack' ? [1, 3, 1][i] : 0);
    const cx = 16, cy = 16;
    for (let r = 13 + pulse; r > 3; r -= 3) {
      ctx.fillStyle = r > 10 ? 'rgba(23,32,42,0.55)' : (r > 6 ? P.main : P.dark);
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    }
    for (let k = 0; k < 6; k++) {                            // หนวดหมอก
      const a = (k / 6) * Math.PI * 2 + i * 0.3;
      px(ctx, cx + Math.cos(a) * (13 + pulse), cy + Math.sin(a) * (11 + pulse), 2, 2, P.glow);
    }
    const eyes = [[10, 12], [19, 10], [14, 18], [22, 17], [8, 19]];
    eyes.forEach(([ex, ey], k) => {
      if ((k + i) % 5 === 0 && anim !== 'attack') return;   // กะพริบ
      px(ctx, ex, ey, 3, 2, '#f4d03f'); px(ctx, ex + 1, ey, 1, 2, '#c0392b');
    });
  },
};

export function drawMonsterFrame(ctx, id, P, w, h, anim, i) {
  DRAW[id](ctx, P, w, h, anim, i);
}
