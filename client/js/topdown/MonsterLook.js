import * as THREE from '/vendor/three/three.module.js';

export function monsterLook(def={}) {
  return {glow:def.palette?.glow|| (def.boss?'#ebbf73':def.elite?'#b4a2da':'#a2beb0'),
    aura:def.boss?.22:def.elite?.13:def.behavior==='flyer'?.09:.035,
    rim:def.boss?.2:def.elite?.14:.07};
}

export function createMonsterMaterial(def) {
  const look=monsterLook(def);
  const material=new THREE.ShaderMaterial({transparent:true,alphaTest:.12,side:THREE.DoubleSide,toneMapped:false,
    uniforms:{atlas:{value:null},tint:{value:new THREE.Color()},glow:{value:new THREE.Color(look.glow)},texel:{value:new THREE.Vector2()},bounds:{value:new THREE.Vector4()},
      opacity:{value:1},daylight:{value:1},rim:{value:look.rim},selected:{value:0},fillTint:{value:0}},
    vertexShader:'varying vec2 spriteUV;void main(){spriteUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`uniform sampler2D atlas;uniform vec3 tint,glow;uniform vec2 texel;uniform vec4 bounds;uniform float opacity,daylight,rim,selected,fillTint;varying vec2 spriteUV;
      vec4 sampleSprite(vec2 p){if(p.x<bounds.x||p.y<bounds.y||p.x>bounds.z||p.y>bounds.w)return vec4(0.0);return texture2D(atlas,p);}
      float heightAt(vec4 c){return dot(c.rgb,vec3(.22,.56,.22))*c.a;}
      void main(){vec4 c=sampleSprite(spriteUV);if(c.a<.12)discard;
        vec4 l=sampleSprite(spriteUV-vec2(texel.x,0.0)),r=sampleSprite(spriteUV+vec2(texel.x,0.0));
        vec4 b=sampleSprite(spriteUV-vec2(0.0,texel.y)),t=sampleSprite(spriteUV+vec2(0.0,texel.y));
        vec3 n=normalize(vec3((heightAt(l)-heightAt(r))*.7,(heightAt(b)-heightAt(t))*.7,1.0));
        float diffuse=max(0.0,dot(n,normalize(vec3(-.55,.7,.8))));float edge=1.0-min(min(l.a,r.a),min(t.a,b.a));
        float light=.78+diffuse*(.17+daylight*.12);vec3 rgb=c.rgb*tint*light;
        rgb=mix(rgb,tint,fillTint);rgb+=glow*edge*(rim+selected*.18);
        gl_FragColor=vec4(rgb,c.a*opacity);
        #include <colorspace_fragment>
      }`});
  material.color=material.uniforms.tint.value;material.userData.monster=true;return material;
}

export function updateMonsterMaterial(material,texture,frame,object,daylight,selected) {
  const u=material.uniforms;u.atlas.value=texture;u.texel.value.set(1/texture.image.width,1/texture.image.height);
  // Bound all neighbour samples to this animation frame, avoiding adjacent atlas cells.
  u.bounds.value.set(Math.min(frame.u0,frame.u1),Math.min(1-frame.v0,1-frame.v1),Math.max(frame.u0,frame.u1),Math.max(1-frame.v0,1-frame.v1));
  u.opacity.value=material.opacity;u.daylight.value=daylight;u.selected.value=selected?1:0;u.fillTint.value=object.tintFill?1:0;
}

export function createMonsterAura(def) {
  const look=monsterLook(def);
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false,
    uniforms:{glow:{value:new THREE.Color(look.glow)},strength:{value:look.aura},time:{value:0},boss:{value:def.boss?1:0}},
    vertexShader:'varying vec2 p;void main(){p=uv*2.0-1.0;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`uniform vec3 glow;uniform float strength,time,boss;varying vec2 p;void main(){float r=length(p);if(r>1.0)discard;float mist=pow(1.0-r,2.0);float ring=(1.0-smoothstep(.014,.04,abs(r-(.65+sin(time)*.015))))*boss*.38;float a=(mist+ring)*strength*(.9+.1*sin(time*1.8));gl_FragColor=vec4(glow,a);\n#include <colorspace_fragment>\n}`});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),material);mesh.rotation.x=-Math.PI/2;mesh.renderOrder=.8;return mesh;
}

// NPCs share sprite relief lighting, with a softer warm rim and no hostile aura.
export function createNpcMaterial(visual={}) {
  const material=createMonsterMaterial({palette:{glow:visual.color||'#ead8b0'}});
  material.userData.monster=false;material.userData.npc=true;material.uniforms.rim.value=.035;
  return material;
}
