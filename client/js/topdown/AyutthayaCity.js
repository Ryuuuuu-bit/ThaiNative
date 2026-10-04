import * as THREE from '/vendor/three/three.module.js';

import { leafMaterial, addTreeCanopy, loadFoliageArt, treeCanopyKind } from './GardenWorld.js';
import { propKind } from './VisualAssets.js';
import { loadWorldMaterials } from './WorldMaterials.js';
import { bakeStaticMeshes } from './StaticMeshes.js';
export const cityPropKind = propKind;

export function buildAyutthayaCity(props,map={}) {
  const city=new THREE.Group();city.name='Ayutthaya 3D architecture';city.userData.ripples=[];
  const palette={plaster:0xe7cfab,stone:0xa79983,wood:0x816044,roof:0x9b604d,gold:0xe6b956,leaf:0x3c704b,leafLight:0x72955a,water:0x389aa4,cloth:0xc68443,window:0xe7bd71};
  if(map.id==='nagaphop'){palette.roof=0x397b83;palette.plaster=0xadd4ce;palette.leaf=0x286d72;}
  if(map.id==='naraka'){palette.roof=0x623d4c;palette.plaster=0x9c817b;palette.leaf=0x5a5062;}
  if(map.id==='dusit'){palette.roof=0xbcad81;palette.plaster=0xf0e2c4;palette.leaf=0x729b7c;}
  if(map.crypt||map.gd){palette.plaster=0xa49cab;palette.stone=0x6b6b7c;palette.wood=0x605447;palette.roof=0x665666;}
  if(map.id==='sumeru'){palette.roof=0x4f587c;palette.plaster=0xbbbccc;palette.leaf=0x61758e;}
  const materials=Object.fromEntries(Object.entries(palette).map(([name,color])=>[name,new THREE.MeshStandardMaterial({color,roughness:name==='water'?.24:.86,metalness:name==='gold'?.55:name==='water'?.18:0,flatShading:false,emissive:name==='window'?0xa66123:0,emissiveIntensity:.28})]));
  materials.foliage=leafMaterial(map.id==='naraka'?0xc8b4cb:0xffffff);
  materials.pine=leafMaterial(0xe3ede2);
  materials.blossom=leafMaterial(0xffd0d2);materials.autumn=leafMaterial(0xe1d2a1);
  materials.lamp=new THREE.MeshStandardMaterial({color:0xffe5b3,emissive:0xffb15c,emissiveIntensity:2.5,roughness:.4});
  city.userData.ownedMaterials=Object.values(materials);

  // Small original material textures provide grain and wear without external assets.
  if(typeof document!=='undefined')for(const name of ['roof','wood','stone','plaster','cloth']){
    const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');
    ctx.fillStyle='#d8d0c2';ctx.fillRect(0,0,128,128);
    for(let i=0;i<850;i++){const x=(i*73)%128,y=(i*47+Math.floor(i/128)*19)%128;ctx.fillStyle=i%2?'rgba(255,255,255,.1)':'rgba(45,28,15,.07)';ctx.fillRect(x,y,1,1);}
    ctx.strokeStyle='rgba(40,20,12,.22)';ctx.lineWidth=1;
    const step=name==='roof'?16:name==='wood'?12:32;
    for(let y=0;y<128;y+=step){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(128,y);ctx.stroke();
      if(name==='roof'||name==='stone')for(let x=(y/step%2)*16;x<128;x+=32){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+step);ctx.stroke();}}
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;
    materials[name].map=texture;
  }
  const cancelWorld=loadWorldMaterials(materials),cancelFoliage=loadFoliageArt(materials);
  city.userData.cancelTextureLoad=()=>{cancelWorld();cancelFoliage();};
  const templates=new Map();
  const add=(group,geometry,material,x,y,z)=>{const m=new THREE.Mesh(geometry,materials[material]);m.position.set(x,y,z);m.castShadow=material!=='water';m.receiveShadow=true;group.add(m);return m;};
  const box=(g,w,h,d,mat,x,y,z)=>add(g,new THREE.BoxGeometry(w,h,d),mat,x,y,z);
  const cylinder=(g,top,bottom,h,mat,x,y,z,n=12)=>add(g,new THREE.CylinderGeometry(top,bottom,h,n),mat,x,y,z);
  const roof=(g,w,d,y,mat='roof')=>{
    // Extruded steep gable with broad eaves; ridge runs along the house depth.
    const shape=new THREE.Shape();shape.moveTo(-w/2,0);shape.lineTo(0,w*.32);shape.lineTo(w/2,0);shape.lineTo(w/2,-3);shape.lineTo(-w/2,-3);shape.closePath();
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:d,bevelEnabled:false});
    const uv=geometry.attributes.uv;for(let i=0;i<uv.array.length;i++)uv.array[i]/=64;
    add(g,geometry,mat,0,y,-d/2);
    box(g,3,3,d+4,'gold',0,y+w*.32,0);
    const lines=[];for(let z=-d/2;z<=d/2;z+=7){lines.push(-w/2,y+.3,z,0,y+w*.32+.3,z,0,y+w*.32+.3,z,w/2,y+.3,z);}
    for(const side of [-1,1])for(let x=7;x<w/2;x+=8){const h=y+(w/2-x)*.64+.4;lines.push(side*x,h,-d/2,side*x,h,d/2);}
    const seams=new THREE.BufferGeometry();seams.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));g.add(new THREE.LineSegments(seams,new THREE.LineBasicMaterial({color:mat==='roof'?0x682c25:0x916633,transparent:true,opacity:.45})));
    for(const z of [-d/2,d/2]){const finial=cylinder(g,0,2,14,'gold',0,y+w*.32+7,z,5);finial.rotation.z=z<0?-.2:.2;}
  };
  for(const p of props||[]) {
    const kind=cityPropKind(p);if(!kind)continue;
    const canopyKind=treeCanopyKind(p,map);
    const templateKey=[kind,canopyKind,p.key,p.scale||1,...(p.foot||[])].join(':');
    if(templates.has(templateKey)){const copy=templates.get(templateKey).clone();copy.position.set(p.x,0,p.y);copy.userData.prop=p;city.add(copy);continue;}
    const g=new THREE.Group();g.position.set(p.x,0,p.y);g.userData.prop=p;g.userData.kind=kind;
    const sc=p.scale||1,fw=p.foot?.[0]||4,fd=p.foot?.[1]||2;
    const w=Math.max(28,fw*16),d=Math.max(22,fd*16);
    if(kind==='tree'){
      const h=Math.min(145,82*sc),r=Math.min(62,34*sc);cylinder(g,2.2,4,h*.65,'wood',0,h*.325,-5,9);
      if(/dead|burn/.test(p.key)){
        for(const side of [-1,1]){const branch=cylinder(g,1,2,h*.4,'wood',side*9,h*.65,-5,5);branch.rotation.z=side*.65;}
      }else if(/palm/.test(p.key)){
        for(let i=0;i<7;i++){const a=i*Math.PI*2/7;const leaf=add(g,new THREE.SphereGeometry(1,6,4),'leaf',Math.sin(a)*r*.6,h*.85,-5+Math.cos(a)*r*.6);leaf.scale.set(6,3,r);leaf.rotation.y=a;leaf.rotation.x=.18;}
      }else{
        addTreeCanopy(g,p,h,r,materials,canopyKind);
        if(/bamboo/.test(p.key)){
          const segments=[],dummy=new THREE.Object3D();for(let i=0;i<4;i++){const x=(i-1.5)*5,z=-5+i%2*4,H=h*(.7+i*.06);segments.push([x,H/2,z,1.35,H]);for(let y=8;y<H;y+=12)segments.push([x,y,z,1.9,.8]);}
          const stems=new THREE.InstancedMesh(new THREE.CylinderGeometry(1,1,1,6),materials.leaf,segments.length);segments.forEach(([x,y,z,r,H],i)=>{dummy.position.set(x,y,z);dummy.scale.set(r,H,r);dummy.updateMatrix();stems.setMatrixAt(i,dummy.matrix);});stems.castShadow=true;stems.receiveShadow=true;g.add(stems);
        }else for(let i=0;i<4;i++){const branch=cylinder(g,1,2,h*.3,'wood',(i%2?1:-1)*7,h*.55,-5,6);branch.rotation.z=(i%2?1:-1)*.5;}
      }
    }else if(kind==='fountain'){
      g.scale.setScalar(Math.min(1,fw*16/96));
      cylinder(g,45,48,7,'stone',0,3.5,-20,32);cylinder(g,40,40,2,'water',0,7,-20,32);
      const rim=add(g,new THREE.TorusGeometry(43,3,6,32),'plaster',0,9,-20);rim.rotation.x=Math.PI/2;
      cylinder(g,7,12,26,'stone',0,22,-20);cylinder(g,23,10,6,'gold',0,36,-20);
      cylinder(g,19,19,1.5,'water',0,40,-20);
      for(let i=0;i<3;i++){const ring=add(g,new THREE.TorusGeometry(10+i*10,.4,4,32),'water',0,9.2,-20);ring.rotation.x=Math.PI/2;ring.userData.phase=i/3;city.userData.ripples.push(ring);}cylinder(g,0,4,16,'gold',0,49,-20);
      for(let i=0;i<8;i++){const a=i*Math.PI/4;const stream=cylinder(g,1,1.7,22,'water',Math.cos(a)*18,26,Math.sin(a)*18-20,5);stream.rotation.z=Math.sin(a)*.25;}
    }else if(kind==='stupa'){
      const r=w*.43,h=Math.max(64,85*sc),gold=/gold/.test(p.key);box(g,w,7,d,'stone',0,3.5,-d/2);
      cylinder(g,r*.8,r,12,'plaster',0,13,-d/2,8);cylinder(g,r*.46,r*.8,h*.35,gold?'gold':'plaster',0,25+h*.175,-d/2,8);
      for(let i=0;i<5;i++)cylinder(g,r*(.45-i*.065),r*(.5-i*.065),5,gold?'gold':'stone',0,26+h*.35+i*5,-d/2,8);
      cylinder(g,0,r*.19,h*.45,'gold',0,51+h*.575,-d/2,8);
    }else if(kind==='gate'){
      for(const x of [-w*.42,w*.42]){box(g,w*.25,48,d,'plaster',x,24,-d/2);}
      box(g,w*1.25,9,d,'stone',0,48,-d/2);const r=new THREE.Group();r.position.z=-d/2;g.add(r);roof(r,w*1.5,d+12,55);
    }else if(kind==='stall'){
      box(g,w,16,d,'wood',0,8,-d/2);for(const x of [-w/2,w/2])for(const z of [-d,0])box(g,2,38,2,'wood',x,19,z);
      const r=new THREE.Group();r.position.z=-d/2;g.add(r);roof(r,w+10,d+10,38,'cloth');
      for(let i=0;i<4;i++)cylinder(g,3,3,5,i%2?'gold':'leafLight',-w*.3+i*w*.2,19,-d*.35,7);
    }else if(kind==='boat'){
      const length=/junk/.test(p.key)?110:42,beam=/junk/.test(p.key)?28:14;
      const hull=add(g,new THREE.SphereGeometry(1,16,8),'wood',0,6,-length/2);hull.scale.set(beam/2,7,length/2);
      box(g,beam*.8,2,length*.75,'wood',0,10,-length/2);
      for(const z of [-length*.75,-length*.3])box(g,beam,2,4,'wood',0,12,z);
      if(/junk/.test(p.key)){cylinder(g,1.5,2,68,'wood',0,40,-length*.5);box(g,42,44,1,'cloth',0,47,-length*.5);}
    }else if(kind==='pier'){
      box(g,40,4,65,'wood',0,5,-30);
      for(const x of [-18,18])for(const z of [-58,-30,-2])cylinder(g,1.5,2,16,'wood',x,8,z);
    }else if(kind==='wall'){
      box(g,w,13,d*.45,'stone',0,6.5,-d*.25);
      for(let x=-w/2+5;x<w/2;x+=12)box(g,8,4,d*.5,'plaster',x,15,-d*.25);
    }else if(kind==='fence'){
      const span=/fishrack|laundry/.test(p.key)?30:24;
      for(const x of [-span/2,span/2])cylinder(g,.8,1.3,17,'wood',x,8.5,-2,8);
      for(const y of [7,13])box(g,span,1.6,1.6,'wood',0,y,-2);
      if(/laundry/.test(p.key))for(const x of [-7,5])box(g,8,10,.5,'cloth',x,10,-1);
    }else if(kind==='lantern'){
      const stone=/stone/.test(p.key),candle=/candle/.test(p.key),torch=/torch/.test(p.key),h=candle?7:stone?22:38;
      cylinder(g,stone?4:2,stone?6:3,h,'stone',0,h/2,-3,8);
      if(candle||torch){cylinder(g,0,torch?3:1.5,torch?8:4,'lamp',0,h+3,-3,7);}
      else{box(g,stone?9:7,stone?8:10,7,'lamp',0,h,-3);for(const x of [-4,4])for(const z of [-6,0])box(g,1,12,1,'wood',x,h,z);box(g,12,2,11,'roof',0,h+6,-3);cylinder(g,0,7,5,'roof',0,h+9,-3,4);}
    }else if(kind==='banner'){
      cylinder(g,.7,1.1,31,'wood',0,15.5,-2,8);box(g,13,1,1,'gold',4,30,-2);
      box(g,10,18,.6,'cloth',5,20,-2);
    }else if(kind==='bench'){
      const table=/table/.test(p.key),width=table?24:28,depth=table?16:7,h=table?13:8;
      box(g,width,2,depth,'wood',0,h,-depth/2);
      for(const x of [-width*.4,width*.4])for(const z of [-depth*.85,-depth*.15])box(g,2,h,2,'wood',x,h/2,z);
      if(!table){box(g,width,5,1.8,'wood',0,h+5,-depth);}
    }else if(kind==='board'){
      for(const x of [-9,9])box(g,2,22,2,'wood',x,11,-2);
      box(g,24,15,2,'wood',0,19,-2);box(g,17,10,.4,'plaster',0,19,-.8);
      for(const y of [16,19,22])box(g,11,.6,.4,'wood',0,y,-.5);
      box(g,28,3,7,'roof',0,28,-2);
    }else if(kind==='well'){
      cylinder(g,11,12,9,'stone',0,4.5,-10,20);cylinder(g,9,9,.6,'water',0,9.1,-10,20);
      const rim=add(g,new THREE.TorusGeometry(10,2,8,20),'plaster',0,10,-10);rim.rotation.x=Math.PI/2;
      if(!/pond|trough/.test(p.key)){for(const x of [-11,11])box(g,2,28,2,'wood',x,14,-10);box(g,26,2,3,'wood',0,28,-10);}
    }else if(kind==='pot'){
      cylinder(g,4,7,12,'roof',0,6,-5,16);cylinder(g,4.5,4,2,'stone',0,13,-5,16);
      cylinder(g,3,3,.5,'wood',0,14.1,-5,16);
    }else if(kind==='plant'){
      const lotus=/lotus/.test(p.key);
      if(!lotus)cylinder(g,4,3,5,'roof',0,2.5,-3,12);
      for(let i=0;i<5;i++){const a=i*2.4;const leaf=add(g,new THREE.SphereGeometry(1,10,6),i%2?'leaf':'leafLight',Math.cos(a)*4,lotus?.3:7,Math.sin(a)*4-3);leaf.scale.set(5,lotus?1:3,3);}
      if(/frangipani|lotus/.test(p.key))for(let i=0;i<5;i++){const a=i*Math.PI*2/5;add(g,new THREE.SphereGeometry(1.5,8,6),'plaster',Math.cos(a)*2,lotus?2:10,Math.sin(a)*2-3);}
    }else if(kind==='statue'){
      box(g,17,4,13,'stone',0,2,-6);
      if(/lion/.test(p.key)){
        const torso=add(g,new THREE.SphereGeometry(1,12,10),'stone',0,9,-6);torso.scale.set(4,5,7);
        add(g,new THREE.SphereGeometry(5,14,12),'gold',0,15,-1);
        for(const x of [-3,3])cylinder(g,1.5,2,7,'stone',x,7,-1,10);
        add(g,new THREE.SphereGeometry(2,10,8),'stone',0,14,3);
      }else{
      const body=add(g,new THREE.SphereGeometry(1,12,10),'gold',0,11,-6);body.scale.set(5,8,4);
      add(g,new THREE.SphereGeometry(3.8,12,10),'gold',0,21,-6);
      for(const x of [-5,5]){const leg=add(g,new THREE.SphereGeometry(1,10,8),'gold',x,6,-3);leg.scale.set(5,2,4);}
      cylinder(g,0,2.5,5,'gold',0,26,-6,10);
      }
    }else if(kind==='training'){
      if(/muaythai/.test(p.key)){
        box(g,w,5,d,'wood',0,2.5,-d/2);box(g,w-4,.5,d-4,'cloth',0,5.3,-d/2);
        for(const x of [-w/2,w/2])for(const z of [-d,0])box(g,2,18,2,'wood',x,9,z);
        for(const y of [10,16]){for(const z of [-d,0])box(g,w,1,1,'cloth',0,y,z);for(const x of [-w/2,w/2])box(g,1,1,d,'cloth',x,y,-d/2);}
      }else if(/haystack/.test(p.key)){
        const hay=add(g,new THREE.SphereGeometry(1,14,10),'cloth',0,6,-7);hay.scale.set(10,8,8);
        cylinder(g,8,10,3,'wood',0,1.5,-7,14);
      }else{
        cylinder(g,1.5,2,25,'wood',0,12.5,-4,8);
        const target=cylinder(g,8,8,3,'cloth',0,21,-4,20);target.rotation.x=Math.PI/2;
        const ring=add(g,new THREE.TorusGeometry(5,.7,6,24),'plaster',0,21,-2.2);
        add(g,new THREE.SphereGeometry(1.5,8,6),'roof',0,21,-1.4);
      }
    }else if(kind==='instrument'){
      for(const x of [-10,10])box(g,2,27,2,'wood',x,13.5,-5);box(g,24,2,2,'wood',0,27,-5);
      const gong=cylinder(g,8,8,2,'gold',0,16,-5,24);gong.rotation.x=Math.PI/2;
      add(g,new THREE.SphereGeometry(2,12,8),'gold',0,16,-3);
    }else if(kind==='cart'){
      box(g,20,6,26,'wood',0,10,-13);
      for(const x of [-12,12]){const wheel=add(g,new THREE.TorusGeometry(6,1.3,8,16),'wood',x,6,-15);wheel.rotation.y=Math.PI/2;}
      for(const x of [-7,7])box(g,1.5,1.5,20,'wood',x,8,7);
    }else if(kind==='goods'){
      const crate=/chest|silk|firewood/.test(p.key);
      if(crate){box(g,14,10,11,'wood',0,5,-6);for(const x of [-5,5])box(g,1,10.5,11.5,'gold',x,5,-6);}
      else {cylinder(g,6,5,8,'wood',0,4,-5,12);for(let i=0;i<5;i++)add(g,new THREE.SphereGeometry(2,8,6),i%2?'leafLight':'cloth',(i%3-1)*3,9,-5+Math.floor(i/3)*3);}
    }else{
      const open=/pavilion|sala|spirit/.test(p.key),grand=/throne|viharn|ubosot|wat/.test(p.key);const h=grand?54:34;
      box(g,w+8,5,d+8,'stone',0,2.5,-d/2);
      if(!open){box(g,w,h,d,grand?'plaster':'wood',0,h/2+5,-d/2);box(g,12,23,1,'wood',0,16,.6);for(const x of [-w*.3,w*.3]){box(g,12,15,2,'wood',x,24,1);box(g,8,11,1,'window',x,24,2.2);box(g,1,11,1,'wood',x,24,3);box(g,8,1,1,'wood',x,24,3);}}
      else for(const x of [-w*.42,w*.42])for(const z of [-d*.9,-d*.1])box(g,4,h,4,'wood',x,h/2+5,z);
      box(g,w+3,3,d+3,'wood',0,h+3,-d/2);
      if(!open){for(let y=10;y<h;y+=6)box(g,w,.5,1,'stone',0,y,.7);for(const x of [-w/2,w/2])box(g,3,h+3,d+2,'wood',x,h/2+5,-d/2);}
      else{box(g,w,3,3,'wood',0,14,-d*.9);for(const x of [-w*.42,w*.42])box(g,3,3,d,'wood',x,14,-d/2);}
      const r=new THREE.Group();r.position.z=-d/2;g.add(r);roof(r,w+20,d+20,h+7);if(grand)roof(r,w*.72,d*.9,h+23);
      for(let i=0;i<3;i++)box(g,w*.4,2,d*.15,'stone',0,1+i,-d*.03+i*3);
    }
    if(!['tree','house','gate','stupa','fountain','stall'].includes(kind))g.scale.setScalar(Math.max(.55,Math.min(1.3,sc)));
    if(p.flip)g.scale.x*=-1;
    if(kind!=='fountain'){bakeStaticMeshes(g);templates.set(templateKey,g);}
    city.add(g);
  }
  return city;
}

export function disposeTerrain(group) {
  const geometries=new Set(),materials=new Set();group.traverse(o=>{o.userData?.cancelTextureLoad?.();if(o.isInstancedMesh)o.dispose();if(o.geometry)geometries.add(o.geometry);for(const g of o.userData.ownedGeometries||[])geometries.add(g);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);for(const m of o.userData.ownedMaterials||[])materials.add(m);});
  const textures=new Set();for(const m of materials){if(m.map)textures.add(m.map);if(m.bumpMap)textures.add(m.bumpMap);}
  for(const t of textures)t.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();group.clear();
}

// One batched surface follows the exact water tiles; no change to movement or fishing.
export function buildWaterSurface(ground,TILE,T,style={}) {
  const positions=[],uvs=[];
  for(let y=0;y<ground.length;y++)for(let x=0;x<ground[y].length;x++)if(ground[y][x]===T.WATER||ground[y][x]===T.WATER2){
    const X=x*TILE,Z=y*TILE,d=TILE;positions.push(X,0,Z,X+d,0,Z,X,0,Z+d,X+d,0,Z,X+d,0,Z+d,X,0,Z+d);
  }
  if(!positions.length)return null;
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  const material=new THREE.ShaderMaterial({uniforms:{time:{value:0},tint:{value:new THREE.Color(style.waterTint??(style.lava?0xb84826:0x397f89))},lava:{value:style.lava?1:0}},
    vertexShader:'varying vec2 surface;void main(){surface=position.xz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'uniform float time;uniform vec3 tint;uniform float lava;varying vec2 surface;void main(){float wave=sin(surface.x*.085+surface.y*.12-time*.9)*sin(surface.y*.16-time*.6);float glint=pow(max(0.0,sin(surface.x*.16+sin(surface.y*.11+time)*1.4-time)),18.0);vec3 c=tint*(.83+.08*wave)+vec3(.35,.45,.42)*glint*.27;if(lava>.5)c=tint*(.9+.25*wave)+vec3(1.0,.36,.08)*glint*.5;gl_FragColor=vec4(c,1.0);\n#include <colorspace_fragment>\n}',
    side:THREE.DoubleSide,toneMapped:false});
  const mesh=new THREE.Mesh(geometry,material);mesh.position.y=.11;mesh.renderOrder=.23;return mesh;
}
