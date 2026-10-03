import * as THREE from '/vendor/three/three.module.js';

// Models use the existing map coordinates and collision footprints.
export function cityPropKind(p) {
  if(p.tree)return 'tree';
  if(/fountain/.test(p.key))return 'fountain';
  if(/chedi|prang|mondop/.test(p.key))return 'stupa';
  if(/gate|walltower/.test(p.key))return 'gate';
  if(/env\/b_|p_spirit/.test(p.key))return 'house';
  if(/mstall|p_stall|foodcart/.test(p.key))return 'stall';
  return null;
}

export function buildAyutthayaCity(props,map={}) {
  const city=new THREE.Group();city.name='Ayutthaya 3D architecture';city.userData.ripples=[];
  const palette={plaster:0xe7cfab,stone:0xa79983,wood:0x816044,roof:0x9b604d,gold:0xe6b956,leaf:0x3c704b,leafLight:0x72955a,water:0x389aa4,cloth:0xc68443,window:0xe7bd71};
  if(map.id==='nagaphop'){palette.roof=0x397b83;palette.plaster=0xadd4ce;palette.leaf=0x286d72;}
  if(map.id==='naraka'){palette.roof=0x623d4c;palette.plaster=0x9c817b;palette.leaf=0x5a5062;}
  if(map.id==='dusit'){palette.roof=0xbcad81;palette.plaster=0xf0e2c4;palette.leaf=0x729b7c;}
  if(map.id==='sumeru'){palette.roof=0x4f587c;palette.plaster=0xbbbccc;palette.leaf=0x61758e;}
  const materials=Object.fromEntries(Object.entries(palette).map(([name,color])=>[name,new THREE.MeshStandardMaterial({color,roughness:name==='water'?.24:.86,metalness:name==='gold'?.55:name==='water'?.18:0,flatShading:true,emissive:name==='window'?0xa66123:0,emissiveIntensity:.28})]));
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
  const add=(group,geometry,material,x,y,z)=>{const m=new THREE.Mesh(geometry,materials[material]);m.position.set(x,y,z);m.castShadow=material!=='water';m.receiveShadow=true;group.add(m);return m;};
  const box=(g,w,h,d,mat,x,y,z)=>add(g,new THREE.BoxGeometry(w,h,d),mat,x,y,z);
  const cylinder=(g,top,bottom,h,mat,x,y,z,n=12)=>add(g,new THREE.CylinderGeometry(top,bottom,h,n),mat,x,y,z);
  const roof=(g,w,d,y,mat='roof')=>{
    // Extruded steep gable with broad eaves; ridge runs along the house depth.
    const shape=new THREE.Shape();shape.moveTo(-w/2,0);shape.lineTo(0,w*.32);shape.lineTo(w/2,0);shape.lineTo(w/2,-3);shape.lineTo(-w/2,-3);shape.closePath();
    add(g,new THREE.ExtrudeGeometry(shape,{depth:d,bevelEnabled:false}),mat,0,y,-d/2);
    box(g,3,3,d+4,'gold',0,y+w*.32,0);
    const lines=[];for(let z=-d/2;z<=d/2;z+=7){lines.push(-w/2,y+.3,z,0,y+w*.32+.3,z,0,y+w*.32+.3,z,w/2,y+.3,z);}
    for(const side of [-1,1])for(let x=7;x<w/2;x+=8){const h=y+(w/2-x)*.64+.4;lines.push(side*x,h,-d/2,side*x,h,d/2);}
    const seams=new THREE.BufferGeometry();seams.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));g.add(new THREE.LineSegments(seams,new THREE.LineBasicMaterial({color:mat==='roof'?0x682c25:0x916633,transparent:true,opacity:.45})));
    for(const z of [-d/2,d/2]){const finial=cylinder(g,0,2,14,'gold',0,y+w*.32+7,z,5);finial.rotation.z=z<0?-.2:.2;}
  };
  for(const p of props||[]) {
    const kind=cityPropKind(p);if(!kind)continue;
    const g=new THREE.Group();g.position.set(p.x,0,p.y);g.userData.prop=p;g.userData.kind=kind;
    const sc=p.scale||1,fw=p.foot?.[0]||4,fd=p.foot?.[1]||2;
    const w=Math.max(28,fw*16),d=Math.max(22,fd*16);
    if(kind==='tree'){
      const h=Math.min(110,55*sc),r=Math.min(48,24*sc);cylinder(g,3,5,h*.65,'wood',0,h*.325,-5,7);
      if(/dead|burn/.test(p.key)){
        for(const side of [-1,1]){const branch=cylinder(g,1,2,h*.4,'wood',side*9,h*.65,-5,5);branch.rotation.z=side*.65;}
      }else if(/palm/.test(p.key)){
        for(let i=0;i<7;i++){const a=i*Math.PI*2/7;const leaf=add(g,new THREE.SphereGeometry(1,6,4),'leaf',Math.sin(a)*r*.6,h*.85,-5+Math.cos(a)*r*.6);leaf.scale.set(6,3,r);leaf.rotation.y=a;leaf.rotation.x=.18;}
      }else{
        for(const [x,y,z,k] of [[0,h*.78,-5,1],[-r*.5,h*.65,0,.75],[r*.5,h*.68,-8,.8],[0,h,-6,.65]]){const crown=add(g,new THREE.IcosahedronGeometry(r*k,1),x<0?'leafLight':'leaf',x,y,z);crown.scale.y=.8;}
        for(let i=0;i<4;i++){const branch=cylinder(g,1,2,h*.3,'wood',(i%2?1:-1)*7,h*.55,-5,6);branch.rotation.z=(i%2?1:-1)*.5;}
      }
    }else if(kind==='fountain'){
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
    city.add(g);
  }
  return city;
}

export function disposeTerrain(group) {
  const geometries=new Set(),materials=new Set();group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);});
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
