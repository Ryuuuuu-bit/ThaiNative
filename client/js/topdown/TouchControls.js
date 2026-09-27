// ============================================================
//  ควบคุมบนมือถือ/แท็บเล็ต (จอสัมผัส)
//  ▸ จอยสติ๊กซ้ายล่าง = เดิน · ปุ่มโจมตีขวาล่าง = ล็อกผีที่ใกล้สุดแล้วตี / คุย NPC ที่อยู่ใกล้
//  ▸ แตะพื้น = เดิน · แตะผี = ตี (รัศมีแตะกว้างกว่าเมาส์) · แตะช่องสกิล = ร่าย
//  ▸ แนวตั้ง → ขึ้นหน้าบอกให้หมุนจอ · ปุ่มเต็มจอ (ล็อกแนวนอนได้บน Android)
// ============================================================

export const isTouchDevice = () =>
  (window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0) && Math.min(screen.width, screen.height) < 900;

export class TouchControls {
  constructor(scene) {
    this.s = scene;
    this.on = isTouchDevice() || /[?&]touch=1/.test(location.search);
    this.vec = null;
    this.pid = null;
    if (!this.on) return;
    document.body.classList.add('touch');
    this.build();
    scene.events.once('shutdown', () => this.destroy());
  }

  /** ตัวชี้นี้กำลังใช้จอยสติ๊กอยู่ไหม (ไม่ให้ Phaser ถือเป็นการแตะพื้น) */
  owns(ptr) { return this.on && this.pid != null && ptr.event?.pointerId === this.pid; }

  build() {
    const root = (this.root = document.createElement('div'));
    root.id = 'touch-ui';
    root.innerHTML = `
      <div class="t-stick" id="t-stick"><div class="t-knob" id="t-knob"></div></div>
      <button class="t-btn t-atk" id="t-atk" aria-label="โจมตี">⚔️</button>
      <button class="t-btn t-small t-fs" id="t-fs" aria-label="เต็มจอ">⛶</button>
      <div class="t-rotate" id="t-rotate"><div>📱↻</div><p>หมุนโทรศัพท์เป็นแนวนอนเพื่อเล่น</p><button class="btn" id="t-rotate-fs">เต็มจอ + แนวนอน</button></div>`;
    document.getElementById('game-wrap').appendChild(root);
    const stick = root.querySelector('#t-stick'), knob = root.querySelector('#t-knob');
    const R = () => stick.getBoundingClientRect();

    // ---------- จอยสติ๊ก ----------
    const move = (e) => {
      const r = R(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, max = r.width * 0.38;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > max) { dx *= max / d; dy *= max / d; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const k = Math.hypot(dx, dy) / max;
      this.vec = k < 0.22 ? null : { x: dx / max, y: dy / max };
      if (this.vec) { const p = this.s.player; p.path = []; p.target = null; }
    };
    const end = (e) => {
      if (e.pointerId !== this.pid) return;
      this.pid = null; this.vec = null; knob.style.transform = ''; stick.classList.remove('on');
    };
    stick.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      this.pid = e.pointerId; stick.setPointerCapture(e.pointerId); stick.classList.add('on'); move(e);
      this.s.sfx.init?.();
    });
    stick.addEventListener('pointermove', (e) => { if (e.pointerId === this.pid) move(e); });
    stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);

    // ---------- ปุ่มโจมตี / คุย ----------
    const atk = root.querySelector('#t-atk');
    atk.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      atk.classList.add('on'); setTimeout(() => atk.classList.remove('on'), 120);
      this.attack();
    });

    // ---------- เต็มจอ ----------
    const fs = async () => {
      try { await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }); } catch { /* iOS ไม่รองรับ */ }
      try { await screen.orientation?.lock?.('landscape'); } catch { /* บางเครื่องล็อกไม่ได้ */ }
    };
    root.querySelector('#t-fs').addEventListener('click', fs);
    root.querySelector('#t-rotate-fs').addEventListener('click', fs);

    // กันซูม/เลื่อนหน้าเว็บด้วยนิ้ว (ดับเบิลแตะ, pinch)
    this.noGesture = (e) => { if (e.touches?.length > 1 || e.scale && e.scale !== 1) e.preventDefault(); };
    document.addEventListener('touchmove', this.noGesture, { passive: false });
    document.addEventListener('gesturestart', this.noGesture);
  }

  /** ปุ่มโจมตี: NPC ใกล้ ๆ → คุย · มีเป้าอยู่แล้ว → ตีต่อ · ไม่งั้นล็อกผีที่ใกล้ที่สุด */
  attack() {
    const s = this.s, p = s.player;
    if (!p.alive) return;
    const npc = s.nearestNpc?.(44);
    if (npc && !p.target) { s.talk(npc); return; }
    if (p.target?.alive) { s.setTarget(p.target); return; }
    let best = null, bd = 220;
    for (const m of s.mobs) {
      if (!m.alive || m.visible === false) continue;
      const d = Math.hypot(m.x - p.x, m.y - p.y);
      if (d < bd) { bd = d; best = m; }
    }
    if (best) s.setTarget(best);
    else s.ui.toast?.('ไม่มีผีอยู่ใกล้ ๆ', '', 1200);
  }

  destroy() {
    document.removeEventListener('touchmove', this.noGesture);
    document.removeEventListener('gesturestart', this.noGesture);
    this.root?.remove();
  }
}
