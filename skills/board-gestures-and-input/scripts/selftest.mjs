#!/usr/bin/env node
// selftest.mjs: proves check-board-input.mjs passes the good fixtures and catches every planted bug.
// The good fixture is the composed template set (tests/build-fixtures.mjs), so the self-test first
// proves it still equals the templates; after changing a template run node tests/build-fixtures.mjs.
// The second suite is a game-first repo (shell-slice.json "screens": []) checked with --game: the
// gesture-root rule prints SKIP, and a half-built second game outside the scope stays silent.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runSelftest } from './check-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const drift = spawnSync(process.execPath, [join(here, '..', 'tests', 'build-fixtures.mjs'), '--check'], { encoding: 'utf8' });
if (drift.status !== 0) {
  process.stdout.write(drift.stdout);
  process.exit(1);
}
console.log('ok   the good fixture equals the templates (tests/build-fixtures.mjs --check)');

await runSelftest(import.meta.url, [
  { script: 'check-board-input.mjs', fixtures: '../tests/fixtures', args: (dir) => [dir] },
  { script: 'check-board-input.mjs', fixtures: '../tests/fixtures/game-first', args: (dir) => [dir, '--game', 'tap-flip'] },
]);
