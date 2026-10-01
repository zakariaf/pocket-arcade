#!/usr/bin/env node
// record-sources.mjs: records which project files a skill file was copied from (with their sha256)
// in sources.json, so check-staleness.mjs can report when those sources change.
// Usage: node skills/_library/record-sources.mjs <skill> <skill-file> <source-file>...
// Several sessions may record at once: the write takes sources.json.lock, re-reads the file under
// it, changes only this skill file's entry and replaces the file atomically (lib/sources.mjs).

import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_SKILLS_ROOT, LIB_DIR } from './lib/library.mjs';
import { LOCK_STALE_MS, LOCK_WAIT_MS, localDay, updateSourcesLocked } from './lib/sources.mjs';
import { UsageError, parseArgs, resultLine, run, sha256, toPosix } from './shared/scripts/check-lib.mjs';

const SPEC = {
  name: 'record-sources',
  summary: 'Records that <skill-file> (a file inside the skill) was copied from the given project files, with each source\'s sha256 now. Replaces the file\'s earlier list unless --append is given.',
  usage: '[options] <skill> <skill-file> <source-file>...',
  options: {
    root: { type: 'string', value: 'dir', help: 'Repo root; sources are stored relative to it (default: the parent of skills/)' },
    sources: { type: 'string', value: 'file', help: 'The sources file (default: skills/_library/sources.json)' },
    append: { type: 'boolean', help: 'Add to the file\'s existing source list instead of replacing it' },
    'lock-wait': { type: 'string', value: 'seconds', default: String(LOCK_WAIT_MS / 1000), help: 'How long to wait for another writer\'s lock before stopping with exit 2' },
  },
  positionals: { min: 3, max: Infinity },
  details: [
    '<skill>        a skill folder name in skills/, "skill-template", or "_library" (for the shared folder)',
    '<skill-file>   path inside that skill, e.g. references/tokens.md (a path from the current folder also works)',
    '<source-file>  project files the content was copied from, relative to the repo root or the current folder',
    '',
    'Safe with other writers: the write takes the exclusive lock sources.json.lock, re-reads sources.json',
    'under it, changes only <skill>/<skill-file>\'s entry (so entries other sessions recorded meanwhile stay)',
    'and replaces the file atomically (a temporary file, then a rename). A lock held by another writer is',
    `waited for up to --lock-wait seconds, then the run stops with exit 2 naming the holder; a lock older than`,
    `${LOCK_STALE_MS / 60000} minutes is left over from a crashed writer and is broken with a WARN line.`,
    '',
    'Example:',
    '  node skills/_library/record-sources.mjs toybox-design-system references/tokens.md docs/18-design-system-toybox.md design/toybox/tokens.json',
  ].join('\n'),
};

function inside(parent, child) {
  const rel = relative(parent, child);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

async function main() {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const [skill, skillFileArg, ...sourceArgs] = positionals;
  const root = resolve(options.root ?? dirname(DEFAULT_SKILLS_ROOT));
  const skillsRoot = join(root, 'skills');
  const sourcesPath = resolve(options.sources ?? join(LIB_DIR, 'sources.json'));
  const skillDir = skill === '_library' ? join(skillsRoot, '_library') : skill === 'skill-template' ? join(skillsRoot, '_library', 'skill-template') : join(skillsRoot, skill);
  if (skill.startsWith('_') && skill !== '_library') throw new UsageError(`"${skill}" is not a skill`, 'Use a skill folder name, "skill-template" or "_library".');
  if (!existsSync(skillDir) || !statSync(skillDir).isDirectory()) throw new UsageError(`no skill folder ${toPosix(relative(root, skillDir))}`, 'Create the skill first, or check the name.');
  const fromCwd = resolve(skillFileArg);
  const skillFileAbs = inside(skillDir, fromCwd) && existsSync(fromCwd) ? fromCwd : join(skillDir, skillFileArg);
  if (!inside(skillDir, skillFileAbs)) throw new UsageError(`${skillFileArg} is not inside ${toPosix(relative(root, skillDir))}`, 'Pass a path inside the skill folder.');
  if (!existsSync(skillFileAbs) || !statSync(skillFileAbs).isFile()) throw new UsageError(`${toPosix(relative(root, skillFileAbs))} does not exist`, 'Write the skill file first, then record its sources.');
  const skillFile = toPosix(relative(skillDir, skillFileAbs));
  const sources = sourceArgs.map((arg) => {
    const candidates = [resolve(root, arg), resolve(arg)];
    const abs = candidates.find((path) => existsSync(path) && statSync(path).isFile());
    if (!abs) throw new UsageError(`source ${arg} does not exist (looked in the repo root and the current folder)`, 'Pass a file path relative to the repo root.');
    if (!inside(root, abs)) throw new UsageError(`source ${arg} is outside the repo`, 'Sources must be project files inside the repo.');
    if (inside(skillDir, abs)) throw new UsageError(`source ${arg} is inside the skill itself`, 'Record the project file the content was copied from.');
    return { path: toPosix(relative(root, abs)), sha256: sha256(readFileSync(abs)) };
  });
  const waitSeconds = Number(options['lock-wait']);
  if (!Number.isFinite(waitSeconds) || waitSeconds < 0) throw new UsageError(`--lock-wait ${options['lock-wait']} is not a number of seconds`, 'Pass a number such as 60.');
  const merged = updateSourcesLocked(sourcesPath, (data) => {
    data.skills[skill] ??= {};
    const previous = options.append ? data.skills[skill][skillFile]?.sources ?? [] : [];
    const list = [...previous.filter((item) => !sources.some((source) => source.path === item.path)), ...sources].sort((a, b) => (a.path < b.path ? -1 : 1));
    data.skills[skill][skillFile] = { recorded: localDay(), sources: list };
    return list;
  }, { waitMs: waitSeconds * 1000, holder: `record-sources ${skill}/${skillFile}` });
  for (const source of merged) console.log(`recorded ${skill}/${skillFile} <- ${source.path} (${source.sha256.slice(0, 12)})`);
  console.log(`record-sources: ${merged.length} sources recorded for ${skill}/${skillFile}`);
  console.log(resultLine(0));
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run(main);
