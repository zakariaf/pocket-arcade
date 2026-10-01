#!/usr/bin/env node
// audit-app-bundle.mjs: the binary half of the release audit, on a built .app (for an IPA:
// unzip it and pass Payload/<App>.app). Checks the ad app ID for the variant (never a scaffold
// placeholder), the embedded expo.extra, the app id (io.applander.<game>), the App Tracking
// Transparency text in Info.plist and every app language, test-only code, StoreKit test artefacts,
// get-task-allow, the privacy manifest and ATS.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/audit-app-bundle.mjs --app build/ipa-check/Payload/<App>.app --variant store --ads-mode live

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createReporter, fail, parseArgs, requireDir, requireFile, run, walk } from './check-lib.mjs';
import { parseXmlPlist, readPlist } from './lib/plist.mjs';
import { bundleIdProblem, placeholderName } from './lib/ship-placeholders.mjs';
import { trackingTextProblems } from './lib/tracking-text.mjs';

export { PLACEHOLDERS } from './lib/ship-placeholders.mjs';

const SPEC = {
  name: 'audit-app-bundle',
  summary: 'Audits a built iOS .app for the release: GADApplicationIdentifier matches the ads mode (live ID in store+live builds, Google sample otherwise), expo.extra matches the variant, and a store build has no test-only code, no *.storekit or *.xctest, no get-task-allow, a PrivacyInfo.xcprivacy, and no arbitrary-loads ATS exception.',
  usage: '--app <App.app> --variant store|test --ads-mode live|test|off [--game <game-id>] [--entitlements <xml>|auto] [--unsigned] [--json]',
  options: {
    app: { type: 'string', value: 'dir', help: 'The .app folder (from Payload/ of an unzipped IPA, or a simulator build)' },
    variant: { type: 'string', value: 'store|test', help: 'APP_VARIANT the build was made with' },
    'ads-mode': { type: 'string', value: 'live|test|off', help: 'ADS_MODE the build was made with' },
    entitlements: { type: 'string', default: 'auto', value: 'file|auto', help: 'Entitlements XML (codesign -d --entitlements - --xml <app>), or auto to run codesign' },
    game: { type: 'string', value: 'game-id', help: 'The game id: CFBundleIdentifier must be io.applander.<id without hyphens> (store builds check the form without it)' },
    unsigned: { type: 'boolean', help: "Keyless release rehearsal on an archive built with CODE_SIGNING_ALLOWED=NO: prints 'REHEARSAL: not a release gate' first and reports only get-task-allow as SKIP when the app carries no signature; never the release audit" },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: 0 },
  details: [
    'Rules: ad-app-id, extra-variant, extra-ads-mode, extra-ad-units, bundle-id, links, att-string, test-only-code,',
    '  storekit-artefact, get-task-allow, privacy-manifest-file, ats.',
    'Test builds run ad-app-id, the extra checks, att-string and get-task-allow only.',
    'Placeholders (owner decision O4) are refused by name: com.example.* ids, the AdMob app',
    '  ca-app-pub-1234567890123456~1234567890 and units /1111111111, /2222222222, /3333333333 (owner step G5),',
    '  the privacy host example.com and support@example.com.',
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

run(async () => {
  const { options } = parseArgs(process.argv.slice(2), SPEC);
  if (!options.app) fail('--app is required', 'Pass the .app folder, for example --app build/ipa-check/Payload/LineSiege.app.');
  const variant = options.variant;
  const adsMode = options['ads-mode'];
  if (!MATRIX[variant]) fail(`--variant ${variant ?? '(missing)'} is not store or test`, 'Pass the APP_VARIANT the build was made with.');
  if (!MATRIX[variant].includes(adsMode)) fail(`--ads-mode ${adsMode ?? '(missing)'} is not allowed with --variant ${variant}`, `Use one of ${MATRIX[variant].join(', ')}.`);
  const app = requireDir(options.app, '.app folder');
  const infoPath = requireFile(join(app, 'Info.plist'), 'Info.plist of the app');
  if (options.unsigned) console.log('REHEARSAL: not a release gate (--unsigned: an archive built without the signing key; get-task-allow is SKIP when the app has no signature)');
  const report = createReporter({ name: 'audit-app-bundle', json: options.json });
  const rel = FACTS.release;
  const info = readPlist(infoPath);
  let checked = 1;

  const appId = info.GADApplicationIdentifier;
  if (adsMode === 'live' && placeholderName(appId) !== null) {
    report.problem({ file: 'Info.plist', rule: 'ad-app-id', message: `GADApplicationIdentifier is ${placeholderName(appId)} (${appId})`, fix: 'The owner creates the AdMob app and its units (owner step G5); put the real ids in game.config.ts ads.ids.ios, then build and audit again.' });
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
        if (placeholderName(unit) !== null) report.problem({ file: 'EXConstants.bundle/app.config', rule: 'extra-ad-units', message: `extra.adUnits.${slot} is ${placeholderName(unit)} (${unit})`, fix: 'The owner creates the AdMob units (owner step G5); put the real ids in game.config.ts ads.ids.ios.units.' });
      }
      const links = extra.game?.links;
      if (variant === 'store' && links) {
        for (const value of [links.privacyPolicy?.host, links.supportEmail]) {
          if (placeholderName(value) !== null) report.problem({ file: 'EXConstants.bundle/app.config', rule: 'links', message: `extra.game.links holds ${placeholderName(value)}`, fix: "Put the owner's privacy-policy host and support address in game.config.ts links (the store listing and S11 show them)." });
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
  return report.finish({ checked, unit: 'artefacts' });
});
