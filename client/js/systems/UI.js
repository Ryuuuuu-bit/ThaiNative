// ============================================================
//  UI – จัดการ HUD และหน้าต่าง DOM (สถานะ, กระเป๋า, ร้านค้า, แชท)
//  ใช้ HTML/CSS ซ้อนบน Canvas เพื่อให้ตัวหนังสือไทยคมชัด
// ============================================================
import { JOBS, JOB_IDS, PATH_LV, STAT_PLAN } from '/shared/data/classes.js';
import { ITEMS, SHOPS, sellPrice, WTYPE_JOB } from '/shared/data/items.js';
import { STAT_KEYS, STAT_INFO, expToNext, MAX_LEVEL } from '/shared/stats.js';
import { getDerived, pathName } from './Character.js';
import * as Inv from './Inventory.js';
import { setInfo, SET_TEXT } from '/shared/data/gear.js';
import { TITLES, TITLE_BY_ID } from '/shared/data/titles.js';
import { DYE_PRICE } from '/shared/economy.js';
import { OUTFITS, HAIRSTYLES } from '/shared/data/appearance.js';
import { SKILLS, SKILL_SLOTS, SKILL_BY_ID, MAX_SKILL_LV, skillStats, canLearn, skillCap, isItemSlot, slotItemId } from '/shared/data/skills.js';
import { hotbarItemOk, passiveFree, classTitle } from '/shared/charmodel.js';
import { PASSIVES, BRANCHES, KEYSTONE, canAllocate, branchPoints, bonusText, totalPassivePoints } from '/shared/data/passives.js';
import { LIFE, LIFE_IDS, lifeLevel, masteryLevel, MASTERY_MAX } from '/shared/data/life.js';
import { passiveResetCost } from '/shared/economy.js';
import { MONSTERS } from '/shared/data/monsters.js';
import { WORLD } from '/shared/constants.js';
import { MAPS, MAP_LIST, REGIONS, mapAt } from '/shared/data/maps.js';

import { saveSettings, toggleFullscreen } from './Settings.js';
import { PORTRAITS } from '../gfx/SpriteFactory.js';
import { modsText } from '/shared/data/blessings.js';
import { ENHANCE } from '/shared/data/village.js';
import { itemIcon, skillIcon, uiIcon } from './util.js';
import { bindAccountSettings } from './AuthScreen.js';
import { account } from '../net/Account.js';
import { CardUI } from './Cards.js';
import { CARD_BY_ID } from '/shared/data/cards.js';
import { ItemTip, impactLine, inlineStats } from './ItemTip.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
import { SLOT_TH, GEAR_TYPES, TYPE_TH, FLASK_SLOTS } from '/shared/data/slots.js';
/** ระดับความหายากของอุปกรณ์ (สี): 1 ธรรมดา · 2 ดี · 3 หายาก · 4 มหากาพย์ · 5 ตำนาน */
const baseRarity = (it) => (!it ? 0 : it.legend ? 5 : GEAR_TYPES.includes(it.type) ? ((it.lv || 1) >= 28 ? 4 : (it.lv || 1) >= 20 ? 3 : (it.lv || 1) >= 10 ? 2 : 1) : it.type === 'costume' && it.rare ? 4 : 0);
/** ความหายาก: ของมีค่าสุ่ม 1 บรรทัด = ฟ้า (3) · 2+ บรรทัด = ม่วง (4) · ตำนาน = ทอง (5) */
export const rarityOf = (it) => Math.max(baseRarity(it), it?.affixN ? (it.affixN >= 2 ? 4 : 3) : 0);
/** บรรทัดค่าสุ่มของไอเทม (สีฟ้า/ม่วงตามจำนวน) */
export const affixHtml = (it) => (it?.affixes?.length ? `<div class="affixes a${Math.min(3, it.affixN)}">${it.affixes.map((a) => `<span>◆ ${a.text}</span>`).join('')}</div>` : '');
const rcls = (it) => { const r = rarityOf(it); return r ? ` r${r}` : ''; };
const rname = (it, name) => { const r = rarityOf(it); return r ? `<span class="rn${r}">${name}</span>` : name; };
/** ป้ายแนวของอาวุธ / สายของชุด */
const itemTag = (it) => (it.lv ? ` · Lv.${it.lv}` : '') + (it.legend ? ' · ✦ตำนาน' : '') + (it.wtype ? ` · แนว${JOBS[WTYPE_JOB[it.wtype]].nameTh}`
  : it.job ? ` · สาย${JOBS[it.job].nameTh}` : it.path ? ` · ชุดสาย${JOBS[it.path].nameTh}` : '');

export class UI {
  /** @param {Phaser.Scene} scene GameScene */
  constructor(scene) {
    this.scene = scene;
    this.shopTab = 'buy';
    this.shopId = null;
    this.hudCache = '';

    this.cards = new CardUI(this);
    this.itemTip = new ItemTip(this, rarityOf);
    this.setupLayoutGuard();
    $('#hud').classList.remove('hidden');
    $('#chat').classList.remove('hidden');

    // ปุ่มเปิด/ปิดหน้าต่าง
    document.querySelectorAll('[data-open]').forEach((b) => (b.onclick = () => (b.dataset.open === 'map-panel' ? this.scene.world.toggleMap() : this.toggle(b.dataset.open))));
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
          if (/^\/r\s+/i.test(text) && this.lastWhisper) scene.net.sendChat(`/w ${this.lastWhisper} ${text.replace(/^\/r\s+/i, '')}`);   // /r = ตอบกระซิบล่าสุด
          else if (/^\/gm\b/i.test(text)) this.gmCommand(text);     // /gm … = คำสั่งแอดมิน
          else if (/^\/p\s+/i.test(text)) {                        // /p ข้อความ = แชทปาร์ตี้
            if (scene.social?.party) scene.social.partyChat(text.replace(/^\/p\s+/i, ''));
            else this.toast('ยังไม่มีปาร์ตี้', 'warn');
          } else if (scene.net.online) scene.net.sendChat(text);
          else this.chat({ name: scene.player.char.name, text }); // ออฟไลน์: แสดงเฉพาะเรา
        }
        input.value = '';
        input.blur();
      } else if (e.key === 'Escape') input.blur();
    });
    // พิมพ์ในช่องกรอกใดก็ได้ → ปิดคีย์บอร์ดเกม + ล้างปุ่มค้าง (ไม่งั้นตัวละครเดินเองหลังพิมพ์เสร็จ)
    const isField = (el) => el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && el.type !== 'checkbox' && el.type !== 'range';
    document.addEventListener('focusin', (e) => { if (isField(e.target)) { scene.input.keyboard.enabled = false; scene.input.keyboard.resetKeys(); } });
    document.addEventListener('focusout', (e) => { if (isField(e.target)) { scene.input.keyboard.resetKeys(); scene.input.keyboard.enabled = true; } });
    $('#chat-toggle').onclick = () => { $('#chat').classList.toggle('collapsed'); input.blur(); };
    input.addEventListener('focus', () => { scene.input.keyboard.enabled = false; $('#chat').classList.remove('collapsed'); });
    input.addEventListener('blur', () => (scene.input.keyboard.enabled = true));
  }

  get char() { return this.scene.player.char; }

  /** คำสั่ง GM (เฉพาะบัญชีใน ADMIN_IDS ของ server): /gm gold 1000000 · /gm lv 30 · /gm item yant_guard 10 · /gm sp 20 · /gm stat 50 · /gm enh weapon 20 · /gm heal */
  gmCommand(text) {
    if (!account.account?.admin && this.scene.econ.server) return this.toast('คำสั่งนี้ใช้ได้เฉพาะแอดมิน', 'warn');
    const [, cmd = 'help', a1, a2] = text.trim().split(/\s+/);
    this.scene.econ.act('gm', { cmd, a1, a2 }).then((r) => {
      if (!r.ok) return this.toast(r.msg, 'warn');
      this.toast(`🛠️ ${r.msg}`); this.chat({ name: 'GM', text: r.msg });
      if (r.ups) this.scene.combat.levelUpFx(r.ups);
      this.result({ ok: true, jobChanged: r.jobChanged, titles: r.titles });
      if (r.ok && !this.scene.econ.server) { const c = this.char, d = getDerived(c); c.hp = Math.min(c.hp, d.maxHp); }
    });
  }
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
    const sig = [c.hp, c.mp, d.maxHp, d.maxMp, c.exp, c.level, c.gold, c.appearance.job, c.path, c.statPoints, c.sp, JSON.stringify(c.skills), (c.passives || []).length, Inv.count(c, 'hp_s'), Inv.count(c, 'mp_s')].join('|');
    if (sig === this.hudCache) return;
    this.hudCache = sig;

    $('#hud-name').textContent = c.name;
    // จุดแดงเตือน: มีแต้มสถานะ / มีสกิลที่อัปได้
    document.querySelector('.hud-buttons [data-open="stats-panel"]')?.classList.toggle('alert', c.statPoints > 0);
    const canSkill = passiveFree(c) > 0 || (c.sp > 0 && Object.values(SKILLS).some((list) => list.some((sk) => canLearn(c, sk.id).ok)));
    document.querySelector('.hud-buttons [data-open="skill-panel"]')?.classList.toggle('alert', canSkill);
    if ($('#hud-lv2').textContent !== String(c.level)) {
      const up = +$('#hud-lv2').textContent > 0 && c.level > +$('#hud-lv2').textContent;
      $('#hud-lv').textContent = c.level; $('#hud-lv2').textContent = c.level;
      if (up) document.querySelectorAll('.lv-tag').forEach((el) => { el.classList.remove('up'); void el.offsetWidth; el.classList.add('up'); });
    }
    $('#hud-job').textContent = `${classTitle(c)} · ${JOBS[c.appearance.job].icon}`;
    $('#hud-job').title = `อาชีพ: ${classTitle(c)} · แนวต่อสู้ตอนนี้: ${JOBS[c.appearance.job].nameTh} (ตามอาวุธที่ถือ)`;
    $('#hud-hp').textContent = `HP ${Math.ceil(c.hp)} / ${d.maxHp}`;
    $('#hud-mp').textContent = `MP ${Math.floor(c.mp)} / ${d.maxMp}`;
    $('#hud-hp-fill').style.width = `${(c.hp / d.maxHp) * 100}%`;
    $('#hud-hp-ghost').style.width = `${(c.hp / d.maxHp) * 100}%`;
    $('#hud-hp-fill').parentElement.classList.toggle('low', c.hp / d.maxHp < 0.3);
    $('#hud-mp-fill').style.width = `${(c.mp / d.maxMp) * 100}%`;
    const maxed = c.level >= MAX_LEVEL;
    $('#hud-exp-fill').style.width = maxed ? '100%' : `${(c.exp / need) * 100}%`;
    $('#hud-exp').textContent = maxed ? `EXP MAX · เลเวลตัน Lv.${MAX_LEVEL}` : `EXP ${c.exp} / ${need}  (${((c.exp / need) * 100).toFixed(1)}%)`;
    $('#hud-gold').textContent = c.gold.toLocaleString();
    const hp = Inv.count(c, 'hp_s') + Inv.count(c, 'hp_m'), mp = Inv.count(c, 'mp_s') + Inv.count(c, 'mp_m');
    const qh = $('#quick-hp'), qm = $('#quick-mp');       // (แถบเก่า – ถ้ามี)
    if (qh) { qh.querySelector('.n').textContent = `x${hp}`; qh.classList.toggle('empty', !hp); }
    if (qm) { qm.querySelector('.n').textContent = `x${mp}`; qm.classList.toggle('empty', !mp); }
    this.updateFlasks(c);
    this.drawPortrait();
  }

  /** ปุ่มขวดยา Q/E บน HUD (อัปเดตเฉพาะตอนค่าเปลี่ยน) */
  updateFlasks(c) {
    const keys = { flask: 'Q', flask2: 'E' };
    for (const slot of FLASK_SLOTS) {
      const b = document.querySelector(`.flask-btn[data-flask="${slot}"]`); if (!b) continue;
      const id = c.equipment?.[slot], f = ITEMS[id]?.flask, ch = c.flaskCh?.[slot] || 0;
      const sig = `${id}|${ch.toFixed(2)}`; if (b._sig === sig) continue; b._sig = sig;
      b.className = `flask-btn ${f ? f.kind : 'none'}${f && ch < 1 ? ' dry' : ''}`;
      b.title = f ? `${ITEMS[id].nameTh} (${keys[slot]}) · ฟื้น ${f.kind.toUpperCase()} ${f.heal} · เหลือ ${Math.floor(ch)}/${f.max} ครั้ง · ฆ่าผีเพื่อเติม / กลับเมืองเติมเต็ม` : `ช่องขวดยา (${keys[slot]}) ว่าง · ซื้อขวดยาที่ร้านยายติ๋ม`;
      b.innerHTML = `<i class="fill" style="height:${f ? Math.min(100, ch / f.max * 100) : 0}%"></i><span class="key">${keys[slot]}</span><span class="ic">${f ? itemIcon(id, ITEMS[id].icon) : '·'}</span>${f ? `<span class="n">${Math.floor(ch)}</span>` : ''}`;
    }
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
      if (mp.safe) this.scene.npcs.forEach((n) => (html += `<i class="mm-dot npc" style="left:${pct(n.x)}" title="${esc(n.nameTh)}"><em>${n.icon || '•'}</em></i>`));
      if (mp.id === 'm1') html += `<i class="mm-dot npc" style="left:${pct(this.scene.forest.npcX)}"><em>📜</em></i>`;
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
    if ($('#quick-hp')) $('#quick-hp .ic').innerHTML = itemIcon('hp_s', '🧴');
    if ($('#quick-mp')) $('#quick-mp .ic').innerHTML = itemIcon('mp_s', '🥥');
    const gold = document.querySelector('.pf .gold');
    if (gold && uiIcon('gold') && !gold.querySelector('.px-ico')) gold.innerHTML = `${uiIcon('gold')} <b id="hud-gold">${$('#hud-gold').textContent}</b>`;
    // ปุ่มเมนูขวาบน: ไอคอนชุดเดียวกัน (PixelLab ui_menu_*)
    const MENU = { 'stats-panel': 'menu_stats', 'inv-panel': 'menu_bag', 'skill-panel': 'menu_skill', 'map-panel': 'menu_map',
      'social-panel': 'menu_party', 'quest-panel': 'menu_quest', 'help-panel': 'menu_help', 'settings-panel': 'menu_settings', 'card-panel': 'menu_card' };
    for (const [panel, key] of Object.entries(MENU)) {
      const b = document.querySelector(`.hud-buttons [data-open="${panel}"]`), ic = uiIcon(key);
      if (b && ic) b.innerHTML = `${ic}${b.querySelector('small')?.outerHTML || ''}`;
    }
    const f = document.querySelector('#fish-ui');
    if (f && uiIcon('fish') && !f.querySelector('.px-ico')) f.insertAdjacentHTML('afterbegin', uiIcon('fish'));
  }

  setZone(name, announce = true) {
    $('#zone-name').textContent = name;
    const mp = this.scene.map, R = REGIONS[mp?.region], mon = mp?.mon ? MONSTERS[mp.mon] : null;
    const sub = mp?.id === 'village' ? 'SAFE ZONE · หมู่บ้านบางผี' : mp?.boss ? 'เรดบอส · พญายักษ์ทมิฬ Lv.30' : mp?.dungeon ? 'ดันเจี้ยนปาร์ตี้' : R ? `ภาค ${R.no} ${R.nameTh}${mon ? ` · ${mon.nameTh} Lv.${mon.level}` : ''}` : '';
    if (announce) this.banner(name, sub);
  }

  banner(text, sub = '') {
    const el = $('#banner');
    $('#banner-text').textContent = text;
    $('#banner-sub').textContent = sub;
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

  // ============================================================
  //  Hotbar 10 ช่อง (ปุ่ม 1–0) – ใส่ได้ทั้งสกิลและไอเทม
  //  ▸ ลากสกิลจากหน้าต่าง K / ลากไอเทมจากกระเป๋า I มาวาง · ลากช่องสลับกันได้ · คลิกขวาเพื่อถอด
  // ============================================================
  hotbarSig() {
    const c = this.char;
    const counts = SKILL_SLOTS.map((k) => (isItemSlot(c.hotbar[k]) ? Inv.count(c, slotItemId(c.hotbar[k])) : 0));
    return JSON.stringify([c.appearance.job, c.hotbar, c.skills, counts, c.equipment]);
  }

  buildSkillBar() {
    const c = this.char;
    this.skillSig = this.hotbarSig();
    $('#skillbar').innerHTML = SKILL_SLOTS.map((key) => {
      const v = c.hotbar[key];
      if (isItemSlot(v)) {
        const id = slotItemId(v), it = ITEMS[id], n = Inv.count(c, id);
        const worn = Object.values(c.equipment || {}).includes(id);
        const verb = { weapon: 'ถือ', armor: 'สวม', accessory: 'สวม', helm: 'สวม', gloves: 'สวม', boots: 'สวม', belt: 'คาด', flask: 'ใส่', home: 'ร่ายยันต์', food: 'กิน' }[it.type] || 'ใช้';
        return `<div class="skill item-slot${n || worn ? '' : ' empty-item'}${worn ? ' worn' : ''}" data-key="${key}" data-item="${id}" draggable="true"><span class="k">${key}</span><button class="hb-x" data-hbx="${key}" title="เอาออกจากช่อง" aria-label="เอาออก">✕</button><span class="ic">${itemIcon(id, it.icon)}</span><span class="n">${worn ? '✔' : n}</span>
          <div class="tip"><b>${esc(it.nameTh)}</b> (${key})<br>กด ${key} = ${verb}${worn ? ' · ใส่อยู่' : ` · เหลือ ${n}`}<br><small>กด ✕ หรือคลิกขวาเพื่อเอาออกจากช่อง</small></div></div>`;
      }
      const id = v, lv = c.skills[id] || 0;
      if (!id || !lv) return `<div class="skill empty" data-key="${key}"><span class="k">${key}</span><span class="ic">＋</span>
        <div class="tip">ช่อง ${key} ว่าง – ลากสกิล (K) หรือไอเทม (I) มาวาง</div></div>`;
      const st = skillStats(SKILL_BY_ID[id], lv);
      const off = SKILL_BY_ID[id].job !== c.appearance.job;
      return `<div class="skill${off ? ' noweapon' : ''}" data-key="${key}" data-id="${id}" draggable="true"><span class="k">${key}</span><button class="hb-x" data-hbx="${key}" title="เอาออกจากช่อง" aria-label="เอาออก">✕</button><span class="ic">${skillIcon(id, st.icon)}</span><span class="mp">${st.mp}</span>
        <div class="cd"></div><div class="cdt"></div>
        <div class="tip"><b>${st.nameTh}</b> Lv.${lv} (${key})<br>MP ${st.mp} · CD ${(st.cd / 1000).toFixed(1)}s${st.mult ? ` · ดาเมจ x${st.mult}` : ''}<br>${st.desc}${off ? `<br><span style="color:#f5b041">ต้องถือ${JOBS[SKILL_BY_ID[id].job].weaponTh}</span>` : ''}</div></div>`;
    }).join('');
    this.skillEls = [...document.querySelectorAll('#skillbar .skill')];
    document.querySelectorAll('#skillbar .hb-x').forEach((b) => {
      const off = (e) => { e.preventDefault(); e.stopPropagation(); };
      b.addEventListener('pointerdown', off); b.addEventListener('mousedown', off);
      b.addEventListener('click', (e) => { off(e); this.assign(b.dataset.hbx, null); });
    });
    this.skillEls.forEach((el) => {
      this.makeDropSlot(el, el.dataset.key);
      el.addEventListener('dragstart', (e) => { const v = this.char.hotbar[el.dataset.key]; if (!v) return e.preventDefault(); e.dataTransfer.setData('text/slot', v); e.dataTransfer.effectAllowed = 'move'; });
    });
  }

  updateSkillBar(time) {
    const c = this.char, p = this.scene.player;
    if (this.skillSig !== this.hotbarSig()) this.buildSkillBar();
    this.skillEls.forEach((el) => {
      const id = el.dataset.id;
      if (!id) return;
      const st = skillStats(SKILL_BY_ID[id], c.skills[id]);
      const left = p.cooldownLeft(id, time);
      el.querySelector('.cd').style.height = left ? `${(left / st.cd) * 100}%` : '0';
      el.querySelector('.cdt').textContent = left ? (left / 1000).toFixed(left < 1000 ? 1 : 0) : '';
      if (el.dataset.cd === '1' && !left) { el.classList.remove('ready'); void el.offsetWidth; el.classList.add('ready'); }
      el.dataset.cd = left ? '1' : '0';
      el.classList.toggle('nomp', c.mp < st.mp);
    });
  }

  /** ทำให้ element เป็นช่องรับการลากวาง (สกิล / ไอเทม / ช่องอื่นของ Hotbar) */
  makeDropSlot(el, key) {
    el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('drop-over'); });
    el.addEventListener('dragleave', () => el.classList.remove('drop-over'));
    el.addEventListener('drop', (e) => {
      e.preventDefault(); el.classList.remove('drop-over');
      const sk = e.dataTransfer.getData('text/skill'), it = e.dataTransfer.getData('text/item'), sl = e.dataTransfer.getData('text/slot');
      if (sk) this.assign(key, sk);
      else if (it) this.assign(key, `it:${it}`);
      else if (sl) this.assign(key, sl);
    });
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); if (this.char.hotbar[key]) this.assign(key, null); });
  }

  /** ใส่ไอเทมลงช่องว่างช่องแรกของ Hotbar (ปุ่มในกระเป๋า – ใช้บนมือถือแทนการลาก) */
  assignFirstFree(itemId) {
    const c = this.char, v = `it:${itemId}`;
    const cur = SKILL_SLOTS.find((k) => c.hotbar[k] === v);
    if (cur) return this.toast(`${ITEMS[itemId].nameTh} อยู่ที่ช่อง ${cur} แล้ว`);
    const free = SKILL_SLOTS.find((k) => !c.hotbar[k]);
    if (!free) return this.toast('Hotbar เต็ม – คลิกขวาที่ช่องเพื่อถอดก่อน', 'warn');
    this.assign(free, v);
  }

  assign(key, id) {
    this.scene.econ.act('hotbar', { key, id }).then((r) => {
      if (!r.ok) return this.toast(r.msg || 'ต้องเรียนสกิลก่อนจึงติดตั้งได้', 'warn');
      this.scene.sfx.play('click');
      const name = !id ? '' : isItemSlot(id) ? ITEMS[slotItemId(id)]?.nameTh : SKILL_BY_ID[id]?.nameTh;
      this.toast(id ? `ใส่ ${name} ที่ช่อง ${key}` : `ถอดออกจากช่อง ${key}`);
      this.refreshPanels(); this.scene.saveSoon();
    });
  }

  // ============================================================
  //  Skill Tree (K)
  // ============================================================
  renderSkillTree() {
    const c = this.char;
    this.skMode ||= 'passive';
    $('#sk-job').textContent = classTitle(c);
    $('#sk-sp').textContent = c.sp;
    $('#sk-pp').textContent = passiveFree(c);
    document.querySelectorAll('#sk-modes [data-mode]').forEach((b) => {
      b.classList.toggle('active', b.dataset.mode === this.skMode);
      b.onclick = () => { this.skMode = b.dataset.mode; this.scene.sfx.play('click'); this.renderSkillTree(); };
    });
    for (const m of ['passive', 'active', 'life']) $(`#sk-${m}`).classList.toggle('hidden', m !== this.skMode);
    if (this.skMode === 'passive') return this.renderPassives();
    if (this.skMode === 'life') return this.renderLife();
    this.renderActives();
  }

  /** ต้นไม้พรสวรรค์ (SVG) */
  renderPassives() {
    const c = this.char, owned = c.passives || ['root'], free = passiveFree(c), U = 30, R = 7.6;
    const bp = branchPoints(owned);
    const P = (n) => [(n.x + R) * U, (n.y + R) * U];
    const done = new Set();
    let lines = '', nodes = '';
    for (const n of Object.values(PASSIVES)) {
      for (const l of n.links) {
        const key = [n.id, l].sort().join('|');
        if (done.has(key)) continue; done.add(key);
        const [x1, y1] = P(n), [x2, y2] = P(PASSIVES[l]);
        const a = owned.includes(n.id), b = owned.includes(l);
        lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="pl ${a && b ? 'on' : a || b ? 'half' : ''}"/>`;
      }
    }
    for (const n of Object.values(PASSIVES)) {
      const [x, y] = P(n), on = owned.includes(n.id), can = !on && free > 0 && canAllocate(owned, n.id);
      const r = { root: 12, key: 15, notable: 11, small: 7 }[n.kind];
      const col = n.branch ? BRANCHES[n.branch].color : '#d4af37';
      const shape = n.kind === 'key' ? `<polygon points="${x},${y - r} ${x + r},${y} ${x},${y + r} ${x - r},${y}"` : `<circle cx="${x}" cy="${y}" r="${r}"`;
      nodes += `<g class="pn ${n.kind} ${on ? 'on' : ''} ${can ? 'can' : ''}" data-id="${n.id}" style="--c:${col}">${shape} class="pn-shape"/>${n.kind === 'root' ? `<text x="${x}" y="${y + 4}" class="pn-t">🏠</text>` : ''}</g>`;
    }
    const labels = Object.entries(BRANCHES).map(([j, b]) => {
      const [x, y] = [(b.dir[0] * 8.1 + R) * U, (b.dir[1] * 8.1 + R) * U + 4];
      return `<text x="${x}" y="${y}" class="pb-t" style="fill:${b.color}">${JOBS[j].icon} ${JOBS[j].weaponTh} · ${bp[j]}</text>`;
    }).join('');
    const W = R * 2 * U;
    $('#sk-passive-svg').innerHTML = `<svg viewBox="-20 -20 ${W + 40} ${W + 40}" class="ptree">${lines}${nodes}${labels}</svg>`;
    const info = $('#sk-passive-info');
    const show = (id) => {
      const n = PASSIVES[id], on = owned.includes(id), can = !on && canAllocate(owned, id);
      const kind = { root: 'จุดเริ่มต้น', key: '🌟 คีย์สโตน (ฉายาประจำสาย · ปลดท่าไม้ตาย ★)', notable: '✦ จุดสำคัญ', small: 'จุดเล็ก' }[n.kind];
      info.innerHTML = `<b style="color:${n.branch ? BRANCHES[n.branch].color : 'var(--gold-soft)'}">${n.nameTh}</b><small>${kind}${n.branch ? ` · ${BRANCHES[n.branch].nameTh}` : ''}</small>
        <p>${bonusText(n.bonus) || 'จุดศูนย์กลาง — เริ่มลงแต้มจากตรงนี้'}</p>
        <em>${on ? '✔ ลงแล้ว' : can ? (free ? 'คลิกเพื่อลงแต้ม' : 'แต้มพรสวรรค์หมด') : 'ต้องลงจุดที่ติดกันก่อน'}</em>`;
    };
    const summary = () => {
      const tot = {};
      for (const id of owned) for (const [k, v] of Object.entries(PASSIVES[id].bonus)) tot[k] = (tot[k] || 0) + v;
      const ms = JOB_IDS.map((j) => { const m = masteryLevel(c.wm?.[j] || 0); const pct = m.need ? Math.round(m.cur / m.need * 100) : 100;
        return `<div class="ms-row ${c.appearance.job === j ? 'cur' : ''}"><span>${JOBS[j].icon} ${JOBS[j].weaponTh}</span><div class="ms-bar"><i style="width:${pct}%"></i></div><b>Lv.${m.lv}</b></div>`; }).join('');
      info.innerHTML = `<b>${classTitle(c)}</b><small>อาชีพมาจาก: แต้มในกิ่ง × 3 + ความชำนาญอาวุธ (ถึง 9 คะแนนจึงได้ฉายา)</small>
        <p>${bonusText(tot) || 'ยังไม่ได้ลงแต้ม — คลิกจุดที่ติดกับ 🏠 ตรงกลาง'}</p>
        <div class="ms"><small>ความชำนาญอาวุธ (ฆ่าผีด้วยอาวุธนั้น · โจมตี +1%/Lv)</small>${ms}</div>`;
    };
    summary();
    $('#sk-passive-svg').querySelectorAll('.pn').forEach((g) => {
      g.onmouseenter = () => show(g.dataset.id);
      g.onmouseleave = summary;
      g.onclick = () => {
        if (!g.classList.contains('can')) { show(g.dataset.id); return; }
        this.scene.econ.act('passive', { id: g.dataset.id }).then((r) => {
          this.scene.sfx.play(r.ok ? (PASSIVES[g.dataset.id].kind === 'key' ? 'levelup' : 'buff') : 'error');
          this.toast(r.msg, r.ok ? '' : 'warn');
          if (r.ok && r.jobChanged) this.scene.onJobChanged?.();
          this.refreshPanels(); this.scene.saveSoon();
        });
      };
    });
    const cost = passiveResetCost(c);
    $('#sk-passive-foot').innerHTML = `<span>แต้มพรสวรรค์ <b>${free}</b> / ${totalPassivePoints(c.level)} (ได้ 1 แต้มต่อเลเวล)</span>
      <button class="btn ghost sm" id="sk-preset" ${owned.length > 1 ? '' : 'disabled'}>↺ ล้างต้นไม้ ${cost ? `(฿${cost})` : '(ฟรีก่อน Lv.10)'}</button>`;
    $('#sk-preset').onclick = () => {
      if (!confirm(`ล้างต้นไม้พรสวรรค์ทั้งหมด${cost ? ` เสียเงิน ฿${cost}` : ''}? (สกิลที่เลเวลเกินเพดานจะคืน SP)`)) return;
      this.scene.econ.act('passiveReset').then((r) => { this.toast(r.msg, r.ok ? '' : 'warn'); this.scene.sfx.play(r.ok ? 'blessing' : 'error'); if (r.ok) this.scene.onJobChanged?.(); this.refreshPanels(); });
    };
  }

  /** ทักษะชีวิต */
  renderLife() {
    const c = this.char;
    $('#sk-life').innerHTML = LIFE_IDS.map((k) => {
      const L = LIFE[k], m = lifeLevel(c.life?.[k] || 0), pct = m.need ? Math.round(m.cur / m.need * 100) : 100;
      return `<div class="life-card"><div class="life-ic">${L.icon}</div><div class="life-main">
        <div class="life-h"><b>${L.nameTh}</b><span class="lv-tag">Lv.${m.lv}</span></div>
        <div class="bar exp"><i style="width:${pct}%"></i><span>${m.need ? `${m.cur} / ${m.need}` : 'MAX'}</span></div>
        <small>🎁 ${L.perk(m.lv)}</small><small>📍 ${L.how}</small></div></div>`;
    }).join('') + '<p class="hint">ทักษะชีวิตขึ้นเลเวลจากการทำจริง ไม่ใช้แต้มสกิล · เลเวลสูงสุด 20</p>';
  }

  /** สกิลอาวุธ (Active) */
  renderActives() {
    const c = this.char;
    if (!this.skTab) this.skTab = c.appearance.job;
    const job = this.skTab;
    const bp = branchPoints(c.passives || []);
    let tabs = $('#sk-tabs');
    tabs.innerHTML = JOB_IDS.map((j) => {
      const learned = SKILLS[j].reduce((a, sk) => a + (c.skills[sk.id] || 0), 0);
      return `<button data-sktab="${j}" class="${j === job ? 'active' : ''} ${c.appearance.job === j ? 'main' : ''}">${JOBS[j].icon} ${JOBS[j].weaponTh}${learned ? ` <small>${learned}</small>` : ''}</button>`;
    }).join('') + `<span class="sk-note">เพดานเลเวลสกิล = 2 + (แต้ม${BRANCHES[job].nameTh} ${bp[job]} ÷ 2) · ★ ต้องมีคีย์สโตน · ใช้ได้เมื่อถือ${JOBS[job].weaponTh}${c.appearance.job === job ? ' ✔' : ''}</span>`;
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

    const learn = (id, max) => this.scene.econ.act('learn', { id, max }).then((r) => {
      this.scene.sfx.play(r.ok ? 'buff' : 'error');
      this.toast(r.msg, r.ok ? '' : 'warn');
      this.refreshPanels(); this.scene.saveSoon();
    });
    $('#sk-tree').querySelectorAll('[data-learn]').forEach((b) => (b.onclick = () => learn(b.dataset.learn, false)));
    $('#sk-tree').querySelectorAll('[data-learnmax]').forEach((b) => (b.onclick = () => learn(b.dataset.learnmax, true)));
    $('#sk-tree').querySelectorAll('[data-as]').forEach((b) => (b.onclick = () => this.assign(b.dataset.as, b.dataset.id)));
    $('#sk-tree').querySelectorAll('.sk-icon[draggable="true"]').forEach((ic) => {
      ic.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/skill', ic.dataset.id); e.dataTransfer.effectAllowed = 'copy'; });
    });

    // Hotbar ในหน้าต่างสกิล (ช่องรับวาง)
    $('#sk-hotbar').innerHTML = SKILL_SLOTS.map((k) => {
      const id = c.hotbar[k], ic = !id ? '' : isItemSlot(id) ? itemIcon(slotItemId(id), ITEMS[slotItemId(id)].icon) : skillIcon(id, SKILL_BY_ID[id].icon);
      return `<div class="hb-slot ${id ? 'filled' : ''}" data-key="${k}" title="คลิกขวาเพื่อถอด"><span class="k">${k}</span>${ic}</div>`;
    }).join('');
    $('#sk-hotbar').querySelectorAll('.hb-slot').forEach((el) => this.makeDropSlot(el, el.dataset.key));
  }

  // ============================================================
  //  แผนที่โลก (M)
  // ============================================================
  renderMap() { this.updateMap(); }

  /** แผนที่โลก: การ์ด 5 ภาค × 4 แมพ + หมู่บ้าน + ลานบอส (ไฮไลต์แมพปัจจุบัน / จำนวนเพื่อนในแต่ละแมพ) */
  updateMap() {
    if (this.scene.worldMap) return;                          // โลกอยุธยา: แผนที่ใหม่ (TdWorldMap) วาดเอง
    const s = this.scene, cur = s.map?.id, lv = s.player.char.level;
    const friends = {};
    s.remotes.forEach((r) => { const id = mapAt(r.x).id; friends[id] = (friends[id] || 0) + 1; });
    const chip = (m) => {
      const mon = m.mon ? MONSTERS[m.mon] : null, lock = lv < (m.minLv || 1), rb = m.rboss && s.social?.rbossAlive?.[m.id];
      const sub = m.id === 'village' ? 'Safe Zone · NPC · ตกปลา' : m.boss ? 'เรดบอส Lv.30' : `${mon.nameTh} Lv.${mon.level}${mon.nightBoost ? ' 🌙' : ''}${rb ? ' · 👑 บอสภาคอยู่!' : m.rboss ? ' · 👑' : ''}`;
      return `<div class="wm-map ${m.id === cur ? 'cur' : ''} ${lock ? 'lock' : ''} ${m.boss ? 'boss' : ''} ${rb ? 'rboss' : ''}">
        <b>${m.no && !m.boss ? m.no + '. ' : ''}${esc(m.nameTh)}</b><span>${esc(sub)}${lock ? ` · 🔒Lv.${m.minLv}` : ''}</span>
        ${m.id === cur ? '<i class="wm-me">📍 คุณอยู่ที่นี่</i>' : ''}${friends[m.id] ? `<i class="wm-fr">👥 ${friends[m.id]}</i>` : ''}</div>`;
    };
    const html = `<div class="wm-region village"><h4>🏘️ หมู่บ้าน</h4><div class="wm-maps">${chip(MAPS.village)}</div></div>`
      + Object.values(REGIONS).map((R) => `<div class="wm-region ${R.id}"><h4>ภาค ${R.no} · ${esc(R.nameTh)}</h4><div class="wm-maps">${MAP_LIST.filter((m) => m.region === R.id && !m.noTravel).map(chip).join('')}</div></div>`).join('');
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
      $('#set-shake').checked = st.fxShake !== false; $('#set-flash').value = st.fxFlash || 'full';
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
    $('#set-shake').onchange = (e) => { st.fxShake = e.target.checked; apply(); };
    $('#set-flash').onchange = (e) => { st.fxFlash = e.target.value; apply(); };
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
  loot(text, rar = 0) {
    const box = $('#loot-log');
    if (!box) return;
    const el = document.createElement('div');
    el.textContent = text;
    if (rar) el.className = `lr${rar}`;
    box.appendChild(el);
    while (box.children.length > 6) box.firstChild.remove();
    setTimeout(() => el.classList.add('fade'), 5000);
    setTimeout(() => el.remove(), 6000);
  }

  toast(msg, kind = '', ms = 2400) {
    const el = document.createElement('div');
    if (!kind) kind = /^(✔|🏆|🎖|🔨 ตีบวกสำเร็จ)/.test(msg) ? 'ok' : /^(🎁|✨|ได้รับ|🎣 ได้)/.test(msg) ? 'loot' : /^(รับเควส|📜|👑)/.test(msg) ? 'quest' : '';
    el.className = `toast ${kind}`;
    el.textContent = msg;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), ms);
  }

  chat({ name, text, party, whisper, from }) {
    const log = $('#chat-log');
    const el = document.createElement('div');
    if (party) el.className = 'party-msg';
    if (whisper) { el.className = 'whisper-msg'; if (from) this.lastWhisper = from; }
    el.innerHTML = `<b>${esc(name)}:</b> ${esc(text)}`;
    log.appendChild(el);
    while (log.children.length > 8) log.firstChild.remove();
  }

  /** ผลลัพธ์จาก Inventory → แจ้งเตือน + รีเฟรช */
  result(r) {
    if (r?.then) return r.then((x) => this.result(x));            // รับ Promise จาก econ.act ได้
    if (!r) return;
    if (r.home) { this.closeAll(); return this.scene.recall(); }
    if (r.msg) this.toast(r.msg, r.ok ? '' : 'warn');
    if (r.jobChanged) this.scene.onAppearanceChanged();
    if (r.titles?.length) this.scene.social?.onNewTitles(r.titles);
    if (r.ups) this.scene.combat.levelUpFx(r.ups);
    if (r.ok && (r.potion || r.ate) && this.scene.vfx?.potion) {           // เอฟเฟกต์ดื่มยา/กินอาหาร
      const pl = this.scene.player; this.scene.vfx.potion(pl, r.kind, false);
      if (r.healed > 0 && this.scene.popHeal) this.scene.popHeal(pl, `+${r.healed}`, 'hp');
      else if (r.kind === 'mp' && r.amt && this.scene.popHeal) this.scene.popHeal(pl, `+${r.amt} MP`, 'mp');
    }
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
    if (!$('#card-panel').classList.contains('hidden')) this.cards.render();
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
        const add = { ...D };
        this.statDraft = {};
        this.scene.sfx.play('buff');
        return this.result(this.scene.econ.act('alloc', { add }));
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
      + `<div class="path-line"><span>อาชีพ (พรสวรรค์ + อาวุธ)</span><b>${classTitle(c)} · แต้มพรสวรรค์เหลือ ${passiveFree(c)} (K)</b></div>`
      + `<div class="path-line"><span>แนวต่อสู้ (ตามอาวุธ)</span><b>${JOBS[c.appearance.job].icon} ${JOBS[c.appearance.job].nameTh}</b></div>`;
  }

  /** กันทับ: ชิ้น HUD ใดที่อยู่ใต้หน้าต่างที่เปิด → ซ่อนชั่วคราว (หน้าต่างอยู่ช่วงกลาง ไม่บังแถบสกิล) */
  setupLayoutGuard() {
    if (this._guard) return;
    const HUD = '.pf, #party-frames, #target, #boss-bar, #dg-bar, #boss-warn, #banner, #prompt, .hud-right, #td-minimap, #td-zone, #quest-track, #loot-log, #chat, #hud > .hud-buttons, #td-act, #dock-toggle, .t-stick, .t-atk, .t-fs';
    const run = () => {
      const wins = [...document.querySelectorAll('#ui .window:not(.hidden)')];
      document.body.classList.toggle('win-open', wins.length > 0);
      const rs = wins.map((w) => w.getBoundingClientRect());
      for (const el of document.querySelectorAll(HUD)) {
        const r = el.getBoundingClientRect();
        const under = r.width > 0 && rs.some((w) => r.left < w.right - 1 && r.right > w.left + 1 && r.top < w.bottom - 1 && r.bottom > w.top + 1);
        el.classList.toggle('hud-under', under);
      }
    };
    this._guard = run;
    const mo = new MutationObserver(() => requestAnimationFrame(run));
    document.querySelectorAll('#ui .window').forEach((w) => mo.observe(w, { attributes: true, attributeFilter: ['class'] }));
    window.addEventListener('resize', () => requestAnimationFrame(run));
    setInterval(run, 700);        // ชิ้น HUD ที่โผล่ขึ้นมาใหม่ระหว่างเปิดหน้าต่าง (บอส/เตือน)
    run();
  }

  // ---------------- กระเป๋า ----------------
  renderInventory() {
    const c = this.char;
    const EMPTY_IC = { weapon: '⚔️', helm: '⛑️', armor: '🥋', gloves: '🧤', boots: '👢', belt: '🎗️', accessory: '💍', accessory2: '📿', flask: '🧪', flask2: '🧪' };
    const cell = (slot) => {
      const id = c.equipment[slot], it = id && ITEMS[id];
      if (!it) return `<div class="eqs eqs-${slot} empty" title="${SLOT_TH[slot]} (ว่าง)"><span class="ph">${EMPTY_IC[slot]}</span><small>${SLOT_TH[slot]}</small></div>`;
      const enh = c.enhance?.[slot], cards = (c.cards?.[slot] || []).filter((x) => CARD_BY_ID[x]);
      const ch = FLASK_SLOTS.includes(slot) && it.flask ? `<span class="fl-ch">${Math.floor(c.flaskCh?.[slot] || 0)}/${it.flask.max}</span>` : '';
      return `<div class="eqs eqs-${slot}${rcls(it)}" data-tip-item="${id}" data-tip-slot="${slot}" data-unequip="${slot}">
        <span class="ico">${itemIcon(id, it.icon)}</span>${enh ? `<b class="enh t${ENHANCE.auraTier(enh)}">+${enh}</b>` : ''}${ch}
        ${cards.length ? `<span class="eqs-cards">${cards.map((x) => `<i title="${esc(CARD_BY_ID[x].nameTh)}"></i>`).join('')}</span>` : ''}
        <small>${esc(it.nameTh)}</small></div>`;
    };
    $('#inv-equip').innerHTML = `<div class="eq-grid">${['weapon', 'helm', 'accessory', 'armor', 'accessory2', 'gloves', 'boots', 'flask', 'belt', 'flask2'].map(cell).join('')}</div>`;
    const COS_TH = { head: 'หมวก/มงกุฎ', face: 'หน้ากาก', back: 'ของหลัง', outfit: 'ชุดแต่งตัว' };
    $('#inv-equip').innerHTML += `<div class="eq-cos">${Object.entries(COS_TH).map(([slot, th]) => { const id = c.costume?.[slot];
      return `<div class="eq cos"><small>${th}</small>${id ? `${itemIcon(id, ITEMS[id].icon)} ${ITEMS[id].nameTh} <button class="close" data-uncos="${slot}">✕</button>` : '—'}</div>`; }).join('')}</div>`;
    // โบนัสชุดประจำสาย
    const si = setInfo(c.equipment);
    const fmt = (b) => inlineStats(b);
    $('#inv-equip').innerHTML += si
      ? `<div class="set-box"><b>✦ ${esc(si.nameTh)}</b> <span class="meta">${si.n} ชิ้น · ระดับ Lv.${si.lv}</span>
          ${si.tiers.map((t) => `<div class="${t.on ? 'on' : ''}">${t.on ? '✔' : '○'} ${SET_TEXT[t.n]}: ${fmt(t.bonus)}</div>`).join('')}</div>`
      : '<div class="set-box off"><span class="meta">✦ โบนัสชุด: สวมอุปกรณ์สายเดียวกัน 2/3/4/6 ชิ้น (ซื้อจากครูประจำสาย) จะได้โบนัสเพิ่ม · ยิ่งเลเวลของสูงยิ่งแรง</span></div>';
    $('#inv-equip').querySelectorAll('[data-unequip]').forEach((b) => (b.onclick = () => this.result(this.scene.econ.act('unequip', { slot: b.dataset.unequip }))));
    $('#inv-equip').querySelectorAll('[data-uncos]').forEach((b) => (b.onclick = () => this.result(this.scene.econ.act('cosOff', { slot: b.dataset.uncos }))));

    if (!c.inventory.length) { $('#inv-list').innerHTML = '<div class="empty">กระเป๋าว่างเปล่า</div>'; return; }
    // แท็บกรอง + เรียงลำดับ
    const CAT = { all: ['ทั้งหมด', () => true], gear: ['อุปกรณ์', (t) => GEAR_TYPES.includes(t) || t === 'flask'], cos: ['ชุดแต่งตัว', (t) => t === 'costume'],
      use: ['ยา/อาหาร', (t) => ['consumable', 'home', 'food', 'reset', 'skin', 'offering'].includes(t)],
      mat: ['วัตถุดิบ', (t) => ['material', 'herb', 'fish'].includes(t)], card: ['การ์ด', (t) => t === 'card'] };
    const ORDER = ['card', 'weapon', 'helm', 'armor', 'gloves', 'boots', 'belt', 'accessory', 'flask', 'costume', 'home', 'consumable', 'food', 'reset', 'skin', 'offering', 'herb', 'fish', 'material'];
    const cat = this.invCat || 'all', sort = this.invSort || 'type';
    const list = c.inventory.filter((s) => CAT[cat][1](ITEMS[s.id].type)).sort((a, b) => {
      const A = ITEMS[a.id], B = ITEMS[b.id];
      if (sort === 'name') return A.nameTh.localeCompare(B.nameTh, 'th');
      if (sort === 'price') return sellPrice(b.id) * b.qty - sellPrice(a.id) * a.qty;
      return ORDER.indexOf(A.type) - ORDER.indexOf(B.type) || A.nameTh.localeCompare(B.nameTh, 'th');
    });
    const tabs = `<div class="inv-tools"><div class="inv-tabs">${Object.entries(CAT).map(([k, [l]]) => `<button data-cat="${k}" class="${k === cat ? 'active' : ''}">${l}</button>`).join('')}</div>
      <select id="inv-sort"><option value="type">เรียง: ประเภท</option><option value="name">เรียง: ชื่อ</option><option value="price">เรียง: มูลค่า</option></select></div>`;
    $('#inv-list').innerHTML = tabs + (list.length ? list.map((s) => {
      const it = ITEMS[s.id], lock = Inv.isLocked(c, s.id);
      const action = { home: 'ใช้', consumable: 'ใช้', food: 'กิน', offering: 'ถวาย', weapon: 'ถือ', armor: 'สวม', helm: 'สวม', gloves: 'สวม', boots: 'สวม', belt: 'คาด', accessory: 'สวม', flask: 'ใส่', costume: 'แต่ง', reset: 'ใช้', card: 'ใส่', skin: c.path === it.job ? 'ใช้อยู่' : 'เปลี่ยนสาย' }[it.type];
      const job = itemTag(it) || (it.type === 'costume' ? ` · ชุดแต่งตัว${it.rare ? ' ✨หายาก' : ''}` : '');
      const hb = hotbarItemOk(s.id);
      return `<div class="item inv${rcls(it)}" data-tip-item="${s.id}"${hb ? ` draggable="true" data-hbitem="${s.id}" title="ลากไปวางที่ Hotbar (1–0)"` : ''}><span class="ic">${itemIcon(s.id, it.icon)}</span>
        <span>${rname(it, esc(it.nameTh))} <span class="meta">x${s.qty}${job}</span>${impactLine(c, s.id)}</span>
        <button class="lock ${lock ? 'on' : ''}" data-lock="${s.id}" title="${lock ? 'ปลดล็อก' : 'ล็อก (กันขาย)'}">${lock ? '🔒' : '🔓'}</button>
        <span class="price">฿${sellPrice(s.id)}</span>
        <span class="inv-acts">${hb ? `<button class="hb-add" data-hbadd="${s.id}" title="ใส่ Hotbar ช่องว่างแรก">⌨</button>` : ''}${action ? `<button data-use="${s.id}" ${action === 'ใช้อยู่' ? 'disabled' : ''}>${action}</button>` : ''}</span></div>`;
    }).join('') : '<div class="empty">ไม่มีของในหมวดนี้</div>');
    $('#inv-sort').value = sort;
    $('#inv-sort').onchange = (e) => { this.invSort = e.target.value; this.renderInventory(); };
    $('#inv-list').querySelectorAll('[data-cat]').forEach((b) => (b.onclick = () => { this.invCat = b.dataset.cat; this.scene.sfx.play('click'); this.renderInventory(); }));
    $('#inv-list').querySelectorAll('[data-lock]').forEach((b) => (b.onclick = () => {
      this.scene.econ.act('lock', { id: b.dataset.lock }).then((r) => {
        this.toast(r.locked ? `🔒 ล็อก ${ITEMS[b.dataset.lock].nameTh} (จะไม่ถูกขาย)` : `🔓 ปลดล็อก ${ITEMS[b.dataset.lock].nameTh}`);
        this.scene.sfx.play('click'); this.renderInventory(); this.scene.saveSoon();
      });
    }));
    $('#inv-list').querySelectorAll('[data-use]').forEach((b) => (b.onclick = () => (CARD_BY_ID[b.dataset.use] ? this.cards.open('sockets', b.dataset.use) : this.result(this.scene.econ.act('use', { id: b.dataset.use })))));
    $('#inv-list').querySelectorAll('[data-hbadd]').forEach((b) => (b.onclick = () => this.assignFirstFree(b.dataset.hbadd)));
    $('#inv-list').querySelectorAll('[data-hbitem]').forEach((el) => el.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/item', el.dataset.hbitem); e.dataTransfer.effectAllowed = 'copy'; }));
  }

  // ---------------- ร้านค้า NPC ----------------
  openShop(shopId) {
    this.shopId = shopId;
    const shop = SHOPS[shopId];
    $('#shop-title').textContent = shop.nameTh;
    $('#shop-greet').textContent = `“${shop.greeting}”`;
    const TAB_TH = { buy: 'ซื้อ', sell: 'ขาย', enhance: `${uiIcon('anvil', '🔨')} ตีบวก`, cook: `${uiIcon('soup', '🍳')} ทำอาหาร`, brew: `${uiIcon('herb', '🌿')} ปรุงยา`, forge: '⚒️ หลอมอุปกรณ์', dye: '🎨 ย้อมสี', cards: '🃏 แลกการ์ด' };
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
    if (this.shopTab === 'cards') return this.cards.renderTrade($('#shop-list'));
    if (this.shopTab === 'cook') return this.scene.village.renderCook($('#shop-list'));
    if (this.shopTab === 'brew') return this.scene.village.renderBrew($('#shop-list'));
    if (this.shopTab === 'forge') return this.scene.village.renderForge($('#shop-list'));
    if (this.shopTab === 'dye') return this.renderDye($('#shop-list'));
    // เลือกจำนวน: x1 / x5 / x10 / สูงสุด (ใช้ทั้งซื้อและขาย)
    const QTY = [[1, 'x1'], [5, 'x5'], [10, 'x10'], [9999, 'สูงสุด']];
    const q = this.shopQty || 1;
    const custom = !QTY.some(([n]) => n === q);
    const qtyBar = `<div class="qty-bar"><span>จำนวน:</span>${QTY.map(([n, l]) => `<button data-qty="${n}" class="${q === n ? 'active' : ''}">${l}</button>`).join('')}
      <label class="qty-custom ${custom ? 'active' : ''}">ระบุ <input type="number" id="shop-qty-in" min="1" max="9999" value="${custom ? q : ''}" placeholder="เช่น 25" /></label></div>`;
    if (this.shopTab === 'buy') {
      // ร้านครูอาชีพ: กรองตามประเภท
      const GF = { all: 'ทั้งหมด', weapon: 'อาวุธ', armor: 'ชุดเกราะ', accessory: 'เครื่องประดับ', ok: 'สวมได้ตอนนี้' };
      const gf = shop.job ? (this.gearFilter || 'all') : 'all';
      const filterBar = shop.job ? `<div class="qty-bar gear-filter"><span>แสดง:</span>${Object.entries(GF).map(([k, l]) => `<button data-gf="${k}" class="${k === gf ? 'active' : ''}">${l}</button>`).join('')}</div>` : '';
      const stock = shop.stock.filter((id) => gf === 'all' || (gf === 'ok' ? (ITEMS[id].lv || 1) <= c.level : ITEMS[id].type === gf));
      html = (shop.job ? filterBar : qtyBar) + stock.map((id) => {
        const it = ITEMS[id];
        const under = it.lv && c.level < it.lv;
        const owned = it.type === 'skin' && Inv.count(c, id);
        const n = it.type === 'skin' ? 1 : Math.max(1, Math.min(q, Math.floor(c.gold / it.price)));
        const job = itemTag(it) ? `<span class="meta">${itemTag(it)}</span>` : it.desc ? `<span class="meta"> · ${esc(it.desc)}</span>` : '';
        const bonus = it.bonus ? `<div class="meta stl">${inlineStats(it.bonus)}</div>` : '';
        const food = it.buff ? `<span class="meta"> ${esc(it.buff.textTh)}</span>` : '';
        const have = Inv.count(c, id);
        const prev = ['costume', 'armor', 'weapon'].includes(it.type) ? `<button class="prev-btn" data-prev="${id}" title="ลองใส่ดูก่อนซื้อ">👁</button>` : '';
        return `<div class="item ${under ? 'under' : ''}${rcls(it)}" data-tip-item="${id}"><span class="ic">${itemIcon(id, it.icon)}</span><span>${rname(it, esc(it.nameTh))}${have ? ` <span class="meta">(มี ${have})</span>` : ''}${job}${bonus}${food}${under ? ' <span class="need-lv">🔒 ต้อง Lv.' + it.lv + '</span>' : ''}</span>
          <span class="price">${prev}฿${(it.price * n).toLocaleString()}</span>
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
        return `<div class="item ${lock ? 'locked' : ''}" data-tip-item="${s.id}"><span class="ic">${itemIcon(s.id, it.icon)}</span><span>${lock ? '🔒 ' : ''}${esc(it.nameTh)} <span class="meta">x${s.qty}</span></span>
          <span class="price">฿${(sellPrice(s.id) * n).toLocaleString()}</span><button data-sell="${s.id}" data-n="${n}" ${lock ? 'disabled' : ''}>${n > 1 ? `ขาย x${n}` : 'ขาย'}</button></div>`;
      }).join('') : '<div class="empty">ไม่มีของให้ขาย</div>');
    }
    $('#shop-list').innerHTML = html;
    const trade = (r) => { this.scene.sfx.play(r.ok ? 'buy' : 'error'); this.result(r); };
    $('#shop-list').querySelectorAll('[data-gf]').forEach((b) => (b.onclick = () => { this.gearFilter = b.dataset.gf; this.scene.sfx.play('click'); this.renderShop(); }));
    $('#shop-list').querySelectorAll('[data-qty]').forEach((b) => (b.onclick = () => { this.shopQty = +b.dataset.qty; this.scene.sfx.play('click'); this.renderShop(); }));
    const qin = $('#shop-qty-in');
    if (qin) {
      // พิมพ์จำนวนเอง → อัปเดตราคา/ปุ่มทันที (ไม่ต้องกด Enter) แต่ไม่ให้ช่องหลุดโฟกัส
      qin.addEventListener('keydown', (e) => e.stopPropagation());
      qin.addEventListener('input', () => {
        const v = Math.max(1, Math.min(9999, Math.floor(+qin.value || 0)));
        if (!qin.value) return;
        this.shopQty = v;
        const pos = qin.selectionStart;
        this.renderShop();
        const q2 = $('#shop-qty-in'); q2.focus(); try { q2.setSelectionRange(pos, pos); } catch { /* number input */ }
      });
      qin.addEventListener('focus', () => (this.scene.input.keyboard.enabled = false));
      qin.addEventListener('blur', () => (this.scene.input.keyboard.enabled = true));
    }
    const E = this.scene.econ, shopId = this.shopId;
    $('#shop-list').querySelectorAll('[data-buy]').forEach((b) => (b.onclick = () => E.act('buy', { shop: shopId, id: b.dataset.buy, qty: +b.dataset.n || 1 }).then(trade)));
    $('#shop-list').querySelectorAll('[data-sell]').forEach((b) => (b.onclick = () => E.act('sell', { id: b.dataset.sell, qty: +b.dataset.n || 1 }).then(trade)));
    $('#shop-list').querySelectorAll('[data-prev]').forEach((b) => (b.onclick = () => this.preview(b.dataset.prev)));
    $('#shop-list').querySelectorAll('[data-bulk]').forEach((b) => (b.onclick = () => {
      const list = Inv.bulkSellList(c, b.dataset.bulk);
      const total = list.reduce((a, s) => a + sellPrice(s.id) * s.qty, 0), n = list.reduce((a, s) => a + s.qty, 0);
      if (!list.length || !confirm(`ขาย${b.dataset.bulk === 'fish' ? 'ปลา' : 'ของดรอป'} ${list.length} ชนิด (${n} ชิ้น) ได้ ฿${total.toLocaleString()}\n(ของที่ล็อก 🔒 จะไม่ถูกขาย) ยืนยันไหม?`)) return;
      E.act('sellMany', { kind: b.dataset.bulk }).then(trade);
    }));
  }

  /** ลองชุด/อาวุธก่อนซื้อ: สวมทับตัวละคร 6 วิ (แค่ภาพ ไม่มีผลค่าพลัง) */
  preview(id) {
    const s = this.scene, p = s.player, it = ITEMS[id];
    if (!it) return;
    const a = { ...p.char.appearance, costume: { ...(p.char.appearance.costume || {}) } };
    if (it.type === 'costume') a.costume[it.slot] = id;
    else if (it.type === 'armor') a.armor = id;
    else if (it.type === 'weapon') a.weapon = id;
    p.previewAppearance(a);
    this.toast(`👁 ลองใส่ ${it.nameTh} (ดูตัวละคร 6 วิ)`);
    s.sfx.play('click');
  }

  /** ร้านแม่ช้อย: ย้อมสีผม */
  renderDye(el) {
    const c = this.char, a = c.appearance;
    const row = (part, list, th) => `<div class="dye-row"><b>${th}</b> <span class="meta">ตอนนี้: ${esc(list[a[part]]?.nameTh || '')}</span><div class="dye-opts">${list.map((o, i) => `<button data-dye="${part}" data-v="${i}" class="${a[part] === i ? 'active' : ''}" title="${esc(o.nameTh)}">${i + 1}</button>`).join('')}</div></div>`;
    el.innerHTML = `<p class="hint">ย้อมสีผม ครั้งละ ฿${DYE_PRICE} · ชุดตัวละครกำหนดตามเพศ (อยากแต่งตัวใช้ชุดแต่งตัวจากแท็บร้าน)</p>` + row('hair', HAIRSTYLES, '💇 สีผม');
    el.querySelectorAll('[data-dye]').forEach((b) => {
      b.onmouseenter = () => this.scene.player.previewAppearance({ ...a, [b.dataset.dye]: +b.dataset.v }, 1500);
      b.onclick = () => {
        if (!confirm(`ย้อม${b.dataset.dye === 'hair' ? 'ผม' : 'ชุด'}เป็นแบบที่ ${+b.dataset.v + 1} (฿${DYE_PRICE})?`)) return;
        this.scene.econ.act('dye', { part: b.dataset.dye, v: +b.dataset.v }).then((r) => { this.scene.sfx.play(r.ok ? 'buy' : 'error'); this.result(r); });
      };
    });
  }

  /** เลือกฉายา (แผงสังคม) */
  renderTitles(el) {
    const c = this.char, have = new Set(c.titles || []);
    el.innerHTML = `<div class="title-list">${TITLES.map((t) => {
      const on = c.title === t.id, ok = have.has(t.id);
      return `<button class="title-row ${ok ? '' : 'locked'} ${on ? 'active' : ''}" data-title="${t.id}" ${ok ? '' : 'disabled'} style="--tc:${t.color}"><b>${ok ? '' : '🔒 '}${esc(t.nameTh)}</b><small>${esc(t.hint)}</small>${on ? '<i>✔ ใช้อยู่</i>' : ''}</button>`;
    }).join('')}</div><button class="btn ghost sm" data-title="">ซ่อนฉายา</button>`;
    el.querySelectorAll('[data-title]').forEach((b) => (b.onclick = () => this.scene.econ.act('title', { id: b.dataset.title || null }).then((r) => { this.scene.sfx.play(r.ok ? 'buff' : 'error'); this.result(r); this.renderTitles(el); })));
  }
}
