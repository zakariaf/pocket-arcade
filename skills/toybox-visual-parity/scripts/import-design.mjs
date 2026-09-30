#!/usr/bin/env node
// import-design.mjs: makes (or checks) this skill's offline copy of the Toybox design HTML.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import { createReporter, fail, parseArgs, requireFile, run, sha256 } from './check-lib.mjs';
import { importDesign } from './lib/design-import.mjs';
import { DEFAULTS } from './lib/paths.mjs';

const SPEC = {
  name: 'import-design',
  summary:
    'Turns the Toybox mockup into the offline design copy the references are rendered from: the Google Fonts ' +
    'links become local @font-face rules for the bundled TTFs, and strings that name project files are rewritten. ' +
    'Nothing else changes. --check writes nothing and fails when the copy differs from a fresh import.',
  usage: '<original-toybox.html> [--out <file>] [--check]',
  options: {
    out: { type: 'string', value: 'file', help: 'Where the copy lives', default: DEFAULTS.design },
    check: { type: 'boolean', help: 'Write nothing; exit 1 when the copy is not exactly a fresh import of the original' },
  },
  positionals: { min: 1, max: 1 },
  details: [
    'Run it only when the owner has changed the design on purpose; then run shoot-design.mjs --update-reference',
    'and check-testids.mjs, and say in the report that the references changed.',
    '',
    'Examples:',
    '  node import-design.mjs /path/to/toybox.html',
    '  node import-design.mjs /path/to/toybox.html --check',
  ].join('\n'),
};

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const originalPath = requireFile(resolve(positionals[0]), 'original design HTML');
  const outPath = resolve(options.out);
  const original = readFileSync(originalPath, 'utf8');
  if (!/<title>[^<]*Toybox/i.test(original) && !/id="pa-screens"/.test(original)) {
    fail(`${originalPath} does not look like the Toybox mockup (no Toybox title, no #pa-screens)`, 'Pass the Toybox design HTML.');
  }
  const shown = relative(process.cwd(), outPath) || outPath;
  const report = createReporter({ name: 'import-design' });
  const { html, problems } = importDesign(original);
  for (const p of problems) report.problem({ file: relative(process.cwd(), originalPath) || originalPath, ...p });
  if (report.count === 0) {
    if (options.check) {
      if (!existsSync(outPath)) {
        report.problem({ file: shown, rule: 'copy-missing', message: 'the design copy does not exist', fix: 'Run import-design.mjs without --check.' });
      } else if (readFileSync(outPath, 'utf8') !== html) {
        report.problem({
          file: shown,
          rule: 'copy-drift',
          message: `the design copy (sha256 ${sha256(readFileSync(outPath)).slice(0, 12)}) is not a fresh import of the original (sha256 ${sha256(html).slice(0, 12)})`,
          fix: 'Never hand-edit the copy. Re-import it, then re-render the references (shoot-design.mjs --update-reference).',
        });
      } else {
        report.note(`ok    ${shown} is exactly a fresh import (sha256 ${sha256(html).slice(0, 12)})`);
      }
    } else {
      writeFileSync(outPath, html);
      report.note(`wrote ${shown} (sha256 ${sha256(html).slice(0, 12)}, from original sha256 ${sha256(original).slice(0, 12)})`);
    }
  }
  return report.finish({ checked: 1, unit: 'design files' });
});
