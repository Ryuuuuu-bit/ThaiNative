import { ITEMS, baseItemId, WTYPE_JOB } from '/shared/data/items.js';
// ตัวช่วยเล็กๆ ที่ใช้หลายที่

/** สร้างข้อความในโลกเกมให้คมชัดแม้กล้องซูม x2 (render ละเอียด + filter แบบ linear) */
export function makeText(scene, x, y, text, style = {}) {
  // อ่านง่าย: ตัวอักษรในโลกเกมเล็กสุด 8px (= 16px บนจอเพราะกล้องซูม x2) + ขอบดำหนาขึ้น
  const n = parseFloat(style.fontSize || '8');
  const size = n <= 8 ? Math.max(8, n + 1.5) : n;
  style = { ...style, fontSize: `${size}px` };
  const t = scene.add.text(x, y, text, {
    fontFamily: 'Mitr, Tahoma, sans-serif',
    fontSize: '8px',
    color: '#ffffff',
    stroke: '#000000',
    strokeThickness: 3,
    fontStyle: '500',
    shadow: { offsetX: 0, offsetY: 1, color: '#000', blur: 2, fill: true, stroke: true },
    resolution: 4,
    // วัดความสูงด้วยสระ/วรรณยุกต์ไทยซ้อนบน-ล่าง ไม่งั้นหัวสระถูกตัด (น้ำ→นา, มือ→มอ)
    testString: '|MÉqgyปิ่น้ำฏฐุ',
    ...style,
  });
  t.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  return t;
}

export const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

// ---------------- ไอคอนภาพ (PixelLab) แทนอีโมจิ ----------------
// BootScene ใส่รายการไอคอนจาก manifest ไว้ที่ ICONS  (it_<itemId>, sk_<skillId>)
export const ICONS = {};
const ITEM_ALIAS = { reskill_weapon: 'skin_scroll',
  elixir_ghost: 'herb_mushroom', food_nomai: 'herb_bamboo' };

/** ป้ายอาชีพมุมไอคอนอุปกรณ์ (QOL: ดูปุ๊บรู้ว่าของสายไหน) */
const JOB_BADGE = { swordman: ['⚔', 'ขุนศึก'], mage: ['✦', 'จอมขมังเวทย์'], archer: ['➶', 'พรานป่า'], boxer: ['✊', 'นักมวย'], healer: ['✚', 'หมอยา'] };
const GEAR_T = new Set(['weapon', 'armor', 'accessory', 'helm', 'gloves', 'boots', 'belt']);
export function itemJob(id) { const it = ITEMS[id]; if (!it || !GEAR_T.has(it.type)) return null; return it.job || WTYPE_JOB[it.wtype] || null; }
export function jobBadge(id) { const j = itemJob(id), b = j && JOB_BADGE[j]; return b ? `<i class="job-badge jb-${j}" title="ของสาย${b[1]}">${b[0]}</i>` : ''; }

/** HTML ไอคอนไอเทม: มีภาพ → <img>, ไม่มี → อีโมจิเดิม · อุปกรณ์ประจำอาชีพมีป้ายอาชีพมุมขวาบน (badge:false = ไม่ใส่) */
export function itemIcon(id, emoji = '', { badge = true } = {}) {
  if (typeof id === 'string' && id.startsWith('card_')) return `<img class="px-ico card-ico" src="assets/cards/${id.slice(5)}.png" alt="">`;   // การ์ดผี
  const b = baseItemId(id);                                           // ของมีค่าสุ่ม (base@...) ใช้ไอคอนของชิ้นฐาน
  const f = ICONS[`it_${ITEM_ALIAS[b] || b}`] || (ITEMS[id]?.art && ICONS[`it_${ITEMS[id].art}`]);
  const ico = f ? `<img class="px-ico" src="${f}" alt="">` : emoji;
  const jb = badge ? jobBadge(id) : '', red = ITEMS[b]?.red;                  // อุปกรณ์ขอบแดง (ชุดสุริยคราส)
  return jb || red ? `<span class="ico-wrap${red ? ' red' : ''}">${ico}${jb}</span>` : ico;
}
export function skillIcon(id, emoji = '') {
  const f = ICONS[`sk_${id}`];
  return f ? `<img class="px-ico" src="${f}" alt="">` : emoji;
}
export function uiIcon(key, emoji = '') {
  const f = ICONS[`ui_${key}`];
  return f ? `<img class="px-ico" src="${f}" alt="">` : emoji;
}

// ---------------- อีโมจิบน HUD → ไอคอนพิกเซล (PixelLab ui_*) ----------------
// ใส่ภาพให้อีโมจิที่มีไอคอนแล้ว · ไม่มีไฟล์ = คงอีโมจิเดิม (ไม่พัง) · ไม่แตะแชท/ช่องพิมพ์/ตัวเลือกอีโมจิ
export const EMO_ICON = {
  '🏯': 'pagoda', '☀': 'sun', '🌙': 'moon', '⚡': 'bolt', '🔔': 'bell', '💭': 'think', '😀': 'smile', '📍': 'pin',
  '🔒': 'lock', '👑': 'crown', '🌀': 'portal', '🏆': 'trophy', '🏅': 'medal', '👥': 'menu_party', '🚪': 'door', '🧪': 'potion',
  '💬': 'chat', '🔊': 'sound', '📋': 'quest', '⚔': 'swords', '🌿': 'herb', '🃏': 'menu_card', '🍲': 'soup', '🏮': 'lantern',
  '🎣': 'fish', '⚒': 'anvil', '📰': 'menu_news', '🗺': 'menu_map', '⚙': 'menu_settings', '❓': 'menu_help', '🎒': 'menu_bag',
  '⛑': 'slot_helm', '💍': 'slot_ring', '🥋': 'slot_armor', '📿': 'slot_amulet', '🧤': 'slot_gloves', '👢': 'slot_boots', '🎗': 'slot_belt',
  '📜': 'scroll', '⚠': 'warn', '🎁': 'gift', '📢': 'megaphone', '❗': 'exclaim', '🌳': 'tree', '🙏': 'wai', '🤝': 'handshake', '🏠': 'house', '👹': 'yak',
  '💀': 'skull', '🔗': 'link', '💱': 'exchange', '👁': 'eye', '👻': 'ghost', '🎉': 'party_pop',
  '🔧': 'wrench', '🧺': 'basket', '🪦': 'tomb', '⛺': 'tent', '💨': 'wind', '🌟': 'star', '⭐': 'star', '🔓': 'unlock', '➕': 'plus', '🖱': 'mouse',
  '🔑': 'key', '🎲': 'dice', '💎': 'gem', '🎖': 'medal2', '🛠': 'tools', '🔍': 'search', '🔎': 'search', '🗑': 'trash',
  '🥇': 'gold1', '🥈': 'silver2', '🥉': 'bronze3', '📥': 'inbox', '📤': 'outbox', '👤': 'person', '🧑': 'person', '♂': 'male', '♀': 'female',
  '📊': 'chart', '📖': 'book', '❔': 'qmark', '🧙': 'hermit', '🌅': 'sunrise', '🌇': 'sunset', '🌕': 'fullmoon', '🌑': 'newmoon',
  '🌾': 'rice', '🪷': 'lotus', '🎯': 'target', '🛡': 'shield', '🔥': 'fire', '💧': 'water', '💥': 'boom', '🎋': 'bamboo', '📝': 'memo', '🪨': 'rock',
  '🕯': 'candle', '🪶': 'feather', '🏘': 'village', '❤': 'heart', '📘': 'book_blue', '🐉': 'naga',
  '☠': 'crossbones', '👘': 'thai_dress', '🗡': 'dagger', '🌼': 'flower', '🐗': 'boar', '🧧': 'envelope', '🧵': 'thread', '🌈': 'rainbow', '💪': 'arm',
  '⌨': 'keyboard', '🎨': 'palette', '💇': 'scissors', '🚶': 'walk', '📱': 'phone', '👆': 'tap', '☁': 'cloud', '🏔': 'mountain', '🦁': 'lion',
  '🥤': 'cup', '🥚': 'egg', '🐷': 'pig', '🍶': 'jar', '🌧': 'rain', '🌱': 'sprout', '🐯': 'tiger', '🥁': 'drum', '🪄': 'wand',
  '🧴': 'it:hp_s', '🥥': 'it:mp_s', '🪙': 'gold', '💰': 'gold', '🐟': 'fish', '🍳': 'soup', '🔨': 'anvil', '✅': 'check', '☑': 'check',
  '💖': 'donate', '⛶': 'fullscreen', '⇄': 'swap', '🧭': 'compass', '🌏': 'globe', '☰': 'menu', 'ℹ': 'info', '↩': 'return', '🔇': 'mute', '🚩': 'flag',
  '🐘': 'elephant', '🐍': 'naga_snake', '🐒': 'monkey', '🐊': 'croc', '🦅': 'garuda', '☄': 'comet',
  '🌑': 'eclipse', '💠': 'moon_crystal', '🔮': 'job_mage', '🏹': 'job_archer', '🥊': 'job_boxer', '💚': 'heal', '✨': 'sparkle', '🛒': 'shop', '📐': 'range', '✔': 'check',
};
const EMO_RE = new RegExp(`(${Object.keys(EMO_ICON).join('|')})\\uFE0F?`, 'gu');
const EMO_SKIP = 'input,textarea,select,option,script,style,#chat-log,.cb-log,.cb-emos,.job-badge,[data-noemo]';
export function emoIcon(ch) { const k = EMO_ICON[ch.replace(/\uFE0F/g, '')] || ''; const f = k.startsWith('it:') ? ICONS[`it_${k.slice(3)}`] : ICONS[`ui_${k}`]; return f ? `<img class="px-ico emo-ico" src="${f}" alt="${ch}">` : ch; }
function iconizeNode(tn) {
  const t = tn.nodeValue; EMO_RE.lastIndex = 0;
  if (!t || !EMO_RE.test(t)) return;
  const p = tn.parentElement; if (!p || p.closest(EMO_SKIP)) return;
  EMO_RE.lastIndex = 0;
  let any = false;
  const html = t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])).replace(EMO_RE, (m, ch) => { const r = emoIcon(ch); if (r !== ch) any = true; return r; });
  if (!any) return;
  const span = document.createElement('span'); span.className = 'emo-wrap'; span.innerHTML = html;
  tn.replaceWith(span);
}
export function iconizeEmoji(root = document.body) {
  if (!root) return;
  if (root.nodeType === 3) return iconizeNode(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const list = []; let n;
  while ((n = w.nextNode())) list.push(n);
  list.forEach(iconizeNode);
}
/** เฝ้า DOM ทั้งหน้า: ของใหม่ที่มีอีโมจิ → เปลี่ยนเป็นไอคอน (รวบเป็นเฟรมละครั้ง) */
export function watchEmoji() {
  if (watchEmoji.on || !Object.keys(ICONS).length) return; watchEmoji.on = true;
  let q = new Set(), raf = 0;
  const flush = () => { raf = 0; const s = q; q = new Set(); s.forEach((n) => n.isConnected && iconizeEmoji(n)); };
  new MutationObserver((ms) => {
    for (const m of ms) {
      if (m.type === 'characterData') q.add(m.target);
      else m.addedNodes.forEach((n) => { if (n.nodeType === 1 && n.classList?.contains('emo-wrap')) return; if (n.nodeType === 1 || n.nodeType === 3) q.add(n); });
    }
    if (q.size && !raf) raf = requestAnimationFrame(flush);
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
  iconizeEmoji(document.body);
}
