import * as THREE from '/vendor/three/three.module.js';
import { LayeredBillboard } from './LayeredBillboard.js?v=11';
import { CLIPS, DIRECTIONS } from './animation.js';
import { FrameStrip } from './FrameStrip.js';

const $=id=>document.getElementById(id);
const status=message=>{$('status').textContent=message;};
const equipment={
  iron:{url:'/assets/icons/it_g_sword_w01.png',pixelSize:30,pivot:[.25,.81]},
  gold:{url:'/assets/icons/it_g_sword_w03.png',pixelSize:30,pivot:[.25,.81]},
  guard:{url:'/assets/icons/it_gx_sword_helm_1.png',pixelSize:17,pivot:[.5,.9]},
  mage:{url:'/assets/icons/it_gx_mage_helm_1.png',pixelSize:17,pivot:[.5,.9]},
};

async function start() {
  const rosterResponse=await fetch('/assets/player-roster.json');
  const roster=rosterResponse.ok?await rosterResponse.json():[];
  for(const entry of roster){
    const option=document.createElement('option');option.value=entry.id;option.textContent=entry.label;
    $('body').appendChild(option);
  }
  const view=$('viewport'), renderer=new THREE.WebGLRenderer({antialias:false,alpha:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  view.appendChild(renderer.domElement);
  const scene=new THREE.Scene();scene.background=new THREE.Color('#14251f');
  scene.fog=new THREE.Fog('#14251f',14,25);
  const camera=new THREE.OrthographicCamera(-4,4,4,-4,.1,50);
  let azimuth=0, zoom=1.4, paused=false, rate=1, ready=false, moving=false, moveSpeed=1.5;
  const center=new THREE.Vector3(0,.65,0);
  function positionCamera(){camera.position.set(Math.sin(azimuth)*9,6.4,Math.cos(azimuth)*9);camera.lookAt(center);}
  function resize(){const w=view.clientWidth,h=view.clientHeight,a=w/h;camera.left=-3.8*a;camera.right=3.8*a;camera.top=3.8;camera.bottom=-3.8;camera.zoom=zoom;camera.updateProjectionMatrix();renderer.setSize(w,h,false);}
  const observer=new ResizeObserver(resize);observer.observe(view);positionCamera();resize();
  scene.add(new THREE.HemisphereLight(0xdde8c8,0x283b29,2));
  const sun=new THREE.DirectionalLight(0xffe2ad,2);sun.position.set(-3,8,5);scene.add(sun);
  const tileGeometry=new THREE.BoxGeometry(.99,.08,.99);
  const tileMaterials=['#526447','#596b4a','#a29a70','#aaa079'].map(color=>new THREE.MeshLambertMaterial({color}));
  for(let x=-6;x<=6;x++) for(let z=-6;z<=6;z++) {
    const path=Math.abs(x)<=1||Math.abs(z)<=1;
    const tile=new THREE.Mesh(tileGeometry,tileMaterials[(path?2:0)+Math.abs(x+z)%2]);
    tile.position.set(x,-.05,z);scene.add(tile);
  }
  const stone=new THREE.MeshLambertMaterial({color:'#727760'});
  const obstacles=[];
  for(const [x,z] of [[-2,1.4],[2,-1.4],[-3,-2.6],[3,2.6]]) {
    const pillar=new THREE.Mesh(new THREE.BoxGeometry(.65,1.45,.65),stone);pillar.position.set(x,.72,z);scene.add(pillar);
    const cap=new THREE.Mesh(new THREE.BoxGeometry(.85,.16,.85),stone);cap.position.set(x,1.48,z);scene.add(cap);
    obstacles.push({x,z,r:.56});
  }
  const shadow=new THREE.Mesh(new THREE.CircleGeometry(.32,24),new THREE.MeshBasicMaterial({color:0x122017,transparent:true,opacity:.3,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;shadow.scale.y=.6;shadow.position.y=.006;scene.add(shadow);
  const player=new LayeredBillboard(scene);
  const frameStrip=new FrameStrip($('frame-strip'),index=>{
    paused=true;moving=false;$('pause').textContent='เล่นต่อ';
    player.elapsed=(index+.001)/player.action.fps;repaint();
  });
  const bodyVersion={value:0};
  async function loadBody(){
    const version=++bodyVersion.value;ready=false;status('กำลังโหลดตัวละคร…');
    try {
      const id=$('body').value;
      const rosterEntry=roster.find(entry=>entry.id===id);
      const generated=id==='imagegen_warrior_male';
      const boxer=id==='blender_boxer_female';
      const pixelBoxer=id==='pixel_boxer_female'||!!rosterEntry;
      moveSpeed=pixelBoxer?.95:1.5;
      const blender=id==='blender_warrior_male'||boxer;
      const baked=generated||blender||pixelBoxer;
      const base=rosterEntry?rosterEntry.base:pixelBoxer?'/assets/td/hero2_female_boxer_t1':blender?`/assets/player-blender/${boxer?'boxer-female-v1':'warrior-male-v1'}`:generated?'/assets/player-imagegen/warrior-male-v1':`/assets/td/${id}`;
      const settings=blender||pixelBoxer?await (await fetch(`${base}/settings.json?v=12`)).json():null;
      let layouts=pixelBoxer?settings.layouts:undefined;
      if(generated){
        const response=await fetch(`${base}/frame-layout.json?v=3`);
        if(!response.ok)throw new Error('โหลดตำแหน่งเฟรมไม่สำเร็จ');
        layouts=await response.json();
        if(version!==bodyVersion.value)return;
      }
      const atlases=Object.fromEntries(Object.keys(rosterEntry?settings.clips:CLIPS).map(clip=>[clip,`${base}/${generated&&['attack','die'].includes(clip)?clip+'-south-v2':clip}.png${generated?'?v=3':blender?'?v=2':''}`]));
      for(const source of settings?.sources||[])atlases[source]=`${base}/${source}.png?v=8`;
      const clips=blender||pixelBoxer?settings.clips:generated?{...CLIPS,walk:{...CLIPS.walk,fps:8},attack:{...CLIPS.attack,fps:10},die:{...CLIPS.die,fps:7}}:CLIPS;
      const presentation=pixelBoxer?settings.presentation:blender?Object.fromEntries(Object.keys(clips).map(c=>[c,{foot:settings.foot}])):generated?{idle:{foot:.97},walk:{sourcePixelsPerUnit:2.75},attack:{sourcePixelsPerUnit:5.8},die:{sourcePixelsPerUnit:5.8}}:undefined;
      await player.equip('body',{atlases,footPadding:generated?7.2:6,renderHeight:pixelBoxer?64:blender?132:generated?72:undefined,layouts,clips,presentation,smoothFrames:pixelBoxer,alphaTest:generated||pixelBoxer?0.85:0.2});
      if(version!==bodyVersion.value)return;
      for(const slot of ['weapon','head']){
        $(slot).disabled=baked;
        if(baked){$(slot).value='none';await player.equip(slot,null);}
      }
      ready=true;player.play('idle',true);status(pixelBoxer?'นักมวยหญิง Pixel v2 · เดิน 8 ทิศ · เฉียง 16 เฟรม':blender?'ต้นแบบ Blender · ยืน เดิน ฟัน ล้ม ครบ 8 ทิศ · อุปกรณ์ติดกับโครงกระดูก':generated?'แก้กรอบเฟรมแล้ว · เดิน 7 ทิศ · ฟัน/ล้มใหม่เฉพาะด้านหน้า · ทิศที่ยังไม่มีใช้ท่ายืน':'พร้อมทดลอง · ลองหมุนกล้องและสลับอุปกรณ์');
      $('model-note').textContent=pixelBoxer?'นักมวยหญิง: ท่าเดินใหม่ 8–16 เฟรมต่อทิศ สลับขาและแกว่งแขนตามจังหวะก้าว ดูแต่ละเฟรมได้ด้านล่าง อุปกรณ์รวมในภาพ':generated?'ขุนศึกใหม่: ท่าฟันและล้มใหม่มีเฉพาะด้านหน้า อุปกรณ์รวมในภาพ':'เลือกท่าทางและทิศทาง หรือใช้ปุ่มเฟรมเพื่อตรวจแต่ละจังหวะ';
      if(rosterEntry){status(`${rosterEntry.label} · 8 ทิศ`);$('model-note').textContent=rosterEntry.note;}
      document.querySelectorAll('[data-clip]').forEach(button=>{button.disabled=!clips[button.dataset.clip];});
      repaint();
    } catch(error){if(version===bodyVersion.value){ready=player.layers.has('body');status(error.message);}}
  }
  $('body').onchange=loadBody;
  for(const slot of ['weapon','head']) $(slot).onchange=async()=>{
    try{await player.equip(slot,equipment[$(slot).value]||null);status('เปลี่ยนอุปกรณ์แล้ว');}catch(error){status(error.message);}
  };
  const labels=['↓ ใต้','↘ ออกใต้','→ ออก','↗ ออกเหนือ','↑ เหนือ','↖ ตกเหนือ','← ตก','↙ ตกใต้'];
  DIRECTIONS.forEach((dir,i)=>{const button=document.createElement('button');button.textContent=labels[i];button.title=dir;button.onclick=()=>{player.heading=azimuth+i*Math.PI/4;repaint();};$('directions').appendChild(button);});
  function play(clip){if(!player.clips[clip])return;player.play(clip,true);moving=false;repaint();}
  $('clips').onclick=e=>{const clip=e.target.closest('[data-clip]')?.dataset.clip;if(clip)play(clip);};
  $('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'เล่นต่อ':'หยุดภาพ';};
  $('replay').onclick=()=>play(player.clip);
  function stepFrame(delta){
    paused=true;moving=false;$('pause').textContent='เล่นต่อ';
    const clip=player.action;
    const next=THREE.MathUtils.clamp(player.frame+delta,0,clip.frames-1);
    player.elapsed=(next+.001)/clip.fps;
    repaint();
  }
  $('frame-prev').onclick=()=>stepFrame(-1);
  $('frame-next').onclick=()=>stepFrame(1);
  $('speed').oninput=()=>{rate=Number($('speed').value);$('speed-value').textContent=rate+'×';};
  $('orbit-left').onclick=()=>{azimuth-=Math.PI/4;positionCamera();};
  $('orbit-right').onclick=()=>{azimuth+=Math.PI/4;positionCamera();};
  $('reset').onclick=()=>{azimuth=0;zoom=1.4;player.root.position.set(0,0,0);player.heading=0;positionCamera();resize();};
  let drag=null;
  view.addEventListener('pointerdown',e=>{view.focus();drag={id:e.pointerId,x:e.clientX};view.setPointerCapture(e.pointerId);});
  view.addEventListener('pointermove',e=>{if(drag?.id===e.pointerId){azimuth-=(e.clientX-drag.x)*.008;drag.x=e.clientX;positionCamera();}});
  view.addEventListener('pointerup',()=>{drag=null;});view.addEventListener('pointercancel',()=>{drag=null;});
  view.addEventListener('wheel',e=>{e.preventDefault();zoom=THREE.MathUtils.clamp(zoom-e.deltaY*.001, .8,2.5);resize();},{passive:false});
  const keys=new Set();
  const keydown=e=>{if(/INPUT|SELECT|BUTTON/.test(document.activeElement.tagName))return;if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)){e.preventDefault();keys.add(e.code);if(e.code==='Space'&&!e.repeat)play('attack');}};
  const keyup=e=>keys.delete(e.code),clearKeys=()=>keys.clear();
  window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',clearKeys);
  const clock=new THREE.Clock();let raf=0,previousReadout='';
  function tick(){
    raf=requestAnimationFrame(tick);const dt=Math.min(clock.getDelta(),.05);
    if(document.hidden)return;
    if(ready&&!paused){
      const x=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
      const z=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'));
      const attacking=player.clip==='attack'&&player.elapsed<player.clips.attack.frames/player.clips.attack.fps;
      if((x||z)&&!attacking&&player.clip!=='die') {
        const len=Math.hypot(x,z),dx=(x*Math.cos(azimuth)+z*Math.sin(azimuth))/len,dz=(-x*Math.sin(azimuth)+z*Math.cos(azimuth))/len;
        const next=player.root.position.clone().add(new THREE.Vector3(dx,0,dz).multiplyScalar(dt*moveSpeed*rate));
        next.x=THREE.MathUtils.clamp(next.x,-5.5,5.5);next.z=THREE.MathUtils.clamp(next.z,-5.5,5.5);
        if(!obstacles.some(o=>Math.hypot(next.x-o.x,next.z-o.z)<o.r))player.root.position.copy(next);
        player.heading=Math.atan2(dx,dz);player.play('walk');moving=true;
      } else if(moving&&!attacking){player.play('idle');moving=false;}
      player.update(dt*rate,camera,azimuth);
    } else player.update(0,camera,azimuth);
    renderCurrentPose();
  }
  function repaint(){player.update(0,camera,azimuth);renderCurrentPose();}
  function renderCurrentPose(){
    frameStrip.update(player);
    shadow.position.x=player.root.position.x;shadow.position.z=player.root.position.z;
    const text=player.directionUnavailable?`${DIRECTIONS[player.row]} · ท่านี้ยังไม่มี ใช้ภาพยืน`:`${DIRECTIONS[player.row]} · ${player.frame+1}/${player.action.frames}`;
    if(text!==previousReadout){$('readout').textContent=text;previousReadout=text;}
    [...$('directions').children].forEach((b,i)=>b.classList.toggle('selected',i===player.row));
    document.querySelectorAll('[data-clip]').forEach(b=>b.classList.toggle('selected',b.dataset.clip===player.clip));
    renderer.render(scene,camera);
  }
  if(new URLSearchParams(location.search).get('model')==='imagegen')$('body').value='imagegen_warrior_male';
  if(new URLSearchParams(location.search).get('model')==='blender')$('body').value='blender_warrior_male';
  if(new URLSearchParams(location.search).get('model')==='boxer-female')$('body').value='blender_boxer_female';
  if(new URLSearchParams(location.search).get('model')==='boxer-pixel')$('body').value='pixel_boxer_female';
  const requestedModel=roster.find(entry=>entry.model===new URLSearchParams(location.search).get('model'));
  if(requestedModel)$('body').value=requestedModel.id;
  tick();await loadBody();
  window.addEventListener('pagehide',()=>{
    cancelAnimationFrame(raf);observer.disconnect();window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',clearKeys);player.dispose();
    const geometries=new Set(),materials=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());renderer.dispose();
  },{once:true});
}
start().catch(error=>{status('เปิดภาพ 3D ไม่สำเร็จ: '+error.message);console.error(error);});
