#!/usr/bin/env node
// selftest.mjs: proves both checkers pass their good fixtures and catch every planted bug.
// Files that must never be committed (a .claude/settings.json inside a skill, anything named like a
// key, private key text, an .ipa) are created at run time in temporary copies, from plant.json.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { makeTempDir, removeTempDir, runSelftest } from './check-lib.mjs';
import { GOOGLE_SAMPLE_APP_IDS, notRealAdIdOf, ownerPlaceholderProblem, ownerStepsPendingLine, PLACEHOLDERS } from './lib/ship-placeholders.mjs';

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
// Not a real AdMob id: a placeholder or any of Google's sample (test) ids, with the platform's owner step.
const NOT_REAL_PIN = [
  [notRealAdIdOf('ca-app-pub-3940256099942544/2934735716', 'ios')?.ownerStep, 'G5'],
  [notRealAdIdOf('ca-app-pub-3940256099942544~3347511713', 'android')?.ownerStep, 'GP5'],
  [notRealAdIdOf('ca-app-pub-1234567890123456/1111111111', 'android')?.ownerStep, 'GP5'],
  [notRealAdIdOf('ca-app-pub-7310520968431056/4417703951', 'ios'), null],
  [GOOGLE_SAMPLE_APP_IDS.ios, 'ca-app-pub-3940256099942544~1458002511'],
  [GOOGLE_SAMPLE_APP_IDS.android, 'ca-app-pub-3940256099942544~3347511713'],
];
const isNotRealPinned = NOT_REAL_PIN.every(([got, want]) => got === want);
if (JSON.stringify(PLACEHOLDERS) !== JSON.stringify(PINNED) || pendingLine !== 'OWNER STEPS PENDING: G3, G5' || !isNotRealPinned) {
  console.log('FAIL scripts/lib/ship-placeholders.mjs [placeholders-pin] PLACEHOLDERS, notRealAdIdOf (Google\'s sample ids: G5 iOS, GP5 Android), GOOGLE_SAMPLE_APP_IDS or the OWNER STEPS PENDING line is not the pinned one Fix: Restore the list in _library/shared/scripts/lib/ship-placeholders.mjs (a change needs the owner) and sync.');
  console.log('RESULT: FAIL (1 problems)');
  process.exit(1);
}

const temps = [];
process.on('exit', () => temps.forEach((dir) => removeTempDir(dir)));

function tempCopy(dir) {
  const copy = join(makeTempDir('release-selftest-'), 'repo');
  temps.push(dirname(copy));
  cpSync(dir, copy, { recursive: true });
  return copy;
}

// Built from parts so this file never contains private key text itself.
const FAKE_KEY = ['-----BEGIN ', 'PRIVATE KEY-----', '\nnot-a-real-key\n', '-----END ', 'PRIVATE KEY-----', '\n'].join('');

/** release-setup fixtures: copy, then create the files listed in plant.json. */
function plantedRepo(dir) {
  const copy = tempCopy(dir);
  const plant = existsSync(join(dir, 'plant.json')) ? JSON.parse(readFileSync(join(dir, 'plant.json'), 'utf8')) : {};
  for (const [rel, content] of Object.entries(plant)) {
    mkdirSync(dirname(join(copy, rel)), { recursive: true });
    const text = typeof content === 'string' ? content : `# Handover\n\nkey:\n${FAKE_KEY}`;
    writeFileSync(join(copy, rel), text);
  }
  return [copy];
}

function artifactArgs(dir) {
  const args = JSON.parse(readFileSync(join(dir, 'args.json'), 'utf8'));
  const entitlements = join(dir, 'entitlements.plist');
  return existsSync(entitlements) ? [...args, '--entitlements', entitlements] : args;
}

/** store-artifact-store fixtures: zip Payload/ into a real .ipa and check it through --ipa. */
function ipaArgs(dir) {
  const work = tempCopy(dir);
  const ipa = join(dirname(work), 'LineSiege.ipa');
  const zip = spawnSync('zip', ['-qr', ipa, 'Payload'], { cwd: work });
  if (zip.status !== 0) throw new Error(`zip failed for ${dir}`);
  return ['--ipa', ipa, ...artifactArgs(dir)];
}

await runSelftest(import.meta.url, [
  { script: 'check-release-setup.mjs', fixtures: '../tests/fixtures/release-setup', args: plantedRepo },
  { script: 'check-store-artifact.mjs', fixtures: '../tests/fixtures/store-artifact', args: (dir) => ['--app', join(dir, 'Payload', 'LineSiege.app'), ...artifactArgs(dir)] },
  { script: 'check-store-artifact.mjs', fixtures: '../tests/fixtures/store-artifact-store', args: ipaArgs },
]);
