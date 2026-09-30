#!/usr/bin/env node
// selftest.mjs: proves both scripts of this skill on copies of tests/fixtures/base-repo:
//   check-deps-policy.mjs passes the base repo and fails each planted policy break;
//   plan-dependency.mjs passes a covered install plan and fails each forbidden request, and its
//   pass-* cases pin the commands a passing plan prints (npx expo install <pkg>@<table spec>).
// Each case = base repo + its mutation.json (+ ARGS.txt and npm view samples for plans).
// Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs

import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assembleSuite } from './lib/assemble-fixtures.mjs';
import { createReporter, runSelftest } from './check-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, '..', 'tests', 'fixtures');
const wantsHelp = process.argv.includes('--help') || process.argv.includes('-h');
const suite = (name) => (wantsHelp ? join(fixtures, name) : assembleSuite(join(fixtures, 'base-repo'), join(fixtures, name)));
const policyCases = suite('check-deps-policy');
const planCases = suite('plan-dependency');
const argsFile = (dir) => readFileSync(join(dir, 'ARGS.txt'), 'utf8').trim().split(/\s+/);
const planArgs = (dir) => [...argsFile(dir), '--root', dir];
const lines = (file) => readFileSync(file, 'utf8').split('\n').map((line) => line.trim()).filter(Boolean);

/**
 * runSelftest checks only that good/ passes; a pass-<case>/ folder must also exit 0, end with
 * RESULT: PASS and print every line of its EXPECT.txt. Returns true when one did not.
 */
function passCasesFailed() {
  if (wantsHelp) return false;
  const report = createReporter({ name: 'selftest' });
  const names = readdirSync(planCases).filter((entry) => entry.startsWith('pass-')).sort();
  for (const name of names) {
    const dir = join(planCases, name);
    const result = spawnSync(process.execPath, [join(here, 'plan-dependency.mjs'), ...planArgs(dir)], { cwd: dir, encoding: 'utf8', timeout: 60000 });
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    const problems = lines(join(dir, 'EXPECT.txt')).filter((text) => !output.includes(text)).map((text) => `output does not contain "${text}"`);
    if (result.status !== 0 || output.trim().split('\n').at(-1) !== 'RESULT: PASS') problems.unshift(`expected exit 0 and RESULT: PASS, got exit ${result.status}`);
    if (problems.length > 0) report.problem({ file: `tests/fixtures/plan-dependency/${name}`, rule: 'selftest-outcome', message: `plan-dependency.mjs ${name}: ${problems.join('; ')}\n${output.trim().split('\n').slice(-8).join('\n')}`, fix: 'Fix the plan (or the case) so a passing plan prints the commands EXPECT.txt names.' });
    else console.log(`ok   plan-dependency.mjs ${name} (exit 0, found ${lines(join(dir, 'EXPECT.txt')).length} expected lines)`);
  }
  if (report.count === 0) return false;
  process.exitCode = report.finish({ checked: names.length, unit: 'outcome runs' });
  return true;
}

try {
  if (!passCasesFailed()) await runSelftest(import.meta.url, [
    { script: 'check-deps-policy.mjs', fixtures: policyCases, args: (dir) => [dir, '--today', '2026-09-28'] },
    { script: 'plan-dependency.mjs', fixtures: planCases, args: planArgs },
  ]);
} finally {
  if (!wantsHelp) for (const dir of [policyCases, planCases]) rmSync(dir, { recursive: true, force: true });
}
