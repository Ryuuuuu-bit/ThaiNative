// ============================================================
//  ท่า PixelLab ของบอสผี → spritesheet 8 ทิศ (mob_gd_<บอส>) + manifest
//  ต้นทาง: client/assets/bosses/ghosts/<บอส>/anims/<ท่า>/<ทิศ>/<n>.png
//  ▸ ทุกท่าของบอสตัวเดียวกันใช้ขนาดเฟรมเท่ากัน (ใหญ่สุด) วางกลางเฟรม → ตัวไม่กระโดดตอนสลับท่า
//  ใช้: node tools/ghost_anim_sheets.mjs [hung|krasue|yat|pob ...]
// ============================================================
import fs from 'fs';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\\/g, '/');
const DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];

function decode(file) {
  const b = fs.readFileSync(file); let o = 8, w, h, bd, ct, pal, trns; const idat = [];
  while (o < b.length) {
    const len = b.readUInt32BE(o), type = b.toString('ascii', o + 4, o + 8), d = b.subarray(o + 8, o + 8 + len); o += 12 + len;
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bd = d[8]; ct = d[9]; if (d[12]) throw new Error('interlaced ' + file); }
    else if (type === 'PLTE') pal = d; else if (type === 'tRNS') trns = d; else if (type === 'IDAT') idat.push(d);
  }
  if (bd !== 8) throw new Error(`bitdepth ${bd} ${file}`);
  const ch = { 6: 4, 2: 3, 3: 1, 0: 1, 4: 2 }[ct], raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * ch, px = Buffer.alloc(w * h * ch);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), cur = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0, up = prev[i], c = i >= ch ? prev[i - ch] : 0;
      let v = line[i];
      if (f === 1) v += a; else if (f === 2) v += up; else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) { const p = a + up - c, pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
      cur[i] = v & 255;
    }
    cur.copy(px, y * stride); prev = cur;
  }
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    if (ct === 6) px.copy(rgba, i * 4, i * 4, i * 4 + 4);
    else if (ct === 2) { px.copy(rgba, i * 4, i * 3, i * 3 + 3); rgba[i * 4 + 3] = 255; }
    else if (ct === 3) { const k = px[i]; rgba[i * 4] = pal[k * 3]; rgba[i * 4 + 1] = pal[k * 3 + 1]; rgba[i * 4 + 2] = pal[k * 3 + 2]; rgba[i * 4 + 3] = trns && k < trns.length ? trns[k] : 255; }
    else if (ct === 0) { rgba.fill(px[i], i * 4, i * 4 + 3); rgba[i * 4 + 3] = 255; }
    else if (ct === 4) { rgba.fill(px[i * 2], i * 4, i * 4 + 3); rgba[i * 4 + 3] = px[i * 2 + 1]; }
  }
  return { w, h, rgba };
}

const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = (buf) => { let c = -1; for (const x of buf) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
function encode(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/** ชื่อท่าในเกม ← โฟลเดอร์ท่าจาก PixelLab (cast = ท่าร่ายทั่วไปของบอสตัวนั้น) */
const MAP = {
  hung: { idle: 'idle', walk: 'walk', attack: 'attack', cast: 'cast', die: 'death', execute: 'execute', noose: 'noose' },
  krasue: { idle: 'idle', walk: 'walk', attack: 'dive', cast: 'shriek', die: 'death', lash: 'lash' },
  yat: { idle: 'idle', walk: 'walk', attack: 'attack', cast: 'cast', die: 'death', crawl: 'crawl', stare: 'stare' },
  pob: { idle: 'idle', walk: 'walk', attack: 'attack', cast: 'tongue', die: 'death', tongue: 'tongue' },
};
const pngs = (dir) => fs.readdirSync(dir).filter((f) => f.endsWith('.png')).sort((a, b) => parseInt(a) - parseInt(b));

const mf = ROOT + 'client/assets/td/manifest.json', man = JSON.parse(fs.readFileSync(mf, 'utf8'));
for (const boss of process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(MAP)) {
  const SRC = ROOT + `client/assets/bosses/ghosts/${boss}/anims/`, OUT = ROOT + `client/assets/td/mob_gd_${boss}/`;
  fs.mkdirSync(OUT, { recursive: true });
  // ขนาดเฟรมใหญ่สุดของทุกท่า/ทุกทิศ
  let C = 0;
  for (const src of Object.values(MAP[boss])) for (const d of DIRS) { const b = fs.readFileSync(SRC + `${src}/${d}/0.png`); C = Math.max(C, b.readUInt32BE(16), b.readUInt32BE(20)); }
  const frames = {};
  for (const [anim, src] of Object.entries(MAP[boss])) {
    const n = Math.max(...DIRS.map((d) => pngs(SRC + `${src}/${d}`).length));
    const W = C * n, H = C * 8, out = Buffer.alloc(W * H * 4);
    DIRS.forEach((d, row) => {
      const list = pngs(SRC + `${src}/${d}`);
      for (let k = 0; k < n; k++) {
        const im = decode(SRC + `${src}/${d}/${list[Math.min(k, list.length - 1)]}`);
        const ox = Math.floor((C - im.w) / 2), oy = Math.floor((C - im.h) / 2);
        for (let y = 0; y < im.h; y++) im.rgba.copy(out, ((row * C + y + oy) * W + k * C + ox) * 4, y * im.w * 4, (y + 1) * im.w * 4);
      }
    });
    fs.writeFileSync(OUT + `${anim}.png`, encode(W, H, out));
    frames[anim] = n;
  }
  // ลบชีตท่าเก่าที่ไม่ได้ใช้แล้ว
  for (const f of fs.readdirSync(OUT)) if (f.endsWith('.png') && !(f.slice(0, -4) in frames)) fs.unlinkSync(OUT + f);
  man.sprites[`mob_gd_${boss}`] = { ...(man.sprites[`mob_gd_${boss}`] || {}), anims: Object.keys(frames), frames, frame: C, scale: man.sprites[`mob_gd_${boss}`]?.scale || 0.5 };
  console.log(boss, C + 'px', Object.entries(frames).map(([a, n]) => `${a}:${n}`).join(' '));
}
fs.writeFileSync(mf, JSON.stringify(man, null, 1));
console.log('manifest ok');
