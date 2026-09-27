// ============================================================
//  มอนสเตอร์ผีไทย 20 ชนิด
//  behavior: walker (เดินไล่) | flyer (ลอยไล่) | jumper (กระโดด) | ranged (ยิงระยะไกล)
//  zone: ช่วงแกน X ที่เกิด (ยิ่งไกลหมู่บ้านยิ่งเก่ง)
// ============================================================
export const MONSTERS = {
  phi_tuay_kaew: {
    nameTh: 'หุ่นไล่กาผีสิง', nameEn: 'Haunted Scarecrow', level: 1,
    desc: 'หุ่นไล่กากลางนาที่วิญญาณเร่ร่อนเข้าสิง ถือเคียวสนิมเดินโซเซไล่ฟันคน',
    hp: 40, atk: 6, def: 0, eva: 3, acc: 85, speed: 40, behavior: 'flyer',
    attackRange: 18, attackCooldown: 1400, exp: 8, gold: [2, 6],
    frame: { w: 24, h: 24 }, zone: [1400, 1750],
    palette: { main: '#d4ac6e', dark: '#7e5109', glow: '#ff6b5b' },
    drops: [{ item: 'glass_shard', chance: 0.5 }, { item: 'hp_s', chance: 0.15 }],
  },
  kuman_thong: {
    nameTh: 'กุมารทอง', nameEn: 'Kuman Thong', level: 2,
    desc: 'ดวงวิญญาณเด็กตัวทอง ซุกซน กระโดดเร็ว',
    hp: 55, atk: 8, def: 1, eva: 8, acc: 90, speed: 70, behavior: 'jumper',
    attackRange: 16, attackCooldown: 1000, exp: 12, gold: [4, 9],
    frame: { w: 24, h: 26 }, zone: [1450, 1850],
    palette: { main: '#f4d03f', dark: '#b7950b', glow: '#fcf3cf' },
    drops: [{ item: 'gold_leaf', chance: 0.4 }, { item: 'hp_s', chance: 0.2 }],
  },
  krasue: {
    nameTh: 'กระสือ', nameEn: 'Krasue', level: 3, nightOnly: true,   // ออกเฉพาะกลางคืน
    desc: 'หัวผู้หญิงลอยได้พร้อมไส้ห้อย เรืองแสงสีเขียวยามค่ำคืน',
    hp: 70, atk: 11, def: 1, eva: 10, acc: 90, speed: 55, behavior: 'flyer',
    attackRange: 20, attackCooldown: 1200, exp: 18, gold: [6, 12],
    frame: { w: 24, h: 34 }, zone: [1380, 1980],
    palette: { main: '#f0d9c0', dark: '#1a1a1a', glow: '#58d68d' },
    drops: [{ item: 'krasue_hair', chance: 0.4 }, { item: 'mp_s', chance: 0.2 }],
  },
  nang_tani: {
    nameTh: 'ผีนางตานี', nameEn: 'Nang Tani', level: 4,
    desc: 'หญิงสาวชุดเขียวสิงต้นกล้วยตานี ออกมายามเดือนเพ็ญ',
    hp: 95, atk: 13, def: 2, eva: 6, acc: 92, speed: 45, behavior: 'walker',
    attackRange: 20, attackCooldown: 1100, exp: 24, gold: [8, 15],
    frame: { w: 24, h: 40 }, zone: [1580, 2180],
    palette: { main: '#27ae60', dark: '#145a32', glow: '#f5eee6' },
    drops: [{ item: 'banana_leaf', chance: 0.5 }, { item: 'hp_s', chance: 0.25 }],
  },
  phi_pob: {
    nameTh: 'ผีปอบ', nameEn: 'Phi Pob', level: 5,
    desc: 'ผีหิวโหยที่สิงร่างคน เดินหลังค่อม ตาแดงก่ำ',
    hp: 130, atk: 16, def: 4, eva: 4, acc: 92, speed: 50, behavior: 'walker',
    attackRange: 20, attackCooldown: 1000, exp: 32, gold: [10, 20],
    frame: { w: 26, h: 36 }, zone: [1880, 2480],
    palette: { main: '#7d6e5d', dark: '#3e342a', glow: '#e74c3c' },
    drops: [{ item: 'rotten_cloth', chance: 0.5 }, { item: 'hp_m', chance: 0.1 }],
  },
  phi_jang_nang: {
    nameTh: 'ผีจ้างหนัง', nameEn: 'Film Ghost', level: 6,
    desc: 'ผีที่มาจ้างหนังกลางแปลงฉายให้ผีดู ขว้างม้วนฟิล์มจากระยะไกล',
    hp: 120, atk: 18, def: 3, eva: 8, acc: 95, speed: 40, behavior: 'ranged',
    attackRange: 150, attackCooldown: 1800, exp: 40, gold: [14, 26],
    frame: { w: 24, h: 38 }, zone: [2180, 2780],
    palette: { main: '#f8f9f9', dark: '#566573', glow: '#f7dc6f' },
    projectile: 'film',
    drops: [{ item: 'film_reel', chance: 0.4 }, { item: 'mp_m', chance: 0.1 }],
  },
  phi_phrai: {
    nameTh: 'ผีพราย', nameEn: 'Phi Phrai', level: 17,
    desc: 'ผีน้ำสาวผมยาว ลอยขึ้นจากบึง ตัวเปียกชื้นสีฟ้าซีด',
    hp: 600, atk: 54, def: 9, eva: 18, acc: 108, speed: 55, behavior: 'flyer',
    attackRange: 22, attackCooldown: 1100, exp: 255, gold: [65, 125],
    frame: { w: 24, h: 40 }, zone: [2480, 3080],
    palette: { main: '#aed6f1', dark: '#1b4f72', glow: '#d6eaf8' },
    drops: [{ item: 'water_lily', chance: 0.4 }, { item: 'hp_m', chance: 0.15 }],
  },
  pret: {
    nameTh: 'เปรต', nameEn: 'Pret', level: 8,
    desc: 'ร่างสูงเท่าต้นตาล ผอมแห้ง ปากเท่ารูเข็ม เดินช้าแต่ถึกมาก',
    hp: 260, atk: 24, def: 8, eva: 2, acc: 90, speed: 30, behavior: 'walker',
    attackRange: 30, attackCooldown: 1600, exp: 70, gold: [20, 40],
    frame: { w: 28, h: 64 }, zone: [2680, 3280],
    palette: { main: '#a9a9a9', dark: '#4d4d4d', glow: '#f2f3f4' },
    drops: [{ item: 'pret_bone', chance: 0.5 }, { item: 'hp_m', chance: 0.2 }],
  },
  saming: {
    nameTh: 'ผีสมิง', nameEn: 'Saming', level: 9,
    desc: 'เสือสมิงแปลงกายจากหมอผี ว่องไวและดุร้าย',
    hp: 220, atk: 28, def: 6, eva: 16, acc: 100, speed: 90, behavior: 'walker',
    attackRange: 24, attackCooldown: 850, exp: 85, gold: [25, 50],
    frame: { w: 40, h: 28 }, zone: [2880, 3480],
    palette: { main: '#e67e22', dark: '#1c1c1c', glow: '#f9e79f' },
    drops: [{ item: 'saming_fang', chance: 0.4 }, { item: 'hp_m', chance: 0.2 }],
  },
  phi_ha: {
    nameTh: 'ผีห่า', nameEn: 'Phi Ha (Plague Spirit)', level: 10,
    desc: 'ผีโรคระบาดมาเป็นกลุ่มหมอกดำ ปล่อยลูกหมอกพิษระยะไกล',
    hp: 320, atk: 30, def: 7, eva: 10, acc: 100, speed: 45, behavior: 'ranged',
    attackRange: 170, attackCooldown: 1500, exp: 110, gold: [35, 70],
    frame: { w: 32, h: 32 }, zone: [3080, 3530],
    palette: { main: '#4a235a', dark: '#17202a', glow: '#a569bd' },
    projectile: 'miasma',
    drops: [{ item: 'dark_mist', chance: 0.5 }, { item: 'mp_m', chance: 0.2 }],
  },
  // ---------------- ป่าช้าผีตายโหง (X 3650–4950) : Lv.11–18 ----------------
  krahang: {
    nameTh: 'ผีกระหัง', nameEn: 'Krahang', level: 11,
    desc: 'ชายนุ่งผ้าเตี่ยว ใช้กระด้งเป็นปีก สากตำข้าวเป็นหาง บินโฉบยามค่ำ',
    hp: 300, atk: 31, def: 5, eva: 14, acc: 100, speed: 65, behavior: 'flyer',
    attackRange: 20, attackCooldown: 1100, exp: 120, gold: [35, 70],
    frame: { w: 32, h: 32 }, zone: [3650, 4200],
    drops: [{ item: 'rice_basket', chance: 0.45 }, { item: 'hp_m', chance: 0.15 }],
  },
  khamot: {
    nameTh: 'ผีโขมด', nameEn: 'Khamot (Will-o\'-wisp)', level: 15,
    desc: 'ดวงไฟผีลอยวูบวาบกลางบึง ล่อคนหลงทาง ว่องไวหลบเก่ง',
    hp: 420, atk: 44, def: 5, eva: 28, acc: 108, speed: 80, behavior: 'flyer',
    attackRange: 18, attackCooldown: 900, exp: 190, gold: [50, 100],
    frame: { w: 24, h: 24 }, zone: [3650, 4300],
    drops: [{ item: 'wisp_ember', chance: 0.5 }, { item: 'mp_m', chance: 0.15 }],
  },
  phi_dip: {
    nameTh: 'ผีดิบ', nameEn: 'Phi Dip (Zombie)', level: 12,
    desc: 'ศพที่ลุกขึ้นจากหลุมดิน เดินช้าแต่ถึกและตีหนัก',
    hp: 420, atk: 33, def: 10, eva: 2, acc: 95, speed: 28, behavior: 'walker',
    attackRange: 20, attackCooldown: 1500, exp: 140, gold: [40, 80],
    frame: { w: 28, h: 40 }, zone: [3700, 4400],
    drops: [{ item: 'grave_soil', chance: 0.5 }, { item: 'hp_m', chance: 0.2 }],
  },
  nang_takhian: {
    nameTh: 'นางตะเคียน', nameEn: 'Nang Takhian', level: 16,
    desc: 'วิญญาณหญิงสิงต้นตะเคียน สวมเกราะไม้ ยิงหนามไม้จากระยะไกล',
    hp: 560, atk: 50, def: 11, eva: 8, acc: 100, speed: 35, behavior: 'ranged',
    attackRange: 160, attackCooldown: 1600, exp: 230, gold: [60, 115],
    frame: { w: 28, h: 44 }, zone: [3800, 4500], projectile: 'miasma',
    drops: [{ item: 'takhian_wood', chance: 0.45 }, { item: 'mp_m', chance: 0.2 }],
  },
  tai_hong: {
    nameTh: 'ผีตายโหง', nameEn: 'Tai Hong', level: 13,
    desc: 'วิญญาณแค้นที่ตายร้าย ร่างโชกเลือด ออร่าแดงฉาน พุ่งเข้าใส่ไม่ยั้ง',
    hp: 380, atk: 40, def: 6, eva: 10, acc: 105, speed: 70, behavior: 'walker',
    attackRange: 22, attackCooldown: 900, exp: 160, gold: [45, 90],
    frame: { w: 28, h: 42 }, zone: [3900, 4600],
    drops: [{ item: 'blood_cloth', chance: 0.45 }, { item: 'hp_m', chance: 0.2 }],
  },
  phi_phong: {
    nameTh: 'ผีโพง', nameEn: 'Phi Phong', level: 13,
    desc: 'ผีป่าจมูกเรืองแสง ออกหากินของดิบยามดึก',
    hp: 400, atk: 38, def: 7, eva: 12, acc: 100, speed: 60, behavior: 'walker', nightOnly: true,
    attackRange: 22, attackCooldown: 1000, exp: 165, gold: [45, 90],
    frame: { w: 30, h: 40 }, zone: [4000, 4700],
    drops: [{ item: 'phong_glow', chance: 0.45 }, { item: 'hp_m', chance: 0.2 }],
  },
  kong_koi: {
    nameTh: 'ผีกองกอย', nameEn: 'Kong Koi', level: 14,
    desc: 'ผีป่าขาเดียว กระโดดดึ๋งๆ ไล่ล่าเร็วมาก',
    hp: 380, atk: 42, def: 7, eva: 20, acc: 105, speed: 85, behavior: 'jumper',
    attackRange: 20, attackCooldown: 950, exp: 180, gold: [50, 95],
    frame: { w: 26, h: 34 }, zone: [4100, 4800],
    drops: [{ item: 'kongkoi_hair', chance: 0.45 }, { item: 'hp_m', chance: 0.2 }],
  },
  phi_lang_kluang: {
    nameTh: 'ผีหลังกลวง', nameEn: 'Hollow-back Ghost', level: 14,
    desc: 'ผีหญิงงามด้านหน้า แต่หลังกลวงเห็นซี่โครง ร่ายคำสาปจากไกล',
    hp: 440, atk: 42, def: 8, eva: 10, acc: 105, speed: 50, behavior: 'ranged',
    attackRange: 150, attackCooldown: 1500, exp: 185, gold: [50, 100],
    frame: { w: 28, h: 44 }, zone: [4200, 4850], projectile: 'film',
    drops: [{ item: 'rib_bone', chance: 0.45 }, { item: 'mp_m', chance: 0.2 }],
  },
  phi_chamot: {
    nameTh: 'ผีจะมอด', nameEn: 'Phi Chamot', level: 18,
    desc: 'วิญญาณสัตว์เลื้อยคลานแห่งพงไพร คลานหมอบในความมืดแล้วจู่โจม',
    hp: 700, atk: 58, def: 12, eva: 14, acc: 105, speed: 80, behavior: 'walker',
    attackRange: 26, attackCooldown: 900, exp: 290, gold: [70, 135],
    frame: { w: 44, h: 26 }, zone: [4300, 4900],
    drops: [{ item: 'chamot_scale', chance: 0.45 }, { item: 'hp_m', chance: 0.25 }],
  },
  pret_asura: {
    nameTh: 'เปรตอสุรกาย', nameEn: 'Pret Asura', level: 17, boss: true, count: 1, scale: 1.7, respawnMs: 1200000,
    desc: 'จอมเปรตยักษ์ตาแดงเขาดำ เจ้าแห่งป่าช้าวัดร้าง (บอสประจำโซน)',
    hp: 14000, atk: 62, def: 16, eva: 4, acc: 115, speed: 34, behavior: 'walker',
    attackRange: 44, attackCooldown: 1600, exp: 3500, gold: [800, 1500],
    aoe: { cd: 7000, r: 90, mult: 1.4, nameTh: 'ไฟนรกภูมิ' },
    frame: { w: 40, h: 80 }, zone: [4600, 4900],
    drops: [{ item: 'asura_horn', chance: 0.6 }, { item: 'hp_m', chance: 0.5 }, { item: 'takrut', chance: 0.5 }, { item: 'yant_guard', chance: 0.3 }, { item: 'flask_hp5', chance: 0.2 }, { item: 'flask_mp5', chance: 0.15 }],
  },
  // ---------------- บอสประจำโซน (เกิดทุก 20 นาที · ประกาศทั้งเซิร์ฟ · ทุกคนที่ช่วยตี ≥5% ได้รางวัล) ----------------
  mae_nak: {
    nameTh: 'แม่นาคพระโขนง', nameEn: 'Mae Nak', level: 8, boss: true, count: 1, scale: 1.6, respawnMs: 1200000,
    desc: 'ผีแม่ลูกอ่อนผู้รอคอยสามี แขนยืดยาวเก็บมะนาวใต้ถุนเรือน บอสทุ่งนาบางปะอิน',
    hp: 3500, atk: 30, def: 6, eva: 6, acc: 100, speed: 45, behavior: 'walker',
    attackRange: 40, attackCooldown: 1400, exp: 600, gold: [300, 600],
    aoe: { cd: 7500, r: 75, mult: 1.3, nameTh: 'แขนยาวแม่นาค' },
    frame: { w: 30, h: 48 },
    palette: { main: '#d6eaf8', dark: '#1b2631', glow: '#85c1e9' },
    drops: [{ item: 'banana_leaf', chance: 1 }, { item: 'hp_m', chance: 1 }, { item: 'amulet_somdej', chance: 0.25 }],
  },
  pu_som: {
    nameTh: 'ปู่โสมเฝ้าทรัพย์', nameEn: 'Pu Som', level: 13, boss: true, count: 1, scale: 1.6, respawnMs: 1200000,
    desc: 'วิญญาณผู้เฝ้าขุมทรัพย์ใต้กอไผ่ ใครล่วงล้ำจะถูกคำสาป แต่ใครชนะจะได้ทองติดมือ',
    hp: 8000, atk: 45, def: 12, eva: 6, acc: 108, speed: 36, behavior: 'walker',
    attackRange: 40, attackCooldown: 1500, exp: 1800, gold: [1500, 3000],
    aoe: { cd: 7000, r: 80, mult: 1.35, nameTh: 'คำสาปขุมทรัพย์' },
    frame: { w: 32, h: 46 },
    palette: { main: '#f7dc6f', dark: '#7e5109', glow: '#fcf3cf' },
    drops: [{ item: 'saming_fang', chance: 1 }, { item: 'hp_m', chance: 1 }, { item: 'kuman_statue', chance: 0.2 }, { item: 'yant_guard', chance: 0.2 }, { item: 'flask_mp5', chance: 0.15 }],
  },
  chalawan: {
    nameTh: 'พญาชาละวัน', nameEn: 'Chalawan', level: 21, boss: true, count: 1, scale: 1.8, respawnMs: 1200000,
    desc: 'พญาจระเข้เจ้าแห่งบึงผีพราย สวมมงกุฎทอง ถือตรีศูล ฟาดหางทีเดียวน้ำกระจาย',
    hp: 24000, atk: 78, def: 20, eva: 6, acc: 120, speed: 38, behavior: 'walker',
    attackRange: 46, attackCooldown: 1500, exp: 6000, gold: [1200, 2400],
    aoe: { cd: 6500, r: 100, mult: 1.5, nameTh: 'ฟาดหางพญาจระเข้' },
    frame: { w: 40, h: 56 },
    palette: { main: '#52be80', dark: '#145a32', glow: '#f7dc6f' },
    drops: [{ item: 'chamot_scale', chance: 1 }, { item: 'hp_m', chance: 1 }, { item: 'naga_statue', chance: 0.25 }, { item: 'yant_guard', chance: 0.4 }, { item: 'flask_hp6', chance: 0.2 }, { item: 'flask_mp6', chance: 0.2 }],
  },
};

export const MONSTER_IDS = Object.keys(MONSTERS);

// ------------------------------------------------------------
//  เลเวลในโลกอยุธยา (top-down) ตามโซน → ปรับค่าพลัง/รางวัลตามอัตราส่วนเลเวล (ครั้งเดียว · ใช้ร่วม client/server)
//  ทุ่งนา Lv.1–8 · ป่าไผ่ Lv.7–15 · ป่าช้าวัดร้าง Lv.14–23 · บึงผีพราย Lv.21–30  (ตั้ง _scaled กัน maps.js ของโลกเดิมปรับซ้ำ)
// ------------------------------------------------------------
export const TD_LEVELS = {
  phi_tuay_kaew: 1, kuman_thong: 2, krasue: 4, nang_tani: 5, mae_nak: 8,
  phi_pob: 7, phi_jang_nang: 8, pret: 10, saming: 12, pu_som: 15,
  phi_ha: 14, phi_dip: 16, tai_hong: 18, phi_lang_kluang: 20, pret_asura: 23,
  khamot: 21, nang_takhian: 23, phi_phrai: 25, phi_chamot: 27, chalawan: 30,
};
for (const [id, L] of Object.entries(TD_LEVELS)) {
  const m = MONSTERS[id];
  if (!m || m._scaled) continue;
  const L0 = m.level, k = L / L0;
  Object.assign(m, {
    level: L, _scaled: true,
    hp: Math.round(m.hp * k ** 1.35), atk: Math.round(m.atk * k ** 1.15), def: Math.round(m.def * k),
    acc: Math.round(m.acc + (L - L0) * 0.6), exp: Math.round(m.exp * k ** 1.55),
    gold: m.gold.map((g) => Math.round(g * k ** 1.2)),
  });
}

// ------------------------------------------------------------
//  ผีแมพต่างแดน (Lv.30–99) · 3 แมพ × 4 แหล่งผี + บอส 1
//  ค่าพลังคิดจากสูตรเลเวล (ต่อเนื่องจากบึงผีพราย Lv.27) · EXP ≈ ต้องฆ่า 18→45 ตัว/เลเวล
//  ภาพ: d8 = ใช้สไปรต์ 8 ทิศของผีเดิม + tint ย้อมสี (รอภาพจริงจาก PixelLab)
// ------------------------------------------------------------
const xpNeed = (L) => Math.floor(40 * Math.pow(L, 1.6));      // = expToNext (stats.js) · ไม่ import เพื่อกันวงจร
function realmMob(L, o) {
  const boss = !!o.boss;
  const base = {
    level: L, _scaled: true, realm: true,
    hp: Math.round(46 * L * (1 + (L - 30) / 150) * (o.hpK || 1)), atk: Math.round(3.3 * L * (o.atkK || 1)), def: Math.round(0.6 * L), eva: Math.round(8 + L * 0.15 + (o.evaK || 0)),
    acc: Math.round(100 + L * 0.5), speed: 55, behavior: 'walker', attackRange: 22, attackCooldown: 1100,
    exp: Math.round(xpNeed(L) / (18 + (L - 30) * 0.4)), gold: [L * 4, L * 8],
    frame: { w: 32, h: 44 },
  };
  if (boss) Object.assign(base, {
    boss: true, count: 1, scale: o.scale || 1.9, respawnMs: 1200000, attackRange: 46, attackCooldown: 1500, speed: 38,
    hp: Math.round(base.hp * 32), atk: Math.round(base.atk * 1.35), def: Math.round(base.def * 1.5),
    exp: Math.round(xpNeed(L) * 0.9), gold: [L * 60, L * 120],
  });
  return { ...base, ...o, level: L, drops: [...(o.drops || []), { item: 'black_iron', chance: boss ? 1 : 0.06 }] };   // แร่เหล็กไหลสำหรับหลอมของขั้นสูง
}
Object.assign(MONSTERS, {
  // ===== ป่าหิมพานต์ Lv.30–50 =====
  kumphan: realmMob(32, { nameTh: 'ยักษ์กุมภัณฑ์', nameEn: 'Kumphan Giant', desc: 'ยักษ์ผิวคล้ำเฝ้าชายป่าหิมพานต์ ถือกระบองหินฟาดทีเดียวดินสะเทือน', d8: 'pret_asura', tint: 0x7fb3ff, scale: 0.85, hpK: 1.2, speed: 45, drops: [{ item: 'himma_fur', chance: 0.4 }, { item: 'hp_m', chance: 0.25 }] }),
  khotchasi: realmMob(37, { nameTh: 'คชสีห์คลั่ง', nameEn: 'Mad Khotchasi', desc: 'สัตว์หิมพานต์ร่างสิงห์หัวช้าง คลั่งเพราะถูกคำสาปของกุมภกรรณ', d8: 'saming', tint: 0xf8d568, scale: 1.15, speed: 70, attackCooldown: 950, drops: [{ item: 'himma_fur', chance: 0.45 }, { item: 'flask_hp7', chance: 0.004 }] }),
  hatsadiling: realmMob(42, { nameTh: 'นกหัสดีลิงค์', nameEn: 'Hatsadiling Bird', desc: 'นกยักษ์หัวช้างงวงยาว บินวนแล้วพ่นลมพายุจากระยะไกล', d8: 'phi_ha', tint: 0xffc46b, behavior: 'ranged', projectile: 'film', attackRange: 150, attackCooldown: 1600, hpK: 0.85, evaK: 6, drops: [{ item: 'himma_feather', chance: 0.4 }, { item: 'mp_m', chance: 0.25 }] }),
  makkaliphon: realmMob(46, { nameTh: 'มักกะลีผลพราย', nameEn: 'Makkaliphon Wraith', desc: 'นารีผลที่หล่นจากต้นแล้วกลายเป็นผี ร่ายมนต์หลงเสน่ห์จากกิ่งไม้', d8: 'nang_tani', tint: 0xff9ad5, behavior: 'ranged', projectile: 'film', attackRange: 140, attackCooldown: 1500, hpK: 0.9, drops: [{ item: 'makka_fruit', chance: 0.35 }, { item: 'flask_mp7', chance: 0.004 }] }),
  kumphakan: realmMob(50, { nameTh: 'กุมภกรรณ', nameEn: 'Kumphakan', boss: true, desc: 'ยักษ์ผู้หลับพันปีใต้เขาหิมพานต์ ตื่นขึ้นมาพร้อมหอกโมกขศักดิ์ (บอสป่าหิมพานต์)', d8: 'pu_som', tint: 0x6f8ff5, scale: 1.95, aoe: { cd: 6500, r: 110, mult: 1.5, nameTh: 'หอกโมกขศักดิ์' }, drops: [{ item: 'giant_tusk', chance: 1 }, { item: 'flask_hp7', chance: 0.25 }, { item: 'flask_mp7', chance: 0.2 }, { item: 'yant_guard', chance: 0.4 }] }),
  // ===== เมืองบาดาลนาคพิภพ Lv.50–75 =====
  nak_phrai: realmMob(52, { nameTh: 'นาคพราย', nameEn: 'Naga Wraith', desc: 'นาคที่ตายแล้ววิญญาณไม่ไปไหน เลื้อยวนตามซากเจดีย์ใต้บาดาล', d8: 'phi_chamot', tint: 0x66e0ff, frame: { w: 44, h: 26 }, speed: 75, drops: [{ item: 'naga_scale', chance: 0.4 }, { item: 'flask_hp8', chance: 0.004 }] }),
  ngueak_phi: realmMob(57, { nameTh: 'เงือกผี', nameEn: 'Ghost Mermaid', desc: 'เงือกสาวผมยาวที่ร้องเพลงล่อคนลงน้ำ ปาไข่มุกคำสาปจากไกล', d8: 'phi_phrai', tint: 0x7fffd4, behavior: 'ranged', projectile: 'film', attackRange: 150, attackCooldown: 1500, hpK: 0.9, drops: [{ item: 'pearl_ghost', chance: 0.35 }, { item: 'mp_m', chance: 0.3 }] }),
  pla_khiao: realmMob(62, { nameTh: 'ปลาผีเขี้ยวแก้ว', nameEn: 'Glassfang Fish', desc: 'ปลาผีเรืองแสงว่ายกลางอากาศใต้บาดาล ฝูงใหญ่ กัดเร็วมาก', d8: 'khamot', tint: 0x9fe8ff, behavior: 'flyer', speed: 85, attackCooldown: 850, hpK: 0.8, evaK: 8, drops: [{ item: 'naga_scale', chance: 0.35 }, { item: 'flask_mp8', chance: 0.004 }] }),
  tahan_nak: realmMob(68, { nameTh: 'ทหารนาคเกล็ดเงิน', nameEn: 'Silver-scale Naga Guard', elite: true, desc: 'ทหารองครักษ์ของพญานาค สวมเกราะเกล็ดเงิน ถือทวนสามง่าม', d8: 'saming', tint: 0x9fb8ff, scale: 1.2, hpK: 1.35, atkK: 1.1, drops: [{ item: 'naga_scale', chance: 0.5 }, { item: 'flask_hp9', chance: 0.003 }] }),
  anantanak: realmMob(75, { nameTh: 'พญาอนันตนาคราช', nameEn: 'Ananta Nagaraja', boss: true, desc: 'ราชาแห่งนาคพิภพ เจ็ดเศียรเกล็ดมรกต ฟาดหางทีเดียวบาดาลสั่น (บอสเมืองบาดาล)', d8: 'chalawan', tint: 0x5dade2, scale: 2.05, aoe: { cd: 6000, r: 120, mult: 1.55, nameTh: 'เจ็ดเศียรพ่นพิษ' }, drops: [{ item: 'naga_gem', chance: 1 }, { item: 'flask_hp9', chance: 0.25 }, { item: 'flask_mp9', chance: 0.2 }, { item: 'naga_statue', chance: 0.4 }] }),
  // ===== นรกภูมิ Lv.75–99 =====
  niraiyaban: realmMob(78, { nameTh: 'นายนิรยบาล', nameEn: 'Hell Warden', desc: 'ผู้คุมนรกร่างยักษ์ ถือหอกเหล็กเผาไฟ ลากวิญญาณบาปไปลงกระทะทองแดง', d8: 'pret_asura', tint: 0xff6a4d, scale: 0.9, hpK: 1.2, speed: 48, drops: [{ item: 'hell_ember', chance: 0.4 }, { item: 'flask_hp10', chance: 0.003 }] }),
  pret_khem: realmMob(84, { nameTh: 'เปรตปากเข็ม', nameEn: 'Needle-mouth Preta', desc: 'เปรตตัวสูงเท่าต้นตาล ปากเท่ารูเข็ม หิวโหยชั่วกัลป์ ดูดพลังชีวิตคนเป็น', d8: 'pret', tint: 0xc39bd3, scale: 1.1, hpK: 1.05, drops: [{ item: 'hell_ember', chance: 0.4 }, { item: 'mp_m', chance: 0.3 }] }),
  phi_ton_ngiw: realmMob(89, { nameTh: 'ผีต้นงิ้ว', nameEn: 'Ngiw Thorn Spirit', desc: 'วิญญาณคนผิดศีลที่ถูกลงโทษให้ปีนต้นงิ้วหนามเหล็ก กลายเป็นส่วนหนึ่งของต้นไม้', d8: 'nang_takhian', tint: 0xc0392b, hpK: 1.15, atkK: 1.05, drops: [{ item: 'ngiw_thorn', chance: 0.4 }, { item: 'flask_mp10', chance: 0.003 }] }),
  yommathut: realmMob(94, { nameTh: 'ยมทูตเงา', nameEn: 'Shadow Yamaduta', elite: true, desc: 'ทูตแห่งพญายม มาในเงามืด ขว้างบ่วงบาศคล้องวิญญาณจากระยะไกล', d8: 'tai_hong', tint: 0x6c7a89, behavior: 'ranged', projectile: 'film', attackRange: 160, attackCooldown: 1400, hpK: 1.0, atkK: 1.1, drops: [{ item: 'ngiw_thorn', chance: 0.4 }, { item: 'flask_hp10', chance: 0.004 }] }),
  phaya_yom: realmMob(99, { nameTh: 'พญายมราช', nameEn: 'Phaya Yom', boss: true, desc: 'เจ้าแห่งยมโลก ถือบัญชีบุญบาปของทุกดวงวิญญาณ ตัดสินด้วยคทาเพลิง (บอสนรกภูมิ)', d8: 'pret_asura', tint: 0x9b59b6, scale: 2.15, aoe: { cd: 5500, r: 130, mult: 1.6, nameTh: 'คำพิพากษายมโลก' }, drops: [{ item: 'yama_seal', chance: 1 }, { item: 'flask_hp10', chance: 0.3 }, { item: 'flask_mp10', chance: 0.25 }] }),
});
export const REALM_MOB_IDS = Object.keys(MONSTERS).filter((id) => MONSTERS[id].realm);
