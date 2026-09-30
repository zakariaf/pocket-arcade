#!/usr/bin/env node
// selftest.mjs: proves check-realtime-loop.mjs passes the good fixture and catches every planted bug.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs

import { runSelftest } from './check-lib.mjs';

await runSelftest(import.meta.url, [
  { script: 'check-realtime-loop.mjs', fixtures: '../tests/fixtures', args: (dir) => [dir] },
  // Turn-based games only (every game module says realtime: null): NOT APPLICABLE, a pass (D12).
  { script: 'check-realtime-loop.mjs', fixtures: '../tests/fixtures/turn-based', args: (dir) => [dir] },
]);
