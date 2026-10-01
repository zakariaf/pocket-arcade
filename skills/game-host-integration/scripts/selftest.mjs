#!/usr/bin/env node
// selftest.mjs: proves check-game-host.mjs. The good repo is this skill's own files installed the
// way the workflow installs them: the game-host, composition-root and Tutorial templates, the
// Game-screen example, the app templates instantiated for "tap-flip" with the example catalogs, plus
// tests/fixtures/check-game-host/base (Tap Flip's rules, so the teaching script runs for real, and
// stand-ins for the files other skills build). So the templates and examples must pass. Every
// tests/fixtures/check-game-host/bad-*/mutation.json plants one bug that must be reported (a pass-*
// case a fact that must pass with its SKIP line). check-root-imports.mjs runs on this skill's own
// host-architecture.md and composition-root templates (good) and on planted copies.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs

import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runSelftest } from './check-lib.mjs';
import { assembleFixtures, instantiate } from './lib/assemble-fixtures.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const skill = join(here, '..');
const mutations = join(skill, 'tests', 'fixtures', 'check-game-host');
const wantsHelp = process.argv.includes('--help') || process.argv.includes('-h');

function buildGood(dir) {
  const copy = (from, to) => cpSync(join(skill, from), join(dir, to), { recursive: true });
  copy('templates/packages', 'packages');
  instantiate(join(skill, 'templates', 'apps', '__GAME_ID__'), join(dir, 'apps', 'tap-flip'), 'tap-flip');
  copy('examples/game-screen', 'packages/shell/src/screens/game');
  copy('examples/tap-flip/i18n', 'apps/tap-flip/src/i18n');
  copy('tests/fixtures/check-game-host/base', '.');
}

/** The root import table and the templates it describes, as check-root-imports reads them. */
function buildRootTable(dir) {
  mkdirSync(join(dir, 'references'), { recursive: true });
  cpSync(join(skill, 'references', 'host-architecture.md'), join(dir, 'references', 'host-architecture.md'));
  cpSync(join(skill, 'templates', 'packages', 'shell', 'src', 'app'), join(dir, 'templates', 'packages', 'shell', 'src', 'app'), { recursive: true });
}

const rootTableMutations = join(skill, 'tests', 'fixtures', 'check-root-imports');
const generated = wantsHelp ? mutations : assembleFixtures(mutations, buildGood);
const rootTables = wantsHelp ? rootTableMutations : assembleFixtures(rootTableMutations, buildRootTable);
try {
  await runSelftest(import.meta.url, [
    { script: 'check-game-host.mjs', fixtures: generated, args: (dir) => [dir] },
    { script: 'check-root-imports.mjs', fixtures: rootTables, args: (dir) => [dir] },
  ]);
} finally {
  if (!wantsHelp) for (const dir of [generated, rootTables]) rmSync(dir, { recursive: true, force: true });
}
