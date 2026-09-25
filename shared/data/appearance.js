// ============================================================
//  ระบบปรับแต่งรูปลักษณ์ – เพศ 2 แบบ, ชุด 10, ทรงผม 10, ใบหน้า 10
//  (ตอนนี้วาดเป็น Pixel Art ด้วยโค้ด – เปลี่ยนเป็นภาพจาก PixelLab ภายหลังได้
//   โดยใส่ไฟล์ใน client/assets/ และแก้ SpriteFactory)
// ============================================================
import { JOB_IDS } from './classes.js';

export const GENDERS = [
  { id: 'male', nameTh: 'ชาย' },
  { id: 'female', nameTh: 'หญิง' },
];

// pattern: plain | stripe | sash | dots | trim
export const OUTFITS = [
  { nameTh: 'เสื้อม่อฮ่อม',       top: '#2c3e7a', bottom: '#1f2a52', trim: '#e8e8e8', pattern: 'plain' },
  { nameTh: 'ชุดไทยเรือนต้น',     top: '#f4d35e', bottom: '#b5446e', trim: '#fff5d6', pattern: 'trim' },
  { nameTh: 'โจงกระเบนคาดผ้า',    top: '#f2efe6', bottom: '#8a3b12', trim: '#d4a017', pattern: 'sash' },
  { nameTh: 'ชุดราชปะแตน',       top: '#f7f7f2', bottom: '#2d2d2d', trim: '#d4af37', pattern: 'trim' },
  { nameTh: 'ชุดชาวนา',          top: '#7b5a3c', bottom: '#4b3a2a', trim: '#c8a26b', pattern: 'plain' },
  { nameTh: 'ชุดผ้าไหมม่วง',      top: '#6c3483', bottom: '#4a235a', trim: '#f5cba7', pattern: 'dots' },
  { nameTh: 'ชุดนักรบโบราณ',      top: '#a93226', bottom: '#641e16', trim: '#f1c40f', pattern: 'sash' },
  { nameTh: 'ชุดพรานไพร',        top: '#3d6b35', bottom: '#2e4a2a', trim: '#a3c585', pattern: 'stripe' },
  { nameTh: 'ชุดลายขิดอีสาน',     top: '#d68910', bottom: '#784212', trim: '#1b2631', pattern: 'stripe' },
  { nameTh: 'ชุดมหาดเล็ก',       top: '#1b4f72', bottom: '#154360', trim: '#f4d03f', pattern: 'trim' },
];

// shape ใช้ใน SpriteFactory
export const HAIRSTYLES = [
  { nameTh: 'สั้นเกรียน',     shape: 'buzz',     color: '#1a1a1a' },
  { nameTh: 'รองทรง',        shape: 'short',    color: '#2b1d14' },
  { nameTh: 'ผมยาวตรง',      shape: 'long',     color: '#111111' },
  { nameTh: 'ผมมวยไทย',      shape: 'bun',      color: '#1a1a1a' },
  { nameTh: 'ผมจุก',         shape: 'topknot',  color: '#141414' },
  { nameTh: 'ผมเปีย',        shape: 'braid',    color: '#3b2314' },
  { nameTh: 'ทรงดอกกระทุ่ม',  shape: 'spiky',    color: '#241a12' },
  { nameTh: 'หางม้า',        shape: 'ponytail', color: '#4a2c17' },
  { nameTh: 'ผมหยิกฟู',       shape: 'curly',    color: '#1e1410' },
  { nameTh: 'ผมทัดดอกไม้',    shape: 'flower',   color: '#101010' },
];

// eyes: dot | line | big | sharp | sleepy | wink | round | narrow | star | closed
export const FACES = [
  { nameTh: 'ยิ้มแย้ม',     eyes: 'dot',    mouth: 'smile', brow: false, blush: false, mark: null },
  { nameTh: 'นิ่งสงบ',     eyes: 'line',   mouth: 'flat',  brow: false, blush: false, mark: null },
  { nameTh: 'ตาโต',       eyes: 'big',    mouth: 'smile', brow: false, blush: true,  mark: null },
  { nameTh: 'ดุดัน',       eyes: 'sharp',  mouth: 'flat',  brow: true,  blush: false, mark: null },
  { nameTh: 'ง่วงนอน',     eyes: 'sleepy', mouth: 'o',     brow: false, blush: false, mark: null },
  { nameTh: 'ขยิบตา',      eyes: 'wink',   mouth: 'smile', brow: false, blush: true,  mark: null },
  { nameTh: 'ใสซื่อ',      eyes: 'round',  mouth: 'o',     brow: false, blush: true,  mark: null },
  { nameTh: 'เจ้าเล่ห์',     eyes: 'narrow', mouth: 'smirk', brow: true,  blush: false, mark: null },
  { nameTh: 'สักยันต์',     eyes: 'dot',    mouth: 'flat',  brow: true,  blush: false, mark: 'yant' },
  { nameTh: 'ประแป้งดินสอพอง', eyes: 'round', mouth: 'smile', brow: false, blush: false, mark: 'powder' },
];

export const DEFAULT_APPEARANCE = { gender: 'male', outfit: 0, hair: 1, face: 0, job: 'swordman' };

const idx = (v, n) => (Number.isInteger(v) && v >= 0 && v < n ? v : 0);

/** ตรวจค่าที่ส่งมาจาก client ให้อยู่ในช่วงที่ถูกต้อง (ใช้ทั้ง client/server) */
export function sanitizeAppearance(a = {}) {
  return {
    gender: a.gender === 'female' ? 'female' : 'male',
    outfit: idx(a.outfit, OUTFITS.length),
    hair: idx(a.hair, HAIRSTYLES.length),
    face: idx(a.face, FACES.length),
    job: JOB_IDS.includes(a.job) ? a.job : 'swordman',
  };
}

export function appearanceKey(a) {
  return `chr_${a.gender[0]}${a.outfit}_${a.hair}_${a.face}_${a.job}`;
}
