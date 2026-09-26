// ============================================================
//  Mobs – ผีในแมพล่าผี "คุมโดย server" (ทุกคนเห็นผีตัวเดียวกัน)
//  ▸ ลำดับผี (gi) ตรงกับที่ client สร้าง: MONSTER_IDS ตามลำดับ × count
//  ▸ จำลองเฉพาะแมพที่มีผู้เล่นอยู่ · ส่งสถานะเฉพาะคนในแมพนั้น (socket room `m:<mapId>`)
//  ▸ ความเสียหาย: client ทอยแล้วส่ง mob:hit มา (ตรวจระยะ/อัตรา) → server หัก HP, ตาย/เกิดใหม่, แจกเครดิต
//  ▸ ผีตีผู้เล่น: server สั่งท่าโจมตี (atk seq) → client แต่ละเครื่องคำนวณว่าตัวเองโดนไหม
// ============================================================
import { WORLD } from '../shared/constants.js';
import { MONSTERS, MONSTER_IDS } from '../shared/data/monsters.js';
import { MAPS, mapAt } from '../shared/data/maps.js';
import { rollDamage } from '../shared/stats.js';
import { combatDerived, attackSpec, blessingsOf } from '../shared/character.js';
import { dayPhase, dayIndex, moonOf, nightMods, isNight } from '../shared/data/world.js';

const AGGRO_X = 170, AGGRO_Y = 90, RESPAWN_MS = 9000, ATTACK_MS = 650;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rand = (a, b) => a + Math.random() * (b - a);

export function setupMobs(io, players, opts = {}) {
  const { dayMs = 20 * 60 * 1000, shareExp = () => {} } = opts;
  // ---------------- สร้างผีทั้งหมด (ลำดับเดียวกับ client) ----------------
  const mobs = [];
  for (const id of MONSTER_IDS) {
    const d = MONSTERS[id];
    for (let i = 0; i < (d.count ?? 2); i++) {
      const map = MAPS[d.mapId];
      if (!map) { mobs.push(null); continue; }            // ผีที่ไม่มีแมพ (ไม่ได้ใช้) – กันดัชนีเลื่อน
      mobs.push(spawn({ gi: mobs.length, id, d, map, hp: d.hp }));
    }
  }
  const byMap = {};
  for (const m of mobs) if (m) (byMap[m.map.id] ||= []).push(m);

  function spawn(m) {
    Object.assign(m, {
      x: rand(m.d.zone[0], m.d.zone[1]), y: m.d.behavior === 'flyer' ? WORLD.groundY - 30 - rand(0, 30) : WORLD.groundY,
      hp: m.d.hp, st: 'patrol', dir: Math.random() < 0.5 ? -1 : 1, nextTurn: 0, lastAttack: 0, atkSeq: m.atkSeq || 0,
      target: null, kvx: 0, stunUntil: 0, hitUntil: 0, respawnAt: 0, dmgBy: new Map(), homeY: 0, poison: null,
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
    // เข้าแมพใหม่ → ส่งสถานะผีทั้งแมพทันที
    if (byMap[id]) sock.emit('mob:state', packMap(id, true));
  }

  // ---------------- AI ----------------
  function step(m, dt, now, here) {
    const d = m.d;
    if (m.st === 'dead') {
      if (now >= m.respawnAt) { spawn(m); m.born = now; }
      return;
    }
    const [lo, hi] = bounds(m);
    if (m.poison && now >= m.poison.next) {                         // พิษติ๊ก (server นับเอง)
      const q = m.poison, by = players.get(q.by);
      if (by && q.left > 0) { q.left--; q.next = now + q.every; damage(m, by, q.per, false, { poison: true }); if (m.st === 'dead') return; }
      if (!by || q.left <= 0) m.poison = null;
    }
    if (now < m.stunUntil) { m.kvx = 0; return; }
    // แรงกระแทก (โดนตีกระเด็น)
    if (m.kvx) { m.x = clamp(m.x + m.kvx * dt, lo, hi); m.kvx *= Math.pow(0.02, dt); if (Math.abs(m.kvx) < 5) m.kvx = 0; }
    if (now < m.hitUntil) return;
    if (m.st === 'attack' && now - m.lastAttack < ATTACK_MS) return;

    // เลือกเป้า: ผู้เล่นที่ยังไม่ตาย อยู่นอกจุดพัก ใกล้ที่สุดในระยะมองเห็น
    let tgt = null, best = Infinity;
    for (const p of here) {
      if (p.hp <= 0 || p.anim === 'die' || p.x <= m.map.safeEndX) continue;
      const dx = Math.abs(p.x - m.x), dy = Math.abs(p.y - m.y);
      if (dx < AGGRO_X && dy < AGGRO_Y && dx < best) { best = dx; tgt = p; }
    }
    m.target = tgt?.id || null;
    let vx = 0;
    if (tgt) {
      m.st = 'chase';
      const face = Math.sign(tgt.x - m.x) || 1, dist = Math.abs(tgt.x - m.x);
      m.dir = face;
      const reach = d.attackRange * 0.6 + 18;
      if (d.behavior === 'ranged') {
        if (dist < d.attackRange * 0.45) vx = -face * d.speed;
        else if (dist > d.attackRange) vx = face * d.speed;
        if (dist <= d.attackRange && Math.abs(tgt.y - m.y) < 60) attack(m, now);
      } else {
        if (dist > reach * 0.55) vx = face * d.speed;
        if (dist <= reach && Math.abs(tgt.y - m.y) < 50) attack(m, now);
      }
      if (d.behavior === 'flyer') m.y += clamp((tgt.y - 8 - m.y) * 2, -d.speed, d.speed) * dt;
    } else {
      m.st = 'patrol';
      if (now > m.nextTurn) { m.dir = Math.random() < 0.3 ? 0 : (Math.random() < 0.5 ? -1 : 1); m.nextTurn = now + rand(1500, 3500); }
      if (m.x < d.zone[0]) m.dir = 1;
      if (m.x > d.zone[1]) m.dir = -1;
      vx = m.dir * d.speed * 0.45;
      if (d.behavior === 'flyer') m.y += clamp((m.homeY + Math.sin(now / 500 + m.gi) * 8 - m.y) * 2, -d.speed, d.speed) * dt;
    }
    if (m.st === 'attack') return;
    m.x = clamp(m.x + vx * dt, lo, hi);
    m.vx = vx;
  }

  function attack(m, now) {
    if (now - m.lastAttack < m.d.attackCooldown) return;
    m.lastAttack = now;
    m.st = 'attack';
    m.atkSeq = (m.atkSeq + 1) % 1000;
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
    if (!p || !m || m.st === 'dead' || !p.char) return;
    if (mapAt(p.x).id !== m.map.id || Math.abs(p.x - m.x) > 420) return;       // ต้องอยู่แมพเดียวกัน ใกล้พอ
    const now = Date.now();
    p.hitWin = now - (p.hitWinAt || 0) > 1000 ? 0 : p.hitWin || 0;             // จำกัด 40 ครั้ง/วินาที
    if (!p.hitWin) p.hitWinAt = now;
    if (++p.hitWin > 40) return;
    const spec = attackSpec(p.char, p.appearance?.job, typeof d.sk === 'string' ? d.sk : null, !!d.combo);
    if (!spec) return;
    const dir = d.dir === -1 ? -1 : 1, knock = clamp(Number(d.knock) || 70, 0, 300);
    const r = rollDamage(combatDerived(p.char, p.char.buffs, now), { def: m.d.def, eva: m.d.eva }, spec.kind, spec.mult);
    if (!r.hit) return socket.emit('mob:dmg', { gi: m.gi, by: p.id, hit: false, crit: false, dmg: 0, dir, knock, hp: Math.round(m.hp) });
    const fx = {};
    if (spec.effect?.stun) { m.stunUntil = Math.max(m.stunUntil, now + clamp(spec.effect.stun.ms, 0, 2500)); fx.stun = spec.effect.stun.ms; }
    if (spec.effect?.poison) { const q = spec.effect.poison; m.poison = { by: p.id, per: Math.max(1, Math.round(r.dmg * q.ratio)), left: q.ticks, every: q.every, next: now + q.every }; fx.poison = true; }
    damage(m, p, r.dmg, r.crit, { ...fx, dir, knock });
  }

  /** หัก HP + แจ้งทุกคนในแมพ (ตัวเลขดาเมจ) + ตาย → รางวัล */
  function damage(m, p, dmg, crit, fx = {}) {
    const now = Date.now();
    m.hp -= dmg;
    m.dmgBy.set(p.id, (m.dmgBy.get(p.id) || 0) + dmg);
    io.to(`m:${m.map.id}`).emit('mob:dmg', { gi: m.gi, by: p.id, hit: true, crit, dmg, hp: Math.max(0, Math.round(m.hp)), ...fx });
    if (m.hp <= 0) return kill(m, p);
    if (!fx.poison) {
      const dir = fx.dir || 1, knock = fx.knock || 70;
      if (m.d.level >= 8) m.kvx += dir * knock * 0.2;                           // ผีเลเวลสูงไม่สะดุ้ง
      else { m.kvx += dir * knock; m.hitUntil = now + 280; if (m.st === 'attack') m.st = 'chase'; }
    }
  }

  /** ตัวคูณตามเวลาโลก (กลางคืน/เดือนดับ/วันพระ) */
  function timeMods(d) {
    const now = Date.now(), phase = dayPhase(now, dayMs), moon = moonOf(dayIndex(now + dayMs * 0.25, dayMs));
    const m = nightMods(phase, moon);
    return d.nightBoost && isNight(phase) ? { ...m, exp: m.exp * 1.2, gold: m.gold * 1.2 } : m;
  }

  function kill(m, killer) {
    m.hp = 0;
    m.st = 'dead';
    m.poison = null;
    m.respawnAt = Date.now() + RESPAWN_MS;
    const d = m.d, tm = timeMods(d);
    // ผู้ช่วย: ใครทำดาเมจ ≥ 15% ได้ EXP ด้วย
    const assist = [...m.dmgBy.entries()].filter(([id, v]) => id !== killer.id && v >= d.hp * 0.15).map(([id]) => id);
    io.to(`m:${m.map.id}`).emit('mob:die', { gi: m.gi, killer: killer.id, assist, x: Math.round(m.x) });
    // รางวัล (คำนวณฝั่ง server): คนตีจบได้ EXP+เงิน+ของ · ผู้ช่วยได้ EXP
    const reward = (p, isKiller) => {
      const bl = blessingsOf(p.char || {});
      const exp = Math.round(d.exp * tm.exp * bl.expMul);
      const out = { gi: m.gi, mon: m.id, kind: isKiller ? 'kill' : 'assist', exp, x: Math.round(m.x), y: Math.round(m.y), night: tm.exp > 1 };
      if (isKiller) {
        out.gold = Math.round(rand(d.gold[0], d.gold[1]) * tm.gold * bl.goldMul);
        out.items = (d.drops || []).filter((dr) => Math.random() < dr.chance * bl.dropMul).map((dr) => ({ id: dr.item, qty: 1 }));
      }
      io.to(p.id).emit('mob:reward', out);
      shareExp(p, exp);
    };
    reward(killer, true);
    for (const id of assist) { const p = players.get(id); if (p) reward(p, false); }
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
  }

  return {
    tick,
    onConnection(socket) {
      socket.on('mob:hit', (d) => onHit(socket, d));
    },
    /** ผู้เล่นวาร์ป/ต่อใหม่ → อัปเดตห้องทันที */
    touch(p) { roomOf(p); },
    count: () => mobs.filter(Boolean).length,
  };
}
