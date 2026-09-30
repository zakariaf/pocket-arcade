#!/usr/bin/env node
// Self-test: build-index.mjs and check-index.mjs run on small skill libraries (tests/fixtures/<script>/):
// good/ must pass, and every bad-*/ holds one planted bug that must fail with the lines of its EXPECT.txt.
// check-index fixtures hold two task rows, so they run with --min-tasks 2 unless args.json says otherwise,
// and with --readme when the fixture has a README.md.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { runSelftest } from './check-lib.mjs';

const library = (dir) => ['--skills-root', join(dir, 'skills'), '--index', join(dir, 'skills', 'route-index')];
const extra = (dir, fallback) => (existsSync(join(dir, 'args.json')) ? JSON.parse(readFileSync(join(dir, 'args.json'), 'utf8')) : fallback);

await runSelftest(import.meta.url, [
  { script: 'build-index.mjs', fixtures: '../tests/fixtures/build-index', args: (dir) => library(dir) },
  {
    script: 'check-index.mjs',
    fixtures: '../tests/fixtures/check-index',
    args: (dir) => [...library(dir), ...extra(dir, ['--min-tasks', '2']), ...(existsSync(join(dir, 'README.md')) ? ['--readme', join(dir, 'README.md')] : [])],
  },
]);
