// ============================================================
//  Dialog – กล่องยืนยัน/แจ้งเตือนแบบในเกม (แทน confirm()/alert() ของเบราว์เซอร์)
//  ask(text | { title, text, ok, cancel, icon, danger, lines }) → Promise<boolean>
//  notice(text | {...}) → Promise<void>
//  ▸ Enter = ตกลง · Esc = ยกเลิก · คลิกนอกกล่อง = ยกเลิก · ระหว่างเปิด ปุ่มเกมไม่ทำงาน
// ============================================================
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let queue = Promise.resolve();

function open(o, withCancel) {
  const opt = typeof o === 'string' ? { text: o } : { ...o };
  // บรรทัดแรกเป็นหัวข้อ ถ้าไม่ได้ส่ง title มา · บรรทัด "⚠ ..." = คำเตือน (สีส้ม) · "฿..." ไฮไลต์
  const lines = String(opt.text || '').split('\n').filter((l) => l.trim());
  const title = opt.title || lines.shift() || 'ยืนยัน';
  const body = (opt.lines || lines).map((l) => {
    const warn = /^\s*⚠/.test(l);
    const html = esc(l).replace(/(฿[\d,]+)/g, '<b class="dlg-gold">$1</b>');
    return `<p class="${warn ? 'warn' : ''}">${html}</p>`;
  }).join('');
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'dlg-wrap';
    wrap.innerHTML = `<div class="dlg panel${opt.danger ? ' danger' : ''}" role="dialog" aria-modal="true">
      <div class="dlg-h">${opt.icon ? `<span class="dlg-ic">${esc(opt.icon)}</span>` : ''}<span>${esc(title)}</span></div>
      ${body ? `<div class="dlg-b">${body}</div>` : ''}
      ${opt.input != null ? `<div class="dlg-b"><input class="dlg-in" maxlength="${opt.max || 24}" value="${esc(opt.input)}"></div>` : ''}
      <div class="dlg-f">${withCancel ? `<button class="btn ghost" data-v="0">${esc(opt.cancel || 'ยกเลิก')}</button>` : ''}<button class="btn ${opt.danger ? 'danger' : 'primary'}" data-v="1">${esc(opt.ok || 'ตกลง')}</button></div></div>`;
    document.body.appendChild(wrap);
    const done = (v) => {
      window.removeEventListener('keydown', onKey, true);
      wrap.classList.add('out');
      setTimeout(() => wrap.remove(), 120);
      const inp = wrap.querySelector('.dlg-in');
      resolve(inp ? (v ? inp.value.trim() : null) : v);
    };
    const onKey = (e) => {
      e.stopImmediatePropagation();                          // กันปุ่มเกม (เดิน/สกิล) ระหว่างกล่องเปิด
      if (e.key === 'Enter') { e.preventDefault(); done(true); } else if (e.key === 'Escape') { e.preventDefault(); done(withCancel ? false : true); }
    };
    window.addEventListener('keydown', onKey, true);
    wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) done(withCancel ? false : true); });
    wrap.querySelectorAll('[data-v]').forEach((b) => (b.onclick = () => done(b.dataset.v === '1')));
    requestAnimationFrame(() => { const inp = wrap.querySelector('.dlg-in'); if (inp) { inp.focus(); inp.select(); } else wrap.querySelector('[data-v="1"]')?.focus(); });
  });
}
/** ยืนยัน (ตกลง/ยกเลิก) → true/false · เรียกซ้อนกันจะต่อคิว */
export function ask(o) { const p = queue.then(() => open(o, true)); queue = p.catch(() => {}); return p; }
/** แจ้งเตือน (ปุ่มเดียว) */
export function notice(o) { const p = queue.then(() => open(o, false)); queue = p.catch(() => {}); return p; }
/** กล่องพิมพ์ข้อความ → string (ตกลง) | null (ยกเลิก) */
export function askText(o) { const p = queue.then(() => open({ ok: 'บันทึก', ...o, input: o.input ?? '' }, true)); queue = p.catch(() => {}); return p; }
