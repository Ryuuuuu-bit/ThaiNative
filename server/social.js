// ============================================================
//  ระบบ MMO ฝั่ง server: ปาร์ตี้ · เทรด · เรดบอส · เพื่อน · ฉายา
//  ▸ ปาร์ตี้  – เชิญ/ตอบรับ/ออก/เตะ, แบ่ง EXP ให้สมาชิกที่อยู่ใกล้ (ใส่เซฟจริง)
//  ▸ เทรด    – server เป็นคนกลาง: ยื่นข้อเสนอ → ล็อก → ยืนยันทั้งสองฝ่าย → server ตรวจของแล้วแลกเอง
//  ▸ เรดบอส  – server คุม HP / AI / ท่าโจมตี / ดาเมจที่ผู้เล่นโดน / รางวัล
//  ▸ เพื่อน  – รายชื่อเก็บในเซฟ (อ้างบัญชี) · แจ้งเตือนตอนเพื่อนออนไลน์
// ============================================================
import { PARTY, WORLD } from '../shared/constants.js';
import { ITEMS } from '../shared/data/items.js';
import { LEGEND_IDS, rollGearDrop } from '../shared/data/gear.js';
import { RAID_BOSS as RB } from '../shared/data/raid.js';
import { rollDamage } from '../shared/stats.js';
import { combatDerived, attackSpec, attackGate } from '../shared/character.js';
import { count, addItem, removeItem, grant } from '../shared/economy.js';
import { TITLE_BY_ID, checkTitles } from '../shared/data/titles.js';
import { mapAt } from '../shared/data/maps.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const int = (v, lo, hi) => clamp(Math.floor(Number(v) || 0), lo, hi);
const MAX_FRIENDS = 50;
let seq = 1;

export function setupSocial(io, players, H = {}) {
  const { queueSync = () => {}, refresh = () => {}, hurtPlayer = () => {}, byAcc = new Map() } = H;
  const sock = (id) => io.sockets.sockets.get(id);
  const emitTo = (id, ev, data) => sock(id)?.emit(ev, data);
  const sys = (id, text) => emitTo(id, 'chat', { id: null, name: '📢 ระบบ', text });

  // ===================== ปาร์ตี้ =====================
  const parties = new Map();              // partyId → { id, leader, members:Set }
  const partyInvites = new Map();         // targetId → Map(fromId → expireAt)

  function partyState(party) {
    return {
      id: party.id, leader: party.leader,
      members: [...party.members].map((id) => players.get(id)).filter(Boolean).map((p) => ({
        id: p.id, name: p.name, level: p.level, job: p.appearance.path || 'villager', hp: Math.round(p.hp), maxHp: p.maxHp, x: Math.round(p.x), inst: p.inst || 0,
      })),
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
    p.partyId = null;
    emitTo(pid, 'party:state', null);
    for (const id of party.members) sys(id, `${p.name} ${reason === 'kick' ? 'ถูกเชิญออกจาก' : 'ออกจาก'}ปาร์ตี้`);
    if (party.members.size < 2) {
      for (const id of party.members) { const m = players.get(id); if (m) m.partyId = null; emitTo(id, 'party:state', null); }
      parties.delete(party.id);
      return;
    }
    if (party.leader === pid) party.leader = [...party.members][0];
    pushParty(party);
  }
  const partyOf = (p) => (p ? parties.get(p.partyId) || null : null);

  // ===================== เทรด =====================
  const trades = new Map();
  const tradeReqs = new Map();
  const tradeOf = (pid) => trades.get(players.get(pid)?.tradeId);
  function tradeState(t) {
    return { id: t.id, a: t.a, b: t.b, offer: t.offer, locked: t.locked, confirmed: t.confirmed,
      names: { [t.a]: players.get(t.a)?.name, [t.b]: players.get(t.b)?.name } };
  }
  const pushTrade = (t) => { const st = tradeState(t); emitTo(t.a, 'trade:state', st); emitTo(t.b, 'trade:state', st); };
  function closeTrade(t, reason) {
    trades.delete(t.id);
    for (const id of [t.a, t.b]) { const p = players.get(id); if (p) p.tradeId = null; emitTo(id, 'trade:closed', { reason }); }
  }
  function cleanOffer(o = {}, save) {
    const items = [];
    for (const it of Array.isArray(o.items) ? o.items.slice(0, 8) : []) {
      if (!ITEMS[it?.id] || ITEMS[it.id].type === 'skin') continue;
      const qty = int(it.qty, 1, 9999);
      const ex = items.find((x) => x.id === it.id);
      if (ex) ex.qty = Math.min(9999, ex.qty + qty); else items.push({ id: it.id, qty });
    }
    for (const it of items) it.qty = Math.min(it.qty, count(save, it.id));        // เสนอได้ไม่เกินที่มีจริง
    return { items: items.filter((it) => it.qty > 0), gold: Math.min(int(o.gold, 0, 1e9), Math.max(0, save.gold)) };
  }
  const hasOffer = (save, o) => save.gold >= o.gold && o.items.every((it) => count(save, it.id) >= it.qty);
  /** แลกของจริงที่ server (ทั้งสองฝั่งพร้อมกัน) */
  function executeTrade(t) {
    const A = players.get(t.a), B = players.get(t.b);
    if (!A || !B) return closeTrade(t, 'อีกฝ่ายออกจากเกม');
    const oa = t.offer[t.a], ob = t.offer[t.b];
    if (!hasOffer(A.save, oa)) return closeTrade(t, `${A.name} มีของไม่ครบตามข้อเสนอ – ยกเลิกการเทรด`);
    if (!hasOffer(B.save, ob)) return closeTrade(t, `${B.name} มีของไม่ครบตามข้อเสนอ – ยกเลิกการเทรด`);
    const move = (from, to, o) => {
      for (const it of o.items) { removeItem(from.save, it.id, it.qty); addItem(to.save, it.id, it.qty); }
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
  const inArena = (p) => p.x >= RB.arena[0] - 40 && p.x <= RB.arena[1] && !p.dead && p.hp > 0;

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
      if (now >= boss.respawnAt && players.size) spawnBoss();
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
  function shareExp(p, exp, exclude = []) {
    const party = partyOf(p);
    if (!party) return;
    const share = Math.round(exp * PARTY.shareRatio);
    if (!share) return;
    for (const id of party.members) {
      const m = players.get(id);
      if (id === p.id || !m?.save || exclude.includes(id) || Math.abs(m.x - p.x) > PARTY.shareRange || m.dead) continue;
      const g = grant(m.save, { exp: share });
      refresh(m); queueSync(m);
      emitTo(id, 'party:exp', { amount: share, from: p.name, ups: g.ups });
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
  function friendsState(p) {
    return (p.save.friends || []).map((f) => {
      const q = players.get(byAcc.get(f.acc));
      if (q) f.name = q.name;
      return { acc: f.acc, name: f.name, online: !!q, id: q?.id || null, level: q?.level || null, map: q ? mapAt(q.x).nameTh : null, job: q?.appearance?.path || null };
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
      if (!['rich'].includes(id)) io.emit('chat', { id: null, name: '🏅 ฉายา', text: `${p.name} ได้รับฉายา “${t.nameTh}”` });
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
    socket.on('party:chat', (text) => {
      if (typeof text !== 'string') return;
      const p = me(), party = p && parties.get(p.partyId);
      const msg = String(text ?? '').replace(/[<>]/g, '').trim().slice(0, 120);
      if (!party || !msg || Date.now() - (p.lastChat || 0) < 500) return;
      p.lastChat = Date.now();
      for (const id of party.members) emitTo(id, 'chat', { id: p.id, name: `[ปาร์ตี้] ${p.name}`, text: msg, party: true });
    });

    // ---------- เทรด ----------
    socket.on('trade:request', ({ id } = {}) => {
      const p = me(), t = players.get(id);
      if (!p || !t || t.id === p.id) return;
      if (p.tradeId || t.tradeId) return sys(p.id, 'อีกฝ่ายกำลังเทรดอยู่');
      if (Math.abs(p.x - t.x) > 250 || (p.inst || 0) !== (t.inst || 0)) return sys(p.id, 'ต้องอยู่ใกล้กันจึงจะเทรดได้');
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
      pushTrade(t);
    });
    socket.on('trade:confirm', () => {
      const t = tradeOf(socket.id);
      if (!t || !t.locked[t.a] || !t.locked[t.b]) return;
      t.confirmed[socket.id] = true;
      if (t.confirmed[t.a] && t.confirmed[t.b]) executeTrade(t);
      else pushTrade(t);
    });
    socket.on('trade:cancel', () => { const t = tradeOf(socket.id); if (t) closeTrade(t, `${me()?.name} ยกเลิกการเทรด`); });

    // ---------- เพื่อน ----------
    socket.on('friends:get', () => { const p = me(); if (p) pushFriends(p); });
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

  function onDisconnect(id) {
    const p = players.get(id);
    leaveParty(id);
    const t = tradeOf(id);
    if (t) closeTrade(t, 'อีกฝ่ายออกจากเกม');
    partyInvites.delete(id);
    tradeReqs.delete(id);
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
    if (now - lastPartyPush > 1000) {
      lastPartyPush = now;
      for (const party of parties.values()) pushParty(party);
    }
  }

  return { onConnection, onDisconnect, onJoin, tick, bossPublic, shareExp, announceTitles, partyOf, pushParty, leaveParty, _boss: boss, _parties: parties, _trades: trades };
}
