#!/usr/bin/env node
// selftest.mjs: proves check-navigation.mjs on three suites: the full Shell (tests/fixtures/good and
// bad-*), a partial Shell with shell-slice.json (tests/fixtures/slice/), and a game-first repo whose
// slice lists no screens (tests/fixtures/game-first/). Each good tree passes; each bad-* tree fails
// with the lines of its EXPECT.txt (SKIP lines included).
// Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs

import { basename } from 'node:path';

import { runSelftest } from './check-lib.mjs';

await runSelftest(import.meta.url, [
  { script: 'check-navigation.mjs', fixtures: '../tests/fixtures', args: () => [] },
  {
    script: 'check-navigation.mjs',
    fixtures: '../tests/fixtures/slice',
    args: (dir) => (basename(dir) === 'bad-complete' ? ['--complete'] : []),
  },
  { script: 'check-navigation.mjs', fixtures: '../tests/fixtures/game-first', args: () => [] },
]);
