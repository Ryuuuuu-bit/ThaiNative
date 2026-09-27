#!/usr/bin/env python3
"""
คัดเสียง CC0 (Kenney / OpenGameArt) → client/assets/sfx/<name>_<i>.mp3 + sfx.json
 - ตัดเงียบหัวท้าย · ปรับระดับเสียง (peak -2 dB) · โมโน 44.1k · mp3 96k
 - mode: replace = ใช้แทนเสียงสังเคราะห์ · layer = เล่นซ้อนกับเสียงสังเคราะห์
ใช้: python3 tools/build_sfx.py <โฟลเดอร์ที่แตกไฟล์ไว้>
"""
import json, os, re, subprocess, sys, glob

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', 'client', 'assets', 'sfx')
# name: (mode, vol, [(pack, regex, max)], maxlen_s)
MAP = {
  'step_grass':  ('replace', 0.45, [('kenney_impact-sounds', r'footstep_grass', 5)], 0.5),
  'step_wood':   ('replace', 0.45, [('kenney_impact-sounds', r'footstep_wood', 5)], 0.5),
  'step_stone':  ('replace', 0.45, [('kenney_impact-sounds', r'footstep_concrete', 5)], 0.5),
  'step_sand':   ('replace', 0.40, [('kenney_impact-sounds', r'footstep_snow', 5)], 0.5),
  'hit':         ('replace', 0.8,  [('kenney_impact-sounds', r'impactPunch_medium', 5)], 0.6),
  'crit':        ('layer',   0.9,  [('kenney_impact-sounds', r'impactPunch_heavy', 5)], 0.8),
  'punch':       ('replace', 0.8,  [('kenney_impact-sounds', r'impactPunch_medium', 5)], 0.6),
  'kick':        ('replace', 0.9,  [('kenney_impact-sounds', r'impactPunch_heavy', 5)], 0.8),
  'hurt':        ('layer',   0.7,  [('kenney_impact-sounds', r'impactSoft_heavy', 5)], 0.6),
  'swing':       ('replace', 0.7,  [('rpg_sound_pack', r'^swing', 3)], 0.6),
  'swingLight':  ('replace', 0.55, [('rpg_sound_pack', r'^swing', 3)], 0.5),
  'slash':       ('replace', 0.8,  [('80-CC0-RPG-SFX_0', r'blade', 3), ('kenney_rpg-audio', r'knifeSlice', 2)], 0.8),
  'fireball':    ('layer',   0.7,  [('80-CC0-RPG-SFX_0', r'spell_fire', 7)], 1.2),
  'skBoom':      ('layer',   0.9,  [('100-CC0-SFX_0', r'explosion', 1), ('80-CC0-RPG-SFX_0', r'spell_fire', 3)], 1.8),
  'meteor':      ('layer',   0.9,  [('100-CC0-SFX_0', r'explosion', 1)], 1.8),
  'thunder':     ('layer',   1.0,  [('sfx_100_v2', r'thunder', 1)], 3.0),
  'skThunder':   ('layer',   1.0,  [('sfx_100_v2', r'thunder', 1)], 3.0),
  'skSlam':      ('layer',   0.9,  [('kenney_impact-sounds', r'impactPlate_heavy', 3), ('kenney_impact-sounds', r'impactWood_heavy', 2)], 0.9),
  'ghostDie':    ('replace', 0.75, [('rpg_sound_pack', r'^shade', 8)], 1.4),
  'ghost':       ('replace', 0.5,  [('ghost', r'GhostMoan', 5)], 2.5),
  'enemySwing':  ('replace', 0.5,  [('rpg_sound_pack', r'^swing', 3)], 0.5),
  'bossRoar':    ('replace', 1.0,  [('80-CC0-RPG-SFX_0', r'creature_roar', 3)], 2.0),
  'coin':        ('replace', 0.7,  [('80-CC0-RPG-SFX_0', r'item_coins', 4)], 0.8),
  'buy':         ('replace', 0.7,  [('kenney_rpg-audio', r'handleCoins', 2)], 1.0),
  'potion':      ('replace', 0.7,  [('rpg_sound_pack', r'^bubble', 3)], 0.8),
  'click':       ('replace', 0.6,  [('kenney_interface-sounds', r'^click', 5)], 0.3),
  'open':        ('replace', 0.6,  [('kenney_interface-sounds', r'^open', 4)], 0.5),
  'close':       ('replace', 0.6,  [('kenney_interface-sounds', r'^close', 4)], 0.5),
  'error':       ('replace', 0.6,  [('kenney_interface-sounds', r'^error', 4)], 0.5),
  'target':      ('replace', 0.5,  [('kenney_interface-sounds', r'^select', 4)], 0.4),
  'templeBell':  ('replace', 0.8,  [('100-CC0-SFX_0', r'^gong', 2)], 4.0),
  'land':        ('replace', 0.5,  [('kenney_impact-sounds', r'impactSoft_medium', 3)], 0.4),
}

def files(pack, rx, n):
    fs = sorted(f for f in glob.glob(os.path.join(SRC, pack, '**', '*'), recursive=True)
                if re.search(rx, os.path.basename(f), re.I) and not os.path.basename(f).startswith('._')
                and f.lower().endswith(('.ogg', '.wav', '.mp3', '.flac')))
    # ชุด ghost มีทั้ง wav/mp3 ชื่อซ้ำ → เลือก wav
    seen, out = set(), []
    for f in sorted(fs, key=lambda x: (os.path.splitext(os.path.basename(x))[0], not x.lower().endswith('.wav'))):
        k = os.path.splitext(os.path.basename(f))[0]
        if k in seen: continue
        seen.add(k); out.append(f)
    return out[:n]

os.makedirs(OUT, exist_ok=True)
man = {}
for name, (mode, vol, srcs, maxlen) in MAP.items():
    i = 0
    for pack, rx, n in srcs:
        for f in files(pack, rx, n):
            dst = os.path.join(OUT, f'{name}_{i}.mp3')
            af = (f'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,'
                  f'atrim=0:{maxlen},afade=t=out:st={max(0.05, maxlen - 0.08)}:d=0.08')
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f, '-af', af, '-ac', '1', '-ar', '44100', '/tmp/_s.wav'], check=True)
            # ปรับ peak → -2 dB
            vd = subprocess.run(['ffmpeg', '-i', '/tmp/_s.wav', '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True).stderr
            m = re.search(r'max_volume: (-?[\d.]+) dB', vd); gain = -2 - float(m.group(1)) if m else 0
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', '/tmp/_s.wav', '-af', f'volume={gain}dB', '-b:a', '96k', dst], check=True)
            i += 1
    if i:
        man[name] = {'n': i, 'mode': mode, 'vol': vol}
    print(f'{name:12s} {mode:7s} x{i}')
json.dump(man, open(os.path.join(OUT, 'sfx.json'), 'w'), indent=1)
open(os.path.join(OUT, 'LICENSE.txt'), 'w').write(
    'All sounds in this folder are CC0 (public domain):\n'
    '- Kenney (kenney.nl): RPG Audio, Impact Sounds, Interface Sounds\n'
    '- OpenGameArt: 80 CC0 RPG SFX & 100 CC0 SFX & 100 CC0 SFX #2 (rubberduck), RPG Sound Pack (artisticdude), Ghost Monster Voice Moaning & Growling (qubodup)\n'
    'Trimmed, normalized and converted to mono MP3 for ThaiNative.\n')
