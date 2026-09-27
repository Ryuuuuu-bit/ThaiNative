// ============================================================
//  TD – โลก New Version (top-down 8 ทิศ) ฝั่ง server
//  ▸ แมพ "กรุงศรีอยุธยา" (shared/td/ayutthaya.js) · ผู้เล่นในโลกนี้มี p.world = 'td' และพิกัด p.tx/p.ty
//  ▸ server คุมผี (เดิน/ไล่/ตี) · ทอยดาเมจทั้งสองฝั่ง · แจกรางวัลใส่เซฟจริง (ใช้ grantKill ชุดเดียวกับโลกเดิม)
//  ▸ ส่ง td:state ให้ห้อง 'td' 10 ครั้ง/วิ
// ============================================================
import { MONSTERS } from '../shared/data/monsters.js';
import { JOBS } from '../shared/data/classes.js';
import { SKILL_BY_ID } from '../shared/data/skills.js';
import { rollDamage } from '../shared/stats.js';
import { combatDerived, attackSpec, blessingsOf, attackGate } from '../shared/character.js';
import { dayPhase, dayIndex, moonOf, nightMods, isNight } from '../shared/data/world.js';
import { rollGearDrop } from '../shared/data/gear.js';
import { rollCard, CARD_BY_ID } from '../shared/data/cards.js';
import { grantKill } from '../shared/economy.js';
import { NPC_BY_ID } from '../shared/data/npcs.js';
import { buildLayout, TILE, MAP_W, MAP_H, SPAWN, inTownXY, T } from '../shared/td/ayutthaya.js';

export const TD_SPAWN = { ...SPAWN };
const SPEED = 92;                   // ความเร็วเดินผู้เล่น (ตรงกับ client)
const AGGRO = 110, LEASH = 260, RESPAWN_MS = 9000, STRIKE_MS = 260;
const NPC_R = 56;                   // ระยะคุยกับ NPC
const rand = (a, b) => a + Math.random() * (b - a);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const ANIMS = ['idle', 'walk', 'attack', 'cast', 'hit', 'die'];
const DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];

export function setupTD(io, players, opts = {}) {
  const { dayMs = 20 * 60 * 1000, queueSync = () => {}, refresh = () => {}, hurtPlayer = () => {}, shareExp = () => {} } = opts;
  const L = buildLayout();
  const solidAt = (x, y) => {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    return tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H || L.solid[ty][tx];
  };
  const inTown = (x, y) => inTownXY(x, y);

  // ---------------- ผี ----------------
  const mobs = L.spawns.map((s, i) => spawn({ mid: i, id: s.id, d: MONSTERS[s.id], s }));
  function spawn(m) {
    let x, y, n = 0;
    do { x = m.s.x + rand(-m.s.r, m.s.r); y = m.s.y + rand(-m.s.r, m.s.r); } while (solidAt(x, y) && ++n < 20);
    return Object.assign(m, { x, y, hp: m.d.hp, st: 'wander', target: null, nextThink: 0, wx: null, wy: null, nextAtk: 0, pending: [], dmgBy: new Map(), respawnAt: 0, dir: 0 });
  }
  function timeMods(d) {
    const now = Date.now(), phase = dayPhase(now, dayMs), moon = moonOf(dayIndex(now + dayMs * 0.25, dayMs));
    const m = nightMods(phase, moon);
    return d.nightBoost && isNight(phase) ? { ...m, atk: m.atk * 1.15, exp: m.exp * 1.2, gold: m.gold * 1.2 } : m;
  }
  const mobAtk = (d) => { const a = Math.round(d.atk * timeMods(d).atk); return { patk: a, matk: a, accuracy: d.acc, critRate: 0.05, critDmg: 1.5 }; };
  const tdPlayers = () => [...players.values()].filter((p) => p.world === 'td');

  function moveMob(m, tx, ty, spd, dt) {
    const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy);
    if (d < 1) return;
    const k = Math.min(1, (spd * dt) / d), nx = m.x + dx * k, ny = m.y + dy * k;
    if (!solidAt(nx, m.y)) m.x = nx;
    if (!solidAt(m.x, ny)) m.y = ny;
    m.dir = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  }

  function tickMobs(dt, now, here) {
    for (const m of mobs) {
      const d = m.d;
      if (m.st === 'dead') { if (now >= m.respawnAt) spawn(m); continue; }
      // ท่าตีที่ค้าง → ถึงเวลาลงดาเมจ
      if (m.pending.length && now >= m.pending[0].at) {
        const a = m.pending.shift(), p = players.get(a.pid);
        if (p && p.world === 'td' && !p.dead && dist(m, { x: p.tx, y: p.ty }) <= (d.attackRange || 16) + 20) {
          const pd = combatDerived(p.char, p.buffs, now);
          const r = rollDamage(mobAtk(d), { def: pd.def, eva: pd.eva }, d.projectile ? 'magic' : 'physical', 1);
          hurtPlayer(p, r.dmg, { hit: r.hit, crit: r.crit, x: Math.round(m.x), force: true, td: true, mid: m.mid });
        }
      }
      // หาเป้า: ผู้เล่นที่ใกล้สุด (ไม่ไล่เข้าเขตเมือง)
      let best = null, bd = AGGRO;
      for (const p of here) { if (p.dead || inTown(p.tx, p.ty)) continue; const dd = dist(m, { x: p.tx, y: p.ty }); if (dd < bd) { bd = dd; best = p; } }
      const home = Math.hypot(m.x - m.s.x, m.y - m.s.y);
      if (best && home < LEASH) { m.st = 'chase'; m.target = best.id; }
      else if (m.st === 'chase') { m.st = 'wander'; m.target = null; m.wx = m.s.x; m.wy = m.s.y; }
      const spd = (d.speed || 40) * 0.9;
      if (m.st === 'chase') {
        const p = players.get(m.target), pos = { x: p.tx, y: p.ty }, dd = dist(m, pos);
        if (dd <= (d.attackRange || 16) + 8) {
          m.dir = Math.round(Math.atan2(pos.y - m.y, pos.x - m.x) / (Math.PI / 4));
          if (now >= m.nextAtk) {
            m.nextAtk = now + (d.attackCooldown || 1200);
            m.pending.push({ at: now + STRIKE_MS, pid: p.id });
            io.to('td').emit('td:matk', { mid: m.mid });
          }
        } else moveMob(m, pos.x, pos.y, spd, dt);
      } else {
        if (now >= m.nextThink) {
          m.nextThink = now + rand(1500, 3500);
          if (Math.random() < 0.6) { m.wx = m.s.x + rand(-m.s.r, m.s.r); m.wy = m.s.y + rand(-m.s.r, m.s.r); } else m.wx = null;
        }
        if (m.wx != null) { if (Math.hypot(m.wx - m.x, m.wy - m.y) < 5) m.wx = null; else moveMob(m, m.wx, m.wy, spd * 0.6, dt); }
      }
    }
  }

  // ---------------- ผู้เล่นตีผี ----------------
  function onHit(socket, d = {}) {
    const p = players.get(socket.id), m = mobs[d.mid | 0];
    if (!p || p.world !== 'td' || p.dead || !m || m.st === 'dead' || !p.char) return;
    const now = Date.now();
    const job = p.appearance?.job, atk = JOBS[job]?.attack;
    const sk = typeof d.sk === 'string' ? d.sk : null;
    const skb = sk ? SKILL_BY_ID[sk] : null;            // สกิลระยะไกล/วงกว้าง/พุ่ง → เอื้อมได้ไกลกว่าตีปกติ
    const range = Math.max(atk?.range || 30, skb ? (skb.range || 0) + (skb.distance || 0) + (skb.offset ? 240 : 0) + (skb.radius || 0) : 0) + 30;
    if (dist(m, { x: p.tx, y: p.ty }) > range) return;
    const gate = attackGate(p, sk, !!d.combo, now);
    if (!gate) return;
    // คูลดาวน์ตีปกติ (server): เร็วกว่าที่ client ตั้งไว้เล็กน้อยเผื่อ lag
    if (!sk) { if (now - (p.tdAtk || 0) < (atk?.cooldown || 500) * 0.7) return; p.tdAtk = now; }
    const spec = attackSpec(p.char, job, sk, gate === 'combo');
    if (!spec) return;
    const r = rollDamage(combatDerived(p.char, p.buffs, now), { def: m.d.def, eva: m.d.eva }, spec.kind, spec.mult);
    if (!r.hit) return io.to('td').emit('td:dmg', { mid: m.mid, by: p.id, hit: false, dmg: 0 });
    m.hp -= r.dmg;
    m.dmgBy.set(p.id, (m.dmgBy.get(p.id) || 0) + r.dmg);
    if (m.st !== 'chase') { m.st = 'chase'; m.target = p.id; }
    io.to('td').emit('td:dmg', { mid: m.mid, by: p.id, hit: true, crit: r.crit, dmg: r.dmg, hp: Math.max(0, Math.round(m.hp)) });
    if (m.hp <= 0) kill(m, p);
  }

  function kill(m, killer) {
    const d = m.d, tm = timeMods(d);
    m.hp = 0; m.st = 'dead'; m.pending = []; m.respawnAt = Date.now() + (d.respawnMs || RESPAWN_MS);
    const assist = [...m.dmgBy.entries()].filter(([id, v]) => id !== killer.id && v >= d.hp * 0.15).map(([id]) => id);
    io.to('td').emit('td:die', { mid: m.mid, killer: killer.id });
    const reward = (p, isKiller) => {
      if (!p?.save) return;
      const bl = blessingsOf(p.save);
      const exp = Math.round(d.exp * tm.exp * bl.expMul);
      const out = { mid: m.mid, mon: m.id, kind: isKiller ? 'kill' : 'assist', exp, gold: 0, items: [], x: Math.round(m.x), y: Math.round(m.y), night: tm.exp > 1 };
      if (isKiller) {
        out.gold = Math.round(rand(d.gold[0], d.gold[1]) * tm.gold * bl.goldMul);
        out.items = (d.drops || []).filter((dr) => Math.random() < dr.chance * bl.dropMul).map((dr) => ({ id: dr.item, qty: 1 }));
        const gear = rollGearDrop(d.level, bl.dropMul);
        if (gear) out.items.push({ id: gear, qty: 1, rare: true });
        const card = rollCard(m.id, bl.dropMul);                                   // การ์ดผี (0.5% · หัวหน้า 5%)
        if (card) {
          out.items.push({ id: card, qty: 1, rare: true, card: true });
          out.cardNew = !p.save.cardBook?.[card];
          io.emit('chat', { id: null, name: '🃏 การ์ด', text: `${p.name} ได้รับ ${CARD_BY_ID[card].nameTh}!` });
        }
      }
      Object.assign(out, grantKill(p.save, out));
      refresh(p); queueSync(p);
      io.to(p.id).emit('td:reward', out);
      if (isKiller) shareExp(p, exp, assist);
    };
    reward(killer, true);
    for (const id of assist) reward(players.get(id), false);
    m.dmgBy.clear();
  }

  // ---------------- เข้า/ออก/เดิน ----------------
  function publicTd(p) { return { id: p.id, name: p.name, appearance: p.appearance, x: Math.round(p.tx), y: Math.round(p.ty), level: p.level, hp: Math.round(p.hp), maxHp: p.maxHp, title: p.save?.title || null }; }

  function enter(socket, p) {
    const pos = p.save.tdPos;
    const ok = pos && Number.isFinite(pos.x) && !solidAt(pos.x, pos.y - 2);
    p.world = 'td'; p.tx = ok ? pos.x : TD_SPAWN.x; p.ty = ok ? pos.y : TD_SPAWN.y; p.tdir = 'south'; p.tanim = 'idle'; p.tdLast = Date.now();
    socket.join('td');
    socket.emit('td:init', { x: p.tx, y: p.ty, players: tdPlayers().filter((q) => q.id !== p.id).map(publicTd) });
    socket.to('td').emit('td:joined', publicTd(p));
  }

  function onMove(socket, s = {}) {
    const p = players.get(socket.id);
    if (!p || p.world !== 'td') return;
    const now = Date.now(), dt = Math.max(16, now - p.tdLast) / 1000;
    p.tdLast = now;
    if (p.dead) { p.tanim = 'die'; return; }
    const nx = Number(s.x), ny = Number(s.y);
    if (!Number.isFinite(nx) || !Number.isFinite(ny)) return;
    const max = SPEED * dt * 1.6 + 24, dx = nx - p.tx, dy = ny - p.ty, d = Math.hypot(dx, dy);
    const k = d > max ? max / d : 1, cx = p.tx + dx * k, cy = p.ty + dy * k;
    if (!solidAt(cx, cy - 2)) { p.tx = cx; p.ty = cy; }
    if (d > max || solidAt(cx, cy - 2)) socket.emit('td:correct', { x: Math.round(p.tx), y: Math.round(p.ty) });
    p.tdir = DIRS.includes(s.dir) ? s.dir : p.tdir;
    p.tanim = ANIMS.includes(s.anim) ? s.anim : 'idle';
    if (Number.isFinite(+s.mp)) p.save.mp = Math.max(0, Math.min(99999, +s.mp));   // MP ยังเป็นของ client (ร่ายสกิล/ฟื้นเอง) – เก็บไว้เซฟ
    if (now - (p.tdSaveAt || 0) > 3000) { p.tdSaveAt = now; p.save.tdPos = { x: Math.round(p.tx), y: Math.round(p.ty) }; p.dirty = true; }
  }

  function onRespawn(socket) {
    const p = players.get(socket.id);
    if (!p || p.world !== 'td' || (!p.dead && p.hp > 0)) return;
    p.dead = false; p.hp = p.maxHp; p.invulnUntil = Date.now() + 2000;
    p.tx = TD_SPAWN.x; p.ty = TD_SPAWN.y; p.save.tdPos = { ...TD_SPAWN }; p.hpDirty = true;
    socket.emit('td:respawn', { x: p.tx, y: p.ty, hp: Math.round(p.hp), maxHp: p.maxHp });
  }

  /** NPC บริการที่ผู้เล่นยืนใกล้ → คืนพิกัด x ของ NPC เดียวกันในหมู่บ้านโลกเดิม (ให้ runAction/nearNpc ตรวจผ่าน) */
  function econX(p) {
    for (const n of L.npcs) if (n.id && Math.hypot(n.x - p.tx, n.y - p.ty) <= NPC_R) { const v = NPC_BY_ID[n.id]; if (v) return v.x; }
    return null;
  }

  // ---------------- loop ----------------
  let last = Date.now();
  function tick() {
    const now = Date.now(), dt = Math.min(0.25, (now - last) / 1000); last = now;
    const here = tdPlayers();
    if (!here.length) return;
    tickMobs(dt, now, here);
    io.to('td').volatile.emit('td:state', {
      t: now,
      p: here.map((p) => [p.id, Math.round(p.tx), Math.round(p.ty), p.tdir, p.tanim, Math.round(p.hp), p.maxHp, p.level]),
      m: mobs.map((m) => [m.mid, Math.round(m.x), Math.round(m.y), m.dir, m.st === 'dead' ? 0 : Math.max(1, Math.round(m.hp)), m.st === 'chase' ? 1 : 0]),
    });
  }

  return {
    tick, econX,
    /** ยืนริมน้ำ (ตกปลาได้) */
    nearWater(p) {
      const tx = Math.floor(p.tx / TILE), ty = Math.floor(p.ty / TILE);
      for (let y = ty - 2; y <= ty + 2; y++) for (let x = tx - 2; x <= tx + 2; x++) { const g = L.ground[y]?.[x]; if (g === T.WATER || g === T.WATER2) return true; }
      return false;
    },
    warpHome(p) { p.tx = TD_SPAWN.x; p.ty = TD_SPAWN.y; p.tdLast = Date.now(); p.save.tdPos = { ...TD_SPAWN }; p.dirty = true; },
    inTown: (p) => inTown(p.tx, p.ty),
    onConnection(socket) {
      socket.on('td:enter', () => { const p = players.get(socket.id); if (p) enter(socket, p); });
      socket.on('td:move', (s) => onMove(socket, s));
      socket.on('td:hit', (d) => onHit(socket, d));
      socket.on('td:respawn', () => onRespawn(socket));
    },
    onLeave(p) { if (p.world === 'td') io.to('td').emit('td:left', p.id); },
    _mobs: mobs,
  };
}
