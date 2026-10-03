import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {frameQuad,graphicsBounds,WORLD_TILT} from '../client/js/topdown/ThreeWorldMath.js';
import {TD_MAP_IDS,getMap} from '../shared/td/maps.js';
import {TILE} from '../shared/td/ayutthaya.js';
import {GD_BOSSES,GD_DIFFS} from '../shared/data/ghostdg.js';

// Import the browser module with the same Three build, resolving its URL imports.
const url=new URL('../client/js/topdown/ThreeWorld.js',import.meta.url);
const citySource=(await readFile(new URL('../client/js/topdown/AyutthayaCity.js',import.meta.url),'utf8')).replace('/vendor/three/three.module.js',new URL('../node_modules/three/build/three.module.js',import.meta.url).href);
const cityURL='data:text/javascript;base64,'+Buffer.from(citySource).toString('base64');
const monsterSource=(await readFile(new URL('../client/js/topdown/MonsterLook.js',import.meta.url),'utf8')).replace('/vendor/three/three.module.js',new URL('../node_modules/three/build/three.module.js',import.meta.url).href);
const monsterURL='data:text/javascript;base64,'+Buffer.from(monsterSource).toString('base64');
const source=(await readFile(url,'utf8'))
  .replace('/vendor/three/three.module.js',new URL('../node_modules/three/build/three.module.js',import.meta.url).href)
  .replace('/shared/td/ayutthaya.js',new URL('../shared/td/ayutthaya.js',import.meta.url).href)
  .replace('./MonsterLook.js',monsterURL)
  .replace('./AyutthayaCity.js',cityURL)
  .replace('./ThreeWorldMath.js',new URL('../client/js/topdown/ThreeWorldMath.js',import.meta.url).href);
const {ThreeWorld}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
globalThis.Phaser={BlendModes:{ADD:1,MULTIPLY:2}};

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

view.entries=new Map();view.textures=new Map();view.frameNumber=1;view.overlay=new THREE.Scene();
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
console.log('Three.js world: frame trims, pixel scales, pointer projection, all map families, transitions and GPU cleanup passed.');

const ghost={...actor,def:{behavior:'flyer',palette:{glow:'#58d68d'}},spawn:{id:'krasue'},d8id:'mob_krasue',alive:true,mid:0};
view.draw(ghost,new Set());const monsterEntry=view.entries.get(ghost);
assert.ok(monsterEntry.material.isShaderMaterial);assert.equal(monsterEntry.mesh.scale.x,actor.scaleX);
assert.equal(monsterEntry.material.uniforms.atlas.value,view.entries.get(actor).material.map,'monster rendering shares the original animation atlas');
assert.equal(monsterEntry.mesh.castShadow,true);assert.equal(monsterEntry.aura.visible,true);
ghost.alive=false;view.draw(ghost,new Set());assert.equal(monsterEntry.aura.visible,false,'death disables the living aura while preserving the death animation');
ghost.tintFill=true;view.draw(ghost,new Set());assert.equal(monsterEntry.material.uniforms.fillTint.value,1,'hit flashes remain visible');
console.log('Monster presentation: lighting, original size/atlas, alpha shadows, death and hit flash passed.');

for(const d8id of ['npc_ruesi','hero_female_silk']){
  const npc={...actor,d8id,npcVisual:{color:'#ead8b0'}};view.draw(npc,new Set());const e=view.entries.get(npc);
  assert.equal(e.material.userData.npc,true,'service NPCs and walking townsfolk receive the same presentation');
  assert.equal(e.mesh.castShadow,true);assert.equal(e.aura,undefined,'NPCs do not receive hostile monster auras');
  assert.equal(e.mesh.scale.x,actor.scaleX);assert.equal(e.material.uniforms.atlas.value,view.entries.get(actor).material.map);
  assert.ok(e.material.uniforms.rim.value<monsterEntry.material.uniforms.rim.value);
}
assert.equal(view.entries.get(actor).material.isMeshBasicMaterial,true,'player sprites keep their existing appearance');
console.log('NPC presentation: service NPCs, walking townsfolk, original scale and atlas, soft lighting and shadows passed.');
