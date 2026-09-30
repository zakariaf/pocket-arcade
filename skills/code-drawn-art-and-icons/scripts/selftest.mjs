#!/usr/bin/env node
// selftest.mjs: proves check-icons-and-logos.mjs and check-app-art.mjs pass their good fixtures and
// catch every planted bug.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs

import { runSelftest } from './check-lib.mjs';

await runSelftest(import.meta.url, [
  {
    script: 'check-icons-and-logos.mjs',
    fixtures: '../tests/fixtures/check-icons-and-logos',
    args: (dir) => [dir],
  },
  {
    script: 'check-app-art.mjs',
    fixtures: '../tests/fixtures/check-app-art',
    args: (dir) => [dir],
  },
]);
