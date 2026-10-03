import * as THREE from '/vendor/three/three.module.js';

// PixelLab cutouts sit at different depths above the animated title painting.
// The DOM owns interaction; this canvas is decorative and never captures input.
export class TitleDepth {
  constructor(source) {
    this.source = source;
    this.dead = false;
    this.pointer = { x: 0, y: 0 };
    this.focus = 0;
    this.layers = [];
    this.textures = new Set();
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
    this.mobile = matchMedia('(pointer: coarse)').matches;
    this.renderer = new THREE.WebGLRenderer({ alpha: false, antialias: false, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, this.mobile ? 1 : 1.25));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.canvas = this.renderer.domElement;
    this.canvas.id = 'title-depth';
    this.canvas.classList.add('loading');
    this.canvas.setAttribute('aria-hidden', 'true');
    source.after(this.canvas);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#080d13');
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 50);
    this.camera.position.z = 12;
    this.texture = new THREE.CanvasTexture(source);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = this.texture.magFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.textures.add(this.texture);
    this.backdrop = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.texture }));
    this.scene.add(this.backdrop);
    this.onPointer = e => {
      if (e.pointerType === 'touch') return;
      this.pointer.x = (e.clientX / innerWidth - 0.5) * 2;
      this.pointer.y = (e.clientY / innerHeight - 0.5) * 2;
    };
    this.onLeave = () => { this.pointer.x = this.pointer.y = 0; };
    this.onLost = e => { e.preventDefault(); this.dispose(); };
    window.addEventListener('pointermove', this.onPointer, { passive: true });
    document.documentElement.addEventListener('pointerleave', this.onLeave);
    this.canvas.addEventListener('webglcontextlost', this.onLost);
    this.resize();
  }

  resize() {
    if (this.dead) return;
    const size = `${this.source.width}x${this.source.height}`;
    // WebGL texture storage must be recreated when the source canvas changes
    // dimensions. Uploading into the previous allocation leaves stale strips.
    if (this.sourceSize && this.sourceSize !== size) {
      const old = this.texture;
      this.texture = new THREE.CanvasTexture(this.source);
      this.texture.colorSpace = THREE.SRGBColorSpace;
      this.texture.minFilter = this.texture.magFilter = old.magFilter;
      this.texture.generateMipmaps = false;
      this.backdrop.material.map = this.texture;
      this.textures.delete(old); old.dispose(); this.textures.add(this.texture);
    }
    this.sourceSize = size;
    this.renderer.setSize(innerWidth, innerHeight);
    this.camera.aspect = innerWidth / Math.max(1, innerHeight);
    this.camera.updateProjectionMatrix();
    this.height = 2 * Math.tan(THREE.MathUtils.degToRad(21)) * 12;
    this.width = this.height * this.camera.aspect;
    this.backdrop.scale.set(this.width * 1.09, this.height * 1.09, 1);
    this.layout();
  }

  layout() {
    for (const item of this.layers) {
      const h = this.height * item.size;
      const depthScale = (12 - item.z) / 12;
      item.mesh.scale.set(h * item.aspect * depthScale, h * depthScale, 1);
      item.mesh.position.set(this.width * item.x * depthScale, this.height * item.y * depthScale, item.z);
    }
  }

  setScene(index) {
    if (this.dead) return;
    this.generation = (this.generation || 0) + 1;
    const generation = this.generation;
    for (const item of this.layers) {
      this.scene.remove(item.mesh);
      item.mesh.geometry.dispose();
      item.mesh.material.dispose();
    }
    // Include textures still loading when the user switches paintings quickly.
    for (const texture of this.textures) if (texture !== this.texture) { texture.dispose(); this.textures.delete(texture); }
    this.layers = [];
    const painted = index === 4;
    this.canvas.classList.toggle('painted', painted);
    this.texture.minFilter = this.texture.magFilter = painted ? THREE.LinearFilter : THREE.NearestFilter;
    this.texture.needsUpdate = true;
    // The illustrated scene already contains its foreground; preserve its detail.
    if (painted) return;
    const tree = index === 1 ? 't_tamarind' : index === 3 ? 't_palm' : 't_bamboo';
    const props = [
      { id: tree, x: -.48, y: -.02, z: 3.4, size: .95, opacity: .72 },
      { id: 'p_stonelantern', x: -.35, y: -.38, z: 2, size: .28, opacity: .9 },
      { id: index === 2 ? 'p_torch' : 'p_shrub', x: .49, y: -.4, z: 4, size: .38, opacity: .65 },
    ];
    const loader = new THREE.TextureLoader();
    for (const prop of props) {
      const texture = loader.load(`/assets/td/env/${prop.id}.png`, tex => {
        if (this.dead || generation !== this.generation) { tex.dispose(); this.textures.delete(tex); return; }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.minFilter = tex.magFilter = THREE.NearestFilter;
        tex.generateMipmaps = false;
        const material = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: .03, depthWrite: false, opacity: prop.opacity, color: 0x9daeb4 });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
        this.layers.push({ ...prop, mesh, texture: tex, aspect: tex.image.width / tex.image.height });
        this.scene.add(mesh);
        this.layout();
      }, undefined, () => { texture.dispose(); this.textures.delete(texture); });
      this.textures.add(texture);
    }
  }

  select(index, count) {
    this.focus = count > 1 ? (index / (count - 1) - .5) * .36 : 0;
  }

  frame(time) {
    if (this.dead || document.hidden) return;
    const calm = this.reduced.matches;
    const x = calm ? 0 : this.pointer.x * .14 + this.focus + Math.sin(time * .13) * .035;
    const y = calm ? 0 : -this.pointer.y * .08;
    this.camera.position.x += (x - this.camera.position.x) * .055;
    this.camera.position.y += (y - this.camera.position.y) * .055;
    this.camera.lookAt(this.camera.position.x * .35, this.camera.position.y * .35, 0);
    this.texture.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
    this.canvas.classList.remove('loading');
  }

  dispose() {
    if (this.dead) return;
    this.dead = true;
    window.removeEventListener('pointermove', this.onPointer);
    document.documentElement.removeEventListener('pointerleave', this.onLeave);
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.scene.traverse(obj => { obj.geometry?.dispose(); obj.material?.dispose(); });
    for (const tex of this.textures) tex.dispose();
    this.textures.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}
