#!/usr/bin/env node
// selftest.mjs: proves both checkers pass their good fixture and catch every planted bug.
// The good fixtures are the composed template set (tests/build-fixtures.mjs), so the self-test first
// proves they still equal the templates; after changing a template run node tests/build-fixtures.mjs.
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
console.log('ok   good fixtures equal the templates (tests/build-fixtures.mjs --check)');

await runSelftest(import.meta.url, [
  { script: 'check-board-code.mjs', fixtures: '../tests/fixtures/check-board-code', args: (dir) => [dir] },
  { script: 'check-board-files.mjs', fixtures: '../tests/fixtures/check-board-files', args: (dir) => [dir] },
]);
