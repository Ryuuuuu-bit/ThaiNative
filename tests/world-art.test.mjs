import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import * as THREE from 'three';
import { getArchivedMap as getMap, ALL_TD_MAP_IDS as TD_MAP_IDS } from '../shared/td/maps.js';
import { MONSTERS } from '../shared/data/monsters.js';
import { TILE, CENTER, SPAWN, OX, T } from '../shared/td/ayutthaya.js';
import { propKind, actorKind } from '../client/js/topdown/VisualAssets.js';

const images=[];
const ctx=new Proxy({createLinearGradient:()=>({addColorStop(){}})}, {get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
class RendererDouble {
  constructor(){this.domElement={style:{},dataset:{},addEventListener(){},setAttribute(){},remove(){}};this.shadowMap={};this.info={render:{calls:0}};}
  setPixelRatio(){} setSize(){} clear(){} clearDepth(){} dispose(){this.disposed=true;}
  render(){this.info.render.calls++;}
}
class CameraDouble {constructor(){this.matrix={loadIdentity(){}};}destroy(){this.destroyed=true;}}
const context=vm.createContext({console,performance:{now:()=>1000},Phaser:{Cameras:{Scene2D:{Camera:CameraDouble}},BlendModes:{MULTIPLY:2,ADD:1}},
  location:{search:''},navigator:{maxTouchPoints:0},window:{},
  Image:class {constructor(){images.push(this);}},
  document:{createElement:()=>({width:128,height:128,getContext:()=>ctx})}});
const threeModule=new vm.SyntheticModule(Object.keys(THREE),function(){
  for(const [k,v]of Object.entries(THREE))this.setExport(k,k==='WebGLRenderer'?RendererDouble:v);
},{context});
const cache=new Map();
async function moduleFor(file){
  if(cache.has(file))return cache.get(file);
  const m=new vm.SourceTextModule(readFileSync(file,'utf8'),{context,identifier:file});cache.set(file,m);
  await m.link(async(spec,ref)=>spec.includes('three.module.js')?threeModule
    :moduleFor(spec.startsWith('/shared/')?path.resolve('.'+spec):path.resolve(path.dirname(ref.identifier),spec)));return m;
}
const cityModule=await moduleFor(path.resolve('client/js/topdown/AyutthayaCity.js'));
await cityModule.evaluate();
const actorModule=await moduleFor(path.resolve('client/js/topdown/WorldActors.js'));await actorModule.evaluate();
const materialModule=cache.get(path.resolve('client/js/topdown/WorldMaterials.js'));
const {buildAyutthayaCity,disposeTerrain}=cityModule.namespace;
const {buildGroundSurface}=materialModule.namespace;
const {WorldActors}=actorModule.namespace;
const finite=group=>group.traverse(o=>{
  if(!o.geometry)return;
  for(const attr of Object.values(o.geometry.attributes))
    assert.ok(Array.from(attr.array).every(Number.isFinite),'finite geometry attributes');
});
let totalProps=0;
const reviewMapIds=[...TD_MAP_IDS,'crypt:1:1:art','crypt:100:6:art'];
for(const id of reviewMapIds){
  const map=getMap(id),layout=map.layout();
  const solidBefore=JSON.stringify(layout.solid);
  const city=buildAyutthayaCity(layout.props,map);
  const expected=layout.props.filter(p=>propKind(p));
  assert.equal(city.children.length,expected.length,`${id}: every visible prop has a model`);
  assert.equal(JSON.stringify(layout.solid),solidBefore,`${id}: presentation preserves collision`);
  finite(city);totalProps+=city.children.length;
  const unique=new Set();city.traverse(o=>{if(o.geometry)unique.add(o.geometry);});
  assert.ok(unique.size<Math.max(25,city.children.length*9),'static material batches and templates share geometry');
  const ground=buildGroundSurface(layout.ground,TILE,T,map.style,map);finite(ground);
  assert.ok(ground.children.length>0&&ground.children.length<=8,'terrain uses bounded material batches');
  disposeTerrain(city);disposeTerrain(ground);
}
const town=getMap('ayutthaya').layout();
assert.ok(town.props.some(p=>p.key.includes('fountain')),'the authored central landmark remains in the map');
assert.equal(town.solid[SPAWN.y/TILE][SPAWN.x/TILE],false,'clear spawn');
for(const y of [55,67,78])for(const x of [93,94])assert.equal(town.solid[y][x+OX],false,'canal bridges are walkable');

const world=new THREE.Scene(),actors=new WorldActors(world);
let monsterCount=0;
for(const [id,def]of Object.entries(MONSTERS)){
  const object={spawn:{id},def,x:100,y:200,visible:true,alive:true,dir:'south',anims:{currentAnim:{key:'mob:test:walk:south'}}};
  assert.ok(actorKind(object));actors.begin();actors.draw(object,1,Math.PI/3);actors.end();
  const entry=actors.entries.get(object);finite(entry.root);
  assert.ok(object.worldLabelHeight>0);assert.equal(entry.root.position.x,100);assert.equal(entry.root.position.z,200);
  object.x=105;object.dir='east';actors.draw(object,2,Math.PI/3);
  assert.equal(entry.root.position.x,105);assert.equal(entry.root.rotation.y,Math.PI/2);
  entry.root.updateMatrixWorld(true);
  const targetable=Array.from({length:12},(_,i)=>new THREE.Raycaster(new THREE.Vector3(105,entry.height*(i+1)/13,300),new THREE.Vector3(0,0,-1))).some(ray=>ray.intersectObject(entry.root,true).length>0);
  assert.ok(targetable,`${id}: replacement can be targeted`);
  monsterCount++;
}
for(const npc of town.npcs){
  const object={npcVisual:{id:npc.id},x:npc.x,y:npc.y,dir:'south',visible:true};
  actors.begin();actors.draw(object,3,Math.PI/3);actors.end();finite(actors.entries.get(object).root);
}
actors.begin();actors.end();assert.equal(actors.entries.size,0,'removed actors release resources');
actors.dispose();assert.equal(world.children.length,0);
assert.ok(images.every(i=>i.onload===null),'late atlas loads cancelled after disposal');

// Exercise the production renderer's lifecycle and picking using Three's real
// raycaster, matrices and meshes. Only the GPU calls are replaced.
const runtimeModule=await moduleFor(path.resolve('client/js/topdown/ThreeWorld.js'));await runtimeModule.evaluate();
const {ThreeWorld}=runtimeModule.namespace;
const rect={left:0,top:0,width:960,height:540};
const canvas={style:{opacity:'1'},getBoundingClientRect:()=>rect,parentElement:{getBoundingClientRect:()=>rect,appendChild(){}}};
const camera={width:960,height:540,scrollX:0,scrollY:0,zoom:1.5,getWorldPoint:()=>({})};
const frame={source:{image:{width:16,height:32}},x:0,y:0,width:16,height:32,u0:0,v0:0,u1:1,v1:1};
const hero={x:480,y:270,visible:true,alpha:1,type:'Sprite',depth:270,displayOriginX:8,displayOriginY:32,
  frame,scaleX:1,scaleY:1,scrollFactorX:1,scrollFactorY:1,blendMode:0};
const npc={x:510,y:270,visible:true,alpha:1,type:'Sprite',depth:270,scrollFactorX:1,scrollFactorY:1,
  npcVisual:{id:'smith'},dir:'south',displayWidth:14,displayHeight:40};
const originalHitTest=()=>[],events=new Map();
const input={hitTest:originalHitTest,inputCandidate:()=>true,pointWithinHitArea:()=>true};
const scene={game:{canvas},cameras:{main:camera},input:{manager:input},events:{on:(name,fn)=>events.set(name,fn),once(){},off:()=>{}},
  children:{depthSort(){},list:[hero,npc]},player:hero,shadows:[],atmo:{light:1},M:{id:'test'},mapW:64,mapH:64,
  layout:{props:[{key:'env/p_bench',x:540,y:280,scale:1}],ground:Array.from({length:64},()=>Array(64).fill(T.STONE))}};
const renderer=new ThreeWorld(scene);
assert.equal(renderer.ready,true);assert.equal(canvas.style.opacity,'0');
assert.equal(renderer.actors.entries.size,1);
const projected=new THREE.Vector3(npc.x,23,npc.y).project(renderer.camera);
const hit=input.hitTest({x:(projected.x+1)*480,y:(1-projected.y)*270},[npc],camera,[]);
assert.equal(hit[0],npc,'model click still returns its Phaser NPC');
const groundPoint=new THREE.Vector3(hero.x,0,hero.y).project(renderer.camera);
const recovered=camera.getWorldPoint((groundPoint.x+1)*480,(1-groundPoint.y)*270);
assert.ok(Math.abs(recovered.x-hero.x)<1e-5&&Math.abs(recovered.y-hero.y)<1e-5,'ground click keeps world coordinates');
scene.children.list=[hero];renderer.render();assert.equal(renderer.actors.entries.size,0,'map removal cleans actor entries');
renderer.dispose();assert.equal(canvas.style.opacity,'1');assert.equal(input.hitTest,originalHitTest);
assert.ok(renderer.renderer.disposed);assert.ok(images.every(i=>i.onload===null));
console.log(`World art validated: ${totalProps} props across ${reviewMapIds.length} maps, ${monsterCount} monster designs, ${town.npcs.length} NPCs, targeting and cleanup.`);
