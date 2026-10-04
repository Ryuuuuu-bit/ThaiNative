import { QUEST_BY_ID, questGiver } from '/shared/data/village.js';
import { questState } from '/shared/economy.js';
import { MONSTERS } from '/shared/data/monsters.js';
import { WORLD } from '/shared/constants.js';
import { TD_MAPS, EVENT_MAPS } from '/shared/td/maps.js';
import { TILE, T, HERB_SPOTS } from '/shared/td/ayutthaya.js';

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Walk through existing paths and portals; quest progress stays server-authoritative. */
export class QuestNavigator {
  constructor(scene) {
    this.s = scene;
    this.id = null;
    this.phase = 'idle';
    this.fishingSpots = new Map();
    this.line = scene.add.graphics().setDepth(1.1);
    this.panel = document.createElement('section');
    this.panel.id = 'quest-nav';
    this.panel.className = 'hidden';
    this.panel.innerHTML = '<strong></strong><span aria-live="polite"></span><button type="button">หยุดนำทาง</button>';
    this.panel.querySelector('button').onclick = () => this.stop();
    document.querySelector('#hud').appendChild(this.panel);
    scene.events.once('shutdown', () => { this.panel.remove(); this.line.destroy(); });
  }

  get travelling() { return !!this.id && this.phase === 'moving'; }

  start(id) {
    const q = QUEST_BY_ID[id], s = this.s;
    if (!q || !s.player.alive) return;
    const state = questState(s.player.char, q);
    if (state === 'locked' || state === 'done') return s.ui.toast('เควสนี้ยังนำทางไม่ได้', 'warn');
    this.stop();
    this.id = id;
    this.phase = 'moving';
    this.signature = null;
    this.nextTick = 0;
    s.player.target = null; s.player.autoTarget = null;
    s.pendingTalk = null;
    s.social?.pw?.stopFollow();
    if (s.social) s.social.pkTarget = null;
    s.ui.closeAll();
    this.panel.classList.remove('hidden');
    this.panel.querySelector('strong').textContent = q.nameTh;
    this.update(s.time.now);
    s.village.renderTracker();
  }

  stop(message = '') {
    if (!this.id) return;
    if (this.id && this.phase === 'moving') {
      this.s.player.path = [];
      this.s.player.setVelocity(0, 0);
    }
    this.id = null; this.phase = 'idle'; this.destination = null;
    this.line.clear(); this.panel.classList.add('hidden');
    this.s.village?.renderTracker();
    if (message) this.s.ui.toast(message, 'warn');
  }

  status(text) { this.panel.querySelector('span').textContent = text; }

  route(from, to) {
    const queue = [[from]], seen = new Set([from]);
    for (let i = 0; i < queue.length; i++) {
      const path = queue[i], current = path.at(-1);
      if (current === to) return path;
      const map = TD_MAPS[current];
      if (!map) continue;
      for (const gate of map.layout().portals || []) {
        const next = TD_MAPS[gate.to];
        if (!next || seen.has(gate.to) || EVENT_MAPS.has(gate.to) || next.reqLv > this.s.player.char.level) continue;
        seen.add(gate.to); queue.push([...path, gate.to]);
      }
    }
    return null;
  }

  matchingMonster(goal, spawn) {
    const def = MONSTERS[spawn.id];
    return def && (!goal.minLv || def.level >= goal.minLv) &&
      (goal.kill === 'any' || goal.kill === spawn.id || (goal.kill === 'grave' && def.zone?.[0] >= WORLD.graveX));
  }

  waterSpots(map) {
    if (this.fishingSpots.has(map.id)) return this.fishingSpots.get(map.id);
    const { ground, solid } = map.layout(), spots = [];
    if (!map.noFish) for (let y = 1; y < ground.length - 1; y++) for (let x = 1; x < ground[y].length - 1; x++) {
      if (solid[y]?.[x]) continue;
      if ([[0,1],[0,-1],[1,0],[-1,0]].some(([dx,dy]) => [T.WATER,T.WATER2].includes(ground[y+dy]?.[x+dx])))
        spots.push({ x: x*TILE+TILE/2, y: y*TILE+TILE/2 });
    }
    this.fishingSpots.set(map.id, spots);
    return spots;
  }

  resolve(q, state) {
    if(q.realm&&!TD_MAPS[q.realm]){this.status('พื้นที่เควสนี้พักไว้ระหว่างพัฒนาอโยธยา');return null;}
    const s = this.s, p = s.player, candidates = [];
    if (state === 'open' || state === 'ready') {
      const giver = questGiver(q);
      const maps = giver === 'quest' ? [s.M.id, q.realm, 'ayutthaya'] : ['ayutthaya'];
      for (const id of new Set(maps.filter(Boolean))) {
        const n = TD_MAPS[id]?.layout().npcs?.find((n) => n.id === giver);
        if (n) candidates.push({ ...n, map: id, kind: 'npc', radius: 45 });
      }
    } else if (q.goal.herb) {
      for (const n of HERB_SPOTS) if (q.goal.herb === 'any' || q.goal.herb === n.item)
        candidates.push({ ...n, y: n.y+6, map: 'ayutthaya', kind: 'herb', radius: 26 });
    } else if (q.goal.heal || q.goal.revive) {
      this.status(q.goal.heal ? 'รักษาเพื่อนในปาร์ตี้เพื่อทำเควส' : 'ชุบชีวิตเพื่อนในปาร์ตี้เพื่อทำเควส');
      return null;
    } else {
      for (const map of Object.values(TD_MAPS)) {
        if (EVENT_MAPS.has(map.id) || map.reqLv > p.char.level || (q.realm && q.realm !== map.id)) continue;
        const points = q.goal.kill ? map.layout().spawns.filter((n) => this.matchingMonster(q.goal,n)) : this.waterSpots(map);
        for (const n of points) candidates.push({ ...n, map: map.id, kind: q.goal.kill ? 'kill' : 'fish', radius: q.goal.kill ? 60 : 12 });
      }
    }
    const routes = new Map();
    const ranked = candidates.map((c) => {
      if (!routes.has(c.map)) routes.set(c.map,this.route(s.M.id,c.map));
      return { ...c, route: routes.get(c.map) };
    }).filter((c) => c.route);
    ranked.sort((a,b) => (a.route.length-b.route.length) || distance(p,a)-distance(p,b));
    return ranked[0] || null;
  }

  update(time) {
    if (!this.id || time < this.nextTick) return;
    this.nextTick = time + 500;
    const s = this.s, p = s.player, q = QUEST_BY_ID[this.id];
    if (!p.alive) return this.stop('หยุดนำทางเพราะตัวละครตาย');
    if (s.warping || s.recalling) return;
    const state = questState(p.char,q);
    if (state === 'done' || state === 'locked') return this.stop();
    const signature = `${s.M.id}:${state}`;
    if (this.signature !== signature) {
      this.signature = signature;
      this.destination = this.resolve(q,state);
      this.phase = 'moving'; this.lastPosition = null; this.stuck = 0;
      if (!this.destination) {
        if (q.goal.heal || q.goal.revive) { this.phase = 'waiting'; return; }
        return this.stop('ไม่พบเส้นทางไปเป้าหมายที่เข้าได้ในเลเวลนี้');
      }
      p.target = null; p.autoTarget = null; p.path = [];
    }
    const dest = this.destination;
    if (!dest || this.phase === 'waiting') return;
    const route = this.route(s.M.id,dest.map);
    if (!route) return this.stop('ไม่พบเส้นทางเชื่อมแผนที่');
    const portal = route.length > 1 ? s.portals.find((n) => n.to === route[1]) : null;
    if (route.length > 1 && !portal) return this.stop('ไม่พบประตูไปแผนที่เป้าหมาย');
    const target = portal || (dest.kind === 'npc' ? s.npcs.find((n) => n.id === dest.id) || dest : dest);
    if (distance(p,target) <= (portal ? 16 : dest.radius)) {
      p.path = []; this.line.clear();
      if (portal) { s.portalArmed = true; s.warpTo(portal.to,'portal'); return; }
      this.phase = 'waiting';
      if (dest.kind === 'npc') {
        this.stop();
        s.talk(target,dest.id === 'quest');
        if (dest.id.startsWith('kru_') && s.ui.shopTabs?.includes('quests')) {
          s.ui.shopTab = 'quests'; s.ui.renderShop();
        }
        return;
      }
      this.status(dest.kind === 'kill' ? 'ถึงพื้นที่เป้าหมายแล้ว · ทำเควสครบจะนำกลับไปส่ง' : dest.kind === 'fish' ? 'ถึงจุดตกปลาแล้ว · กด F เพื่อตกปลา' : 'ถึงจุดเก็บสมุนไพรแล้ว · กด F เพื่อเก็บ');
      s.ui.toast('ถึงเป้าหมายเควสแล้ว', 'ok');
      return;
    }
    if (this.lastPosition && distance(p,this.lastPosition) < 2) this.stuck++;
    else this.stuck = 0;
    this.lastPosition = { x:p.x,y:p.y };
    if (this.stuck > 16) return this.stop('เดินไปเป้าหมายไม่ได้ ลองขยับตัวแล้วกดนำทางอีกครั้ง');
    if (!p.path.length || this.stuck === 6) s.moveTo(target.x,target.y,true);
    if (!p.path.length) return this.stop('หาทางเดินไปเป้าหมายไม่พบ');
    this.status(`${portal ? 'เดินผ่านประตูไป' : 'กำลังเดินไปเป้าหมายใน'} ${TD_MAPS[portal?.to || dest.map]?.nameTh} · ${Math.round(distance(p,target)/TILE)} ช่อง`);
    this.line.clear().lineStyle(2,0xffdc73,0.85).beginPath();
    // Carry the dash phase across corners so short path segments still have gaps.
    let from = p, phase = 0;
    const dash = 10, cycle = 17;
    for (const point of p.path) {
      const length = distance(from,point);
      let offset = 0;
      while (offset < length) {
        const drawing = phase < dash;
        const step = Math.min((drawing ? dash : cycle) - phase,length - offset);
        if (drawing) {
          this.line.moveTo(from.x + (point.x-from.x)*offset/length,from.y + (point.y-from.y)*offset/length);
          this.line.lineTo(from.x + (point.x-from.x)*(offset+step)/length,from.y + (point.y-from.y)*(offset+step)/length);
        }
        offset += step;
        phase = (phase + step) % cycle;
      }
      from = point;
    }
    this.line.strokePath();
  }
}
