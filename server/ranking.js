// ============================================================
//  ตารางอันดับเซิร์ฟ: ค่าพลังรวม (CP) · เลเวล · ตีบวก
//  ▸ คำนวณจากฐานข้อมูลทุก 60 วิ (ตัวที่ออนไลน์ใช้ข้อมูลล่าสุดใน server)
//  ▸ อัปเดตอันดับลง rec ของคนที่ออนไลน์ → ฉายาอันดับ (cp_top1/3/10 · lv_top1 · enh_top1) ได้/เสียตามจริง
// ============================================================
import { combatPower } from '../shared/character.js';
import { MAX_LEVEL } from '../shared/stats.js';
import { checkTitles, TITLE_BY_ID } from '../shared/data/titles.js';

const REFRESH_MS = 60_000, TOP = 50, SCAN = 3000;

/** ข้อมูลย่อต่อตัวละคร (สาธารณะ) */
function summarize(key, d) {
  const enh = d.enhance || {}, eq = d.equipment || {};
  const best = Math.max(0, ...Object.entries(enh).filter(([slot]) => eq[slot]).map(([, v]) => +v || 0));
  let cp = 0;
  try { cp = combatPower(d); } catch { cp = 0; }
  return {
    key, name: String(d.name).slice(0, 21), level: Math.min(MAX_LEVEL, +d.level || 1),
    path: typeof d.path === 'string' ? d.path : null, job: typeof d.appearance?.job === 'string' ? d.appearance.job : null,
    title: typeof d.title === 'string' ? d.title : null, enh: Math.min(20, best), cp,
  };
}

export function setupRanking({ storeReady, players, social, queueSync, io }) {
  let boards = { power: [], level: [], enhance: [], at: 0, total: 0 };
  let ranks = new Map();                          // key "acc:slot" → { cpRank, lvRank, enhRank, cp }
  let busy = null;

  function refresh() { return (busy ||= doRefresh().finally(() => { busy = null; })); }
  async function doRefresh() {
    try {
      const store = await storeReady;
      const rows = (await store.rankCharacters?.(SCAN)) || [];
      const byKey = new Map();
      for (const r of rows) if (r?.data?.name) byKey.set(`${r.acc}:${r.slot || 0}`, r.data);
      for (const p of players.values()) if (p.save?.name && p.acc != null) byKey.set(`${p.acc}:${p.slot || 0}`, p.save);   // ข้อมูลสดของคนออนไลน์
      const all = [...byKey].map(([k, d]) => summarize(k, d));
      const power = [...all].sort((a, b) => b.cp - a.cp || b.level - a.level);
      const level = [...all].sort((a, b) => b.level - a.level || b.cp - a.cp);
      const enhance = all.filter((r) => r.enh > 0).sort((a, b) => b.enh - a.enh || b.cp - a.cp);
      const next = new Map();
      power.forEach((r, i) => next.set(r.key, { cpRank: i + 1, lvRank: 0, enhRank: 0, cp: r.cp }));
      level.forEach((r, i) => (next.get(r.key).lvRank = i + 1));
      enhance.forEach((r, i) => (next.get(r.key).enhRank = i + 1));
      ranks = next;
      const pub = (list) => list.slice(0, TOP).map(({ key, ...r }) => r);
      boards = { power: pub(power), level: pub(level), enhance: pub(enhance), at: Date.now(), total: all.length };
      for (const p of players.values()) apply(p);
    } catch (e) {
      console.error('[ranking]', e.message);
    }
  }

  /** ใส่อันดับล่าสุดลงเซฟ → ตรวจฉายาอันดับ (ได้ใหม่ประกาศ · หลุดอันดับถอดออก) */
  let soon = null;
  function apply(p) {
    if (!p?.save) return;
    const r = ranks.get(`${p.acc}:${p.slot || 0}`);
    if (!r && !soon) soon = setTimeout(() => { soon = null; refresh(); }, 5000);   // ตัวใหม่ยังไม่อยู่ในตาราง → คำนวณรอบใหม่เร็ว ๆ
    if (!r) return;
    const rec = (p.save.rec ||= {});
    const before = `${rec.cpRank}|${rec.lvRank}|${rec.enhRank}`, titleBefore = p.save.title || null, nBefore = (p.save.titles || []).length;
    rec.cpRank = r.cpRank; rec.lvRank = r.lvRank; rec.enhRank = r.enhRank;
    const got = checkTitles(p.save);
    if (got.length) social.announceTitles(p, got);
    if ((p.save.title || null) !== titleBefore) io.emit('td:title', { id: p.id, title: p.save.title || null });
    if (got.length || before !== `${rec.cpRank}|${rec.lvRank}|${rec.enhRank}` || nBefore !== (p.save.titles || []).length) queueSync(p);
  }

  /** ตารางสาธารณะ (ฉายาอันดับที่หลุดมือไปแล้วจะไม่แสดง) */
  function publicBoards() {
    const fix = (list) => list.map((r) => (TITLE_BY_ID[r.title]?.dynamic && !validDynamic(r) ? { ...r, title: null } : r));
    return { power: fix(boards.power), level: fix(boards.level), enhance: fix(boards.enhance), at: boards.at, total: boards.total };
  }
  /** ฉายาอันดับของแถวนี้ยังจริงอยู่ไหม (ดูจากอันดับทุกตาราง) */
  function validDynamic(r) {
    const t = TITLE_BY_ID[r.title];
    const cpRank = boards.power.findIndex((x) => x.name === r.name) + 1;
    const lvRank = boards.level.findIndex((x) => x.name === r.name) + 1;
    const enhRank = boards.enhance.findIndex((x) => x.name === r.name) + 1;
    return !!t && t.ok({}, { cpRank, lvRank, enhRank });
  }

  const timer = setInterval(refresh, REFRESH_MS);
  timer.unref?.();
  setTimeout(refresh, 3000).unref?.();

  return {
    refresh, apply,
    /** ตารางสาธารณะ (ถ้ายังว่าง/เก่าเกิน 2 นาที → คำนวณก่อนตอบ) */
    publicBoards: async () => { if (!boards.total || Date.now() - boards.at > 2 * REFRESH_MS) await refresh(); return publicBoards(); },
    /** อันดับของตัวละครนี้ (ให้ client โชว์ "อันดับของฉัน") */
    rankOf: (p) => ranks.get(`${p.acc}:${p.slot || 0}`) || null,
  };
}
