import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

// Run the production dash method with a deterministic tween clock.
const source=readFileSync(new URL('../client/js/topdown/TdSkills.js',import.meta.url),'utf8');
const start=source.indexOf('  dash(sk, o,');
const end=source.indexOf('  partyTargets(',start);
const dash=runInNewContext('({' + source.slice(start,end) + '}).dash',{
  dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),
});
for(const leap of [true,false])for(const authored of [true,false]){
  let tween,landed=0,images=0,shocks=0;
  const moves=[];
  const player={x:10,y:20,scaleX:authored?.17:.667,scaleY:authored?.17:.667,
    _d8:true,d8id:authored?'boxer':'legacy',dir:'east',
    setPosition(x,y){this.x=x;this.y=y;},
    setScale(){assert.fail('Combat movement must not resize the character');},
  };
  const scene={time:{now:100},d8meta:{boxer:{scale:.26},legacy:{scale:.667}},
    econ:{server:true},net:{send:(event,data)=>moves.push(data)},
    tweens:{add:config=>{tween=config;}},
  };
  const fx={afterimage:()=>images++,shock:()=>shocks++};
  dash.call({s:scene,fx,solidAt:()=>false},{distance:60},
    {caster:player,local:true,x:10,y:20,ux:1,uy:0},
    {tint:0xffffff,leap,onLand:()=>landed++});
  for(const k of [0,.25,.5,.75,1]){
    tween.targets.k=k;scene.time.now+=50;tween.onUpdate();
    assert.equal(player.x,10+60*k);assert.equal(player.y,20);
    assert.equal(player.scaleX,authored?.17:.667);
  }
  tween.onComplete();
  assert.equal(player.dashing,false);assert.equal(player.st,'idle');
  assert.equal(landed,1);assert.ok(images>0);assert.equal(shocks,leap?0:1);
  assert.equal(moves.at(-1).anim,'idle');
}
console.log('Combat dash and leap preserve character scale, movement, trails and landing.');
