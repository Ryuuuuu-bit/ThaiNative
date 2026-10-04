// Clear, original vector emblems for navigation. Gameplay icons keep their item/skill art.
const paths={
  stats:'<path d="M5 20v-6m7 6V9m7 11V4M3 22h19"/>',
  bag:'<path d="M7 8h10l3 13H4L7 8Zm2 0V6a3 3 0 0 1 6 0v2M9 13h6"/>',
  skill:'<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z"/>',
  cards:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="m12 7 3 5-3 5-3-5 3-5Z"/>',
  guide:'<path d="M12 5Q6 1 2 4v15q5-3 10 1 5-4 10-1V4q-5-3-10 1v15"/>',
  map:'<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16"/>',
  party:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-5q0-5 6-5t6 5v5m1-17q6 0 5 6m-4 3q5 1 5 8"/>',
  quest:'<path d="M7 3h12v16q0 3-3 3H5q-3 0-3-4h14M7 3q-5 0-5 5h5V3v15m3-9h6m-6 4h6"/>',
  help:'<circle cx="12" cy="12" r="10"/><path d="M9 8q0-4 5-2 5 3-2 6v3m0 3v.1"/>',
  home:'<path d="m3 12 9-9 9 9M6 10v11h12V10m-8 11v-6h4v6"/>',
  settings:'<path d="m9 2 6 0 1 4 4 2 2 6-3 3-1 4-6 1-3-3-4-2-1-6 3-3 2-6Z"/><circle cx="12" cy="12" r="3"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  fullscreen:'<path d="M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6"/>',
  attack:'<path d="m6 19 13-13 2-3v5L8 21m-4-5 5 5m-6 1 3-3M6 3l12 13m-3 1 5-5m-2 6 3 3"/>',
  info:'<circle cx="12" cy="12" r="10"/><path d="M12 10v7m0-11v.1"/>',
};
export const hudIcon=key=>`<svg class="hud-icon" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${paths[key]||paths.info}</g></svg>`;
const menus={
  'stats-panel':['stats','สถานะ'], 'inv-panel':['bag','กระเป๋า'], 'skill-panel':['skill','สกิล'],
  'card-panel':['cards','การ์ดผี'], 'guide-panel':['guide','คู่มือผี'], 'map-panel':['map','แผนที่'],
  'social-panel':['party','ปาร์ตี้'], 'quest-panel':['quest','เควส'], 'help-panel':['help','วิธีเล่น'],
  'settings-panel':['settings','ตั้งค่า'],
};

export class GameHud {
  constructor(scene){
    this.s=scene;const hud=document.getElementById('hud');
    const dock=hud.querySelector('.hud-buttons');
    dock.setAttribute('aria-label','เมนูเกม');
    for(const button of dock.querySelectorAll('[data-open],#btn-home')){
      const [icon,label]=button.id==='btn-home'?['home','คืนถิ่น']:menus[button.dataset.open]||['help','เมนู'];
      const key=button.querySelector('small')?.textContent||'';
      button.innerHTML=`${hudIcon(icon)}<span class="hud-menu-label">${label}</span><small>${key}</small>`;
      button.setAttribute('aria-label',label);
    }
    const toggle=document.getElementById('dock-toggle');
    toggle.innerHTML=`${hudIcon('menu')}<span>เมนู</span>`;toggle.setAttribute('aria-label','เมนูเกม');
    toggle.setAttribute('aria-controls','game-menu');dock.id='game-menu';
    this.dockObserver=new MutationObserver(()=>toggle.setAttribute('aria-expanded',String(dock.classList.contains('open'))));
    this.dockObserver.observe(dock,{attributes:true,attributeFilter:['class']});
    toggle.setAttribute('aria-expanded',String(dock.classList.contains('open')));

    this.portrait=hud.querySelector('.pf-portrait-wrap');
    this.portrait.setAttribute('role','button');this.portrait.tabIndex=0;
    this.portrait.setAttribute('aria-label','เปิดสถานะตัวละคร');this.portrait.title='ดูสถานะตัวละคร (C)';
    this.openProfile=()=>scene.ui.toggle('stats-panel');
    this.profileKey=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();this.openProfile();}};
    this.portrait.addEventListener('click',this.openProfile);this.portrait.addEventListener('keydown',this.profileKey);
    const fs=document.getElementById('t-fs'),attack=document.getElementById('t-atk');
    if(fs){fs.innerHTML=`${hudIcon('fullscreen')}<small>เต็มจอ</small>`;fs.title='เต็มจอ · เล่นแนวนอน';}
    if(attack)attack.innerHTML=`${hudIcon('attack')}<small>โจมตี</small>`;

    this.panel=document.createElement('section');this.panel.id='development-panel';this.panel.className='panel window hidden';
    this.panel.innerHTML=`<header>บันทึกการพัฒนา <button class="close" aria-label="ปิดบันทึกการพัฒนา">✕</button></header>
      <div class="development-body"><p class="development-kicker">THAINATIVE · WORLD IN PROGRESS</p>
      <h2>เริ่มต้นตำนานที่อโยธยา</h2><p>เกมอยู่ระหว่างปรับปรุงภาพและประสบการณ์เล่น เปิดให้สำรวจอโยธยาและโซนภูติผีรอบเมืองก่อน</p>
      <ul><li>เมือง ป่าไผ่ ทุ่งนา ป่าช้า และบึงยังสำรวจได้</li><li>แมพต่างแดนและดันเจี้ยนพักไว้ระหว่างพัฒนา</li><li>กำลังปรับฉาก แสงเงา HUD และการเล่นบนมือถือ</li></ul>
      <p class="development-save">ตัวละคร เลเวล และไอเท็มเดิมยังคงอยู่ ผู้เล่นที่บันทึกไว้ในแมพที่พักจะเริ่มที่อโยธยา</p>
      <a href="https://discord.gg/x9schPHqqX" target="_blank" rel="noopener noreferrer">แจ้งปัญหาและเสนอไอเดียใน Discord ↗</a></div>`;
    document.getElementById('ui').appendChild(this.panel);
    this.panel.querySelector('.close').onclick=()=>scene.ui.toggle('development-panel',false);
    this.chip=document.createElement('button');this.chip.className='development-chip';this.chip.title='ดูรายละเอียดช่วงพัฒนา';
    this.chip.innerHTML='<i></i><span>เปิดทดสอบ · อโยธยา</span>'+hudIcon('info');
    this.chip.onclick=()=>scene.ui.toggle('development-panel');hud.appendChild(this.chip);
    this.statusMenu=document.createElement('button');this.statusMenu.setAttribute('aria-label','บันทึกการพัฒนา');
    this.statusMenu.innerHTML=hudIcon('info')+'<span class="hud-menu-label">ช่วงพัฒนา</span>';
    this.statusMenu.onclick=()=>scene.ui.toggle('development-panel');dock.appendChild(this.statusMenu);
    scene.events.once('shutdown',()=>this.destroy());
  }
  destroy(){
    this.dockObserver.disconnect();this.portrait.removeEventListener('click',this.openProfile);
    this.portrait.removeEventListener('keydown',this.profileKey);this.portrait.removeAttribute('role');this.portrait.removeAttribute('tabindex');
    this.chip.remove();this.panel.remove();this.statusMenu.remove();
  }
}
