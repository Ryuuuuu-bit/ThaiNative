// ============================================================
//  อีเวนต์โลก: "ผีห่าบุกหมู่บ้าน" (server-authoritative)
//  ▸ เกิดอัตโนมัติเป็นระยะ ผีเดินจากชายป่าเข้าหาศาลพระภูมิ 5 ระลอก
//  ▸ ผู้เล่นทุกคนช่วยกันตี (server ถือ HP ผี/ศาล) → สำเร็จได้รางวัลตามส่วนร่วม
//  ▸ ศาลแตก = ล้มเหลว ร้านยายติ๋มปิด 10 นาที
// ============================================================
import { WORLD } from '../shared/constants.js';
import { MONSTERS } from '../shared/data/monsters.js';

export const INVASION = {
  shrineX: 240,
  spawnX: [1040, 1160],
  shrineMax: 3000,
  maxWaves: 5,
  waveMobs: (w, n) => 4 + w * 2 + Math.max(0, n - 1) * 2,         // จำนวนผีต่อระลอก (w เริ่ม 1, n = จำนวนผู้เล่น)
  types: [['phi_pob', 'kuman_thong'], ['phi_pob', 'phi_jang_nang'], ['pret', 'phi_jang_nang'], ['pret', 'saming'], ['phi_ha', 'saming']],
  firstMs: Number(process.env.EVENT_FIRST_MS ?? 8 * 60000),     // อีเวนต์แรกหลัง server เริ่ม
  everyMs: Number(process.env.EVENT_EVERY_MS ?? 30 * 60000),    // ห่างกันกี่นาที
  warnMs: 45000,                                                  // เตือนล่วงหน้า
  shopClosedMs: 10 * 60000,
  rewards: { exp: 500, gold: 300, items: [['ha_essence', 2], ['hp_m', 2]] },
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rnd = (a, b) => a + Math.random() * (b - a);
let seq = 1;

export function setupEvents(io, players) {
  const ev = {
    active: false, wave: 0, shrineHp: INVASION.shrineMax, mobs: new Map(), queue: [], contrib: new Map(),
    nextAt: Date.now() + INVASION.firstMs, warned: false, nextWaveAt: 0, shopClosedUntil: 0, lastTick: Date.now(),
  };
  const emitTo = (id, e, d) => io.sockets.sockets.get(id)?.emit(e, d);
  const sys = (text) => io.emit('chat', { id: null, name: '🔥 อีเวนต์', text });
  const alivePlayers = () => [...players.values()].filter((p) => p.hp > 0 && p.anim !== 'die');

  function start() {
    Object.assign(ev, { active: true, wave: 0, shrineHp: INVASION.shrineMax, warned: false });
    ev.mobs.clear(); ev.queue = []; ev.contrib.clear();
    io.emit('event:start', { maxWaves: INVASION.maxWaves, shrineMax: INVASION.shrineMax });
    sys('ผีห่าบุกหมู่บ้านบางผี! ทุกคนรีบกลับไปปกป้องศาลพระภูมิ!');
    nextWave();
  }

  function nextWave() {
    ev.wave++;
    const n = Math.max(1, players.size);
    const count = INVASION.waveMobs(ev.wave, n);
    const pool = INVASION.types[Math.min(ev.wave, INVASION.types.length) - 1];
    const now = Date.now();
    for (let i = 0; i < count; i++) {
      const type = pool[i % pool.length];
      ev.queue.push({ at: now + 1500 + i * 700, type });
    }
    io.emit('event:wave', { wave: ev.wave, maxWaves: INVASION.maxWaves, count });
  }

  function spawn(type) {
    const d = MONSTERS[type];
    const n = Math.max(1, players.size);
    const scale = (1 + ev.wave * 0.2) * (1 + (n - 1) * 0.35);
    const hp = Math.round(d.hp * scale);
    const m = {
      id: `m${seq++}`, type, x: rnd(...INVASION.spawnX), hp, maxHp: hp,
      atk: Math.round(d.atk * (1 + ev.wave * 0.1)), speed: d.speed * 0.75, dir: -1, anim: 'walk', nextAtk: 0,
      exp: Math.round(d.exp * 1.2), gold: Math.round((d.gold[0] + d.gold[1]) / 2),
    };
    ev.mobs.set(m.id, m);
  }

  function finish(success) {
    ev.active = false;
    ev.mobs.clear(); ev.queue = [];
    ev.nextAt = Date.now() + INVASION.everyMs;
    if (success) {
      const total = [...ev.contrib.values()].reduce((a, b) => a + b, 0) || 1;
      for (const [id, dmg] of ev.contrib) {
        if (!players.get(id)) continue;
        const share = dmg / total, mult = 0.6 + Math.min(0.9, share * 1.8);
        emitTo(id, 'event:reward', {
          exp: Math.round(INVASION.rewards.exp * mult), gold: Math.round(INVASION.rewards.gold * mult),
          items: INVASION.rewards.items.map(([iid, q]) => ({ id: iid, qty: q })), share: Math.round(share * 100),
        });
      }
      sys('ปกป้องศาลพระภูมิได้สำเร็จ! ชาวบ้านบางผีขอบคุณผู้กล้าทุกคน');
    } else {
      ev.shopClosedUntil = Date.now() + INVASION.shopClosedMs;
      sys('ศาลพระภูมิถูกทำลาย… ยายติ๋มหนีไปหลบผี ร้านปิด 10 นาที');
    }
    io.emit('event:end', { success, shopClosedMs: success ? 0 : INVASION.shopClosedMs });
  }

  function tick(now = Date.now()) {
    const dt = Math.min(0.2, (now - ev.lastTick) / 1000);
    ev.lastTick = now;
    if (!ev.active) {
      if (!players.size) { ev.nextAt = Math.max(ev.nextAt, now + 60000); ev.warned = false; return; }
      if (!ev.warned && now >= ev.nextAt - INVASION.warnMs) {
        ev.warned = true;
        io.emit('event:warn', { inMs: Math.max(0, ev.nextAt - now) });
        sys('ลมหนาววูบ… เสียงหมาหอนทั่วหมู่บ้าน ผีห่ากำลังมา!');
      }
      if (now >= ev.nextAt) start();
      return;
    }
    // ปล่อยผีตามคิว
    while (ev.queue.length && ev.queue[0].at <= now) spawn(ev.queue.shift().type);

    const fighters = alivePlayers();
    for (const m of ev.mobs.values()) {
      // เป้าหมาย: ผู้เล่นที่อยู่ใกล้ (≤ 110) ไม่งั้นเดินไปศาล
      let target = null, best = 110;
      for (const p of fighters) { const d = Math.abs(p.x - m.x); if (d < best && Math.abs(p.y - WORLD.groundY) < 90) { best = d; target = p; } }
      const goalX = target ? target.x : INVASION.shrineX;
      const dist = Math.abs(goalX - m.x);
      const reach = target ? 20 : 18;
      m.dir = goalX < m.x ? -1 : 1;
      if (dist > reach) { m.x += m.dir * m.speed * dt; m.anim = 'walk'; continue; }
      if (now < m.nextAtk) continue;
      m.nextAtk = now + 1500;
      m.anim = 'attack';
      if (target) io.emit('event:mobAtk', { mobId: m.id, targetId: target.id, dmg: m.atk, x: Math.round(m.x) });
      else {
        ev.shrineHp = Math.max(0, ev.shrineHp - m.atk);
        io.emit('event:shrineHit', { mobId: m.id, hp: ev.shrineHp });
        if (ev.shrineHp <= 0) return finish(false);
      }
    }
    if (!ev.mobs.size && !ev.queue.length) {
      if (!ev.nextWaveAt) {
        if (ev.wave >= INVASION.maxWaves) return finish(true);
        ev.nextWaveAt = now + 4000;
        io.emit('event:cleared', { wave: ev.wave });
      } else if (now >= ev.nextWaveAt) { ev.nextWaveAt = 0; nextWave(); }
    }
  }

  function onConnection(socket) {
    socket.on('event:hit', (d = {}) => {
      const p = players.get(socket.id), m = ev.mobs.get(d.mobId);
      if (!ev.active || !p || !m || Math.abs(p.x - m.x) > 420) return;
      const now = Date.now();
      p.evTokens = Math.min(12, (p.evTokens ?? 12) + ((now - (p.evT || now)) / 1000) * 12);
      p.evT = now;
      if (p.evTokens < 1) return;
      p.evTokens -= 1;
      const dmg = clamp(Math.floor(Number(d.dmg) || 0), 0, 400 + p.level * 90);
      if (!dmg) return;
      m.hp -= dmg;
      ev.contrib.set(p.id, (ev.contrib.get(p.id) || 0) + dmg);
      io.volatile.emit('event:dmg', { mobId: m.id, id: p.id, dmg, crit: !!d.crit, hp: Math.max(0, m.hp) });
      if (m.hp <= 0) {
        ev.mobs.delete(m.id);
        io.emit('event:mobDie', { mobId: m.id, by: p.id });
        emitTo(p.id, 'event:kill', { exp: m.exp, gold: m.gold, x: Math.round(m.x) });
      }
    });
    socket.emit('event:state', publicState());
  }

  function publicState() {
    const now = Date.now();
    return {
      active: ev.active, wave: ev.wave, maxWaves: INVASION.maxWaves, shrineHp: Math.round(ev.shrineHp), shrineMax: INVASION.shrineMax,
      mobs: ev.active ? [...ev.mobs.values()].map((m) => ({ id: m.id, type: m.type, x: Math.round(m.x), hp: Math.max(0, m.hp), maxHp: m.maxHp, anim: m.anim, dir: m.dir })) : [],
      nextIn: ev.active ? 0 : Math.max(0, ev.nextAt - now), shopClosedIn: Math.max(0, ev.shopClosedUntil - now),
    };
  }

  function onDisconnect(id) { ev.contrib.delete(id); }

  return { tick, onConnection, onDisconnect, publicState, _ev: ev, start };
}
