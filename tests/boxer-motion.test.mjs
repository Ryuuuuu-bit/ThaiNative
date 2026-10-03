import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {frameAt, directionClip, stableViewDirection, poseBlend} from '../client/js/player-lab/animation.js';
import {layoutCell} from '../client/js/player-lab/frame-layout.js';
import {poseBounds} from '../client/js/player-lab/pose-bounds.js';

const base=new URL('../client/assets/td/hero2_female_boxer_t1/',import.meta.url);
const settings=JSON.parse(await readFile(new URL('settings.json',base),'utf8'));
const manifest=JSON.parse(await readFile(new URL('../client/assets/td/manifest.json',import.meta.url),'utf8'));
const meta=manifest.sprites.hero2_female_boxer_t1;
for(const [clip, action] of Object.entries(settings.clips)){
  assert.equal(action.frames,meta.frames[clip]);
  assert.equal(action.fps,meta.rates[clip]);
  for(let direction=0;direction<8;direction++){
    const directionalAction=directionClip(action,direction);
    const sequence=settings.layouts[clip].directions[direction];
    const cuts=meta.cuts[clip][direction];
    assert.equal(sequence.length,directionalAction.frames,`${clip}/${direction} frame count`);
    assert.equal(cuts.length,directionalAction.frames);
    if(clip==='walk'){
      assert.ok(cuts.length>=8,'walking contains at least eight authored poses');
      assert.equal(new Set(cuts.map(c=>`${c.source}:${c.x}:${c.y}`)).size,cuts.length,'extra frames are not duplicated holds');
      if([1,3,5,7].includes(direction))assert.equal(cuts.length,16,'each diagonal has sixteen authored frames');
    }
    assert.equal(directionalAction.fps,meta.directionRates?.[clip]?.[direction]??meta.rates[clip]);
    if(clip==='walk')assert.equal(directionalAction.frames/directionalAction.fps,1,'every walk direction has the same cycle duration');
    for(let frame=0;frame<directionalAction.frames;frame++){
      const cut=cuts[frame],cell=layoutCell(settings.layouts[clip],direction,frame);
      const png=await readFile(new URL(`${cut.source||clip}.png`,base));
      const width=png.readUInt32BE(16),height=png.readUInt32BE(20);
      assert.ok(cut.x>=0&&cut.y>=0&&cut.w>0&&cut.h>0);
      assert.ok(cut.x+cut.w<=width&&cut.y+cut.h<=height,'crop stays inside source');
      assert.ok(cell.x>=0&&cell.y>=-1e-9&&cell.x+cell.w<=1.000001&&cell.y+cell.h<=1.000001);
      assert.equal(cell.flip,meta.mirrors[clip][direction]);
      assert.equal(cell.source,cut.source);
      assert.ok(Math.abs(cell.pivotX-cut.pivot/cut.w)<1e-9);
      const bounds=poseBounds(width,height,[cell]);
      const w=width*cell.w,h=height*cell.h,pivot=w*cell.pivotX,foot=h*(cell.foot??1);
      assert.ok(pivot+2<=bounds.canvas/2+1e-6&&w-pivot+2<=bounds.canvas/2+1e-6,'hands and sash fit inside billboard');
      assert.ok(foot+2<=bounds.canvas-bounds.floor+1e-6&&h-foot+2<=bounds.floor+1e-6,'head and toes have render margin');
      const canvas=cut.canvas||384,top=canvas-32-cut.h*(cut.foot??1);
      assert.ok(top>=0&&top+cut.h<=canvas&&canvas/2-cut.pivot>=0&&canvas/2-cut.pivot+cut.w<=canvas,'Phaser trim fits canvas');
      if(cut.scale)assert.ok(Math.abs(cut.scale*cell.ppu-.75)<1e-9,'game and lab use same proportions');
    }
    assert.equal(frameAt(0,action),0);
    if(action.loop)assert.equal(frameAt(action.frames/action.fps,action),0);
  }
}
assert.ok(settings.clips.idle.frames>1,'standing must animate');
assert.equal(settings.layouts.idle.directions[3][0].flip,false,'NE back-facing art points right');
assert.equal(settings.layouts.idle.directions[5][0].flip,true,'NW mirrors NE');
for(let direction=0;direction<8;direction++)assert.equal(stableViewDirection(direction*Math.PI/4,0,0),direction);
assert.equal(stableViewDirection(Math.PI/8+.01,0,0),0,'hold direction near boundary');
assert.equal(stableViewDirection(Math.PI/8+.05,0,0),1,'turn after leaving deadband');
for(const clip of ['walk','attack','die'])for(const fraction of [0,.5,.9,1])assert.equal(poseBlend(clip,fraction),0,'no doubled limbs');
assert.equal(poseBlend('idle',0),0);
assert.equal(poseBlend('idle',1),1);
// A wide, off-centre pose used to be clipped by the height-only canvas.
const wide=poseBounds(1024,1024,[{w:.8,h:.2,pivotX:.1,foot:.95}]);
assert.ok(wide.canvas/2>=1024*.8*.9+2);
assert.ok(wide.floor>=1024*.2*.05+2,'outline below foot anchor must remain visible');
console.log('Boxer motion: 8 directions, frame bounds, pivots, scale, idle, phase, direction deadband and no locomotion ghosting passed.');
