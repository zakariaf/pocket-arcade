#!/usr/bin/env node
// selftest.mjs: proves the two checkers.
// - check-save-layer: every case runs on a temporary tree built from this skill's templates/ and
//   tests/fixtures/support/ (a start-shell.ts stand-in, so the boot files are due; so the good case
//   proves the templates pass every rule, fixture checksums included); each bad-* fixture puts the
//   file(s) with one planted bug on top (REMOVE.txt deletes a path instead).
// - inspect-save: SQL dumps are loaded into a temporary save.db; good passes, each bad-* fails. A case
//   with args.txt runs those arguments instead (the Android cases pull through the fake adb).
// - kill-test: on iOS it needs a simulator, so its plan runs as --dry-run (exit 2, never PASS); its
//   verdict comes from lib/save-db.mjs, which the inspect-save suite covers, and its timing from
//   lib/kill-plan.mjs, proven below (the calibrated step reaches past a slow first write; an explicit
//   --step-ms wins; an old WAL is not a new write). The Android path runs whole against
//   tests/fixtures/kill-test/fake-sdk/ (fake adb, emulator and avdmanager that read the case's
//   scenario.json and never reach a device), and lib/android-device.mjs's helpers are proven below.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runSelftest } from './check-lib.mjs';
import { androidSaveDir, freeConsolePort, isAndroidWalWrite, KILL_TEST_AVD, killedPid, killRoundScript, listedSerials, missingSdkParts, parseStat, pulledSaveDb, SYSTEM_IMAGE } from './lib/android-device.mjs';
import { buildFixtureTree } from './lib/fixture-tree.mjs';
import { isWriteAfterLaunch, killStepMs } from './lib/kill-plan.mjs';

const skill = join(dirname(fileURLToPath(import.meta.url)), '..');
const templates = join(skill, 'templates');
// A Shell boot stand-in (start-shell.ts, Shell step 7): with it the boot save files are due.
const support = join(skill, 'tests', 'fixtures', 'support');

/** The case's arguments from its args.txt (whitespace separated), or undefined. */
function fixtureArgs(dir) {
  const file = join(dir, 'args.txt');
  return existsSync(file) ? readFileSync(file, 'utf8').trim().split(/\s+/) : undefined;
}

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

const killFixtures = join(skill, 'tests', 'fixtures', 'kill-test');
const DEVICES = 'List of devices attached\nemulator-5554\tdevice\nemulator-5556\toffline\nemulator-5558\tdevice\n';
const ANDROID_CASES = [
  ['listed serials are the ready devices only', listedSerials(DEVICES).join(','), 'emulator-5554,emulator-5558'],
  ['the free console port skips a running emulator', freeConsolePort(DEVICES), 5556],
  ['no device leaves 5554 free', freeConsolePort('List of devices attached\n'), 5554],
  ['stat output parses', JSON.stringify(parseStat('32992 1760000000\n')), '{"size":32992,"mtime":1760000000}'],
  ['a missing WAL parses as null', parseStat("stat: '/data/x': No such file or directory"), null],
  ['a WAL that appears after the launch is the first write', isAndroidWalWrite(null, { size: 4096, mtime: 5 }), true],
  ['an unchanged WAL is no write', isAndroidWalWrite({ size: 4096, mtime: 5 }, { size: 4096, mtime: 5 }), false],
  ['a WAL that grew is a write', isAndroidWalWrite({ size: 4096, mtime: 5 }, { size: 8192, mtime: 5 }), true],
  ['an empty WAL is no write', isAndroidWalWrite(null, { size: 0, mtime: 5 }), false],
  ['no WAL after the launch is no write', isAndroidWalWrite(null, null), false],
  ['a round waits on the device in seconds', /; sleep 0\.134; /.test(killRoundScript('io.applander.linesiege', 134)), true],
  ['a round kills with kill -9 by pidof', /pid=\$\(pidof io\.applander\.linesiege\); if \[ -n "\$pid" \]; then kill -9 \$pid/.test(killRoundScript('io.applander.linesiege', 1000)), true],
  ['a whole second has no decimals', / sleep 1; /.test(killRoundScript('io.applander.linesiege', 1000)), true],
  ['the killed pid is read', killedPid('killed 4242\n'), 4242],
  ['an exited app has no pid', killedPid('exited\n'), null],
  ['the save folder is files/SQLite/', androidSaveDir('io.applander.linesiege'), '/data/data/io.applander.linesiege/files/SQLite/'],
  ['a pull into an existing folder nests SQLite/', pulledSaveDb('/t', (path) => path === '/t/SQLite/save.db'), '/t/SQLite/save.db'],
  ['a pull into a new folder copies the contents', pulledSaveDb('/t', (path) => path === '/t/save.db'), '/t/save.db'],
  ['the AVD is the kill test\'s own', KILL_TEST_AVD, 'e07-android-kill-test'],
  ['the image is google_apis, never a Play Store image', SYSTEM_IMAGE, 'system-images;android-35;google_apis;arm64-v8a'],
  ['the fake SDK has every part', missingSdkParts(join(killFixtures, 'fake-sdk'), { create: true }).length, 0],
  ['a serial run does not need the image', missingSdkParts(join(killFixtures, 'empty-sdk'), { create: false }).length, 3],
];
for (const [name, actual, expected] of ANDROID_CASES) {
  if (actual !== expected) throw new Error(`android-device: ${name}: expected ${expected}, got ${actual}`);
}
console.log(`PASS lib/android-device.mjs: ${ANDROID_CASES.length} cases`);

await runSelftest(import.meta.url, [
  {
    script: 'check-save-layer.mjs',
    fixtures: '../tests/fixtures/check-save-layer',
    args: (dir) => ['--root', buildFixtureTree([templates, support], dir)],
  },
  {
    script: 'inspect-save.mjs',
    fixtures: '../tests/fixtures/inspect-save',
    args: (dir) => fixtureArgs(dir) ?? [join(dir, 'save.sql'), '--game-id', 'line-siege', '--max-version', '1'],
  },
  {
    // Android cases run against tests/fixtures/kill-test/fake-sdk (fake adb, emulator and avdmanager that
    // read the case's scenario.json and never reach a device); the iOS and Android plans run as --dry-run.
    script: 'kill-test.mjs',
    fixtures: '../tests/fixtures/kill-test',
    args: (dir) => fixtureArgs(dir) ?? [],
  },
]);
