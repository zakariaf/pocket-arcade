#!/usr/bin/env node
// selftest.mjs: proves check-exports.mjs passes the good fixture and catches every planted bug.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs

import { runSelftest } from './check-lib.mjs';

await runSelftest(import.meta.url, [
  { script: 'check-exports.mjs', fixtures: '../tests/fixtures', args: (dir) => [dir] },
]);
