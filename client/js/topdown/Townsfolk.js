// ============================================================
//  ชาวกรุง – ชาวบ้านเดินไปมาในเกาะเมืองอยุธยา (ฝั่ง client ล้วน · ตกแต่ง ไม่มีผลกับเกม)
//  ▸ เดินตามเครือข่ายถนน (โหนดพิกัดไทล์ท้องถิ่นของผังเมือง) หยุดพักเป็นระยะ
//  ▸ กลางคืนคนบางตา ส่วนหนึ่งไปนั่งที่ลานอาหาร
// ============================================================
import { OX, TILE } from '/shared/td/ayutthaya.js';
import { playDir, stableDir, hasDir8 } from './Dir8.js';
import { makeText } from '../systems/util.js';

// โหนดถนน [x, y] (ไทล์ท้องถิ่น) · rest = จุดแวะพักนานกว่า
const N = {
  A: [60, 38], B: [41, 38], C: [80, 38], I: [60, 40],
  F: [49, 50], G: [71, 50], H: [60, 60], D: [41, 50], E: [80, 50], Y: [24, 50], Z: [98, 50],
  U: [68, 56], V: [92, 56], W: [96, 56],
  J: [41, 68], K: [60, 68], L: [80, 68], M: [92, 68], Nn: [96, 68],
  KC: [60, 75], FC: [69, 75],
  O: [41, 79], T: [27, 79], P: [60, 79], Q: [80, 79], R: [92, 79], S: [96, 79], X: [60, 84],
};
const EDGES = 'A-B A-C A-I B-D C-E I-F I-G F-H G-H D-F E-G D-Y E-Z H-U G-U U-V V-W W-Nn Nn-S E-L L-M M-Nn L-Q Q-R R-S H-K K-J K-L J-O O-T O-P K-KC KC-P KC-FC P-Q P-X D-J'
  .split(' ').map((e) => e.split('-'));
const ADJ = {};
for (const [a, b] of EDGES) { (ADJ[a] ||= []).push(b); (ADJ[b] ||= []).push(a); }
const REST = { FC: [9000, 20000], X: [3000, 8000], F: [2000, 7000], G: [2000, 7000], M: [2000, 6000], J: [1500, 5000] };
const NAMES = ['นายมั่น', 'แม่อิ่ม', 'ตาจันทร์', 'อีแย้ม', 'นายเผือก', 'แม่ปริก', 'ไอ้ทองดี', 'ยายเนียม', 'นายบุญมา', 'แม่จำปา', 'พ่อสิงห์', 'อีเอื้อน'];
const BASE = ['hero_male_mohom', 'hero_female_ruenton'];
const EXTRA = ['hero_female_silk', 'hero_male_isan', 'hero_female_chaona'];   // โหลดเพิ่มแค่ 3 ชุด (~1 MB/ชุด)
const px = (k) => ({ x: (N[k][0] + OX) * TILE + 8, y: N[k][1] * TILE + 8 });
const rnd = (a, b) => a + Math.random() * (b - a);
const isTouch = () => document.body.classList.contains('touch') || document.body.classList.contains('touch-dev');

export class Townsfolk {
  constructor(scene) {
    this.s = scene; this.folk = []; this.extraReady = false;
    this.count = isTouch() ? 6 : 10;
  }

  /** เรียกหลังสร้างแมพ: มีชาวบ้านเฉพาะอยุธยา */
  build() {
    this.clear();
    if (this.s.M?.id !== 'ayutthaya') return;
    const keys = Object.keys(N);
    for (let i = 0; i < this.count; i++) {
      const at = keys[(i * 7 + 3) % keys.length], p = px(at);
      const spr = this.s.add.sprite(p.x + rnd(-6, 6), p.y + rnd(-4, 4), 'npc_maekha', 'idle_0').setOrigin(0.5, 1).setDepth(p.y);
      spr.legacyKey = 'npc_maekha'; spr.d8id = BASE[i % 2]; spr.scaleMul = 0.95;
      playDir(spr, 'idle', 'south');
      const shadow = this.s.addShadow(spr, 18);
      const tag = makeText(this.s, p.x, p.y, NAMES[i % NAMES.length], { fontSize: '6px', color: '#d5d8dc' }).setOrigin(0.5, 1).setAlpha(0.75);
      this.folk.push({ spr, shadow, tag, node: at, prev: null, to: null, wait: rnd(0, 4000), speed: rnd(26, 36), night: i % 2 === 1, want: i >= 2 && i < 8 ? EXTRA[(i - 2) % EXTRA.length] : null });
    }
    // ชุดอื่นๆ (โหลดทีหลัง เฉพาะเครื่องที่ไม่ใช่มือถือ) → ชาวบ้านหน้าตาไม่ซ้ำกัน
    if (!isTouch()) this.s.time.delayedCall(9000, () => this.loadExtras());
  }

  loadExtras() {
    for (const f of this.folk) {
      if (!f.want || !this.s.loadHero) continue;
      this.s.loadHero(f.want).then((ok) => { if (ok && f.spr.active && hasDir8(this.s, f.want)) { f.spr.d8id = f.want; f.spr._d8 = null; } });
    }
  }

  clear() {
    for (const f of this.folk) { f.spr.destroy(); f.tag.destroy(); f.shadow.destroy(); }
    if (this.folk.length) this.s.shadows = this.s.shadows.filter((sh) => sh.obj.scene);
    this.folk = [];
  }

  /** ไปโหนดถัดไป (ไม่ย้อนกลับทางเดิมถ้ามีทางอื่น) · กลางคืนชาวบ้านกะดึกมุ่งหน้าลานอาหาร */
  pick(f, dark) {
    const nb = ADJ[f.node] || [];
    let opts = nb.filter((k) => k !== f.prev);
    if (!opts.length) opts = nb;
    if (dark && f.night) { const toward = opts.find((k) => k === 'FC' || k === 'KC' || k === 'K' || k === 'P'); if (toward && Math.random() < 0.7) return toward; }
    return opts[Math.floor(Math.random() * opts.length)];
  }

  update(dtMs) {
    if (!this.folk.length) return;
    const dark = (this.s.atmo?.light ?? 1) < 0.35, dt = dtMs / 1000;
    const cam = this.s.cameras.main.worldView;
    for (const f of this.folk) {
      const s = f.spr;
      // กลางคืน: ครึ่งหนึ่งกลับบ้าน (จางหาย) · อีกครึ่งเดินไปลานอาหาร
      const show = !dark || f.night;
      if (show !== s.visible) { s.setVisible(show); f.tag.setVisible(show); f.shadow.setVisible(show); }
      if (!show) continue;
      if (f.wait > 0) { f.wait -= dtMs; if (s.anims.currentAnim?.key?.includes(':walk:')) playDir(s, 'idle', s.dir || 'south'); }
      else {
        if (!f.to) { const nx = this.pick(f, dark); f.prev = f.node; f.node = nx; const p = px(nx); f.to = { x: p.x + rnd(-8, 8), y: p.y + rnd(-6, 6) }; }
        const dx = f.to.x - s.x, dy = f.to.y - s.y, d = Math.hypot(dx, dy), step = f.speed * dt;
        if (d <= step) {
          s.setPosition(f.to.x, f.to.y); f.to = null;
          const r = REST[f.node];
          f.wait = r ? rnd(r[0], r[1]) * (dark && f.node === 'FC' ? 2 : 1) : Math.random() < 0.35 ? rnd(600, 3000) : 0;
        } else {
          s.x += (dx / d) * step; s.y += (dy / d) * step;
          playDir(s, 'walk', stableDir(dx, dy, s.dir || 'south'));
        }
      }
      s.setDepth(s.y);
      // ป้ายชื่อเฉพาะตัวที่อยู่ในจอ (ประหยัดงานวาด)
      const onScreen = s.x > cam.x - 40 && s.x < cam.right + 40 && s.y > cam.y - 40 && s.y < cam.bottom + 60;
      if (onScreen) f.tag.setPosition(s.x, s.y - s.displayHeight - 1).setDepth(s.y + 1);
      f.tag.setVisible(onScreen);
    }
  }
}
