#!/usr/bin/env node
// selftest.mjs: proves each checker of this skill passes its good fixture and catches every planted bug.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { runSelftest } from './check-lib.mjs';

/** Arguments from the fixture's args.txt (whitespace separated), or the fixture folder itself. */
function fixtureArgs(dir) {
  const file = join(dir, 'args.txt');
  return existsSync(file) ? readFileSync(file, 'utf8').trim().split(/\s+/) : [dir];
}

await runSelftest(import.meta.url, [
  { script: 'check-goldens.mjs', fixtures: '../tests/fixtures/check-goldens', args: (dir) => [dir] },
  { script: 'check-golden-changes.mjs', fixtures: '../tests/fixtures/check-golden-changes', args: fixtureArgs },
]);
