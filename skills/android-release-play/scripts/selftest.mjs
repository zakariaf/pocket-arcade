#!/usr/bin/env node
// selftest.mjs: proves both checkers pass their good fixtures and catch every planted bug.
// release-setup cases are copied to a temporary folder first, where each case's
// claude-settings.json becomes .claude/settings.json and plant.json writes files git refuses to
// hold (a *.jks key). Before the suites, it proves --stamp: a passing gate writes the stamp with
// the AAB's sha256, a failing one or a rehearsal writes none.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { makeTempDir, removeTempDir, runSelftest } from './check-lib.mjs';

/** A temporary folder removed when the self-test ends. */
function tempDir(prefix) {
  const dir = makeTempDir(prefix);
  process.on('exit', () => removeTempDir(dir));
  return dir;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, '..', 'tests', 'fixtures');

/** AAB fixtures: the AAB, the flags in args.json, the tags in tags.txt, the fixture folder as repo root. */
const aabArgs = (dir) => ['--aab', join(dir, 'app-release.aab'), '--tags-list', join(dir, 'tags.txt'), ...JSON.parse(readFileSync(join(dir, 'args.json'), 'utf8')), dir];

function stampProblems() {
  const temp = tempDir('android-release-play-stamp-');
  const run = (dir, stamp) => spawnSync(process.execPath, [join(HERE, 'check-store-aab.mjs'), ...aabArgs(join(FIXTURES, 'store-aab', dir)), '--stamp', stamp], { encoding: 'utf8' });
  const problems = [];
  const good = join(temp, 'good.json');
  run('good', good);
  const sha256 = createHash('sha256').update(readFileSync(join(FIXTURES, 'store-aab', 'good', 'app-release.aab'))).digest('hex');
  const stamp = existsSync(good) ? JSON.parse(readFileSync(good, 'utf8')) : null;
  if (stamp?.result !== 'PASS' || stamp.sha256 !== sha256 || stamp.versionCode !== 10 || stamp.isUnsigned !== false) problems.push('a passing gate did not write { result: PASS, sha256, versionCode: 10, isUnsigned: false }');
  run('bad-sample-ad-id', join(temp, 'bad.json'));
  if (existsSync(join(temp, 'bad.json'))) problems.push('a failing gate wrote a stamp');
  run('pass-unsigned-rehearsal', join(temp, 'rehearsal.json'));
  if (existsSync(join(temp, 'rehearsal.json'))) problems.push('a keyless rehearsal wrote a stamp');
  return problems;
}

/** The release-setup suite in a temporary copy, with its settings and planted files in place. */
function plantedReleaseSetup() {
  const target = join(tempDir('android-release-play-setup-'), 'release-setup');
  cpSync(join(FIXTURES, 'release-setup'), target, { recursive: true });
  for (const name of readdirSync(target)) {
    const dir = join(target, name);
    if (existsSync(join(dir, 'claude-settings.json'))) {
      mkdirSync(join(dir, '.claude'), { recursive: true });
      renameSync(join(dir, 'claude-settings.json'), join(dir, '.claude', 'settings.json'));
    }
    if (existsSync(join(dir, 'plant.json'))) {
      for (const [rel, text] of Object.entries(JSON.parse(readFileSync(join(dir, 'plant.json'), 'utf8')))) {
        mkdirSync(dirname(join(dir, rel)), { recursive: true });
        writeFileSync(join(dir, rel), text);
      }
    }
  }
  return target;
}

if (existsSync(join(HERE, 'check-store-aab.mjs'))) {
  const problems = stampProblems();
  for (const problem of problems) console.log(`FAIL check-store-aab.mjs [selftest-stamp] ${problem} Fix: Write the stamp only after RESULT: PASS without --unsigned, with the AAB's sha256 and versionCode.`);
  if (problems.length > 0) {
    console.log(`RESULT: FAIL (${problems.length} problems)`);
    process.exit(1);
  }
}

await runSelftest(import.meta.url, [
  { script: 'check-release-setup-android.mjs', fixtures: plantedReleaseSetup(), args: (dir) => [dir] },
  { script: 'check-store-aab.mjs', fixtures: '../tests/fixtures/store-aab', args: aabArgs },
]);
