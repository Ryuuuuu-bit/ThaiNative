// ============================================================
//  UI – จัดการ HUD และหน้าต่าง DOM (สถานะ, กระเป๋า, ร้านค้า, แชท)
//  ใช้ HTML/CSS ซ้อนบน Canvas เพื่อให้ตัวหนังสือไทยคมชัด
// ============================================================
import { JOBS, JOB_IDS, PATH_LV, STAT_PLAN } from '/shared/data/classes.js';
import { ITEMS, SHOPS, sellPrice, WTYPE_JOB } from '/shared/data/items.js';
import { STAT_KEYS, STAT_INFO, expToNext, MAX_LEVEL } from '/shared/stats.js';
import { getDerived, allocateStat, pathName } from './Character.js';
import * as Inv from './Inventory.js';
import { SKILLS, SKILL_SLOTS, SKILL_BY_ID, MAX_SKILL_LV, skillStats, canLearn, skillCap } from '/shared/data/skills.js';
import { MONSTERS } from '/shared/data/monsters.js';
import { WORLD } from '/shared/constants.js';
import { MAPS, MAP_LIST, REGIONS, mapAt } from '/shared/data/maps.js';
import { learnSkill, assignHotbar } from './Character.js';
import { saveSettings, toggleFullscreen } from './Settings.js';
import { PORTRAITS } from '../gfx/SpriteFactory.js';
import { modsText } from '/shared/data/blessings.js';
import { ENHANCE } from '/shared/data/village.js';
import { itemIcon, skillIcon, uiIcon } from './util.js';
import { bindAccountSettings } from './AuthScreen.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SLOT_TH = { weapon: 'อาวุธ', armor: 'เสื้อ', accessory: 'เครื่องราง' };
/** ป้ายแนวของอาวุธ / สายของชุด */
const itemTag = (it) => it.wtype ? ` · แนว${JOBS[WTYPE_JOB[it.wtype]].nameTh}` : it.path ? ` · ชุดสาย${JOBS[it.path].nameTh}` : '';

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
    this.renderAccount = bindAccountSettings(this);

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
    const sig = [c.hp, c.mp, d.maxHp, d.maxMp, c.exp, c.level, c.gold, c.appearance.job, c.path, c.statPoints, c.sp, JSON.stringify(c.skills), Inv.count(c, 'hp_s'), Inv.count(c, 'mp_s')].join('|');
    if (sig === this.hudCache) return;
    this.hudCache = sig;

    $('#hud-name').textContent = c.name;
    // จุดแดงเตือน: มีแต้มสถานะ / มีสกิลที่อัปได้
    document.querySelector('.hud-buttons [data-open="stats-panel"]')?.classList.toggle('alert', c.statPoints > 0);
    const canSkill = c.sp > 0 && Object.values(SKILLS).some((list) => list.some((sk) => canLearn(c, sk.id).ok));
    document.querySelector('.hud-buttons [data-open="skill-panel"]')?.classList.toggle('alert', canSkill);
    if ($('#hud-lv2').textContent !== String(c.level)) {
      const up = +$('#hud-lv2').textContent > 0 && c.level > +$('#hud-lv2').textContent;
      $('#hud-lv').textContent = c.level; $('#hud-lv2').textContent = c.level;
      if (up) document.querySelectorAll('.lv-tag').forEach((el) => { el.classList.remove('up'); void el.offsetWidth; el.classList.add('up'); });
    }
    $('#hud-job').textContent = `${pathName(c)} · ${JOBS[c.appearance.job].icon}`;
    $('#hud-job').title = `สายหลัก: ${pathName(c)} · แนวต่อสู้ตอนนี้: ${JOBS[c.appearance.job].nameTh} (ตามอาวุธที่ถือ)`;
    $('#hud-hp').textContent = `HP ${Math.ceil(c.hp)} / ${d.maxHp}`;
    $('#hud-mp').textContent = `MP ${Math.floor(c.mp)} / ${d.maxMp}`;
    $('#hud-hp-fill').style.width = `${(c.hp / d.maxHp) * 100}%`;
    $('#hud-mp-fill').style.width = `${(c.mp / d.maxMp) * 100}%`;
    const maxed = c.level >= MAX_LEVEL;
    $('#hud-exp-fill').style.width = maxed ? '100%' : `${(c.exp / need) * 100}%`;
    $('#hud-exp').textContent = maxed ? `EXP MAX · เลเวลตัน Lv.${MAX_LEVEL}` : `EXP ${c.exp} / ${need}  (${((c.exp / need) * 100).toFixed(1)}%)`;
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
    const gold = document.querySelector('.actionbar .gold');
    if (gold && uiIcon('gold') && !gold.querySelector('.px-ico')) gold.innerHTML = `${uiIcon('gold')} <b id="hud-gold">${$('#hud-gold').textContent}</b>`;
    // ปุ่มเมนูขวาบน: ไอคอนชุดเดียวกัน (PixelLab ui_menu_*)
    const MENU = { 'stats-panel': 'menu_stats', 'inv-panel': 'menu_bag', 'skill-panel': 'menu_skill', 'map-panel': 'menu_map',
      'social-panel': 'menu_party', 'quest-panel': 'menu_quest', 'help-panel': 'menu_help', 'settings-panel': 'menu_settings' };
    for (const [panel, key] of Object.entries(MENU)) {
      const b = document.querySelector(`.hud-buttons [data-open="${panel}"]`), ic = uiIcon(key);
      if (b && ic) b.innerHTML = `${ic}${b.querySelector('small')?.outerHTML || ''}`;
    }
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
      const off = SKILL_BY_ID[id].job !== c.appearance.job;
      return `<div class="skill${off ? ' noweapon' : ''}" data-key="${key}" data-id="${id}"><span class="k">${key}</span><span class="ic">${skillIcon(id, s.icon)}</span><span class="mp">${s.mp}</span>
        <div class="cd"></div><div class="cdt"></div>
        <div class="tip"><b>${s.nameTh}</b> Lv.${lv} (${key})<br>MP ${s.mp} · CD ${(s.cd / 1000).toFixed(1)}s${s.mult ? ` · ดาเมจ x${s.mult}` : ''}<br>${s.desc}${off ? `<br><span style="color:#f5b041">ต้องถือ${JOBS[SKILL_BY_ID[id].job].weaponTh}</span>` : ''}</div></div>`;
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
    const c = this.char;
    if (!this.skTab) this.skTab = c.path || c.appearance.job;
    const job = this.skTab;
    $('#sk-job').textContent = c.path ? `สายหลัก ${JOBS[c.path].pathTitle}` : `ชาวบ้าน (เลือกสายหลักตอน Lv.${PATH_LV})`;
    $('#sk-sp').textContent = c.sp;
    let tabs = $('#sk-tabs');
    if (!tabs) { tabs = document.createElement('div'); tabs.id = 'sk-tabs'; tabs.className = 'sk-tabs'; $('#sk-tree').before(tabs); }
    tabs.innerHTML = JOB_IDS.map((j) => {
      const learned = SKILLS[j].reduce((a, sk) => a + (c.skills[sk.id] || 0), 0);
      return `<button data-sktab="${j}" class="${j === job ? 'active' : ''} ${c.path === j ? 'main' : ''}">${JOBS[j].icon} ${JOBS[j].nameTh}${c.path === j ? ' ★' : ''}${learned ? ` <small>${learned}</small>` : ''}</button>`;
    }).join('') + `<span class="sk-note">${c.path === job ? 'สายหลัก: อัปได้ถึง Lv.5 + ท่าไม้ตาย ★' : c.path ? 'สายรอง: อัปได้ถึง Lv.2 ไม่มีท่าไม้ตาย' : `ก่อน Lv.${PATH_LV} ทุกสายอัปได้ถึง Lv.2`} · ใช้ได้เมื่อถือ${JOBS[job].weaponTh}${c.appearance.job === job ? ' ✔' : ''}</span>`;
    tabs.querySelectorAll('[data-sktab]').forEach((b) => (b.onclick = () => { this.skTab = b.dataset.sktab; this.scene.sfx.play('click'); this.renderSkillTree(); }));
    $('#sk-tree').innerHTML = SKILLS[job].map((base) => {
      const lv = c.skills[base.id] || 0;
      const cap = skillCap(c, { ...base, job });
      const cur = skillStats(base, Math.max(1, lv)), next = lv < MAX_SKILL_LV ? skillStats(base, lv + 1) : null;
      const chk = canLearn(c, base.id);
      const locked = c.level < base.reqLv || cap === 0;
      const stat = (st) => `MP ${st.mp} · CD ${(st.cd / 1000).toFixed(1)}s${st.mult ? `<br>ดาเมจ x${st.mult}` : ''}${st.duration ? `<br>นาน ${(st.duration / 1000).toFixed(0)}s` : ''}`;
      const slotKey = SKILL_SLOTS.find((k) => c.hotbar[k] === base.id);
      return `<div class="sk-card ${base.ultimate ? 'ult' : ''} ${locked ? 'locked' : ''} ${lv ? '' : 'unlearned'}">
        <div class="sk-icon" draggable="${lv > 0}" data-id="${base.id}" title="ลากไปวางที่ Hotbar">${skillIcon(base.id, base.icon)}</div>
        <div class="sk-name">${base.nameTh}${base.ultimate ? ' ★' : ''}</div>
        <div class="sk-pips">${Array.from({ length: MAX_SKILL_LV }, (_, i) => `<i class="${i < lv ? 'on' : i >= cap ? 'cap' : ''}"></i>`).join('')}</div>
        <div class="sk-lv">Lv.${lv} / ${cap}</div>
        <div class="sk-desc">${base.desc}</div>
        <div class="sk-stat">${lv ? stat(cur) : stat(skillStats(base, 1))}${next && lv ? `<br><span style="color:#58d68d">→ Lv.${lv + 1}: ${next.mult ? `x${next.mult}` : `MP ${next.mp}`}</span>` : ''}</div>
        <span class="sk-ups"><button class="sk-up" data-learn="${base.id}" ${chk.ok ? '' : 'disabled'}>${lv ? '+ อัป' : '+ เรียน'}</button><button class="sk-up max" data-learnmax="${base.id}" ${chk.ok ? '' : 'disabled'} title="อัปจนสุดเท่าที่ SP/เลเวลให้">MAX</button></span>
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
    $('#sk-tree').querySelectorAll('[data-learnmax]').forEach((b) => (b.onclick = () => {
      let n = 0, r;
      while ((r = learnSkill(c, b.dataset.learnmax)).ok) n++;
      this.scene.sfx.play(n ? 'buff' : 'error');
      this.toast(n ? `${SKILL_BY_ID[b.dataset.learnmax].nameTh} +${n} เลเวล (Lv.${c.skills[b.dataset.learnmax]})` : r.msg, n ? '' : 'warn');
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
      $('#set-auto-hp').value = String(st.autoHp || 0); $('#set-auto-mp').value = String(st.autoMp || 0);
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
    $('#set-auto-hp').onchange = (e) => { st.autoHp = +e.target.value; apply(); };
    $('#set-auto-mp').onchange = (e) => { st.autoMp = +e.target.value; apply(); };
    $('#set-fullscreen').onclick = () => toggleFullscreen();
    $('#set-close').onclick = () => this.toggle('settings-panel', false);
    apply();
  }

  prompt(text) {
    const el = $('#prompt');
    el.classList.toggle('hidden', !text);
    if (text) el.textContent = text;
  }

  /** บันทึกของที่ได้ (มุมซ้ายล่าง เหนือแชท) – เก็บ 6 บรรทัดล่าสุด จางหายเอง */
  loot(text) {
    const box = $('#loot-log');
    if (!box) return;
    const el = document.createElement('div');
    el.textContent = text;
    box.appendChild(el);
    while (box.children.length > 6) box.firstChild.remove();
    setTimeout(() => el.classList.add('fade'), 5000);
    setTimeout(() => el.remove(), 6000);
  }

  toast(msg, kind = '', ms = 2400) {
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.textContent = msg;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), ms);
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
  // ลงแต้มแบบ "ร่าง": กด +1/+5/+10/สูงสุด หรือลงอัตโนมัติ → ดูค่าพลังก่อน→หลัง → ยืนยัน/ยกเลิก
  renderStats() {
    const c = this.char;
    const D = (this.statDraft ||= {});
    let used = STAT_KEYS.reduce((a, k) => a + (D[k] || 0), 0);
    if (used > c.statPoints) { this.statDraft = {}; return this.renderStats(); }
    const left = c.statPoints - used;
    $('#st-points').textContent = used ? `${left} (ร่าง +${used})` : c.statPoints;
    const btn = (k, n, label) => `<button data-st="${k}" data-n="${n}" ${left >= 1 ? '' : 'disabled'}>${label}</button>`;
    $('#st-list').innerHTML = STAT_KEYS.map((k) => `
      <div class="stat-row q">
        <span class="k">${k}</span>
        <span><div>${STAT_INFO[k].nameTh}</div><div class="d">${STAT_INFO[k].desc}</div></span>
        <span class="v">${c.stats[k]}${D[k] ? `<b class="add">+${D[k]}</b>` : ''}</span>
        <span class="st-btns"><button class="minus" data-st="${k}" data-n="-1" ${D[k] ? '' : 'disabled'}>−</button>${btn(k, 1, '+1')}${btn(k, 5, '+5')}${btn(k, 10, '+10')}${btn(k, 999, 'MAX')}</span>
      </div>`).join('');
    $('#st-list').querySelectorAll('[data-st]').forEach((b) => (b.onclick = (e) => {
      const k = b.dataset.st; let n = +b.dataset.n;
      if (e.shiftKey && n === 1) n = 10;                                  // Shift+คลิก = +10
      const free = c.statPoints - STAT_KEYS.reduce((a, x) => a + (D[x] || 0), 0);
      D[k] = Math.max(0, (D[k] || 0) + (n > 0 ? Math.min(n, free) : n));
      this.scene.sfx.play('click');
      this.renderStats();
    }));
    const style = c.path || c.appearance.job;
    $('#st-actions').innerHTML = c.statPoints ? `
      <button class="btn ghost sm" data-sa="auto" ${left ? '' : 'disabled'}>✨ ลงอัตโนมัติ (${JOBS[style].nameTh})</button>
      <button class="btn ghost sm" data-sa="reset" ${used ? '' : 'disabled'}>↺ ยกเลิกร่าง</button>
      <button class="btn primary sm" data-sa="ok" ${used ? '' : 'disabled'}>✔ ยืนยัน (${used} แต้ม)</button>` : '<span class="meta">ไม่มีแต้มเหลือ · ได้ 5 แต้มทุกเลเวล</span>';
    $('#st-actions').querySelectorAll('[data-sa]').forEach((b) => (b.onclick = () => {
      const a = b.dataset.sa;
      if (a === 'reset') this.statDraft = {};
      if (a === 'auto') {                                                  // แบ่งแต้มที่เหลือตามสัดส่วนของสาย (เศษไปตัวที่ได้สัดส่วนมากสุด)
        const plan = STAT_PLAN[style], keys = Object.keys(plan);
        const give = keys.map((k) => ({ k, n: Math.floor(left * plan[k]), r: left * plan[k] % 1 }));
        let rest = left - give.reduce((x, g) => x + g.n, 0);
        give.sort((x, y) => y.r - x.r).forEach((g) => { if (rest > 0) { g.n++; rest--; } });
        give.forEach((g) => (D[g.k] = (D[g.k] || 0) + g.n));
      }
      if (a === 'ok') {
        for (const k of STAT_KEYS) for (let i = 0; i < (D[k] || 0); i++) allocateStat(c, k);
        this.statDraft = {};
        this.scene.sfx.play('buff');
        this.toast(`ลงแต้มสถานะแล้ว ${used} แต้ม`);
        return this.result({ ok: true });
      }
      this.scene.sfx.play('click');
      this.renderStats();
    }));
    // ค่าพลังก่อน → หลัง (ตามร่าง)
    const d = getDerived(c), after = used ? getDerived({ ...c, stats: Object.fromEntries(STAT_KEYS.map((k) => [k, c.stats[k] + (D[k] || 0)])) }) : d;
    const pct = (v) => `${(v * 100).toFixed(1)}%`;
    const rows = [
      ['HP สูงสุด', 'maxHp'], ['MP สูงสุด', 'maxMp'], ['พลังโจมตีกายภาพ', 'patk'], ['พลังเวทย์', 'matk'],
      ['ความแม่นยำ', 'accuracy', (v) => `${v}%`], ['โอกาสคริติคอล', 'critRate', pct],
      ['ความแรงคริติคอล', 'critDmg', (v) => `x${v.toFixed(2)}`], ['ป้องกัน', 'def'], ['หลบ', 'eva'],
    ];
    $('#st-derived').innerHTML = rows.map(([label, key, f = (v) => v]) => {
      const up = after[key] !== d[key];
      return `<div><span>${label}</span><b>${f(d[key])}${up ? ` <em class="up">→ ${f(after[key])}</em>` : ''}</b></div>`;
    }).join('')
      + `<div class="path-line"><span>สายหลัก</span><b>${c.path ? `${JOBS[c.path].pathTitle} (${JOBS[c.path].pathTextTh})` : `ชาวบ้าน · ถึง Lv.${PATH_LV} ไปหาผู้ใหญ่ชัย`}</b></div>`
      + `<div class="path-line"><span>แนวต่อสู้ (ตามอาวุธ)</span><b>${JOBS[c.appearance.job].icon} ${JOBS[c.appearance.job].nameTh}</b></div>`;
  }

  // ---------------- กระเป๋า ----------------
  renderInventory() {
    const c = this.char;
    $('#inv-equip').innerHTML = Object.entries(c.equipment).map(([slot, id]) => `
      <div class="eq"><small>${SLOT_TH[slot]}</small>${id ? `${itemIcon(id, ITEMS[id].icon)} ${ITEMS[id].nameTh}${c.enhance?.[slot] ? ` <b class="enh t${ENHANCE.auraTier(c.enhance[slot])}">+${c.enhance[slot]}</b>` : ''} <button class="close" data-unequip="${slot}">✕</button>` : '—'}</div>`).join('');
    const COS_TH = { head: 'หมวก/มงกุฎ', face: 'หน้ากาก', back: 'ของหลัง', outfit: 'ชุดแต่งตัว' };
    $('#inv-equip').innerHTML += `<div class="eq-cos">${Object.entries(COS_TH).map(([slot, th]) => { const id = c.costume?.[slot];
      return `<div class="eq cos"><small>${th}</small>${id ? `${itemIcon(id, ITEMS[id].icon)} ${ITEMS[id].nameTh} <button class="close" data-uncos="${slot}">✕</button>` : '—'}</div>`; }).join('')}</div>`;
    $('#inv-equip').querySelectorAll('[data-unequip]').forEach((b) => (b.onclick = () => this.result(Inv.unequip(c, b.dataset.unequip))));
    $('#inv-equip').querySelectorAll('[data-uncos]').forEach((b) => (b.onclick = () => this.result(Inv.takeOffCostume(c, b.dataset.uncos))));

    if (!c.inventory.length) { $('#inv-list').innerHTML = '<div class="empty">กระเป๋าว่างเปล่า</div>'; return; }
    // แท็บกรอง + เรียงลำดับ
    const CAT = { all: ['ทั้งหมด', () => true], gear: ['อุปกรณ์', (t) => ['weapon', 'armor', 'accessory'].includes(t)], cos: ['ชุดแต่งตัว', (t) => t === 'costume'],
      use: ['ยา/อาหาร', (t) => ['consumable', 'food', 'reset', 'skin', 'offering'].includes(t)],
      mat: ['วัตถุดิบ', (t) => ['material', 'herb', 'fish'].includes(t)] };
    const ORDER = ['weapon', 'armor', 'accessory', 'costume', 'consumable', 'food', 'reset', 'skin', 'offering', 'herb', 'fish', 'material'];
    const cat = this.invCat || 'all', sort = this.invSort || 'type';
    const list = c.inventory.filter((s) => CAT[cat][1](ITEMS[s.id].type)).sort((a, b) => {
      const A = ITEMS[a.id], B = ITEMS[b.id];
      if (sort === 'name') return A.nameTh.localeCompare(B.nameTh, 'th');
      if (sort === 'price') return sellPrice(b.id) * b.qty - sellPrice(a.id) * a.qty;
      return ORDER.indexOf(A.type) - ORDER.indexOf(B.type) || A.nameTh.localeCompare(B.nameTh, 'th');
    });
    const tabs = `<div class="inv-tools"><div class="inv-tabs">${Object.entries(CAT).map(([k, [l]]) => `<button data-cat="${k}" class="${k === cat ? 'active' : ''}">${l}</button>`).join('')}</div>
      <select id="inv-sort"><option value="type">เรียง: ประเภท</option><option value="name">เรียง: ชื่อ</option><option value="price">เรียง: มูลค่า</option></select></div>`;
    // เทียบค่าพลังกับของที่ใส่อยู่ช่องเดียวกัน
    const SLOT = { weapon: 'weapon', armor: 'armor', accessory: 'accessory' };
    const diff = (it) => {
      const slot = SLOT[it.type]; if (!slot) return '';
      const cur = ITEMS[c.equipment[slot]]?.bonus || {}, nb = it.bonus || {};
      const keys = [...new Set([...Object.keys(cur), ...Object.keys(nb)])];
      const parts = keys.map((k) => { const d = (nb[k] || 0) - (cur[k] || 0); if (!d) return ''; const v = k === 'crit' ? `${+(d * 100).toFixed(1)}%` : Math.abs(d);
        return `<span class="${d > 0 ? 'upv' : 'dnv'}">${k.toUpperCase()}${d > 0 ? '▲' : '▼'}${typeof v === 'string' ? v.replace('-', '') : v}</span>`; }).filter(Boolean);
      return parts.length ? `<div class="cmp">${c.equipment[slot] ? 'เทียบของที่ใส่: ' : 'ใส่แล้วได้: '}${parts.join(' ')}</div>` : '<div class="cmp">ค่าพลังเท่ากับของที่ใส่</div>';
    };
    $('#inv-list').innerHTML = tabs + (list.length ? list.map((s) => {
      const it = ITEMS[s.id], lock = Inv.isLocked(c, s.id);
      const action = { consumable: 'ใช้', food: 'กิน', offering: 'ถวาย', weapon: 'ถือ', armor: 'สวม', accessory: 'สวม', costume: 'แต่ง', reset: 'ใช้', skin: c.path === it.job ? 'ใช้อยู่' : 'เปลี่ยนสาย' }[it.type];
      const job = itemTag(it) || (it.type === 'costume' ? ` · ชุดแต่งตัว${it.rare ? ' ✨หายาก' : ''}` : '');
      return `<div class="item inv"><span class="ic">${itemIcon(s.id, it.icon)}</span>
        <span>${esc(it.nameTh)} <span class="meta">x${s.qty}${job}</span>${diff(it)}</span>
        <button class="lock ${lock ? 'on' : ''}" data-lock="${s.id}" title="${lock ? 'ปลดล็อก' : 'ล็อก (กันขาย)'}">${lock ? '🔒' : '🔓'}</button>
        <span class="price">฿${sellPrice(s.id)}</span>
        ${action ? `<button data-use="${s.id}" ${action === 'ใช้อยู่' ? 'disabled' : ''}>${action}</button>` : '<span></span>'}</div>`;
    }).join('') : '<div class="empty">ไม่มีของในหมวดนี้</div>');
    $('#inv-sort').value = sort;
    $('#inv-sort').onchange = (e) => { this.invSort = e.target.value; this.renderInventory(); };
    $('#inv-list').querySelectorAll('[data-cat]').forEach((b) => (b.onclick = () => { this.invCat = b.dataset.cat; this.scene.sfx.play('click'); this.renderInventory(); }));
    $('#inv-list').querySelectorAll('[data-lock]').forEach((b) => (b.onclick = () => {
      const on = Inv.toggleLock(c, b.dataset.lock);
      this.toast(on ? `🔒 ล็อก ${ITEMS[b.dataset.lock].nameTh} (จะไม่ถูกขาย)` : `🔓 ปลดล็อก ${ITEMS[b.dataset.lock].nameTh}`);
      this.scene.sfx.play('click'); this.renderInventory(); this.scene.saveSoon();
    }));
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
    // เลือกจำนวน: x1 / x5 / x10 / สูงสุด (ใช้ทั้งซื้อและขาย)
    const QTY = [[1, 'x1'], [5, 'x5'], [10, 'x10'], [9999, 'สูงสุด']];
    const q = this.shopQty || 1;
    const qtyBar = `<div class="qty-bar"><span>จำนวน:</span>${QTY.map(([n, l]) => `<button data-qty="${n}" class="${q === n ? 'active' : ''}">${l}</button>`).join('')}</div>`;
    if (this.shopTab === 'buy') {
      html = qtyBar + shop.stock.map((id) => {
        const it = ITEMS[id];
        const owned = it.type === 'skin' && Inv.count(c, id);
        const n = it.type === 'skin' ? 1 : Math.max(1, Math.min(q, Math.floor(c.gold / it.price)));
        const job = itemTag(it) ? `<span class="meta">${itemTag(it)}</span>` : it.desc ? `<span class="meta"> · ${esc(it.desc)}</span>` : '';
        const bonus = it.bonus ? `<span class="meta"> ${Object.entries(it.bonus).map(([k, v]) => `${k.toUpperCase()}+${k === 'crit' ? v * 100 + '%' : v}`).join(' ')}</span>` : '';
        const food = it.buff ? `<span class="meta"> ${esc(it.buff.textTh)}</span>` : '';
        const have = Inv.count(c, id);
        return `<div class="item"><span class="ic">${itemIcon(id, it.icon)}</span><span>${esc(it.nameTh)}${have ? ` <span class="meta">(มี ${have})</span>` : ''}${job}${bonus}${food}</span>
          <span class="price">฿${(it.price * n).toLocaleString()}</span>
          <button data-buy="${id}" data-n="${n}" ${owned || c.gold < it.price ? 'disabled' : ''}>${owned ? 'มีแล้ว' : n > 1 ? `ซื้อ x${n}` : 'ซื้อ'}</button></div>`;
      }).join('');
    } else {
      const sellable = c.inventory.filter((s) => ITEMS[s.id].type !== 'skin');
      const drops = Inv.bulkSellList(c, 'drop'), fish = Inv.bulkSellList(c, 'fish');
      const sum = (l) => l.reduce((a, s) => a + sellPrice(s.id) * s.qty, 0);
      const bulk = `<div class="bulk-bar">
        <button class="btn ghost sm" data-bulk="drop" ${drops.length ? '' : 'disabled'}>💰 ขายของดรอปทั้งหมด (฿${sum(drops).toLocaleString()})</button>
        <button class="btn ghost sm" data-bulk="fish" ${fish.length ? '' : 'disabled'}>🐟 ขายปลาทั้งหมด (฿${sum(fish).toLocaleString()})</button>
        <span class="meta">🔒 = ล็อกไว้ ไม่ถูกขาย</span></div>`;
      html = qtyBar + bulk + (sellable.length ? sellable.map((s) => {
        const it = ITEMS[s.id], lock = Inv.isLocked(c, s.id), n = Math.min(q, s.qty);
        return `<div class="item ${lock ? 'locked' : ''}"><span class="ic">${itemIcon(s.id, it.icon)}</span><span>${lock ? '🔒 ' : ''}${esc(it.nameTh)} <span class="meta">x${s.qty}</span></span>
          <span class="price">฿${(sellPrice(s.id) * n).toLocaleString()}</span><button data-sell="${s.id}" data-n="${n}" ${lock ? 'disabled' : ''}>${n > 1 ? `ขาย x${n}` : 'ขาย'}</button></div>`;
      }).join('') : '<div class="empty">ไม่มีของให้ขาย</div>');
    }
    $('#shop-list').innerHTML = html;
    const trade = (r) => { this.scene.sfx.play(r.ok ? 'buy' : 'error'); this.result(r); };
    $('#shop-list').querySelectorAll('[data-qty]').forEach((b) => (b.onclick = () => { this.shopQty = +b.dataset.qty; this.scene.sfx.play('click'); this.renderShop(); }));
    $('#shop-list').querySelectorAll('[data-buy]').forEach((b) => (b.onclick = () => trade(Inv.buy(c, b.dataset.buy, +b.dataset.n || 1))));
    $('#shop-list').querySelectorAll('[data-sell]').forEach((b) => (b.onclick = () => trade(Inv.sell(c, b.dataset.sell, +b.dataset.n || 1))));
    $('#shop-list').querySelectorAll('[data-bulk]').forEach((b) => (b.onclick = () => {
      const list = Inv.bulkSellList(c, b.dataset.bulk);
      const total = list.reduce((a, s) => a + sellPrice(s.id) * s.qty, 0), n = list.reduce((a, s) => a + s.qty, 0);
      if (!list.length || !confirm(`ขาย${b.dataset.bulk === 'fish' ? 'ปลา' : 'ของดรอป'} ${list.length} ชนิด (${n} ชิ้น) ได้ ฿${total.toLocaleString()}\n(ของที่ล็อก 🔒 จะไม่ถูกขาย) ยืนยันไหม?`)) return;
      trade(Inv.sellMany(c, list));
    }));
  }
}
