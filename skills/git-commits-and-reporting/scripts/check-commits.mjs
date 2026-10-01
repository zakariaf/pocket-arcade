#!/usr/bin/env node
// check-commits.mjs: checks commit messages against the Pocket Arcade format: Conventional Commits
// header with a workspace scope, an imperative lowercase subject, a body that says why (and which
// spec lines a feature serves), and trailers (Gate-Change, Spec-Change) in the last paragraph.
// The rules and their ids are the same as the commit-msg hook's (the repo's
// packages/tooling/src/git/commit-message-rules.ts); --samples runs the shared sample list both
// test suites use, so the two cannot drift.
// Run: node ${CLAUDE_SKILL_DIR}/scripts/check-commits.mjs . --range main..HEAD
//      node ${CLAUDE_SKILL_DIR}/scripts/check-commits.mjs . --message msg.txt --staged

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { createReporter, fail, globToRegExp, parseArgs, requireDir, requireFile, run } from './check-lib.mjs';

const SPEC = {
  name: 'check-commits',
  summary: 'Checks commit messages (a message file, a revision range, or a captured log) against the commit format, the trailer rules and the gated paths: the same rules, with the same ids, as the repo\'s commit-msg hook.',
  usage: '[repo-root] (--message <file> | --range <revs> | --log <file> | --samples <file>) [options]',
  options: {
    message: { type: 'string', value: 'file', help: 'One planned commit message (for example .git/COMMIT_EDITMSG)' },
    staged: { type: 'boolean', help: 'With --message: read the staged files from git for the Gate-Change rule' },
    files: { type: 'string', value: 'a,b', help: 'With --message: the files the commit changes, comma-separated' },
    range: { type: 'string', value: 'revs', help: 'Commits to check, for example main..HEAD (runs git log)' },
    log: { type: 'string', value: 'file', help: 'A log captured with the command below' },
    samples: { type: 'string', value: 'file', help: 'A commit-message-samples.json list: every sample must give exactly its listed rule ids' },
    root: { type: 'string', value: 'dir', help: 'Same as the positional repo root (apps/ and packages/ give the scopes, quality-gates.json the gated paths)' },
    scope: { type: 'string', multiple: true, value: 'name', help: 'Accept an extra scope' },
    json: { type: 'boolean', help: 'Also print the problems as one JSON line before the RESULT line' },
  },
  positionals: { min: 0, max: 1 },
  details: [
    'The repo root is the optional positional argument (default "."). The commit-msg hook in the repo',
    '(packages/tooling/src/git/commit-message-rules.ts) enforces exactly these rules with these ids.',
    '',
    'Rules:',
    '  header-format        the header is not "type(scope): subject"',
    '  header-type          the type is not feat, fix, perf, refactor, test, docs, build, ci, chore, style or revert',
    '  header-scope         the scope is not a folder under apps/ or packages/, nor repo, deps, docs, ci or skills',
    '  scope-missing        the header has no scope',
    '  header-length        the header is longer than 72 characters',
    '  subject-case         the subject starts with a capital letter',
    '  subject-period       the subject ends with a period',
    '  subject-mood         the subject is not imperative ("added", "fixes", "updating")',
    '  subject-vague        the subject says nothing ("wip", "fix", "update", "changes")',
    '  blank-line           the body does not start after one blank line',
    '  body-missing         a feat or fix commit has no body saying why',
    '  spec-ref-missing     a feat or fix commit outside tooling/repo/deps/docs/ci/skills names no spec line (S9, N3, spec 8.3, D4, ...)',
    '  gate-change-missing  a changed file matches gatedPaths and there is no "Gate-Change: <reason>" trailer',
    '                       (whole-path match as in the commit-msg hook: "eslint.config.mjs" is the root file only;',
    '                       files under skills/ or .claude/ count only for patterns that start with that folder)',
    '  gate-change-unneeded a Gate-Change trailer but no gated file changed (only when the files are known)',
    '  trailer-empty        a Gate-Change or Spec-Change trailer has no real reason (under 10 characters)',
    '  spec-change-format   a Spec-Change trailer names no spec section or ID (a directed swap\'s exact trailer,',
    '                       "with-shell final composer (phase 0 placeholder replaced)", needs none)',
    '  trailer-placement    a trailer sits outside the last paragraph (git would not read it)',
    '  placeholder-left     a __PLACEHOLDER__ from templates/commit-message.txt is still in the message',
    '  sample-mismatch      (--samples) a sample gives other rule ids than the shared list says: the hook and',
    '                       this checker have drifted',
    '',
    'With --message, comment lines (#) and everything below git\'s scissors line are dropped first, as git does.',
    'Capture a log for --log:',
    "  git log --reverse --name-only --format='==> commit %H%n%B%n==> files' <revs> > commits.log",
    'Git-generated headers (Merge, Revert ", fixup!, squash!, amend!) are skipped.',
  ].join('\n'),
};

const TYPES = ['feat', 'fix', 'perf', 'refactor', 'test', 'docs', 'build', 'ci', 'chore', 'style', 'revert'];
const FIXED_SCOPES = ['repo', 'deps', 'docs', 'ci', 'skills'];
const NO_SPEC_SCOPES = new Set(['tooling', 'repo', 'deps', 'docs', 'ci', 'skills']);
const HEADER = /^(?<type>[a-z]+)(?:\((?<scope>[^)]*)\))?(?<bang>!)?: (?<subject>\S.*)$/;
const GIT_GENERATED = /^(Merge |Revert "|fixup! |squash! |amend! )/;
const TRAILER = /^(Gate-Change|Spec-Change|Co-Authored-By|Signed-off-by|Refs):\s*(.*)$/i;
const SPEC_ID = /\b(?:spec(?:'s)?\s+(?:sections?\s+)?\d{1,2}(?:\.\d{1,2})?|S\d{1,2}[a-d]?|N\d{1,2}|D\d)\b/i;
// Spec-Change reasons of the directed swaps the build order names letter for letter (the same list as
// the repo's commit-trailer-rules.ts DIRECTED_SWAP_TRAILERS): such a swap replaces a phase-0 file and
// its test on purpose and serves no spec section, so this exact reason needs no spec id.
const DIRECTED_SWAP_TRAILERS = ['with-shell final composer (phase 0 placeholder replaced)'];
const NOT_IMPERATIVE = new Set('added adds adding fixed fixes fixing updated updates updating changed changes changing removed removes removing created creates creating improved improves improving refactored refactors refactoring implemented implements implementing made makes making moved moves moving renamed renames renaming deleted deletes deleting introduced introduces introducing bumped bumps bumping upgraded upgrades upgrading replaced replaces replacing cleaned cleans cleaning wrote writes writing merged merges merging tested tests testing'.split(' '));
const VAGUE = /^(wip|misc|stuff|update|updates|changes|change|fix|fixes|tweak|tweaks|cleanup|work|progress|temp|tmp)$/i;
// The gated paths of the platform, used when the repo has no quality-gates.json yet.
const DEFAULT_GATED = ['quality-gates.json', 'eslint.config.mjs', 'tsconfig.base.json', 'tsconfig.json', '**/tsconfig.json', 'jest.config.js', 'jest.sim.config.js', 'stryker.config.json', 'knip.json', 'lefthook.yml', '.prettierrc.json', '.prettierignore', '.npmrc', '.claude/settings.json', 'packages/tooling/network-audit/**', 'packages/tooling/license-exceptions.json', 'packages/tooling/scripts/install-maestro.sh', 'babel.config.js', 'jest.setup.ts', 'tsconfig.stryker.json', 'test/goldens/boards/skia-golden.ts', '**/__snapshots__/*.golden.test.ts.snap', '**/*.golden.test.ts.snap.ios', '**/__image_snapshots__/**', 'apps/*/e2e/baselines/**', 'perf-baselines/**', '**/fixtures/save-v*.json', 'parity/waivers.json', 'parity/game-facts.json', 'packages/tooling/src/quality/verify-plan.ts', 'packages/tooling/src/quality/run-verify.ts', 'packages/tooling/src/quality/shell-slice.ts', 'packages/tooling/src/quality/device-only.ts'];

function git(repo, args) {
  const result = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.error || result.status !== 0) fail(`git ${args.join(' ')} failed: ${(result.stderr || result.error?.message || '').trim()}`, 'Run inside a git repository and pass a valid revision range.');
  return result.stdout;
}

function parseLog(text) {
  const commits = [];
  let current = null;
  let inFiles = false;
  for (const line of text.split('\n')) {
    const start = /^==> commit ([0-9a-f]{7,40})$/.exec(line);
    if (start) {
      current = { sha: start[1].slice(0, 7), message: [], files: [] };
      commits.push(current);
      inFiles = false;
    } else if (current && line === '==> files') inFiles = true;
    else if (current && inFiles) {
      if (line.trim()) current.files.push(line.trim());
    } else if (current) current.message.push(line);
  }
  return commits.map((commit) => ({ ...commit, message: commit.message.join('\n').replace(/\s+$/, '') }));
}

function listDirs(path) {
  return existsSync(path) && statSync(path).isDirectory() ? readdirSync(path, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name) : [];
}

function paragraphs(lines) {
  const out = [];
  let current = [];
  lines.forEach((text, index) => {
    if (text.trim() === '') {
      if (current.length) out.push(current);
      current = [];
    } else current.push({ text, line: index + 1 });
  });
  if (current.length) out.push(current);
  return out;
}

function checkHeader(add, header, scopes) {
  const match = HEADER.exec(header);
  if (!match) {
    add(1, 'header-format', `header "${header}" is not "type(scope): subject"`, 'Write "<type>(<scope>): <imperative subject>", for example "feat(line-siege): fire a beam when a column clears".');
    return null;
  }
  const { type, scope, subject } = match.groups;
  if (!TYPES.includes(type)) add(1, 'header-type', `type "${type}" is unknown`, `Use one of ${TYPES.join(', ')}.`);
  if (scope === undefined || scope === '') add(1, 'scope-missing', 'the header has no scope', `Name the folder the change is in (${scopes.slice(0, 6).join(', ')}, ...) or repo, deps, docs, ci, skills.`);
  else if (!scopes.includes(scope)) add(1, 'header-scope', `scope "${scope}" is not a workspace folder`, `Use a folder under apps/ or packages/ (${scopes.join(', ')}).`);
  if (header.length > 72) add(1, 'header-length', `header is ${header.length} characters`, 'Shorten the subject; the header holds at most 72 characters.');
  if (/^[A-Z]/.test(subject)) add(1, 'subject-case', `subject "${subject}" starts with a capital letter`, 'Start the subject in lowercase.');
  if (/\.$/.test(subject)) add(1, 'subject-period', 'the subject ends with a period', 'Drop the trailing period.');
  const first = subject.split(/\s+/)[0].toLowerCase();
  if (NOT_IMPERATIVE.has(first)) add(1, 'subject-mood', `subject starts with "${first}"`, 'Use the imperative, as in a command: "add", "fix", "remove" ("fix the streak", not "fixed the streak").');
  if (VAGUE.test(subject.trim())) add(1, 'subject-vague', `subject "${subject}" says nothing`, 'Say what changes for the player or the code: "keep the streak when the clock goes back".');
  return { type, scope: scope ?? '' };
}

// The same rule as the commit-msg hook (packages/tooling/src/git/commit-message-rules.ts, isGatedFile):
// a pattern is matched against the whole repo-relative path (so "eslint.config.mjs" means the root
// file only), and a file under skills/ or .claude/ is gated only by a pattern that starts with that
// folder (".claude/settings.json" stays gated; a skill's template eslint.config.mjs does not).
const UNGATED_FOLDERS = ['skills/', '.claude/'];
const gatedPattern = new Map();

function isGatedFile(file, pattern) {
  const folder = UNGATED_FOLDERS.find((prefix) => file.startsWith(prefix));
  if (folder !== undefined && !pattern.startsWith(folder)) return false;
  let re = gatedPattern.get(pattern);
  if (!re) {
    re = globToRegExp(pattern.replace(/^\.\//, ''));
    gatedPattern.set(pattern, re);
  }
  return re.test(file);
}

function checkTrailers(add, lines, files, gated) {
  const paras = paragraphs(lines);
  const last = paras.length > 1 ? paras.at(-1) : [];
  const lastIsTrailers = last.length > 0 && last.every((entry) => TRAILER.test(entry.text) || /^[A-Za-z-]+:\s/.test(entry.text));
  const trailers = lastIsTrailers ? last : [];
  for (const para of paras.slice(1, lastIsTrailers ? -1 : undefined)) {
    for (const entry of para) {
      if (/^(Gate-Change|Spec-Change|Co-Authored-By):/i.test(entry.text)) add(entry.line, 'trailer-placement', `"${entry.text.slice(0, 40)}" is not in the last paragraph`, 'Move every trailer into one final paragraph after a blank line; git reads trailers only there.');
    }
  }
  const find = (key) => trailers.filter((entry) => new RegExp(`^${key}:`, 'i').test(entry.text));
  const gateTrailers = find('Gate-Change');
  for (const entry of [...gateTrailers, ...find('Spec-Change')]) {
    const reason = entry.text.replace(/^[^:]+:\s*/, '');
    if (reason.trim().length < 10) add(entry.line, 'trailer-empty', `"${entry.text}" gives no real reason`, 'Say why in a few words: "Gate-Change: new daily golden for 2026-09-26 after the damage table change".');
  }
  for (const entry of find('Spec-Change')) {
    if (DIRECTED_SWAP_TRAILERS.includes(entry.text.replace(/^[^:]+:\s*/, '').trim())) continue;
    if (!SPEC_ID.test(entry.text) && !/\bspec\s+\d/i.test(entry.text)) add(entry.line, 'spec-change-format', `"${entry.text.slice(0, 60)}" names no spec section`, 'Write "Spec-Change: spec <section or ID> <what changed>", for example "Spec-Change: spec 8.1 two stars now reach par + 3 (owner decision)".');
  }
  if (files === null) return;
  const gatedFiles = files.filter((file) => gated.some((pattern) => isGatedFile(file, pattern)));
  if (gatedFiles.length > 0 && gateTrailers.length === 0) add(1, 'gate-change-missing', `gated files changed without a Gate-Change trailer: ${gatedFiles.slice(0, 4).join(', ')}`, 'Add a final paragraph "Gate-Change: <why the gate, golden, baseline or fixture had to change>" (only after the owner agreed to a gate change).');
  if (gatedFiles.length === 0 && gateTrailers.length > 0) add(gateTrailers[0].line, 'gate-change-unneeded', 'a Gate-Change trailer but no gated file changed', 'Remove the trailer; the owner finds gate changes by it, so it must be exact.');
}

function checkMessage(report, where, message, files, context) {
  const lines = message.split('\n');
  const header = lines[0] ?? '';
  if (GIT_GENERATED.test(header)) return;
  const add = (line, rule, text, fix) => report.problem({ file: where, line, rule, message: text, fix });
  const parsed = checkHeader(add, header, context.scopes);
  if (lines.length > 1 && lines[1].trim() !== '') add(2, 'blank-line', 'the second line is not blank', 'Leave one blank line between the header and the body.');
  const body = lines.slice(1).join('\n').trim();
  const bodyWithoutTrailers = lines.slice(1).filter((line) => !TRAILER.test(line)).join('\n').trim();
  if (parsed && (parsed.type === 'feat' || parsed.type === 'fix') && bodyWithoutTrailers === '') add(1, 'body-missing', `a ${parsed.type} commit has no body`, 'Add a body that says why the change was made and which spec lines it serves.');
  if (parsed && (parsed.type === 'feat' || parsed.type === 'fix') && !NO_SPEC_SCOPES.has(parsed.scope) && body !== '' && !SPEC_ID.test(body)) add(1, 'spec-ref-missing', 'the body names no spec line', 'Name the spec lines the change serves: "Spec S9 and 8.3: ...".');
  checkTrailers(add, lines, files, context.gated);
  lines.forEach((text, index) => {
    const placeholder = /__[A-Z][A-Z0-9_]*__/.exec(text);
    if (placeholder) add(index + 1, 'placeholder-left', `placeholder ${placeholder[0]} is left`, 'Replace every __PLACEHOLDER__ of the template with real text, and delete the trailer lines that do not apply.');
  });
}

/** The message as git stores it: no comment lines, nothing below the scissors, no trailing space. */
function normalizeMessage(raw) {
  const cut = /^# -+ >8 -+$/m.exec(raw);
  return (cut ? raw.slice(0, cut.index) : raw).split('\n').filter((line) => !line.startsWith('#')).join('\n').replace(/\s+$/, '');
}

/** --samples: every sample of the shared list must give exactly its rule ids (hook and checker agree). */
function checkSamples(file, report) {
  let data;
  try {
    data = JSON.parse(readFileSync(requireFile(file, 'sample list'), 'utf8'));
  } catch (error) {
    if (error.name === 'UsageError') throw error;
    fail(`${file} is not valid JSON (${error.message})`, 'Restore the sample list from the quality-gates templates.');
  }
  if (!Array.isArray(data.samples) || !Array.isArray(data.scopes) || !Array.isArray(data.gatedPaths)) fail(`${file} needs "scopes", "gatedPaths" and "samples"`, 'Restore the sample list from the quality-gates templates.');
  const context = { scopes: [...data.scopes, ...FIXED_SCOPES], gated: data.gatedPaths };
  for (const sample of data.samples) {
    const found = [];
    checkMessage({ problem: (entry) => found.push(entry.rule) }, sample.name, normalizeMessage(sample.message), sample.files ?? null, context);
    const got = [...new Set(found)].sort();
    const want = [...new Set(sample.rules ?? [])].sort();
    if (got.join(',') !== want.join(',')) report.problem({ file, line: 0, rule: 'sample-mismatch', message: `sample "${sample.name}" gives [${got.join(', ')}] but the list says [${want.join(', ')}]`, fix: 'The commit-msg hook (commit-message-rules.ts) and check-commits.mjs must agree: fix whichever rule drifted, and change a sample only together with both rule sets.' });
  }
  return data.samples.length;
}

run(async () => {
  const { options, positionals } = parseArgs(process.argv.slice(2), SPEC);
  const modes = [options.message, options.range, options.log, options.samples].filter(Boolean);
  if (modes.length !== 1) fail('pass exactly one of --message, --range, --log or --samples', 'Run with --help to see the modes.');
  if (options.samples) {
    const report = createReporter({ name: 'check-commits', json: options.json });
    return report.finish({ checked: checkSamples(options.samples, report), unit: 'samples' });
  }
  if (positionals[0] !== undefined && options.root !== undefined && positionals[0] !== options.root) fail(`two repo roots given: ${positionals[0]} and --root ${options.root}`, 'Pass the repo root once, as the positional argument.');
  const root = requireDir(positionals[0] ?? options.root ?? '.', 'repo root');
  const scopes = [...listDirs(join(root, 'apps')), ...listDirs(join(root, 'packages')), ...FIXED_SCOPES, ...(options.scope ?? [])];
  const gatesFile = join(root, 'quality-gates.json');
  const gated = existsSync(gatesFile) ? (JSON.parse(readFileSync(gatesFile, 'utf8')).gatedPaths ?? DEFAULT_GATED) : DEFAULT_GATED;
  const report = createReporter({ name: 'check-commits', json: options.json });
  let commits;
  if (options.message) {
    const text = normalizeMessage(readFileSync(requireFile(options.message, 'message file'), 'utf8'));
    let files = null;
    if (options.files) files = options.files.split(',').map((file) => file.trim()).filter(Boolean);
    else if (options.staged) files = git(root, ['diff', '--cached', '--name-only']).split('\n').filter(Boolean);
    commits = [{ sha: options.message, message: text, files }];
  } else {
    const text = options.log ? readFileSync(requireFile(options.log, 'log file'), 'utf8') : git(root, ['log', '--reverse', '--name-only', '--format===> commit %H%n%B%n==> files', options.range]);
    commits = parseLog(text);
    if (commits.length === 0) fail('the log or range holds no commits', 'Pass a range that contains the new commits, for example main..HEAD.');
  }
  for (const commit of commits) checkMessage(report, commit.sha, commit.message, commit.files, { scopes, gated });
  return report.finish({ checked: commits.length, unit: 'commit messages' });
});
