import * as THREE from '/vendor/three/three.module.js';
import { createMonsterMaterial, createNpcMaterial, updateMonsterMaterial, createMonsterAura } from './MonsterLook.js';
import { TILE, T } from '/shared/td/ayutthaya.js';
import { WORLD_TILT, frameQuad, graphicsBounds } from './ThreeWorldMath.js';
import { buildAyutthayaCity, buildWaterSurface, cityPropKind, disposeTerrain } from './AyutthayaCity.js';

/** Three.js presentation of the live game scene, shared by every map.
 * Phaser still owns simulation, animation, multiplayer and the existing UI.
 * Every displayed frame is its actual atlas frame, with its trim/pivot/scale.
 */
export class ThreeWorld {
  constructor(gameScene) {
    this.s=gameScene; this.entries=new Map(); this.textures=new Map(); this.frameNumber=0;
    this.whiteCanvas=document.createElement('canvas');this.whiteCanvas.width=this.whiteCanvas.height=1;
    const white=this.whiteCanvas.getContext('2d');white.fillStyle='#fff';white.fillRect(0,0,1,1);
    this.world=new THREE.Scene(); this.world.background=new THREE.Color('#101922');
    this.overlay=new THREE.Scene();
    this.camera=new THREE.OrthographicCamera(-1,1,1,-1,1,8000);
    this.overlayCamera=new THREE.OrthographicCamera(0,1,0,1,-10000,10000);
    this.renderer=new THREE.WebGLRenderer({alpha:false,antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(1); this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.autoClear=false;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.12;
    this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFShadowMap;
    this.canvas=this.renderer.domElement; this.canvas.dataset.renderer='three-world';
    Object.assign(this.canvas.style,{position:'absolute',pointerEvents:'none',imageRendering:'pixelated'});
    this.gameCanvas=gameScene.game.canvas; this.oldOpacity=this.gameCanvas.style.opacity;
    this.gameCanvas.parentElement.appendChild(this.canvas);
    this.raycaster=new THREE.Raycaster(); this.ground=new THREE.Plane(new THREE.Vector3(0,1,0),0);
    this.hit=new THREE.Vector3(); this.pointer=new THREE.Vector2(); this.rotation=new THREE.Quaternion();
    this.sky=new THREE.HemisphereLight(0xffefda,0x465b78,2);this.world.add(this.sky);
    const sun=this.sun=new THREE.DirectionalLight(0xffd6a0,1.5);sun.position.set(-600,1000,500);this.world.add(sun,sun.target);
    sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-650,right:650,top:650,bottom:-650,near:1,far:2200});
    sun.shadow.bias=-.0002;sun.shadow.normalBias=.5;
    this.terrain=new THREE.Group();this.world.add(this.terrain);
    this.rasterCamera=new Phaser.Cameras.Scene2D.Camera(0,0,1,1);
    this.rasterCamera.matrix.loadIdentity();this.rasterCamera.alpha=1;
    this.rasterCamera.addToRenderList=()=>{};
    this.render=this.render.bind(this); this.dispose=this.dispose.bind(this);
    this.oldWorldPoint=gameScene.cameras.main.getWorldPoint;
    gameScene.cameras.main.getWorldPoint=(x,y,out={})=>this.worldPoint(x,y,out);
    this.manager=gameScene.input.manager; this.oldHitTest=this.manager.hitTest;
    const self=this;
    this.hitTest=function(pointer,objects,camera,output){
      return camera===self.s.cameras.main && self.ready
        ? self.pick(pointer,objects,camera,output||[]) : self.oldHitTest.call(this,pointer,objects,camera,output);
    };
    this.manager.hitTest=this.hitTest;
    gameScene.events.on('postupdate',this.render);
    gameScene.events.once('shutdown',this.dispose);
    this.canvas.addEventListener('webglcontextlost',event=>{
      event.preventDefault();this.dispose();console.warn('Three.js context lost; restored the game renderer.');
    });
    try {this.render();}catch(error){this.dispose();throw error;}
  }

  updateCamera() {
    const cam=this.s.cameras.main,w=cam.width,h=cam.height;
    if (this.width!==w||this.height!==h) {
      this.width=w;this.height=h;this.renderer.setSize(w,h,false);
      this.overlayCamera.right=w;this.overlayCamera.bottom=h;this.overlayCamera.updateProjectionMatrix();
    }
    const rect=this.gameCanvas.getBoundingClientRect(),parent=this.gameCanvas.parentElement.getBoundingClientRect();
    Object.assign(this.canvas.style,{left:`${rect.left-parent.left}px`,top:`${rect.top-parent.top}px`,width:`${rect.width}px`,height:`${rect.height}px`});
    const cx=cam.scrollX+w/2,cz=cam.scrollY+h/2;
    this.centerX=cx;this.centerZ=cz;
    this.tilt=this.s.M.id==='ayutthaya'?Math.PI/3:WORLD_TILT;
    this.camera.left=-w/(2*cam.zoom);this.camera.right=w/(2*cam.zoom);
    this.camera.top=h/(2*cam.zoom);this.camera.bottom=-h/(2*cam.zoom);
    const radius=Math.cos(this.tilt)*1800;
    this.camera.position.set(cx,Math.sin(this.tilt)*1800,cz+radius);
    this.camera.lookAt(cx,0,cz);this.camera.updateProjectionMatrix();this.camera.updateMatrixWorld();
    this.sun.position.set(cx-500,1000,cz+350);this.sun.target.position.set(cx,0,cz);this.sun.target.updateMatrixWorld();
    const light=this.s.atmo?.light??1;this.sun.intensity=.65+light*1.25;this.sky.intensity=.85+light*.45;
    this.sun.color.setHex(light<.4?0x98b8e5:0xffdeb1);
    this.viewRadius=Math.hypot(this.camera.right,this.camera.top/Math.sin(this.tilt));
    if(this.city)for(const model of this.city.children){model.visible=Math.hypot(model.position.x-cx,model.position.z-cz)<this.viewRadius+230;}
  }

  worldPoint(x,y,out={}) {
    this.pointer.set(x/this.width*2-1,1-y/this.height*2);
    this.raycaster.setFromCamera(this.pointer,this.camera);
    this.raycaster.ray.intersectPlane(this.ground,this.hit);
    out.x=this.hit.x;out.y=this.hit.z;return out;
  }

  pick(pointer,objects,camera,output) {
    output.length=0;
    const p=this.worldPoint(pointer.x,pointer.y);pointer.worldX=p.x;pointer.worldY=p.y;
    const candidates=objects.filter(o=>this.manager.inputCandidate(o,camera));
    const meshes=candidates.map(o=>this.entries.get(o)?.mesh).filter(m=>m?.visible);
    const hits=this.raycaster.intersectObjects(meshes,false);
    for (const hit of hits) {
      const o=hit.object.userData.object;if(output.includes(o))continue;
      const f=o.frame;if(!f||!hit.uv)continue;
      // Mesh UVs are atlas coordinates; map back to the authored frame rectangle.
      const sx=f.source.width,sy=f.source.height;
      const localX=(o.flipX?f.cutWidth-(hit.uv.x*sx-f.cutX):hit.uv.x*sx-f.cutX)+(f.x||0)-o.displayOriginX;
      const localY=(o.flipY?f.cutHeight-((1-hit.uv.y)*sy-f.cutY):(1-hit.uv.y)*sy-f.cutY)+(f.y||0)-o.displayOriginY;
      if(this.manager.pointWithinHitArea(o,localX,localY))output.push(o);
    }
    return output;
  }

  rebuildTerrain() {
    disposeTerrain(this.terrain);this.city=null;
    const s=this.s,w=s.mapW*TILE,h=s.mapH*TILE;
    this.world.background.set(s.M.crypt||s.M.gd?'#100d18':'#1b2c30');
    const base=new THREE.Mesh(new THREE.BoxGeometry(w,8,h),new THREE.MeshLambertMaterial({color:s.M.crypt||s.M.gd?0x272231:0x574637}));
    base.position.set(w/2,-4.2,h/2);this.terrain.add(base);
    const tiles=[];
    s.layout.ground.forEach((row,y)=>row.forEach((t,x)=>{if(t===T.WALL||t===T.WALLTOP)tiles.push([x,y]);}));
    if(tiles.length){
      const height=s.M.crypt||s.M.gd?24:18;
      const pixels=new Uint8Array(16*16*4);for(let y=0;y<16;y++)for(let x=0;x<16;x++){const seam=y%8===0||(x+(Math.floor(y/8)%2)*8)%16===0;const i=(y*16+x)*4;const value=seam?125:211+((x*7+y*13)%17);pixels[i]=pixels[i+1]=pixels[i+2]=value;pixels[i+3]=255;}
      const brickTexture=new THREE.DataTexture(pixels,16,16);brickTexture.colorSpace=THREE.SRGBColorSpace;brickTexture.needsUpdate=true;
      const material=new THREE.MeshStandardMaterial({color:s.M.crypt||s.M.gd?0x706a80:0xa39275,map:brickTexture,roughness:1});
      const wall=new THREE.InstancedMesh(new THREE.BoxGeometry(TILE,height,TILE),material,tiles.length);
      const matrix=new THREE.Matrix4();tiles.forEach(([x,y],i)=>{matrix.makeTranslation((x+.5)*TILE,height/2,(y+.5)*TILE);wall.setMatrixAt(i,matrix);});
      wall.castShadow=true;wall.receiveShadow=true;this.terrain.add(wall);
    }
    if(!s.M.crypt&&!s.M.gd){
      this.city=buildAyutthayaCity(s.layout.props,s.M);this.terrain.add(this.city);
    }
    {
      const shadow=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.ShadowMaterial({color:0x25313b,opacity:.36,depthWrite:false}));
      shadow.rotation.x=-Math.PI/2;shadow.position.set(w/2,.07,h/2);shadow.receiveShadow=true;shadow.renderOrder=.95;this.terrain.add(shadow);
    }
    if(this.sun){this.sun.castShadow=true;this.sun.intensity=this.sun.castShadow?2.1:1.5;}
    if(this.sky)this.sky.intensity=s.M.id==='ayutthaya'?1.25:2;
    this.waterSurface=buildWaterSurface(s.layout.ground,TILE,T,s.M.style);if(this.waterSurface)this.terrain.add(this.waterSurface);
    this.mapId=s.M.id;
  }

  texture(source,repeat=false) {
    let record=this.textures.get(source);
    if(!record){
      const texture=new THREE.Texture(source);texture.needsUpdate=true;texture.colorSpace=THREE.SRGBColorSpace;
      texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;
      record={texture,lastUsed:this.frameNumber};this.textures.set(source,record);
    }
    if(repeat){record.texture.wrapS=record.texture.wrapT=THREE.RepeatWrapping;}
    record.lastUsed=this.frameNumber;return record.texture;
  }

  entry(object) {
    let e=this.entries.get(object);if(e)return e;
    const geometry=new THREE.BufferGeometry();geometry.setIndex([0,1,2,2,1,3]);
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Array(12).fill(0),3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Array(8).fill(0),2));
    const isGround=object.texture?.key?.startsWith('td_ground_');
    const isMonster=object.def&&object.spawn&&object.d8id?.startsWith('mob_');
    const isNpc=!!object.npcVisual||object.d8id?.startsWith('npc_');
    const material=isMonster?createMonsterMaterial(object.def):isNpc?createNpcMaterial(object.npcVisual):isGround?new THREE.MeshStandardMaterial({transparent:true,alphaTest:.12,side:THREE.DoubleSide,roughness:1,metalness:0}):new THREE.MeshBasicMaterial({transparent:true,alphaTest:.12,side:THREE.DoubleSide,toneMapped:false});
    geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=true;mesh.userData.object=object;
    e={mesh,geometry,material};this.world.add(mesh);
    if(isNpc)mesh.castShadow=true;
    if(isMonster){e.aura=createMonsterAura(object.def);this.world.add(e.aura);mesh.castShadow=true;}
    this.entries.set(object,e);return e;
  }

  raster(o,e) {
    let bounds;
    if(o.type==='Graphics')bounds=graphicsBounds(o.commandBuffer);
    else bounds={x:-o.displayOriginX-2,y:-o.displayOriginY-2,width:o.width+4,height:o.height+4};
    const stamp=o.type==='Graphics'?o.commandBuffer.join(','):`${o.width}:${o.height}:${o.fillColor}:${o.fillAlpha}:${o.strokeColor}:${o.strokeAlpha}:${o.lineWidth}:${o.radius}`;
    if(e.stamp!==stamp){
      const c=e.rasterCanvas||document.createElement('canvas');
      // Graphics map overlays are bounded by the map, never the full world size.
      c.width=Math.max(1,Math.min(4096,Math.ceil(bounds.width)));c.height=Math.max(1,Math.min(4096,Math.ceil(bounds.height)));
      const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);
      const proxy=Object.create(o);proxy.x=-bounds.x;proxy.y=-bounds.y;proxy.scaleX=proxy.scaleY=1;proxy.rotation=0;proxy.alpha=1;
      proxy.scrollFactorX=proxy.scrollFactorY=1;proxy.blendMode=0;
      o.renderCanvas({currentContext:ctx,blendModes:['source-over'],antialias:false},proxy,this.rasterCamera);
      e.rasterCanvas=c;e.stamp=stamp;e.bounds=bounds;
      const texture=this.texture(c);texture.needsUpdate=true;
    }
    return {source:e.rasterCanvas,frame:{x:e.bounds.x,y:e.bounds.y,width:e.rasterCanvas.width,height:e.rasterCanvas.height,u0:0,v0:0,u1:1,v1:1},originX:0,originY:0};
  }

  draw(o,seen,parentAlpha=1,root=o) {
    if(!o.visible||o.alpha===0)return;
    if(this.city&&o.cityProp&&cityPropKind(o.cityProp))return;
    // Cull distant map decorations before allocating/updating GPU objects.
    if(root.scrollFactorX!==0&&o.type!=='Graphics'&&o.type!=='ParticleEmitter'){
      const centerX=this.centerX??this.camera.position.x,centerY=this.centerZ??this.camera.position.z-Math.cos(this.tilt??WORLD_TILT)*1800;
      const marginX=Math.abs(root.displayWidth||root.width||64)+96,marginY=Math.abs(root.displayHeight||root.height||64)+160;
      if(Math.hypot(root.x-centerX,root.y-centerY)>(this.viewRadius??Math.hypot(this.camera.right,this.camera.top/Math.sin(this.tilt??WORLD_TILT)))+Math.max(marginX,marginY)){
        const existing=this.entries.get(o);if(existing){existing.mesh.visible=false;if(existing.aura)existing.aura.visible=false;seen.add(o);}return;
      }
    }
    if(o.type==='Container'){for(const child of o.list)this.draw(child,seen,parentAlpha*o.alpha,root);return;}
    if(o.type==='ParticleEmitter'){
      const transform=o.getWorldTransformMatrix();
      for(const p of o.alive){
        if(p.alpha<=0||!p.frame)continue;
        const proxy=p._threeProxy||(p._threeProxy={type:'Image',visible:true,originX:.5,originY:.5});
        Object.assign(proxy,{x:transform.a*p.x+transform.c*p.y+transform.tx,y:transform.b*p.x+transform.d*p.y+transform.ty,
          scaleX:p.scaleX*o.scaleX,scaleY:p.scaleY*o.scaleY,rotation:p.rotation,frame:p.frame,
          displayOriginX:p.frame.realWidth/2,displayOriginY:p.frame.realHeight/2,alpha:p.alpha*o.alpha,tintTopLeft:p.tint,
          depth:o.depth,blendMode:o.blendMode,scrollFactorX:1,scrollFactorY:1});
        this.draw(proxy,seen,parentAlpha,proxy);
      }
      return;
    }
    if(!o.frame && !o.renderCanvas)return;
    const e=this.entry(o);seen.add(o);
    let f=o.frame,source=f?.source?.image;
    let ox=o.displayOriginX||0,oy=o.displayOriginY||0;
    if(o.type==='Rectangle'&&!o.isStroked){
      source=this.whiteCanvas;f={x:0,y:0,width:o.width,height:o.height,u0:0,v0:0,u1:1,v1:1};
    }else if(o.type==='TileSprite'){
      source=o.texture.getSourceImage();const sw=source.width,sh=source.height;
      f={x:0,y:0,width:o.width,height:o.height,u0:o.tilePositionX/sw,v0:o.tilePositionY/sh,
        u1:(o.tilePositionX+o.width)/sw,v1:(o.tilePositionY+o.height)/sh};
    }else if(!source){const raster=this.raster(o,e);source=raster.source;f=raster.frame;ox=raster.originX;oy=raster.originY;}
    if(!source||!source.width||!f.width||!f.height){e.mesh.visible=false;return;}
    const texture=this.texture(source,o.type==='TileSprite');
    if(o.type==='Text'){
      const stamp=[o.text,o.style.fontSize,o.style.color,o.style.stroke,o.style.fontStyle,source.width,source.height].join('|');
      if(o.dirty||e.textStamp!==stamp){texture.needsUpdate=true;e.textStamp=stamp;}
    }
    if(o.type==='Text'){const r=o.style.resolution||1;f={...f,x:0,y:0,width:source.width/r,height:source.height/r,u0:0,v0:0,u1:1,v1:1};texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearFilter;}
    const q=frameQuad(f,ox,oy,o.flipX,o.flipY);
    e.geometry.attributes.position.array.set(q.positions);e.geometry.attributes.position.needsUpdate=true;
    e.geometry.attributes.uv.array.set(q.uvs);e.geometry.attributes.uv.needsUpdate=true;e.geometry.computeBoundingSphere();if(e.material.isMeshStandardMaterial)e.geometry.computeVertexNormals();
    e.material.map=texture;e.material.opacity=(o.alpha??1)*parentAlpha*(o.type==='Rectangle'&&!o.isStroked?(o.fillAlpha??1):1);
    e.material.color.setHex(o.type==='Rectangle'&&!o.isStroked?o.fillColor:o.tintTopLeft??0xffffff);
    e.material.premultipliedAlpha=o.blendMode===Phaser.BlendModes.MULTIPLY;
    e.material.blending=o.blendMode===Phaser.BlendModes.ADD?THREE.AdditiveBlending:o.blendMode===Phaser.BlendModes.MULTIPLY?THREE.MultiplyBlending:THREE.NormalBlending;
    if(e.material.userData.monster||e.material.userData.npc){
      updateMonsterMaterial(e.material,texture,f,o,this.s.atmo?.light??1,o===this.s.player?.target||o===this.s.hovered);
    }
    if(e.aura){
      e.aura.visible=!!o.alive&&o.visible!==false;e.aura.position.set(o.x,.16,o.y);
      const diameter=Math.max(18,Math.min(95,Math.abs(o.displayWidth||f.width*(o.scaleX??1))*(o.def.boss?1.25:.85)));
      e.aura.scale.set(diameter,diameter,1);e.aura.material.uniforms.time.value=performance.now()/1000;
    }
    const flat=(root.depth??0)<1 || this.s.shadows?.some(sh=>sh.img===o);
    const screen=root.scrollFactorX===0&&root.scrollFactorY===0;
    const overlay=o.type==='Text'||(root.depth??0)>=99980;
    e.material.depthWrite=!overlay&&!screen&&o.blendMode!==Phaser.BlendModes.ADD;
    e.material.depthTest=!overlay&&!screen;
    const target=screen?this.overlay:this.world;if(e.mesh.parent!==target)target.add(e.mesh);
    const matrix=o.getWorldTransformMatrix?.();
    let x=matrix?.tx??o.x,y=matrix?.ty??o.y;
    const sx=matrix?Math.hypot(matrix.a,matrix.b):(o.scaleX??1),sy=matrix?Math.hypot(matrix.c,matrix.d):(o.scaleY??1);
    const angle=matrix?Math.atan2(matrix.b,matrix.a):(o.rotation||0);
    e.mesh.visible=true;e.mesh.scale.set(sx,sy,1);
    if(screen){
      const zoom=this.s.cameras.main.zoom;e.mesh.position.set(x*zoom,y*zoom,root.depth/100);
      e.mesh.scale.set(sx*zoom,-sy*zoom,1);e.mesh.quaternion.identity();e.mesh.rotateZ(-angle);
    }else if(flat){
      e.mesh.position.set(x,.02+(root.depth||0)*.04,y);e.mesh.quaternion.setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);e.mesh.rotateZ(-angle);
    }else{
      // Labels retain their pixel offset above the entity's ground anchor.
      const anchor=root.depth>1&&root.depth<50000?root.depth:y;
      e.mesh.position.set(x,0,anchor);e.mesh.quaternion.copy(this.camera.quaternion);
      // Depth is the foot coordinate for sprites; high-depth effects use their own location.
      e.mesh.position.addScaledVector(new THREE.Vector3(0,1,0).applyQuaternion(this.camera.quaternion),anchor-y);
      e.mesh.rotateZ(-angle);
    }
    e.mesh.renderOrder=screen?root.depth:overlay?1000+(root.depth||0)/100000:flat?root.depth||0:1;
  }

  render() {
    if(this.disposed||!this.s.player)return;
    this.frameNumber++;this.updateCamera();if(this.mapId!==this.s.M.id)this.rebuildTerrain();
    if(this.waterSurface)this.waterSurface.material.uniforms.time.value=performance.now()/1000;
    for(const ripple of this.city?.userData.ripples||[]){const phase=(performance.now()/1800+ripple.userData.phase)%1;ripple.scale.setScalar(.7+phase*.5);}
    const seen=new Set();this.s.children.depthSort();for(const o of this.s.children.list)this.draw(o,seen);
    for(const [o,e] of this.entries)if(!seen.has(o)){
      e.mesh.removeFromParent();e.geometry.dispose();e.material.dispose();if(e.aura){e.aura.removeFromParent();e.aura.geometry.dispose();e.aura.material.dispose();}this.entries.delete(o);
      if(e.rasterCanvas){this.textures.get(e.rasterCanvas)?.texture.dispose();this.textures.delete(e.rasterCanvas);}
    }
    if(this.frameNumber%120===0)for(const [source,record] of this.textures)if(this.frameNumber-record.lastUsed>120){record.texture.dispose();this.textures.delete(source);}
    this.world.updateMatrixWorld();this.renderer.clear();this.renderer.render(this.world,this.camera);
    this.renderer.clearDepth();this.renderer.render(this.overlay,this.overlayCamera);
    this.ready=true;this.gameCanvas.style.opacity='0';
  }

  dispose() {
    if(this.disposed)return;this.disposed=true;this.ready=false;
    this.s.events.off('postupdate',this.render);this.s.cameras.main.getWorldPoint=this.oldWorldPoint;
    if(this.manager.hitTest===this.hitTest)this.manager.hitTest=this.oldHitTest;
    this.gameCanvas.style.opacity=this.oldOpacity;this.canvas.remove();
    for(const e of this.entries.values()){e.geometry.dispose();e.material.dispose();if(e.aura){e.aura.geometry.dispose();e.aura.material.dispose();}}
    for(const r of this.textures.values())r.texture.dispose();
    disposeTerrain(this.terrain);this.sun.shadow.dispose();
    this.entries.clear();this.textures.clear();this.rasterCamera.destroy();this.renderer.dispose();
  }
}
