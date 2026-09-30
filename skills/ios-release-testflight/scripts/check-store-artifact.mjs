#!/usr/bin/env node
// check-store-artifact.mjs: the store-artifact gate on an exported .ipa (or its unpacked
// Payload/<App>.app), run before --validate-app and again before the owner is told a build is
// ready. It proves what players receive: no debug code, no StoreKit test files, no debug
// entitlement, the right variant, AdMob app ID, version and build number, built by Xcode 26.6, and
// a complete Shell (no shell-slice.json in the repo it was built from, no NotBuiltScreen route, no
// placeholder in the bundle).
// Run from the repo root: node ${CLAUDE_SKILL_DIR}/scripts/check-store-artifact.mjs --ipa apps/<game>/build/export/<App>.ipa --variant store --ads live --version 1.0.0 --build 8 .
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { createReporter, fail, makeTempDir, parseArgs, removeTempDir, requireDir, run, toPosix, walk } from './check-lib.mjs';
import { parsePlistXml, plistGet, readPlist } from './lib/plist.mjs';
import { NOT_BUILT_TESTID, partialShellProblems } from './lib/shell-complete.mjs';

const SAMPLE_APP_ID = 'ca-app-pub-3940256099942544~1458002511';
const LIVE_APP_ID = /^ca-app-pub-\d{16}~\d{10}$/;
const SENTINEL = 'SHELL_TEST_BUILD_ONLY';
const ALLOWED = { test: ['off', 'test'], store: ['off', 'live'] };

const SPEC = {
  name: 'check-store-artifact',
  summary: 'The store-artifact gate: checks an exported .ipa (or Payload/<App>.app) for its variant, test code, StoreKit test files, get-task-allow, AdMob app ID, Info.plist keys, version, build number and Xcode.',
  usage: '(--ipa <file.ipa> | --app <Payload/App.app>) --variant test|store --ads off|test|live --version X.Y.Z --build N [options] [repo-root]',
  options: {
    ipa: { type: 'string', help: 'The exported .ipa (unzipped into a temporary folder)' },
    app: { type: 'string', help: 'An already unpacked Payload/<App>.app folder' },
    variant: { type: 'string', help: 'APP_VARIANT of the release: test or store' },
    ads: { type: 'string', help: 'ADS_MODE of the release: off, test or live' },
    version: { type: 'string', help: 'Expected CFBundleShortVersionString (game.config.ts version)' },
    build: { type: 'string', help: 'Expected CFBundleVersion (the new build number)' },
    xcode: { type: 'string', default: '26.6', help: 'Xcode that must have built it (Info.plist DTXcode)' },
    entitlements: { type: 'string', help: 'Entitlements plist to use instead of running codesign -d (tests only)' },
    json: { type: 'boolean', help: 'Also print the problems as JSON' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'repo-root (default .): the app repo the artifact was built from, for the shell-complete rule.',
    '',
    'Rules (store builds run all; test builds run the ones marked *):',
    ' *identity         CFBundleShortVersionString, CFBundleVersion, DTXcode, DTPlatformName iphoneos',
    ' *constants        EXConstants.bundle/app.config extra.appVariant / extra.adsMode match the release',
    ' *get-task-allow   the signed entitlements do not grant get-task-allow (a debug entitlement)',
    ' *ad-app-id        GADApplicationIdentifier: a real ID for live, the Google sample ID otherwise',
    '  test-code        main.jsbundle contains no SHELL_TEST_BUILD_ONLY',
    '  test-artefacts   no *.storekit and no *.xctest inside the app',
    '  encryption-flag  ITSAppUsesNonExemptEncryption is false',
    '  privacy-manifest PrivacyInfo.xcprivacy is present',
    '  ats              NSAllowsArbitraryLoads is absent or false',
    ' *shell-complete   a slice never ships: the repo has shell-slice.json or a route on NotBuiltScreen, or',
    '                   main.jsbundle contains the placeholder (testID not-built.screen)',
  ].join('\n'),
};

function validate(options) {
  if (!options.ipa && !options.app) fail('nothing to check: pass --ipa or --app', 'Point it at apps/<game>/build/export/<App>.ipa.');
  if (!ALLOWED[options.variant]) fail(`--variant must be test or store, got "${options.variant ?? ''}"`, 'Pass the APP_VARIANT of the release.');
  if (!ALLOWED[options.variant].includes(options.ads)) fail(`--ads ${options.ads ?? '(missing)'} is not allowed with --variant ${options.variant}`, `Use one of: ${ALLOWED[options.variant].join(', ')}.`);
  if (!/^\d+\.\d+\.\d+$/.test(options.version ?? '') || !/^\d+$/.test(options.build ?? '')) fail('--version X.Y.Z and --build N are required', 'Pass the version and the new build number from game.config.ts.');
}

/** Returns { appDir, cleanup } for --app, or for --ipa after unzipping it. */
function locateApp(options) {
  if (options.app) {
    if (!existsSync(join(options.app, 'Info.plist'))) fail(`nothing to check: ${options.app} has no Info.plist`, 'Pass the Payload/<App>.app folder.');
    return { appDir: options.app, cleanup: () => {} };
  }
  if (!existsSync(options.ipa) || !statSync(options.ipa).isFile()) fail(`nothing to check: ${options.ipa} does not exist`, 'Run the export step first.');
  const temp = makeTempDir('store-artifact-');
  const unzip = spawnSync('unzip', ['-q', options.ipa, '-d', temp], { encoding: 'utf8' });
  if (unzip.status !== 0) fail(`could not unzip ${options.ipa}: ${unzip.stderr.trim()}`, 'The .ipa is a zip file; re-export it.');
  const payload = join(temp, 'Payload');
  const app = existsSync(payload) ? readdirSync(payload).find((name) => name.endsWith('.app')) : undefined;
  if (!app) fail(`${options.ipa} has no Payload/*.app`, 'Re-export the archive.');
  return { appDir: join(payload, app), cleanup: () => removeTempDir(temp) };
}

function readEntitlements(appDir, options) {
  if (options.entitlements) return readPlist(options.entitlements);
  const result = spawnSync('codesign', ['-d', '--entitlements', '-', '--xml', appDir], { encoding: 'utf8' });
  if (result.status !== 0) return null;
  return result.stdout.includes('<plist') ? parsePlistXml(result.stdout) : {};
}

function checkIdentity(ctx) {
  const { info, options, problem } = ctx;
  const wantXcode = options.xcode.split('.').concat(['0', '0']).slice(0, 3).join('');
  if (info.CFBundleShortVersionString !== options.version) problem('Info.plist', 'identity', `CFBundleShortVersionString is "${info.CFBundleShortVersionString}", expected ${options.version}`, 'The version comes only from game.config.ts; prebuild again after changing it.');
  if (String(info.CFBundleVersion) !== options.build) problem('Info.plist', 'identity', `CFBundleVersion is "${info.CFBundleVersion}", expected ${options.build}`, 'release:ios bumps buildNumber before the archive; a stale number means the archive predates the bump.');
  if (String(info.DTXcode ?? '') !== wantXcode) problem('Info.plist', 'identity', `DTXcode is "${info.DTXcode ?? 'missing'}", expected ${wantXcode} (Xcode ${options.xcode})`, 'Archive through release:ios, which selects the pinned Xcode with DEVELOPER_DIR.');
  if (info.DTPlatformName !== 'iphoneos') problem('Info.plist', 'identity', `DTPlatformName is "${info.DTPlatformName}", expected iphoneos`, 'Upload a device archive (generic/platform=iOS), never a simulator build.');
}

function checkVariant(ctx) {
  const { info, appDir, options, problem } = ctx;
  const constantsPath = join(appDir, 'EXConstants.bundle', 'app.config');
  const extra = existsSync(constantsPath) ? JSON.parse(readFileSync(constantsPath, 'utf8')).extra ?? {} : {};
  for (const [key, want] of [['appVariant', options.variant], ['adsMode', options.ads]]) {
    if (extra[key] !== want) problem('EXConstants.bundle/app.config', 'constants', `extra.${key} is "${extra[key] ?? 'missing'}", expected "${want}"`, 'Export APP_VARIANT, EXPO_PUBLIC_APP_VARIANT and ADS_MODE once for the whole release run.');
  }
  const appId = info.GADApplicationIdentifier;
  const isLive = typeof appId === 'string' && LIVE_APP_ID.test(appId) && appId !== SAMPLE_APP_ID;
  if (options.ads === 'live' ? !isLive : appId !== SAMPLE_APP_ID) problem('Info.plist', 'ad-app-id', `GADApplicationIdentifier is "${appId ?? 'missing'}", expected ${options.ads === 'live' ? "the game's real AdMob app ID" : 'the Google sample ID'}`, 'Live builds take the real ID from game.config.ts (owner step G5); every other build uses the sample ID.');
  const entitlements = readEntitlements(appDir, options);
  if (entitlements === null) problem('', 'get-task-allow', 'the app is not signed (codesign -d failed)', 'Export with the team API key; an unsigned app cannot be uploaded.');
  else if (entitlements['get-task-allow'] === true) problem('', 'get-task-allow', 'the entitlements grant get-task-allow (a debug entitlement from the StoreKit harness)', 'Keep the harness entitlement in Debug only; archive the Release configuration.');
}

/** Test and store builds alike: testers and players never get a placeholder screen. */
function checkShellComplete(ctx, root, report) {
  for (const found of partialShellProblems(root)) report.problem({ ...found, rule: 'shell-complete' });
  const bundlePath = join(ctx.appDir, 'main.jsbundle');
  if (existsSync(bundlePath) && readFileSync(bundlePath).toString('latin1').includes(NOT_BUILT_TESTID)) ctx.problem('main.jsbundle', 'shell-complete', `contains the NotBuiltScreen placeholder (${NOT_BUILT_TESTID}): a route of this build opens a screen that was never built`, 'Build the screen, register it in root-stack.tsx, delete shell-slice.json, then archive again with a new build number.');
}

function checkStoreOnly(ctx) {
  const { info, appDir, problem } = ctx;
  const bundlePath = join(appDir, 'main.jsbundle');
  const count = existsSync(bundlePath) ? readFileSync(bundlePath).toString('latin1').split(SENTINEL).length - 1 : 0;
  if (!existsSync(bundlePath)) problem('main.jsbundle', 'test-code', 'main.jsbundle is missing', 'Archive the Release configuration, which embeds the bundle.');
  if (count > 0) problem('main.jsbundle', 'test-code', `contains ${SENTINEL} ${count} time(s): the debug menu and test hooks would ship`, 'Fix the Metro cache key, the test-only gate or the lost variables (ios-simulator-build proves them), then rebuild with a new build number.');
  for (const rel of walk(appDir, { include: ['*.storekit', '*.xctest', '*.xctest/**'] })) problem(rel, 'test-artefacts', 'StoreKit test configuration or test bundle in the store build', 'The StoreKit harness belongs to test builds only.');
  if (info.ITSAppUsesNonExemptEncryption !== false) problem('Info.plist', 'encryption-flag', 'ITSAppUsesNonExemptEncryption is not false', 'withShell sets ios.config.usesNonExemptEncryption: false (no export-compliance question per build).');
  if (!existsSync(join(appDir, 'PrivacyInfo.xcprivacy'))) problem('PrivacyInfo.xcprivacy', 'privacy-manifest', 'the privacy manifest is missing', 'Declare ios.privacyManifests through withShell and prebuild again.');
  if (plistGet(info, 'NSAppTransportSecurity.NSAllowsArbitraryLoads') === true) problem('Info.plist', 'ats', 'NSAllowsArbitraryLoads is true', 'Remove the ATS exception.');
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  validate(options);
  const root = requireDir(positionals[0] ?? '.', 'repo root');
  const { appDir, cleanup } = locateApp(options);
  try {
    const report = createReporter({ name: 'check-store-artifact', json: options.json });
    const shown = options.app ? toPosix(relative(process.cwd(), appDir)) || appDir : `${options.ipa}:Payload/${appDir.split('/').pop()}`;
    const problem = (file, rule, message, fix) => report.problem({ file: file ? `${shown}/${file}` : shown, rule, message, fix });
    const ctx = { info: readPlist(join(appDir, 'Info.plist')), appDir, options, problem };
    checkIdentity(ctx);
    checkVariant(ctx);
    checkShellComplete(ctx, root, report);
    if (options.variant === 'store') checkStoreOnly(ctx);
    return report.finish({ checked: 1, unit: `${options.variant} build` });
  } finally {
    cleanup();
  }
});
