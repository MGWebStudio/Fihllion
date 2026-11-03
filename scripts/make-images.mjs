// Draws the favicon, home screen icon and link preview image from the game's own pixel art.
//   node scripts/make-images.mjs
import { deflateSync, crc32 } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function parseColor(text) {
  if (text.startsWith('#')) {
    let hex = text.slice(1);
    if (hex.length === 3) hex = [...hex].map((c) => c + c).join('');
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16), 1];
  }
  const parts = text.match(/[\d.]+/g).map(Number);
  return [parts[0], parts[1], parts[2], parts[3] ?? 1];
}

// Just enough of the canvas API to run the sprite code outside a browser.
class Canvas {
  constructor(width = 1, height = 1) {
    this.w = width;
    this.h = height;
    this.px = new Uint8ClampedArray(width * height * 4);
  }

  get width() { return this.w; }
  set width(value) { this.w = value; this.px = new Uint8ClampedArray(value * this.h * 4); }
  get height() { return this.h; }
  set height(value) { this.h = value; this.px = new Uint8ClampedArray(this.w * value * 4); }

  blend(x, y, r, g, b, a) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || a <= 0) return;
    const i = (y * this.w + x) * 4;
    const under = this.px[i + 3] / 255;
    const out = a + under * (1 - a);
    this.px[i] = (r * a + this.px[i] * under * (1 - a)) / out;
    this.px[i + 1] = (g * a + this.px[i + 1] * under * (1 - a)) / out;
    this.px[i + 2] = (b * a + this.px[i + 2] * under * (1 - a)) / out;
    this.px[i + 3] = out * 255;
  }

  getContext() {
    const canvas = this;
    return {
      fillStyle: '#000',
      fillRect(x, y, w, h) {
        const [r, g, b, a] = parseColor(this.fillStyle);
        for (let py = Math.round(y); py < Math.round(y + h); py += 1) {
          for (let px = Math.round(x); px < Math.round(x + w); px += 1) canvas.blend(px, py, r, g, b, a);
        }
      },
      clearRect() { canvas.px.fill(0); },
      drawImage(src, x, y, w = src.width, h = src.height) {
        for (let py = 0; py < h; py += 1) {
          for (let px = 0; px < w; px += 1) {
            const sx = Math.floor((px / w) * src.width);
            const sy = Math.floor((py / h) * src.height);
            const i = (sy * src.width + sx) * 4;
            canvas.blend(Math.round(x) + px, Math.round(y) + py, src.px[i], src.px[i + 1], src.px[i + 2], src.px[i + 3] / 255);
          }
        }
      },
    };
  }
}

globalThis.document = { createElement: () => new Canvas() };
const art = await import('../js/sprites.js');

function png(canvas) {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const size = Buffer.alloc(4);
    size.writeUInt32BE(data.length);
    const check = Buffer.alloc(4);
    check.writeUInt32BE(crc32(body));
    return Buffer.concat([size, body, check]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(canvas.w, 0);
  header.writeUInt32BE(canvas.h, 4);
  header.set([8, 6, 0, 0, 0], 8);
  const rows = Buffer.alloc((canvas.w * 4 + 1) * canvas.h);
  for (let y = 0; y < canvas.h; y += 1) {
    const start = y * (canvas.w * 4 + 1) + 1;
    rows.set(canvas.px.subarray(y * canvas.w * 4, (y + 1) * canvas.w * 4), start);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const lerp = (a, b, t) => Math.round(a + (b - a) * t);
function fill(canvas, top, bottom, from, to, step) {
  const ctx = canvas.getContext();
  for (let y = top; y < bottom; y += step) {
    const t = (y - top) / (bottom - top);
    ctx.fillStyle = `rgba(${lerp(from[0], to[0], t)},${lerp(from[1], to[1], t)},${lerp(from[2], to[2], t)},1)`;
    ctx.fillRect(0, y, canvas.w, step);
  }
}

function bubble(canvas, cx, cy, r, scale) {
  const ctx = canvas.getContext();
  ctx.fillStyle = 'rgba(226,250,255,.85)';
  for (let y = -r; y <= r; y += 1) {
    for (let x = -r; x <= r; x += 1) {
      const d = Math.hypot(x, y);
      if (d <= r + 0.3 && d > r - 0.9) ctx.fillRect(cx + x * scale, cy + y * scale, scale, scale);
    }
  }
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'assets');
mkdirSync(out, { recursive: true });
const fish = art.goldfish();

function icon(size, scale) {
  const canvas = new Canvas(size, size);
  fill(canvas, 0, size, [78, 204, 198], [14, 86, 122], Math.max(1, Math.round(size / 24)));
  canvas.getContext().drawImage(fish, Math.round((size - fish.width * scale) / 2), Math.round((size - fish.height * scale) / 2), fish.width * scale, fish.height * scale);
  return canvas;
}

writeFileSync(join(out, 'favicon.png'), png(icon(64, 2)));
writeFileSync(join(out, 'apple-touch-icon.png'), png(icon(180, 5)));

const og = new Canvas(1200, 630);
const ctx = og.getContext();
const surface = 372;
fill(og, 0, surface, [116, 203, 238], [255, 236, 200], 12);
fill(og, surface, 630, [52, 196, 190], [12, 60, 100], 12);
ctx.fillStyle = 'rgba(236,255,250,.9)';
ctx.fillRect(0, surface, 1200, 6);
const sun = art.sun();
ctx.drawImage(sun, 70, 40, sun.width * 3, sun.height * 3);
const logo = new Canvas();
const { artW, artH } = art.drawLogo(logo);
const logoScale = 15;
ctx.drawImage(logo, Math.round((1200 - artW * logoScale) / 2), 92, artW * logoScale, artH * logoScale);
const fishScale = 8;
ctx.drawImage(fish, Math.round((1200 - fish.width * fishScale) / 2), 408, fish.width * fishScale, fish.height * fishScale);
bubble(og, 780, 440, 5, 4);
bubble(og, 830, 395, 3, 4);
bubble(og, 755, 395, 2, 4);
writeFileSync(join(out, 'og.png'), png(og));
console.log('Wrote assets/favicon.png, assets/apple-touch-icon.png, assets/og.png');
