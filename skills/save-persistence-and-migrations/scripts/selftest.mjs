#!/usr/bin/env node
// selftest.mjs: proves the two checkers.
// - check-save-layer: every case runs on a temporary tree built from this skill's templates/ and
//   tests/fixtures/support/ (a start-shell.ts stand-in, so the boot files are due; so the good case
//   proves the templates pass every rule, fixture checksums included); each bad-* fixture puts the
//   file(s) with one planted bug on top (REMOVE.txt deletes a path instead).
// - inspect-save: SQL dumps are loaded into a temporary save.db; good passes, each bad-* fails.
// kill-test.mjs needs a simulator; its verdict comes from lib/save-db.mjs, which the inspect-save
// suite covers, and its timing from lib/kill-plan.mjs, proven below (the calibrated step reaches
// past a slow first write; an explicit --step-ms wins; an old WAL is not a new write). Run
// `node kill-test.mjs --dry-run ...` to see its plan without a simulator.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runSelftest } from './check-lib.mjs';
import { buildFixtureTree } from './lib/fixture-tree.mjs';
import { isWriteAfterLaunch, killStepMs } from './lib/kill-plan.mjs';

const skill = join(dirname(fileURLToPath(import.meta.url)), '..');
const templates = join(skill, 'templates');
// A Shell boot stand-in (start-shell.ts, Shell step 7): with it the boot save files are due.
const support = join(skill, 'tests', 'fixtures', 'support');

function noCalibrationLaunch() {
  throw new Error('kill-plan: a calibration launch ran although --step-ms was given');
}

const KILL_PLAN_CASES = [
  // The measured Line Siege start-up: the first write 1,070 ms after launch; 12 rounds reach 1,608.
  ['calibrated step covers a slow first write', killStepMs({ kills: 12, stepMs: undefined, measureFirstWrite: () => 1070 }), 134],
  ['a fast start-up keeps the 80 ms floor', killStepMs({ kills: 12, stepMs: undefined, measureFirstWrite: () => 300 }), 80],
  ['an explicit --step-ms wins', killStepMs({ kills: 12, stepMs: 200, measureFirstWrite: () => 1070 }), 200],
  ['an explicit --step-ms runs no calibration launch', killStepMs({ kills: 12, stepMs: 200, measureFirstWrite: noCalibrationLaunch }), 200],
  ['an unmeasured first write (dry run) keeps the 80 ms floor', killStepMs({ kills: 12, stepMs: undefined, measureFirstWrite: () => undefined }), 80],
  ['no first write within the timeout gives no step', killStepMs({ kills: 12, stepMs: undefined, measureFirstWrite: () => null }), null],
  ['an empty WAL is no write', isWriteAfterLaunch({ size: 0, mtimeMs: 2000 }, 1000), false],
  ['a WAL from before the launch is no write', isWriteAfterLaunch({ size: 4096, mtimeMs: 900 }, 1000), false],
  ['a WAL written after the launch is the first write', isWriteAfterLaunch({ size: 4096, mtimeMs: 1500 }, 1000), true],
  ['no WAL is no write', isWriteAfterLaunch(null, 1000), false],
];
for (const [name, actual, expected] of KILL_PLAN_CASES) {
  if (actual !== expected) throw new Error(`kill-plan: ${name}: expected ${expected}, got ${actual}`);
}
console.log(`PASS lib/kill-plan.mjs: ${KILL_PLAN_CASES.length} timing cases`);

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
