#!/usr/bin/env node
// scaffold-monorepo.mjs: writes the Pocket Arcade monorepo skeleton from this skill's templates.
// Dry run by default (prints the plan); --write creates the files. It never overwrites a file that
// differs from the template: that is a conflict to resolve by hand (or --replace <file>).
// Run: node ${CLAUDE_SKILL_DIR}/scripts/scaffold-monorepo.mjs --root . [--write]

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { buildPlan, defaultVars, preExistingEntries, validateVars } from './lib/bootstrap-plan.mjs';
import { createReporter, fail, parseArgs, requireDir, run } from './check-lib.mjs';

const SPEC = {
  name: 'scaffold-monorepo',
  summary: 'Plans (default) or writes (--write) every file of the Pocket Arcade monorepo skeleton: root configs, the three packages, the pilot app (with its .gitignore, the Toybox fonts and the four canonical Line Siege catalogs) and the tooling gate scripts. Existing identical files are left alone, .gitignore and .claude/settings.json are merged, and any other existing file that differs is a conflict.',
  usage: '--root <dir> [options]',
  options: {
    root: { type: 'string', value: 'dir', help: 'The repo root to scaffold (required; usually ".")' },
    app: { type: 'string', value: 'id', default: 'line-siege', help: 'Pilot game id: line-siege (Line Siege v1 is the pilot; other games come from the new-game-scaffold skill)' },
    name: { type: 'string', value: 'text', help: 'Pilot display name (default: from the id, "Line Siege")' },
    'name-fa': { type: 'string', value: 'text', help: 'Persian display name (default: the Latin name until the i18n step)' },
    'name-ckb': { type: 'string', value: 'text', help: 'Sorani display name (default: the Latin name until the i18n step)' },
    'bundle-id': { type: 'string', value: 'id', help: 'Pilot bundle id (default: com.example.<id without hyphens>)' },
    today: { type: 'string', value: 'YYYY-MM-DD', help: 'Date that decides whether the dated .npmrc exclude block is still needed (default: today, UTC)' },
    write: { type: 'boolean', help: 'Write the files (without it nothing is changed)' },
    replace: { type: 'string', multiple: true, value: 'file', help: 'Overwrite this conflicting repo file with the template' },
    compare: { type: 'boolean', help: 'Fail unless every file already equals what the templates produce (proves a generated tree is current)' },
  },
  positionals: { min: 0, max: 0 },
  details: [
    'Rules reported:',
    '  conflict   an existing file differs from the template (or settings.json disagrees with the gates)',
    '  differs    (--compare) a file is missing or not what the templates produce',
    '',
    'Example: node scaffold-monorepo.mjs --root . --app line-siege --name "Line Siege" --write',
  ].join('\n'),
};

run(async () => {
  const { options } = parseArgs(process.argv.slice(2), SPEC);
  if (!options.root) fail('pass --root <dir> (the repo root to scaffold)', 'Example: --root . (nothing is written without --write).');
  const root = requireDir(options.root, 'repo root');
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const vars = { ...defaultVars(options.app, today), ...(options.name ? { appName: options.name } : {}), ...(options['bundle-id'] ? { bundleId: options['bundle-id'] } : {}), ...(options['name-fa'] ? { appNameFa: options['name-fa'] } : {}), ...(options['name-ckb'] ? { appNameCkb: options['name-ckb'] } : {}) };
  const invalid = validateVars(vars);
  if (invalid.length) fail(invalid.join('; '), 'Fix the option values and rerun.');

  const report = createReporter({ name: 'scaffold-monorepo' });
  const plan = buildPlan(root, vars);
  const replace = new Set(options.replace);
  const counts = { create: 0, merge: 0, same: 0, conflict: 0, replaced: 0 };
  for (const entry of plan) {
    let action = entry.action;
    if (action === 'conflict' && replace.has(entry.rel)) action = 'replaced';
    counts[action] += 1;
    if (options.compare) {
      if (action !== 'same') report.problem({ file: entry.rel, rule: 'differs', message: action === 'create' ? 'is missing' : 'is not what the templates produce', fix: 'Regenerate the tree with --write, or update the templates.' });
      continue;
    }
    if (action === 'conflict') {
      report.problem({ file: entry.rel, rule: 'conflict', message: entry.notes.join('; '), fix: `Compare it with the template, keep what the owner needs, then rerun with --replace ${entry.rel} (or edit it to match).` });
      continue;
    }
    if (action !== 'same') console.log(`${options.write ? 'wrote' : 'plan '} ${action.padEnd(8)} ${entry.rel}`);
    if (options.write && action !== 'same') {
      const target = join(root, entry.rel);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, entry.content);
    }
  }
  const ignored = preExistingEntries(root).map((entry) => entry.name);
  console.log(`pilot app: apps/${vars.appId} ("${vars.appName}", ${vars.bundleId}); release-age block: ${plan.find((entry) => entry.rel === '.npmrc')?.content.includes('exclude-block') ? 'included' : 'not needed'}`);
  console.log(`pre-existing top-level entries ignored by Prettier and ESLint: ${ignored.length ? ignored.join(', ') : 'none'}`);
  console.log(`${options.write ? 'written' : 'planned'}: ${counts.create} new, ${counts.merge} merged, ${counts.replaced} replaced, ${counts.same} unchanged, ${counts.conflict} conflicts${options.write ? '' : ' (dry run: add --write to create the files)'}`);
  return report.finish({ checked: plan.length, unit: 'template files' });
});
