#!/usr/bin/env node
// inspect-save.mjs: reads a Pocket Arcade save.db and says whether it is healthy: both slots
// present, checksums and JSON intact, versions consistent, WAL mode, no quarantined rows. It works
// on a COPY (the app's files are never opened in place). This is the kill test's assertion.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/inspect-save.mjs <save.db|dump.sql>
//      node ${CLAUDE_SKILL_DIR}/scripts/inspect-save.mjs --udid <simulator> --bundle-id <id> --game-id <id>
//      node ${CLAUDE_SKILL_DIR}/scripts/inspect-save.mjs --platform android --serial <serial> --bundle-id <package> --game-id <id>

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

import { createReporter, fail, parseArgs, requireDir, requireFile, run } from './check-lib.mjs';
import { createAndroidDevice, missingSdkParts } from './lib/android-device.mjs';
import { androidSdkRoot } from './lib/android-emu.mjs';
import { enableAppImports } from './lib/app-modules.mjs';
import { appSaveDbPath, inspectDatabase, openSqlite, stageDatabase } from './lib/save-db.mjs';

const SPEC = {
  name: 'inspect-save',
  summary:
    "Checks a Pocket Arcade save.db (a file, a .sql dump, the app's database inside an iOS simulator, or, with --platform android, the app's files/SQLite/ folder pulled over adb from an emulator): both slots present, checksum and JSON intact, schema_version consistent, journal_mode WAL, save_quarantine empty. With --deep it also decodes each slot with the app's own decodeSlot (valibot schema and migrations).",
  usage: '[<save.db|dump.sql>] [--udid <id> --bundle-id <id>] [--platform android --serial <serial> --bundle-id <package> [--sdk <dir>]] [--game-id <id>] [--max-version <n>] [--deep --repo <dir>]',
  options: {
    udid: { type: 'string', value: 'id', help: 'Simulator UDID: read the installed app\'s Documents/SQLite/save.db' },
    platform: { type: 'string', default: 'ios', value: 'ios|android', help: 'android: pull the app\'s files/SQLite/ folder from --serial with adb root (a google_apis emulator)' },
    serial: { type: 'string', value: 'serial', help: 'Android: the emulator, as `adb devices` lists it' },
    sdk: { type: 'string', value: 'dir', help: 'Android: the SDK folder (default: ANDROID_HOME, ANDROID_SDK_ROOT, ~/Library/Android/sdk)' },
    'bundle-id': { type: 'string', value: 'id', help: 'Bundle id of the app on that simulator (Android: its package id)' },
    'game-id': { type: 'string', value: 'id', help: 'Expected gameId inside the document' },
    'max-version': { type: 'string', value: 'n', help: 'Highest schema_version this app knows (a higher one is reported)' },
    'allow-quarantine': { type: 'boolean', help: 'Do not fail on rows in save_quarantine (after a planned damage test)' },
    deep: { type: 'boolean', help: "Also decode every slot with the app's decodeSlot (needs --repo and --game-id)" },
    repo: { type: 'string', value: 'dir', help: 'App repo root for --deep (holds packages/shell/src)' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules: no-save-table, slot-missing, checksum, json, schema-version, newer-version, game-id,',
    'journal-mode, quarantine, decode.',
    '',
    'Examples:',
    '  node inspect-save.mjs ./save.db --game-id line-siege',
    '  node inspect-save.mjs --udid "$UDID" --bundle-id io.applander.linesiege --game-id line-siege',
    '  node inspect-save.mjs --udid "$UDID" --bundle-id io.applander.linesiege --game-id line-siege --deep --repo .',
    '  node inspect-save.mjs --platform android --serial emulator-5554 --bundle-id io.applander.linesiege --game-id line-siege --deep --repo .',
    '',
    'Android: runs adb -s <serial> root (refused on a Play Store image: use a google_apis one), then',
    'adb -s <serial> pull /data/data/<package>/files/SQLite/ into a temporary folder (save.db with its -wal and',
    '-shm), inspects that copy and deletes it.',
  ].join('\n'),
};

/** Pulls the app's save folder from an Android emulator; returns { database, cleanup }. */
function androidDatabase(options) {
  if (options.serial === undefined || options['bundle-id'] === undefined) fail('--platform android needs --serial <serial> and --bundle-id <package>', 'adb devices lists the serial; the package id is io.applander.<game id without hyphens>.');
  if (options.udid !== undefined) fail('--udid is for iOS; on Android pass --serial');
  const sdk = androidSdkRoot(options.sdk);
  const missing = missingSdkParts(sdk, { create: false }).filter((part) => part.includes('adb'));
  if (missing.length > 0) fail(`the Android SDK at ${sdk} lacks ${missing.join(', ')}`, 'Pass --sdk <dir> or set ANDROID_HOME.');
  const device = createAndroidDevice({ sdk, dryRun: false, fail });
  device.useSerial(options.serial);
  device.becomeRoot();
  const pulled = device.pullSaveDb(options['bundle-id']);
  if (!existsSync(pulled.database)) {
    pulled.cleanup();
    fail(`no save.db in the pulled folder of ${options['bundle-id']}`, 'Launch the app once so it writes its first save.');
  }
  return pulled;
}

function simulatorDatabase(udid, bundleId) {
  let container;
  try {
    container = execFileSync('xcrun', ['simctl', 'get_app_container', udid, bundleId, 'data'], { encoding: 'utf8' }).trim();
  } catch (error) {
    fail(`xcrun simctl get_app_container failed: ${String(error.message).split('\n')[0]}`, 'Boot the simulator, install the app, and check the UDID and bundle id (xcrun simctl list devices).');
  }
  const path = appSaveDbPath(container);
  if (!existsSync(path)) fail(`no save.db in ${path}`, 'Launch the app once so it writes its first save.');
  return path;
}

async function loadDecoder(options) {
  if (!options.deep) return undefined;
  if (options.repo === undefined || options['game-id'] === undefined) fail('--deep needs --repo <app repo> and --game-id <id>');
  const repo = requireDir(options.repo, 'app repo root');
  const app = enableAppImports(repo);
  const codec = await app.load('packages/shell/src/services/save/save-codec.ts');
  return (record) => codec.decodeSlot(record, options['game-id']);
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const DatabaseSync = await openSqlite();
  if (DatabaseSync === null) fail('node:sqlite is not available in this Node', 'Use Node 22.13 or newer (the project pins Node 26).');
  let source;
  let pulled;
  if (!['ios', 'android'].includes(options.platform)) fail(`--platform must be ios or android, not "${options.platform}"`);
  if (options.platform === 'android') {
    pulled = androidDatabase(options);
    source = pulled.database;
  } else if (options.serial !== undefined || options.sdk !== undefined) {
    fail('--serial and --sdk are for --platform android');
  } else if (options.udid !== undefined || options['bundle-id'] !== undefined) {
    if (options.udid === undefined || options['bundle-id'] === undefined) fail('--udid and --bundle-id go together');
    source = simulatorDatabase(options.udid, options['bundle-id']);
  } else if (positionals[0] !== undefined) {
    source = requireFile(positionals[0], 'save database');
  } else {
    fail('nothing to inspect: pass a save.db (or .sql dump), or --udid and --bundle-id');
  }
  const maxVersion = options['max-version'] === undefined ? undefined : Number(options['max-version']);
  const decode = await loadDecoder(options);
  const report = createReporter({ name: 'inspect-save', json: options.json });
  const staged = stageDatabase(DatabaseSync, source);
  try {
    const result = inspectDatabase(DatabaseSync, staged.path, {
      gameId: options['game-id'],
      maxVersion,
      allowQuarantine: options['allow-quarantine'],
      decode,
    });
    for (const line of result.lines) console.log(line);
    for (const problem of result.problems) report.problem({ file: source, ...problem });
  } finally {
    staged.cleanup();
    pulled?.cleanup();
  }
  return report.finish({ checked: 1, unit: 'databases' });
});
