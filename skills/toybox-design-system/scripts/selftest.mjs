#!/usr/bin/env node
// selftest.mjs: proves check-design-system.mjs and write-palette.mjs pass their good fixtures and
// catch every planted bug.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs

import { join } from 'node:path';

import { runSelftest } from './check-lib.mjs';

await runSelftest(import.meta.url, [
  {
    script: 'check-design-system.mjs',
    fixtures: '../tests/fixtures/check-design-system',
    args: (dir) => [dir, '--fonts-from', join(dir, 'ref-fonts')],
  },
  {
    script: 'write-palette.mjs',
    fixtures: '../tests/fixtures/write-palette',
    args: (dir) => ['--game', 'rose-garden', '--paint', join(dir, 'paint.json'), '--dry-run'],
  },
]);
