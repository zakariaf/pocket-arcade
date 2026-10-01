#!/usr/bin/env node
// selftest.mjs: proves check-exports.mjs passes good/ and every pass-* case, catches every planted bug
// (bad-*, exit 1) and stops on bad input (error-*, exit 2), each printing its EXPECT.txt lines.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs

import { runSelftest } from './check-lib.mjs';

await runSelftest(import.meta.url, [
  { script: 'check-exports.mjs', fixtures: '../tests/fixtures', args: (dir) => [dir] },
]);
