// ============================================================
//  บอสโลก "พระราหู ผู้กลืนจันทร์" – ตัวควบคุมอีเวนต์ลานสุริยคราส (server)
//  ▸ idle → open (ประกาศ 10 นาที · วาร์ปเข้าค่ายได้) → fight (30 นาที) → ended (แจก MVP/รางวัล · ปิดลานใน 3 นาที)
//  ▸ ทุกท่าส่งภาพเตือน wb:tele ไปก่อน แล้วค่อยตัดสินดาเมจตามตำแหน่งผู้เล่นตอนท่าลง (server ตัดสิน)
//  ▸ ดาเมจของบอส = % HP สูงสุดของผู้เล่น
// ============================================================
import {
  WB_ID, WB_MAP, ARENA, ARENA_C, arenaPx, PHASES, phaseOf, WB_SKILLS, TRAPS, NAVA_COLORS, wbHp,
  nextSpawnAt, lastSpawnAt, WB_FIGHT_MS, WB_ANNOUNCE_MS, WB_CLOSE_MS, WB_MVP_MS, WB_STONE, wbReward, WB_MIN_SHARE, WB_BASE_EXP, WB_BASE_GOLD,
} from '../shared/data/worldboss.js';
import { TD_MAPS } from '../shared/td/maps.js';
import { TILE } from '../shared/td/ayutthaya.js';
import { addItem } from '../shared/economy.js';
import { gainExp } from '../shared/charmodel.js';
import { ITEMS } from '../shared/data/items.js';
import { RED_GEAR } from '../shared/data/gear.js';
import { checkTitles } from '../shared/data/titles.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return Math.abs(d); };

export function setupWorldBoss(io, players, { td, hurtPlayer, queueSync, social, refresh = () => {} }) {
  const W = () => td.world(WB_MAP);
  const room = `td:${WB_MAP}`;
  const say = (text, name = '👑 บอสโลก') => io.emit('chat', { id: null, name, text });
  const S = {
    state: 'idle', at: (() => { const l = lastSpawnAt(); return Date.now() < l + WB_FIGHT_MS - 5 * 60e3 ? l : nextSpawnAt(); })(),   // รีสตาร์ทกลางรอบ (เหลือ > 5 นาที) → เปิดรอบนั้นต่อ
    fightEnd: 0, closeAt: 0, pending: new Map(),
    hp: 0, maxHp: 0, phase: 0, ledger: new Map(), mvp: null, lastMvp: null,
    tele: [], traps: { yant: [], thornNext: 0, thornSet: 0, fireNext: 0, fires: [] },
    nextSkill: {}, gcd: 0, crystals: [], warned1: false, online: 0, target: null, face: Math.PI / 2,
  };
  let seq = 0;
  const boss = () => W().mobs.find((m) => m.wb === 'boss');
  const inArena = (p) => p && p.world === 'td' && p.tmap === WB_MAP && !p.dead && !W().inTown(p.tx, p.ty);
  const fighters = () => td.playersIn(WB_MAP).filter(inArena);
  const pos = (p) => ({ x: p.tx, y: p.ty });
  const pct = (p, k) => Math.max(1, Math.round(p.maxHp * k));

  function status() {
    const b = boss();
    return {
      state: S.state, at: S.at, fightEnd: S.fightEnd, closeAt: S.closeAt, phase: S.phase,
      hp: b && S.state === 'fight' ? Math.max(0, Math.round(b.hp)) : 0, maxHp: S.maxHp,
      mvp: S.mvp && S.mvp.until > Date.now() ? S.mvp : null,
      pools: TRAPS.pool.spots.map((s) => ({ x: s.x * TILE, y: s.y * TILE, r: TRAPS.pool.r * TILE })),
      thorns: TRAPS.thorn.spots.map((s) => ({ x: s.x * TILE, y: s.y * TILE, h: TRAPS.thorn.half * TILE, set: s.set })),
      fires: TRAPS.fire.spots.map((s) => ({ x: s.x * TILE, y: s.y * TILE })),
      yants: S.traps.yant.map((y) => ({ id: y.id, x: y.x, y: y.y })),
      online: S.state === 'open' ? td.playersIn(WB_MAP).length : undefined,
      crystals: W().mobs.filter((m) => m.wb === 'crystal' && m.st !== 'dead').map((m) => ({ mid: m.mid, hp: Math.round(m.hp), maxHp: m.maxHp || m.d.hp })),
      now: Date.now(),
    };
  }
  const push = () => io.emit('wb:status', status());

  // ------------------------------------------------------------
  //  เข้า/ออกลาน
  // ------------------------------------------------------------
  function go(p) {
    if (!p || p.world !== 'td') return { ok: false, msg: 'ยังไม่ได้อยู่ในโลก' };
    if (S.state !== 'open' && S.state !== 'fight') return { ok: false, msg: S.state === 'ended' ? 'การต่อสู้จบแล้ว ลานกำลังปิด' : 'ลานสุริยคราสยังไม่เปิด' };
    if (Date.now() - (p.tdWarpAt || 0) < 3000) return { ok: false, msg: 'เพิ่งวาร์ปมา รอสักครู่' };
    if (p.dead) return { ok: false, msg: 'ฟื้นก่อนแล้วค่อยไป' };
    if (p.tmap === WB_MAP) return { ok: false, msg: 'อยู่ในลานแล้ว' };
    p.save.wbFrom = { map: p.tmap, pos: { x: Math.round(p.tx), y: Math.round(p.ty) } };
    td.move(p, WB_MAP, { ...TD_MAPS[WB_MAP].spawn }, 'wb');
    io.to(p.id).emit('wb:status', status());
    return { ok: true };
  }
  function back(p) {
    if (!p || p.tmap !== WB_MAP) return false;
    if (Date.now() - (p.tdWarpAt || 0) < 3000 && S.state !== 'idle') return false;
    const f = p.save.wbFrom, to = f && TD_MAPS[f.map] && !TD_MAPS[f.map].event ? f.map : 'ayutthaya';
    p.save.wbFrom = null;
    return td.move(p, to, f?.pos || { ...TD_MAPS[to].spawn }, 'wb');
  }

  // ------------------------------------------------------------
  //  ลำดับอีเวนต์
  // ------------------------------------------------------------
  function open(at = S.at) {
    S.state = 'open'; S.at = at; S.warned1 = false;
    say(`🌑 อีก ${Math.max(1, Math.round((at - Date.now()) / 60000))} นาที พระราหูจะลงมากลืนจันทร์ที่ลานสุริยคราส! กดปุ่ม "ไปลานสุริยคราส" เพื่อวาร์ปได้ทันทีจากทุกแมพ`);
    push();
  }
  function startFight() {
    const b = boss(); if (!b) return;
    for (const m of W().mobs) if (m.wb && m.wb !== 'boss') { m.hp = 0; m.st = 'dead'; m.respawnAt = Infinity; m.pending = []; }   // ล้างผลึก/บริวารค้าง
    S.online = players.size;
    S.maxHp = wbHp(S.online);
    Object.assign(b, { x: ARENA_C.x, y: ARENA_C.y + TILE / 2, hp: S.maxHp, st: 'idle', target: null, pending: [], dmgBy: new Map(), stunUntil: 0, poison: null, respawnAt: Infinity, aoe: null });
    S.state = 'fight'; S.fightEnd = Date.now() + WB_FIGHT_MS; S.ledger = new Map(); S.phase = 0; S.tele = []; S.nextSkill = {}; S.gcd = Date.now() + 3000;
    S.traps = { yant: [], thornNext: Date.now() + 4000, thornSet: 0, fireNext: 0, fires: [] };
    say(`🌑 พระราหู ผู้กลืนจันทร์ Lv.150 ลงมาแล้ว! เลือด ${S.maxHp.toLocaleString()} (ออนไลน์ ${S.online} คน) · มีเวลา 30 นาที`);
    setPhase(1);
    push();
  }
  function setPhase(n) {
    if (n === S.phase) return;
    S.phase = n;
    const P = PHASES[n - 1];
    io.to(room).emit('wb:phase', { n, nameTh: P.nameTh });
    if (n > 1) say(`🌑 พระราหูเข้าสู่เฟส ${n} · ${P.nameTh}!`);
    // ยันต์ระเบิด: ของใหม่ทุกเฟส (เฟส 2–4)
    if (P.traps.includes('yant')) {
      S.traps.yant = Array.from({ length: TRAPS.yant.n }, () => {
        const a = rand(0, Math.PI * 2), d = rand(7, ARENA.r - 3);
        return { id: ++seq, x: ARENA_C.x + Math.cos(a) * d * TILE, y: ARENA_C.y + Math.sin(a) * d * TILE, armed: 0 };
      });
    }
    if (P.traps.includes('fire') && !S.traps.fireNext) S.traps.fireNext = Date.now() + 5000;
    push();
  }
  function endFight(win, killer) {
    if (S.state !== 'fight') return;
    const b = boss();
    S.state = 'ended'; S.closeAt = Date.now() + WB_CLOSE_MS; S.tele = [];
    for (const m of W().mobs) if (m.wb && m.st !== 'dead') { m.hp = 0; m.st = 'dead'; m.respawnAt = Infinity; m.pending = []; }
    S.crystals = []; S.traps.yant = []; S.traps.fires = [];
    io.to(room).emit('wb:clear', {});
    if (win) {
      S.mvp = { pid: killer.id, acc: killer.acc, key: `${killer.acc}:${killer.slot || 0}`, name: killer.name, until: Date.now() + WB_MVP_MS };
      S.lastMvp = S.mvp;
      say(`★ MVP: ${killer.name} ปิดฉากพระราหู! จันทร์กลับมาสว่างแล้ว`, '👑 บอสโลก');
      io.emit('wb:mvp', S.mvp);
    } else {
      say(`🌘 หมดเวลา! พระราหูกลืนจันทร์แล้วหายไปในเมฆ (เหลือเลือด ${Math.round((b?.hp || 0) / S.maxHp * 100)}%) · รอบหน้าช่วยกันใหม่นะ`);
    }
    if (b) { b.hp = 0; b.st = 'dead'; }
    grant(win);
    push();
  }
  function close() {
    for (const p of td.playersIn(WB_MAP)) back(p);
    S.state = 'idle'; S.at = nextSpawnAt(Date.now() + 60e3); S.closeAt = 0; S.maxHp = 0; S.phase = 0;
    push();
  }

  // ------------------------------------------------------------
  //  รางวัล (ตามอันดับดาเมจ · ต้อง ≥ 0.5% ของเลือดบอส)
  // ------------------------------------------------------------
  function grant(win) {
    const rows = [...S.ledger.values()].sort((a, b) => b.dmg - a.dmg);
    // สัดส่วน = ดาเมจของเรา ÷ ดาเมจรวมทุกคน (บอสฟื้นเลือดจากผลึกได้ → รวมเกินเลือดสูงสุด · ไม่ให้เกิน 100%)
    const total = Math.max(1, S.maxHp, rows.reduce((a, r) => a + r.dmg, 0));
    const board = rows.slice(0, 10).map((r, i) => ({ rank: i + 1, name: r.name, dmg: r.dmg, pct: +(r.dmg / total * 100).toFixed(2) }));
    rows.forEach((r, i) => {
      const share = r.dmg / total, rank = i + 1, isMvp = win && S.mvp?.key === r.key;
      const out = { rank, pct: +(share * 100).toFixed(2), mvp: isMvp, win, items: [], exp: 0, gold: 0, board };
      if (share >= WB_MIN_SHARE || isMvp) {
        const R = wbReward(rank, share, isMvp), k = win ? 1 : 0.25;
        out.exp = Math.round(WB_BASE_EXP * R.expK * k); out.gold = Math.round(WB_BASE_GOLD * R.goldK * k);
        out.items.push({ id: WB_STONE, qty: win ? R.stone : 1 });
        if (win) out.items.push({ id: 'yak_fang', qty: R.fang });
        if (win && Math.random() < R.card) out.items.push({ id: `card_${WB_ID}`, qty: 1, card: true });
        if (win && Math.random() < R.red) out.red = true;                          // ชิ้นขอบแดงสุ่มตามอาชีพตอนรับ
        out.ok = true;
      }
      const p = [...players.values()].find((q) => q.acc === r.acc && (q.slot || 0) === r.slot);
      if (p?.save) deliver(p, out); else if (out.ok) S.pending.set(r.key, { out, until: Date.now() + 24 * 3600e3 });   // ออฟไลน์ → เก็บไว้ให้ตอนเข้าเกม (24 ชม.)
    });
    io.to(room).emit('wb:board', { board, win });
  }
  /** มอบรางวัลใส่เซฟ (ออนไลน์อยู่ หรือตอนเข้าเกมครั้งถัดไป) */
  function deliver(p, out) {
    const c = p.save;
    if (out.ok) {
      gainExp(c, out.exp); c.gold = (c.gold || 0) + out.gold;
      for (const it of out.items) addItem(c, it.id, it.qty);
      if (out.items.some((it) => it.card)) say(`🃏 ${p.name} ได้การ์ดพระราหู!`, '🃏 การ์ดหายาก');
      if (out.red) {
        const job = c.appearance?.job, pool = RED_GEAR.filter((id) => ITEMS[id].job === job);
        const id = pick(pool.length ? pool : RED_GEAR);
        addItem(c, id, 1); out.items.push({ id, qty: 1, red: true }); out.red = false;
        say(`✨ ${p.name} ได้ ${ITEMS[id].nameTh} (อุปกรณ์ขอบแดง)!`, '✨ ของหายาก');
      }
      c.rec ||= {}; c.rec.wbJoin = (c.rec.wbJoin || 0) + 1;
      if (out.mvp) c.rec.wbMvp = (c.rec.wbMvp || 0) + 1;
      const got = checkTitles(c);
      if (got.length) social?.announceTitles?.(p, got);
      refresh(p); queueSync(p);
    }
    io.to(p.id).emit('wb:reward', out);
  }

  // ------------------------------------------------------------
  //  สกิลบอส
  // ------------------------------------------------------------
  function tele(t) { t.id = ++seq; S.tele.push(t); io.to(room).emit('wb:tele', { ...t, hit: undefined }); return t; }
  function resolveHits(t, test) {
    for (const p of fighters()) if (test(pos(p))) hurtPlayer(p, pct(p, t.dmg), { hit: true, x: Math.round(ARENA_C.x), force: true, td: true, iframe: 300 });
  }
  function aimTarget() {
    const f = fighters();
    if (!f.length) return null;
    // ต่อยคนที่ทำดาเมจสูงสุดที่อยู่ใกล้ 60% · ที่เหลือสุ่ม
    const near = f.filter((p) => Math.hypot(p.tx - ARENA_C.x, p.ty - ARENA_C.y) < 14 * TILE);
    const dm = (q) => S.ledger.get(`${q.acc}:${q.slot || 0}`)?.dmg || 0;
    if (near.length && Math.random() < 0.6) return near.sort((a, b) => dm(b) - dm(a))[0];
    return pick(f);
  }
  const SK = {
    claw(now, sk) {
      const t = aimTarget(); if (!t) return false;
      const a = Math.atan2(t.ty - ARENA_C.y, t.tx - ARENA_C.x); S.face = a;
      tele({ kind: 'claw', shape: 'cone', x: ARENA_C.x, y: ARENA_C.y, a, arc: sk.arc, range: sk.range, ms: sk.warn, at: now + sk.warn, dmg: sk.dmg, color: sk.color,
        hit: (P) => Math.hypot(P.x - ARENA_C.x, P.y - ARENA_C.y) <= sk.range && angDiff(Math.atan2(P.y - ARENA_C.y, P.x - ARENA_C.x), a) <= (sk.arc / 2) * Math.PI / 180 });
      return true;
    },
    breath(now, sk) {
      const t = aimTarget(); if (!t) return false;
      const a = Math.atan2(t.ty - ARENA_C.y, t.tx - ARENA_C.x), ux = Math.cos(a), uy = Math.sin(a); S.face = a;
      tele({ kind: 'breath', shape: 'line', x: ARENA_C.x, y: ARENA_C.y, a, len: sk.range, w: sk.w, ms: sk.warn, at: now + sk.warn, dmg: sk.dmg, color: sk.color, target: t.id,
        hit: (P) => { const dx = P.x - ARENA_C.x, dy = P.y - ARENA_C.y, along = dx * ux + dy * uy; return along >= 0 && along <= sk.range && Math.abs(-dx * uy + dy * ux) <= sk.w / 2; } });
      return true;
    },
    shadow(now, sk) {
      const f = shuffle(fighters()); if (!f.length) return false;
      const n = Math.min(f.length, Math.round(rand(sk.n[0], sk.n[1])));
      const pts = f.slice(0, n).map((p) => ({ x: p.tx, y: p.ty }));
      while (pts.length < sk.n[0]) { const a = rand(0, 6.28), d = rand(4, ARENA.r - 3) * TILE; pts.push({ x: ARENA_C.x + Math.cos(a) * d, y: ARENA_C.y + Math.sin(a) * d }); }
      tele({ kind: 'shadow', shape: 'circles', pts, r: sk.r, ms: sk.warn, at: now + sk.warn, dmg: sk.dmg, color: sk.color, hit: (P) => pts.some((c) => Math.hypot(P.x - c.x, P.y - c.y) <= sk.r) });
      return true;
    },
    crystal(now, sk) {
      const mobs = W().mobs.filter((m) => m.wb === 'crystal');
      if (mobs.some((m) => m.st !== 'dead')) return false;
      const hp = Math.round(Math.min(400000, 30000 + S.online * 6000));
      mobs.forEach((m, i) => { const a = Math.PI / 4 + i * Math.PI / 2 + rand(-0.3, 0.3), d = rand(12, 18) * TILE; Object.assign(m, { x: ARENA_C.x + Math.cos(a) * d, y: ARENA_C.y + Math.sin(a) * d, hp, st: 'idle', pending: [], dmgBy: new Map(), stunUntil: 0, poison: null, maxHp: hp }); });
      S.crystals = mobs.map((m) => ({ mid: m.mid, until: now + sk.life }));
      io.to(room).emit('wb:crystal', { mids: mobs.map((m) => m.mid), hp, until: now + sk.life });
      say('💎 ผลึกจันทร์ 4 ก้อนผุดขึ้นรอบลาน! ตีให้แตกใน 30 วิ ไม่งั้นพระราหูฟื้นเลือด', '🌑 ลานสุริยคราส');
      return true;
    },
    minion(now, sk) {
      const free = W().mobs.filter((m) => m.wb === 'shade' && m.st === 'dead').slice(0, sk.n);
      if (!free.length) return false;
      const f = fighters();
      free.forEach((m, i) => {
        const a = S.face + (i - 1) * 0.9, x = ARENA_C.x + Math.cos(a) * 4 * TILE, y = ARENA_C.y + Math.sin(a) * 4 * TILE;
        const t = f.length ? f[Math.floor(Math.random() * f.length)] : null;
        Object.assign(m, { x, y, hp: m.d.hp, st: t ? 'chase' : 'wander', target: t?.id || null, pending: [], dmgBy: new Map(), stunUntil: 0, poison: null, nextAtk: now + 800, s: { ...m.s, x, y } });
      });
      tele({ kind: 'minion', shape: 'burst', x: ARENA_C.x, y: ARENA_C.y, ms: sk.warn, at: now + sk.warn, dmg: 0, color: sk.color, hit: null });
      return true;
    },
    dark(now, sk) {
      const pts = [];
      for (let i = 0; i < sk.n; i++) { const a = rand(0, 6.28) + i * 2.1, d = rand(8, ARENA.r - 5) * TILE; pts.push({ x: ARENA_C.x + Math.cos(a) * d, y: ARENA_C.y + Math.sin(a) * d }); }
      tele({ kind: 'dark', shape: 'safe', pts, r: sk.r, ms: sk.warn, at: now + sk.warn, dmg: sk.dmg, color: sk.color, hit: (P) => !pts.some((c) => Math.hypot(P.x - c.x, P.y - c.y) <= sk.r) });
      return true;
    },
    roar(now, sk) {
      // ดูดทุกคนในลานเข้าหาบอส (เหลือห่าง ~1.5 ไทล์จากขอบวงระเบิด) → วิ่งออกให้พ้นวง
      for (const p of fighters()) {
        const dx = p.tx - ARENA_C.x, dy = p.ty - ARENA_C.y, d = Math.hypot(dx, dy) || 1, keep = Math.min(d, sk.r - 1.5 * TILE);
        const x = ARENA_C.x + dx / d * keep, y = ARENA_C.y + dy / d * keep;
        if (!W().solidAt(x, y - 2)) { p.tx = x; p.ty = y; p.mvBudget = 0; io.to(p.id).emit('wb:pull', { x: Math.round(x), y: Math.round(y) }); }
      }
      tele({ kind: 'roar', shape: 'circle', x: ARENA_C.x, y: ARENA_C.y, r: sk.r, ms: sk.warn, at: now + sk.warn, dmg: sk.dmg, color: sk.color, hit: (P) => Math.hypot(P.x - ARENA_C.x, P.y - ARENA_C.y) <= sk.r });
      return true;
    },
    navagraha(now, sk) {
      const off = rand(0, 6.28), pts = [];
      for (let i = 0; i < 8; i++) { const a = off + i * Math.PI / 4; pts.push({ x: ARENA_C.x + Math.cos(a) * sk.ringR, y: ARENA_C.y + Math.sin(a) * sk.ringR, c: NAVA_COLORS[i] }); }
      for (const p of shuffle(fighters()).slice(0, 4)) pts.push({ x: p.tx, y: p.ty, c: NAVA_COLORS[pts.length % 8] });   // ดวงที่เล็งคนด้วย
      tele({ kind: 'navagraha', shape: 'circles', pts, r: sk.r, ms: sk.warn, at: now + sk.warn, dmg: sk.dmg, color: sk.color, hit: (P) => pts.some((c) => Math.hypot(P.x - c.x, P.y - c.y) <= sk.r) });
      return true;
    },
  };
  function castTick(now) {
    if (now < S.gcd || S.tele.some((t) => !t.trap && t.shape !== 'burst' && now < t.at)) return;
    const P = PHASES[S.phase - 1], cdMul = P.cdMul || 1;
    const ready = P.skills.filter((k) => now >= (S.nextSkill[k] || 0));
    if (!ready.length) return;
    // ท่าใหญ่ก่อน (ดับฟ้า/นพเคราะห์/ผลึก) ถ้าพร้อม
    const pri = ['dark', 'navagraha', 'crystal', 'minion', 'roar'];
    const k = ready.find((x) => pri.includes(x) && Math.random() < 0.7) || pick(ready);
    const sk = WB_SKILLS[k];
    if (SK[k](now, sk)) { S.nextSkill[k] = now + sk.cd * cdMul; S.gcd = now + (1600 + Math.random() * 1400) * cdMul; io.to(room).emit('wb:cast', { k, nameTh: sk.nameTh, tip: sk.tip }); }
    else S.nextSkill[k] = now + 3000;
  }

  // ------------------------------------------------------------
  //  กับดัก
  // ------------------------------------------------------------
  function trapTick(now, dt) {
    const P = PHASES[S.phase - 1];
    const f = fighters();
    // หนามงิ้ว: 2 ชุดสลับ
    if (now >= S.traps.thornNext) {
      const set = S.traps.thornSet; S.traps.thornSet ^= 1; S.traps.thornNext = now + TRAPS.thorn.every;
      const spots = TRAPS.thorn.spots.filter((s) => s.set === set).map((s) => ({ x: s.x * TILE, y: s.y * TILE }));
      const h = TRAPS.thorn.half * TILE;
      tele({ kind: 'thorn', shape: 'squares', pts: spots, h, ms: TRAPS.thorn.warn, at: now + TRAPS.thorn.warn, dmg: TRAPS.thorn.dmg, color: 'red', trap: true,
        hit: (Q) => spots.some((s) => Math.abs(Q.x - s.x) <= h && Math.abs(Q.y - s.y) <= h) });
    }
    // บ่อเงาดูด: ยืนในบ่อ = เสีย 3%/วิ (ช้าลงฝั่ง client)
    S.poolAcc = (S.poolAcc || 0) + dt;
    if (S.poolAcc >= 1) {
      S.poolAcc = 0;
      for (const p of f) if (TRAPS.pool.spots.some((s) => Math.hypot(p.tx - s.x * TILE, p.ty - s.y * TILE) <= TRAPS.pool.r * TILE)) hurtPlayer(p, pct(p, TRAPS.pool.dmg), { hit: true, force: true, td: true, iframe: 0, x: Math.round(p.tx) });
    }
    // ยันต์ระเบิด: เข้าใกล้ 3 ไทล์ → กะพริบ 1 วิ → ระเบิดรัศมี 1.5 ไทล์
    for (const y of S.traps.yant) {
      if (!y.armed && f.some((p) => Math.hypot(p.tx - y.x, p.ty - y.y) <= TRAPS.yant.trig * TILE)) {
        y.armed = now + TRAPS.yant.warn;
        tele({ kind: 'yant', shape: 'circle', x: y.x, y: y.y, r: TRAPS.yant.r * TILE, ms: TRAPS.yant.warn, at: y.armed, dmg: TRAPS.yant.dmg, color: 'red', trap: true, yant: y.id,
          hit: (Q) => Math.hypot(Q.x - y.x, Q.y - y.y) <= TRAPS.yant.r * TILE });
      }
    }
    S.traps.yant = S.traps.yant.filter((y) => !y.armed || now < y.armed);
    // เสาเพลิงนรก (เฟส 3–4): 4 เสาพ่นไฟยาว 9 ไทล์ กวาด 90° ใน 3 วิ
    if (P.traps.includes('fire') && now >= S.traps.fireNext) {
      S.traps.fireNext = now + (S.phase >= 4 ? TRAPS.fire.every4 : TRAPS.fire.every) + TRAPS.fire.warn;
      const fires = TRAPS.fire.spots.map((s) => {
        const x = s.x * TILE, y = s.y * TILE, a0 = Math.atan2(ARENA_C.y - y, ARENA_C.x - x) - Math.PI / 4;
        return { x, y, a0, a1: a0 + Math.PI / 2, t0: now + TRAPS.fire.warn, t1: now + TRAPS.fire.warn + 3000, hit: new Set() };
      });
      S.traps.fires = fires;
      io.to(room).emit('wb:fire', { fires: fires.map(({ hit, ...r }) => r), len: TRAPS.fire.len * TILE, warn: TRAPS.fire.warn, now });
    }
    for (const F of S.traps.fires) {
      if (now < F.t0 || now > F.t1) continue;
      const a = F.a0 + (F.a1 - F.a0) * (now - F.t0) / (F.t1 - F.t0), ux = Math.cos(a), uy = Math.sin(a), L = TRAPS.fire.len * TILE;
      for (const p of f) {
        if (F.hit.has(p.id)) continue;
        const dx = p.tx - F.x, dy = p.ty - F.y, along = dx * ux + dy * uy;
        if (along >= 0 && along <= L && Math.abs(-dx * uy + dy * ux) <= 0.8 * TILE) { F.hit.add(p.id); hurtPlayer(p, pct(p, TRAPS.fire.dmg), { hit: true, force: true, td: true, iframe: 200, x: Math.round(F.x) }); }
      }
    }
    S.traps.fires = S.traps.fires.filter((F) => now <= F.t1);
  }

  // ------------------------------------------------------------
  //  ลูปหลัก (10 ครั้ง/วิ)
  // ------------------------------------------------------------
  let last = Date.now(), pushT = 0;
  function tick() {
    const now = Date.now(), dt = Math.min(0.5, (now - last) / 1000); last = now;
    if (S.state === 'idle' && now >= S.at - WB_ANNOUNCE_MS) open(S.at);
    if (S.state === 'open') {
      if (!S.warned1 && now >= S.at - 60e3) { S.warned1 = true; say('🌑 อีก 1 นาที พระราหูจะลงมา! รวมพลที่ค่ายรอคราส'); }
      if (now >= S.at) startFight();
      if (now - pushT > 5000) { pushT = now; push(); }
      return;
    }
    if (S.state === 'ended') { if (now >= S.closeAt) close(); return; }
    if (S.state !== 'fight') return;
    const b = boss();
    if (!b || b.st === 'dead') return;
    b.x = ARENA_C.x; b.y = ARENA_C.y + TILE / 2; b.stunUntil = 0; b.dir = Math.round(S.face / (Math.PI / 4));
    if (now >= S.fightEnd) return endFight(false);
    setPhase(Math.max(S.phase, phaseOf(b.hp / S.maxHp)));                // ผลึกฟื้นเลือดไม่ย้อนเฟส
    // ท่าที่ถึงเวลาลง
    const due = S.tele.filter((t) => now >= t.at);
    S.tele = S.tele.filter((t) => now < t.at);
    for (const t of due) { if (t.hit) resolveHits(t, t.hit); io.to(room).emit('wb:land', { id: t.id, kind: t.kind }); }
    // ผลึกหมดเวลา → ราหูฟื้นเลือด 5% ต่อก้อนที่เหลือ
    for (const c of S.crystals) {
      if (now < c.until) continue;
      const m = W().mobs[c.mid];
      if (m && m.st !== 'dead') {
        m.hp = 0; m.st = 'dead'; m.respawnAt = Infinity;
        b.hp = Math.min(S.maxHp, b.hp + S.maxHp * WB_SKILLS.crystal.heal);
        io.to(room).emit('td:die', { mid: m.mid, killer: null });
        io.to(room).emit('wb:heal', { mid: m.mid, amt: Math.round(S.maxHp * WB_SKILLS.crystal.heal) });
      }
      c.done = true;
    }
    S.crystals = S.crystals.filter((c) => !c.done);
    castTick(now);
    trapTick(now, dt);
    if (now - pushT > 1000) { pushT = now; io.to(room).emit('wb:hp', { hp: Math.round(b.hp), maxHp: S.maxHp, phase: S.phase, end: S.fightEnd, now }); }
    if (now - (S.gPush || 0) > 10000) { S.gPush = now; push(); }                    // คนนอกลานเห็นเลือด/เวลาล่าสุดบนแถบประกาศ
  }
  setInterval(tick, 100);

  const api = {
    isOpen: () => S.state !== 'idle',
    /** เข้าเกม: รับรางวัลบอสโลกที่ค้างไว้ตอนออฟไลน์ */
    onJoin(p) { const k = `${p.acc}:${p.slot || 0}`, r = S.pending.get(k); if (!r) return; S.pending.delete(k); if (r.until > Date.now()) setTimeout(() => players.get(p.id) === p && deliver(p, r.out), 4000); },
    onDmg(m, p, dmg) {
      if (m.wb !== 'boss' || S.state !== 'fight') return;
      const key = `${p.acc}:${p.slot || 0}`, r = S.ledger.get(key) || { key, acc: p.acc, slot: p.slot || 0, name: p.name, dmg: 0 };
      r.dmg += dmg; r.name = p.name; r.at = Date.now(); S.ledger.set(key, r);
    },
    onKill(m, killer) {
      if (m.wb === 'boss') endFight(true, killer);
      else if (m.wb === 'crystal') { S.crystals = S.crystals.filter((c) => c.mid !== m.mid); io.to(room).emit('wb:crack', { mid: m.mid, by: killer?.name }); }
    },
    status,
    mvpOf: () => (S.mvp && S.mvp.until > Date.now() ? S.mvp : null),
    onConnection(socket) {
      socket.emit('wb:status', status());
      socket.on('wb:go', (d, cb) => { const r = go(players.get(socket.id)); if (typeof cb === 'function') cb(r); });
      socket.on('wb:leave', (d, cb) => { const ok = back(players.get(socket.id)); if (typeof cb === 'function') cb({ ok }); });
    },
    /** GM: /gm rahu [open|now|end|kill|close] */
    gm(cmd) {
      const now = Date.now();
      if (cmd === 'open' || !cmd) { if (S.state === 'idle') open(now + 60e3); else S.at = now + 60e3; return 'เปิดลานแล้ว · บอสเกิดใน 1 นาที'; }
      if (cmd === 'now') { if (S.state === 'fight' || S.state === 'ended') return 'กำลังมีรอบอยู่ (ใช้ /gm rahu close ก่อน)'; if (S.state === 'idle') open(now); startFight(); return 'พระราหูเกิดแล้ว'; }
      if (cmd === 'kill') { const b = boss(); if (S.state === 'fight' && b) { b.hp = Math.min(b.hp, 1); } return 'เลือดบอสเหลือ 1'; }
      if (cmd === 'hp') { const b = boss(); if (S.state === 'fight' && b) { b.hp = S.maxHp * 0.26; } return 'เลือดบอส 26% (เฟส 3)'; }
      if (cmd === 'end') { endFight(false); return 'จบการต่อสู้'; }
      if (cmd === 'close') { if (S.state === 'fight') endFight(false); close(); return 'ปิดลานแล้ว'; }
      return 'คำสั่ง: /gm rahu [open|now|hp|kill|end|close]';
    },
  };
  td.setWb(api);
  return api;
}
