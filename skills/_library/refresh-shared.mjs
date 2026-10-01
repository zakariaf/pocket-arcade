#!/usr/bin/env node
// refresh-shared.mjs: re-imports the shared data files (Toybox tokens, copy deck) from the project
// into skills/_library/shared/, rewriting the few provenance strings that name project files so
// the copies pass the self-containment rule, and records their sources in sources.json.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_SKILLS_ROOT, LIB_DIR } from './lib/library.mjs';
import { localDay, readSources, updateSourcesLocked } from './lib/sources.mjs';
import { findProjectRefs } from './validate-skills.mjs';
import { UsageError, createReporter, parseArgs, run, sha256 } from './shared/scripts/check-lib.mjs';

/** Project file -> shared copy. */
export const IMPORTS = [
  { source: 'design/toybox/tokens.json', dest: 'shared/toybox-tokens.json' },
  { source: 'design/shared/copy-deck.json', dest: 'shared/copy-deck.json' },
];

/** Provenance rewrites, applied in order to the raw JSON text. */
export const REWRITES = [
  [/design\/toybox\.html/g, 'the Toybox HTML mockup'],
  [/docs\/(\d{2})-([a-z0-9-]+)\.md/g, (_match, chapter, slug) => `handbook chapter ${chapter} (${slug.replace(/-/g, ' ')})`],
  [/docs\/(\d{2})\b/g, 'handbook chapter $1'],
  [/spec\.txt/g, 'the product spec'],
];

const SPEC = {
  name: 'refresh-shared',
  summary: 'Copies design/toybox/tokens.json and design/shared/copy-deck.json into skills/_library/shared/ (as toybox-tokens.json and copy-deck.json). Strings that name project files are rewritten ("docs/18" becomes "handbook chapter 18"); everything else is byte-for-byte the same. Then records the sources in sources.json. Run sync-shared.mjs afterwards.',
  usage: '[options]',
  options: {
    root: { type: 'string', value: 'dir', help: 'Repo root (default: the parent of skills/)' },
    check: { type: 'boolean', help: 'Change nothing; exit 1 when a shared copy differs from a fresh import' },
  },
  positionals: { min: 0, max: 0 },
};

export function sanitize(text) {
  let out = text;
  for (const [pattern, replacement] of REWRITES) out = out.replace(pattern, replacement);
  return out;
}

function leftovers(value, path = '$', found = []) {
  if (typeof value === 'string') {
    for (const ref of findProjectRefs(value)) found.push(`${path}: ${ref.what}`);
  } else if (Array.isArray(value)) value.forEach((item, index) => leftovers(item, `${path}[${index}]`, found));
  else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) leftovers(item, `${path}.${key}`, found);
  return found;
}

async function main() {
  const { options } = parseArgs(process.argv.slice(2), SPEC);
  const root = resolve(options.root ?? dirname(DEFAULT_SKILLS_ROOT));
  const report = createReporter({ name: 'refresh-shared' });
  const sourcesPath = join(LIB_DIR, 'sources.json');
  const sources = readSources(sourcesPath);
  let changed = false;
  const recorded = {};
  for (const item of IMPORTS) {
    const sourcePath = join(root, item.source);
    if (!existsSync(sourcePath)) throw new UsageError(`source ${item.source} not found under ${root}`, 'Pass --root <repo root>.');
    const raw = readFileSync(sourcePath, 'utf8');
    const clean = sanitize(raw);
    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (error) {
      report.problem({ file: item.source, rule: 'shared-import', message: `not valid JSON after rewriting: ${error.message}`, fix: 'Fix the source JSON or the REWRITES table in refresh-shared.mjs.' });
      continue;
    }
    const left = leftovers(parsed);
    for (const message of left) report.problem({ file: item.source, rule: 'shared-import', message: `still names a project file after rewriting: ${message}`, fix: 'Add a rewrite for it to REWRITES in refresh-shared.mjs.' });
    if (left.length) continue;
    const destPath = join(LIB_DIR, item.dest);
    const current = existsSync(destPath) ? readFileSync(destPath, 'utf8') : null;
    if (current === clean) {
      console.log(`ok    ${item.dest} (up to date with ${item.source})`);
    } else if (options.check) {
      report.problem({ file: `_library/${item.dest}`, rule: 'shared-stale', message: `differs from a fresh import of ${item.source}`, fix: 'Run: node skills/_library/refresh-shared.mjs, then sync-shared.mjs.' });
      continue;
    } else {
      writeFileSync(destPath, clean);
      changed = true;
      const rewritten = raw.split('\n').filter((line, index) => line !== clean.split('\n')[index]).length;
      console.log(`copy  ${item.source} -> ${item.dest} (${rewritten} lines rewritten)`);
    }
    if (!options.check) {
      sources.skills._library ??= {};
      const previous = sources.skills._library[item.dest];
      const hash = sha256(readFileSync(sourcePath));
      if (!previous || previous.sources.length !== 1 || previous.sources[0].sha256 !== hash || previous.sources[0].path !== item.source) {
        recorded[item.dest] = { recorded: localDay(), sources: [{ path: item.source, sha256: hash }] };
        changed = true;
      }
    }
  }
  if (changed && !options.check && Object.keys(recorded).length > 0) {
    // Locked like record-sources: re-read under sources.json.lock and change only the _library entries.
    updateSourcesLocked(sourcesPath, (data) => {
      data.skills._library ??= {};
      Object.assign(data.skills._library, recorded);
    }, { holder: 'refresh-shared' });
    console.log('Recorded the sources in sources.json. Next: node skills/_library/sync-shared.mjs');
  }
  return report.finish({ checked: IMPORTS.length, unit: 'shared files' });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run(main);
