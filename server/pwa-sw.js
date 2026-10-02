// ============================================================
//  Service Worker (PWA) — server เสิร์ฟที่ /sw.js แล้วใส่รุ่นตาม commit ที่ deploy
//  ▸ ภาพ/เสียง /assets: ใช้ของในเครื่องตลอดรุ่นนี้ (ไม่ถาม server ซ้ำ) · deploy ใหม่ = เช็คใหม่ครั้งเดียว (304 ถูก) แล้วเก็บต่อ
//  ▸ โค้ด/HTML/JSON: ดึงจาก server ก่อนเสมอ (ให้ตรงกับ server รุ่นปัจจุบัน) · เน็ตหลุด → ใช้ของในเครื่องแทน
//  ▸ ไม่แตะ /socket.io /api และคำขอที่ไม่ใช่ GET
// ============================================================
const V = '__VERSION__';
const ASSETS = `tn-assets-${V}`, CODE = `tn-code-${V}`;
const MEDIA = /\.(png|webp|jpe?g|gif|mp3|ogg|wav)$/i;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('tn-') && k !== ASSETS && k !== CODE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/socket.io') || url.pathname.startsWith('/api/') || url.pathname === '/sw.js') return;
  if ((url.pathname.startsWith('/assets/') && MEDIA.test(url.pathname)) || url.pathname.startsWith('/vendor/')) e.respondWith(cacheFirst(req));
  else e.respondWith(networkFirst(req));
});

/** ภาพ/เสียง: มีในแคชรุ่นนี้ → ใช้เลย · ไม่มี → ถาม server แบบตรวจซ้ำ (ได้ 304 ถ้าไม่เปลี่ยน) แล้วเก็บ */
async function cacheFirst(req) {
  const c = await caches.open(ASSETS);
  const hit = await c.match(req, { ignoreSearch: false });
  if (hit) return hit;
  const res = await fetch(req, { cache: 'no-cache' });
  if (res.ok && res.type === 'basic') c.put(req, res.clone());
  return res;
}

/** โค้ด/หน้าเว็บ: เอาของใหม่จาก server ก่อน · ล่ม/ออฟไลน์ → ของในแคช */
async function networkFirst(req) {
  const c = await caches.open(CODE);
  try {
    const res = await fetch(req);
    if (res.ok && res.type === 'basic') c.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await c.match(req) || (req.mode === 'navigate' ? await c.match('/') : null);
    if (hit) return hit;
    throw err;
  }
}
