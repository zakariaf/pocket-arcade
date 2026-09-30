#!/usr/bin/env node
// check-rules.mjs: fails when a file under the given folder contains a pattern this skill forbids.
// Each rule names the files it applies to, the pattern (matched with comments blanked out), the
// message and the fix. Run from the repo root: node ${CLAUDE_SKILL_DIR}/scripts/check-rules.mjs .
// The walk skips REPO_SCAN_IGNORES: the in-repo skills/ library and .claude/ (their fixtures plant
// these patterns on purpose), node_modules, Pods and generated native and build output.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { REPO_SCAN_IGNORES, createReporter, lineOf, maskComments, matchGlob, parseArgs, requireDir, run, walk } from './check-lib.mjs';

/** One entry per rule. include: globs relative to the scanned folder ("*.ts" matches any depth). */
const RULES = [
  {
    id: '__FILL_RULE_ID__',
    include: ['*.ts', '*.tsx'],
    pattern: /__FILL_PATTERN__/,
    message: '__FILL_WHAT_IS_WRONG__',
    fix: '__FILL_HOW_TO_FIX_IT__',
  },
];

const SPEC = {
  name: 'check-rules',
  summary: 'Fails when a file contains a pattern this skill forbids; every problem names the file, the line, the rule and the fix.',
  usage: '[options] [repo-root...]',
  options: {
    json: { type: 'boolean', help: 'Also print the problems as JSON' },
  },
  positionals: { min: 0, max: Infinity },
  details: ['Rules:', ...RULES.map((rule) => `  ${rule.id}  ${rule.message}`)].join('\n'),
};

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const folders = (positionals.length > 0 ? positionals : ['.']).map((folder) => requireDir(folder, 'repo root'));
  const report = createReporter({ name: 'check-rules', json: options.json });
  let checked = 0;
  for (const folder of folders) {
    const files = walk(folder, { include: [...new Set(RULES.flatMap((rule) => rule.include))], ignore: [...REPO_SCAN_IGNORES, 'coverage'] });
    for (const rel of files) {
      checked += 1;
      const text = maskComments(readFileSync(join(folder, rel), 'utf8'));
      for (const rule of RULES.filter((item) => item.include.some((glob) => matchGlob(rel, glob)))) {
        const match = rule.pattern.exec(text);
        if (match) report.problem({ file: rel, line: lineOf(text, match.index), rule: rule.id, message: rule.message, fix: rule.fix });
      }
    }
  }
  return report.finish({ checked, unit: 'files' });
});
