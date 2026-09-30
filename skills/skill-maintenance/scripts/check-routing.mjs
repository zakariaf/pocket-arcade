#!/usr/bin/env node
// check-routing.mjs: routing evals for the skill set. Each eval is a realistic task prompt and the
// skill that should handle it. The default (offline) mode ranks skills with a lexical stand-in for
// Claude's choice and fails when the expected skill is not in the top N: fast, free, run after every
// description change. --live asks Claude Code itself (one short model call per prompt and run).
//   node ${CLAUDE_SKILL_DIR}/scripts/check-routing.mjs --skills-root skills
//   node ${CLAUDE_SKILL_DIR}/scripts/check-routing.mjs --skills-root skills --live --only <skill>
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createReporter, fail, parseArgs, requireDir, run } from './check-lib.mjs';
import { routeLive } from './lib/live-route.mjs';
import { buildRouter } from './lib/router.mjs';
import { listSkills, readSkill } from './lib/skill-md.mjs';

const DEFAULT_EVALS = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'routing-evals.json');

const SPEC = {
  name: 'check-routing',
  summary: 'Runs routing evals: for each prompt, is the expected skill chosen? Offline it ranks skills by description words (expected skill must be in the top --top); --live runs claude -p and reads the first Skill call.',
  usage: '--skills-root <dir> [options]',
  options: {
    'skills-root': { type: 'string', help: 'Folder holding the skill folders (required; usually skills)' },
    evals: { type: 'string', help: "Evals JSON: [{ \"prompt\": ..., \"expect\": \"skill\" | null }] (default: this skill's assets/routing-evals.json)" },
    top: { type: 'string', default: '3', help: 'Offline: the expected skill must rank within this many (default 3)' },
    only: { type: 'string', multiple: true, help: 'Only evals that expect this skill (repeatable)' },
    prompt: { type: 'string', help: 'One ad-hoc prompt instead of the evals file (use with --expect)' },
    expect: { type: 'string', help: 'The skill the --prompt should route to' },
    'skip-missing': { type: 'boolean', help: 'Skip evals whose expected skill does not exist yet (a note instead of a problem)' },
    live: { type: 'boolean', help: 'Ask Claude Code (claude -p) instead of the offline ranker; costs model calls' },
    runs: { type: 'string', default: '1', help: 'Live: runs per prompt; an eval passes when at least half choose the expected skill' },
    repo: { type: 'string', default: '.', help: 'Live: the repo folder claude runs in (its .claude/skills are what is tested)' },
    json: { type: 'boolean', help: 'Also print the problems as JSON' },
  },
  positionals: { min: 0, max: 0 },
  details: [
    'Rules:',
    '  route-miss            the expected skill was not chosen (offline: not in the top N; live: under half the runs)',
    '  route-false-positive  an eval with "expect": null loaded a skill (live only)',
    '  eval-unknown-skill    an eval expects a skill that is not in the skills root',
    '  eval-shape            an eval is not { prompt: string, expect: skill-name | null }',
    '',
    'Write prompts the way the owner writes tasks, without the skill name (a named skill is always found).',
    'Near misses (a prompt that shares words with the skill but belongs to a neighbour) are the valuable ones.',
  ].join('\n'),
};

function loadEvals(options) {
  if (options.prompt) return [{ prompt: options.prompt, expect: options.expect ?? null }];
  const path = resolve(options.evals ?? DEFAULT_EVALS);
  if (!existsSync(path)) fail(`nothing to check: evals file ${path} does not exist`, 'Pass --evals <file.json> or --prompt "<task>" --expect <skill>.');
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    if (!Array.isArray(data)) throw new Error('the top level is not an array');
    return data;
  } catch (error) {
    fail(`cannot read ${path}: ${error.message}`, 'The file is a JSON array of { "prompt": "...", "expect": "skill-name" }.');
  }
  return [];
}

run(async () => {
  const { options } = parseArgs(process.argv.slice(2), SPEC);
  if (!options['skills-root']) fail('nothing to check: pass --skills-root <folder with the skills>', 'Example: --skills-root skills');
  const root = requireDir(options['skills-root'], 'skills root');
  const names = listSkills(root);
  if (names.length === 0) fail(`nothing to check: no skill folders with a SKILL.md in ${root}`, 'Point --skills-root at the skills folder.');
  const known = new Set(names);
  const report = createReporter({ name: 'check-routing', json: options.json });
  const top = Math.max(1, Number(options.top) || 3);
  const runs = Math.max(1, Number(options.runs) || 1);
  let evals = loadEvals(options).map((item, index) => ({ ...item, index }));
  if (options.only.length > 0) evals = evals.filter((item) => options.only.includes(item.expect));
  const router = buildRouter(names.map((name) => ({ name, description: readSkill(join(root, name))?.frontmatter.description ?? '' })));
  let checked = 0;
  for (const item of evals) {
    const where = options.prompt ? '--prompt' : `evals[${item.index}]`;
    if (typeof item.prompt !== 'string' || item.prompt.trim() === '' || !(item.expect === null || typeof item.expect === 'string')) {
      report.problem({ file: where, rule: 'eval-shape', message: 'is not { prompt: string, expect: skill-name | null }', fix: 'Fix the entry.' });
      continue;
    }
    if (item.expect !== null && !known.has(item.expect)) {
      if (options['skip-missing']) report.note(`skip ${where}: ${item.expect} does not exist yet`);
      else report.problem({ file: where, rule: 'eval-unknown-skill', message: `expects ${item.expect}, which is not in ${root}`, fix: 'Create the skill, fix the name, or pass --skip-missing while it is being built.' });
      continue;
    }
    checked += 1;
    const shown = item.prompt.length > 70 ? `${item.prompt.slice(0, 67)}...` : item.prompt;
    if (!options.live) {
      if (item.expect === null) continue;
      const ranked = router.rank(item.prompt);
      const place = ranked.findIndex((entry) => entry.name === item.expect) + 1;
      if (place > top) report.problem({ file: where, rule: 'route-miss', message: `"${shown}" ranks ${item.expect} #${place}; top ${top}: ${ranked.slice(0, top).map((entry) => entry.name).join(', ')}`, fix: `Put the words of this task into ${item.expect}'s description (lead with them), or add a "Not for" boundary to the skills that win it.` });
      else report.note(`ok   ${where} ${item.expect} #${place}`);
      continue;
    }
    const chosen = [];
    for (let i = 0; i < runs; i += 1) {
      const result = await routeLive(item.prompt, { cwd: resolve(options.repo) });
      if (result.error && result.firstTool === null && /not installed|exited|within/.test(result.error)) fail(`live routing cannot run: ${result.error}`, 'Install and sign in to Claude Code, run from the repo root, or drop --live.');
      chosen.push(result.skill);
    }
    const hits = chosen.filter((skill) => skill === item.expect).length;
    if (item.expect === null) {
      const loaded = chosen.filter((skill) => skill !== null && known.has(skill));
      if (loaded.length * 2 > runs) report.problem({ file: where, rule: 'route-false-positive', message: `"${shown}" loaded ${loaded.join(', ')} but should load none of these skills`, fix: 'Add this kind of task to the "Not for" clause of the skill that fired.' });
      else report.note(`ok   ${where} no skill (${runs} runs)`);
    } else if (hits * 2 < runs || hits === 0) {
      report.problem({ file: where, rule: 'route-miss', message: `"${shown}" chose ${chosen.map((skill) => skill ?? 'no skill').join(', ')}; expected ${item.expect}`, fix: `Sharpen ${item.expect}'s description with the words of this task, or add a "Not for" boundary to the skill that won.` });
    } else {
      report.note(`ok   ${where} ${item.expect} (${hits}/${runs})`);
    }
  }
  return report.finish({ checked, unit: `evals (${options.live ? `live, ${runs} run(s) each` : `offline, top ${top}`})` });
});
