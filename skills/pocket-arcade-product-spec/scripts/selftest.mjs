#!/usr/bin/env node
// selftest.mjs: proves spec-lookup.mjs and check-spec-refs.mjs pass their good fixtures and
// catch every planted bug.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs

import { join } from 'node:path';

import { runSelftest } from './check-lib.mjs';

await runSelftest(import.meta.url, [
  { script: 'spec-lookup.mjs', fixtures: '../tests/fixtures/spec-lookup', args: (dir) => ['--from', join(dir, 'ids.txt'), '--brief'] },
  { script: 'check-spec-refs.mjs', fixtures: '../tests/fixtures/check-spec-refs', args: (dir) => [dir] },
]);
