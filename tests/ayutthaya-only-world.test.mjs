import assert from 'node:assert/strict';
import {ARCHIVED_MAP_LIST,CLASSIC_WORLD_ENABLED,MAP_LIST,MAPS,mapAt} from '../shared/data/maps.js';
import {TD_MAP_IDS,TD_MAPS,getMap} from '../shared/td/maps.js';
import {setupMobs} from '../server/mobs.js';

assert.equal(CLASSIC_WORLD_ENABLED,false);
assert.deepEqual(MAP_LIST.map((m)=>m.id),['village'],'legacy map selector exposes no hunt maps, arena or dungeon');
assert.equal(ARCHIVED_MAP_LIST.length,23,'map definitions stay available for later redesign');
for(const x of [-100,0,1100,12000,25000])assert.equal(mapAt(x).id,'village','legacy coordinates cannot select an archived map');
assert.ok(MAPS.m1&&MAPS.dungeon,'archived references remain available to migration code');

assert.deepEqual(TD_MAP_IDS,['ayutthaya']);
assert.deepEqual(Object.keys(TD_MAPS),['ayutthaya']);
assert.ok(getMap('ayutthaya').layout().spawns.length>0,'Ayutthaya keeps its own starting-zone monsters');

const mobs=setupMobs({to:()=>({emit(){}}),sockets:{sockets:new Map()}},new Map());
assert.equal(mobs.count(),0,'old-world monster species are no longer simulated');
mobs.tick();
console.log('Ayutthaya-only phase: legacy maps and mobs inactive; Ayutthaya map and spawns retained.');
