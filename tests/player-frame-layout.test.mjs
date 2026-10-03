import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {layoutCell} from '../client/js/player-lab/frame-layout.js';
const layouts=JSON.parse(await readFile(new URL('../client/assets/player-imagegen/warrior-male-v1/frame-layout.json',import.meta.url),'utf8'));
assert.equal(layoutCell(layouts.walk,5,0),null,'Missing NW must not sample a west or blank row');
assert.equal(layoutCell(layouts.attack,2,0),null,'A front-only action must not masquerade as an east-facing action');
for(const layout of Object.values(layouts))for(const [direction,sequence] of Object.entries(layout.directions))for(let frame=0;frame<sequence.length;frame++){
  const r=layoutCell(layout,direction,frame);
  assert.ok(r.x>=-1e-9&&r.y>=-1e-9&&r.x+r.w<=1.000001&&r.y+r.h<=1.000001,'UV rectangle stays inside source image');
  assert.ok(r.foot>0&&r.foot<=1,'Foot anchor stays inside frame');
  assert.ok(Math.abs(r.y-(1-sequence[frame].y-sequence[frame].h))<1e-9,'Top-left metadata converts to bottom-left UV');
}
const finalWalk=layouts.walk.directions['7'][5];
assert.ok(finalWalk.y+finalWalk.h<.95,'Walk excludes the unoccupied strip at the bottom');
console.log('Frame bounds, pivots, UV conversion and missing-direction handling passed');
