// ============================================================
//  Auth API – ล็อกอิน / สมัคร / Guest / เชื่อม ID / เซฟตัวละครบน server
//  ▸ ส่ง token ผ่าน header  Authorization: Bearer <token>
// ============================================================
import express from 'express';
import { createStore, hashPassword, verifyPassword } from './store.js';

const USER_RE = /^[A-Za-z0-9_฀-๿]{3,20}$/;       // อังกฤษ/ตัวเลข/_/ไทย 3–20 ตัว
const MAX_CHAR_BYTES = 128 * 1024;
// บัญชีแอดมิน (GM): ตั้งค่า env ADMIN_IDS="ชื่อ1,ชื่อ2" → ใช้คำสั่ง /gm ในเกมได้
const ADMIN_IDS = new Set(String(process.env.ADMIN_IDS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
export const isAdmin = (username) => !!username && ADMIN_IDS.has(String(username).toLowerCase());

export function setupAuth(app) {
  const storeReady = createStore();
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
    return { token: await req.store.createSession(acc.id), account: pub(acc), character: await req.store.getCharacter(acc.id) };
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
    res.json({ account: pub(req.account), character: await req.store.getCharacter(req.account.id) });
  }));

  api.put('/character', auth(async (req, res) => {
    const data = req.body?.character;
    if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.name !== 'string' || !data.appearance)
      return res.status(400).json({ error: 'ข้อมูลตัวละครไม่ถูกต้อง' });
    if (Buffer.byteLength(JSON.stringify(data)) > MAX_CHAR_BYTES) return res.status(413).json({ error: 'ข้อมูลตัวละครใหญ่เกินไป' });
    await req.store.saveCharacter(req.account.id, data);
    res.json({ ok: true });
  }));

  // ตารางอันดับ (สาธารณะ · แคช 30 วิ): เลเวลสูงสุด / ตีบวกสูงสุด
  let lbCache = null, lbAt = 0;
  api.get('/leaderboard', wrap(async (req, res) => {
    if (!lbCache || Date.now() - lbAt > 30000) {
      const rows = (await req.store.topCharacters(300)).filter((r) => r && r.name);
      const clean = rows.map((r) => {
        const enh = r.enhance || {}, eq = r.equipment || {};
        const best = Math.max(0, ...Object.entries(enh).filter(([slot]) => eq[slot]).map(([, v]) => +v || 0));
        return { name: String(r.name).slice(0, 16), level: Math.min(30, +r.level || 1), path: typeof r.path === 'string' ? r.path : null, enh: Math.min(20, best) };
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
