import * as THREE from '/vendor/three/three.module.js';

// Collapse a prop's fixed pieces into one mesh per material. Templates reuse these
// baked geometries, so details do not add a draw call for every plank and leaf.
export function bakeStaticMeshes(group) {
  group.updateMatrixWorld(true);
  const inverse = group.matrixWorld.clone().invert(), batches = new Map(), removed = [];
  group.traverse(part => {
    if (!part.isMesh || part.isInstancedMesh) return;
    const material = part.material;
    const batch = batches.get(material) || { positions: [], normals: [], uvs: [], cast: false };
    batches.set(material, batch);
    const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
    geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, part.matrixWorld));
    const p = geometry.attributes.position, n = geometry.attributes.normal, uv = geometry.attributes.uv;
    for (let i=0;i<p.count;i++) {
      batch.positions.push(p.getX(i),p.getY(i),p.getZ(i));
      batch.normals.push(n?.getX(i)||0,n?.getY(i)||0,n?.getZ(i)||0);
      batch.uvs.push(uv?.getX(i)||0,uv?.getY(i)||0);
    }
    batch.cast ||= part.castShadow;geometry.dispose();removed.push(part);
  });
  for (const part of removed) {part.removeFromParent();part.geometry.dispose();}
  for (const [material,batch] of batches) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(batch.positions,3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(batch.normals,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(batch.uvs,2));
    geometry.computeBoundingSphere();
    const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=batch.cast;mesh.receiveShadow=true;group.add(mesh);
  }
  return group;
}
