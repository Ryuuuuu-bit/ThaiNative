// ============================================================
//  ThaiNative Online – Game Server
//  Express (เสิร์ฟไฟล์เกม) + Socket.io (ระบบ Multiplayer แบบ Real-time)
//  ▸ server เป็นเจ้าของข้อมูลตัวละคร (ของ/เงิน/ตีบวก/เควส/เลเวล/HP) → client ส่งแค่คำสั่ง
// ============================================================
import express from 'express';
import compression from 'compression';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORLD } from '../shared/constants.js';
import { MAPS, mapAt, gateNear, canTravelFrom } from '../shared/data/maps.js';
import { sanitizeAppearance } from '../shared/data/appearance.js';
import { getDerived, combatPower } from '../shared/character.js';
import { migrate } from '../shared/charmodel.js';
import { skillCooldown } from '../shared/stats.js';
import { runAction, packChar, count as invCount, removeItem, addItem, PRE_TD_ACTIONS } from '../shared/economy.js';
import { ITEMS } from '../shared/data/items.js';
import { checkName, nameKey, nameIdeas } from '../shared/data/names.js';
import { SKILL_BY_ID, MAX_SKILL_LV, skillStats, skillUsable, skillMastery } from '../shared/data/skills.js';
import { DAY_MS_DEFAULT, dayPhase, isNight } from '../shared/data/world.js';
import { setupSocial } from './social.js';
import { setupMobs } from './mobs.js';
import { setupDungeon } from './dungeon.js';
import { setupTD } from './td.js';
import { setupHealer } from './healer.js';
import { setupWorldBoss } from './worldboss.js';
import { setupMarket } from './market.js';
import { setupAuth, isAdmin } from './auth.js';
import { setupRanking } from './ranking.js';
import { MAX_SLOTS } from './store.js';
import { discordInfo, relayChat, postNews, announcePatch } from './discord.js';

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
app.get('/api/discord', async (_req, res) => res.json(await discordInfo()));   // ปุ่ม Discord: จำนวนออนไลน์ (Server Widget)
const storeReady = setupAuth(app, {
  onlineChar: (acc) => { const p = players.get(byAcc.get(acc)); return p ? { slot: p.slot || 0, save: p.save } : null; },
  saveBusy: (acc) => saving.has(acc) || [...unsaved.keys()].some((k) => k.startsWith(`${acc}:`)),   // กำลังเซฟตอนออกเกมอยู่ → ห้ามเขียนทับจาก PUT /character
  onlineCount: () => players.size,
  leaderboard: () => ranking?.publicBoards() || null,
  // ลบตัวละคร: ถอดออกจากเพื่อนของคนออนไลน์ · รางวัลบอสโลกค้าง · คำนวณตารางอันดับใหม่ทันที (ฉายาอันดับขยับตาม)
  charDeleted: (acc, slot, name) => { social?.friendGone(acc, name); worldBoss?.forget?.(`${acc}:${slot || 0}`); ranking?.refresh(); },
});
// no-cache = เบราว์เซอร์ถามทุกครั้ง (ETag → 304 ถ้าไม่เปลี่ยน) · อัปแพตช์แล้วรีโหลดได้ของใหม่แน่นอน
// ภาพ/เสียงใน /assets: ใช้ของในเครื่องได้ 1 ชม. แล้วเช็คใหม่เบื้องหลัง (เปิดเกมซ้ำไม่ต้องถาม server ทีละพันไฟล์) · manifest/โค้ดยัง no-cache
const NOCACHE = { setHeaders: (res, file) => res.setHeader('Cache-Control', /[\\/]assets[\\/].+\.(png|webp|jpe?g|gif|mp3|ogg|wav)$/i.test(file) ? 'public, max-age=3600, stale-while-revalidate=604800' : 'no-cache') };
app.use(compression());                                                        // gzip โค้ด/JSON (~1.9MB → ราว 1/4) · ภาพ PNG ข้ามเอง
app.use(express.static(path.join(ROOT, 'client'), NOCACHE));
app.use('/shared', express.static(path.join(ROOT, 'shared'), NOCACHE));
app.use('/vendor', express.static(path.join(ROOT, 'node_modules/phaser/dist'), { maxAge: '1d' }));   // Phaser เปลี่ยนเฉพาะตอนอัปเวอร์ชัน

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' }, perMessageDeflate: { threshold: 512 } });   // บีบอัดแพ็กเก็ตใหญ่ (td:state) ลด egress
{ const emit0 = io.emit.bind(io); io.emit = (ev, ...a) => { if (ev === 'chat') relayChat(a[0]); return emit0(ev, ...a); }; }   // ข่าวระบบ → Discord webhook

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const nightNow = () => isNight(dayPhase(Date.now(), DAY_MS));

// ============================================================
//  ตัวละครฝั่ง server: HP · ส่งสถานะ · เซฟ
// ============================================================
/** คำนวณค่าที่ขึ้นกับเซฟใหม่ (หลังของ/เลเวล/อุปกรณ์เปลี่ยน) */
function refresh(p) {
  const d = getDerived(p.save);
  p.maxHp = d.maxHp; p.maxMp = d.maxMp;
  try { p.cp = combatPower(p.save, d); } catch { p.cp = 0; }        // ค่าพลังรวม (หน้าต่างปาร์ตี้)
  if (p.save.hp > d.maxHp) p.save.hp = d.maxHp;
  if (p.save.mp > d.maxMp) p.save.mp = d.maxMp;
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
const saving = new Map();                            // acc → promise ของการเซฟล่าสุด (เขียนทีละครั้งตามลำดับ ไม่ให้เซฟเก่าทับเซฟใหม่)
async function persist(p) {
  if (!p?.dirty || !p.acc) return;
  p.dirty = false;
  const snap = JSON.parse(JSON.stringify(p.save));  // ภาพ ณ ตอนสั่งเซฟ
  const run = (saving.get(p.acc) || Promise.resolve()).then(async () => {
    try { await (await storeReady).saveCharacter(p.acc, p.slot || 0, snap); }
    catch (e) {
      console.error('[persist]', e.message);
      if (players.get(p.id) === p) p.dirty = true;                          // ยังออนไลน์ → รอบหน้าเซฟใหม่
      else { unsaved.set(`${p.acc}:${p.slot || 0}`, snap); retryUnsaved(); }   // ออกไปแล้ว → เก็บไว้ ลองใหม่เรื่อย ๆ
    }
  });
  saving.set(p.acc, run);
  run.finally(() => { if (saving.get(p.acc) === run) saving.delete(p.acc); });
  return run;
}
let retryT = null;
function retryUnsaved() {
  if (retryT) return;
  retryT = setTimeout(async () => {
    retryT = null;
    for (const [k, snap] of [...unsaved]) {
      const [acc, slot] = k.split(':');
      if ([...players.values()].some((q) => String(q.acc) === acc && String(q.slot || 0) === slot)) { unsaved.delete(k); continue; }
      try { await (await storeReady).saveCharacter(isNaN(+acc) ? acc : +acc, +slot, snap); unsaved.delete(k); } catch { /* ลองใหม่รอบหน้า */ }
    }
    if (unsaved.size) retryUnsaved();
  }, 15000);
}

/** ผู้เล่นโดนโจมตี (server ตัดสิน) → { applied } */
let healer = null;
function hurtPlayer(p, dmg, info = {}) {
  const now = Date.now();
  if (!p || p.dead || now < (p.invulnUntil || 0) || p.x <= (mapAt(p.x).safeEndX ?? -1e9) && !info.force) return false;
  if (p.god && !info.gm) return false;                                      // GM โหมดอมตะ (/gm god)
  if (info.hit === false) { io.to(p.id).emit('pl:hit', { hit: false, dmg: 0, x: info.x ?? p.x }); return false; }
  dmg = Math.max(1, Math.round(dmg));
  p.hp = Math.max(0, p.hp - dmg);
  if (p.hp <= 0 && healer?.undying(p, now)) p.hp = 1;                     // ขวัญกันตาย (พิธีสู่ขวัญของหมอยา)
  p.invulnUntil = now + (info.iframe ?? 700);
  p.lastHurt = now;
  io.to(p.id).emit('pl:hit', { hit: true, dmg, crit: !!info.crit, x: info.x ?? p.x, hp: p.hp, stun: info.stun || 0 });
  if (p.hp <= 0) {
    p.dead = true;
    p.buffs = [];
    p.save.deadAt = now;                                                    // ตายแล้วออกเกม → เข้าใหม่เกิดที่จุดฟื้น (ไม่ฟื้นกลางสนาม)
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
/** ตารางอันดับ (ค่าพลังรวม/เลเวล/ตีบวก) + ฉายาอันดับ */
const ranking = setupRanking({ storeReady, players, social, queueSync, io });
/** ผีในแมพล่าผี + บอสประจำภาค (server คุม) */
const mobs = setupMobs(io, players, { dayMs: DAY_MS, shareExp: social.shareExp, ...helpers });
/** ดันเจี้ยนปาร์ตี้ (ห้องแยก) */
const dungeon = setupDungeon(io, players, { social, ...helpers });
/** โลก New Version (top-down อยุธยา) */
const td = setupTD(io, players, { dayMs: DAY_MS, shareExp: social.shareExp, partyOf: social.partyOf, partyBonus: social.partyBonus, pkColor: social.pkColor, ...helpers });
social.setPkEnv({ inTown: (p) => td.inTown(p), mapOf: (p) => td.mapOf(p) });   // เขต PK: แดน นอกค่ายพัก
const tdSys = td;                                   // (ในตัวจัดการสกิล ชื่อ td ถูกใช้เป็นธงโลก top-down)
/** หมอยา: ฮีล/สายใย/เมล็ด/ชุบชีวิต/กันตาย */
healer = setupHealer(io, players, { ...helpers, social, tdSys, onHeal: (c, n) => worldBoss?.onHeal?.(c, n) });
setInterval(() => healer.tick(), 250);
/** บอสโลกพระราหู (ลานสุริยคราส) */
const worldBoss = setupWorldBoss(io, players, { td, hurtPlayer, queueSync, social, refresh, storeReady });
const market = setupMarket(io, players, { td, refresh, persist, storeReady });

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
/** อีเวนต์ของโลกเก่า (side-scroller) — client ปัจจุบันไม่ส่งแล้ว เหลือไว้ให้โกงได้เท่านั้น */
const LEGACY_EV = new Set(['player:update', 'player:warp', 'mob:hit', 'dg:enter', 'dg:hit', 'dg:leave', 'raid:hit']);
/** สถานะชั่วคราวต่อตัวละคร (คูลดาวน์สมุนไพร/เก็บของ ฯลฯ) อยู่ข้ามการรีล็อก · เดิมสร้างใหม่ทุกครั้ง → ออก-เข้าใหม่แล้วเก็บสมุนไพรซ้ำได้ทันที */
const sessKeep = new Map();
function keepSess(key) {
  const S = sessKeep.get(key) || {};
  Object.assign(S, { joinAt: Date.now(), fish: null });                // มินิเกมตกปลาค้างจากรอบก่อน = ยกเลิก
  sessKeep.set(key, S);
  return S;
}
/** กันเข้าเกมซ้อน (2 socket บัญชีเดียวพร้อมกัน = ตัวละคร 2 ร่าง → ปั๊มของ) */
const joiningAcc = new Set();
/** เซฟที่เขียนไม่สำเร็จตอนออกเกม → เก็บไว้ในหน่วยความจำ ใช้แทนข้อมูลในฐานข้อมูลตอนเข้าใหม่ + ลองเซฟซ้ำ */
const unsaved = new Map();
/** MP ที่ client แจ้งมา: รับได้เฉพาะ ≤ ค่าที่ server นับไว้ (ใช้ไป/ต่ำกว่า = เชื่อ) */
function takeMp(p, v) { v = +v; if (Number.isFinite(v)) p.save.mp = clamp(v, 0, Math.min(p.save.mp ?? 0, p.maxMp || 99999)); }
const cleanText = (s, max) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, max);

process.on('uncaughtException', (e) => console.error('[uncaught]', e));
process.on('unhandledRejection', (e) => console.error('[unhandled]', e));

// เวอร์ชันเซิร์ฟเวอร์ (commit ที่ deploy) → client เทียบตอนต่อใหม่ ถ้าเปลี่ยน = มีแพตช์ใหม่ ให้รีโหลด
const BUILD = (process.env.RAILWAY_GIT_COMMIT_SHA || '').slice(0, 7) || `dev-${Date.now().toString(36)}`;
io.on('connection', (socket) => {
  socket.emit('server:build', { v: BUILD });
  if (patchNotice && patchNotice.at > Date.now() - 120000) socket.emit('server:notice', { kind: 'soon', ...patchNotice });
  socket.emit('news:live', liveNews);
  // ห่อทุก handler: payload null/undefined → {} และจับ error ไว้ (ไม่ให้ process ตาย)
  const rawOn = socket.on.bind(socket);
  socket.on = (ev, fn) => rawOn(ev, (...args) => {
    if (LEGACY_EV.has(ev)) return;                                           // โลกเก่า (side-scroller) ไม่มี client ใช้แล้ว → ปิด กันโกง
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
  td.onConnection(socket);
  worldBoss.onConnection(socket);
  market.onConnection(socket);
  socket.on('td:enter', () => { const p = players.get(socket.id); if (p && p.world !== 'td') socket.broadcast.emit('player:left', p.id); });   // ออกจากสายตาผู้เล่นโลกเดิม (ครั้งแรกเท่านั้น · ส่งซ้ำ = สแปม)
  const me = () => players.get(socket.id);

  // 1) เข้าโลก: ยืนยันตัวตนด้วย token → โหลดตัวละครจากฐานข้อมูล (server ถือข้อมูลจริง)
  socket.on('player:join', async (data = {}) => {
    if (players.has(socket.id) || socket.data.joining) return;
    socket.data.joining = true;
    try {
      const store = await storeReady;
      const acc = typeof data.token === 'string' && data.token ? await store.getSession(data.token) : null;
      if (!acc) return socket.emit('player:rejected', { reason: 'auth', msg: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' });
      if (joiningAcc.has(acc.id)) return socket.emit('player:rejected', { reason: 'busy', msg: 'บัญชีนี้กำลังเข้าเกมอยู่ ลองใหม่อีกครั้ง' });
      joiningAcc.add(acc.id); socket.data.joinAcc = acc.id;
      // บัญชีเดียวกันเข้าจากที่อื่น → เตะเครื่องเก่า (เซฟก่อน)
      const slot = Number.isInteger(data.slot) && data.slot >= 0 && data.slot < MAX_SLOTS ? data.slot : 0;
      const oldId = byAcc.get(acc.id), old = oldId && players.get(oldId);
      let save = null;
      if (old) {
        if ((old.slot || 0) === slot) save = old.save;          // ตัวเดียวกัน → ใช้ข้อมูลล่าสุดในหน่วยความจำ (ตัวอื่น: leave() เซฟให้ก่อน)
        io.to(oldId).emit('player:kicked', { msg: 'บัญชีนี้เข้าเกมจากเครื่องอื่น' });
        await leave(oldId);
        io.sockets.sockets.get(oldId)?.disconnect(true);
      }
      if (!socket.connected) return;
      await (saving.get(acc.id) || Promise.resolve());                    // รอเซฟครั้งก่อนเขียนเสร็จก่อนโหลด
      const pend = unsaved.get(`${acc.id}:${slot}`);
      save = migrate(save || pend || (await store.getCharacter(acc.id, slot)));
      if (pend) { unsaved.delete(`${acc.id}:${slot}`); }
      if (!save) return socket.emit('player:rejected', { reason: 'nochar', msg: 'ยังไม่มีตัวละคร' });
      const p = {
        id: socket.id, acc: acc.id, slot, admin: isAdmin(acc.username), save, char: save,
        name: save.name, appearance: save.appearance, appKey: JSON.stringify(save.appearance),
        x: WORLD.spawnX, y: WORLD.spawnY, ...startPos(data),
        anim: 'idle', flipX: false, level: save.level, maxHp: 1, buffs: [], sess: keepSess(`${acc.id}:${slot}`),
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
        selfId: socket.id, serverTime: Date.now(), online: players.size, dayMs: DAY_MS, admin: p.admin,
        players: [...players.values()].filter((q) => q.id !== socket.id && q.world !== 'td').map(publicPlayer),
      });
      socket.broadcast.emit('player:joined', publicPlayer(p));
      social.onJoin(p);
      worldBoss.onJoin(p);
      ranking.apply(p);                 // ฉายาอันดับ: ตรวจตามอันดับล่าสุด (หลุดอันดับตอนออฟไลน์ = ถอด)
      onlineSoon();
      if (save.cardsReturned) {                                           // ปรับช่องการ์ด: การ์ดที่ใส่ผิดช่องคืนเข้ากระเป๋าแล้ว → แจ้งผู้เล่น
        const n = save.cardsReturned; delete save.cardsReturned; p.dirty = true;
        setTimeout(() => socket.emit('chat', { id: null, name: '🃏 การ์ด', text: `ระบบการ์ดปรับช่องใหม่ (หมวก/ถุงมือ/รองเท้า/เข็มขัด) · การ์ด ${n} ใบที่ช่องเปลี่ยนถูกคืนเข้ากระเป๋าแล้ว ใส่ใหม่ได้ฟรีที่สมุดการ์ด (O)` }), 4000);
      }
      if (pend || p.dirty) { p.dirty = true; persist(p); }
    } finally { socket.data.joining = false; if (socket.data.joinAcc) { joiningAcc.delete(socket.data.joinAcc); socket.data.joinAcc = null; } }
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
      if (!to || to.noTravel || !canTravelFrom(p.x) || p.level < (to.minLv || 1) || p.dead) return reject();
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
    if (p.world !== 'td' && !PRE_TD_ACTIONS.has(a)) return done({ r: { ok: false, msg: 'รอเข้าสู่โลกให้เสร็จก่อน' } });   // ค้างโลกเก่า = ใช้ x ปลอมเปิดร้าน/ส่งเควสจากที่ไหนก็ได้
    if ((p.save.karma || 0) > 0 && (['buy', 'buyback', 'recall'].includes(a) || (a === 'craft' && d.list === 'barter') || (a === 'use' && String(d.id || '').startsWith('yant_home'))))   // หัวแดง: ร้านไม่ขาย · วาร์ปกลับเมืองไม่ได้
      return done({ r: { ok: false, msg: `☠️ หัวแดง (บาป ${p.save.karma}): ร้านไม่ขายให้ และวาร์ปกลับเมืองไม่ได้ · บาปลด 5/นาทีที่ออนไลน์` } });
    if (p.dead && !['lock', 'hotbar', 'title', 'qDrop', 'friendDel', 'cosAck', 'statsAck', 'spAck'].includes(a)) return done({ r: { ok: false, msg: 'ตายอยู่ – รอฟื้นก่อน' } });
    // โลก top-down: ร้าน/NPC ตรวจจากตำแหน่ง NPC ในอยุธยา (แปลงเป็นพิกัดหมู่บ้านเดิม) · ไม่ใกล้ใคร = นอกหมู่บ้าน
    const ex = p.world === 'td' ? (td.econX(p) ?? MAPS.m1.minX + 700) : p.x;
    if (p.world === 'td' && a === 'recall' && d.to === 'hunt') return done({ r: { ok: false, msg: 'ในโลกใหม่ใช้ได้เฉพาะวาร์ปกลับเมือง' } });
    // MP เป็นของ client: รับค่าล่าสุดมาก่อนรันคำสั่ง (เช่น ดื่มยา MP) แล้วส่งค่าหลังรันกลับไป
    takeMp(p, d.mp);
    const tdCtx = p.world === 'td' ? { td: true, tdNpc: td.npcNear(p), tdPos: td.mapOf(p) === 'ayutthaya' ? { x: p.tx, y: p.ty } : { x: -1e6, y: -1e6 }, tdFish: td.nearWater(p), tdMap: td.mapOf(p) } : {};   // สมุนไพรมีเฉพาะกรุงศรีฯ
    const r = runAction(p.save, a, d, { rnd: Math.random, now, x: ex, night: nightNow(), admin: p.admin, trade: !!p.tradeId, sess: p.sess, ...tdCtx });
    if (r.warp && r.ok && p.world !== 'td') {
      if (r.warp === 'home') warpTo(p, MAPS.village, MAPS.village.arriveX);
      else if (r.warp === 'return') warpTo(p, MAPS[r.to], MAPS[r.to].respawnX);
      if (mapAt(p.x).id !== 'dungeon') dungeon.leave(p, 'recall');
      r.x = Math.round(p.x);
    }
    if (r.warp === 'home' && r.ok && p.world === 'td') td.warpHome(p, socket);   // ยันต์คืนถิ่นในโลกใหม่ → ลานน้ำพุกลางเมือง
    if (r.ok && (r.potion || r.ate || r.flask) && p.world === 'td') socket.to(td.room(p)).emit('td:fx', { id: p.id, kind: r.kind, big: !!r.flask });   // คนอื่นเห็นเอฟเฟกต์ดื่มยา
    if (a === 'title' && r.ok) io.emit('td:title', { id: p.id, title: p.save.title || null });
    if (a === 'preset' && r.ok) p.hpDirty = true;                               // สลับชุด: HP สูงสุดเปลี่ยน → ส่ง HP ใหม่ให้ปาร์ตี้/ตัวเอง   // ฉายาเหนือชื่อ → ทุกคนเห็นทันที
    if (a === 'fishLand' && r.ok && r.legend) io.emit('chat', { id: null, name: '🎣 ตำนาน', text: `${p.name} ตกได้ ${ITEMS[r.id]?.nameTh || 'ปลาตำนาน'}!! นักตกปลาทั้งเซิร์ฟตะลึง` });   // ปลาตำนานประกาศทั้งเซิร์ฟ
    if (a === 'enhance' && r.slot && r.lv >= 10 && r.success) io.emit('chat', { id: null, name: '🔨 ลุงดำ', text: `${p.name} ตีบวกสำเร็จ +${r.lv}!` });
    refresh(p);
    if (r.ok && r.gmWarp && p.admin && p.world === 'td') td.gmWarp(p, socket, r.gmWarp);
    if (r.ok && r.gmRahu && p.admin) r.msg = worldBoss.gm(r.gmRahu);
    if (r.ok && r.gmMerchant && p.admin) r.msg = market.gm(r.gmMerchant);
    if (r.ok && r.gmNotice && p.admin) gmNotice(r.gmNotice, p);
    if (r.ok && r.gmSrv && p.admin) { const g = gmServer(p, r.gmSrv); r.ok = g.ok !== false; r.msg = g.msg; }
    if (r.ok && r.hpPct != null && p.admin) {                                   // GM: ตั้ง HP / สลบ (ทดสอบหมอยา)
      p.invulnUntil = 0;
      if (r.hpPct <= 0) hurtPlayer(p, p.hp + 1, { force: true, gm: true });
      else { p.hp = Math.max(1, p.maxHp * r.hpPct / 100); p.hpDirty = true; }
    }
    p.syncDue = false;
    done({ r, s: packChar(p.save), mp: p.save.mp });
    if (r.titles?.length) social.announceTitles(p, r.titles);
  });

  // 4) ใช้สกิล: server จำบัฟ/ฮีล/อมตะตอนพุ่ง เอง + กระจายให้ผู้เล่นอื่นเห็นเอฟเฟกต์
  socket.on('skill:cast', (d = {}) => {
    const p = me();
    const base = SKILL_BY_ID[d.skillId];
    const now = Date.now();
    if (!p || !base || p.dead) return;
    if (base.type === 'passive') return;                                // สกิลติดตัว: ไม่มีการร่าย
    if (!skillUsable(base, p.appearance.job)) return;
    const lv = p.save.skills?.[base.id] || 0;
    if (!lv || now - p.lastSkill < 150) return;
    const x = Number(d.x) || 0, y = Number(d.y) || 0, td = p.world === 'td';
    if (Math.abs(x - (td ? p.tx : p.x)) > 120 || Math.abs(y - (td ? p.ty : p.y)) > 120) return;
    const skx = (p.save.skx ||= {}), m0 = skillMastery(skx[base.id] || 0).m;
    const sk = skillStats(base, lv, m0);
    p.skillAt ||= {};
    if (now - (p.skillAt[base.id] || 0) < skillCooldown(sk.cd, getDerived(p.save).castRed) * 0.8) return;         // คูลดาวน์ (server) · DEX ลดได้
    const cost = sk.mp || 0;                                            // MP: server ถือค่าจริง (client แจ้งได้แค่ต่ำกว่า)
    if (cost && (p.save.mp || 0) < cost * 0.85) return;
    p.save.mp = Math.max(0, (p.save.mp || 0) - cost);
    (p.castTok ||= {})[base.id] = { at: now, mobs: new Map() };        // ใบอนุญาตตีของการร่ายครั้งนี้ (td:hit ต้องมี)
    p.skillAt[base.id] = now;
    p.lastSkill = now;
    skx[base.id] = Math.min(99999, (skx[base.id] || 0) + 1);                   // ความชำนาญสกิล: ยิ่งใช้ยิ่งเก่ง
    const m1 = skillMastery(skx[base.id]).m;
    if (m1 > m0) { queueSync(p); socket.emit('chat', { id: null, name: '✨ ชำนาญ', text: `${base.nameTh} ชำนาญขึ้นเป็นขั้น ${m1}! (แรงขึ้น +${m1 * 2}% · คูลดาวน์ −${m1}%)` }); }
    else p.dirty = true;
    if (sk.type === 'buff') {
      p.buffs = (p.buffs || []).filter((b) => b.until > now && b.sk !== base.id);
      p.buffs.push({ buff: sk.buff, until: now + sk.duration, sk: base.id, at: now, lv: clamp(lv, 1, MAX_SKILL_LV), from: p.name, fromId: p.id });
      if (sk.heal) healPlayer(p, p.maxHp * sk.heal);
      if (sk.mpHeal) p.save.mp = Math.min(p.maxMp || 1e9, (p.save.mp || 0) + (p.maxMp || 0) * sk.mpHeal);
    } else if (sk.type === 'party') {                                   // สกิลปาร์ตี้: ตัวเอง + เพื่อนร่วมปาร์ตี้ในรัศมี
      const party = social.partyOf(p);
      const list = [p, ...(party ? [...party.members].filter((id) => id !== p.id).map((id) => players.get(id)).filter(Boolean) : [])];
      for (const m of list) {
        if (m.dead || (m.world || 'td') !== (p.world || 'td') || (td && tdSys.mapOf(m) !== tdSys.mapOf(p))) continue;
        const mx = td ? m.tx : m.x, my = td ? m.ty : m.y;
        if (m !== p && Math.hypot(mx - x, my - y) > (sk.radius || 220) + 40) continue;
        m.buffs = (m.buffs || []).filter((b) => b.until > now && b.sk !== base.id);
        m.buffs.push({ buff: sk.buff, until: now + sk.duration, sk: base.id, at: now, lv: clamp(lv, 1, MAX_SKILL_LV), from: p.name, fromId: p.id });
        if (sk.heal) healPlayer(m, m.maxHp * sk.heal);
        if (sk.mpHeal) m.save.mp = Math.min(m.maxMp || 1e9, (m.save.mp || 0) + (m.maxMp || 0) * sk.mpHeal);
        if (m !== p) io.to(m.id).emit('td:pbuff', { from: p.name, fromId: p.id, skillId: base.id, lv: clamp(lv, 1, MAX_SKILL_LV) });
      }
    } else if (sk.type === 'dash') { p.invulnUntil = Math.max(p.invulnUntil || 0, now + 320); p.dashExtra = (sk.distance || 100) + 40; p.dashUntil = now + 900; p.mvBudget = (p.mvBudget || 0) + p.dashExtra; }   // พุ่ง: ได้งบระยะเดินพิเศษ
    else if (base.job === 'healer') healer.cast(p, sk, d, now);
    (td ? socket.to(tdSys.room(p)) : socket.broadcast).emit('skill:cast', {
      id: p.id, skillId: base.id, lv: clamp(lv, 1, MAX_SKILL_LV),
      x: Math.round(x), y: Math.round(y), dir: d.dir === -1 ? -1 : 1,
      tx: Number.isFinite(d.tx) ? Math.round(d.tx) : null, ty: Number.isFinite(d.ty) ? Math.round(d.ty) : null,
    });
  });

  // 4.05) ใบเปลี่ยนชื่อ: ตรวจกติกา/ซ้ำ → ใช้ใบ → เปลี่ยนชื่อ · ชื่อเดิมกันไว้ให้บัญชีนี้ 7 วัน
  socket.on('char:rename', async (d = {}, cb) => {
    const reply = typeof cb === 'function' ? cb : () => {};
    const p = me();
    if (!p || !p.acc) return reply({ ok: false, msg: 'ยังไม่ได้เข้าเกม' });
    if (invCount(p.save, 'rename_ticket') <= 0) return reply({ ok: false, msg: 'ไม่มีใบเปลี่ยนชื่อ' });
    if (p.renaming) return reply({ ok: false, msg: 'กำลังเปลี่ยนชื่ออยู่' });
    if (p.tradeId) return reply({ ok: false, msg: 'ปิดหน้าต่างเทรดก่อน' });
    const chk = checkName(d.name, { admin: p.admin });
    if (!chk.ok) return reply({ ok: false, msg: chk.msg });
    const oldName = p.save.name, oldKey = p.save.nk || nameKey(oldName);
    if (chk.name === oldName) return reply({ ok: false, msg: 'เป็นชื่อเดิมอยู่แล้ว' });
    p.renaming = true;
    try {
      const store = await storeReady;
      if (chk.key !== oldKey && await store.nameTaken(chk.key, p.acc)) {
        const ideas = [];
        for (const n of nameIdeas(chk.name)) { if (ideas.length >= 4) break; const k = checkName(n); if (k.ok && !(await store.nameTaken(k.key, p.acc))) ideas.push(k.name); }
        return reply({ ok: false, msg: `ชื่อ “${chk.name}” มีคนใช้แล้ว`, ideas });
      }
      if (!removeItem(p.save, 'rename_ticket', 1)) return reply({ ok: false, msg: 'ไม่มีใบเปลี่ยนชื่อ' });
      p.save.name = chk.name; p.save.nk = chk.key; p.name = chk.name;
      try { await store.saveCharacter(p.acc, p.slot || 0, p.save); }
      catch (e) {
        p.save.name = oldName; p.save.nk = oldKey; p.name = oldName; (p.save.inventory ||= []).push({ id: 'rename_ticket', qty: 1 });
        return reply({ ok: false, msg: e.code === '23505' ? `ชื่อ “${chk.name}” เพิ่งมีคนใช้ไป` : 'เปลี่ยนชื่อไม่สำเร็จ' });
      }
      if (oldKey !== chk.key) await store.holdName?.(oldKey, p.acc);
      await store.releaseHold?.(chk.key);
      queueSync(p);
      social.friendRenamed(p.acc, oldName, chk.name);
      store.renameFriendRefs?.(p.acc, oldName, chk.name).catch((e) => console.error('[rename] friends', e.message));
      ranking.refresh();
      io.emit('player:rename', { id: p.id, name: chk.name, old: oldName, gm: !!p.admin });
      reply({ ok: true, name: chk.name });
    } finally { p.renaming = false; }
  });

  // 4.1) แชท (จำกัด 1 ข้อความ / 0.5 วินาที)
  socket.on('chat', (text) => {
    if (typeof text !== 'string') return;
    const p = me();
    if (!p || Date.now() - p.lastChat < 500) return;
    p.lastChat = Date.now();
    const msg = cleanText(text, 120);
    if (!msg) return;
    if (mutedLeft(p)) return socket.emit('chat', { id: null, name: '📢 ระบบ', text: `คุณถูกห้ามแชทอีก ${mutedLeft(p)} นาที` });
    const wm = msg.match(/^\/w\s+(\S+)\s+(.+)$/i);                              // /w ชื่อ ข้อความ = กระซิบ
    if (wm) {
      const t = [...players.values()].find((q) => String(q.name).toLowerCase().replace(/\s+#/, '#') === wm[1].toLowerCase());
      if (!t) return socket.emit('chat', { id: null, name: '📢 ระบบ', text: `ไม่พบผู้เล่นชื่อ "${wm[1]}" ที่ออนไลน์อยู่` });
      io.to(t.id).emit('chat', { id: p.id, name: `[กระซิบจาก ${p.name}]`, text: wm[2], whisper: true, from: p.name, nm: p.name, lv: p.save?.level, gm: !!p.admin });
      if (t.id !== p.id) socket.emit('chat', { id: p.id, name: `[กระซิบถึง ${t.name}]`, text: wm[2], whisper: true, to: t.name, toId: t.id, nm: p.name });
      return;
    }
    io.emit('chat', { id: p.id, name: p.name, text: msg, nm: p.name, lv: p.save?.level, title: p.save?.title || null, gm: !!p.admin });
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

/** จำนวนผู้เล่นออนไลน์ทั้งเซิร์ฟ → ส่งให้ทุกคน (รวมหลายการเปลี่ยนแปลงใน 1 วิ เป็นครั้งเดียว) */
let onlineT = null;
function onlineSoon() {
  if (onlineT) return;
  onlineT = setTimeout(() => { onlineT = null; io.emit('online:count', players.size); }, 1000);
}

/** ออกจากเกม: เซฟ → ลบออกจากโลก */
async function leave(id) {
  const p = players.get(id);
  if (!p) return;
  social.onDisconnect(id);
  dungeon.onDisconnect(id);
  td.onLeave(p);
  healer?.forget(id);
  players.delete(id);
  if (byAcc.get(p.acc) === id) byAcc.delete(p.acc);
  io.emit('player:left', id);
  onlineSoon();
  p.dirty = true;
  await persist(p);
}

// ============================================================
//  Game loop: snapshot · ผี · ฟื้น HP · ส่งสถานะ · เซฟอัตโนมัติ
// ============================================================
let tdTick = 0;
setInterval(() => {
  social.tick();
  dungeon.tick();
  if (players.size === 0) return;
  mobs.tick();
  if (++tdTick % 3 !== 0) td.tick();   // ~10 ครั้ง/วิ
  const snapshot = [...players.values()].filter((p) => p.world !== 'td').map((p) => ({
    id: p.id, x: Math.round(p.x), y: Math.round(p.y), anim: p.anim, flipX: p.flipX,
    hp: Math.round(p.hp), maxHp: p.maxHp, level: p.level, party: p.partyId, wp: p.wp || 0, inst: p.inst || 0,
  }));
  if (snapshot.length) io.except('td').volatile.emit('world:snapshot', { t: Date.now(), players: snapshot, boss: social.bossPublic() });   // โลก TD ไม่ใช้ snapshot นี้ → ไม่ส่ง (ลด egress)
  for (const p of players.values()) {
    flushSync(p);
    if (p.hpDirty) { p.hpDirty = false; io.to(p.id).emit('pl:hp', { hp: Math.round(p.hp), maxHp: p.maxHp }); }
  }
}, 1000 / TICK_RATE);

// ฟื้น HP: หมู่บ้าน/ข้างกองไฟ 5%/วิ · ที่อื่นช้า ๆ ถ้าไม่ได้โดนตีมา 8 วิ
setInterval(() => {
  const now = Date.now();
  for (const p of players.values()) {
    if (p.dead) continue;
    const m = mapAt(p.x), safe = p.world === 'td' ? td.inTown(p) : m.safe || (m.fireX != null && Math.abs(p.x - m.fireX) < 70);
    // MP ฝั่ง server ฟื้นเร็วกว่า client เล็กน้อย (เผื่อ lag) → client ที่เล่นปกติไม่โดนตัด · โกงแจ้ง MP เกินได้ไม่เกินค่านี้
    if (p.maxMp) p.save.mp = Math.min(p.maxMp, (p.save.mp || 0) + (1 + p.maxMp * (safe ? 0.06 : 0.02)) * 1.3);
    if (p.hp >= p.maxHp) continue;
    if (safe) healPlayer(p, p.maxHp * 0.05);
    else if (now - (p.lastHurt || 0) > 8000) healPlayer(p, p.maxHp * 0.01);
  }
}, 1000);

setInterval(() => { for (const p of players.values()) persist(p); }, 5000);

// ประกาศจาก GM: say = ข้อความถึงทุกคน · soon = นับถอยหลังอัปแพตช์ (แจ้งซ้ำ 5/3/1 นาที, 30/10 วิ) · cancel = ยกเลิก
let patchNotice = null;            // { at, text } ที่กำลังนับอยู่ (คนที่เพิ่งเข้าเกมก็ได้รับ)
const patchTimers = [];
/** ข่าวด่วนจาก GM (เก็บในฐานข้อมูล meta 'news') */
let liveNews = [];
storeReady.then((s) => announcePatch(s)).catch(() => {});
storeReady.then(async (s) => { try { liveNews = JSON.parse((await s.getMeta?.('news')) || '[]'); } catch { liveNews = []; } });
const saveNews = () => storeReady.then((s) => s.setMeta?.('news', JSON.stringify(liveNews))).catch(() => {});
function gmNotice(n, by) {
  if (n.kind === 'news') {
    const it = { id: `g${Date.now()}`, date: new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10), tag: 'gm', title: n.title, body: n.body || [], by: by?.name };
    liveNews = [it, ...liveNews].slice(0, 20); saveNews();
    io.emit('news:add', it);
    postNews(it);
    io.emit('server:notice', { kind: 'say', text: `📰 ${n.title}` });
    return;
  }
  if (n.kind === 'newsDel') { const [gone] = liveNews.splice(0, 1); saveNews(); if (gone) io.emit('news:del', gone.id); return; }
  if (n.kind === 'say') {
    io.emit('chat', { id: null, name: '📢 ประกาศ', text: n.text });
    io.emit('server:notice', { kind: 'say', text: n.text });
    return;
  }
  patchTimers.splice(0).forEach(clearTimeout);
  if (n.kind === 'cancel') {
    patchNotice = null;
    io.emit('server:notice', { kind: 'cancel' });
    io.emit('chat', { id: null, name: '📢 ประกาศ', text: 'ยกเลิกการอัปแพตช์แล้ว เล่นต่อได้ตามปกติ' });
    return;
  }
  const at = Date.now() + n.min * 60000;
  patchNotice = { at, text: n.text || '' };
  const say = (left) => io.emit('chat', { id: null, name: '📢 ประกาศ', text: `⚠️ เซิร์ฟเวอร์จะอัปแพตช์ในอีก ${left}${patchNotice?.text ? ` — ${patchNotice.text}` : ''} (ตัวละครเซฟอัตโนมัติ)` });
  io.emit('server:notice', { kind: 'soon', at, text: patchNotice.text });
  say(`${n.min} นาที`);
  for (const [ms, label] of [[300000, '5 นาที'], [180000, '3 นาที'], [60000, '1 นาที'], [30000, '30 วินาที'], [10000, '10 วินาที']]) {
    const wait = at - ms - Date.now();
    if (wait > 1000) patchTimers.push(setTimeout(() => say(label), wait));
  }
  patchTimers.push(setTimeout(() => { for (const p of players.values()) { p.dirty = true; persist(p); } }, Math.max(0, at - Date.now() - 5000)));   // เซฟทุกคนก่อนถึงเวลา
  console.log(`[gm] ${by?.name} ประกาศอัปแพตช์ใน ${n.min} นาที`);
}

/** นาทีที่ยังห้ามแชทเหลืออยู่ (0 = แชทได้) · เก็บในเซฟ ออก/เข้าใหม่ก็ยังโดน */
function mutedLeft(p) { const t = (p?.save?.muteUntil || 0) - Date.now(); return t > 0 ? Math.ceil(t / 60000) : 0; }

/** คำสั่ง GM ที่ต้องยุ่งกับผู้เล่นคนอื่น/ผีในแมพ (shared/economy.js ส่ง gmSrv มา) → { ok, msg } */
function gmServer(p, { cmd, rest = '' }) {
  const args = rest.trim().split(/\s+/).filter(Boolean);
  const find = (name) => {
    const k = String(name || '').toLowerCase().replace(/\s+#/, '#');
    return k ? [...players.values()].find((q) => String(q.name).toLowerCase().replace(/\s+#/, '#') === k) : null;
  };
  const need = (usage) => {
    const t = find(args[0]);
    return t ? { t } : { err: { ok: false, msg: args[0] ? `ไม่พบผู้เล่นชื่อ "${args[0]}" ที่ออนไลน์อยู่` : `ใช้: ${usage}` } };
  };
  const mapName = (q) => { const id = td.mapOf(q); return td.world(id)?.M?.nameTh || id; };
  const log = (s) => console.log(`[gm] ${p.name}: ${s}`);
  const sys = (t, text) => io.to(t.id).emit('chat', { id: null, name: '🛠️ GM', text });
  switch (cmd) {
    case 'who': {
      const list = [...players.values()].sort((a, b) => (b.level || 0) - (a.level || 0));
      return { msg: `ออนไลน์ ${list.length} คน: ${list.map((q) => `${q.name} Lv.${q.level} @${mapName(q)}${q.dead ? ' 💀' : ''}`).join(' · ')}` };
    }
    case 'goto': case 'summon': {
      const { t, err } = need(`/gm ${cmd} <ชื่อ>`); if (err) return err;
      if (t === p) return { ok: false, msg: 'ใส่ชื่อผู้เล่นคนอื่น' };
      const [from, to] = cmd === 'goto' ? [t, p] : [p, t];
      if (!td.gmTeleport(to, td.mapOf(from), { x: from.tx, y: from.ty })) return { ok: false, msg: 'วาร์ปไม่ได้ (ต้องอยู่ในโลก top-down ทั้งคู่)' };
      if (cmd === 'summon') sys(t, `คุณถูก GM ${p.name} เรียกตัว`);
      log(`${cmd} ${t.name}`);
      return { msg: cmd === 'goto' ? `วาร์ปไปหา ${t.name} (${mapName(t)})` : `ดึง ${t.name} มาหาแล้ว` };
    }
    case 'kick': {
      const { t, err } = need('/gm kick <ชื่อ> [เหตุผล]'); if (err) return err;
      if (t.admin) return { ok: false, msg: 'เตะแอดมินด้วยกันไม่ได้' };
      const why = args.slice(1).join(' ').slice(0, 100);
      io.to(t.id).emit('server:update', { msg: `คุณถูกเตะออกจากเกมโดย GM${why ? ` · ${why}` : ''}` });
      setTimeout(() => io.sockets.sockets.get(t.id)?.disconnect(true), 300);
      log(`kick ${t.name} ${why}`);
      return { msg: `เตะ ${t.name} ออกแล้ว` };
    }
    case 'mute': case 'unmute': {
      const { t, err } = need(`/gm ${cmd} <ชื่อ>${cmd === 'mute' ? ' [นาที]' : ''}`); if (err) return err;
      const min = cmd === 'mute' ? Math.max(1, Math.min(10080, Number(args[1]) || 10)) : 0;
      t.save.muteUntil = min ? Date.now() + min * 60000 : 0; t.dirty = true;
      sys(t, min ? `คุณถูกห้ามแชท ${min} นาที` : 'คุณแชทได้ตามปกติแล้ว');
      log(`${cmd} ${t.name} ${min || ''}`);
      return { msg: min ? `ห้าม ${t.name} แชท ${min} นาที` : `ปลดห้ามแชท ${t.name} แล้ว` };
    }
    case 'god':
      p.god = !p.god;
      return { msg: p.god ? 'เปิดโหมดอมตะ (ไม่โดนดาเมจ · ออกเกมแล้วหาย)' : 'ปิดโหมดอมตะ' };
    case 'killall': {
      const n = td.gmKillAll(p);
      return { msg: n ? `ฆ่าผีในแมพนี้ ${n} ตัว` : 'ไม่มีผีให้ฆ่าในแมพนี้' };
    }
    case 'give': {                                                            // ชดเชยของ/เงินให้ผู้เล่นคนอื่น
      const { t, err } = need('/gm give <ชื่อ> <gold|itemId> [จำนวน]'); if (err) return err;
      const what = args[1], c = t.save;
      if (!what) return { ok: false, msg: 'ใช้: /gm give <ชื่อ> <gold|itemId> [จำนวน]' };
      let got;
      if (what.toLowerCase() === 'gold') {
        const n = Math.max(1, Math.floor(Number(args[2]) || 0)); if (!Number(args[2])) return { ok: false, msg: 'ใส่จำนวนเงิน' };
        c.gold = Math.min(999999999, (c.gold || 0) + n); got = `฿${n.toLocaleString()}`;
      } else {
        const id = ITEMS[what] ? what : Object.keys(ITEMS).find((k) => ITEMS[k].nameTh === what);
        if (!id) return { ok: false, msg: `ไม่พบไอเทม "${what}" (ใช้ /gm find เพื่อหา id)` };
        const n = Math.max(1, Math.min(9999, Math.floor(Number(args[2]) || 1)));
        addItem(c, id, n); got = `${ITEMS[id].nameTh} x${n}`;
      }
      refresh(t); queueSync(t); persist(t);
      sys(t, `ได้รับ ${got} จาก GM`);
      log(`give ${t.name} ${got}`);
      return { msg: `ให้ ${t.name}: ${got}` };
    }
    case 'pk': return { msg: social.pkGm(String(args[0] || '').toLowerCase()) };   // /gm pk on|off
    case 'karma': {                                                           // /gm karma <ชื่อ> [ค่า] · ไม่ใส่ค่า = ล้างบาป
      const { t, err } = need('/gm karma <ชื่อ> [ค่า]'); if (err) return err;
      social.setKarma(t, Math.max(0, Math.floor(Number(args[1]) || 0)));
      log(`karma ${t.name} ${t.save.karma}`);
      return { msg: `บาปของ ${t.name} → ${t.save.karma}` };
    }
    case 'market': {
      const s = market.stats();
      return { msg: `ตลาด: ฝากขาย ${s.listings} · ป้ายรับซื้อ ${s.orders} · กล่องรับของ ${s.boxes} · พ่อค้าเร่ ${s.travel ? 'อยู่ในเมือง' : 'ไม่อยู่'}` };
    }
  }
  return { ok: false, msg: 'ไม่รู้จักคำสั่งนี้' };
}

// ปิด server (deploy ใหม่) → เซฟทุกคนก่อน
async function shutdown() {
  console.log('[server] shutting down – saving players');
  io.emit('server:update', { msg: 'เซิร์ฟเวอร์กำลังอัปเดตแพตช์ใหม่ · ตัวละครเซฟแล้ว · อีกสักครู่จะเชื่อมต่อใหม่เอง' });
  await Promise.all([...players.values()].map((p) => { p.dirty = true; return persist(p); }));
  await market.flush();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

httpServer.listen(PORT, () => {
  console.log(`ThaiNative Online server running → http://localhost:${PORT}`);
});
