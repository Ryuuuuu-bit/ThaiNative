import * as THREE from '/vendor/three/three.module.js';
import { actorKind } from './VisualAssets.js';

const directions = { south: 0, 'south-west': -Math.PI/4, west: -Math.PI/2,
  'north-west': -Math.PI*3/4, north: Math.PI, 'north-east': Math.PI*3/4,
  east: Math.PI/2, 'south-east': Math.PI/4 };

/** Original articulated world actors. The player keeps its reviewed animation atlas.
 * Only presentation changes; Phaser and the server still own positions and combat.
 */
export class WorldActors {
  constructor(world) {
    this.world = world; this.entries = new Map(); this.seen = new Set();
    this.geometry = {
      sphere: new THREE.SphereGeometry(1, 12, 10),
      box: new THREE.BoxGeometry(1, 1, 1),
      cone: new THREE.ConeGeometry(1, 1, 12),
      cylinder: new THREE.CylinderGeometry(1, 1, 1, 12),
      crystal: new THREE.OctahedronGeometry(1),
      ring: new THREE.RingGeometry(.85, 1, 32),
    };
  }

  create(object) {
    const kind = actorKind(object), def = object.def || {};
    const id = object.npcVisual?.id || object.spawn?.id || object.d8id;
    const female = /tani|phrai|nang|krasue|healer|shop|tailor|cook|woman/.test(id);
    const monk = /warp|crypt|mage/.test(id);
    const clothing = def.palette?.main || (monk ? '#a7844d'
      : /smith|sword/.test(id) ? '#364d5c' : /shop|cook/.test(id) ? '#9c6957'
      : /market|quest/.test(id) ? '#677c60' : '#48756b');
    const palette = { cloth: clothing, skin: kind === 'npc' ? '#c3a07e' : '#b7b7a1',
      hair: '#292d31', gold: '#bea064', dark: '#344443', sash: '#a15e48',
      eye: def.palette?.glow || '#c5d5ca', bone: '#d3c9aa' };
    if (kind === 'child') palette.skin = '#d0b15d';
    const materials = Object.fromEntries(Object.entries(palette).map(([key, color]) =>
      [key, new THREE.MeshStandardMaterial({ color, roughness: .78,
        metalness: key === 'gold' ? .38 : 0,
        emissive: key === 'eye' ? color : '#000000', emissiveIntensity: .55 })]));
    for(const material of Object.values(materials))material.userData.baseColor=material.color.clone();
    const root = new THREE.Group(); root.name = `World actor: ${id}`;
    const body = new THREE.Group(); root.add(body);
    const parts = [], mesh = (parent, geometry, material, x, y, z, sx, sy, sz) => {
      const part = new THREE.Mesh(this.geometry[geometry], materials[material]);
      part.position.set(x, y, z); part.scale.set(sx, sy, sz);
      part.castShadow = true; part.receiveShadow = true; part.userData.object = object;
      parent.add(part); return part;
    };
    const limb = (x, y, z, length, material, width = 1.6) => {
      const pivot = new THREE.Group(); pivot.position.set(x, y, z); body.add(pivot);
      mesh(pivot, 'sphere', material, 0, -length/2, 0, width, length/2, width);
      parts.push(pivot); return pivot;
    };
    let height = 40, gait = 1, floating = def.behavior === 'flyer';
    if (kind === 'crystal') {
      height = 35; mesh(body, 'crystal', 'eye', 0, 17, 0, 8, 17, 8);
      mesh(body, 'cylinder', 'gold', 0, 3, 0, 12, 5, 12);
    } else if (kind === 'serpent') {
      height = 31; gait = .25;
      for (let i=0; i<8; i++) {
        const segment = mesh(body, 'sphere', 'cloth', Math.sin(i*.85)*7, 4+i*1.2, -i*3.8, 4-i*.25, 4, 4);
        parts.push(segment);
      }
      mesh(body,'sphere','skin',0,22,2,5,7,4);
      for(const x of [-2.5,2.5])mesh(body,'sphere','eye',x,24,5,1,.7,.5);
      mesh(body,'cone','gold',0,32,0,3,10,3);
    } else if (kind === 'beast') {
      height=26; gait=1.1;
      mesh(body,'sphere','cloth',0,14,-3,5,6,12);
      mesh(body,'sphere','skin',0,18,9,5,5,5);
      for(const x of [-3.7,3.7])for(const z of [-10,5])limb(x,13,z,12,'dark',1.8);
      for(const x of [-3,3]) {mesh(body,'cone','cloth',x,24,7,1.8,5,2);mesh(body,'sphere','eye',x,19,13,1,.7,.5);}
      mesh(body,'sphere','dark',0,16,13,2,1.5,2);
    } else if (kind === 'krasue') {
      height=39; floating=true;
      mesh(body,'sphere','hair',0,29,0,6,8,5);
      mesh(body,'sphere','skin',0,28,3,4.3,5,2.8);
      for(const x of [-2,2])mesh(body,'sphere','eye',x,29,5.5,.7,.6,.4);
      for(let i=0;i<5;i++){const strand=mesh(body,'sphere','sash',(i-2)*1.6,13-i*.8,0,.9,10,.9);parts.push(strand);}
    } else if (kind === 'scarecrow') {
      height=41;
      mesh(body,'cylinder','dark',0,16,0,1.4,32,1.4);
      mesh(body,'sphere','cloth',0,25,0,5,9,3);
      mesh(body,'cylinder','dark',0,27,0,1,22,1).rotation.z=Math.PI/2;
      mesh(body,'sphere','cloth',0,36,0,4,4,3.5);
      mesh(body,'cone','gold',0,41,0,7,5,7);
      for(const x of [-1.6,1.6])mesh(body,'sphere','eye',x,36,3.2,.6,.6,.4);
    } else {
      const giant=kind==='guardian', child=kind==='child';
      const broad=giant?1.3:1;
      mesh(body,'sphere','cloth',0,23,0,5*broad,9,3.4*broad);
      mesh(body,'box','sash',0,17,0,10*broad,2,7*broad);
      if(female||monk||kind==='spirit')mesh(body,'cone','cloth',0,10,0,6*broad,17,4.5*broad);
      const legs=[limb(-2.5,15,0,14,'dark'),limb(2.5,15,0,14,'dark')];
      for(const x of [-2.5,2.5])mesh(body,'sphere','dark',x,1,1,2.3,1.2,3);
      const arms=[limb(-6*broad,29,0,13,'cloth'),limb(6*broad,29,0,13,'cloth')];
      for(const arm of arms)mesh(arm,'sphere','skin',0,-13,0,1.6,2,1.5);
      mesh(body,'sphere','hair',0,36,0,3.5,4,3.2);
      mesh(body,'sphere','skin',0,35.3,1.4,2.8,3.4,2.6);
      for(const x of [-1.4,1.4])mesh(body,'sphere',kind==='npc'?'hair':'eye',x,36,4.2,.45,.45,.35);
      mesh(body,'sphere','skin',0,34.5,4.4,.65,.8,.65);
      if(female)mesh(body,'sphere','hair',0,31,-2.5,4.5,7,2.5);
      if(monk)mesh(body,'cone','gold',0,41,0,5.5,6,5.5);
      if(giant){
        mesh(body,'cone','gold',0,45,0,5,13,5);height=52;
        for(const x of [-7,7])mesh(body,'sphere','gold',x,28,0,3,3,4);
        mesh(arms[1],'cylinder','gold',0,-18,1,2,23,2);
      }
      if(/smith/.test(id)) {mesh(arms[1],'box','dark',0,-15,2,5,3,3);mesh(arms[1],'cylinder','wood' in materials?'wood':'gold',0,-12,2,.7,7,.7);}
      if(/market|shop|cook/.test(id)){mesh(body,'cone','gold',0,41,0,7,4,7);height=43;}
      if(/kru_sword|kru_boxer/.test(id))mesh(body,'box','sash',0,39,0,9,1,8);
      if(/quest/.test(id))mesh(arms[0],'box','bone',0,-13,3,5,7,1);
      if(kind==='winged')for(const side of [-1,1]){
        const wing=mesh(body,'sphere','cloth',side*13,26,-3,12,3,6);wing.rotation.z=side*.35;parts.push(wing);
      }
      if(child){body.scale.setScalar(.68);height*=.68;}
      root.userData.legs=legs;root.userData.arms=arms;
    }
    const multiplier=def.boss?Math.min(2.1,def.scale||1.7):def.elite?1.15:1;
    materials.selection=new THREE.MeshBasicMaterial({color:kind==='npc'?0x89c6b9:0xe3ba78,transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false});
    const selection=new THREE.Mesh(this.geometry.ring,materials.selection);selection.rotation.x=-Math.PI/2;
    selection.position.y=.2;selection.scale.setScalar(Math.max(9,height*.32));selection.visible=false;root.add(selection);
    root.scale.setScalar(multiplier);
    const e={root,body,parts,selection,kind,height:height*multiplier,materials,gait,floating,lastX:object.x,lastY:object.y};
    object.worldVisualHeight=e.height;
    this.world.add(root); this.entries.set(object,e);return e;
  }

  begin() { this.seen.clear(); }
  draw(object, time, tilt, selected = false) {
    const e=this.entries.get(object)||this.create(object);this.seen.add(object);
    const clip=object.anims?.currentAnim?.key?.split(':').find(k=>['walk','attack','cast','slash','shoot','hit','idle'].includes(k))||'idle';
    const distance=Math.hypot(object.x-e.lastX,object.y-e.lastY);
    const walking=distance>.03||clip==='walk', attacking=['attack','cast','slash','shoot'].includes(clip);
    const phase=time*7.5+object.x*.03;
    e.root.position.set(object.x,0,object.y);
    e.root.rotation.y=directions[object.dir]??0;
    e.body.position.y=e.floating?Math.sin(time*2.5)*1.2+3:walking?Math.abs(Math.sin(phase))*.65:0;
    (e.root.userData.legs||[]).forEach((p,i)=>p.rotation.x=walking?Math.sin(phase+i*Math.PI)*.35:0);
    (e.root.userData.arms||[]).forEach((p,i)=>p.rotation.x=attacking?-1.3+Math.sin(time*14)*.3:walking?-Math.sin(phase+i*Math.PI)*.27:Math.sin(time*2+i)*.04);
    if(e.kind==='crystal')e.body.rotation.y=time*.3;
    if(e.kind==='serpent')e.parts.forEach((p,i)=>p.position.x=Math.sin(time*3+i*.85)*7);
    if(e.kind==='krasue')e.parts.forEach((p,i)=>p.rotation.z=Math.sin(time*2+i)*.12);
    if(object.alive===false&&e.deadAt===undefined)e.deadAt=time;
    if(object.alive!==false)e.deadAt=undefined;
    const dying=e.deadAt===undefined?0:Math.min(1,(time-e.deadAt)/.45);
    e.body.rotation.z=dying*1.1;
    e.root.visible=object.visible!==false&&dying<1;
    const opacity=Math.min(object.alpha??1,1-dying);
    e.selection.visible=selected;
    for(const material of Object.values(e.materials)){
      material.transparent=opacity<1;material.opacity=opacity;
      if(material.isMeshStandardMaterial){material.color.copy(material.userData.baseColor);if(object.tintFill)material.color.lerp(new THREE.Color(object.tintTopLeft??0xffffff),.8);material.emissiveIntensity=object.tintFill?.5:.25;}
    }
    e.lastX=object.x;e.lastY=object.y;
    // Match the labels' screen-facing offsets to the new model height.
    object.worldLabelHeight=e.height*Math.sin(tilt)+6;
  }
  release(object,e) {e.root.removeFromParent();for(const m of Object.values(e.materials))m.dispose();this.entries.delete(object);}
  end() {for(const [o,e]of this.entries)if(!this.seen.has(o))this.release(o,e);}
  dispose() {for(const [o,e]of this.entries)this.release(o,e);for(const g of Object.values(this.geometry))g.dispose();}
}
