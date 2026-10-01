#!/usr/bin/env node
// selftest.mjs: proves the four audits on assembled fixtures:
//   audit-repo.mjs            templates/ + templates/tooling-deps/ (as packages/tooling) + base-repo/
//   audit-bundle.mjs          base-bundle/ (an expo export with its source map + a JS baseline)
//   audit-privacy-manifest.mjs base-pods/ (a prebuilt app's pod manifests + privacy-manifest.ts)
//   audit-app-bundle.mjs      base-app/ (a built .app + its entitlements XML)
//   check-template-format.mjs templates/ as they ship: every .ts/.tsx/.json template is already in
//                             the repo's Prettier format (needs npm ci --prefix scripts)
// Each case = its base + the planted change of mutation.json; ARGS.txt adds arguments.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs

import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runSelftest } from './check-lib.mjs';
import { assembleSuite } from './lib/assemble-fixtures.mjs';
import { ownerPlaceholderProblem, ownerStepsPendingLine, PLACEHOLDERS } from './lib/ship-placeholders.mjs';

// The ship gates refuse these scaffold placeholders by name, each with the owner step that replaces it
// (owner decision O4, lead decision L14): the pinned list, and the one OWNER STEPS PENDING line.
const PINNED = [
  { field: 'bundleId / premium.productId', value: 'com.example.*', name: 'the placeholder bundle id (com.example.*)', ownerStep: null, step: 'the fixed id io.applander.<game id without hyphens> (owner decision O4)' },
  { field: 'ads.ids.ios.appId', value: 'ca-app-pub-1234567890123456~1234567890', name: 'the placeholder AdMob app id', ownerStep: 'G5', step: "the owner's AdMob app id (owner step G5)" },
  { field: 'ads.ids.ios.units.banner', value: 'ca-app-pub-1234567890123456/1111111111', name: 'the placeholder AdMob banner unit', ownerStep: 'G5', step: "the owner's banner unit id (owner step G5)" },
  { field: 'ads.ids.ios.units.interstitial', value: 'ca-app-pub-1234567890123456/2222222222', name: 'the placeholder AdMob interstitial unit', ownerStep: 'G5', step: "the owner's interstitial unit id (owner step G5)" },
  { field: 'ads.ids.ios.units.rewarded', value: 'ca-app-pub-1234567890123456/3333333333', name: 'the placeholder AdMob rewarded unit', ownerStep: 'G5', step: "the owner's rewarded unit id (owner step G5)" },
  { field: 'links.privacyPolicy.host', value: 'example.com', name: 'the placeholder privacy-policy host', ownerStep: 'G3', step: "the owner's privacy-policy host (owner step G3)" },
  { field: 'links.supportEmail', value: 'support@example.com', name: 'the placeholder support address', ownerStep: 'G3', step: "the owner's support address (owner step G3)" },
];
const pendingLine = ownerStepsPendingLine(PLACEHOLDERS.filter((entry) => entry.ownerStep !== null).map((entry) => ownerPlaceholderProblem({ entry, file: 'game.config.ts' })));
if (JSON.stringify(PLACEHOLDERS) !== JSON.stringify(PINNED) || pendingLine !== 'OWNER STEPS PENDING: G3, G5') {
  console.log('FAIL scripts/lib/ship-placeholders.mjs [placeholders-pin] PLACEHOLDERS or the OWNER STEPS PENDING line is not the pinned one Fix: Restore the list in _library/shared/scripts/lib/ship-placeholders.mjs (a change needs the owner) and sync.');
  console.log('RESULT: FAIL (1 problems)');
  process.exit(1);
}

const skill = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = join(skill, 'tests', 'fixtures');
const wantsHelp = process.argv.includes('--help') || process.argv.includes('-h');
const suite = (name, options) => (wantsHelp ? join(fixtures, name) : assembleSuite({ suiteDir: join(fixtures, name), prefix: `privacy-${name}-`, ...options }));
const extraArgs = (dir) => (existsSync(join(dir, 'ARGS.txt')) ? readFileSync(join(dir, 'ARGS.txt'), 'utf8').trim().split(/\s+/) : []);

const repoCases = suite('audit-repo', {
  templates: join(skill, 'templates'),
  extraCopies: [[join(skill, 'templates', 'tooling-deps'), join('packages', 'tooling')]],
  baseRepo: join(fixtures, 'base-repo'),
});
const bundleCases = suite('audit-bundle', { baseRepo: join(fixtures, 'base-bundle') });
const podCases = suite('audit-privacy-manifest', { baseRepo: join(fixtures, 'base-pods') });
const appCases = suite('audit-app-bundle', { baseRepo: join(fixtures, 'base-app') });
const formatCases = suite('check-template-format', { templates: join(skill, 'templates') });

try {
  await runSelftest(import.meta.url, [
    { script: 'audit-repo.mjs', fixtures: repoCases, args: (dir) => [dir] },
    { script: 'audit-bundle.mjs', fixtures: bundleCases, args: (dir) => ['--export', join(dir, 'export'), '--baseline', join(dir, 'js-baseline.json'), ...extraArgs(dir)] },
    { script: 'audit-privacy-manifest.mjs', fixtures: podCases, args: (dir) => [dir] },
    { script: 'audit-app-bundle.mjs', fixtures: appCases, args: (dir) => ['--app', join(dir, 'DemoGame.app'), '--variant', 'store', '--ads-mode', 'live', '--entitlements', join(dir, 'entitlements.xml'), ...extraArgs(dir)] },
    { script: 'check-template-format.mjs', fixtures: formatCases, args: (dir) => [dir] },
  ]);
} finally {
  if (!wantsHelp) for (const dir of [repoCases, bundleCases, podCases, appCases, formatCases]) rmSync(dir, { recursive: true, force: true });
}
