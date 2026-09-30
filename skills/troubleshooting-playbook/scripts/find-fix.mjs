#!/usr/bin/env node
// find-fix.mjs: looks an error up in the known-failures catalogue. Give it the error text, a log
// file, or an id; it prints the matching entries with cause, fix, status and owning skill.
// Exit 0 when something known matched, 1 when nothing did (then diagnose from first principles
// and add the new entry to the catalogue once it is solved).
// Run: node ${CLAUDE_SKILL_DIR}/scripts/find-fix.mjs --text "errSecInternalComponent"
//      node ${CLAUDE_SKILL_DIR}/scripts/find-fix.mjs --log apps/<game>/build/logs/archive.log
import { existsSync, readFileSync } from 'node:fs';

import { createReporter, fail, parseArgs, run } from './check-lib.mjs';
import { DEFAULT_CATALOGUE, loadCatalogue } from './lib/catalogue.mjs';

const SPEC = {
  name: 'find-fix',
  summary: 'Finds known failures by error text (--text), in a log file (--log) or by id (--id), and prints symptom, cause, fix, status and the skill that owns the fix.',
  usage: '(--text "<error text>" | --log <file> | --id <catalogue-id>)... [options]',
  options: {
    text: { type: 'string', multiple: true, help: 'Error text or a description of what you see (regex and keyword match)' },
    log: { type: 'string', multiple: true, help: 'A log file; only the error patterns are matched (no keywords)' },
    id: { type: 'string', multiple: true, help: 'Print this catalogue entry' },
    area: { type: 'string', help: 'Limit to one area (build, release, deps, lint, testing, engine, i18n, services, state, parity, gates, perf, skills, open)' },
    limit: { type: 'string', default: '5', help: 'Most entries to print per query' },
    catalogue: { type: 'string', help: 'Catalogue JSON (default: this skill\'s assets/known-failures.json)' },
    json: { type: 'boolean', help: 'Also print the problems as JSON' },
  },
  positionals: { min: 0, max: 0 },
  details: [
    'A --text query matches an entry when one of its error patterns matches, or when at least half of the',
    'query\'s words (and at least two) appear in the entry\'s id, topic, symptom and cause.',
    'Rule: no-known-fix  nothing in the catalogue matched (exit 1)',
  ].join('\n'),
};

const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'not', 'are', 'was', 'but', 'has', 'have', 'after', 'when', 'then', 'into', 'our', 'its', 'can', 'cannot', 'does', 'did', 'error', 'failed', 'fails']);

function words(text) {
  return [...new Set(text.toLowerCase().split(/[^a-z0-9_.-]+/).filter((word) => word.length >= 3 && !STOP_WORDS.has(word)))];
}

function score(entry, query, { keywords }) {
  if (entry.match.some((pattern) => new RegExp(pattern).test(query))) return 1000;
  if (!keywords) return 0;
  const queryWords = words(query);
  const haystack = `${entry.id} ${entry.topic} ${entry.symptom} ${entry.cause}`.toLowerCase();
  const hits = queryWords.filter((word) => haystack.includes(word)).length;
  return hits >= 2 && hits * 2 >= queryWords.length ? hits : 0;
}

function print(entry) {
  const owner = entry.owner ? ' | stop and ask the owner' : '';
  console.log(`MATCH ${entry.id} [${entry.status}${owner}]${entry.skill ? ` skill: ${entry.skill}` : ''}`);
  console.log(`  symptom: ${entry.symptom}`);
  console.log(`  cause:   ${entry.cause}`);
  console.log(`  fix:     ${entry.fix}`);
}

run(async () => {
  const { options } = parseArgs(process.argv.slice(2), SPEC);
  if (options.text.length + options.log.length + options.id.length === 0) fail('nothing to look up: pass --text, --log or --id', 'Example: find-fix.mjs --text "errSecInternalComponent".');
  const catalogue = loadCatalogue(options.catalogue ?? DEFAULT_CATALOGUE);
  const entries = catalogue.entries.filter((entry) => !options.area || entry.area === options.area);
  const limit = Number(options.limit) || 5;
  const report = createReporter({ name: 'find-fix', json: options.json });
  const queries = [
    ...options.text.map((text) => ({ label: `text "${text.slice(0, 60)}"`, body: text, keywords: true })),
    ...options.log.map((file) => {
      if (!existsSync(file)) fail(`nothing to check: log ${file} does not exist`, 'Pass the log that the failing step wrote.');
      return { label: `log ${file}`, body: readFileSync(file, 'utf8'), keywords: false };
    }),
  ];
  for (const id of options.id) {
    const entry = catalogue.entries.find((item) => item.id === id);
    if (entry) print(entry);
    else report.problem({ file: '', rule: 'no-known-fix', message: `no catalogue entry ${id}`, fix: 'Check the id printed by check-known-pitfalls.mjs, or search with --text.' });
  }
  for (const query of queries) {
    const ranked = entries.map((entry) => ({ entry, points: score(entry, query.body, query) })).filter((item) => item.points > 0).sort((a, b) => b.points - a.points).slice(0, limit);
    if (ranked.length === 0) {
      report.problem({ file: '', rule: 'no-known-fix', message: `nothing known matches ${query.label}`, fix: 'Diagnose from the full log; once solved, add an entry to assets/known-failures.json and run check-catalogue.mjs --write.' });
      continue;
    }
    console.log(`${query.label}: ${ranked.length} known failure(s)`);
    ranked.forEach(({ entry }) => print(entry));
  }
  return report.finish({ checked: queries.length + options.id.length, unit: 'queries' });
});
