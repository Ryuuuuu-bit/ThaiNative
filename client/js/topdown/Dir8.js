// ============================================================
//  สไปรต์ 8 ทิศ (New Version / top-down)
//  ▸ รูปแบบไฟล์ที่ใช้: spritesheet แถวละ 1 ทิศ (8 แถว เรียงตาม DIRS) · คอลัมน์ = เฟรมของท่า
//    assets/td/<id>/<anim>.png   เช่น assets/td/hero_male_mohom/walk.png
//  ▸ texture key: `td:<id>:<anim>` · animation key: `td:<id>:<anim>:<dir>`
//  ▸ ยังไม่มีภาพ 8 ทิศ → ใช้สไปรต์ด้านข้างชุดเดิม (พลิกซ้าย/ขวา) แทนได้ทันที
// ============================================================

/** ลำดับทิศตามชื่อของ PixelLab (south = หันหน้าเข้าจอ) */
export const DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];

/** มุมจากเวกเตอร์ความเร็ว → ชื่อทิศ (แกน y ของจอชี้ลง) */
export function dirFromVector(vx, vy, prev = 'south') {
  if (Math.abs(vx) < 0.01 && Math.abs(vy) < 0.01) return prev;
  const a = Math.atan2(vy, vx);                     // 0 = east, +π/2 = south
  const i = Math.round(a / (Math.PI / 4));           // -4..4
  return ['west', 'north-west', 'north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west'][i + 4];
}

export const texKey = (id, anim) => `td:${id}:${anim}`;
export const animKey = (id, anim, dir) => `td:${id}:${anim}:${dir}`;

/**
 * ลงทะเบียน animation จาก spritesheet 8 แถว
 * @param spec { id, anims: { walk: { frames: 6, rate: 10, loop: true }, ... }, frame: { w, h } }
 */
export function registerDir8(scene, spec) {
  let ok = false;
  for (const [anim, a] of Object.entries(spec.anims)) {
    const tk = texKey(spec.id, anim);
    if (!scene.textures.exists(tk)) continue;
    const tex = scene.textures.get(tk), src = tex.getSourceImage();
    const fw = spec.frame?.w || Math.floor(src.width / a.frames), fh = spec.frame?.h || Math.floor(src.height / DIRS.length);
    DIRS.forEach((dir, row) => {
      const frames = [];
      for (let k = 0; k < a.frames; k++) {
        const name = `${dir}_${k}`;
        if (!tex.has(name)) tex.add(name, 0, k * fw, row * fh, fw, fh);
        frames.push({ key: tk, frame: name });
      }
      const ak = animKey(spec.id, anim, dir);
      if (!scene.anims.exists(ak)) scene.anims.create({ key: ak, frames, frameRate: a.rate || 8, repeat: a.loop ? -1 : 0 });
    });
    ok = true;
  }
  return ok;
}

/** มีภาพ 8 ทิศของ id นี้ครบท่าที่ต้องการไหม */
export const hasDir8 = (scene, id, anim = 'idle') => scene.anims.exists(animKey(id, anim, 'south'));

/**
 * เล่นท่าให้ sprite ที่รองรับทั้ง 2 แบบ
 *  - มีภาพ 8 ทิศ → ใช้ `td:<id>:<anim>:<dir>`
 *  - ไม่มี → ใช้ `${legacyKey}:${anim}` + พลิกซ้าย/ขวาตามทิศ
 */
export function playDir(sprite, anim, dir, restart = false) {
  const scene = sprite.scene;
  sprite.dir = dir;
  if (sprite.d8id && hasDir8(scene, sprite.d8id, anim)) {
    const k = animKey(sprite.d8id, anim, dir);
    sprite.setFlipX(false);
    if (sprite.anims.currentAnim?.key !== k || restart) sprite.play(k, !restart);
    return true;
  }
  if (!sprite.legacyKey) return false;
  const k = `${sprite.legacyKey}:${anim}`;
  if (!scene.anims.exists(k)) return false;
  if (dir.includes('east')) sprite.setFlipX(false); else if (dir.includes('west')) sprite.setFlipX(true);
  if (sprite.anims.currentAnim?.key !== k || restart) sprite.play(k, !restart);
  return true;
}
