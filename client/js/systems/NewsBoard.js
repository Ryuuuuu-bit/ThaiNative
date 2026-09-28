// ============================================================
//  NewsBoard – กระดานข่าวสาร (📰 ปุ่มขวาบน / ปุ่ม N)
//  ▸ ข่าวแพตช์ในโค้ด (shared/data/news.js) + ข่าวด่วนจาก GM (server: news:live / news:add / news:del)
//  ▸ จุดแดงบนปุ่มเมื่อมีข่าวที่ยังไม่อ่าน · เปิดเองครั้งแรกหลังเข้าเกมถ้ามีข่าวใหม่
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
    if (open) { this.ui.closeAll?.(); this.render(); }
    this.ui.toggle('news-panel', open);
    if (open) this.ui.scene?.sfx?.play('open');
  }

  /** เปิดเองตอนเข้าเกม ถ้ามีข่าวที่ยังไม่เคยเห็น */
  autoOpen() { if (this.unread().length) setTimeout(() => { if (!this.ui.anyOpen?.()) this.toggle(true); }, 1200); }

  render() {
    const el = document.getElementById('news-list'); if (!el) return;
    const seen = readSeen(), list = this.all().filter((n) => this.tab === 'all' || n.tag === this.tab || (this.tab === 'notice' && n.tag === 'gm'));
    const TABS = [['all', 'ทั้งหมด'], ['patch', 'อัปเดต'], ['event', 'อีเวนต์'], ['notice', 'ประกาศ'], ['fix', 'แก้บั๊ก']];
    document.getElementById('news-tabs').innerHTML = TABS.map(([k, l]) => `<button data-ntab="${k}" class="${k === this.tab ? 'active' : ''}">${l}</button>`).join('');
    el.innerHTML = list.length ? list.map((n) => {
      const T = NEWS_TAGS[n.tag] || NEWS_TAGS.notice, isNew = !seen.has(String(n.id));
      return `<article class="news-item${isNew ? ' new' : ''}" style="--nc:${T.color}">
        <div class="nh"><span class="nt-ic">${uiIcon(T.icon) || '📰'}</span><span class="nt-tag">${esc(T.th)}</span><b>${esc(n.title)}</b>${isNew ? '<i class="nt-new">ใหม่</i>' : ''}<small>${esc(n.date || '')}</small></div>
        ${(n.body || []).length ? `<ul>${n.body.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
        ${n.link && /^https:\/\//.test(n.link.url || '') ? `<a class="n-link" href="${esc(n.link.url)}" target="_blank" rel="noopener noreferrer">${esc(n.link.text || n.link.url)}</a>` : ''}
      </article>`;
    }).join('') : '<p class="empty">ยังไม่มีข่าวในหมวดนี้</p>';
    document.querySelectorAll('#news-tabs [data-ntab]').forEach((b) => (b.onclick = () => { this.tab = b.dataset.ntab; this.render(); }));
    // เปิดอ่านแล้ว = อ่านครบทุกข่าว (จุดแดงหาย) · ป้าย "ใหม่" ยังเห็นในรอบนี้
    for (const n of this.all()) seen.add(String(n.id));
    writeSeen(seen); this.refreshDot();
  }
}
