// ============================================================
//  Account – บัญชีผู้เล่น (Login / Guest / เชื่อม ID) + เซฟตัวละครขึ้น server
//  token เก็บใน localStorage → เปิดเกมครั้งต่อไปเข้าอัตโนมัติ
// ============================================================
const TOKEN_KEY = 'thainative_token';

class AccountClient {
  constructor() {
    this.token = null;
    this.account = null;             // { id, guest, username, display }
    this.offline = false;            // เปิดไฟล์ตรงๆ ไม่มี server → เล่นออฟไลน์ (เซฟในเครื่อง)
    try { this.token = localStorage.getItem(TOKEN_KEY); } catch { /* ignore */ }
    this.pending = null;
    this.saveTimer = null;
  }

  get loggedIn() { return !!this.account; }
  get isGuest() { return !!this.account?.guest; }

  async api(path, method = 'GET', body) {
    const res = await fetch(`/api${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      keepalive: method !== 'GET' && JSON.stringify(body || '').length < 60000,
    });
    let data = {};
    try { data = await res.json(); } catch { /* ignore */ }
    if (!res.ok) { const e = new Error(data.error || `HTTP ${res.status}`); e.status = res.status; throw e; }
    return data;
  }

  setSession(d) {
    if (d.token) { this.token = d.token; try { localStorage.setItem(TOKEN_KEY, d.token); } catch { /* ignore */ } }
    if (d.account) this.account = d.account;
    return d;
  }

  /** เข้าอัตโนมัติด้วย token เดิม → { account, character } หรือ null */
  async resume() {
    if (!this.token) return null;
    try { return this.setSession(await this.api('/me')); }
    catch (e) {
      if (e.status === 401) this.clear();
      else if (!e.status) this.offline = true;     // ต่อ server ไม่ได้
      return null;
    }
  }

  async guest() { return this.setSession(await this.api('/guest', 'POST', {})); }
  async login(username, password) { return this.setSession(await this.api('/login', 'POST', { username, password })); }
  async register(username, password) { return this.setSession(await this.api('/register', 'POST', { username, password })); }
  async link(username, password) { return this.setSession(await this.api('/link', 'POST', { username, password })); }

  async logout() {
    await this.flush();
    try { await this.api('/logout', 'POST', {}); } catch { /* ignore */ }
    this.clear();
  }

  clear() {
    this.token = null; this.account = null;
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
  }

  /** เซฟตัวละครขึ้น server (รวบหลายครั้งเป็นครั้งเดียวทุก ~1.5 วิ) */
  saveCharacter(char) {
    if (!this.loggedIn) return;
    this.pending = char;
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => this.flush(), 1500);
  }

  async flush() {
    clearTimeout(this.saveTimer); this.saveTimer = null;
    const char = this.pending;
    if (!char || !this.loggedIn) return;
    this.pending = null;
    try { await this.api('/character', 'PUT', { character: char }); this.lastSaved = Date.now(); }
    catch (e) { if (e.status !== 401 && e.status !== 400) this.pending = this.pending || char; }   // ลองใหม่รอบหน้า
  }
}

export const account = new AccountClient();
