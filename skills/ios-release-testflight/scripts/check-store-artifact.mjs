#!/usr/bin/env node
// check-store-artifact.mjs: the store-artifact gate on an exported .ipa (or its unpacked
// Payload/<App>.app), run before --validate-app and again before the owner is told a build is
// ready. It proves what players receive: no debug code, no StoreKit test files, no debug
// entitlement, the right variant, AdMob app ID (never a scaffold placeholder), the app id
// io.applander.<game>, the App Tracking Transparency text in every app language, version and build
// number, built by Xcode 26.6, and a complete Shell (no shell-slice.json in the repo it was built
// from, no NotBuiltScreen route, no placeholder in the bundle).
// Run from the repo root: node ${CLAUDE_SKILL_DIR}/scripts/check-store-artifact.mjs --ipa apps/<game>/build/export/<App>.ipa --variant store --ads live --version 1.0.0 --build 8 --game <game-id> .
// --unsigned is the keyless release rehearsal only (an archive built with CODE_SIGNING_ALLOWED=NO):
// it prints REHEARSAL first, reports the signing rule as SKIP and keeps every other rule strict.
// A scaffold placeholder (owner steps G3 and G5) is reported under owner-placeholder and the line
// before RESULT is 'OWNER STEPS PENDING: G3, G5'; the result stays FAIL in every mode.
// release-ios.ts never passes it, and a REHEARSAL result is never release evidence.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { createReporter, fail, makeTempDir, parseArgs, removeTempDir, requireDir, run, toPosix, walk } from './check-lib.mjs';
import { parsePlistXml, plistGet, readPlist } from './lib/plist.mjs';
import { NOT_BUILT_TESTID, partialShellProblems } from './lib/shell-complete.mjs';
import { bundleIdProblem, finishWithOwnerSteps, ownerPlaceholderOf, ownerPlaceholderProblem, placeholdersInText } from './lib/ship-placeholders.mjs';
import { trackingTextProblems } from './lib/tracking-text.mjs';

export { PLACEHOLDERS } from './lib/ship-placeholders.mjs';

const SAMPLE_APP_ID = 'ca-app-pub-3940256099942544~1458002511';
const LIVE_APP_ID = /^ca-app-pub-\d{16}~\d{10}$/;
const SENTINEL = 'SHELL_TEST_BUILD_ONLY';
const ALLOWED = { test: ['off', 'test'], store: ['off', 'live'] };

const SPEC = {
  name: 'check-store-artifact',
  summary: 'The store-artifact gate: checks an exported .ipa (or Payload/<App>.app) for its variant, test code, StoreKit test files, get-task-allow, AdMob app ID, app id, tracking text, Info.plist keys, version, build number and Xcode.',
  usage: '(--ipa <file.ipa> | --app <Payload/App.app>) --variant test|store --ads off|test|live --version X.Y.Z --build N [--game <game-id>] [--unsigned] [options] [repo-root]',
  options: {
    ipa: { type: 'string', help: 'The exported .ipa (unzipped into a temporary folder)' },
    app: { type: 'string', help: 'An already unpacked Payload/<App>.app folder' },
    variant: { type: 'string', help: 'APP_VARIANT of the release: test or store' },
    ads: { type: 'string', help: 'ADS_MODE of the release: off, test or live' },
    version: { type: 'string', help: 'Expected CFBundleShortVersionString (game.config.ts version)' },
    build: { type: 'string', help: 'Expected CFBundleVersion (the new build number)' },
    xcode: { type: 'string', default: '26.6', help: 'Xcode that must have built it (Info.plist DTXcode)' },
    entitlements: { type: 'string', help: 'Entitlements plist to use instead of running codesign -d (tests only)' },
    game: { type: 'string', help: 'The game id: CFBundleIdentifier must be io.applander.<id without hyphens> (without it the form is checked)' },
    unsigned: { type: 'boolean', help: "Keyless release rehearsal (archive built with CODE_SIGNING_ALLOWED=NO): prints 'REHEARSAL: not a release gate' first and reports only the signing and get-task-allow rule as SKIP; never passed by release:ios" },
    json: { type: 'boolean', help: 'Also print the problems as JSON' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'repo-root (default .): the app repo the artifact was built from, for the shell-complete rule.',
    '',
    'Rules (store builds run all; test builds run the ones marked *):',
    ' *identity         CFBundleShortVersionString, CFBundleVersion, DTXcode, DTPlatformName iphoneos',
    ' *constants        EXConstants.bundle/app.config extra.appVariant / extra.adsMode match the release',
    ' *get-task-allow   the app is signed and its entitlements do not grant get-task-allow (a debug entitlement);',
    '                   with --unsigned (rehearsal only) an app without a signature is a SKIP line',
    ' *ad-app-id        GADApplicationIdentifier: a real ID for live, the Google sample ID otherwise',
    ' *owner-placeholder a scaffold value the owner replaces, by field: the AdMob app id',
    '                   ca-app-pub-1234567890123456~1234567890 and units /1111111111, /2222222222, /3333333333 (owner',
    '                   step G5); in store builds the links example.com and support@example.com (owner step G3).',
    "                   The line before RESULT is then 'OWNER STEPS PENDING: G3, G5' (the steps still pending) and the",
    '                   result stays FAIL, with or without --unsigned: until the owner supplies them these are the only',
    '                   expected FAIL lines. A store/off archive carries no AdMob ids, so a store/off rehearsal',
    '                   (--unsigned) stands in for the store/live build: it reads the AdMob ids from',
    '                   <repo-root>/apps/<game>/game.config.ts (--game required) and reports their placeholders',
    '                   there, so it ends with the same OWNER STEPS PENDING line as check-release-setup',
    ' *bundle-id        CFBundleIdentifier is io.applander.<game id without hyphens> (owner decision O4), never',
    '                   com.example.*; with --game it is exactly that game\'s id',
    ' *att-string       Info.plist NSUserTrackingUsageDescription and en, de, fa and ckb.lproj/InfoPlist.strings each',
    '                   hold the tracking prompt text (owner decision O1; the prompt crashes the app without it)',
    '  test-code        main.jsbundle contains no SHELL_TEST_BUILD_ONLY',
    '  test-artefacts   no *.storekit and no *.xctest inside the app',
    '  encryption-flag  ITSAppUsesNonExemptEncryption is false',
    '  privacy-manifest PrivacyInfo.xcprivacy is present',
    '  ats              NSAllowsArbitraryLoads is absent or false',
    ' *shell-complete   a slice never ships: the repo has shell-slice.json or a route on NotBuiltScreen, or',
    '                   main.jsbundle contains the placeholder (testID not-built.screen)',
  ].join('\n'),
};

/** A keyless rehearsal of a store/off archive: it stands in for the store/live build. */
const isOffRehearsal = (options) => options.unsigned === true && options.variant === 'store' && options.ads === 'off';

function validate(options) {
  if (!options.ipa && !options.app) fail('nothing to check: pass --ipa or --app', 'Point it at apps/<game>/build/export/<App>.ipa.');
  if (isOffRehearsal(options) && !options.game) fail('a store/off rehearsal (--unsigned) needs --game <game-id>: it reads the live AdMob ids from apps/<game>/game.config.ts', 'Pass --game <game-id> and run from the repo root (or pass repo-root).');
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
  const { info, appDir, options, problem, extra } = ctx;
  for (const [key, want] of [['appVariant', options.variant], ['adsMode', options.ads]]) {
    if (extra[key] !== want) problem('EXConstants.bundle/app.config', 'constants', `extra.${key} is "${extra[key] ?? 'missing'}", expected "${want}"`, 'Export APP_VARIANT, EXPO_PUBLIC_APP_VARIANT and ADS_MODE once for the whole release run.');
  }
  const appId = info.GADApplicationIdentifier;
  const appIdPlaceholder = ownerPlaceholderOf(appId);
  const isLive = typeof appId === 'string' && LIVE_APP_ID.test(appId) && appId !== SAMPLE_APP_ID;
  if (appIdPlaceholder !== null) ctx.ownerPlaceholder('Info.plist', appIdPlaceholder, 'Info.plist GADApplicationIdentifier');
  else if (options.ads === 'live' ? !isLive : appId !== SAMPLE_APP_ID) problem('Info.plist', 'ad-app-id', `GADApplicationIdentifier is "${appId ?? 'missing'}", expected ${options.ads === 'live' ? "the game's real AdMob app ID" : 'the Google sample ID'}`, 'Live builds take the real ID from game.config.ts (owner step G5); every other build uses the sample ID.');
  for (const [slot, unit] of Object.entries(extra.adUnits ?? {})) {
    const unitPlaceholder = ownerPlaceholderOf(unit);
    if (unitPlaceholder !== null) ctx.ownerPlaceholder('EXConstants.bundle/app.config', unitPlaceholder, `extra.adUnits.${slot}`);
  }
  const idProblem = bundleIdProblem(info.CFBundleIdentifier, options.game ?? null);
  if (idProblem !== null) problem('Info.plist', 'bundle-id', `CFBundleIdentifier ${idProblem}`, 'game.config.ts bundleId is io.applander.<game id without hyphens> (owner decision O4; withShell refuses any other); prebuild with --clean and archive again.');
  for (const found of trackingTextProblems(appDir, info, readPlist)) problem(found.file, 'att-string', found.message, "shell-plugins.ts adds ['expo-tracking-transparency', { userTrackingPermission }] and withShell writes locales.<lang>.ios.NSUserTrackingUsageDescription from the Shell catalogs; prebuild with --clean (owner decision O1).");
  const entitlements = readEntitlements(appDir, options);
  if (entitlements === null && options.unsigned) ctx.skip('', 'get-task-allow', 'REHEARSAL: the app has no signature (CODE_SIGNING_ALLOWED=NO); the release gate runs on the signed export');
  else if (entitlements === null) problem('', 'get-task-allow', 'the app is not signed (codesign -d failed)', 'Export with the team API key; an unsigned app cannot be uploaded. A keyless rehearsal archive passes --unsigned and is never release evidence.');
  else if (entitlements['get-task-allow'] === true) problem('', 'get-task-allow', 'the entitlements grant get-task-allow (a debug entitlement from the StoreKit harness)', 'Keep the harness entitlement in Debug only; archive the Release configuration.');
}

/** Test and store builds alike: testers and players never get a placeholder screen. */
function checkShellComplete(ctx, root, report) {
  for (const found of partialShellProblems(root)) report.problem({ ...found, rule: 'shell-complete' });
  const bundlePath = join(ctx.appDir, 'main.jsbundle');
  if (existsSync(bundlePath) && readFileSync(bundlePath).toString('latin1').includes(NOT_BUILT_TESTID)) ctx.problem('main.jsbundle', 'shell-complete', `contains the NotBuiltScreen placeholder (${NOT_BUILT_TESTID}): a route of this build opens a screen that was never built`, 'Build the screen, register it in root-stack.tsx, delete shell-slice.json, then archive again with a new build number.');
}

/**
 * A store/off archive carries no AdMob ids (Google's sample app id, no units), yet the store/live
 * build it rehearses carries the owner's (owner step G5). So a store/off rehearsal reads the ids from
 * game.config.ts and reports each placeholder there: the rehearsal names every owner step still
 * pending, exactly as check-release-setup and check-game-app --stage complete do (D68).
 */
function checkRehearsalAdIds(ctx, root, report) {
  if (!isOffRehearsal(ctx.options)) return;
  const file = `apps/${ctx.options.game}/game.config.ts`;
  const path = join(root, file);
  if (!existsSync(path)) fail(`${file} not found under ${root}: a store/off rehearsal reads the live AdMob ids from it`, 'Run from the repo root the archive was built from (or pass it as repo-root), with --game <game-id>.');
  const text = readFileSync(path, 'utf8');
  for (const found of placeholdersInText(text)) {
    if (found.entry.ownerStep !== 'G5') continue;
    const line = text.slice(0, found.index).split('\n').length;
    report.problem(ownerPlaceholderProblem({ entry: found.entry, where: `${found.entry.field} (for the store/live build this store/off rehearsal stands in for)`, file, line }));
  }
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
  const links = ctx.extra.game?.links ?? {};
  for (const [where, value] of [['extra.game.links.privacyPolicy.host', links.privacyPolicy?.host], ['extra.game.links.supportEmail', links.supportEmail]]) {
    const placeholder = ownerPlaceholderOf(value);
    if (placeholder !== null) ctx.ownerPlaceholder('EXConstants.bundle/app.config', placeholder, where);
  }
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  if (options.unsigned) console.log('REHEARSAL: not a release gate (--unsigned: an archive built without the signing key; only the signing rule is SKIP, every other rule stays strict)');
  validate(options);
  const root = requireDir(positionals[0] ?? '.', 'repo root');
  const { appDir, cleanup } = locateApp(options);
  try {
    const report = createReporter({ name: 'check-store-artifact', json: options.json });
    const shown = options.app ? toPosix(relative(process.cwd(), appDir)) || appDir : `${options.ipa}:Payload/${appDir.split('/').pop()}`;
    const problem = (file, rule, message, fix) => report.problem({ file: file ? `${shown}/${file}` : shown, rule, message, fix });
    const skip = (file, rule, message) => report.skip({ file: file ? `${shown}/${file}` : shown, rule, message });
    const ownerPlaceholder = (file, entry, where) => report.problem(ownerPlaceholderProblem({ entry, where, file: `${shown}/${file}` }));
    const constantsPath = join(appDir, 'EXConstants.bundle', 'app.config');
    const extra = existsSync(constantsPath) ? JSON.parse(readFileSync(constantsPath, 'utf8')).extra ?? {} : {};
    const ctx = { info: readPlist(join(appDir, 'Info.plist')), appDir, options, problem, skip, ownerPlaceholder, extra };
    checkIdentity(ctx);
    checkVariant(ctx);
    checkShellComplete(ctx, root, report);
    if (options.variant === 'store') checkStoreOnly(ctx);
    checkRehearsalAdIds(ctx, root, report);
    return finishWithOwnerSteps(report, { checked: 1, unit: `${options.variant} build` });
  } finally {
    cleanup();
  }
});
