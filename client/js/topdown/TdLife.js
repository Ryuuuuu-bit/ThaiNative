// ============================================================
//  TdLife – ทักษะชีวิตในโลก top-down (กรุงศรีฯ)
//  ▸ เก็บเกี่ยว: รวงข้าว/สมุนไพรที่ขึ้นในทุ่งนอกเมือง (คลิก หรือยืนใกล้แล้วกด F) → งอกใหม่ตามเวลา
//  ▸ ตกปลา: ยืนริมน้ำ (คูเมือง/แม่น้ำ) กด F → รอทุ่นจม → กด F → มินิเกมหยุดเข็มในช่องเขียว
//  ▸ server ตรวจตำแหน่ง/เวลาเอง (econ: gather / fishBite / fishLand)
// ============================================================
import { ITEMS } from '/shared/data/items.js';
import { HERB_SPOTS, TILE, T } from '/shared/td/ayutthaya.js';
import { LIFE } from '/shared/data/life.js';

const $ = (s) => document.querySelector(s);
const GATHER_R = 30;

export class TdLife {
  constructor(scene) {
    this.s = scene;
    this.fish = null;
    this.nodes = HERB_SPOTS.map((h) => this.makeNode(h));
    this.prompt = $('#td-act');
    if (this.prompt) this.prompt.onclick = () => this.action();
  }

  // ---------------- จุดเก็บเกี่ยว ----------------
  makeNode(h) {
    const s = this.s, key = `ico_it_${h.item}`;
    let spr;
    if (s.textures.exists(key)) spr = s.add.image(h.x, h.y, key).setDisplaySize(14, 14);
    else {
      const g = s.add.graphics();
      const col = h.item === 'rice_sheaf' ? 0xf4d03f : 0x58d68d, dark = h.item === 'rice_sheaf' ? 0xb7950b : 0x1e8449;
      for (let i = -3; i <= 3; i++) { g.lineStyle(1.5, i % 2 ? dark : col).beginPath().moveTo(h.x + i, h.y + 5).lineTo(h.x + i * 2.2, h.y - 5 - Math.abs(3 - Math.abs(i))).strokePath(); }
      g.fillStyle(col).fillCircle(h.x - 5, h.y - 7, 1.6).fillCircle(h.x + 5, h.y - 7, 1.6).fillCircle(h.x, h.y - 9, 1.6);
      spr = g;
    }
    spr.setDepth(h.y - 2);
    const glow = s.add.circle(h.x, h.y + 3, 9, 0xfff3b0, 0.18).setDepth(h.y - 3);
    s.tweens.add({ targets: glow, alpha: 0.05, duration: 1100, yoyo: true, repeat: -1 });
    const hit = s.add.zone(h.x, h.y, 22, 22).setInteractive({ useHandCursor: true }).setDepth(h.y);
    const n = { ...h, spr, glow, hit, readyAt: 0 };
    hit.on('pointerdown', (ptr) => { ptr.event.stopPropagation(); this.goGather(n); });
    return n;
  }

  ready(n) { return this.s.time.now >= n.readyAt; }

  nearNode(r = GATHER_R) {
    const p = this.s.player;
    let best = null, bd = r;
    for (const n of this.nodes) { if (!this.ready(n)) continue; const d = Math.hypot(n.x - p.x, n.y - (p.y - 4)); if (d < bd) { bd = d; best = n; } }
    return best;
  }

  goGather(n) {
    const s = this.s, p = s.player;
    if (!this.ready(n)) return s.ui.toast('ยังไม่งอกใหม่ รออีกสักพัก', '', 1500);
    if (Math.hypot(n.x - p.x, n.y - p.y) <= GATHER_R + 6) return this.gather(n);
    p.target = null; this.pendingNode = n;
    s.moveTo(n.x, n.y + 6);
  }

  gather(n) {
    const s = this.s;
    if (this.busy) return;
    this.busy = true;
    s.player.setVelocity(0, 0);
    s.econ.act('gather', { node: n.i }).then((r) => {
      this.busy = false;
      if (!r.ok) { if (r.msg) s.ui.toast(r.msg, 'warn', 1500); return; }
      s.sfx.play('coin');
      n.readyAt = s.time.now + (r.respawn || 90000);
      n.spr.setAlpha(0.15); n.glow.setVisible(false);
      s.time.delayedCall(r.respawn || 90000, () => { n.spr.setAlpha(1); n.glow.setVisible(true); });
      const it = ITEMS[r.item];
      s.combat.popupText(n.x, n.y - 16, `+${it?.icon || ''}${it?.nameTh || r.item}${r.qty > 1 ? ` x${r.qty}` : ''}`);
      this.lifeUp(r.life);
      if (r.quests?.length) s.ui.result?.({ ok: true, quests: r.quests });
      s.ui.hudCache = '';
    });
  }

  lifeUp(l) {
    if (!l?.up) return;
    const L = LIFE[l.key];
    this.s.sfx.play('levelup');
    this.s.ui.banner(`${L.icon} ${L.nameTh} Lv.${l.lv}`, L.perk(l.lv));
  }

  // ---------------- ตกปลา ----------------
  /** ช่องน้ำที่ใกล้ที่สุดภายใน 2 ช่อง (ใช้วางทุ่น) */
  waterNear() {
    const p = this.s.player, g = this.s.layout.ground;
    const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
    let best = null, bd = 99;
    for (let y = ty - 2; y <= ty + 2; y++) for (let x = tx - 2; x <= tx + 2; x++) {
      const t = g[y]?.[x];
      if (t !== T.WATER && t !== T.WATER2) continue;
      const d = Math.hypot(x - tx, y - ty);
      if (d < bd) { bd = d; best = { x: x * TILE + 8, y: y * TILE + 8 }; }
    }
    return best;
  }

  startFishing(w) {
    const s = this.s, p = s.player;
    s.ui.closeAll?.();
    p.setVelocity(0, 0); p.path = []; p.target = null;
    const line = s.add.graphics().setDepth(p.y + 1);
    const bob = s.add.circle(w.x, w.y, 2, 0xe74c3c).setStrokeStyle(1, 0xffffff).setDepth(p.y + 1);
    this.fish = { stage: 'wait', line, bob, bobX: w.x, bobY: w.y, biteAt: s.time.now + 2200 + Math.random() * 4500, px: p.x, py: p.y };
    s.sfx.play('swing');
    this.showBar(false);
    $('#fish-ui').classList.remove('hidden');
    $('#fish-msg').textContent = 'รอปลากินเหยื่อ… (กด F อีกครั้งเพื่อเก็บเบ็ด)';
  }

  press() {
    const f = this.fish, s = this.s;
    if (!f) return;
    if (f.stage === 'wait') return this.stop('เก็บเบ็ดแล้ว');
    if (f.stage === 'bite') {
      if (f.asking) return;
      f.asking = true;
      s.econ.act('fishBite').then((r) => {
        if (this.fish !== f) return;
        f.asking = false;
        if (!r.ok) { f.stage = 'wait'; f.biteAt = s.time.now + 1500 + Math.random() * 3500; $('#fish-msg').textContent = r.msg || 'ปลาหนีไปแล้ว… รอตัวใหม่'; return; }
        f.stage = 'reel'; f.catch = { id: r.fish, hard: r.hard };
        f.zoneW = 0.34 - r.hard * 0.24; f.zoneX = 0.1 + Math.random() * (0.8 - f.zoneW);
        f.speed = 0.7 + r.hard * 1.1; f.pos = 0; f.dir = 1; f.tries = 3;
        this.showBar(true);
        $('#fish-msg').textContent = 'กด F เมื่อเข็มอยู่ในช่องสีเขียว!';
        s.sfx.play('click');
      });
      return;
    }
    if (f.stage === 'reel') {
      if (f.pos >= f.zoneX && f.pos <= f.zoneX + f.zoneW) return this.land();
      f.tries--; s.sfx.play('error'); s.cameras.main.shake(80, 0.002);
      if (f.tries <= 0) { s.econ.act('fishLose'); return this.stop('ปลาหลุดเบ็ดไปแล้ว…', 'warn'); }
      $('#fish-msg').textContent = `พลาด! เหลือโอกาสอีก ${f.tries} ครั้ง`;
    }
  }

  land() {
    const f = this.fish, s = this.s;
    f.stage = 'landing';
    s.econ.act('fishLand').then((r) => {
      if (!r.ok) return this.stop(r.msg || 'ปลาหลุดเบ็ดไปแล้ว…', 'warn');
      const it = ITEMS[r.id];
      s.sfx.play(r.id === 'junk_boot' ? 'error' : 'coin');
      s.combat.popupText(f.bobX, f.bobY - 12, `${it.icon} ${it.nameTh}${r.bonus ? ' x2' : ''}`);
      if (['pla_buek', 'pla_phrai'].includes(r.id)) { s.ui.banner(`🎣 ได้ ${it.icon} ${it.nameTh}!!`); s.sfx.play('levelup'); }
      if (r.quests?.length) s.ui.result?.({ ok: true, quests: r.quests });
      this.lifeUp(r.life);
      this.stop(`ได้ ${it.icon} ${it.nameTh}${r.bonus ? ' 2 ตัว! (ฝีมือตกปลา)' : ''}${r.id === 'junk_boot' ? ' (ซวยจัง)' : ''}`);
      s.ui.hudCache = '';
    });
  }

  stop(msg, type) {
    const f = this.fish;
    if (!f) return;
    if (f.stage === 'reel') this.s.econ.act('fishLose');
    f.line.destroy(); f.bob.destroy();
    this.fish = null;
    $('#fish-ui').classList.add('hidden');
    if (msg) this.s.ui.toast(msg, type);
  }

  showBar(on) {
    $('#fish-bar').classList.toggle('hidden', !on);
    if (on) { $('#fish-zone').style.left = `${this.fish.zoneX * 100}%`; $('#fish-zone').style.width = `${this.fish.zoneW * 100}%`; }
  }

  // ---------------- ปุ่ม F / ปุ่มบนจอ ----------------
  /** คืน true ถ้าจัดการปุ่ม F แล้ว */
  action() {
    if (this.fish) { this.press(); return true; }
    const n = this.nearNode();
    if (n) { this.gather(n); return true; }
    const w = this.waterNear();
    if (w) { this.startFishing(w); return true; }
    return false;
  }

  update(time, dt) {
    const s = this.s, p = s.player;
    // เดินไปถึงจุดเก็บแล้ว
    if (this.pendingNode && !p.path.length) {
      const n = this.pendingNode; this.pendingNode = null;
      if (Math.hypot(n.x - p.x, n.y - p.y) <= GATHER_R + 10) this.gather(n);
    }
    // ป้ายปุ่มลัด
    if (this.prompt) {
      let label = '';
      if (this.fish) label = this.fish.stage === 'reel' ? '🎣 กด F / แตะ: ดึง!' : this.fish.stage === 'bite' ? '❗ กด F / แตะ!' : '🎣 เก็บเบ็ด (F)';
      else if (this.nearNode()) label = '🌾 เก็บเกี่ยว (F)';
      else if (!s.nearestNpc?.(60) && this.waterNear()) label = '🎣 ตกปลา (F)';
      if (this.prompt.dataset.l !== label) { this.prompt.dataset.l = label; this.prompt.textContent = label; this.prompt.classList.toggle('hidden', !label); }
    }
    const f = this.fish;
    if (!f) return;
    if (!p.alive || Math.hypot(p.x - f.px, p.y - f.py) > 6) return this.stop('เลิกตกปลา');
    if (f.stage === 'landing') return;
    let by = f.bobY + Math.sin(time / 300);
    if (f.stage === 'wait' && time >= f.biteAt) {
      f.stage = 'bite'; f.biteEnd = time + 1100;
      $('#fish-msg').textContent = '❗ ปลากินเบ็ด! กด F เร็ว!';
      s.sfx.play('hit');
      s.combat.popupText(f.bobX, f.bobY - 12, '!');
    }
    if (f.stage === 'bite') {
      by += Math.sin(time / 40) * 2;
      if (time > f.biteEnd) { f.stage = 'wait'; f.biteAt = time + 1500 + Math.random() * 3500; $('#fish-msg').textContent = 'ช้าไป ปลาหนีไปแล้ว… รอตัวใหม่'; }
    }
    if (f.stage === 'reel') {
      f.pos += f.dir * f.speed * dt;
      if (f.pos > 1) { f.pos = 1; f.dir = -1; } else if (f.pos < 0) { f.pos = 0; f.dir = 1; }
      $('#fish-needle').style.left = `${f.pos * 100}%`;
      by += Math.sin(time / 60) * 1.5;
    }
    f.bob.setPosition(f.bobX, by);
    const rx = p.x + (f.bobX > p.x ? 6 : -6), ry = p.y - 22;
    f.line.clear().lineStyle(1, 0xecf0f1, 0.75).beginPath().moveTo(rx, ry);
    const midX = (rx + f.bobX) / 2, midY = Math.max(ry, by) - 6;
    for (let i = 1; i <= 8; i++) {
      const t = i / 8, x = (1 - t) * (1 - t) * rx + 2 * (1 - t) * t * midX + t * t * f.bobX, y = (1 - t) * (1 - t) * ry + 2 * (1 - t) * t * midY + t * t * by;
      f.line.lineTo(x, y);
    }
    f.line.strokePath();
  }
}
