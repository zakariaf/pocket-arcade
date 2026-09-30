#!/usr/bin/env node
// check-catalogue.mjs: validates the known-failures catalogue and proves the area references are
// rendered from it. With --write it (re)renders the references after an entry was added or changed.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/check-catalogue.mjs          (checks this skill's own catalogue)
//      node ${CLAUDE_SKILL_DIR}/scripts/check-catalogue.mjs --write  (after editing assets/known-failures.json)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

import { createReporter, parseArgs, run } from './check-lib.mjs';
import { DEFAULT_CATALOGUE, DEFAULT_REFERENCES, loadCatalogue, renderArea, validateCatalogue } from './lib/catalogue.mjs';
import { PITFALLS } from './lib/pitfalls.mjs';

const SPEC = {
  name: 'check-catalogue',
  summary: 'Validates assets/known-failures.json (ids, areas, text, regexes, status, owner, skill) and checks that every area reference in references/ is exactly what the catalogue renders. --write renders them.',
  usage: '[options]',
  options: {
    catalogue: { type: 'string', help: 'Catalogue JSON (default: this skill\'s assets/known-failures.json)' },
    references: { type: 'string', help: 'Folder holding the rendered area references (default: this skill\'s references/)' },
    write: { type: 'boolean', help: 'Write the rendered references instead of only comparing them' },
    json: { type: 'boolean', help: 'Also print the problems as JSON' },
  },
  positionals: { min: 0, max: 0 },
  details: [
    'Rules:',
    '  catalogue-shape    version 1, areas with title/intro/file, at least one entry',
    '  entry-*            every entry: id <area>-<slug> (unique), known area, topic/symptom/cause/fix text,',
    '                     match = compilable regexes, status verified|documented|open, owner boolean, skill name or null',
    '  reference-stale    references/<area>.md equals the rendering of the catalogue (fix: --write)',
    '  pitfall-id         every rule of check-known-pitfalls.mjs names an existing catalogue id (own catalogue only)',
  ].join('\n'),
};

run(async () => {
  const { options } = parseArgs(process.argv.slice(2), SPEC);
  const cataloguePath = resolve(options.catalogue ?? DEFAULT_CATALOGUE);
  const referencesDir = resolve(options.references ?? DEFAULT_REFERENCES);
  const catalogue = loadCatalogue(cataloguePath);
  const report = createReporter({ name: 'check-catalogue', json: options.json });
  const shown = basename(cataloguePath);
  for (const problem of validateCatalogue(catalogue)) report.problem({ file: shown, rule: problem.rule, message: `${problem.where}: ${problem.message}`, fix: problem.fix });
  if (report.count > 0) return report.finish({ checked: catalogue?.entries?.length ?? 0, unit: 'entries' });
  for (const areaId of Object.keys(catalogue.areas)) {
    const file = join(referencesDir, basename(catalogue.areas[areaId].file));
    const rendered = renderArea(catalogue, areaId);
    if (options.write) {
      writeFileSync(file, rendered);
      report.note(`wrote ${catalogue.areas[areaId].file}`);
    } else if (!existsSync(file) || readFileSync(file, 'utf8') !== rendered) {
      report.problem({ file: catalogue.areas[areaId].file, rule: 'reference-stale', message: existsSync(file) ? 'differs from the catalogue' : 'is missing', fix: 'Edit assets/known-failures.json (never the reference), then run check-catalogue.mjs --write.' });
    }
  }
  if (!options.catalogue) {
    const ids = new Set(catalogue.entries.map((entry) => entry.id));
    for (const pitfall of PITFALLS) {
      if (!ids.has(pitfall.id)) report.problem({ file: 'scripts/lib/pitfalls.mjs', rule: 'pitfall-id', message: `pitfall rule ${pitfall.id} has no catalogue entry`, fix: 'Add the entry to assets/known-failures.json or fix the rule id.' });
    }
  }
  return report.finish({ checked: catalogue.entries.length, unit: 'entries' });
});
