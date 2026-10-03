// ============================================================
//  ดันเจี้ยนสี่ผีป่าช้า – ฝั่ง client
//  ▸ หน้าต่างเลือกห้อง (คุยกับหลวงตาเฝ้าป่าช้า): 4 ห้องบอส (เปิด 1 ล็อก 3) · ระดับ · เทียน · หีบวันนี้ · ความพร้อมปาร์ตี้
//  ▸ HUD ในลาน: เวลา · เทียนนำวิญญาณ · หลักไม้ (ติด/ดับ) · สถานะตรึงผี · ปุ่มออก
//  ▸ หลักไม้บนพื้น: วงแสงรอบหลัก เปลี่ยนสีเมื่อมีคนยืน · สายสิญจน์เชื่อมทุกหลักตอนตรึงผี
// ============================================================
import { ITEMS } from '/shared/data/items.js';
import { GD_BOSSES, GD_BOSS_IDS, GD_DIFFS, GD_POSTS, GD_SKILLS, GD_PHASES, GD_MECH, GDG } from '/shared/data/ghostdg.js';
import { playDir, hasDir8 } from './Dir8.js';
import { rarityOf } from '../systems/UI.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mmss = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const JOB_IC = { swordman: '⚔️', boxer: '🥊', mage: '🔮', archer: '🏹', healer: '🌿' };
/** สีเอฟเฟกต์ตามท่า (กระสือ = เขียวไส้เรือง · หยาดดำ = ม่วงหมึก · ปอบ = แดงเลือด/ชมพูลิ้น) */
const FXC = { echo: 0xb8c4e0, noose: 0xc9a26b, execute: 0xffd76a, reverse: 0xff3b4a, split: 0xff3b4a, vortex: 0xd8d0ff, shriek: 0x6dffb0, gaze: 0x9a6dff, shroud: 0x9a6dff, dive: 0x6dffb0, wisp: 0x6dffb0, dark: 0x6dffb0, tether: 0x6dffb0, crawl: 0x9a6dff, drip: 0x9a6dff, liver: 0xff4a4a, tongue: 0xff7a9a, pounce: 0xd8a060 };
/** ชีตเอฟเฟกต์ Blender (tools/blender/fx_gd.py) · [texture, ขนาดเฟรม, เฟรมที่ตกกระทบ] · 20 fps */
const GD_FX = { execute: ['gd_hung_execute', 160, 3], wisp: ['gd_krasue_wisp', 128, 4], dark: ['gd_krasue_wisp', 128, 4], drip: ['gd_yat_drip', 128, 4], pounce: ['gd_pob_pounce', 128, 1] };
const FX_FPS = 20;
const ARENA = { hung: ['#3a3542', '#55505e'], krasue: ['#20372a', '#2f5038'], yat: ['#2a2234', '#3a2f47'], pob: ['#3a2a22', '#4f3a2c'] };

export class GhostDungeonUI {
  constructor(scene) {
    this.s = scene; this.info = null; this.sel = 'hung'; this.diff = 'normal'; this.st = null; this.skew = 0; this.gfx = null; this.lastSpec = 0;
    const hud = document.createElement('div'); hud.id = 'gd-hud'; hud.className = 'hidden';
    hud.innerHTML = `<div class="gd-bar"><div class="gd-top"><b class="gd-name"></b><em class="gd-lv"></em><span class="gd-dtag"></span><span class="gd-ph"></span><span class="gd-time"></span></div>
      <div class="gd-hp"><i></i><span></span></div>
      <div class="gd-btm"><span class="gd-candles"></span><span class="gd-posts"></span><small class="gd-tip"></small><button class="gd-leave">ออกจากลาน</button></div></div>
      <div class="gd-cast hidden"><b></b><small></small></div>
      <div class="gd-res hidden"></div>`;
    ($('#td-hud') || document.body).appendChild(hud); this.hud = hud;
    hud.querySelector('.gd-leave').onclick = () => { if (confirm('ออกจากลานบอส? (กลับหน้าหลวงตา)')) this.leave(); };
    this.fx = [];                                                                   // ภาพเตือนท่าบอสบนพื้น
    this.timer = setInterval(() => this.refresh(), 500);
    scene.events.once('shutdown', () => this.destroy());
  }
  destroy() { clearInterval(this.timer); this.hud?.remove(); this.clearWorld(); }
  get here() { return !!this.s.M?.gd; }
  get now() { return Date.now() + this.skew; }
  /** เวลารอฟื้นในลาน (ตามระดับ) · null = นอกลาน */
  get respawnWait() { return this.here ? GD_DIFFS[this.s.M.gd.diff].wait : null; }

  bind(net) {
    net.on('gd:info', (d) => this.show(d))
      .on('gd:fail', ({ msg }) => { this.s.warping = false; this.s.ui.toast(msg || 'เข้าไม่ได้', 'warn', 2800); })
      .on('gd:state', (d) => this.state(d))
      .on('gd:bind', ({ ms, mul }) => { this.s.ui.banner?.(`🧵 สายสิญจน์ตรึงผี ${Math.round(ms / 1000)} วิ · ดาเมจ ×${mul}!`); this.s.sfx?.play('levelup'); this.s.cameras.main.flash(300, 255, 240, 200); })
      .on('gd:candle', ({ name, left, max }) => this.s.ui.toast(`🕯️ ${name} ใช้เทียนนำวิญญาณ · เหลือ ${left}/${max}`, left <= 1 ? 'warn' : '', 2400))
      .on('gd:spectate', ({ msg }) => { if (Date.now() - this.lastSpec > 8000) { this.lastSpec = Date.now(); this.s.ui.toast(msg, 'warn', 3200); } this.spectating = true; this.refresh(); })
      .on('gd:skill', (d) => this.skill(d))
      .on('gd:obj', (d) => this.onObj(d))
      .on('gd:fear', ({ pids, ms, name }) => { if (pids?.includes(this.s.net?.selfId)) { this.fearUntil = Date.now() + ms; this.s.ui.toast(`😱 ${name}: คุณหันหน้าเข้าหาผี · ติดกลัว ${Math.round(ms / 1000)} วิ`, 'warn', 2400); this.s.cameras.main.shake(300, 0.008); } else if (pids?.length === 0) this.s.ui.toast('👍 ทุกคนหันหลังทัน!', 'ok', 1500); })
      .on('gd:phase', ({ ph, name }) => { this.s.ui.banner?.(`☠ เฟส ${ph} · ${name}`, 'ผีเปลี่ยนท่า · ระวัง!'); this.s.sfx?.play('skBoom'); this.s.cameras.main.shake(350, 0.008); })
      .on('gd:result', (r) => { this.clearSkills(); this.result(r); });
  }

  // ---------------- หน้าต่างเลือกห้อง ----------------
  open() {
    if (!this.s.econ.server) return this.s.ui.toast('ดันเจี้ยนสี่ผีเล่นได้เฉพาะออนไลน์', 'warn', 2400);
    this.s.net.send('gd:info', {});
  }
  show(d) {
    this.info = d;
    const panel = $('#gd-panel'); if (!panel) return;
    const fresh = panel.classList.contains('hidden');
    if (fresh) { this.s.ui.closeAll?.(); panel.classList.remove('hidden'); this.s.sfx?.play('open'); }
    this.render();
  }
  render() {
    const box = $('#gd-body'), d = this.info; if (!box || !d) return;
    const B = GD_BOSSES[this.sel], D = GD_DIFFS[this.diff], n = Math.max(1, d.party.length), q = d.quota[`${this.sel}:${this.diff}`] || { left: D.chests, max: D.chests };
    const candles = D.candles ? D.candles(n) : null, short = d.party.filter((p) => p.lv < D.req), away = d.party.filter((p) => !p.here);
    const needClear = D.needClear && !d.quota[`${this.sel}:${D.needClear}`]?.cleared;
    const run = d.running;
    const why = !B.open && !B.preview ? '🔒 ยังเข้าไม่ได้' : run ? null : !d.leader ? 'หัวหน้าปาร์ตี้เป็นคนพาเข้า' : needClear ? `ต้องผ่านระดับ${GD_DIFFS[D.needClear].th}ก่อน` : short.length ? `${short[0].name} เลเวลไม่ถึง` : null;
    const rooms = GD_BOSS_IDS.map((k) => { const b = GD_BOSSES[k]; return `<button class="gd-room ${b.open || b.preview ? '' : 'locked'}" data-k="${k}" style="--c:${b.color}" aria-pressed="${k === this.sel}">
      <canvas width="320" height="200"></canvas><img src="assets/td/gd/${k}.png" alt=""><span class="${b.open ? 'gd-open' : 'gd-lock'}">${b.open ? 'เปิดแล้ว' : b.preview ? '🧪 ทดลอง' : '🔒 เร็ว ๆ นี้'}</span>
      <span class="gd-cap"><b>${esc(b.nameTh)}</b><small>${esc(b.loot)}</small></span></button>`; }).join('');
    const diffs = Object.entries(GD_DIFFS).map(([k, v]) => `<button data-d="${k}" aria-pressed="${k === this.diff}" class="${(this.s.player?.char.level || 1) < v.req ? 'no' : ''}"><b>${v.th}</b><small>Lv.${v.req}+ · บอส Lv.${v.lv}</small></button>`).join('');
    const party = d.party.map((p) => `<div class="gd-p"><span>${JOB_IC[p.job] || '👤'}</span><span>${esc(p.name)} · Lv.${p.lv}</span>
      <span class="${p.lv < D.req ? 'bad' : !p.here ? 'warn' : 'ok'}">${p.lv < D.req ? `ต้อง Lv.${D.req}` : !p.here ? 'อยู่ไกล (ไม่ได้เข้า)' : '✓ พร้อม'}</span></div>`).join('');
    box.innerHTML = `<div class="gd-rooms">${rooms}</div>
      <div class="gd-detail" style="--c:${B.color}">
        <div class="gd-dh"><img src="assets/td/gd/${this.sel}.png" alt=""><div><h3>${esc(B.nameTh)}</h3><p>${esc(B.place)} · ${esc(B.loot)}</p></div></div>
        <p class="gd-gim">${B.open ? esc(B.gim) : B.preview ? `🧪 ลานทดลอง · กลไกและท่าครบแล้ว แต่ยังไม่มีหีบรางวัล<br><small>${esc(B.gim)}</small>` : '🔒 ลานนี้ยังไม่เปิด · หลวงตากำลังสวดเตรียมลาน (เปิดในอัปเดตถัดไป)'}</p>
        <div class="gd-diff">${diffs}</div>
        <div class="gd-stats">
          <div><small>เทียนนำวิญญาณ</small><b>${candles === null ? '∞ ฟื้นได้เรื่อย ๆ' : `${'🕯️'.repeat(Math.min(candles, 8))} ${candles}`}</b></div>
          <div><small>หีบวันนี้</small><b>${q.left} / ${q.max}</b></div>
          <div><small>เวลาในลาน</small><b>${mmss(GDG.timeMs)}</b></div>
        </div>
        <div class="gd-party">${party}</div>
        ${run ? `<button class="gd-go" data-go="join">ปาร์ตี้อยู่ใน${esc(GD_BOSSES[run.boss].nameTh)} (${GD_DIFFS[run.diff].th}) · ตามเข้าไป</button>`
          : `<button class="gd-go" data-go="1" ${why ? 'disabled' : ''}>${why || `${B.open ? '☠ พาปาร์ตี้เข้าลาน' : '🧪 พาปาร์ตี้เข้าลานทดลอง'} (${n - away.length}/${n} คน)`}</button>`}
        <p class="gd-hint">หัวหน้าปาร์ตี้กดเข้า · สมาชิกต้องยืนใกล้หลวงตา · ตายแล้วฟื้นที่ค่ายพักหน้าลาน (รอ ${D.wait / 1000} วิ) · หมอยาชุบไม่เสียเทียน</p>
      </div>`;
    box.querySelectorAll('.gd-room').forEach((r) => { this.paintArena(r.querySelector('canvas'), r.dataset.k); r.onclick = () => { this.sel = r.dataset.k; this.s.sfx?.play('click'); this.render(); }; });
    box.querySelectorAll('[data-d]').forEach((b) => (b.onclick = () => { this.diff = b.dataset.d; this.s.sfx?.play('click'); this.render(); }));
    box.querySelector('[data-go]').onclick = (e) => {
      if (e.currentTarget.disabled) return;
      this.s.net.send('gd:enter', { boss: run ? run.boss : this.sel, diff: run ? run.diff : this.diff });
      $('#gd-panel').classList.add('hidden');
    };
  }
  /** ภาพลานจำลองบนการ์ดห้อง */
  paintArena(cv, k) {
    const g = cv.getContext('2d'), W = cv.width, H = cv.height, base = ARENA[k];
    const gr = g.createRadialGradient(W / 2, H * 0.62, 10, W / 2, H * 0.62, W * 0.55); gr.addColorStop(0, base[1]); gr.addColorStop(1, '#0b0710'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 2; g.beginPath(); g.ellipse(W / 2, H * 0.62, 130, 52, 0, 0, Math.PI * 2); g.stroke();
    const ring = (n, f) => { for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 - Math.PI / 2; f(W / 2 + Math.cos(a) * 120, H * 0.62 + Math.sin(a) * 46); } };
    if (k === 'hung') ring(6, (x, y) => { g.fillStyle = '#6b4a2a'; g.fillRect(x - 3, y - 22, 6, 24); g.fillStyle = '#f3e6cf'; g.fillRect(x - 4, y - 24, 8, 3); });
    if (k === 'krasue') ring(8, (x, y) => { g.fillStyle = '#3d2a1c'; g.fillRect(x - 9, y - 8, 18, 10); g.fillStyle = '#5a3f28'; g.fillRect(x - 9, y - 11, 18, 4); });
    if (k === 'yat') ring(4, (x, y) => { g.fillStyle = '#4b3b2a'; g.beginPath(); g.ellipse(x, y - 6, 9, 11, 0, 0, Math.PI * 2); g.fill(); });
    if (k === 'pob') ring(7, (x, y) => { g.fillStyle = '#6d6a74'; g.fillRect(x - 5, y - 16, 10, 16); g.fillStyle = '#8a8792'; g.fillRect(x - 6, y - 18, 12, 3); });
  }

  // ---------------- ในลาน ----------------
  leave() { this.s.net.send('gd:leave', {}); }
  state(d) {
    if (Number.isFinite(d.now)) this.skew = d.now - Date.now();
    this.st = d; this.refresh(); this.paintPosts();
  }
  /** เปลี่ยนแมพ: ล้าง/สร้างหลักไม้ · เคลียร์ผลรางวัลเก่า */
  onMap() {
    this.clearWorld(); this.clearSkills(); this.st = null; this.spectating = false;
    this.hud.querySelector('.gd-res').classList.add('hidden');
    if (this.here) {
      this.loadFx();
      const L = this.s.layout;
      this.posts = (L.posts || []).map((p) => ({ ...p, ring: this.s.add.ellipse(p.x, p.y + 4, GD_POSTS.r * 2, GD_POSTS.r * 1.1, 0xfff1c0, 0.12).setDepth(0.9).setStrokeStyle(2, 0xfff1c0, 0.6) }));
      this.gfx = this.s.add.graphics().setDepth(99000);
      this.sg = this.s.add.graphics().setDepth(2.6);                               // ภาพเตือนท่าบอส (ใต้ตัวละคร)
      for (const p of this.posts) this.s.tweens.add({ targets: p.ring, alpha: 0.6, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    this.refresh();
  }
  clearWorld() { for (const p of this.posts || []) p.ring?.destroy(); this.posts = []; this.gfx?.destroy(); this.gfx = null; this.sg?.destroy(); this.sg = null; }
  paintPosts() {
    if (!this.posts?.length || !this.st) return;
    const bind = this.now < (this.st.bindUntil || 0);
    this.posts.forEach((p, i) => { const on = bind || this.st.lit?.[i]; p.ring.setFillStyle(on ? 0x7dffb0 : 0xfff1c0, on ? 0.3 : 0.12).setStrokeStyle(2, on ? 0x7dffb0 : 0xfff1c0, on ? 1 : 0.6); });
    const g = this.gfx; g.clear();
    if (bind) {                                                                       // สายสิญจน์: หลัก → หลัก + หลัก → บอส
      const boss = this.boss;
      g.lineStyle(2, 0xfff6dc, 0.85);
      this.posts.forEach((p, i) => { const q = this.posts[(i + 1) % this.posts.length]; g.lineBetween(p.x, p.y - 18, q.x, q.y - 18); if (boss) g.lineBetween(p.x, p.y - 18, boss.x, boss.y - 20); });
    }
  }
  get boss() { return this.s.mobs?.find((m) => m.def?.boss && m.alive); }
  refresh() {
    const h = this.hud; if (!h) return;
    h.classList.toggle('hidden', !this.here);
    document.body.classList.toggle('gd-on', this.here);                              // ซ่อนแถบบอสของเกม (กรอบนี้แทน)
    if (!this.here) return;
    const G = this.s.M.gd, S = this.st, B = GD_BOSSES[G.boss], D = GD_DIFFS[G.diff], now = this.now;
    h.querySelector('.gd-lv').textContent = `Lv.${D.lv}`;
    h.querySelector('.gd-name').textContent = B.nameTh;
    h.querySelector(".gd-dtag").textContent = D.th;
    h.querySelector('.gd-time').textContent = S ? `⏳ ${mmss(S.endAt - now)}` : '';
    const boss = this.s.mobs?.find((m) => m.def?.boss), max = boss?.maxHp || 1, hp = boss?.alive ? Math.max(0, boss.hp) : 0;
    h.querySelector('.gd-hp i').style.width = `${(hp / max) * 100}%`;
    h.querySelector('.gd-hp span').textContent = `${Math.round(hp).toLocaleString()} / ${Math.round(max).toLocaleString()} · ${Math.ceil((hp / max) * 100)}%`;
    h.querySelector('.gd-candles').textContent = !S || S.max === null ? '🕯️ ∞' : `🕯️ ${S.candles}/${S.max}`;
    h.querySelector('.gd-candles').classList.toggle('low', !!S && S.max !== null && S.candles <= 1);
    const bind = S && now < S.bindUntil, cd = S && !bind && now < S.nextBind;
    const MK = GD_MECH[G.boss], vuln = MK && S && now < (S.vulnUntil || 0), mine = MK && S?.carry?.[this.s.net?.selfId];
    if (MK) {
      const left = (S?.objs || []).filter((v) => v !== 0).length, all = S?.objs?.length || 0;
      h.querySelector('.gd-posts').innerHTML = mine ? `<b class="gd-carry">${G.boss === 'yat' ? '🏺 แบกโอ่ง → ไปสาดหยาดดำ!' : '🎋 ถือหวาย → ไปฟาดปอบ!'}</b>` : `${MK.objTh} ${left}/${all}`;
    } else h.querySelector('.gd-posts').innerHTML = !S || !S.posts ? '' : `หลักไม้ ${S.lit.map((on) => `<i class="${on || bind ? 'on' : ''}"></i>`).join('')}${cd ? ` <em>${Math.ceil((S.nextBind - now) / 1000)}s</em>` : ''}`;
    const tip = vuln ? `🎯 ${MK.vulnTh} ${Math.ceil((S.vulnUntil - now) / 1000)} วิ · ดาเมจ ×${MK.vulnMul}` : MK && !this.spectating ? `🛡 ผีรับดาเมจ ×${MK.guard}` : bind ? `🧵 ตรึงผี ${Math.ceil((S.bindUntil - now) / 1000)} วิ · ดาเมจ ×${GD_POSTS.mul}` : this.spectating ? '👻 เทียนหมด · ดูเพื่อนสู้ต่อ' : '';
    const split = this.fx.some((f) => f.k === 'split' && Date.now() < f.t1);
    h.querySelector('.gd-tip').textContent = split ? '🩸 ร่างเละ! ฆ่าหัว ลำตัว ขา ภายใน 5 วิ' : tip || '';
    const P = GD_PHASES[G.boss], ph = S?.ph || 1;
    h.querySelector('.gd-ph').textContent = `เฟส ${ph} · ${P?.names?.[ph - 1] || ''}`;
    h.querySelector('.gd-bar').classList.toggle('bind', !!bind || !!vuln);
    if (bind) this.paintPosts();
    else if (this.gfx && this._wasBind) this.paintPosts();
    this._wasBind = bind;
  }

  // ---------------- ท่าบอส ----------------
  /** ตำแหน่งผู้เล่นตาม id (ตัวเอง/คนอื่น) */
  posOf(pid) { if (pid === this.s.net?.selfId) return this.s.player; const r = this.s.remotes.get(pid); return r ? { x: r.x, y: r.y } : null; }
  castBanner(K, who) {
    const el = this.hud.querySelector('.gd-cast');
    el.querySelector('b').textContent = `⚠ ${K.nameTh}${who ? ` → ${who}` : ''}`;
    el.querySelector('small').textContent = K.how;
    el.classList.remove('hidden');
    clearTimeout(this._castT); this._castT = setTimeout(() => el.classList.add('hidden'), Math.max(2600, K.warn || 3000));
  }
  skill(d) {
    if (!this.here) return;
    const s = this.s, K = GD_SKILLS[d.k], now = Date.now(), me = s.net?.selfId;
    if (d.k === 'cancel') { this.clearSkills(); s.ui.toast('🧵 สายสิญจน์ขัดท่าผีไว้ได้!', 'ok', 1600); return; }
    if (d.k === 'splitEnd') { const bm = this.boss; if (bm) this.burst(bm.x, bm.y - 20, d.ok ? 0xffd76a : 0xff3b4a, 20, 90); }
    if (d.k === 'splitEnd') { this.fx = this.fx.filter((f) => f.k !== 'split'); s.ui.toast(d.ok ? '🩸 ฆ่าร่างเละครบ! ผีเสียเลือดและมึน' : '🩸 ร่างกลับคืน · ผีฟื้นเลือด', d.ok ? 'ok' : 'warn', 2400); return; }
    if (d.k === 'splitReset') { s.ui.toast('🩸 ฆ่าไม่ทัน 5 วิ · ชิ้นร่างกลับมาใหม่!', 'warn', 2000); return; }
    if (d.k === 'boom') {                                                             // ดาบเพชฌฆาตลง
      const b = s.add.ellipse(d.x, d.y, d.r * 2, d.r * 1.3, d.n <= 1 ? 0xff2d2d : 0xffc04a, 0.55).setDepth(2.7);
      s.tweens.add({ targets: b, alpha: 0, scale: 1.2, duration: 450, onComplete: () => b.destroy() });
      if (Math.hypot(s.player.x - d.x, s.player.y - d.y) < d.r + 80) { s.cameras.main.shake(260, 0.01); s.sfx?.play('skBoom'); }
      if (!this.playFx('execute', d.x, d.y, 0, GD_FX.execute[2], d.n <= 1 ? 0xffb0b0 : null)) this.slashFx(d.x, d.y, d.r, d.n <= 1 ? 0xff3b3b : 0xfff1c0);
      this.burst(d.x, d.y, d.n <= 1 ? 0xff3b3b : 0xffd76a, 16, d.r * 1.2);
      this.fx = this.fx.filter((f) => f.k !== 'execute');
      return;
    }
    if (d.k === 'lineEnd') { for (const f of this.fx) if (GD_SKILLS[f.k]?.type === 'line') this.lineFx(f, d.n); this.fx = this.fx.filter((f) => GD_SKILLS[f.k]?.type !== 'line'); if (d.heal) s.ui.toast('🩸 ปอบได้กินตับ · ฟื้นเลือด!', 'warn', 1600); if (d.n) s.cameras.main.shake(200, 0.008); return; }
    if (d.k === 'tetherEnd') { this.fx = this.fx.filter((f) => f.k !== 'tether'); return; }
    if (d.k === 'pounceHop') { s.bossAoe?.({ mid: d.mid, x: d.x, y: d.y, r: d.r, ms: d.ms, col: FXC.pounce }); this.leapFx(d.x, d.y, d.r, d.ms); return; }
    const m = s.mobs?.[d.mid];
    if (m?.alive && d.anim && hasDir8(s, m.d8id, d.anim)) playDir(m, d.anim, m.dir, true);
    else if (m?.alive) playDir(m, hasDir8(s, m.d8id, d.k) ? d.k : hasDir8(s, m.d8id, 'cast') ? 'cast' : 'attack', m.dir, true);   // ท่าเฉพาะสกิล (ดาบเพชฌฆาต/บ่วง) ถ้ามีภาพ
    const target = d.pid ? (d.pid === me ? 'คุณ!' : d.name) : '';
    this.castBanner(K, target);
    s.sfx?.play('skSlam');
    const f = { k: d.k, t0: now, t1: now + (d.ms || K.warn || 3000), d };
    const T = K.type;
    if (T === 'spots' || T === 'dark') for (const sp of d.spots) { s.bossAoe?.({ mid: -1, x: sp.x, y: sp.y, r: d.r, ms: d.ms, name: K.nameTh, col: FXC[d.k] }); this.dropFx(sp.x, sp.y, d.r, d.ms, FXC[d.k] || 0xff6b3d, d.k === 'drip', d.k); }
    if (T === 'pounce') { s.bossAoe?.({ mid: -1, x: d.x, y: d.y, r: d.r, ms: d.ms, name: K.nameTh, col: FXC.pounce }); this.leapFx(d.x, d.y, d.r, d.ms); }
    this.castFx(d, m);
    if (T === 'adds' && m) this.burst(m.x, m.y - 20, 0xb9a6d8, 14, 70);
    if (T === 'gaze' && m) this.burst(m.x, m.y - 70, 0x9a6dff, 10, 40);
    if (T === 'dark') { this.darkUntil = now + d.dark; s.ui.toast('🕯️ ตะเกียงดับ! มองเห็นแค่รอบตัว', 'warn', 2200); }
    if (T === 'blind' && d.pid === me) { this.blindUntil = now + d.ms; s.ui.toast('🖤 ผ้าคลุมบังตา! ให้เพื่อนนำทาง', 'warn', 2400); }
    if (T === 'tether' && d.pids?.includes(me)) s.ui.toast(`🪢 ไส้โยงคุณกับ ${d.names.find((n, i) => d.pids[i] !== me)} · อย่าห่างกันเกินเส้น`, 'warn', 2600);
    if (T === 'line' && d.pid === me) s.ui.toast(`⚠ ${K.nameTh} พุ่งมาทางคุณ! หลบออกจากแนว`, 'warn', 1500);
    if (T === 'gaze') s.ui.banner?.(`👁 ${K.nameTh}`, 'หันหลังให้ผี!');
    if (T === 'adds') s.ui.toast(`🐕 ${K.nameTh}: ผีโผล่ ${d.n} ตัว!`, 'warn', 2000);
    if (T && T !== 'line' && T !== 'tether' && T !== 'gaze') return;
    if (d.k === 'echo') for (const sp of d.spots) s.bossAoe?.({ mid: -1, x: sp.x, y: sp.y, r: d.r, ms: d.ms, name: K.nameTh });
    else this.fx.push(f);
    if (d.k === 'noose' && d.pid === me) s.ui.toast('🪢 คุณโดนบ่วงแขวนคอ! ขยับไม่ได้ · รอเพื่อนมายืนประกบ', 'warn', 3000);
    if (d.k === 'reverse') s.ui.toast('😵 วิญญาณสับสน! ทิศเดินกลับด้าน 6 วิ', 'warn', 2400);
    if (d.k === 'vortex') { s.ui.toast('🌀 วังวนความตาย! ลมดูดออกขอบลาน เดินเข้ากลาง', 'warn', 2400); s.cameras.main.shake(300, 0.004); }
  }
  clearSkills() { this.darkUntil = this.blindUntil = this.fearUntil = 0; this.fx = []; this.sg?.clear(); this.hud?.querySelector('.gd-cast')?.classList.add('hidden'); }
  /** กำลังโดนผลท่าบอส (ใช้ในลูปเดินของฉาก) */
  get reversed() { return this.fx.some((f) => f.k === 'reverse' && Date.now() < f.t1); }
  get rooted() { const me = this.s.net?.selfId; return Date.now() < (this.fearUntil || 0) || this.fx.some((f) => f.k === 'noose' && f.d.pid === me && Date.now() < f.t1); }
  /** แบกโอ่ง/หวาย = เดินช้าลง */
  speedMul() { const G = this.s.M?.gd, MK = G && GD_MECH[G.boss]; return MK?.slow && this.st?.carry?.[this.s.net?.selfId] ? MK.slow : 1; }
  onObj(d) {
    const s = this.s, MK = GD_MECH[s.M?.gd?.boss] || {};
    if (d.k === 'vuln') { s.ui.banner?.(`🎯 ${MK.vulnTh}!`, `${d.by ? d.by + ' · ' : ''}ดาเมจ ×${d.mul} นาน ${Math.round(d.ms / 1000)} วิ · รุมเลย!`); s.sfx?.play('levelup'); s.cameras.main.flash(300, 255, 240, 200); }
    else if (d.k === 'wrong') s.ui.toast(`⚰️ ${d.name} เปิดโลงผิด · ผีดิบลุก!`, 'warn', 2000);
    else if (d.k === 'pick') s.ui.toast(`${d.kind === 'jar' ? '🏺' : '🎋'} ${d.name} หยิบ${MK.objTh}แล้ว`, '', 1600);
    else if (d.k === 'reset') s.ui.toast('⚰️ โลงปิดกลับ · ร่างย้ายที่ใหม่!', '', 1800);
  }
  /** ต่อเฟรม: วาดวงเตือน · ลมดูด (วังวน) */
  update(delta = 16) {
    if (!this.here || !this.sg) return;
    const s = this.s, g = this.sg, now = Date.now(), p = s.player;
    g.clear();
    this.fx = this.fx.filter((f) => now < f.t1 + 100);
    this.drawObjs(g, now);
    this.drawDark(now);
    for (const f of this.fx) {
      const k = Math.min(1, (now - f.t0) / (f.t1 - f.t0)), d = f.d, T = GD_SKILLS[f.k]?.type;
      if (T === 'line') {                                                             // แนวพุ่ง (กว้าง w)
        const ang = Math.atan2(d.b.y - d.a.y, d.b.x - d.a.x), nx = -Math.sin(ang) * d.w / 2, ny = Math.cos(ang) * d.w / 2;
        const pts = [{ x: d.a.x + nx, y: d.a.y + ny }, { x: d.b.x + nx, y: d.b.y + ny }, { x: d.b.x - nx, y: d.b.y - ny }, { x: d.a.x - nx, y: d.a.y - ny }];
        const c = FXC[f.k] || 0xff3b30, len = Math.hypot(d.b.x - d.a.x, d.b.y - d.a.y), ux = Math.cos(ang), uy = Math.sin(ang);
        g.fillStyle(c, 0.1 + 0.18 * k).fillPoints(pts, true); g.lineStyle(2, c, 0.9).strokePoints(pts, true);
        g.fillStyle(c, 0.35).fillPoints([pts[0], { x: d.a.x + nx + ux * len * k, y: d.a.y + ny + uy * len * k }, { x: d.a.x - nx + ux * len * k, y: d.a.y - ny + uy * len * k }, pts[3]], true);   // แถบเติมตามเวลาที่เหลือ
        for (let o = (now / 6) % 34; o < len - 10; o += 34) {                           // ลูกศรไหลตามทิศพุ่ง
          const cx = d.a.x + ux * o, cy = d.a.y + uy * o, w2 = d.w * 0.3;
          g.lineStyle(3, 0xffffff, 0.55).beginPath(); g.moveTo(cx - ux * 8 + nx * 0.6, cy - uy * 8 + ny * 0.6); g.lineTo(cx, cy); g.lineTo(cx - ux * 8 - nx * 0.6, cy - uy * 8 - ny * 0.6); g.strokePath();
        }
        continue;
      }
      if (T === 'tether') {                                                           // ไส้โยง: เขียว = ใกล้พอ · แดง = ห่างเกิน
        const a = this.posOf(d.pids[0]), b = this.posOf(d.pids[1]); if (!a || !b) continue;
        const far = Math.hypot(a.x - b.x, a.y - b.y) > d.len;
        const wob = Math.sin(now / 90) * 6, mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - 14 + wob;   // ไส้ห้อยโค้ง
        g.lineStyle(6, far ? 0xff3b30 : 0x6dffb0, 0.35).beginPath(); g.moveTo(a.x, a.y - 14); g.lineTo(mx, my + 10); g.lineTo(b.x, b.y - 14); g.strokePath();
        g.lineStyle(3, far ? 0xff8a7a : 0xb8ffd8, 0.95).beginPath(); g.moveTo(a.x, a.y - 14); g.lineTo(mx, my + 10); g.lineTo(b.x, b.y - 14); g.strokePath();
        continue;
      }
      if (T === 'gaze') {                                                             // ตาบอสค่อย ๆ ลืม + คลื่นเสียง/แรงกดดันแผ่ออก
        const m = this.boss; if (!m) continue;
        const wc = FXC[f.k] || 0x9a6dff;
        for (let i = 0; i < 3; i++) { const rr = ((now / 5 + i * 60) % 180); g.lineStyle(3, wc, 0.6 * (1 - rr / 180)).strokeEllipse(m.x, m.y - 10, rr * 2, rr * 1.3); }
        g.fillStyle(0xffffff, 0.15 + 0.5 * k).fillEllipse(m.x, m.y - 70, 46, 18); g.fillStyle(0x9a6dff, 0.6 + 0.4 * k).fillCircle(m.x, m.y - 70, 7);
        continue;
      }
      if (f.k === 'execute') {                                                        // วงแบ่งดาบ (ตามตัวเป้า) · เหลือง = ยืนรวมกัน
        const c = this.posOf(d.pid); if (!c) continue;
        g.fillStyle(0xffc04a, 0.12 + 0.18 * k).fillEllipse(c.x, c.y, d.r * 2, d.r * 1.3);
        g.lineStyle(2, 0xffd76a, 0.9).strokeEllipse(c.x, c.y, d.r * 2, d.r * 1.3);
        g.fillStyle(0xffe9a8, 0.35).fillEllipse(c.x, c.y, d.r * 2 * k, d.r * 1.3 * k);
      } else if (f.k === 'noose') {                                                   // เชือกจากฟ้า + วงให้เพื่อนมายืน
        const c = this.posOf(d.pid); if (!c) continue;
        g.lineStyle(3, 0xc9a26b, 0.95).lineBetween(c.x, c.y - 30, c.x, c.y - 140);
        g.lineStyle(2, 0x7dffb0, 0.8).strokeEllipse(c.x, c.y, d.help * 2, d.help * 1.3);
      } else if (f.k === 'reverse') {                                                 // บ่อเลือด
        for (const q of d.pools) { g.fillStyle(0x8a0f1a, 0.55).fillEllipse(q.x, q.y, d.r * 2, d.r * 1.3); g.lineStyle(1, 0xff4a5a, 0.8).strokeEllipse(q.x, q.y, d.r * 2, d.r * 1.3); }
      } else if (f.k === 'vortex') {                                                  // ขอบหนาม + ลมดูด
        g.lineStyle(4, 0xff3b30, 0.55 + 0.25 * Math.sin(now / 120)).strokeEllipse(d.x, d.y, d.r * 2, d.r * 2 * 0.95);
        g.lineStyle(1, 0xd8d0ff, 0.35);
        for (let i = 0; i < 10; i++) { const a = now / 600 + (i / 10) * Math.PI * 2; g.lineBetween(d.x + Math.cos(a) * 60, d.y + Math.sin(a) * 50, d.x + Math.cos(a + 0.5) * d.r * 0.9, d.y + Math.sin(a + 0.5) * d.r * 0.85); }
        if (p.alive && now < f.t1) {                                                 // ดูดออกจากกลาง (ชนกำแพงหยุด)
          const dx = p.x - d.x, dy = p.y - d.y, len = Math.hypot(dx, dy) || 1, step = (d.pull * delta) / 1000;
          const nx = p.x + (dx / len) * step, ny = p.y + (dy / len) * step;
          if (!s.solid?.[Math.floor((ny - 2) / 16)]?.[Math.floor(nx / 16)]) p.setPosition(nx, ny);
        }
      }
    }
  }
  // ---------------- เอฟเฟกต์ท่า ----------------
  /** โหลดชีตเอฟเฟกต์ (ครั้งแรกที่เข้าลาน) */
  loadFx() {
    const s = this.s, need = [...new Map(Object.values(GD_FX).map((F) => [F[0], F])).values()].filter(([key]) => !s.textures.exists(key));
    const mk = () => { for (const [key] of Object.values(GD_FX)) if (s.textures.exists(key) && !s.anims.exists(key)) s.anims.create({ key, frames: s.anims.generateFrameNumbers(key), frameRate: FX_FPS }); };
    if (!need.length) return mk();
    for (const [key, cell] of need) s.load.spritesheet(key, `/assets/td/fx/${key}.png`, { frameWidth: cell, frameHeight: cell });
    s.load.once('complete', mk); s.load.start();
  }
  /** เล่นชีตเอฟเฟกต์ที่ (x,y) = จุดตกกระทบ · delay ms · start = เฟรมเริ่ม · คืน false ถ้ายังไม่มีชีต */
  playFx(k, x, y, delay = 0, start = 0, tint = null) {
    const s = this.s, F = GD_FX[k];
    if (!F || !s.anims.exists(F[0])) return false;
    s.time.delayedCall(delay, () => {
      if (!this.here) return;
      const sp = s.add.sprite(x, y, F[0], start).setOrigin(0.5, 0.62).setDepth(y + 4);
      if (tint) sp.setTint(tint);
      sp.play({ key: F[0], startFrame: start });
      sp.once('animationcomplete', () => sp.destroy());
    });
    return true;
  }
  /** คมดาบโค้งฟาดลง (ดาบเพชฌฆาต) */
  slashFx(x, y, r, col) {
    const s = this.s, g = s.add.graphics().setDepth(y + 70).setBlendMode(Phaser.BlendModes.ADD);
    g.lineStyle(10, col, 0.9).beginPath(); g.arc(x, y - 30, r * 0.9, Math.PI * 0.15, Math.PI * 0.85, false); g.strokePath();
    g.lineStyle(4, 0xffffff, 1).beginPath(); g.arc(x, y - 30, r * 0.9, Math.PI * 0.2, Math.PI * 0.8, false); g.strokePath();
    s.tweens.add({ targets: g, alpha: 0, y: 14, duration: 380, ease: 'Cubic.Out', onComplete: () => g.destroy() });
  }
  /** เอฟเฟกต์ตอนบอสร่ายท่า (ทุกบอส) */
  castFx(d, m) {
    const s = this.s, c = FXC[d.k], me = s.net?.selfId;
    if (m && c) this.burst(m.x, m.y - 30, c, 10, 50);                                // ออร่าตอนร่าย
    if (d.k === 'echo') for (const sp of d.spots || []) {                            // ศพเงาลุกขึ้นตรงจุดที่ยืน แล้วระเบิด
      const sh = s.add.ellipse(sp.x, sp.y - 16, 22, 40, 0x2a2f3e, 0.75).setDepth(sp.y + 10).setScale(1, 0.1);
      s.tweens.add({ targets: sh, scaleY: 1, duration: 400, ease: 'Back.Out' });
      s.time.delayedCall(Math.max(0, d.ms - 50), () => { sh.destroy(); if (this.here) this.burst(sp.x, sp.y - 16, 0xb8c4e0, 12, 46); });
    }
    if (d.k === 'noose') { const c2 = this.posOf(d.pid); if (c2) this.burst(c2.x, c2.y - 40, 0xc9a26b, 12, 40); }
    if (d.k === 'reverse') for (const q of d.pools || []) this.burst(q.x, q.y, 0xff3b4a, 8, d.r);
    if (d.k === 'vortex') for (let i = 0; i < 6; i++) s.time.delayedCall(i * 800, () => { if (!this.here) return; for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + i; this.burst(d.x + Math.cos(a) * d.r * 0.85, d.y + Math.sin(a) * d.r * 0.8, 0xd8d0ff, 2, 30); } });
    if (d.k === 'split' && m) { this.burst(m.x, m.y - 20, 0xff3b4a, 24, 110); s.cameras.main.shake(300, 0.012); }
    if (d.k === 'tether') for (const pid of d.pids || []) { const c2 = this.posOf(pid); if (c2) this.burst(c2.x, c2.y - 14, 0x6dffb0, 10, 36); }
    if (d.k === 'shroud') { const c2 = this.posOf(d.pid); if (c2) { const cl = s.add.ellipse(c2.x, c2.y - 120, 60, 40, 0x120a1c, 0.9).setDepth(c2.y + 90); s.tweens.add({ targets: cl, y: c2.y - 20, scaleX: 0.7, alpha: 0, duration: 600, ease: 'Quad.In', onComplete: () => cl.destroy() }); } }
    if (d.k === 'dark' && m) this.burst(m.x, m.y - 30, 0x0a0f0c, 20, 140);
  }
  /** ประกายกระจาย */
  burst(x, y, col, n = 10, dist = 50) {
    const s = this.s, ADD = Phaser.BlendModes.ADD;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4, img = s.add.image(x, y, 'fx_spark').setTint(col).setScale(0.35 + Math.random() * 0.25).setBlendMode(ADD).setDepth(y + 60);
      s.tweens.add({ targets: img, x: x + Math.cos(a) * dist * (0.6 + Math.random() * 0.6), y: y + Math.sin(a) * dist * 0.6 * (0.6 + Math.random() * 0.6), alpha: 0, scale: 0.05, duration: 420 + Math.random() * 200, onComplete: () => img.destroy() });
    }
  }
  /** ไฟผีตก / หยดน้ำดำ: ลูกไฟตกจากฟ้าลงกลางวง แล้วแตก */
  dropFx(x, y, r, ms, col, drip, k) {
    const s = this.s, F = GD_FX[k];
    if (F && this.playFx(k, x, y, Math.max(0, ms - (F[2] * 1000) / FX_FPS))) return;     // ชีต Blender: ให้จังหวะตกกระทบตรงเวลาท่าลง
    s.time.delayedCall(Math.max(0, ms - 380), () => {
      if (!this.here) return;
      const img = s.add.image(x, y - 160, 'fx_glow').setTint(col).setDisplaySize(drip ? 12 : 30, drip ? 22 : 30).setBlendMode(Phaser.BlendModes.ADD).setDepth(y + 80);
      s.tweens.add({ targets: img, y, duration: 380, ease: 'Quad.In', onComplete: () => {
        img.destroy();
        const ring = s.add.ellipse(x, y, r * 0.6, r * 0.4, col, 0.7).setDepth(2.7).setBlendMode(Phaser.BlendModes.ADD);
        s.tweens.add({ targets: ring, scale: 3.4, alpha: 0, duration: 380, onComplete: () => ring.destroy() });
        this.burst(x, y - 6, col, drip ? 6 : 10, r);
      } });
    });
  }
  /** กระโจน: เงาบอสลอยข้ามไปลง + ฝุ่นตอนลง */
  leapFx(x, y, r, ms) {
    const s = this.s, m = this.boss;
    s.time.delayedCall(Math.max(0, ms - 260), () => {
      if (m?.active) s.tweens.add({ targets: m, x, y, duration: 240, ease: 'Quad.Out' });
      s.time.delayedCall(240 - (GD_FX.pounce[2] * 1000) / FX_FPS, () => this.playFx('pounce', x, y));
      s.time.delayedCall(240, () => { if (!this.s.anims.exists(GD_FX.pounce[0])) this.burst(x, y, 0xd8a060, 14, r * 1.3); if (Math.hypot(s.player.x - x, s.player.y - y) < r + 120) s.cameras.main.shake(180, 0.008); });
    });
  }
  /** จบท่าพุ่ง: ลำแสง/ลิ้น/รอยคลานตามแนว + บอสพุ่งไปปลายทาง */
  lineFx(f, hits) {
    const s = this.s, d = f.d, c = FXC[f.k] || 0xff6b5a, ADD = Phaser.BlendModes.ADD;
    const ang = Math.atan2(d.b.y - d.a.y, d.b.x - d.a.x), len = Math.hypot(d.b.x - d.a.x, d.b.y - d.a.y), cx = (d.a.x + d.b.x) / 2, cy = (d.a.y + d.b.y) / 2;
    if (f.k === 'tongue') {                                                           // ลิ้นยาวพุ่งออกแล้วหดกลับ
      const tg = s.add.rectangle(d.a.x, d.a.y - 22, len, 10, 0xff6b8a, 1).setOrigin(0, 0.5).setRotation(ang).setDepth(cy + 40).setScale(0, 1);
      const tip = s.add.ellipse(d.a.x, d.a.y - 22, 18, 14, 0xff3b60, 1).setDepth(cy + 41);
      s.tweens.add({ targets: tg, scaleX: 1, duration: 140, yoyo: true, hold: 120, onUpdate: () => tip.setPosition(d.a.x + Math.cos(ang) * len * tg.scaleX, d.a.y - 22 + Math.sin(ang) * len * tg.scaleX), onComplete: () => { tg.destroy(); tip.destroy(); } });
    } else {
      const beam = s.add.rectangle(cx, cy, len, d.w, c, 0.5).setRotation(ang).setDepth(2.8).setBlendMode(ADD);
      const core = s.add.rectangle(cx, cy, len, Math.max(4, d.w * 0.18), 0xffffff, 0.85).setRotation(ang).setDepth(2.81).setBlendMode(ADD);
      s.tweens.add({ targets: [beam, core], alpha: 0, scaleY: 0.15, duration: 420, ease: 'Cubic.Out', onComplete: () => { beam.destroy(); core.destroy(); } });
      const m = this.boss;                                                             // บอสพุ่งไปปลายแนว (ภาพ · server ย้ายตำแหน่งจริงแล้ว)
      if (m?.active && GD_SKILLS[f.k]?.dash) {
        const ghost = s.add.image(m.x, m.y, m.texture.key, m.frame.name).setOrigin(m.originX, m.originY).setScale(m.scaleX, m.scaleY).setFlipX(m.flipX).setTint(c).setAlpha(0.55).setBlendMode(ADD).setDepth(m.depth - 1);
        s.tweens.add({ targets: ghost, alpha: 0, duration: 380, onComplete: () => ghost.destroy() });
        s.tweens.add({ targets: m, x: d.b.x, y: d.b.y, duration: 200, ease: 'Quad.In' });
      }
    }
    for (let i = 0; i <= 8; i++) { const k = i / 8; this.burst(d.a.x + (d.b.x - d.a.x) * k, d.a.y + (d.b.y - d.a.y) * k, c, 3, 26); }
    if (hits) s.cameras.main.shake(220, 0.01);
    s.sfx?.play(f.k === 'tongue' ? 'skSlam' : 'skBoom');
  }
  /** โลง/โอ่ง/หวาย: วงรอบของ + วงความคืบหน้า · คนที่แบกอยู่มีวงใต้เท้า · ช่วงจุดอ่อน = วงทองรอบบอส */
  drawObjs(g, now) {
    const G = this.s.M?.gd, MK = G && GD_MECH[G.boss], L = this.s.layout; if (!MK || !L?.objs?.length) return;
    const st = this.st?.objs || [], col = { coffin: 0x8fe3b0, jar: 0x8fd0ff, rattan: 0xe8c38a }[L.objs[0].kind] || 0xffffff;
    L.objs.forEach((o, i) => {
      const v = st[i] ?? -1; if (v === 0) return;
      g.lineStyle(2, col, 0.5 + 0.3 * Math.sin(now / 300 + i)).strokeEllipse(o.x, o.y + 6, MK.r * 2, MK.r * 1.2);
      if (v > 0) { g.fillStyle(col, 0.35).fillEllipse(o.x, o.y + 6, MK.r * 2 * v, MK.r * 1.2 * v); g.lineStyle(4, 0xffffff, 0.9).beginPath(); g.arc(o.x, o.y - 30, 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * v); g.strokePath(); }
    });
    for (const pid of Object.keys(this.st?.carry || {})) { const c = this.posOf(pid); if (c) { g.lineStyle(3, col, 0.9).strokeEllipse(c.x, c.y + 2, 34, 18); g.fillStyle(col, 0.9).fillCircle(c.x, c.y - 52, 6); } }
    const m = this.boss;
    if (m && this.now < (this.st?.vulnUntil || 0)) g.lineStyle(3, 0xffd76a, 0.6 + 0.3 * Math.sin(now / 90)).strokeEllipse(m.x, m.y + 2, 70, 34);
  }
  /** ดับตะเกียง (ทั้งลาน) / ผ้าคลุมบังตา (คนเดียว): มืดเหลือแสงรอบตัว */
  drawDark(now) {
    let el = this.darkEl;
    const on = now < (this.darkUntil || 0) || now < (this.blindUntil || 0);
    if (!on) { if (el) el.style.display = 'none'; return; }
    if (!el) { el = this.darkEl = document.createElement('div'); el.className = 'gd-dark'; this.hud.appendChild(el); }
    const wv = this.s.cameras.main.worldView, p = this.s.player, blind = now < (this.blindUntil || 0);
    const x = ((p.x - wv.x) / wv.width) * 100, y = ((p.y - 20 - wv.y) / wv.height) * 100;
    el.style.display = 'block';
    el.style.background = `radial-gradient(circle at ${x}% ${y}%, transparent ${blind ? 4 : 9}cqh, rgba(4,2,8,.95) ${blind ? 9 : 17}cqh)`;
  }
  result(r) {
    const el = this.hud.querySelector('.gd-res'), B = GD_BOSSES[r.boss] || {}, D = GD_DIFFS[r.diff] || {};
    const items = (r.items || []).map((it) => { const I = ITEMS[it.id]; return `<li class="r-${rarityOf(I) || 'common'}">${I?.icon || '🎁'} ${esc(I?.nameTh || it.id)}${it.qty > 1 ? ` ×${it.qty}` : ''}${I?.affixN ? ` <em>${I.affixN} ค่าสุ่ม</em>` : ''}</li>`; }).join('');
    el.innerHTML = r.win
      ? `<h3>🏆 ปราบ${esc(B.nameTh)} (${esc(D.th)}) สำเร็จ!</h3>${r.noChest ? '<p>วันนี้เปิดหีบบอสนี้ครบแล้ว · ได้เครดิตผ่านด่าน</p>' : `<p>หีบรางวัล · เหลือวันนี้ ${r.left} ใบ</p><ul>${items}</ul>`}<small>ลานจะปิดใน ${Math.round(r.closeMs / 1000)} วิ</small><button class="gd-close">ตกลง</button>`
      : `<h3>💀 ล้มเหลว</h3><p>${esc(r.reason || '')}</p><small>กลับหน้าหลวงตาใน ${Math.round(r.closeMs / 1000)} วิ</small><button class="gd-close">ตกลง</button>`;
    el.classList.remove('hidden');
    el.querySelector('.gd-close').onclick = () => el.classList.add('hidden');
    for (const it of r.items || []) this.s.ui.loot?.(`ได้ ${ITEMS[it.id]?.nameTh || it.id} x${it.qty}`, rarityOf(ITEMS[it.id]));
    this.s.sfx?.play(r.win ? 'victory' : 'die');
  }
}
