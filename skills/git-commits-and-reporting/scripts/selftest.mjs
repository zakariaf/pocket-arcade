#!/usr/bin/env node
// selftest.mjs: proves check-commits.mjs (log mode, message mode and the shared sample list the
// commit-msg hook's test also runs), check-tags.mjs and
// check-report.mjs (release, slice and request form, and the change sections) pass their good fixtures and catch every planted bug.
// The commit fixtures are real `git log` output captured from throwaway repositories.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { runSelftest } from './check-lib.mjs';

const filesOf = (dir) => readFileSync(join(dir, 'files.txt'), 'utf8').split('\n').filter(Boolean).join(',');

await runSelftest(import.meta.url, [
  { script: 'check-commits.mjs', fixtures: '../tests/fixtures/check-commits', args: (dir) => [dir, '--log', join(dir, 'commits.log')] },
  { script: 'check-commits.mjs', fixtures: '../tests/fixtures/check-commit-message', args: (dir) => [dir, '--message', join(dir, 'message.txt'), '--files', filesOf(dir)] },
  // The sample list the repo's commit-msg hook test also runs (good/ is the synced shared copy).
  { script: 'check-commits.mjs', fixtures: '../tests/fixtures/check-commits-samples', args: (dir) => ['--samples', join(dir, 'commit-message-samples.json')] },
  { script: 'check-tags.mjs', fixtures: '../tests/fixtures/check-tags', args: (dir) => [dir, '--list', join(dir, 'tags.txt')] },
  { script: 'check-report.mjs', fixtures: '../tests/fixtures/check-report', args: (dir) => [join(dir, 'report.md'), '--kind', 'release'] },
  { script: 'check-report.mjs', fixtures: '../tests/fixtures/check-report-slice', args: (dir) => [join(dir, 'report.md'), '--kind', 'slice'] },
  { script: 'check-report.mjs', fixtures: '../tests/fixtures/check-request', args: (dir) => [join(dir, 'message.md'), '--kind', 'request'] },
  // The optional change sections: design references, parity waivers and texts in four languages.
  { script: 'check-report.mjs', fixtures: '../tests/fixtures/check-report-changes', args: (dir) => [join(dir, 'report.md'), '--kind', 'slice'] },
]);
