#!/usr/bin/env node
// selftest.mjs: proves check-levels.mjs. The good repo is this skill's templates installed for the
// game id "tap-flip" the way the workflow installs them: the kit and the app templates copied, then
// the packs generated from the plan (the templates ship no pack-*.json), plus the example golden
// snapshot and tests/fixtures/check-levels/base (the rules and RNG the plan imports, a minimal
// game.config.ts), and a root package.json that pins fast-check as workflow step 2 installs it. Every tests/fixtures/check-levels/bad-*/mutation.json plants one bug.
// A second suite (tests/fixtures/check-levels-score) makes the same game score-rated
// (score.json), so its packs carry threshold arrays, and plants a pack not written in Prettier's
// style. Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs

import { cpSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runSelftest } from './check-lib.mjs';
import { enableAppImports } from './lib/app-modules.mjs';
import { applyMutation, assembleFixtures, instantiate } from './lib/assemble-fixtures.mjs';
import { writePacks } from './lib/level-run.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const skill = join(here, '..');
const mutations = join(skill, 'tests', 'fixtures', 'check-levels');
const scoreMutations = join(skill, 'tests', 'fixtures', 'check-levels-score');
const wantsHelp = process.argv.includes('--help') || process.argv.includes('-h');

function installTemplates(dir) {
  cpSync(join(skill, 'templates', 'packages'), join(dir, 'packages'), { recursive: true });
  instantiate(join(skill, 'templates', 'apps', '__GAME_ID__'), join(dir, 'apps', 'tap-flip'), 'tap-flip');
  cpSync(join(skill, 'examples', 'tap-flip-levels.golden.test.ts.snap.ios'), join(dir, 'apps', 'tap-flip', 'src', 'levels', 'tap-flip-levels.golden.test.ts.snap.ios'));
  cpSync(join(mutations, 'base'), dir, { recursive: true });
}

/**
 * The root manifest after workflow step 2: fast-check pinned exactly (the kit's tests import it).
 * Written after the packs, so generating them in this process prints no module-type warning.
 */
function writeRootManifest(dir) {
  const manifest = { name: 'e07-games', private: true, devDependencies: { 'fast-check': '4.10.2' } };
  writeFileSync(join(dir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}

async function buildGood(dir) {
  installTemplates(dir);
  await writePacks(dir, enableAppImports(dir), 'tap-flip');
  writeRootManifest(dir);
}

async function buildScoreGood(dir) {
  installTemplates(dir);
  applyMutation(dir, JSON.parse(readFileSync(join(scoreMutations, 'score.json'), 'utf8')), 'score.json');
  await writePacks(dir, enableAppImports(dir), 'tap-flip');
  writeRootManifest(dir);
}

const generated = wantsHelp ? mutations : await assembleFixtures(mutations, buildGood);
const generatedScore = wantsHelp ? scoreMutations : await assembleFixtures(scoreMutations, buildScoreGood);
try {
  await runSelftest(import.meta.url, [
    { script: 'check-levels.mjs', fixtures: generated, args: (dir) => [dir] },
    { script: 'check-levels.mjs', fixtures: generatedScore, args: (dir) => [dir] },
  ]);
} finally {
  if (!wantsHelp) {
    rmSync(generated, { recursive: true, force: true });
    rmSync(generatedScore, { recursive: true, force: true });
  }
}
