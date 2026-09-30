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
  details: 'Rules: missing-reason, app-tracking, tracking-outside-google, prebuilt-stale.\nNeeds a prebuild: npx expo prebuild --platform ios --clean (it runs pod install).',
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
  return { declared, tracking };
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
  const { declared, tracking } = declaredReasons(readFileSync(manifestPath, 'utf8'));
  if (tracking !== 'false') report.problem({ file: manifestRel, rule: 'app-tracking', message: `NSPrivacyTracking is ${tracking ?? 'missing'}`, fix: 'Our code tracks nothing: NSPrivacyTracking: false.' });
  let checked = 0;
  const trackingAllowed = new Set(FACTS.trackingAllowedPods);
  for (const appDir of appDirs) {
    const pods = join(appDir, 'ios', 'Pods');
    requireDir(pods, 'Pods folder');
    const files = walk(pods, { include: ['PrivacyInfo.xcprivacy'], followSymlinks: false });
    const required = new Map();
    const owners = new Map();
    const collected = new Set();
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
        report.problem({ file: toPosix(relative(root, join(pods, rel))), rule: 'tracking-outside-google', message: `pod ${pod} declares tracking${domains.length ? ` (domains: ${domains.join(', ')})` : ''}`, fix: 'Only the Google ad pods may declare tracking (spec N2, decision D4); remove the package that brought this pod.' });
      }
      for (const item of manifest?.NSPrivacyCollectedDataTypes ?? []) {
        collected.add(`${pod}: ${String(item.NSPrivacyCollectedDataType).replace('NSPrivacyCollectedDataType', '')} linked=${item.NSPrivacyCollectedDataTypeLinked} tracking=${item.NSPrivacyCollectedDataTypeTracking}`);
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
      mergeInto(built, readPlist(appManifest));
      for (const [category, reasons] of declared) {
        for (const reason of reasons) {
          if (built.get(category)?.has(reason) !== true) report.problem({ file: toPosix(relative(root, appManifest)), rule: 'prebuilt-stale', message: `the prebuilt manifest lacks ${category} ${reason}`, fix: 'The ios/ folder is older than privacy-manifest.ts: run npx expo prebuild --platform ios --clean.' });
        }
      }
    }
    report.note(`${toPosix(relative(root, appDir)) || appDir}: ${files.length} pod manifests`);
    for (const [category, reasons] of [...required].sort()) report.note(`  required ${category}: ${[...reasons].sort().join(', ')}`);
    for (const line of [...collected].sort()) report.note(`  collected ${line}`);
  }
  return report.finish({ checked, unit: 'pod manifests' });
});
