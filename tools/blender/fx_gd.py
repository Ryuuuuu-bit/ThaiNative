"""
เอฟเฟกต์ท่าเด่นบอสดันสี่ผีป่าช้า (วงตกกระทบ · ขนาดตาม GD_SKILLS r)
  blender -b --factory-startup -P tools/blender/fx_gd.py -- <ชื่อ> <out_sheet.png>
  ชื่อ: hung_execute | krasue_wisp | yat_drip | pob_pounce
 - hung_execute  ดาบเพชฌฆาต  r 60px  ดาบผีปักลง → พื้นแตก → คลื่นวิญญาณ
 - krasue_wisp   ไฟผีล่อ     r 40px  ลูกไฟเขียวตกเฉียง → เปลวไฟผีปะทุ
 - yat_drip      ติ๊ด…หยด    r 34px  หยดน้ำดำตก → กระเซ็นมงกุฎ → แอ่งดำ + ระลอกม่วง
 - pob_pounce    กระโจน      r 52px  กรงเล็บ 3 รอยข่วน → ฝุ่น + ก้อนดินกระเด็น
"""
import bpy, math, sys, os
import numpy as np
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from fxlib import *  # noqa

argv = sys.argv[sys.argv.index('--') + 1:]
NAME, OUT = argv[0], argv[1]
rng = np.random.default_rng(11)
U = 1 / 16  # px → หน่วย


def ring(r_end, f0, f1, mat, minor=0.05, z=0.05):
    bpy.ops.mesh.primitive_torus_add(major_radius=1.0, minor_radius=minor, location=(0, 0, z))
    o = put(bpy.context.object, mat)
    key_scale(o, [(1, 0.0), (f0 - 1, 0.0), (f0, (0.25, 0.25, 1)), (f1, (r_end, r_end, 1)), (f1 + 1, 0.0)])
    return o


def disc(r, mat, keys, z=0.01):
    bpy.ops.mesh.primitive_circle_add(radius=r, vertices=48, fill_type='NGON', location=(0, 0, z))
    o = put(bpy.context.object, mat); key_scale(o, keys); return o


def motes(n, rmax, f0, nf, mat, zr=(1.2, 2.6), size=(0.05, 0.1)):
    for _ in range(n):
        a = rng.uniform(0, math.tau); d = rng.uniform(0.2, rmax)
        bpy.ops.mesh.primitive_ico_sphere_add(radius=rng.uniform(*size), subdivisions=1)
        m = put(bpy.context.object, mat)
        p0 = (math.cos(a) * d, math.sin(a) * d, 0.1)
        fs = f0 + int(rng.integers(0, 3))
        key_loc(m, [(fs, p0), (nf, (p0[0] * 1.2, p0[1] * 1.2, rng.uniform(*zr)))])
        key_scale(m, [(1, 0.0), (fs - 1, 0.0), (fs, 1.0), (nf - 1, 0.5), (nf, 0.0)])


# =====================================================================
def hung_execute():
    NF, CELL, TZ = 14, 160, 1.6
    R = 60 * U  # 3.75
    sc = reset(NF)
    BLADE = rim_mat('blade', (0.55, 0.66, 0.85), (0.95, 0.98, 1.0), 1.0, 0.45, 0.1, 0.7)
    HILT = rim_mat('hilt', (0.10, 0.10, 0.16), (0.55, 0.62, 0.80), 1.0, 0.3)
    SPIRIT = glow_mat('spirit', (0.80, 0.90, 1.0))
    CRACK = glow_mat('crack', (0.04, 0.05, 0.10))
    FOG = glow_mat('fog', (0.16, 0.22, 0.38), 1.0, 0.45)

    # ดาบ: ใบดาบเรียวแหลม (ปลายลง) + กระบัง + ด้าม
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.42, radius2=0.30, depth=4.2, location=(0, 0, 2.1))
    blade = put(bpy.context.object, BLADE); blade.scale = (1, 0.18, 1)
    blade.rotation_euler = (math.pi, 0, 0)  # ปลายแหลมชี้ลง
    bpy.ops.object.transform_apply(rotation=True, scale=True)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 4.3))
    guard = put(bpy.context.object, HILT); guard.scale = (1.5, 0.22, 0.2)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.1, depth=1.0, location=(0, 0, 4.9))
    grip = put(bpy.context.object, HILT)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.16, location=(0, 0, 5.45))
    pom = put(bpy.context.object, BLADE, True)
    root = bpy.data.objects.new('sword', None); sc.collection.objects.link(root)
    for o in (blade, guard, grip, pom): o.parent = root
    # ตกลงจากฟ้า → ปักจมพื้น 1.2 หน่วย → จมหายช้า ๆ
    key_loc(root, [(1, (0, 0, 7.5)), (3, (0, 0, 3.0)), (4, (0, 0, -1.2)), (NF, (0, 0, -1.4))])
    key_scale(root, [(1, 1.0), (10, 1.0), (NF - 1, 0.5), (NF, 0.0)])

    # หมอกวิญญาณบนพื้น + รอยแตกแผ่จากจุดปัก
    disc(R, FOG, [(1, 0.0), (3, 0.0), (4, 0.4), (6, 1.0), (11, 1.0), (NF, 0.0)])
    for i in range(9):
        a = i / 9 * math.tau + rng.uniform(-0.25, 0.25)
        L = rng.uniform(0.6, 1.0) * R
        bpy.ops.mesh.primitive_cube_add(size=1)
        c = put(bpy.context.object, CRACK)
        for v in c.data.vertices: v.co.x += 0.5  # จุดหมุนที่ปลายด้านใน
        c.location = (0, 0, 0.03); c.rotation_euler = (0, 0, a)
        key_scale(c, [(1, 0.0), (3, 0.0), (4, (0.2, 0.09, 0.04)), (6, (L, 0.12, 0.04)), (11, (L, 0.10, 0.04)), (NF, 0.0)])
    ring(R * 1.05, 4, 7, SPIRIT, 0.06)
    ring(R * 0.7, 5, 9, SPIRIT, 0.035)
    motes(18, R, 5, NF, SPIRIT, (1.5, 3.4))
    camera(sc, CELL, TZ)
    render_sheet(sc, OUT, CELL, NF, K=14)


# =====================================================================
def krasue_wisp():
    NF, CELL, TZ = 12, 128, 1.4
    R = 40 * U  # 2.5
    sc = reset(NF)
    BALL = rim_mat('ball', (0.92, 1.0, 0.90), (0.15, 0.85, 0.45), 1.0, 0.45)
    FLAME = rim_mat('flame', (0.85, 1.0, 0.82), (0.10, 0.70, 0.38), 1.0, 0.3)
    GREEN = glow_mat('green', (0.43, 1.0, 0.69))
    SCORCH = glow_mat('scorch', (0.03, 0.12, 0.08), 1.0, 0.55)

    # ลูกไฟผี + หางเปลว (ตกเฉียงจากซ้ายบน)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.45, segments=24, ring_count=12)
    ball = put(bpy.context.object, BALL, True)
    bpy.ops.mesh.primitive_cone_add(radius1=0.42, radius2=0.0, depth=1.6, vertices=12, location=(0, 0, 0.8))
    tail = put(bpy.context.object, FLAME, True); tail.parent = ball
    tail.rotation_euler = (0, math.radians(-35), 0); tail.location = (-0.45, 0, 0.65)
    key_loc(ball, [(1, (-2.6, 0.4, 5.5)), (2, (-1.7, 0.27, 3.6)), (3, (-0.8, 0.13, 1.7)), (4, (0, 0, 0.3))])
    key_scale(ball, [(1, 0.9), (4, 1.0), (5, 0.0)])

    disc(R, SCORCH, [(1, 0.0), (4, 0.0), (5, 0.6), (6, 1.0), (10, 0.9), (NF, 0.0)])
    # เปลวไฟผีปะทุ (กรวยโยกไหว)
    for i in range(12):
        a = rng.uniform(0, math.tau); d = rng.uniform(0, 0.75) * R
        h = rng.uniform(1.0, 2.2) * (1.3 if d < R * 0.35 else 1.0)
        bpy.ops.mesh.primitive_cone_add(radius1=rng.uniform(0.22, 0.38), radius2=0.0, depth=h, vertices=10)
        c = put(bpy.context.object, FLAME, True)
        for v in c.data.vertices: v.co.z += h / 2
        c.location = (math.cos(a) * d, math.sin(a) * d, 0)
        sw = rng.uniform(0.15, 0.35); ph = rng.uniform(0, math.tau)
        key_rot(c, [(f, (math.sin(f * 1.3 + ph) * sw, math.cos(f * 1.1 + ph) * sw, 0)) for f in range(4, NF + 1)])
        lag = int(rng.integers(0, 2))
        key_scale(c, [(1, 0.0), (4 + lag, 0.0), (5 + lag, (1, 1, 0.5)), (6 + lag, (1, 1, 1.15)),
                      (8 + lag, (0.9, 0.9, 0.8)), (min(NF, 10 + lag), (0.6, 0.6, 0.45)), (NF, 0.0)])
    ring(R * 1.05, 5, 8, GREEN, 0.05)
    motes(14, R, 5, NF, GREEN, (1.2, 2.8))
    camera(sc, CELL, TZ)
    render_sheet(sc, OUT, CELL, NF, K=12)


# =====================================================================
def yat_drip():
    NF, CELL, TZ = 12, 128, 1.5
    R = 34 * U  # 2.125
    sc = reset(NF)
    INK = rim_mat('ink', (0.02, 0.0, 0.05), (0.62, 0.43, 1.0), 1.0, 0.25)
    PUDDLE = glow_mat('puddle', (0.04, 0.0, 0.08), 1.0, 0.85)
    VIO = glow_mat('vio', (0.60, 0.43, 1.0))

    # หยดน้ำดำ (ยืดยาวตอนตก)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.4, segments=24, ring_count=12)
    drop = put(bpy.context.object, INK, True)
    key_loc(drop, [(1, (0, 0, 6.5)), (2, (0, 0, 4.6)), (3, (0, 0, 2.3)), (4, (0, 0, 0.35))])
    key_scale(drop, [(1, (0.8, 0.8, 1.6)), (3, (0.7, 0.7, 2.0)), (4, (1.2, 1.2, 0.6)), (5, 0.0)])

    disc(R * 0.85, PUDDLE, [(1, 0.0), (4, 0.0), (5, 0.5), (7, 1.0), (10, 1.0), (NF, 0.0)])
    # มงกุฎกระเซ็น: กรวยบางเอียงออก
    for i in range(10):
        a = i / 10 * math.tau
        bpy.ops.mesh.primitive_cone_add(radius1=0.13, radius2=0.0, depth=1.0, vertices=6)
        c = put(bpy.context.object, INK, True)
        for v in c.data.vertices: v.co.z += 0.5
        c.location = (math.cos(a) * 0.55, math.sin(a) * 0.55, 0)
        t = math.radians(35)
        c.rotation_euler = (-math.sin(a) * t, math.cos(a) * t, 0)
        key_scale(c, [(1, 0.0), (4, 0.0), (5, (1, 1, 1.2)), (6, (1, 1, 1.5)), (7, (0.8, 0.8, 0.9)), (8, 0.0)])
    # ละอองกระเด็นวิถีโค้ง
    for i in range(14):
        a = rng.uniform(0, math.tau); sp = rng.uniform(1.2, 2.6)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=rng.uniform(0.08, 0.15), segments=12, ring_count=6)
        d = put(bpy.context.object, INK, True)
        key_ballistic(d, 5, NF, (math.cos(a) * 0.4, math.sin(a) * 0.4, 0.3),
                      (math.cos(a) * sp, math.sin(a) * sp, rng.uniform(4.5, 7.5)), g=-16)
        key_scale(d, [(1, 0.0), (4, 0.0), (5, 1.0), (NF - 1, 0.8), (NF, 0.0)])
    # ระลอกม่วง 2 วง
    ring(R * 1.05, 5, 9, VIO, 0.045)
    ring(R * 0.75, 7, 11, VIO, 0.035)
    camera(sc, CELL, TZ)
    render_sheet(sc, OUT, CELL, NF, K=12)


# =====================================================================
def pob_pounce():
    NF, CELL, TZ = 12, 128, 1.2
    R = 52 * U  # 3.25
    sc = reset(NF)
    CLAW = glow_mat('claw', (1.0, 0.55, 0.42))
    CLAWHOT = glow_mat('clawhot', (1.0, 0.92, 0.80))
    DIRT = rim_mat('dirt', (0.22, 0.12, 0.08), (0.62, 0.40, 0.28), 1.0, 0.4)
    DUST = rim_mat('dust', (0.42, 0.32, 0.26), (0.24, 0.16, 0.13), 1.0, 0.4)
    CRATER = glow_mat('crater', (0.10, 0.04, 0.03), 1.0, 0.7)
    RED = glow_mat('red', (1.0, 0.40, 0.28))

    # รอยกรงเล็บ 3 เส้น ฟาดเฉียงจากขวาบน → ซ้ายล่าง (ขีดยาวออกทีละเส้น)
    for i in range(3):
        off = (i - 1) * 0.55
        for mat, w, z in ((CLAW, 0.20, 0.04), (CLAWHOT, 0.08, 0.06)):
            bpy.ops.mesh.primitive_cube_add(size=1)
            c = put(bpy.context.object, mat)
            for v in c.data.vertices: v.co.x += 0.5  # โตจากปลายขวาบนไปซ้ายล่าง
            c.rotation_euler = (0, 0, math.radians(-150))
            c.location = (0.87 * 1.6 - 0.5 * off, 0.5 * 1.6 + 0.87 * off, z)
            L = 3.4 - abs(off) * 0.6
            f = 1 + i // 2
            key_scale(c, [(1, 0.0), (f, (0.3, w, 0.03)), (f + 1, (L, w, 0.03)), (8, (L, w * 0.8, 0.03)), (10, (L, 0.0, 0.0))])
    disc(R * 0.7, CRATER, [(1, 0.0), (2, 0.0), (3, 0.6), (5, 1.0), (10, 1.0), (NF, 0.0)])
    # ฝุ่นฟุ้ง
    for i in range(10):
        a = rng.uniform(0, math.tau); d = rng.uniform(0.4, 0.9) * R
        bpy.ops.mesh.primitive_ico_sphere_add(radius=1.0, subdivisions=2)
        p = put(bpy.context.object, DUST, True)
        p0 = (math.cos(a) * d * 0.5, math.sin(a) * d * 0.5, 0.3)
        key_loc(p, [(3, p0), (NF, (math.cos(a) * d, math.sin(a) * d, 0.8))])
        s = rng.uniform(0.22, 0.4)
        key_scale(p, [(1, 0.0), (2, 0.0), (3, s * 0.4), (6, s), (10, s * 0.6), (NF, 0.0)])
    # ก้อนดินกระเด็น
    for i in range(12):
        a = rng.uniform(0, math.tau); sp = rng.uniform(1.5, 3.2)
        bpy.ops.mesh.primitive_ico_sphere_add(radius=rng.uniform(0.12, 0.22), subdivisions=1)
        k = put(bpy.context.object, DIRT)
        key_ballistic(k, 3, NF, (math.cos(a) * 0.5, math.sin(a) * 0.5, 0.2),
                      (math.cos(a) * sp, math.sin(a) * sp, rng.uniform(4, 7)), g=-18)
        key_rot(k, [(3, (0, 0, 0)), (NF, (rng.uniform(3, 8), rng.uniform(3, 8), 0))])
        key_scale(k, [(1, 0.0), (2, 0.0), (3, 1.0), (NF - 1, 1.0), (NF, 0.0)])
    ring(R * 1.0, 3, 6, RED, 0.06)
    camera(sc, CELL, TZ)
    render_sheet(sc, OUT, CELL, NF, K=14)


{'hung_execute': hung_execute, 'krasue_wisp': krasue_wisp, 'yat_drip': yat_drip, 'pob_pounce': pob_pounce}[NAME]()
