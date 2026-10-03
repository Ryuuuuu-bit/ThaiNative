# Female Thai boxer pixel sprites

## Current walking animation — v11

PixelLab PixMiniMax animated the accepted artwork, retaining the navy/red Thai boxer costume. The active sources are `walk-0-v11.png` through `walk-4-v11.png`. Each PNG packs unchanged 256px service frames into a four-column atlas. No mesh deformation or limb stretching is used.

- South: one complete eight-frame cycle at 8 fps. The generated sixteen-frame result contained two strides; only the first complete stride is used.
- Southeast, east, northeast, north: sixteen frames at 16 fps.
- Southwest, west, northwest: mirrored versions of the corresponding right views.
- Every direction has a one-second cycle. Changing directions preserves normalized gait phase, including fractional time when switching between eight and sixteen frames.
- 120 walk frame entries across eight directions; 72 independently authored poses, with mirrors for the left views.

Per-frame alpha bounds include a three-pixel margin. All use a common scale (200 source pixels per 64 lab pixels / 48 game pixels); the lowest visible foot defines the ground anchor. Phaser and Three.js use the same cuts and foot values. Walking is discrete playback without crossfading duplicate limbs.

A detached fragment above the northeast bun was removed with PixelLab's exact pixel editor in all sixteen frames. The source frames and the precise edit decisions are retained under `output/player-art/pixellab-motion-v11/`.

## Preview and validation

Open `/player-lab.html?model=boxer-pixel`. The frame strip below the scene displays all poses for the selected direction; clicking one pauses on that frame.

Validation covers source/canvas bounds, all directional frame counts, common cycle duration, unique frame coordinates, Phaser registration, and gait phase continuity. Browser review checked the beginning, midpoint and end in all eight directions. This does not constitute a live multiplayer gameplay test. No deployment was performed.

Idle, attack and death remain the existing four-frame animations. Equipment is baked into the artwork; equipment tiers currently share this costume.

## Rebuilding

`tools/pack_boxer_animation.ps1` packs the reviewed individual PNG files. `tools/install_boxer_pixellab_motion.py` writes settings and manifest from those atlases. Job IDs, input frames, prompts, measurements, cleanup records and the pre-install metadata backup are in `output/player-art/pixellab-motion-v11/`.

The earlier `analyze_boxer_frames.py`, `update_boxer_gait.py` and `update_boxer_side_gait.py` describe the superseded four-frame sheets and must not be used to rebuild v11 metadata. The rejected `walk-rig-v8.png` remains an unreferenced draft and is not installed.
