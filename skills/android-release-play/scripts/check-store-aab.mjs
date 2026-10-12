#!/usr/bin/env node
// check-store-aab.mjs: the store-AAB gate. Runs on the signed Android App Bundle before any upload
// and proves what Google Play players would receive: signed with the upload key (never the debug
// key), a versionCode above every upload tag of the game, the package, no test-only code, the
// variant in app.config and the manifest, the game's own AdMob id, no owner placeholder, the
// permission allowlist, not debuggable, the target SDK, and no partial Shell. --stamp writes the
// AAB's sha256 after a PASS, which release:android requires before it uploads.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/check-store-aab.mjs --aab <aab> --variant store --ads live --version 1.0.0 --build 10 --game line-siege .
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createReporter, fail, parseArgs, run, toPosix } from './check-lib.mjs';
import { findElements, metaDataValue, parseProtoXml, readZipEntry, readZipIndex, signatureOf } from './lib/aab.mjs';
import { ANDROID_AD_IDS_MISSING, appIdOf, bundleIdProblem, finishWithOwnerSteps, ownerPlaceholderOf, ownerPlaceholderProblem } from './lib/ship-placeholders.mjs';

const SAMPLE_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
const LIVE_APP_ID = /^ca-app-pub-\d{16}~\d{10}$/;
const APP_ID_META = 'com.google.android.gms.ads.APPLICATION_ID';
const SENTINEL = 'SHELL_TEST_BUILD_ONLY';
const ALLOWED = { test: ['off', 'test'], store: ['off', 'live'] };
const TARGET_SDK = 36;
const SKILL_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

const SPEC = {
  name: 'check-store-aab',
  summary: 'The store-AAB gate: checks a release Android App Bundle before any Google Play upload (signature, versionCode, package, test code, variant, AdMob id, owner placeholders, permissions, debuggable, target SDK, complete Shell).',
  usage: '--aab <app-release.aab> --variant store|test --ads live|test|off --version <X.Y.Z> --build <n> --game <game-id> [--unsigned] [--stamp <file>] [--tags-list <file>] [repo-root]',
  options: {
    aab: { type: 'string', help: 'The bundle (apps/<game>/android/app/build/outputs/bundle/release/app-release.aab)' },
    variant: { type: 'string', help: 'APP_VARIANT the bundle was built with: store (or test for an internal test build)' },
    ads: { type: 'string', help: 'ADS_MODE: live or off for store, test or off for test' },
    version: { type: 'string', help: 'game.config.ts version: the manifest versionName' },
    build: { type: 'string', help: 'game.config.ts buildNumber: the manifest versionCode' },
    game: { type: 'string', help: 'The game id: the package is io.applander.<id without hyphens>' },
    unsigned: { type: 'boolean', help: 'Keyless rehearsal: an AAB built without the upload key. Prints REHEARSAL: not a release gate and SKIPs only the signing rule' },
    stamp: { type: 'string', help: 'After a PASS (never with --unsigned), write { result, sha256, versionCode } here for release:android --resume upload' },
    'tags-list': { type: 'string', help: "A file with `git tag --list` output to use instead of the repo's tags" },
    json: { type: 'boolean', help: 'Also print the problems as JSON' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules:',
    '  signing            signed (META-INF/*.RSA|EC|DSA), never with the Android debug key; --unsigned SKIPs only this rule',
    '  version-code       the manifest versionCode equals --build and is above every <game>/vX.Y.Z+<n> upload tag',
    '  version-name       the manifest versionName equals --version',
    '  package            io.applander.<game id without hyphens> (owner decision O4)',
    '  test-code          base/assets/index.android.bundle contains SHELL_TEST_BUILD_ONLY only in a test build',
    '  constants-variant  base/assets/app.config extra.appVariant / extra.adsMode match --variant / --ads',
    '  variant            the E07AppVariant manifest meta-data equals --variant',
    "  ad-app-id          the AdMob app id: the game's own in live builds (never Google's sample), the sample otherwise",
    '  owner-placeholder  by field: the links example.com and support@example.com in store builds (owner step G3), the',
    '                     AdMob placeholders, a live build without an Android AdMob app id (owner step GP5); then',
    "                     'OWNER STEPS PENDING: ...' before RESULT, which stays FAIL",
    '  permission         a uses-permission outside assets/permission-allowlist.json (N3)',
    '  debuggable         the application is debuggable',
    `  target-sdk         targetSdkVersion below ${TARGET_SDK} (Google Play's floor and the pinned level)`,
    '  shell-slice        the repo the bundle came from has shell-slice.json: a partial Shell never ships',
    '',
    'Exit 2 when the AAB is missing or not a bundle, or the flags are not an allowed combination.',
  ].join('\n'),
};

function readInputs(options, root) {
  if (!options.aab) fail('nothing to check: --aab is required', 'Pass the bundle that release:android printed.');
  if (!existsSync(options.aab) || !statSync(options.aab).isFile()) fail(`nothing to check: ${options.aab} is not a file`, 'Build it first: npm run release:android -- --app <game>, or the rehearsal in references/release-pipeline.md.');
  if (!ALLOWED[options.variant]) fail(`--variant must be store or test, got "${options.variant ?? ''}"`, 'Pass the APP_VARIANT the bundle was built with.');
  if (!ALLOWED[options.variant].includes(options.ads)) fail(`--ads ${options.ads ?? '(missing)'} is not allowed with --variant ${options.variant}`, `Use one of: ${ALLOWED[options.variant].join(', ')}.`);
  for (const name of ['version', 'build', 'game']) if (!options[name]) fail(`--${name} is required`, 'Pass the values from apps/<game>/game.config.ts.');
  let zip;
  try {
    zip = readZipIndex(options.aab);
  } catch (error) {
    fail(`${options.aab} cannot be read as a bundle (${error.message})`, 'Rebuild with bundleRelease.');
  }
  const manifestBytes = readZipEntry(zip, 'base/manifest/AndroidManifest.xml');
  if (manifestBytes === null) fail(`${options.aab} has no base/manifest/AndroidManifest.xml: not an Android App Bundle`, 'Pass the .aab from bundle/release, not an APK.');
  const tagsText = options['tags-list'] ? readFileSync(options['tags-list'], 'utf8') : gitTags(root, options.game);
  return { zip, manifest: parseProtoXml(manifestBytes), tags: tagsText.split('\n').map((tag) => tag.trim()).filter(Boolean), where: toPosix(relative(process.cwd(), options.aab)) || options.aab };
}

function gitTags(root, game) {
  try {
    return execFileSync('git', ['-C', root, 'tag', '--list', `${game}/v*`], { encoding: 'utf8' });
  } catch {
    fail(`cannot read the git tags of ${root}`, 'Run from the repo root (the last argument), or pass --tags-list <file>.');
  }
}

function checkSigning({ zip, where, options, report }) {
  const { isSigned, isDebugKey } = signatureOf(zip);
  if (options.unsigned) {
    report.skip({ file: where, rule: 'signing', message: 'keyless rehearsal (--unsigned): the signature is not checked, so this run is not a release gate' });
    return;
  }
  if (!isSigned) report.problem({ file: where, rule: 'signing', message: 'the bundle is not signed', fix: 'Build through npm run release:android, which signs with the upload key from ~/.android-keys (owner step GP2); an unsigned bundle is only for the keyless rehearsal.' });
  else if (isDebugKey) report.problem({ file: where, rule: 'signing', message: 'the bundle is signed with the Android debug key', fix: "The release signing config did not find the game's upload-key properties in ~/.gradle/gradle.properties; Google Play refuses debug-signed bundles." });
}

function checkVersions({ manifest, tags, where, options, report }) {
  const root = findElements(manifest, 'manifest')[0]?.attributes ?? {};
  const file = `${where}!base/manifest/AndroidManifest.xml`;
  const versionCode = Number(root.versionCode);
  if (String(root.versionCode) !== options.build) report.problem({ file, rule: 'version-code', message: `versionCode is ${root.versionCode ?? 'missing'}, expected ${options.build}`, fix: 'versionCode is game.config.ts buildNumber (withShell); prebuild with --clean after the build-number commit.' });
  const pattern = new RegExp(`^${options.game.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/v\\d+\\.\\d+\\.\\d+\\+(\\d+)$`);
  const blocking = tags.filter((tag) => Number(pattern.exec(tag)?.[1] ?? -1) >= versionCode);
  for (const tag of blocking) report.problem({ file, rule: 'version-code', message: `versionCode ${versionCode} is not above ${tag}: a build number is never reused (iOS and Android share one sequence)`, fix: 'Run npm run release:android again: it commits the next number above every tag.' });
  if (root.versionName !== options.version) report.problem({ file, rule: 'version-name', message: `versionName is ${root.versionName ?? 'missing'}, expected ${options.version}`, fix: 'The version lives only in game.config.ts; prebuild again after changing it.' });
  const problem = bundleIdProblem(root.package, options.game);
  if (problem !== null) report.problem({ file, rule: 'package', message: `package ${problem}`, fix: `game.config.ts bundleId is ${appIdOf(options.game)}.` });
}

function checkBundle({ zip, where, options, report }) {
  const file = `${where}!base/assets/index.android.bundle`;
  const bundle = readZipEntry(zip, 'base/assets/index.android.bundle');
  if (bundle === null) {
    report.problem({ file, rule: 'test-code', message: 'the bundle has no index.android.bundle', fix: 'Build with bundleRelease (Release embeds the JS).' });
    return;
  }
  const count = bundle.toString('latin1').split(SENTINEL).length - 1;
  if (options.variant === 'store' && count > 0) report.problem({ file, rule: 'test-code', message: `store bundle contains ${SENTINEL} ${count} time(s): the debug menu and test hooks would ship`, fix: 'Rebuild from a clean prebuild with APP_VARIANT and EXPO_PUBLIC_APP_VARIANT=store exported for the whole run (Metro cache keyed on the variant).' });
  if (options.variant === 'test' && count === 0) report.problem({ file, rule: 'test-code', message: `test bundle lacks ${SENTINEL}`, fix: 'Export APP_VARIANT=test and EXPO_PUBLIC_APP_VARIANT=test for the whole build.' });
}

function checkConfig({ zip, where, options, report }) {
  const file = `${where}!base/assets/app.config`;
  const text = readZipEntry(zip, 'base/assets/app.config');
  let extra = null;
  try {
    extra = text === null ? null : (JSON.parse(text.toString('utf8')).extra ?? {});
  } catch {
    extra = null;
  }
  if (extra === null) {
    report.problem({ file, rule: 'constants-variant', message: 'base/assets/app.config is missing or not JSON', fix: "expo-constants' Gradle task did not run; prebuild with --clean." });
    return;
  }
  for (const [key, want] of [['appVariant', options.variant], ['adsMode', options.ads]]) {
    if (extra[key] !== want) report.problem({ file, rule: 'constants-variant', message: `extra.${key} is "${extra[key] ?? 'missing'}", expected "${want}"`, fix: 'Export APP_VARIANT, EXPO_PUBLIC_APP_VARIANT and ADS_MODE once for the whole build.' });
  }
  const links = options.variant === 'store' ? (extra.game?.links ?? {}) : {};
  const units = typeof extra.adUnits === 'object' && extra.adUnits !== null ? Object.entries(extra.adUnits) : [];
  for (const [field, value] of [...units.map(([slot, unit]) => [`extra.adUnits.${slot}`, unit]), ['extra.game.links.privacyPolicy.host', links.privacyPolicy?.host], ['extra.game.links.supportEmail', links.supportEmail]]) {
    const placeholder = ownerPlaceholderOf(value);
    if (placeholder !== null) report.problem(ownerPlaceholderProblem({ entry: placeholder, where: field, file }));
  }
}

function checkManifest({ manifest, where, options, report }) {
  const file = `${where}!base/manifest/AndroidManifest.xml`;
  const variant = metaDataValue(manifest, 'E07AppVariant');
  if (variant !== options.variant) report.problem({ file, rule: 'variant', message: `meta-data E07AppVariant is ${variant === null ? 'missing' : `"${variant}"`}, expected "${options.variant}"`, fix: 'Prebuild with --clean and APP_VARIANT exported for the whole run (with-app-variant-marker.ts).' });
  const appId = metaDataValue(manifest, APP_ID_META);
  const at = `AndroidManifest ${APP_ID_META}`;
  const placeholder = ownerPlaceholderOf(appId);
  if (placeholder !== null) report.problem(ownerPlaceholderProblem({ entry: placeholder, where: at, file }));
  else if (options.ads === 'live' && appId === null) report.problem(ownerPlaceholderProblem({ entry: ANDROID_AD_IDS_MISSING, where: at, file }));
  else if (options.ads === 'live' && (!LIVE_APP_ID.test(appId) || appId === SAMPLE_APP_ID)) report.problem({ file, rule: 'ad-app-id', message: `${APP_ID_META} is "${appId}", expected the game's own AdMob Android app id`, fix: "A live build never ships Google's sample id; put the owner's ids in game.config.ts ads.ids.android (owner step GP5)." });
  else if (options.ads !== 'live' && appId !== SAMPLE_APP_ID) report.problem({ file, rule: 'ad-app-id', message: `${APP_ID_META} is ${appId ?? 'missing'}, expected Google's sample id for ads ${options.ads}`, fix: 'Non-live builds carry the sample id (a missing id crashes the AdMob SDK).' });
  const packageName = findElements(manifest, 'manifest')[0]?.attributes.package ?? '';
  const allowlist = JSON.parse(readFileSync(join(SKILL_DIR, 'assets', 'permission-allowlist.json'), 'utf8')).permissions.map((entry) => entry.name.replace('<package>', packageName));
  for (const element of findElements(manifest, 'uses-permission')) {
    if (!allowlist.includes(element.attributes.name)) report.problem({ file, rule: 'permission', message: `uses-permission ${element.attributes.name} is not on the allowlist`, fix: 'Block it in withShell (android.blockedPermissions) or drop the module that adds it; a new permission is a reviewed allowlist entry with its source (N3) and a Data safety question.' });
  }
  if (findElements(manifest, 'application')[0]?.attributes.debuggable === 'true') report.problem({ file, rule: 'debuggable', message: 'the application is debuggable', fix: 'Build with bundleRelease from a clean prebuild; never set android:debuggable.' });
  const target = Number(findElements(manifest, 'uses-sdk')[0]?.attributes.targetSdkVersion ?? 0);
  if (target < TARGET_SDK) report.problem({ file, rule: 'target-sdk', message: `targetSdkVersion is ${target || 'missing'}, below ${TARGET_SDK}`, fix: 'Keep Expo SDK 57 and React Native 0.86.3 levels; Google Play refuses an old target SDK.' });
}

function checkShell({ root, report }) {
  if (existsSync(join(root, 'shell-slice.json'))) report.problem({ file: 'shell-slice.json', rule: 'shell-slice', message: 'the repo declares a partial Shell; a slice never ships', fix: 'Build every Shell screen and delete shell-slice.json before a release.' });
}

function writeStamp(options, code) {
  if (!options.stamp || code !== 0 || options.unsigned) return;
  const sha256 = createHash('sha256').update(readFileSync(options.aab)).digest('hex');
  mkdirSync(dirname(options.stamp), { recursive: true });
  writeFileSync(options.stamp, `${JSON.stringify({ result: 'PASS', sha256, versionCode: Number(options.build), isUnsigned: false }, null, 2)}\n`);
  console.log(`stamp written: ${options.stamp} (sha256 ${sha256})`);
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = positionals[0] ?? '.';
  const inputs = readInputs(options, root);
  if (options.unsigned) console.log('REHEARSAL: not a release gate');
  const report = createReporter({ name: 'check-store-aab', json: options.json });
  const context = { ...inputs, options, root, report };
  checkSigning(context);
  checkVersions(context);
  checkBundle(context);
  checkConfig(context);
  checkManifest(context);
  checkShell(context);
  const code = finishWithOwnerSteps(report, { checked: 1, unit: `bundle (${options.variant}/${options.ads}, versionCode ${options.build})` });
  writeStamp(options, code);
  return code;
});
