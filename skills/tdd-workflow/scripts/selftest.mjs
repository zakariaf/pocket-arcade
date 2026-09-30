#!/usr/bin/env node
// selftest.mjs: proves check-tests.mjs and check-test-edits.mjs pass their good fixtures and catch
// every planted bug.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs

import { join } from 'node:path';

import { runSelftest } from './check-lib.mjs';

await runSelftest(import.meta.url, [
  { script: 'check-tests.mjs', fixtures: '../tests/fixtures/check-tests', args: (dir) => [dir] },
  { script: 'check-test-edits.mjs', fixtures: '../tests/fixtures/check-test-edits', args: (dir) => ['--log', join(dir, 'history.log')] },
]);
