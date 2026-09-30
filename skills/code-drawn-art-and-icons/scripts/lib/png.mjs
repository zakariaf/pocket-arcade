// png.mjs: a minimal PNG reader (node:zlib only) for 8-bit grayscale, gray+alpha, RGB and RGBA
// images, non-interlaced: what Skia and most tools write. Returns RGBA pixels.

import { inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 };

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function unfilter(data, width, height, bpp) {
  const stride = width * bpp;
  const out = Buffer.alloc(stride * height);
  let at = 0;
  for (let y = 0; y < height; y += 1) {
    const type = data[at];
    at += 1;
    const row = y * stride;
    const prev = row - stride;
    for (let x = 0; x < stride; x += 1) {
      const raw = data[at + x];
      const left = x >= bpp ? out[row + x - bpp] : 0;
      const up = y > 0 ? out[prev + x] : 0;
      const upLeft = y > 0 && x >= bpp ? out[prev + x - bpp] : 0;
      let value;
      if (type === 0) value = raw;
      else if (type === 1) value = raw + left;
      else if (type === 2) value = raw + up;
      else if (type === 3) value = raw + Math.floor((left + up) / 2);
      else if (type === 4) value = raw + paeth(left, up, upLeft);
      else throw new Error(`unknown PNG filter ${type} in row ${y}`);
      out[row + x] = value & 0xff;
    }
    at += stride;
  }
  return out;
}

/**
 * Reads a PNG buffer. Returns { width, height, colorType, hasAlphaChannel, rgba } or throws an Error
 * saying which feature is unsupported.
 */
export function readPng(buffer) {
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG file');
  let at = 8;
  let header = null;
  const idat = [];
  while (at < buffer.length) {
    const length = buffer.readUInt32BE(at);
    const type = buffer.toString('ascii', at + 4, at + 8);
    const body = buffer.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      header = {
        width: body.readUInt32BE(0),
        height: body.readUInt32BE(4),
        bitDepth: body[8],
        colorType: body[9],
        interlace: body[12],
      };
    } else if (type === 'IDAT') {
      idat.push(body);
    } else if (type === 'IEND') {
      break;
    }
    at += 12 + length;
  }
  if (!header) throw new Error('PNG has no IHDR');
  const channels = CHANNELS[header.colorType];
  if (header.bitDepth !== 8 || channels === undefined || header.interlace !== 0) {
    throw new Error(`unsupported PNG (bit depth ${header.bitDepth}, colour type ${header.colorType}, interlace ${header.interlace})`);
  }
  const pixels = unfilter(inflateSync(Buffer.concat(idat)), header.width, header.height, channels);
  const rgba = Buffer.alloc(header.width * header.height * 4);
  for (let i = 0; i < header.width * header.height; i += 1) {
    const s = i * channels;
    const d = i * 4;
    if (channels === 1 || channels === 2) {
      rgba[d] = rgba[d + 1] = rgba[d + 2] = pixels[s];
      rgba[d + 3] = channels === 2 ? pixels[s + 1] : 255;
    } else {
      rgba[d] = pixels[s];
      rgba[d + 1] = pixels[s + 1];
      rgba[d + 2] = pixels[s + 2];
      rgba[d + 3] = channels === 4 ? pixels[s + 3] : 255;
    }
  }
  return { width: header.width, height: header.height, colorType: header.colorType, hasAlphaChannel: channels === 2 || channels === 4, rgba };
}
