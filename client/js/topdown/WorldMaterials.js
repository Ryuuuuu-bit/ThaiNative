import * as THREE from '/vendor/three/three.module.js';
import { MATERIAL_ATLAS } from './VisualAssets.js';

// Each atlas quadrant becomes a separate repeating texture, with no neighbour bleed.
export function loadWorldMaterials(materials) {
  if(typeof Image==='undefined')return ()=>{};
  const targets = { leaf: 0, grass: 0, grassEdge: 0, stone: 1, plaster: 1, wood: 2, roof: 3 };
  const image = new Image();
  let disposed = false;
  image.onload = () => {
    if (disposed) return;
    for (const [name, cell] of Object.entries(targets)) {
      const material = materials[name]; if (!material) continue;
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth / 2; canvas.height = image.naturalHeight / 2;
      canvas.getContext('2d').drawImage(image, (cell % 2) * canvas.width,
        Math.floor(cell / 2) * canvas.height, canvas.width, canvas.height,
        0, 0, canvas.width, canvas.height);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.anisotropy = 4;
      material.map?.dispose(); material.map = texture; material.needsUpdate = true;
    }
  };
  image.src = MATERIAL_ATLAS;
  return () => { disposed = true; image.onload = null; };
}

export function buildGroundSurface(ground, TILE, T, style = {}, map = {}) {
  const group = new THREE.Group(); group.name = 'Painted world surfaces';
  const colors = { grass: 0x7c9476, stone: 0xc9bba0, wood: 0xad8a65,
    roof: 0xb18b71, sand: 0xc7b38e, road: 0xaa9271, paddy: 0x8c9d67 };
  if(map.id==='ayutthaya')colors.stone=0xf0dfc2;
  if(map.crypt||map.gd){colors.stone=0x737b85;colors.road=0x655e68;colors.sand=0x8b8581;}
  const materials = Object.fromEntries(Object.entries(colors).map(([key, color]) =>
    [key, new THREE.MeshStandardMaterial({ color, roughness: .94 })]));
  if(typeof document!=='undefined')for(const key of ['road','sand','paddy']){
    const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#c8c0b0';ctx.fillRect(0,0,256,256);
    let seed=29;const random=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
    for(let i=0;i<6500;i++){const x=random()*256,y=random()*256;ctx.fillStyle=i%2?'rgba(255,247,227,.15)':'rgba(54,48,33,.11)';ctx.fillRect(x,y,.7+random()*1.3,.7+random()*1.3);}
    for(let i=0;i<80;i++){const x=random()*256,y=random()*256;ctx.fillStyle='rgba(48,43,31,.14)';ctx.beginPath();ctx.ellipse(x,y,1+random()*2,.5+random(),random()*3,0,Math.PI*2);ctx.fill();}
    const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;materials[key].map=texture;
  }
  const kind = tile => [T.WATER, T.WATER2].includes(tile) ? null
    : [T.GRASS, T.GRASS2, T.GRASS3, T.TALL].includes(tile) ? 'grass'
    : tile === T.BRICK ? 'roof' : tile === T.WOOD ? 'wood'
    : tile === T.SAND ? 'sand' : tile === T.ROAD ? 'road'
    : tile === T.PADDY ? 'paddy' : 'stone';
  const batches = {};
  for (let y = 0; y < ground.length; y++) for (let x = 0; x < ground[y].length; x++) {
    const key = kind(ground[y][x]); if (!key) continue;
    const b = batches[key] ||= { p: [], uv: [] };
    const X = x * TILE, Z = y * TILE, size = key === 'grass' ? 80 : 64;
    for (const [dx, dz] of [[0,0],[0,1],[1,0],[1,0],[0,1],[1,1]]) {
      b.p.push(X + dx * TILE, .035, Z + dz * TILE);
      b.uv.push((X + dx * TILE) / size, (Z + dz * TILE) / size);
    }
  }
  for (const [key, batch] of Object.entries(batches)) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(batch.p, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(batch.uv, 2));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, materials[key]); mesh.receiveShadow = true;
    group.add(mesh);
  }
  // Feather grass over the visual road boundary without moving its collision edge.
  const ep=[],eu=[],ea=[],isGrass=t=>[T.GRASS,T.GRASS2,T.GRASS3,T.TALL].includes(t);
  for(let y=0;y<ground.length;y++)for(let x=0;x<ground[y].length;x++)if([T.ROAD,T.SAND].includes(ground[y][x])){
    for(const [dx,dz]of [[-1,0],[1,0],[0,-1],[0,1]])if(isGrass(ground[y+dz]?.[x+dx])){
      const X=(x+(dx>0?1:0))*TILE,Z=(y+(dz>0?1:0))*TILE;
      for(let j=0;j<4;j++){const a=j*TILE/4,b=(j+1)*TILE/4,w=2.5+Math.sin((x*13+y*7+j)*1.9)*1.3;
        for(const [s,t]of [[a,0],[b,0],[a,1],[a,1],[b,0],[b,1]]){const px=X+(dx?-dx*w*t:s),pz=Z+(dz?-dz*w*t:s);ep.push(px,.06,pz);eu.push(px/80,pz/80);ea.push(1-t);}
      }
    }
  }
  if(ep.length){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(ep,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(eu,2));geometry.setAttribute('edgeOpacity',new THREE.Float32BufferAttribute(ea,1));geometry.computeVertexNormals();
    const material=materials.grassEdge=materials.grass.clone();material.side=THREE.DoubleSide;material.transparent=true;material.depthWrite=false;
    material.onBeforeCompile=shader=>{shader.vertexShader='attribute float edgeOpacity;varying float edgeAlpha;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nedgeAlpha=edgeOpacity;');shader.fragmentShader='varying float edgeAlpha;\n'+shader.fragmentShader.replace('#include <alphatest_fragment>','diffuseColor.a *= edgeAlpha;\n#include <alphatest_fragment>');};material.customProgramCacheKey=()=> 'garden-ground-edge-v1';
    const mesh=new THREE.Mesh(geometry,material);mesh.receiveShadow=true;mesh.renderOrder=.02;group.add(mesh);
  }
  const overlay=/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/.exec(style.overlay||'');
  if(overlay){const tint=new THREE.Color(`rgb(${overlay[1]},${overlay[2]},${overlay[3]})`);
    for(const material of Object.values(materials))material.color.lerp(tint,Number(overlay[4]||.15)*.7);}
  group.userData.ownedMaterials=Object.values(materials);
  group.userData.cancelTextureLoad = loadWorldMaterials(materials);
  return group;
}
