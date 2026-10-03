// The simulation stays in map pixels: x is east, y is south; Three uses x/z.
export const WORLD_TILT = Math.PI * 55 / 180;

export function frameQuad(frame, originX, originY, flipX = false, flipY = false) {
  const left = (frame.x || 0) - originX;
  const top = originY - (frame.y || 0);
  let x0 = left, x1 = left + frame.width;
  let y0 = top - frame.height, y1 = top;
  if (flipX) [x0, x1] = [-x1, -x0];
  if (flipY) [y0, y1] = [-y1, -y0];
  const u0 = flipX ? frame.u1 : frame.u0, u1 = flipX ? frame.u0 : frame.u1;
  // DOM image textures are flipped on upload, so Phaser v=0 becomes Three v=1.
  const v0 = 1 - (flipY ? frame.v0 : frame.v1);
  const v1 = 1 - (flipY ? frame.v1 : frame.v0);
  return { positions: [x0,y0,0, x1,y0,0, x0,y1,0, x1,y1,0],
    uvs: [u0,v0, u1,v0, u0,v1, u1,v1] };
}

export function graphicsBounds(commands) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, pad = 2;
  const point = (x,y) => { minX=Math.min(minX,x); minY=Math.min(minY,y); maxX=Math.max(maxX,x); maxY=Math.max(maxY,y); };
  const sizes = {0:7,1:0,2:0,3:4,4:2,5:2,6:3,7:2,8:0,9:0,10:6,11:6,14:0,15:0,16:2,17:2,18:1,21:5,22:6};
  for (let i=0;i<commands.length;) {
    const op=commands[i++], n=sizes[op];
    if (n == null) break;
    const a=commands.slice(i,i+n); i+=n;
    if (op===0) {point(a[0]-a[2],a[1]-a[2]);point(a[0]+a[2],a[1]+a[2]);}
    if (op===3) {point(a[0],a[1]);point(a[0]+a[2],a[1]+a[3]);}
    if (op===4||op===5) point(a[0],a[1]);
    if (op===10||op===11) for(let j=0;j<6;j+=2) point(a[j],a[j+1]);
    if (op===6) pad=Math.max(pad,a[0]+2);
  }
  if (!Number.isFinite(minX)) return {x:-1,y:-1,width:2,height:2};
  return {x:Math.floor(minX-pad),y:Math.floor(minY-pad),width:Math.ceil(maxX-minX+pad*2),height:Math.ceil(maxY-minY+pad*2)};
}
