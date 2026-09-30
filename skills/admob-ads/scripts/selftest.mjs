#!/usr/bin/env node
// selftest.mjs: proves both checkers on copies of templates/ + tests/fixtures/base-repo/:
//   check-ads.mjs passes the clean repo and fails each planted static problem;
//   check-ad-behaviour.mjs passes the clean repo and fails each planted rule break.
// Each case = templates + base repo + its mutation.json (built in a temporary folder).
// Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs

import { rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runSelftest } from './check-lib.mjs';
import { assembleSuite } from './lib/assemble-fixtures.mjs';

const skill = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = join(skill, 'tests', 'fixtures');
const wantsHelp = process.argv.includes('--help') || process.argv.includes('-h');
const suite = (name) =>
  wantsHelp ? join(fixtures, name) : assembleSuite({ templates: join(skill, 'templates'), baseRepo: join(fixtures, 'base-repo'), suiteDir: join(fixtures, name), prefix: 'admob-ads-fixtures-' });
const staticCases = suite('check-ads');
const behaviourCases = suite('check-ad-behaviour');

try {
  await runSelftest(import.meta.url, [
    { script: 'check-ads.mjs', fixtures: staticCases, args: (dir) => [dir] },
    { script: 'check-ad-behaviour.mjs', fixtures: behaviourCases, args: (dir) => [dir] },
  ]);
} finally {
  if (!wantsHelp) for (const dir of [staticCases, behaviourCases]) rmSync(dir, { recursive: true, force: true });
}
