// ============================================================
//  Sound – เสียงเอฟเฟกต์ + เพลงประกอบ สังเคราะห์สดด้วย Web Audio
//  (ไม่ต้องมีไฟล์เสียง)  เพลงใช้บันไดเสียงเพนทาโทนิกแบบไทย
//  ▸ sound.play('slash')   ▸ sound.music('town' | 'wild' | null)
//  ▸ ถ้าอยากใช้ไฟล์เสียงจริง ใส่ .ogg ใน client/assets/sfx แล้วแก้ play() ให้โหลดไฟล์แทน
// ============================================================
const MUTE_KEY = 'thainative_muted';
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

// ------------------------------------------------------------
//  เพลง: 32 จังหวะ (โน้ตเขบ็ต 1 ชั้น) วนซ้ำ   null = พัก
// ------------------------------------------------------------
const TRACKS = {
  // หมู่บ้าน – เพนทาโทนิก C (โด เร มี ซอล ลา) เสียงแนวระนาด + ฉิ่งฉับ
  town: {
    bpm: 104, inst: 'ranat',
    melody: [76, 79, 81, 79, 76, 74, 72, null, 74, 76, 79, 76, 74, 72, 74, null,
             72, 74, 76, 79, 81, 84, 81, 79, 76, 79, 76, 74, 72, null, 72, null],
    bass: [48, null, 55, null, 48, null, 55, null, 45, null, 52, null, 43, null, 50, null,
           48, null, 55, null, 48, null, 55, null, 45, null, 52, null, 43, null, 48, null],
    perc: true,
  },
  // เขตผีดุ – เพนทาโทนิกไมเนอร์ A ช้า เสียงหลอน + โดรนต่ำ
  wild: {
    bpm: 72, inst: 'ghost',
    melody: [69, null, null, 72, null, null, 74, null, 76, null, null, 74, null, 72, null, null,
             69, null, null, 67, null, null, 64, null, 67, null, 69, null, null, null, null, null],
    bass: [45, null, null, null, null, null, null, null, 45, null, null, null, null, null, null, null,
           41, null, null, null, null, null, null, null, 40, null, null, null, null, null, null, null],
    perc: false, wail: true,
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

    this.scheduler = setInterval(() => this.schedule(), 25);
    if (this.wanted) this.music(this.wanted);
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
  tone(freq, dur, { type = 'square', vol = 0.15, to = null, delay = 0, attack = 0.005, bus = this.sfxBus, vibrato = 0 } = {}) {
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
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus);
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
    if (!this.ctx || this.muted) return;
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
      case 'error':      T(200, 0.1, { vol: 0.1 }); T(150, 0.12, { vol: 0.1, delay: 0.1 }); break;
    }
  }

  // ------------------------------------------------------------
  //  เพลงประกอบ (sequencer แบบ look-ahead)
  // ------------------------------------------------------------
  music(name) {
    this.wanted = name;
    if (!this.ctx || this.track === name) return;
    this.track = name;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
  }

  schedule() {
    const tr = TRACKS[this.track];
    if (!tr || this.muted) { if (this.ctx) this.nextTime = this.ctx.currentTime + 0.1; return; }
    const stepDur = 60 / tr.bpm / 2;
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      const delay = Math.max(0, this.nextTime - this.ctx.currentTime);
      const i = this.step % 32;
      const m = tr.melody[i], b = tr.bass[i];
      const bus = this.musicBus;

      if (m) {
        if (tr.inst === 'ranat') {           // ระนาด: เสียงตีสั้นๆ 2 ชั้น
          this.tone(midi(m), 0.28, { type: 'triangle', vol: 0.22, delay, bus });
          this.tone(midi(m + 12), 0.12, { type: 'square', vol: 0.03, delay, bus });
        } else {                              // เสียงหลอน: ยาว สั่น
          this.tone(midi(m), stepDur * 3, { type: 'sine', vol: 0.18, delay, bus, attack: 0.08, vibrato: 4 });
          this.tone(midi(m) * 1.005, stepDur * 3, { type: 'triangle', vol: 0.05, delay, bus, attack: 0.1 });
        }
      }
      if (b) this.tone(midi(b), tr.inst === 'ranat' ? stepDur * 1.8 : stepDur * 8, { type: 'sine', vol: tr.inst === 'ranat' ? 0.22 : 0.16, delay, bus, attack: tr.inst === 'ranat' ? 0.01 : 0.3 });
      if (tr.perc) {                          // ฉิ่ง (ปิด) – ฉับ (เปิด)
        if (i % 4 === 1) this.noise(0.05, { type: 'highpass', freq: 6000, vol: 0.06, delay, bus });
        if (i % 8 === 5) this.noise(0.18, { type: 'highpass', freq: 5000, vol: 0.05, delay, bus });
      }
      if (tr.wail && i === 12 && (this.step / 32 | 0) % 2 === 1) {
        this.tone(midi(81), 1.6, { type: 'sine', to: midi(69), vol: 0.05, delay, bus, attack: 0.4, vibrato: 12 }); // เสียงโหยหวน
      }
      this.nextTime += stepDur;
      this.step++;
    }
  }
}

/** ใช้ instance เดียวทั้งเกม */
export const sound = new Sound();
