import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const manifest = JSON.parse(readFileSync(new URL('../client/assets/td/manifest.json', import.meta.url), 'utf8'));
const context = vm.createContext({
  console, performance: { now: () => 0 }, requestAnimationFrame: () => 1,
  fetch: async () => ({ json: async () => manifest }),
  Image: class { complete = true; naturalWidth = 1536; naturalHeight = 3072; },
});
const dependencies = {
  sanitizeAppearance: a => ({ ...a }), weaponTier: () => 1,
  bakeCharacter: () => { throw new Error('unexpected fallback'); }, ITEMS: {},
};
const dependency = new vm.SyntheticModule(Object.keys(dependencies), function () {
  for (const [key, value] of Object.entries(dependencies)) this.setExport(key, value);
}, { context });
const source = new vm.SourceTextModule(readFileSync(new URL('../client/js/systems/HeroPreview.js', import.meta.url), 'utf8'), { context });
await source.link(() => dependency); await source.evaluate();
const { HeroView, loadHeroMeta } = source.namespace;
await loadHeroMeta();
const calls = [];
const canvas = () => ({ getContext: () => ({
  clearRect() {}, save() {}, restore() {}, translate() {}, scale() {},
  drawImage(...args) { calls.push(args); },
}) });
const appearance = { gender: 'female', job: 'boxer', outfit: 1 };
const portrait = new HeroView(canvas(), null, { scale: 4, shadow: false, fitHeight: .72 }).set(appearance);
const gameplay = new HeroView(canvas(), null, { scale: 4, shadow: false }).set(appearance);
const idle = portrait.frame(0), factor = portrait.portraitFactor(idle);
assert.ok(factor > 1, 'the authored female portrait fills the menu stage');
portrait.draw(0);
assert.ok(Math.abs(calls.at(-1).at(-1) - portrait.cv.height * .72) < 1, 'idle body fills the requested portrait height');
for (const anim of ['idle', 'walk', 'attack']) for (const dir of ['south', 'east', 'north']) {
  portrait.set(appearance, anim, dir);
  const frame = portrait.frame(1000);
  assert.equal(portrait.portraitFactor(frame), factor, 'all actions and directions share the same reference scale');
}
assert.equal(gameplay.portraitFactor(gameplay.frame(0)), 1, 'other previews retain their existing authored scale');
gameplay.draw(0);
assert.ok(Math.abs(calls.at(-1).at(-1) - idle.sh * idle.artScale * 4) < .001);
console.log('Hero portraits: consistent menu height, fixed action/direction factor and unchanged default scale passed.');
