// ============================================================
//  ดันเจี้ยนปาร์ตี้ "สุสานใต้ดิน" (server-authoritative · ห้องแยกต่อปาร์ตี้)
//  ▸ หัวหน้าปาร์ตี้ (หรือคนเดียว) คุยกับหลวงพ่อทองในหมู่บ้าน → พาสมาชิกที่อยู่หมู่บ้านเข้าไปด้วยกัน
//  ▸ 3 ระลอก + บอส · จำกัด 10 นาที · ผีตี/ผู้เล่นตี คำนวณที่ server ทั้งหมด
//  ▸ คนละห้องมองไม่เห็นกัน (client กรองด้วย inst)
// ============================================================
import { WORLD } from '../shared/constants.js';
import { MONSTERS } from '../shared/data/monsters.js';
import { MAPS, mapAt } from '../shared/data/maps.js';
import { DUNGEON } from '../shared/data/dungeon.js';
import { nearNpc } from '../shared/data/npcs.js';
import { rollDamage } from '../shared/stats.js';
import { combatDerived, attackSpec, attackGate, blessingsOf } from '../shared/character.js';
import { GEAR_IDS, GEAR, LEGEND_IDS } from '../shared/data/gear.js';
import { grant } from '../shared/economy.js';

const DG = MAPS.dungeon;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rand = (a, b) => a + Math.random() * (b - a);
let seq = 1;

export function setupDungeon(io, players, H = {}) {
  const { social, queueSync = () => {}, refresh = () => {}, hurtPlayer = () => {} } = H;
  const insts = new Map();
  const cooldown = new Map();                 // acc → เข้าได้อีกเมื่อ
  const room = (I) => `dg:${I.id}`;
  const sys = (id, text) => io.to(id).emit('chat', { id: null, name: '🕯️ หลวงพ่อทอง', text });

  // ---------------- เข้า / ออก ----------------
  function enter(p, tierId) {
    const T = DUNGEON.tiers[tierId];
    if (!T) return { ok: false, msg: 'ไม่มีระดับนี้' };
    if (!nearNpc(p.x, 'dungeon')) return { ok: false, msg: 'ต้องยืนคุยกับหลวงพ่อทองก่อน' };
    if (p.inst) return { ok: false, msg: 'อยู่ในดันเจี้ยนแล้ว' };
    const party = social?.partyOf(p);
    if (party && party.leader !== p.id) return { ok: false, msg: 'ให้หัวหน้าปาร์ตี้เป็นคนพาเข้า' };
    const ids = party ? [...party.members] : [p.id];
    const now = Date.now(), go = [], skip = [];
    for (const id of ids) {
      const q = players.get(id);
      if (!q) continue;
      const why = q.dead ? 'ยังไม่ฟื้น' : mapAt(q.x).id !== 'village' ? 'ไม่ได้อยู่ในหมู่บ้าน' : q.level < T.minLv ? `เลเวลไม่ถึง ${T.minLv}` : q.tradeId ? 'กำลังเทรด' : q.inst ? 'อยู่ในดันเจี้ยนอื่น'
        : (cooldown.get(q.acc) || 0) > now ? `ต้องรออีก ${Math.ceil(((cooldown.get(q.acc) || 0) - now) / 1000)} วิ` : null;
      if (why) { if (q.id === p.id) return { ok: false, msg: `เข้าไม่ได้: ${why}` }; skip.push(`${q.name} (${why})`); } else go.push(q);
    }
    const I = {
      id: seq++, tier: tierId, T, members: new Set(go.map((q) => q.id)), n: go.length, wave: 0, mobs: new Map(), queue: [],
      startAt: now, endAt: now + DUNGEON.timeLimitMs, state: 'intro', nextAt: now + 4000, done: false, mseq: 1,
    };
    insts.set(I.id, I);
    go.forEach((q, i) => {
      q.inst = I.id;
      q.x = DG.arriveX + i * 14; q.y = WORLD.spawnY; q.wp = (q.wp || 0) + 1;
      io.sockets.sockets.get(q.id)?.join(room(I));
      io.to(q.id).emit('dg:start', { id: I.id, tier: tierId, x: Math.round(q.x), endsIn: DUNGEON.timeLimitMs, members: go.map((m) => m.name) });
    });
    if (skip.length) sys(p.id, `สมาชิกที่ไม่ได้เข้า: ${skip.join(', ')}`);
    return { ok: true };
  }

  function leave(p, reason = 'leave') {
    const I = p?.inst && insts.get(p.inst);
    if (!p || !I) { if (p) p.inst = 0; return; }
    I.members.delete(p.id);
    p.inst = 0;
    io.sockets.sockets.get(p.id)?.leave(room(I));
    if (reason !== 'end') io.to(room(I)).emit('chat', { id: null, name: '🕯️ สุสานใต้ดิน', text: `${p.name} ออกจากดันเจี้ยน` });
    if (!I.members.size) insts.delete(I.id);
  }

  const canRespawn = (p) => !!(p.inst && insts.get(p.inst) && !insts.get(p.inst).done);

  // ---------------- ผี ----------------
  function spawnMob(I, type, boss = false) {
    const d = MONSTERS[type], T = I.T, n = I.n;
    const hpMul = boss ? T.bossHp * (1 + 0.5 * (n - 1)) : T.hpMul * (1 + 0.45 * (n - 1));
    const m = {
      mid: I.mseq++, type, boss, d, x: rand(DG.maxX - 260, DG.maxX - 40), y: d.behavior === 'flyer' ? WORLD.groundY - 22 : WORLD.groundY,
      hp: Math.round(d.hp * hpMul), maxHp: Math.round(d.hp * hpMul), atk: Math.round(d.atk * T.atkMul * (boss ? 1.5 : 1)),
      dir: -1, anim: 'walk', lastAttack: 0, atkSeq: 0, atkN: 0, pending: [], dmgBy: new Map(), stunUntil: 0, speed: d.speed * (boss ? 0.8 : 1),
      exp: Math.round(d.exp * 0.6),
    };
    I.mobs.set(m.mid, m);
  }
  function nextWave(I, now) {
    I.wave++;
    if (I.wave > DUNGEON.waves) {
      I.state = 'boss';
      spawnMob(I, I.T.boss, true);
      for (let k = 0; k < Math.min(3, I.n + 1); k++) I.queue.push({ at: now + 2500 + k * 1500, type: I.T.mobs[k % I.T.mobs.length] });
      io.to(room(I)).emit('dg:wave', { wave: I.wave, boss: true, nameTh: I.T.bossNameTh });
      return;
    }
    I.state = 'wave';
    const c = DUNGEON.waveCount(I.wave, I.n);
    for (let k = 0; k < c; k++) I.queue.push({ at: now + 800 + k * 650, type: I.T.mobs[(k + I.wave) % I.T.mobs.length] });
    io.to(room(I)).emit('dg:wave', { wave: I.wave, count: c });
  }

  const alive = (I) => [...I.members].map((id) => players.get(id)).filter((p) => p && p.inst === I.id);
  function stepMob(I, m, dt, now, ps) {
    // ลงดาเมจตามนัด
    if (m.pending.length) {
      const keep = [];
      for (const a of m.pending) {
        if (a.at > now) { keep.push(a); continue; }
        if (now < m.stunUntil) continue;
        const hitP = (p, mult = 1, extra = {}) => {
          const pd = combatDerived(p.char, p.buffs, now);
          const r = rollDamage({ patk: m.atk, matk: m.atk, accuracy: m.d.acc + 5, critRate: 0.06, critDmg: 1.5 }, { def: pd.def, eva: pd.eva }, m.d.projectile ? 'magic' : 'physical', mult);
          hurtPlayer(p, r.dmg, { hit: r.hit, crit: r.crit, x: Math.round(m.x), force: true, ...extra });
        };
        if (a.kind === 'shot') { const p = ps.find((q) => !q.dead && Math.abs(q.x - a.tx) < 18 && Math.abs(q.y - 16 - a.ty) < 28); if (p) hitP(p); }
        else if (a.kind === 'slam') { for (const p of ps) if (!p.dead && Math.abs(p.x - m.x) < 110 && p.y > WORLD.groundY - 40) hitP(p, 1.3, { stun: 600 }); }
        else { const reach = m.d.attackRange * 0.6 + (m.boss ? 30 : 16); for (const p of ps) if (!p.dead && Math.abs(p.x - m.x) <= reach + 10 && Math.abs(p.y - m.y) < (m.boss ? 70 : 44)) hitP(p); }
      }
      m.pending = keep;
    }
    if (now < m.stunUntil) return;
    let tgt = null, best = Infinity;
    for (const p of ps) { if (p.dead) continue; const dx = Math.abs(p.x - m.x); if (dx < best) { best = dx; tgt = p; } }
    if (!tgt) { m.anim = 'walk'; return; }
    const d = m.d, dist = Math.abs(tgt.x - m.x), face = Math.sign(tgt.x - m.x) || 1;
    m.dir = face;
    const reach = d.attackRange * 0.6 + (m.boss ? 30 : 16);
    const ranged = d.behavior === 'ranged';
    if (now - m.lastAttack < 650) return;
    if ((ranged && dist <= d.attackRange) || (!ranged && dist <= reach)) {
      if (now - m.lastAttack < d.attackCooldown * (m.boss ? 1.2 : 1)) return;
      m.lastAttack = now; m.atkSeq = (m.atkSeq + 1) % 1000; m.atkN++; m.anim = 'attack';
      if (ranged) { const tx = tgt.x, ty = tgt.y - 16; m.pending.push({ at: now + 330 + Math.abs(tx - m.x) / 140 * 1000, kind: 'shot', tx, ty }); }
      else if (m.boss && m.atkN % 3 === 0) { m.pending.push({ at: now + 600, kind: 'slam' }); io.to(room(I)).emit('dg:slam', { mid: m.mid, x: Math.round(m.x) }); }
      else m.pending.push({ at: now + 330, kind: 'melee' });
      return;
    }
    const vx = ranged && dist < d.attackRange * 0.45 ? -face * m.speed : face * m.speed;
    m.x = clamp(m.x + vx * dt, DG.safeEndX + 20, DG.maxX - 20);
    m.anim = 'walk';
    if (d.behavior === 'flyer') m.y += clamp((tgt.y - 10 - m.y) * 2, -m.speed, m.speed) * dt;
  }

  // ---------------- ผู้เล่นตีผี ----------------
  function onHit(socket, d = {}) {
    const p = players.get(socket.id), I = p?.inst && insts.get(p.inst), m = I?.mobs.get(d.mid | 0);
    if (!p || p.dead || !I || !m || m.hp <= 0 || Math.abs(p.x - m.x) > 420) return;
    const now = Date.now();
    p.hitWin = now - (p.hitWinAt || 0) > 1000 ? 0 : p.hitWin || 0;
    if (!p.hitWin) p.hitWinAt = now;
    if (++p.hitWin > 120) return;
    const sk = typeof d.sk === 'string' ? d.sk : null;
    const gate = attackGate(p, sk, !!d.combo, now);
    if (!gate) return;
    const spec = attackSpec(p.char, p.appearance?.job, sk, gate === 'combo');
    if (!spec) return;
    const r = rollDamage(combatDerived(p.char, p.buffs, now), { def: m.d.def + 2, eva: m.d.eva }, spec.kind, spec.mult);
    if (!r.hit) return socket.emit('dg:dmg', { mid: m.mid, by: p.id, hit: false, dmg: 0, hp: Math.round(m.hp) });
    if (spec.effect?.stun && !m.boss) m.stunUntil = Math.max(m.stunUntil, now + clamp(spec.effect.stun.ms, 0, 2000));
    let dmg = r.dmg;
    if (spec.effect?.poison) dmg = Math.round(dmg * (1 + spec.effect.poison.ratio * spec.effect.poison.ticks * 0.6));   // พิษในดันเจี้ยน: รวมเป็นดาเมจก้อนเดียว
    m.hp = Math.max(0, m.hp - dmg);
    m.dmgBy.set(p.id, (m.dmgBy.get(p.id) || 0) + dmg);
    io.to(room(I)).emit('dg:dmg', { mid: m.mid, by: p.id, hit: true, crit: r.crit, dmg, hp: Math.round(m.hp), stun: spec.effect?.stun && !m.boss ? spec.effect.stun.ms : 0 });
    if (m.hp <= 0) killMob(I, m);
  }
  function killMob(I, m) {
    I.mobs.delete(m.mid);
    io.to(room(I)).emit('dg:die', { mid: m.mid });
    for (const p of alive(I)) {
      if (!p.save || p.dead) continue;
      const g = grant(p.save, { exp: Math.round(m.exp * blessingsOf(p.save).expMul) });
      refresh(p); queueSync(p);
      io.to(p.id).emit('dg:exp', { exp: Math.round(m.exp * blessingsOf(p.save).expMul), ups: g.ups, x: Math.round(m.x) });
    }
    if (m.boss) { I.bossDead = true; }
  }

  // ---------------- จบรอบ ----------------
  function gearFor(p, lv) {
    const pool = GEAR_IDS.filter((id) => GEAR[id].drop && GEAR[id].lv === lv);
    const own = pool.filter((id) => GEAR[id].job === p.save.path);
    const list = own.length && Math.random() < 0.7 ? own : pool;
    return list[Math.floor(Math.random() * list.length)];
  }
  function finish(I, success) {
    if (I.done) return;
    I.done = true;
    I.mobs.clear(); I.queue = [];
    const R = I.T.rewards, now = Date.now();
    for (const p of alive(I)) {
      cooldown.set(p.acc, now + DUNGEON.cooldownMs);
      if (!success) { io.to(p.id).emit('dg:end', { success: false }); continue; }
      const bl = blessingsOf(p.save);
      const items = R.items.map(([id, q]) => ({ id, qty: q }));
      if (Math.random() < R.gearChance * Math.min(2, bl.dropMul)) items.push({ id: gearFor(p, R.gearLv), qty: 1, rare: true });
      if (R.legendChance && Math.random() < R.legendChance) {
        const pool = LEGEND_IDS.filter((g) => !p.save.path || GEAR[g].job === p.save.path);
        items.push({ id: pool[Math.floor(Math.random() * pool.length)], qty: 1, rare: true });
      }
      const r = { exp: Math.round(R.exp * bl.expMul), gold: Math.round(R.gold * bl.goldMul), items };
      p.save.rec ||= {}; p.save.rec.dungeon = (p.save.rec.dungeon || 0) + 1;
      if (I.tier === 'hell') p.save.rec.dungeonHell = (p.save.rec.dungeonHell || 0) + 1;
      const g = grant(p.save, r);
      refresh(p); queueSync(p);
      io.to(p.id).emit('dg:end', { success: true, ...r, ...g, tier: I.tier, secs: Math.round((now - I.startAt) / 1000) });
      if (g.titles?.length) social?.announceTitles(p, g.titles);
    }
    if (success) {
      const names = alive(I).map((p) => p.name).join(', ');
      io.emit('chat', { id: null, name: '🕯️ สุสานใต้ดิน', text: `${names} พิชิตสุสานใต้ดินระดับ${I.T.nameTh}ได้ใน ${Math.round((now - I.startAt) / 1000)} วิ!` });
    }
    I.closeAt = now + 7000;                   // ให้เวลาดูรางวัล แล้วส่งกลับหมู่บ้าน
  }

  // ---------------- loop ----------------
  let last = Date.now(), lastSend = 0;
  function tick() {
    const now = Date.now(), dt = Math.min(0.2, (now - last) / 1000);
    last = now;
    const send = now - lastSend > 90;
    if (send) lastSend = now;
    for (const I of insts.values()) {
      const ps = alive(I);
      if (!ps.length) { insts.delete(I.id); continue; }
      if (I.done) {
        if (now >= I.closeAt) {
          for (const p of ps) {
            leave(p, 'end');
            if (mapAt(p.x).dungeon) { H.warpTo?.(p, MAPS.village, 600); io.to(p.id).emit('dg:exit', { x: Math.round(p.x) }); }
            if (p.dead) { p.dead = false; p.hp = p.maxHp; p.hpDirty = true; }
          }
          insts.delete(I.id);
        }
        continue;
      }
      if (now > I.endAt) { io.to(room(I)).emit('chat', { id: null, name: '🕯️ สุสานใต้ดิน', text: 'หมดเวลา! วิญญาณในสุสานกลืนทุกคนกลับขึ้นไป…' }); finish(I, false); continue; }
      if (ps.every((p) => p.dead)) { finish(I, false); continue; }
      if (I.state === 'intro' && now >= I.nextAt) nextWave(I, now);
      while (I.queue.length && I.queue[0].at <= now) spawnMob(I, I.queue.shift().type);
      for (const m of I.mobs.values()) stepMob(I, m, dt, now, ps.filter((p) => mapAt(p.x).dungeon));
      if (I.state !== 'intro' && !I.mobs.size && !I.queue.length) {
        if (I.state === 'boss' && I.bossDead) finish(I, true);
        else if (I.state === 'wave') { I.state = 'break'; I.nextAt = now + 3500; io.to(room(I)).emit('dg:cleared', { wave: I.wave }); }
      }
      if (I.state === 'break' && now >= I.nextAt) nextWave(I, now);
      if (send) io.to(room(I)).volatile.emit('dg:state', publicState(I, now));
    }
  }
  function publicState(I, now = Date.now()) {
    return {
      id: I.id, tier: I.tier, wave: I.wave, waves: DUNGEON.waves, left: Math.max(0, I.endAt - now), state: I.state,
      mobs: [...I.mobs.values()].map((m) => [m.mid, m.type, Math.round(m.x), Math.round(m.y), Math.round(m.hp), m.maxHp, m.anim === 'attack' ? 1 : 0, m.dir, m.atkSeq, m.boss ? 1 : 0]),
    };
  }

  function onConnection(socket) {
    socket.on('dg:enter', ({ tier } = {}, ack) => {
      const p = players.get(socket.id);
      const r = p ? enter(p, String(tier || '')) : { ok: false, msg: 'ยังไม่ได้เข้าเกม' };
      if (typeof ack === 'function') ack(r);
    });
    socket.on('dg:hit', (d) => onHit(socket, d));
    socket.on('dg:leave', () => { const p = players.get(socket.id); if (p?.inst) { leave(p); H.warpTo?.(p, MAPS.village, 600); socket.emit('dg:exit', { x: Math.round(p.x) }); } });
    socket.on('dg:info', (d, ack) => {
      const p = players.get(socket.id);
      if (typeof ack === 'function') ack({ cooldown: p ? Math.max(0, (cooldown.get(p.acc) || 0) - Date.now()) : 0 });
    });
  }
  function onDisconnect(id) { const p = players.get(id); if (p?.inst) leave(p, 'disconnect'); }

  return { tick, onConnection, onDisconnect, leave, canRespawn, _insts: insts };
}
