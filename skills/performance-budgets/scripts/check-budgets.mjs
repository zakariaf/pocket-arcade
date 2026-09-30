#!/usr/bin/env node
// check-budgets.mjs: checks that quality-gates.json carries every performance budget and that none
// is looser than the product's budget, unless the owner approved that exact change (--allow).
// Run: node ${CLAUDE_SKILL_DIR}/scripts/check-budgets.mjs [--root <app repo>] [--allow <key>]...

import { existsSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { createReporter, fail, parseArgs, run, toPosix } from './check-lib.mjs';
import { PERF_BUDGETS } from './lib/budgets.mjs';

const SPEC = {
  name: 'check-budgets',
  summary: 'Checks the "perf" section of quality-gates.json: every budget present, a positive number, and not looser than the product budget.',
  usage: '[repo-root] [--allow <key>]... (or --root <dir>)',
  options: {
    root: { type: 'string', default: '.', value: 'dir', help: 'App repo root (holds quality-gates.json)' },
    allow: { type: 'string', multiple: true, value: 'key', help: 'A budget the owner approved loosening (recorded with a Gate-Change: trailer)' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 0, max: 0 },
  details: [
    'Rules:',
    '  budget-missing   a perf budget key is absent or not a positive number',
    '  budget-looser    a budget is looser than the product budget (tighter is always fine)',
    '  budget-unknown   a perf key this skill does not know (typo?)',
    '',
    'Budgets and defaults:',
    ...Object.entries(PERF_BUDGETS).map(([key, [value, dir, what]]) => `  ${key.padEnd(30)} ${dir} ${String(value).padEnd(8)} ${what}`),
  ].join('\n'),
};

run(async () => {
  const { options } = parseArgs(process.argv.slice(2), SPEC);
  const root = resolve(options.root);
  const file = join(root, 'quality-gates.json');
  if (!existsSync(file)) fail(`nothing to check: ${toPosix(relative(process.cwd(), file)) || file} does not exist`, 'Run from the app repo root; create quality-gates.json with templates/quality-gates.budgets.json.');
  let gates;
  try {
    gates = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`quality-gates.json is not valid JSON: ${error.message}`, 'Fix the JSON.');
  }
  const report = createReporter({ name: 'check-budgets', json: options.json });
  const shown = toPosix(relative(process.cwd(), file)) || 'quality-gates.json';
  const perf = gates.perf;
  if (!perf || typeof perf !== 'object') {
    report.problem({ file: shown, line: 1, rule: 'budget-missing', message: 'quality-gates.json has no "perf" section', fix: 'Add the "perf" section from templates/quality-gates.budgets.json.' });
    return report.finish({ checked: 1, unit: 'gate files' });
  }
  const text = readFileSync(file, 'utf8');
  const lineOfKey = (key) => {
    const index = text.indexOf(`"${key}"`);
    return index === -1 ? 1 : text.slice(0, index).split('\n').length;
  };
  for (const [key, [value, direction]] of Object.entries(PERF_BUDGETS)) {
    const got = perf[key];
    if (typeof got !== 'number' || !(got > 0)) {
      report.problem({ file: shown, line: lineOfKey(key), rule: 'budget-missing', message: `perf.${key} is ${JSON.stringify(got)}`, fix: `Set "${key}": ${value}.` });
      continue;
    }
    const looser = direction === 'max' ? got > value : got < value;
    if (looser && !options.allow.includes(key)) {
      report.problem({ file: shown, line: lineOfKey(key), rule: 'budget-looser', message: `perf.${key} is ${got}, looser than the budget ${value}`, fix: `Restore ${value}. Loosening needs the owner's approval, a device report that justifies it, a Gate-Change: trailer, and --allow ${key}.` });
    } else if (looser) {
      console.log(`note: perf.${key} = ${got} is looser than ${value} (allowed by --allow ${key})`);
    }
  }
  for (const key of Object.keys(perf).filter((k) => !Object.hasOwn(PERF_BUDGETS, k))) {
    report.problem({ file: shown, line: lineOfKey(key), rule: 'budget-unknown', message: `perf.${key} is not a known budget`, fix: `Use one of: ${Object.keys(PERF_BUDGETS).join(', ')}.` });
  }
  return report.finish({ checked: Object.keys(PERF_BUDGETS).length, unit: 'budgets' });
});
