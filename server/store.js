// ============================================================
//  Store – บัญชีผู้เล่น / Session / ตัวละคร
//  ▸ มี DATABASE_URL (Railway Postgres) → ใช้ PostgreSQL
//  ▸ ไม่มี (รันในเครื่อง) → เก็บในหน่วยความจำ (หายเมื่อปิด server)
// ============================================================
import crypto from 'node:crypto';

const SESSION_DAYS = 60;
/** จำนวนช่องตัวละครต่อบัญชี (แบบ RO) */
import { nameKey, NAME_HOLD_MS } from '../shared/data/names.js';
export const MAX_SLOTS = 3;
const slotOf = (v) => (Number.isInteger(+v) && +v >= 0 && +v < MAX_SLOTS ? +v : 0);
const toList = (rows) => { const out = Array(MAX_SLOTS).fill(null); for (const r of rows) if (r.slot >= 0 && r.slot < MAX_SLOTS) out[r.slot] = r.data; return out; };

// ---------------- รหัสผ่าน (scrypt + salt) ----------------
export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}
export function verifyPassword(pw, stored) {
  const [alg, saltHex, hashHex] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !saltHex || !hashHex) return false;
  const hash = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), 64);
  const want = Buffer.from(hashHex, 'hex');
  return want.length === hash.length && crypto.timingSafeEqual(want, hash);
}
const newToken = () => crypto.randomBytes(32).toString('base64url');

// ============================================================
//  PostgreSQL
// ============================================================
class PgStore {
  constructor(url) { this.url = url; }

  async init() {
    const { default: pg } = await import('pg');
    const ssl = /sslmode=require|proxy\.rlwy\.net/.test(this.url) ? { rejectUnauthorized: false } : false;
    this.pool = new pg.Pool({ connectionString: this.url, ssl, max: 5 });
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE,
        username_lower TEXT UNIQUE,
        pass_hash TEXT,
        is_guest BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_login TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL
      );
      CREATE TABLE IF NOT EXISTS characters (
        account_id INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );`);
    // หลายตัวละครต่อบัญชี: เพิ่มคอลัมน์ slot (ตัวเดิม = ช่อง 0) แล้วเปลี่ยน primary key เป็น (account_id, slot)
    await this.pool.query(`
      ALTER TABLE characters ADD COLUMN IF NOT EXISTS slot SMALLINT NOT NULL DEFAULT 0;
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.key_column_usage
                        WHERE table_name = 'characters' AND constraint_name = 'characters_pkey' AND column_name = 'slot') THEN
          ALTER TABLE characters DROP CONSTRAINT IF EXISTS characters_pkey;
          ALTER TABLE characters ADD PRIMARY KEY (account_id, slot);
        END IF;
      END $$;`);
    // ชื่อตัวละครห้ามซ้ำ (ไม่สนตัวพิมพ์เล็ก/ใหญ่) · ถ้ามีข้อมูลเก่าที่ซ้ำอยู่แล้วจะสร้าง index ไม่ได้ → ข้าม (ยังกันซ้ำตอนสร้างตัวใหม่)
    // รูปแบบเลขกันชื่อซ้ำเดิม "Ryuu#001" → "Ryuu #001"
    try { await this.pool.query("UPDATE characters SET data = jsonb_set(data, '{name}', to_jsonb(regexp_replace(data->>'name', '\\s*#([0-9]{3})$', ' #\\1'))) WHERE data->>'name' ~ '[^ ]#[0-9]{3}$'"); }
    catch (e) { console.error('[store] name tag format:', e.message); }
    try { await this.pool.query("CREATE UNIQUE INDEX IF NOT EXISTS characters_name_lower ON characters (lower(data->>'name'))"); }
    catch (e) { console.error('[store] unique name index:', e.message); }
    // ล้างข้อมูลผู้เล่นทั้งหมด (ครั้งเดียวต่อค่า): ตั้ง env RESET_ALL_DATA=<รหัสใหม่> แล้ว deploy
    const reset = String(process.env.RESET_ALL_DATA || '').trim();
    if (reset) {
      await this.pool.query('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)');
      const { rows } = await this.pool.query("SELECT value FROM meta WHERE key = 'reset'");
      if (rows[0]?.value !== reset) {
        await this.pool.query('TRUNCATE characters, sessions, accounts RESTART IDENTITY CASCADE');
        await this.pool.query("INSERT INTO meta (key, value) VALUES ('reset', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [reset]);
        console.log(`[store] RESET_ALL_DATA=${reset} → ล้างบัญชี/ตัวละคร/เซสชันทั้งหมดแล้ว`);
      }
    }
    await this.migrateNames();
    try { const r = await this.purgeDeleted(); console.log(`[store] purge: เพื่อนค้าง ${r.friends} ตัว · กันชื่อหมดอายุ ${r.holds} · เซสชันหมดอายุ ${r.sessions}`); }
    catch (e) { console.error('[store] purge:', e.message); }
    return this;
  }

  /** ชื่อแบบ Ragnarok (ครั้งเดียว): ตัดเลขท้าย " #001" ถ้าชื่อเปล่าว่าง · ชนกัน → ตัวแรก (บัญชีเก่าสุด) ได้ชื่อเปล่า ตัวอื่นคงเลขไว้ + ใบเปลี่ยนชื่อฟรี · เติม nk (กุญแจเทียบชื่อ) */
  async migrateNames() {
    await this.pool.query('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)');
    await this.pool.query('CREATE TABLE IF NOT EXISTS name_holds (key TEXT PRIMARY KEY, account_id INTEGER, until TIMESTAMPTZ NOT NULL)');
    const { rows: done } = await this.pool.query("SELECT value FROM meta WHERE key = 'names_v2'");
    if (!done[0]) {
      const { rows } = await this.pool.query('SELECT account_id, slot, data FROM characters ORDER BY account_id, slot');
      const plan = planNameMigration(rows.map((r) => ({ acc: r.account_id, slot: r.slot, data: r.data })));
      for (const r of plan) await this.pool.query('UPDATE characters SET data = $3 WHERE account_id = $1 AND slot = $2', [r.acc, r.slot, r.data]);
      await this.pool.query("INSERT INTO meta (key, value) VALUES ('names_v2', $1) ON CONFLICT (key) DO NOTHING", [String(plan.length)]);
      console.log(`[store] names_v2: ปรับชื่อ ${plan.length} ตัวละคร`);
    }
    try { await this.pool.query("CREATE UNIQUE INDEX IF NOT EXISTS characters_nk ON characters ((data->>'nk'))"); }
    catch (e) { console.error('[store] unique nk index:', e.message); }
  }
  /** ชื่อ (กุญแจ) ถูกใช้แล้ว หรือถูกกันไว้ให้บัญชีอื่น → true */
  async nameTaken(key, accountId) {
    const { rows } = await this.pool.query("SELECT 1 FROM characters WHERE data->>'nk' = $1 LIMIT 1", [key]);
    if (rows[0]) return true;
    const { rows: h } = await this.pool.query('SELECT account_id FROM name_holds WHERE key = $1 AND until > now()', [key]);
    return !!h[0] && h[0].account_id !== accountId;
  }
  async holdName(key, accountId) {
    await this.pool.query('INSERT INTO name_holds (key, account_id, until) VALUES ($1, $2, $3) ON CONFLICT (key) DO UPDATE SET account_id = EXCLUDED.account_id, until = EXCLUDED.until', [key, accountId, new Date(Date.now() + NAME_HOLD_MS)]);
  }
  async releaseHold(key) { await this.pool.query('DELETE FROM name_holds WHERE key = $1', [key]); }

  async createGuest() {
    const { rows } = await this.pool.query('INSERT INTO accounts (is_guest) VALUES (TRUE) RETURNING *');
    return rows[0];
  }
  async createUser(username, passHash) {
    const { rows } = await this.pool.query(
      'INSERT INTO accounts (username, username_lower, pass_hash, is_guest) VALUES ($1, $2, $3, FALSE) RETURNING *',
      [username, username.toLowerCase(), passHash]);
    return rows[0];
  }
  async findUser(username) {
    const { rows } = await this.pool.query('SELECT * FROM accounts WHERE username_lower = $1', [username.toLowerCase()]);
    return rows[0] || null;
  }
  async getAccount(id) {
    const { rows } = await this.pool.query('SELECT * FROM accounts WHERE id = $1', [id]);
    return rows[0] || null;
  }
  async linkGuest(id, username, passHash) {
    const { rows } = await this.pool.query(
      'UPDATE accounts SET username = $2, username_lower = $3, pass_hash = $4, is_guest = FALSE WHERE id = $1 AND is_guest = TRUE RETURNING *',
      [id, username, username.toLowerCase(), passHash]);
    return rows[0] || null;
  }
  async touch(id) { await this.pool.query('UPDATE accounts SET last_login = now() WHERE id = $1', [id]); }

  async createSession(accountId) {
    const token = newToken();
    await this.pool.query(`INSERT INTO sessions (token, account_id, expires_at) VALUES ($1, $2, now() + interval '${SESSION_DAYS} days')`, [token, accountId]);
    return token;
  }
  async getSession(token) {
    const { rows } = await this.pool.query(
      'SELECT a.* FROM sessions s JOIN accounts a ON a.id = s.account_id WHERE s.token = $1 AND s.expires_at > now()', [token]);
    return rows[0] || null;
  }
  async deleteSession(token) { await this.pool.query('DELETE FROM sessions WHERE token = $1', [token]); }

  /** ตัวละครทุกช่องของบัญชี → [ช่อง0, ช่อง1, ช่อง2] (ช่องว่าง = null) */
  async getCharacters(accountId) {
    const { rows } = await this.pool.query('SELECT slot, data FROM characters WHERE account_id = $1', [accountId]);
    return toList(rows);
  }
  async getCharacter(accountId, slot = 0) {
    const { rows } = await this.pool.query('SELECT data FROM characters WHERE account_id = $1 AND slot = $2', [accountId, slotOf(slot)]);
    return rows[0]?.data || null;
  }
  async saveCharacter(accountId, slot, data) {
    await this.pool.query(
      `INSERT INTO characters (account_id, slot, data, updated_at) VALUES ($1, $2, $3, now())
       ON CONFLICT (account_id, slot) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`, [accountId, slotOf(slot), data]);
  }
  /** ชื่อ (ตัวเล็ก) ที่ขึ้นต้นด้วยชื่อนี้: ตรงตัว หรือ ชื่อ#เลข */
  async namesLike(base) {
    const esc = base.toLowerCase().replace(/[\\%_]/g, (m) => '\\' + m);
    const { rows } = await this.pool.query(
      "SELECT lower(data->>'name') AS n FROM characters WHERE lower(data->>'name') = $1 OR lower(data->>'name') LIKE $2 ESCAPE '\\'", [base.toLowerCase(), `${esc} #%`]);
    return rows.map((r) => r.n);
  }
  async deleteCharacter(accountId, slot) {
    await this.pool.query('DELETE FROM characters WHERE account_id = $1 AND slot = $2', [accountId, slotOf(slot)]);
  }
  /** ลบตัวละครแล้ว: ถอดชื่อนี้ออกจากรายชื่อเพื่อนของทุกคน (ตัวที่ออฟไลน์อยู่ในฐานข้อมูล) */
  async dropFriendRefs(accountId, name) {
    const r = await this.pool.query(
      `UPDATE characters SET data = jsonb_set(data, '{friends}', COALESCE((SELECT jsonb_agg(f) FROM jsonb_array_elements(data->'friends') f
          WHERE NOT ((f->>'acc')::int = $1 AND lower(f->>'name') = lower($2))), '[]'::jsonb))
        WHERE jsonb_typeof(data->'friends') = 'array' AND data->'friends' @> jsonb_build_array(jsonb_build_object('acc', $1::int))`, [accountId, String(name || '')]);
    return r.rowCount || 0;
  }
  /** เปลี่ยนชื่อแล้ว: ชื่อในรายชื่อเพื่อนของคนอื่นเปลี่ยนตาม */
  async renameFriendRefs(accountId, oldName, newName) {
    await this.pool.query(
      `UPDATE characters SET data = jsonb_set(data, '{friends}', (SELECT jsonb_agg(CASE WHEN (f->>'acc')::int = $1 AND lower(f->>'name') = lower($2) THEN jsonb_set(f, '{name}', to_jsonb($3::text)) ELSE f END)
          FROM jsonb_array_elements(data->'friends') f))
        WHERE jsonb_typeof(data->'friends') = 'array' AND jsonb_array_length(data->'friends') > 0 AND data->'friends' @> jsonb_build_array(jsonb_build_object('acc', $1::int))`, [accountId, String(oldName), String(newName)]);
  }
  /** ล้างข้อมูลค้างของตัวละครที่ถูกลบ (รันตอนเปิด server): เพื่อนที่ไม่มีตัวละครชื่อนั้นแล้ว · กันชื่อ/เซสชันที่หมดอายุ */
  async purgeDeleted() {
    const f = await this.pool.query(
      `UPDATE characters c SET data = jsonb_set(c.data, '{friends}', COALESCE((SELECT jsonb_agg(f) FROM jsonb_array_elements(c.data->'friends') f
          WHERE EXISTS (SELECT 1 FROM characters o WHERE o.account_id = (f->>'acc')::int AND lower(o.data->>'name') = lower(f->>'name'))), '[]'::jsonb))
        WHERE jsonb_typeof(c.data->'friends') = 'array' AND jsonb_array_length(c.data->'friends') > 0
          AND EXISTS (SELECT 1 FROM jsonb_array_elements(c.data->'friends') f
                       WHERE NOT EXISTS (SELECT 1 FROM characters o WHERE o.account_id = (f->>'acc')::int AND lower(o.data->>'name') = lower(f->>'name')))`);
    const h = await this.pool.query('DELETE FROM name_holds WHERE until < now()');
    const s = await this.pool.query('DELETE FROM sessions WHERE expires_at < now()');
    return { friends: f.rowCount || 0, holds: h.rowCount || 0, sessions: s.rowCount || 0 };
  }
  /** ค่าเก็บถาวรทั่วไป (เช่น ข่าวจาก GM) */
  async getMeta(key) {
    await this.pool.query('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)');
    const { rows } = await this.pool.query('SELECT value FROM meta WHERE key = $1', [key]);
    return rows[0]?.value ?? null;
  }
  async setMeta(key, value) {
    await this.pool.query('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)');
    await this.pool.query('INSERT INTO meta (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [key, value]);
  }
  /** ตารางอันดับ: เลเวล/EXP + ตีบวกสูงสุด (ข้อมูลย่อ) */
  async topCharacters(limit = 300) {
    const { rows } = await this.pool.query(
      `SELECT data->>'name' AS name, data->'level' AS level, data->'exp' AS exp, data->'enhance' AS enhance, data->'path' AS path, data->>'title' AS title, data->'equipment' AS equipment
         FROM characters ORDER BY (data->>'level')::int DESC NULLS LAST, (data->>'exp')::int DESC NULLS LAST LIMIT $1`, [limit]);
    return rows;
  }
  /** ตารางอันดับค่าพลัง: ข้อมูลเต็ม (คำนวณ CP ใน server) */
  async rankCharacters(limit = 3000) {
    const { rows } = await this.pool.query(
      `SELECT account_id AS acc, slot, data FROM characters ORDER BY (data->>'level')::int DESC NULLS LAST LIMIT $1`, [limit]);
    return rows;
  }
}

// ============================================================
//  หน่วยความจำ (ใช้ตอนพัฒนา/ทดสอบในเครื่อง)
// ============================================================
class MemoryStore {
  async init() { this.accounts = new Map(); this.sessions = new Map(); this.chars = new Map(); this.seq = 0; return this; }
  async createGuest() { const a = { id: ++this.seq, username: null, pass_hash: null, is_guest: true, created_at: new Date() }; this.accounts.set(a.id, a); return a; }
  async createUser(username, passHash) {
    if (await this.findUser(username)) { const e = new Error('dup'); e.code = '23505'; throw e; }
    const a = { id: ++this.seq, username, pass_hash: passHash, is_guest: false, created_at: new Date() }; this.accounts.set(a.id, a); return a;
  }
  async findUser(username) { const u = username.toLowerCase(); return [...this.accounts.values()].find((a) => a.username?.toLowerCase() === u) || null; }
  async getAccount(id) { return this.accounts.get(id) || null; }
  async linkGuest(id, username, passHash) {
    const a = this.accounts.get(id);
    if (!a || !a.is_guest) return null;
    if (await this.findUser(username)) { const e = new Error('dup'); e.code = '23505'; throw e; }
    Object.assign(a, { username, pass_hash: passHash, is_guest: false });
    return a;
  }
  async touch() {}
  async nameTaken(key, accountId) {
    if ([...this.chars.values()].some((c) => (c.nk || nameKey(c.name)) === key)) return true;
    const h = (this.holds ||= new Map()).get(key);
    return !!h && h.until > Date.now() && h.acc !== accountId;
  }
  async holdName(key, accountId) { (this.holds ||= new Map()).set(key, { acc: accountId, until: Date.now() + NAME_HOLD_MS }); }
  async releaseHold(key) { this.holds?.delete(key); }
  async getMeta(k) { return (this.meta ||= new Map()).get(k) ?? null; }
  async setMeta(k, v) { (this.meta ||= new Map()).set(k, v); }
  async createSession(accountId) { const t = newToken(); this.sessions.set(t, accountId); return t; }
  async getSession(token) { const id = this.sessions.get(token); return id ? this.accounts.get(id) : null; }
  async deleteSession(token) { this.sessions.delete(token); }
  async getCharacters(id) { return Array.from({ length: MAX_SLOTS }, (_, i) => this.chars.get(`${id}:${i}`) || null); }
  async getCharacter(id, slot = 0) { return this.chars.get(`${id}:${slotOf(slot)}`) || null; }
  async saveCharacter(id, slot, data) { this.chars.set(`${id}:${slotOf(slot)}`, data); }
  async deleteCharacter(id, slot) { this.chars.delete(`${id}:${slotOf(slot)}`); }
  async dropFriendRefs(acc, name) {
    let n = 0; const low = String(name || '').toLowerCase();
    for (const c of this.chars.values()) { const b = (c.friends || []).length; if (!b) continue; c.friends = c.friends.filter((f) => !(f.acc === acc && String(f.name).toLowerCase() === low)); if (c.friends.length < b) n++; }
    return n;
  }
  async renameFriendRefs(acc, oldName, newName) {
    const low = String(oldName).toLowerCase();
    for (const c of this.chars.values()) for (const f of c.friends || []) if (f.acc === acc && String(f.name).toLowerCase() === low) f.name = newName;
  }
  async purgeDeleted() {
    const names = new Set([...this.chars.entries()].map(([k, c]) => `${k.split(':')[0]}|${String(c.name).toLowerCase()}`));
    let n = 0;
    for (const c of this.chars.values()) { const b = (c.friends || []).length; if (!b) continue; c.friends = c.friends.filter((f) => names.has(`${f.acc}|${String(f.name).toLowerCase()}`)); if (c.friends.length < b) n++; }
    return { friends: n, holds: 0, sessions: 0 };
  }
  async namesLike(base) { const b = base.toLowerCase(); return [...this.chars.values()].map((c) => String(c.name).toLowerCase()).filter((n) => n === b || n.startsWith(`${b} #`)); }
  async rankCharacters(limit = 3000) {
    return [...this.chars.entries()].slice(0, limit).map(([k, data]) => { const [acc, slot] = k.split(':'); return { acc: +acc, slot: +slot, data }; });
  }
  async topCharacters(limit = 300) {
    return [...this.chars.values()].sort((a, b) => (b.level || 0) - (a.level || 0) || (b.exp || 0) - (a.exp || 0)).slice(0, limit)
      .map((d) => ({ name: d.name, level: d.level, exp: d.exp, enhance: d.enhance, path: d.path, title: d.title, equipment: d.equipment }));
  }
}

/** แผนย้ายชื่อเก่า (#เลข) → ชื่อเปล่า · rows = [{acc, slot, data}] เรียงตามบัญชีเก่าก่อน → คืนเฉพาะตัวที่ข้อมูลเปลี่ยน */
export function planNameMigration(rows) {
  const out = [], used = new Set(), SUF = / #\d{3}$/;
  const owner = new Map();                                    // ชื่อไม่มีเลขท้าย จองก่อน (ตัวแรก/เก่าสุดได้)
  for (const r of rows) { const n = r.data?.name || ''; if (r.data && !SUF.test(n)) { const k = nameKey(n); if (!owner.has(k)) { owner.set(k, r); used.add(k); } } }
  const gift = (d) => { if (!d.renameGift) { d.renameGift = true; (d.inventory ||= []).push({ id: 'rename_ticket', qty: 1 }); } };
  for (const r of rows) {
    const d = r.data; if (!d) continue;
    const before = JSON.stringify([d.name, d.nk, d.renameGift]);
    const name = String(d.name || ''), m = name.match(/^(.*) #\d{3}$/);
    if (m) {
      const base = m[1].trim(), k = nameKey(base);
      if (base && !used.has(k)) { d.name = base; used.add(k); }
      else { used.add(nameKey(name)); gift(d); }            // ชื่อชน → คงเลข + ใบเปลี่ยนชื่อฟรี
    } else if (owner.get(nameKey(name)) !== r) {              // ชื่อหน้าตาคล้ายกันแต่มาทีหลัง → เติมเลข + ใบเปลี่ยนชื่อ
      let i = 2, nn; do nn = `${name.slice(0, 11)} #${String(i++).padStart(3, '0')}`; while (used.has(nameKey(nn)));
      d.name = nn; used.add(nameKey(nn)); gift(d);
    }
    d.nk = nameKey(d.name);
    if (JSON.stringify([d.name, d.nk, d.renameGift]) !== before) out.push(r);
  }
  return out;
}

export async function createStore() {
  const url = process.env.DATABASE_URL;
  if (url) {
    // มีฐานข้อมูลแต่ต่อไม่ได้ → ลองใหม่ ไม่ตกไปใช้หน่วยความจำ (กันข้อมูลผู้เล่นหาย)
    for (let i = 1; ; i++) {
      try { const s = await new PgStore(url).init(); console.log('[store] PostgreSQL connected'); return s; }
      catch (e) { console.error(`[store] PostgreSQL connect failed (try ${i}):`, e.message); await new Promise((r) => setTimeout(r, Math.min(30000, 2000 * i))); }
    }
  }
  console.log('[store] no DATABASE_URL → in-memory accounts (dev only)');
  return new MemoryStore().init();
}
