#!/usr/bin/env node
// check-app-art.mjs: proves each app's generated icon and splash PNGs meet Apple's rules and the
// Toybox layout: 1024 x 1024, light opaque and full bleed, dark with a transparent background,
// tinted grayscale and opaque, splash logos on transparency, and every glyph inside its safe area.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/check-app-art.mjs [repo-root] [--app <game-id>]

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createReporter, fail, maskComments, parseArgs, requireDir, run } from './check-lib.mjs';
import { readPng } from './lib/png.mjs';

const SPEC = {
  name: 'check-app-art',
  summary: 'Checks apps/<game>/assets/generated: the app icon (light, dark, tinted) and splash logos written by render-art.ts, and that the Expo config uses them.',
  usage: '[options] [repo-root]',
  options: {
    app: { type: 'string', multiple: true, value: 'game-id', help: 'Check only this app (default: every Expo app in apps/)' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules:',
    '  art-missing        a generated PNG is missing',
    '  art-format         not a readable 8-bit PNG, or not 1024 x 1024',
    '  art-light-opaque   icon-light.png has transparent pixels (Expo would flatten them onto white)',
    '  art-dark-clear     icon-dark.png has no transparent background',
    '  art-tinted-gray    icon-tinted.png is not grayscale, or not opaque',
    '  art-splash-clear   a splash logo has no transparent background',
    '  art-safe-area      the glyph leaves the central 62 % (icons) or touches the edge (splash)',
    '  art-unwired        withShell does not end in withGameArt(), splash-grounds.ts lacks the game, or expo-splash-screen is not a dependency',
    '',
    'Regenerate with: node packages/tooling/src/art/render-art.ts --app <game-id>',
  ].join('\n'),
};

const SIZE = 1024;
const FILES = ['icon-light.png', 'icon-dark.png', 'icon-tinted.png', 'splash-logo.png', 'splash-logo-dark.png'];
/** Glyph area: the central 62 % plus 1 % for anti-aliasing and the die-cut ring's edge. */
const SAFE = 0.64;
/** Colour distance (0-255 max channel) that counts as "not background". */
const INK_DELTA = 24;
const REGENERATE = (id) => `Run: node packages/tooling/src/art/render-art.ts --app ${id}, look at the PNGs, commit them.`;

function expoApps(root) {
  const appsDir = join(root, 'apps');
  if (!existsSync(appsDir)) return [];
  return readdirSync(appsDir).filter((id) => existsSync(join(appsDir, id, 'app.config.ts')) || existsSync(join(appsDir, id, 'app.json'))).sort();
}

function pixel(img, x, y) {
  const at = (y * img.width + x) * 4;
  return [img.rgba[at], img.rgba[at + 1], img.rgba[at + 2], img.rgba[at + 3]];
}

/** Bounding box of the pixels that differ from the background (by colour or by alpha). */
function contentBox(img, isContent) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let y = 0; y < img.height; y += 1) {
    for (let x = 0; x < img.width; x += 1) {
      if (!isContent(pixel(img, x, y))) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}

function differsFrom(background) {
  return (p) => Math.max(Math.abs(p[0] - background[0]), Math.abs(p[1] - background[1]), Math.abs(p[2] - background[2])) > INK_DELTA;
}

function checkSafeArea(report, { file, img, isContent, safe, id }) {
  const box = contentBox(img, isContent);
  if (box === null) {
    report.problem({ file, rule: 'art-safe-area', message: 'the image is empty (no glyph)', fix: REGENERATE(id) });
    return;
  }
  const lo = Math.floor((img.width * (1 - safe)) / 2);
  const hi = Math.ceil(img.width - lo);
  if (box.minX < lo || box.minY < lo || box.maxX >= hi || box.maxY >= hi) {
    report.problem({ file, rule: 'art-safe-area', message: `glyph spans ${box.minX},${box.minY} to ${box.maxX},${box.maxY}; the safe area is ${lo}..${hi - 1}`, fix: `Keep the glyph inside the central ${Math.round(safe * 100)} % (render-art.ts GLYPH), then regenerate.` });
  }
}

function isOpaque(img) {
  for (let i = 3; i < img.rgba.length; i += 4) if (img.rgba[i] !== 255) return false;
  return true;
}

function isGray(img) {
  for (let i = 0; i < img.rgba.length; i += 4) {
    const [r, g, b] = [img.rgba[i], img.rgba[i + 1], img.rgba[i + 2]];
    if (Math.abs(r - g) > 1 || Math.abs(g - b) > 1) return false;
  }
  return true;
}

function cornersClear(img) {
  const last = img.width - 1;
  return [[0, 0], [last, 0], [0, last], [last, last]].every(([x, y]) => pixel(img, x, y)[3] === 0);
}

function checkOne(report, id, name, img) {
  const file = `apps/${id}/assets/generated/${name}`;
  if (name === 'icon-light.png') {
    if (!isOpaque(img)) report.problem({ file, rule: 'art-light-opaque', message: 'the light icon has transparent pixels', fix: 'Draw a full-bleed background (the accent) first; iOS masks the corners itself.' });
    checkSafeArea(report, { file, img, isContent: differsFrom(pixel(img, 0, 0)), safe: SAFE, id });
  } else if (name === 'icon-dark.png') {
    if (!cornersClear(img)) report.problem({ file, rule: 'art-dark-clear', message: 'the dark icon has no transparent background', fix: 'Leave the background transparent; iOS draws the dark backdrop.' });
    checkSafeArea(report, { file, img, isContent: (p) => p[3] > 0, safe: SAFE, id });
  } else if (name === 'icon-tinted.png') {
    if (!isGray(img) || !isOpaque(img)) report.problem({ file, rule: 'art-tinted-gray', message: 'the tinted icon must be opaque grayscale', fix: 'Render it through the luma colour filter over the dark ground (render-art.ts GRAYSCALE).' });
    checkSafeArea(report, { file, img, isContent: differsFrom(pixel(img, 0, 0)), safe: SAFE, id });
  } else {
    if (!cornersClear(img)) report.problem({ file, rule: 'art-splash-clear', message: 'the splash logo has no transparent background', fix: 'The splash plugin paints the ground; the logo PNG must be transparent around the tile.' });
    checkSafeArea(report, { file, img, isContent: (p) => p[3] > 0, safe: 0.99, id });
  }
}

const CONFIG_DIR = 'packages/shell/src/config';
const GROUNDS_FILE = `${CONFIG_DIR}/splash-grounds.ts`;

/** withShell must end in withGameArt(), the game needs its splash grounds, and the app the splash plugin. */
function checkWiring(report, root, id) {
  const isExpoApp = ['app.config.ts', 'app.json'].some((name) => existsSync(join(root, 'apps', id, name)));
  if (!isExpoApp) return;
  const configDir = join(root, CONFIG_DIR);
  const composers = existsSync(configDir)
    ? readdirSync(configDir).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    : [];
  const callsArt = composers.some((name) => {
    const text = maskComments(readFileSync(join(configDir, name), 'utf8')).replace(/function\s+withGameArt\s*\(/g, '');
    return /\bwithGameArt\s*\(/.test(text);
  });
  if (!callsArt) {
    report.problem({ file: `${CONFIG_DIR}/with-shell.ts`, rule: 'art-unwired', message: 'withShell does not add the generated icon and splash', fix: 'End withShell with return withGameArt({ ...the composed config }, game.id) (references/app-icon-and-splash.md); never edit app.config.ts.' });
  }
  const grounds = existsSync(join(root, GROUNDS_FILE)) ? readFileSync(join(root, GROUNDS_FILE), 'utf8') : '';
  const escaped = id.replace(/[-]/g, '\\-');
  if (!new RegExp(`(['"]?)${escaped}\\1\\s*:\\s*\\{\\s*light:\\s*'#[0-9A-Fa-f]{6}'`).test(grounds)) {
    report.problem({ file: GROUNDS_FILE, rule: 'art-unwired', message: `no splash grounds for ${id}`, fix: REGENERATE(id) });
  }
  const pkgFile = `apps/${id}/package.json`;
  let pkg = {};
  try {
    pkg = JSON.parse(readFileSync(join(root, pkgFile), 'utf8'));
  } catch {
    // A missing or unreadable package.json is reported below as a missing dependency.
  }
  if (!pkg.dependencies?.['expo-splash-screen']) {
    report.problem({ file: pkgFile, rule: 'art-unwired', message: 'expo-splash-screen is not a dependency of the app', fix: `Run: cd apps/${id} && npx expo install expo-splash-screen` });
  }
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'app repo root');
  const apps = options.app.length > 0 ? options.app : expoApps(root);
  if (apps.length === 0) fail(`nothing to check: no Expo app (apps/<id>/app.config.ts) under ${root}`, 'Run from the app repo root, or pass --app <game-id>.');
  const report = createReporter({ name: 'check-app-art', json: options.json });
  let checked = 0;
  for (const id of apps) {
    checkWiring(report, root, id);
    for (const name of FILES) {
      const file = `apps/${id}/assets/generated/${name}`;
      checked += 1;
      if (!existsSync(join(root, file))) {
        report.problem({ file, rule: 'art-missing', message: 'generated art is missing', fix: REGENERATE(id) });
        continue;
      }
      let img;
      try {
        img = readPng(readFileSync(join(root, file)));
      } catch (error) {
        report.problem({ file, rule: 'art-format', message: error.message, fix: REGENERATE(id) });
        continue;
      }
      if (img.width !== SIZE || img.height !== SIZE) {
        report.problem({ file, rule: 'art-format', message: `${img.width} x ${img.height}, must be 1024 x 1024`, fix: REGENERATE(id) });
        continue;
      }
      checkOne(report, id, name, img);
    }
  }
  return report.finish({ checked, unit: 'images' });
});
