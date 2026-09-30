#!/usr/bin/env node
// selftest.mjs: proves every checker of this skill passes its good fixture and catches each planted bug.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs

import { join } from 'node:path';

import { runSelftest } from './check-lib.mjs';

await runSelftest(import.meta.url, [
  { script: 'check-perf-code.mjs', fixtures: '../tests/fixtures/check-perf-code', args: (dir) => ['--root', dir] },
  { script: 'check-budgets.mjs', fixtures: '../tests/fixtures/check-budgets', args: (dir) => ['--root', dir] },
  { script: 'check-perf-report.mjs', fixtures: '../tests/fixtures/check-perf-report', args: (dir) => [join(dir, 'report.json'), '--root', dir] },
  // The simulator regression run: a committed baseline of 600 ms, 6 launches, the first dropped.
  { script: 'check-perf-report.mjs', fixtures: '../tests/fixtures/check-perf-report-sim', args: (dir) => [join(dir, 'report.json'), '--root', dir, '--sim-baseline', '600'] },
  { script: 'check-bundle-size.mjs', fixtures: '../tests/fixtures/check-bundle-size', args: (dir) => [join(dir, 'dist'), '--root', dir, '--baseline', join(dir, 'baseline.json')] },
]);
