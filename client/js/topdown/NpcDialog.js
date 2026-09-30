// ============================================================
//  NpcDialog – กล่องคุยกับ NPC ด้านล่างจอ (ผู้ใหญ่ชัย · ฤๅษี · สัปเหร่อ · โหรหลวง · NPC ทั่วไป)
//  ▸ หน้าคน + ชื่อ/บทบาท + คำพูด (หลายหน้า) · ปุ่มหลัก (ดูกระดานเควส / วาร์ป / ลงสุสาน) · คุยต่อ · ลาก่อน
//  ▸ F / Enter = ปุ่มหลัก (ถ้าไม่มี = คุยต่อ) · Space = คุยต่อ · Esc = ลาก่อน · เดินออกห่าง = ปิดเอง
// ============================================================
import { npcPortrait } from '../systems/UI.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class NpcDialog {
  constructor(scene) { this.s = scene; this.el = null; this.npc = null; }

  build() {
    if (this.el) return this.el;
    const el = this.el = document.createElement('div');
    el.id = 'npc-dlg'; el.className = 'npc-dlg hidden';
    el.innerHTML = `<div class="nd-face"><img alt=""><i></i></div>
      <div class="nd-body"><div class="nd-name"><b></b><small></small></div><p class="nd-line"></p><div class="nd-dots"></div></div>
      <div class="nd-btns"><button class="btn primary nd-main"></button><button class="btn nd-next">💬 คุยต่อ</button><button class="btn ghost nd-bye">ลาก่อน</button></div>`;
    document.getElementById('td-hud')?.appendChild(el) || document.body.appendChild(el);
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.querySelector('.nd-main').onclick = () => this.main();
    el.querySelector('.nd-next').onclick = () => this.next();
    el.querySelector('.nd-bye').onclick = () => this.close();
    this.onKey = (e) => {
      if (!this.open || this.s.ui.typing) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); this.close(); }
      else if (e.key === 'Enter' || e.key === 'f' || e.key === 'F') { e.preventDefault(); e.stopImmediatePropagation(); this.act ? this.main() : this.next(); }
      else if (e.key === ' ') { e.preventDefault(); e.stopImmediatePropagation(); this.next(); }
    };
    window.addEventListener('keydown', this.onKey, true);
    this.s.events.once('shutdown', () => { window.removeEventListener('keydown', this.onKey, true); el.remove(); this.el = null; });
    return el;
  }

  get open() { return !!this.el && !this.el.classList.contains('hidden'); }

  /** เปิดกล่องคุย: act = { label, run } (ปุ่มหลัก) */
  show(n, act = null) {
    const el = this.build();
    this.npc = n; this.act = act;
    this.lines = Array.isArray(n.lines) && n.lines.length ? n.lines : ['…'];
    this.page = Number.isFinite(n.line) ? n.line % this.lines.length : 0;
    el.querySelector('.nd-name b').textContent = n.nameTh;
    el.querySelector('.nd-name small').textContent = n.role || '';
    const main = el.querySelector('.nd-main');
    main.textContent = act?.label || ''; main.classList.toggle('hidden', !act);
    el.querySelector('.nd-next').classList.toggle('hidden', this.lines.length < 2 && !!act);
    const img = el.querySelector('img'), ic = el.querySelector('.nd-face i');
    img.style.display = 'none'; ic.textContent = n.icon || '💬';
    npcPortrait(n.key).then((url) => { if (url && this.npc === n) { img.src = url; img.style.display = ''; ic.textContent = ''; } });
    this.paint();
    el.classList.remove('hidden');
  }

  paint() {
    const el = this.el;
    el.querySelector('.nd-line').textContent = `“${this.lines[this.page]}”`;
    el.querySelector('.nd-dots').innerHTML = this.lines.length > 1 ? `${this.lines.map((_, i) => `<i class="${i === this.page ? 'on' : ''}"></i>`).join('')}<small>${this.page + 1}/${this.lines.length}</small>` : '';
  }

  next() {
    this.s.sfx?.play('click');
    this.page = (this.page + 1) % this.lines.length;
    if (this.npc) this.npc.line = this.page;
    this.paint();
  }

  main() { const a = this.act; this.close(); a?.run(); }

  close() { if (this.el) this.el.classList.add('hidden'); if (this.npc) this.npc.line = (this.page || 0) + 1; this.npc = null; }

  /** ปิดเองเมื่อเดินห่าง NPC */
  update() {
    if (!this.open || !this.npc) return;
    const p = this.s.player;
    if (!p?.alive || Math.hypot(p.x - this.npc.x, p.y - this.npc.y) > 90) this.close();
  }
}
