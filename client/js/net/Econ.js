// ============================================================
//  Econ – ช่องทางเดียวที่ใช้เปลี่ยน ของ/เงิน/ตีบวก/เควส/เลเวล ของตัวละคร
//  ▸ บัญชีออนไลน์: ส่งคำสั่งให้ server รัน → รับสถานะจริงกลับมาแทนค่าในเครื่อง (แก้ค่าเองไม่มีผล)
//  ▸ ออฟไลน์ (ไม่มี server): รันฟังก์ชันเดียวกันในเครื่อง
//  act(name, args) → Promise<{ ok, msg, ... }>
// ============================================================
import { runAction } from '/shared/economy.js';
import { getDerived } from '/shared/character.js';
import { account } from './Account.js';
import { tradeLock } from '../systems/Inventory.js';

export class Econ {
  constructor(scene) {
    this.scene = scene;
    this.sess = { joinAt: Date.now() };        // สถานะชั่วคราว (ออฟไลน์: ตกปลา/สมุนไพร/หีบ)
    this.pending = 0;
  }

  /** เล่นกับ server (บัญชี) → server เป็นเจ้าของข้อมูล */
  get server() { return account.loggedIn && !account.offline; }
  get char() { return this.scene.player.char; }

  act(a, args = {}) {
    const s = this.scene;
    if (!this.server) {
      const r = runAction(this.char, a, args, { rnd: Math.random, now: Date.now(), x: s.player?.x ?? null, night: !!s.clock?.night, trade: tradeLock.on, sess: this.sess });
      return Promise.resolve(r);
    }
    if (!s.net?.online) return Promise.resolve({ ok: false, msg: 'ขาดการเชื่อมต่อเซิร์ฟเวอร์ – รอสักครู่' });
    this.pending++;
    return new Promise((resolve) => {
      let done = false;
      const t = setTimeout(() => { if (done) return; done = true; this.pending--; resolve({ ok: false, msg: 'เซิร์ฟเวอร์ไม่ตอบสนอง ลองใหม่อีกครั้ง' }); }, 7000);
      s.net.socket.emit('econ', { ...args, a }, (resp) => {
        if (done) return;
        done = true; clearTimeout(t); this.pending--;
        if (resp?.s) this.apply(resp.s);
        resolve(resp?.r || { ok: false, msg: '' });
      });
    });
  }

  /** รับสถานะตัวละครจาก server → แทนที่ข้อมูลในเครื่อง (MP ยังเป็นของ client) */
  apply(s) {
    const c = this.char, sc = this.scene;
    if (!c || !s) return;
    const before = { level: c.level, app: JSON.stringify(c.appearance), titles: (c.titles || []).length };
    const mp = c.mp;
    Object.assign(c, s);
    const d = getDerived(c);
    c.mp = Math.min(Number.isFinite(mp) ? mp : d.maxMp, d.maxMp);
    if (c.level > before.level) sc.combat?.levelUpFx(c.level - before.level);
    if (JSON.stringify(c.appearance) !== before.app) sc.onAppearanceChanged?.(true);
    sc.ui && (sc.ui.hudCache = '');
    sc.ui?.refreshPanels();
    sc.village?.renderTracker();
  }
}
