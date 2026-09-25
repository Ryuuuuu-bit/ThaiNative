// ============================================================
//  ThaiNative Online – Game Server
//  Express (เสิร์ฟไฟล์เกม) + Socket.io (ระบบ Multiplayer แบบ Real-time)
// ============================================================
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORLD } from '../shared/constants.js';
import { sanitizeAppearance } from '../shared/data/appearance.js';
import { SKILL_BY_ID, MAX_SKILL_LV } from '../shared/data/skills.js';
import { setupSocial } from './social.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 3000;
const TICK_RATE = 15; // ส่ง snapshot ให้ทุก client 15 ครั้ง/วินาที

const app = express();
app.use(express.static(path.join(ROOT, 'client')));
app.use('/shared', express.static(path.join(ROOT, 'shared')));
app.use('/vendor', express.static(path.join(ROOT, 'node_modules/phaser/dist')));

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

/** ข้อมูลผู้เล่นทั้งหมดในโลก  key = socket.id */
const players = new Map();
/** ปาร์ตี้ · เทรด · เรดบอส */
const social = setupSocial(io, players);

function publicPlayer(p) {
  return {
    id: p.id, name: p.name, appearance: p.appearance,
    x: p.x, y: p.y, anim: p.anim, flipX: p.flipX, hp: p.hp, maxHp: p.maxHp, level: p.level,
  };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const cleanText = (s, max) => String(s ?? '').replace(/[<>]/g, '').trim().slice(0, max);

io.on('connection', (socket) => {
  console.log(`[+] connect ${socket.id}`);
  social.onConnection(socket);

  // 1) ผู้เล่นเข้าโลก
  socket.on('player:join', (data = {}) => {
    const player = {
      id: socket.id,
      name: cleanText(data.name, 16) || 'ผู้กล้า',
      appearance: sanitizeAppearance(data.appearance),
      x: WORLD.spawnX, y: WORLD.spawnY,
      anim: 'idle', flipX: false, hp: 1, maxHp: 1, level: 1,
      lastUpdate: Date.now(), lastChat: 0, lastSkill: 0, partyId: null, tradeId: null,
    };
    players.set(socket.id, player);

    // ส่งสถานะโลกทั้งหมดให้คนที่เพิ่งเข้า
    socket.emit('world:init', {
      selfId: socket.id,
      players: [...players.values()].filter(p => p.id !== socket.id).map(publicPlayer),
    });
    // แจ้งคนอื่นว่ามีผู้เล่นใหม่
    socket.broadcast.emit('player:joined', publicPlayer(player));
  });

  // 2) client ส่งตำแหน่ง/ท่าทางของตัวเองมา (~15 ครั้ง/วินาที)
  socket.on('player:update', (s = {}) => {
    const p = players.get(socket.id);
    if (!p) return;
    const now = Date.now();
    const dt = Math.max(16, now - p.lastUpdate) / 1000;
    p.lastUpdate = now;

    // กันวาร์ป: จำกัดระยะทางสูงสุดต่อช่วงเวลา
    const maxStep = WORLD.maxSpeed * dt * 1.5 + 20;
    const nx = clamp(Number(s.x) || 0, 0, WORLD.width);
    const ny = clamp(Number(s.y) || 0, -200, WORLD.height);
    p.x += clamp(nx - p.x, -maxStep, maxStep);
    p.y += clamp(ny - p.y, -maxStep * 2, maxStep * 2);

    p.anim = ['idle', 'walk', 'attack', 'hit', 'die', 'jump'].includes(s.anim) ? s.anim : 'idle';
    p.flipX = !!s.flipX;
    p.hp = clamp(Number(s.hp) || 0, 0, 99999);
    p.maxHp = clamp(Number(s.maxHp) || 1, 1, 99999);
    p.level = clamp(Number(s.level) || 1, 1, 999);
  });

  // 3) เปลี่ยนรูปลักษณ์ / อาชีพ (เช่น ซื้อ Skin จากร้าน)
  socket.on('player:appearance', (appearance) => {
    const p = players.get(socket.id);
    if (!p) return;
    p.appearance = sanitizeAppearance(appearance);
    io.emit('player:appearance', { id: p.id, appearance: p.appearance });
  });

  // 4) ใช้สกิล (Q W E R T) → ตรวจสอบ แล้วกระจายให้ผู้เล่นอื่นเห็นเอฟเฟกต์
  socket.on('skill:cast', (d = {}) => {
    const p = players.get(socket.id);
    const sk = SKILL_BY_ID[d.skillId];
    const now = Date.now();
    if (!p || !sk) return;
    if (sk.job !== p.appearance.job) return;                  // ใช้ได้เฉพาะสกิลอาชีพตัวเอง
    if (now - p.lastSkill < 150) return;                       // กันสแปม
    const x = Number(d.x) || 0, y = Number(d.y) || 0;
    if (Math.abs(x - p.x) > 120 || Math.abs(y - p.y) > 120) return; // ตำแหน่งต้องใกล้ที่ server รู้
    p.lastSkill = now;
    socket.broadcast.emit('skill:cast', {
      id: p.id, skillId: sk.id,
      lv: clamp(Math.round(Number(d.lv) || 1), 1, MAX_SKILL_LV),
      x: Math.round(x), y: Math.round(y), dir: d.dir === -1 ? -1 : 1,
      tx: Number.isFinite(d.tx) ? Math.round(d.tx) : null, ty: Number.isFinite(d.ty) ? Math.round(d.ty) : null,
    });
  });

  // 4.1) แชท (จำกัด 1 ข้อความ / 0.5 วินาที)
  socket.on('chat', (text) => {
    const p = players.get(socket.id);
    if (!p || Date.now() - p.lastChat < 500) return;
    p.lastChat = Date.now();
    const msg = cleanText(text, 120);
    if (msg) io.emit('chat', { id: p.id, name: p.name, text: msg });
  });

  socket.on('disconnect', () => {
    console.log(`[-] disconnect ${socket.id}`);
    social.onDisconnect(socket.id);
    if (players.delete(socket.id)) io.emit('player:left', socket.id);
  });
});

// Game loop ฝั่ง server: broadcast snapshot ตำแหน่งทุกคน
setInterval(() => {
  social.tick();
  if (players.size === 0) return;
  const snapshot = [...players.values()].map(p => ({
    id: p.id, x: Math.round(p.x), y: Math.round(p.y), anim: p.anim, flipX: p.flipX,
    hp: p.hp, maxHp: p.maxHp, level: p.level, party: p.partyId,
  }));
  io.volatile.emit('world:snapshot', { t: Date.now(), players: snapshot, boss: social.bossPublic() });
}, 1000 / TICK_RATE);

httpServer.listen(PORT, () => {
  console.log(`ThaiNative Online server running → http://localhost:${PORT}`);
});
