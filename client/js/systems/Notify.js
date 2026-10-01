// ============================================================
//  Notify – ระบบแจ้งเตือนกลางจอ
//  ▸ toast: ไม่เกิน 4 อันพร้อมกัน · ข้อความซ้ำรวมเป็นอันเดียว (×n) · ไอคอน/สีตามประเภท
//  ▸ ticker: แถบประกาศวิ่งด้านบนจอแบบ MMO (ประกาศ GM · บอสเกิด · ตีบวกสำเร็จ · ของหายาก) ต่อคิวทีละข้อความ
// ============================================================
import { uiIcon } from './util.js';

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/** อีโมจินำหน้าข้อความ → ใช้เป็นไอคอน (ไม่ซ้ำกับไอคอนประเภท) */
const LEAD = /^((?:\p{Extended_Pictographic}|[✔✖⚠])(?:️|‍\p{Extended_Pictographic})*)\s*/u;
const KIND_ICON = { ok: '✔', warn: '⚠️', loot: '🎁', quest: '📜', info: 'ℹ️', boss: '👑', level: '⬆️' };
/** ไอคอนภาพ (PixelLab) ตามประเภท ถ้ามี */
const KIND_IMG = { ok: 'nt_ok', warn: 'nt_warn', loot: 'nt_loot', quest: 'nt_quest', boss: 'nt_boss', level: 'nt_level', info: 'nt_news' };

/** อีโมจินำหน้าที่มีไอคอนภาพแทน */
const EMOJI_IMG = { '🎁': 'nt_loot', '⚠️': 'nt_warn', '⚠': 'nt_warn', '✔': 'nt_ok', '✅': 'nt_ok', '📜': 'nt_quest', '👑': 'nt_boss', '🎉': 'nt_level', '⬆️': 'nt_level', '🏠': 'menu_home', '📰': 'nt_news', '📢': 'nt_gong', '🤝': 'nt_party', '💱': 'nt_trade', '💀': 'nt_death', '✨': 'nt_buff', '🙏': 'nt_buff' };
const MAX_TOASTS = 4;
const live = new Map();          // ข้อความ → { el, n, timer }

export function toast(msg, kind = '', ms = 2600) {
  const box = document.getElementById('toasts');
  if (!box || !msg) return;
  msg = String(msg);
  if (!kind) kind = /^(✔|🏆|🎖|🔨 ตีบวกสำเร็จ)/.test(msg) ? 'ok' : /^(🎁|✨|ได้รับ|🎣 ได้)/.test(msg) ? 'loot' : /^(รับเควส|📜)/.test(msg) ? 'quest' : /^👑/.test(msg) ? 'boss' : 'info';
  const hit = live.get(msg);
  if (hit && !hit.el.isConnected) { clearTimeout(hit.timer); live.delete(msg); }
  if (hit && hit.el.isConnected) {                                   // ข้อความเดิมซ้ำ → นับ ×n แทนเด้งใหม่
    hit.n++; hit.el.querySelector('.t-n').textContent = `×${hit.n}`; hit.el.classList.remove('bump'); void hit.el.offsetWidth; hit.el.classList.add('bump');
    clearTimeout(hit.timer); hit.timer = setTimeout(() => drop(msg), ms);
    return;
  }
  const m = msg.match(LEAD), text = m ? msg.slice(m[0].length) : msg;
  const img = m ? uiIcon(EMOJI_IMG[m[1]]) : uiIcon(KIND_IMG[kind]);
  const el = document.createElement('div');
  el.className = `toast t2 ${kind}`;
  el.innerHTML = `<span class="t-ic">${img || esc(m ? m[1] : KIND_ICON[kind] || KIND_ICON.info)}</span><span class="t-tx">${esc(text)}</span><b class="t-n"></b>`;
  box.appendChild(el);
  const rec = { el, n: 1, timer: setTimeout(() => drop(msg), ms) };
  live.set(msg, rec);
  const all = [...box.querySelectorAll('.toast')];
  for (const old of all.slice(0, Math.max(0, all.length - MAX_TOASTS))) {
    old.remove();
    for (const [k, r] of live) if (r.el === old) { clearTimeout(r.timer); live.delete(k); }   // ถูกดันออก → ล้างตัวจับเวลาด้วย (เดิมค้าง แล้วไปซ่อนข้อความเดียวกันอันใหม่ก่อนเวลา)
  }
}
function drop(msg) {
  const r = live.get(msg); if (!r) return;
  live.delete(msg);
  r.el.classList.add('out');
  setTimeout(() => r.el.remove(), 260);
}

// ---------------- แถบประกาศวิ่ง ----------------
const queue = [];
let running = false;
const TICK_IMG = { gm: 'nt_gong', boss: 'nt_boss', enh: 'nt_level', rare: 'nt_loot', news: 'nt_news', info: 'nt_gong' };

/** ประกาศวิ่งด้านบน · kind: gm | boss | enh | rare | news | info */
export function ticker(text, kind = 'info') {
  if (!text) return;
  if (queue.some((q) => q.text === text)) return;
  queue.push({ text: String(text), kind });
  if (queue.length > 6) queue.splice(0, queue.length - 6);
  if (!running) next();
}
function next() {
  const it = queue.shift();
  let el = document.getElementById('ticker');
  if (!it) { running = false; el?.classList.add('hide'); return; }
  running = true;
  if (!el) {
    el = document.createElement('div'); el.id = 'ticker';
    (document.getElementById('hud') || document.body).appendChild(el);
  }
  const ic = uiIcon(TICK_IMG[it.kind]) || (it.kind === 'boss' ? '👑' : it.kind === 'enh' ? '🔨' : it.kind === 'rare' ? '✨' : '📢');
  el.className = `tk-${it.kind}`;
  el.innerHTML = `<span class="tk-ic">${ic}</span><div class="tk-view"><span class="tk-txt">${esc(it.text)}</span></div>`;
  const txt = el.querySelector('.tk-txt');
  const dur = Math.max(7, Math.min(16, 5 + it.text.length * 0.09));
  txt.style.animationDuration = `${dur}s`;
  txt.addEventListener('animationend', () => setTimeout(next, 250), { once: true });
}
