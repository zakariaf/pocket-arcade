#!/usr/bin/env node
// selftest.mjs: proves both scripts of this skill on copies of tests/fixtures/base-repo:
//   check-deps-policy.mjs passes the base repo and fails each planted policy break;
//   plan-dependency.mjs passes a covered install plan and fails each forbidden request, and its
//   pass-* cases pin the commands a passing plan prints (npx expo install <pkg>@<table spec>).
// runSelftest checks every kind (good, pass-*, bad-*, error-*) and each EXPECT.txt.
// Each case = base repo + its mutation.json (+ ARGS.txt and npm view samples for plans).
// Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs

import { readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assembleSuite } from './lib/assemble-fixtures.mjs';
import { runSelftest } from './check-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, '..', 'tests', 'fixtures');
const wantsHelp = process.argv.includes('--help') || process.argv.includes('-h');
const suite = (name) => (wantsHelp ? join(fixtures, name) : assembleSuite(join(fixtures, 'base-repo'), join(fixtures, name)));
const policyCases = suite('check-deps-policy');
const planCases = suite('plan-dependency');
const argsFile = (dir) => readFileSync(join(dir, 'ARGS.txt'), 'utf8').trim().split(/\s+/);
const planArgs = (dir) => [...argsFile(dir), '--root', dir];

try {
  await runSelftest(import.meta.url, [
    { script: 'check-deps-policy.mjs', fixtures: policyCases, args: (dir) => [dir, '--today', '2026-09-28'] },
    { script: 'plan-dependency.mjs', fixtures: planCases, args: planArgs },
  ]);
} finally {
  if (!wantsHelp) for (const dir of [policyCases, planCases]) rmSync(dir, { recursive: true, force: true });
}
