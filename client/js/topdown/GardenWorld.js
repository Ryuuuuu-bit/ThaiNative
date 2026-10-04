import * as THREE from '/vendor/three/three.module.js';

// Botanical detail is presentation only; all paths and collision data remain authored.
export const gardenHash=(x,y,k=0)=>{let n=Math.imul(x+137,374761393)^Math.imul(y+71,668265263)^Math.imul(k+1,1274126177);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;};

export function leafMaterial(color=0xd4e4c4) {
  const m=new THREE.MeshStandardMaterial({color,roughness:.95,side:THREE.DoubleSide,alphaTest:.38});
  const wind=m.userData.wind={value:0};m.onBeforeCompile=shader=>{shader.uniforms.gardenTime=wind;shader.vertexShader='uniform float gardenTime;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n#ifdef USE_INSTANCING\ntransformed.x += sin(gardenTime*.85+instanceMatrix[3].x*.037+position.y*2.0)*.035*(position.y+.5);\n#endif');};
  m.customProgramCacheKey=()=> 'garden-leaves-v1';
  if(typeof document==='undefined')return m;
  const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');
  // A branchlet with individual curved leaves, shaded edges and fine veins.
  ctx.strokeStyle='#677655';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(129,238);ctx.bezierCurveTo(113,168,146,84,128,12);ctx.stroke();
  for(let i=0;i<12;i++){
    const side=i%2?1:-1,y=28+i*17,x=128+side*(20+gardenHash(i,3)*19),angle=side*.72;
    ctx.save();ctx.translate(x,y);ctx.rotate(angle);
    const gr=ctx.createLinearGradient(-15,-27,15,27);gr.addColorStop(0,'#f0f3e4');gr.addColorStop(.45,'#c5d0b7');gr.addColorStop(1,'#778673');
    ctx.fillStyle=gr;ctx.beginPath();ctx.moveTo(0,-29);ctx.bezierCurveTo(24,-12,20,10,0,29);ctx.bezierCurveTo(-20,9,-23,-13,0,-29);ctx.fill();
    ctx.strokeStyle='rgba(243,247,207,.42)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,26);ctx.lineTo(0,-24);ctx.stroke();
    for(let j=-12;j<17;j+=8){ctx.beginPath();ctx.moveTo(0,j+6);ctx.lineTo(12,j-3);ctx.moveTo(0,j+6);ctx.lineTo(-12,j-3);ctx.stroke();}ctx.restore();
  }
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;m.map=texture;m.emissiveMap=texture;m.emissive.setHex(0x527f92);m.emissiveIntensity=.2;
  return m;
}

export function addTreeCanopy(group,prop,h,r,materials) {
  const bamboo=/bamboo/.test(prop.key),pink=/pink/.test(prop.key),gold=/golden/.test(prop.key);
  const count=bamboo?108:144,geometry=materials.leafCard||(materials.leafCard=new THREE.PlaneGeometry(1,1));
  const material=pink?materials.blossom:gold?materials.autumn:materials.foliage;
  const canopy=new THREE.InstancedMesh(geometry,material,count),dummy=new THREE.Object3D(),tint=new THREE.Color();
  for(let i=0;i<count;i++){
    const a=gardenHash(Math.round(prop.x),Math.round(prop.y),i)*Math.PI*2;
    const q=gardenHash(i,Math.round(prop.x),8),rad=r*Math.sqrt(q);
    dummy.position.set(Math.cos(a)*rad,h*(.61+.38*gardenHash(i,17)),Math.sin(a)*rad-5);
    dummy.rotation.set(-.45+gardenHash(i,4)*1.65,a,gardenHash(i,9)*.8-.4);
    const size=r*(bamboo?1.1:.92)*( .8+gardenHash(i,19)*.6);
    dummy.scale.set(size*(bamboo?.85:1),size*(bamboo?1.35:1),1);dummy.updateMatrix();canopy.setMatrixAt(i,dummy.matrix);
    tint.setHSL(pink?.94:gold?.13:.28+gardenHash(i,5)*.08,pink?.3:.18,.63+gardenHash(i,12)*.28);canopy.setColorAt(i,tint);
  }
  canopy.castShadow=true;canopy.receiveShadow=true;canopy.name='Layered leafy canopy';group.add(canopy);
}

export function buildGarden(layout,TILE,T,map={},quality={lamps:6}) {
  const group=new THREE.Group();group.name='Living garden';group.userData.chunks=[];group.userData.lamps=[];
  if(map.crypt||map.gd)return group;
  const chunks=new Map(),grass=new Set([T.GRASS,T.GRASS2,T.GRASS3,T.TALL,T.PADDY]);
  // Reserve occupied footprints, NPC feet and the initial player landing point.
  const reserved=new Set();
  for(const p of layout.props||[])if(!p.tree&&p.foot?.[0]>0){const tx=Math.floor(p.x/TILE),ty=Math.floor(p.y/TILE),w=p.foot[0],h=p.foot[1];for(let y=ty-Math.ceil(h);y<=ty+1;y++)for(let x=tx-Math.ceil(w/2)-1;x<=tx+Math.ceil(w/2)+1;x++)reserved.add(`${x},${y}`);}
  const anchors=[...(layout.npcs||[]),...(map.spawn?[map.spawn]:[])];
  const bladeMat=new THREE.MeshStandardMaterial({color:map.id==='naraka'?0xcdb6ce:0xffffff,roughness:1,side:THREE.DoubleSide,vertexColors:true});
  const rockMat=new THREE.MeshStandardMaterial({color:0x80958d,roughness:1,flatShading:true});
  const flowerMat=new THREE.MeshStandardMaterial({color:0xf3d7b5,roughness:.85,vertexColors:true,side:THREE.DoubleSide});
  const stoneGeometry=new THREE.IcosahedronGeometry(1,0),flowerGeometry=new THREE.SphereGeometry(1,5,3),dummy=new THREE.Object3D();
  group.userData.ownedMaterials=[bladeMat,rockMat,flowerMat];group.userData.ownedGeometries=[stoneGeometry,flowerGeometry];
  for(let y=0;y<layout.ground.length;y++)for(let x=0;x<layout.ground[y].length;x++){
    const tile=layout.ground[y][x];if(!grass.has(tile)||reserved.has(`${x},${y}`))continue;
    const X=(x+.5)*TILE,Z=(y+.5)*TILE;if(anchors.some(n=>Math.hypot(n.x-X,n.y-Z)<26))continue;
    const hash=gardenHash(x,y);if(hash>.44&&tile!==T.TALL&&tile!==T.PADDY)continue;
    const key=`${x>>4},${y>>4}`;let chunk=chunks.get(key);
    if(!chunk){chunk={x:(x>>4)*TILE*16,z:(y>>4)*TILE*16,positions:[],colors:[],rocks:[],flowers:[]};chunks.set(key,chunk);}
    const bx=X-chunk.x+(gardenHash(x,y,2)-.5)*9,bz=Z-chunk.z+(gardenHash(x,y,3)-.5)*9;
    const tall=tile===T.TALL||tile===T.PADDY,base=new THREE.Color(tile===T.PADDY?0xa7ac67:0x88a786);
    for(let b=0;b<(tall?12:7);b++){
      const a=gardenHash(x+b,y,10)*Math.PI*2,w=.65+gardenHash(x,y+b,11)*.7,h=(tall?6:3)+gardenHash(x+b,y,12)*(tall?7:4);
      const px=bx+Math.cos(a)*2,pz=bz+Math.sin(a)*2,lx=Math.cos(a)*w,lz=Math.sin(a)*w;
      chunk.positions.push(px-lx,.15,pz-lz,px+lx,.15,pz+lz,px+Math.cos(a+.5)*2,h,pz+Math.sin(a+.5)*2);
      const shade=.6+gardenHash(x,y,b+25)*.4;for(const k of [.54,.6,1])chunk.colors.push(base.r*shade*k,base.g*shade*k,base.b*shade*k);
    }
    if(hash<.038)chunk.rocks.push([bx,1.1,bz,2+gardenHash(y,x)*3]);
    if(hash>.09&&hash<.15&&tile!==T.PADDY)for(let i=0;i<3;i++)chunk.flowers.push([bx+i*1.8-2,4+gardenHash(x,y,i)*3,bz+(i%2)*2,i]);
  }
  for(const data of chunks.values()){
    const chunk=new THREE.Group();chunk.position.set(data.x,0,data.z);chunk.userData.radius=182;
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(data.colors,3));geometry.computeVertexNormals();
    const blades=new THREE.Mesh(geometry,bladeMat);blades.receiveShadow=true;chunk.add(blades);
    for(const [items,geom,mat,flower]of [[data.rocks,stoneGeometry,rockMat,false],[data.flowers,flowerGeometry,flowerMat,true]])if(items.length){
      const mesh=new THREE.InstancedMesh(geom,mat,items.length);
      items.forEach(([x,y,z,k],i)=>{dummy.position.set(x,y,z);dummy.rotation.set(0,gardenHash(i,data.x)*6,0);dummy.scale.set(flower?1.05:k,flower?.65:k*.55,flower?1.05:k*.7);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);if(flower)mesh.setColorAt(i,new THREE.Color(k%2?0xeebdaf:0xb4c7e9));});mesh.receiveShadow=true;chunk.add(mesh);
    }
    group.add(chunk);group.userData.chunks.push(chunk);
  }
  // A fixed pool of local lights avoids recompiling a shader for every nearby lamp.
  group.userData.sources=(layout.props||[]).filter(p=>p.glow).map(p=>({x:p.x,y:Math.max(8,Math.abs(p.glow[0])*(p.scale||1)),z:p.y-4,color:p.glow[2],radius:Math.max(64,p.glow[1]*2.2),power:p.glow[3]}));
  if(map.id==='ayutthaya'){
    const postMat=new THREE.MeshStandardMaterial({color:0x6b6457,roughness:.9}),lampMat=new THREE.MeshStandardMaterial({color:0xffedc9,emissive:0xffb65e,emissiveIntensity:2.5});
    const postGeometry=new THREE.CylinderGeometry(1.2,1.8,25,6),lanternGeometry=new THREE.BoxGeometry(4,6,4),capGeometry=new THREE.ConeGeometry(4.5,3,4);
    group.userData.ownedMaterials.push(postMat,lampMat);group.userData.ownedGeometries.push(postGeometry,lanternGeometry,capGeometry);
    for(let y=8;y<145;y+=11)for(let x=2;x<54;x++){
      if(!grass.has(layout.ground[y]?.[x])||layout.ground[y]?.[x+1]!==T.ROAD||layout.ground[y]?.[x+2]!==T.ROAD)continue;
      const X=(x+.4)*TILE,Z=(y+.5)*TILE,lantern=new THREE.Group();lantern.position.set(X,0,Z);
      for(const [geom,mat,h]of [[postGeometry,postMat,12.5],[lanternGeometry,lampMat,26],[capGeometry,postMat,30.5]]){const m=new THREE.Mesh(geom,mat);m.position.y=h;m.castShadow=true;lantern.add(m);}group.add(lantern);group.userData.chunks.push(lantern);
      group.userData.sources.push({x:X,y:27,z:Z,color:0xffd193,radius:100,power:.85});break;
    }
  }
  for(let i=0;i<quality.lamps;i++){const light=new THREE.PointLight(0xffcd8a,0,180,1.35);group.add(light);group.userData.lamps.push(light);}
  const poolMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,toneMapped:false,
    uniforms:{color:{value:new THREE.Color(0xffc878)},strength:{value:0}},vertexShader:'varying vec2 p;void main(){p=uv*2.0-1.0;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'varying vec2 p;uniform vec3 color;uniform float strength;void main(){float d=length(p);float a=pow(max(0.0,1.0-d),2.2)*strength;gl_FragColor=vec4(color,a);\n#include <colorspace_fragment>\n}'});
  const poolGeometry=new THREE.PlaneGeometry(1,1);group.userData.ownedGeometries.push(poolGeometry);
  group.userData.pools=group.userData.sources.map(source=>{const mesh=new THREE.Mesh(poolGeometry,poolMat.clone());mesh.position.set(source.x,.3,source.z);mesh.rotation.x=-Math.PI/2;mesh.scale.setScalar(source.radius*1.8);mesh.material.uniforms.color.value.setHex(source.color);mesh.renderOrder=.96;mesh.userData.source=source;group.add(mesh);return mesh;});
  poolMat.dispose();
  return group;
}

export function updateGarden(group,cx,cz,radius,daylight,time) {
  if(!group)return;
  for(const chunk of group.userData.chunks)chunk.visible=Math.hypot(chunk.position.x+128-cx,chunk.position.z+128-cz)<radius+190;
  const dark=1-daylight,near=group.userData.sources?.filter(p=>Math.hypot(p.x-cx,p.z-cz)<radius+120).sort((a,b)=>Math.hypot(a.x-cx,a.z-cz)-Math.hypot(b.x-cx,b.z-cz))||[];
  group.userData.lamps.forEach((light,i)=>{const p=near[i];light.intensity=p?(25+dark*110)*p.power*(.96+.04*Math.sin(time*2+i)):0;if(p){light.position.set(p.x,p.y,p.z);light.color.setHex(p.color);light.distance=p.radius;}});
  for(const mesh of group.userData.pools||[]){const p=mesh.userData.source;mesh.visible=Math.hypot(p.x-cx,p.z-cz)<radius+p.radius;mesh.material.uniforms.strength.value=(.06+dark*.36)*p.power*(.97+.03*Math.sin(time*2+p.x));}
}
