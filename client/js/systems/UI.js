// ============================================================
//  UI – จัดการ HUD และหน้าต่าง DOM (สถานะ, กระเป๋า, ร้านค้า, แชท)
//  ใช้ HTML/CSS ซ้อนบน Canvas เพื่อให้ตัวหนังสือไทยคมชัด
// ============================================================
import { JOBS } from '/shared/data/classes.js';
import { ITEMS, SHOPS, sellPrice } from '/shared/data/items.js';
import { STAT_KEYS, STAT_INFO, expToNext } from '/shared/stats.js';
import { getDerived, allocateStat } from './Character.js';
import * as Inv from './Inventory.js';
import { SKILLS, SKILL_SLOTS, SKILL_BY_ID, MAX_SKILL_LV, skillStats, canLearn } from '/shared/data/skills.js';
import { MONSTERS } from '/shared/data/monsters.js';
import { WORLD } from '/shared/constants.js';
import { MAPS, MAP_LIST, REGIONS, mapAt } from '/shared/data/maps.js';
import { learnSkill, assignHotbar } from './Character.js';
import { saveSettings, toggleFullscreen } from './Settings.js';
import { PORTRAITS } from '../gfx/SpriteFactory.js';
import { modsText } from '/shared/data/blessings.js';
import { itemIcon, skillIcon, uiIcon } from './util.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SLOT_TH = { weapon: 'อาวุธ', armor: 'เสื้อ', accessory: 'เครื่องราง' };

export class UI {
  /** @param {Phaser.Scene} scene GameScene */
  constructor(scene) {
    this.scene = scene;
    this.shopTab = 'buy';
    this.shopId = null;
    this.hudCache = '';

    $('#hud').classList.remove('hidden');
    $('#chat').classList.remove('hidden');

    // ปุ่มเปิด/ปิดหน้าต่าง
    document.querySelectorAll('[data-open]').forEach((b) => (b.onclick = () => this.toggle(b.dataset.open)));
    document.querySelectorAll('.window .close').forEach((b) => (b.onclick = () => b.closest('.window').classList.add('hidden')));
    $('#shop-tabs').onclick = (e) => {
      const b = e.target.closest('button[data-tab]');
      if (!b) return;
      this.shopTab = b.dataset.tab;
      $('#shop-tabs').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
      this.renderShop();
    };

    this.bindSettings();
    this.applyUiIcons();

    // แชท
    const input = $('#chat-input');
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        const text = input.value.trim();
        if (text) {
          if (/^\/p\s+/i.test(text)) {                        // /p ข้อความ = แชทปาร์ตี้
            if (scene.social?.party) scene.social.partyChat(text.replace(/^\/p\s+/i, ''));
            else this.toast('ยังไม่มีปาร์ตี้', 'warn');
          } else if (scene.net.online) scene.net.sendChat(text);
          else this.chat({ name: scene.player.char.name, text }); // ออฟไลน์: แสดงเฉพาะเรา
        }
        input.value = '';
        input.blur();
      } else if (e.key === 'Escape') input.blur();
    });
    input.addEventListener('focus', () => (scene.input.keyboard.enabled = false));
    input.addEventListener('blur', () => (scene.input.keyboard.enabled = true));
  }

  get char() { return this.scene.player.char; }
  get typing() { return document.activeElement === $('#chat-input'); }

  focusChat() { $('#chat-input').focus(); }

  toggle(id, force) {
    const el = $('#' + id);
    const show = force ?? el.classList.contains('hidden');
    const was = !el.classList.contains('hidden');
    el.classList.toggle('hidden', !show);
    if (show !== was) this.scene.sfx?.play(show ? 'open' : 'close');
    if (show) this.refreshPanels();
  }

  closeAll() { document.querySelectorAll('.window:not(#trade-panel)').forEach((w) => w.classList.add('hidden')); $('#player-menu')?.classList.add('hidden'); }
  anyOpen() { return [...document.querySelectorAll('.window:not(#trade-panel)'), $('#player-menu')].some((w) => w && !w.classList.contains('hidden')); }

  // ---------------- HUD (อัปเดตเมื่อค่าเปลี่ยนเท่านั้น) ----------------
  updateHud() {
    const c = this.char, d = getDerived(c);
    const need = expToNext(c.level);
    const sig = [c.hp, c.mp, d.maxHp, d.maxMp, c.exp, c.level, c.gold, c.appearance.job, Inv.count(c, 'hp_s'), Inv.count(c, 'mp_s')].join('|');
    if (sig === this.hudCache) return;
    this.hudCache = sig;

    $('#hud-name').textContent = c.name;
    $('#hud-lv').textContent = c.level;
    $('#hud-job').textContent = JOBS[c.appearance.job].nameTh;
    $('#hud-hp').textContent = `HP ${Math.ceil(c.hp)} / ${d.maxHp}`;
    $('#hud-mp').textContent = `MP ${Math.floor(c.mp)} / ${d.maxMp}`;
    $('#hud-hp-fill').style.width = `${(c.hp / d.maxHp) * 100}%`;
    $('#hud-mp-fill').style.width = `${(c.mp / d.maxMp) * 100}%`;
    $('#hud-exp-fill').style.width = `${(c.exp / need) * 100}%`;
    $('#hud-exp').textContent = `EXP ${c.exp} / ${need}  (${((c.exp / need) * 100).toFixed(1)}%)`;
    $('#hud-gold').textContent = c.gold.toLocaleString();
    const hp = Inv.count(c, 'hp_s') + Inv.count(c, 'hp_m'), mp = Inv.count(c, 'mp_s') + Inv.count(c, 'mp_m');
    $('#quick-hp .n').textContent = `x${hp}`; $('#quick-hp').classList.toggle('empty', !hp);
    $('#quick-mp .n').textContent = `x${mp}`; $('#quick-mp').classList.toggle('empty', !mp);
    this.drawPortrait();
  }

  /** รูปโปรไฟล์: ครอปส่วนหัวจากภาพตัวละครที่ย้อมสีแล้ว */
  drawPortrait() {
    const key = this.scene.player.texKey;
    if (this.portraitKey === key) return;
    this.portraitKey = key;
    const cv = $('#hud-portrait'), ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, cv.width, cv.height);
    const src = PORTRAITS.get(key);
    if (src) {
      const size = Math.round(src.width * 0.75);
      ctx.drawImage(src, Math.round((src.width - size) / 2), 0, size, size, 0, 0, cv.width, cv.height);
    } else {
      const fr = this.scene.textures.getFrame(key, 'idle_0');
      ctx.drawImage(fr.source.image, fr.cutX + 6, fr.cutY + 2, 20, 20, 0, 0, cv.width, cv.height);
    }
  }

  // ---------------- เป้าหมาย / บัฟ / มินิแมป / เขต ----------------
  setTarget(mon) { this.target = mon; this.targetUntil = performance.now() + 4000; }

  updateFrame(time) {
    const p = this.scene.player;
    // เป้าหมาย
    const t = this.target, show = t && t.alive && !t.isBoss && performance.now() < this.targetUntil;   // บอสใช้แถบ HP ของตัวเอง
    $('#target').classList.toggle('hidden', !show);
    if (show) {
      $('#t-lv').textContent = `Lv.${t.def.level}`;
      $('#t-name').textContent = t.def.nameTh;
      $('#t-fill').style.width = `${Math.max(0, t.hp / t.def.hp) * 100}%`;
      $('#t-hp').textContent = `${Math.max(0, Math.ceil(t.hp))} / ${t.def.hp}`;
    }
    // บัฟ
    // บัฟจากสกิล (วินาที) + พรยาวจากเซียมซี/ศาลพระภูมิ (นาที)
    const now = Date.now();
    const bless = (p.char.blessings || []).filter((b) => b.until > now);
    const mins = (b) => { const m = Math.ceil((b.until - now) / 60000); return m > 90 ? `${Math.ceil(m / 60)}ชม` : `${m}น`; };
    const sig = p.buffs.map((b) => `${b.icon}${Math.ceil((b.until - time) / 1000)}`).join('|') + '#' + bless.map((b) => b.icon + mins(b)).join('|');
    if (sig !== this.buffSig) {
      this.buffSig = sig;
      $('#hud-buffs').innerHTML = p.buffs.filter((b) => b.until > time)
        .map((b) => `<span class="buff" title="${esc(b.name)}">${b.icon}<small>${Math.ceil((b.until - time) / 1000)}</small></span>`).join('')
        + bless.map((b) => `<span class="buff bless" title="${esc(b.nameTh)}: ${esc(modsText(b.mods))}">${b.icon}<small>${mins(b)}</small></span>`).join('');
    }
    // แผนที่โลก (ถ้าเปิดอยู่) อัปเดตทุก 300ms
    if (!$('#map-panel').classList.contains('hidden') && time - (this.wmAt || 0) > 300) { this.wmAt = time; this.updateMap(); }
    // มินิแมป (อัปเดตทุก 200ms)
    if (this.scene.settings.minimap && time - (this.mmAt || 0) > 200) {
      this.mmAt = time;
      const mp = this.scene.map, W = mp.maxX - mp.minX, inMap = (x) => x >= mp.minX && x <= mp.maxX;
      const pct = (x) => `${((x - mp.minX) / W) * 100}%`;
      let html = `<i class="mm-dot me" style="left:${pct(p.x)}"></i>`;
      mp.gates.forEach((g) => (html += `<i class="mm-dot gate" style="left:${pct(g.x)}"></i>`));
      if (mp.safe) this.scene.npcs.forEach((n) => (html += `<i class="mm-dot npc" style="left:${pct(n.x)}"></i>`));
      this.scene.remotes.forEach((r) => inMap(r.x) && (html += `<i class="mm-dot ally" style="left:${pct(r.x)}"></i>`));
      this.scene.monsters.getChildren().forEach((m) => m.alive && inMap(m.x) && (html += `<i class="mm-dot ${m.isBoss ? 'boss' : 'mob'}" style="left:${pct(m.x)}"></i>`));
      const ch = this.scene.forest?.chest;
      if (ch && inMap(ch.x)) html += `<i class="mm-dot chest" style="left:${pct(ch.x)}"></i>`;
      if (mp.fireX) html += `<i class="mm-dot fire" style="left:${pct(mp.fireX)}"></i>`;
      $('#mm-dots').innerHTML = html;
    }
  }

  /** แถบสีบนมินิแมป: หมู่บ้าน = ท่าน้ำ, ป่า = ลานบอส */
  refreshMinimap() {
    const mp = this.scene.map, W = mp.maxX - mp.minX;
    const town = $('.mm-town'), arena = $('.mm-arena');
    if (mp.safe) {
      town.style.left = '0'; town.style.width = `${((this.scene.riverX?.[1] ?? mp.minX) - mp.minX) / W * 100}%`;
      town.classList.add('river'); arena.style.width = '0';
    } else {
      town.classList.remove('river'); town.style.width = '0';
      arena.style.width = mp.boss ? '100%' : '0';
    }
  }

  /** ปุ่ม HUD ใช้ไอคอนภาพ (ถ้ามี) */
  applyUiIcons() {
    $('#quick-hp .ic').innerHTML = itemIcon('hp_s', '🧴');
    $('#quick-mp .ic').innerHTML = itemIcon('mp_s', '🥥');
    const q = document.querySelector('[data-open="quest-panel"]');
    if (q && uiIcon('quest')) q.innerHTML = `${uiIcon('quest')}<small>J</small>`;
    const f = document.querySelector('#fish-ui');
    if (f && uiIcon('fish') && !f.querySelector('.px-ico')) f.insertAdjacentHTML('afterbegin', uiIcon('fish'));
  }

  setZone(name, announce = true) {
    $('#zone-name').textContent = name;
    if (announce) this.banner(name);
  }

  banner(text) {
    const el = $('#banner');
    el.textContent = text;
    el.classList.remove('hidden');
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    clearTimeout(this.bannerT);
    this.bannerT = setTimeout(() => el.classList.add('hidden'), 2200);
  }

  showDeath(ms) {
    const el = $('#death');
    el.classList.remove('hidden');
    let left = Math.ceil(ms / 1000);
    $('#death-t').textContent = left;
    clearInterval(this.deathT);
    this.deathT = setInterval(() => {
      left--; $('#death-t').textContent = Math.max(0, left);
      if (left <= 0) { clearInterval(this.deathT); el.classList.add('hidden'); }
    }, 1000);
  }

  setOnline(on, count = 0) {
    const el = $('#net-status');
    el.className = `net ${on ? 'on' : 'off'}`;
    el.textContent = on ? `● ${count + 1} คนออนไลน์` : '● ออฟไลน์';
  }

  setMuted() { /* ย้ายไปอยู่ในหน้าตั้งค่า */ }

  // ---------------- แถบสกิล QWER ----------------
  // ============================================================
  //  Hotbar (Q W E R T) – รับการลากสกิลมาวาง / คลิกขวาเพื่อถอด
  // ============================================================
  hotbarSig() { const c = this.char; return JSON.stringify([c.appearance.job, c.hotbar, c.skills]); }

  buildSkillBar() {
    const c = this.char;
    this.skillSig = this.hotbarSig();
    $('#skillbar').innerHTML = SKILL_SLOTS.map((key) => {
      const id = c.hotbar[key], lv = c.skills[id] || 0;
      if (!id || !lv) return `<div class="skill empty" data-key="${key}"><span class="k">${key}</span><span class="ic">＋</span>
        <div class="tip">ช่อง ${key} ว่าง – กด K แล้วลากสกิลมาวาง</div></div>`;
      const s = skillStats(SKILL_BY_ID[id], lv);
      return `<div class="skill" data-key="${key}" data-id="${id}"><span class="k">${key}</span><span class="ic">${skillIcon(id, s.icon)}</span><span class="mp">${s.mp}</span>
        <div class="cd"></div><div class="cdt"></div>
        <div class="tip"><b>${s.nameTh}</b> Lv.${lv} (${key})<br>MP ${s.mp} · CD ${(s.cd / 1000).toFixed(1)}s${s.mult ? ` · ดาเมจ x${s.mult}` : ''}<br>${s.desc}</div></div>`;
    }).join('');
    this.skillEls = [...document.querySelectorAll('#skillbar .skill')];
    this.skillEls.forEach((el) => this.makeDropSlot(el, el.dataset.key));
  }

  updateSkillBar(time) {
    const c = this.char, p = this.scene.player;
    if (this.skillSig !== this.hotbarSig()) this.buildSkillBar();
    this.skillEls.forEach((el) => {
      const id = el.dataset.id;
      if (!id) return;
      const s = skillStats(SKILL_BY_ID[id], c.skills[id]);
      const left = p.cooldownLeft(id, time);
      el.querySelector('.cd').style.height = left ? `${(left / s.cd) * 100}%` : '0';
      el.querySelector('.cdt').textContent = left ? (left / 1000).toFixed(left < 1000 ? 1 : 0) : '';
      if (el.dataset.cd === '1' && !left) { el.classList.remove('ready'); void el.offsetWidth; el.classList.add('ready'); }
      el.dataset.cd = left ? '1' : '0';
      el.classList.toggle('nomp', c.mp < s.mp);
    });
  }

  /** ทำให้ element เป็นช่องรับการลากวางสกิล */
  makeDropSlot(el, key) {
    el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('drop-over'); });
    el.addEventListener('dragleave', () => el.classList.remove('drop-over'));
    el.addEventListener('drop', (e) => {
      e.preventDefault(); el.classList.remove('drop-over');
      const id = e.dataTransfer.getData('text/skill');
      if (id) this.assign(key, id);
    });
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); if (this.char.hotbar[key]) this.assign(key, null); });
  }

  assign(key, id) {
    if (!assignHotbar(this.char, key, id)) return this.toast('ต้องเรียนสกิลก่อนจึงติดตั้งได้', 'warn');
    this.scene.sfx.play('click');
    this.toast(id ? `ติดตั้ง ${SKILL_BY_ID[id].nameTh} ที่ช่อง ${key}` : `ถอดสกิลออกจากช่อง ${key}`);
    this.refreshPanels(); this.scene.saveSoon();
  }

  // ============================================================
  //  Skill Tree (K)
  // ============================================================
  renderSkillTree() {
    const c = this.char, job = c.appearance.job;
    $('#sk-job').textContent = JOBS[job].nameTh;
    $('#sk-sp').textContent = c.sp;
    $('#sk-tree').innerHTML = SKILLS[job].map((base) => {
      const lv = c.skills[base.id] || 0;
      const cur = skillStats(base, Math.max(1, lv)), next = lv < MAX_SKILL_LV ? skillStats(base, lv + 1) : null;
      const chk = canLearn(c, base.id);
      const locked = c.level < base.reqLv;
      const stat = (st) => `MP ${st.mp} · CD ${(st.cd / 1000).toFixed(1)}s${st.mult ? `<br>ดาเมจ x${st.mult}` : ''}${st.duration ? `<br>นาน ${(st.duration / 1000).toFixed(0)}s` : ''}`;
      const slotKey = SKILL_SLOTS.find((k) => c.hotbar[k] === base.id);
      return `<div class="sk-card ${base.ultimate ? 'ult' : ''} ${locked ? 'locked' : ''} ${lv ? '' : 'unlearned'}">
        <div class="sk-icon" draggable="${lv > 0}" data-id="${base.id}" title="ลากไปวางที่ Hotbar">${skillIcon(base.id, base.icon)}</div>
        <div class="sk-name">${base.nameTh}${base.ultimate ? ' ★' : ''}</div>
        <div class="sk-pips">${Array.from({ length: MAX_SKILL_LV }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</div>
        <div class="sk-lv">Lv.${lv} / ${MAX_SKILL_LV}</div>
        <div class="sk-desc">${base.desc}</div>
        <div class="sk-stat">${lv ? stat(cur) : stat(skillStats(base, 1))}${next && lv ? `<br><span style="color:#58d68d">→ Lv.${lv + 1}: ${next.mult ? `x${next.mult}` : `MP ${next.mp}`}</span>` : ''}</div>
        <button class="sk-up" data-learn="${base.id}" ${chk.ok ? '' : 'disabled'}>${lv ? '+ อัปเลเวล' : '+ เรียน'}</button>
        <div class="sk-req">${chk.ok || lv >= MAX_SKILL_LV ? '' : chk.reason}</div>
        <div class="sk-assign">${SKILL_SLOTS.map((k) => `<button data-as="${k}" data-id="${base.id}" class="${slotKey === k ? 'on' : ''}" ${lv ? '' : 'disabled'}>${k}</button>`).join('')}</div>
      </div>`;
    }).join('');

    $('#sk-tree').querySelectorAll('[data-learn]').forEach((b) => (b.onclick = () => {
      const r = learnSkill(c, b.dataset.learn);
      this.scene.sfx.play(r.ok ? 'buff' : 'error');
      this.toast(r.msg, r.ok ? '' : 'warn');
      this.refreshPanels(); this.scene.saveSoon();
    }));
    $('#sk-tree').querySelectorAll('[data-as]').forEach((b) => (b.onclick = () => this.assign(b.dataset.as, b.dataset.id)));
    $('#sk-tree').querySelectorAll('.sk-icon[draggable="true"]').forEach((ic) => {
      ic.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/skill', ic.dataset.id); e.dataTransfer.effectAllowed = 'copy'; });
    });

    // Hotbar ในหน้าต่างสกิล (ช่องรับวาง)
    $('#sk-hotbar').innerHTML = SKILL_SLOTS.map((k) => {
      const id = c.hotbar[k];
      return `<div class="hb-slot ${id ? 'filled' : ''}" data-key="${k}" title="คลิกขวาเพื่อถอด"><span class="k">${k}</span>${id ? skillIcon(id, SKILL_BY_ID[id].icon) : ''}</div>`;
    }).join('');
    $('#sk-hotbar').querySelectorAll('.hb-slot').forEach((el) => this.makeDropSlot(el, el.dataset.key));
  }

  // ============================================================
  //  แผนที่โลก (M)
  // ============================================================
  renderMap() { this.updateMap(); }

  /** แผนที่โลก: การ์ด 5 ภาค × 4 แมพ + หมู่บ้าน + ลานบอส (ไฮไลต์แมพปัจจุบัน / จำนวนเพื่อนในแต่ละแมพ) */
  updateMap() {
    const s = this.scene, cur = s.map?.id, lv = s.player.char.level;
    const friends = {};
    s.remotes.forEach((r) => { const id = mapAt(r.x).id; friends[id] = (friends[id] || 0) + 1; });
    const chip = (m) => {
      const mon = m.mon ? MONSTERS[m.mon] : null, lock = lv < (m.minLv || 1);
      const sub = m.id === 'village' ? 'Safe Zone · NPC · ตกปลา' : m.boss ? 'เรดบอส Lv.15' : `${mon.nameTh} Lv.${mon.level}${mon.nightBoost ? ' 🌙' : ''}`;
      return `<div class="wm-map ${m.id === cur ? 'cur' : ''} ${lock ? 'lock' : ''} ${m.boss ? 'boss' : ''}">
        <b>${m.no && !m.boss ? m.no + '. ' : ''}${esc(m.nameTh)}</b><span>${esc(sub)}${lock ? ` · 🔒Lv.${m.minLv}` : ''}</span>
        ${m.id === cur ? '<i class="wm-me">📍 คุณอยู่ที่นี่</i>' : ''}${friends[m.id] ? `<i class="wm-fr">👥 ${friends[m.id]}</i>` : ''}</div>`;
    };
    const html = `<div class="wm-region village"><h4>🏘️ หมู่บ้าน</h4><div class="wm-maps">${chip(MAPS.village)}</div></div>`
      + Object.values(REGIONS).map((R) => `<div class="wm-region ${R.id}"><h4>ภาค ${R.no} · ${esc(R.nameTh)}</h4><div class="wm-maps">${MAP_LIST.filter((m) => m.region === R.id).map(chip).join('')}</div></div>`).join('');
    if (html !== this.mapHtml) { this.mapHtml = html; $('#world-map').innerHTML = html; }
  }

  // ============================================================
  //  ตั้งค่า (ESC)
  // ============================================================
  bindSettings() {
    const st = this.scene.settings;
    const sync = () => {
      $('#set-bgm-on').checked = st.bgmOn; $('#set-bgm').value = Math.round(st.bgmVol * 100); $('#set-bgm-v').textContent = `${Math.round(st.bgmVol * 100)}`;
      $('#set-sfx-on').checked = st.sfxOn; $('#set-sfx').value = Math.round(st.sfxVol * 100); $('#set-sfx-v').textContent = `${Math.round(st.sfxVol * 100)}`;
      $('#set-dmg').checked = st.damageNumbers; $('#set-mm').checked = st.minimap;
      document.querySelector('.minimap').classList.toggle('hidden', !st.minimap);
    };
    const apply = () => { this.scene.sfx.applySettings(st); saveSettings(st); sync(); };
    $('#set-bgm-on').onchange = (e) => { st.bgmOn = e.target.checked; apply(); };
    $('#set-sfx-on').onchange = (e) => { st.sfxOn = e.target.checked; apply(); };
    $('#set-bgm').oninput = (e) => { st.bgmVol = e.target.value / 100; apply(); };
    $('#set-sfx').oninput = (e) => { st.sfxVol = e.target.value / 100; apply(); };
    $('#set-sfx').onchange = () => this.scene.sfx.play('coin');
    $('#set-dmg').onchange = (e) => { st.damageNumbers = e.target.checked; apply(); };
    $('#set-mm').onchange = (e) => { st.minimap = e.target.checked; apply(); };
    $('#set-fullscreen').onclick = () => toggleFullscreen();
    $('#set-close').onclick = () => this.toggle('settings-panel', false);
    apply();
  }

  prompt(text) {
    const el = $('#prompt');
    el.classList.toggle('hidden', !text);
    if (text) el.textContent = text;
  }

  toast(msg, kind = '') {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = msg;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), 2400);
  }

  chat({ name, text, party }) {
    const log = $('#chat-log');
    const el = document.createElement('div');
    if (party) el.className = 'party-msg';
    el.innerHTML = `<b>${esc(name)}:</b> ${esc(text)}`;
    log.appendChild(el);
    while (log.children.length > 8) log.firstChild.remove();
  }

  /** ผลลัพธ์จาก Inventory → แจ้งเตือน + รีเฟรช */
  result(r) {
    if (r.msg) this.toast(r.msg, r.ok ? '' : 'warn');
    if (r.jobChanged) this.scene.onAppearanceChanged();
    this.hudCache = '';
    this.refreshPanels();
    this.scene.saveSoon();
  }

  refreshPanels() {
    if (!$('#stats-panel').classList.contains('hidden')) this.renderStats();
    if (!$('#inv-panel').classList.contains('hidden')) this.renderInventory();
    if (!$('#shop-panel').classList.contains('hidden')) this.renderShop();
    if (!$('#skill-panel').classList.contains('hidden')) this.renderSkillTree();
    if (!$('#map-panel').classList.contains('hidden')) this.renderMap();
    this.updateHud();
  }

  // ---------------- หน้าต่างสถานะ ----------------
  renderStats() {
    const c = this.char, d = getDerived(c);
    $('#st-points').textContent = c.statPoints;
    $('#st-list').innerHTML = STAT_KEYS.map((k) => `
      <div class="stat-row">
        <span class="k">${k}</span>
        <span><div>${STAT_INFO[k].nameTh}</div><div class="d">${STAT_INFO[k].desc}</div></span>
        <span class="v">${c.stats[k]}</span>
        <button data-stat="${k}" ${c.statPoints ? '' : 'disabled'}>+</button>
      </div>`).join('');
    $('#st-list').querySelectorAll('button').forEach((b) => (b.onclick = () => {
      if (allocateStat(c, b.dataset.stat)) this.result({ ok: true });
    }));
    const pct = (v) => `${(v * 100).toFixed(1)}%`;
    const rows = [
      ['HP สูงสุด', d.maxHp], ['MP สูงสุด', d.maxMp],
      ['พลังโจมตีกายภาพ', d.patk], ['พลังเวทย์', d.matk],
      ['ความแม่นยำ', `${d.accuracy}%`], ['โอกาสคริติคอล', pct(d.critRate)],
      ['ความแรงคริติคอล', `x${d.critDmg.toFixed(2)}`], ['ป้องกัน / หลบ', `${d.def} / ${d.eva}`],
    ];
    $('#st-derived').innerHTML = rows.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  }

  // ---------------- กระเป๋า ----------------
  renderInventory() {
    const c = this.char;
    $('#inv-equip').innerHTML = Object.entries(c.equipment).map(([slot, id]) => `
      <div class="eq"><small>${SLOT_TH[slot]}</small>${id ? `${itemIcon(id, ITEMS[id].icon)} ${ITEMS[id].nameTh}${c.enhance?.[slot] ? ` <b class="enh">+${c.enhance[slot]}</b>` : ''} <button class="close" data-unequip="${slot}">✕</button>` : '—'}</div>`).join('');
    $('#inv-equip').querySelectorAll('[data-unequip]').forEach((b) => (b.onclick = () => this.result(Inv.unequip(c, b.dataset.unequip))));

    if (!c.inventory.length) { $('#inv-list').innerHTML = '<div class="empty">กระเป๋าว่างเปล่า</div>'; return; }
    $('#inv-list').innerHTML = c.inventory.map((s) => {
      const it = ITEMS[s.id];
      const action = { consumable: 'ใช้', food: 'กิน', offering: 'ถวาย', weapon: 'สวม', armor: 'สวม', accessory: 'สวม', skin: c.appearance.job === it.job ? 'ใช้อยู่' : 'เปลี่ยนอาชีพ' }[it.type];
      const job = it.jobs ? ` · ${it.jobs.map((j) => JOBS[j].nameTh).join('/')}` : '';
      return `<div class="item"><span class="ic">${itemIcon(s.id, it.icon)}</span>
        <span>${esc(it.nameTh)} <span class="meta">x${s.qty}${job}</span></span>
        <span class="price">฿${sellPrice(s.id)}</span>
        ${action ? `<button data-use="${s.id}" ${action === 'ใช้อยู่' ? 'disabled' : ''}>${action}</button>` : '<span></span>'}</div>`;
    }).join('');
    $('#inv-list').querySelectorAll('[data-use]').forEach((b) => (b.onclick = () => this.result(Inv.useItem(c, b.dataset.use))));
  }

  // ---------------- ร้านค้า NPC ----------------
  openShop(shopId) {
    this.shopId = shopId;
    const shop = SHOPS[shopId];
    $('#shop-title').textContent = shop.nameTh;
    $('#shop-greet').textContent = `“${shop.greeting}”`;
    const TAB_TH = { buy: 'ซื้อ', sell: 'ขาย', enhance: `${uiIcon('anvil', '🔨')} ตีบวก`, cook: `${uiIcon('soup', '🍳')} ทำอาหาร`, brew: `${uiIcon('herb', '🌿')} ปรุงยา` };
    const tabs = shop.tabs || ['buy', 'sell'];
    this.shopTab = tabs[0];
    $('#shop-tabs').innerHTML = tabs.map((t, i) => `<button data-tab="${t}" class="${i ? '' : 'active'}">${TAB_TH[t]}</button>`).join('');
    this.closeAll();
    this.toggle('shop-panel', true);
  }

  renderShop() {
    const c = this.char, shop = SHOPS[this.shopId];
    $('#shop-gold').textContent = c.gold.toLocaleString();
    let html;
    if (this.shopTab === 'enhance') return this.scene.village.renderEnhance($('#shop-list'));
    if (this.shopTab === 'cook') return this.scene.village.renderCook($('#shop-list'));
    if (this.shopTab === 'brew') return this.scene.village.renderBrew($('#shop-list'));
    if (this.shopTab === 'buy') {
      html = shop.stock.map((id) => {
        const it = ITEMS[id];
        const owned = it.type === 'skin' && Inv.count(c, id);
        const job = it.jobs ? `<span class="meta"> · ${it.jobs.map((j) => JOBS[j].nameTh).join('/')}</span>` : '';
        const bonus = it.bonus ? `<span class="meta"> ${Object.entries(it.bonus).map(([k, v]) => `${k.toUpperCase()}+${k === 'crit' ? v * 100 + '%' : v}`).join(' ')}</span>` : '';
        const food = it.buff ? `<span class="meta"> ${esc(it.buff.textTh)}</span>` : '';
        return `<div class="item"><span class="ic">${itemIcon(id, it.icon)}</span><span>${esc(it.nameTh)}${job}${bonus}${food}</span>
          <span class="price">฿${it.price}</span>
          <button data-buy="${id}" ${owned || c.gold < it.price ? 'disabled' : ''}>${owned ? 'มีแล้ว' : 'ซื้อ'}</button></div>`;
      }).join('');
    } else {
      const sellable = c.inventory.filter((s) => ITEMS[s.id].type !== 'skin');
      html = sellable.length ? sellable.map((s) => {
        const it = ITEMS[s.id];
        return `<div class="item"><span class="ic">${itemIcon(s.id, it.icon)}</span><span>${esc(it.nameTh)} <span class="meta">x${s.qty}</span></span>
          <span class="price">฿${sellPrice(s.id)}</span><button data-sell="${s.id}">ขาย</button></div>`;
      }).join('') : '<div class="empty">ไม่มีของให้ขาย</div>';
    }
    $('#shop-list').innerHTML = html;
    const trade = (r) => { this.scene.sfx.play(r.ok ? 'buy' : 'error'); this.result(r); };
    $('#shop-list').querySelectorAll('[data-buy]').forEach((b) => (b.onclick = () => trade(Inv.buy(c, b.dataset.buy))));
    $('#shop-list').querySelectorAll('[data-sell]').forEach((b) => (b.onclick = () => trade(Inv.sell(c, b.dataset.sell))));
  }
}
