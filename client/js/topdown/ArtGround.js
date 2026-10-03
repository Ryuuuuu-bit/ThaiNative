// Painted terrain shared by all maps. Coordinate hashes keep reloads deterministic.
export function paintGround(ctx,ground,TILE,T,style={}) {
  const hash=(x,y,k=0)=>{let v=Math.imul(x+137,374761393)^Math.imul(y+71,668265263)^Math.imul(k+1,1274126177);v=Math.imul(v^(v>>>13),1274126177);return ((v^(v>>>16))>>>0)/4294967296;};
  const water=t=>t===T.WATER||t===T.WATER2,grass=t=>[T.GRASS,T.GRASS2,T.GRASS3,T.TALL].includes(t);
  const colors={grass:[76,111,76],road:[176,149,110],brick:[165,107,76],sand:[202,182,131],stone:[186,185,159],paddy:[107,129,63],wood:[123,85,54],wall:[145,132,110],water:[39,109,126]};
  const color=(c,v)=>`rgb(${c.map(n=>Math.max(0,Math.min(255,Math.round(n+v)))).join(',')})`;
  const fill=(x,y,w,h,c)=>{ctx.fillStyle=typeof c==='number'?'#'+c.toString(16).padStart(6,'0'):c;ctx.fillRect(x,y,w,h);};
  const kind=t=>water(t)?'water':grass(t)?'grass':({[T.ROAD]:'road',[T.BRICK]:'brick',[T.SAND]:'sand',[T.STONE]:'stone',[T.PADDY]:'paddy',[T.WOOD]:'wood',[T.WALL]:'wall',[T.WALLTOP]:'wall'}[t]||'grass');
  for(let y=0;y<ground.length;y++)for(let x=0;x<ground[y].length;x++){
    const k=kind(ground[y][x]),X=x*TILE,Y=y*TILE,c=colors[k];
    const variation=(hash(Math.floor(x/3),Math.floor(y/3))- .5)*12+(hash(x,y)-.5)*5;
    fill(X,Y,TILE,TILE,color(c,variation));
    if(k==='stone'||k==='brick'||k==='wood'){
      const step=k==='stone'?8:k==='brick'?5:4;
      for(let sy=0;sy<TILE;sy+=step){const offset=k==='wood'?0:((y*TILE+sy)/step%2)*8;
        fill(X,Y+sy,TILE,.7,color(c,variation-26));fill(X,Y+sy+1,TILE,.6,color(c,variation+18));
        if(k!=='wood')for(let sx=offset;sx<TILE;sx+=k==='stone'?16:8)fill(X+sx,Y+sy,1,step,color(c,variation-23));
      }
    }else if(k==='grass'||k==='paddy'){
      for(let i=0;i<7;i++){const a=X+hash(x,y,i+2)*14,b=Y+hash(y,x,i+11)*14;
        fill(a,b,.7,1.5,color(c,variation+(i%2?18:-12)));}
      if(hash(x,y,24)<.022){fill(X+7,Y+8,1,3,'#3e6241');fill(X+6,Y+7,3,2,hash(y,x)>.5?'#e0c57e':'#cba6b0');}
      if(k==='paddy')for(let i=2;i<TILE;i+=5)fill(X+i,Y,1,TILE,'rgba(198,189,93,.22)');
    }else if(k==='water'){
      for(let i=0;i<2;i++)fill(X+hash(x,y,i+45)*10,Y+hash(y,x,i+62)*14,3+hash(x,y,i+7)*4,.5,'rgba(150,210,209,.2)');
    }else for(let i=0;i<3;i++)fill(X+hash(x,y,i+36)*15,Y+hash(y,x,i+19)*15,1,1,color(c,variation-12));
    if(k==='grass'||k==='paddy')for(const [dx,dy]of [[0,-1],[0,1],[-1,0],[1,0]]){
      const t=ground[y+dy]?.[x+dx];if(t===undefined||grass(t)||t===T.PADDY||water(t))continue;
      const grad=ctx.createLinearGradient(X+(dx<0?0:dx>0?TILE:TILE/2),Y+(dy<0?0:dy>0?TILE:TILE/2),X+TILE/2,Y+TILE/2);
      grad.addColorStop(0,'rgba(176,149,110,.5)');grad.addColorStop(1,'rgba(176,149,110,0)');fill(X,Y,TILE,TILE,grad);
    }
    if(k==='water')for(const [dx,dy]of [[0,-1],[0,1],[-1,0],[1,0]])if(ground[y+dy]?.[x+dx]!==undefined&&!water(ground[y+dy][x+dx])){
      const bx=X+(dx===1?TILE-2:0),by=Y+(dy===1?TILE-2:0);
      fill(bx,by,dx?2:TILE,dy?2:TILE,'rgba(23,63,67,.35)');fill(bx+(dx===-1?1:0),by+(dy===-1?1:0),dx?1:TILE,dy?1:TILE,'rgba(165,208,181,.5)');
    }
  }
  if(style.overlay)fill(0,0,ground[0].length*TILE,ground.length*TILE,style.overlay);
  if(style.water)for(let y=0;y<ground.length;y++)for(let x=0;x<ground[y].length;x++)if(water(ground[y][x]))fill(x*TILE,y*TILE,TILE,TILE,style.water);
}
