// ============================================================
//  ต้นไม้พรสวรรค์ (Passive Tree) – แบบ PoE2 ย่อส่วน
//  ▸ ได้ 1 แต้มต่อเลเวล (Lv.2 เป็นต้นไป) · ลงได้เฉพาะจุดที่ติดกับจุดที่ลงแล้ว (เริ่มจากกลาง)
//  ▸ 5 กิ่งตามแนวอาวุธ (ห้าแฉก): บน = ดาบ (ขุนศึก) · ขวาบน = ไม้เท้า (ขมังเวทย์) · ขวาล่าง = ไม้เท้าสมุนไพร (หมอยา) · ซ้ายล่าง = ธนู (พราน) · ซ้ายบน = มวย
//  ▸ ปลายกิ่ง = คีย์สโตน (ฉายาประจำสาย) · แต้มในกิ่ง = ปลดเลเวลสกิลอาวุธนั้น + ท่าไม้ตาย ★ ต้องมีคีย์สโตน
//  ▸ ระหว่างกิ่งมีจุดผสม (ไฮบริด) เชื่อมกิ่งข้างเคียง
// ============================================================
const D5 = (i) => { const a = -Math.PI / 2 + i * Math.PI * 2 / 5; return [+Math.cos(a).toFixed(3), +Math.sin(a).toFixed(3)]; };
export const BRANCHES = {
  swordman: { dir: D5(0), nameTh: 'กิ่งขุนศึก', color: '#e74c3c' },
  mage:     { dir: D5(1), nameTh: 'กิ่งขมังเวทย์', color: '#a569bd' },
  healer:   { dir: D5(2), nameTh: 'กิ่งหมอยา', color: '#48c9b0' },
  archer:   { dir: D5(3), nameTh: 'กิ่งพรานไพร', color: '#52be80' },
  boxer:    { dir: D5(4), nameTh: 'กิ่งมวยคาดเชือก', color: '#eb984e' },
};

// โบนัสที่ใช้ได้: STR DEX INT CRI VIT (แต้มสถานะ) · hp mp atk matk def (ค่าตรง) · crit (อัตราคริ) · hpMul mpMul patkMul matkMul (%)
const ARM = {
  swordman: [
    { n: 'กำลังแขน', b: { STR: 2 } },
    { n: 'หนังเหนียว', b: { VIT: 2 } },
    { n: 'แรงช้างสาร', b: { patkMul: 0.06, STR: 2 }, k: 'notable' },
    { n: 'ท่าตั้งรับ', b: { def: 3 } },
    { n: 'เลือดนักรบ', b: { hp: 30 } },
    { n: 'กำแพงเหล็ก', b: { def: 6, hpMul: 0.05 }, k: 'notable' },
    { n: 'ดาบคู่ใจ', b: { patkMul: 0.07, crit: 0.02 }, k: 'notable' },
    { n: 'ใจเด็ด', b: { STR: 2, VIT: 2 } },
    { n: 'ขุนศึกบางระจัน', b: { hpMul: 0.12, def: 4, patkMul: 0.05 }, k: 'key' },
  ],
  mage: [
    { n: 'สมาธิ', b: { INT: 2 } },
    { n: 'ลมปราณ', b: { mp: 15 } },
    { n: 'อาคมแก่กล้า', b: { matkMul: 0.07, INT: 2 }, k: 'notable' },
    { n: 'ท่องคาถา', b: { INT: 2 } },
    { n: 'ยันต์คุ้มกาย', b: { def: 3, hp: 20 } },
    { n: 'บ่อน้ำมนต์', b: { mpMul: 0.12, mp: 10 }, k: 'notable' },
    { n: 'เพลิงวิญญาณ', b: { matkMul: 0.08, crit: 0.02 }, k: 'notable' },
    { n: 'ญาณหยั่งรู้', b: { INT: 3 } },
    { n: 'หมอผีเจ็ดป่าช้า', b: { mpMul: 0.2, matkMul: 0.12 }, k: 'key' },
  ],
  archer: [
    { n: 'สายตาไว', b: { DEX: 2 } },
    { n: 'มือนิ่ง', b: { CRI: 2 } },
    { n: 'เล็งจุดตาย', b: { crit: 0.04, DEX: 2 }, k: 'notable' },
    { n: 'ฝีเท้าพราน', b: { DEX: 2 } },
    { n: 'สายธนูตึง', b: { atk: 6 } },
    { n: 'เหยี่ยวล่าเหยื่อ', b: { crit: 0.05, CRI: 3 }, k: 'notable' },
    { n: 'ศรพิฆาต', b: { patkMul: 0.07, atk: 4 }, k: 'notable' },
    { n: 'ใจพราน', b: { DEX: 2, CRI: 2 } },
    { n: 'พรานไพรตาเหยี่ยว', b: { crit: 0.08, patkMul: 0.06 }, k: 'key' },
  ],
  healer: [
    { n: 'ใจเมตตา', b: { INT: 1, VIT: 1 } },
    { n: 'รู้จักสมุนไพร', b: { mp: 15 } },
    { n: 'มือหมอยา', b: { matkMul: 0.06, INT: 2 }, k: 'notable' },
    { n: 'ตำรายาโบราณ', b: { INT: 2 } },
    { n: 'กายสะอาด', b: { hp: 30 } },
    { n: 'ศาลาโอสถ', b: { mpMul: 0.1, hpMul: 0.05 }, k: 'notable' },
    { n: 'รากลึกใบหนา', b: { def: 4, VIT: 2 }, k: 'notable' },
    { n: 'สมาธิหมอเทวดา', b: { INT: 2, VIT: 2 } },
    { n: 'หมอเทวดาแห่งกรุงศรี', b: { mpMul: 0.15, hpMul: 0.08, matkMul: 0.06 }, k: 'key' },
  ],
  boxer: [
    { n: 'หมัดหนัก', b: { STR: 1, DEX: 1 } },
    { n: 'ร่างเหล็ก', b: { VIT: 2 } },
    { n: 'แม่ไม้มวยไทย', b: { patkMul: 0.06, STR: 2 }, k: 'notable' },
    { n: 'ฟุตเวิร์ค', b: { DEX: 2 } },
    { n: 'ทนหมัด', b: { hp: 30 } },
    { n: 'ลูกไม้ศอกเข่า', b: { crit: 0.03, CRI: 3 }, k: 'notable' },
    { n: 'ใจสู้', b: { hpMul: 0.06, VIT: 2 }, k: 'notable' },
    { n: 'คาดเชือกเชิงครู', b: { STR: 2, DEX: 2 } },
    { n: 'นายขนมต้มคาดเชือก', b: { hpMul: 0.06, patkMul: 0.1 }, k: 'key' },
  ],
};
// ตำแหน่งบนแกนกิ่ง [ระยะจากกลาง, เยื้องข้าง] · และลิงก์ภายในกิ่ง
const SHAPE = [[1, 0], [2, 0], [3, 0], [4, -0.8], [4, 0.8], [5, -0.9], [5, 0.9], [6, 0], [7, 0]];
const INNER = [[0, 1], [1, 2], [2, 3], [2, 4], [3, 5], [4, 6], [5, 7], [6, 7], [7, 8]];
// จุดผสมระหว่างกิ่งข้างเคียง (ต่อกับจุดที่ 2 ของทั้งสองกิ่ง)
const HYBRID = [
  ['swordman', 'mage', 'ดาบลงอาคม', { STR: 1, INT: 1, hp: 10 }],
  ['mage', 'healer', 'ยาลงยันต์', { INT: 2, mp: 10 }],
  ['healer', 'archer', 'สมุนไพรพรานป่า', { VIT: 1, DEX: 1, hp: 15 }],
  ['archer', 'boxer', 'ว่องไวดั่งลิง', { DEX: 1, STR: 1, CRI: 1 }],
  ['boxer', 'swordman', 'กระบี่กระบอง', { STR: 1, VIT: 1, def: 2 }],
];

export const PASSIVES = { root: { id: 'root', nameTh: 'จิตวิญญาณชาวบ้าน', kind: 'root', x: 0, y: 0, bonus: {}, links: [] } };
const link = (a, b) => { PASSIVES[a].links.push(b); PASSIVES[b].links.push(a); };
for (const [job, list] of Object.entries(ARM)) {
  const [dx, dy] = BRANCHES[job].dir, px = -dy, py = dx;           // แกนกิ่ง + แกนตั้งฉาก
  list.forEach((nd, i) => {
    const [d, s] = SHAPE[i];
    const id = `${job}_${i}`;
    PASSIVES[id] = { id, nameTh: nd.n, kind: nd.k || 'small', branch: job, x: +(dx * d + px * s).toFixed(2), y: +(dy * d + py * s).toFixed(2), bonus: nd.b, links: [] };
  });
  link('root', `${job}_0`);
  for (const [a, b] of INNER) link(`${job}_${a}`, `${job}_${b}`);
}
for (const [a, b, name, bonus] of HYBRID) {
  const A = PASSIVES[`${a}_1`], B = PASSIVES[`${b}_1`];
  const id = `hy_${a}_${b}`;
  PASSIVES[id] = { id, nameTh: name, kind: 'small', branch: null, x: +((A.x + B.x) * 0.75).toFixed(2), y: +((A.y + B.y) * 0.75).toFixed(2), bonus, links: [] };
  link(id, `${a}_1`); link(id, `${b}_1`);
}
export const PASSIVE_IDS = Object.keys(PASSIVES);
export const KEYSTONE = Object.fromEntries(Object.keys(ARM).map((j) => [j, `${j}_8`]));

/** แต้มพรสวรรค์ทั้งหมดตามเลเวล */
export const totalPassivePoints = (level) => Math.max(0, level - 1);

/** ลงจุดนี้ได้ไหม (ต้องติดกับจุดที่ลงแล้ว) */
export function canAllocate(owned, id) {
  const n = PASSIVES[id];
  if (!n || owned.includes(id)) return false;
  return n.links.some((l) => owned.includes(l));
}

/** แต้มในแต่ละกิ่ง */
export function branchPoints(owned) {
  const out = { swordman: 0, mage: 0, archer: 0, boxer: 0, healer: 0 };
  for (const id of owned) { const b = PASSIVES[id]?.branch; if (b) out[b]++; }
  return out;
}

/** รวมโบนัสจากต้นไม้ */
/** ปิดต้นไม้พรสวรรค์ชั่วคราว (เก็บข้อมูลผู้เล่นไว้ เปิดกลับได้ทันทีด้วยการตั้งเป็น true) */
export const PASSIVES_ON = false;

export function passiveBonus(owned) {
  const bonus = {};
  if (!PASSIVES_ON) return bonus;
  for (const id of owned || []) for (const [k, v] of Object.entries(PASSIVES[id]?.bonus || {})) bonus[k] = (bonus[k] || 0) + v;
  return bonus;
}

/** ข้อความโบนัส */
const LABEL = { STR: 'STR', DEX: 'DEX', INT: 'INT', CRI: 'CRI', VIT: 'VIT', hp: 'HP', mp: 'MP', atk: 'โจมตี', matk: 'พลังเวทย์', def: 'ป้องกัน',
  crit: 'คริติคอล', hpMul: 'HP', mpMul: 'MP', patkMul: 'โจมตี', matkMul: 'พลังเวทย์' };
export function bonusText(b) {
  return Object.entries(b || {}).map(([k, v]) => /Mul$|^crit$/.test(k) ? `${LABEL[k]} +${Math.round(v * 100)}%` : `${LABEL[k] || k} +${v}`).join(' · ');
}
