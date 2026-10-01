// ============================================================
//  ระบบ MMO ฝั่ง server: ปาร์ตี้ · เทรด · เรดบอส · เพื่อน · ฉายา
//  ▸ ปาร์ตี้  – เชิญ/ตอบรับ/ออก/เตะ, แบ่ง EXP ให้สมาชิกที่อยู่ใกล้ (ใส่เซฟจริง)
//  ▸ เทรด    – server เป็นคนกลาง: ยื่นข้อเสนอ → ล็อก → ยืนยันทั้งสองฝ่าย → server ตรวจของแล้วแลกเอง
//  ▸ เรดบอส  – server คุม HP / AI / ท่าโจมตี / ดาเมจที่ผู้เล่นโดน / รางวัล
//  ▸ เพื่อน  – รายชื่อเก็บในเซฟ (อ้างบัญชี) · แจ้งเตือนตอนเพื่อนออนไลน์
// ============================================================
import { PARTY, WORLD } from '../shared/constants.js';
import { ITEMS } from '../shared/data/items.js';
import { tradable } from '../shared/data/trade.js';
import { LEGEND_IDS, rollGearDrop } from '../shared/data/gear.js';
import { RAID_BOSS as RB } from '../shared/data/raid.js';
import { rollDamage, mobExp, attackInterval, expToNext, buffAspd } from '../shared/stats.js';
import { combatDerived, attackSpec, attackGate, getDerived } from '../shared/character.js';
import { SKILL_BY_ID } from '../shared/data/skills.js';
import { JOBS } from '../shared/data/classes.js';
import { count, addItem, removeItem, grant, presetReserved, freeQty } from '../shared/economy.js';
import { TITLE_BY_ID, checkTitles } from '../shared/data/titles.js';
import { mapAt } from '../shared/data/maps.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const int = (v, lo, hi) => clamp(Math.floor(Number(v) || 0), lo, hi);
const MAX_FRIENDS = 50;
let seq = 1;

import { getMap } from '../shared/td/maps.js';
export function setupSocial(io, players, H = {}) {
  const { queueSync = () => {}, refresh = () => {}, hurtPlayer = () => {}, byAcc = new Map() } = H;
  const sock = (id) => io.sockets.sockets.get(id);
  const emitTo = (id, ev, data) => sock(id)?.emit(ev, data);
  const sys = (id, text) => emitTo(id, 'chat', { id: null, name: '📢 ระบบ', text });
  /** ตำแหน่งผู้เล่น (โลกอยุธยา top-down ใช้ tx/ty · โลกเดิมใช้ x อย่างเดียว) */
  const pos = (p) => (p.world === 'td' ? { x: p.tx, y: p.ty } : { x: p.x, y: 0 });
  const apart = (a, b) => { if ((a.world === 'td') !== (b.world === 'td') || (a.world === 'td' && (a.tmap || 'ayutthaya') !== (b.tmap || 'ayutthaya'))) return Infinity; const A = pos(a), B = pos(b); return Math.hypot(A.x - B.x, A.y - B.y); };

  // ===================== ปาร์ตี้ =====================
  const parties = new Map();              // partyId → { id, leader, members:Set }
  const partyInvites = new Map();         // targetId → Map(fromId → expireAt)

  /** บัฟที่ยังเหลือของผู้เล่น (ให้เพื่อนเห็นในแถบปาร์ตี้/การ์ดสมาชิก) */
  const buffsOf = (p, now) => (p.buffs || []).filter((b) => b.until > now && b.sk).slice(0, 8)
    .map((b) => ({ sk: b.sk, lv: b.lv || 1, from: b.from || p.name, left: Math.round((b.until - now) / 100) / 10, dur: Math.round((b.until - (b.at || now)) / 100) / 10 || 0 }));
  function partyState(party) {
    const now = Date.now();
    const ms = [...party.members].map((id) => players.get(id)).filter(Boolean);
    return {
      id: party.id, leader: party.leader,
      members: ms.map((p) => ({
        id: p.id, name: p.name, level: p.level, job: p.appearance.path || 'villager', wj: p.appearance.job, dead: !!p.dead, hp: Math.round(p.hp), maxHp: p.maxHp, x: Math.round(pos(p).x), y: Math.round(pos(p).y), inst: p.inst || 0,
        mp: Math.round(p.save?.mp || 0), maxMp: p.maxMp || 0, cp: p.cp || 0, title: p.save?.title || null, app: p.appearance,
        map: p.world === 'td' ? (p.tmap || 'ayutthaya') : 'side', place: whereOf(p), buffs: buffsOf(p, now),
        follow: p.follow === party.leader && p.id !== party.leader,
      })),
      followers: ms.filter((p) => p.id !== party.leader && p.follow === party.leader).length,
    };
  }
  function pushParty(party) {
    const st = partyState(party);
    for (const id of party.members) emitTo(id, 'party:state', st);
  }
  function leaveParty(pid, reason = 'leave') {
    const p = players.get(pid);
    const party = p && parties.get(p.partyId);
    if (!party) return;
    party.members.delete(pid);
    p.partyId = null; p.follow = null;
    emitTo(pid, 'party:state', null);
    for (const id of party.members) sys(id, `${p.name} ${reason === 'kick' ? 'ถูกเชิญออกจาก' : 'ออกจาก'}ปาร์ตี้`);
    if (party.members.size < 2) {
      for (const id of party.members) { const m = players.get(id); if (m) m.partyId = null; emitTo(id, 'party:state', null); }
      parties.delete(party.id);
      return;
    }
    if (party.leader === pid) setLeader(party, [...party.members][0]);
    pushParty(party);
  }
  /** เปลี่ยนหัวหน้า → คนที่ติดตามหัวหน้าเก่าหยุดตาม */
  function setLeader(party, id) {
    party.leader = id;
    for (const mid of party.members) { const m = players.get(mid); if (m) m.follow = null; }
  }
  const partyOf = (p) => (p ? parties.get(p.partyId) || null : null);

  // ===================== เทรด =====================
  const trades = new Map();
  const tradeReqs = new Map();
  const tradeOf = (pid) => trades.get(players.get(pid)?.tradeId);
  function tradeState(t) {
    return { id: t.id, a: t.a, b: t.b, offer: t.offer, locked: t.locked, confirmed: t.confirmed, readyIn: Math.max(0, (t.readyAt || 0) - Date.now()),
      names: { [t.a]: players.get(t.a)?.name, [t.b]: players.get(t.b)?.name } };
  }
  const pushTrade = (t) => { const st = tradeState(t); emitTo(t.a, 'trade:state', st); emitTo(t.b, 'trade:state', st); };
  function closeTrade(t, reason) {
    trades.delete(t.id);
    for (const id of [t.a, t.b]) { const p = players.get(id); if (p) p.tradeId = null; emitTo(id, 'trade:closed', { reason }); }
  }
  const TRADE_SLOTS = 10, TRADE_WAIT_MS = 3000;    // ช่องเทรดต่อฝั่ง · ล็อกครบแล้วต้องรอก่อนกดยืนยัน (กันสลับของแล้วกดเร็ว)
  function cleanOffer(o = {}, save) {
    const items = [];
    for (const it of Array.isArray(o.items) ? o.items.slice(0, TRADE_SLOTS) : []) {
      if (!tradable(it?.id)) continue;                                   // คัมภีร์/ของผูกตัว (bound) เทรดไม่ได้
      const qty = int(it.qty, 1, 9999);
      const ex = items.find((x) => x.id === it.id);
      if (ex) ex.qty = Math.min(9999, ex.qty + qty); else items.push({ id: it.id, qty });
    }
    for (const it of items) it.qty = Math.min(it.qty, freeQty(save, it.id));   // ไม่เกินที่ขายได้จริง: ของล็อก/ของชุด A-B เทรดไม่ได้ (เหมือนตลาด)   // เสนอได้ไม่เกินที่มีจริง (ของที่จองไว้ในชุด A/B อีกชุดเทรดไม่ได้)
    return { items: items.filter((it) => it.qty > 0), gold: Math.min(int(o.gold, 0, 1e9), Math.max(0, save.gold)) };
  }
  const hasOffer = (save, o) => save.gold >= o.gold && o.items.every((it) => freeQty(save, it.id) >= it.qty);
  /** แลกของจริงที่ server (ทั้งสองฝั่งพร้อมกัน) */
  function executeTrade(t) {
    const A = players.get(t.a), B = players.get(t.b);
    if (!A || !B) return closeTrade(t, 'อีกฝ่ายออกจากเกม');
    const oa = t.offer[t.a], ob = t.offer[t.b];
    if (!hasOffer(A.save, oa)) return closeTrade(t, `${A.name} มีของไม่ครบตามข้อเสนอ – ยกเลิกการเทรด`);
    if (!hasOffer(B.save, ob)) return closeTrade(t, `${B.name} มีของไม่ครบตามข้อเสนอ – ยกเลิกการเทรด`);
    const move = (from, to, o) => {
      for (const it of o.items) { removeItem(from.save, it.id, it.qty); addItem(to.save, it.id, it.qty, false); }   // การ์ดจากเทรดไม่นับสมุดสะสม (กันส่งวนแชร์โบนัส)
      from.save.gold -= o.gold; to.save.gold += o.gold;
    };
    move(A, B, oa); move(B, A, ob);
    for (const p of [A, B]) { refresh(p); queueSync(p); }
    trades.delete(t.id);
    A.tradeId = B.tradeId = null;
    emitTo(t.a, 'trade:complete', { give: oa, get: ob, with: B.name });
    emitTo(t.b, 'trade:complete', { give: ob, get: oa, with: A.name });
    console.log(`[trade] ${A.name} ⇄ ${B.name}`, JSON.stringify({ a: oa, b: ob }));
  }

  // ===================== เรดบอส =====================
  const boss = {
    alive: false, hp: 0, maxHp: RB.maxHp, x: RB.spawnX, y: WORLD.groundY, dir: -1, anim: 'walk',
    respawnAt: Date.now() + Number(process.env.RAID_SPAWN_MS ?? 15000), nextAttackAt: 0, attacking: null, contrib: new Map(), lastTick: Date.now(), waves: [],
  };
  const inArena = (p) => p.world !== 'td' && p.x >= RB.arena[0] - 40 && p.x <= RB.arena[1] && !p.dead && p.hp > 0;

  function spawnBoss() {
    const n = [...players.values()].filter(inArena).length;
    boss.maxHp = Number(process.env.RAID_HP) || RB.maxHp + Math.max(0, n - 1) * RB.hpPerExtraPlayer;
    Object.assign(boss, { alive: true, hp: boss.maxHp, x: RB.spawnX, dir: -1, anim: 'walk', attacking: null, poison: null, nextAttackAt: Date.now() + 2500, waves: [] });
    boss.contrib.clear();
    io.emit('raid:spawn', { maxHp: boss.maxHp });
    io.emit('chat', { id: null, name: '👹 เรดบอส', text: `${RB.nameTh} ปรากฏตัวที่ลานพญายักษ์ (สุดทางตะวันออก)!` });
  }

  function chooseAttack(target, dist, enraged) {
    if (dist < RB.attacks.slam.range + 10) return Math.random() < 0.75 ? 'slam' : 'roar';
    const r = Math.random();
    if (enraged && r < 0.35) return 'rain';
    if (r < 0.45) return 'wave';
    if (r < 0.7) return 'rain';
    return 'roar';
  }

  /** ดาเมจจากท่าบอส (server คำนวณจากตำแหน่งผู้เล่น) */
  const bossDmg = (p, base, enraged) => {
    const d = combatDerived(p.char, p.buffs);
    return Math.max(1, Math.round(base * (enraged ? 1.25 : 1) * (0.9 + Math.random() * 0.2) - d.def * 0.6));
  };
  const onGround = (p) => p.y > WORLD.groundY - 10;
  function bossImpact(a, now) {
    const fighters = [...players.values()].filter(inArena);
    if (a.type === 'slam') {
      const cx = a.x + a.dir * a.range / 2;
      for (const p of fighters) if (Math.abs(p.x - cx) <= a.range / 2 + 8 && p.y > WORLD.groundY - 50) hurtPlayer(p, bossDmg(p, a.dmg, a.enraged), { x: a.x, iframe: 500 });
    } else if (a.type === 'roar') {
      for (const p of fighters) if (Math.abs(p.x - a.x) <= a.range) hurtPlayer(p, bossDmg(p, a.dmg, a.enraged), { x: a.x, stun: 900, iframe: 500 });
    } else if (a.type === 'rain') {
      boss.rain = { at: now + 260, spots: a.spots, dmg: a.dmg, enraged: a.enraged };
    } else if (a.type === 'wave') {
      for (const dir of [-1, 1]) boss.waves.push({ x: a.x, prev: a.x, dir, speed: a.speed, end: a.x + dir * a.range, dmg: a.dmg, enraged: a.enraged, hit: new Set() });
    }
  }
  function tickHazards(now, dt) {
    if (boss.rain && now >= boss.rain.at) {
      const r = boss.rain; boss.rain = null;
      for (const p of players.values()) if (inArena(p) && r.spots.some((x) => Math.abs(p.x - x) < 24)) hurtPlayer(p, bossDmg(p, r.dmg, r.enraged), { x: p.x, iframe: 400 });
    }
    for (const w of boss.waves) {
      w.prev = w.x;
      w.x += w.dir * w.speed * dt;
      const lo = Math.min(w.prev, w.x) - 10, hi = Math.max(w.prev, w.x) + 10;
      for (const p of players.values()) {
        if (!inArena(p) || w.hit.has(p.id) || !onGround(p) || p.x < lo || p.x > hi) continue;
        w.hit.add(p.id);
        hurtPlayer(p, Math.max(1, Math.round(w.dmg - combatDerived(p.char, p.buffs).def * 0.6)), { x: w.x - w.dir * 10, iframe: 400 });
      }
      if ((w.dir > 0 && w.x >= w.end) || (w.dir < 0 && w.x <= w.end)) w.done = true;
    }
    boss.waves = boss.waves.filter((w) => !w.done);
  }

  function tickBoss(now) {
    const dt = Math.min(0.2, (now - boss.lastTick) / 1000);
    boss.lastTick = now;
    tickHazards(now, dt);
    if (boss.alive && boss.poison && now >= boss.poison.next) {
      const q = boss.poison, p = players.get(q.by);
      if (p && q.left > 0) { applyBossDamage(p, q.per, false, true); q.left--; q.next = now + q.every; }
      if (!p || q.left <= 0) boss.poison = null;
    }
    if (!boss.alive) {
      if (now >= boss.respawnAt && [...players.values()].some((q) => q.world === 'side')) spawnBoss();   // เรดบอสโลกเดิม: ปิดแล้ว (ทุกคนอยู่โลก top-down ซึ่งมีบอสประจำโซนของตัวเอง)
      return;
    }
    const fighters = [...players.values()].filter(inArena);
    const enraged = boss.hp / boss.maxHp < RB.enrageAt;
    if (boss.attacking) {
      if (now >= boss.attacking.at) {
        io.emit('raid:impact', boss.attacking);
        bossImpact(boss.attacking, now);
        boss.attacking = null;
        boss.anim = 'walk';
      }
      return;
    }
    if (!fighters.length) {
      const dx = RB.spawnX - boss.x;
      if (Math.abs(dx) > 4) { boss.dir = Math.sign(dx); boss.x += boss.dir * RB.speed * dt; }
      boss.hp = Math.min(boss.maxHp, boss.hp + boss.maxHp * 0.02 * dt);
      return;
    }
    const target = fighters.reduce((a, b) => (Math.abs(a.x - boss.x) < Math.abs(b.x - boss.x) ? a : b));
    const dist = Math.abs(target.x - boss.x);
    boss.dir = target.x < boss.x ? -1 : 1;
    if (now >= boss.nextAttackAt) {
      const type = chooseAttack(target, dist, enraged);
      const A = RB.attacks[type];
      const windup = Math.round(A.windup * (enraged ? 0.75 : 1));
      const atk = { type, x: Math.round(boss.x), dir: boss.dir, windup, at: now + windup, dmg: A.dmg, range: A.range, speed: A.speed || 0, enraged };
      if (type === 'rain') {
        atk.spots = fighters.slice(0, A.count).map((p) => Math.round(p.x));
        while (atk.spots.length < A.count) atk.spots.push(Math.round(clamp(boss.x + (Math.random() - 0.5) * 500, RB.arena[0], RB.arena[1] - 10)));
      }
      boss.attacking = atk;
      boss.anim = 'attack';
      boss.nextAttackAt = now + windup + A.cd * (enraged ? 0.65 : 1);
      io.emit('raid:attack', atk);
      return;
    }
    if (dist > 55) boss.x = clamp(boss.x + boss.dir * RB.speed * (enraged ? 1.5 : 1) * dt, RB.arena[0] + 30, RB.arena[1] - 30);
  }

  /** แบ่ง EXP ให้เพื่อนปาร์ตี้ที่อยู่ใกล้ (ใส่เซฟจริง) */
  /** แมพเดียวกัน (โลก top-down: แมพ/ห้องเดียวกัน · ไม่สนระยะ) */
  const sameMap = (a, b) => a.world === 'td' && b.world === 'td' && (a.tmap || 'ayutthaya') === (b.tmap || 'ayutthaya');
  /** เพื่อนปาร์ตี้ที่อยู่แมพเดียวกัน (ไม่นับตัวเอง) */
  function partyMates(p) {
    const party = partyOf(p); if (!party) return [];
    return [...party.members].map((id) => players.get(id)).filter((m) => m && m.id !== p.id && m.save && sameMap(m, p));
  }
  /** ตัวคูณ EXP ปาร์ตี้: +10% ต่อเพื่อนในแมพเดียวกัน (6 คน = +50%) */
  const partyBonus = (p) => 1 + PARTY.mapBonus * partyMates(p).length;
  function shareExp(p, exp, exclude = [], mobLv = null) {
    const party = partyOf(p);
    if (!party) return;
    if (!(exp * PARTY.shareRatio >= 1)) return;
    for (const id of party.members) {
      const m = players.get(id);
      if (id === p.id || !m?.save || exclude.includes(id) || m.dead) continue;
      if (!sameMap(m, p) && apart(m, p) > PARTY.shareRange) continue;      // top-down: แมพเดียวกันได้ทั้งแมพ · โลกด้านข้างเดิม: ตามระยะ
      // แคปตามช่วงเลเวลของ "เพื่อนแต่ละคน" (เวลห่างจากผีมาก = ได้น้อย · กันพาเวล) × โบนัสปาร์ตี้แมพเดียวกัน
      const mult = sameMap(m, p) ? partyBonus(m) : 1;
      const share = Math.round((mobLv != null ? mobExp(exp * PARTY.shareRatio, m.save.level, mobLv) : exp * PARTY.shareRatio) * mult);
      if (!share) continue;
      const g = grant(m.save, { exp: share });
      refresh(m); queueSync(m);
      emitTo(id, 'party:exp', { amount: share, from: p.name, ups: g.ups, bonus: Math.round((mult - 1) * 100) });
    }
  }

  function hitBoss(p, d) {
    if (!boss.alive || !inArena(p) || !p.char) return;
    if (Math.abs(p.x - boss.x) > 650) return;
    const now = Date.now();
    p.raidTokens = Math.min(12, (p.raidTokens ?? 12) + ((now - (p.raidT || now)) / 1000) * 12);
    p.raidT = now;
    if (p.raidTokens < 1) return;
    p.raidTokens -= 1;
    const sk = typeof d?.sk === 'string' ? d.sk : null;
    const gate = attackGate(p, sk, !!d?.combo, now);
    if (!gate) return;
    const spec = attackSpec(p.char, p.appearance?.job, sk, gate === 'combo');
    if (!spec) return;
    const r = rollDamage(combatDerived(p.char, p.buffs, now), { def: RB.def, eva: RB.eva }, spec.kind, spec.mult);
    if (!r.hit) return io.to(p.id).emit('raid:dmg', { id: p.id, hit: false, dmg: 0, crit: false, hp: Math.round(boss.hp) });
    applyBossDamage(p, r.dmg, r.crit, false);
    if (spec.effect?.poison && boss.alive) {
      const { ticks, every, ratio } = spec.effect.poison;
      boss.poison = { by: p.id, per: Math.max(1, Math.round(r.dmg * ratio)), left: ticks, every, next: now + every };
    }
  }
  function applyBossDamage(p, dmg, crit, poison) {
    boss.hp = Math.max(0, boss.hp - dmg);
    boss.contrib.set(p.id, (boss.contrib.get(p.id) || 0) + dmg);
    io.volatile.emit('raid:dmg', { id: p.id, dmg, crit, poison, hit: true, hp: Math.round(boss.hp) });
    if (boss.hp <= 0) defeatBoss(p);
  }

  function defeatBoss(killer) {
    boss.alive = false;
    boss.poison = null;
    boss.attacking = null;
    boss.waves = []; boss.rain = null;
    boss.anim = 'die';
    boss.respawnAt = Date.now() + RB.respawnMs;
    const total = [...boss.contrib.values()].reduce((a, b) => a + b, 0) || 1;
    const ranking = [...boss.contrib.entries()].sort((a, b) => b[1] - a[1]);
    for (const [id, dmg] of ranking) {
      const share = dmg / total, p = players.get(id);
      if (share < 0.01 || !p?.save) continue;
      const mult = 0.5 + Math.min(1, share * 2);
      const items = RB.rewards.items.map(([iid, q]) => ({ id: iid, qty: q }));
      for (const [iid, chance] of RB.rewards.rare) if (Math.random() < chance) items.push({ id: iid, qty: 1 });
      const rank = ranking.findIndex((r) => r[0] === id) + 1, pj = p.save.path;
      if (Math.random() < (rank === 1 ? 0.12 : 0.04)) {
        const pool = LEGEND_IDS.filter((g) => !pj || ITEMS[g].job === pj);
        items.push({ id: pool[Math.floor(Math.random() * pool.length)], qty: 1 });
      }
      if (Math.random() < 0.35) { const g = rollGearDrop(28, 1 / 0.012); if (g) items.push({ id: g, qty: 1 }); }
      const r = { exp: Math.round(RB.rewards.exp * mult), gold: Math.round(RB.rewards.gold * mult), items };
      p.save.rec ||= {}; p.save.rec.boss = (p.save.rec.boss || 0) + 1;
      if (rank === 1) p.save.rec.raidTop = (p.save.rec.raidTop || 0) + 1;
      const g = grant(p.save, r);
      refresh(p); queueSync(p);
      emitTo(id, 'raid:reward', { ...r, ...g, share: Math.round(share * 100), rank });
      if (g.titles?.length) announceTitles(p, g.titles);
    }
    const top = ranking.slice(0, 3).map(([id, dmg]) => `${players.get(id)?.name ?? '?'} (${dmg})`).join(', ');
    io.emit('raid:defeated', { killer: killer.name, respawnMs: RB.respawnMs });
    io.emit('chat', { id: null, name: '👹 เรดบอส', text: `${killer.name} ปิดฉาก${RB.nameTh}! ดาเมจสูงสุด: ${top}` });
  }

  // ===================== เพื่อน =====================
  /** ชื่อที่อยู่ของผู้เล่น (แมพ · โซน) */
  function whereOf(q) {
    if (q.world !== 'td') return mapAt(q.x).nameTh;
    const M = getMap(q.tmap), z = M.ZONES[M.zoneAt(q.tx, q.ty)]?.nameTh;
    return M.realm ? `${M.nameTh}${z && z !== M.nameTh ? ` · ${z}` : ''}` : z || M.nameTh;
  }
  /** รายชื่อผู้เล่นออนไลน์ทั้งเซิร์ฟ (ทุกแมพ · ให้เชิญปาร์ตี้/เพิ่มเพื่อน/กระซิบข้ามแมพได้) */
  function onlineList(p) {
    const out = [];
    for (const q of players.values()) {
      if (q.id === p.id || !q.name || !q.save) continue;
      out.push({ id: q.id, name: q.name, level: q.level || 1, job: q.appearance?.path || null, map: q.world === 'td' ? (q.tmap || 'ayutthaya') : 'side', where: whereOf(q), party: !!q.partyId });
      if (out.length >= 200) break;
    }
    return out;
  }
  function friendsState(p) {
    return (p.save.friends || []).map((f) => {
      const q = players.get(byAcc.get(f.acc));
      if (q) f.name = q.name;
      return { acc: f.acc, name: f.name, online: !!q, id: q?.id || null, level: q?.level || null, map: q ? whereOf(q) : null, job: q?.appearance?.path || null };
    });
  }
  function pushFriends(p) { emitTo(p.id, 'friends:state', friendsState(p)); }
  /** ใครมีเราในรายชื่อเพื่อน → แจ้งเข้า/ออก */
  function notifyFriendsOf(p, online) {
    for (const q of players.values()) {
      if (q.id === p.id || !(q.save.friends || []).some((f) => f.acc === p.acc)) continue;
      sys(q.id, `👥 เพื่อนของคุณ ${p.name} ${online ? 'ออนไลน์แล้ว' : 'ออฟไลน์แล้ว'}`);
      pushFriends(q);
    }
  }

  /** ฉายาใหม่ → ประกาศ */
  function announceTitles(p, ids) {
    for (const id of ids) {
      const t = TITLE_BY_ID[id];
      if (!t || id === 'rookie') continue;
      emitTo(p.id, 'title:new', { id });
      if (['rich', 'lg_rich'].includes(id) || (t.dynamic && !['cp_top1', 'lv_top1', 'enh_top1'].includes(id))) continue;   // ฉายาเงิน: ไม่ประกาศ (ไม่บอกว่าใครรวย)
      if (t.cat === 'legend') io.emit('chat', { id: null, name: '✦ ตำนาน', text: `${p.name} ได้รับฉายาตำนาน “${t.nameTh}” — ${t.hint}!!` });   // ฉายาตำนาน: ประกาศพร้อมเงื่อนไข
      else io.emit('chat', { id: null, name: '🏅 ฉายา', text: `${p.name} ได้รับฉายา “${t.nameTh}”` });
    }
  }

  // ===================== socket events =====================
  function onConnection(socket) {
    const me = () => players.get(socket.id);

    // ---------- ปาร์ตี้ ----------
    socket.on('party:invite', ({ id } = {}) => {
      const p = me(), t = players.get(id);
      if (!p || !t || t.id === p.id) return;
      if (t.partyId) return sys(p.id, `${t.name} อยู่ในปาร์ตี้อื่นแล้ว`);
      const party = parties.get(p.partyId);
      if (party && party.members.size >= PARTY.maxSize) return sys(p.id, 'ปาร์ตี้เต็มแล้ว');
      if (p.inst) return sys(p.id, 'อยู่ในดันเจี้ยน เชิญเพิ่มไม่ได้');
      if (!partyInvites.has(t.id)) partyInvites.set(t.id, new Map());
      partyInvites.get(t.id).set(p.id, Date.now() + 30000);
      emitTo(t.id, 'party:invite', { fromId: p.id, fromName: p.name });
      sys(p.id, `ส่งคำเชิญเข้าปาร์ตี้ถึง ${t.name} แล้ว`);
    });
    socket.on('party:respond', ({ fromId, accept } = {}) => {
      const p = me(), inv = partyInvites.get(socket.id), exp = inv?.get(fromId);
      inv?.delete(fromId);
      const from = players.get(fromId);
      if (!p || !from || !exp || exp < Date.now()) return;
      if (!accept) return sys(fromId, `${p.name} ปฏิเสธคำเชิญ`);
      if (p.inst || from.inst) return sys(p.id, 'อีกฝ่ายอยู่ในดันเจี้ยน');
      const cur = parties.get(from.partyId);
      if (cur && cur.members.size >= PARTY.maxSize) return sys(p.id, 'ปาร์ตี้เต็มแล้ว');
      if (cur?.members.has(p.id)) return;
      if (p.partyId) leaveParty(p.id);
      let party = parties.get(from.partyId);
      if (!party) {
        party = { id: `pt${seq++}`, leader: from.id, members: new Set([from.id]) };
        parties.set(party.id, party);
        from.partyId = party.id;
      }
      if (party.members.size >= PARTY.maxSize) return sys(p.id, 'ปาร์ตี้เต็มแล้ว');
      party.members.add(p.id);
      p.partyId = party.id;
      for (const id of party.members) sys(id, `${p.name} เข้าร่วมปาร์ตี้`);
      pushParty(party);
    });
    socket.on('party:leave', () => leaveParty(socket.id));
    socket.on('party:kick', ({ id } = {}) => {
      const p = me(), party = p && parties.get(p.partyId);
      if (party && party.leader === p.id && party.members.has(id) && id !== p.id) leaveParty(id, 'kick');
    });
    socket.on('party:lead', ({ id } = {}) => {                        // มอบหัวหน้า
      const p = me(), party = p && parties.get(p.partyId), t = players.get(id);
      if (!party || party.leader !== p.id || !t || !party.members.has(id) || id === p.id) return;
      setLeader(party, id);
      for (const mid of party.members) sys(mid, `👑 ${t.name} เป็นหัวหน้าปาร์ตี้คนใหม่`);
      pushParty(party);
    });
    socket.on('party:follow', ({ on } = {}) => {                     // ติดตามหัวหน้า (ตัวเดินฝั่ง client · server แค่นับจำนวนให้หัวหน้าเห็น)
      const p = me(), party = p && parties.get(p.partyId);
      if (!party || party.leader === p.id) return;
      const was = p.follow === party.leader;
      p.follow = on ? party.leader : null;
      if (!!on !== was && on) sys(party.leader, `🧭 ${p.name} กำลังติดตามคุณ`);
      pushParty(party);
    });
    socket.on('party:inspect', ({ id } = {}, cb) => {                 // ดูอุปกรณ์เพื่อนร่วมปาร์ตี้
      const p = me(), party = p && parties.get(p.partyId), t = players.get(id);
      if (typeof cb !== 'function') return;
      if (!party || !t || !party.members.has(id)) return cb(null);
      const c = t.save || {};
      cb({ name: t.name, level: t.level, cp: t.cp || 0, job: t.appearance?.job || null, app: t.appearance, equipment: { ...(c.equipment || {}) }, enhance: { ...(c.enhance || {}) }, cards: { ...(c.cards || {}) } });
    });
    // ---- ดวล (PVP) ----
    socket.on('pvp:duel', ({ id } = {}) => {
      const p = me(), t = players.get(id);
      if (!p || !t || t.id === p.id || p.dead || t.dead) return;
      if (duels.has(p.id) || duels.has(t.id)) return sys(p.id, 'อีกฝ่าย (หรือคุณ) กำลังดวลอยู่');
      if (p.tradeId || t.tradeId) return sys(p.id, 'กำลังเทรดอยู่ ดวลไม่ได้');
      if (apart(p, t) > 400) return sys(p.id, 'ต้องอยู่ใกล้กัน (แมพเดียวกัน) ถึงจะท้าดวลได้');
      if (!duelReqs.has(t.id)) duelReqs.set(t.id, new Map());
      duelReqs.get(t.id).set(p.id, Date.now() + 30000);
      emitTo(t.id, 'pvp:request', { fromId: p.id, fromName: p.name });
      sys(p.id, `⚔️ ส่งคำท้าดวลถึง ${t.name} แล้ว`);
    });
    socket.on('pvp:respond', ({ fromId, accept } = {}) => {
      const p = me(), req = duelReqs.get(socket.id), exp = req?.get(fromId);
      req?.delete(fromId);
      const f = players.get(fromId);
      if (!p || !f || !exp || exp < Date.now()) return;
      if (!accept) return sys(fromId, `${p.name} ปฏิเสธคำท้าดวล`);
      if (duels.has(p.id) || duels.has(f.id) || apart(p, f) > 500) return sys(fromId, 'เริ่มดวลไม่ได้ (ไกลเกินไป หรือติดดวลอื่น)');
      const until = Date.now() + DUEL_MS;
      duels.set(p.id, { foe: f.id, until });
      duels.set(f.id, { foe: p.id, until });
      for (const [q, o] of [[p, f], [f, p]]) emitTo(q.id, 'pvp:state', { phase: 'start', foe: o.id, foeName: o.name, ms: DUEL_MS });
    });
    /** โจมตีคู่ดวล: client แจ้งทุกการเหวี่ยง/ร่าย · server ตรวจระยะ+คูลดาวน์+ว่าร่ายจริง แล้วทอยดาเมจเอง */
    socket.on('pvp:hit', ({ sk } = {}) => {
      const p = me(), d = p && duels.get(p.id);
      if (!p || !d || p.dead) return;
      const t = players.get(d.foe);
      if (!t || t.dead) return;
      const r = strike(p, t, sk, 'pvpAtk', Date.now());
      if (!r) return;
      emitTo(p.id, 'pvp:dmg', { id: t.id, dmg: r.dmg, crit: r.crit, miss: !r.hit });
      if (!r.hit) return;
      if (t.hp - r.dmg <= t.maxHp * DUEL_END_HP) {             // น็อก: จบดวลก่อนถึงตาย (เหลือ 10%)
        t.hp = Math.max(1, Math.round(t.maxHp * DUEL_END_HP));
        t.hpDirty = true;
        return endDuel(p.id, p.id, 'น็อก');
      }
      hurtPlayer(t, r.dmg, { hit: true, crit: r.crit, x: Math.round(pos(t).x), force: true, td: true, iframe: 200 });
    });
    // ---- PK (หัวแดง) ----
    socket.on('pk:mode', ({ on } = {}) => {
      const p = me(); if (!p) return;
      if (on && !pkEnabled) return emitTo(p.id, 'pk:mode', { on: false, msg: 'ระบบ PK ปิดอยู่' });
      if (on && (p.level || 1) < PK_LV) return emitTo(p.id, 'pk:mode', { on: false, msg: `ต้อง Lv.${PK_LV} ขึ้นไปถึงเปิดโหมด PK ได้` });
      p.pkMode = !!on;
      emitTo(p.id, 'pk:mode', { on: p.pkMode });
    });
    socket.on('pk:hit', ({ id, sk } = {}) => {
      const p = me(), t = players.get(id), now = Date.now();
      if (!p || !t || t.id === p.id || p.dead || t.dead || !p.pkMode) return;
      const why = pkBlock(p, t, now);
      if (why) { if (now - (p.pkFailAt || 0) > 2000) { p.pkFailAt = now; emitTo(p.id, 'pk:fail', { msg: why }); } return; }
      const r = strike(p, t, sk, 'pkAtk', now);
      if (!r) return;
      emitTo(p.id, 'pvp:dmg', { id: t.id, dmg: r.dmg, crit: r.crit, miss: !r.hit });
      if (!r.hit) return;
      const wasInnocent = innocent(t, now);
      if (wasInnocent && !isRed(p)) { const had = isPurple(p, now); p.pkFlagUntil = now + PK_FLAG_MS; flagged.add(p.id); if (!had) pushPk(p); }   // ตีคนบริสุทธิ์ = ม่วง
      else if (wasInnocent) { p.pkFlagUntil = now + PK_FLAG_MS; flagged.add(p.id); }
      hurtPlayer(t, r.dmg, { hit: true, crit: r.crit, x: Math.round(pos(t).x), force: true, td: true, iframe: 200 });
      if (t.dead) onPkKill(p, t, wasInnocent);
    });
    socket.on('party:chat', (text) => {
      if (typeof text !== 'string') return;
      const p = me(), party = p && parties.get(p.partyId);
      const msg = String(text ?? '').replace(/[<>]/g, '').trim().slice(0, 120);
      if (!party || !msg || Date.now() - (p.lastChat || 0) < 500) return;
      if ((p.save?.muteUntil || 0) > Date.now()) return emitTo(p.id, 'chat', { id: null, name: '📢 ระบบ', text: 'คุณถูกห้ามแชทอยู่' });   // /gm mute
      p.lastChat = Date.now();
      for (const id of party.members) emitTo(id, 'chat', { id: p.id, name: `[ปาร์ตี้] ${p.name}`, text: msg, party: true, nm: p.name, lv: p.save?.level, gm: !!p.admin });
    });

    // ---------- เทรด ----------
    socket.on('trade:request', ({ id } = {}) => {
      const p = me(), t = players.get(id);
      if (!p || !t || t.id === p.id) return;
      if (p.tradeId || t.tradeId) return sys(p.id, 'อีกฝ่ายกำลังเทรดอยู่');
      if (apart(p, t) > 250 || (p.inst || 0) !== (t.inst || 0)) return sys(p.id, 'ต้องอยู่ใกล้กันจึงจะเทรดได้');
      if (!tradeReqs.has(t.id)) tradeReqs.set(t.id, new Map());
      tradeReqs.get(t.id).set(p.id, Date.now() + 30000);
      emitTo(t.id, 'trade:request', { fromId: p.id, fromName: p.name });
      sys(p.id, `ส่งคำขอเทรดถึง ${t.name} แล้ว`);
    });
    socket.on('trade:respond', ({ fromId, accept } = {}) => {
      const p = me(), req = tradeReqs.get(socket.id), exp = req?.get(fromId);
      req?.delete(fromId);
      const from = players.get(fromId);
      if (!p || !from || !exp || exp < Date.now()) return;
      if (!accept) return sys(fromId, `${p.name} ปฏิเสธการเทรด`);
      if (p.tradeId || from.tradeId) return;
      const t = { id: `tr${seq++}`, a: from.id, b: p.id, offer: {}, locked: {}, confirmed: {} };
      for (const s of [t.a, t.b]) { t.offer[s] = { items: [], gold: 0 }; t.locked[s] = false; t.confirmed[s] = false; }
      trades.set(t.id, t);
      from.tradeId = p.tradeId = t.id;
      pushTrade(t);
    });
    socket.on('trade:offer', (o) => {
      const t = tradeOf(socket.id), p = me();
      if (!t || !p || t.locked[socket.id]) return;
      t.offer[socket.id] = cleanOffer(o, p.save);
      for (const s of [t.a, t.b]) { t.locked[s] = false; t.confirmed[s] = false; }
      pushTrade(t);
    });
    socket.on('trade:lock', () => {
      const t = tradeOf(socket.id);
      if (!t) return;
      t.locked[socket.id] = true;
      if (t.locked[t.a] && t.locked[t.b]) t.readyAt = Date.now() + TRADE_WAIT_MS;
      pushTrade(t);
    });
    socket.on('trade:confirm', () => {
      const t = tradeOf(socket.id);
      if (!t || !t.locked[t.a] || !t.locked[t.b]) return;
      if (Date.now() < (t.readyAt || 0) - 150) return pushTrade(t);        // ยังไม่ครบเวลารอ
      t.confirmed[socket.id] = true;
      if (t.confirmed[t.a] && t.confirmed[t.b]) executeTrade(t);
      else pushTrade(t);
    });
    socket.on('trade:cancel', () => { const t = tradeOf(socket.id); if (t) closeTrade(t, `${me()?.name} ยกเลิกการเทรด`); });

    // ---------- เพื่อน ----------
    socket.on('friends:get', () => { const p = me(); if (p) pushFriends(p); });
    socket.on('online:get', () => {                                  // แผงสังคม: คนออนไลน์ทุกแมพ (จำกัดความถี่ 1 ครั้ง/2 วิ)
      const p = me(); if (!p) return;
      const now = Date.now(); if (now - (p.onlineAskAt || 0) < 2000) return; p.onlineAskAt = now;
      emitTo(p.id, 'online:list', onlineList(p));
    });
    socket.on('friends:add', ({ id } = {}) => {
      const p = me(), t = players.get(id);
      if (!p || !t || t.id === p.id || !t.acc) return;
      p.save.friends ||= [];
      if (p.save.friends.some((f) => f.acc === t.acc)) return sys(p.id, `${t.name} อยู่ในรายชื่อเพื่อนแล้ว`);
      if (p.save.friends.length >= MAX_FRIENDS) return sys(p.id, `รายชื่อเพื่อนเต็ม (${MAX_FRIENDS} คน)`);
      p.save.friends.push({ acc: t.acc, name: t.name });
      p.dirty = true;
      sys(p.id, `👥 เพิ่ม ${t.name} เป็นเพื่อนแล้ว`);
      sys(t.id, `👥 ${p.name} เพิ่มคุณเป็นเพื่อน (คลิกชื่อเขาแล้วกด "เพิ่มเพื่อน" เพื่อเพิ่มกลับ)`);
      queueSync(p);
      pushFriends(p);
      const got = checkTitles(p.save);
      if (got.length) announceTitles(p, got);
    });
    socket.on('friends:del', ({ acc } = {}) => {
      const p = me();
      if (!p) return;
      p.save.friends = (p.save.friends || []).filter((f) => f.acc !== acc);
      p.dirty = true; queueSync(p); pushFriends(p);
    });

    // ---------- เรดบอส ----------
    socket.on('raid:hit', (d = {}) => { const p = me(); if (p && !p.dead) hitBoss(p, d); });
    socket.emit('raid:state', bossPublic());
  }

  function onJoin(p) { pushFriends(p); notifyFriendsOf(p, true); }

  // ===================== ดวล (PVP ท้าประลอง · ฉันมิตร ไม่มีของ/EXP เดิมพัน) =====================
  //  ▸ ท้า → อีกฝ่ายตอบรับ → สู้กันได้ทั้งตีปกติและสกิล (ดาเมจ PVP ×0.4 กันน็อกเร็วเกิน)
  //  ▸ จบเมื่อ: เลือดฝ่ายใดเหลือ 10% (น็อก · ไม่ตายจริง) · หมดเวลา 3 นาที · ห่างกัน/ออกแมพ · ออกเกม
  //  ▸ สถานะ (มึน/พิษ ฯลฯ) ยังไม่ติดผู้เล่นในดวล (เวอร์ชันแรก)
  const duels = new Map();                 // playerId → { foe, until }
  const duelReqs = new Map();              // targetId → Map(fromId → expireAt)
  const DUEL_MS = 180000, DUEL_RANGE = 700, DUEL_END_HP = 0.1, PVP_DMG = 0.4, DUEL_REPEAT_MS = 10 * 60e3;
  const duelWinAt = new Map();             // "ผู้ชนะ>ผู้แพ้" → เวลาที่นับชนะล่าสุด (กันปั๊มสถิติดวล)
  /** เพิ่มสถิติ PVP ในเซฟ แล้วตรวจฉายาใหม่ (ประกาศถ้าได้) */
  function addRec(q, key, n = 1) {
    if (!q?.save) return;
    (q.save.rec ||= {})[key] = (q.save.rec[key] || 0) + n; q.dirty = true;
    const got = checkTitles(q.save);
    if (got.length) announceTitles(q, got);
    queueSync(q);
  }
  let lastDuelChk = 0;
  function endDuel(id, winnerId = null, reason = '') {
    const d = duels.get(id);
    if (!d) return;
    const A = players.get(id), B = players.get(d.foe);
    duels.delete(id); duels.delete(d.foe);
    const W = winnerId ? players.get(winnerId) : null, L = W ? (W === A ? B : A) : null;
    if (W?.save && L?.save) {
      const pair = `${W.acc}:${W.slot || 0}>${L.acc}:${L.slot || 0}`, now = Date.now();
      if (now - (duelWinAt.get(pair) || 0) > DUEL_REPEAT_MS) { duelWinAt.set(pair, now); addRec(W, 'duelWin'); }   // ชนะคู่เดิมถี่ ๆ ไม่นับ
      addRec(L, 'duelLoss');
    }
    for (const q of [A, B]) if (q) emitTo(q.id, 'pvp:state', { phase: 'end', winner: W?.name || null, winnerId: winnerId || null, reason });
    if (A && B && W) io.emit('chat', { id: null, name: '⚔️ ดวล', text: `${W.name} ชนะการดวลกับ ${(W.id === A.id ? B : A).name}!` });
  }
  /** ผู้เล่นตีผู้เล่น (ดวล/PK ใช้ร่วมกัน): ตรวจร่ายจริง/คูลดาวน์/ระยะ แล้วทอยดาเมจ PVP → ผลทอย หรือ null
   *  ▸ สกิล: ต้องเพิ่งร่ายจริง (skill:cast เก็บเวลาไว้) · 1 ครั้งต่อการร่าย · ตีปกติ: คูลดาวน์ของตัวเอง (AGI เร่งได้) */
  function strike(p, t, sk, key, now) {
    const skId = typeof sk === 'string' && SKILL_BY_ID[sk] && SKILL_BY_ID[sk].type !== 'passive' ? sk : null;
    if (skId) {
      const at = p.skillAt?.[skId] || 0;
      if (!at || now - at > 1600) return null;
      const seen = (p.pvpSkAt ||= {});
      if (seen[skId] === at) return null;
      seen[skId] = at;
    } else {
      const cdMs = attackInterval(JOBS[p.appearance.job]?.attack?.cooldown || 500, getDerived(p.char).aspd + buffAspd(p.buffs, now)) * 0.7;   // รวมบัฟตีเร็ว (ตรงกับ client)
      if (now - (p[key] || 0) < cdMs) return null;
      p[key] = now;
    }
    const spec = attackSpec(p.char, p.appearance.job, skId, false);
    if (!spec) return null;
    const base = skId ? SKILL_BY_ID[skId] : JOBS[p.appearance.job]?.attack;
    const reach = Math.max(base?.range || 30, (base?.distance || 0) + (base?.radius || 0) + (base?.offset ? 240 : 0)) + 60;
    if (apart(p, t) > reach) return null;
    const atkD = combatDerived(p.char, p.buffs, now), defD = combatDerived(t.char, t.buffs, now);
    return rollDamage(atkD, { def: defD.def, eva: defD.eva }, spec.kind, spec.mult * (spec.hits || 1) * PVP_DMG);
  }

  // ===================== PK (หัวแดง) · เปิดได้ตั้งแต่ Lv.30 ในแดนต่าง ๆ นอกค่ายพัก =====================
  //  ▸ ต้องเปิดโหมด PK เอง · ตีคนบริสุทธิ์ = ชื่อม่วง 30 วิ (ตีกลับได้ไม่บาป) · ฆ่าคนบริสุทธิ์ = หัวแดง (บาป +100 ลด 5/นาทีที่ออนไลน์)
  //  ▸ คุ้มครอง: ต่ำกว่า Lv.30 · เลเวลต่ำกว่าเรา 15+ (ยกเว้นคนม่วง/แดง) · เพื่อนร่วมปาร์ตี้ · ค่ายพัก/อยุธยา/ลานราหู/สุสาน
  //  ▸ หัวแดงตาย: EXP −5% ของหลอด + ของในกระเป๋าหล่นให้คนฆ่า 1–3 ชิ้น (ไม่รวมของสวม/ล็อก/จองชุด A/B) · ซื้อของร้าน/วาร์ปกลับเมืองไม่ได้
  const PK_LV = 30, PK_GAP = 15, PK_FLAG_MS = 30000, PK_KARMA = 100, PK_DECAY = 5;
  let pkEnabled = true, pkEnv = null, lastPkTick = 0;
  const flagged = new Set();
  const isRed = (q) => (q?.save?.karma || 0) > 0;
  const isPurple = (q, now = Date.now()) => (q?.pkFlagUntil || 0) > now;
  const innocent = (q, now) => !isRed(q) && !isPurple(q, now);
  const pkColor = (q, now = Date.now()) => (isRed(q) ? 'red' : isPurple(q, now) ? 'purple' : null);
  const pushPk = (q) => io.emit('pk:state', { id: q.id, pk: pkColor(q) });
  /** อยู่ในเขต PK ไหม (แดนต่าง ๆ นอกค่ายพัก · ไม่ใช่อยุธยา/ลานอีเวนต์/สุสาน) */
  function pkZone(q) {
    if (!pkEnv || q.world !== 'td') return false;
    const M = getMap(pkEnv.mapOf(q));
    return !!M?.realm && !M.event && !M.crypt && M.id !== 'suriya' && !pkEnv.inTown(q);   // สุสานห้าม PK
  }
  /** เหตุผลที่ตีไม่ได้ (null = ตีได้) */
  function pkBlock(p, t, now) {
    if (!pkEnabled) return 'ระบบ PK ปิดอยู่';
    if ((p.level || 1) < PK_LV) return `ต้อง Lv.${PK_LV} ขึ้นไปถึงเปิด PK ได้`;
    if ((t.level || 1) < PK_LV) return `${t.name} ยังต่ำกว่า Lv.${PK_LV} (ได้รับการคุ้มครอง)`;
    if (p.partyId && p.partyId === t.partyId) return 'ตีเพื่อนร่วมปาร์ตี้ไม่ได้';
    if (!pkZone(p) || !pkZone(t)) return 'ต้องอยู่ในแดน (นอกค่ายพัก) ทั้งคู่ · อยุธยา/ลานราหู/สุสาน ห้าม PK';
    if (duels.get(p.id)?.foe === t.id) return 'กำลังดวลกันอยู่';
    if (innocent(t, now) && (t.level || 1) < (p.level || 1) - PK_GAP) return `${t.name} เลเวลต่ำกว่าคุณเกิน ${PK_GAP} (ได้รับการคุ้มครอง)`;
    return null;
  }
  /** ฆ่าได้ในโหมด PK */
  function onPkKill(p, t, wasInnocent) {
    addRec(t, 'pkDeath');
    if (wasInnocent) {
      addRec(p, 'pkKill');
      const was = isRed(p);
      p.save.karma = (p.save.karma || 0) + PK_KARMA; p.dirty = true; queueSync(p);
      if (!was) pushPk(p);
      io.emit('chat', { id: null, name: '☠️ PK', text: `${p.name} สังหาร ${t.name} กลายเป็นหัวแดง! (บาป ${p.save.karma})` });
      return;
    }
    if (!isRed(t)) return io.emit('chat', { id: null, name: '⚔️ PK', text: `${p.name} ปราบ ${t.name} ในการต่อสู้` });
    // หัวแดงตาย: เสีย EXP + ของหล่นให้คนฆ่า
    addRec(p, 'redKill');
    const c = t.save, lossExp = Math.min(c.exp || 0, Math.round(expToNext(c.level || 1) * 0.05));
    c.exp = Math.max(0, (c.exp || 0) - lossExp);
    const pool = (c.inventory || []).filter((s) => s && ITEMS[s.id] && tradable(s.id) && s.qty > 0 && count(c, s.id) - presetReserved(c, s.id) > 0);   // ของผูกตัวไม่หล่น   // หัวแดง: ของล็อกก็หล่นได้ (กันล็อกทั้งกระเป๋าเลี่ยงโทษ)
    const got = [];
    for (let n = 1 + Math.floor(Math.random() * 3); n > 0 && pool.length; n--) {
      const s = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      if (!removeItem(c, s.id, 1)) continue;
      addItem(p.save, s.id, 1, false); got.push(ITEMS[s.id].nameTh);   // ของหล่นจาก PK ไม่นับเข้าสมุดการ์ด
    }
    t.dirty = true; p.dirty = true; refresh(t); refresh(p); queueSync(t); queueSync(p);
    sys(t.id, `☠️ คุณตายขณะเป็นหัวแดง: EXP −${lossExp.toLocaleString()}${got.length ? ` · ของหล่น: ${got.join(', ')}` : ''}`);
    if (got.length) sys(p.id, `💰 ได้ของจากหัวแดง ${t.name}: ${got.join(', ')}`);
    io.emit('chat', { id: null, name: '⚔️ PK', text: `${p.name} ปราบหัวแดง ${t.name} ได้แล้ว!` });
  }
  function tickPk(now) {
    for (const id of [...flagged]) { const q = players.get(id); if (!q) { flagged.delete(id); continue; } if (!isPurple(q, now)) { flagged.delete(id); pushPk(q); } }
    if (now - lastPkTick < 60000) return;
    lastPkTick = now;
    for (const q of players.values()) {
      if (!isRed(q)) continue;
      q.save.karma = Math.max(0, q.save.karma - PK_DECAY); q.dirty = true;
      if (!q.save.karma) { pushPk(q); sys(q.id, '🕊️ บาปหมดแล้ว · ชื่อกลับเป็นปกติ'); }
    }
  }

  function tickDuels(now) {
    if (now - lastDuelChk < 1000 || !duels.size) return;
    lastDuelChk = now;
    const seen = new Set();
    for (const [id, d] of [...duels]) {
      if (seen.has(id)) continue;
      seen.add(d.foe);
      const A = players.get(id), B = players.get(d.foe);
      if (!A || !B) { endDuel(id, A ? id : d.foe, 'อีกฝ่ายออกจากเกม'); continue; }
      if (A.dead || B.dead) { endDuel(id, A.dead ? d.foe : id, 'อีกฝ่ายสลบ'); continue; }
      if (now > d.until) { endDuel(id, null, 'หมดเวลา (เสมอ)'); continue; }
      if (apart(A, B) > DUEL_RANGE) endDuel(id, null, 'อยู่ห่างกันเกินไป');
    }
  }

  function onDisconnect(id) {
    const p = players.get(id);
    leaveParty(id);
    const t = tradeOf(id);
    if (t) closeTrade(t, 'อีกฝ่ายออกจากเกม');
    if (duels.has(id)) endDuel(id, duels.get(id).foe, 'อีกฝ่ายออกจากเกม');
    partyInvites.delete(id);
    tradeReqs.delete(id);
    duelReqs.delete(id);
    boss.contrib.delete(id);
    if (p) setTimeout(() => notifyFriendsOf(p, false), 0);
  }

  function bossPublic() {
    return {
      alive: boss.alive, hp: Math.round(boss.hp), maxHp: boss.maxHp, x: Math.round(boss.x), dir: boss.dir,
      anim: boss.anim, respawnIn: boss.alive ? 0 : Math.max(0, boss.respawnAt - Date.now()),
    };
  }

  let lastPartyPush = 0;
  function tick(now = Date.now()) {
    tickBoss(now);
    tickDuels(now);
    tickPk(now);
    if (now - lastPartyPush > 1000) {
      lastPartyPush = now;
      for (const party of parties.values()) pushParty(party);
    }
  }

  /** ตัวละครถูกลบ/เปลี่ยนชื่อ → รายชื่อเพื่อนของคนที่ออนไลน์อยู่อัปเดตทันที */
  function friendGone(acc, name) {
    const low = String(name || '').toLowerCase();
    for (const q of players.values()) {
      const b = (q.save?.friends || []).length; if (!b) continue;
      q.save.friends = q.save.friends.filter((f) => !(f.acc === acc && String(f.name).toLowerCase() === low));
      if (q.save.friends.length < b) pushFriends(q);
    }
  }
  function friendRenamed(acc, oldName, newName) {
    const low = String(oldName || '').toLowerCase();
    for (const q of players.values()) {
      let ch = false;
      for (const f of q.save?.friends || []) if (f.acc === acc && String(f.name).toLowerCase() === low) { f.name = newName; ch = true; }
      if (ch) pushFriends(q);
    }
  }
  /** index.js ส่งข้อมูลโลกให้ (td สร้างทีหลัง social) */
  const setPkEnv = (env) => { pkEnv = env; };
  /** GM: เปิด/ปิด PK ทั้งเซิร์ฟ · ล้าง/ตั้งบาป */
  function pkGm(cmd, target, n) {
    if (cmd === 'on' || cmd === 'off') {
      pkEnabled = cmd === 'on';
      if (!pkEnabled) for (const q of players.values()) if (q.pkMode) { q.pkMode = false; emitTo(q.id, 'pk:mode', { on: false, msg: 'GM ปิดระบบ PK' }); }
      io.emit('chat', { id: null, name: '📢 ประกาศ', text: pkEnabled ? '⚔️ เปิดระบบ PK แล้ว (Lv.30+ ในแดนต่าง ๆ นอกค่ายพัก)' : '🕊️ ปิดระบบ PK ชั่วคราว' });
      return pkEnabled ? 'เปิด PK แล้ว' : 'ปิด PK แล้ว';
    }
    return `PK ตอนนี้: ${pkEnabled ? 'เปิด' : 'ปิด'} · ใช้ /gm pk on|off · /gm karma <ชื่อ> [ค่า]`;
  }
  function setKarma(t, n) { if (isPurple(t)) flagged.add(t.id); const was = isRed(t); t.save.karma = Math.max(0, n); t.dirty = true; queueSync(t); if (was !== isRed(t)) pushPk(t); }
  return { setPkEnv, pkGm, setKarma, pkColor, partyBonus, partyMates, friendGone, friendRenamed, onConnection, onDisconnect, onJoin, tick, bossPublic, shareExp, announceTitles, partyOf, pushParty, leaveParty, _boss: boss, _parties: parties, _trades: trades };
}
