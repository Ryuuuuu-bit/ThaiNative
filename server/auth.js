// ============================================================
//  Auth API – ล็อกอิน / สมัคร / Guest / เชื่อม ID / เซฟตัวละครบน server
//  ▸ ส่ง token ผ่าน header  Authorization: Bearer <token>
// ============================================================
import express from 'express';
import { createStore, hashPassword, verifyPassword, MAX_SLOTS } from './store.js';
import { newCharacter, migrate, hotbarItemOk } from '../shared/charmodel.js';
import { runAction } from '../shared/economy.js';
import { MAX_LEVEL } from '../shared/stats.js';
import { checkName, nameIdeas } from '../shared/data/names.js';

const USER_RE = /^[A-Za-z0-9_฀-๿]{3,20}$/;       // อังกฤษ/ตัวเลข/_/ไทย 3–20 ตัว
const MAX_CHAR_BYTES = 128 * 1024;
// บัญชีแอดมิน (GM): ตั้งค่า env ADMIN_IDS="ชื่อ1,ชื่อ2" → ใช้คำสั่ง /gm ในเกมได้
const ADMIN_IDS = new Set(String(process.env.ADMIN_IDS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
/** ชื่อแนะนำที่ยังว่าง (สูงสุด 4) */
async function freeIdeas(store, name, accountId) {
  const out = [];
  for (const n of nameIdeas(name)) { if (out.length >= 4) break; const k = checkName(n); if (k.ok && !(await store.nameTaken(k.key, accountId))) out.push(k.name); }
  return out;
}

export const isAdmin = (username) => !!username && ADMIN_IDS.has(String(username).toLowerCase());

export function setupAuth(app, hooks = {}) {
  const storeReady = createStore();
  const live = (accId) => hooks.onlineChar?.(accId) || null;       // { slot, save } ตัวละครที่กำลังออนไลน์ (server ถือข้อมูลล่าสุด)
  const slotArg = (v) => { const n = Number(v); return Number.isInteger(n) && n >= 0 && n < MAX_SLOTS ? n : -1; };
  /** ตัวละครทุกช่อง (ช่องที่ออนไลน์อยู่ใช้ข้อมูลล่าสุดจาก server) */
  const listChars = async (store, accId) => {
    const list = await store.getCharacters(accId), on = live(accId);
    if (on) list[on.slot] = on.save;
    return list;
  };
  const api = express.Router();
  api.use(express.json({ limit: '200kb' }));

  // จำกัดการลองรหัสผ่าน/สมัคร: 30 ครั้ง / 10 นาที / IP
  const hits = new Map();
  const limited = (req, res, next) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '?';
    const now = Date.now(), h = hits.get(ip) || { n: 0, t: now };
    if (now - h.t > 600000) { h.n = 0; h.t = now; }
    h.n++; hits.set(ip, h);
    if (h.n > 30) return res.status(429).json({ error: 'ลองบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่' });
    next();
  };

  const wrap = (fn) => async (req, res) => {
    try { req.store = await storeReady; await fn(req, res); }
    catch (e) { console.error('[auth]', e); res.status(500).json({ error: 'เซิร์ฟเวอร์ขัดข้อง ลองใหม่อีกครั้ง' }); }
  };
  const auth = (fn) => wrap(async (req, res) => {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const acc = token && (await req.store.getSession(token));
    if (!acc) return res.status(401).json({ error: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' });
    req.account = acc; req.token = token;
    await fn(req, res);
  });
  const pub = (a) => ({ id: a.id, guest: !!a.is_guest, username: a.username || null, display: a.username || `Guest#${a.id}`, admin: isAdmin(a.username) });
  const checkCreds = (body) => {
    const username = String(body?.username || '').trim(), password = String(body?.password || '');
    if (!USER_RE.test(username)) return { error: 'ชื่อผู้ใช้ต้องยาว 3–20 ตัว ใช้ได้เฉพาะอังกฤษ ไทย ตัวเลข และ _' };
    if (password.length < 6 || password.length > 64) return { error: 'รหัสผ่านต้องยาว 6–64 ตัวอักษร' };
    return { username, password };
  };
  const withSession = async (req, acc) => {
    await req.store.touch(acc.id);
    const characters = await listChars(req.store, acc.id);
    return { token: await req.store.createSession(acc.id), account: pub(acc), characters, maxSlots: MAX_SLOTS };
  };

  // เล่นแบบ Guest: สร้างบัญชีชั่วคราว (เชื่อม ID ภายหลังได้)
  api.post('/guest', limited, wrap(async (req, res) => {
    const acc = await req.store.createGuest();
    res.json(await withSession(req, acc));
  }));

  api.post('/register', limited, wrap(async (req, res) => {
    const c = checkCreds(req.body);
    if (c.error) return res.status(400).json(c);
    try {
      const acc = await req.store.createUser(c.username, hashPassword(c.password));
      res.json(await withSession(req, acc));
    } catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: 'ชื่อผู้ใช้นี้ถูกใช้แล้ว' });
      throw e;
    }
  }));

  api.post('/login', limited, wrap(async (req, res) => {
    const username = String(req.body?.username || '').trim(), password = String(req.body?.password || '');
    const acc = username && (await req.store.findUser(username));
    if (!acc || !verifyPassword(password, acc.pass_hash)) return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    res.json(await withSession(req, acc));
  }));

  // เชื่อม ID: เปลี่ยนบัญชี Guest เป็นบัญชีถาวร (ตัวละครเดิมอยู่ครบ)
  api.post('/link', limited, auth(async (req, res) => {
    if (!req.account.is_guest) return res.status(400).json({ error: 'บัญชีนี้เชื่อม ID แล้ว' });
    const c = checkCreds(req.body);
    if (c.error) return res.status(400).json(c);
    try {
      const acc = await req.store.linkGuest(req.account.id, c.username, hashPassword(c.password));
      if (!acc) return res.status(400).json({ error: 'เชื่อม ID ไม่สำเร็จ' });
      res.json({ account: pub(acc) });
    } catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: 'ชื่อผู้ใช้นี้ถูกใช้แล้ว' });
      throw e;
    }
  }));

  api.get('/me', auth(async (req, res) => {
    res.json({ account: pub(req.account), characters: await listChars(req.store, req.account.id), maxSlots: MAX_SLOTS });
  }));

  // สร้างตัวละครใหม่ลงช่องว่าง: server สร้างเองจากชื่อ + รูปลักษณ์ (client ส่งค่าพลัง/ของ/เงินมาเองไม่ได้)
  api.post('/character/new', limited, auth(async (req, res) => {
    const { name, appearance, weapon } = req.body || {};
    const slot = req.body?.slot === undefined ? 0 : slotArg(req.body.slot);
    if (slot < 0 || typeof name !== 'string' || !appearance || typeof appearance !== 'object') return res.status(400).json({ error: 'ข้อมูลตัวละครไม่ถูกต้อง' });
    if (live(req.account.id)) return res.status(409).json({ error: 'บัญชีนี้กำลังออนไลน์อยู่ที่อื่น' });
    if (await req.store.getCharacter(req.account.id, slot)) return res.status(409).json({ error: 'ช่องนี้มีตัวละครอยู่แล้ว' });
    // ชื่อแบบ Ragnarok: ห้ามซ้ำทั้งเซิร์ฟเวอร์ (ไม่เติมเลขให้) · ซ้ำ → ตอบกลับพร้อมชื่อแนะนำ
    const chk = checkName(name);
    if (!chk.ok) return res.status(400).json({ error: chk.msg });
    if (await req.store.nameTaken(chk.key, req.account.id)) return res.status(409).json({ error: `ชื่อ “${chk.name}” มีคนใช้แล้ว`, ideas: await freeIdeas(req.store, chk.name, req.account.id) });
    const c = newCharacter(chk.name, appearance);
    c.name = chk.name; c.nk = chk.key;
    if (typeof weapon === 'string') runAction(c, 'equip', { id: weapon });
    try { await req.store.saveCharacter(req.account.id, slot, c); }
    catch (e) { if (e.code === '23505') return res.status(409).json({ error: `ชื่อ “${chk.name}” เพิ่งมีคนใช้ไป ลองชื่ออื่น`, ideas: await freeIdeas(req.store, chk.name, req.account.id) }); throw e; }
    await req.store.releaseHold?.(chk.key);
    res.json({ character: c, slot });
  }));

  // ตรวจชื่อระหว่างพิมพ์ (หน้าสร้างตัวละคร/ใบเปลี่ยนชื่อ) → { ok, msg, ideas }
  api.get('/name/check', auth(async (req, res) => {
    const chk = checkName(req.query?.name);
    if (!chk.ok) return res.json({ ok: false, msg: chk.msg, ideas: [] });
    if (await req.store.nameTaken(chk.key, req.account.id)) return res.json({ ok: false, msg: `ชื่อ “${chk.name}” มีคนใช้แล้ว`, ideas: await freeIdeas(req.store, chk.name, req.account.id) });
    res.json({ ok: true, msg: `ชื่อ “${chk.name}” ใช้ได้`, ideas: [] });
  }));

  // ลบตัวละคร: ต้องพิมพ์ชื่อตัวละครยืนยัน
  api.post('/character/delete', limited, auth(async (req, res) => {
    const slot = slotArg(req.body?.slot), name = String(req.body?.name ?? '').trim();
    if (slot < 0) return res.status(400).json({ error: 'ช่องไม่ถูกต้อง' });
    if (live(req.account.id)) return res.status(409).json({ error: 'บัญชีนี้กำลังออนไลน์อยู่ที่อื่น' });
    const cur = await req.store.getCharacter(req.account.id, slot);
    if (!cur) return res.status(404).json({ error: 'ช่องนี้ไม่มีตัวละคร' });
    if (name.toLowerCase() !== String(cur.name).trim().toLowerCase()) return res.status(400).json({ error: 'ชื่อที่พิมพ์ยืนยันไม่ตรงกับชื่อตัวละคร' });
    await req.store.deleteCharacter(req.account.id, slot);
    await req.store.holdName?.(cur.nk || checkName(cur.name).key, req.account.id);     // กันชื่อไว้ให้บัญชีนี้ 7 วัน
    res.json({ ok: true });
  }));

  // เซฟจาก client (เวอร์ชันเก่า/ปิดแท็บ): รับเฉพาะ Hotbar – ของ/เงิน/เลเวล server เป็นคนเซฟเองเท่านั้น
  api.put('/character', auth(async (req, res) => {
    const data = req.body?.character;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return res.status(400).json({ error: 'ข้อมูลตัวละครไม่ถูกต้อง' });
    if (Buffer.byteLength(JSON.stringify(data)) > MAX_CHAR_BYTES) return res.status(413).json({ error: 'ข้อมูลตัวละครใหญ่เกินไป' });
    if (live(req.account.id)) return res.json({ ok: true, ignored: true });
    const slot = Math.max(0, slotArg(req.body?.slot ?? 0));
    const cur = migrate(await req.store.getCharacter(req.account.id, slot));
    if (!cur) return res.status(404).json({ error: 'ยังไม่มีตัวละคร' });
    const hb = data.hotbar && typeof data.hotbar === 'object' ? data.hotbar : null;
    if (hb) for (const k of Object.keys(cur.hotbar)) if (hb[k] === null || (typeof hb[k] === 'string' && (cur.skills[hb[k]] > 0 || (hb[k].startsWith('it:') && hotbarItemOk(hb[k].slice(3)))))) cur.hotbar[k] = hb[k];
    await req.store.saveCharacter(req.account.id, slot, cur);
    res.json({ ok: true });
  }));

  // สถานะเซิร์ฟเวอร์ (หน้าเข้าเกม): จำนวนผู้เล่นออนไลน์
  api.get('/status', (req, res) => res.json({ ok: true, online: hooks.onlineCount?.() ?? 0 }));

  // ตารางอันดับ (สาธารณะ · แคช 30 วิ): เลเวลสูงสุด / ตีบวกสูงสุด
  let lbCache = null, lbAt = 0;
  api.get('/leaderboard', wrap(async (req, res) => {
    if (!lbCache || Date.now() - lbAt > 15000) {
      const rows = (await req.store.topCharacters(300)).filter((r) => r && r.name);
      const clean = rows.map((r) => {
        const enh = r.enhance || {}, eq = r.equipment || {};
        const best = Math.max(0, ...Object.entries(enh).filter(([slot]) => eq[slot]).map(([, v]) => +v || 0));
        return { name: String(r.name).slice(0, 21), level: Math.min(MAX_LEVEL, +r.level || 1), path: typeof r.path === 'string' ? r.path : null, title: typeof r.title === 'string' ? r.title : null, enh: Math.min(20, best) };
      });
      lbCache = {
        level: clean.slice(0, 20),
        enhance: [...clean].filter((r) => r.enh > 0).sort((a, b) => b.enh - a.enh || b.level - a.level).slice(0, 20),
      };
      lbAt = Date.now();
    }
    res.json(lbCache);
  }));

  api.post('/logout', auth(async (req, res) => {
    await req.store.deleteSession(req.token);
    res.json({ ok: true });
  }));

  app.use('/api', api);
  return storeReady;
}
