#!/usr/bin/env node
// check-index.mjs: proves the router is exact. The index lists every skill that exists and no skill
// that does not (categories, task matrix, build orders, Related skills), every skill is reachable
// from a task or a build step, there are enough task rows, and every generated part equals a fresh
// render from the skills' current frontmatter (so no description in the index is stale).

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { createReporter, fail, lineOf, parseArgs, requireDir, requireFile, run } from './check-lib.mjs';
import { DEFAULT_SKILLS_ROOT, SKILL_DIR, buildSteps, isSkillName, namedSkills, readIndexData, readSkills, renderAll } from './lib/index-model.mjs';

const SPEC = {
  name: 'check-index',
  summary:
    'Checks that the router lists exactly the skills present (no missing, stale or duplicate entries), reaches every ' +
    'skill from a task row or a build step, has enough task rows, and that its generated parts are current.',
  usage: '[--skills-root <dir>] [--index <dir>] [--min-tasks <n>] [--readme <file>]',
  options: {
    'skills-root': { type: 'string', value: 'dir', help: 'The folder that holds the skills (default: the folder that holds this skill)' },
    index: { type: 'string', value: 'dir', help: 'The index skill to check (default: this skill)' },
    'min-tasks': { type: 'string', default: '25', value: 'n', help: 'Fewest task rows the matrix may have' },
    readme: { type: 'string', value: 'file', help: 'Also check a library README: its catalogue names every skill and no other' },
    json: { type: 'boolean', help: 'Also print the problems as JSON' },
  },
  positionals: { min: 0, max: 0 },
  details: [
    'Rules:',
    '  index-data         assets/index.json is missing or has the wrong shape',
    '  skill-name         a skill folder whose frontmatter name is missing or differs from the folder',
    '  skill-missing      a skill in the skills root is in no category of the index',
    '  skill-stale        the index names a skill that does not exist (categories, tasks, build steps)',
    '  skill-duplicate    a skill sits in two categories, or twice in one task row or build step',
    '  skill-uncovered    a skill is in no task row and no build step, so nothing routes to it',
    '  task-count         fewer task rows than --min-tasks',
    '  task-shape         a task row or build step with no skill',
    '  generated-missing  a generated file, or the quick-table markers in SKILL.md, is missing',
    '  generated-stale    a generated part differs from a fresh render (run build-index.mjs --write)',
    '  related-unknown    the Related skills section of SKILL.md names a skill that does not exist',
    '  command-unknown    a step or "done when" command names a <name>.mjs script that the skill in brackets',
    '                     after it (or, without brackets, any skill of that step) does not have (the Shell and',
    '                     game orders and every extra order)',
    '  readme-missing     (--readme) a skill the README catalogue does not name',
    '  readme-stale       (--readme) the README catalogue names a skill that does not exist',
    '',
    'The README catalogue is the part of the file from a heading that contains "catalogue" to the next',
    'heading of the same level; each skill is a list item that starts with its name in backticks.',
    '',
    'Examples:',
    '  node check-index.mjs                                   (the library this skill sits in)',
    '  node check-index.mjs --skills-root <skills folder> --index <index skill folder>',
  ].join('\n'),
};

function checkNames(skills, report) {
  for (const skill of skills) {
    if (skill.name !== skill.folder || !isSkillName(skill.name)) {
      report.problem({ file: `${skill.folder}/SKILL.md`, line: 2, rule: 'skill-name', message: `frontmatter name "${skill.name}" does not match the folder`, fix: 'Make name: equal the folder name (kebab-case).' });
    }
  }
}

function checkCoverage(data, skills, minTasks, report) {
  const known = new Set(skills.map((skill) => skill.folder));
  const file = 'assets/index.json';
  for (const entry of namedSkills(data)) {
    if (!known.has(entry.name)) report.problem({ file, rule: 'skill-stale', message: `${entry.where} names ${entry.name}, which does not exist`, fix: 'Use the skill\'s exact folder name, or remove the stale entry; then run build-index.mjs --write.' });
  }
  const categoryOf = new Map();
  for (const category of data.categories) {
    for (const name of category.skills) {
      if (categoryOf.has(name)) report.problem({ file, rule: 'skill-duplicate', message: `${name} is in "${categoryOf.get(name)}" and "${category.name}"`, fix: 'Keep each skill in exactly one category.' });
      else categoryOf.set(name, category.name);
    }
  }
  const rows = [...data.tasks.map((task, index) => ({ label: `tasks[${index}] "${task.task}"`, skills: task.skills })), ...buildSteps(data).map(({ label, step }) => ({ label, skills: step.skills }))];
  for (const row of rows) {
    if (row.skills.length === 0) report.problem({ file, rule: 'task-shape', message: `${row.label} names no skill`, fix: 'Every row routes to at least one skill (the lead first).' });
    const twice = row.skills.filter((name, index) => row.skills.indexOf(name) !== index);
    for (const name of new Set(twice)) report.problem({ file, rule: 'skill-duplicate', message: `${row.label} lists ${name} twice`, fix: 'List each skill once per row.' });
  }
  const routed = new Set(rows.flatMap((row) => row.skills));
  for (const name of known) {
    if (!categoryOf.has(name)) report.problem({ file, rule: 'skill-missing', message: `${name} exists but is in no category of the index`, fix: `Add ${name} to a category, a task row and (if it builds a layer) a build step, then run build-index.mjs --write.` });
    if (!routed.has(name)) report.problem({ file, rule: 'skill-uncovered', message: `no task row or build step routes to ${name}`, fix: `Add ${name} to the task rows that need it (or a build step), then run build-index.mjs --write.` });
  }
  if (data.tasks.length < minTasks) report.problem({ file, rule: 'task-count', message: `${data.tasks.length} task rows, fewer than ${minTasks}`, fix: 'Add rows for the typical tasks (screens, games, data, release, failures) until the matrix covers them.' });
}

function checkGenerated(indexDir, data, skills, report) {
  for (const [rel, content] of Object.entries(renderAll(indexDir, data, skills))) {
    const path = join(indexDir, rel);
    if (content === null) {
      report.problem({ file: rel, rule: 'generated-missing', message: 'SKILL.md has no generated-block markers for the quick task table', fix: 'Restore the generated:task-table marker comments, then run build-index.mjs --write.' });
    } else if (!existsSync(path)) {
      report.problem({ file: rel, rule: 'generated-missing', message: 'is missing', fix: 'Run build-index.mjs --write.' });
    } else if (readFileSync(path, 'utf8') !== content) {
      report.problem({ file: rel, rule: 'generated-stale', message: 'differs from a fresh render: a skill was added, removed or re-described, or the data changed', fix: 'Run build-index.mjs --write (never edit a generated part by hand), then rerun this check.' });
    }
  }
}

/**
 * Every `<name>.mjs ...` command in a build step's "done when" text must be a script of the skill
 * named in brackets right after it, e.g. `check-levels.mjs . --game <id>` (level-generation-and-solvers),
 * or, without brackets, of one of the step's skills. A renamed or removed script then fails here
 * instead of in a later session that follows the build order.
 */
const COMMAND = /`([a-z0-9]+(?:-[a-z0-9]+)*\.mjs)(?: [^`]*)?`(?:\s*\(([a-z0-9]+(?:-[a-z0-9]+)*))?/g;

function checkCommands(root, data, skills, report) {
  const known = new Set(skills.map((skill) => skill.folder));
  const hasScript = (skill, script) => known.has(skill) && existsSync(join(root, skill, 'scripts', script));
  for (const { label, step } of buildSteps(data)) {
    for (const match of `${step.step ?? ''} ${step.proof ?? ''}`.matchAll(COMMAND)) {
      const [, script, named] = match;
      const owners = named !== undefined && known.has(named) ? [named] : step.skills;
      if (owners.some((skill) => hasScript(skill, script))) continue;
      report.problem({ file: 'assets/index.json', rule: 'command-unknown', message: `${label} runs ${script}, which ${owners.join(', ')} does not have in scripts/`, fix: `Name the script's real file and its skill in brackets after the command (\`${script} .\` (<skill>)), then run build-index.mjs --write.` });
    }
  }
}

function checkRelated(indexDir, skills, report) {
  const path = join(indexDir, 'SKILL.md');
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  const start = text.indexOf('\n## Related skills');
  if (start === -1) return;
  const known = new Set(skills.map((skill) => skill.folder));
  const section = text.slice(start);
  for (const match of section.matchAll(/^- `([a-z0-9-]+)`/gm)) {
    if (!known.has(match[1])) report.problem({ file: 'SKILL.md', line: lineOf(text, start + match.index + 1), rule: 'related-unknown', message: `Related skills names ${match[1]}, which does not exist`, fix: 'Name an existing skill, or remove the line.' });
  }
}

/** The catalogue section of a library README: from the heading naming it to the next heading of that level. */
function readmeCatalogue(text) {
  const heading = /^(#{2,3}) [^\n]*[Cc]atalogue[^\n]*$/m.exec(text);
  if (!heading) return null;
  const rest = text.slice(heading.index + heading[0].length);
  const next = new RegExp(`^#{2,${heading[1].length}} `, 'm').exec(rest);
  return { start: heading.index, text: next ? rest.slice(0, next.index) : rest };
}

function checkReadme(readmePath, skills, report) {
  const shown = 'README.md';
  const text = readFileSync(readmePath, 'utf8');
  const catalogue = readmeCatalogue(text);
  if (catalogue === null) {
    report.problem({ file: shown, rule: 'readme-missing', message: 'the README has no catalogue section (a heading with "catalogue")', fix: 'Add "## The catalogue" listing every skill by group.' });
    return;
  }
  const known = new Set(skills.map((skill) => skill.folder));
  const named = new Set();
  for (const match of catalogue.text.matchAll(/^[-*] `([a-z0-9]+(?:-[a-z0-9]+)*)`/gm)) {
    named.add(match[1]);
    if (!known.has(match[1])) report.problem({ file: shown, line: lineOf(text, catalogue.start + text.slice(catalogue.start).indexOf(match[0])), rule: 'readme-stale', message: `the catalogue names ${match[1]}, which is not a skill`, fix: 'Remove it or use the exact name of an existing skill.' });
  }
  for (const name of known) {
    if (!named.has(name)) report.problem({ file: shown, rule: 'readme-missing', message: `the catalogue does not name ${name}`, fix: `Add \`${name}\` with one line on what it does, in its group.` });
  }
}

run(async () => {
  const { options } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(resolve(options['skills-root'] ?? DEFAULT_SKILLS_ROOT), 'skills root');
  const indexDir = requireDir(resolve(options.index ?? SKILL_DIR), 'index skill');
  const minTasks = Number(options['min-tasks']);
  if (!Number.isInteger(minTasks) || minTasks < 1) fail(`--min-tasks ${options['min-tasks']} is not a positive whole number`, 'Pass a number such as 25.');
  const skills = readSkills(root);
  if (skills.length === 0) fail(`no skill folders with a SKILL.md in ${root}`, 'Pass --skills-root <the folder that holds the skills>.');
  const report = createReporter({ name: SPEC.name, json: options.json });
  checkNames(skills, report);
  const loaded = readIndexData(indexDir);
  if (loaded.error) {
    report.problem({ file: 'assets/index.json', rule: 'index-data', message: loaded.error, fix: 'Restore the shape: categories, tasks, buildOrders.shell and buildOrders.game, and the optional buildOrders.commands and slice (text), sliceCore ({ intro, rows: [{ files, part, skill }] }), extraOrders ([{ title, intro, steps }]) and verifyGreen ({ intro, rows: [{ gate, greenFrom, before }] }).' });
  } else {
    checkCoverage(loaded.data, skills, minTasks, report);
    checkGenerated(indexDir, loaded.data, skills, report);
    checkCommands(root, loaded.data, skills, report);
    report.note(`index: ${skills.length} skills, ${loaded.data.categories.length} categories, ${loaded.data.tasks.length} task rows, ${buildSteps(loaded.data).length} build steps`);
  }
  checkRelated(indexDir, skills, report);
  if (options.readme !== undefined) checkReadme(requireFile(resolve(options.readme), 'README'), skills, report);
  return report.finish({ checked: skills.length, unit: 'skills' });
});
