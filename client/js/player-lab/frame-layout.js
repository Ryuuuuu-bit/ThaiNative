// Coordinates are normalized, with top-left origins in authored metadata.
// A layout can describe a single-direction action without inventing other rows.
export function layoutCell(layout, direction, frame) {
  const sequence=layout.directions[direction];
  if(!sequence)return null;
  const entry=sequence[Math.min(frame,sequence.length-1)];
  if(entry==null)return null;
  if(typeof entry==='object')return {x:entry.x,y:1-entry.y-entry.h,w:entry.w,h:entry.h,foot:entry.foot,pivotX:entry.pivotX,flip:entry.flip,source:entry.source,ppu:entry.ppu};
  const col=entry%layout.columns,row=Math.floor(entry/layout.columns);
  return {x:col/layout.columns,y:1-(row+1)/layout.rows,w:1/layout.columns,h:1/layout.rows};
}
