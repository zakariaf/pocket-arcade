#!/usr/bin/env node
// check-emu-app.mjs: checks a built Release APK for the variant it claims to be: the package, the
// test-only code present or absent in assets/index.android.bundle, the variant in assets/app.config
// and in the E07AppVariant manifest meta-data, the AdMob app id, the owner placeholders, the
// permissions against the allowlist, debuggable, supportsRtl, allowBackup (D5), the SDK levels and,
// with --screenshot, that the screen is not blank. This is how "the store build carries no test
// code" is proven on Android. The manifest is read through the pinned build-tools' aapt2.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/check-emu-app.mjs --apk <apk> --variant test --ads off --game line-siege
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createReporter, fail, parseArgs, run, toPosix } from './check-lib.mjs';
import { parseBadging, parseXmlTree } from './lib/apk.mjs';
import { findElements, metaDataValue } from './lib/manifest-tree.mjs';
import { dominantColour, readPng } from './lib/png.mjs';
import { ANDROID_AD_IDS_MISSING, appIdOf, bundleIdProblem, finishWithOwnerSteps, ownerPlaceholderOf, ownerPlaceholderProblem } from './lib/ship-placeholders.mjs';
import { readZipEntry, readZipIndex } from './lib/zip.mjs';

const SAMPLE_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const LIVE_APP_ID = /^ca-app-pub-\d{16}~\d{10}$/;
const APP_ID_META = 'com.google.android.gms.ads.APPLICATION_ID';
const VARIANT_META = 'E07AppVariant';
const SENTINEL = 'SHELL_TEST_BUILD_ONLY';
const ALLOWED = { test: ['off', 'test'], store: ['off', 'live'] };
const MIN_SDK = 24;
const TARGET_SDK = 36;
const BUILD_TOOLS = '36.0.0';
const BLANK_SHARE = 0.99;

const SPEC = {
  name: 'check-emu-app',
  summary: 'Checks a built Release APK against its build variant: package, test-only code present (test) or absent (store), the variant in app.config and the manifest, the AdMob app id, owner placeholders, permissions, debuggable, supportsRtl, allowBackup, SDK levels, and a screenshot that is not blank.',
  usage: '--apk <app-release.apk> --variant test|store --ads off|test|live --game <game-id> [--screenshot <png>] [--aapt2 <path>] [options]',
  options: {
    apk: { type: 'string', help: 'The built APK (apps/<game>/android/app/build/outputs/apk/release/app-release.apk)' },
    variant: { type: 'string', help: 'APP_VARIANT the build was made with: test or store' },
    ads: { type: 'string', help: 'ADS_MODE the build was made with: off, test or live' },
    game: { type: 'string', help: 'The game id: the package must be io.applander.<id without hyphens>' },
    screenshot: { type: 'string', help: 'The smoke screenshot build:android:emu wrote (reports/android/<game>/smoke-<variant>-<ads>.png)' },
    aapt2: { type: 'string', help: `aapt2 to dump the manifest with (default: $ANDROID_HOME/build-tools/${BUILD_TOOLS}/aapt2)` },
    json: { type: 'boolean', help: 'Also print the problems as JSON' },
  },
  positionals: { min: 0, max: 0 },
  details: [
    'Rules:',
    '  package            the package is io.applander.<game id without hyphens> (owner decision O4)',
    '  test-code          assets/index.android.bundle contains SHELL_TEST_BUILD_ONLY in test builds, never in store builds',
    '  constants-variant  assets/app.config extra.appVariant / extra.adsMode match --variant / --ads',
    '  variant            the E07AppVariant manifest meta-data equals --variant',
    `  ad-app-id          ${APP_ID_META}: Google's Android sample id for off/test, a real id (never the sample) for live`,
    '  owner-placeholder  a value the owner supplies, by field: in store builds the links example.com and',
    '                     support@example.com (owner step G3); the AdMob placeholders (G5); a live build without an',
    "                     Android AdMob app id (game.config.ts ads.ids.android: null, owner step GP5). The line before",
    "                     RESULT is then 'OWNER STEPS PENDING: ...' and the result stays FAIL, by design",
    '  permission         a uses-permission outside assets/permission-allowlist.json (spec N3)',
    '  debuggable         the application is debuggable',
    '  supports-rtl       application android:supportsRtl is not true (fa and ckb, N6 and N11)',
    '  allow-backup       application android:allowBackup is false (the save is backed up, decision D5)',
    `  sdk-levels         minSdk below ${MIN_SDK} or targetSdk below ${TARGET_SDK}`,
    `  screenshot         --screenshot: one colour covers ${BLANK_SHARE * 100}% of the screen (crashed, still loading, drew nothing)`,
    '',
    'Exit 2 when the APK, the screenshot or aapt2 is missing, or --variant/--ads is not an allowed pair.',
  ].join('\n'),
};

const SKILL_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

function readInputs(options) {
  if (!options.apk) fail('nothing to check: --apk is required', 'Pass the APK that build:android:emu printed.');
  if (!existsSync(options.apk) || !statSync(options.apk).isFile()) fail(`nothing to check: ${options.apk} is not a file`, 'Build first (npm run build:android:emu), then pass apps/<game>/android/app/build/outputs/apk/release/app-release.apk.');
  if (!ALLOWED[options.variant]) fail(`--variant must be test or store, got "${options.variant ?? ''}"`, 'Pass the APP_VARIANT the build was made with.');
  if (!ALLOWED[options.variant].includes(options.ads)) fail(`--ads ${options.ads ?? '(missing)'} is not allowed with --variant ${options.variant}`, `Use one of: ${ALLOWED[options.variant].join(', ')}.`);
  if (!options.game) fail('--game is required', 'Pass the game id, for example --game line-siege.');
  if (options.screenshot && !existsSync(options.screenshot)) fail(`nothing to check: ${options.screenshot} does not exist`, 'Pass the screenshot path build:android:emu printed.');
  const aapt2 = options.aapt2 ?? join(process.env.ANDROID_HOME ?? join(homedir(), 'Library', 'Android', 'sdk'), 'build-tools', BUILD_TOOLS, 'aapt2');
  if (!existsSync(aapt2)) fail(`aapt2 not found at ${aapt2}`, `Install build-tools ${BUILD_TOOLS} (owner step: sdkmanager "build-tools;${BUILD_TOOLS}", a download) or pass --aapt2 <path>.`);
  const dump = (args) => execFileSync(aapt2, ['dump', ...args, options.apk], { encoding: 'utf8', maxBuffer: 64 << 20 });
  let zip;
  try {
    zip = readZipIndex(options.apk);
  } catch (error) {
    fail(`${options.apk} cannot be read as an APK (${error.message})`, 'Rebuild; Gradle writes a complete zip.');
  }
  return {
    where: toPosix(relative(process.cwd(), options.apk)) || options.apk,
    badging: parseBadging(dump(['badging'])),
    manifest: parseXmlTree(dump(['xmltree', '--file', 'AndroidManifest.xml'])),
    zip,
  };
}

function checkPackage({ badging, where, options, report }) {
  const problem = bundleIdProblem(badging.package, options.game);
  if (problem !== null) report.problem({ file: where, rule: 'package', message: `package ${problem}`, fix: `game.config.ts bundleId is ${appIdOf(options.game)}; withShell writes it as android.package. Prebuild with --clean and build again.` });
}

function checkTestCode({ zip, where, options, report }) {
  const file = `${where}!assets/index.android.bundle`;
  const bundle = readZipEntry(zip, 'assets/index.android.bundle');
  if (bundle === null) {
    report.problem({ file, rule: 'test-code', message: 'the APK has no assets/index.android.bundle, so the JS was not embedded', fix: 'Build with assembleRelease (a Debug build loads JS from Metro).' });
    return;
  }
  const count = bundle.toString('latin1').split(SENTINEL).length - 1;
  if (options.variant === 'store' && count > 0) report.problem({ file, rule: 'test-code', message: `store build contains ${SENTINEL} ${count} time(s): the debug menu and test hooks shipped`, fix: 'Key the Metro cache on the variant, reach test code only through src/app/test-only.ts, keep APP_VARIANT and EXPO_PUBLIC_APP_VARIANT exported for the whole build, then rebuild.' });
  if (options.variant === 'test' && count === 0) report.problem({ file, rule: 'test-code', message: `test build does not contain ${SENTINEL}: it was bundled as a store build`, fix: 'Export APP_VARIANT=test and EXPO_PUBLIC_APP_VARIANT=test for the whole run and rebuild (a stale Metro cache or a lost variable causes this).' });
}

function readExtra({ zip, where }) {
  const config = readZipEntry(zip, 'assets/app.config');
  if (config === null) return null;
  try {
    return JSON.parse(config.toString('utf8')).extra ?? {};
  } catch (error) {
    fail(`${where}!assets/app.config is not JSON (${error.message})`, 'Rebuild; expo-constants writes it during the Gradle build.');
  }
}

function checkConstants(context) {
  const { where, options, report } = context;
  const file = `${where}!assets/app.config`;
  const extra = readExtra(context);
  if (extra === null) {
    report.problem({ file, rule: 'constants-variant', message: 'assets/app.config is missing', fix: "expo-constants' Gradle task did not run; prebuild with --clean and rebuild." });
    return;
  }
  for (const [key, want] of [['appVariant', options.variant], ['adsMode', options.ads]]) {
    if (extra[key] !== want) report.problem({ file, rule: 'constants-variant', message: `extra.${key} is "${extra[key] ?? 'missing'}", expected "${want}"`, fix: 'The variables changed between prebuild and Gradle: export APP_VARIANT, EXPO_PUBLIC_APP_VARIANT and ADS_MODE once for the whole run and rebuild.' });
  }
  const units = typeof extra.adUnits === 'object' && extra.adUnits !== null ? Object.entries(extra.adUnits) : [];
  const links = options.variant === 'store' ? (extra.game?.links ?? {}) : {};
  const values = [...units.map(([slot, unit]) => [`extra.adUnits.${slot}`, unit]), ['extra.game.links.privacyPolicy.host', links.privacyPolicy?.host], ['extra.game.links.supportEmail', links.supportEmail]];
  for (const [field, value] of values) {
    const placeholder = ownerPlaceholderOf(value);
    if (placeholder !== null) report.problem(ownerPlaceholderProblem({ entry: placeholder, where: field, file }));
  }
}

function checkManifest({ manifest, where, options, report }) {
  const file = `${where}!AndroidManifest.xml`;
  const variant = metaDataValue(manifest, VARIANT_META);
  if (variant !== options.variant) report.problem({ file, rule: 'variant', message: `meta-data ${VARIANT_META} is ${variant === null ? 'missing' : `"${variant}"`}, expected "${options.variant}"`, fix: 'with-app-variant-marker.ts writes the variant into the manifest at prebuild: keep APP_VARIANT exported for the whole run and prebuild with --clean.' });
  const appId = metaDataValue(manifest, APP_ID_META);
  const placeholder = ownerPlaceholderOf(appId);
  const where2 = `AndroidManifest ${APP_ID_META}`;
  if (placeholder !== null) report.problem(ownerPlaceholderProblem({ entry: placeholder, where: where2, file }));
  else if (options.ads === 'live' && appId === null) report.problem(ownerPlaceholderProblem({ entry: ANDROID_AD_IDS_MISSING, where: where2, file }));
  else if (options.ads === 'live' && (!LIVE_APP_ID.test(appId) || appId === SAMPLE_APP_ID)) report.problem({ file, rule: 'ad-app-id', message: `${APP_ID_META} is "${appId}", expected the game's own AdMob Android app id`, fix: "A live build never carries Google's sample id: put the owner's ids in game.config.ts ads.ids.android (owner step GP5) and build with ADS_MODE=live." });
  else if (options.ads !== 'live' && appId !== SAMPLE_APP_ID) report.problem({ file, rule: 'ad-app-id', message: `${APP_ID_META} is ${appId === null ? 'missing' : `"${appId}"`}, expected Google's Android sample id ${SAMPLE_APP_ID}`, fix: 'Non-live builds use the sample app id (a missing id crashes the AdMob SDK at launch); check withShell and ADS_MODE, then prebuild again.' });
  const application = findElements(manifest, 'application')[0]?.attributes ?? {};
  if (application.supportsRtl !== 'true') report.problem({ file, rule: 'supports-rtl', message: `application android:supportsRtl is ${application.supportsRtl ?? 'missing'}`, fix: 'withShell sets android.supportsRtl: true; without it fa and ckb lay out left to right (N6, N11).' });
  if (application.allowBackup === 'false') report.problem({ file, rule: 'allow-backup', message: 'application android:allowBackup is false, so the save is not in the Google device backup', fix: 'withShell keeps allowBackup true with the backup rules that hold SQLite/save.db (decision D5).' });
}

function checkBadging({ badging, manifest, where, report }) {
  const allowlist = JSON.parse(readFileSync(join(SKILL_DIR, 'assets', 'permission-allowlist.json'), 'utf8')).permissions.map((entry) => entry.name.replace('<package>', badging.package ?? ''));
  for (const permission of badging.permissions.filter((name) => !allowlist.includes(name))) report.problem({ file: where, rule: 'permission', message: `uses-permission ${permission} is not on the allowlist`, fix: 'Block it in withShell (android.blockedPermissions) or drop the module that adds it; a new permission needs a reviewed allowlist entry with its source (N3).' });
  const isDebuggable = badging.isDebuggable || findElements(manifest, 'application')[0]?.attributes.debuggable === 'true';
  if (isDebuggable) report.problem({ file: where, rule: 'debuggable', message: 'the application is debuggable', fix: 'Build with assembleRelease from a clean prebuild; never set android:debuggable.' });
  if ((badging.minSdk ?? 0) < MIN_SDK || (badging.targetSdk ?? 0) < TARGET_SDK) report.problem({ file: where, rule: 'sdk-levels', message: `minSdk ${badging.minSdk ?? 'missing'}, targetSdk ${badging.targetSdk ?? 'missing'}; expected minSdk ${MIN_SDK} or more and targetSdk ${TARGET_SDK} or more`, fix: 'Keep the SDK levels of Expo SDK 57 (React Native 0.86.3); Google Play refuses an old targetSdk.' });
}

function checkScreenshot({ options, report }) {
  if (!options.screenshot) return;
  const image = readPng(options.screenshot);
  // The status bar and the gesture bar (about 5% each) are drawn by Android: left out of the test.
  const { hex, share } = dominantColour(image, { top: Math.round(image.height * 0.05), bottom: Math.round(image.height * 0.95) });
  if (share >= BLANK_SHARE) report.problem({ file: toPosix(relative(process.cwd(), options.screenshot)), rule: 'screenshot', message: `${(share * 100).toFixed(1)}% of the screen is ${hex}: the app crashed, is still loading or drew nothing`, fix: 'Open the PNG, read apps/<game>/build/logs/ and adb -s <serial> logcat, relaunch, wait for the ready signal and screenshot again.' });
}

run(async () => {
  const { options } = parseArgs(process.argv.slice(2), SPEC);
  const inputs = readInputs(options);
  const report = createReporter({ name: 'check-emu-app', json: options.json });
  const context = { ...inputs, options, report };
  checkPackage(context);
  checkTestCode(context);
  checkConstants(context);
  checkManifest(context);
  checkBadging(context);
  checkScreenshot(context);
  return finishWithOwnerSteps(report, { checked: 1, unit: `app (${options.variant}/${options.ads})` });
});
