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
import { combatDerived, attackSpec, blessingsOf, attackGate, getDerived } from '../shared/character.js';
import { dayPhase, dayIndex, moonOf, nightMods, isNight } from '../shared/data/world.js';
import { rollGearDrop } from '../shared/data/gear.js';
import { rollAffixes, affixId } from '../shared/data/affixes.js';
import { rollCard, CARD_BY_ID } from '../shared/data/cards.js';
import { grantKill, grant, refillFlasks } from '../shared/economy.js';
import { CRYPT, cryptId, isCrypt, checkpoints, isBossFloor, isChestFloor, chestLoot, zoneOf } from '../shared/data/crypt.js';
import { FLASK_SLOTS } from '../shared/data/slots.js';
import { ITEMS } from '../shared/data/items.js';
import { NPC_BY_ID } from '../shared/data/npcs.js';
import { TILE, T, OX } from '../shared/td/ayutthaya.js';
import { TD_MAPS, TD_MAP_IDS, EVENT_MAPS, DEFAULT_MAP, getMap, validMap, arrivalPoint, RESPAWN_WAIT_MS } from '../shared/td/maps.js';
import { MAX_LEVEL, mobExp, mobAtkMul, attackInterval, buffAspd } from '../shared/stats.js';
import { PARTY } from '../shared/constants.js';

export const TD_SPAWN = { ...TD_MAPS.ayutthaya.spawn };
const SPEED = 92;                   // ความเร็วเดินผู้เล่น (ตรงกับ client)
const AGGRO = 110, LEASH = 260, RESPAWN_MS = 7000, STRIKE_MS = 260;
const PARTY_LV_GAP = PARTY.lvGap;                                 // ปาร์ตี้หาร EXP ได้เมื่อเลเวลห่างกันไม่เกินนี้ (ใช้ค่าเดียวกับ client)
const BOSS_AGGRO = 150, BOSS_LEASH = 340, AOE_WARN_MS = 1000, BOSS_SHARE = 0.05;
export const TD_MAP_V = 2;           // เวอร์ชันผังแผนที่ (2 = ขยายโซนรอบเมือง · เมืองเดิมเลื่อนไป OX ไทล์)
const NPC_R = 56;                   // ระยะคุยกับ NPC
const PORTAL_R = 64, WARP_CD = 2500;  // ระยะยืนหน้าประตูมิติ · กันวาร์ปรัว
export const tdRoom = (id) => `td:${id}`;
const rand = (a, b) => a + Math.random() * (b - a);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const ANIMS = ['idle', 'walk', 'attack', 'cast', 'hit', 'die'];
const DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];

export function setupTD(io, players, opts = {}) {
  const { pkColor = () => null, dayMs = 20 * 60 * 1000, queueSync = () => {}, refresh = () => {}, hurtPlayer = () => {}, shareExp = () => {}, partyOf = () => null, partyBonus = () => 1 } = opts;
  const worlds = Object.fromEntries(TD_MAP_IDS.map((id) => [id, makeWorld(id)]));   // + ห้องสุสานใต้ดิน (crypt:…) สร้าง/ลบตามการใช้งาน
  const mapOf = (p) => (Object.hasOwn(worlds, p.tmap || '') ? p.tmap : DEFAULT_MAP);
  const W = (p) => worlds[mapOf(p)];
  let wb = null;                       // ตัวควบคุมบอสโลก (server/worldboss.js) · setWb()
  const nightNow = () => isNight(dayPhase(Date.now(), dayMs));
  function timeMods(d) {
    const now = Date.now(), phase = dayPhase(now, dayMs), moon = moonOf(dayIndex(now + dayMs * 0.25, dayMs));
    const m = nightMods(phase, moon);
    return d.nightBoost && isNight(phase) ? { ...m, atk: m.atk * 1.15, exp: m.exp * 1.2, gold: m.gold * 1.2 } : m;
  }
  const mobAtk = (d) => { const a = Math.round(d.atk * mobAtkMul(d.level) * timeMods(d).atk); return { patk: a, matk: a, accuracy: d.acc, critRate: 0.05, critDmg: 1.5, mob: true }; };   // ผี Lv21+ แรงขึ้นแบบ RO (stats.js)
  const tdPlayers = (id) => [...players.values()].filter((p) => p.world === 'td' && (!id || mapOf(p) === id));

  // ================= โลก 1 แมพ (ผี/ชน/รางวัล ของแมพนั้น) =================
  function makeWorld(mapId) {
  const M = getMap(mapId), L = M.layout(), room = tdRoom(mapId), MW = M.W, MH = M.H;
  const CR = M.crypt ? { ...M.crypt, open: false, seen: Date.now(), key: null } : null;   // ห้องสุสานใต้ดิน: ผีไม่เกิดใหม่ · ฆ่าครบ = บันไดลงเปิด
  const solidAt = (x, y) => {
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    return tx < 0 || ty < 0 || tx >= MW || ty >= MH || L.solid[ty][tx];
  };
  const inTown = (x, y) => M.inSafe(x, y);
  const sameMap = (p) => p && p.world === 'td' && mapOf(p) === mapId;

  // ---------------- ผี ----------------
  const mobs = L.spawns.map((s, i) => spawn({ mid: i, id: s.id, d: MONSTERS[s.id], s, boss: !!(s.boss || MONSTERS[s.id]?.boss) }, true));
  for (const m of mobs) if (m.s.wb) { m.hp = 0; m.st = 'dead'; m.respawnAt = Infinity; m.wb = m.s.wb; }   // บอสโลก/ผลึก/บริวาร: หลับไว้ ตัวควบคุมอีเวนต์ปลุก
  // ผีส่วนเพิ่ม (MOB_DENSITY) เกิดตามจำนวนคนในแมพ: 1 คน = 30% · 5 คนขึ้นไป = ครบ → เซิร์ฟคนน้อยไม่แน่นจนโดนรุม
  const extras = mobs.filter((m) => m.s.extra && !m.s.wb);
  extras.forEach((m, i) => { m.extraIdx = i; });
  const extraCap = (n) => Math.ceil(extras.length * Math.max(0.3, Math.min(1, n / 5)));
  for (const m of extras) if (m.extraIdx >= extraCap(0)) { m.hp = 0; m.st = 'dead'; m.respawnAt = 0; }   // เริ่มต้น: เปิดแค่ 30%
  function spawn(m, quiet = false) {
    let x, y, n = 0;
    do { x = m.s.x + rand(-m.s.r, m.s.r); y = m.s.y + rand(-m.s.r, m.s.r); } while (solidAt(x, y) && ++n < 20);
    Object.assign(m, { x, y, hp: m.d.hp, st: 'wander', target: null, nextThink: 0, wx: null, wy: null, nextAtk: 0, pending: [], dmgBy: new Map(), respawnAt: 0, dir: 0, nextAoe: Date.now() + 4000, aoe: null, stunUntil: 0, dots: null, slowUntil: 0, slowPct: 0, defDownUntil: 0, defDownPct: 0, weakUntil: 0, weakPct: 0 });
    if (m.boss && !quiet && !m.s.wb) io.emit('chat', { id: null, name: '👑 บอส', text: `${m.d.nameTh} Lv.${m.d.level} ปรากฏตัวที่${M.ZONES[M.zoneAt(m.x, m.y)]?.nameTh || M.nameTh}${M.realm ? ` (${M.nameTh})` : ''}!` });
    return m;
  }

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
      if (m.st === 'dead') { if (now >= m.respawnAt && (!d.nightOnly || nightNow()) && (m.extraIdx == null || m.extraIdx < extraCap(here.length))) spawn(m); continue; }   // ผีส่วนเพิ่มรอจนคนในแมพพอ
      // ดาเมจต่อเนื่อง (พิษ/เลือดไหล/ไฟลุก): ทุก every ms · คิดจากดาเมจครั้งที่โดน × ratio · คนละชนิดซ้อนกันได้
      if (m.dots) {
        for (const k of Object.keys(m.dots)) {
          const P = m.dots[k];
          if (now < P.next) continue;
          const by = players.get(P.by);
          m.hp -= P.dmg; P.left--; P.next = now + P.every;
          if (by) m.dmgBy.set(by.id, (m.dmgBy.get(by.id) || 0) + P.dmg);
          if (by && m.wb) wb?.onDmg(m, by, P.dmg);
          io.to(room).emit('td:dmg', { mid: m.mid, by: P.by, hit: true, dot: k, dmg: P.dmg, hp: Math.max(0, Math.round(m.hp)) });
          if (P.left <= 0) delete m.dots[k];
          if (m.hp <= 0) { if (by && sameMap(by)) kill(m, by); else m.hp = 1; break; }
        }
        if (!Object.keys(m.dots || {}).length) m.dots = null;
        if (m.st === 'dead') continue;
      }
      // ติดมึน (สกิล): ไม่เดิน ไม่ตี · ท่าตีที่ค้างถูกยกเลิก
      if (now < m.stunUntil) { m.pending = []; continue; }
      if (m.wb === 'boss' || m.d.passive) continue;                                  // บอสโลก/ผลึก: ตัวควบคุมอีเวนต์เป็นคนสั่ง
      if (d.nightOnly && m.st !== 'chase' && !nightNow()) { m.st = 'dead'; m.hp = 0; m.respawnAt = now + 30000; m.pending = []; m.dmgBy.clear(); continue; }   // ผีกลางคืน: สว่างแล้วหายไป
      // บอส: ท่าวงกว้าง (เตือนวงแดงก่อน AOE_WARN_MS แล้วลงดาเมจทุกคนในวง)
      if (m.boss && m.aoe && now >= m.aoe.at) {
        const a = m.aoe; m.aoe = null;
        for (const p of here) {
          if (p.dead || Math.hypot(p.tx - a.x, p.ty - a.y) > a.r) continue;
          const pd = combatDerived(p.char, p.buffs, now);
          const r = rollDamage({ ...mobAtk(d), accuracy: 999 }, { def: pd.def, eva: 0 }, 'physical', d.aoe.mult || 1.3);
          if (now < m.weakUntil) r.dmg = Math.max(1, Math.round(r.dmg * (1 - (m.weakPct || 0))));   // อ่อนแรง (สกิล)
          hurtPlayer(p, r.dmg, { hit: true, crit: r.crit, x: Math.round(m.x), force: true, td: true, mid: m.mid });
        }
      }
      // ท่าตีที่ค้าง → ถึงเวลาลงดาเมจ
      if (m.pending.length && now >= m.pending[0].at) {
        const a = m.pending.shift(), p = players.get(a.pid);
        if (sameMap(p) && !p.dead && dist(m, { x: p.tx, y: p.ty }) <= (d.attackRange || 16) + 20) {
          const pd = combatDerived(p.char, p.buffs, now);
          const r = rollDamage(mobAtk(d), { def: pd.def, eva: pd.eva }, d.projectile ? 'magic' : 'physical', 1);
          if (d.pctDmg && r.hit) r.dmg = Math.max(1, Math.round(p.maxHp * d.pctDmg));   // บริวารราหู: ดูด % HP
          if (r.hit && now < m.weakUntil) r.dmg = Math.max(1, Math.round(r.dmg * (1 - (m.weakPct || 0))));   // อ่อนแรง (สกิล)
          hurtPlayer(p, r.dmg, { hit: r.hit, crit: r.crit, x: Math.round(m.x), force: true, td: true, mid: m.mid });
        }
      }
      // หาเป้า: ผู้เล่นที่ใกล้สุด (ไม่ไล่เข้าเขตเมือง)
      let best = null, bd = m.wb ? 9999 : m.boss ? BOSS_AGGRO : AGGRO;
      for (const p of here) { if (p.dead || inTown(p.tx, p.ty) || now < (p.spawnGuardUntil || 0)) continue; const dd = dist(m, { x: p.tx, y: p.ty }); if (dd < bd) { bd = dd; best = p; } }   // เพิ่งวาร์ป/ฟื้น: ผียังไม่เห็น 3 วิ
      // บอสไล่ต่อคนเดิมที่กำลังตีอยู่ (ไม่สลับเป้าไปมา) ถ้ายังอยู่ในระยะ
      if (m.boss && m.st === 'chase') { const cur = players.get(m.target); if (cur && !cur.dead && sameMap(cur) && now >= (cur.spawnGuardUntil || 0) && dist(m, { x: cur.tx, y: cur.ty }) < BOSS_LEASH) best = cur; }
      const home = Math.hypot(m.x - m.s.x, m.y - m.s.y);
      if (best && (m.wb || home < (m.boss ? BOSS_LEASH : LEASH))) { m.st = 'chase'; m.target = best.id; }
      else if (m.st === 'chase') { m.st = 'wander'; m.target = null; m.wx = m.s.x; m.wy = m.s.y; }
      if (m.boss && m.st !== 'chase' && m.hp < d.hp) { m.hp = Math.min(d.hp, m.hp + d.hp * 0.03 * dt); if (m.hp >= d.hp) m.dmgBy.clear(); }   // ไม่มีใครสู้ → ฟื้นเลือด
      const spd = (d.speed || 40) * 0.9 * (now < m.slowUntil ? 1 - (m.slowPct || 0) : 1);   // เชื่องช้า (สกิล)
      if (m.st === 'chase') {
        const p = players.get(m.target), pos = { x: p.tx, y: p.ty }, dd = dist(m, pos);
        if (dd <= (d.attackRange || 16) + 8) {
          m.dir = Math.round(Math.atan2(pos.y - m.y, pos.x - m.x) / (Math.PI / 4));
          if (m.boss && d.aoe && !m.aoe && now >= m.nextAoe) {
            m.nextAoe = now + d.aoe.cd; m.nextAtk = now + AOE_WARN_MS + 400;
            m.aoe = { at: now + AOE_WARN_MS, x: m.x, y: m.y, r: d.aoe.r };
            io.to(room).emit('td:aoe', { mid: m.mid, x: Math.round(m.x), y: Math.round(m.y), r: d.aoe.r, ms: AOE_WARN_MS, name: d.aoe.nameTh });
          } else if (now >= m.nextAtk && !m.aoe) {
            m.nextAtk = now + (d.attackCooldown || 1200);
            m.pending.push({ at: now + STRIKE_MS, pid: p.id });
            io.to(room).emit('td:matk', { mid: m.mid });
          }
        } else if (!m.aoe) moveMob(m, pos.x, pos.y, spd, dt);
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
  function onHit(p, d = {}) {
    const m = mobs[d.mid | 0];
    if (!sameMap(p) || p.dead || !m || m.st === 'dead' || !p.char) return;
    const now = Date.now();
    p.spawnGuardUntil = 0;                                   // ตีผีเอง = หมดช่วงคุ้มกันหลังวาร์ป
    const job = p.appearance?.job, atk = JOBS[job]?.attack;
    const sk = typeof d.sk === 'string' ? d.sk : null;
    const skb = sk ? SKILL_BY_ID[sk] : null;            // สกิลระยะไกล/วงกว้าง/พุ่ง → เอื้อมได้ไกลกว่าตีปกติ
    const range = Math.max(atk?.range || 30, skb ? (skb.range || 0) + (skb.distance || 0) + (skb.offset ? 240 : 0) + (skb.radius || 0) + (skb.hop || 0) * (skb.bounces || 0) : 0) + 30;
    if (dist(m, { x: p.tx, y: p.ty }) > range) return;
    const gate = attackGate(p, sk, !!d.combo, now);
    if (!gate) return;
    if (sk) {                                                                 // ต้องมีการร่ายจริง (skill:cast) · ตีเป้าเดิมได้ไม่เกินจำนวนจังหวะของท่า
      const t = p.castTok?.[sk];
      if (!t || now - t.at > 1800 + (skb.hits || 1) * (skb.interval || 0) + (skb.delay || 0) + (skb.duration && skb.type === 'aoe' ? skb.duration : 0)) return;
      const per = Math.max((skb.hits || 1) * (skb.count || 1), skb.bounces || 1), n = (t.mobs.get(m.mid) || 0) + 1;
      if (n > per) return;
      t.mobs.set(m.mid, n);
      if (sk === 'heal_mortar') p.mortarHits = { at: t.at, n: t.mobs.size };
    }
    // คูลดาวน์ตีปกติ (server): เร็วกว่าที่ client ตั้งไว้เล็กน้อยเผื่อ lag
    if (!sk) { if (now - (p.tdAtk || 0) < attackInterval(atk?.cooldown || 500, getDerived(p.char).aspd + buffAspd(p.buffs, now)) * 0.7) return; p.tdAtk = now; }   // AGI เร่งความเร็วตี
    const spec = attackSpec(p.char, job, sk, gate === 'combo');
    if (!spec) return;
    const r = rollDamage(combatDerived(p.char, p.buffs, now), { def: (m.wbDef ?? m.d.def) * (now < m.defDownUntil ? 1 - (m.defDownPct || 0) : 1), eva: m.d.eva }, spec.kind, spec.mult);   // เกราะแตก: DEF ผีลด
    if (!r.hit) return io.to(room).emit('td:dmg', { mid: m.mid, by: p.id, hit: false, dmg: 0 });
    m.hp -= r.dmg;
    m.dmgBy.set(p.id, (m.dmgBy.get(p.id) || 0) + r.dmg);
    if (m.wb) wb?.onDmg(m, p, r.dmg);
    // ผลพิเศษของสกิล: มึน (บอสติดครึ่งเวลา) · พิษ (ต่อเนื่อง ticks ครั้ง ครั้งละ ratio × ดาเมจที่โดน)
    const eff = spec.effect || {}, effMul = m.boss ? 0.5 : 1;                                            // บอสติดสถานะครึ่งเวลา
    m.slowActive = now < (m.slowUntil || 0); m.defActive = now < (m.defDownUntil || 0); m.weakActive = now < (m.weakUntil || 0);   // ดีบัฟเดิมหมดแล้ว = ใช้ความแรงใหม่ (ไม่ค้างค่าแรงสุด)
    if (eff.stun && m.hp > 0) m.stunUntil = Math.max(m.stunUntil || 0, now + eff.stun.ms * effMul);
    for (const k of ['poison', 'bleed', 'burn']) if (eff[k] && m.hp > 0) { const P = eff[k]; (m.dots ||= {})[k] = { by: p.id, dmg: Math.max(1, Math.round(r.dmg * P.ratio)), left: P.ticks, every: P.every, next: now + P.every }; }
    if (eff.slow && m.hp > 0) { m.slowUntil = Math.max(m.slowUntil || 0, now + eff.slow.ms * effMul); m.slowPct = m.slowActive ? Math.max(m.slowPct, eff.slow.pct) : eff.slow.pct; }
    if (eff.armorBreak && m.hp > 0) { m.defDownUntil = Math.max(m.defDownUntil || 0, now + eff.armorBreak.ms * effMul); m.defDownPct = m.defActive ? Math.max(m.defDownPct, eff.armorBreak.pct) : eff.armorBreak.pct; }
    if (eff.weak && m.hp > 0) { m.weakUntil = Math.max(m.weakUntil || 0, now + eff.weak.ms * effMul); m.weakPct = m.weakActive ? Math.max(m.weakPct, eff.weak.pct) : eff.weak.pct; }
    if (m.st !== 'chase') { m.st = 'chase'; m.target = p.id; }
    io.to(room).emit('td:dmg', { mid: m.mid, by: p.id, hit: true, crit: r.crit, dmg: r.dmg, hp: Math.max(0, Math.round(m.hp)) });
    if (m.hp <= 0) kill(m, p);
  }

  /** แบ่ง EXP ผี 1 ตัวแบบ RO → Map(id → { exp, bonus% })
   *  ▸ แต่ละคนได้ส่วนตามดาเมจที่ทำ · สมาชิกปาร์ตี้รวมส่วนเข้ากองกลาง แล้วหารเท่ากันให้เพื่อนที่อยู่แมพเดียวกัน (ยังไม่ตาย)
   *  ▸ กองกลางได้โบนัส +10%/เพื่อนเพิ่ม 1 คน · เลเวลในกลุ่มห่างเกิน 15 = ไม่หาร (ต่างคนต่างได้ส่วนตัวเอง)
   *  ▸ แต่ละคนคิดแคปตามช่วงเลเวล/เพดาน 20% ของหลอดของตัวเอง + พร EXP ของตัวเอง */
  function splitExp(m, killer, baseExp) {
    const contrib = new Map([...m.dmgBy].filter(([id, v]) => v > 0 && sameMap(players.get(id))));
    if (!contrib.has(killer.id)) contrib.set(killer.id, 1);
    const total = [...contrib.values()].reduce((a, b) => a + b, 0) || 1;
    const out = new Map(), pools = new Map();
    const give = (q, raw, bonus = 0) => {
      if (!q?.save) return;
      const e = Math.round(mobExp(raw * blessingsOf(q.save).expMul, q.save.level, m.d.level, !!m.boss));
      const cur = out.get(q.id); out.set(q.id, { exp: (cur?.exp || 0) + e, bonus: Math.max(cur?.bonus || 0, bonus) });
    };
    for (const [id, dmg] of contrib) {
      const q = players.get(id), party = partyOf(q), raw = baseExp * dmg / total;
      if (!party) { give(q, raw); continue; }
      const pool = pools.get(party) || { raw: 0, own: [] }; pool.raw += raw; pool.own.push([q, raw]); pools.set(party, pool);
    }
    for (const [party, pool] of pools) {
      const mates = [...party.members].map((id) => players.get(id)).filter((q) => q?.save && !q.dead && sameMap(q));
      const lv = mates.map((q) => q.save.level);
      if (mates.length < 2 || Math.max(...lv) - Math.min(...lv) > PARTY_LV_GAP) { for (const [q, raw] of pool.own) give(q, raw); continue; }
      const bonus = PARTY.mapBonus * (mates.length - 1);
      for (const q of mates) give(q, pool.raw * (1 + bonus) / mates.length, Math.round(bonus * 100));
    }
    return out;
  }

  function kill(m, killer) {
    const d = m.d, tm = timeMods(d);
    m.hp = 0; m.st = 'dead'; m.pending = []; m.dots = null;
    // คนเยอะในแมพ → ผีเกิดเร็วขึ้น (สูงสุด ×2 เมื่อ 8 คนขึ้นไป · บอสไม่เร่ง)
    const crowd = m.boss ? 1 : Math.min(2, 1 + 0.15 * Math.max(0, tdPlayers(mapId).length - 1));
    m.respawnAt = CR ? Infinity : Date.now() + Math.round((d.respawnMs || RESPAWN_MS) / crowd);
    const assist = [...m.dmgBy.entries()].filter(([id, v]) => id !== killer.id && v >= d.hp * (m.boss ? BOSS_SHARE : 0.15)).map(([id]) => id);
    io.to(room).emit('td:die', { mid: m.mid, killer: killer.id });
    m.aoe = null;
    if (m.wb) { m.respawnAt = Infinity; wb?.onKill(m, killer); return; }       // บอสโลก: รางวัล/MVP ที่ตัวควบคุมอีเวนต์
    if (m.boss && !CR) io.emit('chat', { id: null, name: '👑 บอส', text: `${d.nameTh} ถูกปราบแล้ว! ผู้ปิดฉาก ${killer.name}${assist.length ? ` · ร่วมปราบอีก ${assist.length} คน` : ''} (เกิดใหม่ใน ${Math.round((d.respawnMs || RESPAWN_MS) / 60000)} นาที)` });
    const split = splitExp(m, killer, d.exp * tm.exp);                           // EXP แบบ RO: ตามดาเมจ · ปาร์ตี้หารเท่ากัน
    const reward = (p, isKiller) => {
      if (!p?.save) return;
      const bl = blessingsOf(p.save);
      const exp = split.get(p.id)?.exp || 0, pb = split.get(p.id)?.bonus || 0;
      split.delete(p.id);
      const out = { mid: m.mid, mon: d.base || m.id, kind: isKiller ? 'kill' : 'assist', exp, pbonus: pb, gold: 0, items: [], x: Math.round(m.x), y: Math.round(m.y), night: tm.exp > 1 };
      if (isKiller || m.boss) {                                                   // บอส: ทุกคนที่ช่วยตีได้ของ/การ์ดของตัวเอง
        out.gold = Math.round(rand(d.gold[0], d.gold[1]) * tm.gold * bl.goldMul);
        out.items = (d.drops || []).filter((dr) => Math.random() < dr.chance * bl.dropMul).map((dr) => ({ id: dr.item, qty: 1 }));
        if (m.boss) out.boss = true;
        const grade = m.boss ? 'boss' : d.elite ? 'elite' : 'normal';
        const job = p.save.path || p.appearance?.job;
        let gear = m.boss ? rollGearDrop(d.level + 6, bl.dropMul * 25, Math.random, job) : rollGearDrop(d.level, bl.dropMul * (d.elite ? 3 : 1), Math.random, job);   // ครึ่งหนึ่งเป็นของสายตัวเอง
        if (gear) {
          gear = affixId(gear, rollAffixes(ITEMS[gear], d.level, grade));               // ค่าสุ่มแบบ PoE (0–3 บรรทัด)
          const n = ITEMS[gear]?.affixN || 0;
          out.items.push({ id: gear, qty: 1, rare: true, affixN: n });
          if (n >= 3) io.emit('chat', { id: null, name: '✨ ของหายาก', text: `${p.name} ได้รับ ${ITEMS[gear].nameTh} (ค่าสุ่ม 3 บรรทัด)!` });
        }
        const card = rollCard(d.cardOf || m.id, bl.dropMul * (CR && !m.boss ? 2 : 1));   // สุสาน: การ์ดผีธรรมดา ×2                                   // การ์ดผี (0.5% · หัวหน้า 1.2% · บอส 20% · บัฟดรอปช่วยได้สูงสุด ×1.5)
        if (card) {
          out.items.push({ id: card, qty: 1, rare: true, card: true });
          out.cardNew = !p.save.cardBook?.[card];
          io.emit('chat', { id: null, name: '🃏 การ์ด', text: `${p.name} ได้รับ ${CARD_BY_ID[card].nameTh}!` });
        }
      }
      Object.assign(out, grantKill(p.save, out));
      refresh(p); queueSync(p);
      io.to(p.id).emit('td:reward', out);
    };
    reward(killer, true);
    for (const id of assist) reward(players.get(id), false);
    for (const [id, r] of split) {                                                  // เพื่อนร่วมปาร์ตี้ที่ไม่ได้ตีตัวนี้ → ได้ส่วนแบ่ง EXP
      const q = players.get(id); if (!q?.save || !r.exp) continue;
      const g = grant(q.save, { exp: r.exp });
      refresh(q); queueSync(q);
      io.to(id).emit('party:exp', { amount: r.exp, from: killer.name, ups: g.ups, bonus: r.bonus });
    }
    m.dmgBy.clear();
    if (CR) cryptKilled(self);
  }

  /** NPC บริการที่ผู้เล่นยืนใกล้ → คืนพิกัด x ของ NPC เดียวกันในหมู่บ้านโลกเดิม (ให้ runAction/nearNpc ตรวจผ่าน) */
  function econX(p) {
    for (const n of L.npcs) if (n.id && Math.hypot(n.x - p.tx, n.y - p.ty) <= NPC_R) { const v = NPC_BY_ID[n.id]; if (v) return v.x; }
    return null;
  }
  /** id ของ NPC บริการที่ยืนใกล้ที่สุด (ในระยะคุย) · ไม่มี = null */
  function npcNear(p) {
    let best = null, bd = NPC_R;
    for (const n of L.npcs) { const d = Math.hypot(n.x - p.tx, n.y - p.ty); if (n.id && d <= bd) { bd = d; best = n.id; } }
    return best;
  }
  const nearNpc = (p, id, r = NPC_R + 20) => L.npcs.some((n) => n.id === id && Math.hypot(n.x - p.tx, n.y - p.ty) <= r);
  const portalNear = (p, to) => L.portals.find((q) => q.to === to && Math.hypot(q.x - p.tx, q.y - p.ty) <= PORTAL_R);
  const okPos = (pos) => pos && Number.isFinite(pos.x) && Number.isFinite(pos.y) && !solidAt(pos.x, pos.y - 2);

  function tick(dt, now) {
    const here = tdPlayers(mapId);
    if (!here.length) return;
    tickMobs(dt, now, here);
    io.to(room).volatile.emit('td:state', {
      t: now, map: mapId,
      p: here.map((p) => [p.id, Math.round(p.tx), Math.round(p.ty), p.tdir, p.tanim, Math.round(p.hp), p.maxHp, p.level]),
      m: mobs.map((m) => [m.mid, Math.round(m.x), Math.round(m.y), m.dir, m.st === 'dead' ? 0 : Math.max(1, Math.round(m.hp)), m.st === 'chase' ? 1 : 0]),
    });
  }
  /** ผู้เล่นออกจากแมพนี้ → ผีที่ไล่อยู่เลิกไล่/ท่าที่ค้างยกเลิก */
  function forget(p) {
    for (const m of mobs) { if (m.target === p.id) { m.target = null; if (m.st === 'chase') { m.st = 'wander'; m.wx = m.s.x; m.wy = m.s.y; } } m.pending = m.pending.filter((a) => a.pid !== p.id); m.dmgBy.delete(p.id); }
  }
  /** GM: ฆ่าผีที่ยังมีชีวิตทั้งแมพ (ได้รางวัลเหมือนตีเอง · ไม่แตะบอสโลก) → จำนวนที่ฆ่า */
  function killAll(p) {
    let n = 0;
    for (const m of mobs) if (m.st !== 'dead' && !m.wb) { io.to(room).emit('td:dmg', { mid: m.mid, by: p.id, hit: true, crit: false, dmg: Math.round(m.hp), hp: 0 }); kill(m, p); n++; }
    return n;
  }
  const self = { id: mapId, M, L, room, mobs, crypt: CR, solidAt, inTown, okPos, econX, npcNear, nearNpc, portalNear, onHit, tick, forget, killAll };
  return self;
  }

  // ---------------- เข้า/ออก/เดิน/วาร์ป ----------------
  const SPAWN_GUARD_MS = 3000;                               // หลังเข้าเกม/วาร์ป/ฟื้น: ผีไม่เล็ง 3 วิ (ถ้าเราตีก่อนก็หมดทันที)
  function publicTd(p) { return { id: p.id, name: p.name, gm: !!p.admin, appearance: p.appearance, x: Math.round(p.tx), y: Math.round(p.ty), level: p.level, hp: Math.round(p.hp), maxHp: p.maxHp, title: p.save?.title || null, pk: pkColor(p) }; }
  const visited = (p) => (p.save.tdMaps ||= ['ayutthaya']);

  function place(socket, p, mapId, pos) {
    const w = worlds[mapId];
    p.tmap = mapId; p.save.tdMap = mapId;
    const ok = w.okPos(pos);
    p.tx = ok ? pos.x : w.M.spawn.x; p.ty = ok ? pos.y : w.M.spawn.y; p.tdLast = Date.now();
    p.save.tdPos = { x: Math.round(p.tx), y: Math.round(p.ty) }; p.dirty = true;
    if (!EVENT_MAPS.has(mapId) && !w.crypt && !visited(p).includes(mapId)) visited(p).push(mapId);
    socket.join(w.room);
    socket.to(w.room).emit('td:joined', publicTd(p));
    return w;
  }

  function enter(socket, p) {
    if (p.save.tdPos && (p.save.tdMapV || 1) < TD_MAP_V) p.save.tdPos = { x: p.save.tdPos.x + OX * TILE, y: p.save.tdPos.y };   // เซฟก่อนขยายแผนที่
    p.save.tdMapV = TD_MAP_V;
    for (const id of Object.keys(worlds)) socket.leave(tdRoom(id));
    p.world = 'td'; p.tdir = 'south'; p.tanim = 'idle';
    if (p.save.deadAt) { const M0 = worlds[validMap(p.save.tdMap)]?.M; if (M0) p.save.tdPos = { ...M0.spawn }; p.save.deadAt = 0; }   // ตายค้างแล้วออกเกม → เกิดที่จุดฟื้น
    if (EVENT_MAPS.has(validMap(p.save.tdMap)) && !wb?.isOpen()) { p.save.tdMap = p.save.wbFrom?.map || 'ayutthaya'; p.save.tdPos = p.save.wbFrom?.pos || null; }   // ลานอีเวนต์ปิดแล้ว → กลับที่เดิม
    if (isCrypt(p.save.tdMap) && !worlds[p.save.tdMap]) { p.save.tdMap = 'ayutthaya'; p.save.tdPos = { ...GATE }; }   // ห้องสุสานถูกปิดไปแล้ว → หน้าประตูสุสาน
    const w = place(socket, p, mapOf({ tmap: p.save.tdMap }), p.save.tdPos);
    p.spawnGuardUntil = Date.now() + SPAWN_GUARD_MS; p.invulnUntil = Date.now() + 2500;   // เข้าเกม: กันผีรุมก่อนโหลดเสร็จ
    socket.join('td');
    socket.emit('td:init', { map: w.id, maps: visited(p), cryptOpen: !!w.crypt?.open, x: p.tx, y: p.ty, players: tdPlayers(w.id).filter((q) => q.id !== p.id).map(publicTd) });
  }

  /** ย้ายแมพ (ประตูมิติ / NPC วาร์ป / ยันต์คืนถิ่น) */
  function moveMap(socket, p, to, pos, how) {
    const from = mapOf(p), wf = worlds[from];
    if (from !== to) {
      wf.forget(p);
      socket.leave(wf.room);
      io.to(wf.room).emit('td:left', p.id);
    }
    const w = place(socket, p, to, pos);
    p.tdWarpAt = Date.now(); p.invulnUntil = Date.now() + 2500; p.spawnGuardUntil = Date.now() + SPAWN_GUARD_MS;   // วาร์ป/ฟื้น: อมตะสั้น ๆ + ผียังไม่เล็ง
    socket.emit('td:warp', { map: to, maps: visited(p), cryptOpen: !!worlds[to]?.crypt?.open, x: Math.round(p.tx), y: Math.round(p.ty), how, players: tdPlayers(to).filter((q) => q.id !== p.id).map(publicTd) });
    queueSync(p);
    return w;
  }

  function onWarp(socket, d = {}) {
    const p = players.get(socket.id);
    if (!p || p.world !== 'td' || p.dead) return;
    const to = String(d.to || ''), M = TD_MAPS[to];
    const no = (msg) => socket.emit('td:warpFail', { msg });
    if (!M || to === mapOf(p)) return no('ไม่พบปลายทาง');
    if (Date.now() - (p.tdWarpAt || 0) < WARP_CD) return no('ประตูมิติยังไม่สงบ รอสักครู่');
    if ((p.level || p.save.level || 1) < M.reqLv) return no(`${M.nameTh} ต้อง Lv.${M.reqLv} ขึ้นไป`);
    const w = W(p);
    if (d.via === 'portal') {
      if (!w.portalNear(p, to)) return no('อยู่ไกลประตูมิติเกินไป');
      return moveMap(socket, p, to, arrivalPoint(mapOf(p), to), 'portal');
    }
    if (!w.nearNpc(p, 'warp')) return no('ต้องคุยกับฤๅษีเฝ้าประตูมิติ');
    if ((p.save.karma || 0) > 0 && to === 'ayutthaya') return no('☠️ หัวแดง: ฤๅษีไม่ส่งกลับกรุงศรีฯ จนกว่าบาปจะหมด');
    if (!visited(p).includes(to)) return no(`ยังไม่เคยไป${M.nameTh} · ต้องเดินผ่านประตูมิติก่อน 1 ครั้ง`);
    moveMap(socket, p, to, { ...M.spawn }, 'npc');
  }

  function onMove(socket, s = {}) {
    const p = players.get(socket.id);
    if (!p || p.world !== 'td') return;
    const w = W(p), now = Date.now(), dt = Math.max(16, now - p.tdLast) / 1000;
    p.tdLast = now;
    if (p.dead) { p.tanim = 'die'; return; }
    if (s.map && s.map !== w.id) return;                                       // แพ็กเก็ตค้างจากแมพเก่า (ระหว่างวาร์ป)
    const nx = Number(s.x), ny = Number(s.y);
    if (!Number.isFinite(nx) || !Number.isFinite(ny)) return;
    // งบระยะเดิน: สะสมตามเวลาจริง (เพดาน ~0.6 วิ) · สกิลพุ่ง/กระโดดได้งบพิเศษ → ส่งแพ็กเก็ตถี่/หายไปนานแล้ววาร์ปไม่ได้
    const el = Math.min(0.6, dt), cap = SPEED * 1.6 * 0.6 + 40 + (now < (p.dashUntil || 0) ? p.dashExtra || 0 : 0);
    p.mvBudget = Math.min(cap, (p.mvBudget ?? cap) + SPEED * 1.6 * el);
    const dx = nx - p.tx, dy = ny - p.ty, d = Math.hypot(dx, dy), max = p.mvBudget;
    const k = d > max ? max / d : 1;
    // เดินทีละ ~6px ตรวจกำแพงตลอดทาง (กันทะลุกำแพง)
    let cx = p.tx, cy = p.ty, blocked = false;
    const steps = Math.max(1, Math.ceil(d * k / 6));
    for (let i = 1; i <= steps; i++) {
      const tx = p.tx + dx * k * i / steps, ty = p.ty + dy * k * i / steps;
      if (w.solidAt(tx, ty - 2)) { blocked = true; break; }
      cx = tx; cy = ty;
    }
    p.mvBudget = Math.max(0, p.mvBudget - Math.hypot(cx - p.tx, cy - p.ty));
    p.tx = cx; p.ty = cy;
    if (d > max + 2 || blocked) { if (process.env.DEBUG_MOVE) console.log('[move-correct]', p.name, blocked ? 'blocked' : 'budget', Math.round(d), Math.round(max), Math.round(el * 1000)); socket.emit('td:correct', { x: Math.round(p.tx), y: Math.round(p.ty) }); }
    p.tdir = DIRS.includes(s.dir) ? s.dir : p.tdir;
    p.tanim = ANIMS.includes(s.anim) ? s.anim : 'idle';
    if (Number.isFinite(+s.mp)) p.save.mp = Math.max(0, Math.min(+s.mp, p.save.mp ?? 0, p.maxMp || 99999));   // MP: client แจ้งได้แค่ ≤ ค่าที่ server นับ
    if (now - (p.tdSaveAt || 0) > 3000) {
      p.tdSaveAt = now; p.save.tdPos = { x: Math.round(p.tx), y: Math.round(p.ty) }; p.save.tdMap = w.id; p.dirty = true;
      // ในเมือง/ค่ายพัก: ขวดยาเติมเต็ม
      if (w.inTown(p.tx, p.ty) && FLASK_SLOTS.some((s) => { const f = ITEMS[p.save.equipment?.[s]]?.flask; return f && (p.save.flaskCh?.[s] || 0) < f.max; })) { refillFlasks(p.save); queueSync(p); }
    }
  }

  function onRespawn(socket) {
    const p = players.get(socket.id);
    if (!p || p.world !== 'td') return;
    if (!p.dead && p.hp > 0) return socket.emit('td:respawn', { x: Math.round(p.tx), y: Math.round(p.ty), hp: Math.round(p.hp), maxHp: p.maxHp });   // เน็ตหลุดตอนตาย/ต่อใหม่แล้ว server ฟื้นให้แล้ว → บอก client ให้เลิกค้างเป็นศพ
    if (p.save.deadAt && Date.now() - p.save.deadAt < RESPAWN_WAIT_MS - 500) return;   // ต้องรอครบ 10 วิ (กันกดฟื้นเร็ว · หมอยาชุบได้ระหว่างนี้)
    const w = W(p);
    p.dead = false; p.hp = p.maxHp; p.invulnUntil = Date.now() + 2500; p.spawnGuardUntil = Date.now() + SPAWN_GUARD_MS; p.save.deadAt = 0;
    p.tx = w.M.spawn.x; p.ty = w.M.spawn.y; p.save.tdPos = { ...w.M.spawn }; p.hpDirty = true;
    refillFlasks(p.save); queueSync(p);
    socket.emit('td:respawn', { x: p.tx, y: p.ty, hp: Math.round(p.hp), maxHp: p.maxHp });
  }

  // ================= สุสานใต้ดิน (ห้องแยกต่อปาร์ตี้ · ลงทีละชั้น) =================
  const GATE = { x: CRYPT.gate.x * TILE + TILE / 2, y: (CRYPT.gate.y + 3) * TILE };   // จุดโผล่หน้าประตูสุสาน (กรุงศรีฯ)
  const instances = new Map();          // key (ปาร์ตี้/คนเดียว) → รหัสห้องชั้นปัจจุบัน
  let cryptSeq = 0;
  const cryptKey = (p) => { const pt = partyOf(p); return pt ? `p${pt.id}` : `s${p.id}`; };
  const cryptSave = (p) => (p.save.crypt ||= { cp: 1, best: 0 });
  const thaiDay = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);

  function cryptInfo(socket) {
    const p = players.get(socket.id);
    if (!p?.save) return;
    const c = cryptSave(p), party = partyOf(p), cur = instances.get(cryptKey(p)), w = cur && worlds[cur];
    socket.emit('crypt:info', {
      cp: c.cp || 1, best: c.best || 0, floors: checkpoints(c.cp || 1),
      party: party ? party.members.size : 1, leader: !party || party.leader === p.id,
      running: w ? { f: w.crypt.f, n: w.crypt.n, players: tdPlayers(w.id).length } : null,
    });
  }

  function openCrypt(members, floor, key, size = members.length) {
    const n = Math.max(1, Math.min(CRYPT.maxParty, size));                     // ความยากตามขนาดปาร์ตี้ทั้งหมด (ไม่ใช่แค่คนที่ยืนหน้าประตู) → กันเปิดคนเดียวแล้วค่อยตามลงมา
    const id = cryptId(floor, n, `${key}-${++cryptSeq}`);
    const w = (worlds[id] = makeWorld(id));
    w.crypt.key = key; instances.set(key, id);
    for (const q of members) {
      const sk = io.sockets.sockets.get(q.id);
      if (!sk) continue;
      const c = cryptSave(q); c.best = Math.max(c.best || 0, floor);
      moveMap(sk, q, id, { ...w.M.spawn }, 'crypt');
    }
    return w;
  }

  function dropCrypt(w) {
    delete worlds[w.id];
    if (instances.get(w.crypt.key) === w.id) instances.delete(w.crypt.key);
  }

  function cryptEnter(socket, d = {}) {
    const p = players.get(socket.id);
    if (!p || p.world !== 'td' || p.dead) return;
    const no = (msg) => socket.emit('crypt:fail', { msg });
    const w = W(p), gate = w.L.npcs.find((n) => n.id === 'crypt');
    if (!gate || Math.hypot(gate.x - p.tx, gate.y - p.ty) > NPC_R + 60) return no('ต้องคุยกับสัปเหร่อเฒ่าหน้าประตูสุสาน');
    if (Date.now() - (p.tdWarpAt || 0) < WARP_CD) return no('ประตูสุสานยังไม่เปิด รอสักครู่');
    const party = partyOf(p), key = cryptKey(p), cur = instances.get(key);
    if (cur && worlds[cur]) {                                                                            // ปาร์ตี้ลงไปก่อนแล้ว → ตามลงไป
      if (tdPlayers(cur).length >= worlds[cur].crypt.n) return no(`ห้องนี้เปิดไว้สำหรับ ${worlds[cur].crypt.n} คน (ความยากตามจำนวนตอนเปิด) · รอรอบหน้า`);
      return moveMap(socket, p, cur, { ...worlds[cur].M.spawn }, 'crypt');
    }
    if (party && party.leader !== p.id) return no('ให้หัวหน้าปาร์ตี้เป็นคนเปิดประตูสุสาน · ลงไปแล้วสมาชิกคุยกับสัปเหร่อเพื่อตามได้');
    const floor = d.floor | 0, cp = cryptSave(p).cp || 1;
    if (!checkpoints(cp).includes(floor)) return no(`ยังไม่ปลดล็อกจุดเริ่มชั้น ${floor}`);
    const near = (q) => q && q.world === 'td' && !q.dead && mapOf(q) === w.id && Math.hypot(gate.x - q.tx, gate.y - q.ty) <= CRYPT.rally;
    const members = party ? [...party.members].map((id) => players.get(id)).filter(near) : [];
    if (!members.includes(p)) members.unshift(p);
    openCrypt(members.slice(0, CRYPT.maxParty), floor, key, party ? party.members.size : 1);
    if (party) for (const id of party.members) if (!members.includes(players.get(id))) io.to(id).emit('chat', { id: null, name: '💀 สุสานใต้ดิน', text: `${p.name} เปิดประตูสุสานชั้น ${floor} แล้ว · คุยกับสัปเหร่อเฒ่าเพื่อตามลงไป` });
  }

  function cryptGo(socket, d = {}) {
    const p = players.get(socket.id);
    if (!p || p.world !== 'td' || p.dead) return;
    const no = (msg) => socket.emit('crypt:fail', { msg });
    const w = W(p), C = w.crypt;
    if (!C) return;
    const want = d.to === 'crypt_down' ? 'crypt_down' : 'crypt_exit';
    const pt = w.L.portals.filter((q) => q.to === want).sort((a, b) => Math.hypot(a.x - p.tx, a.y - p.ty) - Math.hypot(b.x - p.tx, b.y - p.ty))[0];
    if (!pt || Math.hypot(pt.x - p.tx, pt.y - p.ty) > PORTAL_R) return no('อยู่ไกลบันไดเกินไป');
    if (Date.now() - (p.tdWarpAt || 0) < WARP_CD) return no('รอสักครู่');
    if (want === 'crypt_exit') {
      if (pt.final && !C.open) return no('ต้องปราบบอสก่อน');
      return moveMap(socket, p, 'ayutthaya', { ...GATE }, 'crypt');
    }
    if (!C.open) { const left = w.mobs.filter((m) => m.st !== 'dead').length; return no(isBossFloor(C.f) ? 'ต้องปราบบอสก่อน บันไดถึงจะเปิด' : `บันไดยังปิด · เหลือผีอีก ${left} ตัว`); }
    // ทั้งห้องลงชั้นถัดไปพร้อมกัน
    const id = cryptId(C.f + 1, C.n, C.inst), nw = (worlds[id] = makeWorld(id));
    nw.crypt.key = C.key; instances.set(C.key, id);
    for (const q of tdPlayers(w.id)) {
      const sk = io.sockets.sockets.get(q.id);
      if (!sk) continue;
      const c = cryptSave(q); c.best = Math.max(c.best || 0, C.f + 1);
      moveMap(sk, q, id, { ...nw.M.spawn }, 'crypt');
    }
    dropCrypt(w);
  }

  /** หีบต่อคน: เงิน (ชั้นลงท้าย 5) / ทอง (บอส · วันละครั้งต่อบอส ไม่งั้นได้หีบเงิน) */
  function giveChest(q, f, kind) {
    const c = cryptSave(q), day = thaiDay();
    let k = kind;
    if (k === 'gold') { c.gold ||= {}; if (c.gold[f] === day) k = 'silver'; else c.gold[f] = day; }
    const L = chestLoot(f, k), items = [...L.items, { id: CRYPT.dust, qty: L.dust }];
    grant(q.save, { gold: L.gold, items });
    refresh(q); queueSync(q);
    io.to(q.id).emit('crypt:chest', { kind: k, f, gold: L.gold, items, again: k !== kind });
  }

  /** ผีในห้องสุสานตาย → นับที่เหลือ · หมดแล้ว = บันไดเปิด + หีบ + จุดเซฟ (ชั้นบอส) */
  function cryptKilled(w) {
    const C = w.crypt;
    if (C.open) return;
    const left = w.mobs.filter((m) => m.st !== 'dead').length;
    if (left) { io.to(w.room).emit('crypt:left', { left }); return; }
    C.open = true;
    const here = tdPlayers(w.id), boss = isBossFloor(C.f);
    io.to(w.room).emit('crypt:open', { f: C.f, boss, final: C.f >= CRYPT.floors });
    if (boss || isChestFloor(C.f)) for (const q of here) giveChest(q, C.f, boss ? 'gold' : 'silver');
    if (boss) {
      for (const q of here) { const c = cryptSave(q); c.cp = Math.max(c.cp || 1, C.f + 1); q.dirty = true; }
      io.emit('chat', { id: null, name: '💀 สุสานใต้ดิน', text: `${here.map((q) => q.name).join(', ')} ปราบ${zoneOf(C.f).bossName} ชั้น ${C.f} สำเร็จ!` });
    }
  }

  // ---------------- loop ----------------
  let last = Date.now();
  function tick() {
    const now = Date.now(), dt = Math.min(0.25, (now - last) / 1000); last = now;
    for (const w of Object.values(worlds)) {
      w.tick(dt, now);
      if (!w.crypt) continue;
      if (tdPlayers(w.id).length) w.crypt.seen = now;
      else if (now - w.crypt.seen > CRYPT.idleMs) dropCrypt(w);                  // ไม่มีใครอยู่นานแล้ว → ปิดห้อง
    }
  }

  return {
    tick,
    econX: (p) => W(p).econX(p),
    npcNear: (p) => W(p).npcNear(p),
    mapOf, room: (p) => tdRoom(mapOf(p)),
    /** ยืนริมน้ำ (ตกปลาได้ · ลาวาในนรกตกไม่ได้) */
    nearWater(p) {
      const w = W(p); if (w.M.noFish) return false;
      const tx = Math.floor(p.tx / TILE), ty = Math.floor(p.ty / TILE);
      for (let y = ty - 2; y <= ty + 2; y++) for (let x = tx - 2; x <= tx + 2; x++) { const g = w.L.ground[y]?.[x]; if (g === T.WATER || g === T.WATER2) return true; }
      return false;
    },
    /** ยันต์คืนถิ่น → ลานน้ำพุกลางกรุงศรีฯ (อยู่แมพอื่น = ย้ายแมพด้วย) */
    warpHome(p, socket) {
      if (mapOf(p) !== 'ayutthaya' && socket) return moveMap(socket, p, 'ayutthaya', { ...TD_SPAWN }, 'home');
      p.tx = TD_SPAWN.x; p.ty = TD_SPAWN.y; p.tdLast = Date.now(); p.save.tdPos = { ...TD_SPAWN }; p.save.tdMap = 'ayutthaya'; p.dirty = true;
    },
    inTown: (p) => W(p).inTown(p.tx, p.ty),
    // ---- บอสโลก ----
    setWb(c) { wb = c; },
    world: (id) => worlds[id],
    playersIn: (id) => tdPlayers(id),
    socketOf: (p) => io.sockets.sockets.get(p.id),
    /** ย้ายผู้เล่นไปแมพ (ใช้โดยอีเวนต์) */
    move(p, to, pos, how = 'npc') { const sk = io.sockets.sockets.get(p.id); if (!sk || p.world !== 'td') return false; if (!worlds[to]) { pos = isCrypt(to) ? { ...GATE } : null; to = 'ayutthaya'; } moveMap(sk, p, to, pos || { ...getMap(to).spawn }, how); return true; },
    /** GM: วาร์ปไปแมพไหนก็ได้ (ทดสอบ) */
    gmWarp(p, socket, to) {
      const cf = /^crypt:?(\d+)$/.exec(to);                                     // /map crypt:15 → ห้องสุสานเดี่ยวชั้น 15 (ทดสอบ)
      if (cf && p.world === 'td') { openCrypt([p], Math.min(CRYPT.floors, Math.max(1, +cf[1])), `s${p.id}`); return true; }
      if (!TD_MAPS[to] || p.world !== 'td') return false;
      if (!visited(p).includes(to)) visited(p).push(to);
      if (to === mapOf(p)) { const sp = TD_MAPS[to].spawn; p.tx = sp.x; p.ty = sp.y; socket.emit('td:correct', { x: sp.x, y: sp.y }); return true; }
      moveMap(socket, p, to, { ...TD_MAPS[to].spawn }, 'npc'); return true;
    },
    /** GM: วาร์ปไปจุดที่ระบุ (ตามตัว/ดึงตัวผู้เล่น) · แมพเดียวกัน = แก้ตำแหน่งเฉย ๆ */
    gmTeleport(p, mapId, pos) {
      const sk = io.sockets.sockets.get(p.id);
      if (!sk || p.world !== 'td' || !worlds[mapId]) return false;
      if (mapId !== mapOf(p)) { moveMap(sk, p, mapId, pos, 'npc'); return true; }
      p.tx = pos.x; p.ty = pos.y; p.tdLast = Date.now(); p.save.tdPos = { x: Math.round(pos.x), y: Math.round(pos.y) }; p.dirty = true;
      sk.emit('td:correct', { x: Math.round(pos.x), y: Math.round(pos.y) });
      return true;
    },
    gmKillAll: (p) => (p.world === 'td' ? W(p).killAll(p) : 0),
    onConnection(socket) {
      socket.on('td:enter', () => { const p = players.get(socket.id); if (p && p.world !== 'td') enter(socket, p); });   // เข้าได้ครั้งเดียวต่อการเชื่อมต่อ (กันส่งซ้ำเพื่อต่ออมตะ/ป้องกันผีเล็ง)
      socket.on('td:move', (s) => onMove(socket, s));
      socket.on('td:hit', (d) => { const p = players.get(socket.id); if (p && p.world === 'td') W(p).onHit(p, d); });
      socket.on('td:respawn', () => onRespawn(socket));
      socket.on('td:warp', (d) => onWarp(socket, d));
      socket.on('crypt:info', () => cryptInfo(socket));
      socket.on('crypt:enter', (d) => cryptEnter(socket, d));
      socket.on('crypt:go', (d) => cryptGo(socket, d));
    },
    onLeave(p) { if (p.world === 'td') { W(p).forget(p); io.to(tdRoom(mapOf(p))).emit('td:left', p.id); } },
    _mobs: worlds.ayutthaya.mobs, _worlds: worlds,
  };
}
