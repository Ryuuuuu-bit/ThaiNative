// ============================================================
//  ThaiNative Online – Game Server
//  Express (เสิร์ฟไฟล์เกม) + Socket.io (ระบบ Multiplayer แบบ Real-time)
//  ▸ server เป็นเจ้าของข้อมูลตัวละคร (ของ/เงิน/ตีบวก/เควส/เลเวล/HP) → client ส่งแค่คำสั่ง
// ============================================================
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORLD } from '../shared/constants.js';
import { MAPS, mapAt, gateNear } from '../shared/data/maps.js';
import { sanitizeAppearance } from '../shared/data/appearance.js';
import { getDerived } from '../shared/character.js';
import { migrate } from '../shared/charmodel.js';
import { runAction, packChar } from '../shared/economy.js';
import { SKILL_BY_ID, MAX_SKILL_LV, skillStats } from '../shared/data/skills.js';
import { DAY_MS_DEFAULT, dayPhase, isNight } from '../shared/data/world.js';
import { setupSocial } from './social.js';
import { setupMobs } from './mobs.js';
import { setupDungeon } from './dungeon.js';
import { setupAuth, isAdmin } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 3000;
const TICK_RATE = 15; // ส่ง snapshot ให้ทุก client 15 ครั้ง/วินาที
const DAY_MS = Number(process.env.DAY_MS) || DAY_MS_DEFAULT;   // ความยาว 1 วันในเกม (ms)

/** ผู้เล่นออนไลน์  key = socket.id · byAcc: บัญชี → socket.id (1 บัญชีเล่นได้ทีละเครื่อง) */
const players = new Map();
const byAcc = new Map();

const app = express();
app.disable('x-powered-by');
const storeReady = setupAuth(app, { onlineChar: (acc) => players.get(byAcc.get(acc))?.save || null });
app.use(express.static(path.join(ROOT, 'client')));
app.use('/shared', express.static(path.join(ROOT, 'shared')));
app.use('/vendor', express.static(path.join(ROOT, 'node_modules/phaser/dist')));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const nightNow = () => isNight(dayPhase(Date.now(), DAY_MS));

// ============================================================
//  ตัวละครฝั่ง server: HP · ส่งสถานะ · เซฟ
// ============================================================
/** คำนวณค่าที่ขึ้นกับเซฟใหม่ (หลังของ/เลเวล/อุปกรณ์เปลี่ยน) */
function refresh(p) {
  const d = getDerived(p.save);
  p.maxHp = d.maxHp;
  if (p.save.hp > d.maxHp) p.save.hp = d.maxHp;
  p.level = p.save.level;
  p.dirty = true;
  const app = JSON.stringify(p.save.appearance);
  if (app !== p.appKey) { p.appKey = app; p.appearance = p.save.appearance; io.emit('player:appearance', { id: p.id, appearance: p.appearance }); }
}
/** ส่งตัวละครล่าสุดให้เจ้าของ (รวบหลายครั้งเป็นครั้งเดียว) */
function queueSync(p) { if (p) { p.syncDue = true; p.dirty = true; } }
function flushSync(p) {
  if (!p.syncDue) return;
  p.syncDue = false;
  io.to(p.id).emit('char:sync', packChar(p.save));
}
/** เซฟลงฐานข้อมูล */
async function persist(p) {
  if (!p?.dirty || !p.acc) return;
  p.dirty = false;
  try { await (await storeReady).saveCharacter(p.acc, p.save); }
  catch (e) { p.dirty = true; console.error('[persist]', e.message); }
}

/** ผู้เล่นโดนโจมตี (server ตัดสิน) → { applied } */
function hurtPlayer(p, dmg, info = {}) {
  const now = Date.now();
  if (!p || p.dead || now < (p.invulnUntil || 0) || p.x <= (mapAt(p.x).safeEndX ?? -1e9) && !info.force) return false;
  if (info.hit === false) { io.to(p.id).emit('pl:hit', { hit: false, dmg: 0, x: info.x ?? p.x }); return false; }
  dmg = Math.max(1, Math.round(dmg));
  p.hp = Math.max(0, p.hp - dmg);
  p.invulnUntil = now + (info.iframe ?? 700);
  p.lastHurt = now;
  io.to(p.id).emit('pl:hit', { hit: true, dmg, crit: !!info.crit, x: info.x ?? p.x, hp: p.hp, stun: info.stun || 0 });
  if (p.hp <= 0) {
    p.dead = true;
    p.buffs = [];
    p.save.rec ||= {}; p.save.rec.deaths = (p.save.rec.deaths || 0) + 1;
    queueSync(p);
    io.to(p.id).emit('pl:die', {});
  }
  return true;
}
function healPlayer(p, amt) {
  if (!p || p.dead) return;
  const before = p.hp;
  p.hp = Math.min(p.maxHp, p.hp + amt);
  if (Math.round(p.hp) !== Math.round(before)) p.hpDirty = true;
}

const helpers = { players, byAcc, queueSync, refresh, hurtPlayer, healPlayer, persist, warpTo };
/** ปาร์ตี้ · เทรด · เรดบอส · เพื่อน */
const social = setupSocial(io, players, helpers);
/** ผีในแมพล่าผี + บอสประจำภาค (server คุม) */
const mobs = setupMobs(io, players, { dayMs: DAY_MS, shareExp: social.shareExp, ...helpers });
/** ดันเจี้ยนปาร์ตี้ (ห้องแยก) */
const dungeon = setupDungeon(io, players, { social, ...helpers });

function publicPlayer(p) {
  return {
    id: p.id, name: p.name, appearance: p.appearance,
    x: p.x, y: p.y, anim: p.anim, flipX: p.flipX, hp: Math.round(p.hp), maxHp: p.maxHp, level: p.level, wp: p.wp || 0, inst: p.inst || 0,
  };
}

/** ท่าที่ client ส่งมาได้ */
const ANIMS = ['idle', 'walk', 'attack', 'hit', 'die', 'jump', 'cast', 'shoot', 'spin', 'kick', 'dash', 'buff', 'slam', 'fish_cast', 'fish_idle', 'fish_reel', 'gather'];
/** ตำแหน่งเริ่มตอน join: ต่อใหม่ระหว่างเล่น → ใช้ตำแหน่งเดิม (ในดันเจี้ยน/ลานบอส → กลับหมู่บ้าน) */
function startPos(d) {
  if (!Number.isFinite(d.x) || !Number.isFinite(d.y)) return {};
  const m = mapAt(clamp(d.x, WORLD.minX, WORLD.width));
  if (m.dungeon) return {};
  return { x: clamp(d.x, m.minX + 8, m.maxX - 8), y: clamp(d.y, -200, WORLD.height) };
}
const cleanText = (s, max) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, max);

process.on('uncaughtException', (e) => console.error('[uncaught]', e));
process.on('unhandledRejection', (e) => console.error('[unhandled]', e));

io.on('connection', (socket) => {
  // ห่อทุก handler: payload null/undefined → {} และจับ error ไว้ (ไม่ให้ process ตาย)
  const rawOn = socket.on.bind(socket);
  socket.on = (ev, fn) => rawOn(ev, (...args) => {
    if (args[0] === null || args[0] === undefined) args[0] = {};
    try {
      const r = fn(...args);
      if (r?.catch) r.catch((e) => console.error(`[socket ${ev}]`, e?.message || e));
      return r;
    } catch (e) { console.error(`[socket ${ev}]`, e?.message || e); }
  });
  social.onConnection(socket);
  mobs.onConnection(socket);
  dungeon.onConnection(socket);
  const me = () => players.get(socket.id);

  // 1) เข้าโลก: ยืนยันตัวตนด้วย token → โหลดตัวละครจากฐานข้อมูล (server ถือข้อมูลจริง)
  socket.on('player:join', async (data = {}) => {
    if (players.has(socket.id) || socket.data.joining) return;
    socket.data.joining = true;
    try {
      const store = await storeReady;
      const acc = typeof data.token === 'string' && data.token ? await store.getSession(data.token) : null;
      if (!acc) return socket.emit('player:rejected', { reason: 'auth', msg: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' });
      // บัญชีเดียวกันเข้าจากที่อื่น → เตะเครื่องเก่า (เซฟก่อน)
      const oldId = byAcc.get(acc.id), old = oldId && players.get(oldId);
      let save = null;
      if (old) {
        save = old.save;
        io.to(oldId).emit('player:kicked', { msg: 'บัญชีนี้เข้าเกมจากเครื่องอื่น' });
        await leave(oldId);
        io.sockets.sockets.get(oldId)?.disconnect(true);
      }
      if (!socket.connected) return;
      save = migrate(save || (await store.getCharacter(acc.id)));
      if (!save) return socket.emit('player:rejected', { reason: 'nochar', msg: 'ยังไม่มีตัวละคร' });
      const p = {
        id: socket.id, acc: acc.id, admin: isAdmin(acc.username), save, char: save,
        name: save.name, appearance: save.appearance, appKey: JSON.stringify(save.appearance),
        x: WORLD.spawnX, y: WORLD.spawnY, ...startPos(data),
        anim: 'idle', flipX: false, level: save.level, maxHp: 1, buffs: [], sess: { joinAt: Date.now() },
        lastUpdate: Date.now(), lastChat: 0, lastSkill: 0, partyId: null, tradeId: null, dead: false, invulnUntil: Date.now() + 2000,
      };
      Object.defineProperty(p, 'hp', { get() { return this.save.hp; }, set(v) { this.save.hp = v; }, enumerable: true });
      refresh(p);
      p.dirty = false;
      players.set(socket.id, p);
      byAcc.set(acc.id, socket.id);
      mobs.touch(p);
      socket.emit('char:load', packChar(save));
      socket.emit('world:init', {
        selfId: socket.id, serverTime: Date.now(), dayMs: DAY_MS, admin: p.admin,
        players: [...players.values()].filter((q) => q.id !== socket.id).map(publicPlayer),
      });
      socket.broadcast.emit('player:joined', publicPlayer(p));
      social.onJoin(p);
    } finally { socket.data.joining = false; }
  });

  // 2) ตำแหน่ง/ท่าทาง (~15 ครั้ง/วินาที) – HP/เลเวลไม่รับจาก client แล้ว
  socket.on('player:update', (s = {}) => {
    const p = me();
    if (!p) return;
    const now = Date.now();
    const dt = Math.max(16, now - p.lastUpdate) / 1000;
    p.lastUpdate = now;
    const maxStep = WORLD.maxSpeed * dt * 2.5 + 40;                       // เผื่อสกิลพุ่ง/ตกจากที่สูง
    const nx = clamp(Number(s.x) || 0, WORLD.minX, WORLD.width);
    const ny = clamp(Number(s.y) || 0, -200, WORLD.height);
    const map = mapAt(p.x);
    p.x = clamp(p.x + clamp(nx - p.x, -maxStep, maxStep), map.minX, map.maxX);   // เดินข้ามแผนที่ไม่ได้
    p.y += clamp(ny - p.y, -maxStep * 2, maxStep * 2);
    p.anim = p.dead ? 'die' : ANIMS.includes(s.anim) ? s.anim : 'idle';
    p.flipX = !!s.flipX;
    if (Number.isFinite(+s.mp)) p.save.mp = clamp(+s.mp, 0, 99999);      // MP ยังให้ client ถือ (ใช้ร่ายสกิล)
  });

  // 2.1) วาร์ประหว่างแผนที่: ต้องยืนใกล้ประตู / ฟื้นหลังตาย / ยันต์คืนถิ่น
  socket.on('player:warp', (d = {}) => {
    const p = me();
    if (!p) return;
    const cx = Number(d.x);
    if (Number.isFinite(cx) && mapAt(cx).id === mapAt(p.x).id) p.x = cx;
    const map = mapAt(p.x);
    const reject = () => socket.emit('player:warp:reject', { x: Math.round(p.x), y: Math.round(p.y) });
    if (d.kind === 'travel') {
      const to = MAPS[d.to];
      if (!to || to.noTravel || !gateNear(p.x) || p.level < (to.minLv || 1) || p.dead) return reject();
      if (map.dungeon) dungeon.leave(p, 'travel');
      warpTo(p, to);
    } else if (d.kind === 'respawn') {
      if (!p.dead && p.hp > 0) return;
      p.dead = false;
      p.hp = p.maxHp;
      p.invulnUntil = Date.now() + 2000;
      if (map.dungeon && !dungeon.canRespawn(p)) warpTo(p, MAPS.village, MAPS.village.respawnX);
      else warpTo(p, map, map.respawnX);
      p.hpDirty = true;
    } else return;
  });

  // 3) รูปลักษณ์: server คำนวณเองจากเซฟ (client ส่งมาเฉยๆ ไม่มีผล)
  socket.on('player:appearance', () => { const p = me(); if (p) socket.emit('player:appearance', { id: p.id, appearance: p.appearance }); });

  // 3.1) คำสั่งเศรษฐกิจ (ซื้อ/ขาย/ใช้ของ/ตีบวก/เควส/ฯลฯ) → server รันกับเซฟจริง แล้วส่งสถานะใหม่กลับ
  socket.on('econ', (d = {}, ack) => {
    const done = typeof ack === 'function' ? ack : () => {};
    const p = me();
    if (!p) return done({ r: { ok: false, msg: 'ยังไม่ได้เข้าเกม' } });
    const now = Date.now();
    if (now - (p.econT || 0) > 1000) { p.econT = now; p.econN = 0; }
    if (++p.econN > 25) return done({ r: { ok: false, msg: 'ทำรายการถี่เกินไป' } });
    const a = String(d.a || '');
    if (p.dead && !['lock', 'hotbar', 'title', 'qDrop', 'friendDel'].includes(a)) return done({ r: { ok: false, msg: 'ตายอยู่ – รอฟื้นก่อน' } });
    const r = runAction(p.save, a, d, { rnd: Math.random, now, x: p.x, night: nightNow(), admin: p.admin, trade: !!p.tradeId, sess: p.sess });
    if (r.warp && r.ok) {
      if (r.warp === 'home') warpTo(p, MAPS.village, MAPS.village.arriveX);
      else if (r.warp === 'return') warpTo(p, MAPS[r.to], MAPS[r.to].respawnX);
      if (mapAt(p.x).id !== 'dungeon') dungeon.leave(p, 'recall');
      r.x = Math.round(p.x);
    }
    if (a === 'enhance' && r.slot && r.lv >= 10 && r.success) io.emit('chat', { id: null, name: '🔨 ลุงดำ', text: `${p.name} ตีบวกสำเร็จ +${r.lv}!` });
    refresh(p);
    p.syncDue = false;
    done({ r, s: packChar(p.save) });
    if (r.titles?.length) social.announceTitles(p, r.titles);
  });

  // 4) ใช้สกิล: server จำบัฟ/ฮีล/อมตะตอนพุ่ง เอง + กระจายให้ผู้เล่นอื่นเห็นเอฟเฟกต์
  socket.on('skill:cast', (d = {}) => {
    const p = me();
    const base = SKILL_BY_ID[d.skillId];
    const now = Date.now();
    if (!p || !base || p.dead) return;
    if (base.job !== p.appearance.job) return;
    const lv = p.save.skills?.[base.id] || 0;
    if (!lv || now - p.lastSkill < 150) return;
    const x = Number(d.x) || 0, y = Number(d.y) || 0;
    if (Math.abs(x - p.x) > 120 || Math.abs(y - p.y) > 120) return;
    const sk = skillStats(base, lv);
    p.skillAt ||= {};
    if (now - (p.skillAt[base.id] || 0) < sk.cd * 0.8) return;         // คูลดาวน์ (server)
    p.skillAt[base.id] = now;
    p.lastSkill = now;
    if (sk.type === 'buff') {
      p.buffs = (p.buffs || []).filter((b) => b.until > now && b.sk !== base.id);
      p.buffs.push({ buff: sk.buff, until: now + sk.duration, sk: base.id });
      if (sk.heal) healPlayer(p, p.maxHp * sk.heal);
    } else if (sk.type === 'dash') p.invulnUntil = Math.max(p.invulnUntil || 0, now + 320);
    socket.broadcast.emit('skill:cast', {
      id: p.id, skillId: base.id, lv: clamp(lv, 1, MAX_SKILL_LV),
      x: Math.round(x), y: Math.round(y), dir: d.dir === -1 ? -1 : 1,
      tx: Number.isFinite(d.tx) ? Math.round(d.tx) : null, ty: Number.isFinite(d.ty) ? Math.round(d.ty) : null,
    });
  });

  // 4.1) แชท (จำกัด 1 ข้อความ / 0.5 วินาที)
  socket.on('chat', (text) => {
    if (typeof text !== 'string') return;
    const p = me();
    if (!p || Date.now() - p.lastChat < 500) return;
    p.lastChat = Date.now();
    const msg = cleanText(text, 120);
    if (!msg) return;
    const wm = msg.match(/^\/w\s+(\S+)\s+(.+)$/i);                              // /w ชื่อ ข้อความ = กระซิบ
    if (wm) {
      const t = [...players.values()].find((q) => q.name === wm[1]);
      if (!t) return socket.emit('chat', { id: null, name: '📢 ระบบ', text: `ไม่พบผู้เล่นชื่อ "${wm[1]}" ที่ออนไลน์อยู่` });
      io.to(t.id).emit('chat', { id: p.id, name: `[กระซิบจาก ${p.name}]`, text: wm[2], whisper: true, from: p.name });
      if (t.id !== p.id) socket.emit('chat', { id: p.id, name: `[กระซิบถึง ${t.name}]`, text: wm[2], whisper: true });
      return;
    }
    io.emit('chat', { id: p.id, name: p.name, text: msg });
  });

  socket.on('disconnect', () => leave(socket.id));
});

/** ย้ายผู้เล่นไปแมพอื่น (server ตัดสิน) แล้วแจ้ง client */
function warpTo(p, to, x = to.arriveX) {
  p.x = x;
  p.y = WORLD.spawnY;
  p.wp = (p.wp || 0) + 1;
  if (to.mon || to.boss) { p.save.lastHunt = to.id; p.dirty = true; }
  mobs.touch(p);
}

/** ออกจากเกม: เซฟ → ลบออกจากโลก */
async function leave(id) {
  const p = players.get(id);
  if (!p) return;
  social.onDisconnect(id);
  dungeon.onDisconnect(id);
  players.delete(id);
  if (byAcc.get(p.acc) === id) byAcc.delete(p.acc);
  io.emit('player:left', id);
  p.dirty = true;
  await persist(p);
}

// ============================================================
//  Game loop: snapshot · ผี · ฟื้น HP · ส่งสถานะ · เซฟอัตโนมัติ
// ============================================================
setInterval(() => {
  social.tick();
  dungeon.tick();
  if (players.size === 0) return;
  mobs.tick();
  const snapshot = [...players.values()].map((p) => ({
    id: p.id, x: Math.round(p.x), y: Math.round(p.y), anim: p.anim, flipX: p.flipX,
    hp: Math.round(p.hp), maxHp: p.maxHp, level: p.level, party: p.partyId, wp: p.wp || 0, inst: p.inst || 0,
  }));
  io.volatile.emit('world:snapshot', { t: Date.now(), players: snapshot, boss: social.bossPublic() });
  for (const p of players.values()) {
    flushSync(p);
    if (p.hpDirty) { p.hpDirty = false; io.to(p.id).emit('pl:hp', { hp: Math.round(p.hp), maxHp: p.maxHp }); }
  }
}, 1000 / TICK_RATE);

// ฟื้น HP: หมู่บ้าน/ข้างกองไฟ 5%/วิ · ที่อื่นช้า ๆ ถ้าไม่ได้โดนตีมา 8 วิ
setInterval(() => {
  const now = Date.now();
  for (const p of players.values()) {
    if (p.dead || p.hp >= p.maxHp) continue;
    const m = mapAt(p.x), safe = m.safe || (m.fireX != null && Math.abs(p.x - m.fireX) < 70);
    if (safe) healPlayer(p, p.maxHp * 0.05);
    else if (now - (p.lastHurt || 0) > 8000) healPlayer(p, p.maxHp * 0.01);
  }
}, 1000);

setInterval(() => { for (const p of players.values()) persist(p); }, 5000);

// ปิด server (deploy ใหม่) → เซฟทุกคนก่อน
async function shutdown() {
  console.log('[server] shutting down – saving players');
  await Promise.all([...players.values()].map((p) => { p.dirty = true; return persist(p); }));
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

httpServer.listen(PORT, () => {
  console.log(`ThaiNative Online server running → http://localhost:${PORT}`);
});
