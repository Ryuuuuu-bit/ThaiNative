# Equipped male warrior: ImageGen animation prototype

Source identity: `output/player-art/mohom-equipped-concept-v1.png`.
Generator: built-in OpenAI image_gen, not PixelLab.

Preview: `/player-lab.html?model=imagegen`.
Eight expected rows: south, south-east, east, north-east, north,
north-west, west, south-west. Columns: idle 4, walk 6, attack 6, die 7.

This folder is a visual experiment, not a production replacement. The
first walk sheet had only seven occupied rows. First attack/death sheets
also drifted from the requested directional order. Original drafts are
preserved with `-draft-v1` suffixes; a corrective generation pass was
requested for all three actions. That pass still omitted the north-west
action row. The preview maps the observed west/south-west rows explicitly
and shows idle for missing north-west actions, with a visible warning.
Review corrected direction rows and
frame alignment visually; generation alone does not certify correctness.

Art includes the clothing, armor and sword in one image. Equipment icon
overlays are disabled in the preview. This is not a modular equipment set.
Textures are sampled at their native atlas dimensions and displayed at
the existing player lab's character footprint without rewriting PNGs.

## Frame correction v2

`tools/analyze_warrior_frames.py` reads alpha silhouettes and writes
`frame-layout.json`. It detects the seven actual walk bands, excludes the
blank strip and tiny disconnected neighboring-frame fragments, records
the original horizontal pivot and a ground anchor, and never rewrites PNGs.
The renderer samples explicit rectangles and uses a consistent pixel scale
per clip rather than stretching all actions to the idle atlas aspect ratio.
Preview imports and generated asset URLs carry a revision so cached old
coordinates cannot hide the correction.

South attacks and deaths now use `attack-south-v2.png` (3 × 2 layout) and
`die-south-v2.png` (4 × 2, seven used cells), with extra room for the sword.
Other attack/death directions show correct idle art and a missing-action
message. `walk-south-v2.png` was rejected because its legs do not convincingly
alternate; seven-direction walk still uses the old image with corrected
frame coordinates. Per-frame stepping is available in the preview.

Official visual references:
- Tree of Savior: https://treeofsavior.com/page/class/view.php?c=Swordsman
- Ragnarok Online: https://ragnarokonline.gungho.jp/gameguide/character/swordman/swordman.html

These are pose/silhouette references; their original art is not bundled.
`generation-v2.json` preserves generation prompts and scope limitations.

Remaining production work: improve walking weight transfer, author missing
directions of each action, review equipment grip and motion at gameplay
scale, then prepare all other classes and genders.
No live game sprite mapping has been replaced by this prototype.
