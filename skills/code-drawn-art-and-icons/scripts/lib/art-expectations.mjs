// art-expectations.mjs: what the app repo's icon and logo data must hold, derived from this skill's
// Toybox token file (assets/toybox-tokens.json), plus a loader for the repo's TypeScript data modules.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { UsageError } from '../check-lib.mjs';

/** The skill folder: this file is scripts/lib/art-expectations.mjs. */
const SKILL_DIR = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

export function loadTokens() {
  return JSON.parse(readFileSync(join(SKILL_DIR, 'assets', 'toybox-tokens.json'), 'utf8'));
}

export const DIRECTIONAL = ['back', 'chevron', 'forward', 'undo'];
export const RATING_LAYERS = ['rating-fill', 'rating-edge', 'rating-edge-mini'];

/** The 44 glyphs of icon-layers.json: 41 Toybox icons plus the three rating-star layers. */
export function expectedGlyphs(tokens) {
  const glyphs = {};
  for (const [name, glyph] of Object.entries(tokens.icons.glyphs)) glyphs[name] = glyph.layers;
  const { d, on } = tokens.icons.rating;
  glyphs['rating-fill'] = [{ op: 'fill', fillRule: 'nonzero', d }];
  glyphs['rating-edge'] = [{ op: 'stroke', width: on.edge.width, cap: 'round', join: 'round', d }];
  glyphs['rating-edge-mini'] = [{ op: 'stroke', width: on.edge.widthMini, cap: 'round', join: 'round', d }];
  return glyphs;
}

/** Known game logos as LOGO_ART layers ({ role, d, rotate? }), keyed by app id (kebab-case). */
export function expectedLogos(tokens) {
  const out = {};
  for (const [key, layers] of Object.entries(tokens.logos.games)) {
    const id = key.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`);
    out[id] = layers.map((layer) => {
      const entry = { role: layer.role, d: layer.d };
      const m = layer.transform && /^rotate\((-?[\d.]+) ([\d.]+) ([\d.]+)\)$/.exec(layer.transform);
      if (m) entry.rotate = { deg: Number(m[1]), cx: Number(m[2]), cy: Number(m[3]) };
      return entry;
    });
  }
  return out;
}

export const LOGO_ROLES = ['p', 'w', 'w0', 'k', 'kl', 'pl'];

let warningsSilenced = false;

/** Import a TypeScript data module with Node's type stripping (Node 22.18+). */
export async function importTsModule(absPath) {
  if (!warningsSilenced) {
    warningsSilenced = true;
    process.removeAllListeners('warning');
    process.on('warning', (warning) => {
      if (warning.code === 'MODULE_TYPELESS_PACKAGE_JSON' || warning.name === 'ExperimentalWarning') return;
      console.error(`${warning.name}: ${warning.message}`);
    });
  }
  try {
    return { module: await import(pathToFileURL(absPath).href) };
  } catch (error) {
    if (error?.code === 'ERR_UNKNOWN_FILE_EXTENSION') {
      throw new UsageError(`Node ${process.versions.node} cannot load .ts files`, 'Use Node 22.18 or newer (type stripping is on by default there).');
    }
    return { error: String(error?.message ?? error).split('\n')[0] };
  }
}

/** Deep equality for JSON-like data; numbers compare within 1e-9. */
export function sameValue(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-9;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, i) => sameValue(item, b[i]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].every((key) => sameValue(a[key], b[key]));
  }
  return a === b;
}
