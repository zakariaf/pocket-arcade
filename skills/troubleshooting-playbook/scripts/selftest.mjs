#!/usr/bin/env node
// selftest.mjs: proves every checker of this skill passes its good fixture and catches every planted
// bug in the bad-* fixtures, and that find-fix ranks the right entry first for each pass-top-* query. Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs
// The check-known-pitfalls cases run from a temporary copy: a case holding GIT-ADD.txt becomes its
// own git repository with the listed paths in the index, so a rule that asks git what is tracked
// (android-native-folder-committed) sees exactly the planted files, not this skill's repository.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { makeTempDir, removeTempDir, runSelftest } from './check-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

function git(dir, args) {
  const result = spawnSync('git', ['-c', 'init.defaultBranch=main', '-C', dir, ...args], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed in ${dir}: ${result.stderr || result.error?.message}`);
}

/** The pitfall fixtures in a temporary folder, each GIT-ADD.txt case with its own git index. */
function plantedPitfallFixtures() {
  const temp = makeTempDir('troubleshooting-pitfalls-');
  process.on('exit', () => removeTempDir(temp));
  const target = join(temp, 'check-known-pitfalls');
  cpSync(join(HERE, '..', 'tests', 'fixtures', 'check-known-pitfalls'), target, { recursive: true });
  for (const name of readdirSync(target)) {
    const list = join(target, name, 'GIT-ADD.txt');
    if (!existsSync(list)) continue;
    git(join(target, name), ['init', '-q']);
    git(join(target, name), ['add', '-f', '--', ...readFileSync(list, 'utf8').split('\n').filter(Boolean)]);
  }
  return target;
}

await runSelftest(import.meta.url, [
  { script: 'check-known-pitfalls.mjs', fixtures: plantedPitfallFixtures(), args: (dir) => [dir] },
  { script: 'check-catalogue.mjs', fixtures: '../tests/fixtures/check-catalogue', args: (dir) => ['--catalogue', join(dir, 'known-failures.json'), '--references', join(dir, 'references')] },
  { script: 'find-fix.mjs', fixtures: '../tests/fixtures/find-fix', args: (dir) => ['--log', join(dir, 'build.log')] },
  // One --text query per line of queries.txt: every query must find a known failure (good), an
  // unknown one must fail with no-known-fix (bad-*), and each pass-top-<id>/ query must rank its
  // entry first (--limit 1 prints only the top match; EXPECT.txt names it).
  { script: 'find-fix.mjs', fixtures: '../tests/fixtures/find-fix-text', args: (dir) => [...readFileSync(join(dir, 'queries.txt'), 'utf8').split('\n').filter(Boolean).flatMap((query) => ['--text', query]), ...(basename(dir).startsWith('pass-') ? ['--limit', '1'] : [])] },
]);
