import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {registerDir8,texKey,animKey,DIRS} from '../client/js/topdown/Dir8.js';

const root=new URL('../client/assets/td/',import.meta.url),id='hero2_female_boxer_t1';
const manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
const meta=manifest.sprites[id],textures=new Map(),animations=new Map();
for(const source of [...meta.anims,...meta.sources]){
  const png=await readFile(new URL(`${id}/${source}.png`,root));
  const image={width:png.readUInt32BE(16),height:png.readUInt32BE(20)},frames=new Map();
  textures.set(texKey(id,source),{
    getSourceImage:()=>image,has:name=>frames.has(name),frames,
    add(name,sourceIndex,x,y,w,h){
      assert.ok(x>=0&&y>=0&&x+w<=image.width&&y+h<=image.height,'source crop is inside the loaded texture');
      const frame={x,y,w,h,setTrim(cw,ch,tx,ty,tw,th){
        assert.ok(tx>=0&&ty>=0&&tx+tw<=cw&&ty+th<=ch,'trim must not lose pixels outside canvas');
        this.trim={cw,ch,tx,ty,tw,th};
      }};
      frames.set(name,frame);return frame;
    }
  });
}
const scene={textures:{exists:key=>textures.has(key),get:key=>textures.get(key)},
  anims:{exists:key=>animations.has(key),create:spec=>animations.set(spec.key,spec)}};
const anims=Object.fromEntries(meta.anims.map(clip=>[clip,{frames:meta.frames[clip],rate:meta.rates[clip],directionRates:meta.directionRates?.[clip],loop:['idle','walk'].includes(clip)}]));
assert.ok(registerDir8(scene,{id,anims,cuts:meta.cuts}));
for(const clip of meta.anims)for(const [row,dir] of DIRS.entries()){
  const animation=animations.get(animKey(id,clip,dir));
  assert.equal(animation.frames.length,meta.cuts[clip][row].length);
  if(clip==='walk')assert.equal(animation.frames.length/animation.frameRate,1,'Phaser gait cadence must match across directions');
  for(const [index,entry] of animation.frames.entries()){
    const cut=meta.cuts[clip][row][index];
    assert.equal(entry.key,texKey(id,cut.source||clip));
    const frame=textures.get(entry.key).frames.get(entry.frame);
    assert.equal(frame.trim.ty+cut.h*(cut.foot??1),frame.trim.ch-32,'feet keep a common baseline in Phaser');
  }
}
console.log('Phaser registers every boxer source frame with an unclipped canvas and common foot baseline.');
