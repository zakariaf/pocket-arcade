#!/usr/bin/env node
// selftest.mjs: proves check-boundaries.mjs and check-layout.mjs pass their good fixtures and catch
// every planted bug. Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs

import { runSelftest } from './check-lib.mjs';

await runSelftest(import.meta.url, [
  { script: 'check-boundaries.mjs', fixtures: '../tests/fixtures/check-boundaries', args: (dir) => [dir] },
  { script: 'check-layout.mjs', fixtures: '../tests/fixtures/check-layout', args: (dir) => [dir] },
]);
