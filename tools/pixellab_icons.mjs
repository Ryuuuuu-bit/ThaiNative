// สร้างไอคอน UI ด้วย PixelLab (เรียก API ตรง · ใช้โควต้า subscription) → client/assets/icons/ui_<key>.png + ลงทะเบียน manifest
// ใช้: PIXELLAB_TOKEN=xxx node tools/pixellab_icons.mjs            (สร้างเฉพาะที่ยังไม่มีไฟล์)
//      PIXELLAB_TOKEN=xxx node tools/pixellab_icons.mjs --force    (สร้างใหม่ทั้งหมด)
// ▸ ภาพดิบเก็บที่ assets_src/pixellab/icons/ui_<key>.png ด้วย (ต้นฉบับ)
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const TOKEN = process.env.PIXELLAB_TOKEN;
if (!TOKEN) { console.error('ต้องตั้ง PIXELLAB_TOKEN'); process.exit(1); }
const FORCE = process.argv.includes('--force');

// ไอคอนที่อีโมจิในเกมยังไม่มีภาพ (EMO_ICON ใน client/js/systems/util.js ชี้ชื่อไว้แล้ว)
const STYLE = 'pixel art game UI icon, centered, bold readable silhouette, warm Thai fantasy RPG style';
const ICONS = {
  hourglass: 'golden hourglass with red glowing sand',
  anchor: 'dark iron ship anchor with golden rope',
  dove: 'white peace dove flying with olive branch',
  scale: 'golden balance scale with two pans',
  blood: 'one red liquid water droplet shape, teardrop, glossy highlight, simple object, no face, no skull',
  trap: 'open iron jaw trap device lying on the ground, metal spring hunting snare with saw-tooth jaws, object only, no animal',
  slow: 'cute green snail with spiral shell',
  'it:pla_kaewhim': 'small translucent glass-clear fish with faint blue shimmer',
  'it:kung_rung': 'rainbow colored river shrimp, seven color shell',
  'it:pla_khrai': 'golden featherback fish, long knife-shaped body, golden scales',
  'it:pla_takhian_thong': 'legendary shining pure gold carp fish with glowing aura, sparkles',
  'it:pla_lai_nak': 'dark green eel with golden naga serpent scale pattern',
  'it:hoi_muk': 'underwater pearl oyster shell slightly open showing a white pearl',
  'it:pla_ngoen_badan': 'silver deep water fish with glowing blue eyes',
  'it:pla_krahoe': 'legendary giant golden Siamese carp fish with naga crown fins, glowing aura',
  'it:pla_thep': 'celestial white fish with flowing silk-like fins, soft glow',
  'it:kung_kaew': 'transparent crystal shrimp glowing softly',
  'it:pla_suwan': 'shiny golden carp fish with long flowing fins, side view, fish only, no bird, no wings',
  'it:pla_thip': 'legendary divine fish made of glowing elixir water, rainbow aura',
  'it:pla_hin': 'stone scaled ancient fish, grey rock texture',
  'it:pu_sithan': 'golden sea crab with shiny golden shell',
  'it:pla_nam_khaeng': 'ice crystal fish, frosty blue translucent body',
  'it:pla_anon': 'legendary colossal cosmic whale fish carrying a mountain on its back, mythical, glowing',
  'it:junk_coin': 'old bronze Chinese trade coin with square hole in the middle, junk ship emblem, slightly worn',   // เบี้ยสำเภา (ไอเทม)
};

async function call(name, args) {
  const r = await fetch('https://api.pixellab.ai/mcp', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name, arguments: args } }),
  });
  const txt = await r.text();
  const line = txt.split('\n').find((l) => l.startsWith('data: '));
  const msg = JSON.parse(line ? line.slice(6) : txt);
  if (msg.error) throw new Error(JSON.stringify(msg.error));
  return msg.result;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const outDir = path.join(ROOT, 'client/assets/icons'), srcDir = path.join(ROOT, 'assets_src/pixellab/icons');
fs.mkdirSync(srcDir, { recursive: true });
const fileKey = (k) => (k.startsWith('it:') ? `it_${k.slice(3)}` : `ui_${k}`);   // ไอคอนไอเทม it:<id> · ไอคอน UI ปกติ ui_<key>
const todo = Object.entries(ICONS).filter(([k]) => FORCE || !fs.existsSync(path.join(outDir, `${fileKey(k)}.png`)));
console.log('จะสร้าง', todo.length, 'ไอคอน:', todo.map(([k]) => k).join(' '));

const jobs = [];
for (const [key, desc] of todo) {
  let res, id;
  for (let tryN = 0; tryN < 40 && !id; tryN++) {                               // โควต้างานพร้อมกันเต็ม (20 งาน) → รอแล้วลองใหม่
    res = await call('create_image_pixflux', { description: `${desc}, ${STYLE}`, width: 48, height: 48, no_background: true, outline: 'single color black outline', shading: 'medium shading', detail: 'highly detailed' });
    id = /job_id:\s*([0-9a-f-]+)/.exec(res.content?.[0]?.text || '')?.[1];
    if (!id && /rate limit/i.test(res.content?.[0]?.text || '')) { console.log('⏳ คิวเต็ม รอ 15 วิ…', key); await sleep(15000); } else break;
  }
  if (!id) { console.error('สร้างไม่ได้', key, res.content?.[0]?.text); continue; }
  jobs.push({ key, id });
}

const done = {};
for (let round = 0; round < 40 && Object.keys(done).length < jobs.length; round++) {
  await sleep(6000);
  for (const j of jobs) {
    if (done[j.key]) continue;
    const res = await call('get_image', { job_id: j.id });
    const img = (res.content || []).find((c) => c.type === 'image');
    const text = (res.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
    if (/fail|error/i.test(text) && !img) { console.error('ล้มเหลว', j.key, text.slice(0, 200)); done[j.key] = 'fail'; continue; }
    if (!img) continue;
    const buf = Buffer.from(img.data, 'base64');
    fs.writeFileSync(path.join(srcDir, `${fileKey(j.key)}.png`), buf);
    fs.writeFileSync(path.join(outDir, `${fileKey(j.key)}.png`), buf);
    done[j.key] = 'ok';
    console.log('✔', j.key);
  }
}

// ลงทะเบียน manifest (icons)
const manP = path.join(ROOT, 'client/assets/manifest.json');
const man = JSON.parse(fs.readFileSync(manP, 'utf8'));
for (const [k, st] of Object.entries(done)) if (st === 'ok') man.icons[fileKey(k)] = `assets/icons/${fileKey(k)}.png`;
fs.writeFileSync(manP, JSON.stringify(man, null, 2) + '\n');
console.log('เสร็จ', Object.values(done).filter((s) => s === 'ok').length, '/', jobs.length);
