// Shared plumbing for the library tools: where things live, which folders are skills, and the
// assets/shared.json manifest (read, compare, sync). Library-only; skills never import this.

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, posix, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { UsageError, toPosix, walk } from '../shared/scripts/check-lib.mjs';

export const LIB_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DEFAULT_SKILLS_ROOT = resolve(LIB_DIR, '..');
export const MANIFEST_PATH = 'assets/shared.json';

/** Options every library tool accepts (for tests and unusual layouts). */
export const COMMON_OPTIONS = {
  'skills-root': { type: 'string', value: 'dir', help: 'Folder that holds the skill folders and _library/ (default: the parent of this library)' },
  shared: { type: 'string', value: 'dir', help: 'Canonical shared folder (default: <skills-root>/_library/shared)' },
};

export function resolveRoots(options) {
  const skillsRoot = resolve(options['skills-root'] ?? DEFAULT_SKILLS_ROOT);
  if (!existsSync(skillsRoot) || !statSync(skillsRoot).isDirectory()) {
    throw new UsageError(`skills root ${skillsRoot} does not exist`, 'Pass --skills-root <dir> pointing at the skills/ folder.');
  }
  const libDir = join(skillsRoot, '_library');
  const shared = resolve(options.shared ?? join(libDir, 'shared'));
  return { skillsRoot, libDir, shared, template: join(libDir, 'skill-template'), casesDir: join(libDir, 'tests', 'cases') };
}

/** Real skill folders: direct children of skills/ that are folders and do not start with "_" or ".". */
export function listSkillDirs(skillsRoot) {
  return readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => (entry.isDirectory() || entry.isSymbolicLink()) && !entry.name.startsWith('_') && !entry.name.startsWith('.'))
    .map((entry) => ({ name: entry.name, dir: join(skillsRoot, entry.name), kind: 'skill' }))
    .sort((a, b) => (a.name < b.name ? -1 : 1));
}

/** Validator test cases: _library/tests/cases/<case>/<skill-folder>/ with <case>/case.json. */
export function listCaseSkills(casesDir) {
  if (!existsSync(casesDir)) return [];
  const out = [];
  for (const caseEntry of readdirSync(casesDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const caseDir = join(casesDir, caseEntry.name);
    let meta = {};
    try {
      meta = JSON.parse(readFileSync(join(caseDir, 'case.json'), 'utf8'));
    } catch {
      meta = {};
    }
    for (const skillEntry of readdirSync(caseDir, { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
      out.push({ name: skillEntry.name, dir: join(caseDir, skillEntry.name), kind: 'case', caseId: caseEntry.name, meta });
    }
  }
  return out;
}

/**
 * The default target set of a library tool: every skill folder, plus the skill template.
 * With includeCases, also the validator's test-case skills whose case.json does not say "sync": false.
 */
export function defaultTargets(roots, { includeTemplate = true, includeCases = false } = {}) {
  const targets = listSkillDirs(roots.skillsRoot);
  if (includeTemplate && existsSync(join(roots.template, 'SKILL.md'))) targets.push({ name: 'skill-template', dir: roots.template, kind: 'template' });
  if (includeCases) targets.push(...listCaseSkills(roots.casesDir).filter((target) => target.meta.sync !== false));
  return targets;
}

/** Turn command-line skill arguments (names or paths) into targets. */
export function resolveTargets(args, roots) {
  return args.map((arg) => {
    const asPath = resolve(arg);
    const isDir = (path) => existsSync(path) && statSync(path).isDirectory();
    const looksLikePath = arg.includes('/') || arg === '.' || arg === '..';
    if (!looksLikePath && !arg.startsWith('_') && isDir(join(roots.skillsRoot, arg))) {
      return { name: arg, dir: join(roots.skillsRoot, arg), kind: 'skill' };
    }
    if (!looksLikePath && arg === 'skill-template' && isDir(roots.template)) return { name: arg, dir: roots.template, kind: 'template' };
    if (isDir(asPath)) {
      const kind = asPath === roots.template ? 'template' : 'path';
      return { name: kind === 'template' ? 'skill-template' : asPath.split('/').pop(), dir: asPath, kind };
    }
    throw new UsageError(`"${arg}" is not a skill folder name or path`, `Pass a folder name under ${roots.skillsRoot} or a path to a skill folder.`);
  });
}

/** Display name for a target (case skills show their case id). */
export function targetLabel(target) {
  return target.kind === 'case' ? `${target.caseId}/${target.name}` : target.name;
}

// ---------------------------------------------------------------------------------------------
// assets/shared.json
// ---------------------------------------------------------------------------------------------

function badPath(path) {
  return typeof path !== 'string' || path === '' || isAbsolute(path) || path.includes('\\') || path.split('/').includes('..') || path.split('/').includes('.');
}

/**
 * Read and validate a skill's manifest.
 * Format: [ { "from": "<path under the shared folder>", "to": "<path inside the skill>" }, ... ]
 * A folder entry ends both paths with "/" and mirrors the whole folder.
 * Returns { exists, entries, errors: [message] }.
 */
export function readManifest(skillDir, sharedDir) {
  const path = join(skillDir, MANIFEST_PATH);
  if (!existsSync(path)) return { exists: false, entries: [], errors: [] };
  let data;
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    return { exists: true, entries: [], errors: [`not valid JSON: ${error.message}`] };
  }
  if (!Array.isArray(data)) return { exists: true, entries: [], errors: ['must be a JSON array of { "from": ..., "to": ... } objects'] };
  const entries = [];
  const errors = [];
  const seen = new Set();
  data.forEach((item, index) => {
    const at = `entry ${index + 1}`;
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`${at} must be an object with "from" and "to"`);
      return;
    }
    const extra = Object.keys(item).filter((key) => key !== 'from' && key !== 'to');
    if (extra.length) errors.push(`${at} has unknown keys: ${extra.join(', ')}`);
    const { from, to } = item;
    if (badPath(from)) {
      errors.push(`${at}: "from" must be a relative path under the shared folder without "..": ${JSON.stringify(from)}`);
      return;
    }
    if (badPath(to)) {
      errors.push(`${at}: "to" must be a relative path inside the skill without "..": ${JSON.stringify(to)}`);
      return;
    }
    const isDir = from.endsWith('/');
    if (isDir !== to.endsWith('/')) {
      errors.push(`${at}: a folder entry ends both "from" and "to" with "/"; a file entry ends neither`);
      return;
    }
    const src = join(sharedDir, from);
    if (!existsSync(src)) {
      errors.push(`${at}: ${from} does not exist in the shared folder`);
      return;
    }
    if (isDir !== statSync(src).isDirectory()) {
      errors.push(`${at}: ${from} is ${statSync(src).isDirectory() ? 'a folder (end both paths with "/")' : 'a file (remove the trailing "/")'}`);
      return;
    }
    const target = to.replace(/\/$/, '');
    if (target === 'SKILL.md' || target === MANIFEST_PATH || (isDir && MANIFEST_PATH.startsWith(`${target}/`))) {
      errors.push(`${at}: "to" must not overwrite SKILL.md, the assets folder or ${MANIFEST_PATH}`);
      return;
    }
    if (seen.has(target)) {
      errors.push(`${at}: "to" ${to} is used twice`);
      return;
    }
    seen.add(target);
    entries.push({ from, to, isDir });
  });
  return { exists: true, entries, errors };
}

/** Expected files for the manifest: [{ src, rel }] where rel is the path inside the skill. */
export function expandEntries(entries, sharedDir) {
  const files = [];
  for (const entry of entries) {
    if (!entry.isDir) {
      files.push({ src: join(sharedDir, entry.from), rel: entry.to, entry });
      continue;
    }
    for (const rel of walk(join(sharedDir, entry.from), { defaultIgnores: false, ignore: ['.DS_Store'] })) {
      files.push({ src: join(sharedDir, entry.from, rel), rel: posix.join(entry.to, rel), entry });
    }
  }
  return files;
}

function sameBytes(a, b) {
  if (!existsSync(b) || !statSync(b).isFile()) return false;
  const left = readFileSync(a);
  const right = readFileSync(b);
  return left.length === right.length && left.equals(right);
}

/** Compare a skill's copies with the canonical files. Returns [{ rel, kind: 'missing'|'drift'|'extra', from }]. */
export function compareShared(skillDir, entries, sharedDir) {
  const findings = [];
  const expected = expandEntries(entries, sharedDir);
  const expectedRels = new Set(expected.map((file) => file.rel));
  for (const file of expected) {
    const dest = join(skillDir, file.rel);
    if (!existsSync(dest)) findings.push({ rel: file.rel, kind: 'missing', from: toPosix(relative(sharedDir, file.src)) });
    else if (!sameBytes(file.src, dest)) findings.push({ rel: file.rel, kind: 'drift', from: toPosix(relative(sharedDir, file.src)) });
  }
  for (const entry of entries.filter((item) => item.isDir)) {
    const destDir = join(skillDir, entry.to);
    if (!existsSync(destDir)) continue;
    for (const rel of walk(destDir, { defaultIgnores: false, ignore: ['.DS_Store'] })) {
      const full = posix.join(entry.to, rel);
      if (!expectedRels.has(full)) findings.push({ rel: full, kind: 'extra', from: entry.from });
    }
  }
  return findings;
}

/** Copy the canonical files into the skill and remove extra files from mirrored folders. */
export function syncShared(skillDir, entries, sharedDir) {
  const result = { copied: [], unchanged: 0, removed: [] };
  for (const file of expandEntries(entries, sharedDir)) {
    const dest = join(skillDir, file.rel);
    if (sameBytes(file.src, dest)) {
      result.unchanged += 1;
      continue;
    }
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(file.src, dest);
    result.copied.push(file.rel);
  }
  for (const finding of compareShared(skillDir, entries, sharedDir).filter((item) => item.kind === 'extra')) {
    rmSync(join(skillDir, finding.rel), { force: true });
    result.removed.push(finding.rel);
  }
  return result;
}
