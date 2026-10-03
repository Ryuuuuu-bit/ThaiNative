import * as THREE from '/vendor/three/three.module.js';
import { CLIPS, frameAt, directionClip, stableViewDirection, poseBlend, atlasCell, demoSocket } from './animation.js?v=11';
import { layoutCell } from './frame-layout.js?v=5';
import { smoothAtlas } from './smooth-atlas.js?v=10';
import { poseBounds } from './pose-bounds.js';

const PPU=40;
export class LayeredBillboard {
  constructor(scene) {
    this.root=new THREE.Group(); scene.add(this.root);
    this.facing=new THREE.Group(); this.root.add(this.facing);
    this.loader=new THREE.TextureLoader(); this.layers=new Map(); this.versions=new Map();
    this.clip='idle'; this.elapsed=0; this.heading=0; this.row=0; this.frame=0; this.dead=false; this.clips=CLIPS;
  }
  async texture(url) {
    const texture=await this.loader.loadAsync(url);
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.magFilter=texture.minFilter=THREE.NearestFilter;
    texture.generateMipmaps=false;
    return texture;
  }
  release(layer) {
    if(!layer) return;
    layer.mesh.removeFromParent(); layer.mesh.geometry.dispose(); layer.mesh.material.dispose();
    for(const texture of Object.values(layer.textures)) texture.dispose();
  }
  /**
   * Atlas layers: {atlases:{idle:url,walk:url,attack:url,die:url}, order:0, footPadding:6}
   * Every atlas has eight direction rows and CLIPS[clip].frames columns.
   * Socket layers: {url, slot:'head'|'weapon', pixelSize:24, pivot:[.5,.9], sockets?}
   * Explicit per-frame sockets override demoSocket; icon sockets are preview-only.
   */
  async equip(slot,spec) {
    const version=(this.versions.get(slot)||0)+1; this.versions.set(slot,version);
    if(!spec) {this.release(this.layers.get(slot));this.layers.delete(slot);return;}
    const entries=spec.atlases ? Object.entries(spec.atlases) : [['static',spec.url]];
    const results=await Promise.allSettled(entries.map(async ([name,url])=>[name,await this.texture(url)]));
    const textures=Object.fromEntries(results.filter(r=>r.status==='fulfilled').map(r=>r.value));
    if(this.dead || this.versions.get(slot)!==version || results.some(r=>r.status==='rejected')) {
      Object.values(textures).forEach(t=>t.dispose());
      if(results.some(r=>r.status==='rejected')) throw new Error('โหลดภาพอุปกรณ์ไม่สำเร็จ');
      return;
    }
    const first=Object.values(textures)[0], clips=spec.clips||CLIPS;
    const sourceW=spec.atlases ? first.image.width/clips[entries[0][0]].frames : spec.pixelSize;
    const sourceH=spec.atlases ? first.image.height/8 : spec.pixelSize*first.image.height/first.image.width;
    const h=spec.renderHeight||sourceH, w=sourceW*h/sourceH;
    const geometry=new THREE.PlaneGeometry(w/PPU,h/PPU);
    const pivot=spec.pivot||[.5,1];
    geometry.translate((.5-pivot[0])*w/PPU,(pivot[1]-.5)*h/PPU-(spec.atlases ? (spec.footPadding??6)/PPU : 0),0);
    const material=new THREE.MeshBasicMaterial({map:first,transparent:true,alphaTest:spec.alphaTest??.2,depthWrite:true,side:THREE.DoubleSide});
    const mesh=new THREE.Mesh(geometry,material);
    mesh.position.z=(spec.order||0)*.002;
    this.release(this.layers.get(slot));
    this.layers.set(slot,{mesh,textures,spec,smooth:spec.smoothFrames?smoothAtlas(material):null});this.facing.add(mesh);
    if(slot==='body'){this.clips=clips;this.elapsed=0;}
  }
  play(clip,restart=false) {
    if(!this.clips[clip]) throw new Error('Unknown animation');
    if(this.clip!==clip || restart) {this.clip=clip;this.elapsed=0;}
  }
  get action(){return directionClip(this.clips[this.clip],this.row);}
  update(dt,camera,azimuth) {
    this.elapsed+=dt;
    this.row=stableViewDirection(this.heading,azimuth,this.row);
    this.frame=frameAt(this.elapsed,this.action);
    this.facing.quaternion.copy(camera.quaternion);
    for(const [slot,layer] of this.layers) {
      const {mesh,textures,spec}=layer;
      if(spec.atlases) {
        const rowMap=spec.directionMap?.[this.clip];
        const layout=spec.layouts?.[this.clip];
        const authoredCell=layout?layoutCell(layout,this.row,this.frame):null;
        const unavailable=layout?!authoredCell:!!(rowMap && rowMap[this.row]===null);
        const clip=unavailable?'idle':this.clip;
        const texture=textures[authoredCell?.source||clip];mesh.visible=!!texture;
        if(!texture) continue;
        const action=directionClip((spec.clips||this.clips)[clip],this.row);
        const frames=action.frames;
        const row=unavailable?this.row:(rowMap?.[this.row]??this.row);
        const frame=unavailable?frameAt(this.elapsed,this.clips.idle):this.frame;
        const cell=unavailable?atlasCell(frame,row,frames):(authoredCell||atlasCell(frame,row,frames));
        if(slot==='body')this.directionUnavailable=!!unavailable;
        if(layer.smooth){
          const next=action.loop?(frame+1)%frames:Math.min(frame+1,frames-1);
          const nextCell=layoutCell(spec.layouts[clip],row,next)||cell;
          const fraction=(this.elapsed*action.fps)%1;
          // Cross-fading locomotion creates duplicate feet and hands. Keep
          // authored contact/passing poses crisp; only blend subtle idle poses.
          const t=poseBlend(clip,fraction);
          texture.repeat.set(1,1);texture.offset.set(0,0);
          const ppu=cell.ppu||spec.presentation[clip].sourcePixelsPerUnit;
          const {canvas,floor}=poseBounds(texture.image.width,texture.image.height,[cell,nextCell]);
          const edge=canvas/ppu/PPU;
          layer.smooth(texture,cell,nextCell,t,canvas,floor);
          const signature=`${edge}:${floor/ppu}`;
          if(layer.presentation!==signature){
            mesh.geometry.dispose();mesh.geometry=new THREE.PlaneGeometry(edge,edge);
            mesh.geometry.translate(0,edge/2-floor/ppu/PPU,0);layer.presentation=signature;
          }
        } else texture.repeat.set(cell.flip?-cell.w:cell.w,cell.h),texture.offset.set(cell.flip?cell.x+cell.w:cell.x,cell.y);
        if(spec.renderHeight&&!layer.smooth){
          const shape=spec.presentation?.[clip]||{};
          const height=shape.sourcePixelsPerUnit?(texture.image.height*cell.h)/shape.sourcePixelsPerUnit:(shape.height||spec.renderHeight);
          const width=height*texture.image.width*cell.w/(texture.image.height*cell.h);
          const foot=cell.foot??shape.foot??.9;
          const pivotX=cell.flip?1-(cell.pivotX??.5):(cell.pivotX??.5);
          // The plane uses a unit quad for metadata layouts. Its foot pivot is
          // explicit, independent of the sword's furthest pixel.
          const signature=`${width}:${height}:${foot}:${pivotX}`;
          if(layer.presentation!==signature){
            mesh.geometry.dispose();mesh.geometry=new THREE.PlaneGeometry(width/PPU,height/PPU);
            mesh.geometry.translate((.5-pivotX)*width/PPU,foot*height/PPU-height/(2*PPU),0);
            layer.presentation=signature;
          }
        }
        if(mesh.material.map!==texture) {mesh.material.map=texture;mesh.material.needsUpdate=true;}
      } else {
        mesh.visible=this.clip!=='die';
        const socket=spec.sockets?.[this.clip]?.[this.row]?.[this.frame] || demoSocket(slot,this.clip,this.row,this.frame);
        mesh.position.set(socket.x/PPU,socket.y/PPU,socket.behind?-.006:.006);
        mesh.rotation.z=socket.rotation||0;
      }
    }
  }
  dispose() {this.dead=true;for(const l of this.layers.values())this.release(l);this.layers.clear();this.root.removeFromParent();}
}
