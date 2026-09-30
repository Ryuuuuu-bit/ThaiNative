// ทดสอบระบบเศรษฐกิจฝั่ง server (ใช้ร่วม client):  node tests/economy.test.mjs
import assert from 'node:assert/strict';
import { newCharacter, migrate } from '../shared/charmodel.js';
import { runAction, grantKill, grant, count } from '../shared/economy.js';
import { setInfo } from '../shared/data/gear.js';
import { checkTitles } from '../shared/data/titles.js';
import { MAPS, REGION_BOSS_IDS } from '../shared/data/maps.js';
import { MONSTERS } from '../shared/data/monsters.js';
import { FORGE } from '../shared/data/crafting.js';
import { ITEMS } from '../shared/data/items.js';

let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const ctx = (x, extra = {}) => ({ rnd, now: Date.now(), x, sess: {}, ...extra });

// 1) ตัวละครใหม่ + ซื้อของต้องยืนใกล้ร้าน · เงินไม่พอซื้อไม่ได้
const c = newCharacter('ทดสอบ', {});
assert.equal(c.gold, 150);
assert.equal(runAction(c, 'buy', { shop: 'mae_kha', id: 'hp_s', qty: 2 }, ctx(0)).ok, false, 'ไกลร้าน');
assert.equal(runAction(c, 'buy', { shop: 'mae_kha', id: 'hp_s', qty: 2 }, ctx(720)).ok, true);
assert.equal(c.gold, 100);
c.gold = 5;
assert.equal(runAction(c, 'buy', { shop: 'mae_kha', id: 'hp_s', qty: 1 }, ctx(720)).msg, 'เงินไม่พอ');
assert.equal(runAction(c, 'buy', { shop: 'kru_sword', id: 'hp_s' }, ctx(-200)).ok, false, 'ร้านไม่มีของนี้');
assert.equal(runAction(c, 'nope', {}, ctx(0)).ok, false);
assert.equal(runAction(c, '__proto__', {}, ctx(0)).ok, false);

// 2) สวมใส่: เลเวลไม่ถึงไม่ได้ · เครื่องประดับ 2 ช่อง · เซ็ตโบนัส
c.inventory.push({ id: 'g_sword_w08', qty: 1 }, { id: 'g_sword_a08', qty: 1 }, { id: 'g_sword_c08', qty: 1 }, { id: 'g_sword_c10', qty: 1 });
assert.equal(runAction(c, 'equip', { id: 'g_sword_w08' }).ok, false, 'Lv.14 ยังใส่ไม่ได้');
c.level = 20;
for (const id of ['g_sword_w08', 'g_sword_a08', 'g_sword_c08', 'g_sword_c10']) assert.equal(runAction(c, 'equip', { id }).ok, true);
assert.equal(c.equipment.accessory2, 'g_sword_c10');
const si = setInfo(c.equipment);
assert.equal(si.n, 4); assert.equal(si.lv, 14); assert.ok(si.bonus.crit > 0);

// 3) ตีบวก: หักของ/เงิน ตาม ENHANCE · ตีพลาดต่ำกว่า +10 ไม่ลด
c.gold = 100000; c.inventory.push({ id: 'black_iron', qty: 50 });
let ok = 0;
for (let i = 0; i < 30; i++) { const r = runAction(c, 'enhance', { slot: 'weapon' }, ctx(846)); if (r.success) ok++; assert.ok(c.enhance.weapon >= 0); }
assert.ok(ok > 0 && c.gold < 100000);
assert.equal(runAction(c, 'enhance', { slot: 'weapon' }, ctx(0)).ok, false, 'ต้องอยู่ใกล้ลุงดำ');

// 4) รางวัลฆ่าผี: EXP/เงิน/ของ + เควส + ค่าหัว + ฉายา
const k = newCharacter('นักล่า', {});
runAction(k, 'qAccept', { id: 'q_tuay' });
for (let i = 0; i < 8; i++) grantKill(k, { mon: 'phi_tuay_kaew', exp: 10, gold: 3, items: [{ id: 'glass_shard', qty: 1 }] });
assert.equal(k.quests.active.q_tuay, 8); assert.equal(count(k, 'glass_shard'), 8); assert.equal(k.rec.kills, 8);
assert.equal(runAction(k, 'qClaim', { id: 'q_tuay' }, ctx(0)).ok, false, 'ต้องอยู่ใกล้ผู้ใหญ่ชัย');
const cl = runAction(k, 'qClaim', { id: 'q_tuay' }, ctx(520));
assert.ok(cl.ok && k.quests.done.includes('q_tuay') && count(k, 'hp_s') === 3 + 5);
for (let i = 0; i < 92; i++) grantKill(k, { mon: 'kuman_thong', exp: 1, gold: 0, items: [] });
assert.ok(k.titles.includes('hunt100'), 'ฉายานักล่าผี');

// 5) เทรด/ระหว่างเทรดใช้ของไม่ได้ · ตาย/GM
assert.equal(runAction(k, 'use', { id: 'hp_s' }, ctx(0, { trade: true })).ok, false);
assert.equal(runAction(k, 'gm', { cmd: 'gold' }, ctx(0)).ok, false, 'ไม่ใช่แอดมิน');
assert.equal(runAction(k, 'gm', { cmd: 'gold', a1: '10' }, ctx(0, { admin: true })).ok, true);

// 6) ตกปลา/สมุนไพร/หีบ: จำกัดความถี่ · ต้องมีปลากินเบ็ดก่อน
const f = newCharacter('ชาวประมง', {}), sess = {};
assert.equal(runAction(f, 'fishLand', {}, ctx(-600, { sess })).ok, false);
assert.equal(runAction(f, 'fishBite', {}, ctx(-600, { sess })).ok, true);
assert.equal(runAction(f, 'fishBite', {}, ctx(-600, { sess })).ok, false, 'ถี่เกิน');
assert.equal(runAction(f, 'fishLand', {}, ctx(-600, { sess, now: Date.now() + 500 })).ok, true);
assert.equal(f.inventory.some((s) => ITEMS[s.id].type === 'fish' || s.id === 'junk_boot'), true);
assert.equal(runAction(f, 'chest', {}, ctx(MAPS.m1.minX + 500, { sess: { joinAt: Date.now() } })).ok, false, 'เข้าเกมใหม่ยังไม่มีหีบ');

// 7) ฉายา/ย้อมสี/recall
assert.equal(runAction(f, 'title', { id: 'lv30' }).ok, false);
assert.equal(runAction(f, 'title', { id: 'rookie' }).ok, true); assert.equal(f.appearance.title, 'rookie');
f.gold = 1000;
assert.equal(runAction(f, 'dye', { part: 'hair', v: 4 }, ctx(380)).ok, true); assert.equal(f.appearance.hair, 4);
assert.equal(runAction(f, 'recall', { to: 'hunt' }).ok, false, 'ยังไม่มีจุดล่า');
f.lastHunt = 'm3';
assert.equal(runAction(f, 'recall', { to: 'hunt' }).ok, false, 'เลเวลไม่ถึง');
f.lastHunt = 'm1';
assert.deepEqual(runAction(f, 'recall', { to: 'hunt' }).to, 'm1'); assert.equal(count(f, 'yant_home'), 2);

// 8) migrate: เซฟพัง/ของปลอมถูกตัดออก
const m = migrate({ name: 'เก่า', appearance: {}, level: 3, inventory: [{ id: 'fake_item', qty: 9 }, { id: 'hp_s', qty: 2 }], gold: 'abc', v: 2, skills: null });
assert.deepEqual(m.inventory.map((s) => s.id).sort(), ['hand_wrap', 'hp_s'], 'ของปลอมถูกตัด · ได้ผ้าพันมือที่ตกหล่น'); assert.equal(m.gold, 0); assert.ok(m.hp > 0);

// 9) บอสภาค 5 ตัว + สูตรหลอมครบทุกชิ้น drop
assert.equal(REGION_BOSS_IDS.length, 5);
for (const id of REGION_BOSS_IDS) assert.ok(MONSTERS[id].regionBoss && MONSTERS[id].hp > 1000 && MAPS[MONSTERS[id].mapId]);
assert.ok(FORGE.filter((r) => !r.util).length >= 60, 'สูตรสร้างอุปกรณ์ (เดิม 60 · ตอนนี้รวมอุปกรณ์ทุกสาย Lv.22–150)');
assert.equal(new Set(FORGE.map((r) => r.out)).size, FORGE.length, 'สูตรไม่ซ้ำ'); for (const r of FORGE) assert.ok(ITEMS[r.out], `ของที่ได้ ${r.out}`);
for (const r of FORGE) for (const need of Object.keys(r.need)) assert.ok(ITEMS[need], `วัตถุดิบ ${need}`);
assert.equal(grant(newCharacter('x', {}), { exp: 40 }).ups, 1);

// 10) แคป EXP ตามช่วงเลเวล (แพตช์ #21)
import { mobExp, expLevelMul, expToNext as e2n } from '../shared/stats.js';
assert.equal(expLevelMul(50, 50), 1); assert.equal(expLevelMul(50, 55), 1.1, 'ผีสูงกว่า 5 เลเวล โบนัส +10%'); assert.equal(expLevelMul(50, 45), 1);
assert.equal(expLevelMul(50, 60), 1.2, 'ผีสูงกว่า 10 เลเวล โบนัสเต็ม +20%'); assert.equal(expLevelMul(50, 61), 1.1, 'เกิน 10 เลเวลเริ่มลด');
{ const { mobAtkMul } = await import('../shared/stats.js');
  assert.equal(mobAtkMul(10), 1, 'ผีมือใหม่ไม่แรงขึ้น'); assert.equal(mobAtkMul(30), 1.35); assert.equal(mobAtkMul(150), 1.35); }
assert.equal(e2n(30), Math.floor(40 * Math.pow(30, 1.6)), 'Lv1–30 เส้นเดิม'); assert.ok(e2n(149) > 40 * Math.pow(149, 1.6) * 10, 'ช่วงท้ายชันขึ้นแบบ RO');
assert.equal(expLevelMul(60, 50), 0.5); assert.equal(expLevelMul(99, 1), 0.1, 'ผีอ่อนมาก เหลือ 10%');
assert.equal(expLevelMul(1, 57), 0.2, 'ผีเก่งมาก เหลือ 20%');
assert.ok(mobExp(895, 1, 57) <= e2n(1) * 0.2 + 1, 'ฆ่าตัวเดียวได้ไม่เกิน 20% ของหลอด');
assert.ok(mobExp(1e9, 10, 12, true) <= e2n(10), 'บอส: ไม่เกิน 1 เลเวล');

// 11) บอสโลกพระราหู: เลือด 8M/คน · รางวัล EXP แคป 1 เลเวล · เกณฑ์ขั้นต่ำขยายตามคน
import { wbHp, wbReward, WB_BASE_EXP, WB_MIN_SHARE } from '../shared/data/worldboss.js';
assert.equal(wbHp(1), 8_000_000); assert.equal(wbHp(10), 80_000_000); assert.equal(wbHp(0.25), 8_000_000, 'ขั้นต่ำ 8M');
for (const lv of [1, 10, 40, 99, 140]) {
  const R = wbReward(1, 0.5, true), base = Math.round(WB_BASE_EXP * R.expK);
  const c = newCharacter('wb', {}); c.level = lv; c.exp = 0;
  const g = grant(c, { exp: mobExp(base, lv, 150, true) });
  assert.ok(g.ups <= 1, `รางวัลราหู Lv.${lv}: ขึ้นไม่เกิน 1 เลเวล (ได้ ${g.ups})`);
}
{ const n = 200, minShare = Math.min(WB_MIN_SHARE, 0.2 / n); assert.ok(minShare < 1 / n, '200 คน: ตีเท่ากันทุกคนผ่านเกณฑ์'); }

// 12) สุสานใต้ดิน 100 ชั้น
import { CRYPT, lvOf, parseCrypt, cryptId, checkpoints, isBossFloor, isChestFloor, chestLoot, cryptMob, partyHard, hpMul } from '../shared/data/crypt.js';
assert.equal(lvOf(1), 5); assert.equal(lvOf(100), 150, 'ชั้น 100 = Lv.150');
assert.deepEqual(parseCrypt(cryptId(15, 3, 'p1-2')), { f: 15, n: 3, inst: 'p1-2' });
for (const bad of ['crypt:0:1:x', 'crypt:101:1:x', 'crypt:5:7:x', 'crypt:5:1:', 'ayutthaya', null]) assert.equal(parseCrypt(bad), null, `รหัสไม่ถูกต้อง ${bad}`);
assert.deepEqual(checkpoints(1), [1]); assert.deepEqual(checkpoints(31), [1, 11, 21, 31]); assert.equal(checkpoints(999).length, 10);
assert.ok(isBossFloor(10) && !isBossFloor(15) && isChestFloor(15) && !isChestFloor(10));
for (const f of [1, 50, 100]) for (const k of ['silver', 'gold']) {
  const L = chestLoot(f, k, () => 0.5);
  assert.ok(L.gold > 0 && L.dust > 0 && L.items.every((it) => ITEMS[it.id] && it.qty > 0), `หีบ ${k} ชั้น ${f}`);
}
{ const a = MONSTERS[cryptMob('phi_pob', 5, 1)], b = MONSTERS[cryptMob('phi_pob', 5, 3)], boss = MONSTERS[cryptMob('mae_nak', 10, 1, 'b')];
  assert.equal(a.level, lvOf(5)); assert.ok(b.hp > a.hp, 'ปาร์ตี้ใหญ่ ผีเลือดมากขึ้น'); assert.ok(boss.boss && boss.hp > a.hp);
  assert.ok(a.drops.some((d) => d.item === CRYPT.dust), 'ดรอปผงวิญญาณ'); }
assert.equal(partyHard(29, 6).hp, 1, 'ก่อนชั้น 30 ไม่เพิ่ม'); assert.ok(partyHard(100, 6).hp > partyHard(100, 2).hp); assert.equal(hpMul(1), 1);

console.log('✔ economy tests passed');
