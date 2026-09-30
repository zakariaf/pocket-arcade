#!/usr/bin/env node
// selftest.mjs: proves both checkers. Every case runs on a temporary tree built from this skill's
// templates/ (so the good case proves the templates clean); each bad-* fixture puts the file(s)
// with one planted bug on top (REMOVE.txt deletes a path instead) and must fail with the lines of
// its EXPECT.txt.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runSelftest } from './check-lib.mjs';
import { buildFixtureTree } from './lib/fixture-tree.mjs';

const templates = join(dirname(fileURLToPath(import.meta.url)), '..', 'templates');
const rootFor = (dir) => [buildFixtureTree([templates], dir)];

await runSelftest(import.meta.url, [
  { script: 'check-stores.mjs', fixtures: '../tests/fixtures/check-stores', args: rootFor },
  { script: 'check-reducers.mjs', fixtures: '../tests/fixtures/check-reducers', args: rootFor },
]);
