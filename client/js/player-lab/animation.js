import { frameIndexAt } from './frame-timing.js';
export const DIRECTIONS = ['south','south-east','east','north-east','north','north-west','west','south-west'];
export const CLIPS = { idle:{frames:4,fps:5,loop:true}, walk:{frames:6,fps:10,loop:true}, attack:{frames:6,fps:12,loop:false}, die:{frames:7,fps:8,loop:false} };
export function frameAt(time, clip) {
  return frameIndexAt(time * 1000, clip.frames, clip.fps, clip.loop, clip.durations);
}
export function directionClip(clip, direction) {
  if(!clip.directionFrames&&!clip.directionFps&&!clip.directionDurations)return clip;
  return {...clip,frames:clip.directionFrames?.[direction]??clip.frames,fps:clip.directionFps?.[direction]??clip.fps,durations:clip.directionDurations?.[direction]??clip.durations};
}
// World heading is clockwise from +Z. Camera azimuth changes the visible sprite row.
export function viewDirection(heading, cameraAzimuth) {
  return ((Math.round((heading-cameraAzimuth)/(Math.PI/4))%8)+8)%8;
}
export function stableViewDirection(heading, cameraAzimuth, previous) {
  if (Number.isInteger(previous) && previous >= 0 && previous < 8) {
    const angle=heading-cameraAzimuth-previous*Math.PI/4;
    const distance=Math.abs(Math.atan2(Math.sin(angle),Math.cos(angle)));
    if(distance <= Math.PI/8+.035)return previous;
  }
  return viewDirection(heading,cameraAzimuth);
}
export function poseBlend(clip, fraction) {
  if(clip!=='idle')return 0;
  const t=Math.max(0,Math.min(1,(fraction-.25)/.75));
  return t*t*(3-2*t);
}
export function atlasCell(frame,row,columns) {
  return { x:frame/columns, y:1-(row+1)/8, w:1/columns, h:1/8 };
}

// Provisional sockets for the existing 72px character art, measured from its feet.
// Production equipment should supply sockets[clip][direction][frame] or full-frame atlases.
const HAND = [[-11,22],[-3,22],[5,22],[10,24],[11,24],[-10,24],[-5,22],[3,22]];
const SWING = [-.7,-1,.2,.9,.7,.2];
export function demoSocket(slot,clip,row,frame) {
  const bob = clip==='walk' ? [0,1,0,0,1,0][frame%6] : clip==='idle' && frame>1 ? 1 : 0;
  if(slot==='head') return {x:0,y:53+bob,rotation:0,behind:false};
  const [x,y]=HAND[row];
  const side=row>=5 ? -1:1;
  return {x,y:y+bob,rotation:clip==='attack' ? SWING[frame%6]*side : -.2*side,behind:row>=3&&row<=5};
}
