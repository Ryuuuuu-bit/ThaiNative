// Keep the drawing buffer proportional to the actual display, including mobile DPR.
export const WORLD_QUALITY = Object.freeze({
  low: Object.freeze({ name: 'low', pixelCap: .8, shadowSize: 0, lamps: 2, leaves: .4, detailDistance: 380 }),
  balanced: Object.freeze({ name: 'balanced', pixelCap: 1.25, shadowSize: 1024, lamps: 4, leaves: .65, detailDistance: 620 }),
  high: Object.freeze({ name: 'high', pixelCap: 2, shadowSize: 2048, lamps: 6, leaves: 1, detailDistance: Infinity }),
});

export function initialWorldQuality(choice = 'auto', { mobile = false, memory = 0, cores = 0 } = {}) {
  if (WORLD_QUALITY[choice]) return WORLD_QUALITY[choice];
  if ((memory > 0 && memory <= 2) || (mobile && cores > 0 && cores <= 4)) return WORLD_QUALITY.low;
  return mobile || (memory > 0 && memory <= 4) ? WORLD_QUALITY.balanced : WORLD_QUALITY.high;
}

export function worldPixelRatio(logicalWidth, displayedWidth, dpr, profile) {
  const ratio = displayedWidth / Math.max(1, logicalWidth) * Math.max(1, dpr || 1);
  return Math.max(.25, Math.min(profile.pixelCap, ratio));
}

/** Auto only steps down after two sustained slow windows; loading and hidden tabs do not count. */
export class WorldQualityController {
  constructor(choice, device) { this.device = device; this.configure(choice); }
  configure(choice = 'auto') {
    if (choice === this.choice) return false;
    this.choice = choice; this.profile = initialWorldQuality(choice, this.device);
    this.reset(); this.warmup = 3000; return true;
  }
  reset() { this.last = null; this.elapsed = 0; this.frames = 0; this.slowWindows = 0; }
  sample(now, visible = true) {
    if (!visible || this.choice !== 'auto') { this.reset(); return false; }
    const dt = this.last === null ? 0 : now - this.last; this.last = now;
    if (dt <= 0) return false;
    if (dt > 1000) { this.reset(); this.warmup = 3000; return false; }
    if (this.warmup > 0) { this.warmup -= dt; return false; }
    this.elapsed += dt; this.frames++;
    if (this.elapsed < 8000) return false;
    const fps = this.frames * 1000 / this.elapsed;
    this.slowWindows = fps < 28 ? this.slowWindows + 1 : 0;
    this.elapsed = 0; this.frames = 0;
    if (this.slowWindows < 2 || this.profile.name === 'low') return false;
    this.profile = WORLD_QUALITY[this.profile.name === 'high' ? 'balanced' : 'low'];
    this.reset(); this.warmup = 3000; return true;
  }
}
