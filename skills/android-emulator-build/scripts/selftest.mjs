#!/usr/bin/env node
// selftest.mjs: proves both checkers pass their good fixtures and catch every planted bug. check-emu-app
// reads its APK through tests/fixtures/fakes/fake-aapt2.mjs, which prints the aapt2 dumps saved
// next to each fixture's app-release.apk (real zip files with the bundle and app.config inside).
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runSelftest } from './check-lib.mjs';

const FAKE_AAPT2 = join(dirname(fileURLToPath(import.meta.url)), '..', 'tests', 'fixtures', 'fakes', 'fake-aapt2.mjs');

/** App fixtures carry their variant flags in args.json next to app-release.apk, and maybe a screenshot. */
const appArgs = (dir) => [
  '--apk',
  join(dir, 'app-release.apk'),
  '--aapt2',
  FAKE_AAPT2,
  ...JSON.parse(readFileSync(join(dir, 'args.json'), 'utf8')),
  ...(existsSync(join(dir, 'screenshot.png')) ? ['--screenshot', join(dir, 'screenshot.png')] : []),
];

await runSelftest(import.meta.url, [
  { script: 'check-emu-setup.mjs', fixtures: '../tests/fixtures/emu-setup', args: (dir) => [dir] },
  { script: 'check-emu-app.mjs', fixtures: '../tests/fixtures/emu-app', args: appArgs },
  { script: 'check-emu-app.mjs', fixtures: '../tests/fixtures/emu-app-store', args: appArgs },
]);
