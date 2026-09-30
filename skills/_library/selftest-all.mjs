#!/usr/bin/env node
// selftest-all.mjs: runs the library's own self-test and every skill's scripts/selftest.mjs,
// then prints one table and the RESULT line.

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { COMMON_OPTIONS, defaultTargets, resolveRoots, resolveTargets, targetLabel } from './lib/library.mjs';
import { RESULT_PATTERN, createReporter, parseArgs, run } from './shared/scripts/check-lib.mjs';

const SPEC = {
  name: 'selftest-all',
  summary: 'Runs every skill\'s scripts/selftest.mjs (and the library\'s own tests/selftest.mjs) from the repo root and prints a table. A skill without scripts is skipped; a skill with scripts but no selftest.mjs fails.',
  usage: '[options] [skill-name-or-path...]',
  options: {
    ...COMMON_OPTIONS,
    'skip-library': { type: 'boolean', help: 'Do not run the library\'s own self-test' },
    timeout: { type: 'string', value: 'seconds', default: '600', help: 'Time limit per self-test' },
  },
  positionals: { min: 0, max: Infinity },
};

function hasScripts(dir) {
  const scripts = join(dir, 'scripts');
  return existsSync(scripts) && readdirSync(scripts).some((name) => name.endsWith('.mjs') && name !== 'check-lib.mjs');
}

async function main() {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const roots = resolveRoots(options);
  const cwd = dirname(roots.skillsRoot);
  const timeoutMs = Number(options.timeout) * 1000;
  const targets = positionals.length ? resolveTargets(positionals, roots) : defaultTargets(roots);
  const rows = [];
  if (!options['skip-library'] && positionals.length === 0) {
    rows.push({ label: '(library)', script: join(roots.libDir, 'tests', 'selftest.mjs'), shown: '_library/tests/selftest.mjs' });
    // Shared checkers keep their own self-test next to them: shared/scripts/<name>.selftest.mjs.
    const sharedScripts = join(roots.shared, 'scripts');
    if (existsSync(sharedScripts)) {
      for (const name of readdirSync(sharedScripts).filter((file) => file.endsWith('.selftest.mjs')).sort()) {
        rows.push({ label: `(shared) ${name.replace('.selftest.mjs', '')}`, script: join(sharedScripts, name), shown: `shared/scripts/${name}` });
      }
    }
  }
  for (const target of targets) {
    const script = join(target.dir, 'scripts', 'selftest.mjs');
    if (existsSync(script)) rows.push({ label: targetLabel(target), script, shown: 'scripts/selftest.mjs' });
    else if (hasScripts(target.dir)) rows.push({ label: targetLabel(target), script: null, shown: '(missing)', error: 'has scripts but no scripts/selftest.mjs' });
    else rows.push({ label: targetLabel(target), script: null, shown: '-', skip: 'no scripts' });
  }
  const report = createReporter({ name: 'selftest-all' });
  const results = [];
  for (const row of rows) {
    if (row.skip) {
      results.push({ ...row, status: 'SKIP', time: '', note: row.skip });
      continue;
    }
    if (row.error) {
      results.push({ ...row, status: 'FAIL', time: '', note: row.error });
      report.problem({ file: row.label, rule: 'selftest-missing', message: row.error, fix: 'Add scripts/selftest.mjs that calls runSelftest() (copy it from the skill template).' });
      continue;
    }
    if (!existsSync(row.script)) {
      results.push({ ...row, status: 'FAIL', time: '', note: 'self-test file not found' });
      report.problem({ file: row.shown, rule: 'selftest-missing', message: 'self-test file not found', fix: 'Restore it.' });
      continue;
    }
    const started = Date.now();
    const child = spawnSync(process.execPath, [row.script], { cwd, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 });
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    const output = `${child.stdout ?? ''}${child.stderr ?? ''}`;
    const final = (child.stdout ?? '').split('\n').map((line) => line.trim()).filter(Boolean).at(-1) ?? '';
    const passed = child.status === 0 && final === 'RESULT: PASS';
    const note = child.error?.code === 'ETIMEDOUT' ? `timed out after ${options.timeout}s` : RESULT_PATTERN.test(final) ? final.replace('RESULT: ', '') : `exit ${child.status}, no RESULT line`;
    results.push({ ...row, status: passed ? 'PASS' : 'FAIL', time: `${seconds}s`, note, output });
    if (!passed) report.problem({ file: `${row.label}/${row.shown}`, rule: 'selftest-failed', message: note, fix: `Run node ${row.script} and fix what it reports.` });
  }
  const width = Math.max(10, ...results.map((row) => row.label.length));
  const scriptWidth = Math.max(8, ...results.map((row) => row.shown.length));
  console.log(`${'SKILL'.padEnd(width)}  ${'SELFTEST'.padEnd(scriptWidth)}  RESULT  TIME     NOTE`);
  for (const row of results) console.log(`${row.label.padEnd(width)}  ${row.shown.padEnd(scriptWidth)}  ${row.status.padEnd(6)}  ${row.time.padEnd(7)}  ${row.status === 'PASS' ? '' : row.note}`);
  for (const row of results.filter((item) => item.status === 'FAIL' && item.output)) {
    console.log(`\n--- ${row.label}: last lines of output ---`);
    console.log(row.output.trimEnd().split('\n').slice(-20).join('\n'));
  }
  console.log('');
  const ran = results.filter((row) => row.status !== 'SKIP').length;
  if (ran === 0 && report.count === 0) console.log('No self-tests ran: no skill has scripts yet.');
  return report.finish({ checked: results.length, unit: 'rows' });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run(main);
