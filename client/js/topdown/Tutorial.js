// ============================================================
//  แนะนำผู้เล่นใหม่ (5 นาทีแรก) — การ์ดขั้นตอนมุมซ้าย + ลูกศรทองรอบตัวละครชี้ไปเป้าหมาย
//  1) เดิน  2) ไปหาผู้ใหญ่ชัย รับเควส  3) เปิดคัมภีร์สกิล  4) ออกไปปราบผีตัวแรก
//  ▸ เฉพาะตัวละครเลเวลไม่เกิน 10 ที่ยังไม่เคยผ่าน · กด "ข้าม" ได้ · จำในเครื่อง (ต่อชื่อตัวละคร)
// ============================================================
import { MONSTERS } from '/shared/data/monsters.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class Tutorial {
  constructor(scene) {
    this.s = scene;
    const c = scene.player?.char;
    this.key = `tn_tut_${c?.name || ''}`;
    let done = false;
    try { done = localStorage.getItem(this.key) === 'done'; } catch { /* ignore */ }
    this.on = !!c && !done && (c.level || 1) <= 10 && scene.M?.id === 'ayutthaya';
    if (!this.on) return;
    this.touch = document.body.classList.contains('touch');
    this.step = 0; this.kills = 0;
    this.start = { x: scene.player.x, y: scene.player.y };
    this.build();
    scene.net?.socket?.on?.('td:reward', this.onReward = (r) => { if (r?.kind === 'kill' || r?.kind === 'assist') this.kills++; });
    scene.events.once('shutdown', () => this.destroy());
    this.show();
  }

  get steps() {
    const t = this.touch;
    return [
      { title: 'ลองเดินดูก่อน', text: t ? 'ลากจอยสติ๊กซ้ายล่าง หรือแตะพื้นที่อยากไป' : 'คลิกพื้นที่อยากไป หรือกด W A S D / ปุ่มลูกศร' },
      { title: 'ไปหาผู้ใหญ่ชัย', text: t ? 'เดินตามลูกศรทอง แล้วแตะปุ่ม "รับเควส" ที่เด้งขึ้น' : 'เดินตามลูกศรทอง แล้วกด F หรือคลิกที่ผู้ใหญ่ชัย ❗', target: () => this.npc('quest') },
      { title: 'เปิดคัมภีร์สกิล', text: t ? 'แตะ ☰ มุมขวาบน → คัมภีร์ (เรียนสกิลแรกด้วยแต้ม SP)' : 'กด K เปิดคัมภีร์ แล้วเรียนสกิลแรกด้วยแต้ม SP' },
      { title: 'ออกไปปราบผีตัวแรก', text: t ? 'เดินตามลูกศรออกนอกเมือง แล้วกดปุ่ม ⚔️ ใกล้ผี' : 'เดินตามลูกศรออกนอกเมือง แล้วคลิกที่ผีเพื่อโจมตี', target: () => this.camp() },
    ];
  }

  npc(id) { return (this.s.npcs || []).find((n) => n.id === id) || null; }
  /** แหล่งผีเลเวลต่ำสุดที่ใกล้ที่สุด */
  camp() {
    const p = this.s.player; let best = null, bd = Infinity;
    for (const sp of this.s.layout?.spawns || []) {
      const m = MONSTERS[sp.id]; if (!m || sp.boss || m.boss || m.level > 6) continue;
      const d = Math.hypot(sp.x - p.x, sp.y - p.y); if (d < bd) { bd = d; best = sp; }
    }
    return best;
  }

  build() {
    const el = (this.el = document.createElement('div'));
    el.id = 'tut-card'; el.className = 'tut-card';
    document.getElementById('td-hud')?.appendChild(el);
    document.body.classList.add('tut-on');
    this.arrow = this.s.add.graphics().setDepth(99990);
    this.arrow.fillStyle(0xffd76a, 1).fillTriangle(14, 0, -6, -9, -6, 9).lineStyle(2, 0x5a3300, 1).strokeTriangle(14, 0, -6, -9, -6, 9);
    this.arrow.setVisible(false);
  }

  show() {
    const S = this.steps, st = S[this.step];
    if (!st) return this.finish();
    this.el.innerHTML = `<div class="tc-hd"><span>📜 เริ่มต้นการผจญภัย <em>${this.step + 1}/${S.length}</em></span><button class="tc-skip" title="ข้ามการแนะนำ">ข้าม ✕</button></div>
      <b>${esc(st.title)}</b><p>${esc(st.text)}</p><div class="tc-bar"><i style="width:${(this.step / S.length) * 100}%"></i></div>`;
    this.el.querySelector('.tc-skip').onclick = (e) => { e.stopPropagation(); this.finish(true); };
    this.el.classList.remove('pop'); void this.el.offsetWidth; this.el.classList.add('pop');
  }

  next() { this.step++; this.s.sfx?.play?.('coin'); this.show(); }

  /** เรียกทุก ~250ms จากฉาก */
  update() {
    if (!this.on) return;
    const s = this.s, p = s.player; if (!p) return;
    if ((p.char?.level || 1) > 10) return this.finish(true);                      // เก่งเกินแนะนำแล้ว
    const away = s.M?.id !== 'ayutthaya';                                         // แดนอื่น/ลานบอส: พักการแนะนำไว้ก่อน
    document.body.classList.toggle('tut-on', !away);
    if (away) { this.el.classList.add('hidden'); this.arrow.setVisible(false); return; }
    // อยู่ใต้กรอบสมาชิกปาร์ตี้ (ไม่ให้ทับกัน)
    const pf = document.getElementById('party-frames'), hud = document.getElementById('td-hud');
    if (pf && hud) {
      const r = pf.getBoundingClientRect(), h = hud.getBoundingClientRect();
      const below = r.height > 2 && !pf.classList.contains('hidden') ? r.bottom - h.top + 6 : 0;
      const top = below ? `${below}px` : '';
      if (this.el.style.top !== top) this.el.style.top = top;
    }
    const vis = (id) => { const e = document.getElementById(id); return e && !e.classList.contains('hidden'); };
    switch (this.step) {
      case 0: if (Math.hypot(p.x - this.start.x, p.y - this.start.y) > 80) this.next(); break;
      case 1: if (vis('quest-panel')) this.next(); break;
      case 2: if (vis('skill-panel')) this.next(); break;
      case 3: if (this.kills > 0) this.next(); break;
    }
    // ลูกศรรอบตัวละคร → เป้าหมายของขั้นนี้ (ใกล้แล้ว/เปิดหน้าต่างอยู่ = ซ่อน)
    const tg = this.steps[this.step]?.target?.();
    const d = tg ? Math.hypot(tg.x - p.x, tg.y - p.y) : 0;
    const on = !!tg && d > 70 && p.alive && !s.ui.anyOpen?.();
    this.arrow.setVisible(on);
    if (on) { const a = Math.atan2(tg.y - p.y, tg.x - p.x), r = 30 + Math.sin(s.time.now / 180) * 3; this.arrow.setPosition(p.x + Math.cos(a) * r, p.y - 18 + Math.sin(a) * r).setRotation(a); }
    this.el.classList.toggle('hidden', !!document.body.classList.contains('win-open') && this.step !== 2);
  }

  finish(skipped = false) {
    if (!this.on) return;
    this.on = false;
    try { localStorage.setItem(this.key, 'done'); } catch { /* ignore */ }
    if (!skipped) this.s.ui.banner('🎉 พร้อมผจญภัยแล้ว!', 'ทำเควสผู้ใหญ่ชัย เก็บเลเวล · กด H ดูวิธีเล่นได้ทุกเมื่อ');
    this.destroy();
  }

  destroy() {
    document.body.classList.remove('tut-on');
    this.el?.remove(); this.arrow?.destroy();
    if (this.onReward) this.s.net?.socket?.off?.('td:reward', this.onReward);
    this.onReward = null;
  }
}
