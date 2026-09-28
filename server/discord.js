// ============================================================
//  Discord: จำนวนคนออนไลน์ (Server Widget) + ส่งข่าวจากเกมเข้าห้อง Discord (Webhook)
//  ▸ DISCORD_GUILD_ID (ไม่ใช่ความลับ) · ค่าเริ่มต้นคือเซิร์ฟ ThaiNative
//  ▸ DISCORD_WEBHOOK_URL (ความลับ · ตั้งใน Railway Variables เท่านั้น ห้ามใส่ใน repo) — ไม่ตั้ง = ไม่ส่ง
//  ▸ ข่าวที่ส่ง: บอสเกิด/ถูกปราบ · ตีบวก +10 ขึ้นไป · ของหายาก/การ์ด · ประกาศ GM · แพตช์ใหม่ (ข่าวในกระดานข่าว)
// ============================================================
import { NEWS } from '../shared/data/news.js';

export const DISCORD_INVITE = 'https://discord.gg/aYy4StWaQ6';
const GUILD = process.env.DISCORD_GUILD_ID || '1553978632744210452';
const HOOK = process.env.DISCORD_WEBHOOK_URL || '';
const GAME_URL = process.env.PUBLIC_URL || 'https://thainative.online';

// ---------------- จำนวนออนไลน์ (แคช 60 วิ) ----------------
let widget = { at: 0, data: null };
export async function discordInfo() {
  if (Date.now() - widget.at < 60000) return widget.data;
  widget.at = Date.now();
  try {
    const r = await fetch(`https://discord.com/api/guilds/${GUILD}/widget.json`, { signal: AbortSignal.timeout(4000) });
    const j = r.ok ? await r.json() : null;
    widget.data = { invite: DISCORD_INVITE, online: j ? j.presence_count ?? null : null, name: j?.name || null, widget: !!j };
  } catch { widget.data = { invite: DISCORD_INVITE, online: null, widget: false }; }
  return widget.data;
}

// ---------------- Webhook: คิวส่งทีละข้อความ (กัน rate limit) ----------------
const queue = [];
let busy = false;
function push(body) {
  if (!HOOK) return;
  if (queue.length >= 25) queue.shift();                      // คิวล้น → ทิ้งอันเก่าสุด
  queue.push(body);
  if (!busy) pump();
}
async function pump() {
  const body = queue.shift();
  if (!body) { busy = false; return; }
  busy = true;
  try {
    const r = await fetch(HOOK, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'ThaiNative', allowed_mentions: { parse: [] }, ...body }), signal: AbortSignal.timeout(8000) });
    if (r.status === 429) { const j = await r.json().catch(() => ({})); queue.unshift(body); return setTimeout(pump, Math.ceil((j.retry_after || 2) * 1000)); }
  } catch { /* ส่งไม่ได้ก็ข้าม */ }
  setTimeout(pump, 1200);
}

const COLOR = { '👑': 0xf1c40f, '👹': 0xe74c3c, '🔨': 0xe67e22, '✨': 0xbb8fce, '🃏': 0x5dade2, '📢': 0xf7dc6f, '🕯️': 0x95a5a6 };
/** ข้อความระบบในแชทเกม (id: null) → ส่งต่อเฉพาะหมวดที่น่าสนใจ */
export function relayChat(m) {
  if (!HOOK || !m || m.id !== null || !m.name || !m.text) return;
  const lead = Object.keys(COLOR).find((e) => m.name.startsWith(e));
  if (!lead) return;                                           // ฉายา/ข้อความอื่น ไม่ส่ง
  push({ embeds: [{ description: `**${m.name}** · ${m.text}`.slice(0, 1800), color: COLOR[lead] }] });
}

/** ข่าวแพตช์/ข่าวด่วน → embed */
export function postNews(n) {
  if (!HOOK || !n) return;
  const body = (n.body || []).map((b) => `• ${b}`).join('\n');
  push({ embeds: [{ title: `📰 ${n.title}`.slice(0, 250), description: `${body}\n\n▶ เล่นเลย: ${GAME_URL}`.slice(0, 3800), color: 0x9b59b6, footer: { text: n.date || '' } }] });
}

/** ตอนเซิร์ฟเปิด: ส่งข่าวแพตช์ที่ยังไม่เคยส่ง (ครั้งแรกส่งเฉพาะข่าวล่าสุด กันท่วม) */
export async function announcePatch(store) {
  if (!HOOK || !store?.getMeta) return;
  const top = Math.max(...NEWS.map((n) => +n.id || 0));
  const last = +(await store.getMeta('discord_news')) || 0;
  const fresh = NEWS.filter((n) => +n.id > (last || top - 1)).sort((a, b) => a.id - b.id).slice(-3);
  for (const n of fresh) postNews(n);
  if (top > last) await store.setMeta('discord_news', String(top));
}
