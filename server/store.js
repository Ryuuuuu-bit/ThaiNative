// ============================================================
//  Store – บัญชีผู้เล่น / Session / ตัวละคร
//  ▸ มี DATABASE_URL (Railway Postgres) → ใช้ PostgreSQL
//  ▸ ไม่มี (รันในเครื่อง) → เก็บในหน่วยความจำ (หายเมื่อปิด server)
// ============================================================
import crypto from 'node:crypto';

const SESSION_DAYS = 60;
/** จำนวนช่องตัวละครต่อบัญชี (แบบ RO) */
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
    return this;
  }

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
  async deleteCharacter(accountId, slot) {
    await this.pool.query('DELETE FROM characters WHERE account_id = $1 AND slot = $2', [accountId, slotOf(slot)]);
  }
  /** ตารางอันดับ: เลเวล/EXP + ตีบวกสูงสุด (ข้อมูลย่อ) */
  async topCharacters(limit = 300) {
    const { rows } = await this.pool.query(
      `SELECT data->>'name' AS name, data->'level' AS level, data->'exp' AS exp, data->'enhance' AS enhance, data->'path' AS path, data->'equipment' AS equipment
         FROM characters ORDER BY (data->>'level')::int DESC NULLS LAST, (data->>'exp')::int DESC NULLS LAST LIMIT $1`, [limit]);
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
  async createSession(accountId) { const t = newToken(); this.sessions.set(t, accountId); return t; }
  async getSession(token) { const id = this.sessions.get(token); return id ? this.accounts.get(id) : null; }
  async deleteSession(token) { this.sessions.delete(token); }
  async getCharacters(id) { return Array.from({ length: MAX_SLOTS }, (_, i) => this.chars.get(`${id}:${i}`) || null); }
  async getCharacter(id, slot = 0) { return this.chars.get(`${id}:${slotOf(slot)}`) || null; }
  async saveCharacter(id, slot, data) { this.chars.set(`${id}:${slotOf(slot)}`, data); }
  async deleteCharacter(id, slot) { this.chars.delete(`${id}:${slotOf(slot)}`); }
  async topCharacters(limit = 300) {
    return [...this.chars.values()].sort((a, b) => (b.level || 0) - (a.level || 0) || (b.exp || 0) - (a.exp || 0)).slice(0, limit)
      .map((d) => ({ name: d.name, level: d.level, exp: d.exp, enhance: d.enhance, path: d.path, equipment: d.equipment }));
  }
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
