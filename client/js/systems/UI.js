// ============================================================
//  UI – จัดการ HUD และหน้าต่าง DOM (สถานะ, กระเป๋า, ร้านค้า, แชท)
//  ใช้ HTML/CSS ซ้อนบน Canvas เพื่อให้ตัวหนังสือไทยคมชัด
// ============================================================
import { toast as notifyToast, ticker } from './Notify.js';
import { NewsBoard } from './NewsBoard.js';
import { skillCalcHtml } from './SkillInfo.js';
import { JOBS, JOB_IDS, PATH_LV, STAT_PLAN } from '/shared/data/classes.js';
import { ITEMS, SHOPS, sellPrice, WTYPE_JOB } from '/shared/data/items.js';
import { STAT_KEYS, STAT_INFO, expToNext, MAX_LEVEL, expLevelMul } from '/shared/stats.js';
import { getDerived, pathName } from './Character.js';
import { combatPower } from '/shared/character.js';
import * as Inv from './Inventory.js';
import { setInfo, SET_TEXT } from '/shared/data/gear.js';
import { TITLES, TITLE_BY_ID, TITLE_CATS } from '/shared/data/titles.js';
import { DYE_PRICE } from '/shared/economy.js';
import { OUTFITS, HAIRSTYLES } from '/shared/data/appearance.js';
import { SKILLS, SKILL_SLOTS, SKILL_BY_ID, MAX_SKILL_LV, skillStats, canLearn, skillCap, isItemSlot, slotItemId, skillUsable, skillWeaponTh, masteryOf, skillMastery, MASTERY_MAX as SK_MMAX } from '/shared/data/skills.js';
import { hotbarItemOk, passiveFree, classTitle, PRESET_LABEL, presetInfo } from '/shared/charmodel.js';
import { PASSIVES, BRANCHES, KEYSTONE, canAllocate, branchPoints, bonusText, totalPassivePoints, PASSIVES_ON } from '/shared/data/passives.js';
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
import { CARD_BY_ID, SLOT_CARD, CARD_SLOT_TH, socketCount, cardText } from '/shared/data/cards.js';
import { KINDS, rarityOf, newFilter, applyFilter, filterBarHtml, bindFilterBar, gainBadge, gainText, cpGain, bestSlotFor, bestLoadout, cardGain, bestCardSlot, baseCp, canWear } from './ItemFilter.js';
import { ItemTip, impactLine, inlineStats, itemCard } from './ItemTip.js';
import { ChatBox } from './ChatBox.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
import { SLOT_TH, GEAR_TYPES, TYPE_TH, FLASK_SLOTS } from '/shared/data/slots.js';
import { ask, notice } from './Dialog.js';
export { rarityOf };
/** บรรทัดค่าสุ่มของไอเทม (สีฟ้า/ม่วงตามจำนวน) */
export const affixHtml = (it) => (it?.affixes?.length ? `<div class="affixes a${Math.min(3, it.affixN)}">${it.affixes.map((a) => `<span>◆ ${a.text}</span>`).join('')}</div>` : '');
const rcls = (it) => { const r = rarityOf(it); return r ? ` r${r}` : ''; };
const rname = (it, name) => { const r = rarityOf(it); return r ? `<span class="rn${r}">${name}</span>` : name; };
/** ป้ายแนวของอาวุธ / สายของชุด */
const itemTag = (it) => (it.lv ? ` · Lv.${it.lv}` : '') + (it.legend ? ' · ✦ตำนาน' : '') + (it.wtype ? ` · แนว${JOBS[WTYPE_JOB[it.wtype]].nameTh}`
  : it.job ? ` · สาย${JOBS[it.job].nameTh}` : it.path ? ` · ชุดสาย${JOBS[it.path].nameTh}` : '');

/** ร้าน → สไปรต์ NPC (ใช้ตอนเปิดร้านโดยไม่มีตัว NPC ส่งมา) */
const SHOP_PORT = { mae_kha: 'npc_yai_tim', lung_dam: 'npc_lung_dam', tailor: 'npc_mae_choy', pa_sa: 'npc_pa_sa', kru_sword: 'npc_kru_sword', kru_mage: 'npc_kru_mage', kru_archer: 'npc_kru_archer', kru_boxer: 'npc_kru_boxer', kru_healer: 'npc_pa_sa' };
const portCache = new Map();
/** ครอปหน้า NPC จาก assets/td/<key>/idle.png (แถวทิศใต้ เฟรมแรก) → dataURL (แคชไว้) */
export function npcPortrait(key) {
  if (portCache.has(key)) return portCache.get(key);
  const p = new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      try {
        const F = 72, c = document.createElement('canvas'); c.width = F; c.height = F;
        const g = c.getContext('2d'); g.drawImage(img, 0, 0, F, F, 0, 0, F, F);
        const d = g.getImageData(0, 0, F, F).data;
        let x0 = F, y0 = F, x1 = 0;
        for (let y = 0; y < F; y++) for (let x = 0; x < F; x++) if (d[(y * F + x) * 4 + 3] > 20) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); }
        if (x1 <= x0) return res(null);
        const side = Math.max(24, Math.round((x1 - x0 + 1) * 0.95)), cx = (x0 + x1) / 2;   // สี่เหลี่ยมจัตุรัสจากหัวลงมา (หัว-ไหล่)
        const out = document.createElement('canvas'); out.width = out.height = 96;
        const o = out.getContext('2d'); o.imageSmoothingEnabled = false;
        o.drawImage(c, Math.round(cx - side / 2), Math.max(0, y0 - 2), side, side, 0, 0, 96, 96);
        res(out.toDataURL());
      } catch { res(null); }
    };
    img.onerror = () => res(null);
    img.src = `assets/td/${key}/idle.png`;
  });
  portCache.set(key, p);
  return p;
}

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
    { const cp = $('#dn-copy'); if (cp) cp.onclick = () => {                                 // คัดลอกเลขบัญชี (ไม่มีขีด)
      const no = ($('#dn-no')?.textContent || '').replace(/\D/g, '');
      const ok = () => this.toast('📋 คัดลอกเลขบัญชีแล้ว', 'ok', 1600);
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(no).then(ok, () => this.toast(no, '', 4000)); else this.toast(no, '', 4000);
    }; }
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

    // แชท (กรอบ MMO แบบแท็บ)
    this.rarityOf = rarityOf;
    this.chatBox = ChatBox.attach(this);
    this.news = new NewsBoard(this);                               // กระดานข่าวสาร (📰)                           // ตัวเดียวตลอดเกม (ฉากเริ่มใหม่ก็ไม่หายประวัติ)
    // Shift+คลิกไอเทมใดก็ได้ (กระเป๋า/ช่องสวม/ร้าน) → แชร์ลงแชท (ของที่สวมอยู่แนบขั้นตีบวกไปด้วย)
    document.addEventListener('click', (e) => {
      if (!e.shiftKey) return;
      const t = e.target.closest?.('[data-tip-item]'); if (!t || t.closest('#chat')) return;
      e.preventDefault(); e.stopPropagation();
      const slot = t.dataset.tipSlot, enh = slot ? this.char?.enhance?.[slot] || 0 : 0;
      this.chatBox.linkItem(t.dataset.tipItem, enh);
    }, true);
    // พิมพ์ในช่องกรอกใดก็ได้ → ปิดคีย์บอร์ดเกม + ล้างปุ่มค้าง (ไม่งั้นตัวละครเดินเองหลังพิมพ์เสร็จ)
    const isField = (el) => el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && el.type !== 'checkbox' && el.type !== 'range';
    document.addEventListener('focusin', (e) => { if (isField(e.target)) { scene.input.keyboard.enabled = false; scene.input.keyboard.resetKeys(); } });
    document.addEventListener('focusout', (e) => { if (isField(e.target)) { scene.input.keyboard.resetKeys(); scene.input.keyboard.enabled = true; } });
  }

  get char() { return this.scene.player.char; }

  /** คำสั่ง GM (เฉพาะบัญชีใน ADMIN_IDS ของ server): /gm gold 1000000 · /gm lv 30 · /gm item yant_guard 10 · /gm sp 20 · /gm stat 50 · /gm enh weapon 20 · /gm heal */
  gmCommand(text) {
    if (!account.account?.admin && this.scene.econ.server) return this.toast('คำสั่งนี้ใช้ได้เฉพาะแอดมิน', 'warn');
    const [, cmd = 'help', a1, a2] = text.trim().split(/\s+/);
    const rest = text.trim().replace(/^\/gm\s+\S+\s*/i, '');          // ข้อความทั้งหมดหลังคำสั่ง (ใช้กับ say/patch)
    this.scene.econ.act('gm', { cmd, a1, a2, rest }).then((r) => {
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
    const sig = [c.hp, c.mp, d.maxHp, d.maxMp, c.exp, c.level, c.gold, c.appearance.job, c.path, c.statPoints, c.sp, JSON.stringify(c.skills), (c.passives || []).length, Inv.count(c, 'hp_s'), Inv.count(c, 'mp_s'), this.scene.player?.d8id, this.scene.textures?.exists(`td:${this.scene.player?.d8id}:idle`)].join('|');
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
    document.body.classList.toggle('lowhp', c.hp > 0 && c.hp / d.maxHp < 0.3);          // ขอบจอแดงเตือนเลือดน้อย
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
    const p = this.scene.player, d8 = p.d8id, tk = d8 && `td:${d8}:idle`;
    // โมเดล 8 ทิศ (ชุดที่สวมจริง): ครอปหัว-ไหล่จากท่ายืนหันหน้า
    if (tk && this.scene.textures.exists(tk) && this.scene.textures.get(tk).has('south_0')) {
      if (this.portraitKey === tk) return;
      const fr = this.scene.textures.getFrame(tk, 'south_0'), img = fr.source.image;
      const tmp = document.createElement('canvas'); tmp.width = fr.cutWidth; tmp.height = fr.cutHeight;
      const tc = tmp.getContext('2d', { willReadFrequently: true }); tc.drawImage(img, fr.cutX, fr.cutY, fr.cutWidth, fr.cutHeight, 0, 0, fr.cutWidth, fr.cutHeight);
      const px = tc.getImageData(0, 0, tmp.width, tmp.height).data;
      let top = -1, bot = -1, sx = 0, n = 0;
      for (let y = 0; y < tmp.height && top < 0; y++) for (let x = 0; x < tmp.width; x++) if (px[(y * tmp.width + x) * 4 + 3] > 60) { top = y; break; }
      for (let y = tmp.height - 1; y > top && bot < 0; y--) for (let x = 0; x < tmp.width; x++) if (px[(y * tmp.width + x) * 4 + 3] > 60) { bot = y; break; }
      if (top >= 0) {
        const hh = (bot - top) / 5.2;
        for (let y = top; y < top + hh; y++) for (let x = 0; x < tmp.width; x++) if (px[(y * tmp.width + x) * 4 + 3] > 60) { sx += x; n++; }
        const cx = n ? sx / n : tmp.width / 2, size = Math.round(hh * 2.1), y0 = Math.max(0, Math.round(top - hh * 0.25));
        this.portraitKey = tk;
        const cv = $('#hud-portrait'), ctx = cv.getContext('2d');
        ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, cv.width, cv.height);
        ctx.drawImage(tmp, Math.round(cx - size / 2), y0, size, size, 0, 0, cv.width, cv.height);
        return;
      }
    }
    const key = p.texKey;
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
      // สีเลเวลเป้าหมาย: เทา = อ่อนกว่ามาก (EXP ลด) · แดง = สูงกว่ามาก (EXP ลด) · ปกติ = ได้เต็ม
      const lvGap = t.def.level - (p?.char?.level || 1), mul = expLevelMul(p?.char?.level || 1, t.def.level);
      const tl = $('#t-lv'); tl.className = mul < 1 ? (lvGap < 0 ? 'lv-low' : 'lv-high') : '';
      tl.title = mul < 1 ? `EXP ${Math.round(mul * 100)}% (เลเวลห่างเกิน 5)` : 'EXP เต็ม';
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
    { const hb = $('#btn-home'), ic = uiIcon('menu_home'); if (hb && ic) hb.innerHTML = `${ic}${hb.querySelector('small')?.outerHTML || ''}`; }
    { const nb = document.querySelector('#btn-news .nb-ic'), ic = uiIcon('menu_news'); if (nb && ic) nb.innerHTML = ic; }
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

  /** on = ต่อเซิร์ฟอยู่ · near = ผู้เล่นอื่นในแผนที่นี้ · จำนวนที่แสดง = ออนไลน์ทั้งเซิร์ฟ (server ส่ง online:count) */
  setOnline(on, near = this.nearN || 0) {
    this.netOn = on; this.nearN = near;
    const el = $('#net-status'); if (!el) return;
    el.className = `net ${on ? 'on' : 'off'}`;
    const total = Math.max(this.onlineN || 0, near + 1);
    el.textContent = on ? `● ${total} คนออนไลน์` : '● ออฟไลน์';
    el.title = on ? `ออนไลน์ทั้งเซิร์ฟเวอร์ ${total} คน · ในแผนที่นี้ ${near + 1} คน (รวมคุณ)` : '';
  }
  setOnlineTotal(n) { this.onlineN = Math.max(0, n | 0); this.setOnline(this.netOn ?? true, this.nearN || 0); }

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
      const off = !skillUsable(SKILL_BY_ID[id], c.appearance.job);
      return `<div class="skill${off ? ' noweapon' : ''}" data-key="${key}" data-id="${id}" draggable="true"><span class="k">${key}</span><button class="hb-x" data-hbx="${key}" title="เอาออกจากช่อง" aria-label="เอาออก">✕</button><span class="ic">${skillIcon(id, st.icon)}</span><span class="mp">${st.mp}</span>
        <div class="cd"></div><div class="cdt"></div>
        <div class="tip"><b>${st.nameTh}</b> Lv.${lv} (${key})<br>MP ${st.mp} · CD ${(st.cd / 1000).toFixed(1)}s${st.mult ? ` · ดาเมจ x${st.mult}` : ''}<br>${st.desc}${off ? `<br><span style="color:#f5b041">ต้องถือ${skillWeaponTh(SKILL_BY_ID[id], JOBS)}</span>` : ''}</div></div>`;
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
    this.skMode ||= PASSIVES_ON ? 'passive' : 'active';
    if (!PASSIVES_ON && this.skMode === 'passive') this.skMode = 'active';
    document.querySelector('#sk-modes [data-mode=passive]')?.classList.toggle('hidden', !PASSIVES_ON);
    $('#sk-pp-lbl')?.classList.toggle('hidden', !PASSIVES_ON);
    if (!PASSIVES_ON && this.skTab === 'hybrid') this.skTab = null;
    $('#sk-job').textContent = classTitle(c);
    $('#sk-sp').textContent = `${c.sp}`; $('#sk-sp').title = `SP ของชุด ${PRESET_LABEL[c.pset === 1 ? 1 : 0]} (แต้มสกิลแยกตามชุด · Tab สลับชุด)`;
    { const h = $('#sk-sp')?.parentElement; if (h) h.dataset.pset = `ชุด ${PRESET_LABEL[c.pset === 1 ? 1 : 0]}`; }
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
        <p>${bonusText(n.bonus) || 'จุดศูนย์กลาง — เริ่มลงแต้มจากตรงนี้'}</p>${n.id.startsWith('hy_') ? (() => { const hs = SKILLS.hybrid.find((x) => x.node === n.id); return hs ? `<p style="color:#f9e79f">⚡ ปลดเคล็ดวิชาผสม “${hs.nameTh}” (ต้องลงทั้งสองกิ่งอย่างละ 3 แต้ม)</p>` : ''; })() : ''}
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
    $('#sk-preset').onclick = async () => {
      if (!(await ask({ title: 'ล้างต้นไม้พรสวรรค์ทั้งหมด?', icon: '↺', ok: 'ล้างต้นไม้', text: `${cost ? `ค่าล้าง ฿${cost}` : 'ฟรี (ก่อน Lv.10)'}\nสกิลที่เลเวลเกินเพดานจะคืน SP` }))) return;
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
    const HY = job === 'hybrid';
    tabs.innerHTML = [...JOB_IDS, ...(PASSIVES_ON ? ['hybrid'] : [])].map((j) => {
      const learned = SKILLS[j].reduce((a, sk) => a + (c.skills[sk.id] || 0), 0);
      const label = j === 'hybrid' ? '⚡ เคล็ดวิชาผสม' : `${JOBS[j].icon} ${JOBS[j].weaponTh}`;
      return `<button data-sktab="${j}" class="${j === job ? 'active' : ''} ${c.appearance.job === j ? 'main' : ''}">${label}${learned ? ` <small>${learned}</small>` : ''}</button>`;
    }).join('') + (HY ? `<span class="sk-note">เคล็ดวิชาผสม: ลงจุดผสมระหว่างสองกิ่ง + ลงทั้งสองกิ่งอย่างละ 3 แต้ม · ใช้ได้เมื่อถืออาวุธของกิ่งใดกิ่งหนึ่ง · สกิลทุกท่าชำนาญขึ้นเองเมื่อใช้ (สูงสุดขั้น ${SK_MMAX})</span>`
      : `<span class="sk-note">${PASSIVES_ON ? `เพดานเลเวลสกิล = 2 + (แต้ม${BRANCHES[job].nameTh} ${bp[job]} ÷ 2) · ★ ต้องมีคีย์สโตน · ` : 'อัปสกิลได้ถึง Lv.5 (ต้องถึงเลเวลตัวละครที่กำหนด) · '}ใช้ได้เมื่อถือ${JOBS[job].weaponTh}${c.appearance.job === job ? ' ✔' : ''} · ยิ่งใช้ยิ่งชำนาญ (ขั้นละ +2% แรง −1% คูลดาวน์)</span>`);
    tabs.querySelectorAll('[data-sktab]').forEach((b) => (b.onclick = () => { this.skTab = b.dataset.sktab; this.scene.sfx.play('click'); this.renderSkillTree(); }));
    const dStat = getDerived(c);
    $('#sk-tree').innerHTML = SKILLS[job].map((base) => {
      const lv = c.skills[base.id] || 0;
      const cap = skillCap(c, { ...base, job });
      const mm = skillMastery(c.skx?.[base.id] || 0);
      const cur = skillStats(base, Math.max(1, lv), mm.m), next = lv < MAX_SKILL_LV ? skillStats(base, lv + 1, mm.m) : null;
      const chk = canLearn(c, base.id);
      const locked = c.level < base.reqLv || cap === 0;
      const stat = (st) => `MP ${st.mp} · CD ${(st.cd / 1000).toFixed(1)}s${st.mult ? `<br>ดาเมจ x${st.mult}` : ''}${st.duration ? `<br>นาน ${(st.duration / 1000).toFixed(0)}s` : ''}`;
      const slotKey = SKILL_SLOTS.find((k) => c.hotbar[k] === base.id);
      return `<div class="sk-card ${base.ultimate ? 'ult' : ''} ${locked ? 'locked' : ''} ${lv ? '' : 'unlearned'}">
        <div class="sk-icon" draggable="${lv > 0}" data-id="${base.id}" title="ลากไปวางที่ Hotbar">${skillIcon(base.id, base.icon)}</div>
        <div class="sk-name">${base.nameTh}${base.ultimate ? ' ★' : ''}</div>
        <div class="sk-pips">${Array.from({ length: MAX_SKILL_LV }, (_, i) => `<i class="${i < lv ? 'on' : i >= cap ? 'cap' : ''}"></i>`).join('')}</div>
        <div class="sk-lv">Lv.${lv} / ${cap}</div>
        <div class="sk-mast" title="ความชำนาญ: ร่ายสำเร็จ 1 ครั้ง = 1 แต้ม · ขั้นละ +2% ความแรง −1% คูลดาวน์">✨ ชำนาญ ${mm.m}/${SK_MMAX}<i style="width:${mm.need ? Math.round(mm.cur / mm.need * 100) : 100}%"></i></div>
        <div class="sk-desc">${base.desc}</div>
        <div class="sk-stat">${lv ? stat(cur) : stat(skillStats(base, 1))}${next && lv ? `<br><span style="color:#58d68d">→ Lv.${lv + 1}: ${next.mult ? `x${next.mult}` : `MP ${next.mp}`}</span>` : ''}</div>
        <button class="sk-calc-btn" data-calc="${base.id}" title="ดูวิธีคิดดาเมจ/ผลของสกิลด้วยค่าสถานะปัจจุบัน">📐 วิธีคิดดาเมจ</button>
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
    $('#sk-tree').querySelectorAll('[data-calc]').forEach((b) => (b.onclick = (e) => {
      e.stopPropagation();
      const base = SKILL_BY_ID[b.dataset.calc], lv = c.skills[base.id] || 0, mm = skillMastery(c.skx?.[base.id] || 0);
      const cur = skillStats(base, Math.max(1, lv), mm.m), next = lv && lv < MAX_SKILL_LV ? skillStats(base, lv + 1, mm.m) : null;
      let pop = $('#sk-calc-pop');
      if (!pop) { pop = document.createElement('div'); pop.id = 'sk-calc-pop'; document.body.appendChild(pop); document.addEventListener('pointerdown', (ev) => { if (!ev.target.closest('#sk-calc-pop, [data-calc]')) pop.classList.add('hidden'); }); }
      pop.innerHTML = `<header>${skillIcon(base.id, base.icon)}<b>${base.nameTh}${base.ultimate ? ' ★' : ''}</b><span>Lv.${Math.max(1, lv)}${lv ? '' : ' (ยังไม่ได้เรียน · แสดงค่า Lv.1)'}</span><button class="x">✕</button></header>
        <p class="d">${base.desc}</p>${skillCalcHtml(cur, dStat, { lv: Math.max(1, lv), next })}
        <p class="f">สูตร: ดาเมจ = พลัง × ตัวคูณ × สุ่ม 0.9–1.1 − DEF ศัตรู × (กายภาพ 50% / เวทย์ 25%) · คริ × ดาเมจคริ · ตัวเลขคิดจากค่าสถานะตอนนี้ (ยังไม่รวมบัฟชั่วคราว)</p>`;
      pop.querySelector('.x').onclick = () => pop.classList.add('hidden');
      pop.classList.remove('hidden');
      const r = b.getBoundingClientRect(), W = Math.min(440, window.innerWidth - 16);
      pop.style.width = `${W}px`; pop.style.left = `${Math.max(8, Math.min(window.innerWidth - W - 8, r.left + r.width / 2 - W / 2))}px`;
      const h = pop.offsetHeight; pop.style.top = `${r.top - h - 8 > 8 ? r.top - h - 8 : Math.min(window.innerHeight - h - 8, r.bottom + 8)}px`;
    }));
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
      $('#set-shake').checked = st.fxShake !== false; $('#set-flash').value = st.fxFlash || 'full'; $('#set-othersfx').value = st.otherSfx || 'full';
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
    $('#set-othersfx').onchange = (e) => { st.otherSfx = e.target.value; apply(); };
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

  toast(msg, kind = '', ms = 2600) { notifyToast(msg, kind, ms); }

  /** ใบเปลี่ยนชื่อ: พิมพ์ชื่อใหม่ (ตรวจระหว่างพิมพ์) → server ตรวจซ้ำ/ใช้ใบ/เปลี่ยนชื่อ */
  openRename() {
    const net = this.scene.net;
    if (!net?.socket) return this.toast('ต้องออนไลน์ถึงจะเปลี่ยนชื่อได้', 'warn');
    this.closeAll?.();
    let box = $('#rename-box');
    if (!box) { box = document.createElement('div'); box.id = 'rename-box'; box.className = 'lb-modal'; document.body.appendChild(box); }
    box.innerHTML = `<div class="rn-card thai-frame"><h3>📝 ใบเปลี่ยนชื่อ</h3><p>ชื่อตอนนี้: <b>${esc(this.char.name)}</b> · ชื่อใหม่ต้องไม่ซ้ำใคร (ไทย/อังกฤษ/ตัวเลข/_ · 2–16 ตัว)</p>
      <input id="rn-in" maxlength="16" placeholder="ชื่อใหม่" autocomplete="off"><small id="rn-st" class="cc-hint"></small><span class="cc-ideas" id="rn-ideas"></span>
      <div class="rn-btns"><button class="btn ghost" id="rn-no">ยกเลิก</button><button class="btn primary" id="rn-ok">เปลี่ยนชื่อ</button></div></div>`;
    box.classList.remove('hidden');
    const inp = $('#rn-in'), st = $('#rn-st'), ideas = $('#rn-ideas');
    this.scene.input.keyboard.enabled = false;
    const close = () => { box.classList.add('hidden'); this.scene.input.keyboard.enabled = true; };
    const show = (ok, msg, list = []) => {
      st.textContent = msg; st.className = `cc-hint ${ok === true ? 'ok' : ok === false ? 'bad' : ''}`;
      ideas.innerHTML = list.map((n) => `<button type="button" class="cc-idea" data-n="${esc(n)}">${esc(n)}</button>`).join('');
      ideas.querySelectorAll('.cc-idea').forEach((b) => (b.onclick = () => { inp.value = b.dataset.n; check(); }));
    };
    let t = 0;
    const check = () => { clearTimeout(t); const v = inp.value; if (!v.trim()) return show(null, ''); t = setTimeout(() => account.checkName(v).then((r) => { if (inp.value === v) show(r.ok, `${r.ok ? '✔' : '✖'} ${r.msg}`, r.ideas); }).catch(() => {}), 300); };
    inp.oninput = check; inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') $('#rn-ok').click(); if (e.key === 'Escape') close(); };
    $('#rn-no').onclick = close;
    $('#rn-ok').onclick = () => {
      const v = inp.value.trim(); if (!v) return;
      net.socket.emit('char:rename', { name: v }, (r) => {
        if (!r?.ok) { show(false, `✖ ${r?.msg || 'เปลี่ยนชื่อไม่สำเร็จ'}`, r?.ideas || []); this.scene.sfx.play('error'); return; }
        close(); this.scene.sfx.play('levelup'); this.toast(`✔ เปลี่ยนชื่อเป็น “${r.name}” แล้ว`, 'ok', 4000);
      });
    };
    setTimeout(() => inp.focus(), 50);
  }

  /** แถบร่าย (กลางล่าง) เช่น ยันต์คืนถิ่น → { done(), cancel(msg) } */
  castBar(label, ms, icon = '') {
    let el = $('#castbar');
    if (!el) { el = document.createElement('div'); el.id = 'castbar'; ($('#hud') || document.body).appendChild(el); }
    el.className = 'on';
    el.innerHTML = `<span class="cb-ic">${icon}</span><div class="cb-body"><div class="cb-top"><b>${esc(label)}</b><span class="cb-t"></span></div><div class="cb-bar"><i></i></div></div>`;
    const fill = el.querySelector('.cb-bar i'), tEl = el.querySelector('.cb-t'), t0 = performance.now();
    const tick = () => { const k = Math.min(1, (performance.now() - t0) / ms); fill.style.width = `${k * 100}%`; tEl.textContent = `${Math.max(0, (ms - (performance.now() - t0)) / 1000).toFixed(1)} วิ`; if (k < 1 && el.classList.contains('on')) this._castRaf = requestAnimationFrame(tick); };
    cancelAnimationFrame(this._castRaf); tick();
    const end = (cls) => { cancelAnimationFrame(this._castRaf); el.className = `on ${cls}`; setTimeout(() => { if (el.classList.contains(cls)) el.className = ''; }, 700); };
    return { done: () => end('ok'), cancel: () => end('fail') };
  }

  chat(m) {
    this.chatBox?.add(m);
    // ประกาศระดับเซิร์ฟเวอร์ → แถบวิ่งด้านบน (ประกาศ GM มาทาง server:notice แล้ว ไม่ซ้ำ)
    if (m && m.id == null && m.name) {
      const K = [['👑', 'boss'], ['🔨', 'enh'], ['✨ ของหายาก', 'rare'], ['🃏', 'rare'], ['🏅', 'enh'], ['🕯️ สุสานใต้ดิน', 'boss'], ['👹', 'boss']];
      const k = K.find(([p]) => m.name.startsWith(p));
      if (k && !/ออกจากดันเจี้ยน|หมดเวลา/.test(m.text || '')) ticker(`${m.name.replace(/^\S+\s*/, '')}: ${m.text}`, k[1]);
    }
  }

  /** ผลลัพธ์จาก Inventory → แจ้งเตือน + รีเฟรช */
  result(r) {
    if (r?.then) return r.then((x) => this.result(x));            // รับ Promise จาก econ.act ได้
    if (!r) return;
    if (r.home) { this.closeAll(); return this.scene.recall(); }
    if (r.rename) return this.openRename();
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
      ...((d.healPow || 1) > 1 || c.appearance?.job === 'healer' ? [['พลังรักษา 💚', 'healPow', (v) => `${Math.round(((v || 1) - 1) * 100)}%`]] : []),
    ];
    const cp0 = combatPower(c, d), cp1 = used ? combatPower(c, after) : cp0, rk = c.rec?.cpRank;
    { const ps = $('#st-preset'); if (ps) { ps.innerHTML = this.presetStrip(c); ps.querySelectorAll('[data-pset]').forEach((b) => (b.onclick = () => this.scene.swapPreset?.())); } }
    $('#st-derived').innerHTML = `<div class="cp-line"><span>⚔ ค่าพลังรวม</span><b>${cp0.toLocaleString('en-US')}${cp1 !== cp0 ? ` <em class="up">→ ${cp1.toLocaleString('en-US')}</em>` : ''}${rk ? ` <small>อันดับ #${rk}</small>` : ''}</b></div>` + rows.map(([label, key, f = (v) => v]) => {
      const up = after[key] !== d[key];
      return `<div><span>${label}</span><b>${f(d[key])}${up ? ` <em class="up">→ ${f(after[key])}</em>` : ''}</b></div>`;
    }).join('')
      + `<div class="path-line"><span>อาชีพ${PASSIVES_ON ? ' (พรสวรรค์ + อาวุธ)' : ' (ความชำนาญอาวุธ)'}</span><b>${classTitle(c)}${PASSIVES_ON ? ` · แต้มพรสวรรค์เหลือ ${passiveFree(c)} (K)` : ''}</b></div>`
      + `<div class="path-line"><span>แนวต่อสู้ (ตามอาวุธ)</span><b>${JOBS[c.appearance.job].icon} ${JOBS[c.appearance.job].nameTh} · ชำนาญ Lv.${masteryLevel(c.wm?.[c.appearance.job] || 0).lv}</b></div>`
      + this.masteryHtml(c);
  }

  /** แถบชุดการเล่น A/B ในหน้าสถานะ: ชุดที่ใช้ + แต้มเหลือของแต่ละชุด · คลิกอีกชุด = สลับ */
  presetStrip(c) {
    const chip = (i) => {
      const o = presetInfo(c, i), j = JOBS[o.job];
      const name = o.empty ? 'ยังว่าง' : j ? `${j.icon} ${j.nameTh}` : 'มือเปล่า';
      return `<button class="ps-chip ${o.active ? 'on' : ''} ${i ? 'b' : 'a'}" data-pset="${i}" ${o.active ? 'disabled' : ''}>
        <b>ชุด ${PRESET_LABEL[i]}${o.active ? ' <em class="ps-on">● ใช้อยู่</em>' : ' <em class="ps-go">คลิกเพื่อสลับ</em>'}</b><span>${name}</span><small>แต้มสถานะ ${o.statPoints} · SP ${o.sp}</small></button>`;
    };
    return `<div class="preset-strip">${chip(0)}${chip(1)}<small class="ps-hint">Tab = สลับชุด · แต่ละชุดมีอาวุธ/อุปกรณ์/แต้มสถานะ/สกิลของตัวเอง</small></div>`;
  }

  /** ความชำนาญอาวุธ 5 แนว: เลเวล · หลอดความคืบหน้า · โบนัสโจมตี · ★ = อาชีพ · ✋ = ถืออยู่ */
  masteryHtml(c) {
    const rows = JOB_IDS.map((j) => {
      const m = masteryLevel(c.wm?.[j] || 0), max = m.lv >= MASTERY_MAX, pct = max ? 100 : Math.round((m.cur / m.need) * 100);
      const tags = `${c.path === j ? '<em class="ms-tag cls" title="อาชีพปัจจุบัน">★ อาชีพ</em>' : ''}${c.appearance?.job === j ? '<em class="ms-tag hold" title="อาวุธที่ถืออยู่">✋ ถืออยู่</em>' : ''}`;
      return `<div class="ms-row ${c.appearance?.job === j ? 'cur' : ''} ${m.lv ? '' : 'zero'}" title="${max ? 'เต็มแล้ว' : `อีก ${m.need - m.cur} แต้ม ถึง Lv.${m.lv + 1}`} · โจมตีด้วยอาวุธนี้ +${m.lv}%">
        <span class="ms-name">${JOBS[j].icon} ${JOBS[j].weaponTh}${tags}</span>
        <div class="ms-bar"><i style="width:${pct}%"></i><small>${max ? 'MAX' : `${m.cur}/${m.need}`}</small></div>
        <b>Lv.${m.lv}<small>/${MASTERY_MAX}</small></b><span class="ms-bonus">+${m.lv}%</span></div>`;
    }).join('');
    return `<div class="ms mastery-box"><div class="ms-hd"><span>🗡️ ความชำนาญอาวุธ</span><small>ฆ่าผีด้วยอาวุธไหน แนวนั้นขึ้น · ทุก Lv โจมตี +1% · ถือแนวที่ชำนาญ Lv.3+ = เป็นอาชีพนั้น</small></div>${rows}</div>`;
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
    // จำตำแหน่งเลื่อนของตาราง/แผง ไว้คืนหลังวาดใหม่ (กันกระเป๋าเด้งกลับบนสุดทุกครั้งที่คลิก)
    const g0 = document.querySelector('#inv-list .ro-grid'), keep = { g: g0?.scrollTop || 0, l: $('#inv-list')?.scrollTop || 0 };
    this._renderInventory();
    const g1 = document.querySelector('#inv-list .ro-grid'); if (g1) g1.scrollTop = keep.g;
    if ($('#inv-list')) $('#inv-list').scrollTop = keep.l;
  }

  _renderInventory() {
    const c = this.char;
    const f = (this.invF ||= newFilter());
    const EMPTY_IC = { weapon: '⚔️', helm: '⛑️', armor: '🥋', gloves: '🧤', boots: '👢', belt: '🎗️', accessory: '💍', accessory2: '📿', flask: '🧪', flask2: '🧪' };
    const typeOfSlot = (slot) => (slot === 'accessory2' ? 'accessory' : slot === 'flask2' ? 'flask' : slot);
    // ช่องการ์ดบนหุ่น (อาวุธ/เสื้อ/เครื่องประดับ): จุดทอง = มีการ์ด · ＋ = ช่องว่าง (คลิกเพื่อเลือกการ์ด)
    const pips = (slot) => {
      if (!SLOT_CARD[slot] || !c.equipment[slot]) return '';
      const n = socketCount(slot, c.enhance?.[slot] || 0), list = c.cards?.[slot] || [];
      if (!n) return '';
      return `<span class="eqs-cards">${Array.from({ length: n }, (_, i) => (CARD_BY_ID[list[i]] ? `<i class="on" title="${esc(CARD_BY_ID[list[i]].nameTh)}"></i>` : `<b class="sock-add" data-cardpick="${slot}" title="ใส่การ์ด${CARD_SLOT_TH[SLOT_CARD[slot]]}">＋</b>`)).join('')}</span>`;
    };
    const cell = (slot) => {
      const id = c.equipment[slot], it = id && ITEMS[id], active = f.slot === typeOfSlot(slot) && f.kind === 'gear';
      if (!it) return `<div class="eqs eqs-${slot} empty${active ? ' pick' : ''}" data-eqslot="${slot}" title="${SLOT_TH[slot]} (ว่าง) · คลิก = ดูของที่ใส่ช่องนี้ได้ · ลากของมาวางได้"><span class="ph">${EMPTY_IC[slot]}</span><small>${SLOT_TH[slot]}</small></div>`;
      const enh = c.enhance?.[slot];
      const ch = FLASK_SLOTS.includes(slot) && it.flask ? `<span class="fl-ch">${Math.floor(c.flaskCh?.[slot] || 0)}/${it.flask.max}</span>` : '';
      return `<div class="eqs eqs-${slot}${rcls(it)}${active ? ' pick' : ''}" data-tip-item="${id}" data-tip-slot="${slot}" data-eqslot="${slot}" title="คลิก = ดูของที่ใส่แทนได้ · ดับเบิลคลิก/✕ = ถอด">
        <span class="ico">${itemIcon(id, it.icon)}</span>${enh ? `<b class="enh t${ENHANCE.auraTier(enh)}">+${enh}</b>` : ''}${ch}${pips(slot)}
        <button class="eqs-x" data-unequip="${slot}" title="ถอด">✕</button><small>${esc(it.nameTh)}</small></div>`;
    };
    const cpNow = baseCp(c), plan = bestLoadout(c);
    $('#inv-equip').innerHTML = `<div class="eq-head"><span class="eq-cp">⚔ ค่าพลังรวม <b>${cpNow.toLocaleString('en-US')}</b></span>
      <button class="btn sm ${plan.length ? 'primary' : 'ghost'}" data-bestgear ${plan.length ? '' : 'disabled'} title="สวมของในกระเป๋าที่ให้ค่าพลังรวมสูงสุดทุกช่อง">⚡ ใส่ชุดที่ดีที่สุด${plan.length ? ` (${plan.length})` : ''}</button></div>
      <div class="eq-grid">${['weapon', 'helm', 'accessory', 'armor', 'accessory2', 'gloves', 'boots', 'flask', 'belt', 'flask2'].map(cell).join('')}</div>`;
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
    const eqEl = $('#inv-equip');
    eqEl.querySelectorAll('[data-unequip]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); this.result(this.scene.econ.act('unequip', { slot: b.dataset.unequip })); }));
    eqEl.querySelectorAll('[data-uncos]').forEach((b) => (b.onclick = () => this.result(this.scene.econ.act('cosOff', { slot: b.dataset.uncos }))));
    eqEl.querySelectorAll('[data-eqslot]').forEach((d) => {
      const slot = d.dataset.eqslot, t = typeOfSlot(slot);
      // คลิก = กรองกระเป๋าให้เหลือของที่ใส่ช่องนี้ได้ (คลิกซ้ำ = ยกเลิก) · ดับเบิลคลิก = ถอด
      d.onclick = (e) => {
        if (e.target.closest('[data-cardpick],[data-unequip]')) return;
        const on = f.kind === 'gear' && f.slot === t;
        Object.assign(f, on ? { kind: 'all', slot: 'any', wear: false } : { kind: 'gear', slot: t, wear: true });
        this.invSel = null; this.scene.sfx.play('click'); this.renderInventory();
      };
      d.ondblclick = () => { if (c.equipment[slot]) this.result(this.scene.econ.act('unequip', { slot })); };
      // ลากจากกระเป๋ามาวาง: อุปกรณ์ = สวมช่องนี้ · การ์ด = ใส่การ์ดช่องนี้
      d.addEventListener('dragover', (e) => { if (e.dataTransfer.types.includes('text/item')) { e.preventDefault(); d.classList.add('drop'); } });
      d.addEventListener('dragleave', () => d.classList.remove('drop'));
      d.addEventListener('drop', (e) => {
        e.preventDefault(); d.classList.remove('drop');
        const id = e.dataTransfer.getData('text/item'), it = ITEMS[id];
        if (!it) return;
        if (CARD_BY_ID[id]) return this.result(this.scene.econ.act('cardIn', { slot, id }));
        if (typeOfSlot(slot) !== it.type) return this.toast(`${it.nameTh} ใส่ช่อง${SLOT_TH[slot]}ไม่ได้`, 'warn');
        this.result(this.scene.econ.act('equip', { id, slot }));
      });
    });
    eqEl.querySelectorAll('[data-cardpick]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); this.invCardPick = this.invCardPick === b.dataset.cardpick ? null : b.dataset.cardpick; this.scene.sfx.play('click'); this.renderInventory(); }));
    eqEl.querySelector('[data-bestgear]')?.addEventListener('click', async () => {
      const todo = bestLoadout(this.char);
      if (!todo.length) return;
      const before = baseCp(this.char);
      for (const { slot, id } of todo) { const r = await this.scene.econ.act('equip', { id, slot }); if (!r?.ok) { this.result(r); break; } if (r.jobChanged) this.scene.onAppearanceChanged(); }
      this.scene.sfx.play('buff'); this.refreshPanels(); this.scene.saveSoon();
      const after = baseCp(this.char);
      this.toast(`⚡ สวมชุดที่ดีที่สุด ${todo.length} ชิ้น · ค่าพลังรวม ${before.toLocaleString('en-US')} → ${after.toLocaleString('en-US')}`);
    });

    // ---------- กระเป๋าแบบ Ragnarok + ตัวกรองมาตรฐาน (หมวด · ช่อง · สายฉัน · ใส่ได้ · ▲ ดีกว่า · หายาก · เรียง · ค้นหา) ----------
    //  คลิก = เลือก · ดับเบิลคลิก = ใช้/สวม · คลิกขวา = ล็อก · ลากไปหุ่น/Hotbar ได้
    const list = applyFilter(c, c.inventory, f);
    const ACT = { home: 'ใช้', consumable: 'ใช้', food: 'กิน', offering: 'ถวาย', weapon: 'ถือ', armor: 'สวม', helm: 'สวม', gloves: 'สวม', boots: 'สวม', belt: 'คาด', accessory: 'สวม', flask: 'ใส่', costume: 'แต่ง', reset: 'ใช้', reskill: 'ใช้', rename: 'ใช้', card: 'ใส่การ์ด' };
    const actOf = (id) => { const it = ITEMS[id]; return it.type === 'skin' ? (c.path === it.job ? null : 'เปลี่ยนสาย') : ACT[it.type] || null; };
    const cells = list.length;   // ช่องว่างเติมหลังวาด (ตามจำนวนคอลัมน์จริง) ดู fillGrid
    const sel = list.some((st) => st.id === this.invSel) ? this.invSel : null;
    const slots = Array.from({ length: cells }, (_, i) => {
      const st = list[i];
      if (!st) return '<div class="ro-slot empty"></div>';
      const it = ITEMS[st.id], lock = Inv.isLocked(c, st.id), under = it.lv && c.level < it.lv;
      return `<div class="ro-slot${rcls(it)}${st.id === sel ? ' sel' : ''}${under ? ' under' : ''}" data-slot="${st.id}" data-tip-item="${st.id}" draggable="true" data-hbitem="${st.id}">
        ${itemIcon(st.id, it.icon)}${st.qty > 1 ? `<b class="ro-q">${st.qty > 9999 ? '9999+' : st.qty}</b>` : ''}${lock ? '<i class="ro-lock">🔒</i>' : ''}${gainBadge(c, st.id)}</div>`;
    }).join('');
    // ตัวเลือกการ์ด (จากจุด ＋ บนหุ่น หรือเลือกการ์ดในกระเป๋า)
    let pick = '';
    if (this.invCardPick && c.equipment[this.invCardPick]) {
      const slot = this.invCardPick, type = SLOT_CARD[slot];
      const cards = c.inventory.filter((s) => CARD_BY_ID[s.id]?.slot === type).map((s) => ({ ...s, g: cardGain(c, slot, s.id) ?? 0 })).sort((a, b) => b.g - a.g);
      pick = `<div class="inv-cardpick"><div class="h">🃏 ใส่การ์ด${CARD_SLOT_TH[type]} → <b>${SLOT_TH[slot]}</b> <button class="btn ghost sm" data-cpx>ยกเลิก</button></div>
        ${cards.length ? `<div class="list">${cards.map((s) => `<button class="cp-card" data-cardin="${s.id}" data-tip-item="${s.id}">${itemIcon(s.id, ITEMS[s.id].icon)}<span>${esc(CARD_BY_ID[s.id].monTh || ITEMS[s.id].nameTh)}<small>${esc(cardText(CARD_BY_ID[s.id]))}</small></span><b class="${s.g > 0 ? 'up' : ''}">⚔ ${s.g > 0 ? '+' : ''}${s.g.toLocaleString('en-US')}</b></button>`).join('')}</div>`
          : `<p class="empty">ไม่มีการ์ด${CARD_SLOT_TH[type]}ในกระเป๋า · ล่าผีเพื่อสะสม</p>`}</div>`;
    }
    const si2 = sel && ITEMS[sel], selSt = sel && c.inventory.find((st) => st.id === sel);
    const cardTo = si2 && CARD_BY_ID[sel] ? bestCardSlot(c, sel) : null;
    const bar = si2 ? `<div class="ro-bar"><span class="ic">${itemIcon(sel, si2.icon)}</span><span class="ro-name">${rname(si2, esc(si2.nameTh))} <span class="meta">x${selSt.qty}${itemTag(si2) || ''}</span>${gainText(c, sel)}${impactLine(c, sel)}
        ${CARD_BY_ID[sel] ? `<span class="cp-gain ${cardTo?.gain > 0 ? 'up' : 'same'}">${cardTo ? `🃏 ใส่ช่อง${SLOT_TH[cardTo.slot]} · ⚔ ${cardTo.gain >= 0 ? '+' : ''}${cardTo.gain.toLocaleString('en-US')}` : '🃏 ไม่มีช่องการ์ดว่างที่ใส่ได้'}</span>` : ''}</span>
        <span class="ro-acts"><span class="price">฿${sellPrice(sel)}</span>
        <button class="lock ${Inv.isLocked(c, sel) ? 'on' : ''}" data-lock="${sel}" title="ล็อกกันขาย">${Inv.isLocked(c, sel) ? '🔒' : '🔓'}</button>
        <button class="hb-add" data-share="${sel}" title="แชร์ไอเทมลงแชท (Shift+คลิก ก็ได้)">💬</button>
        ${hotbarItemOk(sel) ? `<button class="hb-add" data-hbadd="${sel}" title="ใส่ Hotbar ช่องว่างแรก">⌨</button>` : ''}
        ${actOf(sel) ? `<button class="primary" data-use="${sel}">${actOf(sel)}</button>` : ''}</span></div>`
      : `<div class="ro-bar hint"><span><b class="up">▲</b> ใส่แล้วแรงขึ้น · ดับเบิลคลิก = ใช้/สวม · คลิกขวา = ล็อก · ลากไปวางบนหุ่นได้ · คลิกช่องบนหุ่น = หาของใส่ช่องนั้น</span></div>`;
    $('#inv-list').innerHTML = `<div class="ro-bag">${filterBarHtml(c, f, c.inventory)}
      ${pick}<div class="ro-grid">${list.length ? slots : `<div class="empty" style="grid-column:1/-1">ไม่พบไอเทมตามตัวกรอง <button class="btn ghost sm" data-ifreset>ล้างตัวกรอง</button></div>`}</div>
      ${bar}
      <div class="ro-foot"><span>ช่องที่ใช้ ${c.inventory.length}${list.length !== c.inventory.length ? ` · แสดง ${list.length}` : ''}</span><span class="ro-zeny">฿ ${c.gold.toLocaleString()}</span></div></div>`;
    const inv = $('#inv-list');
    // เติมช่องว่างให้เต็มแถว (อย่างน้อย 4 แถว) ตามจำนวนคอลัมน์ที่จอแสดงได้จริง
    const grid = inv.querySelector('.ro-grid');
    if (grid && list.length) {
      const cols = Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length);
      const want = Math.max(cols * 4, Math.ceil(list.length / cols) * cols);
      grid.insertAdjacentHTML('beforeend', '<div class="ro-slot empty"></div>'.repeat(Math.max(0, want - list.length)));
    }
    bindFilterBar(inv, f, () => { this.invSel = null; this.renderInventory(); }, this.scene);
    inv.querySelector('[data-ifreset]')?.addEventListener('click', () => { this.invF = newFilter(); this.renderInventory(); });
    const toggleLock = (id) => this.scene.econ.act('lock', { id }).then((r) => {
      this.toast(r.locked ? `🔒 ล็อก ${ITEMS[id].nameTh} (จะไม่ถูกขาย)` : `🔓 ปลดล็อก ${ITEMS[id].nameTh}`);
      this.scene.sfx.play('click'); this.renderInventory(); this.scene.saveSoon();
    });
    const use = (id) => {
      if (CARD_BY_ID[id]) { const t = bestCardSlot(this.char, id); return t ? this.result(this.scene.econ.act('cardIn', { slot: t.slot, id })) : this.cards.open('sockets', id); }
      const it = ITEMS[id];
      if (it.type === 'accessory') return this.result(this.scene.econ.act('equip', { id, slot: bestSlotFor(this.char, id) }));
      return this.result(this.scene.econ.act('use', { id }));
    };
    inv.querySelectorAll('.ro-slot[data-slot]').forEach((el) => {
      const id = el.dataset.slot;
      el.onclick = () => { if (this.invSel !== id) { this.invSel = id; this.scene.sfx.play('click'); this.renderInventory(); } };
      el.ondblclick = () => { if (actOf(id)) use(id); };
      el.oncontextmenu = (e) => { e.preventDefault(); toggleLock(id); };
    });
    inv.querySelectorAll('[data-lock]').forEach((b) => (b.onclick = () => toggleLock(b.dataset.lock)));
    inv.querySelectorAll('[data-share]').forEach((b) => (b.onclick = () => this.chatBox?.linkItem(b.dataset.share)));
    inv.querySelectorAll('[data-use]').forEach((b) => (b.onclick = () => use(b.dataset.use)));
    inv.querySelectorAll('[data-hbadd]').forEach((b) => (b.onclick = () => this.assignFirstFree(b.dataset.hbadd)));
    inv.querySelectorAll('[data-hbitem]').forEach((el) => el.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/item', el.dataset.hbitem); e.dataTransfer.effectAllowed = 'copy'; }));
    inv.querySelector('[data-cpx]')?.addEventListener('click', () => { this.invCardPick = null; this.renderInventory(); });
    inv.querySelectorAll('[data-cardin]').forEach((b) => (b.onclick = () => { const slot = this.invCardPick; this.invCardPick = null; this.scene.sfx.play('buy'); this.result(this.scene.econ.act('cardIn', { slot, id: b.dataset.cardin })); }));
  }

  // ---------------- ร้านค้า NPC ----------------
  openShop(shopId, npc = null) {
    this.shopId = shopId; this.shopSel = null;
    for (const f of [this.shopF, this.sellF]) if (f) Object.assign(f, { kind: 'all', slot: 'any', q: '' });   // ร้านใหม่: ล้างหมวด/ค้นหา (คงตัวเลือกสายฉัน/เรียง)
    this.shopQty = 1;                        // เปิดร้านใหม่ทุกครั้ง → จำนวนกลับเป็น x1 (กันซื้อพลาดจากค่าที่ค้างจากร้านก่อน)
    const shop = SHOPS[shopId];
    $('#shop-title').textContent = shop.nameTh;
    $('#shop-greet').textContent = `“${shop.greeting}”`;
    // ภาพ/ชื่อ NPC ด้านบน (ใช้เฟรมจากตัวละครในเกม)
    const [nm, ...rest] = shop.nameTh.split(' ');
    $('#shop-npc').textContent = npc?.nameTh || nm;
    $('#shop-role').textContent = npc?.role || rest.join(' ');
    // ภาพหน้า NPC: ตัดจากสไปรต์ 8 ทิศ (ท่ายืน หันหน้า) → ครอปช่วงหัว-ไหล่ใส่วงกลม
    const pkey = npc?.key || SHOP_PORT[shopId];
    $('#shop-port').style.display = 'none'; $('#shop-port-ic').innerHTML = uiIcon('shop', npc?.icon || '🛒');
    if (pkey) npcPortrait(pkey).then((url) => {
      if (!url || this.shopId !== shopId) return;
      $('#shop-port').src = url; $('#shop-port').style.display = ''; $('#shop-port').classList.add('real'); $('#shop-port-ic').innerHTML = '';
    });
    const TAB_TH = { buy: '🛒 ซื้อ', sell: '💰 ขาย', enhance: `${uiIcon('anvil', '🔨')} ตีบวก`, cook: `${uiIcon('soup', '🍳')} ทำอาหาร`, brew: `${uiIcon('herb', '🌿')} ปรุงยา`, forge: '⚒️ สร้างอุปกรณ์', dye: '🎨 ย้อมสี', cards: '🃏 แลกการ์ด', quests: '📜 เควสอาชีพ', buyback: '↩ ซื้อคืน' };
    const tabs = [...(shop.tabs || ['buy', 'sell'])];
    if (tabs.includes('sell') && !tabs.includes('buyback')) tabs.splice(tabs.indexOf('sell') + 1, 0, 'buyback');   // ซื้อคืนของที่เพิ่งขาย (กันขายพลาด)
    this.shopTab = tabs[0];
    $('#shop-tabs').innerHTML = tabs.map((t, i) => `<button data-tab="${t}" class="${i ? '' : 'active'}">${TAB_TH[t]}</button>`).join('');
    this.closeAll();
    this.toggle('shop-panel', true);
  }

  renderShop() {
    const c = this.char, shop = SHOPS[this.shopId];
    $('#shop-gold').textContent = c.gold.toLocaleString();
    $('#shop-panel').classList.toggle('selling', this.shopTab === 'sell');     // แท็บขาย: หน้าต่างสูงพอดีจอ ตารางไอเทมเลื่อนในตัว (ท้ายหน้าต่างไม่ทับตาราง)
    let html;
    if (this.shopTab === 'enhance') return this.scene.village.renderEnhance($('#shop-list'));
    if (this.shopTab === 'cards') return this.cards.renderTrade($('#shop-list'));
    if (this.shopTab === 'cook') return this.scene.village.renderCook($('#shop-list'));
    if (this.shopTab === 'brew') return this.scene.village.renderBrew($('#shop-list'));
    if (this.shopTab === 'forge') return this.scene.village.renderForge($('#shop-list'));
    if (this.shopTab === 'dye') return this.renderDye($('#shop-list'));
    if (this.shopTab === 'quests') return this.scene.village.renderQuestList($('#shop-list'), this.shopId);
    if (this.shopTab === 'buyback') return this.renderBuyback($('#shop-list'));
    // เลือกจำนวน: x1 / x5 / x10 / สูงสุด (ใช้ทั้งซื้อและขาย)
    const QTY = [[1, 'x1'], [5, 'x5'], [10, 'x10'], [9999, 'สูงสุด']];
    // ร้านครูอาชีพไม่มีแถบจำนวน → ซื้อทีละชิ้นเสมอ
    const q = this.shopTab === 'buy' && shop.job ? 1 : this.shopQty || 1;
    const custom = !QTY.some(([n]) => n === q);
    const qtyBar = `<div class="qty-bar"><span>จำนวน:</span>${QTY.map(([n, l]) => `<button data-qty="${n}" class="${q === n ? 'active' : ''}">${l}</button>`).join('')}
      <label class="qty-custom ${custom ? 'active' : ''}">ระบุ <input type="number" id="shop-qty-in" min="1" max="9999" value="${custom ? q : ''}" placeholder="เช่น 25" /></label></div>`;
    if (this.shopTab === 'buy') {
      // ตัวกรองมาตรฐาน (หมวด · ช่อง · สายฉัน · ใส่ได้ · ▲ ดีกว่า · หายาก · เรียง · ค้นหา)
      const f = (this.shopF ||= newFilter());
      const kinds = ['all', 'gear', 'use', 'card', 'etc'].filter((k) => k === 'all' || shop.stock.some((id) => ITEMS[id] && KINDS[k][1](ITEMS[id])));
      if (!kinds.includes(f.kind)) f.kind = 'all';
      const hasGear = shop.stock.some((id) => KINDS.gear[1](ITEMS[id]));
      const filterBar = filterBarHtml(c, f, shop.stock, { kinds, gear: hasGear });
      const stock = applyFilter(c, shop.stock, f, { price: (id) => ITEMS[id].price || 0 });
      // แบบ 2 ฝั่ง: ซ้าย = ตารางสินค้า · ขวา = รายละเอียด + จำนวน + ปุ่มซื้อ
      if (!stock.includes(this.shopSel)) this.shopSel = stock.find((id) => !(ITEMS[id].lv && c.level < ITEMS[id].lv)) || stock[0];
      const sel = this.shopSel, si = ITEMS[sel];
      const cards = stock.map((id) => {
        const it = ITEMS[id], under = it.lv && c.level < it.lv, have = Inv.count(c, id);
        return `<button class="sb-card${id === sel ? ' on' : ''}${under ? ' under' : ''}${rcls(it)}" data-sel="${id}"><span class="ic">${itemIcon(id, it.icon)}</span>
          <span class="nm">${rname(it, esc(it.nameTh))}</span><span class="pr">฿${it.price.toLocaleString()}</span>${have ? `<i class="hv">มี ${have}</i>` : ''}${under ? `<i class="lk">🔒 Lv.${it.lv}</i>` : ''}${gainBadge(c, id)}</button>`;
      }).join('');
      let detail = '<p class="empty">เลือกสินค้าทางซ้าย</p>';
      if (si) {
        const owned = si.type === 'skin' && Inv.count(c, sel);
        const n = si.type === 'skin' ? 1 : Math.max(1, Math.min(q, Math.floor(c.gold / si.price) || 1));
        const afford = c.gold >= si.price * n;
        const prev = ['costume', 'armor', 'weapon'].includes(si.type) ? `<button class="btn ghost sm" data-prev="${sel}">👁 ลองใส่</button>` : '';
        detail = `<div class="item-tip sb-tip"><div class="tt-card">${itemCard(c, sel, { rarityOf: this.itemTip?.rarityOf || (() => 0) })}</div></div>
          ${gainText(c, sel)}${impactLine(c, sel)}
          ${shop.job || si.type === 'skin' ? '' : qtyBar}
          <div class="sb-buy"><span class="tot">รวม <b class="${afford ? '' : 'bad'}">฿${(si.price * n).toLocaleString()}</b>${n > 1 ? ` <small>(${n} ชิ้น)</small>` : ''}</span>${prev}
          <button class="btn primary" data-buy="${sel}" data-n="${n}" ${owned || !afford ? 'disabled' : ''}>${owned ? 'มีแล้ว' : !afford ? 'เงินไม่พอ' : n > 1 ? `ซื้อ x${n}` : 'ซื้อ'}</button></div>`;
      }
      html = filterBar + `<div class="shop-buy"><div class="sb-grid">${cards || '<p class="empty">ไม่มีสินค้าในหมวดนี้</p>'}</div><div class="sb-detail">${detail}</div></div>`;
    } else return this.renderSell();
    $('#shop-list').innerHTML = html;
    const trade = (r) => { this.scene.sfx.play(r.ok ? 'buy' : 'error'); this.result(r); };
    bindFilterBar($('#shop-list'), this.shopF, () => this.renderShop(), this.scene);
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
    $('#shop-list').querySelectorAll('[data-sel]').forEach((b) => (b.onclick = () => { this.shopSel = b.dataset.sel; this.scene.sfx.play('click'); const y = $('.sb-grid')?.scrollTop; this.renderShop(); const g = $('.sb-grid'); if (g && y) g.scrollTop = y; }));
    $('#shop-list').querySelectorAll('[data-bulk]').forEach((b) => (b.onclick = async () => {
      const list = Inv.bulkSellList(c, b.dataset.bulk);
      const total = list.reduce((a, s) => a + sellPrice(s.id) * s.qty, 0), n = list.reduce((a, s) => a + s.qty, 0);
      if (!list.length || !(await ask({ title: `ขาย${b.dataset.bulk === 'fish' ? 'ปลา' : 'ของดรอป'}ทั้งหมด?`, icon: '💰', ok: 'ขาย', text: `${list.length} ชนิด (${n} ชิ้น) ได้ ฿${total.toLocaleString()}\nของที่ล็อก 🔒 จะไม่ถูกขาย` }))) return;
      E.act('sellMany', { kind: b.dataset.bulk }).then(trade);
    }));
  }

  /** แท็บซื้อคืน: ของที่เพิ่งขาย 10 รายการล่าสุด (ราคาเดิม) */
  renderBuyback(el) {
    const c = this.char, list = c.buyback || [];
    el.innerHTML = `<p class="greet">ขายพลาด? ซื้อคืนได้ในราคาที่ขายไป (เก็บ 10 รายการล่าสุด · ออกจากเกมแล้วยังอยู่)</p>
      ${list.length ? `<div class="bb-list">${list.map((e, i) => { const it = ITEMS[e.id]; if (!it) return ''; const cost = e.price * e.qty, ok = c.gold >= cost;
        return `<div class="bb-row${rcls(it)}" data-tip-item="${e.id}"><span class="ic">${itemIcon(e.id, it.icon)}</span><span class="nm">${rname(it, esc(it.nameTh))}${e.qty > 1 ? ` <small>x${e.qty}</small>` : ''}</span>
          <b class="pr ${ok ? '' : 'bad'}">฿${cost.toLocaleString()}</b><button class="btn sm ${ok ? 'primary' : ''}" data-bb="${i}" ${ok ? '' : 'disabled'}>${ok ? 'ซื้อคืน' : 'เงินไม่พอ'}</button></div>`; }).join('')}</div>`
        : '<p class="empty">ยังไม่มีของที่ขายไป</p>'}`;
    el.querySelectorAll('[data-bb]').forEach((b) => (b.onclick = () => this.scene.econ.act('buyback', { idx: +b.dataset.bb }).then((r) => { this.scene.sfx.play(r.ok ? 'buy' : 'error'); this.result(r); })));
  }

  /** แท็บขาย (แบบ RO): ตารางไอคอน → คลิกใส่ตะกร้า → กดขายทีเดียว · ตัวกรอง/ค้นหา/เลือกด่วน */
  renderSell() {
    const c = this.char, el = $('#shop-list'), E = this.scene.econ;
    const cart = (this.sellCart ||= new Map());
    for (const [id, n] of cart) { const have = Inv.count(c, id); if (!have || Inv.isLocked(c, id)) cart.delete(id); else if (n > have) cart.set(id, have); }
    const sf = (this.sellF ||= newFilter({ sort: 'price' }));
    const sellable = c.inventory.filter((st) => ITEMS[st.id] && ITEMS[st.id].type !== 'skin' && sellPrice(st.id) > 0);
    const list = applyFilter(c, sellable, sf);
    const cells = Math.max(16, Math.ceil(list.length / 8) * 8);
    const slots = Array.from({ length: cells }, (_, i) => {
      const st = list[i]; if (!st) return '<div class="ro-slot empty"></div>';
      const it = ITEMS[st.id], lock = Inv.isLocked(c, st.id), n = cart.get(st.id) || 0;
      return `<div class="ro-slot${rcls(it)}${n ? ' sel sell-on' : ''}${lock ? ' locked' : ''}${st.id === this.sellFocus ? ' focus' : ''}" data-sslot="${st.id}" data-tip-item="${st.id}">
        ${itemIcon(st.id, it.icon)}${st.qty > 1 ? `<b class="ro-q">${st.qty > 9999 ? '9999+' : st.qty}</b>` : ''}${lock ? '<i class="ro-lock">🔒</i>' : ''}${n ? `<i class="sell-n">${n === st.qty ? '✔' : n}</i>` : ''}${gainBadge(c, st.id)}</div>`;
    }).join('');
    let cnt = 0, pcs = 0, total = 0, rare = 0;
    let better = 0;
    for (const [id, n] of cart) { cnt++; pcs += n; total += sellPrice(id) * n; if (rarityOf(ITEMS[id]) >= 3) rare++; if ((cpGain(c, id) || 0) > 0 && canWear(c, ITEMS[id])) better++; }
    const f = this.sellFocus && cart.has(this.sellFocus) ? this.sellFocus : null, fIt = f && ITEMS[f], fHave = f && Inv.count(c, f);
    const qtyEd = f && fHave > 1 ? `<div class="sell-qty"><span class="ic">${itemIcon(f, fIt.icon)}</span><span class="nm">${rname(fIt, esc(fIt.nameTh))}</span>
        <button data-sq="-10">−10</button><button data-sq="-1">−</button><input id="sell-qty" type="number" min="1" max="${fHave}" value="${cart.get(f)}"><button data-sq="1">+</button><button data-sq="10">+10</button><button data-sq="max">หมด (${fHave})</button></div>` : '';
    el.innerHTML = `<div class="sell-ui">
      ${filterBarHtml(c, sf, sellable)}
      <div class="sell-quick"><span>เลือกด่วน:</span>
        <button data-pick="drop">💰 ของดรอป</button><button data-pick="fish">🐟 ปลา</button><button data-pick="gear1">⚔️ อุปกรณ์ธรรมดา</button><button data-pick="view">☑ ทั้งหมดที่แสดง</button><button data-pick="clear" ${cnt ? '' : 'disabled'}>✖ ล้าง</button></div>
      <div class="ro-grid sell-grid">${list.length ? slots : '<div class="empty" style="grid-column:1/-1">ไม่มีของให้ขายในหมวดนี้</div>'}</div>
      <div class="sell-foot">${qtyEd}<span class="hint">คลิก = ใส่/เอาออกทั้งกอง · คลิกขวา = ทีละ 1 · 🔒 ของล็อกขายไม่ได้</span>
        <span class="sum">${cnt ? `เลือก ${cnt} ชนิด · ${pcs.toLocaleString()} ชิ้น` : 'ยังไม่ได้เลือก'}</span>
        <b class="price">฿${total.toLocaleString()}</b><button class="btn primary sell-go" ${cnt ? '' : 'disabled'}>ขาย</button></div></div>`;
    const redraw = () => { const g = el.querySelector('.sell-grid'), top = g?.scrollTop || 0; this.renderSell(); const g2 = el.querySelector('.sell-grid'); if (g2) g2.scrollTop = top; };
    const click = () => this.scene.sfx.play('click');
    bindFilterBar(el, sf, redraw, this.scene);
    el.querySelectorAll('[data-sslot]').forEach((d) => {
      const id = d.dataset.sslot;
      d.onclick = (e) => {
        if (e.shiftKey) return;                                               // Shift+คลิก = แชร์ลงแชท (จัดการที่อื่น)
        if (Inv.isLocked(c, id)) { this.toast('🔒 ไอเทมนี้ล็อกไว้ (ปลดล็อกในกระเป๋า)', 'warn'); return; }
        if (cart.has(id)) { cart.delete(id); if (this.sellFocus === id) this.sellFocus = null; } else { cart.set(id, Inv.count(c, id)); this.sellFocus = id; }
        click(); redraw();
      };
      d.oncontextmenu = (e) => {
        e.preventDefault();
        if (Inv.isLocked(c, id)) return;
        cart.set(id, Math.min(Inv.count(c, id), (cart.get(id) || 0) + 1)); this.sellFocus = id; click(); redraw();
      };
    });
    el.querySelectorAll('[data-pick]').forEach((b) => (b.onclick = () => {
      const k = b.dataset.pick;
      if (k === 'clear') cart.clear();
      else {
        const src = k === 'view' ? list : c.inventory.filter((st) => { const it = ITEMS[st.id]; if (!sellPrice(st.id) || it.type === 'skin') return false;
          return k === 'drop' ? it.type === 'material' && !it.price : k === 'fish' ? it.type === 'fish' : GEAR_TYPES.includes(it.type) && rarityOf(it) <= 1; });
        let n = 0; for (const st of src) if (!Inv.isLocked(c, st.id) && !cart.has(st.id)) { cart.set(st.id, st.qty); n++; }
        if (!n) this.toast('ไม่มีของเพิ่มให้เลือก', '', 1500);
      }
      click(); redraw();
    }));
    const setQ = (v) => { if (!f) return; cart.set(f, Math.max(1, Math.min(fHave, Math.floor(v) || 1))); redraw(); };
    el.querySelectorAll('[data-sq]').forEach((b) => (b.onclick = () => setQ(b.dataset.sq === 'max' ? fHave : cart.get(f) + +b.dataset.sq)));
    const qn = $('#sell-qty');
    if (qn) { qn.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') setQ(+qn.value); }); qn.addEventListener('change', () => setQ(+qn.value));
      qn.addEventListener('focus', () => (this.scene.input.keyboard.enabled = false)); qn.addEventListener('blur', () => (this.scene.input.keyboard.enabled = true)); }
    el.querySelector('.sell-go').onclick = async () => {
      if (!cnt) return;
      if ((rare || better || total >= 50000) && !(await ask({ title: `ขาย ${cnt} ชนิด (${pcs.toLocaleString()} ชิ้น)?`, icon: '💰', ok: `ขาย ฿${total.toLocaleString()}`,
        text: `ได้เงิน ฿${total.toLocaleString()}${rare ? `\n⚠ มีอุปกรณ์หายาก ${rare} ชิ้นในตะกร้า` : ''}${better ? `\n⚠ มีของที่ดีกว่าที่ใส่อยู่ ${better} ชิ้น (▲)` : ''}\nขายพลาดซื้อคืนได้ที่แท็บ "ซื้อคืน"` }))) return;
      E.act('sellCart', { items: [...cart] }).then((r) => { this.scene.sfx.play(r.ok ? 'buy' : 'error'); this.result(r); if (r.ok) { cart.clear(); this.sellFocus = null; } this.renderSell(); });
    };
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
      b.onclick = async () => {
        if (!(await ask({ title: `ย้อม${b.dataset.dye === 'hair' ? 'ผม' : 'ชุด'}เป็นแบบที่ ${+b.dataset.v + 1}?`, icon: '🎨', ok: 'ย้อมสี', text: `ค่าย้อม ฿${DYE_PRICE}` }))) return;
        this.scene.econ.act('dye', { part: b.dataset.dye, v: +b.dataset.v }).then((r) => { this.scene.sfx.play(r.ok ? 'buy' : 'error'); this.result(r); });
      };
    });
  }

  /** เลือกฉายา (แผงสังคม) · แบ่งหมวด */
  renderTitles(el) {
    const c = this.char, have = new Set(c.titles || []);
    const row = (t) => {
      const on = c.title === t.id, ok = have.has(t.id);
      return `<button class="title-row ${ok ? '' : 'locked'} ${on ? 'active' : ''} ${t.dynamic ? 'dyn' : ''}" data-title="${t.id}" ${ok ? '' : 'disabled'} style="--tc:${t.color}"><b>${ok ? '' : '🔒 '}${esc(t.nameTh)}</b><small>${esc(t.hint)}</small>${on ? '<i>✔ ใช้อยู่</i>' : ''}</button>`;
    };
    const cp = combatPower(c);
    const html = `<div class="title-sum">ปลดแล้ว <b>${TITLES.filter((t) => have.has(t.id)).length}/${TITLES.length}</b> · ค่าพลังรวม <b>⚔ ${cp.toLocaleString('en-US')}</b>${c.rec?.cpRank ? ` · อันดับ #${c.rec.cpRank}` : ''}</div>`
      + TITLE_CATS.map(([cat, name]) => {
        const list = TITLES.filter((t) => (t.cat || 'misc') === cat);
        if (!list.length) return '';
        const n = list.filter((t) => have.has(t.id)).length;
        return `<div class="title-cat"><h5>${name} <small>${n}/${list.length}</small></h5><div class="title-list">${list.map(row).join('')}</div></div>`;
      }).join('') + `<button class="btn ghost sm" data-title="">ซ่อนฉายา</button>`;
    if (el._html === html) return;                               // แผงสังคมวาดซ้ำทุก 1 วิ → ไม่เปลี่ยนก็ไม่แตะ DOM (กันไอคอน/ตัวเลขกระพริบ)
    el._html = html; el.innerHTML = html;
    el.querySelectorAll('[data-title]').forEach((b) => (b.onclick = () => this.scene.econ.act('title', { id: b.dataset.title || null }).then((r) => { this.scene.sfx.play(r.ok ? 'buff' : 'error'); this.result(r); this.renderTitles(el); })));
  }
}
