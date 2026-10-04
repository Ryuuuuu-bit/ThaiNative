import * as THREE from '/vendor/three/three.module.js';

// A bounded first art pass. Positions and footprints still come from the shared map.
export const PLAZA_BOUNDS = { left: 1510, right: 2240, top: 560, bottom: 1240 };
export const inPaintedPlaza = (x, y) => x >= PLAZA_BOUNDS.left && x <= PLAZA_BOUNDS.right
  && y >= PLAZA_BOUNDS.top && y <= PLAZA_BOUNDS.bottom;
const ROOT = '/assets/world/plaza-v1/';

export function plazaAsset(prop) {
  if (!inPaintedPlaza(prop.x, prop.y)) return null;
  const key = prop.key || '', fw = prop.foot?.[0] || 0;
  if (key === 'env/b_fountain') return { name: 'fountain', width: 116, aspect: 2, anchor: .985 };
  if (key === 'env/b_pavilion' && prop.x === 1648 && prop.y === 896)
    return { name: 'temple', width: 144, aspect: 1, anchor: .96 };
  if (/b_shophouse/.test(key)) return { name: 'shop', width: fw * 19, aspect: 4 / 3, anchor: .975 };
  // Trees keep their volumetric canopy, including inside the illustrated plaza.
  return null;
}

/** Install authored cutouts over the native models only after each asset loads.
 * One texture per asset is shared by all copies; failed loads retain the native art.
 * Ownership stays on the city so map changes cancel loads and release GPU memory.
 */
export function installPlazaArt(city, map, quality = {}) {
  if (map.id !== 'ayutthaya' || typeof Image === 'undefined') return;
  const records = new Map(), models = [];
  let disposed = false;
  const previousCancel = city.userData.cancelTextureLoad;
  city.userData.cancelTextureLoad = () => {
    disposed = true; previousCancel?.();
    for (const r of records.values()) { r.image.onload = null; r.image.onerror = null; }
  };
  city.userData.paintedModels = models;
  city.userData.paintedLabels = new Map();
  const waterTime = city.userData.paintedWaterTime = { value: 0 };
  for (const model of city.children) {
    const art = plazaAsset(model.userData.prop || {}); if (!art) continue;
    let record = records.get(art.name);
    if (!record) {
      const texture = new THREE.Texture(); texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.anisotropy = 4;
      const material = new THREE.MeshBasicMaterial({ map: texture, alphaTest: .18, side: THREE.DoubleSide, toneMapped: false });
      if (art.name === 'fountain') {
        material.onBeforeCompile = shader => {
          shader.uniforms.plazaTime = waterTime;
          shader.fragmentShader = 'uniform float plazaTime;\n' + shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
            #ifdef USE_MAP
            float waterMask = step(diffuseColor.r * 1.25, diffuseColor.g) * step(diffuseColor.r * 1.25, diffuseColor.b);
            float ripple = sin(vMapUv.x * 120.0 + vMapUv.y * 90.0 - plazaTime * 1.7);
            diffuseColor.rgb *= 1.0 + waterMask * ripple * .045;
            #endif`);
        };
        material.customProgramCacheKey = () => 'plaza-lotus-water-v1';
      }
      const image = new Image(); record = { texture, material, image, meshes: [] };
      records.set(art.name, record);
      city.userData.ownedMaterials.push(material);
      const pending = record;
      image.onload = () => {
        if (disposed) return;
        const limit = quality.name === 'low' ? 512 : quality.name === 'balanced' ? 1024 : 1536;
        const width = image.naturalWidth || image.width, height = image.naturalHeight || image.height;
        if (Math.max(width, height) > limit && typeof document !== 'undefined') {
          const canvas = document.createElement('canvas'), ratio = limit / Math.max(width, height);
          canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
          const context = canvas.getContext('2d'); context.imageSmoothingQuality = 'high';
          context.drawImage(image, 0, 0, canvas.width, canvas.height); texture.image = canvas;
        } else texture.image = image;
        texture.needsUpdate = true;
        for (const { model, mesh, fallback } of pending.meshes) {
          // Hiding, rather than disposing shared template geometry, keeps other copies valid.
          for (const child of fallback) { child.visible = false; child.traverse(part => { part.raycast = () => {}; }); }
          mesh.visible = true; model.userData.paintedReady = true;
        }
      };
      image.onerror = () => { if (!disposed) console.warn(`Plaza art unavailable: ${art.name}; retaining native model.`); };
    }
    const height = art.width / art.aspect;
    const geometry = new THREE.PlaneGeometry(art.width, height);
    geometry.translate(0, height * (art.anchor - .5), 0);
    const mesh = new THREE.Mesh(geometry, record.material);
    mesh.name = `Painted ${art.name}`; mesh.rotation.x = -Math.PI / 3;
    mesh.position.y = .18; mesh.visible = false; mesh.renderOrder = 1;
    // Template flips are retained; the foot anchor remains at the collision edge.
    const fallback = [...model.children]; model.add(mesh);
    model.userData.paintedMesh = mesh; model.userData.paintedArt = art.name;
    model.userData.paintedLabelHeight = height * art.anchor * Math.abs(model.scale.y);
    city.userData.paintedLabels.set(model.userData.prop, model);
    record.meshes.push({ model, mesh, fallback }); models.push(model);
  }
  for (const [name, record] of records) record.image.src = `${ROOT}${name}.webp`;
  // Flush stone inlays are decorative, so they add no collision or navigation obstacles.
  const inlay = new THREE.Group(); inlay.name = 'Lotus court stone inlay'; inlay.position.set(1856, .12, 800);
  const stone = new THREE.MeshBasicMaterial({ color: 0xa48a54, toneMapped: false, side: THREE.DoubleSide });
  for (const [inner, outer] of [[126, 128], [132, 133]]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 96), stone);
    ring.rotation.x = -Math.PI / 2; inlay.add(ring);
  }
  city.add(inlay);
}

export function updatePlazaArt(city, light = 1, time = 0) {
  if (city?.userData.paintedWaterTime) city.userData.paintedWaterTime.value = time;
  const day = Math.max(0, Math.min(1, light));
  for (const model of city?.userData.paintedModels || []) {
    const mesh = model.userData.paintedMesh;
    // Basic materials retain authored detail while responding to the game's day/night cycle.
    mesh.material.color.setRGB(.55 + day * .45, .64 + day * .36, .77 + day * .23);
    if (model.userData.paintedArt === 'tree') mesh.rotation.z = Math.sin(time * .65 + model.position.x) * .004;
  }
}
