import * as THREE from '/vendor/three/three.module.js';

// Sample both poses on a shared foot-anchored canvas. Blending premultiplied
// colors prevents dark fringes around transparent pixels.
export function smoothAtlas(material) {
  const uniforms={
    poseRectA:{value:new THREE.Vector4()},poseRectB:{value:new THREE.Vector4()},
    poseSizeA:{value:new THREE.Vector4()},poseSizeB:{value:new THREE.Vector4()},
    poseMix:{value:0},poseCanvas:{value:384},poseFloor:{value:32},poseTextureSize:{value:new THREE.Vector2(1,1)},poseTexture:{value:material.map},
  };
  material.alphaTest=.12;
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.fragmentShader=`uniform sampler2D poseTexture;
uniform vec4 poseRectA,poseRectB,poseSizeA,poseSizeB;
uniform float poseMix,poseCanvas,poseFloor;
uniform vec2 poseTextureSize;
vec4 readPose(vec4 rect,vec4 shape,vec2 point){
  vec2 uv=vec2(point.x/shape.x+shape.z,point.y/shape.y+1.0-shape.w);
  if(any(lessThan(uv,vec2(0.0)))||any(greaterThan(uv,vec2(1.0))))return vec4(0.0);
  vec2 edge=0.5/(abs(rect.zw)*poseTextureSize);
  return texture2D(poseTexture,rect.xy+clamp(uv,edge,1.0-edge)*rect.zw);
}
`+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
vec2 posePoint=vec2((vMapUv.x-0.5)*poseCanvas,vMapUv.y*poseCanvas-poseFloor);
vec4 poseA=readPose(poseRectA,poseSizeA,posePoint);
vec4 poseB=readPose(poseRectB,poseSizeB,posePoint);
float poseAlpha=mix(poseA.a,poseB.a,poseMix);
vec3 poseColor=mix(poseA.rgb*poseA.a,poseB.rgb*poseB.a,poseMix)/max(poseAlpha,0.00001);
diffuseColor*=vec4(poseColor,poseAlpha);
`);
  };
  material.customProgramCacheKey=()=> 'foot-anchored-atlas-v2';
  return (texture,a,b,mix,canvas=384,floor=32)=>{
    uniforms.poseCanvas.value=canvas;
    uniforms.poseFloor.value=floor;
    uniforms.poseTextureSize.value.set(texture.image.width,texture.image.height);
    uniforms.poseTexture.value=texture;
    for(const [cell,rect,size] of [[a,uniforms.poseRectA,uniforms.poseSizeA],[b,uniforms.poseRectB,uniforms.poseSizeB]]){
      rect.value.set(cell.flip?cell.x+cell.w:cell.x,cell.y,cell.flip?-cell.w:cell.w,cell.h);
      size.value.set(texture.image.width*cell.w,texture.image.height*cell.h,cell.flip?1-(cell.pivotX??.5):(cell.pivotX??.5),cell.foot??1);
    }
    uniforms.poseMix.value=mix;
  };
}
