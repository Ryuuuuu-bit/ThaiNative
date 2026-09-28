// จำลองสมดุล: หมอยา vs ขุนศึก (แท็งก์) ที่ Lv ต่าง ๆ — ฮีล/วิ vs ดาเมจที่ผีทำ/วิ
import { newCharacter } from '../shared/charmodel.js';
import { getDerived } from '../shared/character.js';
import { STAT_PLAN, JOBS } from '../shared/data/classes.js';
import { GEAR, GEAR_IDS } from '../shared/data/gear.js';
import { PASSIVES } from '../shared/data/passives.js';
import { MONSTERS } from '../shared/data/monsters.js';
import { SKILLS, skillStats } from '../shared/data/skills.js';
import { POINTS_PER_LEVEL } from '../shared/stats.js';

function build(job, L) {
  const c = newCharacter('sim', { gender: 'male' });
  c.level = L;
  const pts = (L - 1) * POINTS_PER_LEVEL, plan = STAT_PLAN[job];
  for (const [k, w] of Object.entries(plan)) c.stats[k] += Math.round(pts * w);
  const best = (type) => GEAR_IDS.filter((id) => GEAR[id].job === job && GEAR[id].type === type && GEAR[id].lv <= L && !GEAR[id].legend).sort((a, b) => GEAR[b].lv - GEAR[a].lv)[0];
  c.equipment = { ...c.equipment, weapon: best('weapon'), armor: best('armor'), accessory: best('accessory'), accessory2: best('accessory'), helm: best('helm'), gloves: best('gloves'), boots: best('boots'), belt: best('belt') };
  c.appearance.job = job;
  c.passives = ['root', ...Object.keys(PASSIVES).filter((id) => PASSIVES[id].branch === job)].slice(0, L);
  return getDerived(c);
}
const mobNear = (L) => Object.entries(MONSTERS).filter(([, m]) => !m.boss && m.level).sort((a, b) => Math.abs(a[1].level - L) - Math.abs(b[1].level - L))[0];
for (const L of [10, 30, 60, 90]) {
  const h = build('healer', L), t = build('swordman', L), [mid, m] = mobNear(L);
  const hit = Math.max(1, m.atk - t.def * 0.5), dps1 = hit / ((m.attackCooldown || 1200) / 1000);
  const sk = (id) => skillStats(SKILLS.healer.find((s) => s.id === id), 5);
  const vine = sk('heal_vine'), seed = sk('heal_seed'), pill = sk('heal_pill'), mortar = sk('heal_mortar');
  const vineTick = h.matk * vine.hmult, vineHps = vineTick * vine.nearMul * 1000 / vine.tick;
  console.log(`Lv${L} healer matk ${h.matk} hp ${h.maxHp} mp ${h.maxMp} | tank hp ${t.maxHp} def ${t.def} | mob ${mid}(${m.level}) hit ${Math.round(hit)} dps(1 mob) ${Math.round(dps1)}`);
  console.log(`   vine tick ${Math.round(vineTick)} (near ${Math.round(vineTick * vine.nearMul)}) hps ${Math.round(vineHps)} total ${Math.round(vineTick * vine.nearMul * vine.duration / vine.tick)} (${Math.round(vineTick * vine.nearMul * vine.duration / vine.tick / t.maxHp * 100)}% tank) cd ${vine.cd}`);
  console.log(`   seed ${Math.round(h.matk * seed.hmult)} (${Math.round(h.matk * seed.hmult / t.maxHp * 100)}%) · pill per ally ${Math.round(h.matk * pill.hmult)} · mortar ${Math.round(h.matk * mortar.hmult)}-${Math.round(h.matk * mortar.hmult * 1.5)} · khwan ${Math.round(t.maxHp * sk('heal_khwan').heal)}`);
  const dmgBasic = h.matk * JOBS.healer.attack.mult, mageM = build('mage', L).matk * JOBS.mage.attack.mult;
  console.log(`   basic hit healer ${Math.round(dmgBasic)} vs mage ${Math.round(mageM)} · mob hp ${m.hp}`);
}
