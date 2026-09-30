#!/usr/bin/env node
// check-skill-set.mjs: checks the whole skill set for what no single-skill check can see:
// descriptions that overlap or start the same, "Not for" hand-offs to skills that do not exist,
// the listing budget, and an index skill that forgets a skill. Run after adding a skill or changing
// a description:  node ${CLAUDE_SKILL_DIR}/scripts/check-skill-set.mjs skills
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { createReporter, fail, parseArgs, requireDir, run } from './check-lib.mjs';
import { listSkills, notForNames, readSkill } from './lib/skill-md.mjs';

const SPEC = {
  name: 'check-skill-set',
  summary: 'Checks the skill set as a whole: duplicate or overlapping descriptions, identical leads, "Not for" names that do not exist, the listing budget, and the index skill naming every skill.',
  usage: '[options] <skills-root>',
  options: {
    'max-overlap': { type: 'string', default: '0.3', help: 'Highest allowed word overlap (Jaccard) between two descriptions (default 0.3)' },
    budget: { type: 'string', default: '20000', help: 'Most characters the set may add to the skill listing (default 20000)' },
    index: { type: 'string', help: 'The index skill that must name every skill (default: pocket-arcade-index when it exists)' },
    json: { type: 'boolean', help: 'Also print the problems as JSON' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules:',
    '  desc-duplicate    two skills have the same description',
    '  desc-lead         two descriptions start with the same five content words (Claude reads the lead first)',
    '  desc-overlap      two descriptions share more than --max-overlap of their words (before "Not for")',
    '  not-for-unknown   a "Not for (...)" hand-off names a skill that does not exist',
    '  not-for-self      a description hands off to itself',
    '  listing-budget    names plus descriptions exceed --budget characters, so Claude Code drops descriptions',
    '  index-coverage    the index skill (SKILL.md and references/) does not name every skill',
    '',
    'The budget default keeps the project set under two thirds of the 30,000-character listing measured at',
    'the default skillListingBudgetFraction (0.01), so it fits even before the 0.04 setting is installed.',
  ].join('\n'),
};

const STOP = new Set(
  ('a an and are as at be by for from in into is it its of on or the to with when use used using not this that each every all any via per ' +
    'without only than then so no one two new pocket arcade game games app apps skill skills shell do does make run write set add check build ' +
    'builds checks adds makes runs writes sets creates keeps').split(' '),
);

function contentWords(description) {
  const what = description.split(/\bNot for\b/)[0];
  return what.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !STOP.has(word));
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  if (positionals.length === 0) fail('nothing to check: pass the skills folder', 'Example: node check-skill-set.mjs skills');
  const root = requireDir(positionals[0], 'skills folder');
  const names = listSkills(root);
  if (names.length === 0) fail(`nothing to check: no skill folders with a SKILL.md in ${root}`, 'Pass the folder that holds the skills.');
  const known = new Set(names);
  const report = createReporter({ name: 'check-skill-set', json: options.json });
  const maxOverlap = Number(options['max-overlap']);
  const budget = Number(options.budget);
  const skills = names.map((name) => ({ name, description: readSkill(join(root, name))?.frontmatter.description ?? '' }));

  let listing = 0;
  for (const skill of skills) {
    listing += skill.name.length + skill.description.length + 4;
    for (const other of notForNames(skill.description)) {
      if (other === skill.name) report.problem({ file: `${skill.name}/SKILL.md`, line: 3, rule: 'not-for-self', message: 'the "Not for" clause names the skill itself', fix: 'Name the neighbouring skill that owns that work.' });
      else if (!known.has(other)) report.problem({ file: `${skill.name}/SKILL.md`, line: 3, rule: 'not-for-unknown', message: `"Not for" hands off to ${other}, which does not exist`, fix: 'Use the neighbour\'s exact folder name, or create that skill.' });
    }
  }
  for (let i = 0; i < skills.length; i += 1) {
    for (let j = i + 1; j < skills.length; j += 1) {
      const a = skills[i];
      const b = skills[j];
      if (a.description && a.description === b.description) {
        report.problem({ file: `${b.name}/SKILL.md`, line: 3, rule: 'desc-duplicate', message: `has the same description as ${a.name}`, fix: 'Write what this skill alone does, with its own trigger words.' });
        continue;
      }
      const wordsA = contentWords(a.description);
      const wordsB = contentWords(b.description);
      if (wordsA.length >= 5 && wordsA.slice(0, 5).join(' ') === wordsB.slice(0, 5).join(' ')) {
        report.problem({ file: `${b.name}/SKILL.md`, line: 3, rule: 'desc-lead', message: `starts like ${a.name} ("${wordsA.slice(0, 5).join(' ')}")`, fix: 'Lead with the verb and object only this skill has.' });
      }
      const setA = new Set(wordsA);
      const setB = new Set(wordsB);
      const shared = [...setA].filter((word) => setB.has(word));
      const overlap = shared.length / (setA.size + setB.size - shared.length || 1);
      if (overlap > maxOverlap) {
        report.problem({ file: `${b.name}/SKILL.md`, line: 3, rule: 'desc-overlap', message: `shares ${Math.round(overlap * 100)}% of its words with ${a.name} (${shared.join(', ')})`, fix: 'Split the work cleanly: rewrite both descriptions around what differs and add each as the other\'s "Not for".' });
      }
    }
  }
  if (listing > budget) report.problem({ file: '', line: 0, rule: 'listing-budget', message: `names and descriptions total ${listing} characters, over the ${budget} budget`, fix: 'Shorten the longest descriptions (trigger words first), or raise skillListingBudgetFraction in .claude/settings.json with the owner.' });

  const indexName = options.index ?? (known.has('pocket-arcade-index') ? 'pocket-arcade-index' : null);
  if (indexName) {
    const indexDir = join(root, indexName);
    if (!existsSync(join(indexDir, 'SKILL.md'))) fail(`the index skill ${indexName} does not exist in ${root}`, 'Pass --index <existing skill>, or drop the option.');
    const refDir = join(indexDir, 'references');
    const text = [readFileSync(join(indexDir, 'SKILL.md'), 'utf8'), ...(existsSync(refDir) ? readdirSync(refDir).filter((file) => file.endsWith('.md')).map((file) => readFileSync(join(refDir, file), 'utf8')) : [])].join('\n');
    for (const name of names) {
      if (name !== indexName && !new RegExp(`(^|[^a-z0-9-])${name}([^a-z0-9-]|$)`).test(text)) report.problem({ file: `${indexName}/SKILL.md`, line: 0, rule: 'index-coverage', message: `the index never names ${name}`, fix: `Add ${name} to the index's routing table with when to load it.` });
    }
  }
  report.note(`listing: ${skills.length} skills, ${listing} of ${budget} characters`);
  return report.finish({ checked: skills.length, unit: 'skills' });
});
