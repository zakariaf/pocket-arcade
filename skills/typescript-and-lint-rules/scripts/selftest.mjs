#!/usr/bin/env node
// selftest.mjs: proves check-configs.mjs and check-source.mjs pass their good fixtures and catch
// every planted bug. Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs

import { runSelftest } from './check-lib.mjs';

// A bad-<area>-* config fixture holds only the files of that area, so it is checked with --only.
const configArgs = (dir) => {
  const area = /bad-(tsconfig|eslint|prettier|package)/.exec(dir)?.[1];
  return area ? [dir, '--only', area] : [dir];
};

await runSelftest(import.meta.url, [
  { script: 'check-configs.mjs', fixtures: '../tests/fixtures/check-configs', args: configArgs },
  { script: 'check-source.mjs', fixtures: '../tests/fixtures/check-source', args: (dir) => [dir] },
]);
