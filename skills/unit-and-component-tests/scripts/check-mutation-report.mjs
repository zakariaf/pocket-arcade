#!/usr/bin/env node
// check-mutation-report.mjs: reads Stryker's JSON report (reports/stryker/mutation.json), computes the
// mutation score, lists every surviving or uncovered mutant with its line and replacement, and fails
// when the score is under the break threshold (75) or a file named with --changed still has one.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/check-mutation-report.mjs [report] --changed <file>

import { existsSync, readFileSync } from 'node:fs';

import { createReporter, fail, parseArgs, requireFile, run } from './check-lib.mjs';

const SPEC = {
  name: 'check-mutation-report',
  summary: 'Checks a Stryker mutation report: overall score at or above the break threshold, and no surviving or uncovered mutant in the files you just finished.',
  usage: '[options] [report.json]',
  options: {
    changed: { type: 'string', multiple: true, value: 'file', help: 'A source file (repo-relative) that must have no Survived or NoCoverage mutant' },
    allow: { type: 'string', multiple: true, value: 'id', help: 'A mutant id accepted as equivalent (write why in the evidence report)' },
    break: { type: 'string', value: 'n', help: 'Minimum score in percent (default: the report\'s thresholds.break, at least 75)' },
    all: { type: 'boolean', help: 'List every undetected mutant of every file (default: one summary line per file)' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line before the RESULT line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Default report: reports/stryker/mutation.json (written by the json reporter in stryker.config.json).',
    'Score = (Killed + Timeout) / (Killed + Timeout + Survived + NoCoverage); Ignored, CompileError and',
    'RuntimeError mutants do not count.',
    '',
    'Rules:',
    '  mutation-score       the overall score is below the break threshold',
    '  survivor             a mutant in a --changed file survived (no test failed when the code changed)',
    '  no-coverage          a mutant in a --changed file was never run by any test',
    '  changed-not-mutated  a --changed file is not in the report (run: npx stryker run --mutate <file>)',
    '  allow-unknown        an --allow id matches no mutant in the report',
    '',
    'Other files get one note line each (counts and first line); --all lists every mutant, for the evidence report.',
  ].join('\n'),
};

const DETECTED = new Set(['Killed', 'Timeout']);
const UNDETECTED = new Set(['Survived', 'NoCoverage']);

function loadReport(path) {
  let report;
  try {
    report = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`${path} is not valid JSON: ${error.message}`, 'Rerun Stryker (npm run test:mutation) to write a fresh report.');
  }
  if (typeof report !== 'object' || report === null || typeof report.files !== 'object' || report.files === null) {
    fail(`${path} has no "files" object; it is not a Stryker mutation report`, 'Point the script at reports/stryker/mutation.json.');
  }
  return report;
}

const clean = (text) => String(text).replace(/\s+/g, ' ').trim().slice(0, 80);

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const path = positionals[0] ?? 'reports/stryker/mutation.json';
  if (!existsSync(path)) fail(`nothing to check: ${path} does not exist`, 'Run npx stryker run --mutate <file> (or npm run test:mutation) first; the json reporter writes this file.');
  requireFile(path, 'mutation report');
  const data = loadReport(path);
  const breakAt = options.break === undefined ? Math.max(75, Number(data.thresholds?.break ?? 75)) : Number(options.break);
  if (!Number.isFinite(breakAt) || breakAt < 75) fail(`--break ${options.break} is below 75`, 'The break threshold is a gate: never run with less than 75.');
  const allowed = new Set(options.allow);
  const changed = new Set(options.changed.map((file) => file.replace(/^\.\//, '')));
  const report = createReporter({ name: SPEC.name, json: options.json });
  let detected = 0;
  let undetected = 0;
  let total = 0;
  const seenIds = new Set();
  for (const [file, entry] of Object.entries(data.files).sort(([a], [b]) => (a < b ? -1 : 1))) {
    const mutants = Array.isArray(entry?.mutants) ? entry.mutants : [];
    const summary = { Survived: 0, NoCoverage: 0, firstLine: 0 };
    for (const mutant of mutants) {
      total += 1;
      seenIds.add(String(mutant.id));
      if (DETECTED.has(mutant.status)) detected += 1;
      if (!UNDETECTED.has(mutant.status)) continue;
      const isAllowed = allowed.has(String(mutant.id));
      if (!isAllowed) undetected += 1;
      const line = mutant.location?.start?.line ?? 0;
      const what = `${mutant.mutatorName} mutant ${mutant.id} ${mutant.status === 'Survived' ? 'survived' : 'was never run by a test'}: "${clean(mutant.replacement ?? '')}"`;
      if (isAllowed) {
        report.note(`note ${file}:${line} ${what} (accepted as equivalent with --allow)`);
      } else if (changed.has(file)) {
        report.problem({ file, line, rule: mutant.status === 'Survived' ? 'survivor' : 'no-coverage', message: what, fix: mutant.status === 'Survived' ? 'Add the example that tells the real code from this change (usually a boundary: exactly the limit, the same millisecond, an empty list), or delete dead code.' : 'Add a test that runs this line (often a branch or action no test reaches).' });
      } else if (options.all) {
        report.note(`note ${file}:${line} ${what}`);
      } else {
        summary[mutant.status] += 1;
        summary.firstLine = summary.firstLine || line;
      }
    }
    if (summary.Survived + summary.NoCoverage > 0) report.note(`note ${file}:${summary.firstLine} ${summary.Survived} survived, ${summary.NoCoverage} without coverage (details: --changed ${file} or --all)`);
  }
  for (const file of changed) {
    if (!(file in data.files)) report.problem({ file, line: 0, rule: 'changed-not-mutated', message: 'is not in the mutation report', fix: `Run npx stryker run --mutate ${file}, then rerun this check.` });
  }
  for (const id of allowed) {
    if (!seenIds.has(id)) report.problem({ file: path, line: 0, rule: 'allow-unknown', message: `--allow ${id} matches no mutant in the report`, fix: 'Pass the id shown in the survivor line, or drop the --allow.' });
  }
  const valid = detected + undetected;
  const score = valid === 0 ? 100 : (detected / valid) * 100;
  report.note(`mutation score ${score.toFixed(1)}% (${detected} detected of ${valid} valid mutants; ${total} in the report; break ${breakAt}%)`);
  if (score < breakAt) report.problem({ file: path, line: 0, rule: 'mutation-score', message: `mutation score ${score.toFixed(1)}% is below the break threshold ${breakAt}%`, fix: 'Kill the listed survivors with boundary examples (never by relaxing thresholds or disabling mutants), then rerun Stryker.' });
  return report.finish({ checked: total, unit: 'mutants' });
});
