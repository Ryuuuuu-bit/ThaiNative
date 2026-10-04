import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { spriteTopHeight } from '../client/js/topdown/Dir8.js';

const texts = [], tweens = [];
const context = vm.createContext({ Math });
const dependencies = { WORLD: {}, spriteTopHeight, makeText(scene, x, y, text, style) {
  const value = { x, y, text, style, setOrigin(){return this;}, setDepth(){return this;}, setScale(){return this;}, destroy(){} };
  texts.push(value); return value;
} };
const dependency = new vm.SyntheticModule(Object.keys(dependencies), function () {
  for (const [name, value] of Object.entries(dependencies)) this.setExport(name, value);
}, { context });
const source = new vm.SourceTextModule(readFileSync(new URL('../client/js/gfx/Fx.js', import.meta.url), 'utf8'), { context });
await source.link(() => dependency); await source.evaluate();
const { popupAbove } = source.namespace;
const scene = { settings:{}, tweens:{add(config){tweens.push(config);}} };
const monster = {x:100,y:200,worldLabelHeight:32,displayHeight:120};
const damage = popupAbove(scene, monster, '28');
assert.equal(damage.y,154,'3D damage uses the rendered monster height, not the old sprite height');
assert.equal(damage.worldAnchorY,200,'rising text keeps the original target ground position');
assert.equal(damage.text,'28','presentation does not change the server damage value');
const player = {x:100,y:200,frame:{y:152},displayOriginY:384,scaleY:.2,displayHeight:76.8};
const taken = popupAbove(scene, player, '-12','taken');
assert.ok(Math.abs(taken.y-139.6)<1e-8,'player damage excludes atlas padding');
assert.equal(taken.worldAnchorY,200);
assert.ok(tweens.some(t=>t.targets===taken&&t.y===taken.y-20));
const count=texts.length; scene.settings.damageNumbers=false;
assert.equal(popupAbove(scene,monster,'MISS','miss'),undefined);
assert.equal(texts.length,count,'damage visibility preference still applies');
assert.equal(popupAbove(scene,monster,'+20','heal').text,'+20','healing remains visible when damage is disabled');
console.log('Damage popup placement, preserved values, float anchors and visibility passed.');
