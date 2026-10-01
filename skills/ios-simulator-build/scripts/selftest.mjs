#!/usr/bin/env node
// selftest.mjs: proves every checker of this skill passes its good fixture and catches each planted bug.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { runSelftest } from './check-lib.mjs';
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

/** App fixtures carry their variant flags in args.json next to LineSiege.app. */
const appArgs = (dir) => ['--app', join(dir, 'LineSiege.app'), ...JSON.parse(readFileSync(join(dir, 'args.json'), 'utf8'))];

await runSelftest(import.meta.url, [
  { script: 'check-sim-setup.mjs', fixtures: '../tests/fixtures/sim-setup', args: (dir) => [dir] },
  { script: 'check-sim-app.mjs', fixtures: '../tests/fixtures/sim-app', args: appArgs },
  { script: 'check-sim-app.mjs', fixtures: '../tests/fixtures/sim-app-store', args: appArgs },
  { script: 'check-screenshot.mjs', fixtures: '../tests/fixtures/screenshot', args: (dir) => [dir] },
]);
