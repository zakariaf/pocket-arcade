#!/usr/bin/env node
// selftest.mjs: proves the two checkers.
// - check-save-layer: every case runs on a temporary tree built from this skill's templates/ and
//   tests/fixtures/support/ (a start-shell.ts stand-in, so the boot files are due; so the good case
//   proves the templates pass every rule, fixture checksums included); each bad-* fixture puts the
//   file(s) with one planted bug on top (REMOVE.txt deletes a path instead).
// - inspect-save: SQL dumps are loaded into a temporary save.db; good passes, each bad-* fails.
// kill-test.mjs needs a simulator; its verdict comes from lib/save-db.mjs, which the inspect-save
// suite covers. Run `node kill-test.mjs --dry-run ...` to see its plan without a simulator.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runSelftest } from './check-lib.mjs';
import { buildFixtureTree } from './lib/fixture-tree.mjs';

const skill = join(dirname(fileURLToPath(import.meta.url)), '..');
const templates = join(skill, 'templates');
// A Shell boot stand-in (start-shell.ts, Shell step 6): with it the boot save files are due.
const support = join(skill, 'tests', 'fixtures', 'support');

await runSelftest(import.meta.url, [
  {
    script: 'check-save-layer.mjs',
    fixtures: '../tests/fixtures/check-save-layer',
    args: (dir) => ['--root', buildFixtureTree([templates, support], dir)],
  },
  {
    script: 'inspect-save.mjs',
    fixtures: '../tests/fixtures/inspect-save',
    args: (dir) => [join(dir, 'save.sql'), '--game-id', 'line-siege', '--max-version', '1'],
  },
]);
