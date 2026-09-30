#!/usr/bin/env node
// selftest.mjs: proves check-components.mjs and write-component-specs.mjs pass their good fixtures
// and catch every planted bug. A fixture may hold ARGS.txt (one option per line, e.g. --only Toast).
// Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { runSelftest } from './check-lib.mjs';

function extraArgs(dir) {
  const path = join(dir, 'ARGS.txt');
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8').split('\n').map((line) => line.trim()).filter(Boolean).flatMap((line) => line.split(/\s+/));
}

await runSelftest(import.meta.url, [
  {
    script: 'check-components.mjs',
    fixtures: '../tests/fixtures/check-components',
    args: (dir) => [dir, ...extraArgs(dir)],
  },
  {
    script: 'write-component-specs.mjs',
    fixtures: '../tests/fixtures/write-component-specs',
    args: (dir) => [dir, '--check'],
  },
  {
    // A small token file proves the as-rendered rule itself: a 2.5 border becomes 2, a 1.5 border 1,
    // a sub-pixel border and every non-border value (an icon stroke, a ring) keep their token value.
    script: 'write-component-specs.mjs',
    fixtures: '../tests/fixtures/write-component-specs-rule',
    args: (dir) => [dir, '--check', '--tokens', join(dir, 'tokens.json')],
  },
]);
