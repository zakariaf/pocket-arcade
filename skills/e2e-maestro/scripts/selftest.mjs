#!/usr/bin/env node
// selftest.mjs: proves each checker of this skill passes its good fixture and catches every planted bug.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { runSelftest } from './check-lib.mjs';

/** Arguments from the fixture's args.txt (whitespace separated); "." is the fixture folder itself. */
function fixtureArgs(dir) {
  const file = join(dir, 'args.txt');
  return existsSync(file) ? readFileSync(file, 'utf8').trim().split(/\s+/) : [dir];
}

// check-flows-empty: a repo without flows passes with a SKIP line while shell-slice.json marks a
// partial Shell, and fails flows-missing (exit 1) once the whole Shell is built.
// check-flows-slice: with shell-slice.json a flow that reaches a screen outside the slice prints a
// SKIP line (Shell flows 01-03 before Shell step 10); a flow inside the slice is checked strictly.
// check-e2e-setup-slice: with shell-slice.json the debug kit is Shell core (strict once the composition
// root exists, a not-yet-due SKIP before it); S15's model hook and the sub-flows of screens outside the
// slice print SKIP lines; S15 inside the slice is checked strictly.
await runSelftest(import.meta.url, [
  { script: 'check-flows.mjs', fixtures: '../tests/fixtures/check-flows', args: fixtureArgs },
  { script: 'check-flows.mjs', fixtures: '../tests/fixtures/check-flows-empty', args: fixtureArgs },
  { script: 'check-flows.mjs', fixtures: '../tests/fixtures/check-flows-slice', args: fixtureArgs },
  { script: 'check-e2e-setup.mjs', fixtures: '../tests/fixtures/check-e2e-setup', args: fixtureArgs },
  { script: 'check-e2e-setup.mjs', fixtures: '../tests/fixtures/check-e2e-setup-slice', args: fixtureArgs },
  { script: 'check-e2e-report.mjs', fixtures: '../tests/fixtures/check-e2e-report', args: fixtureArgs },
]);
