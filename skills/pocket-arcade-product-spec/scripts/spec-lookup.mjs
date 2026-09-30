#!/usr/bin/env node
// spec-lookup.mjs: prints the exact spec text for IDs such as S9, N3, 8.3, D4 or line-siege,
// so a test title, code comment or commit body can quote the spec instead of paraphrasing it.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/spec-lookup.mjs S9 8.3        (or --list for every ID)

import { readFileSync } from 'node:fs';

import { createReporter, parseArgs, requireFile, run, UsageError } from './check-lib.mjs';
import { loadEntries, normalizeId } from './lib/spec-ids.mjs';

const SPEC = {
  name: 'spec-lookup',
  summary: 'Prints the spec entry (from this skill\'s references) for each ID, and fails on IDs that do not exist.',
  usage: '[options] <id...>',
  options: {
    from: { type: 'string', value: 'file', help: 'Read the IDs from a file (separated by spaces, commas or new lines)' },
    list: { type: 'boolean', help: 'List every known ID with its title instead of printing entries' },
    brief: { type: 'boolean', help: 'Print only the heading line of each entry' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line before the RESULT line' },
  },
  positionals: { min: 0, max: Infinity },
  details: [
    'IDs:',
    '  N1-N12          non-negotiables              S1-S15, S11a-S11d  screens',
    '  0-17, 1.1, 8.3  spec sections                D1-D9              open decisions',
    '  line-siege ...  catalogue game ids      line-siege-rules  a game\'s complete v1 rules sheet',
    '"spec 8.3", "section 13" and lowercase forms are accepted.',
    '',
    'Rule:',
    '  unknown-spec-id  the ID is not in the spec (a typo, or a screen/section that does not exist)',
    '',
    'Examples:',
    '  node spec-lookup.mjs S9 8.3 N3',
    '  node spec-lookup.mjs --list',
  ].join('\n'),
};

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const entries = loadEntries();
  const report = createReporter({ name: 'spec-lookup', json: options.json });
  if (options.list) {
    for (const entry of entries) console.log(`${entry.id.padEnd(12)} ${entry.kind.padEnd(15)} ${entry.title}  (${entry.file}:${entry.line})`);
    return report.finish({ checked: entries.length, unit: 'spec IDs' });
  }
  const raw = [...positionals];
  if (options.from) raw.push(...readFileSync(requireFile(options.from, 'ID file'), 'utf8').split(/[\s,]+/));
  const ids = raw.map((text) => text.trim()).filter((text) => text && !/^spec$/i.test(text) && !/^sections?$/i.test(text));
  if (ids.length === 0) throw new UsageError('no IDs given', 'Pass IDs such as S9 8.3 N3, or --list to see every ID.');
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  for (const rawId of ids) {
    const id = normalizeId(rawId);
    const entry = byId.get(id);
    if (!entry) {
      report.problem({ file: options.from ?? '', rule: 'unknown-spec-id', message: `"${rawId}" is not a spec ID`, fix: 'Check the ID with --list; screens are S1-S15 and S11a-S11d, non-negotiables N1-N12, decisions D1-D9, sections 0-17 (8.1-8.14, 7.1-7.6).' });
      continue;
    }
    console.log(`== ${entry.id} · ${entry.title}  (${entry.file}:${entry.line})`);
    if (!options.brief) console.log(`${entry.text.split('\n').slice(1).join('\n').trim()}\n`);
  }
  return report.finish({ checked: ids.length, unit: 'IDs' });
});
