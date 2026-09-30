// ============================================================
//  ตลาดฝากขาย · ป้ายรับซื้อ · กล่องรับของ (นายห้างสำเภา) · พ่อค้าเร่ – ฝั่ง server
//  ▸ ของ/เงินที่อยู่ระหว่างซื้อขายเก็บใน state ของตลาด (ไม่ใช่ในตัวละคร) → ผู้ขายออฟไลน์ก็ขายได้
//    เงินที่ขายได้ / ของที่รับซื้อได้ / ของหมดอายุ → เข้า "กล่องรับของ" ไปกดรับที่นายห้าง
//  ▸ ทุกคำสั่งรันในเธรดเดียว (ไม่มี await ระหว่างแก้ข้อมูล) → ไม่มีซื้อซ้ำ/ของซ้ำ
//  ▸ เซฟ state ลง meta 'market_v1' (หน่วง 1.5 วิ) + ตอนปิด server
// ============================================================
import { ITEMS, sellPrice } from '../shared/data/items.js';
import { addItem, removeItem, freeQty, packChar } from '../shared/economy.js';
import { MARKET, MARKET_NPC, tradable, listFee, afterTax, TRAVEL, TRAVEL_SPOTS, TRAVEL_STOCK } from '../shared/data/trade.js';
import { OX, TILE } from '../shared/td/ayutthaya.js';

const NPC_R = 76;
const int = (v, lo, hi) => (Number.isFinite(+v) ? Math.max(lo, Math.min(hi, Math.floor(+v))) : NaN);
const rand = (a, b) => a + Math.random() * (b - a);
const fmt = (n) => Math.round(n).toLocaleString('en-US');

export function setupMarket(io, players, { td, refresh, persist, storeReady, isNearLegacy }) {
  const S = { seq: 1, listings: [], orders: [], box: {}, hist: {}, travel: { active: false, next: Date.now() + rand(15, 35) * 60e3 } };
  const keyOf = (p) => `${p.acc}:${p.slot || 0}`;
  const online = (k) => [...players.values()].find((p) => keyOf(p) === k);
  const box = (k) => (S.box[k] ||= { gold: 0, items: {} });
  const say = (text, name = '⚓ นายห้างสำเภา') => io.emit('chat', { id: null, name, text });

  // ---------------- เซฟ/โหลด ----------------
  let saveT = null, loaded = false;
  const dirty = () => { if (saveT || !loaded) return; saveT = setTimeout(flush, 1500); };
  async function flush() {
    clearTimeout(saveT); saveT = null;
    if (!loaded) return;
    try { const st = await storeReady; await st.setMeta?.('market_v1', JSON.stringify({ ...S, travel: { ...S.travel }, gen: st.gen || '' })); } catch (e) { console.error('[market] save', e.message); }   // แปะรุ่นข้อมูล (Fresh Server)
  }
  (async () => {
    try {
      const st = await storeReady, d = JSON.parse((await st.getMeta?.('market_v1')) || 'null');
      if (d && (d.gen || '') !== (st.gen || '')) console.log('[market] ข้อมูลก่อน wipe (รุ่นไม่ตรง) → ทิ้ง');
      else if (d) Object.assign(S, d, { travel: d.travel?.active && d.travel.until > Date.now() ? d.travel : { active: false, next: Date.now() + rand(15, 35) * 60e3 } });
    } catch (e) { console.error('[market] load', e.message); }
    loaded = true;
    console.log(`[market] ${S.listings.length} แผง · ${S.orders.length} ป้ายรับซื้อ`);
  })();

  // ---------------- ตรวจตำแหน่ง ----------------
  const atMarket = (p) => (p.world === 'td' ? td.npcNear(p) === MARKET_NPC : isNearLegacy(p, MARKET_NPC));
  const travelPos = () => { const s = TRAVEL_SPOTS[S.travel.spot] || TRAVEL_SPOTS[0]; return { x: (s.x + OX) * TILE + 8, y: s.y * TILE + 8 }; };
  const atTravel = (p) => { if (!S.travel.active || p.world !== 'td' || td.mapOf(p) !== 'ayutthaya') return false; const t = travelPos(); return Math.hypot(t.x - p.tx, t.y - p.ty) <= NPC_R; };

  // ---------------- มุมมองส่งให้ client ----------------
  const pubL = (l) => [l.id, l.item, l.qty, l.price, l.name, l.exp];
  const lastPrice = (id) => (S.hist[id] || [])[0];
  function view(p) {
    const k = keyOf(p), b = S.box[k];
    const prices = {}; for (const id of new Set([...S.listings.map((l) => l.item), ...S.orders.map((o) => o.item)])) if (S.hist[id]) prices[id] = S.hist[id];
    return {
      listings: S.listings.filter((l) => l.k !== k).map(pubL),
      orders: S.orders.filter((o) => o.k !== k).map(pubL),
      mine: S.listings.filter((l) => l.k === k).map(pubL),
      myOrders: S.orders.filter((o) => o.k === k).map(pubL),
      box: b && (b.gold || Object.keys(b.items).length) ? b : null,
      hist: prices, now: Date.now(),
    };
  }
  function travelView() {
    const t = S.travel;
    if (!t.active) return { active: false };
    return { active: true, until: t.until, spot: t.spot, spotTh: TRAVEL_SPOTS[t.spot]?.th, ...travelPos(), stock: t.stock, name: TRAVEL.name, key: TRAVEL.key };
  }

  // ---------------- คำสั่ง ----------------
  const NO = (msg) => ({ ok: false, msg });
  const OK = (msg, extra = {}) => ({ ok: true, msg, ...extra });
  function note(k, text) { const q = online(k); if (q) io.to(q.id).emit('mk:note', { text }); }
  function pushHist(item, price) { const h = (S.hist[item] ||= []); h.unshift(price); if (h.length > MARKET.hist) h.length = MARKET.hist; }

  const OPS = {
    state: () => OK(''),
    list(p, c, { item, qty, price }) {
      if (!atMarket(p)) return NO('ต้องยืนคุยกับนายห้างสำเภาก่อน');
      if (!tradable(item)) return NO('ของชิ้นนี้ฝากขายไม่ได้');
      qty = int(qty, 1, MARKET.maxQty); price = int(price, 1, MARKET.maxPrice);
      if (!qty || !price) return NO('จำนวน/ราคาไม่ถูกต้อง');
      const k = keyOf(p);
      if (S.listings.filter((l) => l.k === k).length >= MARKET.maxListings) return NO(`วางแผงได้สูงสุด ${MARKET.maxListings} รายการ`);
      if (freeQty(c, item) < qty) return NO('ของไม่พอ (ของล็อก/ของชุด A-B วางขายไม่ได้)');
      const fee = listFee(price, qty);
      if (c.gold < fee) return NO(`ต้องมีค่าวางแผง ฿${fmt(fee)}`);
      removeItem(c, item, qty); c.gold -= fee;
      const now = Date.now();
      S.listings.push({ id: S.seq++, k, name: c.name, item, qty, price, at: now, exp: now + MARKET.hours * 3600e3 });
      return OK(`วางแผง ${ITEMS[item].nameTh} x${qty} ชิ้นละ ฿${fmt(price)} แล้ว (ค่าวางแผง ฿${fmt(fee)})`);
    },
    cancel(p, c, { id }) {
      if (!atMarket(p)) return NO('ต้องยืนคุยกับนายห้างสำเภาก่อน');
      const i = S.listings.findIndex((l) => l.id === +id && l.k === keyOf(p));
      if (i < 0) return NO('ไม่พบแผงนี้ (อาจขายไปแล้ว)');
      const [l] = S.listings.splice(i, 1);
      addItem(c, l.item, l.qty, false);
      return OK(`เก็บ ${ITEMS[l.item].nameTh} x${l.qty} กลับเข้ากระเป๋าแล้ว`);
    },
    buy(p, c, { id, qty }) {
      if (!atMarket(p)) return NO('ต้องยืนคุยกับนายห้างสำเภาก่อน');
      const l = S.listings.find((x) => x.id === +id);
      if (!l) return NO('แผงนี้ขายไปแล้ว');
      if (l.k.split(':')[0] === String(p.acc)) return NO('ซื้อของจากบัญชีตัวเองไม่ได้');
      qty = int(qty, 1, l.qty); if (!qty) return NO('จำนวนไม่ถูกต้อง');
      const cost = l.price * qty;
      if (c.gold < cost) return NO(`เงินไม่พอ (ต้องใช้ ฿${fmt(cost)})`);
      c.gold -= cost; addItem(c, l.item, qty, false);
      l.qty -= qty; if (!l.qty) S.listings = S.listings.filter((x) => x !== l);
      const net = afterTax(cost); box(l.k).gold += net; pushHist(l.item, l.price);
      note(l.k, `💰 ${c.name} ซื้อ ${ITEMS[l.item].nameTh} x${qty} ของคุณ · ได้ ฿${fmt(net)} (ไปรับที่นายห้างสำเภา)`);
      return OK(`ซื้อ ${ITEMS[l.item].nameTh} x${qty} แล้ว (-฿${fmt(cost)})`);
    },
    order(p, c, { item, qty, price }) {
      if (!atMarket(p)) return NO('ต้องยืนคุยกับนายห้างสำเภาก่อน');
      if (!tradable(item) || item.includes('@')) return NO('ตั้งรับซื้อของชิ้นนี้ไม่ได้');
      qty = int(qty, 1, MARKET.maxQty); price = int(price, 1, MARKET.maxPrice);
      if (!qty || !price) return NO('จำนวน/ราคาไม่ถูกต้อง');
      const k = keyOf(p);
      if (S.orders.filter((o) => o.k === k).length >= MARKET.maxOrders) return NO(`ตั้งป้ายได้สูงสุด ${MARKET.maxOrders} ป้าย`);
      const escrow = price * qty;
      if (c.gold < escrow) return NO(`ต้องวางเงินมัดจำ ฿${fmt(escrow)}`);
      c.gold -= escrow;
      const now = Date.now();
      S.orders.push({ id: S.seq++, k, name: c.name, item, qty, price, at: now, exp: now + MARKET.hours * 3600e3 });
      return OK(`ตั้งป้ายรับซื้อ ${ITEMS[item].nameTh} x${qty} ชิ้นละ ฿${fmt(price)} แล้ว (มัดจำ ฿${fmt(escrow)})`);
    },
    orderCancel(p, c, { id }) {
      if (!atMarket(p)) return NO('ต้องยืนคุยกับนายห้างสำเภาก่อน');
      const i = S.orders.findIndex((o) => o.id === +id && o.k === keyOf(p));
      if (i < 0) return NO('ไม่พบป้ายนี้');
      const [o] = S.orders.splice(i, 1);
      c.gold += o.price * o.qty;
      return OK(`ปลดป้ายแล้ว · คืนมัดจำ ฿${fmt(o.price * o.qty)}`);
    },
    fill(p, c, { id, qty }) {
      if (!atMarket(p)) return NO('ต้องยืนคุยกับนายห้างสำเภาก่อน');
      const o = S.orders.find((x) => x.id === +id);
      if (!o) return NO('ป้ายนี้รับครบแล้ว');
      if (o.k.split(':')[0] === String(p.acc)) return NO('ขายให้ป้ายของบัญชีตัวเองไม่ได้');
      qty = int(qty, 1, o.qty); if (!qty) return NO('จำนวนไม่ถูกต้อง');
      if (freeQty(c, o.item) < qty) return NO('ของไม่พอ (ของล็อก/ของชุด A-B ขายไม่ได้)');
      removeItem(c, o.item, qty);
      const net = afterTax(o.price * qty); c.gold += net;
      const b = box(o.k); b.items[o.item] = (b.items[o.item] || 0) + qty;
      o.qty -= qty; if (!o.qty) S.orders = S.orders.filter((x) => x !== o);
      pushHist(o.item, o.price);
      note(o.k, `📦 ${c.name} ขาย ${ITEMS[o.item].nameTh} x${qty} ให้ป้ายรับซื้อของคุณ (ไปรับที่นายห้างสำเภา)`);
      return OK(`ขาย ${ITEMS[o.item].nameTh} x${qty} ให้ ${o.name} แล้ว (+฿${fmt(net)})`);
    },
    claim(p, c) {
      if (!atMarket(p)) return NO('ต้องยืนคุยกับนายห้างสำเภาก่อน');
      const k = keyOf(p), b = S.box[k];
      if (!b || (!b.gold && !Object.keys(b.items).length)) return NO('กล่องว่าง');
      const n = Object.values(b.items).reduce((a, x) => a + x, 0);
      c.gold += b.gold; for (const [id, q] of Object.entries(b.items)) addItem(c, id, q, false);
      const g = b.gold; delete S.box[k];
      return OK(`รับของแล้ว${g ? ` · ฿${fmt(g)}` : ''}${n ? ` · ของ ${n} ชิ้น` : ''}`);
    },
    travelBuy(p, c, { id, qty }) {
      const t = S.travel;
      if (!t.active) return NO('พ่อค้าเร่เดินทางไปแล้ว');
      if (!atTravel(p)) return NO('ต้องยืนคุยกับพ่อค้าเร่ก่อน');
      const s = t.stock.find((x) => x.id === id);
      if (!s || s.qty <= 0) return NO('ของชิ้นนี้หมดแล้ว');
      const k = keyOf(p), mine = ((t.bought ||= {})[k] ||= {}), lim = Math.min(s.qty, TRAVEL.perChar - (mine[id] || 0));
      if (lim <= 0) return NO(`ซื้อชิ้นนี้ได้คนละ ${TRAVEL.perChar} ชิ้นต่อรอบ`);
      qty = int(qty, 1, lim); if (!qty) return NO('จำนวนไม่ถูกต้อง');
      const cost = s.price * qty;
      if (c.gold < cost) return NO(`เงินไม่พอ (ต้องใช้ ฿${fmt(cost)})`);
      c.gold -= cost; addItem(c, id, qty, false); s.qty -= qty; mine[id] = (mine[id] || 0) + qty;
      if (s.price >= 1e6) say(`✨ ${c.name} ซื้อ ${ITEMS[id].nameTh} จากพ่อค้าเร่แล้ว!`, '🛺 พ่อค้าเร่');
      io.emit('mk:travel', travelView());
      return OK(`ซื้อ ${ITEMS[id].nameTh} x${qty} แล้ว (-฿${fmt(cost)})`);
    },
  };
  const WRITES = new Set(['list', 'cancel', 'buy', 'order', 'orderCancel', 'fill', 'claim', 'travelBuy']);

  // ---------------- พ่อค้าเร่ ----------------
  function travelOpen(now = Date.now()) {
    const pool = [...TRAVEL_STOCK], stock = [];
    while (stock.length < TRAVEL.picks && pool.length) {
      let r = Math.random() * pool.reduce((a, s) => a + s.w, 0), i = 0;
      while ((r -= pool[i].w) > 0) i++;
      const [s] = pool.splice(i, 1); stock.push({ id: s.id, qty: s.qty, max: s.qty, price: s.price });
    }
    Object.assign(S.travel, { active: true, spot: Math.floor(Math.random() * TRAVEL_SPOTS.length), until: now + TRAVEL.stayMin * 60e3, stock, bought: {}, warned: false });
    say(`🛺 ${TRAVEL.name} มาตั้งร้านที่${TRAVEL_SPOTS[S.travel.spot].th} อยู่ ${TRAVEL.stayMin} นาที · ของหายากมีจำนวนจำกัด!`, '🛺 พ่อค้าเร่');
    io.emit('mk:travel', travelView()); dirty();
  }
  function travelClose(now = Date.now()) {
    S.travel = { active: false, next: now + rand(...TRAVEL.everyMin) * 60e3 };
    say(`🛺 ${TRAVEL.name} เก็บร้านออกเดินทางแล้ว แล้วพบกันใหม่`, '🛺 พ่อค้าเร่');
    io.emit('mk:travel', travelView()); dirty();
  }

  // ---------------- ทุก 10 วิ: หมดอายุ + พ่อค้าเร่ ----------------
  setInterval(() => {
    if (!loaded) return;
    const now = Date.now(); let ch = false;
    for (const l of S.listings.filter((x) => x.exp <= now)) { const b = box(l.k); b.items[l.item] = (b.items[l.item] || 0) + l.qty; note(l.k, `⌛ แผง ${ITEMS[l.item]?.nameTh} หมดเวลา · ของกลับเข้ากล่องรับของที่นายห้างสำเภา`); ch = true; }
    for (const o of S.orders.filter((x) => x.exp <= now)) { box(o.k).gold += o.price * o.qty; note(o.k, `⌛ ป้ายรับซื้อ ${ITEMS[o.item]?.nameTh} หมดเวลา · คืนมัดจำเข้ากล่องรับของ`); ch = true; }
    if (ch) { S.listings = S.listings.filter((x) => x.exp > now); S.orders = S.orders.filter((x) => x.exp > now); dirty(); }
    const t = S.travel;
    if (!t.active && now >= t.next) travelOpen(now);
    else if (t.active && now >= t.until) travelClose(now);
    else if (t.active && !t.warned && t.until - now <= TRAVEL.warnMin * 60e3) { t.warned = true; say(`🛺 ${TRAVEL.name} จะเก็บร้านในอีก ${TRAVEL.warnMin} นาที!`, '🛺 พ่อค้าเร่'); }
  }, 10000);

  return {
    flush,
    onConnection(socket) {
      socket.emit('mk:travel', travelView());
      socket.on('mk', (d = {}, ack) => {
        const done = typeof ack === 'function' ? ack : () => {};
        const p = players.get(socket.id);
        if (!p) return done({ r: NO('ยังไม่ได้เข้าเกม') });
        if (!loaded) return done({ r: NO('ตลาดกำลังเปิด ลองใหม่อีกครั้ง') });
        const op = String(d.op || ''), fn = Object.hasOwn(OPS, op) ? OPS[op] : null;
        if (!fn) return done({ r: NO('คำสั่งไม่ถูกต้อง') });
        const now = Date.now();
        if (now - (p.mkT || 0) > 1000) { p.mkT = now; p.mkN = 0; }
        if (++p.mkN > 12) return done({ r: NO('ทำรายการถี่เกินไป') });
        if (WRITES.has(op) && (p.dead || p.tradeId)) return done({ r: NO(p.dead ? 'ตายอยู่ – รอฟื้นก่อน' : 'กำลังเทรดอยู่') });
        const c = p.save, r = fn(p, c, d) || NO('');
        if (WRITES.has(op) && r.ok) { refresh(p); dirty(); persist(p); }
        done({ r, v: view(p), t: travelView(), s: WRITES.has(op) ? packChar(c) : undefined });
      });
    },
    gm(cmd) {
      if (cmd === 'close') { if (S.travel.active) travelClose(); return 'พ่อค้าเร่เก็บร้านแล้ว'; }
      if (S.travel.active) travelClose();
      travelOpen(); return `พ่อค้าเร่มาที่${TRAVEL_SPOTS[S.travel.spot].th}`;
    },
    /** GM ดูสรุปตลาด */
    stats: () => ({ listings: S.listings.length, orders: S.orders.length, boxes: Object.keys(S.box).length, travel: S.travel.active }),
    _S: S, _sell: sellPrice,
  };
}
