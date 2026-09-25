// ทดสอบสูตรค่าพลัง/ดาเมจ:  node tests/combat.test.mjs
import assert from 'node:assert/strict';
import { computeDerived, rollDamage, hitChanceOf, expToNext } from '../shared/stats.js';
import { JOBS } from '../shared/data/classes.js';
import { MONSTERS } from '../shared/data/monsters.js';
import { SKILLS } from '../shared/data/skills.js';

let seed = 42;
const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

// 1) สูตร derived: STR/INT/VIT/DEX/CRI มีผลตามที่ออกแบบ
const base = { STR: 10, DEX: 10, INT: 10, CRI: 10, VIT: 10 };
const d0 = computeDerived(base, JOBS.swordman, 1);
const up = (k) => computeDerived({ ...base, [k]: base[k] + 1 }, JOBS.swordman, 1);
assert.equal(up('STR').patk - d0.patk, 2, 'STR +1 → ATK +2');
assert.equal(up('VIT').maxHp - d0.maxHp, 12, 'VIT +1 → HP +12');
assert.ok(up('INT').matk > d0.matk, 'INT → MATK');
assert.ok(up('DEX').accuracy > d0.accuracy && up('DEX').critRate > d0.critRate, 'DEX → ACC + CRIT');
assert.ok(Math.abs(up('CRI').critDmg - d0.critDmg - 0.02) < 1e-9, 'CRI +1 → crit dmg +2%');

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
  const d = computeDerived(job.startStats, job, 1);
  const a = job.attack;
  const power = (a.kind === 'magic' ? d.matk : d.patk) * a.mult;
  const hits = Math.ceil(MONSTERS.phi_tuay_kaew.hp / power);
  assert.ok(hits >= 2 && hits <= 6, `${id}: ${hits} hits to kill`);
  dps[id] = power / (a.cooldown / 1000);
}
const v = Object.values(dps);
assert.ok(Math.max(...v) / Math.min(...v) < 2.5, `DPS spread ok ${JSON.stringify(dps)}`);

// 6) ข้อมูลสกิลครบ 4 ปุ่มทุกอาชีพ และค่าถูกต้อง
for (const [job, list] of Object.entries(SKILLS)) {
  assert.deepEqual(list.map((s) => s.key), ['Q', 'W', 'E', 'R'], job);
  for (const s of list) {
    assert.ok(s.cd > 0 && s.mp >= 0, `${job} ${s.key}`);
    if (s.type !== 'buff') assert.ok(s.mult > 0, `${job} ${s.key} mult`);
  }
}

// 7) EXP เพิ่มขึ้นตามเลเวล
assert.ok(expToNext(2) > expToNext(1));

console.log('✔ combat tests passed', Object.fromEntries(Object.entries(dps).map(([k, x]) => [k, Math.round(x)])));
