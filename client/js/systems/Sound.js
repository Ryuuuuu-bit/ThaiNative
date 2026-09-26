// ============================================================
//  Sound – เสียงเอฟเฟกต์ + เพลงประกอบ สังเคราะห์สดด้วย Web Audio
//  (ไม่ต้องมีไฟล์เสียง)  เพลงใช้บันไดเสียงเพนทาโทนิกแบบไทย
//  ▸ sound.play('slash')   ▸ sound.music('town' | 'wild' | 'boss' | null)
//  ▸ ถ้าอยากใช้ไฟล์เสียงจริง ใส่ .ogg ใน client/assets/sfx แล้วแก้ play() ให้โหลดไฟล์แทน
// ============================================================
const MUTE_KEY = 'thainative_muted';
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

// ------------------------------------------------------------
//  เพลง MMO แบบหลายชั้น (layer) – โน้ตเขบ็ต 1 ชั้น, null = พัก
//  เครื่องดนตรี: ranat (ระนาด) · khong (ฆ้องวง) · pi (ปี่) · saw (ซอ/ลีด) · pad · bass · ghost
//  กลอง (16 ช่อง/รอบ): thon (โทน) · klong (กลองใหญ่) · ching (ฉิ่ง) · chap (ฉาบ)
// ------------------------------------------------------------
const _ = null;
const TRACKS = {
  // หมู่บ้าน – เพนทาโทนิก C สดใส ระนาดนำ ฆ้องวงตอบ ฉิ่งฉับ + โทน
  town: {
    bpm: 108,
    layers: [
      { inst: 'ranat', vol: 0.2, notes: [76, 79, 81, 79, 76, 74, 72, _, 74, 76, 79, 76, 74, 72, 74, _,
                                          72, 74, 76, 79, 81, 84, 81, 79, 76, 79, 76, 74, 72, _, 72, _,
                                          81, _, 84, 81, 79, _, 76, 79, 81, 79, 76, 74, 76, _, _, _,
                                          79, 76, 74, 72, 74, 76, 79, 81, 79, 76, 74, 76, 72, _, _, _] },
      { inst: 'khong', vol: 0.09, notes: [60, _, _, _, 67, _, _, _, 64, _, _, _, 62, _, _, _,
                                          60, _, _, _, 64, _, _, _, 67, _, _, _, 69, _, 67, _] },
      { inst: 'pad', vol: 0.035, notes: [60, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, 57, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _,
                                         55, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, 60, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _], len: 16 },
      { inst: 'bass', vol: 0.2, notes: [48, _, 55, _, 48, _, 55, _, 45, _, 52, _, 43, _, 50, _,
                                        48, _, 55, _, 48, _, 55, _, 45, _, 52, _, 43, _, 48, _] },
    ],
    drums: { ching: '.x...x...x...x..', chap: '.......x.......x', thon: 'x.....x...x.....' },
    amb: 'town',
  },
  // หมู่บ้านยามค่ำ – ระนาดทุ้มช้าๆ ฆ้องห่างๆ จิ้งหรีด
  townNight: {
    bpm: 72,
    layers: [
      { inst: 'ranat', vol: 0.12, notes: [67, _, 69, _, 72, _, _, _, 69, _, 67, _, 64, _, _, _, 62, _, 64, _, 67, _, 69, _, 67, _, _, _, _, _, _, _] },
      { inst: 'khong', vol: 0.06, notes: [48, _, _, _, _, _, _, _, 55, _, _, _, _, _, _, _, 52, _, _, _, _, _, _, _, 50, _, _, _, _, _, _, _] },
      { inst: 'pad', vol: 0.035, notes: [48, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, 45, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _] },
    ],
    drums: { ching: '........x.......' },
    amb: 'wild',
  },
  // ทุ่ง/ป่ากลางวัน – ผจญภัย สดใสขึ้น ปี่นำ ระนาดตอบ กลองโทนเดินจังหวะ
  field: {
    bpm: 116,
    layers: [
      { inst: 'pi', vol: 0.1, notes: [69, _, 72, _, 74, _, 76, 74, 72, _, 69, _, 67, _, _, _, 69, _, 72, _, 76, _, 79, 76, 74, _, 72, _, 74, _, _, _,
                                     76, _, 79, _, 81, _, 79, 76, 74, _, 76, _, 72, _, _, _, 69, _, 67, _, 69, _, 72, 74, 72, _, 69, _, _, _, _, _] },
      { inst: 'ranat', vol: 0.09, notes: [_, _, _, _, _, _, _, _, 81, 79, 76, _, _, _, _, _, _, _, _, _, _, _, _, _, 84, 81, 79, _, _, _, _, _] },
      { inst: 'bass', vol: 0.18, notes: [45, _, 52, _, 45, _, 52, _, 43, _, 50, _, 43, _, 50, _, 41, _, 48, _, 41, _, 48, _, 40, _, 47, _, 43, _, 47, _] },
    ],
    drums: { thon: 'x...x.x.x...x.x.', ching: '..x...x...x...x.' },
    amb: 'town',
  },
  // เขตป่าผีดุ – ไมเนอร์เพนทาโทนิก A เสียงปี่โหยหวน + โดรน + กลองช้า
  wild: {
    bpm: 76,
    layers: [
      { inst: 'pi', vol: 0.11, notes: [69, _, _, 72, _, _, 74, _, 76, _, _, 74, _, 72, _, _,
                                       69, _, _, 67, _, _, 64, _, 67, _, 69, _, _, _, _, _,
                                       76, _, _, 79, _, 76, 74, _, 72, _, _, 74, _, 72, 69, _,
                                       67, _, 64, _, _, 67, _, 69, _, _, _, _, _, _, _, _] },
      { inst: 'ghost', vol: 0.06, notes: [_, _, _, _, _, _, _, _, 81, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, 79, _, _, _, _, _, _, _] },
      { inst: 'pad', vol: 0.04, notes: [45, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, 41, _, _, _, _, _, _, _, 40, _, _, _, _, _, _, _], len: 16 },
      { inst: 'bass', vol: 0.16, notes: [33, _, _, _, _, _, _, _, 33, _, _, _, _, _, _, _, 29, _, _, _, _, _, _, _, 28, _, _, _, _, _, _, _], len: 8 },
    ],
    drums: { klong: 'x.......x.....x.', ching: '....x.......x...' },
    wail: true, amb: 'wild',
  },
  // ===== เพลงประจำภาค (20 แมพล่าผี) =====
  // ภาค 1 ทุ่งนา – ลูกทุ่งอีสานสบายๆ: แคน (pad+pi) + โปงลาง (ranat) + กลองโทน
  r1: {
    bpm: 100,
    layers: [
      { inst: 'ranat', vol: 0.13, notes: [67, 69, 72, _, 74, 72, 69, _, 67, _, 64, 67, 69, _, _, _, 72, 74, 76, _, 79, 76, 74, _, 72, _, 69, 72, 67, _, _, _] },
      { inst: 'pi', vol: 0.07, notes: [_, _, _, _, _, _, _, _, 79, _, 76, _, 74, _, 72, _, _, _, _, _, _, _, _, _, 76, _, 74, _, 72, _, 69, _] },
      { inst: 'pad', vol: 0.03, notes: [55, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, 60, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _], len: 16 },
      { inst: 'bass', vol: 0.16, notes: [43, _, _, 50, 43, _, 50, _, 48, _, _, 55, 48, _, 55, _] },
    ],
    drums: { thon: 'x..x..x.x..x..x.', ching: '..x...x...x...x.' },
    amb: 'paddy',
  },
  // ภาค 2 บึงบัว – ช้า หลอน น้ำหยด: ระนาดทุ้มห่างๆ + เสียงโหยหวน + โดรน
  r2: {
    bpm: 66,
    layers: [
      { inst: 'ranat', vol: 0.1, notes: [64, _, _, 67, _, _, 69, _, 71, _, _, _, 69, _, 67, _, 64, _, _, _, 62, _, 64, _, _, _, _, _, _, _, _, _] },
      { inst: 'ghost', vol: 0.05, notes: [_, _, _, _, 76, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, 74, _, _, _, _, _, _, _, _, _, _, _] },
      { inst: 'pad', vol: 0.045, notes: [40, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, 43, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _], len: 16 },
    ],
    drums: { ching: '........x.......' },
    wail: true, amb: 'swamp',
  },
  // ภาค 3 ป่าดงดิบ – กลองป่าหนักแน่น ปี่ผจญภัย ไมเนอร์
  r3: {
    bpm: 104,
    layers: [
      { inst: 'pi', vol: 0.09, notes: [69, _, _, 72, 74, _, 72, _, 69, _, 67, _, 69, _, _, _, 76, _, 74, _, 72, _, 74, 76, 79, _, 76, _, 74, _, _, _] },
      { inst: 'khong', vol: 0.06, notes: [45, _, _, _, _, _, _, _, 52, _, _, _, _, _, _, _, 48, _, _, _, _, _, _, _, 50, _, _, _, _, _, _, _] },
      { inst: 'bass', vol: 0.2, notes: [33, _, 33, _, _, 40, _, _, 36, _, 36, _, _, 43, _, _] },
    ],
    drums: { klong: 'x.....x...x.....', thon: '..x.x...x.x.x.x.', ching: 'x...x...x...x...' },
    amb: 'jungle',
  },
  // ภาค 4 ป่าช้าวัดร้าง – ฆ้องเดี่ยวช้าๆ เสียงสวดต่ำ ระฆังไกลๆ
  r4: {
    bpm: 60,
    layers: [
      { inst: 'khong', vol: 0.08, notes: [52, _, _, _, _, _, _, _, 55, _, _, _, 53, _, _, _, 52, _, _, _, _, _, _, _, 48, _, _, _, _, _, _, _] },
      { inst: 'saw', vol: 0.035, notes: [40, _, _, _, 40, _, _, _, 41, _, _, _, 40, _, _, _] },
      { inst: 'ghost', vol: 0.05, notes: [_, _, _, _, _, _, _, _, _, _, _, _, 79, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, 77, _, _, _] },
      { inst: 'pad', vol: 0.05, notes: [36, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, 37, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _], len: 16 },
    ],
    drums: { klong: 'x...............' },
    wail: true, amb: 'grave',
  },
  // ภาค 5 หุบเขาอสุรกาย – เร็ว ดุดัน ลีดซอ กลองรัว
  r5: {
    bpm: 132,
    layers: [
      { inst: 'saw', vol: 0.075, notes: [64, _, 67, 64, 70, _, 67, _, 64, _, 63, _, 64, _, _, _, 71, _, 70, 67, 64, _, 67, _, 70, _, 67, _, 64, _, _, _] },
      { inst: 'khong', vol: 0.07, notes: [52, _, _, _, _, _, _, _, 51, _, _, _, _, _, _, _] },
      { inst: 'bass', vol: 0.22, notes: [28, _, 28, _, 40, _, 28, _, 27, _, 27, _, 39, _, 31, _] },
    ],
    drums: { klong: 'x..x..x.x..x..x.', thon: '..x...x...x.x.x.', chap: 'x.......x.......' },
    amb: 'cursed',
  },
  // เรดบอส – เร็ว ดุดัน กลองใหญ่รัว ลีดซอ + ฆ้องเตือน
  // ===== เพลงหน้าเข้าเกม (สุ่มตามวอลเปเปอร์) =====
  // A คืนลอยกระทง – ระนาดหวานช้าๆ ฆ้องวงรับ ฉิ่งเบาๆ เสียงน้ำไหล
  title_a: {
    bpm: 84,
    layers: [
      { inst: 'ranat', vol: 0.15, notes: [72, _, 76, _, 79, _, 76, 74, 72, _, 69, _, 72, _, _, _, 74, _, 76, _, 79, 81, 79, _, 76, _, 74, _, 76, _, _, _,
                                          81, _, 79, _, 76, _, 79, 81, 84, _, 81, _, 79, _, _, _, 76, _, 74, _, 72, 74, 76, _, 72, _, _, _, _, _, _, _] },
      { inst: 'khong', vol: 0.07, notes: [48, _, _, _, 55, _, _, _, 52, _, _, _, 55, _, _, _, 50, _, _, _, 57, _, _, _, 55, _, _, _, 48, _, _, _] },
      { inst: 'pad', vol: 0.035, notes: [60, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, 57, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _], len: 16 },
      { inst: 'bass', vol: 0.12, notes: [36, _, _, _, 43, _, _, _, 40, _, _, _, 43, _, _, _, 38, _, _, _, 45, _, _, _, 43, _, _, _, 36, _, _, _] },
    ],
    drums: { ching: '....x.......x...', thon: 'x.........x.....' },
    amb: 'river',
  },
  // B ต้นตะเคียนป่าช้า – ปี่โหยหวน โดรนต่ำ เสียงวิญญาณ กลองใหญ่ห่างๆ
  title_b: {
    bpm: 58,
    layers: [
      { inst: 'pi', vol: 0.09, notes: [69, _, _, _, 72, _, 71, _, 69, _, _, _, 64, _, _, _, 65, _, _, 64, _, _, 62, _, 64, _, _, _, _, _, _, _,
                                       69, _, _, 72, _, _, 76, _, 75, _, 72, _, 71, _, _, _, 69, _, 68, _, 64, _, _, _, 69, _, _, _, _, _, _, _] },
      { inst: 'ghost', vol: 0.05, notes: [_, _, _, _, _, _, _, _, 81, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, 80, _, _, _, _, _, _, _] },
      { inst: 'pad', vol: 0.045, notes: [45, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, 44, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _], len: 16 },
      { inst: 'bass', vol: 0.14, notes: [33, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, 32, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _], len: 12 },
    ],
    drums: { klong: 'x...............', ching: '........x.......' },
    wail: true, amb: 'grave',
  },
  // C ลานพญายักษ์ – กลองศึกหนักๆ ซอ/ปี่นำไมเนอร์ เบสย้ำ
  title_c: {
    bpm: 100,
    layers: [
      { inst: 'saw', vol: 0.07, notes: [64, _, _, 67, 69, _, 67, _, 64, _, 62, _, 64, _, _, _, 64, _, _, 67, 71, _, 69, _, 67, _, 69, _, 64, _, _, _,
                                        76, _, 74, _, 71, _, 69, _, 71, _, 74, _, 76, _, _, _, 79, _, 76, _, 74, 71, 69, _, 67, _, 69, _, 64, _, _, _] },
      { inst: 'khong', vol: 0.06, notes: [40, _, _, _, _, _, _, _, 40, _, _, _, 43, _, _, _] },
      { inst: 'pad', vol: 0.04, notes: [52, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, 48, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _], len: 16 },
      { inst: 'bass', vol: 0.2, notes: [28, _, 28, _, _, 28, _, _, 31, _, 28, _, _, 26, _, _] },
    ],
    drums: { klong: 'x..x..x...x..x..', thon: '....x.......x.x.', chap: '............x...' },
    amb: 'cursed',
  },
  // D บางผียามโพล้เพล้ – ปี่แผ่วๆ ระนาดตอบ อบอุ่นปนเหงา กบ/จิ้งหรีด
  title_d: {
    bpm: 76,
    layers: [
      { inst: 'pi', vol: 0.07, notes: [67, _, _, _, 69, _, 72, _, 74, _, _, _, 72, _, 69, _, 67, _, _, _, 64, _, 67, _, 69, _, _, _, _, _, _, _,
                                       72, _, _, _, 74, _, 76, _, 79, _, _, _, 76, _, 74, _, 72, _, _, _, 69, _, 67, _, 64, _, _, _, _, _, _, _] },
      { inst: 'ranat', vol: 0.09, notes: [_, _, _, _, _, _, _, _, _, _, 79, 76, _, _, _, _, _, _, _, _, _, _, _, _, _, _, 74, 72, _, _, _, _] },
      { inst: 'pad', vol: 0.035, notes: [55, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _, 52, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _], len: 16 },
      { inst: 'bass', vol: 0.12, notes: [43, _, _, _, _, _, 50, _, 40, _, _, _, _, _, 47, _] },
    ],
    drums: { ching: '........x.......' },
    amb: 'paddy',
  },
  boss: {
    bpm: 148,
    layers: [
      { inst: 'saw', vol: 0.09, notes: [69, _, 72, 69, 74, _, 72, _, 76, _, 74, 72, 69, _, 67, _,
                                        69, _, 72, 74, 76, _, 79, _, 81, _, 79, 76, 74, _, 72, _,
                                        81, 79, 76, 79, 81, _, 84, _, 81, _, 79, _, 76, _, 74, _,
                                        72, _, 74, _, 76, 74, 72, 69, 67, _, 69, _, _, _, _, _] },
      { inst: 'khong', vol: 0.08, notes: [57, _, _, _, _, _, _, _, 60, _, _, _, _, _, _, _, 55, _, _, _, _, _, _, _, 52, _, _, _, 55, _, _, _] },
      { inst: 'bass', vol: 0.22, notes: [33, _, 33, _, 45, _, 33, _, 33, _, 33, _, 43, _, 31, _, 29, _, 29, _, 41, _, 29, _, 28, _, 28, _, 40, _, 31, _] },
    ],
    drums: { klong: 'x..x..x.x..x..x.', thon: '..x...x...x.x.xx', chap: 'x.......x.......', ching: '.x.x.x.x.x.x.x.x' },
    amb: 'boss',
  },
};

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    try { this.muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* ignore */ }
    this.track = null;
    this.wanted = null;
    this.step = 0;
    this.nextTime = 0;

    // เบราว์เซอร์อนุญาตให้เปิดเสียงหลังผู้เล่นคลิก/กดปุ่มครั้งแรกเท่านั้น
    const unlock = () => { this.init(); window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.6;
    this.master.connect(ctx.destination);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 0.8; this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0.32; this.musicBus.connect(this.master);

    // noise buffer ใช้ร่วมกัน
    const len = ctx.sampleRate;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    if (this.cfg) this.applySettings(this.cfg);
    this.scheduler = setInterval(() => this.schedule(), 25);
    if (this.wanted) this.music(this.wanted);
  }

  /** ใช้ค่าจากหน้าต่างตั้งค่า { bgmOn, bgmVol, sfxOn, sfxVol } */
  applySettings(cfg) {
    this.cfg = cfg;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(cfg.bgmOn ? cfg.bgmVol * 0.55 : 0, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(cfg.sfxOn ? cfg.sfxVol : 0, t, 0.05);
  }

  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0'); } catch { /* ignore */ }
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.6, this.ctx.currentTime, 0.05);
    return this.muted;
  }

  // ------------------------------------------------------------
  //  เครื่องกำเนิดเสียงพื้นฐาน
  // ------------------------------------------------------------
  tone(freq, dur, { type = 'square', vol = 0.15, to = null, delay = 0, attack = 0.005, bus = this.sfxBus, vibrato = 0, lp = 0, release = 0 } = {}) {
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    if (vibrato) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 7; lg.gain.value = vibrato;
      lfo.connect(lg).connect(o.frequency); lfo.start(t); lfo.stop(t + dur + 0.05);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    if (release) { g.gain.setValueAtTime(vol, t + Math.max(attack, dur - release)); g.gain.linearRampToValueAtTime(0.0001, t + dur); }
    else g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; o.connect(f).connect(g).connect(bus); }
    else o.connect(g).connect(bus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  noise(dur, { vol = 0.2, type = 'bandpass', freq = 1200, to = null, q = 1, delay = 0, bus = this.sfxBus } = {}) {
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }

  arp(notes, step, opts) { notes.forEach((n, i) => this.tone(midi(n), step * 1.6, { ...opts, delay: i * step })); }

  // ------------------------------------------------------------
  //  เสียงเอฟเฟกต์
  // ------------------------------------------------------------
  play(name) {
    if (!this.ctx || this.muted || this.cfg?.sfxOn === false) return;
    const T = (...a) => this.tone(...a), N = (...a) => this.noise(...a);
    switch (name) {
      case 'swing':      N(0.12, { freq: 1200, to: 3200, vol: 0.25 }); break;
      case 'swingLight': N(0.07, { freq: 2000, to: 4200, vol: 0.2 }); break;
      case 'slash':      N(0.18, { freq: 800, to: 4000, vol: 0.32 }); T(900, 0.08, { type: 'sawtooth', to: 300, vol: 0.05 }); break;
      case 'fireball':   N(0.3, { type: 'lowpass', freq: 900, to: 200, vol: 0.3 }); T(220, 0.25, { type: 'sine', to: 80, vol: 0.2 }); break;
      case 'arrow':      N(0.08, { type: 'highpass', freq: 3000, vol: 0.2 }); T(1200, 0.06, { type: 'triangle', to: 600, vol: 0.08 }); break;
      case 'arrowBig':   N(0.12, { type: 'highpass', freq: 2500, vol: 0.25 }); T(700, 0.18, { to: 200, vol: 0.08 }); break;
      case 'arrowRain':  for (let i = 0; i < 5; i++) N(0.07, { type: 'highpass', freq: 3000, vol: 0.14, delay: i * 0.06 }); break;
      case 'wind':       N(0.35, { freq: 400, to: 2400, q: 3, vol: 0.32 }); break;
      case 'storm':      N(0.5, { freq: 300, to: 3000, q: 2, vol: 0.32 }); T(180, 0.4, { type: 'sawtooth', to: 360, vol: 0.05 }); break;
      case 'dash':       N(0.2, { freq: 600, to: 2600, q: 2, vol: 0.3 }); break;
      case 'punch':      N(0.06, { type: 'lowpass', freq: 900, vol: 0.45 }); T(150, 0.08, { type: 'sine', to: 60, vol: 0.4 }); break;
      case 'kick':       T(130, 0.15, { type: 'sine', to: 40, vol: 0.5 }); N(0.08, { type: 'lowpass', freq: 1500, vol: 0.35 }); break;
      case 'thunder':    N(0.8, { type: 'lowpass', freq: 3000, to: 150, vol: 0.6 }); T(60, 0.5, { type: 'sawtooth', vol: 0.15 }); break;
      case 'meteor':     T(420, 0.35, { type: 'sawtooth', to: 60, vol: 0.12 }); N(0.6, { type: 'lowpass', freq: 1500, to: 100, vol: 0.5, delay: 0.2 }); break;
      case 'buff':       this.arp([72, 76, 79, 84], 0.08, { type: 'triangle', vol: 0.15 }); break;
      case 'hit':        N(0.05, { freq: 1500, vol: 0.35 }); T(220, 0.06, { to: 110, vol: 0.1 }); break;
      case 'crit':       N(0.07, { freq: 1500, vol: 0.4 }); T(880, 0.1, { to: 1760, vol: 0.1 }); break;
      case 'miss':       N(0.1, { type: 'highpass', freq: 4000, vol: 0.12 }); break;
      case 'hurt':       T(300, 0.15, { to: 120, vol: 0.15 }); N(0.1, { vol: 0.2 }); break;
      case 'die':        T(440, 0.9, { type: 'sawtooth', to: 55, vol: 0.2 }); break;
      case 'ghostDie':   T(760, 0.6, { type: 'sine', to: 140, vol: 0.14, vibrato: 30 }); N(0.5, { freq: 800, vol: 0.08 }); break;
      case 'enemySwing': N(0.1, { freq: 700, vol: 0.14 }); break;
      case 'enemyShot':  T(300, 0.2, { type: 'sine', to: 520, vol: 0.1 }); break;
      case 'coin':       T(988, 0.06, { vol: 0.1 }); T(1319, 0.16, { vol: 0.1, delay: 0.06 }); break;
      case 'levelup':    this.arp([72, 74, 76, 79, 81, 84], 0.07, { vol: 0.13 }); break;
      case 'potion':     T(400, 0.25, { type: 'sine', to: 900, vol: 0.15 }); break;
      case 'buy':        this.play('coin'); break;
      case 'jump':       T(300, 0.1, { to: 620, vol: 0.07 }); break;
      case 'click':      T(800, 0.03, { type: 'triangle', vol: 0.1 }); break;
      case 'step':       N(0.04, { type: 'lowpass', freq: 500, vol: 0.06 }); break;
      case 'land':       N(0.08, { type: 'lowpass', freq: 400, vol: 0.18 }); T(90, 0.08, { type: 'sine', to: 50, vol: 0.12 }); break;
      case 'open':       T(660, 0.05, { type: 'triangle', vol: 0.08 }); T(990, 0.08, { type: 'triangle', vol: 0.07, delay: 0.04 }); break;
      case 'close':      T(880, 0.05, { type: 'triangle', vol: 0.07 }); T(587, 0.08, { type: 'triangle', vol: 0.06, delay: 0.04 }); break;
      case 'invite':     this.arp([79, 84, 88], 0.09, { type: 'triangle', vol: 0.12 }); this.khong(midi(72), 0, 0.08); break;
      case 'bossWarn':   T(220, 0.35, { type: 'sawtooth', to: 440, vol: 0.08, lp: 1200 }); this.khong(midi(45), 0, 0.2); break;
      case 'bossRoar':   N(1.1, { type: 'lowpass', freq: 600, to: 120, q: 4, vol: 0.55 }); T(80, 1.0, { type: 'sawtooth', to: 45, vol: 0.18, vibrato: 8, lp: 500 }); break;
      case 'bossSlam':   T(70, 0.45, { type: 'sine', to: 30, vol: 0.6 }); N(0.5, { type: 'lowpass', freq: 900, to: 80, vol: 0.55 }); break;
      case 'victory':    this.arp([72, 76, 79, 84, 79, 84, 88], 0.11, { type: 'triangle', vol: 0.16 }); this.khong(midi(60), 0, 0.2); this.khong(midi(67), 0.44, 0.2); break;
      case 'nightfall':  this.khong(midi(41), 0, 0.25); this.tone(midi(81), 1.8, { type: 'sine', to: midi(69), vol: 0.05, attack: 0.4, vibrato: 12, delay: 0.3 }); break;
      case 'rooster':    T(700, 0.12, { type: 'sawtooth', to: 1100, vol: 0.06, lp: 2500 }); T(1100, 0.35, { type: 'sawtooth', to: 800, vol: 0.06, lp: 2500, delay: 0.12, vibrato: 20 }); break;
      case 'templeBell': this.khong(midi(64), 0, 0.22); this.khong(midi(76), 0.02, 0.08); break;
      case 'siamsi':     for (let i = 0; i < 12; i++) N(0.04, { type: 'bandpass', freq: 2600 + (i % 3) * 400, q: 6, vol: 0.18, delay: i * 0.12 }); N(0.08, { type: 'bandpass', freq: 1800, q: 5, vol: 0.3, delay: 1.5 }); break;
      case 'blessing':   this.arp([72, 79, 84, 88, 91], 0.09, { type: 'sine', vol: 0.12 }); this.khong(midi(72), 0, 0.1); break;
      case 'howl':       T(420, 1.4, { type: 'sine', to: 620, vol: 0.08, attack: 0.3, vibrato: 10 }); T(620, 1.1, { type: 'sine', to: 380, vol: 0.07, attack: 0.1, delay: 1.3, vibrato: 10 }); break;
      case 'eventHorn':  for (let i = 0; i < 3; i++) { T(196, 0.5, { type: 'sawtooth', vol: 0.09, lp: 900, delay: i * 0.6 }); this.drum('klong', i * 0.6, this.sfxBus); } break;
      case 'party':      this.arp([76, 81], 0.07, { type: 'triangle', vol: 0.1 }); break;
      case 'error':      T(200, 0.1, { vol: 0.1 }); T(150, 0.12, { vol: 0.1, delay: 0.1 }); break;
    }
  }

  // ------------------------------------------------------------
  //  เพลงประกอบ (sequencer แบบ look-ahead)
  // ------------------------------------------------------------
  music(name) {
    this.wanted = name;
    if (!this.ctx || this.track === name) return;
    // เปลี่ยนเพลงแบบ fade: ลดเสียงลง แล้วเริ่มเพลงใหม่
    const bus = this.musicBus, t = this.ctx.currentTime;
    const target = this.cfg ? (this.cfg.bgmOn ? this.cfg.bgmVol * 0.55 : 0) : 0.32;
    bus.gain.cancelScheduledValues(t);
    bus.gain.setValueAtTime(bus.gain.value, t);
    bus.gain.linearRampToValueAtTime(0.0001, t + 0.4);
    bus.gain.linearRampToValueAtTime(target, t + 1.4);
    this.track = name;
    this.step = 0;
    this.nextTime = t + 0.45;
  }

  /** ฆ้อง: เสียงโลหะ (ความถี่ไม่ลงตัว) หางเสียงยาว */
  khong(f, delay = 0, vol = 0.1, bus = this.sfxBus) {
    this.tone(f, 1.1, { type: 'sine', vol, delay, bus });
    this.tone(f * 2.76, 0.5, { type: 'sine', vol: vol * 0.35, delay, bus });
    this.tone(f * 5.4, 0.18, { type: 'sine', vol: vol * 0.15, delay, bus });
  }

  playNote(inst, n, vol, delay, stepDur, bus) {
    const f = midi(n);
    switch (inst) {
      case 'ranat': this.tone(f, 0.28, { type: 'triangle', vol, delay, bus }); this.tone(f * 2, 0.1, { type: 'square', vol: vol * 0.13, delay, bus, lp: 3000 }); break;
      case 'khong': this.khong(f, delay, vol, bus); break;
      case 'pi':    this.tone(f, stepDur * 2.6, { type: 'sawtooth', vol, delay, bus, attack: 0.05, vibrato: 5, lp: 1400, release: 0.15 });
                    this.tone(f * 1.003, stepDur * 2.6, { type: 'square', vol: vol * 0.3, delay, bus, attack: 0.06, lp: 900, release: 0.15 }); break;
      case 'saw':   this.tone(f, stepDur * 1.8, { type: 'sawtooth', vol, delay, bus, attack: 0.01, vibrato: 3, lp: 2200, release: 0.05 }); break;
      case 'pad':   this.tone(f, stepDur * 15, { type: 'triangle', vol, delay, bus, attack: 0.6, release: 1.2 });
                    this.tone(f * 1.5, stepDur * 15, { type: 'triangle', vol: vol * 0.6, delay, bus, attack: 0.8, release: 1.2 });
                    this.tone(f * 2.004, stepDur * 15, { type: 'sine', vol: vol * 0.5, delay, bus, attack: 0.8, release: 1.2 }); break;
      case 'bass':  this.tone(f, stepDur * 1.8, { type: 'sine', vol, delay, bus, attack: 0.01 }); this.tone(f * 2, stepDur, { type: 'triangle', vol: vol * 0.2, delay, bus }); break;
      case 'ghost': this.tone(f, stepDur * 6, { type: 'sine', to: f * 0.84, vol, delay, bus, attack: 0.4, vibrato: 12 }); break;
    }
  }

  drum(kind, delay, bus) {
    const T = (f, d, o) => this.tone(f, d, { ...o, delay, bus }), N = (d, o) => this.noise(d, { ...o, delay, bus });
    if (kind === 'thon')  { T(180, 0.16, { type: 'sine', to: 95, vol: 0.3 }); N(0.03, { type: 'lowpass', freq: 1200, vol: 0.1 }); }
    if (kind === 'klong') { T(75, 0.35, { type: 'sine', to: 40, vol: 0.45 }); N(0.06, { type: 'lowpass', freq: 600, vol: 0.18 }); }
    if (kind === 'ching') N(0.05, { type: 'highpass', freq: 6500, vol: 0.07 });
    if (kind === 'chap')  N(0.25, { type: 'highpass', freq: 4500, vol: 0.06 });
  }

  /** เสียงบรรยากาศ: นก/จิ้งหรีด (หมู่บ้าน), ลม/นกฮูก (ป่า), ฟ้าร้อง (เรด) */
  ambience(kind, delay, bus) {
    const r = Math.random();
    if (kind === 'town' && r < 0.05) {          // นกร้อง
      const f = 2200 + Math.random() * 1200;
      for (let k = 0; k < 3; k++) this.tone(f + k * 180, 0.07, { type: 'sine', to: f + 600, vol: 0.02, delay: delay + k * 0.1, bus });
    } else if (kind === 'wild') {
      if (r < 0.12) this.tone(4200, 0.05, { type: 'square', vol: 0.006, delay, bus, lp: 5000 });             // จิ้งหรีด
      else if (r < 0.14) { this.tone(420, 0.35, { type: 'sine', to: 380, vol: 0.025, delay, bus, attack: 0.05 });  // นกฮูก
                           this.tone(400, 0.45, { type: 'sine', to: 340, vol: 0.025, delay: delay + 0.45, bus, attack: 0.05 }); }
      else if (r < 0.16) this.noise(1.6, { freq: 300, to: 900, q: 2, vol: 0.03, delay, bus });              // ลมพัด
    } else if (kind === 'river') {
      if (r < 0.05) this.noise(0.9, { type: 'lowpass', freq: 500, to: 250, vol: 0.035, delay, bus });                        // น้ำกระเพื่อม
      else if (r < 0.12) this.tone(4400, 0.04, { type: 'square', vol: 0.005, delay, bus, lp: 5000 });                        // จิ้งหรีด
      else if (r < 0.13) this.tone(1800 + Math.random() * 600, 0.06, { type: 'sine', to: 900, vol: 0.02, delay, bus });      // ปลาผุด
    } else if (kind === 'paddy') {
      if (r < 0.1) this.tone(900 + Math.random() * 200, 0.08, { type: 'square', to: 600, vol: 0.008, delay, bus, lp: 1800 });   // กบร้อง
      else if (r < 0.13) this.tone(4600, 0.04, { type: 'square', vol: 0.005, delay, bus, lp: 5200 });                        // จิ้งหรีด
    } else if (kind === 'swamp') {
      if (r < 0.06) this.tone(1500 + Math.random() * 800, 0.05, { type: 'sine', to: 700, vol: 0.03, delay, bus });            // น้ำหยด
      else if (r < 0.12) this.tone(300 + Math.random() * 80, 0.18, { type: 'square', to: 220, vol: 0.008, delay, bus, lp: 700 }); // อึ่งอ่าง
    } else if (kind === 'jungle') {
      if (r < 0.04) { const f = 1600 + Math.random() * 1400;                                                                  // นกป่า
        this.tone(f, 0.12, { type: 'sine', to: f * 1.5, vol: 0.02, delay, bus }); this.tone(f * 1.2, 0.1, { type: 'sine', to: f, vol: 0.018, delay: delay + 0.15, bus }); }
      else if (r < 0.14) this.tone(5200, 0.03, { type: 'square', vol: 0.004, delay, bus, lp: 6000 });                        // แมลง
      else if (r < 0.15) this.noise(1.2, { freq: 400, to: 1200, q: 1.5, vol: 0.025, delay, bus });                          // ใบไม้ไหว
    } else if (kind === 'grave') {
      if (r < 0.012) this.khong(midi(84), delay, 0.03, bus);                                                                // ระฆังวัดไกลๆ
      else if (r < 0.03) this.noise(2, { freq: 200, to: 600, q: 3, vol: 0.03, delay, bus });                                // ลมหวีด
      else if (r < 0.04) { this.tone(420, 0.35, { type: 'sine', to: 380, vol: 0.02, delay, bus, attack: 0.05 });            // นกแสก
                           this.tone(400, 0.45, { type: 'sine', to: 340, vol: 0.02, delay: delay + 0.45, bus, attack: 0.05 }); }
    } else if (kind === 'cursed') {
      if (r < 0.03) this.noise(1.6, { type: 'lowpass', freq: 180, to: 60, vol: 0.08, delay, bus });                         // ธรณีคำราม
      else if (r < 0.08) this.noise(0.08, { type: 'highpass', freq: 3000, vol: 0.015, delay, bus });                        // ถ่านไฟแตก
    } else if (kind === 'boss' && r < 0.03) {
      this.noise(1.8, { type: 'lowpass', freq: 250, to: 60, vol: 0.12, delay, bus });                       // ฟ้าคำราม
    }
  }

  schedule() {
    const tr = TRACKS[this.track];
    if (!tr || this.muted || this.cfg?.bgmOn === false) { if (this.ctx) this.nextTime = this.ctx.currentTime + 0.1; return; }
    const stepDur = 60 / tr.bpm / 2;
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      const delay = Math.max(0, this.nextTime - this.ctx.currentTime);
      const bus = this.musicBus;
      for (const L of tr.layers) {
        const n = L.notes[this.step % L.notes.length];
        if (n) this.playNote(L.inst, n, L.vol, delay, stepDur, bus);
      }
      for (const [kind, pat] of Object.entries(tr.drums || {})) if (pat[this.step % pat.length] === 'x') this.drum(kind, delay, bus);
      if (tr.wail && this.step % 64 === 44) this.tone(midi(81), 1.6, { type: 'sine', to: midi(69), vol: 0.05, delay, bus, attack: 0.4, vibrato: 12 }); // เสียงโหยหวน
      if (tr.amb) this.ambience(tr.amb, delay, this.sfxBus);
      this.nextTime += stepDur;
      this.step++;
    }
  }
}

/** ใช้ instance เดียวทั้งเกม */
export const sound = new Sound();
