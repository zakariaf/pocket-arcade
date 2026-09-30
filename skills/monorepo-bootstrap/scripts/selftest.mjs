#!/usr/bin/env node
// selftest.mjs: proves both scripts of this skill.
//   scaffold-monorepo.mjs: plans a clean root (merging .gitignore and settings) and reports conflicts.
//   check-monorepo.mjs: passes a repo generated from the templates right now, and fails each
//   planted bug (tests/fixtures/check-monorepo/bad-*/mutation.json applied to that repo).
// Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs

import { rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assembleCheckFixtures } from './lib/assemble-fixtures.mjs';
import { runSelftest } from './check-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const wantsHelp = process.argv.includes('--help') || process.argv.includes('-h');
const generated = wantsHelp ? join(here, '..', 'tests', 'fixtures', 'check-monorepo') : assembleCheckFixtures(join(here, '..', 'tests', 'fixtures', 'check-monorepo'));
const TODAY = ['--today', '2026-09-28'];

try {
  await runSelftest(import.meta.url, [
    { script: 'scaffold-monorepo.mjs', fixtures: '../tests/fixtures/scaffold-monorepo', args: (dir) => ['--root', dir, ...TODAY] },
    { script: 'check-monorepo.mjs', fixtures: generated, args: (dir) => [dir, ...TODAY] },
  ]);
} finally {
  if (!wantsHelp) rmSync(generated, { recursive: true, force: true });
}
