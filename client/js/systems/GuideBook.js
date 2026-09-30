// ============================================================
//  คู่มือผี (G) – มอนสเตอร์ · บอส · ของดรอป · ที่อยู่
//  ▸ ข้อมูลสร้างจากไฟล์ข้อมูลเกมโดยตรง (MONSTERS · ผังแมพ · การ์ด · สุสานใต้ดิน) → อัปเดตเองเมื่อแก้ข้อมูล
//  ▸ แท็บ: ผี / บอส / ปลา (ปลาประจำแดนจาก FISH_BY_MAP) · กรองตามแมพ · ค้นหาชื่อ
// ============================================================
import { mobAtkMul, mobExp, expLevelMul } from '/shared/stats.js';
import { MONSTERS } from '/shared/data/monsters.js';
import { ITEMS } from '/shared/data/items.js';
import { CARD_OF_MON, CARD_BY_ID, CARD_DROP, CARD_SLOT_TH, cardText } from '/shared/data/cards.js';
import { TD_MAPS, TD_MAP_IDS } from '/shared/td/maps.js';
import { CRYPT_ZONES } from '/shared/data/crypt.js';
import { WB_TIERS, WB_STONE, WB_MIN_SHARE, WB_FIGHT_MS, wbReward } from '/shared/data/worldboss.js';
import { FISH_BY_MAP } from '/shared/data/village.js';
import { itemIcon } from './util.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (v) => { const p = v * 100; return p >= 10 ? `${Math.round(p)}%` : p >= 1 ? `${+p.toFixed(1)}%` : `${+p.toFixed(2)}%`; };
const GEAR_RATE = 0.02;                          // shared/data/gear.js rollGearDrop: 2% ต่อตัว (หัวหน้า ×3 · บอส ×25)

let DB = null;
/** รวบรวมข้อมูลครั้งเดียว: ผีแต่ละตัวอยู่แมพ/โซนไหน กี่ตัว */
function build() {
  if (DB) return DB;
  const where = {};                              // monId → [{ map, mapTh, icon, zone, n, night, event }]
  const put = (id, e) => {
    const list = (where[id] ||= []);
    const ex = list.find((x) => x.map === e.map && x.zone === e.zone);
    if (ex) ex.n += e.n; else list.push(e);
  };
  for (const mid of TD_MAP_IDS) {
    const M = TD_MAPS[mid]; if (!M) continue;
    let L = null; try { L = M.layout(); } catch { continue; }
    for (const s of L.spawns || []) {
      if (!MONSTERS[s.id]) continue;
      const z = M.zoneAt?.(s.x, s.y), Z = M.ZONES?.[z];
      put(s.id, { map: mid, mapTh: M.nameTh, icon: M.icon || '🗺️', zone: z || '', zoneTh: Z?.nameTh || '', n: 1, lv: M.lv, event: mid === 'suriya',
        tx: Math.round(s.x / 16), ty: Math.round(s.y / 16) });
    }
  }
  // สุสานใต้ดิน (ชั้นละ 10)
  CRYPT_ZONES.forEach((Z, i) => {
    const f0 = i * 10 + 1, f1 = i * 10 + 10;
    for (const id of Z.mobs || []) if (MONSTERS[id]) put(id, { map: 'crypt', mapTh: 'สุสานใต้ดิน', icon: '💀', zone: `f${f0}`, zoneTh: `ชั้น ${f0}–${f1 - 1} · ${Z.name}`, n: 0, crypt: true });
    if (Z.boss && MONSTERS[Z.boss]) put(Z.boss, { map: 'crypt', mapTh: 'สุสานใต้ดิน', icon: '💀', zone: `b${f1}`, zoneTh: `บอสชั้น ${f1} · ${Z.bossName || Z.name}`, n: 0, crypt: true, cryptBoss: true });
  });
  const mobs = Object.entries(MONSTERS).map(([id, d]) => ({ id, d, where: where[id] || [] }))
    .filter((m) => m.where.length)
    .sort((a, b) => (a.d.level - b.d.level) || a.d.nameTh.localeCompare(b.d.nameTh, 'th'));
  // ของดรอป → ผีที่ดรอป
  const byItem = {};
  for (const m of mobs) {
    for (const dr of m.d.drops || []) if (ITEMS[dr.item]) (byItem[dr.item] ||= []).push({ id: m.id, chance: dr.chance });
    const cid = CARD_OF_MON[m.id]; if (cid && !m.d.worldBoss) (byItem[cid] ||= []).push({ id: m.id, chance: cardRate(m.d) });   // บอสโลก: รางวัลตามอันดับ (ดูหน้าบอส)
  }
  DB = { mobs, byItem };
  return DB;
}
const grade = (d) => (d.boss ? 'boss' : d.elite ? 'elite' : 'normal');
const cardRate = (d) => CARD_DROP[grade(d)];
const gearRate = (d) => Math.min(1, GEAR_RATE * (d.boss ? 25 : d.elite ? 3 : 1));

export class GuideBook {
  constructor(ui) { this.ui = ui; this.tab = 'mob'; this.map = 'all'; this.q = ''; this.sel = null; }
  get scene() { return this.ui.scene; }
  get char() { return this.ui.char; }

  open(monId) {
    build();
    if (monId && MONSTERS[monId]) { this.sel = monId; this.tab = MONSTERS[monId].boss ? 'boss' : 'mob'; }
    this.ui.toggle('guide-panel', true);
    this.render();
  }

  list() {
    const { mobs } = build(), q = this.q.trim().toLowerCase();
    return mobs.filter((m) => {
      if (this.tab === 'boss' && !m.d.boss) return false;
      if (this.tab === 'mob' && m.d.boss) return false;
      if (this.map !== 'all' && !m.where.some((w) => w.map === this.map)) return false;
      if (q && !m.d.nameTh.toLowerCase().includes(q) && !String(m.d.nameEn || '').toLowerCase().includes(q)
        && !(m.d.drops || []).some((dr) => ITEMS[dr.item]?.nameTh.toLowerCase().includes(q))) return false;
      return true;
    });
  }

  render() {
    const el = $('#guide-body'); if (!el) return;
    build();
    if (this.tab === 'drop') this.tab = 'mob';                     // แท็บค้นหาของดรอปเอาออกแล้ว (ค้นชื่อของได้ในช่องค้นหาของแท็บผี/บอส)
    const tabs = [['mob', '👻 ผี'], ['boss', '👑 บอส'], ['fish', '🎣 ปลา']];
    const maps = [['all', 'ทุกแมพ'], ...TD_MAP_IDS.filter((m) => TD_MAPS[m]).map((m) => [m, `${TD_MAPS[m].icon || ''} ${TD_MAPS[m].nameTh}`]), ['crypt', '💀 สุสานใต้ดิน']];
    const head = `<div class="gb-tabs">${tabs.map(([k, l]) => `<button class="gb-tab${this.tab === k ? ' on' : ''}" data-gtab="${k}">${l}</button>`).join('')}</div>
      <div class="gb-filter">${this.tab !== 'drop' ? `<select class="gb-map">${maps.map(([k, l]) => `<option value="${k}"${this.map === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>` : ''}
        <input type="search" class="gb-q" placeholder="${this.tab === 'fish' ? '🔍 ชื่อปลา' : '🔍 ชื่อผี หรือของที่ดรอป'}" value="${esc(this.q)}"></div>`;
    const keep = el.querySelector('.gb-list')?.scrollTop || 0, keepEl = el.scrollTop;   // คงตำแหน่งเลื่อนรายชื่อ
    el.innerHTML = head + (this.tab === 'fish' ? this.fishHtml() : this.mobHtml());
    const li = el.querySelector('.gb-list'); if (li) li.scrollTop = keep;
    el.scrollTop = keepEl;
    this.bind(el);
  }

  mobHtml() {
    const L = this.list();
    if (this.sel && !L.some((m) => m.id === this.sel)) this.sel = null;
    const sel = this.sel || L[0]?.id;
    const me = this.char?.level || 1;
    const rows = L.map((m) => {
      const d = m.d, mul = expLevelMul(me, d.level), col = mul < 1 ? (d.level < me ? 'easy' : 'hard') : 'even';   // สี = EXP: เทา/แดง = โดนลด · ปกติ = เต็ม/โบนัส
      return `<button class="gb-row${m.id === sel ? ' on' : ''}" data-mon="${m.id}">
        ${this.art(m.id, d)}<span class="gb-nm"><b>${esc(d.nameTh)}</b><small>${d.boss ? '👑 บอส · ' : d.elite ? '⭐ หัวหน้า · ' : ''}${esc(m.where[0]?.mapTh || '')}${d.nightOnly ? ' · 🌙' : ''}</small></span>
        <span class="gb-lv ${d.worldBoss ? 'hard' : col}">${d.worldBoss ? `Lv.${WB_TIERS[0].lv}–${WB_TIERS[WB_TIERS.length - 1].lv}` : `Lv.${d.level}`}</span></button>`;
    }).join('') || '<p class="empty">ไม่พบผีตามตัวกรอง</p>';
    return `<div class="gb-split"><div class="gb-list">${rows}</div><div class="gb-detail">${sel ? this.detail(sel) : ''}</div></div>`;
  }

  /** ปลาประจำแดน: โอกาสต่อครั้ง (กลางวัน/กลางคืน) คิดจากน้ำหนักใน FISH_BY_MAP · ความยาก = แถบดึงปลาแคบลง */
  fishHtml() {
    const q = this.q.trim().toLowerCase();
    const maps = Object.keys(FISH_BY_MAP).filter((m) => TD_MAPS[m] && (this.map === 'all' || this.map === m));
    const noFish = TD_MAP_IDS.filter((m) => TD_MAPS[m]?.noFish && !TD_MAPS[m].event).map((m) => TD_MAPS[m].nameTh);
    const hardTh = (h) => (h >= 0.9 ? 'ยากมาก' : h >= 0.6 ? 'ยาก' : h >= 0.35 ? 'ปานกลาง' : 'ง่าย');
    const secs = maps.map((mid) => {
      const pool = FISH_BY_MAP[mid], M = TD_MAPS[mid];
      const sum = (night) => pool.reduce((a, f) => a + (!f.night || night ? f.w : 0), 0), wd = sum(false), wn = sum(true);
      const rows = pool.filter((f) => ITEMS[f.id] && (!q || ITEMS[f.id].nameTh.toLowerCase().includes(q))).map((f) => {
        const it = ITEMS[f.id], legend = it.legendFish || f.legend;
        const tag = legend ? ' <small class="gb-tag boss">✦ ตำนาน</small>' : f.night ? ' <small class="gb-tag night">🌙 กลางคืน</small>' : '';
        const rate = f.night ? `${pct(f.w / wn)} <small>(คืน)</small>` : `${pct(f.w / wd)}<small> · คืน ${pct(f.w / wn)}</small>`;
        return `<div class="gb-drop" data-tip-item="${f.id}">${itemIcon(f.id, it.icon)}<span>${esc(it.nameTh)}${tag}<br><small>ขาย ฿${(it.sell || 0).toLocaleString('en-US')} · ${hardTh(f.hard)} · EXP ตกปลา ${f.xp || 4}</small></span><b>${rate}</b></div>`;
      }).join('');
      return rows ? `<h4>${M.icon || '🗺️'} ${esc(M.nameTh)}${Array.isArray(M.lv) ? ` <small>Lv.${M.lv[0]}–${M.lv[1]}</small>` : ''}</h4><div class="gb-drops">${rows}</div>` : '';
    }).join('');
    const notes = [
      '🎣 ยืนริมน้ำแล้วกด F (มือถือ: ปุ่ม 🎣) · แต่ละแดนมีปลาของตัวเอง · เปอร์เซ็นต์ = โอกาสต่อครั้งที่ปลากิน',
      '🌙 ปลากลางคืนขึ้นเฉพาะตอนมืด (ดูเวลาที่นาฬิกาใต้มินิแมพ) · ✦ ปลาตำนานตกได้ประกาศทั้งเซิร์ฟ',
      '💰 "ขายปลาทั้งหมด" ไม่ขายปลาหายาก/ตำนาน',
      noFish.length ? `🚫 ตกปลาไม่ได้: ${noFish.map(esc).join(' · ')} · สุสานใต้ดิน` : '',
    ].filter(Boolean);
    return `<div class="gb-card gb-fish">${secs || '<p class="empty">ไม่พบปลาตามตัวกรอง</p>'}<div class="gb-notes">${notes.map((n) => `<div>${n}</div>`).join('')}</div></div>`;
  }

  art(id, d, big = false) {
    const img = CARD_OF_MON[id] ? `<img src="/assets/cards/${id}.png" alt="" loading="lazy">` : `<i>${d.boss ? '👑' : '👻'}</i>`;   // ภาพการ์ดมีเฉพาะผีที่มีการ์ด
    return `<span class="gb-art${big ? ' big' : ''}${d.boss ? ' boss' : ''}">${img}</span>`;
  }

  /** บอสโลก (พระราหู): รางวัลตามอันดับดาเมจ ไม่ใช่ดรอปต่อตัว · สเตตัสโตตามขั้น → หน้าเฉพาะ */
  worldBossHtml(id, m) {
    const d = m.d, cid = CARD_OF_MON[id], cd = cid && CARD_BY_ID[cid], T0 = WB_TIERS[0], T5 = WB_TIERS[WB_TIERS.length - 1];
    const R = (r, mvp = false) => wbReward(r, 0.1, mvp);
    const range = (k) => `${pct(R(20)[k])}–${pct(R(1, true)[k])}`;
    const redIc = ITEMS.g_sword_wred ? itemIcon('g_sword_wred', '☾') : '☾';
    const stats = [['HP', 'ตามจำนวนคน'], ['เลเวล', `${T0.lv}–${T5.lv}`], ['โจมตี', '% HP ผู้เล่น'], ['ป้องกัน', 'ตามขั้น'], ['EXP', 'ตามอันดับ'], ['เงิน', 'ตามอันดับ']];
    const rewards = [
      { html: `${itemIcon(WB_STONE, '🌑')}<span>${esc(ITEMS[WB_STONE]?.nameTh || 'ศิลาราหู')} <small>${R(20).stone}–${R(1, true).stone} ก้อน (ขั้นต่ำได้น้อยลง) · ใช้หลอมของแดง</small></span>`, rate: 1 },
      { html: `${redIc}<span>ของแดงชุดสุริยคราส <small>ขั้นตามราหูรอบนั้น (I–IV · Lv.140) · สายตามอาวุธที่ถือ</small></span>`, rate: R(1, true).red, txt: range('red') },
      { html: `${itemIcon('yak_fang', '🦷')}<span>${esc(ITEMS.yak_fang?.nameTh || 'เขี้ยวพญายักษ์')} <small>${R(20).fang}–${R(1, true).fang} ชิ้น · เฉพาะขั้น 3 ขึ้นไป</small></span>`, rate: 1, txt: 'ขั้น 3+' },
      ...(cd ? [{ html: `${itemIcon(cid, '🃏')}<span>${esc(cd.nameTh)} <small>ช่อง${CARD_SLOT_TH[cd.slot]} · ${esc(cardText(cd))} · เฉพาะขั้น 4–5</small></span>`, tip: cid, rate: R(1, true).card, txt: range('card') }] : []),
    ];
    const tiers = WB_TIERS.map((t) => `<div>ขั้น ${t.n} <b>${esc(t.nameTh)}</b> Lv.${t.lv} <small>(เลเวลเฉลี่ย 5 คนเก่งสุด ≥ ${t.from})</small></div>`).join('');
    const notes = [
      `🌑 ลงมาทุก 1 ชั่วโมงตรง (ประกาศล่วงหน้า 10 นาที) · สู้ได้ ${Math.round(WB_FIGHT_MS / 60000)} นาที · ทั้งเซิร์ฟช่วยกัน`,
      `🏆 รางวัลตามอันดับดาเมจ: ต้องทำดาเมจอย่างน้อย ${pct(WB_MIN_SHARE)} ของเลือดบอส · MVP ได้มากสุด · ชนะไม่ทัน = ได้ 1/4`,
      '📈 ขั้นเลือกจากเลเวลคนในลานตอนบอสเกิด → เลือด/เกราะ/ผลึก/บริวาร/รางวัล ตามขั้น',
    ];
    return `<div class="gb-card">
      <div class="gb-top">${this.art(id, d, true)}<div><h3>${esc(d.nameTh)} <small>${esc(d.nameEn || '')}</small></h3>
        <div class="gb-tags"><span class="gb-lv hard">Lv.${T0.lv}–${T5.lv}</span><span class="gb-tag boss">🌑 บอสโลก</span></div>
        ${d.desc ? `<p class="gb-desc">${esc(d.desc)}</p>` : ''}</div></div>
      <div class="gb-stats">${stats.map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('')}</div>
      <h4>📍 ที่อยู่</h4><ul class="gb-where">${m.where.map((w) => `<li>${w.icon} <b>${esc(w.mapTh)}</b> <small>· อีเวนต์บอสโลก (กดปุ่ม "ไปลานสุริยคราส" ตอนประกาศ)</small></li>`).join('')}</ul>
      <h4>🎁 รางวัล <small>(ตามอันดับดาเมจ · อันดับท้าย → MVP)</small></h4>
      <div class="gb-drops">${rewards.map((x) => `<div class="gb-drop"${x.tip ? ` data-tip-item="${x.tip}"` : ''}>${x.html}<b>${x.txt || pct(x.rate)}</b></div>`).join('')}</div>
      <h4>📊 ขั้นของราหู</h4><div class="gb-notes">${tiers}</div>
      <div class="gb-notes">${notes.map((n) => `<div>${n}</div>`).join('')}</div>
    </div>`;
  }

  detail(id) {
    const { mobs } = build(), m = mobs.find((x) => x.id === id); if (!m) return '';
    if (m.d.worldBoss) return this.worldBossHtml(id, m);
    const d = m.d, cid = CARD_OF_MON[id], cd = cid && CARD_BY_ID[cid];
    const me = this.char?.level || 1, eff = d.exp ? mobExp(d.exp, me, d.level, !!d.boss) : 0;   // EXP จริงตามเลเวลเรา (โบนัสผีเวลสูง/แคปผีอ่อน)
    const expCell = !d.exp ? 'พิเศษ' : eff === d.exp ? eff.toLocaleString('en-US')
      : `<span title="ฐาน ${d.exp.toLocaleString('en-US')} · คิดตามเลเวลคุณ (Lv.${me})">${eff.toLocaleString('en-US')} <small>${eff > d.exp ? '⬆โบนัส' : '⬇ลด'}</small></span>`;
    const stats = [['HP', d.hp?.toLocaleString('en-US')], ['โจมตี', d.atk ? Math.round(d.atk * mobAtkMul(d.level)) : d.atk], ['ป้องกัน', d.def], ['หลบ', d.eva], ['EXP', expCell], ['เงิน', Array.isArray(d.gold) && d.gold[1] ? `฿${d.gold[0].toLocaleString('en-US')}–${d.gold[1].toLocaleString('en-US')}` : 'พิเศษ']];
    const gearLv = d.boss ? [Math.min(d.level + 6, 148) - 4, Math.min(d.level + 6, 148) + 2] : [Math.min(d.level, 148) - 4, Math.min(d.level, 148) + 2];
    const drops = [
      ...(d.drops || []).filter((dr) => ITEMS[dr.item]).map((dr) => ({ html: `${itemIcon(dr.item, ITEMS[dr.item].icon)}<span>${esc(ITEMS[dr.item].nameTh)}</span>`, tip: dr.item, rate: dr.chance })),
      { html: `<i class="gb-ic">🗡️</i><span>อุปกรณ์สุ่ม Lv.${Math.max(1, gearLv[0])}–${gearLv[1]} <small>(ค่าสุ่ม 0–3 บรรทัด · ครึ่งหนึ่งเป็นของสายที่ถือ)</small></span>`, rate: gearRate(d) },
      ...(cd ? [{ html: `${itemIcon(cid, '🃏')}<span>${esc(cd.nameTh)} <small>ช่อง${CARD_SLOT_TH[cd.slot]} · ${esc(cardText(cd))}</small></span>`, tip: cid, rate: cardRate(d) }] : []),
    ];
    const where = m.where.map((w) => `<li>${w.icon} <b>${esc(w.mapTh)}</b>${w.zoneTh ? ` › ${esc(w.zoneTh)}` : ''}${w.n ? ` <small>(${w.n} ตัว)</small>` : ''}${w.event ? ' <small>· อีเวนต์บอสโลก</small>' : ''}
      ${!w.crypt && !w.event && this.scene?.M?.id === w.map ? `<button class="btn ghost sm" data-goto="${w.tx},${w.ty}">📍 นำทาง</button>` : ''}</li>`).join('');
    const notes = [
      d.nightOnly ? '🌙 ออกเฉพาะกลางคืน' : '',
      d.boss && d.respawnMs ? `⏱ เกิดใหม่ทุก ${Math.round(d.respawnMs / 60000)} นาที · ผู้ช่วยตีได้ของ/การ์ดของตัวเอง` : '',
      d.elite && !d.boss ? `⭐ ผีหัวหน้า: ดรอปอุปกรณ์ ×3 · การ์ด ${pct(CARD_DROP.elite)}` : '',
    ].filter(Boolean);
    return `<div class="gb-card">
      <div class="gb-top">${this.art(id, d, true)}<div><h3>${esc(d.nameTh)} <small>${esc(d.nameEn || '')}</small></h3>
        <div class="gb-tags"><span class="gb-lv ${(() => { const mul = expLevelMul(me, d.level); return mul < 1 ? (d.level < me ? 'easy' : 'hard') : 'even'; })()}">Lv.${d.level}</span>${d.boss ? '<span class="gb-tag boss">👑 บอส</span>' : ''}${d.elite ? '<span class="gb-tag">⭐ หัวหน้า</span>' : ''}${d.nightOnly ? '<span class="gb-tag night">🌙 กลางคืน</span>' : ''}</div>
        ${d.desc ? `<p class="gb-desc">${esc(d.desc)}</p>` : ''}</div></div>
      <div class="gb-stats">${stats.map(([k, v]) => `<div><small>${k}</small><b>${v ?? '—'}</b></div>`).join('')}</div>
      <h4>📍 ที่อยู่</h4><ul class="gb-where">${where}</ul>
      <h4>🎁 ของดรอป <small>(โอกาสต่อตัว · พรเพิ่มดรอปช่วยได้)</small></h4>
      <div class="gb-drops">${drops.map((x) => `<div class="gb-drop"${x.tip ? ` data-tip-item="${x.tip}"` : ''}>${x.html}<b>${pct(x.rate)}</b></div>`).join('')}</div>
      ${notes.length ? `<div class="gb-notes">${notes.map((n) => `<div>${n}</div>`).join('')}</div>` : ''}
    </div>`;
  }

  bind(el) {
    const click = () => this.scene?.sfx?.play('click');
    el.querySelectorAll('[data-gtab]').forEach((b) => (b.onclick = () => { this.tab = b.dataset.gtab; this.sel = null; click(); this.render(); }));
    el.querySelectorAll('[data-mon]').forEach((b) => (b.onclick = () => {
      this.sel = b.dataset.mon;
      click();
      // เปลี่ยนแค่ส่วนรายละเอียด (ไม่วาดรายชื่อใหม่ → รายชื่อไม่เด้งกลับขึ้นบน)
      el.querySelectorAll('.gb-row.on').forEach((r) => r.classList.remove('on')); b.classList.add('on');
      const det = el.querySelector('.gb-detail');
      if (det) { det.innerHTML = this.detail(this.sel); det.scrollTop = 0; this.bindDetail(det); }
      if (window.innerWidth < 900) det?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }));
    const map = el.querySelector('.gb-map'); if (map) map.onchange = () => { this.map = map.value; this.sel = null; click(); this.render(); };
    const q = el.querySelector('.gb-q');
    if (q) {
      q.addEventListener('keydown', (e) => e.stopPropagation());
      q.addEventListener('focus', () => { if (this.scene?.input?.keyboard) this.scene.input.keyboard.enabled = false; });
      q.addEventListener('blur', () => { if (this.scene?.input?.keyboard) this.scene.input.keyboard.enabled = true; });
      q.oninput = () => { this.q = q.value; const pos = q.selectionStart; this.render(); const q2 = el.querySelector('.gb-q'); if (q2) { q2.focus(); try { q2.setSelectionRange(pos, pos); } catch { /* */ } } };
    }
    this.bindDetail(el);
  }

  bindDetail(el) {
    el.querySelectorAll('[data-goto]').forEach((b) => (b.onclick = () => {
      const [tx, ty] = b.dataset.goto.split(',').map(Number);
      this.ui.closeAll?.();
      if (this.scene?.player) { this.scene.player.target = null; this.scene.moveTo?.(tx * 16 + 8, ty * 16 + 8); }
      this.ui.toast?.(`📍 เดินไปหา ${MONSTERS[this.sel]?.nameTh || ''}`);
    }));
  }
}
