#!/usr/bin/env node
// check-sim-app.mjs: checks a built Release simulator app (the .app folder xcodebuild wrote) for the
// variant it claims to be: the right Xcode, the test-only code present or absent, the variant and
// ads mode baked into Info.plist and EXConstants, and the Info.plist keys every Pocket Arcade app
// needs. This is how "the store build carries no test code" is proven before any release.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/check-sim-app.mjs --app <path.app> --variant test --ads test
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { createReporter, fail, parseArgs, run, toPosix, walk } from './check-lib.mjs';
import { plistGet, readPlist } from './lib/plist.mjs';
import { bundleIdProblem, finishWithOwnerSteps, ownerPlaceholderOf, ownerPlaceholderProblem } from './lib/ship-placeholders.mjs';
import { trackingTextProblems } from './lib/tracking-text.mjs';

export { PLACEHOLDERS } from './lib/ship-placeholders.mjs';

const SAMPLE_APP_ID = 'ca-app-pub-3940256099942544~1458002511';
const LIVE_APP_ID = /^ca-app-pub-\d{16}~\d{10}$/;
const SENTINEL = 'SHELL_TEST_BUILD_ONLY';
const ALLOWED = { test: ['off', 'test'], store: ['off', 'live'] };

const SPEC = {
  name: 'check-sim-app',
  summary: 'Checks a built .app against its build variant: Xcode used, platform, test-only code present (test) or absent (store), variant and ads mode in EXConstants, the AdMob app ID, the app id, the tracking prompt text, and the required Info.plist keys.',
  usage: '--app <path.app> --variant test|store --ads off|test|live [--game <game-id>] [options]',
  options: {
    app: { type: 'string', help: 'The built .app folder (apps/<game>/build/dd/Build/Products/Release-iphonesimulator/<Scheme>.app)' },
    variant: { type: 'string', help: 'APP_VARIANT the build was made with: test or store' },
    ads: { type: 'string', help: 'ADS_MODE the build was made with: off, test or live' },
    xcode: { type: 'string', default: '26.6', help: 'Xcode version the build must come from (Info.plist DTXcode)' },
    platform: { type: 'string', default: 'iphonesimulator', help: 'DTPlatformName: iphonesimulator, or iphoneos for a device build' },
    version: { type: 'string', help: 'Expected CFBundleShortVersionString (game.config.ts version)' },
    build: { type: 'string', help: 'Expected CFBundleVersion (game.config.ts buildNumber)' },
    game: { type: 'string', help: 'The game id: CFBundleIdentifier must be io.applander.<id without hyphens> (store builds check the form without it)' },
    json: { type: 'boolean', help: 'Also print the problems as JSON' },
  },
  positionals: { min: 0, max: 0 },
  details: [
    'Rules:',
    '  built-with-xcode    DTXcode matches --xcode (26.6 -> 2660): the pinned Xcode built it',
    '  platform            DTPlatformName matches --platform',
    '  min-ios             MinimumOSVersion is 16.4',
    '  test-code           main.jsbundle contains SHELL_TEST_BUILD_ONLY in test builds and never in store builds',
    '  constants-variant   EXConstants.bundle/app.config extra.appVariant / extra.adsMode match --variant / --ads',
    '  ad-app-id           GADApplicationIdentifier: Google sample ID for off/test, a real ID for live',
    '  owner-placeholder   a scaffold value the owner replaces, by field: the AdMob app id',
    '                      ca-app-pub-1234567890123456~1234567890 and (live) units /1111111111, /2222222222,',
    '                      /3333333333 (owner step G5); in store builds the links example.com and support@example.com',
    "                      (owner step G3). The line before RESULT is then 'OWNER STEPS PENDING: G3, G5' (the steps still",
    '                      pending) and the result stays FAIL: until the owner supplies them these are the only expected',
    '                      FAIL lines of a store build',
    '  bundle-id           store builds (and any build with --game): CFBundleIdentifier is io.applander.<game id without',
    '                      hyphens>, never com.example.* (owner decision O4)',
    '  att-string          every build: Info.plist has NSUserTrackingUsageDescription and en, de, fa and ckb.lproj/',
    "                      InfoPlist.strings each hold it (App Tracking Transparency, owner decision O1; Apple's prompt",
    '                      crashes the app without it)',
    '  encryption-flag     ITSAppUsesNonExemptEncryption is false',
    '  frame-rate          CADisableMinimumFrameDurationOnPhone is true (120 Hz)',
    '  privacy-manifest    PrivacyInfo.xcprivacy is in the bundle',
    '  ats                 NSAppTransportSecurity.NSAllowsArbitraryLoads is absent or false',
    '  version, build-number   match --version / --build when given',
    '  store-test-artefacts    store builds contain no *.storekit and no *.xctest',
    '',
    'Example: node check-sim-app.mjs --app apps/line-siege/build/dd/Build/Products/Release-iphonesimulator/LineSiege.app --variant store --ads live',
  ].join('\n'),
};

function readInputs(options) {
  if (!options.app) fail('nothing to check: --app is required', 'Pass the built .app folder that build:ios:sim printed.');
  if (!existsSync(options.app) || !statSync(options.app).isDirectory()) fail(`nothing to check: ${options.app} is not a folder`, 'Pass the .app folder, not the .ipa or the workspace.');
  if (!ALLOWED[options.variant]) fail(`--variant must be test or store, got "${options.variant ?? ''}"`, 'Pass the APP_VARIANT the build was made with.');
  if (!ALLOWED[options.variant].includes(options.ads)) fail(`--ads ${options.ads ?? '(missing)'} is not allowed with --variant ${options.variant}`, `Use one of: ${ALLOWED[options.variant].join(', ')}.`);
  const infoPath = join(options.app, 'Info.plist');
  if (!existsSync(infoPath)) fail(`nothing to check: ${infoPath} does not exist`, 'Pass a complete .app folder produced by xcodebuild.');
  return { info: readPlist(infoPath), where: toPosix(relative(process.cwd(), options.app)) || options.app };
}

function xcodeBuildNumber(version) {
  const [major = '0', minor = '0', patch = '0'] = version.split('.');
  return `${major}${minor}${patch}`;
}

function checkToolchain({ info, where, options, report }) {
  const wanted = xcodeBuildNumber(options.xcode);
  if (String(info.DTXcode ?? '') !== wanted) report.problem({ file: `${where}/Info.plist`, rule: 'built-with-xcode', message: `DTXcode is "${info.DTXcode ?? 'missing'}", expected ${wanted} (Xcode ${options.xcode})`, fix: 'Build through npm run build:ios:sim, which sets DEVELOPER_DIR to the pinned Xcode; never use xcode-select or /Applications/Xcode.app by default.' });
  if (info.DTPlatformName !== options.platform) report.problem({ file: `${where}/Info.plist`, rule: 'platform', message: `DTPlatformName is "${info.DTPlatformName ?? 'missing'}", expected ${options.platform}`, fix: 'Check the -sdk / -destination of the xcodebuild call.' });
  if (info.MinimumOSVersion !== '16.4') report.problem({ file: `${where}/Info.plist`, rule: 'min-ios', message: `MinimumOSVersion is "${info.MinimumOSVersion ?? 'missing'}", expected 16.4`, fix: "withShell sets ios.deploymentTarget: '16.4'; run a clean prebuild." });
}

function checkTestCode({ where, options, report }) {
  const bundlePath = join(options.app, 'main.jsbundle');
  if (!existsSync(bundlePath)) {
    report.problem({ file: `${where}/main.jsbundle`, rule: 'test-code', message: 'main.jsbundle is missing, so the JS was not embedded (Release builds embed it)', fix: 'Build with -configuration Release; a Debug build loads JS from Metro instead.' });
    return;
  }
  const count = readFileSync(bundlePath).toString('latin1').split(SENTINEL).length - 1;
  if (options.variant === 'store' && count > 0) report.problem({ file: `${where}/main.jsbundle`, rule: 'test-code', message: `store build contains ${SENTINEL} ${count} time(s): the debug menu and test hooks shipped`, fix: 'Key the Metro cache on the variant (metro.config.js cacheVersion), reach test code only through src/app/test-only.ts, keep the three variables exported for the whole build, then rebuild.' });
  if (options.variant === 'test' && count === 0) report.problem({ file: `${where}/main.jsbundle`, rule: 'test-code', message: `test build does not contain ${SENTINEL}: it was bundled as a store build`, fix: 'Export APP_VARIANT=test and EXPO_PUBLIC_APP_VARIANT=test for the whole run and rebuild (a stale Metro cache or a missing variable causes this).' });
}

function checkConstants({ where, options, report }) {
  const path = join(options.app, 'EXConstants.bundle', 'app.config');
  if (!existsSync(path)) {
    report.problem({ file: `${where}/EXConstants.bundle/app.config`, rule: 'constants-variant', message: 'EXConstants.bundle/app.config is missing', fix: 'The expo-constants build phase did not run; run a clean prebuild and rebuild.' });
    return;
  }
  let extra = {};
  try {
    extra = JSON.parse(readFileSync(path, 'utf8')).extra ?? {};
  } catch (error) {
    fail(`${path} is not JSON (${error.message})`, 'Rebuild; the file is written by the "Generate app.config" build phase.');
  }
  for (const [key, want] of [['appVariant', options.variant], ['adsMode', options.ads]]) {
    if (extra[key] !== want) report.problem({ file: `${where}/EXConstants.bundle/app.config`, rule: 'constants-variant', message: `extra.${key} is "${extra[key] ?? 'missing'}", expected "${want}"`, fix: 'The variables changed between prebuild and xcodebuild: export APP_VARIANT, EXPO_PUBLIC_APP_VARIANT and ADS_MODE once for the whole run and rebuild.' });
  }
  checkOwnerPlaceholders(extra, { where, options, report });
}

/** The scaffold values the owner replaces (G5: AdMob units; G3 in store builds: the links), by field. */
function checkOwnerPlaceholders(extra, { where, options, report }) {
  const file = `${where}/EXConstants.bundle/app.config`;
  const units = typeof extra.adUnits === 'object' && extra.adUnits !== null ? Object.entries(extra.adUnits) : [];
  const links = options.variant === 'store' ? (extra.game?.links ?? {}) : {};
  const values = [
    ...units.map(([slot, unit]) => [`extra.adUnits.${slot}`, unit]),
    ['extra.game.links.privacyPolicy.host', links.privacyPolicy?.host],
    ['extra.game.links.supportEmail', links.supportEmail],
  ];
  for (const [field, value] of values) {
    const placeholder = ownerPlaceholderOf(value);
    if (placeholder !== null) report.problem(ownerPlaceholderProblem({ entry: placeholder, where: field, file }));
  }
}

function checkInfoKeys({ info, where, options, report }) {
  const file = `${where}/Info.plist`;
  const appId = info.GADApplicationIdentifier;
  const placeholder = ownerPlaceholderOf(appId);
  if (placeholder !== null) {
    report.problem(ownerPlaceholderProblem({ entry: placeholder, where: 'Info.plist GADApplicationIdentifier', file }));
  } else if (options.ads === 'live') {
    if (typeof appId !== 'string' || !LIVE_APP_ID.test(appId) || appId === SAMPLE_APP_ID) report.problem({ file, rule: 'ad-app-id', message: `GADApplicationIdentifier is "${appId ?? 'missing'}", expected the game's real AdMob app ID`, fix: "Put the real ID in game.config.ts ads.ids.ios.appId (owner step G5) and build with ADS_MODE=live." });
  } else if (appId !== SAMPLE_APP_ID) {
    report.problem({ file, rule: 'ad-app-id', message: `GADApplicationIdentifier is "${appId ?? 'missing'}", expected Google's sample ID ${SAMPLE_APP_ID}`, fix: 'Non-live builds use the sample app ID (a missing ID crashes at launch); check withShell and ADS_MODE, then prebuild again.' });
  }
  if (info.ITSAppUsesNonExemptEncryption !== false) report.problem({ file, rule: 'encryption-flag', message: `ITSAppUsesNonExemptEncryption is ${JSON.stringify(info.ITSAppUsesNonExemptEncryption ?? 'missing')}, expected false`, fix: 'withShell sets ios.config.usesNonExemptEncryption: false.' });
  if (info.CADisableMinimumFrameDurationOnPhone !== true) report.problem({ file, rule: 'frame-rate', message: 'CADisableMinimumFrameDurationOnPhone is not true, so ProMotion phones stay at 60 Hz', fix: 'withShell sets ios.infoPlist.CADisableMinimumFrameDurationOnPhone: true.' });
  if (plistGet(info, 'NSAppTransportSecurity.NSAllowsArbitraryLoads') === true) report.problem({ file, rule: 'ats', message: 'NSAllowsArbitraryLoads is true', fix: 'Remove the ATS exception; the app makes no network requests of its own.' });
  if (!existsSync(join(options.app, 'PrivacyInfo.xcprivacy'))) report.problem({ file: `${where}/PrivacyInfo.xcprivacy`, rule: 'privacy-manifest', message: 'PrivacyInfo.xcprivacy is missing from the bundle', fix: 'withShell declares ios.privacyManifests; run a clean prebuild.' });
  if (options.version && info.CFBundleShortVersionString !== options.version) report.problem({ file, rule: 'version', message: `CFBundleShortVersionString is "${info.CFBundleShortVersionString}", expected ${options.version}`, fix: 'The version comes only from game.config.ts; prebuild again after changing it.' });
  if (options.build && String(info.CFBundleVersion) !== options.build) report.problem({ file, rule: 'build-number', message: `CFBundleVersion is "${info.CFBundleVersion}", expected ${options.build}`, fix: 'The build number comes only from game.config.ts; prebuild again after changing it.' });
}

/** The app id (owner decision O4): io.applander.<game id without hyphens>, never a placeholder. */
function checkBundleId({ info, where, options, report }) {
  if (options.variant !== 'store' && options.game === undefined) return;
  const problem = bundleIdProblem(info.CFBundleIdentifier, options.game ?? null);
  if (problem !== null) report.problem({ file: `${where}/Info.plist`, rule: 'bundle-id', message: `CFBundleIdentifier ${problem}`, fix: 'game.config.ts bundleId is io.applander.<game id without hyphens> (withShell refuses any other); prebuild with --clean and build again.' });
}

/** App Tracking Transparency (O1): the prompt text in Info.plist and in every app language. */
function checkTrackingText({ info, where, options, report }) {
  const fix = "shell-plugins.ts adds ['expo-tracking-transparency', { userTrackingPermission }] and withShell writes locales.<lang>.ios.NSUserTrackingUsageDescription from the Shell catalogs (consent.tracking.usage-description); prebuild with --clean.";
  for (const found of trackingTextProblems(options.app, info, readPlist)) report.problem({ file: `${where}/${found.file}`, rule: 'att-string', message: found.message, fix });
}

function checkStoreArtefacts({ where, options, report }) {
  if (options.variant !== 'store') return;
  const found = walk(options.app, { include: ['*.storekit', '*.xctest', '*.xctest/**'] });
  for (const rel of found) report.problem({ file: `${where}/${rel}`, rule: 'store-test-artefacts', message: 'StoreKit test configuration or test bundle inside a store build', fix: 'The StoreKit harness belongs to test builds only; rebuild the store variant from a clean prebuild.' });
}

run(async () => {
  const { options } = parseArgs(process.argv.slice(2), SPEC);
  const { info, where } = readInputs(options);
  const report = createReporter({ name: 'check-sim-app', json: options.json });
  const context = { info, where, options, report };
  checkToolchain(context);
  checkTestCode(context);
  checkConstants(context);
  checkInfoKeys(context);
  checkBundleId(context);
  checkTrackingText(context);
  checkStoreArtefacts(context);
  return finishWithOwnerSteps(report, { checked: 1, unit: `app (${options.variant}/${options.ads})` });
});
