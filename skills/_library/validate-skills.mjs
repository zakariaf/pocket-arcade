#!/usr/bin/env node
// validate-skills.mjs: enforces every checkable part of the Pocket Arcade skill authoring standard.
// Usage: node skills/_library/validate-skills.mjs [skill-name-or-path...]   (see --help)

import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { dirname, join, posix, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { COMMON_OPTIONS, compareShared, defaultTargets, readManifest, resolveRoots, resolveTargets, targetLabel } from './lib/library.mjs';
import { parseYamlSubset, splitFrontmatter } from './lib/frontmatter.mjs';
import { RESULT_PATTERN, createReporter, formatProblem, isBinary, makeTempDir, parseArgs, removeTempDir, resultLine, run, toPosix, walk } from './shared/scripts/check-lib.mjs';

// ---------------------------------------------------------------------------------------------
// The standard, as data
// ---------------------------------------------------------------------------------------------

export const ALLOWED_KEYS = ['name', 'description', 'argument-hint', 'arguments', 'metadata', 'license', 'compatibility'];
const KEY_ADVICE = {
  paths: '"paths" hides the skill from the listing and the / menu until a matching file is read, so the owner cannot name it',
  hooks: '"hooks" make Claude\'s own Skill-tool call need approval (denied in headless runs)',
  'user-invocable': '"user-invocable: false" stops the owner typing /name',
  when_to_use: '"when_to_use" adds to the listing budget; put the triggers in the description',
  context: '"context: fork" runs the skill without the conversation; build skills need the conversation',
};
export const RESERVED_NAMES = new Set([
  // bundled commands and skills a skill must never shadow
  'verify', 'run', 'debug', 'loop', 'init', 'review', 'code-review', 'simplify', 'security-review',
  'help', 'clear', 'compact', 'config', 'context', 'cost', 'doctor', 'exit', 'memory', 'model', 'permissions',
  'resume', 'skills', 'status', 'reload-skills', 'skill-doctor', 'add-dir', 'agents', 'hooks', 'login', 'logout',
  'mcp', 'plugin', 'export', 'rewind', 'batch', 'schedule', 'update-config', 'keybindings-help',
  'fewer-permission-prompts', 'workflow-authoring', 'design', 'design-sync', 'dataviz', 'deep-research',
  // skipped by Claude Code
  'synced', 'anthropic-skills',
]);
export const REQUIRED_SECTIONS = ['Rules that must hold', 'Workflow', 'Definition of done', 'Anti-patterns', 'Files in this skill', 'Related skills'];
const TOP_LEVEL = new Set(['SKILL.md', 'references', 'templates', 'examples', 'scripts', 'tests', 'assets']);
const MAX_SKILL_LINES = 300;
const MAX_DESCRIPTION = 300;
const TOC_THRESHOLD = 100;
const DOD_CHAR_LIMIT = 20000; // about 5,000 tokens: what survives context compaction
const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const NOT_VERBS = new Set(['this', 'these', 'those', 'its', 'is', 'was', 'always', 'various', 'across', 'towards', 'perhaps', 'thus', 'plus', 'games', 'apps', 'skills', 'tools', 'rules', 'notes', 'docs', 'settings', 'stats', 'statistics', 'graphics', 'physics', 'basics', 'us', 'yes', 'less', 'unless', 'bonus', 'canvas', 'class', 'alias', 'atlas', 'status', 'focus', 'pixels', 'levels', 'screens', 'icons', 'fonts', 'tokens', 'colours', 'colors', 'components', 'ios', 'sounds', 'ads', 'series', 'news']);
const SHOUTING = /\b(MUST|NEVER|ALWAYS|IMPORTANT|CRITICAL|MANDATORY|WARNING|DO NOT|DON'T)\b/;
const NODE_BUILTINS = new Set(['assert', 'buffer', 'child_process', 'cluster', 'console', 'crypto', 'dgram', 'dns', 'events', 'fs', 'fs/promises', 'http', 'http2', 'https', 'module', 'net', 'os', 'path', 'perf_hooks', 'process', 'querystring', 'readline', 'stream', 'string_decoder', 'timers', 'tls', 'tty', 'url', 'util', 'v8', 'vm', 'worker_threads', 'zlib', 'test', 'sqlite']);
const SCRIPT_TIMEOUT_MS = 30000;

/** Every rule the validator reports, with the one-line meaning (printed by --help). */
export const RULES = {
  'skill-md': 'the folder has a SKILL.md',
  'fm-line1': '"---" is exactly line 1 (no blank line, no BOM)',
  'fm-close': 'the frontmatter has a closing "---" line',
  'fm-yaml': 'the frontmatter is inside the strict YAML subset (one-line values, quoted when they hold ": " or " #")',
  'fm-key': `only these keys: ${ALLOWED_KEYS.join(', ')}`,
  'fm-no-disable-model-invocation': 'no disable-model-invocation (the owner names skills in plain words)',
  'fm-no-allowed-tools': 'no allowed-tools (it makes autonomous runs ask for permission)',
  'name-format': 'name is 1-64 chars of [a-z0-9-], no leading, trailing or double hyphen',
  'name-match': 'name equals the folder name',
  'name-reserved': 'name does not shadow a bundled command and has no "claude"/"anthropic"',
  'desc-length': `description is present and at most ${MAX_DESCRIPTION} characters`,
  'desc-angle': 'description has no < or >',
  'desc-verb': 'description starts with a third-person verb ("Builds", "Checks")',
  'desc-person': 'description has no "I" or "you"',
  'desc-trigger': 'description says "Use when ..."',
  'skill-lines': `SKILL.md has at most ${MAX_SKILL_LINES} lines`,
  sections: `SKILL.md has an H1 title, an intro line, then the sections in order: ${REQUIRED_SECTIONS.join(' > ')}`,
  'section-format': 'numbered rules and workflow, "- [ ]" done items, the Files table header, Related skills list',
  'dod-position': `the Definition of done ends within the first ${DOD_CHAR_LIMIT} characters (survives compaction)`,
  'dod-script': 'a skill with scripts ends its Definition of done with a ${CLAUDE_SKILL_DIR}/scripts/ run that prints RESULT: PASS',
  'link-resolve': 'every relative link and ${CLAUDE_SKILL_DIR} path resolves to a file inside the skill',
  'files-listed': 'every file in the skill is listed in the "Files in this skill" table (a "dir/" row covers a folder)',
  'files-exist': 'every file the table lists exists',
  'ref-toc': `references longer than ${TOC_THRESHOLD} lines start with a table of contents`,
  'no-project-ref': 'no project knowledge paths (docs/, design/, idea-hunt, spec.txt, SPEC.md, 99-final-decisions, /Users/, scratchpad, ../, other skill folders, CLAUDE_PROJECT_DIR)',
  'no-shouting': 'no ALL-CAPS shouting (MUST, NEVER, ALWAYS, IMPORTANT, ...) outside code',
  'device-explicit': 'every documented or scripted maestro, simctl and xcodebuild call names its simulator: maestro --device <udid> before the command, a simctl UDID (never booted or all), xcodebuild -destination id=<udid>',
  layout: 'only SKILL.md, references/, templates/, examples/, scripts/, tests/, assets/; no symlinks or empty folders',
  'script-lib': 'scripts are Node .mjs entry points that import ./check-lib.mjs (selftest.mjs uses runSelftest)',
  'script-deps': 'scripts import only node: built-ins, relative files, or packages pinned in scripts/package.json (loaded with await import())',
  'script-help': 'every script prints "Usage:" and exits 0 for --help',
  'script-result': 'every script run with no arguments in an empty folder exits 0, 1 or 2 and ends with the RESULT line',
  'selftest-missing': 'a skill with scripts has scripts/selftest.mjs',
  fixtures: 'the self-test has tests/fixtures/good/ and bad-*/ folders; each bad-*, pass-* and error-* case has a non-empty EXPECT.txt',
  'shared-json': 'assets/shared.json is a valid list of { "from", "to" } entries',
  'shared-drift': 'every declared shared file is identical to the canonical copy (run sync-shared.mjs)',
  'shared-undeclared': 'a check-lib.mjs copy is declared in assets/shared.json',
  'library-layout': 'skills/ holds only skill folders, _library/ and README.md',
};

// ---------------------------------------------------------------------------------------------
// Markdown helpers
// ---------------------------------------------------------------------------------------------

/** Lines of a markdown file with fenced code blanked and inline code masked (line numbers kept). */
export function proseLines(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let fence = null;
  return lines.map((line) => {
    const opener = /^\s*(```|~~~)/.exec(line);
    if (fence) {
      if (opener && line.trim().startsWith(fence)) fence = null;
      return '';
    }
    if (opener) {
      fence = opener[1];
      return '';
    }
    return line.replace(/(`+)([\s\S]*?)\1/g, (match) => ' '.repeat(match.length));
  });
}

/** Headings outside fenced code: [{ level, text, line (1-based), index (0-based) }]. */
function headings(lines, offset = 0) {
  const out = [];
  let fence = null;
  lines.forEach((line, index) => {
    const opener = /^\s*(```|~~~)/.exec(line);
    if (fence) {
      if (opener && line.trim().startsWith(fence)) fence = null;
      return;
    }
    if (opener) {
      fence = opener[1];
      return;
    }
    const match = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (match) out.push({ level: match[1].length, text: match[2].trim(), line: index + 1 + offset, index });
  });
  return out;
}

function sectionLines(lines, heads, title) {
  const start = heads.find((head) => head.level === 2 && head.text.toLowerCase() === title.toLowerCase());
  if (!start) return null;
  const next = heads.find((head) => head.index > start.index && head.level <= 2);
  return { head: start, lines: lines.slice(start.index + 1, next ? next.index : lines.length), firstIndex: start.index + 1 };
}

function tableRows(sectionText) {
  return sectionText.filter((line) => /^\s*\|/.test(line)).map((line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim()));
}

/** The path named in the first cell of a Files table row. */
function cellPath(cell) {
  const code = /`([^`]+)`/.exec(cell);
  if (code) return code[1].trim();
  const link = /\[[^\]]*\]\(([^)\s]+)\)/.exec(cell);
  if (link) return link[1].trim();
  return cell.replace(/\*\*/g, '').trim();
}

function normalizeRel(path) {
  return posix.normalize(path.replace(/^\.\//, '').replace(/^\$\{CLAUDE_SKILL_DIR\}\//, ''));
}

// ---------------------------------------------------------------------------------------------
// Project-reference detection
// ---------------------------------------------------------------------------------------------

const URL_PATTERN = /\b[a-z][a-z0-9+.-]*:\/\/[^\s)\]'"`>]+/gi;
const TOKEN_PATTERN = /[A-Za-z0-9_.~@$%{}+*-]*(?:\/[A-Za-z0-9_.~@$%{}+*-]*)+/g;
const WORD_REFS = [
  [/spec\.txt/i, 'the project spec file'],
  [/\bSPEC\.md\b/, 'a project spec file'],
  [/99-final-decisions/, 'the final-decisions document'],
  [/idea-hunt/, 'the idea-hunt research folder'],
  [/scratchpad/i, 'a scratchpad location'],
  [/\/Users\//, 'an absolute path in a user home folder'],
  [/\/private\/tmp\/|\/tmp\/claude-/, 'a temporary scratch path'],
  [/CLAUDE_PROJECT_DIR/, 'CLAUDE_PROJECT_DIR (it points outside the skill)'],
];
const KNOWLEDGE_DIRS = new Set(['docs', 'design', 'idea-hunt']);

/** The skill files the device-explicit rule reads: every markdown file, and scripts and shell snippets. */
function isDeviceScanned(rel) {
  if (rel.endsWith('.md')) return true;
  if (rel.startsWith('scripts/') && /\.(mjs|sh)$/.test(rel) && rel !== 'scripts/check-lib.mjs') return true;
  return /\.sh$/.test(rel);
}

/** Find project references in one line. Returns [{ index, what }]. */
export function findProjectRefs(line, { markdownProse = false, script = false } = {}) {
  const found = [];
  const clean = line.replace(URL_PATTERN, (match) => ' '.repeat(match.length));
  for (const [pattern, what] of WORD_REFS) {
    const match = pattern.exec(clean);
    if (match) found.push({ index: match.index, what });
  }
  for (const match of clean.matchAll(TOKEN_PATTERN)) {
    const token = match[0];
    const segments = token.split('/');
    while (segments.length && ['', '.', '..', 'E07'].includes(segments[0])) segments.shift();
    if (segments.length >= 2 && KNOWLEDGE_DIRS.has(segments[0])) {
      found.push({ index: match.index, what: `the project folder ${segments[0]}/ (${token})` });
      continue;
    }
    const k = segments.findIndex((segment, i) => segment === 'skills' && (i === 0 || segments[i - 1] === '.claude'));
    if (k !== -1) {
      const next = segments[k + 1];
      if (next === '_library') {
        const toolOnly = segments.length === k + 3 && /^[a-z0-9-]+\.mjs$/.test(segments[k + 2]);
        if (!toolOnly) found.push({ index: match.index, what: `library internals (${token}); only skills/_library/<tool>.mjs commands may be named` });
      } else if (next && NAME_PATTERN.test(next)) {
        found.push({ index: match.index, what: `a skill folder path (${token})` });
      }
    }
  }
  if (markdownProse) {
    const index = clean.indexOf('../');
    if (index !== -1) found.push({ index, what: 'a "../" path that leaves the folder' });
  }
  if (script) {
    const index = clean.indexOf('../../');
    if (index !== -1) found.push({ index, what: 'a "../../" path that leaves the skill' });
  }
  return found;
}

// ---------------------------------------------------------------------------------------------
// Device-explicit calls: maestro, simctl and xcodebuild always name their simulator
// ---------------------------------------------------------------------------------------------

// Several sessions share one Mac. A call that picks "the booted simulator" (or Maestro's first
// device) can reach another session's simulator: a hierarchy dump from someone else's screen, a
// shutdown of someone else's run. So every command line a skill documents or scripts names its
// device: maestro --device <udid> before the command, a simctl UDID or variable, and xcodebuild
// -destination id=<udid> (or generic/platform=... for an archive, which targets no device).
const MAESTRO_DEVICE_COMMANDS = new Set(['test', 'hierarchy', 'record', 'start-device']);
const MAESTRO_VALUE_OPTIONS = new Set(['--device', '--udid', '--driver-host-port', '--host', '--port', '--platform', '-p']);
const SIMCTL_DEVICE_COMMANDS = new Set([
  'boot', 'shutdown', 'erase', 'delete', 'rename', 'clone', 'install', 'uninstall', 'launch', 'terminate', 'openurl', 'addmedia',
  'io', 'spawn', 'get_app_container', 'listapps', 'appinfo', 'privacy', 'push', 'keychain', 'status_bar', 'ui', 'pbcopy', 'pbpaste',
  'pbsync', 'bootstatus', 'getenv', 'location', 'icloud_sync', 'upgrade', 'diagnose', 'logverbose', 'install_app_data', 'notify_post',
]);
const IMPLICIT_SIMCTL_DEVICES = new Set(['booted', 'all']);
// A span that forbids the command ("never `xcrun simctl shutdown all`") names it without running it.
const NEGATION_BEFORE = /\b(never|not|no|avoid|without|instead of|rather than|forbidden|banned|refuses?|rejects?|don't)\b[^.,;:!?]{0,40}$/i;
const ARG_LIKE = /^(?:-|<|\$|"|'|>|\||\.{0,2}\/|[\w.@-]*\/|[\w.@-]+\.(?:ya?ml|json|mp4|png|txt)\b)/;
const OPERAND_LIKE = /^(?:<|\$|"\$|'\$|\.{0,2}\/|[\w.@${}-]*\/|[\w.@-]+\.(?:ya?ml|json)\b)/;

const cleanToken = (token) => token.replace(/^[`'"(]+|[`'",;)]+$/g, '');

/** maestro command lines in one span of command text: [{ index, what }]. */
function maestroTextHits(text, { isCode }) {
  const hits = [];
  const word = /(?:^|[\s;&|(`"'=])((?:[\w.~${}-]*\/)*maestro|"?\$\{?MAESTRO\w*\}?"?)(?=\s)/g;
  for (const match of text.matchAll(word)) {
    const start = match.index + match[0].length - match[1].length;
    const tokens = text.slice(start + match[1].length).trim().split(/\s+/).filter(Boolean);
    const globals = [];
    let i = 0;
    while (i < tokens.length && tokens[i].startsWith('-')) {
      const option = tokens[i].split('=')[0];
      globals.push(option);
      i += MAESTRO_VALUE_OPTIONS.has(option) && !tokens[i].includes('=') ? 2 : 1;
    }
    const sub = tokens[i];
    if (!sub || !MAESTRO_DEVICE_COMMANDS.has(sub)) continue;
    const rest = tokens.slice(i + 1);
    const isCommandLine = isCode || (sub === 'test' || sub === 'record' ? rest.some((token) => !token.startsWith('-') && OPERAND_LIKE.test(token)) : rest.length > 0 && ARG_LIKE.test(rest[0]));
    if (!isCommandLine || globals.includes('--device')) continue;
    hits.push({ index: start, what: `"maestro ${sub}" without --device <udid> before the command`, fix: `Write maestro --device <udid> ${sub} ... (the global option comes before the command; in code build the arguments with maestroGlobalArgs()), so the call can only reach this session's simulator.` });
  }
  return hits;
}

/** simctl calls in one span of command text that pick booted or all: [{ index, what }]. */
function simctlTextHits(text) {
  const hits = [];
  for (const match of text.matchAll(/\bsimctl\s+(?:--set\s+\S+\s+)?([a-z_]+)((?:\s+-{1,2}[\w-]+(?:=\S+)?)*)\s+(\S+)/g)) {
    const device = cleanToken(match[3]);
    if (SIMCTL_DEVICE_COMMANDS.has(match[1]) && IMPLICIT_SIMCTL_DEVICES.has(device)) {
      hits.push({ index: match.index, what: `"simctl ${match[1]} ${device}" targets ${device === 'all' ? 'every simulator on the Mac' : 'whichever simulator is booted'}`, fix: 'Name the simulator by its UDID (xcrun simctl <command> "$UDID" ...; find it with xcrun simctl list devices -j and the e07-<purpose> name), so the call never touches another session\'s simulator.' });
    }
  }
  return hits;
}

/** xcodebuild -destination values that do not name the simulator by id=. */
function destinationHits(text) {
  const hits = [];
  for (const match of text.matchAll(/(?<![\w-])-destination(?![\w-])/g)) {
    let i = match.index + match[0].length;
    const skip = () => {
      while (i < text.length && /[\s,]/.test(text[i])) i += 1;
    };
    skip();
    if (/['"`]/.test(text[i]) && /^['"`]\s*,/.test(text.slice(i))) {
      i += 1;
      skip();
    }
    let value;
    let quoted = false;
    if (/['"`]/.test(text[i] ?? '')) {
      const quote = text[i];
      const end = text.indexOf(quote, i + 1);
      value = text.slice(i + 1, end === -1 ? text.length : end);
      quoted = true;
    } else {
      value = /^[^\s,)\]`;]*/.exec(text.slice(i))[0];
    }
    if (value === '') continue;
    const variable = /^\$|^<|^\{/.test(value) || (!quoted && /^[A-Za-z_][\w.]*$/.test(value) && !value.includes('='));
    if (variable || /(^|[,\s])id=/.test(value) || value.startsWith('generic/')) continue;
    hits.push({ index: match.index, what: `xcodebuild -destination "${value}" does not name the simulator by id=`, fix: 'Use -destination id=<udid> (or "id=$UDID") for a simulator build, and generic/platform=iOS only for an archive, so xcodebuild never picks a simulator by name or OS.' });
  }
  return hits;
}

/** maestro, simctl and xcodebuild calls written as code: maestro('--device', udid, 'hierarchy'), simctl('io', 'booted', ...). */
function callFormHits(line) {
  const hits = [];
  const call = /(?:\b(?:run)?[Mm]aestro\w*\s*\(|['"]maestro['"]\s*,\s*\[|\[\s*['"]maestro['"])/g;
  for (const match of line.matchAll(call)) {
    const after = line.slice(match.index);
    const sub = /['"](test|hierarchy|record|start-device)['"]/.exec(after);
    if (!sub) continue;
    const before = after.slice(0, sub.index);
    if (/['"]--device['"]/.test(before) || /\b(?:maestro(?:Global)?Args|deviceArgs)\s*\(/.test(line)) continue;
    hits.push({ index: match.index, what: `a maestro "${sub[1]}" call without "--device", <udid> before the command`, fix: `Build the arguments with maestroGlobalArgs() or pass '--device', udid before '${sub[1]}'.` });
  }
  const simctlCall = /(?:\bsimctl\s*\(\s*|\[\s*['"]simctl['"]\s*,\s*)['"]([a-z_]+)['"]\s*,\s*(?:['"]-[\w-]+['"]\s*,\s*)*['"](booted|all)['"]/g;
  for (const match of line.matchAll(simctlCall)) {
    if (SIMCTL_DEVICE_COMMANDS.has(match[1])) hits.push({ index: match.index, what: `a simctl "${match[1]}" call on "${match[2]}"`, fix: 'Pass the simulator\'s UDID (a variable), never booted or all.' });
  }
  return hits;
}

/**
 * Calls in one file that reach a simulator without naming it. kind 'md' reads fenced code lines
 * and inline code spans (a forbidding sentence or an Anti-patterns section names a command
 * without running it); kind 'script' reads every line. Returns [{ line, what, fix }].
 */
export function findImplicitDeviceCalls(text, { kind = 'md' } = {}) {
  const found = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const push = (line, hits) => {
    for (const hit of hits) if (!found.some((item) => item.line === line && item.what === hit.what)) found.push({ line, what: hit.what, fix: hit.fix });
  };
  const negated = (prefix) => NEGATION_BEFORE.test(prefix);
  if (kind === 'script') {
    // A script whose maestro runner is built for one device (maestroGlobalArgs(), or a
    // make/createMaestro factory given the udid) names the device in every call through that runner.
    const bindsDevice = /\bmaestro(?:Global)?Args\s*\(/.test(text) || /\b(?:make|create)\w*Maestro\w*\s*\([^)]*\b(?:udid|device)\b/i.test(text);
    lines.forEach((line, i) => {
      const calls = callFormHits(line).filter((hit) => !(bindsDevice && hit.what.startsWith('a maestro')));
      const hits = [...maestroTextHits(line, { isCode: false }), ...simctlTextHits(line), ...destinationHits(line), ...calls];
      push(i + 1, hits.filter((hit) => !negated(line.slice(0, hit.index))));
    });
    return found;
  }
  let fence = null;
  let section = '';
  let continued = null;
  lines.forEach((line, i) => {
    const opener = /^\s*(```|~~~)/.exec(line);
    if (fence) {
      if (opener && line.trim().startsWith(fence)) {
        fence = null;
        continued = null;
        return;
      }
      if (/^\s*anti-patterns\s*$/i.test(section)) return;
      // A shell command continued with a trailing backslash is one command line.
      const start = continued ?? { line: i + 1, text: '' };
      start.text += `${line.replace(/\\\s*$/, '')} `;
      if (/\\\s*$/.test(line)) {
        continued = start;
        return;
      }
      continued = null;
      push(start.line, [...maestroTextHits(start.text, { isCode: true }), ...simctlTextHits(start.text), ...destinationHits(start.text), ...callFormHits(start.text)]);
      return;
    }
    if (opener) {
      fence = opener[1];
      return;
    }
    const heading = /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading && /^#{1,2}\s/.test(line)) section = heading[1];
    if (/^\s*anti-patterns\s*$/i.test(section)) return;
    for (const span of line.matchAll(/(`+)([\s\S]*?)\1/g)) {
      if (negated(line.slice(0, span.index))) continue;
      const code = span[2];
      push(i + 1, [...maestroTextHits(code, { isCode: false }), ...simctlTextHits(code), ...destinationHits(code), ...callFormHits(code)]);
    }
  });
  return found;
}

// ---------------------------------------------------------------------------------------------
// Per-skill validation
// ---------------------------------------------------------------------------------------------

function listDirs(root) {
  const out = [];
  const visit = (abs) => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name === '.git') continue;
      const child = join(abs, entry.name);
      out.push(toPosix(relative(root, child)));
      visit(child);
    }
  };
  visit(root);
  return out;
}

function runScript(script, args) {
  const cwd = makeTempDir('validate-skills-');
  try {
    const result = spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8', timeout: SCRIPT_TIMEOUT_MS, maxBuffer: 32 * 1024 * 1024 });
    return { status: result.status, stdout: result.stdout ?? '', output: `${result.stdout ?? ''}${result.stderr ?? ''}`, timedOut: result.error?.code === 'ETIMEDOUT' };
  } finally {
    removeTempDir(cwd);
  }
}

function lastLine(text) {
  return text.split('\n').map((line) => line.trimEnd()).filter(Boolean).at(-1) ?? '';
}

function importSpecifiers(source) {
  const specs = [];
  const patterns = [
    { re: /^\s*import\s+(?:[^;'"]*?\s+from\s+)?['"]([^'"]+)['"]/gm, dynamic: false },
    { re: /^\s*export\s+[^;'"]*?\s+from\s+['"]([^'"]+)['"]/gm, dynamic: false },
    { re: /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g, dynamic: true },
    { re: /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g, dynamic: false },
  ];
  for (const { re, dynamic } of patterns) {
    for (const match of source.matchAll(re)) specs.push({ spec: match[1], index: match.index + match[0].indexOf(match[1]), dynamic });
  }
  return specs;
}

function lineAt(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (text.charCodeAt(i) === 10) line += 1;
  return line;
}

export function validateSkill(target, roots, { runScripts = true } = {}) {
  const problems = [];
  const label = targetLabel(target);
  const add = (rule, file, line, message, fix) => problems.push({ rule, file: file ? `${label}/${file}` : label, line, message, fix });
  const dir = target.dir;
  const folderName = dir.split('/').pop();

  // ---- files and layout ----
  const symlinks = [];
  const files = walk(dir, { defaultIgnores: false, ignore: ['node_modules', '.git', '.DS_Store'], onSymlink: (rel) => symlinks.push(rel) });
  for (const rel of symlinks) add('layout', rel, 0, 'is a symlink; a skill must hold real files so it works when copied', 'Replace the link with the file itself (sync-shared copies shared files).');
  const topLevel = new Set([...files.map((rel) => rel.split('/')[0]), ...listDirs(dir).map((rel) => rel.split('/')[0])]);
  for (const entry of [...topLevel].sort()) {
    if (!TOP_LEVEL.has(entry)) add('layout', entry, 0, `"${entry}" is not part of the skill layout (SKILL.md, references/, templates/, examples/, scripts/, tests/, assets/)`, 'Move it into one of those folders or delete it.');
  }
  for (const rel of listDirs(dir)) {
    const hasContent = readdirSync(join(dir, rel)).some((name) => name !== '.DS_Store');
    if (!hasContent) add('layout', `${rel}/`, 0, 'empty folder', 'Delete it; create only the folders the skill needs.');
  }
  for (const rel of files) {
    if (rel !== 'SKILL.md' && rel.endsWith('/SKILL.md') && !rel.startsWith('tests/fixtures/')) add('layout', rel, 0, 'nested SKILL.md outside tests/fixtures', 'A skill is one folder deep; remove the nested SKILL.md.');
  }

  // ---- SKILL.md ----
  const skillPath = join(dir, 'SKILL.md');
  if (!existsSync(skillPath)) {
    add('skill-md', 'SKILL.md', 0, 'missing', 'Create SKILL.md from the skill template.');
    return problems;
  }
  const rawSkill = readFileSync(skillPath, 'utf8');
  const skillText = rawSkill.replace(/\r\n/g, '\n');
  const fm = splitFrontmatter(rawSkill);
  if (!fm.line1Ok) add('fm-line1', 'SKILL.md', 1, fm.bom ? 'starts with a byte-order mark before "---"' : 'line 1 is not exactly "---", so Claude Code reads no frontmatter at all', 'Make "---" the very first line of the file.');
  let data = {};
  let keyLines = {};
  if (fm.found && !fm.closed) add('fm-close', 'SKILL.md', 1, 'the frontmatter has no closing "---" line', 'Add a line with exactly "---" after the last frontmatter key.');
  if (!fm.found && fm.line1Ok === false) {
    // Nothing to parse; fm-line1 already says why.
  }
  if (fm.closed) {
    const parsed = parseYamlSubset(fm.yaml);
    data = parsed.data;
    keyLines = parsed.lines;
    for (const error of parsed.errors) add('fm-yaml', 'SKILL.md', error.line, error.message, 'Keep each value on one line and wrap values that contain ": " or " #" in double quotes.');
    for (const key of Object.keys(parsed.lines)) {
      if (key === 'disable-model-invocation') add('fm-no-disable-model-invocation', 'SKILL.md', parsed.lines[key], 'disable-model-invocation hides the skill from Claude, so naming it in plain words stops working', 'Delete the disable-model-invocation line.');
      else if (key === 'allowed-tools') add('fm-no-allowed-tools', 'SKILL.md', parsed.lines[key], 'allowed-tools makes Claude\'s own invocation of the skill ask for permission (denied in headless runs)', 'Delete the allowed-tools line; project settings allow the skill scripts.');
      else if (!ALLOWED_KEYS.includes(key)) add('fm-key', 'SKILL.md', parsed.lines[key], `key "${key}" is not allowed${KEY_ADVICE[key] ? `: ${KEY_ADVICE[key]}` : ''}`, `Use only ${ALLOWED_KEYS.join(', ')}.`);
    }
    // name
    const nameLine = keyLines.name ?? 1;
    if (!('name' in keyLines)) add('name-format', 'SKILL.md', 1, 'no name key', `Add "name: ${folderName}".`);
    else if ('name' in data) {
      const name = data.name;
      if (typeof name !== 'string' || name.length === 0 || name.length > 64 || !NAME_PATTERN.test(name)) {
        add('name-format', 'SKILL.md', nameLine, `name ${JSON.stringify(name)} is not 1-64 characters of lowercase letters, digits and single hyphens`, 'Use a kebab-case name such as "toybox-components".');
      } else {
        if (name !== folderName) add('name-match', 'SKILL.md', nameLine, `name "${name}" differs from the folder name "${folderName}"`, 'Make the name and the folder name the same.');
        if (RESERVED_NAMES.has(name) || /claude|anthropic/.test(name)) add('name-reserved', 'SKILL.md', nameLine, `name "${name}" is reserved (a bundled command, or contains "claude"/"anthropic")`, 'Pick a more specific name, for example with a pocket-arcade- or domain prefix.');
      }
    }
    // description
    const descLine = keyLines.description ?? 1;
    if (!('description' in keyLines)) add('desc-length', 'SKILL.md', 1, 'no description key', 'Add a one-line description: "<Verb>s ... Use when ...".');
    else if ('description' in data) {
      const desc = data.description;
      if (typeof desc !== 'string' || desc.trim() === '') add('desc-length', 'SKILL.md', descLine, 'description is empty', 'Write what the skill does and when to use it.');
      else {
        if (desc.length > MAX_DESCRIPTION) add('desc-length', 'SKILL.md', descLine, `description is ${desc.length} characters (limit ${MAX_DESCRIPTION})`, 'Cut it to the trigger words and the one job.');
        if (/[<>]/.test(desc)) add('desc-angle', 'SKILL.md', descLine, 'description contains < or >', 'Remove angle brackets (write "a name" instead of "<name>").');
        const first = desc.trim().split(/\s+/)[0].replace(/[^A-Za-z'-]/g, '');
        if (!/^[A-Z][a-z]+s$/.test(first) || NOT_VERBS.has(first.toLowerCase())) add('desc-verb', 'SKILL.md', descLine, `description starts with "${first}", not a third-person verb`, 'Start with a verb such as "Builds", "Checks", "Explains" or "Adds".');
        if (/(^|[^A-Za-z0-9_/])I('m|'ll|'ve|'d)?(?![A-Za-z0-9_'/])/.test(desc) || /\b(you|your|yours|yourself|yourselves)\b/i.test(desc)) add('desc-person', 'SKILL.md', descLine, 'description speaks as "I" or to "you"', 'Write in the third person: "Builds ...", "Use when ...".');
        if (!/\bUse when\b/.test(desc)) add('desc-trigger', 'SKILL.md', descLine, 'description does not say when to use the skill', 'Add "Use when <concrete intents and trigger words>."');
      }
    }
  }

  // ---- SKILL.md body ----
  const allLines = skillText.split('\n');
  const lineCount = skillText.endsWith('\n') ? allLines.length - 1 : allLines.length;
  if (lineCount > MAX_SKILL_LINES) add('skill-lines', 'SKILL.md', MAX_SKILL_LINES + 1, `SKILL.md has ${lineCount} lines (limit ${MAX_SKILL_LINES})`, 'Move detail into references/ and link it with when to read it.');

  const entryScripts = files.filter((rel) => /^scripts\/[^/]+\.mjs$/.test(rel) && rel !== 'scripts/check-lib.mjs');
  const checkerScripts = entryScripts.filter((rel) => rel !== 'scripts/selftest.mjs');

  if (fm.closed) {
    const offset = fm.bodyStart;
    const body = fm.lines.slice(offset);
    const heads = headings(body, offset);
    const h2 = heads.filter((head) => head.level === 2);
    const firstContent = body.findIndex((line) => line.trim() !== '');
    const firstHead = heads[0];
    if (!firstHead || firstHead.level !== 1 || firstHead.index !== firstContent) add('sections', 'SKILL.md', offset + firstContent + 1, 'the body does not start with an H1 title ("# Title")', 'Start the body with "# <Title>" and one or two sentences on what the skill makes true.');
    else {
      if (heads.filter((head) => head.level === 1).length > 1) add('sections', 'SKILL.md', heads.filter((head) => head.level === 1)[1].line, 'more than one H1 title', 'Keep one "# Title"; use "##" for sections.');
      const nextHead = heads[1];
      const intro = body.slice(firstHead.index + 1, nextHead ? nextHead.index : body.length).some((line) => line.trim() !== '');
      if (!intro) add('sections', 'SKILL.md', firstHead.line, 'no intro sentence under the title', 'Add one or two sentences on what the skill makes true.');
    }
    let lastPos = -1;
    for (const title of REQUIRED_SECTIONS) {
      const matches = h2.filter((head) => head.text.toLowerCase() === title.toLowerCase());
      if (matches.length === 0) {
        add('sections', 'SKILL.md', 0, `missing section "## ${title}"`, `Add the sections in this order: ${REQUIRED_SECTIONS.join(', ')}.`);
        continue;
      }
      if (matches.length > 1) add('sections', 'SKILL.md', matches[1].line, `section "## ${title}" appears twice`, 'Merge the two sections.');
      const pos = h2.indexOf(matches[0]);
      if (pos < lastPos) add('sections', 'SKILL.md', matches[0].line, `section "## ${title}" is out of order`, `Order the sections: ${REQUIRED_SECTIONS.join(', ')}.`);
      lastPos = Math.max(lastPos, pos);
    }
    if (h2.length > 0 && h2[0].text.toLowerCase() !== REQUIRED_SECTIONS[0].toLowerCase() && h2.some((head) => head.text.toLowerCase() === REQUIRED_SECTIONS[0].toLowerCase())) {
      add('sections', 'SKILL.md', h2[0].line, `"## ${h2[0].text}" comes before "## ${REQUIRED_SECTIONS[0]}"`, 'Put "## Rules that must hold" first, right under the intro, so it survives compaction.');
    }

    const rules = sectionLines(body, heads, 'Rules that must hold');
    if (rules && !rules.lines.some((line) => /^\d+\.\s+\S/.test(line))) add('section-format', 'SKILL.md', rules.head.line, '"Rules that must hold" has no numbered rules', 'Write the rules as "1. **Rule.** Why it matters."');
    const workflow = sectionLines(body, heads, 'Workflow');
    if (workflow && !workflow.lines.some((line) => /^\d+\.\s+\S/.test(line))) add('section-format', 'SKILL.md', workflow.head.line, '"Workflow" has no numbered steps', 'Write the workflow as numbered steps.');
    const dod = sectionLines(body, heads, 'Definition of done');
    if (dod) {
      const items = dod.lines.map((line, i) => ({ line, i })).filter(({ line }) => /^\s*- \[ \]\s+\S/.test(line));
      if (items.length === 0) add('section-format', 'SKILL.md', dod.head.line, '"Definition of done" has no "- [ ]" checklist items', 'Write each done condition as "- [ ] ...".');
      const endIndex = dod.firstIndex + dod.lines.length;
      const endChar = fm.lines.slice(0, offset + endIndex).join('\n').length;
      if (endChar > DOD_CHAR_LIMIT) add('dod-position', 'SKILL.md', dod.head.line, `the Definition of done ends at character ${endChar}; only about the first ${DOD_CHAR_LIMIT} survive compaction`, 'Shorten the intro, rules and workflow, and move detail into references/.');
      if (checkerScripts.length > 0 && items.length > 0) {
        const last = items.at(-1).line;
        if (!last.includes('${CLAUDE_SKILL_DIR}/scripts/') || !last.includes('RESULT: PASS')) {
          add('dod-script', 'SKILL.md', dod.head.line + 1 + items.at(-1).i, 'the last done item is not a skill script run that must print RESULT: PASS', 'End with "- [ ] `node ${CLAUDE_SKILL_DIR}/scripts/<check>.mjs <args>` prints `RESULT: PASS`".');
        }
      }
    }
    const filesSection = sectionLines(body, heads, 'Files in this skill');
    let listed = [];
    if (filesSection) {
      const rows = tableRows(filesSection.lines);
      const header = rows[0]?.map((cell) => cell.toLowerCase());
      if (!header || header[0] !== 'file' || header[1] !== 'what it is' || !/^read\/run when/.test(header[2] ?? '')) {
        add('section-format', 'SKILL.md', filesSection.head.line, 'the Files table header is not "| File | What it is | Read/run when |"', 'Use exactly that header row.');
      }
      listed = rows.slice(1).filter((cells) => !cells.every((cell) => /^:?-{3,}:?$/.test(cell))).map((cells) => ({ path: cellPath(cells[0] ?? ''), line: 0 }));
      filesSection.lines.forEach((line, i) => {
        const cells = /^\s*\|/.test(line) ? line.trim().replace(/^\|/, '').split('|') : null;
        if (!cells) return;
        const path = cellPath(cells[0].trim());
        const item = listed.find((entry) => entry.path === path && entry.line === 0);
        if (item) item.line = filesSection.head.line + 1 + i;
      });
    }
    const related = sectionLines(body, heads, 'Related skills');
    if (related && !related.lines.some((line) => /^\s*- \S/.test(line))) add('section-format', 'SKILL.md', related.head.line, '"Related skills" has no list items', 'List related skills as "- `name` - when to hand off", or "- None".');

    // files-listed / files-exist
    const normalized = listed.map((entry) => ({ ...entry, rel: normalizeRel(entry.path) }));
    for (const entry of normalized) {
      if (!entry.path) continue;
      const isDirRow = entry.path.endsWith('/');
      const abs = join(dir, entry.rel);
      if (!existsSync(abs) || (isDirRow && !statSync(abs).isDirectory())) add('files-exist', 'SKILL.md', entry.line, `the Files table lists ${entry.path}, which does not exist`, 'Remove the row or add the file.');
    }
    for (const rel of files) {
      if (rel === 'SKILL.md') continue;
      const covered = normalized.some((entry) => entry.rel === rel || (entry.path.endsWith('/') && rel.startsWith(`${entry.rel.replace(/\/$/, '')}/`)));
      if (!covered) add('files-listed', rel, 0, 'is not listed in the "Files in this skill" table', `Add a row: | \`${rel}\` | what it is | when to read or run it |`);
    }
  }

  // ---- markdown links, ToC, shouting ----
  for (const rel of files.filter((path) => path.endsWith('.md') && !path.startsWith('tests/fixtures/'))) {
    const text = readFileSync(join(dir, rel), 'utf8').replace(/\r\n/g, '\n');
    const prose = proseLines(text);
    prose.forEach((line, i) => {
      const targets = [];
      for (const match of line.matchAll(/!?\[[^\]]*\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g)) targets.push(match[1]);
      const refDef = /^\s*\[[^\]]+\]:\s*(\S+)/.exec(line);
      if (refDef) targets.push(refDef[1]);
      for (const raw of targets) {
        if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('#')) continue;
        let clean = raw.replace(/[#?].*$/, '');
        try {
          clean = decodeURIComponent(clean);
        } catch {
          // keep the raw text
        }
        if (clean === '') continue;
        const base = clean.startsWith('${CLAUDE_SKILL_DIR}/') ? dir : dirname(join(dir, rel));
        const abs = resolve(base, clean.replace(/^\$\{CLAUDE_SKILL_DIR\}\//, ''));
        const inside = abs === dir || abs.startsWith(`${dir}/`);
        let real = abs;
        try {
          real = realpathSync(abs);
        } catch {
          real = abs;
        }
        const realDir = realpathSync(dir);
        if (!inside || !(real === realDir || real.startsWith(`${realDir}/`))) add('link-resolve', rel, i + 1, `link "${raw}" points outside the skill`, 'Copy the content into this skill and link the copy.');
        else if (!existsSync(abs)) add('link-resolve', rel, i + 1, `link "${raw}" does not resolve to a file in the skill`, 'Fix the path or add the file.');
      }
      if (SHOUTING.test(line)) add('no-shouting', rel, i + 1, `shouting "${SHOUTING.exec(line)[0]}"`, 'Write calmly and explain why; use bold for emphasis sparingly.');
    });
    // ${CLAUDE_SKILL_DIR} paths anywhere in the file, code included.
    text.split('\n').forEach((line, i) => {
      for (const match of line.matchAll(/\$\{CLAUDE_SKILL_DIR\}\/([A-Za-z0-9_.\/-]+)/g)) {
        const path = match[1].replace(/[.,;:]+$/, '');
        if (/[*<]/.test(line.slice(match.index + match[0].length, match.index + match[0].length + 1)) || path.endsWith('/')) continue;
        if (!existsSync(join(dir, path))) add('link-resolve', rel, i + 1, `\${CLAUDE_SKILL_DIR}/${path} does not exist in the skill`, 'Fix the path or add the file.');
      }
    });
    if (rel.startsWith('references/')) {
      const count = text.endsWith('\n') ? text.split('\n').length - 1 : text.split('\n').length;
      if (count > TOC_THRESHOLD) {
        const head = text.split('\n').slice(0, 40);
        const tocAt = head.findIndex((line) => /^(#{1,3}\s*)?(\*\*)?(table of )?contents(\*\*)?:?\s*$/i.test(line.trim()));
        const items = tocAt === -1 ? 0 : head.slice(tocAt + 1).filter((line) => /^\s*([-*]|\d+\.)\s+\S/.test(line)).length;
        if (tocAt === -1 || items < 2) add('ref-toc', rel, 1, `${count} lines and no table of contents near the top`, 'Add "## Contents" with a list of the sections right after the title.');
      }
    }
  }

  // ---- project references ----
  for (const rel of files.filter((path) => !path.startsWith('tests/fixtures/'))) {
    const buffer = readFileSync(join(dir, rel));
    if (isBinary(buffer)) continue;
    const text = buffer.toString('utf8').replace(/\r\n/g, '\n');
    const isMd = rel.endsWith('.md');
    const isScript = rel.startsWith('scripts/');
    const prose = isMd ? proseLines(text) : null;
    text.split('\n').forEach((line, i) => {
      const refs = findProjectRefs(line, { script: isScript });
      if (isMd) refs.push(...findProjectRefs(prose[i], { markdownProse: true }).filter((ref) => ref.what.startsWith('a "../"')));
      const seen = new Set();
      for (const ref of refs) {
        if (seen.has(ref.what)) continue;
        seen.add(ref.what);
        add('no-project-ref', rel, i + 1, `refers to ${ref.what}`, 'Copy the knowledge into this skill (references/ or assets/) and refer to the copy; name other skills only by name.');
      }
    });
  }

  // ---- device-explicit calls (SKILL.md, references, examples, templates' docs and scripts) ----
  for (const rel of files.filter((path) => !path.startsWith('tests/') && !path.startsWith('assets/') && !path.startsWith('scripts/node_modules/') && isDeviceScanned(path))) {
    const buffer = readFileSync(join(dir, rel));
    if (isBinary(buffer)) continue;
    const kind = rel.endsWith('.md') ? 'md' : 'script';
    for (const hit of findImplicitDeviceCalls(buffer.toString('utf8'), { kind })) add('device-explicit', rel, hit.line, hit.what, hit.fix);
  }

  // ---- scripts ----
  const packageJsonPath = join(dir, 'scripts', 'package.json');
  let pinned = {};
  if (existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      pinned = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
      for (const [name, version] of Object.entries(pinned)) {
        if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) add('script-deps', 'scripts/package.json', 0, `${name} is pinned as "${version}", not an exact version`, 'Pin an exact version such as "1.2.3".');
      }
    } catch (error) {
      add('script-deps', 'scripts/package.json', 0, `not valid JSON: ${error.message}`, 'Fix the JSON.');
    }
  }
  for (const rel of files.filter((path) => path.startsWith('scripts/') && !path.startsWith('scripts/node_modules/'))) {
    const isTopLevel = /^scripts\/[^/]+$/.test(rel);
    if (isTopLevel && !/\.(mjs|json)$/.test(rel) && !['scripts/.gitignore'].includes(rel)) {
      add('script-lib', rel, 0, 'scripts are Node ESM .mjs files', 'Rewrite it as a .mjs script that uses check-lib (helpers go in scripts/lib/).');
    }
    if (!rel.endsWith('.mjs') || rel === 'scripts/check-lib.mjs') continue;
    const source = readFileSync(join(dir, rel), 'utf8');
    for (const { spec, index, dynamic } of importSpecifiers(source)) {
      if (spec.startsWith('node:') || spec.startsWith('./') || spec.startsWith('../')) continue;
      const line = lineAt(source, index);
      const root = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
      if (NODE_BUILTINS.has(spec) || NODE_BUILTINS.has(root)) add('script-deps', rel, line, `imports "${spec}" without the node: prefix`, `Import "node:${spec}".`);
      else if (!(root in pinned)) add('script-deps', rel, line, `imports the package "${spec}", which scripts/package.json does not pin`, 'Use node: built-ins only, or pin the package in scripts/package.json and install it with npm ci --prefix.');
      else if (!dynamic) add('script-deps', rel, line, `imports the package "${spec}" statically, so --help fails before npm ci`, `Load it inside main() with await import('${spec}') and exit 2 with the install command when it is missing.`);
    }
    if (!isTopLevel) continue;
    if (!/from\s+['"]\.\/check-lib\.mjs['"]/.test(source)) add('script-lib', rel, 1, 'does not import ./check-lib.mjs', 'Import parseArgs, walk, createReporter and run from ./check-lib.mjs.');
    else if (rel === 'scripts/selftest.mjs' && !/\brunSelftest\b/.test(source)) add('script-lib', rel, 1, 'selftest.mjs does not use runSelftest', 'Call runSelftest(import.meta.url, [...]) from ./check-lib.mjs.');
  }
  if (runScripts) {
    for (const rel of entryScripts) {
      const abs = join(dir, rel);
      const help = runScript(abs, ['--help']);
      if (help.timedOut || help.status !== 0 || !/Usage:/.test(help.stdout)) {
        const said = lastLine(help.output).slice(0, 160);
        add('script-help', rel, 0, `--help ${help.timedOut ? 'timed out' : `exited ${help.status}`}${/Usage:/.test(help.stdout) ? '' : ' without a "Usage:" line'}${said ? ` (last output: ${said})` : ''}`, 'Parse arguments with parseArgs() from check-lib so --help prints usage and exits 0.');
      }
      if (rel === 'scripts/selftest.mjs') continue;
      const bare = runScript(abs, []);
      const final = lastLine(bare.stdout);
      if (bare.timedOut || ![0, 1, 2].includes(bare.status) || !RESULT_PATTERN.test(final)) {
        add('script-result', rel, 0, `run with no arguments in an empty folder: ${bare.timedOut ? 'timed out' : `exit ${bare.status}`}, last line "${final.slice(0, 120)}"`, 'Wrap main() in run() and finish with report.finish(); a missing target must exit 2 with the RESULT line.');
      }
    }
  }
  if (checkerScripts.length > 0 || entryScripts.includes('scripts/selftest.mjs')) {
    if (!files.includes('scripts/selftest.mjs')) add('selftest-missing', 'scripts/', 0, 'the skill has scripts but no scripts/selftest.mjs', 'Add scripts/selftest.mjs that calls runSelftest() on tests/fixtures.');
    else {
      const fixturesDir = join(dir, 'tests', 'fixtures');
      const childDirs = (abs) => (existsSync(abs) ? readdirSync(abs, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name) : []);
      // Suites live in tests/fixtures/ itself, or in tests/fixtures/<checker>/ when a skill has several checkers.
      const suiteRoots = [''].concat(childDirs(fixturesDir).filter((name) => name !== 'good' && !name.startsWith('bad-') && childDirs(join(fixturesDir, name)).includes('good')));
      const goods = [];
      const bads = [];
      for (const suite of suiteRoots) {
        const names = childDirs(join(fixturesDir, suite));
        if (names.includes('good')) goods.push(posix.join(suite, 'good'));
        // bad-* (exit 1), pass-* (exit 0) and error-* (exit 2) cases all pin what the checker prints.
        for (const name of names.filter((item) => /^(bad|pass|error)-./.test(item))) bads.push(posix.join(suite, name));
      }
      for (const bad of bads) {
        const expect = join(fixturesDir, bad, 'EXPECT.txt');
        if (!existsSync(expect) || readFileSync(expect, 'utf8').trim() === '') add('fixtures', `tests/fixtures/${bad}/EXPECT.txt`, 0, 'missing or empty', 'Write what the checker must print for this case (the rule id and file:line, the SKIP line, or the ERROR text), one per line.');
      }
    }
  }

  // ---- shared files ----
  const manifest = readManifest(dir, roots.shared);
  for (const error of manifest.errors) add('shared-json', 'assets/shared.json', 0, error, 'Use [{ "from": "<path in the shared folder>", "to": "<path in this skill>" }].');
  if (manifest.errors.length === 0) {
    for (const finding of compareShared(dir, manifest.entries, roots.shared)) {
      const message = finding.kind === 'missing' ? `missing copy of shared ${finding.from}` : finding.kind === 'drift' ? `differs from the canonical shared ${finding.from}` : `is not in the shared folder ${finding.from}`;
      add('shared-drift', finding.rel, 0, message, 'Run: node skills/_library/sync-shared.mjs');
    }
    const declared = new Set(manifest.entries.filter((entry) => !entry.isDir).map((entry) => entry.to));
    const importsLib = entryScripts.some((rel) => /from\s+['"]\.\/check-lib\.mjs['"]/.test(readFileSync(join(dir, rel), 'utf8')));
    if ((files.includes('scripts/check-lib.mjs') || importsLib) && !declared.has('scripts/check-lib.mjs')) {
      add('shared-undeclared', 'scripts/check-lib.mjs', 0, 'check-lib.mjs is used but not declared in assets/shared.json', 'Add { "from": "scripts/check-lib.mjs", "to": "scripts/check-lib.mjs" } to assets/shared.json, then run sync-shared.mjs.');
    }
  }
  return problems.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1));
}

function libraryLayout(roots) {
  const problems = [];
  for (const entry of readdirSync(roots.skillsRoot, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === '_library' || entry.name === 'README.md') continue;
    const abs = join(roots.skillsRoot, entry.name);
    const stat = lstatSync(abs);
    if (stat.isSymbolicLink()) problems.push({ rule: 'library-layout', file: entry.name, line: 0, message: 'is a symlink inside skills/', fix: 'Keep real skill folders in skills/; links belong in .claude/skills/.' });
    else if (!stat.isDirectory()) problems.push({ rule: 'library-layout', file: entry.name, line: 0, message: 'stray file in skills/ (only skill folders, _library/ and README.md belong there)', fix: 'Move it into a skill or into _library/.' });
    else if (entry.name.startsWith('_')) problems.push({ rule: 'library-layout', file: entry.name, line: 0, message: 'folders starting with "_" are reserved for _library', fix: 'Rename it.' });
    else if (!existsSync(join(abs, 'SKILL.md'))) problems.push({ rule: 'library-layout', file: entry.name, line: 0, message: 'folder without SKILL.md', fix: 'Add SKILL.md (copy the skill template) or remove the folder.' });
  }
  return problems;
}

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------

const SPEC = {
  name: 'validate-skills',
  summary: 'Validates skills against the Pocket Arcade authoring standard. With no arguments it checks every skill folder in skills/, the skill template, and the layout of skills/ itself.',
  usage: '[options] [skill-name-or-path...]',
  options: {
    ...COMMON_OPTIONS,
    'no-run': { type: 'boolean', help: 'Skip running the skill scripts (--help and no-argument runs)' },
    json: { type: 'boolean', help: 'Also print the results as one JSON line before the RESULT line' },
  },
  positionals: { min: 0, max: Infinity },
  details: `Rules:\n${Object.entries(RULES).map(([id, text]) => `  ${id.padEnd(31)} ${text}`).join('\n')}`,
};

async function main() {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const roots = resolveRoots(options);
  const targets = positionals.length ? resolveTargets(positionals, roots) : defaultTargets(roots);
  const report = createReporter({ name: 'validate-skills' });
  const results = [];
  if (positionals.length === 0) {
    const layout = libraryLayout(roots);
    for (const problem of layout) report.problem(problem);
    if (layout.length) {
      console.log(`FAIL  skills/ layout (${layout.length} problems)`);
      for (const problem of layout) console.log(`      ${formatProblem(problem)}`);
    }
  }
  for (const target of targets) {
    const problems = validateSkill(target, roots, { runScripts: !options['no-run'] });
    results.push({ skill: targetLabel(target), dir: target.dir, problems });
    const label = targetLabel(target);
    if (problems.length === 0) console.log(`PASS  ${label}`);
    else {
      console.log(`FAIL  ${label} (${problems.length} problems)`);
      for (const problem of problems) console.log(`      ${formatProblem(problem)}`);
    }
    for (const problem of problems) report.problem(problem);
  }
  const total = report.count;
  console.log(`validate-skills: ${targets.length} skills checked, ${results.filter((result) => result.problems.length === 0).length} passed, ${total} problems`);
  if (options.json) console.log(JSON.stringify({ skills: results, problems: total }));
  if (targets.length === 0) {
    console.log('ERROR [bad-input] nothing to check: no skill folders found Fix: pass a skill name or path.');
    console.log(resultLine(1));
    return 2;
  }
  console.log(resultLine(total));
  return total === 0 ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run(main);
