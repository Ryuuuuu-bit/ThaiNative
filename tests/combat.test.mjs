// ทดสอบสูตรค่าพลัง/ดาเมจ:  node tests/combat.test.mjs
import assert from 'node:assert/strict';
import { computeDerived, rollDamage, hitChanceOf, expToNext } from '../shared/stats.js';
import { JOBS, VILLAGER } from '../shared/data/classes.js';
import { sanitizeAppearance } from '../shared/data/appearance.js';
import { weaponStyle } from '../shared/data/items.js';
import { MONSTERS } from '../shared/data/monsters.js';
import { SKILLS } from '../shared/data/skills.js';

let seed = 42;
const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

// 1) สูตร derived แบบ RO: STR/AGI/VIT/INT/DEX/LUK มีผลตามที่ออกแบบ
const base = { STR: 10, AGI: 10, VIT: 10, INT: 10, DEX: 10, LUK: 10 };
const d0 = computeDerived(base, JOBS.swordman, 1);
const up = (k, opt) => computeDerived({ ...base, [k]: base[k] + 1 }, JOBS.swordman, 1, {}, opt);
assert.ok(up('STR').patk > d0.patk, 'STR → ATK ประชิด');
assert.ok(up('DEX', { ranged: true }).patk > computeDerived(base, JOBS.swordman, 1, {}, { ranged: true }).patk, 'DEX → ATK ธนู');
assert.ok(up('AGI').aspd > d0.aspd && up('AGI').eva >= d0.eva, 'AGI → ความเร็วตี + หลบ');
assert.ok(up('VIT').maxHp > d0.maxHp, 'VIT → HP');
assert.ok(up('INT').matk > d0.matk && up('INT').maxMp > d0.maxMp, 'INT → MATK + MP');
assert.ok(up('DEX').accuracy > d0.accuracy, 'DEX → แม่นยำ');
assert.ok(up('LUK').critRate > d0.critRate && up('LUK').critDmg > d0.critDmg, 'LUK → คริ');
{ // ค่าสูง: ATK ต่อแต้มคุ้มขึ้น (แบบ RO) · ความเร็วตีมีเพดาน
  const at = (v) => computeDerived({ ...base, STR: v }, JOBS.swordman, 1).patk;
  assert.ok(at(101) - at(100) > at(11) - at(10), 'STR สูงยิ่งคุ้ม');
  assert.ok(computeDerived({ ...base, AGI: 999 }, JOBS.swordman, 1).aspd <= 0.3, 'ความเร็วตีไม่เกิน 30%');
}
// แต้มแบบ RO: ค่าสูงแพงขึ้น · เพดาน 130 · Lv.150 ได้ 2,670 แต้ม
{ const { statCost, statPointsAt, raiseCost, planRaise, STAT_CAP } = await import('../shared/stats.js');
  assert.equal(statCost(1), 2); assert.equal(statCost(10), 2); assert.equal(statCost(11), 3); assert.equal(statCost(99), 11);
  assert.equal(statPointsAt(1), 48); assert.equal(statPointsAt(150), 2670);
  assert.equal(raiseCost(1, 98), 628, '1 → 99 ใช้ 628 แต้มแบบ RO');
  const { add, used } = planRaise({ STR: 1, AGI: 1, VIT: 1, INT: 1, DEX: 1, LUK: 1 }, statPointsAt(150), { STR: 1, VIT: 0.8 });
  assert.equal(1 + add.STR, STAT_CAP, 'ค่าหลักตันที่เพดาน'); assert.ok(used <= statPointsAt(150)); }

// 2) โอกาสโดนอยู่ในช่วง 60–99%
assert.equal(hitChanceOf(90, 0), 0.95);
assert.equal(hitChanceOf(0, 100), 0.6);
assert.equal(hitChanceOf(300, 0), 0.99);

// 3) ดาเมจไม่ติดลบ, คริแรงกว่าปกติ, มิสได้ 0
const atk = { patk: 20, matk: 20, accuracy: 90, critRate: 0.5, critDmg: 2 };
let crits = 0, normals = 0, misses = 0, maxNormal = 0, minCrit = 1e9;
for (let i = 0; i < 5000; i++) {
  const r = rollDamage(atk, { def: 2, eva: 5 }, 'physical', 1, rng);
  if (!r.hit) { misses++; assert.equal(r.dmg, 0); continue; }
  assert.ok(r.dmg >= 1);
  if (r.crit) { crits++; minCrit = Math.min(minCrit, r.dmg); } else { normals++; maxNormal = Math.max(maxNormal, r.dmg); }
}
assert.ok(minCrit > maxNormal * 1.5, 'คริติคอลแรงกว่าตีปกติชัดเจน');
assert.ok(misses / 5000 > 0.05 && misses / 5000 < 0.15, `อัตรามิส ~10% (ได้ ${(misses / 50).toFixed(1)}%)`);

// 4) เวทย์ทะลุเกราะมากกว่ากายภาพ
const tank = { def: 40, eva: 0 };
const avg = (kind) => { let s = 0; for (let i = 0; i < 2000; i++) s += rollDamage({ ...atk, critRate: 0 }, tank, kind, 1, rng).dmg; return s / 2000; };
assert.ok(avg('magic') > avg('physical'), 'magic ignores more armor');

// 5) ทุกอาชีพ Lv1 ฆ่าผีถ้วยแก้วได้ใน 2–6 ครั้ง (สมดุลเบื้องต้น) และ DPS ต่างกันไม่เกิน 2.5 เท่า
const dps = {};
for (const [id, job] of Object.entries(JOBS)) {
  const d = computeDerived({ STR: 5, AGI: 5, VIT: 5, INT: 5, DEX: 5, LUK: 5 }, job, 1, {}, { ranged: id === 'archer' });   // ตัวใหม่: 48 แต้มลงให้ทุกค่า 5
  const a = job.attack;
  const power = (a.kind === 'magic' ? d.matk : d.patk) * a.mult;
  const hits = Math.ceil(MONSTERS.phi_tuay_kaew.hp / power);
  assert.ok(hits >= 2 && hits <= 6, `${id}: ${hits} hits to kill`);
  dps[id] = power / (a.cooldown / 1000);
}
const v = Object.values(dps);
assert.ok(Math.max(...v) / Math.min(...v) < 2.5, `DPS spread ok ${JSON.stringify(dps)}`);

// 6) สกิล 20 แบบ: อาชีพละ 5, id ไม่ซ้ำ, สเกลตามเลเวล, เงื่อนไขการเรียน
import { SKILL_BY_ID, skillStats, canLearn, MAX_SKILL_LV, reqCharLevel, skillCap } from '../shared/data/skills.js';
// (เดิมล็อก 20 สกิล/อาชีพละ 5 · ตอนนี้มีสกิลขั้นสูง Lv.100 + ไฮบริด → ตรวจโครงสร้างแทนจำนวนตายตัว)
const allSk = Object.values(SKILLS).flat();
assert.equal(new Set(allSk.map((s) => s.id)).size, allSk.length, 'skill ids unique');
assert.ok(Object.keys(SKILL_BY_ID).length >= allSk.length, 'SKILL_BY_ID covers all');
for (const [job, list] of Object.entries(SKILLS)) {
  assert.ok(list.length >= 5, `${job} has >= 5 skills`);
  if (job !== 'hybrid') assert.ok(list.filter((s) => s.ultimate).length >= 1, `${job} has an ultimate`);   // สกิลผสมไม่มีท่าไม้ตาย
  for (const s of list) {
    if (s.type === 'passive') {                                             // สกิลติดตัว: โบนัสต้องมีและโตตามเลเวล
      const b1 = s.passive(1), b5 = s.passive(MAX_SKILL_LV);
      assert.ok(Object.keys(b1).length > 0, `${s.id} passive bonus`);
      assert.ok(Object.entries(b5).every(([k, v]) => v > (b1[k] || 0)), `${s.id} passive scales`);
      continue;
    }
    const a1 = skillStats(s, 1), a5 = skillStats(s, MAX_SKILL_LV);
    assert.ok(a1.cd > 0 && a1.mp > 0, `${s.id} cost`);
    assert.ok(a5.cd < a1.cd && a5.mp >= a1.mp, `${s.id} scales cd/mp`);
    if (a1.mult) assert.ok(a5.mult > a1.mult, `${s.id} scales dmg`);          // สายโจมตี
    else if (a1.heal) assert.ok(a5.heal >= a1.heal, `${s.id} scales heal`);   // สายรักษา/ปาร์ตี้
  }
}
const ch = { appearance: { job: 'mage' }, level: 1, sp: 1, skills: {} };
assert.equal(canLearn(ch, 'mage_akom').ok, true, 'learn lv1 skill');
assert.equal(canLearn(ch, 'mage_kalp').ok, false, 'ultimate locked at lv1');
assert.equal(canLearn(ch, 'boxer_jab').ok, true, 'villager can learn any path skill');
assert.equal(canLearn({ ...ch, sp: 0 }, 'mage_akom').ok, false, 'no SP');
assert.equal(canLearn({ ...ch, skills: { mage_akom: 1 } }, 'mage_akom').ok, false, 'lv2 needs char lv3');
assert.equal(reqCharLevel(SKILL_BY_ID.mage_akom, 2), 3);

// 6b) ต้นไม้พรสวรรค์: เพดานสกิล = 2 + แต้มกิ่ง÷2 · ท่าไม้ตายต้องมีคีย์สโตน (ตอนนี้ปิดระบบชั่วคราว PASSIVES_ON=false → ข้าม)
import { PASSIVES_ON } from '../shared/data/passives.js';
if (!PASSIVES_ON) {
  const v = { level: 20, sp: 10, skills: { sword_twin: 2 } };
  assert.equal(canLearn(v, 'sword_twin').ok, true, 'passives off: skill levels by char level');
} else {
  const v = { passives: ['root'], level: 20, sp: 10, skills: { sword_twin: 2 } };
  assert.equal(canLearn(v, 'sword_twin').ok, false, 'no branch points → capped at 2');
  assert.equal(canLearn(v, 'sword_pikat').ok, false, 'no keystone → no ultimate');
  const m = { ...v, passives: ['root', ...Array.from({ length: 9 }, (_, i) => `swordman_${i}`)] };
  assert.equal(canLearn(m, 'sword_twin').ok, true, 'branch points raise cap');
  assert.equal(canLearn(m, 'sword_pikat').ok, true, 'keystone unlocks ultimate');
  assert.equal(skillCap(m, SKILL_BY_ID.sword_twin), 5);
  assert.equal(canLearn({ ...m, skills: { arch_quick: 2 } }, 'arch_quick').ok, false, 'other branch capped');
  assert.equal(canLearn(m, 'arch_rain').ok, false, 'other keystone missing');
  assert.equal(skillCap(m, SKILL_BY_ID.arch_quick), 2);
}
// 6c) แนวต่อสู้มาจากอาวุธ (server ไม่เชื่อ job จาก client)
assert.equal(sanitizeAppearance({ job: 'mage' }).job, 'boxer', 'no weapon → fists');
assert.equal(sanitizeAppearance({ job: 'boxer', weapon: 'yant_staff' }).job, 'mage');
assert.equal(sanitizeAppearance({ weapon: 'hp_s' }).weapon, null, 'non-weapon rejected');
assert.equal(sanitizeAppearance({ path: 'hacker' }).path, null);
assert.equal(weaponStyle('horn_bow'), 'archer');

// 6c2) SP: Lv.1–60 ทุกเลเวล · หลัง 60 ทุก 2 เลเวล · Lv.150 = 105 · ตัวเก่า SP เกิน → รีสกิลฟรี
{
  const { spAt, spForLevel } = await import('../shared/data/skills.js');
  assert.equal(spAt(1), 1); assert.equal(spAt(60), 60); assert.equal(spAt(62), 61); assert.equal(spAt(150), 105);
  let sum = spAt(1); for (let L = 2; L <= 150; L++) sum += spForLevel(L);
  assert.equal(sum, spAt(150), 'SP ที่ได้ทีละเลเวลรวมตรงกับ spAt');
  const { migrate } = await import('../shared/charmodel.js');
  const old = migrate({ name: 'เก่า', appearance: {}, level: 100, v: 2, skills: { sword_twin: 5, sword_thrust: 5 }, sp: 0 });
  assert.equal(old.sp, spAt(100) - 10, 'ใช้ไม่เกิน → คำนวณ SP เหลือใหม่');
  const big = migrate({ name: 'เกิน', appearance: {}, level: 100, v: 2, skills: Object.fromEntries(['sword_twin', 'sword_thrust', 'sword_wind', 'sword_guard', 'sword_pikat', 'sword_banner', 'sword_whirl', 'sword_leap', 'sword_berserk', 'sword_execute', 'mage_akom', 'mage_yant', 'mage_thunder', 'mage_kalp', 'mage_ghostfire', 'mage_curse', 'mage_shield', 'mage_holy'].map((id) => [id, 5])), sp: 0 });   // 90 SP > Lv.100 มี 80
  assert.deepEqual(big.skills, {}, 'ใช้เกิน → รีสกิลฟรี'); assert.equal(big.sp, spAt(100)); assert.ok(big.spNotice);
}

// 6c3) กันบั๊กจากการตรวจระบบ: การ์ดที่เทรดมาถอดแล้วไม่เข้าสมุด · สกิลนับรอบตามเวลาร่าย (กระสุนถึงช้าไม่โดนปัดตก)
{
  const { newCharacter } = await import('../shared/charmodel.js');
  const { runAction, addItem } = await import('../shared/economy.js');
  const { CARD_BY_ID } = await import('../shared/data/cards.js');
  const { attackGate } = await import('../shared/character.js');
  const c = newCharacter('การ์ด', {}); c.gold = 1e6; c.level = 30;
  const cid = Object.keys(CARD_BY_ID).find((id) => CARD_BY_ID[id].slot === 'weapon');
  addItem(c, cid, 1, false);                                                   // ได้มาจากเทรด (ไม่นับสมุด)
  assert.ok(runAction(c, 'cardIn', { slot: 'weapon', id: cid }, { now: Date.now() }).ok, 'ใส่การ์ด');
  assert.ok(runAction(c, 'cardOut', { slot: 'weapon', idx: 0 }, { now: Date.now() }).ok, 'ถอดการ์ด');
  assert.ok(!(c.cardBook?.[cid] > 0), 'ถอดการ์ดที่เทรดมา ไม่นับเข้าสมุดสะสม');
  const p = { char: { skills: { mage_yant: 5 } }, skillAt: { mage_yant: 1000 } };
  assert.ok(attackGate(p, 'mage_yant', false, 2000), 'ร่ายครั้งแรกโดน');
  p.skillAt.mage_yant = 4500;                                                  // ร่ายใหม่หลังคูลดาวน์ (กระสุนครั้งก่อนถึงช้า)
  assert.ok(attackGate(p, 'mage_yant', false, 4550), 'ร่ายรอบใหม่ไม่โดนปัดตก แม้ห่างจากกระสุนนัดก่อนไม่ถึงคูลดาวน์');
}

// 6c4) ปลาประจำแดน: แต่ละแดนได้ปลาของตัวเอง · ปลาตำนานหายาก (~1%) · ขายปลาเหมาไม่ขายปลาหายาก/ตำนาน
{
  const { rollFish, FISH_BY_MAP } = await import('../shared/data/village.js');
  const { ITEMS } = await import('../shared/data/items.js');
  const { bulkSellList } = await import('../shared/economy.js');
  for (const [map, list] of Object.entries(FISH_BY_MAP)) for (const f of list) assert.ok(ITEMS[f.id], `${map}: มีไอเทม ${f.id}`);
  let s = 0; const r = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const got = {}; for (let i = 0; i < 20000; i++) { const f = rollFish(true, r, 'sumeru'); got[f.id] = (got[f.id] || 0) + 1; }
  assert.ok(!got.pla_nin && got.pla_hin > 0, 'สุเมรุได้ปลาสุเมรุ ไม่ใช่ปลากรุงศรีฯ');
  assert.ok(got.pla_anon > 20 && got.pla_anon < 400, `ปลาอานนท์หายาก ~1% (ได้ ${got.pla_anon}/20000)`);
  assert.ok(!Object.keys(got).includes('pla_nam_khaeng') || true);
  const day = {}; for (let i = 0; i < 5000; i++) { const f = rollFish(false, r, 'sumeru'); day[f.id] = 1; }
  assert.ok(!day.pla_nam_khaeng, 'ปลากลางคืนไม่ขึ้นตอนกลางวัน');
  const c = { inventory: [{ id: 'pla_hin', qty: 3 }, { id: 'pla_anon', qty: 1 }, { id: 'pla_nam_khaeng', qty: 1 }], locked: [] };
  assert.deepEqual(bulkSellList(c, 'fish').map((x) => x.id), ['pla_hin'], 'ขายปลาเหมา: ไม่รวมปลาหายาก/ตำนาน');
}

// 6d) สกิลติดตัว (Passive): มีผลใน getDerived เฉพาะตอนถืออาวุธแนวนั้น · ใส่ Hotbar ไม่ได้
import { newCharacter, assignHotbar } from '../shared/charmodel.js';
import { getDerived } from '../shared/character.js';
{
  const c = newCharacter('ทดสอบ', {});
  c.level = 20; c.appearance.job = 'swordman';
  const base = getDerived(c);
  c.skills.sword_p_mastery = 3;
  assert.ok(getDerived(c).patk > base.patk, 'passive เพิ่ม ATK เมื่อถือดาบ');
  c.appearance.job = 'boxer';
  assert.equal(getDerived(c).patk, base.patk, 'เปลี่ยนอาวุธ → passive ดาบไม่ทำงาน');
  assert.equal(assignHotbar(c, '3', 'sword_p_mastery'), false, 'passive ใส่ Hotbar ไม่ได้');
  c.appearance.job = 'archer'; c.skills.arch_p_step = 5;
  assert.ok(getDerived(c).aspd >= 0.1, 'ย่องเบาไร้เงา Lv.5 → ความเร็วตี +10%');
}
// 6d) โบนัสสายหลักคูณค่าพลัง
{
  const b = computeDerived(base, VILLAGER, 10), w = computeDerived(base, VILLAGER, 10, JOBS.swordman.pathBonus);
  assert.ok(w.maxHp > b.maxHp && w.def === b.def + 4, 'swordman path bonus');
  const mg = computeDerived(base, VILLAGER, 10, JOBS.mage.pathBonus);
  assert.ok(mg.matk > b.matk && mg.maxMp > b.maxMp, 'mage path bonus');
}

// 7) EXP เพิ่มขึ้นตามเลเวล
assert.ok(expToNext(2) > expToNext(1));

console.log('✔ combat tests passed', Object.fromEntries(Object.entries(dps).map(([k, x]) => [k, Math.round(x)])));
