import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TD_MAPS } from '../shared/td/maps.js';
import { QUESTS } from '../shared/data/village.js';

// Map browser-root imports to file URLs so the actual navigator runs under Node.
const source = (await readFile(new URL('../client/js/topdown/QuestNavigator.js',import.meta.url),'utf8'))
  .replaceAll(/from '(\/shared\/[^']+)'/g, (_,path) => `from '${new URL('..'+path,import.meta.url).href}'`);
const { QuestNavigator } = await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const nav = Object.create(QuestNavigator.prototype);
nav.s = { M: TD_MAPS.ayutthaya, player: { ...TD_MAPS.ayutthaya.spawn, char: { level: 1 } } };
nav.fishingSpots = new Map();
nav.status = () => {};
assert.deepEqual(nav.route('ayutthaya','ayutthaya'),['ayutthaya']);
assert.equal(nav.route('ayutthaya','himmaphan'),null,'locked realms must not be traversed');
nav.s.player.char.level = 150;
assert.equal(nav.route('ayutthaya','himmaphan'),null,'paused realms stay closed even at maximum level');
assert.equal(nav.route('ayutthaya','suriya'),null,'event entry is not an ordinary portal route');
const kill = QUESTS.find((q) => q.goal.kill === 'phi_tuay_kaew');
assert.equal(nav.resolve(kill,'active').kind,'kill');
assert.equal(nav.resolve(kill,'ready').kind,'npc','completed goals must return to a quest giver');
const fish = QUESTS.find((q) => q.goal.fish);
const shore = nav.resolve(fish,'active');
assert.equal(shore.kind,'fish');
assert.equal(TD_MAPS[shore.map].layout().solid[Math.floor(shore.y/16)][Math.floor(shore.x/16)],false,'fishing destination must be on land');
assert.equal(nav.resolve(QUESTS.find((q) => q.goal.herb),'active').map,'ayutthaya');
assert.equal(nav.resolve(QUESTS.find((q) => q.goal.heal),'active'),null,'party healing must not invent a world location');
assert.equal(nav.matchingMonster({kill:'phi_tuay_kaew',minLv:150},{id:'phi_tuay_kaew'}),false);
console.log('Quest navigation: routes, level gates, destinations, shoreline and party goals passed');
