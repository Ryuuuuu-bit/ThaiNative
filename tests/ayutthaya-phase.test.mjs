import assert from 'node:assert/strict';
import {TD_MAP_IDS,TD_MAPS,ALL_TD_MAP_IDS,getMap,getArchivedMap,validMap,EXPANSIONS_ENABLED} from '../shared/td/maps.js';
import {setupTD} from '../server/td.js';
import {newCharacter} from '../shared/charmodel.js';
import {setupWorldBoss} from '../server/worldboss.js';

assert.equal(EXPANSIONS_ENABLED,false);
assert.deepEqual(TD_MAP_IDS,['ayutthaya']);assert.deepEqual(Object.keys(TD_MAPS),['ayutthaya']);
for(const id of [...ALL_TD_MAP_IDS.slice(1),'crypt:1:1:test','gd:hung:normal:1:test']){
  assert.equal(validMap(id),'ayutthaya');assert.equal(getMap(id).id,'ayutthaya');
  assert.equal(getArchivedMap(id).id,id,'archived map art and layouts remain recoverable');
}
const layout=getMap('ayutthaya').layout();
assert.equal(layout.portals.length,0);assert.ok(layout.spawns.length>0);
assert.ok(!layout.npcs.some(n=>['warp','crypt','ghostdg'].includes(n.id)));
assert.ok(layout.npcs.some(n=>n.id==='shop'),'town services remain open');

const io={emit(){},to:()=>({emit(){}}),sockets:{sockets:new Map()}},players=new Map();
const td=setupTD(io,players);
assert.deepEqual(Object.keys(td._worlds),['ayutthaya'],'server simulates only the open map');
for(const oldMap of ['himmaphan','suriya','crypt:50:1:old','gd:hung:normal:1:old']){
  const handlers=new Map(),emitted=[];
  const socket={id:oldMap,join(){},leave(){},to:()=>({emit(){}}),on:(k,fn)=>handlers.set(k,fn),emit:(k,v)=>emitted.push([k,v])};
  const save=newCharacter('ผู้กล้าทดสอบ',{gender:'male',job:'boxer'});
  save.tdMap=oldMap;save.tdPos={x:200,y:200};save.level=35;save.gold=4321;
  const inventory=JSON.stringify(save.inventory);
  const p={id:oldMap,name:save.name,save,level:save.level,hp:save.hp,maxHp:save.hp,appearance:save.appearance,world:'old'};
  players.set(p.id,p);io.sockets.sockets.set(p.id,socket);td.onConnection(socket);
  handlers.get('td:enter')();
  assert.equal(p.tmap,'ayutthaya');assert.deepEqual(save.tdPos,getMap('ayutthaya').spawn);
  assert.equal(save.level,35);assert.equal(save.gold,4321);assert.equal(JSON.stringify(save.inventory),inventory);
  handlers.get('td:warp')({to:'himmaphan',via:'npc'});
  handlers.get('crypt:enter')({floor:1});handlers.get('gd:enter')({boss:'hung',diff:'normal'});
  assert.ok(emitted.some(([k])=>k==='td:warpFail'));assert.ok(emitted.some(([k])=>k==='crypt:fail'));assert.ok(emitted.some(([k])=>k==='gd:fail'));
  assert.equal(td.gmWarp(p,socket,'crypt:20'),false);
  assert.deepEqual(Object.keys(td._worlds),['ayutthaya'],'closed entrances cannot allocate an instance');
}
// A paused event must neither advertise an inaccessible arena nor crash its scheduled tick.
const interval=globalThis.setInterval,ticks=[],broadcasts=[];
globalThis.setInterval=fn=>{ticks.push(fn);return 0;};
let wb;
try{wb=setupWorldBoss({...io,emit:(...args)=>broadcasts.push(args)},players,{td,hurtPlayer(){},queueSync(){}});}
finally{globalThis.setInterval=interval;}
assert.equal(wb.status().state,'disabled');assert.equal(wb.isOpen(),false);
ticks.forEach(fn=>fn());assert.equal(broadcasts.length,0);
const wbHandlers=new Map(),wbEmits=[];
wb.onConnection({id:'himmaphan',on:(k,fn)=>wbHandlers.set(k,fn),emit:(...args)=>wbEmits.push(args)});
assert.equal(wbEmits.length,0);
let go;wbHandlers.get('wb:go')({},r=>go=r);assert.equal(go.ok,false);
assert.match(wb.gm('now'),/พักไว้/);
console.log('Ayutthaya phase: closed maps and events, archived content, server entrances and safe saved-character migration passed.');
