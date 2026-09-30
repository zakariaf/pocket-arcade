#!/usr/bin/env node
// check-staleness.mjs: reports skill files whose project sources changed since they were copied
// (sources.json holds each source's sha256 at copy time).

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_SKILLS_ROOT, LIB_DIR } from './lib/library.mjs';
import { readSources } from './lib/sources.mjs';
import { UsageError, createReporter, parseArgs, run, sha256, walk } from './shared/scripts/check-lib.mjs';

const SPEC = {
  name: 'check-staleness',
  summary: 'Compares each source recorded in sources.json with the project file today. A changed or deleted source means the skill file copied from it may be out of date: re-copy the knowledge, then re-run record-sources.mjs.',
  usage: '[options] [skill...]',
  options: {
    root: { type: 'string', value: 'dir', help: 'Repo root (default: the parent of skills/)' },
    sources: { type: 'string', value: 'file', help: 'The sources file (default: skills/_library/sources.json)' },
    strict: { type: 'boolean', help: 'Also fail when a skill has references/ files with no recorded sources' },
  },
  positionals: { min: 0, max: Infinity },
};

function skillDirFor(skillsRoot, skill) {
  if (skill === '_library') return join(skillsRoot, '_library');
  if (skill === 'skill-template') return join(skillsRoot, '_library', 'skill-template');
  return join(skillsRoot, skill);
}

async function main() {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const root = resolve(options.root ?? dirname(DEFAULT_SKILLS_ROOT));
  const skillsRoot = join(root, 'skills');
  const sourcesPath = resolve(options.sources ?? join(LIB_DIR, 'sources.json'));
  if (!existsSync(sourcesPath)) throw new UsageError(`no sources file at ${sourcesPath}`, 'Record sources with record-sources.mjs first.');
  const data = readSources(sourcesPath);
  const skills = positionals.length ? positionals : Object.keys(data.skills).sort();
  for (const skill of positionals) if (!data.skills[skill]) console.log(`note  ${skill}: no sources recorded`);
  const report = createReporter({ name: 'check-staleness' });
  let checked = 0;
  const staleSkills = new Set();
  for (const skill of skills) {
    const files = data.skills[skill] ?? {};
    const skillDir = skillDirFor(skillsRoot, skill);
    let skillProblems = 0;
    if (!existsSync(skillDir)) {
      report.problem({ file: `skills/${skill}`, rule: 'unknown-skill', message: 'is recorded in sources.json but the folder does not exist', fix: 'Remove the entry from sources.json, or restore the skill.' });
      staleSkills.add(skill);
      continue;
    }
    for (const [file, entry] of Object.entries(files)) {
      if (!existsSync(join(skillDir, file))) {
        report.problem({ file: `${skill}/${file}`, rule: 'missing-copy', message: 'is recorded in sources.json but does not exist', fix: 'Remove the entry from sources.json, or restore the file.' });
        skillProblems += 1;
        continue;
      }
      for (const source of entry.sources) {
        checked += 1;
        const abs = join(root, source.path);
        if (!existsSync(abs)) {
          report.problem({ file: `${skill}/${file}`, rule: 'missing-source', message: `source ${source.path} (recorded ${entry.recorded}) no longer exists`, fix: 'Find where that knowledge moved, re-copy it, then run record-sources.mjs for this file.' });
          skillProblems += 1;
        } else if (sha256(readFileSync(abs)) !== source.sha256) {
          report.problem({ file: `${skill}/${file}`, rule: 'stale-source', message: `source ${source.path} changed since ${entry.recorded}`, fix: `Re-copy the changed knowledge into ${skill}/${file} (for _library shared data: node skills/_library/refresh-shared.mjs), then run record-sources.mjs.` });
          skillProblems += 1;
        }
      }
    }
    if (skillProblems) staleSkills.add(skill);
    console.log(`${skillProblems ? 'STALE' : 'ok   '} ${skill} (${Object.keys(files).length} files${skillProblems ? `, ${skillProblems} problems` : ''})`);
    if (options.strict && skill !== '_library') {
      const refs = existsSync(join(skillDir, 'references')) ? walk(join(skillDir, 'references')).map((rel) => `references/${rel}`) : [];
      for (const rel of refs.filter((path) => !(path in files))) report.problem({ file: `${skill}/${rel}`, rule: 'untracked-reference', message: 'has no recorded sources', fix: 'Run record-sources.mjs for it (or write down that it has no project source).' });
    }
  }
  if (options.strict) {
    const tracked = new Set(Object.keys(data.skills));
    const all = existsSync(skillsRoot) ? readdirSync(skillsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !entry.name.startsWith('_') && !entry.name.startsWith('.')).map((entry) => entry.name) : [];
    for (const skill of all.filter((name) => !tracked.has(name) && (positionals.length === 0 || positionals.includes(name)))) {
      report.problem({ file: `skills/${skill}`, rule: 'untracked-skill', message: 'has no entries in sources.json', fix: 'Record the sources of its references with record-sources.mjs.' });
    }
  }
  if (staleSkills.size) console.log(`stale skills: ${[...staleSkills].join(', ')}`);
  return report.finish({ checked, unit: 'sources' });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run(main);
