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
const todo = Object.entries(ICONS).filter(([k]) => FORCE || !fs.existsSync(path.join(outDir, `ui_${k}.png`)));
console.log('จะสร้าง', todo.length, 'ไอคอน:', todo.map(([k]) => k).join(' '));

const jobs = [];
for (const [key, desc] of todo) {
  const res = await call('create_image_pixflux', { description: `${desc}, ${STYLE}`, width: 48, height: 48, no_background: true, outline: 'single color black outline', shading: 'medium shading', detail: 'highly detailed' });
  const id = /job_id:\s*([0-9a-f-]+)/.exec(res.content?.[0]?.text || '')?.[1];
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
    fs.writeFileSync(path.join(srcDir, `ui_${j.key}.png`), buf);
    fs.writeFileSync(path.join(outDir, `ui_${j.key}.png`), buf);
    done[j.key] = 'ok';
    console.log('✔', j.key);
  }
}

// ลงทะเบียน manifest (icons)
const manP = path.join(ROOT, 'client/assets/manifest.json');
const man = JSON.parse(fs.readFileSync(manP, 'utf8'));
for (const [k, st] of Object.entries(done)) if (st === 'ok') man.icons[`ui_${k}`] = `assets/icons/ui_${k}.png`;
fs.writeFileSync(manP, JSON.stringify(man, null, 2) + '\n');
console.log('เสร็จ', Object.values(done).filter((s) => s === 'ok').length, '/', jobs.length);
