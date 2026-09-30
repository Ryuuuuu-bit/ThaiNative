// ============================================================
//  บอสโลก "พระราหู ผู้กลืนจันทร์" – ฝั่ง client
//  ▸ HUD: แถบประกาศ + ปุ่มวาร์ป · แถบเลือดบอส/เฟส/เวลา · ป้ายชื่อท่า + วิธีหลบ · ผลรางวัล/อันดับ
//  ▸ ภาพเตือนท่าบนพื้น (ม่วง = ดาเมจ · เงิน = ปลอดภัย/เป้า · แดง = อันตรายสูง) + กับดักในลาน
//  ▸ ป้าย ★ MVP ★ เหนือหัวคนปิดฉาก 10 นาที (ทุกคนเห็น)
// ============================================================
import { makeText, itemIcon } from '../systems/util.js';
import { ITEMS } from '/shared/data/items.js';
import { WB_MAP, ARENA_C, PHASES, WB_SKILLS } from '/shared/data/worldboss.js';

const COL = { purple: 0x9b6bff, silver: 0xe8edf8, red: 0xff4136 };
const $ = (s) => document.querySelector(s);
const mmss = (ms) => { ms = Math.max(0, ms); const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class WorldBossUI {
  constructor(scene) {
    this.s = scene; this.st = { state: 'idle' }; this.skew = 0; this.tele = new Map(); this.decor = []; this.fires = []; this.mvp = null; this.mvpTags = new Map();   // skew = เวลา server − เวลาเครื่องนี้
    const hud = document.createElement('div'); hud.id = 'wb-hud'; hud.innerHTML = `
      <div class="wb-ann hidden"><span class="wb-ic">🌑</span><div class="wb-txt"><b>พระราหู ผู้กลืนจันทร์</b><small></small></div><button class="wb-go">ไปลานสุริยคราส</button></div>
      <div class="wb-bar hidden"><div class="wb-top"><b>🌑 พระราหู ผู้กลืนจันทร์ <em class="lv">Lv.150</em></b><span class="wb-ph"></span><span class="wb-time"></span></div>
        <div class="wb-hpbar"><i></i><span></span></div><div class="wb-btm"><small class="wb-tip"></small><button class="wb-leave">ออกจากลาน</button></div></div>
      <div class="wb-cast hidden"><b></b><small></small></div>
      <div class="wb-res hidden"></div>`;
    ($('#td-hud') || document.body).appendChild(hud); this.hud = hud;
    hud.querySelector('.wb-go').onclick = () => this.go();
    hud.querySelector('.wb-leave').onclick = () => this.leave();
    this.timer = setInterval(() => this.refresh(), 500);
    scene.events.once('shutdown', () => this.destroy());
  }
  destroy() { clearInterval(this.timer); this.hud?.remove(); this.clearWorld(); }
  /** เปลี่ยนแมพ: ล้างภาพในลานเก่า · เข้าลาน = วาดกับดัก */
  onMap() { this.clearWorld(); if (this.here) this.buildDecor(); this.refresh(); }
  get here() { return this.s.M?.id === WB_MAP; }
  get boss() { return this.s.mobs?.find((m) => m.spawn?.wb === 'boss'); }

  // ---------------- เครือข่าย ----------------
  bind(net) {
    net.on('wb:status', (d) => this.status(d)).on('wb:phase', (d) => this.phase(d)).on('wb:tele', (t) => this.drawTele(t)).on('wb:land', (d) => this.land(d))
      .on('wb:cast', (d) => this.castBanner(d)).on('wb:crystal', (d) => this.crystals(d)).on('wb:crack', (d) => this.s.ui.toast(`💎 ${d.by || ''} ทุบผลึกจันทร์แตก!`, 'ok', 1800))
      .on('wb:heal', () => { this.s.ui.toast('🌕 ผลึกที่เหลือถูกดูดเข้าจันทร์ · พระราหูฟื้นเลือด!', 'warn', 2400); this.s.cameras.main.flash(300, 230, 230, 255); })
      .on('wb:pull', (d) => this.pull(d)).on('wb:fire', (d) => this.fire(d)).on('wb:hp', (d) => this.hp(d)).on('wb:clear', () => this.clearTele())
      .on('wb:mvp', (m) => { this.mvp = m; }).on('wb:reward', (r) => this.reward(r)).on('wb:board', () => {});
  }
  go() { this.s.net.socket?.emit('wb:go', {}, (r) => { if (!r?.ok) this.s.ui.toast(r?.msg || 'ไปไม่ได้', 'warn', 2200); }); }
  leave() { this.s.net.socket?.emit('wb:leave', {}, () => {}); }

  /** เวลาปัจจุบันตามนาฬิกา server (กันนาฬิกาเครื่องเพี้ยน) */
  get now() { return Date.now() + this.skew; }
  sync(t) { if (Number.isFinite(t)) this.skew = t - Date.now(); }
  status(d) {
    this.sync(d.now);
    const was = this.st.state;
    this.st = { ...this.st, ...d };
    if (d.mvp !== undefined) this.mvp = d.mvp;
    if (d.maxHp) this.setBossMax(d.maxHp, d.hp);
    for (const c of d.crystals || []) { const m = this.s.mobs?.[c.mid]; if (m) { m.maxHp = c.maxHp; m.hp = c.hp; } }
    if (this.here) this.buildDecor();
    if (was !== d.state && d.state === 'fight' && !this.here) this.s.ui.banner('🌑 พระราหูลงมาแล้ว!', 'กดปุ่ม "ไปลานสุริยคราส" เพื่อร่วมปราบ');
    this.refresh();
  }
  hp({ hp, maxHp, phase, end, now }) {
    this.sync(now); Object.assign(this.st, { hp, maxHp, phase, fightEnd: end, state: 'fight' }); this.setBossMax(maxHp, hp); this.refresh(); }
  setBossMax(maxHp, hp) { const b = this.boss; if (b) { b.maxHp = maxHp; if (hp != null && b.alive) b.hp = hp; } }
  phase({ n, nameTh }) {
    this.st.phase = n;
    this.s.ui.banner(`เฟส ${n} · ${nameTh}`, n === 4 ? 'พระราหูคลั่ง! ทุกท่าเร็วขึ้น' : n === 3 ? 'ระวังเสาเพลิงนรก' : n === 2 ? 'ระวังยันต์ระเบิดบนพื้น' : '');
    this.s.cameras.main.flash(260, 120, 80, 200); this.s.sfx?.play('skThunder');
    if (this.here) this.buildDecor();
  }

  // ---------------- HUD ----------------
  refresh() {
    const S = this.st, now = this.now, H = this.hud;
    const ann = H.querySelector('.wb-ann'), bar = H.querySelector('.wb-bar');
    const showAnn = !this.here && (S.state === 'open' || S.state === 'fight');
    ann.classList.toggle('hidden', !showAnn);
    if (showAnn) ann.querySelector('small').textContent = S.state === 'open' ? `ลงมาในอีก ${mmss(S.at - now)} · วาร์ปรอที่ค่ายรอคราสได้เลย` : `กำลังสู้อยู่! เลือดเหลือ ${S.maxHp ? Math.round(S.hp / S.maxHp * 100) : 100}% · เหลือเวลา ${mmss(S.fightEnd - now)}`;
    const showBar = this.here && S.state !== 'idle';
    bar.classList.toggle('hidden', !showBar);
    document.body.classList.toggle('wb-on', showBar);           // แถบบอสโลกแสดงอยู่ → ซ่อนกรอบเป้าหมาย/บาร์บอสทั่วไป (กันทับกัน)
    if (showBar) {
      const pctv = S.state === 'fight' && S.maxHp ? S.hp / S.maxHp : S.state === 'open' ? 1 : 0;
      bar.querySelector('.wb-hpbar i').style.width = `${Math.max(0, pctv * 100)}%`;
      bar.querySelector('.wb-hpbar span').textContent = S.state === 'fight' ? `${Math.round(S.hp).toLocaleString()} / ${S.maxHp.toLocaleString()} (${(pctv * 100).toFixed(1)}%)` : S.state === 'open' ? 'รอพระราหูลงมา…' : 'จบการต่อสู้';
      bar.querySelector('.wb-ph').textContent = S.state === 'fight' && S.phase ? `เฟส ${S.phase} · ${PHASES[S.phase - 1].nameTh}` : '';
      bar.querySelector('.lv').textContent = S.state === 'fight' ? `ขั้น ${S.tier || 5} · Lv.${S.lv || 150}` : '';   // ราหูโตตามเซิร์ฟ (ขั้น 1–5)
      bar.querySelector('.wb-time').textContent = S.state === 'open' ? `⏳ ${mmss(S.at - now)}` : S.state === 'fight' ? `⏱ ${mmss(S.fightEnd - now)}` : S.state === 'ended' ? `ปิดลานใน ${mmss(S.closeAt - now)}` : '';
      bar.querySelector('.wb-tip').textContent = S.state === 'open' ? `ออนไลน์ในค่าย ${S.online ?? '-'} คน · ม่วง = ดาเมจ · เงิน = ที่ปลอดภัย/เป้าให้ตี · แดง = อันตรายสูง` : '';
    }
  }
  castBanner({ k, nameTh, tip }) {
    if (!this.here) return;
    const el = this.hud.querySelector('.wb-cast'), sk = WB_SKILLS[k];
    el.className = `wb-cast c-${sk?.color || 'purple'}`;
    el.querySelector('b').textContent = nameTh; el.querySelector('small').textContent = tip || '';
    clearTimeout(this.castT); this.castT = setTimeout(() => el.classList.add('hidden'), 2600);
  }
  reward(r) {
    const el = this.hud.querySelector('.wb-res');
    const items = (r.items || []).map((it) => `<span class="wb-it${it.red ? ' red' : ''}${it.card ? ' card' : ''}" data-tip-item="${esc(it.id)}">${itemIcon(it.id, ITEMS[it.id]?.icon || '')}<em>${esc(ITEMS[it.id]?.nameTh || it.id)} ×${it.qty}</em></span>`).join('');
    const board = (r.board || []).map((b) => `<li><b>${b.rank}</b> ${esc(b.name)}<i>${b.pct}%</i></li>`).join('');
    el.innerHTML = `<div class="wb-res-h">${r.win ? '🌕 ปราบพระราหูสำเร็จ!' : '🌘 หมดเวลา · พระราหูหนีไปแล้ว'}</div>
      ${r.mvp ? '<div class="wb-mvp">★ คุณคือ MVP แห่งสุริยคราส ★</div>' : ''}
      <div class="wb-me">อันดับดาเมจของคุณ <b>#${r.rank}</b> · ${r.pct}% ของเลือดบอส</div>
      ${r.exp || r.gold ? `<div class="wb-gain">+${(r.exp || 0).toLocaleString()} EXP · +฿${(r.gold || 0).toLocaleString()}</div>` : '<div class="wb-gain muted">ดาเมจไม่ถึง 0.5% · ยังไม่ได้รางวัล</div>'}
      <div class="wb-items">${items}</div><ol class="wb-board">${board}</ol><button class="wb-ok">ตกลง</button>`;
    el.classList.remove('hidden');
    el.querySelector('.wb-ok').onclick = () => el.classList.add('hidden');
    this.s.sfx?.play(r.win ? 'levelup' : 'npc');
  }

  // ---------------- ภาพบนพื้น ----------------
  clearWorld() { this.clearTele(); for (const o of this.decor) o.destroy?.(); this.decor = []; for (const t of this.mvpTags.values()) t.destroy(); this.mvpTags.clear(); }
  clearTele() { for (const t of this.tele.values()) t.objs.forEach((o) => o.destroy?.()); this.tele.clear(); for (const f of this.fires) f.g.destroy(); this.fires = []; }
  /** กับดักถาวรในลาน (เห็นตลอดช่วงอีเวนต์) */
  buildDecor() {
    for (const o of this.decor) o.destroy?.(); this.decor = [];
    if (!this.here || this.st.state === 'idle') return;
    const s = this.s, g = s.add.graphics().setDepth(2.2); this.decor.push(g);
    for (const p of this.st.pools || []) {                           // บ่อเงาดูด
      g.fillStyle(0x1a0f3a, 0.55).fillEllipse(p.x, p.y, p.r * 2, p.r * 1.4);
      g.lineStyle(2, 0x6a4bc4, 0.8).strokeEllipse(p.x, p.y, p.r * 2, p.r * 1.4);
    }
    for (const t of this.st.thorns || []) { g.lineStyle(1, 0x8e3b3b, 0.7).strokeRect(t.x - t.h, t.y - t.h, t.h * 2, t.h * 2); for (let i = 0; i < 4; i++) g.fillStyle(0x5a2a2a, 0.7).fillTriangle(t.x - t.h + 6 + i * 11, t.y + 4, t.x - t.h + 10 + i * 11, t.y - 6, t.x - t.h + 14 + i * 11, t.y + 4); }
    for (const y of this.st.yants || []) {                            // ยันต์ระเบิด (จาง ๆ)
      const r = s.add.rectangle(y.x, y.y, 10, 14, 0xf5e6b8, 0.55).setStrokeStyle(1, 0xc0392b, 0.8).setDepth(2.3).setAngle(Math.random() * 30 - 15);
      r.yid = y.id; this.decor.push(r);
    }
  }
  drawTele(t) {
    if (!this.here) return;
    const s = this.s, objs = [], col = COL[t.color] || COL.purple, depth = 2.6, now = s.time.now;
    const g = s.add.graphics().setDepth(depth); objs.push(g);
    const fill = s.add.graphics().setDepth(depth); objs.push(fill);
    const rec = { t, objs, g, fill, t0: now, ms: t.ms };
    const shape = () => {
      g.clear(); g.lineStyle(2, col, 0.95);
      if (t.shape === 'cone') { g.fillStyle(col, 0.16); g.slice(t.x, t.y, t.range, t.a - t.arc / 2 * Math.PI / 180, t.a + t.arc / 2 * Math.PI / 180, false); g.fillPath(); g.strokePath(); }
      else if (t.shape === 'line') { const ux = Math.cos(t.a), uy = Math.sin(t.a), nx = -uy * t.w / 2, ny = ux * t.w / 2, ex = t.x + ux * t.len, ey = t.y + uy * t.len; g.fillStyle(col, 0.18).fillPoints([{ x: t.x + nx, y: t.y + ny }, { x: ex + nx, y: ey + ny }, { x: ex - nx, y: ey - ny }, { x: t.x - nx, y: t.y - ny }], true); g.strokePoints([{ x: t.x + nx, y: t.y + ny }, { x: ex + nx, y: ey + ny }, { x: ex - nx, y: ey - ny }, { x: t.x - nx, y: t.y - ny }], true); }
      else if (t.shape === 'circles') for (const c of t.pts) { const cc = c.c ?? col; g.fillStyle(cc, 0.16).fillEllipse(c.x, c.y, t.r * 2, t.r * 1.4); g.lineStyle(2, cc, 0.95).strokeEllipse(c.x, c.y, t.r * 2, t.r * 1.4); }
      else if (t.shape === 'circle') { g.fillStyle(col, 0.14).fillEllipse(t.x, t.y, t.r * 2, t.r * 1.4); g.strokeEllipse(t.x, t.y, t.r * 2, t.r * 1.4); }
      else if (t.shape === 'squares') for (const c of t.pts) { g.fillStyle(col, 0.22).fillRect(c.x - t.h, c.y - t.h, t.h * 2, t.h * 2); g.strokeRect(c.x - t.h, c.y - t.h, t.h * 2, t.h * 2); }
      else if (t.shape === 'safe') for (const c of t.pts) { g.fillStyle(COL.silver, 0.25).fillEllipse(c.x, c.y, t.r * 2, t.r * 1.4); g.lineStyle(3, COL.silver, 1).strokeEllipse(c.x, c.y, t.r * 2, t.r * 1.4); }
    };
    shape();
    if (t.shape === 'safe') {                                       // ดับฟ้า: ความมืดคืบจากขอบจอ + เสาแสง + ตัวเลขนับถอยหลัง
      const cam = s.cameras.main, dark = s.add.rectangle(0, 0, cam.width * 3, cam.height * 3, 0x05030d, 0).setScrollFactor(0).setDepth(99980); objs.push(dark);
      s.tweens.add({ targets: dark, fillAlpha: 0.55, duration: t.ms * 0.9 });
      for (const c of t.pts) {
        const beam = s.add.rectangle(c.x, c.y - 90, t.r * 1.6, 180, 0xf4f6ff, 0.22).setDepth(99981).setBlendMode('ADD'); objs.push(beam);
        const num = makeText(s, c.x, c.y - 10, '', { fontSize: '14px', color: '#ffffff' }).setOrigin(0.5).setDepth(99982); objs.push(num); (rec.nums ||= []).push(num);
      }
    }
    if (t.shape === 'burst') { const r = s.add.circle(t.x, t.y, 30, col, 0.35).setDepth(depth); objs.push(r); s.tweens.add({ targets: r, scale: 3, alpha: 0, duration: 700 }); }
    if (t.yant) { const y = this.decor.find((o) => o.yid === t.yant); if (y) s.tweens.add({ targets: y, alpha: 0.2, yoyo: true, repeat: 4, duration: 100 }); }
    rec.tick = () => {                                              // แถบเติม = จังหวะท่าลง
      const k = Math.min(1, (s.time.now - rec.t0) / rec.ms);
      fill.clear(); fill.fillStyle(col, 0.18 + 0.2 * k);
      if (t.shape === 'cone') { fill.slice(t.x, t.y, t.range * k, t.a - t.arc / 2 * Math.PI / 180, t.a + t.arc / 2 * Math.PI / 180, false); fill.fillPath(); }
      else if (t.shape === 'circles') for (const c of t.pts) fill.fillStyle(c.c ?? col, 0.12 + 0.25 * k).fillEllipse(c.x, c.y, t.r * 2 * k, t.r * 1.4 * k);
      else if (t.shape === 'circle') fill.fillEllipse(t.x, t.y, t.r * 2 * k, t.r * 1.4 * k);
      else if (t.shape === 'line') { const ux = Math.cos(t.a), uy = Math.sin(t.a), L = t.len * k, nx = -uy * t.w / 2, ny = ux * t.w / 2; fill.fillPoints([{ x: t.x + nx, y: t.y + ny }, { x: t.x + ux * L + nx, y: t.y + uy * L + ny }, { x: t.x + ux * L - nx, y: t.y + uy * L - ny }, { x: t.x - nx, y: t.y - ny }], true); }
      if (rec.nums) { const left = Math.max(0, Math.ceil((rec.ms - (s.time.now - rec.t0)) / 1000)); rec.nums.forEach((n) => n.setText(String(left))); }
    };
    this.tele.set(t.id, rec);
    if (t.color === 'red' && !t.trap) s.sfx?.play('skWhistle');
  }
  land({ id, kind }) {
    const rec = this.tele.get(id); if (!rec) return;
    this.tele.delete(id);
    const s = this.s, t = rec.t;
    rec.objs.forEach((o) => o.destroy?.());
    const boom = (x, y, r, c) => { const e = s.add.ellipse(x, y, r * 2, r * 1.4, c, 0.5).setDepth(2.7); s.tweens.add({ targets: e, alpha: 0, scale: 1.15, duration: 420, onComplete: () => e.destroy() }); };
    const col = COL[t.color] || COL.purple;
    if (t.shape === 'circles') t.pts.forEach((c) => boom(c.x, c.y, t.r, c.c ?? col));
    else if (t.shape === 'circle') boom(t.x, t.y, t.r, col);
    else if (t.shape === 'squares') t.pts.forEach((c) => { boom(c.x, c.y, t.h * 1.2, 0xc0392b); s.vfx?.sparks?.(c.x, c.y); });
    else if (t.shape === 'cone' || t.shape === 'line') { const e = s.add.graphics().setDepth(2.7); e.fillStyle(col, 0.5); if (t.shape === 'cone') { e.slice(t.x, t.y, t.range, t.a - t.arc / 2 * Math.PI / 180, t.a + t.arc / 2 * Math.PI / 180); e.fillPath(); } else { const ux = Math.cos(t.a), uy = Math.sin(t.a), nx = -uy * t.w / 2, ny = ux * t.w / 2, ex = t.x + ux * t.len, ey = t.y + uy * t.len; e.fillPoints([{ x: t.x + nx, y: t.y + ny }, { x: ex + nx, y: ey + ny }, { x: ex - nx, y: ey - ny }, { x: t.x - nx, y: t.y - ny }], true); } s.tweens.add({ targets: e, alpha: 0, duration: 400, onComplete: () => e.destroy() }); }
    if (t.shape === 'safe') s.cameras.main.flash(400, 20, 0, 40);
    if (t.dmg >= 0.35 && Math.hypot(s.player.x - (t.x ?? s.player.x), s.player.y - (t.y ?? s.player.y)) < 400) s.cameras.main.shake(200, 0.008);
    if (t.yant) { const i = this.decor.findIndex((o) => o.yid === t.yant); if (i >= 0) { this.decor[i].destroy(); this.decor.splice(i, 1); } }
    s.sfx?.play(t.dmg >= 0.4 ? 'skBoom' : 'skSlam');
  }
  crystals({ mids, hp }) {
    for (const mid of mids) { const m = this.s.mobs[mid]; if (m) { m.maxHp = hp; m.hp = hp; } }
    this.s.ui.banner('💎 ผลึกจันทร์ปรากฏ!', 'ตีให้แตกใน 30 วินาที ก่อนพระราหูดูดกลับเข้าจันทร์');
  }
  pull({ x, y }) {
    const s = this.s, p = s.player; p.path = []; p.target = null;
    s.tweens.add({ targets: p, x, y, duration: 350, ease: 'Cubic.In' });
    s.cameras.main.shake(250, 0.006); s.ui.toast('🌀 ถูกดูดเข้าหาพระราหู! วิ่งออกจากวงขาว!', 'warn', 1400);
  }
  fire({ fires, len, warn, now }) {
    this.sync(now);
    if (!this.here) return;
    const s = this.s;
    for (const F of fires) {
      const g = s.add.graphics().setDepth(2.65);
      this.fires.push({ ...F, len, g, t0w: Date.now(), warn });
    }
  }

  // ---------------- ต่อเฟรม ----------------
  update() {
    const s = this.s;
    for (const rec of this.tele.values()) rec.tick?.();
    const now = this.now;
    for (const F of this.fires) {
      F.g.clear();
      if (now < F.t0) { const k = 1 - (F.t0 - now) / F.warn; F.g.fillStyle(0xff5a3c, 0.25 + 0.4 * k).fillCircle(F.x, F.y - 10, 10 + 8 * k); continue; }
      if (now > F.t1) continue;
      const a = F.a0 + (F.a1 - F.a0) * (now - F.t0) / (F.t1 - F.t0), ux = Math.cos(a), uy = Math.sin(a), w = 12;
      F.g.fillStyle(0xff7a1a, 0.55).fillPoints([{ x: F.x - uy * w, y: F.y + ux * w }, { x: F.x + ux * F.len - uy * w * 1.6, y: F.y + uy * F.len + ux * w * 1.6 }, { x: F.x + ux * F.len + uy * w * 1.6, y: F.y + uy * F.len - ux * w * 1.6 }, { x: F.x + uy * w, y: F.y - ux * w }], true);
      F.g.fillStyle(0xffe08a, 0.6).fillPoints([{ x: F.x - uy * 4, y: F.y + ux * 4 }, { x: F.x + ux * F.len * 0.9, y: F.y + uy * F.len * 0.9 }, { x: F.x + uy * 4, y: F.y - ux * 4 }], true);
    }
    this.fires = this.fires.filter((F) => { if (now > F.t1 + 200) { F.g.destroy(); return false; } return true; });
    // บอสลอยขึ้นลง + ผลึกเป็นเพชรเรืองแสง
    if (this.here) {
      const b = this.boss;
      if (b?.alive) { if (!b.wbAura || !b.wbAura.scene) { b.wbAura = s.add.ellipse(b.x, b.y, 120, 50, 0x6a3fd0, 0.25).setDepth(2.4).setBlendMode('ADD'); this.decor.push(b.wbAura); } b.wbAura.setPosition(b.x, b.y).setScale(1 + Math.sin(s.time.now / 400) * 0.06).setVisible(true); }
      else if (b?.wbAura) b.wbAura.setVisible(false);
      for (const m of s.mobs) {
        if (m.spawn?.wb !== 'crystal') continue;
        if (!m.wbGem || !m.wbGem.scene) { m.wbGem = s.add.graphics().setDepth(m.y); this.decor.push(m.wbGem); }
        m.setAlpha(0.001);
        const G = m.wbGem; G.clear(); G.setVisible(!!m.alive);
        if (!m.alive) continue;
        const bob = Math.sin(s.time.now / 300 + m.mid) * 3, x = m.x, y = m.y - 22 + bob;
        G.fillStyle(0x9fb4ff, 0.25).fillCircle(x, y, 18);
        G.fillStyle(0xe8edf8, 0.95).fillPoints([{ x, y: y - 16 }, { x: x + 9, y }, { x, y: y + 16 }, { x: x - 9, y }], true);
        G.fillStyle(0xb7c6ff, 1).fillPoints([{ x, y: y - 16 }, { x: x + 9, y }, { x, y }], true);
        G.lineStyle(1, 0x5d6dbe, 1).strokePoints([{ x, y: y - 16 }, { x: x + 9, y }, { x, y: y + 16 }, { x: x - 9, y }], true);
        if (b?.alive) { G.lineStyle(1, 0xd6e0ff, 0.35 + 0.25 * Math.sin(s.time.now / 120)); G.lineBetween(x, y, b.x, b.y - 40); }
      }
    }
    this.updateMvp();
  }
  /** ป้าย ★ MVP ★ เหนือหัว (ทุกแมพ) */
  updateMvp() {
    const s = this.s, m = this.mvp && this.mvp.until > this.now ? this.mvp : null;
    const want = new Map();
    if (m) {
      const self = m.pid === s.net?.selfId || m.name === s.player?.char?.name;
      const spr = self ? s.player : s.remotes?.get(m.pid)?.spr;
      if (spr?.active && spr.visible !== false) want.set(m.pid, spr);
    }
    for (const [id, t] of this.mvpTags) if (!want.has(id)) { t.destroy(); this.mvpTags.delete(id); }
    for (const [id, spr] of want) {
      let t = this.mvpTags.get(id);
      if (!t) { t = makeText(s, 0, 0, '★ MVP ★', { fontSize: '8px', color: '#ffd35c', stroke: '#5a3300', strokeThickness: 3 }).setOrigin(0.5, 1).setDepth(99999); this.mvpTags.set(id, t); s.tweens.add({ targets: t, alpha: 0.6, yoyo: true, repeat: -1, duration: 700 }); }
      // วางเหนือป้ายบนสุด (ชื่อ/ฉายา) ไม่ให้ทับกัน
      const tags = (spr === s.player ? [s.nameTag, s.titleTag] : spr._tags || []).filter((g) => g?.visible && g.scene);
      const top = tags.length ? Math.min(...tags.map((g) => g.y - g.displayHeight)) : spr.y - spr.displayHeight - 12;
      t.setPosition(spr.x, top - 1);
    }
  }
  /** บ่อเงาดูด: ช้าลง 40% (เฉพาะตอนสู้) */
  speedMul(p) {
    if (!this.here || this.st.state !== 'fight') return 1;
    return (this.st.pools || []).some((q) => Math.hypot(p.x - q.x, p.y - q.y) <= q.r) ? 0.6 : 1;
  }
}
