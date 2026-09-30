#!/usr/bin/env node
// check-skill.mjs: the completeness checks for one Pocket Arcade skill that the library validator
// does not make (the validator checks structure; this checks that the content is finished and
// usable). Run from the repo root after the validator passes:
//   node ${CLAUDE_SKILL_DIR}/scripts/check-skill.mjs skills/<name>
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

import { createReporter, fail, isBinary, parseArgs, requireDir, run, walk } from './check-lib.mjs';
import { NAME_PATTERN, listSkills, notForNames, proseOnly, readSkill } from './lib/skill-md.mjs';

const SPEC = {
  name: 'check-skill',
  summary: 'Checks that a skill is finished: description boundaries, a reason for every rule, every reference and script used in the workflow, filled placeholders, Files table "when" cells, real related skills, self-test coverage and rule ids in EXPECT files.',
  usage: '[options] <skill-folder>...',
  options: {
    'skills-root': { type: 'string', help: 'Folder holding all skill folders (default: the parent of each skill folder)' },
    sources: { type: 'string', help: 'sources.json to require recorded sources for references/ and examples/ (off unless given)' },
    json: { type: 'boolean', help: 'Also print the problems as JSON' },
  },
  positionals: { min: 0, max: Infinity },
  details: [
    'Rules:',
    '  desc-not-for          the description names its neighbours: "Not for <work> (<skill>)"',
    '  desc-neighbours       every skill named in the "Not for" parentheses exists in the skills root',
    '  rule-why              every rule is a bold statement followed by its reason (at least 4 more words)',
    '  workflow-mentions     every reference, example and script is named in the body, not only in the Files table',
    '  files-when            every Files table row says when to read or run the file',
    '  related-names         every Related skills item starts with an existing skill name in backticks',
    '  placeholder-left      no placeholder is left in prose (markdown) or as __FILL_...__ (scripts) outside templates/ and tests/',
    '  template-markers      templates hold no TODO/FIXME/XXX and no mixed-case double-underscore placeholders',
    '  selftest-covers       scripts/selftest.mjs runs every checker in scripts/',
    '  expect-rule-id        every bad-* EXPECT.txt names a rule id: a line that is the id, or [rule-id] in a line',
    '  sources-recorded      with --sources: every references/ and examples/ file has recorded sources',
    '',
    'Run the library validator first (node skills/_library/validate-skills.mjs <skill>); this checker assumes its structure.',
  ].join('\n'),
};

// Placeholder tokens that the standard itself uses as examples of the convention.
const EXAMPLE_TOKENS = new Set(['__UPPER_SNAKE__', '__PLACEHOLDER__']);
// A placeholder standing alone in prose (one inside a path such as templates/__GAME_ID__/x.ts is a real path).
const PLACEHOLDER = /(?<![\w/.-])__[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*?__(?![\w/.-])/g;
// Scaffold placeholders in scripts start with FILL_ (scripts that check templates may name others).
const FILL_PLACEHOLDER = /__FILL_[A-Z0-9]+(?:_[A-Z0-9]+)*?__/g;
const ANY_PLACEHOLDER = /__([A-Za-z][A-Za-z0-9]*(?:_[A-Za-z0-9]+)*?)__/g;
const MARKERS = /\b(TODO|FIXME|XXX)\b/;
const HELPERS = new Set(['check-lib.mjs', 'selftest.mjs']);

function lineAt(text, index) {
  return text.slice(0, index).split('\n').length;
}

function checkSkill(dir, skillsRoot, sources, report) {
  const skill = readSkill(dir);
  const name = basename(dir);
  if (!skill) fail(`nothing to check: ${dir} has no SKILL.md`, 'Pass a skill folder (skills/<name>).');
  const add = (file, line, rule, message, fix) => report.problem({ file: `${name}/${file}`, line, rule, message, fix });
  const known = new Set(listSkills(skillsRoot));
  const canCheckNames = known.size >= 2;
  const files = walk(dir, { defaultIgnores: false, ignore: ['node_modules', '.git', '.DS_Store'] });
  const description = skill.frontmatter.description ?? '';

  // ---- description ----
  if (!/\bNot for\b/.test(description)) add('SKILL.md', 3, 'desc-not-for', 'the description has no "Not for" boundary', 'End it with "Not for <neighbouring work> (<skill-name>)." so Claude can tell this skill from its neighbours.');
  if (canCheckNames) {
    for (const other of notForNames(description)) {
      if (!known.has(other)) add('SKILL.md', 3, 'desc-neighbours', `"Not for" names ${other}, which is not a skill in ${skillsRoot}`, 'Name an existing skill, or describe the work without a skill name.');
    }
  }

  // ---- rules ----
  for (const rule of skill.rules) {
    const plain = rule.text.replace(/(`+)([\s\S]*?)\1/g, 'code');
    const bold = /\*\*([^*]+)\*\*/.exec(plain);
    const after = bold ? plain.slice(bold.index + bold[0].length).trim() : '';
    if (!bold) add('SKILL.md', rule.line, 'rule-why', 'the rule has no **bold statement**', 'Write "N. **The rule.** Why it matters." so the rule survives skimming and compaction.');
    else if (after.split(/\s+/).filter(Boolean).length < 4) add('SKILL.md', rule.line, 'rule-why', `the rule "${bold[1].slice(0, 50)}" has no reason after it`, 'Add the why in one sentence: what breaks when the rule is ignored.');
  }

  // ---- workflow mentions ----
  // Everything the body tells Claude to do, outside the Files table itself.
  const usage = [...skill.sections.keys()].filter((title) => title !== 'Files in this skill').map((title) => skill.sectionText(title)).join('\n');
  const delegatesToTable = /Files table/.test(skill.sectionText('Workflow'));
  const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ancestors = (rel) => rel.split('/').slice(0, -1).map((_, i, parts) => parts.slice(0, i + 1).join('/')).filter((path) => path.includes('/'));
  const mentioned = (rel) => usage.includes(rel) || new RegExp(`(^|[^\\w./-])${escape(basename(rel))}(?![\\w-])`).test(usage) || ancestors(rel).some((folder) => new RegExp(`${escape(folder)}(/|(?![\\w-]))`).test(usage));
  const mentionsExamples = /(^|[^\w-])examples\//.test(usage);
  const mustMention = files.filter((rel) => (/^references\/[^/]+\.md$/.test(rel) || /^examples\//.test(rel) || (/^scripts\/[^/]+\.mjs$/.test(rel) && !HELPERS.has(basename(rel)))));
  for (const rel of mustMention) {
    if (rel.startsWith('examples/') && mentionsExamples) continue;
    if (rel.startsWith('references/') && delegatesToTable && skill.files.some((row) => row.path === rel && row.when.trim() !== '')) continue;
    if (!mentioned(rel)) add('SKILL.md', skill.sections.get('Workflow')?.line ?? 0, 'workflow-mentions', `${rel} is named only in the Files table`, `Say in a workflow step when to ${rel.startsWith('scripts/') ? 'run' : 'read'} ${rel}; a file Claude is never told to use is dead weight.`);
  }

  // ---- Files table ----
  for (const row of skill.files) {
    if (row.cellCount < 3 || row.when.replace(/[-*_`\s]/g, '') === '') add('SKILL.md', row.line, 'files-when', `the row for ${row.path || '(empty)'} does not say when to read or run it`, 'Fill the "Read/run when" cell ("Workflow step 3", "Never by hand", "When adding a rule").');
  }

  // ---- related skills ----
  for (const item of skill.related) {
    if (/^none\b/i.test(item.text.trim())) continue;
    const match = /^`([^`]+)`/.exec(item.text.trim());
    if (!match || !NAME_PATTERN.test(match[1])) add('SKILL.md', item.line, 'related-names', `"${item.text.slice(0, 40)}" does not start with a skill name in backticks`, 'Write "- `skill-name` - when to hand off" (names only, never paths).');
    else if (match[1] === name) add('SKILL.md', item.line, 'related-names', 'the skill lists itself as related', 'Remove the row.');
    else if (canCheckNames && !known.has(match[1])) add('SKILL.md', item.line, 'related-names', `${match[1]} is not a skill in ${skillsRoot}`, 'Fix the name, or remove the row until that skill exists.');
  }

  // ---- placeholders and markers ----
  for (const rel of files) {
    if (rel.startsWith('tests/') || basename(rel) === 'check-lib.mjs') continue;
    const buffer = readFileSync(join(dir, rel));
    if (isBinary(buffer)) continue;
    const text = buffer.toString('utf8');
    if (rel.startsWith('templates/')) {
      const marker = MARKERS.exec(text) ?? [...text.matchAll(ANY_PLACEHOLDER)].find((match) => /[A-Z]/.test(match[1]) && /[a-z]/.test(match[1]));
      if (marker) add(rel, lineAt(text, marker.index), 'template-markers', `template holds "${marker[0]}"`, 'Finish the template: placeholders are upper-snake between double underscores; no TODO, FIXME or XXX.');
      continue;
    }
    // Markdown: prose only (a placeholder named inside backticks is documentation). SKILL.md also
    // keeps its frontmatter. Scripts: only the scaffold's FILL_ placeholders.
    const scanned = rel === 'SKILL.md' ? `${text.split('\n').slice(0, 4).join('\n')}\n${proseOnly(text.split('\n').slice(4).join('\n'))}` : rel.endsWith('.md') ? proseOnly(text) : text;
    const pattern = rel.endsWith('.md') ? PLACEHOLDER : FILL_PLACEHOLDER;
    for (const match of scanned.matchAll(pattern)) {
      if (EXAMPLE_TOKENS.has(match[0])) continue;
      add(rel, lineAt(scanned, match.index), 'placeholder-left', `placeholder ${match[0]} was never filled in`, 'Replace it with the real content (scaffolded skills start full of placeholders).');
      break;
    }
  }

  // ---- self-test coverage ----
  const selftestPath = join(dir, 'scripts', 'selftest.mjs');
  if (existsSync(selftestPath)) {
    const selftest = readFileSync(selftestPath, 'utf8');
    for (const rel of files.filter((path) => /^scripts\/[^/]+\.mjs$/.test(path) && !HELPERS.has(basename(path)))) {
      if (!selftest.includes(basename(rel))) add('scripts/selftest.mjs', 0, 'selftest-covers', `${basename(rel)} is not run by the self-test`, 'Add a suite { script, fixtures, args } with a good and at least one bad-* fixture for it.');
    }
  }

  // ---- EXPECT files ----
  for (const rel of files.filter((path) => /^tests\/fixtures\/(?:[^/]+\/)?bad-[^/]+\/EXPECT\.txt$/.test(path))) {
    const lines = readFileSync(join(dir, rel), 'utf8').split('\n').map((line) => line.trim());
    const ruleLike = (line) => /^\[?[a-z0-9]+(?:-[a-z0-9]+)*\]?$/.test(line) || /\[[a-z0-9]+\]/.test(line) || /\[[^\]]*\b[a-z0-9]+(?:-[a-z0-9]+)+\b[^\]]*\]/.test(line);
    if (!lines.some(ruleLike)) add(rel, 1, 'expect-rule-id', 'names no rule id, so the fixture passes on any failure', 'Add the rule id the planted bug must trigger, as "[rule-id]" or on its own line.');
  }

  // ---- recorded sources ----
  if (sources) {
    const recorded = sources.skills?.[name] ?? {};
    for (const rel of files.filter((path) => /^references\/[^/]+\.md$/.test(path) || /^examples\//.test(path))) {
      if (!recorded[rel]) add(rel, 0, 'sources-recorded', 'has no recorded sources', `Run node skills/_library/record-sources.mjs ${name} ${rel} <project files it was copied from>.`);
    }
  }
  return files.length;
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  if (positionals.length === 0) fail('nothing to check: pass at least one skill folder', 'Example: node check-skill.mjs skills/<name>');
  const dirs = positionals.map((path) => requireDir(path, 'skill folder'));
  let sources = null;
  if (options.sources) {
    try {
      sources = JSON.parse(readFileSync(resolve(options.sources), 'utf8'));
    } catch (error) {
      fail(`cannot read ${options.sources}: ${error.message}`, 'Pass the library sources.json.');
    }
  }
  const report = createReporter({ name: 'check-skill', json: options.json });
  let checked = 0;
  for (const dir of dirs) {
    const skillsRoot = resolve(options['skills-root'] ?? dirname(dir));
    if (!readdirSync(dir).includes('SKILL.md')) fail(`nothing to check: ${dir} has no SKILL.md`, 'Pass a skill folder (skills/<name>).');
    checked += checkSkill(dir, skillsRoot, sources, report);
  }
  return report.finish({ checked, unit: 'files' });
});
