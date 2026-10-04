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

// The plaza upgrade must remain navigable, survive failed/late image loads,
// share textures between repeated buildings, and obey the mobile texture budget.
const visited=new Set(),queue=[[SPAWN.x/TILE,SPAWN.y/TILE]];
for(let i=0;i<queue.length;i++){
  const [x,y]=queue[i],key=`${x},${y}`;
  if(visited.has(key)||town.solid[y]?.[x]!==false)continue;
  visited.add(key);
  for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]])if(!visited.has(`${x+dx},${y+dy}`))queue.push([x+dx,y+dy]);
}
for(const npc of town.npcs)assert.ok(visited.has(`${Math.floor(npc.x/TILE)},${Math.floor(npc.y/TILE)}`),`${npc.id}: reachable from spawn after widening the medicine hall`);
const {installPlazaArt,updatePlazaArt,plazaAsset}=cache.get(path.resolve('client/js/topdown/PlazaArt.js')).namespace;
assert.equal(plazaAsset({key:'env/b_shophouse_1',x:100,y:100}),null,'art pass does not replace distant map zones');
const imageStart=images.length,plaza=buildAyutthayaCity(town.props,{id:'ayutthaya'});
const layoutBefore=JSON.stringify(town);
installPlazaArt(plaza,{id:'ayutthaya'},{name:'low'});
assert.equal(JSON.stringify(town),layoutBefore,'installing art never mutates shared map data');
const artImages=images.slice(imageStart).filter(i=>i.src?.includes('/plaza-v1/'));
assert.equal(artImages.length,4,'only four original assets load for repeated scenery');
const replacements=plaza.userData.paintedModels;
assert.ok(replacements.length>4);
for(const model of replacements){assert.equal(model.userData.paintedMesh.visible,false);assert.ok(model.children.some(c=>c!==model.userData.paintedMesh&&c.visible),'native fallback stays visible while loading');}
const lateCallback=artImages[0].onload;
for(const image of artImages){image.naturalWidth=2048;image.naturalHeight=1536;image.onload();}
for(const model of replacements){
  const mesh=model.userData.paintedMesh;assert.ok(mesh.visible);assert.equal(model.userData.paintedReady,true);
  assert.ok(Math.max(mesh.material.map.image.width,mesh.material.map.image.height)<=512,'low profile texture cap');
  assert.ok(model.children.filter(c=>c!==mesh).every(c=>!c.visible),'fallback is hidden only after successful load');
}
const shops=replacements.filter(m=>m.userData.paintedArt==='shop');
assert.ok(shops.length>1);assert.equal(shops[0].userData.paintedMesh.material.map,shops[1].userData.paintedMesh.material.map,'shops share GPU texture');
updatePlazaArt(plaza,.1,2);assert.ok(shops[0].userData.paintedMesh.material.color.r<1,'painted art follows night lighting');
const camera3=new THREE.OrthographicCamera(-400,400,300,-300,1,8000);
camera3.position.set(1856,Math.sin(Math.PI/3)*1800,800+900);camera3.lookAt(1856,0,800);camera3.updateMatrixWorld();
const artNormal=new THREE.Vector3(0,0,1).applyEuler(shops[0].userData.paintedMesh.rotation);
assert.ok(artNormal.dot(new THREE.Vector3(0,0,1).applyQuaternion(camera3.quaternion))>.999,'painted geometry faces the locked game camera');
disposeTerrain(plaza);lateCallback();assert.equal(plaza.children.length,0,'late load cannot resurrect a disposed plaza');
assert.ok(artImages.every(i=>i.onload===null&&i.onerror===null));

// NPCs in the painted plaza use their animated sprite atlas and remain clickable.
const spriteNpc={...hero,npcVisual:{id:'shop'},x:1760,y:1056,depth:1056,
  frame:{...frame,cutX:0,cutY:0,cutWidth:16,cutHeight:32,source:{image:{width:16,height:32},width:16,height:32}}};
scene.M={id:'ayutthaya'};scene.player={...hero,x:1856,y:928,depth:928};
scene.children.list=[scene.player,spriteNpc];camera.scrollX=1856-480;camera.scrollY=928-270;
input.pointWithinHitArea=(o,x,y)=>Number.isFinite(x)&&Number.isFinite(y)&&Math.abs(x)<=8&&y>=-32&&y<=0;
const spriteWorld=new ThreeWorld(scene);
assert.ok(spriteWorld.entries.has(spriteNpc),'plaza NPC uses its authored atlas');
assert.ok(!spriteWorld.actors.entries.has(spriteNpc),'no duplicate primitive NPC');
spriteWorld.world.updateMatrixWorld(true);
const spriteCenter=spriteWorld.entries.get(spriteNpc).mesh.localToWorld(new THREE.Vector3(0,16,0)).project(spriteWorld.camera);
const spriteHit=input.hitTest({x:(spriteCenter.x+1)*480,y:(1-spriteCenter.y)*270},[spriteNpc],camera,[]);
assert.equal(spriteHit[0],spriteNpc,'clicking the painted NPC still opens its real game interaction');
spriteWorld.dispose();assert.equal(input.hitTest,originalHitTest);
console.log(`World art validated: ${totalProps} props across ${reviewMapIds.length} maps, ${monsterCount} monster designs, ${town.npcs.length} NPCs, targeting and cleanup.`);
console.log('Painted plaza: NPC routes, async fallback, shared textures, low-profile memory cap, camera alignment and cleanup passed.');
