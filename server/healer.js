// ============================================================
//  หมอยา (ซัพพอร์ต) – ฮีล/ชุบชีวิต/กันตาย คิดที่ server ทั้งหมด
//  ▸ "เพื่อน" = ตัวเอง + สมาชิกปาร์ตี้ที่อยู่แมพเดียวกัน (ไม่อยู่ปาร์ตี้ = ตัวเอง)
//  ▸ client เลือกเป้า (d.allies / d.tx,ty) → server ตรวจระยะแล้วค่อยรักษา
//  ▸ ดาเมจใส่ผีของสกิลหมอยายังส่งผ่าน td:hit (sk) ตามปกติ
//  ▸ แจ้งทุกคนในแมพด้วย td:heal { id, amt, fx } · สายใย td:tether · ชุบชีวิต td:revive
// ============================================================
import { combatDerived } from '../shared/character.js';

export function setupHealer(io, players, { healPlayer, queueSync, social, tdSys }) {
  const posOf = (p) => (p.world === 'td' ? { x: p.tx, y: p.ty } : { x: p.x, y: p.y });
  const sameMap = (a, b) => (a.world || 'td') === (b.world || 'td') && (a.world !== 'td' || tdSys.mapOf(a) === tdSys.mapOf(b));
  const dist = (a, b) => { const A = posOf(a), B = posOf(b); return Math.hypot(A.x - B.x, A.y - B.y); };
  const room = (p) => (p.world === 'td' ? tdSys.room(p) : null);
  const emitRoom = (p, ev, d) => { const r = room(p); if (r) io.to(r).emit(ev, d); else io.to(p.id).emit(ev, d); };

  /** ตัวเอง + เพื่อนร่วมปาร์ตี้ในแมพเดียวกัน (รวมคนที่สลบถ้า withDead) */
  function allies(p, withDead = false) {
    const party = social.partyOf(p);
    const ids = party ? [...party.members] : [p.id];
    return ids.map((id) => players.get(id)).filter((m) => m && sameMap(m, p) && (withDead || !m.dead));
  }
  const matkOf = (p, now) => combatDerived(p.char || p.save, p.buffs, now).matk || 1;

  /** รักษา + แจ้งตัวเลขสีเขียว */
  function heal(caster, t, amt, fx = 'heal', sk = null) {
    if (!t || t.dead) return 0;
    amt = Math.max(1, Math.round(amt));
    const before = t.hp;
    healPlayer(t, amt);
    const got = Math.round(t.hp - before);
    emitRoom(caster, 'td:heal', { id: t.id, amt: got > 0 ? got : amt, over: got <= 0, fx, sk, by: caster.id });
    return got;
  }

  const tethers = new Map();          // casterId → { tid, until, next, sk, amt }
  const seeds = new Map();            // targetId → { by, at, amt, low, sk }

  /** ร่ายสกิลหมอยา (ผ่านการตรวจคูลดาวน์/เลเวลใน skill:cast แล้ว) */
  function cast(p, sk, d, now = Date.now()) {
    const pick = (list, max, range) => {
      const mine = allies(p);
      const want = Array.isArray(list) ? list.slice(0, max) : [];
      const out = [];
      for (const id of want) { const t = mine.find((m) => m.id === id); if (t && dist(t, p) <= range) out.push(t); }
      return out;
    };
    const lowest = (range) => allies(p).filter((m) => dist(m, p) <= range).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] || p;
    const matk = matkOf(p, now);

    switch (sk.type) {
      case 'tether': {                                      // สายใยสมุนไพร
        const t = pick(d.allies, 1, sk.range + 40)[0] || lowest(sk.range);
        tethers.set(p.id, { tid: t.id, until: now + sk.duration, next: now + sk.tick, sk, amt: matk * sk.hmult });
        emitRoom(p, 'td:tether', { id: p.id, tid: t.id, ms: sk.duration });
        break;
      }
      case 'bounce': {                                      // ลูกกลอนเด้ง: เพื่อนในห่วงโซ่ (client ส่งลำดับมา)
        const reach = sk.range + sk.hop * sk.bounces;
        const list = pick(d.allies, sk.bounces, reach);
        list.forEach((t, i) => setTimeout(() => heal(p, t, matk * sk.hmult * (0.95 + Math.random() * 0.1), 'pill', sk.id), 120 + i * 220));
        break;
      }
      case 'seed': {                                        // เมล็ดพันธุ์ชีวา
        const t = pick(d.allies, 1, sk.range + 40)[0] || lowest(sk.range);
        seeds.set(t.id, { by: p.id, at: now + sk.delay, amt: matk * sk.hmult, low: sk.lowHp, sk: sk.id });
        emitRoom(p, 'td:seed', { id: t.id, by: p.id, ms: sk.delay });
        break;
      }
      case 'revive': {                                      // พิธีสู่ขวัญ (หลังร่ายเสร็จ)
        setTimeout(() => {
          if (!players.has(p.id) || p.dead) return;
          const at = Date.now();
          for (const t of allies(p, true)) {
            if (t !== p && dist(t, p) > sk.radius + 40) continue;
            if (t.dead) {
              t.dead = false; t.hp = Math.max(1, t.maxHp * sk.heal); t.invulnUntil = at + 1500; t.hpDirty = true;
              io.to(t.id).emit('td:revive', { hp: Math.round(t.hp), maxHp: t.maxHp, by: p.name });
              emitRoom(p, 'td:heal', { id: t.id, amt: Math.round(t.hp), fx: 'revive', sk: sk.id, by: p.id });
              queueSync(t);
            } else heal(p, t, t.maxHp * sk.heal, 'khwan', sk.id);
            t.buffs = (t.buffs || []).filter((b) => b.until > at && b.sk !== sk.id);
            t.buffs.push({ buff: { undying: true }, until: at + sk.undying, sk: sk.id });
            if (t !== p) io.to(t.id).emit('td:pbuff', { from: p.name, fromId: p.id, skillId: sk.id, lv: sk.lv });
          }
        }, sk.castMs || 0);
        break;
      }
      case 'mortar': {                                      // ครกยา: รักษาเพื่อนในวงหลังตำครบ
        const tx = Number(d.tx), ty = Number(d.ty), P = posOf(p);
        const c = Number.isFinite(tx) && Number.isFinite(ty) && Math.hypot(tx - P.x, ty - P.y) <= (sk.offset || 0) + 160 ? { x: tx, y: ty } : { x: P.x, y: P.y };
        const n = Math.max(0, Math.min(5, d.n | 0));
        const mul = 1 + Math.min(sk.perMax, sk.perHit * n);
        setTimeout(() => {
          if (!players.has(p.id)) return;
          for (const t of allies(p)) { const T = posOf(t); if (Math.hypot(T.x - c.x, T.y - c.y) <= sk.radius + 30) heal(p, t, matk * sk.hmult * mul, 'mortar', sk.id); }
        }, 200 + sk.hits * sk.interval + 250);
        break;
      }
      default: return false;
    }
    return true;
  }

  /** ขวัญกันตาย: เลือดไม่ลดต่ำกว่า 1 */
  const undying = (p, now = Date.now()) => (p.buffs || []).some((b) => b.buff?.undying && b.until > now);

  /** เรียก ~4 ครั้ง/วิ */
  function tick(now = Date.now()) {
    for (const [cid, t] of tethers) {
      const c = players.get(cid), tg = players.get(t.tid);
      if (!c || !tg || c.dead || tg.dead || now > t.until || !sameMap(c, tg) || dist(c, tg) > t.sk.breakAt) {
        tethers.delete(cid);
        if (c) emitRoom(c, 'td:tether', { id: cid, tid: t.tid, off: true, snap: !!(c && tg && now <= t.until) });
        continue;
      }
      if (now >= t.next) {
        t.next += t.sk.tick;
        heal(c, tg, t.amt * (dist(c, tg) <= t.sk.near ? t.sk.nearMul : 1), 'vine', t.sk.id);
      }
    }
    for (const [tid, s] of seeds) {
      const t = players.get(tid);
      if (!t || t.dead) { seeds.delete(tid); continue; }
      const low = t.hp < t.maxHp * s.low;
      if (now >= s.at || low) {
        seeds.delete(tid);
        const c = players.get(s.by) || t;
        heal(c, t, s.amt * (low ? 1.15 : 1), low ? 'bloomNow' : 'bloom', s.sk);
      }
    }
  }
  const forget = (id) => { tethers.delete(id); seeds.delete(id); };

  return { cast, tick, undying, forget, allies };
}
