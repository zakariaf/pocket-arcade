#!/usr/bin/env node
// check-known-pitfalls.mjs: scans the app repo for the known failures that can be seen in files
// before they happen (a Metro cache without the variant key, a banned package, a selector that
// loops, a Jest config that drops rules ...). Every finding names its catalogue id, so
// find-fix.mjs --id <id> prints the cause and the fix.
// Run from the repo root: node ${CLAUDE_SKILL_DIR}/scripts/check-known-pitfalls.mjs .
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { REPO_SCAN_IGNORES, createReporter, fail, parseArgs, requireDir, requireFile, run, walk } from './check-lib.mjs';
import { DEFAULT_CATALOGUE, loadCatalogue } from './lib/catalogue.mjs';
import { PITFALLS } from './lib/pitfalls.mjs';

const SPEC = {
  name: 'check-known-pitfalls',
  summary: 'Scans an app repo for known failures that are visible in its files; each finding names the catalogue id with its cause and fix.',
  usage: '[options] [repo-root]',
  options: {
    only: { type: 'string', multiple: true, help: 'Run only these catalogue ids (repeatable)' },
    json: { type: 'boolean', help: 'Also print the problems as JSON' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules (catalogue ids):',
    ...PITFALLS.map((pitfall) => `  ${pitfall.id}`),
    '',
    'Skipped: the repo-scan ignores (skills/, .claude/, node_modules, Pods, .expo, and ios/, android/, build/',
    'and out/ at the root and in each app), .git, dist folders, coverage, .stryker-tmp, reports/ and tools/.',
    'Rules about runtime code skip test files.',
    '',
    'Each finding prints the catalogue fix and cause; find-fix.mjs --id <id> prints the full entry.',
  ].join('\n'),
};

const IGNORE = [...REPO_SCAN_IGNORES, '.git', 'apps/*/dist', 'dist', 'coverage', '.stryker-tmp', 'reports/**', 'tools/**'];

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'repo root');
  requireFile(join(root, 'package.json'), 'root package.json (run from the app repo root)');
  const unknown = options.only.filter((id) => !PITFALLS.some((pitfall) => pitfall.id === id));
  if (unknown.length > 0) fail(`--only names no pitfall rule: ${unknown.join(', ')}`, 'Run --help for the list of rule ids.');
  const catalogue = loadCatalogue(DEFAULT_CATALOGUE);
  const byId = new Map(catalogue.entries.map((entry) => [entry.id, entry]));
  const files = walk(root, { ignore: IGNORE, include: ['*.ts', '*.tsx', '*.js', '*.mjs', '*.cjs', '*.json', '*.yaml', '*.yml', '*.plist', '*.sh', '*.mts'] });
  const cache = new Map();
  const ctx = { root, files, read: (rel) => cache.get(rel) ?? cache.set(rel, readFileSync(join(root, rel), 'utf8')).get(rel) };
  const report = createReporter({ name: 'check-known-pitfalls', json: options.json });
  const rules = options.only.length > 0 ? PITFALLS.filter((pitfall) => options.only.includes(pitfall.id)) : PITFALLS;
  for (const pitfall of rules) {
    const entry = byId.get(pitfall.id);
    for (const finding of pitfall.detect(ctx)) {
      report.problem({ file: finding.file, line: finding.line, rule: pitfall.id, message: finding.message, fix: entry ? `${entry.fix} (cause: ${entry.cause})` : 'See find-fix.mjs --id.' });
    }
  }
  return report.finish({ checked: files.length, unit: `files against ${rules.length} known pitfalls` });
});
