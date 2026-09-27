import asyncio, secrets, json, sys
from playwright.async_api import async_playwright
S="window.game.scene.getScene('ayutthaya')"
D='/tmp/gui_audit/'
TAG=sys.argv[1] if len(sys.argv)>1 else 'a'
SIZES=[(1280,720),(1920,1080),(1024,768),(812,375)]
# widgets = visible elements that are positioned (fixed/absolute) direct HUD-ish blocks
AUDIT = r"""
(() => {
  const SEL = ['#ui .window','.t-stick','.t-atk','.t-fs','#dock-toggle','.pf','#party-frames','#target','#boss-bar','#dg-bar','.hud-right .zone','#clock','#td-minimap','#td-zone','#quest-track','.hud-buttons','#loot-log','.actionbar','#chat','.expbar','#toasts','#td-act','#boss-warn','.banner','#td-hud .td-bottom','.pf .gold','#auto-menu','#prompt'];
  const vis = (el) => { const cs = getComputedStyle(el); if (cs.display==='none'||cs.visibility==='hidden') return false; for (let p=el; p; p=p.parentElement) { if (getComputedStyle(p).display==='none') return false; } const r = el.getBoundingClientRect(); return r.width>2 && r.height>2; };
  const wrap = document.querySelector('#game-wrap').getBoundingClientRect();
  const boxes = [];
  for (const s of SEL) for (const el of document.querySelectorAll(s)) if (vis(el)) { const r = el.getBoundingClientRect(); boxes.push({ n: s, x: Math.round(r.left-wrap.left), y: Math.round(r.top-wrap.top), w: Math.round(r.width), h: Math.round(r.height) }); }
  const W = wrap.width, H = wrap.height, ov = [], off = [];
  const nest = (a,b) => (a.n==='.pf'&&b.n==='.pf .gold')||(b.n==='.pf'&&a.n==='.pf .gold');
  for (let i=0;i<boxes.length;i++){ const a=boxes[i];
    if (a.x<-1||a.y<-1||a.x+a.w>W+1||a.y+a.h>H+1) off.push(a.n+` [${a.x},${a.y},${a.w}x${a.h}]`);
    for (let j=i+1;j<boxes.length;j++){ const b=boxes[j]; if (nest(a,b)) continue;
      const ix=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x), iy=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);
      if (ix>1&&iy>1) ov.push(`${a.n} ✕ ${b.n} (${ix}x${iy})`); } }
  return { boxes, ov, off };
})()
"""
async def m():
  async with async_playwright() as p:
    b=await p.chromium.launch(args=["--use-gl=swiftshader","--enable-unsafe-swiftshader"])
    ctx=await b.new_context(viewport={"width":1280,"height":720}); pg=await ctx.new_page(); errs=[]
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto("http://localhost:3000/"); await pg.wait_for_timeout(1500)
    tok = await pg.evaluate("fetch('/api/register',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'tester',password:'%s'})}).then(r=>r.json()).then(d=>d.token)" % secrets.token_hex(8))
    await pg.evaluate(f"localStorage.setItem('thainative_token','{tok}')"); await pg.reload(); await pg.wait_for_timeout(2500)
    await pg.fill("#cc-name","ทดสอบ"); await pg.click("[data-w='1']"); await pg.click("#cc-start"); await pg.wait_for_timeout(2000)
    await pg.keyboard.press('Enter'); await pg.wait_for_timeout(5000)
    await pg.evaluate(f"{S}.econ.act('gm',{{cmd:'lv',a1:'15'}})"); await pg.wait_for_timeout(500)
    await pg.evaluate("""(()=>{const $=s=>document.querySelector(s);
      $('#target').classList.remove('hidden'); $('#t-name').textContent='ผีปอบ'; $('#t-lv').textContent='Lv.12';
      $('#boss-bar').classList.remove('hidden'); const bw=$('#boss-warn'); bw.classList.remove('hidden'); $('#bw-name').textContent='กระทืบธรณี!'; $('#bw-hint').textContent='ถอยออกจากวงแดง';
      const bn=$('#banner'); bn.classList.remove('hidden'); bn.style.animation='none'; bn.style.opacity=1; $('#banner-text').textContent='ได้รับฉายา ผู้เลือกทาง'; $('#banner-sub').textContent='ทดสอบ';
      $('#prompt').classList.remove('hidden'); $('#prompt').textContent='กด F เพื่อคุย';
      const pf=$('#party-frames'); pf.classList.remove('hidden'); pf.innerHTML='<div class=pm><span class=pm-job>⚔️</span><div><div class=pm-name>เพื่อน1</div><div class="bar hp"><i style="width:70%"></i></div></div></div>'.repeat(3);
      const q=$('#quest-track'); q.classList.remove('hidden'); q.innerHTML='<div><b>ปราบผีปอบ</b><span>3/10 ตัว</span></div><div><b>เก็บสมุนไพร</b><span>1/5</span></div><div><b>ส่งของให้ยายติ๋ม</b><span>0/1</span></div>';
      const l=$('#loot-log'); for(let i=0;i<5;i++){const d=document.createElement('div'); d.textContent='ได้รับ ขวดน้ำมนต์เล็ก x1'; l.appendChild(d);} 
      const t=$('#toasts'); const d=document.createElement('div'); d.className='toast'; d.textContent='ฉายาใหม่: ผู้เลือกทาง'; d.style.animation='none'; t.appendChild(d);
      for(let i=0;i<8;i++) window.game.scene.getScene('ayutthaya').ui.chat({name:'ระบบ',text:'ข้อความทดสอบแชทยาวพอสมควร '+i});
    })()""")
    report={}
    for (w,h) in SIZES:
      await pg.set_viewport_size({"width":w,"height":h}); await pg.wait_for_timeout(900)
      r = await pg.evaluate(AUDIT); report[f'{w}x{h}']={'ov':r['ov'],'off':r['off']}
      await pg.screenshot(path=D+f'{TAG}_{w}x{h}.png')
      for key,panel in [('i','inv'),('k','skill'),('m','map'),('j','quest'),('c','stats'),('p','social'),('o','card'),('h','help')]:
        await pg.keyboard.press(key); await pg.wait_for_timeout(900)
        r2 = await pg.evaluate(AUDIT); report[f'{w}x{h}+{panel}']={'ov':r2['ov'],'off':r2['off']}
        if w==1280: await pg.screenshot(path=D+f'{TAG}_{w}x{h}_{panel}.png')
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(400)
        still = await pg.evaluate("[...document.querySelectorAll('#ui .window:not(.hidden)')].map(e=>e.id)")
        if still:
          await pg.evaluate("document.querySelectorAll('#ui .window:not(.hidden)').forEach(e=>e.classList.add('hidden'))"); await pg.wait_for_timeout(300)
    print(json.dumps(report, ensure_ascii=False, indent=1)); print('errs', errs[:5])
    json.dump(r['boxes'], open(D+f'{TAG}_boxes.json','w'), ensure_ascii=False)
    await b.close()
asyncio.run(m())
