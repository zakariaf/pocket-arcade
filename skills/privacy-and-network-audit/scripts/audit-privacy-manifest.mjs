#!/usr/bin/env node
// audit-privacy-manifest.mjs: after `npx expo prebuild`, aggregates the PrivacyInfo.xcprivacy of
// every pod and checks that the Shell's privacy-manifest.ts declares every required-reason API,
// that only Google's ad pods declare tracking, and that the prebuilt app manifest is current.
// Prints the App Privacy questionnaire input (collected data per pod).
// Run from the repo root: node ${CLAUDE_SKILL_DIR}/scripts/audit-privacy-manifest.mjs . [--app apps/<game>]

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createReporter, fail, maskComments, parseArgs, requireDir, requireFile, run, toPosix, walk } from './check-lib.mjs';
import { readPlist } from './lib/plist.mjs';

const SPEC = {
  name: 'audit-privacy-manifest',
  summary: "Checks the app's declared privacy manifest against every pod's PrivacyInfo.xcprivacy after a prebuild: every required-reason API a pod declares must be declared by packages/shell/src/config/privacy-manifest.ts, only Google's ad pods may declare tracking, and the prebuilt app manifest must match. Prints the App Privacy input.",
  usage: '[--app <app dir>...] [--manifest <file>] [--json] [repo-root]',
  options: {
    app: { type: 'string', multiple: true, value: 'dir', help: 'Prebuilt app folder with ios/Pods (default: every apps/* that has one)' },
    manifest: { type: 'string', value: 'file', help: 'Declared manifest (default: <root>/packages/shell/src/config/privacy-manifest.ts)' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules: missing-reason, app-tracking, tracking-outside-google, prebuilt-stale.',
    'app-tracking: the app\'s own manifest (privacy-manifest.ts and the prebuilt PrivacyInfo.xcprivacy) keeps',
    '  NSPrivacyTracking false and lists no NSPrivacyTrackingDomains. Our code tracks nothing, and Apple fails',
    '  requests to listed domains for players who decline App Tracking Transparency (ads would stop for them);',
    '  only Google\'s ad pods declare tracking, and the app asks ATT before any ad request (owner decision O1).',
    '  Source: https://developer.apple.com/documentation/bundleresources/app-privacy-configuration/nsprivacytrackingdomains',
    'Prints the App Privacy input, with the tracking answer: Device ID collected, linked, used for tracking by the',
    '  third-party ads SDK.',
    'Needs a prebuild: npx expo prebuild --platform ios --clean (it runs pod install).',
  ].join('\n'),
};

const FACTS = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'privacy-facts.json'), 'utf8'));

/** category -> Set(reasons) from the TypeScript source of privacy-manifest.ts. */
function declaredReasons(text) {
  const declared = new Map();
  const body = maskComments(text);
  const re = /NSPrivacyAccessedAPIType\s*:\s*['"]([^'"]+)['"]\s*,\s*NSPrivacyAccessedAPITypeReasons\s*:\s*\[([^\]]*)\]/g;
  for (const match of body.matchAll(re)) {
    const reasons = [...match[2].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
    declared.set(match[1], new Set([...(declared.get(match[1]) ?? []), ...reasons]));
  }
  const tracking = /NSPrivacyTracking\s*:\s*(true|false)/.exec(body)?.[1] ?? null;
  const domains = /NSPrivacyTrackingDomains\s*:\s*\[([^\]]*)\]/.exec(body)?.[1] ?? '';
  return { declared, tracking, hasDomains: /['"]/.test(domains) };
}

function mergeInto(target, manifest) {
  for (const api of manifest?.NSPrivacyAccessedAPITypes ?? []) {
    const set = target.get(api.NSPrivacyAccessedAPIType) ?? new Set();
    for (const reason of api.NSPrivacyAccessedAPITypeReasons ?? []) set.add(reason);
    target.set(api.NSPrivacyAccessedAPIType, set);
  }
}

function appsWithPods(root) {
  const apps = join(root, 'apps');
  if (!existsSync(apps)) return [];
  return readdirSync(apps).sort().map((name) => join(apps, name)).filter((dir) => existsSync(join(dir, 'ios', 'Pods')));
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'repo root');
  const manifestPath = requireFile(options.manifest ?? join(root, FACTS.privacyManifestFile), 'declared privacy manifest (privacy-manifest.ts)');
  const appDirs = options.app.length > 0 ? options.app.map((dir) => requireDir(resolve(root, dir), 'app folder')) : appsWithPods(root);
  if (appDirs.length === 0) fail('no prebuilt app: no apps/*/ios/Pods folder', 'Run npx expo prebuild --platform ios --clean in the app first (it runs pod install).');
  const report = createReporter({ name: 'audit-privacy-manifest', json: options.json });
  const manifestRel = toPosix(relative(root, manifestPath)) || manifestPath;
  const { declared, tracking, hasDomains } = declaredReasons(readFileSync(manifestPath, 'utf8'));
  const trackingFix = "Our code tracks nothing: NSPrivacyTracking: false and no NSPrivacyTrackingDomains (Apple blocks requests to listed domains for players who decline ATT, which would stop their ads). Google's pods declare their own tracking; the app asks ATT before any ad request (owner decision O1).";
  if (tracking !== 'false') report.problem({ file: manifestRel, rule: 'app-tracking', message: `NSPrivacyTracking is ${tracking ?? 'missing'}`, fix: trackingFix });
  if (hasDomains) report.problem({ file: manifestRel, rule: 'app-tracking', message: 'NSPrivacyTrackingDomains lists domains', fix: trackingFix });
  let checked = 0;
  const trackingAllowed = new Set(FACTS.trackingAllowedPods);
  for (const appDir of appDirs) {
    const pods = join(appDir, 'ios', 'Pods');
    requireDir(pods, 'Pods folder');
    const files = walk(pods, { include: ['PrivacyInfo.xcprivacy'], followSymlinks: false });
    const required = new Map();
    const owners = new Map();
    const collected = new Set();
    const answers = new Set();
    for (const rel of files) {
      checked += 1;
      const pod = rel.split('/')[0];
      const manifest = readPlist(join(pods, rel));
      mergeInto(required, manifest);
      for (const api of manifest?.NSPrivacyAccessedAPITypes ?? []) {
        for (const reason of api.NSPrivacyAccessedAPITypeReasons ?? []) owners.set(`${api.NSPrivacyAccessedAPIType} ${reason}`, pod);
      }
      const domains = manifest?.NSPrivacyTrackingDomains ?? [];
      if ((manifest?.NSPrivacyTracking === true || domains.length > 0) && !trackingAllowed.has(pod)) {
        report.problem({ file: toPosix(relative(root, join(pods, rel))), rule: 'tracking-outside-google', message: `pod ${pod} declares tracking${domains.length ? ` (domains: ${domains.join(', ')})` : ''}`, fix: 'Only the Google ad pods may declare tracking (spec N2): a tracking pod means an analytics or attribution SDK slipped in; remove the package that brought it.' });
      }
      for (const item of manifest?.NSPrivacyCollectedDataTypes ?? []) {
        const type = String(item.NSPrivacyCollectedDataType).replace('NSPrivacyCollectedDataType', '');
        collected.add(`${pod}: ${type} linked=${item.NSPrivacyCollectedDataTypeLinked} tracking=${item.NSPrivacyCollectedDataTypeTracking}`);
        if (item.NSPrivacyCollectedDataTypeTracking === true) answers.add(`App Privacy: ${type} collected, ${item.NSPrivacyCollectedDataTypeLinked ? 'linked to the user' : 'not linked'}, used for tracking by the third-party ads SDK ${pod} (the app asks App Tracking Transparency first)`);
      }
    }
    for (const [category, reasons] of required) {
      for (const reason of reasons) {
        if (declared.get(category)?.has(reason) !== true) report.problem({ file: manifestRel, rule: 'missing-reason', message: `${category} ${reason} is declared by pod ${owners.get(`${category} ${reason}`)} but not by the app`, fix: 'Add it to PRIVACY_MANIFESTS (never edit ios/), then prebuild again. Apple emails ITMS-91053 for a missing declaration.' });
      }
    }
    const iosDir = join(appDir, 'ios');
    const appManifest = readdirSync(iosDir).map((name) => join(iosDir, name, 'PrivacyInfo.xcprivacy')).find((path) => !path.includes(`${join('ios', 'Pods')}`) && existsSync(path));
    if (appManifest) {
      const built = new Map();
      const builtManifest = readPlist(appManifest);
      mergeInto(built, builtManifest);
      if (builtManifest?.NSPrivacyTracking === true || (builtManifest?.NSPrivacyTrackingDomains ?? []).length > 0) report.problem({ file: toPosix(relative(root, appManifest)), rule: 'app-tracking', message: 'the prebuilt app manifest declares tracking or tracking domains', fix: trackingFix });
      for (const [category, reasons] of declared) {
        for (const reason of reasons) {
          if (built.get(category)?.has(reason) !== true) report.problem({ file: toPosix(relative(root, appManifest)), rule: 'prebuilt-stale', message: `the prebuilt manifest lacks ${category} ${reason}`, fix: 'The ios/ folder is older than privacy-manifest.ts: run npx expo prebuild --platform ios --clean.' });
        }
      }
    }
    report.note(`${toPosix(relative(root, appDir)) || appDir}: ${files.length} pod manifests`);
    for (const [category, reasons] of [...required].sort()) report.note(`  required ${category}: ${[...reasons].sort().join(', ')}`);
    for (const line of [...collected].sort()) report.note(`  collected ${line}`);
    for (const line of [...answers].sort()) report.note(`  ${line}`);
  }
  return report.finish({ checked, unit: 'pod manifests' });
});
