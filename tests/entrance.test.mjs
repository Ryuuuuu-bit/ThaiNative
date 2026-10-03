// Exercise resource ownership and loading races with real Three.js scene/math
// objects. A renderer double avoids requiring a GPU in the Node test runner.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as Three from 'three';

const pending = [];
const events = new Map();
const motion = { matches: false };
let canvasCount = 0;
const source = { width: 1280, height: 720, after: () => canvasCount++ };
class Renderer {
  constructor() {
    this.domElement = {
      classList: { add() {}, remove() {}, toggle() {} },
      setAttribute() {},
      addEventListener: (name, fn) => events.set(name, fn),
      removeEventListener: name => events.delete(name),
      remove: () => canvasCount--,
    };
    this.renders = 0;
  }
  setPixelRatio() {}
  setSize() {}
  render() { this.renders++; }
  dispose() { this.disposed = true; }
  forceContextLoss() { this.lost = true; }
}
class Loader {
  load(url, onLoad, _progress, onError) {
    const texture = new Three.Texture();
    texture.image = { width: 64, height: 128 };
    pending.push({ url, texture, onLoad, onError });
    return texture;
  }
}
const listen = {
  addEventListener: (name, fn) => events.set(name, fn),
  removeEventListener: name => events.delete(name),
};
const document = { hidden: false, documentElement: listen };
const context = vm.createContext({
  console, document, window: listen, innerWidth: 1280, innerHeight: 720,
  devicePixelRatio: 1, matchMedia: query => query.includes('reduced-motion') ? motion : { matches: false },
});
const library = { ...Three, WebGLRenderer: Renderer, TextureLoader: Loader };
const dependency = new vm.SyntheticModule(Object.keys(library), function () {
  for (const [name, value] of Object.entries(library)) this.setExport(name, value);
}, { context });
const module = new vm.SourceTextModule(readFileSync(new URL('../client/js/systems/TitleDepth.js', import.meta.url), 'utf8'), { context });
await module.link(() => dependency);
await module.evaluate();
const { TitleDepth } = module.namespace;
const depth = new TitleDepth(source);
assert.equal(canvasCount, 1);
const originalTexture = depth.texture;
let textureReleased = false;
originalTexture.addEventListener('dispose', () => { textureReleased = true; });
source.width = 844; source.height = 390; depth.resize();
assert.notEqual(depth.texture, originalTexture, 'viewport resize creates correctly sized GPU texture storage');
assert.equal(textureReleased, true, 'previous canvas texture is released');
assert.equal(depth.backdrop.material.map, depth.texture);
assert.equal(depth.textures.size, 1);
depth.setScene(0);
const old = pending.splice(0);
depth.setScene(1);
old.forEach(request => request.onLoad(request.texture));
assert.equal(depth.layers.length, 0, 'late images from a previous scene must not attach');
pending.splice(0).forEach(request => request.onLoad(request.texture));
assert.equal(depth.layers.length, 3);
assert.equal(depth.textures.size, 4, 'only current layers and canvas texture remain');

depth.setScene(4);
assert.equal(depth.layers.length, 0, 'painted foreground must not be covered with pixel cutouts');
assert.equal(depth.textures.size, 1, 'switching to painted art releases old layer textures');
assert.equal(depth.texture.magFilter, Three.LinearFilter, 'illustration keeps smooth high resolution sampling');
depth.setScene(1);
pending.splice(0).forEach(request => request.onLoad(request.texture));
assert.equal(depth.texture.magFilter, Three.NearestFilter, 'original pixel paintings retain crisp sampling');
depth.select(2, 3);
depth.frame(1);
assert.ok(depth.camera.position.x > 0, 'selected slot moves the camera');
const renders = depth.renderer.renders;
document.hidden = true;
depth.frame(2);
assert.equal(depth.renderer.renders, renders, 'hidden tabs must not render');
document.hidden = false;
motion.matches = true;
depth.camera.position.set(0, 0, 12);
depth.frame(100);
assert.equal(depth.camera.position.x, 0, 'reduced motion ignores pointer and slot movement');
depth.setScene(2);
const late = pending.splice(0);
depth.dispose();
depth.dispose();
late.forEach(request => request.onLoad(request.texture));
assert.equal(canvasCount, 0);
assert.equal(events.size, 0, 'all event listeners are released');
assert.equal(depth.textures.size, 0);
assert.equal(depth.renderer.disposed, true);
assert.equal(depth.renderer.lost, true);
const lost = new TitleDepth(source);
events.get('webglcontextlost')({ preventDefault() {} });
assert.equal(lost.dead, true, 'context loss removes the WebGL overlay to reveal Canvas fallback');
assert.equal(canvasCount, 0);
console.log('Entrance tests passed: loading races, camera focus, reduced motion, hidden tabs, GPU cleanup, context loss.');
