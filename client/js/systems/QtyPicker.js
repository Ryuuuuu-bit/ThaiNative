// ============================================================
//  เลือกจำนวน (ใช้กับเทรด / ขายของให้ NPC)
//  askQty({ title, icon, max, def, unitPrice }) → Promise<number | null>
//  ▸ ปุ่ม −/+ · −10/+10 · ครึ่ง · ทั้งหมด · พิมพ์เอง · แถบเลื่อน · Enter = ยืนยัน · Esc = ยกเลิก
// ============================================================
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let open = null;

export function askQty({ title = 'เลือกจำนวน', icon = '', max = 1, def = 1, unitPrice = 0, okText = 'ตกลง', note = '' } = {}) {
  if (open) open.close(null);
  max = Math.max(1, Math.floor(max)); def = Math.min(max, Math.max(1, Math.floor(def)));
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'qty-pick';
    el.innerHTML = `<div class="qp-box" role="dialog" aria-label="${esc(title)}">
      <div class="qp-head">${icon ? `<span class="qp-ico">${icon}</span>` : ''}<b>${esc(title)}</b><small>มี ${max.toLocaleString()} ชิ้น</small></div>
      <div class="qp-row">
        <button type="button" data-d="-10">−10</button><button type="button" data-d="-1">−</button>
        <input type="number" class="qp-n" min="1" max="${max}" value="${def}" inputmode="numeric">
        <button type="button" data-d="1">+</button><button type="button" data-d="10">+10</button>
      </div>
      <input type="range" class="qp-range" min="1" max="${max}" value="${def}">
      <div class="qp-quick"><button type="button" data-set="1">1</button><button type="button" data-set="half">ครึ่ง</button><button type="button" data-set="max">ทั้งหมด (${max.toLocaleString()})</button></div>
      ${unitPrice ? '<div class="qp-price"></div>' : ''}${note ? `<div class="qp-note">${note}</div>` : ''}
      <div class="qp-foot"><button type="button" class="btn ghost sm" data-x>ยกเลิก</button><button type="button" class="btn primary sm" data-ok>${esc(okText)}</button></div>
    </div>`;
    document.body.appendChild(el);
    const n = el.querySelector('.qp-n'), r = el.querySelector('.qp-range'), pr = el.querySelector('.qp-price');
    const clamp = (v) => Math.min(max, Math.max(1, Math.floor(+v || 1)));
    const set = (v) => { v = clamp(v); n.value = v; r.value = v; if (pr) pr.innerHTML = `รวม <b>฿${(v * unitPrice).toLocaleString()}</b> <small>(ชิ้นละ ฿${unitPrice.toLocaleString()})</small>`; };
    set(def);
    const close = (v) => { if (!el.isConnected) return; el.remove(); open = null; document.removeEventListener('keydown', key, true); resolve(v); };
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(null); } else if (e.key === 'Enter') { e.stopPropagation(); e.preventDefault(); close(clamp(n.value)); } else if (e.target === n) e.stopPropagation(); };
    document.addEventListener('keydown', key, true);
    el.querySelectorAll('[data-d]').forEach((b) => (b.onclick = () => set(clamp(n.value) + +b.dataset.d)));
    el.querySelectorAll('[data-set]').forEach((b) => (b.onclick = () => set(b.dataset.set === 'max' ? max : b.dataset.set === 'half' ? Math.ceil(max / 2) : 1)));
    n.oninput = () => { if (n.value !== '') set(n.value); };
    r.oninput = () => set(r.value);
    el.querySelector('[data-x]').onclick = () => close(null);
    el.querySelector('[data-ok]').onclick = () => close(clamp(n.value));
    el.addEventListener('pointerdown', (e) => { if (e.target === el) close(null); });
    open = { close };
    setTimeout(() => { try { n.focus(); n.select(); } catch { /* */ } }, 30);
  });
}
