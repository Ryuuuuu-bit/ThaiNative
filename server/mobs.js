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

const AGGRO_X = 170, AGGRO_Y = 90, RESPAWN_MS = 9000, ATTACK_MS = 650;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rand = (a, b) => a + Math.random() * (b - a);

export function setupMobs(io, players) {
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
      target: null, kvx: 0, stunUntil: 0, hitUntil: 0, respawnAt: 0, dmgBy: new Map(), homeY: 0,
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

  // ---------------- ผู้เล่นตีผี ----------------
  function onHit(socket, d = {}) {
    const p = players.get(socket.id), m = mobs[d.gi | 0];
    if (!p || !m || m.st === 'dead') return;
    if (mapAt(p.x).id !== m.map.id || Math.abs(p.x - m.x) > 420) return;       // ต้องอยู่แมพเดียวกัน ใกล้พอ
    const now = Date.now();
    p.hitWin = now - (p.hitWinAt || 0) > 1000 ? 0 : p.hitWin || 0;             // จำกัด 40 ครั้ง/วินาที
    if (!p.hitWin) p.hitWinAt = now;
    if (++p.hitWin > 40) return;
    const dmg = clamp(Math.round(Number(d.dmg) || 0), 0, m.d.hp * 2);
    const knock = clamp(Number(d.knock) || 0, 0, 300), dir = d.dir === -1 ? -1 : 1;
    if (d.stun) m.stunUntil = Math.max(m.stunUntil, now + clamp(Number(d.stun) || 0, 0, 2500));
    if (!dmg) return;
    m.hp -= dmg;
    m.dmgBy.set(p.id, (m.dmgBy.get(p.id) || 0) + dmg);
    if (m.hp <= 0) return kill(m, p);
    if (m.d.level >= 8) m.kvx += dir * knock * 0.2;                             // ผีเลเวลสูงไม่สะดุ้ง
    else { m.kvx += dir * knock; m.hitUntil = now + 280; if (m.st === 'attack') m.st = 'chase'; }
  }

  function kill(m, killer) {
    m.hp = 0;
    m.st = 'dead';
    m.respawnAt = Date.now() + RESPAWN_MS;
    // ผู้ช่วย: ใครทำดาเมจ ≥ 15% ได้ EXP ด้วย
    const assist = [...m.dmgBy.entries()].filter(([id, v]) => id !== killer.id && v >= m.d.hp * 0.15).map(([id]) => id);
    io.to(`m:${m.map.id}`).emit('mob:die', { gi: m.gi, killer: killer.id, assist, x: Math.round(m.x) });
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
