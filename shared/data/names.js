// ============================================================
//  ชื่อตัวละคร (แบบ Ragnarok): ห้ามซ้ำทั้งเซิร์ฟเวอร์ · ใครตั้งก่อนได้ก่อน
//  ▸ ไทย / อังกฤษ / ตัวเลข / ขีดล่าง · ยาว 2–16 ตัว · เว้นวรรคได้ 1 ช่อง
//  ▸ เทียบซ้ำด้วย nameKey (ตัวเล็ก · ตัดช่องว่าง/ขีดล่าง · ตัวอักษรหน้าตาคล้ายกัน) → "Ryuu" = "ryuu" = "R y u u" = "Ryuu_"
//  ▸ ลบตัวละคร → ชื่อว่างทันที ใครก็ตั้งได้ · เปลี่ยนชื่อ → ชื่อเดิมกันไว้ให้บัญชีเดิม 7 วัน (NAME_HOLD_MS)
// ============================================================
export const NAME_MIN = 2, NAME_MAX = 16;
export const NAME_HOLD_MS = 7 * 24 * 3600 * 1000;

/** จัดรูปชื่อ: ตัดอักษรล่องหน · เว้นวรรคซ้อนเหลือ 1 · ตัดหัวท้าย */
export function cleanName(raw) {
  return String(raw ?? '').normalize('NFC')
    .replace(/[​-‏⁠﻿­]/g, '')          // zero-width / soft hyphen
    .replace(/\s+/g, ' ').trim();
}

// ตัวอักษรหน้าตาคล้ายกัน (กันปลอมชื่อ) → ตัวแทนเดียวกัน
const CONFUSE = { 0: 'o', 1: 'l', i: 'l' };
/** กุญแจเทียบชื่อซ้ำ */
export function nameKey(name) {
  return cleanName(name).toLowerCase().replace(/[\s_]/g, '').replace(/[01i]/g, (ch) => CONFUSE[ch]);
}

// คำต้องห้าม (เทียบแบบ nameKey · มีอยู่ในชื่อ = ห้าม)
const BANNED = ['gm', 'admin', 'administrator', 'mod', 'moderator', 'system', 'server', 'claude', 'thainative',
  'แอดมิน', 'ผู้ดูแล', 'ทีมงาน', 'ระบบ', 'ประกาศ', 'จีเอ็ม',
  'fuck', 'shit', 'bitch', 'porn', 'sex', 'ควย', 'หี', 'เย็ด', 'สัส', 'เหี้ย', 'แตด', 'จู๋', 'ส้นตีน', 'มึง'];
// ชื่อ NPC ในเกม: ห้ามตั้งชื่อตรงตัว (กันแอบอ้าง)
const NPC_NAMES = ['ยายติ๋ม', 'ผู้ใหญ่ชัย', 'ลุงดำ', 'แม่ช้อย', 'ป้าสา', 'ครูเหม', 'หลวงตาเผือก', 'พรานแก้ว', 'ครูแดง', 'หมอพร', 'ฤๅษีเฝ้าประตูมิติ', 'หลวงพ่อทอง'];
const BANNED_KEYS = BANNED.map(nameKey), NPC_KEYS = new Set(NPC_NAMES.map(nameKey));
// คำสั้นที่ต้องเช็กแบบ "ทั้งคำ" เท่านั้น (กัน false positive เช่น "Gmail" ไม่ใช่ปัญหา แต่ "mod" อยู่ในชื่อคนเยอะ)
const WHOLE_ONLY = new Set(['gm', 'mod', 'หี', 'จู๋'].map(nameKey));

/** ตรวจกติกาชื่อ (ไม่รวมเช็กซ้ำ) → { ok, name, key, msg } */
/** opt.admin = บัญชีแอดมิน (ADMIN_IDS) → ตั้งชื่ออะไรก็ได้ (ข้ามคำต้องห้าม/ชื่อ NPC/ขึ้นต้น GM) · ยังต้องยาว 2–N ตัว ใช้ตัวอักษรที่อนุญาต และไม่ซ้ำคนอื่น */
export function checkName(raw, opt = {}) {
  const name = cleanName(raw), key = nameKey(name);
  const bad = (msg) => ({ ok: false, name, key, msg });
  if ([...name].length < NAME_MIN) return bad(`ชื่อต้องยาวอย่างน้อย ${NAME_MIN} ตัวอักษร`);
  if ([...name].length > NAME_MAX) return bad(`ชื่อยาวได้ไม่เกิน ${NAME_MAX} ตัวอักษร`);
  if (!/^[ก-ฺเ-๎a-zA-Z0-9_ ]+$/.test(name)) return bad('ใช้ได้เฉพาะภาษาไทย อังกฤษ ตัวเลข ขีดล่าง (_) และเว้นวรรค');
  if ((name.match(/ /g) || []).length > 1) return bad('เว้นวรรคได้ไม่เกิน 1 ช่อง');
  if (/^[ัิ-ฺ็-๎]/.test(name)) return bad('ชื่อต้องไม่ขึ้นต้นด้วยสระบน/ล่างหรือวรรณยุกต์');
  if (/^[0-9_ ]+$/.test(name)) return bad('ชื่อต้องมีตัวอักษร ไม่ใช่ตัวเลขล้วน');
  if (/([ัิ-ฺ็-๎])\1/.test(name)) return bad('มีสระ/วรรณยุกต์ซ้อนกันผิดรูป');
  if (opt.admin) return { ok: true, name, key, msg: '' };
  if (NPC_KEYS.has(key)) return bad('ชื่อนี้เป็นชื่อ NPC ในเกม ตั้งซ้ำไม่ได้');
  if (/^admln/.test(key) || /^gm/.test(key)) return bad('ชื่อห้ามขึ้นต้นด้วย GM / Admin');
  for (const b of BANNED_KEYS) if (WHOLE_ONLY.has(b) ? key === b : key.includes(b)) return bad('ชื่อนี้มีคำที่ไม่อนุญาต');
  return { ok: true, name, key, msg: '' };
}

/** ชื่อทางเลือกเมื่อชื่อซ้ำ (ยังไม่เช็กว่าว่างไหม) */
export function nameIdeas(raw, rnd = Math.random) {
  const base = cleanName(raw).replace(/ /g, '').replace(/^_+|_+$/g, '');
  const thai = /[฀-๿]/.test(base);
  const n2 = () => String(10 + Math.floor(rnd() * 89));
  const list = thai
    ? [`${base}อยุธยา`, `${base}กรุงศรี`, `ขุน${base}`, `${base}_${n2()}`, `${base}ผู้กล้า`, `ศิษย์${base}`, `${base}${n2()}`]
    : [`${base}_TH`, `x${base}x`, `${base}Kung`, `${base}_${n2()}`, `Sir${base}`, `${base}Siam`, `${base}${n2()}`];
  const seen = new Set();
  return list.map((s) => s.slice(0, NAME_MAX)).filter((s) => { const k = nameKey(s); if (seen.has(k) || !checkName(s).ok) return false; seen.add(k); return true; });
}

/** ตัวละคร GM = ทุกตัวละครของบัญชีแอดมิน → ป้ายชื่อ/แชท สีแดงเรืองแสงขอบขาว + ป้าย [GM] */
export const isGmName = (name, admin) => !!admin;
