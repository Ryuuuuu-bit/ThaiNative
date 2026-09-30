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

/** ทิศแบบหน่วง: เปลี่ยนทิศเมื่อมุมพ้นเขตทิศเดิมเกิน ~12° (กันสลับทิศไปมาตอนเดินเฉียง/ตามทาง) */
const DIR_DEG = { east: 0, 'south-east': 45, south: 90, 'south-west': 135, west: 180, 'north-west': -135, north: -90, 'north-east': -45 };
export function stableDir(vx, vy, prev = 'south') {
  if (Math.abs(vx) < 0.01 && Math.abs(vy) < 0.01) return prev;
  const a = Math.atan2(vy, vx) * 180 / Math.PI;
  if (prev in DIR_DEG) { let d = Math.abs(a - DIR_DEG[prev]); if (d > 180) d = 360 - d; if (d <= 34.5) return prev; }
  return dirFromVector(vx, vy, prev);
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
/** ท่าที่ยังไม่มีภาพ 8 ทิศ → ยืมท่าที่มี (ไม่สลับกลับไปใช้สไปรต์เก่ากลางคัน) */
const BORROW = { attack: 'walk', cast: 'idle', hit: 'idle', run: 'walk' };

/** ปรับขนาด/กล่องชนเมื่อสลับระหว่างภาพ 8 ทิศ ↔ สไปรต์เดิม */
function setLook(sprite, d8) {
  const look = d8 ? sprite.d8id : false;                                     // เปลี่ยนโมเดล (เช่น สลับอาชีพ/ขั้นอาวุธ) ขนาดเฟรมต่างกัน → คิดสเกล/กล่องชนใหม่ด้วย
  if (sprite._d8 === d8 && sprite._look === look) return;
  sprite._d8 = d8; sprite._look = look;
  if (sprite.baseScale == null) sprite.baseScale = sprite.scaleX || 1;
  const meta = d8 ? sprite.scene.d8meta?.[sprite.d8id] : null;
  const sc = d8 ? (meta?.scale || 2 / 3) * (sprite.scaleMul || 1) : sprite.baseScale;
  sprite.setScale(sc);
  if (sprite.body && sprite.bodyFoot) {
    const [w, h] = sprite.bodyFoot, fw = sprite.frame.realWidth, fh = sprite.frame.realHeight;
    const pad = d8 ? Math.round((meta?.frame || 72) * 0.08) : 0;            // เท้าอยู่เหนือขอบล่างเฟรมเล็กน้อย
    sprite.body.setSize(w / sc, h / sc).setOffset((fw - w / sc) / 2, fh - h / sc - pad);
  }
}

/** ท่าโจมตีที่ยังไม่มีภาพในบางชุด → ใช้ท่าใกล้เคียงแทน (หมอยา heal → cast) */
const ACT_FALLBACK = { heal: 'cast' };
export function resolveAct(scene, id, act) { return act && !hasDir8(scene, id, act) && ACT_FALLBACK[act] ? ACT_FALLBACK[act] : act; }
export function playDir(sprite, anim, dir, restart = false) {
  const scene = sprite.scene;
  sprite.dir = dir;
  if (sprite.d8id && hasDir8(scene, sprite.d8id, 'idle')) {
    // ท่าโจมตีที่ไม่มีภาพจริง (หรืออาวุธไม่ใช่หมัด) → ยืนนิ่งท่าเตรียม + อาวุธในมือเหวี่ยงแทน (ไม่เอาท่าเดินมาแทนแล้ว ดูสะดุด)
    // ท่าโจมตีจริงตามอาวุธ (ฟัน/ยิง/ร่าย) ถ้ามีภาพ
    if ((anim === 'attack' || anim === 'cast') && sprite.actionAnim) {
      const act = resolveAct(scene, sprite.d8id, sprite.actionAnim());
      if (act && hasDir8(scene, sprite.d8id, act)) {
        const k = animKey(sprite.d8id, act, dir);
        sprite._action = true;
        if (sprite.anims.currentAnim?.key !== k || restart || !sprite.anims.isPlaying) { sprite.setFlipX(false); sprite.play(k); }
        setLook(sprite, true);
        return true;
      }
    }
    sprite._action = false;
    const hold = anim === 'attack' || anim === 'cast'
      ? (!hasDir8(scene, sprite.d8id, 'attack') || (typeof sprite.holdAttack === 'function' ? sprite.holdAttack() : sprite.holdAttack))
      : false;
    if (hold) {
      const now = scene.time.now;
      if (!restart && sprite._holdUntil > now) { sprite.setFrame(`${dir}_0`); return true; }
      const tk = texKey(sprite.d8id, 'idle');
      sprite.anims.stop();
      sprite.setTexture(tk, `${dir}_0`).setFlipX(false);
      setLook(sprite, true);
      sprite._holdUntil = now + 300;
      const k = `${animKey(sprite.d8id, 'idle', dir)}:attack`;
      scene.time.delayedCall(300, () => { if (sprite.active) { sprite._holdUntil = 0; sprite.emit('animationcomplete', { key: k }); } });
      return true;
    }
    sprite._holdUntil = 0;
    const use = hasDir8(scene, sprite.d8id, anim) ? anim : BORROW[anim];
    if (!use || !hasDir8(scene, sprite.d8id, use)) return false;              // เช่น die → ให้ผู้เรียกทำเอฟเฟกต์แทน
    const k = animKey(sprite.d8id, use, dir);
    sprite.setFlipX(false);
    const cur = sprite.anims.currentAnim;
    if (cur?.key !== k || restart) {
      // เปลี่ยนทิศระหว่างเดิน/ยืน → เล่นต่อจากเฟรมเดิม ไม่กระตุกกลับเฟรมแรก
      const sameLoop = !restart && cur && sprite.anims.isPlaying && cur.key.startsWith(`td:${sprite.d8id}:${use}:`);
      if (sameLoop) {
        const idx = sprite.anims.currentFrame?.index ?? 0, prog = sprite.anims.accumulator || 0;
        sprite.play({ key: k, startFrame: Math.max(0, idx - 1) });
        sprite.anims.accumulator = prog;
      } else sprite.play(k, !restart);
    }
    setLook(sprite, true);
    return true;
  }
  if (!sprite.legacyKey) return false;
  setLook(sprite, false);
  const k = `${sprite.legacyKey}:${anim}`;
  if (!scene.anims.exists(k)) return false;
  if (dir.includes('east')) sprite.setFlipX(false); else if (dir.includes('west')) sprite.setFlipX(true);
  if (sprite.anims.currentAnim?.key !== k || restart) sprite.play(k, !restart);
  return true;
}
