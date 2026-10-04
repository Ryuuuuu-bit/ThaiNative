import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {frameQuad,graphicsBounds,WORLD_TILT} from '../client/js/topdown/ThreeWorldMath.js';
import {ALL_TD_MAP_IDS as TD_MAP_IDS,getArchivedMap as getMap} from '../shared/td/maps.js';
import {TILE} from '../shared/td/ayutthaya.js';
import {T} from '../shared/td/ayutthaya.js';
import {GD_BOSSES,GD_DIFFS} from '../shared/data/ghostdg.js';
import {WORLD_QUALITY} from '../client/js/topdown/WorldQuality.js';

// Import the browser module with the same Three build, resolving its URL imports.
const url=new URL('../client/js/topdown/ThreeWorld.js',import.meta.url);
const threeURL=new URL('../node_modules/three/build/three.module.js',import.meta.url).href;
const visualURL=new URL('../client/js/topdown/VisualAssets.js',import.meta.url).href;
const materialSource=(await readFile(new URL('../client/js/topdown/WorldMaterials.js',import.meta.url),'utf8')).replace('/vendor/three/three.module.js',threeURL).replace('./VisualAssets.js',visualURL);
const materialURL='data:text/javascript;base64,'+Buffer.from(materialSource).toString('base64');
const staticSource=(await readFile(new URL('../client/js/topdown/StaticMeshes.js',import.meta.url),'utf8')).replace('/vendor/three/three.module.js',threeURL);
const staticURL='data:text/javascript;base64,'+Buffer.from(staticSource).toString('base64');
const actorSource=(await readFile(new URL('../client/js/topdown/WorldActors.js',import.meta.url),'utf8')).replace('/vendor/three/three.module.js',threeURL).replace('./VisualAssets.js',visualURL);
const actorURL='data:text/javascript;base64,'+Buffer.from(actorSource).toString('base64');
const {WorldActors}=await import(actorURL);
const gardenSource=(await readFile(new URL('../client/js/topdown/GardenWorld.js',import.meta.url),'utf8')).replace('/vendor/three/three.module.js',new URL('../node_modules/three/build/three.module.js',import.meta.url).href);
const gardenURL='data:text/javascript;base64,'+Buffer.from(gardenSource).toString('base64');
const {buildGarden,updateGarden}=await import(gardenURL);
const citySource=(await readFile(new URL('../client/js/topdown/AyutthayaCity.js',import.meta.url),'utf8')).replace('/vendor/three/three.module.js',threeURL).replace('./GardenWorld.js',gardenURL).replace('./WorldMaterials.js',materialURL).replace('./StaticMeshes.js',staticURL).replace('./VisualAssets.js',visualURL);
const cityURL='data:text/javascript;base64,'+Buffer.from(citySource).toString('base64');
const monsterSource=(await readFile(new URL('../client/js/topdown/MonsterLook.js',import.meta.url),'utf8')).replace('/vendor/three/three.module.js',new URL('../node_modules/three/build/three.module.js',import.meta.url).href);
const monsterURL='data:text/javascript;base64,'+Buffer.from(monsterSource).toString('base64');
const plazaSource=(await readFile(new URL('../client/js/topdown/PlazaArt.js',import.meta.url),'utf8')).replace('/vendor/three/three.module.js',threeURL);
const plazaURL='data:text/javascript;base64,'+Buffer.from(plazaSource).toString('base64');
const source=(await readFile(url,'utf8'))
  .replace('/vendor/three/three.module.js',new URL('../node_modules/three/build/three.module.js',import.meta.url).href)
  .replace('/shared/td/ayutthaya.js',new URL('../shared/td/ayutthaya.js',import.meta.url).href)
  .replace('./MonsterLook.js',monsterURL)
  .replace('./AyutthayaCity.js',cityURL)
  .replace('./GardenWorld.js',gardenURL)
  .replace('./WorldMaterials.js',materialURL)
  .replace('./VisualAssets.js',visualURL)
  .replace('./WorldActors.js',actorURL)
  .replace('./PlazaArt.js',plazaURL)
  .replace('./WorldQuality.js',new URL('../client/js/topdown/WorldQuality.js',import.meta.url).href)
  .replace('../systems/Screen.js',new URL('../client/js/systems/Screen.js',import.meta.url).href)
  .replace('./ThreeWorldMath.js',new URL('../client/js/topdown/ThreeWorldMath.js',import.meta.url).href);
const {ThreeWorld}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
globalThis.Phaser={BlendModes:{ADD:1,MULTIPLY:2}};

const sample={ground:Array.from({length:20},(_,y)=>Array.from({length:24},(_,x)=>x===12?T.ROAD:T.GRASS)),props:[{x:96,y:96,foot:[3,2],key:'house'},{x:80,y:80,glow:[-26,40,0xffc46b,1]}],npcs:[{x:48,y:48}]};
const untouched=JSON.stringify(sample),garden=buildGarden(sample,TILE,T,{spawn:{x:32,y:32}});
assert.equal(JSON.stringify(sample),untouched,'decorative planting never changes the playable map');
for(const chunk of garden.userData.chunks){const p=chunk.children[0].geometry.attributes.position;for(let i=0;i<p.count;i+=3){const x=p.getX(i)+chunk.position.x,z=p.getZ(i)+chunk.position.z;assert.notEqual(Math.floor(x/TILE),12,'native planting leaves the road clear');assert.ok(Math.hypot(x-48,z-48)>18,'NPC interaction feet stay clear');}}
updateGarden(garden,80,80,200,.05,2);assert.equal(garden.userData.lamps.length,6);assert.ok(garden.userData.lamps[0].intensity>0);
updateGarden(garden,4000,4000,200,.05,2);assert.ok(garden.userData.lamps.every(l=>l.intensity===0),'distant lamps leave the fixed light pool idle');
const underground=buildGarden(sample,TILE,T,{crypt:true});assert.equal(underground.children.length,0,'underground encounter layouts do not receive outdoor planting');

const f={x:110,y:140,width:80,height:190,u0:.2,v0:.3,u1:.4,v1:.7};
const normal=frameQuad(f,192,384),mirrored=frameQuad(f,192,384,true);
assert.deepEqual(normal.positions,[-82,54,0,-2,54,0,-82,244,0,-2,244,0]);
assert.equal(mirrored.positions[0],2);assert.equal(mirrored.positions[3],82);
assert.equal(mirrored.uvs[0],.4);assert.ok(Math.abs(normal.uvs[1]-.3)<1e-9);
assert.deepEqual(graphicsBounds([7,0xff0000,1,3,-40,-25,80,50]),{x:-42,y:-27,width:84,height:54});
assert.deepEqual(graphicsBounds([0,0,0,20,0,Math.PI*2,false,0]),{x:-22,y:-22,width:44,height:44});

const view=Object.create(ThreeWorld.prototype);
view.width=960;view.height=540;view.camera=new THREE.OrthographicCamera(-320,320,180,-180,1,8000);
view.camera.position.set(800,Math.sin(WORLD_TILT)*1800,600+Math.cos(WORLD_TILT)*1800);
view.camera.lookAt(800,0,600);view.camera.updateProjectionMatrix();view.camera.updateMatrixWorld();
view.raycaster=new THREE.Raycaster();view.pointer=new THREE.Vector2();view.hit=new THREE.Vector3();
view.ground=new THREE.Plane(new THREE.Vector3(0,1,0),0);
for(const [x,z] of [[800,600],[620,490],[960,710]]){
  const screen=new THREE.Vector3(x,0,z).project(view.camera);
  const point=view.worldPoint((screen.x+1)*480,(1-screen.y)*270);
  assert.ok(Math.abs(point.x-x)<1e-6&&Math.abs(point.y-z)<1e-6,'click projection round-trips to the simulation map');
}

// The production camera always returns to its fixed high angle, regardless of stale orbit values.
const fixed=Object.create(ThreeWorld.prototype);fixed.yaw=2;fixed.pitchOffset=.2;
fixed.quality={profile:WORLD_QUALITY.high};
fixed.gameCanvas={getBoundingClientRect:()=>({left:0,top:0,width:960,height:540}),parentElement:{getBoundingClientRect:()=>({left:0,top:0})}};
fixed.canvas={style:{}};fixed.renderer={setSize(){}};fixed.camera=new THREE.OrthographicCamera();fixed.overlayCamera=new THREE.OrthographicCamera();
fixed.sun=new THREE.DirectionalLight();fixed.sky=new THREE.HemisphereLight();fixed.s={M:{id:'ayutthaya'},cameras:{main:{width:960,height:540,zoom:1.5,scrollX:320,scrollY:330}}};
fixed.updateCamera();assert.equal(fixed.tilt,Math.PI/3);assert.equal(fixed.camera.position.x,800,'the camera stays at its original azimuth');
fixed.raycaster=view.raycaster;fixed.pointer=view.pointer;fixed.hit=view.hit;fixed.ground=view.ground;
for(const [x,z] of [[800,600],[620,490],[960,710]]){const projected=new THREE.Vector3(x,0,z).project(fixed.camera);const point=fixed.worldPoint((projected.x+1)*480,(1-projected.y)*270);assert.ok(Math.abs(point.x-x)<1e-6&&Math.abs(point.y-z)<1e-6);}
view.world=new THREE.Scene();view.terrain=new THREE.Group();view.world.add(view.terrain);
view.world.background=new THREE.Color();
for(const id of [...TD_MAP_IDS,...Array.from({length:100},(_,i)=>`crypt:${i+1}:${i%2?6:1}:test`),...Object.keys(GD_BOSSES).flatMap(boss=>Object.keys(GD_DIFFS).map(diff=>`gd:${boss}:${diff}:6:test`))]){
  const M=getMap(id);assert.equal(M.id,id,'every tested map family must resolve its actual map');view.s={M,mapW:M.W,mapH:M.H,layout:M.layout()};
  view.rebuildTerrain();assert.equal(view.mapId,M.id);assert.ok(view.terrain.children.length>=1);
  const base=view.terrain.children[0];assert.equal(base.geometry.parameters.width,M.W*TILE);
  assert.equal(base.geometry.parameters.depth,M.H*TILE);
  const old=[...view.terrain.children],geometries=new Set();let disposed=0;
  view.terrain.traverse(mesh=>{if(mesh.geometry)geometries.add(mesh.geometry);});
  for(const geometry of geometries)geometry.addEventListener('dispose',()=>disposed++);
  view.rebuildTerrain();assert.equal(disposed,geometries.size,'map switching frees every old terrain geometry');
  assert.equal(view.terrain.children.length,old.length,'map switching does not accumulate terrain');
}

view.entries=new Map();view.textures=new Map();view.frameNumber=1;view.overlay=new THREE.Scene();view.actors=new WorldActors(view.world);view.tilt=WORLD_TILT;
const image={width:256,height:256};
const actor={type:'Sprite',visible:true,x:800,y:600,depth:600,alpha:1,
  scaleX:.2,scaleY:.2,displayOriginX:192,displayOriginY:384,
  frame:{...f,source:{image}}};
view.s.shadows=[];view.draw(actor,new Set());
const mesh=view.entries.get(actor).mesh;
assert.equal(mesh.scale.x,.2);assert.equal(mesh.scale.y,.2,'presentation preserves the current authored size');
actor.frame={...actor.frame,width:110,u0:.4,u1:.8};view.draw(actor,new Set());
assert.equal(view.entries.get(actor).mesh,mesh,'animation reuses its mesh');
assert.equal(mesh.geometry.attributes.uv.array[0],Math.fround(.4),'atlas UVs change with the current attack frame');
assert.equal(view.textures.size,1,'characters share their source texture rather than copying each atlas frame');
const floating={...actor,x:800,y:550,depth:100050,worldAnchorY:600};
view.draw(floating,new Set());
const floatingMesh=view.entries.get(floating).mesh;
const up=new THREE.Vector3(0,1,0).applyQuaternion(view.camera.quaternion);
assert.ok(floatingMesh.position.distanceTo(new THREE.Vector3(800,0,600).addScaledVector(up,50))<1e-8,'combat text uses the target ground anchor');
const beforeFloat=floatingMesh.position.clone();floating.y-=24;view.draw(floating,new Set());
assert.ok(floatingMesh.position.clone().sub(beforeFloat).distanceTo(up.clone().multiplyScalar(24))<1e-8,'damage rises vertically in camera space without depth drift');
const groundRoot={x:800,y:600,depth:598,worldGroundEffect:true,worldGroundAspect:.5};
const groundChild={...actor,parentContainer:groundRoot,blendMode:Phaser.BlendModes.ADD,getWorldTransformMatrix:()=>({a:.7,b:.35,c:-.7,d:.35,tx:800,ty:600})};
view.draw(groundChild,new Set(),1,groundRoot);
const groundMesh=view.entries.get(groundChild).mesh;
assert.equal(groundMesh.position.y,.24,'floor effects sit above the painted floor');
assert.equal(groundMesh.material.alphaTest,0,'fading effects keep soft transparent edges');
assert.equal(groundMesh.material.depthWrite,false,'transparent glow does not occlude other effects');
assert.ok(new THREE.Vector3(0,0,1).applyQuaternion(groundMesh.quaternion).distanceTo(new THREE.Vector3(0,1,0))<1e-8,'runes lie on the ground');
const local=frameQuad(groundChild.frame,192,384).positions;
assert.ok(Math.abs(groundMesh.geometry.attributes.position.getX(0)-(.7*local[0]+.7*local[1]))<1e-4);
assert.ok(Math.abs(groundMesh.geometry.attributes.position.getY(0)-(-.35*local[0]+.35*local[1])/.5)<1e-4,'rotating rune preserves its complete parent affine transform and removes only authored perspective compression');
const particle={x:0,y:-10,scaleX:.3,scaleY:.3,rotation:0,alpha:.8,tint:0xffffff,lifeCurrent:100,frame:actor.frame};
const emitter={type:'ParticleEmitter',visible:true,alpha:1,depth:99990,scaleX:1,scaleY:1,blendMode:1,alive:[particle],follow:{y:600},getWorldTransformMatrix:()=>({a:1,b:0,c:0,d:1,tx:0,ty:0})};
view.draw(emitter,new Set());assert.equal(particle._threeProxy.worldAnchorY,600);
emitter.follow.y=650;particle.lifeCurrent=80;view.draw(emitter,new Set());assert.equal(particle._threeProxy.worldAnchorY,600,'existing particles retain their birth anchor');
particle.lifeCurrent=200;view.draw(emitter,new Set());assert.equal(particle._threeProxy.worldAnchorY,650,'reused particles capture the new emission anchor');
view.s.cameras={main:{zoom:2}};
const screenRoot={x:0,y:0,depth:100000,scrollFactorX:0,scrollFactorY:0};
const screenChild={...groundChild,parentContainer:screenRoot};
view.draw(screenChild,new Set(),1,screenRoot);
const screenMesh=view.entries.get(screenChild).mesh;
assert.equal(screenMesh.parent,view.overlay);
assert.deepEqual(screenMesh.scale.toArray(),[2,-2,1],'screen containers apply the affine matrix once and camera zoom once');
assert.ok(Math.abs(screenMesh.geometry.attributes.position.getX(0)-(.7*local[0]+.7*local[1]))<1e-4);
console.log('Three.js world: frame trims, pixel scales, pointer projection, all map families, transitions and GPU cleanup passed.');

const ghost={...actor,def:{behavior:'flyer',palette:{glow:'#58d68d'}},spawn:{id:'krasue'},d8id:'mob_krasue',alive:true,mid:0};
view.draw(ghost,new Set());const monsterEntry=view.actors.entries.get(ghost);
assert.ok(monsterEntry.root.isGroup);assert.equal(monsterEntry.root.position.x,ghost.x);assert.equal(monsterEntry.root.position.z,ghost.y);
assert.equal(mesh.scale.x,actor.scaleX,'the reviewed player atlas remains at its authored scale');
assert.equal(view.entries.has(ghost),false,'a 3D monster does not also display its old sprite');
ghost.alive=false;view.actors.draw(ghost,10,Math.PI/3);assert.equal(monsterEntry.root.visible,true,'death begins with a visible collapse');view.actors.draw(ghost,11,Math.PI/3);assert.equal(monsterEntry.root.visible,false,'death animation finishes before the simulation removes the corpse');
ghost.alive=true;ghost.tintFill=true;ghost.tintTopLeft=0xffffff;view.actors.draw(ghost,12,Math.PI/3);assert.ok(monsterEntry.materials.skin.color.r>.7,'a damage flash remains readable');
console.log('3D monster presentation: positions, player scale, death collapse and hit flash passed.');
for(const d8id of ['npc_ruesi','hero_female_silk']){const npc={...actor,d8id,npcVisual:{id:'shop',color:'#ead8b0'}};view.draw(npc,new Set());const e=view.actors.entries.get(npc);assert.equal(e.kind,'npc');assert.equal(e.root.position.x,npc.x);assert.ok(npc.worldLabelHeight>0);assert.equal(view.entries.has(npc),false);}
assert.equal(view.entries.get(actor).material.isMeshBasicMaterial,true,'player sprites keep their reviewed appearance');
console.log('3D NPC presentation: service NPCs, walking townsfolk, positions and labels passed.');
