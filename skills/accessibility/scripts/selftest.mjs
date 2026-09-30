#!/usr/bin/env node
// selftest.mjs: proves every checker of this skill passes its good fixture and catches each planted bug.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { runSelftest } from './check-lib.mjs';

// A contrast fixture may hold pieces.txt: the piece colours to check for colour-blind separation.
function contrastArgs(dir) {
  const pieces = join(dir, 'pieces.txt');
  return [dir, ...(existsSync(pieces) ? ['--categorical', readFileSync(pieces, 'utf8').trim()] : [])];
}

await runSelftest(import.meta.url, [
  { script: 'check-contrast.mjs', fixtures: '../tests/fixtures/check-contrast', args: contrastArgs },
  { script: 'check-a11y-code.mjs', fixtures: '../tests/fixtures/check-a11y-code', args: (dir) => [dir] },
]);
