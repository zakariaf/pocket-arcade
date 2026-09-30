#!/usr/bin/env node
// check-bundle-size.mjs: checks the minified JS of a store build (npx expo export --platform ios
// --no-bytecode) against the size cap and the committed baseline.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/check-bundle-size.mjs <dist-dir> [--baseline <file>] [--write-baseline]

import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

import { createReporter, fail, parseArgs, run, toPosix, walk } from './check-lib.mjs';
import { loadBudgets } from './lib/budgets.mjs';

const SPEC = {
  name: 'check-bundle-size',
  summary: 'Checks the iOS JavaScript bundle of an expo export (--no-bytecode) against perf.bundleJsBytesMax and against the committed baseline x perf.bundleGrowthMaxRatio.',
  usage: '<dist-dir> [--root <dir>] [--baseline <file>] [--write-baseline]',
  options: {
    root: { type: 'string', default: '.', value: 'dir', help: 'App repo root (reads quality-gates.json for the budgets)' },
    baseline: { type: 'string', value: 'file', help: 'Baseline JSON { "bundleJsBytes": n } to compare with (the growth check)' },
    'write-baseline': { type: 'boolean', help: 'Write the measured size to --baseline after the checks pass (first run, or an approved growth)' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line' },
  },
  positionals: { min: 1, max: 1 },
  details: [
    'Rules:',
    '  bundle-cap      the iOS .js bundle is larger than perf.bundleJsBytesMax (6,000,000 bytes)',
    '  bundle-growth   it is more than perf.bundleGrowthMaxRatio (1.1) times the baseline',
    '',
    'Produce the input with: npx expo export --platform ios --no-bytecode --output-dir <dist-dir>',
    '(in apps/<game>). Hermes bytecode (.hbc) is not measured: export with --no-bytecode.',
  ].join('\n'),
};

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const dist = resolve(positionals[0]);
  if (!existsSync(dist) || !statSync(dist).isDirectory()) fail(`nothing to check: ${positionals[0]} is not a folder`, 'Pass the --output-dir of npx expo export --platform ios --no-bytecode.');
  const files = walk(dist, { include: ['*.js', '*.hbc'] }).filter((rel) => /(^|\/)_expo\/static\/js\/ios\//.test(rel) || /\bios\b/.test(rel));
  const js = files.filter((rel) => rel.endsWith('.js'));
  if (js.length === 0) {
    const hbc = files.some((rel) => rel.endsWith('.hbc'));
    fail(hbc ? 'the export holds Hermes bytecode (.hbc), not minified JS' : `no iOS .js bundle under ${positionals[0]}`, 'Export again with: npx expo export --platform ios --no-bytecode --output-dir <dir>');
  }
  const bytes = js.reduce((sum, rel) => sum + statSync(join(dist, rel)).size, 0);
  const { budgets } = loadBudgets(resolve(options.root));
  const report = createReporter({ name: 'check-bundle-size', json: options.json });
  const shown = toPosix(relative(process.cwd(), dist)) || positionals[0];
  console.log(`bundle: ${bytes.toLocaleString('en-US')} bytes of minified JS in ${js.length} file(s) (cap ${budgets.bundleJsBytesMax.toLocaleString('en-US')})`);
  if (bytes > budgets.bundleJsBytesMax) {
    report.problem({ file: shown, line: 0, rule: 'bundle-cap', message: `${bytes} bytes is over the ${budgets.bundleJsBytesMax}-byte cap`, fix: 'Find the new weight (compare exports before and after), drop or replace the dependency, and never add Intl locale data beyond en, de, fa, ckb.' });
  }
  let baselineBytes = null;
  if (options.baseline && existsSync(options.baseline)) {
    baselineBytes = JSON.parse(readFileSync(options.baseline, 'utf8')).bundleJsBytes;
    if (typeof baselineBytes !== 'number' || baselineBytes <= 0) fail(`${options.baseline} has no positive bundleJsBytes`, 'Write it again with --write-baseline.');
    const ratio = bytes / baselineBytes;
    console.log(`baseline: ${baselineBytes.toLocaleString('en-US')} bytes (x${ratio.toFixed(3)}, limit x${budgets.bundleGrowthMaxRatio})`);
    if (ratio > budgets.bundleGrowthMaxRatio) {
      report.problem({ file: shown, line: 0, rule: 'bundle-growth', message: `the bundle grew x${ratio.toFixed(3)} over the baseline (${baselineBytes} bytes)`, fix: 'Explain the growth to the owner; after approval, commit the new baseline (--write-baseline) with a Gate-Change: trailer.' });
    }
  } else if (options.baseline && !options['write-baseline']) {
    fail(`baseline ${options.baseline} does not exist`, 'Create it once with --write-baseline, then commit it.');
  }
  const code = report.finish({ checked: js.length, unit: 'bundle files' });
  if (code === 0 && options['write-baseline']) {
    if (!options.baseline) fail('--write-baseline needs --baseline <file>', 'Pass the baseline path, for example perf-baselines/bundle-ios.json.');
    writeFileSync(options.baseline, `${JSON.stringify({ bundleJsBytes: bytes }, null, 2)}\n`);
    console.log(`wrote ${options.baseline}`);
  }
  return code;
});
