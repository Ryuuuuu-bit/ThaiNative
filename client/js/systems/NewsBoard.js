// ============================================================
//  NewsBoard – กระดานข่าวสาร (📰 ปุ่มขวาบน / ปุ่ม N)
//  ▸ ข่าวแพตช์ในโค้ด (shared/data/news.js) + ข่าวด่วนจาก GM (server: news:live / news:add / news:del)
//  ▸ ตัวเลขบนปุ่มเมื่อมีข่าวที่ยังไม่อ่าน · เปิดเองครั้งแรกหลังเข้าเกมถ้ามีข่าวใหม่
//  ▸ ซ้าย = หัวข้อบรรทัดเดียวแบ่งตามวัน (ป้าย New! = ยังไม่อ่าน) · ขวา = รายละเอียดข่าวที่เลือก (เปิดอ่าน = อ่านแล้ว)
// ============================================================
import { NEWS, NEWS_TAGS } from '/shared/data/news.js';
import { uiIcon } from './util.js';
import { startDiscordLink } from './DiscordLink.js';

const SEEN = 'tn_news_seen_v1';
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const readSeen = () => { try { return new Set(JSON.parse(localStorage.getItem(SEEN) || '[]')); } catch { return new Set(); } };
const writeSeen = (s) => { try { localStorage.setItem(SEEN, JSON.stringify([...s].slice(-200))); } catch { /* */ } };

export class NewsBoard {
  constructor(ui) {
    this.ui = ui; this.live = []; this.tab = 'all';
    this.btn = document.getElementById('btn-news');
    if (this.btn) {
      const ic = uiIcon('menu_news'); if (ic) this.btn.querySelector('.nb-ic').innerHTML = ic;
      this.btn.onclick = () => this.toggle();
    }
    document.querySelector('#news-panel .close')?.addEventListener('click', () => this.ui.toggle('news-panel', false));
    this.refreshDot();
    startDiscordLink();
  }

  all() { return [...this.live, ...NEWS]; }
  unread() { const s = readSeen(); return this.all().filter((n) => !s.has(String(n.id))); }

  setLive(list) { this.live = Array.isArray(list) ? list : []; this.refreshDot(); if (this.isOpen()) this.render(); }
  add(it) { if (!it?.id) return; this.live = [it, ...this.live.filter((n) => n.id !== it.id)]; this.refreshDot(); if (this.isOpen()) this.render(); }
  del(id) { this.live = this.live.filter((n) => n.id !== id); this.refreshDot(); if (this.isOpen()) this.render(); }

  refreshDot() { const n = this.unread().length; this.btn?.classList.toggle('unread', n > 0); const b = this.btn?.querySelector('.nb-n'); if (b) b.textContent = n > 9 ? '9+' : n || ''; }
  isOpen() { return !document.getElementById('news-panel')?.classList.contains('hidden'); }

  toggle(force) {
    const open = force ?? !this.isOpen();
    if (open) { this.ui.closeAll?.(); this.fresh = null; this.cur = null; this.render(); }
    this.ui.toggle('news-panel', open);
    if (open) this.ui.scene?.sfx?.play('open');
  }

  /** เปิดเองตอนเข้าเกม ถ้ามีข่าวที่ยังไม่เคยเห็น */
  autoOpen() { if (this.unread().length) setTimeout(() => { if (!this.ui.anyOpen?.()) this.toggle(true); }, 1200); }

  render() {
    const el = document.getElementById('news-list'), det = document.getElementById('news-detail'); if (!el || !det) return;
    const seen = readSeen(), list = this.all().filter((n) => this.tab === 'all' || n.tag === this.tab || (this.tab === 'notice' && n.tag === 'gm'));
    this.fresh ||= new Set(this.unread().map((n) => String(n.id)));                 // ข่าวใหม่ตอนเปิดกระดานรอบนี้ (ป้าย New! ในหน้ารายละเอียดค้างจนปิด)
    if (!list.some((n) => String(n.id) === String(this.cur))) this.cur = (list.find((n) => !seen.has(String(n.id))) || list[0])?.id;   // เปิดมา = ข่าวใหม่อันแรก
    const TABS = [['all', 'ทั้งหมด'], ['patch', 'อัปเดต'], ['event', 'อีเวนต์'], ['notice', 'ประกาศ'], ['fix', 'แก้บั๊ก']];
    const count = (k) => this.all().filter((n) => k === 'all' || n.tag === k || (k === 'notice' && n.tag === 'gm')).length;
    document.getElementById('news-tabs').innerHTML = TABS.map(([k, l]) => `<button data-ntab="${k}" class="${k === this.tab ? 'active' : ''}" style="--nc:${k === 'all' ? '#d4af37' : NEWS_TAGS[k].color}">${k === 'all' ? '' : '<i></i>'}${l}<small>${count(k)}</small></button>`).join('')
      + (this.unread().length ? '<button class="nt-readall" data-readall>อ่านทั้งหมดแล้ว</button>' : '');
    // ซ้าย: หัวข้อบรรทัดเดียว แบ่งตามวัน · ป้าย New! = ยังไม่อ่าน
    const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10), yday = new Date(Date.now() + 7 * 3600e3 - 864e5).toISOString().slice(0, 10);
    const dayName = (d) => (d === today ? `วันนี้ · ${d}` : d === yday ? `เมื่อวาน · ${d}` : d || '');
    let html = '', last = null;
    for (const n of list) {
      if (n.date !== last) { last = n.date; html += `<div class="nd-day">${esc(dayName(n.date))}</div>`; }
      const T = NEWS_TAGS[n.tag] || NEWS_TAGS.notice, m = /^(\S+)\s+(.*)$/.exec(n.title || ''), emo = m && !/[ก-๙a-z0-9]/i.test(m[1]);
      html += `<button class="nd-item${seen.has(String(n.id)) ? ' read' : ''}" data-nid="${esc(n.id)}" aria-current="${String(n.id) === String(this.cur)}" style="--nc:${T.color}"><span class="nd-ic">${emo ? m[1] : uiIcon(T.icon) || '📰'}</span><span class="nd-t"><b>${esc(emo ? m[2] : n.title)}</b><small>${esc(T.th)}</small></span><i class="nd-new">New!</i></button>`;
    }
    el.innerHTML = html || '<p class="empty">ยังไม่มีข่าวในหมวดนี้</p>';
    // ขวา: รายละเอียดข่าวที่เลือก
    const i = list.findIndex((n) => String(n.id) === String(this.cur)), n = list[i];
    if (n) {
      const T = NEWS_TAGS[n.tag] || NEWS_TAGS.notice;
      det.style.setProperty('--nc', T.color);
      det.innerHTML = `<div class="nd-meta"><span class="nt-tag">${esc(T.th)}</span><span>${esc(dayName(n.date))}</span>${this.fresh.has(String(n.id)) ? '<i class="nd-new on">New!</i>' : ''}</div>
        <h3>${esc(n.title)}</h3>
        ${(n.body || []).length ? `<ul>${n.body.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
        ${n.link && /^https:\/\//.test(n.link.url || '') ? `<a class="n-link" href="${esc(n.link.url)}" target="_blank" rel="noopener noreferrer">${esc(n.link.text || n.link.url)}</a>` : ''}
        <div class="nd-nav"><button data-nstep="-1" ${i <= 0 ? 'disabled' : ''}>← ข่าวใหม่กว่า</button><button data-nstep="1" ${i >= list.length - 1 ? 'disabled' : ''}>ข่าวเก่ากว่า →</button></div>`;
      det.scrollTop = 0;
      if (!seen.has(String(n.id))) { seen.add(String(n.id)); writeSeen(seen); this.refreshDot(); el.querySelector(`[data-nid="${CSS.escape(String(n.id))}"]`)?.classList.add('read'); }   // เปิดอ่าน = อ่านแล้ว
    } else det.innerHTML = '';
    document.querySelectorAll('#news-tabs [data-ntab]').forEach((b) => (b.onclick = () => { this.tab = b.dataset.ntab; this.render(); }));
    document.querySelector('#news-tabs [data-readall]')?.addEventListener('click', () => { for (const x of this.all()) seen.add(String(x.id)); writeSeen(seen); this.refreshDot(); this.render(); });
    el.querySelectorAll('[data-nid]').forEach((b) => (b.onclick = () => { this.cur = b.dataset.nid; this.render(); }));
    det.querySelectorAll('[data-nstep]').forEach((b) => (b.onclick = () => { const j = i + +b.dataset.nstep; if (list[j]) { this.cur = list[j].id; this.render(); } }));
  }
}
