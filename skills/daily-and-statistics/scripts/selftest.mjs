#!/usr/bin/env node
// selftest.mjs: proves check-daily-stats.mjs. Every case runs on a temporary tree built from this
// skill's templates plus tests/fixtures/support (the progress reducer that run-end.ts imports);
// good/ adds nothing, and each bad-* fixture puts one file with a planted bug on top (a changed
// seed, a counted replay, a clock-back streak reset, a counted tutorial, a wall-clock read, ...).
// The slice/ suite adds shell-slice.json and removes the summaries (REMOVE.txt).
// Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runSelftest } from './check-lib.mjs';
import { buildFixtureTree } from './lib/fixture-tree.mjs';

const skill = join(dirname(fileURLToPath(import.meta.url)), '..');
const layers = [join(skill, 'templates'), join(skill, 'tests', 'fixtures', 'support')];

await runSelftest(import.meta.url, [
  {
    script: 'check-daily-stats.mjs',
    fixtures: '../tests/fixtures',
    args: (dir) => [buildFixtureTree(layers, dir)],
  },
  {
    // shell-slice.json: the S9/S10 summaries may be missing while no slice screen needs them.
    script: 'check-daily-stats.mjs',
    fixtures: '../tests/fixtures/slice',
    args: (dir) => [buildFixtureTree(layers, dir)],
  },
]);
