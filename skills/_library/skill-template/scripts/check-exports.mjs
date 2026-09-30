#!/usr/bin/env node
// check-exports.mjs: checks that TypeScript modules use named exports and kebab-case file names.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/check-exports.mjs [folder...]   (default: the repo root, ".")
// The walk skips REPO_SCAN_IGNORES (the in-repo skills/ library, .claude/, node_modules, Pods and
// generated native and build output), so the skill library's planted fixtures are never judged.

import { join, relative, resolve } from 'node:path';
import { readFileSync, statSync } from 'node:fs';

import { REPO_SCAN_IGNORES, createReporter, lineOf, maskComments, parseArgs, requireDir, run, toPosix, walk } from './check-lib.mjs';

const SPEC = {
  name: 'check-exports',
  summary: 'Checks TypeScript modules for the two module rules: named exports only (no "export default") and kebab-case file names.',
  usage: '[options] [folder...]',
  options: {
    json: { type: 'boolean', help: 'Also print the problems as one JSON line before the RESULT line' },
  },
  positionals: { min: 0, max: Infinity },
  details: [
    'Rules:',
    '  no-default-export  a module exports by name; "export default" is not allowed',
    '  file-name-kebab    file names are kebab-case: clamp-value.ts, clamp-value.test.ts',
    '',
    'Example: node check-exports.mjs packages/game-kit/src',
  ].join('\n'),
};

const KEBAB_FILE = /^[a-z0-9]+(-[a-z0-9]+)*(\.[a-z0-9]+(-[a-z0-9]+)*)*\.tsx?$/;

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const folders = (positionals.length ? positionals : ['.']).map((folder) => requireDir(folder, 'folder'));
  const report = createReporter({ name: 'check-exports', json: options.json });
  let checked = 0;
  for (const folder of folders) {
    for (const rel of walk(folder, { include: ['*.ts', '*.tsx'], ignore: [...REPO_SCAN_IGNORES, '*.d.ts'] })) {
      checked += 1;
      const abs = join(folder, rel);
      const shown = toPosix(relative(process.cwd(), abs)) || rel;
      const fileName = rel.split('/').pop();
      if (!KEBAB_FILE.test(fileName)) {
        report.problem({ file: shown, line: 1, rule: 'file-name-kebab', message: `file name "${fileName}" is not kebab-case`, fix: 'Rename the file to lowercase words joined by hyphens, for example clamp-value.ts.' });
      }
      const source = maskComments(readFileSync(abs, 'utf8'));
      for (const match of source.matchAll(/\bexport\s+default\b/g)) {
        report.problem({ file: shown, line: lineOf(source, match.index), rule: 'no-default-export', message: '"export default" makes imports rename freely and breaks search', fix: 'Export by name (export function clampValue ...) and import { clampValue }.' });
      }
    }
  }
  return report.finish({ checked, unit: 'TypeScript files' });
});
