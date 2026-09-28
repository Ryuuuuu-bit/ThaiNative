// ============================================================
//  ปุ่ม Discord: ดึงจำนวนคนออนไลน์ใน Discord (server: /api/discord · แคช 60 วิ) มาโชว์บนปุ่มหน้าแรก + ปุ่มในเกม
//  ▸ ถ้าเซิร์ฟ Discord ยังไม่เปิด Server Widget → โชว์ปุ่มเฉยๆ ไม่มีตัวเลข
// ============================================================
let timer = 0;
async function refresh() {
  let d = null;
  try { d = await (await fetch('/api/discord')).json(); } catch { /* ออฟไลน์ */ }
  const n = Number.isFinite(d?.online) ? d.online : null;
  const t = document.querySelector('#title-discord span');
  if (t) t.textContent = n != null ? `Discord ชุมชนผู้เล่น · 🟢 ${n.toLocaleString()} ออนไลน์` : 'Discord ชุมชนผู้เล่น';
  const h = document.querySelector('#btn-discord .nb-lb');
  if (h) h.textContent = n != null ? `Discord · ${n.toLocaleString()}` : 'Discord';
  const b = document.getElementById('btn-discord');
  if (b) b.title = `Discord ชุมชนผู้เล่น${n != null ? ` · ออนไลน์ตอนนี้ ${n} คน` : ''} · หาปาร์ตี้ แจ้งบั๊ก ข่าวสาร`;
}
/** เริ่มอัปเดตเป็นระยะ (เรียกซ้ำได้) */
export function startDiscordLink() {
  refresh();
  clearInterval(timer); timer = setInterval(refresh, 120000);
}
