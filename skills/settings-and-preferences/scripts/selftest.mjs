#!/usr/bin/env node
// selftest.mjs: proves check-settings.mjs passes the good fixture and catches every planted bug.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs

import { runSelftest } from './check-lib.mjs';

await runSelftest(import.meta.url, [
  { script: 'check-settings.mjs', fixtures: '../tests/fixtures', args: () => [] },
  // shell-slice.json: the S11 rules print SKIP lines while S11 is outside the slice.
  { script: 'check-settings.mjs', fixtures: '../tests/fixtures/slice', args: (dir) => [dir] },
]);
