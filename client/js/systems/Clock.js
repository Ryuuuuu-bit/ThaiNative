// ============================================================
//  Clock – เวลาในเกม (ซิงก์กับนาฬิกา server) + แสงกลางวัน–กลางคืน
//  ▸ ท้องฟ้ากลางวัน/กลางคืน, ม่านความมืด, แสงตะเกียง, หิ่งห้อย
//  ▸ แจ้งเตือนเมื่อค่ำ/รุ่งเช้า/คืนเดือนดับ และให้ตัวคูณความดุของผี
// ============================================================
import { DAY_MS_DEFAULT, dayPhase, dayIndex, periodOf, daylight, moonOf, nightMods, clockText, isNight } from '/shared/data/world.js';
import { WORLD } from '/shared/constants.js';

const $ = (s) => document.querySelector(s);

export class Clock {
  constructor(scene) {
    this.scene = scene;
    this.offset = 0;                 // เวลา server − เวลาเครื่องเรา
    this.dayMs = DAY_MS_DEFAULT;
    this.synced = false;
    this.lanterns = [];
    this.buildVisuals();
    this.tick(true);
  }

  /** เรียกเมื่อได้เวลาจาก server (world:init / snapshot) */
  sync(serverT, dayMs) {
    if (dayMs) this.dayMs = dayMs;
    const off = serverT - Date.now();
    this.offset = this.synced ? this.offset * 0.9 + off * 0.1 : off;   // กันกระตุกจาก latency
    this.synced = true;
  }

  get now() { return Date.now() + this.offset; }
  get phase() { return dayPhase(this.now, this.dayMs); }
  get period() { return periodOf(this.phase); }
  get night() { return isNight(this.phase); }
  get moon() { return moonOf(dayIndex(this.now + this.dayMs * 0.25, this.dayMs)); }  // คืนนับต่อเนื่องข้ามเที่ยงคืน
  get mods() { return nightMods(this.phase, this.moon); }
  get light() { return daylight(this.phase); }

  // ------------------------------------------------------------
  buildVisuals() {
    const s = this.scene;
    // ท้องฟ้ากลางวัน (ซ้อนบนฟ้ากลางคืน แล้วปรับความโปร่งใส)
    if (!s.textures.exists('bg_sky_day')) {
      const c = document.createElement('canvas'); c.width = 480; c.height = 270;
      const g = c.getContext('2d');
      const grd = g.createLinearGradient(0, 0, 0, 270);
      grd.addColorStop(0, '#5dade2'); grd.addColorStop(0.6, '#aed6f1'); grd.addColorStop(1, '#fdebd0');
      g.fillStyle = grd; g.fillRect(0, 0, 480, 270);
      g.fillStyle = 'rgba(255,255,255,0.8)';                          // เมฆ
      for (const [x, y, w] of [[60, 50, 60], [230, 36, 80], [380, 64, 50]]) {
        g.beginPath(); g.ellipse(x, y, w / 2, 8, 0, 0, 7); g.ellipse(x + w * 0.2, y - 6, w / 3, 8, 0, 0, 7); g.fill();
      }
      g.fillStyle = '#fef9e7'; g.beginPath(); g.arc(400, 40, 16, 0, 7); g.fill();   // ดวงอาทิตย์
      s.textures.addCanvas('bg_sky_day', c);
    }
    this.daySky = s.add.image(480, 270, 'bg_sky_day').setScrollFactor(0).setDepth(-9.8);
    this.dusk = s.add.rectangle(480, 270, 480, 270, 0xf0803c, 0).setScrollFactor(0).setDepth(-9.7);
    // ม่านความมืดคลุมโลก (อยู่ใต้ตัวเลขดาเมจ/ข้อความ)
    this.dark = s.add.rectangle(480, 270, 480, 270, 0x0b0626, 0).setScrollFactor(0).setDepth(30);

    // แสงตะเกียง/คบไฟ (สว่างเฉพาะกลางคืน)
    s.children.list.filter((o) => o.texture?.key === 'lantern').forEach((l) => {
      const glow = s.add.circle(l.x, l.y - 24, 18, 0xf5b041, 0).setDepth(31).setBlendMode(Phaser.BlendModes.ADD);
      this.lanterns.push(glow);
    });

    // หิ่งห้อยกลางคืน
    this.fireflies = s.add.particles(0, 0, 'particle', {
      x: { min: 0, max: 480 }, y: { min: 120, max: 250 }, lifespan: 2600, speedX: { min: -8, max: 8 }, speedY: { min: -10, max: 4 },
      scale: { start: 0.35, end: 0 }, alpha: { start: 1, end: 0 }, tint: [0xf9e79f, 0xabebc6], frequency: 180, blendMode: 'ADD',
    }).setScrollFactor(0).setDepth(32);
    this.fireflies.stop();
  }

  /** เรียกทุกเฟรม */
  tick(first = false) {
    const s = this.scene, L = this.light;
    const ph = this.phase, h = (ph * 24 + 6) % 24;
    this.daySky.setAlpha(L);
    // แสงอัสดง/รุ่งอรุณ
    const glow = h >= 16 && h < 20 ? Math.sin(((h - 16) / 4) * Math.PI) : h >= 4.5 && h < 8 ? Math.sin(((h - 4.5) / 3.5) * Math.PI) * 0.7 : 0;
    this.dusk.setAlpha(glow * 0.35);
    const moon = this.moon;
    const darkA = (1 - L) * (moon.id === 'dark' ? 0.62 : moon.id === 'full' ? 0.36 : 0.5);
    this.dark.setAlpha(darkA);
    this.dark.fillColor = moon.id === 'dark' ? 0x14041c : 0x0b0626;
    const t = s.time.now;
    this.lanterns.forEach((g, i) => g.setAlpha((1 - L) * (0.45 + Math.sin(t / 180 + i * 1.7) * 0.08)).setScale(1 + Math.sin(t / 240 + i) * 0.06));
    // หิ่งห้อยเฉพาะกลางคืนในป่า
    const wantFlies = L < 0.3 && s.player?.x > WORLD.townEndX - 200;
    if (wantFlies && !this.fireflies.emitting) this.fireflies.start();
    else if (!wantFlies && this.fireflies.emitting) this.fireflies.stop();
    // ตัวผืนหลัง: มืดลงตอนกลางคืน
    const tint = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(0x6f6490), Phaser.Display.Color.ValueToColor(0xffffff), 100, Math.round(L * 100));
    const tc = Phaser.Display.Color.GetColor(tint.r, tint.g, tint.b);
    [s.bgFar, s.bgMid, s.bgTown].forEach((o) => o?.setTint(tc));

    // HUD นาฬิกา
    const per = this.period;
    const label = `${per.icon} ${clockText(ph)}${per.id === 'night' && moon.nameTh ? ' · ' + moon.icon + ' ' + moon.nameTh : ''}`;
    if (label !== this.lastLabel) { this.lastLabel = label; const el = $('#clock'); if (el) el.textContent = label; }

    // แจ้งเตือนเมื่อเปลี่ยนช่วง
    if (per.id !== this.lastPeriod) {
      if (!first && this.lastPeriod) {
        if (per.id === 'night') {
          if (moon.id === 'dark') s.ui.banner('🌑 คืนเดือนดับ! ผีดุเป็นพิเศษ · EXP x2');
          else if (moon.id === 'full') s.ui.banner('🌕 คืนวันพระ · รางวัลจากผี x1.5');
          else s.ui.banner('🌙 ตกกลางคืน… ผีดุขึ้น แต่ให้ EXP มากขึ้น');
          s.sfx.play('nightfall');
          s.ui.toast('กระสือและผีพรายออกหากินเฉพาะกลางคืน');
        } else if (per.id === 'morning') {
          s.ui.banner('🌅 รุ่งเช้าแล้ว');
          s.sfx.play('rooster');
        }
      }
      this.lastPeriod = per.id;
    }
  }
}
