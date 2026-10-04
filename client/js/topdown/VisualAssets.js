// Shared visual taxonomy. Collision and game rules continue to use the authored map.
export function propKind(p) {
  const k = p.key || '';
  if (k === 'none') return null;
  if (p.tree || /tree|palm|bamboo/.test(k)) return 'tree';
  const rules = [
    ['fountain', /fountain/], ['stupa', /chedi|prang|mondop/],
    ['gate', /gate|walltower|p_arch/], ['stall', /mstall|p_stall|foodcart|flowercart/],
    ['boat', /boat|rowboat|junk/], ['pier', /pier|landing/],
    ['wall', /brickwall|buddhawall|ruin/], ['fence', /fence|fishrack|laundry|coop/],
    ['lantern', /lantern|torch|candle|campfire/], ['banner', /banner|tent/],
    ['bench', /bench|table/], ['board', /board|sign/], ['well', /well|trough|lotuspond/],
    ['pot', /jar|pots|pottery|mortar|oven/], ['plant', /shrub|plants|frangipani|lotus/],
    ['statue', /buddha|lion|offering/], ['training', /archery|scarecrow|muaythai|haystack/],
    ['instrument', /bell|gong|drum/], ['cart', /cart/],
    ['goods', /basket|fruit|tray|silk|chest|firewood/], ['house', /b_|spirit|sala/],
  ];
  return rules.find(([, re]) => re.test(k))?.[0] || null;
}

export function actorKind(object) {
  if (object.npcVisual || object.d8id?.startsWith('npc_')) return 'npc';
  if (!object.def || !object.spawn) return null;
  const k = `${object.spawn.id} ${object.def.nameEn || ''} ${object.def.d8 || ''}`.toLowerCase();
  if (/crystal/.test(k)) return 'crystal';
  if (/krasue/.test(k)) return 'krasue';
  if (/scarecrow|tuay/.test(k)) return 'scarecrow';
  if (/naga|nak_|serpent|snake/.test(k)) return 'serpent';
  if (/saming|tiger|chamot|crocodile|wolf|dog|boar/.test(k)) return 'beast';
  if (/garuda|krut|bird/.test(k)) return 'winged';
  if (/pret|asura|yak|rahu|mara|rakkhasa/.test(k)) return 'guardian';
  if (/kuman|child/.test(k)) return 'child';
  return 'spirit';
}

export const MATERIAL_ATLAS = '/assets/world/ayutthaya-materials-v1.png';
