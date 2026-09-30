// ============================================================
//  NpcLife – ชีวิตของ NPC ในเมือง (ฝั่ง client ล้วน · ไม่มีผลกับเกม)
//  ▸ ป้ายบริการลอยเหนือหัว (🛒 ร้าน · ⚒ ตีบวก · 🌀 วาร์ป …) มองไกลก็รู้ว่าใครทำอะไร
//  ▸ ชี้เมาส์ที่ NPC → ป้ายเล็ก: ชื่อ · บทบาท · ปุ่มลัด (คลิก/F คุย · คลิกขวา ทางลัด)
//  ▸ เดินไปมาในรัศมีเล็กๆ รอบจุดประจำ (ผู้เล่นเข้าใกล้ = หยุดหันมามอง) · ทักผู้เล่นที่เดินผ่านตามช่วงเวลา
// ============================================================
import { playDir, stableDir, hasDir8 } from './Dir8.js';
import { makeText, ICONS } from '../systems/util.js';

// ป้ายบริการ: ไอคอนพิกเซล ui_* (มีอีโมจิสำรอง) · ผู้ใหญ่ชัยใช้ป้าย !/? ของเควสเดิม
export const SERVICE = {
  market: ['exchange', '⚓', 'ตลาดฝากขาย·แลกของ'], travel: ['gift', '🎁', 'ของหายากจำนวนจำกัด'],
  shop: ['shop', '🛒', 'ร้านยา·ของใช้'], smith: ['anvil', '⚒', 'ตีบวก·สร้างอุปกรณ์'], tailor: ['thai_dress', '🧵', 'รับซื้อผ้า·ของ'], cook: ['soup', '🍲', 'ทำอาหาร'],
  kru_sword: ['swords', '⚔', 'ร้านอุปกรณ์สายดาบ'], kru_mage: ['job_mage', '🔮', 'ร้านอุปกรณ์สายอาคม'], kru_archer: ['job_archer', '🏹', 'ร้านอุปกรณ์สายพราน'],
  kru_boxer: ['job_boxer', '🥊', 'ร้านอุปกรณ์สายมวย'], kru_healer: ['herb', '🌿', 'ร้านอุปกรณ์สายหมอยา'],
  warp: ['portal', '🌀', 'วาร์ปต่างแดน'], crypt: ['skull', '💀', 'สุสานใต้ดิน'], wbguide: ['eclipse', '🌑', 'ข้อมูลบอสโลก'],
};
/** ทางลัดคลิกขวา (ตัวที่ไม่มี = คลิกขวาเหมือนคลิกซ้าย) */
export const QUICK = { quest: 'ดูกระดานเควส', warp: 'เปิดประตูมิติ', crypt: 'ลงสุสานใต้ดิน' };

const rnd = (a, b) => a + Math.random() * (b - a);
const pickOne = (a) => a[Math.floor(Math.random() * a.length)];
const isTouch = () => document.body.classList.contains('touch') || document.body.classList.contains('touch-dev') || document.body.classList.contains('m-hud');

/** คำทักตามช่วงเวลาในเกม ({n} = ชื่อผู้เล่น) */
const GREET = {
  morning: ['อรุณสวัสดิ์ {n} ตื่นเช้าจริงนะ', 'เช้านี้อากาศดี ออกล่าผีกันไหม {n}', 'กินข้าวเช้ามารึยังล่ะ {n}'],
  noon: ['แดดร้อนนัก อย่าลืมพกน้ำนะ {n}', 'สวัสดีจ้ะ {n} วันนี้ล่าได้เยอะไหม', 'เที่ยงแล้ว แวะพักก่อนก็ได้นะ {n}'],
  evening: ['ใกล้ค่ำแล้ว ผีเริ่มออกนะ {n} ระวังตัวด้วย', 'ตะวันจะตกแล้ว เตรียมยาให้พร้อมนะ {n}', 'ค่ำนี้ลมเย็นดีนะ {n}'],
  night: ['ดึกแล้วยังไม่นอนอีกหรือ {n}', 'คืนนี้ผีดุ ออกนอกเมืองระวังด้วยนะ {n}', 'เดินดึกๆ อย่าลืมถือตะเกียงนะ {n}'],
};
/** คำทักเฉพาะตัว (สุ่มแทนคำทักตามเวลาบ้าง) */
const OWN = {
  shop: ['แวะซื้อยาก่อนออกไปล่าผีไหมหลาน', 'ยาหมดเมื่อไหร่ มาหายายนะ'],
  smith: ['เอาอาวุธมาตีบวกหน่อยไหม ไฟเตากำลังร้อน', 'เหล็กน้ำพี้ของลุงคมที่สุดในกรุง'],
  tailor: ['วันนี้แม่รับซื้อผ้าราคาดีนะจ๊ะ', 'ผ้าไหมจากเมืองจีนสวยจริง ๆ'],
  cook: ['หิวรึยังลูก ป้าเพิ่งตั้งหม้อแกง', 'กินอิ่มแล้วค่อยไปสู้ผี แรงจะได้ดี'],
  quest: ['ชาวบ้านเดือดร้อนเรื่องผีอีกแล้ว มาช่วยหน่อยสิ', 'มีงานให้ทำนะ แวะมาดูกระดานเควสได้'],
  warp: ['ประตูมิติเปิดรออยู่ ใจกล้าพอรึเปล่า', 'แดนอื่นมีผีที่เจ้ายังไม่เคยเห็น'],
  crypt: ['สุสานข้างล่างลึกร้อยชั้น กล้าลงไหม', 'ของดีอยู่ใต้ดิน แต่ผีก็ดุนะ'],
};
const period = (h) => (h >= 5 && h < 11 ? 'morning' : h >= 11 && h < 17 ? 'noon' : h >= 17 && h < 20 ? 'evening' : 'night');

export class NpcLife {
  constructor(scene) {
    this.s = scene; this.greetAt = new Map(); this.lastGreet = 0; this.tip = null; this.tipNpc = null;
    scene.events.once('shutdown', () => { this.tip?.remove(); this.tip = null; });
  }

  /** เรียกหลังสร้าง NPC แต่ละตัว: ป้ายบริการ + สถานะเดินเล่น · คืน y ขอบบนของป้ายบริการ (ถ้ามี) */
  attach(n, plateTop) {
    const s = this.s, spr = n.spr;
    n._home = { x: n.x, y: n.y }; n._wait = rnd(1500, 6000); n._to = null; n._walking = false;
    n._follow = [];                                                     // ของที่ลอยตามตัว (ป้ายชื่อ/ป้ายบริการ/ป้ายเควส) → ขยับตาม x
    if (n._box) n._follow.push(n._box);
    n._canWalk = hasDir8(s, spr.d8id, 'walk');
    const sv = SERVICE[n.id];
    if (!sv) return plateTop;
    const [ik, emo] = sv, y0 = plateTop - 10;
    const g = s.add.graphics();
    g.fillStyle(0x140a1c, 0.92).fillCircle(0, 0, 8).lineStyle(1.5, 0xf4d03f, 1).strokeCircle(0, 0, 8);
    const box = s.add.container(n.x, y0, [g]).setDepth(n.y + 3);
    const tk = `ui_${ik}`, url = ICONS[tk];
    const put = () => { if (!box.scene) return; box.add(s.add.image(0, 0, tk).setDisplaySize(12, 12)); };
    if (url) {
      if (s.textures.exists(tk)) put();
      else { s.load.image(tk, url); s.load.once(`filecomplete-image-${tk}`, put); if (!s.load.isLoading()) s.load.start(); }
    } else box.add(makeText(s, 0, 1, emo, { fontSize: '9px' }).setOrigin(0.5));
    s.tweens.add({ targets: box, y: y0 - 3, duration: 900 + Math.random() * 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    n._svc = box; n._follow.push(box);
    return y0 - 9;
  }

  // ---------------- ป้ายชี้เมาส์ (PC) ----------------
  hover(n, ptr) {
    if (isTouch()) return;
    let el = this.tip;
    if (!el) { el = this.tip = document.createElement('div'); el.id = 'npc-tip'; el.className = 'npc-tip hidden'; document.getElementById('td-hud')?.appendChild(el) || document.body.appendChild(el); }
    if (this.tipNpc !== n) {
      this.tipNpc = n;
      const shop = !!this.s.npcShop?.(n.id), q = QUICK[n.id], sv = SERVICE[n.id];
      const main = shop ? 'เปิดร้าน' : n.id === 'quest' ? 'คุย · รับเควส' : 'คุย';
      const right = n.id === 'market' ? 'กล่องรับของทันที' : n.id === 'travel' ? '' : shop ? 'ขายของทันที' : q ? `${q}ทันที` : '';
      el.innerHTML = `<b>${n.nameTh}</b><small>${n.role || sv?.[2] || ''}</small>
        <div class="nt-keys"><span><kbd>คลิก</kbd><kbd>F</kbd> ${main}</span>${right ? `<span><kbd>คลิกขวา</kbd> ${right}</span>` : ''}</div>`;
    }
    this.moveTip(ptr);
    el.classList.remove('hidden');
  }
  moveTip(ptr) {
    const el = this.tip; if (!el || !ptr?.event) return;
    const r = el.parentElement.getBoundingClientRect(), e = ptr.event;
    let x = e.clientX - r.left + 14, y = e.clientY - r.top + 16;
    if (x + el.offsetWidth > r.width - 4) x = e.clientX - r.left - el.offsetWidth - 10;
    if (y + el.offsetHeight > r.height - 4) y = e.clientY - r.top - el.offsetHeight - 10;
    el.style.left = `${x}px`; el.style.top = `${y}px`;
  }
  unhover(n) { if (this.tipNpc && n && this.tipNpc !== n) return; this.tip?.classList.add('hidden'); this.tipNpc = null; }

  // ---------------- เดินเล่น + ทัก ----------------
  update(time, dtMs) {
    const s = this.s, p = s.player; if (!s.npcs?.length || !p) return;
    const dt = dtMs / 1000, busy = s.ui.anyOpen?.() || s.npcDlg?.open;
    // ป้ายชี้เมาส์: กล้องเลื่อน/NPC เดินออกจากใต้เมาส์ หรือเปิดหน้าต่าง → ซ่อน
    if (this.tipNpc) {
      const ptr = s.input.activePointer, w = s.cameras.main.getWorldPoint(ptr.x, ptr.y), sp = this.tipNpc.spr;
      if (busy || !sp?.active || !sp.getBounds().contains(w.x, w.y)) this.unhover();
    }
    for (const n of s.npcs) {
      const spr = n.spr; if (!spr?.active) continue;
      const dx = p.x - spr.x, dy = p.y - spr.y, d2 = dx * dx + dy * dy;
      const near = p.alive && d2 < 90 * 90;
      // ผู้เล่นเข้าใกล้ / กำลังคุย → หยุดเดิน (ตัวหันมามองจัดการโดย scene)
      if (near || busy || !n._canWalk) { if (n._walking) { n._walking = false; n._to = null; n._wait = rnd(2500, 6000); playDir(spr, 'idle', spr.dir || 'south'); } }
      else if (n._wait > 0) n._wait -= dtMs;
      else {
        if (!n._to) {                                                   // จุดใหม่รอบบ้าน (ส่วนใหญ่ซ้าย-ขวา ไม่ไกลจนคุยไม่ถึง)
          const h = n._home; n._to = Math.random() < 0.35 ? { x: h.x, y: h.y } : { x: h.x + rnd(-14, 14), y: h.y + rnd(-3, 3) };
        }
        const tx = n._to.x - spr.x, ty = n._to.y - spr.y, d = Math.hypot(tx, ty), step = 16 * dt;
        if (d <= step || d < 0.5) {
          spr.setPosition(n._to.x, n._to.y); n._to = null; n._walking = false; n._wait = rnd(3000, 9000);
          playDir(spr, 'idle', Math.random() < 0.7 ? 'south' : pickOne(['south-east', 'south-west']));
        } else {
          spr.x += (tx / d) * step; spr.y += (ty / d) * step; n._walking = true;
          playDir(spr, 'walk', stableDir(tx, ty, spr.dir || 'south'));
        }
        spr.setDepth(spr.y);
        for (const o of n._follow) { o.x = spr.x; o.setDepth?.(spr.y + (o === n._box ? 2 : 3)); }
      }
      // ทักผู้เล่นที่เดินผ่าน (ตัวละ 2 นาที · ทั้งเมืองห่างกันอย่างน้อย 6 วิ)
      if (near && !busy && d2 < 70 * 70 && time - (this.greetAt.get(n.id) || -1e9) > 120000 && time - this.lastGreet > 6000) {
        this.greetAt.set(n.id, time); this.lastGreet = time;
        this.say(n, this.greetLine(n));
      }
    }
  }

  greetLine(n) {
    const name = this.s.player?.char?.name || 'หลาน';
    const pool = OWN[n.id] && Math.random() < 0.5 ? OWN[n.id] : GREET[period(this.s.atmo?.hour ?? 12)];
    return pickOne(pool).replace('{n}', name);
  }

  /** ฟองคำพูดเหนือป้าย NPC */
  say(n, text) {
    const s = this.s, spr = n.spr;
    spr._bubbleTop = () => Math.min(n._svc ? n._svc.y - 9 : Infinity, n._box ? n._box.y - (n._plateH || 16) : spr.y - spr.displayHeight) - 2;
    s.bubbleOn?.(spr, text);
  }
}
