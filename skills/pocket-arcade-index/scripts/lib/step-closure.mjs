// step-closure.mjs: the build-order contract behind check-index's step-import-closure rule.
// Every Shell step (and every step of an extra order that copies files) says what it copies
// ({ skill, paths }) and installs ({ package, companions }). This module finds each copied file's
// template by its line-1 repo path in the owner skill's templates/ or examples/, then proves, step by
// step, that every relative and @e07/... import resolves to a file copied at that step or earlier,
// that every npm import is installed by then, and that every copied file brings its test (or the
// device-only marker) in the same step. Not an entry point.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { join, posix, relative } from 'node:path';

import { globToRegExp, maskComments, toPosix } from '../check-lib.mjs';

/** The pilot game: __GAME_ID__ and __APP_ID__ in template paths and imports stand for it. */
export const PILOT_ID = 'line-siege';
const CODE = /\.(ts|tsx|js|mjs|cjs)$/;
const TEST = /\.(test|golden\.test|sim\.test|perf\.test)\.(ts|tsx)$/;
const REPO_ROOTS = /^(packages|apps|test|__mocks__|parity|perf-baselines)\//;
const LINE_ONE = /^\s*(?:\/\/|#|\/\*|<!--)\s*((?:packages|apps|test|__mocks__|parity|scripts)\/[^\s*]+|[A-Za-z_][\w.-]*\.(?:js|cjs|mjs|ts|json|yml|yaml))(?=\s|\*\/|-->|$)/;
const BUILTINS = new Set(builtinModules.flatMap((name) => [name, `node:${name}`]));
const RUNTIME_EXPORT = /^export\s+(?:async\s+)?function\b|^export\s+(?:abstract\s+)?class\b|^export\s+const\s+\w+\s*(?::[^=\n]+)?=\s*(?:async\s*)?(?:<[^>]*>\s*)?(?:\([^)]*\)|\w+)\s*(?::[^=\n]+)?=>|^export\s+const\s+\w+\s*=\s*(?:async\s+)?function\b|^export\s+const\s+\w+\s*(?::[^=\n]+)?=\s*[A-Za-z_$][\w$]*\s*(?:<[^>]*>)?\(/m;

const pilot = (text) => text.replaceAll('__GAME_ID__', PILOT_ID).replaceAll('__APP_ID__', PILOT_ID);

function walkFiles(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.DS_Store') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(path, out);
    else if (entry.isFile()) out.push(path);
  }
  return out;
}

/**
 * The repo path a template stands for: its line-1 comment (`// packages/shell/src/x.ts`), else its
 * path under templates/ when that already is a repo path (templates/packages/..., or templates/repo/...
 * for the bootstrap's tree). Returns null for prose, samples and anything else that is not copied.
 */
export function templateRepoPath(skillDir, file) {
  const rel = toPosix(relative(skillDir, file));
  let first = '';
  try {
    first = readFileSync(file, 'utf8').slice(0, 400).split('\n')[0];
  } catch {
    first = '';
  }
  const raw = (path) => path.replaceAll('__APP_ID__', '__GAME_ID__');
  const named = LINE_ONE.exec(first);
  if (named) return raw(named[1]);
  const example = /^examples\/line-siege\/(.+)$/.exec(rel);
  if (example) return pilotExamplePath(example[1]);
  if (!rel.startsWith('templates/')) return null;
  const under = rel.slice('templates/'.length).replace(/^repo\//, '').replace(/(^|\/)dot-([^/]+)$/, '$1.$2');
  if (REPO_ROOTS.test(under)) return raw(under);
  if (!under.includes('/') && /^(package\.json|tsconfig[\w.]*\.json|knip\.json|quality-gates\.json|stryker\.config\.json|lefthook\.yml|\.[\w.-]+)$/.test(under)) return under;
  return null;
}

/**
 * Line Siege's canonical example files mirror the pilot app: a data file without a line-1 path
 * (catalogs, palettes, packs, golden PNGs, the sim bands and report) maps by its folder.
 */
function pilotExamplePath(rest) {
  if (/^(apps|test|reports)\//.test(rest)) return rest;
  if (rest.startsWith('goldens/')) return `test/goldens/boards/__image_snapshots__/${rest.slice('goldens/'.length)}`;
  if (/^(board|rules|levels|testing|i18n|tutorial|sounds|art)\//.test(rest)) return `apps/${PILOT_ID}/src/${rest}`;
  return null;
}

/**
 * skill -> Map(repo path -> { file, raw, placeholder }), from templates/ and examples/ (tests/ is never
 * read). A template whose path holds __GAME_ID__ (a new game's template, such as the Tap Flip files)
 * stands for the pilot's path only when a copy names __GAME_ID__ itself; a literal path (Line Siege's
 * canonical files) always wins over it.
 */
export function indexTemplates(skillsRoot, skillNames) {
  const bySkill = new Map();
  for (const skill of skillNames) {
    const dir = join(skillsRoot, skill);
    const map = new Map();
    for (const sub of ['templates', 'examples']) {
      for (const file of walkFiles(join(dir, sub)).sort()) {
        const raw = templateRepoPath(dir, file);
        if (!raw) continue;
        const placeholder = raw.includes('__GAME_ID__');
        const path = pilot(raw);
        const taken = map.get(path);
        if (!taken || (taken.placeholder && !placeholder)) map.set(path, { file, raw, placeholder });
      }
    }
    bySkill.set(skill, map);
  }
  return bySkill;
}

/** Whether a copy glob takes a template: placeholder templates only for globs that name __GAME_ID__. */
function copyMatches(entry, path, glob) {
  if (entry.placeholder) return glob.includes('__GAME_ID__') && globMatch(path, glob);
  return !glob.includes('__GAME_ID__') && globMatch(path, glob);
}

/** The [start, end) spans of every string and template literal in comment-free code. */
function stringSpans(code) {
  const spans = [];
  let i = 0;
  while (i < code.length) {
    const ch = code[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1;
      while (j < code.length && code[j] !== ch) {
        if (code[j] === '\\') j += 1;
        else if (ch !== '`' && code[j] === '\n') break;
        j += 1;
      }
      spans.push([i, j + 1]);
      i = j + 1;
      continue;
    }
    i += 1;
  }
  return spans;
}

/**
 * Every module specifier a JS/TS file imports: static imports and re-exports (a statement that starts
 * a line), side-effect imports, dynamic import() and require(). Text inside a string or template
 * literal (generated code, test fixtures) is not an import.
 */
export function importsOf(text) {
  const code = maskComments(pilot(text));
  const spans = stringSpans(code);
  const inString = (index) => spans.some(([from, to]) => index > from && index < to);
  const found = [];
  const patterns = [
    /^[ \t]*(?:import|export)\s+(?:type\s+)?[^'";]*?\bfrom\s*(['"])([^'"\n]+)\1/gm,
    /^[ \t]*import\s*(['"])([^'"\n]+)\1/gm,
    /\bimport\(\s*(['"])([^'"\n]+)\1\s*\)/g,
    /\brequire\(\s*(['"])([^'"\n]+)\1\s*\)/g,
  ];
  for (const re of patterns) {
    for (const match of code.matchAll(re)) {
      const keyword = match.index + match[0].search(/\S/);
      if (!inString(keyword)) found.push(match[2]);
    }
  }
  return [...new Set(found)];
}

/** The npm package of a bare specifier ('@scope/name/sub' -> '@scope/name'), or null for paths and built-ins. */
export function packageOf(specifier) {
  if (specifier.startsWith('.') || specifier.startsWith('/') || BUILTINS.has(specifier) || BUILTINS.has(specifier.split('/')[0])) return null;
  if (specifier.startsWith('node:')) return null;
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

/** The repo path an import names, for relative and workspace (@e07/...) imports; null for npm packages. */
export function resolveImport(fromRepoPath, specifier) {
  if (specifier.startsWith('.')) return posix.normalize(posix.join(posix.dirname(fromRepoPath), specifier));
  const workspace = /^@e07\/([a-z0-9-]+)\/(.+)$/.exec(specifier);
  if (!workspace) return null;
  const [, name, rest] = workspace;
  if (name === 'shell' && rest.startsWith('plugins/')) return `packages/shell/${rest}`;
  if (['shell', 'game-kit', 'tooling'].includes(name)) return `packages/${name}/src/${rest}`;
  return `apps/${name}/src/${rest}`;
}

/** The present file an import resolves to, trying the extension-less forms the bundler accepts. */
function presentTarget(target, isPresent) {
  const candidates = CODE.test(target) || /\.[a-z0-9]+$/i.test(target) ? [target] : [];
  candidates.push(`${target}.ts`, `${target}.tsx`, `${target}/index.ts`, `${target}/index.tsx`);
  return candidates.find(isPresent) ?? null;
}

const globCache = new Map();
function globMatch(path, glob) {
  if (!globCache.has(glob)) globCache.set(glob, globToRegExp(pilot(glob).replace(/\/$/, '/**')));
  return globCache.get(glob).test(path);
}

/** The positions of an order's steps: { key, label, number, copies, installs, generates, skills }. */
function orderSteps(steps, prefix) {
  const out = [];
  steps.forEach((step, index) => {
    const number = index + 1;
    out.push({ key: `${prefix}${number}`, label: `step ${number}`, step, number, copies: step.copies ?? [], installs: step.installs ?? [], generates: step.generates ?? [], skills: step.skills });
    (step.screens ?? []).forEach((screen) => {
      out.push({ key: `${prefix}${number}.${screen.screen}`, label: `step ${number} (${screen.screen})`, step, number, copies: screen.copies ?? [], installs: screen.installs ?? [], generates: screen.generates ?? [], skills: step.skills, screen: screen.screen });
    });
  });
  return out;
}

/** True when the data describes copies for an order (otherwise the closure check has nothing to do). */
export const hasManifests = (steps) => steps.some((step) => (step.copies ?? []).length > 0 || (step.screens ?? []).length > 0);

function readText(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

/** package names a copied package.json template installs (dependencies and devDependencies; peers are not installs). */
function packageJsonInstalls(file) {
  try {
    const data = JSON.parse(readText(file));
    return [...Object.keys(data.dependencies ?? {}), ...Object.keys(data.devDependencies ?? {})];
  } catch {
    return [];
  }
}

/**
 * Plays an order step by step. A copy event is { path, index, position, skill, file, importsLater }:
 * the first event of a path makes it present from its step on; a swap adds a later event whose own
 * imports are checked from its step (the phase-0 with-shell.ts at step 1, the final one at step 8).
 * Returns { problems: [{ where, kind, message, fix }], positions, sequence, events } with positions =
 * path -> first event, sequence = every step position in order, events = every copy event (swaps too).
 */
export function checkOrder({ title, steps, base = [], templates, companionsOf }) {
  const problems = [];
  const sequence = [...base.map((position) => ({ ...position, inherited: true })), ...orderSteps(steps, `${title}:`).map((position) => ({ ...position, inherited: false }))];
  const firstCopy = new Map(); // repo path -> the first copy event
  const events = []; // every copy event, swaps included
  const installedAt = new Map(); // package -> index
  const generated = []; // { index, glob }
  const allTemplates = new Map(); // repo path -> [skills]
  for (const [skill, map] of templates) for (const [path, entry] of map) if (!entry.placeholder) allTemplates.set(path, [...(allTemplates.get(path) ?? []), skill]);

  sequence.forEach((position, index) => {
    const where = `${position.inherited ? `${position.order} ` : ''}${position.label}`;
    for (const copy of position.copies) {
      const map = templates.get(copy.skill);
      if (!map) {
        if (!position.inherited) problems.push({ where, kind: 'manifest', message: `${where} copies from ${copy.skill}, which is not a skill`, fix: 'Name the skill whose templates/ hold the files.' });
        continue;
      }
      if (!position.inherited && !position.skills.includes(copy.skill)) problems.push({ where, kind: 'manifest', message: `${where} copies from ${copy.skill}, which the step does not load`, fix: `Add ${copy.skill} to the step's skills, so its rules and checks apply to the files it brings.` });
      for (const glob of copy.paths) {
        const matched = [...map.keys()].filter((path) => copyMatches(map.get(path), path, glob) && !(copy.exclude ?? []).some((ex) => globMatch(path, ex)));
        if (matched.length === 0 && !position.inherited) problems.push({ where, kind: 'manifest', message: `${where} copies ${glob} from ${copy.skill}, which has no template with that repo path`, fix: `Use the repo path on line 1 of a template in ${copy.skill}'s templates/ or examples/ (a new game's template path keeps __GAME_ID__), or remove the entry.` });
        for (const path of matched) {
          if (firstCopy.has(path) && !copy.swap) continue;
          const event = { path, index, position, skill: copy.skill, file: map.get(path).file, importsLater: copy.importsLater ?? [], deferredTests: copy.deferredTests ?? [], swap: copy.swap === true };
          if (!firstCopy.has(path)) firstCopy.set(path, event);
          events.push(event);
          if (path.endsWith('package.json')) for (const name of packageJsonInstalls(event.file)) if (!installedAt.has(name)) installedAt.set(name, index);
        }
      }
    }
    for (const install of position.installs) {
      for (const name of [install.package, ...(install.companions ?? [])]) if (!installedAt.has(name)) installedAt.set(name, index);
      const expected = companionsOf?.(install.package) ?? [];
      const missing = expected.filter((name) => !(install.companions ?? []).includes(name));
      if (missing.length > 0 && !position.inherited) problems.push({ where, kind: 'manifest', message: `${where} installs ${install.package} without its companion${missing.length > 1 ? 's' : ''} ${missing.join(', ')} (dependency-management's plan lists ${missing.length > 1 ? 'them' : 'it'})`, fix: `Add ${missing.map((name) => `"${name}"`).join(', ')} to that install's companions.` });
    }
    for (const gen of position.generates) for (const glob of gen.paths) generated.push({ index, glob });
  });

  const presentAt = (path, index) => {
    const copied = firstCopy.get(path);
    if (copied && copied.index <= index) return true;
    return generated.some((gen) => gen.index <= index && globMatch(path, gen.glob));
  };
  const resolveAt = (target, index) => presentTarget(target, (candidate) => presentAt(candidate, index));
  const known = (target) => presentTarget(target, (candidate) => firstCopy.has(candidate) || allTemplates.has(candidate) || generated.some((gen) => globMatch(candidate, gen.glob)));
  const importsCache = new Map();
  const importsOfFile = (file) => {
    if (!importsCache.has(file)) importsCache.set(file, importsOf(readText(file)));
    return importsCache.get(file);
  };

  // 1. Imports: every relative and @e07/ import is present by the copying step, every npm import installed.
  const own = events.filter((event) => !event.position.inherited).sort((a, b) => a.index - b.index || (a.path < b.path ? -1 : 1));
  for (const event of own) {
    if (!CODE.test(event.path) || event.path.endsWith('.d.ts')) continue;
    const { path, index: at, skill } = event;
    const where = event.position.label;
    const later = (glob, value) => event.importsLater.some((pattern) => globMatch(value, pattern) || pattern === glob);
    for (const specifier of importsOfFile(event.file)) {
      const target = resolveImport(path, specifier);
      if (target === null) {
        const name = packageOf(specifier);
        if (name === null || name.startsWith('@e07/')) continue;
        const when = installedAt.get(name);
        if (when !== undefined && when <= at) continue;
        if (later(name, name) && when !== undefined) continue;
        const status = when === undefined ? 'no step installs it' : `${sequence[when].label} installs it`;
        problems.push({ where, kind: 'closure', message: `${path} (${where}, ${skill}) imports the npm package ${name}, which is not installed by then: ${status}`, fix: `Install ${name} (with its companions, from plan-dependency.mjs of dependency-management) in the installs of the step that first copies an importer.` });
        continue;
      }
      if (resolveAt(target, at)) continue;
      const candidate = known(target);
      const first = candidate ? firstCopy.get(candidate) : null;
      if (later(candidate ?? target, candidate ?? target)) {
        if (first || (candidate && generated.some((gen) => globMatch(candidate, gen.glob)))) continue;
        problems.push({ where, kind: 'closure', message: `${path} (${where}, ${skill}) waits for ${candidate ?? target} (importsLater), which no step of this order copies`, fix: `Copy ${candidate ?? target} at the step that builds it, or drop it from importsLater.` });
      } else if (first && first.index > at) {
        problems.push({ where, kind: 'closure', message: `${path} (${where}, ${skill}) imports ${candidate}, which ${first.position.label} copies (${first.skill})`, fix: `Copy ${candidate} at ${where} or earlier (with its test), or move ${path} to ${first.position.label}.` });
      } else if (candidate && allTemplates.has(candidate)) {
        problems.push({ where, kind: 'closure', message: `${path} (${where}, ${skill}) imports ${candidate}, which no step copies (template in ${allTemplates.get(candidate).join(', ')})`, fix: `Add ${candidate} to the copies of ${where} or an earlier step, from its owner skill.` });
      } else if (candidate) {
        problems.push({ where, kind: 'closure', message: `${path} (${where}, ${skill}) imports ${candidate}, which a later step generates`, fix: `Generate ${candidate} at ${where} or earlier, or move ${path} to the step that generates it.` });
      } else {
        problems.push({ where, kind: 'closure', message: `${path} (${where}, ${skill}) imports ${target}, which no step copies or generates and no skill has a template for`, fix: 'Name the step that writes it (copies or generates), or fix the import.' });
      }
    }
  }

  // 2. Tests travel with their files: a sibling test template is copied in the same step.
  const firsts = [...firstCopy.values()].filter((event) => !event.position.inherited).sort((a, b) => a.index - b.index || (a.path < b.path ? -1 : 1));
  for (const event of firsts) {
    const { path } = event;
    if (!/\.(ts|tsx)$/.test(path) || TEST.test(path) || path.endsWith('.d.ts')) continue;
    const stem = path.replace(/\.(ts|tsx)$/, '');
    // A phase-0 file swapped later gets its test with the swap (ads-config.ts, with-shell.ts).
    const swaps = events.filter((other) => other.path === path && other.swap && other !== event).map((other) => other.index);
    for (const test of [`${stem}.test.ts`, `${stem}.test.tsx`].filter((candidate) => allTemplates.has(candidate) || firstCopy.has(candidate))) {
      const copied = firstCopy.get(test);
      if (copied && copied.index <= event.index) continue;
      if (copied && swaps.includes(copied.index)) continue;
      const deferred = event.deferredTests.find((item) => item.test === test);
      if (deferred && copied) continue;
      problems.push({
        where: event.position.label,
        kind: 'closure',
        message: copied ? `${path} (${event.position.label}, ${event.skill}) arrives without its test: ${copied.position.label} copies ${test}` : `${path} (${event.position.label}, ${event.skill}) arrives without its test ${test}, which no step copies (template in ${(allTemplates.get(test) ?? []).join(', ')})`,
        fix: `Copy ${test} in the same step as ${path}; when the test needs a file of a later step (renderWithShell, the theme, start-shell.ts), move both to that step.`,
      });
    }
  }

  // 3. Coverage: a counted runtime file whose covering tests only arrive at a later step drops
  //    test:coverage in between (round 4: 89.8 % functions after Shell step 6).
  const counted = (path) => /^(apps\/[^/]+|packages\/(shell|game-kit))\/src\/.+\.(ts|tsx)$/.test(path) && !TEST.test(path) && !path.endsWith('.d.ts') && !/\/(testing|fixtures)\//.test(path) && !/\/fake-[^/]+$/.test(path);
  const reachCache = new Map();
  const reachedAt = (index) => {
    if (reachCache.has(index)) return reachCache.get(index);
    const seen = new Set();
    const stack = [...firstCopy.values()].filter((event) => event.index <= index && TEST.test(event.path)).map((event) => event.path);
    while (stack.length > 0) {
      const path = stack.pop();
      if (seen.has(path)) continue;
      seen.add(path);
      const event = firstCopy.get(path);
      if (!event || !CODE.test(path)) continue;
      for (const specifier of importsOfFile(event.file)) {
        const target = resolveImport(path, specifier);
        if (target === null) continue;
        const hit = resolveAt(target, index);
        if (hit && !seen.has(hit)) stack.push(hit);
      }
    }
    reachCache.set(index, seen);
    return seen;
  };
  const lastIndex = sequence.length - 1;
  for (const event of firsts) {
    const { path } = event;
    if (!counted(path)) continue;
    const text = readText(event.file);
    const head = text.split('\n').slice(0, 6).join('\n');
    if (/\/\/\s*device-only:/.test(head) || /GENERATED by /.test(text.split('\n').slice(0, 3).join('\n'))) continue;
    if (!RUNTIME_EXPORT.test(maskComments(text))) continue;
    if (reachedAt(event.index).has(path) || !reachedAt(lastIndex).has(path)) continue;
    const covering = sequence.findIndex((_, index) => index > event.index && reachedAt(index).has(path));
    problems.push({ where: event.position.label, kind: 'closure', message: `${path} (${event.position.label}, ${event.skill}) has runtime code that only tests of ${sequence[covering].label} reach, so test:coverage drops between the two steps`, fix: `Move ${path} to ${sequence[covering].label} with the test that covers it, or copy that test (and what it needs) at ${event.position.label}.` });
  }
  return { problems, positions: firstCopy, sequence, events };
}

/** The positions an extra order inherits: every step of the Shell order up to `through`. */
export function basePositions(shellSteps, through) {
  return orderSteps(shellSteps.slice(0, through), 'shell:').map((position) => ({ ...position, order: 'Shell' }));
}

/** dependency-management's companion list for a package (installed with it), read from the library when present. */
export function companionReader(skillsRoot) {
  const file = join(skillsRoot, 'dependency-management', 'assets', 'versions.json');
  if (!existsSync(file) || !statSync(file).isFile()) return () => [];
  let table = {};
  try {
    table = JSON.parse(readFileSync(file, 'utf8')).packages ?? {};
  } catch {
    return () => [];
  }
  return (name) => (table[name]?.companions ?? []).filter((companion) => companion.via !== 'overrides').map((companion) => companion.package);
}
