#!/usr/bin/env node
// selftest.mjs: proves every checker of this skill passes its good fixture and catches every planted
// bug in the bad-* fixtures. Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { runSelftest } from './check-lib.mjs';

await runSelftest(import.meta.url, [
  { script: 'check-known-pitfalls.mjs', fixtures: '../tests/fixtures/check-known-pitfalls', args: (dir) => [dir] },
  { script: 'check-catalogue.mjs', fixtures: '../tests/fixtures/check-catalogue', args: (dir) => ['--catalogue', join(dir, 'known-failures.json'), '--references', join(dir, 'references')] },
  { script: 'find-fix.mjs', fixtures: '../tests/fixtures/find-fix', args: (dir) => ['--log', join(dir, 'build.log')] },
  // One --text query per line of queries.txt: every query must find a known failure (good), and an
  // unknown one must fail with no-known-fix (bad-*).
  { script: 'find-fix.mjs', fixtures: '../tests/fixtures/find-fix-text', args: (dir) => readFileSync(join(dir, 'queries.txt'), 'utf8').split('\n').filter(Boolean).flatMap((query) => ['--text', query]) },
]);
