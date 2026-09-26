// ============================================================
//  Mobs – ผีในแมพล่าผี "คุมโดย server" (ทุกคนเห็นผีตัวเดียวกัน)
//  ▸ ลำดับผี (gi) ตรงกับที่ client สร้าง: MONSTER_IDS ตามลำดับ × count (บอสภาคต่อท้าย)
//  ▸ จำลองเฉพาะแมพที่มีผู้เล่นอยู่ · ส่งสถานะเฉพาะคนในแมพนั้น (socket room `m:<mapId>`)
//  ▸ ผู้เล่นตีผี: client ส่งแค่ท่าที่ใช้ → server ทอยดาเมจ/หัก HP/แจกรางวัล (ใส่เซฟจริง)
//  ▸ ผีตีผู้เล่น: server ตัดสินว่าโดนไหมจากตำแหน่ง แล้วหัก HP ผู้เล่นเอง (HP อยู่ที่ server)
// ============================================================
import { WORLD } from '../shared/constants.js';
import { MONSTERS, MONSTER_IDS } from '../shared/data/monsters.js';
import { MAPS, mapAt, REGIONS } from '../shared/data/maps.js';
import { rollDamage } from '../shared/stats.js';
import { combatDerived, attackSpec, blessingsOf, attackGate } from '../shared/character.js';
import { dayPhase, dayIndex, moonOf, nightMods, isNight } from '../shared/data/world.js';
import { rollGearDrop } from '../shared/data/gear.js';
import { grantKill, grant } from '../shared/economy.js';

const AGGRO_X = 170, AGGRO_Y = 90, RESPAWN_MS = 9000, ATTACK_MS = 650;
const STRIKE_MS = 330;               // ท่าตีของผีลงดาเมจหลังเริ่มท่า ~0.33 วิ (ตรงกับเฟรมตีฝั่ง client)
const SHOT_SPEED = 140;              // ความเร็วกระสุนผี (ตรงกับ client)
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rand = (a, b) => a + Math.random() * (b - a);

/** ขนาดตัวผี (โดยประมาณจากข้อมูลเฟรม) สำหรับตรวจการโดน */
const bodyOf = (d) => {
  const f = d.frame || { w: 24, h: 30 }, s = d.scale || 1;
  return { hw: ((f.bodyW || f.w * 0.6) / 2) * s, h: (f.bodyH || f.h) * 0.85 * s };
};
const PLAYER_HW = 7, PLAYER_H = 30;

export function setupMobs(io, players, opts = {}) {
  const { dayMs = 20 * 60 * 1000, shareExp = () => {}, queueSync = () => {}, refresh = () => {}, hurtPlayer = () => {} } = opts;
  // ---------------- สร้างผีทั้งหมด (ลำดับเดียวกับ client) ----------------
  const mobs = [];
  for (const id of MONSTER_IDS) {
    const d = MONSTERS[id];
    for (let i = 0; i < (d.count ?? 2); i++) {
      const map = MAPS[d.mapId];
      if (!map) { mobs.push(null); continue; }
      mobs.push(spawn({ gi: mobs.length, id, d, map, hp: d.hp }));
    }
  }
  const byMap = {};
  for (const m of mobs) if (m) (byMap[m.map.id] ||= []).push(m);
  const bosses = mobs.filter((m) => m?.d.regionBoss);
  // บอสภาค: เกิดครั้งแรกหลัง server เริ่ม 2–6 นาที (ไม่ให้ทุกภาคเกิดพร้อมกัน)
  const firstBoss = Number(process.env.RBOSS_FIRST_MS ?? 120000);
  bosses.forEach((b, i) => { b.st = 'dead'; b.hp = 0; b.respawnAt = Date.now() + firstBoss + i * 60000; b.announced = false; });

  function spawn(m) {
    Object.assign(m, {
      x: rand(m.d.zone[0], m.d.zone[1]), y: m.d.behavior === 'flyer' ? WORLD.groundY - 30 - rand(0, 30) : WORLD.groundY,
      hp: m.d.hp, st: 'patrol', dir: Math.random() < 0.5 ? -1 : 1, nextTurn: 0, lastAttack: 0, atkSeq: m.atkSeq || 0,
      target: null, kvx: 0, stunUntil: 0, hitUntil: 0, respawnAt: 0, dmgBy: new Map(), homeY: 0, poison: null, pending: [], atkN: 0,
    });
    m.homeY = m.y;
    return m;
  }

  const bounds = (m) => [m.map.safeEndX + 10, m.map.maxX - 14];

  // ---------------- ห้อง socket ตามแมพ ----------------
  function roomOf(p) {
    const id = mapAt(p.x).id;
    if (p.mapRoom === id) return;
    const sock = io.sockets.sockets.get(p.id);
    if (!sock) return;
    if (p.mapRoom) sock.leave(`m:${p.mapRoom}`);
    sock.join(`m:${id}`);
    p.mapRoom = id;
    if (byMap[id]) sock.emit('mob:state', packMap(id, true));
  }

  // ---------------- AI ----------------
  function step(m, dt, now, here) {
    const d = m.d;
    if (m.st === 'dead') {
      if (now >= m.respawnAt) {
        spawn(m); m.born = now;
        if (d.regionBoss) announceBoss(m);
      }
      return;
    }
    const [lo, hi] = bounds(m);
    if (m.poison && now >= m.poison.next) {
      const q = m.poison, by = players.get(q.by);
      if (by && q.left > 0) { q.left--; q.next = now + q.every; damage(m, by, q.per, false, { poison: true, tick: true }); if (m.st === 'dead') return; }
      if (!by || q.left <= 0) m.poison = null;
    }
    resolvePending(m, now, here);
    if (now < m.stunUntil) { m.kvx = 0; return; }
    if (m.kvx) { m.x = clamp(m.x + m.kvx * dt, lo, hi); m.kvx *= Math.pow(0.02, dt); if (Math.abs(m.kvx) < 5) m.kvx = 0; }
    if (now < m.hitUntil) return;
    if (m.st === 'attack' && now - m.lastAttack < ATTACK_MS) return;

    let tgt = null, best = Infinity;
    for (const p of here) {
      if (p.dead || p.hp <= 0 || p.x <= m.map.safeEndX) continue;
      const dx = Math.abs(p.x - m.x), dy = Math.abs(p.y - m.y);
      if (dx < AGGRO_X * (d.regionBoss ? 1.4 : 1) && dy < AGGRO_Y && dx < best) { best = dx; tgt = p; }
    }
    m.target = tgt?.id || null;
    let vx = 0;
    if (tgt) {
      m.st = 'chase';
      const face = Math.sign(tgt.x - m.x) || 1, dist = Math.abs(tgt.x - m.x);
      m.dir = face;
      const reach = d.attackRange * 0.6 + 18 * (d.scale || 1);
      if (d.behavior === 'ranged') {
        if (dist < d.attackRange * 0.45) vx = -face * d.speed;
        else if (dist > d.attackRange) vx = face * d.speed;
        if (dist <= d.attackRange && Math.abs(tgt.y - m.y) < 60) attack(m, now, tgt);
      } else {
        if (dist > reach * 0.55) vx = face * d.speed;
        if (dist <= reach && Math.abs(tgt.y - m.y) < 50 * (d.scale || 1)) attack(m, now, tgt);
      }
      if (d.behavior === 'flyer') m.y += clamp((tgt.y - 8 - m.y) * 2, -d.speed, d.speed) * dt;
    } else {
      m.st = 'patrol';
      if (now > m.nextTurn) { m.dir = Math.random() < 0.3 ? 0 : (Math.random() < 0.5 ? -1 : 1); m.nextTurn = now + rand(1500, 3500); }
      if (m.x < d.zone[0]) m.dir = 1;
      if (m.x > d.zone[1]) m.dir = -1;
      vx = m.dir * d.speed * 0.45;
      if (d.behavior === 'flyer') m.y += clamp((m.homeY + Math.sin(now / 500 + m.gi) * 8 - m.y) * 2, -d.speed, d.speed) * dt;
      if (d.regionBoss && m.hp < d.hp) m.hp = Math.min(d.hp, m.hp + d.hp * 0.01 * dt);   // บอสไม่มีคนสู้ → ฟื้นช้า ๆ
    }
    if (m.st === 'attack') return;
    m.x = clamp(m.x + vx * dt, lo, hi);
    m.vx = vx;
  }

  /** เริ่มท่าโจมตี → นัดเวลาลงดาเมจ (server ตัดสินว่าโดนใคร) */
  function attack(m, now, tgt) {
    if (now - m.lastAttack < m.d.attackCooldown) return;
    m.lastAttack = now;
    m.st = 'attack';
    m.atkSeq = (m.atkSeq + 1) % 1000;
    m.atkN++;
    const d = m.d;
    if (d.projectile) {
      const tx = tgt.x, ty = tgt.y - 16, sx = m.x, sy = m.y - bodyOf(d).h / 2;
      const t = Math.hypot(tx - sx, ty - sy) / SHOT_SPEED * 1000;
      m.pending.push({ at: now + STRIKE_MS + t, kind: 'shot', tx, ty });
    } else {
      m.pending.push({ at: now + STRIKE_MS, kind: d.regionBoss && m.atkN % 3 === 0 ? 'slam' : 'melee' });
      if (d.regionBoss && m.atkN % 3 === 0) io.to(`m:${m.map.id}`).emit('rboss:slam', { gi: m.gi, x: Math.round(m.x), at: STRIKE_MS });
    }
  }

  /** ตัวคูณตามเวลาโลก (กลางคืน/เดือนดับ/วันพระ) */
  function timeMods(d) {
    const now = Date.now(), phase = dayPhase(now, dayMs), moon = moonOf(dayIndex(now + dayMs * 0.25, dayMs));
    const m = nightMods(phase, moon);
    return d.nightBoost && isNight(phase) ? { ...m, atk: m.atk * 1.15, exp: m.exp * 1.2, gold: m.gold * 1.2 } : m;
  }
  const mobAtk = (d) => { const a = Math.round(d.atk * timeMods(d).atk); return { patk: a, matk: a, accuracy: d.acc, critRate: 0.05, critDmg: 1.5 }; };

  /** ถึงเวลาที่ท่าตีลง → หาผู้เล่นที่โดน */
  function resolvePending(m, now, here) {
    if (!m.pending.length) return;
    const d = m.d, B = bodyOf(d);
    const keep = [];
    for (const a of m.pending) {
      if (a.at > now) { keep.push(a); continue; }
      if (m.st === 'dead' || now < m.stunUntil) continue;
      const kind = d.projectile ? 'magic' : 'physical';
      const hitP = (p, mult = 1, extra = {}) => {
        const pd = combatDerived(p.char, p.buffs, now);
        const r = rollDamage(mobAtk(d), { def: pd.def, eva: pd.eva }, kind, mult);
        hurtPlayer(p, r.dmg, { hit: r.hit, crit: r.crit, x: Math.round(m.x), ...extra });
      };
      if (a.kind === 'shot') {
        const p = here.find((q) => !q.dead && Math.abs(q.x - a.tx) < 16 && Math.abs(q.y - 16 - a.ty) < 26);
        if (p) hitP(p);
      } else if (a.kind === 'slam') {                                   // บอสภาค: ทุบพื้นรอบตัว
        for (const p of here) if (!p.dead && Math.abs(p.x - m.x) < 95 * (d.scale || 1) && p.y > WORLD.groundY - 40) hitP(p, 1.4, { stun: 600 });
      } else {
        const reach = d.attackRange * 0.6 + 6;
        for (const p of here) {
          if (p.dead) continue;
          const gap = Math.abs(p.x - m.x) - (B.hw + PLAYER_HW);
          const vOver = m.y + 6 >= p.y - PLAYER_H && p.y + 6 >= m.y - B.h;
          if (gap <= reach + 8 && vOver) hitP(p);
        }
      }
    }
    m.pending = keep;
  }

  // ---------------- ส่งสถานะ ----------------
  const ST = { patrol: 0, chase: 1, attack: 2, dead: 3 };
  function packMap(mapId, full = false) {
    const now = Date.now();
    return {
      map: mapId, full,
      l: byMap[mapId].map((m) => [m.gi, Math.round(m.x), Math.round(m.y), Math.max(0, Math.round(m.hp)), ST[m.st] ?? 0,
        m.dir < 0 ? -1 : 1, m.atkSeq, m.target || 0, now < m.stunUntil ? 1 : 0, now < m.hitUntil ? 1 : 0, Math.round(m.vx || 0)]),
    };
  }

  // ---------------- ผู้เล่นตีผี (server ทอยดาเมจจากค่าพลังจริง) ----------------
  function onHit(socket, d = {}) {
    const p = players.get(socket.id), m = mobs[d.gi | 0];
    if (!p || p.dead || !m || m.st === 'dead' || !p.char) return;
    if (mapAt(p.x).id !== m.map.id || Math.abs(p.x - m.x) > 420) return;
    const now = Date.now();
    p.hitWin = now - (p.hitWinAt || 0) > 1000 ? 0 : p.hitWin || 0;
    if (!p.hitWin) p.hitWinAt = now;
    if (++p.hitWin > 120) return;
    const sk = typeof d.sk === 'string' ? d.sk : null;
    const gate = attackGate(p, sk, !!d.combo, now);
    if (!gate) return;
    const spec = attackSpec(p.char, p.appearance?.job, sk, gate === 'combo');
    if (!spec) return;
    const dir = d.dir === -1 ? -1 : 1, knock = clamp(Number(d.knock) || 70, 0, 300);
    const r = rollDamage(combatDerived(p.char, p.buffs, now), { def: m.d.def, eva: m.d.eva }, spec.kind, spec.mult);
    if (!r.hit) return socket.emit('mob:dmg', { gi: m.gi, by: p.id, hit: false, crit: false, dmg: 0, dir, knock, hp: Math.round(m.hp) });
    const fx = {};
    if (spec.effect?.stun && !m.d.regionBoss) { m.stunUntil = Math.max(m.stunUntil, now + clamp(spec.effect.stun.ms, 0, 2500)); fx.stun = spec.effect.stun.ms; }
    if (spec.effect?.poison) { const q = spec.effect.poison; m.poison = { by: p.id, per: Math.max(1, Math.round(r.dmg * q.ratio)), left: q.ticks, every: q.every, next: now + q.every }; fx.poisoned = true; }
    damage(m, p, r.dmg, r.crit, { ...fx, dir, knock });
  }

  function damage(m, p, dmg, crit, fx = {}) {
    const now = Date.now();
    m.hp -= dmg;
    m.dmgBy.set(p.id, (m.dmgBy.get(p.id) || 0) + dmg);
    io.to(`m:${m.map.id}`).emit('mob:dmg', { gi: m.gi, by: p.id, hit: true, crit, dmg, hp: Math.max(0, Math.round(m.hp)), ...fx });
    if (m.hp <= 0) return kill(m, p);
    if (!fx.poison && !m.d.regionBoss) {
      const dir = fx.dir || 1, knock = fx.knock || 70;
      if (m.d.level >= 8) m.kvx += dir * knock * 0.2;
      else { m.kvx += dir * knock; m.hitUntil = now + 280; if (m.st === 'attack') m.st = 'chase'; }
    }
  }

  function kill(m, killer) {
    m.hp = 0;
    m.st = 'dead';
    m.poison = null;
    m.pending = [];
    const d = m.d, tm = timeMods(d);
    m.respawnAt = Date.now() + (d.respawnMs || RESPAWN_MS);
    if (d.regionBoss) return killBoss(m, killer, tm);
    const assist = [...m.dmgBy.entries()].filter(([id, v]) => id !== killer.id && v >= d.hp * 0.15).map(([id]) => id);
    io.to(`m:${m.map.id}`).emit('mob:die', { gi: m.gi, killer: killer.id, assist, x: Math.round(m.x) });
    // รางวัล: คนตีจบได้ EXP+เงิน+ของ · ผู้ช่วยได้ EXP (นับเควส/ค่าหัวด้วย) → ใส่เซฟจริงที่ server
    const reward = (p, isKiller) => {
      if (!p?.save) return;
      const bl = blessingsOf(p.save);
      const exp = Math.round(d.exp * tm.exp * bl.expMul);
      const out = { gi: m.gi, mon: m.id, kind: isKiller ? 'kill' : 'assist', exp, gold: 0, items: [], x: Math.round(m.x), y: Math.round(m.y), night: tm.exp > 1 };
      if (isKiller) {
        out.gold = Math.round(rand(d.gold[0], d.gold[1]) * tm.gold * bl.goldMul);
        out.items = (d.drops || []).filter((dr) => Math.random() < dr.chance * bl.dropMul).map((dr) => ({ id: dr.item, qty: 1 }));
        const gear = rollGearDrop(d.level, bl.dropMul);
        if (gear) out.items.push({ id: gear, qty: 1, rare: true });
      }
      const g = grantKill(p.save, out);
      Object.assign(out, g);
      refresh(p); queueSync(p);
      io.to(p.id).emit('mob:reward', out);
      if (isKiller) shareExp(p, exp, assist);
    };
    reward(killer, true);
    for (const id of assist) reward(players.get(id), false);
    m.dmgBy.clear();
  }

  // ---------------- บอสประจำภาค ----------------
  function announceBoss(m) {
    const R = REGIONS[m.d.region];
    io.emit('rboss:spawn', { gi: m.gi, id: m.id, mapId: m.map.id, nameTh: m.d.nameTh });
    io.emit('chat', { id: null, name: '👑 เจ้าถิ่น', text: `${m.d.nameTh} ปรากฏตัวที่ ${m.map.no}. ${m.map.nameTh} (ภาค ${R?.no} ${R?.nameTh})!` });
  }
  function killBoss(m, killer, tm) {
    const d = m.d, total = [...m.dmgBy.values()].reduce((a, b) => a + b, 0) || 1;
    const ranking = [...m.dmgBy.entries()].sort((a, b) => b[1] - a[1]);
    io.to(`m:${m.map.id}`).emit('mob:die', { gi: m.gi, killer: killer.id, assist: [], x: Math.round(m.x) });
    for (const [id, dmg] of ranking) {
      const p = players.get(id), share = dmg / total;
      if (!p?.save || share < 0.03) continue;
      const bl = blessingsOf(p.save), mult = 0.5 + Math.min(1, share * 2);
      const items = (d.drops || []).map((dr) => ({ id: dr.item, qty: 2 + Math.floor(Math.random() * 3) }));
      if (Math.random() < 0.25 * bl.dropMul) { const g = rollGearDrop(d.level + 2, 1 / 0.012); if (g) items.push({ id: g, qty: 1, rare: true }); }
      if (Math.random() < 0.3) items.push({ id: 'black_iron', qty: 2 });
      if (d.level >= 20 && Math.random() < 0.15) items.push({ id: 'yant_guard', qty: 1 });
      const r = { exp: Math.round(d.exp * mult * tm.exp * bl.expMul), gold: Math.round(rand(d.gold[0], d.gold[1]) * mult * bl.goldMul), items };
      p.save.rec ||= {}; p.save.rec.rboss = (p.save.rec.rboss || 0) + 1;
      (p.save.rec.rbossR ||= {})[d.region] = 1;
      const g = grant(p.save, r);
      refresh(p); queueSync(p);
      io.to(p.id).emit('rboss:reward', { ...r, ...g, nameTh: d.nameTh, share: Math.round(share * 100), rank: ranking.findIndex((x) => x[0] === id) + 1 });
    }
    const top = ranking.slice(0, 3).map(([id, v]) => `${players.get(id)?.name ?? '?'} (${v})`).join(', ');
    io.emit('rboss:down', { gi: m.gi, nameTh: d.nameTh, killer: killer.name });
    io.emit('chat', { id: null, name: '👑 เจ้าถิ่น', text: `${killer.name} ปราบ ${d.nameTh} ได้แล้ว! ดาเมจสูงสุด: ${top} · เกิดใหม่ในอีก 20 นาที` });
    m.dmgBy.clear();
  }

  // ---------------- loop ----------------
  let last = Date.now();
  function tick() {
    const now = Date.now(), dt = Math.min(0.2, (now - last) / 1000);
    last = now;
    const here = {};
    for (const p of players.values()) { roomOf(p); (here[p.mapRoom] ||= []).push(p); }
    for (const [mapId, list] of Object.entries(here)) {
      const ms = byMap[mapId];
      if (!ms) continue;
      for (const m of ms) step(m, dt, now, list);
      io.to(`m:${mapId}`).volatile.emit('mob:state', packMap(mapId));
    }
    // บอสภาคในแมพที่ไม่มีคน: ยังต้องเกิดตามเวลา (แจ้งทุกคน)
    for (const b of bosses) if (b.st === 'dead' && now >= b.respawnAt && !here[b.map.id]) { spawn(b); announceBoss(b); }
  }

  return {
    tick,
    onConnection(socket) {
      socket.on('mob:hit', (d) => onHit(socket, d));
      socket.emit('rboss:list', bosses.map((b) => ({ gi: b.gi, id: b.id, mapId: b.map.id, alive: b.st !== 'dead', respawnIn: b.st === 'dead' ? Math.max(0, b.respawnAt - Date.now()) : 0 })));
    },
    touch(p) { roomOf(p); },
    count: () => mobs.filter(Boolean).length,
    bossList: () => bosses.map((b) => ({ gi: b.gi, id: b.id, mapId: b.map.id, alive: b.st !== 'dead', respawnIn: b.st === 'dead' ? Math.max(0, b.respawnAt - Date.now()) : 0 })),
    _mobs: mobs,
  };
}
