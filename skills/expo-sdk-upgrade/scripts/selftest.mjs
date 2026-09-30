#!/usr/bin/env node
// selftest.mjs: proves both checkers of this skill on assembled copies of the base repos:
//   check-sdk-alignment.mjs on an SDK 57 repo, a readiness scan for SDK 58, and an SDK 58 repo;
//   check-sdk-trigger.mjs on saved npm facts (no network): bad-* cases are "the move is due"
//   (exit 1), pass-* cases are "no move due" with the reason and date it prints (exit 0), and
//   error-* cases are bad input (exit 2).
// Each case = base repo (+ overlays) + its mutation.json + EXPECT.txt (+ ARGS.txt).
// Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assembleSuite } from './lib/assemble-fixtures.mjs';
import { createReporter, runSelftest } from './check-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, '..', 'tests', 'fixtures');
const wantsHelp = process.argv.includes('--help') || process.argv.includes('-h');
const suite = (name, ...bases) => (wantsHelp ? join(fixtures, name) : assembleSuite(bases.map((base) => join(fixtures, base)), join(fixtures, name)));
const sdk57 = suite('check-sdk-alignment-57', 'base-sdk57');
const readiness = suite('check-sdk-alignment-readiness', 'base-sdk57');
const sdk58 = suite('check-sdk-alignment-58', 'base-sdk58');
const trigger = suite('check-sdk-trigger', 'base-sdk57', 'trigger-facts');
const triggerArgs = (dir) => [dir, '--facts', join(dir, 'facts.json'), '--today', '2026-11-02'];

const expectedLines = (dir) => readFileSync(join(dir, 'EXPECT.txt'), 'utf8').split('\n').map((line) => line.trim()).filter(Boolean);

/**
 * runSelftest only checks that good/ passes. The outcome cases also pin what the checker prints:
 * pass-<case>/ must exit 0 and end with RESULT: PASS, error-<case>/ must exit 2, and both must print
 * every line of their EXPECT.txt. ARGS.txt (optional) replaces the suite's arguments.
 */
function checkOutcomes(report, script, suiteDir, args) {
  let runs = 0;
  for (const name of readdirSync(suiteDir).filter((entry) => /^(pass|error)-/.test(entry)).sort()) {
    const dir = join(suiteDir, name);
    const want = name.startsWith('pass-') ? 0 : 2;
    const argv = existsSync(join(dir, 'ARGS.txt')) ? readFileSync(join(dir, 'ARGS.txt'), 'utf8').trim().split(/\s+/) : args(dir);
    const result = spawnSync(process.execPath, [join(here, script), ...argv], { cwd: dir, encoding: 'utf8', timeout: 60000 });
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    const last = output.trim().split('\n').at(-1);
    const problems = expectedLines(dir).filter((text) => !output.includes(text)).map((text) => `output does not contain "${text}"`);
    if (result.status !== want) problems.unshift(`expected exit ${want}, got ${result.status}`);
    if (want === 0 && last !== 'RESULT: PASS') problems.push(`expected RESULT: PASS as the last line, got "${last}"`);
    runs += 1;
    if (problems.length > 0) report.problem({ file: `tests/fixtures/${script.replace('.mjs', '')}/${name}`, rule: 'selftest-outcome', message: `${script} ${name}: ${problems.join('; ')}\n${output.trim().split('\n').slice(-8).join('\n')}`, fix: 'Fix the checker (or the case) so the outcome and the printed reason match EXPECT.txt.' });
    else console.log(`ok   ${script} ${name} (exit ${want}, found ${expectedLines(dir).length} expected lines)`);
  }
  return runs;
}

/** The outcome cases first; a failure there is the result (the suites would end with their own PASS). */
function outcomesFailed() {
  if (wantsHelp) return false;
  const report = createReporter({ name: 'selftest' });
  const runs = checkOutcomes(report, 'check-sdk-trigger.mjs', trigger, triggerArgs);
  if (report.count === 0) return false;
  process.exitCode = report.finish({ checked: runs, unit: 'outcome runs' });
  return true;
}

try {
  if (!outcomesFailed()) await runSelftest(import.meta.url, [
    { script: 'check-sdk-alignment.mjs', fixtures: sdk57, args: (dir) => [dir] },
    { script: 'check-sdk-alignment.mjs', fixtures: readiness, args: (dir) => [dir, '--target-sdk', '58'] },
    { script: 'check-sdk-alignment.mjs', fixtures: sdk58, args: (dir) => [dir] },
    { script: 'check-sdk-trigger.mjs', fixtures: trigger, args: triggerArgs },
  ]);
} finally {
  if (!wantsHelp) for (const dir of [sdk57, readiness, sdk58, trigger]) rmSync(dir, { recursive: true, force: true });
}
