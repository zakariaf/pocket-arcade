#!/usr/bin/env node
// selftest.mjs: proves check-gate-wiring.mjs and check-bypasses.mjs pass their good fixtures and
// catch every planted bug.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs

import { runSelftest } from './check-lib.mjs';

await runSelftest(import.meta.url, [
  { script: 'check-gate-wiring.mjs', fixtures: '../tests/fixtures/check-gate-wiring', args: (dir) => [dir] },
  { script: 'check-bypasses.mjs', fixtures: '../tests/fixtures/check-bypasses', args: (dir) => [dir, '--today', '2026-09-28'] },
]);
