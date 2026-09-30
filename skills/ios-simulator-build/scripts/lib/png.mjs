// png.mjs: decodes 8-bit RGB/RGBA non-interlaced PNGs (what `xcrun simctl io screenshot` writes)
// with node:zlib, and measures how much of an area is one colour. Zero dependencies.
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

import { fail } from '../check-lib.mjs';

const SIGNATURE = '89504e470d0a1a0a';
const CHANNELS = { 2: 3, 6: 4 }; // colour type -> channels (RGB, RGBA)

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function unfilter(raw, width, height, bpp) {
  const stride = width * bpp;
  const out = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const left = x >= bpp ? out[dst + x - bpp] : 0;
      const up = y > 0 ? out[dst - stride + x] : 0;
      const upLeft = x >= bpp && y > 0 ? out[dst - stride + x - bpp] : 0;
      const value = raw[src + x];
      let predicted = 0;
      if (filter === 1) predicted = left;
      else if (filter === 2) predicted = up;
      else if (filter === 3) predicted = (left + up) >> 1;
      else if (filter === 4) predicted = paeth(left, up, upLeft);
      else if (filter !== 0) fail(`unknown PNG filter ${filter} on row ${y}`, 'The file is corrupt; take the screenshot again.');
      out[dst + x] = (value + predicted) & 0xff;
    }
  }
  return out;
}

/** Decode a PNG file into { width, height, channels, pixels }. */
export function readPng(path) {
  const buffer = readFileSync(path);
  if (buffer.subarray(0, 8).toString('hex') !== SIGNATURE) fail(`${path} is not a PNG file`, 'Pass the PNG that xcrun simctl io <udid> screenshot wrote.');
  let offset = 8;
  let header = null;
  const data = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('latin1');
    const chunk = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') header = { width: chunk.readUInt32BE(0), height: chunk.readUInt32BE(4), depth: chunk[8], colorType: chunk[9], interlace: chunk[12] };
    else if (type === 'IDAT') data.push(chunk);
    else if (type === 'IEND') break;
    offset += 12 + length;
  }
  if (!header) fail(`${path} has no IHDR chunk`, 'Take the screenshot again.');
  const channels = CHANNELS[header.colorType];
  if (header.depth !== 8 || !channels || header.interlace !== 0) {
    fail(`${path}: only 8-bit RGB/RGBA non-interlaced PNGs are supported (depth ${header.depth}, colour type ${header.colorType}, interlace ${header.interlace})`, 'Use the PNG straight from xcrun simctl io screenshot.');
  }
  const pixels = unfilter(inflateSync(Buffer.concat(data)), header.width, header.height, channels);
  return { width: header.width, height: header.height, channels, pixels };
}

/**
 * Share of pixels in rows [top, bottom) that have the most common colour (alpha ignored).
 * Samples every `step`-th pixel, which is plenty for a whole-screen verdict.
 */
export function dominantColour(image, { top = 0, bottom = image.height, step = 3 } = {}) {
  const counts = new Map();
  let total = 0;
  for (let y = top; y < bottom; y += step) {
    for (let x = 0; x < image.width; x += step) {
      const i = (y * image.width + x) * image.channels;
      const key = (image.pixels[i] << 16) | (image.pixels[i + 1] << 8) | image.pixels[i + 2];
      counts.set(key, (counts.get(key) ?? 0) + 1);
      total += 1;
    }
  }
  let bestKey = 0;
  let best = 0;
  for (const [key, count] of counts) {
    if (count > best) {
      best = count;
      bestKey = key;
    }
  }
  const hex = `#${bestKey.toString(16).padStart(6, '0').toUpperCase()}`;
  return { hex, share: total === 0 ? 0 : best / total, distinct: counts.size };
}

/** A light, nearly grey pixel (a light-mode iOS notification banner), channels 0-255. */
function isLightGrey(image, x, y) {
  const i = (y * image.width + x) * image.channels;
  const r = image.pixels[i];
  const g = image.pixels[i + 1];
  const b = image.pixels[i + 2];
  return Math.min(r, g, b) >= 215 && Math.max(r, g, b) - Math.min(r, g, b) <= 24;
}

/**
 * Rows in the top band that look like a light system banner (a notification drawn over the app):
 * at least 97% of the row between 2.5% and 97.5% of the width is light grey, while the thin strips
 * at both edges (0.6% to 1.2% from each side, outside the banner's 8 pt inset) are not. A heuristic:
 * an app's own full-width light bar fails the edge test, a card with content fails the 97% test.
 */
export function lightBannerRows(image, { top = Math.round(image.height * 0.045), bottom = Math.round(image.height * 0.17) } = {}) {
  const innerFrom = Math.round(image.width * 0.025);
  const innerTo = Math.round(image.width * 0.975);
  const edges = [Math.round(image.width * 0.006), Math.round(image.width * 0.012)];
  let rows = 0;
  for (let y = top; y < bottom; y += 1) {
    let light = 0;
    let total = 0;
    for (let x = innerFrom; x < innerTo; x += 2) {
      total += 1;
      if (isLightGrey(image, x, y)) light += 1;
    }
    if (light / total < 0.97) continue;
    const isEdgeLight = edges.some((x) => isLightGrey(image, x, y) || isLightGrey(image, image.width - 1 - x, y));
    if (!isEdgeLight) rows += 1;
  }
  return rows;
}
