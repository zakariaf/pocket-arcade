// Small image helpers on plain { width, height, data } RGBA images. pngjs is passed in (loaded at
// run time by deps.mjs), so this module has no package imports.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

import { fail } from '../check-lib.mjs';

export function readPng(PNG, path, what = 'PNG') {
  if (!existsSync(path)) fail(`${what} not found: ${path}`, 'Pass the right file, or create it first.');
  try {
    const png = PNG.sync.read(readFileSync(path));
    return { width: png.width, height: png.height, data: png.data };
  } catch (error) {
    return fail(`${what} ${path} is not a readable PNG: ${error.message}`, 'Recreate the file (lossless PNG only).');
  }
}

/**
 * Lossless PNG, as small as pngjs makes it. Opaque images are written as RGB. Flat UI screens
 * compress best with no row filter and the default deflate strategy: measured on the reference set,
 * a Home frame is 137 KB this way, 170 KB with adaptive filters and 199 KB with pngjs's defaults.
 */
export function encodePng(PNG, img) {
  let opaque = true;
  for (let i = 3; i < img.data.length; i += 4) {
    if (img.data[i] !== 255) {
      opaque = false;
      break;
    }
  }
  const png = new PNG({ width: img.width, height: img.height });
  img.data.copy ? img.data.copy(png.data) : png.data.set(img.data);
  return PNG.sync.write(png, { colorType: opaque ? 2 : 6, inputHasAlpha: true, deflateLevel: 9, deflateStrategy: 0, filterType: 0 });
}

/** JSON with one array item per line: small on disk, still readable in a diff. */
export function compactJson(value) {
  const lines = ['{'];
  const entries = Object.entries(value);
  entries.forEach(([key, v], i) => {
    const comma = i < entries.length - 1 ? ',' : '';
    if (Array.isArray(v) && v.length > 0) {
      lines.push(`${JSON.stringify(key)}:[`);
      v.forEach((item, j) => lines.push(`${JSON.stringify(item)}${j < v.length - 1 ? ',' : ''}`));
      lines.push(`]${comma}`);
    } else lines.push(`${JSON.stringify(key)}:${JSON.stringify(v)}${comma}`);
  });
  lines.push('}');
  return `${lines.join('\n')}\n`;
}

export function writePng(PNG, path, img) {
  writeFileSync(path, encodePng(PNG, img));
}

export function blank(width, height, rgba = [0, 0, 0, 0]) {
  const data = Buffer.alloc(width * height * 4);
  if (rgba.some((v) => v !== 0)) for (let i = 0; i < data.length; i += 4) data.set(rgba, i);
  return { width, height, data };
}

/** Copy a rectangle (pixels); parts outside the source stay transparent black. */
export function crop(img, x, y, w, h) {
  const out = blank(w, h);
  for (let row = 0; row < h; row += 1) {
    const sy = y + row;
    if (sy < 0 || sy >= img.height) continue;
    const x0 = Math.max(0, x);
    const x1 = Math.min(img.width, x + w);
    if (x1 <= x0) continue;
    img.data.copy
      ? img.data.copy(out.data, (row * w + (x0 - x)) * 4, (sy * img.width + x0) * 4, (sy * img.width + x1) * 4)
      : out.data.set(img.data.subarray((sy * img.width + x0) * 4, (sy * img.width + x1) * 4), (row * w + (x0 - x)) * 4);
  }
  return out;
}

/** Paste src into dst at (x, y), clipped. */
export function blit(src, dst, x, y) {
  for (let row = 0; row < src.height; row += 1) {
    const dy = y + row;
    if (dy < 0 || dy >= dst.height) continue;
    const sx0 = Math.max(0, -x);
    const sx1 = Math.min(src.width, dst.width - x);
    if (sx1 <= sx0) continue;
    dst.data.set(src.data.subarray((row * src.width + sx0) * 4, (row * src.width + sx1) * 4), (dy * dst.width + x + sx0) * 4);
  }
}

/** Box-filter downscale by an integer factor (used for the 1x overview sheet). */
export function downscale(img, factor) {
  if (factor === 1) return img;
  const w = Math.floor(img.width / factor);
  const h = Math.floor(img.height / factor);
  const out = blank(w, h);
  const n = factor * factor;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let dy = 0; dy < factor; dy += 1) {
        let i = ((y * factor + dy) * img.width + x * factor) * 4;
        for (let dx = 0; dx < factor; dx += 1, i += 4) {
          r += img.data[i];
          g += img.data[i + 1];
          b += img.data[i + 2];
          a += img.data[i + 3];
        }
      }
      const o = (y * w + x) * 4;
      out.data[o] = Math.round(r / n);
      out.data[o + 1] = Math.round(g / n);
      out.data[o + 2] = Math.round(b / n);
      out.data[o + 3] = Math.round(a / n);
    }
  }
  return out;
}

/** Nearest-neighbour upscale by an integer factor. */
export function upscale(img, factor) {
  if (factor === 1) return img;
  const out = blank(img.width * factor, img.height * factor);
  for (let y = 0; y < out.height; y += 1) {
    for (let x = 0; x < out.width; x += 1) {
      const i = (Math.floor(y / factor) * img.width + Math.floor(x / factor)) * 4;
      out.data.set(img.data.subarray(i, i + 4), (y * out.width + x) * 4);
    }
  }
  return out;
}

/** Outline a rectangle (pixels) in a colour, t pixels thick, drawn outside the rectangle. */
export function outline(img, x, y, w, h, rgb, t = 4) {
  const put = (px, py) => {
    if (px < 0 || py < 0 || px >= img.width || py >= img.height) return;
    const i = (py * img.width + px) * 4;
    img.data[i] = rgb[0];
    img.data[i + 1] = rgb[1];
    img.data[i + 2] = rgb[2];
    img.data[i + 3] = 255;
  };
  for (let k = 1; k <= t; k += 1) {
    for (let px = x - k; px <= x + w - 1 + k; px += 1) {
      put(px, y - k);
      put(px, y + h - 1 + k);
    }
    for (let py = y - k; py <= y + h - 1 + k; py += 1) {
      put(x - k, py);
      put(x + w - 1 + k, py);
    }
  }
}

/** Fill a rectangle with a flat colour (clipped). */
export function fillRect(img, x, y, w, h, rgba) {
  for (let py = Math.max(0, y); py < Math.min(img.height, y + h); py += 1) {
    for (let px = Math.max(0, x); px < Math.min(img.width, x + w); px += 1) img.data.set(rgba, (py * img.width + px) * 4);
  }
}

export const hex = (rgb) => `#${rgb.slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
