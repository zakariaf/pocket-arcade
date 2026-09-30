#!/usr/bin/env node
// selftest.mjs: proves every checker of this skill passes its good fixture and catches each planted bug.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { runSelftest } from './check-lib.mjs';

/** App fixtures carry their variant flags in args.json next to LineSiege.app. */
const appArgs = (dir) => ['--app', join(dir, 'LineSiege.app'), ...JSON.parse(readFileSync(join(dir, 'args.json'), 'utf8'))];

await runSelftest(import.meta.url, [
  { script: 'check-sim-setup.mjs', fixtures: '../tests/fixtures/sim-setup', args: (dir) => [dir] },
  { script: 'check-sim-app.mjs', fixtures: '../tests/fixtures/sim-app', args: appArgs },
  { script: 'check-sim-app.mjs', fixtures: '../tests/fixtures/sim-app-store', args: appArgs },
  { script: 'check-screenshot.mjs', fixtures: '../tests/fixtures/screenshot', args: (dir) => [dir] },
]);
