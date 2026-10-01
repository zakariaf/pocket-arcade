#!/usr/bin/env node
// selftest.mjs: proves both checkers of this skill on assembled copies of the base repos:
//   check-sdk-alignment.mjs on an SDK 57 repo, a readiness scan for SDK 58, and an SDK 58 repo;
//   check-sdk-trigger.mjs on saved npm facts (no network): bad-* cases are "the move is due"
//   (exit 1), pass-* cases are "no move due" with the reason and date it prints (exit 0), and
//   error-* cases are bad input (exit 2). runSelftest checks every kind and each EXPECT.txt; an
//   error-* case's ARGS.txt replaces the suite's arguments.
// Each case = base repo (+ overlays) + its mutation.json + EXPECT.txt (+ ARGS.txt).
// Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs

import { rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assembleSuite } from './lib/assemble-fixtures.mjs';
import { runSelftest } from './check-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, '..', 'tests', 'fixtures');
const wantsHelp = process.argv.includes('--help') || process.argv.includes('-h');
const suite = (name, ...bases) => (wantsHelp ? join(fixtures, name) : assembleSuite(bases.map((base) => join(fixtures, base)), join(fixtures, name)));
const sdk57 = suite('check-sdk-alignment-57', 'base-sdk57');
const readiness = suite('check-sdk-alignment-readiness', 'base-sdk57');
const sdk58 = suite('check-sdk-alignment-58', 'base-sdk58');
const trigger = suite('check-sdk-trigger', 'base-sdk57', 'trigger-facts');
const triggerArgs = (dir) => [dir, '--facts', join(dir, 'facts.json'), '--today', '2026-11-02'];

try {
  await runSelftest(import.meta.url, [
    { script: 'check-sdk-alignment.mjs', fixtures: sdk57, args: (dir) => [dir] },
    { script: 'check-sdk-alignment.mjs', fixtures: readiness, args: (dir) => [dir, '--target-sdk', '58'] },
    { script: 'check-sdk-alignment.mjs', fixtures: sdk58, args: (dir) => [dir] },
    { script: 'check-sdk-trigger.mjs', fixtures: trigger, args: triggerArgs },
  ]);
} finally {
  if (!wantsHelp) for (const dir of [sdk57, readiness, sdk58, trigger]) rmSync(dir, { recursive: true, force: true });
}
