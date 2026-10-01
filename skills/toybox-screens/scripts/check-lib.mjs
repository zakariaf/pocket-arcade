// check-lib.mjs: the shared helper every Pocket Arcade skill script imports (Node 22+, zero dependencies).
//
// Do not edit a skill's copy of this file. The library keeps one canonical copy and
// `sync-shared.mjs` copies it into every skill that declares it in assets/shared.json;
// the skill validator fails on any drift. Change the canonical copy, then re-sync.
//
// What it gives a script:
//   parseArgs(argv, spec)   argument parsing with an automatic --help (exit 0) and usage errors (exit 2);
//                           the repo root is positional (a script with a --root option accepts it too)
//   walk(root, options)     sorted file list with ignore/include globs (gitignore-style basename globs)
//   createReporter(opts)    problem collection (file:line, rule id, message, fix) and the standard summary
//   run(main)               wraps main(): exit 0 pass, 1 problems, 2 bad input or environment
//   runSelftest(url, suites) the self-test runner: good/ and every pass-*/ must pass, every bad-*/ must
//                           fail (exit 1) and every error-*/ must stop (exit 2), each printing every
//                           line of its EXPECT.txt
//   packageInstallFix(o)    the fix text for a missing pinned package: the skill-folder install and the
//                           --tooling <dir> install for a read-only skill folder; resolveToolingDir and
//                           importPackage load a package from that folder
//   REPO_SCAN_IGNORES       the folders every checker that walks the app repo skips (skills/, .claude/,
//                           node_modules, generated native and build output); isRepoScanIgnored(rel)
//   readShellSlice(root)    null (the full Shell) or { screens, why } from shell-slice.json;
//                           sliceSkipReason(slice, screenId) says when a Shell rule is skipped
//   dueSkipReason(root, t)  'due at Shell step <n>: <file> not yet created' while a later build step's
//                           file is missing, else null; SHELL_DUE_TARGETS names the usual targets
//   plus small helpers: fail, requireDir, requireFile, readText, isBinary, lineOf, maskComments,
//   globToRegExp, matchGlob, sha256, toPosix.
//
// Output contract (the same for every script):
//   SKIP <file> [<rule>] <message>                           a rule that does not apply yet (not a problem)
//   FAIL <file>:<line> [<rule>] <message> Fix: <fix>      one line per problem
//   <name>: <n> <unit> checked, <m> problems                 the summary
//   NOT APPLICABLE: <reason>                                 instead of the summary, when a repo fact proves
//                                                            the whole check does not apply (exit 0)
//   RESULT: PASS | RESULT: FAIL (<m> problems)                always the last line
// SKIP lines and NOT APPLICABLE count as a pass; exit 2 (bad input, nothing to check) never does.

import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs as nodeParseArgs } from 'node:util';

export const EXIT = Object.freeze({ PASS: 0, FAIL: 1, BAD_INPUT: 2 });

/** The exact last line every script prints. */
export const RESULT_PATTERN = /^RESULT: (PASS|FAIL \((\d+) problems\))$/;

export function resultLine(problemCount) {
  return problemCount === 0 ? 'RESULT: PASS' : `RESULT: FAIL (${problemCount} problems)`;
}

/** Thrown for bad input or a broken environment; run() turns it into exit code 2. */
export class UsageError extends Error {
  constructor(message, fix = 'Run the script with --help to see its usage.') {
    super(message);
    this.name = 'UsageError';
    this.fix = fix;
  }
}

/** Stop with exit code 2 (bad input or environment). */
export function fail(message, fix) {
  throw new UsageError(message, fix);
}

export function toPosix(path) {
  return path.split(sep).join('/');
}

// ---------------------------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------------------------

/**
 * Parse process arguments.
 * spec = {
 *   name: 'check-names',                        // script name used in the usage line
 *   summary: 'Checks that ...',                 // one or two sentences for --help
 *   usage: '[options] [path...]',               // shown after "node <name>.mjs"
 *   options: { root: { type: 'string', default: '.', help: 'App repo root', value: 'dir' },
 *              json: { type: 'boolean', help: 'Also print the problems as JSON' },
 *              only: { type: 'string', multiple: true, help: 'Repeatable' } },
 *   positionals: { min: 0, max: Infinity },     // how many positional arguments are allowed
 *   details: 'More help text (rules, examples).'
 * }
 * Returns { options, positionals }. --help / -h prints the help and exits 0.
 */
export function parseArgs(argv, spec) {
  const optionSpec = { help: { type: 'boolean', short: 'h' } };
  for (const [key, value] of Object.entries(spec.options ?? {})) {
    optionSpec[key] = { type: value.type ?? 'string' };
    if (value.short) optionSpec[key].short = value.short;
    if (value.multiple) optionSpec[key].multiple = true;
  }
  let parsed;
  try {
    parsed = nodeParseArgs({ args: argv, options: optionSpec, allowPositionals: true, strict: true });
  } catch (error) {
    // Node appends a hint about "--" to unknown options; the usage fix below says more.
    const message = error.message.split('\n')[0].replace(/\. To specify a positional argument starting with a '-'.*$/, '');
    throw new UsageError(message, usageFix(spec, error.message));
  }
  if (parsed.values.help) {
    writeOut(`${helpText(spec)}\n`);
    process.exit(EXIT.PASS);
  }
  const options = {};
  for (const [key, value] of Object.entries(spec.options ?? {})) {
    const given = parsed.values[key];
    if (given !== undefined) options[key] = given;
    else if (value.default !== undefined) options[key] = value.default;
    else if (value.type === 'boolean') options[key] = false;
    else if (value.multiple) options[key] = [];
  }
  const { min = 0, max = Infinity } = positionalLimits(spec);
  let positionals = parsed.positionals;
  // Every checker takes the repo root as an optional positional argument. A script that declares a
  // --root option and no positional arguments of its own accepts the root positionally as well, so
  // `node <checker>.mjs . [options]` works for every checker.
  if (spec.options?.root && max === 0 && positionals.length === 1) {
    if (parsed.values.root !== undefined) {
      throw new UsageError(`the repo root was given twice: --root ${[parsed.values.root].flat().join(' ')} and ${positionals[0]}`, `Give it once, as the first argument: node ${spec.name}.mjs <repo-root> [options]`);
    }
    options.root = spec.options.root.multiple ? [positionals[0]] : positionals[0];
    positionals = [];
  }
  if (positionals.length < min) {
    throw new UsageError(`expected at least ${min} argument(s), got ${positionals.length}`, `Run: node ${spec.name}.mjs --help`);
  }
  if (positionals.length > max) {
    throw new UsageError(`expected at most ${max} argument(s), got ${positionals.length}: ${positionals.join(' ')}`, `Run: node ${spec.name}.mjs --help`);
  }
  return { options, positionals };
}

/** How many positional arguments a script takes: { min, max } (none when the spec says nothing). */
function positionalLimits(spec) {
  const { min = 0, max = Infinity } = spec.positionals ?? { min: 0, max: 0 };
  return { min, max };
}

/**
 * The fix text for an argument error. Checkers take the repo root as an optional positional
 * argument, so a guessed "--root <dir>" is answered with the positional form.
 */
function usageFix(spec, message) {
  const { max } = positionalLimits(spec);
  if (/Unknown option '--root'/.test(message) && !spec.options?.root && max >= 1) {
    return `This script takes the repo root as a positional argument, not --root: node ${spec.name}.mjs <repo-root> [options] (for example: node ${spec.name}.mjs .). Run: node ${spec.name}.mjs --help`;
  }
  return `Run: node ${spec.name}.mjs --help`;
}

/** Synchronous stdout write, so nothing is lost when the process exits right after. */
function writeOut(text) {
  try {
    writeSync(1, text);
  } catch {
    process.stdout.write(text);
  }
}

export function helpText(spec) {
  const lines = [`Usage: node ${spec.name}.mjs ${spec.usage ?? '[options]'}`.trimEnd(), ''];
  if (spec.summary) lines.push(spec.summary, '');
  const rows = [];
  for (const [key, value] of Object.entries(spec.options ?? {})) {
    const flag = `${value.short ? `-${value.short}, ` : ''}--${key}${value.type === 'boolean' ? '' : ` <${value.value ?? 'value'}>`}`;
    const def = value.default !== undefined && value.type !== 'boolean' ? ` (default: ${value.default})` : '';
    const positional = key === 'root' && positionalLimits(spec).max === 0 ? '; may also be given as the first argument' : '';
    rows.push([flag, `${value.help ?? ''}${value.multiple ? ' (repeatable)' : ''}${def}${positional}`]);
  }
  rows.push(['-h, --help', 'Show this help and exit']);
  const width = Math.max(...rows.map(([flag]) => flag.length));
  lines.push('Options:');
  for (const [flag, text] of rows) lines.push(`  ${flag.padEnd(width)}  ${text}`);
  if (spec.details) lines.push('', spec.details.trimEnd());
  lines.push(
    '',
    'Exit codes: 0 pass, 1 problems found, 2 bad input or environment.',
    'The last line is always "RESULT: PASS" or "RESULT: FAIL (<n> problems)".',
  );
  return lines.join('\n');
}

// ---------------------------------------------------------------------------------------------
// Globs and the file walker
// ---------------------------------------------------------------------------------------------

/** Convert a glob to a RegExp. Supports **, *, ?, {a,b} and [abc]. */
export function globToRegExp(glob) {
  let out = '';
  let i = 0;
  let braceDepth = 0;
  while (i < glob.length) {
    const ch = glob[i];
    if (ch === '*') {
      if (glob[i + 1] === '*') {
        const atStart = i === 0 || glob[i - 1] === '/';
        const next = glob[i + 2];
        if (atStart && next === '/') {
          out += '(?:.*/)?';
          i += 3;
          continue;
        }
        if (atStart && next === undefined) {
          out += '.*';
          i += 2;
          continue;
        }
        out += '.*';
        i += 2;
        continue;
      }
      out += '[^/]*';
    } else if (ch === '?') {
      out += '[^/]';
    } else if (ch === '{') {
      braceDepth += 1;
      out += '(?:';
    } else if (ch === '}' && braceDepth > 0) {
      braceDepth -= 1;
      out += ')';
    } else if (ch === ',' && braceDepth > 0) {
      out += '|';
    } else if (ch === '[') {
      const close = glob.indexOf(']', i + 1);
      if (close === -1) {
        out += '\\[';
      } else {
        let body = glob.slice(i + 1, close).replace(/\\/g, '\\\\');
        if (body.startsWith('!')) body = `^${body.slice(1)}`;
        out += `[${body}]`;
        i = close;
      }
    } else if ('\\^$.|+()'.includes(ch)) {
      out += `\\${ch}`;
    } else {
      out += ch;
    }
    i += 1;
  }
  // "dir/**" also matches "dir" itself.
  out = out.replace(/\/\.\*$/, '(?:/.*)?');
  return new RegExp(`^${out}$`);
}

const globCache = new Map();
function cachedGlob(glob) {
  let re = globCache.get(glob);
  if (!re) {
    re = globToRegExp(glob);
    globCache.set(glob, re);
  }
  return re;
}

/**
 * Does a relative posix path match a glob? A glob without "/" is matched against every
 * path segment (gitignore style: "node_modules" or "*.png" match at any depth).
 */
export function matchGlob(relPath, glob) {
  const clean = glob.replace(/^\.\//, '');
  if (!clean.includes('/')) {
    const re = cachedGlob(clean);
    return relPath.split('/').some((segment) => re.test(segment));
  }
  return cachedGlob(clean.replace(/\/$/, '/**')).test(relPath);
}

export const DEFAULT_IGNORES = Object.freeze(['node_modules', '.git', '.DS_Store', 'EXPECT.txt']);

/**
 * What every checker that walks the app repo broadly skips: the in-repo skill library and Claude
 * Code's folder (their templates and fixtures hold planted bugs, goldens and skips on purpose),
 * node_modules, CocoaPods and Expo caches at any depth, and the generated native projects and build
 * output of each app. Patterns are relative to the repo root (or to one app folder), so pass them
 * to a walk rooted there: walk(root, { ignore: [...REPO_SCAN_IGNORES, ...extra] }). Source folders
 * that merely share a name, such as packages/tooling/src/build/ or packages/tooling/src/ios/, are
 * still scanned. For paths that come from git (diffs, logs), use isRepoScanIgnored(rel).
 */
export const REPO_SCAN_IGNORES = Object.freeze([
  'skills/**',
  '.claude/**',
  'node_modules',
  'Pods',
  '.expo',
  'ios/**',
  'android/**',
  'build/**',
  'out/**',
  'apps/*/ios/**',
  'apps/*/android/**',
  'apps/*/build/**',
  'apps/*/out/**',
]);

/** True when a repo-relative posix path lies under one of REPO_SCAN_IGNORES. */
export function isRepoScanIgnored(relPath) {
  const clean = toPosix(relPath).replace(/^\.\//, '');
  return REPO_SCAN_IGNORES.some((glob) => matchGlob(clean, glob));
}

/**
 * List files under root as sorted relative posix paths.
 * options.ignore: globs to skip (added to DEFAULT_IGNORES unless defaultIgnores is false)
 * options.include: globs a file must match (default: every file)
 * options.followSymlinks: follow symlinked files and folders (default false: symlinks are skipped)
 * options.onSymlink(relPath): called for every skipped symlink
 */
export function walk(root, options = {}) {
  const ignore = [...(options.defaultIgnores === false ? [] : DEFAULT_IGNORES), ...(options.ignore ?? [])];
  const include = options.include ?? null;
  const files = [];
  const absRoot = resolve(root);
  if (!existsSync(absRoot) || !statSync(absRoot).isDirectory()) {
    throw new UsageError(`nothing to check: ${root} does not exist or is not a folder`, 'Pass the path of an existing folder.');
  }
  const visit = (absDir) => {
    const entries = readdirSync(absDir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      const abs = join(absDir, entry.name);
      const rel = toPosix(relative(absRoot, abs));
      if (ignore.some((glob) => matchGlob(rel, glob))) continue;
      let isDir = entry.isDirectory();
      let isFile = entry.isFile();
      if (entry.isSymbolicLink()) {
        if (!options.followSymlinks) {
          options.onSymlink?.(rel);
          continue;
        }
        const target = statSync(abs, { throwIfNoEntry: false });
        if (!target) continue;
        isDir = target.isDirectory();
        isFile = target.isFile();
      }
      if (isDir) visit(abs);
      else if (isFile && (!include || include.some((glob) => matchGlob(rel, glob)))) files.push(rel);
    }
  };
  visit(absRoot);
  return files;
}

export function requireDir(path, what = 'folder') {
  if (!existsSync(path) || !statSync(path).isDirectory()) {
    throw new UsageError(`nothing to check: ${what} ${path} does not exist or is not a folder`, 'Pass the path of an existing folder.');
  }
  return resolve(path);
}

export function requireFile(path, what = 'file') {
  if (!existsSync(path) || !statSync(path).isFile()) {
    throw new UsageError(`nothing to check: ${what} ${path} does not exist`, 'Pass the path of an existing file.');
  }
  return resolve(path);
}

// ---------------------------------------------------------------------------------------------
// A partial Shell: shell-slice.json
// ---------------------------------------------------------------------------------------------

/** Every Shell screen id a slice may name. */
export const SHELL_SCREEN_IDS = Object.freeze([
  ...Array.from({ length: 15 }, (_, index) => `S${index + 1}`),
  'S11a',
  'S11b',
  'S11c',
  'S11d',
]);
export const SHELL_SLICE_FILE = 'shell-slice.json';
const SLICE_FIX = 'Write shell-slice.json as { "screens": ["S4", "S11"], "why": "<why only these screens exist>" } with ids from S1-S15 and S11a-S11d ("screens": [] for a game-first repo), or delete the file once the whole Shell is built.';

/**
 * A repo without every Shell screen declares so in shell-slice.json at its root:
 *   { "screens": ["S4", "S11", "S12"], "why": "Home + Settings parity slice" }
 * Returns null when the file does not exist (the full Shell: every check is strict), otherwise
 * { file, screens: Set<id>, why, hasShellApp } where hasShellApp is false for "screens": [] (a
 * game-first repo with no Shell app). A malformed file stops the checker with exit 2.
 */
export function readShellSlice(root = '.') {
  const path = join(resolve(root), SHELL_SLICE_FILE);
  if (!existsSync(path)) return null;
  let data;
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new UsageError(`${SHELL_SLICE_FILE} is not valid JSON (${error.message.split('\n')[0]})`, SLICE_FIX);
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) throw new UsageError(`${SHELL_SLICE_FILE} must hold one object`, SLICE_FIX);
  const extra = Object.keys(data).filter((key) => !['screens', 'why', '$comment'].includes(key));
  if (extra.length > 0) throw new UsageError(`${SHELL_SLICE_FILE} has unknown keys: ${extra.join(', ')}`, SLICE_FIX);
  if (!Array.isArray(data.screens)) throw new UsageError(`${SHELL_SLICE_FILE} needs "screens": a list of screen ids`, SLICE_FIX);
  const unknown = data.screens.filter((id) => !SHELL_SCREEN_IDS.includes(id));
  if (unknown.length > 0) throw new UsageError(`${SHELL_SLICE_FILE} names unknown screens: ${unknown.map(String).join(', ')}`, SLICE_FIX);
  if (new Set(data.screens).size !== data.screens.length) throw new UsageError(`${SHELL_SLICE_FILE} lists a screen twice`, SLICE_FIX);
  if (typeof data.why !== 'string' || data.why.trim() === '') throw new UsageError(`${SHELL_SLICE_FILE} needs "why": one sentence on why only these screens exist`, SLICE_FIX);
  return Object.freeze({ file: SHELL_SLICE_FILE, screens: new Set(data.screens), why: data.why.trim(), hasShellApp: data.screens.length > 0 });
}

/**
 * Why a Shell rule is skipped in this repo, or null when it must be checked.
 *   screenId given: the rule belongs to that screen; skipped when a slice exists without it.
 *   screenId null:  the rule needs the Shell app itself (gesture root, board-host Shell-stage files,
 *                   audio wiring, daily and stats modules); skipped only for "screens": [].
 * Report a skip with report.skip({ file, rule, message: reason }).
 */
export function sliceSkipReason(slice, screenId = null) {
  if (slice === null) return null;
  if (screenId === null) return slice.hasShellApp ? null : `no Shell app (${SHELL_SLICE_FILE} has "screens": [])`;
  if (!SHELL_SCREEN_IDS.includes(screenId)) throw new Error(`sliceSkipReason: unknown screen id ${screenId}`);
  return slice.screens.has(screenId) ? null : `${screenId} not in ${SHELL_SLICE_FILE}`;
}

// ---------------------------------------------------------------------------------------------
// Rules that are not yet due: the Shell build order creates their target at a later step
// ---------------------------------------------------------------------------------------------

/**
 * The files the Shell build order creates at a later step and that other rules wait for. Pass one
 * to dueSkipReason: dueSkipReason(root, SHELL_DUE_TARGETS.plugins).
 *   plugins   the one native plugin list (expo-font, ads, IAP, audio, tracking entries,   step 8
 *             the native perf module)
 *   catalogs  the Shell's English catalog (catalog-key rules)                             step 6
 *   boot      the Shell boot file start-shell.ts, which lands with the composition root   step 7
 *             (rules on hydration, the background checkpoint, the startup splash, UI
 *             feedback and the JS half of the perf layer, app/perf/*.ts)
 * A perf rule splits in two: its JS half (app/perf/*.ts, markJsEntry inside startShell) waits for
 * .boot, and its native half (the process-start module and its plugin entry) waits for .plugins.
 */
export const SHELL_DUE_TARGETS = Object.freeze({
  plugins: Object.freeze({ file: 'packages/shell/src/config/shell-plugins.ts', step: 8 }),
  catalogs: Object.freeze({ file: 'packages/shell/src/i18n/catalogs/en.json', step: 6 }),
  boot: Object.freeze({ file: 'packages/shell/src/app/start-shell.ts', step: 7 }),
});

/**
 * Why a rule is not yet due, or null when it must be checked. A rule whose target a later Shell
 * build step creates calls this with that target: while the file is missing it returns
 * 'due at Shell step <step>: <file> not yet created' for report.skip({ file, rule, message });
 * once the file exists it returns null and the rule is strict.
 *   const reason = dueSkipReason(root, SHELL_DUE_TARGETS.plugins);
 *   if (reason) report.skip({ file: 'packages/shell/src/config/shell-plugins.ts', rule: 'plugin-entry', message: reason });
 * Only for a target that a later build step creates, and never in a checker that decides whether
 * something may ship (a release or completeness gate): there a missing file is a problem.
 */
export function dueSkipReason(root, target) {
  const file = target?.file;
  const step = target?.step;
  if (typeof file !== 'string' || file.trim() === '' || file.startsWith('/') || file.split(/[\\/]/).includes('..')) {
    throw new Error(`dueSkipReason: target.file must be a repo-relative path, got ${JSON.stringify(file)}`);
  }
  if (!Number.isInteger(step) || step < 1) throw new Error(`dueSkipReason: target.step must be a Shell build step number (1 or more), got ${JSON.stringify(step)}`);
  const rel = toPosix(file).replace(/^\.\//, '');
  return existsSync(join(resolve(root), rel)) ? null : `due at Shell step ${step}: ${rel} not yet created`;
}

// ---------------------------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------------------------

export function isBinary(buffer) {
  const limit = Math.min(buffer.length, 8000);
  for (let i = 0; i < limit; i += 1) if (buffer[i] === 0) return true;
  return false;
}

/** Read a UTF-8 text file; returns null for binary files. */
export function readText(path) {
  const buffer = readFileSync(path);
  return isBinary(buffer) ? null : buffer.toString('utf8');
}

/** 1-based line number of a character index. */
export function lineOf(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i += 1) if (text.charCodeAt(i) === 10) line += 1;
  return line;
}

export function sha256(bufferOrString) {
  return createHash('sha256').update(bufferOrString).digest('hex');
}

/**
 * Replace JS/TS comments with spaces (newlines kept) so grep-style checks skip comments and
 * report correct line numbers. Strings and template literals are kept; regex literals are
 * recognised after operators and keywords.
 */
export function maskComments(source) {
  let out = '';
  let i = 0;
  let lastSignificant = '';
  const blank = (text) => text.replace(/[^\n]/g, ' ');
  const regexAllowedAfter = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === '/' && next === '/') {
      const end = source.indexOf('\n', i);
      const stop = end === -1 ? source.length : end;
      out += blank(source.slice(i, stop));
      i = stop;
      continue;
    }
    if (ch === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end === -1 ? source.length : end + 2;
      out += blank(source.slice(i, stop));
      i = stop;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1;
      while (j < source.length && source[j] !== ch) {
        if (source[j] === '\\') j += 1;
        else if (ch !== '`' && source[j] === '\n') break;
        j += 1;
      }
      out += source.slice(i, j + 1);
      i = j + 1;
      lastSignificant = ch;
      continue;
    }
    if (ch === '/' && regexAllowedAfter.has(lastSignificant)) {
      let j = i + 1;
      let inClass = false;
      while (j < source.length && source[j] !== '\n') {
        if (source[j] === '\\') j += 1;
        else if (source[j] === '[') inClass = true;
        else if (source[j] === ']') inClass = false;
        else if (source[j] === '/' && !inClass) break;
        j += 1;
      }
      out += source.slice(i, j + 1);
      i = j + 1;
      lastSignificant = '/';
      continue;
    }
    out += ch;
    if (!/\s/.test(ch)) {
      lastSignificant = /[A-Za-z0-9_$)\]]/.test(ch) ? 'x' : ch;
      if (/[A-Za-z]/.test(ch) && (i === 0 || !/[A-Za-z0-9_$]/.test(source[i - 1]))) {
        const word = /^[A-Za-z]+/.exec(source.slice(i))[0];
        if (['return', 'typeof', 'case', 'in', 'of', 'new', 'delete', 'void', 'throw', 'yield', 'await'].includes(word)) {
          out += word.slice(1);
          i += word.length;
          lastSignificant = '(';
          continue;
        }
      }
    }
    i += 1;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Problems, summary and exit codes
// ---------------------------------------------------------------------------------------------

export function formatProblem({ file, line, rule, message, fix }) {
  const where = file ? `${file}${line ? `:${line}` : ''} ` : '';
  return `FAIL ${where}[${rule}] ${message}${fix ? ` Fix: ${fix}` : ''}`;
}

export function formatSkip({ file, rule, message }) {
  return `SKIP ${file ? `${file} ` : ''}[${rule}] ${message}`;
}

/**
 * Collects problems and prints the standard summary.
 *   const report = createReporter({ name: 'check-names', json: options.json });
 *   report.problem({ file, line, rule, message, fix });
 *   report.skip({ file, rule, message });        // a rule that does not apply yet: printed, not counted
 *   return report.finish({ checked: files.length, unit: 'files' });   // returns the exit code
 *   return report.notApplicable('every game module has realtime: null');  // exit 0, RESULT: PASS
 *
 * SKIP is for one rule a repo fact puts out of reach: a screen outside shell-slice.json
 * (sliceSkipReason), or a target a later Shell build step creates (dueSkipReason). NOT
 * APPLICABLE is for the whole check, and only when a repo fact proves it (a turn-based repo for a
 * real-time checker). A target that is simply missing is still bad input (exit 2), or a problem
 * (exit 1) once the item is due.
 */
export function createReporter({ name, json = false } = {}) {
  const problems = [];
  const skips = [];
  const sortByFile = (list) => [...list].sort((a, b) => (a.file === b.file ? (a.line ?? 0) - (b.line ?? 0) : a.file < b.file ? -1 : 1));
  const printSkips = () => {
    const sorted = sortByFile(skips);
    for (const entry of sorted) console.log(formatSkip(entry));
    return sorted;
  };
  return {
    problems,
    skips,
    get count() {
      return problems.length;
    },
    problem(entry) {
      if (!entry.rule || !entry.message) throw new Error('report.problem() needs at least rule and message');
      problems.push({ file: entry.file ?? '', line: entry.line ?? 0, rule: entry.rule, message: entry.message, fix: entry.fix ?? '' });
    },
    skip(entry) {
      if (!entry.rule || !entry.message) throw new Error('report.skip() needs at least rule and message');
      skips.push({ file: entry.file ?? '', rule: entry.rule, message: entry.message });
    },
    note(text) {
      console.log(text);
    },
    notApplicable(reason) {
      if (typeof reason !== 'string' || reason.trim() === '') throw new Error('report.notApplicable() needs the repo fact that proves it');
      if (problems.length > 0) throw new Error('report.notApplicable() after problems were reported: finish() instead');
      const sortedSkips = printSkips();
      console.log(`NOT APPLICABLE: ${reason.trim()}`);
      if (json) console.log(JSON.stringify({ name, checked: 0, notApplicable: reason.trim(), skips: sortedSkips, problems: [] }));
      console.log(resultLine(0));
      process.exitCode = EXIT.PASS;
      return EXIT.PASS;
    },
    finish({ checked, unit = 'files' } = {}) {
      if (checked === 0 && problems.length === 0 && skips.length === 0) {
        throw new UsageError(`nothing to check: 0 ${unit} found`, 'Point the script at a folder that contains the files it checks.');
      }
      const sortedSkips = printSkips();
      const sorted = sortByFile(problems);
      for (const entry of sorted) console.log(formatProblem(entry));
      const countText = checked === undefined ? '' : `${checked} ${unit} checked, `;
      const skipText = skips.length > 0 ? `, ${skips.length} skipped` : '';
      console.log(`${name}: ${countText}${problems.length} problems${skipText}`);
      if (json) console.log(JSON.stringify({ name, checked: checked ?? null, problems: sorted, ...(skips.length > 0 ? { skips: sortedSkips } : {}) }));
      console.log(resultLine(problems.length));
      const code = problems.length === 0 ? EXIT.PASS : EXIT.FAIL;
      process.exitCode = code;
      return code;
    },
  };
}

/**
 * Run a script's main function with the standard exit codes.
 *   run(async () => { ...; return report.finish({ checked }); });
 * UsageError -> exit 2 with an ERROR line; any other exception -> exit 2 with the stack.
 */
export async function run(main) {
  try {
    const code = await main();
    if (typeof code === 'number') process.exitCode = code;
  } catch (error) {
    if (error instanceof UsageError) {
      console.log(`ERROR [bad-input] ${error.message} Fix: ${error.fix}`);
    } else {
      console.log(`ERROR [crash] ${error?.stack ?? error} Fix: this is a bug in the script; fix it, then rerun.`);
    }
    console.log(resultLine(1));
    process.exitCode = EXIT.BAD_INPUT;
  }
}

// ---------------------------------------------------------------------------------------------
// Self-test runner (used by scripts/selftest.mjs)
// ---------------------------------------------------------------------------------------------

function lastLine(text) {
  const lines = text.split('\n').map((line) => line.trimEnd()).filter(Boolean);
  return lines.at(-1) ?? '';
}

function runNode(script, args, cwd, timeoutMs) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 });
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}`, stdout: result.stdout ?? '', timedOut: result.error?.code === 'ETIMEDOUT' };
}

function tail(text, count = 8) {
  return text.trimEnd().split('\n').slice(-count).map((line) => `      | ${line}`).join('\n');
}

/** The fixture kinds runSelftest runs, by folder-name prefix: what each must do. */
export const SELFTEST_CASES = Object.freeze({
  good: Object.freeze({ exit: EXIT.PASS, expect: 'optional', meaning: 'clean input: exit 0 with RESULT: PASS' }),
  'pass-': Object.freeze({ exit: EXIT.PASS, expect: 'required', meaning: 'a passing case: exit 0 with RESULT: PASS and every EXPECT.txt line (a SKIP line, a NOT APPLICABLE fact, a note)' }),
  'bad-': Object.freeze({ exit: EXIT.FAIL, expect: 'required', meaning: 'a planted bug: exit 1 with every EXPECT.txt line (the rule id, file:line)' }),
  'error-': Object.freeze({ exit: EXIT.BAD_INPUT, expect: 'required', meaning: 'bad input or environment: exit 2 with every EXPECT.txt line (the ERROR text)' }),
});

/** The kind of one fixture folder ('good', 'pass-', 'bad-', 'error-'), or null for a folder runSelftest ignores. */
export function selftestCaseKind(name) {
  if (name === 'good') return 'good';
  for (const prefix of ['pass-', 'bad-', 'error-']) if (name.startsWith(prefix) && name.length > prefix.length) return prefix;
  return null;
}

/**
 * Prove each checker on its fixture folders, one kind per folder-name prefix:
 *   good/          exits 0 and ends with RESULT: PASS (EXPECT.txt optional)
 *   pass-<case>/   exits 0, ends with RESULT: PASS and prints every line of its EXPECT.txt
 *                  (a SKIP line, a NOT APPLICABLE fact, the variant a run picked)
 *   bad-<case>/    exits 1 with a RESULT line and prints every line of its EXPECT.txt
 *                  (the rule id, file:line); a suite needs at least one
 *   error-<case>/  exits 2 with a RESULT line and prints every line of its EXPECT.txt
 *                  (the ERROR [bad-input] text a missing or malformed input gives); an optional
 *                  ARGS.txt in the folder replaces args(dir) with its whitespace-separated words
 * Each non-empty EXPECT.txt line must appear in the output.
 *
 *   // scripts/selftest.mjs
 *   import { runSelftest } from './check-lib.mjs';
 *   await runSelftest(import.meta.url, [
 *     { script: 'check-exports.mjs', fixtures: '../tests/fixtures', args: (dir) => [dir] },
 *   ]);
 *
 * script and fixtures are relative to the selftest file. args(dir) builds the arguments for one
 * fixture folder (default: no arguments; the checker runs with that folder as its working
 * directory). Also checks that --help exits 0. When every good, pass and bad fixture stops with the
 * same exit-2 error, the environment is not ready (a package is not installed): the self-test says
 * that once and exits 2. error-* fixtures are meant to exit 2 and never count towards that.
 */
export async function runSelftest(selftestUrl, suites, { timeoutMs = 120000 } = {}) {
  await run(async () => {
    parseArgs(process.argv.slice(2), {
      name: 'selftest',
      summary: 'Runs every checker of this skill on tests/fixtures: good/ and pass-*/ must pass (exit 0), each bad-*/ must fail (exit 1) and each error-*/ must stop (exit 2), each printing every line of its EXPECT.txt.',
      usage: '',
      positionals: { min: 0, max: 0 },
    });
    const here = dirname(fileURLToPath(selftestUrl));
    if (!Array.isArray(suites) || suites.length === 0) throw new UsageError('runSelftest needs at least one suite', 'Pass [{ script, fixtures, args }].');
    const report = createReporter({ name: 'selftest' });
    let runs = 0;
    for (const suite of suites) {
      const script = resolve(here, suite.script);
      const fixtures = resolve(here, suite.fixtures ?? '../tests/fixtures');
      const args = suite.args ?? (() => []);
      const label = basename(script);
      if (!existsSync(script)) {
        report.problem({ file: suite.script, rule: 'selftest-script', message: `checker ${label} not found`, fix: 'Point the suite at an existing script in scripts/.' });
        continue;
      }
      const help = runNode(script, ['--help'], here, timeoutMs);
      runs += 1;
      if (help.status !== 0 || !/Usage:/.test(help.output)) {
        report.problem({ file: label, rule: 'selftest-help', message: `--help exited ${help.status} or printed no "Usage:" line`, fix: 'Use parseArgs() from check-lib so --help prints usage and exits 0.' });
      } else {
        console.log(`ok   ${label} --help`);
      }
      if (!existsSync(fixtures)) {
        report.problem({ file: toPosix(relative(here, fixtures)), rule: 'selftest-fixtures', message: 'fixtures folder not found', fix: 'Create tests/fixtures/good and tests/fixtures/bad-<case>/ with EXPECT.txt.' });
        continue;
      }
      const dirs = readdirSync(fixtures, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
      const bad = dirs.filter((name) => selftestCaseKind(name) === 'bad-');
      if (!dirs.includes('good')) {
        report.problem({ file: toPosix(relative(here, fixtures)), rule: 'selftest-fixtures', message: 'no good/ fixture', fix: 'Add tests/fixtures/good/ with input the checker must pass.' });
      }
      if (bad.length === 0) {
        report.problem({ file: toPosix(relative(here, fixtures)), rule: 'selftest-fixtures', message: 'no bad-* fixture: a check that has only ever passed proves nothing', fix: 'Add tests/fixtures/bad-<case>/ with a planted bug and an EXPECT.txt.' });
      }
      const ran = [];
      for (const name of dirs.filter((dir) => selftestCaseKind(dir) !== null)) {
        const kind = selftestCaseKind(name);
        const dir = join(fixtures, name);
        const expectPath = join(dir, 'EXPECT.txt');
        const expected = existsSync(expectPath) ? readFileSync(expectPath, 'utf8').split('\n').map((line) => line.trim()).filter(Boolean) : kind === 'good' ? [] : null;
        if (expected === null || (kind !== 'good' && expected.length === 0)) {
          report.problem({ file: toPosix(relative(here, expectPath)), rule: 'selftest-expect', message: `${name} has no EXPECT.txt (or it is empty)`, fix: kind === 'pass-' ? 'Write the lines a passing run must print (a SKIP line, a note), one per line.' : kind === 'error-' ? 'Write the ERROR text the checker must print for this input, one per line.' : 'Write the rule id or message the checker must print, one per line.' });
          continue;
        }
        // An error case is usually a bad argument list, which one args(dir) for the suite cannot
        // express: an error-<case>/ may hold ARGS.txt, whose words replace args(dir) for that case.
        const argsPath = join(dir, 'ARGS.txt');
        const argv = kind === 'error-' && existsSync(argsPath) ? readFileSync(argsPath, 'utf8').trim().split(/\s+/).filter(Boolean) : args(dir);
        ran.push({ name, kind, dir, expected, result: runNode(script, argv, dir, timeoutMs) });
        runs += 1;
      }
      // Every fixture that should run stopped with the same exit-2 error: the environment is not
      // ready (for example a package is not installed). Say that once instead of failing every case.
      // error-* fixtures stop with exit 2 on purpose, so they never count here.
      const runnable = ran.filter(({ kind }) => kind !== 'error-');
      const errors = runnable.map(({ result }) => (result.status === 2 ? /^ERROR \[[^\]]+\] (.*)$/m.exec(result.stdout)?.[1] : null));
      if (runnable.length > 0 && errors.every((error) => error && error === errors[0])) {
        const [message, fix = 'Fix the environment, then rerun.'] = errors[0].split(' Fix: ');
        throw new UsageError(`${label} cannot run here, every fixture stopped with: ${message}`, fix);
      }
      for (const { name, kind, dir, expected, result } of ran) {
        const shown = `${label} ${name}`;
        const want = SELFTEST_CASES[kind].exit;
        const final = lastLine(result.stdout);
        const problems = [];
        if (result.timedOut) problems.push(`timed out after ${timeoutMs} ms`);
        if (result.status !== want) problems.push(`expected exit ${want}, got ${result.status}`);
        if (!RESULT_PATTERN.test(final)) problems.push(`last line is not a RESULT line: "${final}"`);
        else if (want === 0 && final !== 'RESULT: PASS') problems.push(`expected RESULT: PASS, got "${final}"`);
        for (const text of expected) if (!result.output.includes(text)) problems.push(`output does not contain "${text}"`);
        if (problems.length > 0) {
          const fix = {
            good: 'Fix the checker (or the good fixture) so clean input passes.',
            'pass-': 'Fix the checker so this passing case exits 0 and prints what EXPECT.txt says.',
            'bad-': 'Fix the checker so it catches the planted bug and names it as EXPECT.txt says.',
            'error-': 'Fix the checker so this input stops with exit 2 (fail() or UsageError) and prints what EXPECT.txt says; exit 1 is for problems found, exit 2 for bad input.',
          }[kind];
          report.problem({ file: toPosix(relative(here, dir)), rule: 'selftest-case', message: `${shown}: ${problems.join('; ')}\n${tail(result.output)}`, fix });
        } else {
          console.log(`ok   ${shown} (exit ${result.status}${expected.length ? `, found ${expected.map((text) => `"${text}"`).join(', ')}` : ''})`);
        }
      }
    }
    return report.finish({ checked: runs, unit: 'runs' });
  });
}

// ---------------------------------------------------------------------------------------------
// Pinned packages of a skill that needs them (scripts/package.json)
// ---------------------------------------------------------------------------------------------

/**
 * The folder that holds a skill's installed packages (its node_modules/): the --tooling option,
 * else the environment variable, else the skill's own scripts/ folder. Use the option or the
 * variable when the skill folder must stay read-only or is shared by several sessions.
 *   const tooling = resolveToolingDir({ given: options.tooling, envVar: 'PARITY_TOOLING_DIR', scriptsDir: SCRIPTS_DIR });
 */
export function resolveToolingDir({ given, envVar, scriptsDir } = {}) {
  const fromEnv = envVar ? process.env[envVar] : undefined;
  const dir = [given, fromEnv].find((value) => typeof value === 'string' && value.trim() !== '') ?? scriptsDir;
  if (typeof dir !== 'string' || dir.trim() === '') throw new Error('resolveToolingDir needs scriptsDir (the skill\'s scripts/ folder)');
  return resolve(dir);
}

/**
 * The fix text for a pinned package that is not installed. It gives both install forms: into the
 * skill's own scripts/ folder, and, when the skill folder must stay read-only or is shared, into a
 * folder in the app repo that the script is then pointed at with --tooling <dir> (or the variable).
 *   fail('pngjs 7.0.0 is not installed', packageInstallFix({ scriptsDir: SCRIPTS_DIR, envVar: 'PARITY_TOOLING_DIR', repoDir: '.parity/tooling' }));
 */
export function packageInstallFix({ scriptsDir, envVar, option = '--tooling', repoDir = '.tooling' } = {}) {
  if (typeof scriptsDir !== 'string' || scriptsDir.trim() === '') throw new Error('packageInstallFix needs scriptsDir (the skill\'s scripts/ folder)');
  const pinned = `the pinned package.json and package-lock.json of ${scriptsDir}`;
  const pointAt = envVar ? `pass ${option} <repo>/${repoDir} (or set ${envVar}=<repo>/${repoDir})` : `pass ${option} <repo>/${repoDir}`;
  return `Install the pinned packages into the skill: npm ci --prefix "${scriptsDir}". When the skill folder must stay read-only or is shared by other sessions, copy ${pinned} into <repo>/${repoDir}, run npm ci --prefix <repo>/${repoDir}, and ${pointAt}.`;
}

/** The entry file of an installed package for import(): exports (node, import, default), then main. */
function packageEntry(pkgDir) {
  const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
  const pick = (value) => {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.map(pick).find(Boolean) ?? null;
    if (value && typeof value === 'object') {
      if ('.' in value) return pick(value['.']);
      for (const condition of ['node', 'import', 'default', 'require']) if (condition in value) {
        const found = pick(value[condition]);
        if (found) return found;
      }
    }
    return null;
  };
  return (pkg.exports !== undefined ? pick(pkg.exports) : null) ?? pkg.main ?? 'index.js';
}

/**
 * Load a pinned package from a tooling folder (resolveToolingDir), or stop with exit 2 and the
 * install fix. Keeps --help and argument errors working before any install.
 *   const { PNG } = await importPackage('pngjs', tooling, { what: 'pngjs 7.0.0', fix: packageInstallFix({ ... }) });
 */
export async function importPackage(name, toolingDir, { what = name, fix } = {}) {
  const pkgDir = join(resolve(toolingDir), 'node_modules', ...name.split('/'));
  if (!existsSync(join(pkgDir, 'package.json'))) {
    throw new UsageError(`${what} is not installed in ${toPosix(resolve(toolingDir))}/node_modules`, fix ?? `Run: npm ci --prefix "${toolingDir}"`);
  }
  const entry = join(pkgDir, packageEntry(pkgDir));
  return import(pathToFileURL(entry).href);
}

/** Make an empty temporary folder; remove it with removeTempDir(). */
export function makeTempDir(prefix = 'check-lib-') {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function removeTempDir(dir) {
  rmSync(dir, { recursive: true, force: true });
}

/** True when path is a symlink (without following it). */
export function isSymlink(path) {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}
