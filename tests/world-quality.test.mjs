import assert from 'node:assert/strict';
import {WORLD_QUALITY, initialWorldQuality, worldPixelRatio, WorldQualityController} from '../client/js/topdown/WorldQuality.js';

// A phone fitting a 1280px game to 844 CSS px at DPR 3 must not allocate a 2560px buffer.
const phone=initialWorldQuality('auto',{mobile:true,memory:8,cores:8});
assert.equal(phone.name,'balanced');
assert.equal(worldPixelRatio(1280,844,3,phone)*1280,1600);
// A small portrait screen still receives its full physical resolution without forced oversampling.
assert.equal(worldPixelRatio(960,390,3,phone)*960,1170);
assert.equal(worldPixelRatio(1280,844,1,phone)*1280,844);
assert.equal(initialWorldQuality('auto',{mobile:true,memory:2}).name,'low');
assert.equal(initialWorldQuality('high',{mobile:true,memory:2}).name,'high','manual quality overrides device hints');
assert.equal(initialWorldQuality('auto').name,'high','missing hardware hints keep desktops detailed');

let now=0;
const controller=new WorldQualityController('auto',{mobile:false});
const run=(duration,fps,visible=true)=>{
  const end=now+duration;let changed=false;
  while(now<end){now+=1000/fps;changed=controller.sample(now,visible)||changed;}
  return changed;
};
assert.equal(run(10000,20),false,'one slow window never changes quality');
assert.equal(run(15000,60),false,'recovery clears sustained slowdown');
assert.equal(controller.profile.name,'high');
assert.equal(run(25000,20),true);assert.equal(controller.profile.name,'balanced');
assert.equal(run(30000,20,false),false,'background automation never triggers a quality downgrade');
assert.equal(controller.profile.name,'balanced');
assert.equal(run(20000,20),true);assert.equal(controller.profile.name,'low');
controller.configure('high');assert.equal(run(30000,12),false);assert.equal(controller.profile.name,'high');
controller.configure('auto');now+=5000;controller.sample(now);
assert.equal(run(10000,20),false,'a loading pause restarts warmup and measurement');
assert.equal(controller.profile.name,'high');
assert.equal(WORLD_QUALITY.low.shadowSize,0);
console.log('Mobile quality: physical display resolution, device hints, manual override, sustained adaptation and hidden/loading windows passed.');
