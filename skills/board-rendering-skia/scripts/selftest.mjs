#!/usr/bin/env node
// selftest.mjs: proves both checkers pass their good fixture and catch every planted bug.
// The good fixtures are the composed template set (tests/build-fixtures.mjs), so the self-test first
// proves they still equal the templates; after changing a template run node tests/build-fixtures.mjs.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs

import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { runSelftest } from './check-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const drift = spawnSync(process.execPath, [join(here, '..', 'tests', 'build-fixtures.mjs'), '--check'], { encoding: 'utf8' });
if (drift.status !== 0) {
  process.stdout.write(drift.stdout);
  process.exit(1);
}
console.log('ok   good fixtures equal the templates (tests/build-fixtures.mjs --check)');

// The repo's npm test gate (templates/tooling/quality/check-worklet-boundary.ts, REQUIRED) must
// require 'worklet' in every module check-board-code requires it in (WORKLET_REQUIRED): every good
// fixture file a checker pattern matches must match a template pattern, and every checker pattern
// must match a fixture file, so the comparison is never empty.
function regexList(file, name) {
  const source = readFileSync(join(here, file), 'utf8');
  const block = new RegExp(`const ${name} = \\[\\n([\\s\\S]*?)\\n\\];`).exec(source);
  if (block === null) throw new Error(`${file}: no ${name} list`);
  return block[1].split('\n').map((line) => {
    const literal = line.trim().replace(/,$/, '');
    const end = literal.lastIndexOf('/');
    return new RegExp(literal.slice(1, end), literal.slice(end + 1));
  });
}
const checkerList = regexList('check-board-code.mjs', 'WORKLET_REQUIRED');
const templateList = regexList('../templates/tooling/quality/check-worklet-boundary.ts', 'REQUIRED');
const goodRoot = join(here, '..', 'tests', 'fixtures', 'check-board-code', 'good');
const sourceFiles = readdirSync(goodRoot, { recursive: true, encoding: 'utf8' })
  .map((path) => path.split('\\').join('/'))
  .filter((path) => /\.ts$/.test(path) && !/\.test\.ts$/.test(path));
const listProblems = [
  ...checkerList.filter((re) => !sourceFiles.some((path) => re.test(path))).map((re) => `checker pattern ${re} matches no good fixture file`),
  ...sourceFiles.filter((path) => checkerList.some((re) => re.test(path)) && !templateList.some((re) => re.test(path))).map((path) => `${path}: check-board-code requires 'worklet' but check-worklet-boundary.ts REQUIRED does not`),
];
for (const problem of listProblems) console.log(`FAIL templates/tooling/quality/check-worklet-boundary.ts [worklet-lists-agree] ${problem} Fix: add the module to REQUIRED in the template (and the repo copy).`);
if (listProblems.length > 0) process.exit(1);
console.log(`ok   check-worklet-boundary.ts REQUIRED covers check-board-code's WORKLET_REQUIRED (${sourceFiles.filter((path) => checkerList.some((re) => re.test(path))).length} good fixture modules)`);

await runSelftest(import.meta.url, [
  { script: 'check-board-code.mjs', fixtures: '../tests/fixtures/check-board-code', args: (dir) => [dir] },
  { script: 'check-board-files.mjs', fixtures: '../tests/fixtures/check-board-files', args: (dir) => [dir] },
]);
