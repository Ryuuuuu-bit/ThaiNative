import assert from 'node:assert/strict';
import { dirFromVector, stableDir, playDir } from '../client/js/topdown/Dir8.js';

for (const [x,y,dir] of [[0,1,'south'],[1,1,'south-east'],[1,0,'east'],[1,-1,'north-east'],[0,-1,'north'],[-1,-1,'north-west'],[-1,0,'west'],[-1,1,'south-west']]) {
  assert.equal(dirFromVector(x,y),dir);
}
assert.equal(stableDir(1,.5,'east'),'east','small steering changes must not flicker directions');
const timers = [], played = [];
const scene = {
  time: { now:0, delayedCall(ms,fn) { const timer={ms,fn,remove(){this.removed=true;}}; timers.push(timer); return timer; } },
  anims: { exists:key => /:idle:|:walk:|:die:/.test(key) },
  d8meta: { hero: {scale:1} },
};
const sprite = {
  scene,d8id:'hero',active:true,scaleX:1,
  anims:{timeScale:1,currentAnim:null,isPlaying:false,stop(){this.isPlaying=false;}},
  setScale(){return this;},setFlipX(){return this;},setFrame(){return this;},setTexture(){return this;},
  play(config){played.push(config); this.anims.currentAnim={key:typeof config==='string'?config:config.key}; this.anims.isPlaying=true;},
  emit(){throw new Error('stale action completion');},
};
playDir(sprite,'attack','south',true);
assert.equal(timers.length,1);
playDir(sprite,'die','south',true);
assert.equal(timers[0].removed,true,'death must cancel pending attack completion');
assert.equal(sprite._holdTimer,null);
playDir(sprite,'attack','south',true);
playDir(sprite,'attack','south',true);
assert.equal(timers[1].removed,true,'a new attack must replace its previous timer');
sprite.anims.timeScale=1.4;
playDir(sprite,'idle','south');
assert.equal(sprite.anims.timeScale,1,'walking speed must not accelerate idle or death');
sprite.anims.currentAnim={key:'td:hero:walk:south'};
sprite.anims.currentFrame={index:4}; sprite.anims.accumulator=27; sprite.anims.isPlaying=true;
playDir(sprite,'walk','east');
assert.deepEqual(played.at(-1),{key:'td:hero:walk:east',startFrame:3});
assert.equal(sprite.anims.accumulator,27,'turning must preserve gait phase');
sprite.anims.currentAnim={key:'td:hero:walk:south',frames:Array(8),msPerFrame:125};
sprite.anims.currentFrame={index:4};sprite.anims.accumulator=62.5;
scene.anims.get=()=>({frames:Array(16),msPerFrame:62.5});
playDir(sprite,'walk','south-east');
assert.deepEqual(played.at(-1),{key:'td:hero:walk:south-east',startFrame:7},'8-to-16 frame turn preserves the same point in the stride');
assert.equal(sprite.anims.accumulator,0);
sprite.anims.currentAnim={key:'td:hero:walk:south-east',frames:Array(16),msPerFrame:62.5};
sprite.anims.currentFrame={index:8};sprite.anims.accumulator=31.25;
scene.anims.get=()=>({frames:Array(8),msPerFrame:125});
playDir(sprite,'walk','south');
assert.deepEqual(played.at(-1),{key:'td:hero:walk:south',startFrame:3});
assert.equal(sprite.anims.accumulator,93.75,'16-to-8 frame turn preserves fractional gait time');
console.log('Player animation regression checks passed');
