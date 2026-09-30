#!/usr/bin/env node
// selftest.mjs: proves every script of this skill passes its good fixture and catches every planted
// bug. new-skill.mjs writes its good case into a fresh temporary folder, removed on exit.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/selftest.mjs
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { makeTempDir, removeTempDir, runSelftest } from './check-lib.mjs';

/** Extra arguments a fixture keeps in args.json (none when the file is absent). */
const extra = (dir) => (existsSync(join(dir, 'args.json')) ? JSON.parse(readFileSync(join(dir, 'args.json'), 'utf8')) : []);

const temps = [];
process.on('exit', () => temps.forEach((dir) => removeTempDir(dir)));
function newSkillArgs(dir) {
  const spec = JSON.parse(readFileSync(join(dir, 'args.json'), 'utf8'));
  let root = join(dir, 'skills');
  if (spec.tempRoot) {
    root = makeTempDir('new-skill-selftest-');
    temps.push(root);
  }
  return [spec.name, '--skills-root', root];
}

await runSelftest(import.meta.url, [
  { script: 'check-skill.mjs', fixtures: '../tests/fixtures/check-skill', args: (dir) => [join(dir, 'skills', 'sample-skill'), ...extra(dir)] },
  { script: 'check-skill-set.mjs', fixtures: '../tests/fixtures/check-skill-set', args: (dir) => [join(dir, 'skills'), ...extra(dir)] },
  { script: 'check-routing.mjs', fixtures: '../tests/fixtures/check-routing', args: (dir) => ['--skills-root', join(dir, 'skills'), '--evals', join(dir, 'evals.json'), ...extra(dir)] },
  { script: 'new-skill.mjs', fixtures: '../tests/fixtures/new-skill', args: newSkillArgs },
]);
