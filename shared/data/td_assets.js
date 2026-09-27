// ============================================================
//  แผน Asset "New Version" (top-down 8 ทิศ แนว RO-lite · ธีมผีไทยการ์ตูนสดใส)
//  ใช้เป็นรายการงานเจนภาพผ่าน PixelLab MCP + เป็นตัวบอก loader ว่าต้องหาไฟล์อะไร
//  ▸ phase: 1 = อยุธยา + ภาค 1 (ปล่อยเล่นได้จริงก่อน) · 2..5 = ภาคถัดไป
//  ▸ ไฟล์ปลายทาง: client/assets/td/<id>/<anim>.png (8 แถว = 8 ทิศ ตาม DIRS ใน Dir8.js)
// ============================================================

/** สไตล์กลางที่ใส่ต่อท้ายทุก prompt ให้ภาพทั้งเกมเข้าชุดกัน */
export const STYLE = 'cute bright cartoon pixel art, Thai folklore theme, low top-down view (RPG like Ragnarok Online), clean dark outline, soft shading, vibrant colors';

/** ขนาดมาตรฐาน */
export const SIZE = { hero: 48, npc: 48, mob: 48, mobBig: 64, boss: 96, prop: 64, tile: 16 };

/** ท่าของตัวละครผู้เล่น (ทุกชุดใช้ชุดท่าเดียวกัน) */
export const HERO_ANIMS = {
  idle:   { frames: 4, rate: 5, loop: true,  prompt: 'breathing idle' },
  walk:   { frames: 6, rate: 10, loop: true, prompt: 'walking' },
  attack: { frames: 6, rate: 14, loop: false, prompt: 'swinging weapon attack' },
  cast:   { frames: 6, rate: 12, loop: false, prompt: 'casting spell with raised hands' },
  hit:    { frames: 3, rate: 12, loop: false, prompt: 'taking damage flinch' },
  die:    { frames: 6, rate: 8,  loop: false, prompt: 'falling down defeated' },
};
export const MOB_ANIMS = {
  idle:   { frames: 4, rate: 5, loop: true,  prompt: 'idle floating/breathing' },
  walk:   { frames: 6, rate: 8, loop: true,  prompt: 'moving' },
  attack: { frames: 6, rate: 12, loop: false, prompt: 'attacking' },
  die:    { frames: 6, rate: 8, loop: false, prompt: 'dissolving into spirit smoke' },
};
export const NPC_ANIMS = { idle: { frames: 4, rate: 4, loop: true, prompt: 'idle breathing' } };

// ------------------------------------------------------------
//  ตัวละครผู้เล่น: 2 เพศ × 10 ชุด (ชุดแยกทุกแบบ) — ผม/อาวุธ แยกชั้น (ผมย้อมสีด้วยโค้ด อาวุธเป็น overlay 8 ทิศ)
// ------------------------------------------------------------
const OUTFIT_PROMPTS = [
  ['mohom',    'indigo Mo Hom farmer shirt and pants'],
  ['ruenton',  'yellow Thai Ruean Ton blouse with pink pha sin skirt'],
  ['jongkraben','white shirt with brown chong kraben pants and gold sash'],
  ['rajpatan', 'white Raj Pattern jacket with gold buttons, black chong kraben'],
  ['chaona',   'brown rice farmer clothes with straw bag'],
  ['silk',     'purple Thai silk outfit with dotted pattern'],
  ['warrior',  'ancient Siamese warrior red tunic with gold sash and armbands'],
  ['hunter',   'green forest hunter outfit with leather straps'],
  ['isan',     'orange Isan khit-pattern cloth outfit'],
  ['mahadlek', 'dark blue royal page uniform with gold trim'],
];
export const HEROES = ['male', 'female'].flatMap((g) => OUTFIT_PROMPTS.map(([o, desc], i) => ({
  id: `hero_${g}_${o}`, kind: 'hero', gender: g, outfit: i, phase: 1, size: SIZE.hero, anims: HERO_ANIMS,
  prompt: `young Thai ${g === 'male' ? 'man' : 'woman'} adventurer wearing ${desc}, short dark hair, bare hands, ${STYLE}`,
})));

/** อาวุธ overlay (ภาพเดียว 8 ทิศ, หมุน/วางที่มือด้วยโค้ด) */
export const WEAPONS = [
  { id: 'wpn_sword',  phase: 1, prompt: 'Thai dab sword, curved blade, gold hilt' },
  { id: 'wpn_staff',  phase: 1, prompt: 'wooden monk staff with glowing yant talisman' },
  { id: 'wpn_bow',    phase: 1, prompt: 'bamboo longbow' },
  { id: 'wpn_fist',   phase: 1, prompt: 'Muay Thai rope-wrapped hand wraps (kard chuek)' },
].map((w) => ({ ...w, kind: 'weapon', size: 32, prompt: `${w.prompt}, single item, ${STYLE}` }));

// ------------------------------------------------------------
//  ผี 20 ชนิด (ใช้ id เดียวกับ shared/data/monsters.js) + บอส
// ------------------------------------------------------------
const MOB_PROMPTS = {
  phi_tuay_kaew:   [1, 'small ghost spirit peeking out of a glass cup, pale blue glow'],
  kuman_thong:     [1, 'mischievous golden child spirit Kuman Thong with topknot'],
  krasue:          [1, 'floating female head Krasue with glowing green dangling organs, cute but creepy'],
  nang_tani:       [1, 'Nang Tani ghost woman in green dress emerging from banana tree leaves'],
  phi_pob:         [2, 'hunched Phi Pob ghost with red glowing eyes, ragged villager clothes'],
  phi_jang_nang:   [2, 'ghost projectionist holding film reels, open-air cinema theme'],
  phi_phrai:       [2, 'water ghost woman with long wet hair, pale blue skin, rising from swamp'],
  pret:            [2, 'very tall skinny Pret ghost with tiny needle mouth'],
  saming:          [3, 'Saming were-tiger shaman, half tiger half man'],
  phi_ha:          [3, 'plague spirit dark smoke cloud with skull face'],
  krahang:         [3, 'Krahang ghost man flying with rice winnowing baskets as wings'],
  khamot:          [3, 'Khamot will-o-wisp floating flame ghost'],
  phi_dip:         [4, 'Thai zombie Phi Dip in burial cloth rising from grave'],
  nang_takhian:    [4, 'Nang Takhian tree spirit woman in wooden armor with vines'],
  tai_hong:        [4, 'vengeful Tai Hong ghost with red aura'],
  phi_phong:       [4, 'Phi Phong forest ghost with glowing nose'],
  kong_koi:        [5, 'one-legged Kong Koi forest ghost hopping'],
  phi_lang_kluang: [5, 'hollow-back ghost woman, beautiful front, visible ribs on back'],
  phi_chamot:      [5, 'crawling reptile spirit Phi Chamot in dark jungle'],
  pret_asura:      [5, 'giant Pret Asura demon with black horns and red eyes, graveyard lord'],
};
export const MOBS = Object.entries(MOB_PROMPTS).map(([id, [phase, p]]) => ({
  id: `mob_${id}`, monster: id, kind: 'mob', phase, size: id === 'pret' || id === 'pret_asura' ? SIZE.mobBig : SIZE.mob, anims: MOB_ANIMS,
  prompt: `${p}, ${STYLE}`,
}));
export const BOSSES = [
  { id: 'boss_raid_yak',  phase: 1, prompt: 'giant Thai temple guardian demon Yak (Thotsakan style) with club, gold and green armor' },
  { id: 'boss_dungeon',   phase: 2, prompt: 'ancient crypt guardian skeleton king with Thai crown' },
].map((b) => ({ ...b, kind: 'boss', size: SIZE.boss, anims: MOB_ANIMS, prompt: `${b.prompt}, ${STYLE}` }));

// ------------------------------------------------------------
//  NPC (4 ทิศพอ เพราะยืนกับที่ – ใช้แถว south/east/north/west ของ 8 ทิศ)
// ------------------------------------------------------------
export const NPCS_TD = [
  ['npc_yai_tim',   'old Thai grandmother herbal medicine seller with basket'],
  ['npc_lung_chai', 'Thai village headman in white shirt with pha khao ma sash'],
  ['npc_lung_dam',  'burly Thai blacksmith with hammer and leather apron'],
  ['npc_mae_choy',  'Thai tailor woman with measuring tape and silk cloth'],
  ['npc_pa_sa',     'Thai auntie cook with ladle and head scarf'],
  ['npc_kru_sword', 'old Thai sword master with white beard and headband'],
  ['npc_kru_mage',  'old Thai monk-like magic teacher in white robes with yant tattoos'],
  ['npc_kru_archer','Thai forest hunter with green bandana and bow'],
  ['npc_kru_boxer', 'Muay Thai trainer in red shorts with mongkol headband'],
  ['npc_luang_por', 'elderly Thai monk abbot in saffron robe'],
].map(([id, p]) => ({ id, kind: 'npc', phase: 1, size: SIZE.npc, anims: NPC_ANIMS, prompt: `${p}, ${STYLE}` }));

// ------------------------------------------------------------
//  ไทล์เซ็ต (PixelLab create_topdown_tileset: lower/upper terrain + transition)
// ------------------------------------------------------------
export const TILESETS = [
  { id: 'ts_ayt_grass_road',  phase: 1, lower: 'lush green grass', upper: 'packed brown dirt road' },
  { id: 'ts_ayt_brick',       phase: 1, lower: 'green grass', upper: 'old red Ayutthaya temple brick courtyard' },
  { id: 'ts_ayt_water',       phase: 1, lower: 'river water Chao Phraya', upper: 'sandy river bank' },
  { id: 'ts_r1_paddy',        phase: 1, lower: 'flooded rice paddy', upper: 'grass dike path' },
  { id: 'ts_r2_swamp',        phase: 2, lower: 'murky lotus swamp water', upper: 'muddy ground' },
  { id: 'ts_r3_jungle',       phase: 3, lower: 'dark jungle floor with leaves', upper: 'mossy stone' },
  { id: 'ts_r4_grave',        phase: 4, lower: 'grey cemetery soil', upper: 'cracked temple stone' },
  { id: 'ts_r5_volcano',      phase: 5, lower: 'dark volcanic rock', upper: 'glowing lava cracks' },
].map((t) => ({ ...t, kind: 'tileset', size: SIZE.tile }));

// ------------------------------------------------------------
//  ของประกอบฉาก (create_map_object, พื้นหลังโปร่งใส)
// ------------------------------------------------------------
export const PROPS = [
  // อยุธยา
  ['prop_chedi_bell',   1, 96, 'white bell-shaped Ayutthaya chedi stupa (Wat Phra Si Sanphet)'],
  ['prop_prang',        1, 112,'red brick Khmer-style prang tower (Wat Chaiwatthanaram)'],
  ['prop_viharn',       1, 128,'Thai temple viharn hall with layered red-gold roof'],
  ['prop_ruin_wall',    1, 64, 'crumbling red brick temple wall ruin'],
  ['prop_buddha_head',  1, 64, 'stone Buddha head entwined in bodhi tree roots'],
  ['prop_city_wall',    1, 64, 'Ayutthaya city wall segment with battlements'],
  ['prop_city_gate',    1, 96, 'Ayutthaya city gate with wooden doors'],
  ['prop_thai_house',   1, 96, 'traditional Thai wooden stilt house'],
  ['prop_market_stall', 1, 64, 'Thai market stall with fruit and umbrella'],
  ['prop_food_stall',   1, 64, 'Thai street food cart with noodles'],
  ['prop_sala',         1, 96, 'Thai open pavilion sala'],
  ['prop_spirit_house', 1, 48, 'Thai spirit house san phra phum with garlands'],
  ['prop_forge',        1, 80, 'Thai blacksmith forge with anvil'],
  ['prop_junk_ship',    1, 96, 'Chinese junk trading ship on river'],
  ['prop_long_boat',    1, 64, 'Thai long-tail boat'],
  ['prop_bridge',       1, 96, 'wooden plank bridge'],
  ['prop_tamarind',     1, 64, 'big tamarind tree'],
  ['prop_palm',         1, 64, 'sugar palm tree'],
  ['prop_bodhi',        1, 80, 'sacred bodhi tree with colorful cloth ribbons'],
  ['prop_lantern',      1, 32, 'Thai standing oil lamp post'],
  ['prop_bounty_board', 1, 48, 'wooden notice board with wanted posters'],
  ['prop_warp_yant',    1, 64, 'glowing golden yant magic circle warp portal on ground'],
  ['prop_campfire',     1, 32, 'campfire with logs'],
  // ภาค 1 ทุ่งนา
  ['prop_scarecrow',    1, 48, 'Thai rice field scarecrow'],
  ['prop_rice_hut',     1, 64, 'rice field bamboo rest hut (thieng na)'],
  ['prop_buffalo',      1, 48, 'water buffalo resting'],
  ['prop_banana',       1, 48, 'banana tree clump'],
  ['prop_haystack',     1, 32, 'rice straw haystack'],
  // ภาค 2–5
  ['prop_abandoned_house', 2, 96, 'abandoned rotting Thai house'],
  ['prop_lotus_pond',   2, 64, 'lotus pond with pink flowers'],
  ['prop_open_cinema',  2, 96, 'Thai open-air cinema screen at night'],
  ['prop_banyan',       3, 96, 'giant banyan tree with hanging roots'],
  ['prop_takhian',      3, 96, 'Takhian tree wrapped with colorful ribbons'],
  ['prop_grave',        4, 32, 'Thai cemetery grave stone'],
  ['prop_ruined_ubosot',4, 128,'ruined ubosot temple hall'],
  ['prop_lava_rock',    5, 48, 'volcanic rock with lava'],
  ['prop_demon_statue', 5, 96, 'giant demon guardian statue'],
].map(([id, phase, size, p]) => ({ id, kind: 'prop', phase, size, prompt: `${p}, ${STYLE}` }));

/** ไอคอน UI/ไอเทม: ใช้ชุดเดิมได้ (มุมมองไม่เกี่ยว) */
export const REUSE = ['client/assets/icons/*', 'client/assets/env/world_map.png'];

export const ALL_ASSETS = [...HEROES, ...WEAPONS, ...MOBS, ...BOSSES, ...NPCS_TD, ...TILESETS, ...PROPS];
export const byPhase = (n) => ALL_ASSETS.filter((a) => a.phase === n);
