#!/usr/bin/env node
// check-root-imports.mjs: proves that references/host-architecture.md's table "Where each import of
// the root comes from" lists every @e07/ file that this skill's composition-root templates
// (templates/packages/shell/src/app/, the root files and their tests) import, with its owner skill
// and a Shell step no later than 7, when the root lands. A file the table leaves out is what sent a
// clean-room builder through 81 TS2307 errors at Shell step 7 (round 4, R4S-G06).
// Run: node ${CLAUDE_SKILL_DIR}/scripts/check-root-imports.mjs [skill-dir]   (default: this skill)

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createReporter, parseArgs, requireDir, run } from './check-lib.mjs';

const SPEC = {
  name: 'check-root-imports',
  summary: "Checks that host-architecture.md's root import table lists every @e07/ import of the composition-root templates, each with its owner skill and a Shell step no later than 7.",
  usage: '[skill-dir]',
  options: {
    json: { type: 'boolean', help: 'Also print the problems as one JSON line before the RESULT line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'Rules: root-import-unlisted (a root template imports a file the table leaves out),',
    '  root-table-stale (a row names a file no root template imports), root-import-late (a row',
    '  brings a file after Shell step 7, when the root that imports it is copied).',
    'Reads <skill-dir>/references/host-architecture.md and <skill-dir>/templates/packages/shell/src/app/*.ts(x).',
  ].join('\n'),
};

const HEADING = 'Where each import of the root comes from';
const ROOT_STEP = 7;
const TABLE = 'references/host-architecture.md';
const APP = 'templates/packages/shell/src/app';

/** The table rows after the heading line: file (repo path) -> { step, skill, line }. */
function tableRows(markdown) {
  const lines = markdown.split('\n');
  const start = lines.findIndex((line) => line.startsWith(HEADING));
  if (start === -1) return null;
  const rows = new Map();
  let index = start + 1;
  while (index < lines.length && !lines[index].startsWith('|')) index += 1;
  for (; index < lines.length && lines[index].startsWith('|'); index += 1) {
    const cells = lines[index].split('|').slice(1, -1).map((cell) => cell.trim());
    const step = Number(cells[0]);
    if (!Number.isInteger(step)) continue;
    for (const match of cells[2].matchAll(/`([^`]+)`/g)) rows.set(`packages/shell/src/${match[1]}`, { step, skill: cells[1], line: index + 1 });
  }
  return rows;
}

/** Every @e07/ import of the root templates: repo path -> the template files that import it. */
function rootImports(appDir) {
  const imports = new Map();
  for (const file of readdirSync(appDir).filter((name) => /\.tsx?$/.test(name)).sort()) {
    const source = readFileSync(join(appDir, file), 'utf8');
    for (const match of source.matchAll(/\bfrom\s+'(@e07\/(shell|game-kit|tooling)\/[^']+)'/g)) {
      const rel = match[1].replace(/^@e07\/(shell|game-kit|tooling)\//, 'packages/$1/src/');
      if (!imports.has(rel)) imports.set(rel, []);
      imports.get(rel).push(file);
    }
  }
  return imports;
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const skillDir = requireDir(positionals[0] ?? join(dirname(fileURLToPath(import.meta.url)), '..'), 'skill folder');
  const appDir = requireDir(join(skillDir, APP), 'composition-root templates');
  const tablePath = join(skillDir, TABLE);
  const report = createReporter({ name: 'check-root-imports', json: options.json });
  if (!existsSync(tablePath)) {
    report.problem({ file: TABLE, rule: 'root-import-unlisted', message: 'the reference is missing', fix: 'Restore references/host-architecture.md with its root import table.' });
    return report.finish({ checked: 0, unit: 'imports' });
  }
  const rows = tableRows(readFileSync(tablePath, 'utf8'));
  if (rows === null) {
    report.problem({ file: TABLE, rule: 'root-import-unlisted', message: `has no "${HEADING}" table`, fix: 'Restore the table: one row per Shell step and owner skill, the files in backticks under packages/shell/src/.' });
    return report.finish({ checked: 0, unit: 'imports' });
  }
  const imports = rootImports(appDir);
  for (const [rel, files] of imports) {
    if (!rows.has(rel)) report.problem({ file: `${APP}/${files[0]}`, rule: 'root-import-unlisted', message: `imports ${rel}, which the root import table does not list`, fix: `Add it to ${TABLE}'s table under its owner skill and the Shell step at which pocket-arcade-index's manifest copies it (at most ${ROOT_STEP}).` });
  }
  for (const [rel, row] of rows) {
    if (!imports.has(rel)) report.problem({ file: TABLE, line: row.line, rule: 'root-table-stale', message: `lists ${rel}, which no root template imports`, fix: 'Remove it from the row (the table lists exactly what the root imports).' });
    if (row.step > ROOT_STEP) report.problem({ file: TABLE, line: row.line, rule: 'root-import-late', message: `${rel} arrives at Shell step ${row.step}, after the root (step ${ROOT_STEP}) imports it`, fix: 'Move the file to an earlier step in the index manifest, or keep the root from importing it.' });
  }
  return report.finish({ checked: imports.size, unit: 'imports' });
});
