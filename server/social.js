// ============================================================
//  ระบบ MMO ฝั่ง server: ปาร์ตี้ · เทรด · เรดบอส
//  ▸ ปาร์ตี้  – เชิญ/ตอบรับ/ออก/เตะ, แบ่ง EXP ให้สมาชิกที่อยู่ใกล้
//  ▸ เทรด    – server เป็นคนกลาง: ยื่นข้อเสนอ → ล็อก → ยืนยันทั้งสองฝ่าย → แลกพร้อมกัน
//  ▸ เรดบอส  – server คุม HP / AI / ท่าโจมตี ของพญายักษ์ ทุกคนตีตัวเดียวกัน แจกรางวัลตามดาเมจ
// ============================================================
import { PARTY, WORLD } from '../shared/constants.js';
import { ITEMS } from '../shared/data/items.js';
import { RAID_BOSS as RB } from '../shared/data/raid.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const int = (v, lo, hi) => clamp(Math.floor(Number(v) || 0), lo, hi);
let seq = 1;

export function setupSocial(io, players) {
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
        id: p.id, name: p.name, level: p.level, job: p.appearance.path || 'villager', hp: p.hp, maxHp: p.maxHp, x: Math.round(p.x),
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
    if (party.members.size < 2) {                       // เหลือคนเดียว → ยุบปาร์ตี้
      for (const id of party.members) { const m = players.get(id); if (m) m.partyId = null; emitTo(id, 'party:state', null); }
      parties.delete(party.id);
      return;
    }
    if (party.leader === pid) party.leader = [...party.members][0];
    pushParty(party);
  }

  // ===================== เทรด =====================
  const trades = new Map();               // tradeId → { id, a, b, offer:{}, locked:{}, confirmed:{} }
  const tradeReqs = new Map();            // targetId → Map(fromId → expireAt)

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
  function cleanOffer(o = {}) {
    const items = [];
    for (const it of Array.isArray(o.items) ? o.items.slice(0, 8) : []) {
      if (!ITEMS[it?.id]) continue;
      const qty = int(it.qty, 1, 999);
      const ex = items.find((x) => x.id === it.id);
      if (ex) ex.qty = Math.min(999, ex.qty + qty); else items.push({ id: it.id, qty });
    }
    return { items, gold: int(o.gold, 0, 10_000_000) };
  }

  // ===================== เรดบอส =====================
  const boss = {
    alive: false, hp: 0, maxHp: RB.maxHp, x: RB.spawnX, y: WORLD.groundY, dir: -1, anim: 'walk',
    respawnAt: Date.now() + Number(process.env.RAID_SPAWN_MS ?? 15000), nextAttackAt: 0, attacking: null, contrib: new Map(), lastTick: Date.now(),
  };
  const inArena = (p) => p.x >= RB.arena[0] - 40 && p.anim !== 'die' && p.hp > 0;

  function spawnBoss() {
    const n = [...players.values()].filter(inArena).length;
    boss.maxHp = Number(process.env.RAID_HP) || RB.maxHp + Math.max(0, n - 1) * RB.hpPerExtraPlayer;
    Object.assign(boss, { alive: true, hp: boss.maxHp, x: RB.spawnX, dir: -1, anim: 'walk', attacking: null, nextAttackAt: Date.now() + 2500 });
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

  function tickBoss(now) {
    const dt = Math.min(0.2, (now - boss.lastTick) / 1000);
    boss.lastTick = now;
    if (!boss.alive) {
      if (now >= boss.respawnAt && players.size) spawnBoss();
      return;
    }
    const fighters = [...players.values()].filter(inArena);
    const enraged = boss.hp / boss.maxHp < RB.enrageAt;

    // ท่าโจมตีที่ง้างอยู่ → ถึงเวลาลงดาเมจ
    if (boss.attacking) {
      if (now >= boss.attacking.at) {
        io.emit('raid:impact', boss.attacking);
        boss.attacking = null;
        boss.anim = 'walk';
      }
      return;
    }
    if (!fighters.length) {                                  // ไม่มีใครในลาน → กลับจุดเกิด ฟื้น HP
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
      if (type === 'rain') {                                  // ลูกไฟตกใส่ตำแหน่งผู้เล่น + สุ่มรอบๆ
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

  function hitBoss(p, d) {
    if (!boss.alive || !inArena(p)) return;
    if (Math.abs(p.x - boss.x) > 650) return;
    const now = Date.now();
    // กันสแปม: token bucket 12 ครั้ง/วินาที
    p.raidTokens = Math.min(12, (p.raidTokens ?? 12) + ((now - (p.raidT || now)) / 1000) * 12);
    p.raidT = now;
    if (p.raidTokens < 1) return;
    p.raidTokens -= 1;
    const dmg = int(d.dmg, 0, 400 + p.level * RB.maxHitPerLevel);
    if (!dmg) return;
    boss.hp = Math.max(0, boss.hp - dmg);
    boss.contrib.set(p.id, (boss.contrib.get(p.id) || 0) + dmg);
    io.volatile.emit('raid:dmg', { id: p.id, dmg, crit: !!d.crit, hp: Math.round(boss.hp) });
    if (boss.hp <= 0) defeatBoss(p);
  }

  function defeatBoss(killer) {
    boss.alive = false;
    boss.attacking = null;
    boss.anim = 'die';
    boss.respawnAt = Date.now() + RB.respawnMs;
    const total = [...boss.contrib.values()].reduce((a, b) => a + b, 0) || 1;
    const ranking = [...boss.contrib.entries()].sort((a, b) => b[1] - a[1]);
    for (const [id, dmg] of ranking) {
      const share = dmg / total;
      if (share < 0.01 || !players.get(id)) continue;
      const mult = 0.5 + Math.min(1, share * 2);               // มีส่วนร่วมมาก ได้มาก (50%–150%)
      const items = RB.rewards.items.map(([iid, q]) => ({ id: iid, qty: q }));
      for (const [iid, chance] of RB.rewards.rare) if (Math.random() < chance) items.push({ id: iid, qty: 1 });
      emitTo(id, 'raid:reward', {
        exp: Math.round(RB.rewards.exp * mult), gold: Math.round(RB.rewards.gold * mult), items,
        share: Math.round(share * 100), rank: ranking.findIndex((r) => r[0] === id) + 1,
      });
    }
    const top = ranking.slice(0, 3).map(([id, dmg]) => `${players.get(id)?.name ?? '?'} (${dmg})`).join(', ');
    io.emit('raid:defeated', { killer: killer.name, respawnMs: RB.respawnMs });
    io.emit('chat', { id: null, name: '👹 เรดบอส', text: `${killer.name} ปิดฉาก${RB.nameTh}! ดาเมจสูงสุด: ${top}` });
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
      const cur = parties.get(from.partyId);
      if (cur && cur.members.size >= PARTY.maxSize) return sys(p.id, 'ปาร์ตี้เต็มแล้ว');   // เช็คก่อน ไม่ให้หลุดปาร์ตี้เดิมฟรีๆ
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
    // แบ่ง EXP: ผู้ฆ่าแจ้งจำนวน EXP ที่ได้ → server แจกให้สมาชิกที่อยู่ใกล้
    socket.on('party:exp', ({ amount } = {}) => {
      const p = me(), party = p && parties.get(p.partyId);
      if (!party) return;
      const now = Date.now();
      if (now - (p.lastExpShare || 0) < 80) return;
      p.lastExpShare = now;
      const share = Math.round(int(amount, 0, 5000) * PARTY.shareRatio);
      if (!share) return;
      for (const id of party.members) {
        const m = players.get(id);
        if (id === p.id || !m || Math.abs(m.x - p.x) > PARTY.shareRange) continue;
        emitTo(id, 'party:exp', { amount: share, from: p.name });
      }
    });
    socket.on('party:chat', (text) => {
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
      if (Math.abs(p.x - t.x) > 250) return sys(p.id, 'ต้องอยู่ใกล้กันจึงจะเทรดได้');
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
      const t = tradeOf(socket.id);
      if (!t) return;
      if (t.verifying) return;
      t.offer[socket.id] = cleanOffer(o);
      for (const s of [t.a, t.b]) { t.locked[s] = false; t.confirmed[s] = false; }   // เปลี่ยนข้อเสนอ → ปลดล็อกทั้งคู่
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
      if (t.confirmed[t.a] && t.confirmed[t.b]) {
        // ขั้นตรวจของ: ให้ทั้งสองฝั่งยืนยันว่ายังมีของ/เงินครบ ก่อนสั่งแลกจริง (กันของซ้ำ)
        t.verified = {};
        t.verifying = true;
        emitTo(t.a, 'trade:verify', { give: t.offer[t.a] });
        emitTo(t.b, 'trade:verify', { give: t.offer[t.b] });
      } else pushTrade(t);
    });
    socket.on('trade:verified', ({ ok } = {}) => {
      const t = tradeOf(socket.id);
      if (!t || !t.verifying) return;
      if (!ok) return closeTrade(t, `${me()?.name} มีของไม่ครบตามข้อเสนอ – ยกเลิกการเทรด`);
      t.verified[socket.id] = true;
      if (!t.verified[t.a] || !t.verified[t.b]) return;
      emitTo(t.a, 'trade:complete', { give: t.offer[t.a], get: t.offer[t.b], with: players.get(t.b)?.name });
      emitTo(t.b, 'trade:complete', { give: t.offer[t.b], get: t.offer[t.a], with: players.get(t.a)?.name });
      trades.delete(t.id);
      for (const id of [t.a, t.b]) { const p = players.get(id); if (p) p.tradeId = null; }
    });
    socket.on('trade:cancel', () => { const t = tradeOf(socket.id); if (t) closeTrade(t, `${me()?.name} ยกเลิกการเทรด`); });

    // ---------- เรดบอส ----------
    socket.on('raid:hit', (d = {}) => { const p = me(); if (p) hitBoss(p, d); });
    socket.emit('raid:state', bossPublic());
  }

  function onDisconnect(id) {
    leaveParty(id);
    const t = tradeOf(id);
    if (t) closeTrade(t, 'อีกฝ่ายออกจากเกม');
    partyInvites.delete(id);
    tradeReqs.delete(id);
    boss.contrib.delete(id);
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
    if (now - lastPartyPush > 1000) {                // อัปเดต HP/ตำแหน่งสมาชิกปาร์ตี้ทุก 1 วินาที
      lastPartyPush = now;
      for (const party of parties.values()) pushParty(party);
    }
  }

  return { onConnection, onDisconnect, tick, bossPublic, _boss: boss, _parties: parties, _trades: trades };
}
