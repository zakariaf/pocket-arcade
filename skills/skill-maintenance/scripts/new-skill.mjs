#!/usr/bin/env node
// new-skill.mjs: creates skills/<name>/ from this skill's scaffold (templates/new-skill/): the six
// sections in order, a reference, a working pattern checker with its self-test and fixtures, and
// assets/shared.json. Every spot the author must write holds a __FILL_...__ placeholder, which
// check-skill.mjs reports until it is replaced. It refuses bad or reserved names and existing folders.
//   node ${CLAUDE_SKILL_DIR}/scripts/new-skill.mjs <name> --skills-root skills
import { cpSync, existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createReporter, fail, parseArgs, requireDir, run, toPosix, walk } from './check-lib.mjs';

const SCAFFOLD = join(dirname(fileURLToPath(import.meta.url)), '..', 'templates', 'new-skill');
const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// Bundled Claude Code commands and skills a project skill must never shadow, and names Claude Code skips.
const RESERVED = new Set([
  'verify', 'run', 'debug', 'loop', 'init', 'review', 'code-review', 'simplify', 'security-review', 'help', 'clear', 'compact',
  'config', 'context', 'cost', 'doctor', 'exit', 'memory', 'model', 'permissions', 'resume', 'skills', 'status', 'reload-skills',
  'skill-doctor', 'add-dir', 'agents', 'hooks', 'login', 'logout', 'mcp', 'plugin', 'export', 'rewind', 'batch', 'schedule',
  'update-config', 'keybindings-help', 'fewer-permission-prompts', 'workflow-authoring', 'design', 'design-sync', 'dataviz',
  'deep-research', 'synced', 'anthropic-skills',
]);
// Built from parts so this script holds no placeholder token itself.
const TOKEN = (word) => `__${word}__`;

const SPEC = {
  name: 'new-skill',
  summary: 'Creates <skills-root>/<name>/ from the scaffold, with the name and title filled in and __FILL_...__ placeholders everywhere the author must write. Refuses bad, reserved or taken names.',
  usage: '<name> --skills-root <dir> [options]',
  options: {
    'skills-root': { type: 'string', help: 'Folder that holds the skill folders (required; usually skills)' },
    title: { type: 'string', help: 'The H1 title (default: the name in words, first letter capital)' },
    'dry-run': { type: 'boolean', help: 'Check the name and list the files without writing anything' },
    json: { type: 'boolean', help: 'Also print the problems as JSON' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules:',
    '  name-format    1-64 characters of a-z, 0-9 and single hyphens, no leading or trailing hyphen',
    '  name-reserved  not a bundled Claude Code command or skill, no "claude" or "anthropic"',
    '  name-exists    the folder must not exist yet',
    '',
    'Next steps it prints: sync-shared, fill the placeholders, validator, self-test, check-skill, link-skills.',
  ].join('\n'),
};

function titleOf(name) {
  const words = name.split('-').join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  if (positionals.length === 0) fail('nothing to create: pass the new skill name', 'Example: node new-skill.mjs leaderboard-feature --skills-root skills');
  if (!options['skills-root']) fail('pass --skills-root <folder that holds the skills>', 'Usually --skills-root skills from the repo root.');
  const root = requireDir(options['skills-root'], 'skills root');
  if (!existsSync(join(SCAFFOLD, 'SKILL.md.tmpl'))) fail(`the scaffold is missing in ${SCAFFOLD}`, 'Restore templates/new-skill/ in the skill-maintenance skill.');
  const name = positionals[0];
  const report = createReporter({ name: 'new-skill', json: options.json });
  if (name.length > 64 || !NAME_PATTERN.test(name)) report.problem({ file: name, rule: 'name-format', message: `"${name}" is not 1-64 characters of a-z, 0-9 and single hyphens`, fix: 'Use a kebab-case noun phrase, for example leaderboard-feature.' });
  if (RESERVED.has(name) || /claude|anthropic/.test(name)) report.problem({ file: name, rule: 'name-reserved', message: `"${name}" shadows a bundled command or skill, or contains claude/anthropic`, fix: 'Pick a project-specific name.' });
  const target = join(root, name);
  if (existsSync(target)) report.problem({ file: toPosix(relative(process.cwd(), target)) || name, rule: 'name-exists', message: 'that skill folder already exists', fix: 'Edit the existing skill, or choose another name.' });
  const files = walk(SCAFFOLD).map((rel) => ({ from: rel, to: rel.replace(/\.tmpl$/, '') }));
  if (report.count > 0 || options['dry-run']) {
    if (report.count === 0) for (const file of files) report.note(`would write ${name}/${file.to}`);
    return report.finish({ checked: files.length, unit: 'scaffold files' });
  }

  cpSync(SCAFFOLD, target, { recursive: true });
  const title = options.title ?? titleOf(name);
  for (const file of files) {
    const from = join(target, file.from);
    const to = join(target, file.to);
    if (from !== to) renameSync(from, to);
    if (statSync(to).isFile()) {
      const text = readFileSync(to, 'utf8');
      writeFileSync(to, text.split(TOKEN('SKILL_NAME')).join(name).split(TOKEN('SKILL_TITLE')).join(title));
    }
  }
  // Prove the result: every scaffold file is there and no name or title token is left.
  for (const file of files) {
    const path = join(target, file.to);
    if (!existsSync(path)) report.problem({ file: `${name}/${file.to}`, rule: 'name-exists', message: 'was not written', fix: 'Check the permissions of the skills folder and rerun.' });
    else if ([TOKEN('SKILL_NAME'), TOKEN('SKILL_TITLE')].some((token) => readFileSync(path, 'utf8').includes(token))) report.problem({ file: `${name}/${file.to}`, rule: 'name-format', message: 'still holds a name or title token', fix: 'This is a bug in new-skill.mjs.' });
  }
  const leftovers = readdirSync(target, { recursive: true }).filter((rel) => String(rel).endsWith('.tmpl'));
  for (const rel of leftovers) report.problem({ file: `${name}/${rel}`, rule: 'name-format', message: 'a .tmpl file was not renamed', fix: 'This is a bug in new-skill.mjs.' });
  if (report.count === 0) {
    report.note(`created ${toPosix(relative(process.cwd(), target)) || target} (${files.length} files)`);
    report.note('next: node skills/_library/sync-shared.mjs <name>, fill every __FILL_...__, then validator, self-test and check-skill.mjs');
  }
  return report.finish({ checked: files.length, unit: 'scaffold files' });
});
