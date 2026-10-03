"""
ไลบรารีร่วมสำหรับสคริปต์เอฟเฟกต์ (fx_*.py) — วัสดุเรืองแสง · คีย์เฟรม · กล้องเกม · เรนเดอร์ → ชีตพิกเซล
 - 1 หน่วย Blender = 1 ไทล์ (16px) · กล้อง ortho มุมเงย 45° (วงพื้นในเกมแบน 0.7)
"""
import bpy, math, os
import numpy as np
from mathutils import Vector

SS = 4  # supersample


def reset(nf):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.frame_start, sc.frame_end = 1, nf
    bpy.context.preferences.edit.keyframe_new_interpolation_type = 'LINEAR'
    return sc


def rim_mat(name, core, rim, strength=1.0, power=0.35, lo=0.25, hi=0.85):
    """emission แกน → ขอบ ตามมุมมอง (fresnel)"""
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    lw = nt.nodes.new('ShaderNodeLayerWeight'); lw.inputs['Blend'].default_value = power
    cr = nt.nodes.new('ShaderNodeValToRGB')
    cr.color_ramp.elements[0].color = (*core, 1); cr.color_ramp.elements[1].color = (*rim, 1)
    cr.color_ramp.elements[0].position = lo; cr.color_ramp.elements[1].position = hi
    nt.links.new(lw.outputs['Facing'], cr.inputs['Fac'])
    nt.links.new(cr.outputs['Color'], em.inputs['Color'])
    em.inputs['Strength'].default_value = strength
    nt.links.new(em.outputs[0], out.inputs[0])
    return m


def glow_mat(name, rgb, strength=1.0, alpha=1.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission'); em.inputs['Color'].default_value = (*rgb, 1)
    em.inputs['Strength'].default_value = strength
    if alpha < 1:
        tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader')
        mx.inputs['Fac'].default_value = alpha
        nt.links.new(tr.outputs[0], mx.inputs[1]); nt.links.new(em.outputs[0], mx.inputs[2])
        nt.links.new(mx.outputs[0], out.inputs[0])
    else:
        nt.links.new(em.outputs[0], out.inputs[0])
    return m


def put(o, m, smooth=False):
    o.data.materials.append(m)
    if smooth:
        for p in o.data.polygons: p.use_smooth = True
    return o


def key_scale(o, frames):
    """frames = [(f, s), ...] s = สเกลเดียวทุกแกน หรือ tuple"""
    for f, s in sorted(frames, key=lambda x: x[0]):
        o.scale = s if isinstance(s, tuple) else (s, s, s)
        o.keyframe_insert('scale', frame=f)


def key_loc(o, frames):
    for f, p in sorted(frames, key=lambda x: x[0]):
        o.location = p; o.keyframe_insert('location', frame=f)


def key_rot(o, frames):
    for f, r in sorted(frames, key=lambda x: x[0]):
        o.rotation_euler = r; o.keyframe_insert('rotation_euler', frame=f)


def key_ballistic(o, f0, f1, p0, v, g=-9.0, fps=12):
    """โยนวิถีโค้งทีละเฟรม (หน่วย/วินาที) · หยุดที่พื้น"""
    for f in range(f0, f1 + 1):
        t = (f - f0) / fps
        z = p0[2] + v[2] * t + 0.5 * g * t * t
        o.location = (p0[0] + v[0] * t, p0[1] + v[1] * t, max(0.02, z))
        o.keyframe_insert('location', frame=f)


def camera(sc, cell, tz):
    """กล้องเกม: ortho 45° · tz = ความสูงจุดเล็ง (ดันพื้นลงล่างเฟรม tz·0.707·16 px)"""
    tgt = bpy.data.objects.new('tgt', None); sc.collection.objects.link(tgt); tgt.location = (0, 0, tz)
    cd = bpy.data.cameras.new('cam'); cd.type = 'ORTHO'; cd.ortho_scale = cell / 16
    cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
    el = math.radians(45); dist = 40
    cam.location = Vector((0, -math.cos(el) * dist, math.sin(el) * dist)) + tgt.location
    tc = cam.constraints.new('TRACK_TO'); tc.target = tgt; tc.track_axis = 'TRACK_NEGATIVE_Z'; tc.up_axis = 'UP_Y'
    return cam


FACE_CAM = (math.radians(45), 0, 0)  # หมุนวัตถุแบน (ระนาบ XY) ให้หันหากล้อง


def render_sheet(sc, out, cell, nf, K=14, seed=1):
    """เรนเดอร์ทุกเฟรม → ย่อ SS เท่า → พาเลตร่วม K สี + alpha 3 ระดับ → ชีตแนวนอน"""
    sc.render.engine = 'CYCLES'
    try:
        pr = bpy.context.preferences.addons['cycles'].preferences
        pr.compute_device_type = 'CUDA'; pr.get_devices()
        for d in pr.devices: d.use = True
        sc.cycles.device = 'GPU'
    except Exception as e:
        print('GPU off:', e)
    sc.cycles.samples = 32; sc.cycles.use_denoising = False
    sc.render.film_transparent = True
    sc.view_settings.view_transform = 'Standard'
    R = cell * SS
    sc.render.resolution_x = sc.render.resolution_y = R
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
    tmp = out.replace('.png', '_frames'); os.makedirs(tmp, exist_ok=True)

    frames = []
    for f in range(1, nf + 1):
        sc.frame_set(f)
        fp = os.path.join(tmp, f'f{f:02d}.png'); sc.render.filepath = fp
        bpy.ops.render.render(write_still=True)
        im = bpy.data.images.load(fp)
        px = np.array(im.pixels[:], np.float32).reshape(R, R, 4)[::-1]
        blk = px.reshape(cell, SS, cell, SS, 4)
        a = blk[..., 3].mean(axis=(1, 3))
        rgb = (blk[..., :3] * blk[..., 3:4]).sum(axis=(1, 3)) / np.maximum(blk[..., 3].sum(axis=(1, 3)), 1e-6)[..., None]
        frames.append((rgb, a))
        bpy.data.images.remove(im)

    rng = np.random.default_rng(seed)
    pts = np.concatenate([rgb[a > 0.2] for rgb, a in frames])
    C = pts[rng.choice(len(pts), min(K, len(pts)), replace=False)]
    for _ in range(20):
        lab = ((pts[:, None] - C[None]) ** 2).sum(-1).argmin(1)
        for k in range(len(C)):
            if (lab == k).any(): C[k] = pts[lab == k].mean(0)

    sheet = np.zeros((cell, cell * nf, 4), np.float32)
    for i, (rgb, a) in enumerate(frames):
        q = np.zeros((cell, cell, 4), np.float32)
        m = a > 0.2
        if m.any():
            q[m, :3] = C[((rgb[m][:, None] - C[None]) ** 2).sum(-1).argmin(1)]
        q[..., 3] = np.where(a > 0.75, 1.0, np.where(a > 0.2, 0.6, 0.0))
        sheet[:, i * cell:(i + 1) * cell] = q
    img = bpy.data.images.new('sheet', cell * nf, cell, alpha=True)
    img.pixels[:] = sheet[::-1].ravel()
    img.filepath_raw = out; img.file_format = 'PNG'; img.save()
    print(f'SHEET {out} {nf}x{cell}')
