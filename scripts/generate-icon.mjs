// Procedurally generate build/icon.png — a 512x512 grass-block-style icon
// with no external image dependencies.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const SIZE = 512;
const BORDER = 18;
const GRASS_TOP = '#10b981'; // emerald-500
const GRASS_RIM = '#34d399'; // emerald-400 — thin highlight strip
const DIRT = '#92400e'; // amber-800
const DIRT_DARK = '#7c2d12'; // amber-900 — pebble spots
const BORDER_COLOR = '#0a0a0a';

function hex(c) {
  const m = c.replace('#', '');
  return [parseInt(m.slice(0, 2), 16), parseInt(m.slice(2, 4), 16), parseInt(m.slice(4, 6), 16)];
}

const grassTop = hex(GRASS_TOP);
const grassRim = hex(GRASS_RIM);
const dirt = hex(DIRT);
const dirtDark = hex(DIRT_DARK);
const border = hex(BORDER_COLOR);

const buf = Buffer.alloc(SIZE * SIZE * 3);

function setPx(x, y, c) {
  const i = (y * SIZE + x) * 3;
  buf[i] = c[0];
  buf[i + 1] = c[1];
  buf[i + 2] = c[2];
}

// Background = dirt
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) setPx(x, y, dirt);
}

// Grass top half
const half = SIZE / 2;
for (let y = 0; y < half; y++) {
  for (let x = 0; x < SIZE; x++) setPx(x, y, grassTop);
}

// Highlight strip just under the top edge
for (let y = BORDER; y < BORDER + 14; y++) {
  for (let x = BORDER; x < SIZE - BORDER; x++) setPx(x, y, grassRim);
}

// Deterministic "pebbles" sprinkled in the dirt half
function rand(i) {
  let x = (i * 2654435761) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  return (x >>> 0) / 0x100000000;
}
for (let i = 0; i < 80; i++) {
  const cx = BORDER + 8 + Math.floor(rand(i * 2 + 1) * (SIZE - BORDER * 2 - 16));
  const cy = half + 8 + Math.floor(rand(i * 2 + 2) * (half - BORDER - 16));
  const r = 5 + Math.floor(rand(i * 2 + 3) * 6);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= r * r) setPx(cx + dx, cy + dy, dirtDark);
    }
  }
}

// Border on all sides
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    if (x < BORDER || x >= SIZE - BORDER || y < BORDER || y >= SIZE - BORDER) {
      setPx(x, y, border);
    }
  }
}

// PNG encoder.
function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // RGB
ihdr[10] = 0; // compression
ihdr[11] = 0; // filter
ihdr[12] = 0; // interlace

// Raw image: each row prefixed with filter byte 0.
const rowBytes = SIZE * 3 + 1;
const raw = Buffer.alloc(rowBytes * SIZE);
for (let y = 0; y < SIZE; y++) {
  raw[y * rowBytes] = 0;
  buf.copy(raw, y * rowBytes + 1, y * SIZE * 3, (y + 1) * SIZE * 3);
}
const idatData = zlib.deflateSync(raw);

const png = Buffer.concat([
  signature,
  chunk('IHDR', ihdr),
  chunk('IDAT', idatData),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = path.resolve('build/icon.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, png);
console.log('wrote', out, png.length, 'bytes');
