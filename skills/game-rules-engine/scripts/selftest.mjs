#!/usr/bin/env node
// selftest.mjs: proves check-rules-engine.mjs. The good repo is this skill's templates installed
// for the game id "tap-flip" with the catalog keys of assets/template-catalog-keys.json (so the
// templates themselves must pass); every
// tests/fixtures/check-rules-engine/bad-*/mutation.json plants one bug that must be reported.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs

import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runSelftest } from './check-lib.mjs';
import { assembleFixtures, instantiate } from './lib/assemble-fixtures.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const skill = join(here, '..');
const mutations = join(skill, 'tests', 'fixtures', 'check-rules-engine');
const wantsHelp = process.argv.includes('--help') || process.argv.includes('-h');

/** The four catalogs with the template's keys, as workflow step 3 adds them. */
function writeCatalogs(dir, gameId) {
  const keys = JSON.parse(readFileSync(join(skill, 'assets', 'template-catalog-keys.json'), 'utf8'));
  const folder = join(dir, 'apps', gameId, 'src', 'i18n');
  mkdirSync(folder, { recursive: true });
  for (const [lang, texts] of Object.entries(keys)) {
    const catalog = Object.fromEntries(Object.entries(texts).map(([key, text]) => [key.replace('__GAME_ID__', gameId), text]));
    writeFileSync(join(folder, `${lang}.json`), `${JSON.stringify(catalog, null, 2)}\n`);
  }
}

/** The root manifest after workflow step 2: fast-check pinned exactly (the kit's tests import it). */
const ROOT_MANIFEST = { name: 'e07-games', private: true, devDependencies: { 'fast-check': '4.10.2' } };

function buildGood(dir) {
  writeFileSync(join(dir, 'package.json'), `${JSON.stringify(ROOT_MANIFEST, null, 2)}\n`);
  cpSync(join(skill, 'templates', 'packages'), join(dir, 'packages'), { recursive: true });
  instantiate(join(skill, 'templates', 'apps', '__GAME_ID__'), join(dir, 'apps', 'tap-flip'), 'tap-flip');
  writeCatalogs(dir, 'tap-flip');
}

const generated = wantsHelp ? mutations : assembleFixtures(mutations, buildGood);
try {
  await runSelftest(import.meta.url, [
    { script: 'check-rules-engine.mjs', fixtures: generated, args: (dir) => [dir] },
  ]);
} finally {
  if (!wantsHelp) rmSync(generated, { recursive: true, force: true });
}
