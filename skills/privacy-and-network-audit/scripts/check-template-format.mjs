#!/usr/bin/env node
// check-template-format.mjs: every .ts, .tsx and .json file under a folder must already be in the
// app repo's Prettier format (assets/prettierrc.json, a copy of the repo's .prettierrc.json), with
// the Prettier version the repo pins. A template that is not formatted turns the repo's
// `npm run format:check` (and so verify and check:fast) red the moment it is copied.
// The self-test runs it on this skill's own templates/.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/check-template-format.mjs <folder>
// Needs: npm ci --prefix ${CLAUDE_SKILL_DIR}/scripts (prettier, pinned in scripts/package.json).

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createReporter, fail, parseArgs, requireDir, requireFile, run, walk } from './check-lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SPEC = {
  name: 'check-template-format',
  summary: "Checks that every .ts, .tsx and .json file under a folder is formatted exactly as the app repo's Prettier would write it (the repo's config and pinned version).",
  usage: '[options] <folder>',
  options: {
    config: { type: 'string', value: 'file', help: 'Prettier config (default: this skill\'s assets/prettierrc.json, the repo\'s .prettierrc.json)' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rule: unformatted   the file differs from what `prettier --write` makes of it.',
    'Install the pinned Prettier first: npm ci --prefix <skill>/scripts',
  ].join('\n'),
};

async function loadPrettier() {
  try {
    return await import('prettier');
  } catch {
    return fail('prettier is not installed for this skill\'s scripts', `Run: npm ci --prefix ${HERE} (pinned in scripts/package.json, the version the app repo uses).`);
  }
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = requireDir(positionals[0] ?? '.', 'folder to check');
  const configPath = requireFile(options.config ?? join(HERE, '..', 'assets', 'prettierrc.json'), 'Prettier config');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  delete config.$schema;
  const prettier = await loadPrettier();
  const files = walk(root, { include: ['*.ts', '*.tsx', '*.json'] });
  const report = createReporter({ name: 'check-template-format', json: options.json });
  for (const rel of files) {
    const text = readFileSync(join(root, rel), 'utf8');
    const isFormatted = await prettier.check(text, { ...config, filepath: join(root, rel) });
    if (!isFormatted) report.problem({ file: rel, rule: 'unformatted', message: `is not in the repo's Prettier ${prettier.version} format`, fix: `Format it with the pinned Prettier (npx prettier --write ${rel} inside the app repo, or the one in scripts/node_modules), then copy it back.` });
  }
  return report.finish({ checked: files.length, unit: '.ts/.tsx/.json files' });
});
