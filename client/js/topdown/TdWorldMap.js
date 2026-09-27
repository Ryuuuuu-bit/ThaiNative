// ============================================================
//  แผนที่โลก (กด M) — กรุงศรีอยุธยาทั้งแผ่น
//  โซน + เลเวล · บอส (มีชีวิต/รอเกิด) · NPC · แหล่งผี · ตัวเรา/เพื่อน
//  คลิกบนแผนที่ = เดินไปจุดนั้นอัตโนมัติ
// ============================================================
import { TILE } from '/shared/td/ayutthaya.js';
import { TD_MAPS } from '/shared/td/maps.js';
import { MONSTERS } from '/shared/data/monsters.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SCALE = 2;                     // groundMini: 1 ไทล์ = 2px
let MAP_W = 232, MAP_H = 200;         // ขนาดแมพปัจจุบัน (ตั้งใน constructor)

export class TdWorldMap {
  constructor(scene) {
    this.s = scene;
    this.panel = $('#map-panel');
    this.M = scene.M; MAP_W = this.M.W; MAP_H = this.M.H;
    this.zoneLabels = this.computeZones();
    this.camps = this.computeCamps();
    this.timer = null;
  }

  /** จุดกึ่งกลางของแต่ละโซน (ไว้วางป้ายชื่อ) */
  computeZones() {
    const M = this.M;
    if (M.realm) return (this.s.layout.labels || []).map(([tx, ty, text], i) => ({ id: `l${i}`, tx, ty, nameTh: text, sub: i === 0 ? 'Safe Zone' : '', color: i === 0 ? '#f7dc6f' : M.color }));
    const { zoneAtTile, ZONES } = M, SPAWN = M.spawn;
    const acc = {};
    for (let y = 0; y < MAP_H; y += 2) for (let x = 0; x < MAP_W; x += 2) {
      const z = zoneAtTile(x, y); const a = (acc[z] ||= { x: 0, y: 0, n: 0 }); a.x += x; a.y += y; a.n++;
    }
    return Object.entries(acc).filter(([z]) => z !== 'outskirts').map(([z, a]) => (z === 'town' ? { id: z, tx: SPAWN.x / TILE, ty: SPAWN.y / TILE - 6, ...ZONES[z] } : { id: z, tx: a.x / a.n, ty: a.y / a.n, ...ZONES[z] }));
  }

  /** แหล่งผี: รวมจุดเกิดชนิดเดียวกันที่อยู่ใกล้กัน */
  computeCamps() {
    const out = [];
    for (const sp of this.s.layout.spawns || []) {
      if (sp.boss) continue;
      const near = out.find((c) => c.id === sp.id && Math.hypot(c.x - sp.x, c.y - sp.y) < 16 * TILE);
      if (near) { near.x = (near.x * near.n + sp.x) / (near.n + 1); near.y = (near.y * near.n + sp.y) / (near.n + 1); near.n++; }
      else out.push({ id: sp.id, x: sp.x, y: sp.y, n: 1 });
    }
    return out;
  }

  toggle() {
    if (!this.panel) return;
    const open = this.panel.classList.contains('hidden');
    this.s.ui.closeAll?.();
    if (!open) return;
    this.render();
    this.panel.classList.remove('hidden');
    this.s.sfx?.play('open');
    clearInterval(this.timer);
    this.timer = setInterval(() => { if (this.panel.classList.contains('hidden')) clearInterval(this.timer); else this.drawDynamic(); }, 500);
  }

  render() {
    MAP_W = this.M.W; MAP_H = this.M.H;
    const { zoneAtTile, ZONES } = this.M;
    this.panel.querySelector('header').innerHTML = `แผนที่ · ${esc(this.M.nameTh)} <span class="wm-hint">คลิกบนแผนที่เพื่อเดินไป · M ปิด</span> <button class="close">✕</button>`;
    this.panel.querySelector('header .close').onclick = () => this.panel.classList.add('hidden');
    const W = MAP_W * SCALE, H = MAP_H * SCALE;
    $('#world-map').className = 'world-map td-wm';
    $('#world-map').innerHTML = `
      <div class="wm-stage" style="aspect-ratio:${W}/${H}">
        <canvas class="wm-base" width="${W}" height="${H}"></canvas>
        <canvas class="wm-dyn" width="${W * 2}" height="${H * 2}"></canvas>
        <div class="wm-tags"></div>
        <div class="wm-tip hidden"></div>
      </div>
      <div class="wm-realms">${Object.values(TD_MAPS).map((m) => { const been = (this.s.visitedMaps || ['ayutthaya']).includes(m.id), here = m.id === this.M.id;
        return `<span class="${here ? 'here' : been ? 'been' : 'lock'}" title="${esc(m.sub)}">${m.icon} ${esc(m.nameTh)} <em>Lv.${m.lv[0]}–${m.lv[1]}</em>${here ? ' 📍' : been ? '' : ' 🔒'}</span>`; }).join('<b>›</b>')}</div>
      <div class="wm-legend"><span><i class="me"></i>ตัวเรา</span><span><i class="ally"></i>ผู้เล่นอื่น</span><span><i class="npc"></i>NPC</span><span><i class="boss"></i>บอส</span><span><i class="camp"></i>แหล่งผี</span><span>🌀 ประตูมิติ</span></div>`;
    const g = this.panel.querySelector('.wm-base').getContext('2d');
    g.imageSmoothingEnabled = false;
    if (this.s.groundMini) g.drawImage(this.s.groundMini, 0, 0, W, H);
    // ย้อมสีโซนจาง ๆ ให้แบ่งเขตชัด
    const zc = { field: 'rgba(171,235,198,.10)', bamboo: 'rgba(130,224,170,.12)', graveyard: 'rgba(187,143,206,.16)', swamp: 'rgba(133,193,233,.14)' };
    for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) { const c = zc[zoneAtTile(x, y)]; if (c) { g.fillStyle = c; g.fillRect(x * SCALE, y * SCALE, SCALE, SCALE); } }
    this.renderTags();
    this.drawDynamic();
    // คลิก = เดินไป · ชี้ = บอกโซน
    const stage = this.panel.querySelector('.wm-stage'), tip = this.panel.querySelector('.wm-tip');
    const toWorld = (e) => { const r = stage.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * MAP_W * TILE, y: (e.clientY - r.top) / r.height * MAP_H * TILE, px: e.clientX - r.left, py: e.clientY - r.top }; };
    stage.onmousemove = (e) => { const w = toWorld(e), z = this.M.ZONES[this.M.zoneAtTile(Math.floor(w.x / TILE), Math.floor(w.y / TILE))]; tip.classList.remove('hidden'); tip.style.left = `${w.px + 12}px`; tip.style.top = `${w.py + 8}px`; const nb = this.nearest(w.x, w.y); tip.innerHTML = `<b>${esc(z?.nameTh || '')}</b><br><small>${esc(z?.sub || '')}</small>${nb ? `<br>${esc(nb)}` : ''}`; };
    stage.onmouseleave = () => tip.classList.add('hidden');
    stage.onclick = (e) => {
      const w = toWorld(e), p = this.s.player;
      p.target = null; p.autoTarget = null;
      this.s.moveTo(w.x, w.y);
      if (!p.path?.length) return this.s.ui.toast('ไปจุดนั้นไม่ได้ (ติดน้ำ/กำแพง) ลองจุดอื่น', 'warn', 1600);
      this.s.clickMark?.(p.path[p.path.length - 1].x, p.path[p.path.length - 1].y);
      this.s.ui.toast('🚶 กำลังเดินไปจุดที่เลือก (กดเดินเอง/คลิกพื้นเพื่อยกเลิก)', '', 1800);
      this.panel.classList.add('hidden');
    };
  }

  /** ป้ายชื่อโซน/NPC/บอส/แหล่งผี (DOM ลอยบนแผนที่ · % ตามพิกัด) */
  renderTags() {
    const P = (x, y) => `left:${(x / (MAP_W * TILE) * 100).toFixed(2)}%;top:${(y / (MAP_H * TILE) * 100).toFixed(2)}%`;
    const tags = [];
    for (const z of this.zoneLabels) tags.push(`<div class="wm-zone" style="${P(z.tx * TILE, z.ty * TILE)};--c:${z.color}"><b>${esc(z.nameTh)}</b><small>${esc(z.sub)}</small></div>`);
    for (const c of this.camps) {
      const m = MONSTERS[c.id]; if (!m) continue;
      tags.push(`<div class="wm-camp" style="${P(c.x, c.y)}"><i></i><span><em>${m.level}</em></span></div>`);
    }
    for (const pt of this.s.layout.portals || []) { const T2 = TD_MAPS[pt.to]; if (T2) tags.push(`<div class="wm-boss wm-portal" style="${P(pt.x, pt.y)}"><i>🌀</i><span>${esc(T2.nameTh)} <em>Lv.${T2.reqLv}+</em></span></div>`); }
    for (const n of this.s.layout.npcs || []) tags.push(`<div class="wm-npc" style="${P(n.x, n.y)}" title="${esc(n.nameTh)} · ${esc(n.role || '')}"><i></i></div>`);
    for (const sp of (this.s.layout.spawns || []).filter((q) => q.boss)) {
      const m = MONSTERS[sp.id]; if (!m) continue;
      tags.push(`<div class="wm-boss" data-boss="${sp.id}" style="${P(sp.x, sp.y)}"><i>👑</i><span>${esc(m.nameTh)} <em>Lv.${m.level}</em><small class="st"></small></span></div>`);
    }
    this.panel.querySelector('.wm-tags').innerHTML = tags.join('');
    // ป้ายไม่ทับกัน: เรียงความสำคัญ โซน > บอส > แหล่งผี · ตัวที่ชนของที่วางแล้วซ่อนข้อความไว้ (ดูได้ตอนชี้เมาส์)
    setTimeout(() => {
      const placed = [];
      const hit = (a) => placed.some((b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top);
      for (const sel of ['.wm-zone', '.wm-boss', '.wm-camp']) for (const el of this.panel.querySelectorAll(sel)) {
        const lab = sel === '.wm-zone' ? el : el.querySelector('span');   // บอส/แหล่งผี: ซ่อนแค่ข้อความ มงกุฎ/จุดยังอยู่
        const r = lab.getBoundingClientRect();
        if (hit(r)) lab.style.visibility = 'hidden'; else placed.push(r);
      }
    }, 260);                                                   // รอหน้าต่างเปิดเสร็จ (มีอนิเมชันขยาย) ก่อนวัดขนาด
  }

  /** สิ่งที่อยู่ใกล้จุดที่ชี้ (สำหรับกล่องคำอธิบาย) */
  nearest(wx, wy) {
    const R = 7 * TILE; let best = null, bd = R;
    for (const sp of this.s.layout.spawns || []) { if (!sp.boss) continue; const d = Math.hypot(sp.x - wx, sp.y - wy); if (d < bd) { bd = d; best = `👑 ${MONSTERS[sp.id]?.nameTh} Lv.${MONSTERS[sp.id]?.level}`; } }
    for (const c of this.camps) { const d = Math.hypot(c.x - wx, c.y - wy); if (d < bd) { bd = d; best = `👻 ${MONSTERS[c.id]?.nameTh} Lv.${MONSTERS[c.id]?.level}`; } }
    for (const n of this.s.layout.npcs || []) { const d = Math.hypot(n.x - wx, n.y - wy); if (d < bd * 0.6) { bd = d / 0.6; best = `🧑 ${n.nameTh} · ${n.role || ''}`; } }
    for (const pt of this.s.layout.portals || []) { const d = Math.hypot(pt.x - wx, pt.y - wy); if (d < bd) { bd = d; best = `🌀 ประตูมิติ → ${TD_MAPS[pt.to]?.nameTh} (Lv.${TD_MAPS[pt.to]?.reqLv}+)`; } }
    return best;
  }

  /** จุดเคลื่อนไหว: ตัวเรา · ผู้เล่นอื่น · สถานะบอส */
  drawDynamic() {
    const cv = this.panel.querySelector('.wm-dyn'); if (!cv) return;
    const g = cv.getContext('2d'), k = cv.width / (MAP_W * TILE);
    g.clearRect(0, 0, cv.width, cv.height);
    const dot = (x, y, r, fill, stroke = '#000') => { g.beginPath(); g.arc(x * k, y * k, r, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); g.lineWidth = 2; g.strokeStyle = stroke; g.stroke(); };
    this.s.remotes?.forEach((r) => dot(r.x, r.y, 5, '#6ec8ff'));
    const p = this.s.player;
    if (p.path?.length) {                                   // เส้นทางที่กำลังเดิน
      g.setLineDash([6, 6]); g.strokeStyle = 'rgba(255,233,166,.85)'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(p.x * k, p.y * k);
      for (const q of p.path) g.lineTo(q.x * k, q.y * k); g.stroke(); g.setLineDash([]);
    }
    const t = Date.now() % 1000 / 1000;
    g.beginPath(); g.arc(p.x * k, p.y * k, 8 + t * 10, 0, Math.PI * 2); g.strokeStyle = `rgba(255,255,255,${1 - t})`; g.lineWidth = 2; g.stroke();
    dot(p.x, p.y, 7, '#2ecc71', '#fff');
    // บอส: มีชีวิต / รอเกิด
    for (const el of this.panel.querySelectorAll('.wm-boss[data-boss]')) {
      const m = (this.s.mobs || []).find((q) => q.def?.boss && q.spawn?.id === el.dataset.boss);
      const alive = !!m?.alive;
      el.classList.toggle('dead', !alive);
      el.querySelector('.st').textContent = alive ? ' · อยู่' : ' · รอเกิด';
    }
  }
}
