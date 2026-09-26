// ============================================================
//  Village – หมู่บ้านบางผี (Map 1 · Safe Zone)
//  ▸ ตกปลาที่ท่าน้ำ (มินิเกมจังหวะ)   ▸ เควสผู้ใหญ่ชัย
//  ▸ ครัวป้าสา (ทำอาหารจากปลา)       ▸ ตีบวกกับลุงดำ
// ============================================================
import { ITEMS } from '/shared/data/items.js';
import { MONSTERS } from '/shared/data/monsters.js';
import { WORLD } from '/shared/constants.js';
import { ENHANCE, QUESTS, QUEST_BY_ID } from '/shared/data/village.js';
import { count, tradeLock, questState as qState } from './Inventory.js';
import { craftList, canCraft, MAX_ACTIVE_QUESTS } from '/shared/economy.js';
import { FISH_SPOT } from '/shared/data/npcs.js';
import { AURA_TH, AURA_COLOR } from '../gfx/Aura.js';
import { JOBS, JOB_IDS, PATH_LV } from '/shared/data/classes.js';
import { SKILLS } from '/shared/data/skills.js';
import { itemIcon } from './util.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SLOT_TH = { weapon: 'อาวุธ', armor: 'ชุดเกราะ', accessory: 'เครื่องประดับ 1', accessory2: 'เครื่องประดับ 2' };
const MAX_ACTIVE = MAX_ACTIVE_QUESTS;
export { FISH_SPOT };

export class Village {
  constructor(scene) {
    this.scene = scene;
    this.fish = null;                         // สถานะการตกปลาปัจจุบัน
    const c = this.char;
    c.quests ||= { active: {}, done: [] };
    c.enhance ||= {};
    $('#quest-list').onclick = (e) => {
      const b = e.target.closest('button[data-q]');
      if (!b) return;
      const [act, id] = b.dataset.q.split(':');
      if (act === 'accept') this.accept(id); else if (act === 'claim') this.claim(id); else if (act === 'drop') this.drop(id);
    };
    this.renderTracker();
  }

  get char() { return this.scene.player.char; }
  get ui() { return this.scene.ui; }
  get econ() { return this.scene.econ; }

  // ============================================================
  //  ตกปลา
  // ============================================================
  canFish(x) { return x >= FISH_SPOT.from && x <= FISH_SPOT.to; }
  get fishing() { return !!this.fish; }

  startFishing() {
    const s = this.scene, p = s.player;
    if (this.fish) return this.press();
    s.ui.closeAll();
    p.setVelocity(0, 0);
    p.setFlipX(true); p.facing = -1;                                     // หันหน้าลงแม่น้ำ (ซ้าย)
    const rodX = p.x - 14, rodY = p.y - 26;
    const bobX = p.x - 58 - Math.random() * 30, bobY = WORLD.groundY + 12;
    const line = s.add.graphics().setDepth(12);
    const bob = s.add.circle(bobX, bobY, 2, 0xe74c3c).setStrokeStyle(1, 0xffffff).setDepth(12);
    this.fish = { stage: 'wait', line, bob, rodX, rodY, bobX, bobY, t0: s.time.now, biteAt: s.time.now + 2200 + Math.random() * 4500 };
    s.sfx.play('swing');
    this.showBar(false);
    $('#fish-ui').classList.remove('hidden');
    $('#fish-msg').textContent = 'รอปลากินเหยื่อ… (กด F อีกครั้งเพื่อเก็บเบ็ด)';
  }

  /** กด F / Space ระหว่างตกปลา */
  press() {
    const f = this.fish, s = this.scene;
    if (!f) return;
    if (f.stage === 'wait') return this.stop('เก็บเบ็ดแล้ว');
    if (f.stage === 'bite') {                                          // วัดจังหวะ → ขอปลาจาก server → เข้าสู่มินิเกม
      if (f.asking) return;
      f.asking = true;
      this.econ.act('fishBite').then((r) => {
        if (this.fish !== f) return;
        f.asking = false;
        if (!r.ok) { f.stage = 'wait'; f.biteAt = s.time.now + 1500 + Math.random() * 3500; $('#fish-msg').textContent = r.msg || 'ปลาหนีไปแล้ว… รอตัวใหม่'; return; }
        f.stage = 'reel';
        f.catch = { id: r.fish, hard: r.hard };
        const hard = r.hard;
        f.zoneW = 0.34 - hard * 0.24;                                   // ช่องเขียวแคบลงตามความยาก
        f.zoneX = 0.1 + Math.random() * (0.8 - f.zoneW);
        f.speed = 0.7 + hard * 1.1;
        f.pos = 0; f.dir = 1; f.tries = 3;
        this.showBar(true);
        $('#fish-msg').textContent = 'กด F เมื่อเข็มอยู่ในช่องสีเขียว!';
        s.sfx.play('click');
      });
      return;
    }
    if (f.stage === 'reel') {
      const inZone = f.pos >= f.zoneX && f.pos <= f.zoneX + f.zoneW;
      if (inZone) return this.landFish();
      f.tries--;
      s.sfx.play('error');
      s.cameras.main.shake(80, 0.002);
      if (f.tries <= 0) { this.econ.act('fishLose'); return this.stop('ปลาหลุดเบ็ดไปแล้ว…', 'warn'); }
      $('#fish-msg').textContent = `พลาด! เหลือโอกาสอีก ${f.tries} ครั้ง`;
    }
  }

  landFish() {
    const f = this.fish, s = this.scene;
    f.stage = 'landing';
    this.econ.act('fishLand').then((r) => {
      if (!r.ok) return this.stop(r.msg || 'ปลาหลุดเบ็ดไปแล้ว…', 'warn');
      this.fishFx(f, r);
    });
  }

  fishFx(f, r) {
    const s = this.scene, it = ITEMS[f.catch.id];
    s.sfx.play(f.catch.id === 'junk_boot' ? 'error' : 'coin');
    const p = s.player;
    // ปลากระโดดขึ้นจากน้ำเข้ามือ
    const tk = `ico_it_${f.catch.id}`;
    const fishTxt = s.textures.exists(tk) ? s.add.image(f.bobX, f.bobY, tk).setDisplaySize(16, 16).setDepth(40)
      : s.add.text(f.bobX, f.bobY, it.icon, { fontSize: '12px' }).setOrigin(0.5).setDepth(40);
    s.tweens.add({ targets: fishTxt, x: p.x, y: p.y - 40, duration: 500, ease: 'Quad.easeOut', onComplete: () => s.tweens.add({ targets: fishTxt, alpha: 0, y: p.y - 56, duration: 500, onComplete: () => fishTxt.destroy() }) });
    s.combat.burst(f.bobX, f.bobY, 0x85c1e9, 10);
    const rare = ['pla_buek', 'pla_phrai'].includes(f.catch.id);
    if (rare) { s.ui.banner(`🎣 ได้ ${it.icon} ${it.nameTh}!!`); s.sfx.play('levelup'); }
    s.combat.afterGrant(r);
    this.stop(`ได้ ${it.icon} ${it.nameTh}${f.catch.id === 'junk_boot' ? ' (ซวยจัง)' : ''}`);
    s.saveSoon();
  }

  stop(msg, type) {
    const f = this.fish;
    if (!f) return;
    if (f.stage === 'reel') this.econ.act('fishLose');
    f.line.destroy(); f.bob.destroy();
    this.fish = null;
    $('#fish-ui').classList.add('hidden');
    if (msg) this.ui.toast(msg, type);
  }

  showBar(on) {
    $('#fish-bar').classList.toggle('hidden', !on);
    if (on) {
      const f = this.fish;
      $('#fish-zone').style.left = `${f.zoneX * 100}%`;
      $('#fish-zone').style.width = `${f.zoneW * 100}%`;
    }
  }

  update(time, dt) {
    const f = this.fish, s = this.scene;
    if (!f) return;
    const p = s.player;
    if (!p.alive || Math.abs(p.body.velocity.x) > 5 || !this.canFish(p.x)) return this.stop('เลิกตกปลา');
    if (f.stage === 'landing') { f.bob.setPosition(f.bobX, f.bobY); return; }
    // ทุ่นลอยน้ำ
    let by = f.bobY + Math.sin(time / 300) * 1;
    if (f.stage === 'wait' && time >= f.biteAt) {
      f.stage = 'bite'; f.biteEnd = time + 1100;
      $('#fish-msg').textContent = '❗ ปลากินเบ็ด! กด F เร็ว!';
      s.sfx.play('hit');
      s.combat.popupText(f.bobX, f.bobY - 14, '!', '#f1c40f', 14);
    }
    if (f.stage === 'bite') {
      by += Math.sin(time / 40) * 2;                                  // ทุ่นจมกระตุก
      if (time > f.biteEnd) { f.stage = 'wait'; f.biteAt = time + 1500 + Math.random() * 3500; $('#fish-msg').textContent = 'ช้าไป ปลาหนีไปแล้ว… รอตัวใหม่'; }
    }
    if (f.stage === 'reel') {
      f.pos += f.dir * f.speed * dt;
      if (f.pos > 1) { f.pos = 1; f.dir = -1; } else if (f.pos < 0) { f.pos = 0; f.dir = 1; }
      $('#fish-needle').style.left = `${f.pos * 100}%`;
      by += Math.sin(time / 60) * 1.5;
    }
    f.bob.setPosition(f.bobX, by);
    // สายเบ็ด (โค้ง)
    // ปลายคันเบ็ด (คันเบ็ดวาดอยู่ในท่าตัวละครแล้ว) – ดึงเบ็ดคันจะยกสูงขึ้น
    const reel = f.stage !== 'wait';
    const rx = p.x - (reel ? 14 : 23), ry = p.y - (reel ? 42 : 37);
    f.line.clear().lineStyle(1, 0xecf0f1, 0.75).beginPath().moveTo(rx, ry);
    const midX = (rx + f.bobX) / 2, midY = Math.max(ry, by) + 10;
    for (let i = 1; i <= 8; i++) {
      const t = i / 8, x = (1 - t) * (1 - t) * rx + 2 * (1 - t) * t * midX + t * t * f.bobX, y = (1 - t) * (1 - t) * ry + 2 * (1 - t) * t * midY + t * t * by;
      f.line.lineTo(x, y);
    }
    f.line.strokePath();
  }

  // ============================================================
  //  ครัวป้าสา
  // ============================================================
  renderCook(el) { this.renderCraft(el, 'cook', 'ตกปลาได้ที่ท่าน้ำซ้ายสุดของหมู่บ้าน · หน่อไม้เก็บได้ในภาค 2 · กลางคืนมีโอกาสได้ปลาพรายวิญญาณ'); }
  renderBrew(el) { this.renderCraft(el, 'brew', 'สมุนไพรเก็บได้ในแมพล่าผี (แต่ละภาคมีชนิดต่างกัน) · เห็ดผีเรืองแสงอยู่ภาค 4–5'); }
  renderForge(el) { this.renderCraft(el, 'forge', 'หลอมอุปกรณ์ขั้นสูง Lv.22–30 จากของดรอปภาค 3–5 + แร่เหล็กไหล · ไม่ต้องรอดวงดรอป · เขี้ยวพญายักษ์/เขาอสุรกายได้จากบอส'); }

  /** รายการสูตร (ครัวป้าสา / ปรุงยายายติ๋ม / โรงหลอมลุงดำ) → ส่งคำสั่ง craft ให้ server */
  renderCraft(el, list, hint) {
    const c = this.char, all = craftList(list);
    let filt = '';
    let rows = all.map((r, i) => ({ r, i }));
    if (list === 'forge') {                                             // กรอง: สายตัวเอง / ทั้งหมด / ของใช้
      const F = { mine: `สาย${JOBS[c.path]?.nameTh || 'ตัวเอง'}`, all: 'ทุกสาย', util: 'ของใช้' };
      const f = this.forgeFilter || (c.path ? 'mine' : 'all');
      filt = `<div class="qty-bar gear-filter"><span>แสดง:</span>${Object.entries(F).map(([k, l]) => `<button data-ff="${k}" class="${k === f ? 'active' : ''}">${l}</button>`).join('')}</div>`;
      rows = rows.filter(({ r }) => f === 'all' ? !r.util : f === 'util' ? r.util : r.job === c.path);
    }
    el.innerHTML = filt + rows.map(({ r, i }) => {
      const it = ITEMS[r.out];
      const needs = Object.entries(r.need).map(([id, n]) => {
        const have = count(c, id);
        return `<span class="${have >= n ? 'ok' : 'miss'}">${itemIcon(id, ITEMS[id].icon)}${esc(ITEMS[id].nameTh)} ${have}/${n}</span>`;
      }).join(' ');
      const can = canCraft(c, r);
      const max = Math.min(...Object.entries(r.need).map(([id, n]) => Math.floor(count(c, id) / n)), r.fee ? Math.floor(c.gold / r.fee) : 99);
      const eff = it.buff ? `${esc(it.buff.textTh)} · ${it.buff.minutes} นาที` : it.bonus ? `Lv.${it.lv} · ${Object.entries(it.bonus).map(([k, v]) => `${k.toUpperCase()}+${k === 'crit' ? v * 100 + '%' : v}`).join(' ')}` : '';
      const under = it.lv && c.level < it.lv ? ' <span class="need-lv">🔒 ต้อง Lv.' + it.lv + '</span>' : '';
      return `<div class="item ${it.lv && c.level < it.lv ? 'under' : ''}"><span class="ic">${itemIcon(r.out, it.icon)}</span>
        <span>${esc(it.nameTh)}${under} <span class="meta">${eff}</span><div class="need">${needs} · ค่าแรง ฿${r.fee.toLocaleString()}</div></span>
        <span class="craft-btns"><button data-craft="${i}" ${can ? '' : 'disabled'}>${list === 'forge' ? 'หลอม' : 'ทำ'}</button>${max > 1 && list !== 'forge' ? `<button data-craft="${i}" data-n="${max}">ทำ x${max}</button>` : ''}</span><span></span></div>`;
    }).join('') + (rows.length ? '' : '<div class="empty">ไม่มีสูตรในหมวดนี้</div>') + `<p class="hint">${hint}</p>`;
    el.querySelectorAll('[data-ff]').forEach((b) => (b.onclick = () => { this.forgeFilter = b.dataset.ff; this.scene.sfx.play('click'); this.renderForge(el); }));
    el.querySelectorAll('[data-craft]').forEach((b) => (b.onclick = () => {
      const n = +b.dataset.n || 1, idx = +b.dataset.craft;
      this.econ.act('craft', { list, idx, n }).then((r) => {
        if (r.ok) { this.scene.sfx.play(r.forged ? 'levelup' : 'potion'); if (r.forged) { this.ui.banner(`⚒️ หลอมสำเร็จ: ${ITEMS[r.out].nameTh}`); this.scene.combat.burst(this.scene.player.x, this.scene.player.y - 20, 0xf39c12, 18); } }
        this.ui.result(r);
      });
    }));
  }

  // ============================================================
  //  ตีบวก (ลุงดำ)
  // ============================================================
  renderEnhance(el) {
    const c = this.char;
    const guards = count(c, 'yant_guard');
    el.innerHTML = Object.keys(SLOT_TH).map((slot) => {
      const id = c.equipment[slot], lv = c.enhance[slot] || 0;
      const tier = ENHANCE.auraTier(lv);
      if (lv >= ENHANCE.max) return `<div class="item"><span class="ic">🌈</span><span>${SLOT_TH[slot]} <b class="enh t${tier}">+${lv}</b> <span class="meta">สูงสุดแล้ว · ออร่ารุ้ง</span></span><span></span><span></span></div>`;
      const cost = ENHANCE.cost(lv), ore = ENHANCE.ore(lv), fang = ENHANCE.fang(lv), rate = ENHANCE.rate(lv);
      const next = Object.entries(ENHANCE.bonus[slot](lv + 1)).filter(([, v]) => v).map(([k, v]) => `${k.toUpperCase()}+${v}`).join(' ');
      const can = id && c.gold >= cost && count(c, 'black_iron') >= ore && count(c, 'yak_fang') >= fang;
      const risk = lv < 10 ? 'พลาด: ขั้นไม่ลด' : lv < 15 ? '⚠️ พลาด: ลด 1 ขั้น' : '⚠️ พลาด: ลด 1 ขั้น (30% ลด 2)';
      const nt = ENHANCE.auraTier(lv + 1);
      return `<div class="item"><span class="ic">${id ? itemIcon(id, ITEMS[id].icon) : '▫️'}</span>
        <span>${SLOT_TH[slot]} <b class="enh t${tier}">+${lv}</b> → <b class="enh t${nt}">+${lv + 1}</b> <span class="meta">${id ? esc(ITEMS[id].nameTh) : 'ยังไม่ได้สวมใส่'}</span>
          <div class="need">รวมเป็น ${next} · สำเร็จ <b>${Math.round(rate * 100)}%</b> · ${risk}${ore ? ` · 🪨 แร่ ${count(c, 'black_iron')}/${ore}` : ''}${fang ? ` · 🐗 เขี้ยวพญายักษ์ ${count(c, 'yak_fang')}/${fang}` : ''}${nt > tier ? ` · ✨ ปลดออร่า${AURA_TH[nt]}` : ''}</div></span>
        <span class="price">฿${cost.toLocaleString()}</span><button data-enh="${slot}" ${can ? '' : 'disabled'}>ตี</button></div>`;
    }).join('') + `<label class="guard-row"><input type="checkbox" id="enh-guard" ${this.useGuard && guards ? 'checked' : ''} ${guards ? '' : 'disabled'}> 🧧 ใช้ยันต์กันลดขั้น (มี ${guards}) – ใช้เฉพาะตอนตี +10 ขึ้นไป</label>
      <p class="hint">บวกติดกับช่องสวมใส่ · +10 ขึ้นไปยากขึ้นมากและพลาดแล้วขั้นลด · ออร่ารอบตัว: +7 ฟ้า · +10 ม่วง · +13 ทอง · +16 เพลิง · +20 รุ้ง (ใช้ขั้นสูงสุดของอุปกรณ์)</p>`;
    el.querySelector('#enh-guard')?.addEventListener('change', (e) => (this.useGuard = e.target.checked));
    el.querySelectorAll('[data-enh]').forEach((b) => (b.onclick = () => this.enhance(b.dataset.enh)));
  }

  enhance(slot) {
    const c = this.char, s = this.scene, lv = c.enhance[slot] || 0;
    if (tradeLock.on) return s.ui.toast('กำลังเทรดอยู่ – ปิดหน้าต่างเทรดก่อน', 'warn');
    if (this.enhancing) return;
    this.enhancing = true;
    s.sfx.play('hit');
    this.econ.act('enhance', { slot, guard: !!this.useGuard }).then((r) => {
      this.enhancing = false;
      if (!r.success && r.msg) return this.ui.result(r);                  // ทำไม่ได้ (เงิน/แร่ไม่พอ ฯลฯ)
      let msg;
      if (r.success) {
        s.sfx.play('levelup');
        s.combat.burst(s.player.x, s.player.y - 20, AURA_COLOR[ENHANCE.auraTier(r.lv)] || 0xf39c12, 16 + r.lv);
        if (r.lv >= 10) s.cameras.main.flash(250, 255, 230, 150);
        msg = `🔨 ตีบวกสำเร็จ! ${SLOT_TH[slot]} +${r.lv}`;
        if (ENHANCE.auraTier(r.lv) > ENHANCE.auraTier(r.from)) this.ui.banner(`✨ ปลดออร่า${AURA_TH[ENHANCE.auraTier(r.lv)]}!`);
      } else {
        s.sfx.play('error');
        s.cameras.main.shake(180, 0.006);
        msg = r.drop ? `💥 ตีพลาด! ${SLOT_TH[slot]} ลดเหลือ +${r.lv}` : `💥 ตีพลาด… ${SLOT_TH[slot]} ยังคง +${r.lv}${r.guard ? ' (ยันต์กันลดขั้นช่วยไว้)' : ''}`;
      }
      this.ui.result({ ok: r.success, msg, jobChanged: r.jobChanged, titles: r.titles });
    });
  }

  // ============================================================
  //  เควส (ผู้ใหญ่ชัย)
  // ============================================================
  openQuests() {
    this.ui.closeAll();
    this.ui.toggle('quest-panel', true);
    this.renderQuests();
  }

  questState(q) { return qState(this.char, q); }

  goalText(q) {
    const g = q.goal;
    if (g.herb) return `เก็บ${g.herb === 'any' ? 'สมุนไพรอะไรก็ได้' : ITEMS[g.herb]?.nameTh} ${g.n} ครั้ง`;
    if (g.kill) return `ปราบ ${g.kill === 'any' ? 'ผีตัวไหนก็ได้' : g.kill === 'grave' ? 'ผีในป่าช้า' : MONSTERS[g.kill]?.nameTh} ${g.n} ตัว`;
    return `ตก${g.fish === 'any' ? 'ปลาอะไรก็ได้' : ITEMS[g.fish]?.nameTh} ${g.n} ตัว`;
  }

  rewardText(q) {
    const r = q.reward;
    return [`${r.exp} EXP`, `฿${r.gold}`, ...(r.items || []).map((it) => `${ITEMS[it.id].icon}${ITEMS[it.id].nameTh} x${it.qty}`)].join(' · ');
  }

  /** พิธีเลือกสายหลัก (Lv.10) – แสดงบนสุดของสมุดเควส  เลือกได้เมื่อยืนใกล้ผู้ใหญ่ชัย */
  renderPathBox() {
    let box = $('#path-box');
    if (!box) { box = document.createElement('div'); box.id = 'path-box'; $('#quest-list').before(box); }
    const c = this.char;
    if (c.path) { box.innerHTML = ''; return; }
    const near = this.nearChai();
    if (c.level < PATH_LV) {
      box.innerHTML = `<div class="quest locked"><div><b>🎖️ พิธีเลือกสายหลัก</b> <span class="meta">Lv.${PATH_LV}+</span>
        <p>“ตอนนี้เอ็งยังเป็นชาวบ้านธรรมดา ลองจับดาบ ไม้เท้า ธนู หรือกำหมัดดูให้ครบ พอถึง Lv.${PATH_LV} ค่อยมาบอกข้าว่าจะเดินทางไหน”</p>
        <small>ระหว่างนี้ทุกสายอัปสกิลได้ถึง Lv.2 · เปลี่ยนอาวุธ = เปลี่ยนแนวต่อสู้</small></div><span class="meta">Lv.${c.level}/${PATH_LV}</span></div>`;
      return;
    }
    box.innerHTML = `<div class="quest ready"><div style="width:100%"><b>🎖️ พิธีเลือกสายหลัก</b>
      <p>“ถึงเวลาแล้ว! เลือกทางของเอ็ง สายหลักอัปสกิลได้ถึง Lv.5 ใช้ท่าไม้ตาย ★ ได้ และได้ชุดประจำสาย สายอื่นยังใช้ได้แต่อัปได้แค่ Lv.2”</p>
      ${near ? '' : '<small>⚠️ ต้องยืนคุยกับผู้ใหญ่ชัยที่หมู่บ้านก่อนจึงจะเลือกได้</small>'}
      <div class="path-choose">${JOB_IDS.map((j) => { const J = JOBS[j]; return `<div class="path-card"><span class="ic">${J.icon}</span><b>${J.pathTitle}</b>
<span>โบนัส: ${J.pathTextTh}</span><span class="meta">ท่าไม้ตาย: ${SKILLS[j].find((k) => k.ultimate).nameTh} · ถือ${J.weaponTh}</span>
        <span class="meta">รางวัล: ${ITEMS[`armor_${j}`].nameTh}</span>
        <button class="gold" data-path="${j}" ${near ? '' : 'disabled'}>เลือกสายนี้</button></div>`; }).join('')}</div></div></div>`;
    box.querySelectorAll('[data-path]').forEach((b) => (b.onclick = () => {
      const j = b.dataset.path;
      if (!this.nearChai()) return this.ui.toast('ต้องยืนคุยกับผู้ใหญ่ชัยที่หมู่บ้านก่อน', 'warn');
      if (!confirm(`เลือกสายหลัก “${JOBS[j].pathTitle}”?\n(เปลี่ยนภายหลังได้ด้วยคัมภีร์เปลี่ยนสายหลักที่ร้านยายติ๋ม)`)) return;
      this.econ.act('path', { job: j }).then((r) => {
        if (!r.ok) return this.ui.toast(r.msg, 'warn');
        this.scene.sfx.play('victory');
        this.ui.banner(`🎖️ ${JOBS[j].pathTitle}`);
        this.ui.toast(`${r.msg} ได้รับ ${ITEMS[`armor_${j}`].nameTh} (สวมที่กระเป๋า I) · สกิลสาย${JOBS[j].nameTh}อัปได้ถึง Lv.5 แล้ว`);
        if (r.jobChanged) this.scene.onAppearanceChanged();
        this.afterChange();
      });
    }));
  }

  renderQuests() {
    this.renderPathBox();
    const Q = this.char.quests, order = { ready: 0, active: 1, open: 2, locked: 3, done: 4 };
    const list = QUESTS.map((q) => ({ q, st: this.questState(q) })).sort((a, b) => order[a.st] - order[b.st]);
    const nActive = Object.keys(Q.active).length;
    $('#quest-list').innerHTML = list.map(({ q, st }) => {
      const prog = q.id in Q.active ? `${Math.min(Q.active[q.id], q.goal.n)}/${q.goal.n}` : '';
      const btn = st === 'ready' ? `<button data-q="claim:${q.id}" class="gold">รับรางวัล</button>`
        : st === 'active' ? `<button data-q="drop:${q.id}" class="ghost">ยกเลิก</button>`
        : st === 'open' ? `<button data-q="accept:${q.id}" ${nActive >= MAX_ACTIVE ? 'disabled' : ''}>รับเควส</button>`
        : st === 'locked' ? `<span class="meta">Lv.${q.lv}</span>` : '<span class="meta">✔ สำเร็จ</span>';
      return `<div class="quest ${st}"><div><b>${esc(q.nameTh)}</b> <span class="meta">Lv.${q.lv}+</span>
        <p>${esc(q.text)}</p><small>🎯 ${esc(this.goalText(q))} ${prog ? `<b>${prog}</b>` : ''}</small><small>🎁 ${esc(this.rewardText(q))}</small></div>${btn}</div>`;
    }).join('');
    $('#quest-note').textContent = `รับเควสได้พร้อมกัน ${MAX_ACTIVE} เควส (ตอนนี้ ${nActive})`;
  }

  accept(id) {
    this.econ.act('qAccept', { id }).then((r) => {
      if (!r.ok) return r.msg && this.ui.toast(r.msg, 'warn');
      this.scene.sfx.play('open');
      this.ui.toast(r.msg);
      this.afterChange();
    });
  }

  drop(id) { this.econ.act('qDrop', { id }).then(() => this.afterChange()); }

  /** ยืนอยู่ใกล้ผู้ใหญ่ชัย (หมู่บ้าน x520) */
  nearChai() { return this.scene.map?.id === 'village' && Math.abs(this.scene.player.x - 520) < 140; }

  claim(id) {
    const q = QUEST_BY_ID[id];
    if (!q) return;
    if (!this.nearChai()) return this.ui.toast('กลับไปรับรางวัลกับผู้ใหญ่ชัยที่หมู่บ้าน', 'warn');
    this.econ.act('qClaim', { id }).then((r) => {
      if (!r.ok) return r.msg && this.ui.toast(r.msg, 'warn');
      this.scene.sfx.play('victory');
      this.ui.banner(`✔ เควสสำเร็จ: ${q.nameTh}`);
      this.ui.toast(`รางวัล: ${this.rewardText(q)}`);
      this.scene.combat.afterGrant(r);
      this.afterChange();
    });
  }

  afterChange() {
    this.renderTracker();
    if (!$('#quest-panel').classList.contains('hidden')) this.renderQuests();
    this.ui.result({ ok: true });
  }

  renderTracker() {
    const Q = this.char.quests || { active: {}, done: [] };
    const ids = Object.keys(Q.active);
    $('#quest-track').classList.toggle('hidden', !ids.length);
    $('#quest-track').innerHTML = ids.map((id) => {
      const q = QUEST_BY_ID[id];
      if (!q) return '';
      const n = Math.min(Q.active[id], q.goal.n), done = n >= q.goal.n;
      return `<div class="${done ? 'done' : ''}"><b>${esc(q.nameTh)}</b><span>${esc(this.goalText(q))} ${n}/${q.goal.n}${done ? ' ✔' : ''}</span></div>`;
    }).join('');
  }
}
