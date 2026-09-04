/**
 * Generates a colour variant of each dinosaur illustration for every palette.
 *
 * The source art is flat-shaded: a black outline, one body colour, and a couple
 * of lighter and darker shades. Recolouring keeps each pixel's lightness and
 * only moves its hue and saturation, so the shading survives. Outlines, teeth
 * and eyes have almost no saturation and are left untouched.
 *
 * Run with:  node tools/recolour-dinos.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const IMAGES = path.join('assets', 'images');
const OUT_DIR = path.join(IMAGES, 'themed');

/** Mid-tone body colour of each palette, matching --dino-body in theme.css. */
const PALETTES = {
  green: '#5ea131',
  red: '#c4432f',
  blue: '#3b7bc4',
  purple: '#7a4fb5',
  pink: '#d45a8d',
};

/** Source file and the body colour the recolour is measured against. */
const DINOS = {
  stegosaurus: { file: 'stego.png', base: '#5ea131' },
  velociraptor: { file: 'velociraptor.png', base: '#fe860a' },
  brachiosaurus: { file: 'brachiosaurus.png', base: '#a8c6e2' },
  tyrannosaurus: { file: 'trex.png', base: '#94ad38' },
  triceratops: { file: 'triceratops.png', base: '#cf9e76' },
};

/** Below this saturation a pixel is outline, tooth or eye, so it is preserved. */
const NEUTRAL_S = 0.16;

// ------------------------------------------------------------------ png io

function decode(file) {
  const buf = fs.readFileSync(file);
  let off = 8;
  let head = null;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') head = { w: data.readUInt32BE(0), h: data.readUInt32BE(4), depth: data[8], ct: data[9] };
    if (type === 'IDAT') idat.push(data);
    if (type === 'IEND') break;
    off += 12 + len;
  }
  if (head.depth !== 8 || (head.ct !== 6 && head.ct !== 2)) {
    throw new Error(`${file}: expected 8-bit RGB or RGBA`);
  }

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const ch = head.ct === 6 ? 4 : 3;
  const stride = head.w * ch;
  const out = Buffer.alloc(head.h * stride);
  let pos = 0;
  for (let y = 0; y < head.h; y++) {
    const filter = raw[pos++];
    const line = raw.subarray(pos, pos + stride);
    pos += stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? out[y * stride + x - ch] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= ch && y > 0 ? out[(y - 1) * stride + x - ch] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      out[y * stride + x] = v & 255;
    }
  }
  return { w: head.w, h: head.h, ch, data: out };
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32 ? zlib.crc32(body) : crc32(body));
  return Buffer.concat([len, body, crc]);
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    let c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function encodeRGBA(w, h, data) {
  const stride = w * 4;
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ----------------------------------------------------------------- colour

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hue(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function hslToRgb(h, s, l) {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue(p, q, h + 1 / 3) * 255),
    Math.round(hue(p, q, h) * 255),
    Math.round(hue(p, q, h - 1 / 3) * 255),
  ];
}

function parseHex(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function recolour(img, baseHex, targetHex) {
  const [, baseS, baseL] = rgbToHsl(...parseHex(baseHex));
  const [targetH, targetS, targetL] = rgbToHsl(...parseHex(targetHex));
  // Sources differ in weight: the raptor is vivid, the brachiosaurus a pale
  // pastel. Shifting every pixel by the gap between the body tone and the
  // target keeps each drawing's own contrast while making the set consistent.
  const shiftL = targetL - baseL;
  const out = Buffer.alloc(img.w * img.h * 4);

  for (let i = 0, o = 0; i < img.data.length; i += img.ch, o += 4) {
    const r = img.data[i];
    const g = img.data[i + 1];
    const b = img.data[i + 2];
    const a = img.ch === 4 ? img.data[i + 3] : 255;

    const [, s, l] = rgbToHsl(r, g, b);
    if (s < NEUTRAL_S) {
      // Outline, teeth, eyes: leave exactly as drawn.
      out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = a;
      continue;
    }

    // Keep the pixel's own lightness so highlights and shadows survive, and
    // scale saturation by how saturated it was relative to the body colour.
    const s2 = Math.max(0, Math.min(1, targetS * (s / baseS)));
    const l2 = Math.max(0.06, Math.min(0.96, l + shiftL));
    const [nr, ng, nb] = hslToRgb(targetH, s2, l2);
    out[o] = nr; out[o + 1] = ng; out[o + 2] = nb; out[o + 3] = a;
  }
  return out;
}

// ------------------------------------------------------------------- run

fs.mkdirSync(OUT_DIR, { recursive: true });
let written = 0;

for (const [dino, { file, base }] of Object.entries(DINOS)) {
  const img = decode(path.join(IMAGES, file));
  for (const [palette, target] of Object.entries(PALETTES)) {
    const dest = path.join(OUT_DIR, `${dino}-${palette}.png`);
    if (dino === 'stegosaurus' && palette === 'green') {
      // Copied rather than regenerated so the original drawing is preserved
      // byte for byte in its own colour.
      fs.copyFileSync(path.join(IMAGES, file), dest);
    } else {
      fs.writeFileSync(dest, encodeRGBA(img.w, img.h, recolour(img, base, target)));
    }
    written++;
  }
  console.log(`${dino}: ${Object.keys(PALETTES).length} variants from ${file}`);
}

console.log(`\n${written} files written to ${OUT_DIR}`);
