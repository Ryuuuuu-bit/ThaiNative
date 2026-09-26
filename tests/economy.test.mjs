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
assert.equal(m.inventory.length, 1); assert.equal(m.gold, 0); assert.ok(m.hp > 0);

// 9) บอสภาค 5 ตัว + สูตรหลอมครบทุกชิ้น drop
assert.equal(REGION_BOSS_IDS.length, 5);
for (const id of REGION_BOSS_IDS) assert.ok(MONSTERS[id].regionBoss && MONSTERS[id].hp > 1000 && MAPS[MONSTERS[id].mapId]);
assert.equal(FORGE.filter((r) => !r.util).length, 60);
for (const r of FORGE) for (const need of Object.keys(r.need)) assert.ok(ITEMS[need], `วัตถุดิบ ${need}`);
assert.equal(grant(newCharacter('x', {}), { exp: 40 }).ups, 1);

console.log('✔ economy tests passed');
