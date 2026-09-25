// ============================================================
//  SpriteFactory – สร้าง Texture + Animation ทั้งหมดของเกมแบบ Procedural
//  (ไม่ต้องมีไฟล์ภาพ – เปลี่ยนเป็นภาพจริงจาก PixelLab ทีหลังได้)
// ============================================================
import { FW, FH, CHAR_ANIMS, getPose, drawCharacter } from './CharacterArt.js';
import { MONSTER_ANIMS, drawMonsterFrame } from './MonsterArt.js';
import { MONSTERS } from '/shared/data/monsters.js';
import { JOBS } from '/shared/data/classes.js';
import { appearanceKey } from '/shared/data/appearance.js';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { c, ctx };
}
function px(ctx, x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), w, h); }

/**
 * สร้าง spritesheet 1 แถวจาก animation spec แล้วลงทะเบียนเป็น Phaser texture + anims
 * @param drawFrame (ctx, anim, i) => void  วาดเฟรมลงพื้นที่ fw×fh
 * @returns key ของ texture   (animation key = `${key}:${anim}`)
 */
function bakeSheet(scene, key, fw, fh, animSpec, drawFrame) {
  if (scene.textures.exists(key)) return key;
  const total = Object.values(animSpec).reduce((s, a) => s + a.frames, 0);
  const { c, ctx } = makeCanvas(fw * total, fh);
  const layout = [];
  let col = 0;
  for (const [anim, spec] of Object.entries(animSpec)) {
    for (let i = 0; i < spec.frames; i++) {
      ctx.save();
      ctx.translate(col * fw, 0);
      ctx.beginPath(); ctx.rect(0, 0, fw, fh); ctx.clip();
      drawFrame(ctx, anim, i);
      ctx.restore();
      layout.push({ name: `${anim}_${i}`, x: col * fw });
      col++;
    }
  }
  const tex = scene.textures.addCanvas(key, c);
  layout.forEach((f) => tex.add(f.name, 0, f.x, 0, fw, fh));

  for (const [anim, spec] of Object.entries(animSpec)) {
    scene.anims.create({
      key: `${key}:${anim}`,
      frames: Array.from({ length: spec.frames }, (_, i) => ({ key, frame: `${anim}_${i}` })),
      frameRate: spec.rate,
      repeat: spec.repeat,
    });
  }
  return key;
}

// ------------------------------------------------------------
//  ตัวละครผู้เล่น (สร้างตามรูปลักษณ์ที่เลือก + cache ด้วย key)
// ------------------------------------------------------------
export function bakeCharacter(scene, appearance) {
  const key = appearanceKey(appearance);
  const weapon = JOBS[appearance.job].weapon;
  const tmp = makeCanvas(FW, FH);

  return bakeSheet(scene, key, FW, FH, CHAR_ANIMS, (ctx, anim, i) => {
    if (anim !== 'die') {
      drawCharacter(ctx, appearance, getPose(anim, i, weapon));
      return;
    }
    // ท่าตาย: วาดท่ายืนแล้วหมุนล้มไปด้านหลัง
    tmp.ctx.clearRect(0, 0, FW, FH);
    drawCharacter(tmp.ctx, appearance, getPose('die', i, weapon));
    const angle = [-15, -45, -75, -90][i] * Math.PI / 180;
    ctx.save();
    ctx.translate(24, 38);
    ctx.rotate(angle);
    ctx.globalAlpha = i === 3 ? 0.85 : 1;
    ctx.drawImage(tmp.c, -16, -38);
    ctx.restore();
  });
}

// ------------------------------------------------------------
//  มอนสเตอร์
// ------------------------------------------------------------
function bakeMonster(scene, id) {
  const m = MONSTERS[id];
  const { w, h } = m.frame;
  const tmp = makeCanvas(w, h);
  bakeSheet(scene, `mon_${id}`, w, h, MONSTER_ANIMS, (ctx, anim, i) => {
    if (anim !== 'die') return drawMonsterFrame(ctx, id, m.palette, w, h, anim, i);
    tmp.ctx.clearRect(0, 0, w, h);
    drawMonsterFrame(tmp.ctx, id, m.palette, w, h, 'hit', 0);
    const k = 1 - i / 4;                         // จางหาย + ยุบตัว
    ctx.globalAlpha = k;
    ctx.drawImage(tmp.c, 0, 0, w, h, 0, h * (1 - k), w, h * k);
    ctx.globalAlpha = 1;
    for (let s = 0; s < 4 + i * 2; s++) px(ctx, (s * 7 + i * 5) % w, h - 4 - ((s * 5 + i * 6) % (h - 4)), 1, 1, m.palette.glow); // วิญญาณแตกกระจาย
  });
}

// ------------------------------------------------------------
//  NPC แม่ค้า
// ------------------------------------------------------------
function bakeNpc(scene) {
  bakeSheet(scene, 'npc_maekha', 24, 36, { idle: { frames: 2, rate: 2, repeat: -1 } }, (ctx, anim, i) => {
    const b = i;
    px(ctx, 6, 2 + b, 11, 3, '#1c1c1c'); px(ctx, 3, 1 + b, 5, 5, '#1c1c1c');         // มวยผม
    px(ctx, 7, 4 + b, 10, 10, '#d9a37c');                                                  // หน้า
    px(ctx, 12, 8 + b, 1, 1, '#1c1c1c'); px(ctx, 15, 8 + b, 1, 1, '#1c1c1c');
    px(ctx, 12, 11 + b, 3, 1, '#a93226'); px(ctx, 11, 10 + b, 1, 1, '#f1948a');
    px(ctx, 6, 14 + b, 12, 9, '#fdfefe');                                                  // เสื้อคอกระเช้า
    px(ctx, 6, 14 + b, 12, 1, '#f5b7b1');
    px(ctx, 5, 23, 14, 12, '#6c3483');                                                     // ผ้าถุง
    for (let x = 5; x < 19; x += 3) px(ctx, x, 26, 2, 1, '#f4d03f');
    px(ctx, 5, 34, 14, 1, '#4a235a');
    px(ctx, 17, 16 + b, 3, 6, '#d9a37c');                                                  // มือถือพัด
    px(ctx, 18, 12 + b - i, 5, 5, '#e67e22');
  });
}

// ------------------------------------------------------------
//  กระสุน / เอฟเฟกต์
// ------------------------------------------------------------
function bakeProjectiles(scene) {
  let t = makeCanvas(10, 10);
  px(t.ctx, 2, 2, 6, 6, '#e67e22'); px(t.ctx, 3, 3, 4, 4, '#f4d03f'); px(t.ctx, 4, 4, 2, 2, '#fff');
  px(t.ctx, 0, 4, 2, 2, 'rgba(231,76,60,0.7)');
  scene.textures.addCanvas('proj_fireball', t.c);

  t = makeCanvas(14, 3);
  px(t.ctx, 0, 1, 12, 1, '#8b5a2b'); px(t.ctx, 11, 0, 3, 3, '#bdc3c7'); px(t.ctx, 0, 0, 3, 3, '#e74c3c');
  scene.textures.addCanvas('proj_arrow', t.c);

  t = makeCanvas(10, 10);
  px(t.ctx, 1, 1, 8, 8, '#2c3e50'); px(t.ctx, 3, 3, 4, 4, '#95a5a6'); px(t.ctx, 4, 4, 2, 2, '#2c3e50');
  scene.textures.addCanvas('proj_film', t.c);

  t = makeCanvas(12, 12);
  t.ctx.fillStyle = 'rgba(165,105,189,0.6)'; t.ctx.beginPath(); t.ctx.arc(6, 6, 6, 0, 7); t.ctx.fill();
  px(t.ctx, 4, 4, 4, 4, '#4a235a'); px(t.ctx, 5, 5, 1, 1, '#f4d03f');
  scene.textures.addCanvas('proj_miasma', t.c);

  t = makeCanvas(4, 4);
  px(t.ctx, 0, 0, 4, 4, '#ffffff');
  scene.textures.addCanvas('particle', t.c);
}

// ------------------------------------------------------------
//  ฉาก: ท้องฟ้า วัด ต้นไม้ พื้น เรือนไทย ร้านค้า ศาลพระภูมิ
// ------------------------------------------------------------
function bakeEnvironment(scene) {
  // ท้องฟ้ายามพลบค่ำ
  let t = makeCanvas(480, 270);
  const g = t.ctx.createLinearGradient(0, 0, 0, 270);
  g.addColorStop(0, '#1b1036'); g.addColorStop(0.55, '#5b2a5e'); g.addColorStop(0.85, '#d9735b'); g.addColorStop(1, '#f2b66d');
  t.ctx.fillStyle = g; t.ctx.fillRect(0, 0, 480, 270);
  for (let i = 0; i < 70; i++) px(t.ctx, (i * 97) % 480, (i * 53) % 130, 1, 1, i % 4 ? 'rgba(255,255,255,0.6)' : '#fff');
  t.ctx.fillStyle = '#fdf2d0'; t.ctx.beginPath(); t.ctx.arc(380, 55, 20, 0, 7); t.ctx.fill();
  t.ctx.fillStyle = 'rgba(253,242,208,0.15)'; t.ctx.beginPath(); t.ctx.arc(380, 55, 32, 0, 7); t.ctx.fill();
  scene.textures.addCanvas('bg_sky', t.c);

  // ไกล: ภูเขา + วัด (เจดีย์ / ปรางค์) – เงาดำ
  t = makeCanvas(480, 140);
  let ctx = t.ctx;
  ctx.fillStyle = '#3a1f4a';
  ctx.beginPath(); ctx.moveTo(0, 140);
  for (let x = 0; x <= 480; x += 20) ctx.lineTo(x, 80 + Math.sin(x / 45) * 18 + Math.sin(x / 13) * 5);
  ctx.lineTo(480, 140); ctx.fill();
  ctx.fillStyle = '#2a1538';
  const chedi = (cx, base, hgt) => {
    for (let y = 0; y < hgt; y++) {
      const w = Math.max(1, Math.round((1 - y / hgt) ** 1.6 * hgt * 0.45));
      ctx.fillRect(cx - w, base - y, w * 2, 1);
    }
    ctx.fillRect(cx - 1, base - hgt - 8, 2, 8);
  };
  chedi(90, 120, 70); chedi(130, 125, 40); chedi(60, 125, 38);
  // โบสถ์หลังคาซ้อน
  ctx.fillRect(250, 100, 70, 25);
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(240 + k * 6, 102 - k * 10); ctx.lineTo(285, 80 - k * 12); ctx.lineTo(330 - k * 6, 102 - k * 10); ctx.fill(); }
  ctx.fillRect(238, 88, 3, 8); ctx.fillRect(329, 88, 3, 8); // ช่อฟ้า
  chedi(410, 125, 55);
  scene.textures.addCanvas('bg_far', t.c);

  // กลาง: ต้นมะพร้าว ต้นกล้วย
  t = makeCanvas(480, 120); ctx = t.ctx;
  ctx.fillStyle = '#1c0f24';
  const palm = (x, h) => {
    for (let y = 0; y < h; y++) ctx.fillRect(x + Math.round(Math.sin(y / 20) * 3), 120 - y, 3, 1);
    const tx = x + Math.round(Math.sin(h / 20) * 3), ty = 120 - h;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      for (let r = 0; r < 18; r++) ctx.fillRect(tx + Math.cos(a) * r, ty + Math.sin(a) * r * 0.5 + (r * r) / 40, 2, 2);
    }
  };
  const banana = (x) => {
    ctx.fillRect(x, 90, 4, 30);
    for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.ellipse(x + 2 + k * 7, 86 - Math.abs(k) * -3, 9, 3, k * 0.5, 0, 7); ctx.fill(); }
  };
  palm(40, 95); palm(160, 80); banana(100); palm(300, 100); banana(240); banana(380); palm(440, 85);
  ctx.fillRect(0, 112, 480, 8);
  scene.textures.addCanvas('bg_mid', t.c);

  // พื้นหญ้า
  t = makeCanvas(16, 16); ctx = t.ctx;
  px(ctx, 0, 0, 16, 16, '#6e4b2a');
  for (let i = 0; i < 10; i++) px(ctx, (i * 7) % 16, 5 + (i * 5) % 11, 2, 1, '#5a3c20');
  px(ctx, 0, 0, 16, 4, '#4f8a3a'); px(ctx, 0, 4, 16, 1, '#3b6b2b');
  for (let i = 0; i < 6; i++) px(ctx, i * 3, 0, 1, 1, '#7dbb5b');
  scene.textures.addCanvas('tile_ground', t.c);

  // ดินชั้นล่าง (ไม่มีหญ้า)
  t = makeCanvas(16, 16); ctx = t.ctx;
  px(ctx, 0, 0, 16, 16, '#5a3c20');
  for (let i = 0; i < 9; i++) px(ctx, (i * 5) % 16, (i * 7) % 16, 2, 1, '#4a311a');
  scene.textures.addCanvas('tile_dirt', t.c);

  // แพลตฟอร์มไม้
  t = makeCanvas(16, 8); ctx = t.ctx;
  px(ctx, 0, 0, 16, 8, '#8b5a2b'); px(ctx, 0, 0, 16, 2, '#b07a45'); px(ctx, 0, 7, 16, 1, '#5b3a1b'); px(ctx, 7, 2, 1, 5, '#6e4520');
  scene.textures.addCanvas('tile_plank', t.c);

  // เรือนไทยใต้ถุนสูง
  t = makeCanvas(96, 84); ctx = t.ctx;
  for (const x of [10, 30, 62, 84]) px(ctx, x, 50, 4, 34, '#5b3a1b');        // เสาใต้ถุน
  px(ctx, 6, 46, 84, 5, '#7b4a1e');                                           // พื้นเรือน
  px(ctx, 12, 26, 72, 20, '#a0673a');                                          // ฝา
  for (let x = 14; x < 82; x += 6) px(ctx, x, 26, 1, 20, '#7b4a1e');
  px(ctx, 40, 32, 14, 14, '#3e2410'); px(ctx, 20, 31, 10, 8, '#f5cba7'); px(ctx, 66, 31, 10, 8, '#f5cba7'); // ประตู หน้าต่างมีไฟ
  ctx.fillStyle = '#7b241c';                                                   // หลังคาจั่วสูง
  ctx.beginPath(); ctx.moveTo(2, 28); ctx.lineTo(48, 2); ctx.lineTo(94, 28); ctx.fill();
  ctx.fillStyle = '#922b21';
  ctx.beginPath(); ctx.moveTo(18, 24); ctx.lineTo(48, 8); ctx.lineTo(78, 24); ctx.fill();
  px(ctx, 0, 22, 4, 7, '#d4af37'); px(ctx, 92, 22, 4, 7, '#d4af37'); px(ctx, 46, 0, 4, 4, '#d4af37'); // ปั้นลม/ช่อฟ้า
  px(ctx, 60, 46, 4, 38, '#6e4520');                                          // บันได
  for (let y = 52; y < 84; y += 6) px(ctx, 56, y, 12, 1, '#6e4520');
  scene.textures.addCanvas('house', t.c);

  // แผงร้านค้า
  t = makeCanvas(64, 56); ctx = t.ctx;
  for (let x = 0; x < 64; x += 8) px(ctx, x, 0, 8, 12, (x / 8) % 2 ? '#fdfefe' : '#c0392b');
  for (let x = 0; x < 64; x += 8) px(ctx, x + 2, 12, 4, 2, (x / 8) % 2 ? '#fdfefe' : '#c0392b');
  px(ctx, 3, 12, 3, 44, '#5b3a1b'); px(ctx, 58, 12, 3, 44, '#5b3a1b');
  px(ctx, 0, 36, 64, 6, '#8b5a2b'); px(ctx, 2, 42, 60, 14, '#6e4520');
  const goods = ['#e74c3c', '#27ae60', '#f1c40f', '#8e44ad', '#3498db', '#e67e22'];
  goods.forEach((c, k) => { px(ctx, 6 + k * 9, 30, 6, 6, c); px(ctx, 7 + k * 9, 31, 2, 2, '#fff'); });
  scene.textures.addCanvas('stall', t.c);

  // ศาลพระภูมิ (จุดเกิดใหม่)
  t = makeCanvas(24, 44); ctx = t.ctx;
  px(ctx, 10, 20, 4, 24, '#ecf0f1');
  px(ctx, 3, 18, 18, 3, '#d4af37');
  px(ctx, 5, 8, 14, 10, '#f5f5f5'); px(ctx, 10, 11, 4, 7, '#c0392b');
  ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.moveTo(2, 9); ctx.lineTo(12, 0); ctx.lineTo(22, 9); ctx.fill();
  px(ctx, 11, 0, 2, 2, '#d4af37');
  px(ctx, 1, 20, 3, 3, '#f39c12'); px(ctx, 20, 20, 3, 3, '#f39c12'); // พวงมาลัย
  scene.textures.addCanvas('spirit_house', t.c);

  // ป้ายเขตผีดุ
  t = makeCanvas(28, 30); ctx = t.ctx;
  px(ctx, 12, 12, 4, 18, '#5b3a1b');
  px(ctx, 0, 0, 28, 14, '#8b5a2b'); px(ctx, 1, 1, 26, 12, '#a0673a');
  px(ctx, 5, 3, 3, 3, '#1c1c1c'); px(ctx, 5, 7, 3, 3, '#1c1c1c'); px(ctx, 12, 4, 10, 2, '#c0392b'); px(ctx, 12, 8, 10, 2, '#c0392b'); // "ผี"
  scene.textures.addCanvas('sign', t.c);

  // ตะเกียง / โคมไฟ
  t = makeCanvas(8, 30); ctx = t.ctx;
  px(ctx, 3, 8, 2, 22, '#4d3319'); px(ctx, 1, 2, 6, 7, '#f39c12'); px(ctx, 2, 3, 4, 5, '#fdebd0'); px(ctx, 0, 1, 8, 1, '#7b241c');
  scene.textures.addCanvas('lantern', t.c);
}

/** เรียกครั้งเดียวใน BootScene */
export function generateAll(scene) {
  bakeEnvironment(scene);
  bakeProjectiles(scene);
  bakeNpc(scene);
  Object.keys(MONSTERS).forEach((id) => bakeMonster(scene, id));
}
