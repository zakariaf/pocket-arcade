#!/usr/bin/env node
// selftest.mjs: proves every checker of this skill passes its good fixture and catches each planted bug.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { runSelftest } from './check-lib.mjs';
import { PLACEHOLDERS } from './lib/ship-placeholders.mjs';

// The ship gates refuse these scaffold placeholders by name (owner decision O4): the pinned list.
const PINNED = {
  bundleIdPrefix: 'com.example.',
  admobAppId: 'ca-app-pub-1234567890123456~1234567890',
  admobUnits: ['ca-app-pub-1234567890123456/1111111111', 'ca-app-pub-1234567890123456/2222222222', 'ca-app-pub-1234567890123456/3333333333'],
  privacyHost: 'example.com',
  supportEmail: 'support@example.com',
};
if (JSON.stringify(PLACEHOLDERS) !== JSON.stringify(PINNED)) {
  console.log('FAIL scripts/lib/ship-placeholders.mjs [placeholders-pin] PLACEHOLDERS is not the pinned list Fix: Restore the list in _library/shared/scripts/lib/ship-placeholders.mjs (a change needs the owner) and sync.');
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
