// Original vector HUD emblems: readable at small sizes without a pixel atlas.
const paths = {
  sword: '<path d="m7 25 17-17 2-2-1 6-16 15M5 21l8 8M5 29l4-4"/>',
  bag: '<path d="M9 11h14l3 17H6l3-17Zm3 0V8a4 4 0 0 1 8 0v3"/>',
  potion: '<path d="M13 5h6m-5 1v7l-5 7v6q7 5 14 0v-6l-5-7V6M10 22h12"/>',
  map: '<path d="m4 9 8-4 8 4 8-4v20l-8 4-8-4-8 4V9Zm8-4v20m8-16v20"/>',
  scroll: '<path d="M9 5h15v20q0 5-4 5H8q-4 0-4-5h16M9 5q-5 0-5 5h5V5v20m4-12h7m-7 5h7"/>',
  shop: '<path d="M5 14h22L24 6H8l-3 8Zm2 0v13h18V14m-12 13v-8h6v8M4 14q3 5 6 0 3 5 6 0 3 5 6 0 3 5 6 0"/>',
  hammer: '<path d="m9 5 15 4-3 7-15-4 3-7Zm6 10-5 14m3-15-5 14"/>',
  portal: '<ellipse cx="16" cy="16" rx="9" ry="12"/><path d="M14 8q10 8 0 16m-3-8h10m-3-3 3 3-3 3"/>',
  leaf: '<path d="M6 26Q1 9 26 5q1 22-20 21Zm0 0L22 9m-9 8 7 1m-8 0-1-6"/>',
  star: '<path d="m16 3 3 9 10 4-10 3-3 10-3-10-10-3 10-4 3-9Z"/>',
  bow: '<path d="M10 4q21 12 0 24L10 4Zm-5 12h22m-4-4 4 4-4 4"/>',
  fist: '<path d="M9 15V8q3-3 5 0 3-3 5 0 3-2 5 1v9l-4 10H10L5 17q0-5 4-2Zm5-7v9m5-9v9m5 1H9"/>',
  skull: '<path d="M8 23Q1 9 11 5q12-4 17 7 3 9-6 12v5H11v-6Zm3-9h3v3h-3v-3Zm9 0h3v3h-3v-3Zm-4 8 2-3 2 3m-5 4v3m5-3v3"/>',
  people: '<circle cx="12" cy="10" r="4"/><path d="M4 27v-4q0-8 8-8t8 8v4m1-20q8-1 7 6m-4 4q5 2 4 10"/>',
  pagoda: '<path d="M16 3v4M9 11l7-5 7 5H9Zm-3 7 10-6 10 6H6Zm-3 8 13-7 13 7H3Zm7 0v4m12-4v4"/>',
  bell: '<path d="M7 24h18l-3-6v-5q0-7-6-7t-6 7v5l-3 6Zm7 3q2 5 4 0M16 3v3"/>',
  moon: '<path d="M23 5Q3 1 4 18q2 15 17 10 5-2 7-7Q9 24 23 5Z"/>',
  gear: '<path d="m12 4 8 0 1 5 5 2 2 8-4 3-1 6-9 0-2-5-5-2-2-8 5-3 2-6Z"/><circle cx="16" cy="16" r="4"/>',
};
const cache = new Map();
export function worldUiIcon(key) {
  if (cache.has(key)) return cache.get(key);
  const kind = /sword|anvil|weapon/.test(key) ? key.includes('anvil') ? 'hammer' : 'sword'
    : /potion|flask/.test(key) ? 'potion' : /bag|inventory|gift/.test(key) ? 'bag'
    : /map/.test(key) ? 'map' : /quest|scroll|book|guide/.test(key) ? 'scroll'
    : /shop|exchange|trade/.test(key) ? 'shop' : /portal|warp/.test(key) ? 'portal'
    : /herb|healer|rice/.test(key) ? 'leaf' : /mage|skill|spark/.test(key) ? 'star'
    : /archer|bow/.test(key) ? 'bow' : /boxer/.test(key) ? 'fist'
    : /skull|ghost|crypt/.test(key) ? 'skull' : /party|friend|people/.test(key) ? 'people'
    : /pagoda|home/.test(key) ? 'pagoda' : /bell|lantern/.test(key) ? 'bell'
    : /moon|eclipse/.test(key) ? 'moon' : /gear|setting/.test(key) ? 'gear' : null;
  if (!kind) return null;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g fill="none" stroke="#e1c48b" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[kind]}</g></svg>`;
  const url = `data:image/svg+xml,${encodeURIComponent(svg)}`;cache.set(key,url);return url;
}
