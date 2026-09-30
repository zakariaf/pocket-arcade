// names.mjs: name-case helpers and the naming data (assets/naming-rules.json).

import { readFileSync } from 'node:fs';

// This file sits in scripts/lib/; the data sits in the skill's assets/ folder.
const SCRIPTS_DIR = new URL('..', import.meta.url);
export const RULES = JSON.parse(readFileSync(new URL('../assets/naming-rules.json', SCRIPTS_DIR), 'utf8'));

export const KEBAB = new RegExp(RULES.kebabSegment);
export const TEST_ID = new RegExp(RULES.testId);
export const I18N_KEY = new RegExp(RULES.i18nKey);
export const BUNDLE_ID = new RegExp(RULES.bundleId);
export const NPM_SCRIPT = new RegExp(RULES.npmScript);
export const ENV_VAR = new RegExp(RULES.envVar);
export const TEST_TITLE = new RegExp(RULES.testTitle);

/** 'use-save-game' -> 'useSaveGame' */
export function camelFromKebab(kebab) {
  return kebab.replace(/-([a-z0-9])/g, (_, ch) => ch.toUpperCase());
}

/** 'level-tile' -> 'LevelTile' */
export function pascalFromKebab(kebab) {
  const camel = camelFromKebab(kebab);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

/** 'AdsPort' -> 'ads-port', 'SqlDriver' -> 'sql-driver' */
export function kebabFromPascal(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

/** Base name without the directory and every extension: 'apply-move.test.ts' -> 'apply-move'. */
export function stem(fileName) {
  return fileName.split('/').pop().split('.')[0];
}

export const isUpperSnake = (name) => /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/.test(name);
export const isPascal = (name) => /^[A-Z][A-Za-z0-9]*$/.test(name);
export const isCamel = (name) => /^[a-z][A-Za-z0-9]*$/.test(name);

/** True when a name has a run of 3+ capitals, like SQLDriver or isRTL (acronyms are words). */
export function hasAcronymRun(name) {
  if (isUpperSnake(name)) return false;
  return /[A-Z]{3,}/.test(name.replace(/^_+/, ''));
}

/** A boolean name starts with a prefix (isReady, hasHint) or, in UPPER_CASE, with IS_, HAS_... */
export function hasBooleanPrefix(name) {
  const bare = name.replace(/^_+/, '');
  return RULES.booleanPrefixes.some((prefix) => new RegExp(`^${prefix}[A-Z0-9]`).test(bare) || bare.startsWith(`${prefix.toUpperCase()}_`));
}
