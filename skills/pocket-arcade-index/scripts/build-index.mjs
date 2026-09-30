#!/usr/bin/env node
// build-index.mjs: renders the router's generated parts from every skill's frontmatter and the
// curated assets/index.json: references/skill-table.md, references/task-matrix.md,
// references/build-orders.md and the quick task table in SKILL.md. Without --write it only
// reports what would change (exit 1 when anything is stale), so it is safe to run any time.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { createReporter, fail, parseArgs, requireDir, run } from './check-lib.mjs';
import { DEFAULT_SKILLS_ROOT, SKILL_DIR, namedSkills, readIndexData, readSkills, renderAll } from './lib/index-model.mjs';

const SPEC = {
  name: 'build-index',
  summary:
    'Renders the skill catalogue, the task matrix, the build orders and the quick table in SKILL.md from every ' +
    'skill\'s frontmatter and assets/index.json. Without --write it writes nothing and fails when a file is stale.',
  usage: '[--skills-root <dir>] [--index <dir>] [--write]',
  options: {
    'skills-root': { type: 'string', value: 'dir', help: 'The folder that holds the skills (default: the folder that holds this skill)' },
    index: { type: 'string', value: 'dir', help: 'The index skill to render into (default: this skill)' },
    write: { type: 'boolean', help: 'Write the generated files (only when the data names real skills)' },
    json: { type: 'boolean', help: 'Also print the problems as JSON' },
  },
  positionals: { min: 0, max: 0 },
  details: [
    'Rules:',
    '  index-data       assets/index.json is missing or has the wrong shape',
    '  skill-stale      the data names a skill that does not exist (nothing is written)',
    '  generated-stale  a generated file differs from a fresh render (run with --write)',
    '  generated-missing SKILL.md lacks the generated-block markers',
    '',
    'Run it after adding, removing or renaming a skill, after changing any skill\'s description, and after',
    'editing assets/index.json; then run check-index.mjs.',
    '',
    'Examples:',
    '  node build-index.mjs                 (report what is stale; writes nothing)',
    '  node build-index.mjs --write         (render every generated part)',
    '  node build-index.mjs --skills-root <skills folder> --index <index skill folder> --write',
  ].join('\n'),
};

run(async () => {
  const { options } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(resolve(options['skills-root'] ?? DEFAULT_SKILLS_ROOT), 'skills root');
  const indexDir = requireDir(resolve(options.index ?? SKILL_DIR), 'index skill');
  const report = createReporter({ name: SPEC.name, json: options.json });
  const skills = readSkills(root);
  if (skills.length === 0) fail(`no skill folders with a SKILL.md in ${root}`, 'Pass --skills-root <the folder that holds the skills>.');
  const loaded = readIndexData(indexDir);
  if (loaded.error) {
    report.problem({ file: 'assets/index.json', rule: 'index-data', message: loaded.error, fix: 'Restore the shape: categories, tasks, buildOrders.shell and buildOrders.game, and the optional buildOrders.commands and slice (text), sliceCore ({ intro, rows: [{ files, part, skill }] }), extraOrders ([{ title, intro, steps }]) and verifyGreen ({ intro, rows: [{ gate, greenFrom, before }] }).' });
    return report.finish({ checked: 0, unit: 'generated files' });
  }
  const known = new Set(skills.map((skill) => skill.folder));
  const stale = namedSkills(loaded.data).filter((entry) => !known.has(entry.name));
  for (const entry of stale) report.problem({ file: 'assets/index.json', rule: 'skill-stale', message: `${entry.where} names ${entry.name}, which is not a skill in ${root}`, fix: 'Use the skill\'s exact name, or remove the entry; nothing was written.' });
  const outputs = renderAll(indexDir, loaded.data, skills);
  let checked = 0;
  for (const [rel, content] of Object.entries(outputs)) {
    checked += 1;
    if (content === null) {
      report.problem({ file: rel, rule: 'generated-missing', message: 'SKILL.md has no generated-block markers for the quick task table', fix: 'Restore the two generated:task-table marker comments in SKILL.md, then rerun with --write.' });
      continue;
    }
    const path = join(indexDir, rel);
    const current = existsSync(path) ? readFileSync(path, 'utf8') : null;
    if (current === content) continue;
    if (options.write && stale.length === 0) {
      writeFileSync(path, content);
      report.note(`wrote ${rel}`);
    } else {
      report.problem({ file: rel, rule: 'generated-stale', message: current === null ? 'does not exist yet' : 'differs from a fresh render (a description, a skill or the data changed)', fix: 'Run node build-index.mjs --write, then check-index.mjs.' });
    }
  }
  report.note(`${skills.length} skills, ${loaded.data.tasks.length} tasks, ${loaded.data.buildOrders.shell.length} Shell steps, ${loaded.data.buildOrders.game.length} game steps, ${(loaded.data.buildOrders.extraOrders ?? []).length} extra orders`);
  return report.finish({ checked, unit: 'generated files' });
});
