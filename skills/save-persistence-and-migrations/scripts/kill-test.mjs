#!/usr/bin/env node
// kill-test.mjs: the simulator kill test for the save path. It launches the installed app and
// kills it with SIGKILL at growing delays while the startup writes run (0.08 s, 0.16 s ... by
// default), then inspects the app's save.db copy: both slots must decode and save_quarantine must
// be empty. Needs Xcode's simctl and a Release (test variant) build installed or passed with --app.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/kill-test.mjs --udid <id> --bundle-id <id> --game-id <id> [--app <path.app>] [--repo .]

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { createReporter, fail, parseArgs, requireDir, run } from './check-lib.mjs';
import { enableAppImports } from './lib/app-modules.mjs';
import { inspectDatabase, openSqlite, stageDatabase } from './lib/save-db.mjs';

const SPEC = {
  name: 'kill-test',
  summary:
    'Runs the save kill test on an iOS simulator: N launches killed with SIGKILL at growing delays during the startup writes, then the save.db health check (both slots decode, no quarantined rows). Never runs without --udid (or --create) and --bundle-id.',
  usage: '--udid <id>|--create --bundle-id <id> --game-id <id> [--app <path.app>] [--repo <dir>] [--kills <n>] [--step-ms <ms>] [--dry-run]',
  options: {
    udid: { type: 'string', value: 'id', help: 'The simulator to use (a dedicated one: this test kills apps on it)' },
    create: { type: 'boolean', help: 'Create a fresh simulator "e07-kill-test" and delete it afterwards' },
    'device-type': { type: 'string', default: 'iPhone 17', value: 'name', help: 'Device type for --create' },
    runtime: { type: 'string', default: 'com.apple.CoreSimulator.SimRuntime.iOS-26-5', value: 'id', help: 'Runtime for --create' },
    app: { type: 'string', value: 'path', help: 'A built .app to install first (Release, test variant)' },
    'bundle-id': { type: 'string', value: 'id', help: 'The app bundle id' },
    'game-id': { type: 'string', value: 'id', help: 'The gameId the save must carry' },
    kills: { type: 'string', default: '12', value: 'n', help: 'How many launch-and-kill rounds' },
    'step-ms': { type: 'string', default: '80', value: 'ms', help: 'Delay step: round i kills after i x step ms' },
    repo: { type: 'string', value: 'dir', help: "App repo root: also decode both slots with the app's own decodeSlot (schema and migrations)" },
    'dry-run': { type: 'boolean', help: 'Print the commands without running them (ends with exit 2, never PASS)' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: 0 },
  details: [
    'Pass criteria: every round launched and was killed, then inspect finds both slots ok and',
    'save_quarantine empty (rules from inspect-save: slot-missing, checksum, json, quarantine, ...).',
    'The mid-level kill (play N moves, kill, relaunch, assert the paused Game screen) is a Maestro flow.',
  ].join('\n'),
};

/** Synchronous sleep without a child process (the agent's own `sleep` may be blocked). */
function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

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

async function loadDecoder(repo, gameId) {
  if (repo === undefined) return undefined;
  const app = enableAppImports(requireDir(repo, 'app repo root'));
  const codec = await app.load('packages/shell/src/services/save/save-codec.ts');
  return (record) => codec.decodeSlot(record, gameId);
}

run(async () => {
  const { options } = parseArgs(process.argv.slice(2), SPEC);
  if (options['bundle-id'] === undefined || options['game-id'] === undefined) fail('--bundle-id and --game-id are required');
  if (options.udid === undefined && !options.create) fail('pass --udid <id> (a dedicated simulator) or --create');
  if (options.create && options.app === undefined) fail('--create makes an empty simulator: pass --app <path/to/App.app> too', 'Build the Release test-variant simulator app first, then pass its .app path.');
  if (options.app !== undefined && !options['dry-run'] && !existsSync(options.app)) fail(`no app at ${options.app}`, 'Build the Release (test variant) simulator app first.');
  const kills = Number(options.kills);
  const stepMs = Number(options['step-ms']);
  if (!Number.isInteger(kills) || kills < 1 || !Number.isInteger(stepMs) || stepMs < 1) fail('--kills and --step-ms must be positive whole numbers');
  const DatabaseSync = await openSqlite();
  if (DatabaseSync === null) fail('node:sqlite is not available in this Node', 'Use Node 22.13 or newer.');
  const dryRun = options['dry-run'];
  const decode = await loadDecoder(options.repo, options['game-id']);
  const udid = simulatorFor(options);
  const report = createReporter({ name: 'kill-test', json: options.json });
  try {
    prepareSimulator(udid, options);
    killRounds(udid, options['bundle-id'], { kills, stepMs, dryRun });
    if (dryRun) {
      console.log('would inspect Documents/SQLite/save.db of the app container');
      // A plan proves nothing: never end a dry run with RESULT: PASS.
      fail(`dry run: printed the plan for ${kills} rounds, killed nothing`, 'Run again without --dry-run on a dedicated simulator with the Release test build installed.');
    }
    simctl(['terminate', udid, options['bundle-id']], { allowFail: true });
    const container = simctl(['get_app_container', udid, options['bundle-id'], 'data']);
    inspectAppDatabase(DatabaseSync, join(container, 'Documents', 'SQLite', 'save.db'), { gameId: options['game-id'], decode }, report);
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
