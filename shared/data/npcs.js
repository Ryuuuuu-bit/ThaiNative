// ============================================================
//  ตำแหน่ง NPC และจุดโต้ตอบในโลก (ใช้ร่วม client/server)
//  server ใช้ตรวจว่า "ยืนอยู่ใกล้" ก่อนซื้อขาย/ตีบวก/รับรางวัลเควส (กันยิงคำสั่งจากที่ไกล)
// ============================================================
import { WORLD } from '../constants.js';
import { MAPS, HUNT_MAPS, mapAt } from './maps.js';

/** ชาวบ้าน (หมู่บ้านบางผี) – key = ภาพ */
export const NPCS = [
  { id: 'shop',  key: 'npc_yai_tim',   x: 720,  nameTh: 'ยายติ๋ม', role: 'ร้านยา·ของใช้', color: '#82e0aa', tint: 0xd7bde2, flip: true, icon: '🧪' },
  { id: 'quest', key: 'npc_lung_chai', x: 520,  nameTh: 'ผู้ใหญ่ชัย', role: 'เควส', color: '#f7dc6f', tint: 0xf0b27a, icon: '❗' },
  { id: 'smith', key: 'npc_lung_dam',  x: 846,  nameTh: 'ลุงดำ', role: 'ตีเหล็ก·หลอมอุปกรณ์', color: '#f5b041', tint: 0x7f8c8d, flip: true, icon: '🔨' },
  { id: 'tailor', key: 'npc_mae_choy', x: 380,  nameTh: 'แม่ช้อย', role: 'ชุดแต่งตัว·ย้อมสี', color: '#f5b7b1', tint: 0xf5b7b1, flip: true, icon: '👘' },
  { id: 'cook',  key: 'npc_pa_sa',     x: -300, nameTh: 'ป้าสา', role: 'ครัว·รับซื้อปลา', color: '#85c1e9', tint: 0xf5cba7, flip: true, icon: '🍲' },
  { id: 'kru_sword',  key: 'npc_kru_sword',  x: -200, nameTh: 'ครูเหม',     role: 'สำนักดาบ',      color: '#f1948a', tint: 0xe6b0aa, flip: true, icon: '⚔️' },
  { id: 'kru_mage',   key: 'npc_kru_mage',   x: -125, nameTh: 'หลวงตาเผือก', role: 'หมอธรรม·อาคม', color: '#bb8fce', tint: 0xd2b4de, flip: true, icon: '🔮' },
  { id: 'kru_archer', key: 'npc_kru_archer', x: -50,  nameTh: 'พรานแก้ว',   role: 'ค่ายพรานไพร',  color: '#82e0aa', tint: 0xa9dfbf, flip: true, icon: '🏹' },
  { id: 'kru_boxer',  key: 'npc_kru_boxer',  x: 25,   nameTh: 'ครูแดง',     role: 'ค่ายมวย',      color: '#f5b041', tint: 0xf5cba7, flip: true, icon: '🥊' },
  { id: 'dungeon', key: 'npc_kru_mage', x: 610, nameTh: 'หลวงพ่อทอง', role: 'ประตูสุสานใต้ดิน', color: '#d2b4de', tint: 0xf8e0a0, forceTint: true, flip: true, icon: '🕯️' },
];
export const NPC_BY_ID = Object.fromEntries(NPCS.map((n) => [n.id, n]));

/** ร้าน → NPC ที่ยืนขาย */
export const SHOP_NPC = { mae_kha: 'shop', lung_dam: 'smith', tailor: 'tailor', pa_sa: 'cook', kru_sword: 'kru_sword', kru_mage: 'kru_mage', kru_archer: 'kru_archer', kru_boxer: 'kru_boxer' };

/** จุดโต้ตอบอื่น ๆ ในหมู่บ้าน */
export const SPOTS = {
  shrine: { x: 240, r: 90 },           // ศาลพระภูมิ
  temple: { x: 110, r: 130 },          // วัดบางผี (เซียมซี)
  chai: { x: 520, r: 160 },            // ผู้ใหญ่ชัย (รับรางวัลเควส / เลือกสาย)
};

/** ท่าน้ำตกปลา (ซ้ายสุดของหมู่บ้าน) */
export const FISH_SPOT = { from: WORLD.minX + 20, to: WORLD.minX + 250 };

/** ค่ายพรานบุญ (แมพ 1) */
export const CAMP = { x: MAPS.m1.minX + 150, npcX: MAPS.m1.minX + 175 };

/** สมุนไพรตามภาค: แมพละ 2 จุด */
const REGION_HERBS = {
  r1: ['herb_aloe', 'herb_lemongrass'], r2: ['herb_anchan', 'herb_bamboo'], r3: ['herb_turmeric', 'herb_honey'],
  r4: ['herb_mushroom', 'herb_turmeric'], r5: ['herb_mushroom', 'herb_honey'],
};
export const HERB_NODES = HUNT_MAPS.flatMap((m) => REGION_HERBS[m.region].map((item, k) => ({ x: m.minX + 420 + k * 330 + (m.idx % 3) * 20, item, mapId: m.id })));

/** ระยะแนวนอนถึง NPC (ต้องอยู่หมู่บ้าน) */
export function nearNpc(x, npcId, r = 150) {
  const n = NPC_BY_ID[npcId];
  return !!n && mapAt(x).id === 'village' && Math.abs(x - n.x) <= r;
}
export const nearSpot = (x, key) => mapAt(x).id === 'village' && Math.abs(x - SPOTS[key].x) <= SPOTS[key].r;
