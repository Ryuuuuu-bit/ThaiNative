// ============================================================
//  Shrine – เสี่ยงเซียมซีที่วัดบางผี + ถวายของที่ศาลพระภูมิ
// ============================================================
import { SIAMSI, OFFERINGS, modsText, todayKey, endOfToday } from '/shared/data/blessings.js';
import { makeOffering, count } from './Inventory.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LUCK_CLASS = { 'ดีเลิศ': 'best', 'ดีมาก': 'great', 'ดี': 'good', 'กลาง': 'mid', 'ร้าย': 'bad' };

export class Shrine {
  constructor(scene) {
    this.scene = scene;
    $('#ss-shake').onclick = () => this.shake();
    $('#shrine-list').onclick = (e) => {
      const b = e.target.closest('button[data-offer]');
      if (!b) return;
      const r = makeOffering(this.char, b.dataset.offer);
      scene.ui.result(r);
      if (r.ok) {
        scene.sfx.play('blessing');
        this.incense();
        scene.saveSoon();
      } else scene.sfx.play('error');
      this.renderShrine();
    };
  }

  get char() { return this.scene.player.char; }

  // ---------------- เซียมซี ----------------
  openSiamsi() {
    this.scene.ui.closeAll();
    $('#siamsi-panel').classList.remove('hidden');
    this.scene.sfx.play('templeBell');
    const s = this.char.siamsi;
    if (s?.day === todayKey()) this.showCard(SIAMSI.find((x) => x.no === s.no), true);
    else { $('#ss-card').classList.add('hidden'); $('#ss-shake').disabled = false; $('#ss-note').textContent = 'ตั้งจิตอธิษฐาน แล้วกดเขย่า (วันละ 1 ครั้ง)'; }
  }

  shake() {
    const c = this.char;
    if (c.siamsi?.day === todayKey()) return;
    $('#ss-shake').disabled = true;
    const tube = $('#ss-tube');
    tube.classList.remove('shaking'); void tube.offsetWidth; tube.classList.add('shaking');
    this.scene.sfx.play('siamsi');
    $('#ss-note').textContent = 'กำลังเขย่า…';
    setTimeout(() => {
      const card = SIAMSI[Math.floor(Math.random() * SIAMSI.length)];
      c.siamsi = { day: todayKey(), no: card.no };
      c.blessings = (c.blessings || []).filter((b) => b.id !== 'siamsi');
      c.blessings.push({ id: 'siamsi', nameTh: `เซียมซีใบที่ ${card.no} (${card.luck})`, icon: card.luck === 'ร้าย' ? '📜' : '🎋', until: endOfToday(), mods: card.mods });
      tube.classList.remove('shaking');
      this.scene.sfx.play(card.luck === 'ร้าย' ? 'error' : 'blessing');
      this.showCard(card, false);
      this.scene.saveSoon();
    }, 1600);
  }

  showCard(card, already) {
    if (!card) return;
    const el = $('#ss-card');
    el.className = `ss-card ${LUCK_CLASS[card.luck] || ''}`;
    el.innerHTML = `<div class="ss-no">ใบที่ ${card.no}</div><div class="ss-luck">${esc(card.luck)}</div>
      <p class="ss-text">“${esc(card.text)}”</p><div class="ss-mods">${modsText(card.mods)} · ถึงเที่ยงคืน</div>
      ${card.advice ? `<div class="ss-advice">💡 ${esc(card.advice)}</div>` : ''}`;
    $('#ss-shake').disabled = true;
    $('#ss-note').textContent = already ? 'วันนี้เสี่ยงไปแล้ว กลับมาใหม่พรุ่งนี้นะ' : 'รับพรจากเซียมซีแล้ว!';
  }

  // ---------------- ศาลพระภูมิ ----------------
  openShrine() {
    this.scene.ui.closeAll();
    $('#shrine-panel').classList.remove('hidden');
    this.scene.sfx.play('templeBell');
    this.renderShrine();
  }

  renderShrine() {
    const c = this.char, now = Date.now();
    $('#shrine-list').innerHTML = Object.entries(OFFERINGS).map(([k, o]) => {
      const n = count(c, o.item);
      return `<div class="shrine-row"><span class="ic">${o.icon}</span><div><b>${esc(o.nameTh)}</b> <small>มี ${n}</small><br><small>${esc(o.blessTh)} · ${o.minutes} นาที</small></div>
        <button class="btn ${n ? 'primary' : 'ghost'} sm" data-offer="${k}" ${n ? '' : 'disabled'}>ถวาย</button></div>`;
    }).join('');
    const act = (c.blessings || []).filter((b) => b.until > now);
    $('#shrine-active').innerHTML = act.length
      ? act.map((b) => `<div>${b.icon} ${esc(b.nameTh)} <small>${modsText(b.mods)} · เหลือ ${Math.ceil((b.until - now) / 60000)} นาที</small></div>`).join('')
      : '<p class="empty">ยังไม่มีพร – ซื้อของถวายได้ที่ร้านป้าติ๋ม</p>';
  }

  /** ควันธูปลอยขึ้นจากศาล */
  incense() {
    const s = this.scene, x = s.shrineX, y = s.shrineY;
    const em = s.add.particles(x, y, 'particle', {
      speedY: { min: -30, max: -14 }, speedX: { min: -6, max: 6 }, lifespan: 1600, quantity: 1, frequency: 60,
      scale: { start: 0.6, end: 1.6 }, alpha: { start: 0.5, end: 0 }, tint: 0xdfe6e9,
    }).setDepth(12);
    s.time.delayedCall(1800, () => em.stop());
    s.time.delayedCall(3600, () => em.destroy());
    s.combat.burst(s.player.x, s.player.y - 20, 0xf9e79f, 16);
  }
}
