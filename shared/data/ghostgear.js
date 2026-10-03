// ============================================================
//  ชุดประจำบอส "ดันเจี้ยนสี่ผีป่าช้า" (ข้อมูลไอเทมล้วน ไม่ import อะไร → items.js / character.js ใช้ได้ไม่วนกัน)
//  ▸ ต่อบอส: หมวก · ถุงมือ · รองเท้า · เข็มขัด (ใส่ได้ทุกอาชีพ) + อาวุธ 5 แนว (ตามอาชีพ)
//  ▸ ค่าสุ่มบนของมาจากหีบรางวัล (ระดับยาก/นรก = 3 บรรทัด) · โบนัสชุดนับชิ้นของบอสเดียวกัน 2 / 4 / 5 ชิ้น
// ============================================================

/** ภาพไอคอน/ภาพถืออาวุธ: ยืมของชุดอาชีพที่ใกล้เคียง (ยังไม่มีภาพเฉพาะ) */
const LOOK = {
  helm: 'gx_sword_helm_2', gloves: 'gx_sword_gloves_2', boots: 'gx_sword_boots_2', belt: 'gx_sword_belt_2',
  sword: 'g_sword_w14', wraps: 'g_boxer_w14', staff: 'g_mage_w14', bow: 'g_archer_w14', herb: 'g_healer_w14',
};
const GRIP = {
  sword: { g: [22, 42], s: 0.55, r: 0.7 }, staff: { g: [24, 34], s: 0.78, ox: 2 }, bow: { g: [27, 26], s: 0.72, ox: 4, oy: -5 }, herb: { g: [17, 31], s: 0.78, ox: 2, up: -45 },
};
const JOB_OF = { sword: 'swordman', wraps: 'boxer', staff: 'mage', bow: 'archer', herb: 'healer' };
const ICON = { helm: '⛑️', gloves: '🧤', boots: '🥾', belt: '🎗️', sword: '⚔️', wraps: '🥊', staff: '🔮', bow: '🏹', herb: '🌿' };

/** ชุดของแต่ละบอส · lv = เลเวลที่ใส่ได้ · names = ชื่อแต่ละชิ้น · bonus = ค่าพื้นฐาน */
export const GD_SETS = {
  hung: {
    nameTh: 'ชุดบ่วงเพชฌฆาต', lv: 110,
    names: { helm: 'ผ้าโพกบ่วงเพชฌฆาต', gloves: 'ปลอกมือเพชฌฆาต', boots: 'รองเท้าลานประหาร', belt: 'เชือกบ่วงคาดเอว',
      sword: 'ดาบเพชฌฆาตลานประหาร', wraps: 'ผ้าพันมือบ่วงตาย', staff: 'ไม้เท้าวิญญาณตายโหง', bow: 'ธนูสายบ่วง', herb: 'ไม้เท้าหมอผีลานประหาร' },
    bonus: {
      helm: { def: 64, hp: 700, STR: 14, VIT: 12 }, gloves: { atk: 140, matk: 120, crit: 0.05, acc: 30 }, boots: { def: 50, eva: 40, hp: 300, AGI: 10 }, belt: { hp: 760, def: 32, flaskPct: 40, VIT: 10 },
      sword: { atk: 440, crit: 0.22, critDmg: 0.1 }, wraps: { atk: 385, STR: 26, crit: 0.16 }, staff: { matk: 470, mp: 600, INT: 20 }, bow: { atk: 410, DEX: 30, crit: 0.05 },
      herb: { matk: 400, mp: 540, hp: 460, healMul: 0.62, VIT: 18 },
    },
    // โบนัสชุด: นับชิ้นของบอสนี้ที่สวมอยู่ (อาวุธนับด้วย)
    setBonus: [[2, { atk: 60, matk: 60, hp: 400 }], [4, { critDmg: 0.15, patkMul: 0.05, matkMul: 0.05 }], [5, { crit: 0.05, def: 40 }]],
  },
};
export const GD_ARMOR = ['helm', 'gloves', 'boots', 'belt'];
export const GD_WEAPONS = ['sword', 'wraps', 'staff', 'bow', 'herb'];
export const gdItemId = (boss, part) => `gd_${boss}_${part}`;

/** ไอเทมทั้งหมด (รวมเข้า ITEMS ใน items.js) */
export const GD_ITEMS = { gd_essence: { nameTh: 'แก่นผี', type: 'material', icon: '🕯️', sell: 200, desc: 'แก่นวิญญาณจากบอสดันเจี้ยนสี่ผีป่าช้า · ดรอปทุกรอบที่ชนะ · สะสมไว้แลกชิ้นชุดบอสที่ต้องการ (เร็ว ๆ นี้)' } };
for (const [boss, S] of Object.entries(GD_SETS)) {
  for (const part of [...GD_ARMOR, ...GD_WEAPONS]) {
    const weapon = GD_WEAPONS.includes(part);
    GD_ITEMS[gdItemId(boss, part)] = {
      nameTh: S.names[part], type: weapon ? 'weapon' : part, icon: ICON[part], lv: S.lv, gdSet: boss, sell: 12000,
      ...(weapon ? { job: JOB_OF[part], wtype: part, art: LOOK[part], lookAs: LOOK[part], ...(GRIP[part] ? { grip: GRIP[part] } : {}) } : { art: LOOK[part] }),
      bonus: { ...S.bonus[part] },
      desc: `${S.nameTh} · ดรอปจากดันเจี้ยนสี่ผีป่าช้า · โบนัสชุด ${S.setBonus.map(([n]) => n).join('/')} ชิ้น`,
    };
  }
}

/** โบนัสชุดบอสจากอุปกรณ์ที่สวม → { bonus, sets:[{ boss, n, tiers }] } (ของมีค่าสุ่ม base@… นับเป็นชิ้นเดียวกับของฐาน) */
export function gdSetInfo(equipment = {}) {
  const count = {};
  for (const id of Object.values(equipment || {})) {
    if (typeof id !== 'string') continue;
    const base = id.includes('@') ? id.slice(0, id.indexOf('@')) : id, it = GD_ITEMS[base];
    if (it?.gdSet) count[it.gdSet] = (count[it.gdSet] || 0) + 1;
  }
  const bonus = {}, sets = [];
  for (const [boss, n] of Object.entries(count)) {
    const S = GD_SETS[boss]; if (!S) continue;
    const tiers = S.setBonus.map(([need, b]) => ({ n: need, bonus: b, on: n >= need }));
    for (const t of tiers) if (t.on) for (const [k, v] of Object.entries(t.bonus)) bonus[k] = +((bonus[k] || 0) + v).toFixed(3);
    sets.push({ boss, nameTh: S.nameTh, n, tiers });
  }
  return { bonus, sets };
}
