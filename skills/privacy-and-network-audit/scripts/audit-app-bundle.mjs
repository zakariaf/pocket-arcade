#!/usr/bin/env node
// audit-app-bundle.mjs: the binary half of the release audit, on a built .app (for an IPA:
// unzip it and pass Payload/<App>.app). Checks the ad app ID for the variant (never a scaffold
// placeholder), the embedded expo.extra, the app id (io.applander.<game>), the App Tracking
// Transparency text in Info.plist and every app language, test-only code, StoreKit test artefacts,
// get-task-allow, the privacy manifest and ATS. Every scaffold placeholder (owner steps G3 and G5)
// is reported under owner-placeholder with the 'OWNER STEPS PENDING: G3, G5' line before RESULT;
// the result stays FAIL in every mode (--unsigned SKIPs only the signing rule).
// Run: node ${CLAUDE_SKILL_DIR}/scripts/audit-app-bundle.mjs --app build/ipa-check/Payload/<App>.app --variant store --ads-mode live

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createReporter, fail, parseArgs, requireDir, requireFile, run, walk } from './check-lib.mjs';
import { parseXmlPlist, readPlist } from './lib/plist.mjs';
import { bundleIdProblem, finishWithOwnerSteps, ownerPlaceholderOf, ownerPlaceholderProblem, placeholdersInText } from './lib/ship-placeholders.mjs';
import { trackingTextProblems } from './lib/tracking-text.mjs';

export { PLACEHOLDERS } from './lib/ship-placeholders.mjs';

const SPEC = {
  name: 'audit-app-bundle',
  summary: 'Audits a built iOS .app for the release: GADApplicationIdentifier matches the ads mode (live ID in store+live builds, Google sample otherwise), expo.extra matches the variant, and a store build has no test-only code, no *.storekit or *.xctest, no get-task-allow, a PrivacyInfo.xcprivacy, and no arbitrary-loads ATS exception.',
  usage: '--app <App.app> --variant store|test --ads-mode live|test|off [--game <game-id>] [--entitlements <xml>|auto] [--unsigned] [--repo <dir>] [--json]',
  options: {
    app: { type: 'string', value: 'dir', help: 'The .app folder (from Payload/ of an unzipped IPA, or a simulator build)' },
    variant: { type: 'string', value: 'store|test', help: 'APP_VARIANT the build was made with' },
    'ads-mode': { type: 'string', value: 'live|test|off', help: 'ADS_MODE the build was made with' },
    entitlements: { type: 'string', default: 'auto', value: 'file|auto', help: 'Entitlements XML (codesign -d --entitlements - --xml <app>), or auto to run codesign' },
    game: { type: 'string', value: 'game-id', help: 'The game id: CFBundleIdentifier must be io.applander.<id without hyphens> (store builds check the form without it)' },
    unsigned: { type: 'boolean', help: "Keyless release rehearsal on an archive built with CODE_SIGNING_ALLOWED=NO: prints 'REHEARSAL: not a release gate' first and reports only get-task-allow as SKIP when the app carries no signature; never the release audit" },
    repo: { type: 'string', default: '.', value: 'dir', help: 'The app repo the app was built from: a store/off rehearsal reads apps/<game>/game.config.ts there' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: 0 },
  details: [
    'Rules: ad-app-id, extra-variant, extra-ads-mode, extra-ad-units, bundle-id, owner-placeholder, att-string,',
    '  test-only-code, storekit-artefact, get-task-allow, privacy-manifest-file, ats.',
    'Test builds run ad-app-id, the extra checks, att-string and get-task-allow only.',
    'owner-placeholder (lead decision L14): every scaffold value the owner replaces is reported by field: the',
    '  AdMob app ca-app-pub-1234567890123456~1234567890 and units /1111111111, /2222222222, /3333333333 (owner',
    '  step G5) and, in store builds, the privacy host example.com and support@example.com (owner step G3).',
    "  The line before RESULT is then 'OWNER STEPS PENDING: G3, G5' (the steps still pending) and the result",
    '  stays FAIL, with or without --unsigned. A store/off archive carries no AdMob ids, so a store/off',
    '  rehearsal (--unsigned, --game required) stands in for the store/live build: it reads the AdMob ids from',
    '  <--repo>/apps/<game>/game.config.ts and reports their placeholders there, ending with the same OWNER',
    '  STEPS PENDING line as check-release-setup.',
    'com.example.* ids (owner decision O4) fail bundle-id.',
    'att-string (owner decision O1): Info.plist NSUserTrackingUsageDescription and en, de, fa and ckb.lproj/InfoPlist.strings.',
  ].join('\n'),
};

const FACTS = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'privacy-facts.json'), 'utf8'));
const MATRIX = { test: ['test', 'off'], store: ['live', 'off'] };

/** The entitlements, or { unsigned: why } for an app codesign cannot read (no signature). */
function readEntitlements(app, option) {
  if (option !== 'auto') return parseXmlPlist(readFileSync(requireFile(option, 'entitlements XML'), 'utf8'));
  const result = spawnSync('codesign', ['-d', '--entitlements', '-', '--xml', app], { encoding: 'utf8' });
  if (result.error) fail(`codesign could not run: ${result.error.message}`, 'Run on macOS (codesign ships with the Xcode command line tools), or pass --entitlements <file> with the output of codesign -d --entitlements - --xml.');
  if (result.status !== 0) return { unsigned: result.stderr.trim().split('\n')[0] };
  const xml = result.stdout.trim();
  return xml === '' ? {} : parseXmlPlist(xml);
}

/**
 * A store/off archive carries Google's sample app id and no units, yet the store/live build it
 * rehearses carries the owner's AdMob ids (owner step G5): a store/off rehearsal reads them from
 * game.config.ts, so it names every owner step still pending, as check-release-setup does (D68).
 */
function rehearsalAdIdProblems(options) {
  const file = `apps/${options.game}/game.config.ts`;
  const path = join(options.repo, file);
  if (!existsSync(path)) fail(`${file} not found under ${options.repo}: a store/off rehearsal reads the live AdMob ids from it`, 'Run from the repo root the archive was built from, or pass --repo <dir>, with --game <game-id>.');
  const text = readFileSync(path, 'utf8');
  return placeholdersInText(text)
    .filter((found) => found.entry.ownerStep === 'G5')
    .map((found) => ownerPlaceholderProblem({ entry: found.entry, where: `${found.entry.field} (for the store/live build this store/off rehearsal stands in for)`, file, line: text.slice(0, found.index).split('\n').length }));
}

run(async () => {
  const { options } = parseArgs(process.argv.slice(2), SPEC);
  if (!options.app) fail('--app is required', 'Pass the .app folder, for example --app build/ipa-check/Payload/LineSiege.app.');
  const variant = options.variant;
  const adsMode = options['ads-mode'];
  if (!MATRIX[variant]) fail(`--variant ${variant ?? '(missing)'} is not store or test`, 'Pass the APP_VARIANT the build was made with.');
  if (!MATRIX[variant].includes(adsMode)) fail(`--ads-mode ${adsMode ?? '(missing)'} is not allowed with --variant ${variant}`, `Use one of ${MATRIX[variant].join(', ')}.`);
  const isOffRehearsal = options.unsigned === true && variant === 'store' && adsMode === 'off';
  if (isOffRehearsal && !options.game) fail('a store/off rehearsal (--unsigned) needs --game <game-id>: it reads the live AdMob ids from apps/<game>/game.config.ts', 'Pass --game <game-id> and run from the repo root (or pass --repo <dir>).');
  const app = requireDir(options.app, '.app folder');
  const infoPath = requireFile(join(app, 'Info.plist'), 'Info.plist of the app');
  if (options.unsigned) console.log('REHEARSAL: not a release gate (--unsigned: an archive built without the signing key; get-task-allow is SKIP when the app has no signature)');
  const report = createReporter({ name: 'audit-app-bundle', json: options.json });
  const rel = FACTS.release;
  const info = readPlist(infoPath);
  let checked = 1;

  const appId = info.GADApplicationIdentifier;
  const appIdPlaceholder = ownerPlaceholderOf(appId);
  if (appIdPlaceholder !== null) {
    report.problem(ownerPlaceholderProblem({ entry: appIdPlaceholder, where: 'Info.plist GADApplicationIdentifier', file: 'Info.plist' }));
  } else if (adsMode === 'live') {
    if (typeof appId !== 'string' || !new RegExp(rel.liveAppId).test(appId) || appId.includes(rel.samplePublisher)) report.problem({ file: 'Info.plist', rule: 'ad-app-id', message: `GADApplicationIdentifier is ${JSON.stringify(appId)}, not the game's live AdMob app ID`, fix: 'Build with APP_VARIANT=store ADS_MODE=live exported for the whole run, with the real IDs in game.config.ts.' });
  } else if (appId !== rel.sampleAppId) {
    report.problem({ file: 'Info.plist', rule: 'ad-app-id', message: `GADApplicationIdentifier is ${JSON.stringify(appId)}; ADS_MODE=${adsMode} builds carry Google's sample app ID`, fix: 'A test or ads-off build never contains the real app ID; check the plugin options (admobPluginOptions).' });
  }

  const configPath = join(app, 'EXConstants.bundle', 'app.config');
  if (!existsSync(configPath)) {
    report.problem({ file: 'EXConstants.bundle/app.config', rule: 'extra-variant', message: 'missing', fix: 'The Xcode phase "Generate app.config for prebuilt Constants.manifest" did not run; rebuild.' });
  } else {
    checked += 1;
    let extra = null;
    try {
      extra = JSON.parse(readFileSync(configPath, 'utf8')).extra ?? {};
    } catch {
      report.problem({ file: 'EXConstants.bundle/app.config', rule: 'extra-variant', message: 'not JSON', fix: 'Rebuild the app.' });
    }
    if (extra) {
      if (extra.appVariant !== variant) report.problem({ file: 'EXConstants.bundle/app.config', rule: 'extra-variant', message: `extra.appVariant is ${JSON.stringify(extra.appVariant)}, expected "${variant}"`, fix: 'Export APP_VARIANT, EXPO_PUBLIC_APP_VARIANT and ADS_MODE for the whole build run, not just prebuild.' });
      if (extra.adsMode !== adsMode) report.problem({ file: 'EXConstants.bundle/app.config', rule: 'extra-ads-mode', message: `extra.adsMode is ${JSON.stringify(extra.adsMode)}, expected "${adsMode}"`, fix: 'Export the variables for the whole run; a mixed build is not shippable.' });
      const hasUnits = extra.adUnits !== undefined && extra.adUnits !== null;
      if (hasUnits !== (adsMode === 'live')) report.problem({ file: 'EXConstants.bundle/app.config', rule: 'extra-ad-units', message: hasUnits ? `extra.adUnits is present in an ADS_MODE=${adsMode} build` : 'extra.adUnits is missing in a live build', fix: 'withShell writes adUnits only when ADS_MODE=live (adUnitsExtra).' });
      for (const [slot, unit] of Object.entries(hasUnits ? extra.adUnits : {})) {
        const unitPlaceholder = ownerPlaceholderOf(unit);
        if (unitPlaceholder !== null) report.problem(ownerPlaceholderProblem({ entry: unitPlaceholder, where: `extra.adUnits.${slot}`, file: 'EXConstants.bundle/app.config' }));
      }
      const links = extra.game?.links;
      if (variant === 'store' && links) {
        for (const [where, value] of [['extra.game.links.privacyPolicy.host', links.privacyPolicy?.host], ['extra.game.links.supportEmail', links.supportEmail]]) {
          const linkPlaceholder = ownerPlaceholderOf(value);
          if (linkPlaceholder !== null) report.problem(ownerPlaceholderProblem({ entry: linkPlaceholder, where, file: 'EXConstants.bundle/app.config' }));
        }
      }
    }
  }

  const idProblem = variant === 'store' || options.game !== undefined ? bundleIdProblem(info.CFBundleIdentifier, options.game ?? null) : null;
  if (idProblem !== null) report.problem({ file: 'Info.plist', rule: 'bundle-id', message: `CFBundleIdentifier ${idProblem}`, fix: 'game.config.ts bundleId is io.applander.<game id without hyphens> (owner decision O4; withShell refuses any other); prebuild with --clean and build again.' });
  for (const found of trackingTextProblems(app, info, readPlist)) report.problem({ file: found.file, rule: 'att-string', message: found.message, fix: "shell-plugins.ts adds ['expo-tracking-transparency', { userTrackingPermission }] and withShell writes locales.<lang>.ios.NSUserTrackingUsageDescription from the Shell catalogs; prebuild with --clean (owner decision O1)." });

  const entitlements = readEntitlements(app, options.entitlements);
  checked += 1;
  if (entitlements.unsigned !== undefined && options.unsigned) report.skip({ file: 'entitlements', rule: 'get-task-allow', message: 'REHEARSAL: the app has no signature (CODE_SIGNING_ALLOWED=NO); the release audit runs on the signed export' });
  else if (entitlements.unsigned !== undefined) report.problem({ file: 'entitlements', rule: 'get-task-allow', message: `the app is not signed (codesign -d: ${entitlements.unsigned})`, fix: 'Audit the signed export (release:ios exports with the team API key). A keyless rehearsal archive (CODE_SIGNING_ALLOWED=NO) passes --unsigned and is never release evidence.' });
  else if (entitlements['get-task-allow'] === true) report.problem({ file: 'entitlements', rule: 'get-task-allow', message: 'get-task-allow is true', fix: 'It belongs only to the Debug config of a throwaway StoreKit harness build; make a clean prebuild and a Release archive.' });

  if (variant === 'store') {
    const bundle = join(app, 'main.jsbundle');
    if (existsSync(bundle)) {
      checked += 1;
      if (readFileSync(bundle).includes(Buffer.from(rel.sentinel))) report.problem({ file: 'main.jsbundle', rule: 'test-only-code', message: `contains ${rel.sentinel}`, fix: 'The debug menu, deep links and network guard shipped: check metro cacheVersion keys on the variant and that test-only code is reachable only through the literal gate; rebuild.' });
    } else {
      report.problem({ file: 'main.jsbundle', rule: 'test-only-code', message: 'missing (the JS bundle was not embedded)', fix: 'Build Release so the bundle is embedded, then rerun.' });
    }
    const artefacts = new Set(walk(app, { followSymlinks: false }).map((file) => /^(.*?\.(storekit|xctest))(\/|$)/.exec(file)?.[1]).filter(Boolean));
    for (const file of artefacts) report.problem({ file, rule: 'storekit-artefact', message: 'StoreKit test artefact in the store build', fix: 'Harness builds are separate; make a clean prebuild (npx expo prebuild --platform ios --clean) and archive again.' });
    if (!existsSync(join(app, 'PrivacyInfo.xcprivacy'))) report.problem({ file: 'PrivacyInfo.xcprivacy', rule: 'privacy-manifest-file', message: 'missing from the app', fix: 'withShell sets ios.privacyManifests; prebuild writes the file.' });
    if (info.NSAppTransportSecurity?.NSAllowsArbitraryLoads === true) report.problem({ file: 'Info.plist', rule: 'ats', message: 'NSAllowsArbitraryLoads is true', fix: 'Remove the ATS exception; NSAllowsLocalNetworking may stay.' });
  }
  if (isOffRehearsal) {
    for (const found of rehearsalAdIdProblems(options)) report.problem(found);
  }
  return finishWithOwnerSteps(report, { checked, unit: 'artefacts' });
});
