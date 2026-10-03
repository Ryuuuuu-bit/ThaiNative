// Pixel-space bounds around the authored pivot, including pixels below the feet.
export function poseBounds(width, height, cells, padding=2) {
  let halfWidth=0, above=0, below=0;
  for(const cell of cells){
    const w=width*cell.w,h=height*cell.h,pivot=w*(cell.pivotX??.5),foot=h*(cell.foot??1);
    halfWidth=Math.max(halfWidth,pivot,w-pivot);
    above=Math.max(above,foot);below=Math.max(below,h-foot);
  }
  const floor=Math.ceil(Math.max(32,below+padding));
  return {floor,canvas:Math.ceil(Math.max(384,2*(halfWidth+padding),above+floor+padding))};
}
