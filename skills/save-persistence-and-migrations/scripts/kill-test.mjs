#!/usr/bin/env node
// kill-test.mjs: the simulator kill test for the save path. It launches the installed app and
// kills it with SIGKILL at growing delays while the startup writes run, then inspects the app's
// save.db copy: both slots must decode and save_quarantine must be empty. Without --step-ms one
// calibration launch first measures when the first save write lands, and the rounds spread over
// KILL_WINDOW_FACTOR times that (lib/kill-plan.mjs), so kills hit the writes however slow the start-up is. Needs Xcode's simctl and a Release (test variant) build installed or passed with --app.
// With --platform android it does the same on an Android emulator over adb (lib/android-device.mjs):
// `adb root` on a google_apis image, `kill -9` of the app's process on the device, then the app's
// files/SQLite/ folder is pulled and inspected the same way.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/kill-test.mjs --udid <id> --bundle-id <id> --game-id <id> [--app <path.app>] [--repo .]
//      node ${CLAUDE_SKILL_DIR}/scripts/kill-test.mjs --platform android --serial <serial>|--create --bundle-id <package> --game-id <id> [--app <app-release.apk>] [--repo .]

import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';

import { createReporter, fail, parseArgs, requireDir, run } from './check-lib.mjs';
import { adbArgs, androidSaveDir, createAndroidDevice, isAndroidWalWrite, KILL_TEST_AVD, killedPid, killRoundScript, missingSdkParts, parseStat } from './lib/android-device.mjs';
import { androidSdkRoot, sleepMs, SYSTEM_IMAGE } from './lib/android-emu.mjs';
import { enableAppImports } from './lib/app-modules.mjs';
import { CALIBRATION_TIMEOUT_MS, isWriteAfterLaunch, KILL_WINDOW_FACTOR, killStepMs, MIN_STEP_MS } from './lib/kill-plan.mjs';
import { appSaveDbPath, inspectDatabase, openSqlite, stageDatabase } from './lib/save-db.mjs';

const SPEC = {
  name: 'kill-test',
  summary:
    'Runs the save kill test on an iOS simulator (or, with --platform android, an Android emulator): N launches killed with SIGKILL at growing delays during the startup writes, then the save.db health check (both slots decode, no quarantined rows). Never runs without --udid/--serial (or --create) and --bundle-id.',
  usage: '[--platform ios|android] --udid <id>|--serial <serial>|--create --bundle-id <id> --game-id <id> [--app <path.app|app-release.apk>] [--repo <dir>] [--kills <n>] [--step-ms <ms>] [--sdk <dir>] [--dry-run]',
  options: {
    platform: { type: 'string', default: 'ios', value: 'ios|android', help: 'ios (simctl, the default) or android (adb on an emulator)' },
    udid: { type: 'string', value: 'id', help: 'iOS: the simulator to use (a dedicated one: this test kills apps on it)' },
    serial: { type: 'string', value: 'serial', help: 'Android: the running emulator to use, as `adb devices` lists it (a dedicated e07-android-* one on a google_apis image)' },
    sdk: { type: 'string', value: 'dir', help: 'Android: the SDK folder (default: ANDROID_HOME, ANDROID_SDK_ROOT, ~/Library/Android/sdk)' },
    create: { type: 'boolean', help: `Create a fresh simulator "e07-kill-test" (Android: the AVD "${KILL_TEST_AVD}" on ${SYSTEM_IMAGE}) and delete it afterwards` },
    'device-type': { type: 'string', default: 'iPhone 17', value: 'name', help: 'Device type for --create' },
    runtime: { type: 'string', default: 'com.apple.CoreSimulator.SimRuntime.iOS-26-5', value: 'id', help: 'Runtime for --create' },
    app: { type: 'string', value: 'path', help: 'A built .app (Android: .apk) to install first (Release, test variant)' },
    'bundle-id': { type: 'string', value: 'id', help: 'The app bundle id (Android: the package id, the same io.applander.<id>)' },
    'game-id': { type: 'string', value: 'id', help: 'The gameId the save must carry' },
    kills: { type: 'string', default: '12', value: 'n', help: 'How many launch-and-kill rounds' },
    'step-ms': { type: 'string', value: 'ms', help: `Delay step: round i kills after i x step ms (default: calibrated, ${KILL_WINDOW_FACTOR} x the first save write spread over the rounds, at least ${MIN_STEP_MS})` },
    repo: { type: 'string', value: 'dir', help: "App repo root: also decode both slots with the app's own decodeSlot (schema and migrations)" },
    'dry-run': { type: 'boolean', help: 'Print the commands without running them (ends with exit 2, never PASS)' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: 0 },
  details: [
    `Calibration (no --step-ms): one launch waits up to ${CALIBRATION_TIMEOUT_MS / 1000} s for the first save write (save.db-wal`,
    `growing after the launch), then the rounds spread over ${KILL_WINDOW_FACTOR} x that time; no write is slot-missing.`,
    'Pass criteria: every round launched and was killed, then inspect finds both slots ok and',
    'save_quarantine empty (rules from inspect-save: slot-missing, checksum, json, quarantine, ...).',
    'The mid-level kill (play N moves, kill, relaunch, assert the paused Game screen) is a Maestro flow.',
    '',
    'Android (--platform android): every adb call names the device (adb -s <serial>). --create makes the AVD',
    `${KILL_TEST_AVD} on ${SYSTEM_IMAGE} (never a Play Store image: it refuses adb root), starts it`,
    'headless on a free console port, and at the end kills it by serial and deletes the AVD. The run needs adb root',
    `(proved with id -u = 0), kills with kill -9 on the device, and pulls ${androidSaveDir('<package>')}.`,
    'Calibration polls the WAL with stat until its size or time changes after the launch. A missing SDK part stops',
    'the run (exit 2) and names the sdkmanager package; nothing is downloaded.',
  ].join('\n'),
};

function simctl(args, { dryRun, allowFail = false } = {}) {
  if (dryRun) {
    console.log(`would run: xcrun simctl ${args.join(' ')}`);
    return '';
  }
  try {
    return execFileSync('xcrun', ['simctl', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    if (allowFail) return '';
    fail(`xcrun simctl ${args.join(' ')} failed: ${String(error.stderr ?? error.message).split('\n')[0]}`, 'Check Xcode (xcode-select -p), the UDID and the bundle id.');
  }
  return '';
}

/** Creates the throwaway simulator for --create (deleted in run()'s finally), else uses --udid. */
function simulatorFor(options) {
  if (!options.create) return options.udid;
  return simctl(['create', 'e07-kill-test', options['device-type'], options.runtime], { dryRun: options['dry-run'] }) || '<new-udid>';
}

function prepareSimulator(udid, options) {
  const dryRun = options['dry-run'];
  simctl(['boot', udid], { dryRun, allowFail: true }); // already booted is fine
  simctl(['bootstatus', udid, '-b'], { dryRun });
  if (options.app !== undefined) simctl(['install', udid, options.app], { dryRun });
  return udid;
}

function killRounds(udid, bundleId, { kills, stepMs, dryRun }) {
  for (let round = 1; round <= kills; round += 1) {
    simctl(['terminate', udid, bundleId], { dryRun, allowFail: true });
    const launched = simctl(['launch', udid, bundleId], { dryRun });
    const pid = Number(/:\s*(\d+)\s*$/.exec(launched)?.[1]);
    const delay = round * stepMs;
    if (dryRun) {
      console.log(`would kill -9 the app after ${delay} ms`);
      continue;
    }
    if (!Number.isInteger(pid)) fail(`could not read the pid from "${launched}"`, 'Check that the bundle id is installed on this simulator.');
    sleepMs(delay);
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // The app may already have exited; the save must still be healthy.
    }
    console.log(`round ${round}: killed pid ${pid} after ${delay} ms`);
  }
  // Let the file system settle after the last kill, then the file is copied and inspected.
  sleepMs(500);
}

/** Launches once without killing and returns the ms from launch to the first save write, or null. */
function measureFirstWrite(udid, bundleId) {
  simctl(['terminate', udid, bundleId], { allowFail: true });
  const launchedAtMs = Date.now();
  simctl(['launch', udid, bundleId]);
  const startedMs = Date.now();
  const wal = `${appSaveDbPath(simctl(['get_app_container', udid, bundleId, 'data']))}-wal`;
  while (Date.now() - startedMs < CALIBRATION_TIMEOUT_MS) {
    const stat = existsSync(wal) ? statSync(wal) : null;
    if (isWriteAfterLaunch(stat, launchedAtMs)) return Date.now() - startedMs;
    sleepMs(10);
  }
  return null;
}

async function loadDecoder(repo, gameId) {
  if (repo === undefined) return undefined;
  const app = enableAppImports(requireDir(repo, 'app repo root'));
  const codec = await app.load('packages/shell/src/services/save/save-codec.ts');
  return (record) => codec.decodeSlot(record, gameId);
}

/** The step to use (lib/kill-plan.mjs decides): --step-ms, or one calibrated from a first launch (null: the app never wrote). */
function calibratedStep(udid, bundleId, { kills, givenStepMs, dryRun }, report) {
  let firstWriteMs;
  const stepMs = killStepMs({
    kills,
    stepMs: givenStepMs,
    measureFirstWrite: () => {
      if (dryRun) {
        console.log(`would launch once and time the first save write (up to ${CALIBRATION_TIMEOUT_MS} ms), then spread ${kills} rounds over ${KILL_WINDOW_FACTOR} x it`);
        return undefined;
      }
      firstWriteMs = measureFirstWrite(udid, bundleId);
      return firstWriteMs;
    },
  });
  if (stepMs === null) {
    report.problem({ file: bundleId, rule: 'slot-missing', message: `no save write within ${CALIBRATION_TIMEOUT_MS} ms of an undisturbed launch`, fix: 'The app never finished a first write: check boot order (hydrate before the first render) and that save.db opens in WAL mode.' });
    return null;
  }
  if (firstWriteMs !== undefined) console.log(`calibration: first save write ${firstWriteMs} ms after launch; kill step ${stepMs} ms (rounds up to ${stepMs * kills} ms)`);
  return stepMs;
}

run(async () => {
  const { options } = parseArgs(process.argv.slice(2), SPEC);
  if (!['ios', 'android'].includes(options.platform)) fail(`--platform must be ios or android, not "${options.platform}"`);
  if (options.platform === 'android') return runAndroid(options);
  if (options.serial !== undefined || options.sdk !== undefined) fail('--serial and --sdk are for --platform android', 'On iOS pass --udid <simulator> or --create.');
  if (options['bundle-id'] === undefined || options['game-id'] === undefined) fail('--bundle-id and --game-id are required');
  if (options.udid === undefined && !options.create) fail('pass --udid <id> (a dedicated simulator) or --create');
  if (options.create && options.app === undefined) fail('--create makes an empty simulator: pass --app <path/to/App.app> too', 'Build the Release test-variant simulator app first, then pass its .app path.');
  if (options.app !== undefined && !options['dry-run'] && !existsSync(options.app)) fail(`no app at ${options.app}`, 'Build the Release (test variant) simulator app first.');
  const kills = Number(options.kills);
  const givenStepMs = options['step-ms'] === undefined ? undefined : Number(options['step-ms']);
  if (!Number.isInteger(kills) || kills < 1 || (givenStepMs !== undefined && (!Number.isInteger(givenStepMs) || givenStepMs < 1))) fail('--kills and --step-ms must be positive whole numbers');
  const DatabaseSync = await openSqlite();
  if (DatabaseSync === null) fail('node:sqlite is not available in this Node', 'Use Node 22.13 or newer.');
  const dryRun = options['dry-run'];
  const decode = await loadDecoder(options.repo, options['game-id']);
  const udid = simulatorFor(options);
  const report = createReporter({ name: 'kill-test', json: options.json });
  try {
    prepareSimulator(udid, options);
    const stepMs = calibratedStep(udid, options['bundle-id'], { kills, givenStepMs, dryRun }, report);
    if (stepMs === null) return report.finish({ checked: 0, unit: 'kill rounds' });
    killRounds(udid, options['bundle-id'], { kills, stepMs, dryRun });
    if (dryRun) {
      console.log('would inspect Documents/SQLite/save.db of the app container');
      // A plan proves nothing: never end a dry run with RESULT: PASS.
      fail(`dry run: printed the plan for ${kills} rounds, killed nothing`, 'Run again without --dry-run on a dedicated simulator with the Release test build installed.');
    }
    simctl(['terminate', udid, options['bundle-id']], { allowFail: true });
    const container = simctl(['get_app_container', udid, options['bundle-id'], 'data']);
    inspectAppDatabase(DatabaseSync, appSaveDbPath(container), { gameId: options['game-id'], decode }, report);
  } finally {
    // A simulator this run created is always removed, also when a step failed.
    if (options.create && !dryRun) {
      simctl(['shutdown', udid], { allowFail: true });
      simctl(['delete', udid], { allowFail: true });
    }
  }
  return report.finish({ checked: kills, unit: 'kill rounds' });
});

function inspectAppDatabase(DatabaseSync, database, options, report) {
  if (!existsSync(database)) {
    report.problem({ file: database, rule: 'slot-missing', message: 'no save.db after the kill rounds', fix: 'The app never finished a first write: check boot order (hydrate before the first render).' });
    return;
  }
  const staged = stageDatabase(DatabaseSync, database);
  try {
    const result = inspectDatabase(DatabaseSync, staged.path, options);
    for (const line of result.lines) console.log(line);
    for (const problem of result.problems) report.problem({ file: database, ...problem });
  } finally {
    staged.cleanup();
  }
}

// ---------------------------------------------------------------------------------------------
// Android (--platform android): the same test over adb on an emulator
// ---------------------------------------------------------------------------------------------

/** Arguments of an Android run; each wrong combination stops with exit 2 before any device is touched. */
function androidArgs(options) {
  if (options['bundle-id'] === undefined || options['game-id'] === undefined) fail('--bundle-id (the Android package id) and --game-id are required');
  if (options.udid !== undefined) fail('--udid is for iOS', 'On Android pass --serial <serial> (as adb devices lists it) or --create.');
  if (options.serial === undefined && !options.create) fail('pass --serial <serial> (a dedicated emulator) or --create', `--create makes ${KILL_TEST_AVD} on ${SYSTEM_IMAGE} and deletes it afterwards.`);
  if (options.serial !== undefined && options.create) fail('--serial and --create exclude each other');
  if (options.app !== undefined && !options.app.endsWith('.apk')) fail(`--app must be an .apk on Android, not ${options.app}`, 'Pass the Release test-variant APK (apps/<game>/android/app/build/outputs/apk/release/app-release.apk).');
  if (options.create && options.app === undefined) fail('--create makes an empty emulator: pass --app <app-release.apk> too', 'Build the Release test-variant APK first (npm run build:android:emu).');
  if (options.app !== undefined && !options['dry-run'] && !existsSync(options.app)) fail(`no APK at ${options.app}`, 'Build the Release test-variant APK first (npm run build:android:emu).');
  const kills = Number(options.kills);
  const givenStepMs = options['step-ms'] === undefined ? undefined : Number(options['step-ms']);
  if (!Number.isInteger(kills) || kills < 1 || (givenStepMs !== undefined && (!Number.isInteger(givenStepMs) || givenStepMs < 1))) fail('--kills and --step-ms must be positive whole numbers');
  const sdk = androidSdkRoot(options.sdk);
  const missing = options['dry-run'] ? [] : missingSdkParts(sdk, { create: options.create });
  if (missing.length > 0) fail(`the Android SDK at ${sdk} lacks ${missing.join(', ')}`, 'Install the missing parts with sdkmanager only after the owner (or the lead) agreed to the download; this script never downloads.');
  return { packageId: options['bundle-id'], kills, givenStepMs, sdk, dryRun: options['dry-run'] };
}

/** Launches once without killing and returns the ms from launch to the first save write, or null. */
function androidFirstWrite(device, packageId) {
  const wal = `${androidSaveDir(packageId)}save.db-wal`;
  const statWal = () => parseStat(device.adb(adbArgs(device.serial, ['shell', 'stat', '-c', "'%s %Y'", wal]), { allowFail: true, quiet: true }));
  device.adb(adbArgs(device.serial, ['shell', 'am', 'force-stop', packageId]), { quiet: true });
  const before = statWal();
  const startedMs = Date.now();
  device.adb(adbArgs(device.serial, ['shell', 'am', 'start', '-n', `${packageId}/.MainActivity`]), { quiet: true });
  while (Date.now() - startedMs < CALIBRATION_TIMEOUT_MS) {
    if (isAndroidWalWrite(before, statWal())) return Date.now() - startedMs;
    sleepMs(10);
  }
  return null;
}

function androidStep(device, { packageId, kills, givenStepMs, dryRun }, report) {
  let firstWriteMs;
  const stepMs = killStepMs({
    kills,
    stepMs: givenStepMs,
    measureFirstWrite: () => {
      if (dryRun) {
        console.log(`would launch once and time the first save write (up to ${CALIBRATION_TIMEOUT_MS} ms), then spread ${kills} rounds over ${KILL_WINDOW_FACTOR} x it`);
        return undefined;
      }
      firstWriteMs = androidFirstWrite(device, packageId);
      return firstWriteMs;
    },
  });
  if (stepMs === null) {
    report.problem({ file: packageId, rule: 'slot-missing', message: `no save write within ${CALIBRATION_TIMEOUT_MS} ms of an undisturbed launch`, fix: 'The app never finished a first write: check boot order (hydrate before the first render) and that save.db opens in WAL mode.' });
    return null;
  }
  if (firstWriteMs !== undefined) console.log(`calibration: first save write ${firstWriteMs} ms after launch; kill step ${stepMs} ms (rounds up to ${stepMs * kills} ms)`);
  return stepMs;
}

/** Each round: force-stop (a cold start), then launch, wait and kill -9 in one device shell line. */
function androidKillRounds(device, { packageId, kills, dryRun }, stepMs) {
  for (let round = 1; round <= kills; round += 1) {
    device.adb(adbArgs(device.serial, ['shell', 'am', 'force-stop', packageId]));
    const delay = round * stepMs;
    const output = device.adb(adbArgs(device.serial, ['shell', killRoundScript(packageId, delay)]));
    if (dryRun) continue;
    const pid = killedPid(output);
    console.log(pid === null ? `round ${round}: the app had exited before ${delay} ms` : `round ${round}: killed pid ${pid} after ${delay} ms`);
  }
  device.adb(adbArgs(device.serial, ['shell', 'am', 'force-stop', packageId]));
  // Let the file system settle after the last kill, then the folder is pulled and inspected.
  if (!dryRun) sleepMs(500);
}

async function runAndroid(options) {
  const args = androidArgs(options);
  const DatabaseSync = await openSqlite();
  if (DatabaseSync === null) fail('node:sqlite is not available in this Node', 'Use Node 22.13 or newer.');
  const decode = await loadDecoder(options.repo, options['game-id']);
  const device = createAndroidDevice({ sdk: args.sdk, dryRun: args.dryRun, fail });
  const report = createReporter({ name: 'kill-test', json: options.json });
  let isCreated = false;
  try {
    if (options.create) {
      isCreated = true;
      device.createAndBoot();
    } else {
      device.useSerial(options.serial);
      device.waitForBoot();
    }
    device.becomeRoot();
    if (options.app !== undefined) device.adb(adbArgs(device.serial, ['install', '-r', options.app]));
    const stepMs = androidStep(device, args, report);
    if (stepMs === null) return report.finish({ checked: 0, unit: 'kill rounds' });
    androidKillRounds(device, args, stepMs);
    const pulled = device.pullSaveDb(args.packageId);
    // A plan proves nothing: never end a dry run with RESULT: PASS.
    if (args.dryRun) fail(`dry run: printed the plan for ${args.kills} rounds, killed nothing`, 'Run again without --dry-run on a dedicated google_apis emulator (or --create) with the Release test APK.');
    try {
      inspectAppDatabase(DatabaseSync, pulled.database, { gameId: options['game-id'], decode }, report);
    } finally {
      pulled.cleanup();
    }
  } finally {
    // An emulator and AVD this run created are always removed, also when a step failed.
    if (isCreated) device.teardownCreated();
  }
  return report.finish({ checked: args.kills, unit: 'kill rounds' });
}
