// ============================================================
//  Character – ข้อมูลตัวละคร (ฝั่ง client)
//  ▸ ฟังก์ชันหลักอยู่ที่ /shared/charmodel.js (ใช้ร่วมกับ server)
//  ▸ ไฟล์นี้เพิ่มการเซฟ/โหลดในเครื่อง (โหมดออฟไลน์)
// ============================================================
import { account } from '../net/Account.js';
import { migrate } from '/shared/charmodel.js';

export {
  SAVE_VERSION, newCharacter, syncAppearance, styleOf, pathName, gainExp, allocateStat, totalSp,
  learnSkill, assignHotbar, resetSkills, resetStats, choosePath, emptyHotbar,
} from '/shared/charmodel.js';
export { equipmentBonus, getDerived } from '/shared/character.js';

const SAVE_KEY = 'thainative_save_v1';

// ---------------- Save / Load ----------------
// เล่นกับ server (บัญชี) → server เซฟเอง (client ไม่ต้องทำอะไร) · ออฟไลน์ → เก็บในเครื่อง
export function saveCharacter(c) {
  if (account.loggedIn) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(c)); } catch { /* ignore */ }
}
/** ตัวละครจาก server → ตรวจ/อัปเกรดข้อมูลให้ตรงเวอร์ชันปัจจุบัน */
export function reviveCharacter(c) {
  if (!c) return null;
  try { return migrate(c); } catch (e) { console.error(e); return null; }
}
export function loadCharacter() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return migrate(JSON.parse(raw));
  } catch { return null; }
}
