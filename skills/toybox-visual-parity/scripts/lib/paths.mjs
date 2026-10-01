// Where this skill keeps its data. Every script resolves defaults from here, so the skill works
// from any install location (${CLAUDE_SKILL_DIR}, a symlink, or a copy).
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fail } from '../check-lib.mjs';

export const SCRIPTS_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
export const SKILL_DIR = dirname(SCRIPTS_DIR);
export const ASSETS_DIR = join(SKILL_DIR, 'assets');

export const DEFAULTS = Object.freeze({
  design: join(ASSETS_DIR, 'design', 'toybox.html'),
  map: join(ASSETS_DIR, 'screen-testids.json'),
  frames: join(ASSETS_DIR, 'frames.json'),
  device: join(ASSETS_DIR, 'device', 'iphone16pro.json'),
  reference: join(ASSETS_DIR, 'reference'),
});

/** Read and parse a JSON file, or stop with exit 2 naming the file. */
export function readJson(path, what = 'JSON file') {
  if (!existsSync(path)) fail(`${what} not found: ${path}`, `Pass the path to the ${what}.`);
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    return fail(`${what} ${path} is not valid JSON: ${error.message}`, 'Fix or regenerate the file.');
  }
}

/** The reference folder for one game, theme and language: assets/reference/<game>/<theme>-<lang>/. */
export function referenceDir(root, game, theme, lang) {
  return join(root, game, `${theme}-${lang}`);
}
